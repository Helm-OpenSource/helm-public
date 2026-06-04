import { FolderGit2, ShieldAlert, Users } from "lucide-react";
import { BusinessFirstSurfaceSummary } from "@/components/shared/business-first-surface-summary";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EngineeringDeliveryReview } from "@/lib/reports/engineering-delivery-review";
import { initials, trimText } from "@/lib/utils";

const badgeVariantMap = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "neutral",
} as const;

export function EngineeringDeliveryReviewPanel({
  review,
  english,
}: {
  review: EngineeringDeliveryReview;
  english: boolean;
}) {
  if (review.availability !== "READY") {
    return (
      <Card className="workspace-panel-muted border-dashed">
        <CardHeader>
          <CardTitle>
            {english ? "Engineering delivery review" : "工程交付复盘"}
          </CardTitle>
          <CardDescription>{review.sourceNote}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EmptyState
            icon={FolderGit2}
            title={review.headline}
            description={`${review.summary} ${review.boundaryNote}`}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="workspace-surface-stack">
      <BusinessFirstSurfaceSummary
        english={english}
        label={english ? "Engineering delivery summary" : "工程交付摘要"}
        title={review.headline}
        summary={review.summary}
        snapshot={review.snapshot}
        connectionsLabel={english ? "Connected review signals" : "关联判断信号"}
        connections={review.connections}
      />
      {review.freshness ? (
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-[color:var(--foreground)]">
                {english
                  ? `Updated at: ${formatFreshnessDate(review.freshness.generatedAt, true)}`
                  : `数据更新时间：${formatFreshnessDate(review.freshness.generatedAt, false)}`}
              </p>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                {english
                  ? `Revision: ${review.freshness.sourceRevision ?? "unknown"}`
                  : `Revision：${review.freshness.sourceRevision ?? "未知"}`}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Contributor review" : "贡献者复盘"}
            </CardTitle>
            <CardDescription>
              {english
                ? `Read quantity, closure, direction, and working style together across ${review.windowLabel.toLowerCase()}.`
                : `在 ${review.windowLabel} 里，把数量、闭环、方向和工作方式放在一起判断。`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {review.contributors.map((contributor) => (
              <div
                key={`${contributor.name}-${contributor.email}`}
                className="rounded-[24px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_88%,white_12%)] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,var(--accent-soft)_12%)] text-sm font-semibold text-[color:var(--foreground)]">
                      {initials(contributor.name)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {contributor.name}
                        </p>
                        <Badge variant={badgeVariantMap[contributor.badgeTone]}>
                          {contributor.quantityJudgement}
                        </Badge>
                      </div>
                      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {english
                          ? "Review this lane by direction, closure and next action."
                          : "先看方向、闭环和下一步动作。"}
                      </p>
                    </div>
                  </div>
                  <div className="max-w-sm rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_90%,white_10%)] px-3 py-3">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {english ? "Latest visible move" : "最近可见动作"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                      {trimText(contributor.latestSubject, 96)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-sm leading-7 text-[color:var(--foreground)]">
                    {contributor.contentSummary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contributor.focusLabels.map((focus) => (
                      <Badge key={focus} variant="neutral">
                        {focus}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <JudgementBlock
                    label={english ? "Quality" : "质量"}
                    value={contributor.qualityJudgement}
                  />
                  <JudgementBlock
                    label={english ? "Direction" : "方向"}
                    value={contributor.directionJudgement}
                  />
                  <JudgementBlock
                    label={english ? "Delivery sufficiency" : "交付充分度"}
                    value={contributor.deliveryJudgement}
                  />
                  <JudgementBlock
                    label={english ? "Working style" : "工作方式"}
                    value={contributor.workingStyle}
                  />
                </div>

                <div className="mt-4 rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_90%,var(--accent-soft)_10%)] px-4 py-4">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Suggested next improvement" : "建议下一步改进"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                    {contributor.suggestion}
                  </p>
                </div>

                <ContributorEvidenceDisclosure
                  contributor={contributor}
                  english={english}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="workspace-surface-stack">
          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Collaboration readout" : "团队协同读数"}
              </CardTitle>
              <CardDescription>{review.collaboration.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SignalBlock
                icon={Users}
                label={english ? "Shared hotspots" : "共享热点"}
                items={review.collaboration.hotspots}
              />
              <SignalBlock
                icon={ShieldAlert}
                label={english ? "Risks to keep visible" : "需要保持可见的风险"}
                items={review.collaboration.risks}
              />
              {review.collaboration.overlapPairs.length ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Shared-file pairs" : "共享文件组合"}
                  </p>
                  <div className="space-y-3">
                    {review.collaboration.overlapPairs.map((pair) => (
                      <div
                        key={pair.label}
                        className="rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {pair.label}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {pair.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="rounded-[20px] border border-dashed border-[color:var(--border)] px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Boundary" : "边界"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
                  {review.boundaryNote}
                </p>
                <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {review.sourceNote}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {english ? "Team improvement suggestions" : "团队改进建议"}
              </CardTitle>
              <CardDescription>
                {english
                  ? "These are management suggestions derived from the current repository history, not automatic decisions."
                  : "这些只是基于当前仓库历史的管理建议，不是自动决策。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {review.suggestions.map((suggestion) => (
                <div
                  key={suggestion.title}
                  className="rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {suggestion.title}
                    </p>
                    <Badge
                      variant={
                        suggestion.priority === "HIGH"
                          ? "danger"
                          : suggestion.priority === "MEDIUM"
                            ? "warning"
                            : "info"
                      }
                    >
                      {formatSuggestionPriority(suggestion.priority, english)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {suggestion.body}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatFreshnessDate(value: string | null, english: boolean) {
  if (!value) {
    return english ? "not recorded" : "未记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(english ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatSuggestionPriority(
  priority: EngineeringDeliveryReview["suggestions"][number]["priority"],
  english: boolean,
) {
  if (english) {
    if (priority === "HIGH") return "High priority";
    if (priority === "MEDIUM") return "Medium priority";
    return "Low priority";
  }
  if (priority === "HIGH") return "高优先级";
  if (priority === "MEDIUM") return "中优先级";
  return "低优先级";
}

function ContributorEvidenceDisclosure({
  contributor,
  english,
}: {
  contributor: EngineeringDeliveryReview["contributors"][number];
  english: boolean;
}) {
  return (
    <details className="group mt-4 rounded-[20px] border border-dashed border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_94%,white_6%)] px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--foreground)]">
        <span>{english ? "Evidence details" : "查看证据明细"}</span>
        <span className="text-xs text-[color:var(--muted-foreground)] transition group-open:rotate-180">
          {english ? "expand" : "展开"}
        </span>
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <EvidenceItem
          label={english ? "Contributor identity" : "贡献者标识"}
          value={contributor.email}
          detail={
            english
              ? "Kept as evidence, not as the primary review signal."
              : "作为证据保留，不作为首要判断信号。"
          }
        />
        {contributor.metricCards.map((metric) => (
          <EvidenceItem
            key={`${contributor.name}-${metric.label}`}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
          />
        ))}
      </div>
    </details>
  );
}

function EvidenceItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-3 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[color:var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
        {detail}
      </p>
    </div>
  );
}

function JudgementBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-3 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function SignalBlock({
  icon: Icon,
  label,
  items,
}: {
  icon: typeof Users;
  label: string;
  items: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-full border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] p-2 text-[color:var(--muted-foreground)]">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
          {label}
        </p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-[20px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-3 py-3"
          >
            <p className="text-sm leading-7 text-[color:var(--foreground)]">
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
