---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real credit line, approval, payment, credential or customer data.
---

# Billing credit facilities / 授信额度

Billing V1 S3-e (Core), migrations `20261110200000_billing_credit_facilities` (table) and `20261110200100_billing_credit_funds_enums`
(journal ENUMs), `lib/billing/credit/credit-facilities.ts`. No route, UI, batch issuance or repayment. 没有授信记录即授信为 0；
存量账户的批量发放在 S6，还款、应收与对账在 S5。

- **State**: `draft -> approved -> active -> reduced* -> expired | revoked`; revoke also cancels a draft or approved line. At most one
  `active`/`reduced` facility per payer (UNIQUE `activePayerAccountId`, NULL otherwise). `0 <= usedFen <= limitFen` (CHECK).
- **Who**: a platform finance **maker** (S2-c `PlatformFinanceGrant`) proposes with `limitFen > 0`, optional `validUntil` and an
  `evidenceRef` (same `operationKey` + content replays); a **different checker** approves (service check and DB CHECK). Activation,
  reduction, expiry and revocation take any platform finance role: they only keep or shrink exposure. Workspace OWNER/BILLING_ADMIN
  and service (`SYSTEM`) identities have no lifecycle path. AuditLog in the same transaction, in the actor's reserved workspace (as S2-c).
- **Trigger**: payer, key, proposer, evidence, term and approval are frozen; terminal states are final; `limitFen` only falls on
  reduce; `usedFen` only rises while drawable. `version` is the configuration version (+1 per lifecycle step, `expectedVersion`
  CAS); a draw-only update keeps it, so operators are not raced by usage. No DELETE. Times are database `UTC_TIMESTAMP(3)`.
- **Reduce / revoke**: reducing below `usedFen` refuses `credit_reduce_below_used` (never clamped or forgiven). Revoke and expiry
  stop new draws immediately and keep outstanding `usedFen` on that facility; a new facility starts at 0 used.
- **Seam for S3-b** (call under the `PayerAccount` lock; both re-take it, re-entrant): `availableCreditFen(tx, payerAccountId):
  Promise<bigint>` returns undrawn credit of the active, in-term facility, else `0n` (also for a non-active payer); it does not net out
  held reservations. `drawCreditInTransaction(tx, { payerAccountId, fen, sourceRef, actor })` posts one balanced `credit_draw`
  (debit `credit_receivable`, credit `customer_wallet_available`) and `usedFen += fen`, failing closed beyond the line
  (`credit_insufficient`) or without an active facility (`credit_not_active`). Settle charges the wallet first and draws only the
  shortfall, then charges the wallet. Key `credit-draw:<sourceRef>`: same amount replays, another amount refuses.
- **Lock order**: [finance grant, reserved Membership FOR SHARE] -> `PayerAccount` FOR UPDATE -> `CreditFacility` FOR UPDATE ->
  funds rows. The generic posting path refuses `credit_draw`, and a draw cannot be reversed as a correction (repayment is S5).
- **Verify / rollback**: unit `credit-facilities.test.ts`; `npm run test:billing:mysql` (concurrent over-draw, revoke vs draw, maker =
  checker, triggers). Rollback: stop calling the service; `prisma/rollback/20261110_rollback_billing_credit_facilities.sql` refuses while
  any facility or credit journal row exists and removes both migrations. ENUM lists are shared with other slices: merge by union.
