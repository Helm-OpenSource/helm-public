---
status: active
owner: helm-core
created: 2026-03-28
review_after: 2026-06-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Customer Success Handoff Source Of Truth v1.1

## Purpose

This document is the current acceptance-grade source of truth for the frozen `customer success handoff` baseline plus the thin v1.1 clarification layer. It makes the baseline self-contained, explicit, and safe to use across implementation, acceptance, training, and regression work.

## Scope

This document covers:

- the first-round local `customer success handoff` baseline
- the frozen surface fields and detail fields
- placement rules
- the minimal 10-stage model already present in the repo
- required vs supported contract shape
- the unchanged recommendation / commitment guardrails

This document does not change system positioning.

## v1.1 Clarification Boundary

`issue / escalation` rules and `success queue / success inbox` thin integration semantics are defined in the companion v1.1 spec.

This document remains the baseline authority for:

- system positioning
- frozen contract fields
- placement rules
- stage model
- recommendation / commitment guardrails

Where the companion v1.1 spec and this document interact, this document wins on baseline positioning and contract interpretation.

## Non-goals

This is:

- not a complete customer success platform
- not a complete CRM / CS ops platform
- not a workflow engine
- not a queue system of record
- not a permissions / enterprise IAM expansion

## Domain Positioning

`customer success handoff` is derived primarily from existing `opportunity / review request / company` context.

`inbox / meeting / memory` may contribute supporting evidence and context, but do not become new canonical parent objects for the handoff model.

It is:

- a judgement-first handoff surface
- a derived operational and reporting layer
- a route and contract built on top of existing commercial context

It is not:

- a new canonical customer success root object
- a replacement for company detail
- a replacement for review request
- a replacement for success check or expansion review

## Surface Baseline

The frozen `customer success handoff surface` baseline keeps these fields explicit:

- `judgement`
- `reason`
- `summary`
- `boundary`
- `worker`
- `evidence`
- `decisionRequest`
- `nextAction`
- `risk`
- `audienceMode`
- `ownership`
- `stage`

Code source:

- `lib/presentation/customer-success-handoff-surface-contract.ts`

### Surface Required

The current baseline requires these fields to remain present on the surface:

- `judgement`
- `reason`
- `summary`
- `boundary`
- `worker`
- `evidence`
- `decisionRequest`
- `nextAction`
- `risk`
- `stage`

### Surface Supported

The current baseline supports these fields and modes without requiring every scenario to use them equally:

- `audienceMode`
- `ownership`
- `pageEvidenceLinks`
- `pageEscalationHint`
- grouped evidence tracks

## Detail Contract Baseline

The frozen `customer success detail` baseline keeps these fields explicit:

- `judgement`
- `reason`
- `action`
- `decision`
- `boundary`
- `evidence`
- `worker`
- `nextAction`
- `risk`
- `audience`
- `stage`
- `sendability`
- `fallback`

Code source:

- `lib/presentation/customer-success-handoff-surface-contract.ts`

### Detail Required

The current baseline requires these detail fields to remain visible and non-empty:

- `judgement`
- `reason`
- `action`
- `decision`
- `boundary`
- `evidence`
- `worker`
- `nextAction`
- `risk`
- `stage`

### Detail Supported

The current baseline supports these detail fields and modifiers where the scenario needs them:

- `audience`
- `sendability`
- `fallback`
- `pageEvidenceLinks`
- `pageEscalationHint`

The baseline does not assume every scenario must maximize every supported field.

## Field Interpretation Notes

- `decisionRequest` is the explicit ask carried by the handoff surface.
- `decision` is the current decision framing shown in detail and may summarize current decision posture, not only the outbound ask.
- `owner` in queue / inbox views is a thin operational projection derived from `ownership`; it does not create a new canonical ownership object.
- Presentation labels such as `why it matters` and `action summary` are UI slots derived from frozen contract fields and do not introduce new schema fields.

## Placement Rules

### First Screen

The first screen must keep these items visible without opening the evidence drawer:

- current `judgement`
- current `reason`
- `why it matters`
- `action summary`
- `decision request`
- `boundary`
- `evidence summary`
- `worker summary`
- `next action`
- `risk cue`
- current `stage`

Where supported fields are present in the current scenario, their summary cues should also remain visible on the first screen, including:

- current `sendability`
- current `fallback`
- current `ownership`

### Secondary Summary

Secondary summary may carry compact status framing that supports the main judgement but must not replace it.

Where applicable, this may include:

- stage label
- ownership label
- audience label
- sendability label
- fallback label
- review pressure

### Evidence Drawer

The EvidenceDrawer is the only place that should hold grouped appendix-style detail by default:

- replay traces
- audit traces
- memory traces
- worker output traces
- boundary traces
- sendability traces
- handoff traces
- success traces
- historical change traces

Evidence may support the judgement, but must not displace the judgement from the first screen.

## Stage Model

These 10 stages are the complete frozen minimal stage model for v1.1.

If code, docs, tests, or checks diverge, they must be aligned back to this list.

The frozen minimal stage model remains exactly:

- `success-follow-through`
- `activation-follow-through`
- `review-follow-through`
- `expansion-review`
- `expansion-ready-but-blocked`
- `issue-follow-through`
- `escalation-follow-through`
- `internal-prep-only`
- `review-before-send`
- `blocked-by-boundary`

No extra stage is permitted in v1.1 without an explicit follow-on revision to this document.

## Stage Use Rules

### Customer success-owned stages

These are the normal current-round customer success handoff stages:

- `success-follow-through`
- `activation-follow-through`
- `review-follow-through`
- `issue-follow-through`
- `expansion-review`

### Shared or widened ownership stages

These widen ownership pressure but do not change the system into commitment mode:

- `escalation-follow-through`
- `expansion-ready-but-blocked`

### Internal-only or narrower stages

These remain narrower and should not be lifted into customer-facing certainty:

- `internal-prep-only`
- `review-before-send`
- `blocked-by-boundary`

## Supported Handoff Mainlines

The frozen handoff mainlines remain:

- `review request -> customer success`
- `company detail -> customer success`
- `customer success -> success check`
- `customer success -> expansion review`
- `customer success -> package / proposal / offer / external proposal`
- `customer success -> founder / sales / delivery`

v1.1 may add thin derived queue / inbox cues around these mainlines, but does not replace them.

## Required vs Supported Shape

### Baseline Required

These are required for acceptance of the baseline itself:

- explicit current judgement
- explicit reason
- explicit action summary
- explicit decision request
- explicit boundary
- explicit evidence summary
- explicit worker summary
- explicit next action
- explicit risk cue
- explicit stage cue

### Baseline Supported

These are supported as scenario-specific enrichments:

- audience mode
- ownership mode
- sendability mode
- fallback mode
- evidence links
- escalation hint
- thin queue/inbox cue
- issue / escalation variant cue

Supported does not mean mandatory in every scenario.

## Guardrails

The `recommendation / commitment` A-minus mainlines remain stable and unchanged.

The following rules stay frozen:

- recommendation is not commitment
- handoff is not commitment
- success follow-through is not commitment
- success check is not commitment
- expansion review is not commitment
- explanation is not commitment
- review-before-send is not safe-to-send by default

Whenever customer-facing wording can be misunderstood as commitment, the baseline still requires downgrade into:

- `boundary`
- `prerequisite`
- `dependency`
- `risk`
- `non-commitment`
- `review-before-send`

## Explicit Out-of-scope Boundaries

These remain intentionally out of scope for this document and the current implementation:

- complete customer success platform behavior
- complete queue ownership engine
- complete SLA / escalation engine
- complete enterprise permissions platform
- plugin sandbox
- multi-org / multi-permission / multi-tenant expansion
- default high-risk auto-send
- default high-risk auto-commit

## Acceptance Notes

This source of truth should be treated as the acceptance anchor for:

- routes
- detail models
- handoff copy
- queue / inbox thin integration
- README and docs index entries
- self-checks
- boundary guards
- regression tests

If docs, code, tests, and checks diverge, this document should pull the implementation back toward the frozen baseline rather than widening scope.
