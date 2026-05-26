---
status: active
owner: helm-core
created: 2026-04-16
review_after: 2026-07-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 Swarm Productivity Execution Plan v1

更新时间：2026-04-22
状态：Historical Planning Baseline（已完成）
输入来源：`/Users/tommyqian/Desktop/Agent Swarm Architectures and Their Applicability to Helm v2.1.pdf`

收口说明：

- formal SWARM workstream 已按 `SWARM-001 ~ SWARM-008` 完成 mainline closeout
- 当前历史收口以 [`../reviews/HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md`](../reviews/HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md) 为准

## 1. 结论（先说结论）

基于附件研究和当前仓库 reality，Helm 最适合的 swarm 路径不是“全面多代理化”，而是：

`leadered + heterogeneous + review-first + artifact-first + default-off`

也就是：

1. 由 lead runtime 保留预算、权限、审批、综合结论控制权。
2. worker 只做窄任务（先读后写、先候选后确认）。
3. 所有产出通过 artifact / handoff packet / verification 回到主链。
4. 外部发送、canonical memory、official write 继续保持 review-first 和明确人工门槛。

这条路径能提升 Helm 生产力，同时不破坏现有 `judgement-first` 与 `recommendation != commitment` 边界。

## 2. 这份计划要解决的生产力问题

本计划只回答四个可量化的生产力结果：

1. `coordination_latency_ms`：多 worker 并行是否真正缩短端到端时长。
2. `truth_score_delta`：多 worker + verifier 是否提升事实质量。
3. `cost_per_action`：每个可采纳动作的 token / 工具成本是否可控。
4. `operator_interventions`：是否减少人工救火次数，而不是制造新运维负担。

## 3. 当前状态分级（按仓库口径）

### 3.1 已经完整成立

1. artifact-first runtime 主路径（meeting -> artifact -> review）已成立。
2. notebook / checkpoint / payload-handle / verification / truth conflict 基础能力已成立。
3. operator surface（meeting detail + `/operating`）已有可读控制面。
4. candidate-only consolidation 与 review-first posture 已成立。

### 3.2 已成形但仍需下一层

1. swarm 专用 `spawn contract` 与 prefix-hash/cache 契约未形成统一强约束。
2. `agent_run` 级生命周期（spawn/pause/resume/kill/rework/merge）未形成统一可观测契约。
3. 针对 swarm 的 budget envelope、policy deny、circuit breaker 仍需收敛为同一条控制面。
4. verifier-swarm 与 arbiter 合成路径需要真实 pilot 数据证明收益。

### 3.3 刻意未做

1. 默认 team mode / peer messaging。
2. broad auto-write、auto-send、高风险自动承诺。
3. 通用 workflow engine / orchestration platform 扩张。
4. 把 v2.1 写成“全功能 swarm 平台”。

### 3.4 风险项

1. 并行带来成本膨胀（高并发 + 低收益）。
2. handoff 链路造成权限泄漏与边界漂移。
3. prefix 漂移导致 prompt cache 命中率快速下降。
4. 多代理 trace 不可读，反向拖慢 operator 决策。

## 4. 未来最值得增强的 5 个产品需求（按优先级）

### 4.1 需求 1：Swarm Spawn Contract + Budget Envelope（P0）

目标：每次 spawn 都有可审计契约，且不允许预算失控。
关键设计：

1. 强制记录 `spawn_contract_id / prefix_hash / cache_policy_version / budget_envelope`。
2. spawn 前置策略校验：workspace flag、task whitelist、并发上限、递归深度、DRI 门槛。
3. deny 结果进入 operator 可见队列，不能 silent fail。

验收标准：

1. 非白名单任务无法 spawn。
2. 单 run 超预算能自动进入 `blocked + review`，不会继续 fan-out。
3. 所有 spawn deny 在 `/operating` 可检索。

### 4.2 需求 2：Read-only Worker Fan-out（P0）

目标：先把并行能力限定在高价值、低副作用场景。
关键设计：

1. 首批只开放 `search / grep / evidence mining` 类型 worker。
2. worker 只返回 artifact ref + handoff packet，不回灌长 transcript。
3. lead 负责 synthesis，worker 无最终承诺权。

验收标准：

1. 目标任务的 `coordination_latency_ms` 相比 single-agent 有可测下降。
2. `verification escape rate` 不高于 single-agent 基线。
3. 无新增外部副作用写入。

### 4.3 需求 3：Verification Merge Lanes（P0）

目标：把所有 swarm 结果收敛到统一可控出站口。
关键设计：

1. swarm 结果统一进入三态：`mergeable / rework_required / human_review_required`。
2. 低置信度、混合 provenance、trust 异常结果禁止直接 merge。
3. verifier disagreement 自动触发 rework 或人工复核。

验收标准：

1. 三态分流在 runtime log 与 operator surface 可追踪。
2. 高风险 artifact 无 bypass merge。
3. `truth_score_delta` 与 `conflict detection rate` 可观测。

### 4.4 需求 4：Operator Swarm Control Surface（P1）

目标：让多代理运行可控、可回放、可中断。
关键设计：

1. 统一展示：run graph、budget、spawn count、cache reuse、verification state、provenance。
2. 提供 `pause / resume / kill / fallback to single-agent` 明确操作。
3. 对 repeated-denial、cost spike、cache collapse 提供 breaker 指示。

验收标准：

1. operator 能在单页面完成停止或降级操作。
2. incident drill 可在一次动作内完成 rollback。
3. 无 canonical state 污染。

### 4.5 需求 5：Candidate-only Consolidation Swarm（P1）

目标：先在候选层验证 swarm 收益，不触碰 canonical memory 自动写。
关键设计：

1. consolidation 允许 bounded fan-out（收集证据、冲突对照、候选合并）。
2. 输出仍是 candidate，必须 review 才能 promotion。
3. queue 继续支持 pause/resume/audit。

验收标准：

1. consolidation 吞吐提升且保持可审计。
2. 无 canonical memory 自动 mutation。
3. 回滚后能恢复到单代理路径且数据一致。

## 5. 分阶段实施（推荐 5 个阶段）

1. `Phase 0`（无行为变更）：冻结现状 + 补 telemetry 与 schema 占位。
2. `Phase 1`：read-only worker fan-out（search/grep）+ prefix-hash contract。
3. `Phase 2`：problem space 上的 planner/critic/evidence-miner 多假设规划。
4. `Phase 3`：verifier swarm + arbiter 合成，仍保持 review-first promotion。
5. `Phase 4`：candidate-only consolidation swarm + canary + 一键回滚。

## 6. 治理与边界（必须保留）

1. `workspace-flagged + default-off`。
2. 初期禁用 nested spawn 与 peer chat。
3. customer-facing send 继续 manual。
4. official write 继续 review-gated。
5. recommendation / explanation 仍不等于 commitment。

## 7. 验证方案（实现阶段必须附带）

仓库默认验证链（按 AGENTS 口径）：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

swarm 额外验证口径：

1. 基线对照：single-agent vs swarm（同任务集）。
2. 质量对照：truth score、conflict detection、verification disagreement。
3. 成本对照：token、tool、wall-clock、cost-per-action。
4. 安全对照：side-effect bypass、policy deny、rollback 完整性。

## 8. 历史执行结果与后续规则

截至 `2026-04-22`：

1. formal SWARM 编号线已经按 re-baseline 收口到 `SWARM-001 ~ SWARM-008`
2. `SWARM-003 ~ SWARM-008` 已分别通过独立 narrow PR 并入主干
3. `SWARM-001 / SWARM-002` 已作为 current-main substrate 成立并持续被运行时与测试消费
4. `SWARM-004L+` 已停止续号
5. 当前不再默认继续开 `SWARM-009`

后续规则：

1. 未来如仍有相邻工作，默认按 narrow bugfix、ordinary backlog 或重新定义的新编号处理
2. 不再把 shared adjacency、debugger parity 或 control-plane 邻接继续塞回旧 SWARM 编号
3. formal closeout 以 [`../reviews/HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md`](../reviews/HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md) 为准

执行模板见：

- [`../reviews/HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md`](../reviews/HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md)

---

这份文档现在是 `historical planning baseline`，不是当前待执行任务单，也不是对外能力承诺。
任何未来涉及 auto-send / broad auto-write / team-mode 默认开启的动作，仍必须另开评审并补充边界与回滚证明。
