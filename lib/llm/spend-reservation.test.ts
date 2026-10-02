import { describe, expect, it, vi } from "vitest";

import {
  recoverExpiredReservations,
  reserveSpend,
  settleReservation,
  type SpendBudgetPolicy,
  type SpendReservationStore,
  type ReserveSpendRecord,
} from "@/lib/llm/spend-reservation";

/** Contract model only: synchronous map commits simulate one atomic reserve.
 * This is deliberately not evidence that a database store has been implemented. */
function createStore(initial?: Partial<{ reserved: bigint; settled: bigint }>) {
  const counters = new Map<
    string,
    { reservedMicros: bigint; settledMicros: bigint; unknownBoundMicros: bigint; unknownCalls: number; periodPolicyVersion: string }
  >();
  const entries = new Map<
    string,
    ReserveSpendRecord & { state: string }
  >();
  const counterKey = (workspaceId: string, periodKey: string) => `${workspaceId}:${periodKey}`;
  const entryKey = (workspaceId: string, attemptRef: string) => `${workspaceId}:${attemptRef}`;

  const store: SpendReservationStore & { counters: typeof counters; entries: typeof entries } = {
    counters,
    entries,
    async reserve(input) {
      const { workspaceId, periodKey, reservedMicros: amountMicros, budgetMicros } = input;
      const attemptKey = entryKey(workspaceId, input.attemptRef);
      const existing = entries.get(attemptKey);
      if (existing) {
        const fields = ["periodKey", "periodPolicyVersion", "reservedMicros", "provider", "model"] as const;
        return fields.every((key) => existing[key] === input[key]) ? "duplicate" : "conflict";
      }
      const key = counterKey(workspaceId, periodKey);
      const row = counters.get(key) ?? {
        reservedMicros: initial?.reserved ?? BigInt(0),
        settledMicros: initial?.settled ?? BigInt(0),
        unknownBoundMicros: BigInt(0),
        unknownCalls: 0,
        periodPolicyVersion: input.periodPolicyVersion,
      };
      if (row.periodPolicyVersion !== input.periodPolicyVersion) return "period_policy_conflict";
      if (budgetMicros !== null && row.reservedMicros + row.settledMicros + row.unknownBoundMicros + amountMicros > budgetMicros) {
        return "budget_exhausted";
      }
      // No await between these writes: one simulated commit, not two service calls.
      counters.set(key, { ...row, reservedMicros: row.reservedMicros + amountMicros });
      entries.set(attemptKey, { ...input, state: "reserved" });
      return "reserved";
    },
    async settle({ workspaceId, attemptRef, settledMicros }) {
      const entry = entries.get(entryKey(workspaceId, attemptRef));
      if (!entry || entry.state !== "reserved") return "not_reserved";
      const counter = counters.get(counterKey(workspaceId, entry.periodKey))!;
      counters.set(counterKey(workspaceId, entry.periodKey), {
        ...counter,
        reservedMicros: counter.reservedMicros - entry.reservedMicros,
        settledMicros: counter.settledMicros + settledMicros,
      });
      entry.state = "settled";
      return "settled";
    },
    async markUnknown({ workspaceId, attemptRef }) {
      const entry = entries.get(entryKey(workspaceId, attemptRef));
      if (!entry || entry.state !== "reserved") return "not_reserved";
      const counter = counters.get(counterKey(workspaceId, entry.periodKey))!;
      counters.set(counterKey(workspaceId, entry.periodKey), {
        ...counter,
        reservedMicros: counter.reservedMicros - entry.reservedMicros,
        unknownBoundMicros: counter.unknownBoundMicros + entry.reservedMicros,
        unknownCalls: counter.unknownCalls + 1,
      });
      entry.state = "unknown";
      return "unknown";
    },
    async release({ workspaceId, attemptRef }) {
      const entry = entries.get(entryKey(workspaceId, attemptRef));
      if (!entry || entry.state !== "reserved") return "not_reserved";
      const counter = counters.get(counterKey(workspaceId, entry.periodKey))!;
      counters.set(counterKey(workspaceId, entry.periodKey), {
        ...counter,
        reservedMicros: counter.reservedMicros - entry.reservedMicros,
      });
      entry.state = "released";
      return "released";
    },
    async readTotals({ workspaceId, periodKey }) {
      return (
        counters.get(counterKey(workspaceId, periodKey)) ?? {
          reservedMicros: BigInt(0),
          settledMicros: BigInt(0),
          unknownBoundMicros: BigInt(0),
          unknownCalls: 0,
        }
      );
    },
    async listExpiredReservations({ now, limit }) {
      return [...entries.entries()]
        .filter(([, entry]) => entry.state === "reserved" && entry.expiresAt <= now)
        .slice(0, limit)
        .map(([key, entry]) => ({ workspaceId: entry.workspaceId, attemptRef: key.split(":")[1]! }));
    },
  };
  return store;
}

const NOW = new Date("2026-09-17T10:00:00.000Z");
const LIMITED: SpendBudgetPolicy = { mode: "limited", budgetMicros: BigInt(1_000) };

function reserve(store: SpendReservationStore, attemptRef: string, estimatedMicros: bigint, policy = LIMITED) {
  return reserveSpend({
    store,
    policy,
    workspaceId: "ws",
    periodKey: "2026-09",
    periodPolicyVersion: "asia-shanghai-month.v1",
    attemptRef,
    estimatedMicros,
    provider: "openai",
    model: "gpt-4.1-mini",
    leaseMs: 60_000,
    now: NOW,
  });
}

describe("reserveSpend", () => {
  it("admits within the ceiling and holds the amount as reserved", async () => {
    const store = createStore();
    const outcome = await reserve(store, "attempt-1", BigInt(400));

    expect(outcome).toEqual({ admitted: true, attemptRef: "attempt-1", reservedMicros: BigInt(400) });
    expect(await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).toMatchObject({
      reservedMicros: BigInt(400),
      settledMicros: BigInt(0),
    });
  });

  it("refuses the reservation that would cross the ceiling — the check now has a write behind it", async () => {
    const store = createStore();
    expect((await reserve(store, "a", BigInt(600))).admitted).toBe(true);
    const second = await reserve(store, "b", BigInt(500));

    expect(second).toEqual({ admitted: false, reason: "budget_exhausted" });
    // The refused attempt took nothing.
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(600));
  });

  it("admits exactly one winner for the last unit of budget under concurrency", async () => {
    const store = createStore();
    // Eight callers race for a ceiling that fits two. The old pure-read check
    // admitted all eight: nothing was written between the read and the call.
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, (_, i) => reserve(store, `attempt-${i}`, BigInt(500))),
    );

    expect(outcomes.filter((row) => row.admitted)).toHaveLength(2);
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(1_000));
  });

  it("refuses a duplicate without mutating the original reservation", async () => {
    const store = createStore();
    expect((await reserve(store, "attempt-1", BigInt(400))).admitted).toBe(true);
    const retry = await reserve(store, "attempt-1", BigInt(400));

    expect(retry).toEqual({ admitted: false, reason: "attempt_already_reserved" });
    // Neither the original reservation nor its counter is modified by a retry.
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(400));
  });

  it("refuses when no policy is declared — absence is never read as unlimited", async () => {
    const store = createStore();
    const outcome = await reserve(store, "attempt-1", BigInt(400), { mode: "unconfigured" });

    expect(outcome).toEqual({ admitted: false, reason: "budget_unconfigured" });
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(0));
  });

  it("admits without a ceiling under unlimited, but still records the reservation", async () => {
    const store = createStore();
    const outcome = await reserve(store, "attempt-1", BigInt(10_000_000), { mode: "unlimited" });

    expect(outcome.admitted).toBe(true);
    // unlimited is not "untracked": the amount is still visible.
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(10_000_000));
  });

  it("treats a negative estimate as zero rather than crediting budget", async () => {
    const store = createStore();
    const outcome = await reserve(store, "attempt-1", -BigInt(500));

    expect(outcome).toEqual({ admitted: true, attemptRef: "attempt-1", reservedMicros: BigInt(0) });
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(0));
  });

  it("counts already-settled spend against the ceiling, not just live reservations", async () => {
    const store = createStore({ settled: BigInt(900) });
    const outcome = await reserve(store, "attempt-1", BigInt(200));
    expect(outcome).toEqual({ admitted: false, reason: "budget_exhausted" });
  });
});

describe("reservation integrity regressions", () => {
  it("admits one owner for concurrent identical attempts and preserves its settlement", async () => {
    const store = createStore();
    const results = await Promise.all(Array.from({ length: 8 }, () => reserve(store, "same", BigInt(400))));
    expect(results.filter((r) => r.admitted)).toHaveLength(1);
    expect(store.entries.size).toBe(1);
    expect(await settleReservation({ store, workspaceId: "ws", attemptRef: "same", usage: { kind: "known", measuredMicros: BigInt(300) } })).toBe("settled");
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(0));
  });

  it.each(["known", "unknown", "not_consumed"] as const)("does not resurrect or credit a terminal %s attempt", async (kind) => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    await settleReservation({ store, workspaceId: "ws", attemptRef: "a", usage: kind === "known" ? { kind, measuredMicros: BigInt(400) } : { kind } });
    const before = { ...(await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })) };
    const entry = { ...store.entries.get("ws:a") };
    expect(await reserve(store, "a", BigInt(400))).toEqual({ admitted: false, reason: "attempt_already_reserved" });
    expect(await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).toEqual(before);
    expect(store.entries.get("ws:a")).toEqual(entry);
  });

  it.each([
    { periodKey: "2026-10" }, { periodPolicyVersion: "utc-month.v2" },
    { reservedMicros: BigInt(300) }, { provider: "other" }, { model: "other" },
  ])("refuses changed identity on the same attempt: %s", async (change) => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    const original = store.entries.get("ws:a")!;
    expect(await store.reserve({ ...original, ...change })).toBe("conflict");
    expect(store.entries.get("ws:a")).toEqual(original);
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(400));
    expect(await reserve(store, "a", BigInt(300))).toEqual({ admitted: false, reason: "attempt_conflict" });
  });

  it("detects duplicates before ceiling exhaustion and keeps their original lease", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(1000));
    expect(await reserve(store, "a", BigInt(1000))).toEqual({ admitted: false, reason: "attempt_already_reserved" });
    const original = store.entries.get("ws:a")!;
    expect(await store.reserve({ ...original, expiresAt: new Date(NOW.getTime() + 120_000), budgetMicros: BigInt(1) })).toBe("duplicate");
    expect(store.entries.get("ws:a")?.expiresAt).toEqual(original.expiresAt);
  });

  it("rejects period policy drift for a new attempt without changing either record", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    expect(await store.reserve({ ...store.entries.get("ws:a")!, attemptRef: "b", periodPolicyVersion: "changed" })).toBe("period_policy_conflict");
    expect(store.entries.size).toBe(1);
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(400));
  });

  it("propagates an atomic store failure without releasing any attempt", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    const release = vi.spyOn(store, "release");
    vi.spyOn(store, "reserve").mockRejectedValueOnce(new Error("transaction failed or commit unconfirmed"));
    await expect(reserve(store, "a", BigInt(400))).rejects.toThrow("transaction failed or commit unconfirmed");
    expect(release).not.toHaveBeenCalled();
    expect(store.entries.get("ws:a")?.state).toBe("reserved");
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(400));
  });

  it("keeps the original reservation settleable after repeated duplicates", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    await reserve(store, "a", BigInt(400));
    await reserve(store, "a", BigInt(400));
    expect(store.entries.get("ws:a")?.state).toBe("reserved");
    expect(await settleReservation({ store, workspaceId: "ws", attemptRef: "a", usage: { kind: "known", measuredMicros: BigInt(300) } })).toBe("settled");
    expect(await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).toMatchObject({ reservedMicros: BigInt(0), settledMicros: BigInt(300) });
  });

  it("continues counting unknown consumption when admitting another call", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(800));
    await settleReservation({ store, workspaceId: "ws", attemptRef: "a", usage: { kind: "unknown" } });
    expect(await reserve(store, "b", BigInt(300))).toEqual({ admitted: false, reason: "budget_exhausted" });
  });
});

describe("settleReservation", () => {
  it("known usage moves the reservation to settled at the measured amount", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));

    const outcome = await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "known", measuredMicros: BigInt(250) },
    });

    expect(outcome).toBe("settled");
    expect(await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).toMatchObject({
      reservedMicros: BigInt(0),
      settledMicros: BigInt(250),
    });
  });

  it("unknown usage keeps the reservation as a bound — it is NOT released", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));

    const outcome = await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "unknown" },
    });

    expect(outcome).toBe("unknown");
    const totals = await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" });
    // Releasing here would give budget back for money that may well have been
    // spent — the one direction that stops a ceiling being a ceiling.
    expect(totals).toMatchObject({
      reservedMicros: BigInt(0),
      settledMicros: BigInt(0),
      unknownBoundMicros: BigInt(400),
      unknownCalls: 1,
    });
  });

  it("not_consumed releases the reservation — the provider was never contacted", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));

    const outcome = await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "not_consumed" },
    });

    expect(outcome).toBe("released");
    expect(await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).toMatchObject({
      reservedMicros: BigInt(0),
      settledMicros: BigInt(0),
      unknownBoundMicros: BigInt(0),
    });
  });

  it("settling twice does not double-count", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));
    await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "known", measuredMicros: BigInt(250) },
    });

    const second = await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "known", measuredMicros: BigInt(250) },
    });

    expect(second).toBe("not_reserved");
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).settledMicros).toBe(BigInt(250));
  });

  it("clamps a negative measurement to zero instead of crediting budget", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));
    await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "known", measuredMicros: -BigInt(100) },
    });
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).settledMicros).toBe(BigInt(0));
  });
});

describe("recoverExpiredReservations", () => {
  it("converts an expired reservation to unknown, not to released", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));

    const result = await recoverExpiredReservations({
      store,
      now: new Date(NOW.getTime() + 120_000),
      limit: 10,
    });

    expect(result).toEqual({ converted: 1, scanned: 1 });
    const totals = await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" });
    // A reservation expires because we lost track of the call, not because we
    // learned it was free.
    expect(totals).toMatchObject({ reservedMicros: BigInt(0), unknownBoundMicros: BigInt(400), unknownCalls: 1 });
  });

  it("leaves a live reservation alone", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));

    const result = await recoverExpiredReservations({ store, now: NOW, limit: 10 });

    expect(result).toEqual({ converted: 0, scanned: 0 });
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(400));
  });

  it("reports scanned separately so 'nothing expired' differs from 'the sweep did not run'", async () => {
    const store = createStore();
    const result = await recoverExpiredReservations({ store, now: NOW, limit: 10 });
    expect(result).toEqual({ converted: 0, scanned: 0 });
  });
});
