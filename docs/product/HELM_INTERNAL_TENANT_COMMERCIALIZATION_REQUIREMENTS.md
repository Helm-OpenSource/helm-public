---
status: active
owner: GTM / Product / Engineering
created: 2026-05-11
review_after: 2026-05-25
artifact_type: requirements
runtime_adoption: read-only-internal-accepted
---

# Helm 自身租户商业化落地需求

## 1. 结论

现有 Helm 自身租户已经具备两条基础线：

1. [`HELM_INTERNAL_TENANT_OPERABILITY_AUDIT.md`](HELM_INTERNAL_TENANT_OPERABILITY_AUDIT.md) 定义了自身租户作为第一个高要求客户的 work item / owner / reviewer / evidence / outcome / scorecard 闭环。
2. [`HELM_INTERNAL_AI_SERVICE_PROVIDER_PACK_REQUIREMENTS.md`](HELM_INTERNAL_AI_SERVICE_PROVIDER_PACK_REQUIREMENTS.md) 定义了 AI 生态服务商 Daily Top 3 的 alias-only、review-first、deterministic-ranking-first offline contract。

缺口在于：这两条线还没有被收敛成一个可商业化、可交付、可复盘、可持续管理的全过程经营路径。

本需求把 Helm 商业化第一条落地路径固定为：

```text
AI 生态服务商候选池
  -> Daily Top 3
  -> 1 小时 AI 经营诊断
  -> 7 天经营推进试跑
  -> 4 周共创试点
  -> 复盘报告 / proof candidate
  -> customer-to-channel gate
  -> 下一轮经营候选
```

它不是“二三线企业 AI 平台”，也不是“OPC 工具平台”。它是 Helm 自身经营租户里的商业化操作合同：先让 Helm 用 AI 服务商 / AI 咨询培训公司 / Agent 落地服务商作为第一批经营对象，跑出可复核的成交与交付闭环。

本轮澄清后，Helm 自身租户的责任不是只输出 offer path，而是管理这条路径的全过程：

- 管理服务商候选池；
- 管理 Daily Top 3 的选入 / 未选入理由；
- 管理 1 小时诊断是否形成可复核 fit decision；
- 管理 7 天试跑是否每天产出可审阅推进建议；
- 管理 4 周共创试点是否有 Week 0 scope、Week 1 usable output、每周 review 和 stop condition；
- 管理复盘报告、proof candidate 与 claim allowlist / denylist；
- 管理 customer-to-channel gate，而不是把愿意介绍客户的服务商直接升级成渠道。

## 2. 当前需求 Review

| 已有能力 | 当前状态 | 商业化缺口 |
|---|---|---|
| 自身租户 work item contract | 已成形 | 缺和商业化 offer stage 的一一映射 |
| Weekly scorecard template | 已成形 | 缺诊断 / 试跑 / 试点 / 复盘指标 |
| AI 服务商 Daily Top 3 | offline eval 已成立 | 只回答“今天推谁”，还未回答“推到哪个商业包” |
| Commercial Promotion Pack | 已成形 | 偏 founder-led GTM artifact worker，还未封装为客户可理解的服务路径 |
| Pack A / B2B Sales Advancement | 已成形 | 可作为未来客户侧 Pack，但本轮先服务 Helm 自身获客 |
| IGS / business advancement signal | offline gate 充分 | 不授权 runtime、自学习、生产 prompt 或自动写入 |

结论：现有需求方向正确，但商业化实现需要新增一层 `Internal Commercialization Motion Management`。它消费现有 Daily Top 3 输出，并管理从服务商候选到客户转渠道判断的全过程，但不改变现有 Pack 边界。

## 3. 商业化对象

首批经营对象仍沿用 `AI Ecosystem Service Provider`，包括：

| 类型 | 是否优先 | 进入商业化路径条件 |
|---|---:|---|
| AI 服务商 | 是 | 有真实企业客户池、能提供脱敏样本、接受 review-first |
| AI 咨询培训公司 | 是 | 不只是卖课，能进入客户经营问题和交付复盘 |
| Agent 落地服务商 | 条件优先 | 能接受 Helm 不做 Agent 平台、不承诺自动执行 |
| 内容型 KOL | 默认否 | 只有内容和流量，没有企业交付对象时 No-Go |
| 平台搭建诉求方 | No-Go | 如果核心诉求是让 Helm 做 Agent 编排 / 工作流平台，直接降级 |

第一轮商业化不优先直接找泛二三线企业，而是用 AI 服务商作为放大器：他们贴近客户，Helm 提供经营推进控制层和复盘证据。

## 4. 全过程管理对象

Helm 自身租户需要管理的是经营推进过程，不是只管理一组营销素材。最小管理对象如下：

| 对象 | 含义 | 必填字段 | 边界 |
|---|---|---|---|
| `ServiceProviderCandidate` | AI 服务商 / 咨询培训公司 / Agent 落地服务商候选 | `providerAliasId`、来源、类型、客户池质量、痛点强度、付费可能、渠道放大潜力 | 只能 alias-only；不能保存 raw PII |
| `CustomerOpportunityAlias` | 服务商背后的企业客户或机会别名 | `customerOpportunityAliasId`、所属服务商、场景、预算 owner 可见性、数据边界 | Helm 默认不直接触达客户；服务商仍是 customer-facing owner |
| `CommercializationRun` | 一条从候选到复盘的经营推进运行记录 | `runId`、当前状态、下一状态、owner、reviewer、next review-safe action | 不等于 workflow engine；不触发自动执行 |
| `StageReviewPacket` | 每阶段进入下一步前的人工复核包 | 阶段、证据、建议、风险、禁止事项、复核人 | 没有 review 不得客户可见 |
| `OutcomeEvidence` | 诊断、试跑、试点、复盘的证据 | evidence refs、结果窗口、采纳 / 驳回 / 降级记录 | 只沉淀证据，不伪造成承诺 |
| `ChannelGateAssessment` | 客户转渠道判断 | L0-L3、真实转介、联合交付 SOP、proof、转化数据 | 3 个 paid pilot 前不启动认证体系或 partner program |
| `NextCycleDecision` | 下一轮经营候选判断 | continue / revise / stop、原因、下一轮对象 | 不自动生成客户承诺或公开 claim |

“管理”的具体含义：

1. 记录每个对象处于哪个阶段。
2. 记录为什么进入或退出 Daily Top 3。
3. 为每个阶段准备 review packet。
4. 记录 owner / reviewer / evidence / outcome。
5. 记录下一步动作，但动作只能停在 `prepare_*_for_review`。
6. 记录超时和降级原因。
7. 记录服务商是否具备从客户到渠道的后续可能。

“管理”明确不包括：

- 自动约访；
- 自动外发；
- 静默写 CRM；
- 自动报价 / 合同 / 法务确认；
- 触发 workflow；
- 替服务商直接联系其客户；
- 把服务商自动升级成渠道伙伴。

## 5. 生命周期状态机

全过程管理使用一条明确状态机，便于后续 read-only board 或内部运营表实现时不走偏。

```text
candidate_pool
  -> daily_top3_selected
  -> diagnosis_packet_prepared
  -> diagnosis_reviewed
  -> trial_scope_prepared
  -> trial_running
  -> trial_closeout_ready
  -> pilot_scope_prepared
  -> pilot_running
  -> pilot_closeout_ready
  -> closeout_report_prepared
  -> channel_gate_assessed
  -> next_cycle_selected
```

允许的降级 / 暂停路径：

```text
candidate_pool -> paused
daily_top3_selected -> data_boundary_review_required
data_boundary_review_required -> paused
diagnosis_reviewed -> paused
trial_closeout_ready -> paused
pilot_closeout_ready -> paused
channel_gate_assessed -> paused
```

每次状态迁移必须满足：

| 要求 | 说明 |
|---|---|
| 有 owner | 默认 founder，可委派但不能空缺 |
| 有 reviewer | 进入客户可见材料、试跑、试点、复盘、渠道判断前必须有 reviewer |
| 有 evidence refs | 至少一条脱敏证据 |
| 有 review-safe next action | 只能是白名单动作 |
| 有 no-go / pause reason | 降级或暂停必须写原因 |
| 有 stale window | 正向推进项 72 小时内必须复核；4 周试点周节奏单独记录 |

## 6. Offer Path Contract

### 6.1 1 小时 AI 经营诊断

目的：判断客户是否值得进入 7 天试跑，而不是现场卖全功能平台。

输入：

- 候选服务商 alias
- 当前企业客户池质量
- 最明确的经营痛点
- 是否能接触业务 owner / budget owner
- 数据边界和脱敏样本可能性
- 是否接受人工 review 后再对外行动

输出：

- fit decision：`Go / Defer / No-Go`
- 试跑建议场景
- 数据边界草稿
- 不建议做的事项
- 下一个 review-safe action

禁止：

- 承诺“全自动落地”
- 承诺“确定性经营决策”
- 直接给价格或合同承诺
- 自动发送诊断结论给客户

### 6.2 7 天经营推进试跑

目的：用一周证明 Helm 能把 AI 服务商客户池中的机会变成可审阅的每日推进判断。

每日输出：

- 今天最该推进的 3 家服务商 / 客户机会 / 经营事项
- 为什么是它：客户数、痛点强度、付费可能、渠道放大潜力、数据准备度
- 下一步动作：只能来自 review-safe 白名单
- 风险边界：太小、内容型、无数据、平台漂移、只想免费 PoC
- 未入选对象为什么没入选

第 7 天输出：

- 采纳过的建议
- 被复核后降级或驳回的建议
- 是否出现 validation call / paid pilot intent / safe sample
- 是否进入 4 周共创试点

禁止：

- 自动约访
- 自动外发
- 静默写 CRM
- 直接生成 Must Push truth

### 6.3 4 周共创试点

目的：只围绕一个商业闭环跑，不做客户全公司 AI 改造。

Week 0 必须具备：

- 付费试点意向或明确预算 owner
- 数据清单与 DPA / 数据处理边界
- owner / reviewer map
- 成功指标
- stop conditions
- 每周 review cadence

Week 1 验收：

- 客户或服务商看到可用输出
- 至少一个 Daily Top 3 建议进入 review
- 没有 wrong commitment incident

Week 4 输出：

- pilot scorecard
- proof candidate log
- proof claim allowlist / denylist
- 下一轮是否继续、收窄、停止

### 6.4 复盘报告

目的：证明 Helm 帮服务商把 AI 落地变成了经营推进，而不是只做培训或工具搭建。

必须回答：

1. 哪些建议被采纳？
2. 哪些建议被降级或驳回？
3. 哪些客户 / 机会 / 交付事项被推进？
4. 哪些动作不能自动化？
5. 是否达到 customer-to-channel 的 L2 / L3 条件？
6. 哪些 proof 可以公开、半公开或只能内部使用？

没有授权的素材只能是 private proof candidate，不能进入 public claim。

## 7. Review-safe Action 白名单

本轮只允许 5 个动作：

| Action | 含义 |
|---|---|
| `prepare_diagnosis_brief_for_review` | 准备诊断 brief，等人工复核 |
| `prepare_trial_scope_draft_for_review` | 准备 7 天试跑范围草稿，等人工复核 |
| `prepare_pilot_scope_packet_for_review` | 准备 4 周试点 scope packet，等 founder / legal / data protection 复核 |
| `prepare_closeout_report_candidate_for_review` | 准备复盘报告候选，等 claim review |
| `downgrade_or_pause` | 降级或暂停，记录原因 |

不得新增 `send_*`、`book_*`、`publish_*`、`dispatch_*`、`write_*`、`trigger_*`、`request_*` 这类容易被理解为已经对外执行的动作。

## 8. 商业化指标

### 8.1 14 天验证指标

| 指标 | 目标 |
|---|---:|
| AI 服务商 / OPC / 咨询培训对象访谈 | >=20 |
| 有真实企业客户池的候选 | >=5 |
| 完成 1 小时诊断 | >=3 |
| 进入 7 天试跑 | >=2 |
| 出现 >=30k paid pilot intent | >=1 |
| review-first 接受率 | 100% for selected |
| boundary incident | 0 |

### 8.2 7 天试跑指标

| 指标 | 目标 |
|---|---:|
| Daily Top 3 completion | 7/7 |
| 每日 why-not 覆盖 | 100% |
| selected safe sample coverage | 100% |
| reviewed next action coverage | 100% |
| 72h outcome coverage | >=80% |
| wrong commitment incident | 0 |

### 8.3 4 周试点指标

| 指标 | 目标 |
|---|---:|
| Week 0 readiness completeness | 100% |
| Week 1 usable output seen | Yes |
| weekly review completion | 4/4 |
| proof candidate count | >=3 |
| paid pilot closeout decision | continue / revise / stop |
| public claim without approval | 0 |

## 9. Customer-to-channel Gate

不能因为服务商愿意介绍客户，就马上把他写成渠道。

| 等级 | 进入条件 | 商业动作 |
|---|---|---|
| L0 | 未验证 | 只能观察 |
| L1 | 愿意介绍 / 联合交付，但无真实转介 | 只能标记渠道意向 |
| L2 | 至少 1 次真实转介，转介客户进入 Helm 候选池 | 可标记 channel candidate |
| L3 | 有联合交付 SOP、proof、转化数据 | 可进入 partner motion |

Year 1 不启动认证体系、marketplace 或大规模 partner program。3 个 paid pilot 之前，服务商渠道只作为 founder-led direct sales 的放大器。

## 10. Offline Eval

新增离线质量门：

```bash
npm run eval:internal-commercialization
npm run test -- lib/evals/internal-commercialization-evals.test.ts
```

Eval 覆盖：

- 4 个 offer stage 必须齐全：诊断、7 天试跑、4 周试点、复盘报告
- 7 个管理对象必须齐全：服务商候选、客户机会别名、商业化运行记录、阶段复核包、结果证据、渠道门槛评估、下一轮决策
- 生命周期状态机必须包含 candidate pool、Daily Top 3、诊断、试跑、试点、复盘、渠道判断、下一轮和 pause / data boundary review 分支
- 8 条 alias-only commercialization cases
- 至少 4 条正向、4 条 no-go / watch-only
- 正向 case 覆盖 4 个 stage
- 正向 case 必须通过服务商管理客户机会，Helm 不直接越过服务商联系其客户
- 正向 case 必须有 stage review packet、owner、reviewer、evidence 和 72 小时内复核窗口
- 所有输出必须 review-first
- 所有对外动作必须停在 prepare-for-review
- 外部副作用、official commitment、public claim、customer-visible without review、raw PII 全部为 0
- 内容型、平台搭建、只想免费 PoC、无数据样本等风险不能进入正向商业化 stage

## 11. Runtime / API / UI / Schema / Connector Adoption Gate

2026-05-11 owner 已接受把本文升级为最小 runtime 切片，但授权范围只限：

1. `InternalCommercializationRun` 窄表：只保存 alias、lifecycle state、review packet / evidence refs、next review-safe action 和边界 flag；不得关联真实 Contact / Company / Opportunity。
2. internal fixture connector：只把 offline alias-only cases 导入 Helm reserved workspace 的窄表；Web API 只允许 dry-run；显式 apply 只能走 `npm run internal-commercialization:fixture-connector -- --apply`，且必须设置 `HELM_INTERNAL_COMMERCIALIZATION_APPLY=1`，写入内容仅限内部记录和 audit，不产生外部副作用。
3. read-only API：仅供 Helm reserved workspace 读取 lifecycle readout；connector API 只做 dry-run 校验，不提供通用 state advance / workflow trigger。
4. `/operating` read-only lifecycle board：只展示候选池、Daily Top 3、诊断、试跑、试点、复盘和渠道判断，不提供 send / book / publish / dispatch / write / trigger / request 类按钮。
5. offline eval 继续作为 runtime 的前置 guard：`eval:internal-commercialization` 与 `eval:internal-ai-service-providers` 必须持续通过。

仍然不授权：

- 自动约访；
- 自动外发；
- 静默写 CRM；
- 自动报价 / 合同 / 法务确认；
- 替服务商直接联系其客户；
- 通用 workflow / orchestration；
- Agent 平台；
- Pack marketplace；
- LLM final ranking；
- 未经 review 的 public claim。

## 12. 四档状态

| 类别 | 结论 |
|---|---|
| 已经完整成立 | 商业化全过程 requirements、4-stage offer contract、7-object lifecycle management contract、alias-only offline fixture、deterministic eval、review-safe action whitelist |
| 已成形但仍需下一层 | `InternalCommercializationRun` 窄表、internal fixture connector、read-only API、`/operating` read-only lifecycle board、真实候选池 5 日运行、诊断记录、7 天试跑、4 周试点、复盘报告 |
| 刻意未做 | 自动约访、自动外发、CRM 静默写回、自动报价、自动合同、自动 public claim、通用 workflow / orchestration、Agent 平台、认证体系、marketplace |
| 风险项 | 过早做平台、把内容型对象误判成渠道、免费 PoC 消耗 founder 时间、没有数据样本却进入试跑、服务商把 Helm 拉偏成 Agent 编排 |

## 13. 下一步

1. 用 internal fixture connector seed 一版 alias-only lifecycle run，校验 `/operating` read-only board 是否足以支撑 founder 自营节奏。
2. 把真实 AI 服务商候选池转成 alias-only tracker，只保留脱敏 ID、来源和经营信号。
3. 连续 5 个工作日运行 Daily Top 3 + internal commercialization eval。
4. 完成至少 3 次 1 小时 AI 经营诊断。
5. 将 2 个候选推进到 7 天经营推进试跑，并把复盘证据回写到窄表和 offline eval。

## 14. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-11 | 首版：在现有自身租户 AI 服务商 Pack 之上，新增 Helm 商业化落地需求与 `eval:internal-commercialization` offline gate；保持 runtime / API / UI / schema / connector no-go |
| 2026-05-11 | 补充全过程管理澄清：Helm 自身租户需要管理通过服务商推进候选池、Daily Top 3、诊断、试跑、试点、复盘和客户转渠道判断的全生命周期；新增管理对象、状态机、服务商 customer-facing owner 边界和 read-only lifecycle board 前置条件 |
| 2026-05-11 | Owner 接受最小 runtime/API/UI/schema/connector 升级：新增窄表、internal fixture connector、read-only API 与 `/operating` 只读 lifecycle board；full automation、auto-send、silent CRM write、workflow/orchestration、Agent platform 和未经 review 的 public claim 仍为 no-go |
