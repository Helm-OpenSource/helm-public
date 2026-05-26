---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Action Governance Deeper Slice Baseline V1

## 1. 目的

冻结 Helm 当前主干在多租户 / 多用户第十层治理收紧上的真实边界。

本基线只回答四件事：

1. approvals / recommendations / meetings 这组 governed-action 主链路已统一到哪一层
2. org-admin support-pack 对 action governance follow-through 已成立到哪一层
3. approvals / meeting detail / settings governance surface 的 capability-aware posture 已成立到哪一层
4. 哪些边界仍然必须继续诚实保留

它不是：

- full approval platform
- full RBAC builder
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
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

### 3.1 Shared action-governance seam 已成立

当前 governed-action 这组 tenant-sensitive 主链路已经再收回一层：

- `canManageWorkspaceGovernedActions`
- `canReviewWorkspaceGovernedActions`
- `getGovernedActionManagementDeniedMessage`
- `getGovernedActionReviewDeniedMessage`

对应 capability 已进入 fixed-role matrix：

- `workspace.manage_governed_actions`
- `workspace.review_governed_actions`

角色边界继续保持 fixed-role：

- `OWNER / ADMIN / OPERATOR` 可管理和复核 governed actions
- `REVIEWER` 可复核但不可管理
- `BILLING_ADMIN / MEMBER` 不可进入这组高风险动作链路

### 3.2 approvals / recommendations / meetings 的剩余 governed-action 写路径已 capability 化

本轮已纳入 shared action-governance seam 的主链路包括：

- approvals：
  - approve
  - reject
  - convert to manual
  - enable future auto-policy
- recommendations：
  - create action from recommendation
- meetings：
  - generate post-meeting action items
  - send summary to approvals
  - create follow-up meeting action
  - sync opportunity after meeting
  - create interview action
  - official follow-through review / acknowledge / update
  - meeting action item edit

同时：

- approval task 现在会先做 workspace-scoped lookup，再进入 execute / reject / manual / policy path
- meeting action item owner 现在会显式校验为当前 workspace 的有效成员
- 这条 governed-action 主链继续保持 review-first，而不是扩大自动执行权

### 3.3 org-admin support-pack 已能解释 action governance follow-through

`getOrgAdminGovernanceSummary` 现在新增：

- `actionGovernanceActionCount30d`
- `latestActionGovernanceAudit`

并把以下动作纳入 action governance truth：

- `APPROVAL_APPROVED`
- `APPROVAL_REJECTED`
- `APPROVAL_CONVERTED_TO_MANUAL`
- `POLICY_AUTO_EXECUTE_ENABLED`
- `MEETING_ACTION_ITEMS_GENERATED`
- `MEETING_ACTION_ITEM_UPDATED`
- `HELM_V2_HUMAN_ACTION_EXECUTION_*`
- `HELM_V2_OFFICIAL_WRITE_*`
- `HELM_V2_LIMITED_AUTO_*`

这样 tenant-scoped support-pack 不再只覆盖 settings / import / commercial / workspace data follow-through，而是能看见 governed action 的 review / execute / follow-through 主链路。

### 3.4 approvals / meeting detail / settings surface 已有 capability-aware posture

当前 operator-facing surface 已能直接表达 governed action posture：

- approvals：
  - review-capable 时允许 approve / approve-after-edit / reject / manual convert
  - policy-capable 时才允许 enable auto-policy
  - 否则保持 read-only posture，并显示 denial note
- meeting detail：
  - governed action button 会根据 capability 进入 manage / read-only posture
  - action item edit sheet 会在无权限时保持 disabled + note
- settings governance：
  - 会显式显示 governed action creation / review 是 enabled 还是 read-only
  - 会显示 `actionGovernanceActionCount30d`
  - 会显示 `latestActionGovernanceAudit`

这层变化的目标是避免“server 已拒绝，但 surface 仍假装可操作”的错配。

## 4. 已成形但仍需下一层

- shared action-governance seam 已成立，但 capability matrix 仍未覆盖全产品所有剩余高风险 write path
- support-pack 已能解释 action governance follow-through，但还不是完整 governance center
- approvals / meeting detail / settings surface 已有 capability-aware posture，但还不是完整 tenant-admin console
- tenant isolation 继续保持 application-layer workspace scoping，不应误写成 storage-level isolation

## 5. 刻意未做

本轮刻意未做：

- full approval platform
- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- org hierarchy / shared billing
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- execution-authority expansion

## 6. 风险项

- capability matrix 仍需继续覆盖剩余非 governed-action / non-memory / non-import / non-commercial / non-workspace-data 的高风险 write path
- tenant isolation 仍主要依赖 workspace scoping，不应误写成 storage-level isolation
- support-pack 仍然是 tenant-scoped governance snapshot，不应误写成完整 tenant-admin platform
- governed-action 主链虽然已经 capability 化，但仍不是 full approval platform，也不是自动执行平面

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已具备 `workspace-first / membership-backed` 多租户 / 多用户基础之上的 action governance deeper slice
- Helm 已把 approvals / recommendations / meetings 中一批 tenant-sensitive governed-action 主链路收进 shared capability seam，并把 follow-through 补进 tenant-scoped org-admin support-pack
- Helm 的 approvals / meeting detail / settings surface 已能以 capability-aware、review-first 的方式展示 governed action posture
- Helm 仍不是 full approval platform、不是 full RBAC、不是 enterprise IAM，也没有扩成 execution-authority expansion

## 8. 下一层最该做的事

下一层优先顺序保持为：

1. 覆盖剩余高风险 write path 的 capability matrix
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer only under explicit demand
