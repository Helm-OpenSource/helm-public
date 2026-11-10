---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real credit line, approval, payment, credential or customer data.
---

# Billing credit facilities / 授信额度

Billing V1 S3-e (Core): migrations `20261110215000_billing_credit_facilities` and `20261110220000_billing_credit_funds_enums`
(full funds ENUM union, protocol v3.6), `lib/billing/credit/credit-facilities.ts`. No route, UI, batch issuance or repayment.
没有授信记录即授信为 0；存量账户的批量发放在 S6，还款、应收与对账在 S5。

- **State**: `draft -> approved -> active -> reduced* -> expired | revoked`; revoke also cancels a draft or approved line. One
  `active`/`reduced` facility per payer (UNIQUE `activePayerAccountId`). Approval freezes `approvedLimitFen`; `limitFen` and `usedFen`
  never exceed it (CHECK). Triggers: INSERT only as a fresh draft; payer, key, proposer, evidence, term and approval frozen; terminal
  states final; `limitFen` only falls on reduce. `version` (+1 per lifecycle step, `expectedVersion` CAS) is not bumped by draws, so
  operators are not raced by usage. No DELETE. Times are database `UTC_TIMESTAMP(3)`.
- **Who**: a platform finance **maker** (S2-c `PlatformFinanceGrant`) proposes `limitFen > 0`, optional `validUntil`, `evidenceRef`
  (same `operationKey` + content replays); a **different checker** approves (service and DB CHECK). Activate, reduce, expire and
  revoke take any platform finance role (they only keep or shrink exposure). Workspace OWNER/BILLING_ADMIN and `SYSTEM` identities
  have no lifecycle path. AuditLog in the same transaction, in the actor's reserved workspace (as S2-c).
- **Tightening**: reducing below `usedFen` refuses `credit_reduce_below_used` (never clamped or forgiven). Revoke, reduce and expiry
  bind every reservation taken afterwards and keep outstanding `usedFen`; a reservation **held before** them still settles, capped at
  `approvedLimitFen` (S0 §5); after several reduces, any reduce later than `reservedAt` (`lastReducedAt`) puts such a reservation back
  on `approvedLimitFen`. V1 has no separate freeze: freezing is reduce-to-used, irreversible; restoring needs a new facility.
- **Operations**: a facility past `validUntil` stays `active` and holds the per-payer key until `expire` runs; expire it before
  activating its successor (S6 tooling does this automatically).
- **Seam for S3-b**, under the `PayerAccount` lock (re-taken, re-entrant): `availableCreditFen(tx, payerAccountId): Promise<bigint>`
  is `max(0, limitFen - usedFen)` of the active, in-term facility, else `0n` (also for a non-active payer), without netting held
  reservations. `drawCreditShortfallInTransaction(tx, { payerAccountId, chargeFen, sourceRef, actor, reservedAt })` borrows only
  `max(0, chargeFen - wallet)` as one balanced `credit_draw` (debit `credit_receivable`, credit `customer_wallet_available`), `usedFen
  += shortfall`; the caller then charges the wallet in full. Shortfall 0 writes nothing (`walletCovered`). Refuses
  `credit_insufficient`, `credit_not_active`, `payer_account_unavailable`. Key `credit-draw:<sourceRef>` returns a recorded draw; do
  not call it again when replaying a settled reservation. **Wiring check (S3-b2)**: `reservedAt` must come from the
  `BillingReservation` row locked in the same transaction (state `held` or `unknown`) and `sourceRef` must be bound to that
  reservationId; a `reservedAt` later than database time refuses `credit_input_invalid`. Lock order: PayerAccount -> FundsTransaction
  (share) -> CreditFacility -> wallet projection -> journal posting. Only this module posts `credit_draw`; it is never reversed as a
  correction, and unlike S3-b2's `charge` it has no suspended/off-payer exemption (the wiring slice decides, bound to the same
  held/unknown reservation). S5 reconciliation must check the invariant `credit_receivable` projection = Σ `usedFen`.
- **Verify / rollback**: unit `credit-facilities.test.ts`; `npm run test:billing:mysql`. Rollback: stop calling the service;
  `prisma/rollback/20261110_rollback_billing_credit_facilities.sql` refuses while any facility or credit journal row exists, removes
  both migrations and shrinks the ENUMs to the union minus `credit_draw` / `credit_receivable`. Order: S3-e first, then S3-b2 charges,
  then reservations / S2-c.
