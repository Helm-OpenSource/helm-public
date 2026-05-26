---
status: active
owner: helm-core
created: 2026-04-20
review_after: 2026-07-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Tenant Commercial Module Refactor Implementation Plan V1

更新时间：2026-04-20
状态：In Progress
当前切片：`Phase 4 / 阶段冻结：commercial settlement evidence readout freeze`
对应需求基线：`docs/product/HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_REQUIREMENTS_V1.md`

## 1. 本轮要证明什么

证明 Helm 现有商业模块可以在不扩平台的前提下，完成一次“按规范收口”的工程化重构：

1. ownership：reserved workspace + capability 双重守卫一致
2. process：`program -> application -> portal -> settlement` 状态机与文案一致
3. governance：审计、异常、proof/readiness 与支持包读面一致
4. quality：可回归、可回滚、可持续迭代

## 2. 保留边界

继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `manual settlement remains fallback source of truth`

本轮不做：

- marketplace / finance platform 扩张
- 自动打款执行面
- 完整 RBAC/IAM 平台化
- execution-authority 扩面

## 3. 任务分解（可直接执行）

## Task 1 - Ownership Guard 清点与统一

目标：把 program/portal/settlement 相关 route/action/service 的 reserved + capability 检查点统一。
影响文件：

- `features/programs/actions.ts`
- `features/participant-portal/actions.ts`
- `lib/billing/manual-settlement.ts`
- `lib/auth/commercial-governance.ts`
- `lib/workspace-reserved.ts`

验收：

1. 所有高风险写动作都可追溯到统一守卫链。
2. UI 拒绝文案与 API 错误文案一致。
3. 非 route 服务写路径具备二次校验。

## Task 2 - Program/Application 状态机收口

目标：统一申请状态流和关键约束，消除“状态可达但语义不一致”。
影响文件：

- `features/programs/actions.ts`
- `features/programs/program-application-form.tsx`
- `features/programs/queries.ts`
- `app/programs/[slug]/page.tsx`

验收：

1. `INVITED` 仅由 invite issuance 动作进入。
2. active 申请去重策略稳定（program + applicantEmail）。
3. 页面和后端对状态语义一致。

## Task 3 - Participant Portal Access 生命周期收口

目标：固定 token/access/profile/self-only 的一致契约。
影响文件：

- `features/participant-portal/actions.ts`
- `features/participant-portal/queries.ts`
- `features/participant-portal/participant-portal-client.tsx`
- `features/participant-portal/participant-portal-onboarding-client.tsx`
- `app/portal/page.tsx`
- `app/portal/access/[token]/page.tsx`

验收：

1. invite token 过期/失效路径可解释、可审计。
2. self-only 可见性不被跨 beneficiary 泄漏。
3. onboarding 文案不误导为 payout execution。

## Task 4 - Settlement 状态与动作一致化

目标：把 batch/line 生命周期与动作约束收紧为单一真值。
影响文件：

- `lib/billing/manual-settlement.ts`
- `lib/billing/settlement-posture.ts`（如涉及）
- `features/settings/components/billing-settlement-*.tsx`

验收：

1. closed batch 不可再次 approve/export。
2. reversed line 不可再 mark paid。
3. 每个关键动作留下 actor+target+metadata 审计证据，并共享同一份 audit/operator payload 真值。

## Task 5 - Exception / Proof Pack / Readiness 对齐

目标：让异常、证据包、readiness 的口径对齐 settlement 主事实层。
影响文件：

- `lib/billing/settlement-exceptions.ts`
- `lib/billing/settlement-ops-proof-pack.ts`
- `lib/billing/payout-rail-readiness.ts`
- `features/settings/components/billing-payout-readiness-panels.tsx`
- `features/settings/components/billing-settlement-exception-panels.tsx`

验收：

1. 异常分类可追溯到具体 line/batch/beneficiary。
2. proof pack 不夸大为“自动打款准备完成”。
3. readiness 保持 review-first/no-commitment 文案。

## Task 6 - Support Pack 与 Settings 治理读面统一

目标：org-admin support-pack 与 settings 商业治理卡片字段一致。
影响文件：

- `app/api/settings/org-admin/support-pack/route.ts`
- `features/settings/settings-client.tsx`
- `features/settings/components/billing-*.tsx`
- `features/settings/formatters/governance-formatters.ts`

验收：

1. 同一事实在 support-pack 与 settings 不冲突。
2. 输出继续 `private/no-store`，不扩大外部暴露。
3. 关键 follow-through 计数可回溯。

## Task 7 - 回归、冻结、合并门槛

目标：完成验证链并产出冻结报告。
影响文件：

- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/reviews/*`（冻结报告）

验收：

1. 默认验证链全量跑通或给出阻塞原因。
2. 报告给出四类短表：已完整成立/已成形仍需下一层/刻意未做/风险项。
3. 合并前具备回滚说明。

## 4. 顺序与依赖

执行顺序：

1. Task 1（守卫）
2. Task 2 + Task 3（业务前链路）
3. Task 4 + Task 5（结算与治理中后链路）
4. Task 6（统一读面）
5. Task 7（回归冻结）

依赖关系：

- Task 4 依赖 Task 1 完成守卫统一
- Task 5 依赖 Task 4 产出稳定 settlement 主状态
- Task 6 依赖 Task 2/3/4/5 的事实字段稳定

## 5. 风险与缓解

1. 历史数据在非 reserved workspace：
缓解：先 inventory dry-run，再小批 apply，保留操作审计。

2. 文案漂移导致 commitment 误读：
缓解：加 boundary wording checklist，review 时强制检查。

3. 非 route service 漏校验：
缓解：Task 1 做 service-level 守卫扫描并补测试。

4. 回归面大：
缓解：按任务分段执行验证，避免最后一次性集成。

## 6. 验证合同

阶段验证最小集：

```bash
npm run typecheck
npm run lint
npm run self-check
npm run check:boundaries
```

收口验证全量集：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

## 7. 交付物

1. 代码改造（按 Task 1-7）
2. 文档同步（README/docs 索引 + 产品/治理说明）
3. 自检与边界脚本同步
4. 阶段冻结报告
   - [`HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_FREEZE_REPORT_V1.md`](./HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_FREEZE_REPORT_V1.md)
5. 合并与回滚说明
