---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multitenancy Authorization And Org Admin Audit Plan v1

更新时间：2026-04-05
状态：Completed
范围：workspace-first / membership-backed 多租户与多用户第二层收紧

## 1. 目标

本轮目标不是把 Helm 扩成完整 tenant admin / RBAC / enterprise IAM 平台。

本轮只做三件事：

1. 扩大 fixed-role capability matrix 的覆盖面，把更多高风险 write path 收到统一 authz seam
2. 把 tenant-scoped memory export / correction / delete 补成 capability-guarded 且 UI posture 一致
3. 把 org-admin 的关键 lifecycle 动作和 recent audit 补成第一轮可信可追踪

## 2. 当前 freeze truth

当前继承的 truth：

- `Workspace == Organization == current tenant boundary`
- 一个用户可属于多个 workspace，并通过 active workspace 进入
- DB-backed auth session 已落地
- fixed-role capability matrix 已落地，但覆盖仍偏窄
- 组织成员新增、状态更新、ownership transfer 已成立

关键证据：

- `lib/auth/session.ts`
- `lib/auth/authorization.ts`
- `lib/auth/membership-lifecycle.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/memory/actions.ts`
- `app/api/memory/export/route.ts`

当前仍明显偏窄的 truth：

- settings 的 policy / setup / operational controls 写路径还没有统一 capability guard
- memory export / correction / delete server path 还主要依赖 workspace session，不够表达角色能力
- org-admin 审计目前只有 aggregate summary，没有 recent action replay
- 还没有 role change 这类 org-admin 生命周期动作

## 3. 本轮不做

- full RBAC builder
- SSO / SAML / SCIM / domain claim / JIT
- org hierarchy / parent-child tenant
- schema-per-tenant / database-per-tenant
- cross-tenant support tooling
- execution authority expansion
- second app tree
- route owner rewrite

## 4. preserved boundaries

- workspace-first
- membership-backed
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion

## 5. 关键假设

1. fixed roles 继续足够支撑本轮 capability 扩展，不进入 custom role builder
2. memory export / correction / delete 属于高风险租户级操作，需要明确 capability，而不只是“已登录即可”
3. org-admin audit 当前先做 recent readable feed，不做完整 governance center
4. tenant isolation 当前仍保持 application-layer workspace scoping，不进入 storage isolation 重构

## 6. 风险

1. 如果 capability 只加在 server action，不同步 UI posture，会形成“按钮可见但提交失败”的不一致
2. 如果 role change 不补 last-owner demotion guard，会出现 owner 被误降级的治理缺口
3. 如果 org-admin recent audit 不落到 settings surface，审计仍停留在 aggregate count，不利于试点复盘
4. 如果本轮误扩到 full tenant platform，会放大范围并提高回归风险

## 7. exact delivery loop

`capability coverage -> tenant-scoped memory control -> org-admin audit + lifecycle -> docs / guards / validation`

## 8. phase plan

### Phase 0: planning freeze

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 truth source、scope、validation contract 和 explicit non-goals

### Phase 1: broader capability coverage

目标：

- 把 settings 高风险写路径收到 centralized authorization seam

范围：

- policy update / restore defaults
- workspace setup
- workspace operational controls

验收：

- 这些高风险路径不再依赖散落角色判断
- fixed-role -> capability mapping 明确可查

### Phase 2: tenant-scoped memory export/delete/correction control

目标：

- 把 memory export / delete / correction 补成 capability-guarded，且 UI 与 server posture 一致

范围：

- `/api/memory/export`
- `/api/memory/facts/[id]/correct`
- `/api/memory/facts/[id]/invalidate`
- `/api/memory/facts/[id]/delete`
- `features/memory/actions.ts`
- `features/memory/page-loader.ts`
- `features/memory/memory-client.tsx`

验收：

- 不具备 capability 的成员不能发起高风险 memory write / export
- UI 上能看见受限 posture，不再只是提交时失败

### Phase 3: org-admin audit and lifecycle follow-through

目标：

- 补齐 org-admin 的 role change 和 recent audit 可读回放

范围：

- membership role change
- last-owner demotion guard
- recent org-admin audit feed in settings

验收：

- 不能把最后一个 active owner 直接降级
- 角色切换与生命周期动作都有 audit trail
- settings 内能看到 recent org-admin actions

### Phase 4: docs, guards, tests, report

范围：

- README / docs index 同步
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- 必要单测、集成测试、e2e
- baseline / report

## 9. 验证方案

每个 phase 后默认跑：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

有真实行为变化时加跑：

- `npm run test`
- `npm run build`

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

## 10. Definition of done

Done 代表：

1. 高风险 settings 写路径通过统一 capability seam
2. memory export / correction / delete 具备 tenant-scoped capability guard 和可见 UI posture
3. org-admin 具备 role change、last-owner demotion guard、recent audit readout
4. 文档、守卫、测试、报告同步收口
5. 当前仓库仍诚实表达为 workspace-first 的多租户 / 多用户基础，不误写成 enterprise tenant platform
