import type {
  HelmV21BenchmarkExecutionAcknowledgement,
  HelmV21BenchmarkExecutionFollowThrough,
  HelmV21BenchmarkExecutionLatestRun,
  HelmV21BenchmarkExecutionRequest,
  HelmV21BenchmarkExecutionRequestState,
  HelmV21BenchmarkExecutionWorkflowReadModel,
  HelmV21BenchmarkExecutionWorkflowState,
  HelmV21BenchmarkGate,
  HelmV21BenchmarkGateLatestOutcome,
  HelmV21BenchmarkGateOutcomeStatus,
  HelmV21BenchmarkMatrixLayer,
  HelmV21BenchmarkMatrixLayerId,
  HelmV21BenchmarkMatrixReadModel,
  HelmV21BenchmarkRecordedRun,
} from "@/lib/helm-v2/contracts";

const BENCHMARK_MATRIX_BOUNDARY_NOTE =
  "Benchmark matrix stays as a validation gate over existing harnesses, boundary checks, and operator-surface tests. It does not create a new execution plane or claim broader runtime maturity than current-main actually has.";
const BENCHMARK_EXECUTION_REQUEST_BOUNDARY_NOTE =
  "Benchmark execution request stays operator-visible only. It asks for a manual benchmark pass and does not auto-run commands or widen runtime authority.";
const BENCHMARK_EXECUTION_LATEST_RUN_BOUNDARY_NOTE =
  "Latest benchmark run remains validation evidence only. Recording a run does not create a new execution plane or imply broader runtime authority.";
const BENCHMARK_EXECUTION_ACKNOWLEDGEMENT_BOUNDARY_NOTE =
  "Benchmark acknowledgement stays review-first. It confirms visible benchmark evidence after operator review and does not auto-promote runtime maturity.";
const BENCHMARK_EXECUTION_FOLLOW_THROUGH_BOUNDARY_NOTE =
  "Benchmark follow-through stays operator-visible and manual. It tracks the next control-plane step after acknowledgement and does not create an automatic benchmark execution plane.";
const BENCHMARK_EXECUTION_WORKFLOW_BOUNDARY_NOTE =
  "Benchmark workflow stays review-first and manual. Request, recorded evidence, and acknowledgement remain operator-visible steps rather than an automatic benchmark execution plane.";

type BenchmarkGateDefinition = Omit<HelmV21BenchmarkGate, "latestOutcome">;
type BenchmarkLayerDefinition = Omit<
  HelmV21BenchmarkMatrixLayer,
  "outcomeStatus" | "recordedGateCount" | "latestRecordedAt" | "gates"
> & {
  gates: BenchmarkGateDefinition[];
};

const BENCHMARK_MATRIX_LAYERS: BenchmarkLayerDefinition[] = [
  {
    layerId: "runtime_eval",
    label: "Runtime eval",
    summary:
      "Core runtime substrate, continuity, and verified-coordination behavior must stay executable through explicit eval harness commands.",
    gates: [
      {
        gateId: "runtime_substrate_eval",
        label: "Runtime substrate harness",
        command: "npm run eval:helm-v2-1-phase2",
        passCriterion: "run-thread, debugger spine, typed interrupt/handoff, and continuity substrate evals all pass.",
        evidenceNote: "Uses the existing Helm v2.1 runtime substrate harness.",
      },
      {
        gateId: "continuity_recovery_eval",
        label: "Continuity recovery harness",
        command: "npm run eval:helm-v2-2-continuity-recovery",
        passCriterion: "continuity recovery and remediation analytics stay within bounded operator posture.",
        evidenceNote: "Uses the existing Helm v2.2 continuity recovery eval harness.",
      },
    ],
  },
  {
    layerId: "adapter_conformance",
    label: "Adapter conformance",
    summary:
      "Connector and official-action seams must stay narrow, review-first, and compatible with the constrained adapter/runtime contracts already frozen in current-main.",
    gates: [
      {
        gateId: "connector_contract_tests",
        label: "Connector contract tests",
        command:
          "npx vitest run lib/connectors/google.test.ts lib/connectors/wecom.test.ts lib/connectors/dingtalk.test.ts",
        passCriterion: "connector OAuth and read-only ingestion contracts remain workspace-scoped and test-backed.",
        evidenceNote: "Runs the existing connector conformance tests without introducing a new adapter framework.",
      },
      {
        gateId: "official_action_runtime_tests",
        label: "Official-action runtime tests",
        command: "npx vitest run lib/helm-v2/official-system-integration-runtime.test.ts",
        passCriterion: "limited-auto / manual-only / blocked official-action posture remains review-gated and honest.",
        evidenceNote: "Reuses the existing official-action runtime tests and coverage catalog.",
      },
    ],
  },
  {
    layerId: "boundary_regression",
    label: "Boundary regression",
    summary:
      "Boundary, wording, and contract discoverability regressions must stay blocked before runtime substrate changes are considered acceptable.",
    gates: [
      {
        gateId: "self_check",
        label: "Self-check",
        command: "npm run self-check",
        passCriterion: "plan, contract, helper, and operator-surface assets remain discoverable from repo entry points.",
        evidenceNote: "Ensures README / docs / scripts stay aligned with current-main truth.",
      },
      {
        gateId: "boundary_check",
        label: "Boundary check",
        command: "npm run check:boundaries",
        passCriterion: "review-first, non-commitment, and non-expansion boundary wording remains intact.",
        evidenceNote: "Uses the existing repo-wide boundary regression guard.",
      },
      {
        gateId: "quality_regression",
        label: "Quality regression",
        command: "npm run quality:regression",
        passCriterion: "shared reporting, narrative, worker/skill/resource, and IA contracts stay intact.",
        evidenceNote: "Uses the existing presentation and contract regression suite.",
      },
    ],
  },
  {
    layerId: "operator_usability",
    label: "Operator usability",
    summary:
      "Operator-facing runtime surfaces must stay loadable, reviewable, and navigable on the same current-main workflow without hidden authority jumps.",
    gates: [
      {
        gateId: "build_gate",
        label: "Build gate",
        command: "npm run build",
        passCriterion: "runtime surfaces compile and ship on current-main without broken imports or type drift.",
        evidenceNote: "Uses the production build as the first operator-surface gate.",
      },
      {
        gateId: "e2e_gate",
        label: "E2E operator gate",
        command: "npm run e2e",
        passCriterion: "operator-visible meeting, operating, continuity, and signup flows remain usable end-to-end.",
        evidenceNote: "Uses the existing Playwright suite as the operator usability gate.",
      },
    ],
  },
];

const DEFAULT_LATEST_OUTCOME: HelmV21BenchmarkGateLatestOutcome = {
  status: "not_recorded",
  benchmarkRunId: null,
  runLabel: null,
  summary: "No persisted benchmark outcome has been recorded for this gate yet.",
  evidenceRefs: [],
  recordedAt: null,
  recordedBy: null,
  sourcePage: null,
  commandSource: null,
  notes: null,
};

const EMPTY_EXECUTION_REQUEST: HelmV21BenchmarkExecutionRequest = {
  state: "not_requested",
  requestEventId: null,
  requestKey: null,
  requestedLayerIds: [],
  requestedGateIds: [],
  summary: "No benchmark rerun request is currently pending.",
  requestedAt: null,
  requestedBy: null,
  sourcePage: null,
  commandSource: null,
  boundaryNote: BENCHMARK_EXECUTION_REQUEST_BOUNDARY_NOTE,
};

const EMPTY_EXECUTION_LATEST_RUN: HelmV21BenchmarkExecutionLatestRun = {
  state: "not_recorded",
  runtimeEventId: null,
  benchmarkRunId: null,
  runLabel: null,
  summary: "No benchmark run has been recorded yet.",
  outcomeCount: 0,
  counts: {
    pass: 0,
    warning: 0,
    fail: 0,
  },
  recordedAt: null,
  recordedBy: null,
  sourcePage: null,
  commandSource: null,
  notes: null,
  boundaryNote: BENCHMARK_EXECUTION_LATEST_RUN_BOUNDARY_NOTE,
};

const EMPTY_EXECUTION_ACKNOWLEDGEMENT: HelmV21BenchmarkExecutionAcknowledgement = {
  state: "not_available",
  acknowledgementEventId: null,
  benchmarkRunId: null,
  requestEventId: null,
  runLabel: null,
  summary: "No benchmark acknowledgement is available yet.",
  recordedAt: null,
  recordedBy: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  sourcePage: null,
  commandSource: null,
  boundaryNote: BENCHMARK_EXECUTION_ACKNOWLEDGEMENT_BOUNDARY_NOTE,
};

const EMPTY_EXECUTION_FOLLOW_THROUGH: HelmV21BenchmarkExecutionFollowThrough = {
  state: "not_requested",
  requestEventId: null,
  resolutionEventId: null,
  benchmarkRunId: null,
  acknowledgementEventId: null,
  runLabel: null,
  summary: "No benchmark follow-through is visible yet.",
  nextAction: null,
  requestedAt: null,
  requestedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  sourcePage: null,
  commandSource: null,
  boundaryNote: BENCHMARK_EXECUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
};

function findLatestOutcomeForGate(
  layerId: HelmV21BenchmarkMatrixLayerId,
  gateId: string,
  recordedRuns: HelmV21BenchmarkRecordedRun[],
): HelmV21BenchmarkGateLatestOutcome {
  for (const run of recordedRuns) {
    const outcome = run.outcomes.find((item) => item.layerId === layerId && item.gateId === gateId);
    if (!outcome) continue;
    return {
      status: outcome.status,
      benchmarkRunId: run.benchmarkRunId,
      runLabel: run.runLabel,
      summary: outcome.summary,
      evidenceRefs: outcome.evidenceRefs,
      recordedAt: run.recordedAt,
      recordedBy: run.recordedBy,
      sourcePage: run.sourcePage,
      commandSource: run.commandSource,
      notes: run.notes,
    };
  }

  return DEFAULT_LATEST_OUTCOME;
}

function deriveLayerOutcomeStatus(gates: HelmV21BenchmarkGate[]): HelmV21BenchmarkGateOutcomeStatus {
  if (gates.some((item) => item.latestOutcome.status === "fail")) {
    return "fail";
  }
  if (gates.some((item) => item.latestOutcome.status === "warning")) {
    return "warning";
  }
  if (gates.length > 0 && gates.every((item) => item.latestOutcome.status === "pass")) {
    return "pass";
  }
  return "not_recorded";
}

function buildLatestRun(recordedRuns: HelmV21BenchmarkRecordedRun[]): HelmV21BenchmarkExecutionLatestRun {
  const latest = recordedRuns[0];
  if (!latest) {
    return EMPTY_EXECUTION_LATEST_RUN;
  }

  const counts = latest.outcomes.reduce(
    (summary, item) => {
      if (item.status === "pass") summary.pass += 1;
      if (item.status === "warning") summary.warning += 1;
      if (item.status === "fail") summary.fail += 1;
      return summary;
    },
    { pass: 0, warning: 0, fail: 0 },
  );

  return {
    state: "recorded",
    runtimeEventId: null,
    benchmarkRunId: latest.benchmarkRunId,
    runLabel: latest.runLabel,
    summary:
      latest.notes?.trim() ||
      `${latest.outcomes.length} benchmark gate outcome(s) were recorded for ${latest.runLabel ?? latest.benchmarkRunId}.`,
    outcomeCount: latest.outcomes.length,
    counts,
    recordedAt: latest.recordedAt,
    recordedBy: latest.recordedBy,
    sourcePage: latest.sourcePage,
    commandSource: latest.commandSource,
    notes: latest.notes,
    boundaryNote: BENCHMARK_EXECUTION_LATEST_RUN_BOUNDARY_NOTE,
  };
}

function resolveRequestState(
  latestRequest: HelmV21BenchmarkExecutionRequest | null,
  latestRecordedAt: Date | null,
): HelmV21BenchmarkExecutionRequestState {
  if (!latestRequest || !latestRequest.requestedAt) {
    return "not_requested";
  }
  if (!latestRecordedAt || latestRequest.requestedAt.getTime() > latestRecordedAt.getTime()) {
    return "requested";
  }
  return "fulfilled";
}

function buildExecutionRequest(input: {
  executionRequests: HelmV21BenchmarkExecutionRequest[];
  latestRecordedAt: Date | null;
}) {
  const latestRequest = input.executionRequests[0] ?? null;
  const state = resolveRequestState(latestRequest, input.latestRecordedAt);
  if (!latestRequest) {
    return EMPTY_EXECUTION_REQUEST;
  }

  const summary =
    state === "requested"
      ? latestRequest.summary || "A benchmark rerun request is pending."
      : latestRequest.summary || "The latest benchmark request has already been fulfilled by a recorded run.";

  return {
    ...latestRequest,
    state,
    summary,
    boundaryNote: BENCHMARK_EXECUTION_REQUEST_BOUNDARY_NOTE,
  };
}

function findLatestAcknowledgementForRun(
  latestRun: HelmV21BenchmarkExecutionLatestRun,
  executionAcknowledgements: HelmV21BenchmarkExecutionAcknowledgement[],
) {
  if (latestRun.state !== "recorded" || !latestRun.benchmarkRunId) {
    return null;
  }
  return executionAcknowledgements.find((item) => item.benchmarkRunId === latestRun.benchmarkRunId) ?? null;
}

function buildExecutionAcknowledgement(input: {
  latestRun: HelmV21BenchmarkExecutionLatestRun;
  executionAcknowledgements: HelmV21BenchmarkExecutionAcknowledgement[];
}): HelmV21BenchmarkExecutionAcknowledgement {
  if (input.latestRun.state !== "recorded") {
    return EMPTY_EXECUTION_ACKNOWLEDGEMENT;
  }

  const latestAcknowledgement = findLatestAcknowledgementForRun(
    input.latestRun,
    input.executionAcknowledgements,
  );
  if (!latestAcknowledgement) {
    return {
      ...EMPTY_EXECUTION_ACKNOWLEDGEMENT,
      state: "recorded",
      benchmarkRunId: input.latestRun.benchmarkRunId,
      runLabel: input.latestRun.runLabel,
      summary: `Benchmark run ${input.latestRun.runLabel ?? input.latestRun.benchmarkRunId} is recorded and waiting for operator acknowledgement.`,
      recordedAt: input.latestRun.recordedAt,
      recordedBy: input.latestRun.recordedBy,
      sourcePage: input.latestRun.sourcePage,
      commandSource: input.latestRun.commandSource,
    };
  }

  return {
    ...latestAcknowledgement,
    state: "acknowledged",
    recordedAt: latestAcknowledgement.recordedAt ?? input.latestRun.recordedAt,
    recordedBy: latestAcknowledgement.recordedBy ?? input.latestRun.recordedBy,
    boundaryNote: BENCHMARK_EXECUTION_ACKNOWLEDGEMENT_BOUNDARY_NOTE,
  };
}

function buildExecutionFollowThrough(input: {
  latestRun: HelmV21BenchmarkExecutionLatestRun;
  acknowledgement: HelmV21BenchmarkExecutionAcknowledgement;
  executionFollowThrough: HelmV21BenchmarkExecutionFollowThrough[];
}) {
  if (
    input.latestRun.state !== "recorded" ||
    !input.latestRun.benchmarkRunId ||
    input.acknowledgement.state !== "acknowledged"
  ) {
    return EMPTY_EXECUTION_FOLLOW_THROUGH;
  }

  const records = input.executionFollowThrough.filter(
    (item) => item.benchmarkRunId === input.latestRun.benchmarkRunId,
  );
  const latestRequest =
    records.find((item) => item.state === "open" && item.requestEventId) ?? null;
  const latestResolution =
    records.find((item) => item.state === "resolved" && item.resolutionEventId) ?? null;

  if (!latestRequest && !latestResolution) {
    return EMPTY_EXECUTION_FOLLOW_THROUGH;
  }

  const requestTime = latestRequest?.requestedAt?.getTime() ?? 0;
  const resolutionTime = latestResolution?.resolvedAt?.getTime() ?? 0;

  if (latestResolution && resolutionTime >= requestTime) {
    return {
      ...latestResolution,
      benchmarkRunId: latestResolution.benchmarkRunId ?? input.latestRun.benchmarkRunId,
      acknowledgementEventId:
        latestResolution.acknowledgementEventId ?? input.acknowledgement.acknowledgementEventId,
      runLabel: latestResolution.runLabel ?? input.latestRun.runLabel,
      requestedAt: latestRequest?.requestedAt ?? latestResolution.requestedAt,
      requestedBy: latestRequest?.requestedBy ?? latestResolution.requestedBy,
      sourcePage: latestResolution.sourcePage ?? input.latestRun.sourcePage,
      commandSource: latestResolution.commandSource ?? input.latestRun.commandSource,
      boundaryNote: BENCHMARK_EXECUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
    };
  }

  if (!latestRequest) {
    return EMPTY_EXECUTION_FOLLOW_THROUGH;
  }

  return {
    ...latestRequest,
    acknowledgementEventId:
      latestRequest.acknowledgementEventId ?? input.acknowledgement.acknowledgementEventId,
    runLabel: latestRequest.runLabel ?? input.latestRun.runLabel,
    sourcePage: latestRequest.sourcePage ?? input.latestRun.sourcePage,
    commandSource: latestRequest.commandSource ?? input.latestRun.commandSource,
    boundaryNote: BENCHMARK_EXECUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
  };
}

function deriveWorkflowState(input: {
  request: HelmV21BenchmarkExecutionRequest;
  latestRun: HelmV21BenchmarkExecutionLatestRun;
  acknowledgement: HelmV21BenchmarkExecutionAcknowledgement;
  followThrough: HelmV21BenchmarkExecutionFollowThrough;
}): HelmV21BenchmarkExecutionWorkflowState {
  if (input.request.state === "requested") {
    return "requested";
  }
  if (input.followThrough.state === "open") {
    return "follow_through_open";
  }
  if (input.followThrough.state === "resolved") {
    return "follow_through_resolved";
  }
  if (input.acknowledgement.state === "acknowledged") {
    return "acknowledged";
  }
  if (input.latestRun.state === "recorded") {
    return "recorded";
  }
  return "idle";
}

function buildWorkflowSummary(input: {
  state: HelmV21BenchmarkExecutionWorkflowState;
  request: HelmV21BenchmarkExecutionRequest;
  latestRun: HelmV21BenchmarkExecutionLatestRun;
  acknowledgement: HelmV21BenchmarkExecutionAcknowledgement;
  followThrough: HelmV21BenchmarkExecutionFollowThrough;
}) {
  switch (input.state) {
    case "requested":
      return `Benchmark workflow is waiting on a requested rerun across ${input.request.requestedLayerIds.length} layer(s) and ${input.request.requestedGateIds.length} gate(s).`;
    case "follow_through_open":
      return input.followThrough.summary;
    case "follow_through_resolved":
      return input.followThrough.summary;
    case "acknowledged":
      return `Latest benchmark run ${input.latestRun.runLabel ?? input.latestRun.benchmarkRunId ?? "unknown"} was acknowledged after operator review.`;
    case "recorded":
      return `Latest benchmark run ${input.latestRun.runLabel ?? input.latestRun.benchmarkRunId ?? "unknown"} is recorded and waiting for acknowledgement.`;
    default:
      return "Benchmark workflow is idle. No rerun request or recorded benchmark evidence is visible yet.";
  }
}

function buildExecutionWorkflowReadModel(input: {
  recordedRuns: HelmV21BenchmarkRecordedRun[];
  executionRequests: HelmV21BenchmarkExecutionRequest[];
  executionAcknowledgements: HelmV21BenchmarkExecutionAcknowledgement[];
  executionFollowThrough: HelmV21BenchmarkExecutionFollowThrough[];
}): HelmV21BenchmarkExecutionWorkflowReadModel {
  const latestRun = buildLatestRun(input.recordedRuns);
  const request = buildExecutionRequest({
    executionRequests: input.executionRequests,
    latestRecordedAt: latestRun.recordedAt,
  });
  const acknowledgement = buildExecutionAcknowledgement({
    latestRun,
    executionAcknowledgements: input.executionAcknowledgements,
  });
  const followThrough = buildExecutionFollowThrough({
    latestRun,
    acknowledgement,
    executionFollowThrough: input.executionFollowThrough,
  });
  const state = deriveWorkflowState({
    request,
    latestRun,
    acknowledgement,
    followThrough,
  });

  const pendingRequestCount = input.executionRequests.filter(
    (item) => resolveRequestState(item, latestRun.recordedAt) === "requested",
  ).length;
  const acknowledgedRunCount = new Set(
    input.executionAcknowledgements
      .map((item) => item.benchmarkRunId)
      .filter((item): item is string => Boolean(item)),
  ).size;

  return {
    state,
    summary: buildWorkflowSummary({
      state,
      request,
      latestRun,
      acknowledgement,
      followThrough,
    }),
    boundaryNote: BENCHMARK_EXECUTION_WORKFLOW_BOUNDARY_NOTE,
    pendingRequestCount,
    acknowledgedRunCount,
    latestRequestedAt: request.requestedAt,
    latestRecordedAt: latestRun.recordedAt,
    latestAcknowledgedAt: acknowledgement.acknowledgedAt,
    latestFollowThroughAt: followThrough.resolvedAt ?? followThrough.requestedAt,
    request,
    latestRun,
    acknowledgement,
    followThrough,
  };
}

export function buildBenchmarkMatrixReadModel(input?: {
  recordedRuns?: HelmV21BenchmarkRecordedRun[];
  executionRequests?: HelmV21BenchmarkExecutionRequest[];
  executionAcknowledgements?: HelmV21BenchmarkExecutionAcknowledgement[];
  executionFollowThrough?: HelmV21BenchmarkExecutionFollowThrough[];
}): HelmV21BenchmarkMatrixReadModel {
  const recordedRuns = [...(input?.recordedRuns ?? [])].sort(
    (left, right) => right.recordedAt.getTime() - left.recordedAt.getTime(),
  );
  const executionRequests = [...(input?.executionRequests ?? [])].sort((left, right) => {
    const leftTime = left.requestedAt?.getTime() ?? 0;
    const rightTime = right.requestedAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
  const executionAcknowledgements = [...(input?.executionAcknowledgements ?? [])].sort((left, right) => {
    const leftTime = left.acknowledgedAt?.getTime() ?? 0;
    const rightTime = right.acknowledgedAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
  const executionFollowThrough = [...(input?.executionFollowThrough ?? [])].sort((left, right) => {
    const leftTime = (left.resolvedAt ?? left.requestedAt)?.getTime() ?? 0;
    const rightTime = (right.resolvedAt ?? right.requestedAt)?.getTime() ?? 0;
    return rightTime - leftTime;
  });

  const layers: HelmV21BenchmarkMatrixLayer[] = BENCHMARK_MATRIX_LAYERS.map((layer) => {
    const gates: HelmV21BenchmarkGate[] = layer.gates.map((gate) => ({
      ...gate,
      latestOutcome: findLatestOutcomeForGate(layer.layerId, gate.gateId, recordedRuns),
    }));

    const recordedGateCount = gates.filter((item) => item.latestOutcome.status !== "not_recorded").length;
    const latestRecordedAt = gates.reduce<Date | null>((latest, gate) => {
      if (!gate.latestOutcome.recordedAt) {
        return latest;
      }
      if (!latest || gate.latestOutcome.recordedAt.getTime() > latest.getTime()) {
        return gate.latestOutcome.recordedAt;
      }
      return latest;
    }, null);

    return {
      ...layer,
      outcomeStatus: deriveLayerOutcomeStatus(gates),
      recordedGateCount,
      latestRecordedAt,
      gates,
    };
  });

  const gates = layers.flatMap((layer) => layer.gates);

  return {
    boundaryNote: BENCHMARK_MATRIX_BOUNDARY_NOTE,
    summary: {
      totalGates: gates.length,
      recordedGates: gates.filter((item) => item.latestOutcome.status !== "not_recorded").length,
      passingGates: gates.filter((item) => item.latestOutcome.status === "pass").length,
      warningGates: gates.filter((item) => item.latestOutcome.status === "warning").length,
      failingGates: gates.filter((item) => item.latestOutcome.status === "fail").length,
      latestRecordedAt: layers.reduce<Date | null>((latest, layer) => {
        if (!layer.latestRecordedAt) {
          return latest;
        }
        if (!latest || layer.latestRecordedAt.getTime() > latest.getTime()) {
          return layer.latestRecordedAt;
        }
        return latest;
      }, null),
    },
    workflow: buildExecutionWorkflowReadModel({
      recordedRuns,
      executionRequests,
      executionAcknowledgements,
      executionFollowThrough,
    }),
    layers,
  };
}
