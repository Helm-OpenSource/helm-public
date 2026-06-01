import type {
  TenantResourceEffectMode,
  TenantResourceReadiness,
  TenantResourceReadinessSummary,
  TenantResourceSourceKind,
} from "@/lib/tenant-resources/readiness";

export type TenantResourcePolicyReadAccess = "available" | "unavailable";
export type TenantResourcePolicyDraftGeneration = "allowed" | "not_allowed";
export type TenantResourcePolicyManualReview = "not_required" | "recommended" | "required";
export type TenantResourcePolicyExternalWriteBack =
  | "never_allowed"
  | "separate_guarded_evaluation_required";

export type TenantResourcePolicyReadoutItem = {
  resourceKey: string;
  resourceName: string;
  provider: string;
  sourceKind: TenantResourceSourceKind;
  allowedEffectModes: TenantResourceEffectMode[];
  readAccess: TenantResourcePolicyReadAccess;
  draftGeneration: TenantResourcePolicyDraftGeneration;
  manualReview: TenantResourcePolicyManualReview;
  externalWriteBack: TenantResourcePolicyExternalWriteBack;
  reasonCodes: string[];
  ownerVisibleSummary: string;
};

export type TenantResourcePolicyReadout = {
  generatedAt: string;
  totalResources: number;
  readOnlyResourceKeys: string[];
  draftCapableResourceKeys: string[];
  manualReviewResourceKeys: string[];
  neverExternalWriteResourceKeys: string[];
  items: TenantResourcePolicyReadoutItem[];
  boundaryNotes: string[];
};

export function buildTenantResourcePolicyReadout(input: {
  readiness: TenantResourceReadinessSummary;
}): TenantResourcePolicyReadout {
  const items = input.readiness.resources.map(toPolicyReadoutItem);

  return {
    generatedAt: input.readiness.generatedAt,
    totalResources: input.readiness.totalResources,
    readOnlyResourceKeys: items
      .filter((item) => item.readAccess === "available")
      .map((item) => item.resourceKey),
    draftCapableResourceKeys: items
      .filter((item) => item.draftGeneration === "allowed")
      .map((item) => item.resourceKey),
    manualReviewResourceKeys: items
      .filter((item) => item.manualReview !== "not_required")
      .map((item) => item.resourceKey),
    neverExternalWriteResourceKeys: items
      .filter((item) => item.externalWriteBack === "never_allowed")
      .map((item) => item.resourceKey),
    items,
    boundaryNotes: [
      "tenant policy readout is read-only and does not enforce policy by itself",
      "draft generation, manual review and external write posture are derived from existing resource governance fields",
      "never external writeback means this slice exposes no guarded write path or external mutation authority",
    ],
  };
}

function toPolicyReadoutItem(resource: TenantResourceReadiness): TenantResourcePolicyReadoutItem {
  const readAccess = resource.connection.readCapability ? "available" : "unavailable";
  const draftGeneration =
    readAccess === "available" &&
    resource.governance.allowedEffectModes.includes("draft_only") &&
    !["error", "paused", "revoked"].includes(resource.status)
      ? "allowed"
      : "not_allowed";
  const manualReview = resolveManualReview(resource);
  const externalWriteBack = resolveExternalWriteBack(resource);

  return {
    resourceKey: resource.resourceKey,
    resourceName: resource.resourceName,
    provider: resource.provider,
    sourceKind: resource.source.sourceKind,
    allowedEffectModes: resource.governance.allowedEffectModes,
    readAccess,
    draftGeneration,
    manualReview,
    externalWriteBack,
    reasonCodes: [
      `trust:${resource.governance.trustLevel}`,
      `review:${resource.governance.reviewRequirement}`,
      `fallback:${resource.governance.fallbackMode}`,
      `primary_gap:${resource.readiness.primaryGap ?? "none"}`,
      `write_back:${resource.governance.writeBackAllowed ? "allowed" : "blocked"}`,
    ],
    ownerVisibleSummary: buildOwnerVisibleSummary({
      readAccess,
      draftGeneration,
      manualReview,
      externalWriteBack,
    }),
  };
}

function resolveManualReview(resource: TenantResourceReadiness): TenantResourcePolicyManualReview {
  if (resource.governance.reviewRequirement === "required") return "required";
  if (
    resource.governance.reviewRequirement === "recommended" ||
    resource.readiness.primaryGap ||
    resource.mapping.conflictCount > 0 ||
    resource.governance.fallbackMode === "review_queue"
  ) {
    return "recommended";
  }

  return "not_required";
}

function resolveExternalWriteBack(
  resource: TenantResourceReadiness,
): TenantResourcePolicyExternalWriteBack {
  if (
    resource.governance.writeBackAllowed ||
    resource.governance.allowedEffectModes.includes("guarded_write_intent")
  ) {
    return "separate_guarded_evaluation_required";
  }

  return "never_allowed";
}

function buildOwnerVisibleSummary(input: {
  readAccess: TenantResourcePolicyReadAccess;
  draftGeneration: TenantResourcePolicyDraftGeneration;
  manualReview: TenantResourcePolicyManualReview;
  externalWriteBack: TenantResourcePolicyExternalWriteBack;
}) {
  return [
    `read:${input.readAccess}`,
    `draft:${input.draftGeneration}`,
    `review:${input.manualReview}`,
    `external_write:${input.externalWriteBack}`,
  ].join(" · ");
}
