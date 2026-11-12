import { handleWeChatPayTopupNotify } from "@/lib/billing/topup/wechatpay-topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-w1: WeChat Pay wallet top-up notify (tpw_ orders only); on by default (HELM_BILLING_TOPUP_WECHATPAY_ENABLED="false"
// answers 404) and fails closed (503) until every WECHAT_PAY_* key and the public key id are configured.
export function POST(request: Request) {
  return handleWeChatPayTopupNotify(request);
}
