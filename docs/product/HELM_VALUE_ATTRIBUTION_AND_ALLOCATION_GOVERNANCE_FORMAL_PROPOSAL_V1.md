---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Value Attribution And Allocation Governance Formal Proposal V1

状态：Proposal-for-review  
Owner：Helm Core  
日期：2026-04-21  
依赖文档：

- `HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_PRD_V1.md`
- `HELM_REVENUE_ATTRIBUTION_BASELINE_V1.md`
- `HELM_PARTNER_REGISTRY_BASELINE_V1.md`
- `HELM_CONTRIBUTOR_PORTAL_BASELINE_V1.md`
- `HELM_MANUAL_SETTLEMENT_BASELINE_V1.md`
- `HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_REQUIREMENTS_V1.md`

> 这是一份独立正式提案，用于组织专家评审、反复修改和逐步冻结 Helm 在 “贡献可见、价值可解释、分配可治理” 方向上的下一阶段设计。  
> 它是 review draft，不是 accepted baseline，不代表 current-main 已具备新的 schema、自动分配、自动打款、股权发放或 finance platform 能力。

## 1. 提案要回答什么

本提案要回答 8 个问题：

1. Helm 是否应把 “所有营收的贡献归因与价值累积” 纳入系统主线
2. 这件事在 Helm 内应被定义成什么，而不应被定义成什么
3. 哪些贡献者、贡献项、收益来源需要进入体系
4. 系统如何评估贡献，而不退化成拍脑袋分配
5. 系统如何做即时记账、延迟结算、回撤与争议
6. 系统如何在不越过边界的前提下，给贡献者形成稳定预期
7. 这条线如何落到 Helm 当前已存在的 attribution / portal / settlement 主线
8. 这件事的风险、反对意见、治理要求和分期落地方式是什么

## 2. 执行摘要

本提案建议 Helm 新增一条独立商业治理主线：

`Value Attribution -> Revenue Accrual -> Settlement Proposal -> Equity Accrual Proposal -> Governance Review`

这条线的核心判断是：

1. Helm 不应只解释 “收入来自哪里、归给谁”，还应解释 “是谁通过什么贡献把这笔价值推进出来的”。
2. “即时分配”在 Helm 里应被严格定义为：`即时记账（accrual） + 延迟结算（settlement） + 显式回撤（reversal） + 可申诉（dispute）`。
3. 营收分配与股权分配必须共用证据层，但不能共用执行层；它们应是两套 ledger、两套审批、两套法律后果。
4. 这件事的短期目标不是自动分钱，而是建立一条组织内部和外部贡献者都可以信任的 “价值可见、价值可解释、价值可累积” 主线。
5. Helm 应先做 “贡献证据化 -> 价值应计化 -> 分配提案化”，而不是直接进入自动结算或自动股权分配。

## 3. 为什么现在要做

## 3.1 从 Helm 的产品逻辑看

Helm 当前已经成立的主线是：

- `workspace-first`
- `membership-backed`
- `judgement-first`
- `decision-first`
- `revenue attribution`
- `partner registry`
- `participant portal`
- `manual settlement`

但 Helm 仍缺一层能把 “经营动作” 和 “经济回报” 真正接起来的系统能力。

当前系统已经能回答：

- 收入来自哪里
- 哪个 beneficiary 被 credit
- 哪些 line 可 payable-later
- 哪些 line 进入 manual settlement

当前系统仍不能完整回答：

- 哪个团队成员、哪个外部贡献者、哪个协作角色，通过哪些动作把这笔价值推进出来
- 为什么某些价值属于 acquisition、conversion、delivery、retention 或 platform enablement
- 为什么这个人应该形成稳定预期，即使还没有实际结算

## 3.2 从 GTM 看

如果 Helm 想把 GTM 做到极致，Helm 就不能只做：

- CRM-like opportunity visibility
- meeting-to-action
- proposal / handoff / review

它还要能处理：

- GTM 价值如何被看见
- 多角色协作如何被拆解
- 结果如何不被最后一跳独占
- 外部贡献者为什么愿意长期留下来

这个机制一旦成立，它会直接影响：

- contributor retention
- partner willingness
- referral quality
- platform trust
- GTM scale efficiency

## 3.3 从组织行为设计看

没有分配治理的系统，容易退化成：

- 人情记账
- 最后触点独占
- 线下争议
- 模糊承诺
- 规则漂移

而有治理的系统，至少可以让组织做到：

- 贡献可见
- 规则版本可见
- 回撤逻辑可见
- 争议路径可见
- 平台池与直接分配池区分清楚

## 4. 本提案的边界

## 4.1 本提案要做的

- 定义新的商业治理主线
- 定义对象、状态机、证据、评分、分池、分配提案和争议机制
- 说明如何挂接 current-main
- 给出分期和评审问题

## 4.2 本提案明确不做的

- 自动打款
- payroll
- tax / invoice engine
- KYC / AML engine
- share issuance automation
- 员工薪酬替代系统
- 完整 finance console
- public marketplace leaderboard
- public partner discovery

## 4.3 必须继续保留的硬边界

- recommendation != commitment
- accrual != settlement
- settlement proposal != actual payout
- equity accrual proposal != equity grant
- participant portal remains self-only
- manual settlement remains fallback source of truth
- Helm 仍不是完整 finance platform
- Helm 仍不是完整 equity admin platform

## 4.4 复杂度分层原则

这条线要成立，必须同时满足两个条件：

1. 治理层足够完整，能承受回撤、争议、多人协作和规则漂移
2. 用户前台足够克制，不把治理语言直接甩给大多数用户

因此本提案明确采用双层复杂度策略：

- 后台治理层可以保留 richer object model、evidence chain、rule version、pooling 与 dispute handling
- 前台用户面默认只暴露 3-5 个概念，不要求贡献者理解完整对象体系

默认前台只展示：

- 我的贡献
- 我的应计
- 我的结算

其中：

- “我的结算” 可以在一个卡片内部继续解释 `待成熟 / 已成熟 / 下一结算窗口`
- 但默认不把这些状态拆成新的用户学习概念

默认不把以下词直接暴露成一线用户的学习负担：

- `AttributionGraphEdge`
- `AllocationPoolTemplate`
- `RuleVersion`
- `EquityAccrualProposal`

除非进入内部治理视角、财务运营视角或专家评审视角。

## 5. 正式定义

## 5.1 Value Attribution

Value Attribution 不是静态 credit，而是：

- 对收入形成过程中的人、角色、资产、协作、放大器进行结构化归因

它回答：

- 谁做了什么
- 为什么算贡献
- 哪些证据支持
- 对结果的影响有多大

## 5.2 Revenue Accrual

Revenue Accrual 是：

- 在收入确认之后，把符合规则的价值先进入应计，而不是直接进入实际结算

它回答：

- 哪部分价值属于这个贡献者
- 哪部分已经成熟
- 哪部分仍在观察期或保留期

## 5.3 Settlement Proposal

Settlement Proposal 是：

- 基于应计、成熟窗口、争议状态、回撤状态形成的结算建议

它不是：

- payout execution
- bank/wallet disbursement

## 5.4 Equity Accrual Proposal

Equity Accrual Proposal 是：

- 把长期价值贡献以非现金账本累积，再进入有限窗口的正式评审

它不是：

- cap table update
- legal grant

## 6. 完整对象体系

> 这里定义的是治理层 planning objects，不等于它们都会在 MVP 成为用户一等概念。  
> MVP 产品面应先收口成 `ContributionEvent / ValueAccrual / AllocationProposal` 三个可感知对象，其余对象保持治理预留和内部实现空间。

## 6.1 现有可复用对象

current-main 已有：

- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`
- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `ParticipantPortalAccess`
- `SettlementBatch`
- `SettlementBatchLine`

这些对象已经让 Helm 能解释：

- 收益来源
- beneficiary
- payable-later
- settlement posture

## 6.2 新增对象（proposal-level）

本提案建议新增以下 planning objects：

### 6.2.1 ContributionEvent

表示一次可归因的贡献动作。

最少字段：

- `workspaceId`
- `contributorType`
- `contributorRef`
- `role`
- `contributionType`
- `relatedObjectType`
- `relatedObjectId`
- `occurredAt`
- `status`
- `evidenceConfidence`
- `summary`

### 6.2.2 ContributionEvidenceRef

表示支持 ContributionEvent 的证据链。

最少字段：

- `sourceType`：meeting / crm / proposal / approval / execution proof / report / manual review
- `sourceRef`
- `evidenceLevel`
- `capturedAt`
- `capturedBy`

### 6.2.3 AttributionGraphEdge

表示贡献与收益或收益池之间的连接关系。

最少字段：

- `fromContributionEventId`
- `toRevenueEventId`
- `edgeType`
- `weight`
- `confidence`
- `ruleVersion`

### 6.2.4 AllocationTemplate

定义某类收益如何被分池、成熟、回撤。

最少字段：

- `revenueSourceType`
- `effectiveFrom`
- `effectiveTo`
- `netRevenuePolicy`
- `maturityWindow`
- `reversalWindow`
- `allowedContributionTypes`
- `poolDefinition`
- `status`

### 6.2.5 AllocationPoolTemplate

定义标准池。

建议标准池：

- `acquisition_pool`
- `conversion_pool`
- `delivery_pool`
- `retention_pool`
- `platform_pool`
- `reserve_hold`

### 6.2.6 RevenueAccrualLedger

表示“可解释但未必已结算”的价值应计账本。

最少字段：

- `beneficiaryType`
- `beneficiaryRef`
- `sourceRevenueRef`
- `allocationPool`
- `accruedAmount`
- `currency`
- `status`
- `maturesAt`
- `reversalWindowEndsAt`
- `ruleVersion`

### 6.2.7 EquityAccrualLedger

表示股权累积建议账本。

最少字段：

- `beneficiaryType`
- `beneficiaryRef`
- `accrualUnits`
- `period`
- `justificationSummary`
- `status`
- `ruleVersion`

### 6.2.8 AllocationProposal

表示收入分配建议。

最少字段：

- `proposalWindow`
- `generatedAt`
- `generatedFromAccrualIds`
- `grossProposedAmount`
- `netProposedAmount`
- `currency`
- `status`
- `approvedBy`

### 6.2.9 EquityAccrualProposal

表示股权累积建议。

### 6.2.10 DisputeCase

表示争议与复核。

最少字段：

- `openedBy`
- `openedAt`
- `targetType`
- `targetRef`
- `reason`
- `status`
- `resolutionType`
- `resolvedAt`

### 6.2.11 RuleVersion

表示当前分配规则版本。

最少字段：

- `versionKey`
- `effectiveFrom`
- `status`
- `changeSummary`
- `nonRetroactive`

## 7. 贡献者的完整穷举

## 7.1 内部贡献者

- founder / owner
- GM / business lead
- sales lead
- SDR
- AE
- partner manager
- GTM operator
- marketing
- content
- community
- presales / solution consultant
- delivery manager
- implementation consultant
- trainer
- customer success manager
- support
- account manager
- PM
- engineer
- designer
- data / revops
- finance ops
- legal / compliance

## 7.2 外部贡献者

- sales referrer
- channel partner
- distributor
- system integrator
- consulting partner
- co-delivery partner
- training partner
- content publisher
- event co-host
- advocacy contributor / case-study contributor

## 7.3 非默认 payable 对象

- AI worker
- workflow automation
- reusable template
- artifact pack
- shared playbook

这些默认只作为：

- evidence
- amplification factor
- platform pool justification

## 8. 贡献项的完整穷举

## 8.1 Acquisition

- lead sourced
- lead qualified
- campaign converted
- content converted
- event converted
- referral introduced
- partner sourced pipeline

## 8.2 Conversion

- discovery completed
- proposal shaped
- solution clarified
- objection clarified
- commercial negotiation pushed
- contract finalized
- payment collection pushed

## 8.3 Delivery

- implementation milestone reached
- go-live completed
- training completed
- adoption target reached
- issue resolved
- acceptance passed

## 8.4 Retention / Expansion

- renewal saved
- expansion sold
- cross-sell enabled
- churn prevented
- refund recovered

## 8.5 Platform / Enablement

- template created
- reusable workflow built
- automation launched
- playbook published
- pricing/package improvement landed
- conversion-rate improvement landed
- reusable GTM asset reused on revenue path

## 8.6 Governance / Safety

- dispute resolved
- reversal correctly handled
- audit completed
- evidence gap repaired

这类贡献一般更适合进入：

- `platform_pool`
- `governance_pool`

而不是直接逐单对人分配。

## 9. 收益来源的完整穷举

## 9.1 current-main 已成立来源

- `ORGANIZATION_BASE_FEE`
- `ACTIVE_SEAT`
- `ADD_ON_WORKER`
- `CUSTOM_IMPLEMENTATION`
- `CUSTOM_MAINTENANCE`
- `SALES_REFERRAL`

## 9.2 下一层建议纳入来源

- renewal revenue
- expansion revenue
- cross-sell revenue
- training revenue
- managed service revenue
- success-fee revenue
- ecosystem resale revenue
- co-delivery revenue
- content-assisted conversion revenue

## 9.3 每类来源必须回答的问题

每个 `RevenueSourceType` 必须绑定一份分配模板，明确：

- 是否可分配
- 哪部分可分配
- 进入哪些 pool
- 成熟周期
- 回撤窗口
- 哪些贡献项可以计入
- 哪些争议类型最常见

## 10. 评估机制

## 10.1 证据等级

统一证据等级：

- `L0` oral / unverified
- `L1` single-side record
- `L2` cross-checked record
- `L3` system event + result linked
- `L4` auditable closed-loop evidence

## 10.2 评分公式

建议统一评分公式：

`Contribution Score = BaseWeight × Impact × EvidenceConfidence × QualityAdjust × CollaborationAdjust × TimeDecay`

解释：

- `BaseWeight`：贡献项基础权重
- `Impact`：对结果影响
- `EvidenceConfidence`：证据可信度
- `QualityAdjust`：质量和返工系数
- `CollaborationAdjust`：多人协作校正
- `TimeDecay`：长尾递减

## 10.3 必须支持的归因模式

- `single direct credit`
- `multi-touch attribution`
- `team pool attribution`
- `platform enablement attribution`

## 10.4 不允许退化成的模式

- 只按最后一跳分配
- 只按岗位职级分配
- 只按老板手动决定
- 只按线下 Excel 复盘

## 11. 分配机制

## 11.1 先分池，再分人

每笔收益不应直接逐人拆，而应走：

`Revenue Event -> Net Revenue -> Allocation Pools -> Contributor Accrual -> Settlement Proposal`

## 11.2 净收入定义

净收入建议至少扣除：

- rail fees
- tax / mandatory deductions
- refunds
- reversals
- pass-through delivery cost
- reserve hold

## 11.3 标准池建议

- `acquisition_pool`
- `conversion_pool`
- `delivery_pool`
- `retention_pool`
- `platform_pool`
- `reserve_hold`

## 11.4 recurring 收益规则

对 recurring revenue，不应一次性分完，而应区分：

- first conversion value
- recurring retention value
- recurring delivery / success value
- platform share

## 11.5 股权累积规则

股权价值应独立于现金结算：

- 不与月结直接绑定
- 不与 payout 绑定
- 按季度 / 半年窗口进入评审
- 必须单独过 founder / legal / board review

## 12. 状态机

## 12.1 ContributionEvent

- `observed`
- `verified`
- `linked`
- `rejected`
- `disputed`

## 12.2 RevenueAccrualLedger

- `pending`
- `matured`
- `settlement_proposed`
- `settled`
- `reversed`
- `disputed`

## 12.3 EquityAccrualLedger

- `pending`
- `vesting_candidate`
- `proposal_ready`
- `approved_for_grant`
- `rejected`
- `superseded`

## 12.4 DisputeCase

- `open`
- `under_review`
- `resolved_keep`
- `resolved_adjust`
- `resolved_reverse`

## 13. 关键流程

## 13.1 典型收入形成流程

1. 收入事件进入系统  
2. 收入被挂到现有 `RevenueAttributionLedger`  
3. 系统或人工生成 `ContributionEvent`  
4. 证据被挂到 `ContributionEvidenceRef`  
5. 系统生成 `AttributionGraphEdge`  
6. 套用 `AllocationTemplate` 分池  
7. 写入 `RevenueAccrualLedger`  
8. 到 maturity window 后进入 `AllocationProposal`  
9. 运营 / 财务 / owner 复核  
10. 进入现有 manual settlement 或明确 defer

## 13.2 争议流程

1. 贡献者发起 `DisputeCase`  
2. 系统冻结相关 proposal 或 accrual  
3. reviewer 补证据 / 调规则 / 做裁定  
4. 形成：
   - `resolved_keep`
   - `resolved_adjust`
   - `resolved_reverse`

## 13.3 回撤流程

发生以下情况时允许自动或半自动回撤：

- refund
- cancellation
- delivery failure
- evidence invalidation
- fraudulent claim

但回撤也必须留下：

- reason
- ruleVersion
- evidence chain
- operator / reviewer

## 14. 反作弊与反失真

系统如果只强调透明和即时，而没有反作弊机制，很快会失真。必须明确：

### 14.1 风险

- 刷贡献事件
- 人为抢最后一跳
- 用低质量 lead 充数
- 把共享平台贡献私有化
- 利用信息差压低他人 credit

### 14.2 对策

- evidence level gating
- duplicate detection
- role-based weight bands
- pool caps / floor
- dispute queue
- audit sampling
- explicit rule versioning
- non-retroactive rule policy

## 15. 组织与法律边界

## 15.1 法律 / 合规提醒

本提案不覆盖完整法律设计，但必须要求在正式落地前完成：

- revenue-share legal review
- labor / contractor classification review
- tax handling review
- equity recommendation governance review
- cross-border settlement review（如果适用）

## 15.2 产品必须诚实表达的边界

- `Account balance` 不等于可立即提现
- `settlement proposed` 不等于已付款
- `equity proposal` 不等于股权已授予
- `portal visible` 不等于 finance admin scope

## 16. 为什么这个方案优于替代方案

## 16.1 替代方案 A：完全人工分配

优点：

- 上手快

缺点：

- 不可审计
- 容易关系化
- 无法 scale
- 不形成系统记忆

结论：

- 不适合作为 Helm 的战略主线

## 16.2 替代方案 B：最后一跳归因

优点：

- 简单

缺点：

- 严重低估协作
- 伤害交付 / 留存 / 平台贡献

结论：

- 只可作为极窄场景，不可作为总机制

## 16.3 替代方案 C：直接自动打款

优点：

- 看起来最强

缺点：

- 合规风险高
- 争议成本高
- 容易误把 recommendation 写成 commitment

结论：

- 当前阶段不应该做

## 17. 分期建议

### Phase 0

- 冻结 proposal 为 review draft
- 不开发代码、不改 schema、不做产品化承诺
- 组织专家评审
- 执行一轮真实用户调研
- 确认哪些收益来源进入 V1
- 确认是否值得进入 MVP

Phase 0 必须至少验证 4 个问题：

1. 真实用户的主痛点到底是 “贡献不被看见” 还是 “分配不透明”
2. 贡献者是否接受 `即时记账 + 延迟结算 + 可回撤`
3. 用户是否能在不理解治理层对象的前提下，仅用 3-5 个前台概念理解这个系统
4. 哪类收益来源最适合进入 V1，而不会造成高争议和高治理成本

只要其中任意一个核心假设不成立，就应直接进入 `No-Go`，而不是继续推进实现。

### Phase 1

- 补 `ContributionEvent`
- 补 evidence chain
- 补 rule versioning

### Phase 2

- 补 `RevenueAccrualLedger`
- 上线 contributor account readout
- 不开放提现、不开放 payout

### Phase 3

- 上线 `AllocationProposal`
- 上线 `DisputeCase`
- 上线 `allocation simulator`

### Phase 4

- 让 allocation proposal 进入现有 manual settlement 输入
- 保持 manual settlement fallback

### Phase 5

- 讨论 `EquityAccrualProposal`
- 独立 review，不和现金结算绑死

## 18. V1 建议范围

为了避免过早失控，MVP 建议只纳入一条收入线：

- 默认首选：`SALES_REFERRAL`
- 备选：`CUSTOM_IMPLEMENTATION`

在正式决议前，不建议同时纳入多条收入线。

原因：

- `SALES_REFERRAL` 与当前 partner / portal / settlement 主线最接近
- 线索来源和转介绍信用更容易形成证据链
- 对外部贡献者的预期价值最直接
- 最适合作为 “贡献可见 + 应计可见 + 结算建议” 的最小验证场景

V1 的前台产品面建议只展示：

- `ContributionEvent`
- `ValueAccrual`
- `AllocationProposal`

V1 不要求把所有治理对象都产品化，只要求：

- 贡献能被记录
- 应计能被看见
- 分配能形成建议
- 规则和证据在后台可追溯

V1 不建议优先纳入：

- `CUSTOM_MAINTENANCE`
- 所有 recurring seat revenue
- 所有 add-on worker revenue
- 全平台平台池自动拆分

这些应在 Phase 2-3 之后再看。

## 19. 专家评审必须回答的问题

本提案进入下一阶段前，至少需要评审者明确回答以下问题：

1. 我们是否同意把这件事定义为 governance 主线，而不是 finance product
2. 我们是否同意 “accrual != settlement”
3. 我们是否同意 “revenue ledger != equity ledger”
4. 我们是否同意 V1 先从 `implementation / maintenance / sales referral` 开始
5. 我们是否同意先分池再分人
6. 我们是否同意平台贡献进入 `platform_pool`，而不是全部逐单分配
7. 我们是否同意 AI/automation 默认不作为 payable beneficiary
8. 我们是否同意规则版本默认 non-retroactive
9. 我们是否同意 contributor account 继续保持 self-only、non-payout-console
10. 我们是否同意股权累积必须晚于收入应计和结算提案

## 20. 建议的评审角色

- founder / business owner
- GTM lead
- delivery / customer success lead
- finance / ops reviewer
- legal / compliance reviewer
- system / data governance reviewer

## 21. 修订记录

### V1

- 初版正式提案
- 收口当前定义、对象、状态机、风险、分期与评审问题

### V1 / Review Round 1 aligned

- 吸收首轮评审意见，明确“后台 richer governance / 前台 3-5 概念”的复杂度分层原则
- 明确 Phase 0 必须先做用户调研，而不是直接进入代码开发
- 明确 MVP 产品面先收口为 `ContributionEvent / ValueAccrual / AllocationProposal`
- 保留 richer object model 作为治理预留，而不是在 V1 全量产品化
- 进一步收紧为：正式决议前不开发代码；只要任一核心假设不成立即 `No-Go`；MVP 只允许一条收入线，默认首选 `SALES_REFERRAL`

### Reviewer notes

- reviewer:
- date:
- blocking concerns:
- suggested changes:
- decision:

## 22. 当前一句话结论

Helm 最值得新增的不是 “自动分钱能力”，而是一条可被组织信任的价值治理主线：先让贡献被证据化、价值被应计化、分配被提案化，再让正式结算和股权累积进入可审计、可争议、可修订的治理过程。
