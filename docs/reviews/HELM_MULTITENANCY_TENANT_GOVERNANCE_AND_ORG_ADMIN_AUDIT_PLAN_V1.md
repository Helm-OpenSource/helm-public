---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Tenant Governance And Org Admin Audit Plan V1

更新时间：2026-04-05  
状态：Planned

## 1. 当前 freeze truth

当前 truth 继承以下基线：

- `docs/product/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `docs/product/HELM_MULTITENANCY_AUTHORIZATION_AUDIT_BASELINE_V1.md`

已成立：

- `Workspace == Organization == current tenant boundary`
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- org-admin member lifecycle / owner transfer / last-owner guard 已成立
- memory export / correction / invalidate / delete 已具备 tenant-scoped capability guard

仍属下一层：

- 剩余高风险 write path 还没有全部 capability 化
- org-admin 审计仍偏窄，只停在 recent feed
- retention / export / delete / auth-session posture 还没有 org-admin support-pack 级 readout
- tenant isolation 仍主要依赖 application-layer `workspace` scoping

## 2. 本 PR 证明什么

PR44 证明 Helm 在当前 `workspace-first` 多租户边界下，已经把“高风险写路径授权 + org-admin support pack + tenant-scoped data-governance readout”推进到一条可接受、可审计、可导出的治理闭环。

它不是：

- full RBAC
- enterprise IAM
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling

## 3. exact governance loop

`capability-guarded write path -> tenant-scoped audit log -> org-admin governance summary -> support-pack export -> operator / admin review`

本轮最窄 proveout：

1. 把 `features/programs/actions.ts` 这类仍然直连角色判断的高风险写路径收回 capability matrix
2. 生成 tenant-scoped org-admin support pack，内容至少包含：
   - workspace / retention posture
   - membership posture
   - auth-session posture
   - recent org-admin audit
   - recent data-governance audit
3. settings surface 能解释：
   - 哪些治理动作可读
   - 哪些导出 / 删除 / retention 姿态当前可见
   - support pack 为什么可导出、由谁导出、导出后留下什么审计

## 4. preserved boundaries

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 5. phase plan

### Phase 0

- 完成 plan doc 与 `PLANS.md`

### Phase 1

- 扩 capability matrix 到 PR44 所含剩余高风险 write path
- 优先接入 `features/programs/actions.ts`

### Phase 2

- 新增 org-admin governance summary / support pack service
- 新增 support pack export route
- support pack export 必须 tenant-scoped、capability-guarded、audit-logged

### Phase 3

- 扩 settings query / settings UI
- 增加 retention / export / delete / auth-session posture readout
- 增加 support pack summary 与导出入口

### Phase 4

- baseline / report / README / docs index / self-check / boundary guard / tests / final validation

## 6. eval / validation contract

每阶段至少运行：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

最终收口运行：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. explicitly deferred

本 PR 明确不做：

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- execution authority expansion
- auto-send
- broad auto-write
