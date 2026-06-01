export type OperatingSignalFamily =
  | "commitment"
  | "advancement"
  | "risk"
  | "pacing"
  | "receipt"
  | "evidence_gap"
  | "boundary_attempt";

export type OperatingSignalState =
  | "DETECTED"
  | "NORMALIZED"
  | "LINKED"
  | "GATED"
  | "JUDGED"
  | "PACKETIZED"
  | "REVIEW_PENDING"
  | "HUMAN_DECIDED"
  | "AWAITING_RECEIPT"
  | "OUTCOME_RECORDED"
  | "LEARNING_CANDIDATE"
  | "UNRESOLVED_SOURCE"
  | "MISSING_EVIDENCE"
  | "MISSING_OWNER"
  | "STALE_SIGNAL"
  | "DUPLICATE_COMPRESSED"
  | "CONTRADICTION_REVIEW"
  | "PERMISSION_BLOCKED"
  | "BOUNDARY_BLOCKED"
  | "REJECTED"
  | "QUARANTINED"
  | "OUTCOME_MISSING"
  | "SUPERSEDED"
  | "REVOKED"
  | "MERGED";

export type OperatingSignalBlocker =
  | "source_down"
  | "stale_source"
  | "missing_evidence"
  | "missing_owner"
  | "object_unlinked"
  | "conflict_detected"
  | "permission_blocked"
  | "boundary_blocked"
  | "review_backlog"
  | "outcome_missing";

export type OperatingSignalDataPosture = "empty" | "fixture" | "degraded" | "current_window";

// Negative-control members such as `llm`, `llm_ranking`, and cross-tenant
// projection are representable only so offline evals can reject them. They do
// not grant runtime authority, final ranking authority, or tenant mixing.
export type OperatingSignalTrigger =
  | "deterministic_rule"
  | "reviewer"
  | "owner"
  | "system_timer"
  | "source_event"
  | "connector"
  | "data_protection"
  | "llm";

export type OperatingSignalFlowEvent = {
  id: string;
  workspaceId: string;
  signalKey: string;
  traceId: string | null;
  previousEventId: string | null;
  causedByEventId: string | null;
  sourceKind: string;
  sourceRef: string;
  signalFamily: OperatingSignalFamily;
  objectRef: string | null;
  objectKind: "Deal" | "Account" | "Contact" | "Meeting" | "Commitment" | "Workspace" | null;
  transitionFrom: OperatingSignalState | null;
  transitionTo: OperatingSignalState;
  triggeredBy: OperatingSignalTrigger;
  ruleId: string | null;
  actorRef: string | null;
  currentBlockerType: OperatingSignalBlocker | null;
  blockerSince: string | null;
  awaitingReceiptSince: string | null;
  evidenceCoverage: { provided: number; required: number };
  confidenceBand: "high" | "medium" | "low" | "mixed" | "unknown";
  confidenceSource: "deterministic" | "explanation" | "llm_ranking";
  redactionStatus: "redacted" | "alias_only" | "synthetic" | "raw_blocked";
  crossTenantProjection: boolean;
  dedupeKey: string | null;
  mergedIntoSignalKey: string | null;
  supersededBySignalKey: string | null;
  revocationReason: "source_retract" | "customer_cancel" | "data_protection" | "boundary" | null;
  boundaryCheckResult: "pass" | "blocked" | "escalated" | "n/a";
  policyVersion: string;
  latencyFromPriorMs: number | null;
  occurredAt: string;
  evidenceRefs: string[];
  reviewerRequired: boolean;
  allowedNextActions: string[];
  forbiddenNextActions: string[];
  boundaryNote: string;
};

export type OperatingSignalFlowNode = {
  id: string;
  workspaceId: string;
  kind:
    | "source"
    | "collector"
    | "gate"
    | "object"
    | "judgement"
    | "review"
    | "action_candidate"
    | "memory_candidate"
    | "outcome"
    | "learning";
  lane: "blocked" | "review_required" | "flowing" | "watch_only_learned";
  label: string;
  status: "healthy" | "degraded" | "blocked" | "review_required" | "watch_only" | "rejected";
  signalCount: number;
  blockedCount: number;
  boundaryIncidentCount: number;
  pendingReviewCount: number;
  signalFamilyMix: Array<{ family: OperatingSignalFamily; count: number }>;
  latestEventAt: string | null;
  lastBlockerAt: string | null;
  staleness: "fresh" | "aging" | "stale";
  connectorPosture: "healthy" | "degraded" | "credential_expired" | "disconnected" | "n/a";
  boundaryNote: string;
};

export type OperatingSignalFlowEdge = {
  id: string;
  workspaceId: string;
  fromNodeId: string;
  toNodeId: string;
  direction: "forward" | "backward";
  signalCount: number;
  pendingCount: number;
  throughputPerHour: number;
  medianLatencySeconds: number | null;
  flowPosture: "flowing" | "slow" | "stalled" | "severed";
  lastEventAt: string;
  oldestPendingSince: string | null;
  blockedCount: number;
  blockedReasonsBreakdown: Array<{ reason: OperatingSignalBlocker; count: number }>;
  sweepEligible: boolean;
  boundaryCounter: number;
  evidenceCoveragePercent: number;
  reviewRequiredCount: number;
};

export type OperatingSignalFlowSnapshot = {
  workspaceId: string;
  dataPosture: OperatingSignalDataPosture;
  window: "1h" | "24h" | "7d";
  generatedAt: string;
  judgementHeadline: string;
  boundaryStatementVisible: boolean;
  fixtureBannerVisible: boolean;
  animationPolicy: "enabled" | "disabled" | "affected_paths_static";
  selectedPathSignalKey: string | null;
  aiWorkPosture: {
    deterministicCoveragePercent: number;
    explanationCoveragePercent: number;
    evidenceCoveragePercent: number;
    boundaryStoppedCount: number;
  };
  nodes: OperatingSignalFlowNode[];
  edges: OperatingSignalFlowEdge[];
  events: OperatingSignalFlowEvent[];
};

export type OperatingSignalFlowCase = {
  id: string;
  description: string;
  expectedSelectedPathSignalKey: string | null;
  expectedDataPosture: OperatingSignalDataPosture;
  expectedBoundaryIncidentCount: number;
  expectedBlockedCount: number;
  expectedReviewRequiredCount: number;
  snapshot: OperatingSignalFlowSnapshot;
};

export type OperatingSignalFlowFixturePack = {
  version: string;
  status: string;
  boundary: string;
  entryPoints: {
    happyPathCaseId: string;
  };
  targets: {
    minimumTotalCases: number;
    minimumSignalFamilyCount: number;
    minimumBlockerCoverageCount: number;
    minimumRequiredStateCoverageCount: number;
    maximumCrossTenantProjectionCount: number;
    maximumLlmTransitionCount: number;
    maximumLlmRankingCount: number;
    maximumRawPayloadEchoCount: number;
    maximumAuthorityLeakCount: number;
    maximumInvalidRouteCount: number;
  };
  cases: OperatingSignalFlowCase[];
};

export type OperatingSignalFlowCaseResult = {
  caseId: string;
  dataPosture: OperatingSignalDataPosture;
  selectedPathSignalKey: string | null;
  expectedSelectedPathSignalKey: string | null;
  eventCount: number;
  workspaceCount: number;
  signalFamilyCount: number;
  coveredStates: OperatingSignalState[];
  coveredBlockers: OperatingSignalBlocker[];
  boundaryIncidentCount: number;
  blockedCount: number;
  reviewRequiredCount: number;
  crossTenantProjectionCount: number;
  llmTransitionCount: number;
  llmRankingCount: number;
  rawPayloadEchoCount: number;
  authorityLeakCount: number;
  invalidRouteCount: number;
  failures: string[];
};

export type OperatingSignalFlowEvalSummary = {
  passed: boolean;
  version: string;
  totalCases: number;
  signalFamilyCount: number;
  blockerCoverageCount: number;
  requiredStateCoverageCount: number;
  crossTenantProjectionCount: number;
  llmTransitionCount: number;
  llmRankingCount: number;
  rawPayloadEchoCount: number;
  authorityLeakCount: number;
  invalidRouteCount: number;
  caseResults: OperatingSignalFlowCaseResult[];
  failures: Array<{ caseId: string; reason: string }>;
};

export const OPERATING_SIGNAL_ALLOWED_NEXT_ACTIONS = [
  "/approvals",
  "/memory",
  "/capture",
  "/settings",
] as const;

export const OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET: ReadonlySet<string> = new Set(
  OPERATING_SIGNAL_ALLOWED_NEXT_ACTIONS,
);

export const OPERATING_SIGNAL_REQUIRED_STATES: OperatingSignalState[] = [
  "DETECTED",
  "NORMALIZED",
  "LINKED",
  "GATED",
  "JUDGED",
  "PACKETIZED",
  "REVIEW_PENDING",
  "HUMAN_DECIDED",
  "AWAITING_RECEIPT",
  "OUTCOME_RECORDED",
  "LEARNING_CANDIDATE",
  "MISSING_EVIDENCE",
  "UNRESOLVED_SOURCE",
  "MISSING_OWNER",
  "CONTRADICTION_REVIEW",
  "BOUNDARY_BLOCKED",
  "QUARANTINED",
  "OUTCOME_MISSING",
  "SUPERSEDED",
  "REVOKED",
  "MERGED",
  "DUPLICATE_COMPRESSED",
];

export const OPERATING_SIGNAL_BLOCKED_STATES = new Set<OperatingSignalState>([
  "UNRESOLVED_SOURCE",
  "MISSING_EVIDENCE",
  "MISSING_OWNER",
  "STALE_SIGNAL",
  "CONTRADICTION_REVIEW",
  "PERMISSION_BLOCKED",
  "BOUNDARY_BLOCKED",
  "QUARANTINED",
  "OUTCOME_MISSING",
]);

export const OPERATING_SIGNAL_LEGAL_TRANSITIONS = new Set<string>([
  "null->DETECTED",
  "DETECTED->NORMALIZED",
  "NORMALIZED->LINKED",
  "LINKED->GATED",
  "GATED->JUDGED",
  "JUDGED->PACKETIZED",
  "PACKETIZED->REVIEW_PENDING",
  "REVIEW_PENDING->HUMAN_DECIDED",
  "HUMAN_DECIDED->AWAITING_RECEIPT",
  "AWAITING_RECEIPT->OUTCOME_RECORDED",
  "AWAITING_RECEIPT->OUTCOME_MISSING",
  "OUTCOME_RECORDED->LEARNING_CANDIDATE",
  "MISSING_EVIDENCE->NORMALIZED",
  "MISSING_EVIDENCE->GATED",
  "UNRESOLVED_SOURCE->NORMALIZED",
  "MISSING_OWNER->PACKETIZED",
  "CONTRADICTION_REVIEW->REVIEW_PENDING",
  "CONTRADICTION_REVIEW->REJECTED",
  "OUTCOME_MISSING->OUTCOME_RECORDED",
  "OUTCOME_MISSING->REJECTED",
  "DETECTED->UNRESOLVED_SOURCE",
  "NORMALIZED->MISSING_EVIDENCE",
  "LINKED->MISSING_OWNER",
  "GATED->STALE_SIGNAL",
  "GATED->CONTRADICTION_REVIEW",
  "GATED->PERMISSION_BLOCKED",
  "GATED->BOUNDARY_BLOCKED",
  "DETECTED->QUARANTINED",
  "NORMALIZED->QUARANTINED",
  "LINKED->SUPERSEDED",
  "JUDGED->REVOKED",
  "NORMALIZED->MERGED",
  "DETECTED->DUPLICATE_COMPRESSED",
]);
