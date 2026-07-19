import { CheckCircle2, RotateCcw, ShieldCheck, Waypoints } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  ActivationHandoffAction,
  ActivationHandoffPosture,
  ActivationHandoffReadout,
} from "@/lib/work-unit-governance/activation-handoff";

type WorkUnitActivationHandoffPanelProps = {
  readonly readout: ActivationHandoffReadout;
  readonly english: boolean;
};

function postureBadge(posture: ActivationHandoffPosture): "success" | "warning" | "danger" | "info" | "neutral" {
  if (posture === "authorized_for_private_plane") return "success";
  if (posture === "authorization_required" || posture === "handoff_request_ready") return "info";
  if (posture === "mainline_required" || posture === "stale_review_required") return "warning";
  return "danger";
}

function actionCopy(actionItem: ActivationHandoffAction, english: boolean): string {
  return actionItem.enabled ? (english ? "Ready to prepare" : "可准备") : (english ? "Blocked" : "已阻断");
}

function scopeCopy(scope: ActivationHandoffReadout["requestedScope"], english: boolean): string {
  const copy: Record<ActivationHandoffReadout["requestedScope"], { zh: string; en: string }> = {
    local_proof: { zh: "本地证明", en: "Local proof" },
    repo_truth: { zh: "仓库事实", en: "Repository truth" },
    private_workspace_truth: { zh: "私有工作区事实", en: "Private workspace truth" },
    staging_readiness: { zh: "预发就绪", en: "Staging readiness" },
    customer_visible: { zh: "客户可见", en: "Customer visible" },
    production_runtime: { zh: "生产运行时", en: "Production runtime" },
    commercial_commitment: { zh: "商业承诺", en: "Commercial commitment" },
  };
  return english ? copy[scope].en : copy[scope].zh;
}

function recoveryCopy(mode: ActivationHandoffReadout["recoveryMode"], english: boolean): string {
  if (mode === "remediation") return english ? "Correction or remediation" : "更正或补救";
  return english ? "Rollback available" : "可回退";
}

export function WorkUnitActivationHandoffPanel({
  readout,
  english,
}: WorkUnitActivationHandoffPanelProps) {
  return (
    <section
      className="border-y border-[color:var(--border)] py-6"
      data-work-unit-activation-handoff-panel="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {english ? "Activation handoff" : "生效交接"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {english ? readout.userVisible.title.en : readout.userVisible.title.zh}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english ? readout.userVisible.boundary.en : readout.userVisible.boundary.zh}
          </p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">
            {english
              ? `Suggested next step: ${readout.userVisible.primaryAction.en}`
              : `建议下一步：${readout.userVisible.primaryAction.zh}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={postureBadge(readout.posture)}>
            {english ? readout.userVisible.status.en : readout.userVisible.status.zh}
          </Badge>
          <Badge variant="neutral">{scopeCopy(readout.requestedScope, english)}</Badge>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Waypoints className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Requested scope" : "生效范围"}
          </dt>
          <dd className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {scopeCopy(readout.requestedScope, english)}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <RotateCcw className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Recovery mode" : "恢复方式"}
          </dt>
          <dd className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {recoveryCopy(readout.recoveryMode, english)}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Receipt shape" : "回执形状"}
          </dt>
          <dd className="mt-2 break-all text-xs leading-5 text-[color:var(--muted-foreground)]">
            {readout.mainlineReceiptRef ?? (english ? "Not ready" : "未准备")}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? "Prepared actions" : "已准备动作"}
        </h3>
        <ul className="mt-3 divide-y divide-[color:var(--border)]">
          {readout.actions.map((actionItem) => (
            <li key={actionItem.actionId} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? actionItem.label.en : actionItem.label.zh}
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Prepared only; no automatic send, writeback, approval, or activation."
                    : "仅准备；不自动外发、不自动写回、不自动批准、不自动生效。"}
                </p>
              </div>
              <Badge variant={actionItem.enabled ? "info" : "neutral"}>
                {actionCopy(actionItem, english)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
        <p>
          {english
            ? "Entering a high-risk scope requires a separate human authorization receipt in the private plane."
            : "进入高风险生效范围必须在私有平面取得独立人类授权回执。"}
        </p>
      </div>
    </section>
  );
}
