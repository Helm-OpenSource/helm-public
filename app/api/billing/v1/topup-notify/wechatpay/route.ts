import { handleWeChatPayTopupNotify } from "@/lib/billing/topup/wechatpay-topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-w1: WeChat Pay wallet top-up notify (tpw_ orders only); off unless HELM_BILLING_TOPUP_WECHATPAY_ENABLED=true.
export function POST(request: Request) {
  return handleWeChatPayTopupNotify(request);
}
