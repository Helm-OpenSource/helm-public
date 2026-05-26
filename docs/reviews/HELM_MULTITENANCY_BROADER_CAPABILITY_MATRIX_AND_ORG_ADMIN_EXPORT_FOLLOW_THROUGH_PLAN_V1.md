---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy Broader Capability Matrix And Org Admin Export Follow-through Plan v1

更新时间：2026-04-05  
状态：Planned

## 1. 当前 freeze truth

继承以下已落地基线：

- `Workspace == Organization == current tenant boundary`
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立，但还没有覆盖全部高风险 server write path
- memory export / fact correction / invalidate / delete 已具备 tenant-scoped capability guard
- org-admin governance support pack 已成立，但 export / retention / delete follow-through 仍偏摘要层

当前仍需下一层，但不能过度表述为完整 enterprise tenant admin：

- 部分 memory API 写口仍然只依赖 active workspace session
- settings 内 org-admin governance 已能读，但 follow-through 解释还不够完整
- retention / export / delete 仍是 posture + audit summary，不是完整 policy engine

## 2. 本轮要证明什么

PR45 证明的是：

1. 剩余高风险 memory write path 已统一回到 capability matrix
2. org-admin support pack 能更诚实地说明 export / retention / delete follow-through
3. settings 中的 governance readout 已足够解释 tenant-scoped data governance posture

PR45 不证明：

- full RBAC
- enterprise IAM
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- execution authority expansion

## 3. 精确闭环

本轮闭环限定为：

1. 用户进入当前 workspace session
2. server write path 先验证 workspace session，再验证 fixed-role capability
3. memory / governance 写动作写入 tenant-scoped audit
4. org-admin support pack 聚合 retention / export / delete / auth-session / audit follow-through
5. settings surface 以 review-first 方式展示 governance posture

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 5. Phase plan

### Phase 0

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 truth、scope、risk、validation contract

### Phase 1

- 为剩余高风险 memory API 写口补 capability guard
- 明确这些写口继续只在当前 workspace tenant 内生效

### Phase 2

- 扩 org-admin governance summary
- 增加 support-pack export / retention / delete follow-through 指标

### Phase 3

- 把新增的 governance follow-through 接回 settings
- 保持 operator-facing、review-first、tenant-scoped 表达

### Phase 4

- 补 baseline / report / README / docs index / self-check / boundary guard / tests
- 跑完整验证链

## 6. Eval / validation contract

默认完整验证：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

另外需要补充针对性覆盖：

- capability guard 针对 memory API 写口的拒绝 / 允许路径
- org-admin governance summary 的 export / retention / delete follow-through
- settings surface 对新增 governance posture 的可读性断言

## 7. 明确 deferred

本轮明确不做：

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- retention policy engine 重写
- execution authority expansion
- auto-send / broad auto-write
