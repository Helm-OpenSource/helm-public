/**
 * /proposals — 客户面对外输出全景
 *
 * R7 标定 5 个对外输出 surface（proposals / external-proposals /
 * external-narratives / offers / sendability / commercial-strengthening）
 * 全是 [id] detail-only，缺统一列表 surface（D2 漏点：用户从某处跳进 detail
 * 后没有"今天还有 N 件可发对外输出"的全景）。
 *
 * 本 page 是 PR-05a：先加 list page 解决 D2 漏点；路由 rename（PR-05b）和
 * feature 目录 rename（PR-05c）后续轮单独做。
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { OpportunityStage, OpportunityType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentWorkspace } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { riskLabel, riskTone, stageLabel } from "@/features/proposals/display-copy";

const ACTIVE_STAGES: OpportunityStage[] = [
  OpportunityStage.CONTACTED,
  OpportunityStage.ADVANCING,
  OpportunityStage.WAITING_THEM,
  OpportunityStage.INTERNAL_SYNC,
];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveWorkspaceUiLocaleForRequest();
  return {
    title: isEnglishLocale(locale)
      ? "External output | Helm"
      : "对外输出 | Helm 掌舵者",
  };
}

export default async function ProposalsListPage() {
  const workspace = await getCurrentWorkspace();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);

  const opportunities = await db.opportunity.findMany({
    where: {
      workspaceId: workspace.id,
      type: OpportunityType.CLIENT,
      stage: { in: ACTIVE_STAGES },
    },
    orderBy: [{ riskLevel: "desc" }, { priorityScore: "desc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      stage: true,
      riskLevel: true,
      nextAction: true,
      priorityScore: true,
      updatedAt: true,
    },
  });

  return (
    <div className="space-y-6" data-source-page="/proposals">
      <PageHeader
        eyebrow={english ? "External output" : "对外输出"}
        title={
          english
            ? "What's still on the way to the customer"
            : "正在路上的对外输出"
        }
        description={
          english
            ? `${opportunities.length} active client opportunities with proposals, offers or follow-up drafts in flight. Pick one to open the review surface — every send still requires a click.`
            : `${opportunities.length} 个进行中的客户机会含提案、报价或跟进草稿。点击进入复核面 — 任何对外发送仍由人手动 click。`
        }
      />

      <div className="flex gap-2 border-l-2 border-[color:var(--accent)] pl-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
        <p>
          {english
            ? "Review the customer, risk and next step first. Customer-facing messages still leave only after your click."
            : "先看客户、风险和下一步；客户可见内容仍然只在你点击后发出。"}
        </p>
      </div>

      {opportunities.length === 0 ? (
        <Card className="workspace-panel-muted border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {english
                ? "No active proposal or follow-up draft right now."
                : "当前没有进行中的提案或跟进草稿。"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? "Once a CRM signal or meeting commitment surfaces, the related draft will wait here for review."
                : "一旦客户关系系统信号或会议承诺出现，对应草稿会在这里等你复核。"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="workspace-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {english ? "Open opportunities" : "进行中的客户机会"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Sorted by risk level then priority score — high risk and high priority surface first."
                : "按风险等级 + 优先级排序——高风险与高优先级先出现。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="overflow-hidden rounded-2xl border border-[color:var(--border)]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[color:var(--surface-subtle)] text-xs font-medium text-[color:var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">
                      {english ? "Customer" : "客户"}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      {english ? "Stage" : "阶段"}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      {english ? "Risk" : "风险"}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      {english ? "Priority" : "优先级"}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      {english ? "Next action" : "下一步动作"}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {english ? "Open" : "查看"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opportunity) => (
                    <tr
                      key={opportunity.id}
                      className="border-t border-[color:var(--border)] transition hover:bg-[color:var(--surface-subtle)]"
                      data-testid={`proposals-row-${opportunity.id}`}
                    >
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/proposals/${opportunity.id}`}
                          className="text-sm font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
                        >
                          {opportunity.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="info">
                          {stageLabel(opportunity.stage, english)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={riskTone(opportunity.riskLevel)}>
                          {riskLabel(opportunity.riskLevel, english)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        {opportunity.priorityScore}
                      </td>
                      <td className="px-4 py-3 align-top text-sm leading-6 text-[color:var(--muted)]">
                        {opportunity.nextAction ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/proposals/${opportunity.id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
