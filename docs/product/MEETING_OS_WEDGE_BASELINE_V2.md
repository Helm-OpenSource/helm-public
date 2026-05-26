---
status: active
owner: helm-core
created: 2026-03-30
review_after: 2026-06-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Meeting OS Wedge Baseline v2

## Purpose

This document freezes the current Meeting OS Wedge after the PR5-PR7 layer additions as the updated v2 product package on current main.

It records what now belongs to the wedge, what each surface is responsible for, and which boundaries must remain explicit.

This is not a workflow engine baseline.
This is not a send-authority baseline.
This is not a connector-platform baseline.
This is not a broader governance platform baseline.

## Frozen product package

The Meeting OS Wedge v2 is frozen as the following package:

- meeting as the first strong operating entry
- meeting first-screen wedge on meeting detail
- meeting-derived memory bundle and conservative lifecycle
- dashboard / approvals / diagnostics loop consumption
- meeting workspace
- meeting ingress context
- meeting templates
- workspace light
- meeting-scoped Ask Helm
- governance / ownership readability
- meeting memory governance pack:
  - manual export
  - promoted-to-review retract
  - source-use ledger

## Surface roles

### `/dashboard`

Frozen role:

- `what matters now`
- strongest current meeting entry
- arbitration across meeting pressure, ingress pressure, follow-through pressure, memory writeback, and review posture

### `/meetings/[id]`

Frozen role:

- `why this meeting matters and what follows`
- meeting-scoped workspace
- meeting-scoped Ask Helm
- local ingress, memory, governance, and next-step framing

### `/approvals`

Frozen role:

- formal review surface
- why review is still required
- how meeting-derived follow-through and memory remain behind an explicit trust boundary

### `/memory`

Frozen role:

- what was written back
- with what confidence / lifecycle / governance posture
- source-grounded meeting-derived memory reuse
- narrow governance actions inside the meeting wedge only

### `/diagnostics`

Frozen role:

- workflow-scoped readiness judgement only
- whether this meeting loop reads ready to scale inside controlled pilot use

## Frozen memory semantics

The meeting-derived memory bundle is frozen with these expectations:

- meeting outputs are reusable operating-system memory, not just page copy
- lifecycle remains conservative:
  - `promoted`
  - `ready`
  - `pending-review`
  - `conflict`
- source pointers remain visible
- source-use posture remains visible
- governance posture remains visible
- object-state use remains explainable
- conflict-sensitive or unclear items must surface rather than silently merge

## Frozen ingress semantics

Meeting ingress context remains narrow and read-only in this baseline.

It may show:

- source calendar / event anchoring
- participant context
- related thread / inbox pressure when visible
- related prior meeting or object-state continuity when visible
- the most relevant pre-meeting pressure cue

It does not become:

- automatic scheduling
- a connector auth/settings layer
- a broader connector marketplace

## Frozen template and workspace semantics

Meeting templates remain light framing aids only.

Supported template types in this baseline:

- `customer-call`
- `internal-decision`
- `interview`
- `vendor-review`
- `follow-up-sync`

They may shape:

- first-screen framing
- object-state emphasis
- next-step workspace framing
- review / readiness wording

They do not create:

- workflow engine semantics
- auto-execution semantics
- a generic meeting platform abstraction

Workspace light remains a collaboration readability layer only.
It may show:

- `personal`
- `shared-with-team`
- `promoted-to-object-state`
- `review-only`

It does not create:

- a platform ACL system
- full RBAC
- admin policy control
- workflow authority

## Frozen Ask Helm scope

Ask Helm remains narrow and meeting-scoped in this baseline.

It may answer from:

- this meeting
- connected objects
- promoted meeting memory
- linked blockers / commitments / decisions
- recent related meetings inside the same local workspace context only

It does not become:

- a global workspace assistant
- a cross-surface Ask Helm layer
- a connector search layer
- an execution surface
- a send surface

## Frozen governance pack

Meeting memory governance actions remain narrow and meeting-wedge-scoped only.

The wedge may support:

- manual export of the current meeting-derived memory bundle
- manual retract of a promoted meeting-derived memory item back to review-only
- readable source-use ledger and source posture

These governance actions must remain:

- manual only
- meeting-scoped only
- source-grounded
- reason-chain-preserving

They do not create:

- a broader export/delete/revoke platform
- a global governance console
- a broader permissions platform

## Preserved boundaries

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no `apps/helm-app`
- no `packages/helm-control`
- no shell thinning
- no send authority
- no workflow control
- no automatic scheduling
- no connector/platform expansion
- no second app tree
- no broader governance platform
- no broad permissions / RBAC system
- no team admin panel
- no cross-surface global Ask Helm

## What this baseline does not claim

This baseline does not claim:

- broader rollout readiness
- system-wide readiness
- measurable business impact
- send-authority readiness
- workflow-control readiness
- commercial-readiness parity across all surfaces

## Upgrade rule

Future work should treat this baseline as frozen unless there is a clear reason to revise the package.

The next acceptable changes should stay narrow:

- wording
- hierarchy
- governance / boundary cue clarity
- workspace readability
- source-use ledger readability

Any broader change should be framed as a new wedge revision, not silent scope creep inside v2.
