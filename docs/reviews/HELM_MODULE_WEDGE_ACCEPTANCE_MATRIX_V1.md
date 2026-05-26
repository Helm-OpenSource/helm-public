---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Module Wedge Acceptance Matrix v1

## Purpose

This matrix freezes the rollout decision for every audited module in the current workspace inventory.

Legend for `method layers apply`:

- `why-now`
- `object/state`
- `next-step`
- `boundary`
- `memory/source`
- `readiness`
- `Ask Helm`
- `governance`

## Phase 1: Primary operating surfaces

| module / route | category | current state | target state | method layers apply | risk level | rollout phase | final status |
|---|---|---|---|---|---|---|---|
| dashboard `/dashboard` | full operating surface | meeting-aware arbitration and operating center | full wedge | why-now, object/state, next-step, boundary, memory/source, readiness, governance | medium | 1 | accepted / full wedge |
| meetings detail `/meetings/[id]` | full operating surface | Meeting OS Wedge v2 proving ground | full wedge | why-now, object/state, next-step, boundary, memory/source, readiness, Ask Helm, governance | medium | 1 | accepted / full wedge |
| approvals `/approvals` | full operating surface | formal review surface with meeting-memory linkage | full wedge | why-now, object/state, next-step, boundary, memory/source, governance | medium | 1 | accepted / full wedge |
| memory `/memory` | full operating surface | object-state substrate plus source-grounded meeting memory lifecycle | full wedge | why-now, object/state, next-step, boundary, memory/source, governance | medium | 1 | accepted / full wedge |
| diagnostics `/diagnostics` | full operating surface | workflow-scoped readiness judgement | full wedge | why-now, next-step, boundary, memory/source, readiness, governance | low | 1 | accepted / full wedge |

## Phase 2: Decision / review surfaces

| module / route | category | current state | target state | method layers apply | risk level | rollout phase | final status |
|---|---|---|---|---|---|---|---|
| customer success queue `/customer-success` | review surface | richest shared operational proving ground with thin operating summary and connected-loop handoff cue | thin adoption | why-now, next-step, boundary, memory/source, governance | medium | 2 | upgraded / thin adoption |
| customer success detail `/customer-success/[id]` | review surface | richest shared-agent detail proving ground | thin adoption | why-now, next-step, boundary, memory/source, governance | medium | 2 | upgraded / thin adoption |
| review request `/review-requests/[id]` | review surface | shared-agent thin adoption through review-request adapter | thin adoption | why-now, next-step, boundary, memory/source, governance | low | 2 | upgraded / thin adoption |
| follow-up `/follow-ups/[id]` | review surface | same thin review-request seam on a follow-up route | thin adoption | why-now, next-step, boundary, memory/source, governance | low | 2 | upgraded / thin adoption |
| success check `/success-checks/[id]` | review surface | thin adjacent adoption via shared agent detail shell | thin adoption | why-now, next-step, boundary, memory/source, governance | low | 2 | upgraded / thin adoption |
| expansion review `/expansion-reviews/[id]` | review surface | thin adjacent adoption via shared agent detail shell | thin adoption | why-now, next-step, boundary, memory/source, governance | low | 2 | upgraded / thin adoption |
| sales follow-up `/sales-followups/[id]` | review surface | thin shared detail shell with local sales follow-up semantics | thin adoption | why-now, next-step, boundary, memory/source | low | 2 | upgraded / thin adoption |
| sales objection `/sales-objections/[id]` | review surface | thin shared detail shell with objection / response framing | thin adoption | why-now, next-step, boundary, memory/source | low | 2 | upgraded / thin adoption |
| founder QA `/founder-qa/[id]` | review surface | thin shared detail shell with founder review framing | thin adoption | why-now, next-step, boundary, memory/source | low | 2 | upgraded / thin adoption |
| delivery review `/delivery-reviews/[id]` | review surface | thin shared detail shell with review posture | thin adoption | why-now, next-step, boundary, memory/source | low | 2 | upgraded / thin adoption |
| delivery walkthrough `/delivery-walkthroughs/[id]` | review surface | thin shared detail shell with guided review semantics | thin adoption | why-now, next-step, boundary, memory/source | low | 2 | upgraded / thin adoption |
| reinforcement `/reinforcements/[id]` | review surface | thin sendability / reinforcement detail surface with operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source, governance | low | 2 | upgraded / thin adoption |
| sendability `/sendability/[id]` | review surface | thin sendability review surface with operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source, governance | low | 2 | upgraded / thin adoption |
| reinforcement variants `/reinforcement-variants/[id]` | review surface | thin reinforcement variants surface with operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source, governance | low | 2 | upgraded / thin adoption |

## Phase 3: Object / context surfaces

| module / route | category | current state | target state | method layers apply | risk level | rollout phase | final status |
|---|---|---|---|---|---|---|---|
| opportunities `/opportunities` | object/context surface | object-centric board with recommendations, blockers, commitments, next-step momentum, and connected-loop context | thin adoption | why-now, object/state, next-step, boundary, memory/source | medium | 3 | upgraded / thin adoption |
| meetings list `/meetings` | object/context surface | meeting-first list with loop summary and follow-through emphasis; intentionally kept as a lighter entry than meeting detail | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | accepted / thin adoption |
| contacts detail `/contacts/[id]` | object/context surface | object-rich contact page with relationship, meeting, commitment, blocker, recommendation, and connected-loop context | thin adoption | why-now, object/state, next-step, memory/source, boundary | medium | 3 | upgraded / thin adoption |
| companies detail `/companies/[id]` | object/context surface | account-intelligence page with momentum, blockers, commitments, company memory, and connected-loop context | thin adoption | why-now, object/state, next-step, memory/source, boundary | medium | 3 | upgraded / thin adoption |
| inbox list `/inbox` | object/context surface | operational inbox surface with reply pressure, object binding, thread upgrade framing, and connected-loop context | thin adoption | why-now, object/state, next-step, boundary, memory/source | medium | 3 | upgraded / thin adoption |
| inbox detail `/inbox/[id]` | object/context surface | thread-level detail routed through the thin review-request seam | thin adoption | why-now, next-step, boundary, memory/source, governance | low | 3 | upgraded / thin adoption |
| conversation detail `/conversations/[id]` | object/context surface | thin shared detail shell plus object-context operating summary for local conversation semantics | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| founder conversations `/founder-conversations/[id]` | object/context surface | thin founder-specific conversation detail | thin adoption | why-now, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| sales conversations `/sales-conversations/[id]` | object/context surface | thin sales conversation detail | thin adoption | why-now, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| delivery conversations `/delivery-conversations/[id]` | object/context surface | thin delivery conversation detail | thin adoption | why-now, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| proposals `/proposals/[id]` | object/context surface | decision-first proposal detail with thin operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| packages `/packages/[id]` | object/context surface | decision-first package detail with thin operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| offers `/offers/[id]` | object/context surface | customer-facing offer detail with thin operating summary and boundary framing | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| external proposals `/external-proposals/[id]` | object/context surface | external proposal detail with thin operating summary and boundary cues | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| package variants `/package-variants/[id]` | object/context surface | package-variant comparison surface with thin operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| package stage variants `/package-stage-variants/[id]` | object/context surface | stage-variant decision surface with thin operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| commercial strengthening `/commercial-strengthening/[id]` | object/context surface | commercial narrative strengthening detail with thin operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| external narratives `/external-narratives/[id]` | object/context surface | thin external narrative detail with thin operating summary | thin adoption | why-now, object/state, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |
| external narrative fallbacks `/external-narrative-fallbacks/[id]` | object/context surface | thin external narrative fallback detail | thin adoption | why-now, next-step, boundary, memory/source | low | 3 | upgraded / thin adoption |

## Phase 4: Support / admin surfaces

| module / route | category | current state | target state | method layers apply | risk level | rollout phase | final status |
|---|---|---|---|---|---|---|---|
| search `/search` | support/admin surface | utility search surface for jump-to-object navigation with explicit support-role note | support-only / non-wedge | why-now | low | 4 | accepted / support-only |
| settings `/settings` | support/admin surface | policy / connector / LLM config surface with explicit operational rationale and connected-loop cue | thin adoption | why-now, boundary, governance | low | 4 | upgraded / thin adoption |
| imports `/imports` | support/admin surface | CRM-first migration wizard with explicit operational framing and connected-loop cue | thin adoption | why-now, object/state, next-step, governance | low | 4 | upgraded / thin adoption |
| imports CRM `/imports/crm` | support/admin surface | connector-style migration subflow with thin ingress operating summary and connected-loop cue | thin adoption | why-now, object/state, next-step, governance | low | 4 | upgraded / thin adoption |
| imports conflicts `/imports/conflicts` | support/admin surface | conflict-resolution utility surface with explicit support-role note | support-only / non-wedge | why-now, governance | low | 4 | accepted / support-only |
| import job detail `/imports/jobs/[id]` | support/admin surface | import-result inspection surface with explicit support-role note | support-only / non-wedge | why-now, governance | low | 4 | accepted / support-only |
| analytics `/analytics` | support/admin surface | observability / usage board with explicit support-role note, not an operating wedge | support-only / non-wedge | why-now, readiness | low | 4 | accepted / support-only |
| reports `/reports` | support/admin surface | weekly review / planning surface with narrow operating guidance and connected-loop cue | thin adoption | why-now, next-step, readiness | low | 4 | upgraded / thin adoption |
| capture `/capture` | support/admin surface | capture utility and recording support surface with explicit support-role note | support-only / non-wedge | why-now | low | 4 | accepted / support-only |

## Whole-inventory decision

The current module inventory is now fully classified as:

- full wedge
- thin adoption
- support-only / non-wedge

No audited module is left unclassified in this matrix.
