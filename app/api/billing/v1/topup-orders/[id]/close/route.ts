import { db } from "@/lib/db";
import { closeAlipayTopupTrade, resolveAlipayTopup } from "@/lib/billing/topup/alipay-topup";
import { queryAndRead, topupJson, withTopupSessionOrder } from "@/lib/billing/topup/topup-order-http";
import { claimTopupOrderQuery, readTopupOrderForSession } from "@/lib/billing/topup/topup-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-d2b: close a waiting order at Alipay (alipay.trade.close), then record whatever Alipay reports through the query
// path: the local state moves to closed_unpaid only when the provider confirms it, and a late success still credits once.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = resolveAlipayTopup("query");
  if (config === "off") return new Response("Not Found", { status: 404 });
  if (config === "unavailable") return topupJson({ error: "topup_unavailable" }, 503);
  return withTopupSessionOrder(params, async input => {
    const { order, query } = await claimTopupOrderQuery(db, { ...input, purpose: "close" });
    if (!query) return topupJson({ order: await readTopupOrderForSession(db, input), close: null, queryError: null });
    const close = await closeAlipayTopupTrade(config, order.providerOrderNo).catch(() => "close_failed" as const);
    return topupJson({ ...(await queryAndRead(config, input)), close });
  });
}
