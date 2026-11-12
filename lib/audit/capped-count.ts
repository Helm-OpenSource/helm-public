/**
 * Bounded AuditLog reads for pages and reports.
 *
 * A workspace that records machine events can write a million AuditLog rows a day. Counting a week of
 * them exactly reads millions of index entries (tens of seconds even on the right index), while the
 * number shown to people only needs to say "a lot". These reads stop at a fixed cap instead.
 *
 * This module has no database import so client components can share the formatter.
 */

/** Counts above this are shown as "10,000+" / "1 万+". */
export const AUDIT_COUNT_CAP = 10_000;

/**
 * Lower bound for "most recent N" lists filtered by action type. Without a time bound MySQL may walk the
 * (workspaceId, createdAt) index backwards until it finds N matches, which for rare action types means
 * scanning most of the workspace; with the bound it ranges over (workspaceId, actionType, createdAt).
 */
export const RECENT_AUDIT_LOOKBACK_DAYS = 90;

export type CappedAuditCount = { value: number; capped: boolean };

export const EMPTY_CAPPED_AUDIT_COUNT: CappedAuditCount = { value: 0, capped: false };

/** `raw` is a count taken with `take: AUDIT_COUNT_CAP + 1`. */
export function toCappedAuditCount(raw: number): CappedAuditCount {
  return raw > AUDIT_COUNT_CAP ? { value: AUDIT_COUNT_CAP, capped: true } : { value: raw, capped: false };
}

export function formatCappedAuditCount(value: number, capped: boolean | undefined, english: boolean): string {
  if (!capped) return String(value);
  return english ? `${AUDIT_COUNT_CAP.toLocaleString("en-US")}+` : `${AUDIT_COUNT_CAP / 10_000} 万+`;
}
