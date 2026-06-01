import Link from "next/link";
import type { MobileJudgementLoopModel, MobileHeroState } from "../types";

const STATE_BADGE: Record<MobileHeroState, { label: string; labelEn: string; cls: string }> = {
  normal: { label: "待决策", labelEn: "Pending", cls: "bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]" },
  evidence_insufficient: { label: "证据不足", labelEn: "Insufficient Evidence", cls: "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]" },
  conflict: { label: "存在冲突", labelEn: "Conflict", cls: "bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]" },
  connector_down: { label: "连接器离线", labelEn: "Connector Down", cls: "bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]" },
  cross_tenant_denied: { label: "跨租户拒绝", labelEn: "Access Denied", cls: "bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]" },
  empty: { label: "暂无事项", labelEn: "All Clear", cls: "bg-[color:var(--surface-subtle)] text-[color:var(--muted)]" },
};

interface MobileHeroCardProps {
  model: MobileJudgementLoopModel;
  english?: boolean;
}

export function MobileHeroCard({ model, english = false }: MobileHeroCardProps) {
  const badge = STATE_BADGE[model.state];
  const badgeLabel = english ? badge.labelEn : badge.label;
  const isRestricted = model.state === "cross_tenant_denied" || model.state === "empty";

  return (
    <section
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-5 space-y-4"
      data-testid="mobile-hero-card"
      aria-label={english ? "Priority item" : "当前优先事项"}
    >
      {/* State badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
          data-testid="mobile-hero-badge"
        >
          {badgeLabel}
        </span>
      </div>

      {/* Headline */}
      <h2
        className="text-lg font-semibold leading-snug text-[color:var(--foreground)]"
        data-testid="mobile-hero-headline"
      >
        {model.headline}
      </h2>

      {/* Subtext */}
      <p
        className="text-sm text-[color:var(--muted)] leading-relaxed"
        data-testid="mobile-hero-subtext"
      >
        {model.subtext}
      </p>

      {/* Evidence — only shown for non-restricted states with evidence */}
      {!isRestricted && model.evidence && (
        <div
          id="mobile-evidence"
          className="rounded-xl bg-[color:var(--surface-subtle)] border border-[color:var(--border)] px-3 py-3 space-y-2"
          data-testid="mobile-hero-evidence"
        >
          <p className="text-xs font-medium text-[color:var(--muted)]">
            {english ? "Source" : "业务来源"}
          </p>
          <p className="text-xs text-[color:var(--foreground)]">
            {model.evidence.sourceHint}
          </p>
          <p className="text-xs font-medium text-[color:var(--muted)] mt-1">
            {english ? "Why now" : "推进原因"}
          </p>
          <p className="text-xs text-[color:var(--foreground)]">
            {model.evidence.helmInterpretation}
          </p>
        </div>
      )}

      {/* Boundary note — only for non-restricted states with item */}
      {!isRestricted && model.item?.boundaryNote && (
        <div
          className="rounded-xl bg-[color:var(--status-warning-bg)] border border-[color:var(--status-warning-border)] px-3 py-2"
          data-testid="mobile-hero-boundary"
        >
          <p className="text-xs text-[color:var(--status-warning-text)]">
            {model.item.boundaryNote.message}
          </p>
        </div>
      )}

      {/* Outcome checkpoint — keeps Must Push tied to result recovery */}
      {!isRestricted && model.item?.outcomeCheckpoint && (
        <div
          className="rounded-xl bg-[color:var(--surface-subtle)] border border-[color:var(--border)] px-3 py-3 space-y-2"
          data-testid="mobile-hero-outcome"
        >
          <p className="text-xs font-medium text-[color:var(--muted)]">
            {english ? "Outcome check" : "结果回收"}
          </p>
          <p className="text-xs text-[color:var(--foreground)]">
            {model.item.outcomeCheckpoint.dueHint}
          </p>
          <p className="text-xs text-[color:var(--muted)]">
            {model.item.outcomeCheckpoint.expectedSignal}
          </p>
        </div>
      )}

      {/* Actions */}
      {model.actions.length > 0 && (
        <div className="flex flex-col gap-2 pt-1" data-testid="mobile-hero-actions">
          {model.actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className={
                action.variant === "primary"
                  ? "theme-primary-action flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-medium !text-[color:var(--accent-foreground)]"
                  : "flex items-center justify-center rounded-xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)]"
              }
              data-testid={`mobile-hero-action-${action.variant}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
