import "server-only";
import { ActorType, Prisma, type BankReceipt, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { HELM_RESERVED_WORKSPACE_SYSTEM_KEY } from "@/lib/workspace-identity";
import { postFundsTransactionInTransaction } from "../funds/funds-journal";
import { assertPositiveFen } from "../funds/money";

/**
 * Billing V1 S2-c corporate bank receipts (对公到账). A platform finance maker drafts a receipt from the bank fact; a different
 * platform finance checker approves (posting a `bank_topup` in the same Core transaction) or rejects it. Authority is a DB-backed
 * `PlatformFinanceGrant` held by an ACTIVE, unscoped member of the operational Helm reserved workspace; grants are issued only by
 * that workspace's OWNER (never to themselves). Workspace roles, BILLING_ADMIN and service identities have no path here.
 * Lock order: PlatformFinanceGrant (share) -> PayerAccount FOR UPDATE -> BankReceipt FOR UPDATE -> funds rows (S2-a).
 */
export type PlatformFinanceRoleName = "maker" | "checker";
export type BankReceiptDraftInput = { actorUserId: string; payerAccountId: string; receivingAccountRef: string; bankTxnRef: string;
  payerNameDigest?: string | null; amountFen: bigint; valueDate: string; evidenceRef: string };
export type BankReceiptReviewInput = { actorUserId: string; receiptId: string; decision: "approve" | "reject";
  expectedVersion: number; evidenceRef: string };
export type BankReceiptRefusalCode = "bank_receipt_input_invalid" | "bank_receipt_forbidden" | "bank_receipt_self_review_forbidden" |
  "bank_receipt_duplicate" | "bank_receipt_unavailable" | "bank_receipt_not_pending" | "bank_receipt_version_conflict" |
  "bank_receipt_posting_conflict" | "payer_account_unavailable" | "payer_billing_off" | "finance_grant_forbidden" |
  "finance_grant_exists" | "finance_grant_unavailable";

export class BankReceiptRefusal extends Error {
  constructor(readonly code: BankReceiptRefusalCode) { super(code); this.name = "BankReceiptRefusal"; }
}

const SOURCE_PAGE = "/billing/bank-receipts";
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
// Keyed digest computed outside Core, or an opaque evidence reference. Plaintext names (any non-ASCII or space) never match.
const NAME_DIGEST = /^(hmac-sha256:[a-f0-9]{64}|ref:[A-Za-z0-9._:-]{1,120})$/;
function refuse(code: BankReceiptRefusalCode): never { throw new BankReceiptRefusal(code); }
function reference(value: unknown, code: BankReceiptRefusalCode = "bank_receipt_input_invalid"): asserts value is string {
  if (typeof value !== "string" || !REF.test(value)) refuse(code);
}
function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Pure validation of a draft; returns the row data. `valueDate` is a real calendar date `YYYY-MM-DD`. */
export function normalizeBankReceiptDraft(input: BankReceiptDraftInput) {
  if (!input || typeof input !== "object") refuse("bank_receipt_input_invalid");
  reference(input.actorUserId, "bank_receipt_forbidden");
  for (const value of [input.payerAccountId, input.receivingAccountRef, input.bankTxnRef, input.evidenceRef]) reference(value);
  if (input.payerNameDigest != null && (typeof input.payerNameDigest !== "string" || !NAME_DIGEST.test(input.payerNameDigest))) {
    refuse("bank_receipt_input_invalid");
  }
  try { assertPositiveFen(input.amountFen); } catch { refuse("bank_receipt_input_invalid"); }
  const date = typeof input.valueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.valueDate)
    ? new Date(`${input.valueDate}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.valueDate) refuse("bank_receipt_input_invalid");
  return { payerAccountId: input.payerAccountId, receivingAccountRef: input.receivingAccountRef, bankTxnRef: input.bankTxnRef,
    activeBankTxnRef: input.bankTxnRef, payerNameDigest: input.payerNameDigest ?? null, amountFen: input.amountFen, currency: "CNY",
    valueDate: date, draftedByUserId: input.actorUserId, evidenceRef: input.evidenceRef };
}

/** Membership of the operational Helm reserved workspace: ACTIVE, unscoped, optionally a specific role. Share-locks it. */
async function lockReservedMember(tx: Prisma.TransactionClient, userId: string, ownerOnly: boolean) {
  const [row] = await tx.$queryRaw<Array<{ workspaceId: string; role: string }>>`
    SELECT m.workspaceId, m.role FROM Membership m JOIN Workspace w ON w.id = m.workspaceId
    WHERE w.systemKey = ${HELM_RESERVED_WORKSPACE_SYSTEM_KEY} AND w.workspaceClass = 'HELM_RESERVED' AND w.status = 'ACTIVE'
      AND m.userId = ${userId} AND CAST(m.userId AS BINARY) = CAST(${userId} AS BINARY) AND m.status = 'ACTIVE'
      AND (m.accessScope IS NULL OR m.accessScope = '') FOR SHARE OF m`;
  return row && (!ownerOnly || row.role === "OWNER") ? row.workspaceId : null;
}

/** Requires an active grant of `role` held by a current reserved-workspace member; returns that workspace id for audit. */
async function lockFinanceActor(tx: Prisma.TransactionClient, userId: string, role: PlatformFinanceRoleName) {
  const [grant] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM PlatformFinanceGrant WHERE role = ${role} AND state = 'active' AND activeUserId = ${userId} FOR SHARE`;
  const workspaceId = grant ? await lockReservedMember(tx, userId, false) : null;
  if (!workspaceId) refuse("bank_receipt_forbidden");
  return workspaceId;
}

function transaction<T>(client: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  return client.$transaction(run, { maxWait: 5000, timeout: 10000 }); // no automatic retry: re-read and decide again
}

export async function grantPlatformFinanceRole(client: PrismaClient,
  input: { actorUserId: string; userId: string; role: PlatformFinanceRoleName; evidenceRef: string }) {
  reference(input.actorUserId, "finance_grant_forbidden"); reference(input.userId); reference(input.evidenceRef);
  if (input.role !== "maker" && input.role !== "checker") refuse("bank_receipt_input_invalid");
  if (input.userId === input.actorUserId) refuse("finance_grant_forbidden");
  return transaction(client, async tx => {
    const workspaceId = await lockReservedMember(tx, input.actorUserId, true);
    if (!workspaceId || !(await lockReservedMember(tx, input.userId, false))) refuse("finance_grant_forbidden");
    const grant = await tx.platformFinanceGrant.create({ data: { userId: input.userId, role: input.role,
      activeUserId: input.userId, grantedByUserId: input.actorUserId, evidenceRef: input.evidenceRef } })
      .catch((error: unknown) => { if (isUniqueViolation(error)) refuse("finance_grant_exists"); throw error; });
    await writeAuditLog({ workspaceId, userId: input.actorUserId, actor: input.actorUserId, actorType: ActorType.USER,
      actionType: "BILLING_FINANCE_GRANTED", targetType: "PlatformFinanceGrant", targetId: grant.id,
      summary: `Granted platform finance ${input.role}`, sourcePage: SOURCE_PAGE,
      payload: { userId: input.userId, role: input.role, evidenceRef: input.evidenceRef } }, { client: tx });
    return grant;
  });
}

export async function revokePlatformFinanceRole(client: PrismaClient,
  input: { actorUserId: string; grantId: string; expectedVersion: number; evidenceRef: string }) {
  reference(input.actorUserId, "finance_grant_forbidden"); reference(input.grantId); reference(input.evidenceRef);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) refuse("bank_receipt_input_invalid");
  return transaction(client, async tx => {
    const workspaceId = await lockReservedMember(tx, input.actorUserId, true);
    if (!workspaceId) refuse("finance_grant_forbidden");
    const changed = await tx.$executeRaw`UPDATE PlatformFinanceGrant SET state = 'revoked', activeUserId = NULL,
      revokedAt = CURRENT_TIMESTAMP(3), revokedByUserId = ${input.actorUserId}, version = version + 1, updatedAt = CURRENT_TIMESTAMP(3)
      WHERE id = ${input.grantId} AND state = 'active' AND version = ${input.expectedVersion}`;
    if (changed !== 1) refuse("finance_grant_unavailable");
    await writeAuditLog({ workspaceId, userId: input.actorUserId, actor: input.actorUserId, actorType: ActorType.USER,
      actionType: "BILLING_FINANCE_REVOKED", targetType: "PlatformFinanceGrant", targetId: input.grantId,
      summary: "Revoked platform finance grant", sourcePage: SOURCE_PAGE, payload: { evidenceRef: input.evidenceRef } }, { client: tx });
    return tx.platformFinanceGrant.findUniqueOrThrow({ where: { id: input.grantId } });
  });
}

type PayerRow = { id: string; status: string; billingMode: string; currency: string };
async function lockPayer(tx: Prisma.TransactionClient, payerAccountId: string) {
  const [payer] = await tx.$queryRaw<PayerRow[]>`SELECT id, status, billingMode, currency FROM PayerAccount
    WHERE id = ${payerAccountId} AND CAST(id AS BINARY) = CAST(${payerAccountId} AS BINARY) FOR UPDATE`;
  return payer;
}
/** Money may only arrive for an active CNY payer in shadow or enforce (S2-a); the journal re-checks the same rule. */
function assertPayerReceives(payer: PayerRow | undefined) {
  if (!payer || payer.status !== "active" || payer.currency !== "CNY") refuse("payer_account_unavailable");
  if (payer.billingMode !== "shadow" && payer.billingMode !== "enforce") refuse("payer_billing_off");
}

export async function draftBankReceipt(client: PrismaClient, input: BankReceiptDraftInput) {
  const data = normalizeBankReceiptDraft(input);
  return transaction(client, async tx => {
    const workspaceId = await lockFinanceActor(tx, data.draftedByUserId, "maker");
    assertPayerReceives(await lockPayer(tx, data.payerAccountId));
    const receipt = await tx.bankReceipt.create({ data }).catch((error: unknown) => {
      if (isUniqueViolation(error)) refuse("bank_receipt_duplicate"); throw error; });
    await writeAuditLog({ workspaceId, userId: data.draftedByUserId, actor: data.draftedByUserId, actorType: ActorType.USER,
      actionType: "BILLING_BANK_RECEIPT_DRAFTED", targetType: "BankReceipt", targetId: receipt.id,
      summary: "Drafted corporate bank receipt", sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
      relatedObjectId: data.payerAccountId, payload: { amountFen: data.amountFen.toString(), valueDate: input.valueDate,
        evidenceRef: data.evidenceRef } }, { client: tx });
    return receipt;
  });
}

/**
 * Checker decision inside the caller's transaction. Approval moves drafted -> reviewed, posts exactly one `bank_topup` (operation
 * key `bank-receipt:<id>`), then reviewed -> posted with the funds transaction id; any failure rolls all of it back. The same
 * checker repeating the same decision replays the stored result; anything else on a decided receipt refuses.
 */
export async function reviewBankReceiptInTransaction(tx: Prisma.TransactionClient, input: BankReceiptReviewInput) {
  reference(input.actorUserId, "bank_receipt_forbidden"); reference(input.receiptId); reference(input.evidenceRef);
  if (input.decision !== "approve" && input.decision !== "reject") refuse("bank_receipt_input_invalid");
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) refuse("bank_receipt_input_invalid");
  const workspaceId = await lockFinanceActor(tx, input.actorUserId, "checker");
  const known = await tx.bankReceipt.findUnique({ where: { id: input.receiptId }, select: { payerAccountId: true } });
  if (!known) refuse("bank_receipt_unavailable");
  // Current (locking) reads: the plain read above opened a REPEATABLE READ snapshot that may predate a concurrent decision.
  const read = async () => (await tx.$queryRaw<BankReceipt[]>`SELECT * FROM BankReceipt WHERE id = ${input.receiptId} FOR UPDATE`)[0];
  const payer = await lockPayer(tx, known.payerAccountId);
  const receipt = await read();
  if (!receipt || receipt.payerAccountId !== known.payerAccountId) refuse("bank_receipt_unavailable");
  const done = input.decision === "approve" ? "posted" : "rejected";
  if (receipt.state === done && receipt.reviewedByUserId === input.actorUserId) return { receipt, replayed: true };
  if (receipt.state !== "drafted") refuse("bank_receipt_not_pending");
  if (receipt.draftedByUserId === input.actorUserId) refuse("bank_receipt_self_review_forbidden");
  if (Number(receipt.version) !== input.expectedVersion) refuse("bank_receipt_version_conflict");
  if (input.decision === "approve") assertPayerReceives(payer); // rejecting needs no live payer
  const next = input.decision === "approve" ? "reviewed" : "rejected";
  const decided = await tx.$executeRaw`UPDATE BankReceipt SET state = ${next}, reviewedByUserId = ${input.actorUserId},
    reviewedAt = CURRENT_TIMESTAMP(3), reviewEvidenceRef = ${input.evidenceRef}, version = version + 1,
    activeBankTxnRef = IF(${next} = 'rejected', NULL, activeBankTxnRef), updatedAt = CURRENT_TIMESTAMP(3)
    WHERE id = ${receipt.id} AND state = 'drafted' AND version = ${input.expectedVersion}
      AND CAST(draftedByUserId AS BINARY) <> CAST(${input.actorUserId} AS BINARY)`;
  if (decided !== 1) refuse("bank_receipt_version_conflict");
  let fundsTransactionId: string | null = null;
  if (input.decision === "approve") {
    const amountFen = BigInt(receipt.amountFen);
    const posted = await postFundsTransactionInTransaction(tx, { payerAccountId: receipt.payerAccountId, kind: "bank_topup",
      operationKey: `bank-receipt:${receipt.id}`, evidenceRef: `bank-receipt:${receipt.id}`,
      actor: { type: "USER", ref: input.actorUserId },
      entries: [{ account: "bank_clearing", direction: "debit", amountFen }, { account: "customer_wallet_available", direction: "credit", amountFen }] });
    if (posted.replayed) refuse("bank_receipt_posting_conflict"); // a drafted receipt must never find its posting already present
    fundsTransactionId = posted.transaction.id;
    const marked = await tx.$executeRaw`UPDATE BankReceipt SET state = 'posted', fundsTransactionId = ${fundsTransactionId},
      version = version + 1, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ${receipt.id} AND state = 'reviewed'`;
    if (marked !== 1) refuse("bank_receipt_posting_conflict");
  }
  await writeAuditLog({ workspaceId, userId: input.actorUserId, actor: input.actorUserId, actorType: ActorType.USER,
    actionType: input.decision === "approve" ? "BILLING_BANK_RECEIPT_POSTED" : "BILLING_BANK_RECEIPT_REJECTED",
    targetType: "BankReceipt", targetId: receipt.id, summary: input.decision === "approve" ? "Checker approved and posted corporate bank receipt"
      : "Checker rejected corporate bank receipt",
    sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount", relatedObjectId: receipt.payerAccountId,
    payload: { fundsTransactionId, evidenceRef: input.evidenceRef } }, { client: tx });
  return { receipt: await read(), replayed: false };
}

export function reviewBankReceipt(client: PrismaClient, input: BankReceiptReviewInput) {
  return transaction(client, tx => reviewBankReceiptInTransaction(tx, input));
}
