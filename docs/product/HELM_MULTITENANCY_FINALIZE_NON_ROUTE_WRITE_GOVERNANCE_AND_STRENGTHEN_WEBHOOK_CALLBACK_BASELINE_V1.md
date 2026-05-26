---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Finalize Non-Route Write Governance And Strengthen Webhook Callback Baseline V1

更新时间：2026-04-06

## 已经完整成立

- PR57 本轮新增的 remaining non-route tenant-sensitive service governance 已经成立：
  - `lib/memory/correction.service.ts`
  - `lib/imports/index.ts`
  - `lib/policies/engine.ts`
- `correction.service` 的 `confirm / correct / invalidate / delete` 已补 `assertWorkspaceMemoryServiceAccess`，不再只依赖 route 层 capability guard
- `imports/index.ts` 的 `runCsvImport` 已补 `assertWorkspaceImportServiceAccess`，CSV import service write 不再绕过 service-governance seam
- `policies/engine.ts` 已按动作类型补 capability re-check：
  - `assertWorkspaceGovernedActionManagementServiceAccess`
  - `assertWorkspaceGovernedActionReviewServiceAccess`
  - `assertWorkspacePolicyServiceAccess`
- `org-admin support-pack / settings governance` 现在能显示最新的：
  - webhook duplicate callback
  - hinted verification failure
  - hinted unresolved callback
  - mapped callback exception
- external callback anomaly 仍保持为 external callback governance truth；只有 tenant mapping 成功并进入 workspace business write 后，才进入 workspace-scoped audit truth

## 已成形但仍需下一层

- remaining non-route tenant-sensitive service inventory 仍未完全收口；本轮没有把所有 inventory 项都写成已治理完成
- `org-admin support-pack` 对 `retention / delete / export` 的表达仍偏 governance snapshot，不是完整 policy engine 或 tenant-admin governance center
- tenant isolation 仍主要依赖 application-layer `workspace` scoping，不是 `schema-per-tenant / db-per-tenant`

## 刻意未做

- full RBAC
- SSO / SCIM / enterprise IAM
- org hierarchy
- schema-per-tenant / db-per-tenant
- execution-authority expansion

## 风险项

- `lib/billing/revenue-attribution.ts`、`lib/billing/program-catalog.ts`、`lib/imports/identity-resolution.service.ts` 仍属于下一层 remaining service seam
- webhook callback 仍是外部 callback 例外，不适用 session-backed tenant ownership truth
- unresolved / verification-failed callback 即使携带 workspace hint，也只能作为 external anomaly signal，不能直接写成 workspace audit truth

## 当前边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
