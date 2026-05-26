import { describe, expect, it } from "vitest";
import { buildBenchmarkMatrixReadModel } from "@/lib/helm-v2/benchmark-matrix";
import { buildRuntimeOperatorControlSummary } from "@/lib/helm-v2/runtime-operator-control-summary";
import { buildEnvironmentContractReadModel } from "@/lib/worker-skill-resource/environment-contract";
import { buildProjectSkillLibraryReadModel } from "@/lib/worker-skill-resource/project-skill-library";

describe("runtime operator control summary", () => {
  it("stays boundary-only when neither environment execution nor benchmark evidence is visible", () => {
    const projectSkillLibrary = buildProjectSkillLibraryReadModel();
    const environmentContract = buildEnvironmentContractReadModel({
      projectSkillLibrary,
      officialActionCoverage: [],
    });
    const benchmarkMatrix = buildBenchmarkMatrixReadModel();

    const summary = buildRuntimeOperatorControlSummary({
      environmentContract,
      benchmarkMatrix,
    });

    expect(summary.state).toBe("boundary_only");
    expect(summary.driver).toBe("environment_authority");
    expect(summary.authorityPosture).toBe("boundary_only");
    expect(summary.benchmarkWorkflowState).toBe("idle");
    expect(summary.focusTitle).toBeNull();
    expect(summary.focusHref).toBeNull();
  });

  it("prioritizes open execution follow-through over settled benchmark workflow", () => {
    const projectSkillLibrary = buildProjectSkillLibraryReadModel();
    const environmentContract = buildEnvironmentContractReadModel({
      projectSkillLibrary,
      officialActionCoverage: [
        {
          actionType: "crm.attach_note",
          defaultPath: "limited_auto",
          limitedAutoStatus: "eligible",
          executableLimitedAuto: true,
          boundaryReason: "Explicit acknowledgement still required.",
        },
      ],
      officialFollowThrough: [
        {
          id: "follow_1",
          followThroughStatus: "OPEN",
          followThroughResolutionStatus: "OPEN",
          followThroughSummary: "Receipt confirmation still pending.",
          followThroughNextAction: "Confirm the checklist receipt in CRM.",
          updatedAt: new Date("2026-04-12T08:15:00.000Z"),
        },
      ],
      humanExecutionCount: 1,
      officialFollowThroughCount: 1,
    });
    const benchmarkMatrix = buildBenchmarkMatrixReadModel({
      recordedRuns: [
        {
          benchmarkRunId: "benchmark_run_followthrough",
          runLabel: "Follow-through validation",
          commandSource: "benchmark:runtime-substrate",
          notes: null,
          recordedAt: new Date("2026-04-12T09:00:00.000Z"),
          recordedBy: "founder@demo.com",
          sourcePage: "/operating",
          outcomes: [
            {
              layerId: "runtime_eval",
              gateId: "runtime_substrate_eval",
              status: "pass",
              summary: "Runtime substrate eval passed.",
              evidenceRefs: ["npm run eval:helm-v2-1-phase2"],
            },
          ],
        },
      ],
      executionAcknowledgements: [
        {
          state: "acknowledged",
          acknowledgementEventId: "benchmark_ack_followthrough_1",
          benchmarkRunId: "benchmark_run_followthrough",
          requestEventId: "benchmark_request_followthrough_1",
          runLabel: "Follow-through validation",
          summary: "Operator reviewed the benchmark result and acknowledged the remaining follow-through.",
          recordedAt: new Date("2026-04-12T09:00:00.000Z"),
          recordedBy: "founder@demo.com",
          acknowledgedAt: new Date("2026-04-12T09:05:00.000Z"),
          acknowledgedBy: "operator@demo.com",
          sourcePage: "/operating",
          commandSource: "benchmark:runtime-substrate",
          boundaryNote:
            "Benchmark acknowledgement stays review-first and confirms visible benchmark evidence only. It does not create a new execution plane.",
        },
      ],
      executionFollowThrough: [
        {
          state: "resolved",
          requestEventId: "benchmark_followthrough_request_1",
          resolutionEventId: "benchmark_followthrough_resolved_1",
          benchmarkRunId: "benchmark_run_followthrough",
          acknowledgementEventId: "benchmark_ack_followthrough_1",
          runLabel: "Follow-through validation",
          summary: "Benchmark follow-through was resolved after operator review.",
          nextAction: "Re-check runtime eval on the next substrate review.",
          requestedAt: new Date("2026-04-12T09:08:00.000Z"),
          requestedBy: "operator@demo.com",
          resolvedAt: new Date("2026-04-12T09:14:00.000Z"),
          resolvedBy: "operator@demo.com",
          sourcePage: "/operating",
          commandSource: "benchmark:runtime-substrate",
          boundaryNote:
            "Benchmark follow-through stays operator-visible and manual. It does not create an automatic benchmark execution plane.",
        },
      ],
    });

    const summary = buildRuntimeOperatorControlSummary({
      environmentContract,
      benchmarkMatrix,
    });

    expect(summary.state).toBe("execution_follow_through");
    expect(summary.driver).toBe("environment_execution");
    expect(summary.executionSeamPosture).toBe("follow_through_open");
    expect(summary.benchmarkWorkflowState).toBe("follow_through_resolved");
    expect(summary.focusTitle).toBe("Receipt confirmation still pending.");
    expect(summary.focusHref).toBe("/operating");
  });

  it("surfaces requested benchmark reruns when environment execution is otherwise review-gated", () => {
    const projectSkillLibrary = buildProjectSkillLibraryReadModel();
    const environmentContract = buildEnvironmentContractReadModel({
      projectSkillLibrary,
      officialActionCoverage: [
        {
          actionType: "crm.attach_note",
          defaultPath: "limited_auto",
          limitedAutoStatus: "eligible",
          executableLimitedAuto: true,
          boundaryReason: "Explicit acknowledgement still required.",
        },
      ],
      humanExecutionCount: 1,
    });
    const benchmarkMatrix = buildBenchmarkMatrixReadModel({
      executionRequests: [
        {
          state: "requested",
          requestEventId: "benchmark_request_1",
          requestKey: "benchmark_request::rerun",
          requestedLayerIds: ["operator_usability"],
          requestedGateIds: ["build_gate", "e2e_gate"],
          summary: "Re-run operator usability gates after the latest surface change.",
          requestedAt: new Date("2026-04-12T09:15:00.000Z"),
          requestedBy: "reviewer@demo.com",
          sourcePage: "/operating",
          commandSource: "benchmark:runtime-substrate",
          boundaryNote:
            "Benchmark execution request stays operator-visible only. It does not auto-run benchmark commands or expand runtime authority.",
        },
      ],
    });

    const summary = buildRuntimeOperatorControlSummary({
      environmentContract,
      benchmarkMatrix,
    });

    expect(summary.state).toBe("benchmark_requested");
    expect(summary.driver).toBe("benchmark_workflow");
    expect(summary.benchmarkWorkflowState).toBe("requested");
    expect(summary.counts.benchmarkPendingRequests).toBe(1);
    expect(summary.focusTitle).toBe("Re-run operator usability gates after the latest surface change.");
    expect(summary.focusHref).toBe("/operating");
  });
});
