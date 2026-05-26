---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Verified Coordination Plan v1

## 1. Current Freeze Truth

This PR uses the current v2.1 freeze truth as its status source:

- [HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md](../product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md)
- [HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md](HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md)

Current freeze truth already proves:

- additive runtime substrate
- meeting-driven v2.1 trace on the main loop
- verification / truth conflict / memory candidate / promotion ledgers
- world model / problem space / DRI / edge brief substrate
- operator surfaces on meeting detail and `/operating`
- compatibility back to `RuntimeEvent`

Current freeze truth also explicitly keeps these items in `已成形但仍需下一层`:

- verification usefulness
- truth scoring usefulness
- coordination telemetry usefulness

This PR must improve usefulness in one narrow meeting-driven verified coordination slice without overclaiming broader v2.1 maturity.

## 2. What This PR Is Proving

This PR proves one acceptance-grade vertical slice:

`meeting signal -> verification -> memory candidate disposition -> promoted truth -> problem space -> DRI -> edge brief`

The proof target is not “more substrate exists.”

The proof target is:

1. weak or conflicted inputs are not silently promoted
2. promoted truth is source-grounded and operator-visible
3. problem spaces only form from confirmed/promoted runtime truth
4. DRI assignment is explicit and traceable
5. IC / DRI / player-coach briefs remain source-consistent
6. blocked / deferred / composition-failure states remain legible

## 3. Exact Verified Loop

The loop this PR hardens is:

1. `meeting.ended` creates runtime session and persisted payload handles
2. Meeting Analyst emits facts, risk flags, action pack, and draft memory
3. Verification pass evaluates evidence sufficiency, promise risk, and conflict posture
4. Every memory candidate lands in exactly one disposition:
   - promoted
   - rejected
   - deferred
5. Only verified / confirmed truth can feed problem-space creation in this slice
6. Problem space produces explicit DRI assignment and source-consistent edge briefs
7. If truth is weak or conflict remains unresolved:
   - promotion stays blocked / deferred
   - problem-space/brief generation stays blocked / deferred
   - composition failure remains operator-visible

## 4. Preserved Boundaries

This PR keeps all current-main boundaries unchanged:

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite
- no workflow engine expansion
- no team mode / multi-agent runtime expansion

## 5. Phase Plan

### Phase 1: Verified Promotion Path

Goal:
- make one real meeting-driven memory promotion loop acceptance-grade

Deliver:
- explicit promote / reject / defer posture for every memory candidate in this slice
- visible source class / grounding / conflict posture
- no silent promotion from inferred or conflicted inputs

### Phase 2: Problem-Space / DRI / Brief Proveout

Goal:
- prove that confirmed/promoted truth can become problem space, DRI, and brief

Deliver:
- confirmed-only problem-space formation
- explicit DRI trace
- source-consistent IC / DRI / player-coach briefs
- defer / composition-failure posture when truth is too weak

### Phase 3: Operator Surface Readability

Goal:
- make the verified coordination loop explainable at one glance

Deliver:
- why promoted / rejected / deferred
- why blocked / conflicted
- why problem space exists
- why DRI was assigned
- why brief exists or was withheld
- why failure was classified

### Phase 4: Evals And Acceptance Package

Goal:
- freeze the slice and prove it with narrow evals

Deliver:
- eval coverage for verified promotion / conflict visibility / confirmed-only problem spaces / brief consistency / failure classification
- baseline doc
- acceptance report
- index and truthfulness sync

## 6. Eval Contract

At minimum this PR must cover:

1. weak or conflicted facts are deferred or rejected instead of silently promoted
2. truth conflict stays visible and auditable
3. problem space only forms from confirmed/promoted truth in this slice
4. IC / DRI / player-coach brief views stay source-consistent
5. composition failure is visible when the safe chain cannot complete

Validation cadence:

- after every phase:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run self-check`
  - `npm run check:boundaries`
- after any real behavior/view change:
  - `npm run build`
  - `npm run test`
- final closeout:
  - `npm run db:reset`
  - `npm run self-check`
  - `npm run check:boundaries`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run e2e`
  - `npm run quality:regression`

## 7. Explicitly Deferred

This PR does not implement:

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public-facing execution surfaces
- auto-send
- broad auto-write
- broader observability scorecards beyond this slice

## 8. Acceptance Bar

This slice is acceptance-grade only if:

1. one meeting-driven runtime chain can go from verification to promotion to problem space to DRI to brief
2. every important state transition is source-grounded and operator-visible
3. weak/conflicted inputs are deferred or blocked instead of elevated
4. composition failure is legible when the chain cannot safely complete
5. docs, evals, and validation are all green
