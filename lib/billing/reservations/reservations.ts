import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { availableCreditFen, CreditFacilityRefusal, drawCreditShortfallInTransaction } from "../credit/credit-facilities";
import { FundsRefusal, postFundsTransactionInTransaction } from "../funds/funds-journal";
import { MAX_FEN } from "../funds/money";
import { resolvePayerForWorkspaceInTransaction } from "../payer/payer-accounts";
import { type BillingPeriodKeys, chargeFenForQuantity, lockSpendGrantForUseInTransaction, SpendGrantRefusal,
  type SpendGrantRefusalCode, type SpendGrantRow } from "../grants/price-grants";

/**
 * Billing V1 S3-b reservations on the S3 internal protocol (docs/operations/BILLING_RESERVATIONS.md); nothing auto-releases and
 * shadow never moves money. Lock order: Membership -> PayerAccount FOR UPDATE (per-payer mutex) -> SpendGrant -> BudgetBucket
 * day, month -> (reserve: CreditFacility) -> BillingReservation -> (settle: the S3-e credit draw's order) -> FundsTransaction ->
 * FundsAccountProjection; the bucket CAS and limit guard in the UPDATE's own WHERE are the second line.
 */
export type BillingRejectCode = "billing_mode_off" | "insufficient_funds" | "limit_exceeded" | "grant_not_active" |
  "grant_price_version_mismatch" | "grant_meter_mismatch" | "grant_charge_zero" | "idempotency_conflict" |
  "reservation_state_conflict" | "quantity_exceeds_reservation" | "service_unauthorized" | "core_unavailable" |
  "unknown_resolution_conflict" | "request_invalid"; // request_invalid: malformed request (adopted in protocol v3.2)

export class BillingReject extends Error {
  constructor(readonly code: BillingRejectCode) { super(code); this.name = "BillingReject"; }
}
const GRANT_REJECTS: Partial<Record<SpendGrantRefusalCode, BillingRejectCode>> = {
  // Only an explicit off payer is billing_mode_off; an unknown or suspended payer fails closed as grant_not_active (v3.2).
  payer_billing_off: "billing_mode_off", payer_account_unavailable: "grant_not_active", grant_not_active: "grant_not_active",
  grant_unavailable: "grant_not_active", grant_outside_validity: "grant_not_active", price_version_not_effective: "grant_not_active",
  price_version_unavailable: "grant_not_active", grant_per_charge_exceeded: "limit_exceeded",
  grant_daily_limit_exceeded: "limit_exceeded", grant_monthly_limit_exceeded: "limit_exceeded",
  grant_price_version_mismatch: "grant_price_version_mismatch", grant_meter_mismatch: "grant_meter_mismatch",
  grant_charge_zero: "grant_charge_zero", grant_input_invalid: "request_invalid", price_input_invalid: "request_invalid",
  price_amount_out_of_range: "request_invalid",
};
const FUNDS_REJECTS: Partial<Record<FundsRefusal["code"], BillingRejectCode>> = { funds_insufficient: "insufficient_funds",
  payer_billing_off: "billing_mode_off", payer_account_unavailable: "grant_not_active", funds_write_conflict: "core_unavailable" };
// A settle shortfall the credit line cannot cover is insufficient_funds (retryable, never a release; protocol v3.5 §3).
const CREDIT_REJECTS: Partial<Record<CreditFacilityRefusal["code"], BillingRejectCode>> = { credit_insufficient: "insufficient_funds",
  credit_not_active: "insufficient_funds", payer_account_unavailable: "grant_not_active", credit_write_conflict: "core_unavailable" };
/** Maps refusals to `{ ok: false, code }`. An invariant breach or unexpected error propagates (callers see core_unavailable). */
export async function asBillingResult<T extends object>(work: Promise<T>): Promise<({ ok: true } & T) | { ok: false; code: BillingRejectCode }> {
  try { return { ok: true, ...(await work) }; } catch (error) {
    if (error instanceof BillingReject) return { ok: false, code: error.code };
    const mapped = error instanceof SpendGrantRefusal ? GRANT_REJECTS[error.code]
      : error instanceof FundsRefusal ? FUNDS_REJECTS[error.code]
        : error instanceof CreditFacilityRefusal ? CREDIT_REJECTS[error.code] : undefined;
    if (mapped) return { ok: false, code: mapped };
    // Write conflict, serialization failure, deadlock (1213) or lock wait timeout (1205): nothing committed; retry the same key.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034" ||
        (error.code === "P2010" && ["1213", "1205"].includes(String((error.meta as { code?: unknown } | undefined)?.code))))) {
      return { ok: false, code: "core_unavailable" };
    }
    throw error;
  }
}

const ZERO = BigInt(0);
const RELEASE_REASONS = ["not_executed", "failed", "partial_unusable"] as const;
export type ReleaseReasonCode = (typeof RELEASE_REASONS)[number];
/** The authenticated service identity (BillingServiceGrant in S3-b3); never a user. */
export type ServiceActor = { type: "SYSTEM"; ref: string };
function reject(code: BillingRejectCode): never { throw new BillingReject(code); }
function reference(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/.test(value)) reject("request_invalid");
}
function serviceActor(actor: ServiceActor) {
  if (!actor || actor.type !== "SYSTEM") reject("request_invalid");
  reference(actor.ref);
  return `SYSTEM:${actor.ref}`;
}
/** Positive integer decimal string (no sign, no leading zero) within the fen bound. */
function positiveQuantity(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,15}$/.test(value) || BigInt(value) > MAX_FEN) reject("request_invalid");
  return BigInt(value);
}
function invariantBreach(): never { throw new Error("reservation_invariant_breach"); }
// No automatic retry: a retried call with the same idempotencyKey replays or refuses, it never takes a second effect.
const run = <T>(client: PrismaClient, body: (tx: Prisma.TransactionClient) => Promise<T>) =>
  client.$transaction(body, { maxWait: 5000, timeout: 10000 });

function idempotencyKey(value: unknown) { if (typeof value !== "string" || !/^[A-Za-z0-9:_-]{8,128}$/.test(value)) reject("request_invalid"); }
export type ReserveRequest = { idempotencyKey: string; operationRef: string; payerRef: string; grantId: string;
  priceVersionId: string; billingEventRef: string; meterUnit: string; quantity: string };

/** Pure validation; the content hash binds the key to everything the caller chose (never the server-derived time or price). */
export function normalizeReserve(actor: ServiceActor, req: ReserveRequest) {
  const createdBy = serviceActor(actor);
  if (!req || typeof req !== "object") reject("request_invalid");
  idempotencyKey(req.idempotencyKey);
  for (const value of [req.operationRef, req.payerRef, req.grantId, req.priceVersionId, req.billingEventRef]) reference(value);
  if (typeof req.meterUnit !== "string" || !/^[a-z][a-z0-9_]{0,31}$/.test(req.meterUnit)) reject("request_invalid");
  const quantity = positiveQuantity(req.quantity);
  const content = { v: 1, operationRef: req.operationRef, payerRef: req.payerRef, grantId: req.grantId,
    priceVersionId: req.priceVersionId, billingEventRef: req.billingEventRef, meterUnit: req.meterUnit, quantity: req.quantity };
  return { createdBy, quantity, contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex") };
}

async function lockPayerRow(tx: Prisma.TransactionClient, payerAccountId: string) {
  const [payer] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM PayerAccount
    WHERE id = ${payerAccountId} AND CAST(id AS BINARY) = CAST(${payerAccountId} AS BINARY) FOR UPDATE`;
  if (!payer) reject("grant_not_active"); // an unknown payer fails closed, never "unbilled"
}

type Mode = "shadow" | "enforce";
type BucketRow = { periodKind: "day" | "month"; periodKey: string; settledFen: bigint; reservedFen: bigint; version: number };
/** Locks the mode's day, month buckets (creating zero rows); plain existence read under PayerAccount avoids cross-payer gap locks. */
async function lockBuckets(tx: Prisma.TransactionClient, grant: Pick<SpendGrantRow, "id" | "payerAccountId">,
  keys: BillingPeriodKeys, billingMode: Mode) {
  const rows: BucketRow[] = [];
  for (const [periodKind, periodKey] of [["day", keys.day], ["month", keys.month]] as const) {
    const id = { grantId: grant.id, billingMode, periodKind, periodKey };
    if (!await tx.budgetBucket.findUnique({ where: { grantId_billingMode_periodKind_periodKey: id }, select: { version: true } })) {
      await tx.budgetBucket.create({ data: { ...id, payerAccountId: grant.payerAccountId } });
    }
    const [row] = await tx.$queryRaw<BucketRow[]>`SELECT periodKind, periodKey, settledFen, reservedFen, version FROM BudgetBucket
      WHERE grantId = ${grant.id} AND billingMode = ${billingMode} AND periodKind = ${periodKind} AND periodKey = ${periodKey} FOR UPDATE`;
    if (!row) invariantBreach();
    rows.push({ ...row, settledFen: BigInt(row.settledFen), reservedFen: BigInt(row.reservedFen), version: Number(row.version) });
  }
  return rows;
}
/** Version-CAS counter move; `ceiling` (reserve only) keeps settled + reserved within the grant limit in the same statement. */
async function moveBucket(tx: Prisma.TransactionClient, grantId: string, billingMode: Mode, bucket: BucketRow,
  move: { reservedDelta: bigint; settledDelta: bigint; ceiling: bigint | null }) {
  const changed = await tx.$executeRaw`UPDATE BudgetBucket SET reservedFen = reservedFen + ${move.reservedDelta},
    settledFen = settledFen + ${move.settledDelta}, version = version + 1, updatedAt = CURRENT_TIMESTAMP(3)
    WHERE grantId = ${grantId} AND billingMode = ${billingMode} AND periodKind = ${bucket.periodKind} AND periodKey = ${bucket.periodKey}
      AND version = ${bucket.version} AND reservedFen + ${move.reservedDelta} >= 0
      ${move.ceiling === null ? Prisma.empty
    : Prisma.sql`AND settledFen + reservedFen + ${move.reservedDelta} + ${move.settledDelta} <= ${move.ceiling}`}`;
  // Under the PayerAccount lock a miss means the counters disagree with the reservations: fail the whole transaction.
  if (changed !== 1) invariantBreach();
}

/** Reserve: idempotent by (payer, key) + content hash, one per (payer, operationRef); any refusal rolls back, key unused. */
// Not exported: its plain reads rely on PayerAccount being locked before the transaction's first read, which `reserve` guarantees.
async function reserveInTransaction(tx: Prisma.TransactionClient, actor: ServiceActor, req: ReserveRequest) {
  const { createdBy, quantity, contentHash } = normalizeReserve(actor, req);
  const payerAccountId = req.payerRef;
  await lockPayerRow(tx, payerAccountId);
  // Every reservation writer holds this PayerAccount lock, so a plain read now sees any committed row; a stale caller snapshot
  // can only miss one and then hit a unique key (core_unavailable, retry replays), never a second hold.
  const prior = await tx.billingReservation.findMany({ where: { payerAccountId,
    OR: [{ idempotencyKey: req.idempotencyKey }, { operationRef: req.operationRef }] } });
  const replay = prior.find(row => row.idempotencyKey === req.idempotencyKey);
  if (prior.length > 0 && (!replay || replay.contentHash !== contentHash)) reject("idempotency_conflict");
  if (replay) return reserved(replay.billingMode, replay.id, replay.state, replay.chargeFen, replay.priceContentHash, replay.dayKey, replay.monthKey);
  let buckets: BucketRow[] = [];
  const admitted = await lockSpendGrantForUseInTransaction(tx, { payerAccountId, grantId: req.grantId,
    priceVersionId: req.priceVersionId, billingEventRef: req.billingEventRef, meterUnit: req.meterUnit, quantity },
  async (grant, keys, mode) => {
    buckets = await lockBuckets(tx, grant, keys, mode);
    const used = (bucket: BucketRow) => bucket.settledFen + bucket.reservedFen;
    return { day: used(buckets[0]), month: used(buckets[1]) };
  });
  const { grant, chargeFen, billingMode } = admitted;
  if (billingMode === "enforce") {
    // Non-locking reads: every hold and wallet writer holds this PayerAccount lock, so the snapshot (first read after it) is
    // current; FOR SHARE range locks here deadlocked first reserves across payers. Callers must not read before calling.
    const [{ held }] = await tx.$queryRaw<Array<{ held: bigint }>>`SELECT CAST(COALESCE(SUM(chargeFen), 0) AS SIGNED) AS held
      FROM BillingReservation WHERE payerAccountId = ${payerAccountId} AND billingMode = 'enforce' AND state IN ('held', 'unknown')`;
    const [wallet] = await tx.$queryRaw<Array<{ balanceFen: bigint }>>`SELECT balanceFen FROM FundsAccountProjection
      WHERE payerAccountId = ${payerAccountId} AND account = 'customer_wallet_available'`;
    const credit = await availableCreditFen(tx, payerAccountId); // owner v3: wallet + remaining credit (S3-e) must cover the holds
    if (BigInt(wallet?.balanceFen ?? ZERO) + credit - BigInt(held) < chargeFen) reject("insufficient_funds");
  }
  for (const bucket of buckets) {
    await moveBucket(tx, grant.id, billingMode, bucket, { reservedDelta: chargeFen, settledDelta: ZERO,
      ceiling: bucket.periodKind === "day" ? grant.dailyLimitFen : grant.monthlyLimitFen });
  }
  const row = await tx.billingReservation.create({ data: { payerAccountId, idempotencyKey: req.idempotencyKey,
    operationRef: req.operationRef, contentHash, grantId: grant.id, grantVersion: grant.version, productId: grant.productId,
    priceVersionId: admitted.priceVersionId, priceContentHash: admitted.priceContentHash, billingEventRef: req.billingEventRef,
    meterUnit: req.meterUnit, quantity, chargeFen, billingMode, reservedAt: admitted.at, dayKey: admitted.periodKeys.day,
    monthKey: admitted.periodKeys.month, createdBy } });
  return reserved(billingMode, row.id, row.state, chargeFen, row.priceContentHash, row.dayKey, row.monthKey);
}
function reserved(mode: Mode, reservationId: string, state: string, capFen: bigint, priceContentHash: string, day: string, month: string) {
  const base = { reservationId, state, capFen: capFen.toString(), priceContentHash, periodKeys: { day, month } };
  return mode === "shadow" ? { mode, ...base, wouldChargeFen: base.capFen } : { mode, ...base };
}

type LockedReservation = { id: string; payerAccountId: string; operationRef: string; grantId: string; billingMode: Mode; priceVersionId: string;
  priceContentHash: string; quantity: bigint; chargeFen: bigint; reservedAt: Date; state: string; version: number; unknownKey: string | null;
  unknownEvidenceRef: string | null; resolutionKey: string | null; releaseReason: string | null; resolutionEvidenceRef: string | null };
/** Locks PayerAccount, the frozen-period buckets, then the row; the plain head read only finds immutable keys. */
async function lockReservationForResolution(tx: Prisma.TransactionClient, reservationId: string, operationRef: string) {
  reference(reservationId); reference(operationRef);
  const head = await tx.billingReservation.findUnique({ where: { id: reservationId },
    select: { payerAccountId: true, grantId: true, billingMode: true, dayKey: true, monthKey: true } });
  if (!head) reject("reservation_state_conflict"); // no such reservation (protocol v1 has no not-found code)
  await lockPayerRow(tx, head.payerAccountId);
  const buckets = await lockBuckets(tx, { id: head.grantId, payerAccountId: head.payerAccountId }, { day: head.dayKey, month: head.monthKey },
    head.billingMode);
  const [row] = await tx.$queryRaw<LockedReservation[]>`SELECT id, payerAccountId, operationRef, grantId, billingMode, priceVersionId,
    priceContentHash, quantity, chargeFen, reservedAt, state, version, unknownKey, unknownEvidenceRef, resolutionKey, releaseReason,
    resolutionEvidenceRef FROM BillingReservation WHERE id = ${reservationId} FOR UPDATE`;
  if (!row || row.id !== reservationId || row.grantId !== head.grantId || row.billingMode !== head.billingMode) reject("reservation_state_conflict");
  if (row.operationRef !== operationRef) reject("idempotency_conflict");
  return { buckets, reservation: { ...row, quantity: BigInt(row.quantity), chargeFen: BigInt(row.chargeFen), version: Number(row.version) } };
}

/** A key used on another reservation of this payer is a conflict (checked under the PayerAccount lock, before the unique key). */
async function keyFree(tx: Prisma.TransactionClient, reservation: LockedReservation, column: "unknownKey" | "resolutionKey", key: string) {
  if (await tx.billingReservation.findFirst({ where: { payerAccountId: reservation.payerAccountId, [column]: key, NOT: { id: reservation.id } },
    select: { id: true } })) reject("idempotency_conflict");
}
/** State CAS: version and pre-state stay in the UPDATE's own WHERE; the trigger also whitelists the move. */
async function transition(tx: Prisma.TransactionClient, reservation: LockedReservation, set: Prisma.Sql) {
  const changed = await tx.$executeRaw`UPDATE BillingReservation SET ${set}, version = version + 1, updatedAt = CURRENT_TIMESTAMP(3)
    WHERE id = ${reservation.id} AND version = ${reservation.version} AND state = ${reservation.state}`;
  if (changed !== 1) reject("reservation_state_conflict");
}

export type MarkUnknownRequest = { idempotencyKey: string; reservationId: string; operationRef: string; evidenceRef: string };
/** held -> unknown: the outcome cannot be proven; the hold stays counted and is never released by time. */
export async function markUnknownInTransaction(tx: Prisma.TransactionClient, actor: ServiceActor, req: MarkUnknownRequest) {
  serviceActor(actor); idempotencyKey(req?.idempotencyKey); reference(req.evidenceRef);
  const { reservation } = await lockReservationForResolution(tx, req.reservationId, req.operationRef);
  if (reservation.unknownKey === req.idempotencyKey) {
    if (reservation.unknownEvidenceRef !== req.evidenceRef) reject("idempotency_conflict");
    return { state: reservation.state }; // replay reports the current state (it may have been resolved since)
  }
  if (reservation.state !== "held") reject("reservation_state_conflict");
  await keyFree(tx, reservation, "unknownKey", req.idempotencyKey);
  await transition(tx, reservation, Prisma.sql`state = 'unknown', unknownKey = ${req.idempotencyKey},
    unknownEvidenceRef = ${req.evidenceRef}, unknownAt = UTC_TIMESTAMP(3)`);
  return { state: "unknown" as const };
}

export type ReleaseRequest = { idempotencyKey: string; reservationId: string; operationRef: string; reasonCode: ReleaseReasonCode;
  evidenceRef: string };
/**
 * held -> released; the hold leaves its frozen-period buckets. The caller proves the work did not run (claim void), failed,
 * or is unusable (S0 §4) via evidenceRef. Same key + content replays.
 */
export async function releaseInTransaction(tx: Prisma.TransactionClient, actor: ServiceActor, req: ReleaseRequest) {
  if (!RELEASE_REASONS.includes(req?.reasonCode)) reject("request_invalid");
  return releaseFrom(tx, actor, req, req.reasonCode, false);
}
async function releaseFrom(tx: Prisma.TransactionClient, actor: ServiceActor, req: Omit<ReleaseRequest, "reasonCode">,
  reason: ReleaseReasonCode | "unknown_released", unknownOnly: boolean) {
  const resolvedBy = serviceActor(actor);
  idempotencyKey(req?.idempotencyKey); reference(req.evidenceRef);
  const { reservation, buckets } = await lockReservationForResolution(tx, req.reservationId, req.operationRef);
  if (reservation.resolutionKey === req.idempotencyKey) {
    if (reservation.state !== "released" || reservation.releaseReason !== reason ||
        reservation.resolutionEvidenceRef !== req.evidenceRef) reject("idempotency_conflict");
    return { state: "released" as const };
  }
  assertResolvable(reservation.state, unknownOnly);
  await keyFree(tx, reservation, "resolutionKey", req.idempotencyKey);
  for (const bucket of buckets) {
    await moveBucket(tx, reservation.grantId, reservation.billingMode, bucket, { reservedDelta: -reservation.chargeFen, settledDelta: ZERO, ceiling: null });
  }
  await transition(tx, reservation, Prisma.sql`state = 'released', releaseReason = ${reason}, resolutionKey = ${req.idempotencyKey},
    resolutionEvidenceRef = ${req.evidenceRef}, resolvedBy = ${resolvedBy}, resolvedAt = UTC_TIMESTAMP(3)`);
  return { state: "released" as const };
}

export type SettleRequest = { idempotencyKey: string; reservationId: string; operationRef: string; quantityUsed: string;
  evidenceRef: string };
/**
 * held|unknown -> settled, exactly once. The charge is repriced from the frozen price row for `quantityUsed` (<= the reserved
 * quantity, so <= capFen), moves from reserved to settled in the reservation's frozen-period buckets (not settle time), posts a
 * balanced `charge` funds transaction (wallet debit, charge revenue credit; its audit and funds outbox) and a charge outbox row,
 * all in this transaction. An enforce wallet shortfall is first borrowed from credit (S3-w). A refusal (e.g. wallet corrected
 * below the hold and no credit left) leaves the reservation held.
 */
export async function settleInTransaction(tx: Prisma.TransactionClient, actor: ServiceActor, req: SettleRequest) {
  return settleFrom(tx, actor, req, false);
}
async function settleFrom(tx: Prisma.TransactionClient, actor: ServiceActor, req: SettleRequest, unknownOnly: boolean) {
  const resolvedBy = serviceActor(actor);
  idempotencyKey(req?.idempotencyKey); reference(req.evidenceRef);
  const quantityUsed = positiveQuantity(req.quantityUsed); // "0" is a release (protocol v2), not a settle
  const { reservation, buckets } = await lockReservationForResolution(tx, req.reservationId, req.operationRef);
  if (reservation.resolutionKey === req.idempotencyKey) {
    const charge = await tx.billingCharge.findUnique({ where: { reservationId: reservation.id } });
    if (reservation.state !== "settled" || !charge || charge.quantity !== quantityUsed || charge.evidenceRef !== req.evidenceRef) {
      reject("idempotency_conflict");
    }
    return { state: "settled" as const, chargeId: charge.id, chargeFen: charge.chargeFen.toString() };
  }
  assertResolvable(reservation.state, unknownOnly);
  await keyFree(tx, reservation, "resolutionKey", req.idempotencyKey);
  if (quantityUsed > reservation.quantity) reject("quantity_exceeds_reservation");
  const [price] = await tx.$queryRaw<Array<{ unitPriceFenNumerator: bigint; unitPriceDenominator: bigint; contentHash: string }>>`
    SELECT unitPriceFenNumerator, unitPriceDenominator, contentHash FROM BillingPriceVersion WHERE id = ${reservation.priceVersionId} FOR SHARE`;
  if (!price || price.contentHash !== reservation.priceContentHash) invariantBreach();
  const chargeFen = chargeFenForQuantity(price, quantityUsed);
  if (chargeFen > reservation.chargeFen) invariantBreach(); // half-up of a smaller quantity never exceeds the cap
  for (const bucket of buckets) {
    await moveBucket(tx, reservation.grantId, reservation.billingMode, bucket, { reservedDelta: -reservation.chargeFen,
      settledDelta: chargeFen, ceiling: null });
  }
  // Shadow records the would-be charge only, and a 0-fen settle (smaller quantity, v3.5) has nothing to post: no draw, no funds.
  const posting = reservation.billingMode === "enforce" && chargeFen > ZERO;
  // Owner v3: the wallet pays first and only the shortfall is borrowed (none when the wallet covers it), then the wallet is
  // charged in full. Bound to this locked reservation and its frozen reservedAt; a replay returned above and never draws again.
  if (posting) await drawCreditShortfallInTransaction(tx, { payerAccountId: reservation.payerAccountId, chargeFen,
    sourceRef: `reservation:${reservation.id}`, actor, reservedAt: reservation.reservedAt });
  const funds = !posting ? null : await postFundsTransactionInTransaction(tx, {
    payerAccountId: reservation.payerAccountId, kind: "charge", operationKey: `charge:${reservation.id}`, actor,
    evidenceRef: req.evidenceRef, entries: [{ account: "customer_wallet_available", direction: "debit", amountFen: chargeFen },
      { account: "charge_revenue", direction: "credit", amountFen: chargeFen }] });
  if (funds?.replayed) invariantBreach(); // a charge posting exists for an unsettled reservation
  const charge = await tx.billingCharge.create({ data: { reservationId: reservation.id, payerAccountId: reservation.payerAccountId,
    grantId: reservation.grantId, operationRef: reservation.operationRef, idempotencyKey: req.idempotencyKey,
    billingMode: reservation.billingMode, fundsTransactionId: funds?.transaction.id ?? null, priceVersionId: reservation.priceVersionId, priceContentHash: reservation.priceContentHash,
    quantity: quantityUsed, chargeFen, capFen: reservation.chargeFen, dayKey: buckets[0].periodKey, monthKey: buckets[1].periodKey,
    evidenceRef: req.evidenceRef, createdBy: resolvedBy } });
  await transition(tx, reservation, Prisma.sql`state = 'settled', resolutionKey = ${req.idempotencyKey},
    resolutionEvidenceRef = ${req.evidenceRef}, resolvedBy = ${resolvedBy}, resolvedAt = UTC_TIMESTAMP(3)`);
  const payload = JSON.stringify({ chargeId: charge.id, reservationId: reservation.id, mode: charge.billingMode, payerAccountId: charge.payerAccountId,
    operationRef: charge.operationRef, fundsTransactionId: charge.fundsTransactionId, quantity: quantityUsed.toString(),
    chargeFen: chargeFen.toString(), capFen: reservation.chargeFen.toString(), dayKey: charge.dayKey, monthKey: charge.monthKey,
    evidenceRef: charge.evidenceRef });
  await tx.billingOutbox.create({ data: { aggregateType: "BillingCharge", aggregateId: charge.id,
    eventType: charge.billingMode === "shadow" ? "billing.charge.shadow_settled" : "billing.charge.settled",
    payload, payloadHash: createHash("sha256").update(payload).digest("hex") } });
  return { state: "settled" as const, chargeId: charge.id, chargeFen: chargeFen.toString() };
}

function assertResolvable(state: string, unknownOnly: boolean) {
  if (unknownOnly ? state !== "unknown" : state !== "held") { // protocol v3.5: business settle/release only from held
    reject(unknownOnly ? "unknown_resolution_conflict" : "reservation_state_conflict");
  }
}

export type ResolveUnknownRequest = { idempotencyKey: string; reservationId: string; operationRef: string;
  outcome: "settled" | "released"; quantityUsed?: string; evidenceRef: string };
/**
 * Reconciliation / manual channel only (protocol v2 §5; route and operator entry are S3-b3 / S5): resolves an `unknown`
 * reservation on evidence, as settle (needs `quantityUsed`) or as release (reason `unknown_released`). Any other state is
 * `unknown_resolution_conflict`; a same-key replay returns the recorded result.
 */
export async function resolveUnknownInTransaction(tx: Prisma.TransactionClient, actor: ServiceActor,
  req: ResolveUnknownRequest): Promise<{ state: "settled"; chargeId: string; chargeFen: string } | { state: "released" }> {
  if (req?.outcome === "settled") return settleFrom(tx, actor, { ...req, quantityUsed: req.quantityUsed ?? "" }, true);
  if (req?.outcome !== "released" || req.quantityUsed !== undefined) reject("request_invalid");
  return releaseFrom(tx, actor, req, "unknown_released", true);
}

export type QuoteRequest = { subjectScope: { kind: "workspace"; workspaceId: string } | { kind: "vault"; vaultId: string };
  billingEventRef: string; meterUnit: string;
  quantity: string };
/**
 * Resolves payer, grant and price version for a subject (protocol v2 §3) so the business side never picks a grant. Advisory and
 * lock-free: `reserve` re-checks everything under lock. An unbound workspace or an off payer is `billing_mode_off` (not billed);
 * a suspended payer, no active, in-validity grant whose bound price matches the event and meter unit, or more than one, is `grant_not_active`.
 */
export async function quoteInTransaction(tx: Prisma.TransactionClient, actor: ServiceActor, req: QuoteRequest) {
  serviceActor(actor);
  // vault scopes need consumer payers (S3-f); until then request_invalid (protocol v3.2)
  if (!req?.subjectScope || req.subjectScope.kind !== "workspace") reject("request_invalid");
  const workspaceId = req.subjectScope.workspaceId;
  reference(workspaceId); reference(req.billingEventRef); positiveQuantity(req.quantity);
  if (typeof req.meterUnit !== "string" || !/^[a-z][a-z0-9_]{0,31}$/.test(req.meterUnit)) reject("request_invalid");
  let payer: Awaited<ReturnType<typeof resolvePayerForWorkspaceInTransaction>>;
  try { payer = await resolvePayerForWorkspaceInTransaction(tx, workspaceId); } catch (error) {
    // No active binding: the workspace is not billed today (status quo). A suspended payer fails closed.
    if (error instanceof Error && error.message === "payer_unresolved") reject("billing_mode_off");
    if (error instanceof Error && error.message === "payer_account_unavailable") reject("grant_not_active");
    throw error;
  }
  if (payer.billingMode === "off") reject("billing_mode_off");
  const grants = await tx.$queryRaw<Array<{ grantId: string; priceVersionId: string }>>`SELECT g.id AS grantId,
      g.priceVersionId FROM SpendGrant g JOIN BillingPriceVersion p ON p.id = g.priceVersionId
    WHERE g.payerAccountId = ${payer.payerAccountId} AND g.state = 'active' AND g.validFrom <= UTC_TIMESTAMP(3)
      AND g.validUntil > UTC_TIMESTAMP(3) AND p.billingEventRef = ${req.billingEventRef} AND p.meterUnit = ${req.meterUnit}
      AND p.effectiveFrom <= UTC_TIMESTAMP(3) AND (p.effectiveUntil IS NULL OR p.effectiveUntil > UTC_TIMESTAMP(3))
    ORDER BY g.id LIMIT 2`;
  if (grants.length !== 1) reject("grant_not_active");
  return { payerRef: payer.payerAccountId, grantId: grants[0].grantId, priceVersionId: grants[0].priceVersionId,
    mode: payer.billingMode };
}

/** BillingCoreClient-shaped entry points; S3-b3 routes call these with the authenticated service identity. */
export const reserve = (client: PrismaClient, actor: ServiceActor, req: ReserveRequest) =>
  asBillingResult(run(client, tx => reserveInTransaction(tx, actor, req)));
export const markUnknown = (client: PrismaClient, actor: ServiceActor, req: MarkUnknownRequest) =>
  asBillingResult(run(client, tx => markUnknownInTransaction(tx, actor, req)));
export const release = (client: PrismaClient, actor: ServiceActor, req: ReleaseRequest) =>
  asBillingResult(run(client, tx => releaseInTransaction(tx, actor, req)));
export const settle = (client: PrismaClient, actor: ServiceActor, req: SettleRequest) =>
  asBillingResult(run(client, tx => settleInTransaction(tx, actor, req)));
export const resolveUnknown = (client: PrismaClient, actor: ServiceActor, req: ResolveUnknownRequest) =>
  asBillingResult(run(client, tx => resolveUnknownInTransaction(tx, actor, req)));
export const quote = (client: PrismaClient, actor: ServiceActor, req: QuoteRequest) =>
  asBillingResult(run(client, tx => quoteInTransaction(tx, actor, req)));
