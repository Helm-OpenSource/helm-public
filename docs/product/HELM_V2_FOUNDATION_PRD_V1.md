---
status: active
owner: helm-core
created: 2026-04-02
review_after: 2026-07-01
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2 Foundation PRD v1

## Product definition

Helm v2 is:

**an object-centered business operating runtime with layered memory, artifact-first workers, and policy-guarded execution boundaries**

It is not:

- a generic chat product
- a generic CRM replacement
- a generalized autonomous agent platform
- an automatic commitment engine

## Product goal

The first goal of Helm v2 is **not** to automate more things.
The first goal is to turn post-meeting business work into:

- auditable
- reviewable
- traceable
- handoff-ready

execution bundles.

## Strategic position

Helm v2 should remain true to current main:

- meeting is the strongest first wedge
- the category is broader than a meeting tool
- the value is judgement quality and collaboration quality
- AI workers and humans coordinate around one goal
- process becomes reusable operating memory
- key actions stay inside formal review and controllable governance

## Core user roles

- frontline sales / AE
- sales manager / business operator
- presales / solution role
- CSM / delivery handoff role

## First-wave jobs to be done

1. Within 5 minutes after a meeting, convert notes into structured facts, risks, and next actions.
2. Generate opportunity-stage suggestions, blockers, and next-step proposals.
3. Generate three artifact classes:
   - customer follow-up draft
   - internal collaboration brief
   - management brief
4. Generate a handoff pack before deal close or delivery transition.
5. Keep external commitment and external send behind explicit human review.
6. After approved drafts or approved shadow recommendations, guide the human next step and record execution proof without opening send authority.
7. After approved shadow recommendations or approved execution proof, create a guarded official write intent that still requires explicit approval and system acknowledgment before Helm can claim official success.
8. For a tiny whitelist of low-risk official actions, allow a limited auto path only after explicit approval, strong acknowledgment, and always-available manual override.
9. Expand richer official system coverage only inside the same hard boundaries: explicit approval, strong receipt handling, manual fallback always available, and no broad auto-write.
10. After official write outcomes arrive, create explicit follow-through / exception / reconciliation handling so Helm can keep processing success, failure, stale, partial, and unknown results without confusing resolution with official success.

## MVP scope

### Must do

1. Workspace / object graph
2. Memory kernel
3. Meeting Analyst
4. Opportunity Judge
5. Comms & Scheduler in draft-only mode
6. Risk & Promise Guard
7. audit + approval service
8. eval harness
9. human action execution path
10. guarded official system integration path
11. richer connector ingestion + retrieval policy
12. limited auto path for narrow whitelisted official actions
13. richer official system coverage for narrow whitelisted official actions, richer receipt handling, and stronger manual fallback / override
14. official follow-through / exception handling after guarded and limited-auto official outcomes

### Deliberately not in first wave

1. automatic quote execution
2. automatic contract edits
3. default team-mode runtime
4. long-running cross-org autonomy
5. broad CRM auto-writeback
6. broad official auto-write beyond the narrow limited auto whitelist

## Non-goals

- no万能聊天框
- no全域自治代理
- no自动承诺引擎
- no CRM / ERP / PM 替代平台

## North-star metrics

- Meeting-to-Action Time
- Manager Trust Rate
- Commitment Safety
- Follow-up Latency
- Memory Reuse Rate

## First principles

1. Objects come before chat.
2. Facts, inferences, rules, and handoffs must not collapse into one pool.
3. Reusable output should become an artifact, not hidden chat history.
4. Shadow mode should be the default before official writeback.
5. Team mode should be reserved for genuinely complex, high-value review scenarios.

## Runtime principles

### 1. Layered memory

Helm v2 should keep five memory layers explicit:

- Policy Memory
- Object Memory
- Learned Memory
- Handoff / Checkpoint Memory
- Session Scratch

### 1.5 Selective retrieval policy

Helm v2 should keep retrieval explicit and selective:

- `always_on`
- `stage_triggered`
- `event_triggered`
- `on_demand`

This layer exists to keep runtime explainable and auditable.
It is not permission to dump all history into context.

### 2. Object-centered runtime

The runtime should center on:

- workspace
- customer
- opportunity
- meeting
- proposal
- quote
- approval
- task
- handoff

### 3. Artifact-first workers

Workers should produce reusable artifacts such as:

- `meeting_facts.json`
- `action_pack.md`
- `opportunity_delta.json`
- `customer_followup_draft.md`
- `email_draft.eml`
- `human_action_execution_bundle.json`
- `official_write_intent.json`
- `handoff_pack.md`

### 4. Policy-guarded action tiers

Recommendation and commitment must stay physically separated.

Helm v2 should preserve:

- A0 automatic analysis
- A1 internal reversible writes
- A2 human-confirmed drafts
- A3 strong confirmation for official writes or risky external actions
- A4 multi-approval for price / contract / delivery promise moves

## First 90-day build shape

### Days 1-15

Freeze:

- object schema
- memory schema
- event schema
- approval policy
- artifact contract
- eval set
- audit log schema

### Days 16-30

Run:

- `meeting -> action pack`

### Days 31-45

Run:

- `action pack -> opportunity judgement`

### Days 46-60

Run:

- draft-only action layer

### Days 61-75

Run:

- proposal / briefing / handoff layer

### Days 76-90

Run:

- controlled pilot with strong review boundaries

## Preserved boundaries

Helm v2 still preserves:

- no send authority by default
- no default auto-write
- no workflow control
- no commitment by implication
- no silent promotion from raw external input into long-term memory
- no full-history context stuffing
- no default agent-team orchestration mode

## Definition of success for this foundation sprint

This sprint succeeds if Helm v2 becomes explicit enough that future implementation work no longer depends on informal agreement about:

- memory layers
- objects
- artifacts
- event flow
- approval tiers
- audit expectations
