import "server-only";
import { createHash } from "node:crypto";
import { ActorType, Prisma, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { assertPositiveFen } from "./money";

/**
 * Billing V1 S2-a funds journal: one immutable, balanced integer-fen transaction per money effect; balances are a rebuildable
 * projection. Runs in the caller's transaction so journal, projection, audit and outbox commit or roll back together. It does
 * not authorize people: callers prove authority and pass a server-derived actor. Lock order: PayerAccount FOR UPDATE (S1-c),
 * then FundsTransaction, then projection rows in ascending account order.
 */
export const FUNDS_ACCOUNTS = ["bank_clearing", "charge_revenue", "correction_suspense", "credit_receivable",
  "customer_wallet_available", "overdraft_receivable", "topup_clearing"] as const;
export type FundsAccountName = (typeof FUNDS_ACCOUNTS)[number];
export type FundsDirection = "debit" | "credit";
export type FundsKind = "topup" | "correction" | "bank_topup" | "charge" | "credit_draw" | "overdraft_draw" | "overdraft_repay" |
  "credit_repay";
export type FundsEntryInput = { account: FundsAccountName; direction: FundsDirection; amountFen: bigint };
/** Server-derived actor; `ref` is a user id for USER or a service name for SYSTEM. */
export type FundsActor = { type: "USER" | "SYSTEM"; ref: string };
export type PostFundsInput = { payerAccountId: string; kind: FundsKind; operationKey: string; entries: FundsEntryInput[];
  actor: FundsActor; evidenceRef: string };
export type ReverseFundsInput = { payerAccountId: string; originalTransactionId: string; operationKey: string;
  actor: FundsActor; evidenceRef: string };
export type FundsRefusalCode = "funds_input_invalid" | "funds_unbalanced" | "funds_accounts_not_allowed" |
  "payer_account_unavailable" | "payer_billing_off" | "funds_operation_conflict" | "funds_insufficient" |
  "funds_projection_conflict" | "funds_write_conflict" | "funds_reversal_invalid" | "funds_already_reversed" |
  "funds_repay_invariant_breach";

export class FundsRefusal extends Error {
  constructor(readonly code: FundsRefusalCode) { super(code); this.name = "FundsRefusal"; }
}

const WALLET: FundsAccountName = "customer_wallet_available";
const ZERO = BigInt(0);
const SOURCE_PAGE = "/billing/funds";
function refuse(code: FundsRefusalCode): never { throw new FundsRefusal(code); }
function reference(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/.test(value)) refuse("funds_input_invalid");
}
function sha256(text: string) { return createHash("sha256").update(text).digest("hex"); }
/** Credit-normal for the customer wallet (a liability to the customer) and charge revenue; debit-normal for clearing (payment,
 * bank) and suspense. */
function signedDelta(account: FundsAccountName, direction: FundsDirection, amountFen: bigint) {
  const creditNormal = account === WALLET || account === "charge_revenue";
  return (direction === "credit") === creditNormal ? amountFen : -amountFen;
}

type Normalized = { payerAccountId: string; kind: FundsKind; operationKey: string; reversalOfId: string | null;
  evidenceRef: string; createdBy: string; actor: FundsActor; entries: FundsEntryInput[]; contentHash: string };

/** Module-private posting channels: `credit_draw` only from the credit module, `overdraft_draw` only from settle (C-OD),
 * `overdraft_repay` / `credit_repay` only from the inflow repayment (C-REPAY, credit/inflow-repay.ts). */
type PrivateKind = "credit_draw" | "overdraft_draw" | RepayKind;
export type RepayKind = "overdraft_repay" | "credit_repay";
const PRIVATE_KINDS: readonly FundsKind[] = ["credit_draw", "overdraft_draw", "overdraft_repay", "credit_repay"];
/** Pure validation. Lines are sorted by account so the content hash and line numbers ignore caller ordering. */
export function normalizeFundsPosting(input: PostFundsInput, reversalOfId: string | null = null,
  privateKind: PrivateKind | null = null): Normalized {
  if (!input || typeof input !== "object") refuse("funds_input_invalid");
  reference(input.payerAccountId); reference(input.operationKey); reference(input.evidenceRef);
  if (!input.actor || (input.actor.type !== "USER" && input.actor.type !== "SYSTEM")) refuse("funds_input_invalid");
  reference(input.actor.ref);
  if (!["topup", "correction", "bank_topup", "charge", "credit_draw", "overdraft_draw", "overdraft_repay", "credit_repay"]
    .includes(input.kind)) refuse("funds_input_invalid");
  // S3-e: a credit draw must move the facility's usedFen in the same transaction, so only the credit module may post one.
  // C-OD: an overdraft draw is only the settle shortfall left after wallet and credit, so only settle may post one.
  // C-REPAY: a repayment is computed under the payer lock from the inflow it follows, so only the inflow repayment may post one.
  if ((PRIVATE_KINDS.includes(input.kind) ? input.kind : null) !== privateKind) refuse("funds_accounts_not_allowed");
  if (reversalOfId !== null && input.kind !== "correction") refuse("funds_input_invalid");
  // `charge:` keys are reserved for settle postings (one per reservation, protocol v3.5).
  if ((input.kind === "charge") !== input.operationKey.startsWith(CHARGE_PREFIX)) refuse("funds_input_invalid");
  // C-REPAY: `overdraft-repay:` / `credit-repay:` keys are reserved the same way, so no other posting can occupy a repayment key.
  for (const [kind, prefix] of Object.entries(REPAY_PREFIX)) {
    if ((input.kind === kind) !== input.operationKey.startsWith(prefix)) refuse("funds_input_invalid");
  }
  const count = Array.isArray(input.entries) ? input.entries.length : 0;
  if (count < 2 || count > FUNDS_ACCOUNTS.length) refuse("funds_input_invalid");
  const entries = input.entries.map(entry => {
    if (!entry || !FUNDS_ACCOUNTS.includes(entry.account) || (entry.direction !== "debit" && entry.direction !== "credit")) {
      refuse("funds_input_invalid");
    }
    try { assertPositiveFen(entry.amountFen); } catch { refuse("funds_input_invalid"); }
    return { account: entry.account, direction: entry.direction, amountFen: entry.amountFen };
  }).sort((x, y) => (x.account < y.account ? -1 : x.account > y.account ? 1 : 0));
  if (new Set(entries.map(entry => entry.account)).size !== entries.length) refuse("funds_input_invalid");
  const total = (direction: FundsDirection) => entries.filter(entry => entry.direction === direction)
    .reduce((sum, entry) => sum + entry.amountFen, ZERO);
  if (total("debit") !== total("credit")) refuse("funds_unbalanced");
  if (reversalOfId === null) {
    const line = (account: FundsAccountName) => entries.find(entry => entry.account === account);
    // A topup is exactly: debit verified-payment clearing, credit the customer wallet.
    if (input.kind === "topup" && (entries.length !== 2 || line("topup_clearing")?.direction !== "debit" ||
        line(WALLET)?.direction !== "credit")) refuse("funds_accounts_not_allowed");
    // S2-c: a reviewed corporate bank receipt is exactly: debit bank clearing, credit the customer wallet.
    if (input.kind === "bank_topup" && (entries.length !== 2 || line("bank_clearing")?.direction !== "debit" ||
        line(WALLET)?.direction !== "credit")) refuse("funds_accounts_not_allowed");
    // A charge (S3-b2, settled reservation only) is exactly: debit the customer wallet, credit charge revenue.
    if (input.kind === "charge" && (entries.length !== 2 || line(WALLET)?.direction !== "debit" ||
        line("charge_revenue")?.direction !== "credit")) refuse("funds_accounts_not_allowed");
    // S3-e: a credit draw is exactly: debit credit receivable (the customer owes it), credit the customer wallet.
    if (input.kind === "credit_draw" && (entries.length !== 2 || line("credit_receivable")?.direction !== "debit" ||
        line(WALLET)?.direction !== "credit")) refuse("funds_accounts_not_allowed");
    // C-OD: an overdraft draw is exactly: debit overdraft receivable (the customer owes it), credit the customer wallet.
    if (input.kind === "overdraft_draw" && (entries.length !== 2 || line("overdraft_receivable")?.direction !== "debit" ||
        line(WALLET)?.direction !== "credit")) refuse("funds_accounts_not_allowed");
    // C-REPAY: repayments are exactly: debit the customer wallet, credit the receivable being repaid.
    if (input.kind === "overdraft_repay" && (entries.length !== 2 || line(WALLET)?.direction !== "debit" ||
        line("overdraft_receivable")?.direction !== "credit")) refuse("funds_accounts_not_allowed");
    if (input.kind === "credit_repay" && (entries.length !== 2 || line(WALLET)?.direction !== "debit" ||
        line("credit_receivable")?.direction !== "credit")) refuse("funds_accounts_not_allowed");
    // A free correction moves value only between the wallet and correction suspense; reversals mirror the original.
    if (input.kind === "correction" && (entries.length !== 2 || !line("correction_suspense") || !line(WALLET))) {
      refuse("funds_accounts_not_allowed");
    }
  }
  const createdBy = `${input.actor.type}:${input.actor.ref}`;
  const basis = JSON.stringify({ v: 1, payerAccountId: input.payerAccountId, kind: input.kind,
    operationKey: input.operationKey, reversalOfId, currency: "CNY", evidenceRef: input.evidenceRef,
    entries: entries.map(entry => [entry.account, entry.direction, entry.amountFen.toString()]) });
  return { payerAccountId: input.payerAccountId, kind: input.kind, operationKey: input.operationKey, reversalOfId,
    evidenceRef: input.evidenceRef, createdBy, actor: input.actor, entries, contentHash: sha256(basis) };
}

type PayerRow = { id: string; status: string; billingMode: string; currency: string; governingWorkspaceId: string | null };
async function lockPayer(tx: Prisma.TransactionClient, payerAccountId: string) {
  const [payer] = await tx.$queryRaw<PayerRow[]>`
    SELECT id, status, billingMode, currency, governingWorkspaceId FROM PayerAccount
    WHERE id = ${payerAccountId} AND CAST(id AS BINARY) = CAST(${payerAccountId} AS BINARY) FOR UPDATE`;
  if (!payer || payer.id !== payerAccountId) refuse("payer_account_unavailable");
  return payer;
}

type TransactionRow = { id: string; payerAccountId: string; kind: FundsKind; operationKey: string; contentHash: string;
  reversalOfId: string | null; currency: string; evidenceRef: string; createdBy: string; createdAt: Date };
type EntryRow = { id: string; transactionId: string; lineNo: number; account: FundsAccountName;
  direction: FundsDirection; amountFen: bigint };
export type PostedFunds = { transaction: TransactionRow; entries: EntryRow[]; replayed: boolean };

// Locking (current) reads throughout: under REPEATABLE READ a plain read could return a snapshot older than the lock.
async function readEntries(tx: Prisma.TransactionClient, transactionId: string) {
  const rows = await tx.$queryRaw<EntryRow[]>`
    SELECT id, transactionId, lineNo, account, direction, amountFen FROM FundsJournalEntry
    WHERE transactionId = ${transactionId} ORDER BY lineNo FOR SHARE`;
  return rows.map(row => ({ ...row, lineNo: Number(row.lineNo), amountFen: BigInt(row.amountFen) }));
}
async function readTransaction(tx: Prisma.TransactionClient, where: Prisma.Sql) {
  const [row] = await tx.$queryRaw<TransactionRow[]>`
    SELECT id, payerAccountId, kind, operationKey, contentHash, reversalOfId, currency, evidenceRef, createdBy, createdAt
    FROM FundsTransaction WHERE ${where} FOR SHARE`;
  return row ?? null;
}

async function postLocked(tx: Prisma.TransactionClient, payer: PayerRow, posting: Normalized): Promise<PostedFunds> {
  const existing = await readTransaction(tx, Prisma.sql`payerAccountId = ${posting.payerAccountId}
    AND operationKey = ${posting.operationKey}`);
  if (existing) {
    // Same key: replay only byte-identical content; never a second effect, never a silent overwrite.
    if (existing.contentHash !== posting.contentHash || existing.kind !== posting.kind ||
        existing.reversalOfId !== posting.reversalOfId) refuse("funds_operation_conflict");
    return { transaction: existing, entries: await readEntries(tx, existing.id), replayed: true };
  }
  // A `charge` (or the `credit_draw` that funds it) only settles a reservation admitted while the payer was active and billing
  // on; R05 / protocol v3.5: delivered results are still charged after a suspension or switch to off (those block new reserves
  // only). Every other posting is refused.
  const settling = await settlingReservationInTransaction(tx, posting.payerAccountId, posting.kind, posting.operationKey) !== null;
  if ((payer.status !== "active" && !settling) || payer.currency !== "CNY" || !payer.governingWorkspaceId) refuse("payer_account_unavailable");
  // S2-a decision: shadow and enforce accounts may hold a journal; off accounts may not move money at all (except the above).
  if (payer.billingMode !== "shadow" && payer.billingMode !== "enforce" && !settling) refuse("payer_billing_off");
  const reversed = posting.reversalOfId && await readTransaction(tx, Prisma.sql`reversalOfId = ${posting.reversalOfId}`);
  if (reversed) refuse("funds_already_reversed");
  let transaction: TransactionRow;
  try {
    transaction = await tx.fundsTransaction.create({ data: { payerAccountId: posting.payerAccountId, kind: posting.kind,
      operationKey: posting.operationKey, contentHash: posting.contentHash, reversalOfId: posting.reversalOfId,
      currency: "CNY", evidenceRef: posting.evidenceRef, createdBy: posting.createdBy } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") refuse("funds_write_conflict");
    throw error;
  }
  await tx.fundsJournalEntry.createMany({ data: posting.entries.map((entry, index) => ({ transactionId: transaction.id,
    lineNo: index + 1, payerAccountId: posting.payerAccountId, account: entry.account, direction: entry.direction,
    amountFen: entry.amountFen })) });
  for (const entry of posting.entries) { // already in ascending account order: deterministic projection lock order
    const delta = signedDelta(entry.account, entry.direction, entry.amountFen);
    await tx.$executeRaw`INSERT INTO FundsAccountProjection (payerAccountId, account, balanceFen, version, updatedAt)
      VALUES (${posting.payerAccountId}, ${entry.account}, 0, 0, CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE payerAccountId = payerAccountId`;
    const [projection] = await tx.$queryRaw<Array<{ balanceFen: bigint; version: number }>>`
      SELECT balanceFen, version FROM FundsAccountProjection
      WHERE payerAccountId = ${posting.payerAccountId} AND account = ${entry.account} FOR UPDATE`;
    if (!projection) refuse("funds_projection_conflict");
    if (entry.account === WALLET && BigInt(projection.balanceFen) + delta < ZERO) refuse("funds_insufficient");
    // Version CAS plus the non-negative guard in the UPDATE's own WHERE; the table CHECK is the last line.
    const changed = await tx.$executeRaw`UPDATE FundsAccountProjection
      SET balanceFen = balanceFen + ${delta}, version = version + 1, updatedAt = CURRENT_TIMESTAMP(3)
      WHERE payerAccountId = ${posting.payerAccountId} AND account = ${entry.account}
        AND version = ${Number(projection.version)}
        AND (account <> 'customer_wallet_available' OR balanceFen + ${delta} >= 0)`;
    if (changed !== 1) refuse("funds_projection_conflict");
  }
  const entries = await readEntries(tx, transaction.id);
  const summary = { transactionId: transaction.id, payerAccountId: posting.payerAccountId, kind: posting.kind,
    operationKey: posting.operationKey, contentHash: posting.contentHash, reversalOfId: posting.reversalOfId,
    evidenceRef: posting.evidenceRef, currency: "CNY",
    entries: entries.map(entry => ({ account: entry.account, direction: entry.direction, amountFen: entry.amountFen.toString() })) };
  await writeAuditLog({ workspaceId: payer.governingWorkspaceId, userId: posting.actor.type === "USER" ? posting.actor.ref : null,
    actor: posting.createdBy, actorType: posting.actor.type === "USER" ? ActorType.USER : ActorType.SYSTEM,
    actionType: posting.reversalOfId ? "BILLING_FUNDS_REVERSED" : "BILLING_FUNDS_POSTED", targetType: "FundsTransaction",
    targetId: transaction.id, summary: `Posted ${posting.kind} funds transaction`, sourcePage: SOURCE_PAGE,
    relatedObjectType: "PayerAccount", relatedObjectId: posting.payerAccountId, payload: summary }, { client: tx });
  const payload = JSON.stringify(summary);
  await tx.billingOutbox.create({ data: { aggregateType: "FundsTransaction", aggregateId: transaction.id,
    eventType: "funds.posted", payload, payloadHash: sha256(payload) } });
  return { transaction, entries, replayed: false };
}

// Settle-bound operation keys, shared by funds, credit and reservations: `charge:<reservationId>`,
// `credit-draw:<sourceRef>` with sourceRef `reservation:<reservationId>` for the settle shortfall draw, and (C-OD)
// `overdraft-draw:reservation:<reservationId>` for what remains after wallet and credit.
const CHARGE_PREFIX = "charge:", DRAW_PREFIX = "credit-draw:", SETTLE_SOURCE_PREFIX = "reservation:";
const OVERDRAFT_PREFIX = "overdraft-draw:reservation:";
// C-REPAY keys, bound to the inflow funds transaction they follow: `overdraft-repay:<inflowId>` and, one per facility repaid,
// `credit-repay:<inflowId>:<facilityId>`.
const REPAY_PREFIX: Record<RepayKind, string> = { overdraft_repay: "overdraft-repay:", credit_repay: "credit-repay:" };
export const overdraftRepayOperationKey = (inflowTransactionId: string) => `${REPAY_PREFIX.overdraft_repay}${inflowTransactionId}`;
export const creditRepayKeyPrefix = (inflowTransactionId: string) => `${REPAY_PREFIX.credit_repay}${inflowTransactionId}:`;
export const creditRepayOperationKey = (inflowTransactionId: string, facilityId: string) =>
  `${creditRepayKeyPrefix(inflowTransactionId)}${facilityId}`;
export const chargeOperationKey = (reservationId: string) => `${CHARGE_PREFIX}${reservationId}`;
export const settleDrawSourceRef = (reservationId: string) => `${SETTLE_SOURCE_PREFIX}${reservationId}`;
export const isSettleDrawSourceRef = (sourceRef: string) => sourceRef.startsWith(SETTLE_SOURCE_PREFIX);
export const creditDrawOperationKey = (sourceRef: string) => `${DRAW_PREFIX}${sourceRef}`;
const SETTLING_PREFIX: Partial<Record<FundsKind, string>> = { charge: CHARGE_PREFIX, credit_draw: creditDrawOperationKey(SETTLE_SOURCE_PREFIX),
  overdraft_draw: OVERDRAFT_PREFIX };
/**
 * The suspended/off-payer exemption is bound to one reservation: `charge:<id>`, `credit-draw:reservation:<id>` or
 * `overdraft-draw:reservation:<id>` must name this
 * payer's held or unknown enforce reservation (locked by settle; resolveUnknown posts while the row is still unknown and moves it
 * to settled afterwards). Returns that row's frozen `reservedAt` and cap `chargeFen`, or null for any other posting.
 */
export async function settlingReservationInTransaction(tx: Prisma.TransactionClient, payerAccountId: string, kind: FundsKind,
  operationKey: string): Promise<{ reservedAt: Date; chargeFen: bigint } | null> {
  const prefix = SETTLING_PREFIX[kind];
  if (!prefix || !operationKey.startsWith(prefix)) return null;
  const [row] = await tx.$queryRaw<Array<{ reservedAt: Date; chargeFen: bigint }>>`SELECT reservedAt, chargeFen FROM BillingReservation
    WHERE id = ${operationKey.slice(prefix.length)} AND payerAccountId = ${payerAccountId}
      AND billingMode = 'enforce' AND state IN ('held', 'unknown') FOR SHARE`;
  return row ? { reservedAt: row.reservedAt, chargeFen: BigInt(row.chargeFen) } : null;
}

/** Σ chargeFen of the payer's enforce held/unknown reservations: the `held` of reserve admission (and of balance-status), read
 * while the PayerAccount lock is held (every hold writer takes it first). Plain, it is current only under READ COMMITTED (or before
 * any earlier consistent read); `forShare` makes it a locking read, which reads the latest committed rows in any isolation level. */
export async function heldEnforceFenInTransaction(tx: Prisma.TransactionClient, payerAccountId: string, forShare = false) {
  const [{ held }] = await tx.$queryRaw<Array<{ held: bigint }>>`SELECT CAST(COALESCE(SUM(chargeFen), 0) AS SIGNED) AS held
    FROM BillingReservation WHERE payerAccountId = ${payerAccountId} AND billingMode = 'enforce' AND state IN ('held', 'unknown')
    ${forShare ? Prisma.sql`FOR SHARE` : Prisma.empty}`;
  return BigInt(held);
}

/** Conflicts that abort the whole transaction and are safe to re-run: Prisma P2034, a MySQL 1213 deadlock from a raw query
 * (P2010), or a concurrent same-key insert (`funds_write_conflict`). */
export function isRetryableFundsConflict(error: unknown) {
  if (error instanceof FundsRefusal) return error.code === "funds_write_conflict";
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const dbCode = String((error.meta as { code?: unknown } | undefined)?.code ?? "");
  return error.code === "P2034" || (error.code === "P2010" && (dbCode === "1213" || /Deadlock found/i.test(error.message)));
}

/** Runs a money transaction with a bounded retry on those conflicts; when attempts run out it refuses `funds_write_conflict`. */
export async function runFundsTransactionWithRetry<T>(client: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 3, isolationLevel?: Prisma.TransactionIsolationLevel): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try { return await client.$transaction(run, { maxWait: 5000, timeout: 10000, isolationLevel }); } catch (error) {
      if (!isRetryableFundsConflict(error)) throw error;
      if (attempt >= attempts) refuse("funds_write_conflict");
      await new Promise(resolve => setTimeout(resolve, 5 * attempt + Math.floor(Math.random() * 10)));
    }
  }
}

export async function postFundsTransactionInTransaction(tx: Prisma.TransactionClient, input: PostFundsInput) {
  const posting = normalizeFundsPosting(input);
  return postLocked(tx, await lockPayer(tx, posting.payerAccountId), posting);
}

/** S3-e only: posts a `credit_draw`; `drawCreditShortfallInTransaction` moves the facility's usedFen in the same transaction. */
export async function postCreditDrawFundsInTransaction(tx: Prisma.TransactionClient, input: PostFundsInput) {
  const posting = normalizeFundsPosting(input, null, "credit_draw");
  return postLocked(tx, await lockPayer(tx, posting.payerAccountId), posting);
}

export type SettleChargeFundsInput = { payerAccountId: string; reservationId: string; chargeFen: bigint; actor: FundsActor;
  evidenceRef: string };
/**
 * The funds leg of a settle (S3-b2 charge; C-OD overdraft), under the PayerAccount lock. The reservation is re-read in-lock: this
 * payer's held/unknown enforce reservation with 0 < chargeFen <= its cap. For a `post_delivery` reservation, what the locked
 * wallet still lacks for `chargeFen` (computed here, never passed in) is first posted as one `overdraft_draw` (debit
 * overdraft_receivable, credit the wallet; key bound to the reservation; the soft limit is never compared, design Q9); then the
 * `charge` (debit the wallet, credit charge_revenue, `charge:<reservationId>`) is posted in the same call. So an overdraft only
 * ever exists together with the same reservation's charge, in one transaction; there is no other entry point for
 * `overdraft_draw`. Any other reservation never overdraws: a wallet short of `chargeFen` refuses `funds_insufficient` as before.
 * Trust boundary (as for postCreditDrawFundsInTransaction): in-process callers are trusted to call this only from settle, which
 * borrows credit first and writes the BillingCharge row, state change and buckets in the same transaction. A recorded overdraft
 * or charge under these keys means the reservation was already settled: an invariant breach (settle replays before this).
 */
export async function postSettleChargeFundsInTransaction(tx: Prisma.TransactionClient, input: SettleChargeFundsInput) {
  reference(input.reservationId); reference(input.evidenceRef);
  const payer = await lockPayer(tx, input.payerAccountId);
  const [open] = await tx.$queryRaw<Array<{ chargeFen: bigint; admission: string }>>`SELECT chargeFen, admission FROM BillingReservation
    WHERE id = ${input.reservationId} AND payerAccountId = ${input.payerAccountId} AND billingMode = 'enforce'
      AND state IN ('held', 'unknown') FOR SHARE`;
  if (!open || typeof input.chargeFen !== "bigint" || input.chargeFen <= ZERO || input.chargeFen > BigInt(open.chargeFen)) {
    refuse("funds_input_invalid");
  }
  if (open.admission === "post_delivery") {
    const [wallet] = await tx.$queryRaw<Array<{ balanceFen: bigint }>>`SELECT balanceFen FROM FundsAccountProjection
      WHERE payerAccountId = ${input.payerAccountId} AND account = 'customer_wallet_available' FOR UPDATE`;
    const shortfall = input.chargeFen - BigInt(wallet?.balanceFen ?? ZERO);
    if (shortfall > ZERO) {
      const overdraft = await postLocked(tx, payer, normalizeFundsPosting({ payerAccountId: input.payerAccountId, kind: "overdraft_draw",
        operationKey: `${OVERDRAFT_PREFIX}${input.reservationId}`, actor: input.actor, evidenceRef: `reservation:${input.reservationId}`,
        entries: [{ account: "overdraft_receivable", direction: "debit", amountFen: shortfall },
          { account: WALLET, direction: "credit", amountFen: shortfall }] }, null, "overdraft_draw"));
      if (overdraft.replayed) throw new Error("funds_settle_invariant_breach");
    }
  }
  const charge = await postLocked(tx, payer, normalizeFundsPosting({ payerAccountId: input.payerAccountId, kind: "charge",
    operationKey: chargeOperationKey(input.reservationId), actor: input.actor, evidenceRef: input.evidenceRef,
    entries: [{ account: WALLET, direction: "debit", amountFen: input.chargeFen },
      { account: "charge_revenue", direction: "credit", amountFen: input.chargeFen }] }));
  if (charge.replayed) throw new Error("funds_settle_invariant_breach");
  return charge;
}

/** C-REPAY only: posts an `overdraft_repay` or `credit_repay`; repayArrearsFromInflowInTransaction computes the amount under the
 * payer lock and, for `credit_repay`, lowers the facility's usedFen in the same transaction. */
export async function postRepayFundsInTransaction(tx: Prisma.TransactionClient, input: PostFundsInput & { kind: RepayKind }) {
  const posting = normalizeFundsPosting(input, null, input.kind);
  return postLocked(tx, await lockPayer(tx, posting.payerAccountId), posting);
}

/** Appends a mirror transaction (each line's direction swapped) referencing the original; nothing is edited or deleted. */
export async function reverseFundsTransactionInTransaction(tx: Prisma.TransactionClient, input: ReverseFundsInput) {
  reference(input.payerAccountId); reference(input.originalTransactionId);
  const payer = await lockPayer(tx, input.payerAccountId);
  const original = await readTransaction(tx, Prisma.sql`id = ${input.originalTransactionId}`);
  if (!original || original.id !== input.originalTransactionId || original.payerAccountId !== input.payerAccountId ||
      original.reversalOfId !== null || original.kind === "charge" || PRIVATE_KINDS.includes(original.kind)) {
    refuse("funds_reversal_invalid"); // C-REPAY: a reversed repayment would raise the receivable without its facility's usedFen
  }
  const mirrored = (await readEntries(tx, original.id)).map(entry => ({ account: entry.account,
    direction: entry.direction === "debit" ? "credit" as const : "debit" as const, amountFen: entry.amountFen }));
  const posting = normalizeFundsPosting({ payerAccountId: input.payerAccountId, kind: "correction",
    operationKey: input.operationKey, entries: mirrored, actor: input.actor, evidenceRef: input.evidenceRef }, original.id);
  return postLocked(tx, payer, posting);
}

export type FundsProjectionReport = { payerAccountId: string; consistent: boolean; unbalancedTransactionIds: string[];
  accounts: Array<{ account: FundsAccountName; journalFen: bigint; projectionFen: bigint; driftFen: bigint }> };

/** Rebuilds every balance from the entries and reports drift against the projection; it never repairs silently. */
export async function recomputeFundsProjection(tx: Prisma.TransactionClient, payerAccountId: string): Promise<FundsProjectionReport> {
  reference(payerAccountId);
  await lockPayer(tx, payerAccountId);
  const transactions = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM FundsTransaction WHERE payerAccountId = ${payerAccountId} FOR SHARE`;
  const entries = await tx.$queryRaw<EntryRow[]>`
    SELECT id, transactionId, lineNo, account, direction, amountFen FROM FundsJournalEntry
    WHERE payerAccountId = ${payerAccountId} FOR SHARE`;
  const projections = await tx.$queryRaw<Array<{ account: FundsAccountName; balanceFen: bigint }>>`
    SELECT account, balanceFen FROM FundsAccountProjection WHERE payerAccountId = ${payerAccountId} FOR SHARE`;
  const journal = new Map<string, bigint>(), net = new Map<string, bigint>(), lines = new Map<string, number>();
  for (const transaction of transactions) { net.set(transaction.id, ZERO); lines.set(transaction.id, 0); }
  for (const entry of entries) {
    const amount = BigInt(entry.amountFen);
    journal.set(entry.account, (journal.get(entry.account) ?? ZERO) + signedDelta(entry.account, entry.direction, amount));
    net.set(entry.transactionId, (net.get(entry.transactionId) ?? ZERO) + (entry.direction === "debit" ? amount : -amount));
    lines.set(entry.transactionId, (lines.get(entry.transactionId) ?? 0) + 1);
  }
  const unbalancedTransactionIds = [...net.keys()].filter(id => net.get(id) !== ZERO || (lines.get(id) ?? 0) < 2).sort();
  const accounts = FUNDS_ACCOUNTS.map(account => {
    const journalFen = journal.get(account) ?? ZERO;
    const row = projections.find(projection => projection.account === account);
    const projectionFen = row ? BigInt(row.balanceFen) : ZERO;
    return { account, journalFen, projectionFen, driftFen: projectionFen - journalFen };
  });
  return { payerAccountId, unbalancedTransactionIds, accounts,
    consistent: unbalancedTransactionIds.length === 0 && accounts.every(account => account.driftFen === ZERO) };
}
