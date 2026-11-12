import { createCipheriv, createSign, createVerify, generateKeyPairSync, randomBytes } from "node:crypto";

/**
 * In-process WeChat Pay APIv3 double for tests: per-run RSA key pairs and APIv3 key (never written to disk), signed and
 * AEAD-encrypted notifies, and a fetch stand-in for the order query API that checks the merchant request signature and
 * answers signed responses. Identifiers are synthetic (documentation-style examples), never a real merchant. No network.
 */
export function weChatPayDouble() {
  const pem = () => generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const merchant = pem(), wechat = pem(), stranger = pem();
  const env = { WECHAT_PAY_APP_ID: "wx0000000000000001", WECHAT_PAY_MERCHANT_ID: "1230000109",
    WECHAT_PAY_MERCHANT_SERIAL_NO: "00000000000000000000000000000000000000A1", WECHAT_PAY_PRIVATE_KEY: merchant.privateKey,
    WECHAT_PAY_PLATFORM_PUBLIC_KEY: wechat.publicKey, WECHAT_PAY_API_V3_KEY: randomBytes(16).toString("hex"),
    HELM_BILLING_TOPUP_WECHATPAY_PUBLIC_KEY_ID: "PUB_KEY_ID_0000000000000000000000000000000001" };
  const signHeaders = (body: string, options: { key?: string; skewSeconds?: number; serial?: string } = {}) => {
    const timestamp = String(Math.floor(Date.now() / 1000) + (options.skewSeconds ?? 0)), nonce = randomBytes(16).toString("hex");
    const signature = createSign("RSA-SHA256").update(`${timestamp}\n${nonce}\n${body}\n`, "utf8").sign(options.key ?? wechat.privateKey, "base64");
    return { "wechatpay-timestamp": timestamp, "wechatpay-nonce": nonce, "wechatpay-signature": signature,
      "wechatpay-serial": options.serial ?? env.HELM_BILLING_TOPUP_WECHATPAY_PUBLIC_KEY_ID };
  };
  const encrypt = (plain: string, apiV3Key = env.WECHAT_PAY_API_V3_KEY, associated_data = "transaction") => {
    const nonce = randomBytes(6).toString("hex"); // 12-character nonce
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(apiV3Key, "utf8"), Buffer.from(nonce, "utf8")).setAAD(Buffer.from(associated_data));
    const sealed = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
    return { algorithm: "AEAD_AES_256_GCM", ciphertext: sealed.toString("base64"), associated_data, original_type: "transaction", nonce };
  };
  type NotifyOptions = { forge?: boolean; skewSeconds?: number; serial?: string; eventType?: string; apiV3Key?: string; aad?: string;
    resource?: (resource: ReturnType<typeof encrypt>) => Record<string, unknown> };
  /** A notify as WeChat Pay sends it: JSON body with an encrypted transaction, signed headers over the exact body. */
  const notify = (trade: Record<string, unknown>, options: NotifyOptions = {}) => {
    const resource = encrypt(JSON.stringify({ appid: env.WECHAT_PAY_APP_ID, mchid: env.WECHAT_PAY_MERCHANT_ID, ...trade }), options.apiV3Key, options.aad);
    const body = JSON.stringify({ id: randomBytes(8).toString("hex"), create_time: "2026-11-12T10:00:00+08:00", resource_type: "encrypt-resource",
      event_type: options.eventType ?? "TRANSACTION.SUCCESS", summary: "支付成功", resource: options.resource?.(resource) ?? resource });
    return { body, headers: { "content-type": "application/json", ...signHeaders(body, { key: options.forge ? stranger.privateKey : undefined,
      skewSeconds: options.skewSeconds, serial: options.serial }) } };
  };
  const trades = new Map<string, Record<string, unknown>>();
  const requests: Array<{ url: string; authorization: string }> = [];
  let mode: "ok" | "tamper" | "unsigned" | "http_500" = "ok";
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = new URL(String(url));
    if (target.origin !== "https://api.mch.weixin.qq.com" || init?.method !== "GET") throw new Error("unexpected_request");
    const headers = new Headers(init.headers);
    const authorization = headers.get("authorization") ?? "";
    requests.push({ url: String(url), authorization });
    const field = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(authorization)?.[1] ?? "";
    const signedOk = authorization.startsWith("WECHATPAY2-SHA256-RSA2048 ") && field("mchid") === env.WECHAT_PAY_MERCHANT_ID &&
      createVerify("RSA-SHA256").update(`GET\n${target.pathname}${target.search}\n${field("timestamp")}\n${field("nonce_str")}\n\n`, "utf8")
        .verify(merchant.publicKey, field("signature"), "base64");
    const outTradeNo = decodeURIComponent(target.pathname.split("/").at(-1) ?? "");
    const [status, answer] = !signedOk ? [401, { code: "SIGN_ERROR", message: "签名错误" }]
      : mode === "http_500" ? [500, { code: "SYSTEM_ERROR", message: "系统错误" }]
        : trades.has(outTradeNo) ? [200, trades.get(outTradeNo)] : [404, { code: "ORDER_NOT_EXIST", message: "订单不存在" }];
    const body = JSON.stringify(answer);
    const signed = signHeaders(body);
    const sent = mode === "tamper" ? body.replace(/"total":\d+/, "\"total\":1") : body;
    return new Response(sent, { status, headers: { "content-type": "application/json", ...(mode === "unsigned" ? {} : signed) } });
  }) as typeof globalThis.fetch;
  return { env, notify, signHeaders, fetch, trades, requests, strangerPrivateKey: stranger.privateKey, setMode(value: typeof mode) { mode = value; } };
}
