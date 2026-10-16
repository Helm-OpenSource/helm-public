import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CircleAlert,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { BusinessLoopGapReadoutLines } from "@/components/shared/business-loop-gap-readout-lines";
import { EffectModeBadge } from "@/components/shared/effect-mode-badge";
import { OperatingFoundationSummaryCard } from "@/components/shared/operating-foundation-summary";
import { PageHeader } from "@/components/shared/page-header";
import {
  SystemJudgementSummary,
  systemJudgementDetailsClassName,
} from "@/components/shared/system-judgement-summary";
import { TenantResourceOperatingImpactPanel } from "@/components/shared/tenant-resource-operating-impact-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InternalOperatingHomeModel } from "@/lib/internal-operating-workspace";
import type { WorkspaceRuntimeOperatorOverview } from "@/lib/helm-v2/runtime-upgrade";
import type { OperatingFoundationSummary } from "@/lib/operating-system/foundation";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import type { TenantResourceOperatingImpactReadout } from "@/lib/tenant-resources/operating-impact";
import { InternalOperatingObjectCardView } from "@/features/internal-operating-workspace/object-card";
import { formatOperatingDisplayText } from "@/features/internal-operating-workspace/display-copy";
import { createGtmCustomerDemandBriefDraftAction } from "@/features/internal-operating-workspace/gtm-actions";
import {
  formatOperatingReviewStatus,
  type OperatingReviewAction,
} from "@/features/internal-operating-workspace/review-actions";
import { RuntimeOperatorPanel } from "@/features/internal-operating-workspace/runtime-operator-panel";

function gtmControlStatusLabel(status: string, english: boolean) {
  if (english) return status.replace(/_/g, " ").toLowerCase();

  const labels: Record<string, string> = {
    draft: "草稿",
    evidence_needed: "需要证据",
    review_required: "需要复核",
    trial_premise: "试用前提",
  };

  return labels[status] ?? status.replace(/_/g, " ");
}

const objectLinkClassName =
  "font-medium text-[color:var(--accent)] underline-offset-4 hover:underline";

function reviewObjectKindLabel(
  kind: NonNullable<OperatingReviewAction["object"]>["kind"],
  english: boolean,
) {
  switch (kind) {
    case "opportunity":
      return english ? "Opportunity" : "机会";
    case "contact":
      return english ? "Contact" : "联系人";
    default:
      return english ? "Meeting" : "会议";
  }
}

/** One review action: what it is, the object it acts on, and who started it. */
function OperatingReviewActionItem({
  action,
  english,
}: {
  action: OperatingReviewAction;
  english: boolean;
}) {
  return (
    <div
      data-operating-review-action={action.id}
      className="space-y-1.5 rounded-2xl border border-[color:var(--border)] px-3 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={action.href}
          aria-label={action.title}
          className="min-w-0 text-sm font-medium text-[color:var(--foreground)] underline-offset-4 hover:underline"
        >
          {action.title}
        </Link>
        <span className="shrink-0 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
          {formatOperatingReviewStatus(action.status, english)}
        </span>
      </div>
      <p className="break-words text-xs leading-6 text-[color:var(--muted-foreground)]">
        {action.object ? (
          <>
            {reviewObjectKindLabel(action.object.kind, english)}
            {english ? ": " : "："}
            <Link href={action.object.href} className={objectLinkClassName}>
              {action.object.label}
            </Link>
          </>
        ) : english ? (
          "No linked object"
        ) : (
          "未关联对象"
        )}
        {action.company ? (
          <>
            {" · "}
            <Link href={action.company.href} className={objectLinkClassName}>
              {action.company.name}
            </Link>
          </>
        ) : null}
      </p>
      <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
        {english ? "Started by " : "发起人："}
        {action.initiator ?? (english ? "not recorded" : "未记录")}
      </p>
    </div>
  );
}

export function InternalOperatingHome({
  model,
  reviewActions,
  runtimeOverview,
  english,
  canManageRuntime,
  canReviewRuntime,
  tenantResourceImpactReadout,
  operatingFoundationSummary,
  dingtalkWorkflowHealth,
  canAccessTenantHealth = false,
  isHelmReserved = false,
}: {
  model: InternalOperatingHomeModel;
  reviewActions: readonly OperatingReviewAction[];
  runtimeOverview: WorkspaceRuntimeOperatorOverview;
  english: boolean;
  canManageRuntime: boolean;
  canReviewRuntime: boolean;
  tenantResourceImpactReadout: TenantResourceOperatingImpactReadout;
  operatingFoundationSummary: OperatingFoundationSummary;
  dingtalkWorkflowHealth: {
    windowDays: number;
    linkedSignalCount: number;
    convertedActionCount: number;
    pendingApprovalCount: number;
    overdueActionCount: number;
    byDomain: Record<string, number>;
    byDepartment: Record<string, number>;
  };
  canAccessTenantHealth?: boolean;
  isHelmReserved?: boolean;
}) {
  const copy = (value: string) => formatOperatingDisplayText(value, english);
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary: runtimeOverview.businessLoopGapSummary,
    fallbackHref: "/operating",
  });
  const gtmReadout = model.gtmCapabilityPlanReadout;
  const gtmDraftFlow = gtmReadout?.demandBriefDraftFlow ?? null;
  const runtimeEvidenceFocusHref =
    runtimeOverview.operatorStartPointSummary.focusHref ?? "/meetings";
  const runtimeEvidenceStats = [
    {
      label: english ? "Review queue" : "待复核",
      value: runtimeOverview.summary.reviewQueue,
      note: english ? "verification and truth checks" : "验证与事实冲突",
    },
    {
      label: english ? "Continuity risk" : "连续性风险",
      value: runtimeOverview.summary.highRiskContinuitySessions,
      note: english ? "sessions needing attention" : "需要优先处理的会话",
    },
    {
      label: english ? "Weak replay" : "弱回放",
      value: runtimeOverview.summary.weakReplaySessions,
      note: english ? "sessions needing review" : "需要人工复核",
    },
    {
      label: english ? "Saved-state context" : "恢复点资料",
      value: runtimeOverview.summary.checkpointDerivedContinuitySessions,
      note: english ? "sessions using saved context" : "来自恢复点的会话",
    },
  ];
  // Each DingTalk tile renders only when its count is above zero; with all four
  // at zero the DingTalk card is not rendered.
  const dingtalkTiles = [
    {
      key: "linked",
      label: english ? "Linked signals" : "已关联信号",
      value: dingtalkWorkflowHealth.linkedSignalCount,
    },
    {
      key: "converted",
      label: english ? "Converted actions" : "已转动作",
      value: dingtalkWorkflowHealth.convertedActionCount,
    },
    {
      key: "pending",
      label: english ? "Pending approvals" : "待审批",
      value: dingtalkWorkflowHealth.pendingApprovalCount,
    },
    {
      key: "overdue",
      label: english ? "Overdue actions" : "逾期动作",
      value: dingtalkWorkflowHealth.overdueActionCount,
    },
  ].filter((tile) => tile.value > 0);
  const dingtalkDomains = Object.entries(dingtalkWorkflowHealth.byDomain);
  const dingtalkDepartments = Object.entries(dingtalkWorkflowHealth.byDepartment)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Object first: the ranked work list comes straight after the header. The
  // loop gap, resource impact, operating chains, backstage evidence and lower
  // context share the one collapsed system judgement block at the end.
  return (
    <div className="workspace-surface-stack" data-source-page="/operating">
      <PageHeader
        eyebrow={model.eyebrow}
        title={english ? "Today's business" : "今天业务"}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/dashboard">
                {english ? "Back to dashboard" : "回到首页"}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/operating/roles/founder">
                {english ? "Open founder handoff" : "打开创始人接手面"}
              </Link>
            </Button>
          </>
        }
      />

      <section
        className="space-y-4"
        data-operating-work-list="true"
        aria-label={english ? "Work list" : "工作清单"}
      >
        <Card className="workspace-panel-muted border-[color:var(--border)]">
          <CardContent className="grid gap-4 py-5 xl:grid-cols-3">
            <div className="space-y-3 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Target className="h-3.5 w-3.5" />
                {english ? "Top priorities" : "优先处理"}
              </div>
              {model.topJudgements.map((item, index) => (
                <Link
                  key={`${item.href ?? "/dashboard"}-${item.label}-${index}`}
                  href={item.href ?? "/dashboard"}
                  aria-label={copy(item.label)}
                  className="block rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {copy(item.label)}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {copy(item.hint)}
                  </p>
                </Link>
              ))}
            </div>

            <div className="space-y-3 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <Sparkles className="h-3.5 w-3.5" />
                {english ? "Next actions" : "下一步动作"}
              </div>
              {model.immediateActions.map((item, index) => (
                <Link
                  key={`${item.href ?? "/operating"}-${item.label}-${index}`}
                  href={item.href ?? "/operating"}
                  aria-label={copy(item.label)}
                  className="block rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {copy(item.label)}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {copy(item.hint)}
                  </p>
                </Link>
              ))}
            </div>

            <div
              className="space-y-3 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4"
              data-operating-review-actions="true"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                <CircleAlert className="h-3.5 w-3.5" />
                {english ? "Review actions" : "复核动作"}
              </div>
              {reviewActions.length ? (
                reviewActions.map((action) => (
                  <OperatingReviewActionItem
                    key={action.id}
                    action={action}
                    english={english}
                  />
                ))
              ) : (
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  {english ? "No review actions yet." : "还没有复核动作。"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {dingtalkTiles.length ? (
          <Card
            className="workspace-shell-panel border-[color:var(--mode-card-border)]"
            data-operating-dingtalk-health="true"
          >
            <CardHeader>
              <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                {english ? "DingTalk workflow" : "钉钉流转"}
              </CardTitle>
              <CardDescription className="text-sm text-[color:var(--muted-foreground)]">
                {english
                  ? `Last ${dingtalkWorkflowHealth.windowDays} days`
                  : `近 ${dingtalkWorkflowHealth.windowDays} 天`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              {dingtalkTiles.map((tile) => (
                <div
                  key={tile.key}
                  className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                >
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {tile.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                    {tile.value}
                  </p>
                </div>
              ))}
            </CardContent>
            {dingtalkDomains.length > 0 ? (
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {dingtalkDomains.map(([domain, count]) => (
                    <span
                      key={domain}
                      className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]"
                    >
                      {domain}: {count}
                    </span>
                  ))}
                </div>
              </CardContent>
            ) : null}
            {dingtalkDepartments.length > 0 ? (
              <CardContent className="pt-0">
                <p className="mb-2 text-xs text-[color:var(--muted-foreground)]">
                  {english ? "By department" : "按部门分布"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {dingtalkDepartments.map(([department, count]) => (
                    <span
                      key={department}
                      className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]"
                    >
                      {department}: {count}
                    </span>
                  ))}
                </div>
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
            <CardHeader>
              <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                {english ? "Common action templates" : "常用动作模板"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.actionTemplates.map((item) => (
                <Link
                  key={item.label}
                  href={item.href ?? "/operating"}
                  aria-label={copy(item.label)}
                  className="block rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {copy(item.label)}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {copy(item.hint)}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
            <CardHeader>
              <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                {english
                  ? "Write-back from review and follow-through"
                  : "复盘与推进结果回写"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {model.retroFeedback.map((item) => (
                <Link
                  key={item.label}
                  href={item.href ?? "/memory"}
                  aria-label={copy(item.label)}
                  className="block rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {copy(item.label)}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {copy(item.hint)}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {canAccessTenantHealth || isHelmReserved ? (
        <div
          className="grid gap-3 md:grid-cols-2"
          data-helm-reserved-ops-cluster="true"
        >
          {canAccessTenantHealth ? (
            <Card
              className="workspace-shell-panel border-[color:var(--mode-card-border)]"
              data-helm-reserved-tenant-health-entry="true"
            >
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                  <Activity className="h-3.5 w-3.5" />
                  {english ? "Tenant telemetry · ops" : "租户遥测 · 运维"}
                </div>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Tenant Health" : "租户健康"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Privacy-safe cross-tenant readout: alias-only health buckets, cost buckets, support reason codes. No raw customer payloads."
                    : "跨租户隐私安全 readout：alias 化健康分桶、成本分桶、支持介入原因码。不含客户原文负载。"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary">
                  <Link href="/operating/tenant-health">
                    {english ? "Open tenant health" : "打开租户健康"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isHelmReserved ? (
            <Card
              className="workspace-shell-panel border-[color:var(--mode-card-border)]"
              data-helm-reserved-gtm-leads-entry="true"
            >
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                  <Target className="h-3.5 w-3.5" />
                  {english ? "Helm reserved · GTM" : "Helm 自营 · GTM"}
                </div>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "GTM Lead Pipeline" : "GTM 线索管道"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Read-only view of the 13-stage pipeline. Stage moves go through review."
                    : "13 阶段管道的只读视图。状态推进走复核。"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary">
                  <Link href="/operating/gtm-leads">
                    {english ? "Open GTM leads" : "打开 GTM 线索"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {gtmReadout ? (
        <Card
          className="workspace-shell-panel border-[color:var(--mode-card-border)]"
          data-gtm-capability-plan-readout="true"
        >
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              {english ? "Reserved GTM" : "自营 GTM"}
            </div>
            <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
              {gtmReadout.title}
            </CardTitle>
            <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
              {gtmReadout.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Programs" : "合作项目"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                  {gtmReadout.counts.programCount}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Applications" : "申请"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                  {gtmReadout.counts.applicationCount}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Needs review" : "待复核"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                  {gtmReadout.counts.submittedApplicationCount}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Invite pending" : "待邀请"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                  {gtmReadout.counts.acceptedPendingInviteCount}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Referrals" : "转介绍"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                  {gtmReadout.counts.activeReferralCount}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  {english ? "Terms gaps" : "条款缺口"}
                </p>
                <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
                  {gtmReadout.counts.programTermsGapCount}
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Top GTM work items" : "最该推进的 GTM 工作"}
                </p>
                {gtmReadout.topWorkItems.length ? (
                  gtmReadout.topWorkItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-label={item.title}
                      className="block rounded-2xl border border-[color:var(--border)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
                          {item.title}
                        </p>
                        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                          {item.statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {item.subtitle}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-[color:var(--foreground)]">
                        {item.blocker} · {item.nextAction}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {english
                      ? "No reserved GTM item is outranking the operating queue right now."
                      : "当前没有比经营队列更靠前的自营 GTM 项。"}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Capability plan status" : "能力计划状态"}
                </p>
                <div className="space-y-2">
                  {gtmReadout.capabilityPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {plan.label}
                        </p>
                        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                          {plan.status === "review_required"
                            ? english
                              ? "review required"
                              : "需要复核"
                            : plan.status === "ready"
                              ? english
                                ? "ready"
                                : "已成立"
                              : english
                                ? "planned"
                                : "计划中"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {plan.nextAction}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4"
              data-gtm-guided-intake-brief-prototype="true"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {gtmReadout.guidedIntake.title}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {gtmReadout.guidedIntake.reviewGate}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {gtmReadout.guidedIntake.entryModes.map((mode) => (
                    <span
                      key={mode.id}
                      className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] text-[color:var(--muted-foreground)]"
                      title={mode.posture}
                    >
                      {mode.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {english ? "Brief steps" : "简报步骤"}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {gtmReadout.guidedIntake.steps.map((step) => (
                      <div
                        key={step.id}
                        className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-[color:var(--foreground)]">
                            {step.label}
                          </p>
                          <span className="text-[11px] text-[color:var(--muted-foreground)]">
                            {step.questionCount}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
                          {step.inputMode}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {english ? "Required fields" : "必填字段"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {gtmReadout.guidedIntake.requiredFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-1 text-[11px] text-[color:var(--foreground)]"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {english ? "Missing before handoff" : "交接前缺口"}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-[color:var(--foreground)]">
                      {gtmReadout.guidedIntake.missingInformation.length
                        ? gtmReadout.guidedIntake.missingInformation.join(" / ")
                        : english
                          ? "No mandatory brief gap is visible from current source."
                          : "当前来源下没有显性必填缺口。"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {english ? "Clean handoff checks" : "交接检查"}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {gtmReadout.guidedIntake.cleanHandoffChecks.slice(0, 3).map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {gtmDraftFlow ? (
              <div
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4"
                data-gtm-demand-brief-draft-flow="true"
                id="gtm-demand-brief-draft"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {gtmDraftFlow.title}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {gtmDraftFlow.summary}
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-1 text-[11px] text-[color:var(--muted-foreground)]">
                    {english ? "ActionItem + ApprovalTask" : "动作项 + 审批任务"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {gtmDraftFlow.targets.length ? (
                    gtmDraftFlow.targets.map((target) => (
                      <div
                        key={target.applicationId}
                        className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[color:var(--foreground)]">
                              {target.label}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
                              {target.sourceLabel} · {target.posture}
                            </p>
                          </div>
                          {target.hasOpenDraft && target.latestApprovalTaskId ? (
                            <Button asChild size="sm" variant="secondary">
                              <Link href={`/approvals?approvalId=${target.latestApprovalTaskId}#approval-preview`}>
                                {gtmDraftFlow.existingDraftLabel}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          ) : (
                            <form action={createGtmCustomerDemandBriefDraftAction}>
                              <input
                                name="applicationId"
                                type="hidden"
                                value={target.applicationId}
                              />
                              <Button size="sm" type="submit">
                                {gtmDraftFlow.actionLabel}
                              </Button>
                            </form>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {target.missingInformation.slice(0, 5).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                        {target.latestDraftStatusLabel ? (
                          <p className="mt-2 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
                            {target.latestDraftStatusLabel}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? "No application is ready for a CustomerDemandBrief draft candidate."
                        : "当前没有可生成客户需求简报草稿候选的申请。"}
                    </div>
                  )}
                </div>

                {gtmDraftFlow.recentDrafts.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {english ? "Recent draft candidates" : "最近草稿候选"}
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {gtmDraftFlow.recentDrafts.map((draft) => (
                        <Link
                          key={draft.id}
                          href={
                            draft.approvalTaskId
                              ? `/approvals?approvalId=${draft.approvalTaskId}#approval-preview`
                              : "/approvals"
                          }
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-[color:var(--foreground)]">
                              {draft.label}
                            </p>
                            <EffectModeBadge mode="draft_only" english={english} />
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
                            {draft.statusLabel}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <p className="mt-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {gtmDraftFlow.boundary}
                </p>
              </div>
            ) : null}

            <div
              className="grid gap-4 xl:grid-cols-2"
              data-gtm-confirmation-evidence-prototype="true"
            >
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {gtmReadout.confirmationAndEvidence.title}
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-1">
                  {gtmReadout.confirmationAndEvidence.allowedCustomerActions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-[color:var(--foreground)]">
                          {action.label}
                        </p>
                        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                          {action.directApply
                            ? english
                              ? "direct"
                              : "可直接确认"
                            : english
                              ? "review"
                              : "需复核"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
                        {action.boundary}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {english ? "Material fields" : "实质改写字段"}:{" "}
                  {gtmReadout.confirmationAndEvidence.materialRewriteFields.join(" / ")}
                </p>
              </div>

              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Control-line evidence" : "控制线证据"}
                </p>
                <div className="mt-3 space-y-2">
                  {gtmReadout.confirmationAndEvidence.controlLineTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-[color:var(--foreground)]">
                          {template.label}
                        </p>
                        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                          {gtmControlStatusLabel(template.status, english)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
                        {template.evidenceNeeded} · {template.manualAction}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {gtmReadout.confirmationAndEvidence.evidenceDowngradeRule}
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4"
              data-gtm-diagnostic-proof-pack-prototype="true"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {gtmReadout.diagnosticAndProofPack.title}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {gtmReadout.diagnosticAndProofPack.publicUseGate}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gtmReadout.diagnosticAndProofPack.firstLoopContract.map((step) => (
                    <span
                      key={step}
                      className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-0.5 text-[11px] text-[color:var(--muted-foreground)]"
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {gtmReadout.diagnosticAndProofPack.claimLevels.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-3"
                  >
                    <p className="text-xs font-medium text-[color:var(--foreground)]">
                      {claim.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]">
                      {claim.boundary}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
              {gtmReadout.boundary}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <details className={systemJudgementDetailsClassName} data-system-judgement>
        <SystemJudgementSummary english={english} />
        <div className="space-y-4 px-4 pb-5">
          <p
            className="text-sm leading-6 text-[color:var(--muted-foreground)]"
            data-operating-read-only-note="true"
          >
            {english
              ? "Read-only: this page reads the workspace's opportunities, review actions, DingTalk flow and backstage records. It never executes, sends or writes back to a business system on your behalf; advancing actions happen only after review."
              : "只读：本页读取工作区的机会、复核动作、钉钉流转和后台记录，不会代你执行、外发或写回任何业务系统；推进动作都在复核通过后才发生。"}
          </p>

          <BusinessLoopGapReadoutLines readout={businessLoopGapReadout} english={english} />

          {tenantResourceImpactReadout.totalResources > 0 ? (
            <TenantResourceOperatingImpactPanel
              readout={tenantResourceImpactReadout}
              english={english}
              surface="operating"
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {model.topChains.map((item) => (
              <Card
                key={item.label}
                className="workspace-shell-panel border-[color:var(--mode-card-border)]"
              >
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    {english ? "Current chain" : "当前经营链"}
                  </div>
                  <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                    {copy(item.label)}
                  </CardTitle>
                  <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {copy(item.hint)}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <section className="space-y-4" data-operating-runtime-evidence="true">
            <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {english ? "Backstage evidence" : "后台依据"}
            </div>
            <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
              <CardHeader>
                <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
                  {english ? "Backstage operating readout" : "后台经营摘要"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "What needs review, what may break, where to pick up."
                    : "要复核什么、可能断在哪、接下来从哪儿继续。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {runtimeEvidenceStats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
                    >
                      <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Suggested next handling" : "建议下一步处理"}
                    </p>
                    <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {runtimeOverview.summary.highRiskContinuitySessions > 0
                        ? english
                          ? "Review the affected meeting runs first, then return here only if the operating signal still looks stale."
                          : "先回到受影响的会议推进里补齐复核，再回到这里确认经营信号是否恢复稳定。"
                        : english
                          ? "No continuity risk is currently outranking the main operating work."
                          : "当前没有比主经营动作更靠前的连续性风险。"}
                    </p>
                    <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Full engineering traces stay out of this business surface so they do not compete with judgement and action."
                        : "完整工程追踪不在经营页展开，避免和判断、动作抢前台。"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={runtimeEvidenceFocusHref}>
                        {english ? "Continue work" : "继续处理"}
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/approvals">
                        {english ? "Open review queue" : "打开复核队列"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <RuntimeOperatorPanel
              english={english}
              overview={runtimeOverview}
              canManageRuntime={canManageRuntime}
              canReviewRuntime={canReviewRuntime}
            />
          </section>

          <section className="space-y-4" data-operating-supporting-context="true">
            <OperatingFoundationSummaryCard
              label={operatingFoundationSummary.label}
              title={operatingFoundationSummary.title}
              summary={operatingFoundationSummary.summary}
              items={operatingFoundationSummary.items}
              connections={operatingFoundationSummary.connections}
              note={operatingFoundationSummary.note}
            />

            {model.sections.map((section) => (
              <section key={section.id} className="space-y-4">
                <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
                  <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
                        <BriefcaseBusiness className="h-3.5 w-3.5" />
                        {copy(section.title)}
                      </div>
                      <p className="max-w-3xl text-sm leading-7 text-[color:var(--foreground)]">
                        {copy(section.summary)}
                      </p>
                    </div>
                    <Button asChild variant="secondary">
                      <Link href={section.actionHref}>
                        {copy(section.actionLabel)}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  {section.cards.map((card) => (
                    <InternalOperatingObjectCardView
                      key={card.id}
                      card={card}
                      english={english}
                    />
                  ))}
                </div>
              </section>
            ))}

            <Card className="workspace-panel-muted border-[color:var(--border)]">
              <CardHeader>
                <CardTitle className="text-xl tracking-tight text-[color:var(--foreground)]">
                  {english ? "Role handoff surfaces" : "角色接手面"}
                </CardTitle>
                <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Each role's handoff in one place."
                    : "每个角色的接手都在这里。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {model.roleSurfaces.map((surface) => (
                  <Link
                    key={surface.role}
                    href={surface.href}
                    aria-label={copy(surface.title)}
                    className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
                  >
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {copy(surface.title)}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--muted-foreground)]">
                      {copy(surface.summary)}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--mode-link)]">
                      {english ? "Open handoff surface" : "打开接手面"}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </details>
    </div>
  );
}
