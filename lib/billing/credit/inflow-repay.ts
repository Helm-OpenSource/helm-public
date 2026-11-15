import "server-only";
import { Prisma } from "@prisma/client";
import { creditRepayKeyPrefix, creditRepayOperationKey, FundsRefusal, overdraftRepayOperationKey, postRepayFundsInTransaction,
  type FundsActor } from "../funds/funds-journal";

/**
 * Billing V1 C-REPAY (S3 protocol v3.10 clause 5; design §1.2-1.3): right after a `topup` or `bank_topup` is posted, in the same
 * transaction and under the same PayerAccount lock, the whole wallet repays the overdraft first, then credit; what is left stays
 * in the wallet. So after every inflow: wallet > 0 implies credit used = 0 and overdraft used = 0. Amounts are computed here from
 * locked rows, never passed in; owing nothing writes nothing.
 * - `overdraft_repay` (key `overdraft-repay:<inflowId>`): debit the wallet, credit overdraft_receivable.
 * - `credit_repay`, one per facility repaid (key `credit-repay:<inflowId>:<facilityId>`, evidence `credit-facility:<id>` as for
 *   draws): debit the wallet, credit credit_receivable, and that facility's usedFen falls by the same amount (the trigger's repay
 *   shape: version and terms unchanged). Expired and revoked facilities are repaid too; the order is REPAY_ORDER below.
 * Refusals: `funds_input_invalid` (not this payer's unreversed topup / bank_topup), `funds_repay_invariant_breach` (this inflow
 * already has a repayment, credit_receivable differs from Σ usedFen (S5), or a facility row moved under the lock). Any refusal
 * rolls the inflow back with it (fail-closed, coordinator ruling B); the inflow entry points map it (C-REPAY part 2).
 * Lock order: PayerAccount -> FundsTransaction (share) -> CreditFacility -> projections -> journal postings, as credit draws.
 */
export type InflowRepayInput = { payerAccountId: string; inflowTransactionId: string; actor: FundsActor };
export type InflowRepayment = { overdraftRepaidFen: bigint; overdraftTransactionId: string | null;
  creditRepaid: Array<{ facilityId: string; amountFen: bigint; fundsTransactionId: string }>; walletLeftFen: bigint };

const ZERO = BigInt(0);
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
const WALLET = "customer_wallet_available";
const breach = (): never => { throw new FundsRefusal("funds_repay_invariant_breach"); };
/** Closed (expired / revoked) facilities first, oldest debt first; then the drawable one. Coordinator default 11-15, pending owner
 * confirmation: when the wallet cannot repay everything, repaying a closed facility lowers headroom. Change the order only here. */
const REPAY_ORDER = Prisma.sql`ORDER BY (state IN ('active', 'reduced')) ASC, activatedAt ASC, id ASC`;

export async function repayArrearsFromInflowInTransaction(tx: Prisma.TransactionClient,
  input: InflowRepayInput): Promise<InflowRepayment> {
  if (!input || !REF.test(input.payerAccountId ?? "") || !REF.test(input.inflowTransactionId ?? "")) {
    throw new FundsRefusal("funds_input_invalid");
  }
  const { payerAccountId, inflowTransactionId, actor } = input;
  const [payer] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM PayerAccount
    WHERE id = ${payerAccountId} AND CAST(id AS BINARY) = CAST(${payerAccountId} AS BINARY) FOR UPDATE`;
  if (!payer) throw new FundsRefusal("payer_account_unavailable");
  const [inflow] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM FundsTransaction WHERE id = ${inflowTransactionId}
    AND payerAccountId = ${payerAccountId} AND kind IN ('topup', 'bank_topup') AND reversalOfId IS NULL FOR SHARE`;
  const [reversed] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM FundsTransaction
    WHERE reversalOfId = ${inflowTransactionId} FOR SHARE`;
  if (!inflow || inflow.id !== inflowTransactionId || reversed) throw new FundsRefusal("funds_input_invalid");
  // Callers repay only a fresh inflow (a provider or checker replay returns before posting), so a recorded repayment is a breach;
  // recomputing would give other amounts, so content-hash replay cannot apply here.
  const overdraftKey = overdraftRepayOperationKey(inflowTransactionId), creditPrefix = creditRepayKeyPrefix(inflowTransactionId);
  // A range on the binary-collated key (the prefix ends with ':', so every key under it sorts below the same text ending ';') uses
  // the (payerAccountId, operationKey) index instead of scanning all of this payer's transactions.
  const creditPrefixEnd = `${creditPrefix.slice(0, -1)};`;
  const [prior] = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM FundsTransaction WHERE payerAccountId = ${payerAccountId}
    AND (operationKey = ${overdraftKey} OR (operationKey >= ${creditPrefix} AND operationKey < ${creditPrefixEnd})) LIMIT 1 FOR SHARE`;
  if (prior) breach();

  const facilities = (await tx.$queryRaw<Array<{ id: string; usedFen: bigint }>>`SELECT id, usedFen FROM CreditFacility
    WHERE payerAccountId = ${payerAccountId} AND usedFen > 0 ${REPAY_ORDER} FOR UPDATE`)
    .map(row => ({ id: row.id, usedFen: BigInt(row.usedFen) }));
  // Under the payer lock every writer of these rows is serialized, so their order here cannot deadlock.
  const projections = await tx.$queryRaw<Array<{ account: string; balanceFen: bigint }>>`SELECT account, balanceFen
    FROM FundsAccountProjection WHERE payerAccountId = ${payerAccountId}
      AND account IN ('credit_receivable', 'customer_wallet_available', 'overdraft_receivable') FOR UPDATE`;
  const balance = (account: string) => BigInt(projections.find(row => row.account === account)?.balanceFen ?? ZERO);
  // S5: the credit receivable is exactly what the facilities record as used; otherwise the books are already wrong.
  if (facilities.reduce((sum, row) => sum + row.usedFen, ZERO) !== balance("credit_receivable")) breach();

  let wallet = balance(WALLET);
  const overdraftRepaidFen = wallet < balance("overdraft_receivable") ? wallet : balance("overdraft_receivable");
  let overdraftTransactionId: string | null = null;
  if (overdraftRepaidFen > ZERO) {
    const posted = await postRepayFundsInTransaction(tx, { payerAccountId, kind: "overdraft_repay", operationKey: overdraftKey, actor,
      evidenceRef: `funds-transaction:${inflowTransactionId}`,
      entries: [{ account: WALLET, direction: "debit", amountFen: overdraftRepaidFen },
        { account: "overdraft_receivable", direction: "credit", amountFen: overdraftRepaidFen }] });
    if (posted.replayed) breach(); // checked absent above under the same locks
    overdraftTransactionId = posted.transaction.id;
    wallet -= overdraftRepaidFen;
  }
  const creditRepaid: InflowRepayment["creditRepaid"] = [];
  for (const facility of facilities) {
    if (wallet <= ZERO) break;
    const amountFen = wallet < facility.usedFen ? wallet : facility.usedFen;
    // Guarded by its own predicate under the row lock; `version` stays (it versions configuration, not usage), as for draws.
    const changed = await tx.$executeRaw`UPDATE CreditFacility SET usedFen = usedFen - ${amountFen}, updatedAt = UTC_TIMESTAMP(3)
      WHERE id = ${facility.id} AND usedFen >= ${amountFen}`;
    if (changed !== 1) breach();
    const posted = await postRepayFundsInTransaction(tx, { payerAccountId, kind: "credit_repay",
      operationKey: creditRepayOperationKey(inflowTransactionId, facility.id), actor, evidenceRef: `credit-facility:${facility.id}`,
      entries: [{ account: WALLET, direction: "debit", amountFen }, { account: "credit_receivable", direction: "credit", amountFen }] });
    if (posted.replayed) breach();
    creditRepaid.push({ facilityId: facility.id, amountFen, fundsTransactionId: posted.transaction.id });
    wallet -= amountFen;
  }
  return { overdraftRepaidFen, overdraftTransactionId, creditRepaid, walletLeftFen: wallet };
}
