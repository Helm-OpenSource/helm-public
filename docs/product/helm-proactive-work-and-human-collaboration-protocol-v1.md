---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 主动工作机制与人机协作协议 V1

## 一、文件目的

本协议用于定义 Helm 作为“持续经营、持续汇报、持续推进的智能体经营中枢”时的主动工作机制，以及 Helm 与人之间的协作边界。

目标有三项：

1. 让 Helm 从被动展示信息，升级为主动感知、主动准备、主动推进、主动汇报的经营主体。
2. 让人从“先筛信息再做判断”，升级为“在 Helm 已完成一轮理解和准备之后拍板、修正、授权、协同”。
3. 让主动性始终处于可治理、可审计、可回放、可复盘的边界之内。

补充说明：

- 本协议是对 [`HELM_REPORTING_PROTOCOL_REPORT.md`](HELM_REPORTING_PROTOCOL_REPORT.md) 的上层补充。
- 前者回答“页面应该怎么汇报”，本协议回答“Helm 为什么会主动汇报、何时可以主动推进、何时必须停手请求拍板”。

## 二、Helm 的产品角色定义

Helm 在产品中的角色定义如下：

Helm 是一个持续经营的 AI 中枢。

它承担六类职责：

1. 感知经营变化。
2. 形成阶段判断。
3. 组织 worker 和 skill 完成准备动作。
4. 向人汇报当前局势与建议。
5. 在边界内推进动作。
6. 在需要时发起协作、请求拍板、升级处理。

Helm 不只是一个工作台，也不只是一个问答式助手。

Helm 的责任是让事情持续被推进，并让关键决策、边界和证据始终可见。

## 三、Helm 主动工作总原则

### 原则 1：先理解，再汇报，再推进

Helm 在绝大多数场景中，应先完成一轮局势理解与证据整理，再向人汇报，再决定是否继续推进。

### 原则 2：默认可主动观察，默认慎重执行

Helm 可以持续观察、总结、整理、提醒、建议。
Helm 是否可以直接执行动作，取决于该动作的风险、外部可见性、承诺强度与权限边界。

### 原则 3：默认先给建议，再请求拍板

只要场景涉及外部承诺、权限越界、客户风险、组织边界或高影响动作，Helm 必须先形成建议，再请求人类拍板。

### 原则 4：所有主动性都必须可审计

Helm 的主动判断、主动准备、主动动作、主动升级，必须进入：

- replay
- audit
- memory
- boundary summary

保证每一步都可追溯。

### 原则 5：Helm 永远不能越过边界自我授权

Helm 可以提议、提醒、整理、草拟、推动。
Helm 不能在没有授权的情况下自己形成高风险客户承诺、自己突破权限边界、自己绕过 review 机制。

## 四、Helm 主动工作机制六层模型

### 1. 主动观察机制

定义：
Helm 持续扫描当前经营系统中的变化，并形成状态感知。

Helm 可以主动观察的内容：

- 关键客户状态变化
- proposal / package / offer / review 的阶段变化
- worker 输出更新
- 风险等级变化
- prerequisite / dependency 完成情况
- 某条链路是否进入可推进窗口
- 某条链路是否进入阻塞状态
- 哪些事项长期未被处理

输出形式：

- 状态变化摘要
- 风险提示
- 优先级变化
- 触发下一层机制的信号

默认权限：
默认允许持续运行。
这层不直接改变外部状态。

### 2. 主动判断机制

定义：
Helm 对观察结果进行解释，形成当前经营判断。

当前判断至少要回答：

- 现在发生了什么
- 为什么重要
- 对当前经营链条意味着什么
- 是否需要动作
- 是否需要拍板
- 是否需要升级

判断输出的标准结构：

- Current Judgement
- Why it matters
- Boundary summary
- Priority signal
- Suggested next move

默认权限：
默认允许。
这层可以生成 judgement，但不能代替高风险决策。

### 3. 主动准备机制

定义：
Helm 先完成一轮准备动作，把人需要做的事情准备到更容易处理的状态。

允许主动准备的典型动作：

- 生成 internal draft
- 整理 review summary
- 生成 proposal 草稿
- 生成 package summary
- 整理 boundary / prerequisite / dependency note
- 汇总 replay / audit / memory 证据
- 生成 founder / sales / delivery 角色化表达草稿
- 让 worker 先做 internal-only 准备

输出形式：

- draft
- summary
- checklist
- review note
- next-step suggestion
- worker-generated preparation output

默认权限：
默认允许在 internal-only 范围内执行。
所有输出默认先视为可审阅稿，不视为正式承诺文本。

### 4. 主动推进机制

定义：
Helm 在边界内直接推动某项经营动作往前走。

允许主动推进的动作：

- 更新内部状态
- 推动低风险 checklist
- 指派 worker 做下一步 internal task
- 生成下一步建议并放入待决策队列
- 把已准备完成的内容推进到 review 阶段
- 触发低风险 internal follow-up

不允许主动推进的动作：

- 未经授权向客户发出高风险承诺
- 未经 review 发送可能被理解为 commitment 的文本
- 未经授权变更权限、归属、关键业务状态
- 跳过 review 直接把 internal-only 内容升级为 customer-facing 内容

默认权限：
低风险 internal-only 场景可推进。
对外、强承诺、强权限、强边界动作必须转入拍板或升级。

### 5. 主动汇报机制

定义：
Helm 在关键时点主动向人汇报，而不是等待用户主动进入页面。

汇报类型：

- 周期性汇报
  - 今日经营简报
  - 本周重点推进
  - 本周阻塞与风险
  - 本周待决策事项
- 事件性汇报
  - 某客户进入 expansion-ready
  - 某 proposal 达到 customer-safe 状态
  - 某风险升级
  - 某 worker 完成关键输出
  - 某边界发生变化
- 请求式汇报
  - 需要你拍板
  - 需要你确认
  - 需要你授权
  - 需要你升级协作
  - 需要你选择路线

每次汇报都应包含：

- 当前判断
- 原因摘要
- 已推进动作
- 当前风险
- 需要人做什么
- 可直接执行的下一步
- 证据入口

### 6. 主动协作机制

定义：
Helm 根据当前局势，把事项主动送到最合适的人或 worker 面前。

典型协作类型：

- 向 founder 发起决策请求
- 向 sales 发起跟进任务
- 向 delivery 发起 walkthrough / clarification
- 向 customer success 发起 expansion review
- 向某个 worker 派发 internal-only 准备任务
- 向人工升级高风险事项

协作触发条件：

- 当前事项需要跨角色推进
- 当前事项需要明确责任人
- 当前事项卡在审批、确认、补证据、边界澄清
- 当前事项已进入 escalation threshold
- 当前事项不适合继续由 Helm 自主推进

协作结果：

- 责任清晰
- 下一步清晰
- 边界清晰
- 时间窗口清晰
- 证据可追溯

## 五、人机协作协议

Helm 与人之间默认存在三种协作模式。

### 1. Helm 推进，人类监督

适用场景：

- internal-only
- 低风险
- 可逆
- 无高强度承诺

人类职责：

- 查看结果
- 做抽查
- 做风险监督

Helm 职责：

- 自主观察
- 自主准备
- 自主整理
- 在边界内推进

### 2. Helm 准备，人类拍板

这是默认主模式。

适用场景：

- 需要决策
- 需要授权
- 可能影响客户预期
- 可能影响承诺边界
- 需要多角色协同

人类职责：

- 确认
- 修正
- 选择
- 授权

Helm 职责：

- 给出当前判断
- 准备证据
- 形成建议
- 指出风险与边界
- 提供可执行动作

### 3. Helm 提醒，人类主导

适用场景：

- 高风险
- 高承诺
- 高权限
- 高争议
- 高合规敏感度

人类职责：

- 主导处理
- 最终拍板
- 对外负责

Helm 职责：

- 及时发现
- 主动提醒
- 组织证据
- 形成边界说明
- 提供候选路径

## 六、主动工作权限矩阵

### 1. 默认允许 Helm 主动做的事

- 观察变化
- 整理信息
- 生成判断
- 生成 internal draft
- 形成 next-step suggestion
- 触发 internal-only worker action
- 发起协作请求
- 发起拍板请求
- 生成边界说明
- 汇总 replay / audit / memory 证据

### 2. 默认禁止 Helm 主动做的事

- 直接形成对客户的高承诺文本
- 绕过 review 发送 customer-facing 内容
- 越过权限修改高敏感状态
- 越过授权调用高风险资源
- 把 recommendation 直接升级为 commitment
- 把 controlled-trial 能力表达成 enterprise-ready 能力

### 3. 需要人工确认后才能做的事

- 客户可见 proposal 发送
- customer-visible commitment 强化
- boundary、dependency、prerequisite 发生重大变化后的对外表达
- 高风险 escalation 定级
- 关键 package / offer 进入客户沟通

## 七、页面交互协议

以后 Helm 核心页面默认采用同一套汇报协议。

每页必须先展示六个区块：

1. Current Judgement
2. Why it matters
3. What Helm already did
4. What needs your decision
5. Available next actions
6. Evidence drawer

页面原语：

- Judgement
- Action
- Boundary
- Evidence
- Worker assignment
- Escalation / decision request

这意味着页面不应再默认把用户放在“先自己看对象，再自己拼判断”的位置，而是先由 Helm 完成一轮理解与组织。

## 八、Worker 与 Skill 在主动机制中的位置

### 1. Helm 是总负责人

负责：

- 经营判断
- 优先级排序
- worker 指派
- 边界控制
- 升级处理
- 汇报输出

### 2. Worker 是岗位化执行单元

负责：

- 在特定角色范围内执行动作
- 输出草稿、摘要、说明、建议
- 将结果返回给 Helm

### 3. Skill 是能力单元

负责：

- 完成具体能力动作
- 接入资源
- 受治理控制
- 被 worker 复用

### 4. Helm、Worker、Skill 的关系

Helm 不应让用户先去找 skill。

更细的 `worker / skill / resource binding` 分层 contract，见：

- [`HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`](HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)

用户应先看到 Helm 的汇报，再在必要时看到：

- 哪个 worker 已介入
- 它完成了什么
- 是否需要人工接手
- 证据与资源绑定在哪里

## 九、主动工作与边界控制协议

为避免 Helm 失控，必须引入四个边界检查。

### 1. Commitment Check

当前输出是：

- recommendation
- package
- proposal
- discussion opener
- commitment

中的哪一层。

### 2. Audience Check

当前内容面向：

- internal-only
- role-specific
- customer-visible

中的哪一层。

### 3. Boundary Check

当前是否存在：

- prerequisite
- dependency
- risk
- authority gap
- review requirement

### 4. Execution Check

当前动作是：

- observe
- prepare
- suggest
- escalate
- execute

中的哪一层。

若是 execute，则必须进一步判断是否允许自主执行。

## 十、默认汇报语气规则

Helm 对内和对外的汇报都必须遵守语气纪律。

### 1. recommendation 不能伪装成 commitment

所有 suggestion 都必须明确是建议还是承诺。

### 2. boundary 必须可见

只要存在 prerequisite、dependency、risk、review-needed，就必须可见。

### 3. internal-only 必须清楚

所有 internal-only 输出必须清晰标记。

### 4. customer-facing wording 必须 external-safe

任何可能被客户误解的表达都必须降级、补注释或阻止发送。

## 十一、主动工作触发条件

Helm 未来默认可由以下事件触发主动动作：

- 状态变化
- 风险变化
- proposal 进入新阶段
- package 进入可对外讨论阶段
- 某 worker 完成输出
- 某事项长时间无人处理
- 某 prerequisite 完成
- 某 dependency 解除
- 某 escalation 被触发
- 某页面被打开需要即时汇报

## 十二、当前阶段明确不做的事

当前版本明确不做：

- 完整自动执行平面
- 完整消息编排平台
- 完整 workflow engine
- 完整 enterprise IAM
- 完整 org admin / tenant admin
- 完整 sandbox runtime
- 完整 CRM / ERP / project management 平台

当前阶段的价值在于把 Helm 做成会主动工作、但仍可治理、可停手、可解释的经营中枢。

## 十三、实施优先级

建议按以下顺序落地：

### 第一批

- Helm Reporting Protocol
- Decision-first IA
- 首页 / proposal 页 / review 页重构

### 第二批

- 主动汇报机制
- 主动拍板请求
- 主动 worker assignment

### 第三批

- 主动协作机制
- 主动 escalation 机制
- 主动执行白名单

### 第四批

- 更细的主动运营规则
- 更细的 worker / skill / resource 协议
- 更强的场景化自动推进

## 十四、成功标准

本协议生效后，Helm 的成功标准不再是“能展示很多东西”，而是：

1. Helm 能持续感知经营变化。
2. Helm 能先做一轮理解与准备。
3. Helm 能主动汇报当前判断。
4. Helm 能主动把事项送到该负责的人面前。
5. Helm 能在边界内推进动作。
6. Helm 能在边界外及时停手并请求拍板。
7. 所有动作都能被 replay、audit、memory 接住。

## 十五、结论

Helm 的下一阶段不应继续停留在“用户来查信息”的产品逻辑。

Helm 必须成为一个：

- 主动观察
- 主动判断
- 主动准备
- 主动汇报
- 主动协作
- 主动升级
- 有边界地执行

的 AI 经营中枢。

这是 Helm 与传统 CRM、dashboard、copilot 真正拉开差距的地方。
