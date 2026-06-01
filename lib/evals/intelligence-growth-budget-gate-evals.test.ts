import budgetFixtureData from "@/evals/intelligence-growth-budget/budget-gate-cases.json";
import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthBudgetGateEval,
  type IntelligenceGrowthBudgetGateFixture,
  type IntelligenceGrowthBudgetGateRecord,
} from "@/lib/evals/intelligence-growth-budget-gate-evals";

type MutableBudgetFixture = Omit<IntelligenceGrowthBudgetGateFixture, "records"> & {
  records: IntelligenceGrowthBudgetGateRecord[];
};

function cloneFixture(): MutableBudgetFixture {
  return structuredClone(budgetFixtureData as IntelligenceGrowthBudgetGateFixture) as MutableBudgetFixture;
}

describe("runIntelligenceGrowthBudgetGateEval", () => {
  it("passes with checked-in budget envelopes", () => {
    const summary = runIntelligenceGrowthBudgetGateEval();

    expect(summary.passed).toBe(true);
    expect(summary.failures).toHaveLength(0);
    expect(summary.totalBudgetRecords).toBe(10);
    expect(summary.expectedCandidateCount).toBe(10);
    expect(summary.budgetCoveragePercent).toBe(100);
    expect(summary.aggregateInputTokensObserved).toBeLessThanOrEqual(summary.aggregateInputTokenMax);
    expect(summary.aggregateOutputTokensObserved).toBeLessThanOrEqual(summary.aggregateOutputTokenMax);
  });

  it("keeps budget gate candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthBudgetGateEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when a next-cycle candidate has no budget envelope", () => {
    const fixture = cloneFixture();
    fixture.records = fixture.records.slice(1);

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.missingBudgetEnvelopeCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "missing_budget_envelope")).toBe(true);
  });

  it("fails when observed tokens exceed envelope", () => {
    const fixture = cloneFixture();
    fixture.records[0] = {
      ...fixture.records[0],
      observedUsage: {
        ...fixture.records[0].observedUsage,
        inputTokens: fixture.records[0].budgetEnvelope.inputTokenMax + 1,
      },
    };

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.overBudgetCandidateCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "over_budget")).toBe(true);
  });

  it("fails when a model tier escalates beyond the envelope", () => {
    const fixture = cloneFixture();
    fixture.records[0] = {
      ...fixture.records[0],
      observedUsage: {
        ...fixture.records[0].observedUsage,
        modelTierUsed: "model-alias-premium",
      },
    };

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.modelTierEscalationCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "model_tier_escalation")).toBe(true);
  });

  it("fails when a tool call is outside the allowlist", () => {
    const fixture = cloneFixture();
    fixture.records[0] = {
      ...fixture.records[0],
      budgetEnvelope: {
        ...fixture.records[0].budgetEnvelope,
        toolCallMax: 2,
      },
      observedUsage: {
        ...fixture.records[0].observedUsage,
        toolCalls: ["fixture_replay", "external_write_tool"],
      },
    };

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.toolOutsideAllowlistCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "tool_outside_allowlist")).toBe(true);
  });

  it("fails when a budget justification is placeholder text", () => {
    const fixture = cloneFixture();
    fixture.records[0] = {
      ...fixture.records[0],
      budgetEnvelope: {
        ...fixture.records[0].budgetEnvelope,
        justification: "TBD",
      },
    };

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.placeholderJustificationCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "placeholder_justification")).toBe(true);
  });

  it("fails when a budget record is attached to the wrong dimension", () => {
    const fixture = cloneFixture();
    fixture.records[0] = {
      ...fixture.records[0],
      dimension: "memory",
    };

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.dimensionMismatchCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "dimension_mismatch")).toBe(true);
  });

  it("fails when a budget record requests production authority", () => {
    const fixture = cloneFixture();
    fixture.records[0] = {
      ...fixture.records[0],
      promptOrPolicyUpdateAllowed: true as false,
    };

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "unauthorized_flag")).toBe(true);
  });

  it("fails when a zero-call envelope reports model usage", () => {
    const fixture = cloneFixture();
    fixture.records[2] = {
      ...fixture.records[2],
      observedUsage: {
        ...fixture.records[2].observedUsage,
        modelCalls: 1,
        modelTierUsed: "model-alias-standard",
      },
    };

    const summary = runIntelligenceGrowthBudgetGateEval(fixture);

    expect(summary.passed).toBe(false);
    expect(summary.overBudgetCandidateCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "over_budget")).toBe(true);
  });
});
