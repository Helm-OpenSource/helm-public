import { describe, expect, it } from "vitest";
import {
  runIntelligenceGrowthEvalReplaySnapshotEval,
  type IntelligenceGrowthEvalReplaySnapshotFixture,
  type IntelligenceGrowthEvalReplaySnapshotProducer,
} from "@/lib/evals/intelligence-growth-eval-replay-snapshot-evals";

describe("runIntelligenceGrowthEvalReplaySnapshotEval", () => {
  it("passes with checked-in IGS eval replay snapshots", () => {
    const summary = runIntelligenceGrowthEvalReplaySnapshotEval();

    expect(summary.passed).toBe(true);
    expect(summary.expectedSnapshotCount).toBe(18);
    expect(summary.actualSnapshotCount).toBe(18);
    expect(summary.snapshotCoveragePercent).toBe(100);
    expect(summary.snapshotMismatchCount).toBe(0);
    expect(summary.unauthorizedFlagCount).toBe(0);
    expect(summary.rawCustomerDataIncidentCount).toBe(0);
    expect(summary.failures).toHaveLength(0);
  });

  it("keeps snapshot regression gate candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthEvalReplaySnapshotEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when an expected snapshot drifts from actual output", () => {
    const fixture: IntelligenceGrowthEvalReplaySnapshotFixture = {
      version: "test",
      expectedSnapshotCount: 1,
      snapshots: [
        {
          producerId: "sample",
          expected: { passed: true, total: 10 },
        },
      ],
    };
    const producers: readonly IntelligenceGrowthEvalReplaySnapshotProducer[] = [
      {
        producerId: "sample",
        buildSnapshot: () => ({ passed: true, total: 11 }),
      },
    ];

    const summary = runIntelligenceGrowthEvalReplaySnapshotEval({ fixture, producers });

    expect(summary.passed).toBe(false);
    expect(summary.snapshotMismatchCount).toBe(1);
    expect(summary.failures).toContainEqual({ producerId: "sample", reason: "snapshot_mismatch" });
  });

  it("fails on missing and unexpected snapshot ids", () => {
    const fixture: IntelligenceGrowthEvalReplaySnapshotFixture = {
      version: "test",
      expectedSnapshotCount: 2,
      snapshots: [
        { producerId: "expected_only", expected: { passed: true } },
        { producerId: "sample", expected: { passed: true } },
      ],
    };
    const producers: readonly IntelligenceGrowthEvalReplaySnapshotProducer[] = [
      {
        producerId: "sample",
        buildSnapshot: () => ({ passed: true }),
      },
      {
        producerId: "actual_only",
        buildSnapshot: () => ({ passed: true }),
      },
    ];

    const summary = runIntelligenceGrowthEvalReplaySnapshotEval({ fixture, producers });

    expect(summary.passed).toBe(false);
    expect(summary.missingSnapshotCount).toBe(1);
    expect(summary.unexpectedSnapshotCount).toBe(1);
  });

  it("fails when a snapshot exposes runtime or raw-data incidents", () => {
    const fixture: IntelligenceGrowthEvalReplaySnapshotFixture = {
      version: "test",
      expectedSnapshotCount: 1,
      snapshots: [
        {
          producerId: "unsafe",
          expected: {
            passed: true,
            runtimeAllowed: true,
            rawCustomerDataIncidentCount: 1,
          },
        },
      ],
    };
    const producers: readonly IntelligenceGrowthEvalReplaySnapshotProducer[] = [
      {
        producerId: "unsafe",
        buildSnapshot: () => ({
          passed: true,
          runtimeAllowed: true,
          rawCustomerDataIncidentCount: 1,
        }),
      },
    ];

    const summary = runIntelligenceGrowthEvalReplaySnapshotEval({ fixture, producers });

    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBe(1);
    expect(summary.rawCustomerDataIncidentCount).toBe(1);
  });

  it("fails when a snapshot exposes aggregate raw-data incident fields", () => {
    const fixture: IntelligenceGrowthEvalReplaySnapshotFixture = {
      version: "test",
      expectedSnapshotCount: 1,
      snapshots: [
        {
          producerId: "aggregate_raw",
          expected: {
            passed: true,
            totalRawDataIncidentCount: 1,
          },
        },
      ],
    };
    const producers: readonly IntelligenceGrowthEvalReplaySnapshotProducer[] = [
      {
        producerId: "aggregate_raw",
        buildSnapshot: () => ({
          passed: true,
          totalRawDataIncidentCount: 1,
        }),
      },
    ];

    const summary = runIntelligenceGrowthEvalReplaySnapshotEval({ fixture, producers });

    expect(summary.passed).toBe(false);
    expect(summary.rawCustomerDataIncidentCount).toBe(1);
  });

  it("fails when a snapshot exposes aggregate unauthorized authority fields", () => {
    const fixture: IntelligenceGrowthEvalReplaySnapshotFixture = {
      version: "test",
      expectedSnapshotCount: 1,
      snapshots: [
        {
          producerId: "aggregate_unauthorized",
          expected: {
            passed: true,
            unauthorizedProductionChangeCount: 1,
          },
        },
      ],
    };
    const producers: readonly IntelligenceGrowthEvalReplaySnapshotProducer[] = [
      {
        producerId: "aggregate_unauthorized",
        buildSnapshot: () => ({
          passed: true,
          unauthorizedProductionChangeCount: 1,
        }),
      },
    ];

    const summary = runIntelligenceGrowthEvalReplaySnapshotEval({ fixture, producers });

    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBe(1);
  });

  it("fails when a snapshot exposes raw payload echo fields", () => {
    const fixture: IntelligenceGrowthEvalReplaySnapshotFixture = {
      version: "test",
      expectedSnapshotCount: 1,
      snapshots: [
        {
          producerId: "raw_payload",
          expected: {
            passed: true,
            rawPayloadEchoCount: 1,
          },
        },
      ],
    };
    const producers: readonly IntelligenceGrowthEvalReplaySnapshotProducer[] = [
      {
        producerId: "raw_payload",
        buildSnapshot: () => ({
          passed: true,
          rawPayloadEchoCount: 1,
        }),
      },
    ];

    const summary = runIntelligenceGrowthEvalReplaySnapshotEval({ fixture, producers });

    expect(summary.passed).toBe(false);
    expect(summary.rawCustomerDataIncidentCount).toBe(1);
  });
});
