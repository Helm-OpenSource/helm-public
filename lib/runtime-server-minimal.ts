export type RuntimeServerMinimalEventKind =
  | "lifecycle_event"
  | "review_request"
  | "acknowledgement"
  | "monitor_event"
  | "handoff";

export type RuntimeServerMinimalLifecycleState =
  | "missing"
  | "created"
  | "running"
  | "waiting_for_review"
  | "acknowledged"
  | "handoff_ready"
  | "closed"
  | "blocked";

export type RuntimeServerMinimalPosture =
  | "ready"
  | "review_required"
  | "blocked";

export type RuntimeServerMinimalReviewState =
  | "not_requested"
  | "requested"
  | "acknowledged"
  | "blocked";

export type RuntimeServerMinimalAcknowledgementState =
  | "not_seen"
  | "received"
  | "success_confirmed"
  | "failure_reported"
  | "needs_review";

export type RuntimeServerMinimalMonitorSeverity =
  | "ok"
  | "watch"
  | "escalate"
  | "blocked";

export type RuntimeServerMinimalHandoffState =
  | "not_ready"
  | "ready"
  | "delivered"
  | "blocked";

export type RuntimeServerMinimalSourceStepName =
  | RuntimeServerMinimalEventKind
  | "worker_queue"
  | "authority_boundary";

export type RuntimeServerMinimalSourceOutcome = "pass" | "warn" | "block";

export type RuntimeServerMinimalEventInput = {
  eventKey: string;
  kind: RuntimeServerMinimalEventKind;
  threadKey: string;
  sourceRef: string | null;
  occurredAt?: Date | string;
  summary: string;
  lifecycleState?: Exclude<RuntimeServerMinimalLifecycleState, "missing">;
  reviewState?: Exclude<RuntimeServerMinimalReviewState, "not_requested">;
  acknowledgement?: {
    acknowledgementStatus: "received" | "success" | "failure" | "needs_review";
    acknowledgementEventId?: string | null;
    receiptRef?: string | null;
    officialSuccess?: boolean;
  };
  monitor?: {
    severity: RuntimeServerMinimalMonitorSeverity;
    reasonCode: string;
    routeToReview?: boolean;
  };
  handoff?: {
    handoffId?: string | null;
    target: string;
    delivered?: boolean;
  };
};

export type RuntimeServerMinimalThreadInput = {
  threadKey: string;
  surface: "/operating" | "automation" | "extension_runtime" | "runtime_api" | "local_harness";
  generatedAt?: Date | string;
  events: RuntimeServerMinimalEventInput[];
};

export type RuntimeServerMinimalSourceStep = {
  step: RuntimeServerMinimalSourceStepName;
  sourceType: string;
  sourceRef: string | null;
  outcome: RuntimeServerMinimalSourceOutcome;
  note: string;
};

export type RuntimeWorkerQueueItemKind =
  | "lifecycle_projection"
  | "review_request_projection"
  | "acknowledgement_reconciliation"
  | "monitor_event_projection"
  | "handoff_projection";

export type RuntimeWorkerQueueEffect =
  | "local_reducer"
  | "operator_review"
  | "remote_execution"
  | "real_sandbox"
  | "swarm_ui"
  | "external_side_effect";

export type RuntimeWorkerQueuePriority = "low" | "normal" | "high";
export type RuntimeWorkerQueueStatus =
  | "pending"
  | "leased"
  | "completed"
  | "dead_letter"
  | "blocked";

export type RuntimeWorkerQueueItemInput = {
  itemKey: string;
  idempotencyKey: string;
  threadKey: string;
  sourceEventKey: string;
  kind: RuntimeWorkerQueueItemKind;
  effect: RuntimeWorkerQueueEffect;
  priority?: RuntimeWorkerQueuePriority;
  createdAt?: Date | string;
  summary: string;
};

export type RuntimeWorkerQueueItem = RuntimeWorkerQueueItemInput & {
  createdAt: string;
  priority: RuntimeWorkerQueuePriority;
  status: RuntimeWorkerQueueStatus;
  attempts: number;
  leaseToken: string | null;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  blockedReason: string | null;
  completedAt: string | null;
  resultSummary: string | null;
};

export type RuntimeWorkerQueueAdmission = {
  outcome: "accepted" | "duplicate" | "blocked";
  itemKey: string;
  idempotencyKey: string;
  queueDepth: number;
  reason: string;
  boundaryNotes: string[];
};

export type RuntimeWorkerQueueState = {
  pending: RuntimeWorkerQueueItem[];
  leased: RuntimeWorkerQueueItem[];
  completed: RuntimeWorkerQueueItem[];
  deadLetter: RuntimeWorkerQueueItem[];
  blocked: RuntimeWorkerQueueItem[];
  duplicateKeys: string[];
  audit: {
    queueName: "runtime-server-minimal-worker-queue";
    replaySafe: true;
  };
};

export type RuntimeWorkerQueueTick = {
  mode: "idle" | "local_reducer" | "operator_review";
  item: RuntimeWorkerQueueItem | null;
  leaseToken: string | null;
  operatorNextMove: string;
  forbiddenActions: string[];
  boundaryNotes: string[];
};

export type RuntimeWorkerQueueTickPlan = {
  state: RuntimeWorkerQueueState;
  tick: RuntimeWorkerQueueTick;
};

export type RuntimeServerMinimalThread = {
  threadKey: string;
  surface: RuntimeServerMinimalThreadInput["surface"];
  generatedAt: string;
  posture: RuntimeServerMinimalPosture;
  lifecycle: {
    state: RuntimeServerMinimalLifecycleState;
    latestEventKey: string | null;
    sourceRef: string | null;
  };
  reviewRequest: {
    state: RuntimeServerMinimalReviewState;
    requestKey: string | null;
    sourceRef: string | null;
    summary: string | null;
  };
  acknowledgement: {
    state: RuntimeServerMinimalAcknowledgementState;
    acknowledgementEventId: string | null;
    receiptRef: string | null;
    officialSuccess: boolean;
    summary: string | null;
  };
  monitor: {
    severity: RuntimeServerMinimalMonitorSeverity;
    eventKeys: string[];
    routeToReview: boolean;
    reasonCodes: string[];
  };
  handoff: {
    state: RuntimeServerMinimalHandoffState;
    handoffId: string | null;
    target: string | null;
    sourceRef: string | null;
  };
  workerQueueCandidates: RuntimeWorkerQueueItemInput[];
  sourceChain: RuntimeServerMinimalSourceStep[];
  operatorNextMove: string;
  boundaryNotes: string[];
  audit: {
    emittedBy: "runtime-server-minimal";
    replaySafe: true;
  };
};

export type RuntimeServerMinimalSummary = {
  generatedAt: string;
  totalThreads: number;
  postureCounts: Record<RuntimeServerMinimalPosture, number>;
  queueCounts: Record<RuntimeWorkerQueueStatus, number>;
  reviewThreadKeys: string[];
  blockedThreadKeys: string[];
  primaryNextMove: string;
  boundaryNotes: string[];
};

const REQUIRED_EVENT_KINDS: RuntimeServerMinimalEventKind[] = [
  "lifecycle_event",
  "review_request",
  "acknowledgement",
  "monitor_event",
  "handoff",
];

const LOCAL_EFFECTS: RuntimeWorkerQueueEffect[] = [
  "local_reducer",
  "operator_review",
];

const RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES = [
  "local runtime seam only",
  "运行时 server minimal 不创建 remote execution plane",
  "运行时 server minimal 不做真实 sandbox",
  "运行时 server minimal 不做 正在加温的 UI",
  "执行队列不执行外部副作用",
  "acknowledgement 不等于 正式成功 unless receipt truth 显式ly confirms success",
];

export function buildRuntimeServerMinimalThread(
  input: RuntimeServerMinimalThreadInput,
): RuntimeServerMinimalThread {
  const generatedAt = toIsoString(input.generatedAt ?? new Date());
  const events = normalizeEvents(input.events, input.threadKey);
  const lifecycle = resolveLifecycle(events);
  const reviewRequest = resolveReviewRequest(events);
  const acknowledgement = resolveAcknowledgement(events);
  const monitor = resolveMonitor(events);
  const handoff = resolveHandoff(events);
  const workerQueueCandidates = events.map((event) =>
    buildWorkerQueueCandidate(input.threadKey, event),
  );
  const posture = resolveThreadPosture({
    lifecycle,
    reviewRequest,
    acknowledgement,
    monitor,
    handoff,
  });

  return {
    threadKey: input.threadKey,
    surface: input.surface,
    generatedAt,
    posture,
    lifecycle,
    reviewRequest,
    acknowledgement,
    monitor,
    handoff,
    workerQueueCandidates,
    sourceChain: [
      ...REQUIRED_EVENT_KINDS.map((kind) => buildEventStep(kind, events)),
      {
        step: "worker_queue",
        sourceType: "local_worker_queue",
        sourceRef: workerQueueCandidates[0]?.itemKey ?? null,
        outcome: workerQueueCandidates.length > 0 ? "pass" : "warn",
        note: workerQueueCandidates.length > 0
          ? `Narrow worker queue has ${workerQueueCandidates.length} local projection candidates.`
          : "Narrow worker queue has no local projection candidate because the thread has no mapped events.",
      },
      {
        step: "authority_boundary",
        sourceType: "policy",
        sourceRef: "runtime_server_minimal_local_seam",
        outcome: "pass",
        note: "Runtime Server Minimal Implementation V1 is an in-process local seam and narrow worker queue; it does not run remote execution, real sandbox, swarm UI, scheduler, or external side effects.",
      },
    ],
    operatorNextMove: buildThreadOperatorNextMove(posture, {
      lifecycle,
      reviewRequest,
      acknowledgement,
      monitor,
      handoff,
    }),
    boundaryNotes: RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES,
    audit: {
      emittedBy: "runtime-server-minimal",
      replaySafe: true,
    },
  };
}

export function createRuntimeWorkerQueueState(): RuntimeWorkerQueueState {
  return {
    pending: [],
    leased: [],
    completed: [],
    deadLetter: [],
    blocked: [],
    duplicateKeys: [],
    audit: {
      queueName: "runtime-server-minimal-worker-queue",
      replaySafe: true,
    },
  };
}

export function enqueueRuntimeWorkerQueueItem(
  state: RuntimeWorkerQueueState,
  input: RuntimeWorkerQueueItemInput,
): { state: RuntimeWorkerQueueState; admission: RuntimeWorkerQueueAdmission } {
  const duplicate = findQueueItemByIdempotencyKey(state, input.idempotencyKey);
  if (duplicate) {
    const nextState = {
      ...cloneQueueState(state),
      duplicateKeys: uniqueStrings([...state.duplicateKeys, input.idempotencyKey]),
    };

    return {
      state: nextState,
      admission: {
        outcome: "duplicate",
        itemKey: duplicate.itemKey,
        idempotencyKey: input.idempotencyKey,
        queueDepth: queueDepth(nextState),
        reason: `Duplicate idempotency_key ${input.idempotencyKey} already maps to ${duplicate.itemKey}.`,
        boundaryNotes: RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES,
      },
    };
  }

  const item = buildQueueItem(input);
  if (!LOCAL_EFFECTS.includes(input.effect)) {
    const blockedItem: RuntimeWorkerQueueItem = {
      ...item,
      status: "blocked",
      blockedReason: blockedEffectReason(input.effect),
    };
    const nextState = {
      ...cloneQueueState(state),
      blocked: [...state.blocked, blockedItem],
    };

    return {
      state: nextState,
      admission: {
        outcome: "blocked",
        itemKey: input.itemKey,
        idempotencyKey: input.idempotencyKey,
        queueDepth: queueDepth(nextState),
        reason: blockedEffectReason(input.effect),
        boundaryNotes: RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES,
      },
    };
  }

  const nextState = {
    ...cloneQueueState(state),
    pending: sortPendingQueue([...state.pending, item]),
  };

  return {
    state: nextState,
    admission: {
      outcome: "accepted",
      itemKey: input.itemKey,
      idempotencyKey: input.idempotencyKey,
      queueDepth: queueDepth(nextState),
      reason: "Accepted into the local runtime worker queue for projection/review only.",
      boundaryNotes: RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES,
    },
  };
}

export function planRuntimeWorkerQueueTick(
  state: RuntimeWorkerQueueState,
  options: {
    now?: Date | string;
    leaseToken?: string;
    leaseMs?: number;
  } = {},
): RuntimeWorkerQueueTickPlan {
  const sortedPending = sortPendingQueue(state.pending);
  const nextItem = sortedPending[0] ?? null;

  if (!nextItem) {
    return {
      state: cloneQueueState(state),
      tick: {
        mode: "idle",
        item: null,
        leaseToken: null,
        operatorNextMove: "No local runtime worker item is pending.",
        forbiddenActions: forbiddenQueueActions(),
        boundaryNotes: RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES,
      },
    };
  }

  const now = toIsoString(options.now ?? new Date());
  const leaseMs = options.leaseMs ?? 30_000;
  const leaseExpiresAt = new Date(new Date(now).getTime() + leaseMs).toISOString();
  const leaseToken =
    options.leaseToken?.trim() ||
    buildStableKey("lease", nextItem.itemKey, String(nextItem.attempts + 1), now);
  const leasedItem: RuntimeWorkerQueueItem = {
    ...nextItem,
    status: "leased",
    attempts: nextItem.attempts + 1,
    leaseToken,
    leasedAt: now,
    leaseExpiresAt,
  };
  const nextState = {
    ...cloneQueueState(state),
    pending: state.pending.filter((item) => item.itemKey !== nextItem.itemKey),
    leased: [...state.leased, leasedItem],
  };

  return {
    state: nextState,
    tick: {
      mode: nextItem.effect === "operator_review" ? "operator_review" : "local_reducer",
      item: leasedItem,
      leaseToken,
      operatorNextMove:
        nextItem.effect === "operator_review"
          ? "Present the queued runtime item to operator review without auto-approval or external execution."
          : "Run only the local reducer/projection path for this runtime item.",
      forbiddenActions: forbiddenQueueActions(),
      boundaryNotes: RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES,
    },
  };
}

export function completeRuntimeWorkerQueueItem(
  state: RuntimeWorkerQueueState,
  input: {
    itemKey: string;
    leaseToken: string;
    completedAt?: Date | string;
    resultSummary: string;
  },
): { state: RuntimeWorkerQueueState; completed: boolean; reason: string } {
  const leasedItem = state.leased.find((item) => item.itemKey === input.itemKey);
  if (!leasedItem) {
    return {
      state: cloneQueueState(state),
      completed: false,
      reason: `No leased runtime worker queue item found for ${input.itemKey}.`,
    };
  }
  if (leasedItem.leaseToken !== input.leaseToken) {
    return {
      state: cloneQueueState(state),
      completed: false,
      reason: "Lease token mismatch; local worker completion rejected.",
    };
  }

  const completedItem: RuntimeWorkerQueueItem = {
    ...leasedItem,
    status: "completed",
    completedAt: toIsoString(input.completedAt ?? new Date()),
    resultSummary: input.resultSummary,
  };

  return {
    state: {
      ...cloneQueueState(state),
      leased: state.leased.filter((item) => item.itemKey !== input.itemKey),
      completed: [...state.completed, completedItem],
    },
    completed: true,
    reason: "Completed local runtime worker queue item without external side effects.",
  };
}

export function deadLetterRuntimeWorkerQueueItem(
  state: RuntimeWorkerQueueState,
  input: {
    itemKey: string;
    reason: string;
  },
): RuntimeWorkerQueueState {
  const item = [...state.pending, ...state.leased].find((candidate) => candidate.itemKey === input.itemKey);
  if (!item) {
    return cloneQueueState(state);
  }

  const deadLetterItem: RuntimeWorkerQueueItem = {
    ...item,
    status: "dead_letter",
    blockedReason: input.reason,
  };

  return {
    ...cloneQueueState(state),
    pending: state.pending.filter((candidate) => candidate.itemKey !== input.itemKey),
    leased: state.leased.filter((candidate) => candidate.itemKey !== input.itemKey),
    deadLetter: [...state.deadLetter, deadLetterItem],
  };
}

export function buildRuntimeServerMinimalSummary(input: {
  generatedAt?: Date | string;
  threads: RuntimeServerMinimalThread[];
  queueState: RuntimeWorkerQueueState;
}): RuntimeServerMinimalSummary {
  const postureCounts: Record<RuntimeServerMinimalPosture, number> = {
    ready: 0,
    review_required: 0,
    blocked: 0,
  };
  for (const thread of input.threads) {
    postureCounts[thread.posture] += 1;
  }

  const queueCounts: Record<RuntimeWorkerQueueStatus, number> = {
    pending: input.queueState.pending.length,
    leased: input.queueState.leased.length,
    completed: input.queueState.completed.length,
    dead_letter: input.queueState.deadLetter.length,
    blocked: input.queueState.blocked.length,
  };

  const prioritized =
    input.threads.find((thread) => thread.posture === "blocked") ??
    input.threads.find((thread) => thread.posture === "review_required") ??
    input.threads[0] ??
    null;

  return {
    generatedAt: toIsoString(input.generatedAt ?? new Date()),
    totalThreads: input.threads.length,
    postureCounts,
    queueCounts,
    reviewThreadKeys: input.threads
      .filter((thread) => thread.posture === "review_required")
      .map((thread) => thread.threadKey),
    blockedThreadKeys: input.threads
      .filter((thread) => thread.posture === "blocked")
      .map((thread) => thread.threadKey),
    primaryNextMove:
      prioritized?.operatorNextMove ??
      "No runtime thread exists yet; keep the local runtime seam idle.",
    boundaryNotes: RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES,
  };
}

function normalizeEvents(
  events: RuntimeServerMinimalEventInput[],
  threadKey: string,
): RuntimeServerMinimalEventInput[] {
  const seen = new Set<string>();
  return events
    .filter((event) => event.threadKey === threadKey)
    .filter((event) => {
      const key = event.eventKey.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => toIsoString(a.occurredAt ?? new Date(0)).localeCompare(toIsoString(b.occurredAt ?? new Date(0))));
}

function resolveLifecycle(events: RuntimeServerMinimalEventInput[]): RuntimeServerMinimalThread["lifecycle"] {
  const event = lastEventOf(events, "lifecycle_event");
  return {
    state: event?.lifecycleState ?? "missing",
    latestEventKey: event?.eventKey ?? null,
    sourceRef: event?.sourceRef ?? null,
  };
}

function resolveReviewRequest(events: RuntimeServerMinimalEventInput[]): RuntimeServerMinimalThread["reviewRequest"] {
  const event = lastEventOf(events, "review_request");
  return {
    state: event?.reviewState ?? "not_requested",
    requestKey: event?.eventKey ?? null,
    sourceRef: event?.sourceRef ?? null,
    summary: event?.summary ?? null,
  };
}

function resolveAcknowledgement(events: RuntimeServerMinimalEventInput[]): RuntimeServerMinimalThread["acknowledgement"] {
  const event = lastEventOf(events, "acknowledgement");
  const acknowledgement = event?.acknowledgement;
  if (!event || !acknowledgement) {
    return {
      state: "not_seen",
      acknowledgementEventId: null,
      receiptRef: null,
      officialSuccess: false,
      summary: null,
    };
  }

  return {
    state: resolveAcknowledgementState(acknowledgement),
    acknowledgementEventId: acknowledgement.acknowledgementEventId ?? event.eventKey,
    receiptRef: acknowledgement.receiptRef ?? null,
    officialSuccess:
      acknowledgement.acknowledgementStatus === "success" &&
      acknowledgement.officialSuccess === true,
    summary: event.summary,
  };
}

function resolveMonitor(events: RuntimeServerMinimalEventInput[]): RuntimeServerMinimalThread["monitor"] {
  const monitorEvents = events.filter((event) => event.kind === "monitor_event" && event.monitor);
  const severities = monitorEvents.map((event) => event.monitor?.severity ?? "ok");
  return {
    severity: maxSeverity(severities),
    eventKeys: monitorEvents.map((event) => event.eventKey),
    routeToReview: monitorEvents.some((event) =>
      event.monitor?.routeToReview === true ||
      ["escalate", "blocked"].includes(event.monitor?.severity ?? "ok"),
    ),
    reasonCodes: uniqueStrings(monitorEvents.map((event) => event.monitor?.reasonCode ?? "")),
  };
}

function resolveHandoff(events: RuntimeServerMinimalEventInput[]): RuntimeServerMinimalThread["handoff"] {
  const event = lastEventOf(events, "handoff");
  const handoff = event?.handoff;
  if (!event || !handoff) {
    return {
      state: "not_ready",
      handoffId: null,
      target: null,
      sourceRef: null,
    };
  }

  return {
    state: handoff.delivered ? "delivered" : "ready",
    handoffId: handoff.handoffId ?? event.eventKey,
    target: handoff.target,
    sourceRef: event.sourceRef,
  };
}

function resolveThreadPosture(input: {
  lifecycle: RuntimeServerMinimalThread["lifecycle"];
  reviewRequest: RuntimeServerMinimalThread["reviewRequest"];
  acknowledgement: RuntimeServerMinimalThread["acknowledgement"];
  monitor: RuntimeServerMinimalThread["monitor"];
  handoff: RuntimeServerMinimalThread["handoff"];
}): RuntimeServerMinimalPosture {
  if (
    input.lifecycle.state === "missing" ||
    input.lifecycle.state === "blocked" ||
    input.monitor.severity === "blocked" ||
    input.reviewRequest.state === "blocked" ||
    input.handoff.state === "blocked"
  ) {
    return "blocked";
  }

  if (
    input.lifecycle.state === "waiting_for_review" ||
    input.reviewRequest.state === "requested" ||
    input.acknowledgement.state === "failure_reported" ||
    input.acknowledgement.state === "needs_review" ||
    input.monitor.routeToReview
  ) {
    return "review_required";
  }

  return "ready";
}

function buildThreadOperatorNextMove(
  posture: RuntimeServerMinimalPosture,
  input: {
    lifecycle: RuntimeServerMinimalThread["lifecycle"];
    reviewRequest: RuntimeServerMinimalThread["reviewRequest"];
    acknowledgement: RuntimeServerMinimalThread["acknowledgement"];
    monitor: RuntimeServerMinimalThread["monitor"];
    handoff: RuntimeServerMinimalThread["handoff"];
  },
) {
  if (posture === "blocked") {
    if (input.lifecycle.state === "missing") {
      return "Map the shared lifecycle event before the local runtime seam can advance.";
    }
    return "Keep the local runtime thread blocked and route the blocker to operator review.";
  }

  if (posture === "review_required") {
    if (input.reviewRequest.state === "requested") {
      return "Route the review request to the local operator review queue before acknowledging completion.";
    }
    if (input.acknowledgement.state === "failure_reported" || input.acknowledgement.state === "needs_review") {
      return "Reconcile acknowledgement receipt truth locally; do not treat acknowledgement as official success.";
    }
    if (input.monitor.routeToReview) {
      return "Surface monitor event for review without scheduling remediation automatically.";
    }
  }

  if (input.handoff.state === "ready") {
    return "Keep handoff ready in the local seam and require a human/operator delivery decision.";
  }

  return "Keep local runtime seam projections current; no remote execution or sandbox authority is available.";
}

function buildEventStep(
  kind: RuntimeServerMinimalEventKind,
  events: RuntimeServerMinimalEventInput[],
): RuntimeServerMinimalSourceStep {
  const matching = events.filter((event) => event.kind === kind);
  return {
    step: kind,
    sourceType: kind,
    sourceRef: matching[0]?.sourceRef ?? null,
    outcome: matching.length > 0 ? "pass" : "warn",
    note: matching.length > 0
      ? `${kind} mapped through ${matching.length} local runtime events.`
      : `${kind} is not mapped on this local runtime thread yet.`,
  };
}

function buildWorkerQueueCandidate(
  threadKey: string,
  event: RuntimeServerMinimalEventInput,
): RuntimeWorkerQueueItemInput {
  const kind = queueKindForEvent(event.kind);
  return {
    itemKey: buildStableKey("runtime_worker", threadKey, event.eventKey),
    idempotencyKey: buildStableKey("idempotency_key", event.kind, event.eventKey),
    threadKey,
    sourceEventKey: event.eventKey,
    kind,
    effect: event.kind === "review_request" ? "operator_review" : "local_reducer",
    priority: queuePriorityForEvent(event),
    createdAt: event.occurredAt,
    summary: event.summary,
  };
}

function queueKindForEvent(kind: RuntimeServerMinimalEventKind): RuntimeWorkerQueueItemKind {
  switch (kind) {
    case "lifecycle_event":
      return "lifecycle_projection";
    case "review_request":
      return "review_request_projection";
    case "acknowledgement":
      return "acknowledgement_reconciliation";
    case "monitor_event":
      return "monitor_event_projection";
    case "handoff":
      return "handoff_projection";
  }
}

function queuePriorityForEvent(event: RuntimeServerMinimalEventInput): RuntimeWorkerQueuePriority {
  if (
    event.kind === "review_request" ||
    event.monitor?.severity === "blocked" ||
    event.monitor?.severity === "escalate"
  ) {
    return "high";
  }
  if (event.kind === "handoff" || event.acknowledgement?.acknowledgementStatus === "failure") {
    return "normal";
  }
  return "low";
}

function buildQueueItem(input: RuntimeWorkerQueueItemInput): RuntimeWorkerQueueItem {
  return {
    ...input,
    createdAt: toIsoString(input.createdAt ?? new Date()),
    priority: input.priority ?? "normal",
    status: "pending",
    attempts: 0,
    leaseToken: null,
    leasedAt: null,
    leaseExpiresAt: null,
    blockedReason: null,
    completedAt: null,
    resultSummary: null,
  };
}

function resolveAcknowledgementState(
  acknowledgement: NonNullable<RuntimeServerMinimalEventInput["acknowledgement"]>,
): RuntimeServerMinimalAcknowledgementState {
  switch (acknowledgement.acknowledgementStatus) {
    case "success":
      return acknowledgement.officialSuccess === true ? "success_confirmed" : "received";
    case "failure":
      return "failure_reported";
    case "needs_review":
      return "needs_review";
    case "received":
      return "received";
  }
}

function maxSeverity(severities: RuntimeServerMinimalMonitorSeverity[]): RuntimeServerMinimalMonitorSeverity {
  const priority: Record<RuntimeServerMinimalMonitorSeverity, number> = {
    ok: 0,
    watch: 1,
    escalate: 2,
    blocked: 3,
  };
  return severities.reduce<RuntimeServerMinimalMonitorSeverity>(
    (max, severity) => (priority[severity] > priority[max] ? severity : max),
    "ok",
  );
}

function lastEventOf(
  events: RuntimeServerMinimalEventInput[],
  kind: RuntimeServerMinimalEventKind,
): RuntimeServerMinimalEventInput | null {
  const matching = events.filter((event) => event.kind === kind);
  return matching[matching.length - 1] ?? null;
}

function findQueueItemByIdempotencyKey(
  state: RuntimeWorkerQueueState,
  idempotencyKey: string,
) {
  return allQueueItems(state).find((item) => item.idempotencyKey === idempotencyKey) ?? null;
}

function allQueueItems(state: RuntimeWorkerQueueState) {
  return [
    ...state.pending,
    ...state.leased,
    ...state.completed,
    ...state.deadLetter,
    ...state.blocked,
  ];
}

function queueDepth(state: RuntimeWorkerQueueState) {
  return state.pending.length + state.leased.length;
}

function sortPendingQueue(items: RuntimeWorkerQueueItem[]) {
  const priorityScore: Record<RuntimeWorkerQueuePriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  };
  return [...items].sort((a, b) => {
    const priorityDelta = priorityScore[a.priority] - priorityScore[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function cloneQueueState(state: RuntimeWorkerQueueState): RuntimeWorkerQueueState {
  return {
    pending: [...state.pending],
    leased: [...state.leased],
    completed: [...state.completed],
    deadLetter: [...state.deadLetter],
    blocked: [...state.blocked],
    duplicateKeys: [...state.duplicateKeys],
    audit: state.audit,
  };
}

function blockedEffectReason(effect: RuntimeWorkerQueueEffect) {
  switch (effect) {
    case "remote_execution":
      return "Blocked: runtime server minimal does not create a remote execution plane.";
    case "real_sandbox":
      return "Blocked: runtime server minimal does not create or claim a real sandbox.";
    case "swarm_ui":
      return "Blocked: runtime server minimal does not create swarm UI.";
    case "external_side_effect":
      return "Blocked: worker queue does not execute external side effects.";
    case "local_reducer":
    case "operator_review":
      return "Allowed local runtime worker queue effect.";
  }
}

function forbiddenQueueActions() {
  return [
    "remote_execution",
    "real_sandbox",
    "swarm_ui",
    "external_side_effect",
  ];
}

function buildStableKey(...parts: string[]): string {
  return parts
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
