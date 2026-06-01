"use client";

import { BarChart3, UserRound } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatAnalyticsTechnicalKey,
  formatAnalyticsVisibleText,
} from "@/features/analytics/display-copy";
import {
  getLocalizedActionTypeLabels,
  getLocalizedEventLabels,
  getLocalizedLlmFallbackLabels,
  getLocalizedLlmTaskLabels,
  getLocalizedObjectTypeLabels,
} from "@/lib/i18n/labels";
import { formatDateLabel, trimText } from "@/lib/utils";

type AnalyticsClientProps = {
  data: {
    todayActiveUsers: number;
    days: Array<{
      key: string;
      label: string;
      loginCount: number;
      approvalsSubmitted: number;
      approvalsApproved: number;
      approvalsRejected: number;
      opportunityStageChanges: number;
      followupDraftsGenerated: number;
      recommendationGenerated: number;
      recommendationExplanationViewed: number;
      recommendationActionCreated: number;
      recommendationAccepted: number;
      recommendationRejected: number;
    }>;
    recommendationOverview: {
      generated: number;
      cardViewed: number;
      explanationViewed: number;
      actionCreated: number;
      accepted: number;
      rejected: number;
      editedApproved: number;
    };
    recommendationQuality: {
      generated: number;
      accepted: number;
      rejected: number;
      editedApproved: number;
      actionCreated: number;
      explanationViewed: number;
      cardViewed: number;
      acceptanceRate: number;
      rejectionRate: number;
      actionCreationRate: number;
      explanationViewRate: number;
      editedApprovalRate: number;
      averageScore: number;
      byActionType: Array<{
        actionType: string;
        generated: number;
        accepted: number;
        rejected: number;
        editedApproved: number;
        actionCreated: number;
        acceptanceRate: number;
        rejectionRate: number;
      }>;
      weakestActionTypes: Array<{
        actionType: string;
        generated: number;
        acceptanceRate: number;
        rejectionRate: number;
        actionCreated: number;
      }>;
      goldenSummary: {
        totalCases: number;
        passedCases: number;
        passRate: number;
      };
    };
    captureOverview: {
      started: number;
      audioUploaded: number;
      transcriptGenerated: number;
      insightsGenerated: number;
      memoryWritten: number;
      recommendationsRefreshed: number;
      actionsCreated: number;
      processingCompleted: number;
      failed: number;
    };
    memoryQuality: {
      extractedFacts: number;
      extractedCommitments: number;
      extractedBlockers: number;
      corrections: number;
      confirmations: number;
      invalidations: number;
      deletions: number;
      correctionRate: number;
      invalidationRate: number;
      sourceBreakdown: Array<{
        sourceType: string;
        facts: number;
        commitments: number;
        blockers: number;
      }>;
      errorModes: Array<{
        label: string;
        count: number;
      }>;
      goldenSummary: {
        totalCases: number;
        passedCases: number;
        passRate: number;
        factHitRate: number;
        commitmentHitRate: number;
        blockerHitRate: number;
      };
    };
    topEvents: Array<{ eventName: string; count: number }>;
    userUsage: Array<{
      user: { id: string; name: string; email: string };
      loginCount: number;
      dashboardViewCount: number;
      meetingViewCount: number;
      actionItemsGenerated: number;
      approvalsSubmitted: number;
      approvalsApproved: number;
      approvalsRejected: number;
      opportunityStageChanges: number;
      followupDraftsGenerated: number;
      policyChanges: number;
      totalSignals: number;
    }>;
    recentEvents: Array<{
      id: string;
      eventName: string;
      eventCategory: string;
      targetType: string | null;
      targetId: string | null;
      createdAt: Date;
      sourcePage: string | null;
    }>;
    llmOverview: {
      totalCalls: number;
      successCount: number;
      fallbackCount: number;
      averageLatencyMs: number;
      totalPromptTokens: number;
      totalCompletionTokens: number;
      taskBreakdown: Array<{ taskType: string; count: number }>;
      promptBreakdown: Array<{ promptKey: string; count: number }>;
      fallbackBreakdown: Array<{ reason: string; count: number }>;
      providerBreakdown: Array<{ providerModel: string; count: number }>;
      recentLogs: Array<{
        id: string;
        provider: string;
        model: string;
        modelVersion: string | null;
        modelRole: string | null;
        taskType: string;
        promptKey: string | null;
        promptVersion: string;
        success: boolean;
        latencyMs: number | null;
        budgetTier: string | null;
        outputMode: string | null;
        inputSummary: string | null;
        outputSummary: string | null;
        fallbackReason: string | null;
        errorMessage: string | null;
        createdAt: Date;
        user: { id: string; name: string; email: string } | null;
      }>;
    };
  };
};

export function AnalyticsClient({ data }: AnalyticsClientProps) {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const actionTypeLabels = getLocalizedActionTypeLabels(locale);
  const eventLabels = getLocalizedEventLabels(locale);
  const llmTaskLabels = getLocalizedLlmTaskLabels(locale);
  const llmFallbackLabels = getLocalizedLlmFallbackLabels(locale);
  const objectTypeLabels = {
    ...getLocalizedObjectTypeLabels(locale),
    PAGE: english ? "Page" : "页面",
    USER: english ? "User" : "用户",
  };
  const analyticsText = (value: string | null | undefined) =>
    formatAnalyticsVisibleText(value, english);
  const analyticsKey = (value: string | null | undefined) =>
    formatAnalyticsTechnicalKey(value, english);
  const analyticsObjectType = (value: string | null | undefined) => {
    if (!value) return english ? "Not set" : "未设置";
    const label =
      objectTypeLabels[
        value.trim().toUpperCase() as keyof typeof objectTypeLabels
      ];
    return label ?? analyticsKey(value);
  };
  const maxLogin = Math.max(...data.days.map((item) => item.loginCount), 1);
  const maxApproval = Math.max(
    ...data.days.map((item) => item.approvalsApproved + item.approvalsRejected),
    1,
  );
  const maxStage = Math.max(
    ...data.days.map((item) => item.opportunityStageChanges),
    1,
  );
  const maxDraft = Math.max(
    ...data.days.map((item) => item.followupDraftsGenerated),
    1,
  );
  const maxRecommendation = Math.max(
    ...data.days.map((item) => item.recommendationGenerated),
    1,
  );
  const maxRecommendationAction = Math.max(
    ...data.days.map(
      (item) => item.recommendationActionCreated + item.recommendationRejected,
    ),
    1,
  );
  const hasCaptureActivity =
    data.captureOverview.started +
      data.captureOverview.audioUploaded +
      data.captureOverview.transcriptGenerated +
      data.captureOverview.memoryWritten +
      data.captureOverview.failed >
    0;
  const hasRecommendationActivity =
    data.recommendationOverview.generated +
      data.recommendationOverview.explanationViewed +
      data.recommendationOverview.actionCreated +
      data.recommendationOverview.accepted +
      data.recommendationOverview.rejected >
    0;
  const approvedActionsLast7 = data.days.reduce(
    (sum, item) => sum + item.approvalsApproved,
    0,
  );
  const opportunityMovesLast7 = data.days.reduce(
    (sum, item) => sum + item.opportunityStageChanges,
    0,
  );
  const loginsLast7 = data.days.reduce((sum, item) => sum + item.loginCount, 0);
  const hasVerifiedMovement =
    data.recommendationOverview.actionCreated +
      data.recommendationOverview.accepted +
      data.recommendationOverview.rejected +
      approvedActionsLast7 +
      opportunityMovesLast7 >
    0;
  const stoppedWorkCount =
    data.recommendationOverview.rejected +
    data.days.reduce((sum, item) => sum + item.approvalsRejected, 0);
  const analyticsAssetFocusItems = [
    {
      label: english ? "Object state" : "对象状态",
      value: hasVerifiedMovement
        ? english
          ? `${approvedActionsLast7 + opportunityMovesLast7} verified movement(s)`
          : `${approvedActionsLast7 + opportunityMovesLast7} 次可验证推进`
        : english
          ? "No verified movement yet"
          : "还没有可验证推进",
      detail: english
        ? "Accepted work and opportunity movement are the first signal, not raw activity volume."
        : "先看已确认动作和机会推进，不看原始活跃量。",
      href: "/reports",
      tone: hasVerifiedMovement ? "success" : "warning",
    },
    {
      label: english ? "Blocker" : "阻塞",
      value: stoppedWorkCount > 0
        ? english
          ? `${stoppedWorkCount} stopped item(s)`
          : `${stoppedWorkCount} 个被拦下事项`
        : english
          ? "No stopped work visible"
          : "没有明显被拦事项",
      detail: english
        ? "Rejected items are pressure signals, not vanity analytics."
        : "被拒绝事项是压力信号，不是装饰性指标。",
      href: stoppedWorkCount > 0 ? "/approvals" : undefined,
      tone: stoppedWorkCount > 0 ? "warning" : "success",
    },
    {
      label: english ? "Pending decision" : "待决策",
      value: hasVerifiedMovement
        ? english
          ? "Decide where to widen usage"
          : "判断下一步扩大到哪里"
        : english
          ? "Decide why work did not move"
          : "判断为什么没有推进",
      detail: english
        ? `${data.todayActiveUsers} active today · ${loginsLast7} logins / 7d`
        : `今天 ${data.todayActiveUsers} 人活跃 · 近 7 天 ${loginsLast7} 次登录`,
      href: "/diagnostics",
      tone: "info",
    },
    {
      label: english ? "AI work posture" : "AI 工作姿态",
      value: english
        ? `${data.llmOverview.successCount} completed · ${data.llmOverview.fallbackCount} held`
        : `${data.llmOverview.successCount} 次顺利完成 · ${data.llmOverview.fallbackCount} 次安全停住`,
      detail: english
        ? "Show whether AI helped or stopped safely before exposing service logs."
        : "先看 AI 是帮上忙还是安全停住，再展开服务日志。",
      href: "/diagnostics",
      tone: data.llmOverview.fallbackCount > 0 ? "warning" : "success",
    },
  ] as const;

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={english ? "Operating review" : "经营推进复盘"}
        title={
          english
            ? "What actually moved this week"
            : "这周哪些事真的被推进了"
        }
        description={
          english
            ? "Start with accepted work, blocked work, active people and whether opportunities moved."
            : "先看哪些被采纳、哪些被拦下、谁在用、机会有没有动。"
        }
      />

      <CustomerAssetFocusStrip
        eyebrow={english ? "Operating movement" : "经营推进"}
        title={
          hasVerifiedMovement
            ? english
              ? "Start with work that actually moved."
              : "先看真正被推进的事。"
            : english
              ? "Start with why nothing crossed review."
              : "先看为什么还没有事项过复核。"
        }
        summary={
          english
            ? "The useful readout is accepted work, stopped work, opportunity movement, active people, and AI's posture."
            : "有效读数是已确认推进、被拦事项、机会移动、活跃人员和 AI 工作姿态。"
        }
        items={[...analyticsAssetFocusItems]}
        primaryAction={{
          label: hasVerifiedMovement
            ? english
              ? "Open reports"
              : "打开复盘"
            : english
              ? "Open review queue"
              : "打开复核队列",
          href: hasVerifiedMovement ? "/reports" : "/approvals",
        }}
        secondaryAction={{
          label: english ? "Open diagnostics" : "打开就绪度",
          href: "/diagnostics",
        }}
      />

      {hasVerifiedMovement ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="judgement-performance-hero">
          <Card className="workspace-panel">
            <CardContent className="space-y-1 py-5">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Accepted work" : "已确认推进"}
              </p>
              <p className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {data.recommendationQuality.acceptanceRate}%
              </p>
              <p className="text-xs leading-5 text-[color:var(--muted)]">
                {english
                  ? "Share of suggested work the operator confirmed."
                  : "负责人确认继续推进的事项占比。"}
              </p>
            </CardContent>
          </Card>
          <Card className="workspace-panel">
            <CardContent className="space-y-1 py-5">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Rejected work" : "已拒绝事项"}
              </p>
              <p className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {data.recommendationQuality.rejectionRate}%
              </p>
              <p className="text-xs leading-5 text-[color:var(--muted)]">
                {english
                  ? "Items stopped by review."
                  : "复核中被拦下的事项。"}
              </p>
            </CardContent>
          </Card>
          <Card className="workspace-panel">
            <CardContent className="space-y-1 py-5">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Average priority" : "平均优先级"}
              </p>
              <p className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {data.recommendationQuality.averageScore}
              </p>
              <p className="text-xs leading-5 text-[color:var(--muted)]">
                {english
                  ? "Mean priority of this week's work suggestions."
                  : "本周待处理事项的平均优先级。"}
              </p>
            </CardContent>
          </Card>
          <Card className="workspace-panel">
            <CardContent className="space-y-1 py-5">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "Actions created" : "已形成动作"}
              </p>
              <p className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {data.recommendationOverview.actionCreated}
              </p>
              <p className="text-xs leading-5 text-[color:var(--muted)]">
                {english
                  ? "Confirmed suggestions that became work items."
                  : "确认后形成的实际动作项。"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <section
          className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]"
          data-testid="judgement-performance-hero"
        >
          <Card className="workspace-panel">
            <CardContent className="py-5">
              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                {english ? "This week's judgement" : "本周判断"}
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {english
                  ? "No reviewed work has turned into verified movement yet."
                  : "还没有可验证的经营推进。"}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--muted)]">
                {english
                  ? "Workspace active, but nothing crossed review this week. Check the queue and opportunities."
                  : "工作区有人在用，但本周没东西过复核。看队列和机会。"}
              </p>
            </CardContent>
          </Card>
          <Card className="workspace-panel">
            <CardContent className="grid gap-3 py-5 sm:grid-cols-3">
              <UsageCell
                label={english ? "People active today" : "今天有人在用"}
                value={data.todayActiveUsers}
              />
              <UsageCell
                label={english ? "Logins in 7 days" : "7 天登录"}
                value={loginsLast7}
              />
              <UsageCell
                label={english ? "Verified movement" : "已验证推进"}
                value={approvedActionsLast7 + opportunityMovesLast7}
              />
            </CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-2 md:grid-cols-2">
      {hasVerifiedMovement ? (
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={english ? "Active users today" : "今天活跃用户"}
            value={data.todayActiveUsers}
            tone="info"
          />
          <MetricCard
            label={english ? "Logins in last 7 days" : "最近 7 天登录"}
            value={loginsLast7}
            tone="success"
          />
          <MetricCard
            label={
              english ? "Approved actions in last 7 days" : "最近 7 天批准动作"
            }
            value={approvedActionsLast7}
            tone="approval"
          />
          <MetricCard
            label={
              english ? "Opportunity moves in last 7 days" : "最近 7 天机会推进"
            }
            value={opportunityMovesLast7}
            tone="warning"
          />
        </div>
      ) : (
        <LazyDisclosure
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
          title={english ? "Activity reference" : "引用：基础活动"}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={english ? "Active users today" : "今天活跃用户"}
              value={data.todayActiveUsers}
              tone="info"
            />
            <MetricCard
              label={english ? "Logins in last 7 days" : "最近 7 天登录"}
              value={loginsLast7}
              tone="success"
            />
            <MetricCard
              label={
                english ? "Approved actions in last 7 days" : "最近 7 天批准动作"
              }
              value={approvedActionsLast7}
              tone="approval"
            />
            <MetricCard
              label={
                english ? "Opportunity moves in last 7 days" : "最近 7 天机会推进"
              }
              value={opportunityMovesLast7}
              tone="warning"
            />
          </div>
        </LazyDisclosure>
      )}

      <LazyDisclosure
        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
        title={english ? "AI work posture" : "引用：AI 工作姿态"}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label={english ? "AI assists in last 7 days" : "最近 7 天协助次数"}
            value={data.llmOverview.totalCalls}
            tone="info"
          />
          <MetricCard
            label={english ? "Completed assists" : "顺利完成"}
            value={data.llmOverview.successCount}
            tone="success"
          />
          <MetricCard
            label={english ? "Held safely" : "安全停住"}
            value={data.llmOverview.fallbackCount}
            tone="warning"
          />
          <MetricCard
            label={english ? "Average wait" : "平均等待"}
            value={`${data.llmOverview.averageLatencyMs}ms`}
            tone="info"
          />
          <MetricCard
            label={english ? "Context read" : "读取上下文"}
            value={data.llmOverview.totalPromptTokens}
            tone="approval"
          />
          <MetricCard
            label={english ? "Drafted output" : "生成内容"}
            value={data.llmOverview.totalCompletionTokens}
            tone="warning"
          />
        </div>
      </LazyDisclosure>

      {hasCaptureActivity ? (
        <div className="grid gap-4 md:col-span-2 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            label={english ? "Capture started" : "采集开始"}
            value={data.captureOverview.started}
            tone="info"
          />
          <MetricCard
            label={english ? "Audio uploaded" : "音频上传"}
            value={data.captureOverview.audioUploaded}
            tone="warning"
          />
          <MetricCard
            label={english ? "Transcript generated" : "生成转写文本"}
            value={data.captureOverview.transcriptGenerated}
            tone="success"
          />
          <MetricCard
            label={english ? "Memory writeback" : "写回记忆"}
            value={data.captureOverview.memoryWritten}
            tone="approval"
          />
          <MetricCard
            label={english ? "Capture failed" : "采集失败"}
            value={data.captureOverview.failed}
            tone="danger"
          />
        </div>
      ) : (
        <LazyDisclosure
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
          title={
            english
              ? "Meeting capture reference"
              : "引用：本周会议采集暂无有效数据"
          }
        >
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              label={english ? "Capture started" : "采集开始"}
              value={data.captureOverview.started}
              tone="info"
            />
            <MetricCard
              label={english ? "Audio uploaded" : "音频上传"}
              value={data.captureOverview.audioUploaded}
              tone="warning"
            />
            <MetricCard
              label={english ? "Transcript generated" : "生成转写文本"}
              value={data.captureOverview.transcriptGenerated}
              tone="success"
            />
            <MetricCard
              label={english ? "Memory writeback" : "写回记忆"}
              value={data.captureOverview.memoryWritten}
              tone="approval"
            />
            <MetricCard
              label={english ? "Capture failed" : "采集失败"}
              value={data.captureOverview.failed}
              tone="danger"
            />
          </div>
        </LazyDisclosure>
      )}

      {hasRecommendationActivity ? (
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={english ? "Judgements prepared" : "给出判断"}
            value={data.recommendationOverview.generated}
            tone="info"
          />
          <MetricCard
            label={english ? "Evidence expanded" : "展开依据"}
            value={data.recommendationOverview.explanationViewed}
            tone="warning"
          />
          <MetricCard
            label={english ? "Judgements turned into work" : "变成动作"}
            value={data.recommendationOverview.actionCreated}
            tone="success"
          />
          <MetricCard
            label={english ? "Accepted / rejected" : "采纳 / 拒绝"}
            value={`${data.recommendationOverview.accepted} / ${data.recommendationOverview.rejected}`}
            tone="approval"
          />
        </div>
      ) : (
        <LazyDisclosure
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
          title={
            english
              ? "Judgement reference"
              : "引用：本周判断暂无反馈"
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={english ? "Judgements prepared" : "给出判断"}
              value={data.recommendationOverview.generated}
              tone="info"
            />
            <MetricCard
              label={english ? "Evidence expanded" : "展开依据"}
              value={data.recommendationOverview.explanationViewed}
              tone="warning"
            />
            <MetricCard
              label={english ? "Judgements turned into work" : "变成动作"}
              value={data.recommendationOverview.actionCreated}
              tone="success"
            />
            <MetricCard
              label={english ? "Accepted / rejected" : "采纳 / 拒绝"}
              value={`${data.recommendationOverview.accepted} / ${data.recommendationOverview.rejected}`}
              tone="approval"
            />
          </div>
        </LazyDisclosure>
      )}
      </div>

      <LazyDisclosure title={english ? "7-day trend detail" : "查看 7 天趋势明细"}>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Did judgement produce movement" : "本周判断有没有产生结果"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Start with what was confirmed, stopped, or turned into real work."
                : "先看哪些被确认推进、哪些被拦下、哪些变成了实际动作。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <UsageCell
                label={english ? "Sample check" : "样本校验"}
                value={`${data.recommendationQuality.goldenSummary.passedCases}/${data.recommendationQuality.goldenSummary.totalCases}`}
              />
              <UsageCell
                label={english ? "Confirmed" : "确认推进"}
                value={`${data.recommendationQuality.acceptanceRate}%`}
              />
              <UsageCell
                label={english ? "Turned into work" : "变成动作"}
                value={`${data.recommendationQuality.actionCreationRate}%`}
              />
              <UsageCell
                label={english ? "Accepted after edit" : "改写后通过"}
                value={`${data.recommendationQuality.editedApprovalRate}%`}
              />
            </div>
            <LazyDisclosure title={english ? "Action-type detail" : "查看各类动作明细"}>
            <div className="space-y-3">
              {data.recommendationQuality.byActionType.length ? (
                data.recommendationQuality.byActionType
                  .slice(0, 4)
                  .map((item) => (
                    <div
                      key={item.actionType}
                      className="theme-surface-panel rounded-2xl px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                          {analyticsText(
                            actionTypeLabels[
                              item.actionType as keyof typeof actionTypeLabels
                            ] ?? analyticsKey(item.actionType),
                          )}
                        </p>
                        <Badge variant="info">
                          {english
                            ? `${item.generated} recommendations`
                            : `${item.generated} 条候选判断`}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <UsageCell
                          label={english ? "Confirmed" : "确认推进"}
                          value={`${item.acceptanceRate}%`}
                        />
                        <UsageCell
                          label={english ? "Stopped" : "被拦下"}
                          value={`${item.rejectionRate}%`}
                        />
                        <UsageCell
                          label={english ? "Turned into work" : "变成动作"}
                          value={item.actionCreated}
                        />
                        <UsageCell
                          label={english ? "Accepted after edit" : "改写后通过"}
                          value={item.editedApproved}
                        />
                      </div>
                    </div>
                  ))
              ) : (
                <EmptyState
                  title={
                    english
                      ? "No suggestion feedback yet"
                      : "还没有建议反馈"
                  }
                  description={
                    english
                      ? "Once operators accept, reject or turn suggestions into work, this section will show which paths are useful."
                      : "当负责人开始采纳、拒绝或把建议转成动作后，这里会显示哪些路径有用。"
                  }
                />
              )}
            </div>
            </LazyDisclosure>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Which meeting facts are usable" : "会议里哪些事实可继续使用"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Check whether facts, commitments and blockers can support follow-through."
                : "看事实、承诺和卡点是否可靠，能不能支撑后续推进。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <UsageCell
                label={english ? "Sample check" : "样本校验"}
                value={`${data.memoryQuality.goldenSummary.passedCases}/${data.memoryQuality.goldenSummary.totalCases}`}
              />
              <UsageCell
                label={english ? "Fact hit rate" : "事实命中率"}
                value={`${data.memoryQuality.goldenSummary.factHitRate}%`}
              />
              <UsageCell
                label={english ? "Commitment hit rate" : "承诺命中率"}
                value={`${data.memoryQuality.goldenSummary.commitmentHitRate}%`}
              />
              <UsageCell
                label={english ? "Blocker hit rate" : "卡点识别率"}
                value={`${data.memoryQuality.goldenSummary.blockerHitRate}%`}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <UsageCell
                label={english ? "Correction rate" : "修正率"}
                value={`${data.memoryQuality.correctionRate}%`}
              />
              <UsageCell
                label={english ? "Invalidation rate" : "失效率"}
                value={`${data.memoryQuality.invalidationRate}%`}
              />
              <UsageCell
                label={english ? "Manual confirmations" : "人工确认"}
                value={data.memoryQuality.confirmations}
              />
              <UsageCell
                label={english ? "Total corrections" : "修正总数"}
                value={data.memoryQuality.corrections}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Fact sources" : "事实来源"}
                </p>
                {data.memoryQuality.sourceBreakdown.map((item) => (
                  <div
                    key={item.sourceType}
                    className="theme-surface-panel rounded-2xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.sourceType === "MEETING_NOTE"
                          ? english
                            ? "Meeting notes"
                            : "会议纪要"
                          : english
                            ? "Conversation Capture"
                            : "现场采集"}
                      </p>
                      <Badge variant="neutral">
                        {english
                          ? `${item.facts + item.commitments + item.blockers} items`
                          : `${item.facts + item.commitments + item.blockers} 条`}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                      {english
                        ? `facts ${item.facts} · commitments ${item.commitments} · blockers ${item.blockers}`
                        : `事实 ${item.facts} · 承诺 ${item.commitments} · 阻塞 ${item.blockers}`}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Likely correction points" : "易错点"}
                </p>
                {data.memoryQuality.errorModes.length ? (
                  data.memoryQuality.errorModes.map((item) => (
                    <div
                      key={item.label}
                      className="theme-surface-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                    >
                      <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                        {analyticsText(item.label)}
                      </p>
                      <Badge variant="warning">{item.count}</Badge>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={
                      english
                        ? "No obvious error mode recently"
                        : "最近还没有明显误差模式"
                    }
                    description={
                      english
                        ? "Few recent corrections — keep accumulating signal."
                        : "近期修正少——继续累积信号。"
                    }
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Meeting record flow" : "会议记录流向"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Did capture reach transcript, memory, suggestion and approval — or stop at start?"
                : "采集走到了转写、记忆、建议、审批了吗——还是停在开始？"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <UsageRow
              label={english ? "Capture started" : "开始采集"}
              value={data.captureOverview.started}
            />
            <UsageRow
              label={english ? "Audio uploaded" : "音频上传"}
              value={data.captureOverview.audioUploaded}
            />
            <UsageRow
              label={english ? "Transcript generated" : "生成转写文本"}
              value={data.captureOverview.transcriptGenerated}
            />
            <UsageRow
              label={english ? "Insights generated" : "生成洞察"}
              value={data.captureOverview.insightsGenerated}
            />
            <UsageRow
              label={english ? "Memory writeback" : "写回记忆"}
              value={data.captureOverview.memoryWritten}
            />
            <UsageRow
              label={english ? "Recommendation refreshed" : "刷新判断建议"}
              value={data.captureOverview.recommendationsRefreshed}
            />
            <UsageRow
              label={english ? "Actions created" : "生成动作"}
              value={data.captureOverview.actionsCreated}
            />
            <UsageRow
              label={english ? "Completed" : "处理完成"}
              value={data.captureOverview.processingCompleted}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english
                ? "Recommendation execution depth in the last 7 days"
                : "最近 7 天判断建议进入执行的程度"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Glancing at titles, or actually opening evidence and acting?"
                : "只看标题，还是会展开依据和动作？"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.days.map((item) => (
              <TrendCompareRow
                key={item.key}
                label={item.label}
                first={item.recommendationActionCreated}
                second={item.recommendationRejected}
                max={maxRecommendationAction}
                firstLabel={english ? "Action created" : "生成动作"}
                secondLabel={english ? "Rejected" : "拒绝"}
              />
            ))}
            <div className="theme-surface-panel-soft grid gap-3 rounded-2xl px-4 py-4 md:grid-cols-3">
              <UsageCell
                label={english ? "Card views" : "卡片曝光"}
                value={data.recommendationOverview.cardViewed}
              />
              <UsageCell
                label={english ? "Evidence expanded" : "展开依据"}
                value={data.recommendationOverview.explanationViewed}
              />
              <UsageCell
                label={english ? "Edited approved" : "编辑后采纳"}
                value={data.recommendationOverview.editedApproved}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Login trend in the last 7 days" : "最近 7 天登录趋势"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Check whether the product has formed a stable open habit."
                : "判断产品是否形成稳定打开习惯。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.days.map((item) => (
              <TrendRow
                key={item.key}
                label={item.label}
                value={item.loginCount}
                max={maxLogin}
                tone="bg-[color:var(--status-info-bg)]0"
                suffix={english ? "logins" : "次登录"}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english
                ? "Approval trend in the last 7 days"
                : "最近 7 天审批趋势"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Check whether approvals are truly driving execution instead of staying at the suggestion layer."
                : "关注审批是否真的在驱动动作执行，而不是只停留在建议。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.days.map((item) => (
              <TrendCompareRow
                key={item.key}
                label={item.label}
                first={item.approvalsApproved}
                second={item.approvalsRejected}
                max={maxApproval}
                firstLabel={english ? "Approved" : "批准"}
                secondLabel={english ? "Rejected" : "拒绝"}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english
                ? "Opportunity movement in the last 7 days"
                : "最近 7 天机会推进趋势"}
            </CardTitle>
            <CardDescription>
              {english
                ? "If this number stays at 0, the product has not really entered the opportunity-momentum loop yet."
                : "如果这个数字持续为 0，说明产品还没真正进入机会推进链路。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.days.map((item) => (
              <TrendRow
                key={item.key}
                label={item.label}
                value={item.opportunityStageChanges}
                max={maxStage}
                tone="bg-[color:var(--status-warning-bg)]0"
                suffix={english ? "moves" : "次推进"}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english
                ? "Follow-up draft generation in the last 7 days"
                : "最近 7 天跟进草稿生成趋势"}
            </CardTitle>
            <CardDescription>
              {english
                ? 'Check whether users are really invoking the "AI drafts my next move" workflow.'
                : "判断“帮我起草下一步”是否被用户真正调用。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.days.map((item) => (
              <TrendRow
                key={item.key}
                label={item.label}
                value={item.followupDraftsGenerated}
                max={maxDraft}
                tone="bg-[color:var(--accent)]"
                suffix={english ? "generated" : "次生成"}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english
                ? "Work suggestions in the last 7 days"
                : "最近 7 天工作建议趋势"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Lots of suggestions but few reviewed actions = not in real use yet."
                : "建议多、被采纳的少 = 还没真正用起来。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.days.map((item) => (
              <TrendRow
                key={item.key}
                label={item.label}
                value={item.recommendationGenerated}
                max={maxRecommendation}
                tone="bg-[color:var(--accent-soft)]0"
                suffix={english ? "generated" : "次生成"}
              />
            ))}
          </CardContent>
        </Card>
      </div>
      </LazyDisclosure>

      <LazyDisclosure title={english ? "Usage detail" : "查看使用明细"}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Top 10 actions" : "常用动作前十"}</CardTitle>
            <CardDescription>
              {english
                ? "Use this to see which functions are truly being used instead of only looking at total opens."
                : "帮助判断用户到底在用哪些功能，而不是只看总打开量。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topEvents.length ? (
              data.topEvents.map((item, index) => (
                <div
                  key={item.eventName}
                  className="theme-surface-panel flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="theme-surface-icon flex h-8 w-8 items-center justify-center rounded-2xl text-sm font-semibold text-[color:var(--muted)]">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                        {analyticsText(
                          eventLabels[item.eventName] ??
                            analyticsKey(item.eventName),
                        )}
                      </p>
                      <p className="break-words text-sm text-[color:var(--muted-foreground)]">
                        {english
                          ? item.eventName
                          : analyticsKey(item.eventName)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="neutral">{item.count}</Badge>
                </div>
              ))
            ) : (
              <EmptyState
                title={
                  english ? "Not enough usage data yet" : "还没有足够的使用数据"
                }
                description={
                  english
                    ? "Once users start logging in, approving and moving opportunities, hot events will appear here automatically."
                    : "用户开始登录、审批、推进机会后，这里会自动出现热门事件。"
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english
                ? "Usage by user in the last 7 days"
                : "按用户查看近 7 天使用情况"}
            </CardTitle>
            <CardDescription>
              {english
                ? "This is useful during pilot to see who is truly using the product and who is still only observing from the outside."
                : "适合试点阶段判断谁在真正使用，谁还只是旁观或浅层打开。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.userUsage.length ? (
              data.userUsage.map((item) => (
                <div
                  key={item.user.id}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {item.user.name}
                      </p>
                      <p className="text-sm text-[color:var(--muted-foreground)]">
                        {item.user.email}
                      </p>
                    </div>
                    <Badge variant="info">
                      {english
                        ? `Signals ${item.totalSignals}`
                        : `信号 ${item.totalSignals}`}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                    <UsageCell
                      label={english ? "Login" : "登录"}
                      value={item.loginCount}
                    />
                    <UsageCell
                      label={english ? "Dashboard" : "首页"}
                      value={item.dashboardViewCount}
                    />
                    <UsageCell
                      label={english ? "Meetings" : "会议"}
                      value={item.meetingViewCount}
                    />
                    <UsageCell
                      label={english ? "Action items" : "行动项"}
                      value={item.actionItemsGenerated}
                    />
                    <UsageCell
                      label={english ? "Approval submitted" : "发起审批"}
                      value={item.approvalsSubmitted}
                    />
                    <UsageCell
                      label={english ? "Approved" : "批准"}
                      value={item.approvalsApproved}
                    />
                    <UsageCell
                      label={english ? "Rejected" : "拒绝"}
                      value={item.approvalsRejected}
                    />
                    <UsageCell
                      label={english ? "Opportunity moves" : "机会推进"}
                      value={item.opportunityStageChanges}
                    />
                    <UsageCell
                      label={english ? "Follow-up drafts" : "跟进草稿"}
                      value={item.followupDraftsGenerated}
                    />
                    <UsageCell
                      label={english ? "Policy changes" : "改策略"}
                      value={item.policyChanges}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={
                  english
                    ? "No user activity in the last 7 days yet"
                    : "近 7 天还没有用户使用记录"
                }
                description={
                  english
                    ? "Once users start logging in and triggering key actions, usage rolls up here automatically."
                    : "当用户开始登录并触发关键动作后，这里会自动汇总使用情况。"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
      </LazyDisclosure>

      <LazyDisclosure title={english ? "Recent activity stream" : "查看最近活动流"}>
      <Card>
        <CardHeader>
          <CardTitle>
            {english ? "Recent event stream" : "最近事件流"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Use this to quickly verify telemetry and replay behavior during pilot."
              : "快速核对使用信号是否正常，也方便试点阶段做行为回放。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentEvents.length ? (
            data.recentEvents.map((event) => (
              <div
                key={event.id}
                className="theme-surface-panel rounded-2xl px-4 py-4"
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                    <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                      {analyticsText(
                        eventLabels[event.eventName] ??
                          analyticsKey(event.eventName),
                      )}
                    </p>
                    <Badge variant="neutral">
                      {analyticsKey(event.eventCategory)}
                    </Badge>
                  </div>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {formatDateLabel(event.createdAt)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-[color:var(--muted-foreground)]">
                  <span className="min-w-0 break-words">
                    {english ? "Object" : "对象"}：
                    {analyticsObjectType(event.targetType)}
                  </span>
                  <span>·</span>
                  <span className="min-w-0 break-words">
                    {english ? "Source" : "来源"}：
                    {analyticsKey(event.sourcePage) ||
                      (english ? "Unknown page" : "未知页面")}
                  </span>
                  <span>·</span>
                  <span className="min-w-0 break-words">
                    {trimText(event.targetId, 28)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={english ? "No event stream yet" : "还没有事件流"}
              description={
                english
                  ? "Logins, page opens and key actions will leave event records here."
                  : "登录、打开页面和关键动作都会在这里留下事件记录。"
              }
            />
          )}
        </CardContent>
      </Card>
      </LazyDisclosure>

      <LazyDisclosure title={english ? "AI work posture detail" : "查看 AI 工作姿态明细"}>
      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "AI task mix" : "AI 工作分布"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Check whether the model is mainly helping with extraction, briefing or explanation right now."
                : "判断智能服务现在主要在帮你处理提取、简报还是解释。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.llmOverview.taskBreakdown.length ? (
              data.llmOverview.taskBreakdown.map((item) => (
                <div
                  key={item.taskType}
                  className="theme-surface-panel flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                      {analyticsText(
                        llmTaskLabels[item.taskType] ??
                          analyticsKey(item.taskType),
                      )}
                    </p>
                    <p className="break-words text-sm text-[color:var(--muted-foreground)]">
                      {analyticsKey(item.taskType)}
                    </p>
                  </div>
                  <Badge variant="info">{item.count}</Badge>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No LLM calls yet" : "还没有智能调用"}
                description={
                  english
                    ? "Once meeting processing, briefing or recommendation explanation uses model enhancement, breakdown data will appear here automatically."
                    : "当会议处理、简报或判断建议解释走智能增强后，这里会自动出现分布数据。"
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Recent AI work records" : "最近 AI 工作记录"}
            </CardTitle>
            <CardDescription>
              {english
                ? "During pilot, this is the quickest place to inspect call success, model, latency and fallback."
                : "试点阶段可以从这里快速确认调用成功率、服务来源、耗时和回退情况。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.llmOverview.recentLogs.length ? (
              data.llmOverview.recentLogs.map((item) => (
                <div
                  key={item.id}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                        {analyticsText(
                          llmTaskLabels[item.taskType] ??
                            analyticsKey(item.taskType),
                        )}
                      </p>
                      <Badge variant={item.success ? "success" : "warning"}>
                        {item.success
                          ? english
                            ? "Success"
                            : "成功"
                          : english
                            ? "Fallback"
                            : "回退"}
                      </Badge>
                    </div>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {formatDateLabel(item.createdAt)}
                    </p>
                  </div>
                  <div className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    {analyticsKey(item.provider)} ·{" "}
                    {analyticsKey(item.modelVersion ?? item.model)} ·{" "}
                    {analyticsKey(item.promptKey ?? item.promptVersion)} ·{" "}
                    {item.latencyMs ?? 0}ms
                  </div>
                  <div className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {analyticsKey(
                      item.modelRole ??
                        (english ? "Role not tagged" : "未标记角色"),
                    )}{" "}
                    · {analyticsKey(item.outputMode ?? "text")} ·{" "}
                    {analyticsKey(
                      item.budgetTier ??
                        (english ? "Budget tier not tagged" : "未标记预算层"),
                    )}
                    {item.fallbackReason
                      ? ` · ${english ? "Fallback reason" : "回退原因"}：${analyticsText(llmFallbackLabels[item.fallbackReason] ?? analyticsKey(item.fallbackReason))}`
                      : ""}
                  </div>
                  <p className="mt-3 break-words text-sm text-[color:var(--foreground)]">
                    {analyticsText(
                      item.inputSummary ??
                        (english
                          ? "Input summary not recorded"
                          : "未记录输入摘要"),
                    )}
                  </p>
                  <p className="mt-2 break-words text-sm text-[color:var(--muted-foreground)]">
                    {trimText(
                      analyticsText(
                        item.outputSummary ||
                          item.errorMessage ||
                          (english
                            ? "Output summary not recorded"
                            : "未记录输出摘要"),
                      ),
                      120,
                    )}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No call log yet" : "还没有调用记录"}
                description={
                  english
                    ? "After meeting extraction, object briefing or recommendation explanation hits the model, call summaries will appear here automatically."
                    : "触发会议事实整理、对象简报或判断建议解释后，这里会自动出现调用摘要。"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
      </LazyDisclosure>

      <LazyDisclosure title={english ? "AI service reference" : "查看 AI 服务引用"}>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Instruction set reference" : "指令版本引用"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Check which prompt set is currently driving extraction, briefing and explanation."
                : "核对当前哪套提示词在驱动提取、简报和解释。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.llmOverview.promptBreakdown.length ? (
              data.llmOverview.promptBreakdown.map((item) => (
                <div
                  key={item.promptKey}
                  className="theme-surface-panel flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                    {analyticsKey(item.promptKey)}
                  </p>
                  <Badge variant="info">{item.count}</Badge>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No prompt breakdown yet" : "还没有提示词分布"}
                description={
                  english
                    ? "Once the LLM enters real pilot usage, prompt-version distribution will show up here automatically."
                    : "当智能服务进入试点使用后，这里会自动显示提示词版本使用情况。"
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english
                ? "AI service mix"
                : "智能服务与来源分布"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Use this to see which provider-model combination currently carries most of the workload."
                : "帮助定位当前工作负载主要压在哪个服务来源与服务组合上。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.llmOverview.providerBreakdown.length ? (
              data.llmOverview.providerBreakdown.map((item) => (
                <div
                  key={item.providerModel}
                  className="theme-surface-panel flex min-w-0 items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                    {analyticsKey(item.providerModel)}
                  </p>
                  <Badge variant="approval">{item.count}</Badge>
                </div>
              ))
            ) : (
              <EmptyState
                title={
                  english ? "No provider breakdown yet" : "还没有服务来源分布"
                }
                description={
                  english
                    ? "Once real model calls happen for meeting, briefing or explanation, this will populate automatically."
                    : "触发会议、简报或解释的真实智能调用后，这里会自动出现。"
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Safe-stop reasons" : "安全停住原因"}
            </CardTitle>
            <CardDescription>
              {english
                ? "The goal in pilot is not zero fallback, but knowing why fallback happened and whether the boundary stayed clear."
                : "试点期重点不是零回退，而是知道为什么回退、回退边界是否清晰。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.llmOverview.fallbackBreakdown.length ? (
              data.llmOverview.fallbackBreakdown.map((item) => (
                <div
                  key={item.reason}
                  className="theme-surface-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <p className="min-w-0 break-words font-medium text-[color:var(--foreground)]">
                    {analyticsText(
                      llmFallbackLabels[item.reason] ??
                        analyticsKey(item.reason),
                    )}
                  </p>
                  <Badge variant="warning">{item.count}</Badge>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No recent fallback" : "最近没有回退"}
                description={
                  english
                    ? "If a provider is unconfigured, disabled or fails, the reason distribution will show here clearly."
                    : "如果服务来源未配置、被关闭或调用失败，这里会给出明确的原因分布。"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
      </LazyDisclosure>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "info" | "success" | "approval" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-[color:var(--status-success-border)]"
      : tone === "approval"
        ? "border-[color:var(--status-info-border)]"
        : tone === "warning"
          ? "border-[color:var(--status-warning-border)]"
          : tone === "danger"
            ? "border-[color:var(--status-danger-border)]"
            : "border-[color:var(--status-info-border)]";

  return (
    <Card className={toneClass}>
      <CardContent className="space-y-2 py-5">
        <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
        <p className="text-3xl font-semibold text-[color:var(--foreground)]">{value}</p>
      </CardContent>
    </Card>
  );
}

function TrendRow({
  label,
  value,
  max,
  tone,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
  suffix: string;
}) {
  const width = Math.max(6, Math.round((value / max) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[color:var(--foreground)]">{label}</span>
        <span className="text-[color:var(--muted-foreground)]">
          {value} {suffix}
        </span>
      </div>
      <div className="theme-surface-track h-2 rounded-full">
        <div
          className={`h-2 rounded-full ${tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function TrendCompareRow({
  label,
  first,
  second,
  max,
  firstLabel,
  secondLabel,
}: {
  label: string;
  first: number;
  second: number;
  max: number;
  firstLabel: string;
  secondLabel: string;
}) {
  const firstWidth = Math.max(first ? 10 : 0, Math.round((first / max) * 100));
  const secondWidth = Math.max(
    second ? 10 : 0,
    Math.round((second / max) * 100),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-[color:var(--foreground)]">{label}</span>
        <span className="text-[color:var(--muted-foreground)]">
          {firstLabel} {first} / {secondLabel} {second}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="theme-surface-track h-2 flex-1 rounded-full">
          <div
            className="h-2 rounded-full bg-[color:var(--status-success-bg)]0"
            style={{ width: `${firstWidth}%` }}
          />
        </div>
        <div className="theme-surface-track h-2 flex-1 rounded-full">
          <div
            className="h-2 rounded-full bg-[color:var(--status-danger-bg)]0"
            style={{ width: `${secondWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function UsageCell({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="theme-surface-panel rounded-2xl px-3 py-3">
      <div className="flex items-center gap-2">
        <UserRound className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
          {label}
        </p>
      </div>
      <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function UsageRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="theme-surface-panel flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <p className="text-sm text-[color:var(--muted)]">{label}</p>
      <Badge variant="neutral">{value}</Badge>
    </div>
  );
}
