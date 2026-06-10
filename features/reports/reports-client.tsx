"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLocalizedActionTypeLabels } from "@/lib/i18n/labels";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";
import type {
  BusinessLoopGapSummary,
  WorkspaceFirstLoopModel,
} from "@/lib/operating-system";
import type { EngineeringDeliveryReview } from "@/lib/reports/engineering-delivery-review";
import { generateWeeklyReportAction } from "@/features/reports/actions";
import { formatReportDateLabel, formatReportDateRange } from "@/features/reports/date-labels";
import { formatReportDisplayText } from "@/features/reports/display-copy";
import { EngineeringDeliveryReviewPanel } from "@/features/reports/engineering-delivery-review-panel";
import type { FirstLoopAdoptionSummary } from "@/features/diagnostics/first-loop-adoption";

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
  firstLoopModel: WorkspaceFirstLoopModel;
  firstLoopAdoption: FirstLoopAdoptionSummary;
};

type ReportFocus = "ALL" | "ADVANCED" | "OVERDUE" | "AI" | "APPROVED" | "RISK";
type ReportView = "CURRENT" | "PREVIOUS" | "NEXT_PLAN";

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
  const [focus, setFocus] = useState<ReportFocus>("ALL");

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
    selectedView === "CURRENT"
      ? primaryReport
      : selectedView === "PREVIOUS"
        ? secondaryReport
        : (primaryReport ?? secondaryReport);
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

  const focusMeta = useMemo(() => {
    const map: Record<ReportFocus, { label: string; description: string }> = {
      ALL: {
        label: english ? "All manager signals" : "全部汇报视角",
        description: english
          ? "Read the full report across movement, missed follow-up, accepted work and risk."
          : "查看完整周报，覆盖推进、遗漏、执行闭环和高风险事项。",
      },
      ADVANCED: {
        label: english ? "Advanced opportunities" : "推进机会",
        description: english
          ? "Focus only on momentum signals that prove opportunities are actually moving."
          : "只看真正证明机会在向前推进的信号。",
      },
      OVERDUE: {
        label: english ? "Overdue follow-ups" : "逾期跟进",
        description: english
          ? "Focus on missed follow-through and the objects that are leaking rhythm."
          : "只看逾期和正在漏节奏的对象。",
      },
      AI: {
        label: english ? "Suggested actions" : "建议动作",
        description: english
          ? "Focus on whether suggested actions were reviewed, assigned, accepted or rejected."
          : "只看建议有没有被查看依据、分派、采纳或拒绝。",
      },
      APPROVED: {
        label: english ? "Approved actions" : "批准动作",
        description: english
          ? "Focus on what has already passed approval and entered execution."
          : "只看已经通过审批并进入执行链的动作。",
      },
      RISK: {
        label: english ? "Open high-risk items" : "高风险未处理",
        description: english
          ? "Focus on high-risk objects that deserve immediate operating attention."
          : "只看需要立即关注的高风险对象。",
      },
    };

    return map[focus];
  }, [english, focus]);

  const showAdvanced = focus === "ALL" || focus === "ADVANCED";
  const showOverdue = focus === "ALL" || focus === "OVERDUE";
  const showAi = focus === "ALL" || focus === "AI";
  const showApproved = focus === "ALL" || focus === "APPROVED";
  const showRisk = focus === "ALL" || focus === "RISK";
  const overdueCount =
    payload.overdueItems?.length ?? selected?.overdueFollowupsCount ?? 0;
  const highRiskCount =
    payload.highRiskItems?.length ?? selected?.openHighRiskCount ?? 0;
  const acceptedWorkCount =
    payload.recommendationMetrics?.accepted ??
    selected?.approvalsApprovedCount ??
    0;
  const reportWindowLabel = selected
    ? formatReportDateRange(selected.weekStart, selected.weekEnd, english)
    : english
      ? "No review asset yet"
      : "还没有复盘资产";
  const reportAssetFocusItems = [
    {
      label: english ? "Current asset" : "当前资产",
      value: selected
        ? selectedView === "NEXT_PLAN"
          ? planningWindowLabel
          : reportWindowLabel
        : english
          ? "No weekly review generated"
          : "还没有生成周报",
      detail: selected
        ? reportText(selected.summaryText)
        : english
          ? "Generate one review before reading downstream judgement."
          : "先生成一份复盘，再读下游判断。",
      tone: selected ? "success" : "warning",
    },
    {
      label: english ? "Pressure" : "当前压力",
      value: english
        ? `${overdueCount} overdue · ${highRiskCount} high-risk`
        : `${overdueCount} 条逾期 · ${highRiskCount} 个高风险`,
      detail:
        overdueCount + highRiskCount > 0
          ? english
            ? "Clear these before widening new work."
            : "先清这些，再扩大新动作。"
          : english
            ? "No visible overdue or high-risk pressure in this report."
            : "这份复盘里没有明显逾期或高风险压力。",
      href: highRiskCount > 0 || overdueCount > 0 ? "/approvals" : undefined,
      tone: highRiskCount > 0 ? "danger" : overdueCount > 0 ? "warning" : "success",
    },
    {
      label: english ? "Decision" : "待决策",
      value: selected
        ? english
          ? `${acceptedWorkCount} accepted · owner focus`
          : `${acceptedWorkCount} 条已采纳 · 定负责人优先级`
        : english
          ? "Generate the review first"
          : "先生成本周复盘",
      detail:
        businessLoopGapReadout.pendingDecision ??
        (english
          ? "Pick the object that needs owner attention before reading archive metrics."
          : "先定哪个对象需要负责人看，再读归档指标。"),
      href: businessLoopGapReadout.connection?.href ?? "/operating",
      tone: businessLoopGapReadout.pendingDecision ? "warning" : "info",
    },
    {
      label: english ? "Next action" : "下一步动作",
      value: selected
        ? english
          ? "Open the risky object"
          : "打开风险对象"
        : english
          ? "Generate this week’s report"
          : "生成本周周报",
      detail: selected
        ? businessLoopGapReadout.nextAction ??
          (english
            ? "Use the report as an operating draft, not a dashboard archive."
            : "把周报当经营草案，不当看板归档。")
        : english
          ? "The generation action stays under the page controls."
          : "生成动作仍在页面按钮里完成。",
      href: selected ? "/dashboard" : undefined,
      tone: "info",
    },
  ] as const;

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={pageStory.title ?? (english ? "Weekly operating review" : "本周经营复盘")}
        description={pageStory.description}
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

      <CustomerAssetFocusStrip
        eyebrow={english ? "Operating asset" : "经营资产"}
        title={
          selected
            ? english
              ? "Start with the review asset, not report mechanics."
              : "先看复盘资产，不看周报机制。"
            : english
              ? "Create the first review asset before reading signals."
              : "先生成第一份复盘资产，再读经营信号。"
        }
        summary={
          selected
            ? english
              ? "The first screen should tell a manager which customer or operating object needs attention now."
              : "首屏只回答：当前哪类客户或经营对象需要负责人立刻看。"
            : english
              ? "No report asset exists yet, so the only useful action is to generate one."
              : "还没有周报资产时，最有价值的动作就是先生成。"
        }
        items={[...reportAssetFocusItems]}
        primaryAction={
          selected
            ? { label: english ? "Open work queue" : "打开待处理", href: "/approvals" }
            : null
        }
        secondaryAction={
          selected
            ? { label: english ? "Open dashboard" : "回到今日推进", href: "/dashboard" }
            : null
        }
      />

      {!insightGovernance.canManage ? (
        <LazyDisclosure title={english ? "Reference: insight permission" : "引用：洞察权限"}>
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>
                {english
                  ? "Read-only insight governance posture"
                  : "当前洞察治理为只读"}
              </CardTitle>
              <CardDescription>
                {insightGovernance.manageDeniedMessage}
              </CardDescription>
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

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Reports" : "周报列表"}</CardTitle>
            <CardDescription>
              {english
                ? "Switch between this week, last week and the next-week plan suggestion."
                : "可以快速切换查看本周、上周和下周计划建议。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {primaryReport ? (
              <button
                type="button"
                aria-label={
                  isBeforeThursday
                    ? english
                      ? "Select last week report"
                      : "选择上周周报"
                    : english
                      ? "Select this week report"
                      : "选择本周周报"
                }
                onClick={() => {
                  setSelectedView("CURRENT");
                  setFocus("ALL");
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedView === "CURRENT" ? "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_78%,var(--accent-soft)_22%)]" : "border-[color:var(--border)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {isBeforeThursday
                      ? english
                        ? "Last week’s report"
                        : "上周周报"
                      : english
                        ? "This week’s report"
                        : "本周周报"}
                  </p>
                  <Badge variant="info">
                    {isBeforeThursday
                      ? english
                        ? "Last week"
                        : "上周"
                      : english
                        ? "This week"
                        : "本周"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {reportText(primaryReport.summaryText)}
                </p>
                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                  {formatReportDateRange(primaryReport.weekStart, primaryReport.weekEnd, english)}
                </p>
              </button>
            ) : null}
            {secondaryReport ? (
              <button
                type="button"
                aria-label={
                  isBeforeThursday
                    ? english
                      ? "Select two weeks ago report"
                      : "选择上上周周报"
                    : english
                      ? "Select last week report"
                      : "选择上周周报"
                }
                onClick={() => {
                  setSelectedView("PREVIOUS");
                  setFocus("ALL");
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedView === "PREVIOUS" ? "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_78%,var(--accent-soft)_22%)]" : "border-[color:var(--border)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {isBeforeThursday
                      ? english
                        ? "Two weeks ago report"
                        : "上上周周报"
                      : english
                        ? "Last week’s report"
                        : "上周周报"}
                  </p>
                  <Badge variant="neutral">
                    {isBeforeThursday
                      ? english
                        ? "Two weeks ago"
                        : "上上周"
                      : english
                        ? "Last week"
                        : "上周"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {reportText(secondaryReport.summaryText)}
                </p>
                <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                  {formatReportDateRange(secondaryReport.weekStart, secondaryReport.weekEnd, english)}
                </p>
              </button>
            ) : null}
            {selected ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedView("NEXT_PLAN");
                  setFocus("ALL");
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedView === "NEXT_PLAN" ? "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_78%,var(--accent-soft)_22%)]" : "border-[color:var(--border)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {planningWindowLabel}
                  </p>
                  <Badge variant="approval">{english ? "Plan" : "建议"}</Badge>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {isBeforeThursday
                    ? english
                      ? "Use this as the owner's operating draft for the current week, based on the latest movement, risk, and accepted actions."
                      : "基于最新推进、风险和已采纳动作，给负责人一版本周工作计划建议。"
                    : english
                      ? "Use this as the owner's first planning draft for next week, based on this week's movement, risk, and accepted actions."
                      : "基于本周推进、风险和已采纳动作，给负责人一版下周工作计划建议。"}
                </p>
              </button>
            ) : (
              <EmptyState
                title={english ? "No weekly report yet" : "还没有生成任何周报"}
                description={
                  english
                    ? "Click the top-right button to generate this week’s report. The system will aggregate momentum, approvals and risk data automatically."
                    : "先点击右上角“生成本周周报”，再汇总一周内的推进、审批和风险数据。"
                }
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selected ? (
            <>
              {selectedView === "NEXT_PLAN" ? (
                <>
                  <Card className="workspace-panel-muted">
                    <CardContent className="space-y-3 py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="approval">{planningWindowLabel}</Badge>
                        <Badge variant="neutral">
                          {english
                            ? `Based on ${formatReportDateRange(selected.weekStart, selected.weekEnd, english)}`
                            : `基于 ${formatReportDateRange(selected.weekStart, selected.weekEnd, english)}`}
                        </Badge>
                      </div>
                      <p className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                        {isBeforeThursday
                          ? english
                            ? "Start this week by clearing overdue follow-up, containing high-risk work, and turning accepted suggestions into assigned actions."
                            : "本周先补逾期跟进、压住高风险对象，再把已采纳建议落到责任人。"
                          : english
                            ? "Start next week by clearing overdue follow-up, containing high-risk work, and turning accepted suggestions into assigned actions."
                            : "下周先补逾期跟进、压住高风险对象，再把已采纳建议落到责任人。"}
                      </p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {isBeforeThursday
                          ? english
                            ? "This is a manager-facing action draft for the current week, derived from the latest movement, risk, and accepted-action signals."
                            : "这是一版面向负责人的本周行动草案，基于最新真实推进、风险和已采纳动作推出来。"
                          : english
                            ? "Manager-facing action draft, derived from this week’s real movement, risk, and accepted-action signals."
                            : "面向负责人的下周行动草案，基于本周真实推进、风险和已采纳动作。"}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCell
                      label={english ? "Need to clear first" : "优先清理"}
                      value={String(payload.overdueItems?.length ?? 0)}
                    />
                    <InfoCell
                      label={english ? "High-risk to review" : "优先复盘高风险"}
                      value={String(payload.highRiskItems?.length ?? 0)}
                    />
                    <InfoCell
                      label={
                        english ? "Actions to tune" : "需要调顺的动作"
                      }
                      value={String(
                        payload.qualityMetrics?.recommendation
                          ?.weakestActionTypes?.length ?? 0,
                      )}
                    />
                    <InfoCell
                      label={english ? "Loose information to attach" : "需要归属的信息"}
                      value={String(
                        (payload.integrationMetrics?.unboundThreads ?? 0) > 0
                          ? 1
                          : 0,
                      )}
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>{planningWindowLabel}</CardTitle>
                      <CardDescription>
                        {isBeforeThursday
                          ? english
                            ? "First operating draft for the current week. Refine it in the team operating review."
                            : "本周经营安排的第一版草案，团队经营会上再细化。"
                          : english
                            ? "First operating draft for next week. Refine it in the team operating review."
                            : "下周经营安排的第一版草案，团队经营会上再细化。"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {nextWeekPlanSuggestions.length ? (
                        nextWeekPlanSuggestions.map((item) => (
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
                            <p className="workspace-note-title font-medium">
                              {item.title}
                            </p>
                            <p className="workspace-note-body mt-2 text-sm leading-6">
                              {item.body}
                            </p>
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          title={
                            english
                              ? "Need this week’s report first"
                              : "先生成本周周报"
                          }
                          description={
                            english
                              ? "After the current report is generated, this view can derive a practical plan suggestion for next week from real movement and risk."
                              : "先生成本周周报，Helm会基于真实推进和风险给出更实用的下周计划建议。"
                          }
                        />
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card className="workspace-panel-muted">
                    <CardContent className="space-y-3 py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="approval">
                          {english ? "Summary" : "周报摘要"}
                        </Badge>
                        <Badge variant="neutral">
                          {formatReportDateRange(selected.weekStart, selected.weekEnd, english)}
                        </Badge>
                      </div>
                      <p className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                        {reportText(selected.summaryText)}
                      </p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {english
                          ? "A manager can start with this summary, then decide whether to drill into opportunities, approvals, or follow-up risks."
                          : "负责人可以先看这段摘要，再决定是否细看机会、审批或跟进风险。"}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                      label={english ? "Advanced opportunities" : "推进机会"}
                      value={selected.opportunitiesAdvancedCount}
                      active={focus === "ADVANCED"}
                      hint={
                        focus === "ADVANCED"
                          ? english
                            ? "Filtered to momentum view"
                            : "当前已切到推进视角"
                          : english
                            ? "Click to filter this view"
                            : "点击按推进视角筛选"
                      }
                      onClick={() =>
                        setFocus((current) =>
                          current === "ADVANCED" ? "ALL" : "ADVANCED",
                        )
                      }
                    />
                    <MetricCard
                      label={english ? "Overdue follow-ups" : "逾期跟进"}
                      value={selected.overdueFollowupsCount}
                      active={focus === "OVERDUE"}
                      hint={
                        focus === "OVERDUE"
                          ? english
                            ? "Filtered to overdue view"
                            : "当前已切到逾期视角"
                          : english
                            ? "Click to filter this view"
                            : "点击按逾期视角筛选"
                      }
                      onClick={() =>
                        setFocus((current) =>
                          current === "OVERDUE" ? "ALL" : "OVERDUE",
                        )
                      }
                    />
                    <MetricCard
                      label={english ? "AI suggestions" : "建议动作"}
                      value={selected.aiSuggestionsCount}
                      active={focus === "AI"}
                      hint={
                        focus === "AI"
                          ? english
                            ? "Filtered to recommendation view"
                            : "当前已切到建议动作视角"
                          : english
                            ? "Click to filter this view"
                            : "点击按建议动作视角筛选"
                      }
                      onClick={() =>
                        setFocus((current) => (current === "AI" ? "ALL" : "AI"))
                      }
                    />
                    <MetricCard
                      label={english ? "Approved actions" : "批准动作"}
                      value={selected.approvalsApprovedCount}
                      active={focus === "APPROVED"}
                      hint={
                        focus === "APPROVED"
                          ? english
                            ? "Filtered to approval view"
                            : "当前已切到批准动作视角"
                          : english
                            ? "Click to filter this view"
                            : "点击按批准动作视角筛选"
                      }
                      onClick={() =>
                        setFocus((current) =>
                          current === "APPROVED" ? "ALL" : "APPROVED",
                        )
                      }
                    />
                    <MetricCard
                      label={english ? "Open high-risk items" : "高风险未处理"}
                      value={selected.openHighRiskCount}
                      active={focus === "RISK"}
                      hint={
                        focus === "RISK"
                          ? english
                            ? "Filtered to risk view"
                            : "当前已切到高风险视角"
                          : english
                            ? "Click to filter this view"
                            : "点击按高风险视角筛选"
                      }
                      onClick={() =>
                        setFocus((current) =>
                          current === "RISK" ? "ALL" : "RISK",
                        )
                      }
                    />
                  </div>

                  <Card
                    className={
                      focus === "ALL"
                        ? "border-[color:var(--border)]"
                        : "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_78%,var(--accent-soft)_22%)]"
                    }
                  >
                    <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={focus === "ALL" ? "neutral" : "info"}>
                            {focusMeta.label}
                          </Badge>
                          {focus !== "ALL" ? (
                            <Badge variant="approval">
                              {english ? "Filtered" : "已筛选"}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm leading-6 text-[color:var(--muted)]">
                          {focusMeta.description}
                        </p>
                      </div>
                      {focus !== "ALL" ? (
                        <Button
                          variant="secondary"
                          onClick={() => setFocus("ALL")}
                        >
                          {english ? "Show full report" : "查看完整周报"}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>

                  {showAdvanced ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {english
                            ? "Opportunity momentum snapshot"
                            : "机会推进快照"}
                        </CardTitle>
                        <CardDescription>
                          {english
                            ? "Momentum, condensed into a few owner signals."
                            : "把推进势能压成几个负责人关心的信号。"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <InfoCell
                          label={
                            english ? "Advanced opportunities" : "推进机会"
                          }
                          value={String(selected.opportunitiesAdvancedCount)}
                        />
                        <InfoCell
                          label={english ? "Meetings this week" : "本周会议数"}
                          value={String(payload.meetingsCount ?? 0)}
                        />
                        <InfoCell
                          label={english ? "New opportunities" : "本周新建机会"}
                          value={String(payload.newOpportunitiesCount ?? 0)}
                        />
                        <InfoCell
                          label={english ? "Most active owner" : "最活跃负责人"}
                          value={
                            payload.mostActiveUser?.name ??
                            (english ? "None yet" : "暂无")
                          }
                        />
                        <div className="theme-surface-panel rounded-2xl px-4 py-4 md:col-span-2 xl:col-span-4">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "Manager read" : "负责人速读"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                            {selected.opportunitiesAdvancedCount > 0
                              ? english
                                ? "This week already has real momentum instead of just pipeline occupancy. You can now compare whether meetings, recommendations and approvals are actually amplifying that momentum."
                                : "这周已经出现了真实推进，而不只是机会挂在看板里。接下来重点看会议、建议动作和审批是不是在放大这股推进势能。"
                              : english
                                ? "The pipeline looks static this week. First check whether enough meetings and real inbound signals are attached to business objects."
                                : "这周的机会推进偏静态。先确认会议和真实输入信号有没有归到业务对象。"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {showOverdue || showRisk ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Missed items this week"
                              : "本周遗漏事项"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Overdue, and what'll slip if left alone."
                              : "逾期的，加上再放就要掉的。"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {payload.overdueItems?.length ? (
                            payload.overdueItems.map((item) => (
                              <div
                                key={item.id}
                                className="workspace-note-card px-4 py-4"
                                data-tone="amber"
                              >
                                <p className="workspace-note-title font-medium">
                                  {item.title}
                                </p>
                                <p className="workspace-note-body mt-2 text-sm">
                                  {item.companyName ??
                                    (english
                                      ? "No linked company"
                                      : "未关联公司")}
                                </p>
                                <p className="workspace-note-meta mt-2 text-xs">
                                  {english ? "Due" : "截止"}{" "}
                                  {formatReportDateLabel(item.dueDate, english)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <EmptyState
                              title={
                                english
                                  ? "No new overdue follow-up this week"
                                  : "本周没有新的逾期跟进"
                              }
                              description={
                                english
                                  ? "Follow-up rhythm is on track."
                                  : "跟进节奏在线上。"
                              }
                            />
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "High-risk items this week"
                              : "本周高风险事项"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "These are the right items to put first in the next operating review."
                              : "这些事项适合下一轮经营会优先讨论。"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {payload.highRiskItems?.length ? (
                            payload.highRiskItems.map((item) => (
                              <div
                                key={item.id}
                                className="workspace-note-card px-4 py-4"
                                data-tone="rose"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="workspace-note-title font-medium">
                                    {item.title}
                                  </p>
                                  <Badge variant="danger">
                                    {item.riskLevel ??
                                      (english ? "High risk" : "高风险")}
                                  </Badge>
                                </div>
                                <p className="workspace-note-body mt-2 text-sm">
                                  {item.companyName ??
                                    (english
                                      ? "No linked company"
                                      : "未关联公司")}
                                </p>
                                <p className="workspace-note-meta mt-2 text-sm">
                                  {item.nextAction ??
                                    (english
                                      ? "Next step still needs to be filled"
                                      : "待补齐下一步动作")}
                                </p>
                              </div>
                            ))
                          ) : (
                            <EmptyState
                              title={
                                english
                                  ? "No new high-risk item this week"
                                  : "本周没有新的高风险事项"
                              }
                              description={
                                english
                                  ? "That lets you shift more energy into pushing work forward and testing policy."
                                  : "可以把更多精力放在推进和策略试验上。"
                              }
                            />
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}

                  {showApproved ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english ? "Review chain health" : "复核链路是否稳"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Are sensitive actions being recorded, reviewed and approved on time?"
                              : "敏感动作有没有记录、复核、按时通过？"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          <InfoCell
                            label={english ? "Recorded actions" : "有记录的操作"}
                            value={String(
                              payload.governanceMetrics?.auditEventsCount ?? 0,
                            )}
                          />
                          <InfoCell
                            label={english ? "Conservative handling" : "保守处理次数"}
                            value={String(
                              payload.governanceMetrics?.llmFallbackCount ?? 0,
                            )}
                          />
                          <InfoCell
                            label={
                              english
                                ? "Average approval turnaround"
                                : "审批平均响应"
                            }
                            value={
                              english
                                ? `${payload.governanceMetrics?.averageApprovalTurnaroundHours ?? 0} hours`
                                : `${payload.governanceMetrics?.averageApprovalTurnaroundHours ?? 0} 小时`
                            }
                          />
                          <InfoCell
                            label={
                              english ? "Accepted adjustments" : "已采纳调整"
                            }
                            value={String(
                              payload.governanceMetrics
                                ?.acceptedStrategyCount ?? 0,
                            )}
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english ? "Can real information be used?" : "真实信息接得上吗"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Is customer information coming in clean enough to act on?"
                              : "客户信息接得够干净吗？"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          <InfoCell
                            label={
                              english ? "Connected sources" : "已接入来源"
                            }
                            value={String(
                              payload.integrationMetrics?.connectorHealth
                                ?.connectedCount ?? 0,
                            )}
                          />
                          <InfoCell
                            label={
                              english
                                ? "Sources with sync errors"
                                : "同步异常来源"
                            }
                            value={String(
                              payload.integrationMetrics?.connectorHealth
                                ?.errorCount ?? 0,
                            )}
                          />
                          <InfoCell
                            label={english ? "Unattached threads" : "未归属线程"}
                            value={String(
                              payload.integrationMetrics?.unboundThreads ?? 0,
                            )}
                          />
                          <div className="theme-surface-panel rounded-2xl px-4 py-4 md:col-span-2">
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "Manager judgement" : "负责人判断"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {payload.integrationMetrics?.unboundThreads
                                ? english
                                  ? "Some real threads are still not attached to contacts, companies, or opportunities. Before widening the pilot, clear one pass of ownership first."
                                  : "当前仍有一部分真实线程没有归到联系人、公司或机会。继续扩大前，建议先清一轮归属。"
                                : english
                                  ? "Current real inbound data is largely attached to business objects, so the weekly review can focus on movement, risk, and accepted follow-ups."
                                  : "当前真实信息基本能归到业务对象，周复盘可以重点看推进、风险和已采纳跟进。"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}

                  {showAdvanced ? (
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Team movement this week"
                              : "本周经营推进参与"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Meetings, opportunities, rejected actions, and active owners show whether real work is moving."
                              : "看会议、机会、被拒动作和活跃负责人，判断这周有没有真实推进。"}
                          </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <InfoCell
                          label={english ? "Meetings this week" : "本周会议数"}
                          value={String(payload.meetingsCount ?? 0)}
                        />
                        <InfoCell
                          label={
                            english
                              ? "New opportunities this week"
                              : "本周新建机会"
                          }
                          value={String(payload.newOpportunitiesCount ?? 0)}
                        />
                        <InfoCell
                          label={
                            english
                              ? "Rejected actions this week"
                              : "本周拒绝动作数"
                          }
                          value={String(payload.rejectedActionsCount ?? 0)}
                        />
                        <InfoCell
                          label={english ? "Most active user" : "最活跃用户"}
                          value={
                            payload.mostActiveUser?.name ??
                            (english ? "None yet" : "暂无")
                          }
                        />
                      </CardContent>
                    </Card>
                  ) : null}

                  {showAi || showApproved ? (
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Did suggestions turn into action?"
                              : "建议有没有变成动作"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Did the team review evidence, create follow-ups, accept?"
                              : "有没有看依据、建跟进、采纳？"}
                          </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <InfoCell
                          label={
                            english
                              ? "Suggestions raised"
                              : "提出建议"
                          }
                          value={String(
                            payload.recommendationMetrics?.generated ?? 0,
                          )}
                        />
                        <InfoCell
                          label={english ? "Evidence opened" : "查看依据"}
                          value={String(
                            payload.recommendationMetrics?.explanationViews ??
                              0,
                          )}
                        />
                        <InfoCell
                          label={english ? "Follow-ups created" : "建跟进"}
                          value={String(
                            payload.recommendationMetrics?.actionCreated ?? 0,
                          )}
                        />
                        <InfoCell
                          label={english ? "Accepted" : "被采纳"}
                          value={String(
                            payload.recommendationMetrics?.accepted ?? 0,
                          )}
                        />
                        <InfoCell
                          label={english ? "Rejected" : "被拒绝"}
                          value={String(
                            payload.recommendationMetrics?.rejected ?? 0,
                          )}
                        />
                        <InfoCell
                          label={english ? "Edited approved" : "编辑后采纳"}
                          value={String(
                            payload.recommendationMetrics?.editedApproved ?? 0,
                          )}
                        />
                      </CardContent>
                    </Card>
                  ) : null}

                  {showAi ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Which suggestions were trusted"
                              : "哪些建议被采纳并推进"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Acceptance, follow-up creation, and edited approvals show whether the team can act on them."
                              : "只看采纳、形成跟进行动、改写后通过三件事。"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          <InfoCell
                            label={
                              english ? "Benchmark pass rate" : "样板问题通过率"
                            }
                            value={`${payload.qualityMetrics?.recommendation?.goldenPassRate ?? 0}%`}
                          />
                          <InfoCell
                            label={english ? "Accepted directly" : "直接采纳"}
                            value={`${payload.qualityMetrics?.recommendation?.acceptanceRate ?? 0}%`}
                          />
                          <InfoCell
                            label={
                              english ? "Follow-up created" : "形成跟进行动"
                            }
                            value={`${payload.qualityMetrics?.recommendation?.actionCreationRate ?? 0}%`}
                          />
                          <InfoCell
                            label={
                              english ? "Approved after edit" : "改写后通过"
                            }
                            value={`${payload.qualityMetrics?.recommendation?.editedApprovalRate ?? 0}%`}
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Whether meeting facts held up"
                              : "会议事实有没有沉淀准"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Are facts, commitments and blockers being captured cleanly?"
                              : "事实、承诺、阻塞有没有记准？"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          <InfoCell
                            label={
                              english ? "Benchmark pass rate" : "样板记录通过率"
                            }
                            value={`${payload.qualityMetrics?.memory?.goldenPassRate ?? 0}%`}
                          />
                          <InfoCell
                            label={english ? "Facts captured" : "事实记录准确"}
                            value={`${payload.qualityMetrics?.memory?.factHitRate ?? 0}%`}
                          />
                          <InfoCell
                            label={
                              english ? "Commitments captured" : "承诺记录准确"
                            }
                            value={`${payload.qualityMetrics?.memory?.commitmentHitRate ?? 0}%`}
                          />
                          <InfoCell
                            label={english ? "Blockers captured" : "阻塞记录准确"}
                            value={`${payload.qualityMetrics?.memory?.blockerHitRate ?? 0}%`}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}

                  {focus === "ALL" ? (
                    <Card>
                      <CardHeader>
                          <CardTitle>
                            {english
                              ? "Movement patterns this week"
                              : "本周出现的推进规律"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Repeatable ways the team got things moving."
                              : "团队这周走通的可复用做法。"}
                          </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {payload.evolutionInsights?.length ? (
                          payload.evolutionInsights.map((item) => (
                            <div
                              key={item.id}
                              className="workspace-note-card px-4 py-4"
                              data-tone="violet"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="workspace-note-title font-medium">
                                  {item.title}
                                </p>
                                <Badge variant="approval">
                                  {english ? "Confidence" : "置信度"}{" "}
                                  {item.confidence}
                                </Badge>
                              </div>
                              <p className="workspace-note-body mt-2 text-sm leading-6">
                                {item.summary}
                              </p>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title={
                              english
                                ? "No sufficiently stable new pattern this week"
                                : "本周还没有足够稳定的新规律"
                            }
                            description={
                              english
                                ? "Patterns will show up here once more data accumulates."
                                : "数据再多一些，规律就会出现在这里。"
                            }
                          />
                        )}
                      </CardContent>
                    </Card>
                  ) : null}

                  {focus === "ALL" ? (
                    <Card>
                      <CardHeader>
                          <CardTitle>
                            {english
                              ? "Operating habits already adopted"
                              : "最近已经生效的经营习惯"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Adopted changes — now shaping priority and follow-up windows."
                              : "已采纳的变化——正在影响优先级和跟进窗口。"}
                          </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {payload.evolutionRecentAdoptions?.length ? (
                          payload.evolutionRecentAdoptions.map((item) => (
                            <div
                              key={item.id}
                              className="workspace-note-card px-4 py-4"
                              data-tone="emerald"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="workspace-note-title font-semibold">
                                  {item.title}
                                </p>
                                <Badge variant="success">
                                  {english ? "Adopted" : "已收敛"}
                                </Badge>
                              </div>
                              <p className="workspace-note-body mt-3 text-sm leading-7">
                                {item.summary}
                              </p>
                              <p className="workspace-note-meta mt-3 text-xs">
                                {item.targetPolicyKey
                                  ? english
                                    ? "Affects default operating rhythm"
                                    : "影响默认经营节奏"
                                  : english
                                    ? "Now part of the default operating rhythm"
                                    : "已进入默认经营节奏"}
                                {item.suggestedValue
                                  ? ` · ${english ? "New value" : "新值"}：${item.suggestedValue}`
                                  : ""}
                                {item.appliedAt
                                  ? ` · ${english ? "Effective at" : "生效于"} ${formatReportDateLabel(item.appliedAt, english)}`
                                  : ""}
                              </p>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title={
                              english
                                ? "No new pattern formally adopted this week"
                                : "本周还没有新规律被正式采纳"
                            }
                            description={
                              english
                                ? "Once the team accepts strategy suggestions or the system collapses a stable pattern into a default signal, the effective result will appear here directly."
                                : "一旦团队采纳策略建议或稳定模式被收敛成默认信号，这里会直接显示生效结果。"
                            }
                          />
                        )}
                      </CardContent>
                    </Card>
                  ) : null}

                  {focus === "ALL" ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english ? "High-frequency blockers" : "高频阻塞"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Where the team keeps getting stuck."
                              : "团队反复卡在哪。"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {payload.highFrequencyBlockers?.length ? (
                            payload.highFrequencyBlockers.map((item) => (
                              <div
                                key={item.blockerType}
                                className="workspace-note-card px-4 py-4"
                                data-tone="rose"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="workspace-note-title font-medium">
                                    {reportText(item.blockerType)}
                                  </p>
                                  <Badge variant="danger">
                                    {english
                                      ? `${item.count} times`
                                      : `${item.count} 次`}
                                  </Badge>
                                </div>
                                <p className="workspace-note-body mt-2 text-sm">
                                  {item.title}
                                </p>
                              </div>
                            ))
                          ) : (
                            <EmptyState
                              title={
                                english
                                  ? "No new high-frequency blocker this week"
                                  : "本周没有新的高频阻塞"
                              }
                              description={
                                english
                                  ? "Blockers are still scattered — watch for a pattern."
                                  : "阻塞还分散——看会不会形成规律。"
                              }
                            />
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Action types the team still does not trust"
                              : "团队还不信任的动作类型"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Where the owner, timing or wording still feels off."
                              : "责任人、时机或表达还不对的地方。"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {payload.rejectedRecommendationTypes?.length ? (
                            payload.rejectedRecommendationTypes.map((item) => (
                              <div
                                key={item.actionType}
                                className="theme-surface-panel rounded-2xl px-4 py-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-medium text-[color:var(--foreground)]">
                                    {actionTypeLabels[item.actionType]}
                                  </p>
                                  <Badge variant="warning">
                                    {english
                                      ? `${item.count} times`
                                      : `${item.count} 次`}
                                  </Badge>
                                </div>
                                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                                  {english
                                    ? "If this keeps getting rejected, responsibility, timing, or wording still needs another pass."
                                    : "如果这类动作持续被拒，通常是责任人、时机或表达还要再对齐。"}
                                </p>
                              </div>
                            ))
                          ) : (
                            <EmptyState
                              title={
                                english
                                  ? "No obvious rejected recommendation type this week"
                                  : "本周没有明显的被拒建议类型"
                              }
                              description={
                                english
                                  ? "Suggestions are matching how the team works."
                                  : "建议在贴合团队的做法。"
                              }
                            />
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}

                  {focus === "ALL" ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Action types to tune next week"
                              : "下周最该调顺的动作类型"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "These types need work before adding more."
                              : "先把这几类调顺，再考虑加。"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {payload.qualityMetrics?.recommendation
                            ?.weakestActionTypes?.length ? (
                            payload.qualityMetrics.recommendation.weakestActionTypes.map(
                              (item) => (
                                <div
                                  key={item.actionType}
                                  className="theme-surface-panel rounded-2xl px-4 py-4"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium text-[color:var(--foreground)]">
                                      {actionTypeLabels[item.actionType]}
                                    </p>
                                    <Badge variant="warning">
                                      {english
                                        ? `${item.generated} items`
                                        : `${item.generated} 条`}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                                    {english
                                      ? `Acceptance ${item.acceptanceRate}% · Rejection ${item.rejectionRate}% · Actions created ${item.actionCreated}`
                                      : `采纳率 ${item.acceptanceRate}% · 拒绝率 ${item.rejectionRate}% · 生成动作 ${item.actionCreated} 次`}
                                  </p>
                                </div>
                              ),
                            )
                          ) : (
                            <EmptyState
                              title={
                                english
                                  ? "No obvious weak recommendation type this week"
                                  : "本周建议动作还没有明显短板类型"
                              }
                              description={
                                english
                                  ? "As more recommendation feedback accumulates, a steadier weak-type distribution will appear here."
                                  : "继续累积更多建议反馈后，这里会开始出现更稳定的弱项分布。"
                              }
                            />
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {english
                              ? "Where meeting records go wrong"
                              : "会议记录最容易错在哪里"}
                          </CardTitle>
                          <CardDescription>
                            {english
                              ? "Facts, commitments, ownership — what needs fixing first."
                              : "事实、承诺、归属——先修哪个。"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {payload.qualityMetrics?.memory?.topErrorModes
                            ?.length ? (
                            payload.qualityMetrics.memory.topErrorModes.map(
                              (item) => (
                                <div
                                  key={item.label}
                                  className="theme-surface-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-4"
                                >
                                  <p className="font-medium text-[color:var(--foreground)]">
                                    {item.label}
                                  </p>
                                  <Badge variant="warning">{item.count}</Badge>
                                </div>
                              ),
                            )
                          ) : (
                            <EmptyState
                              title={
                                english
                                  ? "No obvious meeting-record error this week"
                                  : "本周还没有明显的会议记录误差"
                              }
                              description={
                                english
                                  ? "As corrections accumulate, this section will make missed facts and wrong ownership easier to spot."
                                  : "修正记录继续累积后，这里会更清楚地暴露漏记事实和归属错误。"
                              }
                            />
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}

                  <div
                    className="workspace-note-card px-4 py-4"
                    data-tone="slate"
                  >
                    <p className="workspace-note-meta text-sm leading-6">
                      {english
                        ? `Generated at ${formatReportDateLabel(selected.createdAt, english)}. Sources include opportunity movement, approval records, meetings, daily usage snapshots and event telemetry.`
                        : `生成时间：${formatReportDateLabel(selected.createdAt, english)}。数据来源包括机会推进、审批记录、会议、每日使用快照和使用信号。`}
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <EmptyState
              title={
                english
                  ? "No weekly report available yet"
                  : "还没有可查看的周报"
              }
              description={
                english
                  ? "After generating a weekly report, this section will show the summary, key metrics, missed items and high-risk lists."
                  : "生成周报后，这里会展示摘要、关键指标、遗漏事项和高风险列表。"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  active = false,
  onClick,
  hint,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
  hint: string;
}) {
  return (
    <Card
      className={
        active
          ? "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_78%,var(--accent-soft)_22%)]"
          : undefined
      }
    >
      <CardContent className="space-y-2 py-5">
        <button type="button" onClick={onClick} className="w-full text-left">
          <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
          <p className="text-3xl font-semibold text-[color:var(--foreground)]">{value}</p>
          <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">{hint}</p>
        </button>
      </CardContent>
    </Card>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel rounded-2xl px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}
