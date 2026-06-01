import type {
  HelmV21HandoffPayloadSkeleton,
  HelmV21HumanInputCheckpointRequest,
  HelmV21InterruptReason,
  HelmV21OperatorDebuggerPersistedLifecycleTrace,
  HelmV21OperatorDebuggerRecoveryActionContract,
  HelmV21OperatorDebuggerRecoveryExecutionContract,
  HelmV21OperatorDebuggerRecoveryLifecycleContract,
  HelmV21OperatorDebuggerRecoveryStateMachineContract,
  HelmV21OperatorDebuggerSwarmReadOnlyWorkerContract,
  HelmV21OperatorDebuggerSwarmVerificationMergeLaneContract,
  HelmV21OperatorDebuggerSwarmSpawnContract,
  HelmV21OperatorDebuggerRecoveryTransitionContract,
  HelmV21OperatorDebuggerTraceContract,
  HelmV21OperatorDebuggerWriteContract,
  HelmV21OperatorDebuggerTakeoverActivation,
  HelmV21OperatorDebuggerTakeoverFollowThrough,
  HelmV21OperatorDebuggerHistoryEntry,
  HelmV21OperatorDebuggerReplayAssistance,
  HelmV21OperatorDebuggerReadModel,
  HelmV21OperatorDebuggerTakeoverAssistance,
  HelmV21OperatorDebuggerTakeoverRequest,
  HelmV21OperatorDebuggerVariableSnapshotEntry,
  HelmV21ResumeAsk,
  HelmV21RunThreadContract,
  HelmV2AgentId,
  HelmV2ApprovalTier,
} from "@/lib/helm-v2/contracts";
import { safeParseJson, trimText } from "@/lib/utils";

type OperatorDebuggerNotebookState = {
  objective: string;
  reviewState: string;
  confirmedFacts: string[];
  blockers: string[];
  decisions: string[];
  nextActions: string[];
  openQuestions: string[];
  boundaryNote: string;
};

type OperatorDebuggerPayloadState = {
  activeHandles: string[];
  prunedHandles: string[];
  stateSource: string;
  stateSummary: string;
};

type OperatorDebuggerVerificationState = {
  status: string;
  blockedReasons: string[];
} | null;

type OperatorDebuggerReplayState = {
  fidelityStatus: "STRONG" | "WATCH" | "WEAK";
  fidelityScore: number;
  replaySummary: string;
  checkpointId: string;
  checkpointLabel: string;
  updatedAt: Date;
} | null;

type OperatorDebuggerRecoveryState = {
  state: "STABLE" | "RECOVERABLE" | "REVIEW_REQUIRED" | "BLOCKED";
  failureTaxonomy:
    | "NONE"
    | "NO_RECOVERY_ANCHOR"
    | "BUDGET_PRESSURE"
    | "PAYLOAD_STATE_DRIFT"
    | "REPLAY_DRIFT"
    | "PROTECTED_STATE_GAP";
  summary: string;
  operatorAction: string;
  allowedActions: Array<"SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT">;
  reviewReasons: string[];
  blockedReasons: string[];
  rollbackAnchor:
    | {
        checkpointId: string;
        checkpointLabel: string;
        checkpointStatus: string;
      }
    | null;
};

type OperatorDebuggerContextEdit = {
  id: string;
  strategy: string;
  beforeTokenCount: number;
  afterTokenCount: number;
  removedSummary: string | null;
  createdAt: Date;
};

type OperatorDebuggerRemediationEntry = {
  id: string;
  action: string;
  executionStatus: string;
  summary: string;
  rollbackAnchorSummary: string | null;
  triggeredBy: string;
  createdAt: Date;
};

type OperatorDebuggerHandoffPacketState = {
  id: string;
  packetKey: string;
  fromAgent: HelmV2AgentId;
  toAgent: HelmV2AgentId;
  goal: string;
  approvalTier: HelmV2ApprovalTier;
  constraintsJson: string | null;
  trustedRefs: string | null;
  untrustedRefs: string | null;
  requiredOutputs: string | null;
  evidenceRefs: string | null;
  notebookRef: string | null;
  checkpointRef: string | null;
  createdAt: Date;
};

type OperatorDebuggerTakeoverRequestEvent = {
  id: string;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverAssistance["recommendedAction"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type OperatorDebuggerTakeoverAcknowledgementEvent = {
  id: string;
  requestEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverAssistance["recommendedAction"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  acknowledgedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type OperatorDebuggerTakeoverStartEvent = {
  id: string;
  requestEventId: string | null;
  acknowledgementEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverAssistance["recommendedAction"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  startedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type OperatorDebuggerTakeoverReleaseEvent = {
  id: string;
  requestEventId: string | null;
  acknowledgementEventId: string | null;
  startEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverAssistance["recommendedAction"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  releaseReason: string;
  releasedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type OperatorDebuggerTakeoverFollowThroughRequestEvent = {
  id: string;
  takeoverRequestEventId: string | null;
  acknowledgementEventId: string | null;
  startEventId: string | null;
  releaseEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverAssistance["recommendedAction"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type OperatorDebuggerTakeoverFollowThroughResolvedEvent = {
  id: string;
  requestEventId: string | null;
  takeoverRequestEventId: string | null;
  acknowledgementEventId: string | null;
  startEventId: string | null;
  releaseEventId: string | null;
  action: NonNullable<HelmV21OperatorDebuggerTakeoverAssistance["recommendedAction"]>;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  summary: string;
  nextAction: string | null;
  resolvedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type OperatorDebuggerHumanInputRequestEvent = {
  id: string;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  prompt: string;
  summary: string;
  requestedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type OperatorDebuggerHumanInputAcknowledgementEvent = {
  id: string;
  requestEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  resumeToken: string | null;
  prompt: string;
  summary: string;
  acknowledgedBy: string;
  sourcePage: string | null;
  createdAt: Date;
};

type BuildOperatorDebuggerReadModelInput = {
  sessionLabel: string;
  runThread: HelmV21RunThreadContract;
  replayableEventLog: string | null;
  replay: OperatorDebuggerReplayState;
  recovery: OperatorDebuggerRecoveryState;
  notebookState: OperatorDebuggerNotebookState;
  payloadState: OperatorDebuggerPayloadState;
  verification: OperatorDebuggerVerificationState;
  contextEditEvents: OperatorDebuggerContextEdit[];
  remediationTrace: OperatorDebuggerRemediationEntry[];
  handoffPackets: OperatorDebuggerHandoffPacketState[];
  takeoverRequestEvent?: OperatorDebuggerTakeoverRequestEvent | null;
  takeoverAcknowledgementEvent?: OperatorDebuggerTakeoverAcknowledgementEvent | null;
  takeoverStartEvent?: OperatorDebuggerTakeoverStartEvent | null;
  takeoverReleaseEvent?: OperatorDebuggerTakeoverReleaseEvent | null;
  takeoverFollowThroughRequestEvent?: OperatorDebuggerTakeoverFollowThroughRequestEvent | null;
  takeoverFollowThroughResolvedEvent?: OperatorDebuggerTakeoverFollowThroughResolvedEvent | null;
  humanInputRequestEvent?: OperatorDebuggerHumanInputRequestEvent | null;
  humanInputAcknowledgementEvent?: OperatorDebuggerHumanInputAcknowledgementEvent | null;
};

function listPreview(items: string[], fallback: string) {
  return items.length ? items.slice(0, 3).join(" / ") : fallback;
}

function parseStringList(value?: string | null) {
  return safeParseJson<string[]>(value, []);
}

function parseReplayHistory(
  replayableEventLog: string | null,
  threadId: string,
): HelmV21OperatorDebuggerHistoryEntry[] {
  const events = safeParseJson<Array<Record<string, unknown>>>(replayableEventLog, []);
  return events.map((event, index) => ({
    id: String(event.id ?? `${threadId}:replay:${index}`),
    kind: "replay_event",
    label: String(event.stage ?? event.type ?? "replay_event"),
    summary: trimText(
      [
        typeof event.summary === "string" ? event.summary : null,
        typeof event.type === "string" ? `type ${event.type}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Replay log event recorded for this run thread.",
      160,
    ),
    timestamp: new Date(typeof event.at === "string" ? event.at : Date.now()),
    checkpointKey: null,
    source: "replay_log",
  }));
}

function buildVariableSnapshot(input: BuildOperatorDebuggerReadModelInput): HelmV21OperatorDebuggerVariableSnapshotEntry[] {
  return [
    {
      key: "run_status",
      value: `${input.runThread.runStatus} · ${input.runThread.lifecycle}`,
      source: "run_thread",
    },
    {
      key: "stage",
      value: input.runThread.stageKey,
      source: "run_thread",
    },
    {
      key: "checkpoint_anchor",
      value: input.runThread.latestCheckpoint?.checkpointKey ?? "none",
      source: "run_thread",
    },
    {
      key: "resume",
      value: `${input.runThread.resume.state} · ${input.runThread.replayRequest.mode}`,
      source: "run_thread",
    },
    {
      key: "persisted_lifecycle_trace",
      value: `${input.runThread.persistedControlPlaneLifecycle.state} · ${input.runThread.persistedControlPlaneLifecycle.compactionPolicy.state} · ${input.runThread.persistedControlPlaneLifecycle.reconciliationPolicy.state} · ${input.runThread.resume.state}/${input.runThread.replayRequest.mode}/${input.runThread.humanInputCheckpoint.state}`,
      source: "run_thread",
    },
    {
      key: "human_input",
      value: input.runThread.humanInputCheckpoint.state,
      source: "run_thread",
    },
    {
      key: "result_acknowledgement",
      value: `${input.runThread.resultAcknowledgement.state} · ${input.runThread.resultAcknowledgement.source ?? "none"}`,
      source: "run_thread",
    },
    {
      key: "result_flow",
      value: `${input.runThread.resultFlow.requiresOperatorAttentionCount} attention · ${input.runThread.resultFlow.resolvedCount} resolved · ${input.runThread.resultFlow.latestState}`,
      source: "run_thread",
    },
    {
      key: "forward_flow",
      value: `${input.runThread.forwardFlow.state} · ${input.runThread.forwardFlow.attentionCount} attention · ${input.runThread.forwardFlow.currentOwner ?? "no-owner"}`,
      source: "run_thread",
    },
    {
      key: "closeout_flow",
      value: `${input.runThread.closeoutFlow.state} · ${input.runThread.closeoutFlow.openCount} open · ${input.runThread.closeoutFlow.resolvedCount} resolved`,
      source: "run_thread",
    },
    {
      key: "closeout_summary",
      value: `${input.runThread.closeoutSummary.state} · ${input.runThread.closeoutSummary.driver} · ${input.runThread.closeoutSummary.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "closeout_resolution",
      value: `${input.runThread.closeoutResolution.state} · ${input.runThread.closeoutResolution.decision ?? "no-decision"} · ${input.runThread.closeoutResolution.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "closeout_resolution_followthrough",
      value: `${input.runThread.closeoutResolutionFollowThrough.state} · ${input.runThread.closeoutResolutionFollowThrough.decision ?? "no-decision"} · ${input.runThread.closeoutResolutionFollowThrough.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "closeout_outcome",
      value: `${input.runThread.closeoutOutcome.state} · ${input.runThread.closeoutOutcome.decision ?? "no-decision"} · ${input.runThread.closeoutOutcome.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_request",
      value: `${input.runThread.closeRequest.state} · ${input.runThread.closeRequest.checkpointKey ?? "no-checkpoint"} · ${input.runThread.closeRequest.requestedBy ?? "no-owner"}`,
      source: "run_thread",
    },
    {
      key: "close_lifecycle",
      value: `${input.runThread.closeLifecycle.state} · ${input.runThread.closeLifecycle.driver} · ${input.runThread.closeLifecycle.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_control",
      value: `${input.runThread.closeControl.state} · ${input.runThread.closeControl.driver} · ${input.runThread.closeControl.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_control_flow",
      value: `${input.runThread.closeControlFlow.state} · ${input.runThread.closeControlFlow.driver} · ${input.runThread.closeControlFlow.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_decision_flow",
      value: `${input.runThread.closeDecisionFlow.state} · ${input.runThread.closeDecisionFlow.driver} · ${input.runThread.closeDecisionFlow.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_decision_control_summary",
      value: `${input.runThread.closeDecisionControlSummary.state} · ${input.runThread.closeDecisionControlSummary.driver} · ${input.runThread.closeDecisionControlSummary.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_resolution_summary",
      value: `${input.runThread.closeResolutionSummary.state} · ${input.runThread.closeResolutionSummary.driver} · ${input.runThread.closeResolutionSummary.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_resolution_forward_summary",
      value: `${input.runThread.closeResolutionForwardSummary.state} · ${input.runThread.closeResolutionForwardSummary.driver} · ${input.runThread.closeResolutionForwardSummary.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_resolution_control_summary",
      value: `${input.runThread.closeResolutionControlSummary.state} · ${input.runThread.closeResolutionControlSummary.driver} · ${input.runThread.closeResolutionControlSummary.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_posture_summary",
      value: `${input.runThread.closePostureSummary.state} · ${input.runThread.closePostureSummary.driver} · ${input.runThread.closePostureSummary.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "close_posture_forward_summary",
      value: `${input.runThread.closePostureForwardSummary.state} · ${input.runThread.closePostureForwardSummary.driver} · ${input.runThread.closePostureForwardSummary.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread",
    },
    {
      key: "settlement_flow",
      value: `${input.runThread.settlementFlow.state} · ${input.runThread.settlementFlow.forwardAttentionCount} forward attention · ${input.runThread.settlementFlow.openCloseoutCount} closeout open`,
      source: "run_thread",
    },
    {
      key: "settlement_review",
      value: `${input.runThread.settlementReview.state} · ${input.runThread.settlementReview.checkpointKey ?? "no-checkpoint"} · ${input.runThread.settlementReview.resolvedBy ?? input.runThread.settlementReview.requestedBy ?? "no-owner"}`,
      source: "run_thread",
    },
    {
      key: "closeout_confirmation",
      value: `${input.runThread.closeoutConfirmation.state} · ${input.runThread.closeoutConfirmation.checkpointKey ?? "no-checkpoint"} · ${input.runThread.closeoutConfirmation.confirmedBy ?? "no-owner"}`,
      source: "run_thread",
    },
    {
      key: "closeout_refresh",
      value: `${input.runThread.closeoutRefresh.state} · ${input.runThread.closeoutRefresh.checkpointKey ?? "no-checkpoint"} · ${input.runThread.closeoutRefresh.requestedBy ?? "no-owner"}`,
      source: "run_thread",
    },
    {
      key: "objective",
      value: input.notebookState.objective,
      source: "notebook",
    },
    {
      key: "review_state",
      value: input.notebookState.reviewState,
      source: "notebook",
    },
    {
      key: "next_actions",
      value: listPreview(input.notebookState.nextActions, "No next action recorded."),
      source: "notebook",
    },
    {
      key: "blockers",
      value: listPreview(input.notebookState.blockers, "No blocker recorded."),
      source: "notebook",
    },
    {
      key: "payload_state",
      value: `${input.payloadState.stateSource} · ${input.payloadState.activeHandles.length} active / ${input.payloadState.prunedHandles.length} pruned`,
      source: "payload",
    },
    {
      key: "verification",
      value: input.verification
        ? `${input.verification.status} · ${listPreview(input.verification.blockedReasons, "No blocked reason recorded.")}`
        : "No verification state recorded.",
      source: "verification",
    },
  ];
}

function buildOperatorDebuggerPersistedLifecycleTrace(
  input: Pick<BuildOperatorDebuggerReadModelInput, "runThread">,
): HelmV21OperatorDebuggerPersistedLifecycleTrace {
  const persisted = input.runThread.persistedControlPlaneLifecycle;
  const humanInputAnchorReady =
    input.runThread.humanInputCheckpoint.state === "checkpoint_ready" &&
    input.runThread.humanInputCheckpoint.checkpointKey !== null;
  const replayAnchorReady =
    input.runThread.replayRequest.mode !== "none" && input.runThread.replayRequest.checkpointKey !== null;

  const anchor =
    humanInputAnchorReady
      ? "human_input"
      : replayAnchorReady
        ? "replay"
        : input.runThread.latestCheckpoint?.checkpointKey
          ? "checkpoint"
          : "none";

  const checkpointId =
    anchor === "human_input"
      ? input.runThread.humanInputCheckpoint.checkpointId
      : anchor === "replay"
        ? input.runThread.replayRequest.checkpointId
        : input.runThread.latestCheckpoint?.checkpointId ?? null;
  const checkpointKey =
    anchor === "human_input"
      ? input.runThread.humanInputCheckpoint.checkpointKey
      : anchor === "replay"
        ? input.runThread.replayRequest.checkpointKey
        : input.runThread.latestCheckpoint?.checkpointKey ?? null;
  const resumeToken =
    anchor === "human_input"
      ? input.runThread.humanInputCheckpoint.checkpointKey
      : anchor === "replay"
        ? input.runThread.replayRequest.resumeToken
        : input.runThread.latestCheckpoint?.resumeToken ?? null;

  const anchorSummary =
    anchor === "human_input"
      ? `human input checkpoint ${checkpointKey ?? "the current checkpoint"}`
      : anchor === "replay"
        ? `replay checkpoint ${checkpointKey ?? "the current checkpoint"}`
        : anchor === "checkpoint"
          ? `checkpoint ${checkpointKey ?? "the latest checkpoint"}`
          : "the current thread without a checkpoint anchor";

  const base = {
    anchor,
    checkpointId,
    checkpointKey,
    resumeToken,
    resumeState: input.runThread.resume.state,
    replayRequestMode: input.runThread.replayRequest.mode,
    humanInputCheckpointState: input.runThread.humanInputCheckpoint.state,
    persistedLifecycleState: persisted.state,
    writeSideState: persisted.writeSide.state,
    refreshReason: persisted.writeSide.refreshReason,
    refreshSource: persisted.writeSide.refreshSource,
    compactionState: persisted.compactionPolicy.state,
    reconciliationState: persisted.reconciliationPolicy.state,
    checkpointLineageDepth: input.runThread.checkpointLineage.length,
    replayEventLogEntries: input.runThread.replay.eventLogEntries,
    boundaryNote:
      "Persisted lifecycle trace stays review-first and debugger-visible only. It aligns checkpoint, replay, and human-input anchors with the bounded RuntimeSession snapshot, but it does not create a replay engine or widen authority.",
  } as const;

  if (
    persisted.state === "invalid" ||
    persisted.reconciliationPolicy.state === "fallback_to_event_truth"
  ) {
    return {
      ...base,
      state: "fallback_to_event_truth",
      summary: trimText(
        `Persisted lifecycle is unreadable, so debugger should anchor ${anchorSummary} on event-derived thread truth until a fresh bounded snapshot is written. Last persisted write-side state is ${persisted.writeSide.state}. Resume ${input.runThread.resume.state}, replay ${input.runThread.replayRequest.mode}, human input ${input.runThread.humanInputCheckpoint.state}.`,
        220,
      ),
      nextAction:
        persisted.reconciliationPolicy.nextAction ??
        "Refresh the persisted lifecycle payload before using it again as a debugger recovery aid.",
    };
  }

  if (
    persisted.state === "missing" ||
    persisted.compactionPolicy.state === "backfill_required" ||
    persisted.reconciliationPolicy.state === "backfill_required"
  ) {
    return {
      ...base,
      state: "backfill_required",
      summary: trimText(
        `No persisted lifecycle snapshot exists yet, so debugger can keep ${anchorSummary} visible but cannot reconcile resume ${input.runThread.resume.state}, replay ${input.runThread.replayRequest.mode}, or human input ${input.runThread.humanInputCheckpoint.state} against a stored control-plane snapshot. Persisted write-side state remains ${persisted.writeSide.state}.`,
        220,
      ),
      nextAction:
        persisted.compactionPolicy.nextAction ??
        persisted.reconciliationPolicy.nextAction ??
        "Backfill the first bounded persisted lifecycle snapshot before relying on it during replay or checkpoint review.",
    };
  }

  if (
    persisted.state === "drifted" ||
    persisted.compactionPolicy.state === "replace_required" ||
    persisted.reconciliationPolicy.state === "refresh_required"
  ) {
    return {
      ...base,
      state: "refresh_required",
      summary: trimText(
        `Persisted lifecycle drifted away from ${anchorSummary}, so debugger should keep resume ${input.runThread.resume.state}, replay ${input.runThread.replayRequest.mode}, checkpoint lineage, and human input ${input.runThread.humanInputCheckpoint.state} anchored to event-derived truth until the snapshot is refreshed. Persisted write-side state remains ${persisted.writeSide.state}.`,
        220,
      ),
      nextAction:
        persisted.reconciliationPolicy.nextAction ??
        persisted.compactionPolicy.nextAction ??
        "Refresh the persisted lifecycle snapshot before treating it as the current debugger recovery aid.",
    };
  }

  return {
    ...base,
    state: "aligned",
    summary: trimText(
      `Persisted lifecycle stays aligned with ${anchorSummary}. Latest persisted write came from ${persisted.writeSide.refreshReason ?? "an unspecified bounded refresh"}${persisted.writeSide.refreshSource ? ` (${persisted.writeSide.refreshSource})` : ""} and stored ${persisted.writeSide.state}. Resume ${input.runThread.resume.state}, replay ${input.runThread.replayRequest.mode}, and human input ${input.runThread.humanInputCheckpoint.state} stay on the same bounded thread; checkpoint lineage has ${input.runThread.checkpointLineage.length} anchor(s) and replay trace keeps ${input.runThread.replay.eventLogEntries} event(s).`,
      220,
    ),
    nextAction:
      anchor === "none"
        ? "Keep event-derived truth operator-visible until a bounded checkpoint anchor is written."
        : null,
  };
}

function buildOperatorDebuggerTraceContract(input: {
  runThread: HelmV21RunThreadContract;
  replayAssistance: HelmV21OperatorDebuggerReplayAssistance;
  persistedLifecycleTrace: HelmV21OperatorDebuggerPersistedLifecycleTrace;
  humanInputRequest: HelmV21HumanInputCheckpointRequest;
}): HelmV21OperatorDebuggerTraceContract {
  const checkpointState = input.runThread.latestCheckpoint?.state ?? "not_available";
  const checkpointId = input.persistedLifecycleTrace.checkpointId;
  const checkpointKey = input.persistedLifecycleTrace.checkpointKey;
  const anchorSummary =
    input.persistedLifecycleTrace.anchor === "human_input"
      ? `human input anchor ${checkpointKey ?? "on the current thread"}`
      : input.persistedLifecycleTrace.anchor === "replay"
        ? `replay anchor ${checkpointKey ?? "on the current thread"}`
        : input.persistedLifecycleTrace.anchor === "checkpoint"
          ? `checkpoint anchor ${checkpointKey ?? "on the current thread"}`
          : "the current thread without a checkpoint anchor";
  const base = {
    anchor: input.persistedLifecycleTrace.anchor,
    checkpointState,
    checkpointId,
    checkpointKey,
    resumeToken: input.persistedLifecycleTrace.resumeToken,
    resumeState: input.runThread.resume.state,
    replayRequestMode: input.runThread.replayRequest.mode,
    replayFidelity: input.replayAssistance.fidelity,
    replayEventLogEntries: input.runThread.replay.eventLogEntries,
    checkpointLineageDepth: input.runThread.checkpointLineage.length,
    humanInputCheckpointState: input.runThread.humanInputCheckpoint.state,
    humanInputRequestState: input.humanInputRequest.state,
    persistedLifecycleState: input.runThread.persistedControlPlaneLifecycle.state,
    persistedTraceState: input.persistedLifecycleTrace.state,
    persistedWriteSideState: input.persistedLifecycleTrace.writeSideState,
    refreshReason: input.persistedLifecycleTrace.refreshReason,
    boundaryNote:
      "Debugger trace contract stays read-only and review-first. It unifies checkpoint lineage, replay anchors, human-input anchors, and persisted lifecycle alignment into one operator-visible truth, but it does not create a replay engine or widen authority.",
  } as const;

  if (input.persistedLifecycleTrace.state === "backfill_required") {
    return {
      ...base,
      state: "backfill_required",
      driver: "persisted_lifecycle",
      summary: trimText(
        `Debugger trace has no bounded persisted snapshot for ${anchorSummary}. Checkpoint lineage still carries ${input.runThread.checkpointLineage.length} anchor(s), replay is ${input.runThread.replayRequest.mode}/${input.replayAssistance.fidelity}, and human input is ${input.runThread.humanInputCheckpoint.state}/${input.humanInputRequest.state}. Keep event-derived truth operator-visible until the first persisted snapshot is backfilled.`,
        220,
      ),
      nextAction: input.persistedLifecycleTrace.nextAction,
    };
  }

  if (
    input.persistedLifecycleTrace.state === "fallback_to_event_truth" ||
    input.persistedLifecycleTrace.state === "refresh_required"
  ) {
    return {
      ...base,
      state: "refresh_required",
      driver: "persisted_lifecycle",
      summary: trimText(
        `Debugger trace is still anchored to event-derived truth because persisted lifecycle is ${input.persistedLifecycleTrace.state} on ${anchorSummary}. Replay stays ${input.runThread.replayRequest.mode}/${input.replayAssistance.fidelity}, human input stays ${input.runThread.humanInputCheckpoint.state}/${input.humanInputRequest.state}, and persisted write-side is ${input.persistedLifecycleTrace.writeSideState}.`,
        220,
      ),
      nextAction: input.persistedLifecycleTrace.nextAction,
    };
  }

  if (
    input.runThread.humanInputCheckpoint.state === "checkpoint_ready" ||
    input.humanInputRequest.state === "requested" ||
    input.humanInputRequest.state === "acknowledged"
  ) {
    return {
      ...base,
      state: "human_input_ready",
      driver: "human_input",
      summary: trimText(
        `Debugger trace is anchored on ${anchorSummary} and waiting on human input. Replay stays ${input.runThread.replayRequest.mode}/${input.replayAssistance.fidelity}, checkpoint lineage holds ${input.runThread.checkpointLineage.length} anchor(s), and persisted lifecycle remains ${input.persistedLifecycleTrace.state}/${input.persistedLifecycleTrace.writeSideState}.`,
        220,
      ),
      nextAction:
        input.humanInputRequest.prompt ||
        input.runThread.humanInputCheckpoint.summary ||
        input.persistedLifecycleTrace.nextAction,
    };
  }

  if (
    input.runThread.replayRequest.mode !== "none" ||
    input.replayAssistance.fidelity !== "none"
  ) {
    return {
      ...base,
      state: "replay_ready",
      driver: "replay",
      summary: trimText(
        `Debugger trace is anchored on ${anchorSummary} with replay ${input.runThread.replayRequest.mode}/${input.replayAssistance.fidelity} across ${input.runThread.replay.eventLogEntries} replay event(s). Human input stays ${input.runThread.humanInputCheckpoint.state}/${input.humanInputRequest.state}, and persisted lifecycle remains ${input.persistedLifecycleTrace.state}/${input.persistedLifecycleTrace.writeSideState}.`,
        220,
      ),
      nextAction:
        input.persistedLifecycleTrace.nextAction ??
        `Review replay on ${checkpointKey ?? "the current thread anchor"} before widening recovery action.`,
    };
  }

  if (checkpointKey !== null || input.runThread.checkpointLineage.length > 0) {
    return {
      ...base,
      state: "checkpoint_ready",
      driver: "checkpoint",
      summary: trimText(
        `Debugger trace stays anchored on ${anchorSummary} with ${input.runThread.checkpointLineage.length} checkpoint lineage anchor(s). Resume is ${input.runThread.resume.state}, replay is ${input.runThread.replayRequest.mode}/${input.replayAssistance.fidelity}, and persisted lifecycle remains ${input.persistedLifecycleTrace.state}/${input.persistedLifecycleTrace.writeSideState}.`,
        220,
      ),
      nextAction:
        input.persistedLifecycleTrace.nextAction ??
        (input.runThread.resume.state === "ready"
          ? `Keep replay, resume, and human input tied to ${checkpointKey ?? "the current checkpoint anchor"} while operator review stays bounded.`
          : null),
    };
  }

  return {
    ...base,
    state: "observe",
    driver: "observe",
    summary: trimText(
      `Debugger trace has no active checkpoint, replay, or human-input anchor right now. Persisted lifecycle stays ${input.persistedLifecycleTrace.state}/${input.persistedLifecycleTrace.writeSideState}, and operator should keep the current thread observable without widening recovery action.`,
      220,
    ),
    nextAction: input.persistedLifecycleTrace.nextAction,
  };
}

function buildOperatorDebuggerWriteContract(input: {
  runThread: HelmV21RunThreadContract;
  traceContract: HelmV21OperatorDebuggerTraceContract;
  persistedLifecycleTrace: HelmV21OperatorDebuggerPersistedLifecycleTrace;
  humanInputRequest: HelmV21HumanInputCheckpointRequest;
}): HelmV21OperatorDebuggerWriteContract {
  const persisted = input.runThread.persistedControlPlaneLifecycle;
  const writeSide = persisted.writeSide;
  const checkpointId =
    writeSide.anchor === "resume"
      ? input.runThread.resume.resumedFromCheckpointId
      : writeSide.anchor === "human_input"
        ? input.runThread.humanInputCheckpoint.checkpointId
        : writeSide.anchor === "replay"
          ? input.runThread.replayRequest.checkpointId
          : writeSide.anchor === "checkpoint"
            ? input.runThread.latestCheckpoint?.checkpointId ?? null
            : null;
  const checkpointKey =
    writeSide.anchor === "none"
      ? null
      : writeSide.checkpointKey ??
        (writeSide.anchor === "resume"
          ? input.runThread.resume.resumedFromCheckpointKey
          : writeSide.anchor === "human_input"
            ? input.runThread.humanInputCheckpoint.checkpointKey
            : writeSide.anchor === "replay"
              ? input.runThread.replayRequest.checkpointKey
              : input.runThread.latestCheckpoint?.checkpointKey ?? null);
  const resumeToken =
    writeSide.anchor === "none"
      ? null
      : writeSide.resumeToken ??
        (writeSide.anchor === "resume"
          ? input.runThread.resume.resumeToken
          : writeSide.anchor === "human_input"
            ? input.runThread.humanInputCheckpoint.checkpointKey
            : writeSide.anchor === "replay"
              ? input.runThread.replayRequest.resumeToken
              : input.runThread.latestCheckpoint?.resumeToken ?? null);
  const anchorSummary =
    writeSide.anchor === "resume"
      ? `resume anchor ${checkpointKey ?? "on the current thread"}`
      : writeSide.anchor === "human_input"
        ? `human input anchor ${checkpointKey ?? "on the current thread"}`
        : writeSide.anchor === "replay"
          ? `replay anchor ${checkpointKey ?? "on the current thread"}`
          : writeSide.anchor === "checkpoint"
            ? `checkpoint anchor ${checkpointKey ?? "on the current thread"}`
            : "the current thread without a bounded write anchor";

  const base = {
    writeAnchor: writeSide.anchor,
    checkpointId,
    checkpointKey,
    resumeToken,
    resumeState: input.runThread.resume.state,
    replayRequestMode: input.runThread.replayRequest.mode,
    humanInputCheckpointState: input.runThread.humanInputCheckpoint.state,
    humanInputRequestState: input.humanInputRequest.state,
    persistedLifecycleState: persisted.state,
    persistedTraceState: input.persistedLifecycleTrace.state,
    persistedWriteSideState: writeSide.state,
    refreshReason: writeSide.refreshReason,
    refreshSource: writeSide.refreshSource,
    traceContractState: input.traceContract.state,
    traceContractDriver: input.traceContract.driver,
    boundaryNote:
      "Debugger write contract stays review-first and bounded. It makes the latest persisted replay/recovery write anchor explicit for operator review, but it does not create a replay engine or widen authority.",
  } as const;

  if (input.persistedLifecycleTrace.state === "backfill_required") {
    return {
      ...base,
      state: "backfill_required",
      driver: "persisted_lifecycle",
      summary: trimText(
        `Debugger write contract has no bounded persisted snapshot for ${anchorSummary}. Keep replay/recovery writes operator-visible on event-derived truth until the first persisted snapshot is backfilled.`,
        220,
      ),
      nextAction:
        input.persistedLifecycleTrace.nextAction ??
        writeSide.nextAction ??
        "Backfill the first bounded persisted lifecycle snapshot before using it as a recovery write anchor.",
    };
  }

  if (
    input.persistedLifecycleTrace.state === "fallback_to_event_truth" ||
    input.persistedLifecycleTrace.state === "refresh_required" ||
    writeSide.state === "refresh_required"
  ) {
    return {
      ...base,
      state: "refresh_required",
      driver: "persisted_lifecycle",
      summary: trimText(
        `Debugger write contract keeps ${anchorSummary} operator-visible, but persisted lifecycle is ${input.persistedLifecycleTrace.state} and the stored write-side state is ${writeSide.state}. Keep replay/resume/human-input recovery anchored to event-derived truth until the bounded snapshot is refreshed.`,
        220,
      ),
      nextAction:
        input.persistedLifecycleTrace.nextAction ??
        writeSide.nextAction ??
        "Refresh the persisted lifecycle snapshot before relying on the stored recovery write anchor.",
    };
  }

  if (writeSide.anchor === "resume") {
    return {
      ...base,
      state: "resume_active",
      driver: "resume",
      summary: trimText(
        `Debugger write contract keeps ${anchorSummary} as the current bounded recovery write anchor. Resume is ${input.runThread.resume.state}, replay is ${input.runThread.replayRequest.mode}, and trace contract stays ${input.traceContract.state}/${input.traceContract.driver}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        writeSide.nextAction ??
        `Keep replay and checkpoint review tied to ${checkpointKey ?? "the active resume anchor"}.`,
    };
  }

  if (writeSide.anchor === "human_input") {
    return {
      ...base,
      state: "human_input_active",
      driver: "human_input",
      summary: trimText(
        `Debugger write contract keeps ${anchorSummary} as the current bounded recovery write anchor. Human input stays ${input.runThread.humanInputCheckpoint.state}/${input.humanInputRequest.state}, replay stays ${input.runThread.replayRequest.mode}, and trace contract stays ${input.traceContract.state}/${input.traceContract.driver}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        input.runThread.humanInputCheckpoint.summary ??
        writeSide.nextAction,
    };
  }

  if (writeSide.anchor === "replay") {
    return {
      ...base,
      state: "replay_active",
      driver: "replay",
      summary: trimText(
        `Debugger write contract keeps ${anchorSummary} as the current bounded replay write anchor. Replay stays ${input.runThread.replayRequest.mode} across ${input.runThread.replay.eventLogEntries} event(s), while trace contract stays ${input.traceContract.state}/${input.traceContract.driver}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        writeSide.nextAction ??
        `Review replay on ${checkpointKey ?? "the current anchor"} before widening any recovery step.`,
    };
  }

  if (writeSide.anchor === "checkpoint") {
    return {
      ...base,
      state: "checkpoint_active",
      driver: "checkpoint",
      summary: trimText(
        `Debugger write contract keeps ${anchorSummary} as the current bounded checkpoint write anchor. Resume is ${input.runThread.resume.state}, replay is ${input.runThread.replayRequest.mode}, and trace contract stays ${input.traceContract.state}/${input.traceContract.driver}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        writeSide.nextAction ??
        `Keep replay, resume, and human input tied to ${checkpointKey ?? "the current checkpoint anchor"}.`,
    };
  }

  return {
    ...base,
    state: "observe",
    driver: "observe",
    summary: trimText(
      `Debugger write contract has no active bounded replay/recovery write anchor right now. Persisted lifecycle stays ${input.persistedLifecycleTrace.state}/${writeSide.state}, and operator should keep recovery state observable without widening execution authority.`,
      220,
    ),
    nextAction:
      input.traceContract.nextAction ??
      writeSide.nextAction ??
      "Keep event-derived truth operator-visible until a bounded checkpoint, replay, resume, or human-input anchor is written.",
  };
}

function buildOperatorDebuggerSwarmSpawnContract(input: {
  runThread: HelmV21RunThreadContract;
}): HelmV21OperatorDebuggerSwarmSpawnContract {
  const contract = input.runThread.swarmSpawnContract;
  const driver =
    contract.requestRecordState === "requested"
      ? "request_recorded"
      : contract.state === "blocked_flag"
      ? "workspace_flag"
      : contract.state === "blocked_budget"
        ? "budget_envelope"
        : contract.state === "blocked_policy"
          ? "run_thread_policy"
          : "admission_ready";

  return {
    state: contract.state,
    driver,
    requestRecordState: contract.requestRecordState,
    requestEventId: contract.requestEventId,
    taskClass: contract.taskClass,
    checkpointId: contract.checkpointId,
    checkpointKey: contract.checkpointKey,
    requestedAt: contract.requestedAt,
    requestedBy: contract.requestedBy,
    sourcePage: contract.sourcePage,
    workspaceFlagState: contract.workspaceFlagState,
    lifecycleState: contract.lifecycleState,
    budgetPosture: contract.budgetPosture,
    budgetEnvelopeState: contract.budgetEnvelopeState,
    requestState: contract.requestState,
    denyReason: contract.denyReason,
    denySummary: contract.denySummary,
    summary: trimText(
      `${contract.summary} Request ${contract.requestRecordState}; workspace flag ${contract.workspaceFlagState}; lifecycle ${contract.lifecycleState}; budget posture ${contract.budgetPosture}/${contract.budgetEnvelopeState}; deny ${contract.denyReason ?? "none"}.`,
      220,
    ),
    nextAction: contract.nextAction,
    boundaryNote:
      "Debugger swarm spawn contract stays admission-only and default-off in this layer. It does not fan out workers, auto-create nested agents, or widen execution authority.",
  };
}

function buildOperatorDebuggerSwarmReadOnlyWorkerContract(input: {
  runThread: HelmV21RunThreadContract;
}): HelmV21OperatorDebuggerSwarmReadOnlyWorkerContract {
  const contract = input.runThread.swarmReadOnlyWorkerContract;
  const driver =
    contract.executionLifecycleContract.driver === "admission_blocked"
      ? "spawn_blocked"
      : contract.executionLifecycleContract.driver === "recorded"
        ? "execution_recorded"
      : contract.executionLifecycleContract.driver === "recordable"
        ? "preflight_ready"
      : contract.executionLifecycleContract.driver === "placeholder_record_required"
        ? "intent_recorded"
        : contract.executionLifecycleContract.driver === "selection_required"
        ? "request_recorded"
        : "allowlist_ready";

  return {
    state: contract.state,
    driver,
    taskClass: contract.taskClass,
    requestState: contract.requestState,
    requestRecordState: contract.requestRecordState,
    requestEventId: contract.requestEventId,
    checkpointKey: contract.checkpointKey,
    requestedAt: contract.requestedAt,
    requestedBy: contract.requestedBy,
    sourcePage: contract.sourcePage,
    allowlistedWorkers: contract.allowlistedWorkers,
    artifactPolicy: contract.artifactPolicy,
    transcriptPolicy: contract.transcriptPolicy,
    requestLifecycleState: contract.requestLifecycleState,
    requestLifecycleSummary: contract.requestLifecycleSummary,
    handoffPreviewState: contract.handoffPreviewState,
    handoffPreviewSummary: contract.handoffPreviewSummary,
    previewPacketKeys: contract.previewPacketKeys,
    packetConsumptionIntentState: contract.packetConsumptionIntentState,
    packetConsumptionIntentSummary: contract.packetConsumptionIntentSummary,
    artifactBundlePlaceholderState: contract.artifactBundlePlaceholderState,
    artifactBundlePlaceholderSummary: contract.artifactBundlePlaceholderSummary,
    placeholderBundleKey: contract.placeholderBundleKey,
    placeholderBundleTitle: contract.placeholderBundleTitle,
    placeholderArtifactTypes: contract.placeholderArtifactTypes,
    handoffConsumptionState: contract.handoffConsumptionState,
    handoffConsumptionSummary: contract.handoffConsumptionSummary,
    handoffConsumerAgent: contract.handoffConsumerAgent,
    handoffConsumptionGoal: contract.handoffConsumptionGoal,
    executionRecordState: contract.executionRecordState,
    executionRecordSummary: contract.executionRecordSummary,
    executionEventId: contract.executionEventId,
    executionRecordedAt: contract.executionRecordedAt,
    executionRecordedBy: contract.executionRecordedBy,
    executionRecordSourcePage: contract.executionRecordSourcePage,
    artifactBundlePlaceholderRecordState: contract.artifactBundlePlaceholderRecordState,
    artifactBundlePlaceholderRecordSummary: contract.artifactBundlePlaceholderRecordSummary,
    handoffConsumptionRecordState: contract.handoffConsumptionRecordState,
    handoffConsumptionRecordSummary: contract.handoffConsumptionRecordSummary,
    placeholderRecordEventId: contract.placeholderRecordEventId,
    placeholderRecordedAt: contract.placeholderRecordedAt,
    placeholderRecordedBy: contract.placeholderRecordedBy,
    placeholderRecordSourcePage: contract.placeholderRecordSourcePage,
    executionPreflightState: contract.executionPreflightState,
    executionPreflightSummary: contract.executionPreflightSummary,
    executionGuardContract: contract.executionGuardContract,
    executionLifecycleContract: contract.executionLifecycleContract,
    executionCandidateContract: contract.executionCandidateContract,
    artifactMaterializationGuardContract: contract.artifactMaterializationGuardContract,
    artifactMaterializationRecordState: contract.artifactMaterializationRecordState,
    artifactMaterializationRecordSummary: contract.artifactMaterializationRecordSummary,
    artifactMaterializationEventId: contract.artifactMaterializationEventId,
    artifactMaterializedAt: contract.artifactMaterializedAt,
    artifactMaterializedBy: contract.artifactMaterializedBy,
    artifactMaterializationSourcePage: contract.artifactMaterializationSourcePage,
    artifactMaterializationLifecycleContract: contract.artifactMaterializationLifecycleContract,
    resultSideOutputContract: contract.resultSideOutputContract,
    resultSideOutputGuardContract: contract.resultSideOutputGuardContract,
    resultSideOutputLifecycleContract: contract.resultSideOutputLifecycleContract,
    outputConsumptionContract: contract.outputConsumptionContract,
    resultAdoptionContract: contract.resultAdoptionContract,
    outputAdoptionGuardContract: contract.outputAdoptionGuardContract,
    outputAdoptionRecordState: contract.outputAdoptionRecordState,
    outputAdoptionRecordSummary: contract.outputAdoptionRecordSummary,
    outputAdoptionEventId: contract.outputAdoptionEventId,
    outputAdoptedAt: contract.outputAdoptedAt,
    outputAdoptedBy: contract.outputAdoptedBy,
    outputAdoptionSourcePage: contract.outputAdoptionSourcePage,
    outputAdoptionLifecycleContract: contract.outputAdoptionLifecycleContract,
    resultAdoptionResultSideContract: contract.resultAdoptionResultSideContract,
    intentEventId: contract.intentEventId,
    selectedWorkerKind: contract.selectedWorkerKind,
    selectedPacketKey: contract.selectedPacketKey,
    selectedArtifactTypes: contract.selectedArtifactTypes,
    intentRecordedAt: contract.intentRecordedAt,
    intentRecordedBy: contract.intentRecordedBy,
    intentSourcePage: contract.intentSourcePage,
    lanePreviews: contract.lanePreviews,
    summary: trimText(
      `${contract.executionLifecycleContract.summary} ${contract.executionCandidateContract.summary} ${contract.artifactMaterializationGuardContract.summary} ${contract.artifactMaterializationLifecycleContract.summary} ${contract.resultSideOutputContract.summary} ${contract.resultSideOutputGuardContract.summary} ${contract.resultSideOutputLifecycleContract.summary} ${contract.outputConsumptionContract.summary} ${contract.resultAdoptionContract.summary} ${contract.outputAdoptionGuardContract.summary} ${contract.outputAdoptionRecordSummary} ${contract.outputAdoptionLifecycleContract.summary} ${contract.resultAdoptionResultSideContract.summary} ${contract.summary} Allowlist ${contract.allowlistedWorkers.join("/")}; artifact ${contract.artifactPolicy}; transcript ${contract.transcriptPolicy}; request lifecycle ${contract.requestLifecycleState}; handoff preview ${contract.handoffPreviewState}; packet intent ${contract.packetConsumptionIntentState}; bundle placeholder ${contract.artifactBundlePlaceholderState}; execution record ${contract.executionRecordState}; placeholder record ${contract.artifactBundlePlaceholderRecordState}; handoff consumption ${contract.handoffConsumptionState}; handoff record ${contract.handoffConsumptionRecordState}; execution lifecycle ${contract.executionLifecycleContract.state}; execution candidate ${contract.executionCandidateContract.state}/${contract.executionCandidateContract.driver}/${contract.executionCandidateContract.artifactMaterializationState}; materialization guard ${contract.artifactMaterializationGuardContract.state}; materialization record ${contract.artifactMaterializationRecordState}; materialization lifecycle ${contract.artifactMaterializationLifecycleContract.state}; result-side output ${contract.resultSideOutputContract.state}/${contract.resultSideOutputContract.driver}; output guard ${contract.resultSideOutputGuardContract.state}; output lifecycle ${contract.resultSideOutputLifecycleContract.state}/${contract.resultSideOutputLifecycleContract.driver}; output consumption ${contract.outputConsumptionContract.state}/${contract.outputConsumptionContract.driver}; result adoption ${contract.resultAdoptionContract.state}/${contract.resultAdoptionContract.driver}; adoption guard ${contract.outputAdoptionGuardContract.state}; adoption record ${contract.outputAdoptionRecordState}; adoption lifecycle ${contract.outputAdoptionLifecycleContract.state}/${contract.outputAdoptionLifecycleContract.driver}; adoption result-side ${contract.resultAdoptionResultSideContract.state}/${contract.resultAdoptionResultSideContract.driver}; execution preflight ${contract.executionPreflightState}; execution guard ${contract.executionGuardContract.state}; lane count ${contract.lanePreviews.length}.`,
      220,
    ),
    nextAction: contract.nextAction,
    boundaryNote:
      "Debugger read-only worker contract stays artifact-first and review-first in this layer. It does not execute fan-out, merge worker transcripts, or widen execution authority.",
  };
}

function buildOperatorDebuggerSwarmVerificationMergeLaneContract(input: {
  runThread: HelmV21RunThreadContract;
}): HelmV21OperatorDebuggerSwarmVerificationMergeLaneContract {
  return input.runThread.swarmVerificationMergeLaneContract;
}

function formatOperatorDebuggerRecoveryActionLabel(
  action: HelmV21OperatorDebuggerRecoveryActionContract["action"],
) {
  switch (action) {
    case "SAVE_RECOVERY_CHECKPOINT":
      return "save recovery checkpoint";
    case "RESUME_CHECKPOINT":
      return "resume checkpoint";
    case "REPRUNE_CONTEXT":
      return "re-prune context";
    default:
      return "observe the current recovery posture";
  }
}

function buildOperatorDebuggerRecoveryActionContract(input: {
  runThread: HelmV21RunThreadContract;
  recovery: OperatorDebuggerRecoveryState;
  remediationTrace: OperatorDebuggerRemediationEntry[];
  traceContract: HelmV21OperatorDebuggerTraceContract;
  writeContract: HelmV21OperatorDebuggerWriteContract;
  takeoverAssistance: HelmV21OperatorDebuggerTakeoverAssistance;
  takeoverRequest: HelmV21OperatorDebuggerTakeoverRequest;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  takeoverFollowThrough: HelmV21OperatorDebuggerTakeoverFollowThrough;
}): HelmV21OperatorDebuggerRecoveryActionContract {
  const latestRemediation = input.remediationTrace[0] ?? null;
  const latestRemediationAction =
    latestRemediation?.action === "SAVE_RECOVERY_CHECKPOINT" ||
    latestRemediation?.action === "RESUME_CHECKPOINT" ||
    latestRemediation?.action === "REPRUNE_CONTEXT"
      ? latestRemediation.action
      : null;
  const action =
    input.takeoverFollowThrough.action ??
    input.takeoverActivation.action ??
    input.takeoverRequest.action ??
    input.takeoverAssistance.recommendedAction ??
    latestRemediationAction;
  const checkpointId =
    input.takeoverFollowThrough.checkpointId ??
    input.takeoverActivation.checkpointId ??
    input.takeoverRequest.checkpointId ??
    input.writeContract.checkpointId ??
    input.traceContract.checkpointId;
  const checkpointKey =
    input.takeoverFollowThrough.checkpointKey ??
    input.takeoverActivation.checkpointKey ??
    input.takeoverRequest.checkpointKey ??
    input.writeContract.checkpointKey ??
    input.traceContract.checkpointKey;
  const resumeToken =
    input.takeoverFollowThrough.resumeToken ??
    input.takeoverActivation.resumeToken ??
    input.takeoverRequest.resumeToken ??
    input.writeContract.resumeToken ??
    input.traceContract.resumeToken;
  const base = {
    action,
    checkpointId,
    checkpointKey,
    resumeToken,
    recoveryState: input.recovery.state,
    failureTaxonomy: input.recovery.failureTaxonomy,
    traceContractState: input.traceContract.state,
    writeContractState: input.writeContract.state,
    takeoverRequestState: input.takeoverRequest.state,
    takeoverActivationState: input.takeoverActivation.state,
    takeoverFollowThroughState: input.takeoverFollowThrough.state,
    latestRemediationEventId: latestRemediation?.id ?? null,
    latestRemediationExecutionStatus:
      latestRemediation?.executionStatus === "APPLIED" ||
      latestRemediation?.executionStatus === "REVIEW_REQUIRED" ||
      latestRemediation?.executionStatus === "BLOCKED"
        ? latestRemediation.executionStatus
        : null,
    latestRemediationTriggeredBy: latestRemediation?.triggeredBy ?? null,
    latestRemediationAt: latestRemediation?.createdAt ?? null,
    boundaryNote:
      "Debugger recovery action contract stays read-only and review-first. It explains the current bounded replay/recovery lifecycle, but it does not auto-run replay, resume, or context repair.",
  } as const;

  if (input.takeoverFollowThrough.state === "open") {
    return {
      ...base,
      state: "followthrough_open",
      driver: "takeover_followthrough",
      summary: trimText(
        input.takeoverFollowThrough.summary ||
          `Debugger recovery action follow-through remains open for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction: input.takeoverFollowThrough.nextAction,
    };
  }

  if (input.takeoverFollowThrough.state === "requestable") {
    return {
      ...base,
      state: "followthrough_requestable",
      driver: "takeover_followthrough",
      summary: trimText(
        input.takeoverFollowThrough.summary ||
          `Debugger recovery action follow-through can now be requested for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction: input.takeoverFollowThrough.nextAction,
    };
  }

  if (input.takeoverFollowThrough.state === "resolved") {
    return {
      ...base,
      state: "followthrough_resolved",
      driver: "takeover_followthrough",
      summary: trimText(
        input.takeoverFollowThrough.summary ||
          `Debugger recovery action follow-through has been resolved for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction: input.takeoverFollowThrough.nextAction,
    };
  }

  if (input.takeoverActivation.state === "active") {
    return {
      ...base,
      state: "active",
      driver: "takeover_activation",
      summary: trimText(
        input.takeoverActivation.summary ||
          `Debugger recovery action is currently active for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        input.writeContract.nextAction ??
        `Keep ${formatOperatorDebuggerRecoveryActionLabel(action)} tied to ${checkpointKey ?? "the current thread anchor"} until review closes.`,
    };
  }

  if (input.takeoverRequest.state === "acknowledged") {
    return {
      ...base,
      state: "acknowledged",
      driver: "takeover_request",
      summary: trimText(
        input.takeoverRequest.summary ||
          `Debugger recovery action is acknowledged for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        `Start the bounded recovery action on ${checkpointKey ?? "the current thread anchor"} only after operator review confirms it.`,
    };
  }

  if (input.takeoverRequest.state === "requested") {
    return {
      ...base,
      state: "requested",
      driver: "takeover_request",
      summary: trimText(
        input.takeoverRequest.summary ||
          `Debugger recovery action request is already recorded for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        `Acknowledge the bounded recovery request on ${checkpointKey ?? "the current thread anchor"} before execution review continues.`,
    };
  }

  if (
    input.traceContract.state === "backfill_required" ||
    input.writeContract.state === "backfill_required"
  ) {
    return {
      ...base,
      state: "backfill_required",
      driver: "persisted_lifecycle",
      summary: trimText(
        `Debugger recovery action contract cannot advance because the first bounded persisted lifecycle snapshot is still missing for ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction:
        input.writeContract.nextAction ??
        input.traceContract.nextAction ??
        "Backfill the first bounded persisted lifecycle snapshot before recovery action can be advanced.",
    };
  }

  if (
    input.traceContract.state === "refresh_required" ||
    input.writeContract.state === "refresh_required"
  ) {
    return {
      ...base,
      state: "refresh_required",
      driver: "persisted_lifecycle",
      summary: trimText(
        `Debugger recovery action contract keeps ${formatOperatorDebuggerRecoveryActionLabel(action)} tied to ${checkpointKey ?? "the current thread anchor"}, but persisted lifecycle still requires refresh before the next bounded recovery step is trusted.`,
        220,
      ),
      nextAction:
        input.writeContract.nextAction ??
        input.traceContract.nextAction ??
        "Refresh the persisted lifecycle snapshot before advancing the bounded recovery path.",
    };
  }

  if (input.recovery.state === "BLOCKED") {
    return {
      ...base,
      state: "blocked",
      driver: "recovery",
      summary: trimText(input.recovery.summary, 220),
      nextAction:
        input.recovery.blockedReasons[0] ??
        input.traceContract.nextAction ??
        input.writeContract.nextAction,
    };
  }

  if (input.recovery.state === "REVIEW_REQUIRED") {
    return {
      ...base,
      state: "review_required",
      driver: "recovery",
      summary: trimText(`${input.recovery.summary} ${input.recovery.operatorAction}`, 220),
      nextAction:
        input.recovery.reviewReasons[0] ??
        input.traceContract.nextAction ??
        input.writeContract.nextAction,
    };
  }

  if (input.takeoverRequest.state === "requestable" && action !== null) {
    return {
      ...base,
      state: "requestable",
      driver: "takeover_request",
      summary: trimText(
        input.takeoverRequest.summary ||
          `Debugger recovery action can now be requested for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction:
        input.traceContract.nextAction ??
        `Request bounded operator takeover for ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"}.`,
    };
  }

  if (base.latestRemediationExecutionStatus === "APPLIED") {
    return {
      ...base,
      state: "applied",
      driver: "remediation_trace",
      summary: trimText(
        latestRemediation?.summary ||
          `Latest bounded recovery action ${formatOperatorDebuggerRecoveryActionLabel(action)} was applied on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction:
        input.takeoverFollowThrough.nextAction ??
        input.traceContract.nextAction ??
        input.writeContract.nextAction,
    };
  }

  return {
    ...base,
    state: "observe",
    driver: "observe",
    summary: trimText(
      `Debugger recovery action contract is currently observing ${formatOperatorDebuggerRecoveryActionLabel(action)} on ${checkpointKey ?? "the current thread anchor"} without an open bounded recovery step.`,
      220,
    ),
    nextAction:
      input.takeoverFollowThrough.nextAction ??
      input.traceContract.nextAction ??
      input.writeContract.nextAction,
  };
}

function buildOperatorDebuggerRecoveryLifecycleContract(input: {
  traceContract: HelmV21OperatorDebuggerTraceContract;
  writeContract: HelmV21OperatorDebuggerWriteContract;
  recoveryActionContract: HelmV21OperatorDebuggerRecoveryActionContract;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
}): HelmV21OperatorDebuggerRecoveryLifecycleContract {
  const anchor =
    input.writeContract.writeAnchor !== "none"
      ? input.writeContract.writeAnchor
      : input.traceContract.anchor;
  const checkpointId =
    input.recoveryActionContract.checkpointId ??
    input.writeContract.checkpointId ??
    input.traceContract.checkpointId;
  const checkpointKey =
    input.recoveryActionContract.checkpointKey ??
    input.writeContract.checkpointKey ??
    input.traceContract.checkpointKey;
  const resumeToken =
    input.recoveryActionContract.resumeToken ??
    input.writeContract.resumeToken ??
    input.traceContract.resumeToken;
  const actionLabel = formatOperatorDebuggerRecoveryActionLabel(
    input.recoveryActionContract.action,
  );
  const anchorSummary =
    anchor === "resume"
      ? `resume anchor ${checkpointKey ?? "on the current thread"}`
      : anchor === "human_input"
        ? `human input anchor ${checkpointKey ?? "on the current thread"}`
        : anchor === "replay"
          ? `replay anchor ${checkpointKey ?? "on the current thread"}`
          : anchor === "checkpoint"
            ? `checkpoint anchor ${checkpointKey ?? "on the current thread"}`
            : "the current thread without a bounded anchor";
  const base = {
    anchor,
    action: input.recoveryActionContract.action,
    checkpointId,
    checkpointKey,
    resumeToken,
    traceContractState: input.traceContract.state,
    writeContractState: input.writeContract.state,
    recoveryActionState: input.recoveryActionContract.state,
    takeoverRequestState: input.recoveryActionContract.takeoverRequestState,
    takeoverActivationState: input.recoveryActionContract.takeoverActivationState,
    takeoverFollowThroughState: input.recoveryActionContract.takeoverFollowThroughState,
    latestRemediationExecutionStatus:
      input.recoveryActionContract.latestRemediationExecutionStatus,
    boundaryNote:
      "Debugger recovery lifecycle contract stays read-only and review-first. It compresses trace, write, request, activation, and follow-through posture into one bounded recovery lane, but it does not create a replay engine or widen authority.",
  } as const;

  if (input.recoveryActionContract.state === "backfill_required") {
    return {
      ...base,
      state: "backfill_required",
      driver: "persisted_lifecycle",
      nextTransition: "backfill_snapshot",
      summary: trimText(
        `Debugger recovery lifecycle is blocked at the materialization lane because the first bounded persisted snapshot is still missing for ${anchorSummary}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "refresh_required") {
    return {
      ...base,
      state: "refresh_required",
      driver: "persisted_lifecycle",
      nextTransition: "refresh_snapshot",
      summary: trimText(
        `Debugger recovery lifecycle remains anchored to ${anchorSummary}, but persisted lifecycle still requires refresh before the next bounded recovery move is trusted.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "blocked") {
    return {
      ...base,
      state: "blocked",
      driver: "recovery",
      nextTransition: "review_recovery",
      summary: trimText(
        `Debugger recovery lifecycle is blocked on ${anchorSummary} for ${actionLabel}. ${input.recoveryActionContract.summary}`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "review_required") {
    return {
      ...base,
      state: "review_required",
      driver: "recovery",
      nextTransition: "review_recovery",
      summary: trimText(
        `Debugger recovery lifecycle needs review on ${anchorSummary} before ${actionLabel} advances. ${input.recoveryActionContract.summary}`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "requestable") {
    return {
      ...base,
      state: "request_lane",
      driver: "takeover_request",
      nextTransition: "request_takeover",
      summary: trimText(
        `Debugger recovery lifecycle is on the request lane for ${actionLabel} at ${anchorSummary}. No bounded takeover request has been recorded yet.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "requested") {
    return {
      ...base,
      state: "request_lane",
      driver: "takeover_request",
      nextTransition: "acknowledge_takeover",
      summary: trimText(
        `Debugger recovery lifecycle is on the request lane for ${actionLabel} at ${anchorSummary}. A bounded takeover request already exists and is waiting for acknowledgement.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "acknowledged") {
    return {
      ...base,
      state: "request_lane",
      driver: "takeover_request",
      nextTransition: "start_takeover",
      summary: trimText(
        `Debugger recovery lifecycle is still on the request lane for ${actionLabel} at ${anchorSummary}. The bounded request is acknowledged and is waiting for an explicit start.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "active") {
    return {
      ...base,
      state: "activation_lane",
      driver: "takeover_activation",
      nextTransition: "release_takeover",
      summary: trimText(
        `Debugger recovery lifecycle is on the activation lane for ${actionLabel} at ${anchorSummary}. Current owner is ${input.takeoverActivation.currentOwner ?? "the operator"}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "followthrough_requestable") {
    return {
      ...base,
      state: "followthrough_lane",
      driver: "takeover_followthrough",
      nextTransition: "request_followthrough",
      summary: trimText(
        `Debugger recovery lifecycle has left active control and is on the follow-through lane for ${actionLabel} at ${anchorSummary}. Follow-through can now be requested.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "followthrough_open") {
    return {
      ...base,
      state: "followthrough_lane",
      driver: "takeover_followthrough",
      nextTransition: "resolve_followthrough",
      summary: trimText(
        `Debugger recovery lifecycle is on the open follow-through lane for ${actionLabel} at ${anchorSummary}. Resolution is still pending.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "followthrough_resolved") {
    return {
      ...base,
      state: "followthrough_lane",
      driver: "takeover_followthrough",
      nextTransition: "observe",
      summary: trimText(
        `Debugger recovery lifecycle has resolved follow-through for ${actionLabel} at ${anchorSummary} and is ready to fall back to steady observation.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "applied") {
    return {
      ...base,
      state: "applied",
      driver: "remediation_trace",
      nextTransition: "observe",
      summary: trimText(
        `Debugger recovery lifecycle records ${actionLabel} as applied at ${anchorSummary}. The bounded recovery move is complete and can return to observation unless new review opens.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  return {
    ...base,
    state: "observe",
    driver: "observe",
    nextTransition: "observe",
    summary: trimText(
      `Debugger recovery lifecycle is currently observing ${actionLabel} at ${anchorSummary} without an open bounded recovery step.`,
      220,
    ),
    nextAction: input.recoveryActionContract.nextAction,
  };
}

function buildOperatorDebuggerRecoveryTransitionContract(input: {
  recoveryActionContract: HelmV21OperatorDebuggerRecoveryActionContract;
  recoveryLifecycleContract: HelmV21OperatorDebuggerRecoveryLifecycleContract;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
}): HelmV21OperatorDebuggerRecoveryTransitionContract {
  const base = {
    driver: input.recoveryLifecycleContract.driver,
    laneState: input.recoveryLifecycleContract.state,
    anchor: input.recoveryLifecycleContract.anchor,
    action: input.recoveryLifecycleContract.action,
    checkpointId: input.recoveryLifecycleContract.checkpointId,
    checkpointKey: input.recoveryLifecycleContract.checkpointKey,
    resumeToken: input.recoveryLifecycleContract.resumeToken,
    transition: input.recoveryLifecycleContract.nextTransition,
    traceContractState: input.recoveryLifecycleContract.traceContractState,
    writeContractState: input.recoveryLifecycleContract.writeContractState,
    recoveryActionState: input.recoveryLifecycleContract.recoveryActionState,
    recoveryLifecycleState: input.recoveryLifecycleContract.state,
    takeoverRequestState: input.recoveryLifecycleContract.takeoverRequestState,
    takeoverActivationState: input.recoveryLifecycleContract.takeoverActivationState,
    takeoverFollowThroughState:
      input.recoveryLifecycleContract.takeoverFollowThroughState,
    latestRemediationExecutionStatus:
      input.recoveryLifecycleContract.latestRemediationExecutionStatus,
    boundaryNote:
      "Debugger recovery transition contract stays read-only and review-first. It makes the bounded recovery transition posture explicit, but it does not create a replay engine or widen authority.",
  } as const;

  if (input.recoveryActionContract.state === "backfill_required") {
    return {
      ...base,
      state: "backfill_required",
      summary: trimText(
        `Debugger recovery transition is blocked at snapshot backfill for ${input.recoveryLifecycleContract.anchor === "none" ? "the current thread" : `${input.recoveryLifecycleContract.anchor} anchor ${input.recoveryLifecycleContract.checkpointKey ?? "on the current thread"}`}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "refresh_required") {
    return {
      ...base,
      state: "refresh_required",
      summary: trimText(
        `Debugger recovery transition remains on ${input.recoveryLifecycleContract.anchor === "none" ? "the current thread" : `${input.recoveryLifecycleContract.anchor} anchor ${input.recoveryLifecycleContract.checkpointKey ?? "on the current thread"}`}, but persisted lifecycle still requires refresh before ${input.recoveryLifecycleContract.nextTransition} is trusted.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "blocked") {
    return {
      ...base,
      state: "blocked",
      summary: trimText(
        `Debugger recovery transition is blocked before ${input.recoveryLifecycleContract.nextTransition} for ${formatOperatorDebuggerRecoveryActionLabel(input.recoveryActionContract.action)}. ${input.recoveryActionContract.summary}`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "review_required") {
    return {
      ...base,
      state: "review_required",
      summary: trimText(
        `Debugger recovery transition still needs review before ${input.recoveryLifecycleContract.nextTransition} can advance for ${formatOperatorDebuggerRecoveryActionLabel(input.recoveryActionContract.action)}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (
    input.recoveryActionContract.state === "requestable" ||
    input.recoveryActionContract.state === "acknowledged" ||
    input.recoveryActionContract.state === "followthrough_requestable"
  ) {
    return {
      ...base,
      state: "transition_ready",
      summary: trimText(
        `Debugger recovery transition is ready for ${input.recoveryLifecycleContract.nextTransition} on ${input.recoveryLifecycleContract.anchor === "none" ? "the current thread" : `${input.recoveryLifecycleContract.anchor} anchor ${input.recoveryLifecycleContract.checkpointKey ?? "on the current thread"}`}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (
    input.recoveryActionContract.state === "requested" ||
    input.recoveryActionContract.state === "followthrough_open"
  ) {
    return {
      ...base,
      state: "transition_pending",
      summary: trimText(
        `Debugger recovery transition is pending on ${input.recoveryLifecycleContract.nextTransition} for ${input.recoveryLifecycleContract.anchor === "none" ? "the current thread" : `${input.recoveryLifecycleContract.anchor} anchor ${input.recoveryLifecycleContract.checkpointKey ?? "on the current thread"}`}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (input.recoveryActionContract.state === "active") {
    return {
      ...base,
      state: "transition_active",
      summary: trimText(
        `Debugger recovery transition is active on ${input.recoveryLifecycleContract.nextTransition} for ${input.recoveryLifecycleContract.anchor === "none" ? "the current thread" : `${input.recoveryLifecycleContract.anchor} anchor ${input.recoveryLifecycleContract.checkpointKey ?? "on the current thread"}`}. Current owner is ${input.takeoverActivation.currentOwner ?? "the operator"}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  if (
    input.recoveryActionContract.state === "followthrough_resolved" ||
    input.recoveryActionContract.state === "applied"
  ) {
    return {
      ...base,
      state: "transition_resolved",
      summary: trimText(
        `Debugger recovery transition has resolved ${input.recoveryLifecycleContract.nextTransition} for ${input.recoveryLifecycleContract.anchor === "none" ? "the current thread" : `${input.recoveryLifecycleContract.anchor} anchor ${input.recoveryLifecycleContract.checkpointKey ?? "on the current thread"}`}.`,
        220,
      ),
      nextAction: input.recoveryActionContract.nextAction,
    };
  }

  return {
    ...base,
    state: "observe",
    summary: trimText(
      `Debugger recovery transition is currently observing ${input.recoveryLifecycleContract.nextTransition} on ${input.recoveryLifecycleContract.anchor === "none" ? "the current thread" : `${input.recoveryLifecycleContract.anchor} anchor ${input.recoveryLifecycleContract.checkpointKey ?? "on the current thread"}`}.`,
      220,
    ),
    nextAction: input.recoveryActionContract.nextAction,
  };
}

function buildOperatorDebuggerRecoveryStateMachineContract(input: {
  recoveryTransitionContract: HelmV21OperatorDebuggerRecoveryTransitionContract;
  takeoverRequest: HelmV21OperatorDebuggerTakeoverRequest;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  takeoverFollowThrough: HelmV21OperatorDebuggerTakeoverFollowThrough;
}): HelmV21OperatorDebuggerRecoveryStateMachineContract {
  const phase =
    input.recoveryTransitionContract.transition === "backfill_snapshot" ||
    input.recoveryTransitionContract.transition === "refresh_snapshot"
      ? "materialization"
      : input.recoveryTransitionContract.transition === "review_recovery"
        ? "review"
        : input.recoveryTransitionContract.transition === "request_takeover" ||
            input.recoveryTransitionContract.transition === "acknowledge_takeover"
          ? "takeover_request"
          : input.recoveryTransitionContract.transition === "start_takeover" ||
              input.recoveryTransitionContract.transition === "release_takeover"
            ? "takeover_activation"
            : input.recoveryTransitionContract.transition === "request_followthrough" ||
                input.recoveryTransitionContract.transition === "resolve_followthrough"
              ? "takeover_followthrough"
              : "observe";

  const transitionState =
    input.recoveryTransitionContract.state === "backfill_required" ||
    input.recoveryTransitionContract.state === "refresh_required" ||
    input.recoveryTransitionContract.state === "review_required"
      ? "required"
      : input.recoveryTransitionContract.state === "blocked"
        ? "blocked"
        : input.recoveryTransitionContract.state === "transition_ready"
          ? "ready"
          : input.recoveryTransitionContract.state === "transition_pending"
            ? "pending"
            : input.recoveryTransitionContract.state === "transition_active"
              ? "active"
              : input.recoveryTransitionContract.state === "transition_resolved"
                ? "resolved"
                : "observe";

  const allowedTransitions =
    transitionState === "observe"
      ? []
      : [input.recoveryTransitionContract.transition];

  const completedTransitions: HelmV21OperatorDebuggerRecoveryLifecycleContract["nextTransition"][] = [];
  if (input.takeoverRequest.requestEventId) {
    completedTransitions.push("request_takeover");
  }
  if (input.takeoverRequest.acknowledgementEventId) {
    completedTransitions.push("acknowledge_takeover");
  }
  if (input.takeoverActivation.startEventId) {
    completedTransitions.push("start_takeover");
  }
  if (input.takeoverActivation.releaseEventId) {
    completedTransitions.push("release_takeover");
  }
  if (input.takeoverFollowThrough.requestEventId) {
    completedTransitions.push("request_followthrough");
  }
  if (input.takeoverFollowThrough.resolutionEventId) {
    completedTransitions.push("resolve_followthrough");
  }
  if (input.recoveryTransitionContract.state === "transition_resolved") {
    completedTransitions.push("observe");
  }

  const uniqueCompletedTransitions = Array.from(new Set(completedTransitions));
  const anchorSummary =
    input.recoveryTransitionContract.anchor === "none"
      ? "the current thread"
      : `${input.recoveryTransitionContract.anchor} anchor ${input.recoveryTransitionContract.checkpointKey ?? "on the current thread"}`;
  const completedSummary = uniqueCompletedTransitions.length
    ? uniqueCompletedTransitions.join(" -> ")
    : "none";

  return {
    phase,
    transitionState,
    currentTransition: input.recoveryTransitionContract.transition,
    allowedTransitions,
    completedTransitions: uniqueCompletedTransitions,
    driver: input.recoveryTransitionContract.driver,
    anchor: input.recoveryTransitionContract.anchor,
    action: input.recoveryTransitionContract.action,
    checkpointId: input.recoveryTransitionContract.checkpointId,
    checkpointKey: input.recoveryTransitionContract.checkpointKey,
    resumeToken: input.recoveryTransitionContract.resumeToken,
    traceContractState: input.recoveryTransitionContract.traceContractState,
    writeContractState: input.recoveryTransitionContract.writeContractState,
    recoveryActionState: input.recoveryTransitionContract.recoveryActionState,
    recoveryLifecycleState: input.recoveryTransitionContract.recoveryLifecycleState,
    recoveryTransitionState: input.recoveryTransitionContract.state,
    takeoverRequestState: input.recoveryTransitionContract.takeoverRequestState,
    takeoverActivationState: input.recoveryTransitionContract.takeoverActivationState,
    takeoverFollowThroughState: input.recoveryTransitionContract.takeoverFollowThroughState,
    latestRemediationExecutionStatus:
      input.recoveryTransitionContract.latestRemediationExecutionStatus,
    summary: trimText(
      `Debugger recovery state machine is in ${phase} phase on ${anchorSummary}. Current transition ${input.recoveryTransitionContract.transition} is ${transitionState}; completed bounded transitions: ${completedSummary}. ${input.recoveryTransitionContract.summary}`,
      220,
    ),
    nextAction: input.recoveryTransitionContract.nextAction,
    boundaryNote:
      "Debugger recovery state machine stays read-only and review-first. It makes the bounded recovery phases and transitions explicit, but it does not create a replay engine or widen authority.",
  };
}

function buildOperatorDebuggerRecoveryExecutionContract(input: {
  recoveryStateMachineContract: HelmV21OperatorDebuggerRecoveryStateMachineContract;
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
}): HelmV21OperatorDebuggerRecoveryExecutionContract {
  const anchorSummary =
    input.recoveryStateMachineContract.anchor === "none"
      ? "the current thread"
      : `${input.recoveryStateMachineContract.anchor} anchor ${input.recoveryStateMachineContract.checkpointKey ?? "on the current thread"}`;
  const actionLabel = formatOperatorDebuggerRecoveryActionLabel(
    input.recoveryStateMachineContract.action,
  );
  const base = {
    phase: input.recoveryStateMachineContract.phase,
    driver: input.recoveryStateMachineContract.driver,
    anchor: input.recoveryStateMachineContract.anchor,
    action: input.recoveryStateMachineContract.action,
    currentTransition: input.recoveryStateMachineContract.currentTransition,
    transitionState: input.recoveryStateMachineContract.transitionState,
    currentOwner: input.takeoverActivation.currentOwner,
    checkpointId: input.recoveryStateMachineContract.checkpointId,
    checkpointKey: input.recoveryStateMachineContract.checkpointKey,
    resumeToken: input.recoveryStateMachineContract.resumeToken,
    traceContractState: input.recoveryStateMachineContract.traceContractState,
    writeContractState: input.recoveryStateMachineContract.writeContractState,
    recoveryActionState: input.recoveryStateMachineContract.recoveryActionState,
    recoveryLifecycleState: input.recoveryStateMachineContract.recoveryLifecycleState,
    recoveryTransitionState: input.recoveryStateMachineContract.recoveryTransitionState,
    latestRemediationExecutionStatus:
      input.recoveryStateMachineContract.latestRemediationExecutionStatus,
    nextAction: input.recoveryStateMachineContract.nextAction,
    boundaryNote:
      "Debugger recovery execution contract stays review-first and bounded. It makes execution readiness, prerequisites, and completion criteria explicit, but it does not create a replay engine or widen authority.",
  } as const;

  const snapshotMaterializedCriteria = [
    "bounded persisted snapshot is present for the current thread",
    "persisted lifecycle alignment returns to synced or aligned state",
  ];
  const reviewCriteria = [
    "blocked or review-required recovery posture is explicitly reviewed",
    "next bounded transition is re-evaluated after review closes",
  ];
  const requestCriteria = [
    "operator takeover request is recorded on the runtime event ledger",
    "request uses the current bounded recovery anchor",
  ];
  const acknowledgementCriteria = [
    "takeover acknowledgement is recorded for the current bounded request",
    "the state machine can advance to explicit takeover start",
  ];
  const startCriteria = [
    "takeover start is recorded on the runtime event ledger",
    "current owner becomes active for the bounded recovery move",
  ];
  const releaseCriteria = [
    "active control is explicitly released by the current owner",
    "release reason is captured before follow-through opens",
  ];
  const followThroughRequestCriteria = [
    "follow-through request is recorded after takeover release",
    "the bounded recovery move stays review-visible until resolution",
  ];
  const followThroughResolutionCriteria = [
    "follow-through resolution is recorded on the runtime event ledger",
    "the bounded recovery move can fall back to observe or applied state",
  ];

  if (
    input.recoveryStateMachineContract.transitionState === "required" &&
    input.recoveryStateMachineContract.currentTransition === "backfill_snapshot"
  ) {
    return {
      ...base,
      state: "backfill_required",
      canExecute: false,
      requiresReview: false,
      prerequisites: [
        "first bounded persisted snapshot has not been written yet",
        "event truth must be materialized before bounded recovery execution is trusted",
      ],
      completionCriteria: snapshotMaterializedCriteria,
      summary: trimText(
        `Debugger recovery execution is blocked at snapshot backfill for ${anchorSummary}. No bounded execution move should start until the first persisted snapshot exists.`,
        220,
      ),
    };
  }

  if (
    input.recoveryStateMachineContract.transitionState === "required" &&
    input.recoveryStateMachineContract.currentTransition === "refresh_snapshot"
  ) {
    return {
      ...base,
      state: "refresh_required",
      canExecute: false,
      requiresReview: false,
      prerequisites: [
        "persisted lifecycle drift must be refreshed before the next bounded recovery move is trusted",
        "write-side anchor and event truth must realign before execution continues",
      ],
      completionCriteria: snapshotMaterializedCriteria,
      summary: trimText(
        `Debugger recovery execution is held on refresh for ${anchorSummary}. Persisted lifecycle must realign before ${actionLabel} can advance.`,
        220,
      ),
    };
  }

  if (
    input.recoveryStateMachineContract.transitionState === "required" &&
    input.recoveryStateMachineContract.currentTransition === "review_recovery"
  ) {
    return {
      ...base,
      state: "review_required",
      canExecute: false,
      requiresReview: true,
      prerequisites: [
        "operator review must explicitly clear the current recovery posture before execution resumes",
      ],
      completionCriteria: reviewCriteria,
      summary: trimText(
        `Debugger recovery execution is review-gated on ${anchorSummary} for ${actionLabel}. Review must close before the next bounded move is executable.`,
        220,
      ),
    };
  }

  if (input.recoveryStateMachineContract.transitionState === "required") {
    return {
      ...base,
      state: "review_required",
      canExecute: false,
      requiresReview: true,
      prerequisites: ["current bounded recovery posture still requires explicit review"],
      completionCriteria: reviewCriteria,
      summary: trimText(
        `Debugger recovery execution still requires explicit review on ${anchorSummary} before ${actionLabel} can advance.`,
        220,
      ),
    };
  }

  if (input.recoveryStateMachineContract.transitionState === "blocked") {
    return {
      ...base,
      state: "blocked",
      canExecute: false,
      requiresReview: true,
      prerequisites: [
        "blocked recovery reason must be cleared before the bounded move can execute",
      ],
      completionCriteria: reviewCriteria,
      summary: trimText(
        `Debugger recovery execution is blocked on ${anchorSummary} for ${actionLabel}. The bounded move cannot execute until the blocking condition is resolved.`,
        220,
      ),
    };
  }

  if (input.recoveryStateMachineContract.transitionState === "ready") {
    const completionCriteria =
      input.recoveryStateMachineContract.currentTransition === "request_takeover"
        ? requestCriteria
        : input.recoveryStateMachineContract.currentTransition === "start_takeover"
          ? startCriteria
          : input.recoveryStateMachineContract.currentTransition === "request_followthrough"
            ? followThroughRequestCriteria
            : reviewCriteria;
    return {
      ...base,
      state: "executable",
      canExecute: true,
      requiresReview: false,
      prerequisites: [
        `bounded recovery anchor is available on ${anchorSummary}`,
        `current transition ${input.recoveryStateMachineContract.currentTransition} is explicitly ready`,
      ],
      completionCriteria,
      summary: trimText(
        `Debugger recovery execution is ready for ${input.recoveryStateMachineContract.currentTransition} on ${anchorSummary}. ${actionLabel} remains bounded and review-first.`,
        220,
      ),
    };
  }

  if (input.recoveryStateMachineContract.transitionState === "pending") {
    const completionCriteria =
      input.recoveryStateMachineContract.currentTransition === "acknowledge_takeover"
        ? acknowledgementCriteria
        : input.recoveryStateMachineContract.currentTransition === "resolve_followthrough"
          ? followThroughResolutionCriteria
          : reviewCriteria;
    return {
      ...base,
      state: "pending",
      canExecute: true,
      requiresReview: false,
      prerequisites: [
        `bounded transition ${input.recoveryStateMachineContract.currentTransition} is open on ${anchorSummary}`,
        "the outstanding review-safe action must be explicitly recorded on the runtime event ledger",
      ],
      completionCriteria,
      summary: trimText(
        `Debugger recovery execution is pending on ${input.recoveryStateMachineContract.currentTransition} for ${anchorSummary}. The bounded move can execute as soon as the outstanding action is recorded.`,
        220,
      ),
    };
  }

  if (input.recoveryStateMachineContract.transitionState === "active") {
    return {
      ...base,
      state: "active",
      canExecute: false,
      requiresReview: false,
      prerequisites: [
        `current owner ${input.takeoverActivation.currentOwner ?? "the operator"} must finish the active takeover work before release`,
      ],
      completionCriteria: releaseCriteria,
      summary: trimText(
        `Debugger recovery execution is active on ${anchorSummary} for ${actionLabel}. Active control is in progress and must be explicitly released before follow-through can advance.`,
        220,
      ),
    };
  }

  if (input.recoveryStateMachineContract.transitionState === "resolved") {
    return {
      ...base,
      state: "applied",
      canExecute: false,
      requiresReview: false,
      prerequisites: [
        "bounded recovery follow-through has already resolved for the current anchor",
      ],
      completionCriteria: [
        "operator only observes until a new bounded recovery need reopens",
      ],
      summary: trimText(
        `Debugger recovery execution has already resolved on ${anchorSummary} for ${actionLabel}. No further bounded execution step is open right now.`,
        220,
      ),
    };
  }

  return {
    ...base,
    state: "observe",
    canExecute: false,
    requiresReview: false,
    prerequisites: ["no bounded recovery transition is currently open"],
    completionCriteria: ["continue observing until a bounded recovery step reopens"],
    summary: trimText(
      `Debugger recovery execution is currently observing ${anchorSummary} for ${actionLabel} without an open bounded execution step.`,
      220,
    ),
  };
}

function buildTakeoverChecklist(input: BuildOperatorDebuggerReadModelInput): string[] {
  const checkpointAnchor =
    input.runThread.humanInputCheckpoint.checkpointKey ??
    input.runThread.latestCheckpoint?.checkpointKey ??
    "no-checkpoint";

  return [
    input.recovery.reviewReasons[0]
      ? `Review posture: ${input.recovery.reviewReasons[0]}`
      : null,
    input.notebookState.blockers[0]
      ? `Confirm blocker against ${checkpointAnchor}: ${input.notebookState.blockers[0]}`
      : null,
    input.notebookState.nextActions[0]
      ? `Keep next action operator-owned until review closes: ${input.notebookState.nextActions[0]}`
      : null,
    input.notebookState.openQuestions[0]
      ? `Capture human input on ${checkpointAnchor}: ${input.notebookState.openQuestions[0]}`
      : null,
    input.verification?.blockedReasons[0]
      ? `Verification still flags: ${input.verification.blockedReasons[0]}`
      : null,
    input.runThread.humanInputCheckpoint.summary,
  ]
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
}

export function buildOperatorDebuggerReplayAssistance(
  input: Pick<BuildOperatorDebuggerReadModelInput, "runThread" | "replay">,
): HelmV21OperatorDebuggerReplayAssistance {
  if (!input.replay) {
    return {
      fidelity: "none",
      checkpointKey: input.runThread.replayRequest.checkpointKey,
      resumeToken: input.runThread.replayRequest.resumeToken,
      eventLogEntries: input.runThread.replay.eventLogEntries,
      summary: input.runThread.replayRequest.replaySummary,
      boundaryNote:
        "Replay assistance stays operator-visible only. It does not auto-replay, auto-send, or auto-resume on behalf of the operator.",
    };
  }

  return {
    fidelity:
      input.replay.fidelityStatus === "STRONG"
        ? "strong"
        : input.replay.fidelityStatus === "WATCH"
          ? "watch"
          : "weak",
    checkpointKey: input.runThread.replayRequest.checkpointKey,
    resumeToken: input.runThread.replayRequest.resumeToken,
    eventLogEntries: input.runThread.replay.eventLogEntries,
    summary: trimText(
      `${input.runThread.replayRequest.replaySummary} Current fidelity is ${input.replay.fidelityStatus.toLowerCase()} at ${input.replay.fidelityScore}%. ${input.replay.replaySummary}`,
      220,
    ),
    boundaryNote:
      "Replay assistance stays operator-visible only. It does not auto-replay, auto-send, or auto-resume on behalf of the operator.",
  };
}

export function buildOperatorDebuggerTakeoverAssistance(
  input: BuildOperatorDebuggerReadModelInput,
): HelmV21OperatorDebuggerTakeoverAssistance {
  const checklist = buildTakeoverChecklist(input);

  if (input.recovery.state === "BLOCKED") {
    return {
      posture: "blocked",
      recommendedAction: null,
      summary: trimText(
        `${input.recovery.summary} ${input.recovery.blockedReasons[0] ?? input.recovery.operatorAction}`,
        220,
      ),
      checklist,
      boundaryNote:
        "Takeover assistance keeps the operator on a bounded review path. It does not widen execution authority or bypass blocked-state safeguards.",
    };
  }

  if (input.recovery.allowedActions.includes("RESUME_CHECKPOINT")) {
    return {
      posture: "resume_ready",
      recommendedAction: "RESUME_CHECKPOINT",
      summary: trimText(
        `${input.recovery.operatorAction} Resume from ${input.runThread.replayRequest.checkpointKey ?? "the current anchor"} and keep the follow-up human input tied to the same checkpoint contract.`,
        220,
      ),
      checklist,
      boundaryNote:
        "Resume assistance only recommends the bounded checkpoint restore path that already exists on this surface.",
    };
  }

  if (input.recovery.allowedActions.includes("SAVE_RECOVERY_CHECKPOINT")) {
    return {
      posture: "checkpoint_ready",
      recommendedAction: "SAVE_RECOVERY_CHECKPOINT",
      summary: trimText(
        `${input.recovery.operatorAction} Save a fresh checkpoint only after the operator confirms blockers, decisions, and next actions against the current thread.`,
        220,
      ),
      checklist,
      boundaryNote:
        "Checkpoint assistance keeps the operator on review-first checkpoint creation. It does not auto-promote or auto-resolve the underlying gap.",
    };
  }

  if (input.recovery.allowedActions.includes("REPRUNE_CONTEXT")) {
    return {
      posture: "reprune_ready",
      recommendedAction: "REPRUNE_CONTEXT",
      summary: trimText(
        `${input.recovery.operatorAction} Re-prune only if the operator still agrees the protected fields and rollback anchor remain intact.`,
        220,
      ),
      checklist,
      boundaryNote:
        "Re-prune assistance remains bounded to prompt-window recovery. It does not grant new write authority beyond the existing remediation path.",
    };
  }

  if (input.recovery.state === "REVIEW_REQUIRED") {
    return {
      posture: "review_required",
      recommendedAction: null,
      summary: trimText(
        `${input.recovery.summary} ${input.recovery.operatorAction}`,
        220,
      ),
      checklist,
      boundaryNote:
        "Takeover assistance remains review-first. Human input should stay attached to the checkpoint anchor before any broader runtime action.",
    };
  }

  return {
    posture: "observe_only",
    recommendedAction: null,
    summary: trimText(
      `${input.recovery.summary} Continue to keep replay, checkpoint lineage, and human input checkpoint operator-visible.`,
      220,
    ),
    checklist,
    boundaryNote:
      "Takeover assistance remains read-mostly in this layer. It only explains the current bounded posture and anchor.",
  };
}

export function buildOperatorDebuggerTakeoverRequest(input: {
  runThread: HelmV21RunThreadContract;
  takeoverAssistance: HelmV21OperatorDebuggerTakeoverAssistance;
  takeoverRequestEvent?: OperatorDebuggerTakeoverRequestEvent | null;
  takeoverAcknowledgementEvent?: OperatorDebuggerTakeoverAcknowledgementEvent | null;
}): HelmV21OperatorDebuggerTakeoverRequest {
  const requestEvent = input.takeoverRequestEvent ?? null;
  const acknowledgementEvent = input.takeoverAcknowledgementEvent ?? null;
  const action = input.takeoverAssistance.recommendedAction;
  const checkpointId =
    input.runThread.replayRequest.checkpointId ?? input.runThread.latestCheckpoint?.checkpointId ?? null;
  const checkpointKey =
    input.runThread.replayRequest.checkpointKey ?? input.runThread.latestCheckpoint?.checkpointKey ?? null;
  const resumeToken =
    input.runThread.replayRequest.resumeToken ?? input.runThread.latestCheckpoint?.resumeToken ?? null;
  const anchorToken = resumeToken ?? checkpointKey;
  const requestToken = requestEvent?.resumeToken ?? requestEvent?.checkpointKey ?? null;
  const requestMatches =
    action !== null &&
    requestEvent?.action === action &&
    (anchorToken === null || requestToken === null || anchorToken === requestToken);
  const acknowledgementMatches =
    requestMatches &&
    acknowledgementEvent !== null &&
    (acknowledgementEvent.requestEventId === null || acknowledgementEvent.requestEventId === requestEvent?.id) &&
    acknowledgementEvent.action === action &&
    (requestToken === null ||
      (acknowledgementEvent.resumeToken ?? acknowledgementEvent.checkpointKey ?? null) === requestToken);

  if (!action) {
    return {
      state: "not_requestable",
      requestEventId: null,
      acknowledgementEventId: null,
      action: null,
      checkpointId: null,
      checkpointKey: null,
      resumeToken: null,
      requestedAt: null,
      requestedBy: null,
      sourcePage: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      summary: "No bounded operator takeover request is currently available on this run thread.",
      boundaryNote:
        "Takeover request stays bounded to the current runtime posture. It does not create auto-takeover, workflow routing, or broader execution authority.",
    };
  }

  if (acknowledgementMatches && requestEvent) {
    return {
      state: "acknowledged",
      requestEventId: requestEvent.id,
      acknowledgementEventId: acknowledgementEvent.id,
      action,
      checkpointId,
      checkpointKey,
      resumeToken,
      requestedAt: requestEvent.createdAt,
      requestedBy: requestEvent.requestedBy,
      sourcePage: requestEvent.sourcePage,
      acknowledgedAt: acknowledgementEvent.createdAt,
      acknowledgedBy: acknowledgementEvent.acknowledgedBy,
      summary: trimText(
        acknowledgementEvent.summary ||
          `Operator takeover acknowledgement recorded for ${action} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      boundaryNote:
        "Takeover acknowledgement records bounded operator acceptance only. It does not auto-execute the remediation step or widen runtime authority.",
    };
  }

  if (requestMatches) {
    return {
      state: "requested",
      requestEventId: requestEvent.id,
      acknowledgementEventId: null,
      action,
      checkpointId,
      checkpointKey,
      resumeToken,
      requestedAt: requestEvent.createdAt,
      requestedBy: requestEvent.requestedBy,
      sourcePage: requestEvent.sourcePage,
      acknowledgedAt: null,
      acknowledgedBy: null,
      summary: trimText(
        requestEvent.summary ||
          `Operator takeover request already recorded for ${action} on ${checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      boundaryNote:
        "Takeover request records bounded operator intent only. It does not auto-execute the underlying remediation step or widen authority.",
    };
  }

  return {
    state: "requestable",
    requestEventId: null,
    acknowledgementEventId: null,
    action,
    checkpointId,
    checkpointKey,
    resumeToken,
    requestedAt: null,
    requestedBy: null,
    sourcePage: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    summary: trimText(
      `Request bounded operator takeover for ${action} on ${checkpointKey ?? "the current thread anchor"} before the recovery path is executed.`,
      220,
    ),
    boundaryNote:
      "Takeover request stays review-first and request-only in this layer. It does not replace the explicit remediation action or introduce auto-takeover.",
  };
}

export function buildOperatorDebuggerTakeoverActivation(input: {
  takeoverRequest: HelmV21OperatorDebuggerTakeoverRequest;
  takeoverStartEvent?: OperatorDebuggerTakeoverStartEvent | null;
  takeoverReleaseEvent?: OperatorDebuggerTakeoverReleaseEvent | null;
}): HelmV21OperatorDebuggerTakeoverActivation {
  const startEvent = input.takeoverStartEvent ?? null;
  const releaseEvent = input.takeoverReleaseEvent ?? null;
  const request = input.takeoverRequest;
  const anchorToken = request.resumeToken ?? request.checkpointKey ?? null;
  const startToken = startEvent ? (startEvent.resumeToken ?? startEvent.checkpointKey ?? null) : null;
  const requestMatches =
    request.state === "acknowledged" &&
    request.requestEventId !== null &&
    request.acknowledgementEventId !== null &&
    startEvent !== null &&
    startEvent.action === request.action &&
    (startEvent.requestEventId === null || startEvent.requestEventId === request.requestEventId) &&
    (startEvent.acknowledgementEventId === null ||
      startEvent.acknowledgementEventId === request.acknowledgementEventId) &&
    (anchorToken === null || startToken === null || anchorToken === startToken);
  const releaseToken = releaseEvent
    ? (releaseEvent.resumeToken ?? releaseEvent.checkpointKey ?? null)
    : null;
  const releaseMatches =
    requestMatches &&
    releaseEvent !== null &&
    releaseEvent.action === request.action &&
    (releaseEvent.requestEventId === null || releaseEvent.requestEventId === request.requestEventId) &&
    (releaseEvent.acknowledgementEventId === null ||
      releaseEvent.acknowledgementEventId === request.acknowledgementEventId) &&
    (startEvent === null ||
      releaseEvent.startEventId === null ||
      releaseEvent.startEventId === startEvent.id) &&
    (anchorToken === null || releaseToken === null || anchorToken === releaseToken);

  if (releaseMatches && startEvent && releaseEvent) {
    return {
      state: "released",
      startEventId: startEvent.id,
      releaseEventId: releaseEvent.id,
      requestEventId: request.requestEventId,
      acknowledgementEventId: request.acknowledgementEventId,
      action: request.action,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      currentOwner: null,
      latestEventKind: "released",
      startedAt: startEvent.createdAt,
      startedBy: startEvent.startedBy,
      releasedAt: releaseEvent.createdAt,
      releasedBy: releaseEvent.releasedBy,
      releaseReason: releaseEvent.releaseReason,
      sourcePage: releaseEvent.sourcePage ?? startEvent.sourcePage,
      summary: trimText(
        releaseEvent.summary ||
          `Operator takeover released for ${request.action ?? "the bounded recovery path"} on ${request.checkpointKey ?? "the current thread anchor"}. Reason: ${releaseEvent.releaseReason}.`,
        220,
      ),
      boundaryNote:
        "Takeover release closes bounded operator control explicitly. It does not auto-run remediation, auto-close review, or widen execution authority.",
    };
  }

  if (requestMatches && startEvent) {
    return {
      state: "active",
      startEventId: startEvent.id,
      releaseEventId: null,
      requestEventId: request.requestEventId,
      acknowledgementEventId: request.acknowledgementEventId,
      action: request.action,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      currentOwner: startEvent.startedBy,
      latestEventKind: "started",
      startedAt: startEvent.createdAt,
      startedBy: startEvent.startedBy,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      sourcePage: startEvent.sourcePage,
      summary: trimText(
        startEvent.summary ||
          `Operator takeover started for ${request.action ?? "the bounded recovery path"} on ${request.checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      boundaryNote:
        "Takeover start records bounded operator control only. It does not auto-execute remediation or widen runtime authority.",
    };
  }

  if (request.state === "acknowledged") {
    return {
      state: "inactive",
      startEventId: null,
      releaseEventId: null,
      requestEventId: request.requestEventId,
      acknowledgementEventId: request.acknowledgementEventId,
      action: request.action,
      checkpointId: request.checkpointId,
      checkpointKey: request.checkpointKey,
      resumeToken: request.resumeToken,
      currentOwner: null,
      latestEventKind: "none",
      startedAt: null,
      startedBy: null,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      sourcePage: request.sourcePage,
      summary: trimText(
        `Operator takeover is acknowledged for ${request.action ?? "the bounded recovery path"} on ${request.checkpointKey ?? "the current thread anchor"} and is waiting for an explicit start.`,
        220,
      ),
      boundaryNote:
        "Takeover start stays explicit and review-first. It does not auto-run the remediation path or create a workflow engine.",
    };
  }

  return {
    state: "inactive",
    startEventId: null,
    releaseEventId: null,
    requestEventId: request.requestEventId,
    acknowledgementEventId: request.acknowledgementEventId,
    action: request.action,
    checkpointId: request.checkpointId,
    checkpointKey: request.checkpointKey,
    resumeToken: request.resumeToken,
    currentOwner: null,
    latestEventKind: "none",
    startedAt: null,
    startedBy: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    sourcePage: request.sourcePage,
    summary: "Operator takeover has not been started on this run thread yet.",
    boundaryNote:
      "Takeover start is explicit and typed in this layer. It does not auto-promote request intent into execution authority.",
  };
}

export function buildOperatorDebuggerTakeoverFollowThrough(input: {
  takeoverActivation: HelmV21OperatorDebuggerTakeoverActivation;
  requestEvent?: OperatorDebuggerTakeoverFollowThroughRequestEvent | null;
  resolvedEvent?: OperatorDebuggerTakeoverFollowThroughResolvedEvent | null;
}): HelmV21OperatorDebuggerTakeoverFollowThrough {
  const takeoverActivation = input.takeoverActivation;
  const requestEvent = input.requestEvent ?? null;
  const resolvedEvent = input.resolvedEvent ?? null;
  const requestable =
    takeoverActivation.state === "released" &&
    takeoverActivation.releaseEventId !== null &&
    takeoverActivation.action !== null;

  const requestMatches =
    requestable &&
    requestEvent !== null &&
    requestEvent.action === takeoverActivation.action &&
    (requestEvent.releaseEventId === null ||
      requestEvent.releaseEventId === takeoverActivation.releaseEventId) &&
    (requestEvent.startEventId === null ||
      requestEvent.startEventId === takeoverActivation.startEventId) &&
    (requestEvent.acknowledgementEventId === null ||
      requestEvent.acknowledgementEventId === takeoverActivation.acknowledgementEventId) &&
    (requestEvent.takeoverRequestEventId === null ||
      requestEvent.takeoverRequestEventId === takeoverActivation.requestEventId) &&
    ((requestEvent.resumeToken ?? requestEvent.checkpointKey ?? null) ===
      (takeoverActivation.resumeToken ?? takeoverActivation.checkpointKey ?? null) ||
      requestEvent.resumeToken === null ||
      takeoverActivation.resumeToken === null);

  const resolutionMatches =
    requestMatches &&
    resolvedEvent !== null &&
    resolvedEvent.createdAt.getTime() >= requestEvent.createdAt.getTime() &&
    resolvedEvent.action === takeoverActivation.action &&
    (resolvedEvent.requestEventId === null ||
      resolvedEvent.requestEventId === requestEvent?.id) &&
    (resolvedEvent.releaseEventId === null ||
      resolvedEvent.releaseEventId === takeoverActivation.releaseEventId) &&
    (resolvedEvent.startEventId === null ||
      resolvedEvent.startEventId === takeoverActivation.startEventId) &&
    (resolvedEvent.acknowledgementEventId === null ||
      resolvedEvent.acknowledgementEventId === takeoverActivation.acknowledgementEventId) &&
    (resolvedEvent.takeoverRequestEventId === null ||
      resolvedEvent.takeoverRequestEventId === takeoverActivation.requestEventId);

  if (!requestable) {
    return {
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
      summary:
        "No operator takeover follow-through is requestable until bounded operator control has been explicitly released.",
      nextAction: null,
      requestedAt: null,
      requestedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      sourcePage: null,
      boundaryNote:
        "Takeover follow-through stays typed and operator-visible only. It does not auto-close review, auto-resume the run, or create a workflow engine.",
    };
  }

  if (resolutionMatches && requestEvent && resolvedEvent) {
    return {
      state: "resolved",
      requestEventId: requestEvent.id,
      resolutionEventId: resolvedEvent.id,
      takeoverRequestEventId: takeoverActivation.requestEventId,
      acknowledgementEventId: takeoverActivation.acknowledgementEventId,
      startEventId: takeoverActivation.startEventId,
      releaseEventId: takeoverActivation.releaseEventId,
      action: takeoverActivation.action,
      checkpointId: takeoverActivation.checkpointId,
      checkpointKey: takeoverActivation.checkpointKey,
      resumeToken: takeoverActivation.resumeToken,
      currentOwner: resolvedEvent.resolvedBy,
      summary: trimText(
        resolvedEvent.summary ||
          `Operator takeover follow-through was resolved for ${takeoverActivation.action ?? "the bounded recovery path"} on ${takeoverActivation.checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction: resolvedEvent.nextAction ?? requestEvent.nextAction,
      requestedAt: requestEvent.createdAt,
      requestedBy: requestEvent.requestedBy,
      resolvedAt: resolvedEvent.createdAt,
      resolvedBy: resolvedEvent.resolvedBy,
      sourcePage: resolvedEvent.sourcePage ?? requestEvent.sourcePage ?? takeoverActivation.sourcePage,
      boundaryNote:
        "Takeover follow-through stays typed and operator-visible only. Resolving closeout does not auto-close the thread or widen execution authority.",
    };
  }

  if (requestMatches && requestEvent) {
    return {
      state: "open",
      requestEventId: requestEvent.id,
      resolutionEventId: null,
      takeoverRequestEventId: takeoverActivation.requestEventId,
      acknowledgementEventId: takeoverActivation.acknowledgementEventId,
      startEventId: takeoverActivation.startEventId,
      releaseEventId: takeoverActivation.releaseEventId,
      action: takeoverActivation.action,
      checkpointId: takeoverActivation.checkpointId,
      checkpointKey: takeoverActivation.checkpointKey,
      resumeToken: takeoverActivation.resumeToken,
      currentOwner: requestEvent.requestedBy,
      summary: trimText(
        requestEvent.summary ||
          `Operator takeover follow-through stays open for ${takeoverActivation.action ?? "the bounded recovery path"} on ${takeoverActivation.checkpointKey ?? "the current thread anchor"}.`,
        220,
      ),
      nextAction: requestEvent.nextAction,
      requestedAt: requestEvent.createdAt,
      requestedBy: requestEvent.requestedBy,
      resolvedAt: null,
      resolvedBy: null,
      sourcePage: requestEvent.sourcePage ?? takeoverActivation.sourcePage,
      boundaryNote:
        "Takeover follow-through stays typed and operator-visible only. It marks lifecycle closeout after bounded control release and does not create auto-remediation.",
    };
  }

  const defaultNextAction =
    takeoverActivation.action === "SAVE_RECOVERY_CHECKPOINT"
      ? `Close the takeover follow-through on ${takeoverActivation.checkpointKey ?? "the current thread anchor"} after the recovery checkpoint outcome is reviewed.`
      : takeoverActivation.action === "RESUME_CHECKPOINT"
        ? `Close the takeover follow-through on ${takeoverActivation.checkpointKey ?? "the current thread anchor"} after the resumed path is reviewed.`
        : `Close the takeover follow-through on ${takeoverActivation.checkpointKey ?? "the current thread anchor"} after the re-pruned context review is confirmed.`;

  return {
    state: "requestable",
    requestEventId: null,
    resolutionEventId: null,
    takeoverRequestEventId: takeoverActivation.requestEventId,
    acknowledgementEventId: takeoverActivation.acknowledgementEventId,
    startEventId: takeoverActivation.startEventId,
    releaseEventId: takeoverActivation.releaseEventId,
    action: takeoverActivation.action,
    checkpointId: takeoverActivation.checkpointId,
    checkpointKey: takeoverActivation.checkpointKey,
    resumeToken: takeoverActivation.resumeToken,
    currentOwner: takeoverActivation.releasedBy,
    summary: trimText(
      `Operator takeover follow-through can now be requested for ${takeoverActivation.action ?? "the bounded recovery path"} on ${takeoverActivation.checkpointKey ?? "the current thread anchor"} after bounded control was released.`,
      220,
    ),
    nextAction: defaultNextAction,
    requestedAt: null,
    requestedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    sourcePage: takeoverActivation.sourcePage,
    boundaryNote:
      "Takeover follow-through stays typed and operator-visible only. It does not auto-close review, auto-resume the run, or create broader execution authority.",
  };
}

function mapRecoveryFailureToInterruptCode(
  failureTaxonomy: OperatorDebuggerRecoveryState["failureTaxonomy"],
): HelmV21InterruptReason["code"] {
  switch (failureTaxonomy) {
    case "NO_RECOVERY_ANCHOR":
      return "no_recovery_anchor";
    case "BUDGET_PRESSURE":
      return "budget_pressure";
    case "PAYLOAD_STATE_DRIFT":
      return "payload_state_drift";
    case "REPLAY_DRIFT":
      return "replay_drift";
    case "PROTECTED_STATE_GAP":
      return "protected_state_gap";
    default:
      return "review_required";
  }
}

export function buildOperatorDebuggerInterruptReason(
  input: Pick<BuildOperatorDebuggerReadModelInput, "runThread" | "recovery" | "verification">,
): HelmV21InterruptReason {
  const runStatus = input.runThread.runStatus;
  if (runStatus === "failed") {
    return {
      state: "closed",
      code: "run_failed",
      source: "run_status",
      summary: "The run thread closed in failed posture. Resume should stay bounded to explicit checkpoint or rerun review.",
      boundaryNote:
        "Interrupt reason is a typed operator read seam only. It does not auto-rerun, auto-resume, or widen execution authority.",
    };
  }
  if (runStatus === "aborted") {
    return {
      state: "closed",
      code: "run_aborted",
      source: "run_status",
      summary: "The run thread was aborted and now stays closed until an operator chooses a bounded recovery path.",
      boundaryNote:
        "Interrupt reason is a typed operator read seam only. It does not auto-rerun, auto-resume, or widen execution authority.",
    };
  }
  if (runStatus === "completed") {
    return {
      state: "closed",
      code: "run_completed",
      source: "run_status",
      summary: "The run thread is closed in completed posture. Any follow-up stays review-first and must start from a fresh bounded action.",
      boundaryNote:
        "Interrupt reason is a typed operator read seam only. It does not auto-rerun, auto-resume, or widen execution authority.",
    };
  }
  if (input.recovery.state === "BLOCKED") {
    return {
      state: "blocked",
      code: mapRecoveryFailureToInterruptCode(input.recovery.failureTaxonomy),
      source: "recovery",
      summary: trimText(
        `${input.recovery.summary} ${input.recovery.blockedReasons[0] ?? input.recovery.operatorAction}`,
        220,
      ),
      boundaryNote:
        "Interrupt reason stays typed and review-first. It explains why the thread cannot continue safely, but it does not auto-route around the block.",
    };
  }
  if (input.verification?.blockedReasons.length) {
    return {
      state: "attention",
      code: "verification_blocked",
      source: "verification",
      summary: trimText(
        `${input.verification.status} still blocks continuation. ${input.verification.blockedReasons[0]}`,
        220,
      ),
      boundaryNote:
        "Verification-blocked interrupt reasons stay operator-visible only. They do not auto-dismiss review or auto-promote the underlying state.",
    };
  }
  if (input.recovery.state === "REVIEW_REQUIRED" || input.recovery.state === "RECOVERABLE") {
    return {
      state: "attention",
      code:
        input.recovery.failureTaxonomy === "NONE"
          ? "review_required"
          : mapRecoveryFailureToInterruptCode(input.recovery.failureTaxonomy),
      source: "recovery",
      summary: trimText(
        `${input.recovery.summary} ${input.recovery.reviewReasons[0] ?? input.recovery.operatorAction}`,
        220,
      ),
      boundaryNote:
        "Interrupt reason stays typed and review-first. It marks the current bounded interruption posture without creating a new execution path.",
    };
  }

  return {
    state: "clear",
    code: "none",
    source: "recovery",
    summary: "No interrupt reason is currently forcing a bounded review or recovery path on this run thread.",
    boundaryNote:
      "Interrupt reason stays typed and read-only in this layer. It does not create or remove authority on its own.",
  };
}

export function buildOperatorDebuggerResumeAsk(
  input: Pick<BuildOperatorDebuggerReadModelInput, "runThread" | "recovery" | "notebookState" | "verification">,
): HelmV21ResumeAsk {
  const latestCheckpoint = input.runThread.latestCheckpoint;
  const questionOrBlocker =
    input.notebookState.openQuestions[0] ??
    input.verification?.blockedReasons[0] ??
    input.recovery.reviewReasons[0] ??
    input.recovery.blockedReasons[0] ??
    input.recovery.operatorAction;

  if (input.recovery.allowedActions.includes("RESUME_CHECKPOINT")) {
    return {
      mode: "resume_checkpoint",
      checkpointId: input.runThread.replayRequest.checkpointId,
      checkpointKey: input.runThread.replayRequest.checkpointKey,
      resumeToken: input.runThread.replayRequest.resumeToken,
      prompt: trimText(
        `Resume from ${input.runThread.replayRequest.checkpointKey ?? "the current checkpoint anchor"} and keep the next operator review on the same run thread.`,
        220,
      ),
      boundaryNote:
        "Resume ask stays typed and operator-visible only. It does not auto-resume or bypass the existing bounded checkpoint restore path.",
    };
  }

  if (input.recovery.allowedActions.includes("SAVE_RECOVERY_CHECKPOINT")) {
    return {
      mode: "save_recovery_checkpoint",
      checkpointId: latestCheckpoint?.checkpointId ?? null,
      checkpointKey: latestCheckpoint?.checkpointKey ?? null,
      resumeToken: latestCheckpoint?.resumeToken ?? null,
      prompt: trimText(
        `Save a fresh recovery checkpoint only after blockers, decisions, and next actions are re-confirmed on thread ${input.runThread.threadId}.`,
        220,
      ),
      boundaryNote:
        "Resume ask stays typed and operator-visible only. It does not auto-write checkpoints or auto-resolve the underlying recovery gap.",
    };
  }

  if (input.recovery.allowedActions.includes("REPRUNE_CONTEXT")) {
    return {
      mode: "reprune_context",
      checkpointId: latestCheckpoint?.checkpointId ?? null,
      checkpointKey: latestCheckpoint?.checkpointKey ?? null,
      resumeToken: latestCheckpoint?.resumeToken ?? null,
      prompt: trimText(
        `Re-prune context only if the protected fields and rollback anchor still match ${latestCheckpoint?.checkpointKey ?? "the current bounded thread state"}.`,
        220,
      ),
      boundaryNote:
        "Resume ask stays typed and operator-visible only. It does not widen prompt-window recovery into broader write authority.",
    };
  }

  if (input.runThread.humanInputCheckpoint.state === "checkpoint_ready" && questionOrBlocker) {
    return {
      mode: "provide_human_input",
      checkpointId: input.runThread.humanInputCheckpoint.checkpointId,
      checkpointKey: input.runThread.humanInputCheckpoint.checkpointKey,
      resumeToken: input.runThread.humanInputCheckpoint.checkpointKey,
      prompt: trimText(
        `Capture human input against ${input.runThread.humanInputCheckpoint.checkpointKey} before resuming: ${questionOrBlocker}`,
        220,
      ),
      boundaryNote:
        "Resume ask stays typed and operator-visible only. It keeps human input attached to the checkpoint contract instead of free-text narration.",
    };
  }

  if (input.recovery.state === "REVIEW_REQUIRED") {
    return {
      mode: "review_before_resume",
      checkpointId: latestCheckpoint?.checkpointId ?? null,
      checkpointKey: latestCheckpoint?.checkpointKey ?? null,
      resumeToken: latestCheckpoint?.resumeToken ?? null,
      prompt: trimText(
        `${input.recovery.operatorAction} Review should close before any bounded resume path is chosen.`,
        220,
      ),
      boundaryNote:
        "Resume ask stays typed and operator-visible only. It marks review as a prerequisite and does not auto-continue the thread.",
    };
  }

  if (input.recovery.state === "BLOCKED" || input.runThread.runStatus === "failed" || input.runThread.runStatus === "aborted") {
    return {
      mode: "rerun_session",
      checkpointId: null,
      checkpointKey: null,
      resumeToken: null,
      prompt: trimText(
        `${questionOrBlocker} Re-run the session only after a fresh bounded recovery plan is chosen.`,
        220,
      ),
      boundaryNote:
        "Resume ask stays typed and operator-visible only. It does not auto-start a new run or bypass blocked-state safeguards.",
    };
  }

  return {
    mode: "none",
    checkpointId: null,
    checkpointKey: null,
    resumeToken: null,
    prompt: "No resume ask is currently pending on this run thread.",
    boundaryNote:
      "Resume ask stays typed and read-only in this layer. It only exposes the current bounded continuation posture.",
  };
}

export function buildOperatorDebuggerHumanInputRequest(input: {
  runThread: HelmV21RunThreadContract;
  resumeAsk: HelmV21ResumeAsk;
  humanInputRequestEvent?: OperatorDebuggerHumanInputRequestEvent | null;
  humanInputAcknowledgementEvent?: OperatorDebuggerHumanInputAcknowledgementEvent | null;
}): HelmV21HumanInputCheckpointRequest {
  const requestEvent = input.humanInputRequestEvent ?? null;
  const acknowledgementEvent = input.humanInputAcknowledgementEvent ?? null;
  const checkpointId = input.runThread.humanInputCheckpoint.checkpointId;
  const checkpointKey = input.runThread.humanInputCheckpoint.checkpointKey;
  const resumeToken = checkpointKey;
  const prompt = input.resumeAsk.prompt;
  const requestable =
    input.runThread.humanInputCheckpoint.state === "checkpoint_ready" &&
    input.resumeAsk.mode === "provide_human_input";
  const requestMatches =
    requestable &&
    requestEvent?.checkpointKey === checkpointKey &&
    requestEvent.prompt === prompt;
  const acknowledgementMatches =
    requestMatches &&
    acknowledgementEvent !== null &&
    (acknowledgementEvent.requestEventId === null || acknowledgementEvent.requestEventId === requestEvent?.id) &&
    acknowledgementEvent.prompt === prompt &&
    (acknowledgementEvent.resumeToken ?? acknowledgementEvent.checkpointKey ?? null) ===
      (requestEvent?.resumeToken ?? requestEvent?.checkpointKey ?? null);

  if (!requestable) {
    return {
      state: "not_requestable",
      requestEventId: null,
      acknowledgementEventId: null,
      checkpointId: null,
      checkpointKey: null,
      resumeToken: null,
      prompt: "No human input checkpoint request is currently pending on this run thread.",
      requestedAt: null,
      requestedBy: null,
      sourcePage: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      summary: "No bounded human input checkpoint request is currently available on this run thread.",
      boundaryNote:
        "Human input checkpoint request stays request-only in this layer. It does not capture free-form input, auto-resume the run, or widen write authority.",
    };
  }

  if (acknowledgementMatches && requestEvent) {
    return {
      state: "acknowledged",
      requestEventId: requestEvent.id,
      acknowledgementEventId: acknowledgementEvent.id,
      checkpointId,
      checkpointKey,
      resumeToken,
      prompt,
      requestedAt: requestEvent.createdAt,
      requestedBy: requestEvent.requestedBy,
      sourcePage: requestEvent.sourcePage,
      acknowledgedAt: acknowledgementEvent.createdAt,
      acknowledgedBy: acknowledgementEvent.acknowledgedBy,
      summary: trimText(
        acknowledgementEvent.summary ||
          `Human input checkpoint acknowledgement recorded for ${checkpointKey ?? "the current checkpoint"} before bounded resume continues.`,
        220,
      ),
      boundaryNote:
        "Human input checkpoint acknowledgement records bounded operator acceptance only. It does not auto-capture answers or auto-resume the thread.",
    };
  }

  if (requestMatches) {
    return {
      state: "requested",
      requestEventId: requestEvent.id,
      acknowledgementEventId: null,
      checkpointId,
      checkpointKey,
      resumeToken,
      prompt,
      requestedAt: requestEvent.createdAt,
      requestedBy: requestEvent.requestedBy,
      sourcePage: requestEvent.sourcePage,
      acknowledgedAt: null,
      acknowledgedBy: null,
      summary: trimText(
        requestEvent.summary ||
          `Human input checkpoint request already recorded for ${checkpointKey ?? "the current checkpoint"} before bounded resume continues.`,
        220,
      ),
      boundaryNote:
        "Human input checkpoint request records bounded operator intent only. It does not auto-capture answers, auto-resume the thread, or create a new execution plane.",
    };
  }

  return {
    state: "requestable",
    requestEventId: null,
    acknowledgementEventId: null,
    checkpointId,
    checkpointKey,
    resumeToken,
    prompt,
    requestedAt: null,
    requestedBy: null,
    sourcePage: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    summary: trimText(
      `Request human input against ${checkpointKey ?? "the current checkpoint"} before bounded resume continues.`,
      220,
    ),
    boundaryNote:
      "Human input checkpoint request stays checkpoint-bound and request-only in this layer. It does not bypass review or attach free-form narration outside the typed checkpoint seam.",
  };
}

export function buildOperatorDebuggerHandoffPayload(
  input: Pick<BuildOperatorDebuggerReadModelInput, "runThread" | "handoffPackets">,
): HelmV21HandoffPayloadSkeleton {
  const latestPacket = [...input.handoffPackets]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

  if (!latestPacket) {
    return {
      state: "not_available",
      handoffId: null,
      packetKey: null,
      fromAgent: null,
      toAgent: null,
      goal: "",
      objectRefs: null,
      checkpointId: null,
      checkpointKey: null,
      notebookRef: null,
      constraints: [],
      trustBoundary: {
        trusted: [],
        untrusted: [],
      },
      requiredOutputs: [],
      evidenceRefs: [],
      approvalTier: null,
      createdAt: null,
      summary: "No typed handoff payload is attached to this run thread yet.",
      boundaryNote:
        "Handoff payload stays typed and operator-visible only. It does not auto-route work or turn this surface into a workflow engine.",
    };
  }

  const checkpointAnchor =
    input.runThread.checkpointLineage.find(
      (item) => item.checkpointId === latestPacket.checkpointRef || item.checkpointKey === latestPacket.checkpointRef,
    ) ?? null;
  const constraints = parseStringList(latestPacket.constraintsJson);
  const trustedRefs = parseStringList(latestPacket.trustedRefs);
  const untrustedRefs = parseStringList(latestPacket.untrustedRefs);
  const requiredOutputs = parseStringList(latestPacket.requiredOutputs);
  const evidenceRefs = parseStringList(latestPacket.evidenceRefs);

  return {
    state: "ready",
    handoffId: latestPacket.id,
    packetKey: latestPacket.packetKey,
    fromAgent: latestPacket.fromAgent,
    toAgent: latestPacket.toAgent,
    goal: latestPacket.goal,
    objectRefs: input.runThread.objectRefs,
    checkpointId: checkpointAnchor?.checkpointId ?? null,
    checkpointKey: checkpointAnchor?.checkpointKey ?? null,
    notebookRef: latestPacket.notebookRef,
    constraints,
    trustBoundary: {
      trusted: trustedRefs,
      untrusted: untrustedRefs,
    },
    requiredOutputs,
    evidenceRefs,
    approvalTier: latestPacket.approvalTier,
    createdAt: latestPacket.createdAt,
    summary: trimText(
      `${latestPacket.fromAgent} -> ${latestPacket.toAgent} handoff requests ${latestPacket.goal}. ${requiredOutputs.length} required output(s) stay grounded by ${evidenceRefs.length > 0 ? evidenceRefs.slice(0, 3).join(" / ") : "the runtime trace"}.${checkpointAnchor ? ` Checkpoint ${checkpointAnchor.checkpointKey} stays attached.` : latestPacket.notebookRef ? ` Notebook ${latestPacket.notebookRef} stays attached.` : " No explicit checkpoint anchor is attached yet."}`,
      240,
    ),
    boundaryNote:
      "Handoff payload stays typed and operator-visible only. It does not auto-route work, auto-approve authority, or create a new execution plane.",
  };
}

export function buildOperatorDebuggerReadModel(
  input: BuildOperatorDebuggerReadModelInput,
): HelmV21OperatorDebuggerReadModel {
  const history: HelmV21OperatorDebuggerHistoryEntry[] = [
    ...input.runThread.lifecycleLog,
    ...parseReplayHistory(input.replayableEventLog, input.runThread.threadId),
    ...input.contextEditEvents.map((edit) => ({
      id: edit.id,
      kind: "context_pruned" as const,
      label: edit.strategy,
      summary:
        edit.removedSummary ??
        `${edit.strategy} reduced token load from ${edit.beforeTokenCount} to ${edit.afterTokenCount}.`,
      timestamp: edit.createdAt,
      checkpointKey: null,
      source: "context_edit" as const,
    })),
  ]
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
    .slice(0, 12);

  const interruptReason = buildOperatorDebuggerInterruptReason(input);
  const replayAssistance = buildOperatorDebuggerReplayAssistance(input);
  const persistedLifecycleTrace = buildOperatorDebuggerPersistedLifecycleTrace(input);
  const takeoverAssistance = buildOperatorDebuggerTakeoverAssistance(input);
  const resumeAsk = buildOperatorDebuggerResumeAsk(input);
  const takeoverRequest = buildOperatorDebuggerTakeoverRequest({
    runThread: input.runThread,
    takeoverAssistance,
    takeoverRequestEvent: input.takeoverRequestEvent,
    takeoverAcknowledgementEvent: input.takeoverAcknowledgementEvent,
  });
  const takeoverActivation = buildOperatorDebuggerTakeoverActivation({
    takeoverRequest,
    takeoverStartEvent: input.takeoverStartEvent,
    takeoverReleaseEvent: input.takeoverReleaseEvent,
  });
  const takeoverFollowThrough = buildOperatorDebuggerTakeoverFollowThrough({
    takeoverActivation,
    requestEvent: input.takeoverFollowThroughRequestEvent,
    resolvedEvent: input.takeoverFollowThroughResolvedEvent,
  });
  const humanInputRequest = buildOperatorDebuggerHumanInputRequest({
    runThread: input.runThread,
    resumeAsk,
    humanInputRequestEvent: input.humanInputRequestEvent,
    humanInputAcknowledgementEvent: input.humanInputAcknowledgementEvent,
  });
  const traceContract = buildOperatorDebuggerTraceContract({
    runThread: input.runThread,
    replayAssistance,
    persistedLifecycleTrace,
    humanInputRequest,
  });
  const writeContract = buildOperatorDebuggerWriteContract({
    runThread: input.runThread,
    traceContract,
    persistedLifecycleTrace,
    humanInputRequest,
  });
  const swarmSpawnContract = buildOperatorDebuggerSwarmSpawnContract({
    runThread: input.runThread,
  });
  const swarmReadOnlyWorkerContract = buildOperatorDebuggerSwarmReadOnlyWorkerContract({
    runThread: input.runThread,
  });
  const swarmVerificationMergeLaneContract =
    buildOperatorDebuggerSwarmVerificationMergeLaneContract({
      runThread: input.runThread,
    });
  const recoveryActionContract = buildOperatorDebuggerRecoveryActionContract({
    runThread: input.runThread,
    recovery: input.recovery,
    remediationTrace: input.remediationTrace,
    traceContract,
    writeContract,
    takeoverAssistance,
    takeoverRequest,
    takeoverActivation,
    takeoverFollowThrough,
  });
  const recoveryLifecycleContract = buildOperatorDebuggerRecoveryLifecycleContract({
    traceContract,
    writeContract,
    recoveryActionContract,
    takeoverActivation,
  });
  const recoveryTransitionContract = buildOperatorDebuggerRecoveryTransitionContract({
    recoveryActionContract,
    recoveryLifecycleContract,
    takeoverActivation,
  });
  const recoveryStateMachineContract = buildOperatorDebuggerRecoveryStateMachineContract({
    recoveryTransitionContract,
    takeoverRequest,
    takeoverActivation,
    takeoverFollowThrough,
  });
  const recoveryExecutionContract = buildOperatorDebuggerRecoveryExecutionContract({
    recoveryStateMachineContract,
    takeoverActivation,
  });
  const handoffPayload = buildOperatorDebuggerHandoffPayload(input);
  const variableSnapshot = [
    ...buildVariableSnapshot(input),
    {
      key: "debugger_trace_contract",
      value: `${traceContract.state} · ${traceContract.driver} · ${traceContract.anchor} · ${traceContract.checkpointKey ?? "no-checkpoint"} · ${traceContract.replayRequestMode}/${traceContract.replayFidelity} · ${traceContract.humanInputCheckpointState}/${traceContract.humanInputRequestState}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_write_contract",
      value: `${writeContract.state} · ${writeContract.driver} · ${writeContract.writeAnchor} · ${writeContract.checkpointKey ?? "no-checkpoint"} · ${writeContract.persistedWriteSideState} · ${writeContract.refreshReason ?? "no-refresh-reason"}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_swarm_spawn_contract",
      value: `${swarmSpawnContract.state} · request ${swarmSpawnContract.requestRecordState} · ${swarmSpawnContract.driver} · ${swarmSpawnContract.workspaceFlagState} · ${swarmSpawnContract.budgetPosture}/${swarmSpawnContract.budgetEnvelopeState} · deny ${swarmSpawnContract.denyReason ?? "none"}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_swarm_read_only_worker_contract",
      value: `${swarmReadOnlyWorkerContract.state} · ${swarmReadOnlyWorkerContract.driver} · ${swarmReadOnlyWorkerContract.allowlistedWorkers.join("/")} · ${swarmReadOnlyWorkerContract.artifactPolicy} · ${swarmReadOnlyWorkerContract.transcriptPolicy} · ${swarmReadOnlyWorkerContract.requestLifecycleState} · ${swarmReadOnlyWorkerContract.handoffPreviewState} · ${swarmReadOnlyWorkerContract.packetConsumptionIntentState} · ${swarmReadOnlyWorkerContract.artifactBundlePlaceholderState} · ${swarmReadOnlyWorkerContract.executionRecordState} · ${swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState} · ${swarmReadOnlyWorkerContract.handoffConsumptionState} · ${swarmReadOnlyWorkerContract.handoffConsumptionRecordState} · ${swarmReadOnlyWorkerContract.executionLifecycleContract.state} · ${swarmReadOnlyWorkerContract.executionLifecycleContract.driver} · ${swarmReadOnlyWorkerContract.executionCandidateContract.state} · ${swarmReadOnlyWorkerContract.executionCandidateContract.driver} · ${swarmReadOnlyWorkerContract.executionCandidateContract.artifactMaterializationState} · ${swarmReadOnlyWorkerContract.artifactMaterializationGuardContract.state} · ${swarmReadOnlyWorkerContract.artifactMaterializationRecordState} · ${swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.state} · ${swarmReadOnlyWorkerContract.resultSideOutputContract.state} · ${swarmReadOnlyWorkerContract.resultSideOutputContract.driver} · ${swarmReadOnlyWorkerContract.resultSideOutputGuardContract.state} · ${swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.state} · ${swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.driver} · ${swarmReadOnlyWorkerContract.outputConsumptionContract.state} · ${swarmReadOnlyWorkerContract.outputConsumptionContract.driver} · ${swarmReadOnlyWorkerContract.resultAdoptionContract.state} · ${swarmReadOnlyWorkerContract.resultAdoptionContract.driver} · ${swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state} · ${swarmReadOnlyWorkerContract.outputAdoptionRecordState} · ${swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state} · ${swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.driver} · ${swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state} · ${swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver} · ${swarmReadOnlyWorkerContract.executionPreflightState} · ${swarmReadOnlyWorkerContract.executionGuardContract.state} · ${swarmReadOnlyWorkerContract.selectedWorkerKind ?? "no-selection"}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_swarm_verification_merge_lane_contract",
      value: `${swarmVerificationMergeLaneContract.state} · ${swarmVerificationMergeLaneContract.driver} · ${swarmVerificationMergeLaneContract.mergeLaneTruth ?? "no-truth"} · ${swarmVerificationMergeLaneContract.verificationStatus ?? "no-verification"} · ${swarmVerificationMergeLaneContract.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_recovery_action_contract",
      value: `${recoveryActionContract.state} · ${recoveryActionContract.driver} · ${recoveryActionContract.action ?? "no-action"} · ${recoveryActionContract.checkpointKey ?? "no-checkpoint"} · ${recoveryActionContract.latestRemediationExecutionStatus ?? "no-remediation"}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_recovery_lifecycle_contract",
      value: `${recoveryLifecycleContract.state} · ${recoveryLifecycleContract.driver} · ${recoveryLifecycleContract.anchor} · ${recoveryLifecycleContract.action ?? "no-action"} · ${recoveryLifecycleContract.nextTransition}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_recovery_transition_contract",
      value: `${recoveryTransitionContract.state} · ${recoveryTransitionContract.driver} · ${recoveryTransitionContract.anchor} · ${recoveryTransitionContract.action ?? "no-action"} · ${recoveryTransitionContract.transition}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_recovery_state_machine_contract",
      value: `${recoveryStateMachineContract.phase} · ${recoveryStateMachineContract.transitionState} · ${recoveryStateMachineContract.currentTransition} · ${recoveryStateMachineContract.completedTransitions.join("/") || "none"}`,
      source: "run_thread" as const,
    },
    {
      key: "debugger_recovery_execution_contract",
      value: `${recoveryExecutionContract.state} · ${recoveryExecutionContract.currentTransition} · execute=${recoveryExecutionContract.canExecute ? "yes" : "no"} · ${recoveryExecutionContract.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread" as const,
    },
    {
      key: "interrupt_reason",
      value: `${interruptReason.state} · ${interruptReason.code}`,
      source: "run_thread" as const,
    },
    {
      key: "resume_ask",
      value: `${resumeAsk.mode} · ${resumeAsk.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread" as const,
    },
    {
      key: "persisted_lifecycle_alignment",
      value: `${persistedLifecycleTrace.state} · ${persistedLifecycleTrace.anchor} · ${persistedLifecycleTrace.checkpointKey ?? "no-checkpoint"} · ${persistedLifecycleTrace.writeSideState} · ${persistedLifecycleTrace.refreshReason ?? "no-refresh-reason"}`,
      source: "run_thread" as const,
    },
    {
      key: "handoff_target",
      value:
        handoffPayload.state === "ready"
          ? `${handoffPayload.fromAgent} -> ${handoffPayload.toAgent} · ${handoffPayload.approvalTier ?? "review"}`
          : "no typed handoff payload",
      source: "run_thread" as const,
    },
    {
      key: "takeover_request",
      value: `${takeoverRequest.state} · ${takeoverRequest.action ?? "none"}`,
      source: "run_thread" as const,
    },
    {
      key: "takeover_activation",
      value: `${takeoverActivation.state} · ${takeoverActivation.action ?? "none"}`,
      source: "run_thread" as const,
    },
    {
      key: "active_control",
      value: `${takeoverActivation.latestEventKind} · ${takeoverActivation.currentOwner ?? "no-owner"}`,
      source: "run_thread" as const,
    },
    {
      key: "takeover_followthrough",
      value: `${takeoverFollowThrough.state} · ${takeoverFollowThrough.nextAction ?? takeoverFollowThrough.currentOwner ?? "no-next-action"}`,
      source: "run_thread" as const,
    },
    {
      key: "human_input_request",
      value: `${humanInputRequest.state} · ${humanInputRequest.checkpointKey ?? "no-checkpoint"}`,
      source: "run_thread" as const,
    },
  ];

  return {
    summary: `Debugger keeps ${history.length} trace events and ${variableSnapshot.length} snapshot fields on thread ${input.runThread.threadId}. Trace contract ${traceContract.state}/${traceContract.driver}/${traceContract.anchor}; write contract ${writeContract.state}/${writeContract.driver}/${writeContract.writeAnchor}; swarm spawn ${swarmSpawnContract.state}/${swarmSpawnContract.requestRecordState}/${swarmSpawnContract.driver}/${swarmSpawnContract.workspaceFlagState}/${swarmSpawnContract.budgetPosture}; read-only worker ${swarmReadOnlyWorkerContract.state}/${swarmReadOnlyWorkerContract.driver}/${swarmReadOnlyWorkerContract.allowlistedWorkers.join("/")}/${swarmReadOnlyWorkerContract.requestLifecycleState}/${swarmReadOnlyWorkerContract.handoffPreviewState}/${swarmReadOnlyWorkerContract.packetConsumptionIntentState}/${swarmReadOnlyWorkerContract.artifactBundlePlaceholderState}/${swarmReadOnlyWorkerContract.executionRecordState}/${swarmReadOnlyWorkerContract.artifactBundlePlaceholderRecordState}/${swarmReadOnlyWorkerContract.handoffConsumptionState}/${swarmReadOnlyWorkerContract.handoffConsumptionRecordState}/${swarmReadOnlyWorkerContract.executionLifecycleContract.state}/${swarmReadOnlyWorkerContract.executionLifecycleContract.driver}/${swarmReadOnlyWorkerContract.executionCandidateContract.state}/${swarmReadOnlyWorkerContract.executionCandidateContract.driver}/${swarmReadOnlyWorkerContract.executionCandidateContract.artifactMaterializationState}/${swarmReadOnlyWorkerContract.artifactMaterializationGuardContract.state}/${swarmReadOnlyWorkerContract.artifactMaterializationRecordState}/${swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.state}/${swarmReadOnlyWorkerContract.resultSideOutputContract.state}/${swarmReadOnlyWorkerContract.resultSideOutputContract.driver}/${swarmReadOnlyWorkerContract.resultSideOutputGuardContract.state}/${swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.state}/${swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.driver}/${swarmReadOnlyWorkerContract.outputConsumptionContract.state}/${swarmReadOnlyWorkerContract.outputConsumptionContract.driver}/${swarmReadOnlyWorkerContract.resultAdoptionContract.state}/${swarmReadOnlyWorkerContract.resultAdoptionContract.driver}/${swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state}/${swarmReadOnlyWorkerContract.outputAdoptionRecordState}/${swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state}/${swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.driver}/${swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state}/${swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver}/${swarmReadOnlyWorkerContract.executionPreflightState}/${swarmReadOnlyWorkerContract.executionGuardContract.state}/${swarmReadOnlyWorkerContract.selectedWorkerKind ?? "no-selection"}; swarm merge lane ${swarmVerificationMergeLaneContract.state}/${swarmVerificationMergeLaneContract.driver}/${swarmVerificationMergeLaneContract.mergeLaneTruth ?? "no-truth"}/${swarmVerificationMergeLaneContract.verificationStatus ?? "no-verification"}; recovery action ${recoveryActionContract.state}/${recoveryActionContract.driver}/${recoveryActionContract.action ?? "no-action"}; recovery lifecycle ${recoveryLifecycleContract.state}/${recoveryLifecycleContract.driver}/${recoveryLifecycleContract.anchor}/${recoveryLifecycleContract.nextTransition}; recovery transition ${recoveryTransitionContract.state}/${recoveryTransitionContract.driver}/${recoveryTransitionContract.anchor}/${recoveryTransitionContract.transition}; recovery state machine ${recoveryStateMachineContract.phase}/${recoveryStateMachineContract.transitionState}/${recoveryStateMachineContract.currentTransition}; recovery execution ${recoveryExecutionContract.state}/${recoveryExecutionContract.currentTransition}/${recoveryExecutionContract.canExecute ? "execute" : "hold"}; persisted lifecycle ${persistedLifecycleTrace.state}/${persistedLifecycleTrace.anchor}/${persistedLifecycleTrace.writeSideState}/${persistedLifecycleTrace.refreshReason ?? "no-refresh-reason"}; resume ask ${resumeAsk.mode}; takeover request ${takeoverRequest.state}; active control ${takeoverActivation.state}/${takeoverActivation.latestEventKind}; takeover follow-through ${takeoverFollowThrough.state}; human input request ${humanInputRequest.state}; handoff ${handoffPayload.state}; result acknowledgement ${input.runThread.resultAcknowledgement.state}; result flow ${input.runThread.resultFlow.requiresOperatorAttentionCount}/${input.runThread.resultFlow.resolvedCount}; forward flow ${input.runThread.forwardFlow.state}/${input.runThread.forwardFlow.attentionCount}; closeout flow ${input.runThread.closeoutFlow.state}/${input.runThread.closeoutFlow.openCount}; closeout summary ${input.runThread.closeoutSummary.state}/${input.runThread.closeoutSummary.driver}; closeout resolution ${input.runThread.closeoutResolution.state}/${input.runThread.closeoutResolution.decision ?? "no-decision"}; closeout resolution follow-through ${input.runThread.closeoutResolutionFollowThrough.state}/${input.runThread.closeoutResolutionFollowThrough.decision ?? "no-decision"}; closeout outcome ${input.runThread.closeoutOutcome.state}/${input.runThread.closeoutOutcome.decision ?? "no-decision"}; close request ${input.runThread.closeRequest.state}; close lifecycle ${input.runThread.closeLifecycle.state}/${input.runThread.closeLifecycle.driver}; close control ${input.runThread.closeControl.state}/${input.runThread.closeControl.driver}; close control flow ${input.runThread.closeControlFlow.state}/${input.runThread.closeControlFlow.driver}; close decision flow ${input.runThread.closeDecisionFlow.state}/${input.runThread.closeDecisionFlow.driver}; close decision control ${input.runThread.closeDecisionControlSummary.state}/${input.runThread.closeDecisionControlSummary.driver}; close resolution ${input.runThread.closeResolutionSummary.state}/${input.runThread.closeResolutionSummary.driver}; close resolution forward ${input.runThread.closeResolutionForwardSummary.state}/${input.runThread.closeResolutionForwardSummary.driver}; close resolution control ${input.runThread.closeResolutionControlSummary.state}/${input.runThread.closeResolutionControlSummary.driver}; close posture ${input.runThread.closePostureSummary.state}/${input.runThread.closePostureSummary.driver}; close posture forward ${input.runThread.closePostureForwardSummary.state}/${input.runThread.closePostureForwardSummary.driver}; settlement review ${input.runThread.settlementReview.state}; closeout confirmation ${input.runThread.closeoutConfirmation.state}; closeout refresh ${input.runThread.closeoutRefresh.state}; settlement flow ${input.runThread.settlementFlow.state}/${input.runThread.settlementFlow.openCloseoutCount}.`,
    boundaryNote:
      "Debugger is read-only in this layer. It does not expand execution authority, send authority, or state-write authority.",
    history,
    variableSnapshot,
    traceContract,
    writeContract,
    swarmSpawnContract,
    swarmReadOnlyWorkerContract,
    swarmVerificationMergeLaneContract,
    recoveryActionContract,
    recoveryLifecycleContract,
    recoveryTransitionContract,
    recoveryStateMachineContract,
    recoveryExecutionContract,
    replayAssistance,
    persistedLifecycleTrace,
    takeoverAssistance,
    takeoverRequest,
    takeoverActivation,
    takeoverFollowThrough,
    interruptReason,
    resumeAsk,
    handoffPayload,
    humanInputCheckpoint: input.runThread.humanInputCheckpoint,
    humanInputRequest,
  };
}
