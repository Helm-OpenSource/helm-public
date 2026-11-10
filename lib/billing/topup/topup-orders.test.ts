import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { FundsRefusal, isRetryableFundsConflict, runFundsTransactionWithRetry } from "../funds/funds-journal";
import { observeAlipayTrade, observeWeChatPayTransaction, yuanToFenExact, type ObservedPayment } from "./provider-observation";
import { createTopupOrder, nextUnpaidState, verifyTopupPaymentInTransaction } from "./topup-orders";

const refs = (mch: string, app: string) => (mch === "mch-1" && app === "app-1" ? { merchantRef: "merchant:a", appRef: "app:a" } : null);
const ctx = { source: "callback" as const, signatureValid: true, refs };
const orderNo = `tpw_${"a".repeat(28)}`;
const observed = (patch: Partial<ObservedPayment> = {}): ObservedPayment => ({ source: "callback", signatureValid: true,
  merchantRef: "merchant:a", appRef: "app:a", providerOrderNo: orderNo, providerTxnId: "4200001", status: "paid",
  amountFen: BigInt(100), currency: "CNY", ...patch });
const known = (code: string, meta?: object) => new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test", meta });

describe("provider observations", () => {
  it("maps WeChat Pay transactions, treating unlisted states and bad amounts as unknown/null", () => {
    const paid = observeWeChatPayTransaction({ mchid: "mch-1", appid: "app-1", out_trade_no: orderNo, transaction_id: "42",
      trade_state: "SUCCESS", amount: { total: 1234, currency: "CNY" } }, ctx);
    expect(paid).toMatchObject({ status: "paid", amountFen: BigInt(1234), merchantRef: "merchant:a", providerTxnId: "42" });
    expect(observeWeChatPayTransaction({ trade_state: "REFUND", mchid: "x", amount: { total: 1.5 } }, ctx))
      .toMatchObject({ status: "unknown", amountFen: null, merchantRef: null, providerTxnId: null });
    expect(observeWeChatPayTransaction({ trade_state: "toString" }, ctx).status).toBe("unknown");
    expect(observeWeChatPayTransaction({ trade_state: "CLOSED" }, ctx).status).toBe("closed");
  });
  it("maps Alipay trades with exact yuan parsing and CNY only when no currency is stated", () => {
    expect(observeAlipayTrade({ seller_id: "mch-1", app_id: "app-1", trade_status: "TRADE_SUCCESS", total_amount: "12.30",
      trade_no: "2026", out_trade_no: orderNo }, ctx)).toMatchObject({ status: "paid", amountFen: BigInt(1230), currency: "CNY" });
    expect(observeAlipayTrade({ trade_status: "WAIT_BUYER_PAY", trans_currency: "USD" }, ctx))
      .toMatchObject({ status: "not_paid", currency: "USD", amountFen: null });
    for (const bad of ["1.234", "-1", "01", "1e2", " 1", "0", "0.00", "", undefined]) expect(yuanToFenExact(bad)).toBeNull();
    expect(yuanToFenExact("0.01")).toBe(BigInt(1));
    expect(yuanToFenExact("7.5")).toBe(BigInt(750));
  });
});

describe("top-up state rules", () => {
  it("never moves a paid or closed order and never closes by time", () => {
    expect(nextUnpaidState("paid_verified", "closed")).toBe("paid_verified");
    expect(nextUnpaidState("closed_unpaid", "unknown")).toBe("closed_unpaid");
    expect(nextUnpaidState("pending", "closed")).toBe("closed_unpaid");
    expect(nextUnpaidState("pending", "unknown")).toBe("unknown");
    expect(nextUnpaidState("unknown", "not_paid")).toBe("unknown");
    expect(nextUnpaidState("created", "not_paid")).toBe("pending");
  });
  it.each([
    [{ signatureValid: false }, "topup_signature_invalid"], [{ signatureValid: "true" as unknown as boolean }, "topup_signature_invalid"],
    [{ providerOrderNo: "helm_wx_ws_20261110" }, "topup_order_unknown"], [{ providerTxnId: null }, "topup_observation_invalid"],
    [{ amountFen: 100 as unknown as bigint }, "topup_observation_invalid"], [{ status: "refunded" as "paid" }, "topup_observation_invalid"],
  ])("refuses %o before any database read", async (patch, code) => {
    const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() };
    await expect(verifyTopupPaymentInTransaction(tx as unknown as Prisma.TransactionClient,
      { provider: "wechat_pay", observed: observed(patch) })).rejects.toThrow(code);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it("refuses out-of-range amounts before opening a transaction", async () => {
    const client = { $transaction: vi.fn() } as unknown as PrismaClient;
    for (const amountFen of [BigInt(99), BigInt(5_000_001), 100 as unknown as bigint]) {
      await expect(createTopupOrder(client, { actorUserId: "u", workspaceId: "w", provider: "alipay", amountFen,
        merchantRef: "m", appRef: "a" })).rejects.toThrow("topup_amount_out_of_range");
    }
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe("funds write conflicts", () => {
  it("classifies deadlocks and same-key insert races as retryable, nothing else", () => {
    expect(isRetryableFundsConflict(known("P2034"))).toBe(true);
    expect(isRetryableFundsConflict(known("P2010", { code: "1213" }))).toBe(true);
    expect(isRetryableFundsConflict(new FundsRefusal("funds_write_conflict"))).toBe(true);
    expect(isRetryableFundsConflict(known("P2010", { code: "1205" }))).toBe(false);
    expect(isRetryableFundsConflict(new FundsRefusal("funds_insufficient"))).toBe(false);
    expect(isRetryableFundsConflict(new Error("Deadlock found"))).toBe(false);
  });
  it("retries a bounded number of times, then refuses with the typed code", async () => {
    const deadlock = { $transaction: vi.fn(async () => { throw known("P2034"); }) };
    await expect(runFundsTransactionWithRetry(deadlock as unknown as PrismaClient, async () => 1, 3))
      .rejects.toMatchObject({ code: "funds_write_conflict" });
    expect(deadlock.$transaction).toHaveBeenCalledTimes(3);
    let calls = 0;
    const flaky = { $transaction: vi.fn(async () => { calls += 1; if (calls === 1) throw known("P2034"); return "ok"; }) };
    await expect(runFundsTransactionWithRetry(flaky as unknown as PrismaClient, async () => "ok")).resolves.toBe("ok");
    const other = { $transaction: vi.fn(async () => { throw new FundsRefusal("funds_insufficient"); }) };
    await expect(runFundsTransactionWithRetry(other as unknown as PrismaClient, async () => 1)).rejects.toThrow("funds_insufficient");
    expect(other.$transaction).toHaveBeenCalledTimes(1);
  });
});
