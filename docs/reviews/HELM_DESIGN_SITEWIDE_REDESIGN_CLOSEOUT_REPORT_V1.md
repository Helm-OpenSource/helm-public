---
status: archived
owner: helm-core
created: 2026-04-07
review_after: 2026-10-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM DESIGN SITEWIDE REDESIGN CLOSEOUT REPORT V1

## 1. 本轮完成

PR82 把 shared redesign substrate 扩到了当前仓库所有剩余的 feature-owned product surface，并补齐了 participant portal 的 standalone provider seam。

本轮完成的页面：

- analytics
- CRM import
- role handoff
- trial onboarding
- participant portal
- participant portal onboarding

## 2. 代码与结构改动

- 剩余 6 个 surface 已统一接入：
  - `WorkspaceGuidancePanel`
  - `WorkspaceSurfacePreferences`
  - `workspace-form-assist` 或 `showFormAssist={false}` 的一致结构
- participant portal 与 participant portal onboarding page 现在通过 standalone `WorkspaceUiProvider` 接入 shared preference substrate
- README / docs / guards / pilot-readiness / PLANS 已同步到新的 freeze truth

## 3. 当前 truth

### 已经完整成立

- 当前仓库所有 feature-owned product surface 已进入统一 redesign substrate
- `DESIGN.md` 的 light-first / judgement-first / review-first 语法已成为主干默认表达

### 已成形但仍需下一层

- public entry / demo / setup shell 沿用同一视觉方向，但没有接入 workspace preference substrate
- local preference 仍是 browser-local，而不是 server-synced / cross-device synced

### 刻意未做

- 完整设计系统站点
- workflow automation UI
- server-side preference sync
- drag-and-drop layout builder
- execution-authority expansion

### 风险项

- participant portal 仍是 narrow self-only portal，不等于 finance console
- local preference 仍依赖浏览器本地存储
- 后续如果新增 surface 不接 shared substrate，会重新造成视觉分叉

## 4. 验证结果

- `npm run db:reset`
- `DATABASE_URL="file:./prisma/dev.db" npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL="file:./prisma/dev.db" npm run test`
- `DATABASE_URL="file:./prisma/dev.db" npm run build`
- `DATABASE_URL="file:./prisma/dev.db" npm run e2e`
- `DATABASE_URL="file:./prisma/dev.db" npm run quality:regression`

补充说明：

- PR82 worktree 原先把 `node_modules` 链到 Git 根，Turbopack 不接受跨 root 的 symlink，所以本轮改成 worktree 本地 `npm ci` 后再跑 `build`
- `db:reset` 默认会把 seed 写到 `.env.example` 的 `file:./dev.db`；本轮验证链统一显式绑定到 `file:./prisma/dev.db`，避免 e2e 读到未完成 seed 的数据库

## 5. 结论

PR82 之后，Helm 当前主干可以诚实表达为：

- 当前 feature-owned product surface 已完成 redesign closeout
- 当前不是完整设计系统站点
- 当前不是 workflow automation UI
