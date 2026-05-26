---
status: archived
owner: helm-core
created: 2026-04-12
review_after: 2026-10-09
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reserved Workspace Host Gating Report V1

更新时间：2026-04-12

## 1. 本轮完成内容

- 给 `Workspace` 增加 `workspaceClass / systemKey`，把 `HELM_RESERVED` host identity 显式化
- 增加 `HELM_RESERVED_WORKSPACE_SYSTEM_KEY`、`isHelmReservedWorkspace()` 和 `resolveHelmReservedWorkspace()`
- 将 `resolveProgramCatalogWorkspace()` 改成只解析 Helm reserved host workspace
- 将 `/reports` 的 engineering delivery review 收紧为 reserved-only 渲染
- 将 founder demo seed 标记成 reserved host，并让 trial / settings 新建 workspace 默认落到 `CUSTOMER`

## 2. 本轮变更清单

- schema / migration:
  - `prisma/schema.prisma`
  - `prisma/migrations/202604120001_reserved_workspace_host/migration.sql`
- host identity:
  - `lib/workspace-identity.ts`
  - `lib/workspace-reserved.ts`
- host resolution / reports:
  - `lib/billing/program-catalog.ts`
  - `app/(workspace)/reports/page.tsx`
  - `features/reports/reports-client.tsx`
- workspace creation / seed:
  - `lib/auth/trial-onboarding.ts`
  - `features/settings/actions.ts`
  - `prisma/seed.ts`
- tests / docs / guards:
  - `lib/billing/foundation-service-governance.test.ts`
  - `README.md`
  - `docs/README.md`
  - `scripts/helm-self-check.ts`
  - `scripts/decision-first-boundary-check.ts`

## 3. 本轮没有过度声称的点

- 没有把 settings commercial / participant portal / skill governance 一起并入本轮
- 没有宣称 existing data migration / backfill 已完成
- 没有把 reserved host gating 写成 full RBAC、full multi-tenant host registry 或 complete internal data isolation

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `public program catalog host 现在只解析 Helm reserved workspace`
- `engineering delivery review 现在只在 Helm reserved workspace 渲染`
- `Helm平台` 或其它普通 customer workspace 不再复用 engineering delivery review
- `reserved host gating != full multi-tenant platform`

## 5. 仍属下一层

- reserved workspace data backfill / production migration
- settings commercial / settlement / participant portal host gating
- skill formal review / capability governance plane split
- first-party solution extension registry

## 6. 验证

- `npm run db:generate`
- `npm run test -- lib/billing/foundation-service-governance.test.ts lib/reports/engineering-delivery-review.test.ts`
- 其余整链验证见本轮最终交付说明
