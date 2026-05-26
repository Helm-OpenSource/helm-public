---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Insight Governance Deeper Slice Report V1

## 1. 结论

PR52 把 Helm 当前主干的多租户 / 多用户控制面，从“shared action-governance seam + governed-action follow-through + capability-aware operator posture”继续收紧到了“shared insight-governance seam + insight follow-through + reports/settings read-only posture”的第十一层可冻结版本。

当前这轮已经完整成立：

- weekly report generation 已进入 shared insight-governance seam
- recommendation feedback server action 与 API write 已进入 shared insight-governance seam
- strategy suggestion accept / dismiss API write 已对齐到已有 workspace policy capability
- org-admin support-pack 已能输出 insight governance follow-through
- reports / settings surface 已能解释 insight governance 的 manage / read-only posture

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader BI / recommendation platform
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Shared insight-governance seam

- 新增 `lib/auth/insight-governance.ts`
- `lib/auth/authorization.ts` 新增 `workspace.manage_insights`
- `lib/auth/authorization.test.ts`、`lib/auth/insight-governance.test.ts` 补齐角色口径验证

当前真实统一的 helper 包括：

- `canManageWorkspaceInsights`
- `getInsightGovernanceDeniedMessage`

角色边界继续保持 fixed-role：

- `OWNER / ADMIN / OPERATOR` 可 manage insight write
- `BILLING_ADMIN / REVIEWER / MEMBER` 不可进入这组高风险 insight 写链路

### 2.2 reports / recommendation feedback / strategy suggestion route 已 capability 化

本轮接入的核心路径包括：

- `features/reports/actions.ts`
- `features/recommendations/actions.ts`
- `app/api/recommendations/[id]/feedback/route.ts`
- `app/api/evolution/strategy-suggestions/[id]/accept/route.ts`
- `app/api/evolution/strategy-suggestions/[id]/dismiss/route.ts`

当前真实变化：

- weekly report generation 不再只依赖登录和 workspace session，而是先检查 `workspace.manage_insights`
- recommendation feedback server action 与 route 都会显式走 insight capability deny
- strategy suggestion accept / dismiss route 现在对齐到 `canManageWorkspacePolicies`
- strategy suggestion adoption 继续保持 policy-governed write，不绕开既有 workspace governance truth

### 2.3 insight governance follow-through 已进入 org-admin governance snapshot

`lib/auth/org-admin-governance.ts` 现在新增：

- `INSIGHT_GOVERNANCE_AUDIT_ACTION_TYPES`
- `insightGovernanceActionCount30d`
- `latestInsightGovernanceAudit`

并把以下主动作纳入 tenant-scoped insight governance truth：

- `WEEKLY_REPORT_GENERATED`
- `RECOMMENDATION_FEEDBACK_SUBMITTED`
- `STRATEGY_SUGGESTION_ACCEPTED`
- `STRATEGY_SUGGESTION_DISMISSED`

这样 support-pack 不再遗漏 report generation、feedback collection 和策略采纳这组真实写面。

### 2.4 reports / settings 已补 capability-aware posture

当前 UI 层真实变化：

- reports page 会下发 insight-governance posture
- reports client 在无 capability 时禁用 generate button，并显示 read-only insight governance posture
- settings governance surface 现在会显式显示：
  - `canManageInsights`
  - `insightGovernanceActionCount30d`
  - `latestInsightGovernanceAudit`
  - weekly reports / recommendation feedback enabled vs read-only posture

这层变化的目标是避免“server 已拒绝，但 reports / governance surface 仍假装可操作”的错配。

## 3. 验证结果

当前已通过的窄验证：

- `npm run test -- lib/auth/authorization.test.ts lib/auth/insight-governance.test.ts lib/auth/insight-governance-routes.test.ts`
- `npm run typecheck`

窄验证结果：

- `3 files / 16 tests passed`
- `npm run typecheck` 通过

本轮最终以全量验证为准。PR52 worktree 没有单独 `.env`，全量验证时显式继承主仓库环境，并把 `DATABASE_URL` 指向 PR52 worktree 自己的 sqlite；没有修改主仓库环境文件。

全量验证结果：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

对应结果：

- `npm run test` -> `116 files / 451 tests passed`
- `npm run build` -> 通过
- `npm run e2e` -> `21 passed (1.9m)`
- `npm run quality:regression` -> `51 files / 180 tests passed`

## 4. 已成形但仍需下一层

- shared insight-governance seam 已成立，但 capability matrix 仍未覆盖所有剩余高风险 write path
- support-pack 已能解释 insight governance follow-through，但还不是完整 governance center
- reports / settings surface 已能讲清这组 insight 主链路，但还不是完整 tenant-admin console
- tenant isolation 仍主要依赖 workspace scoping，不应误写成 storage-level isolation

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- org hierarchy / shared billing
- schema-per-tenant / database-per-tenant
- broader tenant-admin platform
- broader BI / recommendation platform
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
- insight governance 现在是 deeper slice，不应误写成“broader BI / recommendation platform 已完整成立”

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support-pack deeper follow-through
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
