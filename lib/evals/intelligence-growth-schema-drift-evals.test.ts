import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEMA_DRIFT_BASELINE,
  runIntelligenceGrowthSchemaDriftEval,
  type IntelligenceGrowthSchemaDriftBaseline,
  type IntelligenceGrowthSchemaDriftSnapshotFixture,
} from "@/lib/evals/intelligence-growth-schema-drift-evals";

describe("runIntelligenceGrowthSchemaDriftEval", () => {
  it("passes against the checked-in IGS schema drift baseline", () => {
    const summary = runIntelligenceGrowthSchemaDriftEval();

    expect(summary.passed).toBe(true);
    expect(summary.dimensionParityOk).toBe(true);
    expect(summary.decisionParityOk).toBe(true);
    expect(summary.boundaryParityOk).toBe(true);
    expect(summary.trackedSummaryCount).toBe(18);
    expect(summary.summaryKeySetMismatchCount).toBe(0);
    expect(summary.authorityFlagWrongValueCount).toBe(0);
    expect(summary.fixtureKeySetMismatchCount).toBe(0);
    expect(summary.fixtureExpectedKeySetMismatchCount).toBe(0);
    expect(summary.snapshotVersionPinned).toBe(true);
    expect(summary.failures).toHaveLength(0);
  });

  it("keeps the schema drift gate candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthSchemaDriftEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when baseline dimensions drift from contract sources", () => {
    const baseline: IntelligenceGrowthSchemaDriftBaseline = {
      ...DEFAULT_SCHEMA_DRIFT_BASELINE,
      dimensions: [...DEFAULT_SCHEMA_DRIFT_BASELINE.dimensions, "phantom_dim"],
    };

    const summary = runIntelligenceGrowthSchemaDriftEval({ baseline });

    expect(summary.passed).toBe(false);
    expect(summary.dimensionParityOk).toBe(false);
  });

  it("fails when TypeScript union literals drift", () => {
    const typesText = `
      export type IntelligenceDimension = "context";
      export type GrowthDecision = "learning_candidate" | "watch_only" | "review_required" | "rejected";
      export type NoGoBoundary =
        | "no_db_schema"
        | "no_api"
        | "no_ui"
        | "no_production_prompt_change"
        | "no_runtime_self_learning";
    `;

    const summary = runIntelligenceGrowthSchemaDriftEval({ typesText });

    expect(summary.passed).toBe(false);
    expect(summary.dimensionParityOk).toBe(false);
  });

  it("fails when a snapshot summary key set drifts", () => {
    const baseline: IntelligenceGrowthSchemaDriftBaseline = {
      ...DEFAULT_SCHEMA_DRIFT_BASELINE,
      summaryKeySets: DEFAULT_SCHEMA_DRIFT_BASELINE.summaryKeySets.map((entry) =>
        entry.producerId === "core_eval"
          ? { ...entry, keys: [...entry.keys, "surprise"] }
          : entry,
      ),
    };

    const summary = runIntelligenceGrowthSchemaDriftEval({ baseline });

    expect(summary.passed).toBe(false);
    expect(summary.summaryKeySetMismatchCount).toBe(1);
  });

  it("fails when authority flags in the snapshot carry unsafe values", () => {
    const snapshotFixture = cloneSnapshotFixture();
    const decisionOutcome = snapshotFixture.snapshots.find((entry) => entry.producerId === "decision_outcome");
    expect(decisionOutcome).toBeDefined();
    (decisionOutcome!.expected as Record<string, unknown>).runtimeAllowed = true;

    const summary = runIntelligenceGrowthSchemaDriftEval({ snapshotFixture });

    expect(summary.passed).toBe(false);
    expect(summary.authorityFlagWrongValueCount).toBe(1);
  });

  it("fails when core fixture top-level keys drift", () => {
    const coreFixtures = {
      context: [
        {
          id: "ctx-extra",
          dimension: "context",
          description: "extra key fixture",
          input: {},
          expected: {
            decision: "watch_only",
            reason: "test",
            boundaryViolations: [],
          },
          isNegativeBoundary: false,
          extra: true,
        },
      ],
    };

    const summary = runIntelligenceGrowthSchemaDriftEval({ coreFixtures });

    expect(summary.passed).toBe(false);
    expect(summary.fixtureKeySetMismatchCount).toBe(1);
  });

  it("fails when core fixture expected keys drift", () => {
    const coreFixtures = {
      context: [
        {
          id: "ctx-expected-extra",
          dimension: "context",
          description: "expected extra key fixture",
          input: {},
          expected: {
            decision: "watch_only",
            reason: "test",
            boundaryViolations: [],
            extra: true,
          },
          isNegativeBoundary: false,
        },
      ],
    };

    const summary = runIntelligenceGrowthSchemaDriftEval({ coreFixtures });

    expect(summary.passed).toBe(false);
    expect(summary.fixtureExpectedKeySetMismatchCount).toBe(1);
  });

  it("fails when the eval replay snapshot fixture version drifts", () => {
    const snapshotFixture = {
      ...cloneSnapshotFixture(),
      version: "unexpected",
    };

    const summary = runIntelligenceGrowthSchemaDriftEval({ snapshotFixture });

    expect(summary.passed).toBe(false);
    expect(summary.snapshotVersionPinned).toBe(false);
    expect(summary.snapshotVersionMismatchCount).toBe(1);
  });
});

function cloneSnapshotFixture(): IntelligenceGrowthSchemaDriftSnapshotFixture {
  return JSON.parse(
    JSON.stringify({
      version: DEFAULT_SCHEMA_DRIFT_BASELINE.expectedSnapshotFixtureVersion,
      snapshots: DEFAULT_SCHEMA_DRIFT_BASELINE.summaryKeySets.map((entry) => ({
        producerId: entry.producerId,
        expected: Object.fromEntries(entry.keys.map((key) => [key, safeDefaultForKey(key)])),
      })),
    }),
  ) as IntelligenceGrowthSchemaDriftSnapshotFixture;
}

function safeDefaultForKey(key: string): unknown {
  if (key === "candidateOnly" || key.endsWith("Ok") || key === "passed" || key === "snapshotVersionPinned") {
    return true;
  }
  if (key.endsWith("Allowed") || key === "runtimeAdoptionAllowed") {
    return false;
  }
  if (key === "baselineVersion") {
    return DEFAULT_SCHEMA_DRIFT_BASELINE.version;
  }
  return 0;
}
