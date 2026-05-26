---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Action Governance Deeper Slice Report V1

## 1. 结论

PR51 把 Helm 当前主干的多租户 / 多用户控制面，从“shared workspace-data-governance seam + tenant-scoped record validation + workspace data follow-through readout”继续收紧到了“shared action-governance seam + governed-action follow-through + capability-aware operator posture”的第十层可冻结版本。

当前这轮已经完整成立：

- approvals / recommendations / meetings 里剩余的一批 governed-action 主链路已进入 shared action-governance seam
- approval task 和 meeting action item 这两条高风险对象链路已补 workspace-scoped lookup / assignable-owner validation
- org-admin support-pack 已能输出 action governance follow-through
- approvals / meeting detail / settings governance surface 已能解释 governed action 的 manage / review / read-only posture

当前这轮仍然刻意不做：

- full approval platform
- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Shared action-governance seam

- 新增 `lib/auth/action-governance.ts`
- 新增 `lib/auth/action-governance.test.ts`
- `lib/auth/authorization.ts` 新增：
  - `workspace.manage_governed_actions`
  - `workspace.review_governed_actions`

当前真实统一的 helper 包括：

- `canManageWorkspaceGovernedActions`
- `canReviewWorkspaceGovernedActions`
- `getGovernedActionManagementDeniedMessage`
- `getGovernedActionReviewDeniedMessage`

角色边界继续保持 fixed-role：

- `OWNER / ADMIN / OPERATOR` 可 manage + review
- `REVIEWER` 可 review
- `BILLING_ADMIN / MEMBER` 不可进入这组高风险动作链路

### 2.2 approvals / recommendations / meetings 已 capability 化

本轮接入的核心路径包括：

- `features/approvals/actions.ts`
- `features/recommendations/actions.ts`
- `features/meetings/actions.ts`

当前真实变化：

- approvals 的 approve / reject / convert manual / enable auto-policy 会先检查 capability，再执行写入
- `approvalTask` 会先按 `{ id, workspaceId }` 做 lookup，避免跨租户 task id 被直接执行
- recommendation-driven action create 已进入 governed-action manage capability
- meetings 的 governed action generate / summary / follow-up / opportunity sync / interview / official follow-through / action item edit 已进入 manage / review seam
- `ownerId` 只有在当前 workspace 里是有效成员时才允许写入

这层变化的目标是减少“知道对象 id 就能带进当前 workspace governed-action 写链路”的风险，同时保持 review-first。

### 2.3 action governance follow-through 已进入 org-admin governance snapshot

`lib/auth/org-admin-governance.ts` 现在新增：

- `ACTION_GOVERNANCE_AUDIT_ACTION_TYPES`
- `actionGovernanceActionCount30d`
- `latestActionGovernanceAudit`

并把以下主动作纳入 tenant-scoped action governance truth：

- `APPROVAL_APPROVED`
- `APPROVAL_REJECTED`
- `APPROVAL_CONVERTED_TO_MANUAL`
- `POLICY_AUTO_EXECUTE_ENABLED`
- `MEETING_ACTION_ITEMS_GENERATED`
- `MEETING_ACTION_ITEM_UPDATED`
- `HELM_V2_HUMAN_ACTION_EXECUTION_*`
- `HELM_V2_OFFICIAL_WRITE_*`
- `HELM_V2_LIMITED_AUTO_*`

这让 support-pack 不再只偏向 settings / import / commercial / workspace data 主链，而是能看见 governed-action 这条真实 follow-through。

### 2.4 approvals / meeting detail / settings surface 已补 capability-aware posture

当前 UI 层真实变化：

- approvals page loader 现在会下发 `actionGovernance`
- approvals client 在无 review / policy capability 时会进入 read-only posture，并禁用高风险按钮
- meeting detail page loader 现在会下发 governed-action posture
- meeting detail client 会在无 manage capability 时禁用 governed action button 和 action-item edit，且显示 denial note
- settings governance surface 现在会显式显示：
  - `canManageGovernedActions`
  - `canReviewGovernedActions`
  - `actionGovernanceActionCount30d`
  - `latestActionGovernanceAudit`

这仍然只是 capability-aware operator posture，不是新的 approval platform，也不是 execution surface。

## 3. 验证结果

本轮最终全量验证已通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

最终结果：

- `npm run test` -> `114 files / 444 tests passed`
- `npm run e2e` -> `21 passed (1.9m)`
- `npm run quality:regression` -> `51 files / 180 tests passed`

注：

- `npm run typecheck` 与 `npm run lint` 均通过
- 非阻塞提示仍在：
  - Prisma `package.json#prisma` deprecation
  - `lib/helm-v2/runtime-upgrade.ts` 的 Babel large-file deopt note
  - Playwright `NO_COLOR/FORCE_COLOR` warning

## 4. 已成形但仍需下一层

- shared action-governance seam 已成立，但 capability matrix 仍未覆盖全产品所有剩余高风险 write path
- support-pack 已能解释 action governance follow-through，但还不是完整 governance center
- approvals / meeting detail / settings governance surface 已能讲清这组 governed-action 主链路，但还不是完整 tenant-admin console
- tenant isolation 仍主要依赖 workspace scoping，不应误写成 storage-level isolation

## 5. 刻意未做

- full approval platform
- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- org hierarchy / shared billing
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader workflow / execution surface
- broader execution authority

## 6. 保留边界

本轮继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 7. 风险与后续

当前主要风险仍然是：

- capability matrix 还需要继续覆盖剩余高风险 write path
- tenant isolation 仍主要依赖 workspace scoping
- org-admin support-pack 仍是 tenant-scoped governance snapshot，不是完整治理中心
- action governance 现在是 deeper slice，不应误写成“审批平台已经完整成立”

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
