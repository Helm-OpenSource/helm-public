import type {
  HelmV21HandoffPacket,
  HelmV21RunThreadCheckpoint,
  HelmV21RunThreadCheckpointLineageEntry,
  HelmV21RunThreadCloseoutFlow,
  HelmV21RunThreadCloseoutFlowSourceEntry,
  HelmV21RunThreadCloseControl,
  HelmV21RunThreadCloseControlFlow,
  HelmV21RunThreadCloseDecisionFlow,
  HelmV21RunThreadCloseDecisionControlSummary,
  HelmV21RunThreadCloseResolutionSummary,
  HelmV21RunThreadCloseResolutionForwardSummary,
  HelmV21RunThreadCloseResolutionControlSummary,
  HelmV21RunThreadClosePostureSummary,
  HelmV21RunThreadClosePostureForwardSummary,
  HelmV21RunThreadCloseLifecycle,
  HelmV21RunThreadCloseoutConfirmation,
  HelmV21RunThreadCloseoutRefresh,
  HelmV21RunThreadCloseRequest,
  HelmV21RunThreadCloseoutOutcome,
  HelmV21RunThreadCloseoutResolution,
  HelmV21RunThreadCloseoutResolutionFollowThrough,
  HelmV21RunThreadCloseoutSummary,
  HelmV21RunThreadContract,
  HelmV21RunThreadForwardFlow,
  HelmV21RunThreadForwardFlowAttentionSource,
  HelmV21RunThreadForwardFlowState,
  HelmV21RunThreadHumanInputCheckpoint,
  HelmV21RunThreadLifecycleEntry,
  HelmV21RunThreadLifecycleState,
  HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot,
  HelmV21RunThreadRequestPosture,
  HelmV21RunThreadRequestState,
  HelmV21RunThreadResultAcknowledgement,
  HelmV21RunThreadResultFlow,
  HelmV21RunThreadResultFlowSourceEntry,
  HelmV21RunThreadResultAcknowledgementSource,
  HelmV21RunThreadResultAcknowledgementState,
  HelmV21RunThreadReplayRequest,
  HelmV21RunThreadResumeState,
  HelmV21RunThreadSettlementFlow,
  HelmV21RunThreadSettlementFlowDriver,
  HelmV21RunThreadSettlementReview,
  HelmV21RunThreadSwarmReadOnlyWorkerContract,
  HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardContract,
  HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract,
  HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateContract,
  HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleContract,
  HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardContract,
  HelmV21RunThreadSwarmReadOnlyWorkerKind,
  HelmV21RunThreadSwarmReadOnlyWorkerLanePreview,
  HelmV21RunThreadSwarmReadOnlyWorkerRecordState,
  HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract,
  HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardContract,
  HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleContract,
  HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideContract,
  HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionContract,
  HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract,
  HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardContract,
  HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleContract,
  HelmV21RunThreadSwarmVerificationMergeLaneContract,
  HelmV21RunThreadSwarmVerificationMergeLaneTruth,
  HelmV21RunThreadSwarmSpawnBudgetEnvelope,
  HelmV21RunThreadSwarmSpawnContract,
  HelmV21RunThreadSwarmSpawnRequest,
  HelmV21RunThreadSwarmSpawnTaskClass,
  HelmV21TruthConflictState,
  HelmV21VerificationStatus,
  HelmV21RuntimeCheckpointState,
  HelmV21RuntimeSessionState,
} from "@/lib/helm-v2/contracts";
import { buildRunThreadPersistedControlPlaneLifecycle } from "@/lib/helm-v2/run-thread-persisted-control-plane-lifecycle";
import { safeParseJson, trimText } from "@/lib/utils";

type RunThreadContractInput = {
  id: string;
  workspaceId: string;
  sessionKey: string;
  status: string;
  currentStage: string;
  sourcePage?: string | null;
  boundaryNote: string;
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  replayableEventLog?: string | null;
  resumedFromKey?: string | null;
  swarmReadOnlyWorkersEnabled?: boolean | null;
  swarmBudgetEnvelope?: {
    budgetTokenLimit: number;
    budgetTokenUsed: number;
    usagePercent: number;
    prunedTokenCount: number;
    posture: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
  } | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  checkpoints: Array<{
    id: string;
    checkpointKey: string;
    label: string;
    status: string;
    summary: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  handoffPackets?: Array<{
    id: string;
    packetKey: string;
    fromAgent: string;
    toAgent: string;
    goal: string;
    approvalTier: string;
    checkpointRef?: string | null;
    createdAt: Date;
  }>;
  remediationTrace?: Array<{
    id: string;
    action: string;
    executionStatus: string;
    summary: string;
    rollbackAnchorSummary: string | null;
    triggeredBy?: string | null;
    createdAt: Date;
  }>;
  requestLifecycleEntries?: Array<{
    id: string;
    kind:
      | "takeover_requested"
      | "takeover_active"
      | "takeover_released"
      | "takeover_followthrough_requested"
      | "takeover_followthrough_resolved"
      | "human_input_requested"
      | "takeover_request_acknowledged"
      | "human_input_request_acknowledged";
    label: string;
    summary: string;
    actorName?: string | null;
    checkpointKey: string | null;
    timestamp: Date;
  }>;
  swarmSpawnRequestEvent?: {
    id: string;
    taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
    checkpointId: string | null;
    checkpointKey: string | null;
    summary: string;
    requestedBy: string;
    sourcePage: string | null;
    createdAt: Date;
  } | null;
  swarmReadOnlyWorkerIntentEvent?: {
    id: string;
    workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind;
    packetKey: string;
    checkpointId: string | null;
    checkpointKey: string | null;
    artifactTypes: string[];
    summary: string;
    requestedBy: string;
    sourcePage: string | null;
    createdAt: Date;
  } | null;
  swarmReadOnlyWorkerPlaceholderEvent?: {
    id: string;
    workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind;
    packetKey: string;
    checkpointId: string | null;
    checkpointKey: string | null;
    placeholderBundleKey: string;
    placeholderBundleTitle: string;
    artifactTypes: string[];
    handoffConsumerAgent: "lead-orchestrator";
    handoffConsumptionGoal: string | null;
    summary: string;
    requestedBy: string;
    sourcePage: string | null;
    createdAt: Date;
  } | null;
  swarmReadOnlyWorkerExecutionEvent?: {
    id: string;
    workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind;
    packetKey: string;
    checkpointId: string | null;
    checkpointKey: string | null;
    placeholderBundleKey: string;
    artifactTypes: string[];
    handoffConsumerAgent: "lead-orchestrator";
    handoffConsumptionGoal: string | null;
    summary: string;
    requestedBy: string;
    sourcePage: string | null;
    createdAt: Date;
  } | null;
  swarmReadOnlyWorkerMaterializationEvent?: {
    id: string;
    workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind;
    packetKey: string;
    checkpointId: string | null;
    checkpointKey: string | null;
    materializationBundleKey: string;
    materializationBundleTitle: string;
    artifactTypes: string[];
    handoffConsumerAgent: "lead-orchestrator";
    handoffConsumptionGoal: string | null;
    summary: string;
    requestedBy: string;
    sourcePage: string | null;
    createdAt: Date;
  } | null;
  swarmReadOnlyWorkerAdoptionEvent?: {
    id: string;
    workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind;
    packetKey: string;
    checkpointId: string | null;
    checkpointKey: string | null;
    outputBundleKey: string;
    outputBundleTitle: string;
    outputArtifactTypes: string[];
    handoffConsumerAgent: "lead-orchestrator";
    handoffConsumptionGoal: string | null;
    summary: string;
    requestedBy: string;
    sourcePage: string | null;
    createdAt: Date;
  } | null;
  verification?: {
    status: HelmV21VerificationStatus;
    blockedReasons: string[];
    summary?: string | null;
  } | null;
  truthConflicts?: Array<{
    status: HelmV21TruthConflictState;
    summary: string;
  }>;
  swarmVerificationMergeLaneEvent?: {
    id: string;
    mergeLaneTruth: HelmV21RunThreadSwarmVerificationMergeLaneTruth;
    checkpointId: string | null;
    checkpointKey: string | null;
    summary: string;
    nextAction: string | null;
    verifierSummary: string | null;
    disagreementSummary: string | null;
    arbiterReference: string | null;
    requestedBy: string;
    sourcePage: string | null;
    createdAt: Date;
  } | null;
  settlementReviewEntries?: Array<{
    id: string;
    kind: "settlement_review_requested" | "settlement_review_resolved";
    summary: string;
    actorName?: string | null;
    checkpointId?: string | null;
    checkpointKey: string | null;
    resumeToken?: string | null;
    nextAction?: string | null;
    sourcePage?: string | null;
    timestamp: Date;
  }>;
  closeoutConfirmationEntries?: Array<{
    id: string;
    kind: "closeout_confirmed";
    summary: string;
    actorName?: string | null;
    settlementReviewResolutionEventId?: string | null;
    checkpointId?: string | null;
    checkpointKey: string | null;
    resumeToken?: string | null;
    nextAction?: string | null;
    sourcePage?: string | null;
    timestamp: Date;
  }>;
  closeoutRefreshEntries?: Array<{
    id: string;
    kind: "closeout_refresh_requested";
    summary: string;
    actorName?: string | null;
    confirmationEventId?: string | null;
    checkpointId?: string | null;
    checkpointKey: string | null;
    resumeToken?: string | null;
    nextAction?: string | null;
    sourcePage?: string | null;
    timestamp: Date;
  }>;
  closeoutResolutionEntries?: Array<{
    id: string;
    kind: "closeout_resolution_recorded";
    decision: "close_thread" | "keep_open";
    summary: string;
    actorName?: string | null;
    closeoutConfirmationEventId?: string | null;
    closeoutRefreshEventId?: string | null;
    checkpointId?: string | null;
    checkpointKey: string | null;
    resumeToken?: string | null;
    nextAction?: string | null;
    sourcePage?: string | null;
    timestamp: Date;
  }>;
  closeoutResolutionFollowThroughEntries?: Array<{
    id: string;
    kind:
      | "closeout_resolution_followthrough_requested"
      | "closeout_resolution_followthrough_resolved";
    decision: "close_thread" | "keep_open";
    summary: string;
    actorName?: string | null;
    requestEventId?: string | null;
    closeoutResolutionEventId?: string | null;
    checkpointId?: string | null;
    checkpointKey: string | null;
    resumeToken?: string | null;
    nextAction?: string | null;
    sourcePage?: string | null;
    timestamp: Date;
  }>;
  closeRequestEntries?: Array<{
    id: string;
    kind: "close_request_requested";
    summary: string;
    actorName?: string | null;
    closeoutResolutionEventId?: string | null;
    closeoutResolutionFollowThroughEventId?: string | null;
    checkpointId?: string | null;
    checkpointKey: string | null;
    resumeToken?: string | null;
    nextAction?: string | null;
    sourcePage?: string | null;
    timestamp: Date;
  }>;
  resultAcknowledgements?: Array<{
    id: string;
    source: HelmV21RunThreadResultAcknowledgementSource;
    state: Exclude<HelmV21RunThreadResultAcknowledgementState, "not_available">;
    summary: string;
    timestamp: Date;
  }>;
  persistedControlPlaneLifecycle?: {
    snapshot: HelmV21RunThreadPersistedControlPlaneLifecycleSnapshot | null;
    parseFailed?: boolean;
  } | null;
};

const RUNTIME_SESSION_STATE_MAP: Record<string, HelmV21RuntimeSessionState> = {
  ACTIVE: "active",
  AWAITING_WORKER: "awaiting_worker",
  AWAITING_REVIEW: "awaiting_review",
  AWAITING_APPROVAL: "awaiting_approval",
  COMPACTING: "compacting",
  CHECKPOINTED: "checkpointed",
  BLOCKED: "blocked",
  COMPLETED: "completed",
  FAILED: "failed",
  ABORTED: "aborted",
};

const RUNTIME_CHECKPOINT_STATE_MAP: Record<string, HelmV21RuntimeCheckpointState> = {
  READY: "ready",
  RESUMED: "resumed",
  STALE: "stale",
};

export function normalizeRuntimeSessionState(status: string): HelmV21RuntimeSessionState {
  const normalized = RUNTIME_SESSION_STATE_MAP[status];
  if (!normalized) {
    throw new Error(`Unsupported runtime session state: ${status}`);
  }
  return normalized;
}

export function normalizeRuntimeCheckpointState(status: string): HelmV21RuntimeCheckpointState {
  const normalized = RUNTIME_CHECKPOINT_STATE_MAP[status];
  if (!normalized) {
    throw new Error(`Unsupported runtime checkpoint state: ${status}`);
  }
  return normalized;
}

function buildCheckpointContract(
  checkpoint: RunThreadContractInput["checkpoints"][number],
): HelmV21RunThreadCheckpoint {
  const state = normalizeRuntimeCheckpointState(checkpoint.status);
  return {
    checkpointId: checkpoint.id,
    checkpointKey: checkpoint.checkpointKey,
    label: checkpoint.label,
    summary: checkpoint.summary,
    state,
    resumeToken: checkpoint.checkpointKey,
    createdAt: checkpoint.createdAt,
    updatedAt: checkpoint.updatedAt,
  };
}

function dedupeAndSortCheckpoints(
  checkpoints: RunThreadContractInput["checkpoints"],
): RunThreadContractInput["checkpoints"] {
  const byId = new Map<string, RunThreadContractInput["checkpoints"][number]>();
  for (const checkpoint of checkpoints) {
    const existing = byId.get(checkpoint.id);
    if (!existing || checkpoint.updatedAt.getTime() > existing.updatedAt.getTime()) {
      byId.set(checkpoint.id, checkpoint);
    }
  }
  return [...byId.values()].sort((left, right) => {
    const updatedDelta = right.updatedAt.getTime() - left.updatedAt.getTime();
    if (updatedDelta !== 0) return updatedDelta;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

function buildCheckpointLineage(input: {
  checkpoints: HelmV21RunThreadCheckpoint[];
  resumedFromKey: string | null;
}): HelmV21RunThreadCheckpointLineageEntry[] {
  return input.checkpoints.map((checkpoint, index) => ({
    ...checkpoint,
    lineageRole:
      checkpoint.checkpointKey === input.resumedFromKey
        ? "resume_anchor"
        : index === 0
          ? "latest"
          : "historical",
  }));
}

function deriveLifecycle(input: {
  runStatus: HelmV21RuntimeSessionState;
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  resumedFromKey: string | null;
  closedAt: Date | null;
}): HelmV21RunThreadLifecycleState {
  if (
    input.closedAt ||
    input.runStatus === "completed" ||
    input.runStatus === "failed" ||
    input.runStatus === "aborted"
  ) {
    return "closed";
  }
  if (input.resumedFromKey) {
    return "resumed";
  }
  if (input.latestCheckpoint?.state === "ready") {
    return "checkpoint_ready";
  }
  return "live";
}

function deriveResumeState(input: {
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  resumedFromKey: string | null;
}): HelmV21RunThreadResumeState {
  if (input.resumedFromKey) {
    return "resumed";
  }
  if (input.latestCheckpoint?.state === "ready") {
    return "ready";
  }
  return "not_available";
}

function parseReplayEventLog(input: string | null | undefined) {
  const entries = safeParseJson<Array<Record<string, unknown>>>(input, []);
  const lastEntry = entries.at(-1);
  return {
    eventLogEntries: entries.length,
    lastEventAt: typeof lastEntry?.at === "string" ? lastEntry.at : null,
  };
}

function buildReplayRequest(input: {
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  resumedFromCheckpoint: HelmV21RunThreadCheckpoint | null;
  replay: {
    eventLogEntries: number;
    lastEventAt: string | null;
  };
}): HelmV21RunThreadReplayRequest {
  const replayAnchor = input.resumedFromCheckpoint ?? input.latestCheckpoint;
  const mode = input.resumedFromCheckpoint
    ? "resume_anchor"
    : input.latestCheckpoint
      ? "latest_checkpoint"
      : "none";

  if (!replayAnchor) {
    return {
      mode,
      checkpointId: null,
      checkpointKey: null,
      resumeToken: null,
      replaySummary: "No checkpoint anchor is currently available for replay or resume.",
    };
  }

  return {
    mode,
    checkpointId: replayAnchor.checkpointId,
    checkpointKey: replayAnchor.checkpointKey,
    resumeToken: replayAnchor.resumeToken,
    replaySummary:
      mode === "resume_anchor"
        ? `Replay can resume from historical anchor ${replayAnchor.label} with ${input.replay.eventLogEntries} logged replay event${input.replay.eventLogEntries === 1 ? "" : "s"}.`
        : `Replay can start from latest checkpoint ${replayAnchor.label} with ${input.replay.eventLogEntries} logged replay event${input.replay.eventLogEntries === 1 ? "" : "s"}.`,
  };
}

function buildHumanInputCheckpoint(input: {
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  boundaryNote: string;
}): HelmV21RunThreadHumanInputCheckpoint {
  if (!input.latestCheckpoint) {
    return {
      state: "not_available",
      checkpointId: null,
      checkpointKey: null,
      summary:
        "No checkpoint anchor is currently available for a future human input checkpoint.",
      boundaryNote: input.boundaryNote,
    };
  }

  return {
    state: "checkpoint_ready",
    checkpointId: input.latestCheckpoint.checkpointId,
    checkpointKey: input.latestCheckpoint.checkpointKey,
    summary: `Future human input checkpoints should attach to ${input.latestCheckpoint.label} without widening operator authority.`,
    boundaryNote: input.boundaryNote,
  };
}

function buildResultAcknowledgement(input: {
  entries: NonNullable<RunThreadContractInput["resultAcknowledgements"]>;
  boundaryNote: string;
}): HelmV21RunThreadResultAcknowledgement {
  const latest = [...input.entries].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())[0];
  if (!latest) {
    return {
      source: null,
      state: "not_available",
      referenceId: null,
      summary:
        "No downstream human execution acknowledgement, official write acknowledgement, limited-auto acknowledgement, or official follow-through result is attached to this run thread yet.",
      updatedAt: null,
      boundaryNote: input.boundaryNote,
    };
  }

  return {
    source: latest.source,
    state: latest.state,
    referenceId: latest.id,
    summary: latest.summary,
    updatedAt: latest.timestamp,
    boundaryNote: input.boundaryNote,
  };
}

const RUN_THREAD_RESULT_FLOW_BOUNDARY_NOTE =
  "Result flow stays operator-readable and review-first inside the current run thread. It summarizes downstream human execution, guarded official write, limited-auto, and official follow-through posture without creating a new execution plane or broader authority.";

function buildResultFlow(input: {
  entries: NonNullable<RunThreadContractInput["resultAcknowledgements"]>;
}): HelmV21RunThreadResultFlow {
  const sortedEntries = [...input.entries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latest = sortedEntries[0] ?? null;
  const latestBySource = new Map<
    HelmV21RunThreadResultAcknowledgementSource,
    HelmV21RunThreadResultFlowSourceEntry
  >();
  for (const item of sortedEntries) {
    if (latestBySource.has(item.source)) {
      continue;
    }
    latestBySource.set(item.source, {
      source: item.source,
      state: item.state,
      referenceId: item.id,
      summary: item.summary,
      updatedAt: item.timestamp,
    });
  }
  const sourceEntries = [...latestBySource.values()].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );

  const counts = {
    pending: sourceEntries.filter((item) => item.state === "pending").length,
    acknowledged: sourceEntries.filter((item) => item.state === "acknowledged").length,
    failed: sourceEntries.filter((item) => item.state === "failed").length,
    blocked: sourceEntries.filter((item) => item.state === "blocked").length,
    deferred: sourceEntries.filter((item) => item.state === "deferred").length,
    followThroughOpen: sourceEntries.filter((item) => item.state === "follow_through_open").length,
    followThroughResolved: sourceEntries.filter((item) => item.state === "follow_through_resolved").length,
  };
  const trackedSourceCount = sourceEntries.length;
  const requiresOperatorAttentionCount =
    counts.pending + counts.failed + counts.blocked + counts.deferred + counts.followThroughOpen;
  const resolvedCount = counts.acknowledged + counts.followThroughResolved;

  if (!latest) {
    return {
      summary:
        "No downstream human execution, guarded official write, limited-auto, or official follow-through result is attached to this run thread yet.",
      boundaryNote: RUN_THREAD_RESULT_FLOW_BOUNDARY_NOTE,
      latestSource: null,
      latestState: "not_available",
      latestReferenceId: null,
      latestUpdatedAt: null,
      trackedSourceCount,
      requiresOperatorAttentionCount,
      resolvedCount,
      counts,
      sourceEntries,
    };
  }

  return {
    summary: `Result flow keeps ${trackedSourceCount} traced source(s): ${requiresOperatorAttentionCount} still need operator attention and ${resolvedCount} are resolved. Latest result is ${latest.source} -> ${latest.state}.`,
    boundaryNote: RUN_THREAD_RESULT_FLOW_BOUNDARY_NOTE,
    latestSource: latest.source,
    latestState: latest.state,
    latestReferenceId: latest.id,
    latestUpdatedAt: latest.timestamp,
    trackedSourceCount,
    requiresOperatorAttentionCount,
    resolvedCount,
    counts,
    sourceEntries,
  };
}

const RUN_THREAD_REQUEST_POSTURE_BOUNDARY_NOTE =
  "Request posture stays typed and operator-readable inside the current run thread. It does not create a new execution plane, auto-takeover path, or broader authority.";

const RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE =
  "Swarm spawn posture stays admission-only and default-off in this layer. It does not create real worker fan-out, nested spawn, peer messaging, or broader execution authority.";

const RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE =
  "Read-only swarm worker lanes stay artifact-first, review-first, and default-off in this layer. They do not create real worker execution, transcript merge, nested spawn, send authority, or broader execution authority.";

const RUN_THREAD_SWARM_VERIFICATION_MERGE_LANE_BOUNDARY_NOTE =
  "Swarm verification merge lanes stay review-first, disagreement-aware, and default-off in this layer. They do not auto-merge worker outputs, bypass human review, widen send authority, or rewrite canonical truth.";

const SWARM_READ_ONLY_WORKER_ALLOWLIST: readonly HelmV21RunThreadSwarmReadOnlyWorkerKind[] = [
  "search",
  "grep",
  "evidence_mining",
];

function buildSwarmSpawnBudgetEnvelope(input: {
  taskClass: "read_only_worker";
  budget?: RunThreadContractInput["swarmBudgetEnvelope"];
}): HelmV21RunThreadSwarmSpawnBudgetEnvelope {
  const budget = input.budget ?? null;
  const posture = budget?.posture ?? "SAFE";
  const budgetTokenLimit = budget?.budgetTokenLimit ?? 0;
  const budgetTokenUsed = budget?.budgetTokenUsed ?? 0;
  const usagePercent = budget?.usagePercent ?? 0;
  const prunedTokenCount = budget?.prunedTokenCount ?? 0;

  if (posture === "PRUNE" || posture === "COMPACT") {
    return {
      state: "blocked_budget",
      taskClass: input.taskClass,
      budgetPosture: posture,
      budgetTokenLimit,
      budgetTokenUsed,
      usagePercent,
      prunedTokenCount,
      summary:
        posture === "COMPACT"
          ? "Spawn budget envelope is blocked because the run thread is already operating in resumed compact posture."
          : "Spawn budget envelope is blocked because the run thread has already pruned overflow context behind persisted handles.",
      boundaryNote: RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE,
    };
  }

  return {
    state: "within_headroom",
    taskClass: input.taskClass,
    budgetPosture: posture,
    budgetTokenLimit,
    budgetTokenUsed,
    usagePercent,
    prunedTokenCount,
    summary:
      posture === "WATCH"
        ? "Spawn budget envelope is still within headroom, but the run thread is already in watch posture."
        : "Spawn budget envelope is within safe headroom for a read-only worker request.",
    boundaryNote: RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE,
  };
}

function buildSwarmSpawnRequest(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  swarmReadOnlyWorkersEnabled: boolean;
  budgetEnvelope: HelmV21RunThreadSwarmSpawnBudgetEnvelope;
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  requestEvent?:
    | {
        id: string;
        taskClass: HelmV21RunThreadSwarmSpawnTaskClass;
        checkpointId: string | null;
        checkpointKey: string | null;
        summary: string;
        requestedBy: string;
        sourcePage: string | null;
        createdAt: Date;
      }
    | null;
}): HelmV21RunThreadSwarmSpawnRequest {
  const workspaceFlagState = input.swarmReadOnlyWorkersEnabled ? "enabled" : "disabled";
  const budgetEnvelopeState = input.budgetEnvelope.state;
  const checkpointId = input.requestEvent?.checkpointId ?? input.latestCheckpoint?.checkpointId ?? null;
  const checkpointKey = input.requestEvent?.checkpointKey ?? input.latestCheckpoint?.checkpointKey ?? null;
  const requestRecordState = input.requestEvent ? "requested" : "not_requested";
  const requestEventId = input.requestEvent?.id ?? null;
  const requestedAt = input.requestEvent?.createdAt ?? null;
  const requestedBy = input.requestEvent?.requestedBy ?? null;
  const sourcePage = input.requestEvent?.sourcePage ?? null;

  if (workspaceFlagState === "disabled") {
    return {
      state: "blocked_flag",
      requestRecordState,
      requestEventId,
      taskClass: "read_only_worker",
      checkpointId,
      checkpointKey,
      requestedAt,
      requestedBy,
      sourcePage,
      workspaceFlagState,
      lifecycleState: input.lifecycle,
      budgetEnvelopeState,
      denyReason: "workspace_flag_disabled",
      denySummary:
        "Swarm spawn stays blocked because this workspace has not explicitly enabled the read-only worker flag.",
      summary:
        "Read-only swarm worker spawn is disabled for this workspace until the swarm flag is explicitly enabled.",
      nextAction: "Enable the workspace swarm read-only worker flag before requesting any spawn.",
      boundaryNote: RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE,
    };
  }

  if (input.lifecycle === "closed") {
    return {
      state: "blocked_policy",
      requestRecordState,
      requestEventId,
      taskClass: "read_only_worker",
      checkpointId,
      checkpointKey,
      requestedAt,
      requestedBy,
      sourcePage,
      workspaceFlagState,
      lifecycleState: input.lifecycle,
      budgetEnvelopeState,
      denyReason: "run_thread_closed",
      denySummary:
        "Swarm spawn stays blocked because this run thread is already closed and no longer accepts new admission requests.",
      summary: "Read-only swarm worker spawn is blocked because this run thread is already closed.",
      nextAction: "Open a live run thread before requesting a read-only swarm worker.",
      boundaryNote: RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE,
    };
  }

  if (budgetEnvelopeState === "blocked_budget") {
    return {
      state: "blocked_budget",
      requestRecordState,
      requestEventId,
      taskClass: "read_only_worker",
      checkpointId,
      checkpointKey,
      requestedAt,
      requestedBy,
      sourcePage,
      workspaceFlagState,
      lifecycleState: input.lifecycle,
      budgetEnvelopeState,
      denyReason:
        input.budgetEnvelope.budgetPosture === "COMPACT"
          ? "budget_posture_compact"
          : "budget_posture_prune",
      denySummary:
        input.budgetEnvelope.budgetPosture === "COMPACT"
          ? "Swarm spawn stays blocked because the run thread is already in compact posture and no longer has admission headroom for read-only fan-out."
          : "Swarm spawn stays blocked because the run thread already pruned overflow context and must relieve budget pressure before any read-only fan-out request.",
      summary:
        "Read-only swarm worker spawn is blocked because the current run thread no longer has safe budget headroom.",
      nextAction: "Reduce budget pressure or refresh the thread before requesting a read-only swarm worker.",
      boundaryNote: RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE,
    };
  }

  return {
    state: "requestable",
    requestRecordState,
    requestEventId,
    taskClass: "read_only_worker",
    checkpointId,
    checkpointKey,
    requestedAt,
    requestedBy,
    sourcePage,
    workspaceFlagState,
    lifecycleState: input.lifecycle,
    budgetEnvelopeState,
    denyReason: null,
    denySummary: null,
    summary:
      requestRecordState === "requested"
        ? `Read-only swarm worker spawn request already recorded on ${checkpointKey ?? "the current run thread"} under the current workspace flag and budget envelope.`
        : "Read-only swarm worker spawn is requestable on this run thread under the current workspace flag and budget envelope.",
    nextAction:
      requestRecordState === "requested"
        ? "Keep this request review-first and artifact-first until a later spawn execution slice consumes the record."
        : "Any later spawn implementation must still stay read-only, review-first, and artifact-first.",
    boundaryNote: RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE,
  };
}

function buildSwarmSpawnContract(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  budgetEnvelope: HelmV21RunThreadSwarmSpawnBudgetEnvelope;
  request: HelmV21RunThreadSwarmSpawnRequest;
}): HelmV21RunThreadSwarmSpawnContract {
  return {
    state: input.request.state,
    requestRecordState: input.request.requestRecordState,
    requestEventId: input.request.requestEventId,
    taskClass: input.request.taskClass,
    checkpointId: input.request.checkpointId,
    checkpointKey: input.request.checkpointKey,
    requestedAt: input.request.requestedAt,
    requestedBy: input.request.requestedBy,
    sourcePage: input.request.sourcePage,
    workspaceFlagState: input.request.workspaceFlagState,
    lifecycleState: input.lifecycle,
    budgetPosture: input.budgetEnvelope.budgetPosture,
    budgetEnvelopeState: input.budgetEnvelope.state,
    requestState: input.request.state,
    denyReason: input.request.denyReason,
    denySummary: input.request.denySummary,
    summary: `${input.request.summary} ${input.budgetEnvelope.summary}`.trim(),
    nextAction: input.request.nextAction,
    boundaryNote: RUN_THREAD_SWARM_SPAWN_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerLanePreviews(input: {
  workspaceId: string;
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  checkpointKey: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerLanePreview[] {
  const checkpointRef = input.checkpointKey ?? null;
  const anchorLabel = checkpointRef ?? "the current run thread";

  const makePreview = (config: {
    workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind;
    toAgent: HelmV21HandoffPacket["toAgent"];
    artifactTypes: string[];
    goal: string;
    summary: string;
  }): HelmV21RunThreadSwarmReadOnlyWorkerLanePreview => {
    const packetKey = `swarm::${config.workerKind}::${checkpointRef ?? "live-thread"}`;
    return {
      workerKind: config.workerKind,
      packetKey,
      artifactTypes: config.artifactTypes,
      handoffPacket: {
        handoffId: packetKey,
        fromAgent: "lead-orchestrator",
        toAgent: config.toAgent,
        goal: config.goal,
        objectRefs: {
          workspaceId: input.workspaceId,
          meetingId: input.meetingId ?? null,
          opportunityId: input.opportunityId ?? null,
          customerId: input.companyId ?? null,
          handoffId: packetKey,
        },
        constraints: [
          "read_only",
          "artifact_first",
          "no_transcript_merge",
          "no_official_write",
          "no_customer_send",
          "no_canonical_memory_mutation",
        ],
        trustBoundary: {
          trusted: [checkpointRef ? `checkpoint:${checkpointRef}` : "live_run_thread_anchor", "persisted_payload_handles"],
          untrusted: [
            "customer_facing_send",
            "official_write",
            "canonical_memory_promotion",
            "broad_execution_authority",
          ],
        },
        requiredOutputs: [...config.artifactTypes, "worker_handoff_note.md"],
        evidenceRefs: checkpointRef ? [checkpointRef] : [],
        notebookRef: null,
        checkpointRef,
        approvalTier: "A1",
      },
      summary: config.summary,
    };
  };

  return [
    makePreview({
      workerKind: "search",
      toAgent: "swarm-search-worker",
      artifactTypes: ["search_hits.json", "worker_findings_bundle.json"],
      goal: `Search persisted context and workspace evidence anchored on ${anchorLabel} without widening execution authority.`,
      summary:
        "Search lane stays read-only and must return artifact refs plus a worker handoff note, never a merged transcript.",
    }),
    makePreview({
      workerKind: "grep",
      toAgent: "swarm-grep-worker",
      artifactTypes: ["grep_hits.json", "worker_findings_bundle.json"],
      goal: `Run bounded grep-style evidence lookup anchored on ${anchorLabel} and return typed findings only.`,
      summary:
        "Grep lane stays read-only and must return artifact refs plus a worker handoff note, never a merged transcript.",
    }),
    makePreview({
      workerKind: "evidence_mining",
      toAgent: "swarm-evidence-miner",
      artifactTypes: ["evidence_candidates.json", "worker_findings_bundle.json"],
      goal: `Mine decision-relevant evidence candidates anchored on ${anchorLabel} and keep outputs artifact-first for lead synthesis.`,
      summary:
        "Evidence-mining lane stays read-only and must return artifact refs plus a worker handoff note, never a merged transcript.",
    }),
  ];
}

function buildSwarmReadOnlyWorkerPlaceholderBundleKey(packetKey: string) {
  return `artifact-bundle::${packetKey}`;
}

function buildSwarmReadOnlyWorkerPlaceholderBundleTitle(
  workerKind: HelmV21RunThreadSwarmReadOnlyWorkerKind,
) {
  return `${workerKind} findings placeholder bundle`;
}

function buildSwarmReadOnlyWorkerExecutionPreflight(input: {
  requestable: boolean;
  requestRecorded: boolean;
  selectedLanePreview: HelmV21RunThreadSwarmReadOnlyWorkerLanePreview | null;
  recordedPlaceholderEvent: RunThreadContractInput["swarmReadOnlyWorkerPlaceholderEvent"];
}): {
  state: HelmV21RunThreadSwarmReadOnlyWorkerContract["executionPreflightState"];
  summary: string;
} {
  if (!input.requestable) {
    return {
      state: "blocked",
      summary:
        "Execution preflight is blocked because swarm spawn admission is not requestable on the current run thread.",
    };
  }
  if (!input.requestRecorded) {
    return {
      state: "request_required",
      summary:
        "Execution preflight is not ready yet. Record the read-only swarm request before any later fan-out slice consumes a worker lane.",
    };
  }
  if (!input.selectedLanePreview) {
    return {
      state: "selection_required",
      summary:
        "Execution preflight is waiting on one allowlisted lane selection before any later fan-out slice can continue.",
    };
  }
  if (!input.recordedPlaceholderEvent) {
    return {
      state: "placeholder_record_required",
      summary: `Execution preflight is waiting for the ${input.selectedLanePreview.workerKind} placeholder record so a later fan-out slice can consume ${input.selectedLanePreview.packetKey} without widening authority now.`,
    };
  }
  return {
    state: "ready",
    summary: `Execution preflight is ready for the ${input.recordedPlaceholderEvent.workerKind} lane. A later fan-out slice may consume ${input.recordedPlaceholderEvent.packetKey} and ${input.recordedPlaceholderEvent.placeholderBundleKey} without re-deriving admission truth.`,
  };
}

function buildSwarmReadOnlyWorkerExecutionGuard(input: {
  swarmSpawnContract: HelmV21RunThreadContract["swarmSpawnContract"];
  executionPreflight: {
    state: HelmV21RunThreadSwarmReadOnlyWorkerContract["executionPreflightState"];
    summary: string;
  };
  selectedLanePreview: HelmV21RunThreadSwarmReadOnlyWorkerLanePreview | null;
  recordedPlaceholderEvent: RunThreadContractInput["swarmReadOnlyWorkerPlaceholderEvent"];
  recordedExecutionEvent: RunThreadContractInput["swarmReadOnlyWorkerExecutionEvent"];
  intentEvent: RunThreadContractInput["swarmReadOnlyWorkerIntentEvent"];
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardContract {
  const missingRequirements =
    input.swarmSpawnContract.state !== "requestable"
      ? ["swarm spawn admission is not requestable"]
      : input.swarmSpawnContract.requestRecordState !== "requested"
        ? ["swarm request record is missing"]
        : !input.selectedLanePreview
          ? ["allowlisted lane selection is missing"]
          : !input.recordedPlaceholderEvent
            ? ["placeholder bundle record is missing"]
            : [];

  const placeholderBundleKey =
    input.recordedPlaceholderEvent?.placeholderBundleKey ??
    (input.selectedLanePreview
      ? buildSwarmReadOnlyWorkerPlaceholderBundleKey(input.selectedLanePreview.packetKey)
      : null);
  const selectedWorkerKind =
    input.recordedPlaceholderEvent?.workerKind ?? input.selectedLanePreview?.workerKind ?? null;
  const selectedPacketKey =
    input.recordedPlaceholderEvent?.packetKey ?? input.selectedLanePreview?.packetKey ?? null;
  const selectedArtifactTypes =
    input.recordedPlaceholderEvent?.artifactTypes ?? input.selectedLanePreview?.artifactTypes ?? [];
  const handoffConsumerAgent =
    input.recordedExecutionEvent?.handoffConsumerAgent ??
    input.recordedPlaceholderEvent?.handoffConsumerAgent ??
    (input.selectedLanePreview ? "lead-orchestrator" : null);
  const handoffConsumptionGoal =
    input.recordedExecutionEvent?.handoffConsumptionGoal ??
    input.recordedPlaceholderEvent?.handoffConsumptionGoal ??
    input.selectedLanePreview?.handoffPacket.goal ??
    null;

  if (input.recordedExecutionEvent) {
    return {
      move: "execute_selected_lane",
      state: "reused",
      executionPreflightState: input.executionPreflight.state,
      requestEventId: input.swarmSpawnContract.requestEventId,
      checkpointKey: input.swarmSpawnContract.checkpointKey,
      selectedWorkerKind:
        input.recordedExecutionEvent.workerKind ?? input.selectedLanePreview?.workerKind ?? null,
      selectedPacketKey:
        input.recordedExecutionEvent.packetKey ?? input.selectedLanePreview?.packetKey ?? null,
      selectedArtifactTypes:
        input.recordedExecutionEvent.artifactTypes ??
        input.selectedLanePreview?.artifactTypes ??
        [],
      intentEventId: input.intentEvent?.id ?? null,
      placeholderBundleKey:
        input.recordedExecutionEvent.placeholderBundleKey ?? placeholderBundleKey,
      placeholderRecordEventId: input.recordedPlaceholderEvent?.id ?? null,
      handoffConsumerAgent,
      handoffConsumptionGoal,
      missingRequirements: [],
      summary: trimText(
        `Execution admission guard reuses ${input.recordedExecutionEvent.id} for the ${input.recordedExecutionEvent.workerKind} lane. No new execution admission record is required before a later fan-out slice consumes ${input.recordedExecutionEvent.packetKey}.`,
        220,
      ),
      reason: trimText(
        `Execution record ${input.recordedExecutionEvent.id} already exists for ${input.recordedExecutionEvent.packetKey} on ${input.recordedExecutionEvent.placeholderBundleKey}.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Reuse the recorded execution admission event in any later execution slice; do not re-record it.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  if (missingRequirements.length === 0) {
    return {
      move: "execute_selected_lane",
      state: "allowed",
      executionPreflightState: input.executionPreflight.state,
      requestEventId: input.swarmSpawnContract.requestEventId,
      checkpointKey: input.swarmSpawnContract.checkpointKey,
      selectedWorkerKind,
      selectedPacketKey,
      selectedArtifactTypes,
      intentEventId: input.intentEvent?.id ?? null,
      placeholderBundleKey,
      placeholderRecordEventId: input.recordedPlaceholderEvent?.id ?? null,
      handoffConsumerAgent,
      handoffConsumptionGoal,
      missingRequirements,
      summary: trimText(
        `Execution admission guard allows a later read-only ${selectedWorkerKind} worker slice to consume ${selectedPacketKey ?? "the selected packet"} and ${placeholderBundleKey ?? "the placeholder bundle"} without re-deriving request, selection, or placeholder truth.`,
        220,
      ),
      reason: trimText(
        `Execution preflight is ${input.executionPreflight.state}; request ${input.swarmSpawnContract.requestEventId ?? "missing"}; intent ${input.intentEvent?.id ?? "missing"}; placeholder ${input.recordedPlaceholderEvent?.id ?? "missing"}.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "A later execution slice may now consume the selected read-only worker lane without widening authority.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    move: "execute_selected_lane",
    state: "blocked",
    executionPreflightState: input.executionPreflight.state,
    requestEventId: input.swarmSpawnContract.requestEventId,
    checkpointKey: input.swarmSpawnContract.checkpointKey,
    selectedWorkerKind,
    selectedPacketKey,
    selectedArtifactTypes,
    intentEventId: input.intentEvent?.id ?? null,
    placeholderBundleKey,
    placeholderRecordEventId: input.recordedPlaceholderEvent?.id ?? null,
    handoffConsumerAgent,
    handoffConsumptionGoal,
    missingRequirements,
    summary: trimText(
      `Execution admission guard blocks a later read-only worker slice because ${missingRequirements.join("; ")}.`,
      220,
    ),
    reason: trimText(
      `Execution preflight is ${input.executionPreflight.state}; request ${input.swarmSpawnContract.requestRecordState}; selected lane ${selectedWorkerKind ?? "missing"}; placeholder record ${input.recordedPlaceholderEvent?.id ?? "missing"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Satisfy the missing request, lane-selection, or placeholder-record requirement before any later execution slice runs.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerExecutionLifecycle(input: {
  swarmSpawnContract: HelmV21RunThreadSwarmSpawnContract;
  executionPreflight: {
    state: HelmV21RunThreadSwarmReadOnlyWorkerContract["executionPreflightState"];
    summary: string;
  };
  executionGuard: HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardContract;
  recordedExecutionEvent: RunThreadContractInput["swarmReadOnlyWorkerExecutionEvent"];
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleContract {
  const shared = {
    requestEventId: input.swarmSpawnContract.requestEventId,
    checkpointKey: input.swarmSpawnContract.checkpointKey,
    intentEventId: input.executionGuard.intentEventId,
    placeholderRecordEventId: input.executionGuard.placeholderRecordEventId,
    executionEventId: input.recordedExecutionEvent?.id ?? null,
    selectedWorkerKind: input.executionGuard.selectedWorkerKind,
    selectedPacketKey: input.executionGuard.selectedPacketKey,
    placeholderBundleKey: input.executionGuard.placeholderBundleKey,
    executionPreflightState: input.executionPreflight.state,
    executionGuardState: input.executionGuard.state,
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };

  if (input.recordedExecutionEvent || input.executionGuard.state === "reused") {
    return {
      ...shared,
      state: "recorded",
      driver: "recorded",
      summary: trimText(
        `Execution lifecycle is already recorded for ${input.executionGuard.selectedPacketKey ?? "the selected packet"} on ${input.executionGuard.placeholderBundleKey ?? "the placeholder bundle"} and can be reused by any later bounded fan-out slice.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Reuse the recorded execution admission event in any later execution slice; do not re-record it.",
    };
  }

  if (input.swarmSpawnContract.state !== "requestable" || input.executionPreflight.state === "blocked") {
    return {
      ...shared,
      state: "blocked",
      driver: "admission_blocked",
      summary:
        "Execution lifecycle is blocked because swarm spawn admission is not requestable on the current run thread.",
      nextAction:
        input.nextAction ??
        "Clear the swarm admission blocker before any later execution slice can be recorded.",
    };
  }

  if (input.executionPreflight.state === "request_required") {
    return {
      ...shared,
      state: "request_required",
      driver: "request_required",
      summary:
        "Execution lifecycle is waiting for a swarm request record before any later read-only worker execution slice can be admitted.",
      nextAction:
        input.nextAction ??
        "Record the read-only swarm request before any later execution slice is recorded.",
    };
  }

  if (input.executionPreflight.state === "selection_required") {
    return {
      ...shared,
      state: "selection_required",
      driver: "selection_required",
      summary:
        "Execution lifecycle is waiting for one allowlisted lane selection before any later execution slice can be admitted.",
      nextAction:
        input.nextAction ??
        "Select one allowlisted lane before any later execution slice is recorded.",
    };
  }

  if (input.executionPreflight.state === "placeholder_record_required") {
    return {
      ...shared,
      state: "placeholder_record_required",
      driver: "placeholder_record_required",
      summary: trimText(
        `Execution lifecycle is waiting for the ${input.executionGuard.selectedWorkerKind ?? "selected"} placeholder bundle record before any later execution slice can be admitted.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Record the placeholder bundle before any later execution slice is recorded.",
    };
  }

  return {
    ...shared,
    state: "recordable",
    driver: "recordable",
    summary: trimText(
      `Execution lifecycle is recordable for the ${input.executionGuard.selectedWorkerKind ?? "selected"} lane. A later slice can persist the execution seam without starting any worker yet.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Record the execution seam if you want to admit a later fan-out slice without re-deriving preflight truth.",
  };
}

function buildSwarmReadOnlyWorkerExecutionCandidate(input: {
  executionLifecycle: HelmV21RunThreadSwarmReadOnlyWorkerExecutionLifecycleContract;
  executionGuard: HelmV21RunThreadSwarmReadOnlyWorkerExecutionGuardContract;
  recordedExecutionEvent: RunThreadContractInput["swarmReadOnlyWorkerExecutionEvent"];
  recordedPlaceholderEvent: RunThreadContractInput["swarmReadOnlyWorkerPlaceholderEvent"];
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateContract {
  const materializationBundleTitle =
    input.recordedPlaceholderEvent?.placeholderBundleTitle ??
    (input.executionGuard.selectedWorkerKind
      ? buildSwarmReadOnlyWorkerPlaceholderBundleTitle(input.executionGuard.selectedWorkerKind)
      : null);

  if (!input.recordedExecutionEvent) {
    return {
      state: "not_ready",
      driver: "execution_not_recorded",
      artifactMaterializationState: "not_ready",
      executionEventId: null,
      checkpointKey: input.executionLifecycle.checkpointKey,
      selectedWorkerKind: input.executionGuard.selectedWorkerKind,
      selectedPacketKey: input.executionGuard.selectedPacketKey,
      materializationBundleKey: input.executionGuard.placeholderBundleKey,
      materializationBundleTitle,
      materializationArtifactTypes: [],
      handoffConsumerAgent: input.executionGuard.handoffConsumerAgent,
      handoffConsumptionGoal: input.executionGuard.handoffConsumptionGoal,
      summary: trimText(
        `Execution candidate is not ready because execution lifecycle is ${input.executionLifecycle.state}. Artifact materialization must wait until a bounded execution admission record exists for ${input.executionGuard.selectedPacketKey ?? "the selected lane"}.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Record the execution slice before any later artifact materialization step is considered ready.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "candidate_ready",
    driver: "execution_recorded",
    artifactMaterializationState: "intent_ready",
    executionEventId: input.recordedExecutionEvent.id,
    checkpointKey: input.recordedExecutionEvent.checkpointKey,
    selectedWorkerKind: input.recordedExecutionEvent.workerKind,
    selectedPacketKey: input.recordedExecutionEvent.packetKey,
    materializationBundleKey: input.recordedExecutionEvent.placeholderBundleKey,
    materializationBundleTitle,
    materializationArtifactTypes: input.recordedExecutionEvent.artifactTypes,
    handoffConsumerAgent: input.recordedExecutionEvent.handoffConsumerAgent,
    handoffConsumptionGoal: input.recordedExecutionEvent.handoffConsumptionGoal,
    summary: trimText(
      `Execution candidate is ready for the ${input.recordedExecutionEvent.workerKind} lane. A later materialization slice may anchor on ${input.recordedExecutionEvent.placeholderBundleKey} and emit ${input.recordedExecutionEvent.artifactTypes.join(", ")} without re-deriving request or lane-selection truth.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Any later materialization slice should reuse the recorded execution candidate and keep the output artifact-first and review-first.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerArtifactMaterializationGuard(input: {
  executionCandidate: HelmV21RunThreadSwarmReadOnlyWorkerExecutionCandidateContract;
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardContract {
  const missingRequirements =
    input.executionCandidate.state !== "candidate_ready" ||
    input.executionCandidate.artifactMaterializationState !== "intent_ready"
      ? ["execution candidate is not ready"]
      : !input.executionCandidate.materializationBundleKey
        ? ["materialization bundle anchor is missing"]
        : input.executionCandidate.materializationArtifactTypes.length === 0
          ? ["materialization artifact outputs are missing"]
          : [];

  if (missingRequirements.length === 0) {
    return {
      move: "materialize_artifact_bundle",
      state: "allowed",
      executionCandidateState: input.executionCandidate.state,
      artifactMaterializationState: input.executionCandidate.artifactMaterializationState,
      executionEventId: input.executionCandidate.executionEventId,
      checkpointKey: input.executionCandidate.checkpointKey,
      selectedWorkerKind: input.executionCandidate.selectedWorkerKind,
      selectedPacketKey: input.executionCandidate.selectedPacketKey,
      materializationBundleKey: input.executionCandidate.materializationBundleKey,
      materializationBundleTitle: input.executionCandidate.materializationBundleTitle,
      materializationArtifactTypes: input.executionCandidate.materializationArtifactTypes,
      handoffConsumerAgent: input.executionCandidate.handoffConsumerAgent,
      handoffConsumptionGoal: input.executionCandidate.handoffConsumptionGoal,
      missingRequirements,
      summary: trimText(
        `Artifact materialization guard allows a later ${input.executionCandidate.selectedWorkerKind ?? "selected"} result slice to anchor on ${input.executionCandidate.materializationBundleKey ?? "the materialization bundle"} and emit ${input.executionCandidate.materializationArtifactTypes.join(", ")} without re-deriving execution truth.`,
        220,
      ),
      reason: trimText(
        `Execution candidate ${input.executionCandidate.executionEventId ?? "missing"} is ready for ${input.executionCandidate.selectedPacketKey ?? "the selected lane"} on ${input.executionCandidate.materializationBundleKey ?? "no-bundle"}.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Any later materialization slice may now reuse this execution candidate without widening worker authority.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    move: "materialize_artifact_bundle",
    state: "blocked",
    executionCandidateState: input.executionCandidate.state,
    artifactMaterializationState: input.executionCandidate.artifactMaterializationState,
    executionEventId: input.executionCandidate.executionEventId,
    checkpointKey: input.executionCandidate.checkpointKey,
    selectedWorkerKind: input.executionCandidate.selectedWorkerKind,
    selectedPacketKey: input.executionCandidate.selectedPacketKey,
    materializationBundleKey: input.executionCandidate.materializationBundleKey,
    materializationBundleTitle: input.executionCandidate.materializationBundleTitle,
    materializationArtifactTypes: input.executionCandidate.materializationArtifactTypes,
    handoffConsumerAgent: input.executionCandidate.handoffConsumerAgent,
    handoffConsumptionGoal: input.executionCandidate.handoffConsumptionGoal,
    missingRequirements,
    summary: trimText(
      `Artifact materialization guard blocks a later result slice because ${missingRequirements.join("; ")}.`,
      220,
    ),
    reason: trimText(
      `Execution candidate is ${input.executionCandidate.state}/${input.executionCandidate.driver}; materialization ${input.executionCandidate.artifactMaterializationState}; bundle ${input.executionCandidate.materializationBundleKey ?? "missing"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Record and stabilize the execution candidate before any later materialization slice runs.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerArtifactMaterializationLifecycle(input: {
  artifactMaterializationGuard: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardContract;
  recordedMaterializationEvent: RunThreadContractInput["swarmReadOnlyWorkerMaterializationEvent"];
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract {
  if (input.recordedMaterializationEvent) {
    return {
      state: "recorded",
      driver: "recorded",
      executionEventId: input.artifactMaterializationGuard.executionEventId,
      materializationEventId: input.recordedMaterializationEvent.id,
      checkpointKey: input.recordedMaterializationEvent.checkpointKey,
      selectedWorkerKind: input.recordedMaterializationEvent.workerKind,
      selectedPacketKey: input.recordedMaterializationEvent.packetKey,
      materializationBundleKey: input.recordedMaterializationEvent.materializationBundleKey,
      materializationBundleTitle: input.recordedMaterializationEvent.materializationBundleTitle,
      materializationArtifactTypes: input.recordedMaterializationEvent.artifactTypes,
      artifactMaterializationGuardState: input.artifactMaterializationGuard.state,
      executionCandidateState: input.artifactMaterializationGuard.executionCandidateState,
      artifactMaterializationState: input.artifactMaterializationGuard.artifactMaterializationState,
      summary: trimText(
        `Artifact materialization lifecycle is recorded for ${input.recordedMaterializationEvent.workerKind} on ${input.recordedMaterializationEvent.materializationBundleKey}. Later execution slices may reuse this bounded result-side anchor without widening worker authority.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Keep later swarm result handling artifact-first and review-first; do not widen into transcript merge or send authority.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  if (input.artifactMaterializationGuard.state === "allowed") {
    return {
      state: "recordable",
      driver: "recordable",
      executionEventId: input.artifactMaterializationGuard.executionEventId,
      materializationEventId: null,
      checkpointKey: input.artifactMaterializationGuard.checkpointKey,
      selectedWorkerKind: input.artifactMaterializationGuard.selectedWorkerKind,
      selectedPacketKey: input.artifactMaterializationGuard.selectedPacketKey,
      materializationBundleKey: input.artifactMaterializationGuard.materializationBundleKey,
      materializationBundleTitle: input.artifactMaterializationGuard.materializationBundleTitle,
      materializationArtifactTypes: input.artifactMaterializationGuard.materializationArtifactTypes,
      artifactMaterializationGuardState: input.artifactMaterializationGuard.state,
      executionCandidateState: input.artifactMaterializationGuard.executionCandidateState,
      artifactMaterializationState: input.artifactMaterializationGuard.artifactMaterializationState,
      summary: trimText(
        `Artifact materialization lifecycle is recordable for ${input.artifactMaterializationGuard.selectedWorkerKind ?? "the selected"} lane. A later slice can record ${input.artifactMaterializationGuard.materializationBundleKey ?? "the materialization bundle"} without starting any real worker yet.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Record the bounded materialization seam if you want later result handling to reuse it without re-deriving candidate truth.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "blocked",
    driver: "guard_blocked",
    executionEventId: input.artifactMaterializationGuard.executionEventId,
    materializationEventId: null,
    checkpointKey: input.artifactMaterializationGuard.checkpointKey,
    selectedWorkerKind: input.artifactMaterializationGuard.selectedWorkerKind,
    selectedPacketKey: input.artifactMaterializationGuard.selectedPacketKey,
    materializationBundleKey: input.artifactMaterializationGuard.materializationBundleKey,
    materializationBundleTitle: input.artifactMaterializationGuard.materializationBundleTitle,
    materializationArtifactTypes: input.artifactMaterializationGuard.materializationArtifactTypes,
    artifactMaterializationGuardState: input.artifactMaterializationGuard.state,
    executionCandidateState: input.artifactMaterializationGuard.executionCandidateState,
    artifactMaterializationState: input.artifactMaterializationGuard.artifactMaterializationState,
    summary: trimText(
      `Artifact materialization lifecycle is blocked because ${input.artifactMaterializationGuard.missingRequirements.join("; ")}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Stabilize the execution candidate and materialization guard before recording any later result-side slice.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerResultSideOutput(input: {
  artifactMaterializationLifecycle: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationLifecycleContract;
  artifactMaterializationGuard: HelmV21RunThreadSwarmReadOnlyWorkerArtifactMaterializationGuardContract;
  recordedMaterializationEvent: RunThreadContractInput["swarmReadOnlyWorkerMaterializationEvent"];
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract {
  if (input.recordedMaterializationEvent) {
    return {
      state: "output_ready",
      driver: "materialization_recorded",
      executionEventId: input.artifactMaterializationLifecycle.executionEventId,
      materializationEventId: input.recordedMaterializationEvent.id,
      checkpointKey: input.recordedMaterializationEvent.checkpointKey,
      selectedWorkerKind: input.recordedMaterializationEvent.workerKind,
      selectedPacketKey: input.recordedMaterializationEvent.packetKey,
      outputBundleKey: input.recordedMaterializationEvent.materializationBundleKey,
      outputBundleTitle: input.recordedMaterializationEvent.materializationBundleTitle,
      outputArtifactTypes: input.recordedMaterializationEvent.artifactTypes,
      handoffConsumerAgent: input.recordedMaterializationEvent.handoffConsumerAgent,
      handoffConsumptionGoal: input.recordedMaterializationEvent.handoffConsumptionGoal,
      artifactMaterializationLifecycleState: input.artifactMaterializationLifecycle.state,
      summary: trimText(
        `Result-side output contract is ready for ${input.recordedMaterializationEvent.workerKind} on ${input.recordedMaterializationEvent.materializationBundleKey}. Later bounded result handling may reuse ${input.recordedMaterializationEvent.artifactTypes.join(", ")} without widening worker authority or merging transcripts.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Any later result-side slice should reuse this recorded output contract and stay artifact-first, review-first, and bounded to the selected lane.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "not_ready",
    driver: "materialization_not_recorded",
    executionEventId: input.artifactMaterializationLifecycle.executionEventId,
    materializationEventId: null,
    checkpointKey: input.artifactMaterializationLifecycle.checkpointKey,
    selectedWorkerKind: input.artifactMaterializationLifecycle.selectedWorkerKind,
    selectedPacketKey: input.artifactMaterializationLifecycle.selectedPacketKey,
    outputBundleKey: input.artifactMaterializationLifecycle.materializationBundleKey,
    outputBundleTitle: input.artifactMaterializationLifecycle.materializationBundleTitle,
    outputArtifactTypes: input.artifactMaterializationLifecycle.materializationArtifactTypes,
    handoffConsumerAgent: input.artifactMaterializationGuard.handoffConsumerAgent,
    handoffConsumptionGoal: input.artifactMaterializationGuard.handoffConsumptionGoal,
    artifactMaterializationLifecycleState: input.artifactMaterializationLifecycle.state,
    summary: trimText(
      `Result-side output contract is not ready because artifact materialization lifecycle is ${input.artifactMaterializationLifecycle.state}. Record the bounded materialization seam before any later result-handling slice consumes ${input.artifactMaterializationLifecycle.materializationBundleKey ?? "the selected output bundle"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Record the materialization seam before any later result-side output slice consumes the selected lane outputs.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerResultSideOutputGuard(input: {
  resultSideOutput: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract;
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardContract {
  const missingRequirements =
    input.resultSideOutput.state !== "output_ready" ? ["result-side output is not ready"] : [];

  if (missingRequirements.length === 0) {
    return {
      move: "consume_result_side_output",
      state: "allowed",
      resultSideOutputState: input.resultSideOutput.state,
      executionEventId: input.resultSideOutput.executionEventId,
      materializationEventId: input.resultSideOutput.materializationEventId,
      checkpointKey: input.resultSideOutput.checkpointKey,
      selectedWorkerKind: input.resultSideOutput.selectedWorkerKind,
      selectedPacketKey: input.resultSideOutput.selectedPacketKey,
      outputBundleKey: input.resultSideOutput.outputBundleKey,
      outputBundleTitle: input.resultSideOutput.outputBundleTitle,
      outputArtifactTypes: input.resultSideOutput.outputArtifactTypes,
      handoffConsumerAgent: input.resultSideOutput.handoffConsumerAgent,
      handoffConsumptionGoal: input.resultSideOutput.handoffConsumptionGoal,
      missingRequirements,
      summary: trimText(
        `Result-side output guard allows later bounded output handling for ${input.resultSideOutput.outputBundleKey ?? "the selected output bundle"} without re-deriving execution or materialization truth.`,
        220,
      ),
      reason: trimText(
        `Result-side output ${input.resultSideOutput.materializationEventId ?? "missing"} is ready for ${input.resultSideOutput.selectedPacketKey ?? "the selected lane"}.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Any later output-handling slice may now reuse the recorded result-side output truth without widening worker authority.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    move: "consume_result_side_output",
    state: "blocked",
    resultSideOutputState: input.resultSideOutput.state,
    executionEventId: input.resultSideOutput.executionEventId,
    materializationEventId: input.resultSideOutput.materializationEventId,
    checkpointKey: input.resultSideOutput.checkpointKey,
    selectedWorkerKind: input.resultSideOutput.selectedWorkerKind,
    selectedPacketKey: input.resultSideOutput.selectedPacketKey,
    outputBundleKey: input.resultSideOutput.outputBundleKey,
    outputBundleTitle: input.resultSideOutput.outputBundleTitle,
    outputArtifactTypes: input.resultSideOutput.outputArtifactTypes,
    handoffConsumerAgent: input.resultSideOutput.handoffConsumerAgent,
    handoffConsumptionGoal: input.resultSideOutput.handoffConsumptionGoal,
    missingRequirements,
    summary: trimText(
      `Result-side output guard blocks later bounded output handling because ${missingRequirements.join("; ")}.`,
      220,
    ),
    reason: trimText(
      `Result-side output is ${input.resultSideOutput.state}/${input.resultSideOutput.driver}; output bundle ${input.resultSideOutput.outputBundleKey ?? "missing"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Record the bounded materialization seam before any later output-handling slice consumes the selected lane outputs.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerResultSideOutputLifecycle(input: {
  resultSideOutput: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract;
  resultSideOutputGuard: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardContract;
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleContract {
  if (input.resultSideOutputGuard.state === "allowed") {
    return {
      state: "consumable",
      driver: "consumable",
      executionEventId: input.resultSideOutput.executionEventId,
      materializationEventId: input.resultSideOutput.materializationEventId,
      checkpointKey: input.resultSideOutput.checkpointKey,
      selectedWorkerKind: input.resultSideOutput.selectedWorkerKind,
      selectedPacketKey: input.resultSideOutput.selectedPacketKey,
      outputBundleKey: input.resultSideOutput.outputBundleKey,
      outputBundleTitle: input.resultSideOutput.outputBundleTitle,
      outputArtifactTypes: input.resultSideOutput.outputArtifactTypes,
      handoffConsumerAgent: input.resultSideOutput.handoffConsumerAgent,
      handoffConsumptionGoal: input.resultSideOutput.handoffConsumptionGoal,
      resultSideOutputState: input.resultSideOutput.state,
      resultSideOutputGuardState: input.resultSideOutputGuard.state,
      summary: trimText(
        `Result-side output lifecycle is consumable for ${input.resultSideOutput.outputBundleKey ?? "the selected output bundle"}. Later bounded output handling may reuse this seam without widening worker authority or merging transcripts.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Keep later result-side handling artifact-first, review-first, and bounded to the selected lane outputs.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "blocked",
    driver: "guard_blocked",
    executionEventId: input.resultSideOutput.executionEventId,
    materializationEventId: input.resultSideOutput.materializationEventId,
    checkpointKey: input.resultSideOutput.checkpointKey,
    selectedWorkerKind: input.resultSideOutput.selectedWorkerKind,
    selectedPacketKey: input.resultSideOutput.selectedPacketKey,
    outputBundleKey: input.resultSideOutput.outputBundleKey,
    outputBundleTitle: input.resultSideOutput.outputBundleTitle,
    outputArtifactTypes: input.resultSideOutput.outputArtifactTypes,
    handoffConsumerAgent: input.resultSideOutput.handoffConsumerAgent,
    handoffConsumptionGoal: input.resultSideOutput.handoffConsumptionGoal,
    resultSideOutputState: input.resultSideOutput.state,
    resultSideOutputGuardState: input.resultSideOutputGuard.state,
    summary: trimText(
      `Result-side output lifecycle is blocked because ${input.resultSideOutputGuard.missingRequirements.join("; ")}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Stabilize the recorded result-side output before any later output-handling slice consumes it.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerOutputConsumption(input: {
  resultSideOutput: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputContract;
  resultSideOutputGuard: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputGuardContract;
  resultSideOutputLifecycle: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleContract;
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract {
  if (input.resultSideOutputLifecycle.state === "consumable") {
    return {
      state: "consumable",
      driver: "output_consumable",
      executionEventId: input.resultSideOutput.executionEventId,
      materializationEventId: input.resultSideOutput.materializationEventId,
      checkpointKey: input.resultSideOutput.checkpointKey,
      selectedWorkerKind: input.resultSideOutput.selectedWorkerKind,
      selectedPacketKey: input.resultSideOutput.selectedPacketKey,
      outputBundleKey: input.resultSideOutput.outputBundleKey,
      outputBundleTitle: input.resultSideOutput.outputBundleTitle,
      outputArtifactTypes: input.resultSideOutput.outputArtifactTypes,
      handoffConsumerAgent: input.resultSideOutput.handoffConsumerAgent,
      handoffConsumptionGoal: input.resultSideOutput.handoffConsumptionGoal,
      resultSideOutputState: input.resultSideOutput.state,
      resultSideOutputGuardState: input.resultSideOutputGuard.state,
      resultSideOutputLifecycleState: input.resultSideOutputLifecycle.state,
      summary: trimText(
        `Output consumption seam is consumable for ${input.resultSideOutput.outputBundleKey ?? "the selected output bundle"}. Later bounded result handling may consume this seam without widening worker authority, persisting new bundles, or merging transcripts.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Keep later output consumption artifact-first, review-first, and bounded to the selected lane outputs.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "not_ready",
    driver: "output_not_consumable",
    executionEventId: input.resultSideOutput.executionEventId,
    materializationEventId: input.resultSideOutput.materializationEventId,
    checkpointKey: input.resultSideOutput.checkpointKey,
    selectedWorkerKind: input.resultSideOutput.selectedWorkerKind,
    selectedPacketKey: input.resultSideOutput.selectedPacketKey,
    outputBundleKey: input.resultSideOutput.outputBundleKey,
    outputBundleTitle: input.resultSideOutput.outputBundleTitle,
    outputArtifactTypes: input.resultSideOutput.outputArtifactTypes,
    handoffConsumerAgent: input.resultSideOutput.handoffConsumerAgent,
    handoffConsumptionGoal: input.resultSideOutput.handoffConsumptionGoal,
    resultSideOutputState: input.resultSideOutput.state,
    resultSideOutputGuardState: input.resultSideOutputGuard.state,
    resultSideOutputLifecycleState: input.resultSideOutputLifecycle.state,
    summary: trimText(
      `Output consumption seam is not ready because result-side output lifecycle is ${input.resultSideOutputLifecycle.state}. Stabilize the bounded output seam before any later result adoption slice consumes ${input.resultSideOutput.outputBundleKey ?? "the selected output bundle"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Stabilize the bounded result-side output seam before any later output consumption or adoption slice consumes it.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerResultAdoption(input: {
  outputConsumption: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract;
  resultSideOutputLifecycle: HelmV21RunThreadSwarmReadOnlyWorkerResultSideOutputLifecycleContract;
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionContract {
  if (input.outputConsumption.state === "consumable") {
    return {
      state: "adoption_ready",
      driver: "consumption_ready",
      executionEventId: input.outputConsumption.executionEventId,
      materializationEventId: input.outputConsumption.materializationEventId,
      checkpointKey: input.outputConsumption.checkpointKey,
      selectedWorkerKind: input.outputConsumption.selectedWorkerKind,
      selectedPacketKey: input.outputConsumption.selectedPacketKey,
      outputBundleKey: input.outputConsumption.outputBundleKey,
      outputBundleTitle: input.outputConsumption.outputBundleTitle,
      outputArtifactTypes: input.outputConsumption.outputArtifactTypes,
      handoffConsumerAgent: input.outputConsumption.handoffConsumerAgent,
      handoffConsumptionGoal: input.outputConsumption.handoffConsumptionGoal,
      outputConsumptionState: input.outputConsumption.state,
      resultSideOutputLifecycleState: input.resultSideOutputLifecycle.state,
      summary: trimText(
        `Result adoption contract is ready for ${input.outputConsumption.outputBundleKey ?? "the selected output bundle"}. Any later adoption slice must stay bounded to typed output refs, remain review-first, and avoid widening worker authority.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "If a later adoption slice is introduced, keep it bounded to typed output refs and review-first adoption only.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "not_ready",
    driver: "consumption_not_ready",
    executionEventId: input.outputConsumption.executionEventId,
    materializationEventId: input.outputConsumption.materializationEventId,
    checkpointKey: input.outputConsumption.checkpointKey,
    selectedWorkerKind: input.outputConsumption.selectedWorkerKind,
    selectedPacketKey: input.outputConsumption.selectedPacketKey,
    outputBundleKey: input.outputConsumption.outputBundleKey,
    outputBundleTitle: input.outputConsumption.outputBundleTitle,
    outputArtifactTypes: input.outputConsumption.outputArtifactTypes,
    handoffConsumerAgent: input.outputConsumption.handoffConsumerAgent,
    handoffConsumptionGoal: input.outputConsumption.handoffConsumptionGoal,
    outputConsumptionState: input.outputConsumption.state,
    resultSideOutputLifecycleState: input.resultSideOutputLifecycle.state,
    summary: trimText(
      `Result adoption contract is not ready because output consumption seam is ${input.outputConsumption.state}. Keep the selected output seam bounded and consumable before any later adoption slice attempts to reuse ${input.outputConsumption.outputBundleKey ?? "the selected output bundle"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Stabilize the output consumption seam before any later result adoption slice reuses it.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerOutputAdoptionGuard(input: {
  outputConsumption: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract;
  resultAdoption: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionContract;
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardContract {
  const missingRequirements =
    input.resultAdoption.state !== "adoption_ready" ? ["result adoption is not ready"] : [];

  if (missingRequirements.length === 0) {
    return {
      move: "adopt_result_side_output",
      state: "allowed",
      outputConsumptionState: input.outputConsumption.state,
      resultAdoptionState: input.resultAdoption.state,
      executionEventId: input.resultAdoption.executionEventId,
      materializationEventId: input.resultAdoption.materializationEventId,
      checkpointKey: input.resultAdoption.checkpointKey,
      selectedWorkerKind: input.resultAdoption.selectedWorkerKind,
      selectedPacketKey: input.resultAdoption.selectedPacketKey,
      outputBundleKey: input.resultAdoption.outputBundleKey,
      outputBundleTitle: input.resultAdoption.outputBundleTitle,
      outputArtifactTypes: input.resultAdoption.outputArtifactTypes,
      handoffConsumerAgent: input.resultAdoption.handoffConsumerAgent,
      handoffConsumptionGoal: input.resultAdoption.handoffConsumptionGoal,
      missingRequirements,
      summary: trimText(
        `Output adoption guard allows a later bounded adoption slice to reuse ${input.resultAdoption.outputBundleKey ?? "the selected output bundle"} without re-deriving consumption or widening worker authority.`,
        220,
      ),
      reason: trimText(
        `Result adoption ${input.resultAdoption.materializationEventId ?? "missing"} is ready for ${input.resultAdoption.selectedPacketKey ?? "the selected lane"}.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Any later output-adoption slice may now reuse the recorded result adoption truth without widening worker authority.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    move: "adopt_result_side_output",
    state: "blocked",
    outputConsumptionState: input.outputConsumption.state,
    resultAdoptionState: input.resultAdoption.state,
    executionEventId: input.resultAdoption.executionEventId,
    materializationEventId: input.resultAdoption.materializationEventId,
    checkpointKey: input.resultAdoption.checkpointKey,
    selectedWorkerKind: input.resultAdoption.selectedWorkerKind,
    selectedPacketKey: input.resultAdoption.selectedPacketKey,
    outputBundleKey: input.resultAdoption.outputBundleKey,
    outputBundleTitle: input.resultAdoption.outputBundleTitle,
    outputArtifactTypes: input.resultAdoption.outputArtifactTypes,
    handoffConsumerAgent: input.resultAdoption.handoffConsumerAgent,
    handoffConsumptionGoal: input.resultAdoption.handoffConsumptionGoal,
    missingRequirements,
    summary: trimText(
      `Output adoption guard blocks later bounded adoption because ${missingRequirements.join("; ")}.`,
      220,
    ),
    reason: trimText(
      `Result adoption is ${input.resultAdoption.state}/${input.resultAdoption.driver}; output bundle ${input.resultAdoption.outputBundleKey ?? "missing"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Stabilize the bounded result adoption seam before any later adoption slice consumes it.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerOutputAdoptionLifecycle(input: {
  outputConsumption: HelmV21RunThreadSwarmReadOnlyWorkerOutputConsumptionContract;
  resultAdoption: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionContract;
  outputAdoptionGuard: HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionGuardContract;
  recordedAdoptionEvent: RunThreadContractInput["swarmReadOnlyWorkerAdoptionEvent"];
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleContract {
  if (input.recordedAdoptionEvent) {
    return {
      state: "recorded",
      driver: "recorded",
      executionEventId: input.resultAdoption.executionEventId,
      materializationEventId: input.resultAdoption.materializationEventId,
      checkpointKey: input.recordedAdoptionEvent.checkpointKey,
      selectedWorkerKind: input.recordedAdoptionEvent.workerKind,
      selectedPacketKey: input.recordedAdoptionEvent.packetKey,
      outputBundleKey: input.recordedAdoptionEvent.outputBundleKey,
      outputBundleTitle: input.recordedAdoptionEvent.outputBundleTitle,
      outputArtifactTypes: input.recordedAdoptionEvent.outputArtifactTypes,
      handoffConsumerAgent: input.recordedAdoptionEvent.handoffConsumerAgent,
      handoffConsumptionGoal: input.recordedAdoptionEvent.handoffConsumptionGoal,
      outputConsumptionState: input.outputConsumption.state,
      resultAdoptionState: input.resultAdoption.state,
      outputAdoptionGuardState: input.outputAdoptionGuard.state,
      summary: trimText(
        `Output adoption lifecycle is recorded for ${input.recordedAdoptionEvent.outputBundleKey}. Later result-side handling may reuse this bounded adoption seam without widening worker authority or creating new bundle persistence.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Keep later output adoption bounded to typed output refs and review-first result handling.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  if (input.outputAdoptionGuard.state === "allowed") {
    return {
      state: "recordable",
      driver: "recordable",
      executionEventId: input.resultAdoption.executionEventId,
      materializationEventId: input.resultAdoption.materializationEventId,
      checkpointKey: input.resultAdoption.checkpointKey,
      selectedWorkerKind: input.resultAdoption.selectedWorkerKind,
      selectedPacketKey: input.resultAdoption.selectedPacketKey,
      outputBundleKey: input.resultAdoption.outputBundleKey,
      outputBundleTitle: input.resultAdoption.outputBundleTitle,
      outputArtifactTypes: input.resultAdoption.outputArtifactTypes,
      handoffConsumerAgent: input.resultAdoption.handoffConsumerAgent,
      handoffConsumptionGoal: input.resultAdoption.handoffConsumptionGoal,
      outputConsumptionState: input.outputConsumption.state,
      resultAdoptionState: input.resultAdoption.state,
      outputAdoptionGuardState: input.outputAdoptionGuard.state,
      summary: trimText(
        `Output adoption lifecycle is recordable for ${input.resultAdoption.outputBundleKey ?? "the selected output bundle"}. A later slice can store the bounded adoption seam without widening worker authority or creating new artifact persistence.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Record the bounded output adoption seam if you want later result handling to reuse it without re-deriving adoption truth.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "blocked",
    driver: "guard_blocked",
    executionEventId: input.resultAdoption.executionEventId,
    materializationEventId: input.resultAdoption.materializationEventId,
    checkpointKey: input.resultAdoption.checkpointKey,
    selectedWorkerKind: input.resultAdoption.selectedWorkerKind,
    selectedPacketKey: input.resultAdoption.selectedPacketKey,
    outputBundleKey: input.resultAdoption.outputBundleKey,
    outputBundleTitle: input.resultAdoption.outputBundleTitle,
    outputArtifactTypes: input.resultAdoption.outputArtifactTypes,
    handoffConsumerAgent: input.resultAdoption.handoffConsumerAgent,
    handoffConsumptionGoal: input.resultAdoption.handoffConsumptionGoal,
    outputConsumptionState: input.outputConsumption.state,
    resultAdoptionState: input.resultAdoption.state,
    outputAdoptionGuardState: input.outputAdoptionGuard.state,
    summary: trimText(
      `Output adoption lifecycle is blocked because ${input.outputAdoptionGuard.missingRequirements.join("; ")}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Stabilize the result adoption seam before any later adoption slice reuses it.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerResultAdoptionResultSide(input: {
  outputAdoptionRecordState: HelmV21RunThreadSwarmReadOnlyWorkerRecordState;
  outputAdoptionEventId: string | null;
  outputAdoptionLifecycle:
    HelmV21RunThreadSwarmReadOnlyWorkerOutputAdoptionLifecycleContract;
  nextAction: string | null;
}): HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideContract {
  if (input.outputAdoptionLifecycle.state === "recorded") {
    return {
      state: "output_ready",
      driver: "adoption_recorded",
      outputAdoptionEventId: input.outputAdoptionEventId,
      executionEventId: input.outputAdoptionLifecycle.executionEventId,
      materializationEventId: input.outputAdoptionLifecycle.materializationEventId,
      checkpointKey: input.outputAdoptionLifecycle.checkpointKey,
      selectedWorkerKind: input.outputAdoptionLifecycle.selectedWorkerKind,
      selectedPacketKey: input.outputAdoptionLifecycle.selectedPacketKey,
      outputBundleKey: input.outputAdoptionLifecycle.outputBundleKey,
      outputBundleTitle: input.outputAdoptionLifecycle.outputBundleTitle,
      outputArtifactTypes: input.outputAdoptionLifecycle.outputArtifactTypes,
      handoffConsumerAgent: input.outputAdoptionLifecycle.handoffConsumerAgent,
      handoffConsumptionGoal: input.outputAdoptionLifecycle.handoffConsumptionGoal,
      outputAdoptionRecordState: input.outputAdoptionRecordState,
      outputAdoptionLifecycleState: input.outputAdoptionLifecycle.state,
      summary: trimText(
        `Result-adoption result-side output is ready for ${input.outputAdoptionLifecycle.outputBundleKey ?? "the adopted output bundle"}. Any later slice may reuse this bounded adopted-output truth without widening worker authority or materializing new bundle persistence.`,
        220,
      ),
      nextAction:
        input.nextAction ??
        "Keep any later adopted-output handling bounded to typed output refs and review-first result handling only.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "not_ready",
    driver: "adoption_not_recorded",
    outputAdoptionEventId: input.outputAdoptionEventId,
    executionEventId: input.outputAdoptionLifecycle.executionEventId,
    materializationEventId: input.outputAdoptionLifecycle.materializationEventId,
    checkpointKey: input.outputAdoptionLifecycle.checkpointKey,
    selectedWorkerKind: input.outputAdoptionLifecycle.selectedWorkerKind,
    selectedPacketKey: input.outputAdoptionLifecycle.selectedPacketKey,
    outputBundleKey: input.outputAdoptionLifecycle.outputBundleKey,
    outputBundleTitle: input.outputAdoptionLifecycle.outputBundleTitle,
    outputArtifactTypes: input.outputAdoptionLifecycle.outputArtifactTypes,
    handoffConsumerAgent: input.outputAdoptionLifecycle.handoffConsumerAgent,
    handoffConsumptionGoal: input.outputAdoptionLifecycle.handoffConsumptionGoal,
    outputAdoptionRecordState: input.outputAdoptionRecordState,
    outputAdoptionLifecycleState: input.outputAdoptionLifecycle.state,
    summary: trimText(
      `Result-adoption result-side output is not ready because output adoption lifecycle is ${input.outputAdoptionLifecycle.state}. Keep the bounded adoption seam recorded before any later adopted-output slice attempts to reuse ${input.outputAdoptionLifecycle.outputBundleKey ?? "the selected output bundle"}.`,
      220,
    ),
    nextAction:
      input.nextAction ??
      "Stabilize the bounded output adoption seam before any later adopted-output slice reuses it.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function buildSwarmReadOnlyWorkerContract(input: {
  workspaceId: string;
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  swarmSpawnContract: HelmV21RunThreadSwarmSpawnContract;
  swarmReadOnlyWorkerIntentEvent?: RunThreadContractInput["swarmReadOnlyWorkerIntentEvent"];
  swarmReadOnlyWorkerPlaceholderEvent?: RunThreadContractInput["swarmReadOnlyWorkerPlaceholderEvent"];
  swarmReadOnlyWorkerExecutionEvent?: RunThreadContractInput["swarmReadOnlyWorkerExecutionEvent"];
  swarmReadOnlyWorkerMaterializationEvent?: RunThreadContractInput["swarmReadOnlyWorkerMaterializationEvent"];
  swarmReadOnlyWorkerAdoptionEvent?: RunThreadContractInput["swarmReadOnlyWorkerAdoptionEvent"];
}): HelmV21RunThreadSwarmReadOnlyWorkerContract {
  const lanePreviews = buildSwarmReadOnlyWorkerLanePreviews({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId,
    opportunityId: input.opportunityId,
    companyId: input.companyId,
    checkpointKey: input.swarmSpawnContract.checkpointKey,
  });
  const allowlistedWorkers = SWARM_READ_ONLY_WORKER_ALLOWLIST.slice();
  const previewPacketKeys = lanePreviews.map((item) => item.packetKey);
  const selectedLanePreview = input.swarmReadOnlyWorkerIntentEvent
    ? lanePreviews.find(
        (item) =>
          item.workerKind === input.swarmReadOnlyWorkerIntentEvent?.workerKind &&
          item.packetKey === input.swarmReadOnlyWorkerIntentEvent?.packetKey,
      ) ?? null
    : null;
  const recordedPlaceholderEvent =
    input.swarmReadOnlyWorkerPlaceholderEvent &&
    selectedLanePreview &&
    input.swarmReadOnlyWorkerPlaceholderEvent.workerKind === selectedLanePreview.workerKind &&
    input.swarmReadOnlyWorkerPlaceholderEvent.packetKey === selectedLanePreview.packetKey
      ? input.swarmReadOnlyWorkerPlaceholderEvent
      : null;
  const recordedExecutionEvent =
    input.swarmReadOnlyWorkerExecutionEvent &&
    selectedLanePreview &&
    input.swarmReadOnlyWorkerExecutionEvent.workerKind === selectedLanePreview.workerKind &&
    input.swarmReadOnlyWorkerExecutionEvent.packetKey === selectedLanePreview.packetKey &&
    input.swarmReadOnlyWorkerExecutionEvent.placeholderBundleKey ===
      buildSwarmReadOnlyWorkerPlaceholderBundleKey(selectedLanePreview.packetKey)
      ? input.swarmReadOnlyWorkerExecutionEvent
      : null;
  const recordedMaterializationEvent =
    input.swarmReadOnlyWorkerMaterializationEvent &&
    selectedLanePreview &&
    recordedExecutionEvent &&
    input.swarmReadOnlyWorkerMaterializationEvent.workerKind === selectedLanePreview.workerKind &&
    input.swarmReadOnlyWorkerMaterializationEvent.packetKey === selectedLanePreview.packetKey &&
    input.swarmReadOnlyWorkerMaterializationEvent.materializationBundleKey ===
      recordedExecutionEvent.placeholderBundleKey
      ? input.swarmReadOnlyWorkerMaterializationEvent
      : null;
  const recordedAdoptionEvent =
    input.swarmReadOnlyWorkerAdoptionEvent &&
    selectedLanePreview &&
    recordedMaterializationEvent &&
    input.swarmReadOnlyWorkerAdoptionEvent.workerKind === selectedLanePreview.workerKind &&
    input.swarmReadOnlyWorkerAdoptionEvent.packetKey === selectedLanePreview.packetKey &&
    input.swarmReadOnlyWorkerAdoptionEvent.outputBundleKey ===
      recordedMaterializationEvent.materializationBundleKey
      ? input.swarmReadOnlyWorkerAdoptionEvent
      : null;
  const executionPreflight = buildSwarmReadOnlyWorkerExecutionPreflight({
    requestable: input.swarmSpawnContract.state === "requestable",
    requestRecorded: input.swarmSpawnContract.requestRecordState === "requested",
    selectedLanePreview,
    recordedPlaceholderEvent,
  });
  const executionGuard = buildSwarmReadOnlyWorkerExecutionGuard({
    swarmSpawnContract: input.swarmSpawnContract,
    executionPreflight,
    selectedLanePreview,
    recordedPlaceholderEvent,
    recordedExecutionEvent,
    intentEvent: input.swarmReadOnlyWorkerIntentEvent ?? null,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} fan-out slice review-first and artifact-first; do not merge worker transcripts into the lead thread.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const executionLifecycle = buildSwarmReadOnlyWorkerExecutionLifecycle({
    swarmSpawnContract: input.swarmSpawnContract,
    executionPreflight,
    executionGuard,
    recordedExecutionEvent,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} fan-out slice review-first and artifact-first; do not merge worker transcripts into the lead thread.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const executionCandidate = buildSwarmReadOnlyWorkerExecutionCandidate({
    executionLifecycle,
    executionGuard,
    recordedExecutionEvent,
    recordedPlaceholderEvent,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} fan-out slice review-first and artifact-first; do not merge worker transcripts into the lead thread.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const artifactMaterializationGuard = buildSwarmReadOnlyWorkerArtifactMaterializationGuard({
    executionCandidate,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} materialization slice artifact-first, review-first, and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const artifactMaterializationLifecycle = buildSwarmReadOnlyWorkerArtifactMaterializationLifecycle({
    artifactMaterializationGuard,
    recordedMaterializationEvent,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} materialization slice artifact-first, review-first, and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const resultSideOutput = buildSwarmReadOnlyWorkerResultSideOutput({
    artifactMaterializationLifecycle,
    artifactMaterializationGuard,
    recordedMaterializationEvent,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} result-side slice artifact-first, review-first, and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const resultSideOutputGuard = buildSwarmReadOnlyWorkerResultSideOutputGuard({
    resultSideOutput,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} output-handling slice artifact-first, review-first, and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const resultSideOutputLifecycle = buildSwarmReadOnlyWorkerResultSideOutputLifecycle({
    resultSideOutput,
    resultSideOutputGuard,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} output-handling slice artifact-first, review-first, and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const outputConsumption = buildSwarmReadOnlyWorkerOutputConsumption({
    resultSideOutput,
    resultSideOutputGuard,
    resultSideOutputLifecycle,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} output-consumption slice artifact-first, review-first, and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const resultAdoption = buildSwarmReadOnlyWorkerResultAdoption({
    outputConsumption,
    resultSideOutputLifecycle,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} result-adoption slice review-first and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const outputAdoptionGuard = buildSwarmReadOnlyWorkerOutputAdoptionGuard({
    outputConsumption,
    resultAdoption,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} output-adoption slice review-first and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const outputAdoptionLifecycle = buildSwarmReadOnlyWorkerOutputAdoptionLifecycle({
    outputConsumption,
    resultAdoption,
    outputAdoptionGuard,
    recordedAdoptionEvent,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} output-adoption slice review-first and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });
  const resultAdoptionResultSide = buildSwarmReadOnlyWorkerResultAdoptionResultSide({
    outputAdoptionRecordState: recordedAdoptionEvent
      ? "recorded"
      : outputAdoptionGuard.state === "allowed"
        ? "recordable"
        : "not_ready",
    outputAdoptionEventId: recordedAdoptionEvent?.id ?? null,
    outputAdoptionLifecycle,
    nextAction:
      selectedLanePreview
        ? `Keep the later ${selectedLanePreview.workerKind} adopted-output slice review-first and bounded to ${selectedLanePreview.packetKey}.`
        : input.swarmSpawnContract.nextAction ??
          "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
  });

  if (input.swarmSpawnContract.state !== "requestable") {
    return {
      state: "blocked",
      taskClass: input.swarmSpawnContract.taskClass,
      requestState: input.swarmSpawnContract.requestState,
      requestRecordState: input.swarmSpawnContract.requestRecordState,
      requestEventId: input.swarmSpawnContract.requestEventId,
      checkpointKey: input.swarmSpawnContract.checkpointKey,
      requestedAt: input.swarmSpawnContract.requestedAt,
      requestedBy: input.swarmSpawnContract.requestedBy,
      sourcePage: input.swarmSpawnContract.sourcePage,
      allowlistedWorkers,
      artifactPolicy: "artifact_first",
      transcriptPolicy: "no_transcript_merge",
      requestLifecycleState: "blocked",
      requestLifecycleSummary:
        "Read-only worker request lifecycle is blocked because swarm spawn admission is not requestable yet.",
      handoffPreviewState: "not_ready",
      handoffPreviewSummary:
        "Handoff packet previews stay unavailable until swarm admission becomes requestable on the current run thread.",
      previewPacketKeys,
      packetConsumptionIntentState: "not_ready",
      packetConsumptionIntentSummary:
        "Packet consumption intent stays unavailable until a swarm request is recorded on the current run thread.",
      artifactBundlePlaceholderState: "not_ready",
      artifactBundlePlaceholderSummary:
        "Artifact bundle placeholder stays unavailable until a swarm request is recorded and one allowlisted lane is selected.",
      placeholderBundleKey: null,
      placeholderBundleTitle: null,
      placeholderArtifactTypes: [],
      handoffConsumptionState: "not_ready",
      handoffConsumptionSummary:
        "Lead handoff consumption stays unavailable until a swarm request is recorded and one allowlisted lane is selected.",
      handoffConsumerAgent: null,
      handoffConsumptionGoal: null,
      executionRecordState: "not_ready",
      executionRecordSummary:
        "Execution admission record stays unavailable until a swarm request, one allowlisted lane selection and one placeholder record all exist on the current run thread.",
      executionEventId: null,
      executionRecordedAt: null,
      executionRecordedBy: null,
      executionRecordSourcePage: null,
      artifactBundlePlaceholderRecordState: "not_ready",
      artifactBundlePlaceholderRecordSummary:
        "Placeholder record stays unavailable until a swarm request is recorded and one allowlisted lane is selected.",
      handoffConsumptionRecordState: "not_ready",
      handoffConsumptionRecordSummary:
        "Handoff consumption record stays unavailable until a swarm request is recorded and one allowlisted lane is selected.",
      placeholderRecordEventId: null,
      placeholderRecordedAt: null,
      placeholderRecordedBy: null,
      placeholderRecordSourcePage: null,
      executionPreflightState: executionPreflight.state,
      executionPreflightSummary: executionPreflight.summary,
      executionGuardContract: executionGuard,
      executionLifecycleContract: executionLifecycle,
      executionCandidateContract: executionCandidate,
      artifactMaterializationGuardContract: artifactMaterializationGuard,
      artifactMaterializationRecordState: "not_ready",
      artifactMaterializationRecordSummary:
        "Artifact materialization record stays unavailable until execution candidate truth and materialization guard both become ready on the current run thread.",
      artifactMaterializationEventId: null,
      artifactMaterializedAt: null,
      artifactMaterializedBy: null,
      artifactMaterializationSourcePage: null,
      artifactMaterializationLifecycleContract: artifactMaterializationLifecycle,
      resultSideOutputContract: resultSideOutput,
      resultSideOutputGuardContract: resultSideOutputGuard,
      resultSideOutputLifecycleContract: resultSideOutputLifecycle,
      outputConsumptionContract: outputConsumption,
      resultAdoptionContract: resultAdoption,
      outputAdoptionGuardContract: outputAdoptionGuard,
      outputAdoptionRecordState: "not_ready",
      outputAdoptionRecordSummary:
        "Output adoption record stays unavailable until the bounded result adoption seam becomes ready on the current run thread.",
      outputAdoptionEventId: null,
      outputAdoptedAt: null,
      outputAdoptedBy: null,
      outputAdoptionSourcePage: null,
      outputAdoptionLifecycleContract: outputAdoptionLifecycle,
      resultAdoptionResultSideContract: resultAdoptionResultSide,
      intentEventId: null,
      selectedWorkerKind: null,
      selectedPacketKey: null,
      selectedArtifactTypes: [],
      intentRecordedAt: null,
      intentRecordedBy: null,
      intentSourcePage: null,
      lanePreviews,
      summary:
        "Read-only worker lanes stay blocked until swarm admission becomes requestable; the allowlist remains search, grep, and evidence mining.",
      nextAction:
        input.swarmSpawnContract.nextAction ??
        "Clear the swarm admission blocker before any read-only worker lane can be requested.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  if (input.swarmSpawnContract.requestRecordState === "requested") {
    return {
      state: "requested",
      taskClass: input.swarmSpawnContract.taskClass,
      requestState: input.swarmSpawnContract.requestState,
      requestRecordState: input.swarmSpawnContract.requestRecordState,
      requestEventId: input.swarmSpawnContract.requestEventId,
      checkpointKey: input.swarmSpawnContract.checkpointKey,
      requestedAt: input.swarmSpawnContract.requestedAt,
      requestedBy: input.swarmSpawnContract.requestedBy,
      sourcePage: input.swarmSpawnContract.sourcePage,
      allowlistedWorkers,
      artifactPolicy: "artifact_first",
      transcriptPolicy: "no_transcript_merge",
      requestLifecycleState: "request_recorded",
      requestLifecycleSummary:
        "Read-only worker request lifecycle is recorded and waiting for a later execution slice to consume the request.",
      handoffPreviewState: "request_recorded",
      handoffPreviewSummary:
        "Handoff packet previews are fixed for the recorded request and still stay artifact-first until a later execution slice consumes them.",
      previewPacketKeys,
      packetConsumptionIntentState: selectedLanePreview ? "intent_recorded" : "selection_required",
      packetConsumptionIntentSummary: selectedLanePreview
        ? `Packet consumption intent is recorded for the ${selectedLanePreview.workerKind} lane and stays review-first until a later execution slice consumes ${selectedLanePreview.packetKey}.`
        : "Packet consumption intent is not recorded yet. A later slice should select one allowlisted lane before any worker execution is attempted.",
      artifactBundlePlaceholderState: selectedLanePreview
        ? "placeholder_ready"
        : "selection_required",
      artifactBundlePlaceholderSummary: recordedPlaceholderEvent
        ? `Artifact bundle placeholder is explicitly recorded for the ${recordedPlaceholderEvent.workerKind} lane and keeps ${recordedPlaceholderEvent.placeholderBundleKey} review-first until a later execution slice materializes the real bundle.`
        : selectedLanePreview
          ? `Artifact bundle placeholder is ready for the ${selectedLanePreview.workerKind} lane and reserves ${selectedLanePreview.handoffPacket.requiredOutputs.join(", ")} until a later execution slice materializes the bundle.`
          : "Artifact bundle placeholder is not ready yet. Select one allowlisted lane before a later execution slice materializes the bundle.",
      placeholderBundleKey: recordedPlaceholderEvent?.placeholderBundleKey ??
        (selectedLanePreview
          ? buildSwarmReadOnlyWorkerPlaceholderBundleKey(selectedLanePreview.packetKey)
          : null),
      placeholderBundleTitle: recordedPlaceholderEvent?.placeholderBundleTitle ??
        (selectedLanePreview
          ? buildSwarmReadOnlyWorkerPlaceholderBundleTitle(selectedLanePreview.workerKind)
          : null),
      placeholderArtifactTypes: recordedPlaceholderEvent?.artifactTypes ??
        (selectedLanePreview ? selectedLanePreview.handoffPacket.requiredOutputs : []),
      handoffConsumptionState: selectedLanePreview ? "consumable" : "selection_required",
      handoffConsumptionSummary: recordedPlaceholderEvent
        ? `Lead handoff consumption is explicitly recorded for the ${recordedPlaceholderEvent.workerKind} lane and stays artifact-only until lead synthesis consumes ${recordedPlaceholderEvent.packetKey}.`
        : selectedLanePreview
          ? `Lead handoff consumption is ready for the ${selectedLanePreview.workerKind} lane and stays artifact-only until lead synthesis consumes ${selectedLanePreview.packetKey}.`
          : "Lead handoff consumption is not ready yet. Select one allowlisted lane before a later execution slice consumes the handoff packet.",
      handoffConsumerAgent:
        recordedPlaceholderEvent?.handoffConsumerAgent ??
        (selectedLanePreview ? "lead-orchestrator" : null),
      handoffConsumptionGoal:
        recordedPlaceholderEvent?.handoffConsumptionGoal ??
        (selectedLanePreview?.handoffPacket.goal ?? null),
      executionRecordState: recordedExecutionEvent
        ? "recorded"
        : recordedPlaceholderEvent
          ? "recordable"
          : "not_ready",
      executionRecordSummary: recordedExecutionEvent
        ? `Execution admission record is already stored for the ${recordedExecutionEvent.workerKind} lane and keeps ${recordedExecutionEvent.packetKey} explicit without starting any worker yet.`
        : recordedPlaceholderEvent
          ? `Execution admission record is ready for ${recordedPlaceholderEvent.workerKind}. A later slice can store the execution seam without starting the worker yet.`
          : "Execution admission record is not ready yet. Record the placeholder bundle before the later execution slice can be admitted.",
      executionEventId: recordedExecutionEvent?.id ?? null,
      executionRecordedAt: recordedExecutionEvent?.createdAt ?? null,
      executionRecordedBy: recordedExecutionEvent?.requestedBy ?? null,
      executionRecordSourcePage: recordedExecutionEvent?.sourcePage ?? null,
      artifactBundlePlaceholderRecordState: recordedPlaceholderEvent
        ? "recorded"
        : selectedLanePreview
          ? "recordable"
          : "not_ready",
      artifactBundlePlaceholderRecordSummary: recordedPlaceholderEvent
        ? `Placeholder record is already stored for ${recordedPlaceholderEvent.placeholderBundleKey} and can be consumed by a later execution slice without widening authority now.`
        : selectedLanePreview
          ? `Placeholder record is ready for ${selectedLanePreview.workerKind}. A later slice can store ${buildSwarmReadOnlyWorkerPlaceholderBundleKey(selectedLanePreview.packetKey)} without starting the worker yet.`
          : "Placeholder record is not ready yet. Select one allowlisted lane before recording the placeholder bundle.",
      handoffConsumptionRecordState: recordedPlaceholderEvent
        ? "recorded"
        : selectedLanePreview
          ? "recordable"
          : "not_ready",
      handoffConsumptionRecordSummary: recordedPlaceholderEvent
        ? `Handoff consumption record is already stored for ${recordedPlaceholderEvent.handoffConsumerAgent} and keeps ${recordedPlaceholderEvent.packetKey} review-first until a later execution slice consumes it.`
        : selectedLanePreview
          ? `Handoff consumption record is ready for ${selectedLanePreview.workerKind}. A later slice can store the lead consumption intent without starting the worker yet.`
          : "Handoff consumption record is not ready yet. Select one allowlisted lane before recording lead consumption intent.",
      placeholderRecordEventId: recordedPlaceholderEvent?.id ?? null,
      placeholderRecordedAt: recordedPlaceholderEvent?.createdAt ?? null,
      placeholderRecordedBy: recordedPlaceholderEvent?.requestedBy ?? null,
      placeholderRecordSourcePage: recordedPlaceholderEvent?.sourcePage ?? null,
      executionPreflightState: executionPreflight.state,
      executionPreflightSummary: executionPreflight.summary,
      executionGuardContract: executionGuard,
      executionLifecycleContract: executionLifecycle,
      executionCandidateContract: executionCandidate,
      artifactMaterializationGuardContract: artifactMaterializationGuard,
      artifactMaterializationRecordState: recordedMaterializationEvent
        ? "recorded"
        : artifactMaterializationGuard.state === "allowed"
          ? "recordable"
          : "not_ready",
      artifactMaterializationRecordSummary: recordedMaterializationEvent
        ? `Artifact materialization record is already stored for ${recordedMaterializationEvent.materializationBundleKey} and can be reused by a later result slice without widening authority.`
        : artifactMaterializationGuard.state === "allowed"
          ? `Artifact materialization record is ready for ${artifactMaterializationGuard.selectedWorkerKind ?? "the selected"} lane. A later slice can store ${artifactMaterializationGuard.materializationBundleKey ?? "the materialization bundle"} without starting any worker yet.`
          : "Artifact materialization record is not ready yet. Stabilize the execution candidate and materialization guard first.",
      artifactMaterializationEventId: recordedMaterializationEvent?.id ?? null,
      artifactMaterializedAt: recordedMaterializationEvent?.createdAt ?? null,
      artifactMaterializedBy: recordedMaterializationEvent?.requestedBy ?? null,
      artifactMaterializationSourcePage: recordedMaterializationEvent?.sourcePage ?? null,
      artifactMaterializationLifecycleContract: artifactMaterializationLifecycle,
      resultSideOutputContract: resultSideOutput,
      resultSideOutputGuardContract: resultSideOutputGuard,
      resultSideOutputLifecycleContract: resultSideOutputLifecycle,
      outputConsumptionContract: outputConsumption,
      resultAdoptionContract: resultAdoption,
      outputAdoptionGuardContract: outputAdoptionGuard,
      outputAdoptionRecordState: recordedAdoptionEvent
        ? "recorded"
        : outputAdoptionGuard.state === "allowed"
          ? "recordable"
          : "not_ready",
      outputAdoptionRecordSummary: recordedAdoptionEvent
        ? `Output adoption record is already stored for ${recordedAdoptionEvent.outputBundleKey} and can be reused by a later bounded adoption slice without widening worker authority.`
        : outputAdoptionGuard.state === "allowed"
          ? `Output adoption record is ready for ${outputAdoptionGuard.selectedWorkerKind ?? "the selected"} lane. A later slice can store ${outputAdoptionGuard.outputBundleKey ?? "the selected output bundle"} without creating new artifact persistence.`
          : "Output adoption record is not ready yet. Stabilize the bounded output consumption and result adoption truth first.",
      outputAdoptionEventId: recordedAdoptionEvent?.id ?? null,
      outputAdoptedAt: recordedAdoptionEvent?.createdAt ?? null,
      outputAdoptedBy: recordedAdoptionEvent?.requestedBy ?? null,
      outputAdoptionSourcePage: recordedAdoptionEvent?.sourcePage ?? null,
      outputAdoptionLifecycleContract: outputAdoptionLifecycle,
      resultAdoptionResultSideContract: resultAdoptionResultSide,
      intentEventId: input.swarmReadOnlyWorkerIntentEvent?.id ?? null,
      selectedWorkerKind: selectedLanePreview?.workerKind ?? null,
      selectedPacketKey: selectedLanePreview?.packetKey ?? null,
      selectedArtifactTypes: selectedLanePreview?.artifactTypes ?? [],
      intentRecordedAt: input.swarmReadOnlyWorkerIntentEvent?.createdAt ?? null,
      intentRecordedBy: input.swarmReadOnlyWorkerIntentEvent?.requestedBy ?? null,
      intentSourcePage: input.swarmReadOnlyWorkerIntentEvent?.sourcePage ?? null,
      lanePreviews,
      summary:
        "A read-only worker request is already recorded. Later fan-out must stay within the search, grep, and evidence-mining allowlist and return artifact refs plus a worker handoff note.",
      nextAction:
        selectedLanePreview
          ? `Keep the later ${selectedLanePreview.workerKind} fan-out slice review-first and artifact-first; do not merge worker transcripts into the lead thread.`
          : "Select one allowlisted lane before any later fan-out slice tries to consume the recorded request.",
      boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
    };
  }

  return {
    state: "ready",
    taskClass: input.swarmSpawnContract.taskClass,
    requestState: input.swarmSpawnContract.requestState,
    requestRecordState: input.swarmSpawnContract.requestRecordState,
    requestEventId: input.swarmSpawnContract.requestEventId,
    checkpointKey: input.swarmSpawnContract.checkpointKey,
    requestedAt: input.swarmSpawnContract.requestedAt,
    requestedBy: input.swarmSpawnContract.requestedBy,
    sourcePage: input.swarmSpawnContract.sourcePage,
    allowlistedWorkers,
    artifactPolicy: "artifact_first",
    transcriptPolicy: "no_transcript_merge",
    requestLifecycleState: "requestable",
    requestLifecycleSummary:
      "Read-only worker request lifecycle is ready for a bounded request record, but no request has been recorded yet.",
    handoffPreviewState: "preview_ready",
    handoffPreviewSummary:
      "Handoff packet previews are ready for every allowlisted lane and remain artifact-first until a later execution slice consumes the request.",
    previewPacketKeys,
    packetConsumptionIntentState: "not_ready",
      packetConsumptionIntentSummary:
        "Packet consumption intent is unavailable until a swarm request is recorded for the current run thread.",
    artifactBundlePlaceholderState: "not_ready",
    artifactBundlePlaceholderSummary:
      "Artifact bundle placeholder is unavailable until a swarm request is recorded and one allowlisted lane is selected.",
    placeholderBundleKey: null,
    placeholderBundleTitle: null,
    placeholderArtifactTypes: [],
    handoffConsumptionState: "not_ready",
    handoffConsumptionSummary:
      "Lead handoff consumption is unavailable until a swarm request is recorded and one allowlisted lane is selected.",
    handoffConsumerAgent: null,
    handoffConsumptionGoal: null,
    executionRecordState: "not_ready",
    executionRecordSummary:
      "Execution admission record is unavailable until a swarm request is recorded and one allowlisted lane is selected.",
    executionEventId: null,
    executionRecordedAt: null,
    executionRecordedBy: null,
    executionRecordSourcePage: null,
    artifactBundlePlaceholderRecordState: "not_ready",
    artifactBundlePlaceholderRecordSummary:
      "Placeholder record is unavailable until a swarm request is recorded and one allowlisted lane is selected.",
    handoffConsumptionRecordState: "not_ready",
    handoffConsumptionRecordSummary:
      "Handoff consumption record is unavailable until a swarm request is recorded and one allowlisted lane is selected.",
    placeholderRecordEventId: null,
    placeholderRecordedAt: null,
    placeholderRecordedBy: null,
    placeholderRecordSourcePage: null,
    executionPreflightState: executionPreflight.state,
    executionPreflightSummary: executionPreflight.summary,
    executionGuardContract: executionGuard,
    executionLifecycleContract: executionLifecycle,
    executionCandidateContract: executionCandidate,
    artifactMaterializationGuardContract: artifactMaterializationGuard,
    artifactMaterializationRecordState: "not_ready",
    artifactMaterializationRecordSummary:
      "Artifact materialization record is unavailable until execution candidate truth and materialization guard are both ready.",
    artifactMaterializationEventId: null,
    artifactMaterializedAt: null,
    artifactMaterializedBy: null,
    artifactMaterializationSourcePage: null,
    artifactMaterializationLifecycleContract: artifactMaterializationLifecycle,
    resultSideOutputContract: resultSideOutput,
    resultSideOutputGuardContract: resultSideOutputGuard,
    resultSideOutputLifecycleContract: resultSideOutputLifecycle,
    outputConsumptionContract: outputConsumption,
    resultAdoptionContract: resultAdoption,
    outputAdoptionGuardContract: outputAdoptionGuard,
    outputAdoptionRecordState: "not_ready",
    outputAdoptionRecordSummary:
      "Output adoption record is unavailable until the bounded result adoption seam becomes ready on the current run thread.",
    outputAdoptionEventId: null,
    outputAdoptedAt: null,
    outputAdoptedBy: null,
    outputAdoptionSourcePage: null,
    outputAdoptionLifecycleContract: outputAdoptionLifecycle,
    resultAdoptionResultSideContract: resultAdoptionResultSide,
    intentEventId: null,
    selectedWorkerKind: null,
    selectedPacketKey: null,
    selectedArtifactTypes: [],
    intentRecordedAt: null,
    intentRecordedBy: null,
    intentSourcePage: null,
    lanePreviews,
    summary:
      "Read-only worker lanes are ready: search, grep, and evidence mining. Every lane stays artifact-first and returns typed handoff outputs instead of merged transcript history.",
    nextAction:
      "Any later fan-out slice should select one allowlisted worker and keep the output scoped to artifact refs plus a worker handoff note.",
    boundaryNote: RUN_THREAD_SWARM_READ_ONLY_WORKER_BOUNDARY_NOTE,
  };
}

function deriveRequestState(input: {
  requested: boolean;
  acknowledged: boolean;
}): HelmV21RunThreadRequestState {
  if (input.acknowledged) {
    return "acknowledged";
  }
  if (input.requested) {
    return "requested";
  }
  return "not_requested";
}

function buildSwarmVerificationMergeLaneContract(input: {
  resultAdoptionResultSideContract: HelmV21RunThreadSwarmReadOnlyWorkerResultAdoptionResultSideContract;
  outputAdoptionEventId: string | null;
  checkpointId: string | null;
  checkpointKey: string | null;
  verification?: RunThreadContractInput["verification"];
  truthConflicts?: RunThreadContractInput["truthConflicts"];
  swarmVerificationMergeLaneEvent?: RunThreadContractInput["swarmVerificationMergeLaneEvent"];
}): HelmV21RunThreadSwarmVerificationMergeLaneContract {
  if (input.resultAdoptionResultSideContract.state !== "output_ready") {
    return {
      state: "not_ready",
      driver: "adoption_not_ready",
      mergeLaneTruth: null,
      recordEventId: null,
      checkpointId: input.checkpointId,
      checkpointKey: input.checkpointKey,
      outputAdoptionEventId: input.outputAdoptionEventId,
      verificationStatus: input.verification?.status ?? null,
      verifierSummary: input.verification?.summary ?? null,
      disagreementSummary: null,
      arbiterReference: null,
      recordedAt: null,
      recordedBy: null,
      sourcePage: null,
      summary:
        "Verification merge lane is not ready until the bounded read-only worker adoption result-side contract reaches output_ready.",
      nextAction:
        "Keep the swarm result-side adoption seam explicit before any later verification merge lane is recorded.",
      boundaryNote: RUN_THREAD_SWARM_VERIFICATION_MERGE_LANE_BOUNDARY_NOTE,
    };
  }

  const openTruthConflicts =
    input.truthConflicts?.filter((item) => item.status === "open").map((item) => item.summary) ??
    [];

  let mergeLaneTruth: HelmV21RunThreadSwarmVerificationMergeLaneTruth | null = null;
  let driver: HelmV21RunThreadSwarmVerificationMergeLaneContract["driver"] =
    "verification_missing";
  let summary =
    "Verification merge lane still needs an explicit verification outcome before any swarm merge lane can be recorded.";
  let nextAction =
    "Run or refresh bounded verification before the merge lane is recorded for the adopted swarm output.";
  const verifierSummary =
    input.verification?.summary ??
    (input.verification
      ? `Verification is ${input.verification.status} with ${input.verification.blockedReasons.length} blocked reason(s).`
      : null);
  let disagreementSummary: string | null = null;
  let arbiterReference: string | null = null;

  if (openTruthConflicts.length > 0) {
    mergeLaneTruth = "human_review_required";
    driver = "human_review_required";
    disagreementSummary = openTruthConflicts.slice(0, 2).join(" · ");
    arbiterReference = "explicit human review lane";
    summary = `Verification merge lane requires human review because truth conflicts remain open for ${input.checkpointKey ?? "the current run thread"}.`;
    nextAction =
      "Keep the adopted worker output outside merge lanes until the disagreement trace is resolved through explicit human review.";
  } else if (input.verification?.status === "blocked") {
    mergeLaneTruth = "rework_required";
    driver = "rework_required";
    disagreementSummary =
      input.verification.blockedReasons.length > 0
        ? input.verification.blockedReasons.slice(0, 2).join(" · ")
        : null;
    arbiterReference = "verification blocker review";
    summary = `Verification merge lane requires rework because the current verification outcome is blocked for ${input.checkpointKey ?? "the current run thread"}.`;
    nextAction =
      "Keep the adopted worker output outside merge lanes until the blocked verification reasons are reworked and a new review-first verification result is available.";
  } else if (input.verification?.status === "needs_review") {
    mergeLaneTruth = "human_review_required";
    driver = "human_review_required";
    disagreementSummary =
      input.verification.blockedReasons.length > 0
        ? input.verification.blockedReasons.slice(0, 2).join(" · ")
        : null;
    arbiterReference = "explicit human review lane";
    summary = `Verification merge lane requires human review because the current verification outcome is still needs_review for ${input.checkpointKey ?? "the current run thread"}.`;
    nextAction =
      "Escalate the adopted worker output through the explicit human review lane before any merge decision is recorded.";
  } else if (input.verification?.status === "passed") {
    mergeLaneTruth = "mergeable";
    driver = "mergeable";
    summary = `Verification merge lane is mergeable for ${input.checkpointKey ?? "the current run thread"}, but it remains review-first and default-off.`;
    nextAction =
      "Record the merge lane explicitly if you need an auditable reviewer-visible handoff; mergeable does not bypass human review.";
    arbiterReference = "review-first merge guard";
  }

  if (!mergeLaneTruth) {
    return {
      state: "not_ready",
      driver,
      mergeLaneTruth: null,
      recordEventId: null,
      checkpointId: input.checkpointId,
      checkpointKey: input.checkpointKey,
      outputAdoptionEventId: input.outputAdoptionEventId,
      verificationStatus: input.verification?.status ?? null,
      verifierSummary,
      disagreementSummary,
      arbiterReference,
      recordedAt: null,
      recordedBy: null,
      sourcePage: null,
      summary,
      nextAction,
      boundaryNote: RUN_THREAD_SWARM_VERIFICATION_MERGE_LANE_BOUNDARY_NOTE,
    };
  }

  const recordedEvent =
    input.swarmVerificationMergeLaneEvent &&
    input.swarmVerificationMergeLaneEvent.mergeLaneTruth === mergeLaneTruth &&
    input.swarmVerificationMergeLaneEvent.checkpointKey === input.checkpointKey
      ? input.swarmVerificationMergeLaneEvent
      : null;

  return {
    state: recordedEvent ? "recorded" : "recordable",
    driver: recordedEvent ? "recorded" : driver,
    mergeLaneTruth,
    recordEventId: recordedEvent?.id ?? null,
    checkpointId: input.checkpointId,
    checkpointKey: input.checkpointKey,
    outputAdoptionEventId: input.outputAdoptionEventId,
    verificationStatus: input.verification?.status ?? null,
    verifierSummary: recordedEvent?.verifierSummary ?? verifierSummary,
    disagreementSummary: recordedEvent?.disagreementSummary ?? disagreementSummary,
    arbiterReference: recordedEvent?.arbiterReference ?? arbiterReference,
    recordedAt: recordedEvent?.createdAt ?? null,
    recordedBy: recordedEvent?.requestedBy ?? null,
    sourcePage: recordedEvent?.sourcePage ?? null,
    summary: recordedEvent?.summary ?? summary,
    nextAction: recordedEvent?.nextAction ?? nextAction,
    boundaryNote: RUN_THREAD_SWARM_VERIFICATION_MERGE_LANE_BOUNDARY_NOTE,
  };
}

function buildRequestPosture(input: {
  entries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>;
}): HelmV21RunThreadRequestPosture {
  const sortedEntries = [...input.entries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const requestEntries = sortedEntries.filter(
    (item) => item.kind === "takeover_requested" || item.kind === "human_input_requested",
  );
  const acknowledgementEntries = sortedEntries.filter(
    (item) =>
      item.kind === "takeover_request_acknowledged" ||
      item.kind === "human_input_request_acknowledged",
  );
  const takeoverLatest = sortedEntries.find(
    (item) =>
      item.kind === "takeover_requested" || item.kind === "takeover_request_acknowledged",
  );
  const humanInputLatest = sortedEntries.find(
    (item) =>
      item.kind === "human_input_requested" ||
      item.kind === "human_input_request_acknowledged",
  );
  const takeoverState = deriveRequestState({
    requested: takeoverLatest?.kind === "takeover_requested",
    acknowledged: takeoverLatest?.kind === "takeover_request_acknowledged",
  });
  const humanInputState = deriveRequestState({
    requested: humanInputLatest?.kind === "human_input_requested",
    acknowledged: humanInputLatest?.kind === "human_input_request_acknowledged",
  });
  const activeRequestCount = [takeoverState, humanInputState].filter(
    (item) => item === "requested",
  ).length;
  const acknowledgedRequestCount = [takeoverState, humanInputState].filter(
    (item) => item === "acknowledged",
  ).length;
  const latestLifecycleKind =
    (sortedEntries.find(
      (item) =>
        item.kind === "takeover_requested" ||
        item.kind === "human_input_requested" ||
        item.kind === "takeover_request_acknowledged" ||
        item.kind === "human_input_request_acknowledged",
    )?.kind ??
      null) as HelmV21RunThreadRequestPosture["latestLifecycleKind"];

  if (!latestLifecycleKind) {
    return {
      summary:
        "No operator takeover request or human input checkpoint request is attached to this run thread yet.",
      boundaryNote: RUN_THREAD_REQUEST_POSTURE_BOUNDARY_NOTE,
      takeoverState,
      humanInputState,
      activeRequestCount,
      acknowledgedRequestCount,
      latestRequestedAt: null,
      latestAcknowledgedAt: null,
      latestLifecycleKind: null,
    };
  }

  return {
    summary: `Request posture keeps takeover ${takeoverState} and human input ${humanInputState}. ${activeRequestCount} active request(s), ${acknowledgedRequestCount} acknowledged request(s). Latest lifecycle note is ${latestLifecycleKind}.`,
    boundaryNote: RUN_THREAD_REQUEST_POSTURE_BOUNDARY_NOTE,
    takeoverState,
    humanInputState,
    activeRequestCount,
    acknowledgedRequestCount,
    latestRequestedAt: requestEntries[0]?.timestamp ?? null,
    latestAcknowledgedAt: acknowledgementEntries[0]?.timestamp ?? null,
    latestLifecycleKind,
  };
}

const RUN_THREAD_FORWARD_FLOW_BOUNDARY_NOTE =
  "Forward flow stays typed, operator-readable, and review-first inside the current run thread. It summarizes the current forward-progress posture without creating a workflow engine, auto-takeover path, or broader execution authority.";

const RUN_THREAD_CLOSEOUT_FLOW_BOUNDARY_NOTE =
  "Closeout flow stays typed, operator-readable, and review-first inside the current run thread. It summarizes open and resolved closeout work without creating a workflow engine, auto-settlement path, or broader execution authority.";

const RUN_THREAD_SETTLEMENT_FLOW_BOUNDARY_NOTE =
  "Settlement flow stays typed, operator-readable, and review-first inside the current run thread. It summarizes whether the thread is still active, waiting on closeout, ready to close, or already closed without creating a workflow engine, auto-close path, or broader execution authority.";

const RUN_THREAD_SETTLEMENT_REVIEW_BOUNDARY_NOTE =
  "Settlement review stays typed, operator-readable, and review-first inside the current run thread. It records explicit operator settlement review without creating an auto-close path, workflow engine, or broader authority.";

const RUN_THREAD_CLOSEOUT_CONFIRMATION_BOUNDARY_NOTE =
  "Closeout confirmation stays typed, operator-readable, and review-first inside the current run thread. It records explicit operator closeout truth without auto-closing the runtime session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSEOUT_REFRESH_BOUNDARY_NOTE =
  "Closeout refresh stays typed, operator-readable, and review-first inside the current run thread. It records explicit stale-closeout follow-through without auto-closing the runtime session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSEOUT_SUMMARY_BOUNDARY_NOTE =
  "Closeout summary stays typed, operator-readable, and review-first inside the current run thread. It summarizes explicit review, confirmation, and refresh posture without auto-closing the runtime session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSEOUT_RESOLUTION_BOUNDARY_NOTE =
  "Closeout resolution stays typed, operator-readable, and review-first inside the current run thread. It records an explicit close-vs-keep-open decision without auto-closing the runtime session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_BOUNDARY_NOTE =
  "Closeout resolution follow-through stays typed, operator-readable, and review-first inside the current run thread. It records explicit decision follow-through without auto-closing the runtime session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSEOUT_OUTCOME_BOUNDARY_NOTE =
  "Closeout outcome stays typed, operator-readable, and review-first inside the current run thread. It summarizes explicit final close-vs-keep-open truth without auto-closing the runtime session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_REQUEST_BOUNDARY_NOTE =
  "Close request stays typed, operator-readable, and review-first inside the current run thread. It records an explicit request for bounded runtime close without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_LIFECYCLE_BOUNDARY_NOTE =
  "Close lifecycle stays typed, operator-readable, and review-first inside the current run thread. It summarizes bounded close truth across explicit resolution, follow-through, outcome, and close-request seams without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_CONTROL_BOUNDARY_NOTE =
  "Close control stays typed, operator-readable, and review-first inside the current run thread. It summarizes how settlement review, closeout posture, and bounded close lifecycle combine without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_CONTROL_FLOW_BOUNDARY_NOTE =
  "Close control flow stays typed, operator-readable, and review-first inside the current run thread. It summarizes how close control, settlement flow, and forward work interact without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_DECISION_FLOW_BOUNDARY_NOTE =
  "Close decision flow stays typed, operator-readable, and review-first inside the current run thread. It summarizes how close-control flow, explicit closeout outcome, and bounded close request combine without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_DECISION_CONTROL_SUMMARY_BOUNDARY_NOTE =
  "Close decision control summary stays typed, operator-readable, and review-first inside the current run thread. It summarizes how close decision, close lifecycle, and bounded forward control combine without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_RESOLUTION_SUMMARY_BOUNDARY_NOTE =
  "Close resolution summary stays typed, operator-readable, and review-first inside the current run thread. It compresses close-decision-control truth into an explicit close-vs-keep-open resolution posture without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_RESOLUTION_FORWARD_SUMMARY_BOUNDARY_NOTE =
  "Close resolution forward summary stays typed, operator-readable, and review-first inside the current run thread. It combines close-resolution truth with settlement and forward progress without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_RESOLUTION_CONTROL_SUMMARY_BOUNDARY_NOTE =
  "Close resolution control summary stays typed, operator-readable, and review-first inside the current run thread. It compresses close-resolution truth into a direct bounded close-control posture without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_POSTURE_SUMMARY_BOUNDARY_NOTE =
  "Close posture summary stays typed, operator-readable, and review-first inside the current run thread. It compresses close-resolution control truth into a coarse operator close posture without auto-closing the session, creating a workflow engine, or widening execution authority.";

const RUN_THREAD_CLOSE_POSTURE_FORWARD_SUMMARY_BOUNDARY_NOTE =
  "Close posture forward summary stays typed, operator-readable, and review-first inside the current run thread. It combines coarse close posture with settlement and forward progress without auto-closing the session, creating a workflow engine, or widening execution authority.";

function deriveLatestActiveControl(
  requestLifecycleEntries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>,
) {
  const controlEntries = [...requestLifecycleEntries]
    .filter((item) => item.kind === "takeover_active" || item.kind === "takeover_released")
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
  const latestControlEntry = controlEntries[0] ?? null;
  return latestControlEntry?.kind === "takeover_active" ? latestControlEntry : null;
}

function isRunThreadReadyToClose(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeoutFlow: HelmV21RunThreadCloseoutFlow;
  requestPosture: HelmV21RunThreadRequestPosture;
  requestLifecycleEntries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>;
  resultFlow: HelmV21RunThreadResultFlow;
  resultAcknowledgement: HelmV21RunThreadResultAcknowledgement;
}) {
  const activeControl = deriveLatestActiveControl(input.requestLifecycleEntries);
  const readyByResolvedCloseout = input.closeoutFlow.state === "resolved";
  const readyByResolvedResult =
    input.lifecycle !== "closed" &&
    input.closeoutFlow.state === "idle" &&
    input.requestPosture.activeRequestCount === 0 &&
    activeControl === null &&
    input.resultFlow.requiresOperatorAttentionCount === 0 &&
    (input.resultAcknowledgement.state === "acknowledged" ||
      input.resultAcknowledgement.state === "follow_through_resolved");

  return {
    ready: readyByResolvedCloseout || readyByResolvedResult,
    readyByResolvedCloseout,
    readyByResolvedResult,
  };
}

function buildSettlementReview(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  settlementReviewEntries: NonNullable<RunThreadContractInput["settlementReviewEntries"]>;
  closeoutFlow: HelmV21RunThreadCloseoutFlow;
  requestPosture: HelmV21RunThreadRequestPosture;
  requestLifecycleEntries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>;
  resultFlow: HelmV21RunThreadResultFlow;
  resultAcknowledgement: HelmV21RunThreadResultAcknowledgement;
}): HelmV21RunThreadSettlementReview {
  const entries = [...input.settlementReviewEntries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latestRequest =
    entries.find((item) => item.kind === "settlement_review_requested") ?? null;
  const latestResolution =
    entries.find((item) => item.kind === "settlement_review_resolved") ?? null;
  const isOpenReview =
    (latestRequest?.timestamp.getTime() ?? 0) >
    (latestResolution?.timestamp.getTime() ?? 0);
  const readiness = isRunThreadReadyToClose({
    lifecycle: input.lifecycle,
    closeoutFlow: input.closeoutFlow,
    requestPosture: input.requestPosture,
    requestLifecycleEntries: input.requestLifecycleEntries,
    resultFlow: input.resultFlow,
    resultAcknowledgement: input.resultAcknowledgement,
  });
  const anchorCheckpoint =
    latestRequest?.checkpointKey || latestResolution?.checkpointKey
      ? {
          checkpointId:
            latestRequest?.checkpointId ??
            latestResolution?.checkpointId ??
            input.latestCheckpoint?.checkpointId ??
            null,
          checkpointKey:
            latestRequest?.checkpointKey ??
            latestResolution?.checkpointKey ??
            input.latestCheckpoint?.checkpointKey ??
            null,
          resumeToken:
            latestRequest?.resumeToken ??
            latestResolution?.resumeToken ??
            input.latestCheckpoint?.resumeToken ??
            null,
        }
      : {
          checkpointId: input.latestCheckpoint?.checkpointId ?? null,
          checkpointKey: input.latestCheckpoint?.checkpointKey ?? null,
          resumeToken: input.latestCheckpoint?.resumeToken ?? null,
        };

  if (isOpenReview && latestRequest) {
    return {
      state: "requested",
      summary:
        latestRequest.summary ||
        "Settlement review was requested and still needs explicit operator resolution.",
      boundaryNote: RUN_THREAD_SETTLEMENT_REVIEW_BOUNDARY_NOTE,
      requestEventId: latestRequest.id,
      resolutionEventId: null,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        latestRequest.nextAction ??
        "Resolve the explicit settlement review before the run thread is treated as ready to close.",
      requestedAt: latestRequest.timestamp,
      resolvedAt: null,
      requestedBy: latestRequest.actorName ?? null,
      resolvedBy: null,
      sourcePage: latestRequest.sourcePage ?? null,
    };
  }

  if (latestResolution) {
    return {
      state: "resolved",
      summary:
        latestResolution.summary ||
        "Explicit settlement review was resolved for this run thread.",
      boundaryNote: RUN_THREAD_SETTLEMENT_REVIEW_BOUNDARY_NOTE,
      requestEventId: latestRequest?.id ?? null,
      resolutionEventId: latestResolution.id,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        latestResolution.nextAction ??
        "Close the run thread only if operator review confirms the settlement summary is complete and no broader authority is implied.",
      requestedAt: latestRequest?.timestamp ?? null,
      resolvedAt: latestResolution.timestamp,
      requestedBy: latestRequest?.actorName ?? null,
      resolvedBy: latestResolution.actorName ?? null,
      sourcePage: latestResolution.sourcePage ?? latestRequest?.sourcePage ?? null,
    };
  }

  if (input.lifecycle !== "closed" && readiness.ready) {
    return {
      state: "requestable",
      summary:
        "Run thread settlement is ready for explicit operator review before closeout is treated as complete.",
      boundaryNote: RUN_THREAD_SETTLEMENT_REVIEW_BOUNDARY_NOTE,
      requestEventId: null,
      resolutionEventId: null,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        "Request explicit settlement review only after operator review confirms the settlement summary is complete and no broader authority is implied.",
      requestedAt: null,
      resolvedAt: null,
      requestedBy: null,
      resolvedBy: null,
      sourcePage: null,
    };
  }

  return {
    state: "not_available",
    summary:
      input.lifecycle === "closed"
        ? "Run thread is already closed, so no further settlement review is available."
        : "Settlement review is not yet requestable because the thread still lacks explicit ready-to-close settlement truth.",
    boundaryNote: RUN_THREAD_SETTLEMENT_REVIEW_BOUNDARY_NOTE,
    requestEventId: null,
    resolutionEventId: null,
    checkpointId: anchorCheckpoint.checkpointId,
    checkpointKey: anchorCheckpoint.checkpointKey,
    resumeToken: anchorCheckpoint.resumeToken,
    nextAction: null,
    requestedAt: null,
    resolvedAt: null,
    requestedBy: null,
    resolvedBy: null,
    sourcePage: null,
  };
}

function buildCloseoutConfirmation(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  settlementReview: HelmV21RunThreadSettlementReview;
  settlementFlow: HelmV21RunThreadSettlementFlow;
  closeoutResolutionEntries: NonNullable<RunThreadContractInput["closeoutResolutionEntries"]>;
  closeoutConfirmationEntries: NonNullable<RunThreadContractInput["closeoutConfirmationEntries"]>;
}): HelmV21RunThreadCloseoutConfirmation {
  const entries = [...input.closeoutConfirmationEntries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latestConfirmation = entries[0] ?? null;
  const latestResolution =
    [...input.closeoutResolutionEntries].sort(
      (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
    )[0] ?? null;
  const anchorCheckpoint =
    latestConfirmation?.checkpointKey || input.settlementReview.checkpointKey
      ? {
          checkpointId:
            latestConfirmation?.checkpointId ??
            input.settlementReview.checkpointId ??
            input.latestCheckpoint?.checkpointId ??
            null,
          checkpointKey:
            latestConfirmation?.checkpointKey ??
            input.settlementReview.checkpointKey ??
            input.latestCheckpoint?.checkpointKey ??
            null,
          resumeToken:
            latestConfirmation?.resumeToken ??
            input.settlementReview.resumeToken ??
            input.latestCheckpoint?.resumeToken ??
            null,
        }
      : {
          checkpointId: input.latestCheckpoint?.checkpointId ?? null,
          checkpointKey: input.latestCheckpoint?.checkpointKey ?? null,
          resumeToken: input.latestCheckpoint?.resumeToken ?? null,
        };
  const confirmationIsCurrent =
    latestConfirmation &&
    ((input.settlementFlow.state === "ready_to_close" &&
      (input.settlementFlow.latestUpdatedAt === null ||
        latestConfirmation.timestamp.getTime() >= input.settlementFlow.latestUpdatedAt.getTime())) ||
      (latestResolution !== null &&
        latestResolution.timestamp.getTime() >= latestConfirmation.timestamp.getTime()));

  if (confirmationIsCurrent && latestConfirmation) {
    return {
      state: "confirmed",
      summary:
        latestConfirmation.summary ||
        "Thread-level closeout truth is explicitly confirmed and ready for bounded runtime closure.",
      boundaryNote: RUN_THREAD_CLOSEOUT_CONFIRMATION_BOUNDARY_NOTE,
      confirmationEventId: latestConfirmation.id,
      settlementReviewResolutionEventId:
        latestConfirmation.settlementReviewResolutionEventId ??
        input.settlementReview.resolutionEventId,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        latestConfirmation.nextAction ??
        "Close the runtime session only when bounded operator review confirms the thread can be closed without implying broader authority.",
      confirmedAt: latestConfirmation.timestamp,
      confirmedBy: latestConfirmation.actorName ?? null,
      sourcePage: latestConfirmation.sourcePage ?? input.settlementReview.sourcePage,
    };
  }

  if (latestConfirmation) {
    return {
      state: "stale",
      summary:
        latestConfirmation.summary ||
        "A prior closeout confirmation exists, but newer run-thread activity means it is no longer the current closeout truth.",
      boundaryNote: RUN_THREAD_CLOSEOUT_CONFIRMATION_BOUNDARY_NOTE,
      confirmationEventId: latestConfirmation.id,
      settlementReviewResolutionEventId:
        latestConfirmation.settlementReviewResolutionEventId ??
        input.settlementReview.resolutionEventId,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        "Reconfirm thread-level closeout truth only after the refreshed settlement summary and latest lifecycle activity have been reviewed.",
      confirmedAt: latestConfirmation.timestamp,
      confirmedBy: latestConfirmation.actorName ?? null,
      sourcePage: latestConfirmation.sourcePage ?? input.settlementReview.sourcePage,
    };
  }

  if (
    input.lifecycle !== "closed" &&
    input.settlementReview.state === "resolved" &&
    input.settlementFlow.state === "ready_to_close"
  ) {
    return {
      state: "confirmable",
      summary:
        "Run thread closeout truth is ready for explicit operator confirmation before the runtime session is closed.",
      boundaryNote: RUN_THREAD_CLOSEOUT_CONFIRMATION_BOUNDARY_NOTE,
      confirmationEventId: null,
      settlementReviewResolutionEventId: input.settlementReview.resolutionEventId,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        "Confirm thread-level closeout truth only after operator review confirms the settlement review remains current and no broader authority is implied.",
      confirmedAt: null,
      confirmedBy: null,
      sourcePage: input.settlementReview.sourcePage,
    };
  }

  return {
    state: "not_available",
    summary:
      input.lifecycle === "closed"
        ? "Run thread is already closed, so no further closeout confirmation is available."
        : "Closeout confirmation is not yet available because the run thread still lacks current resolved settlement review truth.",
    boundaryNote: RUN_THREAD_CLOSEOUT_CONFIRMATION_BOUNDARY_NOTE,
    confirmationEventId: null,
    settlementReviewResolutionEventId: input.settlementReview.resolutionEventId,
    checkpointId: anchorCheckpoint.checkpointId,
    checkpointKey: anchorCheckpoint.checkpointKey,
    resumeToken: anchorCheckpoint.resumeToken,
    nextAction: null,
    confirmedAt: null,
    confirmedBy: null,
    sourcePage: input.settlementReview.sourcePage,
  };
}

function buildCloseoutRefresh(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  latestCheckpoint: HelmV21RunThreadCheckpoint | null;
  closeoutConfirmation: HelmV21RunThreadCloseoutConfirmation;
  closeoutRefreshEntries: NonNullable<RunThreadContractInput["closeoutRefreshEntries"]>;
}): HelmV21RunThreadCloseoutRefresh {
  const entries = [...input.closeoutRefreshEntries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latestRequest = entries[0] ?? null;
  const anchorCheckpoint = latestRequest
    ? {
        checkpointId:
          latestRequest.checkpointId ??
          input.closeoutConfirmation.checkpointId ??
          input.latestCheckpoint?.checkpointId ??
          null,
        checkpointKey:
          latestRequest.checkpointKey ??
          input.closeoutConfirmation.checkpointKey ??
          input.latestCheckpoint?.checkpointKey ??
          null,
        resumeToken:
          latestRequest.resumeToken ??
          input.closeoutConfirmation.resumeToken ??
          input.latestCheckpoint?.resumeToken ??
          null,
      }
    : {
        checkpointId:
          input.closeoutConfirmation.checkpointId ?? input.latestCheckpoint?.checkpointId ?? null,
        checkpointKey:
          input.closeoutConfirmation.checkpointKey ??
          input.latestCheckpoint?.checkpointKey ??
          null,
        resumeToken:
          input.closeoutConfirmation.resumeToken ?? input.latestCheckpoint?.resumeToken ?? null,
      };

  const refreshResolvedByConfirmation =
    latestRequest &&
    input.closeoutConfirmation.state === "confirmed" &&
    input.closeoutConfirmation.confirmedAt &&
    input.closeoutConfirmation.confirmationEventId &&
    input.closeoutConfirmation.confirmedAt.getTime() >= latestRequest.timestamp.getTime();

  if (input.lifecycle === "closed") {
    return {
      state: "not_requestable",
      summary: "Run thread is already closed, so no further closeout refresh is available.",
      boundaryNote: RUN_THREAD_CLOSEOUT_REFRESH_BOUNDARY_NOTE,
      requestEventId: latestRequest?.id ?? null,
      confirmationEventId: input.closeoutConfirmation.confirmationEventId,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction: null,
      requestedAt: latestRequest?.timestamp ?? null,
      resolvedAt: input.closeoutConfirmation.confirmedAt,
      requestedBy: latestRequest?.actorName ?? null,
      sourcePage: latestRequest?.sourcePage ?? input.closeoutConfirmation.sourcePage,
    };
  }

  if (latestRequest && refreshResolvedByConfirmation) {
    return {
      state: "resolved",
      summary:
        input.closeoutConfirmation.summary ||
        "Closeout refresh is resolved because fresh thread-level closeout truth has been reconfirmed.",
      boundaryNote: RUN_THREAD_CLOSEOUT_REFRESH_BOUNDARY_NOTE,
      requestEventId: latestRequest.id,
      confirmationEventId: input.closeoutConfirmation.confirmationEventId,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction: input.closeoutConfirmation.nextAction,
      requestedAt: latestRequest.timestamp,
      resolvedAt: input.closeoutConfirmation.confirmedAt,
      requestedBy: latestRequest.actorName ?? null,
      sourcePage: latestRequest.sourcePage ?? input.closeoutConfirmation.sourcePage,
    };
  }

  if (latestRequest) {
    return {
      state: "open",
      summary:
        latestRequest.summary ||
        "Closeout refresh is open because stale closeout truth still needs explicit operator re-review.",
      boundaryNote: RUN_THREAD_CLOSEOUT_REFRESH_BOUNDARY_NOTE,
      requestEventId: latestRequest.id,
      confirmationEventId:
        latestRequest.confirmationEventId ?? input.closeoutConfirmation.confirmationEventId,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        latestRequest.nextAction ??
        "Refresh the stale closeout summary and reconfirm thread-level closeout truth only after bounded operator review is current again.",
      requestedAt: latestRequest.timestamp,
      resolvedAt: null,
      requestedBy: latestRequest.actorName ?? null,
      sourcePage: latestRequest.sourcePage ?? input.closeoutConfirmation.sourcePage,
    };
  }

  if (input.closeoutConfirmation.state === "stale") {
    return {
      state: "requestable",
      summary:
        "Closeout truth is stale and can now be explicitly reopened for bounded refresh follow-through.",
      boundaryNote: RUN_THREAD_CLOSEOUT_REFRESH_BOUNDARY_NOTE,
      requestEventId: null,
      confirmationEventId: input.closeoutConfirmation.confirmationEventId,
      checkpointId: anchorCheckpoint.checkpointId,
      checkpointKey: anchorCheckpoint.checkpointKey,
      resumeToken: anchorCheckpoint.resumeToken,
      nextAction:
        "Request closeout refresh only after operator review confirms the stale thread-level closeout truth should be reopened for explicit re-review.",
      requestedAt: null,
      resolvedAt: null,
      requestedBy: null,
      sourcePage: input.closeoutConfirmation.sourcePage,
    };
  }

  return {
    state: "not_requestable",
    summary:
      "Closeout refresh is not requestable because the thread does not currently have stale closeout truth to reopen.",
    boundaryNote: RUN_THREAD_CLOSEOUT_REFRESH_BOUNDARY_NOTE,
    requestEventId: null,
    confirmationEventId: input.closeoutConfirmation.confirmationEventId,
    checkpointId: anchorCheckpoint.checkpointId,
    checkpointKey: anchorCheckpoint.checkpointKey,
    resumeToken: anchorCheckpoint.resumeToken,
    nextAction: null,
    requestedAt: null,
    resolvedAt: null,
    requestedBy: null,
    sourcePage: input.closeoutConfirmation.sourcePage,
  };
}

function buildCloseoutSummary(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeoutFlow: HelmV21RunThreadCloseoutFlow;
  settlementReview: HelmV21RunThreadSettlementReview;
  closeoutConfirmation: HelmV21RunThreadCloseoutConfirmation;
  closeoutRefresh: HelmV21RunThreadCloseoutRefresh;
}): HelmV21RunThreadCloseoutSummary {
  const latestUpdatedAt =
    [
      input.closeoutRefresh.resolvedAt,
      input.closeoutRefresh.requestedAt,
      input.closeoutConfirmation.confirmedAt,
      input.settlementReview.resolvedAt,
      input.settlementReview.requestedAt,
      input.closeoutFlow.latestUpdatedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

  const base = {
    boundaryNote: RUN_THREAD_CLOSEOUT_SUMMARY_BOUNDARY_NOTE,
    latestUpdatedAt,
    settlementReviewState: input.settlementReview.state,
    closeoutConfirmationState: input.closeoutConfirmation.state,
    closeoutRefreshState: input.closeoutRefresh.state,
  };

  if (input.lifecycle === "closed") {
    return {
      ...base,
      summary: "Thread-level closeout is closed; no further closeout review work is attached.",
      state: "closed",
      driver: "lifecycle",
      currentOwner: null,
      checkpointKey:
        input.closeoutConfirmation.checkpointKey ??
        input.closeoutRefresh.checkpointKey ??
        input.settlementReview.checkpointKey ??
        input.closeoutFlow.checkpointKey,
      nextAction: null,
    };
  }

  if (input.closeoutRefresh.state === "open") {
    return {
      ...base,
      summary:
        input.closeoutRefresh.summary ||
        "Thread-level closeout refresh is open because stale closeout truth still needs explicit bounded re-review.",
      state: "refresh_open",
      driver: "closeout_refresh",
      currentOwner: input.closeoutRefresh.requestedBy,
      checkpointKey: input.closeoutRefresh.checkpointKey,
      nextAction:
        input.closeoutRefresh.nextAction ??
        "Refresh the stale thread-level closeout truth before it is treated as settled again.",
    };
  }

  if (input.closeoutRefresh.state === "requestable") {
    return {
      ...base,
      summary:
        input.closeoutRefresh.summary ||
        "Thread-level closeout truth is stale and can be explicitly reopened for bounded refresh follow-through.",
      state: "refresh_requestable",
      driver: "closeout_refresh",
      currentOwner: null,
      checkpointKey: input.closeoutRefresh.checkpointKey,
      nextAction:
        input.closeoutRefresh.nextAction ??
        "Request closeout refresh only after operator review confirms the stale thread-level closeout truth should be reopened.",
    };
  }

  if (input.closeoutConfirmation.state === "confirmed") {
    const refreshed = input.closeoutRefresh.state === "resolved";
    return {
      ...base,
      summary: refreshed
        ? "Thread-level closeout truth has been refreshed and reconfirmed after stale closeout follow-through."
        : input.closeoutConfirmation.summary ||
          "Thread-level closeout truth is explicitly confirmed.",
      state: "confirmed",
      driver: refreshed ? "closeout_refresh" : "closeout_confirmation",
      currentOwner: input.closeoutConfirmation.confirmedBy,
      checkpointKey: input.closeoutConfirmation.checkpointKey,
      nextAction: refreshed ? null : input.closeoutConfirmation.nextAction,
    };
  }

  if (input.closeoutConfirmation.state === "confirmable") {
    return {
      ...base,
      summary:
        input.closeoutConfirmation.summary ||
        "Thread-level closeout truth is ready for explicit operator confirmation.",
      state: "confirmable",
      driver: "closeout_confirmation",
      currentOwner: input.settlementReview.resolvedBy,
      checkpointKey: input.closeoutConfirmation.checkpointKey,
      nextAction:
        input.closeoutConfirmation.nextAction ??
        "Confirm the thread-level closeout truth only after bounded operator review is complete.",
    };
  }

  if (input.settlementReview.state === "requested") {
    return {
      ...base,
      summary:
        input.settlementReview.summary ||
        "Thread-level closeout review is open and still needs explicit operator resolution.",
      state: "review_open",
      driver: "settlement_review",
      currentOwner: input.settlementReview.requestedBy,
      checkpointKey: input.settlementReview.checkpointKey,
      nextAction:
        input.settlementReview.nextAction ??
        "Resolve the explicit settlement review before the thread is treated as closeout-ready.",
    };
  }

  if (input.settlementReview.state === "requestable") {
    return {
      ...base,
      summary:
        input.settlementReview.summary ||
        "Thread-level closeout review can now be explicitly requested.",
      state: "review_requestable",
      driver: "settlement_review",
      currentOwner: null,
      checkpointKey: input.settlementReview.checkpointKey,
      nextAction:
        input.settlementReview.nextAction ??
        "Request explicit settlement review before the thread is treated as ready to close.",
    };
  }

  return {
    ...base,
    summary:
      input.closeoutFlow.state === "open"
        ? `Thread-level closeout is still active because ${input.closeoutFlow.openCount} closeout source(s) remain open before explicit settlement review can start.`
        : "Thread-level closeout remains active and no explicit review, confirmation or refresh seam is open yet.",
    state: "active",
    driver: "closeout_flow",
    currentOwner: input.closeoutFlow.currentOwner,
    checkpointKey: input.closeoutFlow.checkpointKey,
    nextAction:
      input.closeoutFlow.nextAction ??
      "Keep the thread open until explicit closeout review, confirmation or refresh becomes available.",
  };
}

function buildCloseoutResolution(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeoutSummary: HelmV21RunThreadCloseoutSummary;
  closeoutConfirmation: HelmV21RunThreadCloseoutConfirmation;
  closeoutRefresh: HelmV21RunThreadCloseoutRefresh;
  closeoutResolutionEntries: NonNullable<RunThreadContractInput["closeoutResolutionEntries"]>;
}): HelmV21RunThreadCloseoutResolution {
  const latestResolution = [...input.closeoutResolutionEntries]
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())[0] ?? null;
  const resolutionRecordedAt = latestResolution?.timestamp.getTime() ?? 0;
  const latestTruthRefreshAt = Math.max(
    input.closeoutConfirmation.confirmedAt?.getTime() ?? 0,
    input.closeoutRefresh.requestedAt?.getTime() ?? 0,
    input.closeoutRefresh.resolvedAt?.getTime() ?? 0,
  );
  const isStale =
    Boolean(latestResolution) &&
    latestTruthRefreshAt > 0 &&
    latestTruthRefreshAt > resolutionRecordedAt;

  if (!latestResolution && input.closeoutSummary.state !== "confirmed") {
    return {
      state: "not_available",
      decision: null,
      summary:
        "Closeout resolution is not available until explicit thread-level closeout truth is confirmed.",
      boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_BOUNDARY_NOTE,
      resolutionEventId: null,
      closeoutConfirmationEventId: input.closeoutConfirmation.confirmationEventId,
      closeoutRefreshEventId: input.closeoutRefresh.requestEventId,
      checkpointId:
        input.closeoutConfirmation.checkpointId ??
        input.closeoutRefresh.checkpointId,
      checkpointKey:
        input.closeoutConfirmation.checkpointKey ??
        input.closeoutRefresh.checkpointKey,
      resumeToken:
        input.closeoutConfirmation.resumeToken ??
        input.closeoutRefresh.resumeToken,
      nextAction: null,
      resolvedAt: null,
      resolvedBy: null,
      sourcePage:
        input.closeoutRefresh.sourcePage ?? input.closeoutConfirmation.sourcePage,
    };
  }

  if (!latestResolution) {
    return {
      state: "decision_required",
      decision: null,
      summary:
        "Thread-level closeout truth is confirmed. Record an explicit close-versus-keep-open decision before any session-close action is treated as valid.",
      boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_BOUNDARY_NOTE,
      resolutionEventId: null,
      closeoutConfirmationEventId: input.closeoutConfirmation.confirmationEventId,
      closeoutRefreshEventId: input.closeoutRefresh.requestEventId,
      checkpointId: input.closeoutConfirmation.checkpointId,
      checkpointKey: input.closeoutConfirmation.checkpointKey,
      resumeToken: input.closeoutConfirmation.resumeToken,
      nextAction:
        "Record an explicit close-thread or keep-open decision only after bounded operator review confirms the closeout summary is current.",
      resolvedAt: null,
      resolvedBy: null,
      sourcePage: input.closeoutConfirmation.sourcePage,
    };
  }

  if (isStale) {
    return {
      state: "stale",
      decision: latestResolution.decision,
      summary:
        "The last explicit closeout resolution is stale because closeout truth reopened after the prior decision.",
      boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_BOUNDARY_NOTE,
      resolutionEventId: latestResolution.id,
      closeoutConfirmationEventId:
        latestResolution.closeoutConfirmationEventId ??
        input.closeoutConfirmation.confirmationEventId,
      closeoutRefreshEventId:
        latestResolution.closeoutRefreshEventId ?? input.closeoutRefresh.requestEventId,
      checkpointId:
        latestResolution.checkpointId ??
        input.closeoutRefresh.checkpointId ??
        input.closeoutConfirmation.checkpointId,
      checkpointKey:
        latestResolution.checkpointKey ??
        input.closeoutRefresh.checkpointKey ??
        input.closeoutConfirmation.checkpointKey,
      resumeToken:
        latestResolution.resumeToken ??
        input.closeoutRefresh.resumeToken ??
        input.closeoutConfirmation.resumeToken,
      nextAction:
        input.closeoutSummary.nextAction ??
        "Refresh or reconfirm the closeout summary before recording another explicit closeout resolution.",
      resolvedAt: latestResolution.timestamp,
      resolvedBy: latestResolution.actorName ?? null,
      sourcePage:
        latestResolution.sourcePage ??
        input.closeoutRefresh.sourcePage ??
        input.closeoutConfirmation.sourcePage,
    };
  }

  return {
    state: latestResolution.decision === "close_thread" ? "close_recorded" : "keep_open_recorded",
    decision: latestResolution.decision,
    summary:
      latestResolution.summary ||
      (latestResolution.decision === "close_thread"
        ? "Explicit close-thread resolution is recorded for the current closeout truth."
        : "Explicit keep-open resolution is recorded for the current closeout truth."),
    boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_BOUNDARY_NOTE,
    resolutionEventId: latestResolution.id,
    closeoutConfirmationEventId:
      latestResolution.closeoutConfirmationEventId ??
      input.closeoutConfirmation.confirmationEventId,
    closeoutRefreshEventId:
      latestResolution.closeoutRefreshEventId ?? input.closeoutRefresh.requestEventId,
    checkpointId:
      latestResolution.checkpointId ?? input.closeoutConfirmation.checkpointId,
    checkpointKey:
      latestResolution.checkpointKey ?? input.closeoutConfirmation.checkpointKey,
    resumeToken:
      latestResolution.resumeToken ?? input.closeoutConfirmation.resumeToken,
    nextAction:
      latestResolution.nextAction ??
      (latestResolution.decision === "close_thread"
        ? "Close the runtime session only when a separate bounded operator action explicitly executes the close."
        : "Keep the thread open until a newer closeout truth justifies a different explicit decision."),
    resolvedAt: latestResolution.timestamp,
    resolvedBy: latestResolution.actorName ?? null,
    sourcePage:
      latestResolution.sourcePage ?? input.closeoutConfirmation.sourcePage,
  };
}

function buildCloseoutResolutionFollowThrough(input: {
  closeoutResolution: HelmV21RunThreadCloseoutResolution;
  closeoutResolutionFollowThroughEntries: NonNullable<
    RunThreadContractInput["closeoutResolutionFollowThroughEntries"]
  >;
}): HelmV21RunThreadCloseoutResolutionFollowThrough {
  const entries = [...input.closeoutResolutionFollowThroughEntries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latestRequest =
    entries.find((item) => item.kind === "closeout_resolution_followthrough_requested") ?? null;
  const latestResolution =
    entries.find((item) => item.kind === "closeout_resolution_followthrough_resolved") ?? null;
  const latestEntry = entries[0] ?? null;
  const resolutionRecordedAt = input.closeoutResolution.resolvedAt?.getTime() ?? 0;
  const resolutionIsRecorded =
    input.closeoutResolution.state === "close_recorded" ||
    input.closeoutResolution.state === "keep_open_recorded";
  const resolutionIsStale = input.closeoutResolution.state === "stale";

  if (!resolutionIsRecorded && !resolutionIsStale) {
    return {
      state: "not_available",
      decision: input.closeoutResolution.decision,
      summary:
        "Closeout resolution follow-through is not available until an explicit close-thread or keep-open decision is recorded.",
      boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
      requestEventId: null,
      resolutionEventId: null,
      closeoutResolutionEventId: input.closeoutResolution.resolutionEventId,
      checkpointId: input.closeoutResolution.checkpointId,
      checkpointKey: input.closeoutResolution.checkpointKey,
      resumeToken: input.closeoutResolution.resumeToken,
      nextAction: null,
      requestedAt: null,
      resolvedAt: null,
      requestedBy: null,
      resolvedBy: null,
      sourcePage: input.closeoutResolution.sourcePage,
    };
  }

  if (resolutionIsStale) {
    return {
      state: "stale",
      decision: input.closeoutResolution.decision,
      summary:
        "Closeout resolution follow-through is stale because the underlying closeout resolution is no longer current.",
      boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
      requestEventId: latestRequest?.id ?? null,
      resolutionEventId: latestResolution?.id ?? null,
      closeoutResolutionEventId: input.closeoutResolution.resolutionEventId,
      checkpointId: input.closeoutResolution.checkpointId,
      checkpointKey: input.closeoutResolution.checkpointKey,
      resumeToken: input.closeoutResolution.resumeToken,
      nextAction:
        input.closeoutResolution.nextAction ??
        "Refresh or reconfirm the explicit closeout resolution before carrying its follow-through forward.",
      requestedAt: latestRequest?.timestamp ?? null,
      resolvedAt: latestResolution?.timestamp ?? null,
      requestedBy: latestRequest?.actorName ?? null,
      resolvedBy: latestResolution?.actorName ?? null,
      sourcePage:
        latestEntry?.sourcePage ?? input.closeoutResolution.sourcePage,
    };
  }

  if (!latestEntry || (latestEntry.timestamp.getTime() < resolutionRecordedAt && resolutionRecordedAt > 0)) {
    return {
      state: latestEntry ? "stale" : "requestable",
      decision: input.closeoutResolution.decision,
      summary:
        latestEntry && resolutionRecordedAt > 0
          ? "A newer explicit closeout resolution reopened follow-through, so the prior follow-through history is now stale."
          : input.closeoutResolution.decision === "close_thread"
            ? "Explicit close-thread resolution is recorded. Request follow-through before any bounded session-close action is treated as current."
            : "Explicit keep-open resolution is recorded. Request follow-through to document the bounded keep-open decision on the current thread truth.",
      boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
      requestEventId: latestRequest?.id ?? null,
      resolutionEventId: latestResolution?.id ?? null,
      closeoutResolutionEventId: input.closeoutResolution.resolutionEventId,
      checkpointId: input.closeoutResolution.checkpointId,
      checkpointKey: input.closeoutResolution.checkpointKey,
      resumeToken: input.closeoutResolution.resumeToken,
      nextAction:
        input.closeoutResolution.decision === "close_thread"
          ? "Request explicit closeout decision follow-through before any bounded close action is treated as current."
          : "Request explicit keep-open follow-through before this keep-open decision is treated as current thread truth.",
      requestedAt: latestRequest?.timestamp ?? null,
      resolvedAt: latestResolution?.timestamp ?? null,
      requestedBy: latestRequest?.actorName ?? null,
      resolvedBy: latestResolution?.actorName ?? null,
      sourcePage: input.closeoutResolution.sourcePage,
    };
  }

  if (
    latestRequest &&
    (!latestResolution ||
      latestRequest.timestamp.getTime() > latestResolution.timestamp.getTime())
  ) {
    return {
      state: "open",
      decision: input.closeoutResolution.decision,
      summary:
        latestRequest.summary ||
        (input.closeoutResolution.decision === "close_thread"
          ? "Close-thread follow-through is open and still waiting for explicit bounded closeout handling."
          : "Keep-open follow-through is open and still waiting for explicit bounded thread carry-forward handling."),
      boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
      requestEventId: latestRequest.id,
      resolutionEventId: latestResolution?.id ?? null,
      closeoutResolutionEventId: input.closeoutResolution.resolutionEventId,
      checkpointId: latestRequest.checkpointId ?? input.closeoutResolution.checkpointId,
      checkpointKey: latestRequest.checkpointKey ?? input.closeoutResolution.checkpointKey,
      resumeToken: latestRequest.resumeToken ?? input.closeoutResolution.resumeToken,
      nextAction:
        latestRequest.nextAction ??
        (input.closeoutResolution.decision === "close_thread"
          ? "Resolve the explicit close-thread follow-through before the thread is treated as lifecycle-settled."
          : "Resolve the explicit keep-open follow-through before the thread is treated as lifecycle-settled."),
      requestedAt: latestRequest.timestamp,
      resolvedAt: latestResolution?.timestamp ?? null,
      requestedBy: latestRequest.actorName ?? null,
      resolvedBy: latestResolution?.actorName ?? null,
      sourcePage: latestRequest.sourcePage ?? input.closeoutResolution.sourcePage,
    };
  }

  return {
    state: "resolved",
    decision: input.closeoutResolution.decision,
    summary:
      latestResolution?.summary ||
      (input.closeoutResolution.decision === "close_thread"
        ? "Close-thread follow-through is resolved and no newer closeout decision has reopened it."
        : "Keep-open follow-through is resolved and no newer closeout decision has reopened it."),
    boundaryNote: RUN_THREAD_CLOSEOUT_RESOLUTION_FOLLOW_THROUGH_BOUNDARY_NOTE,
    requestEventId: latestRequest?.id ?? null,
    resolutionEventId: latestResolution?.id ?? null,
    closeoutResolutionEventId: input.closeoutResolution.resolutionEventId,
    checkpointId:
      latestResolution?.checkpointId ??
      latestRequest?.checkpointId ??
      input.closeoutResolution.checkpointId,
    checkpointKey:
      latestResolution?.checkpointKey ??
      latestRequest?.checkpointKey ??
      input.closeoutResolution.checkpointKey,
    resumeToken:
      latestResolution?.resumeToken ??
      latestRequest?.resumeToken ??
      input.closeoutResolution.resumeToken,
    nextAction: latestResolution?.nextAction ?? null,
    requestedAt: latestRequest?.timestamp ?? null,
    resolvedAt: latestResolution?.timestamp ?? null,
    requestedBy: latestRequest?.actorName ?? null,
    resolvedBy: latestResolution?.actorName ?? null,
    sourcePage:
      latestResolution?.sourcePage ??
      latestRequest?.sourcePage ??
      input.closeoutResolution.sourcePage,
  };
}

function buildCloseoutOutcome(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closedAt: Date | null;
  closeoutSummary: HelmV21RunThreadCloseoutSummary;
  closeoutResolution: HelmV21RunThreadCloseoutResolution;
  closeoutResolutionFollowThrough: HelmV21RunThreadCloseoutResolutionFollowThrough;
}): HelmV21RunThreadCloseoutOutcome {
  const checkpointId =
    input.closeoutResolutionFollowThrough.checkpointId ??
    input.closeoutResolution.checkpointId;
  const checkpointKey =
    input.closeoutResolutionFollowThrough.checkpointKey ??
    input.closeoutResolution.checkpointKey ??
    input.closeoutSummary.checkpointKey;
  const resumeToken =
    input.closeoutResolutionFollowThrough.resumeToken ??
    input.closeoutResolution.resumeToken;
  const latestUpdatedAt =
    input.closedAt ??
    input.closeoutResolutionFollowThrough.resolvedAt ??
    input.closeoutResolutionFollowThrough.requestedAt ??
    input.closeoutResolution.resolvedAt ??
    input.closeoutSummary.latestUpdatedAt;
  const sourcePage =
    input.closeoutResolutionFollowThrough.sourcePage ??
    input.closeoutResolution.sourcePage;
  const currentOwner =
    input.closeoutResolutionFollowThrough.state === "open"
      ? input.closeoutResolutionFollowThrough.requestedBy
      : input.closeoutResolutionFollowThrough.resolvedBy ??
        input.closeoutResolution.resolvedBy ??
        input.closeoutSummary.currentOwner;
  const base = {
    decision: input.closeoutResolution.decision,
    boundaryNote: RUN_THREAD_CLOSEOUT_OUTCOME_BOUNDARY_NOTE,
    resolutionEventId: input.closeoutResolution.resolutionEventId,
    followThroughRequestEventId: input.closeoutResolutionFollowThrough.requestEventId,
    followThroughResolutionEventId: input.closeoutResolutionFollowThrough.resolutionEventId,
    checkpointId,
    checkpointKey,
    resumeToken,
    latestUpdatedAt,
    currentOwner,
    closedAt: input.closedAt,
    sourcePage,
  };

  if (input.lifecycle === "closed") {
    if (
      input.closeoutResolution.decision === "close_thread" &&
      input.closeoutResolutionFollowThrough.state === "resolved"
    ) {
      return {
        ...base,
        state: "closed",
        summary:
          "Run thread lifecycle is closed and explicit close-thread follow-through is fully resolved.",
        nextAction: null,
      };
    }

    return {
      ...base,
      state: "mismatch",
      summary:
        "Run thread lifecycle is closed, but explicit closeout outcome truth is not aligned with a resolved close-thread decision.",
      nextAction:
        "Reconcile lifecycle close with the explicit closeout decision before treating this thread as canonical closed truth.",
    };
  }

  if (input.closeoutResolution.state === "stale") {
    return {
      ...base,
      state: "stale",
      summary:
        "Closeout outcome is stale because the underlying explicit closeout resolution is no longer current.",
      nextAction:
        input.closeoutResolution.nextAction ??
        "Refresh or reconfirm the explicit closeout resolution before carrying final outcome truth forward.",
    };
  }

  if (input.closeoutResolutionFollowThrough.state === "stale") {
    return {
      ...base,
      state: "stale",
      summary:
        "Closeout outcome is stale because the explicit closeout resolution follow-through is no longer current.",
      nextAction:
        input.closeoutResolutionFollowThrough.nextAction ??
        input.closeoutResolution.nextAction ??
        "Refresh or reconfirm closeout follow-through before treating this thread outcome as current.",
    };
  }

  if (input.closeoutResolution.state === "not_available") {
    return {
      ...base,
      state: "not_available",
      summary:
        "Closeout outcome is not available until explicit thread-level closeout truth is confirmed and a bounded final decision becomes available.",
      nextAction: null,
    };
  }

  if (input.closeoutResolution.state === "decision_required") {
    return {
      ...base,
      state: "decision_required",
      summary:
        "Explicit thread-level closeout truth is current, but a final close-thread or keep-open decision still needs to be recorded.",
      nextAction:
        input.closeoutResolution.nextAction ??
        "Record an explicit close-thread or keep-open decision before a final closeout outcome is treated as current.",
    };
  }

  if (
    input.closeoutResolutionFollowThrough.state === "not_available" ||
    input.closeoutResolutionFollowThrough.state === "requestable"
  ) {
    return {
      ...base,
      state: "followthrough_required",
      summary:
        input.closeoutResolution.decision === "close_thread"
          ? "Explicit close-thread decision is recorded, but bounded closeout follow-through still needs to be requested before final thread outcome is current."
          : "Explicit keep-open decision is recorded, but bounded keep-open follow-through still needs to be requested before final thread outcome is current.",
      nextAction:
        input.closeoutResolutionFollowThrough.nextAction ??
        input.closeoutResolution.nextAction,
    };
  }

  if (input.closeoutResolutionFollowThrough.state === "open") {
    return {
      ...base,
      state: "followthrough_open",
      summary:
        input.closeoutResolutionFollowThrough.summary ||
        "Explicit closeout decision follow-through is open and still needs bounded operator handling before final thread outcome is current.",
      nextAction:
        input.closeoutResolutionFollowThrough.nextAction ??
        input.closeoutResolution.nextAction,
    };
  }

  if (input.closeoutResolution.decision === "close_thread") {
    return {
      ...base,
      state: "close_pending",
      summary:
        "Explicit close-thread decision and bounded follow-through are resolved. A separate bounded close action still needs to close the run thread lifecycle.",
      nextAction:
        input.closeoutResolution.nextAction ??
        "Close the runtime session only when a separate bounded operator action explicitly executes the close.",
    };
  }

  return {
    ...base,
    state: "kept_open",
    summary:
      "Explicit keep-open decision and bounded follow-through are resolved. The run thread remains open until newer closeout truth justifies a different decision.",
    nextAction:
      input.closeoutResolution.nextAction ??
      "Keep the thread open until newer closeout truth justifies a different explicit decision.",
  };
}

function buildCloseRequest(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closedAt: Date | null;
  closeoutOutcome: HelmV21RunThreadCloseoutOutcome;
  closeRequestEntries: NonNullable<RunThreadContractInput["closeRequestEntries"]>;
}): HelmV21RunThreadCloseRequest {
  const latestRequest = [...input.closeRequestEntries]
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())[0] ?? null;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_REQUEST_BOUNDARY_NOTE,
    requestEventId: latestRequest?.id ?? null,
    closeoutResolutionEventId:
      latestRequest?.closeoutResolutionEventId ?? input.closeoutOutcome.resolutionEventId,
    closeoutResolutionFollowThroughEventId:
      latestRequest?.closeoutResolutionFollowThroughEventId ??
      input.closeoutOutcome.followThroughResolutionEventId,
    checkpointId: latestRequest?.checkpointId ?? input.closeoutOutcome.checkpointId,
    checkpointKey: latestRequest?.checkpointKey ?? input.closeoutOutcome.checkpointKey,
    resumeToken: latestRequest?.resumeToken ?? input.closeoutOutcome.resumeToken,
    requestedAt: latestRequest?.timestamp ?? null,
    resolvedAt: input.lifecycle === "closed" ? input.closedAt : null,
    requestedBy: latestRequest?.actorName ?? null,
    sourcePage: latestRequest?.sourcePage ?? input.closeoutOutcome.sourcePage,
  };

  if (input.lifecycle === "closed") {
    if (latestRequest && input.closeoutOutcome.state === "closed") {
      return {
        ...base,
        state: "resolved",
        summary:
          "Run thread lifecycle is closed and the explicit bounded close request has been satisfied.",
        nextAction: null,
      };
    }

    return {
      ...base,
      state: "mismatch",
      summary:
        "Run thread lifecycle is closed, but the explicit bounded close request seam is missing or not aligned with the final closeout truth.",
      nextAction:
        "Reconcile runtime close with the explicit close-request seam before treating this thread as canonical closed truth.",
    };
  }

  if (latestRequest && input.closeoutOutcome.state !== "close_pending") {
    return {
      ...base,
      state: "stale",
      summary:
        "The explicit bounded close request is stale because the underlying closeout outcome is no longer in a close-pending posture.",
      nextAction:
        input.closeoutOutcome.nextAction ??
        "Refresh the closeout outcome before requesting bounded runtime close again.",
    };
  }

  if (input.closeoutOutcome.state !== "close_pending") {
    return {
      ...base,
      state: "not_available",
      summary:
        "Explicit bounded runtime close is not available until close-thread truth is fully resolved and the run thread is genuinely close-pending.",
      nextAction: null,
    };
  }

  if (!latestRequest) {
    return {
      ...base,
      state: "requestable",
      summary:
        "The run thread is close-pending. Request explicit bounded runtime close before any lifecycle close is treated as canonical.",
      nextAction:
        "Request explicit runtime close only through a separate bounded close path.",
    };
  }

  return {
    ...base,
    state: "open",
    summary:
      latestRequest.summary ||
      "Explicit bounded runtime close has been requested and is waiting on a separate lifecycle-close path.",
    nextAction:
      latestRequest.nextAction ??
      "Close the runtime session only through a separate bounded close path.",
  };
}

function buildCloseLifecycle(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeoutSummary: HelmV21RunThreadCloseoutSummary;
  closeoutResolution: HelmV21RunThreadCloseoutResolution;
  closeoutResolutionFollowThrough: HelmV21RunThreadCloseoutResolutionFollowThrough;
  closeoutOutcome: HelmV21RunThreadCloseoutOutcome;
  closeRequest: HelmV21RunThreadCloseRequest;
}): HelmV21RunThreadCloseLifecycle {
  const decision =
    input.closeoutOutcome.decision ??
    input.closeoutResolution.decision ??
    input.closeoutResolutionFollowThrough.decision ??
    null;
  const latestUpdatedAt =
    [
      input.closeRequest.resolvedAt,
      input.closeRequest.requestedAt,
      input.closeoutOutcome.latestUpdatedAt,
      input.closeoutResolutionFollowThrough.resolvedAt,
      input.closeoutResolutionFollowThrough.requestedAt,
      input.closeoutSummary.latestUpdatedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeRequest.checkpointKey ??
    input.closeoutOutcome.checkpointKey ??
    input.closeoutResolutionFollowThrough.checkpointKey ??
    input.closeoutResolution.checkpointKey ??
    input.closeoutSummary.checkpointKey;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_LIFECYCLE_BOUNDARY_NOTE,
    decision,
    checkpointKey,
    latestUpdatedAt,
  };

  if (input.closeRequest.state === "mismatch" || input.closeoutOutcome.state === "mismatch") {
    return {
      ...base,
      state: "mismatch",
      driver: input.closeRequest.state === "mismatch" ? "close_request" : "closeout_outcome",
      summary:
        "Thread-level close lifecycle is mismatched because the explicit close-request seam and final closeout truth no longer agree.",
      currentOwner: input.closeRequest.requestedBy ?? input.closeoutOutcome.currentOwner,
      nextAction:
        input.closeRequest.nextAction ??
        input.closeoutOutcome.nextAction ??
        "Reconcile explicit close-request truth with the final closeout outcome before treating this thread as canonical close truth.",
    };
  }

  const staleState =
    input.closeRequest.state === "stale" ||
    input.closeoutOutcome.state === "stale" ||
    input.closeoutResolution.state === "stale" ||
    input.closeoutResolutionFollowThrough.state === "stale" ||
    input.closeoutSummary.state === "refresh_requestable" ||
    input.closeoutSummary.state === "refresh_open";

  if (staleState) {
    const driver =
      input.closeRequest.state === "stale"
        ? "close_request"
        : input.closeoutOutcome.state === "stale"
          ? "closeout_outcome"
          : input.closeoutResolution.state === "stale"
            ? "closeout_resolution"
            : input.closeoutResolutionFollowThrough.state === "stale"
              ? "closeout_resolution_followthrough"
              : "closeout_summary";
    return {
      ...base,
      state: "stale",
      driver,
      summary:
        "Thread-level close lifecycle is stale because the underlying closeout truth reopened or drifted after the previous close posture was recorded.",
      currentOwner:
        input.closeRequest.requestedBy ??
        input.closeoutOutcome.currentOwner ??
        input.closeoutSummary.currentOwner,
      nextAction:
        input.closeRequest.nextAction ??
        input.closeoutOutcome.nextAction ??
        input.closeoutResolutionFollowThrough.nextAction ??
        input.closeoutResolution.nextAction ??
        input.closeoutSummary.nextAction ??
        "Refresh closeout truth before continuing toward bounded runtime close.",
    };
  }

  if (
    input.lifecycle === "closed" ||
    input.closeRequest.state === "resolved" ||
    input.closeoutOutcome.state === "closed"
  ) {
    return {
      ...base,
      state: "closed",
      driver:
        input.closeRequest.state === "resolved"
          ? "close_request"
          : input.closeoutOutcome.state === "closed"
            ? "closeout_outcome"
            : "lifecycle",
      summary:
        "Thread-level close lifecycle is closed. Explicit close truth, bounded close request, and lifecycle close now point at the same final posture.",
      currentOwner: null,
      nextAction: null,
    };
  }

  if (input.closeoutOutcome.state === "kept_open") {
    return {
      ...base,
      state: "kept_open",
      driver: "closeout_outcome",
      summary:
        "Thread-level close lifecycle is explicitly kept open. The current closeout decision resolved to keep the thread active.",
      currentOwner: input.closeoutOutcome.currentOwner,
      nextAction:
        input.closeoutOutcome.nextAction ??
        "Keep the thread open until a newer bounded closeout decision becomes current.",
    };
  }

  if (input.closeRequest.state === "open") {
    return {
      ...base,
      state: "close_requested",
      driver: "close_request",
      summary:
        "Thread-level close lifecycle has an explicit bounded runtime close request open and is waiting on the final lifecycle close to land.",
      currentOwner: input.closeRequest.requestedBy,
      nextAction:
        input.closeRequest.nextAction ??
        "Close the runtime session only through the separate bounded close path.",
    };
  }

  if (input.closeRequest.state === "requestable") {
    return {
      ...base,
      state: "close_requestable",
      driver: "close_request",
      summary:
        "Thread-level close lifecycle is ready for an explicit bounded runtime close request, but no close request has been recorded yet.",
      currentOwner: null,
      nextAction:
        input.closeRequest.nextAction ??
        "Request explicit bounded runtime close before treating this thread as finally closable.",
    };
  }

  if (input.closeoutOutcome.state === "close_pending") {
    return {
      ...base,
      state: "closeable",
      driver: "closeout_outcome",
      summary:
        "Thread-level close lifecycle is close-pending. Closeout decision and follow-through are current, and the thread is waiting on an explicit bounded close request.",
      currentOwner: input.closeoutOutcome.currentOwner,
      nextAction:
        input.closeRequest.nextAction ??
        input.closeoutOutcome.nextAction ??
        "Request explicit bounded runtime close before any lifecycle close is treated as canonical.",
    };
  }

  if (input.closeoutOutcome.state === "followthrough_open") {
    return {
      ...base,
      state: "followthrough_open",
      driver: "closeout_resolution_followthrough",
      summary:
        "Thread-level close lifecycle is blocked on an open explicit closeout-resolution follow-through.",
      currentOwner:
        input.closeoutResolutionFollowThrough.requestedBy ??
        input.closeoutOutcome.currentOwner,
      nextAction:
        input.closeoutResolutionFollowThrough.nextAction ??
        "Resolve explicit closeout-resolution follow-through before moving toward runtime close.",
    };
  }

  if (input.closeoutOutcome.state === "followthrough_required") {
    return {
      ...base,
      state: "followthrough_required",
      driver: "closeout_resolution_followthrough",
      summary:
        "Thread-level close lifecycle still needs explicit closeout-resolution follow-through before bounded runtime close can be requested.",
      currentOwner: null,
      nextAction:
        input.closeoutResolutionFollowThrough.nextAction ??
        input.closeoutOutcome.nextAction ??
        "Request explicit closeout-resolution follow-through before moving toward runtime close.",
    };
  }

  if (
    input.closeoutOutcome.state === "decision_required" ||
    input.closeoutResolution.state === "decision_required"
  ) {
    return {
      ...base,
      state: "decision_required",
      driver: "closeout_resolution",
      summary:
        "Thread-level close lifecycle still needs an explicit close-thread or keep-open decision before any later close posture is treated as canonical.",
      currentOwner: null,
      nextAction:
        input.closeoutResolution.nextAction ??
        input.closeoutOutcome.nextAction ??
        "Record an explicit close-thread or keep-open decision before continuing toward runtime close.",
    };
  }

  return {
    ...base,
    state: "inactive",
    driver: "closeout_summary",
    summary:
      "Thread-level close lifecycle is inactive because closeout truth has not advanced to a decision-bearing posture yet.",
    currentOwner: input.closeoutSummary.currentOwner,
    nextAction:
      input.closeoutSummary.nextAction ??
      "Advance closeout truth to a confirmed posture before close lifecycle becomes actionable.",
  };
}

function buildCloseControl(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeoutSummary: HelmV21RunThreadCloseoutSummary;
  closeLifecycle: HelmV21RunThreadCloseLifecycle;
  settlementFlow: HelmV21RunThreadSettlementFlow;
}): HelmV21RunThreadCloseControl {
  const decision = input.closeLifecycle.decision;
  const latestUpdatedAt =
    [
      input.closeLifecycle.latestUpdatedAt,
      input.settlementFlow.latestUpdatedAt,
      input.closeoutSummary.latestUpdatedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeLifecycle.checkpointKey ??
    input.settlementFlow.checkpointKey ??
    input.closeoutSummary.checkpointKey;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_CONTROL_BOUNDARY_NOTE,
    decision,
    checkpointKey,
    latestUpdatedAt,
  };

  if (input.closeLifecycle.state === "mismatch" || input.closeLifecycle.state === "stale") {
    return {
      ...base,
      state: input.closeLifecycle.state,
      driver: "close_lifecycle",
      summary: input.closeLifecycle.summary,
      currentOwner: input.closeLifecycle.currentOwner,
      nextAction: input.closeLifecycle.nextAction,
    };
  }

  if (input.closeLifecycle.state === "closed") {
    return {
      ...base,
      state: "closed",
      driver: input.lifecycle === "closed" ? "lifecycle" : "close_lifecycle",
      summary: input.closeLifecycle.summary,
      currentOwner: null,
      nextAction: null,
    };
  }

  if (
    input.closeLifecycle.state === "kept_open" ||
    input.closeLifecycle.state === "close_requested" ||
    input.closeLifecycle.state === "close_requestable" ||
    input.closeLifecycle.state === "followthrough_open" ||
    input.closeLifecycle.state === "followthrough_required" ||
    input.closeLifecycle.state === "decision_required"
  ) {
    return {
      ...base,
      state: input.closeLifecycle.state,
      driver: "close_lifecycle",
      summary: input.closeLifecycle.summary,
      currentOwner: input.closeLifecycle.currentOwner,
      nextAction: input.closeLifecycle.nextAction,
    };
  }

  if (input.settlementFlow.state === "review_open") {
    return {
      ...base,
      state: "review_open",
      driver: "settlement_flow",
      summary:
        "Thread-level close control is still in explicit review. Settlement review remains open before close lifecycle can advance.",
      currentOwner: input.settlementFlow.currentOwner,
      nextAction:
        input.settlementFlow.nextAction ??
        "Resolve explicit settlement review before close lifecycle is treated as actionable.",
    };
  }

  if (input.settlementFlow.state === "closeout_open") {
    return {
      ...base,
      state: "closeout_open",
      driver: "settlement_flow",
      summary:
        "Thread-level close control still has open closeout work. Bounded close lifecycle is not yet ready to advance.",
      currentOwner: input.settlementFlow.currentOwner,
      nextAction:
        input.settlementFlow.nextAction ??
        "Resolve the remaining closeout source before bounded runtime close becomes actionable.",
    };
  }

  if (input.closeoutSummary.state === "review_requestable") {
    return {
      ...base,
      state: "review_requestable",
      driver: "closeout_summary",
      summary:
        "Thread-level close control is ready for explicit settlement review, but no settlement review has been requested yet.",
      currentOwner: input.closeoutSummary.currentOwner,
      nextAction:
        input.closeoutSummary.nextAction ??
        "Request explicit settlement review before progressing thread-level close truth.",
    };
  }

  return {
    ...base,
    state: "active",
    driver: input.lifecycle === "closed" ? "lifecycle" : "settlement_flow",
    summary:
      "Thread-level close control is still active because the run thread remains in a non-closeout execution posture.",
    currentOwner: input.settlementFlow.currentOwner ?? input.closeoutSummary.currentOwner,
    nextAction:
      input.settlementFlow.nextAction ??
      input.closeoutSummary.nextAction ??
      "Continue the run thread until closeout truth advances to a reviewable posture.",
  };
}

function buildCloseControlFlow(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeControl: HelmV21RunThreadCloseControl;
  settlementFlow: HelmV21RunThreadSettlementFlow;
  forwardFlow: HelmV21RunThreadForwardFlow;
}): HelmV21RunThreadCloseControlFlow {
  const latestUpdatedAt =
    [
      input.closeControl.latestUpdatedAt,
      input.settlementFlow.latestUpdatedAt,
      input.forwardFlow.latestUpdatedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeControl.checkpointKey ??
    input.settlementFlow.checkpointKey ??
    input.forwardFlow.checkpointKey;
  const currentOwner =
    input.closeControl.currentOwner ??
    input.settlementFlow.currentOwner ??
    input.forwardFlow.currentOwner;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_CONTROL_FLOW_BOUNDARY_NOTE,
    decision: input.closeControl.decision,
    checkpointKey,
    latestUpdatedAt,
    forwardState: input.forwardFlow.state,
    settlementState: input.settlementFlow.state,
    forwardAttentionCount: input.forwardFlow.attentionCount,
    openCloseoutCount: input.settlementFlow.openCloseoutCount,
  };

  if (
    input.closeControl.state === "mismatch" ||
    input.closeControl.state === "stale" ||
    input.closeControl.state === "kept_open" ||
    input.closeControl.state === "close_requested" ||
    input.closeControl.state === "close_requestable" ||
    input.closeControl.state === "followthrough_open" ||
    input.closeControl.state === "followthrough_required" ||
    input.closeControl.state === "decision_required"
  ) {
    return {
      ...base,
      state: input.closeControl.state,
      driver: "close_control",
      summary: input.closeControl.summary,
      currentOwner: input.closeControl.currentOwner,
      nextAction: input.closeControl.nextAction,
    };
  }

  if (input.closeControl.state === "closed") {
    return {
      ...base,
      state: "closed",
      driver: input.lifecycle === "closed" ? "lifecycle" : "close_control",
      summary: input.closeControl.summary,
      currentOwner: null,
      nextAction: null,
    };
  }

  if (input.closeControl.state === "review_open") {
    return {
      ...base,
      state: "review_open",
      driver: "settlement_flow",
      summary:
        input.settlementFlow.summary ||
        "Thread-level close control remains on explicit settlement review before bounded close lifecycle can advance.",
      currentOwner,
      nextAction:
        input.settlementFlow.nextAction ??
        input.closeControl.nextAction ??
        "Resolve settlement review before bounded close control advances.",
    };
  }

  if (input.closeControl.state === "closeout_open") {
    return {
      ...base,
      state: "closeout_open",
      driver: "settlement_flow",
      summary:
        input.settlementFlow.summary ||
        "Thread-level close control still has open closeout work before bounded close lifecycle can advance.",
      currentOwner,
      nextAction:
        input.settlementFlow.nextAction ??
        input.closeControl.nextAction ??
        "Resolve the remaining closeout work before bounded close control advances.",
    };
  }

  if (input.closeControl.state === "review_requestable") {
    return {
      ...base,
      state: "review_requestable",
      driver: "close_control",
      summary: input.closeControl.summary,
      currentOwner: input.closeControl.currentOwner,
      nextAction: input.closeControl.nextAction,
    };
  }

  if (input.forwardFlow.state !== "idle" && input.forwardFlow.state !== "closed") {
    return {
      ...base,
      state: "forward_active",
      driver: "forward_flow",
      summary: `Thread-level close control remains active because forward flow is ${input.forwardFlow.state} with ${input.forwardFlow.attentionCount} attention source(s).`,
      currentOwner: input.forwardFlow.currentOwner,
      nextAction:
        input.forwardFlow.nextAction ??
        input.closeControl.nextAction ??
        "Resolve bounded forward work before thread-level close control is treated as further advanced.",
    };
  }

  return {
    ...base,
    state: "active",
    driver: input.settlementFlow.state === "active" ? "settlement_flow" : "close_control",
    summary:
      "Thread-level close control is active but no explicit review, closeout, or bounded forward blocker is open yet.",
    currentOwner,
    nextAction:
      input.closeControl.nextAction ??
      input.settlementFlow.nextAction ??
      "Keep the run thread open until explicit close control or settlement evidence becomes available.",
  };
}

function buildCloseDecisionFlow(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeControlFlow: HelmV21RunThreadCloseControlFlow;
  closeoutOutcome: HelmV21RunThreadCloseoutOutcome;
  closeRequest: HelmV21RunThreadCloseRequest;
}): HelmV21RunThreadCloseDecisionFlow {
  const latestUpdatedAt =
    [
      input.closeRequest.resolvedAt,
      input.closeRequest.requestedAt,
      input.closeoutOutcome.latestUpdatedAt,
      input.closeControlFlow.latestUpdatedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeRequest.checkpointKey ??
    input.closeoutOutcome.checkpointKey ??
    input.closeControlFlow.checkpointKey;
  const currentOwner =
    input.closeRequest.requestedBy ??
    input.closeoutOutcome.currentOwner ??
    input.closeControlFlow.currentOwner;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_DECISION_FLOW_BOUNDARY_NOTE,
    decision: input.closeoutOutcome.decision ?? input.closeControlFlow.decision,
    checkpointKey,
    currentOwner,
    latestUpdatedAt,
    controlState: input.closeControlFlow.state,
    outcomeState: input.closeoutOutcome.state,
    closeRequestState: input.closeRequest.state,
  };

  if (input.closeRequest.state === "mismatch" || input.closeoutOutcome.state === "mismatch") {
    return {
      ...base,
      state: "mismatch",
      driver: input.closeRequest.state === "mismatch" ? "close_request" : "closeout_outcome",
      summary:
        input.closeRequest.state === "mismatch"
          ? input.closeRequest.summary
          : input.closeoutOutcome.summary,
      nextAction:
        input.closeRequest.nextAction ??
        input.closeoutOutcome.nextAction ??
        "Reconcile explicit close request and final closeout outcome before treating close decision flow as canonical.",
    };
  }

  if (input.closeRequest.state === "stale" || input.closeoutOutcome.state === "stale") {
    return {
      ...base,
      state: "stale",
      driver: input.closeRequest.state === "stale" ? "close_request" : "closeout_outcome",
      summary:
        input.closeRequest.state === "stale"
          ? input.closeRequest.summary
          : input.closeoutOutcome.summary,
      nextAction:
        input.closeRequest.nextAction ??
        input.closeoutOutcome.nextAction ??
        "Refresh explicit close truth before carrying the thread-level close decision forward.",
    };
  }

  if (input.lifecycle === "closed" || input.closeRequest.state === "resolved" || input.closeoutOutcome.state === "closed") {
    return {
      ...base,
      state: "closed",
      driver:
        input.closeRequest.state === "resolved"
          ? "close_request"
          : input.closeoutOutcome.state === "closed"
            ? "closeout_outcome"
            : "lifecycle",
      summary:
        input.closeRequest.state === "resolved"
          ? input.closeRequest.summary
          : input.closeoutOutcome.summary,
      currentOwner: null,
      nextAction: null,
    };
  }

  if (input.closeoutOutcome.state === "kept_open") {
    return {
      ...base,
      state: "kept_open",
      driver: "closeout_outcome",
      summary: input.closeoutOutcome.summary,
      nextAction: input.closeoutOutcome.nextAction,
    };
  }

  if (input.closeRequest.state === "open") {
    return {
      ...base,
      state: "close_requested",
      driver: "close_request",
      summary: input.closeRequest.summary,
      nextAction: input.closeRequest.nextAction,
    };
  }

  if (input.closeRequest.state === "requestable") {
    return {
      ...base,
      state: "close_requestable",
      driver: "close_request",
      summary: input.closeRequest.summary,
      nextAction: input.closeRequest.nextAction,
    };
  }

  if (input.closeoutOutcome.state === "followthrough_open") {
    return {
      ...base,
      state: "followthrough_open",
      driver: "closeout_outcome",
      summary: input.closeoutOutcome.summary,
      nextAction: input.closeoutOutcome.nextAction,
    };
  }

  if (input.closeoutOutcome.state === "followthrough_required") {
    return {
      ...base,
      state: "followthrough_required",
      driver: "closeout_outcome",
      summary: input.closeoutOutcome.summary,
      nextAction: input.closeoutOutcome.nextAction,
    };
  }

  if (input.closeoutOutcome.state === "decision_required") {
    return {
      ...base,
      state: "decision_required",
      driver: "closeout_outcome",
      summary: input.closeoutOutcome.summary,
      nextAction: input.closeoutOutcome.nextAction,
    };
  }

  if (input.closeControlFlow.state === "review_open") {
    return {
      ...base,
      state: "review_open",
      driver: "close_control_flow",
      summary: input.closeControlFlow.summary,
      nextAction: input.closeControlFlow.nextAction,
    };
  }

  if (input.closeControlFlow.state === "review_requestable") {
    return {
      ...base,
      state: "review_requestable",
      driver: "close_control_flow",
      summary: input.closeControlFlow.summary,
      nextAction: input.closeControlFlow.nextAction,
    };
  }

  return {
    ...base,
    state: "active",
    driver: "close_control_flow",
    summary:
      "Thread-level close decision flow is still active because explicit close decision truth has not progressed beyond bounded close control yet.",
    nextAction:
      input.closeControlFlow.nextAction ??
      input.closeoutOutcome.nextAction ??
      "Continue bounded close-control work until explicit close decision truth advances.",
  };
}

function buildCloseDecisionControlSummary(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeLifecycle: HelmV21RunThreadCloseLifecycle;
  closeControlFlow: HelmV21RunThreadCloseControlFlow;
  closeDecisionFlow: HelmV21RunThreadCloseDecisionFlow;
  forwardFlow: HelmV21RunThreadForwardFlow;
}): HelmV21RunThreadCloseDecisionControlSummary {
  const latestUpdatedAt =
    [
      input.closeDecisionFlow.latestUpdatedAt,
      input.closeLifecycle.latestUpdatedAt,
      input.closeControlFlow.latestUpdatedAt,
      input.forwardFlow.latestUpdatedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeDecisionFlow.checkpointKey ??
    input.closeLifecycle.checkpointKey ??
    input.closeControlFlow.checkpointKey ??
    input.forwardFlow.checkpointKey;
  const currentOwner =
    input.closeDecisionFlow.currentOwner ??
    input.closeLifecycle.currentOwner ??
    input.closeControlFlow.currentOwner ??
    input.forwardFlow.currentOwner;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_DECISION_CONTROL_SUMMARY_BOUNDARY_NOTE,
    decision:
      input.closeDecisionFlow.decision ??
      input.closeLifecycle.decision ??
      input.closeControlFlow.decision,
    checkpointKey,
    currentOwner,
    latestUpdatedAt,
    decisionState: input.closeDecisionFlow.state,
    controlState: input.closeControlFlow.state,
    lifecycleState: input.closeLifecycle.state,
    forwardState: input.forwardFlow.state,
    settlementState: input.closeControlFlow.settlementState,
  };

  if (
    input.closeDecisionFlow.state === "mismatch" ||
    input.closeDecisionFlow.state === "stale"
  ) {
    return {
      ...base,
      state: input.closeDecisionFlow.state,
      driver:
        input.closeDecisionFlow.driver === "lifecycle" ? "lifecycle" : "close_decision_flow",
      summary: input.closeDecisionFlow.summary,
      nextAction: input.closeDecisionFlow.nextAction,
    };
  }

  if (input.closeLifecycle.state === "closeable") {
    return {
      ...base,
      state: "closeable",
      driver: "close_lifecycle",
      summary: input.closeLifecycle.summary,
      nextAction: input.closeLifecycle.nextAction,
    };
  }

  if (
    input.closeDecisionFlow.state === "closed" ||
    input.closeDecisionFlow.state === "kept_open" ||
    input.closeDecisionFlow.state === "close_requested" ||
    input.closeDecisionFlow.state === "close_requestable" ||
    input.closeDecisionFlow.state === "followthrough_open" ||
    input.closeDecisionFlow.state === "followthrough_required" ||
    input.closeDecisionFlow.state === "decision_required" ||
    input.closeDecisionFlow.state === "review_open" ||
    input.closeDecisionFlow.state === "review_requestable"
  ) {
    return {
      ...base,
      state: input.closeDecisionFlow.state,
      driver:
        input.closeDecisionFlow.driver === "lifecycle" ? "lifecycle" : "close_decision_flow",
      summary: input.closeDecisionFlow.summary,
      currentOwner:
        input.closeDecisionFlow.state === "closed" ? null : input.closeDecisionFlow.currentOwner,
      nextAction:
        input.closeDecisionFlow.state === "closed" ? null : input.closeDecisionFlow.nextAction,
    };
  }

  if (input.closeControlFlow.state === "closeout_open") {
    return {
      ...base,
      state: "closeout_open",
      driver: "close_control_flow",
      summary: input.closeControlFlow.summary,
      nextAction: input.closeControlFlow.nextAction,
    };
  }

  if (input.closeControlFlow.state === "forward_active") {
    return {
      ...base,
      state: "forward_active",
      driver: "forward_flow",
      summary: input.closeControlFlow.summary,
      currentOwner: input.forwardFlow.currentOwner ?? input.closeControlFlow.currentOwner,
      nextAction:
        input.forwardFlow.nextAction ??
        input.closeControlFlow.nextAction ??
        "Resolve bounded forward work before treating close decision control as more advanced.",
    };
  }

  return {
    ...base,
    state: "active",
    driver: input.lifecycle === "closed" ? "lifecycle" : "close_control_flow",
    summary:
      "Thread-level close decision control is still active because bounded close decision truth has not advanced beyond active close control.",
    nextAction:
      input.closeControlFlow.nextAction ??
      input.closeDecisionFlow.nextAction ??
      "Keep the run thread open until explicit close decision truth becomes more advanced.",
  };
}

function buildCloseResolutionSummary(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeDecisionControlSummary: HelmV21RunThreadCloseDecisionControlSummary;
  closeLifecycle: HelmV21RunThreadCloseLifecycle;
  closeRequest: HelmV21RunThreadCloseRequest;
}): HelmV21RunThreadCloseResolutionSummary {
  const latestUpdatedAt =
    [
      input.closeDecisionControlSummary.latestUpdatedAt,
      input.closeLifecycle.latestUpdatedAt,
      input.closeRequest.resolvedAt,
      input.closeRequest.requestedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeDecisionControlSummary.checkpointKey ??
    input.closeLifecycle.checkpointKey ??
    input.closeRequest.checkpointKey;
  const currentOwner =
    input.closeDecisionControlSummary.currentOwner ??
    input.closeLifecycle.currentOwner ??
    input.closeRequest.requestedBy;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_RESOLUTION_SUMMARY_BOUNDARY_NOTE,
    decision: input.closeDecisionControlSummary.decision ?? input.closeLifecycle.decision,
    checkpointKey,
    currentOwner,
    latestUpdatedAt,
    decisionControlState: input.closeDecisionControlSummary.state,
    lifecycleState: input.closeLifecycle.state,
    closeRequestState: input.closeRequest.state,
  };

  if (
    input.closeDecisionControlSummary.state === "mismatch" ||
    input.closeDecisionControlSummary.state === "stale"
  ) {
    return {
      ...base,
      state: input.closeDecisionControlSummary.state,
      driver:
        input.closeDecisionControlSummary.driver === "lifecycle"
          ? "lifecycle"
          : "close_decision_control_summary",
      summary: input.closeDecisionControlSummary.summary,
      nextAction: input.closeDecisionControlSummary.nextAction,
    };
  }

  if (
    input.closeDecisionControlSummary.state === "closed" ||
    input.closeLifecycle.state === "closed"
  ) {
    return {
      ...base,
      state: "closed",
      driver:
        input.lifecycle === "closed"
          ? "lifecycle"
          : input.closeRequest.state === "resolved"
            ? "close_request"
            : "close_decision_control_summary",
      summary:
        input.closeDecisionControlSummary.state === "closed"
          ? input.closeDecisionControlSummary.summary
          : input.closeLifecycle.summary,
      currentOwner: null,
      nextAction: null,
    };
  }

  if (input.closeDecisionControlSummary.state === "kept_open") {
    return {
      ...base,
      state: "kept_open",
      driver: "close_decision_control_summary",
      summary: input.closeDecisionControlSummary.summary,
      nextAction: input.closeDecisionControlSummary.nextAction,
    };
  }

  if (input.closeDecisionControlSummary.state === "close_requested") {
    return {
      ...base,
      state: "close_requested",
      driver: "close_request",
      summary: input.closeDecisionControlSummary.summary,
      nextAction:
        input.closeRequest.nextAction ??
        input.closeDecisionControlSummary.nextAction ??
        "Wait for bounded runtime close to land before treating the thread as closed.",
    };
  }

  if (
    input.closeDecisionControlSummary.state === "close_requestable" ||
    input.closeDecisionControlSummary.state === "closeable"
  ) {
    return {
      ...base,
      state: "ready_to_request_close",
      driver:
        input.closeDecisionControlSummary.state === "closeable"
          ? "close_lifecycle"
          : "close_request",
      summary:
        input.closeDecisionControlSummary.state === "closeable"
          ? input.closeDecisionControlSummary.summary
          : "Thread-level close resolution is ready for an explicit bounded runtime close request.",
      nextAction:
        input.closeRequest.nextAction ??
        input.closeLifecycle.nextAction ??
        input.closeDecisionControlSummary.nextAction ??
        "Request explicit bounded runtime close before treating the thread as finally closable.",
    };
  }

  if (input.closeDecisionControlSummary.state === "followthrough_open") {
    return {
      ...base,
      state: "followthrough_open",
      driver: "close_decision_control_summary",
      summary: input.closeDecisionControlSummary.summary,
      nextAction: input.closeDecisionControlSummary.nextAction,
    };
  }

  if (input.closeDecisionControlSummary.state === "followthrough_required") {
    return {
      ...base,
      state: "followthrough_required",
      driver: "close_decision_control_summary",
      summary: input.closeDecisionControlSummary.summary,
      nextAction: input.closeDecisionControlSummary.nextAction,
    };
  }

  if (input.closeDecisionControlSummary.state === "decision_required") {
    return {
      ...base,
      state: "decision_required",
      driver: "close_decision_control_summary",
      summary: input.closeDecisionControlSummary.summary,
      nextAction: input.closeDecisionControlSummary.nextAction,
    };
  }

  return {
    ...base,
    state: "not_ready",
    driver:
      input.closeDecisionControlSummary.driver === "lifecycle"
        ? "lifecycle"
        : "close_decision_control_summary",
    summary:
      "Thread-level close resolution is not ready because bounded close decision control still has active review, closeout, or forward work open.",
    nextAction:
      input.closeDecisionControlSummary.nextAction ??
      "Continue bounded close-control work until close resolution becomes explicit.",
  };
}

function buildCloseResolutionForwardSummary(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeResolutionSummary: HelmV21RunThreadCloseResolutionSummary;
  closeDecisionControlSummary: HelmV21RunThreadCloseDecisionControlSummary;
  settlementFlow: HelmV21RunThreadSettlementFlow;
  forwardFlow: HelmV21RunThreadForwardFlow;
}): HelmV21RunThreadCloseResolutionForwardSummary {
  const latestUpdatedAt =
    [
      input.closeResolutionSummary.latestUpdatedAt,
      input.closeDecisionControlSummary.latestUpdatedAt,
      input.settlementFlow.latestUpdatedAt,
      input.forwardFlow.latestUpdatedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeResolutionSummary.checkpointKey ??
    input.closeDecisionControlSummary.checkpointKey ??
    input.settlementFlow.checkpointKey ??
    input.forwardFlow.checkpointKey;
  const currentOwner =
    input.closeResolutionSummary.currentOwner ??
    input.closeDecisionControlSummary.currentOwner ??
    input.settlementFlow.currentOwner ??
    input.forwardFlow.currentOwner;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_RESOLUTION_FORWARD_SUMMARY_BOUNDARY_NOTE,
    decision:
      input.closeResolutionSummary.decision ?? input.closeDecisionControlSummary.decision,
    checkpointKey,
    currentOwner,
    latestUpdatedAt,
    resolutionState: input.closeResolutionSummary.state,
    decisionControlState: input.closeDecisionControlSummary.state,
    settlementState: input.settlementFlow.state,
    forwardState: input.forwardFlow.state,
    forwardAttentionCount: input.forwardFlow.attentionCount,
    openCloseoutCount: input.settlementFlow.openCloseoutCount,
  };

  if (
    input.closeResolutionSummary.state === "mismatch" ||
    input.closeResolutionSummary.state === "stale"
  ) {
    return {
      ...base,
      state: input.closeResolutionSummary.state,
      driver:
        input.closeResolutionSummary.driver === "lifecycle"
          ? "lifecycle"
          : "close_resolution_summary",
      summary: input.closeResolutionSummary.summary,
      nextAction: input.closeResolutionSummary.nextAction,
    };
  }

  if (
    input.closeResolutionSummary.state === "closed" ||
    input.closeResolutionSummary.state === "kept_open" ||
    input.closeResolutionSummary.state === "close_requested" ||
    input.closeResolutionSummary.state === "ready_to_request_close" ||
    input.closeResolutionSummary.state === "followthrough_open" ||
    input.closeResolutionSummary.state === "followthrough_required" ||
    input.closeResolutionSummary.state === "decision_required"
  ) {
    return {
      ...base,
      state:
        input.closeResolutionSummary.state === "ready_to_request_close"
          ? "ready_to_request_close"
          : input.closeResolutionSummary.state,
      driver:
        input.closeResolutionSummary.driver === "lifecycle"
          ? "lifecycle"
          : "close_resolution_summary",
      summary: input.closeResolutionSummary.summary,
      currentOwner:
        input.closeResolutionSummary.state === "closed"
          ? null
          : input.closeResolutionSummary.currentOwner,
      nextAction:
        input.closeResolutionSummary.state === "closed"
          ? null
          : input.closeResolutionSummary.nextAction,
    };
  }

  if (input.closeDecisionControlSummary.state === "review_requestable") {
    return {
      ...base,
      state: "review_requestable",
      driver: "close_decision_control_summary",
      summary: input.closeDecisionControlSummary.summary,
      nextAction: input.closeDecisionControlSummary.nextAction,
    };
  }

  if (input.settlementFlow.state === "review_open") {
    return {
      ...base,
      state: "review_open",
      driver: "settlement_flow",
      summary: input.settlementFlow.summary,
      currentOwner: input.settlementFlow.currentOwner,
      nextAction: input.settlementFlow.nextAction,
    };
  }

  if (input.settlementFlow.state === "closeout_open") {
    return {
      ...base,
      state: "closeout_open",
      driver: "settlement_flow",
      summary: input.settlementFlow.summary,
      currentOwner: input.settlementFlow.currentOwner,
      nextAction: input.settlementFlow.nextAction,
    };
  }

  if (input.forwardFlow.state !== "idle" && input.forwardFlow.state !== "closed") {
    return {
      ...base,
      state: "forward_active",
      driver: "forward_flow",
      summary:
        input.forwardFlow.summary ||
        `Thread-level close resolution still has ${input.forwardFlow.attentionCount} bounded forward attention source(s) open.`,
      currentOwner: input.forwardFlow.currentOwner,
      nextAction:
        input.forwardFlow.nextAction ??
        "Resolve bounded forward work before treating close resolution as further advanced.",
    };
  }

  return {
    ...base,
    state: "active",
    driver: input.lifecycle === "closed" ? "lifecycle" : "close_decision_control_summary",
    summary:
      "Thread-level close resolution forward summary is active because explicit close resolution truth is not yet ready for bounded runtime close.",
    nextAction:
      input.closeDecisionControlSummary.nextAction ??
      input.settlementFlow.nextAction ??
      "Continue bounded close-control work until explicit close resolution is ready.",
  };
}

function buildCloseResolutionControlSummary(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeResolutionSummary: HelmV21RunThreadCloseResolutionSummary;
  closeResolutionForwardSummary: HelmV21RunThreadCloseResolutionForwardSummary;
  closeLifecycle: HelmV21RunThreadCloseLifecycle;
  closeRequest: HelmV21RunThreadCloseRequest;
}): HelmV21RunThreadCloseResolutionControlSummary {
  const latestUpdatedAt =
    [
      input.closeResolutionForwardSummary.latestUpdatedAt,
      input.closeResolutionSummary.latestUpdatedAt,
      input.closeLifecycle.latestUpdatedAt,
      input.closeRequest.resolvedAt,
      input.closeRequest.requestedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeResolutionForwardSummary.checkpointKey ??
    input.closeResolutionSummary.checkpointKey ??
    input.closeLifecycle.checkpointKey ??
    input.closeRequest.checkpointKey;
  const currentOwner =
    input.closeResolutionForwardSummary.currentOwner ??
    input.closeResolutionSummary.currentOwner ??
    input.closeLifecycle.currentOwner ??
    input.closeRequest.requestedBy;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_RESOLUTION_CONTROL_SUMMARY_BOUNDARY_NOTE,
    decision:
      input.closeResolutionForwardSummary.decision ??
      input.closeResolutionSummary.decision ??
      input.closeLifecycle.decision,
    checkpointKey,
    currentOwner,
    latestUpdatedAt,
    resolutionState: input.closeResolutionSummary.state,
    forwardState: input.closeResolutionForwardSummary.state,
    lifecycleState: input.closeLifecycle.state,
    closeRequestState: input.closeRequest.state,
  };

  if (
    input.closeResolutionForwardSummary.state === "mismatch" ||
    input.closeResolutionForwardSummary.state === "stale"
  ) {
    return {
      ...base,
      state: input.closeResolutionForwardSummary.state,
      driver:
        input.closeResolutionForwardSummary.driver === "lifecycle"
          ? "lifecycle"
          : "close_resolution_forward_summary",
      summary: input.closeResolutionForwardSummary.summary,
      nextAction: input.closeResolutionForwardSummary.nextAction,
    };
  }

  if (
    input.closeResolutionForwardSummary.state === "closed" ||
    input.closeLifecycle.state === "closed"
  ) {
    return {
      ...base,
      state: "closed",
      driver: input.lifecycle === "closed" ? "lifecycle" : "close_resolution_summary",
      summary:
        input.closeResolutionForwardSummary.state === "closed"
          ? input.closeResolutionForwardSummary.summary
          : input.closeLifecycle.summary,
      currentOwner: null,
      nextAction: null,
    };
  }

  if (input.closeResolutionForwardSummary.state === "kept_open") {
    return {
      ...base,
      state: "kept_open",
      driver: "close_resolution_summary",
      summary: input.closeResolutionForwardSummary.summary,
      nextAction: input.closeResolutionForwardSummary.nextAction,
    };
  }

  if (input.closeResolutionForwardSummary.state === "close_requested") {
    return {
      ...base,
      state: "close_requested",
      driver: "close_resolution_summary",
      summary: input.closeResolutionForwardSummary.summary,
      nextAction: input.closeResolutionForwardSummary.nextAction,
    };
  }

  if (input.closeResolutionForwardSummary.state === "ready_to_request_close") {
    return {
      ...base,
      state: "ready_to_request_close",
      driver: "close_resolution_summary",
      summary: input.closeResolutionForwardSummary.summary,
      nextAction: input.closeResolutionForwardSummary.nextAction,
    };
  }

  return {
    ...base,
    state: "not_ready",
    driver:
      input.closeResolutionForwardSummary.driver === "lifecycle"
        ? "lifecycle"
        : "close_resolution_forward_summary",
    summary:
      "Thread-level close resolution control is not ready because explicit close-resolution truth still has bounded review, closeout, or forward work open.",
    nextAction:
      input.closeResolutionForwardSummary.nextAction ??
      "Continue bounded close-resolution work until explicit close control becomes ready.",
  };
}

function buildClosePostureSummary(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closeResolutionControlSummary: HelmV21RunThreadCloseResolutionControlSummary;
  closeResolutionForwardSummary: HelmV21RunThreadCloseResolutionForwardSummary;
  closeLifecycle: HelmV21RunThreadCloseLifecycle;
  closeRequest: HelmV21RunThreadCloseRequest;
}): HelmV21RunThreadClosePostureSummary {
  const latestUpdatedAt =
    [
      input.closeResolutionControlSummary.latestUpdatedAt,
      input.closeResolutionForwardSummary.latestUpdatedAt,
      input.closeLifecycle.latestUpdatedAt,
      input.closeRequest.resolvedAt,
      input.closeRequest.requestedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closeResolutionControlSummary.checkpointKey ??
    input.closeResolutionForwardSummary.checkpointKey ??
    input.closeLifecycle.checkpointKey ??
    input.closeRequest.checkpointKey;
  const currentOwner =
    input.closeResolutionControlSummary.currentOwner ??
    input.closeResolutionForwardSummary.currentOwner ??
    input.closeLifecycle.currentOwner ??
    input.closeRequest.requestedBy;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_POSTURE_SUMMARY_BOUNDARY_NOTE,
    decision:
      input.closeResolutionControlSummary.decision ??
      input.closeResolutionForwardSummary.decision ??
      input.closeLifecycle.decision,
    checkpointKey,
    currentOwner,
    latestUpdatedAt,
    resolutionControlState: input.closeResolutionControlSummary.state,
    resolutionForwardState: input.closeResolutionForwardSummary.state,
    lifecycleState: input.closeLifecycle.state,
    closeRequestState: input.closeRequest.state,
  };

  if (
    input.closeResolutionControlSummary.state === "mismatch" ||
    input.closeResolutionControlSummary.state === "stale"
  ) {
    return {
      ...base,
      state: input.closeResolutionControlSummary.state,
      driver:
        input.closeResolutionControlSummary.driver === "lifecycle"
          ? "lifecycle"
          : "close_resolution_control_summary",
      summary: input.closeResolutionControlSummary.summary,
      nextAction: input.closeResolutionControlSummary.nextAction,
    };
  }

  if (
    input.closeResolutionControlSummary.state === "closed" ||
    input.closeLifecycle.state === "closed"
  ) {
    return {
      ...base,
      state: "closed",
      driver: input.lifecycle === "closed" ? "lifecycle" : "close_lifecycle",
      summary:
        input.closeResolutionControlSummary.state === "closed"
          ? input.closeResolutionControlSummary.summary
          : input.closeLifecycle.summary,
      currentOwner: null,
      nextAction: null,
    };
  }

  if (input.closeResolutionControlSummary.state === "kept_open") {
    return {
      ...base,
      state: "kept_open",
      driver: "close_resolution_control_summary",
      summary: input.closeResolutionControlSummary.summary,
      nextAction: input.closeResolutionControlSummary.nextAction,
    };
  }

  if (input.closeResolutionControlSummary.state === "close_requested") {
    return {
      ...base,
      state: "close_pending",
      driver: "close_resolution_control_summary",
      summary:
        input.closeResolutionControlSummary.summary ||
        "Thread-level close posture is close-pending because an explicit bounded runtime close has already been requested.",
      nextAction:
        input.closeResolutionControlSummary.nextAction ??
        input.closeRequest.nextAction ??
        "Wait for bounded runtime close to land before treating the thread as closed.",
    };
  }

  if (input.closeResolutionControlSummary.state === "ready_to_request_close") {
    return {
      ...base,
      state: "close_ready",
      driver: "close_resolution_control_summary",
      summary: input.closeResolutionControlSummary.summary,
      nextAction: input.closeResolutionControlSummary.nextAction,
    };
  }

  return {
    ...base,
    state: "open",
    driver:
      input.closeResolutionForwardSummary.driver === "lifecycle"
        ? "lifecycle"
        : "close_resolution_forward_summary",
    summary:
      "Thread-level close posture remains open because bounded close truth is still inside review, closeout, or forward-progress work and has not reached an explicit close-ready verdict.",
    nextAction:
      input.closeResolutionForwardSummary.nextAction ??
      input.closeResolutionControlSummary.nextAction ??
      "Continue bounded close-control work until an explicit close-ready, close-pending, keep-open, or closed posture is recorded.",
  };
}

function buildClosePostureForwardSummary(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  closePostureSummary: HelmV21RunThreadClosePostureSummary;
  closeResolutionForwardSummary: HelmV21RunThreadCloseResolutionForwardSummary;
  settlementFlow: HelmV21RunThreadSettlementFlow;
  forwardFlow: HelmV21RunThreadForwardFlow;
  closeRequest: HelmV21RunThreadCloseRequest;
}): HelmV21RunThreadClosePostureForwardSummary {
  const latestUpdatedAt =
    [
      input.closePostureSummary.latestUpdatedAt,
      input.closeResolutionForwardSummary.latestUpdatedAt,
      input.settlementFlow.latestUpdatedAt,
      input.forwardFlow.latestUpdatedAt,
      input.closeRequest.resolvedAt,
      input.closeRequest.requestedAt,
    ]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const checkpointKey =
    input.closePostureSummary.checkpointKey ??
    input.closeResolutionForwardSummary.checkpointKey ??
    input.settlementFlow.checkpointKey ??
    input.forwardFlow.checkpointKey ??
    input.closeRequest.checkpointKey;
  const currentOwner =
    input.closePostureSummary.currentOwner ??
    input.closeResolutionForwardSummary.currentOwner ??
    input.settlementFlow.currentOwner ??
    input.forwardFlow.currentOwner ??
    input.closeRequest.requestedBy;
  const base = {
    boundaryNote: RUN_THREAD_CLOSE_POSTURE_FORWARD_SUMMARY_BOUNDARY_NOTE,
    decision:
      input.closePostureSummary.decision ?? input.closeResolutionForwardSummary.decision,
    checkpointKey,
    currentOwner,
    latestUpdatedAt,
    postureState: input.closePostureSummary.state,
    resolutionForwardState: input.closeResolutionForwardSummary.state,
    settlementState: input.settlementFlow.state,
    forwardState: input.forwardFlow.state,
    closeRequestState: input.closeRequest.state,
    forwardAttentionCount: input.forwardFlow.attentionCount,
    openCloseoutCount: input.settlementFlow.openCloseoutCount,
  };

  if (
    input.closePostureSummary.state === "mismatch" ||
    input.closePostureSummary.state === "stale"
  ) {
    return {
      ...base,
      state: input.closePostureSummary.state,
      driver:
        input.closePostureSummary.driver === "lifecycle" ? "lifecycle" : "close_posture_summary",
      summary: input.closePostureSummary.summary,
      nextAction: input.closePostureSummary.nextAction,
    };
  }

  if (input.closePostureSummary.state === "closed" || input.lifecycle === "closed") {
    return {
      ...base,
      state: "closed",
      driver: input.lifecycle === "closed" ? "lifecycle" : "close_posture_summary",
      summary: input.closePostureSummary.summary,
      currentOwner: null,
      nextAction: null,
    };
  }

  if (input.closePostureSummary.state === "kept_open") {
    return {
      ...base,
      state: "kept_open",
      driver: "close_posture_summary",
      summary: input.closePostureSummary.summary,
      nextAction: input.closePostureSummary.nextAction,
    };
  }

  if (input.closePostureSummary.state === "close_pending") {
    return {
      ...base,
      state: "close_pending",
      driver: "close_posture_summary",
      summary: input.closePostureSummary.summary,
      nextAction: input.closePostureSummary.nextAction,
    };
  }

  if (input.closePostureSummary.state === "close_ready") {
    return {
      ...base,
      state: "close_ready",
      driver: "close_posture_summary",
      summary: input.closePostureSummary.summary,
      nextAction: input.closePostureSummary.nextAction,
    };
  }

  if (input.closeResolutionForwardSummary.state === "review_requestable") {
    return {
      ...base,
      state: "review_requestable",
      driver: "close_resolution_forward_summary",
      summary: input.closeResolutionForwardSummary.summary,
      nextAction: input.closeResolutionForwardSummary.nextAction,
    };
  }

  if (input.settlementFlow.state === "review_open") {
    return {
      ...base,
      state: "review_open",
      driver: "settlement_flow",
      summary: input.settlementFlow.summary,
      currentOwner: input.settlementFlow.currentOwner,
      nextAction: input.settlementFlow.nextAction,
    };
  }

  if (input.settlementFlow.state === "closeout_open") {
    return {
      ...base,
      state: "closeout_open",
      driver: "settlement_flow",
      summary: input.settlementFlow.summary,
      currentOwner: input.settlementFlow.currentOwner,
      nextAction: input.settlementFlow.nextAction,
    };
  }

  if (input.forwardFlow.state !== "idle" && input.forwardFlow.state !== "closed") {
    return {
      ...base,
      state: "forward_open",
      driver: "forward_flow",
      summary:
        input.forwardFlow.summary ||
        `Thread-level close posture still has ${input.forwardFlow.attentionCount} bounded forward attention source(s) open.`,
      currentOwner: input.forwardFlow.currentOwner,
      nextAction:
        input.forwardFlow.nextAction ??
        "Resolve bounded forward work before treating close posture as more advanced.",
    };
  }

  return {
    ...base,
    state: "open",
    driver:
      input.closePostureSummary.driver === "lifecycle" ? "lifecycle" : "close_posture_summary",
    summary:
      input.closePostureSummary.summary ||
      "Thread-level close posture is still open because bounded close truth has not yet advanced to an explicit close-ready, close-pending, keep-open, or closed verdict.",
    nextAction:
      input.closePostureSummary.nextAction ??
      input.closeResolutionForwardSummary.nextAction ??
      "Continue bounded close-control work until explicit close posture becomes more advanced.",
  };
}

function buildForwardFlow(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  lifecycleLog: HelmV21RunThreadLifecycleEntry[];
  requestPosture: HelmV21RunThreadRequestPosture;
  requestLifecycleEntries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>;
  resultFlow: HelmV21RunThreadResultFlow;
}): HelmV21RunThreadForwardFlow {
  const latestForwardLifecycleEntry =
    input.lifecycleLog.find((item) => item.kind !== "closeout_resolution_recorded") ?? null;
  const attentionSources: HelmV21RunThreadForwardFlowAttentionSource[] = [];
  if (input.requestPosture.takeoverState === "requested") {
    attentionSources.push("takeover_request");
  }
  if (input.requestPosture.humanInputState === "requested") {
    attentionSources.push("human_input_request");
  }

  const activeControl = deriveLatestActiveControl(input.requestLifecycleEntries);
  const followThroughEntries = [...input.requestLifecycleEntries]
    .filter(
      (item) =>
        item.kind === "takeover_followthrough_requested" ||
        item.kind === "takeover_followthrough_resolved",
    )
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
  const latestFollowThroughRequest =
    followThroughEntries.find((item) => item.kind === "takeover_followthrough_requested") ?? null;
  const latestFollowThroughResolution =
    followThroughEntries.find((item) => item.kind === "takeover_followthrough_resolved") ?? null;
  const openTakeoverFollowThrough =
    (latestFollowThroughRequest?.timestamp.getTime() ?? 0) >
    (latestFollowThroughResolution?.timestamp.getTime() ?? 0)
      ? latestFollowThroughRequest
      : null;
  if (activeControl) {
    attentionSources.push("active_control");
  }
  if (openTakeoverFollowThrough) {
    attentionSources.push("operator_takeover_followthrough");
  }
  for (const item of input.resultFlow.sourceEntries) {
    if (
      item.state === "pending" ||
      item.state === "failed" ||
      item.state === "blocked" ||
      item.state === "deferred" ||
      item.state === "follow_through_open"
    ) {
      attentionSources.push(item.source);
    }
  }

  const dedupedAttentionSources = [...new Set(attentionSources)];
  const attentionCount = dedupedAttentionSources.length;
  const latestLifecycleKind = latestForwardLifecycleEntry?.kind ?? null;
  const latestUpdatedAt =
    latestForwardLifecycleEntry?.timestamp ??
    activeControl?.timestamp ??
    input.resultFlow.latestUpdatedAt ??
    input.requestPosture.latestAcknowledgedAt ??
    input.requestPosture.latestRequestedAt ??
    null;
  const checkpointKey =
    activeControl?.checkpointKey ??
    openTakeoverFollowThrough?.checkpointKey ??
    input.requestLifecycleEntries.find((item) => item.kind === "takeover_requested")?.checkpointKey ??
    input.requestLifecycleEntries.find((item) => item.kind === "human_input_requested")?.checkpointKey ??
    latestForwardLifecycleEntry?.checkpointKey ??
    null;
  const currentOwner = activeControl?.actorName ?? openTakeoverFollowThrough?.actorName ?? null;

  let state: HelmV21RunThreadForwardFlowState = "idle";
  if (input.lifecycle === "closed") {
    state = "closed";
  } else if (activeControl) {
    state = "active_control";
  } else if (openTakeoverFollowThrough) {
    state = "lifecycle_closeout";
  } else if (input.requestPosture.activeRequestCount > 0) {
    state = "request_open";
  } else if (input.resultFlow.requiresOperatorAttentionCount > 0) {
    state = "result_attention";
  }

  let nextAction: string | null = null;
  if (state === "active_control") {
    nextAction = `Keep bounded operator control on ${checkpointKey ?? "the current thread anchor"} until the current review closes.`;
  } else if (state === "lifecycle_closeout") {
    nextAction =
      openTakeoverFollowThrough?.summary ||
      `Close the operator takeover follow-through on ${checkpointKey ?? "the current thread anchor"} before the thread is treated as settled.`;
  } else if (input.requestPosture.takeoverState === "requested") {
    nextAction = `Acknowledge or decline the operator takeover request on ${checkpointKey ?? "the current thread anchor"}.`;
  } else if (input.requestPosture.humanInputState === "requested") {
    nextAction = `Capture and acknowledge the required human input on ${checkpointKey ?? "the current checkpoint anchor"}.`;
  } else if (state === "result_attention") {
    if (input.resultFlow.latestState === "follow_through_open") {
      nextAction = `Close the remaining follow-through on ${input.resultFlow.latestSource ?? "the current downstream result"}.`;
    } else if (input.resultFlow.latestState === "pending") {
      nextAction = `Review and acknowledge the pending ${input.resultFlow.latestSource ?? "downstream"} result.`;
    } else if (input.resultFlow.latestState === "failed") {
      nextAction = `Review the failed ${input.resultFlow.latestSource ?? "downstream"} result before forward progress continues.`;
    } else if (input.resultFlow.latestState === "blocked") {
      nextAction = `Unblock the ${input.resultFlow.latestSource ?? "downstream"} result before forward progress continues.`;
    } else if (input.resultFlow.latestState === "deferred") {
      nextAction = `Re-open the deferred ${input.resultFlow.latestSource ?? "downstream"} result only after explicit review.`;
    }
  }

  const summary =
    state === "closed"
      ? "Run thread is closed; no further forward action is attached."
      : state === "active_control"
        ? `Forward flow is under bounded operator control with ${attentionCount} attention source(s) still visible.`
        : state === "lifecycle_closeout"
          ? `Forward flow stays in lifecycle closeout with ${attentionCount} attention source(s) still visible after bounded operator control was released.`
        : state === "request_open"
          ? `Forward flow is waiting on ${attentionCount} open request source(s) before bounded progress continues.`
          : state === "result_attention"
            ? `Forward flow stays review-first with ${attentionCount} attention source(s) still open. Latest downstream state is ${input.resultFlow.latestState}.`
            : "No open forward action is attached to this run thread yet.";

  return {
    summary,
    boundaryNote: RUN_THREAD_FORWARD_FLOW_BOUNDARY_NOTE,
    state,
    latestLifecycleKind,
    latestUpdatedAt,
    checkpointKey,
    currentOwner,
    nextAction,
    attentionCount,
    attentionSources: dedupedAttentionSources,
  };
}

function buildCloseoutFlow(input: {
  requestLifecycleEntries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>;
  closeoutResolutionEntries: NonNullable<RunThreadContractInput["closeoutResolutionEntries"]>;
  closeoutResolutionFollowThroughEntries: NonNullable<
    RunThreadContractInput["closeoutResolutionFollowThroughEntries"]
  >;
  resultFlow: HelmV21RunThreadResultFlow;
  closeRequest?: HelmV21RunThreadCloseRequest | null;
}): HelmV21RunThreadCloseoutFlow {
  const lifecycleEntries = [...input.requestLifecycleEntries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latestFollowThroughRequest =
    lifecycleEntries.find((item) => item.kind === "takeover_followthrough_requested") ?? null;
  const latestFollowThroughResolution =
    lifecycleEntries.find((item) => item.kind === "takeover_followthrough_resolved") ?? null;

  const operatorTakeoverSourceEntry: HelmV21RunThreadCloseoutFlowSourceEntry | null =
    latestFollowThroughRequest &&
    (!latestFollowThroughResolution ||
      latestFollowThroughRequest.timestamp.getTime() >
        latestFollowThroughResolution.timestamp.getTime())
      ? {
          source: "operator_takeover_followthrough",
          state: "open",
          summary: latestFollowThroughRequest.summary,
          actorName: latestFollowThroughRequest.actorName ?? null,
          checkpointKey: latestFollowThroughRequest.checkpointKey,
          referenceId: latestFollowThroughRequest.id,
          updatedAt: latestFollowThroughRequest.timestamp,
        }
      : latestFollowThroughResolution
        ? {
            source: "operator_takeover_followthrough",
            state: "resolved",
            summary: latestFollowThroughResolution.summary,
            actorName: latestFollowThroughResolution.actorName ?? null,
            checkpointKey: latestFollowThroughResolution.checkpointKey,
            referenceId: latestFollowThroughResolution.id,
            updatedAt: latestFollowThroughResolution.timestamp,
          }
        : null;

  const resolutionEntries = [...input.closeoutResolutionEntries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latestCloseoutResolution = resolutionEntries[0] ?? null;
  const resolutionFollowThroughEntries = [...input.closeoutResolutionFollowThroughEntries].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime(),
  );
  const latestResolutionFollowThroughRequest =
    resolutionFollowThroughEntries.find(
      (item) => item.kind === "closeout_resolution_followthrough_requested",
    ) ?? null;
  const latestResolutionFollowThroughResolution =
    resolutionFollowThroughEntries.find(
      (item) => item.kind === "closeout_resolution_followthrough_resolved",
    ) ?? null;
  const latestResolutionRecordedAt = latestCloseoutResolution?.timestamp.getTime() ?? 0;
  const resolutionFollowThroughIsCurrent =
    !latestCloseoutResolution ||
    (resolutionFollowThroughEntries[0]?.timestamp.getTime() ?? 0) >= latestResolutionRecordedAt;
  const closeoutResolutionSourceEntry: HelmV21RunThreadCloseoutFlowSourceEntry | null =
    resolutionFollowThroughIsCurrent &&
    latestResolutionFollowThroughRequest &&
    (!latestResolutionFollowThroughResolution ||
      latestResolutionFollowThroughRequest.timestamp.getTime() >
        latestResolutionFollowThroughResolution.timestamp.getTime())
      ? {
          source: "closeout_resolution_followthrough",
          state: "open",
          summary: latestResolutionFollowThroughRequest.summary,
          actorName: latestResolutionFollowThroughRequest.actorName ?? null,
          checkpointKey: latestResolutionFollowThroughRequest.checkpointKey,
          referenceId: latestResolutionFollowThroughRequest.id,
          updatedAt: latestResolutionFollowThroughRequest.timestamp,
        }
      : resolutionFollowThroughIsCurrent && latestResolutionFollowThroughResolution
        ? {
            source: "closeout_resolution_followthrough",
            state: "resolved",
            summary: latestResolutionFollowThroughResolution.summary,
            actorName: latestResolutionFollowThroughResolution.actorName ?? null,
            checkpointKey: latestResolutionFollowThroughResolution.checkpointKey,
            referenceId: latestResolutionFollowThroughResolution.id,
            updatedAt: latestResolutionFollowThroughResolution.timestamp,
          }
        : null;

  const resultSourceEntries: HelmV21RunThreadCloseoutFlowSourceEntry[] = input.resultFlow.sourceEntries
    .filter(
      (item) => item.state === "follow_through_open" || item.state === "follow_through_resolved",
    )
    .map((item) => ({
      source: item.source,
      state: item.state === "follow_through_open" ? "open" : "resolved",
      summary: item.summary,
      actorName: null,
      checkpointKey: null,
      referenceId: item.referenceId,
      updatedAt: item.updatedAt,
    }));

  const closeRequestSourceEntry: HelmV21RunThreadCloseoutFlowSourceEntry | null =
    input.closeRequest?.state === "open"
      ? {
          source: "close_request",
          state: "open",
          summary: input.closeRequest.summary,
          actorName: input.closeRequest.requestedBy,
          checkpointKey: input.closeRequest.checkpointKey,
          referenceId: input.closeRequest.requestEventId ?? "close_request:open",
          updatedAt: input.closeRequest.requestedAt ?? new Date(0),
        }
      : input.closeRequest?.state === "resolved"
        ? {
            source: "close_request",
            state: "resolved",
            summary: input.closeRequest.summary,
            actorName: input.closeRequest.requestedBy,
            checkpointKey: input.closeRequest.checkpointKey,
            referenceId: input.closeRequest.requestEventId ?? "close_request:resolved",
            updatedAt: input.closeRequest.resolvedAt ?? input.closeRequest.requestedAt ?? new Date(0),
          }
        : null;

  const sourceEntries = [
    operatorTakeoverSourceEntry,
    closeoutResolutionSourceEntry,
    closeRequestSourceEntry,
    ...resultSourceEntries,
  ]
    .filter((item): item is HelmV21RunThreadCloseoutFlowSourceEntry => item !== null)
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const latest = sourceEntries[0] ?? null;
  const openCount = sourceEntries.filter((item) => item.state === "open").length;
  const resolvedCount = sourceEntries.filter((item) => item.state === "resolved").length;

  if (!latest) {
    return {
      summary:
        "No operator takeover closeout, explicit close request, explicit closeout-resolution follow-through, or downstream result follow-through is attached to this run thread yet.",
      boundaryNote: RUN_THREAD_CLOSEOUT_FLOW_BOUNDARY_NOTE,
      state: "idle",
      latestSource: null,
      latestUpdatedAt: null,
      currentOwner: null,
      checkpointKey: null,
      nextAction: null,
      openCount,
      resolvedCount,
      sourceEntries,
    };
  }

  const state = openCount > 0 ? "open" : "resolved";
  const nextAction =
    state === "open"
      ? latest.summary ||
        `Close the remaining ${latest.source} follow-through before the thread is treated as settled.`
      : null;

  return {
    summary:
      state === "open"
        ? `Closeout flow keeps ${openCount} open closeout source(s) and ${resolvedCount} resolved source(s). Latest closeout is ${latest.source}.`
        : `Closeout flow is resolved. ${resolvedCount} closeout source(s) were completed, latest from ${latest.source}.`,
    boundaryNote: RUN_THREAD_CLOSEOUT_FLOW_BOUNDARY_NOTE,
    state,
    latestSource: latest.source,
    latestUpdatedAt: latest.updatedAt,
    currentOwner: latest.actorName,
    checkpointKey: latest.checkpointKey,
    nextAction,
    openCount,
    resolvedCount,
    sourceEntries,
  };
}

function buildSettlementFlow(input: {
  lifecycle: HelmV21RunThreadLifecycleState;
  lifecycleLog: HelmV21RunThreadLifecycleEntry[];
  requestPosture: HelmV21RunThreadRequestPosture;
  requestLifecycleEntries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>;
  resultAcknowledgement: HelmV21RunThreadResultAcknowledgement;
  resultFlow: HelmV21RunThreadResultFlow;
  forwardFlow: HelmV21RunThreadForwardFlow;
  closeoutFlow: HelmV21RunThreadCloseoutFlow;
  settlementReview: HelmV21RunThreadSettlementReview;
}): HelmV21RunThreadSettlementFlow {
  const latestLifecycleAt =
    input.lifecycleLog.find((item) => item.kind !== "closeout_resolution_recorded")?.timestamp ?? null;
  const latestUpdatedAt =
    [input.closeoutFlow.latestUpdatedAt, input.forwardFlow.latestUpdatedAt, input.resultFlow.latestUpdatedAt, latestLifecycleAt]
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

  if (input.lifecycle === "closed") {
    return {
      summary: "Run thread is already closed; settlement no longer has open work.",
      boundaryNote: RUN_THREAD_SETTLEMENT_FLOW_BOUNDARY_NOTE,
      state: "closed",
      driver: "lifecycle",
      latestUpdatedAt,
      currentOwner: null,
      checkpointKey: input.closeoutFlow.checkpointKey ?? input.forwardFlow.checkpointKey,
      nextAction: null,
      forwardAttentionCount: input.forwardFlow.attentionCount,
      openCloseoutCount: input.closeoutFlow.openCount,
      resolvedCloseoutCount: input.closeoutFlow.resolvedCount,
    };
  }

  if (input.closeoutFlow.state === "open") {
    return {
      summary: `Settlement is waiting on ${input.closeoutFlow.openCount} open closeout source(s) before the thread can be treated as ready to close.`,
      boundaryNote: RUN_THREAD_SETTLEMENT_FLOW_BOUNDARY_NOTE,
      state: "closeout_open",
      driver: "closeout_flow",
      latestUpdatedAt,
      currentOwner: input.closeoutFlow.currentOwner,
      checkpointKey: input.closeoutFlow.checkpointKey,
      nextAction:
        input.closeoutFlow.nextAction ??
        "Close the remaining thread-level closeout work before the run thread is treated as ready to close.",
      forwardAttentionCount: input.forwardFlow.attentionCount,
      openCloseoutCount: input.closeoutFlow.openCount,
      resolvedCloseoutCount: input.closeoutFlow.resolvedCount,
    };
  }

  if (input.settlementReview.state === "requested") {
    return {
      summary:
        input.settlementReview.summary ||
        "Settlement review is open and still needs explicit operator resolution.",
      boundaryNote: RUN_THREAD_SETTLEMENT_FLOW_BOUNDARY_NOTE,
      state: "review_open",
      driver: "settlement_review",
      latestUpdatedAt,
      currentOwner: input.settlementReview.requestedBy,
      checkpointKey: input.settlementReview.checkpointKey,
      nextAction:
        input.settlementReview.nextAction ??
        "Resolve the explicit settlement review before the run thread is treated as ready to close.",
      forwardAttentionCount: input.forwardFlow.attentionCount,
      openCloseoutCount: input.closeoutFlow.openCount,
      resolvedCloseoutCount: input.closeoutFlow.resolvedCount,
    };
  }

  const { readyByResolvedCloseout, readyByResolvedResult } = isRunThreadReadyToClose({
    lifecycle: input.lifecycle,
    closeoutFlow: input.closeoutFlow,
    requestPosture: input.requestPosture,
    requestLifecycleEntries: input.requestLifecycleEntries,
    resultFlow: input.resultFlow,
    resultAcknowledgement: input.resultAcknowledgement,
  });

  if (
    input.settlementReview.state === "resolved" ||
    readyByResolvedCloseout ||
    readyByResolvedResult
  ) {
    const driver: HelmV21RunThreadSettlementFlowDriver =
      input.settlementReview.state === "resolved"
        ? "settlement_review"
        : readyByResolvedCloseout
          ? "closeout_flow"
          : "result_flow";
    return {
      summary:
        input.settlementReview.state === "resolved"
          ? input.settlementReview.summary ||
            "Explicit settlement review is resolved. The thread is ready to close after bounded operator review."
          : readyByResolvedCloseout
            ? `All tracked closeout work is resolved. The thread is ready to close after explicit operator review.`
            : `Latest downstream result posture is resolved and no open forward or closeout work remains. The thread is ready to close after explicit operator review.`,
      boundaryNote: RUN_THREAD_SETTLEMENT_FLOW_BOUNDARY_NOTE,
      state: "ready_to_close",
      driver,
      latestUpdatedAt,
      currentOwner:
        input.settlementReview.resolvedBy ??
        input.closeoutFlow.currentOwner ??
        input.forwardFlow.currentOwner,
      checkpointKey:
        input.settlementReview.checkpointKey ??
        input.closeoutFlow.checkpointKey ??
        input.forwardFlow.checkpointKey,
      nextAction:
        input.settlementReview.nextAction ??
        "Close the run thread only after operator review confirms the settlement summary is complete and no broader authority is implied.",
      forwardAttentionCount: input.forwardFlow.attentionCount,
      openCloseoutCount: input.closeoutFlow.openCount,
      resolvedCloseoutCount: input.closeoutFlow.resolvedCount,
    };
  }

  return {
    summary:
      input.forwardFlow.state === "idle"
        ? "Settlement is still active. Keep the run thread open until explicit settlement evidence or a bounded closeout signal is recorded."
        : `Settlement is still active because forward flow remains ${input.forwardFlow.state} with ${input.forwardFlow.attentionCount} attention source(s).`,
    boundaryNote: RUN_THREAD_SETTLEMENT_FLOW_BOUNDARY_NOTE,
    state: "active",
    driver: input.forwardFlow.state === "idle" ? "lifecycle" : "forward_flow",
    latestUpdatedAt,
    currentOwner: input.forwardFlow.currentOwner,
    checkpointKey: input.forwardFlow.checkpointKey,
    nextAction:
      input.forwardFlow.nextAction ??
      "Keep the run thread open until explicit settlement evidence or closeout truth is recorded.",
    forwardAttentionCount: input.forwardFlow.attentionCount,
    openCloseoutCount: input.closeoutFlow.openCount,
    resolvedCloseoutCount: input.closeoutFlow.resolvedCount,
  };
}

function buildLifecycleLog(input: {
  threadId: string;
  stageKey: string;
  startedAt: Date;
  closedAt: Date | null;
  checkpointLineage: HelmV21RunThreadCheckpointLineageEntry[];
  handoffPackets: NonNullable<RunThreadContractInput["handoffPackets"]>;
  remediationTrace: NonNullable<RunThreadContractInput["remediationTrace"]>;
  requestLifecycleEntries: NonNullable<RunThreadContractInput["requestLifecycleEntries"]>;
  settlementReviewEntries: NonNullable<RunThreadContractInput["settlementReviewEntries"]>;
  closeoutConfirmationEntries: NonNullable<RunThreadContractInput["closeoutConfirmationEntries"]>;
  closeoutRefreshEntries: NonNullable<RunThreadContractInput["closeoutRefreshEntries"]>;
  closeoutResolutionEntries: NonNullable<RunThreadContractInput["closeoutResolutionEntries"]>;
  closeoutResolutionFollowThroughEntries: NonNullable<
    RunThreadContractInput["closeoutResolutionFollowThroughEntries"]
  >;
  closeRequestEntries: NonNullable<RunThreadContractInput["closeRequestEntries"]>;
  resultAcknowledgements: NonNullable<RunThreadContractInput["resultAcknowledgements"]>;
}): HelmV21RunThreadLifecycleEntry[] {
  const entries: HelmV21RunThreadLifecycleEntry[] = [
    {
      id: `${input.threadId}:started`,
      kind: "run_started",
      label: "run_started",
      summary: `Run thread ${input.threadId} started at stage ${input.stageKey}.`,
      timestamp: input.startedAt,
      checkpointKey: null,
      source: "run_thread",
    },
    ...input.checkpointLineage.map((checkpoint) => ({
      id: `${checkpoint.checkpointId}:${checkpoint.lineageRole}`,
      kind:
        checkpoint.lineageRole === "resume_anchor" || checkpoint.state === "resumed"
          ? ("checkpoint_resumed" as const)
          : ("checkpoint_written" as const),
      label: checkpoint.label,
      summary: `${checkpoint.lineageRole} · ${checkpoint.state} · ${checkpoint.summary}`,
      timestamp: checkpoint.updatedAt,
      checkpointKey: checkpoint.checkpointKey,
      source: "checkpoint_lineage" as const,
    })),
    ...input.handoffPackets.map((packet) => ({
      id: packet.id,
      kind: "handoff_created" as const,
      label: `${packet.fromAgent} -> ${packet.toAgent}`,
      summary: `${packet.goal} · ${packet.approvalTier}${packet.checkpointRef ? ` · checkpoint ${packet.checkpointRef}` : ""}`,
      timestamp: packet.createdAt,
      checkpointKey: packet.checkpointRef ?? null,
      source: "handoff_packet" as const,
    })),
    ...input.remediationTrace.map((item) => ({
      id: item.id,
      kind: "continuity_remediation" as const,
      label: `${item.action} · ${item.executionStatus}`,
      summary: item.rollbackAnchorSummary
        ? `${item.summary} Rollback anchor: ${item.rollbackAnchorSummary}.`
        : item.summary,
      timestamp: item.createdAt,
      checkpointKey: null,
      source: "continuity_remediation" as const,
    })),
    ...input.requestLifecycleEntries.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: item.checkpointKey,
      source: "debugger_request" as const,
    })),
    ...input.settlementReviewEntries.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.kind,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: item.checkpointKey,
      source: "settlement_review" as const,
    })),
    ...input.closeoutConfirmationEntries.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.kind,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: item.checkpointKey,
      source: "closeout_confirmation" as const,
    })),
    ...input.closeoutRefreshEntries.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.kind,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: item.checkpointKey,
      source: "closeout_refresh" as const,
    })),
    ...input.closeoutResolutionEntries.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: `${item.kind} · ${item.decision}`,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: item.checkpointKey,
      source: "closeout_resolution" as const,
    })),
    ...input.closeoutResolutionFollowThroughEntries.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: `${item.kind} · ${item.decision}`,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: item.checkpointKey,
      source: "closeout_resolution_followthrough" as const,
    })),
    ...input.closeRequestEntries.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.kind,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: item.checkpointKey,
      source: "close_request" as const,
    })),
    ...input.resultAcknowledgements.map((item) => ({
      id: item.id,
      kind: "result_acknowledged" as const,
      label: `${item.source} · ${item.state}`,
      summary: item.summary,
      timestamp: item.timestamp,
      checkpointKey: null,
      source: "result_acknowledgement" as const,
    })),
    ...(input.closedAt
      ? [
          {
            id: `${input.threadId}:closed`,
            kind: "run_closed" as const,
            label: "run_closed",
            summary: `Run thread ${input.threadId} closed.`,
            timestamp: input.closedAt,
            checkpointKey: null,
            source: "run_thread" as const,
          },
        ]
      : []),
  ];

  return entries.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime()).slice(0, 12);
}

export function buildRunThreadContract(input: RunThreadContractInput): HelmV21RunThreadContract {
  const runStatus = normalizeRuntimeSessionState(input.status);
  const checkpoints = dedupeAndSortCheckpoints(input.checkpoints).map(buildCheckpointContract);
  const latestCheckpoint = checkpoints[0] ?? null;
  const resumedFromCheckpoint =
    checkpoints.find((checkpoint) => checkpoint.checkpointKey === input.resumedFromKey) ?? null;
  const replay = parseReplayEventLog(input.replayableEventLog);
  const checkpointLineage = buildCheckpointLineage({
    checkpoints,
    resumedFromKey: input.resumedFromKey ?? null,
  });
  const lifecycle = deriveLifecycle({
    runStatus,
    latestCheckpoint,
    resumedFromKey: input.resumedFromKey ?? null,
    closedAt: input.closedAt ?? null,
  });
  const requestPosture = buildRequestPosture({
    entries: input.requestLifecycleEntries ?? [],
  });
  const resultAcknowledgement = buildResultAcknowledgement({
    entries: input.resultAcknowledgements ?? [],
    boundaryNote: input.boundaryNote,
  });
  const resultFlow = buildResultFlow({
    entries: input.resultAcknowledgements ?? [],
  });
  const baseCloseoutFlow = buildCloseoutFlow({
    requestLifecycleEntries: input.requestLifecycleEntries ?? [],
    closeoutResolutionEntries: input.closeoutResolutionEntries ?? [],
    closeoutResolutionFollowThroughEntries:
      input.closeoutResolutionFollowThroughEntries ?? [],
    resultFlow,
    closeRequest: null,
  });
  const settlementReview = buildSettlementReview({
    lifecycle,
    latestCheckpoint,
    settlementReviewEntries: input.settlementReviewEntries ?? [],
    closeoutFlow: baseCloseoutFlow,
    requestPosture,
    requestLifecycleEntries: input.requestLifecycleEntries ?? [],
    resultFlow,
    resultAcknowledgement,
  });
  const lifecycleLog = buildLifecycleLog({
    threadId: input.sessionKey,
    stageKey: input.currentStage,
    startedAt: input.createdAt,
    closedAt: input.closedAt ?? null,
    checkpointLineage,
    handoffPackets: input.handoffPackets ?? [],
    remediationTrace: input.remediationTrace ?? [],
    requestLifecycleEntries: input.requestLifecycleEntries ?? [],
    settlementReviewEntries: input.settlementReviewEntries ?? [],
    closeoutConfirmationEntries: input.closeoutConfirmationEntries ?? [],
    closeoutRefreshEntries: input.closeoutRefreshEntries ?? [],
    closeoutResolutionEntries: input.closeoutResolutionEntries ?? [],
    closeoutResolutionFollowThroughEntries:
      input.closeoutResolutionFollowThroughEntries ?? [],
    closeRequestEntries: input.closeRequestEntries ?? [],
    resultAcknowledgements: input.resultAcknowledgements ?? [],
  });
  const forwardFlow = buildForwardFlow({
    lifecycle,
    lifecycleLog,
    requestPosture,
    requestLifecycleEntries: input.requestLifecycleEntries ?? [],
    resultFlow,
  });
  const baseSettlementFlow = buildSettlementFlow({
    lifecycle,
    lifecycleLog,
    requestPosture,
    requestLifecycleEntries: input.requestLifecycleEntries ?? [],
    resultAcknowledgement,
    resultFlow,
    forwardFlow,
    closeoutFlow: baseCloseoutFlow,
    settlementReview,
  });
  const closeoutConfirmation = buildCloseoutConfirmation({
    lifecycle,
    latestCheckpoint,
    settlementReview,
    settlementFlow: baseSettlementFlow,
    closeoutResolutionEntries: input.closeoutResolutionEntries ?? [],
    closeoutConfirmationEntries: input.closeoutConfirmationEntries ?? [],
  });
  const closeoutRefresh = buildCloseoutRefresh({
    lifecycle,
    latestCheckpoint,
    closeoutConfirmation,
    closeoutRefreshEntries: input.closeoutRefreshEntries ?? [],
  });
  const closeoutSummary = buildCloseoutSummary({
    lifecycle,
    closeoutFlow: baseCloseoutFlow,
    settlementReview,
    closeoutConfirmation,
    closeoutRefresh,
  });
  const closeoutResolution = buildCloseoutResolution({
    lifecycle,
    closeoutSummary,
    closeoutConfirmation,
    closeoutRefresh,
    closeoutResolutionEntries: input.closeoutResolutionEntries ?? [],
  });
  const closeoutResolutionFollowThrough = buildCloseoutResolutionFollowThrough({
    closeoutResolution,
    closeoutResolutionFollowThroughEntries:
      input.closeoutResolutionFollowThroughEntries ?? [],
  });
  const closeoutOutcome = buildCloseoutOutcome({
    lifecycle,
    closedAt: input.closedAt ?? null,
    closeoutSummary,
    closeoutResolution,
    closeoutResolutionFollowThrough,
  });
  const closeRequest = buildCloseRequest({
    lifecycle,
    closedAt: input.closedAt ?? null,
    closeoutOutcome,
    closeRequestEntries: input.closeRequestEntries ?? [],
  });
  const closeLifecycle = buildCloseLifecycle({
    lifecycle,
    closeoutSummary,
    closeoutResolution,
    closeoutResolutionFollowThrough,
    closeoutOutcome,
    closeRequest,
  });
  const closeoutFlow = buildCloseoutFlow({
    requestLifecycleEntries: input.requestLifecycleEntries ?? [],
    closeoutResolutionEntries: input.closeoutResolutionEntries ?? [],
    closeoutResolutionFollowThroughEntries:
      input.closeoutResolutionFollowThroughEntries ?? [],
    resultFlow,
    closeRequest,
  });
  const settlementFlow = buildSettlementFlow({
    lifecycle,
    lifecycleLog,
    requestPosture,
    requestLifecycleEntries: input.requestLifecycleEntries ?? [],
    resultAcknowledgement,
    resultFlow,
    forwardFlow,
    closeoutFlow,
    settlementReview,
  });
  const closeControl = buildCloseControl({
    lifecycle,
    closeoutSummary,
    closeLifecycle,
    settlementFlow,
  });
  const closeControlFlow = buildCloseControlFlow({
    lifecycle,
    closeControl,
    settlementFlow,
    forwardFlow,
  });
  const closeDecisionFlow = buildCloseDecisionFlow({
    lifecycle,
    closeControlFlow,
    closeoutOutcome,
    closeRequest,
  });
  const closeDecisionControlSummary = buildCloseDecisionControlSummary({
    lifecycle,
    closeLifecycle,
    closeControlFlow,
    closeDecisionFlow,
    forwardFlow,
  });
  const closeResolutionSummary = buildCloseResolutionSummary({
    lifecycle,
    closeDecisionControlSummary,
    closeLifecycle,
    closeRequest,
  });
  const closeResolutionForwardSummary = buildCloseResolutionForwardSummary({
    lifecycle,
    closeResolutionSummary,
    closeDecisionControlSummary,
    settlementFlow,
    forwardFlow,
  });
  const closeResolutionControlSummary = buildCloseResolutionControlSummary({
    lifecycle,
    closeResolutionSummary,
    closeResolutionForwardSummary,
    closeLifecycle,
    closeRequest,
  });
  const closePostureSummary = buildClosePostureSummary({
    lifecycle,
    closeResolutionControlSummary,
    closeResolutionForwardSummary,
    closeLifecycle,
    closeRequest,
  });
  const closePostureForwardSummary = buildClosePostureForwardSummary({
    lifecycle,
    closePostureSummary,
    closeResolutionForwardSummary,
    settlementFlow,
    forwardFlow,
    closeRequest,
  });
  const resumeState = deriveResumeState({
    latestCheckpoint,
    resumedFromKey: input.resumedFromKey ?? null,
  });
  const resume = {
    state: resumeState,
    resumeToken:
      input.resumedFromKey ??
      (latestCheckpoint?.state === "ready" ? latestCheckpoint.resumeToken : null),
    resumedFromCheckpointId: resumedFromCheckpoint?.checkpointId ?? null,
    resumedFromCheckpointKey: resumedFromCheckpoint?.checkpointKey ?? null,
  } as const;
  const replayRequest = buildReplayRequest({
    latestCheckpoint,
    resumedFromCheckpoint,
    replay,
  });
  const humanInputCheckpoint = buildHumanInputCheckpoint({
    latestCheckpoint,
    boundaryNote: input.boundaryNote,
  });
  const swarmSpawnBudgetEnvelope = buildSwarmSpawnBudgetEnvelope({
    taskClass: "read_only_worker",
    budget: input.swarmBudgetEnvelope ?? null,
  });
  const swarmSpawnRequest = buildSwarmSpawnRequest({
    lifecycle,
    swarmReadOnlyWorkersEnabled: input.swarmReadOnlyWorkersEnabled ?? false,
    budgetEnvelope: swarmSpawnBudgetEnvelope,
    latestCheckpoint,
    requestEvent: input.swarmSpawnRequestEvent ?? null,
  });
  const swarmSpawnContract = buildSwarmSpawnContract({
    lifecycle,
    budgetEnvelope: swarmSpawnBudgetEnvelope,
    request: swarmSpawnRequest,
  });
  const swarmReadOnlyWorkerContract = buildSwarmReadOnlyWorkerContract({
    workspaceId: input.workspaceId,
    meetingId: input.meetingId ?? null,
    opportunityId: input.opportunityId ?? null,
    companyId: input.companyId ?? null,
    swarmSpawnContract,
    swarmReadOnlyWorkerIntentEvent: input.swarmReadOnlyWorkerIntentEvent ?? null,
    swarmReadOnlyWorkerPlaceholderEvent: input.swarmReadOnlyWorkerPlaceholderEvent ?? null,
    swarmReadOnlyWorkerExecutionEvent: input.swarmReadOnlyWorkerExecutionEvent ?? null,
    swarmReadOnlyWorkerMaterializationEvent: input.swarmReadOnlyWorkerMaterializationEvent ?? null,
    swarmReadOnlyWorkerAdoptionEvent: input.swarmReadOnlyWorkerAdoptionEvent ?? null,
  });
  const swarmVerificationMergeLaneContract = buildSwarmVerificationMergeLaneContract({
    resultAdoptionResultSideContract: swarmReadOnlyWorkerContract.resultAdoptionResultSideContract,
    outputAdoptionEventId: swarmReadOnlyWorkerContract.outputAdoptionEventId,
    checkpointId: swarmSpawnContract.checkpointId,
    checkpointKey: swarmSpawnContract.checkpointKey,
    verification: input.verification ?? null,
    truthConflicts: input.truthConflicts ?? [],
    swarmVerificationMergeLaneEvent: input.swarmVerificationMergeLaneEvent ?? null,
  });
  const persistedControlPlaneLifecycle = buildRunThreadPersistedControlPlaneLifecycle({
    runThread: {
      runId: input.id,
      threadId: input.sessionKey,
      stageKey: input.currentStage,
      updatedAt: input.updatedAt,
      lifecycle,
      resume,
      latestCheckpoint,
      checkpointLineage,
      replay,
      replayRequest,
      requestPosture,
      humanInputCheckpoint,
      resultAcknowledgement,
      resultFlow,
      forwardFlow,
      settlementReview,
      closeoutSummary,
      closeoutResolution,
      closeoutResolutionFollowThrough,
      closeoutOutcome,
      closeRequest,
      closeLifecycle,
      closeControl,
      closeControlFlow,
      closeDecisionFlow,
      closeDecisionControlSummary,
      closeResolutionSummary,
      closeResolutionForwardSummary,
      closeResolutionControlSummary,
      closePostureSummary,
      closePostureForwardSummary,
    },
    snapshot: input.persistedControlPlaneLifecycle?.snapshot ?? null,
    parseFailed: input.persistedControlPlaneLifecycle?.parseFailed ?? false,
  });

  return {
    runId: input.id,
    threadId: input.sessionKey,
    runStatus,
    lifecycle,
    stageKey: input.currentStage,
    boundaryNote: input.boundaryNote,
    sourcePage: input.sourcePage ?? null,
    objectRefs: {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId ?? null,
      opportunityId: input.opportunityId ?? null,
      companyId: input.companyId ?? null,
    },
    latestCheckpoint,
    resume,
    replay,
    requestPosture,
    resultAcknowledgement,
    resultFlow,
    forwardFlow,
    closeoutFlow,
    closeoutSummary,
    closeoutResolution,
    closeoutResolutionFollowThrough,
    closeoutOutcome,
    closeRequest,
    closeLifecycle,
    closeControl,
    closeControlFlow,
    closeDecisionFlow,
    closeDecisionControlSummary,
    closeResolutionSummary,
    closeResolutionForwardSummary,
    closeResolutionControlSummary,
    closePostureSummary,
    closePostureForwardSummary,
    settlementReview,
    closeoutConfirmation,
    closeoutRefresh,
    settlementFlow,
    persistedControlPlaneLifecycle,
    lifecycleLog,
    checkpointLineage,
    replayRequest,
    humanInputCheckpoint,
    swarmSpawnBudgetEnvelope,
    swarmSpawnRequest,
    swarmSpawnContract,
    swarmReadOnlyWorkerContract,
    swarmVerificationMergeLaneContract,
    startedAt: input.createdAt,
    updatedAt: input.updatedAt,
    closedAt: input.closedAt ?? null,
  };
}
