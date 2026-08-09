---
status: active
owner: helm-core
created: 2026-08-06
review_after: 2026-09-06
public_safety: Code-reachability facts about the decision and supervision loop in this repository, recorded with file paths and checked mechanically. Claims no deployment, activation, customer readiness, external-action authorization, or business value. Contains no customer identifiers, private deployment information, or real tenant material.
---

# Decision loop gap register / 决策闭环缺口清单

`scripts/check-decision-loop-gaps.ts` 校验本文的状态标记、原子生产调用点、私有结果 ingress、
Pack portable contract、可移植跨仓 schema、挂载读侧和剩余持久化缺口。代码或文档任一侧变化都会
使门禁失败，不能把测试引用当成生产可达性。

<!-- decision-loop-gap:GAP-1=closed -->
<!-- decision-loop-gap:GAP-2=closed -->
<!-- decision-loop-gap:GAP-3=open -->

> 本文件只陈述当前提交的代码可达性事实。GAP-1/2 闭合不证明组合包、现场部署、运行激活、
> owner 外部动作授权或经营价值成立。

## 0. 结论

GAP-1 与 GAP-2 已由同一条生产可达、workspace scoped、可重放的终态路径闭合；GAP-3
仍开放。本轮没有新增 Prisma model 或 migration，也没有增加写回、真拨、通知、外部连接或
自动执行。

```text
/private executor projection
  -> authenticated Gateway ingress
  -> Core recordExecutionReceipt (SELF_REPORTED)

/approvals existing terminal action
  -> reconcileStage1TerminalResult (one SERIALIZABLE transaction)
       -> verifyExecutionReceipt
       -> evaluateStage1DecisionRecord
       -> recordStage1SupervisionSignal
  -> /caio reads current DecisionRecord / receipt / supervision records
```

选择 `features/approvals/actions.ts#verifyExecutedTaskReceiptAction` 作为唯一 terminal trigger，
因为它已经位于真实 approvals 入口，并持有既有独立复核身份。Stage 1 分支不预先提交回执
验证，而是把 canonical `ExecutionReceipt` 验证、DecisionRecord 评估和监督记录放入同一
事务；普通非 Stage1 回执验证仍保持原路径和权限。Stage 1 终态还必须显式提交与 receipt
outcome 一致的最终业务结果，以及可解析的 evidence ref；结果回流额外复用现有 insight
governance 权限，不新建角色或 ACL。

## 1. 已闭合且持续检查

| 状态 | 事实 | 机械证据 |
|---|---|---|
| GAP-1 closed | 非 seed、非测试的终态协调器在同一 `SERIALIZABLE` 事务内调用 `recordStage1SupervisionSignal` | 确定性 `signalId=stage1-terminal-result:{decisionRecordId}`；监督冲突的真实 MySQL 用例证明 receipt verification、evaluation 与 memory 一并回滚 |
| GAP-2 closed | 同一事务先调用 `evaluateStage1DecisionRecord`，把与 canonical receipt 一致的明确业务结果回流现有 `DecisionRecord` | 评估先于监督；冲突重放由既有 DecisionRecord 内容一致性拒绝；门禁固定事务与调用顺序 |
| terminal trigger reachable | 现有 `/approvals` 客户端调用 server action；Stage1 进入原子协调器，非 Stage1 继续独立验证 receipt | `features/approvals/approvals-client.tsx`、`features/approvals/actions.ts`、`features/approvals/queries.ts` |
| trusted evidence closed | outcome ref 必须解析为当前 workspace、Portfolio、DecisionRecord、ActionItem、ApprovalTask 范围内仍有效的 `ObservationSourceRun` | `caio-fde-scope-resolver.service.ts` 与 unit / isolated MySQL revoked-source 拒绝测试 |
| private ingress reachable | 受认证 WorkBuddy MCP principal 通过 Gateway 的 `/v1/execution-results` 进入 Core；Core 校验 identity/hash/scope/CAS 后唯一调用 `recordExecutionReceipt` | Gateway、`private-execution-result-ingress.service.ts`、并发 exact replay 与冲突 replay MySQL 测试；不证明私有 executor 已部署 |
| Pack portable contract S1 closed | 完整 artifact 与版本化 semantic verifier 共同形成 contract identity；semantic graph 显式声明 `evidenceRef -> evidenceKind`，重复、悬空、coverage 与 kind 冲突全部 fail-closed | TS / JSON artifact differential 与逐叶 mutation 测试；不证明 production composition caller、Core 自生成问题或 Pack 已挂载 |
| replay / concurrency closed | private ingress、receipt verification、decision evaluation 和 supervision 使用既有锁、CAS、幂等内容匹配与唯一键 | focused tests 与一次性 `helm_caio_stage1_*` MySQL 并发、冲突、回滚测试 |
| read side reachable | `/caio` 先显示 unresolved critical，再显示其他 unresolved，剩余额度才显示 resolved；每条显示 status | `features/dashboard/stage1-owner-loop-query.ts`、console 与 mixed-status regression |

### 1.1 调用顺序与失败恢复

1. server action 以当前 workspace 读取现有 `ApprovalTask`、`ActionItem` 和 Work Packet claim；
2. 既有 action-review 权限允许独立复核，Stage 1 最终结果另需既有 insight 权限；
3. 协调器开启 `SERIALIZABLE` 事务并锁定唯一 `DecisionWorkPacketClaim`；
4. 协调器核对 canonical receipt outcome、显式 terminal result、Opportunity Portfolio 和当前
   `ObservationSourceRun` 的 workspace、授权期、来源状态、证据绑定；
5. `verifyExecutionReceipt` 使用同一 transaction client 把 canonical receipt 验证为 `VERIFIED`；
6. `evaluateStage1DecisionRecord` 使用同一 client 写评估与 `MemoryFact.OBSERVED` 候选；
7. `recordStage1SupervisionSignal` 使用同一 client 写确定性监督事实，不执行任何干预。

步骤 4-7 任一步失败，事务整体回滚，不留下 `VERIFIED + EVALUATED` 却没有有效 supervision
的误导态。完全相同的 reconciliation payload/hash 可重放并收敛；receipt 结果、业务结果、
证据引用或是否采纳建议发生漂移时 fail-closed，不能覆盖历史。

私有 executor 只提交严格版本化、带 content hash 的结果投影。Gateway 先执行 mTLS/token、
workspace 与 Portfolio membership 检查，Core ingress 再锁定 Work Packet、解析当前证据并通过
唯一 `recordExecutionReceipt` writer 写 `SELF_REPORTED` receipt。该链只记录已经发生的私有
执行证明，不授权、不发起任何外部副作用。

## 2. 仍开放

### GAP-3 Company Memory 只有契约，没有持久化

`lib/company-memory/` 仍是 contract-only 纯函数边界；`prisma/schema.prisma` 无
`KnowledgeCard` / `KnowledgeSource` model。本轮产生的 `MemoryFact.OBSERVED` 仍只是候选事实，
不得表述为持久化 Company Memory、企业世界模型或长期知识层。

- **影响**：长期知识项的来源、适用范围、失效、撤销、删除与恢复尚未形成持久化闭环。
- **停止条件**：GAP-3 需要 schema/migration、保留和恢复设计，必须经过独立 owner 批准；
  不能顺手并入 GAP-1/2。
- **机械证据**：checker 要求上述两个 Prisma model 继续不存在；任一出现都会要求同步更新
  本清单与 migration 证据。

### GAP-4 知识可用等级尚不能进入完整监督判断

这是 GAP-3 的推论，不由本轮声称闭合。`companyMemoryRefs` 等不透明引用不等于读取持久化
知识卡；在 GAP-3 完成前，不能机械判断所有援引知识的当前可用等级。

### S1 后续项：Pack production composition 尚未闭合

本轮只发布 portable semantic contract。现有仓库事实尚不能证明唯一、受权、非测试的 Pack
composition caller 已挂载，也不能证明 Pack semantic graph 已由 Core 自行转换为 exactly-10
或 `insufficient_evidence`。后续实现必须继续保持 Core 不反向依赖 Pack；在该调用链和行为门禁
完成前，不得把 S1 identity 写成 production reachability。

## 3. 仍成立的控制项

| 事实 | 证据 |
|---|---|
| DecisionRecord 有真实生产者 | `lib/stage1-owner-loop/decision-follow-through.service.ts` -> `decisionRecord.create` |
| DecisionRecord 有已挂载消费者 | `features/approvals/stage1-decision-queue-loader.ts` -> `app/(workspace)/approvals/page.tsx` |
| 决策评审有生产写入口 | `app/api/stage1/decisions/[decisionId]/review/route.ts` |
| 监督信号有已挂载读侧 | `features/dashboard/stage1-owner-loop-query.ts` -> `app/(workspace)/caio/page.tsx` |

这些控制项防止扫描器因停止发现代码而错误返回“无缺口”。

## 4. 证据边界

- **Repo truth**：当前代码有原子生产调用、trusted resolver、严格跨仓 identity、真实
  private ingress、Pack portable contract、权限收敛、幂等键、读侧和机械门禁；Pack
  production composition caller 仍未由 S1 证明。
- **测试证据**：focused 与隔离 MySQL 能证明所测提交和一次性本地测试环境中的行为。
- **未成立**：package-ready implementation SHA 的独立批准、四仓固定 BOM、组合包、现场
  部署、运行激活、owner 外部动作授权、真实业务 payload 和经营价值。
- **GAP-3 仍开放**：不得把 `MemoryFact.OBSERVED` 候选提升成 Company Memory。

## 5. 回滚

本轮无 schema/migration。代码回滚时撤回终态协调器及 approvals 入口，保留已经产生的
append-only receipt、evaluation、audit 与 supervision 历史；同时把 GAP-1/2 状态标记恢复为
open 并更新 checker。私有部署若存在，须由其权威层回滚到上一 immutable release，不能用
本仓文档替代部署回执。
