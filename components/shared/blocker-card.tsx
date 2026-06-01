"use client";

import { AlertTriangle, GaugeCircle, Link2, ScanSearch } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { formatRoleDetailDisplayText } from "@/lib/presentation/role-detail-display-copy";
import { getLocalizedBlockerStatusLabels } from "@/lib/i18n/labels";
import { cn, formatDateLabel, formatRelative, trimText } from "@/lib/utils";

type BlockerCardProps = {
  blocker: {
    id: string;
    title: string;
    blockerText: string;
    blockerType?: string | null;
    severity: number;
    status: string;
    firstSeenAt?: Date | string | null;
    updatedAt?: Date | string | null;
    sourceLabel?: string | null;
    targetLabel?: string | null;
  };
  className?: string;
  compact?: boolean;
};

function buildBlockerLifecycleHint(blocker: BlockerCardProps["blocker"], english: boolean) {
  const title = formatRoleDetailDisplayText(blocker.title, english);

  if (blocker.status === "RESOLVED") {
    return english ? "This blocker is resolved, so future recommendations will stop treating it as the main source of friction." : "这条阻塞已经被标记为解决，后续判断建议不会继续把它当作主要阻力。";
  }

  if (blocker.status === "MONITORING") {
    return english ? "This blocker is still being monitored, but the system treats it as a watch-and-escalate signal rather than a full stop." : "这条阻塞仍会被观察，但它只是“先监控、再升级”的信号，不会立即拦停所有动作。";
  }

  if (blocker.status === "IGNORED") {
    return english ? "This blocker has been temporarily downgraded. The audit record remains, but it no longer stays at the highest priority." : "这条阻塞被暂时降级处理，回放记录仍保留，但不会继续把它放在最高优先级。";
  }

  if (blocker.severity >= 80) {
    return english ? "This is a high-severity blocker, so it directly raises both risk alerts and recommendation urgency." : "这是高严重度阻塞，会直接抬高风险提示和判断建议的紧迫度。";
  }

  return english
    ? "This blocker remains part of the main resistance evidence for the object and will continue to shape briefings and next-step recommendations."
    : `“${title}”会作为当前对象的主要阻力证据，持续参与简报和下一步判断建议。`;
}

function formatBlockerType(value: string, english: boolean) {
  if (english) return value;
  const labels: Record<string, string> = {
    budget: "预算",
    legal_review: "法务复核",
    payment_cycle: "付款节奏",
    resource_conflict: "资源冲突",
    response_delay: "响应延迟",
    salary_gap: "薪酬差距",
    general: "一般阻塞",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function BlockerCard({ blocker, className, compact = false }: BlockerCardProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const blockerStatusLabels = getLocalizedBlockerStatusLabels(locale);
  const displayTitle = formatRoleDetailDisplayText(blocker.title, english);
  const displayText = formatRoleDetailDisplayText(blocker.blockerText, english);
  const displayTargetLabel = blocker.targetLabel
    ? formatRoleDetailDisplayText(blocker.targetLabel, english)
    : null;
  const severityTone =
    blocker.severity >= 80
      ? "danger"
      : blocker.severity >= 60
        ? "warning"
        : "info";
  const statusVariant =
    blocker.status === "RESOLVED"
      ? "success"
      : blocker.status === "IGNORED"
        ? "neutral"
        : blocker.status === "MONITORING"
          ? "info"
          : severityTone === "danger"
            ? "danger"
            : severityTone === "warning"
              ? "warning"
              : "info";

  return (
    <div className={cn("min-w-0 rounded-2xl border border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)]/70 px-4 py-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">{displayTitle}</p>
        <Badge variant={severityTone === "danger" ? "danger" : severityTone === "warning" ? "warning" : "info"}>
          {english ? "Severity" : "严重度"} {blocker.severity}
        </Badge>
        <Badge variant={statusVariant}>{blockerStatusLabels[blocker.status as keyof typeof blockerStatusLabels] ?? blocker.status}</Badge>
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-[color:color-mix(in_oklab,var(--foreground)_78%,#7a273a_22%)]">{trimText(displayText, compact ? 88 : 130)}</p>
      <p className="mt-3 rounded-2xl border border-[color:var(--status-danger-border)]/70 bg-[color:color-mix(in_oklab,var(--surface)_88%,white_12%)] px-3 py-2 text-xs leading-6 text-[color:color-mix(in_oklab,var(--foreground)_76%,#7a273a_24%)]">
        {buildBlockerLifecycleHint(blocker, english)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[color:color-mix(in_oklab,var(--foreground)_66%,#7a273a_34%)]">
        {blocker.blockerType ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <ScanSearch className="h-3.5 w-3.5" />
            {english ? "Type" : "类型"} {formatBlockerType(blocker.blockerType, english)}
          </span>
        ) : null}
        {blocker.firstSeenAt ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <AlertTriangle className="h-3.5 w-3.5" />
            {english ? "First seen" : "首次出现"} {formatDateLabel(blocker.firstSeenAt)}
          </span>
        ) : null}
        {displayTargetLabel ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <Link2 className="h-3.5 w-3.5" />
            {english ? "Target" : "影响对象"} {displayTargetLabel}
          </span>
        ) : null}
        {blocker.updatedAt ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <GaugeCircle className="h-3.5 w-3.5" />
            {english ? "Last changed" : "最近变化"} {formatRelative(blocker.updatedAt)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
