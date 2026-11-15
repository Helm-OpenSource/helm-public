import { describe, expect, it } from "vitest";
import { creditRepayOperationKey, normalizeFundsPosting, overdraftRepayOperationKey, type FundsEntryInput,
  type PostFundsInput } from "./funds-journal";

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
  it("accepts a charge only as wallet debit against charge revenue", () => {
    const debit = { account: "customer_wallet_available" as const, direction: "debit" as const, amountFen: fen(7) };
    const revenue = { account: "charge_revenue" as const, direction: "credit" as const, amountFen: fen(7) };
    const charge = { kind: "charge" as const, operationKey: "charge:reservation-1" };
    expect(normalizeFundsPosting(topup([revenue, debit], charge)).entries.map(entry => entry.account))
      .toEqual(["charge_revenue", "customer_wallet_available"]);
    expect(() => normalizeFundsPosting(topup([clearingDebit(7), walletCredit(7)], charge))).toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting(topup([{ ...revenue, direction: "debit" }, { ...debit, direction: "credit" }], charge)))
      .toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting(topup([revenue, debit], { kind: "charge" }))).toThrow("funds_input_invalid"); // charge: prefix only
    expect(() => normalizeFundsPosting(topup([clearingDebit(7), walletCredit(7)], { operationKey: "charge:x" }))).toThrow("funds_input_invalid");
  });
  it("accepts bank_topup only as debit bank_clearing / credit wallet; other kinds cannot use bank_clearing", () => {
    const bankDebit = (amount: number): FundsEntryInput => ({ account: "bank_clearing", direction: "debit", amountFen: fen(amount) });
    expect(normalizeFundsPosting(topup([walletCredit(9), bankDebit(9)], { kind: "bank_topup" })).entries.map(e => e.account))
      .toEqual(["bank_clearing", "customer_wallet_available"]);
    expect(() => normalizeFundsPosting(topup([clearingDebit(9), walletCredit(9)], { kind: "bank_topup" }))).toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting(topup([{ ...bankDebit(9), direction: "credit" }, { ...walletCredit(9), direction: "debit" }],
      { kind: "bank_topup" }))).toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting(topup([bankDebit(9), walletCredit(9)]))).toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting(topup([{ ...bankDebit(9), direction: "credit" }, { ...walletCredit(9), direction: "debit" }],
      { kind: "correction" }))).toThrow("funds_accounts_not_allowed");
  });
  it("posts repayments only through the private channel, with reserved keys and fixed shapes (C-REPAY)", () => {
    const walletDebit = (amount: number): FundsEntryInput => ({ account: "customer_wallet_available", direction: "debit", amountFen: fen(amount) });
    const owed = (account: "overdraft_receivable" | "credit_receivable", amount: number): FundsEntryInput => ({ account, direction: "credit",
      amountFen: fen(amount) });
    const overdraft = topup([walletDebit(5), owed("overdraft_receivable", 5)], { kind: "overdraft_repay", operationKey: overdraftRepayOperationKey("in-1") });
    const credit = topup([walletDebit(5), owed("credit_receivable", 5)], { kind: "credit_repay", operationKey: creditRepayOperationKey("in-1", "cf-1") });
    expect(creditRepayOperationKey("in-1", "cf-1")).toBe("credit-repay:in-1:cf-1");
    expect(normalizeFundsPosting(overdraft, null, "overdraft_repay").entries.map(e => e.account)).toEqual(["customer_wallet_available", "overdraft_receivable"]);
    expect(normalizeFundsPosting(credit, null, "credit_repay").entries.map(e => e.account)).toEqual(["credit_receivable", "customer_wallet_available"]);
    for (const [posting, channel] of [[overdraft, null], [credit, null], [overdraft, "credit_repay"], [credit, "credit_draw"]] as const) {
      expect(() => normalizeFundsPosting(posting, null, channel)).toThrow("funds_accounts_not_allowed"); // public or another channel
    }
    // Shapes: wallet debit against the receivable being repaid; never the other receivable, never reversed directions.
    expect(() => normalizeFundsPosting({ ...overdraft, entries: [walletDebit(5), owed("credit_receivable", 5)] }, null, "overdraft_repay"))
      .toThrow("funds_accounts_not_allowed");
    expect(() => normalizeFundsPosting({ ...credit, entries: [{ ...walletDebit(5), direction: "credit" }, { ...owed("credit_receivable", 5),
      direction: "debit" }] }, null, "credit_repay")).toThrow("funds_accounts_not_allowed");
    // Reserved prefixes both ways: a repayment needs its key; no other kind (a correction included) may occupy one.
    expect(() => normalizeFundsPosting({ ...credit, operationKey: "fee:x" }, null, "credit_repay")).toThrow("funds_input_invalid");
    expect(() => normalizeFundsPosting({ ...overdraft, operationKey: "credit-repay:in-1:cf-1" }, null, "overdraft_repay")).toThrow("funds_input_invalid");
    const squat = topup([walletDebit(5), { account: "correction_suspense", direction: "credit", amountFen: fen(5) }], { kind: "correction" });
    for (const operationKey of [overdraftRepayOperationKey("in-1"), creditRepayOperationKey("in-1", "cf-1")]) {
      expect(() => normalizeFundsPosting({ ...squat, operationKey })).toThrow("funds_input_invalid");
    }
    expect(normalizeFundsPosting({ ...squat, operationKey: "fee:in-1" }).kind).toBe("correction");
  });
});
