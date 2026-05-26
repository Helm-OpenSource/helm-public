---
status: active
owner: helm-core
created: 2026-04-16
review_after: 2026-07-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1

状态：Historical Execution Baseline（已完成）
Owner：Helm Core  
日期：2026-04-22

收口说明：

- formal SWARM workstream 已完成 mainline closeout
- 当前 closeout 口径以 [`HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md`](./HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md) 为准

## 1. 目的

这份清单把 [`HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md`](../product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md) 和 [`HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md`](./HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md) 收成真正可执行的开工顺序。

它只回答 3 件事：

1. `SWARM-001 ~ SWARM-005` 应该按什么顺序进入
2. 每一条线在开工前必须先确认什么
3. 什么情况下必须停手，而不是继续扩面

这份文档不是：

- implementation PR
- workflow engine 方案
- authority 扩面批准
- team-mode 开启计划

## 2. 前置文档

显式引用：

- [`HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md`](../product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md)
- [`HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md`](./HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md)
- [`HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1.md`](../product/HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1.md)
- [`HELM_OPERATOR_DEBUGGER_PHASE2_FREEZE_REPORT_V1.md`](./HELM_OPERATOR_DEBUGGER_PHASE2_FREEZE_REPORT_V1.md)

## 3. 建议执行顺序

### Wave 1

1. `SWARM-001` Spawn Contract + Budget Envelope
2. `SWARM-002` Read-only Worker Fan-out

### Wave 2

3. `SWARM-003` Verification Merge Lanes
4. `SWARM-004` Operator Swarm Control Surface

### Wave 3

5. `SWARM-005` Candidate-only Consolidation Swarm

原因：

- `SWARM-001` 不成立，后面所有并行 worker 都没有统一 budget / deny / prefix contract
- `SWARM-002` 不先在 read-only worker 上证明收益，后面做 verifier / operator / consolidation 都会失真
- `SWARM-003` 和 `SWARM-004` 要建立在前两项 trace 与 artifact truth 已稳定的基础上
- `SWARM-005` 风险最高，只适合最后进

## 4. 每条线的开工前检查

### SWARM-001

必须先确认：

1. workspace flag 已有明确 `default-off / canary / enabled-for-review-only` 语义
2. 当前 `runThread` / operator debugger trace contract 已冻结到可复用状态
3. 预算 block / policy deny 能进入同一份 operator-readable surface

停手条件：

1. 需要先扩 authority
2. 需要先做 team-mode
3. 需要先做 broad workflow engine

### SWARM-002

必须先确认：

1. `SWARM-001` 已 accepted
2. 首批 worker allowlist 只包含 `search / grep / evidence mining`
3. worker 输出仍然是 artifact-first，不回灌长 transcript

停手条件：

1. 要求 worker 直接改 canonical memory
2. 要求 worker 直接 customer-facing send
3. 要求 worker 直接 official write

### SWARM-003

必须先确认：

1. `SWARM-001 / SWARM-002` 已 accepted
2. verifier disagreement 能进入 trace
3. 现有 review-first promotion guard 不被绕过

停手条件：

1. 需要 broad auto-merge
2. 需要跳过 human review lane

### SWARM-004

必须先确认：

1. `SWARM-001 ~ SWARM-003` 已 accepted
2. `/operating` 已有足够空间承载 swarm-specific control summary
3. pause / resume / kill / fallback 仍能保持 review-first

停手条件：

1. 需要跨 workspace 调度器
2. 需要通用 orchestration 平台

### SWARM-005

必须先确认：

1. `SWARM-001 ~ SWARM-004` 已 accepted
2. candidate-only consolidation 当前已有 pause/resume/audit
3. canonical memory promotion guard 已稳定

停手条件：

1. 需要自动写 canonical memory
2. 需要跨 queue 的 broad workflow engine

## 5. 建议 PR 边界

### PR-SWARM-001

只允许动：

- swarm spawn contract
- budget envelope / policy deny read model
- operator-visible deny / budget posture

不允许动：

- candidate consolidation
- official write authority
- customer-facing send

### PR-SWARM-002

只允许动：

- read-only worker allowlist
- artifact / handoff packet merge path
- single-agent vs swarm 对照验证

不允许动：

- merge lane automation
- operator kill / pause / resume controls

### PR-SWARM-003

只允许动：

- verifier / arbiter 三态 merge lane
- disagreement trace
- review-first merge guard

不允许动：

- operator swarm dashboard
- candidate consolidation fan-out

### PR-SWARM-004

只允许动：

- `/operating` swarm control surface
- pause / resume / kill / fallback controls
- breaker / cost spike / repeated-denial posture

不允许动：

- canonical memory promotion semantics
- broad orchestration platform

### PR-SWARM-005

只允许动：

- candidate-only consolidation fan-out
- queue-level audit / pause / resume / rollback consistency

不允许动：

- canonical memory 自动 mutation
- auto-send / broad auto-write

## 6. 验证顺序

### 文档阶段

只要求：

```bash
npm run self-check
git diff --check
```

### 实现阶段

每个 `SWARM-*` 实现 PR 默认都要跑：

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

如果某一条 PR 只是 narrow read-model / docs / guards，也必须明确说明为什么可以缩减验证。

## 7. 进入条件与退出条件

### Wave 1 进入条件

1. PR #98 文档评审通过
2. 认可 `leadered + heterogeneous + review-first + artifact-first + default-off`
3. 同意 `SWARM-001 / SWARM-002` 先行、其余后置

### Wave 1 退出条件

1. `SWARM-001 / SWARM-002` accepted
2. canary workspace 有两周基础数据
3. 无 authority boundary 事故

### Wave 2 进入条件

1. Wave 1 退出条件全部满足
2. verifier disagreement 数据和 artifact quality 数据可读

### Wave 3 进入条件

1. Wave 2 退出条件满足
2. candidate-only consolidation 仍被确认应继续保持 review-first

## 8. 历史结果与后续规则

这份 checklist 当前已经完成历史使命。

截至 `2026-04-22`：

1. formal SWARM 已按 re-baseline 收口到 `SWARM-001 ~ SWARM-008`
2. 这份 checklist 记录的 sequencing / gating logic 已被真实执行过
3. 当前不再应把本节理解为“下一步待执行”

后续规则：

1. 不再默认继续开新的 SWARM 续号
2. 未来如仍有相邻工作，默认按 narrow bugfix、ordinary backlog 或重新定义的新编号处理
3. 任何未来 reopen，都应引用这份 checklist 作为历史 sequencing 依据，而不是继续照抄成新一轮 implementation queue
