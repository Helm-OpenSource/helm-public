---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real price, deployment approval, payment, credential or customer data.
---

# Billing budget buckets and reservations / 预算桶与预占

Billing V1 S3-b1 (Core), migration `20261110200000_billing_reservations`, `lib/billing/reservations/reservations.ts`. Library
functions map 1:1 onto the S3 internal protocol v2 `BillingCoreClient` (`reserve`, `markUnknown`, `release`; `settle` is S3-b2)
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
- **Modes and funds**: enforce needs `customer_wallet_available` minus every open hold to cover the charge (`insufficient_funds`).
  Shadow runs the full lifecycle (reserve, settle, release, unknown) in its shadow buckets with no balance check and never
  writes a funds entry or projection. `off` is `billing_mode_off` (run unbilled, v2 §4); an unknown or suspended payer fails closed (`grant_not_active`). Any refusal rolls the
  whole transaction back (no partial write). Zero fen: a use pricing to 0 fen is `grant_charge_zero`, never reserved as free.
- **States**: `held -> unknown` (`markUnknown`, evidence) keeps the hold counted and is never released by time.
  `held|unknown -> released` (`release`, `reasonCode` `not_executed|failed|partial_unusable` + evidence) removes the hold from the
  **frozen** period buckets, even when released on a later day or month. Released is terminal. Same key + content replays; same key
  with other content is `idempotency_conflict`; a wrong `operationRef` is `idempotency_conflict`.
- **Codes**: gate refusals map to protocol codes (per-charge/daily/monthly -> `limit_exceeded`; inactive, out-of-validity or
  ineffective price -> `grant_not_active`). Additions proposed to the protocol: `request_invalid` (malformed request). An unknown
  `reservationId` is `reservation_state_conflict`. Write conflicts are `core_unavailable` (retry with the same key).
- **Lock order** (all money-path writers): Membership -> PayerAccount `FOR UPDATE` -> SpendGrant -> BudgetBucket day, then month
  `FOR UPDATE` -> BillingReservation (-> FundsTransaction -> FundsAccountProjection in S3-b2). PayerAccount is the per-payer mutex.
  Callers of `changeSpendGrantInTransaction` must not lock buckets or reservations first. A bucket CAS miss under that lock means
  counters and reservations disagree: `reservation_invariant_breach` is thrown (not a reject code) and must be alerted, not retried.
- **Verify / rollback**: unit `reservations.test.ts`; `npm run test:billing:mysql` (concurrent over-limit reserves on two connections,
  racing same key, racing releases, cross-day release, triggers). Rollback: stop calling the service;
  `prisma/rollback/20261110_rollback_billing_reservations.sql` refuses while any bucket or reservation row exists.
- **Not here**: settle/charge and outbox (S3-b2), routes and service-grant authentication (S3-b3), reservation expiry, increasing a
  hold, execution claims (business side, S0 §5).
