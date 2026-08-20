import "server-only";

import { ActorType, ArtifactBundleStatus, ArtifactReviewStatus, Prisma } from "@prisma/client";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import { detectPIIInOutput } from "@/lib/llm/output-pii-scrubber";
import {
  MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
  MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
  projectSignalToCandidate,
  validateMemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import type { MemberSignalCandidateObjectAnchor } from "@/lib/member-gateway/signal-candidate";
import type { MemberWorkSignalCandidateArtifact } from "@/lib/member-gateway/signal-candidate";
import { MEMBER_SIGNAL_TAINT, hashMemberWorkSignalPayload } from "@/lib/member-gateway/signal";
import type { MemberWorkSignalKind, MemberWorkSignalPayload } from "@/lib/member-gateway/signal";
import { jsonStringify, safeParseJson } from "@/lib/utils";

// Materializes a MemberWorkSignalReceipt into a reviewable, review-required
// candidate artifact (spec §5.1, M2c Task 2, plan Architecture 8/9). The
// artifact type is a PARALLEL type reusing ArtifactBundle/ArtifactReview —
// no new table. This is the ONLY module that writes
// member_work_signal_candidate.json rows; review/promote (Task 3) only
// re-reads and CAS-transitions them.

type Tx = Prisma.TransactionClient;
type DbClient = Tx | typeof db;
type ReceiptRow = Prisma.MemberWorkSignalReceiptGetPayload<object>;

const MATERIALIZER_PRINCIPAL =
  "runtime:member-signal-candidate-materializer" as const;
const MATERIALIZED_AUDIT_ACTION =
  "MEMBER_WORK_SIGNAL_CANDIDATE_MATERIALIZED" as const;

// Architecture 8 (CAS compliance from line one): every transaction in this
// module is inline, Serializable, with lockWorkspace issued first on the
// tx client — matching lib/member-gateway/prompt-store.service.ts, not the
// baseline-grandfathered governed-intelligence precedent.
const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

export class MemberSignalCandidateError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "MemberSignalCandidateError";
    this.reasons = reasons;
  }
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MemberSignalCandidateError(reason);
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
    throw new MemberSignalCandidateError("workspace_not_found");
  }
}

// Deterministic PK (Architecture 9): one candidate per signal receipt.
// sha256() returns a "sha256:<hex>" string; slicing its first 32 chars
// keeps the id short while staying fully deterministic for this input
// space (workspaceId + the frozen artifact type + the receipt ref).
function memberSignalCandidateArtifactBundleId(input: {
  workspaceId: string;
  signalReceiptId: string;
}): string {
  const digest = sha256(
    canonicalJson({
      workspaceId: input.workspaceId,
      artifactType: MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
      signalReceiptRef: input.signalReceiptId,
    }),
  );
  return `member-signal-candidate:${digest.slice(0, 32)}`;
}

// Fourth deliberate copy of the persistable-text safety pattern. The first
// two are lib/llm/governed-candidate-materializer.ts and
// lib/governed-intelligence/capability-closeout-materializer.ts:40-41; the
// third is lib/member-gateway/signal-candidate.ts (which scans only the
// candidate BODY — summary/detail — as a contract-layer invariant). This
// copy scans the FULL serialized artifact (refs, anchor, provenance
// included) as a materializer-layer defense-in-depth check, a different
// text surface than the contract-layer scan, so it needs its own instance
// rather than a re-export.
const UNSAFE_PERSISTED_TEXT_PATTERN =
  /\bhttps?:\/\/|\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/|\b(?:password|secret|token|api[_-]?key|credential)\s*[:=]/i;

function assertCandidateArtifactTextIsSafe(serializedArtifact: string): void {
  if (
    UNSAFE_PERSISTED_TEXT_PATTERN.test(serializedArtifact) ||
    detectPIIInOutput(serializedArtifact).detected
  ) {
    throw new MemberSignalCandidateError("unsafe_candidate_text");
  }
}

async function loadSignalReceiptRow(
  client: DbClient,
  workspaceId: string,
  signalReceiptId: string,
): Promise<ReceiptRow> {
  const row = await client.memberWorkSignalReceipt.findUnique({
    where: { id_workspaceId: { id: signalReceiptId, workspaceId } },
  });
  if (!row) {
    throw new MemberSignalCandidateError("signal_receipt_not_found");
  }
  return row;
}

// Re-verifies the payloadJson/payloadHash binding and the candidate/taint
// literals on every materialization attempt — a receipt is never trusted
// on the strength of its columns alone (same discipline as
// signal-store.service.ts's contractReceiptFromRow).
function parseSignalReceiptPayload(row: ReceiptRow): MemberWorkSignalPayload {
  const payload = safeParseJson<MemberWorkSignalPayload | null>(
    row.payloadJson,
    null,
  );
  if (
    !payload ||
    row.candidate !== true ||
    row.taint !== MEMBER_SIGNAL_TAINT ||
    hashMemberWorkSignalPayload(payload) !== row.payloadHash
  ) {
    throw new MemberSignalCandidateError("signal_receipt_corrupt");
  }
  return payload;
}

// A signal receipt can be superseded at most once (schema unique on
// [workspaceId, supersedesReceiptRef]); only the correction-chain HEAD may
// become a candidate (Architecture 9).
async function assertSignalReceiptNotSuperseded(
  client: DbClient,
  workspaceId: string,
  signalReceiptId: string,
): Promise<void> {
  const supersededBy = await client.memberWorkSignalReceipt.findUnique({
    where: {
      workspaceId_supersedesReceiptRef: {
        workspaceId,
        supersedesReceiptRef: signalReceiptId,
      },
    },
    select: { id: true },
  });
  if (supersededBy) {
    throw new MemberSignalCandidateError("signal_receipt_superseded");
  }
}

type MaterializationProjection = Readonly<{
  artifactsJson: string;
  evidenceRefs: string;
  sourceProvenance: string;
}>;

function buildProjection(
  artifact: MemberWorkSignalCandidateArtifact,
): MaterializationProjection {
  return {
    artifactsJson: canonicalJson(artifact),
    evidenceRefs: JSON.stringify(artifact.relatedEvidenceRefs),
    sourceProvenance: JSON.stringify({
      taint: MEMBER_SIGNAL_TAINT,
      memberRef: artifact.memberRef,
      deviceRegistrationRef: artifact.deviceRegistrationRef,
      clientId: artifact.clientId,
      policyRef: artifact.policyRef,
      policyVersion: artifact.policyVersion,
      signalReceiptRef: artifact.signalReceiptRef,
    }),
  };
}

// Load -> judge -> project -> validate -> safety-scan, in the exact order
// Task 2 specifies. `client` is `Tx` inside the primary attempt and the
// ambient `db` when re-derived after a P2002 race — the receipt row is
// append-only/immutable once written, so recomputation off either client
// yields byte-identical output.
async function loadAndBuildCandidate(
  client: DbClient,
  workspaceId: string,
  signalReceiptId: string,
  objectAnchor: MemberSignalCandidateObjectAnchor,
): Promise<{
  artifact: MemberWorkSignalCandidateArtifact;
  projection: MaterializationProjection;
}> {
  const row = await loadSignalReceiptRow(client, workspaceId, signalReceiptId);
  const payload = parseSignalReceiptPayload(row);
  await assertSignalReceiptNotSuperseded(client, workspaceId, signalReceiptId);

  const artifact = projectSignalToCandidate({
    receipt: {
      signalReceiptRef: row.id,
      workspaceRef: row.workspaceId,
      memberRef: row.memberRef,
      deviceRegistrationRef: row.deviceRegistrationRef,
      clientId: row.clientId,
      policyRef: row.policyRef,
      policyVersion: row.policyVersion,
      kind: row.kind as MemberWorkSignalKind,
      submittedAt: row.submittedAt.toISOString(),
    },
    payload: {
      summary: payload.summary,
      detail: payload.detail,
      relatedEvidenceRefs: payload.relatedEvidenceRefs,
    },
    objectAnchor,
  });
  const validation = validateMemberWorkSignalCandidateArtifact(artifact);
  if (!validation.valid) {
    throw new MemberSignalCandidateError(
      "candidate_artifact_invalid",
      validation.errors,
    );
  }

  const projection = buildProjection(artifact);
  assertCandidateArtifactTextIsSafe(projection.artifactsJson);
  return { artifact, projection };
}

type ExistingMaterialization = Readonly<{
  artifactBundleId: string;
  artifactReviewId: string;
  reused: true;
}>;

// Three-layer idempotency (Architecture 9, closeout precedent): existence
// alone is not enough — the row must byte-match this projection AND carry
// a matching AuditLog row. A same-id row that drifts from either is a
// conflict, never silently reused.
async function findExistingCandidateMaterialization(
  client: DbClient,
  input: {
    workspaceId: string;
    artifactBundleId: string;
    projection: MaterializationProjection;
  },
): Promise<ExistingMaterialization | null> {
  const existing = await client.artifactBundle.findUnique({
    where: { id: input.artifactBundleId },
    include: { artifactReview: true },
  });
  if (!existing) return null;
  const audit = await client.auditLog.findFirst({
    where: {
      workspaceId: input.workspaceId,
      actionType: MATERIALIZED_AUDIT_ACTION,
      targetType: "ArtifactBundle",
      targetId: input.artifactBundleId,
    },
    select: { id: true },
  });
  if (
    existing.workspaceId !== input.workspaceId ||
    existing.artifactType !== MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE ||
    existing.status !== ArtifactBundleStatus.DRAFT ||
    existing.systemOfRecordWrite !== false ||
    existing.reviewPosture !== MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE ||
    existing.artifactsJson !== input.projection.artifactsJson ||
    existing.evidenceRefs !== input.projection.evidenceRefs ||
    existing.sourceProvenance !== input.projection.sourceProvenance ||
    existing.artifactReview?.status !== ArtifactReviewStatus.PENDING ||
    !audit
  ) {
    throw new MemberSignalCandidateError("existing_candidate_conflict");
  }
  return {
    artifactBundleId: existing.id,
    artifactReviewId: existing.artifactReview.id,
    reused: true,
  };
}

export type MaterializeMemberWorkSignalCandidateInput = {
  workspaceId: string;
  signalReceiptId: string;
  objectAnchor: MemberSignalCandidateObjectAnchor;
};

export type MaterializeMemberWorkSignalCandidateResult = {
  artifactBundleId: string;
  artifactReviewId: string;
  reused: boolean;
};

export async function materializeMemberWorkSignalCandidate(
  input: MaterializeMemberWorkSignalCandidateInput,
): Promise<MaterializeMemberWorkSignalCandidateResult> {
  const workspaceId = nonEmpty(input.workspaceId, "workspace_id_required");
  const signalReceiptId = nonEmpty(
    input.signalReceiptId,
    "signal_receipt_id_required",
  );
  const artifactBundleId = memberSignalCandidateArtifactBundleId({
    workspaceId,
    signalReceiptId,
  });

  const materializeOnce = () =>
    db.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);
      const { artifact, projection } = await loadAndBuildCandidate(
        tx,
        workspaceId,
        signalReceiptId,
        input.objectAnchor,
      );

      const existing = await findExistingCandidateMaterialization(tx, {
        workspaceId,
        artifactBundleId,
        projection,
      });
      if (existing) return existing;

      const bundle = await tx.artifactBundle.create({
        data: {
          id: artifactBundleId,
          workspaceId,
          artifactType: MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
          title: `成员信号候选:${artifact.kind}`,
          status: ArtifactBundleStatus.DRAFT,
          systemOfRecordWrite: false,
          summary: artifact.projectedSummary.slice(0, 200),
          artifactsJson: projection.artifactsJson,
          evidenceRefs: projection.evidenceRefs,
          sourceProvenance: projection.sourceProvenance,
          reviewPosture: MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
        },
      });
      const review = await tx.artifactReview.create({
        data: {
          workspaceId,
          artifactBundleId: bundle.id,
          status: ArtifactReviewStatus.PENDING,
        },
      });
      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId,
          actor: MATERIALIZER_PRINCIPAL,
          actorType: ActorType.SYSTEM,
          actionType: MATERIALIZED_AUDIT_ACTION,
          targetType: "ArtifactBundle",
          targetId: bundle.id,
          summary: `Materialized a member work-signal candidate (${artifact.kind}) for review; no fact or task has been created.`,
          payload: jsonStringify({
            signalReceiptRef: signalReceiptId,
            artifactReviewId: review.id,
            kind: artifact.kind,
            taint: artifact.taint,
          }),
          traceId: trace?.traceId,
          requestId: trace?.requestId,
          parentEventId: trace?.parentEventId ?? undefined,
        },
      });
      return {
        artifactBundleId: bundle.id,
        artifactReviewId: review.id,
        reused: false as const,
      };
    }, TRANSACTION_OPTIONS);

  try {
    return await runWithWriteConflictRetry(materializeOnce, WRITE_RETRY_OPTIONS);
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    const { projection } = await loadAndBuildCandidate(
      db,
      workspaceId,
      signalReceiptId,
      input.objectAnchor,
    );
    const existing = await findExistingCandidateMaterialization(db, {
      workspaceId,
      artifactBundleId,
      projection,
    });
    if (!existing) throw error;
    return existing;
  }
}
