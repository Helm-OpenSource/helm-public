---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Organizational Memory Baseline Freeze Report

## 已冻结的 Memory 组成

1. replay
2. audit
3. memory linkage
4. decision trace
5. boundary trace
6. source-use ledger
7. operating memory

## 它们各自服务什么

### replay

用于回看对象、会议、动作、审批和后续推进如何演化。

### audit

用于记录关键动作、判断变更和执行结果，让当前状态可追溯。

### memory linkage

用于把联系人、公司、机会、会议、任务、审批、handoff 串成真实经营链，而不是孤立记录。

### decision trace

用于解释为什么当前要这样判断，而不是只看最新页面状态。

### boundary trace

用于解释为什么当前要保留某个 prerequisite / dependency / non-commitment / review-before-send 边界。

### source-use ledger

用于解释当前 judgement 使用了哪些来源与对象关系，避免“凭空生成”。

### operating memory

用于解释 internal operating workspace 中对象、会议、决策、任务、复盘为什么会落在当前 handoff 和 next action 上。

## 已冻结的服务对象

Memory Layer 当前明确服务：

1. judgement
2. handoff
3. recommendation / commitment boundary
4. worker / skill / resource trace
5. billing / lifecycle / payment truth trace
6. internal operating workspace 的对象、会议、决策、任务、复盘

## 当前仍然不属于 Memory Layer 的内容

- 完整 knowledge platform
- 任意自由漂浮的笔记仓库
- 完整 source ranking / confidence platform
- 完整 workflow execution graph

## 当前基线结论

Memory Layer 当前已经足够冻结。
它的定义不是“有历史记录就算 memory”，而是“它必须能解释当前 judgement、handoff、boundary 和 next action”。
