---
status: active
owner: helm-core
created: 2026-10-03
review_after: 2026-11-03
public_safety: Generic candidate spend-reservation contract; no customer, credential, endpoint, or production evidence.
---

# LLM spend reservation: atomic store contract

Status: candidate port plus Prisma/MySQL transaction adapter. No provider entry point uses it. The existing ledger/counter schema remains unchanged; only explanatory comments are corrected. Its DDL is still a candidate, not authorised for site execution. Isolated synthetic database tests prove the stated adapter paths, not an enforced monthly limit.

## Correctness boundary

`SpendReservationStore.reserve` replaces two independently awaited counter/ledger writes. The previous service advanced the counter, attempted an insert, then released by attempt key on duplicate. That release could mutate the original live reservation, leaving a plausible counter but an un-settleable ledger entry. Further retries could leak counters. The service now makes one atomic store call and never compensates a duplicate or error by releasing an existing attempt.

`createPrismaSpendReservationStore` implements the following transaction contract:

1. Serialize the unique `(workspaceId, attemptRef)` identity across all states. Matching period, period policy version, amount, provider and model is a no-op duplicate; different identity is a conflict. Duplicate lookup precedes budget refusal and never authorizes a second provider call. Lease expiry and current ceiling changes do not rewrite the original attempt.
2. Reject a mismatched period counter policy version. For a new attempt, conditionally admit only if `reserved + settled + unknownBound + requested <= budget`; explicitly unlimited still records spend. Unknown usage stays charged to admission until resolved by a separately designed flow.
3. Commit the counter and attempt row together. Definite failure/refusal commits neither; duplicate-key races must roll back this transaction, not call release on an existing attempt. A lost commit acknowledgement is unknown: halt and reconcile/retry the same immutable key. An exception does not prove no database write occurred.
4. Preserve state-machine idempotency for settlement/release/unknown transitions; lock the attempt and update its row and counter in one transaction. A missing/insufficient counter is an error, not a free call.

`reserveSpend` continues returning `attempt_already_reserved` for a duplicate in any state. New refusal reasons distinguish `attempt_conflict` and `period_policy_conflict`. No production caller currently uses this candidate service; the provider gateway remains unchanged.

## Evidence and next implementation

The two regression tests first fail against the old implementation: repeated duplicates release the original row, and unknown spend becomes admissible budget again. The updated suite covers preserved settlement, concurrent duplicate ownership, terminal retries, changed identities, exhausted-budget duplicates, policy drift, failure propagation without release, and unknown occupancy. These are contract-model/service tests, not a persistent transaction test.

The isolated MySQL suite (`npm run test:spend-reservation:mysql`, with the required synthetic database environment) uses two separate Prisma clients. It verifies competition for the last budget units, duplicate ownership and settlement, terminal-key preservation, unknown occupancy, rollback after injected SQL failures, transition races, cross-period identity, zero amounts, signed BIGINT overflow, and ledger/counter reconciliation. The test refuses a non-synthetic database target before connecting; normal unit suites may skip it, so a skipped result is never database evidence. CI runs it in the existing ephemeral `model-egress-mysql` job with `SPEND_RESERVATION_MYSQL_REQUIRED=1`.

Before activation, prove every charged entry point, metering and conservative estimates, monthly period policy, migration approval, rollback/reconciliation of uncertain commits, and explicit activation authorization. Adding an environment variable alone does not establish enforcement. An unknown transaction outcome propagates an error; only confirmed unique-key/write-conflict rollbacks receive bounded transaction retries.

Existing activation risks remain: negative estimates are still clamped to zero, and measured settlement may exceed the reserved estimate. Therefore this candidate is not a strict spending ceiling; a future activation must establish conservative estimates and an explicit over-reservation settlement policy. This patch does not silently change those existing semantics.
