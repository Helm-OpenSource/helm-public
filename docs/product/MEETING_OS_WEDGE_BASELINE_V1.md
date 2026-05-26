---
status: active
owner: helm-core
created: 2026-03-30
review_after: 2026-06-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Meeting OS Wedge Baseline v1

## Purpose

This document freezes the current Meeting OS Wedge v1 as a product package on current main.

It records what is now part of the wedge, what role each surface plays, and which boundaries must remain explicit.

This is not a workflow engine baseline.
This is not a send-authority baseline.
This is not a connector-platform baseline.
This is not a broader governance platform baseline.

## Frozen product package

The Meeting OS Wedge v1 is frozen as the following package:

- meeting as the first strong operating entry
- meeting first-screen wedge on meeting detail
- meeting-derived memory bundle and lifecycle
- dashboard / approvals / diagnostics loop consumption
- meeting workspace
- meeting-scoped Ask Helm
- governance / ownership readability
- ingress context
- meeting templates
- workspace light
- meeting memory governance pack

## Surface roles

### `/dashboard`

Frozen role:

- `what matters now`
- strongest current meeting entry
- arbitration across meeting pressure, follow-through pressure, memory writeback, and review posture

### `/meetings/[id]`

Frozen role:

- `why this meeting matters and what follows`
- meeting-scoped workspace
- meeting-scoped Ask Helm
- local memory, governance, ingress, and next-step framing

### `/approvals`

Frozen role:

- formal review surface
- why review is still required
- how meeting-derived follow-through is kept behind an explicit trust boundary

### `/memory`

Frozen role:

- what was written back
- with what confidence / lifecycle / governance posture
- source-grounded meeting-derived memory reuse

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
- governance posture remains visible
- object-state use remains explainable
- conflict-sensitive or unclear items must surface rather than silently merge

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
- a connector search layer
- an execution surface
- a send surface

## Frozen governance posture

Governance / ownership cues remain a readability layer, not a permissions platform.

The wedge may show:

- `personal`
- `shared-with-team`
- `promoted-to-object-state`
- `review-only`

These cues improve enterprise readability and trust.
They do not create:

- a platform ACL system
- full RBAC
- admin policy control
- workflow authority

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
- no export/delete/revoke platform beyond the meeting wedge
- no broad permissions / RBAC system
- no team admin panel

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

Any broader change should be framed as a new wedge revision, not silent scope creep inside v1.
