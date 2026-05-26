---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Value Attribution And Allocation Governance Phase 0 User Research Plan V1

状态：Ready-for-review  
Owner：Helm Core  
日期：2026-04-21  
依赖文档：

- `../product/HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_PRD_V1.md`
- `../product/HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_FORMAL_PROPOSAL_V1.md`
- `../product/HELM_REVENUE_ATTRIBUTION_BASELINE_V1.md`
- `../product/HELM_PARTNER_REGISTRY_BASELINE_V1.md`
- `../product/HELM_CONTRIBUTOR_PORTAL_BASELINE_V1.md`
- `../product/HELM_MANUAL_SETTLEMENT_BASELINE_V1.md`

> 本文档是这条提案在任何 schema、API、页面和实现投入之前的前置验证计划。  
> 它不是实现计划，不代表 current-main 已经开始建设新的 value attribution runtime。

## 1. 目标

Phase 0 只回答一件事：

> Helm 是否真的值得进入 “贡献可见、价值可解释、分配可治理” 这条新主线的 MVP。

这轮验证要避免两个错误：

1. 把真实 GTM / delivery / partner 痛点误判成一个需要大系统解决的问题
2. 把内部治理复杂度直接推给前台用户，导致 Helm 从经营协同产品偏到治理学习产品

## 2. 本轮不做

- 不改 schema
- 不改 API contract
- 不改现有 portal / settlement 行为
- 不做 payout execution
- 不做 equity accrual implementation
- 不做真实 contributor account 页面
- 不做大规模 mock UI
- 不开发任何代码，直到正式决议完成

## 3. 关键假设

1. Helm 仍然首先是 `AI 经营协同 / judgement-first / decision-first` 系统，而不是 finance product
2. 这条线只有在明显增强 GTM 信任、协作预期和外部贡献者稳定性时才值得继续
3. 对大多数贡献者，系统应只暴露 3-5 个前台概念，而不是完整治理对象模型
4. 如果真实用户不接受 `accrual != settlement`，这条线应立即降级或暂停
5. 任何核心假设被证伪，都应直接进入 `No-Go`

## 4. Phase 0 要验证的问题

本轮必须验证 6 个问题：

1. 当前最真实的痛点是什么：
   - 贡献看不见
   - 贡献被看见但分配不透明
   - 分配规则存在，但预期不稳定
   - 争议处理低效
2. 贡献者是否愿意接受：
   - `即时记账（accrual）`
   - `延迟结算（settlement）`
   - `冲销 / 回撤（reversal）`
3. 外部贡献者是否会因为“可见的应计和稳定规则”更愿意长期参与 Helm GTM
4. 用户是否能用极少概念理解这套系统，而不需要学习治理词汇
5. 哪类收益来源证据最完整、争议最少、最适合做 V1
6. 如果这条线不做完整分配系统，只做“贡献证据 + 应计可见 + 分配建议”，是否已经有明显价值

## 5. 验证成功的定义

只有同时满足以下条件，才进入下一阶段：

1. 受访者普遍承认存在明确痛点，而不是“可有可无”
2. 大多数目标贡献者可以准确复述 `accrual` 与 `settlement` 的区别
3. 大多数目标贡献者认为前台只需要少量概念即可，不需要复杂治理术语
4. 至少存在 1 条收益来源，证据链足够清楚，适合做 MVP
5. 争议与治理成本预估没有高到吞掉系统价值

## 6. 样本设计

建议总样本：`8-12` 人。

最小构成：

- 内部 GTM / 销售：`3-4` 人
- 交付 / customer success：`2-3` 人
- 外部合作方 / 转介绍人 / 渠道：`2-3` 人
- founder / finance / ops / legal：`1-2` 人

优先选取以下人群：

- 已经参与过真实成交、交付、续费或转介绍的人
- 对分配、公平、长期合作预期有真实感受的人
- 愿意明确表达反对意见的人

尽量避免只访谈：

- 纯理念认同者
- 从未参与实际收入过程的人
- 只会给“听起来很好”反馈的人

## 7. 研究方法

默认采用：

- `45-60` 分钟半结构化访谈
- 必要时补一轮 `15-20` 分钟 follow-up clarification

每场访谈分为 4 段：

1. 当前真实协作与分配经历
2. 对现有不透明 / 不稳定问题的具体案例
3. 对 Helm 概念稿的反应
4. 对 `accrual -> settlement proposal` 的接受度和担忧

## 8. 访谈中允许展示的概念

Phase 0 默认只展示前台用户可理解的 3 个概念：

- 我的贡献
- 我的应计
- 我的结算

只有在对方主动追问时，才解释后台治理层可能存在：

- 证据链
- 规则版本
- 分配池
- 争议单

不要一开始展示完整 11 对象模型，也不要把治理词汇作为访谈教学重点。

## 9. 建议展示材料

每位受访者建议统一展示 3 份材料：

1. 一页概念图
   - 只画 `贡献 -> 应计 -> 结算建议`
2. 两个真实场景卡片
   - 一个 `sales referral`
   - 一个 `custom implementation / delivery`
3. 一页账户读面草图
   - 只展示金额状态、时间窗口和证据摘要

## 10. 访谈提纲

### 10.1 现状与痛点

1. 你最近一次参与“带来收入”的过程是什么
2. 在那个过程中，你觉得自己的贡献是否被准确看见
3. 哪一部分最不透明：
   - 贡献是否被记住
   - 价值如何被判断
   - 最后怎么分
4. 你是否经历过：
   - 最后一跳独占功劳
   - 协作贡献被忽略
   - 规则临时变动
   - 对未来预期不稳定

### 10.2 对 Helm 方向的反应

5. 如果 Helm 记录每次贡献，并给你一个“应计中的价值账户”，这对你有吸引力吗
6. 哪部分最有价值：
   - 被看见
   - 有规则
   - 可追溯
   - 有稳定预期
7. 哪部分最让你警惕：
   - 太复杂
   - 太像财务系统
   - 太容易引起争议
   - 不信任系统评分

### 10.3 对 `accrual != settlement` 的接受度

8. 如果系统先记账、后结算、允许回撤，你是否能接受
9. 对你来说，什么成熟窗口是可以接受的
10. 什么情况会让你觉得这个系统“不可信”

### 10.4 对 MVP 范围的判断

11. 在这些收益里，你认为哪类最适合先做：
   - `SALES_REFERRAL`
   - `CUSTOM_IMPLEMENTATION`
12. 哪些收益你觉得现在绝对不该纳入
13. 你认为平台 / 品牌 / 自动化这些长期贡献，应该怎么对待

### 10.5 对前台复杂度的判断

14. 如果系统只让你看到 3 个概念，你是否已经足够使用
15. 哪些信息你必须看到，才能形成稳定预期
16. 哪些复杂概念你完全不想学

## 11. 记录模板

每位受访者至少记录：

- `role`
- `revenue exposure`
- `pain summary`
- `trust blockers`
- `acceptance of accrual`
- `required visible fields`
- `preferred revenue types for V1`
- `top objections`
- `quote snippets`
- `researcher judgement`

## 12. 评分框架

每场访谈建议按 `1-5` 分打分：

1. `pain_intensity`
   - 当前问题是否真实、频繁、值得解决
2. `concept_clarity`
   - 是否能在少量解释后理解概念
3. `trust_potential`
   - 是否可能建立稳定预期
4. `operational_friction`
   - 是否担心系统太重、录入太烦
5. `governance_risk`
   - 是否预见争议或套利空间过大

## 13. Go / Revise / No-Go 标准

### Go

满足以下大部分条件：

- `>= 70%` 受访者确认存在真实且高频的“贡献认可 / 分配预期”痛点
- `>= 60%` 受访者明确接受 `即时记账 + 延迟结算 + 可回撤`
- `>= 70%` 受访者认为前台只需要 3 个概念即可
- 至少 `1` 条收益来源被多数人判断为证据清楚、适合 V1
- 研究团队判断争议成本可控，没有高于系统预期价值

### Revise

出现以下情况之一：

- 用户认同问题存在，但觉得当前提案过重
- 大多数人只接受“贡献可见”，不接受更深的分配治理
- 用户只希望先做 internal account visibility，不希望过早触达 settlement logic

这意味着：

- 要继续缩小 MVP
- 可能只保留 `ContributionEvent + ValueAccrual readout`
- 暂不进入 `AllocationProposal`

### No-Go

出现以下情况之一：

- 大多数人认为问题不痛，优先级不高
- 大多数人无法接受 `accrual != settlement`
- 大多数人认为系统引入的争议成本大于分配收益
- 录入 / 证据采集成本高到难以持续
- 没有任何收益来源适合作为低争议 V1
- 任意一个核心假设被明确证伪

## 14. 提前停止条件

在前 `5` 场访谈后，如果已出现以下信号，可提前停下重做方案：

- 只有极少数人认同这是一个真实问题
- 大多数人把这个方向理解成“复杂财务系统”
- 大多数人不能接受回撤 / 观察期
- 大多数人只要口头认可，不愿意为此改变协作方式

## 15. 产出物

Phase 0 结束后至少产出：

1. 访谈 raw notes
2. synthesis memo
3. Go / Revise / No-Go 决议文档
4. 对正式提案的修订建议
5. V1 如果继续推进，明确：
   - 哪 1-2 条收益来源进入 MVP
   - 哪 3 个前台概念进入 MVP
   - 哪些治理对象继续仅作为后台预留

## 16. 建议时间安排

Week 1：

- 确认样本名单
- 准备一页概念图和场景卡
- 完成前 `4-6` 场访谈

Week 2：

- 完成剩余访谈
- 做横向归纳
- 输出决议和提案修订方向

## 17. 主要风险

1. 访谈对象过于同温层，导致结论失真
2. 研究材料暴露过多治理语言，误导用户把问题理解成复杂平台
3. 只访谈内部角色，忽视外部贡献者对长期预期的真实感受
4. 团队带着预设立场做研究，导致结果偏正向

## 18. 下一步决策路径

如果 `Go`：

- 收口 `V1 MVP freeze`
- 只做一条窄收入线，默认首选 `SALES_REFERRAL`
- 只做 3 个前台概念：`我的贡献 / 我的应计 / 我的结算`
- 保留 richer governance 作为后台设计空间

如果 `Revise`：

- 退回正式提案
- 缩窄为 “贡献可见 + 应计可见”
- 暂缓分配提案和争议机制产品化

如果 `No-Go`：

- 当前阶段暂停本主线
- 只保留现有 revenue attribution / partner / settlement baseline
- 不进入 schema 和实现
