import { jsonStringify, safeParseJson, trimText } from "@/lib/utils";

export const REFLECTION_JOB_TYPES = [
  "meeting_reflection",
  "retro_reflection",
  "execution_reflection",
  "nightly_workspace_reflection",
] as const;

export const ACTIVE_RUNTIME_JOB_STATUSES = ["QUEUED", "RUNNING", "PAUSED"] as const;

const CONSOLIDATION_SINGLE_AGENT_FALLBACK_NOTE =
  "Rollback keeps the current single-agent consolidation path, preserves candidate traces, and does not auto-mutate canonical memory.";

type RuntimeReflectionNotebookState = {
  objective: string;
  confirmedFacts: string[];
  blockers: string[];
  nextActions: string[];
  evidenceRefs: string[];
};

export function parseRuntimeStringList(value?: string | null) {
  return safeParseJson<string[]>(value, []);
}

export function isReflectionJobType(jobType?: string | null) {
  return Boolean(
    jobType &&
      REFLECTION_JOB_TYPES.includes(
        jobType as (typeof REFLECTION_JOB_TYPES)[number],
      ),
  );
}

export function isReflectionMemoryCandidate(input: {
  sourceVerification?: string | null;
  sourceStatus?: string | null;
}) {
  return (
    input.sourceVerification === "human_confirmed_reflection" ||
    input.sourceStatus === "trusted_runtime_compaction"
  );
}

export function isActiveRuntimeJobStatus(status: string) {
  return ACTIVE_RUNTIME_JOB_STATUSES.includes(
    status as (typeof ACTIVE_RUNTIME_JOB_STATUSES)[number],
  );
}

export function buildRuntimeJobEventPrefix(jobType: string) {
  return isReflectionJobType(jobType) ? "reflection.job" : "consolidation.job";
}

export function buildConsolidationLifecycleOutputSummary(input: {
  lifecycleState: "queued" | "paused" | "resumed";
  source:
    | "manual_operator_queue"
    | "review_confirmed"
    | "review_rejected"
    | "operating_resume";
}) {
  const sourceLabel =
    input.source === "manual_operator_queue"
      ? "manual operator queue"
      : input.source === "review_confirmed"
        ? "confirmed meeting review"
        : input.source === "review_rejected"
          ? "rejected meeting review"
          : "operator resume";

  if (input.lifecycleState === "paused") {
    return `Paused for queue audit and controlled follow-through after ${sourceLabel}. ${CONSOLIDATION_SINGLE_AGENT_FALLBACK_NOTE}`;
  }

  if (input.lifecycleState === "resumed") {
    return `Resumed into the same candidate-only consolidation queue after ${sourceLabel}. ${CONSOLIDATION_SINGLE_AGENT_FALLBACK_NOTE}`;
  }

  return `Queued for candidate-only consolidation after ${sourceLabel}. Review-first promotion still stays explicit. ${CONSOLIDATION_SINGLE_AGENT_FALLBACK_NOTE}`;
}

export function buildReflectionLifecycleOutputSummary(input: {
  lifecycleState: "paused" | "resumed";
}) {
  return input.lifecycleState === "paused"
    ? "Paused reflection for operator review. The reflection path stays trusted-state-only, review-first, and never auto-promotes memory."
    : "Resumed reflection inside the same trusted-state compaction path. The flow remains review-first and does not rewrite canonical truth.";
}

export function buildRuntimeMemoryPromotionKey(input: {
  workspaceId: string;
  candidateId: string;
  memoryItemId?: string | null;
}) {
  return `${input.workspaceId}:memory-promotion:${input.memoryItemId ?? input.candidateId}`;
}

export function buildPromotedRuntimeFacts(
  candidates: Array<{
    id?: string | null;
    status?: string | null;
    summary: string;
    evidenceRefs?: string[] | string | null;
  }>,
  promotions: Array<{
    memoryCandidateId?: string | null;
    status?: string | null;
  }> = [],
) {
  const promotedIds = new Set(
    promotions
      .filter((item) => item.status === "PROMOTED" && item.memoryCandidateId)
      .map((item) => item.memoryCandidateId as string),
  );

  return candidates
    .filter(
      (item) =>
        item.status === "PROMOTED" ||
        (item.id ? promotedIds.has(item.id) : false),
    )
    .map((item) => ({
      summary: item.summary,
      evidenceRefs: Array.isArray(item.evidenceRefs)
        ? item.evidenceRefs.map(String)
        : parseRuntimeStringList(item.evidenceRefs ?? null),
    }))
    .filter((item) => item.summary);
}

export function buildReflectionJobInputSummary(input: {
  sessionLabel: string;
  trigger: "manual_operator_queue" | "meeting_human_confirmed";
}) {
  return input.trigger === "meeting_human_confirmed"
    ? `Reflection queued after human-confirmed meeting review for ${input.sessionLabel}. Only trusted runtime state, verification posture and promoted facts are carried forward here.`
    : `Operator requested reflection for ${input.sessionLabel}. Only trusted runtime state, verification posture and promoted facts are compacted here.`;
}

export function buildReflectionJobOutputSummary(input: {
  meetingLabel?: string | null;
  notebookState: RuntimeReflectionNotebookState;
}) {
  return trimText(
    [
      `Reflection compacted trusted carry-forward context for ${input.meetingLabel ?? "the current runtime session"}.`,
      `Focus: ${input.notebookState.objective}.`,
      input.notebookState.confirmedFacts.length > 0
        ? `Confirmed: ${input.notebookState.confirmedFacts.slice(0, 2).join(" / ")}.`
        : null,
      input.notebookState.blockers.length > 0
        ? `Blockers: ${input.notebookState.blockers.slice(0, 2).join(" / ")}.`
        : null,
      input.notebookState.nextActions.length > 0
        ? `Next: ${input.notebookState.nextActions.slice(0, 2).join(" / ")}.`
        : null,
      "This stays review-first, candidate-only and does not auto-promote memory or rewrite canonical truth.",
    ]
      .filter(Boolean)
      .join(" "),
    500,
  );
}

export function buildReflectionMemoryCandidateContract(input: {
  meetingLabel?: string | null;
  notebookState: RuntimeReflectionNotebookState;
}) {
  const summary = trimText(
    [
      `Carry forward ${input.meetingLabel ?? "this runtime session"} with focus on ${input.notebookState.objective}.`,
      input.notebookState.confirmedFacts.length > 0
        ? `Confirmed: ${input.notebookState.confirmedFacts.slice(0, 2).join(" / ")}.`
        : null,
      input.notebookState.blockers.length > 0
        ? `Blockers: ${input.notebookState.blockers.slice(0, 2).join(" / ")}.`
        : null,
      input.notebookState.nextActions.length > 0
        ? `Next: ${input.notebookState.nextActions.slice(0, 2).join(" / ")}.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    420,
  );

  return {
    summary,
    sourceVerification: "human_confirmed_reflection",
    sourceStatus: "trusted_runtime_compaction",
    status: "VERIFIED" as const,
    reviewerNote:
      "Reflection candidate is derived only from trusted runtime state. It stays review-safe carry-forward context until a separate review path chooses to promote any resulting memory truth.",
    evidenceRefs: jsonStringify(input.notebookState.evidenceRefs),
    confidence:
      input.notebookState.confirmedFacts.length > 0
        ? input.notebookState.evidenceRefs.length > 0
          ? 84
          : 76
        : input.notebookState.evidenceRefs.length > 0
          ? 72
          : 64,
  };
}
