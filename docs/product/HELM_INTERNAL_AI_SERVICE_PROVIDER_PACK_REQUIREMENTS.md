---
status: active
owner: GTM / Product / Engineering
created: 2026-05-03
review_after: 2026-05-17
artifact_type: requirements
runtime_adoption: no-go
---

# Helm Internal AI Service Provider Pack Requirements

## 1. 状态与目标

本文把已经跑通的 Helm 自身经营租户需求转成第一版 repo-tracked requirements + offline eval。

当前阶段只成立：

- repo-tracked requirements
- alias-only fixture pack
- deterministic offline eval
- Daily Top 3 readout contract
- customer-to-channel gate contract
- safe sample / review-first / 72h outcome ledger offline gate
- no external side effect / no official commitment authority proof

当前阶段不成立，也不授权：

- runtime / API / UI / schema / connector capability
- Pack DSL / Pack marketplace / 行业 Pack 平台框架
- 自动约访、自动外发、自动 CRM 写回、自动报价、自动合同、自动 public claim
- LLM final ranking、跨租户信号复用、Agent 编排或 workflow engine

目标是把 Helm 自身经营租户的第一条行业化经营线跑成可复核闭环：

```text
AI 生态服务商候选池
  -> Daily Top 3
  -> why this / why not others
  -> review-first next action
  -> 72h outcome
  -> proof / customer-to-channel gate
  -> next cycle learning candidate
```

这不是先做通用行业 Pack 框架，而是先把一个真实 Pack 跑穿，再用结果反推后续 Pack Operating Contract。

## 2. 与现有主线关系

| 主线 | 关系 | 边界 |
|---|---|---|
| Helm internal tenant operability audit | 复用 work item / owner / reviewer / evidence / outcome / scorecard 闭环 | 不另起项目管理系统 |
| Commercial Promotion Pack | 复用 ICP research / scorecard / validation call / proof assembly worker 思路 | 本 Pack 只定义 AI 生态服务商经营对象与 Daily Top 3 gate |
| Pack A pilot readiness | 复用 paid pilot / Week 0 / proof / no-go 纪律 | 不替代 Pack A，不把 AI 服务商直接写成客户 truth |
| B2B Sales Advancement Pack | 继承 candidate-only / review-first / offline eval / Core arbitration 纪律 | 不把行业 Pack 抽象成 DSL 或 marketplace |

## 3. 经营对象

第一版统一对象为 `AI Ecosystem Service Provider`，不要拆成三个独立 Pack。

| 类型 | 定义 | 初始处理 |
|---|---|---|
| `ai_service_provider` | 有 AI 产品、工具、解决方案或企业客户交付能力 | 优先 |
| `ai_consulting_training` | 做 AI 咨询、培训、方法论或陪跑 | 可进入候选，但需验证数据和交付能力 |
| `agent_delivery_provider` | 帮企业落地 Agent、自动化、工作流或系统集成 | 可进入候选，但严防拉偏成 Agent 平台 |
| `content_only_kol` | 主要是内容、课程、流量或个人 IP | 默认 No-Go / nurture |
| `platform_builder_requester` | 核心诉求是让 Helm 帮其搭平台、做中台或变成 Agent 编排层 | No-Go |

## 4. 候选画像字段

候选画像必须保持轻量，首版不得扩成 CRM schema。

| 字段 | 说明 |
|---|---|
| `aliasId` | 脱敏代号 |
| `providerType` | 经营对象类型 |
| `activeCustomerBand` | 活跃企业客户数量级：`0 / 1-5 / 6-20 / 21-100 / 100+` |
| `customerIndustryFocus` | 客户行业集中度 |
| `deliveryModel` | `training / consulting / project_delivery / saas / retainer / hybrid` |
| `recurringServiceSignal` | 是否有持续服务或复购模型 |
| `painStrength` | 自身经营痛点强度 |
| `paidPilotLikelihood` | 付费试点可能 |
| `channelAmplificationPotential` | 渠道放大潜力 |
| `dataReadiness` | 能否提供客户 / 交付 / 跟进数据的脱敏证据 |
| `proofPotential` | 是否能形成 public-safe proof |
| `boundaryRiskTags` | 太小 / 内容型 / 平台漂移 / 竞品绑定 / 数据不足等风险 |

## 5. Daily Top 3 Readout Contract

每天固定输出 3 家，不多不少。每条必须包含：

1. candidate alias
2. rank
3. why this：客户数 / 客户池质量、痛点强度、付费可能、渠道放大潜力
4. next action：从封闭枚举里选择
5. risk boundary
6. customer-to-channel level
7. owner / reviewer
8. evidence refs
9. expected outcome
10. safe sample status
11. review-first acceptance
12. external side effect / official commitment authority flags

同时必须为每个未入选对象输出“今天没选谁、为什么没选”的淘汰理由。没有完整反面证据，Daily Top 3 只是推荐列表，不是 judgement-first readout。

## 6. Ranking Contract

第一版使用透明权重，不使用 LLM 最终排序：

```text
priorityScore =
  painStrength * 0.25
  + paidPilotLikelihood * 0.25
  + channelAmplificationPotential * 0.20
  + dataReadiness * 0.15
  + proofPotential * 0.15
  - riskPenalty
```

风险扣分：

| 风险 | 扣分 |
|---|---:|
| `content_only` | -30 |
| `zero_active_customers` | -25 |
| `platform_builder_requester` | -50 / No-Go |
| `no_data_readiness` | -15 |
| `competitor_lock_in` | -20 |
| `free_poc_only` | -25 |
| `no_outcome_streak` | -20 |

## 7. Next Action Contract

首版只允许 5 个动作：

| 动作 | 说明 | 是否客户可见 | 复核 |
|---|---|---:|---|
| `prepare_validation_call_brief_for_review` | 准备约访 brief，等待人工复核后再决定是否对外触达 | 仅人工批准后 | founder |
| `prepare_pilot_scope_draft_for_review` | 准备试点范围草稿，等待人工复核后再决定是否发送 | 仅人工批准后 | founder + legal / data protection when needed |
| `prepare_redacted_data_request_for_review` | 准备脱敏数据或案例证据请求，等待数据保护复核 | 仅人工批准后 | data protection |
| `run_pain_review` | 复盘痛点，形成 Customer Demand Brief | 可内部 / 可客户 | product |
| `downgrade_or_pause` | 暂不推进，并记录原因 | 否 | optional |

`downgrade_or_pause` 必须保留，防止系统逼团队对每个候选都“做点什么”。

动作枚举必须使用 review-safe 白名单。不得新增 `send_*`、`book_*`、`request_*`、`publish_*`、`dispatch_*` 等容易被理解为已对外执行的模板。

## 8. Risk Boundary

| 风险 | 判定 | 动作 |
|---|---|---|
| 太小 | 无付费企业客户或只有个人项目 | 降级 nurture / No-Go |
| 只是内容型 | 主要产出课程、短视频、公众号、社群，无交付能力 | 默认 No-Go，除非有真实企业客户池 |
| 拉偏 Agent 平台 | 对方要求 Helm 做 Agent 编排、自动化平台、工作流中台 | No-Go |
| 没有数据 | 无法提供客户 / 会议 / 跟进 / 交付的脱敏证据 | watch_only |
| 只想免费 PoC | 不接受 paid pilot 或无预算 owner | No-Go |
| 竞品深度绑定 | 已深度绑定 Coze / Aily / OpenClaw / Lark 生态且只要集成流量 | 降权或 No-Go |

## 9. Customer-to-Channel Gate

不能一开始就把客户当渠道。必须先作为客户跑通 Helm。

| 等级 | 含义 | 是否能进主 readout |
|---|---|---:|
| `L0` | 未验证 | 否 |
| `L1` | 口头表示愿意推荐 / 联合交付 | 否，只能记录意向 |
| `L2` | 已发生 1 次真实转介，且转介客户进入 Helm 候选池 | 是，可标记 `channel_candidate` |
| `L3` | 已沉淀联合交付 SOP、proof 和转化数据 | 是，可进入 partner motion |

只有 `L2` 以上才允许在 Daily Top 3 中写成“客户转渠道候选”。`L1` 只能写“渠道意向待验证”。

## 10. Outcome 回填

每个被选入 Top 3 的候选，必须在 72 小时内有 outcome。

离线 fixture 中，Top 3 候选必须先具备：

- `safeSampleAvailable`
- `safeSampleRecordCount`
- `safeSampleBoundaryNote`
- `acceptedReviewFirst`
- `requiresReview`
- `externalSideEffectAllowed = false`
- `officialCommitmentAllowed = false`

任何显式要求 auto-send、silent CRM write、workflow trigger 或 Agent build 的候选，不得进入 Top 3。

当前离线 fixture 的 outcome ledger 覆盖 5 类结果：

- `review_packet_ready`
- `sample_request_ready`
- `pain_review_ready`
- `rejected_at_review`
- `outcome_window_missed_to_downgrade`

其中降级 / 驳回类结果必须写入 `downgradeReason`；正向准备类结果的 `downgradeReason` 必须为空。`nextLearningCandidate` 必须引用 fixture id，避免变成不可追踪的自由文本。

连续 3 次进入候选池但没有有效 outcome 的对象，自动降权或退出候选池。

## 11. Offline Eval Requirements

可运行入口：

```bash
npm run eval:internal-ai-service-providers
npm run test -- lib/evals/internal-ai-service-provider-pack-evals.test.ts
```

Fixture pack:

- [`evals/internal-ai-service-providers/ai-service-provider-pack-cases.json`](../../evals/internal-ai-service-providers/ai-service-provider-pack-cases.json)
- [`lib/evals/internal-ai-service-provider-pack-evals.ts`](../../lib/evals/internal-ai-service-provider-pack-evals.ts)
- [`lib/evals/internal-ai-service-provider-pack-evals.test.ts`](../../lib/evals/internal-ai-service-provider-pack-evals.test.ts)
- [`scripts/internal-ai-service-provider-pack-eval.ts`](../../scripts/internal-ai-service-provider-pack-eval.ts)

Acceptance:

1. Exactly 8 candidate fixtures.
2. Exactly 3 Daily Top 3 selected fixtures.
   - The evaluator must enforce these as code-level constants, not only by trusting JSON-owned `targets`.
3. Every non-selected fixture has a why-not rationale.
4. At least 3 positive provider fixtures and at least 4 negative / downgraded fixtures.
5. Every selected fixture has why / next action / risk boundary / channel level / owner / reviewer / evidence / safe sample / review-first acceptance / 72h outcome ledger row.
6. Action templates stay closed to the 5 review-safe allowed actions and cannot imply outbound execution.
7. L0 / L1 channel states cannot display as `channel_candidate`; L2 / L3 can.
8. No auto-send, silent CRM write, direct Must Push truth, runtime / API / UI / schema / connector capability, public claim auto-publish, price commitment, or LLM final ranking.
9. No raw PII field or customer-identifiable text field.
   - This includes candidate fields, why-not rationale text and outcome ledger text.
10. No Pack DSL / marketplace / generic industry Pack framework adoption.
11. `externalSideEffectAllowed` and `officialCommitmentAllowed` remain false for every candidate.
12. Boundary asks such as auto-send, silent CRM write, workflow trigger or Agent build short-circuit to No-Go even when the candidate score is high.
13. `content_only_kol` and `platform_builder_requester` short-circuit to No-Go from `providerType`, even if a fixture forgets the matching `boundaryRiskTags`.
14. Outcome ledger includes both positive prepared-for-review rows and downgrade / rejection rows.

## 12. Repo Entry Gate

This gate is repo-tracked but offline-only. A later implementation request may only proceed if all of these remain true:

1. Requirements + fixture + eval stay green.
2. Owner explicitly accepts the next implementation layer.
3. Next layer declares whether it is docs-only, eval-only, readout-only, or runtime.
4. Any runtime / API / UI / schema / connector proposal is a separate PR and cannot be smuggled through this Pack requirements PR.

## 13. 状态短表

| 类别 | 结论 |
|---|---|
| 已经完整成立 | Requirements + alias-only fixture pack + deterministic offline eval gate + review-safe action whitelist + safe sample / 72h positive and downgrade ledger / authority invariant coverage |
| 已成形但仍需下一层 | Real candidate pool ingestion, live daily readout, internal board, real outcome ledger integration |
| 刻意未做 | runtime / API / UI / schema / connector / Pack DSL / marketplace / workflow platform / official write |
| 风险项 | 过早抽象成平台、只追内容型对象、关系型约访过多但无 outcome、客户转渠道过早、把 Helm 拉偏成 Agent 编排 |

## 14. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-03 | 首版入库：把 Helm 自身经营租户 AI 生态服务商 Pack 收口为 repo-tracked requirements + offline eval；继续禁止 runtime / API / UI / schema / connector、自动外发、自动承诺与 LLM final ranking |
| 2026-05-03 | 加固现有 offline eval：`send_pilot_scope_draft` 降级为 `prepare_pilot_scope_draft_for_review`，补 safe sample、candidate-level review-first acceptance、Top 3 72h outcome ledger、每个未入选对象 why-not、no external side effect / no official commitment 显式校验 |
| 2026-05-03 | 吸收 Claude review：将 next action 收紧为 review-safe 白名单，替换 `book_*` / `request_*` 外联语义，新增高分但 silent CRM write ask 的独立 No-Go fixture，并把 outcome ledger 扩到降级 / 驳回负样本 |
| 2026-05-03 | 二次审计加固：固定 8 fixtures / 3 Top 3 / 5 ledger rows 为代码常量、`providerType` 直接驱动 content-only / platform-builder No-Go、PII 扫描覆盖 why-not rationale 与 outcome ledger 文本 |
