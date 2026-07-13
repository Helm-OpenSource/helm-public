import type { OperationSuggestion } from "@/lib/shell/operation-suggestion";

import {
  CATEGORY_COPY,
  EFFECT_LEVEL_COPY,
  READINESS_COPY,
  SECTION_COPY,
  rollbackStrategyLabel,
  t,
} from "./change-packet-copy";

const TONE_CLASS: Record<"neutral" | "caution" | "danger", string> = {
  neutral: "bg-[color:var(--surface-subtle)] text-[color:var(--muted-foreground)]",
  caution: "bg-[color:var(--status-warning-bg,#fef9c3)] text-[color:var(--status-warning-text,#854d0e)]",
  danger: "bg-[color:var(--status-danger-bg,#fee2e2)] text-[color:var(--status-danger-text,#991b1b)]",
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "caution" | "danger" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

/** 一个字段块:标题 + 单值或列表(read-only,无输入、无动作)。 */
function Field({
  label,
  value,
  items,
}: {
  label: string;
  value?: string | null;
  items?: ReadonlyArray<string>;
}) {
  const hasItems = items && items.length > 0;
  if (!value && !hasItems) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">{label}</p>
      {value ? <p className="text-sm text-[color:var(--foreground)]">{value}</p> : null}
      {hasItems ? (
        <ul className="list-disc space-y-0.5 pl-4 text-sm text-[color:var(--foreground)]">
          {items!.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * 单个实施变更包只读卡（Agent-ready Change Packet）。
 *
 * **只读、只导航**：无任何执行/运行/批准按钮——Helm 准备与监督,不代执行(边界横幅
 * 在 section 顶部)。href 只导航到只读详情。effectLevel 色调仅表达副作用等级,非执行态。
 */
export function ChangePacketCard({
  suggestion,
  english,
}: {
  suggestion: OperationSuggestion;
  english: boolean;
}) {
  const { changePacket: p } = suggestion;
  const effect = EFFECT_LEVEL_COPY[p.effectLevel];
  const f = SECTION_COPY.fields;
  return (
    <article className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t(CATEGORY_COPY[suggestion.category], english)}</Badge>
          <Badge>{t(READINESS_COPY[suggestion.readiness], english)}</Badge>
          <Badge tone={effect.tone}>{t(effect, english)}</Badge>
        </div>
        <h3 className="text-base font-semibold text-[color:var(--foreground)]">{suggestion.title}</h3>
        <p className="text-sm text-[color:var(--muted-foreground)]">{suggestion.rationale}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(f.goal, english)} value={p.goal} />
        <Field label={t(f.currentState, english)} value={p.currentState} />
        <Field label={t(f.prerequisites, english)} items={p.prerequisites} />
        <Field label={t(f.requiredPermissions, english)} items={p.requiredPermissions} />
        <Field label={t(f.proposedChanges, english)} items={p.proposedChanges} />
        <Field label={t(f.forbiddenActions, english)} items={p.forbiddenActions} />
      </div>

      {/* 预演 / 审批 / 回滚 —— 治理三件,只读展示 */}
      <div className="grid gap-4 rounded-xl bg-[color:var(--surface-subtle)] p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {t(f.dryRun, english)} · {p.dryRun.required ? t(f.required, english) : t(f.optional, english)}
          </p>
          <p className="text-sm text-[color:var(--foreground)]">
            <span className="text-[color:var(--muted-foreground)]">{t(f.procedure, english)}: </span>
            {p.dryRun.procedure}
          </p>
          <p className="text-sm text-[color:var(--foreground)]">
            <span className="text-[color:var(--muted-foreground)]">{t(f.expectedResult, english)}: </span>
            {p.dryRun.expectedResult}
          </p>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {t(f.approvalPolicy, english)} · {p.approvalPolicy.required ? t(f.required, english) : t(f.optional, english)}
          </p>
          {p.approvalPolicy.approverRole ? (
            <p className="text-sm text-[color:var(--foreground)]">
              <span className="text-[color:var(--muted-foreground)]">{t(f.approver, english)}: </span>
              {p.approvalPolicy.approverRole}
            </p>
          ) : null}
          {p.approvalPolicy.checkpoints.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-[color:var(--foreground)]">
              {p.approvalPolicy.checkpoints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : null}
          {p.approvalPolicy.separationOfDutiesRequired ? (
            <p className="text-xs text-[color:var(--status-warning-text,#854d0e)]">{t(f.separationOfDuties, english)}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
            {t(f.rollback, english)} · {rollbackStrategyLabel(p.rollback.strategy, english)}
          </p>
          <p className="text-sm text-[color:var(--foreground)]">
            <span className="text-[color:var(--muted-foreground)]">{t(f.procedure, english)}: </span>
            {p.rollback.procedure}
          </p>
          <p className="text-sm text-[color:var(--foreground)]">
            <span className="text-[color:var(--muted-foreground)]">{t(f.verification, english)}: </span>
            {p.rollback.verification}
          </p>
        </div>
      </div>

      <Field label={t(f.expectedReceipts, english)} items={p.expectedReceipts} />

      {suggestion.href ? (
        <a
          href={suggestion.href}
          className="inline-flex items-center text-sm font-medium text-[color:var(--accent)] hover:underline"
        >
          {english ? "View read-only detail →" : "查看只读详情 →"}
        </a>
      ) : null}
    </article>
  );
}
