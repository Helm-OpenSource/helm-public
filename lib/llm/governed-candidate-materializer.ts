import { createHash } from "node:crypto";
import {
  ActorType,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
} from "@prisma/client";

import { getCurrentAuditTraceContext } from "@/lib/audit/trace-context";
import { db } from "@/lib/db";
import { serializeCandidateCanonicalJson } from "@/lib/llm/candidate-canonical-json";
import {
  capabilityGrantSchema,
  evaluateCapabilityGrant,
  governedJudgementCandidateSchema,
  type GovernedJudgementCandidate,
} from "@/lib/llm/governed-runtime-contracts";
import { detectPIIInOutput } from "@/lib/llm/output-pii-scrubber";
import { jsonStringify } from "@/lib/utils";

export const GOVERNED_CANDIDATE_MATERIALIZER_PRINCIPAL =
  "runtime:governed-candidate-materializer";
export const GOVERNED_CANDIDATE_MATERIALIZE_CAPABILITY =
  "materialize_governed_candidate_draft";
const ARTIFACT_TYPE = "governed_judgement_candidate.json";
const REVIEW_POSTURE = "governed_intelligence_candidate_review_required";
const AUDIT_ACTION = "GOVERNED_INTELLIGENCE_CANDIDATE_MATERIALIZED";
const UNSAFE_PERSISTED_TEXT_PATTERN =
  /\bhttps?:\/\/|\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/|\b(?:password|secret|token|api[_-]?key|credential)\s*[:=]/i;

export class GovernedCandidateMaterializationDeniedError extends Error {
  constructor(reason: string) {
    super(`governed_candidate_materialization_denied:${reason}`);
    this.name = "GovernedCandidateMaterializationDeniedError";
  }
}

export class GovernedCandidateMaterializationConflictError extends GovernedCandidateMaterializationDeniedError {
  constructor() {
    super("existing_candidate_conflict");
    this.name = "GovernedCandidateMaterializationConflictError";
  }
}

type CandidatePersistenceProjection = Readonly<{
  artifactsJson: string;
  evidenceRefs: string;
  sourceProvenance: string;
  openQuestions: string;
}>;

function buildPersistenceProjection(
  candidate: GovernedJudgementCandidate,
): CandidatePersistenceProjection {
  return {
    artifactsJson: jsonStringify({
      schemaVersion: "helm.governed-judgement-artifact/v1",
      candidateId: candidate.candidateId,
      sourceCandidateRef: candidate.sourceCandidateRef,
      sourceCandidateContentHash: candidate.sourceCandidateContentHash,
      proposal: candidate.proposal,
      roleOutputs: candidate.roleOutputs.map((output) => ({
        ...output,
        notes: [],
      })),
      boundaryDecision: candidate.boundaryDecision,
      trajectoryReceiptRef: candidate.trajectoryReceipt.receiptId,
      requiredHumanReview: true,
      promotionAllowed: false,
      externalEffectAllowed: false,
      contentHash: candidate.contentHash,
    }),
    evidenceRefs: jsonStringify(candidate.verifiedEvidenceRefs),
    sourceProvenance: jsonStringify({
      sourceCandidateRef: candidate.sourceCandidateRef,
      sourceCandidateContentHash: candidate.sourceCandidateContentHash,
      sourceBundleRef: candidate.sourceBundleRef,
      sourceBuildReceiptRef: candidate.sourceBuildReceiptRef,
      trajectoryReceiptRef: candidate.trajectoryReceipt.receiptId,
      candidateContentHash: candidate.contentHash,
      redactionStatus: candidate.trajectoryReceipt.redactionStatus,
    }),
    openQuestions: jsonStringify({
      missingEvidence: candidate.proposal.missingEvidence,
      counterEvidenceNeeded: candidate.proposal.counterEvidenceNeeded,
    }),
  };
}

function assertPersistableText(candidate: GovernedJudgementCandidate): void {
  const source = jsonStringify(candidate);
  if (
    detectPIIInOutput(source).detected ||
    UNSAFE_PERSISTED_TEXT_PATTERN.test(source)
  ) {
    throw new GovernedCandidateMaterializationDeniedError(
      "unsafe_candidate_text",
    );
  }
}

export function deriveGovernedCandidateArtifactBundleId(
  workspaceId: string,
  candidateId: string,
): string {
  const digest = createHash("sha256")
    .update(
      serializeCandidateCanonicalJson({ workspaceId, candidateId }),
      "utf8",
    )
    .digest("hex");
  return `governed-artifact:${digest.slice(0, 32)}`;
}

function isUniqueConflict(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function resolveExistingMaterialization(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  input: {
    workspaceId: string;
    artifactBundleId: string;
    candidate: GovernedJudgementCandidate;
    projection: CandidatePersistenceProjection;
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
      actionType: AUDIT_ACTION,
      targetType: "ArtifactBundle",
      targetId: input.artifactBundleId,
    },
    select: { id: true },
  });
  if (
    existing.workspaceId !== input.workspaceId ||
    existing.artifactType !== ARTIFACT_TYPE ||
    existing.status !== ArtifactBundleStatus.DRAFT ||
    existing.systemOfRecordWrite !== false ||
    existing.reviewPosture !== REVIEW_POSTURE ||
    existing.artifactsJson !== input.projection.artifactsJson ||
    existing.evidenceRefs !== input.projection.evidenceRefs ||
    existing.sourceProvenance !== input.projection.sourceProvenance ||
    existing.openQuestions !== input.projection.openQuestions ||
    existing.confidence !== input.candidate.proposal.confidence ||
    existing.artifactReview?.status !== ArtifactReviewStatus.PENDING ||
    !audit
  ) {
    throw new GovernedCandidateMaterializationConflictError();
  }
  return {
    artifactBundleId: existing.id,
    artifactReviewId: existing.artifactReview.id,
    reused: true as const,
  };
}

async function materializeOnce(input: {
  workspaceId: string;
  artifactBundleId: string;
  candidate: GovernedJudgementCandidate;
  projection: CandidatePersistenceProjection;
}) {
  return db.$transaction(async (tx) => {
    const existing = await resolveExistingMaterialization(tx, input);
    if (existing) return existing;

    const bundle = await tx.artifactBundle.create({
      data: {
        id: input.artifactBundleId,
        workspaceId: input.workspaceId,
        artifactType: ARTIFACT_TYPE,
        title: "Governed judgement candidate",
        status: ArtifactBundleStatus.DRAFT,
        systemOfRecordWrite: false,
        summary:
          "A governed judgement candidate is awaiting explicit human review.",
        artifactsJson: input.projection.artifactsJson,
        evidenceRefs: input.projection.evidenceRefs,
        sourceProvenance: input.projection.sourceProvenance,
        confidence: input.candidate.proposal.confidence,
        openQuestions: input.projection.openQuestions,
        reviewPosture: REVIEW_POSTURE,
      },
    });
    const review = await tx.artifactReview.create({
      data: {
        workspaceId: input.workspaceId,
        artifactBundleId: bundle.id,
        status: ArtifactReviewStatus.PENDING,
      },
    });
    const trace = getCurrentAuditTraceContext();
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actor: GOVERNED_CANDIDATE_MATERIALIZER_PRINCIPAL,
        actorType: ActorType.SYSTEM,
        actionType: AUDIT_ACTION,
        targetType: "ArtifactBundle",
        targetId: bundle.id,
        summary:
          "A review-first governed judgement candidate was materialized as a draft.",
        payload: jsonStringify({
          candidateId: input.candidate.candidateId,
          candidateContentHash: input.candidate.contentHash,
          sourceCandidateRef: input.candidate.sourceCandidateRef,
          sourceCandidateContentHash:
            input.candidate.sourceCandidateContentHash,
          sourceBundleRef: input.candidate.sourceBundleRef,
          sourceBuildReceiptRef: input.candidate.sourceBuildReceiptRef,
          trajectoryReceiptRef: input.candidate.trajectoryReceipt.receiptId,
          artifactReviewId: review.id,
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
  });
}

export async function materializeGovernedJudgementCandidate(input: {
  workspaceId: string;
  candidate: unknown;
  capabilityGrant: unknown;
}) {
  if (
    typeof input.workspaceId !== "string" ||
    input.workspaceId.trim().length === 0 ||
    input.workspaceId.length > 191
  ) {
    throw new GovernedCandidateMaterializationDeniedError("invalid_workspace");
  }
  const parsedCandidate = governedJudgementCandidateSchema.safeParse(
    input.candidate,
  );
  const parsedGrant = capabilityGrantSchema.safeParse(input.capabilityGrant);
  if (!parsedCandidate.success || !parsedGrant.success) {
    throw new GovernedCandidateMaterializationDeniedError("invalid_contract");
  }
  const candidate = parsedCandidate.data;
  const scopeRef = `workspace:${input.workspaceId}`;
  const grantDecision = evaluateCapabilityGrant({
    grant: parsedGrant.data,
    principalRef: GOVERNED_CANDIDATE_MATERIALIZER_PRINCIPAL,
    capabilityRef: GOVERNED_CANDIDATE_MATERIALIZE_CAPABILITY,
    scopeRef,
    at: new Date().toISOString(),
  });
  if (
    grantDecision.decision !== "allow_draft" ||
    !parsedGrant.data.killSwitchRef
  ) {
    throw new GovernedCandidateMaterializationDeniedError(
      `capability_${grantDecision.reason}`,
    );
  }
  assertPersistableText(candidate);
  const projection = buildPersistenceProjection(candidate);
  const artifactBundleId = deriveGovernedCandidateArtifactBundleId(
    input.workspaceId,
    candidate.candidateId,
  );
  try {
    return await materializeOnce({
      workspaceId: input.workspaceId,
      artifactBundleId,
      candidate,
      projection,
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    return db.$transaction(async (tx) => {
      const existing = await resolveExistingMaterialization(tx, {
        workspaceId: input.workspaceId,
        artifactBundleId,
        candidate,
        projection,
      });
      if (!existing) throw new GovernedCandidateMaterializationConflictError();
      return existing;
    });
  }
}
