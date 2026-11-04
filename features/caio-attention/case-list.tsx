import Link from "next/link";

import { formatLocalizedDateLabel } from "@/lib/i18n/date-labels";

import {
  caioAttentionCategoryLabel,
  caioAttentionCopy,
  caioAttentionRoleLabel,
  caioAttentionSeverityLabel,
  caioAttentionStatusLabel,
} from "./copy";
import type { CaioAttentionListResult } from "./service-contract";
import { caioAttentionPageCount, isCaioAttentionPending } from "./view-model";

/** Paged case list shared by the queue and "my cases". Rows arrive already filtered and ordered by the loader. */
export function CaioAttentionCaseList({
  result,
  english,
  basePath,
  serviceBound,
}: {
  result: CaioAttentionListResult;
  english: boolean;
  basePath: string;
  serviceBound: boolean;
}) {
  const copy = caioAttentionCopy(english);
  const pageCount = caioAttentionPageCount(result.total, result.pageSize);
  if (result.items.length === 0) {
    return (
      <p className="text-sm text-[color:var(--text-muted)]" data-testid="caio-attention-empty">
        {serviceBound ? copy.empty : copy.unavailable}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]" data-testid="caio-attention-list">
        {result.items.map((item) => (
          <li key={item.caseId} className="px-1 py-3" data-case-status={item.status} data-case-pending={isCaioAttentionPending(item.status)}>
            <Link href={`/caio/attention/${encodeURIComponent(item.caseId)}`} className="font-medium underline-offset-2 hover:underline">
              #{item.shortNo} · {caioAttentionSeverityLabel(english, item.effectiveSeverity)} · {caioAttentionCategoryLabel(english, item.category)}
            </Link>
            <p className="text-sm">
              {copy.status}: {caioAttentionStatusLabel(english, item.status)} · {copy.detector}: <code>{item.detectorId}</code>
            </p>
            <p className="text-xs text-[color:var(--text-muted)]">
              {copy.createdAt}: {formatLocalizedDateLabel(item.createdAt, english)} · {copy.dueAt}:{" "}
              {item.committedDueAt ? formatLocalizedDateLabel(item.committedDueAt, english) : copy.none}
              {item.viewerRoles.length > 0
                ? ` · ${copy.yourRoles}: ${item.viewerRoles.map((role) => caioAttentionRoleLabel(english, role)).join(" / ")}`
                : null}
            </p>
            {item.routingBlocked ? <p className="text-xs text-[color:var(--warning,inherit)]">{copy.routingBlocked}</p> : null}
          </li>
        ))}
      </ul>
      <nav className="flex items-center gap-4 text-sm" aria-label={copy.pageOf(result.page, pageCount)}>
        {result.page > 1 ? <Link href={`${basePath}?page=${result.page - 1}`}>{copy.previous}</Link> : null}
        <span>{copy.pageOf(result.page, pageCount)}</span>
        {result.page < pageCount ? <Link href={`${basePath}?page=${result.page + 1}`}>{copy.next}</Link> : null}
      </nav>
    </div>
  );
}
