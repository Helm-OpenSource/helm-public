---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Remaining Service Governance And Webhook Callback Anomaly Baseline V1

更新时间：2026-04-06

## 已经完整成立

- `recordRevenueAttribution` actual ledger write now re-checks contribution-registry governance when actor context is present
- `reverseRevenueAttributionEntry` now re-checks contribution-registry governance before reversal write
- manual settlement reversal now threads actor governance into revenue attribution reversal
- public program catalog no longer bootstraps an arbitrary workspace when multiple active workspaces exist；只有恰好一个 active workspace 时才允许 foundation bootstrap
- `identity-resolution.service` now re-checks workspace import governance across resolve/read/match/write paths when the flow is user-initiated, while system-initiated import follow-through remains explicitly bounded
- `resolveImportConflict` now re-checks import conflict ownership and linked import-item ownership before any follow-up write or normalized-payload recovery
- org-admin support-pack now exposes `identityMatchWriteCount30d` / `identityMatchNeedsReviewCount30d` and the latest identity-match marker as tenant-scoped import follow-through truth

## 已成形但仍需下一层

- remaining non-route tenant-sensitive service inventory 仍未完全收口
- `program-catalog` 仍没有 explicit host-workspace model；当前只是避免 multi-tenant 下的 arbitrary bootstrap
- `tenant isolation` 仍主要依赖 application-layer `workspace` scoping

## 刻意未做

- full RBAC
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- execution-authority expansion

## 风险项

- revenue-attribution / program-catalog 的 deeper service seam 仍未全部收口
- public catalog 在 multi-workspace 情况下现在会返回 `null`，这是更安全的当前态，但不是长期 host-workspace 方案
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
