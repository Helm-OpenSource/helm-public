---
status: archived
owner: helm-core
created: 2026-04-07
review_after: 2026-10-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM DESIGN SITEWIDE REDESIGN CLOSEOUT PLAN V1

## 1. 目标

把 shared redesign substrate 扩到当前仓库里所有剩余的 feature-owned product surface，并同步 freeze 文档、索引与守卫。

## 2. 范围

- analytics
- CRM import
- role handoff
- trial onboarding
- participant portal
- participant portal onboarding
- README / docs / guards / pilot-readiness / PLANS

## 3. 关键假设

- public entry / demo / setup shell 已经在现有视觉主线上，无需在本轮重写
- participant portal 可以通过 standalone `WorkspaceUiProvider` 接入 shared preference substrate，而不需要把 portal 并入 workspace shell
- assist 仍必须保持 review-first，不扩 execution authority

## 4. 风险

1. portal surface 如果继续脱离 shared substrate，“全站 redesign” 的 freeze truth 会失真
2. 如果把 form assist 误写成自动动作，会越过 `judgement-first / review-first` 边界
3. 如果 guards 不同步，后续 README / baseline / self-check 会再次出现口径漂移

## 5. 阶段

### Phase 0

- 审计剩余未接入的 feature-owned surface
- 状态：Completed

### Phase 1

- 对剩余 6 个 surface 接入 `WorkspaceGuidancePanel` / `WorkspaceSurfacePreferences`
- 补 participant portal 的 standalone provider seam
- 状态：Completed

### Phase 2

- 新增 baseline / report，并同步 README / docs / self-check / boundary-check / pilot-readiness
- 状态：Completed

### Phase 3

- 运行完整验证链并收口
- 状态：Completed

## 6. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
