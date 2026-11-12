import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alipayDouble } from "./alipay-gateway-fixture";
import { createVerify } from "node:crypto";
import { buildAlipaySignContent } from "@/lib/billing/alipay";
import { ALIPAY_TOPUP_SUBJECT, buildAlipayTopupPayUrl, closeAlipayTopupTrade, createAlipayTopupAdapter, getAlipayTopupConfig, getAlipayTopupConfigProblems,
  handleAlipayTopupNotify, resolveAlipayTopup, topupAppOrigin } from "./alipay-topup";

// Pure adapter and entry checks: no database (a client that throws proves none is reached), no network (gateway double).
const double = alipayDouble();
const config = getAlipayTopupConfig(double.env)!;
const order = "tpa_0123456789abcdef0123456789ab";
const paid = { out_trade_no: order, trade_no: "2026111122001400000000000001", trade_status: "TRADE_SUCCESS", total_amount: "12.30" };
const observe = (body: string) => createAlipayTopupAdapter(config, double.fetch).observeCallback({ headers: {}, rawBody: body });
const noDatabase = new Proxy({}, { get() { throw new Error("database_touched"); } }) as never;
const post = (body: string, headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded; charset=utf-8" }) =>
  handleAlipayTopupNotify(new Request("https://helm.invalid/api/billing/v1/topup-notify/alipay", { method: "POST", headers, body }), noDatabase);

afterEach(() => { vi.unstubAllEnvs(); });

describe("alipay top-up adapter", () => {
  it("needs every key, identifiers and an https gateway", () => {
    expect(config).toMatchObject({ appId: double.env.ALIPAY_APP_ID, sellerId: double.env.HELM_BILLING_TOPUP_ALIPAY_SELLER_ID });
    for (const patch of [{ HELM_BILLING_TOPUP_ALIPAY_SELLER_ID: "" }, { ALIPAY_APP_ID: "x y" }, { ALIPAY_PUBLIC_KEY: "" },
      { ALIPAY_PRIVATE_KEY: "" }, { ALIPAY_GATEWAY_URL: "http://gateway.alipay.invalid/gateway.do" },
      { ALIPAY_PRIVATE_KEY: "bm90LWEta2V5" }, { ALIPAY_PUBLIC_KEY: "bm90LWEta2V5" }]) {
      expect(getAlipayTopupConfig({ ...double.env, ...patch })).toBeNull();
    }
    // Malformed key material is a configuration problem (fixed codes, never values), not a later signing failure.
    expect(getAlipayTopupConfigProblems({ ...double.env, ALIPAY_PRIVATE_KEY: "bm90LWEta2V5", ALIPAY_PUBLIC_KEY: "AAAA" })
      .problems).toEqual(["private_key_invalid", "public_key_invalid"]);
    expect(getAlipayTopupConfigProblems({}).problems).toEqual(["app_id_invalid", "seller_id_invalid", "private_key_invalid",
      "public_key_invalid"]);
  });

  it("is open by default and closes on incomplete merchant configuration with one fixed-code alert", () => {
    const alerts = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(resolveAlipayTopup("create", double.env)).toMatchObject({ appId: double.env.ALIPAY_APP_ID });
      expect(resolveAlipayTopup("create", { ...double.env, HELM_BILLING_TOPUP_ALIPAY_ENABLED: "false" })).toBe("off");
      expect(resolveAlipayTopup("create", { ...double.env, HELM_FINANCIAL_ACTIONS_ENABLED: "false" })).toBe("off");
      expect(alerts).not.toHaveBeenCalled();
      expect(resolveAlipayTopup("create", { ...double.env, HELM_BILLING_TOPUP_ALIPAY_SELLER_ID: "" })).toBe("unavailable");
      expect(alerts).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(alerts.mock.calls[0][1]))).toEqual({ event: "topup_unavailable", reason: "config_unavailable",
        entry: "create", problems: ["seller_id_invalid"] });
      expect(resolveAlipayTopup("notify", { ...double.env, ALIPAY_PRIVATE_KEY: "bm90LWEta2V5" })).toBe("unavailable");
      expect(String(alerts.mock.calls[1][1])).not.toContain("bm90LWEta2V5");
    } finally { alerts.mockRestore(); }
  });

  it("maps a signed notify exactly (yuan to fen, status, configured identity) and refuses forged or ambiguous forms", async () => {
    expect(await observe(double.notify(paid))).toEqual({ source: "callback", merchantRef: `alipay-seller:${config.sellerId}`,
      appRef: `alipay-app:${config.appId}`, providerOrderNo: order, providerTxnId: paid.trade_no, status: "paid",
      amountFen: BigInt(1230), currency: "CNY", refund: null });
    expect((await observe(double.notify({ ...paid, trade_status: "TRADE_CLOSED" }))).status).toBe("closed");
    expect((await observe(double.notify({ ...paid, trade_status: "WAIT_BUYER_PAY" }))).status).toBe("not_paid");
    expect((await observe(double.notify({ ...paid, total_amount: "12.305" }))).amountFen).toBeNull();
    // Another app or seller is not an authentication failure: it maps to no refs (topup_merchant_mismatch downstream).
    expect(await observe(double.notify({ ...paid, app_id: "2021000000000002" }))).toMatchObject({ merchantRef: null, appRef: null });
    expect(await observe(double.notify({ ...paid, seller_id: "2088000000000002" }))).toMatchObject({ merchantRef: null });
    await expect(observe(double.notify(paid, true))).rejects.toThrow("topup_signature_invalid");
    const signed = double.notify(paid);
    await expect(observe(signed.replace("total_amount=12.30", "total_amount=1230.00"))).rejects.toThrow("topup_signature_invalid");
    await expect(observe(`${signed}&trade_status=TRADE_SUCCESS`)).rejects.toThrow("topup_signature_invalid"); // duplicate name
    await expect(observe(signed.replace("sign_type=RSA2", "sign_type=RSA"))).rejects.toThrow("topup_signature_invalid");
    await expect(observe(double.notify({ ...paid, charset: "gbk" }))).rejects.toThrow("topup_signature_invalid");
    // Signed return-page style params (no trade_status) are refused; appended empty values are unsigned and ignored.
    const { trade_status: _status, ...returnPage } = paid;
    await expect(observe(double.notify(returnPage))).rejects.toThrow("topup_signature_invalid");
    expect((await observe(`${double.notify(paid)}&gmt_refund=&trans_currency=`)).status).toBe("paid");
  });

  it("treats refund news as unknown even when the trade status still says success", async () => {
    for (const extra of [{ refund_fee: "1.00" }, { gmt_refund: "2026-11-11 10:00:00" }, { out_biz_no: "refund-1" }]) {
      expect((await observe(double.notify({ ...paid, ...extra }))).status).toBe("unknown");
    }
    expect((await observe(double.notify({ ...paid, refund_fee: "0.00" }))).status).toBe("paid");
    // P2-B: the refund amount (fen), batch and time travel with the observation into reconciliation records.
    expect((await observe(double.notify({ ...paid, refund_fee: "2.50", out_biz_no: "refund-batch-1", gmt_refund: "2026-11-12 10:00:00.000" })))
      .refund).toEqual({ amountFen: "250", batchRef: "refund-batch-1", at: "2026-11-12 10:00:00.000" });
    expect((await observe(double.notify({ ...paid, out_biz_no: "x".repeat(65) }))).refund).toEqual({ amountFen: null, batchRef: null, at: null });
  });

  it("queries with a signed request and keeps the amount only from a verified response node", async () => {
    const adapter = createAlipayTopupAdapter(config, double.fetch);
    double.trades.set(order, { code: "10000", msg: "Success", ...paid, total_amount: "12.30", note: "a \"quoted\" } brace" });
    expect(await adapter.queryOrder(order)).toMatchObject({ source: "query", status: "paid", amountFen: BigInt(1230),
      merchantRef: `alipay-seller:${config.sellerId}`, appRef: `alipay-app:${config.appId}` });
    expect(JSON.parse(double.requests.at(-1)!.biz_content)).toEqual({ out_trade_no: order });
    expect(double.requests.at(-1)).toMatchObject({ app_id: config.appId, method: "alipay.trade.query", sign_type: "RSA2" });
    double.setTamper(true);
    await expect(adapter.queryOrder(order)).rejects.toThrow("query_signature_invalid");
    double.setTamper(false);
    double.trades.set(order, { code: "10000", ...paid, seller_id: "2088000000000002" });
    expect((await adapter.queryOrder(order)).merchantRef).toBeNull();
    expect(await adapter.queryOrder("tpa_ffffffffffffffffffffffffffff")).toMatchObject({ status: "not_paid", providerTxnId: null });
    double.trades.set(order, { code: "20000", msg: "Service Currently Unavailable" });
    await expect(adapter.queryOrder(order)).rejects.toThrow("query_failed");
    double.trades.set(order, { code: "40004", msg: "Business Failed", sub_code: "ACQ.SYSTEM_ERROR" });
    await expect(adapter.queryOrder(order)).rejects.toThrow("query_failed"); // only TRADE_NOT_EXIST means not paid
    double.trades.set(order, { code: "10000", ...paid });
    for (const mode of ["no_sign", "empty_sign", "http_500"] as const) {
      double.setMode(mode);
      await expect(adapter.queryOrder(order)).rejects.toThrow(mode === "http_500" ? "query_unavailable" : "query_signature_invalid");
    }
    double.setMode("ok");
    // The order number comes from the signed response, so verifyTopupByQuery can refuse a mismatch.
    double.trades.set(order, { code: "10000", ...paid, out_trade_no: "tpa_ffffffffffffffffffffffffffff" });
    expect((await adapter.queryOrder(order)).providerOrderNo).toBe("tpa_ffffffffffffffffffffffffffff");
    // The gateway refuses a request not signed by the app's key; nothing unsigned is ever trusted back.
    await expect(createAlipayTopupAdapter({ ...config, privateKey: double.strangerPrivateKey }, double.fetch).queryOrder(order))
      .rejects.toThrow("query_response_invalid");
  });
});

describe("alipay top-up close", () => {
  it("closes a waiting trade with a signed request, reports a trade never created, and refuses anything unverified", async () => {
    double.trades.set(order, { code: "10000", ...paid, trade_status: "WAIT_BUYER_PAY" });
    expect(await closeAlipayTopupTrade(config, order, double.fetch)).toBe("closed");
    expect(double.requests.at(-1)).toMatchObject({ app_id: config.appId, method: "alipay.trade.close", sign_type: "RSA2" });
    expect(JSON.parse(double.requests.at(-1)!.biz_content)).toEqual({ out_trade_no: order });
    expect(double.trades.get(order)?.trade_status).toBe("TRADE_CLOSED");
    await expect(closeAlipayTopupTrade(config, order, double.fetch)).rejects.toThrow("close_failed"); // no longer waiting
    expect(await closeAlipayTopupTrade(config, "tpa_eeeeeeeeeeeeeeeeeeeeeeeeeeee", double.fetch)).toBe("not_created");
    double.trades.set(order, { code: "10000", ...paid, trade_status: "WAIT_BUYER_PAY" });
    double.setMode("empty_sign");
    try { await expect(closeAlipayTopupTrade(config, order, double.fetch)).rejects.toThrow("query_signature_invalid"); }
    finally { double.setMode("ok"); }
    expect(double.trades.get(order)?.trade_status).toBe("TRADE_CLOSED"); // the double closed it; our side saw nothing trusted
    double.closeOverrides.set(order, { code: "10000", msg: "Success", out_trade_no: "tpa_ffffffffffffffffffffffffffff" });
    try { await expect(closeAlipayTopupTrade(config, order, double.fetch)).rejects.toThrow("query_response_invalid"); }
    finally { double.closeOverrides.clear(); }
  });
});

describe("alipay top-up cashier URL", () => {
  it("signs a page.pay request with fixed notify_url, fixed subject, exact amount and no passback_params", () => {
    const expiresAt = new Date("2026-11-12T04:00:00.000Z");
    const url = new URL(buildAlipayTopupPayUrl(config, "https://helm.example.invalid",
      { id: "ord_1", providerOrderNo: order, amountFen: BigInt(1005), expiresAt }, new Date("2026-11-12T02:00:00.000Z")));
    expect(`${url.origin}${url.pathname}`).toBe(double.env.ALIPAY_GATEWAY_URL);
    const params = Object.fromEntries(url.searchParams);
    const { sign, ...signed } = params;
    expect(createVerify("RSA-SHA256").update(buildAlipaySignContent(signed), "utf8").verify(double.appPublicKey, sign, "base64")).toBe(true);
    expect(signed).toMatchObject({ app_id: config.appId, method: "alipay.trade.page.pay", charset: "utf-8", sign_type: "RSA2",
      version: "1.0", timestamp: "2026-11-12 10:00:00", notify_url: "https://helm.example.invalid/api/billing/v1/topup-notify/alipay",
      return_url: "https://helm.example.invalid/billing/topup?order=ord_1" });
    expect(Object.keys(signed).sort()).toEqual(["app_id", "biz_content", "charset", "method", "notify_url", "return_url", "sign_type",
      "timestamp", "version"]);
    expect(JSON.parse(signed.biz_content)).toEqual({ out_trade_no: order, product_code: "FAST_INSTANT_TRADE_PAY", total_amount: "10.05",
      subject: ALIPAY_TOPUP_SUBJECT, time_expire: "2026-11-12 12:00:00" });
    expect(signed.biz_content).not.toContain("passback_params");
  });

  it("takes every browser-facing origin from APP_URL only: https, default port, no credentials or path", () => {
    expect(topupAppOrigin({ APP_URL: "https://helm.example.invalid" })).toBe("https://helm.example.invalid");
    expect(topupAppOrigin({ APP_URL: "https://helm.example.invalid:443/" })).toBe("https://helm.example.invalid");
    for (const APP_URL of [undefined, "", "http://helm.example.invalid", "https://helm.example.invalid:8443",
      "https://someone@helm.example.invalid", "https://helm.example.invalid/app", "https://helm.example.invalid/?x=1"]) {
      expect(topupAppOrigin({ APP_URL })).toBeNull();
    }
    const alerts = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(resolveAlipayTopup("create", { ...double.env, APP_URL: "http://localhost:3000" })).toBe("unavailable");
      expect(resolveAlipayTopup("notify", { ...double.env, APP_URL: "http://localhost:3000" })).toMatchObject({ appId: config.appId });
      expect(JSON.parse(String(alerts.mock.calls[0][1])).problems).toEqual(["app_url_invalid"]);
    } finally { alerts.mockRestore(); }
  });
});

describe("alipay top-up notify entry", () => {
  it("answers non-success when the database fails after verification, so Alipay retries", async () => {
    for (const [key, value] of Object.entries({ ...double.env, HELM_BILLING_TOPUP_ALIPAY_ENABLED: "true", HELM_FINANCIAL_ACTIONS_ENABLED: "true" })) {
      vi.stubEnv(key, value);
    }
    const failing = (error: Error) => ({ $transaction: () => Promise.reject(error) }) as never;
    for (const [error, status] of [[new Error("boom"), 500], [new Prisma.PrismaClientInitializationError("down", "6"), 503]] as const) {
      const response = await handleAlipayTopupNotify(new Request("https://helm.invalid/x", { method: "POST", body: double.notify(paid),
        headers: { "content-type": "application/x-www-form-urlencoded" } }), failing(error));
      expect([response.status, await response.text()]).toEqual([status, "fail"]);
    }
  });

  it("is a plain 404 while either gate is off, before the body or database", async () => {
    for (const env of [{ HELM_BILLING_TOPUP_ALIPAY_ENABLED: "false" }, { HELM_BILLING_TOPUP_ALIPAY_ENABLED: "yes" },
      { HELM_FINANCIAL_ACTIONS_ENABLED: "false" }]) {
      vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", undefined); vi.stubEnv("HELM_FINANCIAL_ACTIONS_ENABLED", undefined);
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      const request = new Request("https://helm.invalid/x", { method: "POST", body: double.notify(paid),
        headers: { "content-type": "application/x-www-form-urlencoded" } });
      const response = await handleAlipayTopupNotify(request, noDatabase);
      expect([response.status, await response.text(), request.bodyUsed]).toEqual([404, "Not Found", false]);
    }
  });

  it("refuses unconfigured, non-form, oversized, non-UTF-8 and unauthenticated bodies without touching the database", async () => {
    vi.stubEnv("HELM_BILLING_TOPUP_ALIPAY_ENABLED", undefined); vi.stubEnv("HELM_FINANCIAL_ACTIONS_ENABLED", undefined);
    for (const key of Object.keys(double.env)) vi.stubEnv(key, undefined);
    const alerts = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unconfigured = await post(double.notify(paid)); // gates default open, ALIPAY_* not configured: closed, nothing read
    expect([unconfigured.status, await unconfigured.text(), alerts.mock.calls.length]).toEqual([503, "fail", 1]);
    alerts.mockRestore();
    for (const [key, value] of Object.entries(double.env)) vi.stubEnv(key, value);
    expect((await post(double.notify(paid), { "content-type": "application/json" })).status).toBe(415);
    expect((await post(`${double.notify(paid)}&pad=${"x".repeat(16_384)}`)).status).toBe(413);
    const declared = await post(double.notify(paid), { "content-type": "application/x-www-form-urlencoded", "content-length": "16385" });
    expect(declared.status).toBe(413); // refused on the declared length alone, before streaming
    // Signed over U+FFFD but sent as a raw invalid byte: only strict decoding refuses it before the database.
    const signedReplacement = Buffer.from(double.notify({ ...paid, subject: "\uFFFD" }));
    const at = signedReplacement.indexOf("%EF%BF%BD");
    const invalidUtf8 = new Request("https://helm.invalid/x", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: Buffer.concat([signedReplacement.subarray(0, at), Buffer.from([0xff]), signedReplacement.subarray(at + 9)]) });
    expect((await handleAlipayTopupNotify(invalidUtf8, noDatabase)).status).toBe(400);
    const forged = await post(double.notify(paid, true));
    expect([forged.status, await forged.text()]).toEqual([400, "fail"]);
    // A subscription order number is refused before any transaction, even when genuinely signed.
    expect((await post(double.notify({ ...paid, out_trade_no: "helm_ali_synthetic_20261111" }))).status).toBe(400);
  });
});
