// lib/member-gateway/signal-candidate-memory-projection.service.ts
// Member Gateway M2d Task 3: stage-two fact promotion (design doc
// docs/superpowers/specs/2026-08-20-member-gateway-stage-two-fact-promotion
// -design.md §2.2/§2.3, Architecture 4, Owner 裁定记录 1-4). Projects a
// CONFIRMED member signal candidate into a session-anchored
// `MemoryCandidate(PENDING_VERIFICATION)` row — never a MemoryPromotion,
// never a MemoryItem, never a canonical memory write. This mirrors
// lib/governed-intelligence/capability-closeout-review.ts's
// projectConfirmedArtifactToMemoryCandidate in SHAPE (type-pinned load,
// deterministic candidateKey, three-layer idempotency, frozen-false
// receipt literals) but deliberately does NOT call or import from that
// file or lib/governed-intelligence: this file's transactions are inline
// Serializable with lockWorkspace issued first on the tx client
// (lib/member-gateway house style, matching signal-candidate-review.
// service.ts), NOT the closeout file's baseline-grandfathered
// db.$transaction with no explicit isolation level.
//
// This file MUST be a NEW file, never folded into signal-candidate-review.
// service.ts: the llm-candidate boundary gate's TARGET_ROOTS
// (scripts/check-llm-candidate-boundaries.ts) is
// ["lib/llm", "lib/llm-workflows", "lib/recommendations"] — it does not
// scan lib/member-gateway at all, so nothing here is statically forced to
// avoid MemoryPromotion/MemoryItem writes by that gate. The prohibition is
// therefore self-enforced by design (no such write appears anywhere below)
// and pinned by the isolated-MySQL suite's explicit zero-write proof
// (signal-candidate.mysql.test.ts), not by a static scanner.
import "server-only";

import {
  ActorType,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  Prisma,
  RuntimeMemoryCandidateStatus,
} from "@prisma/client";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import {
  assertWorkspaceGovernedCandidatePromotionServiceAccess,
  assertWorkspaceMemoryServiceAccess,
} from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  computeMemberWorkSignalCandidateContentHash,
  MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
  MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
  validateMemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import type { MemberWorkSignalCandidateArtifact } from "@/lib/member-gateway/signal-candidate";
import { jsonStringify } from "@/lib/utils";

type Tx = Prisma.TransactionClient;
type DbClient = Tx | typeof db;
type CandidateBundleRow = Prisma.ArtifactBundleGetPayload<{
  include: { artifactReview: true };
}>;

const PROJECTED_AUDIT_ACTION =
  "MEMBER_SIGNAL_MEMORY_CANDIDATE_PROJECTED" as const;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

export type MemberSignalMemoryProjectionErrorCode =
  | "invalid_input"
  | "candidate_not_found"
  | "candidate_not_confirmed"
  | "candidate_artifact_corrupt"
  | "signal_receipt_superseded"
  | "signal_receipt_not_found"
  | "signal_receipt_without_session"
  | "gateway_session_not_found"
  | "memory_candidate_conflict";

export class MemberSignalMemoryProjectionError extends Error {
  readonly code: MemberSignalMemoryProjectionErrorCode;
  readonly reasons: readonly string[];

  constructor(
    code: MemberSignalMemoryProjectionErrorCode,
    reasons: readonly string[] = [],
  ) {
    super(
      reasons.length > 0
        ? `member_signal_memory_projection:${code}: ${reasons.join("; ")}`
        : `member_signal_memory_projection:${code}`,
    );
    this.name = "MemberSignalMemoryProjectionError";
    this.code = code;
    this.reasons = reasons;
  }
}

// Internal, module-private CAS-loss signal (mirrors signal-candidate-
// review.service.ts's MemberSignalCandidatePromotionClaimLostError): caught
// only inside this file to fall back to a second attempt, never surfaced
// to callers.
class MemberSignalMemoryProjectionClaimLostError extends Error {}

function nonEmpty(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MemberSignalMemoryProjectionError("invalid_input");
  return normalized;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new MemberSignalMemoryProjectionError("candidate_not_found");
  }
}

// Type-pinned finder, byte-identical filter to signal-candidate-review.
// service.ts's private findMemberSignalCandidateBundle (deliberately
// duplicated rather than imported — that function is module-private
// there, and this file stays independently self-contained rather than
// widening that file's export surface for a single caller).
async function findMemberSignalCandidateBundle(
  client: DbClient,
  workspaceId: string,
  artifactBundleId: string,
): Promise<CandidateBundleRow | null> {
  return client.artifactBundle.findFirst({
    where: {
      id: artifactBundleId,
      workspaceId,
      artifactType: MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
      reviewPosture: MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
  });
}

// Re-parses and re-validates on every read (module convention shared with
// signal-candidate-review.service.ts) — a corrupt or tampered row must
// never be trusted just because it was accepted once at materialization
// time.
function parseCandidateArtifact(
  artifactsJson: string,
): MemberWorkSignalCandidateArtifact {
  try {
    const parsed = JSON.parse(
      artifactsJson,
    ) as MemberWorkSignalCandidateArtifact;
    const validation = validateMemberWorkSignalCandidateArtifact(parsed);
    if (!validation.valid) {
      throw new MemberSignalMemoryProjectionError("candidate_artifact_corrupt");
    }
    return parsed;
  } catch (error) {
    if (error instanceof MemberSignalMemoryProjectionError) throw error;
    throw new MemberSignalMemoryProjectionError("candidate_artifact_corrupt");
  }
}

// Supersession re-check (mirrors signal-candidate-review.service.ts's
// assertCandidateSignalNotSuperseded): a signal may be corrected AFTER its
// candidate was reviewed/confirmed — a superseded signal's candidate must
// never be projected into memory; the correction's own candidate (a
// separate ArtifactBundle) is the projectable head. Queried on `tx` inside
// the Serializable transaction so a correction racing with this call
// cannot slip past the check.
async function assertCandidateSignalNotSuperseded(
  tx: Tx,
  workspaceId: string,
  signalReceiptRef: string,
): Promise<void> {
  const supersededBy = await tx.memberWorkSignalReceipt.findUnique({
    where: {
      workspaceId_supersedesReceiptRef: {
        workspaceId,
        supersedesReceiptRef: signalReceiptRef,
      },
    },
    select: { id: true },
  });
  if (supersededBy) {
    throw new MemberSignalMemoryProjectionError("signal_receipt_superseded");
  }
}

// Session anchor resolution (design doc §2.2, M2d Architecture 4): the
// candidate's confirmed signal receipt row carries the gatewaySessionRef
// that was stamped at ISSUANCE time (M2d Task 2) — never re-resolved here.
// A receipt with no session anchor (every receipt written before the M2d
// migration, permanently — Owner 裁定记录 #2, "历史回执永久不参与事实晋
// 升") is rejected outright, not silently treated as anchor-less; the
// session row itself is then re-validated to exist in the SAME workspace
// (defense in depth — the FK-free relationMode=prisma schema cannot
// enforce this at the database layer).
async function resolveMemberGatewaySessionRefForProjection(
  tx: Tx,
  workspaceId: string,
  signalReceiptRef: string,
): Promise<string> {
  const receiptRow = await tx.memberWorkSignalReceipt.findUnique({
    where: { id_workspaceId: { id: signalReceiptRef, workspaceId } },
    select: { gatewaySessionRef: true },
  });
  if (!receiptRow) {
    throw new MemberSignalMemoryProjectionError("signal_receipt_not_found");
  }
  if (!receiptRow.gatewaySessionRef) {
    throw new MemberSignalMemoryProjectionError(
      "signal_receipt_without_session",
    );
  }
  const session = await tx.memberGatewaySession.findUnique({
    where: {
      id_workspaceId: { id: receiptRow.gatewaySessionRef, workspaceId },
    },
    select: { id: true },
  });
  if (!session) {
    throw new MemberSignalMemoryProjectionError("gateway_session_not_found");
  }
  return session.id;
}

// Deterministic candidateKey (spec formula, one bundle -> one memory
// candidate): hashes over workspaceId + artifactBundleId +
// artifactsJsonHash. artifactsJsonHash is the artifact's own canonical
// content hash (computeMemberWorkSignalCandidateContentHash, already
// exported by signal-candidate.ts) rather than a hash of the raw stored
// artifactsJson TEXT — canonical hashing is immune to incidental
// whitespace/key-order drift in the stored column, matching this module's
// existing "never trust the stored bytes, re-derive" convention.
function memberSignalMemoryCandidateKey(input: {
  workspaceId: string;
  artifactBundleId: string;
  artifactsJsonHash: string;
}): string {
  return `member-signal-memory:${sha256(canonicalJson(input)).slice(0, 32)}`;
}

export type MemberSignalMemoryCandidateProjectionReceipt = Readonly<{
  receiptId: string;
  workspaceRef: string;
  sourceArtifactBundleId: string;
  sourceArtifactReviewId: string;
  memberGatewaySessionRef: string;
  memoryCandidateId: string;
  memoryCandidateKey: string;
  candidateStatus: "pending_verification";
  memoryPromotionCreated: false;
  canonicalMemoryWritten: false;
  projectedAt: string;
  receiptHash: string;
}>;

// Zod-free, plain-object receipt builder (module convention: member-
// gateway stays zero-zod at this layer). Self-hash covers every field
// EXCEPT receiptHash itself, so a receipt is tamper-evident the same way
// governed's buildGovernedMemoryCandidateProjectionReceipt is, without
// pulling in that file's zod schemas.
function buildProjectionReceipt(
  input: Omit<MemberSignalMemoryCandidateProjectionReceipt, "receiptHash">,
): MemberSignalMemoryCandidateProjectionReceipt {
  const receiptHash = sha256(canonicalJson(input));
  return Object.freeze({ ...input, receiptHash });
}

type ExistingProjectionMatch = {
  id: string;
  createdAt: Date;
};

// Layer 1 of three-layer idempotency: candidateKey existence, THEN a
// matching append-only audit row for this exact MemoryCandidate id, THEN
// full field equality against what this call would have written. Any
// mismatch is drift, not a benign replay — reject loud rather than
// silently reuse a row that disagrees with the current recomputation.
async function findExistingProjection(
  client: DbClient,
  input: {
    workspaceId: string;
    candidateKey: string;
    artifactBundleId: string;
    memberGatewaySessionRef: string;
    summary: string;
    sourceVerification: string;
    sourceStatus: string;
    evidenceRefs: string;
  },
): Promise<ExistingProjectionMatch | null> {
  const existing = await client.memoryCandidate.findUnique({
    where: { candidateKey: input.candidateKey },
  });
  if (!existing) return null;
  const audit = await client.auditLog.findFirst({
    where: {
      workspaceId: input.workspaceId,
      actionType: PROJECTED_AUDIT_ACTION,
      targetType: "MemoryCandidate",
      targetId: existing.id,
    },
    select: { id: true },
  });
  if (
    existing.workspaceId !== input.workspaceId ||
    existing.artifactBundleId !== input.artifactBundleId ||
    existing.memberGatewaySessionRef !== input.memberGatewaySessionRef ||
    existing.runtimeSessionId !== null ||
    existing.status !== RuntimeMemoryCandidateStatus.PENDING_VERIFICATION ||
    existing.summary !== input.summary ||
    existing.sourceVerification !== input.sourceVerification ||
    existing.sourceStatus !== input.sourceStatus ||
    existing.evidenceRefs !== input.evidenceRefs ||
    !audit
  ) {
    throw new MemberSignalMemoryProjectionError("memory_candidate_conflict");
  }
  return { id: existing.id, createdAt: existing.createdAt };
}

export type ProjectConfirmedMemberSignalCandidateToMemoryCandidateInput = {
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  artifactBundleId: string;
};

export type ProjectConfirmedMemberSignalCandidateToMemoryCandidateResult = {
  receipt: MemberSignalMemoryCandidateProjectionReceipt;
  reused: boolean;
};

// Projects a CONFIRMED member signal candidate to a session-anchored
// PENDING_VERIFICATION MemoryCandidate (design doc §2.2/§2.3, Architecture
// 4). NEVER writes MemoryPromotion or MemoryItem — see the file header for
// why that is a self-enforced discipline here rather than a gate-checked
// one, and signal-candidate.mysql.test.ts for the runtime zero-write
// proof.
export async function projectConfirmedMemberSignalCandidateToMemoryCandidate(
  input: ProjectConfirmedMemberSignalCandidateToMemoryCandidateInput,
): Promise<ProjectConfirmedMemberSignalCandidateToMemoryCandidateResult> {
  const workspaceId = nonEmpty(input.workspaceId);
  const actorUserId = nonEmpty(input.actorUserId);
  const actorName = nonEmpty(input.actorName);
  const artifactBundleId = nonEmpty(input.artifactBundleId);

  // Dual gate (Architecture 4 binding, BOTH outside the transaction):
  // stage-one's PROMOTE_GOVERNED_CANDIDATES capability, reused rather than
  // a newly-minted capability constant (Owner 裁定记录 #4), PLUS the
  // existing memory-write seam every other memory-candidate projection in
  // this repo requires (assertWorkspaceMemoryServiceAccess). A MEMBER-role
  // caller has neither capability (lib/auth/authorization.ts's
  // ROLE_CAPABILITY_MATRIX maps MEMBER to an empty set) and is rejected by
  // the first gate before the second ever runs.
  await assertWorkspaceGovernedCandidatePromotionServiceAccess({
    workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: false,
  });
  await assertWorkspaceMemoryServiceAccess({
    workspaceId,
    userId: actorUserId,
    actorType: ActorType.USER,
    english: false,
  });

  const projectOnce = () =>
    db.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);

      const bundle = await findMemberSignalCandidateBundle(
        tx,
        workspaceId,
        artifactBundleId,
      );
      if (!bundle) {
        throw new MemberSignalMemoryProjectionError("candidate_not_found");
      }
      if (
        (bundle.status !== ArtifactBundleStatus.CONFIRMED &&
          bundle.status !== ArtifactBundleStatus.CONSUMED) ||
        bundle.artifactReview?.status !== ArtifactReviewStatus.CONFIRMED ||
        !bundle.artifactReview.reviewedByUserId
      ) {
        throw new MemberSignalMemoryProjectionError("candidate_not_confirmed");
      }
      const artifactReviewId = bundle.artifactReview.id;
      const reviewedByUserId = bundle.artifactReview.reviewedByUserId;

      // Corrupt/tampered rows must never reach memory projection.
      const artifact = parseCandidateArtifact(bundle.artifactsJson);
      // A correction may have landed after review confirmed this
      // candidate — re-check at projection time too, same as review/
      // promote already do.
      await assertCandidateSignalNotSuperseded(
        tx,
        workspaceId,
        artifact.signalReceiptRef,
      );

      const gatewaySessionRef =
        await resolveMemberGatewaySessionRefForProjection(
          tx,
          workspaceId,
          artifact.signalReceiptRef,
        );

      const artifactsJsonHash =
        computeMemberWorkSignalCandidateContentHash(artifact);
      const candidateKey = memberSignalMemoryCandidateKey({
        workspaceId,
        artifactBundleId: bundle.id,
        artifactsJsonHash,
      });

      const summary = artifact.projectedSummary.slice(0, 4_000);
      // Owner 裁定记录 #3: taint travels WITH the source into the memory
      // layer and is never stripped by verification — taint/
      // evaluationUseProhibited/provenance all live in sourceStatus, not
      // just in the (still-referenced) source artifact.
      const sourceVerification = jsonStringify({
        artifactReviewId,
        reviewedByUserId,
        reviewStatus: ArtifactReviewStatus.CONFIRMED,
      });
      const sourceStatus = jsonStringify({
        artifactStatus: bundle.status,
        candidateStatus: "pending_verification",
        officialMemoryPromotionAllowed: false,
        taint: artifact.taint,
        evaluationUseProhibited: artifact.evaluationUseProhibited,
        provenance: {
          memberRef: artifact.memberRef,
          deviceRegistrationRef: artifact.deviceRegistrationRef,
          clientId: artifact.clientId,
          policyRef: artifact.policyRef,
          policyVersion: artifact.policyVersion,
          signalReceiptRef: artifact.signalReceiptRef,
          gatewaySessionRef,
        },
      });
      const evidenceRefs = jsonStringify(artifact.relatedEvidenceRefs);

      const existing = await findExistingProjection(tx, {
        workspaceId,
        candidateKey,
        artifactBundleId: bundle.id,
        memberGatewaySessionRef: gatewaySessionRef,
        summary,
        sourceVerification,
        sourceStatus,
        evidenceRefs,
      });
      if (existing) {
        const receipt = buildProjectionReceipt({
          receiptId: `receipt:${candidateKey}`,
          workspaceRef: workspaceId,
          sourceArtifactBundleId: bundle.id,
          sourceArtifactReviewId: artifactReviewId,
          memberGatewaySessionRef: gatewaySessionRef,
          memoryCandidateId: existing.id,
          memoryCandidateKey: candidateKey,
          candidateStatus: "pending_verification",
          memoryPromotionCreated: false,
          canonicalMemoryWritten: false,
          projectedAt: existing.createdAt.toISOString(),
        });
        return { receipt, reused: true as const };
      }

      // The only write in this file that creates a MemoryCandidate row.
      // runtimeSessionId is deliberately ABSENT (left null by omission,
      // not explicitly set) — memberGatewaySessionRef is this row's sole
      // anchor, satisfying the schema's exactly-one-anchor CHECK
      // (MemoryCandidate_anchor_check, added in the M2d T1 migration).
      let memoryCandidate;
      try {
        memoryCandidate = await tx.memoryCandidate.create({
          data: {
            workspaceId,
            memberGatewaySessionRef: gatewaySessionRef,
            artifactBundleId: bundle.id,
            candidateKey,
            summary,
            sourceVerification,
            sourceStatus,
            status: RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
            evidenceRefs,
          },
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw new MemberSignalMemoryProjectionClaimLostError();
        }
        throw error;
      }

      const receipt = buildProjectionReceipt({
        receiptId: `receipt:${candidateKey}`,
        workspaceRef: workspaceId,
        sourceArtifactBundleId: bundle.id,
        sourceArtifactReviewId: artifactReviewId,
        memberGatewaySessionRef: gatewaySessionRef,
        memoryCandidateId: memoryCandidate.id,
        memoryCandidateKey: candidateKey,
        candidateStatus: "pending_verification",
        memoryPromotionCreated: false,
        canonicalMemoryWritten: false,
        projectedAt: memoryCandidate.createdAt.toISOString(),
      });

      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: actorUserId,
          actor: actorName,
          actorType: ActorType.USER,
          actionType: PROJECTED_AUDIT_ACTION,
          targetType: "MemoryCandidate",
          targetId: memoryCandidate.id,
          summary:
            "A confirmed member signal candidate was projected to a session-anchored pending memory candidate.",
          // No candidate body text (summary/detail) duplicated into the
          // audit payload — only refs and the two frozen falses. The
          // candidate content itself stays referenced by id, matching
          // this module's "de-linked" projection discipline.
          payload: jsonStringify({
            sourceArtifactBundleId: bundle.id,
            sourceArtifactReviewId: artifactReviewId,
            memoryCandidateKey: candidateKey,
            memberGatewaySessionRef: gatewaySessionRef,
            memoryPromotionCreated: false,
            canonicalMemoryWritten: false,
          }),
          traceId: trace?.traceId,
          requestId: trace?.requestId,
          parentEventId: trace?.parentEventId ?? undefined,
        },
      });

      return { receipt, reused: false as const };
    }, TRANSACTION_OPTIONS);

  try {
    return await runWithWriteConflictRetry(projectOnce, WRITE_RETRY_OPTIONS);
  } catch (error) {
    if (!(error instanceof MemberSignalMemoryProjectionClaimLostError)) {
      throw error;
    }
    // P2002 re-check (layer 3 of idempotency): a concurrent call won the
    // race to create the row first. Re-running projectOnce() takes the
    // "existing found" branch this time (layer 1), which itself re-
    // verifies the audit row (layer 2) and field equality before
    // returning reused:true — or throws memory_candidate_conflict on any
    // drift, exactly as a first-attempt existence hit would.
    try {
      return await projectOnce();
    } catch (retryError) {
      if (retryError instanceof MemberSignalMemoryProjectionClaimLostError) {
        throw new MemberSignalMemoryProjectionError(
          "memory_candidate_conflict",
        );
      }
      throw retryError;
    }
  }
}
