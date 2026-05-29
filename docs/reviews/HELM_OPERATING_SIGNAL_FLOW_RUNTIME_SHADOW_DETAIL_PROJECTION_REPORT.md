---
status: active
owner: helm-core
created: 2026-05-29
review_after: 2026-08-27
---
# Helm Operating Signal Flow Runtime Shadow Detail Projection Report

## Conclusion

This slice adds a route-disconnected detail projection path for Operating Signal Flow runtime shadow snapshots.

It allows the existing single-signal detail display model to be built from an already-sanitized `current_window` shadow snapshot, while keeping `/operating` and `/operating/signals/[signalKey]` fixture-backed by default.

This remains a **No-Go** for:

- runtime UI adoption
- production query default adoption
- schema, API, or migration changes
- official write
- automatic execution, approval, or external send
- fixture banner removal
- LLM final ranking

## What Changed

- `lib/operating-signal-flow/projection.ts`
  - added `buildOperatingSignalFlowSnapshotDetailDisplayModel`
  - kept the existing fixture-backed `buildOperatingSignalFlowDetailDisplayModel`
  - made detail `dataPosture` come from the source projection, so `current_window` can be represented without route adoption
  - added customer-readable labels for shadow-only rows:
    - action candidate
    - review task
    - audit receipt
    - current workspace operating loop

- `lib/operating-signal-flow/projection.test.ts`
  - proves a sanitized runtime shadow snapshot can create a single-signal detail model
  - proves the model keeps the handoff on `/approvals`
  - proves raw `traceId`, `requestId`, and `parentEventId` fragments are not echoed

## Boundary

The new projection function is pure display-model logic. It does not read from Prisma, does not add a route, does not change feature flags, and does not import the internal readout component into `/operating`.

The default user-visible posture remains:

- `/operating` shows fixture-backed signal flow
- `/operating/signals/[signalKey]` shows fixture-backed lifecycle detail
- runtime shadow remains disabled-by-default and allowlist-gated

## Classification

**已成形但仍需下一层**.

The projection layer is ready for future reviewer evaluation, but route adoption still requires a separate review packet and the existing role-level receipt / runtime adoption gates.
