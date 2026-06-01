import type { TenantResourceEvidenceDetail } from "@/lib/tenant-resources/evidence-detail";
import type { TenantExtensionResourceAdoptionReadout } from "@/lib/tenant-resources/extension-adoption";
import type {
  TenantResourcePolicyReadout,
  TenantResourcePolicyReadoutItem,
} from "@/lib/tenant-resources/policy-readout";
import type {
  TenantResourceReadiness,
  TenantResourceReadinessSummary,
} from "@/lib/tenant-resources/readiness";

export type TenantResourceGuardedWriteEvaluationStatus =
  | "eligible_for_design_review"
  | "requires_review"
  | "blocked";

export type TenantResourceGuardedWriteEvaluationBlocker =
  | "policy_external_write_never_allowed"
  | "policy_readout_missing"
  | "evidence_detail_missing"
  | "evidence_detail_blocked"
  | "evidence_detail_needs_review"
  | "extension_adoption_missing"
  | "extension_adoption_incomplete"
  | "extension_adoption_blocked"
  | "field_mapping_gap_blocks_write_evaluation"
  | "manual_proof_not_ready"
  | "write_intent_not_declared";

export type TenantResourceGuardedWriteEvaluationItem = {
  resourceKey: string;
  resourceName: string;
  provider: string;
  status: TenantResourceGuardedWriteEvaluationStatus;
  canProceedToDesignReview: boolean;
  evidenceStatus: TenantResourceEvidenceDetail["status"] | "missing";
  manualProofStatus: TenantResourceEvidenceDetail["manualProof"]["lifecycle"]["status"] | "missing";
  fieldGapSummaryStatus:
    | TenantResourceEvidenceDetail["mapping"]["fieldGaps"]["summaryStatus"]
    | "missing";
  extensionAdoptionStatus:
    | TenantExtensionResourceAdoptionReadout["overallStatus"]
    | "missing"
    | "not_applicable";
  extensionDependencyCount: number;
  policyExternalWriteBack:
    | TenantResourcePolicyReadoutItem["externalWriteBack"]
    | "missing";
  blockers: TenantResourceGuardedWriteEvaluationBlocker[];
  nextReviewStep: string;
};

export type TenantResourceGuardedWriteEvaluation = {
  generatedAt: string;
  totalResources: number;
  eligibleForDesignReviewResourceKeys: string[];
  requiresReviewResourceKeys: string[];
  blockedResourceKeys: string[];
  items: TenantResourceGuardedWriteEvaluationItem[];
  boundaryNotes: string[];
};

export function buildTenantResourceGuardedWriteEvaluation(input: {
  readiness: TenantResourceReadinessSummary;
  evidenceDetails: TenantResourceEvidenceDetail[];
  policyReadout: TenantResourcePolicyReadout;
}): TenantResourceGuardedWriteEvaluation {
  const evidenceByResourceKey = new Map(
    input.evidenceDetails.map((detail) => [detail.resource.resourceKey, detail]),
  );
  const policyByResourceKey = new Map(
    input.policyReadout.items.map((item) => [item.resourceKey, item]),
  );
  const items = input.readiness.resources.map((resource) =>
    buildEvaluationItem({
      resource,
      evidenceDetail: evidenceByResourceKey.get(resource.resourceKey) ?? null,
      policyItem: policyByResourceKey.get(resource.resourceKey) ?? null,
    }),
  );

  return {
    generatedAt: input.readiness.generatedAt,
    totalResources: input.readiness.totalResources,
    eligibleForDesignReviewResourceKeys: items
      .filter((item) => item.status === "eligible_for_design_review")
      .map((item) => item.resourceKey),
    requiresReviewResourceKeys: items
      .filter((item) => item.status === "requires_review")
      .map((item) => item.resourceKey),
    blockedResourceKeys: items
      .filter((item) => item.status === "blocked")
      .map((item) => item.resourceKey),
    items,
    boundaryNotes: [
      "guarded official write evaluation is read-only and does not create a write route",
      "eligible for design review is not permission to external-write or send",
      "all official writes still require a later explicit guarded-write implementation, proof persistence, review action and audit trail",
    ],
  };
}

function buildEvaluationItem(input: {
  resource: TenantResourceReadiness;
  evidenceDetail: TenantResourceEvidenceDetail | null;
  policyItem: TenantResourcePolicyReadoutItem | null;
}): TenantResourceGuardedWriteEvaluationItem {
  const blockers = resolveBlockers(input);
  const status = resolveStatus(blockers);

  return {
    resourceKey: input.resource.resourceKey,
    resourceName: input.resource.resourceName,
    provider: input.resource.provider,
    status,
    canProceedToDesignReview: status === "eligible_for_design_review",
    evidenceStatus: input.evidenceDetail?.status ?? "missing",
    manualProofStatus: input.evidenceDetail?.manualProof.lifecycle.status ?? "missing",
    fieldGapSummaryStatus: input.evidenceDetail?.mapping.fieldGaps.summaryStatus ?? "missing",
    extensionAdoptionStatus: resolveExtensionAdoptionStatus(
      input.resource,
      input.evidenceDetail,
    ),
    extensionDependencyCount: input.evidenceDetail?.extensionAdoption?.dependencyCount ?? 0,
    policyExternalWriteBack: input.policyItem?.externalWriteBack ?? "missing",
    blockers,
    nextReviewStep: buildNextReviewStep(status, blockers),
  };
}

function resolveBlockers(input: {
  resource: TenantResourceReadiness;
  evidenceDetail: TenantResourceEvidenceDetail | null;
  policyItem: TenantResourcePolicyReadoutItem | null;
}) {
  const blockers: TenantResourceGuardedWriteEvaluationBlocker[] = [];

  if (!input.policyItem) {
    blockers.push("policy_readout_missing");
  } else if (input.policyItem.externalWriteBack === "never_allowed") {
    blockers.push("policy_external_write_never_allowed");
  }

  if (!input.evidenceDetail) {
    blockers.push("evidence_detail_missing");
  } else {
    if (input.evidenceDetail.status === "blocked") {
      blockers.push("evidence_detail_blocked");
    }
    if (input.evidenceDetail.status === "needs_review") {
      blockers.push("evidence_detail_needs_review");
    }
    if (
      input.evidenceDetail.mapping.fieldGaps.guardedWriteEvaluationBlocked ||
      input.evidenceDetail.mapping.fieldGaps.judgementDowngrade
    ) {
      blockers.push("field_mapping_gap_blocks_write_evaluation");
    }
    if (
      input.evidenceDetail.manualProof.required &&
      !input.evidenceDetail.manualProof.lifecycle.followThrough.canEnterLearn
    ) {
      blockers.push("manual_proof_not_ready");
    }
    if (input.resource.source.sourceKind === "workspace_solution_extension") {
      const extensionAdoption = input.evidenceDetail.extensionAdoption;
      if (!extensionAdoption) {
        blockers.push("extension_adoption_missing");
      } else if (
        extensionAdoption.overallStatus === "blocked" ||
        extensionAdoption.overallStatus === "superseded"
      ) {
        blockers.push("extension_adoption_blocked");
      } else if (
        extensionAdoption.overallStatus !== "adopted_for_governed_loop"
      ) {
        blockers.push("extension_adoption_incomplete");
      }
    }
  }

  if (
    !input.resource.governance.writeBackAllowed &&
    !input.resource.governance.allowedEffectModes.includes("guarded_write_intent")
  ) {
    blockers.push("write_intent_not_declared");
  }

  return Array.from(new Set(blockers));
}

function resolveStatus(
  blockers: TenantResourceGuardedWriteEvaluationBlocker[],
): TenantResourceGuardedWriteEvaluationStatus {
  if (blockers.length === 0) return "eligible_for_design_review";

  const reviewOnlyBlockers: TenantResourceGuardedWriteEvaluationBlocker[] = [
    "evidence_detail_needs_review",
    "extension_adoption_incomplete",
    "manual_proof_not_ready",
  ];
  if (blockers.every((blocker) => reviewOnlyBlockers.includes(blocker))) {
    return "requires_review";
  }

  return "blocked";
}

function buildNextReviewStep(
  status: TenantResourceGuardedWriteEvaluationStatus,
  blockers: TenantResourceGuardedWriteEvaluationBlocker[],
) {
  if (status === "eligible_for_design_review") {
    return "Proceed only to guarded-write design review; do not create a write route in this stage.";
  }
  if (blockers.includes("extension_adoption_missing")) {
    return "Project extension adoption evidence before any guarded-write design review can proceed.";
  }
  if (blockers.includes("extension_adoption_blocked")) {
    return "Keep guarded write blocked until extension dependency adoption is no longer blocked or superseded.";
  }
  if (blockers.includes("extension_adoption_incomplete")) {
    return "Complete extension adoption review and bind the dependency into the governed loop before any guarded-write design review.";
  }
  if (status === "requires_review") {
    return `Resolve review blockers before any guarded-write design review: ${blockers.join(", ")}.`;
  }
  return `Keep guarded write blocked: ${blockers.join(", ")}.`;
}

function resolveExtensionAdoptionStatus(
  resource: TenantResourceReadiness,
  evidenceDetail: TenantResourceEvidenceDetail | null,
): TenantResourceGuardedWriteEvaluationItem["extensionAdoptionStatus"] {
  if (resource.source.sourceKind !== "workspace_solution_extension") {
    return "not_applicable";
  }

  return evidenceDetail?.extensionAdoption?.overallStatus ?? "missing";
}
