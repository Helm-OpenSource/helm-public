---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM Skill Formal Review Decision Workflow Plan V1

状态：Implemented  
Owner：Helm Core  
日期：2026-04-09

## 1. 目标

PR114 只做一条更稳的 manual governance next layer：

`candidate capability -> calibrated promotion -> manual formal review queue -> formal review decision workflow`

它的目标不是让 Helm 自动完成 formal promotion，而是让 operator 更清楚地看到：

1. queue item 已被谁评审
2. 当前是 `APPROVED_PENDING_PROMOTION / DEFERRED / REJECTED` 中的哪一种决定
3. 当前 checklist 是否已经覆盖 catalog、tests、guards、docs 和 boundary
4. 这仍然只是人工治理记录，不是 formal skill，也不是 execution authority

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_SKILL_SUGGESTION_BASELINE_V1.md`
- `docs/product/HELM_SKILL_FORMAL_REVIEW_QUEUE_BASELINE_V1.md`
- `docs/product/HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`
- `docs/product/HELM_MULTITENANCY_INSIGHT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

本轮建立在这些已成立 seam 上：

- `SkillSuggestion`、`CapabilityCatalogEntry` 与 calibration-driven promotion 已成立
- manual formal review queue 已成立
- workspace policy governance、ownership assertion、audit / analytics / notification 已成立
- settings policies 与 dashboard evolution 已有 operator surface

## 3. 范围

### In Scope

- 为 `SkillSuggestion` 新增 formal review decision / checklist fields
- 新增 approve / defer / reject service、action 与 API route
- 在 settings policies 增加 queued item decision form 与 recent formal review decisions
- 在 dashboard evolution 增加 recent formal review decision preview
- 让 reject / return 进入 calibration 的 boundary incident 计数
- 同步 docs / guards / tests / validation

### Out of Scope

- formal promotion helper
- formal skill auto-promotion
- static skill catalog auto-write
- worker routing / worker binding expansion
- customer-facing auto-send
- commitment auto-write
- broader skill marketplace / orchestration plane

## 4. 任务拆解

### Task 1 - decision storage and review ledger

目标文件：

- `prisma/schema.prisma`
- `lib/evolution/skill-suggestion.service.ts`

本任务只做：

- 新增 `formalReviewDecision / formalReviewDecisionBy* / formalReviewDecisionNote / formalReviewChecklistJson`
- 只把决定记录在 `SkillSuggestion`，不直接写入 formal skill catalog
- 让 reject / return 继续反馈到 calibration signal

### Task 2 - decision write path

目标文件：

- `app/api/evolution/skill-suggestions/[id]/approve-formal-review/route.ts`
- `app/api/evolution/skill-suggestions/[id]/defer-formal-review/route.ts`
- `app/api/evolution/skill-suggestions/[id]/reject-formal-review/route.ts`
- `features/settings/actions.ts`

本任务只做：

- approve 只能发生在 queued item 上，且 checklist 必须完整
- defer / reject 只能发生在 queued item 上，且必须留下 note
- 所有 write path 继续复用 `canManageWorkspacePolicies` + ownership + audit / event / notification

### Task 3 - operator surface

目标文件：

- `features/settings/settings-client.tsx`
- `features/settings/queries.ts`
- `app/(workspace)/dashboard/page.tsx`

本任务只做：

- queued item 显示 checklist、review note 与 approve / defer / reject / return-hardening
- 新增 recent formal review decisions 卡片
- dashboard 只前置 recent formal review decisions，不把它写成 formal promotion lane

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

1. formal review decision workflow 已进入真实运行时
2. approve / defer / reject write path 已有 governance guard
3. settings / dashboard 已有 decision readout
4. README / docs / guards / tests / validation 已同步

## 6. 风险降级规则

- 只要任何页面把 `APPROVED_PENDING_PROMOTION` 写成“已经是 formal skill”，一律降级并修正文案
- 只要任何 write path 缺 ownership 或 governance guard，一律视为未完成
- 只要 formal review decision workflow 被写成 automatic promotion lane，一律视为越界
