import { db } from "@/lib/db";
import { alipayTopupGateOpen, closeAlipayTopupTrade, resolveAlipayTopup } from "@/lib/billing/topup/alipay-topup";
import { queryAndRead, topupJson, withTopupSessionOrder } from "@/lib/billing/topup/topup-order-http";
import { claimTopupOrderQuery, readTopupOrderForSession } from "@/lib/billing/topup/topup-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-d2b: close a waiting order at its provider (Alipay: alipay.trade.close), then record whatever the provider reports
// through the query path: the local state moves to closed_unpaid only when the provider confirms it, and a late success still
// credits once. `not_created` means nothing was closed (the cashier was never submitted): the order stays payable until it expires.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!alipayTopupGateOpen()) return new Response("Not Found", { status: 404 });
  return withTopupSessionOrder(params, async input => {
    const config = resolveAlipayTopup("query");
    if (typeof config === "string") return topupJson({ error: "topup_unavailable" }, 503);
    const { order, query } = await claimTopupOrderQuery(db, { ...input, purpose: "close", provider: "alipay" });
    if (!query) return topupJson({ order: await readTopupOrderForSession(db, input), close: null, queryError: null });
    const close = await closeAlipayTopupTrade(config, order.providerOrderNo).catch(() => "close_failed" as const);
    return topupJson({ ...(await queryAndRead(config, input)), close });
  });
}
