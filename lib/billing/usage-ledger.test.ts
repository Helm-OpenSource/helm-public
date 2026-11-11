import { Prisma, UsageType, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { recordIdempotentUsage, reverseUsageLedgerEntry } from "./usage-ledger";

const input = {
  workspaceId: "synthetic-workspace", userId: "synthetic-user", operationKey: "briefing:snapshot-1",
  usageType: UsageType.BRIEFING_GENERATION, quantity: 2,
  metadata: { snapshotId: "snapshot-1", nested: { b: 2, a: 1 } },
};
function fake() {
  const rows: Array<Record<string, unknown>> = [];
  const client = {
    usageLedger: {
      findUnique: vi.fn(async ({ where }) => rows.find(row => where.id ? row.id === where.id :
        where.reversalOfId ? row.reversalOfId === where.reversalOfId :
          row.workspaceId === where.workspaceId_operationKey.workspaceId && row.operationKey === where.workspaceId_operationKey.operationKey) ?? null),
      create: vi.fn(async ({ data }) => {
        if (rows.some(row => row.workspaceId === data.workspaceId && row.operationKey === data.operationKey)) {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
        }
        const row = { id: `row-${rows.length}`, createdAt: new Date(), reversalOfId: null, ...data };
        rows.push(row); return row;
      }),
    },
    $queryRaw: vi.fn(async () => [{ workspaceId: input.workspaceId, userId: "reviewer", role: "BILLING_ADMIN",
      status: "ACTIVE", accessScope: null, workspaceStatus: "ACTIVE" }]),
    $transaction: vi.fn(async (run) => run(client)),
  };
  return { client: client as unknown as PrismaClient, mock: client, rows };
}

describe("idempotent usage observations", () => {
  it("replays canonical content without moving its recorded time", async () => {
    const { client, rows } = fake();
    const first = await recordIdempotentUsage(input, client);
    const replay = await recordIdempotentUsage({ ...input, metadata: { nested: { a: 1, b: 2 }, snapshotId: "snapshot-1" } }, client);
    expect(replay.id).toBe(first.id); expect(rows).toHaveLength(1);
    expect(replay.recordedAt).toEqual(first.recordedAt);
  });
  it("refuses changed content under an existing key", async () => {
    const { client, rows } = fake();
    await recordIdempotentUsage(input, client);
    await expect(recordIdempotentUsage({ ...input, quantity: 3 }, client)).rejects.toThrow("usage_operation_conflict");
    expect(rows).toHaveLength(1);
  });
  it("keeps operation identity workspace-scoped", async () => {
    const { client, rows } = fake();
    await recordIdempotentUsage(input, client);
    await recordIdempotentUsage({ ...input, workspaceId: "synthetic-other" }, client);
    expect(rows).toHaveLength(2);
  });
  it.each([0, -1, 0.5, 2147483648, NaN, Infinity])("refuses invalid quantity %s before IO", async quantity => {
    const { client, mock } = fake();
    await expect(recordIdempotentUsage({ ...input, quantity }, client)).rejects.toThrow("usage_quantity_invalid");
    expect(mock.usageLedger.create).not.toHaveBeenCalled();
  });
  it.each(["", " leading", "trailing ", "x".repeat(192)])("refuses invalid operation keys", async operationKey => {
    await expect(recordIdempotentUsage({ ...input, operationKey }, fake().client)).rejects.toThrow("usage_operation_key_invalid");
  });
  it("refuses invalid dates and non-JSON metadata", async () => {
    await expect(recordIdempotentUsage({ ...input, recordedAt: new Date(NaN) }, fake().client)).rejects.toThrow("usage_recorded_at_invalid");
    await expect(recordIdempotentUsage({ ...input, metadata: { value: undefined } }, fake().client)).rejects.toThrow("usage_metadata_invalid");
  });
});

describe("append-only usage correction", () => {
  const correction = { workspaceId: input.workspaceId, actorUserId: "reviewer", operationKey: "correction:1", reasonCode: "invalid_measurement" as const };
  it("appends one full reversal, preserving the original and usage period", async () => {
    const { client, rows } = fake();
    const original = await recordIdempotentUsage(input, client);
    const snapshot = JSON.stringify(original);
    const reversed = await reverseUsageLedgerEntry({ ...correction, entryId: original.id }, client);
    const replay = await reverseUsageLedgerEntry({ ...correction, entryId: original.id }, client);
    expect(reversed.quantity).toBe(-2); expect(reversed.reversalOfId).toBe(original.id);
    expect(reversed.recordedAt).toEqual(original.recordedAt); expect(replay.id).toBe(reversed.id);
    expect(JSON.stringify(original)).toBe(snapshot); expect(rows).toHaveLength(2);
  });
  it.each([
    { role: "ADMIN" }, { status: "INACTIVE" }, { accessScope: "external-test" }, { workspaceStatus: "SUSPENDED" },
  ])("requires current billing authority: %j", async change => {
    const { client, mock, rows } = fake();
    const original = await recordIdempotentUsage(input, client);
    mock.$queryRaw.mockResolvedValueOnce([{ workspaceId: input.workspaceId, userId: "reviewer", role: "BILLING_ADMIN",
      status: "ACTIVE", accessScope: null, workspaceStatus: "ACTIVE", ...change }] as never);
    await expect(reverseUsageLedgerEntry({ ...correction, entryId: original.id }, client)).rejects.toThrow("usage_correction_forbidden");
    expect(rows).toHaveLength(1);
  });
  it("refuses a cross-workspace target and reversal of a reversal", async () => {
    const { client } = fake();
    const original = await recordIdempotentUsage({ ...input, workspaceId: "synthetic-other" }, client);
    await expect(reverseUsageLedgerEntry({ ...correction, entryId: original.id }, client)).rejects.toThrow("usage_entry_unavailable");
    const own = await recordIdempotentUsage(input, client);
    const reversed = await reverseUsageLedgerEntry({ ...correction, entryId: own.id }, client);
    await expect(reverseUsageLedgerEntry({ ...correction, operationKey: "correction:2", entryId: reversed.id }, client)).rejects.toThrow("usage_entry_not_reversible");
  });
  it("refuses a second operation or changed reason for an already reversed entry", async () => {
    const { client, rows } = fake();
    const original = await recordIdempotentUsage(input, client);
    await reverseUsageLedgerEntry({ ...correction, entryId: original.id }, client);
    await expect(reverseUsageLedgerEntry({ ...correction, operationKey: "correction:2", entryId: original.id }, client)).rejects.toThrow("usage_entry_already_reversed");
    await expect(reverseUsageLedgerEntry({ ...correction, reasonCode: "duplicate_operation", entryId: original.id }, client)).rejects.toThrow("usage_operation_conflict");
    expect(rows).toHaveLength(2);
  });
});
