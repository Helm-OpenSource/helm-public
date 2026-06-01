import type {
  HelmV21RuntimeOperatorActionSummary,
  HelmV21RuntimeOperatorControlSummary,
  HelmV21RuntimeOperatorReviewActionSummary,
  HelmV21RuntimeOperatorWorkSummary,
} from "@/lib/helm-v2/contracts";

const RUNTIME_OPERATOR_WORK_SUMMARY_BOUNDARY_NOTE =
  "Operator work summary stays read-only, review-first, and boundary-first. It compresses the workspace-level next work item from continuity action, operator control, review queues, and operating gaps without widening authority or creating a workflow engine.";

type RuntimeOperatorWorkItem = {
  title: string;
  href: string;
  updatedAt: Date;
  operatorActionSummary: HelmV21RuntimeOperatorActionSummary;
};

export function buildRuntimeOperatorWorkSummary(input: {
  operatorActionSummary: HelmV21RuntimeOperatorActionSummary;
  operatorControlSummary: HelmV21RuntimeOperatorControlSummary;
  operatorReviewActionSummary: HelmV21RuntimeOperatorReviewActionSummary;
  continuityQueue: RuntimeOperatorWorkItem[];
  criticalOperatingGapCount: number;
}): HelmV21RuntimeOperatorWorkSummary {
  const continuityAttentionItems = input.continuityQueue.filter(
    (item) =>
      item.operatorActionSummary.state !== "keep_review_gated" &&
      item.operatorActionSummary.state !== "observe",
  );
  const continuityLead = continuityAttentionItems[0] ?? input.continuityQueue[0] ?? null;
  const counts = {
    continuityAttention: continuityAttentionItems.length,
    reviewQueue: input.operatorReviewActionSummary.counts.verificationQueue,
    promotionQueue: input.operatorReviewActionSummary.counts.promotionQueue,
    reflectionCandidates: input.operatorReviewActionSummary.counts.reflectionCandidates,
    reflectionJobs: input.operatorReviewActionSummary.counts.reflectionJobs,
    consolidationJobs: input.operatorReviewActionSummary.counts.consolidationJobs,
    criticalOperatingGaps: input.criticalOperatingGapCount,
  };

  const base = {
    actionState: input.operatorActionSummary.state,
    controlState: input.operatorControlSummary.state,
    reviewState: input.operatorReviewActionSummary.reviewState,
    reviewActionState: input.operatorReviewActionSummary.state,
    focusTitle: continuityLead?.title ?? input.operatorReviewActionSummary.focusTitle ?? null,
    focusHref: continuityLead?.href ?? input.operatorReviewActionSummary.focusHref ?? null,
    latestUpdatedAt:
      continuityLead?.updatedAt ??
      input.operatorActionSummary.latestUpdatedAt ??
      input.operatorReviewActionSummary.latestUpdatedAt ??
      input.operatorControlSummary.latestUpdatedAt,
    boundaryNote: RUNTIME_OPERATOR_WORK_SUMMARY_BOUNDARY_NOTE,
    counts,
  };

  if (input.criticalOperatingGapCount > 0) {
    return {
      state: "operating_gap_attention",
      driver: "operating_gap",
      summary: `Workspace still has ${input.criticalOperatingGapCount} critical operating gap${input.criticalOperatingGapCount === 1 ? "" : "s"}, so operator work should stay anchored on those blockers before advancing narrower runtime slices.`,
      nextAction:
        "Review the critical operating gaps first, then return to narrower runtime operator work.",
      ...base,
    };
  }

  if (continuityAttentionItems.length > 0 && continuityLead) {
    return {
      state: "continuity_attention",
      driver: "operator_action",
      summary: `${continuityLead.title} is still the highest-priority continuity thread, so the workspace-level next move is: ${continuityLead.operatorActionSummary.summary}`,
      nextAction:
        continuityLead.operatorActionSummary.nextAction ??
        "Resolve the top continuity item before widening operator attention.",
      ...base,
    };
  }

  if (
    input.operatorControlSummary.state === "execution_pending" ||
    input.operatorControlSummary.state === "execution_review" ||
    input.operatorControlSummary.state === "execution_follow_through"
  ) {
    return {
      ...base,
      state: "execution_attention",
      driver: "operator_control",
      focusTitle: input.operatorControlSummary.focusTitle,
      focusHref: input.operatorControlSummary.focusHref,
      latestUpdatedAt: input.operatorControlSummary.latestUpdatedAt,
      summary:
        "Workspace-level execution posture still needs explicit acknowledgement, review, or follow-through before the operator can treat this substrate slice as settled.",
      nextAction:
        input.operatorControlSummary.nextAction ??
        "Resolve the visible execution posture before treating the workspace as settled.",
    };
  }

  if (
    input.operatorControlSummary.state === "benchmark_requested" ||
    input.operatorControlSummary.state === "benchmark_review" ||
    input.operatorControlSummary.state === "benchmark_follow_through"
  ) {
    return {
      ...base,
      state: "benchmark_attention",
      driver: "operator_control",
      focusTitle: input.operatorControlSummary.focusTitle,
      focusHref: input.operatorControlSummary.focusHref,
      latestUpdatedAt: input.operatorControlSummary.latestUpdatedAt,
      summary:
        "Workspace-level benchmark posture still needs explicit execution, acknowledgement, or follow-through before the runtime substrate can be treated as settled.",
      nextAction:
        input.operatorControlSummary.nextAction ??
        "Resolve the visible benchmark workflow before treating the workspace as settled.",
    };
  }

  if (input.operatorReviewActionSummary.state !== "hold_review_gated") {
    return {
      ...base,
      state: "review_attention",
      driver: "review_queue",
      focusTitle: input.operatorReviewActionSummary.focusTitle,
      focusHref: input.operatorReviewActionSummary.focusHref,
      latestUpdatedAt: input.operatorReviewActionSummary.latestUpdatedAt,
      summary: input.operatorReviewActionSummary.summary,
      nextAction:
        input.operatorReviewActionSummary.nextAction ??
        "Resolve the visible review-first queue before claiming a steady workspace state.",
    };
  }

  if (
    input.operatorControlSummary.state === "review_gated" ||
    input.operatorControlSummary.state === "boundary_only"
  ) {
    return {
      state: "review_gated",
      driver: "steady_state",
      summary:
        "No urgent workspace-level operator blocker is open, so the correct posture is to keep the workspace explicitly review-gated.",
      nextAction:
        "Keep the workspace review-gated until the operator explicitly advances a narrower thread or queue.",
      ...base,
    };
  }

  return {
    state: "steady_state",
    driver: "steady_state",
    summary:
      "No immediate workspace-level operator blocker is open, so the workspace can remain under bounded observation.",
    nextAction: "Keep the workspace on bounded, review-first observation.",
    ...base,
  };
}
