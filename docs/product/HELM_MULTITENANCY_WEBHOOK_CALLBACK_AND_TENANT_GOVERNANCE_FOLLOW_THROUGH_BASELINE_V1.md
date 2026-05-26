---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Webhook Callback And Tenant Governance Follow-Through Baseline V1

更新时间：2026-04-05

## 已经完整成立

- Stripe / Alipay / WeChat Pay webhook callback 已具备 tenant governance follow-through：verification failure、duplicate chain、unresolved hint、mapped exception 和 resolved workspace truth 已被明确拆开
- webhook callback event substrate 已成立；`payment-webhook-callback-store` 会记录 `RECEIVED`、`VERIFICATION_FAILED`、`UNRESOLVED`、`UNSUPPORTED`、`EXCEPTION`、`RESOLVED` 等治理状态，不再把 callback follow-through 混成 billing sync 的隐式副作用
- 第一批 tenant-sensitive non-route service write 已纳入 capability governance：billing integration、weekly report generation、capture session、recommendation generation / feedback、CRM import / conflict resolution
- org-admin support pack 与 settings governance surface 已能显示 webhook duplicate chain、hinted unresolved callback、mapped callback exception 的 30d follow-through readout，并继续保留 `workspace` isolation assertion
- export / delete / retention 的治理 truth 继续保持 `workspace-scoped`；webhook unresolved callback 只保留在外部 callback truth，不进入 workspace audit truth

## 已成形但仍需下一层

- broader non-route sensitive write inventory 还没有完整冻结；PR55 只收回了第一批 high-risk service seam
- webhook callback authenticity / tenancy anomaly 现在已有 follow-through truth，但还不是完整 callback governance center 或 replay defense platform
- export / delete / retention 当前是 owner attribution、latest marker、follow-through counter 和 isolation assertion 的 deeper readout，不是完整 retention policy engine
- tenant isolation 仍主要依赖 application-layer `workspace` scoping，不是 schema-per-tenant / db-per-tenant

## 刻意未做

- full RBAC / custom role builder
- SSO / SCIM / enterprise IAM
- org hierarchy
- schema-per-tenant / db-per-tenant
- full tenant-admin governance center
- payment platform broad化到 callback / lifecycle sync 之外
- execution authority expansion

## 风险项

- webhook callback 仍属于外部 provider callback 例外，不适用 session-backed tenant ownership 口径
- unresolved callback hint 现在已被诚实保留在 workspace audit truth 之外；如果后续要把这层升级成 operator action，需要单独设计 exception remediation，不应顺手写成“自动修复”
- broader non-route write seam 仍有下一层 inventory 工作，不能把 PR55 写成“所有 service write 都已治理完成”

## 当前边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
