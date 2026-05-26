/**
 * 客户接入进度 surface
 *
 * 列出当前 workspace 下所有 type=CLIENT 且 description 含 "Phase " 关键字的
 * Opportunity，每行展示客户名 / 当前 Phase / 优先级 / 风险 / 下一步动作。
 *
 * 数据来源：PR-A1 的 private implementation-console seed 在 sales demo workspace
 * 创建的内部参考 Opportunity。后续 PR-A2b 会扩展 open Blocker 数等关联指标。
 */

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { OpportunityType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/auth/session";
import { db } from "@/lib/db";

const PHASE_PATTERN_EN = /Phase\s+(\d+)\s*([—–-])?\s*([A-Za-z\s]+)?/;
const PHASE_PATTERN_CN = /Phase\s+(\d+)\s*[—–-]?\s*([一-龥A-Za-z\s]+)?/;

function extractPhase(description: string | null | undefined): string {
  if (!description) return "—";
  const match = description.match(PHASE_PATTERN_CN) ?? description.match(PHASE_PATTERN_EN);
  if (!match) return "—";
  const number = match[1];
  const label = (match[2] ?? "").trim();
  return label ? `Phase ${number} · ${label}` : `Phase ${number}`;
}

function riskTone(level: string): "neutral" | "info" | "warning" | "danger" {
  switch (level) {
    case "LOW":
      return "neutral";
    case "MEDIUM":
      return "info";
    case "HIGH":
      return "warning";
    case "CRITICAL":
      return "danger";
    default:
      return "neutral";
  }
}

function riskLabel(level: string, english: boolean): string {
  if (english) return level;
  switch (level) {
    case "LOW":
      return "低";
    case "MEDIUM":
      return "中";
    case "HIGH":
      return "高";
    case "CRITICAL":
      return "极高";
    default:
      return level;
  }
}

export async function CustomerOnboardingProgressSurface({
  english,
}: {
  english: boolean;
}) {
  const workspace = await getCurrentWorkspace();
  const opportunities = await db.opportunity.findMany({
    where: {
      workspaceId: workspace.id,
      type: OpportunityType.CLIENT,
      description: {
        contains: "Phase ",
      },
    },
    orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      riskLevel: true,
      priorityScore: true,
      nextAction: true,
      updatedAt: true,
    },
  });

  return (
    <Card className="workspace-panel">
      <CardHeader>
        <CardTitle className="text-lg">
          {english ? "Customer onboarding progress" : "客户接入进度"}
        </CardTitle>
        <CardDescription>
          {english
            ? "Current onboarding projects, phase, priority and next action."
            : "当前接入中的项目、当前 Phase、优先级和下一步动作。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {opportunities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-6 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "No active customer onboarding project in this workspace yet. Run the private implementation-console seed to load an internal reference project."
              : "当前 workspace 还没有进行中的客户接入项目。运行私有 implementation-console seed 可落入内部参考项目。"}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--border)]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[color:var(--surface-subtle)] text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Customer" : "客户"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Phase" : "当前 Phase"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Stage" : "推进阶段"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Priority" : "优先级"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Risk" : "风险"}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    {english ? "Next action" : "下一步动作"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opportunity) => (
                  <tr
                    key={opportunity.id}
                    className="border-t border-[color:var(--border)] transition hover:bg-[color:var(--surface-subtle)]"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/opportunities/${opportunity.id}`}
                        className="text-sm font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
                      >
                        {opportunity.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top text-sm">
                      {extractPhase(opportunity.description)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant="info">{opportunity.stage}</Badge>
                    </td>
                    <td className="px-4 py-3 align-top text-sm">
                      {opportunity.priorityScore}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant={riskTone(opportunity.riskLevel)}>
                        {riskLabel(opportunity.riskLevel, english)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top text-sm leading-6 text-[color:var(--muted)]">
                      {opportunity.nextAction ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 border-l-2 border-[color:var(--accent)] pl-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
          <p>
            {english
              ? "Onboarding records here only mirror Helm-side data. Stage gate sign-off, customer-side commitments and approvals stay in Approvals."
              : "这里的接入记录只是 Helm 侧镜像。Phase gate 签字、客户侧承诺和复核动作仍在 Approvals 完成。"}
          </p>
        </div>

        <div className="flex justify-end">
          <Button asChild size="sm" variant="secondary">
            <Link href="/opportunities?type=CLIENT">
              {english ? "Open all client opportunities" : "查看全部客户机会"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
