"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BusinessLoopGapReadoutLines } from "@/components/shared/business-loop-gap-readout-lines";
import { EmptyState } from "@/components/shared/empty-state";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import {
  SystemJudgementSummary,
  systemJudgementDetailsClassName,
} from "@/components/shared/system-judgement-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { riskTone } from "@/data/constants";
import { getLocalizedActionTypeLabels } from "@/lib/i18n/labels";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import type { BusinessLoopGapSummary } from "@/lib/operating-system";
import type { EngineeringDeliveryReview } from "@/lib/reports/engineering-delivery-review";
import { generateWeeklyReportAction } from "@/features/reports/actions";
import { formatReportDateLabel, formatReportDateRange } from "@/features/reports/date-labels";
import { formatReportDisplayText } from "@/features/reports/display-copy";
import { EngineeringDeliveryReviewPanel } from "@/features/reports/engineering-delivery-review-panel";

type ReportsClientProps = {
  reports: Array<{
    id: string;
    weekStart: Date;
    weekEnd: Date;
    summaryText: string;
    opportunitiesAdvancedCount: number;
    overdueFollowupsCount: number;
    aiSuggestionsCount: number;
    approvalsApprovedCount: number;
    openHighRiskCount: number;
    createdAt: Date;
    payload: Record<string, unknown>;
  }>;
  insightGovernance: {
    canManage: boolean;
    manageDeniedMessage: string;
  };
  businessLoopGapSummary: BusinessLoopGapSummary;
  engineeringDeliveryReview: EngineeringDeliveryReview | null;
};

type ReportView = "CURRENT" | "PREVIOUS";

function opportunityHref(id: string) {
  return `/opportunities?opportunityId=${encodeURIComponent(id)}`;
}

function isKnownRiskLevel(value: string | undefined): value is keyof typeof riskTone {
  return Boolean(value && value in riskTone);
}

const itemLinkClassName =
  "font-medium text-[color:var(--foreground)] underline-offset-4 hover:text-[color:var(--accent)] hover:underline";

export function ReportsClient({
  reports,
  insightGovernance,
  businessLoopGapSummary,
  engineeringDeliveryReview,
}: ReportsClientProps) {
  const router = useRouter();
  const { locale, demoMode } = useWorkspaceUi();
  const english = locale === "en-US";
  const pageStory = getWorkspaceStory("reports", locale, demoMode);
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
    fallbackHref: "/operating",
  });
  const actionTypeLabels = getLocalizedActionTypeLabels(locale);
  const [pending, startTransition] = useTransition();
  const [selectedView, setSelectedView] = useState<ReportView>("CURRENT");

  const dayOfWeek = new Date().getDay();
  const isBeforeThursday = dayOfWeek >= 1 && dayOfWeek <= 3;
  const currentReport = reports[0] ?? null;
  const previousReport = reports[1] ?? null;
  const earlierReport = reports[2] ?? null;
  const primaryReport = isBeforeThursday
    ? (previousReport ?? currentReport)
    : currentReport;
  const secondaryReport = isBeforeThursday
    ? (earlierReport ?? previousReport)
    : previousReport;
  const planningWindowLabel = isBeforeThursday
    ? english
      ? "This-week plan suggestion"
      : "本周计划建议"
    : english
      ? "Next-week plan suggestion"
      : "下周计划建议";
  const selected =
    selectedView === "PREVIOUS" ? (secondaryReport ?? primaryReport) : primaryReport;
  const reportText = (value: string | null | undefined) =>
    formatReportDisplayText(value, english);

  const runGenerate = (offset = 0) => {
    startTransition(async () => {
      const result = await generateWeeklyReportAction({ offset });
      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Weekly report generation failed" : "周报生成失败"),
        );
        return;
      }
      toast.success(
        offset === 0
          ? english
            ? "This week’s report has been generated"
            : "本周周报已生成"
          : english
            ? "Last week’s report has been generated"
            : "上一周周报已生成",
      );
      router.refresh();
    });
  };

  const payload = useMemo(
    () =>
      (selected?.payload ?? {}) as {
        meetingsCount?: number;
        newOpportunitiesCount?: number;
        rejectedActionsCount?: number;
        mostActiveUser?: { name: string; score: number } | null;
        overdueItems?: Array<{
          id: string;
          title: string;
          companyName?: string | null;
          dueDate?: Date | string | null;
        }>;
        highRiskItems?: Array<{
          id: string;
          title: string;
          companyName?: string | null;
          riskLevel?: string;
          nextAction?: string | null;
        }>;
        evolutionInsights?: Array<{
          id: string;
          title: string;
          summary: string;
          confidence: number;
        }>;
        evolutionRecentAdoptions?: Array<{
          id: string;
          title: string;
          summary: string;
          appliedAt?: Date | string | null;
          targetPolicyKey?: string;
          suggestedValue?: string | null;
        }>;
        highFrequencyBlockers?: Array<{
          blockerType: string;
          count: number;
          title: string;
        }>;
        rejectedRecommendationTypes?: Array<{
          actionType: keyof typeof actionTypeLabels;
          count: number;
        }>;
        recommendationMetrics?: {
          generated: number;
          explanationViews: number;
          actionCreated: number;
          accepted: number;
          rejected: number;
          editedApproved: number;
        };
        qualityMetrics?: {
          recommendation?: {
            goldenPassRate: number;
            acceptanceRate: number;
            actionCreationRate: number;
            editedApprovalRate: number;
            weakestActionTypes?: Array<{
              actionType: keyof typeof actionTypeLabels;
              generated: number;
              acceptanceRate: number;
              rejectionRate: number;
              actionCreated: number;
            }>;
          };
          memory?: {
            goldenPassRate: number;
            factHitRate: number;
            commitmentHitRate: number;
            blockerHitRate: number;
            correctionRate: number;
            topErrorModes?: Array<{ label: string; count: number }>;
          };
        };
        governanceMetrics?: {
          auditEventsCount: number;
          llmFallbackCount: number;
          averageApprovalTurnaroundHours: number;
          acceptedStrategyCount: number;
        };
        integrationMetrics?: {
          connectorHealth?: {
            connectedCount: number;
            errorCount: number;
          };
          unboundThreads?: number;
        };
      },
    [selected?.payload],
  );

  const nextWeekPlanSuggestions = useMemo(() => {
    const suggestions: Array<{
      id: string;
      title: string;
      body: string;
      variant: "warning" | "danger" | "info";
    }> = [];

    if (payload.overdueItems?.length) {
      const item = payload.overdueItems[0];
      suggestions.push({
        id: "overdue",
        title: english
          ? "Clear the oldest overdue follow-up first"
          : "先清掉最老的逾期跟进",
        body: english
          ? `${item.title} is still overdue. Start next week by closing this follow-up gap before adding more outbound actions.`
          : `${item.title} 仍处于逾期状态。下周建议先补掉这条跟进缺口，再继续增加新的外发动作。`,
        variant: "warning",
      });
    }

    if (payload.highRiskItems?.length) {
      const item = payload.highRiskItems[0];
      suggestions.push({
        id: "risk",
        title: english
          ? "Put the highest-risk object into the first review block"
          : "把最高风险对象放进下周第一轮经营会",
        body: english
          ? `${item.title} is still high risk. Make it the first object reviewed next week and force a concrete next action.`
          : `${item.title} 仍是高风险对象。建议把它放进下周第一轮经营会，并强制落一个具体下一步动作。`,
        variant: "danger",
      });
    }

    if (
      (payload.recommendationMetrics?.editedApproved ?? 0) >
      (payload.recommendationMetrics?.accepted ?? 0)
    ) {
      suggestions.push({
        id: "recommendation",
        title: english
          ? "Make suggested actions clearer before widening scope"
          : "先把动作说清楚，再扩大使用范围",
        body: english
          ? "Edited approvals are outnumbering direct acceptances. Next week should focus on responsibility, timing, and wording before expanding action coverage."
          : "编辑后采纳次数高于直接采纳，说明责任人、时机和表达还要先对齐一轮，再扩大使用范围。",
        variant: "info",
      });
    }

    if ((payload.integrationMetrics?.unboundThreads ?? 0) > 0) {
      suggestions.push({
        id: "binding",
        title: english
          ? "Attach loose threads before widening CRM input"
          : "先补信息归属，再扩大客户关系系统接入",
        body: english
          ? "Some real threads are still not attached to a customer, company, or opportunity. Reserve one block next week to clear them before widening CRM-first usage."
          : "当前仍有真实线程未绑定。建议下周先留一个时间块清理绑定债，再继续扩大客户关系系统优先使用范围。",
        variant: "warning",
      });
    }

    if ((payload.qualityMetrics?.memory?.topErrorModes?.length ?? 0) > 0) {
      suggestions.push({
        id: "memory",
        title: english
          ? "Fix the top memory error mode early next week"
          : "下周先修最高频的记忆误差",
        body: english
          ? `The system is already seeing repeated memory errors like "${payload.qualityMetrics?.memory?.topErrorModes?.[0]?.label ?? "unknown"}". Fixing that first will improve recommendation trust faster.`
          : `当前已经出现重复的记忆误差，例如“${payload.qualityMetrics?.memory?.topErrorModes?.[0]?.label ?? "未命名问题"}”。先修这一类，能更快提升建议可信度。`,
        variant: "info",
      });
    }

    return suggestions.slice(0, 4);
  }, [english, payload]);

  const overdueItems = payload.overdueItems ?? [];
  const highRiskItems = payload.highRiskItems ?? [];
  const recommendationQuality = payload.qualityMetrics?.recommendation;
  const memoryQuality = payload.qualityMetrics?.memory;
  const weekButtons = [
    primaryReport
      ? {
          view: "CURRENT" as const,
          report: primaryReport,
          ariaLabel: isBeforeThursday
            ? english
              ? "Select last week report"
              : "选择上周周报"
            : english
              ? "Select this week report"
              : "选择本周周报",
          label: isBeforeThursday
            ? english
              ? "Last week’s report"
              : "上周周报"
            : english
              ? "This week’s report"
              : "本周周报",
        }
      : null,
    secondaryReport && secondaryReport.id !== primaryReport?.id
      ? {
          view: "PREVIOUS" as const,
          report: secondaryReport,
          ariaLabel: isBeforeThursday
            ? english
              ? "Select two weeks ago report"
              : "选择上上周周报"
            : english
              ? "Select last week report"
              : "选择上周周报",
          label: isBeforeThursday
            ? english
              ? "Two weeks ago report"
              : "上上周周报"
            : english
              ? "Last week’s report"
              : "上周周报",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  // Object first: the weekly report's own lists (missed follow-ups and
  // high-risk opportunities, each linking to its opportunity), then the
  // report's summary and counts. Self-checks, patterns, plan suggestions and
  // references fold into the single closing system judgement block.
  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={pageStory.title ?? (english ? "Weekly review" : "经营复盘")}
        english={english}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={pending || !insightGovernance.canManage}
              onClick={() => runGenerate(1)}
            >
              {english ? "Generate last week’s report" : "生成上一周周报"}
            </Button>
            <Button
              disabled={pending || !insightGovernance.canManage}
              onClick={() => runGenerate(0)}
            >
              {reports.length
                ? english
                  ? "Regenerate this week’s report"
                  : "重新生成本周周报"
                : english
                  ? "Generate this week’s report"
                  : "生成本周周报"}
            </Button>
          </>
        }
      />

      {weekButtons.length > 1 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          data-reports-week-switch="true"
          role="group"
          aria-label={english ? "Weekly reports" : "周报"}
        >
          {weekButtons.map((item) => (
            <Button
              key={item.view}
              type="button"
              size="sm"
              variant={selectedView === item.view ? "default" : "secondary"}
              aria-label={item.ariaLabel}
              aria-pressed={selectedView === item.view}
              onClick={() => setSelectedView(item.view)}
            >
              {item.label}
              <span className="ml-2 text-xs font-normal opacity-80">
                {formatReportDateRange(item.report.weekStart, item.report.weekEnd, english)}
              </span>
            </Button>
          ))}
        </div>
      ) : null}

      {selected && (overdueItems.length || highRiskItems.length) ? (
        <section
          data-reports-risk-lists="true"
          className="grid gap-6 xl:grid-cols-2"
        >
          {overdueItems.length ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {english
                    ? `Missed items this week · ${overdueItems.length}`
                    : `本周遗漏事项 · ${overdueItems.length}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {overdueItems.map((item) => (
                    <li
                      key={item.id}
                      className="workspace-note-card px-4 py-4"
                      data-tone="amber"
                    >
                      <Link href={opportunityHref(item.id)} className={itemLinkClassName}>
                        {item.title}
                      </Link>
                      <p className="workspace-note-body mt-2 text-sm">
                        {item.companyName ??
                          (english ? "No linked company" : "未关联公司")}
                        {" · "}
                        {english ? "Due" : "截止"}{" "}
                        {formatReportDateLabel(item.dueDate, english)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {highRiskItems.length ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {english
                    ? `High-risk items this week · ${highRiskItems.length}`
                    : `本周高风险事项 · ${highRiskItems.length}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {highRiskItems.map((item) => (
                    <li
                      key={item.id}
                      className="workspace-note-card px-4 py-4"
                      data-tone="rose"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Link href={opportunityHref(item.id)} className={itemLinkClassName}>
                          {item.title}
                        </Link>
                        {isKnownRiskLevel(item.riskLevel) ? (
                          <RiskBadge risk={item.riskLevel} />
                        ) : (
                          <Badge variant="danger">
                            {item.riskLevel ?? (english ? "High risk" : "高风险")}
                          </Badge>
                        )}
                      </div>
                      <p className="workspace-note-body mt-2 text-sm">
                        {item.companyName ??
                          (english ? "No linked company" : "未关联公司")}
                      </p>
                      <p className="workspace-note-meta mt-2 text-sm">
                        {item.nextAction
                          ? `${english ? "Next action" : "下一步"}：${item.nextAction}`
                          : english
                            ? "No next action set"
                            : "未填写下一步"}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {selected ? (
        <Card data-weekly-report={selected.id}>
          <CardContent className="space-y-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="approval">{english ? "Summary" : "周报摘要"}</Badge>
              <Badge variant="neutral">
                {formatReportDateRange(selected.weekStart, selected.weekEnd, english)}
              </Badge>
              <span className="text-xs text-[color:var(--muted-foreground)]">
                {english
                  ? `Generated ${formatReportDateLabel(selected.createdAt, english)}`
                  : `生成于 ${formatReportDateLabel(selected.createdAt, english)}`}
              </span>
            </div>
            <p className="text-lg font-semibold leading-8 text-[color:var(--foreground)]">
              {reportText(selected.summaryText)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ReportCount
                label={english ? "Advanced opportunities" : "推进机会"}
                value={selected.opportunitiesAdvancedCount}
              />
              <ReportCount
                label={english ? "Overdue follow-ups" : "逾期跟进"}
                value={selected.overdueFollowupsCount}
              />
              <ReportCount
                label={english ? "AI suggestions" : "建议动作"}
                value={selected.aiSuggestionsCount}
              />
              <ReportCount
                label={english ? "Approved actions" : "批准动作"}
                value={selected.approvalsApprovedCount}
              />
              <ReportCount
                label={english ? "Open high-risk items" : "高风险未处理"}
                value={selected.openHighRiskCount}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Team movement this week" : "本周经营推进参与"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ReportCount
                  label={english ? "Meetings this week" : "本周会议数"}
                  value={payload.meetingsCount ?? 0}
                />
                <ReportCount
                  label={english ? "New opportunities this week" : "本周新建机会"}
                  value={payload.newOpportunitiesCount ?? 0}
                />
                <ReportCount
                  label={english ? "Rejected actions this week" : "本周拒绝动作数"}
                  value={payload.rejectedActionsCount ?? 0}
                />
                <ReportCount
                  label={english ? "Most active user" : "最活跃用户"}
                  value={payload.mostActiveUser?.name ?? (english ? "None yet" : "暂无")}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title={english ? "No weekly report yet" : "还没有生成任何周报"}
          description={
            english
              ? "Generate this week’s report with the button at the top right."
              : "点击右上角“生成本周周报”。"
          }
        />
      )}

      <details className={systemJudgementDetailsClassName} data-system-judgement>
        <SystemJudgementSummary english={english} />
        <div className="space-y-6 px-5 pb-5">
          <BusinessLoopGapReadoutLines readout={businessLoopGapReadout} english={english} />

          <JudgementSection title={planningWindowLabel}>
            {selected ? (
              nextWeekPlanSuggestions.length ? (
                <div className="space-y-3">
                  {nextWeekPlanSuggestions.map((item) => (
                    <div
                      key={item.id}
                      className="workspace-note-card px-4 py-4"
                      data-tone={
                        item.variant === "danger"
                          ? "rose"
                          : item.variant === "warning"
                            ? "amber"
                            : "sky"
                      }
                    >
                      <p className="workspace-note-title font-medium">{item.title}</p>
                      <p className="workspace-note-body mt-2 text-sm leading-6">{item.body}</p>
                    </div>
                  ))}
                </div>
              ) : null
            ) : (
              <p className="text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? "Generate this week’s report first; the plan suggestion is derived from real movement and risk."
                  : "先生成本周周报，Helm会基于真实推进和风险给出更实用的下周计划建议。"}
              </p>
            )}
          </JudgementSection>

          {selected ? (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <JudgementSection title={english ? "Review chain health" : "复核链路是否稳"}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoCell
                      label={english ? "Recorded actions" : "有记录的操作"}
                      value={String(payload.governanceMetrics?.auditEventsCount ?? 0)}
                    />
                    <InfoCell
                      label={english ? "Conservative handling" : "保守处理次数"}
                      value={String(payload.governanceMetrics?.llmFallbackCount ?? 0)}
                    />
                    <InfoCell
                      label={english ? "Average approval turnaround" : "审批平均响应"}
                      value={
                        english
                          ? `${payload.governanceMetrics?.averageApprovalTurnaroundHours ?? 0} hours`
                          : `${payload.governanceMetrics?.averageApprovalTurnaroundHours ?? 0} 小时`
                      }
                    />
                    <InfoCell
                      label={english ? "Accepted adjustments" : "已采纳调整"}
                      value={String(payload.governanceMetrics?.acceptedStrategyCount ?? 0)}
                    />
                  </div>
                </JudgementSection>

                <JudgementSection
                  title={english ? "Can real information be used?" : "真实信息接得上吗"}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoCell
                      label={english ? "Connected sources" : "已接入来源"}
                      value={String(
                        payload.integrationMetrics?.connectorHealth?.connectedCount ?? 0,
                      )}
                    />
                    <InfoCell
                      label={english ? "Sources with sync errors" : "同步异常来源"}
                      value={String(payload.integrationMetrics?.connectorHealth?.errorCount ?? 0)}
                    />
                    <InfoCell
                      label={english ? "Unattached threads" : "未归属线程"}
                      value={String(payload.integrationMetrics?.unboundThreads ?? 0)}
                    />
                  </div>
                </JudgementSection>
              </div>

              <JudgementSection
                title={english ? "Did suggestions turn into action?" : "建议有没有变成动作"}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoCell
                    label={english ? "Suggestions raised" : "提出建议"}
                    value={String(payload.recommendationMetrics?.generated ?? 0)}
                  />
                  <InfoCell
                    label={english ? "Evidence opened" : "查看依据"}
                    value={String(payload.recommendationMetrics?.explanationViews ?? 0)}
                  />
                  <InfoCell
                    label={english ? "Follow-ups created" : "建跟进"}
                    value={String(payload.recommendationMetrics?.actionCreated ?? 0)}
                  />
                  <InfoCell
                    label={english ? "Accepted" : "被采纳"}
                    value={String(payload.recommendationMetrics?.accepted ?? 0)}
                  />
                  <InfoCell
                    label={english ? "Rejected" : "被拒绝"}
                    value={String(payload.recommendationMetrics?.rejected ?? 0)}
                  />
                  <InfoCell
                    label={english ? "Edited approved" : "编辑后采纳"}
                    value={String(payload.recommendationMetrics?.editedApproved ?? 0)}
                  />
                </div>
              </JudgementSection>

              <div className="grid gap-6 xl:grid-cols-2">
                <JudgementSection
                  title={english ? "Which suggestions were trusted" : "哪些建议被采纳并推进"}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoCell
                      label={english ? "Benchmark pass rate" : "样板问题通过率"}
                      value={`${recommendationQuality?.goldenPassRate ?? 0}%`}
                    />
                    <InfoCell
                      label={english ? "Accepted directly" : "直接采纳"}
                      value={`${recommendationQuality?.acceptanceRate ?? 0}%`}
                    />
                    <InfoCell
                      label={english ? "Follow-up created" : "形成跟进行动"}
                      value={`${recommendationQuality?.actionCreationRate ?? 0}%`}
                    />
                    <InfoCell
                      label={english ? "Approved after edit" : "改写后通过"}
                      value={`${recommendationQuality?.editedApprovalRate ?? 0}%`}
                    />
                  </div>
                </JudgementSection>

                <JudgementSection
                  title={english ? "Whether meeting facts held up" : "会议事实有没有沉淀准"}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoCell
                      label={english ? "Benchmark pass rate" : "样板记录通过率"}
                      value={`${memoryQuality?.goldenPassRate ?? 0}%`}
                    />
                    <InfoCell
                      label={english ? "Facts captured" : "事实记录准确"}
                      value={`${memoryQuality?.factHitRate ?? 0}%`}
                    />
                    <InfoCell
                      label={english ? "Commitments captured" : "承诺记录准确"}
                      value={`${memoryQuality?.commitmentHitRate ?? 0}%`}
                    />
                    <InfoCell
                      label={english ? "Blockers captured" : "阻塞记录准确"}
                      value={`${memoryQuality?.blockerHitRate ?? 0}%`}
                    />
                  </div>
                </JudgementSection>
              </div>

              {payload.rejectedRecommendationTypes?.length ? (
                <JudgementSection
                  title={
                    english
                      ? "Action types the team still does not trust"
                      : "团队还不信任的动作类型"
                  }
                >
                  <ul className="space-y-2">
                    {payload.rejectedRecommendationTypes.map((item) => (
                      <li
                        key={item.actionType}
                        className="theme-surface-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                      >
                        <span className="font-medium text-[color:var(--foreground)]">
                          {actionTypeLabels[item.actionType]}
                        </span>
                        <Badge variant="warning">
                          {english ? `${item.count} rejected` : `被拒 ${item.count} 次`}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </JudgementSection>
              ) : null}

              {recommendationQuality?.weakestActionTypes?.length ? (
                <JudgementSection
                  title={
                    english ? "Action types to tune next week" : "下周最该调顺的动作类型"
                  }
                >
                  <ul className="space-y-2">
                    {recommendationQuality.weakestActionTypes.map((item) => (
                      <li
                        key={item.actionType}
                        className="theme-surface-panel rounded-2xl px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[color:var(--foreground)]">
                            {actionTypeLabels[item.actionType]}
                          </span>
                          <Badge variant="warning">
                            {english ? `${item.generated} items` : `${item.generated} 条`}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {english
                            ? `Acceptance ${item.acceptanceRate}% · Rejection ${item.rejectionRate}% · Actions created ${item.actionCreated}`
                            : `采纳率 ${item.acceptanceRate}% · 拒绝率 ${item.rejectionRate}% · 生成动作 ${item.actionCreated} 次`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </JudgementSection>
              ) : null}

              {memoryQuality?.topErrorModes?.length ? (
                <JudgementSection
                  title={english ? "Where meeting records go wrong" : "会议记录最容易错在哪里"}
                >
                  <ul className="space-y-2">
                    {memoryQuality.topErrorModes.map((item) => (
                      <li
                        key={item.label}
                        className="theme-surface-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                      >
                        <span className="font-medium text-[color:var(--foreground)]">
                          {item.label}
                        </span>
                        <Badge variant="warning">{item.count}</Badge>
                      </li>
                    ))}
                  </ul>
                </JudgementSection>
              ) : null}

              {payload.highFrequencyBlockers?.length ? (
                <JudgementSection title={english ? "High-frequency blockers" : "高频阻塞"}>
                  <ul className="space-y-2">
                    {payload.highFrequencyBlockers.map((item) => (
                      <li
                        key={item.blockerType}
                        className="workspace-note-card px-4 py-3"
                        data-tone="rose"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="workspace-note-title font-medium">
                            {reportText(item.blockerType)}
                          </span>
                          <Badge variant="danger">
                            {english ? `${item.count} times` : `${item.count} 次`}
                          </Badge>
                        </div>
                        <p className="workspace-note-body mt-2 text-sm">{item.title}</p>
                      </li>
                    ))}
                  </ul>
                </JudgementSection>
              ) : null}

              {payload.evolutionInsights?.length ? (
                <JudgementSection
                  title={english ? "Movement patterns this week" : "本周出现的推进规律"}
                >
                  <ul className="space-y-2">
                    {payload.evolutionInsights.map((item) => (
                      <li
                        key={item.id}
                        className="workspace-note-card px-4 py-3"
                        data-tone="violet"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="workspace-note-title font-medium">{item.title}</span>
                          <Badge variant="approval">
                            {english ? "Confidence" : "置信度"} {item.confidence}
                          </Badge>
                        </div>
                        <p className="workspace-note-body mt-2 text-sm leading-6">
                          {item.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                </JudgementSection>
              ) : null}

              {payload.evolutionRecentAdoptions?.length ? (
                <JudgementSection
                  title={
                    english ? "Operating habits already adopted" : "最近已经生效的经营习惯"
                  }
                >
                  <ul className="space-y-2">
                    {payload.evolutionRecentAdoptions.map((item) => (
                      <li
                        key={item.id}
                        className="workspace-note-card px-4 py-3"
                        data-tone="emerald"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="workspace-note-title font-semibold">
                            {item.title}
                          </span>
                          <Badge variant="success">{english ? "Adopted" : "已收敛"}</Badge>
                        </div>
                        <p className="workspace-note-body mt-2 text-sm leading-7">
                          {item.summary}
                        </p>
                        {item.suggestedValue || item.appliedAt ? (
                          <p className="workspace-note-meta mt-2 text-xs">
                            {[
                              item.suggestedValue
                                ? `${english ? "New value" : "新值"}：${item.suggestedValue}`
                                : null,
                              item.appliedAt
                                ? `${english ? "Effective at" : "生效于"} ${formatReportDateLabel(item.appliedAt, english)}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </JudgementSection>
              ) : null}

              <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                {english
                  ? "Sources include opportunity movement, approval records, meetings, daily usage snapshots and event telemetry."
                  : "数据来源包括机会推进、审批记录、会议、每日使用快照和使用信号。"}
              </p>
            </>
          ) : null}

          {!insightGovernance.canManage ? (
            <LazyDisclosure title={english ? "Reference: insight permission" : "引用：洞察权限"}>
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>
                    {english ? "Read-only insight governance posture" : "当前洞察治理为只读"}
                  </CardTitle>
                  <CardDescription>{insightGovernance.manageDeniedMessage}</CardDescription>
                </CardHeader>
              </Card>
            </LazyDisclosure>
          ) : null}

          {engineeringDeliveryReview ? (
            <LazyDisclosure title={english ? "Reference: delivery review" : "引用：交付评审"}>
              <EngineeringDeliveryReviewPanel
                review={engineeringDeliveryReview}
                english={english}
              />
            </LazyDisclosure>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function ReportCount({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function JudgementSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{title}</h3>
      {children}
    </section>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
