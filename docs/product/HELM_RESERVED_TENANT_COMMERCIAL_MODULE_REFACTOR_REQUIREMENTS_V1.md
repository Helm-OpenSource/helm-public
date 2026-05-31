---
status: active
owner: helm-core
created: 2026-04-20
review_after: 2026-07-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Tenant Commercial Module Refactor Requirements V1

更新时间：2026-04-20
状态：Requirements Freeze（Ready for implementation）

## 1. 目标与结论

本需求用于指导 Helm 租户（账户锚点：`${HELM_SYSTEM_EMAIL}`）的商业模块重构整理。
目标是把现有能力收口到一条可持续运营主链路，而不是扩平台：

1. `Program Catalog -> Application Intake -> Participant Portal -> Settlement Operations`
2. reserved workspace ownership 和 capability gating 一致化
3. recommendation/proposal 与 commitment/contract 的边界表达一致化
4. 数据、状态、审计、异常补偿与回滚路径可验证

## 2. 范围与非目标

### 2.1 范围内

- Program 对外目录与申请链路
- Program 内部审核与 invite 发放
- Participant Portal（onboarding + self-only 数据面 + profile 更新）
- Manual Settlement（batch/line 生命周期）
- Settlement Exception / Proof Pack / Payout Readiness 的运营读面
- Settings / Org-admin support-pack 对商业治理链路的读面一致化

### 2.2 非目标

- 不做 marketplace 平台化
- 不做自动高风险承诺或自动对外发送
- 不做产品内自动打款执行平面
- 不做 full RBAC builder / enterprise IAM
- 不做 schema-per-tenant / database-per-tenant

## 3. 受影响模块（当前代码入口）

### 3.1 路由与页面

- `app/programs/page.tsx`
- `app/programs/[slug]/page.tsx`
- `app/portal/page.tsx`
- `app/portal/access/[token]/page.tsx`

### 3.2 应用层（features）

- `features/programs/queries.ts`
- `features/programs/actions.ts`
- `features/programs/program-application-form.tsx`
- `features/participant-portal/queries.ts`
- `features/participant-portal/actions.ts`
- `features/participant-portal/participant-portal-client.tsx`
- `features/participant-portal/participant-portal-onboarding-client.tsx`

### 3.3 领域服务（lib）

- `lib/billing/program-catalog.ts`
- `lib/billing/manual-settlement.ts`
- `lib/billing/settlement-exceptions.ts`
- `lib/billing/settlement-ops-proof-pack.ts`
- `lib/billing/payout-rail-readiness.ts`
- `lib/auth/commercial-governance.ts`
- `lib/workspace-reserved.ts`

### 3.4 数据模型（prisma）

- `PartnerProgram`
- `ProgramTermsVersion`
- `ProgramApplication`
- `ParticipantPortalAccess`
- `PayoutLedger`
- `SettlementBatch`
- `SettlementBatchLine`

## 4. 规范化后的核心契约

## 4.1 租户归属契约

1. Helm first-party 商业数据只锚定 reserved workspace。
2. public program catalog 只能从 reserved host workspace 解析。
3. 非 reserved workspace 不得写入 Helm first-party program/portal/settlement 主链路。
4. 任何 fallback/bootstrap 只能用于 foundation bootstrap，且必须有审计证据。

## 4.2 权限契约（双重守卫）

每个高风险动作必须同时满足：

1. capability 校验（角色与动作权限）
2. reserved workspace 校验（host ownership）

最低要求：

- UI 层：按钮可见性、禁用态、拒绝提示一致
- Action/API 层：无论 UI 如何调用都能拒绝越权
- Service 层：非 route 写路径再校验一次，避免绕过 route/action guard

## 4.3 边界契约（customer-facing）

凡可能被误读为承诺的表达，统一补全：

- boundary note
- prerequisite note
- dependency note
- non-commitment note

明确保留：

- `application submitted != portal access granted`
- `accepted != invited`
- `invited != onboarded`
- `portal visible posture != payout execution`
- `manual settlement workflow != financial clearing system`

## 5. 状态机要求

## 5.1 ProgramApplication

状态：`SUBMITTED -> ACCEPTED/REJECTED/WAITLISTED -> INVITED`
约束：

1. `INVITED` 只允许通过 invite issuance 动作进入，不允许普通 review 直接写入。
2. 同 program + applicantEmail 的 active 申请必须去重。
3. termsVersion 需与当前 program 归属一致，且来自 reserved host workspace。

## 5.2 ParticipantPortalAccess

状态：`INVITED -> ACTIVE -> SUSPENDED/ARCHIVED`
约束：

1. token 必须支持过期、撤销、不可逆 hash 校验。
2. portal 读面默认 self-only，禁止跨 beneficiary 可见。
3. onboarding 只激活 access，不扩大财务执行权限。

## 5.3 SettlementBatch / SettlementBatchLine

Batch：`DRAFT -> APPROVED -> EXPORTED -> CLOSED`
Line：`PENDING -> APPROVED -> EXPORTED -> PAID/REVERSED`
约束：

1. 已关闭 batch 禁止再次 approve/export。
2. reversed line 禁止再标 paid。
3. batch 关键动作必须记录 actor、时间、备注与审计事件。

## 6. 数据与迁移要求

1. 旧 first-party 商业数据迁移默认 dry-run inventory。
2. 只有显式 apply 才允许迁移写入。
3. 每次 apply 需要留存：
   - preflight 结果
   - inventory diff
   - apply 操作日志
   - post-check 结果
4. 迁移失败必须支持中断后重跑，且保持幂等。

## 7. 交互与信息架构要求（简洁有效）

1. 登录后优先返回“最重要的工作”：
   - 待审核申请
   - 待处理 settlement 异常
   - 当日最关键 next actions
2. 第一屏只展示必要决策信息：
   - 对象状态
   - 阻塞
   - 待决策
   - 下一步动作
3. 详情、解释、背景信息统一下沉到二级层，不在首屏堆叠。
4. 页面文案统一使用 review-first、boundary-aware 表达，避免“自动执行”错觉。

## 8. 可观测性与审计要求

关键动作必须有标准化事件：

- program_application_submitted
- program_application_reviewed
- program_application_invite_issued
- contributor_portal_onboarded
- contributor_portal_profile_updated
- settlement_batch_*（create/approve/export/close）
- settlement_line_*（paid/reversed）

每条事件最少包含：

- `workspaceId`
- `actorType` / `actorUserId`
- `targetType` / `targetId`
- `summary`
- `metadata`
- `createdAt`

## 9. 验收标准（DoD）

### 9.1 功能验收

1. 非 reserved workspace 无法执行 first-party commercial 写动作。
2. Program -> Application -> Invite -> Portal -> Settlement 链路状态一致。
3. Manual settlement 关键动作满足状态机和幂等约束。
4. 异常读面能定位到具体 batch/line/beneficiary 阻塞。

### 9.2 质量验收

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

### 9.3 文档验收

1. `README.md` 与 `docs/README.md` 可索引到本需求基线。
2. 实施 PR 必须引用本需求文档和 `PLANS.md` 对应切片。
3. 每个阶段输出 report，且显式给出：
   - 已经完整成立
   - 已成形但仍需下一层
   - 刻意未做
   - 风险项

## 10. 分期实施建议

1. Phase 1（治理收口）：ownership + capability + denial/audit 一致化。
2. Phase 2（申请到门户）：program/application/invite/portal 状态与文案统一。
3. Phase 3（结算运营）：manual settlement + exception + proof pack + readiness 收口。
4. Phase 4（回归冻结）：全链路验证、冻结报告、合并主线。

## 11. 剩余风险

1. 历史数据分布在非 reserved workspace 时，收口后会出现“不可见但未迁移”窗口。
2. 非 route service 新增写路径若不复用统一 governance seam，仍可能权限漂移。
3. 若不持续执行 boundary 文案审计，仍可能出现 commitment 误读。

## 12. 下一步执行入口

执行入口固定为：

1. `PLANS.md` 的 `Helm Reserved Tenant Commercial Modules Refactor v1` 切片
2. 本文档（requirements freeze）
3. 后续阶段报告（每阶段一个 report，引用同一需求基线）
