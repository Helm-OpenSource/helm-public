import { db } from "@/lib/db";
import { alipayTopupGateOpen } from "@/lib/billing/topup/alipay-topup";
import { topupJson, withTopupSessionOrder } from "@/lib/billing/topup/topup-order-http";
import { readTopupOrderForSession } from "@/lib/billing/topup/topup-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-d2b: read one top-up order of the session's workspace. Read-only, no provider call.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!alipayTopupGateOpen()) return new Response("Not Found", { status: 404 });
  return withTopupSessionOrder(params, async input => topupJson({ order: await readTopupOrderForSession(db, input) }));
}
