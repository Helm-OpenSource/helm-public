import { describe, expect, it } from "vitest";

import {
  recoverExpiredReservations,
  reserveSpend,
  settleReservation,
  type SpendBudgetPolicy,
  type SpendReservationStore,
} from "@/lib/llm/spend-reservation";

/**
 * In-memory store that reproduces the store port's ATOMICITY, not just its
 * shape: `tryAdvanceReserved` refuses when the ceiling would be exceeded, and
 * `insertReservation` refuses a duplicate attemptRef. A double that always
 * succeeds would let every test below pass against a broken service.
 */
function createStore(initial?: Partial<{ reserved: bigint; settled: bigint }>) {
  const counters = new Map<
    string,
    { reservedMicros: bigint; settledMicros: bigint; unknownBoundMicros: bigint; unknownCalls: number }
  >();
  const entries = new Map<
    string,
    { workspaceId: string; periodKey: string; reservedMicros: bigint; state: string; expiresAt: Date }
  >();
  const counterKey = (workspaceId: string, periodKey: string) => `${workspaceId}:${periodKey}`;
  const entryKey = (workspaceId: string, attemptRef: string) => `${workspaceId}:${attemptRef}`;

  const store: SpendReservationStore & { counters: typeof counters; entries: typeof entries } = {
    counters,
    entries,
    async tryAdvanceReserved({ workspaceId, periodKey, amountMicros, budgetMicros }) {
      const key = counterKey(workspaceId, periodKey);
      const row =
        counters.get(key) ??
        {
          reservedMicros: initial?.reserved ?? BigInt(0),
          settledMicros: initial?.settled ?? BigInt(0),
          unknownBoundMicros: BigInt(0),
          unknownCalls: 0,
        };
      if (budgetMicros !== null && row.reservedMicros + row.settledMicros + amountMicros > budgetMicros) {
        counters.set(key, row);
        return false;
      }
      counters.set(key, { ...row, reservedMicros: row.reservedMicros + amountMicros });
      return true;
    },
    async insertReservation(input) {
      const key = entryKey(input.workspaceId, input.attemptRef);
      if (entries.has(key)) return "duplicate";
      entries.set(key, {
        workspaceId: input.workspaceId,
        periodKey: input.periodKey,
        reservedMicros: input.reservedMicros,
        state: "reserved",
        expiresAt: input.expiresAt,
      });
      return "inserted";
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

  it("refuses a retry of the same attempt and gives back what the retry took", async () => {
    const store = createStore();
    expect((await reserve(store, "attempt-1", BigInt(400))).admitted).toBe(true);
    const retry = await reserve(store, "attempt-1", BigInt(400));

    expect(retry).toEqual({ admitted: false, reason: "attempt_already_reserved" });
    // Without the release, each retry would leak one estimate into the period
    // total and never come back down.
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
