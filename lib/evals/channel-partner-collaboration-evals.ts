import channelPartnerCollaborationFixturePack from "@/evals/channel-partner-collaboration/channel-partner-collaboration-cases.json";
import { isKnownChannelPartnerReasonCode } from "@/lib/channel-partner-collaboration/reason-codes";

export type ChannelPartnerCollaborationOutcome = "allowed" | "rejected";

export type ChannelPartnerCollaborationActor =
  | "partner"
  | "customer_admin"
  | "customer_operator"
  | "customer_champion"
  | "customer_member"
  | "system";

export type ChannelPartnerCollaborationIncidentFlags = {
  unauthorizedAccess?: boolean;
  outboundSendIncident?: boolean;
  disclosureMissing?: boolean;
  attributionUniquenessViolation?: boolean;
  partnerDataLeakedToCustomerWorkspace?: boolean;
  customerDataRawLeakedToPartner?: boolean;
  directRecommendationCreationByPartner?: boolean;
  askHelmAccessByPartner?: boolean;
  crossTenantHelperLeak?: boolean;
  directSourceTableRead?: boolean;
  missingGrantAccepted?: boolean;
  unauthorizedNudgeAcceptance?: boolean;
  schemaRuntimeApiUiIncident?: boolean;
  partnerWorkspaceRuntimeIncident?: boolean;
};

export type ChannelPartnerCollaborationCoverageFlags = {
  nudgeLifecycle?: boolean;
  revocation?: boolean;
  attributionLedgerAnchor?: boolean;
  partnerSafeDto?: boolean;
};

export type ChannelPartnerCollaborationExpectation = {
  outcome: ChannelPartnerCollaborationOutcome;
  reasonCodes: string[];
  flags?: ChannelPartnerCollaborationIncidentFlags;
  coverage?: ChannelPartnerCollaborationCoverageFlags;
};

export type ChannelPartnerCollaborationGrantFixture = {
  present?: boolean;
  status?: string;
};

export type ChannelPartnerPortfolioReadoutFixture = {
  aliasUsed?: boolean;
  rawCustomerNameLeaked?: boolean;
  exactAmountLeaked?: boolean;
  rawWorkspaceUrlLeaked?: boolean;
  workspaceSlugLeaked?: boolean;
};

export type ChannelPartnerP2CandidateFixture = {
  partnerWorkspaceCanceled?: boolean;
  autoSuspendCandidateRecorded?: boolean;
  runtimeSuspendExecuted?: boolean;
};

export type ChannelPartnerCollaborationCase = {
  id: string;
  scenario: string;
  description: string;
  actor: ChannelPartnerCollaborationActor;
  request: string;
  grant?: ChannelPartnerCollaborationGrantFixture;
  portfolioReadout?: ChannelPartnerPortfolioReadoutFixture;
  p2Candidate?: ChannelPartnerP2CandidateFixture;
  expect: ChannelPartnerCollaborationExpectation;
  [key: string]: unknown;
};

export type ChannelPartnerCollaborationFixtureTargets = {
  minimumTotalCases: number;
  minimumNudgeLifecycleCoverageCount: number;
  minimumRevocationCoverageCount: number;
  minimumAttributionLedgerAnchorCoverageCount: number;
  minimumPartnerSafeDtoCoverageCount: number;
  maximumUnauthorizedAccessCount: number;
  maximumOutboundSendIncidentCount: number;
  maximumDisclosureMissingCount: number;
  maximumAttributionUniquenessViolations: number;
  maximumPartnerDataLeakedToCustomerWorkspaceCount: number;
  maximumCustomerDataRawLeakedToPartnerCount: number;
  maximumDirectRecommendationCreationByPartnerCount: number;
  maximumAskHelmAccessByPartnerCount: number;
  maximumCrossTenantHelperLeakCount: number;
  maximumDirectSourceTableReadCount: number;
  maximumMissingGrantAcceptedCount: number;
  maximumUnauthorizedNudgeAcceptanceCount: number;
  maximumSchemaRuntimeApiUiIncidentCount: number;
  maximumPartnerWorkspaceRuntimeIncidentCount: number;
};

export type ChannelPartnerCollaborationFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  sourceDoc: string;
  scope: string;
  notes?: string[];
  targets: ChannelPartnerCollaborationFixtureTargets;
  cases: ChannelPartnerCollaborationCase[];
};

export type ChannelPartnerCollaborationFailure = {
  caseId: string;
  reason: string;
};

export type ChannelPartnerCollaborationSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  allowedCaseCount: number;
  rejectedCaseCount: number;
  nudgeLifecycleCoverageCount: number;
  revocationCoverageCount: number;
  attributionLedgerAnchorCoverageCount: number;
  partnerSafeDtoCoverageCount: number;
  unauthorizedAccessCount: number;
  outboundSendIncidentCount: number;
  disclosureMissingCount: number;
  attributionUniquenessViolations: number;
  partnerDataLeakedToCustomerWorkspaceCount: number;
  customerDataRawLeakedToPartnerCount: number;
  directRecommendationCreationByPartnerCount: number;
  askHelmAccessByPartnerCount: number;
  crossTenantHelperLeakCount: number;
  directSourceTableReadCount: number;
  missingGrantAcceptedCount: number;
  unauthorizedNudgeAcceptanceCount: number;
  schemaRuntimeApiUiIncidentCount: number;
  partnerWorkspaceRuntimeIncidentCount: number;
  failures: ChannelPartnerCollaborationFailure[];
};

const REQUIRED_METADATA_MARKERS = {
  status: "offline_evaluation_fixture",
  redactionPosture: "alias_only",
  boundary: "p0_offline_only",
  scope: "P0-REQ-08",
} as const;

const FORBIDDEN_RUNTIME_SUBSTRINGS = [
  "@prisma/client",
  "@/lib/db",
  "next/server",
  "next/headers",
  "app/api/",
  ["fetch", "("].join(""),
  "process.env",
  "openai",
  "anthropic",
  "http://",
  "https://",
] as const;

const FORBIDDEN_RAW_FIELD_SUBSTRINGS = [
  "signalSummary",
  "normalizedPayload",
  "inputSummary",
  "outputSummary",
  "internalSalesNotes",
] as const;

export function runChannelPartnerCollaborationEval(
  fixturePack: ChannelPartnerCollaborationFixturePack =
    channelPartnerCollaborationFixturePack as ChannelPartnerCollaborationFixturePack,
): ChannelPartnerCollaborationSummary {
  const failures: ChannelPartnerCollaborationFailure[] = [];

  assertMetadataMarkers(fixturePack, failures);
  assertNoRuntimeDriftInFixture(fixturePack, failures);

  const counters = newCounters();

  for (const item of fixturePack.cases) {
    accumulateCase(item, counters, failures);
  }

  pushSummaryFailureIf(
    failures,
    fixturePack.cases.length < fixturePack.targets.minimumTotalCases,
    `total_cases_below_minimum:${fixturePack.cases.length}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.nudgeLifecycleCoverageCount < fixturePack.targets.minimumNudgeLifecycleCoverageCount,
    `nudge_lifecycle_coverage_below_minimum:${counters.nudgeLifecycleCoverageCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.revocationCoverageCount < fixturePack.targets.minimumRevocationCoverageCount,
    `revocation_coverage_below_minimum:${counters.revocationCoverageCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.attributionLedgerAnchorCoverageCount <
      fixturePack.targets.minimumAttributionLedgerAnchorCoverageCount,
    `attribution_ledger_anchor_coverage_below_minimum:${counters.attributionLedgerAnchorCoverageCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.partnerSafeDtoCoverageCount < fixturePack.targets.minimumPartnerSafeDtoCoverageCount,
    `partner_safe_dto_coverage_below_minimum:${counters.partnerSafeDtoCoverageCount}`,
  );

  pushSummaryFailureIf(
    failures,
    counters.unauthorizedAccessCount > fixturePack.targets.maximumUnauthorizedAccessCount,
    `unauthorized_access_count_exceeds:${counters.unauthorizedAccessCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.outboundSendIncidentCount > fixturePack.targets.maximumOutboundSendIncidentCount,
    `outbound_send_incident_count_exceeds:${counters.outboundSendIncidentCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.disclosureMissingCount > fixturePack.targets.maximumDisclosureMissingCount,
    `disclosure_missing_count_exceeds:${counters.disclosureMissingCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.attributionUniquenessViolations > fixturePack.targets.maximumAttributionUniquenessViolations,
    `attribution_uniqueness_violations_exceeds:${counters.attributionUniquenessViolations}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.partnerDataLeakedToCustomerWorkspaceCount >
      fixturePack.targets.maximumPartnerDataLeakedToCustomerWorkspaceCount,
    `partner_data_leaked_to_customer_workspace_count_exceeds:${counters.partnerDataLeakedToCustomerWorkspaceCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.customerDataRawLeakedToPartnerCount >
      fixturePack.targets.maximumCustomerDataRawLeakedToPartnerCount,
    `customer_data_raw_leaked_to_partner_count_exceeds:${counters.customerDataRawLeakedToPartnerCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.directRecommendationCreationByPartnerCount >
      fixturePack.targets.maximumDirectRecommendationCreationByPartnerCount,
    `direct_recommendation_creation_by_partner_count_exceeds:${counters.directRecommendationCreationByPartnerCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.askHelmAccessByPartnerCount > fixturePack.targets.maximumAskHelmAccessByPartnerCount,
    `ask_helm_access_by_partner_count_exceeds:${counters.askHelmAccessByPartnerCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.crossTenantHelperLeakCount > fixturePack.targets.maximumCrossTenantHelperLeakCount,
    `cross_tenant_helper_leak_count_exceeds:${counters.crossTenantHelperLeakCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.directSourceTableReadCount > fixturePack.targets.maximumDirectSourceTableReadCount,
    `direct_source_table_read_count_exceeds:${counters.directSourceTableReadCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.missingGrantAcceptedCount > fixturePack.targets.maximumMissingGrantAcceptedCount,
    `missing_grant_accepted_count_exceeds:${counters.missingGrantAcceptedCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.unauthorizedNudgeAcceptanceCount > fixturePack.targets.maximumUnauthorizedNudgeAcceptanceCount,
    `unauthorized_nudge_acceptance_count_exceeds:${counters.unauthorizedNudgeAcceptanceCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.schemaRuntimeApiUiIncidentCount > fixturePack.targets.maximumSchemaRuntimeApiUiIncidentCount,
    `schema_runtime_api_ui_incident_count_exceeds:${counters.schemaRuntimeApiUiIncidentCount}`,
  );
  pushSummaryFailureIf(
    failures,
    counters.partnerWorkspaceRuntimeIncidentCount >
      fixturePack.targets.maximumPartnerWorkspaceRuntimeIncidentCount,
    `partner_workspace_runtime_incident_count_exceeds:${counters.partnerWorkspaceRuntimeIncidentCount}`,
  );

  return {
    passed: failures.length === 0,
    version: fixturePack.version,
    totalCases: fixturePack.cases.length,
    allowedCaseCount: counters.allowedCaseCount,
    rejectedCaseCount: counters.rejectedCaseCount,
    nudgeLifecycleCoverageCount: counters.nudgeLifecycleCoverageCount,
    revocationCoverageCount: counters.revocationCoverageCount,
    attributionLedgerAnchorCoverageCount: counters.attributionLedgerAnchorCoverageCount,
    partnerSafeDtoCoverageCount: counters.partnerSafeDtoCoverageCount,
    unauthorizedAccessCount: counters.unauthorizedAccessCount,
    outboundSendIncidentCount: counters.outboundSendIncidentCount,
    disclosureMissingCount: counters.disclosureMissingCount,
    attributionUniquenessViolations: counters.attributionUniquenessViolations,
    partnerDataLeakedToCustomerWorkspaceCount: counters.partnerDataLeakedToCustomerWorkspaceCount,
    customerDataRawLeakedToPartnerCount: counters.customerDataRawLeakedToPartnerCount,
    directRecommendationCreationByPartnerCount: counters.directRecommendationCreationByPartnerCount,
    askHelmAccessByPartnerCount: counters.askHelmAccessByPartnerCount,
    crossTenantHelperLeakCount: counters.crossTenantHelperLeakCount,
    directSourceTableReadCount: counters.directSourceTableReadCount,
    missingGrantAcceptedCount: counters.missingGrantAcceptedCount,
    unauthorizedNudgeAcceptanceCount: counters.unauthorizedNudgeAcceptanceCount,
    schemaRuntimeApiUiIncidentCount: counters.schemaRuntimeApiUiIncidentCount,
    partnerWorkspaceRuntimeIncidentCount: counters.partnerWorkspaceRuntimeIncidentCount,
    failures,
  };
}

type Counters = {
  allowedCaseCount: number;
  rejectedCaseCount: number;
  nudgeLifecycleCoverageCount: number;
  revocationCoverageCount: number;
  attributionLedgerAnchorCoverageCount: number;
  partnerSafeDtoCoverageCount: number;
  unauthorizedAccessCount: number;
  outboundSendIncidentCount: number;
  disclosureMissingCount: number;
  attributionUniquenessViolations: number;
  partnerDataLeakedToCustomerWorkspaceCount: number;
  customerDataRawLeakedToPartnerCount: number;
  directRecommendationCreationByPartnerCount: number;
  askHelmAccessByPartnerCount: number;
  crossTenantHelperLeakCount: number;
  directSourceTableReadCount: number;
  missingGrantAcceptedCount: number;
  unauthorizedNudgeAcceptanceCount: number;
  schemaRuntimeApiUiIncidentCount: number;
  partnerWorkspaceRuntimeIncidentCount: number;
};

function newCounters(): Counters {
  return {
    allowedCaseCount: 0,
    rejectedCaseCount: 0,
    nudgeLifecycleCoverageCount: 0,
    revocationCoverageCount: 0,
    attributionLedgerAnchorCoverageCount: 0,
    partnerSafeDtoCoverageCount: 0,
    unauthorizedAccessCount: 0,
    outboundSendIncidentCount: 0,
    disclosureMissingCount: 0,
    attributionUniquenessViolations: 0,
    partnerDataLeakedToCustomerWorkspaceCount: 0,
    customerDataRawLeakedToPartnerCount: 0,
    directRecommendationCreationByPartnerCount: 0,
    askHelmAccessByPartnerCount: 0,
    crossTenantHelperLeakCount: 0,
    directSourceTableReadCount: 0,
    missingGrantAcceptedCount: 0,
    unauthorizedNudgeAcceptanceCount: 0,
    schemaRuntimeApiUiIncidentCount: 0,
    partnerWorkspaceRuntimeIncidentCount: 0,
  };
}

function accumulateCase(
  item: ChannelPartnerCollaborationCase,
  counters: Counters,
  failures: ChannelPartnerCollaborationFailure[],
) {
  if (!item.id || !item.scenario || !item.actor || !item.request || !item.expect) {
    failures.push({ caseId: item.id ?? "__unknown__", reason: "case_missing_required_fields" });
    return;
  }

  if (item.expect.outcome === "allowed") {
    counters.allowedCaseCount += 1;
  } else if (item.expect.outcome === "rejected") {
    counters.rejectedCaseCount += 1;
  } else {
    failures.push({ caseId: item.id, reason: `unknown_outcome:${String(item.expect.outcome)}` });
  }

  if (!Array.isArray(item.expect.reasonCodes) || item.expect.reasonCodes.length === 0) {
    failures.push({ caseId: item.id, reason: "case_missing_reason_codes" });
  } else {
    for (const code of item.expect.reasonCodes) {
      if (!isKnownChannelPartnerReasonCode(code)) {
        failures.push({
          caseId: item.id,
          reason: `unknown_reason_code:${code}`,
        });
      }
    }
  }

  const flags = mergeIncidentFlags(
    item.expect.flags ?? {},
    deriveIncidentFlags(item),
  );
  if (flags.unauthorizedAccess) counters.unauthorizedAccessCount += 1;
  if (flags.outboundSendIncident) counters.outboundSendIncidentCount += 1;
  if (flags.disclosureMissing) counters.disclosureMissingCount += 1;
  if (flags.attributionUniquenessViolation) counters.attributionUniquenessViolations += 1;
  if (flags.partnerDataLeakedToCustomerWorkspace) counters.partnerDataLeakedToCustomerWorkspaceCount += 1;
  if (flags.customerDataRawLeakedToPartner) counters.customerDataRawLeakedToPartnerCount += 1;
  if (flags.directRecommendationCreationByPartner) counters.directRecommendationCreationByPartnerCount += 1;
  if (flags.askHelmAccessByPartner) counters.askHelmAccessByPartnerCount += 1;
  if (flags.crossTenantHelperLeak) counters.crossTenantHelperLeakCount += 1;
  if (flags.directSourceTableRead) counters.directSourceTableReadCount += 1;
  if (flags.missingGrantAccepted) counters.missingGrantAcceptedCount += 1;
  if (flags.unauthorizedNudgeAcceptance) counters.unauthorizedNudgeAcceptanceCount += 1;
  if (flags.schemaRuntimeApiUiIncident) counters.schemaRuntimeApiUiIncidentCount += 1;
  if (flags.partnerWorkspaceRuntimeIncident) counters.partnerWorkspaceRuntimeIncidentCount += 1;

  const coverage = item.expect.coverage ?? {};
  if (coverage.nudgeLifecycle) counters.nudgeLifecycleCoverageCount += 1;
  if (coverage.revocation) counters.revocationCoverageCount += 1;
  if (coverage.attributionLedgerAnchor) counters.attributionLedgerAnchorCoverageCount += 1;
  if (coverage.partnerSafeDto) counters.partnerSafeDtoCoverageCount += 1;
}

function mergeIncidentFlags(
  explicit: ChannelPartnerCollaborationIncidentFlags,
  derived: ChannelPartnerCollaborationIncidentFlags,
): ChannelPartnerCollaborationIncidentFlags {
  return {
    unauthorizedAccess: explicit.unauthorizedAccess || derived.unauthorizedAccess,
    outboundSendIncident: explicit.outboundSendIncident || derived.outboundSendIncident,
    disclosureMissing: explicit.disclosureMissing || derived.disclosureMissing,
    attributionUniquenessViolation:
      explicit.attributionUniquenessViolation || derived.attributionUniquenessViolation,
    partnerDataLeakedToCustomerWorkspace:
      explicit.partnerDataLeakedToCustomerWorkspace ||
      derived.partnerDataLeakedToCustomerWorkspace,
    customerDataRawLeakedToPartner:
      explicit.customerDataRawLeakedToPartner || derived.customerDataRawLeakedToPartner,
    directRecommendationCreationByPartner:
      explicit.directRecommendationCreationByPartner ||
      derived.directRecommendationCreationByPartner,
    askHelmAccessByPartner:
      explicit.askHelmAccessByPartner || derived.askHelmAccessByPartner,
    crossTenantHelperLeak:
      explicit.crossTenantHelperLeak || derived.crossTenantHelperLeak,
    directSourceTableRead:
      explicit.directSourceTableRead || derived.directSourceTableRead,
    missingGrantAccepted:
      explicit.missingGrantAccepted || derived.missingGrantAccepted,
    unauthorizedNudgeAcceptance:
      explicit.unauthorizedNudgeAcceptance || derived.unauthorizedNudgeAcceptance,
    schemaRuntimeApiUiIncident:
      explicit.schemaRuntimeApiUiIncident || derived.schemaRuntimeApiUiIncident,
    partnerWorkspaceRuntimeIncident:
      explicit.partnerWorkspaceRuntimeIncident || derived.partnerWorkspaceRuntimeIncident,
  };
}

function deriveIncidentFlags(
  item: ChannelPartnerCollaborationCase,
): ChannelPartnerCollaborationIncidentFlags {
  const flags: ChannelPartnerCollaborationIncidentFlags = {};
  const allowed = item.expect.outcome === "allowed";

  if (allowed && isPartnerScopedReadOrWrite(item) && !hasActiveGrant(item)) {
    flags.unauthorizedAccess = true;
    flags.missingGrantAccepted = true;
  }

  if (allowed && item.request === "read_source_table") {
    flags.directSourceTableRead = true;
    flags.customerDataRawLeakedToPartner = true;
  }

  if (allowed && item.request === "ask_helm_invocation") {
    flags.askHelmAccessByPartner = true;
    flags.customerDataRawLeakedToPartner = true;
  }

  if (allowed && item.request === "outbound_send") {
    flags.outboundSendIncident = true;
  }

  if (allowed && item.request === "create_recommendation_direct") {
    flags.directRecommendationCreationByPartner = true;
  }

  if (allowed && item.request === "cross_tenant_helper") {
    flags.crossTenantHelperLeak = true;
  }

  if (
    allowed &&
    (item.request === "accept_nudge" || item.request === "promote_nudge") &&
    !isAuthorizedCustomerActor(item.actor)
  ) {
    flags.unauthorizedNudgeAcceptance = true;
    flags.unauthorizedAccess = true;
  }

  if (
    allowed &&
    item.request === "portfolio_readout" &&
    (item.portfolioReadout?.rawCustomerNameLeaked ||
      item.portfolioReadout?.exactAmountLeaked ||
      item.portfolioReadout?.rawWorkspaceUrlLeaked ||
      item.portfolioReadout?.workspaceSlugLeaked)
  ) {
    flags.customerDataRawLeakedToPartner = true;
  }

  if (item.p2Candidate?.runtimeSuspendExecuted) {
    flags.partnerWorkspaceRuntimeIncident = true;
  }

  return flags;
}

function isPartnerScopedReadOrWrite(item: ChannelPartnerCollaborationCase): boolean {
  if (item.actor !== "partner") {
    return false;
  }
  return [
    "read_partner_safe_dto",
    "read_source_table",
    "ask_helm_invocation",
    "outbound_send",
    "create_recommendation_direct",
    "submit_nudge",
    "portfolio_readout",
    "cross_tenant_helper",
  ].includes(item.request);
}

function hasActiveGrant(item: ChannelPartnerCollaborationCase): boolean {
  return item.grant?.present === true && item.grant.status === "active";
}

function isAuthorizedCustomerActor(actor: ChannelPartnerCollaborationActor): boolean {
  return actor === "customer_admin" ||
    actor === "customer_operator" ||
    actor === "customer_champion";
}

function assertMetadataMarkers(
  fixturePack: ChannelPartnerCollaborationFixturePack,
  failures: ChannelPartnerCollaborationFailure[],
) {
  if (fixturePack.status !== REQUIRED_METADATA_MARKERS.status) {
    failures.push({
      caseId: "__metadata__",
      reason: `metadata_status_must_be_offline_evaluation_fixture:got=${fixturePack.status}`,
    });
  }
  if (!fixturePack.redactionPosture.includes(REQUIRED_METADATA_MARKERS.redactionPosture)) {
    failures.push({
      caseId: "__metadata__",
      reason: `metadata_redaction_posture_must_be_alias_only:got=${fixturePack.redactionPosture}`,
    });
  }
  if (!fixturePack.boundary.includes(REQUIRED_METADATA_MARKERS.boundary)) {
    failures.push({
      caseId: "__metadata__",
      reason: `metadata_boundary_must_be_p0_offline_only:got=${fixturePack.boundary}`,
    });
  }
  if (fixturePack.scope !== REQUIRED_METADATA_MARKERS.scope) {
    failures.push({
      caseId: "__metadata__",
      reason: `metadata_scope_must_be_P0-REQ-08:got=${fixturePack.scope}`,
    });
  }
}

function assertNoRuntimeDriftInFixture(
  fixturePack: ChannelPartnerCollaborationFixturePack,
  failures: ChannelPartnerCollaborationFailure[],
) {
  const serialized = JSON.stringify(fixturePack);
  for (const forbidden of FORBIDDEN_RUNTIME_SUBSTRINGS) {
    if (serialized.includes(forbidden)) {
      failures.push({
        caseId: "__fixture__",
        reason: `fixture_contains_forbidden_runtime_substring:${forbidden}`,
      });
    }
  }
  for (const forbidden of FORBIDDEN_RAW_FIELD_SUBSTRINGS) {
    if (serialized.includes(forbidden)) {
      failures.push({
        caseId: "__fixture__",
        reason: `fixture_contains_forbidden_raw_field_substring:${forbidden}`,
      });
    }
  }
}

function pushSummaryFailureIf(
  failures: ChannelPartnerCollaborationFailure[],
  failed: boolean,
  reason: string,
) {
  if (failed) {
    failures.push({ caseId: "__summary__", reason });
  }
}
