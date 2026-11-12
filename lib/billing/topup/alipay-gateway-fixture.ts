import { createSign, createVerify, generateKeyPairSync } from "node:crypto";
import { buildAlipaySignContent } from "@/lib/billing/alipay";

/**
 * In-process Alipay double for tests: per-run RSA key pairs (never written to disk), signed notify bodies, and a fetch
 * stand-in for the gateway that checks the app's request signature and answers signed trade.query responses. No network.
 */
export function alipayDouble() {
  const pem = () => generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const app = pem(), alipay = pem(), stranger = pem();
  const sign = (content: string, key = alipay.privateKey) => createSign("RSA-SHA256").update(content, "utf8").sign(key, "base64");
  const env = { ALIPAY_APP_ID: "2021000000000001", HELM_BILLING_TOPUP_ALIPAY_SELLER_ID: "2088000000000001",
    ALIPAY_PRIVATE_KEY: app.privateKey, ALIPAY_PUBLIC_KEY: alipay.publicKey, ALIPAY_GATEWAY_URL: "https://gateway.alipay.invalid/gateway.do",
    APP_URL: "https://helm.example.invalid" };
  /** Form-encoded notify signed like Alipay (all params but sign/sign_type); `forge` signs with a key Alipay never had. */
  const notify = (params: Record<string, string>, forge = false) => {
    const body = { app_id: env.ALIPAY_APP_ID, seller_id: env.HELM_BILLING_TOPUP_ALIPAY_SELLER_ID, charset: "utf-8",
      notify_type: "trade_status_sync", ...params };
    return new URLSearchParams({ ...body, sign_type: "RSA2", sign: sign(buildAlipaySignContent(body), forge ? stranger.privateKey : alipay.privateKey) }).toString();
  };
  const trades = new Map<string, Record<string, unknown>>();
  const requests: Array<Record<string, string>> = [];
  let tamper = false, mode: "ok" | "no_sign" | "empty_sign" | "http_500" = "ok";
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) !== env.ALIPAY_GATEWAY_URL) throw new Error("unexpected_gateway");
    const form = Object.fromEntries(new URLSearchParams(String(init?.body)));
    requests.push(form);
    const { sign: requestSign, sign_type: _type, ...unsigned } = form;
    if (!createVerify("RSA-SHA256").update(buildAlipaySignContent({ ...unsigned, sign_type: "RSA2" }), "utf8").verify(app.publicKey, requestSign, "base64")) {
      return new Response("{}", { status: 200 });
    }
    const outTradeNo = (JSON.parse(form.biz_content) as { out_trade_no: string }).out_trade_no;
    const node = JSON.stringify(trades.get(outTradeNo) ?? { code: "40004", msg: "Business Failed", sub_code: "ACQ.TRADE_NOT_EXIST" });
    const signature = sign(node);
    const body = tamper ? node.replace(/"total_amount":"[^"]*"/, "\"total_amount\":\"0.01\"") : node;
    const text = mode === "no_sign" ? `{"alipay_trade_query_response":${body}}`
      : `{"alipay_trade_query_response":${body},"sign":"${mode === "empty_sign" ? "" : signature}"}`;
    return new Response(text, { status: mode === "http_500" ? 500 : 200, headers: { "Content-Type": "application/json;charset=utf-8" } });
  }) as typeof globalThis.fetch;
  return { env, notify, fetch, trades, requests, strangerPrivateKey: stranger.privateKey, appPublicKey: app.publicKey, setTamper(value: boolean) { tamper = value; },
    setMode(value: typeof mode) { mode = value; } };
}
