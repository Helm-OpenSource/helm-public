import type {
  LLMWorkflowClass,
  ModelCapabilityProfile,
  V3ReviewState,
} from "@/lib/llm/intelligence-contracts-v3";

export type MultiPassRole = "generator" | "critic" | "adversary";

export type MultiPassRoleOutput = {
  readonly role: MultiPassRole;
  readonly reviewState: V3ReviewState;
  readonly evidenceRefs: readonly string[];
  readonly notes: readonly string[];
};

export type MultiPassFailureReason =
  | "provider_failure"
  | "parse_failure"
  | "schema_failure"
  | "egress_failure";

export type MultiPassBoundaryDecision =
  | "allow_candidate"
  | "review_required"
  | "reject"
  | "quarantine";

export type MultiPassReviewResult = {
  readonly boundaryDecision: MultiPassBoundaryDecision;
  readonly requiredHumanReview: boolean;
  readonly reason:
    | MultiPassFailureReason
    | "profile_mismatch"
    | "role_conflict"
    | "guard_rejected"
    | "candidate_consensus";
  readonly roleStates: Readonly<Record<MultiPassRole, V3ReviewState | "missing">>;
};

export type MultiPassReviewInput = {
  readonly profile: ModelCapabilityProfile;
  readonly roleOutputs: readonly MultiPassRoleOutput[];
  readonly failure?: {
    readonly reason: MultiPassFailureReason;
  };
};

const REQUIRED_WORKFLOW_CLASS: LLMWorkflowClass = "multi_pass_review";

function buildRoleStates(
  roleOutputs: readonly MultiPassRoleOutput[],
): Readonly<Record<MultiPassRole, V3ReviewState | "missing">> {
  return {
    generator: roleOutputs.find((output) => output.role === "generator")?.reviewState ?? "missing",
    critic: roleOutputs.find((output) => output.role === "critic")?.reviewState ?? "missing",
    adversary: roleOutputs.find((output) => output.role === "adversary")?.reviewState ?? "missing",
  };
}

function profileAllowsMultiPass(profile: ModelCapabilityProfile): boolean {
  return (
    profile.multiPassAllowed &&
    profile.allowedWorkflowClasses.includes(REQUIRED_WORKFLOW_CLASS) &&
    profile.providerMode !== "disabled" &&
    profile.contextMode !== "disabled_deterministic"
  );
}

export function arbitrateMultiPassReview(input: MultiPassReviewInput): MultiPassReviewResult {
  const roleStates = buildRoleStates(input.roleOutputs);

  if (input.failure) {
    return {
      boundaryDecision: input.failure.reason === "egress_failure" ? "quarantine" : "review_required",
      requiredHumanReview: true,
      reason: input.failure.reason,
      roleStates,
    };
  }

  if (!profileAllowsMultiPass(input.profile)) {
    return {
      boundaryDecision: "review_required",
      requiredHumanReview: true,
      reason: "profile_mismatch",
      roleStates,
    };
  }

  const states = Object.values(roleStates);
  if (states.includes("rejected_by_guard")) {
    return {
      boundaryDecision: "reject",
      requiredHumanReview: true,
      reason: "guard_rejected",
      roleStates,
    };
  }

  if (states.some((state) => state !== "candidate")) {
    return {
      boundaryDecision: "review_required",
      requiredHumanReview: true,
      reason: "role_conflict",
      roleStates,
    };
  }

  return {
    boundaryDecision: "allow_candidate",
    requiredHumanReview: false,
    reason: "candidate_consensus",
    roleStates,
  };
}
