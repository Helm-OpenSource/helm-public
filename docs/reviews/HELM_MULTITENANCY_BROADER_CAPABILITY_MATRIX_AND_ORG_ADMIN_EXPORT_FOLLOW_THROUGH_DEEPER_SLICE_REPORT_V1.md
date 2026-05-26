---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Broader Capability Matrix And Org Admin Export Follow-through Deeper Slice Report V1

## 1. 结论

PR47 把 Helm 当前主干的多租户 / 多用户控制面，从“connector / import ingress capability guard + connector/import follow-through governance snapshot + capability-aware ingress posture”收紧到了“settings governance write path capability unification + billing/registry/portal/settlement follow-through support-pack + capability-aware manage/read-only posture”的第六层可冻结版本。

当前这轮已经完整成立：

- settings 内 billing / contribution registry / participant portal / manual settlement 高风险治理写路径已统一回到 fixed-role capability helper
- org-admin governance summary 已能输出 billing / registry / participant portal / settlement follow-through
- settings 已具备 capability-aware manage/read-only posture

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- finance or marketplace platform
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Settings governance write path capability unification

- 新增 `lib/auth/billing-governance.ts`
- 新增 `lib/auth/revenue-governance.ts`
- `features/settings/actions.ts` 现在把 billing / registry / participant portal / manual settlement 的局部 helper 收回统一 capability seam
- `updateCustomEngagementStatusAction` 现在改回 `canManageContributionRegistry`，不再错误落到 manual settlement capability

本轮真实统一的 capability helper 包括：

- `canManageWorkspaceBilling`
- `canManageContributionRegistry`
- `canManageManualSettlement`
- `canManageParticipantPortal`

以及对应 denial messaging：

- `getBillingManagementDeniedMessage`
- `getContributionRegistryManagementDeniedMessage`
- `getManualSettlementManagementDeniedMessage`
- `getParticipantPortalManagementDeniedMessage`

### 2.2 Capability-aware manage/read-only settings posture

- `features/settings/queries.ts` 现在会把：
  - `canManageBilling`
  - `canManageContributionRegistry`
  - `canManageManualSettlement`
  - `canManageParticipantPortal`
  接进 `organizationSummary`
- `features/settings/settings-client.tsx` 现在会把 billing、contributor registry、beneficiary payout profiles、participant portal、manual settlement 和 org-admin support pack 都表达成 capability-aware manage/read-only posture
- capability 不足时这些 surface 会：
  - 显式显示 operator-facing note
  - disable 高风险按钮
  - 保持 review-first，而不是把授权失败伪装成系统错误

### 2.3 Billing / registry / portal / settlement follow-through support-pack

- `lib/auth/org-admin-governance.ts` 现在新增 billing / contribution registry / participant portal / settlement 的 audit action 分组
- `dataGovernanceSummary` 现在新增：
  - `billingActionCount30d`
  - `contributionRegistryActionCount30d`
  - `participantPortalActionCount30d`
  - `settlementActionCount30d`
- `governanceFollowThrough` 现在新增：
  - `latestBillingAudit`
  - `latestContributionRegistryAudit`
  - `latestParticipantPortalAudit`
  - `latestSettlementAudit`
- support-pack route 现在显式带 `Cache-Control: private, no-store, max-age=0`

这让 org-admin support pack 已能把 export / delete / retention / connector / import 之外的 billing / registry / participant portal / settlement follow-through 也读成 tenant-scoped governance snapshot。

## 3. 验证结果

本轮最终已通过：

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

- `npm run test` -> `109 files / 429 tests passed`
- `npm run e2e` -> `21 passed`
- `npm run quality:regression` -> `51 files / 180 tests passed`

验证时沿用主仓库现有环境，并把 `DATABASE_URL` 显式覆盖到 PR47 worktree 本地 sqlite 绝对路径；没有修改主仓库的 `.env` 文件。

## 4. 已成形但仍需下一层

- broader capability matrix 已覆盖 settings 内这批高风险治理写路径，但仍未覆盖全产品剩余所有高风险 write path
- org-admin governance follow-through 已能解释 billing / registry / participant portal / settlement，但还不是完整 tenant governance center
- settings 已具备 capability-aware manage/read-only posture，但还不是完整 tenant-admin console
- tenant isolation 仍主要依赖 application-layer workspace scoping

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- finance or marketplace platform
- cross-tenant support tooling
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

- capability matrix 还需要继续覆盖剩余非 settings / non-memory / non-import 的高风险 write path
- current tenant isolation 仍然主要依赖 workspace scoping
- org-admin support pack 仍是 tenant-scoped governance snapshot，不是完整 governance center
- settings governance 后续若新增写动作但不复用当前 capability seam，权限 drift 会回来

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support-pack follow-through deeper slice
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
