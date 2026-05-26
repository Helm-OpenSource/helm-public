---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Budgeted Session Continuity Baseline v1

更新时间：2026-04-03
状态：Baseline Freeze
适用范围：Helm v2.1 narrow continuity slice proveout

## 1. 这份 baseline 的主口径

这份文档只冻结一条 `meeting-driven budgeted session continuity loop` 的当前真相：

`meeting ingest -> persisted payload handles -> budget posture -> notebook state -> checkpoint/save/replay/resume -> prune / compact trace`

当前 truth source 仍以：

- `HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md`
- `HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md`

为主；本文件只冻结 long-context continuity 这一条 acceptance-grade slice。

## 2. 什么叫 v2.1 的 budgeted session continuity

在当前 v2.1，`budgeted session continuity` 的含义是：

1. 长 transcript、email-thread-like context、doc-like context 会进入 `handle + preview + summary`，不再默认把 bulky raw context 塞进 active prompt
2. runtime 会显式落到 `SAFE / WATCH / PRUNE / COMPACT` 其中之一
3. `session notebook` 会携带：
   - current objective
   - relevant objects
   - confirmed facts
   - blockers
   - decisions
   - next actions
   - open questions
   - evidence refs
   - review state
4. `checkpoint / replay / resume` 会比较 continuity snapshot 与 live state，并明确给出 `STRONG / WEAK` fidelity
5. `microprune` 不会静默丢掉 boundary、key human decision、key blocker、owner、due date；operator surface 必须看到 replaced/pruned、why、estimated savings、what replaced it

## 3. 已经完整成立

### 3.1 Persisted payload truth

- meeting-driven continuity slice 现在会把 bulky transcript、email thread 和 doc-like packet externalize 成 persisted payload handles
- `payload externalization` 现在在 meeting detail 和 session trace 里可见，包括 handle、preview、summary、sourceType、loadPolicy、estimatedTokens、active/externalized posture
- raw bulky payload 已不再是默认 active-context path；active context 以 selective loading 为前提

### 3.2 Budget posture truth

- runtime 现在显式给出 `SAFE / WATCH / PRUNE / COMPACT`
- posture 会解释：
   - 为什么进入该 posture
   - 当前 usage percent
   - 是否已 externalize tokens
   - 是否处于 resumed checkpoint continuity
- meeting detail 与 `/operating` 都已可见当前 posture

### 3.3 Notebook truth

- notebook 现在按 operational state 展示，而不是只做 transcript recap
- operator 可以直接看到：
   - objective
   - relevant objects
   - confirmed facts
   - blockers
   - decisions
   - next actions
   - open questions
   - evidence refs
   - review state

### 3.4 Checkpoint / resume truth

- checkpoint snapshot 现在会保存 continuity state，而不只是一段 summary
- resume 会回放 continuity snapshot，并给出 fidelity 结果
- fidelity 至少覆盖：
   - goal
   - active objects
   - confirmed facts
   - confirmed blockers
   - next actions
   - open questions
   - evidence refs
   - human decisions
   - review posture
   - loaded handles
   - pruned handles
   - budget posture

### 3.5 Prune / compact readability truth

- prune trace 现在显式列出：
   - strategy
   - before / after tokens
   - tokens saved
   - removed payloads
   - replacement summary
   - protected items
- protected items 至少覆盖 boundary note、blocker、decision、next action，也就是 owner / due date 这类关键信息不会被静默吞掉
- continuity surface 同时会显示 payload state derivation（checkpoint snapshot / checkpoint + edits / latest prune edit / all persisted），避免 operator 把当前 active 集错误当成完整历史事件流

## 4. 已成形但仍需下一层

- 当前 budget posture 是 acceptance-grade runtime discipline，不是完整 lowest-cost orchestration engine
- checkpoint fidelity 现在已经可见、可评估，但还不是成熟 compaction runtime
- continuity readability 已成立，但大规模 operator usage 下的信息密度仍需更多 pilot 证据

## 5. 刻意未做

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- richer observability scorecards beyond this slice

## 6. 风险项

- 这条 slice 证明的是 one narrow meeting-driven continuity loop，不是所有 runtime path 都已具备相同连续性
- checkpoint fidelity 当前仍是 bounded runtime comparison，不应写成完整 recovery engine
- prune protection 依赖当前 notebook / checkpoint truth，因此后续仍需继续验证 canonical continuity fields 是否稳定

## 7. 保留边界

以下边界在这条 slice 上继续成立：

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite

## 8. 下一层但不属于本次 freeze

下一阶段若继续推进，优先顺序应是：

1. 更真实的 long-context pilot 样本验证
2. 更稳的 checkpoint compaction / contradiction handling
3. continuity posture 与 verified coordination / follow-through 的更窄联动
4. 更长期的 runtime canonical object freeze
