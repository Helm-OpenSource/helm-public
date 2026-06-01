import budgetFixtureData from "@/evals/intelligence-growth-budget/budget-gate-cases.json";
import requeueFixtureData from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import {
  buildCycleAdvanceIntakeCandidate,
  runIntelligenceGrowthCycleAdvanceEval,
} from "@/lib/evals/intelligence-growth-cycle-advance-evals";
import type {
  IntelligenceGrowthLearningRequeueCandidate,
  IntelligenceGrowthLearningRequeueFixture,
} from "@/lib/evals/intelligence-growth-learning-requeue-evals";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

const TENANT_KEY = "helm-business-development";
const WORKSPACE_ID = "workspace_helm_business_development";
const CYCLE_WINDOW_KEY = "2026-W19";

const MODEL_TIER_RANK = {
  none: 0,
  "model-alias-standard": 1,
  "model-alias-premium": 2,
} as const;

type ModelTier = keyof typeof MODEL_TIER_RANK;

export type IntelligenceGrowthBudgetEnvelope = {
  readonly modelCallMax: number;
  readonly inputTokenMax: number;
  readonly outputTokenMax: number;
  readonly modelTierAllowed: ModelTier;
  readonly toolCallMax: number;
  readonly toolAllowlist: readonly string[];
  readonly wallclockMsMax: number;
  readonly replayAttemptMax: number;
  readonly justification: string;
};

export type IntelligenceGrowthBudgetObservedUsage = {
  readonly modelCalls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly modelTierUsed: ModelTier;
  readonly toolCalls: readonly string[];
  readonly wallclockMs: number;
  readonly replayAttempts: number;
};

export type IntelligenceGrowthBudgetGateRecord = {
  readonly candidateId: string;
  readonly sourceDecisionPacketId: string;
  readonly dimension: IntelligenceDimension;
  readonly budgetEnvelope: IntelligenceGrowthBudgetEnvelope;
  readonly observedUsage: IntelligenceGrowthBudgetObservedUsage;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly rawCustomerDataIncluded: false;
};

export type IntelligenceGrowthBudgetGateFixture = {
  readonly version: string;
  readonly status: string;
  readonly tenantKey: typeof TENANT_KEY;
  readonly workspaceId: typeof WORKSPACE_ID;
  readonly cycleWindowKey: typeof CYCLE_WINDOW_KEY;
  readonly records: readonly IntelligenceGrowthBudgetGateRecord[];
};

export type IntelligenceGrowthBudgetGateSummary = {
  readonly passed: boolean;
  readonly tenantKey: typeof TENANT_KEY;
  readonly workspaceId: typeof WORKSPACE_ID;
  readonly cycleWindowKey: typeof CYCLE_WINDOW_KEY;
  readonly totalBudgetRecords: number;
  readonly expectedCandidateCount: number;
  readonly budgetCoveragePercent: number;
  readonly missingBudgetEnvelopeCount: number;
  readonly unexpectedBudgetEnvelopeCount: number;
  readonly duplicateBudgetRecordCount: number;
  readonly malformedBudgetEnvelopeCount: number;
  readonly dimensionMismatchCount: number;
  readonly sourcePacketMismatchCount: number;
  readonly overBudgetCandidateCount: number;
  readonly modelTierEscalationCount: number;
  readonly toolOutsideAllowlistCount: number;
  readonly placeholderJustificationCount: number;
  readonly scopeMismatchCount: number;
  readonly windowMismatchCount: number;
  readonly unauthorizedFlagCount: number;
  readonly rawCustomerDataIncidentCount: number;
  readonly aggregateModelCallMax: number;
  readonly aggregateModelCallsObserved: number;
  readonly aggregateInputTokenMax: number;
  readonly aggregateInputTokensObserved: number;
  readonly aggregateOutputTokenMax: number;
  readonly aggregateOutputTokensObserved: number;
  readonly aggregateToolCallMax: number;
  readonly aggregateToolCallsObserved: number;
  readonly aggregateWallclockMsMax: number;
  readonly aggregateWallclockMsObserved: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failures: readonly { readonly candidateId: string; readonly reason: string }[];
};

const PLACEHOLDER_JUSTIFICATIONS = new Set(["", "tbd", "todo", "n/a", "na", "none"]);

export function runIntelligenceGrowthBudgetGateEval(
  fixture?: IntelligenceGrowthBudgetGateFixture,
  requeueFixture?: IntelligenceGrowthLearningRequeueFixture,
): IntelligenceGrowthBudgetGateSummary {
  const budgetFixture = fixture ?? (budgetFixtureData as IntelligenceGrowthBudgetGateFixture);
  const cycleSummary = runIntelligenceGrowthCycleAdvanceEval(requeueFixture);
  const requeueCandidates: readonly IntelligenceGrowthLearningRequeueCandidate[] = requeueFixture
    ? requeueFixture.candidates
    : (requeueFixtureData.candidates as IntelligenceGrowthLearningRequeueCandidate[]);
  const intakeCandidates = requeueCandidates.map(buildCycleAdvanceIntakeCandidate);
  const expectedByCandidateId = new Map(
    intakeCandidates.map((candidate) => [candidate.sourceCandidateId, candidate]),
  );

  const recordsByCandidateId = new Map<string, IntelligenceGrowthBudgetGateRecord>();
  const recordIdCounts = new Map<string, number>();
  for (const record of budgetFixture.records) {
    recordIdCounts.set(record.candidateId, (recordIdCounts.get(record.candidateId) ?? 0) + 1);
    recordsByCandidateId.set(record.candidateId, record);
  }

  const failures: { candidateId: string; reason: string }[] = [
    ...cycleSummary.failures.map((failure) => ({
      candidateId: failure.intakeId,
      reason: `upstream_cycle:${failure.reason}`,
    })),
  ];

  const duplicateBudgetRecordIds = [...recordIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([candidateId]) => candidateId);
  for (const candidateId of duplicateBudgetRecordIds) {
    failures.push({ candidateId, reason: "duplicate_budget_record" });
  }

  const missingBudgetCandidateIds = [...expectedByCandidateId.keys()].filter(
    (candidateId) => !recordsByCandidateId.has(candidateId),
  );
  for (const candidateId of missingBudgetCandidateIds) {
    failures.push({ candidateId, reason: "missing_budget_envelope" });
  }

  const unexpectedBudgetRecords = budgetFixture.records.filter(
    (record) => !expectedByCandidateId.has(record.candidateId),
  );
  for (const record of unexpectedBudgetRecords) {
    failures.push({ candidateId: record.candidateId, reason: "unexpected_budget_envelope" });
  }

  for (const record of budgetFixture.records) {
    const expectedIntake = expectedByCandidateId.get(record.candidateId);
    const expectedDimension = expectedIntake ? resolveDimension(expectedIntake.sourceDecisionPacketId) : null;

    pushFailure(
      failures,
      budgetFixture.tenantKey !== TENANT_KEY ||
        budgetFixture.workspaceId !== WORKSPACE_ID ||
        expectedIntake?.tenantKey !== TENANT_KEY ||
        expectedIntake?.workspaceId !== WORKSPACE_ID,
      record.candidateId,
      "scope_mismatch",
    );
    pushFailure(
      failures,
      budgetFixture.cycleWindowKey !== CYCLE_WINDOW_KEY ||
        expectedIntake?.cycleWindowKey !== CYCLE_WINDOW_KEY,
      record.candidateId,
      "window_mismatch",
    );
    pushFailure(
      failures,
      Boolean(expectedIntake && record.sourceDecisionPacketId !== expectedIntake.sourceDecisionPacketId),
      record.candidateId,
      "source_packet_mismatch",
    );
    pushFailure(
      failures,
      Boolean(expectedDimension && record.dimension !== expectedDimension),
      record.candidateId,
      "dimension_mismatch",
    );
    pushFailure(
      failures,
      !isValidBudgetEnvelope(record.budgetEnvelope, record.observedUsage),
      record.candidateId,
      "malformed_budget_envelope",
    );
    pushFailure(
      failures,
      isOverBudget(record),
      record.candidateId,
      "over_budget",
    );
    pushFailure(
      failures,
      MODEL_TIER_RANK[record.observedUsage.modelTierUsed] >
        MODEL_TIER_RANK[record.budgetEnvelope.modelTierAllowed],
      record.candidateId,
      "model_tier_escalation",
    );
    pushFailure(
      failures,
      record.observedUsage.toolCalls.some((toolName) =>
        !record.budgetEnvelope.toolAllowlist.includes(toolName),
      ),
      record.candidateId,
      "tool_outside_allowlist",
    );
    pushFailure(
      failures,
      PLACEHOLDER_JUSTIFICATIONS.has(record.budgetEnvelope.justification.trim().toLowerCase()),
      record.candidateId,
      "placeholder_justification",
    );
    pushFailure(
      failures,
      record.runtimeAllowed ||
        record.officialWriteAllowed ||
        record.autoExecutionAllowed ||
        record.canonicalMemoryWriteAllowed ||
        record.promptOrPolicyUpdateAllowed ||
        record.skillAutoPromotionAllowed,
      record.candidateId,
      "unauthorized_flag",
    );
    pushFailure(
      failures,
      record.rawCustomerDataIncluded,
      record.candidateId,
      "raw_customer_data_incident",
    );
  }

  pushFailure(
    failures,
    cycleSummary.unauthorizedFlagCount > 0,
    "__budget__",
    `upstream_unauthorized_flag_count:${cycleSummary.unauthorizedFlagCount}`,
  );
  pushFailure(
    failures,
    cycleSummary.rawCustomerDataIncidentCount > 0,
    "__budget__",
    `upstream_raw_customer_data_incident_count:${cycleSummary.rawCustomerDataIncidentCount}`,
  );

  const uniqueFailures = deduplicateFailures(failures);
  const expectedCandidateCount = expectedByCandidateId.size;
  const coveredCandidateCount = [...expectedByCandidateId.keys()].filter((candidateId) =>
    recordsByCandidateId.has(candidateId),
  ).length;

  return {
    passed: uniqueFailures.length === 0,
    tenantKey: TENANT_KEY,
    workspaceId: WORKSPACE_ID,
    cycleWindowKey: CYCLE_WINDOW_KEY,
    totalBudgetRecords: budgetFixture.records.length,
    expectedCandidateCount,
    budgetCoveragePercent: percent(coveredCandidateCount, expectedCandidateCount),
    missingBudgetEnvelopeCount: uniqueFailures.filter((failure) =>
      failure.reason === "missing_budget_envelope",
    ).length,
    unexpectedBudgetEnvelopeCount: uniqueFailures.filter((failure) =>
      failure.reason === "unexpected_budget_envelope",
    ).length,
    duplicateBudgetRecordCount: duplicateBudgetRecordIds.length,
    malformedBudgetEnvelopeCount: uniqueFailures.filter((failure) =>
      failure.reason === "malformed_budget_envelope",
    ).length,
    dimensionMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason === "dimension_mismatch",
    ).length,
    sourcePacketMismatchCount: uniqueFailures.filter((failure) =>
      failure.reason === "source_packet_mismatch",
    ).length,
    overBudgetCandidateCount: uniqueFailures.filter((failure) => failure.reason === "over_budget").length,
    modelTierEscalationCount: uniqueFailures.filter((failure) =>
      failure.reason === "model_tier_escalation",
    ).length,
    toolOutsideAllowlistCount: uniqueFailures.filter((failure) =>
      failure.reason === "tool_outside_allowlist",
    ).length,
    placeholderJustificationCount: uniqueFailures.filter((failure) =>
      failure.reason === "placeholder_justification",
    ).length,
    scopeMismatchCount: uniqueFailures.filter((failure) => failure.reason === "scope_mismatch").length,
    windowMismatchCount: uniqueFailures.filter((failure) => failure.reason === "window_mismatch").length,
    unauthorizedFlagCount: uniqueFailures.filter((failure) =>
      failure.reason === "unauthorized_flag" ||
        failure.reason.startsWith("upstream_unauthorized_flag_count"),
    ).length,
    rawCustomerDataIncidentCount: uniqueFailures.filter((failure) =>
      failure.reason === "raw_customer_data_incident" ||
        failure.reason.startsWith("upstream_raw_customer_data_incident_count"),
    ).length,
    aggregateModelCallMax: sumBudget(budgetFixture.records, "modelCallMax"),
    aggregateModelCallsObserved: sumObserved(budgetFixture.records, "modelCalls"),
    aggregateInputTokenMax: sumBudget(budgetFixture.records, "inputTokenMax"),
    aggregateInputTokensObserved: sumObserved(budgetFixture.records, "inputTokens"),
    aggregateOutputTokenMax: sumBudget(budgetFixture.records, "outputTokenMax"),
    aggregateOutputTokensObserved: sumObserved(budgetFixture.records, "outputTokens"),
    aggregateToolCallMax: sumBudget(budgetFixture.records, "toolCallMax"),
    aggregateToolCallsObserved: budgetFixture.records.reduce(
      (total, record) => total + record.observedUsage.toolCalls.length,
      0,
    ),
    aggregateWallclockMsMax: sumBudget(budgetFixture.records, "wallclockMsMax"),
    aggregateWallclockMsObserved: sumObserved(budgetFixture.records, "wallclockMs"),
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failures: uniqueFailures,
  };
}

function isValidBudgetEnvelope(
  envelope: IntelligenceGrowthBudgetEnvelope,
  observed: IntelligenceGrowthBudgetObservedUsage,
): boolean {
  const values = [
    envelope.modelCallMax,
    envelope.inputTokenMax,
    envelope.outputTokenMax,
    envelope.toolCallMax,
    envelope.wallclockMsMax,
    envelope.replayAttemptMax,
    observed.modelCalls,
    observed.inputTokens,
    observed.outputTokens,
    observed.wallclockMs,
    observed.replayAttempts,
  ];
  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    return false;
  }
  if (!(envelope.modelTierAllowed in MODEL_TIER_RANK) || !(observed.modelTierUsed in MODEL_TIER_RANK)) {
    return false;
  }
  if (envelope.modelCallMax === 0 && envelope.modelTierAllowed !== "none") {
    return false;
  }
  return !(observed.modelCalls === 0 && observed.modelTierUsed !== "none");
}

function isOverBudget(record: IntelligenceGrowthBudgetGateRecord): boolean {
  const { budgetEnvelope: budget, observedUsage: observed } = record;
  return observed.modelCalls > budget.modelCallMax ||
    observed.inputTokens > budget.inputTokenMax ||
    observed.outputTokens > budget.outputTokenMax ||
    observed.toolCalls.length > budget.toolCallMax ||
    observed.wallclockMs > budget.wallclockMsMax ||
    observed.replayAttempts > budget.replayAttemptMax;
}

function resolveDimension(sourceDecisionPacketId: string): IntelligenceDimension | null {
  const [, dimension] = sourceDecisionPacketId.split(":");
  const validDimensions: readonly IntelligenceDimension[] = [
    "context",
    "object_signal",
    "memory",
    "routing",
    "action_outcome",
    "worker_skill",
    "prompt_policy",
    "eval_replay",
    "tenant_personalization",
    "cost_model_tool",
  ];
  return validDimensions.includes(dimension as IntelligenceDimension)
    ? (dimension as IntelligenceDimension)
    : null;
}

function sumBudget(
  records: readonly IntelligenceGrowthBudgetGateRecord[],
  field: keyof Omit<IntelligenceGrowthBudgetEnvelope, "modelTierAllowed" | "toolAllowlist" | "justification">,
): number {
  return records.reduce((total, record) => total + record.budgetEnvelope[field], 0);
}

function sumObserved(
  records: readonly IntelligenceGrowthBudgetGateRecord[],
  field: keyof Omit<IntelligenceGrowthBudgetObservedUsage, "modelTierUsed" | "toolCalls">,
): number {
  return records.reduce((total, record) => total + record.observedUsage[field], 0);
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

function pushFailure(
  failures: { candidateId: string; reason: string }[],
  failed: boolean,
  candidateId: string,
  reason: string,
): void {
  if (failed) {
    failures.push({ candidateId, reason });
  }
}

function deduplicateFailures(
  failures: readonly { readonly candidateId: string; readonly reason: string }[],
): readonly { readonly candidateId: string; readonly reason: string }[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.candidateId}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
