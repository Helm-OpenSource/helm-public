# LLM spend reservation: atomic store contract

Status: candidate port and regression model. There is no persistent reservation adapter or provider activation in this change. The existing ledger/counter schema remains unchanged; only its explanatory comments are corrected. A passing in-memory test is not evidence of database atomicity or an enforced monthly limit.

## Correctness boundary

`SpendReservationStore.reserve` replaces two independently awaited counter/ledger writes. The previous service advanced the counter, attempted an insert, then released by attempt key on duplicate. That release could mutate the original live reservation, leaving a plausible counter but an un-settleable ledger entry. Further retries could leak counters. The service now makes one atomic store call and never compensates a duplicate or error by releasing an existing attempt.

The persistent adapter must implement the entire operation as one transaction:

1. Serialize the unique `(workspaceId, attemptRef)` identity across all states. Matching period, period policy version, amount, provider and model is a no-op duplicate; different identity is a conflict. Duplicate lookup precedes budget refusal and never authorizes a second provider call. Lease expiry and current ceiling changes do not rewrite the original attempt.
2. Reject a mismatched period counter policy version. For a new attempt, conditionally admit only if `reserved + settled + unknownBound + requested <= budget`; explicitly unlimited still records spend. Unknown usage stays charged to admission until resolved by a separately designed flow.
3. Commit the counter and attempt row together. Definite failure/refusal commits neither; duplicate-key races must roll back this transaction, not call release on an existing attempt. A lost commit acknowledgement is unknown: halt and reconcile/retry the same immutable key. An exception does not prove no database write occurred.
4. Preserve state-machine idempotency for settlement/release/unknown transitions. These operations also require transactional row/counter consistency in the future adapter.

`reserveSpend` continues returning `attempt_already_reserved` for a duplicate in any state. New refusal reasons distinguish `attempt_conflict` and `period_policy_conflict`. No production caller currently uses this candidate service; the provider gateway remains unchanged.

## Evidence and next implementation

The two regression tests first fail against the old implementation: repeated duplicates release the original row, and unknown spend becomes admissible budget again. The updated suite covers preserved settlement, concurrent duplicate ownership, terminal retries, changed identities, exhausted-budget duplicates, policy drift, failure propagation without release, and unknown occupancy. These are contract-model/service tests, not a persistent transaction test.

Before activation, supply a real transactional adapter against the existing schema; verify with independent database clients that competing attempts cannot overspend, duplicate races preserve the winner, failures between writes roll back, and uncertain commit outcomes reconcile safely. Then separately prove every charged entry point, metering and conservative estimates, monthly period policy, and explicit activation authorization. Adding an environment variable alone does not establish enforcement.

Existing activation risks remain: negative estimates are still clamped to zero, and measured settlement may exceed the reserved estimate. Therefore this candidate is not a strict spending ceiling; a future activation must establish conservative estimates and an explicit over-reservation settlement policy. This patch does not silently change those existing semantics.
