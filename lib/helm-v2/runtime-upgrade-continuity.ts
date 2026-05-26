import { safeParseJson, trimText } from "@/lib/utils";

const RUNTIME_BOUNDARY_NOTE =
  "Helm v2.1 runtime remains review-first: context is selectively loaded, verification is explicit, and no high-risk external send or official write is auto-approved here.";

type RuntimeBudgetPosture = {
  state: "SAFE" | "WATCH" | "PRUNE" | "COMPACT";
  usagePercent: number;
  summary: string;
  reason: string;
  savingsSummary: string;
};

type RuntimeNotebookState = {
  objective: string;
  relevantObjects: string[];
  confirmedFacts: string[];
  blockers: string[];
  decisions: string[];
  nextActions: string[];
  openQuestions: string[];
  evidenceRefs: string[];
  reviewState: string;
  boundaryNote: string;
};

type RuntimeReplayState = {
  checkpointId: string;
  checkpointLabel: string;
  replaySummary: string;
  fidelityStatus: "STRONG" | "WATCH" | "WEAK";
  fidelityScore: number;
  preserved: string[];
  missing: string[];
  updatedAt: Date;
};

type RuntimeRecoveryState = {
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

type RuntimeRecoveryCalibration = {
  pilotBasis: string;
  rawState: RuntimeRecoveryState["state"];
  calibratedState: RuntimeRecoveryState["state"];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  stateAdjusted: boolean;
  summary: string;
  reasons: string[];
};

type RuntimePruneTraceEntry = {
  id: string;
  strategy: string;
  posture: "WATCH" | "PRUNE" | "COMPACT";
  reason: string;
  beforeTokenCount: number;
  afterTokenCount: number;
  tokensSaved: number;
  replacementSummary: string;
  protectedItems: string[];
  removedPayloads: Array<{
    handle: string;
    label: string;
    summary: string;
    estimatedTokens: number;
    sourceType: string;
  }>;
  createdAt: Date;
};

type RuntimeRemediationTraceEntry = {
  id: string;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
  executionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED";
  summary: string;
  beforeSummary: string;
  afterSummary: string;
  beforeRiskLevel: "LOW" | "WATCH" | "HIGH" | null;
  afterRiskLevel: "LOW" | "WATCH" | "HIGH" | null;
  beforeRecoveryState: RuntimeRecoveryState["state"] | null;
  afterRecoveryState: RuntimeRecoveryState["state"] | null;
  beforeFailureTaxonomy: RuntimeRecoveryState["failureTaxonomy"] | null;
  afterFailureTaxonomy: RuntimeRecoveryState["failureTaxonomy"] | null;
  rollbackAnchorSummary: string | null;
  triggeredBy: string;
  createdAt: Date;
};

type RuntimeRemediationAnalytics = {
  totalAttempts: number;
  appliedCount: number;
  reviewRequiredCount: number;
  blockedCount: number;
  latestAction: RuntimeRemediationTraceEntry["action"] | null;
  latestAttemptAt: Date | null;
  repeatPattern: {
    status:
      | "NONE"
      | "REPEATED_BLOCKED_ACTION"
      | "REPEATED_REVIEW_REQUIRED"
      | "REPEATED_REPRUNE_LOOP"
      | "REPEATED_INEFFECTIVE_ACTION";
    summary: string;
  };
};

type RuntimeRemediationEffectiveness = {
  pilotBasis: string;
  latestOutcome: "NONE" | "EFFECTIVE" | "PARTIAL" | "INEFFECTIVE" | "NO_SIGNAL";
  latestSummary: string;
  effectiveCount: number;
  partialCount: number;
  ineffectiveCount: number;
  noSignalCount: number;
  escalationNeeded: boolean;
  escalationSummary: string;
};

type RuntimeContinuityEvidenceSurface = {
  summary: string;
  items: string[];
};

type RuntimeContinuityRunbook = {
  title: string;
  summary: string;
  steps: string[];
  boundaryNote: string;
};

type RuntimeContinuitySnapshot = {
  objective: string;
  relevantObjects: string[];
  confirmedFacts: string[];
  blockers: string[];
  decisions: string[];
  nextActions: string[];
  openQuestions: string[];
  evidenceRefs: string[];
  reviewState: string;
  boundaryNote: string;
  budgetState: RuntimeBudgetPosture["state"];
  loadedHandles: string[];
  prunedHandles: string[];
};

type RuntimePayloadHandleState = {
  activeHandles: string[];
  prunedHandles: string[];
  stateSource: "checkpoint_snapshot" | "checkpoint_plus_edits" | "latest_prune_edit" | "all_persisted";
  stateSummary: string;
};

type RuntimeReplayStatus = "STRONG" | "WATCH" | "WEAK";
type RuntimeContinuityRiskLevel = "LOW" | "WATCH" | "HIGH";
type RuntimePayloadStateRiskWeight = "LOW" | "WATCH" | "HIGH";
type RuntimeContinuityRemediationAction = "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
type RuntimeRemediationEffectivenessOutcome = RuntimeRemediationEffectiveness["latestOutcome"];
type RuntimeContinuityRiskPosture = {
  level: RuntimeContinuityRiskLevel;
  summary: string;
  operatorAction: string;
};

const CONTINUITY_PROTECTED_RECOVERY_FIELDS = [
  "goal",
  "confirmed facts",
  "confirmed blockers",
  "next actions",
  "human decisions",
  "boundary note",
] as const;

const CONTINUITY_CALIBRATION_PROFILE = {
  pilotBasis: "Helm v2.1 meeting-driven continuity pilot cohort 2026-04",
  replay: {
    strongMinScore: 92,
    watchMinScore: 78,
    weakMissingCount: 4,
    criticalMissing: [
      "goal",
      "active objects",
      "confirmed facts",
      "confirmed blockers",
      "next actions",
      "human decisions",
      "review posture",
      "boundary note",
    ],
  },
  payloadStateSourceRisk: {
    checkpoint_snapshot: "LOW",
    checkpoint_plus_edits: "WATCH",
    latest_prune_edit: "WATCH",
    all_persisted: "LOW",
  } as Record<RuntimePayloadHandleState["stateSource"], RuntimePayloadStateRiskWeight>,
};

const CONTINUITY_RECOVERY_CALIBRATION_PROFILE = {
  pilotBasis: "Helm v2.2 continuity recovery pilot cohort 2026-04",
  tightenToReviewRequiredAfterIneffectiveCount: 2,
  tightenToReviewRequiredRepeatPatterns: [
    "REPEATED_REVIEW_REQUIRED",
    "REPEATED_REPRUNE_LOOP",
    "REPEATED_INEFFECTIVE_ACTION",
  ] as const,
};

const CONTINUITY_REMEDIATION_EFFECTIVENESS_PROFILE = {
  pilotBasis: "Helm v2.2 continuity remediation pilot cohort 2026-04",
  escalateAfterIneffectiveCount: 2,
};

type RuntimeContinuitySourceInput = {
  sessionLabel: string;
  sessionStatus: string;
  boundaryNote: string;
  meetingLabel?: string | null;
  opportunityLabel?: string | null;
  companyLabel?: string | null;
  notebook: {
    sessionSummary: string;
    decisionSummary: string | null;
    blockerSummary: string | null;
    pendingQuestions: string | null;
    openLoopSummary: string | null;
    boundaryNote: string;
  } | null;
  verification: {
    status: string;
    blockedReasons: string[];
  } | null;
  problemSpaces: Array<{
    title: string;
    nextStep: string;
    status: string;
    ownerHint?: string | null;
    evidenceRefs?: string[];
  }>;
  promotedFacts: Array<{
    summary: string;
    evidenceRefs: string[];
  }>;
  truthConflicts: Array<{
    status: string;
    summary: string;
  }>;
};

export function buildBudgetPosture(input: {
  budgetTokenLimit: number;
  budgetTokenUsed: number;
  prunedTokenCount: number;
  latestCheckpointStatus?: string | null;
  resumedFromKey?: string | null;
}): RuntimeBudgetPosture {
  const usagePercent =
    input.budgetTokenLimit <= 0 ? 0 : Math.round((input.budgetTokenUsed / input.budgetTokenLimit) * 100);
  const tokensSaved = Math.max(0, input.prunedTokenCount);

  if (input.latestCheckpointStatus === "RESUMED" || input.resumedFromKey) {
    return {
      state: "COMPACT",
      usagePercent,
      summary: "Runtime resumed from checkpoint to preserve continuity after compaction-style pressure.",
      reason: "A resumed checkpoint is active, so the current session is operating in compact continuity posture.",
      savingsSummary:
        tokensSaved > 0
          ? `${tokensSaved} tokens remain externalized behind handles after resume.`
          : "Checkpoint resume is preserving state even without new token savings in this step.",
    };
  }

  if (tokensSaved > 0) {
    return {
      state: "PRUNE",
      usagePercent,
      summary: "Budget governor pruned overflow context into persisted handles.",
      reason: "The loaded context exceeded safe headroom, so bulky context was replaced by handle + preview + summary.",
      savingsSummary: `${tokensSaved} tokens are now externalized behind traceable payload handles.`,
    };
  }

  if (usagePercent >= 75) {
    return {
      state: "WATCH",
      usagePercent,
      summary: "The session is still under budget, but headroom is narrowing.",
      reason: "Budget usage crossed the watch threshold, so the next large context load should stay selective.",
      savingsSummary: "No handles were pruned yet, but the session is nearing the prune threshold.",
    };
  }

  return {
    state: "SAFE",
    usagePercent,
    summary: "The session is operating with safe budget headroom.",
    reason: "Current active context remains comfortably within the configured token budget.",
    savingsSummary:
      tokensSaved > 0
        ? `${tokensSaved} tokens remain externalized behind handles while the session stays safe.`
        : "No prune action was needed in the current posture.",
  };
}

function splitOperationalLines(...values: Array<string | null | undefined>) {
  return values
    .flatMap((value) =>
      (value ?? "")
        .split(/\n|；|;|•|·/)
        .map((item) => item.trim()),
    )
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function parseRuntimeStringList(value?: string | null) {
  return safeParseJson<string[]>(value, []).filter((item) => item.trim().length > 0);
}

export function buildRuntimeNotebookState(input: RuntimeContinuitySourceInput): RuntimeNotebookState {
  const objectiveFromSummary =
    input.notebook?.sessionSummary
      .match(/Objective:\s*(.+?)(?=\.\s+(?:Confirmed facts|Blockers|Review posture):|$)/i)?.[1]
      ?.trim() ?? null;
  const relevantObjects = [
    input.meetingLabel ? `Meeting: ${input.meetingLabel}` : null,
    input.opportunityLabel ? `Opportunity: ${input.opportunityLabel}` : null,
    input.companyLabel ? `Company: ${input.companyLabel}` : null,
  ].filter((item): item is string => Boolean(item));

  const confirmedFacts = input.promotedFacts.map((item) => item.summary).filter(Boolean).slice(0, 6);
  const blockers = [
    ...splitOperationalLines(input.notebook?.blockerSummary),
    ...input.truthConflicts.filter((item) => item.status === "OPEN").map((item) => item.summary),
    ...(input.verification?.status === "blocked" ? input.verification.blockedReasons : []),
  ].filter((item, index, list) => list.indexOf(item) === index);
  const decisions = splitOperationalLines(input.notebook?.decisionSummary);
  const nextActions = [
    ...splitOperationalLines(input.notebook?.openLoopSummary),
    ...input.problemSpaces.map((item) => item.nextStep).filter(Boolean),
  ].filter((item, index, list) => list.indexOf(item) === index);
  const openQuestions = [
    ...parseRuntimeStringList(input.notebook?.pendingQuestions),
    ...(input.verification?.status === "needs_review" ? input.verification.blockedReasons : []),
  ].filter((item, index, list) => list.indexOf(item) === index);
  const evidenceRefs = [
    ...input.promotedFacts.flatMap((item) => item.evidenceRefs),
    ...input.problemSpaces.flatMap((item) => item.evidenceRefs ?? []),
  ]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 8);

  return {
    objective:
      objectiveFromSummary ??
      splitOperationalLines(input.notebook?.openLoopSummary)[0] ??
      input.problemSpaces[0]?.nextStep ??
      `Carry the current runtime session for ${input.meetingLabel ?? input.sessionLabel} forward without dropping verified state.`,
    relevantObjects,
    confirmedFacts,
    blockers,
    decisions,
    nextActions,
    openQuestions,
    evidenceRefs,
    reviewState:
      input.verification?.status === "blocked"
        ? "blocked_for_review"
        : input.verification?.status === "needs_review"
          ? "needs_review"
          : input.sessionStatus.toLowerCase(),
    boundaryNote: input.notebook?.boundaryNote ?? input.boundaryNote,
  };
}

export function buildContinuitySnapshot(input: RuntimeContinuitySourceInput & {
  budgetPosture: RuntimeBudgetPosture;
  loadedHandles: string[];
  prunedHandles: string[];
}): RuntimeContinuitySnapshot {
  const notebookState = buildRuntimeNotebookState(input);
  return {
    ...notebookState,
    budgetState: input.budgetPosture.state,
    loadedHandles: input.loadedHandles,
    prunedHandles: input.prunedHandles,
  };
}

export function parseContinuitySnapshot(value?: string | null): RuntimeContinuitySnapshot | null {
  const parsed = safeParseJson<Record<string, unknown>>(value, {});
  const candidate = parsed.continuityState as RuntimeContinuitySnapshot | undefined;
  if (!candidate || typeof candidate !== "object") return null;
  return {
    objective: String(candidate.objective ?? ""),
    relevantObjects: Array.isArray(candidate.relevantObjects) ? candidate.relevantObjects.map(String) : [],
    confirmedFacts: Array.isArray(candidate.confirmedFacts) ? candidate.confirmedFacts.map(String) : [],
    blockers: Array.isArray(candidate.blockers) ? candidate.blockers.map(String) : [],
    decisions: Array.isArray(candidate.decisions) ? candidate.decisions.map(String) : [],
    nextActions: Array.isArray(candidate.nextActions) ? candidate.nextActions.map(String) : [],
    openQuestions: Array.isArray(candidate.openQuestions) ? candidate.openQuestions.map(String) : [],
    evidenceRefs: Array.isArray(candidate.evidenceRefs) ? candidate.evidenceRefs.map(String) : [],
    reviewState: String(candidate.reviewState ?? ""),
    boundaryNote: String(candidate.boundaryNote ?? RUNTIME_BOUNDARY_NOTE),
    budgetState: ["SAFE", "WATCH", "PRUNE", "COMPACT"].includes(String(candidate.budgetState))
      ? (String(candidate.budgetState) as RuntimeBudgetPosture["state"])
      : "SAFE",
    loadedHandles: Array.isArray(candidate.loadedHandles) ? candidate.loadedHandles.map(String) : [],
    prunedHandles: Array.isArray(candidate.prunedHandles) ? candidate.prunedHandles.map(String) : [],
  };
}

export function selectRuntimeContinuityCheckpoint<
  T extends {
    checkpointKey?: string | null;
    status?: string | null;
  },
>(checkpoints: T[], resumedFromKey?: string | null): T | null {
  if (resumedFromKey) {
    const resumedByKey = checkpoints.find((item) => item.checkpointKey === resumedFromKey);
    if (resumedByKey) return resumedByKey;
  }

  const resumedByStatus = checkpoints.find((item) => item.status === "RESUMED");
  if (resumedByStatus) return resumedByStatus;

  return checkpoints[0] ?? null;
}

export function uniqueRuntimeHandles(handles: Array<string | null | undefined>) {
  return handles.filter(Boolean).filter((item, index, list): item is string => list.indexOf(item) === index);
}

export function buildRuntimePayloadHandleState(input: {
  persistedHandles: string[];
  latestCheckpoint?: {
    snapshotJson?: string | null;
    updatedAt?: Date | null;
  } | null;
  edits?: Array<{
    removedHandles?: string | null;
    createdAt?: Date | null;
  }> | null;
  latestEdit?: {
    removedHandles?: string | null;
    createdAt?: Date | null;
  } | null;
}): RuntimePayloadHandleState {
  const persistedHandles = uniqueRuntimeHandles(input.persistedHandles);
  const persistedHandleSet = new Set(persistedHandles);
  const snapshot = parseContinuitySnapshot(input.latestCheckpoint?.snapshotJson);
  const snapshotLoaded = uniqueRuntimeHandles(snapshot?.loadedHandles ?? []).filter((handle) => persistedHandleSet.has(handle));
  const snapshotLoadedSet = new Set(snapshotLoaded);
  const snapshotPruned = uniqueRuntimeHandles(snapshot?.prunedHandles ?? []).filter(
    (handle) => persistedHandleSet.has(handle) && !snapshotLoadedSet.has(handle),
  );
  const snapshotKnownSet = new Set([...snapshotLoaded, ...snapshotPruned]);
  const snapshotHasHandleState = snapshotLoaded.length > 0 || snapshotPruned.length > 0;
  const allEdits = [
    ...(input.edits ?? []),
    ...(input.latestEdit ? [input.latestEdit] : []),
  ]
    .filter((item, index, list) => list.indexOf(item) === index)
    .sort((left, right) => (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0));
  const checkpointUpdatedAt = input.latestCheckpoint?.updatedAt?.getTime() ?? 0;
  const editsAfterCheckpoint = checkpointUpdatedAt
    ? allEdits.filter((item) => (item.createdAt?.getTime() ?? 0) > checkpointUpdatedAt)
    : allEdits;
  const relevantEdits = snapshotHasHandleState ? editsAfterCheckpoint : allEdits;

  const activeSet = snapshotHasHandleState
    ? new Set(
        persistedHandles.filter(
          (handle) =>
            snapshotLoadedSet.has(handle) ||
            (!snapshotKnownSet.has(handle) && !snapshotPruned.includes(handle)),
        ),
      )
    : new Set(persistedHandles);
  const prunedSet = snapshotHasHandleState ? new Set(snapshotPruned) : new Set<string>();

  for (const edit of relevantEdits) {
    const removedHandles = uniqueRuntimeHandles(safeParseJson<string[]>(edit.removedHandles, []))
      .filter((handle) => persistedHandleSet.has(handle));
    for (const removedHandle of removedHandles) {
      activeSet.delete(removedHandle);
      prunedSet.add(removedHandle);
    }
  }

  const activeHandles = persistedHandles.filter((handle) => activeSet.has(handle));
  const prunedHandles = persistedHandles.filter((handle) => prunedSet.has(handle));
  const editCount = relevantEdits.length;

  if (snapshotHasHandleState && editCount === 0) {
    return {
      activeHandles,
      prunedHandles,
      stateSource: "checkpoint_snapshot",
      stateSummary: "Current active-context view is derived from the latest continuity checkpoint snapshot.",
    };
  }

  if (snapshotHasHandleState && editCount > 0) {
    return {
      activeHandles,
      prunedHandles,
      stateSource: "checkpoint_plus_edits",
      stateSummary: `Current active-context view is derived from the latest continuity checkpoint snapshot plus ${editCount} subsequent prune edit(s).`,
    };
  }

  if (editCount > 0) {
    return {
      activeHandles,
      prunedHandles,
      stateSource: "latest_prune_edit",
      stateSummary: `Current active-context view is derived from prune edit history (${editCount} edit${editCount > 1 ? "s" : ""}) without a checkpoint snapshot override.`,
    };
  }

  return {
    activeHandles: persistedHandles,
    prunedHandles: [],
    stateSource: "all_persisted",
    stateSummary: "No prune edit or continuity checkpoint override was found, so all persisted payloads remain active by default.",
  };
}

export function classifyPayloadStateSourceRisk(stateSource: RuntimePayloadHandleState["stateSource"]) {
  const riskWeight = CONTINUITY_CALIBRATION_PROFILE.payloadStateSourceRisk[stateSource] ?? "WATCH";
  const summary =
    stateSource === "checkpoint_snapshot"
      ? "Payload state is checkpoint-anchored and stable."
      : stateSource === "checkpoint_plus_edits"
        ? "Payload state is checkpoint-anchored with post-checkpoint prune edits."
        : stateSource === "latest_prune_edit"
          ? "Payload state is prune-edit-derived and needs operator confirmation in long sessions."
          : "Payload state currently defaults to all persisted handles.";

  return {
    riskWeight,
    summary,
    pilotBasis: CONTINUITY_CALIBRATION_PROFILE.pilotBasis,
  };
}

export function classifyReplayFidelityStatus(input: {
  fidelityScore: number;
  missing: string[];
}): RuntimeReplayStatus {
  const criticalMissing = input.missing.some((item) =>
    CONTINUITY_CALIBRATION_PROFILE.replay.criticalMissing.includes(item),
  );
  if (criticalMissing) return "WEAK";
  if (input.missing.length >= CONTINUITY_CALIBRATION_PROFILE.replay.weakMissingCount) return "WEAK";
  if (input.fidelityScore < CONTINUITY_CALIBRATION_PROFILE.replay.watchMinScore) return "WEAK";
  if (input.missing.length === 0 && input.fidelityScore >= CONTINUITY_CALIBRATION_PROFILE.replay.strongMinScore) {
    return "STRONG";
  }
  return "WATCH";
}

export function buildResumeFidelity(input: {
  checkpointId: string;
  checkpointLabel: string;
  checkpointStatus: string;
  updatedAt: Date;
  savedState: RuntimeContinuitySnapshot | null;
  liveState: RuntimeNotebookState;
  livePayloadState?: {
    activeHandles: string[];
    prunedHandles: string[];
    budgetState: RuntimeBudgetPosture["state"];
    stateSource?: RuntimePayloadHandleState["stateSource"];
  } | null;
}): RuntimeReplayState | null {
  if (!input.savedState) return null;

  const hasAll = (expected: string[], actual: string[]) => expected.every((item) => actual.includes(item));
  const preserved: string[] = [];
  const missing: string[] = [];
  const livePayloadState = input.livePayloadState ?? null;
  const checks: Array<[label: string, pass: boolean]> = [
    ["goal", input.savedState.objective === input.liveState.objective],
    ["active objects", hasAll(input.savedState.relevantObjects, input.liveState.relevantObjects)],
    ["confirmed facts", hasAll(input.savedState.confirmedFacts, input.liveState.confirmedFacts)],
    ["confirmed blockers", hasAll(input.savedState.blockers, input.liveState.blockers)],
    ["next actions", hasAll(input.savedState.nextActions, input.liveState.nextActions)],
    ["open questions", hasAll(input.savedState.openQuestions, input.liveState.openQuestions)],
    ["evidence refs", hasAll(input.savedState.evidenceRefs, input.liveState.evidenceRefs)],
    ["human decisions", hasAll(input.savedState.decisions, input.liveState.decisions)],
    ["review posture", input.savedState.reviewState === input.liveState.reviewState],
    ["boundary note", input.savedState.boundaryNote === input.liveState.boundaryNote],
    [
      "loaded handles",
      livePayloadState ? hasAll(input.savedState.loadedHandles, livePayloadState.activeHandles) : true,
    ],
    [
      "pruned handles",
      livePayloadState ? hasAll(input.savedState.prunedHandles, livePayloadState.prunedHandles) : true,
    ],
    ["budget posture", livePayloadState ? input.savedState.budgetState === livePayloadState.budgetState : true],
    [
      "payload source posture",
      livePayloadState?.stateSource
        ? input.savedState.budgetState === "COMPACT"
          ? livePayloadState.stateSource === "checkpoint_snapshot" ||
            livePayloadState.stateSource === "checkpoint_plus_edits"
          : true
        : true,
    ],
    [
      "confirmed fact evidence",
      input.savedState.confirmedFacts.length === 0 ||
      input.liveState.confirmedFacts.length === 0 ||
      input.liveState.evidenceRefs.length > 0,
    ],
  ];

  for (const [label, pass] of checks) {
    if (pass) preserved.push(label);
    else missing.push(label);
  }

  const fidelityScore = Math.round((preserved.length / checks.length) * 100);
  const fidelityStatus = classifyReplayFidelityStatus({
    fidelityScore,
    missing,
  });

  return {
    checkpointId: input.checkpointId,
    checkpointLabel: input.checkpointLabel,
    replaySummary:
      fidelityStatus === "STRONG"
        ? "Checkpoint replay preserved the current objective, continuity facts, notebook state, payload handle state, and budget posture."
        : fidelityStatus === "WATCH"
          ? `Checkpoint replay stayed mostly intact but requires watch-level review: ${missing.join(", ")}.`
          : `Checkpoint replay dropped or weakened: ${missing.join(", ")}.`,
    fidelityStatus,
    fidelityScore,
    preserved,
    missing,
    updatedAt: input.updatedAt,
  };
}

export function buildRuntimeContinuityRisk(input: {
  budgetPosture: RuntimeBudgetPosture["state"];
  replayStatus: RuntimeReplayStatus | null;
  payloadStateSource: RuntimePayloadHandleState["stateSource"];
  hasPruneTrace: boolean;
}): RuntimeContinuityRiskPosture {
  const payloadSourceRisk = classifyPayloadStateSourceRisk(input.payloadStateSource);

  if (input.replayStatus === "WEAK") {
    return {
      level: "HIGH",
      summary: `Continuity replay is weak under ${CONTINUITY_CALIBRATION_PROFILE.pilotBasis}. Treat this session as recovery-risk until missing continuity fields are resolved.`,
      operatorAction: "Review replay missing fields first, then confirm blockers/decisions/next actions before downstream usage.",
    };
  }

  if (
    input.replayStatus === "WATCH" &&
    (input.budgetPosture === "COMPACT" || payloadSourceRisk.riskWeight !== "LOW")
  ) {
    return {
      level: "WATCH",
      summary: `Replay fidelity is watch-level and payload source is ${input.payloadStateSource}. Confirm continuity before relying on downstream usage.`,
      operatorAction:
        "Inspect replay missing fields and payload derivation, then confirm blockers/decisions/next actions remain intact.",
    };
  }

  if (input.budgetPosture === "COMPACT" && payloadSourceRisk.riskWeight !== "LOW") {
    return {
      level: "WATCH",
      summary: "Session is in compact posture with post-checkpoint context edits. Confirm the current payload state before relying on it.",
      operatorAction: "Inspect payload state derivation and prune trace to verify active handles match current session intent.",
    };
  }

  if (
    input.budgetPosture === "PRUNE" ||
    input.budgetPosture === "WATCH" ||
    input.hasPruneTrace ||
    payloadSourceRisk.riskWeight === "WATCH"
  ) {
    return {
      level: "WATCH",
      summary: `Session is budget-sensitive. Payload source posture: ${payloadSourceRisk.summary}`,
      operatorAction: "Check prune trace protected items and avoid reloading bulky context without budget justification.",
    };
  }

  return {
    level: "LOW",
    summary: "Session continuity posture is stable for the current budget and replay state.",
    operatorAction: "No immediate continuity intervention is needed.",
  };
}

function uniqueContinuityRemediationActions(actions: RuntimeContinuityRemediationAction[]) {
  return actions.filter((item, index, list) => list.indexOf(item) === index);
}

export function buildRuntimeRollbackAnchor(
  checkpoint?:
    | {
        id: string;
        label: string;
        status: string;
      }
    | null,
) {
  if (!checkpoint) return null;
  return {
    checkpointId: checkpoint.id,
    checkpointLabel: checkpoint.label,
    checkpointStatus: checkpoint.status,
  };
}

export function formatContinuityRemediationActionLabel(action: RuntimeContinuityRemediationAction) {
  switch (action) {
    case "SAVE_RECOVERY_CHECKPOINT":
      return "save recovery checkpoint";
    case "RESUME_CHECKPOINT":
      return "restore latest checkpoint";
    default:
      return "re-prune context";
  }
}

export function buildRuntimeContinuityRecovery(input: {
  budgetPosture: RuntimeBudgetPosture;
  replay: RuntimeReplayState | null;
  payloadState: RuntimePayloadHandleState;
  latestCheckpoint?:
    | {
        id: string;
        label: string;
        status: string;
      }
    | null;
  persistedPayloadCount: number;
  pruneTraceCount: number;
}): RuntimeRecoveryState {
  const rollbackAnchor = buildRuntimeRollbackAnchor(input.latestCheckpoint ?? null);
  const hasCheckpoint = Boolean(rollbackAnchor);
  const protectedMissing = (input.replay?.missing ?? []).filter((item) =>
    CONTINUITY_PROTECTED_RECOVERY_FIELDS.includes(item as (typeof CONTINUITY_PROTECTED_RECOVERY_FIELDS)[number]),
  );

  if (!hasCheckpoint && input.persistedPayloadCount <= 0) {
    return {
      state: "BLOCKED",
      failureTaxonomy: "NO_RECOVERY_ANCHOR",
      summary: "No checkpoint anchor or persisted payload context exists, so continuity recovery cannot proceed safely from this surface.",
      operatorAction: "Rebuild continuity substrate first. This session needs a fresh runtime pass before any recovery action is allowed.",
      allowedActions: [],
      reviewReasons: [],
      blockedReasons: ["No recovery anchor exists for this session."],
      rollbackAnchor,
    };
  }

  if (!hasCheckpoint && input.replay?.fidelityStatus === "WEAK") {
    return {
      state: "BLOCKED",
      failureTaxonomy: "NO_RECOVERY_ANCHOR",
      summary: "Replay is weak and there is no checkpoint anchor to roll back to.",
      operatorAction: "Do not attempt operator remediation here. Re-run the session or rebuild a safe checkpoint through a fresh runtime pass.",
      allowedActions: [],
      reviewReasons: [],
      blockedReasons: ["Weak replay has no checkpoint rollback anchor."],
      rollbackAnchor,
    };
  }

  if (input.replay?.fidelityStatus === "WEAK" && protectedMissing.length > 0) {
    return {
      state: "REVIEW_REQUIRED",
      failureTaxonomy: "PROTECTED_STATE_GAP",
      summary: `Critical continuity fields are missing or weakened: ${protectedMissing.join(", ")}.`,
      operatorAction: "Human review is required before any remediation. Confirm the missing protected fields instead of mutating continuity state blindly.",
      allowedActions: [],
      reviewReasons: protectedMissing,
      blockedReasons: [],
      rollbackAnchor,
    };
  }

  if (hasCheckpoint && input.replay && input.replay.fidelityStatus !== "STRONG") {
    return {
      state: "RECOVERABLE",
      failureTaxonomy: "REPLAY_DRIFT",
      summary: `Replay fidelity is ${input.replay.fidelityStatus.toLowerCase()} and can be rolled back to the latest checkpoint anchor.`,
      operatorAction: "Restore the latest checkpoint if the current continuity state should return to the last verified snapshot.",
      allowedActions: ["RESUME_CHECKPOINT"],
      reviewReasons: [],
      blockedReasons: [],
      rollbackAnchor,
    };
  }

  if (
    input.payloadState.stateSource === "latest_prune_edit" ||
    (input.budgetPosture.state === "COMPACT" && input.payloadState.stateSource === "checkpoint_plus_edits")
  ) {
    return {
      state: "RECOVERABLE",
      failureTaxonomy: "PAYLOAD_STATE_DRIFT",
      summary: "Payload state is derived from prune history or post-checkpoint edits and should be re-anchored before long continuity use.",
      operatorAction: "Save a fresh recovery checkpoint after confirming the active payload set still matches session intent.",
      allowedActions: uniqueContinuityRemediationActions([
        input.budgetPosture.state === "PRUNE" || input.budgetPosture.state === "WATCH" ? "REPRUNE_CONTEXT" : null,
        "SAVE_RECOVERY_CHECKPOINT",
      ].filter((item): item is RuntimeContinuityRemediationAction => Boolean(item))),
      reviewReasons: [],
      blockedReasons: [],
      rollbackAnchor,
    };
  }

  if (input.budgetPosture.state === "PRUNE" || input.budgetPosture.state === "WATCH" || input.pruneTraceCount > 0) {
    return {
      state: "RECOVERABLE",
      failureTaxonomy: "BUDGET_PRESSURE",
      summary: "Continuity is budget-sensitive and can be remediated with another bounded prune pass or a fresh checkpoint anchor.",
      operatorAction: "Use re-prune to keep protected fields intact under budget pressure, then checkpoint if the result should become the new rollback anchor.",
      allowedActions: uniqueContinuityRemediationActions(["REPRUNE_CONTEXT", "SAVE_RECOVERY_CHECKPOINT"]),
      reviewReasons: [],
      blockedReasons: [],
      rollbackAnchor,
    };
  }

  if (!hasCheckpoint && input.persistedPayloadCount > 0) {
    return {
      state: "RECOVERABLE",
      failureTaxonomy: "NO_RECOVERY_ANCHOR",
      summary: "Continuity is currently running without a recovery anchor, but a bounded checkpoint can be created from the current state.",
      operatorAction: "Save a recovery checkpoint before the session moves into a riskier posture.",
      allowedActions: ["SAVE_RECOVERY_CHECKPOINT"],
      reviewReasons: [],
      blockedReasons: [],
      rollbackAnchor,
    };
  }

  return {
    state: "STABLE",
    failureTaxonomy: "NONE",
    summary: "Continuity posture is stable and no remediation action is currently needed.",
    operatorAction: "No remediation is needed. Continue normal operator review.",
    allowedActions: [],
    reviewReasons: [],
    blockedReasons: [],
    rollbackAnchor,
  };
}

export function buildRuntimeRemediationAnalytics(
  remediationTrace: RuntimeRemediationTraceEntry[],
): RuntimeRemediationAnalytics {
  const latestEntry = remediationTrace[0] ?? null;
  const latestTwo = remediationTrace.slice(0, 2);
  let repeatPattern: RuntimeRemediationAnalytics["repeatPattern"] = {
    status: "NONE",
    summary: "No repeated continuity remediation pattern is currently visible.",
  };

  if (latestTwo.length === 2) {
    const [latest, previous] = latestTwo;
    if (
      latest.executionStatus === "BLOCKED" &&
      previous.executionStatus === "BLOCKED" &&
      latest.action === previous.action &&
      latest.afterFailureTaxonomy === previous.afterFailureTaxonomy
    ) {
      repeatPattern = {
        status: "REPEATED_BLOCKED_ACTION",
        summary: `${formatContinuityRemediationActionLabel(latest.action)} has been blocked repeatedly under ${latest.afterFailureTaxonomy ?? "the current"} continuity posture.`,
      };
    } else if (
      latest.executionStatus === "REVIEW_REQUIRED" &&
      previous.executionStatus === "REVIEW_REQUIRED" &&
      latest.afterFailureTaxonomy === previous.afterFailureTaxonomy
    ) {
      repeatPattern = {
        status: "REPEATED_REVIEW_REQUIRED",
        summary: `Continuity remains review-required across repeated remediation attempts under ${latest.afterFailureTaxonomy ?? "the current"} posture.`,
      };
    } else if (
      latest.action === "REPRUNE_CONTEXT" &&
      previous.action === "REPRUNE_CONTEXT" &&
      latest.executionStatus === "APPLIED" &&
      previous.executionStatus === "APPLIED" &&
      latest.afterRecoveryState !== "STABLE" &&
      previous.afterRecoveryState !== "STABLE"
    ) {
      repeatPattern = {
        status: "REPEATED_REPRUNE_LOOP",
        summary: "Repeated re-prune attempts are keeping the session in non-stable continuity posture.",
      };
    } else {
      const latestOutcome = classifyRuntimeRemediationEffectiveness(latest).outcome;
      const previousOutcome = classifyRuntimeRemediationEffectiveness(previous).outcome;
      if (
        latestOutcome === "INEFFECTIVE" &&
        previousOutcome === "INEFFECTIVE" &&
        latest.action === previous.action
      ) {
        repeatPattern = {
          status: "REPEATED_INEFFECTIVE_ACTION",
          summary: `${formatContinuityRemediationActionLabel(latest.action)} has been applied repeatedly without restoring a stronger continuity posture.`,
        };
      }
    }
  }

  return {
    totalAttempts: remediationTrace.length,
    appliedCount: remediationTrace.filter((item) => item.executionStatus === "APPLIED").length,
    reviewRequiredCount: remediationTrace.filter((item) => item.executionStatus === "REVIEW_REQUIRED").length,
    blockedCount: remediationTrace.filter((item) => item.executionStatus === "BLOCKED").length,
    latestAction: latestEntry?.action ?? null,
    latestAttemptAt: latestEntry?.createdAt ?? null,
    repeatPattern,
  };
}

function recoveryStateSeverity(state: RuntimeRecoveryState["state"] | null) {
  if (state === "STABLE") return 0;
  if (state === "RECOVERABLE") return 1;
  if (state === "REVIEW_REQUIRED") return 2;
  if (state === "BLOCKED") return 3;
  return null;
}

function riskLevelSeverity(level: RuntimeContinuityRiskLevel | null) {
  if (level === "LOW") return 0;
  if (level === "WATCH") return 1;
  if (level === "HIGH") return 2;
  return null;
}

function classifyRuntimeRemediationEffectiveness(entry: RuntimeRemediationTraceEntry) {
  if (entry.executionStatus !== "APPLIED") {
    return {
      outcome: "NO_SIGNAL" as RuntimeRemediationEffectivenessOutcome,
      summary:
        entry.executionStatus === "REVIEW_REQUIRED"
          ? "The latest bounded remediation did not execute because protected continuity fields still need review."
          : "The latest bounded remediation did not execute, so there is no positive recovery signal to trust yet.",
    };
  }

  const beforeRecovery = recoveryStateSeverity(entry.beforeRecoveryState);
  const afterRecovery = recoveryStateSeverity(entry.afterRecoveryState);
  const beforeRisk = riskLevelSeverity(entry.beforeRiskLevel);
  const afterRisk = riskLevelSeverity(entry.afterRiskLevel);
  const recoveryImproved = beforeRecovery !== null && afterRecovery !== null && afterRecovery < beforeRecovery;
  const recoveryWorsened = beforeRecovery !== null && afterRecovery !== null && afterRecovery > beforeRecovery;
  const riskImproved = beforeRisk !== null && afterRisk !== null && afterRisk < beforeRisk;
  const riskWorsened = beforeRisk !== null && afterRisk !== null && afterRisk > beforeRisk;
  const taxonomyResolved =
    entry.beforeFailureTaxonomy !== null &&
    entry.beforeFailureTaxonomy !== "NONE" &&
    entry.afterFailureTaxonomy === "NONE";
  const taxonomyChanged =
    entry.beforeFailureTaxonomy !== null &&
    entry.afterFailureTaxonomy !== null &&
    entry.beforeFailureTaxonomy !== entry.afterFailureTaxonomy;
  const stableNow = entry.afterRecoveryState === "STABLE";

  if (
    stableNow ||
    taxonomyResolved ||
    (recoveryImproved && !riskWorsened && entry.afterRecoveryState === "STABLE")
  ) {
    return {
      outcome: "EFFECTIVE" as RuntimeRemediationEffectivenessOutcome,
      summary: "The latest bounded remediation materially improved continuity posture and restored a stronger recovery state.",
    };
  }

  if (recoveryImproved || riskImproved || taxonomyChanged) {
    return {
      outcome: "PARTIAL" as RuntimeRemediationEffectivenessOutcome,
      summary: "The latest bounded remediation improved part of the continuity posture, but the session still needs follow-up review.",
    };
  }

  if (recoveryWorsened || riskWorsened || beforeRecovery !== null || beforeRisk !== null || taxonomyChanged) {
    return {
      outcome: "INEFFECTIVE" as RuntimeRemediationEffectivenessOutcome,
      summary: "The latest bounded remediation did not improve the continuity posture enough to justify another blind retry.",
    };
  }

  return {
    outcome: "NO_SIGNAL" as RuntimeRemediationEffectivenessOutcome,
    summary: "The latest bounded remediation lacks enough before/after signal to judge as safe recovery progress.",
  };
}

export function buildRuntimeRemediationEffectiveness(
  remediationTrace: RuntimeRemediationTraceEntry[],
): RuntimeRemediationEffectiveness {
  const evaluated = remediationTrace.map((entry) => ({
    entry,
    ...classifyRuntimeRemediationEffectiveness(entry),
  }));
  const latest = evaluated[0] ?? null;
  const effectiveCount = evaluated.filter((item) => item.outcome === "EFFECTIVE").length;
  const partialCount = evaluated.filter((item) => item.outcome === "PARTIAL").length;
  const ineffectiveCount = evaluated.filter((item) => item.outcome === "INEFFECTIVE").length;
  const noSignalCount = evaluated.filter((item) => item.outcome === "NO_SIGNAL").length;
  const escalationNeeded = ineffectiveCount >= CONTINUITY_REMEDIATION_EFFECTIVENESS_PROFILE.escalateAfterIneffectiveCount;

  return {
    pilotBasis: CONTINUITY_REMEDIATION_EFFECTIVENESS_PROFILE.pilotBasis,
    latestOutcome: latest?.outcome ?? "NONE",
    latestSummary: latest?.summary ?? "No remediation effect has been recorded for this continuity workflow yet.",
    effectiveCount,
    partialCount,
    ineffectiveCount,
    noSignalCount,
    escalationNeeded,
    escalationSummary: escalationNeeded
      ? "Pilot calibration shows repeated ineffective remediation. Stop retrying blindly and move this continuity workflow into explicit operator review."
      : latest?.outcome === "PARTIAL"
        ? "The latest remediation helped, but continuity is not fully restored yet."
        : latest?.outcome === "NO_SIGNAL"
          ? "The latest remediation attempt produced no reliable signal; keep the workflow under operator review."
          : latest?.outcome === "EFFECTIVE"
            ? "The latest remediation produced a positive recovery signal."
            : "No remediation effectiveness signal is recorded yet.",
  };
}

export function buildRuntimeContinuityCalibration(input: {
  recovery: RuntimeRecoveryState;
  replay: RuntimeReplayState | null;
  payloadState: RuntimePayloadHandleState;
  risk: RuntimeContinuityRiskPosture;
  analytics: RuntimeRemediationAnalytics;
  effectiveness: RuntimeRemediationEffectiveness;
}): RuntimeRecoveryCalibration {
  let calibratedState = input.recovery.state;
  const reasons: string[] = [];

  if (input.replay?.fidelityStatus === "WEAK") {
    reasons.push("Replay fidelity is still weak in the current continuity posture.");
  } else if (input.replay?.fidelityStatus === "WATCH") {
    reasons.push("Replay fidelity is watch-level and still needs operator confirmation.");
  }

  if (input.payloadState.stateSource === "latest_prune_edit") {
    reasons.push("Payload state is still derived from prune history rather than a fresh checkpoint snapshot.");
  } else if (input.payloadState.stateSource === "checkpoint_plus_edits") {
    reasons.push("Payload state still depends on post-checkpoint edits.");
  }

  if (input.analytics.repeatPattern.status !== "NONE") {
    reasons.push(input.analytics.repeatPattern.summary);
  }

  if (input.effectiveness.latestOutcome === "INEFFECTIVE" || input.effectiveness.latestOutcome === "NO_SIGNAL") {
    reasons.push(input.effectiveness.latestSummary);
  }

  if (
    input.recovery.state === "RECOVERABLE" &&
    (input.effectiveness.ineffectiveCount >=
      CONTINUITY_RECOVERY_CALIBRATION_PROFILE.tightenToReviewRequiredAfterIneffectiveCount ||
      CONTINUITY_RECOVERY_CALIBRATION_PROFILE.tightenToReviewRequiredRepeatPatterns.includes(
        input.analytics.repeatPattern.status as
          | "REPEATED_REVIEW_REQUIRED"
          | "REPEATED_REPRUNE_LOOP"
          | "REPEATED_INEFFECTIVE_ACTION",
      ))
  ) {
    calibratedState = "REVIEW_REQUIRED";
  }

  const stateAdjusted = calibratedState !== input.recovery.state;
  const confidence: RuntimeRecoveryCalibration["confidence"] =
    stateAdjusted || input.analytics.repeatPattern.status !== "NONE" || input.effectiveness.latestOutcome === "INEFFECTIVE"
      ? "LOW"
      : input.recovery.state === "BLOCKED" ||
          (input.recovery.state === "REVIEW_REQUIRED" && input.recovery.failureTaxonomy === "PROTECTED_STATE_GAP") ||
          (input.recovery.state === "STABLE" &&
            input.risk.level === "LOW" &&
            input.replay?.fidelityStatus !== "WATCH" &&
            input.payloadState.stateSource !== "latest_prune_edit" &&
            input.payloadState.stateSource !== "checkpoint_plus_edits")
        ? "HIGH"
        : "MEDIUM";

  return {
    pilotBasis: CONTINUITY_RECOVERY_CALIBRATION_PROFILE.pilotBasis,
    rawState: input.recovery.state,
    calibratedState,
    confidence,
    stateAdjusted,
    summary: stateAdjusted
      ? `Pilot calibration tightened recovery posture from ${input.recovery.state} to ${calibratedState} because bounded remediation is no longer restoring a reliable continuity state.`
      : confidence === "HIGH"
        ? "Pilot calibration confirms the current recovery state with high confidence."
        : confidence === "MEDIUM"
          ? "Pilot calibration keeps the current recovery state, but the operator should treat it as watch-level continuity posture."
          : "Pilot calibration keeps the current recovery state with low confidence because recent recovery evidence is noisy or ineffective.",
    reasons: reasons.slice(0, 4),
  };
}

function applyRuntimeRecoveryCalibration(input: {
  recovery: RuntimeRecoveryState;
  calibration: RuntimeRecoveryCalibration;
  effectiveness: RuntimeRemediationEffectiveness;
}): RuntimeRecoveryState {
  if (!input.calibration.stateAdjusted) return input.recovery;

  if (input.calibration.calibratedState === "REVIEW_REQUIRED") {
    return {
      ...input.recovery,
      state: "REVIEW_REQUIRED",
      summary: trimText(
        `${input.recovery.summary} ${input.calibration.summary}`,
        220,
      ),
      operatorAction:
        "Pause bounded remediation. Review the continuity evidence and confirm protected fields or recovery anchors before trying another operator action.",
      allowedActions: [],
      reviewReasons: [
        ...input.recovery.reviewReasons,
        input.calibration.summary,
        input.effectiveness.escalationNeeded ? input.effectiveness.escalationSummary : null,
      ].filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index),
      blockedReasons: [],
    };
  }

  if (input.calibration.calibratedState === "BLOCKED") {
    return {
      ...input.recovery,
      state: "BLOCKED",
      summary: trimText(
        `${input.recovery.summary} ${input.calibration.summary}`,
        220,
      ),
      operatorAction:
        "Do not continue bounded remediation from this surface. Rebuild the continuity substrate or re-run from a fresh verified checkpoint.",
      allowedActions: [],
      reviewReasons: [],
      blockedReasons: [
        ...input.recovery.blockedReasons,
        input.calibration.summary,
      ].filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index),
    };
  }

  return input.recovery;
}

export function buildRuntimeContinuityEvidenceSurface(input: {
  replay: RuntimeReplayState | null;
  recovery: RuntimeRecoveryState;
  calibration: RuntimeRecoveryCalibration;
  payloadState: RuntimePayloadHandleState;
  notebookState: RuntimeNotebookState;
  pruneTrace: RuntimePruneTraceEntry[];
  remediationTrace: RuntimeRemediationTraceEntry[];
  analytics: RuntimeRemediationAnalytics;
  effectiveness: RuntimeRemediationEffectiveness;
}): RuntimeContinuityEvidenceSurface {
  const latestTrace = input.remediationTrace[0] ?? null;
  const items = [
    input.calibration.stateAdjusted || input.calibration.confidence !== "HIGH"
      ? `Calibration: ${input.calibration.summary}`
      : null,
    input.effectiveness.latestOutcome !== "NONE"
      ? `Latest remediation effect: ${input.effectiveness.latestOutcome}. ${input.effectiveness.latestSummary}`
      : null,
    input.analytics.repeatPattern.status !== "NONE" ? `Repeat pattern: ${input.analytics.repeatPattern.summary}` : null,
    input.recovery.reviewReasons.length
      ? `Review-required because: ${input.recovery.reviewReasons.join(", ")}.`
      : null,
    input.recovery.blockedReasons.length
      ? `Blocked because: ${input.recovery.blockedReasons.join(", ")}.`
      : null,
    input.replay?.missing.length ? `Replay gaps: ${input.replay.missing.join(", ")}.` : null,
    input.payloadState.stateSource !== "checkpoint_snapshot" || input.analytics.totalAttempts > 0
      ? `Payload state: ${input.payloadState.stateSummary}`
      : null,
    input.recovery.rollbackAnchor
      ? `Rollback anchor: ${input.recovery.rollbackAnchor.checkpointLabel} · ${input.recovery.rollbackAnchor.checkpointStatus}.`
      : null,
    input.notebookState.evidenceRefs.length
      ? `Evidence refs: ${input.notebookState.evidenceRefs.slice(0, 4).join(", ")}.`
      : null,
    input.pruneTrace[0]
      ? `Latest prune: ${input.pruneTrace[0].reason} Saved ${input.pruneTrace[0].tokensSaved} tokens.`
      : null,
    latestTrace
      ? `Latest remediation: ${latestTrace.executionStatus} · ${formatContinuityRemediationActionLabel(latestTrace.action)}. ${latestTrace.afterSummary}`
      : null,
  ]
    .filter(Boolean)
    .slice(0, 8) as string[];

  const summary =
    input.calibration.stateAdjusted
      ? "Pilot calibration tightened this continuity workflow because repeated recovery attempts are not restoring a reliable state."
      : input.analytics.repeatPattern.status !== "NONE"
        ? "Repeated remediation behavior is visible. Inspect the evidence surface before retrying from this continuity workflow."
        : input.effectiveness.latestOutcome === "INEFFECTIVE"
          ? "Recovery evidence shows the latest bounded remediation was ineffective and should not be retried blindly."
          : input.effectiveness.latestOutcome === "PARTIAL"
            ? "Recovery evidence shows the latest bounded remediation only partially improved the continuity posture."
            : input.recovery.state === "BLOCKED"
              ? "Recovery evidence shows this continuity workflow is blocked from safe operator remediation."
              : input.recovery.state === "REVIEW_REQUIRED"
                ? "Recovery evidence shows protected continuity fields need human review before any bounded remediation."
                : input.recovery.state === "RECOVERABLE"
                  ? "Recovery evidence shows bounded remediation is available with visible replay, payload, and rollback posture."
                  : "Continuity evidence is stable and no remediation pressure is currently visible.";

  return {
    summary,
    items,
  };
}

export function buildRuntimeContinuityRunbook(input: {
  recovery: RuntimeRecoveryState;
  calibration: RuntimeRecoveryCalibration;
  analytics: RuntimeRemediationAnalytics;
  effectiveness: RuntimeRemediationEffectiveness;
  evidence: RuntimeContinuityEvidenceSurface;
}): RuntimeContinuityRunbook {
  const steps = [
    "Inspect the continuity evidence surface first: replay gaps, payload derivation, rollback anchor, and latest remediation trace.",
    input.calibration.stateAdjusted
      ? "Pilot calibration tightened this workflow. Stop bounded remediation and review the protected continuity fields before any further action."
      : null,
    input.recovery.allowedActions.includes("RESUME_CHECKPOINT")
      ? "Restore the latest checkpoint only if the current notebook state should return to the last verified continuity snapshot."
      : null,
    input.recovery.allowedActions.includes("REPRUNE_CONTEXT")
      ? "Re-prune only after confirming blockers, decisions, next actions, owner, due date, and boundary notes remain visible."
      : null,
    input.recovery.allowedActions.includes("SAVE_RECOVERY_CHECKPOINT")
      ? "Save a new recovery checkpoint only after the current continuity state is confirmed as the desired rollback anchor."
      : null,
    input.recovery.reviewReasons.length
      ? `Resolve protected-field review first: ${input.recovery.reviewReasons.join(", ")}.`
      : null,
    input.recovery.blockedReasons.length
      ? `Do not retry from this surface until the blocked reason is cleared: ${input.recovery.blockedReasons.join(", ")}.`
      : null,
    input.analytics.repeatPattern.status === "REPEATED_BLOCKED_ACTION"
      ? "Stop retrying the same blocked remediation action. Resolve the blocker or rebuild the continuity substrate."
      : null,
    input.analytics.repeatPattern.status === "REPEATED_REVIEW_REQUIRED"
      ? "Do not bypass review-required posture. Close the protected-state gap before any further bounded remediation."
      : null,
    input.analytics.repeatPattern.status === "REPEATED_REPRUNE_LOOP"
      ? "Stop repeated reprune loops. Compare the current state against the rollback anchor and decide whether to restore or escalate."
      : null,
    input.analytics.repeatPattern.status === "REPEATED_INEFFECTIVE_ACTION"
      ? "Stop repeating the same ineffective remediation action. Compare before/after posture and escalate to operator review instead of retrying blindly."
      : null,
    input.effectiveness.latestOutcome === "INEFFECTIVE"
      ? "The latest remediation was ineffective. Use the rollback anchor or human review instead of another identical retry."
      : null,
    input.effectiveness.latestOutcome === "PARTIAL"
      ? "The latest remediation only partially improved continuity. Confirm the remaining gaps before taking the next bounded action."
      : null,
    input.effectiveness.latestOutcome === "NO_SIGNAL"
      ? "The latest remediation produced no reliable recovery signal. Treat this workflow as operator-owned until a clearer state change appears."
      : null,
    "This runbook is operator guidance only. It does not grant send authority, execution authority, or broad write authority.",
  ]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 5) as string[];

  const title =
    input.calibration.stateAdjusted || input.effectiveness.latestOutcome === "INEFFECTIVE"
      ? "Escalate ineffective recovery"
      : input.analytics.repeatPattern.status !== "NONE"
        ? "Stop repeat remediation loop"
        : input.recovery.state === "BLOCKED"
          ? "Rebuild continuity substrate"
          : input.recovery.state === "REVIEW_REQUIRED"
            ? "Escalate protected-state review"
            : input.recovery.state === "RECOVERABLE"
              ? "Run bounded continuity remediation"
              : "Monitor continuity posture";

  return {
    title,
    summary: trimText(`${input.recovery.operatorAction} ${input.evidence.summary}`.trim(), 220),
    steps,
    boundaryNote:
      "Operator workflow only. Recommendation does not equal commitment, and remediation does not expand execution authority.",
  };
}

export function buildRuntimeContinuityOperatorArtifacts(input: {
  replay: RuntimeReplayState | null;
  recovery: RuntimeRecoveryState;
  risk: RuntimeContinuityRiskPosture;
  payloadState: RuntimePayloadHandleState;
  notebookState: RuntimeNotebookState;
  pruneTrace: RuntimePruneTraceEntry[];
  remediationTrace: RuntimeRemediationTraceEntry[];
}) {
  const analytics = buildRuntimeRemediationAnalytics(input.remediationTrace);
  const effectiveness = buildRuntimeRemediationEffectiveness(input.remediationTrace);
  const calibration = buildRuntimeContinuityCalibration({
    recovery: input.recovery,
    replay: input.replay,
    payloadState: input.payloadState,
    risk: input.risk,
    analytics,
    effectiveness,
  });
  const recovery = applyRuntimeRecoveryCalibration({
    recovery: input.recovery,
    calibration,
    effectiveness,
  });
  const evidence = buildRuntimeContinuityEvidenceSurface({
    replay: input.replay,
    recovery,
    calibration,
    payloadState: input.payloadState,
    notebookState: input.notebookState,
    pruneTrace: input.pruneTrace,
    remediationTrace: input.remediationTrace,
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

  return {
    recovery,
    calibration,
    analytics,
    effectiveness,
    evidence,
    runbook,
  };
}
