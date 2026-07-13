import { createHash } from "node:crypto";
import {
  ActorType,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
} from "@prisma/client";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import { db } from "@/lib/db";
import {
  governedConnectorScopeCandidateSchema,
  governedExternalSendDraftCandidateSchema,
  type GovernedConnectorScopeCandidate,
  type GovernedExternalSendDraftCandidate,
} from "@/lib/governed-intelligence/capability-closeout-contracts";
import { GOVERNED_CANDIDATE_ARTIFACT_TYPE } from "@/lib/governed-intelligence/governed-candidate-artifact";
import { serializeCandidateCanonicalJson } from "@/lib/llm/candidate-canonical-json";
import {
  evaluateCapabilityGrant,
  type CapabilityGrant,
} from "@/lib/llm/governed-runtime-contracts";
import { detectPIIInOutput } from "@/lib/llm/output-pii-scrubber";
import { jsonStringify } from "@/lib/utils";

export const GOVERNED_CLOSEOUT_CANDIDATE_MATERIALIZER_PRINCIPAL =
  "runtime:governed-closeout-candidate-materializer" as const;
export const GOVERNED_EXTERNAL_SEND_MATERIALIZE_CAPABILITY =
  "materialize_governed_external_send_draft" as const;
export const GOVERNED_CONNECTOR_SCOPE_MATERIALIZE_CAPABILITY =
  "materialize_governed_connector_scope_candidate" as const;
export const GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE =
  "governed_external_send_draft.json" as const;
export const GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE =
  "governed_connector_scope_candidate.json" as const;

export const GOVERNED_EXTERNAL_SEND_REVIEW_POSTURE =
  "governed_external_send_draft_review_required" as const;
export const GOVERNED_CONNECTOR_SCOPE_REVIEW_POSTURE =
  "governed_connector_scope_review_required" as const;
const UNSAFE_PERSISTED_TEXT_PATTERN =
  /\bhttps?:\/\/|\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/|\b(?:password|secret|token|api[_-]?key|credential)\s*[:=]/i;

export type GovernedCapabilityCloseoutMaterializationErrorCode =
  | "invalid_candidate"
  | "capability_denied"
  | "source_not_confirmed"
  | "unsafe_candidate_text"
  | "existing_candidate_conflict";

export class GovernedCapabilityCloseoutMaterializationError extends Error {
  readonly code: GovernedCapabilityCloseoutMaterializationErrorCode;

  constructor(code: GovernedCapabilityCloseoutMaterializationErrorCode) {
    super(`governed_capability_closeout_materialization:${code}`);
    this.name = "GovernedCapabilityCloseoutMaterializationError";
    this.code = code;
  }
}

type CloseoutCandidate =
  | GovernedExternalSendDraftCandidate
  | GovernedConnectorScopeCandidate;

type CloseoutMaterializationConfig = Readonly<{
  artifactType:
    | typeof GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE
    | typeof GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE;
  reviewPosture:
    | typeof GOVERNED_EXTERNAL_SEND_REVIEW_POSTURE
    | typeof GOVERNED_CONNECTOR_SCOPE_REVIEW_POSTURE;
  capabilityRef:
    | typeof GOVERNED_EXTERNAL_SEND_MATERIALIZE_CAPABILITY
    | typeof GOVERNED_CONNECTOR_SCOPE_MATERIALIZE_CAPABILITY;
  title: string;
  summary: string;
  auditAction: string;
}>;

type MaterializationProjection = Readonly<{
  artifactsJson: string;
  evidenceRefs: string;
  sourceProvenance: string;
  openQuestions: string;
}>;

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

function artifactBundleId(input: {
  workspaceId: string;
  artifactType: string;
  candidateId: string;
}) {
  const digest = createHash("sha256")
    .update(serializeCandidateCanonicalJson(input), "utf8")
    .digest("hex");
  return `governed-closeout-artifact:${digest.slice(0, 32)}`;
}

function assertCandidateTextIsSafe(candidate: CloseoutCandidate) {
  const serialized = jsonStringify(candidate);
  if (
    detectPIIInOutput(serialized).detected ||
    UNSAFE_PERSISTED_TEXT_PATTERN.test(serialized)
  ) {
    throw new GovernedCapabilityCloseoutMaterializationError(
      "unsafe_candidate_text",
    );
  }
}

function buildProjection(candidate: CloseoutCandidate): MaterializationProjection {
  const isConnector = "requestedScopes" in candidate;
  return {
    artifactsJson: jsonStringify(candidate),
    evidenceRefs: jsonStringify(
      isConnector
        ? candidate.evidenceRefs
        : [
            candidate.dlpReceipt.receiptRef,
            candidate.rateLimitReceipt.receiptRef,
            candidate.dedupeReceipt.receiptRef,
          ],
    ),
    sourceProvenance: jsonStringify({
      sourceArtifactBundleId: candidate.sourceArtifactBundleId,
      sourceArtifactReviewId: candidate.sourceArtifactReviewId,
      candidateId: candidate.candidateId,
      contractHash: candidate.contractHash,
    }),
    openQuestions: jsonStringify(
      isConnector ? candidate.missingEvidence : [],
    ),
  };
}

async function assertConfirmedSource(
  tx: TransactionClient,
  workspaceId: string,
  candidate: CloseoutCandidate,
) {
  const source = await tx.artifactBundle.findFirst({
    where: {
      id: candidate.sourceArtifactBundleId,
      workspaceId,
      artifactType: GOVERNED_CANDIDATE_ARTIFACT_TYPE,
      systemOfRecordWrite: false,
    },
    include: { artifactReview: true },
  });
  if (
    !source ||
    (source.status !== ArtifactBundleStatus.CONFIRMED &&
      source.status !== ArtifactBundleStatus.CONSUMED) ||
    source.artifactReview?.id !== candidate.sourceArtifactReviewId ||
    source.artifactReview.workspaceId !== workspaceId ||
    source.artifactReview.status !== ArtifactReviewStatus.CONFIRMED ||
    !source.artifactReview.reviewedByUserId
  ) {
    throw new GovernedCapabilityCloseoutMaterializationError(
      "source_not_confirmed",
    );
  }
}

async function findExistingMaterialization(
  tx: TransactionClient | typeof db,
  input: {
    workspaceId: string;
    artifactBundleId: string;
    config: CloseoutMaterializationConfig;
    candidate: CloseoutCandidate;
    projection: MaterializationProjection;
  },
) {
  const existing = await tx.artifactBundle.findUnique({
    where: { id: input.artifactBundleId },
    include: { artifactReview: true },
  });
  if (!existing) return null;
  const audit = await tx.auditLog.findFirst({
    where: {
      workspaceId: input.workspaceId,
      actionType: input.config.auditAction,
      targetType: "ArtifactBundle",
      targetId: input.artifactBundleId,
    },
    select: { id: true },
  });
  if (
    existing.workspaceId !== input.workspaceId ||
    existing.artifactType !== input.config.artifactType ||
    existing.status !== ArtifactBundleStatus.DRAFT ||
    existing.systemOfRecordWrite !== false ||
    existing.reviewPosture !== input.config.reviewPosture ||
    existing.artifactsJson !== input.projection.artifactsJson ||
    existing.evidenceRefs !== input.projection.evidenceRefs ||
    existing.sourceProvenance !== input.projection.sourceProvenance ||
    existing.openQuestions !== input.projection.openQuestions ||
    existing.artifactReview?.status !== ArtifactReviewStatus.PENDING ||
    !audit
  ) {
    throw new GovernedCapabilityCloseoutMaterializationError(
      "existing_candidate_conflict",
    );
  }
  return {
    artifactBundleId: existing.id,
    artifactReviewId: existing.artifactReview.id,
    reused: true as const,
  };
}

function isUniqueConflict(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function materializeCloseoutCandidate(input: {
  workspaceId: string;
  candidate: CloseoutCandidate;
  capabilityGrant: CapabilityGrant;
  config: CloseoutMaterializationConfig;
}) {
  if (input.candidate.reviewState === "rejected_by_guard") {
    throw new GovernedCapabilityCloseoutMaterializationError(
      "invalid_candidate",
    );
  }
  assertCandidateTextIsSafe(input.candidate);
  const decision = evaluateCapabilityGrant({
    grant: input.capabilityGrant,
    principalRef: GOVERNED_CLOSEOUT_CANDIDATE_MATERIALIZER_PRINCIPAL,
    capabilityRef: input.config.capabilityRef,
    scopeRef: `workspace:${input.workspaceId}`,
    at: new Date().toISOString(),
  });
  if (decision.decision !== "allow_draft") {
    throw new GovernedCapabilityCloseoutMaterializationError(
      "capability_denied",
    );
  }

  const projection = buildProjection(input.candidate);
  const id = artifactBundleId({
    workspaceId: input.workspaceId,
    artifactType: input.config.artifactType,
    candidateId: input.candidate.candidateId,
  });
  const materializeOnce = () =>
    db.$transaction(async (tx) => {
      await assertConfirmedSource(tx, input.workspaceId, input.candidate);
      const existing = await findExistingMaterialization(tx, {
        workspaceId: input.workspaceId,
        artifactBundleId: id,
        config: input.config,
        candidate: input.candidate,
        projection,
      });
      if (existing) return existing;

      const artifact = await tx.artifactBundle.create({
        data: {
          id,
          workspaceId: input.workspaceId,
          artifactType: input.config.artifactType,
          title: input.config.title,
          status: ArtifactBundleStatus.DRAFT,
          systemOfRecordWrite: false,
          summary: input.config.summary,
          artifactsJson: projection.artifactsJson,
          evidenceRefs: projection.evidenceRefs,
          sourceProvenance: projection.sourceProvenance,
          openQuestions: projection.openQuestions,
          reviewPosture: input.config.reviewPosture,
        },
      });
      const review = await tx.artifactReview.create({
        data: {
          workspaceId: input.workspaceId,
          artifactBundleId: artifact.id,
          status: ArtifactReviewStatus.PENDING,
        },
      });
      const trace = getCurrentAuditTraceContext();
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actor: GOVERNED_CLOSEOUT_CANDIDATE_MATERIALIZER_PRINCIPAL,
          actorType: ActorType.SYSTEM,
          actionType: input.config.auditAction,
          targetType: "ArtifactBundle",
          targetId: artifact.id,
          summary: input.config.summary,
          payload: jsonStringify({
            candidateId: input.candidate.candidateId,
            contractHash: input.candidate.contractHash,
            sourceArtifactBundleId: input.candidate.sourceArtifactBundleId,
            sourceArtifactReviewId: input.candidate.sourceArtifactReviewId,
            artifactReviewId: review.id,
          }),
          traceId: trace?.traceId,
          requestId: trace?.requestId,
          parentEventId: trace?.parentEventId ?? undefined,
        },
      });
      return {
        artifactBundleId: artifact.id,
        artifactReviewId: review.id,
        reused: false as const,
      };
    });

  try {
    return await materializeOnce();
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await findExistingMaterialization(db, {
      workspaceId: input.workspaceId,
      artifactBundleId: id,
      config: input.config,
      candidate: input.candidate,
      projection,
    });
    if (!existing) throw error;
    return existing;
  }
}

export async function materializeGovernedExternalSendDraftCandidate(input: {
  workspaceId: string;
  candidate: unknown;
  capabilityGrant: CapabilityGrant;
}) {
  const parsed = governedExternalSendDraftCandidateSchema.safeParse(
    input.candidate,
  );
  if (!parsed.success) {
    throw new GovernedCapabilityCloseoutMaterializationError(
      "invalid_candidate",
    );
  }
  return materializeCloseoutCandidate({
    ...input,
    candidate: parsed.data,
    config: {
      artifactType: GOVERNED_EXTERNAL_SEND_ARTIFACT_TYPE,
      reviewPosture: GOVERNED_EXTERNAL_SEND_REVIEW_POSTURE,
      capabilityRef: GOVERNED_EXTERNAL_SEND_MATERIALIZE_CAPABILITY,
      title: "Governed external-send draft candidate",
      summary:
        "A fixed-recipient, fixed-content draft is awaiting human review; no send has occurred.",
      auditAction: "GOVERNED_EXTERNAL_SEND_DRAFT_MATERIALIZED",
    },
  });
}

export async function materializeGovernedConnectorScopeCandidate(input: {
  workspaceId: string;
  candidate: unknown;
  capabilityGrant: CapabilityGrant;
}) {
  const parsed = governedConnectorScopeCandidateSchema.safeParse(
    input.candidate,
  );
  if (!parsed.success) {
    throw new GovernedCapabilityCloseoutMaterializationError(
      "invalid_candidate",
    );
  }
  return materializeCloseoutCandidate({
    ...input,
    candidate: parsed.data,
    config: {
      artifactType: GOVERNED_CONNECTOR_SCOPE_ARTIFACT_TYPE,
      reviewPosture: GOVERNED_CONNECTOR_SCOPE_REVIEW_POSTURE,
      capabilityRef: GOVERNED_CONNECTOR_SCOPE_MATERIALIZE_CAPABILITY,
      title: "Governed connector scope candidate",
      summary:
        "A read-only connector scope and risk candidate is awaiting human review; no connector state changed.",
      auditAction: "GOVERNED_CONNECTOR_SCOPE_CANDIDATE_MATERIALIZED",
    },
  });
}
