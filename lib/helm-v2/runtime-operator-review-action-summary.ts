import type {
  HelmV21RuntimeOperatorReviewActionSummary,
  HelmV21RuntimeOperatorReviewSummary,
} from "@/lib/helm-v2/contracts";

export const RUNTIME_OPERATOR_REVIEW_ACTION_SUMMARY_BOUNDARY_NOTE =
  "Operator review action summary stays read-only and review-first. It compresses the next bounded review action from workspace review posture without widening authority or creating a workflow engine.";

export function buildRuntimeOperatorReviewActionSummary(input: {
  operatorReviewSummary: HelmV21RuntimeOperatorReviewSummary;
}): HelmV21RuntimeOperatorReviewActionSummary {
  const base = {
    reviewState: input.operatorReviewSummary.state,
    focusTitle: input.operatorReviewSummary.focusTitle,
    focusHref: input.operatorReviewSummary.focusHref,
    latestUpdatedAt: input.operatorReviewSummary.latestUpdatedAt,
    boundaryNote: RUNTIME_OPERATOR_REVIEW_ACTION_SUMMARY_BOUNDARY_NOTE,
    counts: input.operatorReviewSummary.counts,
  };

  switch (input.operatorReviewSummary.state) {
    case "verification_attention":
      return {
        state: "resolve_verification",
        driver: "verification_queue",
        summary:
          "Verification or truth-conflict work is leading the workspace review queue, so the current action is to resolve that item before treating narrower runtime work as primary.",
        nextAction:
          input.operatorReviewSummary.nextAction ??
          "Resolve the next verification or truth-conflict item before advancing narrower runtime work.",
        ...base,
      };
    case "promotion_attention":
      return {
        state: "review_promotion",
        driver: "promotion_queue",
        summary:
          "Promotion or carry-forward review is leading the workspace review queue, so the current action is to review that item before treating workspace memory posture as settled.",
        nextAction:
          input.operatorReviewSummary.nextAction ??
          "Review the next promotion or carry-forward item before treating workspace memory posture as settled.",
        ...base,
      };
    case "reflection_candidate_attention":
      return {
        state: "review_reflection_candidate",
        driver: "reflection_candidate_queue",
        summary:
          "Reflection candidate review is leading the workspace review queue, so the current action is to judge that carry-forward candidate before treating reflection posture as settled.",
        nextAction:
          input.operatorReviewSummary.nextAction ??
          "Review the next reflection candidate before treating reflection carry-forward posture as settled.",
        ...base,
      };
    case "reflection_job_attention":
      return {
        state: "watch_reflection_job",
        driver: "reflection_job_queue",
        summary:
          "A reflection job is the leading review concern, so the current action is to watch that bounded job until it resolves.",
        nextAction:
          input.operatorReviewSummary.nextAction ??
          "Watch the current reflection job until it resolves.",
        ...base,
      };
    case "consolidation_job_attention":
      return {
        state: "watch_consolidation_job",
        driver: "consolidation_job_queue",
        summary:
          "A consolidation job is the leading review concern, so the current action is to watch that bounded job until it resolves.",
        nextAction:
          input.operatorReviewSummary.nextAction ??
          "Watch the current consolidation job until it resolves.",
        ...base,
      };
    default:
      return {
        state: "hold_review_gated",
        driver: "steady_state",
        summary:
          "No review queue is currently leading the workspace, so the current action is to keep review-first posture explicit until the next bounded review item appears.",
        nextAction:
          input.operatorReviewSummary.nextAction ??
          "Keep review-first posture explicit until the next verification, promotion, reflection, or consolidation item appears.",
        ...base,
      };
  }
}
