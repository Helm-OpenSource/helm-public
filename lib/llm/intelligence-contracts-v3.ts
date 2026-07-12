/**
 * LLM Intelligence v3 — public-safe contracts.
 *
 * v3 releases stronger model intelligence inside typed harness boundaries. The
 * contracts here are pure zod/type helpers: no provider calls, no persistence,
 * no connector activation, and no execution authority.
 */

import { z } from "zod";

import {
  privacyClassSchema,
  selectedContextStubSchema,
  type SelectedContextStub,
} from "@/lib/llm/intelligence-contracts-v2";

export const MODEL_CONTEXT_MODES = [
  "disabled_deterministic",
  "remote_projected_review_required",
  "local_rich_private",
] as const;
export const modelContextModeSchema = z.enum(MODEL_CONTEXT_MODES);
export type ModelContextMode = z.infer<typeof modelContextModeSchema>;

export const MODEL_PROVIDER_MODES = ["disabled", "local", "remote"] as const;
export const modelProviderModeSchema = z.enum(MODEL_PROVIDER_MODES);
export type ModelProviderMode = z.infer<typeof modelProviderModeSchema>;

export const REASONING_DEPTHS = ["deterministic", "economy", "standard", "deep"] as const;
export const reasoningDepthSchema = z.enum(REASONING_DEPTHS);
export type ReasoningDepth = z.infer<typeof reasoningDepthSchema>;

export const TOOL_COORDINATION_MODES = ["none", "direct", "programmatic", "multi_agent"] as const;
export const toolCoordinationModeSchema = z.enum(TOOL_COORDINATION_MODES);
export type ToolCoordinationMode = z.infer<typeof toolCoordinationModeSchema>;

export const REMOTE_EGRESS_POLICIES = [
  "blocked",
  "public_safe_only",
  "projection_requires_consent",
] as const;
export const remoteEgressPolicySchema = z.enum(REMOTE_EGRESS_POLICIES);
export type RemoteEgressPolicy = z.infer<typeof remoteEgressPolicySchema>;

export const REASONING_BUDGET_CLASSES = ["blocked", "economy", "standard", "premium"] as const;
export const reasoningBudgetClassSchema = z.enum(REASONING_BUDGET_CLASSES);
export type ReasoningBudgetClass = z.infer<typeof reasoningBudgetClassSchema>;

export const LLM_WORKFLOW_CLASSES = [
  "boundary_review",
  "counterfactual_review",
  "judgement_proposal",
  "source_to_signal_proposal",
  "trajectory_review",
  "multi_pass_review",
] as const;
export const llmWorkflowClassSchema = z.enum(LLM_WORKFLOW_CLASSES);
export type LLMWorkflowClass = z.infer<typeof llmWorkflowClassSchema>;

export const modelCapabilityProfileSchema = z
  .object({
    profileKey: z.string().min(1),
    contextMode: modelContextModeSchema,
    providerMode: modelProviderModeSchema,
    reasoningDepth: reasoningDepthSchema,
    toolCoordination: toolCoordinationModeSchema,
    multiPassAllowed: z.boolean(),
    remoteEgressPolicy: remoteEgressPolicySchema,
    budgetClass: reasoningBudgetClassSchema,
    allowedWorkflowClasses: z.array(llmWorkflowClassSchema).default([]),
  })
  .strict();
export type ModelCapabilityProfile = z.infer<typeof modelCapabilityProfileSchema>;

export const DEFAULT_SAFE_MODEL_CAPABILITY_PROFILE: ModelCapabilityProfile = {
  profileKey: "unknown",
  contextMode: "disabled_deterministic",
  providerMode: "disabled",
  reasoningDepth: "deterministic",
  toolCoordination: "none",
  multiPassAllowed: false,
  remoteEgressPolicy: "blocked",
  budgetClass: "blocked",
  allowedWorkflowClasses: [],
};

export type ModelCapabilityProfileRegistry = Readonly<Record<string, unknown>>;

export function resolveModelCapabilityProfile(
  profileKey: string,
  registry: ModelCapabilityProfileRegistry,
): ModelCapabilityProfile {
  const key = profileKey.trim();
  if (!key) {
    return { ...DEFAULT_SAFE_MODEL_CAPABILITY_PROFILE, profileKey: "unknown:empty" };
  }

  const candidate = registry[key];
  const parsed = modelCapabilityProfileSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ...DEFAULT_SAFE_MODEL_CAPABILITY_PROFILE, profileKey: `unknown:${key}` };
  }

  return parsed.data;
}

const objectRefSchema = z
  .object({
    objectType: z.string().min(1),
    objectId: z.string().min(1),
    label: z.string().min(1).optional(),
  })
  .strict();

const tokenBudgetSchema = z
  .object({
    maxInputTokens: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive().optional(),
  })
  .strict();

export const V3_REVIEW_STATES = ["candidate", "needs_review", "rejected_by_guard"] as const;
export const v3ReviewStateSchema = z.enum(V3_REVIEW_STATES);
export type V3ReviewState = z.infer<typeof v3ReviewStateSchema>;

export const PUBLIC_SAFE_REDACTION_STATUSES = ["synthetic", "redacted", "alias_only"] as const;
export const publicSafeRedactionStatusSchema = z.enum(PUBLIC_SAFE_REDACTION_STATUSES);
export type PublicSafeRedactionStatus = z.infer<typeof publicSafeRedactionStatusSchema>;

const missingEvidenceNoteSchema = z
  .object({
    gapId: z.string().min(1),
    missingSignalNote: z.string().min(1),
  })
  .strict();

export const richLocalContextRefSchema = z
  .object({
    refId: z.string().min(1),
    kind: z.enum([
      "timeline",
      "source_summary",
      "schema_summary",
      "api_summary",
      "file_summary",
      "tool_receipt",
    ]),
    sourceHash: z.string().min(1),
    derivedSummary: z.string().min(1),
    privacyClass: privacyClassSchema,
  })
  .strict();
export type RichLocalContextRef = z.infer<typeof richLocalContextRefSchema>;

export const richLocalContextBundleSchema = z
  .object({
    bundleId: z.string().min(1),
    createdAt: z.string().datetime(),
    origin: z.enum(["public_safe_synthetic", "local_private"]),
    policySnapshotHash: z.string().min(1),
    objectRef: objectRefSchema,
    localContextRefs: z.array(richLocalContextRefSchema).default([]),
    missingEvidence: z.array(missingEvidenceNoteSchema).default([]),
    redactionStatus: publicSafeRedactionStatusSchema,
    rawContentIncluded: z.literal(false),
  })
  .strict();
export type RichLocalContextBundle = z.infer<typeof richLocalContextBundleSchema>;

export const contextProjectionReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    sourceBundleId: z.string().min(1),
    selectedContextStub: selectedContextStubSchema,
    projectedEvidenceRefs: z.array(z.string().min(1)).default([]),
    droppedEvidenceRefs: z.array(z.string().min(1)).default([]),
    remoteSafe: z.boolean(),
    redactionStatus: publicSafeRedactionStatusSchema,
    rawContentIncluded: z.literal(false),
  })
  .strict();
export type ContextProjectionReceipt = z.infer<typeof contextProjectionReceiptSchema>;

export function projectRichLocalContextBundle(input: {
  bundle: RichLocalContextBundle;
  selectedEvidenceRefs: string[];
  tokenBudget: z.infer<typeof tokenBudgetSchema>;
  receiptId: string;
}): ContextProjectionReceipt {
  const bundle = richLocalContextBundleSchema.parse(input.bundle);
  const selected = new Set(input.selectedEvidenceRefs);
  const knownRefs = new Set(bundle.localContextRefs.map((ref) => ref.refId));
  const projectedEvidenceRefs = input.selectedEvidenceRefs.filter((ref) => knownRefs.has(ref));
  const droppedEvidenceRefs = input.selectedEvidenceRefs.filter((ref) => !knownRefs.has(ref));
  const selectedRefs = bundle.localContextRefs.filter((ref) => selected.has(ref.refId));
  const remoteSafe =
    bundle.rawContentIncluded === false &&
    droppedEvidenceRefs.length === 0 &&
    selectedRefs.every((ref) => ref.privacyClass !== "private_runtime");

  const selectedContextStub: SelectedContextStub = selectedContextStubSchema.parse({
    objectRef: bundle.objectRef,
    selectedEvidenceRefs: remoteSafe ? projectedEvidenceRefs : [],
    missingEvidence: bundle.missingEvidence,
    policySnapshotHash: bundle.policySnapshotHash,
    privacyClass:
      bundle.origin === "public_safe_synthetic" && bundle.redactionStatus === "synthetic"
        ? "public_safe_synthetic"
        : remoteSafe
          ? "redacted_review"
          : "blocked",
    tokenBudget: tokenBudgetSchema.parse(input.tokenBudget),
  });

  return contextProjectionReceiptSchema.parse({
    receiptId: input.receiptId,
    sourceBundleId: bundle.bundleId,
    selectedContextStub,
    projectedEvidenceRefs,
    droppedEvidenceRefs,
    remoteSafe,
    redactionStatus: bundle.redactionStatus,
    rawContentIncluded: false,
  });
}

const confidenceSchema = z.number().int().min(0).max(100);

export const judgementProposalBundleSchema = z
  .object({
    proposalId: z.string().min(1),
    objectRef: objectRefSchema,
    reviewState: v3ReviewStateSchema,
    confidence: confidenceSchema,
    evidenceRefs: z.array(z.string().min(1)).default([]),
    missingEvidence: z.array(missingEvidenceNoteSchema).default([]),
    counterEvidenceNeeded: z.array(z.string().min(1)).default([]),
    nextSafeActions: z.array(z.string().min(1)).default([]),
    forbiddenCapabilityRefs: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type JudgementProposalBundle = z.infer<typeof judgementProposalBundleSchema>;

export function parseJudgementProposalBundle(input: unknown): JudgementProposalBundle {
  return judgementProposalBundleSchema.parse(input);
}

export const sourceToSignalProposalBundleSchema = z
  .object({
    proposalId: z.string().min(1),
    sourceSummaryRefs: z.array(z.string().min(1)).min(1),
    targetSignalFamily: z.string().min(1),
    targetEntity: z.string().min(1),
    reviewState: v3ReviewStateSchema,
    confidence: confidenceSchema,
    evidenceRefs: z.array(z.string().min(1)).default([]),
    mappingRationale: z.array(z.string().min(1)).default([]),
    missingEvidence: z.array(missingEvidenceNoteSchema).default([]),
    forbiddenCapabilityRefs: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type SourceToSignalProposalBundle = z.infer<typeof sourceToSignalProposalBundleSchema>;

export function parseSourceToSignalProposalBundle(input: unknown): SourceToSignalProposalBundle {
  return sourceToSignalProposalBundleSchema.parse(input);
}

export const LLM_TASK_TRAJECTORY_STEP_TYPES = [
  "plan",
  "context_selection",
  "tool_call",
  "model_call",
  "file_change_summary",
  "validation_receipt",
  "blocked_action",
  "boundary_decision",
  "final_claim",
] as const;
export const llmTaskTrajectoryStepTypeSchema = z.enum(LLM_TASK_TRAJECTORY_STEP_TYPES);
export type LLMTaskTrajectoryStepType = z.infer<typeof llmTaskTrajectoryStepTypeSchema>;

export const LLM_TRAJECTORY_RISK_CLASSES = [
  "read",
  "local_draft",
  "repo_write",
  "external_write",
  "activation",
  "commitment",
] as const;
export const llmTrajectoryRiskClassSchema = z.enum(LLM_TRAJECTORY_RISK_CLASSES);
export type LLMTrajectoryRiskClass = z.infer<typeof llmTrajectoryRiskClassSchema>;

export const llmTaskTrajectoryStepSchema = z
  .object({
    stepId: z.string().min(1),
    stepType: llmTaskTrajectoryStepTypeSchema,
    summary: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)).default([]),
    riskClass: llmTrajectoryRiskClassSchema,
    blocked: z.boolean().default(false),
  })
  .strict();
export type LLMTaskTrajectoryStep = z.infer<typeof llmTaskTrajectoryStepSchema>;

export const llmTaskFinalClaimSchema = z
  .object({
    claimedDone: z.boolean(),
    claimedReleaseReady: z.boolean(),
    claimedApprovalGranted: z.boolean(),
    promotedCandidate: z.boolean(),
    intentMatched: z.boolean(),
    selfCertified: z.boolean(),
    claimedSourceTruthWithoutEvidence: z.boolean(),
  })
  .strict();
export type LLMTaskFinalClaim = z.infer<typeof llmTaskFinalClaimSchema>;

export const llmTaskTrajectoryReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    taskId: z.string().min(1),
    createdAt: z.string().datetime(),
    modelProfileKey: z.string().min(1),
    redactionStatus: publicSafeRedactionStatusSchema,
    rawPromptIncluded: z.literal(false),
    rawCustomerDataIncluded: z.literal(false),
    tenantUrlIncluded: z.literal(false),
    productionReceiptIncluded: z.literal(false),
    boundaryDecisions: z
      .array(z.enum(["allow_candidate", "review_required", "reject", "quarantine"]))
      .default([]),
    steps: z.array(llmTaskTrajectoryStepSchema).default([]),
    finalClaim: llmTaskFinalClaimSchema,
  })
  .strict();
export type LLMTaskTrajectoryReceipt = z.infer<typeof llmTaskTrajectoryReceiptSchema>;

export function parseLLMTaskTrajectoryReceipt(input: unknown): LLMTaskTrajectoryReceipt {
  return llmTaskTrajectoryReceiptSchema.parse(input);
}
