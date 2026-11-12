import { db } from "@/lib/db";
import { alipayTopupGateOpen, resolveAlipayTopup } from "@/lib/billing/topup/alipay-topup";
import { queryAndRead, topupJson, withTopupSessionOrder } from "@/lib/billing/topup/topup-order-http";
import { claimTopupOrderQuery, readTopupOrderForSession } from "@/lib/billing/topup/topup-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-d2b: "refresh status" re-queries the order's provider for its original number through the single verification entry
// (credits once if paid). Throttled per order (10 s, 30 an hour); a credited, too old or non-queryable order is returned as is.
// The session is checked before the configuration, so unsigned requests cannot fill the log with configuration alerts.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!alipayTopupGateOpen()) return new Response("Not Found", { status: 404 });
  return withTopupSessionOrder(params, async input => {
    const config = resolveAlipayTopup("query");
    if (typeof config === "string") return topupJson({ error: "topup_unavailable" }, 503);
    // Only Alipay orders are queried here; another provider's order never reaches Alipay (it waits for that provider's slice).
    const { query } = await claimTopupOrderQuery(db, { ...input, purpose: "query", provider: "alipay" });
    if (!query) return topupJson({ order: await readTopupOrderForSession(db, input), queried: false, queryError: null });
    return topupJson({ ...(await queryAndRead(config, input)), queried: true });
  });
}
