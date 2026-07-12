# Helm Governed Intelligence Runtime v4

## Goal

Connect the existing v3 intelligence contracts, supervised agent runtime,
review artifacts, governed actions, official-write intents, and private Pack /
Overlay execution seams into a recoverable, review-first runtime.

## Ordered Delivery

1. Freeze the public-safe requirements and status truth.
2. Add private-context, runtime-isolation, capability, and recovery contracts.
3. Implement the first real Helm-self read-only adapter in `helm-overlays`.
4. Add recoverable step persistence, leases, cancellation, and checkpoints.
5. Run one isolated Helm-self multi-pass workflow in shadow mode.
6. Materialize candidate artifacts and require a human promotion command before
   the existing governed-action chain is entered.
7. Extend metadata-only entitlement receipts in `helm-control-plane`.
8. Prove NPA native case-assignment writeback through the existing Pack /
   Overlay governance chain before considering limited automation.

## Hard Boundaries

- Public Core carries contracts, guards, synthetic fixtures, and generic review
  surfaces only.
- Real context, credentials, customer mappings, execution leases, and adapters
  stay private.
- Customer-facing send, connector activation, approval, and official memory
  promotion remain human actions.
- Static guards are defense in depth. Production isolation requires a separate
  worker, capability broker, constrained egress, and a side-effect-free model
  process.

## Verification

Every slice runs its targeted tests plus the repository boundary, typecheck,
lint, test, build, and public-release gates before PR review.
