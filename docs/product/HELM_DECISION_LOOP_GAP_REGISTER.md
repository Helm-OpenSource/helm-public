---
status: active
owner: helm-core
created: 2026-08-06
review_after: 2026-09-06
public_safety: Code-reachability facts about the decision and supervision loop in this repository, recorded with file paths and checked mechanically. Claims no deployment, activation, customer readiness, or owner approval. Contains no customer identifiers, private deployment information, or real tenant material.
---

# Decision loop gap register / 决策闭环缺口清单

`scripts/check-decision-loop-gaps.ts` 校验本文件的每一条断言。**这不是一份状态文档，是一份被检查的清单**——每条缺口都可被机械复核，修好任何一条都会让那道闸变红，强制在同一次改动里更新本文件。

之所以这样做，是因为 `docs/STATUS.md` 已经在**两个相反方向**上失真（见 §4）。一份告诉你"进度在哪"的文档，如果没有东西校验它，就会同时高估和低估自己。

> 本文件只陈述代码可达性事实。不声明部署、激活、客户就绪或 owner 批准。

---

## 0. 一句话结论

**决策对象已上线且 owner 可达；监督闭环的第一个真实生产者已接上（GAP-1 已关闭）；决策评估仍不回流（GAP-2），企业记忆仍无持久化（GAP-3）。**

缺消费者的东西看起来没做完；**缺生产者的东西看起来做完了**。这是本清单存在的理由。

### 关于 GAP-1 关闭方式的一条更正

本清单第一版把 GAP-1 记成"`recordStage1SupervisionSignal` 没有生产调用方"，校验器也照此断言。**那是代理指标，不是性质本身。** GAP-1 实际是通过另一条 in-transaction 路径关闭的，那个符号至今仍无调用方——于是代理为真、缺口已闭，闸报绿。

校验器已改为断言真正的性质：**`supervisionSignalRecord.create` 在 `prisma/seed.ts` 之外是否存在生产写入点**，不论由谁执行。

---

## 1. 已闭合（作为对照项记录，不是缺口）

这一节的存在是**控制项**：如果校验器坏了，它会连这些一起报错，而不是安静地宣布"没有缺口"。一个在自己从未测量过的东西上通过的检查，会被当成证据。

| 事实 | 证据 |
|---|---|
| DecisionRecord 有真实生产者 | `lib/stage1-owner-loop/decision-follow-through.service.ts` → `tx.decisionRecord.create`；上游 `lib/stage1-owner-loop/caio-operating-question-store.service.ts` `bindCurrentCaioQuestionSelectionToDecisionRecords`，由 `tools/caio-workbuddy-gateway/prisma-runtime.ts` 调用 |
| DecisionRecord 有真实消费者且已挂载 | `features/approvals/stage1-decision-queue-loader.ts` (`db.decisionRecord.findMany`) → `app/(workspace)/approvals/page.tsx` 渲染 `<Stage1DecisionQueue />` |
| 决策评审是可交互的写回，不是只读 | `features/approvals/stage1-decision-queue.tsx` POST `/api/stage1/decisions/{id}/review`；路由已实现于 `app/api/stage1/decisions/[decisionId]/review/route.ts` |
| 监督信号有真实**读侧**且已挂载 | `features/dashboard/stage1-owner-loop-query.ts` (`supervisionSignalRecord.findMany` / `groupBy`) → `app/(workspace)/caio/page.tsx` 渲染 `Stage1OwnerLoopConsole`；另有 `lib/integrations/qoderwork/tool-executor.ts` 经 `app/api/mcp/qoderwork/route.ts` 暴露 |

---

## 2. 缺口

### GAP-1 监督信号没有生产者 —— **已关闭（2026-08-06）**

原状：`/caio` 的"监督异常"面板只可能显示 `prisma/seed.ts` 造的数据。

**关闭方式**：`recordStage1OwnerReviewOutcome` 在 owner 答复 reject / defer / request_evidence 时，于**同一事务内**写一条 `drift` 监督信号。

- **为什么是这个接缝**：owner 没有采纳 AI 建议，就是判断发生分歧；`drift` 正是为此而设，而这条记录也正是 observer → shadow 晋级唯一能据以论证的**分歧语料**。
- **为什么同事务**：上游那个原子抢占已经决定了本次结果恰好被记录一次，信号继承该保证；幂等重放走提前返回分支，不会写第二条。事后 best-effort 补写，正是生产者悄悄停产而无人知晓的方式。
- **为什么不复用 `recordStage1SupervisionSignal`**：它自己开事务、且带 P2002 捕获的幂等路径，两者在别人的提交边界内都不正确。**该函数至今仍无生产调用方**——这不是缺口，是有意的：治理门在调用方（`assertWorkspaceGovernedActionManagementServiceAccess`，USER 强制）已经执行过。
- **route 一律为 `watch`（含 reject）**：目前没有任何东西消费 `recommendedRoute`，面板只读 status 与 severity。写更强的 route 等于声称一个并不存在的下游交接。

**顺带发现（未修）**：`prisma/seed.ts` 写的 `signalType: "process_deviation"` **不在** `SUPERVISION_SIGNAL_TYPES` 闭集内——seed 直连 Prisma，绕过了服务函数的枚举校验，而 DB 列是自由 String。因此面板今天展示的类型是契约不允许的值。

### GAP-2 决策评估没有生产者（结果不回流）

`evaluateStage1DecisionRecord` 定义于 `lib/stage1-owner-loop/decision-evaluation.service.ts`。

**全仓引用 = 它自己的定义 + 单元测试 + 两个隔离 MySQL 测试（`stage1-owner-loop.mysql.test.ts`、`caio-pro-v1-synthetic-loop.mysql.test.ts`）。生产代码零调用。**

- **影响**：这是挡在"评测实验室"前面的东西。没有评估写回，就凑不出「AI 建议 / 人类决定 / 最终结果」三元组。
- **连带**：因此也拿不出 observer → shadow 升级所需的**分歧语料**——AI 与人从未被记录为分歧时，"AI 是对的"和"测量根本没生效"输出完全一样。

### GAP-3 Company Memory 只有契约，没有持久化

`lib/company-memory/` 有类型（`types.ts`）与 494 行纯函数治理逻辑（`governance.ts`），且自述为 contract-only：

> `contract is pure: types + enums only, no IO, no persistence, no runtime authority.`

- `prisma/schema.prisma` **无** `KnowledgeCard` / `KnowledgeSource` / `CompanyMemory` 模型 → 无持久化 → 不可能有生产者。
- 该目录之外的引用只有 evals 夹具与注释交叉引用；`lib/agentos-decision-supervision/` 只在注释里提到它。
- **易混淆项，不要算作消费者**：`features/companies/company-detail-client.tsx` 有 "Company memory / 公司记忆" 标签，但渲染的是 CRM 的 `memoryFacts` / `memoryEntries`，与知识卡模型无代码关系。
- **同样不算**：`companyMemoryRefs` / `companyMemoryBindings` 在 `lib/stage1-owner-loop/` 中被真实读写，但那是**不透明字符串 ref**，不构造也不读取 `KnowledgeCard`，不经过 `governance.ts`。它证明存在一个占位契约点，不证明记忆层已实现。

### GAP-4 决策对象未携带"援引事实的可用等级"到监督层

GAP-1 与 GAP-2 合起来的后果，单列是因为它决定监督层能否**机械地**发现知识过期：`lib/agentos-decision-supervision/contract.ts` 已经定义了"所有援引知识卡的最低可用等级"这一概念，但由于 GAP-3（无持久化）与 GAP-2（无评估写回），运行时不存在可被援引的知识卡，也不存在把可用等级带进监督信号的路径。

- **本条不被校验器直接断言**，它是前三条的推论；GAP-1..3 任一修复都应重新评估本条。

---

## 3. 修复顺序（建议）

1. ~~**GAP-1**~~ — **已关闭**
2. **GAP-2** — 需要 dispatch → 执行推进 → receipt → 第二人 verify 的完整链路，比 GAP-1 大一档
3. **GAP-3** — 需要 schema 与迁移，是独立一档
4. 之后才谈评测实验室与自治等级升级

---

## 4. `docs/STATUS.md` 在两个相反方向上失真

「Stage 1 一把手经营闭环公共参考切片」一行同时：

| 该行的说法 | 代码事实 |
|---|---|
| 把「可操作的一把手决策 UI」列为**仍需下一层** | **低估**：`features/approvals/stage1-decision-queue.tsx` 已可交互提交，`app/api/stage1/decisions/[decisionId]/review/route.ts` 已实现 |
| 把「决策结果原子评估与 `OBSERVED` Company Memory 候选回流」列为**已交付** | **高估**：`evaluateStage1DecisionRecord` 无生产调用方（GAP-2）；Company Memory 无持久化（GAP-3） |

**这是本清单里最该先修的一条**，因为它是做排序判断的输入。一份把已完成的说成没做、把没做的说成完成的状态文档，会同时导致重复建设和跳过必要工作。

本文件不替代 `docs/STATUS.md`；它只对上述四条断言负责，并且被机械校验。
