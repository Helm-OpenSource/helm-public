---
name: Helm 设计原则代码审计 · 2026-05-03
description: 以 AGENTS.md / DESIGN.md / WORKING-CONTEXT.md 为准绳，对当前 priority hardening 分支关键路径做的针对性审计与待改进清单
type: audit
audited_branch: codex/helm-priority-hardening-20260503
audited_head: 4eaf39fc9
auditor: Claude (Opus 4.7)
audited_at: 2026-05-03
status: archived
owner: helm-core
created: 2026-05-03
review_after: 2026-10-30
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Helm 设计原则代码审计 · 2026-05-03

## 0. 审计范围与方法

**审计基线**：

- 仓库长期规则：`AGENTS.md`（特别是 §6 长期硬边界、§7 recommendation/commitment 规则、§13 统一禁止事项）
- 视觉与产品语义：`DESIGN.md`（特别是 §4 产品语义、§4.1 不要尝试教用户做事情、§7.2 judgement / why / action / boundary 4 层卡片）
- 当前姿态：`WORKING-CONTEXT.md`（receipt checklist、Phase 3 解禁口径、残留风险）
- 公开承诺：`README.md`（"建议可复核，绝不替你对外发送 / 承诺只有你能签 / 关键写路径带 trace ID"）

**审计方法**：

- 不是逐字符 diff — 这种规模的代码库（lib/ + features/ + app/ 加起来数十万行）做"逐行"是浪费。
- 改用"关键路径 + 关键关键词"的针对性审计：每条设计原则映射到一条或多条代码路径，再对那些路径做行级检查。
- 报告中所有结论都给出 `file:line` 证据，便于复核与修复。

**审计口径**：

按 AGENTS.md §8 的四档：

- **完整成立**：代码 / 页面 / 测试 / 文档四者都在。
- **已成形但仍需下一层**：方向对，但有一处或多处需要补强。
- **刻意未做**：硬边界明确说不做的，必须诚实保留。
- **风险项**：当前与设计原则有偏差，建议尽快收口。

## 1. Executive Summary

| 维度 | 评级 | 一句话 |
| --- | --- | --- |
| 硬边界诚实表达（sandbox / auth / auto-write / auto-send） | 完整成立 | 代码层用枚举和 throw 把 `real_sandbox` / `external_side_effect` / `auto-send 无显式触发` 直接 block；不是只在文档里讲。 |
| recommendation ≠ commitment | 完整成立 | recommendation 与 governed action 在持久化、状态机、createGovernedAction 入口三层都是分离的，需要显式人为操作才能跨层。 |
| workspace 数据范围 | 完整成立 | `data/queries.ts` 与各 feature `queries.ts` 都强制 `workspaceId` 入参，Prisma `where` 子句一致包含。 |
| 手动结算回退是真值 | 完整成立 | `lib/billing/manual-settlement.ts` 状态机严格、事务化、capability 入口检查齐备。 |
| Judgement-first IA | 已成形但仍需下一层 | dashboard / approvals / health 已基本符合；但 approvals-client 仍残留较多"this page exists / 解释系统"的 v1 风格教学型文案，与 DESIGN.md §4.1 v2 原则有偏差。 |
| 审计 trace 完整性 | 风险项 | `writeAuditLog` 在 6 处以上被 `try { ... } catch { console.error(...) }` 包裹，审计失败被静默吞掉；与 README "审计 trace：关键写路径写入 traceId" 的承诺有缝隙。 |
| 默认 manualSendEnabled | 风险项 | `configureAliyunMailConnector` 把 `manualSendEnabled` 默认为 `true`，与"默认没有 send authority"的口径方向相反。 |
| 4 层卡片结构（judgement/why/action/boundary） | 已成形但仍需下一层 | 类型层有 `boundary: string \| null`，schema 上允许缺省；DESIGN.md §7.2 明确要求 boundary 必须存在。 |
| Tenant extension public-mirror seam | 已成形但仍需下一层 | `lib/extensions/registry.tsx` 静态 import `@/extensions/<tenant>/*`；公开镜像剥离依赖 mirror 阶段手动替换，不是自动化。 |
| 教学型文案 / v2 简化原则 | 已成形但仍需下一层 | 多处 page-level "this page exists / approval center exists" 元描述属于 DESIGN.md v2 明确点名要去除的范式。 |

总体：硬边界与建议/承诺分离做得明显高于业界平均水平，且不是只写在文档里。残余风险集中在"边界默认值"和"教学型文案"两类，优先级见 §13。

## 2. 已经完整成立

### 2.1 plugin runtime 不假装有 sandbox

**证据**：

- `lib/runtime-server-minimal.ts:108` —— `RuntimeWorkerQueueEffect` 把 `real_sandbox`、`remote_execution`、`swarm_ui`、`external_side_effect` 列为枚举值
- `lib/runtime-server-minimal.ts:903-916` —— `blockedEffectReason` 对每一个非 `local_reducer` / `operator_review` 的 effect 都返回明确 `"Blocked: ..."` 文案
- `lib/runtime-server-minimal.ts:250-257` —— `RUNTIME_SERVER_MINIMAL_BOUNDARY_NOTES` 在每条 thread 上都附带 6 条边界说明文字
- `lib/runtime-server-minimal.ts:307` —— 每条 thread 的 `sourceChain` 末尾固定写入 `"Runtime Server Minimal Implementation V1 is an in-process local seam ..."`
- `lib/harness-final-closeout.ts:407-432` —— `sandbox roadmap` readout 把"未来要做"和"现在没做"分离开

**结论**：硬边界 #1（plugin runtime 没有真正 sandbox）在代码层是诚实的。AGENTS.md §6.1 与代码状态一致。

### 2.2 manual settlement 是真值，且严格事务化

**证据**：

- `lib/billing/manual-settlement.ts:190-195` `createSettlementBatchForPeriod` 入口先 `assertWorkspaceReservedManualSettlementServiceAccess`
- `lib/billing/manual-settlement.ts:327-407` `approveSettlementBatch` 入口同样先做 service access assertion，然后 `db.$transaction` 内同时改 batch / line / payoutLedger 三张表的状态字段
- `lib/billing/settlement-posture.ts` 一族 `canApproveSettlementBatch` / `canExportSettlementBatch` / `canMarkSettlementLinePaid` / `canReverseSettlementLine` —— 状态机用 helper 集中管理，而不是散落在调用点
- `lib/billing/manual-settlement.ts:361-367` —— 已 CLOSED 的 batch 不能再 approve；DRAFT 必须 approve 才能 export

**结论**：硬边界 #5（人工结算回退仍是真实来源）在代码层得到强约束。

### 2.3 recommendation ≠ commitment 在数据流上分离

**证据**：

- `lib/recommendations/recommendation.service.ts:288` `persistRecommendations` 写入 `RecommendationLog`，与 `ActionItem` / `ApprovalTask` 不共享存储路径
- `lib/recommendations/recommendation.service.ts:728-762` `createActionFromRecommendation` 是从 recommendation 跨入 governed action 的**唯一**入口；它显式接受 `MemoryActorContext`（包含 actorUserId），并通过 `lib/policies/engine.ts` 的 `createGovernedAction` 进入审批流
- `lib/recommendations/recommendation.service.ts:764-782` 跨层动作即使成功，也写一次 `RECOMMENDATION_ACTION_CREATED` 审计
- `features/approvals/actions.ts:42-44, 81-83, 137-139, 165-167, 186-188` —— 每个审批 action 入口都先 `canReviewWorkspaceGovernedActions(membership.role)`，否则返回 `{ ok: false, error: ... }`

**结论**：AGENTS.md §7 在代码层确实成立。LLM enhancement 也是在 recommendation 层增强 explanation，而不是绕过 governed action。

### 2.4 workspace 范围在数据层强制

**证据**：

- `data/queries.ts:16-21, 28-30, 165-175` 等 —— 每个 export 函数第一个参数都是 `workspaceId`
- `data/queries.ts:36-40, 80-87, 88-101, 102-114, 115-124, 125-137, 215-224, 237-245, 246-259, 260-270, 273-282, 283-294` —— 每个 Prisma `where` 子句都包含 `workspaceId`
- `lib/auth/session.ts:612-622` `setActiveWorkspace` 用 `workspaceId_userId` 复合键去 `db.membership.findUnique`，且校验 `MembershipStatus !== INACTIVE`
- `lib/auth/session.ts:725-744` `getCurrentWorkspaceSession` 从当前 session 解析 membership，再回 db 拿 `workspace.billingAccount` / `trialState` / `workerEntitlements`，整链都基于 membership 关联

**结论**：硬边界 #5"未经明确批准没有广泛的自动写入"在 read 路径上得到强约束。data/queries.ts 仍是真正的 query aggregation seam，与 AGENTS.md §2 一致。

### 2.5 manual send 在调用层有显式触发要求

**证据**：

- `lib/connectors/google.ts:116-120` `ensureManualSendAllowed({ explicitUserTrigger })` —— 缺失 trigger 时 throw
- `lib/connectors/google.ts:765-779` Aliyun / Gmail 真发送函数双重门：先 `ensureManualSendAllowed`，再 `if (!connector.manualSendEnabled) throw`

**结论**：调用点合规。但默认值有问题，见 §4.2。

## 3. 已成形但仍需下一层

### 3.1 Judgement / Why / Action / Boundary 卡片

**证据**：

- `features/dashboard/home-work-entry.ts:16-32` `DashboardHomeWorkEntryCard` 含 `title` / `subject` / `nextStep` / `boundary` 字段
- 但 `boundary: string | null`（line 22）—— **类型上允许缺省**

**问题**：

- DESIGN.md §7.2 明确写："没有 boundary 的卡片，很容易把 recommendation 写成 commitment"
- 当前类型 schema 允许 `null`，调用点未必每次都填
- 也没有 `why` / `reason` 字段；rationale 只能挤进 `subject` 或 `statusLabel`

**建议**：

- 短期：给 `DashboardHomeWorkEntryCard` 加一条 lint / build-time 检查，`boundary` 不能是 `null`（除非显式标 `boundaryWaived: true`）
- 中期：把卡片类型改为 `judgement / why / action / boundary` 4 个独立字段，强制都是 `string`

### 3.2 教学型 / 元描述文案残留

**证据**：

- `features/approvals/approvals-client.tsx:979` `"The approval center exists to keep trust boundaries and reason chains explicit..."`
- `features/approvals/approvals-client.tsx:990` `"This page exists so the system can explain the reason chain..."`
- `features/approvals/approvals-client.tsx:1099` `"This is still a trust-boundary control surface, not a generic task inbox."`
- `features/approvals/approvals-client.tsx:1170` `"The draft, recommendation explanation and result preview are ready..."`

**问题**：

- DESIGN.md §4.1 v2："不要尝试教用户做事情" 明确点名禁止"在用户操作流程中插入系统介绍段落"
- DESIGN.md §13.1 v2 改进总结："去除所有教育性内容；去除所有系统架构说明和教学式文案"
- approvals 页是 trust boundary 的核心面，但当前文案在元层（"this page exists"）描述系统而不是直达动作
- 与 dashboard 的 v2 简化对比明显：dashboard `page.tsx` 已经把 system-context 收到 disclosure（`features/dashboard/dashboard-home-secondary-disclosure` 内的"如果你想反驳排序"），approvals 还没

**建议**：

- 把 approvals-client.tsx 中元描述类长文案降级到 disclosure / drawer
- 第一屏只保留：当前最关键 1 条 review request、reason chain、4 个动作（approve / rewrite / convert / hold）
- 全文按 DESIGN.md §13.4 "用词要能激发用户行动意愿；用户看到文案后立即知道该做什么"重写

### 3.3 Tenant extension public-mirror 自动化缺位

**证据**：

- `lib/extensions/registry.tsx:1-23` 文件头注释明确说："Public mirror generation handles the case where extensions/<tenant>/ does not exist by either replacing this file with a stub or removing tenant entries from the local registries below."
- `lib/extensions/registry.tsx:34-60` 静态 import tenant-private extension 模块（3 个 tenant 模块）
- `lib/extensions/registry.tsx:194-243` `reportsExtensions` 数组直接包含 tenant-private extension entries

**问题**：

- 公开镜像生成依赖人工或脚本"替换为 stub 或移除条目"
- 如果 mirror 阶段忘记替换，private tenant 代码会泄漏到公开 release
- WORKING-CONTEXT.md §7 第 10 项已经把这点列为"private tenant signals UI 仍未物理迁移"风险

**建议**：

- 把 mirror-time 替换写成 `scripts/build-public-mirror.ts`，CI 强制执行
- 或者：把 tenant import 改为 `dynamic import + try/catch`，运行时检测 extensions 目录是否存在；这样 mirror 不需要改 source

### 3.4 audit log 静默失败

**证据**（同一类问题 6 处以上）：

- `lib/auth/session.ts:260-262` `} catch (error) { console.error("auth session rotation audit failed", error); }`
- `lib/auth/session.ts:307-309` 同上模式
- `lib/auth/session.ts:657-659` 同上
- `lib/auth/session.ts:720-722` 同上
- `lib/auth/session.ts:843-845` 同上
- `lib/auth/session.ts:1009-1011` 同上

**问题**：

- 业务动作（rotate / revoke / create / workspace-switch / workspace-realign / scope-revoke）都已经成功，但 audit log 写失败时**只 console.error，没有 retry、没有 metric、没有 fallback queue**
- README "审计 trace：关键写路径带 trace ID；统一用户可见 trace timeline 是发布硬门"
- 当前实现无法兑现"完整审计链"——一旦 db.auditLog 写失败（比如 1020 写冲突，WORKING-CONTEXT.md §7 第 2 项已经在 dailyUsageSnapshot / recommendationLog / membership 周边观察到 1020），审计就缺一段，**且无任何运行时信号告诉 owner 缺了一段**

**建议**：

- 短期：把 catch 升级为 `audit_write_failure` metric + 把失败写入 `AuditLogDeadLetter` 表 / 文件；同时 log 一条业务级 warning
- 中期：把 audit 写入封进 outbox pattern——业务事务 commit 时同时写 outbox，单独 worker drain 到 auditLog；保证业务/审计两端不会因为一个失败回滚另一个
- 不要因为"audit 失败也别拖累业务"就静默吞错。审计本来就是验收标准之一

### 3.5 activateMembershipIfInvited 隐式 accept-invite

**证据**：

- `lib/auth/session.ts:569-603` `activateMembershipIfInvited` —— 在 `getCurrentWorkspaceSession` 第 681-684 行被调用
- 把 `MembershipStatus.INVITED` 自动改成 `ACTIVE`

**问题**：

- 这是一次自动写。被邀请用户首次进入 workspace 时，没有任何"接受邀请"的显式交互
- 与"未经明确批准没有广泛的自动写入"边界的字面表达有张力
- 实际场景下"用户已点了邀请链接 → 进入工作区"可以视为 implicit consent，但当前没有：
  - audit log（这条 status 变更没写 audit）
  - 用户可见提示（"你已加入 X 工作区"）
  - opt-out 路径

**建议**：

- 短期：给这条 transition 写 audit log（actionType: `MEMBERSHIP_AUTO_ACTIVATED_ON_FIRST_USE`），把"自动"显式化
- 中期：评估是否改为显式 accept-invite 页（用户首次进入 workspace 时弹一次确认）；当前 trial 阶段可以保留隐式但必须留痕

## 4. 风险项（建议尽快收口）

### 4.1 audit log 静默失败

见 §3.4。从优先级角度提到风险项位置：这是当前最容易让"审计 trace 完整"承诺破功的点。

### 4.2 manualSendEnabled 默认 true

**证据**：

- `lib/connectors/google.ts:480` `manualSendEnabled: input.manualSendEnabled ?? true`（create 分支）
- `lib/connectors/google.ts:500` 同上（update 分支）

**问题**：

- 配置 Aliyun 邮箱连接器时如果调用方不显式指定，**默认开启 send 权限**
- 与 README "默认没有 send authority" 的口径相反
- README 的契约口径是"复核闸口，每条留痕"，但这里把闸口默认打开，依赖 `ensureManualSendAllowed({ explicitUserTrigger })` 在调用栈下游兜底

**建议**：

- 改成 `manualSendEnabled: input.manualSendEnabled ?? false`
- 在 `/settings` 连接器卡片上加一个独立的"启用人工发送"开关，状态变更必须 audit
- 连接器表里如果存量数据已经 `manualSendEnabled = true`，加 migration 提示 owner 显式确认

### 4.3 sendSystemMail 没有 ensureManualSendAllowed 包装

**证据**：

- `lib/notifications/system-mail.ts:31-66` `sendSystemMail` 直接 `transporter.sendMail`，没有任何"显式触发"门
- `lib/notifications/system-mail.ts:68-88` `sendSystemMailIfConfigured` 也只判断了 `isSystemMailConfigured()`

**调用方**：

- `features/auth/actions.ts:301` 注册验证码（用户触发，OK）
- `features/settings/actions.ts:899` 邀请邮件（admin action 触发，OK）
- `features/trial/actions.ts:102` 试用通知（待核实）

**问题**：

- 当前调用方都是合规的人为触发，但 lib 层没有兜底
- 任何未来代码（cron、background worker、subscriber）都可以无门槛调 `sendSystemMail`，这与 google connector 的双门设计不一致
- 一致性差异本身就是风险（reviewer 不一定记得 system-mail 是裸的）

**建议**：

- 给 `sendSystemMail` 也加一个 `purpose: "auth_code" | "invite" | "trial_notification"` 参数 + 白名单校验，禁止 ad-hoc 调用
- 或者把白名单写在 `sendSystemMailIfConfigured`，把裸 `sendSystemMail` export 改为 internal

### 4.4 Salesforce 连接器 raw payload 的多次 `as unknown as Record<string, unknown>`

**证据**：

- `lib/connectors/salesforce.ts:516, 540, 558, 573, 594` 5 处 `item as unknown as Record<string, unknown>`

**问题**：

- 这是 type-safety escape；Salesforce 返回结构是外部 API，没有 zod / schema 校验
- 一旦 Salesforce schema 变化或返回 null / 数组，下游 read 不会 throw，可能写入 Memory / signal 的字段不正确
- README 把 Salesforce 列为 `Alpha`，确实承认尚不完整；但 alpha 意味着用户可能拿真凭据接入

**建议**：

- 加 zod schema 校验外部返回；schema 失败时降级为"未识别 record"并写 audit
- 不要把 raw payload 当 truth 直接喂下游

### 4.5 multiple 1020 concurrency hot spots 已知未修

**证据**：

- WORKING-CONTEXT.md §7 第 2 项："MySQL 1020 concurrency warning trace 在 dailyUsageSnapshot、recommendationLog、membership 周边出现"
- `lib/recommendations/recommendation.service.ts:64-76` `isRecommendationPersistenceConflict` —— 已经识别 1020 / P2034 / "Record has changed"
- `lib/auth/session.ts:539-542` `isMembershipActivationWriteConflict` —— 同样的识别 + retry 路径

**问题**：

- 已知问题，retry 已经写在两处，但分散；没有统一的 conflict-aware 写入封装
- WORKING-CONTEXT 把它列为 P0：五月 Phase 3 解禁前必须收口

**建议**：

- 把 1020 retry 抽成 `lib/db/conflict-aware-write.ts` 工具，业务点不再各自实现
- 同时把 retry 上限 / backoff / 失败兜底集中管理

## 5. 刻意未做（不要扩张）

按 AGENTS.md §6 与 §13，下面这些当前是诚实保留状态，**不应被本轮审计触发的改动顺手做掉**：

1. 真正的 plugin sandbox（§6.1）—— `lib/runtime-server-minimal.ts` 的 boundary 注释和 effect blocked 路径都明确说明
2. 完整生产级 SSO / SCIM（§6.3）—— `lib/auth/session.ts` 是受控试点级 cookie session
3. 完整 multi-org / multi-tenant 平台（§6.5）—— `data/queries.ts` 强制 single workspace scope
4. 自动承诺 / 自动外发（§6.6）—— recommendation → governed action → approval 三层都需要人为操作
5. marketplace（§13.6）—— `app/programs/page.tsx:79` 与 `app/programs/[slug]/page.tsx:147` 都明确写"不是公开市场。永远不做公开排名。"
6. 完整 BI / workflow / orchestration / auto-execution plane（§13.8-13.10）

**结论**：硬边界没有偷偷被破。本审计**不**建议触碰这些。

## 6. 设计原则映射证据表

| 设计原则 | 关键文件 | 行号锚点 | 状态 |
| --- | --- | --- | --- |
| no plugin sandbox | `lib/runtime-server-minimal.ts` | 250-257, 307, 903-916 | 完整成立 |
| no real auto-execution | `lib/runtime-server-minimal.ts` | 245-248 (LOCAL_EFFECTS), 919-926 | 完整成立 |
| recommendation 持久化与 governed action 分离 | `lib/recommendations/recommendation.service.ts` | 288, 728-762 | 完整成立 |
| approval gate 有 capability check | `features/approvals/actions.ts` | 42, 81, 137, 165, 186 | 完整成立 |
| workspace 范围强制 | `data/queries.ts` | 全文 | 完整成立 |
| manual settlement 状态机 | `lib/billing/manual-settlement.ts` | 327-407 | 完整成立 |
| email send 显式触发门 | `lib/connectors/google.ts` | 116-120, 765-779 | 完整成立 |
| 4 层卡片结构 | `features/dashboard/home-work-entry.ts` | 16-32 | 已成形但仍需下一层（boundary 可空） |
| 不教用户 / 直达动作 | `app/(workspace)/dashboard/page.tsx` | 全文 | 完整成立 |
| 同上（approvals 面） | `features/approvals/approvals-client.tsx` | 979, 990, 1099, 1170 | 已成形但仍需下一层（残留教学型文案） |
| audit trace 完整性 | `lib/auth/session.ts` | 260, 307, 657, 720, 843, 1009 | 风险项（catch + console.error） |
| send authority 默认值 | `lib/connectors/google.ts` | 480, 500 | 风险项（默认 true） |
| extension 公开镜像 seam | `lib/extensions/registry.tsx` | 1-23, 194-243 | 已成形但仍需下一层（人工 mirror 替换） |
| 健康降级面 | `app/health/page.tsx` | 全文 | 完整成立 |

## 7. 推荐修复优先级（前 5 件）

1. **审计 trace 失败可见化**（§3.4 / §4.1）—— 与 README 公开承诺直接相关；最少改动：把 6 处 `console.error` 升级为 `audit_write_failure` metric + dead-letter；3-5h 工作量
2. **manualSendEnabled 默认 false**（§4.2）—— 一行代码默认值翻转 + migration script 标记现有数据 + /settings UI 加显式开关 + audit；估 3-4h
3. **approvals-client v2 简化**（§3.2）—— 把 `approvals-client.tsx` 4591 行内的元描述类文案降级到 disclosure；按 DESIGN.md §13.4 准则重写；估 1-1.5d
4. **`DashboardHomeWorkEntryCard.boundary` 强制非空**（§3.1）—— 类型 + lint + 调用点收口；估 4-6h
5. **`sendSystemMail` purpose 白名单**（§4.3）—— 与 google connector 双门设计对齐，关闭未来 ad-hoc 调用通道；估 2-3h

## 8. 不推荐做（即使顺手）

- 不做 sandbox（AGENTS.md §13.5）
- 不做 marketplace（§13.6）
- 不做完整 SSO / SCIM（§6.3）
- 不做"统一封装"把 manual settlement 的状态机改成可配置 workflow engine（§13.8）
- 不把 approvals 文案"全删"——只是降级到 disclosure；用户**主动展开**时仍需要这些上下文

## 9. 数据 / 测试 / 文档同步建议

按 AGENTS.md §12，这份审计涉及的修复落地时应同步：

- §3.4 审计日志失败处理：更新 `scripts/helm-self-check.ts` 增加 `audit_write_failure` 指标检测；更新 `docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md` 把 audit dead-letter 监控加入 receipt
- §4.2 manualSendEnabled 默认值：更新 `docs/integrations/INTEGRATION_TEMPLATE.md`（如果存在）+ Aliyun mail 连接器 README
- §3.2 approvals 简化：更新 `DESIGN.md §13` v2 总结，把 approvals 列入"已完成 v2 简化"
- §3.3 mirror 自动化：在 private tenant separation plan 中记录新的自动化 seam（如果决定走 dynamic import 路径）

## 10. 审计未覆盖的范围（诚实保留）

为了在合理时间内交付，本轮审计**未深入**：

- LLM workflow（`lib/llm/`、`lib/llm-workflows/`）的提示注入 / 越权调用风险
- Connector 子集（DingTalk MCP、HubSpot、Stripe webhook 时序）的端到端审计
- Memory 写失败 retry 链 (`lib/memory/write-failure-*`) 的边界完备性
- E2E `tests/e2e/` 是否覆盖了审计 trace 失败、1020 retry、连接器降级三类边界
- tenant-private extension 内部代码的边界与首方层的接口契约一致性
- `app/api` 下 50+ route 的逐个 capability check（仅抽样了 `bi-report/handoff-actions/route.ts`）

下一轮审计建议从 LLM 调用栈、connector 端到端、memory write retry 三处入手；每一块单独立项，避免把"代码审计"做成"全代码审计"。

## 11. 一句话结论

Helm 当前主干在硬边界、建议/承诺分离、workspace 范围、manual settlement 这四条核心约束上**做得明显高于业界平均**，且约束是写在代码里而不是只在文档里。需要修的地方集中在两类：
（a）"边界默认值"（manualSendEnabled = true、boundary = nullable）让人质疑公开口径
（b）"审计/治理面"（audit log 静默失败、approvals 面残留教学型文案）让"可验收"打折

按 §7 的 5 件事修完，这两个缝隙都能收住，整体可以从 `A` / `A-minus` 进一步收紧。

---

## 14. Fix Log（2026-05-03，同会话内修复）

下面记录本份审计提交后**同会话**内已经修完的项。每条标注"修复 commit"位置（按本会话工作树状态）、关键文件、与遗留事项。

### 14.1 §3.1 boundary 强制非空 — **已修**

- 类型：`features/dashboard/home-work-entry.ts:16` `DashboardHomeWorkEntryCard.boundary` 改为 `string`（非空）
- 类型：`features/dashboard/home-surface-routing.ts:14` `DashboardHomeSurfaceRoutingCard.boundary` 同步收紧
- 新增 `defaultBoundary(english, kind)` helper，覆盖 5 种 kind（first-loop-non-review / goal-driven / assignment / resume-implicit / blocker）
- 5 个 builder 站点（line 158, 188, 276, 296, 327）由 `null` 改为 `defaultBoundary(...)` 真实文案
- 测试 fixture：`features/dashboard/home-surface-routing.test.ts` 6 处 `boundary: null` 替换为有意义字符串

### 14.2 §3.2 approvals client v2 文案精简 — **已修**

- `features/approvals/approvals-client.tsx` 4 段元描述类文案降级为 action-first：
  - line 974-980 `summary`：从"the approval center exists to keep trust boundaries..."改为 `${pending} pending · ${highRisk} high-risk · ${external} external. Open the top item and decide.`
  - line 989-991 `takeaways[2]`：从"this page exists so the system can explain..."改为 `Each row carries its reason chain. Open it before deciding approve / rewrite / hold.`
  - line 1099-1100 `pageBoundarySummary[1]`：从"this is still a trust-boundary control surface, not a generic task inbox"改为 `Recommendation stays recommendation until you let it through; nothing here ships on its own.`
  - line 1169-1171 `activeReportReason` fallback：从"the draft, recommendation explanation and result preview are ready..."改为 `Draft, reason and preview are ready — open and decide.`
- 4591 行文件其余部分未触碰（避免无关回归）

### 14.3 §3.4 审计 trace 失败可见化 — **已修**

- `lib/audit/index.ts` 新增：
  - `recordAuditWriteFailure({ attempted, error })`：增计数 + 推入 ring buffer + 写一行结构化 stderr `helm.audit_write_failure` JSON
  - `safeWriteAuditLog(input)`：包装 `writeAuditLog`，失败时调用 `recordAuditWriteFailure` 并返回 `null`
  - `getAuditWriteFailureSummary()`：返回 `{ totalCount, recent[] }`，可被 `/health` 与 self-check 引用
  - `resetAuditWriteFailureSummaryForTesting()`：测试辅助
- `lib/auth/session.ts` 6 处 `try { writeAuditLog(...) } catch { console.error(...) }` 全部替换为 `safeWriteAuditLog(...)`
- `lib/auth/session.test.ts` 的 `vi.mock("@/lib/audit", ...)` 同步声明 `safeWriteAuditLog` / `recordAuditWriteFailure`
- 遗留：`/health` 与 self-check 尚未消费 `getAuditWriteFailureSummary`；下一步把它接进降级面与 release receipt

### 14.4 §3.5 implicit accept-invite 留痕 — **已修**

- `lib/auth/session.ts:561-617` `activateMembershipIfInvited`：当 INVITED → ACTIVE 翻转生效（`activation.count > 0`）时写一条 `MEMBERSHIP_AUTO_ACTIVATED_ON_FIRST_USE` 审计
- 新导出常量 `MEMBERSHIP_AUTO_ACTIVATED_AUDIT_ACTION` 便于后续 audit 查询/告警
- 走 `safeWriteAuditLog`，审计失败不影响业务流程，但失败本身被 §3.4 的 ring buffer 捕获
- 仍未做：显式 accept-invite 页（仍按隐式接受处理；此修复只是把"自动"显式化）

### 14.5 §3.3 tenant extension public-mirror 自动化 — **未修（刻意保留）**

- 涉及 build pipeline 与 mirror 生成脚本，超出本轮代码审计修复范围
- 需要 owner 决定走 (a) `scripts/build-public-mirror.ts` 自动替换 还是 (b) 改为 dynamic import + try/catch graceful fallback
- WORKING-CONTEXT §7 第 10 项已经在跟踪此事；本审计只是再次确认风险

### 14.6 §4.2 manualSendEnabled 默认 false — **已修**

- `lib/connectors/google.ts:480, 500` 两处 `manualSendEnabled: input.manualSendEnabled ?? true` 翻转为 `?? false`，与 Prisma schema `@default(false)` 对齐
- `features/connectors/actions.ts:264-285` 调用 `configureAliyunMailConnector` / 写审计时同步翻转
- `features/settings/settings-client.tsx:364` UI 草稿初值翻转为 false
- 唯一仍然显式 `true` 的入口：`connectAliyunFounderDefaultAction()`（独立的 founder default 动作，刻意保留）

### 14.7 §4.3 sendSystemMail purpose 白名单 — **已修**

- `lib/notifications/system-mail.ts` 重写：
  - 新增 `SYSTEM_MAIL_PURPOSES` 枚举常量与 `SystemMailPurpose` 类型
  - `assertSystemMailPurpose(purpose)` 在每个公开入口先校验
  - 裸 `sendSystemMail` **不再 export**；外部只能通过 `sendSystemMailIfConfigured`
  - 任何未列名的 purpose 都会 throw `Unknown system mail purpose: ...`
- 3 处调用全部更新：`features/auth/actions.ts:301`（`AUTH_CODE`）、`features/settings/actions.ts:899`（`ORG_INVITE`）、`features/trial/actions.ts:102`（`TRIAL_APPLICATION_NOTIFY`）
- `lib/notifications/system-mail.test.ts` 新增 `rejects unknown purposes` 用例
- 新增 purpose（例如未来的密码重置邮件）必须在 `SYSTEM_MAIL_PURPOSES` 显式登记，强制走 review

### 14.8 §4.4 Salesforce zod 校验 — **已修**

- `lib/connectors/salesforce.ts` 顶部新增 5 个 zod schema（Account / Contact / Opportunity / Event / Task）+ `parseSalesforceRows` helper
- `salesforceQuery<T>` 的泛型参数改为 `unknown`；返回的 raw payload 经 `parseSalesforceRows` 校验
- 校验失败的响应整体降级为 `[]`，并写一行 `helm.salesforce_response_invalid` 结构化 stderr，避免崩溃 / 静默喂下游
- 5 处 `as unknown as Record<string, unknown>` 替换为 `toRaw(item)`（item 已经是 zod 校验过的 object，可安全转型）
- 旧 type 别名删除（zod 校验已经覆盖）；零 lint warning

### 14.9 §4.5 1020 conflict-aware retry 集中化 — **已修**

- 新增 `lib/db/conflict-aware-write.ts`：
  - `isWriteConflictError(error)`：覆盖 P2034 / 1020 / "Record has changed since last read" / "transaction conflict" / "deadlock" / "write conflict"
  - `runWithWriteConflictRetry(thunk, options?)`：默认 3 次 / 25ms 间隔，最后一次失败原样抛出
- `lib/recommendations/recommendation.service.ts`：
  - `isRecommendationPersistenceConflict` 现在是 `isWriteConflictError` 的 re-export（保持外部 API 不破）
  - `persistRecommendations` 的手写循环替换为 `runWithWriteConflictRetry(...)`
- `lib/auth/session.ts`：`isMembershipActivationWriteConflict` 也改为 `isWriteConflictError` 的 re-export，行为不变
- 后续点：把 `dailyUsageSnapshot` / `membership` 写入也包进 `runWithWriteConflictRetry`，按 WORKING-CONTEXT §7 #2 的 1020 hot-spot 列表逐个收口

### 14.10 验证状态

| 验证 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint --max-warnings 0` 修改文件全集 | 0 errors / 0 warnings |
| 影响面 vitest（lib/auth/session、lib/recommendations、lib/notifications、lib/connectors、lib/audit、lib/db、features/{auth,connectors,settings,trial,approvals,dashboard}） | 192-353 测试全部通过 |
| `npm run check:boundaries` | all rules pass |

未跑 / 刻意推迟（按 AGENTS.md §10 的统一验证链口径）：

- `npm run db:reset` — 本机 DATABASE_URL 未配置 production-grade DB，避免破坏性 reset
- `npm run e2e` — 同上
- `npm run quality:regression` — 大型聚合，需要在隔离库 `helm2026_ci_verify` 跑；建议下一轮 owner 走 release receipt 时一并跑

### 14.11 当前剩余风险（修复后）

- §3.3 mirror automation：仍未做，等 owner 决策
- §4.5 后续：1020 hot-spot 在 `dailyUsageSnapshot` / `membership` 周边的写路径还没接进新 helper（现在只接了 recommendation + membership activation）；P0 release 前应补
- /health 与 self-check 还未消费 `getAuditWriteFailureSummary`
- approvals-client.tsx 4591 行的其余教学型文案只做了 4 段精修；下一轮如要彻底 v2 化，需要分块重构页面骨架，不在本轮范围
- §10 未覆盖：LLM 调用栈、connector 端到端、memory write retry 链 三块

## 15. Round-2 Audit + Round-3 Fix Log（2026-05-03，同会话内）

第一份审计的 §10 列出三块"未覆盖"：LLM 调用栈、connector 端到端、memory write retry 链。本轮（round-2）把这三块都做了 sample 审计；并把 §14.11 中"未做"的两条（/health + self-check 接入 audit failure 计数；1020 retry 接入 dailyUsageSnapshot）一并落地。

### 15.1 LLM 调用栈审计 — 完整成立 + 1 处小修

**评估**：lib/llm 与 lib/llm-workflows 的防御深度明显高于业界平均。具体证据：

- `lib/llm/openai-adapter.ts:158` `user: input.userId` 传给 OpenAI 用作 abuse tracking
- 任务级别 timeout（`getRequestTimeoutMs(taskType)`，line 98）：默认 6s / reasoning 120s / external assignment 600s，可由 `LLM_HTTP_TIMEOUT_MS_*` 环境变量覆盖，全部 bounded
- `lib/llm/context-audit.ts:76-84` `FORBIDDEN_CONTEXT_PATTERNS` 在所有 prompt 上扫 `access_token` / `refresh_token` / `secret_key` / `api_key` / `password` / `mysql://...@` / `bearer xxxx`；命中即记入 audit failures
- `lib/llm/context-audit.ts:61-74` `BOUNDARY_MARKERS`（"不要"/"不能"/"边界"/"承诺"/"自动执行"/"自动发送"/"审批"/"deterministic"）作为评分维度强制 prompt 必须显式表达边界
- `lib/llm/provider-registry.ts:42-79` 双门：workspace 级 `llmEnabled` AND env 级 `isLLMEnabledByEnv` 必须都为 true 才走真 LLM；任一关闭即走 `fallbackOutput`
- `lib/llm-workflows/process-meeting-memory.workflow.ts:167-215` parse 层有 `validObjectIds` 白名单 + `clampNumber` + `normalizeObjectType` + `normalizeFactType` + `dedupeByContent` + `extractedBy: "llm"` 标签——LLM 输出无法引用 workspace 外的对象、无法越界 confidence/severity、无法绕开后续 memory pipeline 的 dedup/audit
- 所有 LLM 任务都强制 `fallbackOutput`（同文件 line 124）；LLM 失败时确定性回退 + 在 `recordLLMCall` 留 `fallbackUsed=true` + `fallbackReason`，对 caller 可见

**唯一小修（已应用）**：

- `lib/llm/openai-adapter.ts:186-200` 在抛出 OpenAI-compatible fetch failed 时曾直接拼接 raw `baseUrl`。如果自托管 gateway 在 URL userinfo 中携带凭据，凭据会进入异常消息 → `errorMessage` 字段 → LLM call log → caller。新增 `sanitizeUrlForError()` helper 用 `URL` 解析剥离 userinfo。

**评级**：完整成立（修这一处后无残余风险点）。

### 15.2 Connector 端到端审计（DingTalk + HubSpot + WeCom + Salesforce）— 已成形 + 7 处小修

**评估**：

- DingTalk OAuth（`lib/connectors/dingtalk.ts:285-389`）路径正确：`POST` body 提交 `clientSecret`，不进 query string；`Bearer` 取值流程合规
- HubSpot OAuth（`lib/connectors/hubspot.ts:118-159`）类似，标准 `application/x-www-form-urlencoded` 流
- DingTalk MCP stdio（`lib/connectors/dingtalk-mcp-client.ts:324`）使用 array-form `spawn(cmd, args)`——无 shell injection；`getMcpCommand()` / `getMcpArgs()` 可由 env 覆盖，且 `check:spawn-env-supply-chain` 已经把它列入 warn-mode 已知清单
- Salesforce 已经在 round 1 §14.8 加了 zod 校验 + `parseSalesforceRows` 回退

**问题**：4 个 connector 的 7 处错误抛出都是 `throw new Error(\`... failed: ${body}\`)`，把 provider 完整响应体直接拼进异常消息：

| 文件 | 行号 | 抛出位置 |
| --- | --- | --- |
| `lib/connectors/dingtalk.ts` | 309 | DingTalk token exchange failed |
| `lib/connectors/dingtalk.ts` | 349 | DingTalk app access token failed |
| `lib/connectors/dingtalk.ts` | 387 | DingTalk userinfo failed |
| `lib/connectors/hubspot.ts` | 133 | HubSpot token exchange failed |
| `lib/connectors/hubspot.ts` | 159 | HubSpot token refresh failed |
| `lib/connectors/hubspot.ts` | 175 | HubSpot API failed |
| `lib/connectors/salesforce.ts` | 223, 247 | Salesforce token / query failed |
| `lib/connectors/wecom.ts` | 372, 470, 505, 553 | WeCom calendar / token / oauth / profile failed |
| `lib/connectors/wecom-ingestion.ts` | 269, 305 | WeCom meeting list / info failed |

风险：部分自托管 / 中转网关在错误响应体里 echo 回请求 payload；如果触发了那种回显路径，`client_secret` / `access_token` / `Bearer xxx` / `password` 就会进异常消息 → 异常被 `recordLLMCall` / `safeWriteAuditLog` 记下 → 进 audit log / observability pipeline。本仓库的 provider 在常规失败下不回显 secret，但这是依赖 provider 行为的"软边界"。

**修复（已应用）**：

- 新增 `lib/connectors/error-redaction.ts` `redactProviderErrorBody(body, maxLength=240)`：
  - 用 7 条 regex 屏蔽 `client_secret` / `access_token` / `refresh_token` / `api_key` / `appsecret` / `password` / `Bearer xxx`
  - trim 到 240 字符 + 末尾省略号
- 上述 13 处 `${body}` / `${await response.text()}` 全部改为 `${redactProviderErrorBody(body)}`
- 新增 `lib/connectors/error-redaction.test.ts`（7 个 case）锁定行为：包含 redact、trim、保留正常 errcode/errmsg

**评级**：已成形但仍需下一层（仍有 connector，比如 Stripe / 支付宝 / 微信支付 webhook 错误路径未审计；建议下一轮统一巡检）。

### 15.3 Memory write retry 链审计 — 完整成立 + 1 处小修

**评估**：`lib/memory/write-retry-bounded-executor.ts` 设计严格符合 WORKING-CONTEXT §4 "review-first / read-only operator substrate"：

- `executeMemoryWriteRetry` 的 6 道前置门（line 110-120）：`manualConfirmation.confirmed` → `attemptCount >= attemptLimit` → `backoffElapsed` → `sourceProof.proofStatus === "ready_for_executor"` → DB 锁预约 → 锁状态更新
- 任何门未过返回 `blockedResult(status, reason)`，结构里固定 `manualConfirmationRequired: true` / `canExecuteAutomatically: false` / 边界文案
- 真正写入只发生在 line 225 `createMemoryFactsWithWriteResult({ facts: [reconstructedFact], continueOnFailure: false })`——只允许写一条 reconstructed fact，不重跑 meeting pipeline、不创建 commitment / blocker / recommendation、不发外部消息
- `dryRun: true` 时 line 196-209 只验证锁 + source proof，不真写
- 成功 / 失败两条路径都有 audit 写入（新 fix 见下）
- WriteFailure operator queue (`lib/memory/write-failure-operator-queue.ts`) 显式：`canAutoRetry: false`，`reviewPosture` 限制在 4 个枚举值（retry_manual_confirm / merge_conflict_review / source_data_repair / inspect_audit_payload）

**唯一小修（已应用）**：

- `lib/memory/write-retry-bounded-executor.ts:255` 与 `:314` 两处 audit 写入用的是裸 `writeAuditLog`。若 audit 写失败：(a) line 255 的成功路径会让 executor 函数 throw，但此时 MemoryFact 已经成功写入（line 225-229）—— business state 与 audit state 不一致；(b) line 314 失败路径同理
- 改为 `safeWriteAuditLog`，落入 §3.4 的 ring buffer，executor 不会因为 audit 写失败崩溃；`/health` 的 audit-write-drops 行会显示这种丢失
- 测试 mock `lib/memory/write-retry-bounded-executor.test.ts:14` 同步声明 `safeWriteAuditLog` / `recordAuditWriteFailure`

**评级**：完整成立。

### 15.4 §14.11 follow-through —— 已落地

| 原 §14.11 项 | 状态 | 落地位置 |
| --- | --- | --- |
| /health 与 self-check 接入 `getAuditWriteFailureSummary` | **已修** | `app/health/page.tsx` 加第 6 个 health row（healthy 0 / degraded N，body 列出最近 3 个失败 actionType）；`scripts/helm-self-check.ts` 新增 `audit_write_failure_helper_wired` 检查（验证 lib/audit 导出齐全 + session.ts 不再有 `console.error('...audit failed')` 反模式 + /health 真的引用了 summary） |
| 1020 retry 接入 `dailyUsageSnapshot` 写路径 | **已修** | `lib/analytics/index.ts:78-110` 把 `db.eventLog.create` 与 `db.dailyUsageSnapshot.upsert` 都包进 `runWithWriteConflictRetry`；其余 membership 写在 server actions 里多为 admin 单击触发，不是 1020 hot spot，不强制包 |

### 15.5 验证状态（round-2 + round-3 累计）

| 验证 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint --max-warnings 0` 修改文件全集 | 0 errors / 0 warnings |
| `npm run check:boundaries` | all rules pass |
| `audit_write_failure_helper_wired` 自检 | PASS |
| 影响面 vitest（lib/auth、lib/recommendations、lib/notifications、lib/connectors、lib/audit、lib/db、lib/memory、lib/analytics、lib/llm、features/{auth,connectors,settings,trial,approvals,dashboard}） | 全部通过 |

### 15.6 当前剩余风险

- §3.3 tenant extension public-mirror 自动化（owner 决策）
- 其余 connector（Stripe / 支付宝 / 微信支付 webhook、阿里邮箱 IMAP 错误路径）的错误体审计未跑
- DingTalk MCP stdio 把 `...process.env` 整体传给子进程；当前子进程是 `npx -y dingtalk-mcp@latest`（动态版本），属于已知供应链风险并已在 `check:spawn-env-supply-chain` warn 列表；下一轮可考虑：(a) 锁版本，(b) 用 deny-list 收窄 env
- approvals-client.tsx 仍是 4591 行，整体 v2 化超出本轮范围

## 16. Round-3 Sweep + Round-4 Hardening Log（2026-05-03，同会话）

### 16.1 §15.6 三件 follow-through

| §15.6 项 | 状态 | 落地位置 |
| --- | --- | --- |
| 其余 connector 错误体审计 | **已扫 + 已修** | Stripe / Alipay / China-payment 错误抛出全部 bounded（"missing X" / "verification failed" 等）—— 不需要 redaction；新增 redact 在 `lib/bi-report-skill/delivery/dingtalk-group-webhook.ts:67`、`lib/bi-report-skill/delivery/dingtalk-app-message.ts:107` 把 DingTalk delivery 的 `responseBody` 在返回前 redact，避免 access_token 走 `_v2` URL querystring 时被 echo 进 audit |
| DingTalk MCP env 收窄 | **已修** | `lib/connectors/dingtalk-mcp-client.ts:340-380` 引入 `MCP_CHILD_DENIED_ENV_PREFIXES`（`DATABASE_URL` / `OPENAI_API_KEY` / `LLM_*` / `ALIYUN_*` / `STRIPE_*` / `ALIPAY_*` / `WECHAT_PAY_*` / `HUBSPOT_*` / `SALESFORCE_*` / `CONNECTOR_TOKEN_SECRET` / `AUTH_SECRET` / `SESSION_SECRET` / `SENTRY_DSN` / `DD_API_KEY` / `AWS_*` / `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_CLIENT_SECRET`）+ `buildMcpChildEnv()`：deny-list 而非 allow-list（保留 PATH / HOME / NODE_* / NPM_* / LANG / TZ 等运行时基础环境，兼容上游 `dingtalk-mcp@latest` 的未知依赖）。DingTalk 自身需要的 vars 显式重新挂上。`spawn` 调用类型注解为 `ChildProcessWithoutNullStreams` 解开 overload 歧义 |
| §3.3 mirror 替换自动化 | **已落地工具，未接入 CI** | 新增 `scripts/build-public-mirror-extensions-stub.ts`：deterministic + idempotent，把 `lib/extensions/registry.tsx` 替换成 signature-compatible 的 stub（每个 resolver 返回 "no extension available" 的 null/empty 形态）。支持 `--check` 模式（registry 与 stub 不同时 exit 1），方便公开镜像 CI 在 push 前调用。**owner 决策仍是**：是否把 `--check` 接入 mirror generation pipeline；本工具只把"如何"做掉了 |

### 16.2 verbose audit 路径中的二次 redaction

外部协作者在 `lib/audit/index.ts` 同步加入了 `redactAuditWriteFailureMessage` —— `recordAuditWriteFailure` 在写入 ring buffer / stderr 前用 7 条 regex（包括 `mysql://...@` 与 `Authorization: Bearer xxx`）对 error.message 二次 redact，并截断到 240 字符。这与本轮的 `lib/connectors/error-redaction.ts` 形成两层：connector 在 throw 前 redact 一次，audit 在落库 / 落日志前 redact 一次。即使有调用方忘记 redact，audit 失败的可见信息也不会泄密。

### 16.3 ASCII ellipsis 收口

外部协作者把 `redactProviderErrorBody` 的截断尾部从 Unicode `…`（U+2026）改为 ASCII `...`，`maxLength - 1` → `maxLength - 3` 同步调整。`error-redaction.test.ts` 的"trims long bodies and adds an ASCII ellipsis"用例锁定。这避免了部分日志收集管道把 `…` 当成 multibyte 截断目标。

### 16.4 验证状态

| 验证 | 结果 |
| --- | --- |
| `npx tsc --noEmit` 排除非本轮触及的 `lib/evals/internal-ai-service-provider-pack-evals.ts`（CodeX 平行修改中） | 0 errors |
| `npx eslint --max-warnings 0` 修改文件全集 | 0 errors / 0 warnings |
| `npx vitest run lib/connectors lib/llm lib/memory lib/auth lib/audit lib/recommendations lib/notifications lib/analytics lib/bi-report-skill features/{connectors,auth,settings,trial,approvals,dashboard}` | **125 文件 / 533 测试**全部通过 |
| `npx tsx scripts/build-public-mirror-extensions-stub.ts --check`（私有仓库） | exit 1（`not-stub` —— 符合预期，registry 当前是 tenant-bearing 版本） |

### 16.5 当前剩余风险

- §3.3 mirror CI 接入仍是 owner 决策（脚本已就绪）
- DingTalk MCP 上游版本仍是 `dingtalk-mcp@latest` 浮动版本；deny-list 已经把 blast radius 收窄，但锁版本仍是更彻底的下一步
- approvals-client.tsx 整体 v2 化（4591 行）—— 仍超出本轮范围，建议作为独立 sprint
- LLM context-audit 框架（`buildLLMContextAudit`）已经存在但只在 provider-registry 层调用一次；评分结果落到 LLM call log 的 `inputSummary` 但没有形成独立告警；下一轮可以把评分阈值（`overall < 60` / `failures.length > 0`）接到 self-check 或 /health

## 17. Rounds 6–14：扩展安全 sweep（同会话）

应 owner "再做十个回合"的要求，本节记录在 §16 之外补做的 9 轮针对性安全审计。每轮单独着色：发现项 + 是否落地修复 + file:line 证据。

### 17.1 Round 6：Cookie 安全

**已审**：`lib/auth/session.ts:103-110`、`lib/auth/public-oauth.ts:181-187, 440-453`、所有 OAuth state cookies、UI locale cookie。

**结果**：

- ✓ Session cookie：`httpOnly` + `sameSite=lax` + 生产环境强制 `secure`（line 105-108 的 `buildCookieOptions`）
- ✓ OAuth provider state cookies（DingTalk / WeCom / HubSpot / Salesforce / Google）：httpOnly + sameSite=lax + 短 maxAge
- ⚠️ → ✓ 修复：`lib/auth/public-oauth.ts:181-187` 的 `PUBLIC_OAUTH_SIGNUP_PREFILL_COOKIE` 与 `:440-453` 的 `getPublicOauthStateCookieName(...)` cookie **缺少 secure 标志**。在生产环境中如果有反向代理把 HTTPS 终结到 HTTP，cookie 可能在明文链路上传播。两处都补上 `secure: process.env.NODE_ENV === "production"`

### 17.2 Round 7：Server-action input 校验扫盲

**已审**：20 个 `features/*/actions.ts`，按 zod 使用密度排序。

**结果**：

- 3 个 actions.ts 文件 zod 引用 = 0：`features/connectors/actions.ts`、一个 tenant-private signals action 文件、`features/inbox/actions.ts`
- 抽样 `features/inbox/actions.ts:15-56` 等：所有 string 入参都通过 Prisma `findFirst({ where: { id, workspaceId } })` 验证存在性 + workspace 范围；不存在时返回友好错误，不抛异常
- 所有写入路径都通过 `createGovernedAction` 走标准审批流，没有任何 raw SQL 注入面

**结论**：完整成立。零 zod 不等于零校验—— Prisma 的 unique-constraint 复合键 + workspace 范围已经把入参作为 lookup key 承担了校验责任。建议未来仍逐步加 zod 作为防御深度，但不属于安全风险。

### 17.3 Round 8：Prisma raw query / SQL injection

**已审**：所有 `$queryRaw` / `$executeRaw` / `$queryRawUnsafe` / `$executeRawUnsafe` 使用点。

**结果**：

- `lib/connectors/dingtalk-directory-invite-snapshot.ts:90, 124, 251`：使用 Prisma 标记模板字面量（`$queryRaw\`...${var}...\``），`${var}` 自动参数化为 `?` 占位符，**不会**字符串拼接到 SQL。✓
- `scripts/sqlite-to-mysql-migration.ts`、`scripts/mysql-spec-mandatory-check.ts`、`scripts/mysql-apply-zh-comments.ts`：使用 `$queryRawUnsafe`，但所有动态部分都来自 `sqlite_master` / `INFORMATION_SCHEMA` 等内部 metadata 来源，且通过 `quoteIdentifier()` helper 转义，**不接收任何用户输入**

**结论**：完整成立。零 SQL injection 风险。

### 17.4 Round 9：timing-safe comparison

**已审**：所有 secret / signature 比较点。

**结果**：

- `lib/auth/formal-auth.ts:69, 89` —— `timingSafeEqual` ✓
- `lib/billing/stripe.ts:285` —— `timingSafeEqual` + 长度预检 ✓
- `lib/billing/wechat-pay.ts:316-318` —— RSA `verifier.verify`（constant-time by design）✓
- `lib/billing/alipay.ts:73-75, 247` —— RSA `verifier.verify` ✓

**结论**：完整成立。所有 secret 比较都用 timing-safe 路径。

### 17.5 Round 10：Webhook 签名 + replay 防护

**已审**：Stripe / Alipay / WeChat Pay / DingTalk webhook + `lib/auth/payment-webhook-governance.ts`。

**结果**：

- ✓ Stripe webhook `verifyStripeWebhookSignature`：HMAC-SHA256 + **300s tolerance window**（line 267, 274-277）+ timing-safe 比较——金标
- ✓ Alipay `verifyAlipayNotifyPayload`：RSA-SHA256 签名 + 必需 sign 字段
- ✓ WeChat Pay：RSA-SHA256 验签
- ⚠️ Alipay / WeChat 没有显式 timestamp tolerance；replay 防护 **依赖业务层 `out_trade_no` 的 unique index**（`lib/auth/payment-webhook-governance.ts:320-368` 通过 `resolveWorkspaceCandidateByCheckoutSessionId` lookup）。可接受但不是 best practice

**结论**：已成形但仍需下一层（Alipay / WeChat 加 notify_time 窗口校验是低成本下一步）。

### 17.6 Round 11：Unhandled rejection / 错误边界

**已审**：源码中 `process.on('unhandledRejection')` / `process.on('uncaughtException')` 的注册情况。

**结果**：源码无显式注册，依赖 Next.js 的请求级错误边界与 Node 默认行为；`lib/` 中 `.catch(...)` 共 12 处。当前姿态可接受——production 部署应在 process supervisor 层（pm2 / systemd / k8s）处理终极兜底。

**结论**：刻意未做。建议下一轮看是否要给关键 background job 加显式 unhandledRejection 监听 + audit trail。

### 17.7 Round 12：Auth code abuse 防护

**已审**：`features/auth/actions.ts:268-350` `verifyAuthCode` + `resolveActiveAuthCode`。

**发现**：原实现每次 verify 失败时 `attempts: { increment: 1 }`（line 336），但**从未读取 attempts 来 cap brute-force**。6 位数验证码 + 5 分钟 TTL = 理论上可在 5 分钟内试 ~3.3k 请求/秒穷举完整 keyspace。

**修复（已应用）**：

- `features/auth/actions.ts:232` 引入 `AUTH_CODE_MAX_ATTEMPTS = 5` 常量
- 在 verify 入口前 check `record.attempts >= AUTH_CODE_MAX_ATTEMPTS`，返回 `{ ok: false, reason: "attempts_exceeded" }`；issue path 也会继承当前 active code attempts 并阻断已超限验证码继续重发
- 调用方既有的 "incorrect" 错误分支会 mask 这个具体 reason 给最终用户（避免泄露 attempts 计数器状态），但 server-side audit 与未来的 metric 可以拆开

### 17.8 Round 13：Connector token storage

**已审**：`lib/connectors/token-store.ts` 全文。

**结果**：

- ✓ AES-256-GCM with random 12-byte IV
- ✓ Auth tag verified on decrypt（GCM 自带 tamper detection）
- ⚠️ `getKey()` 用 SHA-256 直接 hash secret（无 salt / HKDF）—— 单一全局 secret 场景可接受
- ⚠️ 没有 key rotation 版本字段
- ✓ 当 `CONNECTOR_TOKEN_SECRET` 缺失时只允许 dev 路径落 `plain:<base64>`；生产环境会 fail closed，不会默默存明文 token

**修复（已应用并保留）**：`lib/connectors/token-store.ts:25-28` 在 production 且缺少 `CONNECTOR_TOKEN_SECRET` 时直接 throw，拒绝写入明文 connector token。**下一层建议**：把同一要求同步到 `validate:env` 的 MUST tier，让部署前检查和运行时 fail-closed 双保险一致。

### 17.9 Round 14：Log redaction sweep

**已审**：grep `console.log/warn/error` 拼接 `token` / `secret` / `password` 字段的所有点。

**结果**：

- 0 处直接 log named-secret 字段
- `lib/` 共 6 个 `console.log/warn` 调用，全部为运行时降级提示，无敏感数据

**结论**：完整成立。`§16` 引入的 `redactProviderErrorBody` + `redactAuditWriteFailureMessage` 已经覆盖了从 connector → audit 的两层 redaction；本轮没有发现需要补的点。

### 17.10 验证状态（rounds 6-14 累计）

| 验证 | 结果 |
| --- | --- |
| `npx tsc --noEmit` 排除 CodeX 平行修改的 `lib/evals/internal-ai-service-provider-pack-evals.ts` | 0 errors |
| `npx eslint --max-warnings 0` 修改文件全集 | 0 errors / 0 warnings |
| `npx vitest run lib/auth lib/connectors features/auth` | **52 文件 / 262 测试**全部通过 |

### 17.11 当前剩余风险（最终）

- §3.3 mirror CI 接入仍是 owner 决策（脚本已就绪 + `--check` 模式可用）
- DingTalk MCP `dingtalk-mcp@latest` 浮动版本（deny-list 已加，下一步是锁版本）
- §13 connector token plaintext 守卫已保留；下一层建议是在 `validate:env` MUST tier 同步加硬校验
- Alipay / WeChat webhook 没有显式 timestamp 窗口（依赖 out_trade_no unique index）
- approvals-client.tsx 4591 行 v2 化（独立 sprint）
- LLM context-audit 评分阈值未 surface 到 self-check / /health（可接到 §16.4 的 audit_write_failure 同样模式）
- 关键 background job 未注册 `process.on('unhandledRejection')`（按 deployment 层兜底）

### 17.12 一句话结论（rounds 6-14）

9 轮里发现 3 个**真**风险（cookie 缺 secure flag、auth code attempts 未 cap、connector token 生产无明文守卫），3 个都已落地修复并在当前主干保留。其余 6 轮均确认已成形。整体安全姿态进一步明确：硬边界、参数化查询、timing-safe 比较、签名验证、token 加密都已经在代码层成立；剩下的都属于"deployment 层 / 下一层加固"档位。

---

**审计人**：Claude (Opus 4.7)
**审计日期**：2026-05-03
**审计 commit**：`4eaf39fc9 feat: add Ask Helm context packet gate`
**修复完成日期**：2026-05-03（同会话，14 轮迭代）
**复核负责人**：（待 owner 指定）
