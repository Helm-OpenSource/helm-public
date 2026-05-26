---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Connector Import Governance Deeper Slice Report V1

## 1. 结论

PR46 把 Helm 当前主干的多租户 / 多用户控制面，从“memory-domain write guard + org-admin export follow-through + tenant-scoped export / delete / retention readout”收紧到了“connector / import ingress capability guard + connector/import follow-through governance snapshot + capability-aware ingress posture”的第五层可冻结版本。

当前这轮已经完整成立：

- connector / import ingress 高风险路径已统一回到 fixed-role capability matrix
- org-admin governance summary 已能输出 connector / import follow-through
- imports / CRM / conflicts / import-result surface 已具备 capability-aware read-only posture

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- cross-tenant connector governance center
- broader import orchestration platform
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Connector / import ingress capability guard

- `lib/auth/authorization.ts` 现在新增：
  - `MANAGE_CONNECTORS`
  - `MANAGE_IMPORTS`
  - `RESOLVE_IMPORT_CONFLICTS`
- `lib/auth/import-governance.ts` 现在把 connector / import ingress 统一收回：
  - `canManageWorkspaceConnectors`
  - `canManageWorkspaceImports`
  - `canResolveWorkspaceImportConflicts`
  - 对应 denial messaging helper
- `import-governance-routes.test.ts` 现在明确覆盖 imports / conflicts route 的 deny / allow truth
- 真实接入 capability guard 的路径现在包括：
  - connector actions
  - import actions / CRM actions
  - OAuth start / callback
  - CRM preview / run / sync
  - import warmup rerun
  - import conflict resolve

这让 connector / import ingress 不再只依赖 workspace session，而是会继续验证 tenant-scoped fixed-role capability。

### 2.2 Connector / import governance follow-through

- `lib/auth/org-admin-governance.ts` 现在新增 connector / import audit分组和 follow-through 统计
- `dataGovernanceSummary` 现在新增：
  - `connectorActionCount30d`
  - `connectorConnectionCount30d`
  - `connectorSyncCount30d`
  - `connectorDisconnectCount30d`
  - `importActionCount30d`
  - `csvImportCount30d`
  - `crmImportCount30d`
  - `importWarmupCount30d`
  - `importConflictResolutionCount30d`
  - `importSourceConnectionCount30d`
  - `importSourceDisconnectCount30d`
- `governanceFollowThrough` 现在新增：
  - `latestConnectorAudit`
  - `latestImportAudit`
  - `latestConflictResolutionAudit`

这让 org-admin support pack 已能解释 connector / import ingress 的 recent follow-through，而不只停留在 memory / export / retention posture。

### 2.3 Capability-aware ingress posture

- `ImportsClient`
- `CrmImportClient`
- `ImportConflictsClient`
- `ImportJobDetailClient`

现在都会在 capability 不足时给出 operator-facing read-only posture：

- note 明确说明当前是 read-only / review-first
- 高风险写按钮 disabled
- denied message 不再只埋在 server response

这让 imports / CRM / conflicts surface 不会把权限问题伪装成普通系统异常。

### 2.4 Settings governance readout

- `features/settings/settings-client.tsx` 现在会把 connector / import 30d count 和 latest marker 接进 org-admin governance support pack
- `organizationAuditActionLabels` 也已补齐 connector / import 相关动作，避免 governance audit feed 回退成 raw action type

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

- `npm run test` -> `107 files / 425 tests passed`
- `npm run e2e` -> `21 passed`
- `npm run quality:regression` -> `51 files / 180 tests passed`

验证时沿用主仓库现有环境，并把 `DATABASE_URL` 显式覆盖到 PR46 worktree 本地 sqlite 绝对路径；没有修改主仓库 `.env` 文件。

## 4. 已成形但仍需下一层

- broader capability matrix 已覆盖 connector / import ingress 主路径，但仍未覆盖全产品剩余所有高风险 write path
- org-admin governance follow-through 已能解释 connector / import ingress，但还不是完整 tenant governance center
- imports / CRM surface 已具备 capability-aware posture，但还不是完整 tenant-admin console
- tenant isolation 仍主要依赖 application-layer workspace scoping

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
- cross-tenant connector governance center
- broader import orchestration platform
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

- capability matrix 还需要继续覆盖剩余非 connector / import / memory-domain 的高风险 write path
- connector / import governance 仍然是 tenant-scoped snapshot，不是完整 admin platform
- tenant isolation 仍然主要依赖 workspace scoping
- imports / CRM surface 后续若新增写动作但不复用当前 capability seam，权限 drift 会回来

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support-pack follow-through deeper slice
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
