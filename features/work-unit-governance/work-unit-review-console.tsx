import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  WorkUnitRuntimeCommand,
  WorkUnitRuntimePosture,
  WorkUnitRuntimeReadout,
} from "@/lib/work-unit-governance/runtime";
import type { WorkUnitState, WorkUnitViolation } from "@/lib/work-unit-governance/contracts";

type WorkUnitReviewConsoleProps = {
  readonly readout: WorkUnitRuntimeReadout;
  readonly english: boolean;
};

function postureBadge(posture: WorkUnitRuntimePosture): "success" | "warning" | "danger" | "info" | "neutral" {
  if (posture === "owner_review_ready" || posture === "accepted_waiting_mainline") {
    return "info";
  }
  if (posture === "mainline_recorded" || posture === "closed") {
    return "success";
  }
  if (posture === "needs_repair" || posture === "stale" || posture === "activation_review_required") {
    return "warning";
  }
  return "danger";
}

function commandAvailability(command: WorkUnitRuntimeCommand, english: boolean): string {
  if (command.commandId === "record_activation") {
    return english ? "Outside public Core" : "不在公开 Core 执行";
  }
  if (command.enabled) {
    return english ? "Ready for owner" : "负责人可处理";
  }
  if (command.commandId === "record_mainline") {
    return english ? "Cannot record yet" : "不能定稿";
  }
  if (command.commandId === "request_activation") {
    return english ? "Cannot request yet" : "暂不能申请";
  }
  return english ? "Blocked" : "已阻断";
}

function stateLabel(state: WorkUnitState | null, english: boolean): string {
  if (state === null) {
    return english ? "No state change" : "不改变状态";
  }

  const labels: Record<WorkUnitState, { readonly zh: string; readonly en: string }> = {
    draft: { zh: "草稿", en: "Draft" },
    candidate: { zh: "候选方案", en: "Candidate" },
    checking: { zh: "检查中", en: "Checking" },
    needs_owner_review: { zh: "等待负责人复核", en: "Waiting for owner review" },
    accepted_by_human: { zh: "负责人已接受", en: "Accepted by owner" },
    rejected_by_human: { zh: "负责人已拒绝", en: "Rejected by owner" },
    changes_requested: { zh: "退回补充", en: "Changes requested" },
    promoted_to_mainline: { zh: "已进入公司主线", en: "Recorded in company mainline" },
    activation_requested: { zh: "等待独立生效授权", en: "Activation review requested" },
    activated_by_human: { zh: "已由负责人授权生效", en: "Activated by owner" },
    stale: { zh: "需要重新复核", en: "Needs fresh review" },
    withdrawn: { zh: "已撤回", en: "Withdrawn" },
    superseded: { zh: "已被更新版本替代", en: "Superseded" },
    quarantined: { zh: "已隔离", en: "Quarantined" },
  };

  return english ? labels[state].en : labels[state].zh;
}

function blockerCopy(blocker: WorkUnitViolation, english: boolean): string {
  switch (blocker.rule) {
    case "validation-check-failed":
      return english
        ? `A required check needs repair: ${blocker.detail}`
        : `有检查需要修复：${blocker.detail}`;
    case "approval-invalidated-by-related-mainline-change":
      return english
        ? "Related company truth changed after review. Review this package again before recording it."
        : "相关公司事实在复核后已变化，需要重新复核后再定稿。";
    case "high-risk-owner-required":
      return english
        ? "A responsible owner is required before this high-risk package can move forward."
        : "高风险工作包必须先指定负责人。";
    case "activation-needs-independent-receipt":
      return english
        ? "Runtime activation needs a separate owner receipt outside Public Core."
        : "运行时生效需要公开 Core 之外的独立负责人回执。";
    case "approval-snapshot-mismatch":
      return english
        ? "The approval no longer matches the current package content."
        : "批准记录不再匹配当前工作包内容。";
    default:
      return english
        ? "This package is blocked by a governance rule."
        : "该工作包被治理规则阻断。";
  }
}

function CommandRow({
  command,
  english,
}: {
  readonly command: WorkUnitRuntimeCommand;
  readonly english: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-[color:var(--border)] py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? command.label.en : command.label.zh}
        </p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
          {english
            ? `Next: ${stateLabel(command.nextState, english)}`
            : `下一步：${stateLabel(command.nextState, english)}`}
        </p>
      </div>
      <Badge variant={command.enabled ? "success" : "neutral"}>
        {commandAvailability(command, english)}
      </Badge>
    </li>
  );
}

function CheckList({
  checks,
  english,
}: {
  readonly checks: WorkUnitRuntimeReadout["card"]["checks"];
  readonly english: boolean;
}) {
  if (checks.length === 0) {
    return (
      <p className="text-sm text-[color:var(--muted-foreground)]">
        {english ? "No check receipt is attached." : "暂无检查回执。"}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {checks.map((check) => (
        <li key={check.name} className="flex items-start gap-2 text-sm">
          {check.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--status-success-text)]" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--status-warning-text)]" />
          )}
          <span className="text-[color:var(--foreground)]">{check.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function WorkUnitReviewConsole({ readout, english }: WorkUnitReviewConsoleProps) {
  const stepLabels = english
    ? ["Start", "Wait", "Review"]
    : ["发起", "等待", "复核"];
  const enabledCommands = readout.commands.filter((command) => command.enabled).length;

  return (
    <section
      className="border-y border-[color:var(--border)] py-6"
      data-work-unit-review-console="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {english ? "Work package governance" : "工作包治理"}
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
            {english ? `${enabledCommands} owner action(s)` : `${enabledCommands} 个负责人动作`}
          </Badge>
        </div>
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-3" aria-label={english ? "Work package flow" : "工作包流程"}>
        {stepLabels.map((label, index) => (
          <li
            key={label}
            className="flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm"
          >
            <CircleDashed className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
            <span className="font-medium text-[color:var(--foreground)]">{index + 1}. {label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-[color:var(--accent)]" aria-hidden />
              <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                {readout.card.title}
              </h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              {readout.card.summary}
            </p>
          </div>

          <dl className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                {english ? "Changed" : "变化"}
              </dt>
              <dd className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                {readout.card.changedWhat}
              </dd>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                {english ? "Recovery" : "回退 / 更正"}
              </dt>
              <dd className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                {readout.card.rollbackOrRemediation}
              </dd>
            </div>
          </dl>

          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Checks" : "检查"}
            </h3>
            <div className="mt-3">
              <CheckList checks={readout.card.checks} english={english} />
            </div>
          </div>

          {readout.blockers.length > 0 ? (
            <div
              className="rounded-lg border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] p-4"
              role="status"
            >
              <h3 className="text-sm font-semibold text-[color:var(--status-warning-text)]">
                {english ? "Needs attention" : "需要处理"}
              </h3>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-[color:var(--status-warning-text)]">
                {readout.blockers.map((blocker) => (
                  <li
                    key={`${blocker.rule}:${blocker.detail}`}
                    data-work-unit-blocker={blocker.rule}
                  >
                    {blockerCopy(blocker, english)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
          <div className="flex items-start gap-2">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" aria-hidden />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Owner actions" : "负责人动作"}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {english
                  ? "Public Core only plans these actions; the owner plane stores real receipts."
                  : "公开 Core 只生成动作计划；真实回执由负责人所在私有平面保存。"}
              </p>
            </div>
          </div>

          <ul className="mt-3">
            {readout.commands.map((command) => (
              <CommandRow key={command.commandId} command={command} english={english} />
            ))}
          </ul>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
            <p>
              {english
                ? "No automatic approval, external send, writeback, or runtime activation is available here."
                : "这里无自动批准、无外发、无写回、无运行时生效。"}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
