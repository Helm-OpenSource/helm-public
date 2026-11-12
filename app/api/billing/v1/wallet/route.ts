import { NextResponse } from "next/server";
import { getCurrentWorkspaceSessionOrNull } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getWalletInTransaction } from "@/lib/billing/wallet/wallet";

export const runtime = "nodejs";

// Billing V1 S2-c: read-only wallet for the session's workspace (OWNER/BILLING_ADMIN). The payer is resolved server-side.
const STATUS: Record<string, number> = { wallet_forbidden: 403, wallet_query_invalid: 400, payer_unresolved: 404,
  payer_account_unavailable: 404 };

export async function GET(request: Request) {
  const session = await getCurrentWorkspaceSessionOrNull();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? undefined : /^[1-9][0-9]{0,2}$/.test(rawLimit) ? Number(rawLimit) : Number.NaN;
  try {
    const wallet = await db.$transaction(tx => getWalletInTransaction(tx, { workspaceId: session.workspace.id,
      actorUserId: session.user.id, cursor: params.get("cursor"), limit }), { maxWait: 5000, timeout: 10000 });
    return NextResponse.json(wallet, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (Object.hasOwn(STATUS, code)) return NextResponse.json({ error: code }, { status: STATUS[code] });
    return NextResponse.json({ error: "WALLET_READ_FAILED" }, { status: 500 });
  }
}
