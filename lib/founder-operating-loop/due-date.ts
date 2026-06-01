/**
 * Helm — Founder Operating Loop dueDate computation.
 *
 * Pure forward-compat utility. No DB, no schema, no runtime adoption.
 *
 * Phase 3 implementation contract §6 specifies:
 *   - critical: now + 24h
 *   - high:     now + 48h
 *   - medium:   now + 5 business days
 *   - low:      now + 10 business days
 *   - watch:    null
 *
 * The function injects `now` and `holidayCalendar` for deterministic
 * testing and to avoid binding to a specific runtime clock or
 * holiday-list source.
 *
 * Times are in the workspace's local timezone. For cross-workspace
 * ActionItem materialization (design §5 + Phase 3 contract §1.2),
 * the caller must pass the bearing workspace's timezone, not the
 * originating signal's.
 *
 * Public boundary anchor:
 *   docs/product/HELM_FOUNDER_OPERATING_LOOP_BOUNDARY_BRIEF.md
 */

import type { SignalSeverity } from "./contract";

/**
 * Predicate: is the given date a business day in the workspace?
 *
 * The function is intentionally caller-provided so tests stay
 * deterministic and so workspace-specific holiday calendars can
 * be injected without coupling this module to any particular
 * source-of-truth.
 */
export type HolidayCalendarFn = (date: Date) => boolean;

/**
 * Default business-day predicate: Mon–Fri only, no holiday awareness.
 * Production should always pass a workspace-aware function instead.
 */
export const defaultIsBusinessDay: HolidayCalendarFn = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

/**
 * dueDate tier is keyed on `SignalSeverity` (5 values) rather than
 * `RiskLevel` (4 values) because the design vocabulary includes
 * "watch" as a no-dueDate tier. Routes that actually write ActionItems
 * (R1 / R2) won't pass "watch" in practice — watch-severity signals
 * route to R4 → watch_only action, which has no ActionItem and no
 * dueDate — but supporting "watch" defensively keeps the function
 * total.
 */
export interface ComputeDueDateInput {
  readonly riskLevel: SignalSeverity;
  readonly now: Date;
  readonly isBusinessDay?: HolidayCalendarFn;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function addHours(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * ONE_HOUR_MS);
}

function addBusinessDays(
  from: Date,
  businessDays: number,
  isBusinessDay: HolidayCalendarFn,
): Date {
  if (businessDays <= 0) return from;
  let cursor = new Date(from.getTime());
  let remaining = businessDays;
  // Cap the search to avoid pathological holiday calendars (e.g.,
  // a predicate that returns false forever) creating an infinite loop.
  const maxIterations = businessDays * 7 + 60;
  let iterations = 0;
  while (remaining > 0 && iterations < maxIterations) {
    cursor = new Date(cursor.getTime() + ONE_DAY_MS);
    if (isBusinessDay(cursor)) {
      remaining -= 1;
    }
    iterations += 1;
  }
  if (remaining > 0) {
    throw new Error(
      `addBusinessDays: predicate returned false for too many consecutive days (remaining=${remaining})`,
    );
  }
  return cursor;
}

/**
 * Compute the dueDate for a Founder Loop ActionItem per Phase 3
 * contract §6.
 *
 * Returns `null` when the risk tier is `watch` (no dueDate by spec).
 * Returns a `Date` for all other tiers.
 *
 * The function is pure and deterministic given `now` and
 * `isBusinessDay`.
 */
export function computeFounderLoopDueDate(
  input: ComputeDueDateInput,
): Date | null {
  const isBusinessDay = input.isBusinessDay ?? defaultIsBusinessDay;
  switch (input.riskLevel) {
    case "critical":
      return addHours(input.now, 24);
    case "high":
      return addHours(input.now, 48);
    case "medium":
      return addBusinessDays(input.now, 5, isBusinessDay);
    case "low":
      return addBusinessDays(input.now, 10, isBusinessDay);
    case "watch":
      return null;
  }
}

/**
 * Convenience: produce a deterministic ISO 8601 string for the
 * computed dueDate, or null when watch. Useful when the caller
 * needs to write into JSON metadata.
 */
export function computeFounderLoopDueDateIso(
  input: ComputeDueDateInput,
): string | null {
  const result = computeFounderLoopDueDate(input);
  return result === null ? null : result.toISOString();
}
