---
status: active
owner: helm-core
created: 2026-03-29
review_after: 2026-06-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Shared Agent Operational Surface Baseline v1

## Purpose

This document is the customer-success-first baseline for the shared agent queue/card display/composition layer.

It freezes the current operational shared layer as a render-only, slot-based helper seam proven on customer success queue/cards only.

This is not a repo-wide operational semantics baseline.
This is not a queue system-of-record baseline.
This is not a workflow, prioritization, assignment, or SLA baseline.

## Code Source

- `components/shared/agent-queue-card.tsx`

## Proven Scope

- customer success queue/cards are the first and only proven operational adoption so far
- no second operational adoption is claimed in this baseline
- this is a shared operational display layer, not a repo-wide operational semantics layer

## What Is Shared In v1

The following queue/card display/composition helpers are frozen as the shared operational layer in this round:

- `AgentQueueCardView`
- `AgentQueueCardHeader`
- `AgentQueueCardStatusChips`
- `AgentQueueCardResurfaceSummary`
- `AgentQueueCardProgressSummary`
- `AgentQueueCardCopyBlock`
- `AgentQueueCardMetaGrid`

These helpers stay render-only and slot-based.
They do not reinterpret domain meaning and they do not create a universal queue renderer.

## What Is Intentionally Not Shared

The following remain adapter-local / domain-local unless a later revision proves that the exact same semantics belong on more than one operational surface:

- customer success stage meaning
- issue / escalation meanings
- `processAdvisory` categories
- internal action classes
- external draft classes
- review outcome / send handoff / manual send recorded
- post-send outcome classes
- local blocked / waiting phrasing
- local footer actions
- local evidence / decision / boundary wording that does not map cleanly

These may plug into shared slots, but they do not become repo-wide operational semantics in this document.

## Render-only Boundary

The shared operational layer must keep these boundaries explicit:

- this layer is display/composition only
- it does not create a canonical shared agent root object
- it does not create a queue system of record
- it does not create workflow semantics
- it does not create prioritization, assignment, or SLA semantics
- it does not create send authority
- it does not create commitment authority

If a local operational card would overstate certainty, it must stay downgraded into boundary, prerequisite, dependency, risk, review, or non-commitment framing.

## Required vs Optional Slot Usage

Operational surfaces may adopt only the subset that maps cleanly, for example:

- header
- chips
- resurfacing summary
- thin progress summary
- local copy block
- local meta grid
- local footer

This document does not require every queue/card surface to adopt every slot.
Customer success queue/cards remain the only proven operational adoption in this round.
