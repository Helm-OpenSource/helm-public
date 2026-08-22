// lib/member-gateway/signal-candidate-memory-verification.service.ts
// Member Gateway memory member-verification slice (plan
// docs/superpowers/plans/2026-08-22-memory-member-verification.md,
// Architecture 2). Decides a member-anchored MemoryCandidate
// (PENDING_VERIFICATION) as VERIFIED or REJECTED. This is decision-only:
// "verified" here means "confirmed as a genuine member signal", not
// "written into canonical memory" — no MemoryPromotion, no MemoryItem is
// ever written by this file (see the comment on
// verifyMemberSignalMemoryCandidate below for why that is a structural
// impossibility here, not merely a self-imposed skip).
//
// Transaction shape mirrors signal-candidate-memory-projection.service.ts
// (inline Serializable + lockWorkspace issued first on the tx client,
// lib/member-gateway house style) — NOT the projection service's raw
// tx.auditLog.create() audit write, though: this file uses the
// writeAuditLog()/logEvent() helpers instead, mirroring
// lib/helm-v2/runtime-upgrade.ts's acceptReflectionCandidate/
// dismissReflectionCandidate audit shape (per the implementation plan).
//
// This file MUST NEVER touch a runtimeSession-anchored (reflection-family)
// MemoryCandidate row: acceptReflectionCandidate/dismissReflectionCandidate
// in lib/helm-v2/runtime-upgrade.ts own that state machine exclusively and
// are untouched by this slice. The discriminator is the anchor column
// (memberGatewaySessionRef non-null), never a sourceStatus/sourceVerification
// string match — see the plan's Architecture 1 binding.
import "server-only";

import { ActorType, Prisma, RuntimeMemoryCandidateStatus } from "@prisma/client";

import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { safeParseJson, trimText } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

const VERIFIED_AUDIT_ACTION = "MEMBER_SIGNAL_MEMORY_CANDIDATE_VERIFIED" as const;
const REJECTED_AUDIT_ACTION = "MEMBER_SIGNAL_MEMORY_CANDIDATE_REJECTED" as const;

export type MemberSignalMemoryVerificationErrorCode =
  | "invalid_input"
  | "memory_candidate_not_found"
  | "memory_candidate_not_member_anchored"
  | "memory_candidate_corrupt"
  | "memory_candidate_state_conflict";

export class MemberSignalMemoryVerificationError extends Error {
  readonly code: MemberSignalMemoryVerificationErrorCode;
  readonly reasons: readonly string[];

  constructor(
    code: MemberSignalMemoryVerificationErrorCode,
    reasons: readonly string[] = [],
  ) {
    super(
      reasons.length > 0
        ? `member_signal_memory_verification:${code}: ${reasons.join("; ")}`
        : `member_signal_memory_verification:${code}`,
    );
    this.name = "MemberSignalMemoryVerificationError";
    this.code = code;
    this.reasons = reasons;
  }
}

function nonEmpty(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MemberSignalMemoryVerificationError("invalid_input");
  }
  return normalized;
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new MemberSignalMemoryVerificationError("memory_candidate_not_found");
  }
}

// Appends the actor's optional note to whatever reviewerNote already
// exists (mirrors runtime-upgrade.ts's dismissalNote/acceptanceNote
// trimText(..., 280) shape) rather than overwriting it — a verification
// decision must never silently erase an earlier reviewer's note. Returns
// the existing note UNCHANGED (never a placeholder string) when there is
// nothing new to append.
function nextReviewerNote(
  existingNote: string | null,
  note: string | undefined,
): string | null {
  const combined = [existingNote?.trim(), note?.trim()]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return combined ? trimText(combined, 280) : existingNote;
}

export type VerifyMemberSignalMemoryCandidateInput = {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  candidateId: string;
  decision: "verify" | "reject";
  note?: string;
};

export type VerifyMemberSignalMemoryCandidateResult = Readonly<{
  outcome: "decided" | "already_decided";
  status: "VERIFIED" | "REJECTED";
}>;

// Decides a member-anchored MemoryCandidate as VERIFIED or REJECTED (plan
// Architecture 2). Deliberately writes NO MemoryPromotion and NO
// MemoryItem row: MemoryPromotion.runtimeSessionId is a required,
// non-nullable FK (prisma/schema.prisma), while a member-anchored
// MemoryCandidate structurally has no runtime session — its anchor is
// memberGatewaySessionRef, mutually exclusive with runtimeSessionId under
// the MemoryCandidate_anchor_check CHECK added in the M2d T1 migration.
// Writing a MemoryPromotion row here is not a policy choice to skip, it is
// impossible without inventing a fake runtime session. AuditLog is
// therefore this slice's ledger (Owner 裁定记录, plan Architecture 2) —
// the isolated-MySQL suite pins the zero-write proof the same way
// signal-candidate-memory-projection.service.ts's does.
export async function verifyMemberSignalMemoryCandidate(
  input: VerifyMemberSignalMemoryCandidateInput,
): Promise<VerifyMemberSignalMemoryCandidateResult> {
  const workspaceId = nonEmpty(input.workspaceId);
  const actorUserId = nonEmpty(input.actorUserId);
  const actorName = nonEmpty(input.actorName);
  const candidateId = nonEmpty(input.candidateId);
  if (input.decision !== "verify" && input.decision !== "reject") {
    throw new MemberSignalMemoryVerificationError("invalid_input");
  }
  const note = input.note?.trim() || undefined;

  const targetStatus: "VERIFIED" | "REJECTED" =
    input.decision === "verify"
      ? RuntimeMemoryCandidateStatus.VERIFIED
      : RuntimeMemoryCandidateStatus.REJECTED;
  const actionType =
    input.decision === "verify" ? VERIFIED_AUDIT_ACTION : REJECTED_AUDIT_ACTION;
  const summary =
    input.decision === "verify"
      ? "A member-anchored memory candidate was verified as a genuine member signal. Verification confirms the signal; it does not write memory."
      : "A member-anchored memory candidate was rejected.";

  // Memory capability gate (Architecture 2 binding: MANAGE_MEMORY_FACTS —
  // the same capability the sibling distillation surface and the
  // projection service both gate on; no newly-minted capability
  // constant), issued outside the transaction.
  await assertWorkspaceMemoryServiceAccess({
    workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: false,
  });

  const decideOnce = () =>
    db.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);

      const candidate = await tx.memoryCandidate.findFirst({
        where: { id: candidateId, workspaceId },
      });
      if (!candidate) {
        throw new MemberSignalMemoryVerificationError(
          "memory_candidate_not_found",
        );
      }
      // Must be member-anchored: this service never touches a
      // runtimeSession-anchored (reflection-family) row — those stay
      // exclusively under acceptReflectionCandidate/
      // dismissReflectionCandidate in lib/helm-v2/runtime-upgrade.ts.
      if (!candidate.memberGatewaySessionRef) {
        throw new MemberSignalMemoryVerificationError(
          "memory_candidate_not_member_anchored",
        );
      }

      // Corrupt provenance blocks the decision at the service layer too —
      // the UI already renders such rows commandless, but "行不可操作"
      // must hold for direct callers as well. The row itself stays put
      // (append-only posture; no destructive handling of corrupt data).
      const parsedSourceStatus = safeParseJson<Record<string, unknown> | null>(
        candidate.sourceStatus,
        null,
      );
      if (
        !parsedSourceStatus ||
        parsedSourceStatus.taint !== "untrusted" ||
        parsedSourceStatus.evaluationUseProhibited !== true
      ) {
        throw new MemberSignalMemoryVerificationError(
          "memory_candidate_corrupt",
        );
      }

      // Idempotent same-direction replay: already at the requested target
      // status — no writes, no audit row.
      if (candidate.status === targetStatus) {
        return {
          outcome: "already_decided" as const,
          status: targetStatus,
        };
      }
      // Any other non-pending status (the opposite terminal, DEFERRED, or
      // PROMOTED) is a terminal-state conflict: a decision here can never
      // be reversed once made.
      if (candidate.status !== RuntimeMemoryCandidateStatus.PENDING_VERIFICATION) {
        throw new MemberSignalMemoryVerificationError(
          "memory_candidate_state_conflict",
        );
      }

      const reviewerNote = nextReviewerNote(candidate.reviewerNote, note);

      // CAS PENDING_VERIFICATION -> VERIFIED|REJECTED, re-asserting the
      // member anchor in the predicate itself — defense in depth against a
      // concurrent write racing between the read above and this update
      // (the surrounding Serializable transaction is the primary guard).
      const claimed = await tx.memoryCandidate.updateMany({
        where: {
          id: candidateId,
          workspaceId,
          status: RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
          memberGatewaySessionRef: { not: null },
        },
        data: {
          status: targetStatus,
          reviewerNote,
        },
      });
      if (claimed.count !== 1) {
        throw new MemberSignalMemoryVerificationError(
          "memory_candidate_state_conflict",
        );
      }

      // Audit ledger only — no MemoryPromotion/MemoryItem row (see the
      // function-level comment for why that is structurally impossible
      // here, not merely skipped). Payload carries only refs and the
      // before/after status, no candidate body text.
      await writeAuditLog(
        {
          workspaceId,
          userId: actorUserId,
          actor: actorName,
          actorType: ActorType.USER,
          actionType,
          targetType: "MemoryCandidate",
          targetId: candidateId,
          summary,
          payload: {
            candidateId,
            candidateKey: candidate.candidateKey,
            memberGatewaySessionRef: candidate.memberGatewaySessionRef,
            artifactBundleId: candidate.artifactBundleId,
            previousStatus: candidate.status,
            nextStatus: targetStatus,
          },
        },
        { client: tx },
      );

      return { outcome: "decided" as const, status: targetStatus };
    }, TRANSACTION_OPTIONS);

  const result = await runWithWriteConflictRetry(decideOnce, WRITE_RETRY_OPTIONS);

  // logEvent mirrors acceptReflectionCandidate/dismissReflectionCandidate's
  // ordering (writeAuditLog inside the write, logEvent right after) but is
  // skipped on an already_decided replay — matching those functions' own
  // early-return-without-audit behavior for a no-op re-call.
  if (result.outcome === "decided") {
    await logEvent({
      workspaceId,
      userId: actorUserId,
      eventName:
        input.decision === "verify"
          ? "member_signal_memory_candidate_verified"
          : "member_signal_memory_candidate_rejected",
      eventCategory: "memory",
      targetType: "MemoryCandidate",
      targetId: candidateId,
      metadata: {
        status: result.status,
      },
    });
  }

  return result;
}
