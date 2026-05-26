---
status: active
owner: helm-core
created: 2026-03-28
review_after: 2026-06-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Customer Success Issue Escalation Queue v1.1 Spec

## Purpose

This spec defines the next thin layer on top of the frozen `customer success handoff` baseline:

- `issue`
- `escalation`
- thin derived `success queue / success inbox`

It does not reposition the system as a platform.

Where this companion v1.1 spec and `CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md` interact, the source-of-truth document wins on baseline positioning and contract interpretation.

## Scope

This spec covers:

- issue vs escalation meaning
- trigger conditions
- escalation and de-escalation rules
- relationship to `success check` and `expansion review`
- contract-level differences in judgement, boundary, nextAction, decisionRequest, risk, sendability, and fallback
- thin derived queue / inbox semantics
- minimal queue / inbox fields
- minimal UI copy / empty-state guidance

## Non-goals

This spec does not introduce:

- workflow engine semantics
- SLA platform behavior
- enterprise permissions platform behavior
- automatic commitment
- automatic high-risk send
- canonical queue system of record

## Variant Definitions

### Issue

`issue` is a customer success follow-through variant used when the account needs explicit problem handling, but the current pressure still fits the ordinary customer success operating line.

`issue-follow-through` is used when customer success sees a real follow-through problem, but the path to resolution remains within normal current-round coordination and does not yet require widened ownership pressure.

Typical markers:

- overdue or stressed commitment
- follow-through gap
- unresolved blocker that still does not require founder-level widening
- success check that cannot move cleanly forward without visible repair

### Escalation

`escalation` is a customer success follow-through variant used when the current pressure is strong enough that the next move needs wider ownership, stronger guardrails, or higher-level intervention.

`escalation-follow-through` is used when progress is materially blocked by dependency, boundary, missing decision, cross-functional ownership pressure, or elevated execution risk.

Typical markers:

- blocker severity already outruns normal follow-through
- high-risk or critical commercial pressure
- review pressure plus blocker pressure plus ownership uncertainty
- founder / sales / delivery intervention is now part of the next move

## Trigger Conditions

### Issue triggers

Issue is appropriate when at least one of the following is true and escalation is not yet required:

- overdue commitment is present
- follow-through obligation is slipping
- boundary or dependency remains visible but still locally manageable
- customer success should own repair framing before the story widens

### Escalation triggers

Escalation is appropriate when at least one of the following is true:

- blocker severity is already high enough to widen ownership
- risk is `HIGH` or `CRITICAL`
- the next move would be misleading without founder / sales / delivery intervention
- the chain cannot honestly continue as normal success follow-through

## Escalation Conditions

Escalate when:

- the issue stops being purely operational follow-through
- boundary and risk pressure outrun local customer success handling
- the next external wording must not move without higher review
- package / proposal / offer / reinforcement evidence is no longer aligned with the current success story
- a required dependency is blocked or unresolved
- ownership must widen beyond the normal customer success path
- risk has increased enough that normal follow-through wording would understate reality
- a decision is required before safe external progression
- the current path would otherwise drift into implied commitment

## De-escalation and Downgrade Conditions

Downgrade escalation back to issue when:

- blocker severity decreases
- higher-risk uncertainty is reduced
- ownership is clear again
- the next move no longer needs widened intervention
- blocking dependencies are cleared
- ownership pressure narrows back to normal customer success handling
- the decision bottleneck is resolved
- the boundary / risk posture no longer requires widened escalation framing

Downgrade issue or escalation into narrower modes when:

- external wording is not yet safe
- prerequisite or dependency is still unresolved
- the chain must stay `review-before-send`
- the chain must stay `boundary-only`
- the chain must stay `non-commitment-fallback`

## Relationship To Success Check And Expansion Review

### Relative to success check

- `success check` is a verification layer
- `issue` is a follow-through repair layer
- `escalation` is a widened follow-through layer

Use `success check` when the main question is readiness.

Use `issue` when the main question is repair.

Use `escalation` when the main question is widened intervention.

### Relative to expansion review

- `expansion review` asks whether the story should widen
- `issue` and `escalation` ask whether the current success path needs repair or intervention before widening

If issue or escalation pressure is still open, `expansion review` must not behave as if the path is already clean.

## Routing Rules

- `issue-follow-through` may route forward into `success check` when the issue is sufficiently contained.
- `issue-follow-through` may route into `expansion review` only when the issue does not distort commercial readiness.
- `escalation-follow-through` does not imply commitment and should remain boundary / risk / decision-first.
- `escalation-follow-through` may downgrade into `review-before-send` or `blocked-by-boundary` when external sendability would otherwise overstate certainty.

## Variant Differences

| Field | Issue | Escalation |
| --- | --- | --- |
| Judgement | keep work in repair-oriented follow-through | widen ownership and intervention before the chain speaks more firmly |
| Boundary | visible repair boundary | stronger boundary, higher caution, explicit intervention line |
| Next action | fix, clarify, re-route, confirm | escalate, align, review, intervene, downgrade if needed |
| Decision request | confirm repair path and owner | confirm escalated owner, intervention level, and safe next route |
| Risk | caution or high | usually high |
| Sendability | internal-only or customer-visible-with-boundary in narrow cases | boundary-only or review-before-send by default |
| Fallback | non-commitment fallback common | blocked-by-boundary or review-hold more common |

## Minimal Ownership Variants

v1.1 keeps ownership thin and derived:

- `customer-success`
- `shared-with-sales`
- `shared-with-delivery`
- `shared-with-founder`

Recommended use:

- `issue`: usually `customer-success`, sometimes shared with sales or delivery
- `escalation`: often `shared-with-founder`, sometimes shared with sales or delivery

## Minimal Stage Variants

v1.1 does not add new stage names. It reuses the frozen baseline:

- `issue-follow-through`
- `escalation-follow-through`
- `review-before-send`
- `blocked-by-boundary`
- `expansion-ready-but-blocked`

## Thin Queue And Inbox Semantics

`success queue / success inbox` in v1.1 is:

- a derived operational surface
- a prioritization and routing view
- a convenience layer for customer success ownership

`success queue / success inbox` is a derived operational surface.
It is not a canonical system of record.

It is not:

- a canonical system of record
- a workflow engine
- a task platform
- a queue ownership database

`customer success handoff` is derived primarily from existing `opportunity / review request / company` context.

`inbox / meeting / memory` may contribute supporting evidence and context, but do not become new canonical parent objects for the handoff model.

## Queue And Inbox v1 Minimal Fields

Each thin queue or inbox item should keep these fields visible:

- `stage`
- `judgement`
- `owner`
- `nextAction`
- `risk`
- `evidence`
- `decisionRequest`
- `boundary`

These are the minimal projected fields for v1.1.

Its purpose is:

- prioritization
- visibility
- thin routing cues
- operational triage

It does not introduce:

- workflow engine semantics
- SLA engine semantics
- permissions expansion
- default auto-send
- default auto-commit

Optional thin enrichments:

- linked company
- linked thread
- linked review request
- linked success check
- linked expansion review

## Minimal UI Copy Guidance

### Queue surface

The queue surface should say:

- why this item belongs in customer success now
- whether it is ordinary follow-through, issue, or escalation
- what the next owner must do
- why it is still bounded

### Inbox surface

The inbox surface should say:

- why this thread matters to customer success
- whether the thread is still internal-only or review-before-send
- whether the thread supports issue handling, escalation, or ordinary follow-through
- which detail page should inherit the next move

## Minimal Empty States

Recommended empty-state language:

- no active customer success queue items: customer success queue is currently empty because no active handoff needs dedicated success ownership yet
- no active success inbox items: success inbox is currently empty because no linked thread is waiting on customer success follow-through yet

## Minimal Filters And Scenario Cues

If the repo already supports thin filters or chips, v1.1 may use them for:

- `issue`
- `escalation`
- `review-before-send`
- `blocked`

This is optional thin guidance, not a requirement for a filter platform.

## Operational Guardrails

The following guardrails remain unchanged:

- no workflow engine semantics
- no SLA semantics
- no enterprise permissions expansion
- no automatic high-risk customer-visible send
- no automatic commitment
- no conversion of review / boundary / non-commitment into commitment

## Implementation Boundary

v1.1 implementation should remain thin:

- reuse existing customer success contract and detail chain
- add only enough code to surface issue / escalation cues clearly
- add only enough data and UI wiring to expose a derived queue / inbox surface
- keep `app/` as route owner
- keep `data/queries.ts` as aggregation entry

## Acceptance Standard

v1.1 is acceptance-grade when:

- issue and escalation are clearly separated
- escalation does not overclaim workflow semantics
- queue and inbox are clearly described as derived surfaces
- the customer success handoff mainlines remain intact
- docs, checks, tests, and UI use the same positioning
