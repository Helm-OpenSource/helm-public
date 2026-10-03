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

  const record = (attemptRef: string, maximumChargeMicros = BigInt(400), periodKey = "2026-10") => ({
    workspaceId, periodKey, periodPolicyVersion: "shanghai-month.v1", attemptRef,
    contractVersion: 2 as const, operationRef: `operation:${attemptRef}`,
    quoteRef: `quote:${attemptRef}`,
    quoteHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    maximumChargeMicros, budgetCurrency: "USD" as const, providerCurrency: "USD" as const,
    budgetConfigVersion: 7, priceBookRef: "price-book:synthetic", priceBookVersion: "2026-10-03",
    priceBookHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    fxSnapshotRef: null, fxSnapshotHash: null, policyApprovalRef: "approval:synthetic",
    provenanceState: "complete" as const,
    budgetMode: "limited" as const, budgetLimitMicros: BigInt(1_000),
    provider: "synthetic", model: "synthetic-model",
    expiresAt: new Date(now.getTime() + 60_000),
  });

  // Mirrors the base v1 transaction shape: legacy ledger insert, counter
  // upsert, then conditional counter increment. It exists only to prove schema
  // compatibility and mixed-version quarantine against a real MySQL server.
  const legacyReserve = (client: PrismaClient, attemptRef: string, periodKey: string,
    reserveMicros = BigInt(100), legacyWorkspaceId = workspaceId) =>
    client.$transaction(async (tx) => {
      await tx.lLMSpendLedgerEntry.create({ data: {
        id: randomUUID(), workspaceId: legacyWorkspaceId, periodKey, periodPolicyVersion: "shanghai-month.v1",
        attemptRef, state: "reserved", reservedMicros: reserveMicros, provider: "synthetic-v1",
        model: "synthetic-v1", expiresAt: new Date(now.getTime() + 60_000),
      } });
      await tx.lLMSpendPeriodCounter.upsert({
        where: { workspaceId_periodKey: { workspaceId: legacyWorkspaceId, periodKey } },
        create: { id: randomUUID(), workspaceId: legacyWorkspaceId, periodKey,
          periodPolicyVersion: "shanghai-month.v1" },
        update: {},
      });
      const changed = await tx.$executeRaw`
        UPDATE LLMSpendPeriodCounter
        SET reservedMicros = reservedMicros + ${reserveMicros}, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE workspaceId = ${legacyWorkspaceId} AND periodKey = ${periodKey}
          AND periodPolicyVersion = 'shanghai-month.v1'`;
      if (changed !== 1) throw new Error("synthetic_v1_counter_update_failed");
      return "reserved" as const;
    });

  // Mirrors the base v1 terminal transaction. It lacks observed-actual and
  // invariant-breach fields, so the v2 database shape must reject it for a v2
  // attempt and atomically preserve the counter reservation.
  const legacySettle = (client: PrismaClient, attemptRef: string, settledMicros: bigint) =>
    client.$transaction(async (tx) => {
      const row = await tx.lLMSpendLedgerEntry.findUniqueOrThrow({
        where: { workspaceId_attemptRef: { workspaceId, attemptRef } },
      });
      const changed = await tx.$executeRaw`
        UPDATE LLMSpendPeriodCounter
        SET reservedMicros = reservedMicros - ${row.reservedMicros},
            settledMicros = settledMicros + ${settledMicros}, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE workspaceId = ${workspaceId} AND periodKey = ${row.periodKey}
          AND periodPolicyVersion = ${row.periodPolicyVersion}
          AND reservedMicros >= ${row.reservedMicros}`;
      if (changed !== 1) throw new Error("synthetic_v1_counter_update_failed");
      await tx.lLMSpendLedgerEntry.update({ where: { id: row.id }, data: {
        state: "settled", usageState: "known", settledMicros, settledAt: new Date(),
      } });
      return "settled" as const;
    });

  beforeAll(async () => {
    assertIsolatedTarget(url!);
    await Promise.all([a.$connect(), b.$connect()]);
    const tables = await a.$queryRaw<Array<{ name: string }>>`
      SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN
        ('LLMSpendLedgerEntry','LLMSpendPeriodCounter','LLMSpendPeriodCompatibility')`;
    if (tables.length !== 3) throw new Error("isolated_candidate_tables_required");
    validatedTarget = true;
  });
  afterAll(async () => {
    try {
      if (validatedTarget) {
        await a.lLMSpendLedgerEntry.deleteMany({ where: { workspaceId } });
        await a.lLMSpendPeriodCounter.deleteMany({ where: { workspaceId } });
        await a.lLMSpendPeriodCompatibility.deleteMany({ where: { workspaceId } });
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

  it("atomically rejects budget config drift without inserting the second attempt", async () => {
    expect(await storeA.reserve(record("config-first", BigInt(100), "2027-04-config"))).toBe("reserved");
    expect(await storeB.reserve({ ...record("config-second", BigInt(100), "2027-04-config"),
      budgetConfigVersion: 8 })).toBe("budget_config_conflict");
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef: "config-second" } })).toBe(0);
  });

  it("atomically rejects a changed budget limit under the same config version", async () => {
    const periodKey = "2027-04-budget-snapshot";
    expect(await storeA.reserve(record("snapshot-first", BigInt(100), periodKey))).toBe("reserved");
    expect(await storeB.reserve({ ...record("snapshot-second", BigInt(100), periodKey),
      budgetLimitMicros: BigInt(10_000) })).toBe("budget_config_conflict");
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef: "snapshot-second" } })).toBe(0);
  });

  it("treats immutable quote provenance drift as an attempt conflict", async () => {
    expect(await storeA.reserve(record("quote-conflict", BigInt(100), "2027-04-quote"))).toBe("reserved");
    expect(await storeB.reserve({ ...record("quote-conflict", BigInt(100), "2027-04-quote"),
      priceBookVersion: "changed" })).toBe("conflict");
  });

  it("uses byte-exact period and approval snapshot comparisons", async () => {
    const approvalPeriod = "2027-04-byte-approval";
    expect(await storeA.reserve(record("byte-approval-first", BigInt(100), approvalPeriod))).toBe("reserved");
    for (const [suffix, policyApprovalRef] of [
      ["case", "APPROVAL:SYNTHETIC"],
      ["accent", "approval:synthetíc"],
      ["space", "approval:synthetic "],
    ] as const) {
      const attemptRef = `byte-approval-${suffix}`;
      expect(await storeB.reserve({ ...record(attemptRef, BigInt(100), approvalPeriod), policyApprovalRef }))
        .toBe("budget_config_conflict");
      expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef } })).toBe(0);
    }

    const policyPeriod = "2027-04-byte-policy";
    expect(await storeA.reserve({ ...record("byte-policy-first", BigInt(100), policyPeriod),
      periodPolicyVersion: "policy.v1" })).toBe("reserved");
    for (const [suffix, periodPolicyVersion] of [
      ["case", "POLICY.V1"],
      ["accent", "polícy.v1"],
      ["space", "policy.v1 "],
    ] as const) {
      const attemptRef = `byte-policy-${suffix}`;
      expect(await storeB.reserve({ ...record(attemptRef, BigInt(100), policyPeriod), periodPolicyVersion }))
        .toBe("period_policy_conflict");
      expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef } })).toBe(0);
    }
  });

  it("rejects NULL in every nullable v2 ledger, CNY FX and breach requirement", async () => {
    const periodKey = "2027-04-null-ledger";
    const attemptRef = "null-ledger";
    expect(await storeA.reserve(record(attemptRef, BigInt(100), periodKey))).toBe("reserved");
    for (const field of [
      "operationRef", "maximumChargeMicros", "budgetCurrency", "providerCurrency",
      "budgetConfigVersion", "budgetMode", "quoteRef", "quoteHash", "priceBookRef",
      "priceBookVersion", "priceBookHash", "policyApprovalRef",
    ] as const) {
      await expect(a.lLMSpendLedgerEntry.update({
        where: { workspaceId_attemptRef: { workspaceId, attemptRef } }, data: { [field]: null },
      })).rejects.toThrow();
    }

    const cny = { ...record("null-cny", BigInt(100), "2027-04-null-cny"),
      providerCurrency: "CNY" as const, fxSnapshotRef: "fx:synthetic",
      fxSnapshotHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" };
    expect(await storeA.reserve(cny)).toBe("reserved");
    for (const field of ["fxSnapshotRef", "fxSnapshotHash"] as const) {
      await expect(a.lLMSpendLedgerEntry.update({
        where: { workspaceId_attemptRef: { workspaceId, attemptRef: "null-cny" } },
        data: { [field]: null },
      })).rejects.toThrow();
    }

    expect(await storeA.reserve(record("null-breach", BigInt(100), "2027-04-null-breach"))).toBe("reserved");
    expect(await storeA.settle({ workspaceId, attemptRef: "null-breach", settledMicros: BigInt(101) }))
      .toBe("invariant_breach");
    for (const field of ["usageState", "observedActualMicros", "invariantBreachReason", "settledAt"] as const) {
      await expect(a.lLMSpendLedgerEntry.update({
        where: { workspaceId_attemptRef: { workspaceId, attemptRef: "null-breach" } },
        data: { [field]: null },
      })).rejects.toThrow();
    }

    expect(await storeA.reserve(record("null-settled", BigInt(100), "2027-04-null-settled"))).toBe("reserved");
    expect(await storeA.settle({ workspaceId, attemptRef: "null-settled", settledMicros: BigInt(80) }))
      .toBe("settled");
    for (const field of ["usageState", "settledMicros", "observedActualMicros", "settledAt"] as const) {
      await expect(a.lLMSpendLedgerEntry.update({
        where: { workspaceId_attemptRef: { workspaceId, attemptRef: "null-settled" } },
        data: { [field]: null },
      })).rejects.toThrow();
    }

    expect(await storeA.reserve(record("null-released", BigInt(1), "2027-04-null-released"))).toBe("reserved");
    expect(await storeA.release({ workspaceId, attemptRef: "null-released" })).toBe("released");
    await expect(a.lLMSpendLedgerEntry.update({
      where: { workspaceId_attemptRef: { workspaceId, attemptRef: "null-released" } },
      data: { usageState: null },
    })).rejects.toThrow();

    expect(await storeA.reserve(record("null-unknown", BigInt(1), "2027-04-null-unknown"))).toBe("reserved");
    expect(await storeA.markUnknown({ workspaceId, attemptRef: "null-unknown" })).toBe("unknown");
    await expect(a.lLMSpendLedgerEntry.update({
      where: { workspaceId_attemptRef: { workspaceId, attemptRef: "null-unknown" } },
      data: { usageState: null },
    })).rejects.toThrow();
  });

  it("rejects NULL in every nullable v2 counter policy requirement", async () => {
    const periodKey = "2027-04-null-counter";
    expect(await storeA.reserve(record("null-counter", BigInt(100), periodKey))).toBe("reserved");
    for (const field of ["budgetConfigVersion", "budgetMode", "budgetLimitMicros", "policyApprovalRef"] as const) {
      await expect(a.lLMSpendPeriodCounter.update({
        where: { workspaceId_periodKey: { workspaceId, periodKey } }, data: { [field]: null },
      })).rejects.toThrow();
    }
  });

  it("rejects non-canonical v2 enum and SHA values under a case-insensitive database default", async () => {
    const acceptedLedger: string[] = [];
    const ledgerCases: Array<[string, Record<string, string>]> = [
      ["budgetCurrency", { budgetCurrency: "usd" }],
      ["providerCurrency", { providerCurrency: "usd" }],
      ["budgetMode", { budgetMode: "LIMITED" }],
      ["provenanceState", { provenanceState: "COMPLETE" }],
      ["state", { state: "RESERVED" }],
      ["quoteHash", { quoteHash: "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }],
      ["quotePrefix", { quoteHash: "SHA256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
      ["priceBookHash", { priceBookHash: "sha256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }],
    ];
    for (const [index, [name, data]] of ledgerCases.entries()) {
      const attemptRef = `canonical-ledger-${name}`;
      expect(await storeA.reserve(record(attemptRef, BigInt(1), `2027-04-cl-${index}`)))
        .toBe("reserved");
      try {
        await a.lLMSpendLedgerEntry.update({
          where: { workspaceId_attemptRef: { workspaceId, attemptRef } }, data,
        });
        acceptedLedger.push(name);
      } catch { /* rejection is the required database behavior */ }
    }
    expect(acceptedLedger).toEqual([]);

    const acceptedCounter: string[] = [];
    for (const [index, [name, data]] of ([
      ["budgetMode", { budgetMode: "LIMITED" }],
      ["admissionState", { admissionState: "OPEN" }],
    ] as const).entries()) {
      const periodKey = `2027-04-cc-${index}`;
      expect(await storeA.reserve(record(`canonical-counter-${name}`, BigInt(1), periodKey))).toBe("reserved");
      try {
        await a.lLMSpendPeriodCounter.update({
          where: { workspaceId_periodKey: { workspaceId, periodKey } }, data,
        });
        acceptedCounter.push(name);
      } catch { /* rejection is the required database behavior */ }
    }
    expect(acceptedCounter).toEqual([]);

    const compatibilityPeriod = "2027-04-canonical-compatibility";
    expect(await storeA.reserve(record("canonical-compatibility", BigInt(1), compatibilityPeriod)))
      .toBe("reserved");
    await expect(a.lLMSpendPeriodCompatibility.update({
      where: { workspaceId_periodKey: { workspaceId, periodKey: compatibilityPeriod } },
      data: { state: "OPEN" },
    })).rejects.toThrow();
  });

  it("quarantines a real v1-shaped write into an existing v2 period and keeps terminal transitions", async () => {
    const periodKey = "2027-04-v1-mixed";
    expect(await storeA.reserve(record("mixed-v2-first", BigInt(100), periodKey))).toBe("reserved");
    expect(await legacyReserve(b, "mixed-v1", periodKey)).toBe("reserved");
    expect(await storeA.reserve(record("mixed-v2-after", BigInt(100), periodKey)))
      .toBe("legacy_period_requires_reconciliation");
    expect(await storeA.settle({ workspaceId, attemptRef: "mixed-v2-first", settledMicros: BigInt(80) }))
      .toBe("settled");
    expect(await storeB.release({ workspaceId, attemptRef: "mixed-v1" })).toBe("released");
    expect(await storeA.readTotals({ workspaceId, periodKey })).toMatchObject({
      admissionState: "legacy_unknown", reservedMicros: BigInt(0), settledMicros: BigInt(80),
    });
  });

  it("ends concurrent v1/v2 writers in a quarantined period", async () => {
    const periodKey = "2027-04-v1-race";
    const outcomes = await Promise.allSettled([
      legacyReserve(a, "race-v1", periodKey),
      storeB.reserve(record("race-v2", BigInt(100), periodKey)),
    ]);
    expect(outcomes.some((row) => row.status === "fulfilled")).toBe(true);
    expect(await storeA.reserve(record("race-v2-after", BigInt(100), periodKey)))
      .toBe("legacy_period_requires_reconciliation");
    expect(await storeA.readTotals({ workspaceId, periodKey })).toMatchObject({
      admissionState: "legacy_unknown",
    });
  });

  it("quarantines a zero-bound legacy write without relying on a counter delta", async () => {
    const periodKey = "2027-04-v1-zero";
    expect(await storeA.reserve(record("zero-v2-first", BigInt(100), periodKey))).toBe("reserved");
    expect(await legacyReserve(b, "zero-v1", periodKey, BigInt(0))).toBe("reserved");
    expect(await storeA.reserve(record("zero-v2-after", BigInt(100), periodKey)))
      .toBe("legacy_period_requires_reconciliation");
    expect(await storeB.release({ workspaceId, attemptRef: "zero-v1" })).toBe("released");
    expect(await storeA.readTotals({ workspaceId, periodKey })).toMatchObject({
      admissionState: "legacy_unknown", reservedMicros: BigInt(100),
    });
  });

  it("maps legacy case and accent aliases onto the existing database period fence", async () => {
    for (const [suffix, legacyWorkspaceId, currentPeriodKey, legacyPeriodKey] of [
      ["period-case", workspaceId, "2027-04-alias", "2027-04-ALIAS"],
      ["period-accent", workspaceId, "2027-04-cafe", "2027-04-café"],
      ["workspace-case", workspaceId.toLowerCase(), "2027-04-wa", "2027-04-wa"],
    ] as const) {
      const currentWorkspaceId = suffix === "workspace-case" ? workspaceId.toUpperCase() : workspaceId;
      const first = { ...record(`alias-v2-first-${suffix}`, BigInt(1), currentPeriodKey),
        workspaceId: currentWorkspaceId };
      expect(await storeA.reserve(first)).toBe("reserved");
      expect(await legacyReserve(b, `alias-v1-${suffix}`, legacyPeriodKey, BigInt(1), legacyWorkspaceId))
        .toBe("reserved");
      expect(await storeA.reserve({ ...record(`alias-v2-after-${suffix}`, BigInt(1), currentPeriodKey),
        workspaceId: currentWorkspaceId })).toBe("legacy_period_requires_reconciliation");
      expect(await storeA.release({ workspaceId: currentWorkspaceId,
        attemptRef: `alias-v2-first-${suffix}` })).toBe("released");
      expect(await storeB.release({ workspaceId: legacyWorkspaceId,
        attemptRef: `alias-v1-${suffix}` })).toBe("released");
      expect(await storeA.readTotals({ workspaceId: currentWorkspaceId, periodKey: currentPeriodKey }))
        .toMatchObject({ admissionState: "legacy_unknown", reservedMicros: BigInt(0) });
    }
  });

  it("distinguishes an aliased existing period from a genuinely absent period", async () => {
    const periodKey = "2027-04-read-alias";
    expect(await storeA.reserve(record("read-alias", BigInt(25), periodKey))).toBe("reserved");
    expect(await storeA.readTotals({ workspaceId, periodKey: periodKey.toUpperCase() })).toMatchObject({
      reservedMicros: BigInt(0), admissionState: "legacy_unknown",
    });
    expect(await storeA.readTotals({ workspaceId: workspaceId.toUpperCase(), periodKey })).toMatchObject({
      reservedMicros: BigInt(0), admissionState: "legacy_unknown",
    });
    expect(await storeA.readTotals({ workspaceId, periodKey: "2099-01-absent" })).toMatchObject({
      reservedMicros: BigInt(0), admissionState: "open",
    });
  });

  it("rejects a real v1-shaped settlement of a v2 attempt and preserves occupation", async () => {
    const periodKey = "2027-04-v1-settle-v2";
    const attemptRef = "v1-settle-v2";
    expect(await storeA.reserve(record(attemptRef, BigInt(100), periodKey))).toBe("reserved");
    await expect(legacySettle(b, attemptRef, BigInt(101))).rejects.toThrow();
    expect(await storeA.readTotals({ workspaceId, periodKey })).toMatchObject({
      reservedMicros: BigInt(100), settledMicros: BigInt(0), admissionState: "open",
    });
    expect((await a.lLMSpendLedgerEntry.findUniqueOrThrow({
      where: { workspaceId_attemptRef: { workspaceId, attemptRef } },
    })).state).toBe("reserved");
    expect(await storeA.settle({ workspaceId, attemptRef, settledMicros: BigInt(101) }))
      .toBe("invariant_breach");
  });

  it("quarantines a legacy period counter from v2 admission", async () => {
    const periodKey = "2027-04-legacy";
    await a.lLMSpendPeriodCounter.create({ data: { id: randomUUID(), workspaceId, periodKey,
      periodPolicyVersion: "shanghai-month.v1", contractVersion: 1, budgetConfigVersion: null,
      admissionState: "legacy_unknown" } });
    expect(await storeB.reserve(record("after-legacy", BigInt(100), periodKey)))
      .toBe("legacy_period_requires_reconciliation");
    expect(await a.lLMSpendLedgerEntry.count({ where: { workspaceId, attemptRef: "after-legacy" } })).toBe(0);
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

  it("preserves the maximum bound and blocks the period when actual exceeds it", async () => {
    const periodKey = "2027-07-breach";
    expect(await storeA.reserve(record("breach", BigInt(300), periodKey))).toBe("reserved");
    expect(await storeB.settle({ workspaceId, attemptRef: "breach", settledMicros: BigInt(301) }))
      .toBe("invariant_breach");
    expect(await storeA.readTotals({ workspaceId, periodKey })).toMatchObject({
      reservedMicros: BigInt(0), settledMicros: BigInt(0),
      invariantBreachBoundMicros: BigInt(300), invariantBreachCalls: 1,
      admissionState: "invariant_breach",
    });
    expect(await storeA.reserve(record("after-breach", BigInt(1), periodKey))).toBe("spend_invariant_breach");
    const row = await a.lLMSpendLedgerEntry.findUniqueOrThrow({
      where: { workspaceId_attemptRef: { workspaceId, attemptRef: "breach" } },
    });
    expect(row).toMatchObject({ state: "invariant_breach", observedActualMicros: BigInt(301),
      maximumChargeMicros: BigInt(300), invariantBreachReason: "actual_exceeds_maximum" });
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
      .rejects.toThrow("maximum_charge_micros_out_of_range");
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
      periodPolicyVersion: "shanghai-month.v1", contractVersion: 2, budgetConfigVersion: 7,
      budgetMode: "limited", budgetLimitMicros: BigInt(1_000), policyApprovalRef: "approval:synthetic",
      admissionState: "open", reservedMicros: BigInt(100) } });
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
      periodPolicyVersion: "shanghai-month.v1", contractVersion: 2, budgetConfigVersion: 7,
      budgetMode: "unlimited", budgetLimitMicros: null, policyApprovalRef: "approval:synthetic",
      admissionState: "open", reservedMicros: BigInt("9223372036854775807") } });
    try {
      expect(await storeB.reserve({ ...record("overflow", BigInt(1), "2027-12"), workspaceId: other,
        budgetMode: "unlimited", budgetLimitMicros: null }))
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
      expect(counter.invariantBreachBoundMicros)
        .toBe(sum(period.filter((entry) => entry.state === "invariant_breach").map((entry) => entry.reservedMicros)));
      expect(counter.invariantBreachCalls).toBe(period.filter((entry) => entry.state === "invariant_breach").length);
    }
    const mappedCounters = await Promise.all(ledger.map(async (entry) => {
      const [result] = await a.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM LLMSpendPeriodCounter
        WHERE workspaceId = ${entry.workspaceId} AND periodKey = ${entry.periodKey}`;
      return result?.count ?? BigInt(0);
    }));
    expect(ledger.filter((_, index) => mappedCounters[index] !== BigInt(1))
      .map((entry) => `${entry.workspaceId}/${entry.periodKey}/${entry.attemptRef}`)).toEqual([]);
  });
});
