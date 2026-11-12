import { db } from "@/lib/db";
import { resolveAlipayTopup } from "@/lib/billing/topup/alipay-topup";
import { queryAndRead, topupJson, withTopupSessionOrder } from "@/lib/billing/topup/topup-order-http";
import { claimTopupOrderQuery, readTopupOrderForSession } from "@/lib/billing/topup/topup-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-d2b: "refresh status" re-queries Alipay for the order's original number through the single verification entry
// (credits once if paid). Throttled per order (10 s, 30 an hour); a credited, too old or non-queryable order is returned as is.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const config = resolveAlipayTopup("query");
  if (config === "off") return new Response("Not Found", { status: 404 });
  if (config === "unavailable") return topupJson({ error: "topup_unavailable" }, 503);
  return withTopupSessionOrder(params, async input => {
    const { query } = await claimTopupOrderQuery(db, { ...input, purpose: "query" });
    if (!query) return topupJson({ order: await readTopupOrderForSession(db, input), queried: false, queryError: null });
    return topupJson({ ...(await queryAndRead(config, input)), queried: true });
  });
}
