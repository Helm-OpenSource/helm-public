import { AlertTriangle, FilePlus2, Repeat2, ShieldCheck, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  RepairLearningPosture,
  WorkUnitRepairLearningAction,
  WorkUnitRepairLearningReadout,
} from "@/lib/work-unit-governance/repair-learning-loop";

type WorkUnitRepairLearningPanelProps = {
  readonly readout: WorkUnitRepairLearningReadout;
  readonly english: boolean;
};

function postureBadge(posture: RepairLearningPosture): "success" | "warning" | "danger" | "info" | "neutral" {
  if (posture === "lesson_asset_ready" || posture === "owner_waiver_recorded") return "success";
  if (posture === "repair_candidate_ready") return "info";
  if (posture === "repair_not_needed") return "neutral";
  if (posture === "lesson_asset_required") return "warning";
  return "danger";
}

function actionCopy(action: WorkUnitRepairLearningAction, english: boolean): string {
  return action.enabled ? (english ? "Ready to prepare" : "可准备") : (english ? "Blocked" : "已阻断");
}

function dispositionCopy(
  disposition: WorkUnitRepairLearningReadout["learningItems"][number]["disposition"],
  english: boolean,
): string {
  if (disposition === "asset_recorded") return english ? "Executable asset" : "可执行资产";
  if (disposition === "owner_waived") return english ? "Owner waiver" : "负责人豁免";
  return english ? "Pending" : "待沉淀";
}

export function WorkUnitRepairLearningPanel({
  readout,
  english,
}: WorkUnitRepairLearningPanelProps) {
  return (
    <section
      className="border-y border-[color:var(--border)] py-6"
      data-work-unit-repair-learning-panel="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {english ? "Repair loop" : "修复闭环"}
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
              ? `${readout.failedChecks.length} failed check(s)`
              : `${readout.failedChecks.length} 个失败检查`}
          </Badge>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <AlertTriangle className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Failed checks" : "失败检查"}
          </dt>
          <dd className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {readout.failedChecks.length > 0 ? (
              readout.failedChecks.map((check) => (
                <p key={check.receiptId}>{check.name}</p>
              ))
            ) : (
              <p>{english ? "None" : "暂无"}</p>
            )}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Repeat2 className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Repair candidate" : "新候选方案"}
          </dt>
          <dd className="mt-2 break-all text-xs leading-5 text-[color:var(--muted-foreground)]">
            {readout.repairedWorkUnitId ?? (english ? "Not prepared" : "未准备")}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <FilePlus2 className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Learning asset" : "经验资产"}
          </dt>
          <dd className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {readout.learningItems.length > 0 ? (
              readout.learningItems.map((item) => (
                <p key={item.findingId}>{dispositionCopy(item.disposition, english)}</p>
              ))
            ) : (
              <p>{english ? "Not required yet" : "暂不需要"}</p>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
          <Wrench className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
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
                    ? "Prepared only; no automatic approval, writeback, send, activation, or check-rule change."
                    : "仅准备；不自动批准、不写回、不外发、不生效、不自动修改检查规则。"}
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
            ? "AI may prepare a new candidate, but owner acceptance and any real learning-asset write stay outside Public Core."
            : "AI 可以准备新候选方案，但负责人接受与真实经验资产写入仍在公开 Core 之外。"}
        </p>
      </div>
    </section>
  );
}
