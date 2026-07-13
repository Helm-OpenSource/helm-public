import type { AgentRunAuditEntry } from "@/lib/shell/run-trajectory-audit";

import { AUDIT_SECTION_COPY, VERDICT_COPY, t } from "./audit-copy";

const TONE_CLASS: Record<"ok" | "caution" | "danger" | "neutral", string> = {
  ok: "bg-[color:var(--status-success-bg,#dcfce7)] text-[color:var(--status-success-text,#166534)]",
  caution: "bg-[color:var(--status-warning-bg,#fef9c3)] text-[color:var(--status-warning-text,#854d0e)]",
  danger: "bg-[color:var(--status-danger-bg,#fee2e2)] text-[color:var(--status-danger-text,#991b1b)]",
  neutral: "bg-[color:var(--surface-subtle)] text-[color:var(--muted-foreground)]",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="text-xs text-[color:var(--muted-foreground)]">
      {label}: <span className="font-medium text-[color:var(--foreground)]">{value}</span>
    </span>
  );
}

/**
 * 单条运行轨迹审计只读卡。verdict 徽标(陈述性,无控制动作)+ 语义事件计数(边界决策/阻断)+
 * 轨迹失败类 + 隔离态;actor/intent 已脱敏。**无 approve/stop/rerun 按钮**;href 只导航到只读详情。
 */
export function AuditEntryCard({ entry, english }: { entry: AgentRunAuditEntry; english: boolean }) {
  const v = VERDICT_COPY[entry.verdict];
  const f = AUDIT_SECTION_COPY.fields;
  const inner = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[v?.tone ?? "neutral"]}`}>
          {t(v ?? { zh: entry.verdict, en: entry.verdict }, english)}
        </span>
        {entry.quarantined ? (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS.danger}`}>
            {t(f.quarantined, english)}
          </span>
        ) : null}
        <span className="text-xs text-[color:var(--muted-foreground)]">{entry.asOf}</span>
      </div>
      <p className="text-sm text-[color:var(--foreground)]">{entry.intentSummary}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Stat label={t(f.actor, english)} value={entry.actor} />
        <Stat label={t(f.mode, english)} value={entry.mode} />
        <Stat label={t(f.boundaryDecisions, english)} value={entry.boundaryDecisionCount} />
        <Stat label={t(f.blockedActions, english)} value={entry.blockedActionCount} />
      </div>
      <p className="text-xs text-[color:var(--muted-foreground)]">
        {t(f.failureClasses, english)}:{" "}
        {entry.trajectoryFailureClasses.length > 0
          ? entry.trajectoryFailureClasses.join(", ")
          : t(f.none, english)}
      </p>
    </div>
  );
  return (
    <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      {entry.href ? (
        <a href={entry.href} className="block hover:opacity-90" aria-label={entry.intentSummary}>
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  );
}
