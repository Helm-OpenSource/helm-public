import type {
  HelmV21RunThreadContract,
  HelmV21RunThreadPersistedControlPlaneLifecycle,
  HelmV21RunThreadPersistedControlPlaneLifecycleCompactionPolicy,
  HelmV21RunThreadPersistedControlPlaneLifecycleGuardPolicy,
  HelmV21RunThreadPersistedControlPlaneLifecycleRepairPolicy,
  HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason,
  HelmV21RunThreadPersistedControlPlaneLifecycleReconciliationPolicy,
  HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot,
  HelmV21RunThreadPersistedControlPlaneLifecycleWriteSide,
} from "@/lib/helm-v2/contracts";
import { safeParseJson, trimText } from "@/lib/utils";

export const RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_SCHEMA_VERSION =
  "helm-v2-run-thread-control-plane-lifecycle-v1" as const;

const RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_BOUNDARY_NOTE =
  "Persisted run-thread control-plane lifecycle stays review-first and auditable. It stores a bounded thread-level control-plane snapshot on RuntimeSession for recovery and observability, but it does not create a workflow engine, widen authority, or replace the event-derived runtime truth.";

const RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_REFRESH_TRIGGERS = [
  "control_plane_write",
  "checkpoint_resume",
  "continuity_checkpoint",
] as const;

function deriveWriteSideSnapshot(input: {
  runThread: Pick<
    HelmV21RunThreadContract,
    | "resume"
    | "latestCheckpoint"
    | "replayRequest"
    | "humanInputCheckpoint"
  >;
  refreshReason?: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
  refreshSource?: string | null;
}) {
  if (
    input.refreshReason === "checkpoint_resume" &&
    input.runThread.resume.resumedFromCheckpointKey !== null
  ) {
    return {
      lastRefreshReason: input.refreshReason,
      lastRefreshSource: trimText(input.refreshSource, 160) ?? null,
      writeAnchor: "resume" as const,
      writeCheckpointKey: input.runThread.resume.resumedFromCheckpointKey,
      writeResumeToken: input.runThread.resume.resumeToken,
    };
  }

  if (
    input.runThread.humanInputCheckpoint.state === "checkpoint_ready" &&
    input.runThread.humanInputCheckpoint.checkpointKey !== null
  ) {
    return {
      lastRefreshReason: input.refreshReason ?? null,
      lastRefreshSource: trimText(input.refreshSource, 160) ?? null,
      writeAnchor: "human_input" as const,
      writeCheckpointKey: input.runThread.humanInputCheckpoint.checkpointKey,
      writeResumeToken: input.runThread.humanInputCheckpoint.checkpointKey,
    };
  }

  if (
    input.runThread.replayRequest.mode !== "none" &&
    input.runThread.replayRequest.checkpointKey !== null
  ) {
    return {
      lastRefreshReason: input.refreshReason ?? null,
      lastRefreshSource: trimText(input.refreshSource, 160) ?? null,
      writeAnchor: "replay" as const,
      writeCheckpointKey: input.runThread.replayRequest.checkpointKey,
      writeResumeToken: input.runThread.replayRequest.resumeToken,
    };
  }

  if (input.runThread.latestCheckpoint?.checkpointKey) {
    return {
      lastRefreshReason: input.refreshReason ?? null,
      lastRefreshSource: trimText(input.refreshSource, 160) ?? null,
      writeAnchor: "checkpoint" as const,
      writeCheckpointKey: input.runThread.latestCheckpoint.checkpointKey,
      writeResumeToken: input.runThread.latestCheckpoint.resumeToken,
    };
  }

  return {
    lastRefreshReason: input.refreshReason ?? null,
    lastRefreshSource: trimText(input.refreshSource, 160) ?? null,
    writeAnchor: "none" as const,
    writeCheckpointKey: null,
    writeResumeToken: null,
  };
}

function toComparableStateMap(runThread: Pick<
  HelmV21RunThreadContract,
  | "runId"
  | "threadId"
  | "stageKey"
  | "updatedAt"
  | "lifecycle"
  | "resume"
  | "latestCheckpoint"
  | "checkpointLineage"
  | "replay"
  | "replayRequest"
  | "requestPosture"
  | "humanInputCheckpoint"
  | "resultAcknowledgement"
  | "resultFlow"
  | "forwardFlow"
  | "settlementReview"
  | "closeoutSummary"
  | "closeoutResolution"
  | "closeoutResolutionFollowThrough"
  | "closeoutOutcome"
  | "closeRequest"
  | "closeLifecycle"
  | "closeControl"
  | "closeControlFlow"
  | "closeDecisionFlow"
  | "closeDecisionControlSummary"
  | "closeResolutionSummary"
  | "closeResolutionForwardSummary"
  | "closeResolutionControlSummary"
  | "closePostureSummary"
  | "closePostureForwardSummary"
>) {
  return {
    runId: runThread.runId,
    threadId: runThread.threadId,
    stageKey: runThread.stageKey,
    lifecycleState: runThread.lifecycle,
    resumeState: runThread.resume.state,
    latestCheckpointState: runThread.latestCheckpoint?.state ?? "not_available",
    latestCheckpointKey: runThread.latestCheckpoint?.checkpointKey ?? null,
    latestCheckpointResumeToken: runThread.latestCheckpoint?.resumeToken ?? null,
    checkpointLineageDepth: runThread.checkpointLineage.length,
    replayRequestMode: runThread.replayRequest.mode,
    replayCheckpointKey: runThread.replayRequest.checkpointKey,
    replayResumeToken: runThread.replayRequest.resumeToken,
    replayEventLogEntries: runThread.replay.eventLogEntries,
    requestState: runThread.requestPosture.takeoverState,
    humanInputState: runThread.requestPosture.humanInputState,
    humanInputCheckpointState: runThread.humanInputCheckpoint.state,
    humanInputCheckpointKey: runThread.humanInputCheckpoint.checkpointKey,
    resultAcknowledgementState: runThread.resultAcknowledgement.state,
    resultFlowState: runThread.resultFlow.latestState,
    forwardFlowState: runThread.forwardFlow.state,
    settlementReviewState: runThread.settlementReview.state,
    closeoutSummaryState: runThread.closeoutSummary.state,
    closeoutResolutionState: runThread.closeoutResolution.state,
    closeoutResolutionFollowThroughState: runThread.closeoutResolutionFollowThrough.state,
    closeoutOutcomeState: runThread.closeoutOutcome.state,
    closeRequestState: runThread.closeRequest.state,
    closeLifecycleState: runThread.closeLifecycle.state,
    closeControlState: runThread.closeControl.state,
    closeControlFlowState: runThread.closeControlFlow.state,
    closeDecisionFlowState: runThread.closeDecisionFlow.state,
    closeDecisionControlState: runThread.closeDecisionControlSummary.state,
    closeResolutionState: runThread.closeResolutionSummary.state,
    closeResolutionForwardState: runThread.closeResolutionForwardSummary.state,
    closeResolutionControlState: runThread.closeResolutionControlSummary.state,
    closePostureState: runThread.closePostureSummary.state,
    closePostureForwardState: runThread.closePostureForwardSummary.state,
  };
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

export function buildRunThreadPersistedControlPlaneLifecycleSnapshot(
  runThread: Pick<
    HelmV21RunThreadContract,
    | "runId"
    | "threadId"
    | "stageKey"
    | "updatedAt"
    | "lifecycle"
    | "resume"
    | "latestCheckpoint"
    | "checkpointLineage"
    | "replay"
    | "replayRequest"
    | "requestPosture"
    | "humanInputCheckpoint"
    | "resultAcknowledgement"
    | "resultFlow"
    | "forwardFlow"
    | "settlementReview"
    | "closeoutSummary"
    | "closeoutResolution"
    | "closeoutResolutionFollowThrough"
    | "closeoutOutcome"
    | "closeRequest"
    | "closeLifecycle"
    | "closeControl"
    | "closeControlFlow"
    | "closeDecisionFlow"
    | "closeDecisionControlSummary"
    | "closeResolutionSummary"
    | "closeResolutionForwardSummary"
    | "closeResolutionControlSummary"
    | "closePostureSummary"
    | "closePostureForwardSummary"
  >,
  persistedAt = new Date(),
  writeContext?: {
    refreshReason?: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
    refreshSource?: string | null;
  },
): HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot {
  const writeSideSnapshot = deriveWriteSideSnapshot({
    runThread,
    refreshReason: writeContext?.refreshReason ?? null,
    refreshSource: writeContext?.refreshSource ?? null,
  });
  return {
    schemaVersion: RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_SCHEMA_VERSION,
    persistedAt,
    sourceUpdatedAt: runThread.updatedAt,
    runId: runThread.runId,
    threadId: runThread.threadId,
    stageKey: runThread.stageKey,
    lifecycleState: runThread.lifecycle,
    resumeState: runThread.resume.state,
    latestCheckpointState: runThread.latestCheckpoint?.state ?? "not_available",
    latestCheckpointKey: runThread.latestCheckpoint?.checkpointKey ?? null,
    latestCheckpointResumeToken: runThread.latestCheckpoint?.resumeToken ?? null,
    checkpointLineageDepth: runThread.checkpointLineage.length,
    replayRequestMode: runThread.replayRequest.mode,
    replayCheckpointKey: runThread.replayRequest.checkpointKey,
    replayResumeToken: runThread.replayRequest.resumeToken,
    replayEventLogEntries: runThread.replay.eventLogEntries,
    requestState: runThread.requestPosture.takeoverState,
    humanInputState: runThread.requestPosture.humanInputState,
    humanInputCheckpointState: runThread.humanInputCheckpoint.state,
    humanInputCheckpointKey: runThread.humanInputCheckpoint.checkpointKey,
    resultAcknowledgementState: runThread.resultAcknowledgement.state,
    resultFlowState: runThread.resultFlow.latestState,
    forwardFlowState: runThread.forwardFlow.state,
    settlementReviewState: runThread.settlementReview.state,
    closeoutSummaryState: runThread.closeoutSummary.state,
    closeoutResolutionState: runThread.closeoutResolution.state,
    closeoutResolutionFollowThroughState: runThread.closeoutResolutionFollowThrough.state,
    closeoutOutcomeState: runThread.closeoutOutcome.state,
    closeRequestState: runThread.closeRequest.state,
    closeLifecycleState: runThread.closeLifecycle.state,
    closeControlState: runThread.closeControl.state,
    closeControlFlowState: runThread.closeControlFlow.state,
    closeDecisionFlowState: runThread.closeDecisionFlow.state,
    closeDecisionControlState: runThread.closeDecisionControlSummary.state,
    closeResolutionState: runThread.closeResolutionSummary.state,
    closeResolutionForwardState: runThread.closeResolutionForwardSummary.state,
    closeResolutionControlState: runThread.closeResolutionControlSummary.state,
    closePostureState: runThread.closePostureSummary.state,
    closePostureForwardState: runThread.closePostureForwardSummary.state,
    lastRefreshReason: writeSideSnapshot.lastRefreshReason,
    lastRefreshSource: writeSideSnapshot.lastRefreshSource,
    writeAnchor: writeSideSnapshot.writeAnchor,
    writeCheckpointKey: writeSideSnapshot.writeCheckpointKey,
    writeResumeToken: writeSideSnapshot.writeResumeToken,
  };
}

export function parseRunThreadPersistedControlPlaneLifecycleSnapshot(
  value: string | null | undefined,
): HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null {
  const parsed = safeParseJson<Record<string, unknown> | null>(value, null);
  if (!parsed) return null;
  if (parsed.schemaVersion !== RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_SCHEMA_VERSION) {
    return null;
  }

  const persistedAt = coerceDate(parsed.persistedAt);
  const sourceUpdatedAt = coerceDate(parsed.sourceUpdatedAt);
  if (!persistedAt || !sourceUpdatedAt) return null;
  if (typeof parsed.runId !== "string" || typeof parsed.threadId !== "string" || typeof parsed.stageKey !== "string") {
    return null;
  }

  return {
    schemaVersion: RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_SCHEMA_VERSION,
    persistedAt,
    sourceUpdatedAt,
    runId: parsed.runId,
    threadId: parsed.threadId,
    stageKey: parsed.stageKey,
    lifecycleState: String(parsed.lifecycleState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["lifecycleState"],
    resumeState: String(parsed.resumeState ?? "not_available") as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["resumeState"],
    latestCheckpointState: String(parsed.latestCheckpointState ?? "not_available") as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["latestCheckpointState"],
    latestCheckpointKey: typeof parsed.latestCheckpointKey === "string" ? parsed.latestCheckpointKey : null,
    latestCheckpointResumeToken:
      typeof parsed.latestCheckpointResumeToken === "string"
        ? parsed.latestCheckpointResumeToken
        : null,
    checkpointLineageDepth:
      typeof parsed.checkpointLineageDepth === "number" &&
      Number.isFinite(parsed.checkpointLineageDepth) &&
      parsed.checkpointLineageDepth >= 0
        ? parsed.checkpointLineageDepth
        : 0,
    replayRequestMode: String(parsed.replayRequestMode ?? "none") as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["replayRequestMode"],
    replayCheckpointKey: typeof parsed.replayCheckpointKey === "string" ? parsed.replayCheckpointKey : null,
    replayResumeToken: typeof parsed.replayResumeToken === "string" ? parsed.replayResumeToken : null,
    replayEventLogEntries:
      typeof parsed.replayEventLogEntries === "number" &&
      Number.isFinite(parsed.replayEventLogEntries) &&
      parsed.replayEventLogEntries >= 0
        ? parsed.replayEventLogEntries
        : 0,
    requestState: String(parsed.requestState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["requestState"],
    humanInputState: String(parsed.humanInputState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["humanInputState"],
    humanInputCheckpointState: String(
      parsed.humanInputCheckpointState ?? "not_available",
    ) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["humanInputCheckpointState"],
    humanInputCheckpointKey:
      typeof parsed.humanInputCheckpointKey === "string"
        ? parsed.humanInputCheckpointKey
        : null,
    resultAcknowledgementState: String(parsed.resultAcknowledgementState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["resultAcknowledgementState"],
    resultFlowState: String(parsed.resultFlowState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["resultFlowState"],
    forwardFlowState: String(parsed.forwardFlowState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["forwardFlowState"],
    settlementReviewState: String(parsed.settlementReviewState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["settlementReviewState"],
    closeoutSummaryState: String(parsed.closeoutSummaryState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeoutSummaryState"],
    closeoutResolutionState: String(parsed.closeoutResolutionState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeoutResolutionState"],
    closeoutResolutionFollowThroughState: String(parsed.closeoutResolutionFollowThroughState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeoutResolutionFollowThroughState"],
    closeoutOutcomeState: String(parsed.closeoutOutcomeState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeoutOutcomeState"],
    closeRequestState: String(parsed.closeRequestState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeRequestState"],
    closeLifecycleState: String(parsed.closeLifecycleState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeLifecycleState"],
    closeControlState: String(parsed.closeControlState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeControlState"],
    closeControlFlowState: String(parsed.closeControlFlowState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeControlFlowState"],
    closeDecisionFlowState: String(parsed.closeDecisionFlowState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeDecisionFlowState"],
    closeDecisionControlState: String(parsed.closeDecisionControlState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeDecisionControlState"],
    closeResolutionState: String(parsed.closeResolutionState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeResolutionState"],
    closeResolutionForwardState: String(parsed.closeResolutionForwardState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeResolutionForwardState"],
    closeResolutionControlState: String(parsed.closeResolutionControlState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closeResolutionControlState"],
    closePostureState: String(parsed.closePostureState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closePostureState"],
    closePostureForwardState: String(parsed.closePostureForwardState) as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["closePostureForwardState"],
    lastRefreshReason:
      typeof parsed.lastRefreshReason === "string"
        ? (parsed.lastRefreshReason as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["lastRefreshReason"])
        : null,
    lastRefreshSource: typeof parsed.lastRefreshSource === "string" ? parsed.lastRefreshSource : null,
    writeAnchor:
      typeof parsed.writeAnchor === "string"
        ? (parsed.writeAnchor as HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot["writeAnchor"])
        : "none",
    writeCheckpointKey: typeof parsed.writeCheckpointKey === "string" ? parsed.writeCheckpointKey : null,
    writeResumeToken: typeof parsed.writeResumeToken === "string" ? parsed.writeResumeToken : null,
  };
}

export function diffRunThreadPersistedControlPlaneLifecycleSnapshot(input: {
  runThread: Pick<
    HelmV21RunThreadContract,
    | "runId"
    | "threadId"
    | "stageKey"
    | "updatedAt"
    | "lifecycle"
    | "resume"
    | "latestCheckpoint"
    | "checkpointLineage"
    | "replay"
    | "replayRequest"
    | "requestPosture"
    | "humanInputCheckpoint"
    | "resultAcknowledgement"
    | "resultFlow"
    | "forwardFlow"
    | "settlementReview"
    | "closeoutSummary"
    | "closeoutResolution"
    | "closeoutResolutionFollowThrough"
    | "closeoutOutcome"
    | "closeRequest"
    | "closeLifecycle"
    | "closeControl"
    | "closeControlFlow"
    | "closeDecisionFlow"
    | "closeDecisionControlSummary"
    | "closeResolutionSummary"
    | "closeResolutionForwardSummary"
    | "closeResolutionControlSummary"
    | "closePostureSummary"
    | "closePostureForwardSummary"
  >;
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot;
}) {
  const current = toComparableStateMap(input.runThread);
  const persisted = {
    runId: input.snapshot.runId,
    threadId: input.snapshot.threadId,
    stageKey: input.snapshot.stageKey,
    lifecycleState: input.snapshot.lifecycleState,
    resumeState: input.snapshot.resumeState,
    latestCheckpointState: input.snapshot.latestCheckpointState,
    latestCheckpointKey: input.snapshot.latestCheckpointKey,
    latestCheckpointResumeToken: input.snapshot.latestCheckpointResumeToken,
    checkpointLineageDepth: input.snapshot.checkpointLineageDepth,
    replayRequestMode: input.snapshot.replayRequestMode,
    replayCheckpointKey: input.snapshot.replayCheckpointKey,
    replayResumeToken: input.snapshot.replayResumeToken,
    replayEventLogEntries: input.snapshot.replayEventLogEntries,
    requestState: input.snapshot.requestState,
    humanInputState: input.snapshot.humanInputState,
    humanInputCheckpointState: input.snapshot.humanInputCheckpointState,
    humanInputCheckpointKey: input.snapshot.humanInputCheckpointKey,
    resultAcknowledgementState: input.snapshot.resultAcknowledgementState,
    resultFlowState: input.snapshot.resultFlowState,
    forwardFlowState: input.snapshot.forwardFlowState,
    settlementReviewState: input.snapshot.settlementReviewState,
    closeoutSummaryState: input.snapshot.closeoutSummaryState,
    closeoutResolutionState: input.snapshot.closeoutResolutionState,
    closeoutResolutionFollowThroughState: input.snapshot.closeoutResolutionFollowThroughState,
    closeoutOutcomeState: input.snapshot.closeoutOutcomeState,
    closeRequestState: input.snapshot.closeRequestState,
    closeLifecycleState: input.snapshot.closeLifecycleState,
    closeControlState: input.snapshot.closeControlState,
    closeControlFlowState: input.snapshot.closeControlFlowState,
    closeDecisionFlowState: input.snapshot.closeDecisionFlowState,
    closeDecisionControlState: input.snapshot.closeDecisionControlState,
    closeResolutionState: input.snapshot.closeResolutionState,
    closeResolutionForwardState: input.snapshot.closeResolutionForwardState,
    closeResolutionControlState: input.snapshot.closeResolutionControlState,
    closePostureState: input.snapshot.closePostureState,
    closePostureForwardState: input.snapshot.closePostureForwardState,
  };

  return (Object.keys(current) as Array<keyof typeof current>).filter(
    (key) => current[key] !== persisted[key],
  );
}

export function diffRunThreadPersistedControlPlaneLifecycleWriteSide(input: {
  runThread: Pick<
    HelmV21RunThreadContract,
    | "resume"
    | "latestCheckpoint"
    | "replayRequest"
    | "humanInputCheckpoint"
  >;
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  refreshReason?: HelmV21RunThreadPersistedControlPlaneLifecycleRefreshReason | null;
  refreshSource?: string | null;
}) {
  if (!input.snapshot) {
    return ["snapshot"] as const;
  }

  const expected = deriveWriteSideSnapshot({
    runThread: input.runThread,
    refreshReason: input.refreshReason ?? null,
    refreshSource: input.refreshSource ?? null,
  });
  const persisted = {
    lastRefreshReason: input.snapshot.lastRefreshReason,
    lastRefreshSource: input.snapshot.lastRefreshSource,
    writeAnchor: input.snapshot.writeAnchor,
    writeCheckpointKey: input.snapshot.writeCheckpointKey,
    writeResumeToken: input.snapshot.writeResumeToken,
  };

  return (Object.keys(expected) as Array<keyof typeof expected>).filter(
    (key) => expected[key] !== persisted[key],
  );
}

function buildWriteSide(input: {
  state: HelmV21RunThreadPersistedControlPlaneLifecycle["state"];
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  reconciliationNextAction: string | null;
}): HelmV21RunThreadPersistedControlPlaneLifecycleWriteSide {
  if (!input.snapshot) {
    return {
      state: input.state === "missing" ? "not_persisted" : "refresh_required",
      refreshReason: null,
      refreshSource: null,
      anchor: "none",
      checkpointKey: null,
      resumeToken: null,
      summary:
        input.state === "missing"
          ? "No persisted lifecycle snapshot has been written yet, so replay and recovery writes still rely on event-derived thread truth."
          : "Persisted lifecycle payload is not currently trustworthy, so replay and recovery writes should refresh the single-slot snapshot before relying on stored anchor metadata.",
      nextAction: input.reconciliationNextAction,
    };
  }

  if (input.state === "invalid" || input.state === "drifted") {
    return {
      state: "refresh_required",
      refreshReason: input.snapshot.lastRefreshReason,
      refreshSource: input.snapshot.lastRefreshSource,
      anchor: input.snapshot.writeAnchor,
      checkpointKey: input.snapshot.writeCheckpointKey,
      resumeToken: input.snapshot.writeResumeToken,
      summary: trimText(
        `Persisted lifecycle still remembers ${input.snapshot.writeAnchor} as the last write anchor, but the stored snapshot is no longer trustworthy for replay/recovery writes and must be refreshed before reuse.`,
        220,
      ),
      nextAction: input.reconciliationNextAction,
    };
  }

  const anchorState =
    input.snapshot.writeAnchor === "human_input"
      ? "human_input_anchor_written"
      : input.snapshot.writeAnchor === "replay"
        ? "replay_anchor_written"
        : input.snapshot.writeAnchor === "resume"
          ? "resume_anchor_written"
          : input.snapshot.writeAnchor === "checkpoint"
            ? "checkpoint_anchor_written"
            : "thread_truth_written";

  const reasonSummary = input.snapshot.lastRefreshReason
    ? `Latest persisted refresh came from ${input.snapshot.lastRefreshReason}${input.snapshot.lastRefreshSource ? ` (${input.snapshot.lastRefreshSource})` : ""}.`
    : "Latest persisted refresh reason was not recorded.";
  const anchorSummary =
    input.snapshot.writeAnchor === "none"
      ? "Stored write-side contract currently tracks thread truth without a checkpoint anchor."
      : `Stored write-side contract keeps ${input.snapshot.writeAnchor} anchor ${input.snapshot.writeCheckpointKey ?? "without checkpoint key"} operator-visible for replay and recovery.`;

  return {
    state: anchorState,
    refreshReason: input.snapshot.lastRefreshReason,
    refreshSource: input.snapshot.lastRefreshSource,
    anchor: input.snapshot.writeAnchor,
    checkpointKey: input.snapshot.writeCheckpointKey,
    resumeToken: input.snapshot.writeResumeToken,
    summary: trimText(`${reasonSummary} ${anchorSummary}`, 220),
    nextAction: input.snapshot.writeAnchor === "none" ? "Write a bounded checkpoint or replay anchor before relying on persisted recovery metadata." : null,
  };
}

export function shouldReuseRunThreadPersistedControlPlaneLifecycleSnapshot(input: {
  runThread: Pick<
    HelmV21RunThreadContract,
    | "runId"
    | "threadId"
    | "stageKey"
    | "updatedAt"
    | "lifecycle"
    | "resume"
    | "latestCheckpoint"
    | "checkpointLineage"
    | "replay"
    | "replayRequest"
    | "requestPosture"
    | "humanInputCheckpoint"
    | "resultAcknowledgement"
    | "resultFlow"
    | "forwardFlow"
    | "settlementReview"
    | "closeoutSummary"
    | "closeoutResolution"
    | "closeoutResolutionFollowThrough"
    | "closeoutOutcome"
    | "closeRequest"
    | "closeLifecycle"
    | "closeControl"
    | "closeControlFlow"
    | "closeDecisionFlow"
    | "closeDecisionControlSummary"
    | "closeResolutionSummary"
    | "closeResolutionForwardSummary"
    | "closeResolutionControlSummary"
    | "closePostureSummary"
    | "closePostureForwardSummary"
  >;
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  parseFailed?: boolean;
}) {
  if (input.parseFailed || !input.snapshot) {
    return false;
  }

  return buildGuardPolicy({
    runThreadUpdatedAt: input.runThread.updatedAt,
    snapshot: input.snapshot,
    driftKeys: diffRunThreadPersistedControlPlaneLifecycleSnapshot({
      runThread: input.runThread,
      snapshot: input.snapshot,
    }),
  }).shouldReuseSnapshot;
}

function buildGuardPolicy(input: {
  runThreadUpdatedAt: Date;
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  parseFailed?: boolean;
  driftKeys: string[];
}): HelmV21RunThreadPersistedControlPlaneLifecycleGuardPolicy {
  const base = {
    runtimeReadMode: "event_truth_primary" as const,
    snapshotMode: "runtime_session_single_snapshot" as const,
  };

  if (input.parseFailed) {
    return {
      ...base,
      state: "fallback_to_event_truth",
      shouldReuseSnapshot: false,
      shouldPersistSnapshot: true,
      summary:
        "Persisted lifecycle payload is unreadable, so runtime should keep event-derived truth primary and rewrite the single-slot snapshot on the current safe refresh instead of reusing the stored payload.",
      nextAction:
        "Rewrite the invalid single-slot persisted lifecycle payload on the current review-first control-plane refresh.",
    };
  }

  if (!input.snapshot) {
    return {
      ...base,
      state: "backfill_required",
      shouldReuseSnapshot: false,
      shouldPersistSnapshot: true,
      summary:
        "No persisted lifecycle snapshot exists yet, so runtime should keep event-derived truth primary and backfill the first bounded single-slot snapshot on the current safe refresh.",
      nextAction:
        "Backfill the first single-slot persisted lifecycle snapshot on the current review-first control-plane refresh.",
    };
  }

  if (input.driftKeys.length > 0) {
    return {
      ...base,
      state: "rewrite_required",
      shouldReuseSnapshot: false,
      shouldPersistSnapshot: true,
      summary: trimText(
        `Persisted lifecycle snapshot drifted on ${input.driftKeys.join(", ")}, so runtime should keep event-derived truth primary and rewrite the single-slot snapshot on the current safe refresh instead of reusing the stored payload.`,
        240,
      ),
      nextAction:
        "Rewrite the drifted single-slot persisted lifecycle snapshot on the current review-first control-plane refresh.",
    };
  }

  if (input.snapshot.sourceUpdatedAt.getTime() < input.runThreadUpdatedAt.getTime()) {
    return {
      ...base,
      state: "reuse_compacted_snapshot",
      shouldReuseSnapshot: true,
      shouldPersistSnapshot: false,
      summary:
        "Persisted lifecycle snapshot is materially aligned but older than the latest event timestamp, so runtime can keep event-derived truth primary and safely reuse the compacted single-slot snapshot.",
      nextAction: null,
    };
  }

  return {
    ...base,
    state: "reuse_current_snapshot",
    shouldReuseSnapshot: true,
    shouldPersistSnapshot: false,
    summary:
      "Persisted lifecycle snapshot is current and aligned, so runtime can safely reuse the existing single-slot snapshot.",
    nextAction: null,
  };
}

function buildCompactionPolicy(input: {
  runThreadUpdatedAt: Date;
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  parseFailed?: boolean;
  driftKeys: string[];
}): HelmV21RunThreadPersistedControlPlaneLifecycleCompactionPolicy {
  const base = {
    slot: "runtime_session_single_snapshot" as const,
    writeMode: "replace_on_material_state_change" as const,
    refreshTriggers: [...RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_REFRESH_TRIGGERS],
  };

  if (input.parseFailed) {
    return {
      ...base,
      state: "invalid",
      summary:
        "Persisted lifecycle payload is unreadable, so compaction stays disabled until a fresh bounded snapshot replaces it.",
      nextAction:
        "Replace the unreadable persisted lifecycle payload with a fresh bounded snapshot on the next control-plane refresh.",
    };
  }

  if (!input.snapshot) {
    return {
      ...base,
      state: "backfill_required",
      summary:
        "No persisted lifecycle snapshot exists yet, so the first bounded snapshot still needs to be written into the RuntimeSession single-slot store.",
      nextAction:
        "Write the first bounded thread-level control-plane snapshot into RuntimeSession before relying on persisted lifecycle recovery cues.",
    };
  }

  if (input.driftKeys.length > 0) {
    return {
      ...base,
      state: "replace_required",
      summary: trimText(
        `Persisted lifecycle snapshot no longer matches material thread state on ${input.driftKeys.join(", ")}, so the single-slot snapshot should be replaced on the next bounded refresh.`,
        240,
      ),
      nextAction:
        "Replace the persisted single-slot snapshot with a fresh bounded control-plane snapshot instead of keeping the drifted payload.",
    };
  }

  if (input.snapshot.sourceUpdatedAt.getTime() < input.runThreadUpdatedAt.getTime()) {
    return {
      ...base,
      state: "compacted",
      summary:
        "Material control-plane state is still aligned, so the RuntimeSession single-slot snapshot can stay compacted even though newer events advanced the event-derived thread timestamp.",
      nextAction:
        "Keep reusing the current persisted snapshot until a material control-plane state change requires replacement.",
    };
  }

  return {
    ...base,
    state: "current",
    summary:
      "Persisted lifecycle snapshot is the current single-slot material snapshot for this run thread and does not need replacement.",
    nextAction: null,
  };
}

function buildReconciliationPolicy(input: {
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  parseFailed?: boolean;
  driftKeys: string[];
}): HelmV21RunThreadPersistedControlPlaneLifecycleReconciliationPolicy {
  const base = {
    sourceOfTruth: "event_derived_run_thread" as const,
    fallbackMode: "bounded_snapshot_with_event_truth_fallback" as const,
  };

  if (input.parseFailed) {
    return {
      ...base,
      state: "fallback_to_event_truth",
      summary:
        "Persisted lifecycle payload is unreadable, so runtime must fall back to event-derived thread truth until a fresh snapshot is written.",
      nextAction:
        "Refresh the persisted lifecycle payload before using it again as a recovery and observability aid.",
    };
  }

  if (!input.snapshot) {
    return {
      ...base,
      state: "backfill_required",
      summary:
        "Event-derived thread truth is current, but no persisted lifecycle snapshot exists yet for bounded recovery and observability.",
      nextAction:
        "Backfill the first persisted lifecycle snapshot for this run thread when the next bounded control-plane refresh occurs.",
    };
  }

  if (input.driftKeys.length > 0) {
    return {
      ...base,
      state: "refresh_required",
      summary: trimText(
        `Persisted lifecycle snapshot drifted on ${input.driftKeys.join(", ")}, so runtime should keep trusting event-derived truth until the snapshot is refreshed.`,
        240,
      ),
      nextAction:
        "Refresh the persisted lifecycle snapshot before treating it as reconciled with the current event-derived thread truth.",
    };
  }

  return {
    ...base,
    state: "steady",
    summary:
      "Persisted lifecycle snapshot and event-derived thread truth are reconciled, so runtime can keep using the bounded snapshot as a recovery and observability aid.",
    nextAction: null,
  };
}

function buildRepairPolicy(input: {
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  parseFailed?: boolean;
  driftKeys: string[];
}): HelmV21RunThreadPersistedControlPlaneLifecycleRepairPolicy {
  const base = {
    guardMode: "review_first_single_slot_rewrite_only" as const,
    repairMode: "bounded_snapshot_rewrite_only" as const,
    repairTriggers: [...RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_REFRESH_TRIGGERS],
  };

  if (input.parseFailed) {
    return {
      ...base,
      state: "rewrite_invalid_snapshot",
      summary:
        "Persisted lifecycle payload is unreadable, so the only allowed repair is replacing the RuntimeSession single-slot payload with a fresh bounded snapshot on the next safe refresh.",
      nextAction:
        "Replace the invalid persisted lifecycle payload with a fresh bounded snapshot on the next review-first control-plane refresh.",
    };
  }

  if (!input.snapshot) {
    return {
      ...base,
      state: "backfill_on_next_refresh",
      summary:
        "No persisted lifecycle snapshot exists yet, so runtime keeps event-derived truth active and only allows a first bounded snapshot write on the next safe refresh.",
      nextAction:
        "Backfill the first persisted lifecycle snapshot on the next review-first control-plane refresh.",
    };
  }

  if (input.driftKeys.length > 0) {
    return {
      ...base,
      state: "rewrite_drifted_snapshot",
      summary: trimText(
        `Persisted lifecycle snapshot drifted on ${input.driftKeys.join(", ")}, so runtime should keep event-derived truth active and only repair by rewriting the single-slot snapshot on the next safe refresh.`,
        240,
      ),
      nextAction:
        "Rewrite the drifted persisted lifecycle snapshot on the next review-first control-plane refresh instead of trusting the stored payload.",
    };
  }

  return {
    ...base,
    state: "not_required",
    summary:
      "Persisted lifecycle snapshot is currently aligned, so no repair is required beyond the existing review-first bounded refresh policy.",
    nextAction: null,
  };
}

export function buildRunThreadPersistedControlPlaneLifecycle(input: {
  runThread: Pick<
    HelmV21RunThreadContract,
    | "runId"
    | "threadId"
    | "stageKey"
    | "updatedAt"
    | "lifecycle"
    | "resume"
    | "latestCheckpoint"
    | "checkpointLineage"
    | "replay"
    | "replayRequest"
    | "requestPosture"
    | "humanInputCheckpoint"
    | "resultAcknowledgement"
    | "resultFlow"
    | "forwardFlow"
    | "settlementReview"
    | "closeoutSummary"
    | "closeoutResolution"
    | "closeoutResolutionFollowThrough"
    | "closeoutOutcome"
    | "closeRequest"
    | "closeLifecycle"
    | "closeControl"
    | "closeControlFlow"
    | "closeDecisionFlow"
    | "closeDecisionControlSummary"
    | "closeResolutionSummary"
    | "closeResolutionForwardSummary"
    | "closeResolutionControlSummary"
    | "closePostureSummary"
    | "closePostureForwardSummary"
  >;
  snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
  parseFailed?: boolean;
}): HelmV21RunThreadPersistedControlPlaneLifecycle {
  if (input.parseFailed) {
    const driftKeys: string[] = [];
    return {
      state: "invalid",
      persistedAt: null,
      sourceUpdatedAt: null,
      stageKey: null,
      summary:
        "Persisted control-plane lifecycle snapshot is unreadable, so runtime falls back to event-derived thread truth.",
      driftKeys,
      guardPolicy: buildGuardPolicy({
        runThreadUpdatedAt: input.runThread.updatedAt,
        snapshot: null,
        parseFailed: true,
        driftKeys,
      }),
      compactionPolicy: buildCompactionPolicy({
        runThreadUpdatedAt: input.runThread.updatedAt,
        snapshot: null,
        parseFailed: true,
        driftKeys,
      }),
      reconciliationPolicy: buildReconciliationPolicy({
        snapshot: null,
        parseFailed: true,
        driftKeys,
      }),
      repairPolicy: buildRepairPolicy({
        snapshot: null,
        parseFailed: true,
        driftKeys,
      }),
      writeSide: buildWriteSide({
        state: "invalid",
        snapshot: null,
        reconciliationNextAction:
          "Refresh the persisted lifecycle payload before using it again as a replay/recovery write anchor.",
      }),
      boundaryNote: RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_BOUNDARY_NOTE,
      snapshot: null,
    };
  }

  if (!input.snapshot) {
    const driftKeys: string[] = [];
    return {
      state: "missing",
      persistedAt: null,
      sourceUpdatedAt: null,
      stageKey: null,
      summary:
        "No persisted control-plane lifecycle snapshot is stored for this run thread yet; runtime currently relies on event-derived thread truth.",
      driftKeys,
      guardPolicy: buildGuardPolicy({
        runThreadUpdatedAt: input.runThread.updatedAt,
        snapshot: null,
        driftKeys,
      }),
      compactionPolicy: buildCompactionPolicy({
        runThreadUpdatedAt: input.runThread.updatedAt,
        snapshot: null,
        driftKeys,
      }),
      reconciliationPolicy: buildReconciliationPolicy({
        snapshot: null,
        driftKeys,
      }),
      repairPolicy: buildRepairPolicy({
        snapshot: null,
        driftKeys,
      }),
      writeSide: buildWriteSide({
        state: "missing",
        snapshot: null,
        reconciliationNextAction:
          "Backfill the first persisted lifecycle snapshot before using it as a replay/recovery write anchor.",
      }),
      boundaryNote: RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_BOUNDARY_NOTE,
      snapshot: null,
    };
  }

  const driftKeys = diffRunThreadPersistedControlPlaneLifecycleSnapshot({
    runThread: input.runThread,
    snapshot: input.snapshot,
  });
  if (driftKeys.length > 0) {
    const reconciliationPolicy = buildReconciliationPolicy({
      snapshot: input.snapshot,
      driftKeys,
    });
    return {
      state: "drifted",
      persistedAt: input.snapshot.persistedAt,
      sourceUpdatedAt: input.snapshot.sourceUpdatedAt,
      stageKey: input.snapshot.stageKey,
      summary: trimText(
        `Persisted control-plane lifecycle snapshot drifted on ${driftKeys.join(", ")}; runtime falls back to current event-derived thread truth until the snapshot is refreshed.`,
        240,
      ),
      driftKeys,
      guardPolicy: buildGuardPolicy({
        runThreadUpdatedAt: input.runThread.updatedAt,
        snapshot: input.snapshot,
        driftKeys,
      }),
      compactionPolicy: buildCompactionPolicy({
        runThreadUpdatedAt: input.runThread.updatedAt,
        snapshot: input.snapshot,
        driftKeys,
      }),
      reconciliationPolicy,
      repairPolicy: buildRepairPolicy({
        snapshot: input.snapshot,
        driftKeys,
      }),
      writeSide: buildWriteSide({
        state: "drifted",
        snapshot: input.snapshot,
        reconciliationNextAction: reconciliationPolicy.nextAction,
      }),
      boundaryNote: RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_BOUNDARY_NOTE,
      snapshot: input.snapshot,
    };
  }

  const reconciliationPolicy = buildReconciliationPolicy({
    snapshot: input.snapshot,
    driftKeys: [],
  });
  return {
    state: "synced",
    persistedAt: input.snapshot.persistedAt,
    sourceUpdatedAt: input.snapshot.sourceUpdatedAt,
    stageKey: input.snapshot.stageKey,
    summary:
      "Persisted control-plane lifecycle snapshot is in sync with the current thread-level control truth.",
    driftKeys: [],
    guardPolicy: buildGuardPolicy({
      runThreadUpdatedAt: input.runThread.updatedAt,
      snapshot: input.snapshot,
      driftKeys: [],
    }),
    compactionPolicy: buildCompactionPolicy({
      runThreadUpdatedAt: input.runThread.updatedAt,
      snapshot: input.snapshot,
      driftKeys: [],
    }),
    reconciliationPolicy,
    repairPolicy: buildRepairPolicy({
      snapshot: input.snapshot,
      driftKeys: [],
    }),
    writeSide: buildWriteSide({
      state: "synced",
      snapshot: input.snapshot,
      reconciliationNextAction: reconciliationPolicy.nextAction,
    }),
    boundaryNote: RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_BOUNDARY_NOTE,
    snapshot: input.snapshot,
  };
}
