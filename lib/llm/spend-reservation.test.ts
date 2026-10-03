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
    { reservedMicros: bigint; settledMicros: bigint; unknownBoundMicros: bigint; unknownCalls: number;
      invariantBreachBoundMicros: bigint; invariantBreachCalls: number; admissionState: "open" | "invariant_breach";
      periodPolicyVersion: string; budgetConfigVersion: number; budgetMode: "limited" | "unlimited";
      budgetLimitMicros: bigint | null; policyApprovalRef: string }
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
      const { workspaceId, periodKey, maximumChargeMicros: amountMicros, budgetLimitMicros } = input;
      const attemptKey = entryKey(workspaceId, input.attemptRef);
      const existing = entries.get(attemptKey);
      if (existing) {
        const fields = ["periodKey", "periodPolicyVersion", "budgetConfigVersion", "maximumChargeMicros",
          "provider", "model", "operationRef", "quoteRef", "quoteHash", "budgetCurrency", "providerCurrency",
          "priceBookRef", "priceBookVersion", "priceBookHash", "fxSnapshotRef", "fxSnapshotHash",
          "policyApprovalRef", "budgetMode", "budgetLimitMicros", "contractVersion", "provenanceState"] as const;
        return fields.every((key) => existing[key] === input[key]) ? "duplicate" : "conflict";
      }
      const key = counterKey(workspaceId, periodKey);
      const row = counters.get(key) ?? {
        reservedMicros: initial?.reserved ?? BigInt(0),
        settledMicros: initial?.settled ?? BigInt(0),
        unknownBoundMicros: BigInt(0),
        unknownCalls: 0,
        invariantBreachBoundMicros: BigInt(0),
        invariantBreachCalls: 0,
        admissionState: "open" as const,
        periodPolicyVersion: input.periodPolicyVersion,
        budgetConfigVersion: input.budgetConfigVersion,
        budgetMode: input.budgetMode,
        budgetLimitMicros: input.budgetLimitMicros,
        policyApprovalRef: input.policyApprovalRef,
      };
      if (row.admissionState === "invariant_breach") return "spend_invariant_breach";
      if (row.periodPolicyVersion !== input.periodPolicyVersion) return "period_policy_conflict";
      if (row.budgetConfigVersion !== input.budgetConfigVersion) return "budget_config_conflict";
      if (row.budgetMode !== input.budgetMode || row.budgetLimitMicros !== input.budgetLimitMicros ||
          row.policyApprovalRef !== input.policyApprovalRef) return "budget_config_conflict";
      if (budgetLimitMicros !== null && row.reservedMicros + row.settledMicros + row.unknownBoundMicros +
          row.invariantBreachBoundMicros + amountMicros > budgetLimitMicros) {
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
      if (settledMicros > entry.maximumChargeMicros) {
        counters.set(counterKey(workspaceId, entry.periodKey), {
          ...counter,
          reservedMicros: counter.reservedMicros - entry.maximumChargeMicros,
          invariantBreachBoundMicros: counter.invariantBreachBoundMicros + entry.maximumChargeMicros,
          invariantBreachCalls: counter.invariantBreachCalls + 1,
          admissionState: "invariant_breach",
        });
        entry.state = "invariant_breach";
        return "invariant_breach";
      }
      counters.set(counterKey(workspaceId, entry.periodKey), { ...counter,
        reservedMicros: counter.reservedMicros - entry.maximumChargeMicros,
        settledMicros: counter.settledMicros + settledMicros });
      entry.state = "settled";
      return "settled";
    },
    async markUnknown({ workspaceId, attemptRef }) {
      const entry = entries.get(entryKey(workspaceId, attemptRef));
      if (!entry || entry.state !== "reserved") return "not_reserved";
      const counter = counters.get(counterKey(workspaceId, entry.periodKey))!;
      counters.set(counterKey(workspaceId, entry.periodKey), {
        ...counter,
        reservedMicros: counter.reservedMicros - entry.maximumChargeMicros,
        unknownBoundMicros: counter.unknownBoundMicros + entry.maximumChargeMicros,
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
        reservedMicros: counter.reservedMicros - entry.maximumChargeMicros,
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
          invariantBreachBoundMicros: BigInt(0),
          invariantBreachCalls: 0,
          admissionState: "open" as const,
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
const LIMITED: SpendBudgetPolicy = { mode: "limited", budgetMicros: BigInt(1_000),
  configVersion: 7, approvalRef: "approval:synthetic" };

function quote(attemptRef: string, maximumChargeMicros: bigint) {
  return {
    contractVersion: 2 as const,
    operationRef: `operation:${attemptRef}`,
    quoteRef: `quote:${attemptRef}`,
    quoteHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    maximumChargeMicros,
    budgetCurrency: "USD" as const,
    providerCurrency: "USD" as const,
    priceBookRef: "price-book:approved",
    priceBookVersion: "2026-10-03",
    priceBookHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    fxSnapshotRef: null,
    fxSnapshotHash: null,
    policyApprovalRef: "approval:synthetic",
  };
}

function reserve(store: SpendReservationStore, attemptRef: string, maximumChargeMicros: bigint, policy = LIMITED) {
  return reserveSpend({
    store,
    policy,
    workspaceId: "ws",
    periodKey: "2026-09",
    periodPolicyVersion: "asia-shanghai-month.v1",
    attemptRef,
    quote: quote(attemptRef, maximumChargeMicros),
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

    expect(outcome).toEqual({ admitted: true, attemptRef: "attempt-1", maximumChargeMicros: BigInt(400) });
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
    const outcome = await reserve(store, "attempt-1", BigInt(10_000_000), {
      mode: "unlimited", configVersion: 7, approvalRef: "approval:synthetic",
    });

    expect(outcome.admitted).toBe(true);
    // unlimited is not "untracked": the amount is still visible.
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(10_000_000));
  });

  it("refuses a negative maximum charge without writing a zero reservation", async () => {
    const store = createStore();
    const outcome = await reserve(store, "attempt-1", -BigInt(500));

    expect(outcome).toEqual({ admitted: false, reason: "maximum_charge_invalid" });
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(0));
    expect(store.entries.size).toBe(0);
  });

  it("refuses a CNY quote without a complete immutable FX snapshot", async () => {
    const store = createStore();
    const invalid = { ...quote("cny-no-fx", BigInt(400)), providerCurrency: "CNY" as const };
    const outcome = await reserveSpend({
      store, policy: LIMITED, workspaceId: "ws", periodKey: "2026-09",
      periodPolicyVersion: "asia-shanghai-month.v1", attemptRef: "cny-no-fx", quote: invalid,
      provider: "synthetic-provider", model: "synthetic-model", leaseMs: 60_000, now: NOW,
    });

    expect(outcome).toEqual({ admitted: false, reason: "charge_quote_invalid" });
    expect(store.entries.size).toBe(0);
  });

  it("records a CNY quote only when a complete FX snapshot is present", async () => {
    const store = createStore();
    const valid = {
      ...quote("cny-with-fx", BigInt(400)), providerCurrency: "CNY" as const,
      fxSnapshotRef: "fx-snapshot:synthetic",
      fxSnapshotHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    };
    const outcome = await reserveSpend({
      store, policy: LIMITED, workspaceId: "ws", periodKey: "2026-09",
      periodPolicyVersion: "asia-shanghai-month.v1", attemptRef: "cny-with-fx", quote: valid,
      provider: "synthetic-provider", model: "synthetic-model", leaseMs: 60_000, now: NOW,
    });

    expect(outcome.admitted).toBe(true);
    expect(store.entries.get("ws:cny-with-fx")).toMatchObject({
      budgetCurrency: "USD", providerCurrency: "CNY",
      fxSnapshotRef: "fx-snapshot:synthetic", fxSnapshotHash: valid.fxSnapshotHash,
    });
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
    { maximumChargeMicros: BigInt(300) }, { provider: "other" }, { model: "other" },
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
    expect(await store.reserve({ ...original, expiresAt: new Date(NOW.getTime() + 120_000),
      budgetLimitMicros: BigInt(1) })).toBe("conflict");
    expect(store.entries.get("ws:a")?.expiresAt).toEqual(original.expiresAt);
  });

  it("rejects period policy drift for a new attempt without changing either record", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    expect(await store.reserve({ ...store.entries.get("ws:a")!, attemptRef: "b", periodPolicyVersion: "changed" })).toBe("period_policy_conflict");
    expect(store.entries.size).toBe(1);
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(400));
  });

  it("rejects a changed budget limit under the same config version", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    const original = store.entries.get("ws:a")!;
    expect(await store.reserve({ ...original, attemptRef: "b", operationRef: "operation:b",
      quoteRef: "quote:b", budgetLimitMicros: BigInt(10_000) })).toBe("budget_config_conflict");
    expect(store.entries.has("ws:b")).toBe(false);
  });

  it("treats quote, price, FX and policy provenance as immutable attempt identity", async () => {
    const store = createStore();
    await reserve(store, "a", BigInt(400));
    const original = store.entries.get("ws:a")!;
    const withProvenance = {
      ...original,
      quoteRef: "quote:a",
      quoteHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      priceBookRef: "price-book:approved",
      priceBookVersion: "2026-10-03",
      priceBookHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      fxSnapshotRef: null,
      fxSnapshotHash: null,
      policyApprovalRef: "approval:synthetic",
      budgetConfigVersion: 7,
      budgetCurrency: "USD",
      providerCurrency: "USD",
      operationRef: "operation:a",
      maximumChargeMicros: BigInt(400),
      contractVersion: 2,
      provenanceState: "complete",
    };
    store.entries.set("ws:a", { ...withProvenance, state: "reserved" } as never);

    expect(await store.reserve({ ...withProvenance, priceBookVersion: "changed" } as never)).toBe("conflict");
  });

  it("refuses a new attempt when the period counter budget config version changed", async () => {
    const store = createStore();
    const first = {
      ...store.entries.get("never"),
      workspaceId: "ws", periodKey: "2026-09", periodPolicyVersion: "asia-shanghai-month.v1",
      attemptRef: "a", maximumChargeMicros: BigInt(100),
      budgetMode: "limited", budgetLimitMicros: BigInt(1_000), budgetConfigVersion: 7,
      provider: "openai", model: "gpt-4.1-mini",
      expiresAt: new Date(NOW.getTime() + 60_000),
    } as never;
    expect(await store.reserve(first)).toBe("reserved");
    expect(await store.reserve({ ...first, attemptRef: "b", budgetConfigVersion: 8 } as never))
      .toBe("budget_config_conflict");
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

  it("turns a known amount above the maximum charge into a blocking invariant breach", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));

    const outcome = await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "known", measuredMicros: BigInt(401) },
    });

    expect(outcome).toBe("invariant_breach");
    expect(await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).toMatchObject({
      reservedMicros: BigInt(0),
      settledMicros: BigInt(0),
      invariantBreachBoundMicros: BigInt(400),
      invariantBreachCalls: 1,
      admissionState: "invariant_breach",
    });
    expect(await reserve(store, "attempt-2", BigInt(1))).toEqual({
      admitted: false,
      reason: "spend_invariant_breach",
    });
  });

  it("refuses a negative measurement and leaves the reservation intact", async () => {
    const store = createStore();
    await reserve(store, "attempt-1", BigInt(400));
    expect(await settleReservation({
      store,
      workspaceId: "ws",
      attemptRef: "attempt-1",
      usage: { kind: "known", measuredMicros: -BigInt(100) },
    })).toBe("measurement_invalid");
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).settledMicros).toBe(BigInt(0));
    expect((await store.readTotals({ workspaceId: "ws", periodKey: "2026-09" })).reservedMicros).toBe(BigInt(400));
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
