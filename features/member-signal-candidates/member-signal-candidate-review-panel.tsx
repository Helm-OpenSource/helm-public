"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  promoteMemberSignalCandidateToTaskAction,
  reviewMemberSignalCandidateAction,
} from "@/features/member-signal-candidates/actions";
import type { MemberSignalCandidateReviewListItem } from "@/lib/member-gateway/signal-candidate-review.service";

type MemberSignalCandidateReviewPanelProps = {
  items: MemberSignalCandidateReviewListItem[];
  governance: {
    canReview: boolean;
    canPromote: boolean;
    reviewDeniedMessage: string;
    promotionDeniedMessage: string;
  };
};

function MemberSignalCandidateRow({
  item,
  governance,
  english,
}: {
  item: MemberSignalCandidateReviewListItem;
  governance: MemberSignalCandidateReviewPanelProps["governance"];
  english: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviewNotes, setReviewNotes] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const runReview = (decision: "confirm" | "reject") => {
    startTransition(async () => {
      const result = await reviewMemberSignalCandidateAction({
        artifactBundleId: item.artifactBundleId,
        decision,
        notes: reviewNotes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        decision === "confirm"
          ? english
            ? "Candidate confirmed"
            : "候选已确认"
          : english
            ? "Candidate rejected"
            : "候选已拒绝",
      );
      router.refresh();
    });
  };

  const promote = () => {
    startTransition(async () => {
      const result = await promoteMemberSignalCandidateToTaskAction({
        artifactBundleId: item.artifactBundleId,
        title,
        description: description || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        english
          ? "Internal task entered the approval queue"
          : "内部任务已进入审批队列",
      );
      router.refresh();
    });
  };

  if (item.corrupt) {
    return (
      <article
        className="flex items-start gap-3 py-4"
        data-member-signal-candidate-contract="corrupt"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english
              ? "Candidate artifact blocked"
              : "候选产物已阻断"}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {english
              ? "This artifact failed validation and no review or promotion command is available."
              : "该产物校验失败，不提供复核或晋级命令。"}
          </p>
        </div>
      </article>
    );
  }

  const showReview = item.reviewStatus === "PENDING";
  const showPromote = item.bundleStatus === "CONFIRMED";
  const isConsumed = item.bundleStatus === "CONSUMED";

  return (
    <article
      className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]"
      data-member-signal-candidate-id={item.artifactBundleId}
    >
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Taint marker is first-class per spec §5.1 ruling 2: every
              member-upstream candidate renders this outside any collapsed
              disclosure, untruncated, ahead of any other row content. */}
          <Badge variant="danger">
            {english ? "Untrusted · member upstream" : "未信任 · 成员上行"}
          </Badge>
          {item.kind ? <Badge variant="neutral">{item.kind}</Badge> : null}
        </div>
        <div>
          {/* projectedSummary may contain [link-evidence:N] tokens. Render
              them verbatim as plain text — the tokens are not injective, so
              never linkify by matching this text. */}
          <h3 className="text-base font-semibold text-[color:var(--foreground)]">
            {item.projectedSummary ??
              (english
                ? "Member signal candidate"
                : "成员信号候选")}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            {item.memberRef ?? (english ? "Unknown member" : "成员未知")}
            {" · "}
            {item.submittedAt ?? (english ? "Submission time unknown" : "提交时间未知")}
          </p>
        </div>
      </div>

      <div className="min-w-0 border-t border-[color:var(--border)] pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        {showReview ? (
          <div className="space-y-3">
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`member-signal-candidate-review-notes-${item.artifactBundleId}`}
            >
              {english ? "Review note" : "复核备注"}
            </label>
            <Textarea
              id={`member-signal-candidate-review-notes-${item.artifactBundleId}`}
              value={reviewNotes}
              maxLength={2_000}
              onChange={(event) => setReviewNotes(event.target.value)}
              placeholder={english ? "Optional" : "可选"}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || !governance.canReview}
                onClick={() => runReview("confirm")}
                size="sm"
              >
                <Check className="h-4 w-4" />
                {english ? "Confirm candidate" : "确认候选"}
              </Button>
              <Button
                disabled={pending || !governance.canReview}
                onClick={() => runReview("reject")}
                size="sm"
                variant="secondary"
              >
                <X className="h-4 w-4" />
                {english ? "Reject" : "拒绝"}
              </Button>
            </div>
            {!governance.canReview ? (
              <p className="text-xs text-[color:var(--muted)]">
                {governance.reviewDeniedMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {showPromote ? (
          <div className="space-y-3">
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`member-signal-candidate-task-title-${item.artifactBundleId}`}
            >
              {english ? "Internal task title" : "内部任务标题"}
            </label>
            <Input
              id={`member-signal-candidate-task-title-${item.artifactBundleId}`}
              value={title}
              maxLength={175}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`member-signal-candidate-task-description-${item.artifactBundleId}`}
            >
              {english ? "Task context" : "任务上下文"}
            </label>
            <Textarea
              id={`member-signal-candidate-task-description-${item.artifactBundleId}`}
              value={description}
              maxLength={191}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
            <Button
              disabled={pending || !governance.canPromote || !title.trim()}
              onClick={promote}
              size="sm"
            >
              <Check className="h-4 w-4" />
              {english ? "Promote to internal task" : "晋级为内部任务"}
            </Button>
            {!governance.canPromote ? (
              <p className="text-xs text-[color:var(--muted)]">
                {governance.promotionDeniedMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {isConsumed ? (
          <Badge variant="neutral">
            {english ? "Promoted" : "已晋升"}
          </Badge>
        ) : null}

        {!showReview && !showPromote && !isConsumed ? (
          <p className="text-sm text-[color:var(--muted)]">
            {item.reviewStatus === "REJECTED"
              ? english
                ? "This candidate is closed as rejected."
                : "该候选已按拒绝终态关闭。"
              : english
                ? "No command is available in the current state."
                : "当前状态没有可用命令。"}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function MemberSignalCandidateReviewPanel({
  items,
  governance,
}: MemberSignalCandidateReviewPanelProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";

  return (
    <section
      className="order-5 border-y border-[color:var(--border)] py-5"
      data-member-signal-candidate-review-panel="true"
      id="member-signal-candidate-review"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="workspace-eyebrow">
            {english ? "Member signal candidates" : "成员信号候选"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
            {english
              ? "Review before task promotion"
              : "先复核，再晋级内部任务"}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
          <ShieldAlert className="h-4 w-4" />
          <span>
            {english
              ? "Untrusted member input, no auto-approval"
              : "成员上行输入未受信，无自动批准"}
          </span>
        </div>
      </div>

      {items.length ? (
        <div className="mt-4 divide-y divide-[color:var(--border)]">
          {items.map((item) => (
            <MemberSignalCandidateRow
              key={item.artifactBundleId}
              item={item}
              governance={governance}
              english={english}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          {english
            ? "No member signal candidate is waiting for review."
            : "当前没有待复核的成员信号候选。"}
        </p>
      )}
    </section>
  );
}
