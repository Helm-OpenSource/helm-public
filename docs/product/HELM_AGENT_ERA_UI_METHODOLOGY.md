---
status: active
owner: helm-core
created: 2026-07-13
review_after: 2026-08-13
public_safety: Tenant-neutral Agent-era UI / IA design methodology. Design philosophy only; no implementation, no API freeze, no execution authorization. Contains no customer identifiers, private deployment information, or real tenant material.
---

# Helm Agent 时代 UI / IA 设计方法论 / Helm Agent-Era UI / IA Design Methodology

> 本文把"Agent 时代企业软件 UI 不消失而转型"这一论断，收敛为 Helm 的**可执行 IA / UI 设计方法论**：控制面职责、按风险分流的路由矩阵、Agent-ready 变更包、初始化模式、边界铁律、底层升级要求与衡量口径。它是 [默认经营工作区重构蓝图](HELM_DEFAULT_OPERATING_WORKSPACE_REFACTOR_BLUEPRINT.md) 的**方法论上位**——蓝图落"建哪些 surface"，本文答"任何新能力该落哪类 surface、为什么、边界是什么"。
>
> This document distills the thesis "enterprise-software UI does not disappear in the Agent era — it transforms" into Helm's **actionable IA / UI design methodology**: the responsibilities of a co-control plane, a risk-based routing matrix, the Agent-ready Change Packet, the initialization pattern, boundary rules, substrate requirements, and measurement. It is the methodological layer above the [Default Operating Workspace Refactor Blueprint](HELM_DEFAULT_OPERATING_WORKSPACE_REFACTOR_BLUEPRINT.md).

## 0. 论断 / Thesis

过去，UI 是**人的唯一操作入口**：填表单、点按钮，人是执行者，界面是每个动作的输入面。

Agent 时代，UI **不消失而转型**——不是退化为"审批中心"，而是升级为**人与 Agent 的共同控制面（co-control plane）**。它承担六件事：

1. **表达业务意图**（人告诉系统"要达到什么状态"）；
2. **展示 Agent 的行动计划及影响**（做什么、动哪些对象、什么副作用）；
3. **授予有边界、可撤销的权限**（最小权限 + 临时授权）；
4. **处理异常与关键判断**（Agent 处理不了或不该自主处理的）；
5. **支持人工接管与直接操作**（事实查询、探索分析、策略模拟、紧急接管仍需直接界面）；
6. **展示执行回执、证据与审计轨迹**（谁提出、谁批准、Agent 做了什么、结果与能否回滚）。

所以 UI **不会只剩审批队列**——但它的重心从"逐项人工操作"移到"频繁判断 + 监督 Agent 执行"。一句话概括本方法论：

> **UI 服务于频繁判断，通用 Agent 代办低频程序，领域 Agent 承担持续流程，回执体系建立人机协作的信任。**

In the Agent era UI transforms into a **human–Agent co-control plane** (not merely an approval center). It carries six responsibilities: express business intent; show the Agent's plan and impact; grant bounded, revocable permissions; handle exceptions and key judgements; support human takeover and direct operation (fact-query, exploration, strategy simulation, emergency takeover still need direct interfaces); and surface receipts, evidence, and audit trails. UI serves frequent **judgement**; general Agents handle low-frequency **procedures**; domain Agents run continuous **processes**; the **receipt** system builds human–Agent trust.

## 1. 五主面 / The Five Primary Surfaces

按"人与 Agent 的协作性质"切 surface（不再按功能切屏）：

| 主面 / Surface | 承载 | 人的角色 |
|---|---|---|
| **① 经营控制塔** Operating control tower | 当前主线、关键判断、风险与推进状态 | 看全盘、判断"哪里堵" |
| **② 决策队列** Decision queue | **真正需要人拍板**的事项（不做普通通知堆积） | 拍板（review-first 红线）|
| **③ 实施队列** Implementation queue | 初始化 / 配置 / 资源接入 / 升级等**可交通用 Agent 的变更包** | 授权 + 确认关键步 |
| **④ 异常工作台** Exception workbench | 失败、冲突、权限不足、证据缺失、人工接管 | 处置例外、接管 |
| **⑤ 回执与审计** Receipts & audit | 谁提出、谁批准、Agent 做了什么、产出什么、能否回滚 | 追责、建信任 |

外加保留**直接界面**：事实查询、探索分析、策略模拟、canonical action 页——这些**不塌缩**为队列，因为它们是人的判断本身。

## 2. 路由原则：风险 × 标准化 × 可逆性（不止频率）/ Routing by risk × standardization × reversibility

**不能只按频率判断。** 频率决定"谁来做"，但风险、标准化程度、可逆性共同决定"怎么交互、谁保留控制"：

| 工作类型 | 合适的交互方式 |
|---|---|
| 高频、标准、低风险、可逆 | **领域 Agent** 后台自动执行，UI 展示摘要与异常 |
| 低频、标准、低风险、可逆 | **通用 Agent**（Codex / Claude Code / 悟空 / WorkBuddy）按**标准变更包**执行 |
| 高频但高风险 | 受约束自动化 + 抽样复核 + **额度与策略闸门** |
| 低频、高风险、不可逆 | Agent 准备方案与 **dry-run**，人审批或**亲自执行** |
| 高歧义、探索性 | **人在 UI 中判断**，Agent 提供分析与候选方案 |

**原则**：

> **高频标准流程适合领域 Agent；低频标准流程适合通用 Agent；高风险与高歧义流程始终保留人工控制面。**

## 3. 操作建议 → Agent-ready 变更包 / Operation suggestion → Agent-ready Change Packet

不频繁 / 一次性操作**不建专用屏**，作为结构化建议交通用 Agent 执行。但"操作建议"**不能只是自然语言提示**（如"请配置数据库"）——它必须是标准化的 **Agent-ready Change Packet**，让任何符合契约的通用 Agent 无需自己猜步骤、权限与成功标准。至少包含：

| 字段 | 含义 |
|---|---|
| `goal` | 要达到什么**状态** |
| `currentState` | 当前诊断结果 |
| `prerequisites` | 缺少哪些依赖 |
| `requiredPermissions` | 需要什么权限（最小集） |
| `proposedChanges` | 准备修改什么 |
| `effectLevel` | 只读 / 配置变更 / 外部副作用 |
| `forbiddenActions` | 明确禁止什么 |
| `dryRun` | 如何预演 |
| `approvalPolicy` | 哪些步骤需要谁确认 |
| `rollback` | 失败后如何恢复 |
| `expectedReceipts` | 完成后必须返回什么证据 |

> **Helm 不内置 Codex / Claude Code**，而是让自己 **agent-addressable**：任何符合变更包契约的通用 Agent 都能操作它。这既提升交付工程师体验，又不把 Helm 扩张成另一个通用 Agent 平台。

（现有 `operationSuggestionSources` surface 的 `agentBrief` 自由文本是 v1 雏形；v2 目标是把它升级为上述结构化变更包契约——见蓝图后续 Phase。）

## 4. 初始化模式 / Initialization Pattern

安装与初始化尤其适合变更包模式，但要区分**安装前**与**安装后**：

1. **安装前**：仓库提供 `doctor`、环境契约、配置 schema 与 bootstrap manifest。
2. **首次启动后**：`/setup` 诊断材料、资源与权限状态。
3. **Helm 生成初始化变更包**（而非要求交付工程师逐页填表）。
4. **用户把变更包交给自己选择的通用 Agent。**
5. **Agent 先返回**计划、配置 diff、权限需求与 dry-run。
6. **人只确认**涉及凭据、生产环境或不可逆变化的步骤。
7. **Agent 执行**幂等命令并完成验证。
8. **Helm 读取执行回执**，更新资源状态、失败原因与下一步建议。

## 5. 设计决策程序 / Design Decision Procedure

面对任何新能力 / 新交互，按序回答：

1. **这是什么性质的交互？** —— 在途业务流程 / 决策拍板 / 变更实施 / 异常处置 / 问责审计 / 或**人的直接判断（查询/探索/模拟/接管）**。
2. **按 §2 矩阵定"谁做、怎么交互"**：频率×风险×标准化×可逆性 → 领域 Agent 自动 / 通用 Agent 变更包 / 受约束自动化+闸门 / 人审批或亲执 / 人在 UI 判断。
3. **路由到 §1 五主面之一**；直接判断类保留**直接界面**，不塌缩为队列。
4. **默认不建专用屏**——除非它是高频经营主线一等公民、或不可塌缩的直接判断面。
5. **套边界铁律（§6）**，并按 §7 记录可审计语义事件。

## 6. 边界铁律 + 底层必须升级 / Boundaries + the substrate MUST evolve

**呈现契约边界**（自 surface 契约继承）：只读/只导航、徽标无执行态、人在关键节点确认、建议≠执行、无 PII/secret（fail-closed）、fail 方向性（信息 fail-open / 路由 fail-safe / 单一生效无绑定回 Core / 三态禁造数）。

**修正一个常见误述**：说"系统底层逻辑不变"**不准确**。业务对象与核心规则可以延续，但软件**底层必须新增或强化**才能安全承接人机协作：

- 可被 Agent 调用的**工具与命令契约**（agent-addressable）；
- **最小权限**与**临时授权**（有边界、可撤销）；
- **幂等、重试、超时、取消**；
- **dry-run 与变更 diff**；
- **人机职责分离**与**禁止自批**；
- **执行回执、审计与证据链**；
- **回滚与补偿**机制；
- **并发冲突与状态一致性**。

## 7. 运行轨迹 = 可审计语义事件（非模型思维）/ Trajectory = auditable semantic events, not model thinking

运行轨迹审计面**不展示模型的思维过程 / 推理链**，而展示**可审计的语义事件**：调用了什么工具、读取与修改了什么对象、通过了什么策略、由谁批准、结果与证据是什么。审计的对象是**行为与授权**，不是 token 级思考。

## 8. Public Core 分阶段落点 / Public Core staging

Helm 默认界面即 §1 五主面。**第一阶段 Public Core 只做到**：

- **L0**：只读诊断（`/setup` doctor、资源与权限状态）。
- **L1**：生成 Agent handoff / 变更包（§3）。
- **L2**：展示外部 Agent 返回的 dry-run 与执行回执。

**暂不内置**：凭据托管、通用执行器、完整 Agent orchestration。——既提升交付工程师体验，又不把 Helm 扩张成通用 Agent 平台。

## 9. 衡量 · 映射 · 反模式 / Measurement · Mapping · Anti-patterns

**衡量**：新增能力中"未新建专用屏"占比↑；Agent 自主 + 人确认 vs 纯人工操作占比（协作率）；不频繁操作由变更包服务 vs 新建屏占比；首个判断中位时间 / 异常解决时间 / 决策停留时间；有审计回执的 Agent 动作占比。

**映射到已建 surface**（蓝图 Phase 1–5 的 7 个 experimental shell surface 是本方法论的实现底座）：经营控制塔 = `mainline` + `northstarKpiSources`；决策队列 = `/approvals` + mainline `suggestion_ready_pending_human`；异常工作台 = `attentionSources`；回执与审计 = `agentRunAuditSources`（语义事件，§7）；实施队列 = `operationSuggestionSources`（v2 升级为变更包，§3）；IA 路由 = `roleHomeRouting` + `workstationSources`。

**反模式**：为每个动作造按钮 / 为每个能力造屏；公开徽标表达"执行中/已自动/急停"；把不频繁操作做成一次性向导屏（应交变更包）；变更包里塞可执行回调 / 真凭据；审计面展示模型思维链或泄漏 PII；把直接判断面（查询/探索/模拟/接管）也塌缩成队列；宣称"底层逻辑不变"而不落 §6 的底层升级。

## 附：与既有治理的衔接 / Appendix

自动化等级阶梯（observer → shadow → active）是 §2 路由的运行时依据；[AI 推荐治理](HELM_AI_RECOMMENDATION_GOVERNANCE.md)、[智能体化治理要求](HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md) 提供决策队列 / 回执审计的治理契约。本方法论**不新增运行时能力**，只规范呈现与协作 IA + 底层升级要求；执行仍按代码、测试、回执与 review 分阶段落地。
