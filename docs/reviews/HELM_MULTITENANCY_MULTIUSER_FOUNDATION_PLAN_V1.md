---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multitenancy And Multiuser Foundation Plan v1

更新时间：2026-04-05
状态：Planned
范围：workspace-first / membership-backed 多租户与多用户基础收紧

## 1. 目标

本轮目标不是把 Helm 扩成完整 enterprise IAM / org admin / tenant admin 平台。

本轮只做三件基础但高杠杆的事：

1. 收紧身份与会话完整性，避免当前 `email cookie + active workspace cookie` seam 继续承载更重的多租户场景
2. 把高风险写路径上的权限判断从分散条件收成可复用的集中授权矩阵
3. 把组织管理员与成员生命周期补到第一轮可信可用，不再只停留在“能邀请、能切组织”的窄路径

## 2. 当前 freeze truth

当前仓库已经成立的 truth：

- `Workspace == Organization == current tenant boundary`
- `Membership` 是 user-to-organization seam
- 一个用户可以关联多个 workspace，并可切换 active workspace
- `BillingAccount / TrialState / WorkerEntitlement / UsageLedger` 已经作为组织级 commercial truth 落地
- self-serve signup、owner membership、invited membership、workspace switch、participant portal invited onboarding 都已成立

关键证据：

- `prisma/schema.prisma`
- `lib/auth/session.ts`
- `features/auth/actions.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `docs/product/HELM_BILLING_FOUNDATION_BASELINE_V1.md`
- `docs/product/HELM_FORMAL_SELF_SERVE_ENTRY_AND_TEAM_ONBOARDING_REPORT.md`
- `docs/product/HELM_CONTRIBUTOR_PORTAL_BASELINE_V1.md`

当前明确未成立或仍然很窄的 truth：

- 当前不是完整企业级多组织 / 多权限 / 多租户平台
- 当前不是 full RBAC builder
- 当前不是 SSO / SCIM / enterprise IAM
- 当前 session seam 仍不是完整生产级企业会话体系
- 当前多用户 evidence 仍只有受控试点厚度，不是长期规模化稳定证据

## 3. 本轮不做

以下能力明确不进入本轮：

- full RBAC builder
- SSO / SAML / SCIM / domain claim / JIT
- parent-child org hierarchy
- shared billing / enterprise account consolidation
- public marketplace / public discovery
- execution authority expansion
- route owner rewrite
- second app tree

## 4. 关键假设

1. 继续保持 `workspace-first`
2. 继续保持 `Workspace == current tenant boundary`
3. 一个用户可以加入多个 workspace，并通过显式 active workspace 进入
4. participant portal 继续保持 external invited self-only boundary，不并入内部成员权限体系
5. 权限模型先保持 fixed roles，不进入 custom role builder

## 5. 风险

1. 当前 session 只靠 cookie 中的 email 和 workspace id，继续扩功能会放大会话伪造、切换错误和审计不足风险
2. 当前权限判断散在 action / query 中，继续扩 settings、billing、portal、registry 时容易出现绕过
3. 当前成员生命周期缺少 owner transfer / last-owner guard / reactivation 等关键运营动作，真实多用户试点会卡住
4. 如果本轮误扩到 full IAM / org admin 平台，会明显偏离 Helm 现阶段边界

## 6. exact delivery loop

`session hardening -> centralized authorization -> org admin lifecycle -> docs / guard / validation`

## 7. phase plan

### Phase 0: planning freeze

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 truth source、scope、non-goals 和验证链

### Phase 1: identity and session hardening

目标：

- 把当前登录后的 active workspace 进入路径收紧成更可信的 session seam

范围：

- 收敛 session shape
- 绑定 session 与 active workspace
- 增加 session rotation / revoke / audit 基础
- 保持现有 formal signup / password login / phone login / invited compatibility path 可用

验收：

- 登录、登出、组织切换都继续可用
- active workspace 不再只靠裸 cookie 表达
- session 审计信息可见或可追踪

### Phase 2: centralized authorization matrix

目标：

- 把组织、计费、participant portal、registry 这几类高风险路径的权限判断集中化

范围：

- 定义 fixed-role -> capability matrix
- 引入最小可复用 guard helper
- 替换高风险 action / query 上的散落角色判断

首批高风险面：

- organization member management
- billing actions
- participant portal issuance / status update
- contribution registry readability

验收：

- 高风险路径都通过统一 capability seam 验证
- UI 和 server action 的权限语义保持一致
- 不扩成 full RBAC builder

### Phase 3: org admin and membership lifecycle

目标：

- 把组织管理员与成员生命周期补到第一轮可信可用

范围：

- owner transfer
- last-owner guard
- invite resend / revoke or equivalent narrow lifecycle action
- deactivate / reactivate membership
- 更清楚的 active / invited / inactive runtime semantics

验收：

- 不能把最后一个 owner 失手移除
- invited / active / inactive 与 seat / runtime path 一致
- 组织管理员操作都有 audit trail

### Phase 4: docs, guards, tests, report

范围：

- README / docs index 同步
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- 必要单测、集成测试、e2e
- baseline / acceptance report

## 8. 影响面

- `lib/auth/session.ts`
- `features/auth/actions.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `features/participant-portal/actions.ts`
- `prisma/schema.prisma`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

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

1. 多租户与多用户能力仍保持 `workspace-first / membership-backed`
2. session seam 明显比当前 cookie-only 方案更可信
3. 高风险路径不再依赖散落的角色判断
4. 成员生命周期具备第一轮组织管理员必需动作
5. 文档、守卫、测试、报告同步收口
6. 不把当前仓库误写成完整 enterprise IAM / org admin / tenant platform
