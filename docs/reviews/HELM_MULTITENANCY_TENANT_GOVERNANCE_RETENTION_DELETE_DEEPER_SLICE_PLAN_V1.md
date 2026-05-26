---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Tenant Governance Retention Delete Deeper Slice Plan v1

更新时间：2026-04-05  
状态：In Progress  
对应分支：`codex/pr48-tenant-governance-retention-delete-deeper-slice`

## 1. 当前 freeze truth

继承 PR42-PR47：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import 的第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有第一层 readout

当前仍属“已成形但仍需下一层”的部分：

- settings/actions.ts / settings/queries.ts 仍保留局部 capability helper，成员治理和 workspace governance deny message 没有统一回 shared seam
- org-admin support-pack 还没有把 membership / workspace governance / auth-session / support-pack follow-through 单独列为 tenant-scoped truth
- tenant-scoped memory export route 缺 private/no-store 等头部硬化
- settings governance surface 还没把上述 follow-through 的计数与 latest marker 完整暴露给 operator

## 2. PR48 要证明什么

PR48 要证明：Helm 当前 `workspace-first` 多租户模型下，settings/governance 这条 tenant-sensitive 管理主链路可以做到：

1. settings/governance 剩余高风险写路径统一 capability helper
2. org-admin support-pack 能更完整地表达 membership / workspace governance / auth-session / support-pack follow-through
3. tenant-scoped export/delete/retention 路由与 UI posture 保持一致、私有、可审计

这是一条更深的治理 slice，不是新的平台扩张。

## 3. 精确闭环

本轮闭环限定为：

1. 成员进入某个 workspace
2. 进入 settings / org-admin governance / memory export surface
3. 触发成员治理、workspace governance、support-pack export 或 memory export
4. 统一 capability helper 做 tenant-scoped allow/deny
5. settings governance 展示 capability-aware posture
6. support-pack 和 settings governance 能看见 membership / workspace governance / auth-session / support-pack follow-through

## 4. 保留边界

继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

继续明确不做：

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- continuity surface 深挖

## 5. 阶段计划

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope / truth / risk / validation

### Phase 1

- 新增 `lib/auth/settings-governance.ts`
- 收回 settings actions / queries 的局部 helper
- 统一成员治理、workspace governance、admin-audit/support-pack capability 判断

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 membership / workspace governance / auth-session / support-pack 的 30d 计数与 latest marker

### Phase 3

- 收紧 tenant-scoped memory export / support-pack route headers
- 在 settings surface 增加 follow-through 与 capability-aware governance posture

### Phase 4

- docs / self-check / boundary / tests / report
- 完整验证并准备 stacked PR

## 6. 风险

1. settings 局部 helper 若不统一，会继续制造 capability 漏洞和 deny message 漂移
2. support-pack 若不单列 membership / workspace governance / auth-session / support-pack follow-through，治理 truth 仍不完整
3. tenant-scoped export route 若不加 private/no-store 头部，治理导出仍存在缓存和隔离表达偏弱的问题
4. 如果为了“更完整”顺手做 enterprise tenant-admin 平台，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 7. 验证合同

每阶段至少：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 明确 deferred

本轮刻意不做：

- full RBAC / custom role builder
- enterprise IAM / SSO / SCIM
- org hierarchy / shared billing
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- execution authority expansion
