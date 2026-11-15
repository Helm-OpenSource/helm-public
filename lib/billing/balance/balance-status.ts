import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { fenToDecimalString, MAX_FEN } from "../funds/money";
import { chargeFenForQuantity, SpendGrantRefusal } from "../grants/price-grants";
import type { BillingRejectCode, ServiceActor } from "../reservations/reservations";

/**
 * Billing V1 C-BAL balance summary (S3 internal protocol v3.10; docs/operations/BILLING_INTERNAL_ROUTES.md). Read-only and
 * lock-free: one statement per batch, so wallet, credit and holds come from one consistent read (a settle in flight is seen
 * wholly before or wholly after) and no reserve or settle ever waits on it. Integer fen:
 * - balance = wallet - creditUsed - overdraftUsed (may be negative; the one number shown to customers). headroom includes
 *   remaining credit and is a stop/go input only: clients must never display it as a balance;
 * - headroom = wallet + creditRemaining + overdraftRemaining - held: creditRemaining is max(0, limit - used) of the drawable,
 *   in-term facility and 0 for a payer that is not active (credit-facilities.ts availableCreditFen); overdraftRemaining (C-OD)
 *   is max(0, overdraftLimitFen - overdraftUsed), never negative, so an overdraft over its soft limit adds 0 and never eats
 *   wallet or credit; held is enforce held/unknown reservations. Standard reserve admission still uses wallet + credit - held;
 *   overdraft room serves post-delivery work, which reserve admits without a funds check;
 * - overLimit (C-OD, Q9): overdraftUsed > overdraftLimitFen (with no limit configured, any overdraft at all);
 * - arrears: stop new billable work. Two causes, reported as arrearsReason: "funds" when headroom <= 0 (Q8: effective
 *   headroom at or below zero) or overLimit (Q9: stop at once), "payer_inactive" when an enforce payer is suspended or closed (coordinator 11-12): Core
 *   refuses its new reserves, so work would run unbilled. payer_inactive wins when both hold; null when not in arrears.
 * creditUsed is the credit_receivable projection, so a revoked or expired facility's outstanding draws still count.
 * overdraftUsed is the overdraft_receivable projection (C-OD post-delivery settle tails).
 */
export const BALANCE_STATUS_MAX_WORKSPACES = 50;
export type PayerStatus = "active" | "suspended" | "closed"; // PayerAccount.status ENUM
export type ArrearsReason = "funds" | "payer_inactive";
export type PayerBalanceSummary = { payerAccountId: string; billingMode: "off" | "shadow" | "enforce"; payerStatus: PayerStatus; walletFen: bigint;
  creditUsedFen: bigint; overdraftUsedFen: bigint; overdraftLimitFen: bigint; overLimit: boolean; creditRemainingFen: bigint; heldFen: bigint;
  balanceFen: bigint; headroomFen: bigint; arrears: boolean;
  arrearsReason: ArrearsReason | null; asOf: Date };

const ZERO = BigInt(0);
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
type Row = { workspaceId: string; payerAccountId: string; billingMode: PayerBalanceSummary["billingMode"]; payerStatus: PayerStatus; walletFen: bigint | null;
  creditUsedFen: bigint | null; overdraftUsedFen: bigint | null; overdraftLimitFen: bigint; creditRemainingFen: bigint | null; heldFen: bigint; asOf: Date };

/**
 * Summaries keyed by workspace id for the workspaces with exactly one active binding (others are absent: not billed). The
 * binding is matched byte-exactly, as resolvePayerForWorkspaceInTransaction does, but without its share lock or its refusal
 * of a non-active payer: an off, shadow, suspended or closed payer is summarised too.
 */
export async function readPayerBalanceSummaries(client: PrismaClient | Prisma.TransactionClient, workspaceIds: readonly string[]) {
  if (workspaceIds.length === 0) return new Map<string, PayerBalanceSummary>();
  const rows = await client.$queryRaw<Row[]>`SELECT b.scopeRef AS workspaceId, p.id AS payerAccountId, p.billingMode, p.status AS payerStatus,
      p.overdraftLimitFen,
      (SELECT w.balanceFen FROM FundsAccountProjection w WHERE w.payerAccountId = p.id AND w.account = 'customer_wallet_available') AS walletFen,
      (SELECT r.balanceFen FROM FundsAccountProjection r WHERE r.payerAccountId = p.id AND r.account = 'credit_receivable') AS creditUsedFen,
      (SELECT o.balanceFen FROM FundsAccountProjection o WHERE o.payerAccountId = p.id AND o.account = 'overdraft_receivable') AS overdraftUsedFen,
      (SELECT IF(p.status = 'active' AND (f.validUntil IS NULL OR f.validUntil > UTC_TIMESTAMP(3)), GREATEST(f.limitFen - f.usedFen, 0), 0)
        FROM CreditFacility f WHERE f.activePayerAccountId = p.id ORDER BY f.activatedAt DESC LIMIT 1) AS creditRemainingFen,
      (SELECT CAST(COALESCE(SUM(h.chargeFen), 0) AS SIGNED) FROM BillingReservation h
        WHERE h.payerAccountId = p.id AND h.billingMode = 'enforce' AND h.state IN ('held', 'unknown')) AS heldFen,
      UTC_TIMESTAMP(3) AS asOf
    FROM PayerScopeBinding b JOIN PayerAccount p ON p.id = b.payerAccountId
    WHERE b.scopeKind = 'workspace' AND b.state = 'active' AND b.activeScopeRef IN (${Prisma.join(workspaceIds)})`;
  const summaries = new Map<string, PayerBalanceSummary>();
  for (const row of rows) {
    // Mirrors resolvePayerForWorkspaceInTransaction's byte-exact check; unreachable today (activeScopeRef is utf8mb4_bin and
    // REF admits no trailing space), kept so the two resolvers cannot drift apart.
    if (!workspaceIds.includes(row.workspaceId)) continue;
    const walletFen = BigInt(row.walletFen ?? ZERO), creditUsedFen = BigInt(row.creditUsedFen ?? ZERO);
    const overdraftUsedFen = BigInt(row.overdraftUsedFen ?? ZERO);
    const creditRemainingFen = BigInt(row.creditRemainingFen ?? ZERO), heldFen = BigInt(row.heldFen);
    const overdraftLimitFen = BigInt(row.overdraftLimitFen), overLimit = overdraftUsedFen > overdraftLimitFen;
    const overdraftRemainingFen = overLimit ? ZERO : overdraftLimitFen - overdraftUsedFen;
    const headroomFen = walletFen + creditRemainingFen + overdraftRemainingFen - heldFen;
    const arrearsReason: ArrearsReason | null = row.billingMode === "enforce" && row.payerStatus !== "active" ? "payer_inactive"
      : headroomFen <= ZERO || overLimit ? "funds" : null;
    summaries.set(row.workspaceId, { payerAccountId: row.payerAccountId, billingMode: row.billingMode, payerStatus: row.payerStatus, walletFen,
      creditUsedFen, overdraftUsedFen, overdraftLimitFen, overLimit, creditRemainingFen, heldFen,
      balanceFen: walletFen - creditUsedFen - overdraftUsedFen, headroomFen,
      arrears: arrearsReason !== null, arrearsReason, asOf: row.asOf });
  }
  return summaries;
}

/** C-OD: work the caller has delivered but not yet settled (e.g. connected minutes waiting for the settler), per event and unit. */
export type PendingUsage = { workspaceId: string; billingEventRef: string; meterUnit: string; pendingQuantity: string };
export type BalanceStatusRequest = { workspaceIds: string[]; pending?: PendingUsage[] };
export type BalanceStatusEntry = { workspaceId: string; ok: true; billingMode: PayerBalanceSummary["billingMode"]; payerStatus: PayerStatus;
  balanceFen: string; headroomFen: string; overdraftUsedFen: string; overLimit: boolean; arrears: boolean; arrearsReason: ArrearsReason | null;
  asOf: string;
  /** Only when the request carries `pending`: headroom minus the pending usage at the current price; null when it cannot be priced. */
  headroomAfterPendingFen?: string | null } | { workspaceId: string; ok: false; code: "billing_mode_off" };

const UNIT = /^[a-z][a-z0-9_]{0,31}$/, QUANTITY = /^[1-9][0-9]{0,15}$/;
function pendingValid(ids: readonly string[], pending: unknown): pending is PendingUsage[] {
  if (!Array.isArray(pending) || pending.length > BALANCE_STATUS_MAX_WORKSPACES) return false;
  const seen = new Set<string>();
  return pending.every(item => {
    if (!item || typeof item !== "object" || Object.keys(item).sort().join() !== "billingEventRef,meterUnit,pendingQuantity,workspaceId") return false;
    const { workspaceId, billingEventRef, meterUnit, pendingQuantity } = item as PendingUsage;
    const key = JSON.stringify([workspaceId, billingEventRef, meterUnit]);
    if (!ids.includes(workspaceId) || typeof billingEventRef !== "string" || !REF.test(billingEventRef) || typeof meterUnit !== "string" ||
        !UNIT.test(meterUnit) || typeof pendingQuantity !== "string" || !QUANTITY.test(pendingQuantity) ||
        BigInt(pendingQuantity) > MAX_FEN || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/**
 * Prices each pending entry with the payer's single active, in-validity grant on an effective price for that event and unit (the
 * quote rule, at database time), half-up per entry. One more lock-free statement, so the price read may be a moment newer than
 * the balance snapshot. A workspace with an entry that has no single such grant gets null (the caller falls back to headroomFen).
 */
async function pendingFenByWorkspace(client: PrismaClient | Prisma.TransactionClient, pending: PendingUsage[],
  summaries: Map<string, PayerBalanceSummary>) {
  const payers = [...new Set(pending.flatMap(item => summaries.get(item.workspaceId)?.payerAccountId ?? []))];
  const prices = payers.length === 0 ? [] : await client.$queryRaw<Array<{ payerAccountId: string; billingEventRef: string; meterUnit: string;
    unitPriceFenNumerator: bigint; unitPriceDenominator: bigint }>>`SELECT g.payerAccountId, p.billingEventRef, p.meterUnit,
      p.unitPriceFenNumerator, p.unitPriceDenominator FROM SpendGrant g JOIN BillingPriceVersion p ON p.id = g.priceVersionId
    WHERE g.payerAccountId IN (${Prisma.join(payers)}) AND g.state = 'active' AND g.validFrom <= UTC_TIMESTAMP(3)
      AND g.validUntil > UTC_TIMESTAMP(3) AND p.effectiveFrom <= UTC_TIMESTAMP(3)
      AND (p.effectiveUntil IS NULL OR p.effectiveUntil > UTC_TIMESTAMP(3))`;
  const totals = new Map<string, bigint | null>();
  for (const item of pending) {
    const payerAccountId = summaries.get(item.workspaceId)?.payerAccountId;
    if (!payerAccountId) continue; // unbound: billing_mode_off, nothing to price
    const matches = prices.filter(price => price.payerAccountId === payerAccountId && price.billingEventRef === item.billingEventRef &&
      price.meterUnit === item.meterUnit);
    const sum = totals.has(item.workspaceId) ? totals.get(item.workspaceId)! : ZERO;
    let fen: bigint | null = null;
    try { if (sum !== null && matches.length === 1) fen = sum + chargeFenForQuantity(matches[0], BigInt(item.pendingQuantity)); } catch (error) {
      // Beyond the fen bound: not priceable, never a wrapped number. Anything else is a real fault and propagates.
      if (!(error instanceof SpendGrantRefusal) || error.code !== "price_amount_out_of_range") throw error;
    }
    totals.set(item.workspaceId, fen);
  }
  return totals;
}

/**
 * `balance-status` (v3.10): 1-50 distinct workspace ids, answered in request order. A bound payer is reported whatever its mode
 * (off included, so balances can be checked before enforce); an unbound workspace is `billing_mode_off` (not billed). The
 * caller reads one boolean, `arrears`, and applies it only to `billingMode: "enforce"`; `arrearsReason` only tells alerts
 * apart. The service identity is authenticated by the route; a read leaves no per-identity trace beyond the auth nonce.
 * C-OD: optional `pending` (at most 50 entries, each for a listed workspace, distinct per workspace, event and unit, positive
 * quantity) adds `headroomAfterPendingFen` to every bound entry. `arrears` is unchanged: it stays the headroom rule (Q8).
 */
const headroomAfterPending = (headroomFen: bigint, pendingFen: bigint | null | undefined) =>
  pendingFen === null || headroomFen - (pendingFen ?? ZERO) < -MAX_FEN ? null : fenToDecimalString(headroomFen - (pendingFen ?? ZERO));

export async function balanceStatus(client: PrismaClient, _actor: ServiceActor, req: BalanceStatusRequest):
  Promise<{ ok: true; results: BalanceStatusEntry[] } | { ok: false; code: BillingRejectCode }> {
  const ids = req?.workspaceIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > BALANCE_STATUS_MAX_WORKSPACES || new Set(ids).size !== ids.length ||
      ids.some(id => typeof id !== "string" || !REF.test(id)) ||
      (req.pending !== undefined && !pendingValid(ids, req.pending))) return { ok: false, code: "request_invalid" };
  const summaries = await readPayerBalanceSummaries(client, ids);
  const pendingFen = req.pending === undefined ? null : await pendingFenByWorkspace(client, req.pending, summaries);
  return { ok: true, results: ids.map((workspaceId): BalanceStatusEntry => {
    const summary = summaries.get(workspaceId);
    if (!summary) return { workspaceId, ok: false, code: "billing_mode_off" };
    return { workspaceId, ok: true, billingMode: summary.billingMode, payerStatus: summary.payerStatus, balanceFen: fenToDecimalString(summary.balanceFen),
      headroomFen: fenToDecimalString(summary.headroomFen), overdraftUsedFen: fenToDecimalString(summary.overdraftUsedFen), overLimit: summary.overLimit,
      arrears: summary.arrears, arrearsReason: summary.arrearsReason, asOf: summary.asOf.toISOString(),
      ...(pendingFen === null ? {} : { headroomAfterPendingFen: headroomAfterPending(summary.headroomFen, pendingFen.get(workspaceId)) }) };
  }) };
}
