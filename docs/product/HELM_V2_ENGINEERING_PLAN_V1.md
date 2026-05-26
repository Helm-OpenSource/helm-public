---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2 Engineering Plan v1

## Purpose

This document turns the Helm v2 PRD skeleton into an engineering plan.

The priority is:

- make the runtime explicit
- keep scope narrow
- prove one closed loop at a time

## Phase 1: foundation contracts

Land:

- v2 contract types
- layered memory helper
- artifact-first worker registry
- approval matrix
- event-flow catalog

Output:

- repo-level source of truth for memory / object / artifact / approval / event layers

## Phase 2: meeting-to-action foundation

Land:

- Meeting Analyst contract consumer
- meeting facts artifact bundle
- draft memory write path
- action pack review path
- audit trace viewer

Acceptance:

- `Meeting-to-Action Time < 5 min`
- no external send
- no official commitment write

## Phase 3: opportunity judgement layer

Land:

- opportunity shadow delta writer
- blocker / next-step schema
- manager attention flags
- timeline stitching

Acceptance:

- opportunity shadow suggestions stay evidence-backed
- shadow and official remain physically distinct

## Phase 4: draft-only action layer

Land:

- Comms & Scheduler
- Risk & Promise Guard
- trust-boundary scan
- draft-only email and calendar outputs

Acceptance:

- external send remains blocked
- promise safety remains explicit
- drafts are reviewable artifacts

## Phase 5: handoff and expression layer

Land:

- Proposal Composer
- Handoff Manager
- customer/internal/exec briefings
- handoff pack + delivery checklist

Acceptance:

- handoff pack is structured and reviewable
- deal-to-delivery context no longer depends on ad hoc retell

## Phase 6: human action execution path

Land:

- manual execution surface
- execution proof / acknowledgement
- audit / summary / checkpoint write-back
- approval / execution boundary consistency

Acceptance:

- approved draft still does not mean sent
- approved shadow still does not mean official CRM updated
- human executed -> proof recorded -> summary updated stays fully traceable

## Phase 7: guarded official system integration

Land:

- official write intent
- explicit approval before write attempt
- acknowledgment / failure capture
- reconciliation stub

Acceptance:

- default auto-write remains blocked
- approved write intent still does not mean official write success
- acknowledged success becomes the only allowed success claim

## Phase 8: richer connector ingestion and retrieval policy

Land:

- richer connector ingestion contract
- trust / promotion boundary logic
- retrieval policy runtime
- memory / policy / object loading strategy
- ingestion / retrieval trace surface

Acceptance:

- untrusted input cannot silently promote into long-term memory
- stale memory stays suppressible and explainable
- runtime loading remains selective and auditable

## Phase 9: controlled pilot

Run:

- one sales team
- 5-10 live opportunities
- at least one real handoff
- A3 / A4 still manual-confirm only

Acceptance:

- follow-up latency down
- manager review time down
- action pack adoption up
- commitment accidents remain zero

## Eval harness requirements

Helm v2 should not ship higher-tier actions without:

1. meeting extraction eval
2. opportunity judgement eval
3. promise safety eval
4. memory retrieval eval
5. draft usefulness eval
6. recovery eval

## Current sprint status

Current main has now completed Sprint 1-10 narrow runtime layers.
Current main has now completed Sprint 1-9 narrow runtime layers.
Current main has now completed Sprint 1-8 narrow runtime layers.

Already complete after Baseline Freeze 1-8:

- PRD skeleton
- event/API package
- data model design
- code contract layer
- persisted runtime tables
- real Meeting Analyst runtime
- real draft-only comms runtime
- real Opportunity Judge runtime
- human action execution path
- guarded official system integration path
- limited auto path for a narrow official-write whitelist
- richer connector ingestion contract
- retrieval policy runtime + trace surface
- baseline freeze 1-8
- richer official system coverage for a still-narrow official whitelist

Still next-layer after Baseline Freeze 1-8:

- live connector-backed ingestion breadth
- live connector-backed execution evidence
- real connector-backed official acknowledgments
- richer official action eligibility beyond the current narrow limited auto whitelist
- richer external receipt / reconciliation handling beyond current stub coverage
- deeper retrieval invalidation and learned-pattern policy
- richer handoff runtime
- broader eval goldens and pilot evidence

Already complete after Baseline Freeze 1-9:

- PRD skeleton
- event/API package
- data model design
- code contract layer
- persisted runtime tables
- real Meeting Analyst runtime
- real draft-only comms runtime
- real Opportunity Judge runtime
- human action execution path
- guarded official system integration path
- limited auto path for a narrow official-write whitelist
- richer connector ingestion contract
- retrieval policy runtime + trace surface
- richer official system coverage for a still-narrow official whitelist
- baseline freeze 1-9

Still next-layer after Baseline Freeze 1-9:

- live connector-backed ingestion breadth
- live connector-backed execution evidence
- live adapter receipt / reconciliation mapping
- broader official action coverage beyond the current narrow richer whitelist
- richer official payload diff / compare surfaces
- deeper retrieval invalidation and learned-pattern policy
- richer handoff runtime
- broader eval goldens and pilot evidence

Already complete after Sprint 10 follow-through layer:

- official follow-through contract
- exception / reconciliation state machine
- follow-through / escalation / resolution runtime
- operator / manager follow-through surface
- resolution write-back to audit / memory / object summary / role handoff

Already complete after Baseline Freeze 1-10:

- PRD skeleton
- event/API package
- data model design
- code contract layer
- persisted runtime tables
- real Meeting Analyst runtime
- real draft-only comms runtime
- real Opportunity Judge runtime
- human action execution path
- guarded official system integration path
- limited auto path for a narrow official-write whitelist
- richer connector ingestion contract
- retrieval policy runtime + trace surface
- richer official system coverage for a still-narrow official whitelist
- official follow-through contract
- exception / reconciliation state machine
- follow-through / escalation / resolution runtime
- operator / manager follow-through surface
- resolution write-back to audit / memory / object summary / role handoff
- baseline freeze 1-10

Still next-layer after Baseline Freeze 1-10:

- live connector-backed ingestion breadth
- live connector-backed execution evidence
- live adapter receipt / reconciliation mapping
- broader official action coverage beyond the current narrow richer whitelist
- multi-step exception analytics beyond current follow-through surface
- deeper retrieval invalidation and learned-pattern policy
- richer handoff runtime
- broader eval goldens and pilot evidence

Still next-layer after Sprint 10:

- live connector-backed ingestion breadth
- live connector-backed execution evidence
- live adapter receipt / reconciliation mapping
- broader official action coverage beyond the current narrow richer whitelist
- multi-step exception analytics beyond current follow-through surface
- deeper retrieval invalidation and learned-pattern policy
- richer handoff runtime
- broader eval goldens and pilot evidence

Already complete after Helm v2.1 runtime hardening:

- runtime session / persisted payload substrate
- token budget governor with pruned-handle trace
- session notebook / checkpoint trace
- verification report + memory candidate / promotion ledger
- truth conflict visibility
- world model snapshot + problem space + DRI + edge brief + handoff packet + initiative run
- composition failure telemetry
- coordination metrics daily + artifact confirm route
- `app/api/helm-v2/runtime/*` namespace
- meeting detail + workspace operator runtime hardening surface, including signal / world-model / artifact lineage / capability trace, handoff / initiative / coordination telemetry, and consolidation queue / pause visibility
- v2.1 phase eval harness

## Preserved boundaries

This engineering plan still preserves:

- no send authority
- no default auto-write
- no broad auto-write
- no workflow control
- no automatic contract or quote execution
- no generalized team-mode default
- no route-owner rewrite
- no shell thinning
