import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { weChatPayDouble } from "./wechatpay-gateway-fixture";
import { createWeChatPayTopupAdapter, getWeChatPayTopupConfig, handleWeChatPayTopupNotify } from "./wechatpay-topup";

// Pure adapter and entry checks: no database (a client that throws proves none is reached), no network (API double).
const double = weChatPayDouble();
const config = getWeChatPayTopupConfig(double.env)!;
const order = "tpw_0123456789abcdef0123456789ab";
const paid = { out_trade_no: order, transaction_id: "4200000000202611120000000001", trade_type: "NATIVE", trade_state: "SUCCESS",
  amount: { total: 1230, payer_total: 1230, currency: "CNY", payer_currency: "CNY" } };
const adapter = createWeChatPayTopupAdapter(config, double.fetch);
const observe = ({ body, headers }: { body: string; headers: Record<string, string> }) => adapter.observeCallback({ headers, rawBody: body });
const noDatabase = new Proxy({}, { get() { throw new Error("database_touched"); } }) as never;
const post = ({ body, headers }: { body: string; headers: Record<string, string> }, client = noDatabase) =>
  handleWeChatPayTopupNotify(new Request("https://helm.invalid/api/billing/v1/topup-notify/wechatpay", { method: "POST", headers, body }), client);
const enable = () => { vi.stubEnv("HELM_BILLING_TOPUP_WECHATPAY_ENABLED", "true"); vi.stubEnv("HELM_FINANCIAL_ACTIONS_ENABLED", "true"); };

afterEach(() => { vi.unstubAllEnvs(); double.setMode("ok"); });

describe("wechat pay top-up adapter", () => {
  it("needs every key, a public key id and a 32-byte APIv3 key", () => {
    expect(config).toMatchObject({ appId: double.env.WECHAT_PAY_APP_ID, merchantId: double.env.WECHAT_PAY_MERCHANT_ID });
    for (const patch of [{ WECHAT_PAY_APP_ID: "" }, { WECHAT_PAY_MERCHANT_ID: "12 3" }, { WECHAT_PAY_MERCHANT_SERIAL_NO: "" },
      { WECHAT_PAY_PRIVATE_KEY: "" }, { WECHAT_PAY_PLATFORM_PUBLIC_KEY: "" }, { WECHAT_PAY_API_V3_KEY: "short" },
      { HELM_BILLING_TOPUP_WECHATPAY_PUBLIC_KEY_ID: "" }, { HELM_BILLING_TOPUP_WECHATPAY_PUBLIC_KEY_ID: "4DF076AC00000000" }]) {
      expect(getWeChatPayTopupConfig({ ...double.env, ...patch })).toBeNull();
    }
  });

  it("maps a verified, decrypted notify exactly (fen, status, configured identity)", async () => {
    expect(await observe(double.notify(paid))).toEqual({ source: "callback", merchantRef: `wechatpay-mch:${config.merchantId}`,
      appRef: `wechatpay-app:${config.appId}`, providerOrderNo: order, providerTxnId: paid.transaction_id, status: "paid",
      amountFen: BigInt(1230), currency: "CNY" });
    expect((await observe(double.notify({ ...paid, trade_state: "CLOSED" }))).status).toBe("closed");
    expect((await observe(double.notify({ ...paid, trade_state: "NOTPAY" }))).status).toBe("not_paid");
    expect((await observe(double.notify({ ...paid, trade_state: "REFUND" }))).status).toBe("unknown");
    expect((await observe(double.notify(paid, { eventType: "TRANSACTION.OTHER" }))).status).toBe("unknown");
    expect((await observe(double.notify({ ...paid, amount: { total: 12.3, currency: "CNY" } }))).amountFen).toBeNull();
    // Another merchant or app is not an authentication failure: it maps to no refs (topup_merchant_mismatch downstream).
    expect(await observe(double.notify({ ...paid, mchid: "1230000110" }))).toMatchObject({ merchantRef: null, appRef: null });
    expect(await observe(double.notify({ ...paid, appid: "wx0000000000000002" }))).toMatchObject({ appRef: null });
  });

  it("refuses forged, re-signed-elsewhere, tampered, probe and incomplete signatures", async () => {
    const signed = double.notify(paid);
    const refused = async (input: { body: string; headers: Record<string, string> }) =>
      expect(observe(input)).rejects.toThrow("topup_signature_invalid");
    await refused(double.notify(paid, { forge: true }));
    await refused(double.notify(paid, { serial: "PUB_KEY_ID_0000000000000000000000000000000002" })); // unknown key id
    await refused(double.notify(paid, { serial: "4DF076AC00000000000000000000000000000000" })); // platform-certificate mode unsupported
    await refused({ ...signed, body: signed.body.replace("TRANSACTION.SUCCESS", "TRANSACTION.SUCCESS ") });
    await refused({ ...signed, headers: { ...signed.headers, "wechatpay-signature": `WECHATPAY/SIGNTEST/${signed.headers["wechatpay-signature"]}` } });
    for (const name of ["wechatpay-timestamp", "wechatpay-nonce", "wechatpay-signature", "wechatpay-serial"]) {
      const { [name]: _drop, ...rest } = signed.headers;
      await refused({ ...signed, headers: rest });
    }
  });

  it("checks the timestamp window in both directions before the signature", async () => {
    expect((await observe(double.notify(paid, { skewSeconds: -290 }))).status).toBe("paid");
    expect((await observe(double.notify(paid, { skewSeconds: 290 }))).status).toBe("paid");
    await expect(observe(double.notify(paid, { skewSeconds: -301 }))).rejects.toThrow("topup_signature_invalid");
    await expect(observe(double.notify(paid, { skewSeconds: 301 }))).rejects.toThrow("topup_signature_invalid");
  });

  it("refuses resources it cannot decrypt or that are not AEAD transactions", async () => {
    const refused = (options: Parameters<typeof double.notify>[1]) => expect(observe(double.notify(paid, options))).rejects.toThrow("topup_signature_invalid");
    await refused({ apiV3Key: "f".repeat(32) }); // sealed with another key
    await refused({ resource: r => ({ ...r, associated_data: "other" }) });
    await refused({ resource: r => ({ ...r, nonce: "000000000000" }) });
    await refused({ resource: r => ({ ...r, ciphertext: Buffer.from(Buffer.from(r.ciphertext, "base64").map((b, i) => (i === 0 ? b ^ 1 : b))).toString("base64") }) });
    await refused({ resource: r => ({ ...r, algorithm: "AEAD_AES_128_GCM" }) });
    await refused({ resource: r => ({ ...r, original_type: "refund" }) });
  });

  it("queries with a signed request and trusts only a verified answer", async () => {
    double.trades.set(order, { appid: config.appId, mchid: config.merchantId, ...paid });
    expect(await adapter.queryOrder(order)).toMatchObject({ source: "query", status: "paid", amountFen: BigInt(1230),
      merchantRef: `wechatpay-mch:${config.merchantId}`, providerTxnId: paid.transaction_id });
    expect(double.requests.at(-1)?.url).toBe(`https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/${order}?mchid=${config.merchantId}`);
    expect(double.requests.at(-1)?.authorization).toContain(`serial_no="${config.merchantSerialNo}"`);
    for (const [mode, message] of [["tamper", "query_signature_invalid"], ["unsigned", "query_signature_invalid"], ["http_500", "query_failed"]] as const) {
      double.setMode(mode);
      await expect(adapter.queryOrder(order)).rejects.toThrow(message);
    }
    double.setMode("ok");
    double.trades.set(order, { appid: config.appId, mchid: "1230000110", ...paid});
    expect((await adapter.queryOrder(order)).merchantRef).toBeNull();
    expect(await adapter.queryOrder("tpw_ffffffffffffffffffffffffffff")).toMatchObject({ status: "not_paid", providerTxnId: null });
    // The API refuses a request not signed by the merchant key (401 SIGN_ERROR): never a not-paid or paid observation.
    await expect(createWeChatPayTopupAdapter({ ...config, privateKey: double.strangerPrivateKey }, double.fetch).queryOrder(order))
      .rejects.toThrow("query_failed");
  });
});

describe("wechat pay top-up notify entry", () => {
  it("is a plain 404 while either gate is off, before the body or database", async () => {
    for (const env of [{}, { HELM_BILLING_TOPUP_WECHATPAY_ENABLED: "yes" }, { HELM_BILLING_TOPUP_WECHATPAY_ENABLED: "true", HELM_FINANCIAL_ACTIONS_ENABLED: "false" }]) {
      vi.stubEnv("HELM_BILLING_TOPUP_WECHATPAY_ENABLED", undefined); vi.stubEnv("HELM_FINANCIAL_ACTIONS_ENABLED", undefined);
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      const { body, headers } = double.notify(paid);
      const request = new Request("https://helm.invalid/x", { method: "POST", headers, body });
      const response = await handleWeChatPayTopupNotify(request, noDatabase);
      expect([response.status, await response.text(), request.bodyUsed]).toEqual([404, "Not Found", false]);
    }
  });

  it("refuses unconfigured, non-JSON, oversized and unauthenticated bodies without touching the database", async () => {
    enable();
    expect((await post(double.notify(paid))).status).toBe(503); // WECHAT_PAY_* not configured
    for (const [key, value] of Object.entries(double.env)) vi.stubEnv(key, value);
    const signed = double.notify(paid);
    expect((await post({ ...signed, headers: { ...signed.headers, "content-type": "application/x-www-form-urlencoded" } })).status).toBe(415);
    expect((await post(double.notify({ ...paid, pad: "x".repeat(16_384) }))).status).toBe(413);
    const forged = await post(double.notify(paid, { forge: true }));
    expect([forged.status, await forged.json()]).toEqual([400, { code: "FAIL", message: "失败" }]);
    expect((await post(double.notify(paid, { skewSeconds: -400 }))).status).toBe(400);
    // A subscription order number is refused before any transaction, even when genuinely signed.
    expect((await post(double.notify({ ...paid, out_trade_no: "helm_wx_synthetic_20261112" }))).status).toBe(400);
  });

  it("answers failure when the database fails after verification, so WeChat Pay retries", async () => {
    enable();
    for (const [key, value] of Object.entries(double.env)) vi.stubEnv(key, value);
    const failing = (error: Error) => ({ $transaction: () => Promise.reject(error) }) as never;
    for (const [error, status] of [[new Error("boom"), 500], [new Prisma.PrismaClientInitializationError("down", "6"), 503]] as const) {
      expect((await post(double.notify(paid), failing(error))).status).toBe(status);
    }
  });
});
