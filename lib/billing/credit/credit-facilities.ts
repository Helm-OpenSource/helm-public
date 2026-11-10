import "server-only";
import { createHash } from "node:crypto";
import { ActorType, Prisma, type CreditFacility, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { findPlatformFinanceActorInTransaction, type PlatformFinanceRoleName } from "../bank-receipts/bank-receipts";
import { postCreditDrawFundsInTransaction, type FundsActor } from "../funds/funds-journal";
import { MAX_FEN } from "../funds/money";

/**
 * Billing V1 S3-e credit facilities (授信). No facility means 0 credit; batch issuance for existing payers is S6, repayment and
 * receivables are S5. A platform finance maker proposes (draft); a different checker approves; then any platform finance role
 * holder activates, reduces, expires or revokes (those only keep or shrink exposure). Workspace roles and service identities have
 * no lifecycle path. AuditLog goes to the actor's reserved workspace in the same transaction (as S2-c).
 * Lock order everywhere: [PlatformFinanceGrant + reserved Membership FOR SHARE] -> PayerAccount FOR UPDATE -> CreditFacility
 * FOR UPDATE -> funds rows (S2-a). Reservation/settlement (S3-b) already holds the PayerAccount lock when it calls in.
 */
export type CreditFacilityRefusalCode = "credit_input_invalid" | "credit_forbidden" | "credit_self_approval_forbidden" |
  "credit_operation_conflict" | "credit_unavailable" | "credit_version_conflict" | "credit_transition_invalid" |
  "credit_active_exists" | "credit_reduce_invalid" | "credit_reduce_below_used" | "credit_not_expired" | "credit_outside_validity" |
  "credit_not_active" | "credit_insufficient" | "payer_account_unavailable" | "credit_write_conflict";

export class CreditFacilityRefusal extends Error {
  constructor(readonly code: CreditFacilityRefusalCode) { super(code); this.name = "CreditFacilityRefusal"; }
}

const ZERO = BigInt(0);
const SOURCE_PAGE = "/billing/credit";
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
function refuse(code: CreditFacilityRefusalCode): never { throw new CreditFacilityRefusal(code); }
function reference(value: unknown, code: CreditFacilityRefusalCode = "credit_input_invalid"): asserts value is string {
  if (typeof value !== "string" || !REF.test(value)) refuse(code);
}
function positiveFen(value: unknown): asserts value is bigint {
  if (typeof value !== "bigint" || value <= ZERO || value > MAX_FEN) refuse("credit_input_invalid");
}
function run<T>(client: PrismaClient, body: (tx: Prisma.TransactionClient) => Promise<T>) {
  // No automatic retry: a conflicting writer re-reads the current version and decides again.
  return client.$transaction(body, { maxWait: 5000, timeout: 10000 }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) refuse("credit_write_conflict");
    throw error;
  });
}

async function financeActor(tx: Prisma.TransactionClient, userId: string, roles: PlatformFinanceRoleName[]) {
  const workspaceId = await findPlatformFinanceActorInTransaction(tx, userId, roles);
  if (!workspaceId) refuse("credit_forbidden");
  return workspaceId;
}
/** Re-entrant inside one transaction: a caller that already holds the payer lock just re-reads the row. */
async function lockPayer(tx: Prisma.TransactionClient, payerAccountId: string) {
  const [payer] = await tx.$queryRaw<Array<{ id: string; status: string; currency: string }>>`
    SELECT id, status, currency FROM PayerAccount
    WHERE id = ${payerAccountId} AND CAST(id AS BINARY) = CAST(${payerAccountId} AS BINARY) FOR UPDATE`;
  if (!payer || payer.id !== payerAccountId) refuse("payer_account_unavailable");
  return payer;
}
type FacilityRow = { id: string; payerAccountId: string; state: CreditFacility["state"]; limitFen: bigint; usedFen: bigint;
  version: number; proposedByUserId: string; validUntil: Date | null; inTerm: boolean; contentHash: string };
async function lockFacility(tx: Prisma.TransactionClient, where: Prisma.Sql) {
  const [row] = await tx.$queryRaw<FacilityRow[]>`SELECT id, payerAccountId, state, limitFen, usedFen, version, proposedByUserId,
    validUntil, contentHash, (validUntil IS NULL OR validUntil > UTC_TIMESTAMP(3)) AS inTerm FROM CreditFacility WHERE ${where} FOR UPDATE`;
  return row ? { ...row, limitFen: BigInt(row.limitFen), usedFen: BigInt(row.usedFen), version: Number(row.version),
    inTerm: Number(row.inTerm) === 1 } : null;
}
const lockDrawable = (tx: Prisma.TransactionClient, payerAccountId: string) =>
  lockFacility(tx, Prisma.sql`activePayerAccountId = ${payerAccountId}`);
const audit = (tx: Prisma.TransactionClient, workspaceId: string, actorUserId: string, facility: { id: string; payerAccountId: string },
  action: string, payload: Record<string, unknown>) => writeAuditLog({ workspaceId, userId: actorUserId, actor: actorUserId,
  actorType: ActorType.USER, actionType: `BILLING_CREDIT_FACILITY_${action.toUpperCase()}`, targetType: "CreditFacility",
  targetId: facility.id, summary: `Credit facility ${action}`, sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
  relatedObjectId: facility.payerAccountId, payload }, { client: tx });

export type ProposeCreditFacilityInput = { actorUserId: string; payerAccountId: string; limitFen: bigint; validUntil: Date | null;
  operationKey: string; evidenceRef: string };

/** Pure validation; the same (payer, operationKey) replays only with this exact content, proposer included. */
export function normalizeCreditFacilityProposal(input: ProposeCreditFacilityInput) {
  if (!input || typeof input !== "object") refuse("credit_input_invalid");
  reference(input.actorUserId, "credit_forbidden");
  for (const value of [input.payerAccountId, input.operationKey, input.evidenceRef]) reference(value);
  positiveFen(input.limitFen);
  if (input.validUntil !== null && (!(input.validUntil instanceof Date) || Number.isNaN(input.validUntil.getTime()))) {
    refuse("credit_input_invalid");
  }
  const content = { v: 1, payerAccountId: input.payerAccountId, limitFen: input.limitFen.toString(),
    validUntil: input.validUntil?.toISOString() ?? null, operationKey: input.operationKey, evidenceRef: input.evidenceRef,
    proposedByUserId: input.actorUserId };
  return { payerAccountId: input.payerAccountId, limitFen: input.limitFen, validUntil: input.validUntil,
    operationKey: input.operationKey, evidenceRef: input.evidenceRef, proposedByUserId: input.actorUserId,
    contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex") };
}

/** Maker step: creates a `draft` facility. Nothing is drawable until a different checker approves and it is activated. */
export async function proposeCreditFacility(client: PrismaClient, input: ProposeCreditFacilityInput) {
  const data = normalizeCreditFacilityProposal(input);
  return run(client, async tx => {
    const workspaceId = await financeActor(tx, data.proposedByUserId, ["maker"]);
    const payer = await lockPayer(tx, data.payerAccountId);
    const existing = await lockFacility(tx, Prisma.sql`payerAccountId = ${data.payerAccountId} AND operationKey = ${data.operationKey}`);
    if (existing) {
      if (existing.contentHash !== data.contentHash) refuse("credit_operation_conflict");
      return { facility: await tx.creditFacility.findUniqueOrThrow({ where: { id: existing.id } }), replayed: true };
    }
    if (payer.status !== "active" || payer.currency !== "CNY") refuse("payer_account_unavailable");
    const facility = await tx.creditFacility.create({ data });
    await audit(tx, workspaceId, data.proposedByUserId, facility, "proposed", { limitFen: data.limitFen.toString(),
      validUntil: data.validUntil?.toISOString() ?? null, state: facility.state, version: facility.version, evidenceRef: data.evidenceRef });
    return { facility, replayed: false };
  });
}

export type CreditFacilityAction = "approve" | "activate" | "reduce" | "expire" | "revoke";
const RULES: Record<CreditFacilityAction, { roles: PlatformFinanceRoleName[]; from: string[]; to: CreditFacility["state"] }> = {
  approve: { roles: ["checker"], from: ["draft"], to: "approved" },
  activate: { roles: ["maker", "checker"], from: ["approved"], to: "active" },
  reduce: { roles: ["maker", "checker"], from: ["active", "reduced"], to: "reduced" },
  expire: { roles: ["maker", "checker"], from: ["active", "reduced"], to: "expired" },
  revoke: { roles: ["maker", "checker"], from: ["draft", "approved", "active", "reduced"], to: "revoked" },
};
export type ChangeCreditFacilityInput = { actorUserId: string; facilityId: string; expectedVersion: number;
  action: CreditFacilityAction; evidenceRef: string; /** reduce only: the new, lower limit (>= usedFen). */ limitFen?: bigint };

export function changeCreditFacility(client: PrismaClient, input: ChangeCreditFacilityInput) {
  return run(client, tx => changeCreditFacilityInTransaction(tx, input));
}

/** Version-CAS lifecycle step on database UTC time. Revoke and expire stop new draws and keep outstanding usedFen. */
export async function changeCreditFacilityInTransaction(tx: Prisma.TransactionClient, input: ChangeCreditFacilityInput) {
  reference(input?.actorUserId, "credit_forbidden"); reference(input.facilityId, "credit_unavailable"); reference(input.evidenceRef);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) refuse("credit_input_invalid");
  if (!Object.prototype.hasOwnProperty.call(RULES, input.action)) refuse("credit_transition_invalid");
  if ((input.action === "reduce") !== (input.limitFen !== undefined)) refuse("credit_input_invalid");
  const rule = RULES[input.action];
  const workspaceId = await financeActor(tx, input.actorUserId, rule.roles);
  const head = await tx.creditFacility.findUnique({ where: { id: input.facilityId }, select: { payerAccountId: true } });
  if (!head) refuse("credit_unavailable");
  const payer = await lockPayer(tx, head.payerAccountId);
  const facility = await lockFacility(tx, Prisma.sql`id = ${input.facilityId}`);
  if (!facility || facility.id !== input.facilityId) refuse("credit_unavailable");
  if (facility.version !== input.expectedVersion) refuse("credit_version_conflict");
  if (!rule.from.includes(facility.state)) refuse("credit_transition_invalid");
  let limitFen = facility.limitFen;
  if (input.action === "approve" && facility.proposedByUserId === input.actorUserId) refuse("credit_self_approval_forbidden");
  if (input.action === "activate") {
    if (payer.status !== "active") refuse("payer_account_unavailable");
    if (!facility.inTerm) refuse("credit_outside_validity");
    if (await lockDrawable(tx, facility.payerAccountId)) refuse("credit_active_exists");
  }
  if (input.action === "reduce") {
    if (typeof input.limitFen !== "bigint" || input.limitFen < ZERO || input.limitFen >= facility.limitFen) refuse("credit_reduce_invalid");
    // Refused rather than clamped: outstanding usage is a receivable, never silently forgiven or left above the line.
    if (input.limitFen < facility.usedFen) refuse("credit_reduce_below_used");
    limitFen = input.limitFen;
  }
  if (input.action === "expire" && (facility.validUntil === null || facility.inTerm)) refuse("credit_not_expired");
  const drawable = rule.to === "active" || rule.to === "reduced";
  const closing = rule.to === "expired" || rule.to === "revoked";
  // CAS: version and pre-state in the UPDATE's own WHERE; the trigger also requires version + 1 and a legal transition.
  const changed = await tx.$executeRaw`UPDATE CreditFacility SET state = ${rule.to}, limitFen = ${limitFen},
    activePayerAccountId = ${drawable ? facility.payerAccountId : null},
    approvedByUserId = IF(${input.action === "approve"}, ${input.actorUserId}, approvedByUserId),
    approvalRef = IF(${input.action === "approve"}, ${input.evidenceRef}, approvalRef),
    approvedAt = IF(${input.action === "approve"}, UTC_TIMESTAMP(3), approvedAt),
    activatedAt = IF(${input.action === "activate"}, UTC_TIMESTAMP(3), activatedAt),
    closedAt = IF(${closing}, UTC_TIMESTAMP(3), closedAt), version = version + 1, updatedAt = UTC_TIMESTAMP(3)
    WHERE id = ${facility.id} AND version = ${facility.version} AND state = ${facility.state}`;
  if (changed !== 1) refuse("credit_version_conflict");
  const row = await tx.creditFacility.findUniqueOrThrow({ where: { id: facility.id } });
  await audit(tx, workspaceId, input.actorUserId, row, input.action, { from: facility.state, to: row.state, version: row.version,
    limitFen: row.limitFen.toString(), usedFen: row.usedFen.toString(), evidenceRef: input.evidenceRef });
  return row;
}

/**
 * S3-b seam: undrawn credit of the payer's one active/reduced, in-term facility; 0 when there is none or the payer is not active.
 * Call under the PayerAccount lock (re-taken here, re-entrant) and before any CreditFacility row; held reservations are not netted
 * out here, so S3-b subtracts its own held totals: reservable = wallet available + this - held.
 */
export async function availableCreditFen(tx: Prisma.TransactionClient, payerAccountId: string): Promise<bigint> {
  reference(payerAccountId, "payer_account_unavailable");
  const payer = await lockPayer(tx, payerAccountId);
  const facility = await lockDrawable(tx, payerAccountId);
  return payer.status === "active" && facility?.inTerm ? facility.limitFen - facility.usedFen : ZERO;
}

export type DrawCreditInput = { payerAccountId: string; fen: bigint; sourceRef: string; actor: FundsActor };
const DRAW_PREFIX = "credit-draw:", FACILITY_PREFIX = "credit-facility:";

/**
 * Draws `fen` from the active facility into the customer wallet: one balanced `credit_draw` (debit credit_receivable, credit
 * customer_wallet_available) plus usedFen += fen, in the caller's transaction (S3-b settle: draw the shortfall, then charge the
 * wallet). Fails closed beyond the remaining line. Operation key `credit-draw:<sourceRef>`: the same sourceRef and amount replays
 * without a second effect, even after the facility closed; another amount refuses `funds_operation_conflict`.
 */
export async function drawCreditInTransaction(tx: Prisma.TransactionClient, input: DrawCreditInput) {
  reference(input?.payerAccountId, "payer_account_unavailable"); positiveFen(input.fen);
  reference(input.sourceRef);
  if (input.sourceRef.length > 191 - DRAW_PREFIX.length) refuse("credit_input_invalid");
  await lockPayer(tx, input.payerAccountId);
  const operationKey = `${DRAW_PREFIX}${input.sourceRef}`;
  const posting = (facilityRef: string) => postCreditDrawFundsInTransaction(tx, { payerAccountId: input.payerAccountId,
    kind: "credit_draw", operationKey, actor: input.actor, evidenceRef: facilityRef,
    entries: [{ account: "credit_receivable", direction: "debit", amountFen: input.fen },
      { account: "customer_wallet_available", direction: "credit", amountFen: input.fen }] });
  const facility = await lockDrawable(tx, input.payerAccountId);
  const [prior] = await tx.$queryRaw<Array<{ evidenceRef: string }>>`SELECT evidenceRef FROM FundsTransaction
    WHERE payerAccountId = ${input.payerAccountId} AND operationKey = ${operationKey} FOR SHARE`;
  if (prior) {
    const posted = await posting(prior.evidenceRef); // replays the identical draw or refuses a different one
    return { facilityId: prior.evidenceRef.slice(FACILITY_PREFIX.length), fundsTransactionId: posted.transaction.id, replayed: true };
  }
  if (!facility || !facility.inTerm) refuse("credit_not_active");
  if (input.fen > facility.limitFen - facility.usedFen) refuse("credit_insufficient");
  // Guarded by its own predicate under the row lock; `version` stays (it versions configuration, not usage).
  const changed = await tx.$executeRaw`UPDATE CreditFacility SET usedFen = usedFen + ${input.fen},
    updatedAt = UTC_TIMESTAMP(3) WHERE id = ${facility.id} AND state IN ('active', 'reduced')
      AND usedFen + ${input.fen} <= limitFen AND (validUntil IS NULL OR validUntil > UTC_TIMESTAMP(3))`;
  if (changed !== 1) refuse("credit_insufficient");
  const posted = await posting(`${FACILITY_PREFIX}${facility.id}`);
  if (posted.replayed) refuse("credit_write_conflict"); // checked absent above under the same locks
  return { facilityId: facility.id, fundsTransactionId: posted.transaction.id, replayed: false };
}
