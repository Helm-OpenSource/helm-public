---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 产品原则

## 文档目的

本文件用于定义“经营推进控制台”的长期产品原则。

作用有三点：

1. 让产品决策始终围绕同一套标准展开
2. 让设计、研发、评审、演示都使用一致语言
3. 防止产品在迭代过程中偏离核心方向

本文件优先级高于零散想法，低于明确用户需求。

---

## 一、产品使命

经营推进控制台的使命，是帮助高价值职业个体和小团队：

1. 识别真正重要的经营动作
2. 把沟通和会议变成下一步行动
3. 减少机会漏损
4. 在清晰授权下让 AI 执行动作
5. 让每一次 AI 建议和执行都可追踪、可解释、可回放

长期方向是：
从工作域记忆出发，逐步形成行动代理、权限控制、预算控制、审计追踪和信誉积累能力。

---

## 二、产品定位

经营推进控制台是一个：

1. 经营工作台
2. 行动代理控制台
3. 审批与审计中心
4. 工作域长期记忆系统

它面向的是“推进事情的人”，尤其是：

1. 销售负责人
2. 猎头顾问
3. 创始人 / COO
4. 高价值顾问和服务型团队

---

## 三、产品边界

### 当前边界

首期只解决以下问题：

1. 今天最该做什么
2. 哪些机会正在降温
3. 会议前需要准备什么
4. 会议后下一步是什么
5. 哪些动作可以由 AI 先建议
6. 哪些动作需要用户审批
7. 哪些行为需要被追踪和回放

### 暂不进入的方向

在没有明确商业牵引前，不主动进入：

1. 泛社交
2. AI 陪伴
3. 数字人形象
4. 泛娱乐
5. 通用 CRM 全量替代
6. 通用邮件客户端替代
7. 真实支付和清结算
8. 复杂金融行为
9. 面向大众消费者的轻量聊天产品

---

## 四、核心产品原则

### 原则 1：先解决经营动作，再扩展成平台

产品第一阶段必须优先服务“推进一件事”。

任何功能，如果不能帮助用户：

1. 找到下一步动作
2. 推进机会
3. 减少漏损
4. 降低管理成本

那它在首期都不是优先项。

---

### 原则 2：所有 AI 建议都必须连接到真实对象

系统中的 AI 不能生成悬浮建议。

每一条 AI 建议，都必须能落到以下对象之一：

1. 联系人
2. 公司
3. 机会
4. 会议
5. 动作
6. 审批任务

用户必须能理解：

1. 为什么出现这个建议
2. 这个建议对应什么上下文
3. 采纳后会发生什么

---

### 原则 3：行动能力必须建立在授权之上

任何 AI 动作都要先考虑权限。

必须清楚定义：

1. 哪类动作只能建议
2. 哪类动作需要逐条审批
3. 哪类动作可在阈值内自动执行
4. 哪类动作永远禁止

如果一个动作无法说明授权边界，这个动作就不应上线。

---

### 原则 4：审计不是附属模块，是产品核心价值的一部分

用户愿不愿意把事情交给 AI，很大程度取决于：

1. 能不能知道 AI 做了什么
2. 能不能知道 AI 为什么这么做
3. 出问题后能不能追溯
4. 能不能修正或回滚

所以，审计能力不是后台补充，而是产品信任的基础。

---

### 原则 5：首期只做工作域记忆，不做全人生记忆

首期记忆只服务当前工作流。

必须围绕：

1. 联系人关系
2. 公司上下文
3. 机会推进
4. 会议结论
5. 历史动作

不主动延伸到：

1. 个人生活
2. 情感关系
3. 全量个人数据镜像
4. 泛记忆助手

这样可以降低复杂度，提高可信度。

---

### 原则 6：每个页面都必须明确“下一步动作”

无论用户打开哪个核心页面，都必须能回答：

1. 当前状态是什么
2. 风险在哪里
3. 下一步该做什么
4. 我能不能马上做
5. 这一步是否需要审批

如果一个页面无法清楚指向下一步动作，它就还不够成熟。

---

### 原则 8：页面默认应该是 Helm 在汇报，不是用户在拼信息

用户打开页面后，首先应该收到：

1. Helm 当前判断
2. 为什么这样判断
3. Helm 已推进了什么
4. 当前需要用户拍板什么
5. 可以直接执行什么动作
6. 证据和回放在哪里

如果页面仍然主要依赖：

1. 对象列表
2. 状态堆叠
3. 用户自己先筛选和拼装语义

那它就仍然停留在上一代 CRM / 后台界面的阅读习惯里。

---

### 原则 8A：页面必须通过统一 Narrative Components 和四层信息结构来汇报

Helm 当前默认页面骨架必须继续遵循：

1. `NarrativeHeader`
2. `WhyItMattersBlock`
3. `HelmDidBlock`
4. `DecisionRequestCard / CollaborationRequestCard`
5. `ActionRail`
6. `BoundaryNote`
7. `WorkerSummary`
8. `EvidenceChip`
9. `EvidenceDrawer`

同时必须继续遵循四层结构：

1. L1 判断层
2. L2 行动层
3. L3 边界层
4. L4 证据层

也就是说：

- 判断必须先于动作
- 动作必须先于对象细节
- 边界必须默认可见
- 证据默认折叠

当前 Narrative Components Baseline Freeze 入口：

- `NARRATIVE_COMPONENTS_BASELINE_FREEZE_REPORT.md`
- `INFORMATION_HIERARCHY_BASELINE_FREEZE_REPORT.md`
- `REPRESENTATIVE_PAGES_BASELINE_FREEZE_REPORT.md`

proposal / package detail 当前也必须继续遵循同一套 judgement-first 页面协议：

- 先说 Helm 当前怎么看 proposal / package
- 再说为什么现在适合推进、暂缓、review 或 customer-safe 化
- 再说 Helm 已经整理了什么
- 再说当前缺什么 prerequisite / dependency / approval
- 最后才把 replay / audit / memory / worker output 放到 evidence 层

这仍是第一轮 detail template，不等于完整 proposal platform 或 package engine。

customer-facing offer / external proposal 详情页当前也必须继续遵循同一套 judgement-first 页面协议：

- 先说 Helm 当前建议怎么对外表达
- 再说当前是 external-safe、discussion-only、review-before-send 还是 not-safe-to-send
- 再说 Helm 已经整理了什么版本、边界和 sendability trace
- 再说当前缺什么 prerequisite / dependency / approval
- 最后才把 replay / audit / memory / worker output 放到 evidence 层

这仍是第一轮外部表达 detail template，不等于完整 offer platform、external proposal generator、legal / contract engine。

commitment reinforcement / sendability 详情页当前也必须继续遵循同一套 judgement-first 页面协议：

- 先说 Helm 当前建议把表达强化到什么程度
- 再说当前属于 customer-visible reinforcement、discussion-only、review-before-send 还是 not-safe-to-send
- 再说 Helm 已经整理了哪些 strengthening cue、review note、boundary trace 和 sendability trace
- 再说当前还缺什么 prerequisite / dependency / risk mitigation
- 最后才把 replay / audit / memory / worker output 放到 evidence 层

这仍是第一轮 reinforcement / sendability detail template，不等于完整 contract engine、legal review 平台或高风险自动外发平面。

customer-facing package variants / commitment reinforcement variants 详情页当前也必须继续遵循同一套 judgement-first 页面协议：

- 先说 Helm 当前建议使用哪个 variant、强化停在哪一层
- 再说当前为什么停在 exploratory、pilot-expansion、review-before-send、internal-only 或 non-commitment fallback
- 再说 Helm 已经整理了哪些 customer-visible cue、boundary note、worker output 和 trace
- 再说当前还缺什么 prerequisite / dependency / risk mitigation / approval
- 最后才把 replay / audit / memory / worker output 放到 evidence 层

这仍是第一轮 variants detail template，不等于完整 package engine、offer platform、strengthening orchestration 平台或 contract engine。

当前这组 variants detail template 已经进入第一轮 `Baseline Freeze`，所以 demo、training、acceptance、delivery 必须继续沿用同一套 variant / strengthening / boundary / evidence 讲法，不能各写各的。

package stage variants / commercial narrative strengthening 详情页当前也必须继续遵循同一套 judgement-first 页面协议：

- 先说 Helm 当前建议停在哪个 stage / strengthening level
- 再说为什么当前适合这一层，不适合更强或更弱的一层
- 再说 Helm 已经整理了哪些 boundary、sendability、fallback、worker cue 和 next-step framing
- 再说当前还缺什么 prerequisite / dependency / risk mitigation / approval
- 最后才把 replay / audit / memory / worker output / trace 放到 evidence 层

这仍是第一轮 `package stage variants / commercial narrative strengthening 详情页` 模板，不等于完整 package engine、commercial engine、contract engine 或 legal review 平台。

当前这组 stage / strengthening detail template 已经进入第一轮 `Baseline Freeze`，所以 demo、training、acceptance、delivery 必须继续沿用同一套 stage / strengthening / boundary / evidence 讲法，不能各写各的。

也就是说，`Package Stage Variants / Commercial Narrative Strengthening Baseline Freeze` 现在已经成为这组页面的默认交付口径。

conversation / external narrative 详情页当前也必须继续遵循同一套 judgement-first 页面协议：

- 先说 Helm 当前建议怎么说
- 再说为什么当前适合这一层 conversation scene / external narrative level，而不适合更强或更弱的一层
- 再说 Helm 已经整理了哪些 audience cue、boundary、sendability、fallback、worker cue 和 next-step framing
- 再说当前还缺什么 prerequisite / dependency / risk mitigation / approval
- 最后才把 replay / audit / memory / worker output / trace 放到 evidence 层

这仍是第一轮 `conversation / external narrative 详情页` 模板，不等于完整 messaging platform、sales enablement 平台、proposal generator 或 commercial conversation engine。

当前这组 conversation / external narrative detail template 已经接入现有 commercial detail chain，所以 demo、training、acceptance、delivery 必须继续沿用同一套 conversation scene / narrative level / boundary / evidence 讲法，不能各写各的。

当前这组 conversation / external narrative detail template 也已经进入第一轮 `Baseline Freeze`，所以默认交付口径已经收敛到：

- conversation scene / audience / sendability
- external narrative level / fallback / sendability
- boundary / prerequisite / dependency / non-commitment
- handoff reason / next action / evidence

也就是说，`Conversation / External Narrative Detail Chain Baseline Freeze` 现在已经成为这组页面的默认交付口径。

founder / sales / delivery conversation 详情页当前也必须继续遵循同一套 judgement-first 页面协议：

- 先说 Helm 当前建议这个角色怎么说
- 再说为什么当前适合这一层 founder / sales / delivery scene，而不适合更强或更弱的一层
- 再说 Helm 已经整理了哪些 audience cue、boundary、sendability、worker cue 和 next-step framing
- 再说当前还缺什么 prerequisite / dependency / risk mitigation / approval
- 最后才把 replay / audit / memory / worker output / trace 放到 evidence 层

这仍是第一轮 `founder / sales / delivery conversation 详情页` 模板，不等于完整 messaging platform、sales enablement / delivery enablement 平台或 commercial conversation engine。

当前这组 founder / sales / delivery conversation detail template 已经接入现有 commercial detail chain，所以 demo、training、acceptance、delivery 必须继续沿用同一套 role scene / boundary / sendability / evidence 讲法，不能各写各的。

founder Q&A 详情页当前也必须继续沿用同一套 judgement-first 页面协议：先说 Helm 当前建议 founder 怎么回答，再说为什么当前适合 strategic / value / scope / why-now / next-step 这一层，而不适合更强回答，然后明确保留 boundary、prerequisite、dependency、non-commitment fallback、review-before-send 和 evidence。它仍是第一轮 founder Q&A detail 模板，不等于完整 founder enablement 平台或 commercial conversation engine。

sales objection / follow-up 详情页当前也必须继续沿用同一套 judgement-first 页面协议：先说 Helm 当前建议 sales 怎么回、怎么跟，再说为什么当前适合 objection reply / follow-up / clarification 这一层，而不适合更强表达，然后明确保留 boundary、prerequisite、dependency、non-commitment fallback、review-before-send 和 evidence。它仍是第一轮 sales objection / follow-up 详情页模板，不等于完整 sales enablement 平台、CRM 平台或 commercial conversation engine。

delivery walkthrough / review 详情页当前也必须继续沿用同一套 judgement-first 页面协议：先说 Helm 当前建议 delivery 怎么解释、怎么 review，再说为什么当前适合 walkthrough / review / clarification 这一层，而不适合更强表达，然后明确保留 boundary、prerequisite、dependency、non-commitment fallback、review-before-send 和 evidence。它仍是第一轮 delivery walkthrough / review 详情页模板，不等于完整 delivery enablement 平台、ops 平台或 commercial conversation engine。

external narrative fallback 详情页当前也必须继续沿用同一套 judgement-first 页面协议：先说 Helm 当前建议 narrative 应退回到哪一层，再说为什么当前适合 non-commitment fallback / boundary-only fallback / review-before-send fallback / blocked narrative 这一层，而不适合更强表达，然后明确保留 boundary、prerequisite、dependency、non-commitment fallback、review-before-send 和 evidence。它仍是第一轮 external narrative fallback 详情页模板，不等于完整 messaging platform、sales enablement 平台或 commercial conversation engine。

contacts / companies / meetings 当前也已经接入第一轮 conversation detail chain extension：

- 先说当前它在沟通链里的位置
- 再说为什么现在应该切到这页
- 再说当前边界、handoff 和 next action
- 最后才回到原有对象详情区

这仍是第一轮 conversation detail chain extension，不等于完整 CRM、communications graph 或 workflow engine。

inbox / follow-up / review request detail 当前也必须继续沿用同一套 judgement-first 页面协议：先说 Helm 当前建议怎么处理这条沟通、跟进或 review 请求，再说为什么当前适合 internal-only、customer-visible、review-before-send、boundary-only 或 non-commitment 这一层，然后明确保留 handoff reason、boundary、prerequisite、dependency、risk、worker summary 和 evidence。它仍是第一轮 inbox / follow-up / review request detail 模板，不等于完整 inbox / messaging platform、email client、review workflow engine 或 notifications center。

customer success handoff surface 当前也必须继续沿用同一套 judgement-first 页面协议：先说 Helm 当前为什么建议由 customer success 接手，再说为什么当前适合停在 success follow-through、success check、expansion review、review-before-send、issue-follow-through、escalation-follow-through 或 blocked-by-boundary 这一层，然后明确保留 judgement、reason、evidence summary、boundary、decision posture、decision request、prerequisite、dependency、risk、non-commitment、handoff reason、next action 和 evidence。它仍是第一轮 customer success handoff 详情页模板，不等于完整 customer success platform、CRM / CS ops 平台或 workflow engine。

当前这组 customer success handoff detail template 也已经进入第一轮 `Baseline Freeze`，所以 demo、training、acceptance、delivery 必须继续沿用同一套 customer success stage / ownership / boundary / evidence 讲法，不能各写各的。

也就是说，`Customer Success Handoff Surface Baseline Freeze` 现在已经成为这组页面的默认交付口径。

在此之上，v1.1 只允许补一层很薄的 derived `success queue / success inbox` 运营面，以及 `issue / escalation` 的区分语义；它们仍建立在 existing opportunity / review / company / inbox context 上，不会变成新的 canonical customer success object，也不会变成 workflow engine。

其中：

- `issue-follow-through` 只表示真实 follow-through 问题已经出现，但修复路径仍停在正常当前轮协调里
- `escalation-follow-through` 只表示当前已经被 dependency、boundary、缺失 decision、widened ownership pressure 或更高 risk 实质阻塞
- `success queue / success inbox` 只是一层 derived operational surface，用于 visibility / triage / routing cue
- `recommendation / handoff / success follow-through / success check / expansion review` 都不等于 commitment
- `review-before-send` 仍不是 safe-to-send by default

跨 detail handoff 不是普通跳转链接。

当前 proposal / package / offer / external proposal / reinforcement / sendability / variants 之间的切换，也必须继续遵循 judgement-first 规则：

- 先说为什么现在要切到下一页
- 再说当前 boundary / prerequisite / dependency / risk 有没有变化
- 再说现在是谁接手、谁拍板、谁继续推进
- 最后才把 replay / audit / memory 放到 evidence 层

也就是说，unified detail navigation 不能退回成对象目录，cross-detail handoff 也不能退回成单纯 breadcrumb。

当前 `Unified Detail Navigation / Cross-detail Handoff` 已进入第一轮 `Baseline Freeze`，所以 demo、training、acceptance、delivery 必须继续沿用同一套：

- current node
- handoff reason
- handoff boundary
- next action
- evidence drawer

讲法，不能一边写成 judgement-first handoff，一边又在交付资产里退回成普通页面跳转。

如果一个页面重新退回：

1. 首屏先摆列表
2. 首屏先摆状态卡
3. 把边界埋进证据层
4. 把原始对象详情放在主叙事前面

那它就违背了 Helm 的人类界面协议。

---

### 原则 9：Helm 默认应该主动感知变化并主动发起协作

Helm 不应该只在用户打开页面之后才开始“汇报”。

只要系统已经观察到：

1. 风险变化
2. 机会变化
3. proposal / package 进入新阶段
4. worker 完成关键准备
5. 某事项已经进入需要拍板的窗口

Helm 就应该先完成一轮准备，再主动把事项送到正确的人面前。

默认顺序应该是：

1. 先观察
2. 先判断
3. 先准备
4. 再汇报
5. 再请求协作
6. 最后才在边界内执行

如果 Helm 只是把对象、状态和列表摊给用户自己重新拼接，它就仍然只是上一代系统加了一层 AI。

当前第一轮主动经营中枢已经以 active reporting / proactive collaboration baseline freeze 的形式固定下来；后续页面改造、worker 协作和交付演示都必须继续挂在这套判断顺序上，而不是退回对象堆叠。

---

### 原则 7：先做高价值高频用户，不做泛用户

产品首期不追求大而全。

优先服务：

1. 愿意付费
2. 高频使用
3. 数据密度高
4. 有清晰机会漏损痛点
5. 愿意共创流程

这些用户会比泛用户更快告诉我们，什么功能真的值钱。

---

## 五、体验原则

### 1. 像经营控制台，不像聊天工具

UI 的主体验应该是：

1. 看状态
2. 看风险
3. 看动作
4. 看审批
5. 看结果

聊天能力可以作为局部交互出现，不能成为主界面中心。

### 2. 像业务系统，不像原型拼盘

每个页面都应该让用户觉得：

1. 这个系统知道我在做什么
2. 这些对象彼此有关联
3. 系统在持续记住和推进事情
4. 行为结果会真实反映在别处

### 3. 像产品，不像 demo

所有空状态、错误状态、加载状态、成功反馈都要认真设计。
任何页面都不能只是“摆给人看”。

---

## 六、功能优先级原则

### P0 功能

必须优先保证：

1. 今日工作台
2. 机会面板
3. 会议详情页
4. 审批中心
5. 联系人详情页
6. 公司详情页
7. 收件箱线程页
8. 策略与权限控制
9. 审计日志
10. 工作域记忆

### P1 功能

在 P0 稳定后再做：

1. 批量操作
2. 通知中心
3. 命令面板
4. 细化筛选
5. 团队协作增强
6. 更丰富的统计与概览

### P2 功能

在商业验证后再考虑：

1. 真实第三方集成
2. 真实 LLM 接入
3. 更复杂策略引擎
4. 预算金库增强
5. 多代理协作
6. 企业级管理员后台

---

## 七、评估一个新需求时必须问的问题

任何新功能、新页面、新想法进入规划前，都先问：

1. 它能帮助用户推进什么经营动作？
2. 它服务的是哪一类高价值用户？
3. 它会增强记忆、行动、权限、审计中的哪一层？
4. 它会不会分散首期产品焦点？
5. 它是否能在 3 个月内带来更好的 demo、试点或付费？
6. 如果不做它，首期价值是否会受损？

只要其中 3 个问题答不清，这个需求就不应优先。

---

## 八、成功标准

产品首期成功，不看总功能数，主要看：

1. 用户是否更少漏掉机会
2. 用户是否更快完成会后推进
3. 用户是否开始信任 AI 建议
4. 用户是否愿意批准部分低风险动作
5. 用户是否愿意持续打开这个系统工作
6. 客户是否愿意为这套能力付费

---

## 九、长期演化方向

长期来看，产品会从以下路径演化：

第一阶段：
工作域记忆 + 行动建议 + 审批中心

第二阶段：
规则化授权 + 自动执行 + 预算控制

第三阶段：
多代理协作 + 更强组织工作流

第四阶段：
信誉、归因、代理交易与更大控制层

但首期所有判断都要围绕第一阶段展开。

---

## 十、最后一条原则

每次迭代，都要回答一句话：

这次改动，是否让用户第一次真正感觉到，
“一个可控的行动代理，真的能帮我推进工作”？

如果答案不明显，这次改动的价值就不够高。
