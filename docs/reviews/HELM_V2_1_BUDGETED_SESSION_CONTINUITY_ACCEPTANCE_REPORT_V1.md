---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.1 Budgeted Session Continuity Acceptance Report v1

更新时间：2026-04-03
状态：Accepted
范围：PR20 narrow v2.1 continuity slice proveout

## 1. 本次 PR 证明了什么

本次 PR 不是继续扩张 Helm v2.1 runtime hardening 的范围，而是把已经存在的 persisted payload / notebook / checkpoint / prune substrate 收成一条 `acceptance-grade budgeted session continuity loop`：

`meeting ingest -> payload externalization -> budget posture -> notebook state -> checkpoint/save/replay/resume -> prune / compact trace`

重点不是再证明对象存在，而是证明这条 continuity loop 已经足够可用、可解释、可审计。

## 2. Phase 完成情况

### Phase 0

- 已创建 `HELM_V2_1_BUDGETED_SESSION_CONTINUITY_PLAN_V1.md`
- 已明确 freeze truth、phase plan、eval contract 和 deferred items

### Phase 1

- transcript、email-thread-like 和 doc-like adjacent context 现在都会进入 persisted payload handles
- budget posture 已显式落到 `SAFE / WATCH / PRUNE / COMPACT`
- bulky raw context 已不再是默认 active-context path

### Phase 2

- notebook 现在按 operational state 组织，而不是 transcript recap
- checkpoint snapshot 现在保存 continuity state
- resume 会显式返回 replay summary、fidelity score、preserved / missing fields

### Phase 3

- prune / compact trace 现在可见 before / after、tokens saved、removed payloads、replacement summary、protected items
- meeting runtime card 与 workspace operator panel 都能解释为什么当前在 safe / watch / prune / compact posture

### Phase 4

- budgeted session continuity eval harness 已补齐
- baseline / acceptance docs 已冻结
- docs index、README、self-check、boundary wording 已同步

## 3. 本次 landed 的核心改动

- `lib/helm-v2/runtime-upgrade.ts`
  - adjacent payload externalization
  - budget posture derivation
  - notebook operational state
  - checkpoint continuity snapshot
  - resume fidelity comparison
  - prune trace readability
  - workspace continuity queue
- `features/meetings/meeting-v2-runtime-card.tsx`
  - continuity surface、payload externalization、checkpoint fidelity、prune trace
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
  - budgeted continuity queue、prune / compact counts
- `lib/helm-v2/runtime-upgrade.test.ts`
  - budget posture / notebook / prune / replay helper coverage
- `lib/helm-v2/eval-harness.ts`
  - continuity acceptance harness
- `lib/helm-v2/eval-harness.test.ts`
  - continuity harness assertions
- `scripts/helm-v2-1-budgeted-session-continuity-evals.ts`
  - narrow acceptance eval entry
- `evals/helm-v2/budgeted-session-continuity-v2_1-golden-samples.json`
  - safe / watch / prune / compact goldens

## 4. 保留边界

本次 PR 没有放宽以下边界：

- no send authority
- no workflow control
- no second app tree
- no shell thinning
- no route/query rewrite
- no broader platform expansion
- no overclaim of full orchestration
- no overclaim of full compaction maturity
- no auto-send
- no broad auto-write

## 5. 明确保留的 deferred items

以下内容继续保持 deferred，不属于本次 PR：

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public-facing execution surfaces
- richer observability scorecards beyond this slice

## 6. Validation 与 eval 结果

### Per-phase validation

- Phase 1:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run self-check`
  - `npm run check:boundaries`
  - `npm run build`
  - `npm run test`
- Phase 2:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run self-check`
  - `npm run check:boundaries`
  - `npm run build`
  - `npm run test`
- Phase 3:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run self-check`
  - `npm run check:boundaries`
  - `npm run build`
  - `npm run test`

### Acceptance eval contract

- `eval:helm-v2-1-budgeted-session-continuity` 现在验证：
  - large payloads externalize instead of bloating active context
  - notebook carries the required operational state
  - checkpoint / replay / resume preserves critical state
  - microprune preserves blockers / owners / due dates / policy boundaries
  - budget posture transitions stay visible and correct

## 7. Acceptance 结论

结论：这条 `Helm v2.1 budgeted session continuity loop` 现在已经达到 `acceptance-grade`。

它的成立范围是：

- 一条真实的 meeting-driven continuity slice
- bounded internal runtime discipline
- operator-visible budget / notebook / replay / prune posture
- review-first, non-committing continuity handling

它仍然不代表：

- 完整 memory cascade
- 完整 compaction engine
- 自动执行平面
- 默认 team mode
- 默认自动承诺或自动发送

## 8. 剩余风险

- 当前 acceptance-grade 证明的是一条窄 slice，不是所有 long-context runtime 都已同样成熟
- compact posture 目前基于 resumed checkpoint continuity，不应写成完整 compaction maturity
- larger pilot 样本下的 readability 和 fidelity thresholds 仍需更多证据
