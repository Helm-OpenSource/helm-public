import { z } from "zod";

import {
  governedCandidateBoundaryDecisionSchema,
} from "@/lib/llm/governed-runtime-contracts";
import {
  judgementProposalBundleSchema,
  multiPassRoleOutputSchema,
  publicSafeRedactionStatusSchema,
} from "@/lib/llm/intelligence-contracts-v3";

export const GOVERNED_CANDIDATE_ARTIFACT_SCHEMA_VERSION =
  "helm.governed-judgement-artifact/v1" as const;
export const GOVERNED_CANDIDATE_ARTIFACT_TYPE =
  "governed_judgement_candidate.json" as const;
export const GOVERNED_CANDIDATE_REVIEW_POSTURE =
  "governed_intelligence_candidate_review_required" as const;
export const GOVERNED_CANDIDATE_ACTION_KIND =
  "governed_intelligence_create_task" as const;

const safeRefSchema = z.string().trim().min(1).max(512);
const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const persistedRoleOutputSchema = multiPassRoleOutputSchema
  .extend({ notes: z.tuple([]) })
  .strict();

export const governedJudgementArtifactSchema = z
  .object({
    schemaVersion: z.literal(GOVERNED_CANDIDATE_ARTIFACT_SCHEMA_VERSION),
    candidateId: safeRefSchema,
    sourceCandidateRef: safeRefSchema,
    sourceCandidateContentHash: sha256Schema,
    proposal: judgementProposalBundleSchema,
    roleOutputs: z.array(persistedRoleOutputSchema).min(1).max(3),
    boundaryDecision: governedCandidateBoundaryDecisionSchema,
    trajectoryReceiptRef: safeRefSchema,
    requiredHumanReview: z.literal(true),
    promotionAllowed: z.literal(false),
    externalEffectAllowed: z.literal(false),
    contentHash: sha256Schema,
  })
  .strict();
export type GovernedJudgementArtifact = z.infer<
  typeof governedJudgementArtifactSchema
>;

export const governedCandidateSourceProvenanceSchema = z
  .object({
    sourceCandidateRef: safeRefSchema,
    sourceCandidateContentHash: sha256Schema,
    sourceBundleRef: safeRefSchema,
    sourceBuildReceiptRef: safeRefSchema,
    trajectoryReceiptRef: safeRefSchema,
    candidateContentHash: sha256Schema,
    redactionStatus: publicSafeRedactionStatusSchema,
  })
  .strict();

export const governedCandidateOpenQuestionsSchema = z
  .object({
    missingEvidence: judgementProposalBundleSchema.shape.missingEvidence,
    counterEvidenceNeeded:
      judgementProposalBundleSchema.shape.counterEvidenceNeeded,
  })
  .strict();

export const governedCandidateActionMetadataSchema = z
  .object({
    kind: z.literal(GOVERNED_CANDIDATE_ACTION_KIND),
    version: z.literal(1),
    sourceArtifactBundleId: safeRefSchema,
    sourceArtifactReviewId: safeRefSchema,
    candidateId: safeRefSchema,
    candidateContentHash: sha256Schema,
    sourceCandidateRef: safeRefSchema,
    evidenceRefCount: z.number().int().nonnegative().max(100),
    evidenceRefsHash: sha256Schema,
    boundary: z.literal("human_promoted_review_first"),
    externalEffectAllowed: z.literal(false),
  })
  .strict();
export type GovernedCandidateActionMetadata = z.infer<
  typeof governedCandidateActionMetadataSchema
>;
