---
status: active
owner: helm-core
created: 2026-08-06
review_after: 2026-09-06
public_safety: Code-reachability facts about the decision and supervision loop in this repository, recorded with file paths and checked mechanically. Claims no deployment, activation, customer readiness, external-action authorization, or business value. Contains no customer identifiers, private deployment information, or real tenant material.
---

# Decision loop gap register / 决策闭环缺口清单

`scripts/check-decision-loop-gaps.ts` 校验本文的状态标记、生产调用点、调用顺序、挂载读侧和
剩余持久化缺口。代码或文档任一侧变化都会使门禁失败，不能把测试引用当成生产可达性。

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
/approvals existing terminal action
  -> verifyExecutionReceipt
  -> reconcileStage1TerminalResult
       -> evaluateStage1DecisionRecord
       -> recordStage1SupervisionSignal
  -> /caio reads current DecisionRecord / receipt / supervision records
```

选择 `features/approvals/actions.ts#verifyExecutedTaskReceiptAction` 作为唯一 terminal trigger，
因为它已经位于真实 approvals 入口，能在既有独立复核后确认 canonical `ExecutionReceipt`；
Stage 1 终态还必须显式提交最终业务结果和 evidence ref。普通回执验证仍保持原权限，Stage 1
结果回流额外复用现有 insight governance 权限，不新建角色或 ACL。

## 1. 已闭合且持续检查

| 状态 | 事实 | 机械证据 |
|---|---|---|
| GAP-1 closed | 非 seed、非测试的终态协调器幂等调用 `recordStage1SupervisionSignal` | `lib/stage1-owner-loop/terminal-result-reconciliation.service.ts`；确定性 `signalId=stage1-terminal-result:{decisionRecordId}`；`scripts/check-decision-loop-gaps.ts` 固定生产调用与入口 |
| GAP-2 closed | 同一协调器先调用 `evaluateStage1DecisionRecord`，把明确业务结果回流现有 `DecisionRecord` | 评估先于监督；冲突重放先由既有 DecisionRecord CAS 拒绝；门禁固定调用顺序 |
| terminal trigger reachable | 现有 `/approvals` 客户端调用 server action；server action 先独立验证 canonical receipt，再协调结果 | `features/approvals/approvals-client.tsx`、`features/approvals/actions.ts`、`features/approvals/queries.ts` |
| workspace / permission closed | task、claim、decision、action、approval 和 receipt 均按 workspace 收敛；跨 workspace 查找不泄漏记录 | 既有 action review、insight governance、service governance；unit + isolated MySQL 拒绝测试 |
| replay / concurrency closed | receipt verification、decision evaluation 和 supervision signal 都使用既有幂等/CAS/唯一键；中断后可用同一输入重试收敛 | focused tests 与一次性 `helm_caio_stage1_*` MySQL 并发测试 |
| read side reachable | `/caio` 读取全部近期监督状态；已解决成功信号可见但不计入 open/warning attention | `features/dashboard/stage1-owner-loop-query.ts` 与 readout tests |

### 1.1 调用顺序与失败恢复

1. server action 以当前 workspace 读取现有 `ApprovalTask`、`ActionItem` 和 Work Packet claim；
2. 既有 action-review 权限允许独立复核，Stage 1 最终结果另需既有 insight 权限；
3. `verifyExecutionReceipt` 先把 canonical receipt 验证到不可降级的 `VERIFIED`；
4. 协调器重新按 workspace 读取 claim、DecisionRecord、ActionItem、ApprovalTask 与 receipt；
5. `evaluateStage1DecisionRecord` 先写评估与 `MemoryFact.OBSERVED` 候选；
6. `recordStage1SupervisionSignal` 再写确定性监督事实，不执行任何干预。

若步骤 5 或 6 之间中断，重试相同终态输入会复用既有评估并收敛到同一监督键。不同业务结果
或证据引用的重放由既有评估内容一致性/CAS fail-closed，不能覆盖历史。

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

## 3. 仍成立的控制项

| 事实 | 证据 |
|---|---|
| DecisionRecord 有真实生产者 | `lib/stage1-owner-loop/decision-follow-through.service.ts` -> `decisionRecord.create` |
| DecisionRecord 有已挂载消费者 | `features/approvals/stage1-decision-queue-loader.ts` -> `app/(workspace)/approvals/page.tsx` |
| 决策评审有生产写入口 | `app/api/stage1/decisions/[decisionId]/review/route.ts` |
| 监督信号有已挂载读侧 | `features/dashboard/stage1-owner-loop-query.ts` -> `app/(workspace)/caio/page.tsx` |

这些控制项防止扫描器因停止发现代码而错误返回“无缺口”。

## 4. 证据边界

- **Repo truth**：当前代码有生产调用、权限收敛、幂等键、读侧和机械门禁。
- **测试证据**：focused 与隔离 MySQL 能证明所测提交和测试环境中的行为。
- **未成立**：package-ready implementation SHA 的独立批准、四仓固定 BOM、组合包、现场
  部署、运行激活、owner 外部动作授权、真实业务 payload 和经营价值。
- **GAP-3 仍开放**：不得把 `MemoryFact.OBSERVED` 候选提升成 Company Memory。

## 5. 回滚

本轮无 schema/migration。代码回滚时撤回终态协调器及 approvals 入口，保留已经产生的
append-only receipt、evaluation、audit 与 supervision 历史；同时把 GAP-1/2 状态标记恢复为
open 并更新 checker。私有部署若存在，须由其权威层回滚到上一 immutable release，不能用
本仓文档替代部署回执。
