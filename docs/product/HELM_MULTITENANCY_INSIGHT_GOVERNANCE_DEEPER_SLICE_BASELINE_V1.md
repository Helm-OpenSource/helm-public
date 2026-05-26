---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Insight Governance Deeper Slice Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第十一层治理收紧上的真实边界。

本基线只回答四件事：

1. weekly report generation、recommendation feedback、strategy suggestion adoption 这组 insight write path 已统一到哪一层
2. org-admin support-pack 对 insight governance follow-through 已成立到哪一层
3. reports / settings surface 的 capability-aware posture 已成立到哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader BI / recommendation platform
- execution-authority expansion

## 2. 当前基线

当前多租户 / 多用户控制面继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

当前租户真值仍然是：

- `Workspace == Organization == current tenant boundary`
- `Membership` 仍然是 user-to-workspace seam
- `AuthSession` 仍然是当前登录 session 真值
- tenant isolation 仍然主要靠 application-layer workspace scoping

## 3. 已经完整成立

### 3.1 Shared insight-governance seam 已成立

当前 insight write 主链路已经再收回一层：

- `canManageWorkspaceInsights`
- `getInsightGovernanceDeniedMessage`

并新增固定 capability：

- `workspace.manage_insights`

角色边界继续保持 fixed-role：

- `OWNER / ADMIN / OPERATOR` 可管理 insight write
- `BILLING_ADMIN / REVIEWER / MEMBER` 不可进入这组 tenant-sensitive insight write 主链路

### 3.2 reports / recommendation feedback / strategy suggestion API write 已 capability 化

本轮已纳入 capability seam 的主链路包括：

- reports：
  - weekly report generation
- recommendations：
  - recommendation feedback submit
  - recommendation feedback API write
- evolution / strategy suggestions：
  - accept route
  - dismiss route

其中：

- weekly report generation 和 recommendation feedback 统一进入 `workspace.manage_insights`
- strategy suggestion accept / dismiss route 对齐到已有 `workspace.manage_policies`
- surface 不再只依赖 login + workspace session，而是显式进入 capability allow / deny

### 3.3 org-admin support-pack 已能解释 insight governance follow-through

`getOrgAdminGovernanceSummary` 现在新增：

- `INSIGHT_GOVERNANCE_AUDIT_ACTION_TYPES`
- `insightGovernanceActionCount30d`
- `latestInsightGovernanceAudit`

并把以下动作纳入 tenant-scoped insight governance truth：

- `WEEKLY_REPORT_GENERATED`
- `RECOMMENDATION_FEEDBACK_SUBMITTED`
- `STRATEGY_SUGGESTION_ACCEPTED`
- `STRATEGY_SUGGESTION_DISMISSED`

这样 support-pack 不再只覆盖 settings / import / commercial / workspace data / governed action follow-through，而是能看见 insight 主链路的真实写面。

### 3.4 reports / settings surface 已有 capability-aware posture

当前 surface 已能直接表达 insight governance posture：

- reports：
  - 无 `workspace.manage_insights` 时，周报生成按钮 disabled
  - 页面会明确显示 read-only insight governance posture 与 denial note
- settings governance：
  - 会显式显示 weekly reports / recommendation feedback 当前是 enabled 还是 read-only
  - strategy suggestion adoption 继续挂在 workspace policy controls 下
  - 会显示 `insightGovernanceActionCount30d`
  - 会显示 `latestInsightGovernanceAudit`

## 4. 已成形但仍需下一层

- shared insight-governance seam 已成立，但 capability matrix 仍未覆盖所有剩余高风险 write path
- support-pack 已能解释 insight governance follow-through，但还不是完整 governance center
- reports / settings surface 已有 capability-aware posture，但还不是完整 tenant-admin console
- tenant isolation 继续保持 application-layer workspace scoping，不应误写成 storage-level isolation

## 5. 刻意未做

本轮刻意未做：

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- org hierarchy / shared billing
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader BI / recommendation platform
- execution-authority expansion

## 6. 风险项

- capability matrix 仍需继续覆盖剩余高风险 write path
- tenant isolation 仍主要依赖 workspace scoping，不应误写成 storage-level isolation
- support-pack 仍然是 tenant-scoped governance snapshot，不应误写成完整 tenant-admin platform
- strategy suggestion adoption 当前只是 tenant-scoped policy-governed write，不应误写成 recommendation platform 已完整成立

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 insight governance deeper slice
- Helm 已把 weekly report generation、recommendation feedback 和 strategy suggestion adoption 这组 tenant-sensitive insight 主链路收进 shared capability seam，并把 follow-through 补进 tenant-scoped org-admin support-pack
- Helm 的 reports / settings surface 已能以 capability-aware、review-first 的方式展示 insight governance posture
- Helm 仍不是 full RBAC、不是 enterprise IAM、不是 schema-per-tenant / database-per-tenant、不是 broader BI / recommendation platform，也没有扩成 execution-authority expansion

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余高风险 write path 的 capability matrix
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer only under explicit demand
