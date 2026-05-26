---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Continuity Operator Diagnostics v1

更新时间：2026-04-03
状态：Operator Guide
适用范围：Helm v2.1 meeting-driven continuity slice

## 1. 目的

这份文档只解释当前 v2.1 continuity surface 应该如何读，不扩大能力边界。

它回答四件事：

1. `SAFE / WATCH / PRUNE / COMPACT` 到底是什么意思
2. `WEAK` replay fidelity 出现时应如何排查
3. `payload externalization` 与 `activeInContext` 的语义是什么
4. 哪些字段是 canonical continuity fields

## 2. Budget Posture 定义

### SAFE

- 当前 active context 明显低于 configured token budget
- 没有新的 prune 动作
- 没有 resumed checkpoint posture 接管当前 continuity

operator 含义：
- 现在不用收紧上下文
- 但不代表可以重新把 bulky raw payload 全量塞回 active context

### WATCH

- 当前 active context 还在预算内
- 但已经接近 watch threshold
- 下一次加载大 payload 时必须保持 selective loading

operator 含义：
- 当前不是错误
- 但已经不适合继续无约束扩 context

### PRUNE

- 当前 session 已经发生 prune
- bulky context 已被 `handle + preview + summary` 替换

operator 含义：
- 需要确认被 externalize 的内容是否仍可通过 handle trace 回溯
- 需要确认 blocker / decision / owner / due-date-bearing state 没被静默吞掉

### COMPACT

- 当前 session 正运行在 resumed checkpoint posture 上
- continuity 依赖 checkpoint replay，而不是完全依赖当前原始 active context

operator 含义：
- 需要优先看 replay fidelity
- `COMPACT` 不是 full compaction maturity，只表示当前 continuity 已进入 checkpoint-resumed posture

## 3. WEAK Fidelity 排查顺序

如果 replay fidelity 不是 `STRONG`，按这个顺序排查：

1. `goal`
   - 当前 objective 是否和 checkpoint snapshot 一致
2. `active objects`
   - meeting / opportunity / company 等 relevant objects 是否丢失
3. `confirmed facts`
   - 当前 confirmed facts 是否仍然只来自 promoted truth
4. `confirmed blockers`
   - blocker 是否在 prune / resume 后丢失
5. `next actions`
   - next action 是否仍然保留
6. `open questions`
   - open question 是否被误清空
7. `evidence refs`
   - evidence trace 是否变弱或丢失
8. `human decisions`
   - human-confirmed decision 是否仍然在 continuity state 中
9. `review posture`
   - review / blocked / deferred posture 是否漂移
10. `loaded handles / pruned handles / budget posture`
   - 当前 payload state 和 budget state 是否仍与 checkpoint continuity 对齐

如果以上任一项不成立：

- 不要把当前 replay 当成强连续性恢复
- 应保持 diagnostic posture，而不是把 session 继续表述为 fully preserved

## 4. Payload Externalization 与 activeInContext

### payload externalization

表示 bulky runtime context 没有继续直接留在 active context，而是被收成：

- handle
- preview
- summary

这允许 runtime 在不丢 traceability 的情况下缩小 active context。

### activeInContext

表示这个 persisted payload 当前仍属于 active context。

注意：

- `activeInContext = false` 不等于 payload 丢失
- 它只表示 payload 当前通过 externalized handle 代表，而不是默认直接加载

### stateDerivation

当前 payload state 可能来自三种来源：

- latest continuity checkpoint snapshot
- latest continuity checkpoint snapshot plus later prune edits
- latest prune edit
- all persisted payloads remain active by default

operator 应优先看 `stateDerivation`，再解释 active/pruned 数量。

## 5. Canonical Continuity Fields

当前 v2.1 continuity 的 canonical fields 是：

- objective
- relevantObjects
- confirmedFacts
- blockers
- decisions
- nextActions
- openQuestions
- evidenceRefs
- reviewState
- boundaryNote
- budgetState
- loadedHandles
- prunedHandles

其中：

- `confirmedFacts` 只应来自 promoted truth
- `loadedHandles / prunedHandles` 只表达当前 continuity state，不等于完整历史 event log

## 6. 明确保留的边界

这份诊断文档不改变以下边界：

- no auto-send
- no broad auto-write
- no second app tree
- no route/query rewrite
- no full compaction engine claim
- no broader orchestration claim
