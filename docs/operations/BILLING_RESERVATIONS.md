---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real price, deployment approval, payment, credential or customer data.
---

# Billing budget buckets and reservations / 预算桶与预占

S3-b1 (Core): migration `20261110200000_billing_reservations`, `lib/billing/reservations/reservations.ts`. Functions follow protocol
v3 `BillingCoreClient` (`reserve`, `markUnknown`, `release`; settle in S3-b2) as `(client, actor, req)` returning `{ ok, ... }` or
`{ ok: false, code }`; routes and `BillingServiceGrant` are S3-b3. 所有账户默认 `billingMode=off`。

- **BudgetBucket**: grant x mode (shadow never consumes enforce limits) x Asia/Shanghai `day|month`, counting settled and reserved
  (held + unknown) fen; never deleted; each move is a `version + 1` CAS with the limit or non-negative guard in its own WHERE.
- **Reserve**: idempotent by `(payerRef, idempotencyKey)` (`^[A-Za-z0-9:_-]{8,128}$`; a rejected request never consumes it) + content
  hash; one reservation per `(payerRef, operationRef)`. The S3-a gate prices from the bound price row at `UTC_TIMESTAMP(3)` with
  `usedFen` from the locked buckets. Frozen (trigger): mode, grant/price version, price hash, `chargeFen`, `reservedAt`, period keys.
  Replays return the current state. Enforce needs wallet minus open enforce holds; shadow skips money entirely. Zero fen is
  `grant_charge_zero`. `off` is `billing_mode_off`; an unknown or suspended payer is `grant_not_active`. Refusals write nothing.
- **States**: `held -> unknown` (`markUnknown`) keeps the hold; `held -> released` (`release`, `not_executed|failed|partial_unusable`)
  returns it to the **frozen** periods even on a later day/month. Unknown leaves only via S3-b2 `resolveUnknown` (trigger: only
  reason `unknown_released` from unknown). Same key + content replays (markUnknown reports the current state); other content or a
  wrong `operationRef` is `idempotency_conflict`; an unknown `reservationId` is `reservation_state_conflict`. Keys are unique per payer.
- **Codes**: limits -> `limit_exceeded`; inactive/out-of-validity/ineffective price -> `grant_not_active`; `request_invalid` (v3.2).
  Write conflicts, deadlocks (1213) and lock timeouts (1205) are `core_unavailable` (retry the same key).
- **Locks**: Membership -> PayerAccount `FOR UPDATE` (per-payer mutex) -> SpendGrant -> buckets day, month -> reservation. Hold sums,
  wallet and bucket existence are plain reads (current under the mutex; locking reads gap-locked across payers and deadlocked), so
  callers must not read before calling. `changeSpendGrantInTransaction` callers must not lock buckets first. A bucket CAS miss
  throws `reservation_invariant_breach` (not a code): alert, do not retry.
- **Verify / rollback**: `reservations.test.ts`; `npm run test:billing:mysql` (over-limit and 16-payer concurrency, racing keys and
  releases, cross-day release, triggers). Stop calling the service; the rollback SQL refuses while rows exist.
- **Not here**: settle (S3-b2), routes (S3-b3), expiry, increasing a hold, execution claims (S0 §5).
