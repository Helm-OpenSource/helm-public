import { handleAlipayTopupNotify } from "@/lib/billing/topup/alipay-topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-d1: Alipay wallet top-up notify (tpa_ orders only); off unless HELM_BILLING_TOPUP_ALIPAY_ENABLED=true.
export function POST(request: Request) {
  return handleAlipayTopupNotify(request);
}
