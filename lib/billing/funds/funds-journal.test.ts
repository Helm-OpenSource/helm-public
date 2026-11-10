import { describe, expect, it } from "vitest";
import { normalizeFundsPosting, type FundsEntryInput, type PostFundsInput } from "./funds-journal";

const fen = (value: number) => BigInt(value);
const topup = (entries: FundsEntryInput[], extra: Partial<PostFundsInput> = {}): PostFundsInput => ({
  payerAccountId: "payer-1", kind: "topup", operationKey: "pay:wx/txn-1", entries,
  actor: { type: "SYSTEM", ref: "payment-verifier" }, evidenceRef: "verified-payment:vp-1", ...extra });
const clearingDebit = (amount: number): FundsEntryInput => ({ account: "topup_clearing", direction: "debit", amountFen: fen(amount) });
const walletCredit = (amount: number): FundsEntryInput => ({ account: "customer_wallet_available", direction: "credit", amountFen: fen(amount) });

describe("funds posting normalization", () => {
  it("accepts a balanced topup, sorts lines by account and hashes independent of caller order", () => {
    const a = normalizeFundsPosting(topup([clearingDebit(500), walletCredit(500)]));
    const b = normalizeFundsPosting(topup([walletCredit(500), clearingDebit(500)]));
    expect(a.entries.map(entry => entry.account)).toEqual(["customer_wallet_available", "topup_clearing"]);
    expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.createdBy).toBe("SYSTEM:payment-verifier");
  });
  it("binds the hash to amount, evidence and reversal target", () => {
    const base = normalizeFundsPosting(topup([clearingDebit(500), walletCredit(500)])).contentHash;
    expect(normalizeFundsPosting(topup([clearingDebit(501), walletCredit(501)])).contentHash).not.toBe(base);
    expect(normalizeFundsPosting(topup([clearingDebit(500), walletCredit(500)], { evidenceRef: "verified-payment:vp-2" })).contentHash).not.toBe(base);
    const correction = topup([{ account: "customer_wallet_available", direction: "debit", amountFen: fen(1) },
      { account: "correction_suspense", direction: "credit", amountFen: fen(1) }], { kind: "correction" });
    expect(normalizeFundsPosting(correction, "txn-a").contentHash).not.toBe(normalizeFundsPosting(correction, "txn-b").contentHash);
  });
  it("refuses unbalanced postings", () => {
    expect(() => normalizeFundsPosting(topup([clearingDebit(500), walletCredit(499)]))).toThrow("funds_unbalanced");
  });
  it("refuses zero, negative, oversize and non-bigint amounts, duplicate accounts and bad shapes", () => {
    for (const amountFen of [fen(0), fen(-5), BigInt("9007199254740992"), 5 as unknown as bigint]) {
      expect(() => normalizeFundsPosting(topup([{ ...clearingDebit(5), amountFen }, walletCredit(5)]))).toThrow("funds_input_invalid");
    }
    expect(() => normalizeFundsPosting(topup([walletCredit(5), { ...walletCredit(5), direction: "debit" }]))).toThrow("funds_input_invalid");
    expect(() => normalizeFundsPosting(topup([walletCredit(5)]))).toThrow("funds_input_invalid");
    expect(() => normalizeFundsPosting(topup([clearingDebit(5), { ...walletCredit(5), account: "bank" as never }]))).toThrow("funds_input_invalid");
    expect(() => normalizeFundsPosting(topup([clearingDebit(5), walletCredit(5)], { operationKey: "has space" }))).toThrow("funds_input_invalid");
    expect(() => normalizeFundsPosting(topup([clearingDebit(5), walletCredit(5)], { actor: { type: "AI" as never, ref: "x" } }))).toThrow("funds_input_invalid");
    expect(() => normalizeFundsPosting(topup([clearingDebit(5), walletCredit(5)]), "txn-a")).toThrow("funds_input_invalid");
  });
  it("restricts accounts per kind: topup credits the wallet from clearing; corrections use suspense", () => {
    expect(() => normalizeFundsPosting(topup([{ ...clearingDebit(5), direction: "credit" }, { ...walletCredit(5), direction: "debit" }])))
      .toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting(topup([{ account: "correction_suspense", direction: "debit", amountFen: fen(5) }, walletCredit(5)])))
      .toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting(topup([clearingDebit(5), walletCredit(5)], { kind: "correction" }))).toThrow("funds_accounts_not_allowed");
    // A reversal mirrors the original's accounts, so it may touch topup_clearing.
    expect(normalizeFundsPosting(topup([{ ...clearingDebit(5), direction: "credit" }, { ...walletCredit(5), direction: "debit" }],
      { kind: "correction" }), "txn-a").reversalOfId).toBe("txn-a");
  });
});
