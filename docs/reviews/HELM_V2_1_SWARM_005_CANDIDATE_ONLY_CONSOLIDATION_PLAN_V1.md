---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 SWARM-005 Candidate-only Consolidation Plan V1

## 结论

`SWARM-005` 在 SWARM re-baseline 之后应只拥有 `candidate-only consolidation swarm`。这一刀当前先做 docs/guards sync：把 `candidate-only consolidation`、`queue-level audit / pause-resume / rollback consistency`、`fallback_to_single_agent`、`no canonical memory auto-mutation` 和 `no workflow engine` 固定成同一份 planning truth。

这条线当前不吸收：

- `SWARM-003` verification merge lanes
- `SWARM-004` operator control surface
- canonical memory 自动 mutation
- broad workflow engine / orchestration plane
- broad auto-write / auto-send / authority expansion

一句话：`SWARM-005` 只回答“candidate consolidation queue 能否继续保持 review-first、可审计、可暂停恢复、可回退到单代理”，不回答 merge lane、operator control 或 canonical memory 自动改写。

## 方案

### 1. 目标

当前阶段先做 5 件事：

1. 冻结 `candidate-only consolidation` 的编号边界
2. 冻结 `queue-level audit / pause-resume / rollback consistency`
3. 把 `fallback_to_single_agent` 固定为 rollback target，而不是新的 orchestration plane
4. 同步 `PLANS.md`、`docs/README.md`、`helm-self-check` 和 `decision-first-boundary-check`
5. 把后续 `SWARM-005` 实现问题限定为 queue / audit / rollback，不继续吸收别的主线

这条线不是：

- `SWARM-001` spawn contract
- `SWARM-002` read-only worker fan-out
- `SWARM-003` verification merge lanes
- `SWARM-004` operator swarm control surface
- canonical memory 自动 mutation
- broad workflow engine / orchestration platform
- auto-send / broad auto-write / authority expansion

### 2. 当前假设

1. `SWARM-001 ~ SWARM-004` 已经提供 admission、artifact、review 和 bounded control 的最小 truth
2. `leadered + review-first + artifact-first + default-off` 仍然是总边界
3. candidate consolidation 当前只允许停留在 candidate / queue / review-first promotion path，不直接改写 canonical memory
4. `fallback_to_single_agent` 是 queue rollback target，不是新的 operator control family，也不是多 queue orchestration
5. rollback consistency 只回答 candidate queue 是否能回到单代理路径，不等于 canonical memory 自动修复或 workflow engine 级恢复

### 3. 产品原则与优先级映射

显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md`
- `docs/reviews/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1.md`
- `docs/reviews/HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md`
- `docs/reviews/HELM_V2_1_SWARM_WORKSTREAM_REBASELINE_V1.md`

这条线接到的真实业务闭环是：

- `candidate-only consolidation -> queue-level audit -> pause/resume -> rollback consistency -> fallback_to_single_agent -> human review / promotion`

它服务的是：

- 审计
- 复核
- 回退一致性
- review-first promotion safety

为什么现在做，而不是直接改 runtime：

1. SWARM re-baseline 已经把 candidate consolidation 漂移项明确迁回 `SWARM-005`
2. 如果没有独立 plan 和 guard，同一批工作很容易再次漂到 `SWARM-004` 或 shared runtime adjacency
3. docs/guards sync 是当前最小可验证切片，不会提前碰 runtime / actions / UI / tests

### 4. 当前切片

这一轮只落 5 件事：

1. 新增 `HELM_V2_1_SWARM_005_CANDIDATE_ONLY_CONSOLIDATION_PLAN_V1.md`
2. 更新 `PLANS.md` 的 `SWARM-005` 入口
3. 更新 `docs/README.md` 索引
4. 新增一条 narrow self-check
5. 新增一条 narrow boundary-check

这轮 docs/guards sync 不改：

- runtime contract
- server actions
- UI surface
- tests

如果后续进入实现，才再评估是否需要进入：

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/meeting-action-pack-runtime.ts`
- `lib/helm-v2/consolidation-queue-audit-summary.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`

### 5. 建议读口收口

后续 `SWARM-005` 真正进入实现时，读口只应回答四件事：

1. 当前 `candidate-only consolidation` queue 能否继续处理
2. 当前 queue-level audit 是否足够解释 pause / resume / rollback
3. 当前 rollback target 是否仍然是 `fallback_to_single_agent`
4. 当前 candidate promotion guard 是否仍然保持 `no canonical memory auto-mutation`

故意不让 `SWARM-005` 继续回答：

- mergeable / rework_required / human_review_required
- operator `pause / resume / kill / fallback` control surface
- shared persisted trace parity
- canonical memory 自动 mutation
- broad workflow engine / orchestration platform

这样做的目的，是把 `SWARM-005` 固定成 candidate-only consolidation queue，而不是新的 shared runtime umbrella 或 canonical memory auto-write 入口。

## 受影响组件

当前 docs/guards sync 只影响：

- `PLANS.md`
- `docs/README.md`
- `docs/reviews/HELM_V2_1_SWARM_005_CANDIDATE_ONLY_CONSOLIDATION_PLAN_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

后续若进入真正实现，再评估 runtime / operator / queue 的最小改动。

## 权衡

### 为什么先做 docs/guards sync，不直接改 runtime

因为这轮最核心的问题是 `SWARM-005` 的 ownership 已经被 re-baseline 明确，但仓库入口和 guard 还没有同步。如果这时直接进 runtime 改动，会继续把 `SWARM-005`、`SWARM-004` 和 shared adjacency 混在一起。

### 为什么把 `fallback_to_single_agent` 收窄为 rollback target

因为这轮需要的是 candidate queue 的回退一致性，而不是新的 control family。把它写成 rollback target，可以明确它服务的是 queue consistency，不是 operator dashboard 扩面。

### 为什么显式写 `no canonical memory auto-mutation`

因为 candidate-only consolidation 的最大误读风险，就是把 candidate queue 误写成 canonical memory 自动 promotion。当前这条线必须继续保留 review-first boundary。

## 风险

1. 如果 candidate queue 与 operator control wording 继续混写，`SWARM-005` 还会重新吸收 `SWARM-004`
2. 如果 `fallback_to_single_agent` 被误写成 generic orchestration capability，会造成 authority 误读
3. 当前只是 docs/guards sync，还没有真正的 queue-level runtime 证据
4. 如果后续实现不继续引用 issue template / checklist，回滚和审计口径可能再次漂移

## 验证结果

本轮是 docs/guards sync，默认先跑窄验证：

```bash
npm run self-check
npm run check:boundaries
git diff --check
```

如果这轮之后进入实现，才升级到完整仓库验证链：

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

## 剩余风险

1. `SWARM-005` 当前只有 plan / index / guard truth，还没有 runtime queue implementation
2. self-check / boundary-check 只能约束入口和 wording，不能替代实现验证
3. 如果后续实现越过 review-first promotion guard，仍然可能造成 canonical memory 边界漂移

## 下一步建议

1. 后续 `SWARM-005` 只继续做 `candidate-only consolidation`、`queue-level audit / pause-resume / rollback consistency` 和 `fallback_to_single_agent`
2. 只要需求开始要求 canonical memory 自动 mutation，立即停手并重新评审
3. 只要需求开始要求 broad workflow engine / orchestration plane，立即停手并新开编号
