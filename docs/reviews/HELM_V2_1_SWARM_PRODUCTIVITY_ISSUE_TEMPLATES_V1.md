---
status: active
owner: helm-core
created: 2026-04-16
review_after: 2026-07-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Swarm Productivity Issue Templates v1

状态：Historical Template Archive（已完成）
日期：2026-04-22

收口说明：

- 这组模板是 formal SWARM 的历史模板档案
- 当前 closeout 口径以 [`HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md`](./HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md) 为准

## 结论

这份文档把 [`HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md`](../product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md) 里的五个优先需求收成可直接执行的 issue 模板。

目标不是马上开做，而是先把每条线必须回答的内容固定下来：

- 目标
- 影响面
- 前提条件
- 风险
- 回滚
- 指标
- 验收
- 验证

## 通用字段模板

所有 `SWARM-*` issue 默认至少填写：

1. `owner`
2. `status`
3. `target phase`
4. `workspace flag`
5. `affected components`
6. `prerequisites`
7. `non-goals`
8. `risk`
9. `rollback path`
10. `metrics`
11. `acceptance`
12. `validation`

建议统一状态：

- `planned`
- `in_progress`
- `review`
- `blocked`
- `accepted`
- `frozen`

建议统一 phase：

- `phase_0`
- `phase_1`
- `phase_2`
- `phase_3`
- `phase_4`

## SWARM-001: Spawn Contract + Budget Envelope

### 目标

为所有 swarm spawn 建立统一契约、统一预算包络和统一 deny posture，确保并行不会绕开权限、预算和 review-first 边界。

### 影响面

- runtime spawn entry
- operator debugger trace / write / recovery surface
- `/operating` budget / deny readout
- policy check / workspace flag gate

### 前提条件

1. 当前 `runThread` / operator debugger contract 已稳定。
2. workspace 级 flag 能区分 `default-off / canary / enabled-for-review-only`。
3. 预算和 deny 结果可以进入统一 event / trace read model。

### 非目标

1. 不做 team-mode 默认开启。
2. 不做 broad auto-write。
3. 不做 peer-to-peer freeform agent messaging。

### 风险

1. prefix 漂移导致 cache 命中率快速下降。
2. 递归 spawn 导致 budget runaway。
3. deny 结果不可见，operator 无法判断真实阻塞点。

### 回滚路径

1. 全量关闭 workspace flag。
2. 强制回退 single-agent path。
3. 保留 trace，不保留继续 fan-out。

### 指标

1. `spawn_count_per_run`
2. `spawn_deny_rate`
3. `budget_block_rate`
4. `cache_hit_rate`
5. `coordination_latency_ms`

### 验收

1. 非白名单任务无法 spawn。
2. 超预算 run 进入 `blocked + review`，不会继续 fan-out。
3. 所有 deny 在 `/operating` 和 trace 中可见。

### 验证

1. `npm run self-check`
2. `npm run check:boundaries`
3. `npm run typecheck`
4. 定向 runtime / operator debugger 测试

## SWARM-002: Read-only Worker Fan-out

### 目标

先只在高价值、低副作用场景开放并行 worker，把 read-only fan-out 收成第一层可验证收益。

### 影响面

- search / grep / evidence-mining worker lanes
- artifact / handoff packet
- lead synthesis contract
- verifier input contract

### 前提条件

1. `SWARM-001` 已建立 spawn contract 和 budget envelope。
2. worker 输出已经以 artifact-first 为主，不依赖长 transcript merge。

### 非目标

1. 不做 canonical memory 自动写。
2. 不做 customer-facing send。
3. 不做 workflow engine。

### 风险

1. 并行带来更多低质量 artifact。
2. read-only worker 结果没有统一 provenance，lead synthesis 失真。
3. wall-clock 下降但 token/cost 失控。

### 回滚路径

1. 关闭 read-only fan-out flag。
2. 回退 single-agent evidence collection。
3. 保留 artifact 和 trace，不保留 worker 并行。

### 指标

1. `coordination_latency_ms`
2. `artifact_count_per_run`
3. `cost_per_action`
4. `verification_escape_rate`

### 验收

1. 目标任务 wall-clock 下降。
2. `verification_escape_rate` 不高于 single-agent 基线。
3. 无新增外部副作用写入。

### 验证

1. single-agent vs swarm 对照任务集
2. artifact provenance 回归测试
3. operator surface 可见性检查

## SWARM-003: Verification Merge Lanes

### 目标

把 swarm 结果统一收进 `mergeable / rework_required / human_review_required` 三态 merge lane，防止多代理结果直接越权进入主链。

### 影响面

- verifier / arbiter contract
- runtime event log
- operator debugger verification posture
- candidate / merge gate read model

### 前提条件

1. `SWARM-001` 和 `SWARM-002` 已建立。
2. verifier disagreement 能进入统一 trace。

### 非目标

1. 不做 broad auto-merge。
2. 不做 bypass review 的 candidate promotion。

### 风险

1. disagreement 处理不清导致 merge lane 不可信。
2. 低置信度 artifact 错进 mergeable。
3. verifier 成本过高，收益不成立。

### 回滚路径

1. 停用 swarm merge lanes。
2. 回退到单 verifier / human review。
3. 保留三态日志，但不再自动分流。

### 指标

1. `truth_score_delta`
2. `conflict_detection_rate`
3. `verifier_disagreement_rate`
4. `human_review_required_rate`

### 验收

1. 三态分流在 runtime log 与 operator surface 可追踪。
2. 高风险 artifact 无 bypass merge。
3. disagreement 会进入 rework 或人工复核。

### 验证

1. verifier disagreement fixture 测试
2. operator surface merge lane 回归
3. quality regression 对照

## SWARM-004: Operator Swarm Control Surface

### 目标

让 operator 在单页面看清 swarm run graph、预算、verification、cache reuse 和 breaker posture，并能明确地 pause / resume / kill / fallback。

### 影响面

- `/operating`
- operator debugger read model
- run graph / budget / breaker summary
- fallback to single-agent controls

### 前提条件

1. `SWARM-001 ~ SWARM-003` 已提供稳定 trace 与 verification truth。
2. pause / resume / kill / fallback 的 write-side authority 仍保持 review-first。

### 非目标

1. 不做 broad orchestration control plane。
2. 不做跨 workspace 多租户 swarm scheduler。

### 风险

1. run graph 不可读，operator 反而更慢。
2. breaker 指示和真实阻塞点不一致。
3. fallback 不可恢复，污染 canonical state。

### 回滚路径

1. 关闭 swarm control surface 写入口。
2. 只保留 read-only trace。
3. 强制 fallback single-agent。

### 指标

1. `operator_interventions`
2. `pause_resume_success_rate`
3. `fallback_success_rate`
4. `incident_recovery_latency_ms`

### 验收

1. operator 能在单页面完成停止或降级操作。
2. incident drill 能在一次动作内完成 rollback。
3. 无 canonical state 污染。

### 验证

1. operator control e2e
2. pause / resume / kill / fallback contract 测试
3. rollback smoke test

## SWARM-005: Candidate-only Consolidation Swarm

### 目标

先在 consolidation candidate 层验证 swarm 收益，而不是直接放宽 canonical memory 写边界。

### 影响面

- consolidation queue
- candidate artifact synthesis
- review-first promotion path
- operator review surface

### 前提条件

1. `SWARM-001 ~ SWARM-004` 已稳定。
2. candidate-only consolidation 当前路径已可 pause / resume / audit。

### 非目标

1. 不做 canonical memory 自动 mutation。
2. 不做跨 queue 的 broad workflow engine。

### 风险

1. 吞吐提升但审计性下降。
2. candidate 结果和 canonical truth 边界混淆。
3. 回滚后数据不一致。

### 回滚路径

1. 停用 consolidation fan-out。
2. 回退单代理 consolidation。
3. 保留 candidate trace，不保留多 worker merge。

### 指标

1. `candidate_throughput`
2. `review_queue_latency_ms`
3. `candidate_rework_rate`
4. `rollback_consistency_rate`

### 验收

1. consolidation 吞吐提升且保持可审计。
2. 无 canonical memory 自动 mutation。
3. 回滚后可恢复单代理路径且数据一致。

### 验证

1. consolidation candidate 回归测试
2. review/promotion guard 测试
3. rollback consistency 测试

## 当前用途

当前不再把这份文档当作“下一步待建卡”的执行入口。

它现在的用途是：

1. 保留 formal SWARM 最初的 issue 结构、字段与验收 shape
2. 供 narrow reopen 或 ordinary backlog 复用其字段设计
3. 作为 re-baseline 与 closeout 之后的历史边界参考

执行顺序与建议 PR 边界见：

- [`HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1.md`](./HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1.md)
