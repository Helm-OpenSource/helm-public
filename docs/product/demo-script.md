---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 标准演示脚本

## 文档目的

本文件定义“经营推进控制台”的标准演示脚本。

作用有三点：

1. 确保任何人都能按统一路径演示产品
2. 确保演示过程突出真正价值
3. 确保研发每次迭代都不会破坏演示主线

请始终围绕“经营动作、会后推进、审批、审计、长期记忆”来讲。
当前首页推荐的 demo 观看顺序是：销售转化模式优先，创始人 / COO 模式第二，猎头模式第三。

---

## 一、演示总原则

演示时要让客户快速感受到四件事：

1. 系统知道今天什么最重要
2. 系统知道会议后应该做什么
3. 系统能在规则内代做部分事情
4. 系统做过的事情可追踪、可解释

演示不要讲太多抽象愿景。
优先讲：
1. 今天这件事会不会漏掉
2. 这场会之后怎么推进
3. 哪一步能交给 AI
4. 我怎么放心让它做

---

## 二、演示准备

### Demo 账号

建议默认准备 3 个账号：

1. `founder@demo.com`
   - 工作区：`创始人经营工作台 Demo`
   - 适合讲：跨销售、合作、内部冲突、审批和策略边界
2. `saleslead@demo.com`
   - 工作区：`中国企业软件销售转化 Demo`
   - 适合讲：中国 B2B 软件大客户试点、会后推进、关系判断、掉单风险和 HubSpot 导入价值
3. `recruiter@demo.com`
   - 工作区：`猎头顾问交付工作台 Demo`
   - 适合讲：职位推进、候选人体验、面试安排、Salesforce activity intelligence

### 演示前检查

演示前必须确认：

1. 首页有清晰的今日重点
2. 会议页有真实 briefing 和会后 action items
3. 审批中心有至少 3 条待审批动作
4. 机会面板有至少 1 个高风险机会
5. 联系人页和公司页有完整时间线
6. 审计日志可查看
7. 策略修改会影响动作逻辑
8. 三个 demo 账号各自进入自己的专属工作区，不需要切 workspace
9. 销售和招聘两套工作区都能讲“CRM 不替换，只把已有信号转成下一步动作”

---

## 三、标准开场话术

推荐开场只讲一句：

“这不是一个聊天机器人，它是一个经营推进控制台，帮你把会议、邮件和客户推进变成下一步动作，而且所有 AI 动作都在授权规则内。”

然后立刻进入首页，不要先讲系统架构。

---

## 四、演示路径 A：创始人 / COO 场景

### 目标

让客户看到：
1. 系统知道今天该做什么
2. 系统能把会议自动变成动作
3. AI 动作有审批和审计
4. 策略会影响行为

### 演示步骤

#### 第 1 步：进入今日工作台
讲点：
1. 今天最重要的 3 件事
2. 哪些机会有风险
3. 哪些动作在等我审批
4. 今天的会议怎么影响经营结果
5. Helm 已经先看到了什么变化、先准备了什么、现在具体要 founder 拍板什么

重点指给客户看：
- 经营概览条
- 今日重点
- 高风险提醒
- 待审批动作
- 首页 founder 决策请求
- evidence drawer 和动作出口
- NarrativeHeader / ReviewSnapshotBlock / WhyItMattersBlock

#### 第 2 步：打开一场关键会议
讲点：
1. 会前 briefing 已经准备好
2. 系统知道参会人、历史互动和本次目标
3. 这是经营记忆积累的入口

重点指给客户看：
- 与会人
- 历史关系摘要
- 本次会议目标
- 风险提醒

#### 第 3 步：切到会后行动
讲点：
1. 会议结束后，系统自动生成 action items
2. 每个动作都有负责人、截止时间和执行方式
3. 这里就是把“会开完就散了”变成“会后自动推进”

重点指给客户看：
- action items 列表
- 需审批动作
- 可自动执行动作

#### 第 4 步：发起审批
讲点：
1. 系统不会擅自替你对外承诺
2. 高风险动作默认需要你批准
3. 你可以编辑后批准，也可以拒绝
4. 当前审批页已经不是静态队列，而是 worker draft -> review request 的主动协作面

重点指给客户看：
- 审批详情
- AI 建议依据
- 风险等级
- 编辑后批准入口

#### 第 5 步：批准动作
讲点：
1. 审批通过后，系统会更新机会状态
2. 同时留下审计记录
3. 这样用户才敢逐步放权给 AI

重点指给客户看：
- 批准成功反馈
- 机会状态变化
- 审计日志新增记录

#### 第 6 步：修改策略
讲点：
1. 权限和动作规则可以配
2. 系统行为会随着策略变化而变化
3. 这就是“可控代理”的核心

重点指给客户看：
- 外发消息默认需审批
- 内部纪要自动发送
- 政策修改后的行为差异

### 这一条路径的结尾总结

一句话收尾：

“你看到的不是 AI 给建议，而是一套能在你的规则内持续推进工作的经营控制台。”

---

## 六、Decision-first 页面模板基线

当前 Narrative Components Baseline Freeze 默认把首页、机会页、审批页作为可复用模板页。

演示和 training 时统一按这组组件来讲：

- `NarrativeHeader`
- `ReviewSnapshotBlock`
- `WhyItMattersBlock`
- `DecisionRequestCard / CollaborationRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

默认讲法：

1. 先讲 Helm 当前判断
2. 再讲为什么现在值得处理
3. 再讲 Helm 已推进了什么
4. 再讲现在需要主人做什么
5. 最后讲证据和 drill-down 在哪里

边界：

- 当前这是 `Decision-first 页面模板基线`，不是完整全站 design system
- 当前主要服务首页、opportunities、approvals 三页
- 扩到 proposal / package / contacts / companies / meetings / inbox 是下一阶段继续推进的工作

对应 freeze 报告入口：

- `NARRATIVE_COMPONENTS_BASELINE_FREEZE_REPORT.md`
- `INFORMATION_HIERARCHY_BASELINE_FREEZE_REPORT.md`
- `REPRESENTATIVE_PAGES_BASELINE_FREEZE_REPORT.md`

---

## 五、演示路径 B：销售团队场景

### 目标

让客户看到：
1. 机会不会漏
2. 跟进更有纪律
3. 联系人和会议沉淀成经营记忆
4. 销售动作可被 AI 协助

### 演示步骤

建议主对象：
1. 机会：`华东智造经营推进试点`
2. 联系人：`赵敏`
3. 会议：`华东智造采购推进同步会`
4. 导入入口：`/imports/crm`

#### 第 1 步：进入机会面板
讲点：
1. 机会按阶段组织
2. 哪个机会在升温，哪个在降温，一眼能看出来
3. 这比“靠记忆跟进”更稳定
4. Helm 会先把进入 proposal / package shaping 窗口的事项主动抬出来，不让销售自己先翻列表

重点指给客户看：
- 看板列
- 高风险机会
- 逾期未推进机会
- 下一步动作
- sales / delivery 协作窗口

#### 第 1.5 步：打开 Proposal / Package Decision-first Pages
也就是当前这轮已经 decision-first 化的 proposal / package 详情页。
讲点：
1. 这两页不再像对象详情页，而是 Helm judgement-first 汇报页
2. proposal 页会先说明当前是否仍停留在 internal review、是否仍处于 non-commitment
3. package 页会先说明当前是否已经适合进入 sales / delivery review、是否已经 customer-safe
4. boundary 和 evidence 会被分层处理，不再把客户安全、依赖和审计痕迹打平

重点指给客户看：
- `Current Judgement`
- `Why it matters`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`
- proposal / package 的动作出口

对应这一轮模板报告入口：

- `PROPOSAL_PACKAGE_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md`

#### 第 1.6 步：打开 Customer-facing Offer / External Proposal Decision-first Pages
也就是当前这轮已经 decision-first 化的 customer-facing offer / external proposal 详情页。
讲点：
1. 这两页不再像模板展示页，而是 Helm judgement-first 的外部表达汇报页
2. customer-facing offer 页会先说明当前到底是 safe-to-send、safe-with-boundary、discussion-only、review-before-send，还是 not-safe-to-send
3. external proposal 页会先说明当前是否仍需 review-before-send、哪些内容还不能被当成 commitment
4. customer-facing wording、internal-only wording 和 non-commitment wording 会被分层处理，不再让销售自己拼判断

重点指给客户看：
- `Current Judgement`
- sendability judgement
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`
- customer-facing offer / external proposal 的动作出口

对应这一轮模板报告入口：

- `CUSTOMER_FACING_OFFER_EXTERNAL_PROPOSAL_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md`

#### 第 1.7 步：打开 Commitment Reinforcement / Sendability Decision-first Pages
也就是当前这轮已经 decision-first 化的 commitment reinforcement / sendability 详情页。
讲点：
1. 这两页不再只是边界提示或 review hint，而是 Helm judgement-first 的 strengthening 汇报页
2. reinforcement 页会先说明当前到底是 no-reinforcement、boundary-only-reinforcement、customer-visible-reinforcement、reinforcement-after-review，还是 reinforcement-blocked
3. sendability 页会先说明当前到底是 safe-to-send、safe-with-boundary、discussion-only、review-before-send，还是 not-safe-to-send
4. 页面会明确区分 recommendation、reinforcement、commitment、non-commitment wording，不让销售自己拼装风险判断

重点指给客户看：
- `Current Judgement`
- reinforcement strength
- sendability gate
- `BoundaryNote`
- `EvidenceDrawer`
- reinforcement / sendability 的动作出口

对应这一轮模板报告入口：

- `COMMITMENT_REINFORCEMENT_SENDABILITY_DECISION_FIRST_PAGES_SPRINT_1_REPORT.md`

#### 第 1.8 步：打开 Customer-facing Package Variants / Commitment Reinforcement Variants
也就是当前这轮已经 decision-first 化的 variants 详情页。
讲点：
1. 这两页不再只是附属说明页，而是 Helm judgement-first 的 variants 汇报页
2. package variants 页会先说明当前更适合 exploratory-discussion、pilot-expansion、customer-visible-light、internal-prep-only 还是 review-before-send
3. reinforcement variants 页会先说明当前强化层级为什么停在 recommendation-only、customer-visible-light、review-before-send 或 non-commitment fallback
4. 页面会把 customer-visible、internal-only、boundary-only、review-before-send 和 non-commitment fallback 分层收口，不让销售自己拼语义

重点指给客户看：
- `Current Judgement`
- variant intent / stage / audience
- strengthening level / fallback cue
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `CUSTOMER_FACING_PACKAGE_VARIANTS_COMMITMENT_REINFORCEMENT_VARIANTS_SPRINT_1_REPORT.md`

当前 freeze 讲法：

- 当前已经进入 `variants detail baseline freeze`
- 这两页现在是 founder demo、training、acceptance、delivery 可以直接复用的 variants judgement 模板
- 但它仍然只是第一轮 variants detail baseline，不是完整 package engine、offer platform 或 strengthening orchestration 平台

对应 freeze 报告入口：

- `CUSTOMER_FACING_PACKAGE_VARIANTS_COMMITMENT_REINFORCEMENT_VARIANTS_BASELINE_FREEZE_REPORT.md`

#### 第 1.9 步：演示 Unified Detail Navigation / Cross-detail Handoff
也就是当前 proposal / package / offer / external proposal / reinforcement / variants 已经不再是孤立 detail 页，而是开始形成一条连续经营推进链。
讲点：
1. 当前 detail 页之间的切换不再只是链接，而是带 handoff reason 的切换
2. 页面会先说明上一段是什么、下一段是什么、为什么现在要切过去
3. handoff 会同时带 boundary、next action、worker cue 和 evidence cue
4. 这仍是第一轮 cross-detail handoff，不是 workflow engine 或 process platform

重点指给客户看：
- `Current node`
- `Previous detail / Next detail`
- `Cross-detail handoff`
- handoff reason / boundary / next action
- evidence drawer 仍然保持在附注层

对应这一轮模板报告入口：

- `UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_SPRINT_1_REPORT.md`

当前 freeze 讲法：

- 当前已经进入 `Unified Detail Navigation / Cross-detail Handoff Baseline Freeze`
- proposal / package / offer / external proposal / reinforcement / variants 现在可以被讲成一条连续 detail 经营链
- 这条链已经可用于 founder demo、training、acceptance、delivery 复用
- 但它仍然只是第一轮局部落地，不是 graph navigation platform、workflow engine 或 orchestration 平台

对应 freeze 报告入口：

- `UNIFIED_DETAIL_NAVIGATION_CROSS_DETAIL_HANDOFF_BASELINE_FREEZE_REPORT.md`

#### 第 1.10 步：打开 Package Stage Variants / Commercial Narrative Strengthening
也就是当前商业推进链里更细颗粒度的 stage / strengthening judgement 页。
讲点：
1. package stage variants 页会先说明当前 package 应停在 exploratory、pilot-ready、pilot-expansion、review-before-send 还是 customer-visible
2. commercial narrative strengthening 页会先说明当前叙事应停在 recommendation-only、exploratory-strengthening、pilot-strengthening、customer-visible 还是 non-commitment fallback
3. 两页都会继续把 boundary、sendability、fallback 和 decision request 放在主叙事里，而不是藏进附属 note
4. 这仍是第一轮 stage / strengthening detail template，不是完整 package engine、commercial engine 或 contract engine

重点指给客户看：
- `Current Judgement`
- stage mode / strengthening level
- sendability / fallback / boundary
- `WorkerSummary`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `PACKAGE_STAGE_VARIANTS_COMMERCIAL_NARRATIVE_STRENGTHENING_SPRINT_1_REPORT.md`

当前 freeze 讲法：

- 当前已经进入 `Package Stage Variants / Commercial Narrative Strengthening Baseline Freeze`
- stage / strengthening 两页已经可作为 founder demo、training、acceptance、delivery 的复用模板
- 但它仍然只是第一轮局部 detail baseline，不是完整 package engine、commercial engine 或 contract engine

对应 freeze 报告入口：

- `PACKAGE_STAGE_VARIANTS_COMMERCIAL_NARRATIVE_STRENGTHENING_BASELINE_FREEZE_REPORT.md`

#### 第 1.11 步：打开 Conversation / External Narrative Detail Chain
也就是把 founder / sales / delivery 对外沟通链真正接进现有商业推进 detail chain。
讲点：
1. conversation detail 页会先说明当前建议怎么说、适合哪个场景、由谁接话
2. external narrative detail 页会先说明当前 narrative 应停在哪一层，以及为什么还不能继续说强
3. 两页都会继续把 boundary、prerequisite、dependency、non-commitment 和 review-before-send 放在主叙事里
4. 这仍是第一轮 conversation / external narrative detail template，不是完整 messaging platform、sales enablement 平台或 commercial conversation engine

重点指给客户看：
- `Current Judgement`
- conversation scene / narrative level
- audience / sendability / fallback / boundary
- `Cross-detail handoff`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_SPRINT_1_REPORT.md`

当前 freeze 讲法：

- 当前已经进入 `Conversation / External Narrative Detail Chain Baseline Freeze`
- conversation detail 和 external narrative detail 现在已经可作为 founder demo、training、acceptance、delivery 的复用模板
- 关键 handoff 已经可以沿同一套 scene / level / boundary / evidence 讲法复用
- 但它仍然只是第一轮局部 detail chain baseline，不是完整 messaging platform、sales enablement 平台或 commercial conversation engine

对应 freeze 报告入口：

- `CONVERSATION_EXTERNAL_NARRATIVE_DETAIL_CHAIN_BASELINE_FREEZE_REPORT.md`

#### 第 1.12 步：打开 Founder / Sales / Delivery Conversation Variants
也就是把同一条 conversation 真正拆到 founder / sales / delivery 三类角色里。
讲点：
1. founder conversation 页会先说明 founder 现在最该怎么说，以及为什么当前更适合 founder demo、next-phase framing、Q&A 或 boundary clarification
2. sales conversation 页会先说明 sales 现在最该怎么跟进，以及为什么当前更适合 first-contact、post-demo follow-up、objection handling 或 proposal walkthrough
3. delivery conversation 页会先说明 delivery 现在最该怎么解释，以及为什么当前更适合 walkthrough、activation confirmation、pilot review、proposal review 或 risk clarification
4. 三页都会继续把 boundary、prerequisite、dependency、non-commitment 和 review-before-send 放在主叙事里
5. 这仍是第一轮 founder / sales / delivery role-based conversation template，不是完整 messaging platform、sales enablement / delivery enablement 平台或 commercial conversation engine

重点指给客户看：
- `Current Judgement`
- founder / sales / delivery scene
- audience / sendability / boundary / non-commitment
- `Cross-detail handoff`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `FOUNDER_SALES_DELIVERY_CONVERSATION_VARIANTS_SPRINT_1_REPORT.md`

#### 第 1.13 步：打开 Founder Q&A Variants
也就是把 founder conversation 再继续细化成 founder 高价值问答页面。
讲点：
1. founder Q&A 页会先说明 founder 当前最该怎么回答，以及为什么现在更适合 strategic question、customer value question、why-now question、scope question 或 next-step question
2. 它会明确告诉你当前回答是 customer-visible、safe-with-boundary、review-before-send 还是 internal-only
3. 它会继续把 boundary、prerequisite、dependency、non-commitment fallback 和 review mode 放在主叙事里
4. 它已经通过 handoff 接入 proposal、reinforcement、founder conversation 和 external narrative 链
5. 这仍是第一轮 Founder Q&A Variants，不是完整 founder enablement 平台或 commercial conversation engine

重点指给客户看：
- `Current Judgement`
- founder Q&A scene
- sendability / fallback / review mode
- `Cross-detail handoff`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `FOUNDER_QA_VARIANTS_PAGES_REPORT.md`

#### 第 1.14 步：打开 Sales Objection / Follow-up Variants
也就是把 sales conversation 再继续细化成 objection reply 和 follow-up 两条更值钱的 detail 页。
讲点：
1. sales follow-up 页会先说明当前最适合 post-first-contact follow-up、post-demo follow-up 还是 proposal clarification
2. sales objection 页会先说明当前最适合 objection reply、boundary clarification、prerequisite clarification、dependency clarification 还是 non-commitment clarification
3. 两页都会继续把 sendability、fallback、review-before-send 和 non-commitment 放在主叙事里
4. 两页都已经通过 handoff 接进 package / offer / proposal / conversation / external narrative 链
5. 这仍是第一轮 Sales Objection / Follow-up Variants，不是完整 sales enablement 平台、CRM 平台或 commercial conversation engine

重点指给客户看：
- `Current Judgement`
- objection / follow-up scene
- sendability / fallback / review mode
- `Cross-detail handoff`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `SALES_OBJECTION_FOLLOWUP_VARIANTS_PAGES_REPORT.md`

#### 第 1.15 步：打开 Delivery Walkthrough / Review Variants
也就是把 delivery conversation 再继续细化成 walkthrough 和 review 两条更值钱的 detail 页。
讲点：
1. walkthrough 页会先说明当前更适合 onboarding walkthrough、activation confirmation、next-step discussion 还是 package clarification
2. review 页会先说明当前更适合 pilot review、proposal review、risk clarification、boundary clarification 还是 review-before-send
3. 两页都会继续把 sendability、fallback、review mode 和 non-commitment 放在主叙事里
4. 两页都已经通过 handoff 接进 package / proposal / package stage / delivery conversation / sendability 链
5. 这仍是第一轮 Delivery Walkthrough / Review Variants，不是完整 delivery enablement 平台、ops 平台或 commercial conversation engine

重点指给客户看：
- `Current Judgement`
- walkthrough / review scene
- sendability / fallback / review mode
- `Cross-detail handoff`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `DELIVERY_WALKTHROUGH_REVIEW_VARIANTS_PAGES_REPORT.md`

#### 第 1.16 步：打开 External Narrative Fallback Variants
也就是把 external narrative 里最关键的 fallback line 单独拎出来，收成一页专门处理 non-commitment、boundary-only、review-before-send 和 blocked narrative 回退的 detail 页。
讲点：
1. 这页会先说明当前更适合 non-commitment fallback、boundary-only fallback、review-before-send fallback、exploratory-only narrative 还是 blocked narrative
2. 它会继续明确当前 fallback 是否还能 customer-visible、是否只能 internal-only、是否仍必须 review-before-send
3. 这页已经通过 handoff 接进 external narrative、reinforcement、sendability 和 conversation 链
4. evidence 继续被压在附注层，主叙事仍先说 judgement、boundary、next action
5. 这仍是第一轮 External Narrative Fallback Variants，不是完整 messaging platform、sales enablement 平台或 commercial conversation engine

重点指给客户看：
- `Current Judgement`
- fallback mode / sendability / review mode
- `Cross-detail handoff`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `EXTERNAL_NARRATIVE_FALLBACK_VARIANTS_PAGES_REPORT.md`

#### 第 1.17 步：打开 Conversation Detail Chain Extension
也就是把 `contacts / companies / meetings` 从对象详情页继续接进 unified conversation chain。
讲点：
1. `company detail` 首屏会先说明当前它在沟通链里承担的是 account routing，而不是静态公司资料
2. `contact detail` 首屏会先说明当前这段关系更适合切进 sales follow-up、meeting follow-through 还是继续 internal-only
3. `meeting detail` 首屏会先说明当前这场会议应该交给 delivery review、delivery walkthrough 还是继续停在内部准备态
4. 这 3 类页都会继续把 handoff reason、boundary、next action 和 evidence 放在统一结构里
5. 这仍是第一轮 Conversation Detail Chain Extension，不是完整 CRM、communications graph 或 workflow engine

重点指给客户看：
- `Current Judgement`
- `Why it matters`
- `Cross-detail handoff`
- `BoundaryNote`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `CONVERSATION_DETAIL_CHAIN_EXTENSION_REPORT.md`

#### 第 1.18 步：打开 Inbox / Follow-up / Review Request Detail Chain
也就是把 `inbox / follow-up / review request` 从消息壳层、草稿壳层和审批壳层继续接进 unified conversation chain。
讲点：
1. `inbox detail` 首屏会先说明当前这条 thread 更适合继续 customer-visible 跟进、停在 internal-only，还是先切到 follow-up / review request
2. `follow-up detail` 首屏会先说明当前这条跟进更适合停在 draft、ready-to-review 还是 review-before-send，而不是直接把草稿字段摊平
3. `review request detail` 首屏会先说明当前 review 为什么 pending、escalated 或 blocked，以及现在该由 founder / sales / delivery / customer success 谁接手
4. 这 3 类页都会把 handoff reason、boundary、next action、worker summary 和 evidence 放进统一结构
5. 这仍是第一轮 Inbox / Follow-up / Review Request Detail Chain，不是完整 inbox / messaging platform、email client、review workflow engine 或 notifications center

重点指给客户看：
- `Current Judgement`
- scene / sendability / review mode
- `Cross-detail handoff`
- `BoundaryNote`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `INBOX_FOLLOWUP_REVIEW_REQUEST_PAGES_REPORT.md`

#### 第 1.19 步：打开 Customer Success Handoff Surface
也就是把 `customer success` 从隐式 company proxy 收成 dedicated judgement-first 接手面。
讲点：
1. `/customer-success` 现在先给一层 derived `success queue / success inbox`，但它只是一层 visibility / triage / routing cue layer，不是 system of record、workflow queue 或 permissions surface
2. queue 页会先说明哪条是普通 follow-through、哪条是 `issue-follow-through`、哪条是 `escalation-follow-through`
3. 这里的 `issue-follow-through` 指真实 follow-through 问题已经出现，但修复路径仍停在正常当前轮协调里；`escalation-follow-through` 指当前已经被 dependency、boundary、缺失 decision、widened ownership pressure 或更高 risk 实质阻塞
4. `customer success handoff` 首屏会先说明为什么现在由 customer success 接手，并把 `judgement / reason / why it matters / action summary / decision request / boundary / evidence summary / next action / risk / non-commitment` 放在前台
5. detail 页里的 `decision posture` 与 `decision request` 会分开讲：前者说明当前这条链应停在哪一层，后者说明现在需要谁显式拍板
6. `success check` 首屏会先说明当前账户更适合继续 success follow-through、activation follow-through，还是先退回 boundary / review；`expansion review` 会先说明当前是否真的已经值得扩大叙事
7. `review request -> customer success -> success check -> expansion review` 现在已经是显式链路，不再靠 proxy 补位
8. recommendation、handoff、success follow-through、success check、expansion review 都不等于 commitment；`review-before-send` 也不是 safe-to-send by default
9. 当前这组页面已经进入 `Customer Success Handoff Surface Baseline Freeze`，并补了 `Customer Success Handoff Source Of Truth v1.1`

重点指给客户看：
- `Current Judgement`
- `Current Reason`
- `Evidence summary`
- `Decision posture`
- `Decision request`
- `Why it matters`
- `Cross-detail handoff`
- `BoundaryNote`
- `ActionRail`
- `EvidenceDrawer`

对应这一轮模板报告入口：

- `CUSTOMER_SUCCESS_HANDOFF_PAGE_REPORT.md`
- `CUSTOMER_SUCCESS_HANDOFF_SURFACE_BASELINE_FREEZE_REPORT.md`
- `CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md`
- `CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md`

#### 第 2 步：拖动一个机会
讲点：
1. 机会状态变化会立即写回系统
2. 不是只改展示，而是整个工作台都知道它变了

重点指给客户看：
- 拖拽反馈
- 状态变化 toast
- 机会详情变化

#### 第 3 步：进入联系人详情页
讲点：
1. 系统沉淀了这个联系人最近的所有互动
2. 它知道当前关系温度、当前阶段和推荐下一步
3. 它还能明确告诉你：为什么这条跟进更适合这个人

重点指给客户看：
- 最近互动
- 关系温度
- 时间线
- AI 建议

#### 第 4 步：打开 CRM 导入结果页
讲点：
1. HubSpot 仍然是 record system
2. Helm 只接对象层、关系层和 notes / associations
3. 导入后的 warmup 已经自动生成 today focus、blocker、commitment 和 recommendation

重点指给客户看：
- 导入结果
- 冲突处理
- 对象绑定
- warmup 价值摘要

#### 第 5 步：生成跟进草稿
讲点：
1. 跟进邮件和消息可以由 AI 起草
2. 高风险动作先送审
3. 你不用从零写，但你始终掌握最后控制权

重点指给客户看：
- 生成的草稿
- 送审入口
- 审批状态

#### 第 6 步：进入审批中心批准
讲点：
1. 所有外发动作集中审批
2. 销售负责人或创始人可统一把控风险

重点指给客户看：
- 待审批列表
- 风险等级
- 编辑后批准
- 批准后的联动变化

#### 第 7 步：回到联系人页和机会页
讲点：
1. 行动被记录
2. 时间线更新
3. 机会继续推进
4. 形成真正的经营闭环

### 这一条路径的结尾总结

一句话收尾：

“销售最怕的不是不会说，而是漏跟进。这个系统的价值，就是让推进变成系统能力。”

---

## 六、演示路径 C：招聘团队场景

### 目标

让客户看到：
1. 职位推进和候选人推进都能结构化
2. 面试和沟通会自然沉淀
3. follow-up 不再靠个人记忆

### 演示步骤

建议主对象：
1. 职位：`Helio VP Marketing Search`
2. 候选人：`Maya Patel`
3. 会议：`Helio shortlist 评估会`
4. 审批动作：`安排 Maya Patel 终面`

#### 第 1 步：进入招聘机会
讲点：
1. 一个职位就是一个推进对象
2. 候选人、面试、反馈、下一步都能挂在同一个机会下

#### 第 2 步：进入候选人联系人页
讲点：
1. 候选人的互动记录和时间线是完整的
2. 当前阶段和下一步建议一眼能看懂
3. 当前 blocker、承诺和候选人体验风险都能结构化呈现

#### 第 3 步：进入面试会议详情页
讲点：
1. 面试前 briefing
2. 面试后 action items
3. follow-up 可以自动形成草稿和安排建议
4. Salesforce event / task 已经被转成 Helm 的 meeting / timeline / recommendation 输入

#### 第 4 步：生成后续安排动作
讲点：
1. 安排后续面试
2. 给候选人发确认
3. 给客户同步反馈
4. 哪些动作需审批，哪些可自动做

#### 第 5 步：审批后查看时间线
讲点：
1. 所有变化有痕迹
2. 顾问不再靠自己记忆维持所有推进
3. 客户最能感知的是“交付节奏被接住了”，不是又多了一个记录系统

### 这一条路径的结尾总结

一句话收尾：

“招聘的关键不是记录，而是持续推进。这个系统把推进本身产品化了。”

---

## 七、演示中的常见问题回答模板

### Q1：这和 CRM 有什么区别？

建议回答：

“CRM 主要解决记录问题。这里更强调下一步动作、会后推进、审批和审计。它会主动帮助你推进事情。”

### Q2：这和 AI 助手有什么区别？

建议回答：

“普通 AI 助手主要回答问题。这里更像经营控制台，它会基于工作上下文提出动作，并在规则内执行。”

### Q3：为什么要做审批？

建议回答：

“因为只要 AI 开始真正做事，信任就变成核心问题。审批和审计是让用户敢逐步放权的前提。”

### Q4：为什么先不做支付或更多自动化？

建议回答：

“首期先把高频经营动作跑通，把记忆、建议、审批、审计做好，后续再向更复杂动作扩展，路径更稳。”

---

## 八、演示中不要做的事

1. 不要一开始讲太多宏大愿景
2. 不要先展示不关键的设置页
3. 不要过度强调模型能力
4. 不要让客户花太长时间看列表
5. 不要展示空页面
6. 不要把演示做成点来点去没有主线
7. 不要让 demo 依赖过多手工解释

---

## 九、推荐演示时长

### 5 分钟版本
只走创始人路径 A 的核心步骤。

### 10 分钟版本
走创始人路径 A + 销售路径 B。

### 15 分钟版本
走 A + B + C，并补策略变化与审计日志。

---

## 十、演示成功的判断标准

一次成功的 demo，客户应该在结束时清楚三件事：

1. 这个系统能帮我推进事情
2. 这个系统不是黑盒，它可控
3. 这个系统有机会变成团队每天都会打开的工作台

如果客户只是觉得“AI 很聪明”，这个 demo 还不够成功。
如果客户开始问“这个能不能接到我们的真实流程里”，说明 demo 成功了。
