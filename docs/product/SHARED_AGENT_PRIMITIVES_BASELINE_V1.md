---
status: active
owner: helm-core
created: 2026-03-29
review_after: 2026-06-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Shared Agent Primitives Baseline v1

## Purpose

This document is the repo-level baseline for the shared agent primitive layer now proven across one rich proving ground plus three thin adjacent adoptions.

It is a presentation/model-layer shared baseline, not a durable shared state system.

It defines what is now genuinely shared, what remains surface-specific, and which governance boundaries still apply.

This is not a canonical shared agent root object.
This is not a workflow-engine baseline.
This is not a send-authority baseline.

## Code Source

- `lib/presentation/agent-primitives.ts`

Operational queue/card composition now has its own customer-success-first baseline:

- `docs/product/SHARED_AGENT_OPERATIONAL_SURFACE_BASELINE_V1.md`

## Proven Adoption Ladder

- customer success = richest proving ground
- review-request detail = first thin adjacent adoption
- success-check detail = second thin adjacent adoption
- expansion-review detail = third thin adjacent adoption

## What Is Shared In v1

The following shared primitives are now frozen as repo-level reusable agent semantics:

### `AgentAuthorityState`

- `helm-prepared`
- `user-reviewed`
- `user-backed`

These remain provenance / authority cues only.
They do not imply send authority, execution authority, or commitment authority by themselves.

### `AgentAttentionState`

- `watching`
- `pushing`
- `waiting`
- `blocked`
- `review-before-send`

These remain work-attention / coordination cues only.
They are not stages and they are not workflow states.

### `AgentPolicyCue`

- `advisory-only`
- `internal-only`
- `approval-required`
- `internal-execution-allowed`
- `external-send-disabled`
- `commitment-disabled`

These remain conservative governance cues only.
They do not create a policy engine, a permission system, or route/owner mutation semantics.

### `AgentTag` and conservative formatting helpers

The shared layer now freezes:

- conservative chip/tag tone vocabulary
- authority label helpers
- attention label helpers
- policy label helpers

These helpers are presentation primitives only.
They do not widen any surface’s real authority.

### `AgentSurfaceSections`

The shared layer now freezes the optional section-slot semantics for:

- `since last seen`
- `resurfaced because`
- `policy / review posture`
- `progress trace`

These are shared display seams, not a canonical schema that every surface must fully adopt.

### Shared display/composition helpers

The shared layer now also freezes the small display/composition helpers proven across multiple surfaces:

- identity/header composition through the shared agent surface detail wrapper
- shared status chips for authority / attention / conservative policy posture
- shared resurfacing section for `since last seen` and `resurfaced because`
- shared thin progress trace rendering

These helpers remain slot-based presentation helpers.
They do not reinterpret domain meaning and they do not create a universal agent renderer.

The shared detail/composition baseline above should not be conflated with the shared operational queue/card layer.
The operational queue/card layer is currently proven on customer success queue/cards only and is frozen separately in the operational baseline document.

## What Is Intentionally Not Shared

The following remain surface-specific unless a later revision proves that the exact same semantics belong on multiple surfaces:

- customer success stage model
- issue / escalation semantic meaning
- `processAdvisory` categories
- internal action classes
- external draft classes
- review outcome / send handoff / manual send recorded cues
- post-send outcome classes
- local judgement / review posture copy that does not map cleanly across surfaces

These may plug into shared display slots, but they do not become repo-wide primitives in this document.

## Adoption Scope In This Round

- customer success remains the richest proving ground
- review-request detail is the first thin adjacent adoption
- success-check detail is the second thin adjacent adoption
- expansion-review detail is the third thin adjacent adoption
- success-check detail must consume shared primitives through a success-check-specific adapter instead of counting raw customer-success detail reuse as a proof point
- expansion-review detail must consume shared primitives through an expansion-review-specific adapter instead of counting raw customer-success detail reuse as a proof point
- company detail intentionally remains out of scope in this round

## Governance / Boundary Rules

The shared primitive layer must keep these rules explicit:

- shared primitives do not create a canonical shared agent root object
- shared primitives do not create workflow-engine semantics
- shared primitives do not create process-control semantics
- shared primitives do not create send authority
- shared primitives do not create commitment authority
- recommendation does not equal commitment
- handoff does not equal commitment
- review-before-send does not mean safe-to-send by default

If a surface-specific use of the shared layer would overstate certainty, it must stay downgraded into boundary, prerequisite, dependency, risk, review, or non-commitment framing.

## Required vs Optional Shared Usage

Shared agent primitives are intentionally optional by surface.

A surface may adopt only the thin subset that maps cleanly, for example:

- authority cue
- attention cue
- since last seen
- resurfaced because
- policy / review posture
- thin progress trace

This document does not require every surface to adopt every section.
Thin consistent vocabulary is preferred over forced parity.
Review-request detail, success-check detail, and expansion-review detail are intentionally thinner than customer success.
Success-check detail is expected to remain visibly thinner than customer success even while it consumes the same shared primitives.
Expansion-review detail is also expected to remain visibly thinner than customer success and conservative around commercial posture.
