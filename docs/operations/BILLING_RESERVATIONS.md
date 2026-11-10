---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real price, deployment approval, payment, credential or customer data.
---

# Billing budget buckets and reservations / 预算桶与预占

Billing V1 S3-b1/S3-b2 (Core), migrations `20261110200000_billing_reservations` and `20261110210000_billing_charges`,
`lib/billing/reservations/reservations.ts`. Library functions map 1:1 onto the S3 internal protocol v2 `BillingCoreClient`
(`quote`, `reserve`, `settle`, `release`, `markUnknown`, `resolveUnknown`)
and return `{ ok: true, ... }` or `{ ok: false, code: BillingRejectCode }`. Routes and `BillingServiceGrant` HMAC are S3-b3; until
then the caller passes the authenticated service actor (`SYSTEM`) as a separate argument. 所有账户默认 `billingMode=off`。

- **BudgetBucket**: one row per grant x mode (`shadow` counters never consume `enforce` limits) x `day|month` x Asia/Shanghai period key, counting `settledFen` and `reservedFen` (held + unknown).
  Created at zero on first use, never deleted, every update needs `version + 1` (trigger). Each move is a version CAS with
  the grant limit (`settled + reserved + charge <= limit`) or the non-negative guard in the UPDATE's own WHERE.
- **Reserve**: idempotent by `(payerRef, idempotencyKey)` (`^[A-Za-z0-9:_-]{8,128}$`; a rejected request rolls back and never consumes it) + content hash (operationRef, grant, price version, event, meter unit,
  quantity); one reservation per `(payerRef, operationRef)`, so a new key for the same operation is `idempotency_conflict`. The
  S3-a gate prices the use from the grant's bound price row and reads `UTC_TIMESTAMP(3)` itself; its `usedFen` comes from the
  locked bucket rows. It returns `mode`, `reservationId`, `state`, `capFen`, `priceContentHash`, `periodKeys` (shadow also
  `wouldChargeFen`) and freezes mode, grant version, price version, `priceContentHash`, `chargeFen`, `reservedAt` and `dayKey/monthKey` (trigger: only state and
  resolution fields may change). A replay returns the reservation's current state.
- **Modes and funds**: enforce needs `customer_wallet_available` + `availableCreditFen` (S3-e seam, read under the PayerAccount
  lock, fixed 0 until S3-e) minus every open enforce hold to cover the charge (`insufficient_funds`). Settle debits the wallet only.
  Shadow runs the full lifecycle (reserve, settle, release, unknown) in its shadow buckets with no balance check and never
  writes a funds entry or projection. `off` is `billing_mode_off` (run unbilled, v2 §4); an unknown or suspended payer fails closed (`grant_not_active`). Any refusal rolls the
  whole transaction back (no partial write). Zero fen: a use pricing to 0 fen is `grant_charge_zero`, never reserved as free.
- **States**: `held -> unknown` (`markUnknown`, evidence) keeps the hold counted and is never released by time.
  `held|unknown -> released` (`release`, `reasonCode` `not_executed|failed|partial_unusable` + evidence) removes the hold from the
  **frozen** period buckets, even when released on a later day or month. Released is terminal. Same key + content replays; same key
  with other content is `idempotency_conflict`; a wrong `operationRef` is `idempotency_conflict`.
- **Settle** (S3-b2, `held|unknown -> settled`, exactly once): `quantityUsed` <= the reserved quantity (`quantity_exceeds_reservation`;
  `"0"` is a release, `request_invalid`) is repriced from the frozen price row (hash re-checked) to `chargeFen <= capFen`; 0 fen is
  `grant_charge_zero` (release instead). In one transaction the hold leaves and the charge enters the reservation's **frozen**
  day/month buckets (a settle on a later day or month counts in the reserve-time periods), a balanced `charge` funds transaction
  (debit wallet, credit `charge_revenue`, `operationKey = charge:<reservationId>`, its audit + `funds.posted` outbox), the immutable
  `BillingCharge` row (unique per reservation and per funds transaction) and a `billing.charge.settled` outbox row commit together.
  Returns `chargeId`, `chargeFen`. Same key + content replays; settle/release races leave exactly one winner. If the payer has been
  turned off or suspended, or a correction left the wallet below the hold, settle refuses (`billing_mode_off`, `grant_not_active`,
  `insufficient_funds`) and the reservation stays held for follow-up; it is never released automatically. A **shadow** settle
  writes the shadow `BillingCharge` (`fundsTransactionId` null) and a `billing.charge.shadow_settled` outbox row, never funds.
- **resolveUnknown** (reconciliation/manual channel only; route and operator entry S3-b3/S5): `unknown -> settled` (needs
  `quantityUsed`, same rules as settle) or `unknown -> released` (reason `unknown_released`), with evidence; any other state is
  `unknown_resolution_conflict`. **quote** (`subjectScope: { kind: "workspace", ref }`): resolves the payer through the active
  workspace binding and the single active, in-validity grant whose bound price matches event and meter unit, returning `payerRef`,
  `grantId`, `priceVersionId`, `mode`. Lock-free and advisory (reserve re-checks under lock). Unbound workspace or off payer is
  `billing_mode_off`; suspended payer, no match or more than one match is `grant_not_active`. Consumer scopes: `request_invalid`.
- **Codes**: gate refusals map to protocol codes (per-charge/daily/monthly -> `limit_exceeded`; inactive, out-of-validity or
  ineffective price -> `grant_not_active`). Addition proposed to the protocol: `request_invalid` (malformed request). An unknown
  `reservationId` is `reservation_state_conflict`. Write conflicts are `core_unavailable` (retry with the same key).
- **Lock order** (all money-path writers): Membership -> PayerAccount `FOR UPDATE` -> SpendGrant -> BudgetBucket day, then month
  `FOR UPDATE` -> BillingReservation -> FundsTransaction -> FundsAccountProjection. PayerAccount is the per-payer mutex.
  Callers of `changeSpendGrantInTransaction` must not lock buckets or reservations first. A bucket CAS miss under that lock means
  counters and reservations disagree: `reservation_invariant_breach` is thrown (not a reject code) and must be alerted, not retried.
- **Verify / rollback**: unit `reservations.test.ts`; `npm run test:billing:mysql` (concurrent over-limit reserves on two connections,
  racing same key, racing releases, double settle, settle vs release, cross-day release/settle, triggers). Rollback: stop calling the service;
  `prisma/rollback/20261110_rollback_billing_charges.sql` (first; restores the S2-a funds ENUMs) and
  `prisma/rollback/20261110_rollback_billing_reservations.sql` each refuse while their rows exist.
- **Not here**: refunds/charge reversal, routes and service-grant authentication (S3-b3), reservation expiry, increasing a
  hold, execution claims (business side, S0 §5).
