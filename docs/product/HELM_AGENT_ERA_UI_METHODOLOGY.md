# Helm Agent 时代 UI / IA 设计方法论 / Helm Agent-Era UI / IA Design Methodology

> 本文把"Agent 时代企业软件 UI 不消失而转型"这一论断，收敛为 Helm 的**可执行 IA / UI 设计方法论**：surface 原型、操作分流决策程序、边界铁律与衡量口径。它是 [默认经营工作区重构蓝图](HELM_DEFAULT_OPERATING_WORKSPACE_REFACTOR_BLUEPRINT.md) 的**方法论上位**——蓝图落"建哪些 surface"，本文答"任何新能力该落哪类 surface、为什么、边界是什么"。
>
> This document distills the thesis "enterprise-software UI does not disappear in the Agent era — it transforms" into Helm's **actionable IA / UI design methodology**: surface archetypes, an operation-routing decision procedure, boundary rules, and measurement. It is the methodological layer above the [Default Operating Workspace Refactor Blueprint](HELM_DEFAULT_OPERATING_WORKSPACE_REFACTOR_BLUEPRINT.md): the blueprint decides *which* surfaces to build; this decides *where any new capability belongs, why, and under what boundaries*.

## 0. 论断 / Thesis

过去，UI 是**人的操作入口**：填表单、点按钮，人是执行者，界面是每个动作的输入面。

Agent 时代，UI **不消失而转型**为**监督面**：Agent 自动处理业务流程，**人只在关键节点确认**。系统底层逻辑不变——变的是执行主体，从"人操作"升级为"**人与 Agent 共同执行**"。

因此，UI 的默认形态从"每个功能一个操作屏"转为三类**监督性 surface** + 两类**支撑性 surface**（§1），而**不频繁操作根本不需要专用屏**——它们作为结构化**操作建议**交由通用 Agent 执行（§2）。这不是把旧界面换皮，而是**重排信息架构的第一性原理**：先问"这个交互是什么性质"，再决定"落哪类 surface"，多数情况下答案不是"造一个新屏"。

In the Agent era, UI transforms into a **supervision layer**: Agents run business processes; humans confirm only at key nodes. The default UI shape shifts from "one operation screen per feature" to three **supervisory** surfaces + two **supporting** surfaces (§1), and **infrequent operations need no dedicated screen at all** — they are surfaced as structured **operation suggestions** executed via a general-purpose Agent (§2). This re-orders IA from first principles: ask *what kind of interaction is this* before deciding *which surface it lands on* — and most often the answer is not "build a new screen."

## 1. Surface 原型：三台一箱 + 两支撑面 / Surface Archetypes

任何面向经营者的界面，归入以下五类 surface 原型之一。**不再按"功能"切屏，而按"人与 Agent 的协作性质"切 surface。**

| # | 原型 / Archetype | 性质 | 人的角色 | Helm 已建 surface |
|---|---|---|---|---|
| A | **监督台** Supervision desk | 一眼看全盘经营健康与卡点 | 看，判断"哪里堵" | 控制塔 home（经营主线 mainline + 北极星 KPI）|
| B | **审批台** Approval desk | 建议 → 决策，关键节点人工确认 | **拍板**（review-first 红线）| `/approvals`（+ mainline `suggestion_ready_pending_human` 档）|
| C | **异常处理台 / Agent 收件箱** Exception desk / Agent inbox | 汇集 Agent 无法自主处理的异常/待关注任务 | 处理例外 | 注意力流 attention surface |
| D | **运行轨迹审计面** Run-trajectory audit | 看 Agent 究竟做了什么 | 追责 / 建信任 | 运行轨迹审计 surface（AgentRunCapsule/SARP 投影）|
| E | **操作建议面** Operation-suggestion surface | 不频繁操作作为可交通用 Agent 执行的结构化建议 | 经通用 Agent 补完 | 操作建议 surface |

A/B/C 是**监督性主面**（日常经营的三个核心动作：看全盘、拍板、处理异常）；D/E 是**支撑面**（问责与长尾操作）。角色分流（roleHomeRouting）把每个角色**默认落在其最相关的台**；工位（workstations）登记"哪些台存在、谁的家在哪"。

Surfaces A/B/C are the three daily supervisory actions (see the whole, decide, handle exceptions); D/E support them (accountability + the long tail). Role-home routing lands each role on its most relevant desk; workstation descriptors register which desks exist and whose home is where.

## 2. IA 核心原则：操作按"频率 × 可重复性"分流 / Core IA Principle: route operations by frequency × repeatability

**并非每个操作都配得上一个屏。** 按频率与可重复性把操作分三类，各有归宿：

1. **高频、可重复、在流程内的操作** → **Agent 自主执行**（在其授权阶梯内 observer→shadow→active），人**在关键节点确认**（落 B 审批台）。不为每个动作造按钮。
2. **异常 / 需人判断的在途事项** → **Agent 收件箱**（C 异常台）：severity 分级、角色过滤、导航到既有人审流程。
3. **不频繁 / 一次性 / 初始化操作**（安装初始化、连接器接入、数据播种、一次性迁移、一次性配置）→ **不建专用 UI**，而作为**结构化操作建议**（E 操作建议面）：每条自带 `做什么 / 为什么 / 前置条件 / 证据引用 / 期望结果 / 验证方式`，由人**通过通用 Agent（Claude Code / CodeX / 悟空 / WorkBuddy）执行补完**。**Helm 决定"做什么"（建议），通用 Agent 执行"怎么做"（人监督），结果回流为证据。**

第 3 条是本方法论最强的 IA 简化：它把历来"长尾罕见管理屏"整类**塌缩**为"一个操作建议面 + 通用 Agent 执行"。**UI 表面积收缩，系统能力不减**——新增一个罕见运维能力，默认产出一条操作建议，而非一个新屏。

> **判据（frequency × repeatability 矩阵）**：高频 → Agent 跑 + 审批台确认；低频但**每次形态相似** → 操作建议（模板化，通用 Agent 高效执行）；低频且**每次都不同** → 操作建议 + 更重的人工判断，仍不建专用屏。唯一该建专用屏的：**高频、且是经营主线一等公民的能力面**（如复核台本身）。

Principle 3 is the methodology's strongest IA simplification: it collapses the historical long tail of rare admin screens into one operation-suggestion surface + general-agent execution. UI surface area shrinks while capability does not. A new rare operational capability yields a *suggestion*, not a *screen*.

## 3. 设计决策程序 / Design Decision Procedure

面对任何新能力 / 新交互，按序回答：

1. **这是什么性质的交互？** —— (a) 一条在途业务流程 / (b) 一次决策或审批 / (c) 一个异常待办 / (d) 一次不频繁 / 一次性操作 / (e) 一项问责或审计需求。
2. **路由到原型：**
   - (a) → **A 监督台**呈现状态 + 让 Agent 跑；把它作为经营主线的一个节点暴露（不为其造独立操作屏）。
   - (b) → **B 审批台**（建议 → 人工确认；继承职责分离 + 拒绝分类 + 执行回执）。
   - (c) → **C 异常台 / Agent 收件箱**（attention item：severity + roleCategory + 导航）。
   - (d) → **E 操作建议面**（结构化建议交通用 Agent）。
   - (e) → **D 运行轨迹审计面**（只读运行记录）。
3. **默认不建专用屏**——除非它是"高频且经营主线一等公民"的能力面（§2 判据）。若要建，先证明五原型都不合适。
4. **套用边界铁律（§4）**：只读/只导航、徽标无执行态、关键节点人工确认、建议≠执行、无 PII/secret、fail-closed/fail-open 方向性。
5. **登记与路由**：新能力若落某台，用 roleHomeRouting 决定哪些角色的家落此台、用 workstation 登记其存在；**不新增游离于五原型之外的顶级导航项**。

This procedure is the operational core: classify the interaction, route to an archetype, default to *no new screen*, apply the boundary rules, and register via role-home routing rather than adding free-floating navigation.

## 4. 边界铁律（自 surface 契约继承）/ Boundary Rules (inherited from the surface contracts)

方法论与蓝图 §4.1 的 surface 契约**同一套边界**，任何 surface 设计不得违反：

- **只读 / 只导航**：surface 数据条目只有数据字段与站内 `href`（导航到既有人审流程）；**契约层无动作回调字段**。
- **徽标无执行态**：接管程度词表最高到"建议已就绪·待人工确认"；公开面**不表达自动执行 / 急停**（Core 无自动执行链路，展示即虚假能力宣称）。
- **人在关键节点确认**：高风险动作必须真实用户身份确认；"本人撰写 + 本人批准"的高风险自批阻断（职责分离）。
- **建议 ≠ 执行**：操作建议的 `agentBrief` 是给通用 Agent 的**声明式规格**，不是可执行回调；Helm 绝不代执行。
- **无 PII / secret**：脱敏仅 ref；疑似手机号/身份证/邮箱/令牌/密钥一律 **fail-closed 拒**（审计面与操作建议面尤重）。
- **fail 方向性**：信息展示 fail-open（降级不空屏）；角色路由 fail-safe 向最低信息面；单一生效 provider 无绑定 / 冲突一律回 Core default；三态禁造数（`measured | pending_source | no_data`）。

**诚实边界**：surface 契约是**形状约束 + provider 选择**，不是执行隔离保证——provider 仍是进程内函数，当前无插件 sandbox。方法论约束的是**呈现与协作契约**，不替代运行时权限与授权。

## 5. 衡量 / Measurement

方法论落地的可观测口径（与蓝图 UX 门互补）：

- **屏数 / 点击到决策深度下降**：新增能力中"未新建专用屏"的占比（越高越好）。
- **协作率**：Agent 自主执行 + 人确认的动作占比 vs 纯人工操作占比（飞轮成熟度）。
- **长尾覆盖**：不频繁操作由**操作建议**服务的比例 vs 新建屏的比例。
- **监督效率**：首个判断中位时间、异常解决时间、审批停留时间。
- **问责覆盖**：有运行轨迹审计记录的 Agent 动作占比。

## 6. 映射到 Helm 已建 surface / Mapping to Helm's Built Surfaces

本方法论不是空想——Helm 公开 Core 已建的 7 个 experimental shell surface **就是**这套原型的实现（蓝图 Phase 1–5）：

| 方法论原型 | Helm surface（PackContributions，experimental）|
|---|---|
| A 监督台 | `mainline`（经营主线，单一生效）· `northstarKpiSources`（北极星 KPI，concat）|
| B 审批台 | `/approvals` + mainline `suggestion_ready_pending_human` 档 |
| C 异常台 / Agent 收件箱 | `attentionSources`（注意力流，concat）|
| D 运行轨迹审计面 | `agentRunAuditSources`（AgentRunCapsule/SARP 投影，concat）|
| E 操作建议面 | `operationSuggestionSources`（concat）|
| IA 路由 | `roleHomeRouting`（单一生效）· `workstationSources`（concat）|

每个 surface 都遵 §4 边界（validator + Core 默认 + 空 store 镜像平价 + fail-closed）。第二真实消费者（如 overlay provider）接入后，契约方可脱 experimental 冻结。

The seven experimental shell surfaces already built in public Core (blueprint Phases 1–5) *are* the implementation of these archetypes. Each obeys the §4 boundaries. A contract un-freezes from `experimental` only after a second real consumer registers.

## 7. 反模式 / Anti-patterns

- **为每个动作造按钮 / 为每个能力造屏**——回到"人操作入口"旧范式；应路由到五原型。
- **在公开徽标表达"执行中 / 已自动完成 / 急停"**——over-claim 执行能力，违背徽标无执行态。
- **把不频繁操作做成一次性向导屏**——应作为操作建议交通用 Agent；一次性向导是长尾屏膨胀之源。
- **操作建议里塞可执行回调 / 真凭据**——建议≠执行；`agentBrief` 只描述，不携带 secret。
- **新增游离于五原型之外的顶级导航项**——IA 熵增；先证明五原型都不合适。
- **审计 / 异常面泄漏 PII**——必须脱敏仅 ref，fail-closed。

## 附：与既有治理的衔接 / Appendix: ties to existing governance

- 自动化等级阶梯（observer → shadow → active）决定"Agent 自主 vs 人确认"的分界，是 §2 第 1 条的运行时依据。
- [AI 推荐治理](HELM_AI_RECOMMENDATION_GOVERNANCE.md)、[智能体化治理要求](HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md) 提供 B/D 面的治理契约（建议、证据、人审、owner 决策边界；AgentRunCapsule / SARP）。
- 本方法论**不新增运行时能力**，只规范呈现与协作 IA；执行仍按代码、测试、回执与 review 分阶段落地。
