import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CreditOperatorError, parseCreditBatchList, parseCreditOperatorArgs } from "./credit-operator";

const bytes = (value: unknown) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
const list = (extra: Record<string, unknown> = {}) => ({ v: 1, batchRef: "credit-20261112", evidenceRef: "owner-ruling:20261111-1826",
  validUntil: null, entries: [{ workspaceId: "ws-1", payerAccountId: "p-1", limitFen: "100000000" }, { workspaceId: "ws-2", payerAccountId: "p-2", limitFen: "1" }],
  ...extra });
const code = (run: () => unknown) => { try { run(); } catch (error) { return (error as CreditOperatorError).code; } return null; };

describe("credit batch list", () => {
  it("parses integer fen strings and binds the sha256 to the exact file bytes", () => {
    const raw = bytes(list());
    const parsed = parseCreditBatchList(raw);
    expect(parsed).toMatchObject({ operationKey: "credit-batch:credit-20261112", validUntil: null,
      entries: [{ workspaceId: "ws-1", payerAccountId: "p-1", limitFen: BigInt(100_000_000) },
        { workspaceId: "ws-2", payerAccountId: "p-2", limitFen: BigInt(1) }] });
    expect(parsed.listSha).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(parseCreditBatchList(Buffer.from(`${raw.toString()}\n`)).listSha).not.toBe(parsed.listSha);
  });

  it("refuses yuan, decimals, signs, zero, duplicates, a missing payer id, unknown fields and non-canonical times", () => {
    for (const limitFen of ["1000000.00", "-1", "0", "01", "1e8", "9007199254740992"]) {
      expect(code(() => parseCreditBatchList(bytes(list({ entries: [{ workspaceId: "ws-1", payerAccountId: "p-1", limitFen }] }))))).toBe("usage:list_limit_fen");
    }
    expect(code(() => parseCreditBatchList(bytes(list({ entries: [{ workspaceId: "ws-1", payerAccountId: "p-1", limitFen: 100 }] }))))).toBe("usage:list_invalid");
    expect(code(() => parseCreditBatchList(bytes(list({ entries: [{ workspaceId: "ws-1", payerAccountId: "p-1", limitFen: "1" },
      { workspaceId: "ws-1", payerAccountId: "p-2", limitFen: "2" }] }))))).toBe("usage:list_duplicate_workspace");
    expect(code(() => parseCreditBatchList(bytes(list({ entries: [{ workspaceId: "ws-1", payerAccountId: "p-1", limitFen: "1" },
      { workspaceId: "ws-2", payerAccountId: "p-1", limitFen: "2" }] }))))).toBe("usage:list_duplicate_payer");
    expect(code(() => parseCreditBatchList(bytes(list({ entries: [{ workspaceId: "ws-1", limitFen: "1" }] }))))).toBe("usage:list_invalid");
    expect(code(() => parseCreditBatchList(bytes(list({ owner: "x" }))))).toBe("usage:list_invalid");
    expect(code(() => parseCreditBatchList(bytes(list({ batchRef: "has:colon" }))))).toBe("usage:list_invalid");
    expect(code(() => parseCreditBatchList(bytes(list({ validUntil: "2027-01-01" }))))).toBe("usage:list_valid_until");
    expect(parseCreditBatchList(bytes(list({ validUntil: "2027-01-01T00:00:00.000Z" }))).validUntil?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(code(() => parseCreditBatchList(bytes("not json")))).toBe("usage:list_not_json");
  });
});

describe("credit operator arguments", () => {
  it("accepts only each command's own flags, once", () => {
    expect(parseCreditOperatorArgs(["reduce", "--facility-id=f1", "--limit-fen=10", "--apply"])).toMatchObject({ command: "reduce", apply: true });
    expect(code(() => parseCreditOperatorArgs(["approve", "--limit-fen=10"]))).toBe("usage:flag:--limit-fen");
    expect(code(() => parseCreditOperatorArgs(["show", "--workspace-id=a", "--workspace-id=b"]))).toBe("usage:flag:--workspace-id");
    expect(code(() => parseCreditOperatorArgs(["increase"]))).toBe("usage:command");
    expect(code(() => parseCreditOperatorArgs(["batch", "--apply=yes"]))).toBe("usage:flag:--apply");
  });
});
