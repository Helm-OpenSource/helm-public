/** Candidate MySQL adapter. Deliberately not connected to any provider entry point. */
import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { ReserveSpendRecord, SpendReservationStore } from "./spend-reservation";

const MAX_MICROS = BigInt("9223372036854775807");
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
const RETRIES = 4;

class Refusal extends Error {
  constructor(readonly reason: "budget_exhausted" | "period_policy_conflict") {
    super(reason);
  }
}

function amount(value: bigint, name: string): bigint {
  if (value < BigInt(0) || value > MAX_MICROS) throw new RangeError(`${name}_out_of_range`);
  return value;
}

function identityMatches(row: {
  periodKey: string; periodPolicyVersion: string; reservedMicros: bigint; provider: string; model: string;
}, input: ReserveSpendRecord): boolean {
  return row.periodKey === input.periodKey && row.periodPolicyVersion === input.periodPolicyVersion &&
    row.reservedMicros === input.reservedMicros && row.provider === input.provider && row.model === input.model;
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

/** All writes are transaction-scoped. The caller owns both the Prisma client and schema deployment. */
export function createPrismaSpendReservationStore(client: PrismaClient): SpendReservationStore {
  return {
    async reserve(input) {
      amount(input.reservedMicros, "reserved_micros");
      if (input.budgetMicros !== null) amount(input.budgetMicros, "budget_micros");
      if (!Number.isFinite(input.expiresAt.getTime())) throw new RangeError("expires_at_invalid");
      return retryConflicts(() => client.$transaction(async (tx) => {
        const existing = await tx.lLMSpendLedgerEntry.findUnique({
          where: { workspaceId_attemptRef: { workspaceId: input.workspaceId, attemptRef: input.attemptRef } },
        });
        if (existing) return identityMatches(existing, input) ? "duplicate" : "conflict";

        // Insert first: the unique key serializes competing attempts even if the period is full.
        // A later refusal throws, rolling this insert back with the counter operation.
        await tx.lLMSpendLedgerEntry.create({ data: {
          id: randomUUID(), workspaceId: input.workspaceId, periodKey: input.periodKey,
          periodPolicyVersion: input.periodPolicyVersion, attemptRef: input.attemptRef,
          state: "reserved", reservedMicros: input.reservedMicros, provider: input.provider,
          model: input.model, expiresAt: input.expiresAt,
        } });

        await tx.lLMSpendPeriodCounter.upsert({
          where: { workspaceId_periodKey: { workspaceId: input.workspaceId, periodKey: input.periodKey } },
          create: { id: randomUUID(), workspaceId: input.workspaceId, periodKey: input.periodKey,
            periodPolicyVersion: input.periodPolicyVersion },
          update: {},
        });

        // DECIMAL arithmetic in the predicate avoids signed BIGINT overflow. The target
        // reserved column is separately bounded, including for an unlimited policy.
        const changed = await tx.$executeRaw`
          UPDATE LLMSpendPeriodCounter
          SET reservedMicros = reservedMicros + ${input.reservedMicros}, updatedAt = CURRENT_TIMESTAMP(3)
          WHERE workspaceId = ${input.workspaceId} AND periodKey = ${input.periodKey}
            AND periodPolicyVersion = ${input.periodPolicyVersion}
            AND CAST(reservedMicros AS DECIMAL(65,0)) + ${input.reservedMicros} <= ${MAX_MICROS}
            AND (${input.budgetMicros} IS NULL OR
              CAST(reservedMicros AS DECIMAL(65,0)) + CAST(settledMicros AS DECIMAL(65,0)) +
              CAST(unknownBoundMicros AS DECIMAL(65,0)) + ${input.reservedMicros} <= ${input.budgetMicros})`;
        if (changed === 1) return "reserved";
        const counter = await tx.lLMSpendPeriodCounter.findUniqueOrThrow({
          where: { workspaceId_periodKey: { workspaceId: input.workspaceId, periodKey: input.periodKey } },
        });
        throw new Refusal(counter.periodPolicyVersion !== input.periodPolicyVersion
          ? "period_policy_conflict" : "budget_exhausted");
      }, TX_OPTIONS).catch((error: unknown) => {
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
      const row = await client.lLMSpendPeriodCounter.findUnique({
        where: { workspaceId_periodKey: { workspaceId, periodKey } },
      });
      return { reservedMicros: row?.reservedMicros ?? BigInt(0), settledMicros: row?.settledMicros ?? BigInt(0),
        unknownBoundMicros: row?.unknownBoundMicros ?? BigInt(0), unknownCalls: row?.unknownCalls ?? 0 };
    },
    async listExpiredReservations({ now, limit }) {
      if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("limit_invalid");
      return client.lLMSpendLedgerEntry.findMany({
        where: { state: "reserved", expiresAt: { lte: now } }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
        take: limit, select: { workspaceId: true, attemptRef: true },
      });
    },
  };
}

async function transition<T extends "settled" | "unknown" | "released">(
  client: PrismaClient, workspaceId: string, attemptRef: string,
  state: T, measured = BigInt(0),
): Promise<T | "not_reserved"> {
  return retryConflicts(() => client.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM LLMSpendLedgerEntry
      WHERE workspaceId = ${workspaceId} AND attemptRef = ${attemptRef} FOR UPDATE`;
    if (locked.length === 0) return "not_reserved";
    const row = await tx.lLMSpendLedgerEntry.findUniqueOrThrow({
      where: { workspaceId_attemptRef: { workspaceId, attemptRef } },
    });
    if (row.state !== "reserved") return "not_reserved";

    let changed: number;
    if (state === "settled") {
      changed = await tx.$executeRaw`
        UPDATE LLMSpendPeriodCounter
        SET reservedMicros = reservedMicros - ${row.reservedMicros},
            settledMicros = settledMicros + ${measured}, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE workspaceId = ${workspaceId} AND periodKey = ${row.periodKey}
          AND periodPolicyVersion = ${row.periodPolicyVersion}
          AND reservedMicros >= ${row.reservedMicros}
          AND CAST(settledMicros AS DECIMAL(65,0)) + ${measured} <= ${MAX_MICROS}`;
    } else if (state === "unknown") {
      changed = await tx.$executeRaw`
        UPDATE LLMSpendPeriodCounter
        SET reservedMicros = reservedMicros - ${row.reservedMicros},
            unknownBoundMicros = unknownBoundMicros + ${row.reservedMicros},
            unknownCalls = unknownCalls + 1, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE workspaceId = ${workspaceId} AND periodKey = ${row.periodKey}
          AND periodPolicyVersion = ${row.periodPolicyVersion}
          AND reservedMicros >= ${row.reservedMicros}
          AND CAST(unknownBoundMicros AS DECIMAL(65,0)) + ${row.reservedMicros} <= ${MAX_MICROS}
          AND unknownCalls < 2147483647`;
    } else {
      changed = await tx.$executeRaw`
        UPDATE LLMSpendPeriodCounter
        SET reservedMicros = reservedMicros - ${row.reservedMicros}, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE workspaceId = ${workspaceId} AND periodKey = ${row.periodKey}
          AND periodPolicyVersion = ${row.periodPolicyVersion}
          AND reservedMicros >= ${row.reservedMicros}`;
    }
    if (changed !== 1) throw new Error("spend_counter_transition_conflict");
    // The SELECT FOR UPDATE above holds this attempt row until commit. Its
    // state was checked under that lock, so a unique-id update is sufficient.
    await tx.lLMSpendLedgerEntry.update({
      where: { id: row.id },
      data: { state, usageState: state === "settled" ? "known" : state === "unknown" ? "unknown" : "not_consumed",
        ...(state === "settled" ? { settledMicros: measured, settledAt: new Date() } : {}) },
    });
    return state;
  }, TX_OPTIONS));
}
