import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryItemStatus, MemoryItemVerification } from "@prisma/client";
import type {
  HelmV21BenchmarkExecutionAcknowledgement,
  HelmV21BenchmarkExecutionFollowThrough,
  HelmV21BenchmarkExecutionRequest,
  HelmV21BenchmarkRecordedRun,
  HelmV21OperatorDebuggerTakeoverActivation,
  HelmV21OperatorDebuggerTakeoverAssistance,
  HelmV21OperatorDebuggerTakeoverFollowThrough,
  HelmV21OperatorDebuggerTakeoverRequest,
} from "@/lib/helm-v2/contracts";

const { dbMock, auditMock, analyticsMock } = vi.hoisted(() => ({
  dbMock: {
    consolidationJob: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    memoryCandidate: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    memoryPromotion: {
      upsert: vi.fn(),
    },
  },
  auditMock: {
    writeAuditLog: vi.fn(),
  },
  analyticsMock: {
    logEvent: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: auditMock.writeAuditLog,
}));

vi.mock("@/lib/analytics", () => ({
  logEvent: analyticsMock.logEvent,
}));

import {
  buildBudgetPosture,
  buildCoordinationTraceBridge,
  buildEdgeBriefMarkdown,
  buildPromotedRuntimeFacts,
  buildProblemSpaceDrafts,
  buildPruneTraceEntries,
  buildRuntimeContinuityCalibration,
  buildRuntimeContinuityEvidenceSurface,
  buildRuntimeContinuityPilotEffectivenessReview,
  buildRuntimeContinuityPilotSessionReview,
  buildRuntimeContinuityRecovery,
  buildRuntimeContinuityRunbook,
  buildRuntimeContinuitySop,
  buildRuntimePostureSnapshot,
  classifyPayloadStateSourceRisk,
  classifyReplayFidelityStatus,
  formatRuntimePostureSnapshotSummary,
  buildRuntimeRemediationAnalytics,
  buildRuntimeRemediationEffectiveness,
  buildRuntimeContinuityRisk,
  buildResumeFidelity,
  buildReflectionMemoryCandidateContract,
  buildReflectionCandidateReadout,
  buildReflectionJobOutputSummary,
  buildRuntimeJobQueueReadout,
  buildRuntimeNotebookState,
  buildRuntimePayloadHandleState,
  buildWorkspaceBusinessLoopGapReadout,
  buildWorkspaceRuntimeOperatorOverview,
  buildVerificationDecision,
  classifyCompositionFailure,
  acceptReflectionCandidate,
  dismissReflectionCandidate,
  deriveVerifiedMemoryCandidateDisposition,
  deriveCoordinationOutcome,
  estimateTokenCount,
  selectPayloadsForBudget,
  toPersistedPayloadContract,
  updateConsolidationJobStatus,
} from "@/lib/helm-v2/runtime-upgrade";
import { buildRunThreadContract } from "@/lib/helm-v2/run-thread-contract";
import { buildRunThreadPersistedControlPlaneLifecycleSnapshot } from "@/lib/helm-v2/run-thread-persisted-control-plane-lifecycle";

function buildTestRunThread(
  overrides: Partial<Parameters<typeof buildRunThreadContract>[0]> = {},
) {
  return buildRunThreadContract({
    id: "session_stub",
    workspaceId: "workspace_stub",
    sessionKey: "session::stub",
    status: "ACTIVE",
    currentStage: "review_confirmed",
    sourcePage: "/operating",
    boundaryNote: "No auto-send.",
    meetingId: "meeting_stub",
    opportunityId: null,
    companyId: null,
    replayableEventLog: "[]",
    resumedFromKey: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:05:00.000Z"),
    closedAt: null,
    checkpoints: [],
    ...overrides,
  });
}

function buildTestOperatorProgressSummary(
  updatedAt: Date,
  overrides: Partial<{
    state: "takeover_active" | "takeover_requested" | "human_input_requested" | "operator_control_attention" | "close_attention" | "review_gated" | "steady_state";
    driver: "takeover_activation" | "request_posture" | "operator_control" | "close_posture" | "steady_state";
    requestTakeoverState: "not_requested" | "requested";
    requestHumanInputState: "not_requested" | "requested";
    takeoverActivationState: "inactive" | "active" | "released";
    operatorControlState:
      | "boundary_only"
      | "review_gated"
      | "execution_pending"
      | "execution_review"
      | "execution_follow_through"
      | "benchmark_requested"
      | "benchmark_review"
      | "benchmark_follow_through";
    closePostureState:
      | "open"
      | "review_requestable"
      | "review_open"
      | "closeout_open"
      | "forward_open"
      | "close_ready"
      | "close_pending"
      | "kept_open"
      | "closed"
      | "stale"
      | "mismatch";
    currentOwner: string | null;
    summary: string;
    nextAction: string | null;
    counts: {
      activeRequests: number;
      pendingExecutionWrites: number;
      openExecutionFollowThrough: number;
      benchmarkPendingRequests: number;
      benchmarkFailingGates: number;
      benchmarkWarningGates: number;
      forwardAttention: number;
      openCloseout: number;
    };
  }> = {},
) {
  const { counts: overrideCounts, ...restOverrides } = overrides;
  const counts = {
    activeRequests: 0,
    pendingExecutionWrites: 0,
    openExecutionFollowThrough: 0,
    benchmarkPendingRequests: 0,
    benchmarkFailingGates: 0,
    benchmarkWarningGates: 0,
    forwardAttention: 0,
    openCloseout: 0,
    ...overrideCounts,
  };

  const summary = {
    state: "review_gated" as const,
    driver: "steady_state" as const,
    requestTakeoverState: "not_requested" as const,
    requestHumanInputState: "not_requested" as const,
    takeoverActivationState: "inactive" as const,
    operatorControlState: "review_gated" as const,
    closePostureState: "open" as const,
    currentOwner: null,
    summary: "Thread stays review-gated until the operator advances it.",
    nextAction: "Keep the thread review-gated until the operator explicitly advances it.",
    latestUpdatedAt: updatedAt,
    boundaryNote:
      "Operator progress summary stays read-only, review-first, and boundary-first. It does not widen runtime authority or create a workflow engine.",
    ...restOverrides,
  };

  return {
    ...summary,
    counts,
  };
}

function buildTestOperatorActionSummary(
  updatedAt: Date,
  overrides: Partial<{
    state:
      | "acknowledge_takeover_request"
      | "capture_human_input"
      | "complete_takeover"
      | "acknowledge_execution"
      | "review_execution"
      | "resolve_execution_followthrough"
      | "run_benchmark"
      | "acknowledge_benchmark"
      | "resolve_benchmark_followthrough"
      | "advance_close"
      | "keep_review_gated"
      | "observe";
    driver:
      | "takeover_activation"
      | "request_posture"
      | "operator_control"
      | "close_posture"
      | "steady_state";
    progressState:
      | "takeover_active"
      | "takeover_requested"
      | "human_input_requested"
      | "operator_control_attention"
      | "close_attention"
      | "review_gated"
      | "steady_state";
    requestTakeoverState: "not_requested" | "requested";
    requestHumanInputState: "not_requested" | "requested";
    takeoverActivationState: "inactive" | "active" | "released";
    operatorControlState:
      | "boundary_only"
      | "review_gated"
      | "execution_pending"
      | "execution_review"
      | "execution_follow_through"
      | "benchmark_requested"
      | "benchmark_review"
      | "benchmark_follow_through";
    closePostureState:
      | "open"
      | "review_requestable"
      | "review_open"
      | "closeout_open"
      | "forward_open"
      | "close_ready"
      | "close_pending"
      | "kept_open"
      | "closed"
      | "stale"
      | "mismatch";
    checkpointKey: string | null;
    currentOwner: string | null;
    summary: string;
    nextAction: string | null;
  }> = {},
) {
  return {
    state: "keep_review_gated" as const,
    driver: "steady_state" as const,
    progressState: "review_gated" as const,
    requestTakeoverState: "not_requested" as const,
    requestHumanInputState: "not_requested" as const,
    takeoverActivationState: "inactive" as const,
    operatorControlState: "review_gated" as const,
    closePostureState: "open" as const,
    focusTitle: null as string | null,
    focusHref: null as string | null,
    checkpointKey: null,
    currentOwner: null,
    summary: "Thread stays review-gated until the operator explicitly advances it.",
    nextAction: "Keep the thread review-gated until the operator explicitly advances it.",
    latestUpdatedAt: updatedAt,
    boundaryNote:
      "Operator action summary stays read-only, review-first, and boundary-first. It compresses the next bounded operator action from request posture, takeover activation, operator control, and close posture without widening authority or creating a workflow engine.",
    ...overrides,
  };
}

function buildTestTakeoverDebuggerState(
  overrides: Partial<{
    assistance: Partial<HelmV21OperatorDebuggerTakeoverAssistance>;
    request: Partial<HelmV21OperatorDebuggerTakeoverRequest>;
    activation: Partial<HelmV21OperatorDebuggerTakeoverActivation>;
    followThrough: Partial<HelmV21OperatorDebuggerTakeoverFollowThrough>;
    latestRemediationTrace: {
      id: string;
      action: string;
      executionStatus: string;
      summary: string;
      rollbackAnchorSummary: string | null;
      triggeredBy: string | null;
      createdAt: Date;
    } | null;
  }> = {},
) {
  const assistance: HelmV21OperatorDebuggerTakeoverAssistance = {
    posture: "blocked",
    recommendedAction: null,
    summary: "No trustworthy checkpoint anchor is available yet.",
    checklist: ["Keep the workflow review-gated until a bounded checkpoint anchor exists."],
    boundaryNote: "Review-first takeover only.",
    ...overrides.assistance,
  };
  const request: HelmV21OperatorDebuggerTakeoverRequest = {
    state: "not_requestable",
    requestEventId: null,
    acknowledgementEventId: null,
    action: null,
    checkpointId: null,
    checkpointKey: null,
    resumeToken: null,
    requestedAt: null,
    requestedBy: null,
    sourcePage: "/operating",
    acknowledgedAt: null,
    acknowledgedBy: null,
    summary: "No takeover request can be recorded until a trustworthy checkpoint anchor exists.",
    boundaryNote: "Request lane only.",
    ...overrides.request,
  };
  const activation: HelmV21OperatorDebuggerTakeoverActivation = {
    state: "inactive",
    startEventId: null,
    releaseEventId: null,
    requestEventId: null,
    acknowledgementEventId: null,
    action: null,
    checkpointId: null,
    checkpointKey: null,
    resumeToken: null,
    currentOwner: null,
    latestEventKind: "none",
    startedAt: null,
    startedBy: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    sourcePage: "/operating",
    summary: "Takeover has not started for this continuity pilot thread.",
    boundaryNote: "Activation lane only.",
    ...overrides.activation,
  };
  const followThrough: HelmV21OperatorDebuggerTakeoverFollowThrough = {
    state: "not_requestable",
    requestEventId: null,
    resolutionEventId: null,
    takeoverRequestEventId: null,
    acknowledgementEventId: null,
    startEventId: null,
    releaseEventId: null,
    action: null,
    checkpointId: null,
    checkpointKey: null,
    resumeToken: null,
    currentOwner: null,
    summary: "No takeover follow-through lane is open for this continuity pilot thread.",
    nextAction: null,
    requestedAt: null,
    requestedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    sourcePage: "/operating",
    boundaryNote: "Follow-through stays manual.",
    ...overrides.followThrough,
  };
  return {
    debuggerTakeoverAssistance: assistance,
    debuggerTakeoverRequest: request,
    debuggerTakeoverActivation: activation,
    debuggerTakeoverFollowThrough: followThrough,
    debuggerLatestRemediationTrace: overrides.latestRemediationTrace ?? null,
  };
}

const benchmarkMatrixRunsFixture = [
  {
    benchmarkRunId: "benchmark_run_1",
    runLabel: "Workspace benchmark validation",
    commandSource: "benchmark:runtime-substrate",
    notes: "One runtime gate is still watch-band.",
    recordedAt: new Date("2026-04-03T12:01:00.000Z"),
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
      {
        layerId: "runtime_eval",
        gateId: "continuity_recovery_eval",
        status: "warning",
        summary: "Continuity recovery eval stayed in watch band.",
        evidenceRefs: ["npm run eval:helm-v2-2-continuity-recovery"],
      },
      {
        layerId: "operator_usability",
        gateId: "build_gate",
        status: "pass",
        summary: "Build gate passed on current-main.",
        evidenceRefs: ["npm run build"],
      },
    ],
  },
] satisfies HelmV21BenchmarkRecordedRun[];

const benchmarkExecutionRequestsFixture = [
  {
    state: "fulfilled",
    requestEventId: "benchmark_request_fixture_1",
    requestKey: "benchmark_request::workspace-validation",
    requestedLayerIds: ["runtime_eval", "boundary_regression"],
    requestedGateIds: ["runtime_substrate_eval", "self_check"],
    summary: "Run runtime and boundary benchmark gates before workspace review.",
    requestedAt: new Date("2026-04-03T11:58:00.000Z"),
    requestedBy: "operator@demo.com",
    sourcePage: "/operating",
    commandSource: "benchmark:runtime-substrate",
    boundaryNote:
      "Benchmark execution request stays operator-visible only. It does not auto-run benchmark commands or expand runtime authority.",
  },
] satisfies HelmV21BenchmarkExecutionRequest[];

const benchmarkExecutionAcknowledgementsFixture = [
  {
    state: "acknowledged",
    acknowledgementEventId: "benchmark_ack_fixture_1",
    benchmarkRunId: "benchmark_run_1",
    requestEventId: "benchmark_request_fixture_1",
    runLabel: "Workspace benchmark validation",
    summary: "Operator reviewed the benchmark result and accepted the remaining watch-band caveat.",
    recordedAt: new Date("2026-04-03T12:01:00.000Z"),
    recordedBy: "founder@demo.com",
    acknowledgedAt: new Date("2026-04-03T12:05:00.000Z"),
    acknowledgedBy: "operator@demo.com",
    sourcePage: "/operating",
    commandSource: "benchmark:runtime-substrate",
    boundaryNote:
      "Benchmark acknowledgement stays review-first and confirms visible benchmark evidence only. It does not create a new execution plane.",
  },
] satisfies HelmV21BenchmarkExecutionAcknowledgement[];

const benchmarkExecutionFollowThroughFixture = [
  {
    state: "resolved",
    requestEventId: "benchmark_followthrough_request_fixture_1",
    resolutionEventId: "benchmark_followthrough_resolved_fixture_1",
    benchmarkRunId: "benchmark_run_1",
    acknowledgementEventId: "benchmark_ack_fixture_1",
    runLabel: "Workspace benchmark validation",
    summary: "Benchmark follow-through was resolved after the operator closed the remaining watch-band note.",
    nextAction: "Re-check runtime eval on the next substrate review.",
    requestedAt: new Date("2026-04-03T12:06:00.000Z"),
    requestedBy: "operator@demo.com",
    resolvedAt: new Date("2026-04-03T12:12:00.000Z"),
    resolvedBy: "operator@demo.com",
    sourcePage: "/operating",
    commandSource: "benchmark:runtime-substrate",
    boundaryNote:
      "Benchmark follow-through stays operator-visible and manual. It does not create an automatic benchmark execution plane.",
  },
] satisfies HelmV21BenchmarkExecutionFollowThrough[];

describe("Helm v2.1 runtime upgrade helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estimates token counts conservatively", () => {
    expect(estimateTokenCount("abcd")).toBe(1);
    expect(estimateTokenCount("abcdefgh")).toBe(2);
  });

  it("keeps always-on payloads before on-demand payloads inside the token budget", () => {
    const decision = selectPayloadsForBudget(
      [
        toPersistedPayloadContract({
          payloadKey: "a",
          sourceType: "meeting_note",
          sourceId: "1",
          label: "Agenda",
          loadPolicy: "always_on",
          text: "Agenda and goal",
          loadedByDefault: true,
        }),
        toPersistedPayloadContract({
          payloadKey: "b",
          sourceType: "meeting_note",
          sourceId: "1",
          label: "Summary",
          loadPolicy: "always_on",
          text: "Summary with confirmed next step",
          loadedByDefault: true,
        }),
        toPersistedPayloadContract({
          payloadKey: "c",
          sourceType: "meeting_transcript",
          sourceId: "1",
          label: "Transcript",
          loadPolicy: "on_demand",
          text: "Long transcript content that should be pruned first when the budget is tight.",
          loadedByDefault: false,
        }),
      ],
      20,
    );

    expect(decision.loadedHandles.length).toBeGreaterThan(0);
    expect(decision.prunedHandles.length).toBeGreaterThan(0);
    expect(decision.loadedHandles.some((item) => item.includes("/a"))).toBe(true);
  });

  it("projects synced persisted control-plane lifecycle state into the continuity queue", () => {
    const runtimeSession = {
      id: "session_persisted_queue_1",
      workspaceId: "workspace_persisted_queue",
      label: "Persisted lifecycle session",
      sessionKey: "session::persisted-queue",
      status: "ACTIVE",
      currentStage: "review_confirmed",
      sourcePage: "/meetings/meeting_persisted_queue_1",
      boundaryNote: "Review-first runtime only.",
      replayableEventLog: JSON.stringify([]),
      meetingId: "meeting_persisted_queue_1",
      opportunityId: null,
      companyId: null,
      budgetTokenLimit: 100,
      budgetTokenUsed: 75,
      prunedTokenCount: 10,
      resumedFromKey: null,
      controlPlaneLifecycleJson: null,
      controlPlaneLifecycleUpdatedAt: null,
      createdAt: new Date("2026-04-13T10:00:00.000Z"),
      updatedAt: new Date("2026-04-13T10:05:00.000Z"),
      closedAt: null,
      meetingFrequencyBand: "RECURRING" as const,
      participantRolePosture: "OPERATOR_LED" as const,
      contextEditEvents: [],
      checkpoints: [
        {
          id: "checkpoint_persisted_queue_1",
          checkpointKey: "checkpoint::persisted-queue",
          label: "persisted_anchor",
          status: "READY",
          summary: "Persisted lifecycle anchor is ready.",
          snapshotJson: "{}",
          createdAt: new Date("2026-04-13T10:02:00.000Z"),
          updatedAt: new Date("2026-04-13T10:02:00.000Z"),
        },
      ],
      notebook: {
        sessionSummary: "Persisted lifecycle snapshot is already stored.",
        decisionSummary: null,
        blockerSummary: null,
        pendingQuestions: JSON.stringify([]),
        openLoopSummary: "Keep the run thread review-first.",
        boundaryNote: "Review-first runtime only.",
      },
      problemSpaces: [],
      memoryCandidates: [],
      memoryPromotions: [],
      verificationReports: [],
      handoffPackets: [],
      persistedPayloadHandles: [],
      remediationEvents: [],
      requestEvents: [],
    };

    const baselineOverview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_persisted_queue",
      sessionCounts: { total: 1, active: 1 },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      runtimeSessions: [runtimeSession],
    });
    const persistedSnapshot = buildRunThreadPersistedControlPlaneLifecycleSnapshot(
      baselineOverview.continuityQueue[0]!.runThread,
      new Date("2026-04-13T10:06:00.000Z"),
    );

    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_persisted_queue",
      sessionCounts: { total: 1, active: 1 },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      runtimeSessions: [
        {
          ...runtimeSession,
          controlPlaneLifecycleJson: JSON.stringify(persistedSnapshot),
          controlPlaneLifecycleUpdatedAt: new Date("2026-04-13T10:06:00.000Z"),
        },
      ],
    });

    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.state).toBe("synced");
    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.guardPolicy.state).toBe(
      "reuse_current_snapshot",
    );
    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.compactionPolicy.state).toBe(
      "current",
    );
    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.reconciliationPolicy.state).toBe(
      "steady",
    );
    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.repairPolicy.state).toBe(
      "not_required",
    );
    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.writeSide.state).toBe(
      "human_input_anchor_written",
    );
    expect(overview.continuityQueue[0]?.debuggerTraceContractState).toBe("human_input_ready");
    expect(overview.continuityQueue[0]?.debuggerTraceContractDriver).toBe("human_input");
    expect(overview.continuityQueue[0]?.debuggerTraceContractAnchor).toBe("human_input");
    expect(overview.continuityQueue[0]?.debuggerTraceContractCheckpointKey).toBe(
      "checkpoint::persisted-queue",
    );
    expect(overview.continuityQueue[0]?.debuggerTraceContractSummary).toContain(
      "waiting on human input",
    );
    expect(overview.continuityQueue[0]?.debuggerWriteContractState).toBe("human_input_active");
    expect(overview.continuityQueue[0]?.debuggerWriteContractDriver).toBe("human_input");
    expect(overview.continuityQueue[0]?.debuggerWriteContractAnchor).toBe("human_input");
    expect(overview.continuityQueue[0]?.debuggerWriteContractCheckpointKey).toBe(
      "checkpoint::persisted-queue",
    );
    expect(overview.continuityQueue[0]?.debuggerWriteContractSummary).toContain(
      "current bounded recovery write anchor",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryActionContractState).toBe("requestable");
    expect(overview.continuityQueue[0]?.debuggerRecoveryActionContractDriver).toBe(
      "takeover_request",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryActionContractAction).toBe(
      "SAVE_RECOVERY_CHECKPOINT",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryActionContractCheckpointKey).toBe(
      "checkpoint::persisted-queue",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryLifecycleContractState).toBe(
      "request_lane",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryLifecycleContractDriver).toBe(
      "takeover_request",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryLifecycleContractAnchor).toBe(
      "human_input",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryLifecycleContractTransition).toBe(
      "request_takeover",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryLifecycleContractSummary).toContain(
      "request lane",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryTransitionContractState).toBe(
      "transition_ready",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryTransitionContractDriver).toBe(
      "takeover_request",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryTransitionContractAnchor).toBe(
      "human_input",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryTransitionContractTransition).toBe(
      "request_takeover",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryTransitionContractSummary).toContain(
      "ready for request_takeover",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryStateMachinePhase).toBe(
      "takeover_request",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryStateMachineTransitionState).toBe(
      "ready",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryStateMachineCurrentTransition).toBe(
      "request_takeover",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryStateMachineSummary).toContain(
      "state machine is in takeover_request phase",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryExecutionContractState).toBe(
      "executable",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryExecutionContractTransition).toBe(
      "request_takeover",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryExecutionContractCanExecute).toBe(true);
    expect(overview.continuityQueue[0]?.debuggerRecoveryExecutionContractSummary).toContain(
      "ready for request_takeover",
    );
    expect(overview.continuityQueue[0]?.debuggerPersistedLifecycleTraceState).toBe("aligned");
    expect(overview.continuityQueue[0]?.debuggerPersistedLifecycleTraceAnchor).toBe("human_input");
    expect(overview.continuityQueue[0]?.debuggerPersistedLifecycleTrace.checkpointKey).toBe(
      "checkpoint::persisted-queue",
    );
    expect(overview.continuityQueue[0]?.debuggerPersistedLifecycleTrace.refreshReason).toBeNull();
    expect(overview.continuityQueue[0]?.debuggerPersistedLifecycleTrace.refreshSource).toBe(
      "暂无内容",
    );
    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.snapshot?.threadId).toBe(
      "session::persisted-queue",
    );
    expect(overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.snapshot?.resumeState).toBe(
      "ready",
    );
    expect(
      overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.snapshot?.replayRequestMode,
    ).toBe("latest_checkpoint");
    expect(
      overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.snapshot?.humanInputCheckpointState,
    ).toBe("checkpoint_ready");
    expect(
      overview.continuityQueue[0]?.runThread.persistedControlPlaneLifecycle.snapshot?.writeAnchor,
    ).toBe("human_input");
  });

  it("marks promise-sensitive runtime output as verification-blocked", () => {
    const verification = buildVerificationDecision({
      facts: [{ content: "Customer asked for a launch date.", evidence: ["meeting:1"] }],
      inferredCount: 1,
      riskFlags: [{ severity: "high", promiseRisk: true, reason: "Delivery date promise risk" }],
      promotedMemoryCount: 0,
    });

    expect(verification.status).toBe("blocked");
    expect(verification.truthScore).toBeLessThan(90);
    expect(verification.blockedReasons.length).toBeGreaterThan(0);
  });

  it("forces verified memory candidates into promote, reject, or defer", () => {
    expect(
      deriveVerifiedMemoryCandidateDisposition({
        reviewMode: "confirm",
        sourceStatus: MemoryItemStatus.PROMOTED,
        sourceVerification: MemoryItemVerification.HUMAN_CONFIRMED,
        verificationStatus: "passed",
        hasTruthConflict: false,
      }),
    ).toBe("PROMOTED");
    expect(
      deriveVerifiedMemoryCandidateDisposition({
        reviewMode: "reject",
        sourceStatus: MemoryItemStatus.DRAFT,
        sourceVerification: MemoryItemVerification.HUMAN_CONFIRMED,
        verificationStatus: "passed",
        hasTruthConflict: false,
      }),
    ).toBe("REJECTED");
    expect(
      deriveVerifiedMemoryCandidateDisposition({
        reviewMode: "confirm",
        sourceStatus: MemoryItemStatus.DRAFT,
        sourceVerification: MemoryItemVerification.INFERRED,
        verificationStatus: "needs_review",
        hasTruthConflict: true,
      }),
    ).toBe("DEFERRED");
  });

  it("only forms operational problem spaces from confirmed runtime truth", () => {
    const passedVerification = buildVerificationDecision({
      facts: [{ content: "Security review owner is Alice.", evidence: ["meeting:1"] }],
      inferredCount: 0,
      riskFlags: [],
      promotedMemoryCount: 1,
    });
    const confirmedDrafts = buildProblemSpaceDrafts({
      meetingId: "meeting_1",
      meetingTitle: "Security review sync",
      recommendedNextAction: "Assign Alice to send the internal security checklist.",
      blockers: ["Security review owner still needs the final checklist."],
      verification: passedVerification,
      ownerHint: "Alice",
      evidenceRefs: ["meeting:1"],
      allowOperationalProblemSpaces: true,
    });

    const verification = buildVerificationDecision({
      facts: [{ content: "Security review is still pending.", evidence: [] }],
      inferredCount: 1,
      riskFlags: [],
      promotedMemoryCount: 0,
    });
    const drafts = buildProblemSpaceDrafts({
      meetingId: "meeting_1",
      meetingTitle: "Security review sync",
      recommendedNextAction: "Assign the security review owner.",
      blockers: ["Security review owner is still missing."],
      verification,
      ownerHint: "Alice",
      evidenceRefs: ["meeting:1"],
      allowOperationalProblemSpaces: false,
    });
    const brief = buildEdgeBriefMarkdown({
      audience: "PLAYER_COACH",
      title: drafts[0].title,
      summary: drafts[0].summary,
      nextStep: drafts[0].nextStep,
      ownerHint: drafts[0].ownerHint,
      groundingSummary: "Grounded on confirmed runtime signals. Evidence trace: meeting:1.",
      truthPosture: "This brief stays in review posture until the missing evidence is confirmed.",
      driSummary: "DRI: Alice. Assigned so one owner carries the review follow-through.",
    });

    expect(confirmedDrafts.some((item) => item.title === "Next-step alignment")).toBe(true);
    expect(confirmedDrafts.some((item) => item.title === "Blocker resolution")).toBe(true);
    expect(confirmedDrafts.some((item) => item.title === "Truth boundary review")).toBe(false);
    expect(drafts.some((item) => item.title === "Next-step alignment")).toBe(false);
    expect(drafts.some((item) => item.title === "Truth boundary review")).toBe(true);
    expect(drafts.some((item) => item.title === "Blocker resolution")).toBe(false);
    expect(brief).toContain("operating guidance only");
    expect(brief).toContain("Grounded on confirmed runtime signals");
    expect(brief).toContain("DRI: Alice");
    expect(classifyCompositionFailure({ verificationStatus: verification.status, prunedTokenCount: 0 })).toBe("VERIFICATION_FAIL");
    expect(
      deriveCoordinationOutcome({
        verificationStatus: verification.status,
        hasTruthConflict: true,
      }),
    ).toBe("waiting_on_signal");
  });

  it("builds an honest coordination trace bridge without overclaiming downstream execution", () => {
    const trace = buildCoordinationTraceBridge({
      problemSpaces: [
        {
          id: "problem_1",
          title: "Security review owner",
          status: "ASSIGNED",
          ownerHint: "Alice",
          evidenceRefs: ["meeting:1", "memory:1"],
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          updatedAt: new Date("2026-04-03T10:00:00.000Z"),
          driAssignments: [
            {
              assignedUserName: "Alice",
              assignedByName: "Bob",
              note: "Assigned so one person owns the confirmed next step.",
            },
          ],
        },
      ],
      humanExecutions: [
        {
          id: "human_1",
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          status: "EXECUTED",
          executionIntent: "Send the internal security checklist.",
          executionOwnerName: "Alice",
          followThroughStatus: "shared with customer success",
          executedAt: new Date("2026-04-03T11:00:00.000Z"),
          updatedAt: new Date("2026-04-03T11:00:00.000Z"),
        },
      ],
      officialFollowThrough: [
        {
          id: "follow_1",
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          followThroughStatus: "OPEN",
          followThroughResolutionStatus: "OPEN",
          followThroughOwnerName: "Alice",
          followThroughNextAction: "Confirm the checklist receipt in CRM.",
          followThroughSummary: "Follow-through still needs receipt confirmation.",
          updatedAt: new Date("2026-04-03T12:00:00.000Z"),
        },
      ],
    });

    expect(trace.items).toHaveLength(1);
    expect(trace.items[0]?.posture).toBe("FOLLOW_THROUGH_OPEN");
    expect(trace.items[0]?.summary).toContain("post-write handling");
    expect(trace.items[0]?.linkageSummary).toContain("meeting and opportunity");
    expect(trace.items[0]?.humanExecutionSummary).toContain("executed");
    expect(trace.items[0]?.officialFollowThroughSummary).toContain("open");
    expect(trace.boundaryNote).toContain("does not auto-execute");
  });

  it("derives safe, watch, prune, and compact budget posture without widening authority", () => {
    expect(
      buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 40,
        prunedTokenCount: 0,
      }).state,
    ).toBe("SAFE");
    expect(
      buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 80,
        prunedTokenCount: 0,
      }).state,
    ).toBe("WATCH");
    expect(
      buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 82,
        prunedTokenCount: 35,
      }).state,
    ).toBe("PRUNE");
    expect(
      buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 68,
        prunedTokenCount: 20,
        latestCheckpointStatus: "RESUMED",
      }).state,
    ).toBe("COMPACT");
  });

  it("builds notebook state and prune trace as operational continuity", () => {
    const notebookState = buildRuntimeNotebookState({
      sessionLabel: "Acme security session",
      sessionStatus: "AWAITING_REVIEW",
      boundaryNote: "No auto-send.",
      meetingLabel: "Security review sync",
      opportunityLabel: "Acme expansion",
      companyLabel: "Acme",
      notebook: {
        sessionSummary: "Runtime is active.",
        decisionSummary: "Keep the checklist internal; Alice owns the next step.",
        blockerSummary: "Security owner still missing one answer.",
        pendingQuestions: JSON.stringify(["Which reviewer owns the final answer?"]),
        openLoopSummary: "Assign Alice to send the internal checklist by Friday.",
        boundaryNote: "No auto-send.",
      },
      verification: {
        status: "needs_review",
        blockedReasons: ["One answer still lacks evidence."],
      },
      problemSpaces: [
        {
          title: "Security blocker",
          nextStep: "Assign Alice to close the final checklist gap.",
          status: "WAITING_ON_SIGNAL",
          ownerHint: "Alice",
          evidenceRefs: ["meeting:1", "memory:1"],
        },
      ],
      promotedFacts: [
        {
          summary: "Checklist stays internal until review closes.",
          evidenceRefs: ["meeting:1"],
        },
      ],
      truthConflicts: [
        {
          status: "OPEN",
          summary: "One checklist answer still conflicts with the thread summary.",
        },
      ],
    });

    const pruneTrace = buildPruneTraceEntries({
      edits: [
        {
          id: "edit_1",
          strategy: "manual_budget_prune",
          beforeTokenCount: 140,
          afterTokenCount: 80,
          removedHandles: JSON.stringify(["payload://meeting_transcript/1/transcript"]),
          removedSummary: "Pruned transcript overflow into persisted payload handles.",
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        },
      ],
      payloads: [
        {
          handle: "payload://meeting_transcript/1/transcript",
          label: "Live transcript",
          summary: "Long transcript now externalized behind a handle.",
          estimatedTokens: 60,
          sourceType: "meeting_transcript",
        },
      ],
      notebookState,
      budgetPosture: buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 80,
        prunedTokenCount: 60,
      }),
    });

    expect(notebookState.objective).toContain("Assign Alice");
    expect(notebookState.relevantObjects).toContain("Meeting: Security review sync");
    expect(notebookState.confirmedFacts[0]).toContain("Checklist stays internal");
    expect(notebookState.blockers.some((item) => item.includes("Security owner"))).toBe(true);
    expect(notebookState.nextActions.some((item) => item.includes("Friday"))).toBe(true);
    expect(notebookState.openQuestions).toContain("Which reviewer owns the final answer?");
    expect(pruneTrace[0]?.protectedItems.some((item) => item.includes("No auto-send"))).toBe(true);
    expect(pruneTrace[0]?.replacementSummary).toContain("handle + preview + summary");
  });

  it("preserves checkpoint objective from notebook summary during resume-style rebuilds", () => {
    const notebookState = buildRuntimeNotebookState({
      sessionLabel: "Acme security session",
      sessionStatus: "ACTIVE",
      boundaryNote: "No auto-send.",
      meetingLabel: "Security review sync",
      notebook: {
        sessionSummary:
          "Objective: Keep continuity posture readable before using downstream runtime state. Confirmed facts: Checklist stays internal until review closes. Blockers: One reviewer answer is still outstanding. Review posture: active.",
        decisionSummary: "Do not send anything externally.",
        blockerSummary: "One reviewer answer is still outstanding.",
        pendingQuestions: JSON.stringify(["Which reviewer closes the final answer?"]),
        openLoopSummary: "Confirm the reviewer answer before downstream follow-up.",
        boundaryNote: "No auto-send.",
      },
      verification: {
        status: "passed",
        blockedReasons: [],
      },
      problemSpaces: [
        {
          title: "Continuity replay drift",
          nextStep: "Confirm the reviewer answer before downstream follow-up.",
          status: "WAITING_ON_SIGNAL",
          ownerHint: "Founder / COO",
          evidenceRefs: ["meeting:recoverable"],
        },
      ],
      promotedFacts: [
        {
          summary: "Keep the follow-through internal until review closes.",
          evidenceRefs: ["meeting:recoverable"],
        },
      ],
      truthConflicts: [],
    });

    expect(notebookState.objective).toBe("Keep continuity posture readable before using downstream runtime state");
  });

  it("builds a review-first reflection summary without widening authority", () => {
    const notebookState = buildRuntimeNotebookState({
      sessionLabel: "Acme security session",
      sessionStatus: "COMPLETED",
      boundaryNote: "No auto-send.",
      meetingLabel: "Security review sync",
      opportunityLabel: "Acme expansion",
      companyLabel: "Acme",
      notebook: {
        sessionSummary: "Runtime is active.",
        decisionSummary: "Keep the checklist internal.",
        blockerSummary: "Security owner still missing one answer.",
        pendingQuestions: JSON.stringify(["Who closes the final answer?"]),
        openLoopSummary: "Assign Alice to close the final checklist gap.",
        boundaryNote: "No auto-send.",
      },
      verification: {
        status: "passed",
        blockedReasons: [],
      },
      problemSpaces: [
        {
          title: "Security blocker",
          nextStep: "Assign Alice to close the final checklist gap.",
          status: "ACTIVE",
          ownerHint: "Alice",
          evidenceRefs: ["meeting:1"],
        },
      ],
      promotedFacts: [
        {
          summary: "Checklist stays internal until review closes.",
          evidenceRefs: ["meeting:1"],
        },
      ],
      truthConflicts: [],
    });

    const summary = buildReflectionJobOutputSummary({
      meetingLabel: "Security review sync",
      notebookState,
    });

    expect(summary).toContain("trusted carry-forward context");
    expect(summary).toContain("Checklist stays internal");
    expect(summary).toContain("review-first");
    expect(summary).toContain("does not auto-promote memory");
    expect(summary).not.toContain("send authority");
  });

  it("builds a verified reflection memory candidate without auto-promotion", () => {
    const notebookState = buildRuntimeNotebookState({
      sessionLabel: "Acme security session",
      sessionStatus: "COMPLETED",
      boundaryNote: "No auto-send.",
      meetingLabel: "Security review sync",
      opportunityLabel: "Acme expansion",
      companyLabel: "Acme",
      notebook: {
        sessionSummary: "Runtime is active.",
        decisionSummary: "Keep the checklist internal.",
        blockerSummary: "Security owner still missing one answer.",
        pendingQuestions: JSON.stringify(["Who closes the final answer?"]),
        openLoopSummary: "Assign Alice to close the final checklist gap.",
        boundaryNote: "No auto-send.",
      },
      verification: {
        status: "passed",
        blockedReasons: [],
      },
      problemSpaces: [
        {
          title: "Security blocker",
          nextStep: "Assign Alice to close the final checklist gap.",
          status: "ACTIVE",
          ownerHint: "Alice",
          evidenceRefs: ["meeting:1"],
        },
      ],
      promotedFacts: [
        {
          summary: "Checklist stays internal until review closes.",
          evidenceRefs: ["meeting:1"],
        },
      ],
      truthConflicts: [],
    });

    const candidate = buildReflectionMemoryCandidateContract({
      meetingLabel: "Security review sync",
      notebookState,
    });

    expect(candidate.status).toBe("VERIFIED");
    expect(candidate.sourceVerification).toBe("human_confirmed_reflection");
    expect(candidate.sourceStatus).toBe("trusted_runtime_compaction");
    expect(candidate.summary).toContain("Carry forward Security review sync");
    expect(candidate.summary).toContain("Checklist stays internal");
    expect(candidate.reviewerNote).toContain("trusted runtime state");
    expect(candidate.reviewerNote).toContain("separate review path");
  });

  it("builds a runtime job readout without widening job authority", () => {
    const readout = buildRuntimeJobQueueReadout({
      id: "job_1",
      jobType: "meeting_reflection",
      status: "QUEUED",
      inputSummary: "Reflection queued after human-confirmed review.",
      outputSummary: "Carry-forward summary refreshed.",
      reviewPosture: "Review-first and candidate-only.",
      createdAt: new Date("2026-04-03T09:00:00.000Z"),
      runtimeSession: {
        meetingId: "meeting_1",
      },
    });

    expect(readout.jobType).toBe("meeting_reflection");
    expect(readout.reviewPosture).toContain("candidate-only");
    expect(readout.href).toBe("/meetings/meeting_1");
    expect(readout.meetingId).toBe("meeting_1");
    expect(readout.pausedAt).toBeNull();
    expect(readout.completedAt).toBeNull();
  });

  it("builds a reflection candidate readout that stays review-safe", () => {
    const readout = buildReflectionCandidateReadout({
      id: "candidate_1",
      status: "VERIFIED",
      summary: "Carry forward Security review sync. Checklist stays internal.",
      reviewerNote:
        "Reflection candidate is derived only from trusted runtime state and still needs a separate review path.",
      sourceVerification: "human_confirmed_reflection",
      sourceStatus: "trusted_runtime_compaction",
      evidenceRefs: JSON.stringify(["meeting:1", "memory:1"]),
      createdAt: new Date("2026-04-03T09:05:00.000Z"),
      runtimeSession: {
        id: "session_1",
        label: "Acme security session",
        meetingId: "meeting_1",
      },
    });

    expect(readout.title).toContain("carry-forward");
    expect(readout.reviewPosture).toContain("trusted runtime state");
    expect(readout.sourceClasses).toContain("human_confirmed_reflection");
    expect(readout.sourceClasses).toContain("trusted_runtime_compaction");
    expect(readout.evidenceSummary).toContain("meeting:1");
    expect(readout.href).toBe("/meetings/meeting_1");
  });

  it("dismisses a verified reflection carry-forward candidate without promoting truth", async () => {
    dbMock.memoryCandidate.findFirst.mockResolvedValue({
      id: "candidate_1",
      workspaceId: "workspace_1",
      runtimeSessionId: "session_1",
      meetingId: "meeting_1",
      candidateKey: "reflection:session_1",
      summary: "Carry forward Security review sync.",
      sourceVerification: "human_confirmed_reflection",
      sourceStatus: "trusted_runtime_compaction",
      status: "VERIFIED",
      reviewerNote: "Trusted carry-forward candidate.",
      runtimeSession: {
        id: "session_1",
        label: "Security review sync",
        meetingId: "meeting_1",
      },
    });
    dbMock.memoryCandidate.update.mockResolvedValue({
      id: "candidate_1",
      workspaceId: "workspace_1",
      runtimeSessionId: "session_1",
      meetingId: "meeting_1",
      candidateKey: "reflection:session_1",
      summary: "Carry forward Security review sync.",
      sourceVerification: "human_confirmed_reflection",
      sourceStatus: "trusted_runtime_compaction",
      status: "REJECTED",
      reviewerNote:
        "Trusted carry-forward candidate. Operator dismissed this reflection carry-forward candidate. It remains auditable, but it is no longer surfaced as an active carry-forward item.",
      runtimeSession: {
        id: "session_1",
        label: "Security review sync",
        meetingId: "meeting_1",
      },
    });
    auditMock.writeAuditLog.mockResolvedValue(undefined);
    analyticsMock.logEvent.mockResolvedValue(undefined);
    dbMock.memoryPromotion.upsert.mockResolvedValue({
      id: "promotion_1",
      memoryCandidateId: "candidate_1",
      status: "REJECTED",
    });

    const result = await dismissReflectionCandidate({
      workspaceId: "workspace_1",
      candidateId: "candidate_1",
      userId: "user_1",
      actorName: "Owner",
      sourcePage: "/operating",
    });

    expect(dbMock.memoryCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "candidate_1" },
        data: expect.objectContaining({
          status: "REJECTED",
        }),
      }),
    );
    expect(dbMock.memoryPromotion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "REJECTED",
        }),
        create: expect.objectContaining({
          status: "REJECTED",
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RUNTIME_REFLECTION_CARRY_FORWARD_DISMISSED",
        targetType: "MemoryCandidate",
        targetId: "candidate_1",
        sourcePage: "/operating",
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "runtime_reflection_carry_forward_dismissed",
        targetType: "MemoryCandidate",
        targetId: "candidate_1",
        sourcePage: "/operating",
      }),
    );
    expect(result.status).toBe("REJECTED");
  });

  it("rejects dismissal for non-reflection memory candidates", async () => {
    dbMock.memoryCandidate.findFirst.mockResolvedValue({
      id: "candidate_2",
      workspaceId: "workspace_1",
      runtimeSessionId: "session_2",
      meetingId: "meeting_2",
      candidateKey: "memory:session_2",
      summary: "Normal memory candidate.",
      sourceVerification: MemoryItemVerification.HUMAN_CONFIRMED,
      sourceStatus: MemoryItemStatus.PROMOTED,
      status: "VERIFIED",
      reviewerNote: null,
      runtimeSession: {
        id: "session_2",
        label: "Regular session",
        meetingId: "meeting_2",
      },
    });

    await expect(
      dismissReflectionCandidate({
        workspaceId: "workspace_1",
        candidateId: "candidate_2",
        userId: "user_1",
        actorName: "Owner",
        sourcePage: "/operating",
      }),
    ).rejects.toThrow("Only reflection carry-forward candidates can be dismissed here.");
    expect(dbMock.memoryCandidate.update).not.toHaveBeenCalled();
    expect(auditMock.writeAuditLog).not.toHaveBeenCalled();
    expect(analyticsMock.logEvent).not.toHaveBeenCalled();
  });

  it("accepts a verified reflection carry-forward candidate into the promotion ledger", async () => {
    dbMock.memoryCandidate.findFirst.mockResolvedValue({
      id: "candidate_3",
      workspaceId: "workspace_1",
      runtimeSessionId: "session_3",
      meetingId: "meeting_3",
      memoryItemId: null,
      candidateKey: "reflection:session_3",
      summary: "Carry forward customer launch review.",
      sourceVerification: "human_confirmed_reflection",
      sourceStatus: "trusted_runtime_compaction",
      status: "VERIFIED",
      reviewerNote: "Trusted carry-forward candidate.",
      runtimeSession: {
        id: "session_3",
        label: "Customer launch review",
        meetingId: "meeting_3",
      },
    });
    dbMock.memoryCandidate.update.mockResolvedValue({
      id: "candidate_3",
      workspaceId: "workspace_1",
      runtimeSessionId: "session_3",
      meetingId: "meeting_3",
      memoryItemId: null,
      candidateKey: "reflection:session_3",
      summary: "Carry forward customer launch review.",
      sourceVerification: "human_confirmed_reflection",
      sourceStatus: "trusted_runtime_compaction",
      status: "PROMOTED",
      reviewerNote:
        "Trusted carry-forward candidate. Operator accepted this reflection carry-forward candidate into the explicit runtime promotion ledger. It remains auditable carry-forward context and can inform later memory work, but it still does not silently rewrite canonical truth.",
      runtimeSession: {
        id: "session_3",
        label: "Customer launch review",
        meetingId: "meeting_3",
      },
    });
    dbMock.memoryPromotion.upsert.mockResolvedValue({
      id: "promotion_3",
      memoryCandidateId: "candidate_3",
      status: "PROMOTED",
    });
    auditMock.writeAuditLog.mockResolvedValue(undefined);
    analyticsMock.logEvent.mockResolvedValue(undefined);

    const result = await acceptReflectionCandidate({
      workspaceId: "workspace_1",
      candidateId: "candidate_3",
      userId: "user_1",
      actorName: "Reviewer",
      sourcePage: "/memory",
    });

    expect(dbMock.memoryCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "candidate_3" },
        data: expect.objectContaining({
          status: "PROMOTED",
        }),
      }),
    );
    expect(dbMock.memoryPromotion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "PROMOTED",
        }),
        create: expect.objectContaining({
          status: "PROMOTED",
        }),
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RUNTIME_REFLECTION_CARRY_FORWARD_ACCEPTED",
        targetType: "MemoryCandidate",
        targetId: "candidate_3",
        sourcePage: "/memory",
      }),
    );
    expect(analyticsMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "runtime_reflection_carry_forward_accepted",
        targetType: "MemoryCandidate",
        targetId: "candidate_3",
        sourcePage: "/memory",
      }),
    );
    expect(result.status).toBe("PROMOTED");
  });

  it("only treats promoted truth as confirmed continuity facts", () => {
    const promotedFacts = buildPromotedRuntimeFacts(
      [
        {
          id: "candidate_1",
          status: "PROMOTED",
          summary: "Security review owner is Alice.",
          evidenceRefs: ["meeting:1"],
        },
        {
          id: "candidate_2",
          status: "DEFERRED",
          summary: "Customer expects checklist delivery tomorrow.",
          evidenceRefs: ["meeting:2"],
        },
        {
          id: "candidate_3",
          status: "REJECTED",
          summary: "Champion already approved the language.",
          evidenceRefs: ["meeting:3"],
        },
      ],
      [],
    );

    expect(promotedFacts).toEqual([
      {
        summary: "Security review owner is Alice.",
        evidenceRefs: ["meeting:1"],
      },
    ]);
  });

  it("derives active payload state from checkpoint snapshot plus later prune edits", () => {
    const payloadState = buildRuntimePayloadHandleState({
      persistedHandles: [
        "payload://meeting_note/1/summary",
        "payload://meeting_transcript/1/transcript",
        "payload://document/1/brief",
      ],
      latestCheckpoint: {
        snapshotJson: JSON.stringify({
          continuityState: {
            loadedHandles: ["payload://meeting_note/1/summary", "payload://meeting_transcript/1/transcript"],
            prunedHandles: ["payload://document/1/brief"],
          },
        }),
        updatedAt: new Date("2026-04-03T10:00:00.000Z"),
      },
      edits: [
        {
          removedHandles: JSON.stringify(["payload://meeting_transcript/1/transcript", "payload://document/1/brief"]),
          createdAt: new Date("2026-04-03T10:05:00.000Z"),
        },
      ],
    });

    expect(payloadState.stateSource).toBe("checkpoint_plus_edits");
    expect(payloadState.activeHandles).toEqual(["payload://meeting_note/1/summary"]);
    expect(payloadState.prunedHandles).toEqual([
      "payload://meeting_transcript/1/transcript",
      "payload://document/1/brief",
    ]);
  });

  it("folds multi-prune history without silently collapsing to the latest edit only", () => {
    const payloadState = buildRuntimePayloadHandleState({
      persistedHandles: [
        "payload://meeting_note/1/summary",
        "payload://meeting_transcript/1/transcript",
        "payload://email_thread/1/thread",
      ],
      edits: [
        {
          removedHandles: JSON.stringify(["payload://meeting_transcript/1/transcript"]),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
        },
        {
          removedHandles: JSON.stringify(["payload://email_thread/1/thread"]),
          createdAt: new Date("2026-04-03T10:05:00.000Z"),
        },
      ],
    });

    expect(payloadState.stateSource).toBe("latest_prune_edit");
    expect(payloadState.activeHandles).toEqual(["payload://meeting_note/1/summary"]);
    expect(payloadState.prunedHandles).toEqual([
      "payload://meeting_transcript/1/transcript",
      "payload://email_thread/1/thread",
    ]);
    expect(payloadState.stateSummary).toContain("history");
  });

  it("flags weak checkpoint resume fidelity when critical continuity fields drift", () => {
    const replay = buildResumeFidelity({
      checkpointId: "checkpoint_1",
      checkpointLabel: "meeting_review",
      checkpointStatus: "RESUMED",
      updatedAt: new Date("2026-04-03T11:00:00.000Z"),
      savedState: {
        objective: "Send the internal checklist.",
        relevantObjects: ["Meeting: Security review sync", "Opportunity: Acme expansion"],
        confirmedFacts: ["Checklist stays internal."],
        blockers: ["Security owner is missing one answer."],
        decisions: ["Alice owns the next step."],
        nextActions: ["Send the internal checklist by Friday."],
        openQuestions: ["Which reviewer closes the final answer?"],
        evidenceRefs: ["meeting:1"],
        reviewState: "needs_review",
        boundaryNote: "No auto-send.",
        budgetState: "PRUNE",
        loadedHandles: ["payload://meeting_note/1/summary"],
        prunedHandles: ["payload://meeting_transcript/1/transcript"],
      },
      liveState: {
        objective: "Send the internal checklist.",
        relevantObjects: ["Meeting: Security review sync"],
        confirmedFacts: [],
        blockers: [],
        decisions: ["Alice owns the next step."],
        nextActions: [],
        openQuestions: [],
        evidenceRefs: [],
        reviewState: "blocked_for_review",
        boundaryNote: "No auto-send.",
      },
      livePayloadState: {
        activeHandles: [],
        prunedHandles: [],
        budgetState: "WATCH",
      },
    });

    expect(replay?.fidelityStatus).toBe("WEAK");
    expect(replay?.missing).toContain("active objects");
    expect(replay?.missing).toContain("confirmed facts");
    expect(replay?.missing).toContain("confirmed blockers");
    expect(replay?.missing).toContain("next actions");
    expect(replay?.missing).toContain("open questions");
    expect(replay?.missing).toContain("evidence refs");
    expect(replay?.missing).toContain("loaded handles");
    expect(replay?.missing).toContain("pruned handles");
    expect(replay?.missing).toContain("budget posture");
    expect(replay?.preserved).toContain("boundary note");
    expect(replay?.missing).toContain("review posture");
  });

  it("classifies replay and payload calibration posture for operator readability", () => {
    const replayStrong = classifyReplayFidelityStatus({
      fidelityScore: 100,
      missing: [],
    });
    const replayWatch = classifyReplayFidelityStatus({
      fidelityScore: 88,
      missing: ["payload source posture"],
    });
    const replayWeak = classifyReplayFidelityStatus({
      fidelityScore: 90,
      missing: ["confirmed facts"],
    });
    const payloadWatch = classifyPayloadStateSourceRisk("latest_prune_edit");

    const highRisk = buildRuntimeContinuityRisk({
      budgetPosture: "COMPACT",
      replayStatus: replayWeak,
      payloadStateSource: "checkpoint_plus_edits",
      hasPruneTrace: true,
    });
    const watchRisk = buildRuntimeContinuityRisk({
      budgetPosture: "PRUNE",
      replayStatus: replayWatch,
      payloadStateSource: "latest_prune_edit",
      hasPruneTrace: true,
    });
    const lowRisk = buildRuntimeContinuityRisk({
      budgetPosture: "SAFE",
      replayStatus: replayStrong,
      payloadStateSource: "all_persisted",
      hasPruneTrace: false,
    });

    expect(replayStrong).toBe("STRONG");
    expect(replayWatch).toBe("WATCH");
    expect(replayWeak).toBe("WEAK");
    expect(payloadWatch.riskWeight).toBe("WATCH");
    expect(highRisk.level).toBe("HIGH");
    expect(watchRisk.level).toBe("WATCH");
    expect(lowRisk.level).toBe("LOW");
  });

  it("builds a typed runtime posture snapshot without falling back to narration-only status", () => {
    const runThread = buildTestRunThread({
      checkpoints: [
        {
          id: "checkpoint_stub",
          checkpointKey: "checkpoint::review",
          label: "meeting_review",
          status: "READY",
          summary: "Checkpoint ready for bounded resume.",
          createdAt: new Date("2026-04-01T00:03:00.000Z"),
          updatedAt: new Date("2026-04-01T00:04:00.000Z"),
        },
      ],
    });
    const posture = buildRuntimePostureSnapshot({
      runThread,
      interruptReason: {
        state: "attention",
        code: "verification_blocked",
        source: "verification",
        summary: "Verification still blocks quiet continuation.",
        boundaryNote: "Read-only typed interrupt seam.",
      },
      resumeAsk: {
        mode: "provide_human_input",
        checkpointId: "checkpoint_stub",
        checkpointKey: "checkpoint::review",
        resumeToken: "checkpoint::review",
        prompt: "Capture a bounded operator answer before resume.",
        boundaryNote: "Read-only typed resume seam.",
      },
      handoffPayload: {
        state: "ready",
        handoffId: "handoff_runtime_1",
        packetKey: "handoff::session_stub::verification",
        fromAgent: "lead-orchestrator",
        toAgent: "verification-agent",
        goal: "Verify the current fact slice.",
        objectRefs: runThread.objectRefs,
        checkpointId: "checkpoint_stub",
        checkpointKey: "checkpoint::review",
        notebookRef: "notebook_stub",
        constraints: ["review-first"],
        trustBoundary: {
          trusted: ["meeting:stub"],
          untrusted: [],
        },
        requiredOutputs: ["verification_report"],
        evidenceRefs: ["meeting:stub"],
        approvalTier: "A1",
        createdAt: new Date("2026-04-01T00:04:30.000Z"),
        summary: "Verification handoff stays attached to the current checkpoint.",
        boundaryNote: "Read-only typed handoff seam.",
      },
    });

    expect(posture.runThread.threadId).toBe("session::stub");
    expect(posture.runThread.resumeState).toBe("ready");
    expect(posture.interruptReason.code).toBe("verification_blocked");
    expect(posture.resumeAsk.mode).toBe("provide_human_input");
    expect(posture.handoffPayload.toAgent).toBe("verification-agent");
    expect(formatRuntimePostureSnapshotSummary(posture)).toBe(
      "interrupt verification_blocked · resume provide_human_input · handoff verification-agent",
    );
  });

  it("classifies continuity recovery into stable, recoverable, review-required, and blocked posture", () => {
    const stableRecovery = buildRuntimeContinuityRecovery({
      budgetPosture: buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 40,
        prunedTokenCount: 0,
        latestCheckpointStatus: "READY",
      }),
      replay: {
        checkpointId: "checkpoint_stable",
        checkpointLabel: "meeting_review",
        replaySummary: "strong replay",
        fidelityStatus: "STRONG",
        fidelityScore: 100,
        preserved: [],
        missing: [],
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      },
      payloadState: {
        activeHandles: ["payload_1"],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "checkpoint snapshot",
      },
      latestCheckpoint: {
        id: "checkpoint_stable",
        label: "meeting_review",
        status: "READY",
      },
      persistedPayloadCount: 3,
      pruneTraceCount: 0,
    });
    const recoverableRecovery = buildRuntimeContinuityRecovery({
      budgetPosture: buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 63,
        prunedTokenCount: 0,
        latestCheckpointStatus: "READY",
      }),
      replay: {
        checkpointId: "checkpoint_recoverable",
        checkpointLabel: "meeting_review",
        replaySummary: "watch replay",
        fidelityStatus: "WATCH",
        fidelityScore: 86,
        preserved: [],
        missing: ["open questions"],
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      },
      payloadState: {
        activeHandles: ["payload_1"],
        prunedHandles: ["payload_2"],
        stateSource: "checkpoint_plus_edits",
        stateSummary: "checkpoint plus edits",
      },
      latestCheckpoint: {
        id: "checkpoint_recoverable",
        label: "meeting_review",
        status: "READY",
      },
      persistedPayloadCount: 4,
      pruneTraceCount: 1,
    });
    const reviewRequiredRecovery = buildRuntimeContinuityRecovery({
      budgetPosture: buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 68,
        prunedTokenCount: 0,
        latestCheckpointStatus: "READY",
      }),
      replay: {
        checkpointId: "checkpoint_review",
        checkpointLabel: "meeting_review",
        replaySummary: "weak replay",
        fidelityStatus: "WEAK",
        fidelityScore: 71,
        preserved: [],
        missing: ["confirmed facts", "boundary note"],
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      },
      payloadState: {
        activeHandles: ["payload_1"],
        prunedHandles: [],
        stateSource: "checkpoint_snapshot",
        stateSummary: "checkpoint snapshot",
      },
      latestCheckpoint: {
        id: "checkpoint_review",
        label: "meeting_review",
        status: "READY",
      },
      persistedPayloadCount: 2,
      pruneTraceCount: 0,
    });
    const blockedRecovery = buildRuntimeContinuityRecovery({
      budgetPosture: buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 54,
        prunedTokenCount: 0,
      }),
      replay: null,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "all_persisted",
        stateSummary: "all persisted",
      },
      latestCheckpoint: null,
      persistedPayloadCount: 0,
      pruneTraceCount: 0,
    });

    expect(stableRecovery.state).toBe("STABLE");
    expect(stableRecovery.failureTaxonomy).toBe("NONE");
    expect(stableRecovery.allowedActions).toEqual([]);
    expect(recoverableRecovery.state).toBe("RECOVERABLE");
    expect(recoverableRecovery.failureTaxonomy).toBe("REPLAY_DRIFT");
    expect(recoverableRecovery.allowedActions).toEqual(["RESUME_CHECKPOINT"]);
    expect(reviewRequiredRecovery.state).toBe("REVIEW_REQUIRED");
    expect(reviewRequiredRecovery.failureTaxonomy).toBe("PROTECTED_STATE_GAP");
    expect(reviewRequiredRecovery.reviewReasons).toEqual(["confirmed facts", "boundary note"]);
    expect(blockedRecovery.state).toBe("BLOCKED");
    expect(blockedRecovery.failureTaxonomy).toBe("NO_RECOVERY_ANCHOR");
    expect(blockedRecovery.blockedReasons[0]).toContain("No recovery anchor");
  });

  it("calibrates recoverable continuity into review-required when pilot evidence shows ineffective recovery loops", () => {
    const recovery = buildRuntimeContinuityRecovery({
      budgetPosture: buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 82,
        prunedTokenCount: 24,
        latestCheckpointStatus: "READY",
      }),
      replay: {
        checkpointId: "checkpoint_loop",
        checkpointLabel: "continuity_anchor",
        replaySummary: "watch replay",
        fidelityStatus: "WATCH",
        fidelityScore: 84,
        preserved: [],
        missing: ["open questions"],
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      },
      payloadState: {
        activeHandles: ["payload_1"],
        prunedHandles: ["payload_2"],
        stateSource: "checkpoint_plus_edits",
        stateSummary: "checkpoint plus edits",
      },
      latestCheckpoint: {
        id: "checkpoint_loop",
        label: "continuity_anchor",
        status: "READY",
      },
      persistedPayloadCount: 3,
      pruneTraceCount: 2,
    });
    const remediationTrace = [
      {
        id: "trace_loop_latest",
        action: "REPRUNE_CONTEXT" as const,
        executionStatus: "APPLIED" as const,
        summary: "reprune applied",
        beforeSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        afterSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        beforeRiskLevel: "WATCH" as const,
        afterRiskLevel: "WATCH" as const,
        beforeRecoveryState: "RECOVERABLE" as const,
        afterRecoveryState: "RECOVERABLE" as const,
        beforeFailureTaxonomy: "BUDGET_PRESSURE" as const,
        afterFailureTaxonomy: "BUDGET_PRESSURE" as const,
        rollbackAnchorSummary: "continuity_anchor · READY",
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-04T11:00:00.000Z"),
      },
      {
        id: "trace_loop_previous",
        action: "REPRUNE_CONTEXT" as const,
        executionStatus: "APPLIED" as const,
        summary: "reprune applied again",
        beforeSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        afterSummary: "Budget posture: PRUNE. Replay: WATCH. Payload state: checkpoint_plus_edits. Risk: WATCH. Recovery: RECOVERABLE.",
        beforeRiskLevel: "WATCH" as const,
        afterRiskLevel: "WATCH" as const,
        beforeRecoveryState: "RECOVERABLE" as const,
        afterRecoveryState: "RECOVERABLE" as const,
        beforeFailureTaxonomy: "BUDGET_PRESSURE" as const,
        afterFailureTaxonomy: "BUDGET_PRESSURE" as const,
        rollbackAnchorSummary: "continuity_anchor · READY",
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-04T10:00:00.000Z"),
      },
    ];

    const analytics = buildRuntimeRemediationAnalytics(remediationTrace);
    const effectiveness = buildRuntimeRemediationEffectiveness(remediationTrace);
    const calibration = buildRuntimeContinuityCalibration({
      recovery,
      replay: {
        checkpointId: "checkpoint_loop",
        checkpointLabel: "continuity_anchor",
        replaySummary: "watch replay",
        fidelityStatus: "WATCH",
        fidelityScore: 84,
        preserved: [],
        missing: ["open questions"],
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      },
      payloadState: {
        activeHandles: ["payload_1"],
        prunedHandles: ["payload_2"],
        stateSource: "checkpoint_plus_edits",
        stateSummary: "checkpoint plus edits",
      },
      risk: {
        level: "WATCH",
        summary: "Budget-sensitive continuity posture.",
        operatorAction: "Confirm payload state before reuse.",
      },
      analytics,
      effectiveness,
    });

    expect(recovery.state).toBe("RECOVERABLE");
    expect(analytics.repeatPattern.status).toBe("REPEATED_REPRUNE_LOOP");
    expect(effectiveness.latestOutcome).toBe("INEFFECTIVE");
    expect(effectiveness.ineffectiveCount).toBe(2);
    expect(calibration.stateAdjusted).toBe(true);
    expect(calibration.calibratedState).toBe("REVIEW_REQUIRED");
    expect(calibration.confidence).toBe("LOW");
  });

  it("builds remediation analytics, evidence, and runbook without hiding repeat failure patterns", () => {
    const notebookState = buildRuntimeNotebookState({
      sessionLabel: "Acme security session",
      sessionStatus: "ACTIVE",
      boundaryNote: "No auto-send.",
      notebook: {
        sessionSummary: "Continuity is still waiting for the final reviewer answer.",
        decisionSummary: "Keep the response internal until review closes.",
        blockerSummary: "Final reviewer answer is still missing.",
        pendingQuestions: JSON.stringify(["Who closes the final answer?"]),
        openLoopSummary: "Restore continuity before downstream use.",
        boundaryNote: "No auto-send.",
      },
      verification: {
        status: "needs_review",
        blockedReasons: ["Final reviewer answer is still missing."],
      },
      problemSpaces: [],
      promotedFacts: [
        {
          summary: "The reply must stay internal until review closes.",
          evidenceRefs: ["meeting:1"],
        },
      ],
      truthConflicts: [],
    });
    const recovery = buildRuntimeContinuityRecovery({
      budgetPosture: buildBudgetPosture({
        budgetTokenLimit: 100,
        budgetTokenUsed: 54,
        prunedTokenCount: 0,
      }),
      replay: null,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "all_persisted",
        stateSummary: "No checkpoint anchor exists, so all persisted payloads remain active.",
      },
      latestCheckpoint: null,
      persistedPayloadCount: 0,
      pruneTraceCount: 0,
    });
    const remediationTrace = [
      {
        id: "trace_latest",
        action: "SAVE_RECOVERY_CHECKPOINT" as const,
        executionStatus: "BLOCKED" as const,
        summary: "save recovery checkpoint was blocked",
        beforeSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        afterSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        beforeRiskLevel: "WATCH" as const,
        afterRiskLevel: "WATCH" as const,
        beforeRecoveryState: "BLOCKED" as const,
        afterRecoveryState: "BLOCKED" as const,
        beforeFailureTaxonomy: "NO_RECOVERY_ANCHOR" as const,
        afterFailureTaxonomy: "NO_RECOVERY_ANCHOR" as const,
        rollbackAnchorSummary: null,
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-04T10:00:00.000Z"),
      },
      {
        id: "trace_previous",
        action: "SAVE_RECOVERY_CHECKPOINT" as const,
        executionStatus: "BLOCKED" as const,
        summary: "save recovery checkpoint was blocked again",
        beforeSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        afterSummary: "Budget posture: WATCH. Replay: NONE. Payload state: all_persisted. Risk: WATCH. Recovery: BLOCKED.",
        beforeRiskLevel: "WATCH" as const,
        afterRiskLevel: "WATCH" as const,
        beforeRecoveryState: "BLOCKED" as const,
        afterRecoveryState: "BLOCKED" as const,
        beforeFailureTaxonomy: "NO_RECOVERY_ANCHOR" as const,
        afterFailureTaxonomy: "NO_RECOVERY_ANCHOR" as const,
        rollbackAnchorSummary: null,
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-04T09:00:00.000Z"),
      },
    ];

    const analytics = buildRuntimeRemediationAnalytics(remediationTrace);
    const effectiveness = buildRuntimeRemediationEffectiveness(remediationTrace);
    const calibration = buildRuntimeContinuityCalibration({
      recovery,
      replay: null,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "all_persisted",
        stateSummary: "No checkpoint anchor exists, so all persisted payloads remain active.",
      },
      risk: {
        level: "WATCH",
        summary: "Budget posture is watch-level.",
        operatorAction: "Keep continuity under review.",
      },
      analytics,
      effectiveness,
    });
    const evidence = buildRuntimeContinuityEvidenceSurface({
      replay: null,
      recovery,
      calibration,
      payloadState: {
        activeHandles: [],
        prunedHandles: [],
        stateSource: "all_persisted",
        stateSummary: "No checkpoint anchor exists, so all persisted payloads remain active.",
      },
      notebookState,
      pruneTrace: [],
      remediationTrace,
      analytics,
      effectiveness,
    });
    const runbook = buildRuntimeContinuityRunbook({
      recovery,
      calibration,
      analytics,
      effectiveness,
      evidence,
    });

    expect(analytics.totalAttempts).toBe(2);
    expect(analytics.blockedCount).toBe(2);
    expect(analytics.repeatPattern.status).toBe("REPEATED_BLOCKED_ACTION");
    expect(effectiveness.latestOutcome).toBe("NO_SIGNAL");
    expect(calibration.confidence).toBe("LOW");
    expect(evidence.summary).toContain("Repeated remediation behavior is visible");
    expect(evidence.items.some((item) => item.includes("Repeat pattern"))).toBe(true);
    expect(runbook.title).toBe("Stop repeat remediation loop");
    expect(runbook.steps.some((item) => item.includes("Stop retrying the same blocked remediation action"))).toBe(true);
    expect(runbook.boundaryNote).toContain("does not expand execution authority");
  });

  it("builds pilot-backed continuity review and refined SOP from repeated pilot cases", () => {
    const pilotReview = buildRuntimeContinuityPilotEffectivenessReview([
      {
        id: "session_anchor_1",
        meetingId: null,
        title: "Anchor gap 1",
        summary: "No recovery anchor exists.",
        runThread: buildTestRunThread({
          id: "session_anchor_1",
          workspaceId: "workspace_pilot",
          sessionKey: "session::anchor-1",
          replayableEventLog: JSON.stringify([{ at: "2026-04-04T10:00:00.000Z", type: "runtime.trace" }]),
          updatedAt: new Date("2026-04-04T10:00:00.000Z"),
        }),
        operatorProgressSummary: buildTestOperatorProgressSummary(
          new Date("2026-04-04T10:00:00.000Z"),
          {
            closePostureState: "open",
            summary: "Thread stays review-gated while continuity remains blocked.",
            nextAction: "Keep the thread review-gated until a recovery anchor is rebuilt.",
          },
        ),
        interruptReasonState: "blocked",
        interruptReasonCode: "no_recovery_anchor",
        resumeAskMode: "rerun_session",
        handoffPayloadState: "not_available",
        handoffTargetAgent: null,
        debuggerReplayFidelity: "none",
        debuggerTraceContractState: "backfill_required",
        debuggerTraceContractDriver: "persisted_lifecycle",
        debuggerTraceContractAnchor: "none",
        debuggerTraceContractCheckpointKey: null,
        debuggerTraceContractSummary:
          "Debugger trace needs the first persisted snapshot before replay, checkpoint, or human input can be reconciled.",
        debuggerWriteContractState: "backfill_required",
        debuggerWriteContractDriver: "persisted_lifecycle",
        debuggerWriteContractAnchor: "none",
        debuggerWriteContractCheckpointKey: null,
        debuggerWriteContractSummary:
          "Debugger write contract has no bounded persisted snapshot yet.",
        debuggerSwarmSpawnContractState: "blocked_flag",
        debuggerSwarmSpawnContractDriver: "workspace_flag",
        debuggerSwarmSpawnContractDenyReason: "workspace_flag_disabled",
        debuggerSwarmSpawnContractSummary:
          "Read-only swarm worker spawn stays blocked until the workspace swarm flag is explicitly enabled.",
        debuggerRecoveryActionContractState: "backfill_required",
        debuggerRecoveryActionContractDriver: "persisted_lifecycle",
        debuggerRecoveryActionContractAction: null,
        debuggerRecoveryActionContractCheckpointKey: null,
        debuggerRecoveryActionContractSummary:
          "Debugger recovery action contract cannot advance until the first bounded persisted snapshot exists.",
        debuggerRecoveryLifecycleContractState: "backfill_required",
        debuggerRecoveryLifecycleContractDriver: "persisted_lifecycle",
        debuggerRecoveryLifecycleContractAnchor: "none",
        debuggerRecoveryLifecycleContractTransition: "backfill_snapshot",
        debuggerRecoveryLifecycleContractSummary:
          "Debugger recovery lifecycle is blocked until the first bounded persisted snapshot exists.",
        debuggerRecoveryTransitionContractState: "backfill_required",
        debuggerRecoveryTransitionContractDriver: "persisted_lifecycle",
        debuggerRecoveryTransitionContractAnchor: "none",
        debuggerRecoveryTransitionContractTransition: "backfill_snapshot",
        debuggerRecoveryTransitionContractSummary:
          "Debugger recovery transition is blocked at snapshot backfill for the current thread.",
        debuggerRecoveryStateMachinePhase: "materialization",
        debuggerRecoveryStateMachineTransitionState: "required",
        debuggerRecoveryStateMachineCurrentTransition: "backfill_snapshot",
        debuggerRecoveryStateMachineSummary:
          "Debugger recovery state machine is in materialization phase on the current thread. Current transition backfill_snapshot is required; completed bounded transitions: none. Debugger recovery transition is blocked at snapshot backfill for the current thread.",
        debuggerRecoveryExecutionContractState: "backfill_required",
        debuggerRecoveryExecutionContractTransition: "backfill_snapshot",
        debuggerRecoveryExecutionContractCanExecute: false,
        debuggerRecoveryExecutionContractSummary:
          "Debugger recovery execution is blocked at snapshot backfill for the current thread. No bounded execution move should start until the first persisted snapshot exists.",
        debuggerPersistedLifecycleTraceState: "backfill_required",
        debuggerPersistedLifecycleTraceAnchor: "none",
        debuggerPersistedLifecycleTrace: {
          state: "backfill_required",
          anchor: "none",
          checkpointId: null,
          checkpointKey: null,
          resumeToken: null,
          resumeState: "not_available",
          replayRequestMode: "none",
          humanInputCheckpointState: "not_available",
          persistedLifecycleState: "missing",
          writeSideState: "not_persisted",
          refreshReason: null,
          refreshSource: null,
          compactionState: "backfill_required",
          reconciliationState: "backfill_required",
          checkpointLineageDepth: 0,
          replayEventLogEntries: 1,
          summary:
            "Persisted lifecycle trace still needs its first bounded snapshot before checkpoints can be trusted.",
          nextAction: "Backfill the persisted lifecycle trace before comparing anchors.",
          boundaryNote: "Read-only debugging only.",
        },
        ...buildTestTakeoverDebuggerState(),
        debuggerTakeoverPosture: "blocked",
        debuggerTakeoverSummary: "No trustworthy checkpoint anchor is available yet.",
        debuggerTakeoverRequestState: "not_requestable",
        debuggerTakeoverActivationState: "inactive",
        debuggerTakeoverFollowThroughState: "not_requestable",
        debuggerTakeoverOwner: null,
        debuggerHumanInputState: "not_available",
        debuggerHumanInputRequestState: "not_requestable",
        operatorActionSummary: buildTestOperatorActionSummary(
          new Date("2026-04-04T10:00:00.000Z"),
          {
            closePostureState: "open",
            summary: "Keep the thread review-gated until a recovery anchor is rebuilt.",
            nextAction: "Keep the thread review-gated until a recovery anchor is rebuilt.",
          },
        ),
        posture: "WATCH",
        replayStatus: "NONE",
        payloadStateSource: "all_persisted",
        riskLevel: "WATCH",
        riskSummary: "Watch continuity posture.",
        recoveryState: "BLOCKED",
        failureTaxonomy: "NO_RECOVERY_ANCHOR",
        recoverySummary: "No recovery anchor exists for this workflow.",
        rollbackAnchorLabel: null,
        checkpointSummary: null,
        pruneSummary: null,
        remediationAttempts: 2,
        repeatPatternStatus: "REPEATED_BLOCKED_ACTION",
        repeatPatternSummary: "Save recovery checkpoint has been blocked repeatedly.",
        calibrationConfidence: "LOW",
        calibrationSummary: "Pilot calibration keeps this workflow blocked with low confidence.",
        latestEffectiveness: "NO_SIGNAL",
        effectivenessSummary: "No positive recovery signal is available yet.",
        meetingShape: "LEAN_MEETING",
        sessionDensityBand: "LIGHT",
        meetingFrequencyBand: "RECURRING",
        failureHistoryBand: "CHRONIC_REPEAT",
        participantRolePosture: "EXEC_SPONSORED",
        guidanceStatus: "SKIPPED_GUIDANCE",
        guidanceSummary: "Anchor-first escalation guidance was skipped because the same blocked action kept repeating.",
        pilotConfidenceBand: "LOW",
        pilotRiskBand: "HIGH",
        pilotThreshold: 1,
        pilotSampleCoverageBand: "NARROW",
        pilotStabilityBand: "UNSTABLE",
        pilotStabilityConfidenceBand: "LOW",
        pilotConfidenceInterval: "WIDE",
        pilotOutcomeCorrelationBand: "WATCH",
        pilotLongTermMaterialImpactBand: "WATCH",
        pilotReviewSummary: "Treat repeated ineffective recovery as an early review signal.",
        sopTitle: "Recovery-anchor rebuild SOP",
        evidenceSummary: "Blocked because no recovery anchor exists.",
        runbookTitle: "Rebuild continuity substrate",
        href: "/operating",
        updatedAt: new Date("2026-04-04T10:00:00.000Z"),
      },
      {
        id: "session_anchor_2",
        meetingId: null,
        title: "Anchor gap 2",
        summary: "No recovery anchor exists again.",
        runThread: buildTestRunThread({
          id: "session_anchor_2",
          workspaceId: "workspace_pilot",
          sessionKey: "session::anchor-2",
          replayableEventLog: JSON.stringify([{ at: "2026-04-04T09:00:00.000Z", type: "runtime.trace" }]),
          updatedAt: new Date("2026-04-04T09:00:00.000Z"),
        }),
        operatorProgressSummary: buildTestOperatorProgressSummary(
          new Date("2026-04-04T09:00:00.000Z"),
          {
            closePostureState: "open",
            summary: "Thread stays review-gated while continuity remains blocked.",
            nextAction: "Keep the thread review-gated until a recovery anchor is rebuilt.",
          },
        ),
        interruptReasonState: "blocked",
        interruptReasonCode: "no_recovery_anchor",
        resumeAskMode: "rerun_session",
        handoffPayloadState: "not_available",
        handoffTargetAgent: null,
        debuggerReplayFidelity: "none",
        debuggerTraceContractState: "backfill_required",
        debuggerTraceContractDriver: "persisted_lifecycle",
        debuggerTraceContractAnchor: "none",
        debuggerTraceContractCheckpointKey: null,
        debuggerTraceContractSummary:
          "Debugger trace needs the first persisted snapshot before replay, checkpoint, or human input can be reconciled.",
        debuggerWriteContractState: "backfill_required",
        debuggerWriteContractDriver: "persisted_lifecycle",
        debuggerWriteContractAnchor: "none",
        debuggerWriteContractCheckpointKey: null,
        debuggerWriteContractSummary:
          "Debugger write contract has no bounded persisted snapshot yet.",
        debuggerSwarmSpawnContractState: "blocked_flag",
        debuggerSwarmSpawnContractDriver: "workspace_flag",
        debuggerSwarmSpawnContractDenyReason: "workspace_flag_disabled",
        debuggerSwarmSpawnContractSummary:
          "Read-only swarm worker spawn stays blocked until the workspace swarm flag is explicitly enabled.",
        debuggerRecoveryActionContractState: "backfill_required",
        debuggerRecoveryActionContractDriver: "persisted_lifecycle",
        debuggerRecoveryActionContractAction: null,
        debuggerRecoveryActionContractCheckpointKey: null,
        debuggerRecoveryActionContractSummary:
          "Debugger recovery action contract cannot advance until the first bounded persisted snapshot exists.",
        debuggerRecoveryLifecycleContractState: "backfill_required",
        debuggerRecoveryLifecycleContractDriver: "persisted_lifecycle",
        debuggerRecoveryLifecycleContractAnchor: "none",
        debuggerRecoveryLifecycleContractTransition: "backfill_snapshot",
        debuggerRecoveryLifecycleContractSummary:
          "Debugger recovery lifecycle is blocked until the first bounded persisted snapshot exists.",
        debuggerRecoveryTransitionContractState: "backfill_required",
        debuggerRecoveryTransitionContractDriver: "persisted_lifecycle",
        debuggerRecoveryTransitionContractAnchor: "none",
        debuggerRecoveryTransitionContractTransition: "backfill_snapshot",
        debuggerRecoveryTransitionContractSummary:
          "Debugger recovery transition is blocked at snapshot backfill for the current thread.",
        debuggerRecoveryStateMachinePhase: "materialization",
        debuggerRecoveryStateMachineTransitionState: "required",
        debuggerRecoveryStateMachineCurrentTransition: "backfill_snapshot",
        debuggerRecoveryStateMachineSummary:
          "Debugger recovery state machine is in materialization phase on the current thread. Current transition backfill_snapshot is required; completed bounded transitions: none. Debugger recovery transition is blocked at snapshot backfill for the current thread.",
        debuggerRecoveryExecutionContractState: "backfill_required",
        debuggerRecoveryExecutionContractTransition: "backfill_snapshot",
        debuggerRecoveryExecutionContractCanExecute: false,
        debuggerRecoveryExecutionContractSummary:
          "Debugger recovery execution is blocked at snapshot backfill for the current thread. No bounded execution move should start until the first persisted snapshot exists.",
        debuggerPersistedLifecycleTraceState: "backfill_required",
        debuggerPersistedLifecycleTraceAnchor: "none",
        debuggerPersistedLifecycleTrace: {
          state: "backfill_required",
          anchor: "none",
          checkpointId: null,
          checkpointKey: null,
          resumeToken: null,
          resumeState: "not_available",
          replayRequestMode: "none",
          humanInputCheckpointState: "not_available",
          persistedLifecycleState: "missing",
          writeSideState: "not_persisted",
          refreshReason: null,
          refreshSource: null,
          compactionState: "backfill_required",
          reconciliationState: "backfill_required",
          checkpointLineageDepth: 0,
          replayEventLogEntries: 1,
          summary:
            "Persisted lifecycle trace still needs its first bounded snapshot before checkpoints can be trusted.",
          nextAction: "Backfill the persisted lifecycle trace before comparing anchors.",
          boundaryNote: "Read-only debugging only.",
        },
        ...buildTestTakeoverDebuggerState(),
        debuggerTakeoverPosture: "blocked",
        debuggerTakeoverSummary: "No trustworthy checkpoint anchor is available yet.",
        debuggerTakeoverRequestState: "not_requestable",
        debuggerTakeoverActivationState: "inactive",
        debuggerTakeoverFollowThroughState: "not_requestable",
        debuggerTakeoverOwner: null,
        debuggerHumanInputState: "not_available",
        debuggerHumanInputRequestState: "not_requestable",
        operatorActionSummary: buildTestOperatorActionSummary(
          new Date("2026-04-04T09:00:00.000Z"),
          {
            closePostureState: "open",
            summary: "Keep the thread review-gated until a recovery anchor is rebuilt.",
            nextAction: "Keep the thread review-gated until a recovery anchor is rebuilt.",
          },
        ),
        posture: "WATCH",
        replayStatus: "NONE",
        payloadStateSource: "all_persisted",
        riskLevel: "WATCH",
        riskSummary: "Watch continuity posture.",
        recoveryState: "BLOCKED",
        failureTaxonomy: "NO_RECOVERY_ANCHOR",
        recoverySummary: "No recovery anchor exists for this workflow.",
        rollbackAnchorLabel: null,
        checkpointSummary: null,
        pruneSummary: null,
        remediationAttempts: 1,
        repeatPatternStatus: "NONE",
        repeatPatternSummary: "No repeated continuity remediation pattern is currently visible.",
        calibrationConfidence: "LOW",
        calibrationSummary: "Pilot calibration keeps this workflow blocked with low confidence.",
        latestEffectiveness: "NO_SIGNAL",
        effectivenessSummary: "No positive recovery signal is available yet.",
        meetingShape: "LEAN_MEETING",
        sessionDensityBand: "LIGHT",
        meetingFrequencyBand: "RECURRING",
        failureHistoryBand: "REPEATED_FAILURE",
        participantRolePosture: "EXEC_SPONSORED",
        guidanceStatus: "MATCHED_GUIDANCE",
        guidanceSummary: "Current handling matches anchor-first guidance by keeping the session out of blind retries.",
        pilotConfidenceBand: "LOW",
        pilotRiskBand: "HIGH",
        pilotThreshold: 1,
        pilotSampleCoverageBand: "NARROW",
        pilotStabilityBand: "WATCH",
        pilotStabilityConfidenceBand: "LOW",
        pilotConfidenceInterval: "WIDE",
        pilotOutcomeCorrelationBand: "WATCH",
        pilotLongTermMaterialImpactBand: "WATCH",
        pilotReviewSummary: "Treat repeated ineffective recovery as an early review signal.",
        sopTitle: "Recovery-anchor rebuild SOP",
        evidenceSummary: "Blocked because no recovery anchor exists.",
        runbookTitle: "Rebuild continuity substrate",
        href: "/operating",
        updatedAt: new Date("2026-04-04T09:00:00.000Z"),
      },
      {
        id: "session_protected_1",
        meetingId: null,
        title: "Protected gap",
        summary: "Protected fields still need review.",
        runThread: buildTestRunThread({
          id: "session_protected_1",
          workspaceId: "workspace_pilot",
          sessionKey: "session::protected-1",
          replayableEventLog: JSON.stringify([{ at: "2026-04-04T08:00:00.000Z", type: "runtime.trace" }]),
          updatedAt: new Date("2026-04-04T08:00:00.000Z"),
          checkpoints: [
            {
              id: "session_protected_1_checkpoint",
              checkpointKey: "checkpoint::protected-1",
              label: "continuity_anchor",
              status: "READY",
              summary: "Continuity anchor remains available",
              createdAt: new Date("2026-04-04T08:00:00.000Z"),
              updatedAt: new Date("2026-04-04T08:00:00.000Z"),
            },
          ],
        }),
        operatorProgressSummary: buildTestOperatorProgressSummary(
          new Date("2026-04-04T08:00:00.000Z"),
          {
            state: "human_input_requested",
            driver: "request_posture",
            requestHumanInputState: "requested",
            closePostureState: "review_open",
            summary: "Human input is still needed before the operator can settle the thread.",
            nextAction: "Provide protected-field input before bounded recovery continues.",
            counts: {
              activeRequests: 1,
              pendingExecutionWrites: 0,
              openExecutionFollowThrough: 0,
              benchmarkPendingRequests: 0,
              benchmarkFailingGates: 0,
              benchmarkWarningGates: 0,
              forwardAttention: 0,
              openCloseout: 0,
            },
          },
        ),
        interruptReasonState: "attention",
        interruptReasonCode: "protected_state_gap",
        resumeAskMode: "provide_human_input",
        handoffPayloadState: "not_available",
        handoffTargetAgent: null,
        debuggerReplayFidelity: "weak",
        debuggerTraceContractState: "human_input_ready",
        debuggerTraceContractDriver: "human_input",
        debuggerTraceContractAnchor: "human_input",
        debuggerTraceContractCheckpointKey: "checkpoint::protected-1",
        debuggerTraceContractSummary:
          "Debugger trace is waiting on human input at checkpoint::protected-1.",
        debuggerWriteContractState: "backfill_required",
        debuggerWriteContractDriver: "persisted_lifecycle",
        debuggerWriteContractAnchor: "none",
        debuggerWriteContractCheckpointKey: null,
        debuggerWriteContractSummary:
          "Debugger write contract has no bounded persisted snapshot yet.",
        debuggerSwarmSpawnContractState: "blocked_flag",
        debuggerSwarmSpawnContractDriver: "workspace_flag",
        debuggerSwarmSpawnContractDenyReason: "workspace_flag_disabled",
        debuggerSwarmSpawnContractSummary:
          "Read-only swarm worker spawn stays blocked until the workspace swarm flag is explicitly enabled.",
        debuggerRecoveryActionContractState: "backfill_required",
        debuggerRecoveryActionContractDriver: "persisted_lifecycle",
        debuggerRecoveryActionContractAction: null,
        debuggerRecoveryActionContractCheckpointKey: null,
        debuggerRecoveryActionContractSummary:
          "Debugger recovery action contract cannot advance until the first bounded persisted snapshot exists.",
        debuggerRecoveryLifecycleContractState: "backfill_required",
        debuggerRecoveryLifecycleContractDriver: "persisted_lifecycle",
        debuggerRecoveryLifecycleContractAnchor: "human_input",
        debuggerRecoveryLifecycleContractTransition: "backfill_snapshot",
        debuggerRecoveryLifecycleContractSummary:
          "Debugger recovery lifecycle is blocked until the first bounded persisted snapshot exists.",
        debuggerRecoveryTransitionContractState: "backfill_required",
        debuggerRecoveryTransitionContractDriver: "persisted_lifecycle",
        debuggerRecoveryTransitionContractAnchor: "human_input",
        debuggerRecoveryTransitionContractTransition: "backfill_snapshot",
        debuggerRecoveryTransitionContractSummary:
          "Debugger recovery transition is blocked at snapshot backfill for human_input anchor checkpoint::human-input.",
        debuggerRecoveryStateMachinePhase: "materialization",
        debuggerRecoveryStateMachineTransitionState: "required",
        debuggerRecoveryStateMachineCurrentTransition: "backfill_snapshot",
        debuggerRecoveryStateMachineSummary:
          "Debugger recovery state machine is in materialization phase on human_input anchor checkpoint::human-input. Current transition backfill_snapshot is required; completed bounded transitions: none. Debugger recovery transition is blocked at snapshot backfill for human_input anchor checkpoint::human-input.",
        debuggerRecoveryExecutionContractState: "backfill_required",
        debuggerRecoveryExecutionContractTransition: "backfill_snapshot",
        debuggerRecoveryExecutionContractCanExecute: false,
        debuggerRecoveryExecutionContractSummary:
          "Debugger recovery execution is blocked at snapshot backfill for human_input anchor checkpoint::human-input. No bounded execution move should start until the first persisted snapshot exists.",
        debuggerPersistedLifecycleTraceState: "backfill_required",
        debuggerPersistedLifecycleTraceAnchor: "human_input",
        debuggerPersistedLifecycleTrace: {
          state: "backfill_required",
          anchor: "human_input",
          checkpointId: "session_protected_1_checkpoint",
          checkpointKey: "checkpoint::protected-1",
          resumeToken: null,
          resumeState: "not_available",
          replayRequestMode: "none",
          humanInputCheckpointState: "checkpoint_ready",
          persistedLifecycleState: "missing",
          writeSideState: "not_persisted",
          refreshReason: null,
          refreshSource: null,
          compactionState: "backfill_required",
          reconciliationState: "backfill_required",
          checkpointLineageDepth: 1,
          replayEventLogEntries: 1,
          summary:
            "Persisted lifecycle trace still needs its first bounded snapshot for human_input anchor checkpoint::protected-1.",
          nextAction:
            "Backfill the persisted lifecycle trace for checkpoint::protected-1 before comparing anchors.",
          boundaryNote: "Read-only debugging only.",
        },
        ...buildTestTakeoverDebuggerState({
          assistance: {
            posture: "resume_ready",
            recommendedAction: "SAVE_RECOVERY_CHECKPOINT",
            summary: "Restore the latest checkpoint before operator follow-through continues.",
            checklist: ["Checkpoint anchor remains available for bounded operator recovery."],
          },
          request: {
            state: "requestable",
            action: "SAVE_RECOVERY_CHECKPOINT",
            checkpointId: "session_protected_1_checkpoint",
            checkpointKey: "checkpoint::protected-1",
            summary: "Takeover request can be recorded for checkpoint::protected-1.",
          },
        }),
        debuggerTakeoverPosture: "resume_ready",
        debuggerTakeoverSummary: "Restore the latest checkpoint before operator follow-through continues.",
        debuggerTakeoverRequestState: "requestable",
        debuggerTakeoverActivationState: "inactive",
        debuggerTakeoverFollowThroughState: "not_requestable",
        debuggerTakeoverOwner: null,
        debuggerHumanInputState: "checkpoint_ready",
        debuggerHumanInputRequestState: "requestable",
        operatorActionSummary: buildTestOperatorActionSummary(
          new Date("2026-04-04T08:00:00.000Z"),
          {
            state: "capture_human_input",
            driver: "request_posture",
            progressState: "human_input_requested",
            requestHumanInputState: "requested",
            closePostureState: "review_open",
            checkpointKey: "checkpoint::protected-1",
            summary: "Human input is still needed before the operator can settle the thread.",
            nextAction: "Provide protected-field input before bounded recovery continues.",
          },
        ),
        posture: "PRUNE",
        replayStatus: "WEAK",
        payloadStateSource: "checkpoint_snapshot",
        riskLevel: "HIGH",
        riskSummary: "High continuity risk.",
        recoveryState: "REVIEW_REQUIRED",
        failureTaxonomy: "PROTECTED_STATE_GAP",
        recoverySummary: "Protected continuity fields need review.",
        rollbackAnchorLabel: "meeting_review · READY",
        checkpointSummary: "WEAK · 71% · weak replay",
        pruneSummary: "Transcript overflow moved behind a handle.",
        remediationAttempts: 2,
        repeatPatternStatus: "REPEATED_REVIEW_REQUIRED",
        repeatPatternSummary: "Continuity remains review-required across repeated remediation attempts.",
        calibrationConfidence: "LOW",
        calibrationSummary: "Pilot calibration keeps this workflow review-required with low confidence.",
        latestEffectiveness: "NO_SIGNAL",
        effectivenessSummary: "No positive recovery signal is available yet.",
        meetingShape: "LONG_CONTEXT_MEETING",
        sessionDensityBand: "STEADY",
        meetingFrequencyBand: "HIGH_CADENCE",
        failureHistoryBand: "CHRONIC_REPEAT",
        participantRolePosture: "MIXED_STAKEHOLDERS",
        guidanceStatus: "SKIPPED_GUIDANCE",
        guidanceSummary: "Protected-field review guidance was skipped because bounded remediation kept repeating instead of stopping at review.",
        pilotConfidenceBand: "LOW",
        pilotRiskBand: "HIGH",
        pilotThreshold: 1,
        pilotSampleCoverageBand: "NARROW",
        pilotStabilityBand: "UNSTABLE",
        pilotStabilityConfidenceBand: "LOW",
        pilotConfidenceInterval: "WIDE",
        pilotOutcomeCorrelationBand: "AT_RISK",
        pilotLongTermMaterialImpactBand: "HIGH",
        pilotReviewSummary: "Keep protected-field review under early escalation.",
        sopTitle: "Protected-field review SOP",
        evidenceSummary: "Protected fields still need confirmation.",
        runbookTitle: "Escalate protected-state review",
        href: "/meetings/meeting_1",
        updatedAt: new Date("2026-04-04T08:00:00.000Z"),
      },
    ]);

    const sessionReview = buildRuntimeContinuityPilotSessionReview({
      recovery: {
        state: "REVIEW_REQUIRED",
        failureTaxonomy: "PROTECTED_STATE_GAP",
        summary: "Protected continuity fields need review.",
        operatorAction: "Pause remediation until protected fields are reviewed.",
        allowedActions: [],
        reviewReasons: ["confirmed facts", "boundary note"],
        blockedReasons: [],
        rollbackAnchor: {
          checkpointId: "checkpoint_1",
          checkpointLabel: "meeting_review",
          checkpointStatus: "READY",
        },
      },
      calibration: {
        pilotBasis: "Session-local calibration",
        rawState: "REVIEW_REQUIRED",
        calibratedState: "REVIEW_REQUIRED",
        confidence: "LOW",
        stateAdjusted: false,
        summary: "Pilot calibration keeps the workflow review-required.",
        reasons: ["Replay fidelity is still weak in the current continuity posture."],
      },
      analytics: {
        totalAttempts: 2,
        appliedCount: 0,
        reviewRequiredCount: 2,
        blockedCount: 0,
        latestAction: "SAVE_RECOVERY_CHECKPOINT",
        latestAttemptAt: new Date("2026-04-04T10:00:00.000Z"),
        repeatPattern: {
          status: "REPEATED_REVIEW_REQUIRED",
          summary: "Continuity remains review-required across repeated remediation attempts.",
        },
      },
      effectiveness: {
        pilotBasis: "Pilot remediation review",
        latestOutcome: "NO_SIGNAL",
        latestSummary: "The latest remediation did not execute.",
        effectiveCount: 0,
        partialCount: 0,
        ineffectiveCount: 0,
        noSignalCount: 2,
        escalationNeeded: false,
        escalationSummary: "The latest remediation produced no reliable recovery signal.",
      },
      pilotReview,
      cohortContext: {
        workspaceSizeBand: "SMALL",
        meetingShape: "LONG_CONTEXT_MEETING",
      },
    });
    const sop = buildRuntimeContinuitySop({
      recovery: {
        state: "REVIEW_REQUIRED",
        failureTaxonomy: "PROTECTED_STATE_GAP",
        summary: "Protected continuity fields need review.",
        operatorAction: "Pause remediation until protected fields are reviewed.",
        allowedActions: [],
        reviewReasons: ["confirmed facts", "boundary note"],
        blockedReasons: [],
        rollbackAnchor: {
          checkpointId: "checkpoint_1",
          checkpointLabel: "meeting_review",
          checkpointStatus: "READY",
        },
      },
      analytics: {
        totalAttempts: 2,
        appliedCount: 0,
        reviewRequiredCount: 2,
        blockedCount: 0,
        latestAction: "SAVE_RECOVERY_CHECKPOINT",
        latestAttemptAt: new Date("2026-04-04T10:00:00.000Z"),
        repeatPattern: {
          status: "REPEATED_REVIEW_REQUIRED",
          summary: "Continuity remains review-required across repeated remediation attempts.",
        },
      },
      effectiveness: {
        pilotBasis: "Pilot remediation review",
        latestOutcome: "NO_SIGNAL",
        latestSummary: "The latest remediation did not execute.",
        effectiveCount: 0,
        partialCount: 0,
        ineffectiveCount: 0,
        noSignalCount: 2,
        escalationNeeded: false,
        escalationSummary: "The latest remediation produced no reliable recovery signal.",
      },
      evidence: {
        summary: "Recovery evidence shows protected continuity fields still need review.",
        items: ["Review-required because confirmed facts and boundary note are missing."],
      },
      pilotReview: sessionReview,
    });

    expect(pilotReview.totalPilotCases).toBe(3);
    expect(pilotReview.workspaceCohort.sizeBand).toBe("SMALL");
    expect(pilotReview.workspaceCohort.pilotCaseRate).toBe(100);
    expect(pilotReview.cohortFamilies[0]?.cohortKey).toContain("SMALL");
    expect(pilotReview.cohortFamilies[0]?.riskBand).toBe("HIGH");
    expect(pilotReview.topFailureClasses[0]?.failureTaxonomy).toBe("NO_RECOVERY_ANCHOR");
    expect(pilotReview.calibrationProfile.defaultIneffectiveThreshold).toBe(1);
    expect(pilotReview.calibrationProfile.riskBandSummary).toContain("high-risk");
    expect(pilotReview.calibrationProfile.revisedHighlights[0]).toContain("failure_class");
    expect(pilotReview.drift.summary).toContain("Long-horizon pilot drift remains high");
    expect(pilotReview.drift.longHorizonDriftRate).toBe(100);
    expect(pilotReview.drift.materiallyDriftingCohorts[0]).toContain("SMALL");
    expect(pilotReview.meetingShapeCohorts[0]?.meetingShape).toBe("LEAN_MEETING");
    expect(pilotReview.sessionDensityCohorts[0]?.sessionDensityBand).toBe("LIGHT");
    expect(pilotReview.meetingFrequencyCohorts[0]?.meetingFrequencyBand).toBe("RECURRING");
    expect(pilotReview.failureHistoryCohorts[0]?.failureHistoryBand).toBe("CHRONIC_REPEAT");
    expect(pilotReview.participantRoleCohorts[0]?.participantRolePosture).toBe("EXEC_SPONSORED");
    expect(pilotReview.subgroupCalibration.summary).toContain("subgroup");
    expect(pilotReview.sampleReview.summary).toContain("sample");
    expect(pilotReview.sampleReview.aggregateSummary).toContain("sample-backed");
    expect(pilotReview.driftSynthesis.summary).toContain("drift");
    expect(pilotReview.stabilityRecheck.summary).toContain("stability");
    expect(pilotReview.stabilityRecheck.aggregateSummary).toContain("confidence");
    expect(pilotReview.stabilityScaleUp.summary).toContain("scale-up");
    expect(pilotReview.stabilityScaleUp.aggregateSummary).toContain("scale-up subgroup");
    expect(pilotReview.stabilityScaleUpRecheck.summary).toContain("Scale-up recheck");
    expect(pilotReview.stabilityScaleUpRecheck.aggregateSummary).toContain("variance-carrying");
    expect(pilotReview.subgroupStabilityDriftReview.summary).toContain("Subgroup stability drift review");
    expect(pilotReview.subgroupStabilityDriftReview.aggregateSummary).toContain("subgroup aging signal");
    expect(pilotReview.subgroupCohortAgingReview.summary).toContain("Long-term cohort aging review");
    expect(pilotReview.subgroupCohortAgingReview.aggregateSummary).toContain("aging-drift cohort");
    expect(pilotReview.subgroupDriftAgingScaleUpReview.summary).toContain("Subgroup drift aging scale-up review");
    expect(pilotReview.subgroupDriftAgingScaleUpReview.aggregateSummary).toContain("scale-up aging review");
    expect(pilotReview.subgroupDriftLongTermCohortAgingReview.summary).toContain("Subgroup drift long-term cohort aging review");
    expect(pilotReview.subgroupDriftLongTermCohortAgingReview.aggregateSummary).toContain("long-term cohort aging review");
    expect(pilotReview.subgroupDriftLongTermSampleExpansionReview.summary).toContain("Subgroup drift long-term sample expansion review");
    expect(pilotReview.subgroupDriftLongTermSampleExpansionReview.aggregateSummary).toContain("sample expansion review");
    expect(pilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.summary).toContain("sample expansion refinement");
    expect(pilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.aggregateSummary).toContain("deep-support");
    expect(pilotReview.intervalWordingConsistency.summary).toContain("Interval wording");
    expect(pilotReview.intervalWordingConsistency.aggregateSummary).toContain("canonical wording rules");
    expect(pilotReview.intervalWordingDriftAudit.summary).toContain("drift audit");
    expect(pilotReview.intervalWordingDriftAudit.aggregateSummary).toContain("aligned");
    expect(pilotReview.wordingDriftTracking.summary).toContain("Wording drift tracking");
    expect(pilotReview.wordingDriftTracking.aggregateSummary).toContain("drift rate");
    expect(pilotReview.intervalConsistencyGuidance.summary).toContain("Interval consistency guidance");
    expect(pilotReview.intervalConsistencyGuidance.aggregateSummary).toContain("canonical interval guidance");
    expect(pilotReview.intervalWordingAgingAudit.summary).toContain("Interval wording aging audit");
    expect(pilotReview.intervalWordingAgingAudit.aggregateSummary).toContain("regression rate");
    expect(pilotReview.intervalWordingCrossSurfaceRegressionReview.summary).toContain("Cross-surface interval wording regression review");
    expect(pilotReview.intervalWordingCrossSurfaceRegressionReview.aggregateSummary).toContain("cross-surface regression rate");
    expect(pilotReview.intervalWordingCrossSurfaceRegressionReview.adjustmentRecommendations[0]).toContain("meeting detail");
    expect(pilotReview.intervalWordingCrossSurfaceConsistencyAudit.summary).toContain("Cross-surface interval wording consistency audit");
    expect(pilotReview.intervalWordingCrossSurfaceConsistencyAudit.aggregateSummary).toContain("consistency audit rate");
    expect(pilotReview.intervalWordingCrossSurfaceConsistencyAudit.adjustmentRecommendations[0]).toContain("meeting detail");
    expect(pilotReview.intervalWordingCrossSurfaceRegressionAudit.summary).toContain("Cross-surface interval wording regression audit");
    expect(pilotReview.intervalWordingCrossSurfaceRegressionAudit.aggregateSummary).toContain("regression audit rate");
    expect(pilotReview.intervalWordingCrossSurfaceRegressionAudit.adjustmentRecommendations[0]).toContain("canonical interval wording");
    expect(pilotReview.intervalWordingCrossReadoutRegressionAudit.summary).toContain("Cross-readout interval wording regression audit");
    expect(pilotReview.intervalWordingCrossReadoutRegressionAudit.aggregateSummary).toContain("readout regression audit rate");
    expect(pilotReview.intervalWordingCrossReadoutRegressionAudit.adjustmentRecommendations[0]).toContain("threshold, step, and guideline");
    expect(pilotReview.intervalWordingCrossReadoutRegressionRefinement.summary).toContain("Cross-readout interval wording regression refinement");
    expect(pilotReview.intervalWordingCrossReadoutRegressionRefinement.aggregateSummary).toContain("refinement rate");
    expect(pilotReview.intervalWordingCrossReadoutRegressionRefinement.adjustmentRecommendations[0]).toContain("session summary");
    expect(pilotReview.longTermOutcomeCorrelation.summary).toContain("Long-term outcome");
    expect(pilotReview.longTermOutcomeReview.summary).toContain("Long-term outcome review");
    expect(pilotReview.longTermOutcomeReview.aggregateSummary).toContain("material impact");
    expect(pilotReview.longTermMaterialImpactReview.summary).toContain("Long-term material impact review");
    expect(pilotReview.longTermMaterialImpactReview.aggregateSummary).toContain("high-impact");
    expect(pilotReview.longTermMaterialImpactAudit.summary).toContain("material impact audit");
    expect(pilotReview.longTermMaterialImpactAudit.aggregateSummary).toContain("optimization hint");
    expect(pilotReview.materialImpactPatternAgingReview.summary).toContain("Material impact pattern aging review");
    expect(pilotReview.materialImpactPatternAgingReview.aggregateSummary).toContain("aging pattern");
    expect(pilotReview.materialImpactSamplingReview.summary).toContain("Material impact sampling review");
    expect(pilotReview.materialImpactSamplingReview.aggregateSummary).toContain("long-term sampling review");
    expect(pilotReview.materialImpactSamplingAgingReview.summary).toContain("Material impact sampling aging review");
    expect(pilotReview.materialImpactSamplingAgingReview.aggregateSummary).toContain("sampling aging review");
    expect(pilotReview.materialImpactSamplingAgingRefinement.summary).toContain("Material impact sampling aging refinement");
    expect(pilotReview.materialImpactSamplingAgingRefinement.aggregateSummary).toContain("sampling aging refinement review");
    expect(pilotReview.materialImpactSamplingAgingAudit.summary).toContain("Material impact sampling aging audit");
    expect(pilotReview.materialImpactSamplingAgingAudit.aggregateSummary).toContain("sampling aging audit");
    expect(pilotReview.materialImpactSamplingAgingRefinementAudit.summary).toContain("Material impact sampling aging refinement audit");
    expect(pilotReview.materialImpactSamplingAgingRefinementAudit.aggregateSummary).toContain("regressing-comparison");
    expect(pilotReview.guidanceRefinement.summary).toContain("operator");
    expect(pilotReview.sopEffectivenessSynthesis.summary).toContain("SOP");
    expect(pilotReview.thresholdRevisions[0]?.recommendedIneffectiveThreshold).toBe(1);
    expect(pilotReview.thresholdRevisions[0]?.sampleCoverageSummary).toContain("pilot sample");
    expect(pilotReview.thresholdRevisions[0]?.stabilityConfidenceBand).toBe("LOW");
    expect(pilotReview.thresholdRevisions[0]?.intervalWordingSummary).toContain("Wide confidence interval");
    expect(pilotReview.operatorHandlingEffectiveness.skippedGuidanceRate).toBe(67);
    expect(pilotReview.operatorHandlingEffectiveness.outcomeVarianceSummary).toContain("skipped guidance");
    expect(pilotReview.operatorHandlingEffectiveness.stepReviews[0]?.label).toBe("Anchor check");
    expect(pilotReview.operatorHandlingEffectiveness.stepReviews[0]?.correlationSummary).toContain("longer pilot horizon");
    expect(pilotReview.operatorHandlingEffectiveness.stepReviews[0]?.stabilityConfidenceBand).toBe("LOW");
    expect(pilotReview.operatorHandlingEffectiveness.stepReviews[0]?.intervalWordingSummary).toContain("Wide confidence interval");
    expect(pilotReview.operatorHandlingEffectiveness.stepReviews[0]?.materialImpactSummary).toContain("material impact");
    expect(sessionReview.failureTaxonomy).toBe("PROTECTED_STATE_GAP");
    expect(sessionReview.confidenceBand).toBe("LOW");
    expect(sessionReview.riskBand).toBe("HIGH");
    expect(sessionReview.recommendedIneffectiveThreshold).toBe(1);
    expect(sessionReview.adjustmentSummary).toContain("early review signal");
    expect(sessionReview.meetingShape).toBe("LONG_CONTEXT_MEETING");
    expect(sessionReview.sessionDensityBand).toBe("LIGHT");
    expect(sessionReview.meetingFrequencyBand).toBe("SPORADIC");
    expect(sessionReview.failureHistoryBand).toBe("FIRST_SIGNAL");
    expect(sessionReview.participantRolePosture).toBe("UNKNOWN");
    expect(sessionReview.cohortSummary).toContain("LONG_CONTEXT_MEETING");
    expect(sessionReview.longHorizonSummary).toContain("longer pilot horizon");
    expect(sessionReview.thresholdRevisionSummary).toContain("threshold 1");
    expect(sessionReview.operatorHandlingSummary).toContain("skip guidance");
    expect(sessionReview.varianceSummary).toContain("operator outcome variance");
    expect(sessionReview.subgroupSummary).toContain("session density");
    expect(sessionReview.refinedCalibrationSummary).toContain("calibration");
    expect(sessionReview.sampleCoverageSummary).toContain("pilot sample");
    expect(sessionReview.stabilityBand).toBe("UNSTABLE");
    expect(sessionReview.stabilitySummary).toContain("unstable");
    expect(sessionReview.stabilityConfidenceBand).toBe("LOW");
    expect(sessionReview.stabilityVarianceSummary).toContain("variance");
    expect(sessionReview.stabilityScaleUpSummary).toContain("scale-up");
    expect(sessionReview.stabilityScaleUpRecheckSummary).toContain("scale-up recheck");
    expect(sessionReview.subgroupStabilityDriftSummary).toContain("subgroup drift review");
    expect(sessionReview.subgroupCohortAgingSummary).toContain("cohort aging comparison");
    expect(sessionReview.subgroupDriftAgingScaleUpSummary).toContain("cohort aging scale-up review");
    expect(sessionReview.subgroupDriftLongTermCohortAgingSummary).toContain("longer-horizon cohort aging review");
    expect(sessionReview.subgroupDriftLongTermSampleExpansionSummary).toContain("long-term sample expansion review");
    expect(sessionReview.subgroupDriftLongTermSampleExpansionRefinementSummary).toContain("sample expansion refinement review");
    expect(sessionReview.confidenceInterval).toBe("WIDE");
    expect(sessionReview.confidenceAdjustmentRationale).toContain("wide confidence interval");
    expect(sessionReview.intervalWordingSummary).toContain("Wide confidence interval");
    expect(sessionReview.intervalWordingDriftSummary).toContain("canonical wide interval wording");
    expect(sessionReview.wordingDriftTrackingSummary).toContain("Wording drift tracking");
    expect(sessionReview.intervalConsistencyGuidanceSummary).toContain("Interval consistency guidance");
    expect(sessionReview.intervalWordingAgingSummary).toContain("Interval wording aging audit");
    expect(sessionReview.intervalWordingRegressionSummary).toContain("cross-surface interval wording regression review");
    expect(sessionReview.intervalWordingConsistencyAuditSummary).toContain("cross-surface interval wording consistency audit");
    expect(sessionReview.intervalWordingRegressionAuditSummary).toContain("cross-surface interval wording regression audit");
    expect(sessionReview.intervalWordingCrossReadoutAuditSummary).toContain("cross-readout interval wording regression audit");
    expect(sessionReview.intervalWordingCrossReadoutRegressionRefinementSummary).toContain("cross-readout interval wording regression refinement");
    expect(sessionReview.driftSynthesisSummary).toContain("drift");
    expect(sessionReview.outcomeCorrelationBand).toBe("AT_RISK");
    expect(sessionReview.longTermOutcomeSummary).toContain("pilot horizon");
    expect(sessionReview.longTermSopImpactSummary).toContain("long-term SOP");
    expect(sessionReview.longTermMaterialImpactBand).toBe("WATCH");
    expect(sessionReview.longTermMaterialImpactSummary).toContain("material impact");
    expect(sessionReview.longTermMaterialImpactReviewSummary).toContain("material impact review");
    expect(sessionReview.longTermMaterialImpactAuditSummary).toContain("material impact audit");
    expect(sessionReview.materialImpactPatternAgingSummary).toContain("Material impact pattern aging review");
    expect(sessionReview.materialImpactSamplingSummary).toContain("Material impact sampling review");
    expect(sessionReview.materialImpactSamplingAgingSummary).toContain("Material impact sampling aging review");
    expect(sessionReview.materialImpactAgingRefinementSummary).toContain("Material impact sampling aging refinement");
    expect(sessionReview.materialImpactSamplingAgingAuditSummary).toContain("Material impact sampling aging audit");
    expect(sessionReview.materialImpactSamplingAgingRefinementAuditSummary).toContain("Material impact sampling aging refinement audit");
    expect(sessionReview.sopEffectivenessSummary).toContain("SOP");
    expect(sessionReview.guidanceRefinementSummary).toContain("review");
    expect(sop.title).toBe("Protected-field review SOP");
    expect(sop.escalationRule).toContain("Current pilot review also shows repeated or ineffective remediation pressure");
    expect(sop.boundaryNote).toContain("does not expand send authority");
  });

  it("builds a workspace operator overview without widening runtime authority", () => {
    const input = {
      workspaceId: "workspace_1",
      sessionCounts: {
        total: 3,
        active: 1,
      },
      queueCounts: {
        verification: 2,
        promotion: 1,
        reflectionCarryForward: 1,
        openProblemSpaces: 1,
        unresolvedCompositionFailures: 1,
        reflectionQueue: 1,
        consolidationQueue: 1,
      },
      verificationReports: [
        {
          id: "verification_1",
          reportType: "meeting_review",
          status: "NEEDS_REVIEW",
          truthScore: 78,
          summary: "Delivery timing still needs source-grounded review.",
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
          runtimeSession: {
            id: "session_1",
            label: "Acme runtime session",
            meetingId: "meeting_1",
          },
        },
      ],
      truthConflicts: [
        {
          id: "conflict_1",
          status: "OPEN",
          summary: "Champion owner differs across sources.",
          subjectKey: "workspace_1:MEETING:meeting_1:owner",
          createdAt: new Date("2026-04-02T11:00:00.000Z"),
          runtimeSession: {
            id: "session_1",
            label: "Acme runtime session",
            meetingId: "meeting_1",
          },
        },
      ],
      memoryCandidates: [
        {
          id: "candidate_1",
          status: "DEFERRED",
          summary: "Procurement is still pending internal approval.",
          reviewerNote: "This line stays deferred until the procurement owner is confirmed.",
          sourceVerification: "HUMAN_CONFIRMED",
          sourceStatus: "DRAFT",
          evidenceRefs: "[\"meeting:1\",\"crm:deal_1\"]",
          confidence: 82,
          memoryItemId: "memory_1",
          createdAt: new Date("2026-04-02T12:00:00.000Z"),
          runtimeSession: {
            id: "session_1",
            label: "Acme runtime session",
            meetingId: "meeting_1",
          },
        },
        {
          id: "candidate_reflection_1",
          status: "VERIFIED",
          summary: "Carry forward Acme runtime session. Checklist stays internal until review closes.",
          reviewerNote:
            "Reflection candidate is derived only from trusted runtime state and still needs a separate review path.",
          sourceVerification: "human_confirmed_reflection",
          sourceStatus: "trusted_runtime_compaction",
          evidenceRefs: "[\"meeting:1\",\"memory:1\"]",
          confidence: 94,
          memoryItemId: null,
          createdAt: new Date("2026-04-02T12:30:00.000Z"),
          runtimeSession: {
            id: "session_1",
            label: "Acme runtime session",
            meetingId: "meeting_1",
          },
        },
      ],
      memoryPromotions: [
        {
          id: "promotion_1",
          memoryCandidateId: "candidate_1",
          memoryItemId: "memory_1",
          status: "DEFERRED",
          rationale: "Promotion deferred until owner is confirmed.",
          createdAt: new Date("2026-04-02T13:00:00.000Z"),
          runtimeSession: {
            id: "session_1",
            label: "Acme runtime session",
            meetingId: "meeting_1",
          },
        },
      ],
      problemSpaces: [
        {
          id: "problem_1",
          title: "Next-step alignment",
          summary: "The team needs a single owner for the security review follow-through.",
          nextStep: "Assign the security review owner before external follow-up.",
          status: "ASSIGNED",
          ownerHint: "Alice",
          evidenceRefs: "[\"meeting:1\",\"memory:1\"]",
          updatedAt: new Date("2026-04-02T14:00:00.000Z"),
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          driAssignments: [
            {
              assignedUserName: "Alice",
              assignedByName: "Bob",
              note: "Assigned so the confirmed next step has one accountable follow-through owner.",
            },
          ],
          runtimeSession: {
            meetingId: "meeting_1",
          },
        },
      ],
      playerCoachBriefs: [
        {
          id: "brief_1",
          title: "Next-step alignment (PLAYER_COACH)",
          summary: "Coach the owner to unblock the security review before promising timing.",
          updatedAt: new Date("2026-04-02T15:00:00.000Z"),
          problemSpaceId: "problem_1",
          runtimeSession: {
            meetingId: "meeting_1",
          },
          problemSpace: {
            id: "problem_1",
            title: "Next-step alignment",
            meetingId: "meeting_1",
            status: "ASSIGNED",
            ownerHint: "Alice",
            evidenceRefs: "[\"meeting:1\",\"memory:1\"]",
            driAssignments: [
              {
                assignedUserName: "Alice",
                assignedByName: "Bob",
                note: "Assigned so the confirmed next step has one accountable follow-through owner.",
              },
            ],
          },
        },
      ],
      compositionFailures: [
        {
          id: "failure_1",
          failureClass: "VERIFICATION_FAIL",
          summary: "Verification blocked due to promise-sensitive wording.",
          problemSpace: {
            title: "Truth boundary review",
          },
          createdAt: new Date("2026-04-02T16:00:00.000Z"),
          runtimeSession: {
            id: "session_1",
            label: "Acme runtime session",
            meetingId: "meeting_1",
          },
        },
      ],
      consolidationJobs: [
        {
          id: "reflection_1",
          jobType: "meeting_reflection",
          status: "QUEUED",
          inputSummary: "Reflection queued after human-confirmed meeting review for Acme runtime session.",
          outputSummary: "Reflection compacted trusted carry-forward context for Acme runtime session.",
          reviewPosture: "Review-first, candidate-only.",
          createdAt: new Date("2026-04-02T17:06:00.000Z"),
          pausedAt: null,
          completedAt: null,
          runtimeSession: {
            meetingId: "meeting_1",
          },
        },
        {
          id: "consolidation_1",
          jobType: "meeting_review_consolidation",
          status: "PAUSED",
          inputSummary: "Post-review consolidation for Acme runtime session",
          outputSummary: "Paused by operator for review and controlled follow-through.",
          reviewPosture: "Candidate-only and auditable.",
          createdAt: new Date("2026-04-02T17:00:00.000Z"),
          pausedAt: new Date("2026-04-02T17:05:00.000Z"),
          completedAt: null,
          runtimeSession: {
            meetingId: "meeting_1",
          },
        },
      ],
      signals: [
        {
          id: "signal_1",
          signalType: "meeting_ingest",
          sourceType: "meeting_note",
          signalSummary: "Meeting ingest persisted 3 payload handles.",
          truthWeight: 70,
          createdAt: new Date("2026-04-02T17:10:00.000Z"),
          runtimeSession: {
            meetingId: "meeting_1",
          },
        },
      ],
      capabilities: [
        {
          id: "capability_1",
          name: "Token Budget Governor",
          stage: "runtime",
          description: "Keeps context inside a managed token budget.",
          loadPolicy: "always_on",
          reviewRequired: true,
          boundaryNote: "Runtime remains review-first.",
        },
      ],
      connectors: [
        {
          id: "connector_1",
          provider: "GOOGLE_OAUTH",
          status: "CONNECTED",
          lastSyncedAt: new Date("2026-04-02T17:05:00.000Z"),
          lastSyncStatus: "healthy",
          lastSyncMessage: null,
        },
        {
          id: "connector_2",
          provider: "WECOM_OAUTH",
          status: "ERROR",
          lastSyncedAt: new Date("2026-04-02T17:06:00.000Z"),
          lastSyncStatus: "token expired",
          lastSyncMessage: null,
        },
      ],
      handoffPackets: [
        {
          id: "handoff_1",
          goal: "Verify the runtime review before quiet promotion.",
          approvalTier: "A1" as const,
          fromAgent: "lead-orchestrator" as const,
          toAgent: "verification-agent" as const,
          createdAt: new Date("2026-04-02T17:15:00.000Z"),
          runtimeSession: {
            meetingId: "meeting_1",
          },
        },
      ],
      initiativeRuns: [
        {
          id: "initiative_1",
          title: "Next-step alignment",
          summary: "Run the next-step chain with a visible owner.",
          status: "ACTIVE",
          targetOutcome: "Assign the security review owner before external follow-up.",
          createdAt: new Date("2026-04-02T17:20:00.000Z"),
          runtimeSession: {
            meetingId: "meeting_1",
          },
        },
      ],
      humanExecutions: [
        {
          id: "human_1",
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          status: "EXECUTED",
          executionAcknowledgementStatus: "ACKNOWLEDGED",
          executionIntent: "Send the security checklist.",
          executionOwnerName: "Alice",
          followThroughStatus: "awaiting receipt",
          executedAt: new Date("2026-04-02T17:30:00.000Z"),
          updatedAt: new Date("2026-04-02T17:30:00.000Z"),
        },
      ],
      officialWriteIntents: [
        {
          id: "write_1",
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          writeActionType: "crm.attach_note",
          officialObjectRef: "opportunity:opp_1",
          writeExecutionStatus: "EXECUTED",
          writeAcknowledgementStatus: "SUCCESS",
          acknowledgedAt: new Date("2026-04-02T17:34:00.000Z"),
          updatedAt: new Date("2026-04-02T17:34:00.000Z"),
        },
      ],
      limitedAutoIntents: [
        {
          id: "limited_auto_1",
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          limitedAutoActionType: "crm.update_blockers",
          officialObjectRef: "opportunity:opp_1",
          limitedAutoExecutionStatus: "REQUESTED",
          limitedAutoAckStatus: "PENDING",
          acknowledgedAt: null,
          updatedAt: new Date("2026-04-02T17:36:00.000Z"),
        },
      ],
      officialFollowThrough: [
        {
          id: "follow_1",
          meetingId: "meeting_1",
          opportunityId: "opp_1",
          companyId: "company_1",
          followThroughStatus: "OPEN",
          followThroughResolutionStatus: "OPEN",
          followThroughOwnerName: "Alice",
          followThroughNextAction: "Confirm checklist receipt in CRM.",
          followThroughSummary: "Receipt confirmation still pending.",
          updatedAt: new Date("2026-04-02T17:40:00.000Z"),
        },
      ],
      coordinationMetrics: {
        metricDate: new Date("2026-04-02T00:00:00.000Z"),
        actionReadyCount: 1,
        reviewNeededCount: 2,
        waitingOnSignalCount: 1,
        waitingOnAuthorityCount: 0,
        capabilityGapCount: 0,
      },
      cacheTelemetry: [
        {
          cacheStatus: "hit",
          tokensSaved: 180,
        },
      ],
      benchmarkMatrixRuns: benchmarkMatrixRunsFixture,
      benchmarkExecutionRequests: benchmarkExecutionRequestsFixture,
      benchmarkExecutionAcknowledgements: benchmarkExecutionAcknowledgementsFixture,
      benchmarkExecutionFollowThrough: benchmarkExecutionFollowThroughFixture,
      runtimeSessions: [
        {
          id: "session_1",
          workspaceId: "workspace_1",
          label: "Acme security session",
          sessionKey: "session::acme-security",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/meetings/meeting_1",
          boundaryNote: "No auto-send.",
          replayableEventLog: JSON.stringify([
            {
              at: "2026-04-03T11:58:00.000Z",
              type: "runtime.replay.review",
            },
          ]),
          meetingId: "meeting_1",
          budgetTokenLimit: 100,
          budgetTokenUsed: 84,
          prunedTokenCount: 36,
          resumedFromKey: null,
          createdAt: new Date("2026-04-03T11:30:00.000Z"),
          updatedAt: new Date("2026-04-03T12:00:00.000Z"),
          closedAt: null,
          contextEditEvents: [
            {
              id: "edit_1",
              strategy: "manual_budget_prune",
              beforeTokenCount: 140,
              afterTokenCount: 84,
              removedHandles: JSON.stringify(["payload://meeting_transcript/1/transcript"]),
              removedSummary: "Transcript overflow moved behind a handle.",
              createdAt: new Date("2026-04-03T11:40:00.000Z"),
            },
          ],
          checkpoints: [
            {
              id: "checkpoint_1",
              checkpointKey: "checkpoint::meeting_review",
              label: "meeting_review",
              status: "READY",
              summary: "PRUNE: review completed",
              snapshotJson: JSON.stringify({
                continuityState: {
                  objective: "Assign Alice to close the security blocker.",
                  relevantObjects: ["Meeting: Security review sync"],
                  confirmedFacts: ["Checklist stays internal."],
                  blockers: ["Security owner still needs one answer."],
                  decisions: ["Alice owns the next step."],
                  nextActions: ["Assign Alice to close the blocker."],
                  openQuestions: [],
                  evidenceRefs: ["meeting:1"],
                  reviewState: "needs_review",
                  boundaryNote: "No auto-send.",
                  budgetState: "PRUNE",
                  loadedHandles: ["payload://meeting_note/1/summary"],
                  prunedHandles: ["payload://meeting_transcript/1/transcript"],
                },
              }),
              createdAt: new Date("2026-04-03T11:45:00.000Z"),
              updatedAt: new Date("2026-04-03T11:45:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Objective: Assign Alice to close the security blocker.",
            decisionSummary: "Alice owns the next step.",
            blockerSummary: "Security owner still needs one answer.",
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Assign Alice to close the blocker.",
            boundaryNote: "No auto-send.",
          },
          problemSpaces: [
            {
              title: "Security blocker",
              nextStep: "Assign Alice to close the blocker.",
              status: "WAITING_ON_SIGNAL",
              ownerHint: "Alice",
              evidenceRefs: JSON.stringify(["meeting:1"]),
            },
          ],
          memoryCandidates: [
            {
              id: "candidate_promoted_1",
              summary: "Checklist stays internal.",
              status: "PROMOTED",
              evidenceRefs: JSON.stringify(["meeting:1"]),
              sourceVerification: "HUMAN_CONFIRMED",
            },
          ],
          memoryPromotions: [
            {
              memoryCandidateId: "candidate_promoted_1",
              status: "PROMOTED",
            },
          ],
          verificationReports: [
            {
              status: "NEEDS_REVIEW",
              summary: "One answer still needs confirmation.",
              blockedReasons: JSON.stringify(["One answer still needs confirmation."]),
            },
          ],
          handoffPackets: [
            {
              id: "handoff_runtime_1",
              packetKey: "handoff::session_1::verification",
              fromAgent: "meeting-analyst" as const,
              toAgent: "verification-agent" as const,
              goal: "Prepare verification output for the confirmed facts slice.",
              approvalTier: "A1" as const,
              constraintsJson: JSON.stringify(["Do not widen commitment wording."]),
              trustedRefs: JSON.stringify(["meeting:1", "artifact:meeting_facts"]),
              untrustedRefs: JSON.stringify(["draft:promise-language"]),
              requiredOutputs: JSON.stringify(["verification_report", "blocked_reasons"]),
              evidenceRefs: JSON.stringify(["meeting:1", "artifact:meeting_facts"]),
              notebookRef: "notebook_1",
              checkpointRef: "checkpoint_1",
              createdAt: new Date("2026-04-03T11:47:00.000Z"),
            },
          ],
          persistedPayloadHandles: [
            "payload://meeting_note/1/summary",
            "payload://meeting_transcript/1/transcript",
          ],
          remediationEvents: [
            {
              id: "remediation_event_1",
              eventType: "continuity.remediation.blocked",
              payload: JSON.stringify({
                action: "SAVE_RECOVERY_CHECKPOINT",
                executionStatus: "BLOCKED",
                summary: "Save recovery checkpoint was blocked.",
                beforeSummary: "Budget posture: PRUNE. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
                afterSummary: "Budget posture: PRUNE. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
                before: {
                  riskLevel: "HIGH",
                  recoveryState: "REVIEW_REQUIRED",
                  failureTaxonomy: "PROTECTED_STATE_GAP",
                },
                after: {
                  riskLevel: "HIGH",
                  recoveryState: "REVIEW_REQUIRED",
                  failureTaxonomy: "PROTECTED_STATE_GAP",
                },
              }),
              trustedContext: null,
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-03T11:50:00.000Z"),
            },
            {
              id: "remediation_event_2",
              eventType: "continuity.remediation.blocked",
              payload: JSON.stringify({
                action: "SAVE_RECOVERY_CHECKPOINT",
                executionStatus: "BLOCKED",
                summary: "Save recovery checkpoint was blocked again.",
                beforeSummary: "Budget posture: PRUNE. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
                afterSummary: "Budget posture: PRUNE. Replay: WEAK. Payload state: checkpoint_snapshot. Risk: HIGH. Recovery: REVIEW_REQUIRED.",
                before: {
                  riskLevel: "HIGH",
                  recoveryState: "REVIEW_REQUIRED",
                  failureTaxonomy: "PROTECTED_STATE_GAP",
                },
                after: {
                  riskLevel: "HIGH",
                  recoveryState: "REVIEW_REQUIRED",
                  failureTaxonomy: "PROTECTED_STATE_GAP",
                },
              }),
              trustedContext: null,
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-03T11:49:00.000Z"),
            },
          ],
          requestEvents: [
            {
              id: "human_input_request_1",
              eventType: "human-input.checkpoint.requested",
              payload: JSON.stringify({
                checkpointId: "checkpoint_1",
                checkpointKey: "checkpoint::meeting_review",
                resumeToken: "checkpoint::meeting_review",
                prompt:
                  "Capture human input against checkpoint::meeting_review before resuming: One answer still needs confirmation.",
                summary:
                  "Human input checkpoint request already recorded for checkpoint::meeting_review before bounded resume continues.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_1",
                actorUserId: "user_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-03T11:51:00.000Z"),
            },
            {
              id: "human_input_ack_1",
              eventType: "human-input.checkpoint.acknowledged",
              payload: JSON.stringify({
                requestEventId: "human_input_request_1",
                checkpointId: "checkpoint_1",
                checkpointKey: "checkpoint::meeting_review",
                resumeToken: "checkpoint::meeting_review",
                prompt:
                  "Capture human input against checkpoint::meeting_review before resuming: One answer still needs confirmation.",
                summary:
                  "Human input checkpoint acknowledgement recorded for checkpoint::meeting_review.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_1",
                actorUserId: "user_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-03T11:52:00.000Z"),
            },
          ],
        },
      ],
    };
    const businessLoopGapReadout = buildWorkspaceBusinessLoopGapReadout({
      workspaceId: input.workspaceId,
      truthConflicts: input.truthConflicts,
      problemSpaces: input.problemSpaces,
      compositionFailures: input.compositionFailures,
      coordinationMetrics: input.coordinationMetrics,
    });
    const overview = buildWorkspaceRuntimeOperatorOverview(input);

    expect(businessLoopGapReadout.businessLoopGapSummary.primaryGap?.kind).toBe(
      "missing-kpi-link",
    );
    expect(
      businessLoopGapReadout.businessLoopGapSummary.kindCounts.some(
        (item) => item.kind === "unresolved-conflict",
      ),
    ).toBe(true);
    expect(overview.summary.reviewQueue).toBe(2);
    expect(overview.summary.operatingGapQueue).toBeGreaterThan(0);
    expect(overview.summary.criticalOperatingGaps).toBe(0);
    expect(overview.summary.promotionQueue).toBe(1);
    expect(overview.summary.reflectionCarryForward).toBe(1);
    expect(overview.summary.reflectionQueue).toBe(1);
    expect(overview.summary.consolidationQueue).toBe(1);
    expect(overview.operatorReviewSummary.state).toBe("verification_attention");
    expect(overview.operatorReviewSummary.driver).toBe("verification_queue");
    expect(overview.operatorReviewActionSummary.state).toBe("resolve_verification");
    expect(overview.operatorReviewActionSummary.driver).toBe("verification_queue");
    expect(overview.operatorReviewSummary.counts.verificationQueue).toBe(2);
    expect(overview.summary.cacheHitRate).toBe(100);
    expect(overview.verificationQueue[0]?.source).toBe("truth_conflict");
    expect(overview.promotionQueue[0]?.source).toBe("memory_promotion");
    expect(overview.promotionQueue[0]?.truthConflictOpen).toBe(true);
    expect(overview.promotionQueue[0]?.rationale).toContain("deferred");
    expect(overview.promotionQueue[0]?.sourceClasses).toContain("human_confirmed");
    expect(overview.problemSpaces[0]?.groundingSummary).toContain("confirmed or promoted runtime signals");
    expect(overview.operatingGaps.some((item) => item.kind === "unresolved-conflict")).toBe(true);
    expect(overview.operatingGaps.some((item) => item.kind === "missing-evidence")).toBe(true);
    expect(overview.operatingGapSummary.kindCounts.some((item) => item.kind === "unresolved-conflict")).toBe(true);
    expect(overview.businessLoopGapSummary.primaryGap?.kind).toBe("missing-kpi-link");
    expect(overview.businessLoopGapSummary.reviewRequired).toBeGreaterThan(0);
    expect(
      overview.businessLoopGapSummary.kindCounts.some(
        (item) => item.kind === "unresolved-conflict",
      ),
    ).toBe(true);
    expect(overview.problemSpaces[0]?.driSummary).toContain("DRI: Alice");
    expect(overview.playerCoachQueue[0]?.truthPosture).toContain("grounded enough");
    expect(overview.compositionFailures[0]?.problemSpaceTitle).toBe("Truth boundary review");
    expect(overview.problemSpaces[0]?.href).toBe("/meetings/meeting_1");
    expect(overview.reflectionCandidates[0]?.status).toBe("VERIFIED");
    expect(overview.reflectionCandidates[0]?.sourceClasses).toContain("human_confirmed_reflection");
    expect(overview.reflectionCandidates[0]?.evidenceSummary).toContain("meeting:1");
    expect(overview.reflectionJobs[0]?.status).toBe("QUEUED");
    expect(overview.consolidationJobs[0]?.meetingId).toBe("meeting_1");
    expect(overview.consolidationAuditSummary.state).toBe("paused");
    expect(overview.reflectionJobs[0]?.jobType).toBe("meeting_reflection");
    expect(overview.consolidationJobs[0]?.status).toBe("PAUSED");
    expect(overview.signals[0]?.truthWeight).toBe(70);
    expect(overview.capabilities[0]?.name).toBe("Token Budget Governor");
    expect(overview.projectSkillLibrary.summary.skillCount).toBe(8);
    expect(overview.projectSkillLibrary.summary.liveCapabilitySignals).toBe(1);
    expect(
      overview.projectSkillLibrary.environmentSeams.find(
        (item) => item.seamKind === "official_action",
      )?.state,
    ).toBe("planned_boundary_only");
    expect(
      overview.projectSkillLibrary.skillEntries.find(
        (item) => item.skillId === "proposal-shaping-skill",
      )?.environmentSeamIds,
    ).toEqual(
      expect.arrayContaining([
        "browser-seam",
        "connector-seam",
        "workspace-context-seam",
      ]),
    );
    expect(overview.environmentContract.summary.connectedConnectorCount).toBe(1);
    expect(
      overview.environmentContract.seams.find((item) => item.seamKind === "connector")
        ?.runtimePosture,
    ).toBe("partially_connected");
    expect(
      overview.environmentContract.seams.find((item) => item.seamKind === "official_action")
        ?.runtimePosture,
    ).toBe("review_gated");
    expect(overview.environmentContract.executionSeam.posture).toBe("follow_through_open");
    expect(overview.environmentContract.executionSeam.latestSource).toBe("follow_through");
    expect(overview.environmentContract.executionSeam.counts.officialWritesPending).toBe(1);
    expect(overview.environmentContract.executionSeam.counts.officialWritesAcknowledged).toBe(1);
    expect(overview.environmentContract.executionAuthority.posture).toBe("narrow_limited_auto");
    expect(overview.environmentContract.executionAuthority.counts.guardedWriteReviewGated).toBe(4);
    expect(overview.environmentContract.executionAuthority.counts.limitedAutoEligible).toBe(2);
    expect(overview.environmentContract.executionAuthority.counts.limitedAutoManualOnly).toBe(2);
    expect(
      overview.environmentContract.executionAuthority.sourceEntries.find((item) => item.source === "limited_auto")
        ?.posture,
    ).toBe("narrow_limited_auto");
    expect(overview.operatorControlSummary.state).toBe("execution_follow_through");
    expect(overview.operatorControlSummary.driver).toBe("environment_execution");
    expect(overview.operatorControlSummary.authorityPosture).toBe("narrow_limited_auto");
    expect(overview.operatorControlSummary.executionSeamPosture).toBe("follow_through_open");
    expect(overview.operatorControlSummary.benchmarkWorkflowState).toBe("follow_through_resolved");
    expect(overview.operatorControlSummary.focusTitle).toBe("Receipt confirmation still pending.");
    expect(overview.operatorControlSummary.focusHref).toBe("/operating");
    expect(overview.operatorControlSummary.counts.pendingExecutionWrites).toBe(1);
    expect(overview.operatorControlSummary.counts.openExecutionFollowThrough).toBe(1);
    expect(overview.operatorControlSummary.counts.benchmarkRecordedGates).toBe(3);
    expect(overview.operatorCueSummary.state).toBe("operating_gap_attention");
    expect(overview.operatorCueSummary.driver).toBe("operator_work");
    expect(overview.operatorNextMoveSummary.state).toBe("resolve_operating_gap");
    expect(overview.operatorNextMoveSummary.driver).toBe("operator_work");
    expect(overview.operatorActionCueSummary.state).toBe("resolve_operating_gap");
    expect(overview.operatorActionCueSummary.driver).toBe("operator_work");
    expect(overview.operatorReviewControlCueSummary.state).toBe("control_priority");
    expect(overview.operatorReviewControlCueSummary.driver).toBe("operator_control");
    expect(overview.operatorStartPointSummary.state).toBe("resolve_operating_gap");
    expect(overview.operatorStartPointSummary.secondaryState).toBe("control_priority");
    expect(overview.benchmarkMatrix.layers.map((item) => item.layerId)).toEqual([
      "runtime_eval",
      "adapter_conformance",
      "boundary_regression",
      "operator_usability",
    ]);
    expect(overview.benchmarkMatrix.summary.recordedGates).toBe(3);
    expect(overview.benchmarkMatrix.summary.warningGates).toBe(1);
    expect(
      overview.benchmarkMatrix.layers.find((item) => item.layerId === "runtime_eval")?.outcomeStatus,
    ).toBe("warning");
    expect(
      overview.benchmarkMatrix.layers.find((item) => item.layerId === "runtime_eval")?.recordedGateCount,
    ).toBe(2);
    expect(
      overview.benchmarkMatrix.layers
        .find((item) => item.layerId === "operator_usability")
        ?.gates.find((gate) => gate.gateId === "build_gate")?.latestOutcome.recordedBy,
    ).toBe("founder@demo.com");
    expect(overview.benchmarkMatrix.workflow.state).toBe("follow_through_resolved");
    expect(overview.benchmarkMatrix.workflow.request.state).toBe("fulfilled");
    expect(overview.benchmarkMatrix.workflow.request.requestKey).toBe(
      "benchmark_request::workspace-validation",
    );
    expect(overview.benchmarkMatrix.workflow.latestRun.state).toBe("recorded");
    expect(overview.benchmarkMatrix.workflow.latestRun.benchmarkRunId).toBe("benchmark_run_1");
    expect(overview.benchmarkMatrix.workflow.acknowledgement.state).toBe("acknowledged");
    expect(overview.benchmarkMatrix.workflow.acknowledgement.acknowledgedBy).toBe(
      "operator@demo.com",
    );
    expect(overview.benchmarkMatrix.workflow.followThrough.state).toBe("resolved");
    expect(overview.benchmarkMatrix.workflow.followThrough.resolvedBy).toBe("operator@demo.com");
    expect(overview.benchmarkMatrix.workflow.latestFollowThroughAt).toEqual(
      new Date("2026-04-03T12:12:00.000Z"),
    );
    expect(overview.handoffPackets[0]?.toAgent).toBe("verification-agent");
    expect(overview.initiativeRuns[0]?.status).toBe("ACTIVE");
    expect(overview.coordinationTraceQueue[0]?.posture).toBe("FOLLOW_THROUGH_OPEN");
    expect(overview.coordinationTraceQueue[0]?.officialFollowThroughSummary).toContain("open");
    expect(overview.continuityQueue[0]?.posture).toBe("PRUNE");
    expect(overview.continuityQueue[0]?.runThread.runId).toBe("session_1");
    expect(overview.continuityQueue[0]?.runThread.threadId).toBe("session::acme-security");
    expect(overview.continuityQueue[0]?.runThread.objectRefs.workspaceId).toBe("workspace_1");
    expect(overview.continuityQueue[0]?.runThread.latestCheckpoint?.checkpointKey).toBe(
      "checkpoint::meeting_review",
    );
    expect(overview.continuityQueue[0]?.runThread.resume.state).toBe("ready");
    expect(overview.continuityQueue[0]?.runThread.replay.eventLogEntries).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.resultAcknowledgement.state).toBe(
      "follow_through_open",
    );
    expect(overview.continuityQueue[0]?.runThread.resultAcknowledgement.source).toBe(
      "official_followthrough",
    );
    expect(overview.continuityQueue[0]?.runThread.resultFlow.latestState).toBe(
      "follow_through_open",
    );
    expect(overview.continuityQueue[0]?.runThread.resultFlow.latestSource).toBe(
      "official_followthrough",
    );
    expect(overview.continuityQueue[0]?.runThread.resultFlow.trackedSourceCount).toBe(4);
    expect(overview.continuityQueue[0]?.runThread.resultFlow.requiresOperatorAttentionCount).toBe(2);
    expect(overview.continuityQueue[0]?.runThread.resultFlow.resolvedCount).toBe(2);
    expect(overview.continuityQueue[0]?.runThread.resultFlow.counts.pending).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.resultFlow.counts.acknowledged).toBe(2);
    expect(overview.continuityQueue[0]?.runThread.resultFlow.counts.followThroughOpen).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.state).toBe("open");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.latestSource).toBe(
      "official_followthrough",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.openCount).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.resolvedCount).toBe(0);
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("closeout_open");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.driver).toBe("closeout_flow");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.openCloseoutCount).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.forwardFlow.state).toBe("result_attention");
    expect(overview.continuityQueue[0]?.runThread.forwardFlow.attentionCount).toBe(2);
    expect(overview.continuityQueue[0]?.runThread.forwardFlow.attentionSources).toEqual([
      "official_followthrough",
      "limited_auto",
    ]);
    expect(overview.continuityQueue[0]?.runThread.requestPosture.takeoverState).toBe(
      "not_requested",
    );
    expect(overview.continuityQueue[0]?.runThread.requestPosture.humanInputState).toBe(
      "acknowledged",
    );
    expect(overview.continuityQueue[0]?.runThread.requestPosture.activeRequestCount).toBe(0);
    expect(overview.continuityQueue[0]?.runThread.requestPosture.acknowledgedRequestCount).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.requestPosture.latestLifecycleKind).toBe(
      "human_input_request_acknowledged",
    );
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "human_input_request_acknowledged",
    );
    expect(
      overview.continuityQueue[0]?.runThread.lifecycleLog.some((item) => item.kind === "handoff_created"),
    ).toBe(true);
    expect(
      overview.continuityQueue[0]?.runThread.lifecycleLog.some((item) => item.kind === "continuity_remediation"),
    ).toBe(true);
    expect(
      overview.continuityQueue[0]?.runThread.lifecycleLog.some((item) => item.kind === "result_acknowledged"),
    ).toBe(true);
    expect(
      overview.continuityQueue[0]?.runThread.lifecycleLog.some(
        (item) => item.kind === "human_input_requested",
      ),
    ).toBe(true);
    expect(
      overview.continuityQueue[0]?.runThread.lifecycleLog.some(
        (item) => item.kind === "human_input_request_acknowledged",
      ),
    ).toBe(true);
    expect(overview.continuityQueue[0]?.runThread.checkpointLineage[0]?.lineageRole).toBe("latest");
    expect(overview.continuityQueue[0]?.runThread.replayRequest.mode).toBe("latest_checkpoint");
    expect(overview.continuityQueue[0]?.runThread.humanInputCheckpoint.state).toBe(
      "checkpoint_ready",
    );
    expect(overview.continuityQueue[0]?.interruptReasonCode).toBe("verification_blocked");
    expect(overview.continuityQueue[0]?.interruptReasonState).toBe("attention");
    expect(overview.continuityQueue[0]?.resumeAskMode).toBe("resume_checkpoint");
    expect(overview.continuityQueue[0]?.handoffPayloadState).toBe("ready");
    expect(overview.continuityQueue[0]?.handoffTargetAgent).toBe("verification-agent");
    expect(overview.continuityQueue[0]?.debuggerReplayFidelity).toBe("weak");
    expect(overview.continuityQueue[0]?.debuggerWriteContractState).toBe("backfill_required");
    expect(overview.continuityQueue[0]?.debuggerWriteContractDriver).toBe("persisted_lifecycle");
    expect(overview.continuityQueue[0]?.debuggerWriteContractAnchor).toBe("none");
    expect(overview.continuityQueue[0]?.debuggerRecoveryActionContractState).toBe(
      "backfill_required",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryActionContractDriver).toBe(
      "persisted_lifecycle",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryLifecycleContractState).toBe(
      "backfill_required",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryLifecycleContractDriver).toBe(
      "persisted_lifecycle",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryTransitionContractState).toBe(
      "backfill_required",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryTransitionContractDriver).toBe(
      "persisted_lifecycle",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryStateMachinePhase).toBe(
      "materialization",
    );
    expect(overview.continuityQueue[0]?.debuggerRecoveryStateMachineTransitionState).toBe(
      "required",
    );
    expect(overview.continuityQueue[0]?.debuggerTakeoverPosture).toBe("resume_ready");
    expect(overview.continuityQueue[0]?.debuggerHumanInputState).toBe("checkpoint_ready");
    expect(overview.continuityQueue[0]?.debuggerTakeoverRequestState).toBe("requestable");
    expect(overview.continuityQueue[0]?.debuggerHumanInputRequestState).toBe("not_requestable");
    expect(overview.continuityQueue[0]?.operatorProgressSummary.state).toBe(
      "operator_control_attention",
    );
    expect(overview.continuityQueue[0]?.operatorProgressSummary.driver).toBe("operator_control");
    expect(overview.continuityQueue[0]?.operatorActionSummary.state).toBe(
      "resolve_execution_followthrough",
    );
    expect(overview.continuityQueue[0]?.operatorActionSummary.driver).toBe("operator_control");
    expect(overview.operatorWorkSummary.state).toBe("operating_gap_attention");
    expect(overview.operatorWorkSummary.driver).toBe("operating_gap");
    expect(overview.continuityQueue[0]?.operatorProgressSummary.operatorControlState).toBe(
      "execution_follow_through",
    );
    expect(overview.continuityQueue[0]?.operatorProgressSummary.closePostureState).toBe(
      "closeout_open",
    );
    expect(overview.continuityQueue[0]?.riskLevel).toBe("HIGH");
    expect(overview.continuityQueue[0]?.payloadStateSource).toBe("checkpoint_snapshot");
    expect(overview.summary.pruneSessions).toBe(1);
    expect(overview.summary.weakReplaySessions).toBe(1);
    expect(overview.summary.highRiskContinuitySessions).toBe(1);
    expect(overview.summary.checkpointDerivedContinuitySessions).toBe(1);
    expect(overview.summary.reviewRequiredContinuitySessions).toBe(0);
    expect(overview.summary.remediationAttemptedContinuitySessions).toBe(1);
    expect(overview.summary.repeatPatternContinuitySessions).toBe(1);
    expect(overview.summary.lowConfidenceContinuitySessions).toBe(1);
    expect(overview.summary.ineffectiveContinuitySessions).toBe(0);
    expect(overview.continuityQueue[0]?.remediationAttempts).toBe(2);
    expect(overview.continuityQueue[0]?.repeatPatternStatus).toBe("REPEATED_BLOCKED_ACTION");
    expect(overview.continuityQueue[0]?.calibrationConfidence).toBe("LOW");
    expect(overview.continuityQueue[0]?.latestEffectiveness).toBe("NO_SIGNAL");
    expect(overview.continuityQueue[0]?.meetingShape).toBe("RESUMED_MEETING");
    expect(overview.continuityQueue[0]?.guidanceStatus).toBe("SKIPPED_GUIDANCE");
    expect(overview.continuityQueue[0]?.pilotConfidenceBand).toBe("LOW");
    expect(overview.continuityQueue[0]?.pilotRiskBand).toBe("HIGH");
    expect(overview.continuityQueue[0]?.pilotThreshold).toBe(1);
    expect(overview.continuityQueue[0]?.pilotStabilityBand).toBe("UNSTABLE");
    expect(overview.continuityQueue[0]?.pilotStabilityConfidenceBand).toBe("LOW");
    expect(overview.continuityQueue[0]?.pilotConfidenceInterval).toBe("WIDE");
    expect(overview.continuityQueue[0]?.pilotLongTermMaterialImpactBand).toBe("LOW");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("long-term SOP");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("impact aging");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("scale-up recheck");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("subgroup drift");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("cohort aging");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("aging scale-up");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("wording aging");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("wording regression");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("wording consistency");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("impact sampling");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("sampling aging");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("long-term aging");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("sample expansion");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("sample refinement");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("wording audit");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("readout audit");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("readout refinement");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("impact refinement");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("impact audit");
    expect(overview.continuityQueue[0]?.pilotReviewSummary).toContain("impact refinement audit");
    expect(overview.continuityQueue[0]?.sopTitle).toBe("Replay-fidelity recovery SOP");
    expect(overview.continuityQueue[0]?.runbookTitle).toBe("Stop repeat remediation loop");
    expect(overview.continuityQueue[0]?.evidenceSummary).toContain("Repeated remediation behavior is visible");
    expect(overview.continuityPilotReview.totalPilotCases).toBe(1);
    expect(overview.continuityPilotReview.workspaceCohort.sizeBand).toBe("SMALL");
    expect(overview.continuityPilotReview.cohortFamilies[0]?.riskBand).toBe("HIGH");
    expect(overview.continuityPilotReview.topFailureClasses[0]?.failureTaxonomy).toBe("REPLAY_DRIFT");
    expect(overview.continuityPilotReview.meetingShapeCohorts[0]?.meetingShape).toBe("RESUMED_MEETING");
    expect(overview.continuityPilotReview.calibrationProfile.defaultIneffectiveThreshold).toBe(1);
    expect(overview.continuityPilotReview.calibrationProfile.revisedHighlights[0]).toContain("failure_class");
    expect(overview.continuityPilotReview.stabilityReview.summary).toContain("stability");
    expect(overview.continuityPilotReview.stabilityScaleUp.summary).toContain("scale-up");
    expect(overview.continuityPilotReview.stabilityScaleUpRecheck.summary).toContain("Scale-up recheck");
    expect(overview.continuityPilotReview.subgroupStabilityDriftReview.summary).toContain("Subgroup stability drift review");
    expect(overview.continuityPilotReview.subgroupCohortAgingReview.summary).toContain("Long-term cohort aging review");
    expect(overview.continuityPilotReview.subgroupDriftAgingScaleUpReview.summary).toContain("Subgroup drift aging scale-up review");
    expect(overview.continuityPilotReview.subgroupDriftLongTermCohortAgingReview.summary).toContain("Subgroup drift long-term cohort aging review");
    expect(overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionReview.summary).toContain("Subgroup drift long-term sample expansion review");
    expect(overview.continuityPilotReview.subgroupDriftLongTermSampleExpansionRefinementReview.summary).toContain("sample expansion refinement");
    expect(overview.continuityPilotReview.confidenceSimplification.summary).toContain("Confidence");
    expect(overview.continuityPilotReview.intervalWordingDriftAudit.summary).toContain("drift audit");
    expect(overview.continuityPilotReview.wordingDriftTracking.summary).toContain("Wording drift tracking");
    expect(overview.continuityPilotReview.intervalConsistencyGuidance.summary).toContain("Interval consistency guidance");
    expect(overview.continuityPilotReview.intervalWordingAgingAudit.summary).toContain("Interval wording aging audit");
    expect(overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionReview.summary).toContain("Cross-surface interval wording regression review");
    expect(overview.continuityPilotReview.intervalWordingCrossSurfaceConsistencyAudit.summary).toContain("Cross-surface interval wording consistency audit");
    expect(overview.continuityPilotReview.intervalWordingCrossSurfaceRegressionAudit.summary).toContain("Cross-surface interval wording regression audit");
    expect(overview.continuityPilotReview.intervalWordingCrossReadoutRegressionAudit.summary).toContain("Cross-readout interval wording regression audit");
    expect(overview.continuityPilotReview.intervalWordingCrossReadoutRegressionRefinement.summary).toContain("Cross-readout interval wording regression refinement");
    expect(overview.continuityPilotReview.longTermSopImpact.summary).toContain("Long-term SOP impact");
    expect(overview.continuityPilotReview.longTermMaterialImpactReview.summary).toContain("Long-term material impact review");
    expect(overview.continuityPilotReview.longTermMaterialImpactAudit.summary).toContain("material impact audit");
    expect(overview.continuityPilotReview.materialImpactPatternAgingReview.summary).toContain("Material impact pattern aging review");
    expect(overview.continuityPilotReview.materialImpactSamplingReview.summary).toContain("Material impact sampling review");
    expect(overview.continuityPilotReview.materialImpactSamplingAgingReview.summary).toContain("Material impact sampling aging review");
    expect(overview.continuityPilotReview.materialImpactSamplingAgingRefinement.summary).toContain("Material impact sampling aging refinement");
    expect(overview.continuityPilotReview.materialImpactSamplingAgingAudit.summary).toContain("Material impact sampling aging audit");
    expect(overview.continuityPilotReview.materialImpactSamplingAgingRefinementAudit.summary).toContain("Material impact sampling aging refinement audit");
    expect(overview.continuityPilotReview.thresholdRevisions[0]?.scope).toBe("REPLAY_DRIFT");
    expect(overview.continuityPilotReview.thresholdRevisions[0]?.riskBand).toBe("HIGH");
    expect(overview.continuityPilotReview.operatorHandlingEffectiveness.skippedGuidanceRate).toBe(100);
    expect(overview.continuityPilotReview.operatorHandlingEffectiveness.outcomeVarianceSummary).toContain("skipped guidance");
    expect(overview.continuityPilotReview.operatorHandlingEffectiveness.stepReviews[0]?.label).toBe("Replay gap review");
    expect(overview.continuityPilotReview.drift.longHorizonDriftRate).toBe(100);
    expect(overview.continuityPilotReview.sopHighlights[0]).toContain("Replay drift");
    expect(overview.coordinationMetrics.waitingOnSignal).toBe(1);
    expect(overview.boundaryNote).toContain("review-first");

    const overviewWithoutMetrics = buildWorkspaceRuntimeOperatorOverview({
      ...input,
      coordinationMetrics: null,
    });
    const readoutWithoutMetrics = buildWorkspaceBusinessLoopGapReadout({
      workspaceId: input.workspaceId,
      truthConflicts: input.truthConflicts,
      problemSpaces: input.problemSpaces,
      compositionFailures: input.compositionFailures,
      coordinationMetrics: null,
    });

    expect(
      overviewWithoutMetrics.operatingGaps.some(
        (item) => item.kind === "missing-kpi-link",
      ),
    ).toBe(true);
    expect(readoutWithoutMetrics.businessLoopGapSummary.primaryGap?.kind).toBe(
      "missing-kpi-link",
    );
    expect(overviewWithoutMetrics.summary.criticalOperatingGaps).toBeGreaterThan(0);
    expect(overviewWithoutMetrics.businessLoopGapSummary.primaryGap?.kind).toBe(
      "missing-kpi-link",
    );
  });

  it("projects reflection-only review work into the workspace operator work summary", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_review_work",
      sessionCounts: {
        total: 0,
        active: 0,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 1,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 1,
        consolidationQueue: 1,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [
        {
          id: "reflection_review_job_1",
          jobType: "meeting_reflection",
          status: "QUEUED",
          inputSummary: "Reflection queued for workspace review work.",
          outputSummary: null,
          reviewPosture: "Review-first and candidate-only.",
          createdAt: new Date("2026-04-13T14:00:00.000Z"),
          pausedAt: null,
          completedAt: null,
          runtimeSession: {
            meetingId: "meeting_reflection_review_1",
          },
        },
        {
          id: "consolidation_review_job_1",
          jobType: "meeting_review_consolidation",
          status: "PAUSED",
          inputSummary: "Consolidation still needs explicit operator review.",
          outputSummary: null,
          reviewPosture: "Review-first and auditable.",
          createdAt: new Date("2026-04-13T14:05:00.000Z"),
          pausedAt: new Date("2026-04-13T14:06:00.000Z"),
          completedAt: null,
          runtimeSession: {
            meetingId: "meeting_reflection_review_1",
          },
        },
      ],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: {
        metricDate: new Date(),
        actionReadyCount: 0,
        reviewNeededCount: 1,
        waitingOnSignalCount: 0,
        waitingOnAuthorityCount: 0,
        capabilityGapCount: 0,
      },
      cacheTelemetry: [],
      runtimeSessions: [],
    });

    expect(overview.operatorReviewSummary.state).toBe("reflection_job_attention");
    expect(overview.operatorReviewActionSummary.state).toBe("watch_reflection_job");
    expect(overview.operatorActionSummary.state).toBe("watch_reflection_job");
    expect(overview.operatorActionSummary.driver).toBe("review_queue");
    expect(overview.operatorActionSummary.focusTitle).toBe("Reflection queued for workspace review work.");
    expect(overview.operatorActionSummary.focusHref).toBe("/meetings/meeting_reflection_review_1");
    expect(overview.operatorWorkSummary.state).toBe("review_attention");
    expect(overview.operatorWorkSummary.driver).toBe("review_queue");
    expect(overview.operatorWorkSummary.reviewState).toBe("reflection_job_attention");
    expect(overview.operatorWorkSummary.reviewActionState).toBe("watch_reflection_job");
    expect(overview.operatorWorkSummary.counts.reflectionJobs).toBe(1);
    expect(overview.operatorWorkSummary.counts.consolidationJobs).toBe(1);
    expect(overview.operatorWorkSummary.focusHref).toBe("/meetings/meeting_reflection_review_1");
    expect(overview.operatorCueSummary.state).toBe("review_attention");
    expect(overview.operatorCueSummary.driver).toBe("operator_review");
    expect(overview.operatorCueSummary.focusHref).toBe("/meetings/meeting_reflection_review_1");
    expect(overview.operatorNextMoveSummary.state).toBe("watch_reflection_job");
    expect(overview.operatorNextMoveSummary.driver).toBe("operator_review");
    expect(overview.operatorNextMoveSummary.focusHref).toBe("/meetings/meeting_reflection_review_1");
    expect(overview.operatorActionCueSummary.state).toBe("resolve_workspace_review");
    expect(overview.operatorActionCueSummary.driver).toBe("operator_review");
    expect(overview.operatorActionCueSummary.focusHref).toBe("/meetings/meeting_reflection_review_1");
    expect(overview.operatorReviewControlCueSummary.state).toBe("review_priority");
    expect(overview.operatorReviewControlCueSummary.driver).toBe("operator_review");
    expect(overview.operatorReviewControlCueSummary.focusHref).toBe("/meetings/meeting_reflection_review_1");
    expect(overview.operatorStartPointSummary.state).toBe("resolve_workspace_review");
    expect(overview.operatorStartPointSummary.secondaryState).toBe("review_priority");
    expect(overview.operatorStartPointSummary.focusHref).toBe("/meetings/meeting_reflection_review_1");
  });

  it("projects active takeover state into the continuity queue when takeover has formally started", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_takeover",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      runtimeSessions: [
        {
          id: "session_takeover_1",
          workspaceId: "workspace_takeover",
          label: "Takeover activation session",
          sessionKey: "session::takeover-active",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/meetings/meeting_takeover_1",
          boundaryNote: "Review-first runtime only.",
          replayableEventLog: JSON.stringify([{ at: "2026-04-12T02:05:00.000Z", type: "runtime.trace" }]),
          meetingId: "meeting_takeover_1",
          opportunityId: null,
          companyId: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 84,
          prunedTokenCount: 22,
          resumedFromKey: null,
          createdAt: new Date("2026-04-12T02:00:00.000Z"),
          updatedAt: new Date("2026-04-12T02:12:00.000Z"),
          closedAt: null,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_takeover_1",
              checkpointKey: "checkpoint::takeover-active",
              label: "takeover_anchor",
              status: "READY",
              summary: "Checkpoint is available for bounded recovery review.",
              snapshotJson: "{}",
              createdAt: new Date("2026-04-12T02:06:00.000Z"),
              updatedAt: new Date("2026-04-12T02:06:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Budget pressure is visible and still needs a bounded checkpoint decision.",
            decisionSummary: "Keep the remediation path explicit.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Save a bounded checkpoint before the session widens again.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          persistedPayloadHandles: ["payload://meeting_note/takeover/summary"],
          remediationEvents: [],
          requestEvents: [
            {
              id: "takeover_request_event_1",
              eventType: "operator.takeover.requested",
              payload: JSON.stringify({
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_1",
                checkpointKey: "checkpoint::takeover-active",
                resumeToken: "checkpoint::takeover-active",
                summary:
                  "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-active.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_1",
                actorUserId: "user_takeover_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T02:08:00.000Z"),
            },
            {
              id: "takeover_ack_event_1",
              eventType: "operator.takeover.acknowledged",
              payload: JSON.stringify({
                requestEventId: "takeover_request_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_1",
                checkpointKey: "checkpoint::takeover-active",
                resumeToken: "checkpoint::takeover-active",
                summary:
                  "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-active.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_1",
                actorUserId: "user_takeover_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T02:09:00.000Z"),
            },
            {
              id: "takeover_start_event_1",
              eventType: "operator.takeover.started",
              payload: JSON.stringify({
                requestEventId: "takeover_request_event_1",
                acknowledgementEventId: "takeover_ack_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_1",
                checkpointKey: "checkpoint::takeover-active",
                resumeToken: "checkpoint::takeover-active",
                summary:
                  "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-active.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_1",
                actorUserId: "user_takeover_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T02:10:00.000Z"),
            },
          ],
        },
      ],
    });

    expect(overview.continuityQueue[0]?.debuggerTakeoverRequestState).toBe("acknowledged");
    expect(overview.continuityQueue[0]?.debuggerTakeoverActivationState).toBe("active");
    expect(overview.continuityQueue[0]?.debuggerTakeoverRequest.requestEventId).toBe(
      "takeover_request_event_1",
    );
    expect(overview.continuityQueue[0]?.debuggerTakeoverActivation.startEventId).toBe(
      "takeover_start_event_1",
    );
    expect(overview.continuityQueue[0]?.operatorProgressSummary.state).toBe("takeover_active");
    expect(overview.continuityQueue[0]?.operatorProgressSummary.driver).toBe(
      "takeover_activation",
    );
    expect(overview.continuityQueue[0]?.operatorActionSummary.state).toBe("complete_takeover");
    expect(overview.continuityQueue[0]?.operatorActionSummary.driver).toBe(
      "takeover_activation",
    );
    expect(overview.operatorActionSummary.focusTitle).toBe("Takeover activation session");
    expect(overview.operatorActionSummary.focusHref).toBe("/meetings/meeting_takeover_1");
    expect(overview.operatorWorkSummary.state).toBe("operating_gap_attention");
    expect(overview.operatorWorkSummary.driver).toBe("operating_gap");
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe("takeover_active");
    expect(
      overview.continuityQueue[0]?.runThread.lifecycleLog.some((item) => item.kind === "takeover_active"),
    ).toBe(true);
  });

  it("projects released takeover state into the continuity queue when bounded operator control has been closed", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_takeover_release",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      runtimeSessions: [
        {
          id: "session_takeover_release_1",
          workspaceId: "workspace_takeover_release",
          label: "Takeover release session",
          sessionKey: "session::takeover-released",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/meetings/meeting_takeover_release_1",
          boundaryNote: "Review-first runtime only.",
          replayableEventLog: JSON.stringify([{ at: "2026-04-12T03:05:00.000Z", type: "runtime.trace" }]),
          meetingId: "meeting_takeover_release_1",
          opportunityId: null,
          companyId: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 84,
          prunedTokenCount: 22,
          resumedFromKey: null,
          createdAt: new Date("2026-04-12T03:00:00.000Z"),
          updatedAt: new Date("2026-04-12T03:14:00.000Z"),
          closedAt: null,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_takeover_release_1",
              checkpointKey: "checkpoint::takeover-release",
              label: "takeover_anchor",
              status: "READY",
              summary: "Checkpoint remains available for review.",
              snapshotJson: "{}",
              createdAt: new Date("2026-04-12T03:06:00.000Z"),
              updatedAt: new Date("2026-04-12T03:06:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Bounded operator control was closed explicitly.",
            decisionSummary: "Keep remediation explicit.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Checkpoint remains available after takeover release.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          persistedPayloadHandles: ["payload://meeting_note/takeover/release-summary"],
          remediationEvents: [],
          requestEvents: [
            {
              id: "takeover_request_release_event_1",
              eventType: "operator.takeover.requested",
              payload: JSON.stringify({
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_release_1",
                checkpointKey: "checkpoint::takeover-release",
                resumeToken: "checkpoint::takeover-release",
                summary:
                  "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_release_1",
                actorUserId: "user_takeover_release_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T03:08:00.000Z"),
            },
            {
              id: "takeover_ack_release_event_1",
              eventType: "operator.takeover.acknowledged",
              payload: JSON.stringify({
                requestEventId: "takeover_request_release_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_release_1",
                checkpointKey: "checkpoint::takeover-release",
                resumeToken: "checkpoint::takeover-release",
                summary:
                  "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_release_1",
                actorUserId: "user_takeover_release_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T03:09:00.000Z"),
            },
            {
              id: "takeover_start_release_event_1",
              eventType: "operator.takeover.started",
              payload: JSON.stringify({
                requestEventId: "takeover_request_release_event_1",
                acknowledgementEventId: "takeover_ack_release_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_release_1",
                checkpointKey: "checkpoint::takeover-release",
                resumeToken: "checkpoint::takeover-release",
                summary:
                  "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_release_1",
                actorUserId: "user_takeover_release_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T03:10:00.000Z"),
            },
            {
              id: "takeover_release_event_1",
              eventType: "operator.takeover.released",
              payload: JSON.stringify({
                requestEventId: "takeover_request_release_event_1",
                acknowledgementEventId: "takeover_ack_release_event_1",
                startEventId: "takeover_start_release_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_release_1",
                checkpointKey: "checkpoint::takeover-release",
                resumeToken: "checkpoint::takeover-release",
                releaseReason: "Review handoff closed.",
                summary:
                  "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-release. Reason: Review handoff closed.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_release_1",
                actorUserId: "user_takeover_release_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T03:11:00.000Z"),
            },
          ],
        },
      ],
    });

    expect(overview.continuityQueue[0]?.debuggerTakeoverRequestState).toBe("acknowledged");
    expect(overview.continuityQueue[0]?.debuggerTakeoverActivationState).toBe("released");
    expect(overview.continuityQueue[0]?.debuggerTakeoverFollowThroughState).toBe("requestable");
    expect(overview.continuityQueue[0]?.debuggerTakeoverActivation.releaseEventId).toBe(
      "takeover_release_event_1",
    );
    expect(overview.continuityQueue[0]?.debuggerTakeoverOwner).toBeNull();
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.state).toBe("idle");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("active");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.driver).toBe("lifecycle");
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe("takeover_released");
    expect(
      overview.continuityQueue[0]?.runThread.lifecycleLog.some((item) => item.kind === "takeover_released"),
    ).toBe(true);
  });

  it("projects open takeover follow-through into the continuity queue and forward flow", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_takeover_followthrough",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      runtimeSessions: [
        {
          id: "session_takeover_followthrough_1",
          workspaceId: "workspace_takeover_followthrough",
          label: "Takeover follow-through session",
          sessionKey: "session::takeover-followthrough",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/meetings/meeting_takeover_followthrough_1",
          boundaryNote: "Review-first runtime only.",
          replayableEventLog: JSON.stringify([]),
          meetingId: "meeting_takeover_followthrough_1",
          opportunityId: null,
          companyId: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 84,
          prunedTokenCount: 22,
          resumedFromKey: null,
          createdAt: new Date("2026-04-12T04:00:00.000Z"),
          updatedAt: new Date("2026-04-12T04:16:00.000Z"),
          closedAt: null,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_takeover_followthrough_1",
              checkpointKey: "checkpoint::takeover-followthrough",
              label: "takeover_anchor",
              status: "READY",
              summary: "Checkpoint remains available for lifecycle closeout.",
              snapshotJson: "{}",
              createdAt: new Date("2026-04-12T04:06:00.000Z"),
              updatedAt: new Date("2026-04-12T04:06:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Bounded operator control was released and still needs explicit closeout.",
            decisionSummary: "Keep remediation explicit.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Close the takeover follow-through after review handoff closes.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          persistedPayloadHandles: ["payload://meeting_note/takeover/followthrough"],
          remediationEvents: [],
          requestEvents: [
            {
              id: "takeover_request_followthrough_event_1",
              eventType: "operator.takeover.requested",
              payload: JSON.stringify({
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_followthrough_1",
                checkpointKey: "checkpoint::takeover-followthrough",
                resumeToken: "checkpoint::takeover-followthrough",
                summary:
                  "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_followthrough_1",
                actorUserId: "user_takeover_followthrough_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T04:08:00.000Z"),
            },
            {
              id: "takeover_ack_followthrough_event_1",
              eventType: "operator.takeover.acknowledged",
              payload: JSON.stringify({
                requestEventId: "takeover_request_followthrough_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_followthrough_1",
                checkpointKey: "checkpoint::takeover-followthrough",
                resumeToken: "checkpoint::takeover-followthrough",
                summary:
                  "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_followthrough_1",
                actorUserId: "user_takeover_followthrough_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T04:09:00.000Z"),
            },
            {
              id: "takeover_start_followthrough_event_1",
              eventType: "operator.takeover.started",
              payload: JSON.stringify({
                requestEventId: "takeover_request_followthrough_event_1",
                acknowledgementEventId: "takeover_ack_followthrough_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_followthrough_1",
                checkpointKey: "checkpoint::takeover-followthrough",
                resumeToken: "checkpoint::takeover-followthrough",
                summary:
                  "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_followthrough_1",
                actorUserId: "user_takeover_followthrough_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T04:10:00.000Z"),
            },
            {
              id: "takeover_release_followthrough_event_1",
              eventType: "operator.takeover.released",
              payload: JSON.stringify({
                requestEventId: "takeover_request_followthrough_event_1",
                acknowledgementEventId: "takeover_ack_followthrough_event_1",
                startEventId: "takeover_start_followthrough_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_followthrough_1",
                checkpointKey: "checkpoint::takeover-followthrough",
                resumeToken: "checkpoint::takeover-followthrough",
                releaseReason: "Review handoff closed.",
                summary:
                  "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough. Reason: Review handoff closed.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_followthrough_1",
                actorUserId: "user_takeover_followthrough_1",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-12T04:11:00.000Z"),
            },
            {
              id: "takeover_followthrough_request_event_1",
              eventType: "operator.takeover.followthrough.requested",
              payload: JSON.stringify({
                takeoverRequestEventId: "takeover_request_followthrough_event_1",
                acknowledgementEventId: "takeover_ack_followthrough_event_1",
                startEventId: "takeover_start_followthrough_event_1",
                releaseEventId: "takeover_release_followthrough_event_1",
                action: "SAVE_RECOVERY_CHECKPOINT",
                checkpointId: "checkpoint_takeover_followthrough_1",
                checkpointKey: "checkpoint::takeover-followthrough",
                resumeToken: "checkpoint::takeover-followthrough",
                summary:
                  "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::takeover-followthrough.",
                nextAction:
                  "Resolve the takeover follow-through after the checkpoint review is complete.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_takeover_followthrough_1",
                actorUserId: "user_takeover_followthrough_1",
              }),
              triggeredBy: "operator@demo.com",
              createdAt: new Date("2026-04-12T04:12:00.000Z"),
            },
          ],
        },
      ],
    });

    expect(overview.continuityQueue[0]?.debuggerTakeoverActivationState).toBe("released");
    expect(overview.continuityQueue[0]?.debuggerTakeoverFollowThroughState).toBe("open");
    expect(overview.continuityQueue[0]?.debuggerTakeoverFollowThrough.requestEventId).toBe(
      "takeover_followthrough_request_event_1",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.state).toBe("open");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.latestSource).toBe(
      "operator_takeover_followthrough",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.openCount).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.currentOwner).toBe("operator@demo.com");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("closeout_open");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.driver).toBe("closeout_flow");
    expect(overview.continuityQueue[0]?.runThread.forwardFlow.state).toBe("lifecycle_closeout");
    expect(overview.continuityQueue[0]?.runThread.forwardFlow.attentionSources).toContain(
      "operator_takeover_followthrough",
    );
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "takeover_followthrough_requested",
    );
  });

  function buildSettlementReviewOverview(
    requestEvents: Array<{
      id: string;
      eventType: string;
      payload: string;
      trustedContext: string;
      triggeredBy: string;
      createdAt: Date;
    }>,
    options?: {
      updatedAt?: Date;
    },
  ) {
    return buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_settlement_review",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      runtimeSessions: [
        {
          id: "session_settlement_review_1",
          workspaceId: "workspace_settlement_review",
          label: "Settlement review session",
          sessionKey: "session::settlement-review",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/meetings/meeting_settlement_review_1",
          boundaryNote: "Review-first runtime only.",
          replayableEventLog: JSON.stringify([]),
          meetingId: "meeting_settlement_review_1",
          opportunityId: null,
          companyId: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 82,
          prunedTokenCount: 18,
          resumedFromKey: null,
          createdAt: new Date("2026-04-12T05:00:00.000Z"),
          updatedAt: options?.updatedAt ?? new Date("2026-04-12T05:18:00.000Z"),
          closedAt: null,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_settlement_review_1",
              checkpointKey: "checkpoint::settlement-review",
              label: "settlement_anchor",
              status: "READY",
              summary: "Checkpoint remains available for explicit settlement review.",
              snapshotJson: "{}",
              createdAt: new Date("2026-04-12T05:06:00.000Z"),
              updatedAt: new Date("2026-04-12T05:06:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Closeout is resolved and waiting for explicit settlement review.",
            decisionSummary: "Keep closeout review explicit.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Request and resolve settlement review before closing the run thread.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          persistedPayloadHandles: ["payload://meeting_note/settlement/review"],
          remediationEvents: [],
          requestEvents,
        },
      ],
    });
  }

  it("projects explicit settlement review requests into the continuity queue", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "takeover_request_settlement_review_event_1",
        eventType: "operator.takeover.requested",
        payload: JSON.stringify({
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "takeover_ack_settlement_review_event_1",
        eventType: "operator.takeover.acknowledged",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:09:00.000Z"),
      },
      {
        id: "takeover_start_settlement_review_event_1",
        eventType: "operator.takeover.started",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_1",
          acknowledgementEventId: "takeover_ack_settlement_review_event_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "takeover_release_settlement_review_event_1",
        eventType: "operator.takeover.released",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_1",
          acknowledgementEventId: "takeover_ack_settlement_review_event_1",
          startEventId: "takeover_start_settlement_review_event_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          releaseReason: "Review handoff closed.",
          summary:
            "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review. Reason: Review handoff closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:11:00.000Z"),
      },
      {
        id: "takeover_followthrough_request_settlement_review_event_1",
        eventType: "operator.takeover.followthrough.requested",
        payload: JSON.stringify({
          takeoverRequestEventId: "takeover_request_settlement_review_event_1",
          acknowledgementEventId: "takeover_ack_settlement_review_event_1",
          startEventId: "takeover_start_settlement_review_event_1",
          releaseEventId: "takeover_release_settlement_review_event_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
          nextAction: "Resolve the takeover follow-through after the checkpoint review is complete.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "takeover_followthrough_resolved_settlement_review_event_1",
        eventType: "operator.takeover.followthrough.resolved",
        payload: JSON.stringify({
          requestEventId: "takeover_followthrough_request_settlement_review_event_1",
          takeoverRequestEventId: "takeover_request_settlement_review_event_1",
          acknowledgementEventId: "takeover_ack_settlement_review_event_1",
          startEventId: "takeover_start_settlement_review_event_1",
          releaseEventId: "takeover_release_settlement_review_event_1",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover follow-through resolved for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
          nextAction: "Request explicit settlement review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:13:00.000Z"),
      },
      {
        id: "settlement_review_request_event_1",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review requested for checkpoint::settlement-review before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
    ], {
      updatedAt: new Date("2026-04-12T05:12:00.000Z"),
    });

    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.state).toBe("resolved");
    expect(overview.continuityQueue[0]?.runThread.settlementReview.state).toBe("requested");
    expect(overview.continuityQueue[0]?.runThread.settlementReview.checkpointKey).toBe(
      "checkpoint::settlement-review",
    );
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("review_open");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.driver).toBe(
      "settlement_review",
    );
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "settlement_review_requested",
    );
  });

  it("projects resolved settlement review into the continuity queue ready-to-close state", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "takeover_request_settlement_review_event_2",
        eventType: "operator.takeover.requested",
        payload: JSON.stringify({
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "takeover_ack_settlement_review_event_2",
        eventType: "operator.takeover.acknowledged",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_2",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:09:00.000Z"),
      },
      {
        id: "takeover_start_settlement_review_event_2",
        eventType: "operator.takeover.started",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_2",
          acknowledgementEventId: "takeover_ack_settlement_review_event_2",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "takeover_release_settlement_review_event_2",
        eventType: "operator.takeover.released",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_2",
          acknowledgementEventId: "takeover_ack_settlement_review_event_2",
          startEventId: "takeover_start_settlement_review_event_2",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          releaseReason: "Review handoff closed.",
          summary:
            "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review. Reason: Review handoff closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:11:00.000Z"),
      },
      {
        id: "takeover_followthrough_request_settlement_review_event_2",
        eventType: "operator.takeover.followthrough.requested",
        payload: JSON.stringify({
          takeoverRequestEventId: "takeover_request_settlement_review_event_2",
          acknowledgementEventId: "takeover_ack_settlement_review_event_2",
          startEventId: "takeover_start_settlement_review_event_2",
          releaseEventId: "takeover_release_settlement_review_event_2",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
          nextAction: "Resolve the takeover follow-through after the checkpoint review is complete.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "takeover_followthrough_resolved_settlement_review_event_2",
        eventType: "operator.takeover.followthrough.resolved",
        payload: JSON.stringify({
          requestEventId: "takeover_followthrough_request_settlement_review_event_2",
          takeoverRequestEventId: "takeover_request_settlement_review_event_2",
          acknowledgementEventId: "takeover_ack_settlement_review_event_2",
          startEventId: "takeover_start_settlement_review_event_2",
          releaseEventId: "takeover_release_settlement_review_event_2",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Operator takeover follow-through resolved for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review.",
          nextAction: "Request explicit settlement review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:13:00.000Z"),
      },
      {
        id: "settlement_review_request_event_2",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review requested for checkpoint::settlement-review before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_2",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_2",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review resolved for checkpoint::settlement-review after operator review confirmed the settlement summary.",
          nextAction: "Close the run thread after bounded operator review confirms no broader authority is implied.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_1",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:15:00.000Z"),
      },
    ], {
      updatedAt: new Date("2026-04-12T05:12:00.000Z"),
    });

    expect(overview.continuityQueue[0]?.runThread.settlementReview.state).toBe("resolved");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("ready_to_close");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.driver).toBe(
      "settlement_review",
    );
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "settlement_review_resolved",
    );
  });

  it("projects confirmed closeout truth into the continuity queue", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "takeover_request_settlement_review_event_3",
        eventType: "operator.takeover.requested",
        payload: JSON.stringify({
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-confirmed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "takeover_ack_settlement_review_event_3",
        eventType: "operator.takeover.acknowledged",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_3",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-confirmed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:09:00.000Z"),
      },
      {
        id: "takeover_start_settlement_review_event_3",
        eventType: "operator.takeover.started",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_3",
          acknowledgementEventId: "takeover_ack_settlement_review_event_3",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-confirmed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "takeover_release_settlement_review_event_3",
        eventType: "operator.takeover.released",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_3",
          acknowledgementEventId: "takeover_ack_settlement_review_event_3",
          startEventId: "takeover_start_settlement_review_event_3",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          releaseReason: "Review handoff closed.",
          summary:
            "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-confirmed. Reason: Review handoff closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:11:00.000Z"),
      },
      {
        id: "takeover_followthrough_request_settlement_review_event_3",
        eventType: "operator.takeover.followthrough.requested",
        payload: JSON.stringify({
          takeoverRequestEventId: "takeover_request_settlement_review_event_3",
          acknowledgementEventId: "takeover_ack_settlement_review_event_3",
          startEventId: "takeover_start_settlement_review_event_3",
          releaseEventId: "takeover_release_settlement_review_event_3",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-confirmed.",
          nextAction: "Resolve the takeover follow-through after the checkpoint review is complete.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "takeover_followthrough_resolved_settlement_review_event_3",
        eventType: "operator.takeover.followthrough.resolved",
        payload: JSON.stringify({
          requestEventId: "takeover_followthrough_request_settlement_review_event_3",
          takeoverRequestEventId: "takeover_request_settlement_review_event_3",
          acknowledgementEventId: "takeover_ack_settlement_review_event_3",
          startEventId: "takeover_start_settlement_review_event_3",
          releaseEventId: "takeover_release_settlement_review_event_3",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Operator takeover follow-through resolved for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-confirmed.",
          nextAction: "Request explicit settlement review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:13:00.000Z"),
      },
      {
        id: "settlement_review_request_event_3",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Settlement review requested for checkpoint::settlement-review-confirmed before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_3",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_3",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Settlement review resolved for checkpoint::settlement-review-confirmed after operator review confirmed the settlement summary.",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:15:00.000Z"),
      },
      {
        id: "closeout_confirmed_event_3",
        eventType: "run-thread.closeout.confirmed",
        payload: JSON.stringify({
          settlementReviewResolutionEventId: "settlement_review_resolved_event_3",
          checkpointId: "checkpoint_settlement_review_3",
          checkpointKey: "checkpoint::settlement-review-confirmed",
          resumeToken: "checkpoint::settlement-review-confirmed",
          summary:
            "Thread-level closeout truth confirmed for checkpoint::settlement-review-confirmed.",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_3",
          actorUserId: "user_settlement_review_3",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:16:00.000Z"),
      },
    ]);

    expect(overview.continuityQueue[0]?.runThread.closeoutConfirmation.state).toBe("confirmed");
    expect(overview.continuityQueue[0]?.runThread.closeoutSummary.state).toBe("confirmed");
    expect(overview.continuityQueue[0]?.runThread.closeoutSummary.driver).toBe(
      "closeout_confirmation",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutConfirmation.confirmationEventId).toBe(
      "closeout_confirmed_event_3",
    );
    expect(
      overview.continuityQueue[0]?.runThread.closeoutConfirmation.settlementReviewResolutionEventId,
    ).toBe("settlement_review_resolved_event_3");
    expect(overview.continuityQueue[0]?.runThread.closeoutConfirmation.confirmedBy).toBe(
      "operator@demo.com",
    );
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe("closeout_confirmed");
  });

  it("projects closeout refresh reopen follow-through into the continuity queue", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "takeover_request_settlement_review_event_4",
        eventType: "operator.takeover.requested",
        payload: JSON.stringify({
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Operator takeover request already recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-refresh.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "takeover_ack_settlement_review_event_4",
        eventType: "operator.takeover.acknowledged",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_4",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Operator takeover acknowledgement recorded for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-refresh.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:09:00.000Z"),
      },
      {
        id: "takeover_start_settlement_review_event_4",
        eventType: "operator.takeover.started",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_4",
          acknowledgementEventId: "takeover_ack_settlement_review_event_4",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Operator takeover started for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-refresh.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "takeover_release_settlement_review_event_4",
        eventType: "operator.takeover.released",
        payload: JSON.stringify({
          requestEventId: "takeover_request_settlement_review_event_4",
          acknowledgementEventId: "takeover_ack_settlement_review_event_4",
          startEventId: "takeover_start_settlement_review_event_4",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          releaseReason: "Review handoff closed.",
          summary:
            "Operator takeover released for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-refresh. Reason: Review handoff closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "founder@demo.com",
        createdAt: new Date("2026-04-12T05:11:00.000Z"),
      },
      {
        id: "takeover_followthrough_request_settlement_review_event_4",
        eventType: "operator.takeover.followthrough.requested",
        payload: JSON.stringify({
          takeoverRequestEventId: "takeover_request_settlement_review_event_4",
          acknowledgementEventId: "takeover_ack_settlement_review_event_4",
          startEventId: "takeover_start_settlement_review_event_4",
          releaseEventId: "takeover_release_settlement_review_event_4",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Operator takeover follow-through requested for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-refresh.",
          nextAction: "Resolve the takeover follow-through after the checkpoint review is complete.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "takeover_followthrough_resolved_settlement_review_event_4",
        eventType: "operator.takeover.followthrough.resolved",
        payload: JSON.stringify({
          requestEventId: "takeover_followthrough_request_settlement_review_event_4",
          takeoverRequestEventId: "takeover_request_settlement_review_event_4",
          acknowledgementEventId: "takeover_ack_settlement_review_event_4",
          startEventId: "takeover_start_settlement_review_event_4",
          releaseEventId: "takeover_release_settlement_review_event_4",
          action: "SAVE_RECOVERY_CHECKPOINT",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Operator takeover follow-through resolved for SAVE_RECOVERY_CHECKPOINT on checkpoint::settlement-review-refresh.",
          nextAction: "Request explicit settlement review.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:13:00.000Z"),
      },
      {
        id: "settlement_review_request_event_4",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Settlement review requested for checkpoint::settlement-review-refresh before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_4",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_4",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Settlement review resolved for checkpoint::settlement-review-refresh after operator review confirmed the settlement summary.",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:15:00.000Z"),
      },
      {
        id: "closeout_confirmed_event_4",
        eventType: "run-thread.closeout.confirmed",
        payload: JSON.stringify({
          settlementReviewResolutionEventId: "settlement_review_resolved_event_4",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Thread-level closeout truth confirmed for checkpoint::settlement-review-refresh.",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:16:00.000Z"),
      },
      {
        id: "closeout_refresh_request_event_4",
        eventType: "run-thread.closeout.refresh.requested",
        payload: JSON.stringify({
          confirmationEventId: "closeout_confirmed_event_4",
          checkpointId: "checkpoint_settlement_review_4",
          checkpointKey: "checkpoint::settlement-review-refresh",
          resumeToken: "checkpoint::settlement-review-refresh",
          summary:
            "Closeout refresh requested for checkpoint::settlement-review-refresh after stale closeout truth was detected.",
          nextAction:
            "Refresh the stale closeout summary and reconfirm thread-level closeout truth only after bounded operator review is current again.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_4",
          actorUserId: "user_settlement_review_4",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:17:00.000Z"),
      },
    ]);

    expect(overview.continuityQueue[0]?.runThread.closeoutConfirmation.state).toBe("stale");
    expect(overview.continuityQueue[0]?.runThread.closeoutRefresh.state).toBe("open");
    expect(overview.continuityQueue[0]?.runThread.closeoutSummary.state).toBe("refresh_open");
    expect(overview.continuityQueue[0]?.runThread.closeoutSummary.driver).toBe("closeout_refresh");
    expect(overview.continuityQueue[0]?.runThread.closeoutRefresh.requestEventId).toBe(
      "closeout_refresh_request_event_4",
    );
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "closeout_refresh_requested",
    );
  });

  it("projects explicit closeout resolution into the continuity queue without auto-closing the thread", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "settlement_review_request_event_5",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review requested for checkpoint::settlement-review before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_5",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_5",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_5",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review resolved for checkpoint::settlement-review after operator review confirmed the settlement summary.",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_5",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "closeout_confirmation_event_5",
        eventType: "run-thread.closeout.confirmed",
        payload: JSON.stringify({
          settlementReviewResolutionEventId: "settlement_review_resolved_event_5",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Thread-level closeout truth confirmed for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_5",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "closeout_resolution_event_5",
        eventType: "run-thread.closeout.resolution.recorded",
        payload: JSON.stringify({
          decision: "keep_open",
          closeoutConfirmationEventId: "closeout_confirmation_event_5",
          closeoutRefreshEventId: null,
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Explicit keep-open resolution recorded for checkpoint::settlement-review.",
          nextAction: "Keep the thread open until newer closeout truth justifies a different explicit decision.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_5",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
    ], {
      updatedAt: new Date("2026-04-12T05:12:00.000Z"),
    });

    expect(overview.continuityQueue[0]?.runThread.closeoutSummary.state).toBe("confirmed");
    expect(overview.continuityQueue[0]?.runThread.closeoutResolution.state).toBe(
      "keep_open_recorded",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutResolution.decision).toBe("keep_open");
    expect(overview.continuityQueue[0]?.runThread.closeoutResolution.resolutionEventId).toBe(
      "closeout_resolution_event_5",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutOutcome.state).toBe(
      "followthrough_required",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutOutcome.decision).toBe("keep_open");
    expect(overview.continuityQueue[0]?.runThread.closeoutResolution.nextAction).toContain(
      "Keep the thread open",
    );
    expect(overview.continuityQueue[0]?.runThread.lifecycle).toBe("checkpoint_ready");
    expect(overview.continuityQueue[0]?.runThread.closedAt).toBeNull();
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "closeout_resolution_recorded",
    );
  });

  it("projects open closeout resolution follow-through into the continuity queue", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "settlement_review_request_event_6",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review requested for checkpoint::settlement-review before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_6",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_6",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_6",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review resolved for checkpoint::settlement-review after operator review confirmed the settlement summary.",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_6",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "closeout_confirmation_event_6",
        eventType: "run-thread.closeout.confirmed",
        payload: JSON.stringify({
          settlementReviewResolutionEventId: "settlement_review_resolved_event_6",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Thread-level closeout truth confirmed for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_6",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "closeout_resolution_event_6",
        eventType: "run-thread.closeout.resolution.recorded",
        payload: JSON.stringify({
          decision: "close_thread",
          closeoutConfirmationEventId: "closeout_confirmation_event_6",
          closeoutRefreshEventId: null,
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Explicit close-thread resolution recorded for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_6",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
      {
        id: "closeout_resolution_followthrough_request_event_6",
        eventType: "run-thread.closeout.resolution.followthrough.requested",
        payload: JSON.stringify({
          decision: "close_thread",
          closeoutResolutionEventId: "closeout_resolution_event_6",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Close-thread follow-through requested for checkpoint::settlement-review.",
          nextAction:
            "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_6",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:15:00.000Z"),
      },
    ]);

    expect(overview.continuityQueue[0]?.runThread.closeoutResolution.state).toBe("close_recorded");
    expect(overview.continuityQueue[0]?.runThread.closeoutResolutionFollowThrough.state).toBe(
      "open",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutOutcome.state).toBe(
      "followthrough_open",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutOutcome.decision).toBe("close_thread");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.state).toBe("open");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.latestSource).toBe(
      "closeout_resolution_followthrough",
    );
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("closeout_open");
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "closeout_resolution_followthrough_requested",
    );
  });

  it("projects resolved closeout resolution follow-through back into ready-to-close state", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "settlement_review_request_event_7",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review requested for checkpoint::settlement-review before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_7",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_7",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_7",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review resolved for checkpoint::settlement-review after operator review confirmed the settlement summary.",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_7",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "closeout_confirmation_event_7",
        eventType: "run-thread.closeout.confirmed",
        payload: JSON.stringify({
          settlementReviewResolutionEventId: "settlement_review_resolved_event_7",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Thread-level closeout truth confirmed for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_7",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "closeout_resolution_event_7",
        eventType: "run-thread.closeout.resolution.recorded",
        payload: JSON.stringify({
          decision: "keep_open",
          closeoutConfirmationEventId: "closeout_confirmation_event_7",
          closeoutRefreshEventId: null,
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Explicit keep-open resolution recorded for checkpoint::settlement-review.",
          nextAction: "Keep the thread open until newer closeout truth justifies a different explicit decision.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_7",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
      {
        id: "closeout_resolution_followthrough_request_event_7",
        eventType: "run-thread.closeout.resolution.followthrough.requested",
        payload: JSON.stringify({
          decision: "keep_open",
          closeoutResolutionEventId: "closeout_resolution_event_7",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Keep-open follow-through requested for checkpoint::settlement-review.",
          nextAction:
            "Resolve the explicit keep-open follow-through before the thread is treated as current keep-open truth.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_7",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:15:00.000Z"),
      },
      {
        id: "closeout_resolution_followthrough_resolved_event_7",
        eventType: "run-thread.closeout.resolution.followthrough.resolved",
        payload: JSON.stringify({
          requestEventId: "closeout_resolution_followthrough_request_event_7",
          decision: "keep_open",
          closeoutResolutionEventId: "closeout_resolution_event_7",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Keep-open follow-through resolved for checkpoint::settlement-review.",
          nextAction: "No further keep-open follow-through remains open on this resolution.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_7",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:16:00.000Z"),
      },
    ]);

    expect(overview.continuityQueue[0]?.runThread.closeoutResolutionFollowThrough.state).toBe(
      "resolved",
    );
    expect(overview.continuityQueue[0]?.runThread.closeoutOutcome.state).toBe("kept_open");
    expect(overview.continuityQueue[0]?.runThread.closeoutOutcome.decision).toBe("keep_open");
    expect(overview.continuityQueue[0]?.runThread.closeRequest.state).toBe("not_available");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.state).toBe("resolved");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.resolvedCount).toBe(1);
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("ready_to_close");
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe(
      "closeout_resolution_followthrough_resolved",
    );
  });

  it("projects typed close request posture after close-thread follow-through resolves", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "settlement_review_request_event_8",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review requested for checkpoint::settlement-review before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_8",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_8",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_8",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review resolved for checkpoint::settlement-review after operator review confirmed the settlement summary.",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_8",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "closeout_confirmation_event_8",
        eventType: "run-thread.closeout.confirmed",
        payload: JSON.stringify({
          settlementReviewResolutionEventId: "settlement_review_resolved_event_8",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Thread-level closeout truth confirmed for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_8",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "closeout_resolution_event_8",
        eventType: "run-thread.closeout.resolution.recorded",
        payload: JSON.stringify({
          decision: "close_thread",
          closeoutConfirmationEventId: "closeout_confirmation_event_8",
          closeoutRefreshEventId: null,
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Explicit close-thread resolution recorded for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_8",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
      {
        id: "closeout_resolution_followthrough_request_event_8",
        eventType: "run-thread.closeout.resolution.followthrough.requested",
        payload: JSON.stringify({
          decision: "close_thread",
          closeoutResolutionEventId: "closeout_resolution_event_8",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Close-thread follow-through requested for checkpoint::settlement-review.",
          nextAction:
            "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_8",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:15:00.000Z"),
      },
      {
        id: "closeout_resolution_followthrough_resolved_event_8",
        eventType: "run-thread.closeout.resolution.followthrough.resolved",
        payload: JSON.stringify({
          requestEventId: "closeout_resolution_followthrough_request_event_8",
          decision: "close_thread",
          closeoutResolutionEventId: "closeout_resolution_event_8",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Close-thread follow-through resolved for checkpoint::settlement-review.",
          nextAction: "No further close-thread follow-through remains open on this resolution.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_8",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:16:00.000Z"),
      },
    ]);

    expect(overview.continuityQueue[0]?.runThread.closeoutOutcome.state).toBe("close_pending");
    expect(overview.continuityQueue[0]?.runThread.closeRequest.state).toBe("requestable");
    expect(overview.continuityQueue[0]?.runThread.closeLifecycle.state).toBe("close_requestable");
    expect(overview.continuityQueue[0]?.runThread.closeLifecycle.driver).toBe("close_request");
    expect(overview.continuityQueue[0]?.runThread.closeControl.state).toBe("close_requestable");
    expect(overview.continuityQueue[0]?.runThread.closeControl.driver).toBe("close_lifecycle");
    expect(overview.continuityQueue[0]?.runThread.closeControlFlow.state).toBe("close_requestable");
    expect(overview.continuityQueue[0]?.runThread.closeControlFlow.driver).toBe("close_control");
    expect(overview.continuityQueue[0]?.runThread.closeDecisionFlow.state).toBe("close_requestable");
    expect(overview.continuityQueue[0]?.runThread.closeDecisionFlow.driver).toBe("close_request");
    expect(overview.continuityQueue[0]?.runThread.closeDecisionControlSummary.state).toBe(
      "close_requestable",
    );
    expect(overview.continuityQueue[0]?.runThread.closeDecisionControlSummary.driver).toBe(
      "close_decision_flow",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionSummary.state).toBe(
      "ready_to_request_close",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionSummary.driver).toBe(
      "close_request",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionForwardSummary.state).toBe(
      "ready_to_request_close",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionForwardSummary.driver).toBe(
      "close_resolution_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionControlSummary.state).toBe(
      "ready_to_request_close",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionControlSummary.driver).toBe(
      "close_resolution_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closePostureSummary.state).toBe("close_ready");
    expect(overview.continuityQueue[0]?.runThread.closePostureSummary.driver).toBe(
      "close_resolution_control_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closePostureForwardSummary.state).toBe(
      "close_ready",
    );
    expect(overview.continuityQueue[0]?.runThread.closePostureForwardSummary.driver).toBe(
      "close_posture_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closeRequest.requestEventId).toBeNull();
  });

  it("projects open close request into the continuity queue until lifecycle close lands", () => {
    const overview = buildSettlementReviewOverview([
      {
        id: "settlement_review_request_event_9",
        eventType: "run-thread.settlement.review.requested",
        payload: JSON.stringify({
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review requested for checkpoint::settlement-review before the thread is treated as ready to close.",
          nextAction: "Resolve the explicit settlement review after the operator confirms the settlement summary.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_9",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:08:00.000Z"),
      },
      {
        id: "settlement_review_resolved_event_9",
        eventType: "run-thread.settlement.review.resolved",
        payload: JSON.stringify({
          requestEventId: "settlement_review_request_event_9",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary:
            "Settlement review resolved for checkpoint::settlement-review after operator review confirmed the settlement summary.",
          nextAction: "Confirm the thread-level closeout truth before the runtime session is closed.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_9",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:10:00.000Z"),
      },
      {
        id: "closeout_confirmation_event_9",
        eventType: "run-thread.closeout.confirmed",
        payload: JSON.stringify({
          settlementReviewResolutionEventId: "settlement_review_resolved_event_9",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Thread-level closeout truth confirmed for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_9",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:12:00.000Z"),
      },
      {
        id: "closeout_resolution_event_9",
        eventType: "run-thread.closeout.resolution.recorded",
        payload: JSON.stringify({
          decision: "close_thread",
          closeoutConfirmationEventId: "closeout_confirmation_event_9",
          closeoutRefreshEventId: null,
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Explicit close-thread resolution recorded for checkpoint::settlement-review.",
          nextAction:
            "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_9",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:14:00.000Z"),
      },
      {
        id: "closeout_resolution_followthrough_request_event_9",
        eventType: "run-thread.closeout.resolution.followthrough.requested",
        payload: JSON.stringify({
          decision: "close_thread",
          closeoutResolutionEventId: "closeout_resolution_event_9",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Close-thread follow-through requested for checkpoint::settlement-review.",
          nextAction:
            "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_9",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:15:00.000Z"),
      },
      {
        id: "closeout_resolution_followthrough_resolved_event_9",
        eventType: "run-thread.closeout.resolution.followthrough.resolved",
        payload: JSON.stringify({
          requestEventId: "closeout_resolution_followthrough_request_event_9",
          decision: "close_thread",
          closeoutResolutionEventId: "closeout_resolution_event_9",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Close-thread follow-through resolved for checkpoint::settlement-review.",
          nextAction: "No further close-thread follow-through remains open on this resolution.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_9",
        }),
        triggeredBy: "reviewer@demo.com",
        createdAt: new Date("2026-04-12T05:16:00.000Z"),
      },
      {
        id: "close_request_event_9",
        eventType: "run-thread.close.requested",
        payload: JSON.stringify({
          closeoutResolutionEventId: "closeout_resolution_event_9",
          closeoutResolutionFollowThroughEventId: "closeout_resolution_followthrough_resolved_event_9",
          checkpointId: "checkpoint_settlement_review_1",
          checkpointKey: "checkpoint::settlement-review",
          resumeToken: "checkpoint::settlement-review",
          summary: "Explicit runtime close requested for checkpoint::settlement-review.",
          nextAction: "Close the runtime session only through a separate bounded close path.",
        }),
        trustedContext: JSON.stringify({
          sourcePage: "/meetings/meeting_settlement_review_1",
          actorUserId: "user_settlement_review_9",
        }),
        triggeredBy: "operator@demo.com",
        createdAt: new Date("2026-04-12T05:17:00.000Z"),
      },
    ]);

    expect(overview.continuityQueue[0]?.runThread.closeRequest.state).toBe("open");
    expect(overview.continuityQueue[0]?.runThread.closeLifecycle.state).toBe("close_requested");
    expect(overview.continuityQueue[0]?.runThread.closeLifecycle.driver).toBe("close_request");
    expect(overview.continuityQueue[0]?.runThread.closeControl.state).toBe("close_requested");
    expect(overview.continuityQueue[0]?.runThread.closeControl.driver).toBe("close_lifecycle");
    expect(overview.continuityQueue[0]?.runThread.closeControlFlow.state).toBe("close_requested");
    expect(overview.continuityQueue[0]?.runThread.closeControlFlow.driver).toBe("close_control");
    expect(overview.continuityQueue[0]?.runThread.closeDecisionFlow.state).toBe("close_requested");
    expect(overview.continuityQueue[0]?.runThread.closeDecisionFlow.driver).toBe("close_request");
    expect(overview.continuityQueue[0]?.runThread.closeDecisionControlSummary.state).toBe(
      "close_requested",
    );
    expect(overview.continuityQueue[0]?.runThread.closeDecisionControlSummary.driver).toBe(
      "close_decision_flow",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionSummary.state).toBe(
      "close_requested",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionSummary.driver).toBe(
      "close_request",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionForwardSummary.state).toBe(
      "close_requested",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionForwardSummary.driver).toBe(
      "close_resolution_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionControlSummary.state).toBe(
      "close_requested",
    );
    expect(overview.continuityQueue[0]?.runThread.closeResolutionControlSummary.driver).toBe(
      "close_resolution_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closePostureSummary.state).toBe(
      "close_pending",
    );
    expect(overview.continuityQueue[0]?.runThread.closePostureSummary.driver).toBe(
      "close_resolution_control_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closePostureForwardSummary.state).toBe(
      "close_pending",
    );
    expect(overview.continuityQueue[0]?.runThread.closePostureForwardSummary.driver).toBe(
      "close_posture_summary",
    );
    expect(overview.continuityQueue[0]?.runThread.closeRequest.requestEventId).toBe("close_request_event_9");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.latestSource).toBe("close_request");
    expect(overview.continuityQueue[0]?.runThread.closeoutFlow.state).toBe("open");
    expect(overview.continuityQueue[0]?.runThread.settlementFlow.state).toBe("closeout_open");
    expect(overview.continuityQueue[0]?.runThread.lifecycleLog[0]?.kind).toBe("close_request_requested");
  });

  it("projects swarm spawn admission into the continuity queue", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_swarm",
      swarmReadOnlyWorkersEnabled: true,
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      benchmarkMatrixRuns: [],
      benchmarkExecutionRequests: [],
      benchmarkExecutionAcknowledgements: [],
      benchmarkExecutionFollowThrough: [],
      runtimeSessions: [
        {
          id: "session_swarm_queue",
          workspaceId: "workspace_swarm",
          label: "Swarm queue session",
          sessionKey: "session::swarm-queue",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/operating",
          boundaryNote: "Review-first runtime only.",
          replayableEventLog: "[]",
          meetingId: "meeting_swarm_queue",
          opportunityId: null,
          companyId: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 58,
          prunedTokenCount: 0,
          resumedFromKey: null,
          controlPlaneLifecycleJson: null,
          controlPlaneLifecycleUpdatedAt: null,
          createdAt: new Date("2026-04-16T10:00:00.000Z"),
          updatedAt: new Date("2026-04-16T10:10:00.000Z"),
          closedAt: null,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [],
          notebook: {
            sessionSummary: "Swarm admission is still bounded and review-first.",
            decisionSummary: "Keep swarm default-off unless the workspace explicitly opts in.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Observe the first admission slice before enabling fan-out.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          persistedPayloadHandles: [],
          remediationEvents: [],
          requestEvents: [],
        },
      ],
    });

    expect(overview.continuityQueue[0]?.runThread.swarmSpawnContract.state).toBe("requestable");
    expect(overview.continuityQueue[0]?.runThread.swarmSpawnContract.requestRecordState).toBe("not_requested");
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.state).toBe("ready");
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.requestLifecycleState).toBe(
      "requestable",
    );
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.handoffPreviewState).toBe(
      "preview_ready",
    );
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.lanePreviews).toHaveLength(3);
    expect(overview.continuityQueue[0]?.debuggerSwarmSpawnContractState).toBe("requestable");
    expect(overview.continuityQueue[0]?.debuggerSwarmSpawnContractDriver).toBe("admission_ready");
    expect(overview.continuityQueue[0]?.debuggerSwarmSpawnContractDenyReason).toBeNull();
    expect(overview.continuityQueue[0]?.debuggerSwarmSpawnContractSummary).toContain(
      "Read-only swarm worker spawn is requestable",
    );
  });

  it("projects recorded swarm spawn requests into the continuity queue", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_swarm",
      swarmReadOnlyWorkersEnabled: true,
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      benchmarkMatrixRuns: [],
      benchmarkExecutionRequests: [],
      benchmarkExecutionAcknowledgements: [],
      benchmarkExecutionFollowThrough: [],
      runtimeSessions: [
        {
          id: "session_swarm_queue_requested",
          workspaceId: "workspace_swarm",
          label: "Swarm queue requested session",
          sessionKey: "session::swarm-queue-requested",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/operating",
          boundaryNote: "Review-first runtime only.",
          replayableEventLog: "[]",
          meetingId: "meeting_swarm_queue",
          opportunityId: null,
          companyId: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 58,
          prunedTokenCount: 0,
          resumedFromKey: null,
          controlPlaneLifecycleJson: null,
          controlPlaneLifecycleUpdatedAt: null,
          createdAt: new Date("2026-04-16T10:00:00.000Z"),
          updatedAt: new Date("2026-04-16T10:10:00.000Z"),
          closedAt: null,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_swarm_queue_requested",
              checkpointKey: "checkpoint::swarm-queue-requested",
              label: "swarm_request_anchor",
              status: "READY",
              summary: "Checkpoint anchor for swarm queue request.",
              snapshotJson: JSON.stringify({ reviewState: "ready" }),
              createdAt: new Date("2026-04-16T10:01:00.000Z"),
              updatedAt: new Date("2026-04-16T10:01:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Swarm request stays review-first.",
            decisionSummary: "Keep execution default-off after the request is recorded.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Observe the first request record before enabling fan-out.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          persistedPayloadHandles: [],
          remediationEvents: [],
          requestEvents: [
            {
              id: "swarm_request_1",
              eventType: "swarm.spawn.requested",
              payload: JSON.stringify({
                taskClass: "read_only_worker",
                checkpointId: "checkpoint_swarm_queue_requested",
                checkpointKey: "checkpoint::swarm-queue-requested",
                summary:
                  "Read-only swarm worker spawn request recorded for checkpoint::swarm-queue-requested.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm_queue",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T10:02:00.000Z"),
            },
          ],
        },
      ],
    });

    expect(overview.continuityQueue[0]?.runThread.swarmSpawnContract.state).toBe("requestable");
    expect(overview.continuityQueue[0]?.runThread.swarmSpawnContract.requestRecordState).toBe(
      "requested",
    );
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.state).toBe(
      "requested",
    );
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.requestLifecycleState).toBe(
      "request_recorded",
    );
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.packetConsumptionIntentState,
    ).toBe("selection_required");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.artifactBundlePlaceholderState,
    ).toBe("selection_required");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.handoffConsumptionState,
    ).toBe("selection_required");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState,
    ).toBe("not_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.handoffConsumptionRecordState,
    ).toBe("not_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionPreflightState,
    ).toBe("selection_required");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionGuardContract
        .state,
    ).toBe("blocked");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionLifecycleContract
        .state,
    ).toBe("selection_required");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionCandidateContract
        .state,
    ).toBe("not_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionGuardContract
        .missingRequirements,
    ).toEqual(["allowlisted lane selection is missing"]);
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.requestEventId).toBe(
      "swarm_request_1",
    );
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.requestedBy).toBe(
      "founder@demo.com",
    );
    expect(overview.continuityQueue[0]?.runThread.swarmSpawnContract.requestEventId).toBe(
      "swarm_request_1",
    );
    expect(overview.continuityQueue[0]?.debuggerSwarmSpawnContractDriver).toBe("request_recorded");
    expect(overview.continuityQueue[0]?.debuggerSwarmSpawnContractSummary).toContain(
      "request already recorded",
    );
  });

  it("projects recorded read-only worker intent into the continuity queue", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_swarm",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      swarmReadOnlyWorkersEnabled: true,
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      benchmarkMatrixRuns: [],
      benchmarkExecutionRequests: [],
      benchmarkExecutionAcknowledgements: [],
      benchmarkExecutionFollowThrough: [],
      runtimeSessions: [
        {
          id: "session_swarm_intent",
          workspaceId: "workspace_swarm",
          label: "Swarm intent continuity session",
          sessionKey: "session::swarm-intent",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/operating",
          boundaryNote: "Review-first runtime only.",
          meetingId: "meeting_swarm",
          opportunityId: null,
          companyId: "company_swarm",
          createdAt: new Date("2026-04-16T09:00:00.000Z"),
          updatedAt: new Date("2026-04-16T09:13:00.000Z"),
          closedAt: null,
          resumedFromKey: null,
          replayableEventLog: "[]",
          controlPlaneLifecycleJson: null,
          controlPlaneLifecycleUpdatedAt: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 52,
          prunedTokenCount: 0,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_swarm_intent",
              checkpointKey: "checkpoint::swarm-intent",
              label: "swarm_intent_anchor",
              status: "READY",
              summary: "Checkpoint anchor for swarm intent.",
              snapshotJson: JSON.stringify({ reviewState: "ready" }),
              createdAt: new Date("2026-04-16T09:01:00.000Z"),
              updatedAt: new Date("2026-04-16T09:01:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Swarm intent stays review-first.",
            decisionSummary: "Keep packet consumption intent explicit before any fan-out.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Select one lane before later fan-out becomes executable.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          remediationEvents: [],
          requestEvents: [
            {
              id: "swarm_request_1",
              eventType: "swarm.spawn.requested",
              payload: JSON.stringify({
                taskClass: "read_only_worker",
                checkpointId: "checkpoint_swarm_intent",
                checkpointKey: "checkpoint::swarm-intent",
                summary:
                  "Read-only swarm worker spawn request recorded for checkpoint::swarm-intent.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:02:00.000Z"),
            },
            {
              id: "swarm_intent_1",
              eventType: "swarm.read-only-worker.intent.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-intent",
                checkpointId: "checkpoint_swarm_intent",
                checkpointKey: "checkpoint::swarm-intent",
                artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
                summary: "Read-only worker intent recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:03:00.000Z"),
            },
          ],
          persistedPayloadHandles: [],
        },
      ],
    });

    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.packetConsumptionIntentState,
    ).toBe("intent_recorded");
    expect(overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.intentEventId).toBe(
      "swarm_intent_1",
    );
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.selectedWorkerKind,
    ).toBe("grep");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.selectedPacketKey,
    ).toBe("swarm::grep::checkpoint::swarm-intent");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.artifactBundlePlaceholderState,
    ).toBe("placeholder_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.placeholderBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm-intent");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.handoffConsumptionState,
    ).toBe("consumable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.handoffConsumerAgent,
    ).toBe("lead-orchestrator");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.handoffConsumptionRecordState,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionPreflightState,
    ).toBe("placeholder_record_required");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionGuardContract
        .state,
    ).toBe("blocked");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionLifecycleContract
        .state,
    ).toBe("placeholder_record_required");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionGuardContract
        .missingRequirements,
    ).toEqual(["placeholder bundle record is missing"]);
  });

  it("projects recorded placeholder materialization into the continuity queue", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_swarm",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      swarmReadOnlyWorkersEnabled: true,
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      benchmarkMatrixRuns: [],
      benchmarkExecutionRequests: [],
      benchmarkExecutionAcknowledgements: [],
      benchmarkExecutionFollowThrough: [],
      runtimeSessions: [
        {
          id: "session_swarm_placeholder",
          workspaceId: "workspace_swarm",
          label: "Swarm placeholder continuity session",
          sessionKey: "session::swarm-placeholder",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/operating",
          boundaryNote: "Review-first runtime only.",
          meetingId: "meeting_swarm",
          opportunityId: null,
          companyId: "company_swarm",
          createdAt: new Date("2026-04-16T09:00:00.000Z"),
          updatedAt: new Date("2026-04-16T09:14:00.000Z"),
          closedAt: null,
          resumedFromKey: null,
          replayableEventLog: "[]",
          controlPlaneLifecycleJson: null,
          controlPlaneLifecycleUpdatedAt: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 52,
          prunedTokenCount: 0,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_swarm_placeholder",
              checkpointKey: "checkpoint::swarm-placeholder",
              label: "swarm_placeholder_anchor",
              status: "READY",
              summary: "Checkpoint anchor for swarm placeholder.",
              snapshotJson: JSON.stringify({ reviewState: "ready" }),
              createdAt: new Date("2026-04-16T09:01:00.000Z"),
              updatedAt: new Date("2026-04-16T09:01:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Swarm placeholder stays review-first.",
            decisionSummary: "Keep placeholder materialization explicit before execution.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Record placeholder before any later fan-out becomes executable.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          remediationEvents: [],
          requestEvents: [
            {
              id: "swarm_request_1",
              eventType: "swarm.spawn.requested",
              payload: JSON.stringify({
                taskClass: "read_only_worker",
                checkpointId: "checkpoint_swarm_placeholder",
                checkpointKey: "checkpoint::swarm-placeholder",
                summary:
                  "Read-only swarm worker spawn request recorded for checkpoint::swarm-placeholder.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:02:00.000Z"),
            },
            {
              id: "swarm_intent_1",
              eventType: "swarm.read-only-worker.intent.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-placeholder",
                checkpointId: "checkpoint_swarm_placeholder",
                checkpointKey: "checkpoint::swarm-placeholder",
                artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
                summary: "Read-only worker intent recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:03:00.000Z"),
            },
            {
              id: "swarm_placeholder_1",
              eventType: "swarm.read-only-worker.placeholder.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-placeholder",
                checkpointId: "checkpoint_swarm_placeholder",
                checkpointKey: "checkpoint::swarm-placeholder",
                placeholderBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-placeholder",
                placeholderBundleTitle: "grep findings placeholder bundle",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-placeholder and return typed findings only.",
                summary: "Read-only worker placeholder recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:04:00.000Z"),
            },
          ],
          persistedPayloadHandles: [],
        },
      ],
    });

    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState,
    ).toBe("recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.handoffConsumptionRecordState,
    ).toBe("recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionPreflightState,
    ).toBe("ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.placeholderRecordEventId,
    ).toBe("swarm_placeholder_1");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.placeholderRecordedBy,
    ).toBe("founder@demo.com");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.placeholderRecordSourcePage,
    ).toBe("/operating");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionRecordState,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionGuardContract
        .state,
    ).toBe("allowed");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionLifecycleContract
        .state,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationGuardContract.state,
    ).toBe("blocked");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionGuardContract
        .placeholderBundleKey,
    ).toBe("artifact-bundle::swarm::grep::checkpoint::swarm-placeholder");
  });

  it("projects recorded worker execution admission into the continuity queue", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_swarm",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      swarmReadOnlyWorkersEnabled: true,
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      benchmarkMatrixRuns: [],
      benchmarkExecutionRequests: [],
      benchmarkExecutionAcknowledgements: [],
      benchmarkExecutionFollowThrough: [],
      runtimeSessions: [
        {
          id: "session_swarm_execution",
          workspaceId: "workspace_swarm",
          label: "Swarm execution continuity session",
          sessionKey: "session::swarm-execution",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/operating",
          boundaryNote: "Review-first runtime only.",
          meetingId: "meeting_swarm",
          opportunityId: null,
          companyId: "company_swarm",
          createdAt: new Date("2026-04-16T09:00:00.000Z"),
          updatedAt: new Date("2026-04-16T09:15:00.000Z"),
          closedAt: null,
          resumedFromKey: null,
          replayableEventLog: "[]",
          controlPlaneLifecycleJson: null,
          controlPlaneLifecycleUpdatedAt: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 52,
          prunedTokenCount: 0,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_swarm_execution",
              checkpointKey: "checkpoint::swarm-execution",
              label: "swarm_execution_anchor",
              status: "READY",
              summary: "Checkpoint anchor for swarm execution.",
              snapshotJson: JSON.stringify({ reviewState: "ready" }),
              createdAt: new Date("2026-04-16T09:01:00.000Z"),
              updatedAt: new Date("2026-04-16T09:01:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Swarm execution admission stays review-first.",
            decisionSummary: "Record execution admission before any real worker fan-out exists.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Keep execution admission explicit and non-executing.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          remediationEvents: [],
          requestEvents: [
            {
              id: "swarm_request_1",
              eventType: "swarm.spawn.requested",
              payload: JSON.stringify({
                taskClass: "read_only_worker",
                checkpointId: "checkpoint_swarm_execution",
                checkpointKey: "checkpoint::swarm-execution",
                summary:
                  "Read-only swarm worker spawn request recorded for checkpoint::swarm-execution.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:02:00.000Z"),
            },
            {
              id: "swarm_intent_1",
              eventType: "swarm.read-only-worker.intent.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-execution",
                checkpointId: "checkpoint_swarm_execution",
                checkpointKey: "checkpoint::swarm-execution",
                artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
                summary: "Read-only worker intent recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:03:00.000Z"),
            },
            {
              id: "swarm_placeholder_1",
              eventType: "swarm.read-only-worker.placeholder.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-execution",
                checkpointId: "checkpoint_swarm_execution",
                checkpointKey: "checkpoint::swarm-execution",
                placeholderBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-execution",
                placeholderBundleTitle: "grep findings placeholder bundle",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-execution and return typed findings only.",
                summary: "Read-only worker placeholder recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:04:00.000Z"),
            },
            {
              id: "swarm_execution_1",
              eventType: "swarm.read-only-worker.execution.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-execution",
                checkpointId: "checkpoint_swarm_execution",
                checkpointKey: "checkpoint::swarm-execution",
                placeholderBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-execution",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-execution and return typed findings only.",
                summary: "Read-only worker execution slice recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:05:00.000Z"),
            },
          ],
          persistedPayloadHandles: [],
        },
      ],
    });

    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionRecordState,
    ).toBe("recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionEventId,
    ).toBe("swarm_execution_1");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionRecordedBy,
    ).toBe("founder@demo.com");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionRecordSourcePage,
    ).toBe("/operating");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionGuardContract
        .state,
    ).toBe("reused");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionLifecycleContract
        .state,
    ).toBe("recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionCandidateContract
        .state,
    ).toBe("candidate_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.executionCandidateContract
        .artifactMaterializationState,
    ).toBe("intent_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.artifactMaterializationRecordState,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationLifecycleContract.state,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.resultSideOutputContract
        .state,
    ).toBe("not_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.resultSideOutputContract
        .driver,
    ).toBe("materialization_not_recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .resultSideOutputGuardContract.state,
    ).toBe("blocked");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .resultSideOutputLifecycleContract.state,
    ).toBe("blocked");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.outputConsumptionContract
        .state,
    ).toBe("not_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.resultAdoptionContract
        .state,
    ).toBe("not_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .outputAdoptionGuardContract.state,
    ).toBe("blocked");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .outputAdoptionLifecycleContract.state,
    ).toBe("blocked");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .resultAdoptionResultSideContract.state,
    ).toBe("not_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationGuardContract.state,
    ).toBe("allowed");
  });

  it("projects recorded worker materialization into the continuity queue", () => {
    const overview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_swarm",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      swarmReadOnlyWorkersEnabled: true,
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      benchmarkMatrixRuns: [],
      benchmarkExecutionRequests: [],
      benchmarkExecutionAcknowledgements: [],
      benchmarkExecutionFollowThrough: [],
      runtimeSessions: [
        {
          id: "session_swarm_materialization",
          workspaceId: "workspace_swarm",
          label: "Swarm materialization continuity session",
          sessionKey: "session::swarm-materialization",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/operating",
          boundaryNote: "Review-first runtime only.",
          meetingId: "meeting_swarm",
          opportunityId: null,
          companyId: "company_swarm",
          createdAt: new Date("2026-04-16T09:00:00.000Z"),
          updatedAt: new Date("2026-04-16T09:16:00.000Z"),
          closedAt: null,
          resumedFromKey: null,
          replayableEventLog: "[]",
          controlPlaneLifecycleJson: null,
          controlPlaneLifecycleUpdatedAt: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 52,
          prunedTokenCount: 0,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_swarm_materialization",
              checkpointKey: "checkpoint::swarm-materialization",
              label: "swarm_materialization_anchor",
              status: "READY",
              summary: "Checkpoint anchor for swarm materialization.",
              snapshotJson: JSON.stringify({ reviewState: "ready" }),
              createdAt: new Date("2026-04-16T09:01:00.000Z"),
              updatedAt: new Date("2026-04-16T09:01:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Swarm materialization stays review-first.",
            decisionSummary: "Record artifact materialization before any real worker result exists.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Keep materialization explicit and non-executing.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          remediationEvents: [],
          requestEvents: [
            {
              id: "swarm_request_1",
              eventType: "swarm.spawn.requested",
              payload: JSON.stringify({
                taskClass: "read_only_worker",
                checkpointId: "checkpoint_swarm_materialization",
                checkpointKey: "checkpoint::swarm-materialization",
                summary:
                  "Read-only swarm worker spawn request recorded for checkpoint::swarm-materialization.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:02:00.000Z"),
            },
            {
              id: "swarm_intent_1",
              eventType: "swarm.read-only-worker.intent.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-materialization",
                checkpointId: "checkpoint_swarm_materialization",
                checkpointKey: "checkpoint::swarm-materialization",
                artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
                summary: "Read-only worker intent recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:03:00.000Z"),
            },
            {
              id: "swarm_placeholder_1",
              eventType: "swarm.read-only-worker.placeholder.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-materialization",
                checkpointId: "checkpoint_swarm_materialization",
                checkpointKey: "checkpoint::swarm-materialization",
                placeholderBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-materialization",
                placeholderBundleTitle: "grep findings placeholder bundle",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-materialization and return typed findings only.",
                summary: "Read-only worker placeholder recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:04:00.000Z"),
            },
            {
              id: "swarm_execution_1",
              eventType: "swarm.read-only-worker.execution.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-materialization",
                checkpointId: "checkpoint_swarm_materialization",
                checkpointKey: "checkpoint::swarm-materialization",
                placeholderBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-materialization",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-materialization and return typed findings only.",
                summary: "Read-only worker execution slice recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:05:00.000Z"),
            },
            {
              id: "swarm_materialization_1",
              eventType: "swarm.read-only-worker.materialization.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-materialization",
                checkpointId: "checkpoint_swarm_materialization",
                checkpointKey: "checkpoint::swarm-materialization",
                materializationBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-materialization",
                materializationBundleTitle: "grep findings placeholder bundle",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-materialization and return typed findings only.",
                summary: "Read-only worker materialization slice recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:06:00.000Z"),
            },
          ],
          persistedPayloadHandles: [],
        },
      ],
    });

    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationRecordState,
    ).toBe("recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationEventId,
    ).toBe("swarm_materialization_1");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.artifactMaterializedBy,
    ).toBe("founder@demo.com");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationSourcePage,
    ).toBe("/operating");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationLifecycleContract.state,
    ).toBe("recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .artifactMaterializationLifecycleContract.driver,
    ).toBe("recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.resultSideOutputContract
        .state,
    ).toBe("output_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.resultSideOutputContract
        .driver,
    ).toBe("materialization_recorded");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .resultSideOutputGuardContract.state,
    ).toBe("allowed");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .resultSideOutputLifecycleContract.state,
    ).toBe("consumable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.outputConsumptionContract
        .state,
    ).toBe("consumable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.resultAdoptionContract
        .state,
    ).toBe("adoption_ready");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .outputAdoptionGuardContract.state,
    ).toBe("allowed");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.outputAdoptionRecordState,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .outputAdoptionLifecycleContract.state,
    ).toBe("recordable");
    expect(
      overview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .resultAdoptionResultSideContract.state,
    ).toBe("not_ready");

    const adoptedOverview = buildWorkspaceRuntimeOperatorOverview({
      workspaceId: "workspace_swarm",
      sessionCounts: {
        total: 1,
        active: 1,
      },
      queueCounts: {
        verification: 0,
        promotion: 0,
        reflectionCarryForward: 0,
        openProblemSpaces: 0,
        unresolvedCompositionFailures: 0,
        reflectionQueue: 0,
        consolidationQueue: 0,
      },
      swarmReadOnlyWorkersEnabled: true,
      verificationReports: [],
      truthConflicts: [],
      memoryCandidates: [],
      memoryPromotions: [],
      problemSpaces: [],
      playerCoachBriefs: [],
      compositionFailures: [],
      consolidationJobs: [],
      signals: [],
      capabilities: [],
      connectors: [],
      handoffPackets: [],
      initiativeRuns: [],
      humanExecutions: [],
      officialWriteIntents: [],
      limitedAutoIntents: [],
      officialFollowThrough: [],
      coordinationMetrics: null,
      cacheTelemetry: [],
      benchmarkMatrixRuns: [],
      benchmarkExecutionRequests: [],
      benchmarkExecutionAcknowledgements: [],
      benchmarkExecutionFollowThrough: [],
      runtimeSessions: [
        {
          id: "session_swarm_adoption",
          workspaceId: "workspace_swarm",
          label: "Swarm adoption continuity session",
          sessionKey: "session::swarm-adoption",
          status: "ACTIVE",
          currentStage: "review_confirmed",
          sourcePage: "/operating",
          boundaryNote: "Review-first runtime only.",
          meetingId: "meeting_swarm",
          opportunityId: null,
          companyId: "company_swarm",
          createdAt: new Date("2026-04-16T09:00:00.000Z"),
          updatedAt: new Date("2026-04-16T09:17:00.000Z"),
          closedAt: null,
          resumedFromKey: null,
          replayableEventLog: "[]",
          controlPlaneLifecycleJson: null,
          controlPlaneLifecycleUpdatedAt: null,
          budgetTokenLimit: 100,
          budgetTokenUsed: 52,
          prunedTokenCount: 0,
          meetingFrequencyBand: "RECURRING",
          participantRolePosture: "OPERATOR_LED",
          contextEditEvents: [],
          checkpoints: [
            {
              id: "checkpoint_swarm_adoption",
              checkpointKey: "checkpoint::swarm-adoption",
              label: "swarm_adoption_anchor",
              status: "READY",
              summary: "Checkpoint anchor for swarm adoption.",
              snapshotJson: JSON.stringify({ reviewState: "ready" }),
              createdAt: new Date("2026-04-16T09:01:00.000Z"),
              updatedAt: new Date("2026-04-16T09:01:00.000Z"),
            },
          ],
          notebook: {
            sessionSummary: "Swarm adoption stays review-first.",
            decisionSummary: "Record result adoption before any real worker output handling exists.",
            blockerSummary: null,
            pendingQuestions: JSON.stringify([]),
            openLoopSummary: "Keep adoption explicit and non-executing.",
            boundaryNote: "Review-first runtime only.",
          },
          problemSpaces: [],
          memoryCandidates: [],
          memoryPromotions: [],
          verificationReports: [],
          handoffPackets: [],
          remediationEvents: [],
          requestEvents: [
            {
              id: "swarm_request_1",
              eventType: "swarm.spawn.requested",
              payload: JSON.stringify({
                taskClass: "read_only_worker",
                checkpointId: "checkpoint_swarm_adoption",
                checkpointKey: "checkpoint::swarm-adoption",
                summary:
                  "Read-only swarm worker spawn request recorded for checkpoint::swarm-adoption.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:02:00.000Z"),
            },
            {
              id: "swarm_intent_1",
              eventType: "swarm.read-only-worker.intent.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-adoption",
                checkpointId: "checkpoint_swarm_adoption",
                checkpointKey: "checkpoint::swarm-adoption",
                artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
                summary: "Read-only worker intent recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/meetings/meeting_swarm",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:03:00.000Z"),
            },
            {
              id: "swarm_placeholder_1",
              eventType: "swarm.read-only-worker.placeholder.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-adoption",
                checkpointId: "checkpoint_swarm_adoption",
                checkpointKey: "checkpoint::swarm-adoption",
                placeholderBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
                placeholderBundleTitle: "grep findings placeholder bundle",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
                summary: "Read-only worker placeholder recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:04:00.000Z"),
            },
            {
              id: "swarm_execution_1",
              eventType: "swarm.read-only-worker.execution.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-adoption",
                checkpointId: "checkpoint_swarm_adoption",
                checkpointKey: "checkpoint::swarm-adoption",
                placeholderBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
                summary: "Read-only worker execution slice recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:05:00.000Z"),
            },
            {
              id: "swarm_materialization_1",
              eventType: "swarm.read-only-worker.materialization.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-adoption",
                checkpointId: "checkpoint_swarm_adoption",
                checkpointKey: "checkpoint::swarm-adoption",
                materializationBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
                materializationBundleTitle: "grep findings placeholder bundle",
                artifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
                summary: "Read-only worker materialization slice recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:06:00.000Z"),
            },
            {
              id: "swarm_adoption_1",
              eventType: "swarm.read-only-worker.adoption.recorded",
              payload: JSON.stringify({
                workerKind: "grep",
                packetKey: "swarm::grep::checkpoint::swarm-adoption",
                checkpointId: "checkpoint_swarm_adoption",
                checkpointKey: "checkpoint::swarm-adoption",
                outputBundleKey:
                  "artifact-bundle::swarm::grep::checkpoint::swarm-adoption",
                outputBundleTitle: "grep findings placeholder bundle",
                outputArtifactTypes: [
                  "grep_hits.json",
                  "worker_findings_bundle.json",
                  "worker_handoff_note.md",
                ],
                handoffConsumerAgent: "lead-orchestrator",
                handoffConsumptionGoal:
                  "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-adoption and return typed findings only.",
                summary: "Read-only worker output adoption seam recorded for grep.",
              }),
              trustedContext: JSON.stringify({
                sourcePage: "/operating",
              }),
              triggeredBy: "founder@demo.com",
              createdAt: new Date("2026-04-16T09:07:00.000Z"),
            },
          ],
          persistedPayloadHandles: [],
        },
      ],
    });

    expect(
      adoptedOverview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.outputAdoptionRecordState,
    ).toBe("recorded");
    expect(
      adoptedOverview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.outputAdoptionEventId,
    ).toBe("swarm_adoption_1");
    expect(
      adoptedOverview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.outputAdoptedBy,
    ).toBe("founder@demo.com");
    expect(
      adoptedOverview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract.outputAdoptionSourcePage,
    ).toBe("/operating");
    expect(
      adoptedOverview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .outputAdoptionLifecycleContract.state,
    ).toBe("recorded");
    expect(
      adoptedOverview.continuityQueue[0]?.runThread.swarmReadOnlyWorkerContract
        .resultAdoptionResultSideContract.state,
    ).toBe("output_ready");
  });

  it("projects review-first swarm verification merge lanes into the continuity queue", () => {
    const buildSwarmMergeLaneOverview = (options?: {
      verificationStatus?: "PASSED" | "BLOCKED" | "NEEDS_REVIEW";
      blockedReasons?: string[];
      truthConflicts?: Array<{ id: string; status: "OPEN" | "RESOLVED"; summary: string }>;
      includeRecordedEvent?: boolean;
    }) =>
      buildWorkspaceRuntimeOperatorOverview({
        workspaceId: "workspace_swarm",
        sessionCounts: {
          total: 1,
          active: 1,
        },
        queueCounts: {
          verification: 0,
          promotion: 0,
          reflectionCarryForward: 0,
          openProblemSpaces: 0,
          unresolvedCompositionFailures: 0,
          reflectionQueue: 0,
          consolidationQueue: 0,
        },
        swarmReadOnlyWorkersEnabled: true,
        verificationReports: [],
        truthConflicts: [],
        memoryCandidates: [],
        memoryPromotions: [],
        problemSpaces: [],
        playerCoachBriefs: [],
        compositionFailures: [],
        consolidationJobs: [],
        signals: [],
        capabilities: [],
        connectors: [],
        handoffPackets: [],
        initiativeRuns: [],
        humanExecutions: [],
        officialWriteIntents: [],
        limitedAutoIntents: [],
        officialFollowThrough: [],
        coordinationMetrics: null,
        cacheTelemetry: [],
        benchmarkMatrixRuns: [],
        benchmarkExecutionRequests: [],
        benchmarkExecutionAcknowledgements: [],
        benchmarkExecutionFollowThrough: [],
        runtimeSessions: [
          {
            id: "session_swarm_merge_lane",
            workspaceId: "workspace_swarm",
            label: "Swarm merge lane continuity session",
            sessionKey: "session::swarm-merge-lane",
            status: "ACTIVE",
            currentStage: "review_confirmed",
            sourcePage: "/operating",
            boundaryNote: "Review-first runtime only.",
            meetingId: "meeting_swarm",
            opportunityId: null,
            companyId: "company_swarm",
            createdAt: new Date("2026-04-16T09:00:00.000Z"),
            updatedAt: new Date("2026-04-16T09:08:00.000Z"),
            closedAt: null,
            resumedFromKey: null,
            replayableEventLog: "[]",
            controlPlaneLifecycleJson: null,
            controlPlaneLifecycleUpdatedAt: null,
            budgetTokenLimit: 100,
            budgetTokenUsed: 52,
            prunedTokenCount: 0,
            meetingFrequencyBand: "RECURRING",
            participantRolePosture: "OPERATOR_LED",
            contextEditEvents: [],
            checkpoints: [
              {
                id: "checkpoint_swarm_merge_lane",
                checkpointKey: "checkpoint::swarm-merge-lane",
                label: "swarm_merge_lane_anchor",
                status: "READY",
                summary: "Checkpoint anchor for merge-lane verification.",
                snapshotJson: JSON.stringify({ reviewState: "ready" }),
                createdAt: new Date("2026-04-16T09:01:00.000Z"),
                updatedAt: new Date("2026-04-16T09:01:00.000Z"),
              },
            ],
            notebook: {
              sessionSummary: "Swarm merge lane stays review-first.",
              decisionSummary: "Only bounded verification truth can produce a merge-lane record.",
              blockerSummary: null,
              pendingQuestions: JSON.stringify([]),
              openLoopSummary: "Keep disagreement trace explicit before any merge handoff is recorded.",
              boundaryNote: "Review-first runtime only.",
            },
            problemSpaces: [],
            memoryCandidates: [],
            memoryPromotions: [],
            verificationReports: [
              {
                status: options?.verificationStatus ?? "PASSED",
                summary:
                  options?.verificationStatus === "BLOCKED"
                    ? "Verification is blocked by unresolved evidence drift."
                    : options?.verificationStatus === "NEEDS_REVIEW"
                      ? "Verification still needs explicit human review."
                      : "Verification passed with no open blocker.",
                blockedReasons: JSON.stringify(options?.blockedReasons ?? []),
              },
            ],
            truthConflicts:
              options?.truthConflicts?.map((item) => ({
                id: item.id,
                status: item.status,
                summary: item.summary,
                subjectKey: `workspace_swarm:MEETING:meeting_swarm:${item.id}`,
                createdAt: new Date("2026-04-16T09:08:30.000Z"),
              })) ?? [],
            handoffPackets: [],
            remediationEvents: [],
            requestEvents: [
              {
                id: "swarm_request_1",
                eventType: "swarm.spawn.requested",
                payload: JSON.stringify({
                  taskClass: "read_only_worker",
                  checkpointId: "checkpoint_swarm_merge_lane",
                  checkpointKey: "checkpoint::swarm-merge-lane",
                  summary:
                    "Read-only swarm worker spawn request recorded for checkpoint::swarm-merge-lane.",
                }),
                trustedContext: JSON.stringify({
                  sourcePage: "/meetings/meeting_swarm",
                }),
                triggeredBy: "founder@demo.com",
                createdAt: new Date("2026-04-16T09:02:00.000Z"),
              },
              {
                id: "swarm_intent_1",
                eventType: "swarm.read-only-worker.intent.recorded",
                payload: JSON.stringify({
                  workerKind: "grep",
                  packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
                  checkpointId: "checkpoint_swarm_merge_lane",
                  checkpointKey: "checkpoint::swarm-merge-lane",
                  artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
                  summary: "Read-only worker intent recorded for grep.",
                }),
                trustedContext: JSON.stringify({
                  sourcePage: "/meetings/meeting_swarm",
                }),
                triggeredBy: "founder@demo.com",
                createdAt: new Date("2026-04-16T09:03:00.000Z"),
              },
              {
                id: "swarm_placeholder_1",
                eventType: "swarm.read-only-worker.placeholder.recorded",
                payload: JSON.stringify({
                  workerKind: "grep",
                  packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
                  checkpointId: "checkpoint_swarm_merge_lane",
                  checkpointKey: "checkpoint::swarm-merge-lane",
                  placeholderBundleKey:
                    "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
                  placeholderBundleTitle: "grep findings placeholder bundle",
                  artifactTypes: [
                    "grep_hits.json",
                    "worker_findings_bundle.json",
                    "worker_handoff_note.md",
                  ],
                  handoffConsumerAgent: "lead-orchestrator",
                  handoffConsumptionGoal:
                    "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
                  summary: "Read-only worker placeholder recorded for grep.",
                }),
                trustedContext: JSON.stringify({
                  sourcePage: "/operating",
                }),
                triggeredBy: "founder@demo.com",
                createdAt: new Date("2026-04-16T09:04:00.000Z"),
              },
              {
                id: "swarm_execution_1",
                eventType: "swarm.read-only-worker.execution.recorded",
                payload: JSON.stringify({
                  workerKind: "grep",
                  packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
                  checkpointId: "checkpoint_swarm_merge_lane",
                  checkpointKey: "checkpoint::swarm-merge-lane",
                  placeholderBundleKey:
                    "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
                  artifactTypes: [
                    "grep_hits.json",
                    "worker_findings_bundle.json",
                    "worker_handoff_note.md",
                  ],
                  handoffConsumerAgent: "lead-orchestrator",
                  handoffConsumptionGoal:
                    "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
                  summary: "Read-only worker execution slice recorded for grep.",
                }),
                trustedContext: JSON.stringify({
                  sourcePage: "/operating",
                }),
                triggeredBy: "founder@demo.com",
                createdAt: new Date("2026-04-16T09:05:00.000Z"),
              },
              {
                id: "swarm_materialization_1",
                eventType: "swarm.read-only-worker.materialization.recorded",
                payload: JSON.stringify({
                  workerKind: "grep",
                  packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
                  checkpointId: "checkpoint_swarm_merge_lane",
                  checkpointKey: "checkpoint::swarm-merge-lane",
                  materializationBundleKey:
                    "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
                  materializationBundleTitle: "grep findings placeholder bundle",
                  artifactTypes: [
                    "grep_hits.json",
                    "worker_findings_bundle.json",
                    "worker_handoff_note.md",
                  ],
                  handoffConsumerAgent: "lead-orchestrator",
                  handoffConsumptionGoal:
                    "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
                  summary: "Read-only worker materialization slice recorded for grep.",
                }),
                trustedContext: JSON.stringify({
                  sourcePage: "/operating",
                }),
                triggeredBy: "founder@demo.com",
                createdAt: new Date("2026-04-16T09:06:00.000Z"),
              },
              {
                id: "swarm_adoption_1",
                eventType: "swarm.read-only-worker.adoption.recorded",
                payload: JSON.stringify({
                  workerKind: "grep",
                  packetKey: "swarm::grep::checkpoint::swarm-merge-lane",
                  checkpointId: "checkpoint_swarm_merge_lane",
                  checkpointKey: "checkpoint::swarm-merge-lane",
                  outputBundleKey:
                    "artifact-bundle::swarm::grep::checkpoint::swarm-merge-lane",
                  outputBundleTitle: "grep findings placeholder bundle",
                  outputArtifactTypes: [
                    "grep_hits.json",
                    "worker_findings_bundle.json",
                    "worker_handoff_note.md",
                  ],
                  handoffConsumerAgent: "lead-orchestrator",
                  handoffConsumptionGoal:
                    "Run bounded grep-style evidence lookup anchored on checkpoint::swarm-merge-lane and return typed findings only.",
                  summary: "Read-only worker output adoption seam recorded for grep.",
                }),
                trustedContext: JSON.stringify({
                  sourcePage: "/operating",
                }),
                triggeredBy: "founder@demo.com",
                createdAt: new Date("2026-04-16T09:07:00.000Z"),
              },
              ...(options?.includeRecordedEvent
                ? [
                    {
                      id: "swarm_merge_lane_1",
                      eventType: "swarm.verification-merge-lane.recorded",
                      payload: JSON.stringify({
                        mergeLaneTruth:
                          options?.truthConflicts && options.truthConflicts.length > 0
                            ? "human_review_required"
                            : options?.verificationStatus === "BLOCKED"
                              ? "rework_required"
                              : "mergeable",
                        checkpointId: "checkpoint_swarm_merge_lane",
                        checkpointKey: "checkpoint::swarm-merge-lane",
                        summary: "Swarm verification merge lane recorded for grep.",
                        nextAction:
                          "Hand the review-first merge lane to the visible reviewer guard.",
                        verifierSummary:
                          options?.verificationStatus === "BLOCKED"
                            ? "Verification is blocked by unresolved evidence drift."
                            : "Verification passed with no open blocker.",
                        disagreementSummary:
                          options?.truthConflicts && options.truthConflicts.length > 0
                            ? options.truthConflicts[0]?.summary ?? null
                            : null,
                        arbiterReference:
                          options?.truthConflicts && options.truthConflicts.length > 0
                            ? "explicit human review lane"
                            : "review-first merge guard",
                      }),
                      trustedContext: JSON.stringify({
                        sourcePage: "/operating",
                      }),
                      triggeredBy: "founder@demo.com",
                      createdAt: new Date("2026-04-16T09:08:00.000Z"),
                    },
                  ]
                : []),
            ],
            persistedPayloadHandles: [],
          },
        ],
      });

    const findSwarmMergeLaneQueueItem = (
      overview: ReturnType<typeof buildWorkspaceRuntimeOperatorOverview>,
    ) =>
      overview.verificationQueue.find(
        (item) =>
          item.source === "swarm_merge_lane" && item.sessionId === "session_swarm_merge_lane",
      );

    const mergeableOverview = buildSwarmMergeLaneOverview();
    expect(
      mergeableOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract.state,
    ).toBe("recordable");
    expect(
      mergeableOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract
        .mergeLaneTruth,
    ).toBe("mergeable");
    expect(
      mergeableOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract.driver,
    ).toBe("mergeable");
    expect(findSwarmMergeLaneQueueItem(mergeableOverview)?.status).toBe("PASSED");
    expect(findSwarmMergeLaneQueueItem(mergeableOverview)?.title).toContain("swarm merge lane");
    expect(findSwarmMergeLaneQueueItem(mergeableOverview)?.summary).toContain("mergeable");

    const reworkOverview = buildSwarmMergeLaneOverview({
      verificationStatus: "BLOCKED",
      blockedReasons: ["Evidence still conflicts with the operator brief."],
    });
    expect(
      reworkOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract
        .mergeLaneTruth,
    ).toBe("rework_required");
    expect(
      reworkOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract
        .disagreementSummary,
    ).toContain("Evidence still conflicts");
    expect(findSwarmMergeLaneQueueItem(reworkOverview)?.status).toBe("BLOCKED");
    expect(findSwarmMergeLaneQueueItem(reworkOverview)?.summary).toContain("requires rework");

    const reviewRequiredOverview = buildSwarmMergeLaneOverview({
      truthConflicts: [
        {
          id: "truth_conflict_1",
          status: "OPEN",
          summary: "Champion owner differs across verified sources.",
        },
      ],
    });
    expect(
      reviewRequiredOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract
        .mergeLaneTruth,
    ).toBe("human_review_required");
    expect(
      reviewRequiredOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract
        .disagreementSummary,
    ).toContain("Champion owner differs");
    expect(findSwarmMergeLaneQueueItem(reviewRequiredOverview)?.status).toBe("NEEDS_REVIEW");
    expect(findSwarmMergeLaneQueueItem(reviewRequiredOverview)?.summary).toContain(
      "requires human review",
    );

    const recordedOverview = buildSwarmMergeLaneOverview({ includeRecordedEvent: true });
    expect(
      recordedOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract.state,
    ).toBe("recorded");
    expect(
      recordedOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract
        .recordEventId,
    ).toBe("swarm_merge_lane_1");
    expect(
      recordedOverview.continuityQueue[0]?.runThread.swarmVerificationMergeLaneContract.summary,
    ).toContain("merge lane recorded");
    expect(findSwarmMergeLaneQueueItem(recordedOverview)?.id).toBe("swarm_merge_lane_1");
    expect(findSwarmMergeLaneQueueItem(recordedOverview)?.status).toBe("PASSED");
    expect(findSwarmMergeLaneQueueItem(recordedOverview)?.createdAt.toISOString()).toBe(
      "2026-04-16T09:08:00.000Z",
    );
  });

  it("does not let terminal consolidation jobs re-enter pause or resume lanes", async () => {
    dbMock.consolidationJob.findFirst.mockResolvedValue({
      id: "job_completed",
      workspaceId: "workspace_1",
      runtimeSessionId: "session_1",
      jobType: "manual_runtime_consolidation",
      status: "COMPLETED",
    });

    await expect(
      updateConsolidationJobStatus({
        workspaceId: "workspace_1",
        jobId: "job_completed",
        mode: "pause",
      }),
    ).rejects.toThrow("Only queued or running jobs can be paused");
    expect(dbMock.consolidationJob.update).not.toHaveBeenCalled();
  });
});
