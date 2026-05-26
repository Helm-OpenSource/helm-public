---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_V2_1_SWARM_WORKSTREAM_REBASELINE_V1

状态：Baseline Cutover
Owner：Helm Core
日期：2026-04-21

## 1. 目的

这份文档用于终止 `SWARM-004K` 这一类续号扩题，把 SWARM 主线重新拉回最初的五条工作流定义。

这次 re-baseline 只做三件事：

1. 把 `SWARM-004` 收回到原始 `Operator Swarm Control Surface` 定义。
2. 把已经漂移出去的事项迁回 `SWARM-003`、`SWARM-005` 或新的 backlog 编号。
3. 明确 cutover rule：从这份文档起，禁止继续使用 `SWARM-004L+` 续号。

这份文档不做：

- 新功能扩面
- 运行时代码改造
- 新 action family / new persistence / new authority
- 把当前 `SWARM` 工作流重写成 orchestration platform

## 2. 当前判定所依据的 source of truth

本次 re-baseline 以以下文档为准：

- [`../product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md`](../product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md)
- [`HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1.md`](./HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1.md)
- [`HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md`](./HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md)

本次还核对了 current-main 的实现入口：

- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/meetings/actions.ts`
- `lib/helm-v2/run-thread-contract.ts`
- `lib/helm-v2/operator-debugger-read-model.ts`

## 3. `SWARM-004` 的真正收口范围

`SWARM-004` 真正的标题仍然是：

- `Operator Swarm Control Surface`

它真正拥有的范围，仍然只有以下四类：

1. `/operating` 上的单页 operator swarm control summary
2. `run graph / budget / spawn count / cache reuse / verification state / provenance` 的控制级摘要
3. `pause / resume / kill / fallback to single-agent` 的 review-first 显式操作
4. `breaker / cost spike / repeated-denial` 的 operator posture

它不再拥有以下类型的工作：

1. verifier / arbiter 的 merge lane 语义
2. candidate-only consolidation queue 语义
3. shared runtime debugger detail parity
4. persisted lifecycle trace 的 readout 家族
5. takeover / remediation / close / settlement 的 shared handoff parity

换句话说，`SWARM-004` 只回答一个问题：

- operator 能否在 `/operating` 这一个控制面里，看清 swarm 当前是否需要被暂停、恢复、终止或降级。

它不应该继续回答这些问题：

- debugger trace 是否对齐
- persisted lifecycle provenance 是否够完整
- close request / settlement review / closeout follow-through 是否已经有 shared detail parity
- continuity remediation handoff 是否在 meeting runtime 与 `/operating` 之间完全同构

## 4. current-main 已经出现的范围漂移

current-main 的实现已经能看出 `SWARM-004` 容易被继续误扩：

1. `/operating` 的 continuity queue 已经把 `swarm spawn / read-only worker / recovery / persisted lifecycle / takeover / closeout / close request / settlement review / forward flow` 拼进同一条 `tertiarySummary` 和 `meta` 字符串。这是 shared runtime/debugger detail surface，不再是原始的 operator control summary。
2. meeting runtime card 里的 `operator debugger spine` 已经在同一张卡内同时展示 `trace / write / swarm / recovery / persisted lifecycle / takeover / close / settlement`。这属于 debugger detail parity，不属于原始 `SWARM-004`。
3. `features/meetings/actions.ts` 当前同时承载 `swarm spawn / takeover / close request / settlement review / consolidation pause-resume` 等写侧入口。只有其中与 `pause / resume / kill / fallback` 直接相关的 operator control 才属于 `SWARM-004`。
4. `run-thread-contract.ts` 和 `operator-debugger-read-model.ts` 当前已经承载 shared `spawn / worker / persisted lifecycle / takeover / close / settlement` contract。它们是 shared runtime/debugger truth，并不因为进入 `/operating` 就自动属于 `SWARM-004`。

结论：

- `SWARM-004` 的问题不是“还不够多”，而是“已经开始把 shared runtime adjacency 误吸进 operator control 编号”。

## 5. 当前应迁回 `SWARM-003` 的项

下列事项如果继续推进，必须迁回 `SWARM-003`，不能再挂在 `SWARM-004` 下：

1. `mergeable / rework_required / human_review_required` 三态 merge lane
2. verifier disagreement / truth conflict trace
3. review-first merge guard / human review gate
4. 任何主要回答“这个 swarm 结果能不能 merge”的 operator/debugger readout
5. 任何把 `verification / provenance / promotion review` 继续压成 merge posture 的 summary work

判断规则：

- 只要一个 slice 的核心问题是“结果是否可 merge、需不需要 rework、是否必须人工复核”，它就属于 `SWARM-003`。

## 6. 当前应迁回 `SWARM-005` 的项

下列事项如果继续推进，必须迁回 `SWARM-005`，不能再挂在 `SWARM-004` 下：

1. candidate-only consolidation fan-out
2. queue-level audit / pause / resume / rollback consistency
3. consolidation queue 的吞吐、阻塞、重试、回退一致性
4. 任何主要回答“candidate consolidation 还能不能继续排队、暂停、恢复、回滚”的 operator surface

判断规则：

- 只要一个 slice 的核心问题是“candidate-only consolidation queue 如何保持 review-first 和可审计”，它就属于 `SWARM-005`。

## 7. 必须新开编号的项

下列事项不应再塞回 `SWARM-003`、`SWARM-004` 或 `SWARM-005`，必须另开新编号：

### 建议新开 `SWARM-006`

主题：`Persisted Lifecycle Trace Readout Family`

包括：

1. persisted lifecycle trace readout parity
2. provenance readout
3. anchor / reference readout
4. integrity readout

原因：

- 这类工作回答的是 shared persisted-trace detail truth，不是 merge lane，也不是 operator control surface。

### 建议新开 `SWARM-007`

主题：`Shared Takeover / Remediation Handoff Surfaces`

包括：

1. shared takeover lifecycle surface parity
2. continuity remediation handoff
3. fallback follow-through 邻接 detail surface
4. 与 takeover / remediation 相关的 focus-link hardening

原因：

- 这类工作回答的是 shared human-takeover / remediation lifecycle，不是原始 `SWARM-004` 的单页 operator control。

### 建议新开 `SWARM-008`

主题：`Shared Close / Settlement Adjacency Surfaces`

包括：

1. shared close request handoff
2. shared settlement review handoff
3. closeout / close request / settlement 邻接 detail parity
4. 与 close / settlement 相关的 focus-link hardening

原因：

- 这类工作回答的是 close / settlement adjacency parity，不是 merge lane、candidate consolidation，也不是原始 `SWARM-004`。

## 8. `SWARM-004A ~ SWARM-004K` 的分流规则

从本次 re-baseline 起，历史上的 `SWARM-004A ~ SWARM-004K` 只能按下面的 cutover 解释：

1. `SWARM-004A`
   - 只有在它严格等于 `/operating` 的 read-only control summary 时，才保留在 `SWARM-004`
   - 一旦继续扩成 continuity queue / debugger detail parity，就必须转出
2. `SWARM-004B`
   - 只有在它严格等于 bounded fallback request seam 时，才保留在 `SWARM-004`
3. `SWARM-004C ~ SWARM-004D`
   - 迁到 `SWARM-007`
4. `SWARM-004E ~ SWARM-004F`
   - 迁到 `SWARM-008`
5. `SWARM-004G`
   - 跟随其父主题，迁到 `SWARM-007` 或 `SWARM-008`
6. `SWARM-004H ~ SWARM-004K`
   - 迁到 `SWARM-006`

## 9. cutover rule：禁止继续使用 `SWARM-004L+`

从这份文档起，执行以下规则：

1. 不允许再创建 `SWARM-004L+`、`SWARM-004AA+` 或任何继续串号的 `SWARM-004*` 子编号。
2. 如果后续工作仍然是原始 `SWARM-004` 范围，只能重新打开一个狭义 `SWARM-004` issue / PR，不再继续 suffix train。
3. 如果后续工作主要回答 merge / rework / human review 问题，回到 `SWARM-003`。
4. 如果后续工作主要回答 candidate consolidation queue 问题，回到 `SWARM-005`。
5. 如果后续工作主要回答 shared runtime/debugger detail parity 问题，必须新开 `SWARM-006+` 系列编号。

## 10. `SWARM-004` 的关闭口径

`SWARM-004` 的完成定义应重新收回到以下口径：

1. `/operating` 上存在单页 operator swarm control summary
2. operator 能显式完成 `pause / resume / kill / fallback to single-agent`
3. breaker / cost spike / repeated-denial posture 可见
4. rollback 仍是：关闭 control write entry、保留 read-only trace、强制回 single-agent
5. 不再把 shared debugger/detail parity 继续记为 `SWARM-004` 的“下一刀”

## 11. 当前建议 next step

当前更合理的 next step 不是继续开 `SWARM-004L+`。

而是：

1. 先把 `SWARM-004` 重新冻结成原始 operator control surface 定义
2. 把 verification 漂移项回收到 `SWARM-003`
3. 把 candidate consolidation 漂移项回收到 `SWARM-005`
4. 如果 persisted lifecycle / takeover / close / settlement 邻接 surface 还要继续做，先开 `SWARM-006 ~ SWARM-008`

这份文档的角色是：

- workstream re-baseline
- numbering cutover
- closeout-ready planning baseline

它不是：

- 新功能 PR
- `SWARM-004` 扩面批准
- orchestration control plane 许可
