export type TenantResourceType =
  | "crm"
  | "vertical_system"
  | "collaboration"
  | "knowledge_base"
  | "spreadsheet"
  | "bi"
  | "automation_agent"
  | "human_input"
  | "tenant_extension";

export type TenantResourceReadinessStatus =
  | "registered"
  | "configured"
  | "connected"
  | "readable"
  | "mapped"
  | "governed"
  | "actionable"
  | "write_intent_enabled"
  | "paused"
  | "error"
  | "revoked";

export type TenantResourceEffectMode =
  | "read_only"
  | "draft_only"
  | "internal_write"
  | "manual_execution"
  | "guarded_write_intent";

export type TenantResourceTrustLevel =
  | "unknown"
  | "low"
  | "medium"
  | "declared"
  | "human_confirmed"
  | "system_of_record";

export type TenantResourcePromotionEligibility =
  | "not_eligible"
  | "review_required"
  | "eligible_read_only"
  | "eligible_for_action_pack";

export type TenantResourceSourceKind =
  | "connector"
  | "import_source"
  | "workspace_solution_extension"
  | "capture_session"
  | "connector_ingestion"
  | "official_write_intent";

export type TenantResourceReadinessReason =
  | "ready"
  | "not_connected"
  | "connector_error"
  | "import_failed"
  | "mapping_incomplete"
  | "manifest_missing"
  | "review_required"
  | "resource_paused"
  | "freshness_unknown";

export type TenantConnectorInput = {
  id: string;
  workspaceId: string;
  provider: string;
  status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR" | string;
  externalAccountEmail?: string | null;
  manualSendEnabled?: boolean | null;
  lastSyncedAt?: Date | string | null;
  lastSyncStatus?: string | null;
  lastSyncMessage?: string | null;
  tokenExpiresAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type TenantImportSourceInput = {
  id: string;
  workspaceId: string;
  sourceType: string;
  sourceName: string;
  status: "PENDING" | "CONNECTED" | "SYNCING" | "DISCONNECTED" | "ERROR" | string;
  lastSyncedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type TenantImportJobInput = {
  id: string;
  sourceId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED" | string;
  totalRecords?: number | null;
  successRecords?: number | null;
  failedRecords?: number | null;
  warningRecords?: number | null;
  finishedAt?: Date | string | null;
  errorSummary?: string | null;
};

export type TenantExtensionInput = {
  id: string;
  workspaceId: string;
  extensionKey: string;
  kind: string;
  status: "ACTIVE" | "DISABLED" | string;
  version?: string | null;
  updatedAt?: Date | string | null;
};

export type TenantExtensionManifestInput = {
  extensionKey: string;
  displayName: string;
  dependencyConnectors?: string[];
  workspaceTruths?: string[];
  policyTruths?: string[];
  capabilityDeclarations?: string[];
  maxEffectMode?: TenantResourceEffectMode | "customer_visible_send" | string;
  requiresReviewByDefault?: boolean;
  resourceDependencies?: Array<{
    resourceDependencyKey: string;
    provider: string;
    declaredCapabilityModes: TenantResourceEffectMode[];
    objectBindings: string[];
    policyHints: string[];
  }>;
};

export type TenantCaptureSessionInput = {
  id: string;
  workspaceId: string;
  title?: string | null;
  status: "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED" | string;
  sourceType?: string | null;
  transcriptStatus?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | string | null;
  processingStatus?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | string | null;
  updatedAt?: Date | string | null;
};

export type BuildTenantResourceReadinessInput = {
  now?: Date | string;
  connectors?: TenantConnectorInput[];
  importSources?: TenantImportSourceInput[];
  importJobs?: TenantImportJobInput[];
  extensions?: TenantExtensionInput[];
  extensionManifests?: TenantExtensionManifestInput[];
  captureSessions?: TenantCaptureSessionInput[];
};

export type TenantResourceReadiness = {
  resourceKey: string;
  resourceName: string;
  workspaceId: string;
  resourceType: TenantResourceType;
  provider: string;
  status: TenantResourceReadinessStatus;
  source: {
    sourceKind: TenantResourceSourceKind;
    sourceRef: string;
  };
  connection: {
    readCapability: boolean;
    writeCapability: boolean;
    callbackCapability: boolean;
    lastSyncAt: string | null;
    lastHealthStatus: string | null;
    tokenPosture: "not_required" | "healthy" | "review_required" | "unknown";
  };
  mapping: {
    mappedObjectTypes: string[];
    mappingCompleteness: number;
    conflictCount: number;
    missingRequirements: string[];
  };
  governance: {
    trustLevel: TenantResourceTrustLevel;
    promotionEligibility: TenantResourcePromotionEligibility;
    freshnessWindow: string;
    allowedEffectModes: TenantResourceEffectMode[];
    reviewRequirement: "none" | "recommended" | "required";
    customerFacingAllowed: boolean;
    writeBackAllowed: boolean;
    fallbackMode: "none" | "draft_only" | "manual_execution" | "review_queue" | "blocked";
  };
  readiness: {
    actionable: boolean;
    primaryGap: TenantResourceReadinessReason | null;
    reasonCodes: TenantResourceReadinessReason[];
    operatorNextMove: string;
    boundaryNotes: string[];
  };
  evidenceRefs: string[];
  updatedAt: string | null;
};

export type TenantResourceReadinessSummary = {
  generatedAt: string;
  totalResources: number;
  resources: TenantResourceReadiness[];
  statusCounts: Record<TenantResourceReadinessStatus, number>;
  actionableResourceKeys: string[];
  blockedResourceKeys: string[];
  boundaryNotes: string[];
};

const emptyStatusCounts: Record<TenantResourceReadinessStatus, number> = {
  registered: 0,
  configured: 0,
  connected: 0,
  readable: 0,
  mapped: 0,
  governed: 0,
  actionable: 0,
  write_intent_enabled: 0,
  paused: 0,
  error: 0,
  revoked: 0,
};

const summaryBoundaryNotes = [
  "tenant resource readiness is read-only; existing connector/import/extension/runtime systems remain the source of truth",
  "resource readiness does not create connector marketplace, broad auto-write, customer-visible send, or execution authority",
  "resource dependencies must still pass Helm control-plane trust, review, capability, and ownership checks before use",
];

export function buildTenantResourceReadiness(
  input: BuildTenantResourceReadinessInput,
): TenantResourceReadinessSummary {
  const generatedAt = toIsoString(input.now ?? new Date());
  const now = new Date(generatedAt);
  const importJobsBySource = groupLatestImportJobs(input.importJobs ?? []);
  const manifestsByExtensionKey = new Map(
    (input.extensionManifests ?? []).map((manifest) => [manifest.extensionKey, manifest]),
  );
  const resources = [
    ...(input.connectors ?? []).map((connector) => buildConnectorResource(connector, now)),
    ...(input.importSources ?? []).map((source) =>
      buildImportSourceResource(source, importJobsBySource.get(source.id) ?? null, now),
    ),
    ...(input.extensions ?? []).map((extension) =>
      buildExtensionResource(extension, manifestsByExtensionKey.get(extension.extensionKey) ?? null),
    ),
    ...(input.captureSessions ?? []).map((session) => buildCaptureSessionResource(session)),
  ].sort((left, right) => left.resourceKey.localeCompare(right.resourceKey));
  const statusCounts = { ...emptyStatusCounts };

  for (const resource of resources) {
    statusCounts[resource.status] += 1;
  }

  return {
    generatedAt,
    totalResources: resources.length,
    resources,
    statusCounts,
    actionableResourceKeys: resources
      .filter((resource) => resource.readiness.actionable)
      .map((resource) => resource.resourceKey),
    blockedResourceKeys: resources
      .filter((resource) => ["error", "paused", "revoked"].includes(resource.status))
      .map((resource) => resource.resourceKey),
    boundaryNotes: summaryBoundaryNotes,
  };
}

function buildConnectorResource(connector: TenantConnectorInput, now: Date): TenantResourceReadiness {
  const isConnected = connector.status === "CONNECTED";
  const isErrored = connector.status === "ERROR";
  const isPaused = connector.status === "DISCONNECTED";
  const isFresh = isFreshWithinHours(connector.lastSyncedAt ?? connector.updatedAt ?? null, now, 24);
  const primaryGap: TenantResourceReadinessReason | null = isErrored
    ? "connector_error"
    : isPaused
      ? "resource_paused"
      : isConnected
        ? isFresh
          ? null
          : "freshness_unknown"
        : "not_connected";
  const status: TenantResourceReadinessStatus = isErrored
    ? "error"
    : isPaused
      ? "paused"
      : isConnected
        ? "readable"
        : "configured";

  return {
    resourceKey: `connector:${connector.id}`,
    resourceName: connector.externalAccountEmail ?? `${connector.provider} connector`,
    workspaceId: connector.workspaceId,
    resourceType: resourceTypeForProvider(connector.provider),
    provider: connector.provider,
    status,
    source: {
      sourceKind: "connector",
      sourceRef: connector.id,
    },
    connection: {
      readCapability: isConnected,
      writeCapability: false,
      callbackCapability: ["DINGTALK", "WECOM", "GMAIL", "GOOGLE_CALENDAR"].includes(connector.provider),
      lastSyncAt: toNullableIsoString(connector.lastSyncedAt ?? null),
      lastHealthStatus: connector.lastSyncStatus ?? connector.status.toLowerCase(),
      tokenPosture: isErrored || primaryGap === "freshness_unknown" ? "review_required" : isConnected ? "healthy" : "unknown",
    },
    mapping: {
      mappedObjectTypes: [],
      mappingCompleteness: 0,
      conflictCount: 0,
      missingRequirements: isConnected ? ["object_mapping"] : ["connection"],
    },
    governance: {
      trustLevel: isConnected && isFresh ? "medium" : "unknown",
      promotionEligibility: isConnected && isFresh ? "eligible_read_only" : "not_eligible",
      freshnessWindow: "24h",
      allowedEffectModes: ["read_only", "draft_only"],
      reviewRequirement: connector.manualSendEnabled ? "required" : "recommended",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: isConnected ? "draft_only" : "blocked",
    },
    readiness: {
      actionable: false,
      primaryGap,
      reasonCodes: primaryGap ? [primaryGap] : ["mapping_incomplete"],
      operatorNextMove:
        primaryGap === "freshness_unknown"
          ? "Refresh the resource before using it for current Helm judgement."
          : primaryGap
            ? "Repair or reconnect the resource before using it for Helm judgement."
            : "Map this connector to business objects before using it for governed recommendations.",
      boundaryNotes: [
        "connector readiness is read-only and does not grant send or external write authority",
        "manual send posture still requires explicit human review and existing connector guards",
      ],
    },
    evidenceRefs: [`connector:${connector.id}`],
    updatedAt: toNullableIsoString(connector.updatedAt ?? connector.lastSyncedAt ?? null),
  };
}

function buildImportSourceResource(
  source: TenantImportSourceInput,
  latestJob: TenantImportJobInput | null,
  now: Date,
): TenantResourceReadiness {
  const isConnected = source.status === "CONNECTED" || source.status === "SYNCING";
  const isErrored = source.status === "ERROR" || latestJob?.status === "FAILED";
  const isPaused = source.status === "DISCONNECTED";
  const mappingCompleteness = calculateMappingCompleteness(latestJob);
  const conflictCount = (latestJob?.failedRecords ?? 0) + (latestJob?.warningRecords ?? 0);
  const hasCompletedJob =
    latestJob?.status === "COMPLETED" || latestJob?.status === "COMPLETED_WITH_WARNINGS";
  const mappedObjectTypes = mappedObjectTypesForImportSource(source.sourceType);
  const freshnessDate = source.lastSyncedAt ?? latestJob?.finishedAt ?? source.updatedAt ?? null;
  const freshEnough = isFreshWithinHours(freshnessDate, now, 24);
  const actionable = isConnected && hasCompletedJob && mappingCompleteness >= 80 && freshEnough;
  const primaryGap = resolveImportPrimaryGap({
    isConnected,
    isErrored,
    isPaused,
    hasCompletedJob,
    mappingCompleteness,
    freshEnough,
  });

  return {
    resourceKey: `import_source:${source.id}`,
    resourceName: source.sourceName,
    workspaceId: source.workspaceId,
    resourceType: resourceTypeForProvider(source.sourceType),
    provider: source.sourceType,
    status: isErrored
      ? "error"
      : isPaused
        ? "paused"
        : actionable
          ? "actionable"
          : hasCompletedJob
            ? "mapped"
            : isConnected
              ? "readable"
              : "configured",
    source: {
      sourceKind: "import_source",
      sourceRef: source.id,
    },
    connection: {
      readCapability: isConnected,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: toNullableIsoString(source.lastSyncedAt ?? latestJob?.finishedAt ?? null),
      lastHealthStatus: latestJob?.status?.toLowerCase() ?? source.status.toLowerCase(),
      tokenPosture: isErrored ? "review_required" : isConnected ? "healthy" : "unknown",
    },
    mapping: {
      mappedObjectTypes,
      mappingCompleteness,
      conflictCount,
      missingRequirements: primaryGap === "mapping_incomplete" ? ["mapping_review"] : [],
    },
    governance: {
      trustLevel: actionable ? "human_confirmed" : isConnected ? "medium" : "unknown",
      promotionEligibility: actionable ? "eligible_for_action_pack" : "review_required",
      freshnessWindow: "24h",
      allowedEffectModes: ["read_only", "draft_only", "manual_execution"],
      reviewRequirement: conflictCount > 0 ? "recommended" : "none",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: actionable ? "manual_execution" : "review_queue",
    },
    readiness: {
      actionable,
      primaryGap,
      reasonCodes: primaryGap ? [primaryGap] : ["ready"],
      operatorNextMove: actionable
        ? "Use this resource for judgement and next-action drafts with evidence attached."
        : primaryGap === "freshness_unknown"
          ? "Refresh the resource before using it for current Helm judgement."
          : "Review mapping completeness and import health before routing this resource into Helm judgement.",
      boundaryNotes: [
        "import resource readiness does not alter import execution or connector behavior",
        "official write remains disabled; CRM updates require separate guarded-write evaluation",
      ],
    },
    evidenceRefs: [`import_source:${source.id}`, ...(latestJob ? [`import_job:${latestJob.id}`] : [])],
    updatedAt: toNullableIsoString(source.updatedAt ?? latestJob?.finishedAt ?? source.lastSyncedAt ?? null),
  };
}

function buildExtensionResource(
  extension: TenantExtensionInput,
  manifest: TenantExtensionManifestInput | null,
): TenantResourceReadiness {
  const active = extension.status === "ACTIVE";
  const missingManifest = !manifest;
  const missingRequirements = resolveExtensionMissingRequirements(manifest);
  const hasManifestGap = missingRequirements.length > 0;
  const mappedObjectTypes = uniqueStrings(
    manifest?.resourceDependencies?.flatMap((dependency) => dependency.objectBindings) ?? [],
  );
  const primaryGap: TenantResourceReadinessReason | null = !active
    ? "resource_paused"
    : missingManifest
      ? "manifest_missing"
      : hasManifestGap
        ? "mapping_incomplete"
        : manifest.requiresReviewByDefault
        ? "review_required"
        : null;

  return {
    resourceKey: `extension:${extension.extensionKey}`,
    resourceName: manifest?.displayName ?? extension.extensionKey,
    workspaceId: extension.workspaceId,
    resourceType: "tenant_extension",
    provider: extension.extensionKey,
    status: !active ? "paused" : missingManifest ? "registered" : "governed",
    source: {
      sourceKind: "workspace_solution_extension",
      sourceRef: extension.id,
    },
    connection: {
      readCapability: active && !missingManifest,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: null,
      lastHealthStatus: active ? "active" : "disabled",
      tokenPosture: "not_required",
    },
    mapping: {
      mappedObjectTypes: mappedObjectTypes.length ? mappedObjectTypes : ["EXTENSION_OBJECT"],
      mappingCompleteness: manifest ? (hasManifestGap ? 50 : 100) : 0,
      conflictCount: 0,
      missingRequirements: manifest ? missingRequirements : ["extension_manifest"],
    },
    governance: {
      trustLevel: manifest ? "declared" : "unknown",
      promotionEligibility:
        hasManifestGap || manifest?.requiresReviewByDefault ? "review_required" : "eligible_read_only",
      freshnessWindow: "manifest_declared",
      allowedEffectModes: normalizeManifestEffectModes(manifest?.maxEffectMode),
      reviewRequirement: hasManifestGap || manifest?.requiresReviewByDefault ? "required" : "recommended",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: hasManifestGap || manifest?.requiresReviewByDefault ? "review_queue" : "draft_only",
    },
    readiness: {
      actionable: false,
      primaryGap,
      reasonCodes: primaryGap ? [primaryGap] : ["mapping_incomplete"],
      operatorNextMove: hasManifestGap
        ? "Declare resource dependencies and capability evidence before using this extension for Helm judgement."
        : primaryGap
          ? "Review dependency mapping and evidence posture before using this resource for a governed loop."
          : "Select a representative governed loop before treating this extension as actionable.",
      boundaryNotes: [
        "resource dependency does not grant execution authority",
        "tenant custom extension stays outside shared core until stable cross-tenant reuse is proven",
      ],
    },
    evidenceRefs: [
      `workspace_solution_extension:${extension.id}`,
      ...(manifest ? [`extension_manifest:${manifest.extensionKey}`] : []),
    ],
    updatedAt: toNullableIsoString(extension.updatedAt ?? null),
  };
}

function buildCaptureSessionResource(session: TenantCaptureSessionInput): TenantResourceReadiness {
  const completed =
    session.status === "COMPLETED" &&
    session.transcriptStatus === "COMPLETED" &&
    session.processingStatus === "COMPLETED";
  const errored =
    session.status === "FAILED" ||
    session.transcriptStatus === "FAILED" ||
    session.processingStatus === "FAILED";

  return {
    resourceKey: `capture_session:${session.id}`,
    resourceName: session.title ?? `${session.sourceType ?? "capture"} session`,
    workspaceId: session.workspaceId,
    resourceType: "human_input",
    provider: session.sourceType ?? "MANUAL_CAPTURE",
    status: errored ? "error" : completed ? "mapped" : "readable",
    source: {
      sourceKind: "capture_session",
      sourceRef: session.id,
    },
    connection: {
      readCapability: !errored,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: toNullableIsoString(session.updatedAt ?? null),
      lastHealthStatus: errored ? "failed" : session.status.toLowerCase(),
      tokenPosture: "not_required",
    },
    mapping: {
      mappedObjectTypes: completed ? ["MEETING", "MEMORY"] : [],
      mappingCompleteness: completed ? 100 : 40,
      conflictCount: 0,
      missingRequirements: completed ? [] : ["processing_completion"],
    },
    governance: {
      trustLevel: completed ? "human_confirmed" : "low",
      promotionEligibility: completed ? "eligible_read_only" : "review_required",
      freshnessWindow: "session_scoped",
      allowedEffectModes: ["read_only", "draft_only"],
      reviewRequirement: "recommended",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: completed ? "draft_only" : "review_queue",
    },
    readiness: {
      actionable: false,
      primaryGap: errored ? "connector_error" : completed ? "review_required" : "mapping_incomplete",
      reasonCodes: [errored ? "connector_error" : completed ? "review_required" : "mapping_incomplete"],
      operatorNextMove: completed
        ? "Review captured evidence before using it for downstream judgement."
        : "Finish capture processing before using this resource in Helm judgement.",
      boundaryNotes: [
        "capture session evidence remains review-first and cannot silently promote inferred facts",
      ],
    },
    evidenceRefs: [`capture_session:${session.id}`],
    updatedAt: toNullableIsoString(session.updatedAt ?? null),
  };
}

function groupLatestImportJobs(jobs: TenantImportJobInput[]) {
  const latest = new Map<string, TenantImportJobInput>();

  for (const job of jobs) {
    const current = latest.get(job.sourceId);
    if (!current || compareNullableDates(job.finishedAt, current.finishedAt) > 0) {
      latest.set(job.sourceId, job);
    }
  }

  return latest;
}

function resolveImportPrimaryGap(input: {
  isConnected: boolean;
  isErrored: boolean;
  isPaused: boolean;
  hasCompletedJob: boolean;
  mappingCompleteness: number;
  freshEnough: boolean;
}): TenantResourceReadinessReason | null {
  if (input.isErrored) return "import_failed";
  if (input.isPaused) return "resource_paused";
  if (!input.isConnected) return "not_connected";
  if (!input.hasCompletedJob || input.mappingCompleteness < 80) return "mapping_incomplete";
  if (!input.freshEnough) return "freshness_unknown";
  return null;
}

function calculateMappingCompleteness(job: TenantImportJobInput | null): number {
  if (!job?.totalRecords) {
    return 0;
  }

  return Math.round(((job.successRecords ?? 0) / job.totalRecords) * 100);
}

function mappedObjectTypesForImportSource(sourceType: string) {
  if (["HUBSPOT", "SALESFORCE"].includes(sourceType)) {
    return ["CONTACT", "COMPANY", "OPPORTUNITY"];
  }
  if (["GMAIL", "DINGTALK", "WECOM"].includes(sourceType)) {
    return ["EMAIL_THREAD", "MEETING"];
  }
  if (sourceType === "TRANSCRIPT_INGEST") {
    return ["MEETING", "MEMORY"];
  }
  if (sourceType === "CSV") {
    return ["CONTACT", "COMPANY", "OPPORTUNITY", "MEETING"];
  }
  return [];
}

function resourceTypeForProvider(provider: string): TenantResourceType {
  if (["HUBSPOT", "SALESFORCE"].includes(provider)) return "crm";
  if (["GMAIL", "GOOGLE_CALENDAR", "DINGTALK", "WECOM"].includes(provider)) {
    return "collaboration";
  }
  if (provider === "CSV") return "spreadsheet";
  if (provider === "TRANSCRIPT_INGEST") return "human_input";
  return "vertical_system";
}

export function normalizeManifestEffectModes(
  maxEffectMode: TenantExtensionManifestInput["maxEffectMode"] | undefined,
): TenantResourceEffectMode[] {
  if (maxEffectMode === "guarded_write_intent") {
    return ["read_only", "draft_only", "internal_write", "manual_execution", "guarded_write_intent"];
  }
  if (maxEffectMode === "manual_execution") {
    return ["read_only", "draft_only", "internal_write", "manual_execution"];
  }
  if (maxEffectMode === "internal_write") {
    return ["read_only", "draft_only", "internal_write"];
  }
  if (maxEffectMode === "draft_only") {
    return ["read_only", "draft_only"];
  }
  return ["read_only"];
}

function resolveExtensionMissingRequirements(manifest: TenantExtensionManifestInput | null) {
  if (!manifest) return [];

  const missingRequirements: string[] = [];
  if (!manifest.dependencyConnectors?.length && !manifest.resourceDependencies?.length) {
    missingRequirements.push("resource_dependency");
  }
  if (!manifest.capabilityDeclarations?.length) {
    missingRequirements.push("capability_declaration");
  }
  if (
    manifest.resourceDependencies?.some(
      (dependency) => dependency.objectBindings.length === 0,
    )
  ) {
    missingRequirements.push("object_binding");
  }
  if (
    manifest.resourceDependencies?.some(
      (dependency) => dependency.policyHints.length === 0,
    )
  ) {
    missingRequirements.push("policy_hint");
  }

  return missingRequirements;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function compareNullableDates(left: Date | string | null | undefined, right: Date | string | null | undefined) {
  return dateValue(left) - dateValue(right);
}

function isFreshWithinHours(value: Date | string | null | undefined, now: Date, hours: number) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const delta = now.getTime() - timestamp;
  return delta >= 0 && delta <= hours * 60 * 60 * 1000;
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function toNullableIsoString(value: Date | string | null): string | null {
  return value ? toIsoString(value) : null;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
