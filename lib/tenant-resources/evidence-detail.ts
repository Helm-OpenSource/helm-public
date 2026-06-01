import type {
  CapabilityDecisionSourceStep,
  CapabilityDecisionTrace,
} from "@/lib/capability-decision-trace";
import type { TenantResourceGovernedLoop } from "@/lib/tenant-resources/governed-loop";
import {
  buildTenantResourceFieldMappingGap,
  type TenantResourceFieldMappingGapReadout,
} from "@/lib/tenant-resources/field-mapping-gap";
import {
  buildTenantResourceManualProofLifecycle,
  type TenantResourceManualProofLifecycle,
  type TenantResourceManualProofRecordInput,
} from "@/lib/tenant-resources/manual-proof-lifecycle";
import type { TenantExtensionResourceAdoptionReadout } from "@/lib/tenant-resources/extension-adoption";
import type {
  TenantResourceReadiness,
  TenantResourceSourceKind,
  TenantResourceTrustLevel,
} from "@/lib/tenant-resources/readiness";

export type TenantResourceEvidenceDetailStatus =
  | "usable_for_judgement"
  | "needs_review"
  | "blocked";

export type TenantResourceEvidenceFreshnessPosture =
  | "fresh"
  | "stale"
  | "session_scoped"
  | "manifest_declared"
  | "unknown";

export type TenantResourceEvidenceDecisionUse =
  | "supports_allow"
  | "requires_review"
  | "blocked"
  | "context_only";

export type TenantResourceEvidenceItem = {
  evidenceRef: string;
  sourceKind: string;
  sourceRef: string;
  sourceLabel: string;
  observedAt: string | null;
  freshnessPosture: TenantResourceEvidenceFreshnessPosture;
  trustLevel: TenantResourceTrustLevel;
  mappingCompleteness: number;
  conflictCount: number;
  decisionUse: TenantResourceEvidenceDecisionUse;
  notes: string[];
};

export type TenantResourceEvidenceDetail = {
  detailKey: string;
  generatedAt: string;
  status: TenantResourceEvidenceDetailStatus;
  resource: {
    resourceKey: string;
    resourceName: string;
    provider: string;
    resourceType: TenantResourceReadiness["resourceType"];
    readinessStatus: TenantResourceReadiness["status"];
  };
  sourceObject: {
    sourceKind: TenantResourceSourceKind;
    sourceRef: string;
    sourceObjectType: string;
    sourceObjectLabel: string;
  };
  timing: {
    observedAt: string | null;
    updatedAt: string | null;
    freshnessWindow: string;
    freshnessPosture: TenantResourceEvidenceFreshnessPosture;
  };
  trust: {
    trustLevel: TenantResourceTrustLevel;
    promotionEligibility: TenantResourceReadiness["governance"]["promotionEligibility"];
    reviewRequirement: TenantResourceReadiness["governance"]["reviewRequirement"];
    allowedEffectModes: TenantResourceReadiness["governance"]["allowedEffectModes"];
    customerFacingAllowed: boolean;
    writeBackAllowed: boolean;
  };
  mapping: {
    mappedObjectTypes: string[];
    mappingCompleteness: number;
    missingRequirements: string[];
    fieldGaps: TenantResourceFieldMappingGapReadout;
  };
  conflicts: {
    conflictCount: number;
    conflictPosture: "clear" | "review_required";
  };
  decision: {
    decision: TenantResourceGovernedLoop["capabilityReadout"]["decision"];
    primaryReasonCode: TenantResourceGovernedLoop["capabilityReadout"]["primaryReasonCode"];
    fallbackType: TenantResourceGovernedLoop["capabilityReadout"]["fallbackType"];
    fallbackRef: string | null;
    primarySourceStep: TenantResourceGovernedLoop["capabilityReadout"]["primarySourceStep"];
    why: string;
    sourceChain: CapabilityDecisionSourceStep[];
  };
  manualProof: {
    required: boolean;
    lifecycleState: "not_required" | "required" | "review_required" | "blocked";
    nextOwner: TenantResourceGovernedLoop["followThrough"]["nextOwner"];
    failureMode: string | null;
    lifecycle: TenantResourceManualProofLifecycle;
  };
  extensionAdoption: TenantExtensionResourceAdoptionReadout | null;
  governedLoop: {
    loopKey: string;
    followThroughStatus: TenantResourceGovernedLoop["followThrough"]["status"];
    nextActionMode: TenantResourceGovernedLoop["nextAction"]["mode"];
    nextActionTitle: string;
    steps: TenantResourceGovernedLoop["steps"];
  };
  evidenceItems: TenantResourceEvidenceItem[];
  boundaryNotes: string[];
  ui: {
    settingsHref: string;
    disclosureLabel: {
      zh: string;
      en: string;
    };
  };
};

export function buildTenantResourceEvidenceDetail(input: {
  resource: TenantResourceReadiness;
  loop: TenantResourceGovernedLoop;
  manualProofRecords?: TenantResourceManualProofRecordInput[];
  extensionAdoptionReadout?: TenantExtensionResourceAdoptionReadout | null;
}): TenantResourceEvidenceDetail {
  const trace = input.loop.capabilityTrace;
  const status = resolveEvidenceStatus(input.loop);
  const freshnessPosture = resolveFreshnessPosture(input.resource);
  const fieldGaps = buildTenantResourceFieldMappingGap({
    resource: input.resource,
    detailStatus: status,
  });
  const manualProofLifecycleState = resolveManualProofLifecycleState(input.loop);
  const manualProofLifecycle = buildTenantResourceManualProofLifecycle({
    resourceKey: input.resource.resourceKey,
    actionRef: input.loop.loopKey,
    generatedAt: input.loop.generatedAt,
    proofRequired: input.loop.followThrough.proofRequired,
    proofLifecycleState: manualProofLifecycleState,
    detailStatus: status,
    nextOwner: input.loop.followThrough.nextOwner,
    failureMode: input.loop.followThrough.failureMode,
    evidenceRefs: input.loop.nextAction.evidenceRefs,
    proofRecords: input.manualProofRecords,
  });

  return {
    detailKey: buildStableKey("tenant_resource_evidence", input.resource.resourceKey),
    generatedAt: input.loop.generatedAt,
    status,
    resource: {
      resourceKey: input.resource.resourceKey,
      resourceName: input.resource.resourceName,
      provider: input.resource.provider,
      resourceType: input.resource.resourceType,
      readinessStatus: input.resource.status,
    },
    sourceObject: {
      sourceKind: input.resource.source.sourceKind,
      sourceRef: input.resource.source.sourceRef,
      sourceObjectType: sourceObjectTypeForKind(input.resource.source.sourceKind),
      sourceObjectLabel: buildSourceObjectLabel(input.resource),
    },
    timing: {
      observedAt: input.resource.connection.lastSyncAt ?? input.resource.updatedAt,
      updatedAt: input.resource.updatedAt,
      freshnessWindow: input.resource.governance.freshnessWindow,
      freshnessPosture,
    },
    trust: {
      trustLevel: input.resource.governance.trustLevel,
      promotionEligibility: input.resource.governance.promotionEligibility,
      reviewRequirement: input.resource.governance.reviewRequirement,
      allowedEffectModes: input.resource.governance.allowedEffectModes,
      customerFacingAllowed: input.resource.governance.customerFacingAllowed,
      writeBackAllowed: input.resource.governance.writeBackAllowed,
    },
    mapping: {
      mappedObjectTypes: input.resource.mapping.mappedObjectTypes,
      mappingCompleteness: input.resource.mapping.mappingCompleteness,
      missingRequirements: input.resource.mapping.missingRequirements,
      fieldGaps,
    },
    conflicts: {
      conflictCount: input.resource.mapping.conflictCount,
      conflictPosture:
        input.resource.mapping.conflictCount > 0 ? "review_required" : "clear",
    },
    decision: {
      decision: input.loop.capabilityReadout.decision,
      primaryReasonCode: input.loop.capabilityReadout.primaryReasonCode,
      fallbackType: input.loop.capabilityReadout.fallbackType,
      fallbackRef: input.loop.capabilityReadout.fallbackRef,
      primarySourceStep: input.loop.capabilityReadout.primarySourceStep,
      why: buildDecisionWhy(input.loop.capabilityTrace, input.loop),
      sourceChain: trace.evaluation.sourceChain,
    },
    manualProof: {
      required: input.loop.followThrough.proofRequired,
      lifecycleState: manualProofLifecycleState,
      nextOwner: input.loop.followThrough.nextOwner,
      failureMode: input.loop.followThrough.failureMode,
      lifecycle: manualProofLifecycle,
    },
    extensionAdoption: input.extensionAdoptionReadout ?? null,
    governedLoop: {
      loopKey: input.loop.loopKey,
      followThroughStatus: input.loop.followThrough.status,
      nextActionMode: input.loop.nextAction.mode,
      nextActionTitle: input.loop.nextAction.title,
      steps: input.loop.steps,
    },
    evidenceItems: buildEvidenceItems({
      resource: input.resource,
      trace,
      loop: input.loop,
      freshnessPosture,
    }),
    boundaryNotes: uniqueStrings([
      "resource evidence detail is read-only and does not create connector, policy, or write authority",
      "manual proof remains a lifecycle requirement; this detail does not submit or approve proof",
      ...(input.extensionAdoptionReadout?.boundaryNotes ?? []),
      ...fieldGaps.boundaryNotes,
      ...input.resource.readiness.boundaryNotes,
      ...input.loop.nextAction.boundaryNotes,
      ...trace.result.boundaryNotes,
    ]),
    ui: {
      settingsHref: `/settings?tab=connectors#${buildTenantResourceEvidenceAnchorId(
        input.resource.resourceKey,
      )}`,
      disclosureLabel: {
        zh: "查看依据",
        en: "View evidence",
      },
    },
  };
}

export function buildTenantResourceEvidenceAnchorId(resourceKey: string) {
  return buildStableKey("tenant_resource_evidence", resourceKey);
}

function resolveEvidenceStatus(
  loop: TenantResourceGovernedLoop,
): TenantResourceEvidenceDetailStatus {
  if (loop.capabilityReadout.decision === "deny" || loop.followThrough.status === "blocked") {
    return "blocked";
  }
  if (
    loop.capabilityReadout.decision === "route_to_review" ||
    loop.capabilityReadout.decision === "ask_human" ||
    loop.followThrough.status === "route_to_review" ||
    loop.followThrough.status === "stale_or_failed"
  ) {
    return "needs_review";
  }

  return "usable_for_judgement";
}

function resolveFreshnessPosture(
  resource: TenantResourceReadiness,
): TenantResourceEvidenceFreshnessPosture {
  if (resource.readiness.primaryGap === "freshness_unknown") return "stale";
  if (resource.governance.freshnessWindow === "session_scoped") return "session_scoped";
  if (resource.governance.freshnessWindow === "manifest_declared") return "manifest_declared";
  if (!resource.connection.lastSyncAt && !resource.updatedAt) return "unknown";
  return "fresh";
}

function resolveManualProofLifecycleState(
  loop: TenantResourceGovernedLoop,
): TenantResourceEvidenceDetail["manualProof"]["lifecycleState"] {
  if (loop.followThrough.status === "blocked") return "blocked";
  if (loop.followThrough.proofRequired) return "required";
  if (
    loop.followThrough.status === "route_to_review" ||
    loop.followThrough.status === "stale_or_failed"
  ) {
    return "review_required";
  }
  return "not_required";
}

function buildEvidenceItems(input: {
  resource: TenantResourceReadiness;
  trace: CapabilityDecisionTrace;
  loop: TenantResourceGovernedLoop;
  freshnessPosture: TenantResourceEvidenceFreshnessPosture;
}): TenantResourceEvidenceItem[] {
  return uniqueStrings([
    input.resource.source.sourceRef
      ? `${input.resource.source.sourceKind}:${input.resource.source.sourceRef}`
      : "",
    ...input.resource.evidenceRefs,
    ...input.loop.judgement.evidenceRefs,
    ...input.loop.nextAction.evidenceRefs,
  ]).map((evidenceRef) => {
    const parsed = parseEvidenceRef(evidenceRef);
    return {
      evidenceRef,
      sourceKind: parsed.sourceKind,
      sourceRef: parsed.sourceRef,
      sourceLabel: sourceLabelForEvidenceRef(parsed.sourceKind, parsed.sourceRef),
      observedAt: input.resource.connection.lastSyncAt ?? input.resource.updatedAt,
      freshnessPosture: input.freshnessPosture,
      trustLevel: input.resource.governance.trustLevel,
      mappingCompleteness: input.resource.mapping.mappingCompleteness,
      conflictCount: input.resource.mapping.conflictCount,
      decisionUse: resolveDecisionUse(input.trace, input.loop),
      notes: buildEvidenceNotes(input.resource, input.loop),
    };
  });
}

function resolveDecisionUse(
  trace: CapabilityDecisionTrace,
  loop: TenantResourceGovernedLoop,
): TenantResourceEvidenceDecisionUse {
  if (trace.result.decision === "allow") return "supports_allow";
  if (trace.result.decision === "deny" || loop.followThrough.status === "blocked") {
    return "blocked";
  }
  if (trace.fallback.required) return "requires_review";
  return "context_only";
}

function buildEvidenceNotes(
  resource: TenantResourceReadiness,
  loop: TenantResourceGovernedLoop,
) {
  return uniqueStrings([
    resource.readiness.primaryGap ? `primary_gap:${resource.readiness.primaryGap}` : "primary_gap:none",
    `mapping:${resource.mapping.mappingCompleteness}`,
    `conflicts:${resource.mapping.conflictCount}`,
    `decision:${loop.capabilityReadout.decision}`,
    `fallback:${loop.capabilityReadout.fallbackType}`,
  ]);
}

function buildDecisionWhy(
  trace: CapabilityDecisionTrace,
  loop: TenantResourceGovernedLoop,
) {
  const primaryStep =
    trace.evaluation.sourceChain.find((step) => step.outcome !== "pass") ??
    trace.evaluation.sourceChain.at(-1);
  const stepNote = primaryStep?.note ?? "No blocking source step was found.";

  if (trace.result.decision === "allow") {
    return `Allowed because the resource posture and capability chain passed; ${stepNote}`;
  }
  if (trace.result.decision === "deny") {
    return `Denied because ${trace.evaluation.primaryReasonCode}; ${stepNote}`;
  }

  return `Routed to ${loop.capabilityReadout.fallbackType} because ${trace.evaluation.primaryReasonCode}; ${stepNote}`;
}

function sourceObjectTypeForKind(kind: TenantResourceSourceKind) {
  const labels: Record<TenantResourceSourceKind, string> = {
    connector: "Connector",
    import_source: "ImportSource",
    workspace_solution_extension: "WorkspaceSolutionExtension",
    capture_session: "CaptureSession",
    connector_ingestion: "ConnectorIngestion",
    official_write_intent: "OfficialWriteIntent",
  };

  return labels[kind];
}

function buildSourceObjectLabel(resource: TenantResourceReadiness) {
  return `${sourceObjectTypeForKind(resource.source.sourceKind)}:${resource.source.sourceRef}`;
}

function parseEvidenceRef(evidenceRef: string) {
  const separatorIndex = evidenceRef.indexOf(":");
  if (separatorIndex === -1) {
    return {
      sourceKind: "unknown",
      sourceRef: evidenceRef,
    };
  }

  return {
    sourceKind: evidenceRef.slice(0, separatorIndex),
    sourceRef: evidenceRef.slice(separatorIndex + 1),
  };
}

function sourceLabelForEvidenceRef(sourceKind: string, sourceRef: string) {
  return `${sourceKind.replaceAll("_", " ")} ${sourceRef}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildStableKey(prefix: string, seed: string) {
  const normalized =
    seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "unknown";

  return `${prefix}_${normalized}`;
}
