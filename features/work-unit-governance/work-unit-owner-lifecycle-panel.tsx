import { Clock3, ShieldCheck, UserCheck2, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  OwnerLifecycleAction,
  OwnerLifecyclePosture,
  OwnerLifecycleReadout,
} from "@/lib/work-unit-governance/owner-lifecycle";

type WorkUnitOwnerLifecyclePanelProps = {
  readonly readout: OwnerLifecycleReadout;
  readonly english: boolean;
};

function postureBadge(posture: OwnerLifecyclePosture): "success" | "warning" | "danger" | "info" | "neutral" {
  if (posture === "owner_review_satisfied") return "success";
  if (posture === "waiting_for_all_owners" || posture === "waiting_for_owner") return "info";
  if (posture === "escalation_required" || posture === "stale_review_required") return "warning";
  if (posture === "closed") return "neutral";
  return "danger";
}

function actionCopy(action: OwnerLifecycleAction, english: boolean): string {
  if (action.enabled) return english ? "Ready to prepare" : "可准备";
  if (action.actionId === "request_escalation") {
    return english ? "Not expired" : "尚未超时";
  }
  return english ? "Blocked" : "已阻断";
}

function ownerList(values: readonly string[], empty: string): string {
  return values.length > 0 ? values.join(", ") : empty;
}

export function WorkUnitOwnerLifecyclePanel({
  readout,
  english,
}: WorkUnitOwnerLifecyclePanelProps) {
  return (
    <section
      className="border-y border-[color:var(--border)] py-6"
      data-work-unit-owner-lifecycle-panel="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {english ? "Owner path" : "负责人路径"}
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
          <Badge variant="neutral">
            {english
              ? `${readout.requiredMode === "all_of" ? "All" : "Any"} required`
              : readout.requiredMode === "all_of"
                ? "全部确认"
                : "任一确认"}
          </Badge>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <UsersRound className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Required owners" : "需要确认的人"}
          </dt>
          <dd className="mt-2 break-words text-sm leading-6 text-[color:var(--muted-foreground)]">
            {ownerList(readout.requiredOwnerRefs, english ? "None" : "暂无")}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <UserCheck2 className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Confirmed" : "已确认"}
          </dt>
          <dd className="mt-2 break-words text-sm leading-6 text-[color:var(--muted-foreground)]">
            {ownerList(readout.satisfiedOwnerRefs, english ? "None" : "暂无")}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Clock3 className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Needs attention" : "待处理"}
          </dt>
          <dd className="mt-2 break-words text-sm leading-6 text-[color:var(--muted-foreground)]">
            {ownerList(
              readout.pendingOwnerRefs.length > 0
                ? readout.pendingOwnerRefs
                : readout.escalationOwnerRefs,
              english ? "None" : "暂无",
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? "Prepared actions" : "已准备动作"}
        </h3>
        <ul className="mt-3 divide-y divide-[color:var(--border)]">
          {readout.actions.map((action) => (
            <li key={action.actionId} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? action.label.en : action.label.zh}
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {english
                    ? "Prepared only; no automatic notice or approval."
                    : "仅准备；不自动通知、不自动批准。"}
                </p>
              </div>
              <Badge variant={action.enabled ? "info" : "neutral"}>
                {actionCopy(action, english)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
        <p>
          {english
            ? "Human owner authority remains outside Public Core. This panel shows a synthetic review plan only."
            : "人类负责人的授权仍在公开 Core 之外。本面板只展示合成复核计划。"}
        </p>
      </div>
    </section>
  );
}
