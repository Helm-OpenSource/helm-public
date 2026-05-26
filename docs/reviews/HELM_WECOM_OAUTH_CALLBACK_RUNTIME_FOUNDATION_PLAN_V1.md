---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm WeCom OAuth Callback Runtime Foundation Plan V1

更新时间：2026-04-07
结论：Completed

## 1. 目标

PR88 只做 WeCom runtime OAuth callback foundation：

1. `start/callback` runtime
2. `code -> corp token -> oauth identity -> user profile`
3. workspace-scoped identity binding
4. `providerType = WECOM_OAUTH` session truth
5. tenant-scoped callback audit truth
6. settings/operator readout
7. baseline / report / README / docs / guards / tests

它不是：

- native WeCom SCIM
- WeCom read-only ingestion runtime
- send/write-back connector
- connector platformization
- Docker / Kubernetes / CI implementation
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_WECOM_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md`
- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- `WECOM_OAUTH` provider seam
- WeCom config / readiness helper
- `Helm directory-sync adapter seam`

当前本轮已补齐：

- WeCom runtime OAuth callback route
- corp token exchange + oauth identity fetch + user profile fetch
- current workspace user email / phone matching
- `providerType = WECOM_OAUTH` session write
- callback audit truth
- settings callback result readout

当前仍未成立：

- native WeCom SCIM
- WeCom read-only ingestion runtime
- send/write-back connector

## 3. 本轮要证明什么

1. WeCom 已从 foundation-only truth 推到真实可运行的 callback runtime foundation
2. callback failure / unresolved / mismatch 不会静默失败，而是落成 tenant-scoped audit truth
3. settings/operator surface 已能读出 callback readiness、last callback result 和 failure posture

## 4. 精确闭环

`start route -> callback route -> corp token -> oauth identity -> provider user profile -> workspace binding -> createSession(providerType) -> connector metadata -> tenant-scoped audit -> settings/operator readout -> docs/guards/tests`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- current repo truth does not claim native WeCom SCIM
- current repo truth does not claim read-only ingestion runtime

## 6. 范围

- `app/api/auth/wecom/start/route.ts`
- `app/api/auth/wecom/callback/route.ts`
- `lib/connectors/wecom.ts`
- `lib/auth/session-governance.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- PR88 baseline / report / README / docs / guards / tests

## 7. 不做

- native WeCom SCIM claim
- read-only ingestion runtime
- send/write-back connector
- connector platformization
- Docker / Kubernetes / CI implementation

## 8. 风险

1. callback runtime 需要严格保持 current-user initiated、workspace-scoped 绑定，不可越权扩成 broader tenant-admin flow
2. user info 如果不能稳定解析到当前 workspace 用户，必须显式落成 `UNRESOLVED` 或 `MISMATCH`
3. provider/source compatibility 如果不同步，新的 `WECOM_OAUTH` session 会自我污染 auth anomaly readout

## 9. 阶段计划

### Phase 0

- 复核 current-main 与 PR74 foundation truth
- 状态：Completed

### Phase 1

- runtime callback
- session / audit truth
- 状态：Completed

### Phase 2

- settings/operator readout
- docs / guards / tests
- 状态：Completed

### Phase 3

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
