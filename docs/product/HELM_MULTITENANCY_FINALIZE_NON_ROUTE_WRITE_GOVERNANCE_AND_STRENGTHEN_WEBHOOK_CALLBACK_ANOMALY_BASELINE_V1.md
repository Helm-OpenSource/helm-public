---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Finalize Non-Route Write Governance And Strengthen Webhook Callback Anomaly Baseline V1

更新时间：2026-04-06

## 已经完整成立

- 本轮新增的 contribution-registry foundation bootstrap write governance 已成立：
  - `lib/billing/revenue-attribution.ts`
  - `lib/billing/program-catalog.ts`
- user-initiated 的 contribution-registry foundation bootstrap write 现在会先过 `assertWorkspaceContributionRegistryServiceAccess`，再执行 foundation write；不再只依赖更外层的 settings route / action guard
- settings read path foundation bootstrap now carries user actor context：
  - `ensureWorkspaceProgramCatalogFoundation(...)`
  - `getWorkspaceRevenueAttributionSnapshot(...)`
  不再以匿名 foundation bootstrap 的方式静默写入 contribution-registry foundation
- `org-admin support-pack / settings governance` 现在能显示最新的：
  - `latestBillingWebhookHintFallback`
  - `latestBillingWebhookHintMismatch`
- webhook hint fallback / mismatch 继续保持为 external callback governance truth；只有 authoritative tenant mapping 成立后，才进入 workspace-scoped audit truth

## 已成形但仍需下一层

- remaining non-route tenant-sensitive service inventory 仍未完全收口；本轮没有把所有 remaining inventory 项都写成“已治理完成”
- `resolveProgramCatalogWorkspace() 仍保留 global fallback read-path side effect`；这仍是下一层要收的 tenant-smell，不应被写成“foundation 已完全无副作用”
- `revenue-attribution` deeper write seam、`program-catalog` broader service seam、`identity-resolution.service` 仍属于下一层
- webhook callback anomaly route behavior 本轮未扩张；本轮只补了 org-admin follow-through readout，没有把 callback anomaly 治理过度写成已完整成立

## 刻意未做

- full RBAC
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- execution-authority expansion

## 风险项

- contribution-registry foundation bootstrap write 现在在 user actor path 上已补 capability re-check，但 system-owned 或未显式传 actor 的 bootstrap 仍需要继续诚实治理
- tenant isolation 仍主要依赖 application-layer `workspace` scoping，不是基础设施级隔离
- external webhook callback 仍是外部 callback 例外，不适用 session-backed ownership truth

## 当前边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
