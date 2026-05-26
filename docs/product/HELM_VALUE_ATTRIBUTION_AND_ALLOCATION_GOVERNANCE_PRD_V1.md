---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Value Attribution And Allocation Governance PRD v1

状态：Planning-only  
Owner：Helm Core  
日期：2026-04-21

> 这是一份 repo-aligned 的正式产品文档，用于冻结 Helm 下一阶段在 `contribution -> accrual -> settlement proposal -> equity accrual proposal` 这条线上的产品判断。它定义的是 Helm 应如何把“贡献可见、价值可解释、分配可治理”收成下一条商业主线，不代表 current-main 已经存在新的 schema、runtime contract、payout execution 或 equity issuance flow。

## 1. 一句话定义

Helm 的 Value Attribution And Allocation Governance，是一条建立在现有 `revenue attribution / contributor registry / participant portal / manual settlement` 之上的治理主线：把组织里所有可验证的经营贡献收成统一证据链，形成即时记账的价值累积，并在正式复核后生成可审计的结算与股权累积建议。

## 2. 为什么这是 Helm 当前值得做的下一层

当前 current-main 已经成立：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `revenue attribution`
- `partner registry`
- `participant portal`
- `manual settlement`
- reserved-tenant commercial governance

但当前最关键的商业缺口仍然是：

1. Helm 已能解释收入来自哪里、归给谁、什么可 payable-later，但还不能解释“是谁通过什么贡献把这笔收入推进出来的”。
2. 现有 attribution 更接近静态 beneficiary credit，还不是完整的 contribution evidence chain。
3. 现有 settlement 只能解释“可以如何人工结算”，还不能解释“为什么这个人对这笔价值形成了稳定预期”。
4. 如果 Helm 想把 GTM 做成真正的护城河，它不能只管理对象、动作和记忆，还需要管理“价值如何被看见、被评估、被积累”。

对 Helm 来说，这件事的战略意义不是“做分钱系统”，而是：

- 让 GTM 贡献更透明
- 让协作更有可解释回报
- 让外部贡献者和内部团队都形成稳定预期
- 让 Helm 自己成为 Helm 商业体系的 operating system

## 3. 为什么不能把它直接做成 payout / equity engine

当前不应直接把这条线写成 payout platform 或 equity platform，原因有 6 个：

1. current-main 仍明确保留 `manual settlement remains the fallback source of truth`。
2. 现有 `participant portal` 仍是 self-only earnings portal light，不是 finance console。
3. 营收分配、股权分配、税务处理、法务审批是三种不同边界，不能混成一个“自动分配系统”。
4. GTM 价值分配如果没有 evidence / dispute / reversal / rule versioning，很快会失真。
5. recommendation / commitment 的硬边界在这里更重要，而不是更弱。
6. Helm 当前不是完整 finance platform，也不是完整 HR / equity admin platform。

所以这条线的正确产品定义应该是：

- value attribution
- accrual ledger
- settlement proposal
- equity accrual proposal
- dispute and governance

而不是：

- automatic payout execution
- payroll
- tax / invoice engine
- share issuance automation

## 4. 核心产品判断

### 4.1 “即时分配”在 Helm 中的正确含义

“即时分配”必须被定义为：

- 即时记账（accrual）
- 延迟结算（settlement）
- 显式回撤（reversal）
- 可申诉（dispute）

它不等于：

- 即时打款
- 即时确认最终分配
- 即时股权授予

### 4.2 所有营收都应该进入体系，但不是所有营收都应立即可结算

每笔收入都必须进入这套体系，但只能进入以下三类状态之一：

1. `allocatable`
2. `partially_allocatable`
3. `not_allocatable_yet`

并且必须附带原因：

- evidence missing
- maturity window not met
- refund / reversal window open
- dispute open
- platform pool only

### 4.3 营收分配与股权分配必须是两套 ledger

营收分配和股权价值分配可以共享：

- contribution evidence
- attribution graph
- rule version
- dispute history

但不能共享：

- execution path
- approval threshold
- legal consequence

所以至少要分成：

1. `Revenue Accrual Ledger`
2. `Equity Accrual Ledger`

### 4.4 AI / automation 默认是证据来源，不默认是现金受益人

Helm 当前的 AI workers、automation、template、playbook、workflow 可以成为：

- evidence source
- amplification factor
- reusable asset

但默认不应直接成为 payable beneficiary。

默认 payable beneficiary 仍然应是：

- internal team member
- internal operating role
- external contributor
- partner / referrer / service contributor

## 5. 要解决的核心问题

### 5.1 对内部团队

当多角色一起推进一笔收入时，系统需要回答：

- 谁贡献了什么
- 哪些证据支持这件事
- 为什么不是最后一跳独占
- 哪部分价值已进入应计
- 哪部分仍在观察期

### 5.2 对外部贡献者

当外部伙伴、转介绍人、发布者、培训者、集成商等进入 Helm 体系时，系统需要回答：

- 当前我被记住了哪些贡献
- 当前我累计了多少可解释价值
- 哪些部分已经成熟
- 下一个结算窗口是什么
- 如果我不同意，在哪里申诉

### 5.3 对运营与管理者

当管理者需要做结算、冲销、争议裁定或股权建议时，系统需要回答：

- 当前规则版本是什么
- 当前哪些人因为什么进入 proposal
- 如果发生退款、事故或争议，如何回撤
- 什么是 platform pool，什么是 direct contributor pool

## 6. 贡献者模型

### 6.1 内部贡献者

- founder / owner
- GM / business lead
- sales lead
- SDR
- AE
- partner manager
- GTM operator
- marketing / content / community
- presales / solution consultant
- delivery manager
- implementation consultant
- customer success manager
- support
- trainer
- account manager
- PM
- engineer
- designer
- data / revops
- finance ops
- legal / compliance

### 6.2 外部贡献者

- sales referrer
- channel partner
- system integrator
- consulting partner
- trainer
- content publisher
- co-delivery partner
- case-study / advocacy contributor

### 6.3 非默认 payable 对象

- AI worker
- automation workflow
- shared template / artifact pack
- system-generated recommendation

这些对象默认只形成：

- evidence
- amplification
- platform contribution signal

不默认直接形成 payable beneficiary。

## 7. 贡献项模型

贡献项至少要覆盖 5 类：

### 7.1 Acquisition

- lead sourced
- lead qualified
- campaign converted
- content converted
- event converted
- referral introduced
- partner sourced opportunity

### 7.2 Conversion

- discovery completed
- solution shaped
- proposal advanced
- objection clarified
- contract pushed
- commercial negotiation advanced
- payment collection pushed

### 7.3 Delivery

- implementation milestone reached
- go-live completed
- adoption enabled
- training completed
- acceptance passed
- delivery risk resolved

### 7.4 Retention / Expansion

- renewal saved
- expansion closed
- cross-sell enabled
- churn risk prevented
- refund recovered

### 7.5 Platform / Enablement

- reusable template shipped
- automation workflow built
- playbook published
- conversion-rate improvement landed
- package / pricing refinement landed
- shared asset reused in closed revenue path

## 8. 收益来源模型

当前 schema 已支持：

- `ORGANIZATION_BASE_FEE`
- `ACTIVE_SEAT`
- `ADD_ON_WORKER`
- `CUSTOM_IMPLEMENTATION`
- `CUSTOM_MAINTENANCE`
- `SALES_REFERRAL`

下一层规划应扩到：

- renewal revenue
- expansion revenue
- cross-sell revenue
- training revenue
- managed service revenue
- success-fee revenue
- ecosystem resale revenue
- co-delivery revenue
- content-assisted conversion revenue

每个收益来源必须绑定一份 `Allocation Template`，回答：

- 哪部分可分配
- 分到哪些 pool
- 成熟周期是什么
- 哪些贡献项可以计入
- 什么情况下会回撤

## 9. 评估模型

### 9.1 证据等级

每个 contribution event 都必须有 evidence posture：

- `L0` oral / unverified claim
- `L1` single-side record
- `L2` two-side record
- `L3` system event + business result link
- `L4` auditable closed-loop evidence

### 9.2 贡献评分

默认评分公式：

`Contribution Score = BaseWeight × Impact × EvidenceConfidence × QualityAdjust × CollaborationAdjust × TimeDecay`

解释：

- `BaseWeight`：按贡献项类型给基础权重
- `Impact`：按收入或结果影响调节
- `EvidenceConfidence`：按证据等级映射
- `QualityAdjust`：按结果质量和后续返工/事故调节
- `CollaborationAdjust`：避免最后一跳独占
- `TimeDecay`：控制长尾归因

### 9.3 归因模式

系统必须同时支持：

1. `direct credit`
2. `multi-touch credit`
3. `team / platform pool credit`

不允许所有收入都退化成：

- last-touch only
- manual comment-only attribution

## 10. 分配模型

### 10.1 先分池，再分人

每笔净收入不应直接逐人分配，而应走：

`Revenue Event -> Net Revenue -> Allocation Pools -> Contributor Accrual -> Settlement Proposal`

### 10.2 可分配净收入

净收入至少需要显式扣除：

- tax / mandatory deductions
- payment rail fees
- refunds
- reversals
- pass-through delivery cost
- reserve hold

### 10.3 建议的标准池

- acquisition pool
- conversion pool
- delivery pool
- retention pool
- platform pool
- reserve hold

### 10.4 recurring revenue tail rule

订阅或 recurring 收益不能只按首单分配，需要区分：

- first conversion value
- ongoing retention value
- ongoing delivery value
- platform share

### 10.5 股权累积

股权价值不直接跟每笔现金收入同步兑现，而应进入：

- `Equity Accrual Ledger`
- `Equity Proposal Window`

按季度 / 半年进入：

- recommendation
- review
- board / founder approval

## 11. 状态机

### 11.1 Contribution Event

- `observed`
- `verified`
- `rejected`
- `linked`
- `disputed`

### 11.2 Revenue Accrual

- `pending`
- `matured`
- `settlement_proposed`
- `settled`
- `reversed`
- `disputed`

### 11.3 Equity Accrual

- `pending`
- `vesting_candidate`
- `proposal_ready`
- `approved_for_grant`
- `rejected`
- `superseded`

### 11.4 Dispute

- `open`
- `under_review`
- `resolved_keep`
- `resolved_adjust`
- `resolved_reverse`

## 12. 需要新增的核心对象

当前下一层至少需要 planning-only 冻结以下对象：

- `ContributionEvent`
- `ContributionEvidenceRef`
- `AttributionGraphEdge`
- `AllocationTemplate`
- `AllocationPoolTemplate`
- `RevenueAccrualLedger`
- `EquityAccrualLedger`
- `AllocationProposal`
- `EquityAccrualProposal`
- `DisputeCase`
- `RuleVersion`
- `PolicyAudit`

这些对象当前都不应被写成 current-main 已成立。

## 13. Helm 内的产品面

### 13.1 Internal operator surface

在 reserved tenant 的 settings / governance 下新增：

- allocation policy
- pool templates
- maturity windows
- reversal watchpoints
- dispute queue
- simulator
- audit export

### 13.2 Contributor account surface

在现有 participant portal 之外，逐步演进出：

- my contribution evidence
- my pending accrual
- my matured accrual
- my settled history
- my reversed / disputed items
- next settlement window
- current rule version

它应继续保持：

- self-only
- review-first
- no payout execution
- no finance console

### 13.3 Management readout

在 internal operating / reporting 中增加：

- value creation by role
- value creation by channel
- value creation by pool
- reversal pressure
- dispute pressure
- platform pool effectiveness

## 14. 与 current-main 的关系

这条线应明确建立在当前已存在对象之上：

- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`
- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `ParticipantPortalAccess`
- `SettlementBatch`
- `SettlementBatchLine`

当前这些对象已经回答：

- 收益从哪里来
- 归给哪类 beneficiary
- 什么可 payable-later
- 什么进入 manual settlement

下一层要补的是：

- 谁贡献了这笔价值
- 哪些证据支持这件事
- 这份价值如何进入应计
- 为什么这个人可以形成稳定预期

## 15. 刻意未做

以下能力在当前规划中刻意未做：

- automatic payout execution
- bank / wallet transfer
- tax / invoice engine
- payroll
- automatic equity issuance
- public marketplace leaderboard
- public partner discovery
- compensation replacement system
- full finance console
- broader HR admin platform

## 16. Preserved boundaries

以下边界必须继续冻结：

- recommendation != commitment
- accrual != settlement
- settlement proposal != actual payout
- equity accrual proposal != equity grant
- participant portal remains self-only
- manual settlement remains fallback source of truth
- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no second app tree
- no shell thinning
- no send authority
- no broad auto-write
- no finance platform overclaim

## 17. 分期建议

### Phase 0

- 冻结 PRD
- 冻结对象与状态机
- 冻结边界与非目标

### Phase 1

- 在现有 attribution / payout ledger 上补 `ContributionEvent`
- 建立 evidence chain
- 建立 rule versioning

### Phase 2

- 建立 `Revenue Accrual Ledger`
- 建立 contributor account readout
- 只显示 pending / matured / reversed / disputed

### Phase 3

- 建立 allocation proposal
- 建立 dispute case
- 建立 simulator / replay

### Phase 4

- 让 internal settlement 使用 allocation proposal 作为输入之一
- 保持 manual settlement fallback

### Phase 5

- 建立 equity accrual proposal
- 单独进入 founder / legal / board review

## 18. 成功定义

这条线只有在以下条件同时成立时，才算进入下一阶段：

1. 每类收益来源都有明确 allocation template
2. 每份 contributor accrual 都能回溯到 evidence chain
3. reversal / dispute / maturity window 可解释
4. contributor account 不被误解为 payout console
5. current-main 没有被写成 finance platform 或 equity admin platform

## 19. 当前基线一句话

Helm 下一阶段最值得做的，不是把结算自动化，而是把贡献、价值、分配和治理收成同一条可解释主线：先让价值被看见、被应计、被提案化，再决定什么值得进入正式结算与股权累积。
