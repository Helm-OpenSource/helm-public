/** Candidate MySQL adapter. Its transaction primitives are also used by the
 * governed gateway when a separately trusted charge authority is supplied. */
import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { AtomicReservationResult, ReserveSpendRecord, SpendReservationStore } from "./spend-reservation";

const MAX_MICROS = BigInt("9223372036854775807");
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
const RETRIES = 4;

type RefusalReason = "conflict" | "budget_exhausted" | "period_policy_conflict" | "budget_config_conflict" |
  "legacy_period_requires_reconciliation" | "spend_invariant_breach";

class Refusal extends Error {
  constructor(readonly reason: RefusalReason) { super(reason); }
}

function amount(value: bigint, name: string): bigint {
  if (value < BigInt(0) || value > MAX_MICROS) throw new RangeError(`${name}_out_of_range`);
  return value;
}

const IDENTITY_FIELDS = [
  "workspaceId", "attemptRef", "periodKey", "periodPolicyVersion", "budgetConfigVersion",
  "contractVersion", "operationRef",
  "maximumChargeMicros", "provider", "model", "budgetCurrency", "providerCurrency", "quoteRef",
  "quoteHash", "priceBookRef", "priceBookVersion", "priceBookHash", "fxSnapshotRef", "fxSnapshotHash",
  "policyApprovalRef", "budgetMode", "budgetLimitMicros", "provenanceState",
] as const;

function identityMatches(row: Record<string, unknown>, input: ReserveSpendRecord): boolean {
  return IDENTITY_FIELDS.every((field) => row[field] === input[field]);
}

function retryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034");
}

async function retryConflicts<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await run(); }
    catch (error) {
      if (!retryable(error) || attempt >= RETRIES) throw error;
    }
  }
}

/** Runs admission inside the caller's transaction. Refusals throw so its earlier
 * ledger insert and any dispatch claim are rolled back together. */
export async function reserveSpendInTransaction(
  tx: Prisma.TransactionClient,
  input: ReserveSpendRecord,
): Promise<AtomicReservationResult> {
  amount(input.maximumChargeMicros, "maximum_charge_micros");
  if (input.budgetLimitMicros !== null) amount(input.budgetLimitMicros, "budget_limit_micros");
  if (!Number.isFinite(input.expiresAt.getTime())) throw new RangeError("expires_at_invalid");
  const existing = await tx.lLMSpendLedgerEntry.findUnique({
    where: { workspaceId_attemptRef: { workspaceId: input.workspaceId, attemptRef: input.attemptRef } },
  });
  if (existing) return identityMatches(existing, input) ? "duplicate" : "conflict";

  await tx.lLMSpendLedgerEntry.create({ data: {
    id: randomUUID(), workspaceId: input.workspaceId, periodKey: input.periodKey,
    periodPolicyVersion: input.periodPolicyVersion, attemptRef: input.attemptRef,
    contractVersion: input.contractVersion, operationRef: input.operationRef, state: "reserved",
    reservedMicros: input.maximumChargeMicros, maximumChargeMicros: input.maximumChargeMicros,
    provider: input.provider, model: input.model, budgetCurrency: input.budgetCurrency,
    providerCurrency: input.providerCurrency, budgetConfigVersion: input.budgetConfigVersion,
    budgetMode: input.budgetMode, budgetLimitMicros: input.budgetLimitMicros,
    quoteRef: input.quoteRef, quoteHash: input.quoteHash, priceBookRef: input.priceBookRef,
    priceBookVersion: input.priceBookVersion, priceBookHash: input.priceBookHash,
    fxSnapshotRef: input.fxSnapshotRef, fxSnapshotHash: input.fxSnapshotHash,
    policyApprovalRef: input.policyApprovalRef, provenanceState: input.provenanceState,
    expiresAt: input.expiresAt,
  } });

  // Serialize every v2 admission with the database trigger used by a
  // rolled-back v1 writer. The unique row deliberately shares the old
  // ledger/counter unicode_ci key semantics so old aliases reach the same
  // fence; the locking SELECT below separately enforces exact v2 caller
  // identity. All monetary state remains in the existing ledger and
  // counter. ON DUPLICATE KEY takes the row lock without ever changing a
  // legacy_unknown fence back to open.
  await tx.$executeRaw`
    INSERT INTO LLMSpendPeriodCompatibility
      (id, workspaceId, periodKey, state, createdAt, updatedAt)
    VALUES (${randomUUID()}, ${input.workspaceId}, ${input.periodKey}, 'open',
      CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE id = id`;
  // Use a locking/current read. Under MySQL REPEATABLE READ, a normal
  // Prisma findUnique can retain an earlier snapshot and miss the row
  // that a concurrent transaction just committed before our duplicate-
  // key insert resumed.
  const [compatibility] = await tx.$queryRaw<Array<{
    workspaceId: string; periodKey: string; state: string;
  }>>`
    SELECT workspaceId, periodKey, state
    FROM LLMSpendPeriodCompatibility
    WHERE CAST(workspaceId AS BINARY) = CAST(${input.workspaceId} AS BINARY)
      AND CAST(periodKey AS BINARY) = CAST(${input.periodKey} AS BINARY)
    FOR UPDATE`;
  if (!compatibility || compatibility.workspaceId !== input.workspaceId ||
      compatibility.periodKey !== input.periodKey) {
    throw new Refusal("conflict");
  }
  if (compatibility.state === "legacy_unknown") {
    throw new Refusal("legacy_period_requires_reconciliation");
  }

  await tx.lLMSpendPeriodCounter.upsert({
    where: { workspaceId_periodKey: { workspaceId: input.workspaceId, periodKey: input.periodKey } },
    create: { id: randomUUID(), workspaceId: input.workspaceId, periodKey: input.periodKey,
      periodPolicyVersion: input.periodPolicyVersion, contractVersion: 2,
      budgetConfigVersion: input.budgetConfigVersion, budgetMode: input.budgetMode,
      budgetLimitMicros: input.budgetLimitMicros, policyApprovalRef: input.policyApprovalRef,
      admissionState: "open" },
    update: {},
  });

  const changed = await tx.$executeRaw`
    UPDATE LLMSpendPeriodCounter
    SET reservedMicros = reservedMicros + ${input.maximumChargeMicros}, updatedAt = CURRENT_TIMESTAMP(3)
    WHERE CAST(workspaceId AS BINARY) = CAST(${input.workspaceId} AS BINARY)
      AND CAST(periodKey AS BINARY) = CAST(${input.periodKey} AS BINARY)
      AND contractVersion = 2 AND admissionState = 'open'
      AND CAST(periodPolicyVersion AS BINARY) = CAST(${input.periodPolicyVersion} AS BINARY)
      AND budgetConfigVersion = ${input.budgetConfigVersion}
      AND CAST(budgetMode AS BINARY) = CAST(${input.budgetMode} AS BINARY)
      AND CAST(policyApprovalRef AS BINARY) = CAST(${input.policyApprovalRef} AS BINARY)
      AND ((budgetLimitMicros IS NULL AND ${input.budgetLimitMicros} IS NULL) OR
           budgetLimitMicros = ${input.budgetLimitMicros})
      AND CAST(reservedMicros AS DECIMAL(65,0)) + ${input.maximumChargeMicros} <= ${MAX_MICROS}
      AND (budgetMode = 'unlimited' OR
        CAST(reservedMicros AS DECIMAL(65,0)) + CAST(settledMicros AS DECIMAL(65,0)) +
        CAST(unknownBoundMicros AS DECIMAL(65,0)) + CAST(invariantBreachBoundMicros AS DECIMAL(65,0)) +
        ${input.maximumChargeMicros} <= budgetLimitMicros)`;
  if (changed === 1) return "reserved";
  const counter = await tx.lLMSpendPeriodCounter.findUniqueOrThrow({
    where: { workspaceId_periodKey: { workspaceId: input.workspaceId, periodKey: input.periodKey } },
  });
  if (counter.contractVersion !== 2 || counter.admissionState === "legacy_unknown") {
    throw new Refusal("legacy_period_requires_reconciliation");
  }
  if (counter.workspaceId !== input.workspaceId || counter.periodKey !== input.periodKey) {
    throw new Refusal("conflict");
  }
  if (counter.admissionState === "invariant_breach") throw new Refusal("spend_invariant_breach");
  if (counter.periodPolicyVersion !== input.periodPolicyVersion) throw new Refusal("period_policy_conflict");
  if (counter.budgetConfigVersion !== input.budgetConfigVersion) throw new Refusal("budget_config_conflict");
  if (counter.budgetMode !== input.budgetMode || counter.budgetLimitMicros !== input.budgetLimitMicros ||
      counter.policyApprovalRef !== input.policyApprovalRef) throw new Refusal("budget_config_conflict");
  throw new Refusal("budget_exhausted");
}

export function createPrismaSpendReservationStore(client: PrismaClient): SpendReservationStore {
  return {
    async reserve(input) {
      return retryConflicts(() => client.$transaction(async (tx) =>
        reserveSpendInTransaction(tx, input), TX_OPTIONS).catch((error: unknown) => {
          if (error instanceof Refusal) return error.reason;
          throw error;
        }));
    },
    async settle(input) {
      amount(input.settledMicros, "settled_micros");
      return transition(client, input.workspaceId, input.attemptRef, "settled", input.settledMicros);
    },
    async markUnknown(input) {
      return transition(client, input.workspaceId, input.attemptRef, "unknown");
    },
    async release(input) {
      return transition(client, input.workspaceId, input.attemptRef, "released");
    },
    async readTotals({ workspaceId, periodKey }) {
      const [row, compatibility] = await Promise.all([
        client.lLMSpendPeriodCounter.findUnique({
          where: { workspaceId_periodKey: { workspaceId, periodKey } },
        }),
        client.lLMSpendPeriodCompatibility.findUnique({
          where: { workspaceId_periodKey: { workspaceId, periodKey } },
        }),
      ]);
      const exactRow = row?.workspaceId === workspaceId && row.periodKey === periodKey ? row : null;
      const exactCompatibility = compatibility?.workspaceId === workspaceId && compatibility.periodKey === periodKey ?
        compatibility : null;
      const aliasedExistingPeriod = (row !== null && exactRow === null) ||
        (compatibility !== null && exactCompatibility === null);
      return {
        reservedMicros: exactRow?.reservedMicros ?? BigInt(0),
        settledMicros: exactRow?.settledMicros ?? BigInt(0),
        unknownBoundMicros: exactRow?.unknownBoundMicros ?? BigInt(0),
        unknownCalls: exactRow?.unknownCalls ?? 0,
        invariantBreachBoundMicros: exactRow?.invariantBreachBoundMicros ?? BigInt(0),
        invariantBreachCalls: exactRow?.invariantBreachCalls ?? 0,
        admissionState: aliasedExistingPeriod || exactCompatibility?.state === "legacy_unknown" ? "legacy_unknown" :
          exactRow?.admissionState === "legacy_unknown" || exactRow?.admissionState === "invariant_breach" ?
            exactRow.admissionState : "open",
      };
    },
    async listExpiredReservations({ now, limit }) {
      if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("limit_invalid");
      return client.lLMSpendLedgerEntry.findMany({
        where: { state: "reserved", expiresAt: { lte: now } },
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: limit,
        select: { workspaceId: true, attemptRef: true },
      });
    },
  };
}

type TransitionResult<T extends "settled" | "unknown" | "released"> =
  T | (T extends "settled" ? "invariant_breach" : never) | "not_reserved";

async function transition<T extends "settled" | "unknown" | "released">(
  client: PrismaClient,
  workspaceId: string,
  attemptRef: string,
  requestedState: T,
  measured = BigInt(0),
): Promise<TransitionResult<T>> {
  return retryConflicts(() => client.$transaction((tx) =>
    transitionSpendInTransaction(tx, workspaceId, attemptRef, requestedState, measured), TX_OPTIONS));
}

/** Transition and period counter CAS under the caller's already-held transaction. */
export async function transitionSpendInTransaction<T extends "settled" | "unknown" | "released">(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  attemptRef: string,
  requestedState: T,
  measured = BigInt(0),
): Promise<TransitionResult<T>> {
  if (requestedState === "settled") amount(measured, "settled_micros");
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM LLMSpendLedgerEntry
    WHERE CAST(workspaceId AS BINARY) = CAST(${workspaceId} AS BINARY)
      AND CAST(attemptRef AS BINARY) = CAST(${attemptRef} AS BINARY) FOR UPDATE`;
  if (locked.length === 0) return "not_reserved";
  const row = await tx.lLMSpendLedgerEntry.findUniqueOrThrow({
    where: { workspaceId_attemptRef: { workspaceId, attemptRef } },
  });
  if (row.state !== "reserved") return "not_reserved";
  const bound = row.maximumChargeMicros ?? row.reservedMicros;
  // Resolve the physical counter identity through its existing unicode_ci
  // unique key, then use the returned canonical bytes for the mutation. A
  // rolled-back v1 writer can persist an aliased period/workspace spelling in
  // its ledger row while advancing the pre-existing canonical counter. The
  // locked ledger remains the transition authority; this lookup only locates
  // the aggregate row that old code actually charged.
  const counter = await tx.lLMSpendPeriodCounter.findUnique({
    where: { workspaceId_periodKey: { workspaceId: row.workspaceId, periodKey: row.periodKey } },
  });
  if (!counter) throw new Error("spend_counter_transition_conflict");
  if (row.contractVersion === 2 && (counter.workspaceId !== row.workspaceId ||
      counter.periodKey !== row.periodKey || counter.periodPolicyVersion !== row.periodPolicyVersion)) {
    throw new Error("spend_counter_transition_conflict");
  }

  if (requestedState === "settled" && row.contractVersion !== 2) {
    throw new Error("legacy_spend_attempt_requires_reconciliation");
  }
  const isBreach = requestedState === "settled" && measured > bound;
  let changed: number;
  if (isBreach) {
    changed = await tx.$executeRaw`
      UPDATE LLMSpendPeriodCounter
      SET reservedMicros = reservedMicros - ${bound},
          invariantBreachBoundMicros = invariantBreachBoundMicros + ${bound},
          invariantBreachCalls = invariantBreachCalls + 1,
          admissionState = 'invariant_breach', updatedAt = CURRENT_TIMESTAMP(3)
      WHERE CAST(workspaceId AS BINARY) = CAST(${counter.workspaceId} AS BINARY)
        AND CAST(periodKey AS BINARY) = CAST(${counter.periodKey} AS BINARY)
        AND CAST(periodPolicyVersion AS BINARY) = CAST(${counter.periodPolicyVersion} AS BINARY)
        AND reservedMicros >= ${bound}
        AND CAST(invariantBreachBoundMicros AS DECIMAL(65,0)) + ${bound} <= ${MAX_MICROS}
        AND invariantBreachCalls < 2147483647`;
  } else if (requestedState === "settled") {
    changed = await tx.$executeRaw`
      UPDATE LLMSpendPeriodCounter
      SET reservedMicros = reservedMicros - ${bound}, settledMicros = settledMicros + ${measured},
          updatedAt = CURRENT_TIMESTAMP(3)
      WHERE CAST(workspaceId AS BINARY) = CAST(${counter.workspaceId} AS BINARY)
        AND CAST(periodKey AS BINARY) = CAST(${counter.periodKey} AS BINARY)
        AND CAST(periodPolicyVersion AS BINARY) = CAST(${counter.periodPolicyVersion} AS BINARY)
        AND reservedMicros >= ${bound}
        AND CAST(settledMicros AS DECIMAL(65,0)) + ${measured} <= ${MAX_MICROS}`;
  } else if (requestedState === "unknown") {
    changed = await tx.$executeRaw`
      UPDATE LLMSpendPeriodCounter
      SET reservedMicros = reservedMicros - ${bound}, unknownBoundMicros = unknownBoundMicros + ${bound},
          unknownCalls = unknownCalls + 1, updatedAt = CURRENT_TIMESTAMP(3)
      WHERE CAST(workspaceId AS BINARY) = CAST(${counter.workspaceId} AS BINARY)
        AND CAST(periodKey AS BINARY) = CAST(${counter.periodKey} AS BINARY)
        AND CAST(periodPolicyVersion AS BINARY) = CAST(${counter.periodPolicyVersion} AS BINARY)
        AND reservedMicros >= ${bound}
        AND CAST(unknownBoundMicros AS DECIMAL(65,0)) + ${bound} <= ${MAX_MICROS}
        AND unknownCalls < 2147483647`;
  } else {
    changed = await tx.$executeRaw`
      UPDATE LLMSpendPeriodCounter
      SET reservedMicros = reservedMicros - ${bound}, updatedAt = CURRENT_TIMESTAMP(3)
      WHERE CAST(workspaceId AS BINARY) = CAST(${counter.workspaceId} AS BINARY)
        AND CAST(periodKey AS BINARY) = CAST(${counter.periodKey} AS BINARY)
        AND CAST(periodPolicyVersion AS BINARY) = CAST(${counter.periodPolicyVersion} AS BINARY)
        AND reservedMicros >= ${bound}`;
  }
  if (changed !== 1) throw new Error("spend_counter_transition_conflict");

  const state = isBreach ? "invariant_breach" : requestedState;
  await tx.lLMSpendLedgerEntry.update({
    where: { id: row.id },
    data: {
      state,
      usageState: state === "settled" || state === "invariant_breach" ? "known" :
        state === "unknown" ? "unknown" : "not_consumed",
      ...(state === "settled" ? { settledMicros: measured, observedActualMicros: measured, settledAt: new Date() } : {}),
      ...(state === "invariant_breach" ? { observedActualMicros: measured,
        invariantBreachReason: "actual_exceeds_maximum", settledAt: new Date() } : {}),
    },
  });
  return state as TransitionResult<T>;
}
