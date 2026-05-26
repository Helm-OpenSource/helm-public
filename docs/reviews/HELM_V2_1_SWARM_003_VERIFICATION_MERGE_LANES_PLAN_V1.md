---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 SWARM-003 Verification Merge Lanes Plan V1

## 结论

`SWARM-003` 在 SWARM re-baseline 之后应只拥有 verification merge lanes。这一刀当前先做 docs/guards sync：把 `mergeable / rework_required / human_review_required` 三态、`review-first merge guard` 和 `human review gate` 固定成同一份 planning truth，并明确 `SWARM-004` 当前只按 `parked / narrow` 理解，只保留原始 `operator control surface`。

这条线当前不吸收：

- `SWARM-004L+` 续号
- candidate consolidation
- `persisted trace / takeover / close / settlement adjacency`
- auto-merge / bypass review / authority expansion

一句话：`SWARM-003` 只回答“这个 swarm 结果能 merge、必须 rework，还是必须 human review”，不回答 operator control 或 shared adjacency parity。

## 方案

### 1. 目标

当前阶段先做 5 件事：

1. 冻结 `mergeable / rework_required / human_review_required` 三态 merge lane
2. 冻结 `review-first merge guard` 与 `human review gate`
3. 把 verifier disagreement / truth conflict 只保留为 merge lane evidence，而不是另起 persisted trace family
4. 同步 `PLANS.md`、`docs/README.md`、`helm-self-check` 和 `decision-first-boundary-check`
5. 把后续 SWARM-003 实现问题限定为 merge / rework / human-review，不继续吸收别的主线

这条线不是：

- `SWARM-001` spawn contract
- `SWARM-002` read-only worker fan-out
- `SWARM-004` operator swarm control surface
- `SWARM-005` candidate-only consolidation swarm
- `persisted trace / takeover / close / settlement adjacency`
- `SWARM-004L+` 或任何新的 `SWARM-004*` 续号
- auto-merge / bypass review / broad authority

### 2. 当前假设

1. `SWARM-001` 与 `SWARM-002` 已经提供 admission / artifact / handoff 的最小 truth
2. `leadered + review-first + artifact-first + default-off` 仍然是总边界
3. verification lane 继续从现有 `runThread / runtime event / operator/debugger surface` 派生
4. verifier disagreement 可以解释为什么进入 rework 或 human review，但不能被扩成 shared detail parity
5. verification 不替代人工 judgement，也不等于对外 commitment / auto-send / official write

### 3. 产品原则与优先级映射

显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_PLAN_V1.md`
- `docs/reviews/HELM_V2_1_SWARM_PRODUCTIVITY_EXECUTION_CHECKLIST_V1.md`
- `docs/reviews/HELM_V2_1_SWARM_PRODUCTIVITY_ISSUE_TEMPLATES_V1.md`

这条线接到的真实业务闭环是：

- `read-only worker artifact / handoff packet -> verification merge lane -> merge / rework / human review -> bounded promotion`

它服务的是：

- 决策
- 执行准备
- 审计
- 复核

为什么现在做，而不是继续扩面：

1. SWARM re-baseline 已经把 verification 明确迁回 `SWARM-003`
2. 如果没有独立 plan 和 guard，同一批工作很容易再次漂到 `SWARM-004`
3. docs/guards sync 是当前最小可验证切片，不会提前碰 runtime / actions / UI / tests

### 4. 当前切片

这一轮只落 4 件事：

1. 新增 `HELM_V2_1_SWARM_003_VERIFICATION_MERGE_LANES_PLAN_V1.md`
2. 更新 `PLANS.md` 的 `SWARM-003` 入口
3. 更新 `docs/README.md` 索引
4. 新增一条 narrow self-check 和一条 narrow boundary-check

这轮 docs/guards sync 不改：

- runtime contract
- server actions
- UI surface
- tests

如果后续进入实现，才再评估是否需要进入：

- `lib/helm-v2/run-thread-contract.ts`
- `lib/helm-v2/operator-debugger-read-model.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `features/meetings/meeting-v2-runtime-card.tsx`

### 5. 建议读口收口

后续 `SWARM-003` 真正进入实现时，读口只应回答三件事：

1. 当前结果是 `mergeable / rework_required / human_review_required` 的哪一种
2. 导致这个 posture 的核心 evidence 是什么
3. 下一步是 merge、回到 rework，还是进入 human review

故意不让 `SWARM-003` 继续回答：

- run graph / budget / breaker / pause / resume / kill
- candidate consolidation queue posture
- shared persisted trace parity
- takeover / remediation parity
- close / settlement adjacency

这样做的目的，是把 `SWARM-003` 固定成 verification merge lane，而不是新的 shared runtime umbrella。

## 受影响组件

当前 docs/guards sync 只影响：

- `PLANS.md`
- `docs/README.md`
- `docs/reviews/HELM_V2_1_SWARM_003_VERIFICATION_MERGE_LANES_PLAN_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

后续若进入真正实现，再评估 runtime / operator / debugger 的最小读口改动。

## 权衡

### 为什么先做 docs/guards sync，不直接改 runtime

因为这轮最核心的问题是工作流 ownership 已经 re-baseline，但仓库入口和 guard 还没有同步。如果这时直接进 runtime 改动，会继续把 `SWARM-003`、`SWARM-004` 和 shared adjacency 混在一起。

### 为什么把 verifier disagreement 收窄为 merge-lane evidence

因为 disagreement 本身当然属于 verification truth，但一旦它继续扩成 persisted trace / parity family，就会重新碰到 `SWARM-006+` 一类 shared adjacency 问题，`SWARM-003` 会再次失焦。

### 为什么明确禁止 `SWARM-004L+`

因为 suffix train 会继续模糊 owner。`SWARM-003`、`SWARM-004`、`SWARM-005` 现在都已经有明确边界，后续工作要么回到主编号，要么新开 backlog。

## 风险

1. 如果 merge lane 与 provenance / trace wording 继续混写，`SWARM-003` 还会重新吸收 shared adjacency
2. 如果 `SWARM-004` parked / narrow 的表述不够硬，后续 PR 仍可能把 operator control 和 verification 混做
3. 当前只是 docs/guards sync，还没有真正 merge lane runtime 证据
4. 如果后续实现不继续引用 issue template / checklist，指标与验收口径可能再次漂移

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

1. `SWARM-003` 当前只有 plan / index / guard truth，还没有 runtime merge lane 实现
2. self-check / boundary-check 只能约束入口和 wording，不能替代实现验证
3. 如果不继续保持 `SWARM-004` parked / narrow，后续编号还可能再次漂移

## 下一步建议

1. 后续 `SWARM-003` 只继续做 `mergeable / rework_required / human_review_required`、review-first merge guard 和 human review gate
2. `SWARM-004` 继续按 `parked / narrow` 的原始 operator control surface 理解
3. 任何 `persisted trace / takeover / close / settlement adjacency` 工作都不要再写成 `SWARM-003` 或 `SWARM-004L+`
4. 真正进入实现前，先确认 `SWARM-001` 与 `SWARM-002` 的 accepted truth 没有回退
