---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# PR47 - Broader Capability Matrix And Org Admin Export Follow-Through Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：把 settings 内剩余的高风险治理写路径补成 capability-aware posture，并把 org-admin support pack 扩到 billing / registry / participant portal / settlement follow-through

## 1. 目标

PR47 继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

本轮只做三件事：

1. 把 settings 内仍然停留在局部 helper 的高风险治理写路径补成统一 capability helper
2. 把 billing / contribution registry / participant portal / manual settlement 的 manage posture 真正暴露到 settings surface，避免只有 server 端硬失败
3. 把 org-admin governance support pack 扩到 billing / registry / participant portal / settlement follow-through，让 tenant-scoped export / retention / support-pack truth 更完整

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- memory、program、connector、import 的第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- retention / export / delete / auth-session / connector / import posture 已有 tenant-scoped readout

当前仍需下一层：

- settings 里的 billing / contribution registry / participant portal / manual settlement 虽然已有 server-side capability guard，但 manage posture 没有完整暴露到 UI
- org-admin governance summary 还没有把 billing / registry / participant portal / settlement 的 30d follow-through 补齐
- support pack 还没有把这些高风险治理域作为单独 follow-through truth 输出
- 用户指令里出现了一句“continuity surface”，这是沿用旧模板的残留表达；本轮按其余明确范围执行多租户 / 多用户治理 deeper slice，而不是继续 continuity 线

## 3. 范围

- `lib/auth/authorization.ts`
- `lib/auth/billing-governance.ts`（新增）
- `lib/auth/revenue-governance.ts`（新增）
- `lib/auth/org-admin-governance.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `features/participant-portal/actions.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- continuity surface 深挖
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 settings 继续只靠 server-side 拒绝，而不显式暴露 manage posture，operator 会把 capability 拒绝误读成系统错误
2. 如果 support pack 继续只统计 memory / connector / import，不补 billing / registry / participant portal / settlement，tenant-scoped governance truth 仍然不完整
3. 如果为了“更完整”顺手引入新的 role model 或 enterprise IAM，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 为 billing / contribution registry / participant portal / manual settlement 建立统一 capability helper
- 用 helper 替换 settings / participant-portal 的局部判断

### Phase 2

- 在 settings query / client 暴露 capability-aware posture
- 补齐 read-only / review-first UI 表达，并收口高风险按钮的禁用条件

### Phase 3

- 扩 org-admin governance summary / support pack
- 加入 billing / registry / participant portal / settlement 的 30d 计数与 latest marker

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
