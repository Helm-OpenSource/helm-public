import { UsageType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, record } = vi.hoisted(() => ({ db: { usageLedger: { create: vi.fn() } }, record: vi.fn() }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/billing/usage-ledger", () => ({ recordIdempotentUsage: record }));
import { recordUsageLedgerEntry } from "./foundation";

describe("usage foundation compatibility", () => {
  beforeEach(() => vi.clearAllMocks());
  it("preserves legacy unkeyed writes, including zero, without automatic charging", async () => {
    const input = { workspaceId: "synthetic", usageType: UsageType.BRIEFING_GENERATION, quantity: 0 };
    await recordUsageLedgerEntry(input); await recordUsageLedgerEntry(input);
    expect(db.usageLedger.create).toHaveBeenCalledTimes(2);
    expect(db.usageLedger.create.mock.calls[0][0].data.quantity).toBe(0);
    expect(record).not.toHaveBeenCalled();
  });
  it("opts into the scoped writer only when the caller supplies a key", async () => {
    const input = { workspaceId: "synthetic", usageType: UsageType.BRIEFING_GENERATION, operationKey: "snapshot:1" };
    record.mockResolvedValue({ id: "existing" });
    expect(await recordUsageLedgerEntry(input)).toEqual({ id: "existing" });
    expect(record).toHaveBeenCalledWith(input, db);
    expect(db.usageLedger.create).not.toHaveBeenCalled();
  });
});
