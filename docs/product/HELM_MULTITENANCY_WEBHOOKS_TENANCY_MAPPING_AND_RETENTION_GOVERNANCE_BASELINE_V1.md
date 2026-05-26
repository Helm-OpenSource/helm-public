---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Webhooks Tenancy Mapping And Retention Governance Baseline V1

更新时间：2026-04-05

## 已经完整成立

- Stripe / Alipay / WeChat Pay callback 在进入 workspace-scoped billing sync 前，会先完成 provider authenticity 校验和 tenant mapping
- webhook tenant mapping 已区分 authoritative source、hint fallback、hint mismatch 和 unresolved posture，不再把外部 callback 混成 session-backed ownership truth
- Google / HubSpot / Salesforce OAuth callback 这类 GET write path 已统一进入 workspace capability + membership ownership seam
- org-admin support pack 与 settings governance surface 能显示 webhook governance 统计、latest marker、workspace isolation assertions 和 unresolved callback boundary note
- export / delete / retention 相关治理视图继续保持 workspace-scoped truth，并明确 unresolved external callback 不进入 workspace audit truth

## 已成形但仍需下一层

- webhook unresolved / authenticity governance 仍是 narrow callback slice，不是完整 payment callback governance center
- 非 route sensitive write inventory 已开始收敛，但还不是完整 background-write governance map
- tenant isolation 仍主要依赖 application-layer workspace scoping，不是 schema-per-tenant / db-per-tenant

## 刻意未做

- full RBAC
- SSO / SCIM / enterprise IAM
- org hierarchy
- execution authority expansion
- payment platform broadening beyond narrow callback / lifecycle sync

## 风险项

- provider webhook 仍是外部 callback 例外，不适用 session-based tenant ownership 断言
- `paymentCheckoutSessionId` 当前不是唯一键；PR54 通过 conflict-as-unresolved 处理避免静默选错 workspace，但没有顺手改 schema 约束
- non-route tenant-sensitive write inventory 仍需后续更深一层盘点

## 当前边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
