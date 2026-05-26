"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ConnectorCredentialPosture,
  ConnectorPermissionSummary,
  ConnectorSyncPosture,
} from "@/features/agentic-governance/connector-permission-summary";
import { Info } from "./settings-display";

type ConnectorPermissionSummaryPanelProps = {
  english: boolean;
  summaries: readonly ConnectorPermissionSummary[];
};

const credentialPostureLabels: Record<
  ConnectorCredentialPosture,
  { zh: string; en: string }
> = {
  configured: { zh: "凭据已配置", en: "Configured" },
  missing: { zh: "凭据缺失", en: "Missing" },
  placeholder: { zh: "占位凭据", en: "Placeholder" },
  expired: { zh: "凭据过期", en: "Expired" },
  unknown: { zh: "未知", en: "Unknown" },
};

const syncPostureLabels: Record<
  ConnectorSyncPosture,
  { zh: string; en: string }
> = {
  ready: { zh: "可读取", en: "Ready" },
  degraded: { zh: "降级", en: "Degraded" },
  dry_run_only: { zh: "仅 dry-run", en: "Dry-run only" },
  blocked: { zh: "阻断", en: "Blocked" },
  unknown: { zh: "未知", en: "Unknown" },
};

function formatCredentialPosture(
  posture: ConnectorCredentialPosture,
  english: boolean,
) {
  const label = credentialPostureLabels[posture];
  return english ? label.en : label.zh;
}

function formatSyncPosture(posture: ConnectorSyncPosture, english: boolean) {
  const label = syncPostureLabels[posture];
  return english ? label.en : label.zh;
}

function countActions(
  summaries: readonly ConnectorPermissionSummary[],
  key: "autoAllowed" | "reviewRequired" | "neverAllowed",
) {
  return summaries.reduce((total, summary) => total + summary[key].length, 0);
}

export function ConnectorPermissionSummaryPanel({
  english,
  summaries,
}: ConnectorPermissionSummaryPanelProps) {
  const reviewRequiredCount = countActions(summaries, "reviewRequired");
  const neverAllowedCount = countActions(summaries, "neverAllowed");
  const autoAllowedCount = countActions(summaries, "autoAllowed");

  return (
    <Card className="workspace-panel-muted">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>
              {english
                ? "Connector permission summary"
                : "连接器权限摘要"}
            </CardTitle>
            <CardDescription>
              {english
                ? "What each connector can read, prepare for review, or never auto-run."
                : "每个连接器能读什么、能为复核准备什么、永远不能自动执行什么。"}
            </CardDescription>
          </div>
          <Badge variant="info">
            {english ? "Read-only governance" : "只读治理"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info
            label={english ? "Connectors covered" : "覆盖连接器"}
            value={String(summaries.length)}
          />
          <Info
            label={english ? "Auto lane" : "自动允许项"}
            value={String(autoAllowedCount)}
          />
          <Info
            label={english ? "Review-required lane" : "需复核项"}
            value={String(reviewRequiredCount)}
          />
          <Info
            label={english ? "Never-allowed lane" : "永不允许项"}
            value={String(neverAllowedCount)}
          />
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
          <p className="font-medium text-[color:var(--foreground)]">
            {english ? "Boundary" : "边界"}
          </p>
          <p className="mt-2">
            {english
              ? "The auto lane only permits source reads and review packet preparation. Customer-visible send, CRM stage write, approval, payment, pricing commitment and external write remain review-required or never allowed."
              : "自动允许项只覆盖来源读取和复核材料准备。客户可见发送、CRM 阶段写回、审批、付款、报价承诺和外部写回都继续保持需复核或永不允许。"}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {summaries.map((summary) => (
            <article
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
              key={summary.providerId}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                    {summary.displayName}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {summary.boundaryNote}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge
                    variant={
                      summary.credentialPosture === "configured"
                        ? "success"
                        : summary.credentialPosture === "placeholder"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {formatCredentialPosture(summary.credentialPosture, english)}
                  </Badge>
                  <Badge
                    variant={
                      summary.syncPosture === "ready"
                        ? "success"
                        : summary.syncPosture === "dry_run_only"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {formatSyncPosture(summary.syncPosture, english)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <PermissionLane
                  english={english}
                  items={summary.autoAllowed}
                  label={english ? "Auto allowed" : "自动允许"}
                />
                <PermissionLane
                  english={english}
                  items={summary.reviewRequired}
                  label={english ? "Review required" : "需要复核"}
                />
                <PermissionLane
                  english={english}
                  items={summary.neverAllowed}
                  label={english ? "Never allowed" : "永不允许"}
                />
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                  {english ? "Readable scopes" : "可读取范围"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.dataScopes.map((scope) => (
                    <Badge key={scope} variant="neutral">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionLane({
  english,
  items,
  label,
}: {
  english: boolean;
  items: readonly string[];
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
      <p className="text-xs font-semibold text-[color:var(--foreground)]">
        {label}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[color:var(--muted-foreground)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
          {english ? "None declared" : "未声明"}
        </p>
      ) : null}
    </div>
  );
}
