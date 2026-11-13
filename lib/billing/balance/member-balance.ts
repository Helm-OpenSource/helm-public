import "server-only";
import type { Prisma } from "@prisma/client";
import { canManageWorkspaceBilling } from "@/lib/auth/billing-governance";
import { alipayTopupGateOpen, topupAppOrigin } from "../topup/alipay-topup";
import { buildTopUpUrl } from "../topup/topup-page";
import { readPayerBalanceSummaries, type ArrearsReason, type PayerBalanceSummary, type PayerStatus } from "./balance-status";

/**
 * Billing V1 B-1: the balance one workspace member may see (seat desktop balance, server design §4.4). A narrow read for callers
 * that already authenticated a member (the Overlay device channel): no ledger, no transaction, reservation or payer ids, and
 * no headroom (a stop/go input, never a displayed balance). Read-only and lock-free: the membership statement and the C-BAL
 * summary statement (readPayerBalanceSummaries) are plain reads, so no reserve or settle waits on it.
 *
 * Role rule (written here, as payer-accounts.ts asks of every caller): any ACTIVE, unscoped member of an ACTIVE workspace reads
 * the summary (owner 2026-11-12: the seat client shows the real balance after sign-in); anyone else is `balance_forbidden`.
 * `canTopUp` is the top-up page's own rule (topup-orders.ts, app/(workspace)/billing/topup): OWNER or BILLING_ADMIN, a payer in
 * shadow or enforce, the top-up gate open and APP_URL usable; only then is `topUpUrl` (APP_URL + /billing/topup, no prefill)
 * given. The gate check is the read-only one (alipayTopupGateOpen), as the page uses: incomplete merchant settings make the page
 * say so rather than hide it.
 *
 * Isolation: call it in a READ COMMITTED or REPEATABLE READ transaction (or none). Under SERIALIZABLE, InnoDB turns these plain
 * reads into shared locks on the billing rows and a settle would wait on the reader.
 */
export type MemberBalanceSummary = Pick<PayerBalanceSummary, "billingMode" | "payerStatus" | "balanceFen" | "arrears" | "arrearsReason" | "asOf">;
export type MemberBalanceView = { canTopUp: boolean; topUpUrl: string | null; payer: MemberBalanceSummary | null };
export type { ArrearsReason, PayerStatus };

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
function forbidden(): never { throw new Error("balance_forbidden"); }

export async function readMemberBalanceSummaryInTransaction(tx: Prisma.TransactionClient, query: { workspaceId: string; userId: string },
  env: Readonly<Record<string, string | undefined>> = process.env): Promise<MemberBalanceView> {
  if (typeof query?.workspaceId !== "string" || !REF.test(query.workspaceId) || typeof query.userId !== "string" || !REF.test(query.userId)) forbidden();
  const [member] = await tx.$queryRaw<Array<{ role: string; status: string; accessScope: string | null; workspaceStatus: string }>>`
    SELECT m.role, m.status, m.accessScope, w.status AS workspaceStatus FROM Membership m JOIN Workspace w ON w.id = m.workspaceId
    WHERE m.workspaceId = ${query.workspaceId} AND m.userId = ${query.userId}
      AND CAST(m.userId AS BINARY) = CAST(${query.userId} AS BINARY)
      AND CAST(m.workspaceId AS BINARY) = CAST(${query.workspaceId} AS BINARY)`;
  if (!member || member.status !== "ACTIVE" || member.workspaceStatus !== "ACTIVE" ||
      (member.accessScope !== null && member.accessScope !== "")) forbidden();
  const summary = (await readPayerBalanceSummaries(tx, [query.workspaceId])).get(query.workspaceId);
  const payer = summary ? { billingMode: summary.billingMode, payerStatus: summary.payerStatus, balanceFen: summary.balanceFen,
    arrears: summary.arrears, arrearsReason: summary.arrearsReason, asOf: summary.asOf } : null;
  const origin = topupAppOrigin(env);
  const canTopUp = payer !== null && payer.billingMode !== "off" &&
    canManageWorkspaceBilling(member.role as Parameters<typeof canManageWorkspaceBilling>[0]) && alipayTopupGateOpen(env) && origin !== null;
  return { canTopUp, topUpUrl: canTopUp ? buildTopUpUrl(origin) : null, payer };
}
