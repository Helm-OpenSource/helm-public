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
export const FUNDS_ACCOUNTS = ["bank_clearing", "correction_suspense", "credit_receivable", "customer_wallet_available",
  "topup_clearing"] as const;
export type FundsAccountName = (typeof FUNDS_ACCOUNTS)[number];
export type FundsDirection = "debit" | "credit";
export type FundsKind = "topup" | "correction" | "bank_topup" | "credit_draw";
export type FundsEntryInput = { account: FundsAccountName; direction: FundsDirection; amountFen: bigint };
/** Server-derived actor; `ref` is a user id for USER or a service name for SYSTEM. */
export type FundsActor = { type: "USER" | "SYSTEM"; ref: string };
export type PostFundsInput = { payerAccountId: string; kind: FundsKind; operationKey: string; entries: FundsEntryInput[];
  actor: FundsActor; evidenceRef: string };
export type ReverseFundsInput = { payerAccountId: string; originalTransactionId: string; operationKey: string;
  actor: FundsActor; evidenceRef: string };
export type FundsRefusalCode = "funds_input_invalid" | "funds_unbalanced" | "funds_accounts_not_allowed" |
  "payer_account_unavailable" | "payer_billing_off" | "funds_operation_conflict" | "funds_insufficient" |
  "funds_projection_conflict" | "funds_write_conflict" | "funds_reversal_invalid" | "funds_already_reversed";

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
/** Credit-normal for the customer wallet (a liability to the customer); debit-normal for clearing (payment, bank) and suspense. */
function signedDelta(account: FundsAccountName, direction: FundsDirection, amountFen: bigint) {
  const creditNormal = account === WALLET;
  return (direction === "credit") === creditNormal ? amountFen : -amountFen;
}

type Normalized = { payerAccountId: string; kind: FundsKind; operationKey: string; reversalOfId: string | null;
  evidenceRef: string; createdBy: string; actor: FundsActor; entries: FundsEntryInput[]; contentHash: string };

/** Pure validation. Lines are sorted by account so the content hash and line numbers ignore caller ordering. */
export function normalizeFundsPosting(input: PostFundsInput, reversalOfId: string | null = null, creditDraw = false): Normalized {
  if (!input || typeof input !== "object") refuse("funds_input_invalid");
  reference(input.payerAccountId); reference(input.operationKey); reference(input.evidenceRef);
  if (!input.actor || (input.actor.type !== "USER" && input.actor.type !== "SYSTEM")) refuse("funds_input_invalid");
  reference(input.actor.ref);
  if (input.kind !== "topup" && input.kind !== "correction" && input.kind !== "bank_topup" && input.kind !== "credit_draw") {
    refuse("funds_input_invalid");
  }
  // S3-e: a credit draw must move the facility's usedFen in the same transaction, so only the credit module may post one.
  if ((input.kind === "credit_draw") !== creditDraw) refuse("funds_accounts_not_allowed");
  if (reversalOfId !== null && input.kind !== "correction") refuse("funds_input_invalid");
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
    // S3-e: a credit draw is exactly: debit credit receivable (the customer owes it), credit the customer wallet.
    if (input.kind === "credit_draw" && (entries.length !== 2 || line("credit_receivable")?.direction !== "debit" ||
        line(WALLET)?.direction !== "credit")) refuse("funds_accounts_not_allowed");
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
  if (payer.status !== "active" || payer.currency !== "CNY" || !payer.governingWorkspaceId) refuse("payer_account_unavailable");
  // S2-a decision: shadow and enforce accounts may hold a journal; off accounts may not move money at all.
  if (payer.billingMode !== "shadow" && payer.billingMode !== "enforce") refuse("payer_billing_off");
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
  attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try { return await client.$transaction(run, { maxWait: 5000, timeout: 10000 }); } catch (error) {
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

/** S3-e only: posts a `credit_draw`; `drawCreditInTransaction` moves the facility's usedFen in the same transaction. */
export async function postCreditDrawFundsInTransaction(tx: Prisma.TransactionClient, input: PostFundsInput) {
  const posting = normalizeFundsPosting(input, null, true);
  return postLocked(tx, await lockPayer(tx, posting.payerAccountId), posting);
}

/** Appends a mirror transaction (each line's direction swapped) referencing the original; nothing is edited or deleted. */
export async function reverseFundsTransactionInTransaction(tx: Prisma.TransactionClient, input: ReverseFundsInput) {
  reference(input.payerAccountId); reference(input.originalTransactionId);
  const payer = await lockPayer(tx, input.payerAccountId);
  const original = await readTransaction(tx, Prisma.sql`id = ${input.originalTransactionId}`);
  if (!original || original.id !== input.originalTransactionId || original.payerAccountId !== input.payerAccountId ||
      original.reversalOfId !== null || original.kind === "credit_draw") refuse("funds_reversal_invalid"); // S5 repays credit
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
