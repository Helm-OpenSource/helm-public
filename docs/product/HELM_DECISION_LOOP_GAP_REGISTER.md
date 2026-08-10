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
| GAP-1 closed | 非 seed、非测试的终态协调器在同一 `SERIALIZABLE` 事务内调用 `recordStage1SupervisionSignal`；`NOT_EXECUTED / REJECTED` 保留 blocked/rejected 真值并形成 open owner-review signal | 确定性 `signalId=stage1-terminal-result:{decisionRecordId}`；监督冲突的真实 MySQL 用例证明 receipt verification、evaluation 与 memory 一并回滚 |
| GAP-2 closed | 同一事务先调用 `evaluateStage1DecisionRecord`；执行过的业务结果与 canonical receipt 一致，无执行关闭固定为 `outcomeRef=null / result=unknown` | 评估先于监督；blocked/rejected 不解析或伪造业务 `ObservationRun`；冲突重放由既有 DecisionRecord 内容一致性拒绝 |
| terminal trigger reachable | 现有 `/approvals` 客户端调用 server action；Stage1 进入原子协调器，非 Stage1 继续独立验证 receipt | `features/approvals/approvals-client.tsx`、`features/approvals/actions.ts`、`features/approvals/queries.ts` |
| trusted evidence closed | `SUCCESS / PARTIAL_SUCCESS / FAILURE` 的新写 outcome ref 必须解析为当前 workspace、Portfolio、DecisionRecord、ActionItem、ApprovalTask 范围内仍有效的 `ObservationSourceRun`；`NOT_EXECUTED / REJECTED` 禁止携带业务 outcome ref | resolver canonical fixture/unit tests；close-without-execution focused 与 isolated MySQL 测试证明不读取或新增业务 ObservationRun |
| private ingress reachable | 受认证 WorkBuddy MCP user principal 通过 Gateway 的 `/v1/execution-results` 进入 Core；project visibility 与专用 `submit_private_execution_result` operation capability 分离检查，Core 锁 Work Packet 后在同一 `SERIALIZABLE` 事务重验 ACTIVE membership、operation capability 与 executor binding，再由唯一 writer 写 receipt | Gateway、`private-execution-result-ingress.service.ts`、锁后撤权/降权及 executor-binding tests；不证明 resolver 已由 Overlay 供给或私有 executor 已部署 |
| Pack portable contract S1 closed | 完整 artifact 与版本化 semantic verifier 共同形成 contract identity；semantic graph 显式声明 `evidenceRef -> evidenceKind`，重复、悬空、coverage 与 kind 冲突全部 fail-closed | TS / JSON artifact differential 与逐叶 mutation 测试；不证明 production composition caller、Core 自生成问题或 Pack 已挂载 |
| Pack Core generator S2 closed | Pack seam 拒绝外部 candidates、问题正文、score/rank；Core 从 workspace Portfolio、可信 G0 evidence traces、S1 bindings 与完整 semantic graph 派生 eligibility、内容、事实/推论、score/rank、validation metric 与 narrow loop | generator/store focused tests 覆盖语义敏感性、exactly-10、约束后 `insufficient_evidence`、幂等 request hash 与既有 canonical writer；不证明 production mount |
| Public production caller S3 reachable | 受认证 WorkBuddy Gateway 独立 route 只接收 `portfolioRef + generationKey`，以当前 principal/workspace/Portfolio 解析唯一注入 provider，再进入 S2 Core generator/store；重复 provider 在 mount 构造时拒绝 | route、registry、真实 composition 测试与 AST 门禁锁定唯一 caller/registration，覆盖未挂载、重复挂载、跨 workspace、无 G0、insufficient 与重放；只证明 Public caller 可达，不证明 Pack 已提供组件、部署已挂载或 runtime 已激活 |
| replay / concurrency closed | private ingress 每次重验 caller project/operation 权限；锁后先识别 strict exact receipt replay，再对新写校验当前 evidence authorization；receipt verification、decision evaluation 和 supervision 继续使用既有锁、CAS、幂等内容匹配与唯一键 | focused tests 与一次性 `helm_caio_stage1_*` MySQL 撤权/降权 interleaving、CAS 后故障回滚、授权过期 exact replay、变更 payload conflict 测试 |
| read side reachable | `/caio` 先显示 unresolved critical，再显示其他 unresolved，剩余额度才显示 resolved；每条显示 status | `features/dashboard/stage1-owner-loop-query.ts`、console 与 mixed-status regression |

### 1.1 调用顺序与失败恢复

1. server action 以当前 workspace 读取现有 `ApprovalTask`、`ActionItem` 和 Work Packet claim；
2. 既有 action-review 权限允许独立复核，Stage 1 最终结果另需既有 insight 权限；
3. 协调器开启 `SERIALIZABLE` 事务并锁定唯一 `DecisionWorkPacketClaim`；
4. 协调器按 canonical receipt outcome 分流：执行过的业务结果核对显式 terminal result、
   Opportunity Portfolio 和当前 `ObservationSourceRun`；`NOT_EXECUTED / REJECTED` 则拒绝业务
   outcome，并固定为 `unknown/null` 的治理关闭；
5. `verifyExecutionReceipt` 使用同一 transaction client 把 canonical receipt 验证为 `VERIFIED`；
6. `evaluateStage1DecisionRecord` 使用同一 client 写评估与 `MemoryFact.OBSERVED` 候选；
7. `recordStage1SupervisionSignal` 使用同一 client 写确定性监督事实，不执行任何干预。

步骤 4-7 任一步失败，事务整体回滚，不留下 `VERIFIED + EVALUATED` 却没有有效 supervision
的误导态。完全相同的 reconciliation payload/hash 可重放并收敛；receipt 结果、业务结果、
证据引用或是否采纳建议发生漂移时 fail-closed，不能覆盖历史。

T2a 只证明后端协调路径；approvals 对 blocked/rejected 的入口与呈现属于 T2b，当前不能把
后端 repo truth 表述为 UI、部署或现场激活 truth。

私有 executor 只提交严格版本化、带 content hash 的结果投影。Gateway 先执行 mTLS/token、
workspace、Portfolio membership 与专用 operation capability 检查。Core ingress 锁定 Work
Packet 后，以同一事务中的当前 membership/capability/executor binding 作为写权限真值。strict
exact replay 仍要求这些当前 caller 权限，但不因首次成功后历史 evidence authorization 到期而
改写既有回执；任何 payload 漂移均冲突，只有新写继续要求当前 evidence authorization。该链只
记录已经发生的私有执行证明，不授权、不发起任何外部副作用。

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

### S3 Public caller 已可达；Pack 实际挂载仍需外部证据

S1 已发布 portable semantic contract；S2 已在 Core repo 内把合法 semantic graph 转换为现有
canonical `CaioOperatingQuestionPortfolio` / generation receipt 的 exactly-10 或
`insufficient_evidence`。S3 现在提供唯一、受权、非测试的 Public composition caller：Gateway
严格绑定当前 principal/workspace/Portfolio，只有 mount 注入恰好一个 provider 时才拥有该 route，
并由 S2 在事务内重新加载可信 G0 与 evidence snapshot。Core 仍不反向依赖 Pack。

这只证明 Public caller 在满足注入条件时可达。`helm-packs` 必须另行提供实际 operating-input
provider 组件与验证证据，部署组合还必须提供 mount/runtime receipt；本仓没有这些材料，因此
不得声明 Pack 已挂载、现场已部署或 runtime 已激活。

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
