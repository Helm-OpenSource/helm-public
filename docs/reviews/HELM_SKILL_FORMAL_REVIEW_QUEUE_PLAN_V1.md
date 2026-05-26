---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM Skill Formal Review Queue Plan V1

状态：Implemented  
Owner：Helm Core  
日期：2026-04-09

## 1. 目标

PR113 只做一条更稳的 skill capability next layer：

`candidate capability -> calibrated promotion -> manual formal review queue`

它的目标不是让 Helm 自动长出 formal skill，而是让 operator 更清楚地看到：

1. 这条候选能力现在处在哪个校准阶段
2. 它为什么能进或不能进 formal review queue
3. 入队之后仍然只是人工评审项，不是 execution authority

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_SKILL_SUGGESTION_BASELINE_V1.md`
- `docs/product/HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`
- `docs/product/HELM_MULTITENANCY_INSIGHT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

本轮建立在这些已成立 seam 上：

- `SkillSuggestion` 与 `CapabilityCatalogEntry` 已成立
- settings policies 已有 operator governance surface
- dashboard 已有 evolution preview surface
- workspace policy governance、ownership assertion、audit / analytics / notification 已成立

## 3. 范围

### In Scope

- 为 `SkillSuggestion` 新增 formal review 状态字段
- 把晋级逻辑改成 calibration-driven signal
- 新增 queue / return-hardening service、action 与 API route
- 在 settings policies 增加 formal review queue 区块
- 在 dashboard evolution 增加 formal review queue preview
- 同步 docs / guards / tests / validation

### Out of Scope

- formal skill auto-promotion
- static skill catalog auto-write
- worker routing / worker binding expansion
- customer-facing auto-send
- commitment auto-write
- broader skill console / marketplace

## 4. 任务拆解

### Task 1 - calibration and storage

目标文件：

- `prisma/schema.prisma`
- `lib/evolution/skill-suggestion.service.ts`

本任务只做：

- 新增 `formalReviewStatus / formalReviewQueuedAt / formalReviewSummary`
- 让晋级信号读取 `calibration score + evidence + revalidation + adoption + dismissal + boundary incident`
- 只在 capability catalog 层更新 `candidate_skill / probationary_skill`

### Task 2 - manual formal review queue write path

目标文件：

- `app/api/evolution/skill-suggestions/[id]/queue-formal-review/route.ts`
- `app/api/evolution/skill-suggestions/[id]/return-hardening/route.ts`
- `features/settings/actions.ts`

本任务只做：

- queue 只允许 `formal review ready` 项进入
- return-hardening 只把 item 退回候选/观察层，不做 formal skill rollback
- 所有 write path 继续复用 `canManageWorkspacePolicies` + ownership + audit / event / notification

### Task 3 - operator surface

目标文件：

- `features/settings/settings-client.tsx`
- `features/settings/queries.ts`
- `app/(workspace)/dashboard/page.tsx`

本任务只做：

- 在 recently adopted capabilities 中显示 calibration signal
- 新增 formal review queue 卡片
- dashboard 只前置最新 queue item，不把它写成 autonomous promotion

### Task 4 - docs, guards and tests

目标文件：

- `README.md`
- `docs/README.md`
- `PLANS.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- 对应 route / service tests

## 5. Done 定义

本轮完成后，repo 里应该同时成立：

1. calibration-driven promotion 已落在运行时代码
2. formal review queue 已有 settings/dashboard/operator readout
3. queue / return-hardening 已有 policy-governed write path
4. README / docs / guards / tests / validation 已同步

## 6. 风险降级规则

- 只要 queue item 在任何页面里被写成“已成为正式能力”，一律降级并修正文案
- 只要任何 write path 缺 ownership 或 governance guard，一律视为未完成
- 只要 formal review queue 被接成 automatic promotion lane，一律视为越界
