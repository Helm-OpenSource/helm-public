---
status: active
owner: helm-core
created: 2026-03-29
review_after: 2026-06-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Shared Agent Pilot Readiness v1

## Purpose

This document defines the current pilot-readiness standard for the shared agent layer after the current detail and operational freeze state.

It is a read-only pilot baseline for manual evaluation readiness.
It does not add product behavior, workflow semantics, or telemetry infrastructure.

## Surfaces Currently In Scope

- customer success detail = richest proving ground
- review-request detail = first thin adjacent adoption
- success-check detail = second thin adjacent adoption
- expansion-review detail = third thin adjacent adoption
- customer success queue/cards = first operational proving ground

These are the surfaces that should enter manual evaluation only after the latest runtime smoke stays green.
Code and contract cue coverage alone does not prove route health, and it does not imply parity across the surfaces.

## Pilot Questions To Answer

At minimum, manual pilot evaluation should answer:

- can a user tell what changed, what Helm prepared, and what decision or action matters now?
- can a collaborator tell who is watching or pushing and what the current boundary or review posture is?
- do governance and non-commitment cues remain explicit?
- do thin adoptions remain visibly thinner than customer success?
- does the operational proving ground still feel useful without turning into workflow control?

## What Is Already Measurable From Existing Signals

The current shared agent system can already be measured in a narrow, read-only way from existing code and contract signals.

The measurable categories are:

- authority cue presence
- attention cue presence
- `since last seen` / `resurfaced because` cue presence
- progress trace availability
- governance / policy / review posture cue presence
- internal action approval / execution cue presence where already supported
- prepared external draft cue presence where already supported
- review outcome / send handoff / manual send recording cue presence where already supported
- post-send outcome cue presence where already supported
- operational queue/card shared cue presence where already supported

The current snapshot must stay grounded in already-existing signals only.
If a cue is not already visible in the current system, it must be reported as unavailable or not yet measurable rather than inferred.

## What Is Not Yet Measurable Without New Instrumentation

The following are explicitly not measurable yet from the current shared agent system without adding new tracking or persistence:

- actual user time saved
- actual collaborator response lift
- exact click-through on prepared actions
- exact review completion or revision rates across pilots
- exact read/open rates for shared agent surfaces
- exact external reply or send conversion rates beyond the currently visible manual handoff / manual send record cues

These gaps must remain explicit.
This pilot baseline does not authorize inventing a telemetry platform in order to hide them.

## Governance / Boundary Rules

The shared agent pilot baseline must keep these rules explicit:

- no canonical shared agent root object
- no workflow-engine semantics
- no queue system-of-record semantics
- no send authority
- no commitment authority
- recommendation does not equal commitment
- handoff does not equal commitment
- review-before-send does not mean safe-to-send by default

If a pilot readout cannot be supported by the current signals, it must be downgraded into “not measurable yet”.

## Snapshot Source

The current read-only snapshot entrypoint is:

- `scripts/shared-agent-outcome-snapshot.ts`

It summarizes current code and contract cue coverage only.
It must be paired with the latest route smoke or e2e result before any surface is called pilot-ready.
