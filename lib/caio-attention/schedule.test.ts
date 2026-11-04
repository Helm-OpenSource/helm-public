import { describe, expect, it } from "vitest";

import {
  CAIO_ATTENTION_TEST_DEFAULT_POLICY as P,
  caioAttentionDispatchFields,
  caioAttentionResumeDeferredFields,
  caioAttentionSeverityRaiseFields,
  caioAttentionSuggestFields,
  caioAttentionUnresolvedEscalateAt,
  caioAttentionWarningDigest,
  clampToCaioAttentionDaytime,
  collectDueCaioAttentionReminders,
  isCaioAttentionRecurrenceSendable,
  parseCaioAttentionPolicy,
  suggestCaioAttentionCommittedDueAt,
  type CaioAttentionReminderCase,
  type CaioAttentionReminderFields,
} from "./schedule";

// Wall-clock helper for the +08:00 test policy: "D HH:MM" on 2026-01-0D local.
const t = (local: string) => {
  const [day, hm] = local.split(" ");
  return new Date(`2026-01-0${day}T${hm}:00.000+08:00`);
};
const emptyFields: CaioAttentionReminderFields = {
  r0aDueAt: null, r0aSentAt: null, r0bDueAt: null, r0bSentAt: null, noResponseDueAt: null, r1FiredAt: null,
  unresolvedEscalateAt: null, r2FiredSeverity: null, nextPeriodicAt: null,
};
const kase = (overrides: Partial<CaioAttentionReminderCase> = {}): CaioAttentionReminderCase => ({
  caseId: "c1", status: "DISPATCHED", effectiveSeverity: "critical", commandVersion: 1, respondedAt: null,
  ownerUserIds: ["u_owner"], primaryUserId: "u_primary", escalationUserId: "u_escalation", reviewerUserIds: ["u_reviewer"], ...overrides,
});

/** Runs the scanner every 5 minutes over [from, to], applying updates like the locked transaction would. */
function simulate(c: CaioAttentionReminderCase, fields: CaioAttentionReminderFields, from: Date, to: Date) {
  const log: { at: string; rule: string; users: string[] }[] = [];
  let f = { ...fields };
  for (let at = from.getTime(); at <= to.getTime(); at += 5 * 60_000) {
    const { sends, updates } = collectDueCaioAttentionReminders(c, f, new Date(at), P);
    for (const s of sends) log.push({ at: new Date(at).toISOString(), rule: s.rule, users: s.notifications.map((n) => n.userId) });
    f = { ...f, ...updates };
  }
  return log;
}
const iso = (local: string) => t(local).toISOString();

describe("policy and window", () => {
  it("validates the policy shape", () => {
    expect(parseCaioAttentionPolicy(P).ok).toBe(true);
    expect(parseCaioAttentionPolicy({ ...P, daytimeStartMinute: 1300 })).toEqual({ ok: false, errorCode: "policy_invalid" });
    expect(parseCaioAttentionPolicy({ ...P, extra: 1 }).ok).toBe(false);
    for (const key of ["criticalSameDayDueMinute", "criticalNextDayDueMinute", "warningPeriodicMinute", "warningDigestMinute"]) {
      expect(parseCaioAttentionPolicy({ ...P, [key]: 21 * 60 }).ok, key).toBe(false);
    }
  });

  it("is inclusive at 08:00 and 20:00 and moves night times to the next 08:00", () => {
    expect(clampToCaioAttentionDaytime(t("5 08:00"), P)).toEqual(t("5 08:00"));
    expect(clampToCaioAttentionDaytime(t("5 20:00"), P)).toEqual(t("5 20:00"));
    expect(clampToCaioAttentionDaytime(t("5 20:01"), P)).toEqual(t("6 08:00"));
    expect(clampToCaioAttentionDaytime(t("6 02:00"), P)).toEqual(t("6 08:00"));
  });

  it("uses the policy offset, not the host time zone", () => {
    const utc = { ...P, utcOffsetMinutes: 0 };
    expect(clampToCaioAttentionDaytime(new Date("2026-01-05T21:00:00Z"), utc)).toEqual(new Date("2026-01-06T08:00:00Z"));
    expect(caioAttentionUnresolvedEscalateAt("critical", new Date("2026-01-05T17:59:00Z"), utc)).toEqual(new Date("2026-01-05T20:00:00Z"));
  });
});

describe("deadlines", () => {
  it("T-N13: critical dispatched before 18:00 escalates at 20:00; at or after 18:00, next day 12:00", () => {
    expect(caioAttentionUnresolvedEscalateAt("critical", t("5 17:59"), P)).toEqual(t("5 20:00"));
    expect(caioAttentionUnresolvedEscalateAt("critical", t("5 18:00"), P)).toEqual(t("6 12:00"));
    expect(caioAttentionUnresolvedEscalateAt("critical", t("6 02:00"), P)).toEqual(t("6 20:00"));
  });

  it("crosses month and year boundaries", () => {
    const at = (s: string) => new Date(`${s}+08:00`);
    expect(caioAttentionUnresolvedEscalateAt("critical", at("2026-01-31T23:00:00"), P)).toEqual(at("2026-02-01T12:00:00"));
    expect(caioAttentionUnresolvedEscalateAt("critical", at("2026-12-31T18:00:00"), P)).toEqual(at("2027-01-01T12:00:00"));
    expect(caioAttentionUnresolvedEscalateAt("warning", at("2026-12-30T21:00:00"), P)).toEqual(at("2027-01-03T08:00:00"));
    expect(clampToCaioAttentionDaytime(at("2026-02-28T22:00:00"), P)).toEqual(at("2026-03-01T08:00:00"));
  });

  it("T-N25: warning escalates after 72 hours, daytime only", () => {
    expect(caioAttentionUnresolvedEscalateAt("warning", t("5 10:00"), P)).toEqual(t("8 10:00"));
    expect(caioAttentionUnresolvedEscalateAt("warning", t("5 21:00"), P)).toEqual(t("9 08:00"));
  });

  it("suggests a handling deadline the OWNER may change, or none when the rule requires the OWNER", () => {
    expect(suggestCaioAttentionCommittedDueAt("critical", t("5 18:30"), "suggest", P)).toEqual(t("6 12:00"));
    expect(suggestCaioAttentionCommittedDueAt("warning", t("5 21:00"), "suggest", P)).toEqual(t("8 21:00"));
    expect(suggestCaioAttentionCommittedDueAt("critical", t("5 10:00"), "owner_required", P)).toBeNull();
  });
});

describe("reminder pass", () => {
  it("v5 example: 19:00 critical dispatch; R4 moves to 08:00 then 10:00, R1 fires at 21:00, R2 next day 12:00", () => {
    const dispatch = caioAttentionDispatchFields("critical", t("5 19:00"), P);
    expect(dispatch).toMatchObject({ dispatchNoticeAt: t("5 19:00"), noResponseDueAt: t("5 21:00"), unresolvedEscalateAt: t("6 12:00"), nextPeriodicAt: t("6 08:00") });
    const log = simulate(kase(), { ...emptyFields, ...dispatch }, t("5 19:00"), t("6 12:00"));
    expect(log).toEqual([
      { at: iso("5 21:00"), rule: "R1", users: ["u_escalation", "u_primary"] },
      { at: iso("6 08:00"), rule: "R4", users: ["u_primary"] },
      { at: iso("6 10:00"), rule: "R4", users: ["u_primary"] },
      { at: iso("6 12:00"), rule: "R2", users: ["u_escalation"] },
      { at: iso("6 12:00"), rule: "R4", users: ["u_primary"] },
    ]);
  });

  it("T-N11/T-N18: after a night the 08:00 reminder is sent once and the next is 10:00, never 09:00", () => {
    const fields = { ...emptyFields, nextPeriodicAt: t("6 08:00") };
    const log = simulate(kase({ respondedAt: t("5 19:30") }), fields, t("5 20:05"), t("6 10:00"));
    expect(log.map((l) => l.at)).toEqual([iso("6 08:00"), iso("6 10:00")]);
  });

  it("T-N12: after submission the primary and the reviewer set are both reminded every 2 hours", () => {
    const log = simulate(kase({ status: "DISPOSITION_SUBMITTED", respondedAt: t("5 09:00") }), { ...emptyFields, nextPeriodicAt: t("5 10:00") }, t("5 10:00"), t("5 12:00"));
    expect(log).toEqual([
      { at: iso("5 10:00"), rule: "R4", users: ["u_primary", "u_reviewer"] },
      { at: iso("5 12:00"), rule: "R4", users: ["u_primary", "u_reviewer"] },
    ]);
  });

  it("T-N14/T-N19: R1 goes out at 02:00 while R4 waits; R1 and R4 due together both fire", () => {
    const night = simulate(kase(), { ...emptyFields, noResponseDueAt: t("6 02:00"), nextPeriodicAt: t("6 02:00") }, t("6 02:00"), t("6 02:00"));
    expect(night.map((l) => l.rule)).toEqual(["R1"]);
    const noon = collectDueCaioAttentionReminders(kase(), { ...emptyFields, ...caioAttentionDispatchFields("critical", t("5 10:00"), P) }, t("5 12:00"), P);
    expect(noon.sends.map((s) => s.rule)).toEqual(["R1", "R4"]);
    expect(noon.updates).toEqual({ r1FiredAt: t("5 12:00"), nextPeriodicAt: t("5 14:00") });
  });

  it("T-N20: R2 and R4 due at 20:00 both fire; T-N16 warning periodic is daily at 10:00", () => {
    const at20 = collectDueCaioAttentionReminders(kase({ respondedAt: t("5 10:00") }), { ...emptyFields, unresolvedEscalateAt: t("5 20:00"), nextPeriodicAt: t("5 20:00") }, t("5 20:00"), P);
    expect(at20.sends.map((s) => s.rule)).toEqual(["R2", "R4"]);
    const warning = caioAttentionDispatchFields("warning", t("5 11:00"), P);
    expect(warning).toMatchObject({ noResponseDueAt: null, nextPeriodicAt: t("6 10:00") });
    expect(simulate(kase({ effectiveSeverity: "warning" }), { ...emptyFields, ...warning }, t("5 11:00"), t("7 10:00")).map((l) => l.at))
      .toEqual([iso("6 10:00"), iso("7 10:00")]);
  });

  it("T-N7: R1 and R2 fire once per command version, also after submit and return", () => {
    const fields = { ...emptyFields, noResponseDueAt: t("5 12:00"), unresolvedEscalateAt: t("5 20:00") };
    const log = simulate(kase(), fields, t("5 12:00"), t("5 20:30"));
    expect(log.filter((l) => l.rule === "R1" || l.rule === "R2").map((l) => l.rule)).toEqual(["R1", "R2"]);
    const first = collectDueCaioAttentionReminders(kase(), fields, t("5 12:00"), P).sends[0].notifications[0].dedupeKey;
    expect(first).toBe("ca:c1:R1:v1:u_escalation");
  });

  it("T-N8: terminal cases get nothing; a deferred case gets only R0", () => {
    const everythingDue = { ...emptyFields, r0aDueAt: t("5 09:00"), noResponseDueAt: t("5 09:00"), unresolvedEscalateAt: t("5 09:00"), nextPeriodicAt: t("5 09:00") };
    for (const status of ["DISMISSED", "CANCELLED", "CLOSED"] as const) {
      expect(collectDueCaioAttentionReminders(kase({ status }), everythingDue, t("5 10:00"), P).sends).toEqual([]);
    }
    expect(collectDueCaioAttentionReminders(kase({ status: "DEFERRED" }), everythingDue, t("5 10:00"), P).sends.map((s) => s.rule)).toEqual(["R0a"]);
    expect(collectDueCaioAttentionReminders(kase({ status: "DEFERRED", effectiveSeverity: "warning" }), everythingDue, t("5 10:00"), P).sends).toEqual([]);
  });

  it("P2-1: a reminder due just before 20:00 still goes out on a 20:03 scan, not the next morning", () => {
    const late = collectDueCaioAttentionReminders(kase({ respondedAt: t("5 10:00") }), { ...emptyFields, nextPeriodicAt: t("5 19:58") }, t("5 20:03"), P);
    expect(late.sends.map((s) => s.rule)).toEqual(["R4"]);
    expect(late.updates.nextPeriodicAt).toEqual(t("6 08:00"));
    const warningR2 = collectDueCaioAttentionReminders(kase({ effectiveSeverity: "warning", respondedAt: t("5 10:00") }), { ...emptyFields, unresolvedEscalateAt: t("5 20:00") }, t("5 20:03"), P);
    expect(warningR2.sends.map((s) => s.rule)).toEqual(["R2"]);
    // Past the grace, daytime-only reminders wait for the next window.
    expect(collectDueCaioAttentionReminders(kase({ respondedAt: t("5 10:00") }), { ...emptyFields, nextPeriodicAt: t("5 19:58") }, t("5 20:11"), P).sends).toEqual([]);
  });

  it("T-N22a: critical suggested at 02:00 and not confirmed: R0a at 02:00, R0b once at 02:30, no dispatch notice", () => {
    const suggested = kase({ status: "SUGGESTED", commandVersion: 0 });
    const log = simulate(suggested, { ...emptyFields, ...caioAttentionSuggestFields("critical", t("6 02:00")) }, t("6 02:00"), t("6 06:00"));
    expect(log).toEqual([
      { at: iso("6 02:00"), rule: "R0a", users: ["u_owner"] },
      { at: iso("6 02:30"), rule: "R0b", users: ["u_owner"] },
    ]);
  });

  it("T-N22b: critical suggested and dispatched at 02:00: dispatch notice at 02:00, no pending-confirmation reminders", () => {
    const dispatch = caioAttentionDispatchFields("critical", t("6 02:00"), P);
    expect(dispatch.dispatchNoticeAt).toEqual(t("6 02:00"));
    // The suggestion's R0a was already sent before confirmation; R0b must not follow once dispatched.
    const fields = { ...emptyFields, r0aDueAt: t("6 02:00"), r0aSentAt: t("6 02:00"), r0bDueAt: t("6 02:30"), ...dispatch };
    const log = simulate(kase({ respondedAt: t("6 02:10") }), fields, t("6 02:00"), t("6 07:55"));
    expect(log.filter((l) => l.rule === "R0a" || l.rule === "R0b")).toEqual([]);
    expect(log).toEqual([]);
    expect(caioAttentionDispatchFields("warning", t("6 02:00"), P).dispatchNoticeAt).toEqual(t("6 08:00"));
  });

  it("R3 recurrence and the R0w digest are daytime only; the digest is once per local date", () => {
    expect(isCaioAttentionRecurrenceSendable("DISPATCHED", t("5 21:00"), P)).toBe(false);
    expect(isCaioAttentionRecurrenceSendable("SUGGESTED", t("5 10:00"), P)).toBe(false);
    expect(isCaioAttentionRecurrenceSendable("DISPOSITION_SUBMITTED", t("5 10:00"), P)).toBe(true);
    expect(caioAttentionWarningDigest("ws", "u_owner", t("6 09:29"), P).due).toBe(false);
    expect(caioAttentionWarningDigest("ws", "u_owner", t("6 09:30"), P)).toEqual({ due: true, dedupeKey: "ca-digest:ws:u_owner:2026-01-06" });
    expect(caioAttentionWarningDigest("ws", "u_owner", t("6 07:00"), P).dedupeKey).toBe("ca-digest:ws:u_owner:2026-01-06");
  });
});

describe("severity raise", () => {
  // Warning dispatched 5 09:00 whose first daily reminder (5 10:00) has already gone out.
  const warning = { ...emptyFields, ...caioAttentionDispatchFields("warning", t("5 09:00"), P), nextPeriodicAt: t("6 10:00") };

  it("T-N24/T-N17: unanswered raise restarts R1 from the raise and tightens R2 by the raise-time rule", () => {
    expect(caioAttentionSeverityRaiseFields("DISPATCHED", "warning", warning, null, t("5 17:59"), P))
      .toEqual({ noResponseDueAt: t("5 19:59"), unresolvedEscalateAt: t("5 20:00"), nextPeriodicAt: t("5 17:59") });
    expect(caioAttentionSeverityRaiseFields("DISPATCHED", "warning", warning, null, t("5 18:00"), P))
      .toMatchObject({ unresolvedEscalateAt: t("6 12:00") });
  });

  it("T-N23/T-N4: an already answered raise sets no R1; a later critical rule never loosens R2", () => {
    const raised = caioAttentionSeverityRaiseFields("DISPATCHED", "warning", { ...warning, nextPeriodicAt: t("8 10:00") }, t("5 09:30"), t("7 21:00"), P);
    expect(raised.noResponseDueAt).toBeNull();
    expect(raised.unresolvedEscalateAt).toEqual(warning.unresolvedEscalateAt); // 72h rule (8 09:00) is earlier than 8 12:00
    expect(raised.nextPeriodicAt).toEqual(t("8 08:00"));
    // R2 uses a new severity-qualified key, so the earlier warning R2 does not suppress the critical one.
    const after = collectDueCaioAttentionReminders(kase({ respondedAt: t("5 09:30") }), { ...warning, ...raised, r2FiredSeverity: "warning" }, t("8 09:00"), P);
    expect(after.sends.find((s) => s.rule === "R2")?.notifications[0].dedupeKey).toBe("ca:c1:R2:v1:critical:u_escalation");
  });

  it("a pending suggestion raised to critical notifies the OWNER at once and again 30 minutes later, night included", () => {
    const raised = caioAttentionSeverityRaiseFields("SUGGESTED", "warning", emptyFields, null, t("5 03:00"), P);
    expect(raised).toEqual({ r0aDueAt: t("5 03:00"), r0aSentAt: null, r0bDueAt: null, r0bSentAt: null });
    const log = simulate(kase({ status: "SUGGESTED", commandVersion: 0 }), { ...emptyFields, ...raised }, t("5 03:00"), t("5 06:00"));
    expect(log).toEqual([
      { at: iso("5 03:00"), rule: "R0a", users: ["u_owner"] },
      { at: iso("5 03:30"), rule: "R0b", users: ["u_owner"] },
    ]);
    expect(caioAttentionSeverityRaiseFields("CLOSED", "warning", warning, null, t("5 03:00"), P)).toEqual({});
  });

  it("P2-6: replaying a raise on a case that is already critical changes nothing", () => {
    for (const status of ["SUGGESTED", "DEFERRED", "DISPATCHED", "DISPOSITION_SUBMITTED"] as const) {
      expect(caioAttentionSeverityRaiseFields(status, "critical", warning, null, t("5 12:00"), P)).toEqual({});
    }
  });

  it("P1-1: a deferred case raised to critical notifies the OWNER once; resuming re-arms R0a and R0b", () => {
    const deferred = kase({ status: "DEFERRED", commandVersion: 0 });
    let fields = { ...emptyFields, ...caioAttentionSeverityRaiseFields("DEFERRED", "warning", emptyFields, null, t("5 03:00"), P) };
    const whileDeferred = simulate(deferred, fields, t("5 03:00"), t("5 08:55"));
    expect(whileDeferred).toEqual([{ at: iso("5 03:00"), rule: "R0a", users: ["u_owner"] }]);
    fields = { ...fields, r0aSentAt: t("5 03:00"), r0bDueAt: t("5 03:30"), ...caioAttentionResumeDeferredFields("critical", t("5 09:00")) };
    const suggested = kase({ status: "SUGGESTED", commandVersion: 0 });
    expect(simulate(suggested, fields, t("5 09:00"), t("5 11:00"))).toEqual([
      { at: iso("5 09:00"), rule: "R0a", users: ["u_owner"] },
      { at: iso("5 09:30"), rule: "R0b", users: ["u_owner"] },
    ]);
    // Each R0a carries its due time, so the re-armed notice is not swallowed by the first one's dedupe key.
    const keyAt = (at: Date) => collectDueCaioAttentionReminders(suggested, { ...emptyFields, r0aDueAt: at }, at, P).sends[0].notifications[0].dedupeKey;
    expect(keyAt(t("5 03:00"))).not.toBe(keyAt(t("5 09:00")));
    expect(keyAt(t("5 09:00"))).toBe(`ca:c1:R0a:${iso("5 09:00")}:u_owner`);
  });

  it("R0a/R0b dedupe keys: same arming gives the same key on retry, a new arming a new key", () => {
    const suggested = kase({ status: "SUGGESTED", commandVersion: 0 });
    const round = (armedAt: Date) => {
      const fields = { ...emptyFields, ...caioAttentionResumeDeferredFields("critical", armedAt) };
      const r0a = collectDueCaioAttentionReminders(suggested, fields, armedAt, P);
      const afterA = { ...fields, ...r0a.updates };
      const r0bAt = afterA.r0bDueAt!;
      const r0b = collectDueCaioAttentionReminders(suggested, afterA, r0bAt, P);
      return [r0a.sends[0].notifications[0].dedupeKey, r0b.sends[0].notifications[0].dedupeKey];
    };
    const first = round(t("5 03:00"));
    expect(round(t("5 03:00"))).toEqual(first); // a retried scan of the same arming dedupes
    expect(first).toEqual([`ca:c1:R0a:${iso("5 03:00")}:u_owner`, `ca:c1:R0b:${iso("5 03:30")}:u_owner`]);
    const second = round(t("5 09:00"));
    expect(second[0]).not.toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(caioAttentionResumeDeferredFields("warning", t("5 09:00"))).toEqual({});
  });
});
