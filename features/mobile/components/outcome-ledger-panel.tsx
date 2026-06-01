import Link from "next/link";
import { ArrowRight, ClipboardCheck, ListChecks } from "lucide-react";
import type { MustPushOutcomeLedgerSummary } from "../types";

export interface OutcomeLedgerPanelProps {
  ledger: MustPushOutcomeLedgerSummary;
  english?: boolean;
}

export function OutcomeLedgerPanel({
  ledger,
  english = false,
}: OutcomeLedgerPanelProps) {
  const nextItem = ledger.items.find(
    (item) =>
      item.reviewHref &&
      (item.posture === "review_due" || item.posture === "collect_signal"),
  );

  if (!ledger.items.length) return null;

  return (
    <section
      className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
      data-testid="mobile-outcome-ledger"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[18px] bg-[color:var(--surface-subtle)] text-[color:var(--accent)]">
          <ClipboardCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english ? "Outcome ledger" : "结果回收台账"}
            </p>
            <span className="shrink-0 rounded-full bg-[color:var(--status-warning-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--status-warning-text)]">
              {ledger.dueCount}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-[color:var(--foreground)]">
            {ledger.summary}
          </p>
          {nextItem ? (
            <div className="mt-3 rounded-2xl bg-[color:var(--surface-subtle)] px-3 py-3">
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {nextItem.title}
              </p>
              <div className="mt-2 grid gap-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                <span>{nextItem.dueHint}</span>
                <span>{nextItem.expectedSignal}</span>
              </div>
              {nextItem.reviewHref ? (
                <Link
                  href={nextItem.reviewHref}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--mode-link)]"
                >
                  {english ? "Review outcome" : "进入结果复核"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          ) : null}
          {ledger.reviewCue ? (
            <div className="mt-3 border-t border-[color:var(--border)] pt-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                <ListChecks className="h-3.5 w-3.5" />
                <span>{english ? "Review cue" : "复核提示"}</span>
              </div>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
                {ledger.reviewCue.question}
              </p>
              <ul className="mt-2 grid gap-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {ledger.reviewCue.evidenceToCheck.map((evidence) => (
                  <li key={evidence}>{evidence}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ledger.reviewCue.allowedDecisions.map((decision) => (
                  <span
                    key={decision}
                    className="rounded-full border border-[color:var(--border)] px-2 py-1 text-[11px] leading-none text-[color:var(--muted-foreground)]"
                  >
                    {decision}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {ledger.reviewCue.boundaryNote}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
            {ledger.boundaryNote}
          </p>
        </div>
      </div>
    </section>
  );
}
