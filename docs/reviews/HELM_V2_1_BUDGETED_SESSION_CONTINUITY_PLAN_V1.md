---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Budgeted Session Continuity Plan v1

## 1. Current Freeze Truth

This PR uses the current v2.1 freeze truth as its status source:

- [HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md](../product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md)
- [HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md](HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md)
- [HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md](../product/HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md)
- [HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md](HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md)

Current freeze truth already proves:

- additive runtime substrate
- persisted payload handles
- runtime sessions / notebooks / checkpoints
- context prune and checkpoint resume entry points
- meeting runtime and operator surfaces
- verified coordination as one acceptance-grade slice

Current freeze truth also explicitly keeps these items in `已成形但仍需下一层`:

- truth scoring usefulness
- coordination telemetry usefulness
- consolidation maturity

This PR must improve long-context continuity usefulness in one narrow meeting-driven slice without claiming full memory-cascade or compaction maturity.

## 2. What This PR Is Proving

This PR proves one acceptance-grade vertical slice:

`meeting ingest -> persisted payload handles -> budget posture -> notebook state -> checkpoint/save/replay/resume -> prune/compact trace`

The proof target is not “more runtime objects exist.”

The proof target is:

1. bulky context is externalized instead of silently bloating active context
2. budget posture is explicit, operator-visible, and legible as `safe / watch / prune / compact`
3. notebook carries operational state instead of acting like transcript recap
4. checkpoint / replay / resume preserves critical session state
5. prune decisions stay traceable and protect critical human / policy facts

## 3. Exact Continuity Loop

The loop this PR hardens is:

1. `meeting.ended` creates runtime session and persisted payload handles for transcript, email-thread-like, and doc-like context
2. budget governor decides what remains active versus what is replaced by handle + preview + summary
3. session notebook records objective, active objects, confirmed facts, blockers, decisions, next actions, open questions, evidence refs, and review posture
4. checkpoint stores replayable continuity state for the current runtime slice
5. resume restores runtime posture from checkpoint and surfaces fidelity
6. prune / compact actions remain review-visible, explain what changed, and preserve protected facts
7. if fidelity or safety is weak:
   - resume posture remains visibly weak
   - prune safety fails eval
   - operator surface keeps the slice diagnostic rather than silently confident

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
- no world-model expansion
- no workflow/control-plane expansion

## 5. Phase Plan

### Phase 1: Persisted Payload + Budget Posture

Goal:
- prove that large meeting-driven context is externalized and that budget posture is visible

Deliver:
- handle + preview + summary proveout for large runtime context
- visible `safe / watch / prune / compact` posture
- no silent raw-context sprawl

### Phase 2: Notebook And Checkpoint / Resume

Goal:
- make notebook and checkpoint / replay / resume operationally useful

Deliver:
- notebook carries required operating state
- checkpoint snapshot contains replay-critical fields
- resume surfaces fidelity and fails cleanly when fidelity is weak

### Phase 3: Prune / Compact Readability

Goal:
- make prune / compact decisions safe and readable

Deliver:
- before / after trace
- savings signal
- explicit protection for policy boundary, human decision, blocker, owner, due date
- visible reason for prune / compact trigger

### Phase 4: Evals And Acceptance Package

Goal:
- freeze the slice and prove it with narrow evals

Deliver:
- eval coverage for payload externalization, notebook state, checkpoint fidelity, prune safety, budget posture visibility
- baseline doc
- acceptance report
- docs index and truthfulness sync

## 6. Eval Contract

At minimum this PR must cover:

1. large payloads are externalized instead of remaining default active context
2. notebook carries required operational state
3. checkpoint / replay / resume preserves critical continuity fields
4. microprune preserves blockers / owners / due dates / policy boundaries
5. budget posture transitions stay visible and correct for the tested cases

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
- public execution surfaces
- auto-send
- broad auto-write
- richer observability scorecards beyond this slice

## 8. Acceptance Bar

This slice is acceptance-grade only if:

1. one meeting-driven runtime chain can externalize large context and stay within budget with visible posture
2. notebook and checkpoint / resume preserve operational continuity
3. prune / compact trace is safe, visible, and protects critical human/policy facts
4. docs, evals, and validation are all green
