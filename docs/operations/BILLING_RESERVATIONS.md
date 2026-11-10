---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real price, deployment approval, payment, credential or customer data.
---

# Billing budget buckets and reservations / 预算桶与预占

S3-b1/S3-b2 (Core): migrations `20261110200000_billing_reservations`, `20261110210000_billing_charges`,
`lib/billing/reservations/reservations.ts`. Functions follow protocol v3 `BillingCoreClient` (`quote`, `reserve`, `settle`,
`release`, `markUnknown`, `resolveUnknown`) as `(client, actor, req)` returning `{ ok, ... }` or
`{ ok: false, code }`; routes and `BillingServiceGrant` are S3-b3. 所有账户默认 `billingMode=off`。

- **BudgetBucket**: grant x mode (shadow never consumes enforce limits) x Asia/Shanghai `day|month`, counting settled and reserved
  (held + unknown) fen; never deleted; each move is a `version + 1` CAS with the limit or non-negative guard in its own WHERE.
- **Reserve**: idempotent by `(payerRef, idempotencyKey)` (`^[A-Za-z0-9:_-]{8,128}$`; a rejected request never consumes it) + content
  hash; one reservation per `(payerRef, operationRef)`. The S3-a gate prices from the bound price row at `UTC_TIMESTAMP(3)` with
  `usedFen` from the locked buckets. Frozen (trigger): mode, grant/price version, price hash, `chargeFen`, `reservedAt`, period keys.
  Replays return the current state. Enforce needs wallet + `availableCreditFen` (S3-e seam under the PayerAccount lock, 0 until
  S3-e) minus open enforce holds; shadow skips money entirely. Zero fen is
  `grant_charge_zero`. `off` is `billing_mode_off`; an unknown or suspended payer is `grant_not_active`. Refusals write nothing.
- **States**: `held -> unknown` (`markUnknown`) keeps the hold; `held -> released` (`release`, `not_executed|failed|partial_unusable`)
  returns it to the **frozen** periods even on a later day/month. Business `settle`/`release` accept only `held`; unknown leaves
  only via `resolveUnknown` (trigger: only reason `unknown_released` from unknown). Same key + content replays (markUnknown reports the current state); other content or a
  wrong `operationRef` is `idempotency_conflict`; an unknown `reservationId` is `reservation_state_conflict`. Keys are unique per payer.
- **Settle** (`held -> settled`, once): `quantityUsed` <= reserved (`quantity_exceeds_reservation`; `"0"` is `request_invalid`, use
  release) is repriced from the frozen price row (hash re-checked), `chargeFen <= capFen`. One transaction moves reserved to
  settled in the **frozen** buckets (a later-day/month settle counts in the reserve-time periods), posts a `charge` transaction
  (debit wallet, credit `charge_revenue`, `charge:<reservationId>`; audit + `funds.posted`), writes the immutable `BillingCharge`
  and a `billing.charge.settled` outbox row. A 0-fen settle (smaller quantity) is `settled` with `chargeFen` 0 and no funds entry.
  Shadow writes the charge (`fundsTransactionId` null) and `billing.charge.shadow_settled`, never funds. Settle of a held
  reservation never checks payer status or mode (R05: delivered results are processed; only new reserves are blocked, for shadow
  and enforce alike); the funds journal admits `charge` postings for suspended/off payers for this reason. `insufficient_funds`
  (wallet corrected below the hold) is refused: the business side keeps it retryable or `review_needed` and must not release.
- **resolveUnknown** (reconciliation/manual channel; routes S3-b3/S5): `unknown -> settled` (needs `quantityUsed`) or
  `-> released` (`unknown_released`) on evidence; other states are `unknown_resolution_conflict`. **quote**
  (`{ kind: "workspace", workspaceId }`; vault is `request_invalid` until S3-f): payer via the active binding and the single active
  grant matching event and meter unit -> `payerRef`, `grantId`, `priceVersionId`, `mode` (`shadow|enforce`). Advisory, lock-free.
  Unbound workspace or off payer is `billing_mode_off`; suspended payer, none or several grants are `grant_not_active`.
- **Codes**: limits -> `limit_exceeded`; inactive/out-of-validity/ineffective price -> `grant_not_active`; `request_invalid` (v3.2).
  Write conflicts, deadlocks (1213) and lock timeouts (1205) are `core_unavailable` (retry the same key).
- **Locks**: Membership -> PayerAccount `FOR UPDATE` (per-payer mutex) -> SpendGrant -> buckets day, month -> reservation. Hold sums,
  wallet and bucket existence are plain reads (current under the mutex; locking reads gap-locked across payers and deadlocked), so
  callers must not read before calling. `changeSpendGrantInTransaction` callers must not lock buckets first. A bucket CAS miss
  throws `reservation_invariant_breach` (not a code): the S3-b3 route must alert on it; do not retry.
- **Verify / rollback**: `reservations.test.ts`; `npm run test:billing:mysql` (over-limit and 16-payer concurrency, racing keys,
  double settle, settle vs release, cross-period settle, triggers, guarded rollbacks). Stop calling the service; roll back charges
  first (refuses while charge rows exist; removes only `charge`/`charge_revenue` from the current ENUMs), then reservations. The
  S2-c and S2-a rollbacks refuse while a later billing migration is applied.
- **Not here**: refunds, routes (S3-b3), expiry, increasing a hold, execution claims (S0 §5).
