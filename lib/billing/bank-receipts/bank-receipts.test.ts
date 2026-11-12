import { describe, expect, it } from "vitest";
import { bankTxnKey, normalizeBankReceiptDraft, registeredReceivingAccounts, type BankReceiptDraftInput } from "./bank-receipts";

const draft = (extra: Partial<BankReceiptDraftInput> = {}): BankReceiptDraftInput => ({ actorUserId: "maker-1",
  payerAccountId: "payer-1", receivingAccountRef: "recv:acct-1", bankTxnRef: "bank-txn-0001", amountFen: BigInt(100000),
  valueDate: "2026-11-09", evidenceRef: "bank-statement:2026-11-09/line-3", ...extra });
const env = { HELM_BILLING_BANK_RECEIVING_ACCOUNTS: JSON.stringify(["recv:acct-1", "recv:acct-2"]) };
const normalize = normalizeBankReceiptDraft;

describe("bank receipt draft normalization", () => {
  it("keeps bank facts byte-exact, sets the normalized live key and parses the value date as a calendar date", () => {
    const row = normalize(draft({ payerNameDigest: `hmac-sha256:${"a".repeat(64)}` }));
    expect(row).toMatchObject({ bankTxnRef: "bank-txn-0001", activeBankTxnRef: "BANKTXN0001", currency: "CNY",
      draftedByUserId: "maker-1", amountFen: BigInt(100000) });
    expect(row.valueDate.toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });
  it("refuses plaintext payer names; accepts only a keyed digest or an opaque reference", () => {
    for (const payerNameDigest of ["张三", "Zhang San", "zhangsan", `sha256:${"a".repeat(64)}`, `hmac-sha256:${"A".repeat(64)}`]) {
      expect(() => normalize(draft({ payerNameDigest }))).toThrow("bank_receipt_input_invalid");
    }
    expect(normalize(draft({ payerNameDigest: "ref:kyc-ref.42" })).payerNameDigest).toBe("ref:kyc-ref.42");
    expect(normalize(draft({ payerNameDigest: null })).payerNameDigest).toBeNull();
  });
  it("refuses non-positive, oversize or non-bigint amounts, impossible dates and malformed references", () => {
    for (const amountFen of [BigInt(0), BigInt(-1), BigInt("9007199254740992"), 100 as unknown as bigint]) {
      expect(() => normalize(draft({ amountFen }))).toThrow("bank_receipt_input_invalid");
    }
    for (const valueDate of ["2026-02-30", "2026-13-01", "20261109", "2026-11-09T00:00:00Z", ""]) {
      expect(() => normalize(draft({ valueDate }))).toThrow("bank_receipt_input_invalid");
    }
    expect(() => normalize(draft({ bankTxnRef: "has space" }))).toThrow("bank_receipt_input_invalid");
    expect(() => normalize(draft({ receivingAccountRef: "" }))).toThrow("bank_receipt_input_invalid");
    expect(() => normalize(draft({ actorUserId: "" }))).toThrow("bank_receipt_forbidden");
  });
  it("folds case and the reference separators into the dedupe key, keeping digits and leading zeros", () => {
    for (const ref of ["bank-txn-0001", "BANK_TXN_0001", "Bank.Txn:0001", "bank/txn/0001", "BANKTXN0001"]) expect(bankTxnKey(ref)).toBe("BANKTXN0001");
    expect(bankTxnKey("00123")).toBe("00123");
    expect(bankTxnKey("00123")).not.toBe(bankTxnKey("0123"));
  });
  it("registers receiving accounts only from a well-formed server list and refuses any other account", () => {
    expect([...registeredReceivingAccounts(env)]).toEqual(["recv:acct-1", "recv:acct-2"]);
    for (const raw of [undefined, "", "not json", "{}", JSON.stringify(["Recv:Acct-1"]), JSON.stringify(["recv:acct-1", "recv:acct1"]),
      JSON.stringify(["recv:acct-1", 7]), JSON.stringify([" recv:acct-1"])]) {
      expect(registeredReceivingAccounts({ HELM_BILLING_BANK_RECEIVING_ACCOUNTS: raw }).size).toBe(0);
    }
    for (const ref of ["recv:acct-3", "RECV:ACCT-1", "recv:acct1"]) expect(registeredReceivingAccounts(env).has(ref)).toBe(false);
    expect(registeredReceivingAccounts({}).size).toBe(0); // nothing registered by default
  });
});
