import { NextResponse } from "next/server";
import { getCurrentWorkspaceSessionOrNull } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { alipayTopupRefs, buildAlipayTopupPayUrl, resolveAlipayTopup, topupAppOrigin } from "@/lib/billing/topup/alipay-topup";
import { createOrReplayTopupOrder } from "@/lib/billing/topup/topup-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Billing V1 S2-d2: create (or replay) a wallet top-up order for the session's workspace and hand back the signed cashier URL.
// The client sends only the provider and the amount in fen; payer, merchant, order number and every signed field are server-side.
const STATUS: Record<string, number> = { topup_input_invalid: 400, topup_amount_out_of_range: 400, topup_forbidden: 403,
  payer_unresolved: 404, payer_account_unavailable: 404, topup_billing_off: 409, topup_idempotency_conflict: 409,
  topup_rate_limited: 429 };
const MAX_BODY_CHARS = 1024;
const json = (body: object, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const config = resolveAlipayTopup("create");
  if (config === "off") return new Response("Not Found", { status: 404 });
  if (config === "unavailable") return json({ error: "topup_unavailable" }, 503); // 充值暂不可用: merchant configuration incomplete
  const session = await getCurrentWorkspaceSessionOrNull();
  if (!session) return json({ error: "UNAUTHORIZED" }, 401);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text();
  let body: unknown;
  try { body = raw.length <= MAX_BODY_CHARS ? JSON.parse(raw) : null; } catch { body = null; }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (input.provider !== "alipay") return json({ error: input.provider === "wechat_pay" ? "topup_provider_unavailable" : "topup_input_invalid" }, 400);
  if (typeof input.amountFen !== "string" || !/^[1-9][0-9]{0,15}$/.test(input.amountFen)) return json({ error: "topup_input_invalid" }, 400);
  const refs = alipayTopupRefs(config)(config.sellerId, config.appId)!;
  try {
    const { order, replayed } = await createOrReplayTopupOrder(db, { actorUserId: session.user.id, workspaceId: session.workspace.id,
      provider: "alipay", amountFen: BigInt(input.amountFen), ...refs, idempotencyKey });
    const open = order.state === "created" || order.state === "pending";
    return json({ order: { id: order.id, provider: order.provider, state: order.state, amountFen: order.amountFen.toString(),
      expiresAt: order.expiresAt.toISOString() }, replayed,
      payUrl: open && order.expiresAt > new Date() ? buildAlipayTopupPayUrl(config, topupAppOrigin()!, order) : null }, replayed ? 200 : 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (Object.hasOwn(STATUS, code)) return json({ error: code }, STATUS[code]);
    return json({ error: "TOPUP_ORDER_CREATE_FAILED" }, 500);
  }
}
