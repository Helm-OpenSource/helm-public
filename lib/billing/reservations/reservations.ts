import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { MAX_FEN } from "../funds/money";
import { type BillingPeriodKeys, lockSpendGrantForUseInTransaction, SpendGrantRefusal, type SpendGrantRefusalCode,
  type SpendGrantRow } from "../grants/price-grants";

/**
 * Billing V1 S3-b reservations on the S3 internal protocol (docs/operations/BILLING_RESERVATIONS.md); nothing auto-releases and
 * shadow never moves money. Lock order: Membership -> PayerAccount FOR UPDATE (per-payer mutex) -> SpendGrant -> BudgetBucket
 * day, month -> BillingReservation; the bucket CAS and limit guard in the UPDATE's own WHERE are the second line.
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
/** Maps refusals to `{ ok: false, code }`. An invariant breach or unexpected error propagates (callers see core_unavailable). */
export async function asBillingResult<T extends object>(work: Promise<T>): Promise<({ ok: true } & T) | { ok: false; code: BillingRejectCode }> {
  try { return { ok: true, ...(await work) }; } catch (error) {
    if (error instanceof BillingReject) return { ok: false, code: error.code };
    const mapped = error instanceof SpendGrantRefusal ? GRANT_REJECTS[error.code] : undefined;
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
    if (BigInt(wallet?.balanceFen ?? ZERO) - BigInt(held) < chargeFen) reject("insufficient_funds");
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
  priceContentHash: string; quantity: bigint; chargeFen: bigint; state: string; version: number; unknownKey: string | null;
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
    priceContentHash, quantity, chargeFen, state, version, unknownKey, unknownEvidenceRef, resolutionKey, releaseReason,
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
  const resolvedBy = serviceActor(actor);
  idempotencyKey(req?.idempotencyKey); reference(req.evidenceRef);
  if (!RELEASE_REASONS.includes(req.reasonCode)) reject("request_invalid");
  const { reservation, buckets } = await lockReservationForResolution(tx, req.reservationId, req.operationRef);
  if (reservation.resolutionKey === req.idempotencyKey) {
    if (reservation.state !== "released" || reservation.releaseReason !== req.reasonCode ||
        reservation.resolutionEvidenceRef !== req.evidenceRef) reject("idempotency_conflict");
    return { state: "released" as const };
  }
  if (reservation.state !== "held") reject("reservation_state_conflict"); // unknown leaves only via resolveUnknown (S3-b2)
  await keyFree(tx, reservation, "resolutionKey", req.idempotencyKey);
  for (const bucket of buckets) {
    await moveBucket(tx, reservation.grantId, reservation.billingMode, bucket, { reservedDelta: -reservation.chargeFen, settledDelta: ZERO, ceiling: null });
  }
  await transition(tx, reservation, Prisma.sql`state = 'released', releaseReason = ${req.reasonCode}, resolutionKey = ${req.idempotencyKey},
    resolutionEvidenceRef = ${req.evidenceRef}, resolvedBy = ${resolvedBy}, resolvedAt = UTC_TIMESTAMP(3)`);
  return { state: "released" as const };
}

/** BillingCoreClient-shaped entry points; S3-b3 routes call these with the authenticated service identity. */
export const reserve = (client: PrismaClient, actor: ServiceActor, req: ReserveRequest) =>
  asBillingResult(run(client, tx => reserveInTransaction(tx, actor, req)));
export const markUnknown = (client: PrismaClient, actor: ServiceActor, req: MarkUnknownRequest) =>
  asBillingResult(run(client, tx => markUnknownInTransaction(tx, actor, req)));
export const release = (client: PrismaClient, actor: ServiceActor, req: ReleaseRequest) =>
  asBillingResult(run(client, tx => releaseInTransaction(tx, actor, req)));
