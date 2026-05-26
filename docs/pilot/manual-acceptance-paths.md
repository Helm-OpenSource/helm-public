---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 试点前人工验收路径

## 1. 记忆系统

### 路径 A：会议处理 -> 结构化记忆

- 页面：
  - [会议详情页](<../../app/(workspace)/meetings/[id]/page.tsx>)
  - [记忆页](<../../app/(workspace)/memory/page.tsx>)
- 相关服务：
  - [meeting-memory-pipeline.service.ts](../../lib/memory/meeting-memory-pipeline.service.ts)
  - [fact-extraction.service.ts](../../lib/memory/fact-extraction.service.ts)
  - [commitment-extraction.service.ts](../../lib/memory/commitment-extraction.service.ts)
  - [blocker-extraction.service.ts](../../lib/memory/blocker-extraction.service.ts)
- 验收对象：
  - `Acme 采购评估同步会`
- 操作：
  1. 打开会议详情页
  2. 处理会议记忆，或通过导入后进入该页
  3. 查看会议页和记忆页
- 预期结果：
  - 生成 `MemoryFact`
  - 生成 `Commitment`
  - 生成 `Blocker`
  - 页面上能按时间线看到这些结果，而不是只在分列表里分别查看

### 路径 B：联系人与机会读取结构化记忆

- 页面：
  - [联系人详情页](<../../app/(workspace)/contacts/[id]/page.tsx>)
  - [机会面板](<../../app/(workspace)/opportunities/page.tsx>)
- 验收对象：
  - `Vivian Chen`
  - `Acme 年度经营动作控制台试点`
- 预期结果：
  - 联系人页能看到关键记忆、未完成承诺、当前阻碍
  - 机会详情能看到 blocker、commitment、next-step facts

### 路径 C：修正记忆

- 页面：
  - [记忆页](<../../app/(workspace)/memory/page.tsx>)
- 相关服务：
  - [correction.service.ts](../../lib/memory/correction.service.ts)
- 操作：
  1. 修正或失效一条 fact
- 预期结果：
  - `MemoryCorrection` 入库
  - `AuditLog` 增加记录
  - 页面刷新后会在同一条时间线里看到修正结果，并可按“修正”分类筛选

---

## 2. Recommendation

### 首页

- 页面：
  - [今日工作台](<../../app/(workspace)/dashboard/page.tsx>)
- 观察点：
  - 页头与首屏是否先给 Helm judgement，而不是先给对象列表
  - 页面是否明确告诉用户“现在需要你做什么决定”
  - 首页是否能看到 today focus
  - recommendation 是否区分“首选动作 / 次优推进”
  - recommendation 是否说明为什么今天重要、当前 blocker、如果不处理的后果
  - recommendation 展开后是否能看到依据、支持性记忆和“不推进的后果”

### 联系人页

- 页面：
  - [联系人详情页](<../../app/(workspace)/contacts/[id]/page.tsx>)
- 验收对象：
  - `Mason Liu`
- 预期 recommendation：
  - 结构化跟进
  - 下一轮同步
  - 内部跟进提醒
- explanation 应包含：
  - 当前 blocker
  - 最近上下文
  - 策略边界
  - 为什么它比其他动作更适合当前关系状态

### 机会页

- 页面：
  - [机会面板](<../../app/(workspace)/opportunities/page.tsx>)
- 验收对象：
  - `Acme 年度经营动作控制台试点`
- 预期 recommendation：
  - 下一轮确认会
  - 会后 ROI 跟进
- explanation 应包含：
  - blocker：`Acme 付款节奏未明确`
  - commitment 未完成
  - supporting facts
  - `policyResult`
  - 为什么它是首选动作，而不是先做别的

### 审批中心

- 页面：
  - [审批中心](<../../app/(workspace)/approvals/page.tsx>)
- 预期：
  - 页面是否先把 trust boundary judgement 说清楚，再让用户进入审批列表
  - 待审批项直接展示 recommendation 结论
  - explanation 显示 blocker / commitment / policyResult / 批准后影响
  - recommendation 卡展开后能看到支持性记忆与不推进的后果

### 路径 G：Decision-first 代表页

- 页面：
  - [今日工作台](<../../app/(workspace)/dashboard/page.tsx>)
  - [机会面板](<../../app/(workspace)/opportunities/page.tsx>)
  - [审批中心](<../../app/(workspace)/approvals/page.tsx>)
- 操作：
  1. 打开页面，不做筛选
  2. 观察页面是否先给 `Current Judgement`
  3. 观察页面是否直接给 `What Helm already did / What needs your decision / Available next actions`
  4. 展开 evidence drawer
- 预期：
  - 页面不会先把用户扔进对象堆叠
  - 页面先给结论、再给理由、再给动作出口
  - 证据默认收在 drawer 里，而不是平铺成主界面噪音

### 路径 H：主动汇报 / 主动协作代表链路

- 页面：
  - [今日工作台](<../../app/(workspace)/dashboard/page.tsx>)
  - [机会面板](<../../app/(workspace)/opportunities/page.tsx>)
  - [审批中心](<../../app/(workspace)/approvals/page.tsx>)
- 操作：
  1. 打开首页，确认是否能先看到 founder 决策请求
  2. 打开机会页，确认是否能先看到 sales / delivery 协作窗口
  3. 打开审批中心，确认是否能先看到 worker draft 对应的 review request
  4. 在每一页展开 evidence drawer
- 预期：
  - Helm 会先告诉用户“看到了什么变化”
  - Helm 会先说明“已经准备了什么”
  - Helm 会先把 judgement、decision request、worker summary 和 evidence drawer 收成同一份主动汇报，而不是让用户自己先拼对象上下文
  - 页面会明确区分：
    - Helm 现在可以先做什么
    - Helm 当前只能建议什么
    - 哪些必须人工拍板
    - 哪些必须升级成人工主导
  - recommendation 不会被误写成 commitment
  - 高风险 customer-facing 动作不会绕过审批边界
  - 这三条链路已经足够作为 founder demo / training / acceptance 的主动机制基线

### 路径 I：Narrative Components Baseline Freeze

- 页面：
  - [今日工作台](<../../app/(workspace)/dashboard/page.tsx>)
  - [机会面板](<../../app/(workspace)/opportunities/page.tsx>)
  - [审批中心](<../../app/(workspace)/approvals/page.tsx>)
- 操作：
  1. 进入页面后先确认 `NarrativeHeader / WhyItMattersBlock / HelmDidBlock` 是否已经进入首屏
  2. 确认 `DecisionRequestCard / CollaborationRequestCard` 是否明确告诉用户现在需要谁做什么
  3. 确认 `ActionRail` 是否保持 1 个主动作、最多 2 个次动作
  4. 确认 `BoundaryNote` 默认可见，而 `EvidenceDrawer` 默认折叠
- 预期：
  - 当前三页已经形成 `Decision-first 页面模板基线`
  - 页面原文、training cue、acceptance cue 使用同一套 judgement / action / boundary / evidence 语义
  - 当前 Narrative Components Baseline Freeze 足够支持 founder demo、training 和 acceptance 复用
  - 仍然不是全站完成重构，也不是完整 design system 平台

### 路径 J：Proposal / Package Decision-first Pages

- 页面：
  - [Proposal 详情页](<../../app/(workspace)/proposals/[id]/page.tsx>)
  - [Package 详情页](<../../app/(workspace)/packages/[id]/page.tsx>)
  - [机会面板](<../../app/(workspace)/opportunities/page.tsx>)
- 操作：
  1. 从 opportunities 页进入一条进入 proposal / package shaping 窗口的机会
  2. 打开 proposal 页，确认首屏先给 `Current Judgement`
  3. 打开 package 页，确认首屏先给协作请求与边界说明
  4. 展开 evidence drawer，核对 replay / audit / memory / worker output / boundary trace / historical changes
- 预期：
  - 页面不会先平铺 proposal / package 对象字段
  - recommendation 不会被误讲成 commitment
  - internal-only cue 不会直接混进 customer-facing 视图
  - prerequisite / dependency / non-commitment 会进入首屏边界结构，而不是藏进证据层
  - 这两页已经足够作为后续 customer-facing offer / external proposal 扩展页的第一轮模板

### 路径 K：Customer-facing Offer / External Proposal Decision-first Pages

- 页面：
  - [Customer-facing Offer 详情页](<../../app/(workspace)/offers/[id]/page.tsx>)
  - [External Proposal 详情页](<../../app/(workspace)/external-proposals/[id]/page.tsx>)
  - [Proposal 详情页](<../../app/(workspace)/proposals/[id]/page.tsx>)
  - [Package 详情页](<../../app/(workspace)/packages/[id]/page.tsx>)
- 操作：
  1. 从 proposal / package 页进入 customer-facing offer / external proposal 页
  2. 打开 customer-facing offer 页，确认首屏先给 sendability judgement
  3. 打开 external proposal 页，确认首屏先给 review / sendability / collaboration request
  4. 展开 evidence drawer，核对 replay / audit / memory / worker output / boundary trace / sendability trace / historical changes
- 预期：
  - 页面不会先平铺模板字段
  - 页面会先说明当前是 safe-to-send、safe-with-boundary、discussion-only、review-before-send 还是 not-safe-to-send
  - internal-only wording 不会直接混进 customer-facing 语义
  - recommendation、discussion-only 和 boundary note 不会被误讲成 commitment
  - sendability note 和 non-commitment note 会保持前置，而不是被埋进 evidence 层

### 路径 D：记忆修正后 recommendation 刷新

- 页面：
  - [记忆页](<../../app/(workspace)/memory/page.tsx>)
  - [联系人详情页](<../../app/(workspace)/contacts/[id]/page.tsx>)
  - [机会面板](<../../app/(workspace)/opportunities/page.tsx>)
- 相关服务：
  - [correction.service.ts](../../lib/memory/correction.service.ts)
  - [features/memory/actions.ts](../../features/memory/actions.ts)
  - [recommendation.service.ts](../../lib/recommendations/recommendation.service.ts)
- 操作：
  1. 在记忆页修正或失效一条与联系人 / 机会强相关的 fact
  2. 回到对应联系人页或机会页
- 预期：
  - 对应对象页会重新生成 recommendation
  - supporting facts 与 explanation 会反映最新记忆状态
  - `/analytics` 后续能看到 recommendation 查看 / 展开依据 / 生成动作的质量信号

### 路径 O：Unified Detail Navigation / Cross-detail Handoff

- 页面：
  - [Proposal 详情页](<../../app/(workspace)/proposals/[id]/page.tsx>)
  - [Package 详情页](<../../app/(workspace)/packages/[id]/page.tsx>)
  - [Customer-facing Offer 详情页](<../../app/(workspace)/offers/[id]/page.tsx>)
  - [External Proposal 详情页](<../../app/(workspace)/external-proposals/[id]/page.tsx>)
  - [Commitment Reinforcement 详情页](<../../app/(workspace)/reinforcements/[id]/page.tsx>)
  - [Package Variants 详情页](<../../app/(workspace)/package-variants/[id]/page.tsx>)
  - [Reinforcement Variants 详情页](<../../app/(workspace)/reinforcement-variants/[id]/page.tsx>)
- 操作：
  1. 从 proposal 页进入 package 页，确认当前 node、上一段、下一段和 handoff reason 都可见
  2. 从 customer-facing offer 页进入 external proposal / reinforcement，确认 handoff boundary 和 next action 会跟着走
  3. 在 package variants / reinforcement variants 两页来回切换，确认 fallback / strengthening handoff 不只是普通链接
  4. 展开 evidence drawer，确认 evidence 仍然在附注层，不会打断 handoff 主叙事
- 预期：
  - detail 页之间切换不再重新丢失上下文
  - handoff 会明确说明为什么现在要切页、由谁接手、接下来做什么
  - 当前 boundary、sendability、strengthening level 会跟着 handoff 一起被说明
  - navigation 不会退回成对象目录
  - recommendation / discussion-only / boundary-only 不会被误讲成 commitment

### 路径 P：Unified Detail Navigation / Cross-detail Handoff Baseline Freeze

- 页面：
  - [Proposal 详情页](<../../app/(workspace)/proposals/[id]/page.tsx>)
  - [Package 详情页](<../../app/(workspace)/packages/[id]/page.tsx>)
  - [Customer-facing Offer 详情页](<../../app/(workspace)/offers/[id]/page.tsx>)
  - [External Proposal 详情页](<../../app/(workspace)/external-proposals/[id]/page.tsx>)
  - [Commitment Reinforcement 详情页](<../../app/(workspace)/reinforcements/[id]/page.tsx>)
  - [Package Variants 详情页](<../../app/(workspace)/package-variants/[id]/page.tsx>)
  - [Reinforcement Variants 详情页](<../../app/(workspace)/reinforcement-variants/[id]/page.tsx>)
- 操作：
  1. 依次走完 `proposal -> package -> customer-facing offer`
  2. 再走 `customer-facing offer -> external proposal -> reinforcement`
  3. 最后检查 `package variants <-> reinforcement variants`
  4. 在每条链路上确认 `Current node / handoff reason / handoff boundary / next action / evidence drawer`
- 预期：
  - 当前 3 条关键商业链路已经能复用同一套 handoff 讲法
  - README、docs index、self-check、boundary check 和 regression 都已经同步到 Baseline Freeze
  - founder demo、training、acceptance、delivery 可以沿用同一套 navigation / handoff / boundary / evidence 语义
  - 这仍然只是第一轮局部落地，不是 graph navigation platform、workflow engine 或 orchestration 平台

### 路径 E：Commitment / Blocker 生命周期

- 页面：
  - [记忆页](<../../app/(workspace)/memory/page.tsx>)
  - [会议详情页](<../../app/(workspace)/meetings/[id]/page.tsx>)
  - [联系人详情页](<../../app/(workspace)/contacts/[id]/page.tsx>)
- 相关服务：
  - [commitment.service.ts](../../lib/memory/commitment.service.ts)
  - [blocker.service.ts](../../lib/memory/blocker.service.ts)
  - [features/memory/actions.ts](../../features/memory/actions.ts)
- 操作：
  1. 在记忆页把一条 commitment 标记为“进行中 / 已完成 / 已取消”
  2. 在记忆页把一条 blocker 改为“观察中 / 已解决 / 重新打开 / 暂不处理”
  3. 回到关联会议页或联系人页
- 预期：
  - CommitmentCard / BlockerCard 会显示新的生命周期说明，而不只是状态标签
  - recommendation explanation 会根据 commitment / blocker 的新状态刷新
  - 会议页“会后 24 小时黄金推进窗口”会更明确说明当前最大推进压力
  - 联系人页“关系判断”会更明确说明是 blocker 还是承诺在拖住当前关系推进

### 路径 F：真实数据接入后的冷启动价值

- 页面：
  - [今日工作台](<../../app/(workspace)/dashboard/page.tsx>)
  - [收件箱线程页](<../../app/(workspace)/inbox/page.tsx>)
  - [数据导入页](<../../app/(workspace)/imports/page.tsx>)
  - [公司详情页](<../../app/(workspace)/companies/[id]/page.tsx>)
- 相关服务：
  - [data/queries.ts](../../data/queries.ts)
  - [lib/imports/index.ts](../../lib/imports/index.ts)
  - [lib/connectors/google.ts](../../lib/connectors/google.ts)
- 操作：
  1. 打开首页，确认“真实数据冷启动”区是否出现
  2. 打开收件箱，确认是否能看到真实 / 导入线程数量与待绑定线索数量
  3. 在导入页执行一次 CSV 导入，观察导入结果里的自动补建 / 绑定 / 会后动作 / 记忆处理结果
  4. 打开公司页，确认“账户势能判断”是否已经从静态资料页变成经营判断页
- 预期：
  - 首页能直接说明真实数据已经如何影响今天的排序
  - 收件箱能直接说明接入后的第一眼价值，而不只是展示线程
  - 导入结果能明确告诉试点用户“导入后最值得立刻去看的价值”
  - 公司页能明确显示账户当前是“推进受阻 / 兑现压力上升 / 升温窗口 / 待补齐 / 稳定观察中”中的哪一类

### 路径 L：Commitment Reinforcement / Sendability Decision-first Pages

- 页面：
  - [Commitment Reinforcement 详情页](<../../app/(workspace)/reinforcements/[id]/page.tsx>)
  - [Sendability 详情页](<../../app/(workspace)/sendability/[id]/page.tsx>)
- 相关服务：
  - [commitment-reinforcement-sendability-detail-contract.ts](../../lib/presentation/commitment-reinforcement-sendability-detail-contract.ts)
  - [detail-model.ts](../../features/commitment-reinforcement-sendability/detail-model.ts)
  - [detail-view.tsx](../../features/commitment-reinforcement-sendability/detail-view.tsx)
- 操作：
  1. 从 customer-facing offer 或 external proposal 页面打开 reinforcement / sendability 详情页
  2. 确认首屏先出现 current judgement，而不是对象字段和平铺状态
  3. 确认页面会明确说明当前 reinforcement strength、sendability、non-commitment、review-before-send 与 not-safe-to-send
  4. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / reinforcement trace 已被分组
- 预期：
  - reinforcement 页能先说明当前是 customer-visible-reinforcement、boundary-only-reinforcement、reinforcement-after-review 还是 reinforcement-blocked
  - sendability 页能先说明当前是 safe-to-send、safe-with-boundary、discussion-only、review-before-send 还是 not-safe-to-send
  - recommendation、discussion-only 和 boundary-only reinforcement 不会被误写成 commitment
  - 页面会明确告诉用户下一道 sendability gate 由谁接、什么时候必须回到 review

### 路径 M：Customer-facing Package Variants / Commitment Reinforcement Variants

- 页面：
  - [Customer-facing Package Variants 详情页](<../../app/(workspace)/package-variants/[id]/page.tsx>)
  - [Commitment Reinforcement Variants 详情页](<../../app/(workspace)/reinforcement-variants/[id]/page.tsx>)
- 相关服务：
  - [customer-facing-package-variants-contract.ts](../../lib/presentation/customer-facing-package-variants-contract.ts)
  - [commitment-reinforcement-variants-contract.ts](../../lib/presentation/commitment-reinforcement-variants-contract.ts)
  - [detail-model.ts](../../features/customer-facing-package-variants/detail-model.ts)
  - [detail-model.ts](../../features/commitment-reinforcement-variants/detail-model.ts)
- 操作：
  1. 从 package detail 页打开 package variants 详情页
  2. 从 reinforcement / sendability detail 页打开 reinforcement variants 详情页
  3. 确认首屏先出现 current judgement，而不是 variant 字段和平铺状态
  4. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / variant trace / reinforcement trace 已被分组
- 预期：
  - package variants 页会先说明当前更适合 exploratory-discussion、pilot-expansion、customer-visible-light、internal-prep-only、review-before-send 还是 blocked 变体
  - reinforcement variants 页会先说明当前强化层级停在 recommendation-only、customer-visible-light、review-before-send、non-commitment fallback 还是 blocked-strengthening
  - internal-only variant 不会混进 customer-facing cue
  - exploratory、discussion-only、boundary-only 和 non-commitment fallback 不会被误写成 commitment
  - 页面会明确告诉用户现在需要谁拍板、继续跟进或先补 prerequisite / dependency / risk mitigation

### 路径 N：Variants Detail Baseline Freeze

- 页面：
  - [Customer-facing Package Variants 详情页](<../../app/(workspace)/package-variants/[id]/page.tsx>)
  - [Commitment Reinforcement Variants 详情页](<../../app/(workspace)/reinforcement-variants/[id]/page.tsx>)
- 操作：
  1. 分别打开两个 variants detail 页
  2. 确认页面首屏先给 `Current Judgement / Why it matters / Helm did / Decision request`
  3. 确认 `BoundaryNote` 默认可见，`EvidenceDrawer` 默认折叠
  4. 确认页面原文、training 讲法、acceptance 讲法都还保持 recommendation、boundary、non-commitment 和 sendability 的同一口径
- 预期：
  - 当前两个 variants detail 页已经形成可冻结、可演示、可培训的基线
  - package variant 会继续把 intent / stage / audience / sendability 收在同一套 judgement-first 语义里
  - reinforcement variant 会继续把 strengthening、fallback、review-before-send 和 blocked 边界收在同一套 judgement-first 语义里
  - 当前仍然不是完整 package engine、offer platform、strengthening orchestration 或 contract engine

### 路径 P：Package Stage Variants / Commercial Narrative Strengthening

- 页面：
  - [Package Stage Variants 详情页](<../../app/(workspace)/package-stage-variants/[id]/page.tsx>)
  - [Commercial Narrative Strengthening 详情页](<../../app/(workspace)/commercial-strengthening/[id]/page.tsx>)
- 相关服务：
  - [package-stage-variants-contract.ts](../../lib/presentation/package-stage-variants-contract.ts)
  - [commercial-narrative-strengthening-contract.ts](../../lib/presentation/commercial-narrative-strengthening-contract.ts)
  - [detail-model.ts](../../features/package-stage-variants/detail-model.ts)
  - [detail-model.ts](../../features/commercial-narrative-strengthening/detail-model.ts)
- 操作：
  1. 从 package detail 或 package variants 页打开 package stage variants 详情页
  2. 从 reinforcement variants 页打开 commercial narrative strengthening 详情页
  3. 确认首屏先出现 current judgement，而不是 stage / strengthening 字段和平铺状态
  4. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / stage trace / strengthening trace / fallback trace 已被分组
- 预期：
  - package stage variants 页会先说明当前更适合 exploratory、pilot-ready、pilot-expansion、customer-visible-light、review-before-send、boundary-only 还是 blocked stage
  - commercial narrative strengthening 页会先说明当前强化层级停在 recommendation-only、exploratory-strengthening、pilot-strengthening、customer-visible-light、review-before-send、non-commitment fallback 还是 blocked-strengthening
  - exploratory、discussion-only、boundary-only 和 review-before-send 不会被误写成 commitment
  - internal-only strengthening 不会混进 customer-visible cue
  - 页面会明确告诉用户现在需要谁拍板、继续跟进或先补 prerequisite / dependency / risk mitigation

### 路径 Q：Package Stage Variants / Commercial Narrative Strengthening Baseline Freeze

- 页面：
  - [Package Stage Variants 详情页](<../../app/(workspace)/package-stage-variants/[id]/page.tsx>)
  - [Commercial Narrative Strengthening 详情页](<../../app/(workspace)/commercial-strengthening/[id]/page.tsx>)
- 操作：
  1. 分别打开两个 detail 页
  2. 确认页面首屏继续优先给 `Current Judgement / Why it matters / Helm did / Decision request`
  3. 确认 `BoundaryNote` 默认可见，`EvidenceDrawer` 默认折叠
  4. 确认页面原文、training 讲法、acceptance 讲法都继续保持 stage / strengthening / boundary / evidence 的同一口径
- 预期：
  - 当前两个 detail 页已经形成可冻结、可演示、可培训的基线
  - package stage 继续把 stage / intent / audience / sendability 收在同一套 judgement-first 语义里
  - strengthening 继续把 strengthening、fallback、review-before-send 和 blocked 边界收在同一套 judgement-first 语义里
  - 当前仍然不是完整 package engine、commercial engine、contract engine 或 legal review 平台

### 路径 R：Conversation / External Narrative Detail Chain

- 页面：
  - [Conversation 详情页](<../../app/(workspace)/conversations/[id]/page.tsx>)
  - [External Narrative 详情页](<../../app/(workspace)/external-narratives/[id]/page.tsx>)
- 相关服务：
  - [conversation-detail-contract.ts](../../lib/presentation/conversation-detail-contract.ts)
  - [external-narrative-detail-contract.ts](../../lib/presentation/external-narrative-detail-contract.ts)
  - [detail-model.ts](../../features/conversation-detail/detail-model.ts)
  - [detail-model.ts](../../features/external-narrative-detail/detail-model.ts)
- 操作：
  1. 从 package / offer 页打开 conversation detail
  2. 从 external proposal / reinforcement 页打开 external narrative detail
  3. 确认首屏先出现 current judgement，而不是散落 cue、script 和 pack 字段
  4. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / conversation trace / scenario trace / narrative trace / fallback trace 已被分组
- 预期：
  - conversation 页会先说明当前更适合 founder-meeting、founder-demo、sales-first-contact、sales-follow-up、proposal-walkthrough、boundary-clarification 还是 review-before-send
  - external narrative 页会先说明当前更适合 internal-framing、exploratory-narrative、proposal-supporting-narrative、strengthening-narrative、customer-visible-light、review-before-send 还是 non-commitment-fallback
  - package / offer 会明确 handoff 到 conversation，external proposal / reinforcement 会明确 handoff 到 external narrative
  - conversation 与 external narrative 会通过 current node / next step / boundary / evidence 形成连续 detail chain
  - exploratory、discussion-only、boundary-only 和 review-before-send 不会被误写成 commitment
  - internal-only wording 不会混进 customer-visible cue

### 路径 S：Conversation / External Narrative Detail Chain Baseline Freeze

- 页面：
  - [Conversation 详情页](<../../app/(workspace)/conversations/[id]/page.tsx>)
  - [External Narrative 详情页](<../../app/(workspace)/external-narratives/[id]/page.tsx>)
- 操作：
  1. 分别打开两个 detail 页
  2. 确认页面首屏继续优先给 `Current Judgement / Why it matters / Helm did / Decision request`
  3. 确认 `BoundaryNote` 默认可见，`EvidenceDrawer` 默认折叠
  4. 确认页面原文、training 讲法、acceptance 讲法都继续保持 scene / narrative level / boundary / evidence 的同一口径
- 预期：
  - 当前两个 detail 页已经形成可冻结、可演示、可培训的基线
  - conversation detail 会继续把 scene / intent / audience / sendability 收在同一套 judgement-first 语义里
  - external narrative detail 会继续把 narrative level、fallback、review-before-send 和 blocked 边界收在同一套 judgement-first 语义里
  - 当前仍然不是完整 messaging platform、sales enablement 平台、proposal generator 或 commercial conversation engine

### 路径 T：Founder / Sales / Delivery Conversation Variants

- 页面：
  - [Founder Conversation 详情页](<../../app/(workspace)/founder-conversations/[id]/page.tsx>)
  - [Sales Conversation 详情页](<../../app/(workspace)/sales-conversations/[id]/page.tsx>)
  - [Delivery Conversation 详情页](<../../app/(workspace)/delivery-conversations/[id]/page.tsx>)
- 相关服务：
  - [founder-conversation-variants-contract.ts](../../lib/presentation/founder-conversation-variants-contract.ts)
  - [sales-conversation-variants-contract.ts](../../lib/presentation/sales-conversation-variants-contract.ts)
  - [delivery-conversation-variants-contract.ts](../../lib/presentation/delivery-conversation-variants-contract.ts)
  - [detail-model.ts](../../features/founder-conversation-variants/detail-model.ts)
  - [detail-model.ts](../../features/sales-conversation-variants/detail-model.ts)
  - [detail-model.ts](../../features/delivery-conversation-variants/detail-model.ts)
- 操作：
  1. 分别打开 founder / sales / delivery 三个 detail 页
  2. 确认首屏先出现 current judgement，而不是散落 cue、pack、script 和 scenario 字段
  3. 确认 founder 页能接 proposal / reinforcement，sales 页能接 package / offer，delivery 页能接 package / package stage
  4. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / role scene trace 都已分组
- 预期：
  - founder 页会先说明当前更适合 founder-first-meeting、founder-demo、founder-next-phase-framing、founder-customer-q-and-a、founder-boundary-clarification 还是 founder-review-before-send
  - sales 页会先说明当前更适合 sales-first-contact、sales-post-demo-follow-up、sales-objection-handling、sales-proposal-walkthrough、sales-boundary-clarification、sales-prerequisite-clarification、sales-dependency-clarification 还是 sales-review-before-send
  - delivery 页会先说明当前更适合 delivery-onboarding-walkthrough、delivery-activation-confirmation、delivery-pilot-review、delivery-proposal-review、delivery-risk-clarification、delivery-boundary-clarification 还是 delivery-review-before-send
  - founder / sales / delivery 详情页会通过 current node / next step / boundary / evidence 接入现有 detail chain
  - discussion-only、boundary-only、review-before-send 和 non-commitment 不会被误写成 commitment
  - internal-only wording 不会混进 customer-visible cue

### 路径 U：Founder Q&A Variants

- 页面：
  - [Founder Q&A 详情页](<../../app/(workspace)/founder-qa/[id]/page.tsx>)
- 相关服务：
  - [founder-qa-variants-contract.ts](../../lib/presentation/founder-qa-variants-contract.ts)
  - [detail-model.ts](../../features/founder-qa-variants/detail-model.ts)
- 操作：
  1. 打开 founder Q&A detail 页
  2. 确认首屏先出现 current judgement，而不是散落 Q&A cue 或 founder script 字段
  3. 确认页面会先说明当前更适合 investor-style strategic question、customer value question、scope question、boundary question、why-now question、next-step question 还是 review-before-send founder answer
  4. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / qa trace / review trace 已分组
  5. 确认 handoff 可以从 proposal / reinforcement / founder conversation 切入 founder Q&A，再决定是否转到 external narrative
- 预期：
  - founder Q&A 详情页会继续把 boundary、prerequisite、dependency、non-commitment fallback 和 review-before-send 放在主叙事里
  - customer-visible wording 不会跳过当前 boundary
  - internal-only founder prep 不会混进 customer-visible cue
  - founder Q&A detail 会作为 founder conversation 的更细下一层，而不是独立的脚本页

### 路径 V：Sales Objection / Follow-up Variants

- 页面：
  - [Sales Objection 详情页](<../../app/(workspace)/sales-objections/[id]/page.tsx>)
  - [Sales Follow-up 详情页](<../../app/(workspace)/sales-followups/[id]/page.tsx>)
- 相关服务：
  - [sales-objection-followup-variants-contract.ts](../../lib/presentation/sales-objection-followup-variants-contract.ts)
  - [detail-model.ts](../../features/sales-objection-followup-variants/detail-model.ts)
- 操作：
  1. 分别打开 sales objection 和 sales follow-up detail 页
  2. 确认首屏先出现 current judgement，而不是散落 follow-up cue 或 objection reply 字段
  3. 确认 follow-up 页会先说明当前更适合 post-first-contact follow-up、post-demo follow-up 还是 proposal clarification
  4. 确认 objection 页会先说明当前更适合 objection reply、boundary clarification、prerequisite clarification、dependency clarification 还是 non-commitment clarification
  5. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / objection trace / follow_up_trace 已分组
- 预期：
  - 两页都会继续把 boundary、prerequisite、dependency、non-commitment fallback 和 review-before-send 放在主叙事里
  - customer-visible wording 不会跳过当前 boundary
  - internal-only prep 不会混进 customer-visible cue
  - sales objection / follow-up detail 会作为 sales conversation 的更细下一层，而不是独立脚本页

### 路径 W：Delivery Walkthrough / Review Variants

- 页面：
  - [Delivery Walkthrough 详情页](<../../app/(workspace)/delivery-walkthroughs/[id]/page.tsx>)
  - [Delivery Review 详情页](<../../app/(workspace)/delivery-reviews/[id]/page.tsx>)
- 相关服务：
  - [delivery-walkthrough-review-variants-contract.ts](../../lib/presentation/delivery-walkthrough-review-variants-contract.ts)
  - [detail-model.ts](../../features/delivery-walkthrough-review-variants/detail-model.ts)
- 操作：
  1. 分别打开 delivery walkthrough 和 delivery review detail 页
  2. 确认首屏先出现 current judgement，而不是散落 walkthrough cue 或 review note 字段
  3. 确认 walkthrough 页会先说明当前更适合 onboarding walkthrough、activation confirmation、next-step discussion 还是 package clarification
  4. 确认 review 页会先说明当前更适合 pilot review、proposal review、risk clarification、boundary clarification 还是 review-before-send
  5. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / walkthrough_trace / review_trace 已分组
- 预期：
  - 两页都会继续把 boundary、prerequisite、dependency、non-commitment fallback 和 review-before-send 放在主叙事里
  - customer-visible wording 不会跳过当前 boundary
  - internal-only prep 不会混进 customer-visible cue
  - delivery walkthrough / review detail 会作为 delivery conversation 的更细下一层，而不是独立脚本页

### 路径 X：External Narrative Fallback Variants

- 页面：
  - [External Narrative Fallback 详情页](<../../app/(workspace)/external-narrative-fallbacks/[id]/page.tsx>)
- 相关服务：
  - [external-narrative-fallback-variants-contract.ts](../../lib/presentation/external-narrative-fallback-variants-contract.ts)
  - [detail-model.ts](../../features/external-narrative-fallback-variants/detail-model.ts)
- 操作：
  1. 打开 external narrative fallback detail 页
  2. 确认首屏先出现 current judgement，而不是散落 fallback note 或 blocked cue 字段
  3. 确认页面会先说明当前更适合 non-commitment fallback、boundary-only fallback、review-before-send fallback、exploratory-only narrative 还是 blocked narrative
  4. 确认页面会继续明确当前 fallback 是否还能 customer-visible、是否只能 internal-only、是否仍必须 review-before-send
  5. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / narrative trace / fallback_trace 已分组
- 预期：
  - fallback 页会继续把 boundary、prerequisite、dependency、non-commitment fallback 和 review-before-send 放在主叙事里
  - customer-visible wording 不会跳过当前 fallback line
  - internal-only fallback 不会混进 customer-visible cue
  - external narrative fallback detail 会作为 external narrative 的更细下一层，而不是散落在 note 里的补充说明

### 路径 Y：Conversation Detail Chain Extension

- 页面：
  - [Contact 详情页](<../../app/(workspace)/contacts/[id]/page.tsx>)
  - [Company 详情页](<../../app/(workspace)/companies/[id]/page.tsx>)
  - [Meeting 详情页](<../../app/(workspace)/meetings/[id]/page.tsx>)
- 相关服务：
  - [detail-model.ts](../../features/conversation-chain-extension/detail-model.ts)
  - [detail-view.tsx](../../features/conversation-chain-extension/detail-view.tsx)
- 操作：
  1. 分别打开 contact / company / meeting detail 页
  2. 确认首屏先出现 current judgement，而不是直接落回原对象字段区
  3. 确认 company 页会先说明当前账户路由应该交给哪个 contact 或 meeting
  4. 确认 contact 页会先说明当前关系路由应该切到 sales follow-up、meeting 还是继续 internal-only
  5. 确认 meeting 页会先说明当前 follow-through 应切到 delivery review、delivery walkthrough 还是继续内部准备
  6. 展开 evidence drawer，确认 replay / memory / boundary trace / worker output / historical changes 已分组
- 预期：
  - contacts / companies / meetings 已经不再只表现为对象详情页
  - 这 3 类页都会先说明自己在沟通链中的位置、边界和下一步 handoff
  - handoff 不再只是跳转链接，而会继续带 reason / boundary / next action / worker / evidence
  - 当前仍不是完整 CRM、communications graph 或 workflow engine

### 路径 AA：Inbox / Follow-up / Review Request Detail Chain

- 页面：
  - [Inbox 详情页](<../../app/(workspace)/inbox/[id]/page.tsx>)
  - [Follow-up 详情页](<../../app/(workspace)/follow-ups/[id]/page.tsx>)
  - [Review Request 详情页](<../../app/(workspace)/review-requests/[id]/page.tsx>)
- 相关服务：
  - [inbox-followup-review-request-detail-contract.ts](../../lib/presentation/inbox-followup-review-request-detail-contract.ts)
  - [detail-model.ts](../../features/inbox-followup-review-request/detail-model.ts)
  - [detail-view.tsx](../../features/inbox-followup-review-request/detail-view.tsx)
- 操作：
  1. 分别打开 inbox / follow-up / review request detail 页
  2. 确认首屏先出现 current judgement，而不是线程容器、草稿字段区或审批壳层
  3. 确认 inbox 页会先说明当前 thread 更适合继续 customer-visible 跟进、停在 internal-only，还是切到 follow-up
  4. 确认 follow-up 页会先说明当前更适合 draft、ready-to-review 还是 review-before-send，而不是直接平铺发送内容
  5. 确认 review request 页会先说明当前 review 为何 pending、escalated 或 blocked，以及现在该由谁接手
  6. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / handoff_trace / historical changes 已分组
- 预期：
  - inbox / follow-up / review request detail chain 已经不再只表现为消息壳层、草稿壳层和审批壳层
  - 这 3 类页都会先说明自己在沟通链中的位置、边界和下一步 handoff
  - handoff 不再只是跳转链接，而会继续带 reason / boundary / next action / worker / evidence
  - 当前仍不是完整 inbox / messaging platform、email client、review workflow engine 或 notifications center

### 路径 AC：Customer Success Handoff Surface

- 前置条件：
  - 只有在最新 route smoke / e2e 已确认 `/customer-success` 与 `/customer-success/[id]` 可打开时，才继续走这条路径
  - 如果 `customer-success` richest surface 当前是红的，就先记录为 runtime blocker，不要把后续 handoff 当成 pilot-ready

- 页面：
  - [Customer Success Queue / Inbox Surface](<../../app/(workspace)/customer-success/page.tsx>)
  - [Customer Success Handoff 详情页](<../../app/(workspace)/customer-success/[id]/page.tsx>)
  - [Success Check 详情页](<../../app/(workspace)/success-checks/[id]/page.tsx>)
  - [Expansion Review 详情页](<../../app/(workspace)/expansion-reviews/[id]/page.tsx>)
- 相关服务：
  - [customer-success-handoff-surface-contract.ts](../../lib/presentation/customer-success-handoff-surface-contract.ts)
  - [detail-model.ts](../../features/customer-success-handoff/detail-model.ts)
  - [detail-view.tsx](../../features/customer-success-handoff/detail-view.tsx)
- 操作：
  1. 打开 `/customer-success`、customer success / success check / expansion review detail 页
  2. 确认 queue 页会先说明当前为什么先看 escalation、issue 或普通 follow-through，而不是直接回 company proxy
  3. 确认 queue / inbox 只被写成 derived operational surface，与 visibility / triage / routing cue layer，而不是邮件平台、canonical 队列或 workflow 引擎
  4. 确认 `issue-follow-through` 被解释为真实 follow-through 问题已经出现，但修复路径仍停在正常当前轮协调；`escalation-follow-through` 被解释为当前已被 dependency、boundary、缺失 decision、widened ownership pressure 或更高 risk 实质阻塞
  5. 确认 detail 页首屏先出现 current judgement、reason、why it matters、action summary、decision request、boundary、evidence summary、next action、risk cue 和 current stage，而不是 company proxy 或对象字段堆叠
  6. 确认 detail 页会把 `decision posture` 和 `decision request` 分开说清，而不是把当前判断姿态和显式 ask 混成一句
  7. 确认页面会先说明为什么现在由 customer success 接手，并继续显式保留 stage、sendability、non-commitment、next action
  8. 确认 `review request -> customer success -> success check -> expansion review` handoff 已显式可见，且 `customer success <-> inbox detail` 已可显式来回切换
  9. 展开 evidence drawer，确认 replay / audit / memory / worker output / boundary trace / sendability trace / handoff trace / success trace / historical changes 已分组
- 预期：
  - customer success 已经不再依赖 company proxy
  - success / expansion / review / company detail 已经开始形成连续经营链
  - recommendation、handoff、success follow-through、success check、expansion review 都不会被误讲成 commitment
  - 当前仍不是完整 customer success platform、CRM / CS ops 平台或 workflow engine

### 路径 AD：Customer Success Handoff Surface Baseline Freeze

- 前置条件：
  - 只有在最新 route smoke / e2e 已确认 `/customer-success` 与 `/customer-success/[id]` 可打开时，才继续核对这条 baseline freeze 路径
  - 如果当前 runtime route 不健康，应先把问题记为 baseline blocker，而不是继续按“已 ready”验收 handoff 链

- 页面：
  - [Customer Success Queue / Inbox Surface](<../../app/(workspace)/customer-success/page.tsx>)
  - [Customer Success Handoff 详情页](<../../app/(workspace)/customer-success/[id]/page.tsx>)
  - [Success Check 详情页](<../../app/(workspace)/success-checks/[id]/page.tsx>)
  - [Expansion Review 详情页](<../../app/(workspace)/expansion-reviews/[id]/page.tsx>)
- 操作：
  1. 打开 `/customer-success` 与 customer success / success check / expansion review detail 页
  2. 确认 README、docs index、self-check、boundary check、pilot readiness 都已经指向 baseline freeze 入口和 v1.1 source-of-truth / spec
  3. 确认 queue / inbox 只被写成 derived operational surface 与 visibility / triage / routing cue layer，而不是 customer success platform、workflow engine、prioritization engine 或 canonical queue
  4. 确认首屏仍先出现 current judgement、current reason、evidence summary、boundary、decision request、next action 和 risk cue，而不是退回 company proxy 或对象字段堆叠
  5. 确认 `issue-follow-through` 与 `escalation-follow-through` 在演示、training、acceptance 文案里仍保持 v1.1 的 thin operational 含义，不被写成 workflow 状态或 SLA 状态
  6. 确认 `review request -> customer success -> success check -> expansion review`、`customer success -> proposal / package / offer / external proposal` 以及 `customer success <-> inbox detail` handoff 仍显式可见
  7. 确认 demo / training / acceptance / delivery 讲法仍沿用同一套 customer success handoff、boundary、evidence、decision posture、decision request 语义
- 预期：
  - 当前 customer success handoff surface baseline 已经清楚
  - 当前 customer success detail baseline 与 chain baseline 已经清楚
  - README、docs、checks、regression 和 delivery 资产都已经同步到 Baseline Freeze 与 v1.1 source-of-truth
  - recommendation、handoff、success follow-through、success check、expansion review 仍不等于 commitment，`review-before-send` 仍不是 safe-to-send by default
  - 当前仍不是完整 customer success platform、CRM / CS ops 平台或 workflow engine

---

## 3. Evolution

### 路径 A：PreferenceSignal 类 suggestion

- 页面：
  - [设置页](<../../app/(workspace)/settings/page.tsx>)
- 验收对象：
  - `建议把会后跟进窗口收紧到 24 小时`
- 预期：
  - seed 中已经保留一条 **已采纳** 的 timing suggestion：
    - `建议把会后跟进窗口收紧到 24 小时`
  - 设置页“最近已收敛到系统规则的建议”里应能直接看到它
  - recommendation explanation 和首页 / 周报中的 evolution 区，应该能看到“会后 24 小时窗口”这类学习结果
- 边界：
  - 当前这类 suggestion 会改变 signal，不会直接改 `policyResult`

### 路径 B：PolicyRule 类 suggestion

- 当前状态：
  - 当前 seed 没有现成 open 的 `PolicyRule` 类 suggestion 样例
- 验收边界：
  - 代码支持采纳后改写 `PolicyRule.mode`
  - 这条链在受控验证里已成立，但当前主库仍更适合验收 `PreferenceSignal` 类 suggestion

### 路径 C：新的主动进化模式

- 页面：
  - [今日工作台](<../../app/(workspace)/dashboard/page.tsx>)
  - [管理者周报页](<../../app/(workspace)/reports/page.tsx>)
- 预期：
  - 首页“系统最近学到了什么”能看到：
    - 停滞机会模式
    - 关系降温模式
  - 周报里除了“新规律”，还应看到“最近已经收敛进系统的规律”
  - 这些内容不应只是文案占位，而是来自 `PatternFact / StrategySuggestion`

### 路径 D：治理与接入健康度

- 页面：
  - [设置页](<../../app/(workspace)/settings/page.tsx>)
  - [管理者周报页](<../../app/(workspace)/reports/page.tsx>)
- 预期：
  - 设置页应直接看到：
    - 近 7 天审计事件
    - 当前待审批
    - 受审批保护动作
    - LLM fallback 次数
    - 已收敛建议
  - 设置页连接器 tab 应直接看到：
    - 已连接连接器
    - 同步异常连接器
    - 真实 / 导入线程
    - 待绑定线程
    - 导入工作信号
    - 重复邮箱线索
  - 周报页应新增：
    - 治理健康度
    - 接入健康度

---

## 4. Conversation Capture

### 路径 A：开始记录 -> transcript -> insight

- 页面：
  - [Capture 页](<../../app/(workspace)/capture/page.tsx>)
- 相关服务：
  - [capture-session.service.ts](../../lib/conversation-capture/capture-session.service.ts)
  - [transcription.service.ts](../../lib/conversation-capture/transcription.service.ts)
  - [conversation-understanding.service.ts](../../lib/conversation-capture/conversation-understanding.service.ts)
- 预期：
  - 生成 `CaptureSession`
  - 生成 `ConversationTranscript`
  - 生成 `ConversationInsight`
  - 如果浏览器支持麦克风并授权成功，页面应进入“麦克风录音中”
  - 如果浏览器不支持或授权失败，页面应清楚回退到“速记模式记录中”
  - capture 结果页应明确显示 transcript 来源：
    - `真实 ASR`
    - `手工速记`
    - `Fallback transcript`
    - `外部 transcript`

### 路径 B：memory writeback / approval

- 相关服务：
  - [conversation-action-bridge.service.ts](../../lib/conversation-capture/conversation-action-bridge.service.ts)
  - [meeting-memory-pipeline.service.ts](../../lib/memory/meeting-memory-pipeline.service.ts)
- 预期：
  - 写 `MeetingNote`
  - 写回 `MemoryFact / Commitment / Blocker`
  - 必要时进入 approval
  - capture 结果页直接展示：
    - 写回了多少 facts / commitments / blockers
    - 生成了哪些动作
    - 进入了哪些审批
    - 刷新了哪些 recommendation

### 路径 C：外部 ingest transcript

- 页面 / 接口：
  - [Capture 页](<../../app/(workspace)/capture/page.tsx>)
  - [ingest/route.ts](../../app/api/conversation-capture/ingest/route.ts)
- 操作：
  1. 通过 `POST /api/conversation-capture/ingest` 提交 transcript 文本
  2. 可选附带 `transcriptSegments / transcriptLanguage / transcriptConfidence / transcriptProvider / transcriptModel`
  3. 回到 `/capture` 查看结果
- 预期：
  - transcript 来源显示为“外部 transcript”
  - 若提供 segments，则结果页直接展示外部 transcript 结构，而不是系统重切句
  - 其后仍会进入 insight、memory、recommendation 和 approval 链

### 真实边界

- 当前真实成立的是：
  - 浏览器录音 MVP
  - 停止后上传音频
  - 单 provider ASR 转写
  - transcript / insight / memory writeback / approval 链
- 当前也已支持：
  - 外部 transcript ingest
- 当前不是：
  - 实时流式转写产品
  - 真实 speaker diarization
  - Zoom / 腾讯会议原生音频采集产品

---

## 5. CRM-first Migration

### 路径 A：HubSpot 首次导入

- 页面：
  - [CRM 导入页](<../../app/(workspace)/imports/crm/page.tsx>)
  - [导入结果页](<../../app/(workspace)/imports/jobs/[id]/page.tsx>)
- 相关服务：
  - [hubspot.ts](../../lib/connectors/hubspot.ts)
  - [crm-orchestrator.service.ts](../../lib/imports/crm-orchestrator.service.ts)
  - [warmup.service.ts](../../lib/imports/warmup.service.ts)
- 预期：
  - 能接入 HubSpot 或示例工作区
  - 首次导入 contacts / companies / deals / notes
  - 导入结果页能展示成功记录、warning、warmup 结果
  - notes 导入后能形成 blocker / commitment / recommendation

### 路径 B：Salesforce 首次导入

- 页面：
  - [CRM 导入页](<../../app/(workspace)/imports/crm/page.tsx>)
  - [导入结果页](<../../app/(workspace)/imports/jobs/[id]/page.tsx>)
- 相关服务：
  - [salesforce.ts](../../lib/connectors/salesforce.ts)
  - [crm-orchestrator.service.ts](../../lib/imports/crm-orchestrator.service.ts)
- 预期：
  - 能接入 Salesforce 或示例 Org
  - 首次导入 accounts / contacts / opportunities / events / tasks
  - Event 会进入 Meeting
  - Task 会进入 timeline / action 输入

### 路径 C：冲突处理

- 页面：
  - [冲突处理页](<../../app/(workspace)/imports/conflicts/page.tsx>)
- 相关服务：
  - [identity-resolution.service.ts](../../lib/imports/identity-resolution.service.ts)
  - [route.ts](../../app/api/imports/conflicts/[id]/resolve/route.ts)
- 预期：
  - 至少有一条 `NEEDS_REVIEW` 冲突
  - 能说明为什么需要人工确认
  - 处理后冲突页和导入结果页状态同步变化

---

## 6. 试点运营与多语言边界

### 路径 A：工作区试点运营控制

- 页面：
  - [设置页 Pilot Tab](<../../app/(workspace)/settings/page.tsx>)
  - [试点诊断页](<../../app/(workspace)/diagnostics/page.tsx>)
- 相关服务：
  - [updateWorkspaceOperationalControlsAction](../../features/settings/actions.ts)
  - [normalizeWorkspaceUiConfig](../../lib/workspace-ops.ts)
- 操作：
  1. 打开 `/settings?tab=pilot`
  2. 检查默认语言、pilot mode、capture 授权确认、保留天数和 feature flags
  3. 切换默认语言到 English
  4. 跳转 `/diagnostics`
- 预期：
  - shell、CRM-first 页面、diagnostics、capture 关键入口切到英文
  - `multilingualUi / diagnosticsCenter` 打开后立即影响前台
  - audit log 与 event log 记录工作区运营配置更新

### 路径 B：试点诊断页

- 页面：
  - [试点诊断页](<../../app/(workspace)/diagnostics/page.tsx>)
- 相关服务：
  - [getDiagnosticsData](../../features/diagnostics/queries.ts)
  - [capture-metrics.service.ts](../../lib/observability/capture-metrics.service.ts)
- 预期：
  - recommendation / memory 质量摘要可见
  - CRM 接入健康度可见
  - LLM / ASR 健康度可见
  - 最近 import / capture job 可见
  - workspace 级 `pilotMode / captureConsentRequired / featureFlags` 可见
