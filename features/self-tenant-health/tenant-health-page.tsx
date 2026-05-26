import { Activity, AlertTriangle, CircleDollarSign, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { suppressSmallCount } from "@/lib/self-tenant-health/privacy";
import type {
  TenantHealthBudgetState,
  TenantHealthCostBucket,
  TenantHealthDashboardData,
  TenantHealthState,
} from "@/lib/self-tenant-health/types";

function healthBadgeVariant(state: TenantHealthState) {
  switch (state) {
    case "green":
      return "success";
    case "watch":
      return "info";
    case "risk":
      return "warning";
    case "blocked":
      return "danger";
  }
}

function budgetBadgeVariant(state: TenantHealthBudgetState) {
  switch (state) {
    case "ok":
      return "success";
    case "watch":
      return "info";
    case "risk":
      return "warning";
    case "blocked":
      return "danger";
    case "unknown":
    case "not_configured":
      return "neutral";
  }
}

function healthLabel(state: TenantHealthState, english: boolean) {
  const labels: Record<TenantHealthState, { zh: string; en: string }> = {
    green: { zh: "健康", en: "Green" },
    watch: { zh: "观察", en: "Watch" },
    risk: { zh: "风险", en: "Risk" },
    blocked: { zh: "阻断", en: "Blocked" },
  };
  return english ? labels[state].en : labels[state].zh;
}

function budgetLabel(state: TenantHealthBudgetState, english: boolean) {
  const labels: Record<TenantHealthBudgetState, { zh: string; en: string }> = {
    not_configured: { zh: "未配置", en: "Not configured" },
    ok: { zh: "正常", en: "OK" },
    watch: { zh: "观察", en: "Watch" },
    risk: { zh: "风险", en: "Risk" },
    blocked: { zh: "阻断", en: "Blocked" },
    unknown: { zh: "未知", en: "Unknown" },
  };
  return english ? labels[state].en : labels[state].zh;
}

function costBucketLabel(bucket: TenantHealthCostBucket, english: boolean) {
  const labels: Record<TenantHealthCostBucket, { zh: string; en: string }> = {
    unknown: { zh: "未知", en: "Unknown" },
    cny_0_100: { zh: "¥0-100", en: "CNY 0-100" },
    cny_100_1000: { zh: "¥100-1k", en: "CNY 100-1k" },
    cny_1000_10000: { zh: "¥1k-10k", en: "CNY 1k-10k" },
    cny_10000_plus: { zh: "¥10k+", en: "CNY 10k+" },
  };
  return english ? labels[bucket].en : labels[bucket].zh;
}

function reasonLabel(reason: string, english: boolean) {
  const labels: Record<string, { zh: string; en: string }> = {
    boundary_incident: { zh: "边界事件", en: "Boundary incident" },
    review_coverage_gap: { zh: "复核覆盖不足", en: "Review coverage gap" },
    low_validity_pass_rate: { zh: "信号有效率偏低", en: "Low validity rate" },
    duplicate_noise: { zh: "重复噪音偏高", en: "Duplicate noise" },
    low_accepted_rate: { zh: "采纳率偏低", en: "Low accepted rate" },
    cost_risk: { zh: "成本风险", en: "Cost risk" },
    cost_watch: { zh: "成本观察", en: "Cost watch" },
  };
  return english ? labels[reason]?.en ?? reason : labels[reason]?.zh ?? reason;
}

function SummaryCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-2 text-3xl">{value}</CardTitle>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-[color:var(--muted)]">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-[color:var(--muted)]">{note}</p>
      </CardContent>
    </Card>
  );
}

export function TenantHealthPage({
  data,
  english,
}: {
  data: TenantHealthDashboardData;
  english: boolean;
}) {
  const topRisks = data.rows
    .filter((row) => row.healthState === "blocked" || row.healthState === "risk")
    .slice(0, 5);

  return (
    <div className="workspace-surface-stack" data-source-page="/operating/tenant-health">
      <PageHeader
        eyebrow={english ? "Availability guard" : "可用性守护"}
        title={english ? "Tenant Signal Health" : "租户信号健康"}
        description={
          english
            ? "Helm's own service-health surface for checking tenant usability, support attention and operating quality. It uses aliases, buckets, counts and health states only."
            : "Helm 自身用于守护租户可用性、支持介入和经营质量的健康体检面：只显示别名、分桶、计数和健康状态。"
        }
        briefing={{
          label: english ? "Service posture" : "服务姿态",
          headline: english
            ? "Health check for better service, not a customer workspace feature."
            : "这是为了提供更好服务的健康体检，不是客户租户功能。",
          summary: english
            ? "This page stays inside Helm's reserved workspace and does not expose tenant meetings, CRM records, Ask Helm text, LLM prompts or model outputs. Cost is an estimated bucket, not a billable amount."
            : "本页面只在 Helm 自身租户内使用，不打开租户会议、CRM 记录、Ask Helm 原文、LLM prompt 或模型输出。成本只是估算分桶，不是账单金额。",
        }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={english ? "Tenants observed" : "观察租户"}
          value={data.summary.totalTenants}
          note={english ? "Customer workspaces only" : "只统计客户 workspace"}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <SummaryCard
          label={english ? "Watch / risk" : "观察 / 风险"}
          value={`${data.summary.watchCount} / ${data.summary.riskCount}`}
          note={english ? "Needs product or support attention" : "需要产品或支持团队关注"}
          icon={<Activity className="h-5 w-5" />}
        />
        <SummaryCard
          label={english ? "Blocked" : "阻断"}
          value={data.summary.blockedCount}
          note={english ? "Boundary or review coverage issue" : "边界或复核覆盖问题"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <SummaryCard
          label={english ? "Suppressed buckets" : "小样本抑制"}
          value={data.summary.suppressedBucketCount}
          note={english ? "Counts below 5 are bucketed" : "小于 5 的计数只显示分桶"}
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{english ? "Support queue" : "支持介入队列"}</CardTitle>
          <CardDescription>
            {english
              ? "Highest-risk tenants first."
              : "风险最高的排在前面。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topRisks.length ? (
            <div className="space-y-3">
              {topRisks.map((row) => (
                <div
                  key={`risk-${row.tenantAlias}`}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[color:var(--foreground)]">
                        {row.tenantAlias}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                        {row.supportReasonCodes.length
                          ? row.supportReasonCodes
                              .map((reason) => reasonLabel(reason, english))
                              .join(" · ")
                          : english
                            ? "No support reason attached"
                            : "暂无介入原因"}
                      </p>
                    </div>
                    <Badge variant={healthBadgeVariant(row.healthState)}>
                      {healthLabel(row.healthState, english)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7 text-[color:var(--muted)]">
              {english ? "No risk tenant is visible in this window." : "当前窗口没有可见风险租户。"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{english ? "Tenant rows" : "租户列表"}</CardTitle>
          <CardDescription>
            {english
              ? "Aliases only. Small counts are suppressed; cost is a bucket, not a bill."
              : "只用别名。小样本计数被抑制；成本是估算分桶，不是账单。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  <th className="px-3 py-2">{english ? "Alias" : "别名"}</th>
                  <th className="px-3 py-2">{english ? "Health" : "健康"}</th>
                  <th className="px-3 py-2">{english ? "Source" : "来源"}</th>
                  <th className="px-3 py-2">{english ? "Signals" : "信号"}</th>
                  <th className="px-3 py-2">{english ? "Accepted" : "采纳"}</th>
                  <th className="px-3 py-2">{english ? "Review" : "复核"}</th>
                  <th className="px-3 py-2">{english ? "Est. cost" : "估算成本"}</th>
                  <th className="px-3 py-2">{english ? "Budget" : "预算"}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.tenantAlias}
                    className="rounded-2xl bg-[color:var(--background-elevated)] text-[color:var(--foreground)] shadow-[0_0_0_1px_var(--border)]"
                  >
                    <td className="rounded-l-2xl px-3 py-3 font-mono font-semibold">
                      {row.tenantAlias}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={healthBadgeVariant(row.healthState)}>
                        {healthLabel(row.healthState, english)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-[color:var(--muted)]">
                      {row.primarySourceType}
                    </td>
                    <td className="px-3 py-3">
                      {suppressSmallCount(row.candidateCount)}
                    </td>
                    <td className="px-3 py-3">
                      {suppressSmallCount(row.acceptedCount)}
                    </td>
                    <td className="px-3 py-3">
                      {suppressSmallCount(row.reviewedCount)} /{" "}
                      {suppressSmallCount(row.reviewRequiredCount)}
                    </td>
                    <td className="px-3 py-3">
                      {costBucketLabel(row.costBucket, english)}
                    </td>
                    <td className="rounded-r-2xl px-3 py-3">
                      <Badge variant={budgetBadgeVariant(row.budgetState)}>
                        {budgetLabel(row.budgetState, english)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
