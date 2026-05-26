"use client";

import Link from "next/link";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "./settings-display";

type GuidanceItem = {
  title: string;
  body: string;
  href?: string;
  meta?: string;
};

type SettingsOverviewStats = {
  policyCount: number;
  budgetCount: number;
  teamMemberCount: number;
};

type SettingsOperatingReadiness = {
  connectedConnectorCount: number;
  connectorErrorCount: number;
  importedSignalCount: number;
  pendingApprovals: number;
  approvalProtectedActions: number;
  budgetCount: number;
  llmFallbacks7d: number;
};

type SettingsOverviewNavLabels = {
  analytics: string;
  diagnostics: string;
  imports: string;
  inbox: string;
};

type SettingsOverviewPanelsProps = {
  applyRecommendedPilotPreset: () => void;
  canApplyRecommendedPilotPreset: boolean;
  connectorBannerMessage: string | null;
  connectorBannerTone: "success" | "warning" | null;
  diagnosticsEnabled: boolean;
  english: boolean;
  navLabels: SettingsOverviewNavLabels;
  onReviewAuthControls: () => void;
  operatingReadiness: SettingsOperatingReadiness;
  recommendations: GuidanceItem[];
  reminders: GuidanceItem[];
  stats: SettingsOverviewStats;
};

export function SettingsOverviewPanels({
  applyRecommendedPilotPreset,
  canApplyRecommendedPilotPreset,
  connectorBannerMessage,
  connectorBannerTone,
  diagnosticsEnabled,
  english,
  navLabels,
  onReviewAuthControls,
  operatingReadiness,
  recommendations,
  reminders,
  stats,
}: SettingsOverviewPanelsProps) {
  const operatingCards = [
    {
      title: english ? "Ingress online" : "入口在线",
      value:
        operatingReadiness.connectorErrorCount > 0
          ? english
            ? `${operatingReadiness.connectorErrorCount} connector issue${
                operatingReadiness.connectorErrorCount === 1 ? "" : "s"
              }`
            : `${operatingReadiness.connectorErrorCount} 个异常入口`
          : english
            ? `${operatingReadiness.connectedConnectorCount} connected`
            : `${operatingReadiness.connectedConnectorCount} 个已连接入口`,
      body: english
        ? "Meetings, mail, and collaboration sources"
        : "会议、邮箱、协作入口",
      href: "/settings?tab=connectors",
      action: english ? "Check connections" : "检查连接",
    },
    {
      title: english ? "Usable signals" : "可用信号",
      value: english
        ? `${operatingReadiness.importedSignalCount} imported signals`
        : `${operatingReadiness.importedSignalCount} 条已导入信号`,
      body: english
        ? "Sourced and reviewable"
        : "有来源、可复核",
      href: "/imports",
      action: english ? "Review imports" : "查看导入",
    },
    {
      title: english ? "Human review" : "人工复核",
      value: english
        ? `${operatingReadiness.pendingApprovals} pending reviews`
        : `${operatingReadiness.pendingApprovals} 条待复核`,
      body: english
        ? `${operatingReadiness.approvalProtectedActions} protected action types`
        : `${operatingReadiness.approvalProtectedActions} 类动作需先确认`,
      href: "/approvals",
      action: english ? "Open reviews" : "进入复核",
    },
    {
      title: english ? "Cost posture" : "成本是否可控",
      value:
        operatingReadiness.llmFallbacks7d > 0
          ? english
            ? `${operatingReadiness.llmFallbacks7d} fallbacks / 7d`
            : `近 7 天 ${operatingReadiness.llmFallbacks7d} 次保守处理`
          : english
            ? `${operatingReadiness.budgetCount} budget rules`
            : `${operatingReadiness.budgetCount} 条预算规则`,
      body: english
        ? "Assistive service, fallback and budget"
        : "辅助服务、保守处理、预算",
      href: "/settings?tab=budgets",
      action: english ? "Check budgets" : "查看预算",
    },
  ];

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <WorkspaceGuidancePanel
          eyebrow={english ? "Operating settings" : "经营设置"}
          title={
            english
              ? "Change the setting that blocks today's work."
              : "先改卡住今天工作的设置。"
          }
          summary={
            english
              ? "Start from ingress, permissions, review pressure and cost posture."
              : "先看入口、权限、复核压力和成本姿态。"
          }
          recommendations={recommendations}
          reminders={reminders}
          recommendationsLabel={english ? "Recommended next moves" : "建议先处理"}
          remindersLabel={english ? "Context reminders" : "上下文提醒"}
          boundaryLabel={english ? "Boundary" : "边界"}
          boundary={
            english
              ? "Changing settings updates operating posture immediately, but external actions still follow review rules."
              : "设置变更会立刻影响操作姿态，但对外动作仍按复核规则走。"
          }
        />
        <div className="workspace-surface-stack">
          <details className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm text-[color:var(--muted)]">
            <summary className="cursor-pointer list-none font-medium text-[color:var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
              {english ? "View preferences" : "显示偏好"}
            </summary>
            <div className="mt-3">
              <WorkspaceSurfacePreferences />
            </div>
          </details>
          <Card className="workspace-form-assist workspace-panel-muted">
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="workspace-eyebrow">
                    {english ? "Recommended preset" : "推荐经营预设"}
                  </p>
                  <p className="text-base font-semibold tracking-tight text-[color:var(--foreground)]">
                    {english ? "Use the recommended controls." : "套用推荐控制。"}
                  </p>
                </div>
                <details className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-xs text-[color:var(--muted)]">
                  <summary className="cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
                    {english ? "Notes" : "附注"}
                  </summary>
                  <p className="mt-2 max-w-64 leading-5">
                    {english
                      ? "Aligns locale, diagnostics, retention, and capture consent."
                      : "用于对齐语言、就绪度、保留期和现场采集授权。"}
                  </p>
                </details>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={applyRecommendedPilotPreset}
                  disabled={!canApplyRecommendedPilotPreset}
                >
                  {english ? "Apply recommended preset" : "套用推荐预设"}
                </Button>
                <Button type="button" variant="secondary" onClick={onReviewAuthControls}>
                  {english ? "Review auth controls" : "查看身份控制"}
                </Button>
              </div>
              {!canApplyRecommendedPilotPreset ? (
                <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Your current role can inspect these controls, but only workspace operators may change the preset."
                    : "当前角色可以查看这些控制；只有工作区运营管理员才能修改推荐预设。"}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-4 xl:grid-cols-[0.9fr_repeat(3,minmax(0,1fr))]">
          <div className="space-y-2">
            <p className="workspace-eyebrow">
              {english ? "Adjustable rules" : "可调整规则"}
            </p>
            <p className="text-base font-semibold tracking-tight text-[color:var(--foreground)]">
              {english ? "Current workspace rules" : "当前工作区规则"}
            </p>
            <details className="text-xs leading-6 text-[color:var(--muted)]">
              <summary className="cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
                {english ? "What changes affect" : "影响范围"}
              </summary>
              {english
                ? "New actions follow the latest approval and execution path."
                : "新生成动作会按最新审批和执行路径处理。"}
            </details>
          </div>
          <Info
            label={english ? "Review rules" : "复核规则"}
            value={english ? `${stats.policyCount}` : `${stats.policyCount} 条`}
          />
          <Info
            label={english ? "Budget rules" : "预算规则"}
            value={english ? `${stats.budgetCount}` : `${stats.budgetCount} 条`}
          />
          <Info
            label={english ? "Team members" : "团队成员"}
            value={english ? `${stats.teamMemberCount}` : `${stats.teamMemberCount} 位`}
          />
        </CardContent>
      </Card>

      <Card
        className="workspace-panel-muted"
        data-testid="settings-admin-operating-readiness"
      >
        <CardContent className="space-y-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="workspace-eyebrow">
                {english ? "Operating readiness" : "经营可推进性"}
              </p>
              <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                {english
                  ? "Can today's work move under the current controls?"
                  : "今天的事，在当前控制下能不能推进？"}
              </p>
            </div>
            <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs leading-6 text-[color:var(--muted)]">
              <summary className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                {english ? "Guardrail" : "保护线"}
              </summary>
              {english
                ? "This view routes administrators to controls. It does not change rules, submit approvals, or send messages by itself."
                : "这里只把管理员带到正确控制面，不自动改规则、不自动提交审批、不自动发送消息。"}
            </details>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {operatingCards.map((card) => (
              <div
                key={card.title}
                className="theme-surface-panel flex min-h-44 flex-col justify-between rounded-lg px-4 py-4"
              >
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {card.title}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                    {card.value}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                    {card.body}
                  </p>
                </div>
                <Button asChild variant="secondary" className="mt-4 w-full">
                  <Link href={card.href}>{card.action}</Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Common entries" : "常用入口"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/imports">{navLabels.imports}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/inbox">{navLabels.inbox}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/analytics">{navLabels.analytics}</Link>
            </Button>
            {diagnosticsEnabled ? (
              <Button asChild variant="secondary">
                <Link href="/diagnostics">{navLabels.diagnostics}</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {connectorBannerMessage && connectorBannerTone ? (
        <Card
          className={
            connectorBannerTone === "success"
              ? "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)]/70"
              : "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/70"
          }
        >
          <CardContent className="py-4 text-sm text-[color:var(--foreground)]">
            {connectorBannerMessage}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
