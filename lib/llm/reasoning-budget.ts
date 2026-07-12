import type {
  LLMTrajectoryRiskClass,
  ModelCapabilityProfile,
  ReasoningBudgetClass,
  ReasoningDepth,
} from "@/lib/llm/intelligence-contracts-v3";

export type ReasoningBudgetFactor = "low" | "medium" | "high";
export type EvidenceCompleteness = "complete" | "partial" | "missing";

export type ReasoningBudgetBoundaryDecision = "allow_candidate" | "review_required";

export type ReasoningBudgetDecision = {
  readonly reasoningDepth: ReasoningDepth;
  readonly budgetClass: ReasoningBudgetClass;
  readonly multiPassRecommended: boolean;
  readonly boundaryDecision: ReasoningBudgetBoundaryDecision;
  readonly reason:
    | "profile_disabled"
    | "low_value_low_uncertainty"
    | "high_value_uncertain"
    | "side_effect_review_required"
    | "standard_review";
};

export type ReasoningBudgetInput = {
  readonly profile: ModelCapabilityProfile;
  readonly businessValue: ReasoningBudgetFactor;
  readonly uncertainty: ReasoningBudgetFactor;
  readonly riskClass: LLMTrajectoryRiskClass;
  readonly evidenceCompleteness: EvidenceCompleteness;
};

const DEPTH_RANK: Readonly<Record<ReasoningDepth, number>> = {
  deterministic: 0,
  economy: 1,
  standard: 2,
  deep: 3,
};

const BUDGET_RANK: Readonly<Record<ReasoningBudgetClass, number>> = {
  blocked: 0,
  economy: 1,
  standard: 2,
  premium: 3,
};

const SIDE_EFFECT_RISKS = new Set<LLMTrajectoryRiskClass>([
  "repo_write",
  "external_write",
  "activation",
  "commitment",
]);

function capDepth(desired: ReasoningDepth, profile: ModelCapabilityProfile): ReasoningDepth {
  return DEPTH_RANK[desired] <= DEPTH_RANK[profile.reasoningDepth]
    ? desired
    : profile.reasoningDepth;
}

function capBudget(
  desired: ReasoningBudgetClass,
  profile: ModelCapabilityProfile,
): ReasoningBudgetClass {
  return BUDGET_RANK[desired] <= BUDGET_RANK[profile.budgetClass]
    ? desired
    : profile.budgetClass;
}

function isProfileDisabled(profile: ModelCapabilityProfile): boolean {
  return (
    profile.providerMode === "disabled" ||
    profile.contextMode === "disabled_deterministic" ||
    profile.budgetClass === "blocked"
  );
}

export function resolveReasoningBudgetDecision(
  input: ReasoningBudgetInput,
): ReasoningBudgetDecision {
  if (isProfileDisabled(input.profile)) {
    return {
      reasoningDepth: "deterministic",
      budgetClass: "blocked",
      multiPassRecommended: false,
      boundaryDecision: "review_required",
      reason: "profile_disabled",
    };
  }

  const sideEffectRisk = SIDE_EFFECT_RISKS.has(input.riskClass);
  const highValueUncertain =
    input.businessValue === "high" &&
    (input.uncertainty === "high" || input.evidenceCompleteness !== "complete");
  const lowValueLowUncertainty =
    input.businessValue === "low" &&
    input.uncertainty === "low" &&
    input.evidenceCompleteness === "complete";

  if (highValueUncertain) {
    return {
      reasoningDepth: capDepth("deep", input.profile),
      budgetClass: capBudget("premium", input.profile),
      multiPassRecommended: input.profile.multiPassAllowed,
      boundaryDecision: sideEffectRisk ? "review_required" : "allow_candidate",
      reason: sideEffectRisk ? "side_effect_review_required" : "high_value_uncertain",
    };
  }

  if (lowValueLowUncertainty) {
    return {
      reasoningDepth: capDepth("economy", input.profile),
      budgetClass: capBudget("economy", input.profile),
      multiPassRecommended: false,
      boundaryDecision: sideEffectRisk ? "review_required" : "allow_candidate",
      reason: sideEffectRisk ? "side_effect_review_required" : "low_value_low_uncertainty",
    };
  }

  return {
    reasoningDepth: capDepth("standard", input.profile),
    budgetClass: capBudget("standard", input.profile),
    multiPassRecommended: input.profile.multiPassAllowed && input.uncertainty === "high",
    boundaryDecision: sideEffectRisk ? "review_required" : "allow_candidate",
    reason: sideEffectRisk ? "side_effect_review_required" : "standard_review",
  };
}
