---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Broader Capability Matrix And Org Admin Export Follow-through Report V1

## 1. 结论

PR45 把 Helm 当前主干的多租户 / 多用户控制面，从“program governance capability + tenant-scoped org-admin support pack + governance posture readout”收紧到了“remaining high-risk memory-domain write paths capability guard + org-admin export follow-through + tenant-scoped export / delete / retention follow-through readout”的第四层可冻结版本。

当前这轮已经完整成立：

- remaining high-risk memory-domain write paths 已统一回到 `canManageWorkspaceMemory`
- org-admin governance summary 已能输出 `governanceFollowThrough`
- settings 已具备 tenant-scoped export / delete / retention follow-through 的集中 readout

当前这轮仍然刻意不做：

- full RBAC
- enterprise IAM / SSO / SCIM
- schema-per-tenant / database-per-tenant
- cross-tenant support tooling
- execution-authority expansion

## 2. 本轮完成内容

### 2.1 Broader capability matrix on remaining high-risk memory-domain write paths

- `lib/memory/permissions.ts` 现在把 `canManageWorkspaceMemory` 作为统一 capability seam
- deny posture 统一使用 `getMemoryManagementDeniedMessage`
- direct route capability guard 已接入：
  - `/api/memory/facts`
  - `/api/memory/facts/:id/confirm`
  - `/api/memory/meetings/:meetingId/process`
  - `/api/memory/imports/meeting-notes/process`
  - `/api/commitments`
  - `/api/commitments/:id/status`
  - `/api/blockers`
  - `/api/blockers/:id/resolve`
  - `/api/blockers/:id/status`
  - `/api/llm/meetings/:meetingId/process-memory`
- server action capability guard 已接入：
  - `features/memory/actions.ts`
  - `features/meetings/actions.ts`
- `write-governance-routes.test.ts` 现在明确覆盖 deny / allow truth

### 2.2 Org-admin export / retention / delete follow-through

- `lib/auth/org-admin-governance.ts` 现在会输出 `governanceFollowThrough`
- `dataGovernanceSummary` 现在新增：
  - `exportActionCount30d`
  - `deleteActionCount30d`
  - `retentionUpdateCount30d`
  - `settlementBatchExportCount30d`
- `governanceFollowThrough` 现在新增：
  - `latestExportAudit`
  - `latestDeleteAudit`
  - `latestRetentionAudit`

这让 org-admin support pack 从“support-pack 可导出”推进到了“tenant-scoped export / delete / retention follow-through 可解释”。

### 2.3 Settings governance readout

- `features/settings/settings-client.tsx` 现在会把 export / delete / retention / settlement export 30d count 接进 support-pack posture
- `organization-support-pack-download` 继续保持 capability-guarded
- settings 会显式显示 latest export / delete / retention marker，而不是只保留 recent audit list

### 2.4 Support-pack route coverage

- 新增 `org-admin-support-pack-route.test.ts`
- 当前 support-pack export route 已有 route-level deny / allow truth：
  - capability 不足时返回 `403`
  - capability 满足时导出 json attachment
  - 导出后写入 `ORGANIZATION_SUPPORT_PACK_EXPORTED`

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

- `npm run test` -> `105 files / 414 tests passed`
- `npm run e2e` -> `21 passed`
- `npm run quality:regression` -> `51 files / 180 tests passed`

验证时沿用主仓库现有环境，并把 `DATABASE_URL` 显式覆盖到 PR45 worktree 本地 sqlite 绝对路径；没有修改主仓库的 `.env` 文件。

本轮还补掉了两个真实问题：

1. Vitest 初版 route test 放在 `app/api/**`，没有落入当前 test include；已迁回 `lib/**`
2. memory route test 初版请求体和真实 schema 不一致，导致走到 `400`；现已按真实 enum / required field 修正

## 4. 已成形但仍需下一层

- broader capability matrix 已覆盖 remaining high-risk memory-domain write paths，但仍未覆盖全产品所有高风险 write path
- org-admin export follow-through 已成立，但还不是完整 tenant governance center
- tenant-scoped export / delete / retention follow-through 已成立，但还不是 storage-level tenant isolation
- retention / export / delete posture 仍需要和更完整的 support / policy pack 协同收紧

## 5. 刻意未做

- full RBAC builder
- enterprise IAM / SSO / SCIM
- domain claim / JIT provisioning
- enterprise org hierarchy
- schema-per-tenant / database-per-tenant
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

- capability matrix 还需要继续覆盖剩余非 memory-domain 的 high-risk write path
- current tenant isolation 仍然主要依赖 workspace scoping
- org-admin export / retention / support pack 还缺更完整的 follow-through
- governance readout 还需要继续与 retention / delete policy deeper slice 协同

下一阶段如继续推进，优先顺序应是：

1. 剩余高风险 write path 的 capability matrix 收口
2. org-admin export / retention / support pack follow-through deeper slice
3. tenant isolation / export / retention / delete governance deeper slice
4. enterprise layer deferred review
