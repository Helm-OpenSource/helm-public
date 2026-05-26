import fixturePack from "@/evals/implementation-health/implementation-health-cases.json";

export const IMPLEMENTATION_HEALTH_STATES = [
  "healthy",
  "watch",
  "degraded",
  "blocked",
  "not_applicable",
] as const;

export const IMPLEMENTATION_HEALTH_REASON_CODES = [
  "tenant_not_active",
  "extension_not_ready",
  "connector_not_enabled",
  "source_unavailable",
  "no_active_user",
  "role_definition_not_accepted",
  "owner_unmapped",
  "supervisor_unmapped",
  "owner_not_active",
  "notification_target_missing",
  "notification_unread_streak",
  "default_target_fallback_forbidden",
  "review_queue_backlog",
  "missing_reviewer",
  "missing_evidence",
  "execution_receipt_missing",
  "follow_through_evidence_missing",
  "follow_through_evidence_unknown",
  "not_in_tenant_scope",
  "raw_data_forbidden",
  "actor_aggregation_forbidden",
  "causal_claim_forbidden",
  "dynamic_reason_code_forbidden",
  "auto_execution_forbidden",
] as const;

const IMPLEMENTATION_HEALTH_NODES = [
  "tenant_activation",
  "active_helm_users",
  "owner_and_supervisor_mapping",
  "notification_targeting",
  "signal_to_review_flow",
  "execution_to_follow_through_evidence",
] as const;

const REVIEW_OWNER_PRIORITY = [
  "tenant_activation",
  "owner_and_supervisor_mapping",
  "notification_targeting",
  "signal_to_review_flow",
  "execution_to_follow_through_evidence",
  "active_helm_users",
] as const;

const STATE_SEVERITY: Record<ImplementationHealthState, number> = {
  healthy: 0,
  not_applicable: 0,
  watch: 1,
  degraded: 2,
  blocked: 3,
};

const REVIEW_OWNER_BY_NODE: Record<ImplementationHealthNode, string> = {
  tenant_activation: "platform_operator",
  active_helm_users: "customer_success_lead",
  owner_and_supervisor_mapping: "implementation_lead",
  notification_targeting: "implementation_lead",
  signal_to_review_flow: "review_lead",
  execution_to_follow_through_evidence: "implementation_lead",
};

const NOT_APPLICABLE_REASON_CODES = new Set<ImplementationHealthReasonCode>([
  "not_in_tenant_scope",
  "connector_not_enabled",
  "source_unavailable",
]);

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
  "AuditLog.payload",
  "AuditLog.summary",
  "meetingTranscript",
  "rawPrompt",
  "rawOutput",
] as const;

const KNOWN_PRIVATE_SLUG_PATTERN = new RegExp(
  `\\b(?:${[
    ["gua", "ngpu"].join(""),
    ["mi", "dun"].join(""),
    ["zhao", "jiling"].join(""),
  ].join("|")})\\b`,
  "i",
);

const REAL_PERSON_OR_CONTACT_PATTERNS: Array<[string, RegExp]> = [
  ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["private_path", /\/Users\//],
  ["known_private_slug", KNOWN_PRIVATE_SLUG_PATTERN],
];

export type ImplementationHealthState = (typeof IMPLEMENTATION_HEALTH_STATES)[number];
export type ImplementationHealthReasonCode = (typeof IMPLEMENTATION_HEALTH_REASON_CODES)[number];
export type ImplementationHealthNode = (typeof IMPLEMENTATION_HEALTH_NODES)[number];
export type ImplementationHealthOutcome = "accepted" | "rejected";

export type ImplementationHealthIncidentFlags = {
  rawDataLeak?: boolean;
  realPersonNameLeak?: boolean;
  hrPerformanceClaim?: boolean;
  autoExecutionAttempt?: boolean;
  autoNotificationAttempt?: boolean;
  causalClaim?: boolean;
  crossTenantOriginalTextAccess?: boolean;
  actorAggregationAttempt?: boolean;
  dynamicReasonCode?: boolean;
  tenantConfigWriteAttempt?: boolean;
  defaultFallbackOwnerAssignment?: boolean;
};

export type ImplementationHealthCoverageFlags = {
  snapshot?: boolean;
  actionTrail?: boolean;
  reviewItem?: boolean;
  followThroughLedger?: boolean;
};

export type ImplementationHealthExpectation = {
  outcome: ImplementationHealthOutcome;
  reasonCodes: string[];
  flags?: ImplementationHealthIncidentFlags;
  coverage?: ImplementationHealthCoverageFlags;
};

export type ImplementationHealthNodeState = {
  node: ImplementationHealthNode;
  state: ImplementationHealthState;
  reasonCodes: string[];
  windowKey: string;
  evidenceRefs: string[];
};

export type ImplementationHealthSnapshot = {
  tenantAlias: string;
  windowStart: string;
  windowEnd: string;
  overallState: ImplementationHealthState;
  nodeStates: ImplementationHealthNodeState[];
  topBlockerReasonCodes: string[];
  recommendedReviewOwnerRole: string | null;
  lastReviewDecisionRef: string | null;
  boundaryNote: string;
};

export type ImplementerActionTrailEntry = {
  actorRole: string;
  actionType: string;
  workItemRef: string;
  reviewDecisionRef: string;
  evidenceRef: string;
  createdAt: string;
  boundaryNote: string;
};

export type ImplementerActionTrail = {
  actionTrailId: string;
  tenantAlias: string;
  sourceWindowKey: string;
  entries: ImplementerActionTrailEntry[];
};

export type FollowThroughEvidenceReviewItem = {
  reviewItemId: string;
  reviewOwnerRole: string;
  posture: string;
  reasonCodes: string[];
  noAutoExecution: boolean;
  boundaryNote: string;
};

export type FollowThroughEvidenceLedger = {
  sourceReviewDecisionRef: string;
  executionReceiptState: "present" | "missing" | "not_applicable";
  comparisonWindow: string;
  nextDaySignalState: "present" | "missing" | "insufficient_window" | "source_unavailable";
  direction: "positive_follow_through" | "flat_follow_through" | "negative_follow_through" | "unknown";
  confidencePosture: "evidence_sufficient" | "evidence_partial" | "evidence_missing";
  humanReviewRequired: boolean;
  causalClaimAllowed: boolean;
  boundaryNote: string;
};

export type ImplementationHealthCase = {
  id: string;
  scenario: string;
  description: string;
  snapshot?: ImplementationHealthSnapshot;
  snapshotRef?: string;
  request?: string;
  actionTrail?: ImplementerActionTrail;
  actorAggregationRequest?: {
    requested: boolean;
    scope: string;
    outcome: ImplementationHealthOutcome;
  };
  requestedReasonCodeAlias?: string;
  reviewItem?: FollowThroughEvidenceReviewItem;
  followThroughLedger?: FollowThroughEvidenceLedger;
  expect: ImplementationHealthExpectation;
  [key: string]: unknown;
};

export type ImplementationHealthTargets = {
  minimumTotalCases: number;
  minimumHealthyCaseCount: number;
  minimumBlockedCaseCount: number;
  minimumWatchCaseCount: number;
  minimumDegradedCaseCount: number;
  minimumNotApplicableCaseCount: number;
  maximumRawDataLeakCount: number;
  maximumRealPersonNameLeakCount: number;
  maximumHrPerformanceClaimCount: number;
  maximumAutoExecutionAttemptCount: number;
  maximumAutoNotificationAttemptCount: number;
  maximumCausalClaimCount: number;
  maximumCrossTenantOriginalTextAccessCount: number;
  maximumActorAggregationAttemptCount: number;
  maximumDynamicReasonCodeCount: number;
  maximumTenantConfigWriteAttemptCount: number;
  maximumDefaultFallbackOwnerAssignmentCount: number;
  maximumReasonCodeUnknownCount: number;
};

export type ImplementationHealthFixturePack = {
  version: string;
  status: string;
  redactionPosture: string;
  boundary: string;
  sourceDoc: string;
  scope: string;
  notes: string[];
  targets: ImplementationHealthTargets;
  cases: ImplementationHealthCase[];
};

export type ImplementationHealthFailure = {
  caseId: string;
  reason: string;
};

export type ImplementationHealthSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  acceptedCaseCount: number;
  rejectedCaseCount: number;
  healthyCaseCount: number;
  blockedCaseCount: number;
  watchCaseCount: number;
  degradedCaseCount: number;
  notApplicableCaseCount: number;
  snapshotCoverageCount: number;
  actionTrailCoverageCount: number;
  reviewItemCoverageCount: number;
  followThroughLedgerCoverageCount: number;
  preventedBoundaryAttemptCount: number;
  rawDataLeakCount: number;
  realPersonNameLeakCount: number;
  hrPerformanceClaimCount: number;
  autoExecutionAttemptCount: number;
  autoNotificationAttemptCount: number;
  causalClaimCount: number;
  crossTenantOriginalTextAccessCount: number;
  actorAggregationAttemptCount: number;
  dynamicReasonCodeCount: number;
  tenantConfigWriteAttemptCount: number;
  defaultFallbackOwnerAssignmentCount: number;
  reasonCodeUnknownCount: number;
  failures: ImplementationHealthFailure[];
};

type Counters = Omit<ImplementationHealthSummary, "passed" | "version" | "totalCases" | "failures">;

export function runImplementationHealthEval(
  pack: ImplementationHealthFixturePack =
    fixturePack as ImplementationHealthFixturePack,
): ImplementationHealthSummary {
  const failures: ImplementationHealthFailure[] = [];
  const counters = newCounters();

  assertMetadataMarkers(pack, failures);
  assertNoRuntimeOrRawDrift(pack, failures);

  for (const item of pack.cases) {
    accumulateCase(item, counters, failures);
  }

  pushSummaryFailureIf(
    failures,
    pack.cases.length < pack.targets.minimumTotalCases,
    `total_cases_below_minimum:${pack.cases.length}`,
  );
  assertCounterLimit(
    failures,
    counters.healthyCaseCount < pack.targets.minimumHealthyCaseCount,
    `healthy_case_count_below_minimum:${counters.healthyCaseCount}`,
  );
  assertCounterLimit(
    failures,
    counters.blockedCaseCount < pack.targets.minimumBlockedCaseCount,
    `blocked_case_count_below_minimum:${counters.blockedCaseCount}`,
  );
  assertCounterLimit(
    failures,
    counters.watchCaseCount < pack.targets.minimumWatchCaseCount,
    `watch_case_count_below_minimum:${counters.watchCaseCount}`,
  );
  assertCounterLimit(
    failures,
    counters.degradedCaseCount < pack.targets.minimumDegradedCaseCount,
    `degraded_case_count_below_minimum:${counters.degradedCaseCount}`,
  );
  assertCounterLimit(
    failures,
    counters.notApplicableCaseCount < pack.targets.minimumNotApplicableCaseCount,
    `not_applicable_case_count_below_minimum:${counters.notApplicableCaseCount}`,
  );

  assertCounterLimit(
    failures,
    counters.rawDataLeakCount > pack.targets.maximumRawDataLeakCount,
    `raw_data_leak_count_exceeds:${counters.rawDataLeakCount}`,
  );
  assertCounterLimit(
    failures,
    counters.realPersonNameLeakCount > pack.targets.maximumRealPersonNameLeakCount,
    `real_person_name_leak_count_exceeds:${counters.realPersonNameLeakCount}`,
  );
  assertCounterLimit(
    failures,
    counters.hrPerformanceClaimCount > pack.targets.maximumHrPerformanceClaimCount,
    `hr_performance_claim_count_exceeds:${counters.hrPerformanceClaimCount}`,
  );
  assertCounterLimit(
    failures,
    counters.autoExecutionAttemptCount > pack.targets.maximumAutoExecutionAttemptCount,
    `auto_execution_attempt_count_exceeds:${counters.autoExecutionAttemptCount}`,
  );
  assertCounterLimit(
    failures,
    counters.autoNotificationAttemptCount > pack.targets.maximumAutoNotificationAttemptCount,
    `auto_notification_attempt_count_exceeds:${counters.autoNotificationAttemptCount}`,
  );
  assertCounterLimit(
    failures,
    counters.causalClaimCount > pack.targets.maximumCausalClaimCount,
    `causal_claim_count_exceeds:${counters.causalClaimCount}`,
  );
  assertCounterLimit(
    failures,
    counters.crossTenantOriginalTextAccessCount >
      pack.targets.maximumCrossTenantOriginalTextAccessCount,
    `cross_tenant_original_text_access_count_exceeds:${counters.crossTenantOriginalTextAccessCount}`,
  );
  assertCounterLimit(
    failures,
    counters.actorAggregationAttemptCount > pack.targets.maximumActorAggregationAttemptCount,
    `actor_aggregation_attempt_count_exceeds:${counters.actorAggregationAttemptCount}`,
  );
  assertCounterLimit(
    failures,
    counters.dynamicReasonCodeCount > pack.targets.maximumDynamicReasonCodeCount,
    `dynamic_reason_code_count_exceeds:${counters.dynamicReasonCodeCount}`,
  );
  assertCounterLimit(
    failures,
    counters.tenantConfigWriteAttemptCount > pack.targets.maximumTenantConfigWriteAttemptCount,
    `tenant_config_write_attempt_count_exceeds:${counters.tenantConfigWriteAttemptCount}`,
  );
  assertCounterLimit(
    failures,
    counters.defaultFallbackOwnerAssignmentCount >
      pack.targets.maximumDefaultFallbackOwnerAssignmentCount,
    `default_fallback_owner_assignment_count_exceeds:${counters.defaultFallbackOwnerAssignmentCount}`,
  );
  assertCounterLimit(
    failures,
    counters.reasonCodeUnknownCount > pack.targets.maximumReasonCodeUnknownCount,
    `reason_code_unknown_count_exceeds:${counters.reasonCodeUnknownCount}`,
  );

  return {
    passed: failures.length === 0,
    version: pack.version,
    totalCases: pack.cases.length,
    ...counters,
    failures,
  };
}

function newCounters(): Counters {
  return {
    acceptedCaseCount: 0,
    rejectedCaseCount: 0,
    healthyCaseCount: 0,
    blockedCaseCount: 0,
    watchCaseCount: 0,
    degradedCaseCount: 0,
    notApplicableCaseCount: 0,
    snapshotCoverageCount: 0,
    actionTrailCoverageCount: 0,
    reviewItemCoverageCount: 0,
    followThroughLedgerCoverageCount: 0,
    preventedBoundaryAttemptCount: 0,
    rawDataLeakCount: 0,
    realPersonNameLeakCount: 0,
    hrPerformanceClaimCount: 0,
    autoExecutionAttemptCount: 0,
    autoNotificationAttemptCount: 0,
    causalClaimCount: 0,
    crossTenantOriginalTextAccessCount: 0,
    actorAggregationAttemptCount: 0,
    dynamicReasonCodeCount: 0,
    tenantConfigWriteAttemptCount: 0,
    defaultFallbackOwnerAssignmentCount: 0,
    reasonCodeUnknownCount: 0,
  };
}

function accumulateCase(
  item: ImplementationHealthCase,
  counters: Counters,
  failures: ImplementationHealthFailure[],
) {
  if (!item.id || !item.scenario || !item.expect) {
    failures.push({ caseId: item.id ?? "__unknown__", reason: "case_missing_required_fields" });
    return;
  }

  if (item.expect.outcome === "accepted") {
    counters.acceptedCaseCount += 1;
  } else if (item.expect.outcome === "rejected") {
    counters.rejectedCaseCount += 1;
  } else {
    failures.push({ caseId: item.id, reason: `unknown_outcome:${String(item.expect.outcome)}` });
  }

  assertKnownReasonCodes(item.id, item.expect.reasonCodes, counters, failures);

  if (item.snapshot) {
    counters.snapshotCoverageCount += 1;
    accumulateSnapshot(item, counters, failures);
  }

  if (item.actionTrail) {
    counters.actionTrailCoverageCount += 1;
    assertActionTrail(item, failures);
  }

  if (item.reviewItem) {
    counters.reviewItemCoverageCount += 1;
    assertKnownReasonCodes(item.id, item.reviewItem.reasonCodes, counters, failures);
    if (!item.reviewItem.noAutoExecution) {
      failures.push({ caseId: item.id, reason: "review_item_missing_no_auto_execution_flag" });
    }
  }

  if (item.followThroughLedger) {
    counters.followThroughLedgerCoverageCount += 1;
    assertFollowThroughLedger(item, failures);
  }

  const flags = mergeIncidentFlags(item.expect.flags ?? {}, deriveIncidentFlags(item));
  const hasBoundaryAttempt = Object.values(flags).some(Boolean);
  if (item.expect.outcome === "rejected" && hasBoundaryAttempt) {
    counters.preventedBoundaryAttemptCount += 1;
  }

  if (item.expect.outcome === "accepted") {
    if (flags.rawDataLeak) counters.rawDataLeakCount += 1;
    if (flags.realPersonNameLeak) counters.realPersonNameLeakCount += 1;
    if (flags.hrPerformanceClaim) counters.hrPerformanceClaimCount += 1;
    if (flags.autoExecutionAttempt) counters.autoExecutionAttemptCount += 1;
    if (flags.autoNotificationAttempt) counters.autoNotificationAttemptCount += 1;
    if (flags.causalClaim) counters.causalClaimCount += 1;
    if (flags.crossTenantOriginalTextAccess) counters.crossTenantOriginalTextAccessCount += 1;
    if (flags.actorAggregationAttempt) counters.actorAggregationAttemptCount += 1;
    if (flags.dynamicReasonCode) counters.dynamicReasonCodeCount += 1;
    if (flags.tenantConfigWriteAttempt) counters.tenantConfigWriteAttemptCount += 1;
    if (flags.defaultFallbackOwnerAssignment) counters.defaultFallbackOwnerAssignmentCount += 1;
  }
}

function accumulateSnapshot(
  item: ImplementationHealthCase,
  counters: Counters,
  failures: ImplementationHealthFailure[],
) {
  const snapshot = item.snapshot;
  if (!snapshot) return;

  if (snapshot.overallState === "healthy") counters.healthyCaseCount += 1;
  if (snapshot.overallState === "blocked") counters.blockedCaseCount += 1;
  if (snapshot.overallState === "watch") counters.watchCaseCount += 1;
  if (snapshot.overallState === "degraded") counters.degradedCaseCount += 1;
  if (snapshot.nodeStates.some((nodeState) => nodeState.state === "not_applicable")) {
    counters.notApplicableCaseCount += 1;
  }

  assertSnapshotShape(item, failures);

  const derivedOverallState = deriveOverallState(snapshot.nodeStates);
  if (derivedOverallState !== snapshot.overallState) {
    failures.push({
      caseId: item.id,
      reason: `overall_state_mismatch:expected=${derivedOverallState}:got=${snapshot.overallState}`,
    });
  }

  const derivedTopBlockers = deriveTopBlockerReasonCodes(snapshot.nodeStates);
  if (snapshot.topBlockerReasonCodes.length > 3) {
    failures.push({ caseId: item.id, reason: "top_blocker_reason_codes_exceeds_three" });
  }
  if (snapshot.topBlockerReasonCodes.join("|") !== derivedTopBlockers.join("|")) {
    failures.push({
      caseId: item.id,
      reason: `top_blocker_reason_codes_mismatch:expected=${derivedTopBlockers.join(",")}:got=${snapshot.topBlockerReasonCodes.join(",")}`,
    });
  }

  const derivedOwnerRole = deriveRecommendedReviewOwnerRole(snapshot.nodeStates);
  if (snapshot.recommendedReviewOwnerRole !== derivedOwnerRole) {
    failures.push({
      caseId: item.id,
      reason: `recommended_review_owner_role_mismatch:expected=${String(derivedOwnerRole)}:got=${String(snapshot.recommendedReviewOwnerRole)}`,
    });
  }

  for (const nodeState of snapshot.nodeStates) {
    assertKnownReasonCodes(item.id, nodeState.reasonCodes, counters, failures);
    if (nodeState.state !== "healthy" && nodeState.reasonCodes.length === 0) {
      failures.push({ caseId: item.id, reason: `node_missing_reason_codes:${nodeState.node}` });
    }
    if (
      nodeState.state === "not_applicable" &&
      !nodeState.reasonCodes.some((reasonCode) =>
        NOT_APPLICABLE_REASON_CODES.has(reasonCode as ImplementationHealthReasonCode),
      )
    ) {
      failures.push({
        caseId: item.id,
        reason: `not_applicable_missing_scope_reason:${nodeState.node}`,
      });
    }
  }
}

function assertSnapshotShape(
  item: ImplementationHealthCase,
  failures: ImplementationHealthFailure[],
) {
  const snapshot = item.snapshot;
  if (!snapshot) return;

  if (!snapshot.tenantAlias.startsWith("tenant-")) {
    failures.push({ caseId: item.id, reason: "tenant_alias_must_be_synthetic" });
  }
  if (!snapshot.boundaryNote || !/no automatic|read-only|review/i.test(snapshot.boundaryNote)) {
    failures.push({ caseId: item.id, reason: "snapshot_boundary_note_missing_review_only_posture" });
  }

  const presentNodes = new Set(snapshot.nodeStates.map((nodeState) => nodeState.node));
  for (const requiredNode of IMPLEMENTATION_HEALTH_NODES) {
    if (!presentNodes.has(requiredNode)) {
      failures.push({ caseId: item.id, reason: `snapshot_missing_node:${requiredNode}` });
    }
  }
  if (snapshot.nodeStates.length !== IMPLEMENTATION_HEALTH_NODES.length) {
    failures.push({
      caseId: item.id,
      reason: `snapshot_node_count_mismatch:${snapshot.nodeStates.length}`,
    });
  }
}

function assertActionTrail(
  item: ImplementationHealthCase,
  failures: ImplementationHealthFailure[],
) {
  const trail = item.actionTrail;
  if (!trail) return;

  if (!trail.tenantAlias.startsWith("tenant-")) {
    failures.push({ caseId: item.id, reason: "action_trail_tenant_alias_must_be_synthetic" });
  }
  for (const entry of trail.entries) {
    if (/\b(score|rank|performanceRating|penalty|blame)\b/i.test(JSON.stringify(entry))) {
      failures.push({ caseId: item.id, reason: "action_trail_contains_hr_scoring_field" });
    }
    if (!entry.actorRole || !entry.boundaryNote) {
      failures.push({ caseId: item.id, reason: "action_trail_entry_missing_actor_role_or_boundary" });
    }
  }
}

function assertFollowThroughLedger(
  item: ImplementationHealthCase,
  failures: ImplementationHealthFailure[],
) {
  const ledger = item.followThroughLedger;
  if (!ledger) return;

  if (ledger.causalClaimAllowed) {
    failures.push({ caseId: item.id, reason: "follow_through_ledger_causal_claim_allowed" });
  }
  if (ledger.executionReceiptState === "missing" && ledger.direction === "positive_follow_through") {
    failures.push({ caseId: item.id, reason: "missing_execution_receipt_positive_follow_through" });
  }
  if (
    ["missing", "insufficient_window", "source_unavailable"].includes(ledger.nextDaySignalState) &&
    ledger.direction !== "unknown"
  ) {
    failures.push({ caseId: item.id, reason: "missing_next_day_signal_must_be_unknown" });
  }
  if (!/no causal|temporal|no improvement claim|no claim/i.test(ledger.boundaryNote)) {
    failures.push({ caseId: item.id, reason: "follow_through_boundary_note_missing_non_causality" });
  }
}

function deriveOverallState(
  nodeStates: ImplementationHealthNodeState[],
): ImplementationHealthState {
  const applicableNodes = nodeStates.filter((nodeState) => nodeState.state !== "not_applicable");
  if (applicableNodes.length === 0) return "blocked";
  if (applicableNodes.some((nodeState) => nodeState.state === "blocked")) return "blocked";

  const degradedCount = applicableNodes.filter((nodeState) => nodeState.state === "degraded").length;
  const watchCount = applicableNodes.filter((nodeState) => nodeState.state === "watch").length;

  if (degradedCount >= 2) return "degraded";
  if (degradedCount === 1 || watchCount >= 2) return "watch";
  if (applicableNodes.every((nodeState) => nodeState.state === "healthy")) return "healthy";
  return "watch";
}

function deriveTopBlockerReasonCodes(
  nodeStates: ImplementationHealthNodeState[],
): string[] {
  const byNode = new Map(nodeStates.map((nodeState) => [nodeState.node, nodeState]));
  const reasonCodes: string[] = [];
  for (const node of IMPLEMENTATION_HEALTH_NODES) {
    const nodeState = byNode.get(node);
    if (!nodeState || STATE_SEVERITY[nodeState.state] === 0) continue;
    reasonCodes.push(...nodeState.reasonCodes);
  }
  return reasonCodes.slice(0, 3);
}

function deriveRecommendedReviewOwnerRole(
  nodeStates: ImplementationHealthNodeState[],
): string | null {
  const maxSeverity = Math.max(...nodeStates.map((nodeState) => STATE_SEVERITY[nodeState.state]));
  if (maxSeverity === 0) return null;

  const byNode = new Map(nodeStates.map((nodeState) => [nodeState.node, nodeState]));
  for (const node of REVIEW_OWNER_PRIORITY) {
    const nodeState = byNode.get(node);
    if (nodeState && STATE_SEVERITY[nodeState.state] === maxSeverity) {
      return REVIEW_OWNER_BY_NODE[node];
    }
  }
  return null;
}

function assertMetadataMarkers(
  pack: ImplementationHealthFixturePack,
  failures: ImplementationHealthFailure[],
) {
  if (pack.status !== "offline_evaluation_fixture") {
    failures.push({ caseId: "__metadata__", reason: `metadata_status_invalid:${pack.status}` });
  }
  if (!pack.redactionPosture.includes("alias_only")) {
    failures.push({
      caseId: "__metadata__",
      reason: `metadata_redaction_posture_must_be_alias_only:${pack.redactionPosture}`,
    });
  }
  if (!pack.boundary.includes("p0_offline_only")) {
    failures.push({ caseId: "__metadata__", reason: `metadata_boundary_must_be_p0:${pack.boundary}` });
  }
  if (pack.scope !== "P0-REQ-06") {
    failures.push({ caseId: "__metadata__", reason: `metadata_scope_must_be_P0-REQ-06:${pack.scope}` });
  }
}

function assertNoRuntimeOrRawDrift(
  pack: ImplementationHealthFixturePack,
  failures: ImplementationHealthFailure[],
) {
  const serialized = JSON.stringify(pack);
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
  for (const [label, pattern] of REAL_PERSON_OR_CONTACT_PATTERNS) {
    if (pattern.test(serialized)) {
      failures.push({
        caseId: "__fixture__",
        reason: `fixture_contains_forbidden_identity_pattern:${label}`,
      });
    }
  }
}

function assertKnownReasonCodes(
  caseId: string,
  reasonCodes: string[] | undefined,
  counters: Counters,
  failures: ImplementationHealthFailure[],
) {
  if (!reasonCodes) return;
  for (const reasonCode of reasonCodes) {
    if (!isKnownImplementationHealthReasonCode(reasonCode)) {
      counters.reasonCodeUnknownCount += 1;
      failures.push({ caseId, reason: `unknown_reason_code:${reasonCode}` });
    }
  }
}

function isKnownImplementationHealthReasonCode(
  value: string,
): value is ImplementationHealthReasonCode {
  return (IMPLEMENTATION_HEALTH_REASON_CODES as readonly string[]).includes(value);
}

function mergeIncidentFlags(
  explicit: ImplementationHealthIncidentFlags,
  derived: ImplementationHealthIncidentFlags,
): ImplementationHealthIncidentFlags {
  return {
    rawDataLeak: explicit.rawDataLeak || derived.rawDataLeak,
    realPersonNameLeak: explicit.realPersonNameLeak || derived.realPersonNameLeak,
    hrPerformanceClaim: explicit.hrPerformanceClaim || derived.hrPerformanceClaim,
    autoExecutionAttempt: explicit.autoExecutionAttempt || derived.autoExecutionAttempt,
    autoNotificationAttempt: explicit.autoNotificationAttempt || derived.autoNotificationAttempt,
    causalClaim: explicit.causalClaim || derived.causalClaim,
    crossTenantOriginalTextAccess:
      explicit.crossTenantOriginalTextAccess || derived.crossTenantOriginalTextAccess,
    actorAggregationAttempt:
      explicit.actorAggregationAttempt || derived.actorAggregationAttempt,
    dynamicReasonCode: explicit.dynamicReasonCode || derived.dynamicReasonCode,
    tenantConfigWriteAttempt:
      explicit.tenantConfigWriteAttempt || derived.tenantConfigWriteAttempt,
    defaultFallbackOwnerAssignment:
      explicit.defaultFallbackOwnerAssignment || derived.defaultFallbackOwnerAssignment,
  };
}

function deriveIncidentFlags(item: ImplementationHealthCase): ImplementationHealthIncidentFlags {
  const flags: ImplementationHealthIncidentFlags = {};
  const accepted = item.expect.outcome === "accepted";
  if (!accepted) return flags;

  if (item.request === "include_raw_customer_text") {
    flags.rawDataLeak = true;
    flags.crossTenantOriginalTextAccess = true;
  }
  if (item.request === "rank_implementer_performance") {
    flags.hrPerformanceClaim = true;
  }
  if (item.request === "publish_causal_roi_claim" || item.followThroughLedger?.causalClaimAllowed) {
    flags.causalClaim = true;
  }
  if (item.request === "aggregate_by_actor" || item.actorAggregationRequest?.requested) {
    flags.actorAggregationAttempt = true;
  }
  if (item.request === "create_dynamic_reason_code" || item.requestedReasonCodeAlias) {
    flags.dynamicReasonCode = true;
  }
  if (item.request === "auto_write_tenant_config_from_review_item") {
    flags.autoExecutionAttempt = true;
    flags.tenantConfigWriteAttempt = true;
  }
  if (item.request === "assign_default_owner_and_auto_notify") {
    flags.autoNotificationAttempt = true;
    flags.defaultFallbackOwnerAssignment = true;
  }

  return flags;
}

function pushSummaryFailureIf(
  failures: ImplementationHealthFailure[],
  failed: boolean,
  reason: string,
) {
  if (failed) {
    failures.push({ caseId: "__summary__", reason });
  }
}

const assertCounterLimit = pushSummaryFailureIf;
