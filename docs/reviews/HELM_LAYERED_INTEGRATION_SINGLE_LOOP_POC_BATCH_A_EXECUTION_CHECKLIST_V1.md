---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_BATCH_A_EXECUTION_CHECKLIST_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-11

## 1. 目的

这份文档执行 `Track G7`，但仍然不进入代码实现。

它只回答：

- 如果未来真的按 `G6` 进入第一批窄实现，`Batch A` 应该按什么顺序开工、先查什么、先跑什么、什么时候必须停手

它不是：

- implementation PR
- 代码设计重写
- runtime substrate 改造
- vendor 接线计划

## 2. 前置文档

本轮显式引用：

- `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ACCEPTANCE_PACK_V1.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_IMPLEMENTATION_FREEZE_V1.md`

本轮只服务一个目标：

- 在不碰 schema、不碰 contract root、不碰 platform layer 的前提下，把 `meeting-led governed follow-up loop` 的 `evidence -> judgement` 链路整理得更清楚

## 3. Batch A 只允许动什么

`Batch A` 的 allowlist 只包括：

- `app/api/runtime/events/meeting-ended/route.ts`
- `features/meetings/queries.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/meetings/meeting-v2-ingestion-retrieval-card.tsx`
- `features/meetings/meeting-v2-opportunity-judge-card.tsx`
- `features/meetings/meeting-v2-draft-comms-card.tsx`
- `lib/helm-v2/connector-ingestion-retrieval-runtime.ts`
- `lib/helm-v2/opportunity-judge-runtime.ts`
- `lib/helm-v2/draft-comms-handoff-runtime.ts`
- `lib/helm-v2/meeting-action-pack-runtime.ts`

不允许碰：

- `prisma/schema.prisma`
- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- Batch B / C 文件
- 任意新平台目录

## 4. 当前工作区预检结论

按 2026-04-11 当前工作区状态，`Batch A` allowlist 中已发现 1 个重叠脏文件：

- `features/meetings/meeting-v2-runtime-card.tsx`

这意味着：

- 如果未来真的开始 `Batch A`，第一步不是改代码，而是先确认这处改动是否已经被主线占用
- 在没有确认 ownership 之前，不能直接动这个文件

当前 `Batch B` allowlist 未发现同类重叠，但这不构成提前开启 `Batch B` 的理由。

## 5. 开工前 Checklist

### 5.1 Worktree preflight

先执行：

```bash
git status --short -- \
  app/api/runtime/events/meeting-ended/route.ts \
  features/meetings/queries.ts \
  features/meetings/meeting-v2-runtime-card.tsx \
  features/meetings/meeting-v2-ingestion-retrieval-card.tsx \
  features/meetings/meeting-v2-opportunity-judge-card.tsx \
  features/meetings/meeting-v2-draft-comms-card.tsx \
  lib/helm-v2/connector-ingestion-retrieval-runtime.ts \
  lib/helm-v2/opportunity-judge-runtime.ts \
  lib/helm-v2/draft-comms-handoff-runtime.ts \
  lib/helm-v2/meeting-action-pack-runtime.ts
```

必须满足：

1. 没有跨主线冲突
2. 没有需要先回滚别人的改动
3. 没有超出 allowlist 的连带修改需求

### 5.2 Boundary preflight

先确认以下 3 条都成立：

1. recommendation 仍然只是 recommendation
2. receipt 不会被写成 outcome success
3. provider 缺失时仍然可以停在 manual / read-only path

只要有一条说不清，`Batch A` 不开工。

### 5.3 Schema / contract preflight

先确认以下文件完全不在本批次：

- `prisma/schema.prisma`
- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/runtime-upgrade.ts`

如果一开始就需要碰它们，说明这不是 `Batch A`。

## 6. 推荐执行顺序

### Step 1

先读：

- `app/api/runtime/events/meeting-ended/route.ts`
- `lib/helm-v2/meeting-action-pack-runtime.ts`

目标：

- 确认 runtime ingress 到 action pack 的最小入口是否已经足够清楚
- 只收口 trigger、ownership、sourcePage、force 行为，不做 runtime substrate 改造

停手条件：

- 需要改全局 runtime contract
- 需要改 checkpoint / replay / upgrade 流程

### Step 2

再读：

- `features/meetings/queries.ts`
- `lib/helm-v2/connector-ingestion-retrieval-runtime.ts`
- `lib/helm-v2/opportunity-judge-runtime.ts`
- `lib/helm-v2/draft-comms-handoff-runtime.ts`

目标：

- 只收口 meeting detail 页面对 evidence、judge、draft 的装配顺序
- 让 read path 更清楚，但不改变 Batch B 的 review / execution 语义

停手条件：

- 需要改 approvals query contract
- 需要改 human action / official write runtime

### Step 3

最后再动页面：

- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/meetings/meeting-v2-ingestion-retrieval-card.tsx`
- `features/meetings/meeting-v2-opportunity-judge-card.tsx`
- `features/meetings/meeting-v2-draft-comms-card.tsx`

目标：

- 只让用户更清楚看到 `evidence -> judgement -> draft`
- 不新增新页面、不重构 shell、不重写 operator surface

停手条件：

- 需要改 meeting detail 页面骨架
- 需要改 approvals surface 或 official write card

## 7. 目标化验证顺序

### 7.1 Targeted tests

先跑：

```bash
npm run test -- \
  lib/helm-v2/connector-ingestion-retrieval-runtime.test.ts \
  lib/helm-v2/opportunity-judge-runtime.test.ts \
  lib/helm-v2/draft-comms-handoff-runtime.test.ts \
  lib/helm-v2/meeting-action-pack-runtime.test.ts
```

### 7.2 Mandatory guards

再跑：

```bash
npm run self-check
npm run check:boundaries
```

### 7.3 Full-chain escalation rule

只有在 `Batch A` 真的进代码实现后，且 targeted tests 都通过，再决定是否补跑：

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

如果只是 planning 文档更新，不需要伪装成已完成完整链路。

## 8. 交付完成定义

未来 `Batch A` 真正完成时，只能宣称这几件事：

1. meeting-led loop 的 evidence -> judgement -> draft 读路径更清楚
2. 仍然没有跨进 review / execution / follow-through 语义
3. provider 缺失时仍可停在 read-only / manual path
4. 没有碰 schema、contracts root、runtime-upgrade

不能宣称：

- 外部 provider 已集成完成
- execution layer 已验证
- governance loop 已完整打通
- layered integration 已进入实施阶段

## 9. 当前阶段结论

`G7` 完成后，这条线仍然是：

- `CONDITIONAL_GO`

但现在多了一个更明确的现实约束：

- 未来如果真的要开工，默认只能先开 `Batch A`
- 而且必须先过 worktree preflight，再按 Step 1 -> Step 2 -> Step 3 走

## 10. 下一步建议

如果继续推进，只应做下面 2 件事之一：

1. 继续停在 planning-only
2. 如果要提前验证，只按这份 checklist 开 `Batch A`，不提前跨进 `Batch B / C`

## 11. 验证

建议验证仍然是：

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

本轮默认至少运行：

- `npm run self-check`
- `npm run check:boundaries`
