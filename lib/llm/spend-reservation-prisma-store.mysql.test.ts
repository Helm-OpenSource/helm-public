import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, statSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPrismaSpendReservationStore } from "./spend-reservation-prisma-store";
import { recoverExpiredReservations, settleReservation } from "./spend-reservation";

const configuredUrl = process.env.SPEND_RESERVATION_MYSQL_DATABASE_URL;
if (process.env.SPEND_RESERVATION_MYSQL_REQUIRED === "1" && !configuredUrl) {
  throw new Error("isolated_spend_reservation_database_required");
}

function assertIsolatedTarget(databaseUrl: string): URL {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.slice(1));
  const expected = process.env.SPEND_RESERVATION_MYSQL_EXPECTED_DATABASE;
  if (parsed.protocol !== "mysql:" || !expected || database !== expected || !parsed.username) {
    throw new Error("isolated_database_identity_invalid");
  }
  const socket = parsed.searchParams.get("socket");
  const container = process.env.SPEND_RESERVATION_MYSQL_CONTAINER;
  if (socket !== null) {
    if (!/^helm_llm_budget_[0-9]{8}$/u.test(database) ||
      !["localhost", "127.0.0.1"].includes(parsed.hostname) || !isAbsolute(socket) || !socket || container) {
      throw new Error("synthetic_socket_target_invalid");
    }
    const socketStat = lstatSync(socket);
    const parentStat = statSync(dirname(socket));
    if (!socketStat.isSocket() || socketStat.uid !== process.getuid?.() ||
      parentStat.uid !== process.getuid?.() || (parentStat.mode & 0o022) !== 0) {
      throw new Error("synthetic_socket_permissions_invalid");
    }
  } else if (database !== "helm_caio_p1d_ci" || parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "3306" || process.env.GITHUB_ACTIONS !== "true" ||
    !container || !/^[a-f0-9]{12,64}$/u.test(container)) {
    throw new Error("ephemeral_ci_target_invalid");
  }
  return parsed;
}

function mysqlDdl(sql: string): void {
  if (!configuredUrl) throw new Error("isolated_spend_reservation_database_required");
  const parsed = assertIsolatedTarget(configuredUrl);
  const socket = parsed.searchParams.get("socket");
  const password = decodeURIComponent(parsed.password);
  const mysqlArgs = socket
    ? ["--protocol=SOCKET", `--socket=${socket}`]
    : ["--protocol=tcp", "--host=127.0.0.1"];
  mysqlArgs.push(`--user=${decodeURIComponent(parsed.username)}`, decodeURIComponent(parsed.pathname.slice(1)));
  const container = process.env.SPEND_RESERVATION_MYSQL_CONTAINER;
  const result = container
    ? spawnSync("docker", ["exec", "-i", "-e", "MYSQL_PWD", container, "mysql", ...mysqlArgs], {
      input: sql, encoding: "utf8", env: { ...process.env, MYSQL_PWD: password },
    })
    : spawnSync("mysql", mysqlArgs, {
      input: sql, encoding: "utf8", env: { ...process.env, MYSQL_PWD: password },
    });
  if (result.status !== 0) throw new Error("isolated_mysql_ddl_failed");
}

describe.skipIf(!configuredUrl)("Prisma spend reservation in isolated MySQL", () => {
  // Vitest still evaluates a skipped describe callback. Return before any
  // client is constructed, so ordinary unit runs never attempt a DB connection.
  if (!configuredUrl) {
    it.skip("requires an explicit isolated MySQL target", () => {});
    return;
  }
  const url = configuredUrl;
  const a = new PrismaClient({ datasources: { db: { url } } });
  const b = new PrismaClient({ datasources: { db: { url } } });
  const storeA = createPrismaSpendReservationStore(a);
  const storeB = createPrismaSpendReservationStore(b);
  const workspaceId = `synthetic-${randomUUID()}`;
  const now = new Date("2026-10-03T04:00:00.000Z");
  let validatedTarget = false;

  const record = (attemptRef: string, reservedMicros = BigInt(400), periodKey = "2026-10") => ({
    workspaceId, periodKey, periodPolicyVersion: "shanghai-month.v1", attemptRef,
    reservedMicros, budgetMicros: BigInt(1_000), provider: "synthetic", model: "synthetic-model",
    expiresAt: new Date(now.getTime() + 60_000),
  });

  beforeAll(async () => {
    assertIsolatedTarget(url!);
    await Promise.all([a.$connect(), b.$connect()]);
    const tables = await a.$queryRaw<Array<{ name: string }>>`
      SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('LLMSpendLedgerEntry','LLMSpendPeriodCounter')`;
    if (tables.length !== 2) throw new Error("isolated_candidate_tables_required");
    validatedTarget = true;
  });
  afterAll(async () => {
    try {
      if (validatedTarget) {
        await a.lLMSpendLedgerEntry.deleteMany({ where: { workspaceId } });
        await a.lLMSpendPeriodCounter.deleteMany({ where: { workspaceId } });
      }
    } finally {
      await Promise.all([a.$disconnect(), b.$disconnect()]);
    }
  });

  it("admits at most the last two of eight distinct concurrent attempts across clients", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, n) =>
      (n % 2 ? storeA : storeB).reserve(record(`distinct-${n}`, BigInt(500), "2026-11"))));
    expect(results.filter((x) => x === "reserved")).toHaveLength(2);
    expect(results.filter((x) => x === "budget_exhausted")).toHaveLength(6);
    expect((await storeA.readTotals({ workspaceId, periodKey: "2026-11" })).reservedMicros).toBe(BigInt(1_000));
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, periodKey: "2026-11" } })).toBe(2);
  });

  it("grants one same-attempt owner and preserves its settlement", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, (_, n) =>
      (n % 2 ? storeA : storeB).reserve(record("same", BigInt(400), "2026-12"))));
    expect(results.filter((x) => x === "reserved")).toHaveLength(1);
    expect(results.filter((x) => x === "duplicate")).toHaveLength(5);
    expect(await settleReservation({ store: storeB, workspaceId, attemptRef: "same",
      usage: { kind: "known", measuredMicros: BigInt(300) } })).toBe("settled");
    expect(await storeA.reserve(record("same", BigInt(400), "2026-12"))).toBe("duplicate");
    expect(await storeA.reserve({ ...record("same", BigInt(400), "2026-12"), model: "different" })).toBe("conflict");
    expect(await storeA.readTotals({ workspaceId, periodKey: "2026-12" })).toMatchObject({
      reservedMicros: BigInt(0), settledMicros: BigInt(300),
    });
  });

  it("refuses a terminal released key even in a later period", async () => {
    expect(await storeA.reserve(record("terminal", BigInt(200), "2027-01"))).toBe("reserved");
    expect(await storeB.release({ workspaceId, attemptRef: "terminal" })).toBe("released");
    expect(await storeA.reserve(record("terminal", BigInt(200), "2027-01"))).toBe("duplicate");
    expect(await storeA.reserve(record("terminal", BigInt(200), "2027-02"))).toBe("conflict");
    expect(await a.lLMSpendPeriodCounter.count({ where: { workspaceId, periodKey: "2027-02" } })).toBe(0);
  });

  it("retains unknown occupancy through recovery and rejects a new call", async () => {
    expect(await storeA.reserve({ ...record("unknown", BigInt(800), "2027-03"), expiresAt: new Date(now.getTime() - 1) })).toBe("reserved");
    const recovered = await recoverExpiredReservations({ store: storeB, now, limit: 100 });
    expect(recovered.converted).toBeGreaterThanOrEqual(1);
    expect(await storeA.reserve(record("after-unknown", BigInt(300), "2027-03"))).toBe("budget_exhausted");
    expect(await storeB.readTotals({ workspaceId, periodKey: "2027-03" })).toMatchObject({
      reservedMicros: BigInt(0), unknownBoundMicros: BigInt(800), unknownCalls: 1,
    });
  });

  it("rolls back inserted attempt on policy conflict, then admits it under the original period policy", async () => {
    expect(await storeA.reserve(record("policy-first", BigInt(100), "2027-04"))).toBe("reserved");
    expect(await storeB.reserve({ ...record("policy-second", BigInt(100), "2027-04"), periodPolicyVersion: "changed" }))
      .toBe("period_policy_conflict");
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef: "policy-second" } })).toBe(0);
    expect(await storeA.reserve(record("policy-second", BigInt(100), "2027-04"))).toBe("reserved");
  });

  it("rolls back the attempt if the counter write throws after attempt insert", async () => {
    mysqlDdl("DROP TRIGGER IF EXISTS synthetic_spend_counter_reject");
    mysqlDdl(`CREATE TRIGGER synthetic_spend_counter_reject BEFORE UPDATE ON LLMSpendPeriodCounter
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic_counter_fault'`);
    try {
      await expect(storeA.reserve(record("fault", BigInt(100), "2027-05"))).rejects.toThrow();
      expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef: "fault" } })).toBe(0);
      expect(await a.lLMSpendPeriodCounter.count({ where: { workspaceId, periodKey: "2027-05" } })).toBe(0);
    } finally {
      mysqlDdl("DROP TRIGGER synthetic_spend_counter_reject");
    }
  });

  it("rolls back counter settlement if the ledger transition throws", async () => {
    expect(await storeA.reserve(record("settle-fault", BigInt(200), "2027-06"))).toBe("reserved");
    mysqlDdl("DROP TRIGGER IF EXISTS synthetic_spend_ledger_reject");
    mysqlDdl(`CREATE TRIGGER synthetic_spend_ledger_reject BEFORE UPDATE ON LLMSpendLedgerEntry
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic_ledger_fault'`);
    try {
      await expect(storeB.settle({ workspaceId, attemptRef: "settle-fault", settledMicros: BigInt(150) })).rejects.toThrow();
      expect((await storeA.readTotals({ workspaceId, periodKey: "2027-06" })).reservedMicros).toBe(BigInt(200));
      expect((await a.lLMSpendLedgerEntry.findUniqueOrThrow({ where: { workspaceId_attemptRef: { workspaceId, attemptRef: "settle-fault" } } })).state).toBe("reserved");
    } finally {
      mysqlDdl("DROP TRIGGER synthetic_spend_ledger_reject");
    }
  });

  it("settle and unknown race to one terminal state, with a consistent counter", async () => {
    expect(await storeA.reserve(record("transition-race", BigInt(300), "2027-07"))).toBe("reserved");
    const results = await Promise.all([
      storeA.settle({ workspaceId, attemptRef: "transition-race", settledMicros: BigInt(250) }),
      storeB.markUnknown({ workspaceId, attemptRef: "transition-race" }),
    ]);
    expect(results.filter((r) => r !== "not_reserved")).toHaveLength(1);
    const totals = await storeA.readTotals({ workspaceId, periodKey: "2027-07" });
    expect(totals.reservedMicros).toBe(BigInt(0));
    expect([BigInt(250), BigInt(300)]).toContain(totals.settledMicros + totals.unknownBoundMicros);
  });

  it("uses period keys independently across months", async () => {
    expect(await storeA.reserve(record("month-a", BigInt(1_000), "2027-08"))).toBe("reserved");
    expect(await storeB.reserve(record("month-b", BigInt(1_000), "2027-09"))).toBe("reserved");
    expect(await storeB.reserve(record("month-a", BigInt(1_000), "2027-09"))).toBe("conflict");
    expect((await storeA.readTotals({ workspaceId, periodKey: "2027-08" })).reservedMicros).toBe(BigInt(1_000));
    expect((await storeA.readTotals({ workspaceId, periodKey: "2027-09" })).reservedMicros).toBe(BigInt(1_000));
  });

  it("rejects out-of-range amounts without writing", async () => {
    await expect(storeA.reserve(record("too-big", BigInt("9223372036854775808"), "2027-10")))
      .rejects.toThrow("reserved_micros_out_of_range");
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef: "too-big" } })).toBe(0);
  });

  it("propagates an unknown transaction outcome without retrying or reporting free", async () => {
    const transaction = vi.spyOn(a, "$transaction").mockRejectedValueOnce(new Error("commit_outcome_unknown"));
    try {
      await expect(storeA.reserve(record("unknown-commit", BigInt(1), "2027-10")))
        .rejects.toThrow("commit_outcome_unknown");
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef: "unknown-commit" } })).toBe(0);
    } finally {
      transaction.mockRestore();
    }
  });

  it("records and settles zero without mistaking an unchanged counter for a conflict", async () => {
    expect(await storeA.reserve(record("zero", BigInt(0), "2027-10"))).toBe("reserved");
    expect(await storeB.settle({ workspaceId, attemptRef: "zero", settledMicros: BigInt(0) })).toBe("settled");
    expect((await a.lLMSpendLedgerEntry.findUniqueOrThrow({ where: { workspaceId_attemptRef: { workspaceId, attemptRef: "zero" } } })).state)
      .toBe("settled");
  });

  it("rolls back a transition when its counter is missing or insufficient", async () => {
    expect(await storeA.reserve(record("missing-counter", BigInt(200), "2027-11"))).toBe("reserved");
    await a.lLMSpendPeriodCounter.delete({ where: { workspaceId_periodKey: { workspaceId, periodKey: "2027-11" } } });
    await expect(storeB.release({ workspaceId, attemptRef: "missing-counter" })).rejects.toThrow("spend_counter_transition_conflict");
    expect((await a.lLMSpendLedgerEntry.findUniqueOrThrow({ where: { workspaceId_attemptRef: { workspaceId, attemptRef: "missing-counter" } } })).state)
      .toBe("reserved");
    await a.lLMSpendPeriodCounter.create({ data: { id: randomUUID(), workspaceId, periodKey: "2027-11",
      periodPolicyVersion: "shanghai-month.v1", reservedMicros: BigInt(100) } });
    await expect(storeA.markUnknown({ workspaceId, attemptRef: "missing-counter" })).rejects.toThrow("spend_counter_transition_conflict");
    expect((await a.lLMSpendLedgerEntry.findUniqueOrThrow({ where: { workspaceId_attemptRef: { workspaceId, attemptRef: "missing-counter" } } })).state)
      .toBe("reserved");
    await a.lLMSpendPeriodCounter.update({ where: { workspaceId_periodKey: { workspaceId, periodKey: "2027-11" } },
      data: { reservedMicros: BigInt(200) } });
    expect(await storeB.release({ workspaceId, attemptRef: "missing-counter" })).toBe("released");
  });

  it("refuses signed BIGINT overflow and leaves the attempt uninserted", async () => {
    const other = `${workspaceId}-overflow`;
    await a.lLMSpendPeriodCounter.create({ data: { id: randomUUID(), workspaceId: other, periodKey: "2027-12",
      periodPolicyVersion: "shanghai-month.v1", reservedMicros: BigInt("9223372036854775807") } });
    try {
      expect(await storeB.reserve({ ...record("overflow", BigInt(1), "2027-12"), workspaceId: other, budgetMicros: null }))
        .toBe("budget_exhausted");
      expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId: other } })).toBe(0);
    } finally {
      await a.lLMSpendPeriodCounter.deleteMany({ where: { workspaceId: other } });
    }
  });

  it("uses separate database sessions and reconciles every persisted period", async () => {
    const [sessionA] = await a.$queryRaw<Array<{ id: bigint }>>`SELECT CONNECTION_ID() AS id`;
    const [sessionB] = await b.$queryRaw<Array<{ id: bigint }>>`SELECT CONNECTION_ID() AS id`;
    expect(sessionA?.id).toBeDefined();
    expect(sessionB?.id).toBeDefined();
    expect(sessionA?.id).not.toBe(sessionB?.id);

    const ledger = await a.lLMSpendLedgerEntry.findMany({ where: { workspaceId } });
    const counters = await a.lLMSpendPeriodCounter.findMany({ where: { workspaceId } });
    for (const counter of counters) {
      const period = ledger.filter((entry) => entry.periodKey === counter.periodKey);
      const sum = (values: bigint[]) => values.reduce((total, value) => total + value, BigInt(0));
      expect(counter.reservedMicros).toBe(sum(period.filter((entry) => entry.state === "reserved").map((entry) => entry.reservedMicros)));
      expect(counter.settledMicros).toBe(sum(period.filter((entry) => entry.state === "settled").map((entry) => entry.settledMicros!)));
      expect(counter.unknownBoundMicros).toBe(sum(period.filter((entry) => entry.state === "unknown").map((entry) => entry.reservedMicros)));
      expect(counter.unknownCalls).toBe(period.filter((entry) => entry.state === "unknown").length);
    }
    expect(new Set(ledger.map((entry) => entry.periodKey))).toEqual(new Set(counters.map((counter) => counter.periodKey)));
  });
});
