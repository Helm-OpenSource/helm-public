import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { fenToDecimalString } from "../funds/money";
import type { BillingRejectCode, ServiceActor } from "../reservations/reservations";

/**
 * Billing V1 C-BAL balance summary (S3 internal protocol v3.10; docs/operations/BILLING_INTERNAL_ROUTES.md). Read-only and
 * lock-free: one statement per batch, so wallet, credit and holds come from one consistent read (a settle in flight is seen
 * wholly before or wholly after) and no reserve or settle ever waits on it. Integer fen:
 * - balance = wallet - creditUsed - overdraftUsed (may be negative; the one number shown to customers);
 * - headroom = wallet + creditRemaining - held, the reserve admission formula (reservations.ts reserveInTransaction with
 *   credit-facilities.ts availableCreditFen): creditRemaining is max(0, limit - used) of the drawable, in-term facility and 0
 *   for a payer that is not active; held is enforce held/unknown reservations;
 * - arrears = headroom <= 0 (owner 11-12 Q8: effective headroom at or below zero).
 * creditUsed is the credit_receivable projection, so a revoked or expired facility's outstanding draws still count.
 * overdraftUsed is always 0 until the overdraft slice (C-OD) adds its account; the field is reserved in the response now.
 */
export const BALANCE_STATUS_MAX_WORKSPACES = 50;
export type PayerBalanceSummary = { billingMode: "off" | "shadow" | "enforce"; walletFen: bigint; creditUsedFen: bigint;
  overdraftUsedFen: bigint; creditRemainingFen: bigint; heldFen: bigint; balanceFen: bigint; headroomFen: bigint; arrears: boolean;
  asOf: Date };

const ZERO = BigInt(0);
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
type Row = { workspaceId: string; billingMode: PayerBalanceSummary["billingMode"]; walletFen: bigint | null;
  creditUsedFen: bigint | null; creditRemainingFen: bigint | null; heldFen: bigint; asOf: Date };

/**
 * Summaries keyed by workspace id for the workspaces with exactly one active binding (others are absent: not billed). The
 * binding is matched byte-exactly, as resolvePayerForWorkspaceInTransaction does, but without its share lock or its refusal
 * of a non-active payer: an off, shadow, suspended or closed payer is summarised too.
 */
export async function readPayerBalanceSummaries(client: PrismaClient | Prisma.TransactionClient, workspaceIds: readonly string[]) {
  if (workspaceIds.length === 0) return new Map<string, PayerBalanceSummary>();
  const rows = await client.$queryRaw<Row[]>`SELECT b.scopeRef AS workspaceId, p.billingMode,
      (SELECT w.balanceFen FROM FundsAccountProjection w WHERE w.payerAccountId = p.id AND w.account = 'customer_wallet_available') AS walletFen,
      (SELECT r.balanceFen FROM FundsAccountProjection r WHERE r.payerAccountId = p.id AND r.account = 'credit_receivable') AS creditUsedFen,
      (SELECT IF(p.status = 'active' AND (f.validUntil IS NULL OR f.validUntil > UTC_TIMESTAMP(3)), GREATEST(f.limitFen - f.usedFen, 0), 0)
        FROM CreditFacility f WHERE f.activePayerAccountId = p.id ORDER BY f.activatedAt DESC LIMIT 1) AS creditRemainingFen,
      (SELECT CAST(COALESCE(SUM(h.chargeFen), 0) AS SIGNED) FROM BillingReservation h
        WHERE h.payerAccountId = p.id AND h.billingMode = 'enforce' AND h.state IN ('held', 'unknown')) AS heldFen,
      UTC_TIMESTAMP(3) AS asOf
    FROM PayerScopeBinding b JOIN PayerAccount p ON p.id = b.payerAccountId
    WHERE b.scopeKind = 'workspace' AND b.state = 'active' AND b.activeScopeRef IN (${Prisma.join(workspaceIds)})`;
  const summaries = new Map<string, PayerBalanceSummary>();
  for (const row of rows) {
    if (!workspaceIds.includes(row.workspaceId)) continue; // collation-equal but not byte-equal: not this workspace's binding
    const walletFen = BigInt(row.walletFen ?? ZERO), creditUsedFen = BigInt(row.creditUsedFen ?? ZERO), overdraftUsedFen = ZERO;
    const creditRemainingFen = BigInt(row.creditRemainingFen ?? ZERO), heldFen = BigInt(row.heldFen);
    const headroomFen = walletFen + creditRemainingFen - heldFen;
    summaries.set(row.workspaceId, { billingMode: row.billingMode, walletFen, creditUsedFen, overdraftUsedFen, creditRemainingFen,
      heldFen, balanceFen: walletFen - creditUsedFen - overdraftUsedFen, headroomFen, arrears: headroomFen <= ZERO, asOf: row.asOf });
  }
  return summaries;
}

export type BalanceStatusRequest = { workspaceIds: string[] };
export type BalanceStatusEntry = { workspaceId: string; ok: true; billingMode: PayerBalanceSummary["billingMode"]; balanceFen: string;
  headroomFen: string; overdraftUsedFen: string; arrears: boolean; asOf: string } | { workspaceId: string; ok: false; code: "billing_mode_off" };

/**
 * `balance-status` (v3.10): 1-50 distinct workspace ids, answered in request order. A bound payer is reported whatever its mode
 * (off included, so balances can be checked before enforce); an unbound workspace is `billing_mode_off` (not billed). The
 * caller applies the arrears gate only to `billingMode: "enforce"`. The service identity is authenticated by the route; a read
 * leaves no per-identity trace beyond the auth nonce.
 */
export async function balanceStatus(client: PrismaClient, _actor: ServiceActor, req: BalanceStatusRequest):
  Promise<{ ok: true; results: BalanceStatusEntry[] } | { ok: false; code: BillingRejectCode }> {
  const ids = req?.workspaceIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > BALANCE_STATUS_MAX_WORKSPACES || new Set(ids).size !== ids.length ||
      ids.some(id => typeof id !== "string" || !REF.test(id))) return { ok: false, code: "request_invalid" };
  const summaries = await readPayerBalanceSummaries(client, ids);
  return { ok: true, results: ids.map((workspaceId): BalanceStatusEntry => {
    const summary = summaries.get(workspaceId);
    if (!summary) return { workspaceId, ok: false, code: "billing_mode_off" };
    return { workspaceId, ok: true, billingMode: summary.billingMode, balanceFen: fenToDecimalString(summary.balanceFen),
      headroomFen: fenToDecimalString(summary.headroomFen), overdraftUsedFen: fenToDecimalString(summary.overdraftUsedFen),
      arrears: summary.arrears, asOf: summary.asOf.toISOString() };
  }) };
}
