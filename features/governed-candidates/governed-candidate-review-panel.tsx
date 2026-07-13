"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  Check,
  ExternalLink,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  promoteGovernedCandidateToTaskAction,
  reviewGovernedCandidateAction,
} from "@/features/governed-candidates/actions";
import type { GovernedCandidateReviewListItem } from "@/lib/governed-intelligence/governed-candidate-review";

type GovernedCandidateReviewPanelProps = {
  items: GovernedCandidateReviewListItem[];
  governance: {
    canReview: boolean;
    canPromote: boolean;
    reviewDeniedMessage: string;
    promotionDeniedMessage: string;
  };
};

function statusLabel(item: GovernedCandidateReviewListItem, english: boolean) {
  if (item.contractStatus === "invalid") {
    return english ? "Contract blocked" : "契约阻断";
  }
  if (item.promotion) return english ? "Pending task approval" : "任务待审批";
  if (item.reviewStatus === "CONFIRMED") {
    return english ? "Human confirmed" : "人工已确认";
  }
  if (item.reviewStatus === "REJECTED") {
    return english ? "Rejected" : "已拒绝";
  }
  return english ? "Pending candidate review" : "候选待复核";
}

function CandidateReviewRow({
  item,
  governance,
  english,
}: {
  item: GovernedCandidateReviewListItem;
  governance: GovernedCandidateReviewPanelProps["governance"];
  english: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const defaultTitle = item.candidate?.nextSafeActions[0] ?? "";
  const [reviewNotes, setReviewNotes] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");

  const runReview = (decision: "confirm" | "reject") => {
    startTransition(async () => {
      const result = await reviewGovernedCandidateAction({
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
      const result = await promoteGovernedCandidateToTaskAction({
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

  if (!item.candidate) {
    return (
      <article
        className="flex items-start gap-3 py-4"
        data-governed-candidate-contract="invalid"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Candidate contract blocked" : "候选契约已阻断"}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {english
              ? "No review or promotion command is available for this artifact."
              : "该产物不提供复核或晋级命令。"}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article
      className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]"
      data-governed-candidate-id={item.candidate.candidateId}
    >
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.contractStatus === "valid" ? "info" : "danger"}>
            {statusLabel(item, english)}
          </Badge>
          <Badge variant="neutral">
            {english ? "Confidence" : "置信度"} {item.candidate.confidence}
          </Badge>
          <span className="truncate text-xs text-[color:var(--muted)]">
            {item.candidate.objectType} · {item.candidate.objectId}
          </span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-[color:var(--foreground)]">
            {item.candidate.nextSafeActions[0] ??
              (english ? "Governed judgement candidate" : "受治理判断候选")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? `${item.candidate.evidenceRefs.length} verified evidence reference(s); ${item.candidate.missingEvidence.length} open evidence gap(s).`
              : `${item.candidate.evidenceRefs.length} 条已验证证据引用，${item.candidate.missingEvidence.length} 个待补证据缺口。`}
          </p>
        </div>

        <details className="border-l-2 border-[color:var(--border)] pl-3 text-sm">
          <summary className="cursor-pointer font-medium text-[color:var(--foreground)]">
            {english ? "Evidence and counter-check" : "证据与反证检查"}
          </summary>
          <div className="mt-3 grid gap-3 text-[color:var(--muted)] md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[color:var(--foreground)]">
                {english ? "Missing evidence" : "待补证据"}
              </p>
              <ul className="mt-2 space-y-1">
                {item.candidate.missingEvidence.length ? (
                  item.candidate.missingEvidence.map((gap) => (
                    <li key={gap.gapId}>{gap.missingSignalNote}</li>
                  ))
                ) : (
                  <li>{english ? "No recorded gap" : "暂无已记录缺口"}</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-[color:var(--foreground)]">
                {english ? "Counter-check" : "反证检查"}
              </p>
              <ul className="mt-2 space-y-1">
                {item.candidate.counterEvidenceNeeded.length ? (
                  item.candidate.counterEvidenceNeeded.map((line) => (
                    <li key={line}>{line}</li>
                  ))
                ) : (
                  <li>{english ? "No additional counter-check" : "暂无额外反证项"}</li>
                )}
              </ul>
            </div>
          </div>
        </details>
      </div>

      <div className="min-w-0 border-t border-[color:var(--border)] pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        {item.canReview ? (
          <div className="space-y-3">
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`candidate-review-notes-${item.artifactBundleId}`}
            >
              {english ? "Review note" : "复核备注"}
            </label>
            <Textarea
              id={`candidate-review-notes-${item.artifactBundleId}`}
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

        {item.canPromote ? (
          <div className="space-y-3">
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`candidate-task-title-${item.artifactBundleId}`}
            >
              {english ? "Internal task title" : "内部任务标题"}
            </label>
            <Input
              id={`candidate-task-title-${item.artifactBundleId}`}
              value={title}
              maxLength={191}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label
              className="block text-xs font-medium text-[color:var(--muted)]"
              htmlFor={`candidate-task-description-${item.artifactBundleId}`}
            >
              {english ? "Task context" : "任务上下文"}
            </label>
            <Textarea
              id={`candidate-task-description-${item.artifactBundleId}`}
              value={description}
              maxLength={4_000}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
            <Button
              disabled={pending || !governance.canPromote || !title.trim()}
              onClick={promote}
              size="sm"
            >
              <ArrowUpRight className="h-4 w-4" />
              {english ? "Promote to internal task" : "晋级为内部任务"}
            </Button>
            {!governance.canPromote ? (
              <p className="text-xs text-[color:var(--muted)]">
                {governance.promotionDeniedMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {item.promotion ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/approvals?approvalId=${item.promotion.approvalTaskId}`}>
              <ExternalLink className="h-4 w-4" />
              {english ? "Open task approval" : "打开任务审批"}
            </Link>
          </Button>
        ) : null}

        {!item.canReview && !item.canPromote && !item.promotion ? (
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

export function GovernedCandidateReviewPanel({
  items,
  governance,
}: GovernedCandidateReviewPanelProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";

  return (
    <section
      className="order-5 border-y border-[color:var(--border)] py-5"
      data-governed-candidate-review-panel="true"
      id="governed-candidate-review"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="workspace-eyebrow">
            {english ? "Judgement candidates" : "判断候选"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
            {english ? "Review before task promotion" : "先复核，再晋级内部任务"}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
          <ShieldAlert className="h-4 w-4" />
          <span>
            {english
              ? "No auto-approval or external effect"
              : "无自动批准，无外部副作用"}
          </span>
        </div>
      </div>

      {items.length ? (
        <div className="mt-4 divide-y divide-[color:var(--border)]">
          {items.map((item) => (
            <CandidateReviewRow
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
            ? "No governed judgement candidate is waiting for review."
            : "当前没有待复核的受治理判断候选。"}
        </p>
      )}
    </section>
  );
}
