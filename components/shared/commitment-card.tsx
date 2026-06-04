"use client";

import { Clock3, Link2, UserRound } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import {
  formatSharedCardDateLabel,
  formatSharedCardRelativeLabel,
} from "@/components/shared/card-date-labels";
import { getLocalizedCommitmentStatusLabels } from "@/lib/i18n/labels";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import { cn, trimText } from "@/lib/utils";

type CommitmentCardProps = {
  commitment: {
    id: string;
    title: string;
    commitmentText: string;
    status: string;
    dueDate: Date | string | null;
    overdueFlag?: boolean;
    sourceType?: string | null;
    sourceLabel?: string | null;
    ownerName?: string | null;
    targetLabel?: string | null;
    updatedAt?: Date | string | null;
  };
  className?: string;
  compact?: boolean;
};

function buildCommitmentLifecycleHint(
  commitment: CommitmentCardProps["commitment"],
  english: boolean,
) {
  if (commitment.overdueFlag) {
    return english
      ? "This commitment is already overdue, so the system keeps raising its priority in recommendations and the dashboard risk zone."
      : "这条承诺已经进入超时窗口，Helm 会在判断建议和首页风险区里持续抬高它的优先级。";
  }

  if (commitment.status === "IN_PROGRESS") {
    return english
      ? "This commitment is in progress, and the system will keep watching whether it is fulfilled on the current pace."
      : "这条承诺正在推进中，Helm 会继续观察是否按当前节奏兑现。";
  }

  if (commitment.status === "FULFILLED") {
    return english
      ? "This commitment has been fulfilled, so future recommendations will no longer treat it as pressure."
      : "这条承诺已经兑现，后续判断建议不会再把它当作推进压力。";
  }

  if (commitment.status === "CANCELED") {
    return english
      ? "This commitment was canceled. The audit trail remains, but it no longer counts as open pressure."
      : "这条承诺已经被取消，Helm 会保留审计，但不会继续把它当作未完成压力。";
  }

  return english
    ? "This commitment is still open and will continue to influence object-page recommendations and operating risk judgement."
    : "这条承诺仍未兑现，会持续影响对象页判断建议和经营风险判断。";
}

export function CommitmentCard({
  commitment,
  className,
  compact = false,
}: CommitmentCardProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const commitmentStatusLabels = getLocalizedCommitmentStatusLabels(locale);
  const statusLabel = commitment.overdueFlag
    ? english
      ? "Overdue"
      : "已逾期"
    : (commitmentStatusLabels[
        commitment.status as keyof typeof commitmentStatusLabels
      ] ?? commitment.status);
  const displayTitle = formatSeededBusinessCopy(commitment.title, english);
  const displayText = formatSeededBusinessCopy(
    commitment.commitmentText,
    english,
  );
  const displaySourceLabel = commitment.sourceLabel
    ? formatSeededBusinessCopy(commitment.sourceLabel, english)
    : null;
  const displayTargetLabel = commitment.targetLabel
    ? formatSeededBusinessCopy(commitment.targetLabel, english)
    : null;
  const badgeVariant = commitment.overdueFlag
    ? "warning"
    : commitment.status === "FULFILLED"
      ? "success"
      : commitment.status === "CANCELED"
        ? "neutral"
        : "info";

  return (
    <div
      className={cn("workspace-panel min-w-0 rounded-2xl px-4 py-4", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
          {displayTitle}
        </p>
        <Badge variant={badgeVariant}>{statusLabel}</Badge>
        {displaySourceLabel ? (
          <Badge variant="neutral">
            {english ? "Source" : "来源"}：{displaySourceLabel}
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-[color:var(--muted)]">
        {trimText(displayText, compact ? 88 : 130)}
      </p>
      <p className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_82%,var(--surface)_18%)] px-3 py-2 text-xs leading-6 text-[color:var(--muted)]">
        {buildCommitmentLifecycleHint(commitment, english)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
        <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
          <Clock3 className="h-3.5 w-3.5" />
          {english ? "Due" : "截止"}{" "}
          {formatSharedCardDateLabel(commitment.dueDate, english)}
        </span>
        {commitment.ownerName ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <UserRound className="h-3.5 w-3.5" />
            {english ? "Owner" : "责任人"} {commitment.ownerName}
          </span>
        ) : null}
        {displayTargetLabel ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <Link2 className="h-3.5 w-3.5" />
            {english ? "Target" : "影响对象"} {displayTargetLabel}
          </span>
        ) : null}
        {commitment.updatedAt ? (
          <span>
            {english ? "Last changed" : "最近变化"}{" "}
            {formatSharedCardRelativeLabel(commitment.updatedAt, english)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
