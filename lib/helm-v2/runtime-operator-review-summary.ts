import type { HelmV21RuntimeOperatorReviewSummary } from "@/lib/helm-v2/contracts";

type ReviewQueueItem = {
  title: string;
  href: string;
  createdAt: Date;
};

type ReviewJobItem = {
  inputSummary: string;
  href: string;
  createdAt: Date;
};

type RuntimeOperatorReviewSummaryInput = {
  verificationQueue: ReviewQueueItem[];
  promotionQueue: ReviewQueueItem[];
  reflectionCandidates: ReviewQueueItem[];
  reflectionJobs: ReviewJobItem[];
  consolidationJobs: ReviewJobItem[];
};

export const RUNTIME_OPERATOR_REVIEW_SUMMARY_BOUNDARY_NOTE =
  "Operator review summary stays read-only and review-first. It compresses verification, promotion, reflection, and consolidation queue posture without widening execution authority or creating a workflow engine.";

export function buildRuntimeOperatorReviewSummary(
  input: RuntimeOperatorReviewSummaryInput,
): HelmV21RuntimeOperatorReviewSummary {
  const counts = {
    verificationQueue: input.verificationQueue.length,
    promotionQueue: input.promotionQueue.length,
    reflectionCandidates: input.reflectionCandidates.length,
    reflectionJobs: input.reflectionJobs.length,
    consolidationJobs: input.consolidationJobs.length,
  };

  const verificationLead = input.verificationQueue[0] ?? null;
  if (verificationLead) {
    return {
      state: "verification_attention",
      driver: "verification_queue",
      focusTitle: verificationLead.title,
      focusHref: verificationLead.href,
      summary: `Workspace still has ${counts.verificationQueue} verification or truth-conflict item${counts.verificationQueue === 1 ? "" : "s"} waiting for explicit operator judgement before narrower runtime work should advance.`,
      nextAction:
        "Resolve the next verification or truth-conflict item before treating the workspace operator queue as settled.",
      latestUpdatedAt: verificationLead.createdAt,
      boundaryNote: RUNTIME_OPERATOR_REVIEW_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  const promotionLead = input.promotionQueue[0] ?? null;
  if (promotionLead) {
    return {
      state: "promotion_attention",
      driver: "promotion_queue",
      focusTitle: promotionLead.title,
      focusHref: promotionLead.href,
      summary: `Workspace still has ${counts.promotionQueue} promotion or carry-forward item${counts.promotionQueue === 1 ? "" : "s"} that need explicit operator judgement before memory posture can be treated as settled.`,
      nextAction:
        "Review the next promotion or carry-forward item before treating the workspace memory queue as stable.",
      latestUpdatedAt: promotionLead.createdAt,
      boundaryNote: RUNTIME_OPERATOR_REVIEW_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  const reflectionCandidateLead = input.reflectionCandidates[0] ?? null;
  if (reflectionCandidateLead) {
    return {
      state: "reflection_candidate_attention",
      driver: "reflection_candidate_queue",
      focusTitle: reflectionCandidateLead.title,
      focusHref: reflectionCandidateLead.href,
      summary: `Workspace still has ${counts.reflectionCandidates} reflection candidate${counts.reflectionCandidates === 1 ? "" : "s"} waiting for explicit carry-forward judgement.`,
      nextAction:
        "Review the next reflection candidate before treating reflection carry-forward posture as settled.",
      latestUpdatedAt: reflectionCandidateLead.createdAt,
      boundaryNote: RUNTIME_OPERATOR_REVIEW_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  const reflectionJobLead = input.reflectionJobs[0] ?? null;
  if (reflectionJobLead) {
    return {
      state: "reflection_job_attention",
      driver: "reflection_job_queue",
      focusTitle: reflectionJobLead.inputSummary,
      focusHref: reflectionJobLead.href,
      summary: `Workspace still has ${counts.reflectionJobs} reflection job${counts.reflectionJobs === 1 ? "" : "s"} in flight, so reflection posture should stay operator-visible until the current job resolves.`,
      nextAction: "Watch the current reflection job and only treat reflection posture as settled after it resolves.",
      latestUpdatedAt: reflectionJobLead.createdAt,
      boundaryNote: RUNTIME_OPERATOR_REVIEW_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  const consolidationJobLead = input.consolidationJobs[0] ?? null;
  if (consolidationJobLead) {
    return {
      state: "consolidation_job_attention",
      driver: "consolidation_job_queue",
      focusTitle: consolidationJobLead.inputSummary,
      focusHref: consolidationJobLead.href,
      summary: `Workspace still has ${counts.consolidationJobs} consolidation job${counts.consolidationJobs === 1 ? "" : "s"} in flight, so cross-session synthesis should stay explicit on the operator surface.`,
      nextAction:
        "Watch the current consolidation job and only treat workspace synthesis posture as settled after it resolves.",
      latestUpdatedAt: consolidationJobLead.createdAt,
      boundaryNote: RUNTIME_OPERATOR_REVIEW_SUMMARY_BOUNDARY_NOTE,
      counts,
    };
  }

  return {
    state: "clear",
    driver: "steady_state",
    focusTitle: null,
    focusHref: null,
    summary:
      "Workspace review queues are currently clear, so no verification, promotion, reflection, or consolidation review item is outranking the rest of the bounded operator queue.",
    nextAction:
      "Keep review-first posture explicit and wait for the next verification, promotion, reflection, or consolidation item before advancing.",
    latestUpdatedAt: null,
    boundaryNote: RUNTIME_OPERATOR_REVIEW_SUMMARY_BOUNDARY_NOTE,
    counts,
  };
}
