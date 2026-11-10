import { describe, expect, it } from "vitest";
import { normalizeFundsPosting, type PostFundsInput } from "../funds/funds-journal";
import { normalizeCreditFacilityProposal, type ProposeCreditFacilityInput } from "./credit-facilities";

const proposal = (extra: Partial<ProposeCreditFacilityInput> = {}): ProposeCreditFacilityInput => ({ actorUserId: "maker-1",
  payerAccountId: "payer-1", limitFen: BigInt(10_000_000), validUntil: null, operationKey: "credit:cutoff-1",
  evidenceRef: "owner-ruling:credit-1", ...extra });
const draw = (extra: Partial<PostFundsInput> = {}): PostFundsInput => ({ payerAccountId: "payer-1", kind: "credit_draw",
  operationKey: "credit-draw:settle-1", actor: { type: "SYSTEM", ref: "billing-settle" }, evidenceRef: "credit-facility:f1",
  entries: [{ account: "credit_receivable", direction: "debit", amountFen: BigInt(300) },
    { account: "customer_wallet_available", direction: "credit", amountFen: BigInt(300) }], ...extra });

describe("credit facility proposal normalization", () => {
  it("binds the content hash to limit, term, evidence and proposer", () => {
    const base = normalizeCreditFacilityProposal(proposal());
    expect(base).toMatchObject({ limitFen: BigInt(10_000_000), validUntil: null, proposedByUserId: "maker-1" });
    expect(base.contentHash).toMatch(/^[a-f0-9]{64}$/);
    for (const extra of [{ limitFen: BigInt(9_999_999) }, { validUntil: new Date("2027-01-01T00:00:00Z") },
      { evidenceRef: "owner-ruling:credit-2" }, { actorUserId: "maker-2" }]) {
      expect(normalizeCreditFacilityProposal(proposal(extra)).contentHash).not.toBe(base.contentHash);
    }
  });
  it("refuses zero, negative, oversize or non-bigint limits, invalid dates and malformed references", () => {
    for (const limitFen of [BigInt(0), BigInt(-1), BigInt("9007199254740992"), 100 as unknown as bigint]) {
      expect(() => normalizeCreditFacilityProposal(proposal({ limitFen }))).toThrow("credit_input_invalid");
    }
    expect(() => normalizeCreditFacilityProposal(proposal({ validUntil: new Date("x") }))).toThrow("credit_input_invalid");
    expect(() => normalizeCreditFacilityProposal(proposal({ operationKey: "has space" }))).toThrow("credit_input_invalid");
    expect(() => normalizeCreditFacilityProposal(proposal({ actorUserId: "" }))).toThrow("credit_forbidden");
  });
});

describe("credit draw journal shape", () => {
  it("accepts only debit credit_receivable / credit wallet, and only through the credit module", () => {
    expect(normalizeFundsPosting(draw(), null, true).entries.map(e => [e.account, e.direction])).toEqual([
      ["credit_receivable", "debit"], ["customer_wallet_available", "credit"]]);
    expect(() => normalizeFundsPosting(draw())).toThrow("funds_accounts_not_allowed"); // public posting path
    expect(() => normalizeFundsPosting({ ...draw(), kind: "topup" }, null, true)).toThrow("funds_accounts_not_allowed");
    const reversed = draw({ entries: [{ account: "credit_receivable", direction: "credit", amountFen: BigInt(300) },
      { account: "customer_wallet_available", direction: "debit", amountFen: BigInt(300) }] });
    expect(() => normalizeFundsPosting(reversed, null, true)).toThrow("funds_accounts_not_allowed");
    // A correction cannot touch the receivable either.
    expect(() => normalizeFundsPosting({ ...draw(), kind: "correction" })).toThrow("funds_accounts_not_allowed");
  });
});
