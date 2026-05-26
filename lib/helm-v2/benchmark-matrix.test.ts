import { describe, expect, it } from "vitest";
import { buildBenchmarkMatrixReadModel } from "@/lib/helm-v2/benchmark-matrix";

describe("runtime benchmark matrix", () => {
  it("keeps the four benchmark layers and their gate commands explicit", () => {
    const matrix = buildBenchmarkMatrixReadModel();

    expect(matrix.layers.map((item) => item.layerId)).toEqual([
      "runtime_eval",
      "adapter_conformance",
      "boundary_regression",
      "operator_usability",
    ]);

    const commands = matrix.layers.flatMap((item) => item.gates.map((gate) => gate.command));
    expect(commands).toEqual(
      expect.arrayContaining([
        "npm run eval:helm-v2-1-phase2",
        "npm run eval:helm-v2-2-continuity-recovery",
        "npx vitest run lib/connectors/google.test.ts lib/connectors/wecom.test.ts lib/connectors/dingtalk.test.ts",
        "npx vitest run lib/helm-v2/official-system-integration-runtime.test.ts",
        "npm run self-check",
        "npm run check:boundaries",
        "npm run quality:regression",
        "npm run build",
        "npm run e2e",
      ]),
    );
    expect(matrix.summary.totalGates).toBe(9);
    expect(matrix.summary.recordedGates).toBe(0);
    expect(matrix.layers.every((item) => item.outcomeStatus === "not_recorded")).toBe(true);
  });

  it("projects the latest persisted benchmark outcomes onto gate and layer readouts", () => {
    const matrix = buildBenchmarkMatrixReadModel({
      recordedRuns: [
        {
          benchmarkRunId: "benchmark_run_newer",
          runLabel: "April runtime validation",
          commandSource: "benchmark:runtime-substrate",
          notes: "Latest validation pass with one watch item.",
          recordedAt: new Date("2026-04-12T09:00:00.000Z"),
          recordedBy: "founder@demo.com",
          sourcePage: "/operating",
          outcomes: [
            {
              layerId: "runtime_eval",
              gateId: "runtime_substrate_eval",
              status: "pass",
              summary: "Runtime substrate eval passed on current-main.",
              evidenceRefs: ["npm run eval:helm-v2-1-phase2"],
            },
            {
              layerId: "runtime_eval",
              gateId: "continuity_recovery_eval",
              status: "warning",
              summary: "Continuity recovery eval passed with one watch-band caveat.",
              evidenceRefs: ["npm run eval:helm-v2-2-continuity-recovery"],
            },
            {
              layerId: "boundary_regression",
              gateId: "self_check",
              status: "pass",
              summary: "Self-check stayed aligned with current-main truth.",
              evidenceRefs: ["npm run self-check"],
            },
          ],
        },
        {
          benchmarkRunId: "benchmark_run_older",
          runLabel: "Older validation",
          commandSource: "manual",
          notes: null,
          recordedAt: new Date("2026-04-11T09:00:00.000Z"),
          recordedBy: "reviewer@demo.com",
          sourcePage: "/meetings/meeting_1",
          outcomes: [
            {
              layerId: "runtime_eval",
              gateId: "runtime_substrate_eval",
              status: "fail",
              summary: "Older runtime substrate run failed before the latest fix.",
              evidenceRefs: ["older-eval"],
            },
            {
              layerId: "operator_usability",
              gateId: "build_gate",
              status: "pass",
              summary: "Build gate passed on the earlier run.",
              evidenceRefs: ["npm run build"],
            },
          ],
        },
      ],
    });

    const runtimeEval = matrix.layers.find((item) => item.layerId === "runtime_eval");
    const operatorUsability = matrix.layers.find((item) => item.layerId === "operator_usability");
    const adapterConformance = matrix.layers.find((item) => item.layerId === "adapter_conformance");

    expect(runtimeEval?.outcomeStatus).toBe("warning");
    expect(runtimeEval?.recordedGateCount).toBe(2);
    expect(runtimeEval?.latestRecordedAt).toEqual(new Date("2026-04-12T09:00:00.000Z"));
    expect(
      runtimeEval?.gates.find((item) => item.gateId === "runtime_substrate_eval")?.latestOutcome.status,
    ).toBe("pass");
    expect(
      runtimeEval?.gates.find((item) => item.gateId === "runtime_substrate_eval")?.latestOutcome.benchmarkRunId,
    ).toBe("benchmark_run_newer");
    expect(
      runtimeEval?.gates.find((item) => item.gateId === "continuity_recovery_eval")?.latestOutcome.status,
    ).toBe("warning");
    expect(
      operatorUsability?.gates.find((item) => item.gateId === "build_gate")?.latestOutcome.recordedBy,
    ).toBe("reviewer@demo.com");
    expect(operatorUsability?.outcomeStatus).toBe("not_recorded");
    expect(adapterConformance?.outcomeStatus).toBe("not_recorded");
    expect(matrix.summary.recordedGates).toBe(4);
    expect(matrix.summary.passingGates).toBe(3);
    expect(matrix.summary.warningGates).toBe(1);
    expect(matrix.summary.failingGates).toBe(0);
    expect(matrix.summary.latestRecordedAt).toEqual(new Date("2026-04-12T09:00:00.000Z"));
  });
});
