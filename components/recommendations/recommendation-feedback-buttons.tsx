"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { RecommendationFeedbackType } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { submitRecommendationFeedbackAction } from "@/features/recommendations/actions";

/**
 * Inline accept / reject buttons for a recommendation, intended to be embedded
 * next to the existing `cta` (e.g. "Create action") in `RecommendationJudgementCard`.
 *
 * - Accept (APPROVED): operator agrees with the recommendation but does not need
 *   to push it through Approvals — records soft commitment via
 *   RecommendationFeedback. Does NOT create an ActionItem.
 * - Reject (REJECTED): operator dismisses the recommendation. Records audit
 *   trail via RecommendationFeedback so future ranking can learn.
 *
 * Both actions are recorded as RecommendationFeedback rows, not Commitments,
 * so Helm's "recommendation ≠ commitment" boundary stays intact.
 */
export function RecommendationFeedbackButtons({
  recommendationId,
  sourcePage,
  size = "sm",
  variant = "outline",
}: {
  recommendationId: string;
  sourcePage?: string | null;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary";
}) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [isPending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<
    null | "ACCEPTED" | "REJECTED"
  >(null);

  if (recommendationId.startsWith("fallback-") || recommendationId.startsWith("preview-")) {
    return null;
  }

  function submit(feedbackType: RecommendationFeedbackType) {
    startTransition(async () => {
      const result = await submitRecommendationFeedbackAction({
        recommendationId,
        feedbackType,
        sourcePage: sourcePage ?? undefined,
      });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Failed to record recommendation feedback"
              : "记录建议反馈失败"),
        );
        return;
      }
      setResolved(feedbackType === "APPROVED" ? "ACCEPTED" : "REJECTED");
      toast.success(
        feedbackType === "APPROVED"
          ? english
            ? "Marked as accepted"
            : "已记为采纳"
          : english
            ? "Recommendation dismissed"
            : "已驳回该建议",
      );
    });
  }

  if (resolved === "ACCEPTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
        <Check className="h-3 w-3" />
        {english ? "Accepted" : "已采纳"}
      </span>
    );
  }

  if (resolved === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--muted)]/40 bg-[color:var(--muted)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--muted-foreground)]">
        <X className="h-3 w-3" />
        {english ? "Dismissed" : "已驳回"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={isPending}
        onClick={() => submit(RecommendationFeedbackType.APPROVED)}
        title={
          english
            ? "Mark as accepted (records feedback only; does not generate an ActionItem)"
            : "记为采纳（只写反馈，不生成动作项）"
        }
      >
        <Check className="h-3.5 w-3.5" />
        {english ? "Mark accepted" : "记为采纳"}
      </Button>
      <Button
        type="button"
        size={size}
        variant="ghost"
        disabled={isPending}
        onClick={() => submit(RecommendationFeedbackType.REJECTED)}
      >
        <X className="h-3.5 w-3.5" />
        {english ? "Dismiss" : "驳回"}
      </Button>
    </div>
  );
}
