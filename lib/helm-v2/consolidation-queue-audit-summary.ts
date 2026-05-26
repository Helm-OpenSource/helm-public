import type { HelmV21ConsolidationQueueAuditSummary } from "@/lib/helm-v2/contracts";

type ConsolidationQueueAuditJob = {
  id: string;
  jobType: string;
  status: string;
  href: string;
  meetingId: string | null;
  reviewPosture: string;
};

type BuildConsolidationQueueAuditSummaryInput = {
  jobs: ConsolidationQueueAuditJob[];
};

const CONSOLIDATION_ROLLBACK_SUMMARY =
  "Rollback keeps the current single-agent consolidation path, preserves candidate traces, and does not auto-mutate canonical memory.";

const CONSOLIDATION_AUDIT_BOUNDARY_NOTE =
  "Candidate-only consolidation stays review-first and auditable. Queue control only pauses or resumes the existing substrate; it does not create a workflow engine or broaden write authority.";

export function buildConsolidationQueueAuditSummary(
  input: BuildConsolidationQueueAuditSummaryInput,
): HelmV21ConsolidationQueueAuditSummary {
  const latest = input.jobs[0] ?? null;
  const counts = {
    totalJobs: input.jobs.length,
    queuedJobs: input.jobs.filter((item) => item.status === "QUEUED").length,
    runningJobs: input.jobs.filter((item) => item.status === "RUNNING").length,
    pausedJobs: input.jobs.filter((item) => item.status === "PAUSED").length,
    completedJobs: input.jobs.filter((item) => item.status === "COMPLETED").length,
    failedJobs: input.jobs.filter((item) => item.status === "FAILED").length,
  };

  if (!latest) {
    return {
      state: "idle",
      driver: "no_job",
      focusJobId: null,
      focusMeetingId: null,
      focusTitle: null,
      focusHref: null,
      summary:
        "No candidate-only consolidation job is queued right now. The queue remains review-first and default-off until an operator explicitly records it.",
      nextAction:
        "Queue manual consolidation from the meeting runtime when a review-safe candidate synthesis pass is needed.",
      rollbackSummary: CONSOLIDATION_ROLLBACK_SUMMARY,
      boundaryNote: CONSOLIDATION_AUDIT_BOUNDARY_NOTE,
      counts,
    };
  }

  if (latest.status === "PAUSED") {
    return {
      state: "paused",
      driver: "paused_job",
      focusJobId: latest.id,
      focusMeetingId: latest.meetingId,
      focusTitle: latest.jobType,
      focusHref: latest.href,
      summary:
        "Candidate-only consolidation is paused for operator review. Resume should return the same bounded queue instead of widening authority or mutating canonical memory.",
      nextAction:
        "Resume the paused consolidation job only after the operator confirms the queue should stay review-first and auditable.",
      rollbackSummary: CONSOLIDATION_ROLLBACK_SUMMARY,
      boundaryNote: latest.reviewPosture || CONSOLIDATION_AUDIT_BOUNDARY_NOTE,
      counts,
    };
  }

  if (latest.status === "RUNNING") {
    return {
      state: "running",
      driver: "running_job",
      focusJobId: latest.id,
      focusMeetingId: latest.meetingId,
      focusTitle: latest.jobType,
      focusHref: latest.href,
      summary:
        "Candidate-only consolidation is actively running on the existing bounded substrate. Operators can still pause the job for review without widening write authority or mutating canonical memory.",
      nextAction:
        "Pause the running consolidation job if operator review is needed; otherwise let the current bounded candidate pass finish before any promotion decision.",
      rollbackSummary: CONSOLIDATION_ROLLBACK_SUMMARY,
      boundaryNote: latest.reviewPosture || CONSOLIDATION_AUDIT_BOUNDARY_NOTE,
      counts,
    };
  }

  if (latest.status === "FAILED") {
    return {
      state: "review_required",
      driver: "failed_job",
      focusJobId: latest.id,
      focusMeetingId: latest.meetingId,
      focusTitle: latest.jobType,
      focusHref: latest.href,
      summary:
        "Candidate-only consolidation needs operator review before it can continue. Keep the queue auditable, inspect the candidate trace, and fall back to the single-agent path if needed.",
      nextAction:
        "Review the failed queue item before retrying, and keep rollback anchored on the single-agent consolidation path.",
      rollbackSummary: CONSOLIDATION_ROLLBACK_SUMMARY,
      boundaryNote: latest.reviewPosture || CONSOLIDATION_AUDIT_BOUNDARY_NOTE,
      counts,
    };
  }

  if (latest.status === "COMPLETED") {
    return {
      state: "candidate_ready",
      driver: "completed_job",
      focusJobId: latest.id,
      focusMeetingId: latest.meetingId,
      focusTitle: latest.jobType,
      focusHref: latest.href,
      summary:
        "Candidate-only consolidation has produced a reviewable result. Promotion still stays explicit and review-first.",
      nextAction:
        "Review the candidate output before any promotion path is considered, and keep rollback on the single-agent substrate if the result should not continue.",
      rollbackSummary: CONSOLIDATION_ROLLBACK_SUMMARY,
      boundaryNote: latest.reviewPosture || CONSOLIDATION_AUDIT_BOUNDARY_NOTE,
      counts,
    };
  }

  return {
    state: "queued",
    driver: "queued_job",
    focusJobId: latest.id,
    focusMeetingId: latest.meetingId,
    focusTitle: latest.jobType,
    focusHref: latest.href,
    summary:
      "Candidate-only consolidation is queued and stays review-first. Operators can still pause the queue before broader rollout or let the current bounded candidate path continue.",
    nextAction:
      "Pause the queued consolidation job if operator review is needed; otherwise keep the bounded candidate queue moving without widening write authority.",
    rollbackSummary: CONSOLIDATION_ROLLBACK_SUMMARY,
    boundaryNote: latest.reviewPosture || CONSOLIDATION_AUDIT_BOUNDARY_NOTE,
    counts,
  };
}
