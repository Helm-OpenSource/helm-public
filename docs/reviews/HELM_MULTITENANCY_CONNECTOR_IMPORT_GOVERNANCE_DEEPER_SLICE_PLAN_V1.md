---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Connector Import Governance Deeper Slice Plan v1

更新时间：2026-04-05  
状态：Completed  
对应分支：`codex/pr46-broader-capability-matrix-org-admin-governance-deeper-slice`

## 1. 当前 freeze truth

继承 PR42-PR45：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / programs / memory 第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有第一层 readout

当前仍属“已成形但仍需下一层”的部分：

- connector connect / sync / disconnect 及 OAuth start/callback 仍主要依赖 workspace session
- CSV import、CRM import preview/run/sync、warmup rerun、conflict resolve 仍未统一进入 capability seam
- org-admin support pack 尚未纳入 connector/import follow-through
- imports surface 尚未对 capability posture 给出明确 read-only/operator-facing 表达

## 2. PR46 要证明什么

PR46 要证明：Helm 当前 `workspace-first` 多租户模型下，connector / import 这条 tenant-sensitive ingress 主链路可以做到：

1. 高风险写路径统一 capability guard
2. tenant-scoped import / connector follow-through 可读、可审计
3. UI 明确表达 capability posture，而不是把授权失败伪装成普通系统错误

这是一条更深的治理 slice，不是新的平台扩张。

## 3. 精确闭环

本轮闭环限定为：

1. 成员进入某个 workspace
2. 进入 settings / imports / CRM ingress surface
3. 发起 connector connect / sync / disconnect 或 import preview / run / rerun / conflict resolve
4. 统一 capability helper 做 tenant-scoped allow/deny
5. imports / settings surface 展示 capability-aware posture
6. org-admin support pack 和 settings governance 能看见 connector/import follow-through

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
- connector platform 重写
- import orchestration 平台化

## 5. 阶段计划

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope / truth / risk / validation

### Phase 1

- 在 `lib/auth/authorization.ts` 增补 connector/import capability
- 新增 capability helper，统一 connector/import denial messaging
- 覆盖 action / route / OAuth start/callback

### Phase 2

- 扩 `org-admin governance` summary
- 把 connector/import follow-through 纳入 support-pack / settings readout

### Phase 3

- 在 imports / CRM / conflicts / import-result surface 增加 capability-aware read-only posture
- 保持 operator-facing / ingress-first / review-first

### Phase 4

- docs / self-check / boundary / tests / report
- 完整验证并准备 stacked PR

## 6. 风险

1. connector OAuth callback 若不收进 capability seam，会留下侧向绕行口
2. import routes 若 capability 和 workspace scope 表达不一致，会制造租户隔离灰区
3. settings governance 若把 connector/import posture写得过宽，会被误解成完整 tenant-admin 平台
4. imports surface 若只靠 server 返回错误，operator 会把权限问题误判为 connector/import 异常

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
- broader connector marketplace / connector governance center
- broader import orchestration platform
- execution authority expansion
