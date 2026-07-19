import { BookMarked, ListChecks, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PrivateMainlineLedgerReadout } from "@/lib/work-unit-governance/mainline-ledger";

type WorkUnitMainlineLedgerPanelProps = {
  readonly readout: PrivateMainlineLedgerReadout;
  readonly english: boolean;
};

export function WorkUnitMainlineLedgerPanel({
  readout,
  english,
}: WorkUnitMainlineLedgerPanelProps) {
  return (
    <section
      className="border-y border-[color:var(--border)] py-6"
      data-work-unit-mainline-ledger-panel="true"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {english ? "Company memory" : "组织记忆"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {english ? readout.userVisible.title.en : readout.userVisible.title.zh}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {english ? readout.userVisible.summary.en : readout.userVisible.summary.zh}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{english ? "Append-only" : "追加记录"}</Badge>
          <Badge variant="neutral">{english ? "Shape only" : "仅形状"}</Badge>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <BookMarked className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Appended events" : "追加记录"}
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
            {readout.eventCount}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <ListChecks className="h-4 w-4 text-[color:var(--accent)]" aria-hidden />
            {english ? "Current view" : "当前有效视图"}
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
            {readout.effectiveConflictKeyCount}
          </dd>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <dt className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Latest record" : "最近记录"}
          </dt>
          <dd className="mt-2 break-all text-xs leading-5 text-[color:var(--muted-foreground)]">
            {readout.latestEventId ?? (english ? "None" : "暂无")}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" aria-hidden />
        <p>{english ? readout.userVisible.boundary.en : readout.userVisible.boundary.zh}</p>
      </div>
    </section>
  );
}
