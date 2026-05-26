---
status: archived
owner: helm-core
created: 2026-04-06
review_after: 2026-10-03
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Remaining Service Governance And Webhook Callback Anomaly Report V1

更新时间：2026-04-06

## 1. 本轮完成内容

- 为 `revenue-attribution` actual ledger write 补 contribution-registry governance re-check
- 为 `revenue-attribution` reversal write 补 contribution-registry governance re-check
- 把 manual settlement reversal 的 actor governance 显式传入 revenue attribution reversal
- 将 public program catalog 的 workspace bootstrap 收紧为“仅当恰好一个 active workspace 时允许”
- 为 `recordIdentityMatch` write 补 import governance re-check，并把 actor context 从 CRM import orchestrator 显式传到 identity-match write
- 为 `resolveCompanyIdentity / resolveContactIdentity / resolveOpportunityIdentity / resolveMeetingIdentity` 补 import governance re-check
- 为 `resolveImportConflict` 补 import conflict / import item 的 workspace ownership 断言
- 将 identity-match follow-through 接入 org-admin support-pack / settings governance readout

## 2. 本轮变更清单

- revenue attribution:
  - `lib/billing/revenue-attribution.ts`
- manual settlement:
  - `lib/billing/manual-settlement.ts`
- program catalog:
  - `lib/billing/program-catalog.ts`
- CRM import / identity resolution:
  - `lib/imports/crm-orchestrator.service.ts`
  - `lib/imports/identity-resolution.service.ts`
  - `lib/auth/tenant-ownership.ts`
- org-admin governance / settings:
  - `lib/auth/org-admin-governance.ts`
  - `features/settings/settings-client.tsx`
  - `app/api/settings/org-admin/support-pack/route.ts`
- tests:
  - `lib/billing/foundation-service-governance.test.ts`
  - `lib/imports/identity-resolution-governance.test.ts`
  - `lib/imports/crm-orchestrator-governance.test.ts`
  - `lib/auth/org-admin-governance.test.ts`
  - `lib/auth/org-admin-support-pack-route.test.ts`

## 3. 本轮没有过度声称的点

- remaining non-route tenant-sensitive service inventory 仍未完全收口
- public program catalog 还没有 explicit host-workspace model
- external webhook callback 仍是外部 callback 例外
- current tenant isolation 仍主要依赖 application-layer `workspace` scoping

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 5. 仍属下一层

- `revenue-attribution` deeper service seam
- `program-catalog` broader service seam
- webhook callback anomaly 的更深真实性 / exception governance
- infrastructure-level tenant isolation
- full RBAC / SSO / enterprise IAM

## 6. 验证

按仓库标准整链执行：

- `db:reset`：通过
- `self-check`：通过
- `check:boundaries`：通过
- `typecheck`：通过
- `lint`：通过
- `test`：通过，`134 files / 525 tests`
- `build`：通过
- `e2e`：通过，`21 passed`
- `quality:regression`：通过，`51 files / 180 tests`
