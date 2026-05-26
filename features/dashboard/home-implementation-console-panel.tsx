/**
 * Dashboard 客户接入控制台 panel
 *
 * 实施经理打开 Helm 第一屏即可看到当前所有客户接入项目（来自 PR-A1
 * seed-implementation-console.ts 落库的 Opportunity 数据），与
 * `/reports?tab=customer-onboarding` (PR-A2) 共享同一数据源，提供更
 * 高频的"日节奏"推进入口。
 */

import Link from "next/link";
import { ArrowRight, ShieldCheck, Target } from "lucide-react";
import { OpportunityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canRenderImplementationConsolePanel } from "@/lib/extensions/registry";

function extractPhase(description: string | null | undefined): string {
  if (!description) return "—";
  const match = description.match(/Phase\s+(\d+)/);
  return match ? `Phase ${match[1]}` : "—";
}

export async function DashboardHomeImplementationConsolePanel({
  english,
}: {
  english: boolean;
}) {
  const workspace = await getCurrentWorkspace();
  if (!(await canRenderImplementationConsolePanel(workspace))) return null;

  const opportunities = await db.opportunity.findMany({
    where: {
      workspaceId: workspace.id,
      type: OpportunityType.CLIENT,
      description: { contains: "Phase " },
    },
    orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
    take: 5,
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      priorityScore: true,
      nextAction: true,
    },
  });

  if (opportunities.length === 0) return null;

  const blockerCounts = await Promise.all(
    opportunities.map((opportunity) =>
      db.blocker.count({
        where: {
          relatedOpportunityId: opportunity.id,
          status: "OPEN",
        },
      }),
    ),
  );

  return (
    <Card
      className="workspace-panel border-[color:var(--accent)]/40"
      data-testid="dashboard-implementation-console-panel"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--accent)]">
          <Target className="h-3.5 w-3.5" />
          {english ? "Customer onboarding" : "客户接入"}
        </div>
        <CardTitle className="text-base">
          {english
            ? "Onboarding projects on your push list"
            : "实施经理今日推进"}
        </CardTitle>
        <CardDescription>
          {english
            ? `${opportunities.length} active customer onboarding ${
                opportunities.length === 1 ? "project" : "projects"
              }.`
            : `${opportunities.length} 个进行中的客户接入项目。`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {opportunities.map((opportunity, index) => {
          const phase = extractPhase(opportunity.description);
          const blockerCount = blockerCounts[index];
          return (
            <div
              key={opportunity.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[color:var(--foreground)]">
                  {opportunity.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                  {phase} · {english ? "stage" : "阶段"} {opportunity.stage}
                  {blockerCount > 0 ? (
                    <>
                      {" · "}
                      <span className="text-[color:var(--accent-warm)]">
                        {english
                          ? `${blockerCount} open blocker${blockerCount === 1 ? "" : "s"}`
                          : `${blockerCount} 个未决项`}
                      </span>
                    </>
                  ) : null}
                </p>
                {opportunity.nextAction ? (
                  <p className="mt-1.5 line-clamp-1 text-sm leading-6 text-[color:var(--muted)]">
                    {opportunity.nextAction}
                  </p>
                ) : null}
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link href={`/opportunities/${opportunity.id}`}>
                  {english ? "Open" : "查看"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          );
        })}

        <div className="flex gap-2 border-l-2 border-[color:var(--accent)] pl-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
          <p>
            {english
              ? "Phase gate sign-off and customer-side commitments stay in Approvals."
              : "Phase gate 签字和客户侧承诺仍在 Approvals 完成。"}
          </p>
        </div>

        <div className="flex justify-end">
          <Button asChild size="sm" variant="ghost">
            <Link href="/reports?tab=customer-onboarding">
              {english ? "Open full progress" : "查看完整进度"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
