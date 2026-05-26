---
status: active
owner: helm-core
created: 2026-03-29
review_after: 2026-06-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Shared Agent Pilot Runbook v1

## Purpose

This runbook is for executing manual pilot sessions on the currently proven shared agent surfaces.

It is a manual pilot execution guide.
It does not add product behavior, telemetry, workflow control, or send authority.

## Surfaces In Scope

- customer success detail
- review-request detail
- success-check detail
- expansion-review detail
- customer success queue/cards

## Roles In A Pilot Session

At minimum, a pilot session should include:

- pilot lead / observer
- primary user
- collaborator / teammate observer if available

One person may cover more than one role in a smaller session, but the runbook should still record which perspective was actually present.

## Session Structure

Suggested flow:

1. pre-session snapshot run
2. detail-surface walkthrough
3. operational queue/card walkthrough
4. collaborator-reading pass
5. governance / non-commitment pass
6. debrief and outcome summary

## Core Pilot Questions

At minimum, ask:

- can the user tell what changed, what Helm prepared, and what matters now?
- can the collaborator tell who is watching / pushing and what the current boundary / review posture is?
- do governance and non-commitment cues remain explicit?
- do thin adoptions remain visibly thinner than customer success?
- does the customer success operational surface feel like Helm is helping work move forward?

## Non-goals

This runbook does not claim:

- measured business impact from the runbook alone
- telemetry-driven attribution
- send-authority validation
- workflow-control validation

## Required Artifacts For Each Pilot Run

Each pilot run must record:

- timestamp
- pilot participants
- snapshot output attached or copied
- surfaces actually reviewed
- manual observations
- pass / fail or go / no-go notes
- follow-up issues / risks

## Pre-session Snapshot

Run the current read-only snapshot before the walkthrough:

```bash
npx tsx scripts/shared-agent-outcome-snapshot.ts
```

Attach the output or copy the relevant summary into the observation record.
Do not treat the snapshot alone as a runtime gate; pair it with the latest route smoke or e2e result.

## Session Notes

- If a question can be answered from current cue coverage, record it as grounded measurable coverage.
- If a question depends on human interpretation, record it as manual observation only.
- If a question cannot be answered from the current system, record it as not measurable yet.
