---
status: archived
owner: helm-core
created: 2026-03-29
review_after: 2026-09-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Shared Agent Semantics Acceptance Report

## Purpose

This report freezes the shared agent primitive layer after it was proven across one rich proving ground plus three thin adjacent adoptions.

It records what was generalized, what was intentionally left local, which adjacent surfaces became the first three thin adoptions, and which boundaries must remain explicit.

The frozen shared layer remains presentation/model-layer only.
It is not a durable shared agent state system.
It should not be conflated with the customer-success-first shared operational queue/card layer.

## Files / Surfaces Touched

Shared layer:

- `lib/presentation/agent-primitives.ts`
- `features/role-conversation-variants/agent-surface-detail-view.tsx`
- `features/role-conversation-variants/detail-shell.tsx`
- `components/shared/narrative-components.tsx`

Customer success proving ground:

- `features/customer-success-handoff/detail-model.ts`
- `features/customer-success-handoff/queue-model.ts`
- `features/customer-success-handoff/internal-actions.ts`

First adjacent adoption:

- `features/inbox-followup-review-request/detail-model.ts`
- `features/inbox-followup-review-request/detail-view.tsx`
- `features/role-conversation-variants/detail-shell.tsx`

Second adjacent adoption:

- `app/(workspace)/success-checks/[id]/page.tsx`
- `features/success-check/detail-model.ts`
- `features/success-check/detail-view.tsx`

Third adjacent adoption:

- `app/(workspace)/expansion-reviews/[id]/page.tsx`
- `features/expansion-review/detail-model.ts`
- `features/expansion-review/detail-view.tsx`

Regression / guard alignment:

- `lib/presentation/customer-success-handoff-v1_1.test.ts`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## Adoption Ladder

- customer success = richest proving ground
- review-request detail = first thin adjacent adoption
- success-check detail = second thin adjacent adoption
- expansion-review detail = third thin adjacent adoption

## Generalized vs Surface-specific Semantics

Generalized in this round:

- `AgentAuthorityState`
- `AgentAttentionState`
- `AgentPolicyCue`
- `AgentTag`
- conservative formatting helpers
- `AgentSurfaceSections`
- shared display/composition helpers for:
  - identity/header composition
  - shared status chips
  - resurfacing section
  - thin progress trace

Intentionally left surface-specific:

- customer success stage model
- issue / escalation semantics
- `processAdvisory` categories
- internal action classes
- external draft classes
- review outcome / send handoff / manual send recorded
- post-send outcome classes
- local judgement / review posture copy that does not map cleanly across surfaces

## Detail vs Operational Shared Layer

- the shared detail layer is proven across customer success plus three thin adjacent detail adoptions
- the shared operational queue/card layer is currently proven on customer success queue/cards only
- the shared detail layer and the shared operational layer should not be conflated
- this report covers the shared detail/primitive baseline, not a repo-wide operational semantics baseline

## Adjacent Adoption Rationale

The first adjacent adoption is review-request detail.

This was chosen because:

- it already shared the same judgement-first detail shell
- it could consume a thin subset of shared primitives without inheriting customer-success stage semantics
- it offered a real adjacent proof point without inheriting customer-success stage / draft / send semantics

The second adjacent adoption is success-check detail.

This was chosen because:

- success-check was already an adjacent judgement-first surface in the customer success chain
- it now uses a success-check-specific thin adapter instead of counting raw customer-success model reuse as adoption proof
- it can consume shared provenance / attention / policy / resurfacing cues while remaining visibly thinner than customer success

The third adjacent adoption is expansion-review detail.

This was chosen because:

- expansion-review was already a genuinely adjacent judgement-first commercial review surface in the same chain
- it can now use an expansion-review-specific thin adapter instead of inheriting the richer customer-success detail layer
- it can consume shared provenance / attention / policy / resurfacing cues while staying commercially conservative and thinner than customer success

## Preserved Boundaries

- no canonical customer success root object
- no canonical shared agent root object
- no stage changes
- no workflow-engine behavior
- no process-control semantics
- no owner reassignment or approval-chain mutation
- no SLA / assignment / prioritization engine behavior
- no permissions / IAM expansion
- no send authority
- no auto-send
- no commitment authority
- no customer-facing execution by Helm

## Manual Smoke Checklist

1. Customer success detail still reads as the richest full agent layer.
2. Review-request detail still reads as a thinner adjacent adoption.
3. Success-check detail still reads as a second thin adjacent adoption rather than a customer success clone.
4. Expansion-review detail now reads as a third thin adjacent adoption rather than a customer success clone.
5. No customer-success stage, draft, send, or post-send semantics leaked into review-request detail, success-check detail, or expansion-review detail.
6. Shared provenance / attention / policy cues still read conservatively and non-commitment-first.
7. Shared display helpers still read consistent across the four surfaces without collapsing them into customer success parity.

## Deferred Follow-ups

- shared renderer helpers only if multiple surfaces need the same card/tag composition
- any broader repo-wide agent baseline only after at least one more clean adoption proves it
- any fourth adjacent adoption only if it maps as cleanly as review-request, success-check, and expansion-review
- any durable shared agent state system remains explicitly out of scope until the repo proves a need beyond the current presentation/model-layer baseline

## Remaining Risks

- the shared layer is still a thin presentation/model baseline, not a repo-wide persistent agent state system
- review-request detail remains intentionally partial adoption, so future work must resist forcing parity with customer success
- success-check detail remains intentionally thinner than customer success, so future work must resist adding customer-success-only stage / draft / post-send semantics there
- expansion-review detail remains intentionally thinner than customer success, so future work must resist adding customer-success-only stage / draft / send / post-send semantics there
- the shared display/composition layer is intentionally slot-based, so future work must resist turning it into a mega renderer that owns local judgement meaning
- if later surfaces reuse the shared layer too aggressively, they could still blur into customer-success-specific semantics unless the current regression guards remain in place
