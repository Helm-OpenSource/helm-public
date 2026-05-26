---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Substrate Hardening And Polish Plan V1

更新时间：2026-04-07
状态：Completed

## 1. 目标

继续沿 `DESIGN.md` 推进，但这轮不再扩新页面数量，而是收紧两类工作：

1. shared design substrate 本身
2. detail-level polish

## 2. 范围

- `components/providers/workspace-ui-provider.tsx`
- `components/shared/workspace-guidance-panel.tsx`
- `components/shared/workspace-surface-preferences.tsx`
- `components/shared/workspace-form-assist-panel.tsx`
- `app/globals.css`
- `features/settings/setup-wizard.tsx`
- `features/auth/login-panel.tsx`
- `features/imports/crm-import-client.tsx`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 3. 执行步骤

### Phase 0

- 复核 `DESIGN.md`、shared substrate 和高价值 polish target
- 状态：Completed

### Phase 1

- 收紧 shared preferences / responsive / accessibility substrate
- 状态：Completed

### Phase 2

- 打磨 setup wizard、login、CRM import 的 form-assist 与移动端结构
- 状态：Completed

### Phase 3

- 同步 baseline / report / README / docs / guards
- 状态：Completed

### Phase 4

- 跑完整验证链
- 状态：Completed

## 4. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
