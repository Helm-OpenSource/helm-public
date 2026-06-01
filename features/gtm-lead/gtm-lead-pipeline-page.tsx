import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, Compass, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  formatGtmLeadIcpFitLabel,
  formatGtmLeadReadinessStageLabel,
  formatGtmLeadSourceTypeLabel,
  formatGtmLeadStageBadgeVariant,
  formatGtmLeadStageLabel,
} from "@/lib/gtm-lead/display-copy";
import {
  GTM_LEAD_STAGES,
  type GtmLeadRecord,
  type GtmLeadStage,
} from "@/lib/gtm-lead/types";

export type GtmLeadPipelineData = {
  leads: GtmLeadRecord[];
  stageCounts: Record<GtmLeadStage, number>;
  workspaceName: string;
};

function formatRelativeUpdatedAt(iso: string, english: boolean): string {
  const updated = new Date(iso).getTime();
  if (!Number.isFinite(updated)) return english ? "—" : "—";
  const diffMs = Date.now() - updated;
  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 1) return english ? "just now" : "刚刚";
  if (diffMinutes < 60)
    return english ? `${diffMinutes}m ago` : `${diffMinutes} 分钟前`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24)
    return english ? `${diffHours}h ago` : `${diffHours} 小时前`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return english ? `${diffDays}d ago` : `${diffDays} 天前`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function GtmLeadPipelinePage({
  data,
  english,
}: {
  data: GtmLeadPipelineData;
  english: boolean;
}) {
  const totalLeads = data.leads.length;
  const activeStages = GTM_LEAD_STAGES.filter(
    (stage) => (data.stageCounts[stage] ?? 0) > 0,
  );

  return (
    <div className="workspace-surface-stack" data-source-page="/operating/gtm-leads">
      <PageHeader
        eyebrow={english ? "Helm reserved · GTM" : "Helm 自营 · GTM"}
        title={english ? "GTM Lead Pipeline" : "GTM 线索管道"}
        description={
          english
            ? "Reserved-only read-only view of Helm self-led leads. Stage transitions go through reviewed actions; this surface only surfaces the current shape of the pipeline."
            : "Helm 自营线索的 reserved-only 只读管道。状态推进必须走复核动作；本面只展示当前管道形状。"
        }
      />

      <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
            <Compass className="h-3.5 w-3.5" />
            {english ? "Pipeline overview" : "管道概览"}
          </div>
          <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
            {english
              ? `${totalLeads} leads across ${activeStages.length} active stages`
              : `${totalLeads} 条线索，分布在 ${activeStages.length} 个活跃阶段`}
          </CardTitle>
          <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
            {english
              ? "Counts are workspace-scoped to the Helm reserved tenant. Empty stages are hidden."
              : "数量已限定在 Helm 自留经营工作区。无线索的阶段不展示。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeStages.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "No GTM leads recorded yet."
                : "暂无 GTM 线索记录。"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeStages.map((stage) => (
                <Badge
                  key={stage}
                  variant={formatGtmLeadStageBadgeVariant(stage)}
                  className="px-3 py-1"
                >
                  <span className="font-medium">
                    {formatGtmLeadStageLabel(stage, english)}
                  </span>
                  <span className="ml-2 rounded-full bg-[color:var(--background)]/40 px-2 py-0.5 text-xs">
                    {data.stageCounts[stage] ?? 0}
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {english ? "Recent leads" : "最近线索"}
          </div>
          <CardTitle className="text-lg tracking-tight text-[color:var(--foreground)]">
            {english
              ? "Most recently updated first"
              : "按最近更新时间排序"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.leads.length === 0 ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english
                ? "No GTM leads to show. New entries appear here once captured."
                : "暂无 GTM 线索。记录新线索后会出现在这里。"}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.leads.map((lead) => (
                <article
                  key={lead.id}
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-3"
                  data-gtm-lead-row={lead.leadKey}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={formatGtmLeadStageBadgeVariant(lead.stage)}>
                      {formatGtmLeadStageLabel(lead.stage, english)}
                    </Badge>
                    <span className="text-sm font-semibold text-[color:var(--foreground)]">
                      {lead.companyName}
                    </span>
                    <span className="text-xs text-[color:var(--muted-foreground)]">
                      · {lead.leadKey}
                    </span>
                    <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">
                      {formatRelativeUpdatedAt(lead.updatedAt, english)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
                    <span>
                      {english ? "Source" : "来源"} ·{" "}
                      {formatGtmLeadSourceTypeLabel(lead.sourceType, english)}
                    </span>
                    <span>
                      {english ? "ICP" : "ICP 匹配"} ·{" "}
                      {formatGtmLeadIcpFitLabel(lead.icpFit, english)}
                    </span>
                    <span>
                      {english ? "Readiness" : "可行性"} ·{" "}
                      {formatGtmLeadReadinessStageLabel(
                        lead.readinessStage,
                        english,
                      )}
                    </span>
                    {lead.industry ? (
                      <span>
                        {english ? "Industry" : "行业"} · {lead.industry}
                      </span>
                    ) : null}
                  </div>
                  {lead.nextAction ? (
                    <p className="mt-2 text-sm text-[color:var(--foreground)]">
                      <Sparkles className="mr-1.5 inline-block h-3.5 w-3.5 align-[-2px] text-[color:var(--mode-link)]" />
                      {english ? "Next" : "下一步"}：{lead.nextAction}
                    </p>
                  ) : null}
                  {lead.blocker ? (
                    <p className="mt-1 text-sm text-[color:var(--warning)]">
                      <AlertTriangle className="mr-1.5 inline-block h-3.5 w-3.5 align-[-2px]" />
                      {english ? "Blocker" : "阻塞"}：{lead.blocker}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="workspace-shell-panel border-[color:var(--mode-card-border)]">
        <CardHeader>
          <CardTitle className="text-base tracking-tight text-[color:var(--foreground)]">
            {english ? "Scope boundary" : "范围边界"}
          </CardTitle>
          <CardDescription className="text-sm leading-7 text-[color:var(--muted-foreground)]">
            {english
              ? "Read-only. No outbound send, no auto-promotion, no cross-workspace aggregation. Stage transitions and content edits must go through reviewed actions. Customer-visible wording requires explicit review."
              : "只读面板。不替企业外发、不自动晋升、不跨工作区聚合。状态推进与内容修改必须走复核动作；任何对外可见文案必须显式复核。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/operating"
            className="text-sm text-[color:var(--mode-link)] underline-offset-2 hover:underline"
          >
            {english ? "Back to operating home" : "返回 经营总盘"}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
