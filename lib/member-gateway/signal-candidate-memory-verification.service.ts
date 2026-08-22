// lib/member-gateway/signal-candidate-memory-verification.service.ts
// Member Gateway memory member-fact-write slice (plan
// docs/superpowers/plans/2026-08-22-memory-member-fact-write.md,
// Architecture 3). Owner's 2026-08-22 second-round ruling 3 ("验证即自动
// 写入") SUPERSEDES the prior round's ruling 3 ("验证≠写入、文案诚实"): a
// "verify" decision on a member-anchored MemoryCandidate
// (PENDING_VERIFICATION) now BOTH confirms the signal as genuine AND
// writes it into runtime memory (a MemoryItem row), permanently tagged
// untrusted via sourceProvenance. The candidate's terminal state for a
// verify decision is therefore PROMOTED (memoryItemId backfilled in the
// same CAS write), not VERIFIED — VERIFIED is a legacy status this service
// no longer produces; any pre-existing VERIFIED row from the prior
// semantics stays put, un-migrated (see verifyMemberSignalMemoryCandidate
// below). "reject" is unchanged: REJECTED, no MemoryItem.
//
// MemoryPromotion is STILL never written here — see the comment on
// verifyMemberSignalMemoryCandidate below for why that remains a
// structural impossibility (runtimeSessionId is a required FK a
// member-anchored row can never satisfy), unaffected by this ruling.
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

import {
  ActorType,
  MemoryItemKind,
  MemoryItemPromotionRule,
  MemoryItemRetention,
  MemoryItemScope,
  MemoryItemSensitivity,
  MemoryItemStatus,
  MemoryItemVerification,
  ObjectType,
  Prisma,
  RuntimeMemoryCandidateStatus,
} from "@prisma/client";

import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { assertWorkspaceMemoryServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
  MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
  validateMemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import type { MemberWorkSignalCandidateArtifact } from "@/lib/member-gateway/signal-candidate";
import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";

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

// Type-pinned finder, byte-identical filter to signal-candidate-review.
// service.ts's private findMemberSignalCandidateBundle and
// signal-candidate-memory-projection.service.ts's own copy of the same
// (deliberately duplicated rather than imported — both are module-private
// elsewhere, and this file stays independently self-contained rather than
// widening either file's export surface for a single caller). Only the
// artifactsJson column is selected: this file never touches review/bundle
// status, it only needs the artifact body for the anchor/summary it writes
// into the MemoryItem.
async function findMemberSignalCandidateArtifactBundle(
  tx: Tx,
  workspaceId: string,
  artifactBundleId: string,
): Promise<{ artifactsJson: string } | null> {
  return tx.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
      artifactType: MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
    select: { artifactsJson: true },
  });
}

// Re-parses and re-validates on every read (module convention shared with
// signal-candidate-review.service.ts and signal-candidate-memory-
// projection.service.ts) — a corrupt or tampered artifact must never be
// trusted just because it was accepted once at materialization time. Any
// parse/shape failure collapses to memory_candidate_corrupt, same code the
// candidate's own sourceStatus corruption check above already uses — a
// verify decision must never write memory off an untrustworthy artifact.
function parseCandidateArtifact(
  artifactsJson: string,
): MemberWorkSignalCandidateArtifact {
  try {
    const parsed = JSON.parse(
      artifactsJson,
    ) as MemberWorkSignalCandidateArtifact;
    const validation = validateMemberWorkSignalCandidateArtifact(parsed);
    if (!validation.valid) {
      throw new MemberSignalMemoryVerificationError("memory_candidate_corrupt");
    }
    return parsed;
  } catch (error) {
    if (error instanceof MemberSignalMemoryVerificationError) throw error;
    throw new MemberSignalMemoryVerificationError("memory_candidate_corrupt");
  }
}

// Whitelist match, never an `as` cast (plan Architecture 2 binding): an
// anchor's objectType is member-controlled input that has only ever been
// validated as a non-empty string (signal-candidate.ts's
// validateMemberWorkSignalCandidateArtifact), never checked against the
// Prisma ObjectType enum. The lookup is built FROM the enum's own values
// (rather than force-casting the untrusted string INTO the enum type), so
// an unrecognized or spoofed objectType string can only ever resolve to
// `undefined` here, never silently coerce into a plausible-looking enum
// member.
const OBJECT_TYPE_LOOKUP: Readonly<Record<string, ObjectType>> = Object.values(
  ObjectType,
).reduce<Record<string, ObjectType>>((lookup, value) => {
  lookup[value] = value;
  return lookup;
}, {});

// Anchor resolution (plan Architecture 2): a resolved anchor whose
// objectType string is exactly a whitelisted ObjectType member gets the
// MemoryItem's typed objectType/objectId columns; every other case
// (unresolved, or resolved-but-unrecognized) writes an anchor-less item —
// the caller is responsible for keeping the artifact's full, opaque
// objectAnchor in sourceProvenance either way.
function resolveMemoryItemAnchor(
  artifact: MemberWorkSignalCandidateArtifact,
): { objectType?: ObjectType; objectId?: string } {
  if (!artifact.objectAnchor.resolved) {
    return {};
  }
  const objectType = OBJECT_TYPE_LOOKUP[artifact.objectAnchor.objectType];
  if (!objectType) {
    return {};
  }
  return { objectType, objectId: artifact.objectAnchor.objectId };
}

// writer/namespace identify this write-on-verify pipeline the same way
// lib/helm-v2/human-action-execution-runtime.ts's EXECUTION_HUMAN_WRITER
// identifies a human-triggered (non-agent) MemoryItem write — MemoryItem.
// writer is a plain string column, not bound to the HelmV2Writer union.
const MEMBER_SIGNAL_MEMORY_ITEM_WRITER = "member-gateway-verification" as const;
const MEMBER_SIGNAL_MEMORY_ITEM_NAMESPACE = "member_signal" as const;
const MEMBER_SIGNAL_MEMORY_ITEM_BOUNDARY_NOTE =
  "This memory item is member-authored and carries a permanent untrusted-source annotation (sourceProvenance.taint/evaluationUseProhibited): it must never be used as evaluation or judgment input, only for human review/display.";

// Deliberately DOES NOT set meetingId/opportunityId/companyId (all three
// remain unset/null): those columns are exactly the OR-filter keys several
// lib/helm-v2 runtimes (opportunity-judge-runtime.ts,
// draft-comms-handoff-runtime.ts, connector-ingestion-retrieval-runtime.ts)
// use to load MemoryItem rows INTO AI evaluation/judgment context. Leaving
// them null structurally excludes this permanently-tainted item from every
// one of those loaders regardless of status/verification — a stronger,
// self-enforcing guarantee of evaluationUseProhibited than picking
// "safe-looking" enum values would be. objectType/objectId (the generic
// anchor, not those object-family FKs) are the only object linkage this
// item ever carries.
function buildMemberSignalMemoryItemCreateData(input: {
  workspaceId: string;
  artifactBundleId: string;
  candidate: { memberGatewaySessionRef: string; candidateKey: string };
  artifact: MemberWorkSignalCandidateArtifact;
}): Prisma.MemoryItemUncheckedCreateInput {
  const anchor = resolveMemoryItemAnchor(input.artifact);
  return {
    workspaceId: input.workspaceId,
    artifactBundleId: input.artifactBundleId,
    objectType: anchor.objectType,
    objectId: anchor.objectId,
    kind: MemoryItemKind.OBJECT_FACT,
    scope: anchor.objectType ? MemoryItemScope.OBJECT : MemoryItemScope.WORKSPACE,
    namespace: MEMBER_SIGNAL_MEMORY_ITEM_NAMESPACE,
    // status CONFIRMED (not PROMOTED): a human did confirm this row (the
    // verify decision itself), but MemoryItemStatus.PROMOTED is read by
    // connector-ingestion-retrieval-runtime.ts's toMemoryTrustStatus as
    // "human_confirmed" REGARDLESS of the verification column — staying at
    // CONFIRMED avoids that shortcut classifying a permanently-untrusted
    // item as trustworthy. verification DRAFT (not HUMAN_CONFIRMED): only
    // the signal's genuineness was confirmed, never the content's truth —
    // HUMAN_CONFIRMED would claim the opposite of evaluationUseProhibited.
    status: MemoryItemStatus.CONFIRMED,
    verification: MemoryItemVerification.DRAFT,
    sensitivity: MemoryItemSensitivity.INTERNAL,
    retention: MemoryItemRetention.UNTIL_VERIFIED,
    promotionRule: MemoryItemPromotionRule.NONE,
    writer: MEMBER_SIGNAL_MEMORY_ITEM_WRITER,
    // Bounded the same way signal-candidate-memory-projection.service.ts
    // bounds its MemoryCandidate.summary (`.slice(0, 4_000)`) — both
    // MemoryItem.summary and .payload are @db.LongText (no VARCHAR cap),
    // so this is a defensive parity choice, not a schema-forced one.
    summary: trimText(input.artifact.projectedSummary, 4_000),
    payload: jsonStringify({
      kind: input.artifact.kind,
      projectedDetail: input.artifact.projectedDetail,
      linkEvidence: input.artifact.linkEvidence,
      objectAnchor: input.artifact.objectAnchor,
      boundary: MEMBER_SIGNAL_MEMORY_ITEM_BOUNDARY_NOTE,
    }),
    // Permanent taint annotation (plan Architecture 1): taint/
    // evaluationUseProhibited travel WITH the item forever, plus the full
    // member/device/client/policy/receipt/session provenance chain and the
    // opaque objectAnchor (Architecture 2's "否则... opaque objectRef 保留
    // 在 provenance" — preserved here regardless of which anchor branch was
    // taken).
    sourceProvenance: jsonStringify({
      taint: "untrusted",
      evaluationUseProhibited: true,
      memberRef: input.artifact.memberRef,
      deviceRegistrationRef: input.artifact.deviceRegistrationRef,
      clientId: input.artifact.clientId,
      policyRef: input.artifact.policyRef,
      policyVersion: input.artifact.policyVersion,
      signalReceiptRef: input.artifact.signalReceiptRef,
      gatewaySessionRef: input.candidate.memberGatewaySessionRef,
      artifactBundleId: input.artifactBundleId,
      candidateKey: input.candidate.candidateKey,
      objectAnchor: input.artifact.objectAnchor,
    }),
    evidenceRefs: jsonStringify(input.artifact.relatedEvidenceRefs),
    confirmedAt: new Date(),
  };
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
  status: "PROMOTED" | "REJECTED";
  memoryItemId?: string;
}>;

// Decides a member-anchored MemoryCandidate as PROMOTED (verify) or
// REJECTED (reject) — plan Architecture 3, superseding the prior round's
// decision-only semantics (see the file header). A "verify" decision now
// ALSO writes a permanently-tainted MemoryItem in the SAME CAS write that
// flips status PENDING_VERIFICATION -> PROMOTED and backfills
// memoryItemId; "reject" is unchanged (REJECTED, no MemoryItem).
//
// Still deliberately writes NO MemoryPromotion row:
// MemoryPromotion.runtimeSessionId is a required, non-nullable FK
// (prisma/schema.prisma), while a member-anchored MemoryCandidate
// structurally has no runtime session — its anchor is
// memberGatewaySessionRef, mutually exclusive with runtimeSessionId under
// the MemoryCandidate_anchor_check CHECK added in the M2d T1 migration.
// Writing a MemoryPromotion row here is not a policy choice to skip, it is
// impossible without inventing a fake runtime session. AuditLog remains
// this slice's ledger (Owner 裁定记录, plan Architecture 3) — the
// isolated-MySQL suite pins the MemoryPromotion zero-write proof the same
// way signal-candidate-memory-projection.service.ts's does, alongside the
// new MemoryItem-write proof.
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

  const targetStatus: "PROMOTED" | "REJECTED" =
    input.decision === "verify"
      ? RuntimeMemoryCandidateStatus.PROMOTED
      : RuntimeMemoryCandidateStatus.REJECTED;
  const actionType =
    input.decision === "verify" ? VERIFIED_AUDIT_ACTION : REJECTED_AUDIT_ACTION;
  const summary =
    input.decision === "verify"
      ? "A member-anchored memory candidate was verified as a genuine member signal and written into runtime memory with a permanent untrusted-source annotation."
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

      // Idempotency / terminal-state handling. PENDING_VERIFICATION is the
      // only status a CAS-guarded decision may transition FROM (checked
      // below); every other status is either a same-direction replay or a
      // terminal conflict.
      if (candidate.status !== RuntimeMemoryCandidateStatus.PENDING_VERIFICATION) {
        if (candidate.status === targetStatus) {
          // Same-direction replay. For "verify" the row must ALSO already
          // carry the memoryItemId the CAS below always backfills in the
          // same write as the status flip — a PROMOTED row with a null
          // memoryItemId is a data anomaly (never producible by this
          // function), not a safe replay to report as already_decided.
          if (input.decision === "verify") {
            if (!candidate.memoryItemId) {
              throw new MemberSignalMemoryVerificationError(
                "memory_candidate_state_conflict",
              );
            }
            return {
              outcome: "already_decided" as const,
              status: targetStatus,
              memoryItemId: candidate.memoryItemId,
            };
          }
          return { outcome: "already_decided" as const, status: targetStatus };
        }
        // Any other non-pending status is a terminal-state conflict: a
        // decision here can never be reversed once made. This covers the
        // opposite terminal, DEFERRED, a PROMOTED row while deciding
        // "reject", AND a legacy VERIFIED row — VERIFIED is a status this
        // service no longer produces (superseded by the 2026-08-22
        // second-round ruling; see the file header), so any row still
        // sitting at VERIFIED predates this ruling and is never
        // auto-upgraded to PROMOTED here.
        throw new MemberSignalMemoryVerificationError(
          "memory_candidate_state_conflict",
        );
      }

      const reviewerNote = nextReviewerNote(candidate.reviewerNote, note);

      // Write-on-verify (plan Architecture 3): load + re-validate the
      // candidate's own source artifact and create the MemoryItem BEFORE
      // the CAS update below, so its id can be backfilled into
      // memoryItemId in the SAME write that flips the status. A "reject"
      // decision skips this block entirely — memoryItem stays undefined
      // and the CAS data below omits memoryItemId.
      let memoryItemId: string | undefined;
      if (input.decision === "verify") {
        if (!candidate.artifactBundleId) {
          throw new MemberSignalMemoryVerificationError(
            "memory_candidate_corrupt",
          );
        }
        const bundle = await findMemberSignalCandidateArtifactBundle(
          tx,
          workspaceId,
          candidate.artifactBundleId,
        );
        if (!bundle) {
          throw new MemberSignalMemoryVerificationError(
            "memory_candidate_corrupt",
          );
        }
        const artifact = parseCandidateArtifact(bundle.artifactsJson);
        const memoryItem = await tx.memoryItem.create({
          data: buildMemberSignalMemoryItemCreateData({
            workspaceId,
            artifactBundleId: candidate.artifactBundleId,
            candidate: {
              memberGatewaySessionRef: candidate.memberGatewaySessionRef,
              candidateKey: candidate.candidateKey,
            },
            artifact,
          }),
        });
        memoryItemId = memoryItem.id;
      }

      // CAS PENDING_VERIFICATION -> PROMOTED|REJECTED, re-asserting the
      // member anchor in the predicate itself — defense in depth against a
      // concurrent write racing between the read above and this update
      // (the surrounding Serializable transaction is the primary guard).
      // memoryItemId is backfilled in this SAME update for "verify" — if
      // this CAS loses its race, the whole transaction (including the
      // MemoryItem create above) rolls back, so no orphan MemoryItem can
      // ever survive a lost claim.
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
          ...(memoryItemId ? { memoryItemId } : {}),
        },
      });
      if (claimed.count !== 1) {
        throw new MemberSignalMemoryVerificationError(
          "memory_candidate_state_conflict",
        );
      }

      // Audit ledger — still no MemoryPromotion row (see the
      // function-level comment for why that is structurally impossible
      // here, not merely skipped). Payload carries only refs and the
      // before/after status, no candidate body text; memoryItemId/
      // memoryItemCreated are added only for "verify".
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
            ...(memoryItemId
              ? { memoryItemId, memoryItemCreated: true }
              : {}),
          },
        },
        { client: tx },
      );

      return {
        outcome: "decided" as const,
        status: targetStatus,
        ...(memoryItemId ? { memoryItemId } : {}),
      };
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
        ...(result.memoryItemId ? { memoryItemId: result.memoryItemId } : {}),
      },
    });
  }

  return result;
}
