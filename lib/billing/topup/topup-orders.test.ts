import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { FundsRefusal, isRetryableFundsConflict, runFundsTransactionWithRetry } from "../funds/funds-journal";
import { observeAlipayTrade, observeWeChatPayTransaction, yuanToFenExact, type ObservedPayment } from "./provider-observation";
import { createTopupOrder, defineTopupProviderAdapter, nextUnpaidState, verifyTopupCallback } from "./topup-orders";

const refs = (mch: string, app: string) => (mch === "mch-1" && app === "app-1" ? { merchantRef: "merchant:a", appRef: "app:a" } : null);
const ctx = { source: "callback" as const, refs };
const orderNo = `tpw_${"a".repeat(28)}`;
const trade = { mchid: "mch-1", appid: "app-1", out_trade_no: orderNo, transaction_id: "42", trade_state: "SUCCESS",
  amount: { total: 100, currency: "CNY" } };
const known = (code: string, meta?: object) => new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test", meta });
const db = (client: object) => client as unknown as PrismaClient;

describe("provider observations", () => {
  it("maps WeChat Pay and Alipay trades exactly; unlisted states are unknown", () => {
    expect(observeWeChatPayTransaction(trade, ctx)).toMatchObject({ status: "paid", amountFen: BigInt(100), merchantRef: "merchant:a" });
    expect(observeWeChatPayTransaction({ trade_state: "REFUND", mchid: "x", amount: { total: 1.5 } }, ctx))
      .toMatchObject({ status: "unknown", amountFen: null, merchantRef: null, providerTxnId: null });
    expect(observeWeChatPayTransaction({ trade_state: "toString" }, ctx).status).toBe("unknown");
    expect(observeAlipayTrade({ seller_id: "mch-1", app_id: "app-1", trade_status: "TRADE_SUCCESS", total_amount: "12.30" }, ctx))
      .toMatchObject({ status: "paid", amountFen: BigInt(1230), currency: "CNY" });
    expect(observeAlipayTrade({ trade_status: "TRADE_CLOSED", trans_currency: "USD" }, ctx)).toMatchObject({ status: "closed", currency: "USD" });
    for (const bad of ["1.234", "-1", "01", "1e2", " 1", "0", "0.00", "", undefined]) expect(yuanToFenExact(bad)).toBeNull();
    expect(yuanToFenExact("7.5")).toBe(BigInt(750));
  });
  it("never moves a paid or closed order and never closes by time", () => {
    expect(nextUnpaidState("paid_verified", "closed")).toBe("paid_verified");
    expect(nextUnpaidState("closed_unpaid", "unknown")).toBe("closed_unpaid");
    expect(nextUnpaidState("pending", "closed")).toBe("closed_unpaid");
    expect(nextUnpaidState("unknown", "not_paid")).toBe("unknown");
    expect(nextUnpaidState("created", "not_paid")).toBe("pending");
  });
});

describe("top-up trust boundary", () => {
  const adapter = (verifyCallback: () => Promise<unknown>) => defineTopupProviderAdapter("wechat_pay",
    { refs, verifyCallback, queryOrder: async () => trade });
  const request = { headers: {}, rawBody: "{}" };
  it("refuses hand-built observations, failed authentication and malformed trades before any transaction", async () => {
    const client = { $transaction: vi.fn() };
    const handMade = { ...observeWeChatPayTransaction(trade, ctx) } as ObservedPayment;
    const forged = { provider: "wechat_pay" as const, observeCallback: async () => handMade, queryOrder: async () => handMade };
    await expect(verifyTopupCallback(db(client), forged, request)).rejects.toThrow("topup_observation_untrusted");
    await expect(verifyTopupCallback(db(client), adapter(async () => { throw new Error("bad signature"); }), request)).rejects.toThrow("topup_signature_invalid");
    await expect(verifyTopupCallback(db(client), adapter(async () => ({ ...trade, out_trade_no: "helm_wx_ws_1" })), request)).rejects.toThrow("topup_order_unknown");
    await expect(verifyTopupCallback(db(client), adapter(async () => ({ ...trade, transaction_id: "" })), request)).rejects.toThrow("topup_observation_invalid");
    await expect(verifyTopupCallback(db(client), adapter(async () => "text"), request)).rejects.toThrow("topup_observation_invalid");
    expect(client.$transaction).not.toHaveBeenCalled();
    const minted = await adapter(async () => trade).observeCallback(request);
    expect(() => { (minted as { amountFen: bigint | null }).amountFen = BigInt(1); }).toThrow(TypeError); // frozen
  });
  it("refuses out-of-range amounts before opening a transaction", async () => {
    const client = { $transaction: vi.fn() };
    for (const amountFen of [BigInt(99), BigInt(5_000_001), 100 as unknown as bigint]) {
      await expect(createTopupOrder(db(client), { actorUserId: "u", workspaceId: "w", provider: "alipay", amountFen,
        merchantRef: "m", appRef: "a" })).rejects.toThrow("topup_amount_out_of_range");
    }
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe("funds write conflicts", () => {
  it("retries only deadlocks and same-key insert races, a bounded number of times", async () => {
    expect([known("P2034"), known("P2010", { code: "1213" }), new FundsRefusal("funds_write_conflict")].map(isRetryableFundsConflict)).toEqual([true, true, true]);
    expect([known("P2010", { code: "1205" }), new FundsRefusal("funds_insufficient"), new Error("Deadlock found")].map(isRetryableFundsConflict)).toEqual([false, false, false]);
    const deadlock = { $transaction: vi.fn(async () => { throw known("P2034"); }) };
    await expect(runFundsTransactionWithRetry(db(deadlock), async () => 1, 3)).rejects.toMatchObject({ code: "funds_write_conflict" });
    expect(deadlock.$transaction).toHaveBeenCalledTimes(3);
    let calls = 0;
    const flaky = { $transaction: vi.fn(async () => { calls += 1; if (calls === 1) throw known("P2034"); return "ok"; }) };
    await expect(runFundsTransactionWithRetry(db(flaky), async () => "ok")).resolves.toBe("ok");
    const other = { $transaction: vi.fn(async () => { throw new FundsRefusal("funds_insufficient"); }) };
    await expect(runFundsTransactionWithRetry(db(other), async () => 1)).rejects.toThrow("funds_insufficient");
    expect(other.$transaction).toHaveBeenCalledTimes(1);
  });
});
