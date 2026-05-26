---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Workspace Data Governance Deeper Slice Plan V1

更新时间：2026-04-05  
状态：Completed  
对应分支：`codex/pr50-remaining-write-path-governance-deeper-slice`

## 1. 当前 freeze truth

继承 PR42-PR49：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import / participant portal / settlement 的第一批高风险写路径已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有前几层 readout

当前仍属“已成形但仍需下一层”的部分：

- workspace / opportunity / inbox / contact / company / customer-success handoff 里仍有 tenant-sensitive 写路径只依赖 login + workspace scoping，没有进入统一 capability seam
- customer-success handoff 的内部 approve / execute 还没有被明确纳入 internal governance boundary
- org-admin support-pack 还看不到 workspace data governance 这组真实业务 follow-through
- 部分 surface 仍是 server-side deny，缺 capability-aware read-only / review-first posture

## 2. PR50 要证明什么

PR50 要证明：Helm 当前 `workspace-first` 多租户模型下，workspace data governance 这条 tenant-sensitive 管理主链路可以继续收紧到：

1. workspace / opportunities / inbox / contacts / companies / customer-success handoff 的剩余高风险写路径进入更统一的 shared capability seam
2. customer-success 内部 approve / execute 保持 internal-only / review-first，同时被明确纳入治理边界
3. org-admin support-pack 能看见 workspace data governance 的 follow-through，而不是只统计 settings / import / commercial governance
4. UI 在权限不足时显示 read-only / review-first posture，而不是只依赖 server deny

这是一条更深的治理 slice，不是新的平台扩张。

## 3. 精确闭环

本轮闭环限定为：

1. 成员进入 workspace / opportunities / inbox / contacts / companies / customer-success handoff
2. 触发 tenant-sensitive 记录写入、关系绑定、owner / stage / next-action 调整，或 customer-success internal approve / execute
3. shared workspace-data-governance seam 对高风险写路径执行 tenant-scoped allow / deny
4. audit / support-pack / settings governance surface 记录并展示 workspace data governance follow-through
5. 导出的 org-admin support-pack 继续保持 tenant-scoped governance snapshot，不扩 execution authority

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

- 新增 shared workspace-data-governance helper
- 收回 workspace / opportunity / inbox / contact / company / customer-success handoff 的局部 capability 判断

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 workspace data governance 30d 计数与 latest marker

### Phase 3

- 在相关 surface 增加 workspace-data-governance posture
- 补齐 capability-aware wording 与 boundary notes

### Phase 4

- docs / self-check / boundary / tests / report
- 完整验证并准备 stacked PR

## 6. 风险

1. workspace data write path 如果继续散落，capability drift 会再次出现
2. customer-success internal approve / execute 如果不收进治理 seam，会留下 tenant-sensitive internal execution 的灰区
3. support-pack 如果仍看不到 workspace data governance follow-through，租户治理 truth 会继续低估真实写动作
4. 如果为了“更完整”顺手做 enterprise tenant-admin 或更宽的 execution surface，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

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
