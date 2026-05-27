---
status: active
owner: helm-core
created: 2026-04-14
review_after: 2026-07-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm H1 Activation / First Value Batch Plan v1

状态：Planning-only  
Owner：Helm Core  
日期：2026-04-14

> 这份文档把 `Track H1 - Activation / First Value` 进一步压成可实施的 batch 计划。它只服务 current-main 的 `首页 / setup / first-loop / proof readout` 主线，不进入行业对象、enterprise build-out、pricing implementation 或 broader GTM packaging。

## 1. 目标

把当前已经成立但仍需下一层的 H1 三个任务，收成按依赖关系排序的最小实施批次：

1. `H1.1` 登录后首页继续去说教化，直接回到最重要的工作
2. `H1.2` 压实 `/setup -> dashboard` 的 first-loop handoff
3. `H1.3` 补 activation / review / proof 的最小 readout

这条线只回答：

- returning 用户回来后首页是否更快进入工作
- new 用户是否更快从 setup 进入 first loop
- 团队是否能更清楚地看到 activation / review / write-back 是否真的发生

## 2. 当前基础

current-main 已经具备以下基础：

- dashboard 首屏已有 `Home work entry` block  
  见 [features/dashboard/home-work-entry.ts](../../features/dashboard/home-work-entry.ts:1)
- setup 完成后已有 `setup-first-loop` handoff  
  见 [features/dashboard/setup-first-loop-handoff.ts](../../features/dashboard/setup-first-loop-handoff.ts:1) 与 [features/settings/setup-wizard.tsx](../../features/settings/setup-wizard.tsx:246)
- shared first-loop read model 已成立  
  见 [lib/operating-system/first-loop.ts](../../lib/operating-system/first-loop.ts:1)
- diagnostics 已有按用户聚合的 first-loop adoption readout  
  见 [features/diagnostics/first-loop-adoption.ts](../../features/diagnostics/first-loop-adoption.ts:1)
- 首页和 first-loop 的现有 freeze 结论已成立  
  见 [HELM_FIRST_LOOP_AND_HOME_SURFACE_FREEZE_REPORT_V1.md](./HELM_FIRST_LOOP_AND_HOME_SURFACE_FREEZE_REPORT_V1.md:1)

当前不成立的仍然是：

- dedicated home arbitration engine
- dedicated first-loop session object
- 更硬的首页排序 contract
- 更明确的 activation / proof readout contract

## 3. 架构判断

### 3.1 不新增 schema / runtime plane

H1 不应该通过新增 schema、事件表或独立 first-loop runtime 来解决问题。  
这条线应继续建立在现有：

- `WorkspaceFirstLoopModel`
- `DashboardHomeWorkEntryModel`
- diagnostics adoption summary
- current audit-backed proxy actions

之上。

### 3.2 先收紧 arbitration，再增强 readout

顺序必须是：

1. 先让首页 work-entry contract 更稳
2. 再让 setup handoff 更短更硬
3. 最后让 activation / proof 指标更可读

不要反过来先做 analytics，因为首页和 handoff contract 没收稳，readout 只会放大噪声。

### 3.3 继续坚持 current-main 边界

H1 实施时继续保持：

- recommendation != commitment
- review-before-commitment
- no auto-send
- no broader workflow control
- no industry-specific object introduction

## 4. Batch 列表

## Batch A：Home Work-Entry Arbitration Hardening

**目标**  
继续压实登录后首页首屏，让它更稳定地服务 `Top 1-3 work items / Needs Your Review / Resume / Continue / light blockers`，并减少解释层对首屏的竞争。

**依赖**  
无

**范围**

- [features/dashboard/home-work-entry.ts](../../features/dashboard/home-work-entry.ts:1)
- [features/dashboard/home-work-entry-surface.tsx](../../features/dashboard/home-work-entry-surface.tsx:1)
- [features/dashboard/page-loader.ts](../../features/dashboard/page-loader.ts:1)
- [features/dashboard/home-work-entry.test.ts](../../features/dashboard/home-work-entry.test.ts:1)
- 视需要薄改 [features/dashboard/goal-driven-home-surface.tsx](../../features/dashboard/goal-driven-home-surface.tsx:1)

**Acceptance criteria**

- `empty-new / first-loop / returning-active / review-heavy` 四种首页状态排序依据更清楚
- 首屏 work-entry block 不被更重的 goal-driven / operating / reporting context 重新抢回主位
- review-heavy 状态下 `Needs Your Review` 真正更靠前，而不是继续和普通工作项平权
- returning 状态下 `Resume` 不退化成普通导航链接

**Verification**

- `npm run test -- features/dashboard/home-work-entry.test.ts`
- representative manual check: dashboard 首屏状态切换仍符合当前设计基线

**Estimated scope**

- Medium

## Batch B：Setup -> Dashboard First-Loop Handoff Tightening

**目标**  
继续收紧 setup 完成后的 handoff，让新用户更快落到第一条真实 signal 和 reviewable next step，而不是停在“setup 已完成”的解释层。

**依赖**

- Batch A

**范围**

- [features/dashboard/setup-first-loop-handoff.ts](../../features/dashboard/setup-first-loop-handoff.ts:1)
- [features/dashboard/setup-first-loop-handoff.test.ts](../../features/dashboard/setup-first-loop-handoff.test.ts:1)
- [features/settings/setup-wizard.tsx](../../features/settings/setup-wizard.tsx:1)
- [app/setup/page.tsx](../../app/setup/page.tsx:1)
- 视需要薄改 [lib/operating-system/first-loop-query.ts](../../lib/operating-system/first-loop-query.ts:1)

**Acceptance criteria**

- setup 完成后的 primary move 更像“进入第一条 signal”，而不是“继续读 setup 解释”
- handoff copy 更短、更动作导向，不重复首页已有解释
- `showSeparateSignalAction` 只在确有必要时出现，避免 setup handoff 重新长成多入口卡
- `setup-first-loop` 入口不与 returning anchor 冲突

**Verification**

- `npm run test -- features/dashboard/setup-first-loop-handoff.test.ts`
- representative manual check: setup 完成后 dashboard 首屏仍优先进入第一条 bounded next step

**Estimated scope**

- Small to Medium

## Batch C：Activation / Review / Proof Readout Tightening

**目标**  
在不扩成广义 analytics 的前提下，把 first-loop activation / review / write-back 的 readout 收得更可读，用于产品判断和 pilot proof。

**依赖**

- Batch B

**范围**

- [features/diagnostics/first-loop-adoption.ts](../../features/diagnostics/first-loop-adoption.ts:1)
- [features/diagnostics/first-loop-adoption.test.ts](../../features/diagnostics/first-loop-adoption.test.ts:1)
- [features/diagnostics/diagnostics-client.tsx](../../features/diagnostics/diagnostics-client.tsx:1)
- [features/analytics/queries.ts](../../features/analytics/queries.ts:1)
- [features/analytics/analytics-client.tsx](../../features/analytics/analytics-client.tsx:1)
- 视需要薄改 [features/reports/reports-client.tsx](../../features/reports/reports-client.tsx:1)

**Acceptance criteria**

- readout 能更清楚区分：
  - handoff entered
  - primary action opened
  - anchor saved / resumed
  - review completed
  - write-back confirmed
- diagnostics 可以更直接回答“当前用户或 workspace 卡在哪一步”
- analytics / reports 只补最小 supporting readout，不扩成 broad tracking matrix
- proof wording 明确这是 proxy / readout，不误写成 canonical business success

**Verification**

- `npm run test -- features/diagnostics/first-loop-adoption.test.ts`
- representative manual check: diagnostics / analytics / reports 的 first-loop readout 保持 support-only posture

**Estimated scope**

- Medium

## Checkpoint：After Batch A-C

- `dashboard` 首屏更像工作恢复面，而不是系统说明面
- setup handoff 更短，且不再和首页抢解释权
- first-loop adoption/proof readout 更清楚，但仍是 support-only
- recommendation / commitment 边界没有变弱

## 5. 文件可能涉及面

### 直接实现面

- `features/dashboard/home-work-entry.ts`
- `features/dashboard/home-work-entry-surface.tsx`
- `features/dashboard/page-loader.ts`
- `features/dashboard/setup-first-loop-handoff.ts`
- `features/settings/setup-wizard.tsx`
- `features/diagnostics/first-loop-adoption.ts`
- `features/diagnostics/diagnostics-client.tsx`
- `features/analytics/queries.ts`
- `features/analytics/analytics-client.tsx`

### 直接测试面

- `features/dashboard/home-work-entry.test.ts`
- `features/dashboard/setup-first-loop-handoff.test.ts`
- `features/diagnostics/first-loop-adoption.test.ts`

### 只读依赖面

- `lib/operating-system/first-loop.ts`
- `lib/operating-system/first-loop-query.ts`
- `lib/operating-system/goal-driven-home.ts`
- `docs/product/HELM_FIRST_LOOP_PRD_V1.md`
- `docs/product/HELM_HOME_SURFACE_RULES_V1.md`

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 首页排序继续不准 | 首屏 trust 下降 | 先只调 arbitration 规则，不同时改太多展示层 |
| setup handoff 和 returning anchor 冲突 | 新用户与老用户路径混乱 | Batch B 单独验证 `entry=setup-first-loop` posture |
| diagnostics readout 被误用成业务结果证明 | 对外 overclaim | 文案显式保持 `proxy / support-only / readout` |
| H1 顺手扩成 analytics 重构 | 范围失控 | Batch C 严格只补 first-loop activation/proof 最小读数 |
| 首页继续长回说明页 | 高频可用性下降 | 保持 why/evidence/memory 后置到 detail / disclosure |

## 7. 刻意不做

- 不改公开首页 hero / acquisition copy
- 不做 design partner 包装本身
- 不做 pricing hypothesis
- 不做 industry landing
- 不做 enterprise requirement inventory
- 不做 first-loop 专用 schema / event table
- 不做 broader analytics matrix

## 8. 建议执行顺序

建议直接按一个 2 周 batch 执行：

### Week 1

- Batch A
- Batch B

### Week 2

- Batch C
- 文档 / 守卫 / 回归补齐

## 9. 建议验证切片

最小验证：

```bash
npm run self-check
npm run check:boundaries
npm run test -- features/dashboard/home-work-entry.test.ts
npm run test -- features/dashboard/setup-first-loop-handoff.test.ts
npm run test -- features/diagnostics/first-loop-adoption.test.ts
```

如果批次顺利，再补：

```bash
npm run typecheck
npm run lint
npm run test
```

## 10. 下一步建议

H1 真进入实现时，建议只先开一个 PR batch：

1. `Batch A + Batch B`
2. 验证 dashboard / setup 主线没有回退
3. 再开 `Batch C`

不要三批同时动手。
