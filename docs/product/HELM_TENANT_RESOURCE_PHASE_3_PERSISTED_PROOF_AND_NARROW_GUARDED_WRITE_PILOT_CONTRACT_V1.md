---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Resource Phase 3 Persisted Proof And Narrow Guarded Write Pilot Contract V1

## Status

Accepted for tenant resource governance phase 3.

This contract turns the stage 2 read-only proof and guarded-write evaluation chain into a persisted local runtime seam. It does not create external write execution, remote worker orchestration, sandboxing, connector mutation, or customer-visible send authority.

## Objective

Stage 2 proved that Helm can explain:

- why a resource may shape judgement
- what proof is required after manual follow-through
- whether the resource may only enter a later guarded-write design review

Phase 3 adds the narrowest persisted control layer needed to prove local operator workflow:

- manual proof can be submitted and reviewed with durable records
- a narrow guarded-write pilot can be requested only after accepted proof
- pilot review and acknowledgement can be closed locally
- settings and operating surfaces can read the current proof and pilot posture from persisted records

## Contract

Phase 3 introduces two persisted local seams:

1. `TenantResourceManualProofRecord`
   - proof id
   - resource key
   - action ref
   - provider
   - proof status
   - submitted by / at
   - review started by / at
   - reviewed by / at
   - expires at
   - evidence refs
   - failure reason
   - operator note

2. `TenantResourceGuardedWritePilotRecord`
   - pilot id
   - resource key
   - action ref
   - provider
   - linked proof id
   - pilot status
   - requested by / at
   - reviewed by / at
   - acknowledged by / at
   - evidence refs
   - operator note

## Persistence Strategy

Phase 3 deliberately reuses existing local governance primitives instead of adding new schema:

- `ActionItem`
- `ApprovalTask`
- `AuditLog`

Metadata kinds are:

- `tenant_resource_manual_proof`
- `tenant_resource_guarded_write_pilot`

This slice does not introduce:

- a new proof table
- a new official write table
- a migration
- a new queue service

## Manual Proof Lifecycle

Manual proof persistence replaces the prior read-only posture with durable local states:

- `SUBMITTED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `REJECTED`
- `WITHDRAWN`
- `EXPIRED`

Rules:

- proof submission requires an existing evidence detail and operator note
- duplicate open proof for the same `resourceKey + actionRef` is blocked
- accepted proof is evidence only; it is not external success
- withdrawal, rejection and expiry keep the resource out of pilot requestable posture

## Narrow Guarded Write Pilot

The pilot is only available when all of the following are true:

- current evidence detail exists
- persisted manual proof is accepted
- stage 2 guarded-write evaluation is `eligible_for_design_review`
- no open pilot already exists for the same `resourceKey + actionRef`

Pilot states are:

- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `ACKNOWLEDGED`

Rules:

- pilot request is local-only and review-gated
- pilot approval is not official write success
- pilot acknowledgement only closes the local operator loop
- any real guarded write still requires a later explicit implementation slice

## UI Entry

Phase 3 stays inside existing resource governance entry points:

- settings resource cards
- settings `查看依据 / View evidence` disclosure
- operating resource impact read model

No new swarm UI, connector control plane, or external execution button is introduced.

## Boundary

- Persisted proof does not grant write authority.
- Guarded write pilot does not external-write.
- This slice does not reuse meeting-only official write runtime as tenant-resource execution truth.
- This slice does not create retries, rollback, receipts, or remote execution.
- This slice does not weaken recommendation / commitment boundaries.
- This slice remains manual, review-first and local-only.
