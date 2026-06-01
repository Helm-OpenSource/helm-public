import {
  buildBudgetPosture,
  buildResumeFidelity,
  buildRuntimeContinuityRecovery,
  buildRuntimeContinuityRisk,
  buildRuntimeNotebookState,
  buildRuntimePayloadHandleState,
  buildRuntimeRemediationAnalytics,
  parseContinuitySnapshot,
  uniqueRuntimeHandles,
} from "@/lib/helm-v2/runtime-upgrade-continuity";
import { safeParseJson } from "@/lib/utils";

type RuntimeBudgetPosture = ReturnType<typeof buildBudgetPosture>;
type RuntimeNotebookState = ReturnType<typeof buildRuntimeNotebookState>;
type RuntimeRecoveryState = ReturnType<typeof buildRuntimeContinuityRecovery>;
type RuntimeRemediationTraceEntry = Parameters<typeof buildRuntimeRemediationAnalytics>[0][number];
type RuntimeContinuityRiskLevel = NonNullable<RuntimeRemediationTraceEntry["beforeRiskLevel"]>;
type RuntimeContinuityRemediationAction = RuntimeRemediationTraceEntry["action"];

function normalizeRemediationAction(value: unknown): RuntimeContinuityRemediationAction {
  return value === "SAVE_RECOVERY_CHECKPOINT" ||
    value === "RESUME_CHECKPOINT" ||
    value === "REPRUNE_CONTEXT"
    ? value
    : "SAVE_RECOVERY_CHECKPOINT";
}

function normalizeRemediationExecutionStatus(
  value: unknown,
): RuntimeRemediationTraceEntry["executionStatus"] {
  return value === "APPLIED" || value === "REVIEW_REQUIRED" || value === "BLOCKED"
    ? value
    : "BLOCKED";
}

export function buildPruneTraceEntries(input: {
  edits: Array<{
    id: string;
    strategy: string;
    beforeTokenCount: number;
    afterTokenCount: number;
    removedHandles: string | null;
    removedSummary: string | null;
    createdAt: Date;
  }>;
  payloads: Array<{
    handle: string;
    label: string;
    summary: string;
    estimatedTokens: number;
    sourceType: string;
  }>;
  notebookState: RuntimeNotebookState | null;
  budgetPosture: RuntimeBudgetPosture;
}) {
  const payloadByHandle = new Map(input.payloads.map((item) => [item.handle, item]));
  const sortedEdits = [...input.edits].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const protectedItems = [
    input.notebookState?.boundaryNote,
    ...(input.notebookState?.blockers ?? []),
    ...(input.notebookState?.decisions ?? []),
    ...(input.notebookState?.nextActions ?? []),
  ]
    .filter(Boolean)
    .slice(0, 6) as string[];

  return sortedEdits.slice(0, 6).map((edit, index) => {
    const removedHandles = uniqueRuntimeHandles(safeParseJson<string[]>(edit.removedHandles, []));
    const removedPayloads = removedHandles
      .map((handle) => payloadByHandle.get(handle))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({
        handle: item.handle,
        label: item.label,
        summary: item.summary,
        estimatedTokens: item.estimatedTokens,
        sourceType: item.sourceType,
      }));
    const tokensSaved = Math.max(0, edit.beforeTokenCount - edit.afterTokenCount);
    const posture: "WATCH" | "PRUNE" | "COMPACT" =
      input.budgetPosture.state === "COMPACT"
        ? "COMPACT"
        : tokensSaved > 0
          ? "PRUNE"
          : "WATCH";
    const historyMarker =
      sortedEdits.length > 1
        ? `History step ${sortedEdits.length - index}/${sortedEdits.length}. `
        : "";

    return {
      id: edit.id,
      strategy: edit.strategy,
      posture,
      reason:
        `${historyMarker}${
          edit.removedSummary ??
          (posture === "COMPACT"
            ? "Checkpoint resume kept continuity state compact and replayable."
            : "Budget pressure required selective context pruning.")
        }`,
      beforeTokenCount: edit.beforeTokenCount,
      afterTokenCount: edit.afterTokenCount,
      tokensSaved,
      replacementSummary:
        removedPayloads.length > 0
          ? `Removed payloads were replaced by handle + preview + summary. ${removedPayloads
              .map((item) => `${item.label}: ${item.summary}`)
              .slice(0, 2)
              .join(" ")}`
          : "No payload was removed in this edit.",
      protectedItems,
      removedPayloads,
      createdAt: edit.createdAt,
    };
  });
}

export function buildRuntimeContinuityState(input: {
  sessionLabel: string;
  sessionStatus: string;
  boundaryNote: string;
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
  budgetTokenLimit: number;
  budgetTokenUsed: number;
  prunedTokenCount: number;
  latestCheckpoint?:
    | {
        id: string;
        label: string;
        status: string;
        summary: string;
        snapshotJson: string;
        updatedAt: Date;
      }
    | null;
  resumedFromKey?: string | null;
  persistedPayloads: Array<{
    handle: string;
    label: string;
    summary: string;
    estimatedTokens: number;
    sourceType: string;
  }>;
  contextEditEvents: Array<{
    id: string;
    strategy: string;
    beforeTokenCount: number;
    afterTokenCount: number;
    removedHandles: string | null;
    removedSummary: string | null;
    createdAt: Date;
  }>;
}) {
  const budgetPosture = buildBudgetPosture({
    budgetTokenLimit: input.budgetTokenLimit,
    budgetTokenUsed: input.budgetTokenUsed,
    prunedTokenCount: input.prunedTokenCount,
    latestCheckpointStatus: input.latestCheckpoint?.status,
    resumedFromKey: input.resumedFromKey,
  });
  const notebookState = buildRuntimeNotebookState({
    sessionLabel: input.sessionLabel,
    sessionStatus: input.sessionStatus,
    boundaryNote: input.boundaryNote,
    notebook: input.notebook,
    verification: input.verification,
    problemSpaces: input.problemSpaces,
    promotedFacts: input.promotedFacts,
    truthConflicts: input.truthConflicts,
  });
  const payloadState = buildRuntimePayloadHandleState({
    persistedHandles: input.persistedPayloads.map((item) => item.handle),
    latestCheckpoint: input.latestCheckpoint
      ? {
          snapshotJson: input.latestCheckpoint.snapshotJson,
          updatedAt: input.latestCheckpoint.updatedAt,
        }
      : null,
    edits: input.contextEditEvents,
  });
  const replay = input.latestCheckpoint
    ? buildResumeFidelity({
        checkpointId: input.latestCheckpoint.id,
        checkpointLabel: input.latestCheckpoint.label,
        checkpointStatus: input.latestCheckpoint.status,
        updatedAt: input.latestCheckpoint.updatedAt,
        savedState: parseContinuitySnapshot(input.latestCheckpoint.snapshotJson),
        liveState: notebookState,
        livePayloadState: {
          activeHandles: payloadState.activeHandles,
          prunedHandles: payloadState.prunedHandles,
          budgetState: budgetPosture.state,
          stateSource: payloadState.stateSource,
        },
      })
    : null;
  const pruneTrace = buildPruneTraceEntries({
    edits: input.contextEditEvents,
    payloads: input.persistedPayloads,
    notebookState,
    budgetPosture,
  });
  const risk = buildRuntimeContinuityRisk({
    budgetPosture: budgetPosture.state,
    replayStatus: replay?.fidelityStatus ?? null,
    payloadStateSource: payloadState.stateSource,
    hasPruneTrace: pruneTrace.length > 0,
  });
  const recovery = buildRuntimeContinuityRecovery({
    budgetPosture,
    replay,
    payloadState,
    latestCheckpoint: input.latestCheckpoint
      ? {
          id: input.latestCheckpoint.id,
          label: input.latestCheckpoint.label,
          status: input.latestCheckpoint.status,
        }
      : null,
    persistedPayloadCount: input.persistedPayloads.length,
    pruneTraceCount: pruneTrace.length,
  });

  return {
    budgetPosture,
    notebookState,
    payloadState,
    replay,
    pruneTrace,
    risk,
    recovery,
  };
}

export function parseRuntimeRemediationTrace(
  events: Array<{
    id: string;
    eventType: string;
    payload: string | null;
    triggeredBy: string;
    createdAt: Date;
  }>,
): RuntimeRemediationTraceEntry[] {
  const normalizeRiskLevel = (value: unknown): RuntimeContinuityRiskLevel | null =>
    value === "LOW" || value === "WATCH" || value === "HIGH" ? value : null;
  const normalizeRecoveryState = (value: unknown): RuntimeRecoveryState["state"] | null =>
    value === "STABLE" || value === "RECOVERABLE" || value === "REVIEW_REQUIRED" || value === "BLOCKED"
      ? value
      : null;
  const normalizeFailureTaxonomy = (value: unknown): RuntimeRecoveryState["failureTaxonomy"] | null =>
    value === "NONE" ||
    value === "NO_RECOVERY_ANCHOR" ||
    value === "BUDGET_PRESSURE" ||
    value === "PAYLOAD_STATE_DRIFT" ||
    value === "REPLAY_DRIFT" ||
    value === "PROTECTED_STATE_GAP"
      ? value
      : null;

  return events.map((event) => {
    const payload = safeParseJson<Record<string, unknown>>(event.payload, {});
    const before = safeParseJson<Record<string, unknown>>(JSON.stringify(payload.before ?? {}), {});
    const after = safeParseJson<Record<string, unknown>>(JSON.stringify(payload.after ?? {}), {});
    const rollbackAnchor = payload.rollbackAnchor as
      | {
          checkpointLabel?: string;
          checkpointStatus?: string;
        }
      | undefined;

    return {
      id: event.id,
      action: normalizeRemediationAction(String(payload.action ?? "").toUpperCase()),
      executionStatus: normalizeRemediationExecutionStatus(
        String(payload.executionStatus ?? "BLOCKED").toUpperCase(),
      ),
      summary: String(payload.summary ?? event.eventType),
      beforeSummary: String(payload.beforeSummary ?? "No before-summary recorded."),
      afterSummary: String(payload.afterSummary ?? "No after-summary recorded."),
      beforeRiskLevel: normalizeRiskLevel(before.riskLevel),
      afterRiskLevel: normalizeRiskLevel(after.riskLevel),
      beforeRecoveryState: normalizeRecoveryState(before.recoveryState),
      afterRecoveryState: normalizeRecoveryState(after.recoveryState),
      beforeFailureTaxonomy: normalizeFailureTaxonomy(before.failureTaxonomy),
      afterFailureTaxonomy: normalizeFailureTaxonomy(after.failureTaxonomy),
      rollbackAnchorSummary:
        rollbackAnchor?.checkpointLabel
          ? `${rollbackAnchor.checkpointLabel} · ${String(rollbackAnchor.checkpointStatus ?? "READY")}`
          : null,
      triggeredBy: event.triggeredBy,
      createdAt: event.createdAt,
    };
  });
}
