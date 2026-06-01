// Intelligence Growth System (IGS) — P0 Slice A: pure TypeScript contracts only.
// No DB schema, no API, no UI, no production prompt changes.

// ── Dimension IDs ────────────────────────────────────────────────────────────

export type IntelligenceDimension =
  | "context"
  | "object_signal"
  | "memory"
  | "routing"
  | "action_outcome"
  | "worker_skill"
  | "prompt_policy"
  | "eval_replay"
  | "tenant_personalization"
  | "cost_model_tool";

// ── Growth Decision ───────────────────────────────────────────────────────────
// Deliberately excludes: approved, auto_promote, production_ready, active, promoted.

export type GrowthDecision =
  | "learning_candidate"
  | "watch_only"
  | "review_required"
  | "rejected";

// ── No-Go Boundary keys ───────────────────────────────────────────────────────

export type NoGoBoundary =
  | "no_db_schema"
  | "no_api"
  | "no_ui"
  | "no_production_prompt_change"
  | "no_runtime_self_learning";

// ── Shared primitives ─────────────────────────────────────────────────────────

export type EvidenceRef = {
  readonly type: "eval_run" | "fixture" | "human_review" | "log_trace";
  readonly id: string;
  readonly timestamp?: string;
};

export type BusinessObjectRef = {
  readonly kind:
    | "opportunity"
    | "goal"
    | "belief"
    | "commitment"
    | "operating_gap"
    | "worker"
    | "skill";
  readonly id: string;
  readonly workspaceId: string;
};

export type ContextPacketSnapshot = {
  readonly tokenCount: number;
  readonly coverageScore: number;
  readonly redundancyScore: number;
  readonly relevanceScore: number;
  readonly workspaceId: string;
};

export type GrowthBoundaryPosture = {
  readonly noGoBoundaries: readonly NoGoBoundary[];
  readonly reviewFirst: true;
  readonly offlineOnly: true;
};

export type GrowthMetric = {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
};

export type GrowthFailure = {
  readonly failureType: string;
  readonly description: string;
  readonly boundary: NoGoBoundary | null;
};

// ── Shared base types ─────────────────────────────────────────────────────────

export type GrowthInputBase = {
  readonly dimension: IntelligenceDimension;
  readonly evalRunId: string;
  readonly workspaceId: string;
  readonly evidenceRefs: readonly EvidenceRef[];
};

export type GrowthResultBase = {
  readonly dimension: IntelligenceDimension;
  readonly evalRunId: string;
  readonly decision: GrowthDecision;
  readonly reason: string;
  readonly metrics: readonly GrowthMetric[];
  readonly failures: readonly GrowthFailure[];
  readonly boundaryViolations: readonly NoGoBoundary[];
};

// ── 3.1 Context Intelligence ──────────────────────────────────────────────────

export type ContextQualityInput = GrowthInputBase & {
  readonly dimension: "context";
  readonly contextSnapshot: ContextPacketSnapshot;
  readonly callType: "recommendation" | "routing" | "briefing" | "other";
  readonly tokenBudget: number;
};

export type ContextQualityResult = GrowthResultBase & {
  readonly dimension: "context";
  readonly coverageScore: number;
  readonly redundancyScore: number;
  readonly relevanceScore: number;
  readonly tokenOverBudget: boolean;
};

// ── 3.2 Object/Signal Intelligence ───────────────────────────────────────────

export type ObjectSignalGrowthInput = GrowthInputBase & {
  readonly dimension: "object_signal";
  readonly objectRef: BusinessObjectRef;
  readonly signalCount: number;
  readonly staleSignalCount: number;
  readonly currentGate: "must_push_ready" | "review_required" | "watch_only" | "rejected";
};

export type ObjectSignalGrowthResult = GrowthResultBase & {
  readonly dimension: "object_signal";
  readonly gateAccuracy: number;
  readonly falsePositiveRisk: boolean;
  readonly remediationCandidate: boolean;
};

// ── 3.3 Company Memory Intelligence ──────────────────────────────────────────

export type MemoryGrowthInput = GrowthInputBase & {
  readonly dimension: "memory";
  readonly factDensityScore: number;
  readonly stalenessScore: number;
  readonly deduplicationFingerprintMatches: number;
  readonly pendingPromotionCount: number;
};

export type MemoryGrowthResult = GrowthResultBase & {
  readonly dimension: "memory";
  readonly qualityScore: number;
  readonly promotionGatePass: boolean;
  readonly autoWriteAttempted: false;
};

// ── 3.4 Routing Intelligence ──────────────────────────────────────────────────

export type RoutingGrowthInput = GrowthInputBase & {
  readonly dimension: "routing";
  readonly signalAliasCount: number;
  readonly routingChannel: "must_push" | "review" | "watch";
  readonly conflictingSignalCount: number;
};

export type RoutingGrowthResult = GrowthResultBase & {
  readonly dimension: "routing";
  readonly falsePositiveCount: number;
  readonly falseNegativeCount: number;
  readonly routingConflictResolved: boolean;
  readonly llmUsedForFinalRouting: false;
};

// ── 3.5 Action/Outcome Intelligence ──────────────────────────────────────────

export type ActionOutcomeInput = GrowthInputBase & {
  readonly dimension: "action_outcome";
  readonly actionCategory:
    | "must_push"
    | "review_required"
    | "worker_instruction"
    | "learning_candidate";
  readonly outcomeAnnotated: boolean;
  readonly feedbackCycleCount: number;
};

export type ActionOutcomeResult = GrowthResultBase & {
  readonly dimension: "action_outcome";
  readonly outcomeCorrelationScore: number;
  readonly autoJudgmentAttempted: false;
};

// ── 3.6 Worker/Skill Intelligence ────────────────────────────────────────────

export type WorkerSkillGrowthInput = GrowthInputBase & {
  readonly dimension: "worker_skill";
  readonly workerRef: BusinessObjectRef;
  readonly artifactQualityScore: number;
  readonly skillInvocationFailureCount: number;
  readonly boundaryHitCount: number;
};

export type WorkerSkillGrowthResult = GrowthResultBase & {
  readonly dimension: "worker_skill";
  readonly artifactQualityGrade: "pass" | "watch" | "fail";
  readonly skillSuggestionAutoPromoted: false;
};

// ── 3.7 Prompt/Policy Intelligence ───────────────────────────────────────────

export type PromptPolicyGrowthInput = GrowthInputBase & {
  readonly dimension: "prompt_policy";
  readonly templateId: string;
  readonly regressionGatePass: boolean;
  readonly policyRuleCount: number;
  readonly candidateChangeDescription: string;
};

export type PromptPolicyGrowthResult = GrowthResultBase & {
  readonly dimension: "prompt_policy";
  readonly templateQualityScore: number;
  readonly productionPromptModified: false;
  readonly policyRuleAutoUpdated: false;
};

// ── 3.8 Eval/Replay Intelligence ─────────────────────────────────────────────

export type EvalReplayGrowthInput = GrowthInputBase & {
  readonly dimension: "eval_replay";
  readonly fixtureCount: number;
  readonly coveredProductionPathCount: number;
  readonly totalKnownProductionPathCount: number;
  readonly failureCasesReplayed: number;
};

export type EvalReplayGrowthResult = GrowthResultBase & {
  readonly dimension: "eval_replay";
  readonly coverageRatio: number;
  readonly productionDataReplayed: false;
};

// ── 3.9 Tenant Personalization Intelligence ───────────────────────────────────

export type TenantPersonalizationInput = GrowthInputBase & {
  readonly dimension: "tenant_personalization";
  readonly tenantAlias: string;
  readonly usagePatternSchemaVersion: string;
  readonly crossWorkspaceAggregationAttempted: false;
};

export type TenantPersonalizationResult = GrowthResultBase & {
  readonly dimension: "tenant_personalization";
  readonly isolationBoundaryRespected: boolean;
  readonly tenantLearnCandidateCount: number;
  readonly crossWorkspaceAutoAggregated: false;
};

// ── 3.10 Cost/Model/Tool Intelligence ────────────────────────────────────────

export type CostModelToolInput = GrowthInputBase & {
  readonly dimension: "cost_model_tool";
  readonly tokenUsagePerCall: number;
  readonly modelId: string;
  readonly toolBoundaryHitCount: number;
  readonly modelDowngradeCandidateEvaluated: boolean;
};

export type CostModelToolResult = GrowthResultBase & {
  readonly dimension: "cost_model_tool";
  readonly tokenEfficiencyScore: number;
  readonly autoModelSwitchAttempted: false;
};
