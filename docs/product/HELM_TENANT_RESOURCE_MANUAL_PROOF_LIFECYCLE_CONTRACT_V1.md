---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Resource Manual Proof Lifecycle Contract V1

## Status

Accepted for the second tenant-resource governance stage.

This contract defines the read-only lifecycle posture for manual proof after a resource-backed action is prepared. It does not create proof persistence, proof submission UI, review actions, or external write authority.

## Objective

Resource readiness and evidence detail can explain why Helm may use a tenant resource for judgement. The next layer must explain what happens after an operator performs the action manually:

- who is expected to submit proof
- which resource and action the proof belongs to
- who reviews the proof
- how rejected, withdrawn, expired, or blocked proof affects follow-through
- when the result may enter learn / report / handoff as accepted evidence

## Contract

`TenantResourceManualProofLifecycle` is built from the resource evidence detail, governed loop posture, and optional proof-record inputs.

It exposes:

1. Identity
   - lifecycle key
   - resource key
   - action ref
   - generated time

2. Requirement
   - proof required
   - lifecycle status

3. Submitter
   - expected submitter: `operator / none`
   - submitted by
   - submitted at

4. Reviewer
   - expected reviewer: `reviewer / none`
   - reviewed by
   - reviewed at

5. Expiry
   - expires at
   - expired posture

6. Proof record
   - proof id
   - proof status
   - evidence refs
   - failure reason

7. Follow-through
   - whether learn / report / handoff can close from this proof
   - next owner
   - next move
   - result posture

## Lifecycle States

- `not_required`: the resource-backed action does not need manual proof.
- `awaiting_submission`: proof is required but no proof record is available.
- `submitted`: operator has submitted proof and reviewer must inspect it.
- `under_review`: reviewer is already handling proof.
- `accepted`: proof has been accepted and may be used as follow-through evidence.
- `rejected`: proof failed review and must be repaired or retried.
- `withdrawn`: proof was withdrawn and must be resubmitted if still needed.
- `expired`: proof aged out before follow-through closure.
- `blocked`: proof cannot proceed because the resource action is blocked.

## Follow-Through Semantics

Accepted proof may unlock follow-through learning only as evidence. It does not mean:

- the external resource write succeeded
- Helm has official write authority
- the action may be auto-closed without review
- the proof is persisted by this slice

Rejected, withdrawn, expired, and blocked proof must keep follow-through open or stopped.

## UI Entry

The lifecycle appears inside the existing `查看依据 / View evidence` disclosure on:

- settings resource cards
- dashboard / operating resource impact cards

No submit, approve, reject, withdraw, expire, retry, or execute button is introduced in this slice.

## Boundary

- Manual proof lifecycle readout is read-only.
- This contract does not create a proof table or migration.
- This contract does not create a proof review queue.
- This contract does not external-write, send, or mutate tenant resources.
- This contract does not convert manual proof into official external success.
- Real persistence and review actions require a later explicit implementation slice.
