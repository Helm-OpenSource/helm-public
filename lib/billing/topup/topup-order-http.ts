import "server-only";
import { NextResponse } from "next/server";
import { getCurrentWorkspaceSessionOrNull } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createAlipayTopupAdapter, type AlipayTopupConfig } from "./alipay-topup";
import { readTopupOrderForSession, TopupRefusal, verifyTopupByQuery } from "./topup-orders";

/**
 * Shared by the three session routes on one top-up order (S2-d2b: status, verify, close). The order must belong to the session's
 * workspace and the caller must be its OWNER/BILLING_ADMIN; anything else reads as an unknown order. Fixed codes only.
 */
const STATUS: Record<string, number> = { topup_forbidden: 403, topup_input_invalid: 404, topup_order_unknown: 404,
  topup_order_not_closable: 409, topup_provider_mismatch: 409, topup_rate_limited: 429 };
export const topupJson = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export type TopupSessionOrder = { actorUserId: string; workspaceId: string; paymentOrderId: string };

export async function withTopupSessionOrder(params: Promise<{ id: string }>, run: (input: TopupSessionOrder) => Promise<Response>) {
  const session = await getCurrentWorkspaceSessionOrNull();
  if (!session) return topupJson({ error: "UNAUTHORIZED" }, 401);
  const { id } = await params;
  try {
    return await run({ actorUserId: session.user.id, workspaceId: session.workspace.id, paymentOrderId: id });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (Object.hasOwn(STATUS, code)) return topupJson({ error: code }, STATUS[code]);
    return topupJson({ error: "TOPUP_ORDER_FAILED" }, 500);
  }
}

/** Runs the active query (lost-notify recovery); a provider or verification failure leaves the order unchanged and is reported. */
export async function queryAndRead(config: AlipayTopupConfig, input: TopupSessionOrder) {
  let queryError: string | null = null;
  try { await verifyTopupByQuery(db, createAlipayTopupAdapter(config), input.paymentOrderId); } catch (error) {
    queryError = error instanceof TopupRefusal ? error.code : "topup_query_unavailable";
  }
  return { order: await readTopupOrderForSession(db, input), queryError };
}
