import { describe, expect, it } from "vitest";
import { normalizeBankReceiptDraft, type BankReceiptDraftInput } from "./bank-receipts";

const draft = (extra: Partial<BankReceiptDraftInput> = {}): BankReceiptDraftInput => ({ actorUserId: "maker-1",
  payerAccountId: "payer-1", receivingAccountRef: "recv:acct-1", bankTxnRef: "bank-txn-0001", amountFen: BigInt(100000),
  valueDate: "2026-11-09", evidenceRef: "bank-statement:2026-11-09/line-3", ...extra });

describe("bank receipt draft normalization", () => {
  it("keeps bank facts byte-exact, sets the live key and parses the value date as a calendar date", () => {
    const row = normalizeBankReceiptDraft(draft({ payerNameDigest: `hmac-sha256:${"a".repeat(64)}` }));
    expect(row).toMatchObject({ bankTxnRef: "bank-txn-0001", activeBankTxnRef: "bank-txn-0001", currency: "CNY",
      draftedByUserId: "maker-1", amountFen: BigInt(100000) });
    expect(row.valueDate.toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });
  it("refuses plaintext payer names; accepts only a keyed digest or an opaque reference", () => {
    for (const payerNameDigest of ["张三", "Zhang San", "zhangsan", `sha256:${"a".repeat(64)}`, `hmac-sha256:${"A".repeat(64)}`]) {
      expect(() => normalizeBankReceiptDraft(draft({ payerNameDigest }))).toThrow("bank_receipt_input_invalid");
    }
    expect(normalizeBankReceiptDraft(draft({ payerNameDigest: "ref:kyc-ref.42" })).payerNameDigest).toBe("ref:kyc-ref.42");
    expect(normalizeBankReceiptDraft(draft({ payerNameDigest: null })).payerNameDigest).toBeNull();
  });
  it("refuses non-positive, oversize or non-bigint amounts, impossible dates and malformed references", () => {
    for (const amountFen of [BigInt(0), BigInt(-1), BigInt("9007199254740992"), 100 as unknown as bigint]) {
      expect(() => normalizeBankReceiptDraft(draft({ amountFen }))).toThrow("bank_receipt_input_invalid");
    }
    for (const valueDate of ["2026-02-30", "2026-13-01", "20261109", "2026-11-09T00:00:00Z", ""]) {
      expect(() => normalizeBankReceiptDraft(draft({ valueDate }))).toThrow("bank_receipt_input_invalid");
    }
    expect(() => normalizeBankReceiptDraft(draft({ bankTxnRef: "has space" }))).toThrow("bank_receipt_input_invalid");
    expect(() => normalizeBankReceiptDraft(draft({ receivingAccountRef: "" }))).toThrow("bank_receipt_input_invalid");
    expect(() => normalizeBankReceiptDraft(draft({ actorUserId: "" }))).toThrow("bank_receipt_forbidden");
  });
});
