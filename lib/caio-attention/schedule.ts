import { z } from "zod";

import type { CaioAttentionSeverity } from "./contracts";
import type { CaioAttentionStatus } from "./state-machine";

/**
 * Deadline and reminder timing for attention cases. All wall-clock rules use the policy's fixed UTC
 * offset, never the host time zone. The overlay registers the tenant policy; the default below only
 * exists for anonymous tests and is not any tenant's commitment.
 */

const minuteOfDay = z.number().int().min(0).max(1440);
const policySchema = z.object({
  utcOffsetMinutes: z.number().int().min(-720).max(840),
  daytimeStartMinute: minuteOfDay, // window is inclusive at both ends
  daytimeEndMinute: minuteOfDay,
  criticalCutoffMinute: minuteOfDay, // dispatched / raised before this: same-day due; at or after: next day
  criticalSameDayDueMinute: minuteOfDay,
  criticalNextDayDueMinute: minuteOfDay,
  warningResolveMinutes: z.number().int().positive(),
  noResponseMinutes: z.number().int().positive(),
  criticalPeriodicMinutes: z.number().int().positive(),
  warningPeriodicMinute: minuteOfDay,
  warningDigestMinute: minuteOfDay,
  pendingRepeatMinutes: z.number().int().positive(),
  // Scans landing just after the window end still send daytime-only reminders that fell due inside it.
  windowEndGraceMinutes: z.number().int().min(0).max(30),
  consecutiveBuckets: z.object({ warning: z.number().int().min(1).max(12), critical: z.number().int().min(1).max(12) }).strict(),
  maxEvidenceAgeMinutes: z.number().int().positive(),
}).strict().refine((p) => {
  const inWindow = (m: number) => m >= p.daytimeStartMinute && m <= p.daytimeEndMinute;
  return p.daytimeStartMinute < p.daytimeEndMinute && p.criticalCutoffMinute <= p.criticalSameDayDueMinute
    && [p.criticalSameDayDueMinute, p.criticalNextDayDueMinute, p.warningPeriodicMinute, p.warningDigestMinute].every(inWindow);
}, "policy_order");

export type CaioAttentionPolicy = z.infer<typeof policySchema>;

export function parseCaioAttentionPolicy(raw: unknown): { ok: true; policy: CaioAttentionPolicy } | { ok: false; errorCode: "policy_invalid" } {
  const parsed = policySchema.safeParse(raw);
  return parsed.success ? { ok: true, policy: parsed.data } : { ok: false, errorCode: "policy_invalid" };
}

export const CAIO_ATTENTION_TEST_DEFAULT_POLICY: CaioAttentionPolicy = {
  utcOffsetMinutes: 480, daytimeStartMinute: 8 * 60, daytimeEndMinute: 20 * 60,
  criticalCutoffMinute: 18 * 60, criticalSameDayDueMinute: 20 * 60, criticalNextDayDueMinute: 12 * 60,
  warningResolveMinutes: 72 * 60, noResponseMinutes: 120, criticalPeriodicMinutes: 120,
  warningPeriodicMinute: 10 * 60, warningDigestMinute: 9 * 60 + 30, pendingRepeatMinutes: 30, windowEndGraceMinutes: 10,
  consecutiveBuckets: { warning: 2, critical: 1 }, maxEvidenceAgeMinutes: 15,
};

const MIN = 60_000;
const DAY = 1440 * MIN;
const plus = (at: Date, minutes: number) => new Date(at.getTime() + minutes * MIN);
const earlier = (a: Date | null, b: Date) => (a && a.getTime() < b.getTime() ? a : b);

/** Start of the local day containing `at` (as a UTC instant) and the local offset into that day. */
function localDay(at: Date, p: CaioAttentionPolicy): { start: number; offsetMs: number } {
  const shifted = at.getTime() + p.utcOffsetMinutes * MIN;
  const offsetMs = ((shifted % DAY) + DAY) % DAY;
  return { start: at.getTime() - offsetMs, offsetMs };
}

export function isWithinCaioAttentionDaytime(at: Date, p: CaioAttentionPolicy): boolean {
  const { offsetMs } = localDay(at, p);
  return offsetMs >= p.daytimeStartMinute * MIN && offsetMs <= p.daytimeEndMinute * MIN;
}

/** Send gate for daytime-only rules: the window plus a short grace after its end for late scans. */
export function isWithinCaioAttentionSendWindow(at: Date, p: CaioAttentionPolicy): boolean {
  const { offsetMs } = localDay(at, p);
  return offsetMs >= p.daytimeStartMinute * MIN && offsetMs <= (p.daytimeEndMinute + p.windowEndGraceMinutes) * MIN;
}

/** Daytime-only rules: a due time outside the window moves to the next window opening (one send). */
export function clampToCaioAttentionDaytime(at: Date, p: CaioAttentionPolicy): Date {
  if (isWithinCaioAttentionDaytime(at, p)) return at;
  const { start, offsetMs } = localDay(at, p);
  return new Date(start + (offsetMs < p.daytimeStartMinute * MIN ? 0 : DAY) + p.daytimeStartMinute * MIN);
}

/** Next local occurrence of `minute` strictly after `at`. */
function nextLocalMinute(at: Date, minute: number, p: CaioAttentionPolicy): Date {
  const { start } = localDay(at, p);
  const today = start + minute * MIN;
  return new Date(today > at.getTime() ? today : today + DAY);
}

/** Critical rule: before the cutoff -> same local day due minute; at or after -> next day due minute. */
export function caioAttentionCriticalDueAt(at: Date, p: CaioAttentionPolicy): Date {
  const { start, offsetMs } = localDay(at, p);
  return offsetMs < p.criticalCutoffMinute * MIN
    ? new Date(start + p.criticalSameDayDueMinute * MIN)
    : new Date(start + DAY + p.criticalNextDayDueMinute * MIN);
}

/** Suggested handling deadline shown to the OWNER; it becomes `committedDueAt` only by human confirmation. */
export function suggestCaioAttentionCommittedDueAt(
  severity: CaioAttentionSeverity, createdAt: Date, committedDue: "suggest" | "owner_required", p: CaioAttentionPolicy,
): Date | null {
  if (committedDue === "owner_required") return null;
  return severity === "critical" ? caioAttentionCriticalDueAt(createdAt, p) : plus(createdAt, p.warningResolveMinutes);
}

/** System escalation time (R2). Warning escalations are daytime-only. */
export function caioAttentionUnresolvedEscalateAt(severity: CaioAttentionSeverity, from: Date, p: CaioAttentionPolicy): Date {
  return severity === "critical"
    ? caioAttentionCriticalDueAt(from, p)
    : clampToCaioAttentionDaytime(plus(from, p.warningResolveMinutes), p);
}

export function nextCaioAttentionPeriodicAt(severity: CaioAttentionSeverity, after: Date, p: CaioAttentionPolicy): Date {
  return severity === "critical"
    ? clampToCaioAttentionDaytime(plus(after, p.criticalPeriodicMinutes), p)
    : nextLocalMinute(after, p.warningPeriodicMinute, p);
}

/** Per-rule due fields on the case (v6 §3.1). Each rule advances only its own fields. */
export type CaioAttentionReminderFields = {
  r0aDueAt: Date | null; r0aSentAt: Date | null; r0bDueAt: Date | null; r0bSentAt: Date | null;
  noResponseDueAt: Date | null; r1FiredAt: Date | null;
  unresolvedEscalateAt: Date | null; r2FiredSeverity: CaioAttentionSeverity | null;
  nextPeriodicAt: Date | null;
};

/** On generation: a critical suggestion notifies the OWNER at once, night included; warnings go to the digest. */
export function caioAttentionSuggestFields(severity: CaioAttentionSeverity, createdAt: Date): Pick<CaioAttentionReminderFields, "r0aDueAt" | "r0bDueAt"> {
  return { r0aDueAt: severity === "critical" ? createdAt : null, r0bDueAt: null };
}

/** On confirm / reissue. The dispatch notice for a critical case goes out at night too. */
export function caioAttentionDispatchFields(severity: CaioAttentionSeverity, dispatchedAt: Date, p: CaioAttentionPolicy) {
  return {
    dispatchNoticeAt: severity === "critical" ? dispatchedAt : clampToCaioAttentionDaytime(dispatchedAt, p),
    noResponseDueAt: severity === "critical" ? plus(dispatchedAt, p.noResponseMinutes) : null,
    r1FiredAt: null,
    unresolvedEscalateAt: caioAttentionUnresolvedEscalateAt(severity, dispatchedAt, p),
    r2FiredSeverity: null,
    nextPeriodicAt: nextCaioAttentionPeriodicAt(severity, dispatchedAt, p),
  };
}

const rearmPending = (at: Date): Partial<CaioAttentionReminderFields> =>
  ({ r0aDueAt: at, r0aSentAt: null, r0bDueAt: null, r0bSentAt: null });

/**
 * Warning -> critical. `committedDueAt` and the owner command are untouched. Idempotent: a case that is
 * already critical gets no change. Pending (SUGGESTED) or deferred cases notify the OWNER at once.
 * While working, R1 restarts from the raise if the primary has not responded and is dropped if they have.
 */
export function caioAttentionSeverityRaiseFields(
  status: CaioAttentionStatus, effectiveSeverity: CaioAttentionSeverity, fields: CaioAttentionReminderFields,
  respondedAt: Date | null, raisedAt: Date, p: CaioAttentionPolicy,
): Partial<CaioAttentionReminderFields> {
  if (effectiveSeverity === "critical") return {};
  if (status === "SUGGESTED" || status === "DEFERRED") return rearmPending(raisedAt);
  if (status !== "DISPATCHED" && status !== "DISPOSITION_SUBMITTED") return {};
  return {
    noResponseDueAt: respondedAt ? null : plus(raisedAt, p.noResponseMinutes),
    unresolvedEscalateAt: earlier(fields.unresolvedEscalateAt, caioAttentionCriticalDueAt(raisedAt, p)),
    nextPeriodicAt: clampToCaioAttentionDaytime(earlier(fields.nextPeriodicAt, raisedAt), p),
  };
}

/** deferredUntil reached, back to SUGGESTED: a critical case starts R0a / R0b again; warnings use the digest. */
export function caioAttentionResumeDeferredFields(severity: CaioAttentionSeverity, resumedAt: Date): Partial<CaioAttentionReminderFields> {
  return severity === "critical" ? rearmPending(resumedAt) : {};
}

export type CaioAttentionReminderCase = Readonly<{
  caseId: string; status: CaioAttentionStatus; effectiveSeverity: CaioAttentionSeverity; commandVersion: number;
  respondedAt: Date | null; ownerUserIds: readonly string[]; primaryUserId: string | null;
  escalationUserId: string | null; reviewerUserIds: readonly string[];
}>;

export type CaioAttentionReminderRule = "R1" | "R2" | "R0a" | "R0b" | "R4";
export type CaioAttentionReminderSend = { rule: CaioAttentionReminderRule; notifications: { userId: string; dedupeKey: string }[] };

const working = (s: CaioAttentionStatus) => s === "DISPATCHED" || s === "DISPOSITION_SUBMITTED";

/**
 * Everything due for one case in one locked pass, in the order R1 -> R2 -> R0 -> R4, plus the field
 * updates to write in the same transaction. R3 (recurrence) is event-driven and gated separately.
 */
export function collectDueCaioAttentionReminders(
  c: CaioAttentionReminderCase, f: CaioAttentionReminderFields, now: Date, p: CaioAttentionPolicy,
): { sends: CaioAttentionReminderSend[]; updates: Partial<CaioAttentionReminderFields> } {
  const sends: CaioAttentionReminderSend[] = [];
  const updates: Partial<CaioAttentionReminderFields> = {};
  const due = (at: Date | null): at is Date => at !== null && at.getTime() <= now.getTime();
  const daytime = isWithinCaioAttentionSendWindow(now, p);
  const send = (rule: CaioAttentionReminderRule, recipients: (string | null)[], key: (userId: string) => string) => {
    const ids = [...new Set(recipients.filter((id): id is string => Boolean(id)))];
    sends.push({ rule, notifications: ids.map((userId) => ({ userId, dedupeKey: key(userId) })) });
  };
  const base = `ca:${c.caseId}`;
  const v = `v${c.commandVersion}`;

  if (c.status === "DISPATCHED" && !c.respondedAt && !f.r1FiredAt && due(f.noResponseDueAt)) {
    send("R1", [c.escalationUserId, c.primaryUserId], (u) => `${base}:R1:${v}:${u}`);
    updates.r1FiredAt = now;
  }
  if (working(c.status) && f.r2FiredSeverity !== c.effectiveSeverity && due(f.unresolvedEscalateAt)
    && (c.effectiveSeverity === "critical" || daytime)) {
    send("R2", [c.escalationUserId], (u) => `${base}:R2:${v}:${c.effectiveSeverity}:${u}`);
    updates.r2FiredSeverity = c.effectiveSeverity;
  }
  // R0 only. A deferred case gets the single OWNER notice (R0a) but no repeat until it resumes.
  const pending = c.status === "SUGGESTED" || c.status === "DEFERRED";
  if (pending && c.effectiveSeverity === "critical") {
    if (!f.r0aSentAt && due(f.r0aDueAt)) {
      const slot = f.r0aDueAt.toISOString(); // re-armed after resume, so the key carries the due time
      send("R0a", [...c.ownerUserIds], (u) => `${base}:R0a:${u}:${slot}`);
      updates.r0aSentAt = now;
      updates.r0bDueAt = plus(now, p.pendingRepeatMinutes);
    } else if (c.status === "SUGGESTED" && f.r0aSentAt && !f.r0bSentAt && due(f.r0bDueAt)) {
      const slot = f.r0bDueAt.toISOString();
      send("R0b", [...c.ownerUserIds], (u) => `${base}:R0b:${u}:${slot}`);
      updates.r0bSentAt = now;
    }
  }
  if (working(c.status) && daytime && due(f.nextPeriodicAt)) {
    const recipients = [c.primaryUserId, ...(c.status === "DISPOSITION_SUBMITTED" ? c.reviewerUserIds : [])];
    const slot = f.nextPeriodicAt.toISOString();
    send("R4", recipients, (u) => `${base}:R4:${v}:${c.status}:${u}:${slot}`);
    updates.nextPeriodicAt = nextCaioAttentionPeriodicAt(c.effectiveSeverity, now, p);
  }
  return { sends, updates };
}

/** R3 recurrence notices: working statuses only, daytime only. */
export function isCaioAttentionRecurrenceSendable(status: CaioAttentionStatus, now: Date, p: CaioAttentionPolicy): boolean {
  return working(status) && isWithinCaioAttentionSendWindow(now, p);
}

/** R0w warning digest: one per OWNER per local date, from the digest minute, daytime only. */
export function caioAttentionWarningDigest(workspaceId: string, ownerUserId: string, now: Date, p: CaioAttentionPolicy) {
  const { start, offsetMs } = localDay(now, p);
  const date = new Date(start + p.utcOffsetMinutes * MIN).toISOString().slice(0, 10);
  const due = offsetMs >= p.warningDigestMinute * MIN && isWithinCaioAttentionSendWindow(now, p);
  return { due, dedupeKey: `ca-digest:${workspaceId}:${ownerUserId}:${date}` };
}
