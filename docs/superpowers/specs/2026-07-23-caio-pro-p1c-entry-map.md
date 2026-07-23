---
status: formed-needs-next-layer / local-implementation-verified
owner: helm-core
created: 2026-07-23
review_after: 2026-08-23
public_safety: Public-safe P1C symbol and entry map. It contains synthetic references only and is not a production receipt, deployment approval, customer commitment, external-write authority, or proof that WorkBuddy/Gateway mutations are enabled.
---

# Helm CAIO Pro P1C 经营问题组合、CEO 选择与决策绑定入口图

## 1. 结论

P1C 复用现有 Stage 1 一把手经营闭环，并形成一条 canonical domain chain：

```text
current accepted G0
  -> exactly 10 evidence-bound operating questions
  -> immutable generation receipt
  -> CEO selects 0-3 questions
  -> immutable selection receipt
  -> selected questions bind existing DecisionRecord
  -> canonical implementation-planning draft with explicit gaps
  -> OWNER-only dashboard read projection
```

本切片没有建立第二套问题、决策、权限、任务或执行状态机：

- 经营问题真值为 `CaioOperatingQuestionPortfolio`；
- CEO 选择真值为 `CaioQuestionSelectionReceipt`；
- 后续决策真值继续使用现有 `DecisionRecord`；
- 每个已选问题的实施规划真值为 `CaioOperatingQuestionImplementationPlan`，它是
  `DecisionRecord` 的治理草案，不是第二套决策或任务状态机；
- G0 真值继续使用现有 initialization assessment、receipt 与 current head；
- 执行仍应复用现有 `ActionItem`、`ApprovalTask`、`ExecutionReceipt` 和 Work Packet；
- 当前 Dashboard 只读，不提供生成、选择、绑定、确认或派工控件；
- WorkBuddy、MCP Gateway、delivery outbox、设备证书与 LAN 部署不在本分支实现。

因此，本切片属于“已成形但仍需下一层”。它证明 P1C canonical core、持久化、并发门控、
`DecisionRecord` 绑定、canonical implementation plan 和真实只读入口已经在本地隔离环境验证；不证明远程 mutation、
生产连接器、客户部署、Control Plane 激活或正式生产运行。

## 2. 真实入口链

### 2.1 页面入口

```text
app/(workspace)/dashboard/page.tsx
  -> features/dashboard/page-loader.ts
  -> getWorkspaceStage1OwnerLoopReadout()
  -> buildStage1OwnerLoopReadout()
  -> buildCaioOperatingQuestionReadout()
  -> Stage1OwnerLoopConsole
```

此入口是现有 CEO / OWNER Stage 1 Console，不新增第二个 CAIO 页面。

安全属性：

- 非 `WorkspaceRole.OWNER` 在查询数据库前直接返回 `null`；
- P1C 查询只读取 current Portfolio head 与 current selection head；
- 持久化内容在进入 UI 前重新执行结构、哈希、版本与 Portfolio 关联校验；
- 旧 Portfolio 的 selection head 不投影到新 Portfolio；
- 无效证据按 `invalid_evidence` fail-closed，问题正文不会显示；
- 页面明确声明只读，不能选择、确认、派工或创建 Work Packet；
- 页面不 import P1C mutation service，也没有对应 form、button、server action 或 API。

### 2.2 服务入口

当前 P1C 写入能力只存在于 application service：

```text
generateCaioOperatingQuestionPortfolio()
selectCaioOperatingQuestions()
bindCurrentCaioQuestionSelectionToDecisionRecords()
```

这些函数不是权限入口。调用者必须在未来经现有认证、CEO principal binding、scope、
challenge、版本与 feature flag 门控后才能接入。当前分支没有 route、server action、MCP
tool 或 UI 控件调用它们。

## 3. Symbol-level reuse map

| Symbol / entry | File | Current semantics | Verdict | P1C missing seam / next layer |
|---|---|---|---|---|
| `CaioInitializationAssessment` | `lib/stage1-owner-loop/caio-initialization-gate.ts` | 初始化证据充分性、资产覆盖与盲区判断 | reuse | 无；P1C 不复制 G0 |
| `CaioInitializationGateReceipt` | `lib/stage1-owner-loop/caio-initialization-gate-receipt.ts` | G0 不可变验收回执与前序链 | reuse | 无 |
| `loadCurrentAcceptedCaioInitializationContextForUpdate` / `ForRead` | `lib/stage1-owner-loop/caio-initialization-gate-store.service.ts` | 读写共用一个校验内核，重放 assessment input、校验完整 receipt chain、live mandate、live CEO binding 与实时 G0 投影；写入锁定 head，读取要求单一 repeatable-read 或更强事务快照并 fail-closed | extend | Gateway 读取也必须复用该内核，不能复制一套较弱 G0 真值 |
| `CaioOperatingQuestionG0Context` | `lib/stage1-owner-loop/caio-operating-question.ts` | 将 accepted G0 receipt、assessment 与 evidence universe 固化为 generation input | missing -> formed | 未来 generator 可以替换模型实现，但必须保留同一 contract 与 validator |
| `CaioOperatingQuestionPortfolio` | `lib/stage1-owner-loop/caio-operating-question.ts` | 恰好 10 个证据化候选、排序、评分、第一窄闭环与 immutable hash | missing -> formed | 未来行业 Pack 只提供候选内容/评测，不持有 Core 真值 |
| `CaioOperatingQuestionGenerationReceipt` | `lib/stage1-owner-loop/caio-operating-question.ts` | generated / insufficient_evidence 两种结果、前序链与 G0 锚点 | missing -> formed | Gateway 只能读取/投影，不能复制或改写 |
| `CaioQuestionSelectionReceipt` | `lib/stage1-owner-loop/caio-question-selection.ts` | CEO 对 0-3 题的版本化选择；`authorityEffect` 与 `workPacketEffect` 均为 `none` | missing -> formed | 未来 prepare/submit challenge 在 Gateway 层实现；receipt contract 不变 |
| `DecisionObject` projection | `lib/stage1-owner-loop/caio-operating-question-decision.ts` | 将一个已选候选确定性投影为现有 Decision Object 输入，保留证据和 G0/Portfolio/selection refs | extend | 不新增第二套决策对象 |
| `CaioOperatingQuestionImplementationPlan` | `lib/stage1-owner-loop/caio-operating-question-implementation-plan.ts` | 将 Portfolio、selection 与现有 `DecisionRecord` 绑定成可校验的实施规划草案；显式记录基线、目标、适配、汇报、治理、人员、结果和 30 天复盘缺口 | missing -> formed | 初始状态固定为 `DRAFT / needs_configuration`，`authorityEffect` 与 `workPacketEffect` 均为 `none`；Pack、Overlay、连接器、模型路由、数据处置和升级/停止/回滚条件仍待配置 |
| `createStage1DecisionRecordInTransaction` | `lib/stage1-owner-loop/decision-follow-through.service.ts` | 在调用方事务内复用现有 `DecisionRecord` 创建语义 | extend | 后续 owner confirmation 与 Work Packet 继续走现有 service |
| `generateCaioOperatingQuestionPortfolio` | `lib/stage1-owner-loop/caio-operating-question-store.service.ts` | SERIALIZABLE、幂等、current G0 重验、append-only head、audit 同事务 | missing -> formed | 无 route；未来只由受治理 application adapter 调用 |
| `selectCaioOperatingQuestions` | `lib/stage1-owner-loop/caio-operating-question-store.service.ts` | live CEO binding、current Portfolio、0-3 题、版本链、幂等与 audit | missing -> formed | mutation flag、challenge、expected version 与 user-presence 属 Gateway/Control Plane |
| `bindCurrentCaioQuestionSelectionToDecisionRecords` | `lib/stage1-owner-loop/caio-operating-question-store.service.ts` | 只处理 current selection；每个选中题在同一事务中幂等创建/复用现有 `DecisionRecord`、provenance binding 与 canonical implementation plan | missing -> formed | 不确认 Decision、不创建 Work Packet、不形成权限 |
| P1C persistence | `prisma/schema.prisma`、`prisma/migrations/20260723170000_caio_operating_question_portfolio/migration.sql`、`prisma/migrations/20260723221500_caio_operating_question_implementation_plan/migration.sql` | Portfolio、generation receipt、current head、selection receipt、selection head、Decision binding 与一对一 implementation plan | missing -> formed | 新表为 additive；历史 binding 可在受治理重放时补齐计划，生产迁移与部署回执不属于本地实现证据 |
| `buildCaioOperatingQuestionReadout` | `features/dashboard/caio-operating-question-readout.ts` | 只消费 canonical G0 read context，再校验 P1C 持久化 JSON、规范列、Decision binding 与 implementation plan 上下文，形成 read-only UI projection | missing -> formed | 缺计划显示 `planning_incomplete`，计划篡改显示 `invalid_evidence`；未来可供 Gateway projection resolver 复用，但不能直接返回 local-only 原文 |
| `getWorkspaceStage1OwnerLoopReadout` | `features/dashboard/stage1-owner-loop-query.ts` | OWNER-only、单一 repeatable-read 事务聚合；实时 G0 漂移时隐藏旧 Portfolio；P1C 缺表沿现有 additive-schema 路径降级 | extend | 不增加 mutation |
| `Stage1OwnerLoopConsole` | `features/dashboard/stage1-owner-loop-console.tsx` | 展示 10 题、选择状态和 canonical DecisionRecord binding；无写控件 | extend | CEO 选择交互必须等 mutation 门全绿并走 prepare/submit |
| `OwnerQuestionPacket` / `EvidenceAnswerPacket` | `lib/stage1-owner-loop/types.ts` | CEO 问答和证据回答公共契约 | reuse | P1C 候选不能复制成问答真值；WorkBuddy 只做投影 |
| `ActionItem` / `ApprovalTask` / `ExecutionReceipt` | 现有治理执行链 | 派工、审批、执行回执和独立验收 | reuse | P1C 当前不自动创建；receipt 并发降级缺陷修复前不得开放远程 mutation |

## 4. Canonical object chain

### 4.1 G0 到 Portfolio

生成服务必须在同一事务内：

1. 锁定 workspace 和 current G0 head；
2. 校验 current G0 receipt 与 assessment 的 JSON、hash、sequence 和 predecessor chain；
3. 重算 live initialization projection；
4. 验证 mandate 仍 active；
5. 验证 CEO principal binding 仍 live 且与 mandate CEO 一致；
6. 评估是否具备恰好 10 题所需证据；
7. 写 generation receipt；
8. 证据充分时写 Portfolio；
9. CAS 更新 current Portfolio head；
10. 在同一事务写 audit。

证据不足只形成 `insufficient_evidence` receipt 和 gap codes，不形成可选 Portfolio，也不覆盖
此前仍可核验的历史记录。

### 4.2 Portfolio 到 CEO 选择

选择服务必须：

1. 重新锁定并验证 current accepted G0；
2. 只接受 current Portfolio；
3. 验证操作者是 live CEO binding 对应的真实 user；
4. 允许 0-3 个选择，0 表示明确暂缓，不表示系统故障；
5. 校验每项成功指标 key 唯一、范围、禁区与时间窗口；
6. 相同 idempotency key + 相同 payload 返回原 receipt；
7. 相同 idempotency key + 不同 payload fail-closed；
8. 追加 selection receipt 和 head，不覆盖历史；
9. 同事务写 audit。

### 4.3 CEO 选择到 DecisionRecord 与实施计划

绑定服务只处理 current selection：

- 一个选中问题映射一个现有 `DecisionRecord`；
- `DecisionRecord` 初始保持 `EVIDENCE_READY`；
- 选择回执、G0、Portfolio 与 question evidence 进入依据引用；
- provenance binding 记录 question -> DecisionRecord 关系；
- canonical implementation plan 绑定 Portfolio、selection、question、binding 与 DecisionRecord；
- 计划初始只描述实施目标和缺口，不授予权限、不产生 Work Packet；
- 相同 selection 并发绑定与计划物化都只创建一次；
- 已有历史 binding 但缺计划时只补计划，不复制 DecisionRecord；
- 已存在计划必须通过内容哈希、规范列和上下文重算校验，篡改后 fail-closed；
- superseded selection 拒绝；
- audit 失败则整笔事务回滚；
- 不作 owner confirmation；
- 不建立 Work Packet；
- 不授予 action、connector、模型或外部系统权限。

## 5. 状态与版本

### 5.1 Generation

```text
current accepted G0
  -> generated + Portfolio
  -> insufficient_evidence + gap codes
```

每个结果都进入不可变 generation receipt chain。current head 只是投影，不是历史真值。

### 5.2 Selection

```text
no current selection
  -> selected 0-3
  -> later selection version for the same current Portfolio
```

旧 Portfolio 的选择不能污染新 Portfolio。历史 receipt 不被覆盖。

### 5.3 Dashboard projection

```text
not_generated
awaiting_selection
selection_deferred
binding_incomplete
planning_incomplete
selected
last_valid_portfolio_stale
insufficient_evidence
invalid_evidence
```

`invalid_evidence` 与没有历史有效组合的 `insufficient_evidence` 都不会显示可误认成可信候选的问题正文。
如果最新一次生成证据不足但此前存在有效组合，投影进入
`last_valid_portfolio_stale`，只读展示上一版有效组合，并明确标出最新生成序号、
保留组合版本及其生成时间；它属于 attention 状态，不能被表述为最新证据充分结果。

## 6. 并发、幂等与失败语义

已在 MySQL 8.4 隔离库覆盖：

- 相同 generation 并发只形成一个新写入，另一个返回 replay；
- 相同 selection 并发只形成一个新写入，另一个返回 replay；
- 同 key 不同 payload 冲突；
- 第二代 generation 的 predecessor chain 不能 fork；
- 伪造 predecessor 拒绝；
- G0 在外层检查后被撤销，事务内重验 fail-closed；
- G0 接受后 Company Memory 证据发生实时漂移，读取侧与写入侧使用同一校验内核并 fail-closed；
- 证据不足不会破坏此前有效 Portfolio 历史；
- current selection 并发绑定 `DecisionRecord` 恰好一次；
- current selection 并发物化 implementation plan 恰好一次；
- 历史 binding 缺计划时可确定性补齐，补齐后重放稳定；
- implementation plan 被篡改时重放 fail-closed；
- superseded selection 不能绑定；
- generation、selection、binding 和 implementation-plan audit 失败均回滚；
- P1C 操作不会创建 `ActionItem` 或 `ApprovalTask`。

运行层仍有一个独立的 execution receipt verification 并发降级基线缺陷。它不阻止 P1C
contract、store、只读 query 或页面投影，但在该缺陷及 Gateway 专属门禁全绿前，
WorkBuddy/P1C mutation 必须默认关闭。

## 7. 数据库真值

新增表：

- `CaioOperatingQuestionPortfolio`
- `CaioOperatingQuestionGenerationReceipt`
- `CaioOperatingQuestionPortfolioHead`
- `CaioQuestionSelectionReceipt`
- `CaioQuestionSelectionHead`
- `CaioOperatingQuestionDecisionBinding`
- `CaioOperatingQuestionImplementationPlan`

关键约束：

- Portfolio、generation receipt 与 selection receipt 的 content hash 唯一；
- workspace + generation key / idempotency key 防止语义重复；
- current head 通过显式 FK 指向当前不可变记录；
- `DecisionRecord` 使用 `(id, workspaceId)` 复合唯一键供 binding 做 workspace-bound FK；
- binding 对 `(workspaceId, selectionReceiptId, questionId)` 唯一；
- plan 对 Decision binding 和 `DecisionRecord` 均为一对一，并对
  `(workspaceId, selectionReceiptId, questionId)` 唯一；
- migration 只建立 P1C 结构，不激活任何 runtime 权限或远程入口。

## 8. 公开 UI 语义

Dashboard 显示：

- 当前 P1C 状态；
- 候选数量；
- CEO 已选 0-3 题数量；
- 已绑定 `DecisionRecord` 数量；
- 已形成 canonical implementation plan 数量；
- 10 个候选的 rank、标题、问题、业务域、证据数和评分；
- 选中项的 binding 完整性。
- 选中项的 implementation-plan 完整性与配置状态。

Dashboard 不显示：

- 选择、提交、批准、确认、派工、执行或外发按钮；
- WorkBuddy/Gateway 启用状态；
- 客户数据、私有 evidence 原文、凭据或内部地址；
- 生产就绪、客户已接受或外部动作已完成的表述。

## 9. WorkBuddy / Gateway handoff

协调与集成负责人可以只依赖以下 P1C canonical seam：

### Read projection

```text
CaioOperatingQuestionPortfolio
CaioOperatingQuestionGenerationReceipt
CaioQuestionSelectionReceipt
CaioOperatingQuestionImplementationPlan
CaioOperatingQuestionReadout
```

### Governed application service

```text
generateCaioOperatingQuestionPortfolio
selectCaioOperatingQuestions
bindCurrentCaioQuestionSelectionToDecisionRecords
```

Gateway 必须增加而 P1C 不实现：

- device/client authentication；
- CEO application scope；
- remote projection policy；
- `prepare_question_selection` one-time challenge；
- user-presence confirmation；
- `submit_question_selection` adapter；
- expected version、replay protection 和 feature flag；
- delivery envelope、cursor、snooze、suppression 与 delivery ledger；
- LAN、mTLS、证书轮换、撤销与部署回执。

Gateway 不得：

- 直接读写 MySQL；
- 自建 question、selection、decision 或 implementation-plan 状态机；
- 把 WorkBuddy 回答当 CEO 身份或权限；
- 绕过 live G0、CEO binding、current Portfolio 或 idempotency 校验；
- 通过选择回执创建 Work Packet 或外部副作用。

## 10. 验证证据

本地实现至少需保持以下证据：

```bash
npx vitest run \
  lib/stage1-owner-loop/caio-operating-question.test.ts \
  lib/stage1-owner-loop/caio-question-selection.test.ts \
  lib/stage1-owner-loop/caio-operating-question-decision.test.ts \
  lib/stage1-owner-loop/caio-operating-question-implementation-plan.test.ts \
  lib/stage1-owner-loop/caio-operating-question-store.service.test.ts \
  features/dashboard/caio-operating-question-readout.test.ts \
  features/dashboard/stage1-owner-loop-readout.test.ts \
  features/dashboard/stage1-owner-loop-query.test.ts \
  features/dashboard/stage1-owner-loop-console-accessibility.test.ts

DATABASE_URL="mysql://.../<isolated-db>" \
CAIO_INITIALIZATION_GATE_DATABASE_URL="mysql://.../<isolated-db>" \
CAIO_INITIALIZATION_GATE_TEST_DATABASE_NAME="<isolated-db>" \
npx vitest run \
  lib/stage1-owner-loop/caio-initialization-gate-store.mysql.test.ts

npm run typecheck
npm run check:boundaries
npm run lint
npm run test
npm run build
```

空库 migration replay、隔离 MySQL 测试、页面构建和浏览器验收必须分别报告。任何一项通过
都不能替代其他项，也不能被升级为生产部署或客户价值回执。

## 11. Reuse / extend / missing 总结

### Reuse

- G0 assessment、receipt、head 与 CEO binding；
- `OwnerQuestionPacket` / `EvidenceAnswerPacket`；
- `DecisionRecord` / Decision Object；
- Stage 1 OWNER-only Console；
- Work Packet、ActionItem、ApprovalTask、ExecutionReceipt；
- audit 与 workspace 边界。

### Extend

- G0 store 增加事务内 current accepted context；
- `DecisionRecord` service 增加 transaction-aware helper；
- Dashboard owner-loop query/readout 增加 P1C 只读投影；
- schema 增加 P1C immutable ledger 与 provenance binding。

### Missing and intentionally not implemented here

- WorkBuddy Skill；
- MCP Gateway；
- typed delivery outbox；
- device certificate、mTLS 与 LAN deployment；
- remote projection policy；
- prepare/submit challenge；
- user-presence；
- P1C mutation feature flag 与正式 route；
- owner confirmation、Work Packet 和执行；
- Overlay 私有身份/数据策略；
- Control Plane 激活、健康、回滚与生产回执。

## 12. 合并与集成条件

P1C commit 进入协调分支前，协调与集成负责人应独立复核：

1. 没有第二套 question / selection / decision 对象；
2. G0 source of truth 与 current head 在事务内重验；
3. Portfolio 恰好 10 题，证据不足 fail-closed；
4. CEO 只能选择 0-3 题；
5. selection 和 binding 并发幂等；
6. 选中题只绑定现有 `DecisionRecord`；
7. 页面仍是 OWNER-only、read-only；
8. 没有 WorkBuddy/Gateway/delivery/证书实现越界；
9. 隔离 MySQL、空库重放、边界、类型、测试、构建和浏览器证据分开成立；
10. mutation 开关在 execution receipt 并发缺陷修复前保持关闭。

## 13. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-23 | 形成 P1C canonical Portfolio、generation receipt、CEO 选择回执、现有 DecisionRecord 绑定、OWNER-only 只读入口与双机交付边界。 |
