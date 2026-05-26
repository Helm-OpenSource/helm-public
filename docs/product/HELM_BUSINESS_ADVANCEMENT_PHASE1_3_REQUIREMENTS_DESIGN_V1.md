---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1

更新时间：2026-04-27
状态：Requirements design / conditionally implementation-planning ready after review follow-through
适用范围：Business Advancement Product Phase 1-3

本文件把下一阶段产品能力落地拆成三段连续能力：

1. `Business Advancement Signal Contract`（Phase 1）
2. `Signal -> Must Push Adapter`（Phase 2）
3. `Ask Helm Interaction Asset Capture`（Phase 3）

本文件是产品需求准备与设计细化，不批准 runtime extractor、schema、API、页面行为、official write、自动执行或 LLM final ranking。

评审后结论：允许继续进入实现准备，但实现前必须先完成 Phase 3 privacy / retention、Phase 1-3 dedupe / merge、threshold / capture eligibility 三组 P0 约束；否则不得启动 capture logic、persistence、surface adoption 或 runtime adoption。

---

## 1. 总结论

Business Advancement 的前三阶段必须回答同一条链路上的三个问题：

| Phase | 要回答的问题 | 产品能力 |
| --- | --- | --- |
| Phase 1 | Helm 怎么知道“这可能需要推进”？ | 把会议、CRM、资源、报表、邮件、Ask Helm、用户行为统一成可复核信号 |
| Phase 2 | Helm 怎么判断“今天最该推哪几件”？ | 把多源信号压成 3-5 个 Must Push，并保留证据、边界和承接动作 |
| Phase 3 | Helm 怎么把 Ask Helm 的使用本身变成经营资产？ | 把重复意图、边界触碰、放弃高置信回答等转成 reviewable candidate |

最终闭环仍是：

```text
business inputs
  -> AdvancementSignal
  -> AdvancementJudgement
  -> MustPushItem
  -> ReviewRequiredAction
  -> MemoryCandidate / SkillSuggestion
```

这里的 `candidate` 都是 review-first 的候选，不是 official memory、formal skill、external commitment 或 execution authority。

本版已吸收 2026-04-27 需求评审意见：Phase 3 不再只写 `temporary_review_candidate`，而是必须定义 TTL、删除触发、导出格式；Phase 2 / Phase 3 必须有去重合并策略；LLM 只能提供受限语义因子，不能成为最终排序或升降级裁决者。

---

## 2. Current Repo Truth

### 已经成立

- Phase 1A 已有 `features/business-advancement/contracts.ts`、20 条 fixtures、offline eval 与完成报告。
- Phase 1B 已有 read-model feasibility matrix，当前分类为 6 current / 9 thin / 5 future。
- Phase 2 已有 offline / pure / planning-only `Signal -> Must Push Adapter`，20 个 fixture 生成 14 个 active、6 个 deferred、top 5 Must Push。
- Ask Helm v2 已有 action intent taxonomy、answer / plan / draft / review packet / handoff / voice transcript contract，并保持 read-only / no-write。
- Mobile Command Surface 已把 Ask Helm mobile answer、Must Push、Review / Memory / Operating 承接入口收进 `/mobile`。
- Slice 1 Privacy & Retention Spec 已落库为 [HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1.md)，冻结 TTL、删除触发、redacted export、voice transcript、reviewer capability 和 `workspace_review_visible` 边界。
- Slice 2 Dedupe / Merge Strategy 已落库并通过 planning-only tests / CLI，关闭报告见 [HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md)。
- Slice 3 Threshold & Capture Eligibility 已落库并通过 planning-only tests / CLI，关闭报告见 [HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md)。
- Slice 4 Synthetic Fixtures + Offline Eval 已落库并通过 planning-only tests / CLI，关闭报告见 [HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md)。
- Slice 5 Runtime Adoption Gate 已落库并通过 planning-only tests / CLI，关闭报告见 [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ADOPTION_GATE_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ADOPTION_GATE_REPORT_V1.md)。当前 planning chain complete，runtime adoption 仍 No-Go。
- Phase 1-3 总收口报告已落库：[HELM_BUSINESS_ADVANCEMENT_PHASE1_3_IMPLEMENTATION_CLOSEOUT_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_IMPLEMENTATION_CLOSEOUT_REPORT_V1.md)。

### 仍未成立

- Phase 1 / 2 的结果尚未接入 production read model 或页面行为。
- Business Advancement 已有一组 `Phase 3*` runtime readiness / calibration 文档，但那条是 runtime adoption preflight，不等于本文件定义的 `Product Phase 3: Ask Helm Interaction Asset Capture`。
- Ask Helm interaction 目前不会被持久化为经营资产候选；也没有重复意图、boundary hit、abandoned high-confidence answer 的 reviewable candidate lifecycle。
- 没有 DB-backed queue write、official write、runtime extractor、formal skill auto-promotion 或自动执行。

---

## 3. Phase 1: Business Advancement Signal Contract

### 3.1 目标

Phase 1 的目标是把经营输入统一成 `AdvancementSignal` 和 `AdvancementJudgement`，让 Helm 先有能力解释“为什么这件事可能需要推进”。

Phase 1 不负责排序成最终 Must Push，也不负责页面展示、持久化或执行。

### 3.2 用户场景

| 场景 | 用户问题 | Helm 应形成的信号 |
| --- | --- | --- |
| 会议后承诺未落 owner | “这个会议后谁该跟？” | `blocked_decision` / `overdue_commitment` |
| 客户等待回复 | “客户是不是还在等我们？” | `customer_waiting` |
| 资源接入缺证明 | “为什么不能推进旧系统动作？” | `resource_evidence_gap` |
| 机会长期无人工进展 | “这个机会是不是停了？” | `stalled_opportunity` |
| Ask Helm 多次问同一类问题 | “为什么大家反复问这个？” | `repeated_intent` |
| 用户触碰边界 | “为什么这事不能直接执行？” | `boundary_hit` |

### 3.3 Contract 要求

`AdvancementSignal` 必须至少表达：

- `signalId`
- `workspaceId`（conceptual，仍不代表 schema）
- `sourceType`
- `signalType`
- `objectRef`
- `evidenceRefs`
- `detectedAt`
- `sourceScenario`

`AdvancementJudgement` 必须至少表达：

- `signalId`
- `reviewPosture`
- `riskLevel`
- `confidence`
- `evidenceSummary`
- `boundaryNote`
- `rankingStrategy = deterministic`

禁止：

- 把 signal 写成 task。
- 把 judgement 写成 fact ruling。
- 把 `detectedAt` 写成 persisted event truth。
- 把 LLM judgement 用作最终排序权。
- 把 synthetic fixture 直接当生产数据。

### 3.4 信号来源

Phase 1 允许覆盖以下来源，但每个来源都必须标注 feasibility：

| Source | 第一层允许 | 第一层禁止 |
| --- | --- | --- |
| `meeting` | 承诺、未分派动作、blocked decision | 自动发送纪要或客户回复 |
| `crm` | 机会停滞、客户等待、续费风险 | 自动改 stage / forecast |
| `tenant_resource` | 证据缺口、资源停滞、旧系统前提缺失 | 调旧系统执行 |
| `report` | KPI 异常、趋势复核 | 自动归因或处罚 |
| `email` | 客户等待、未回复升级 | 自动发送邮件 |
| `ask_helm` | repeated intent、boundary hit、abandoned answer | 持久化聊天历史 |
| `user_behavior` | 手动标记、反复查看无动作 | 自动改优先级 |

### 3.5 验收标准

- 20 条 fixture 均有 `sourceType / signalType / reviewPosture / boundaryNote / expectedMustPushTitle`。
- 高风险信号 review coverage = 100%。
- `boundary incident count = 0`。
- 至少 4 类 source 覆盖 meeting / CRM / tenant_resource / Ask Helm。
- 所有 judgement 均为 deterministic ranking，不允许 LLM final ranking。
- 所有 fixture 均为 synthetic，不含真实客户 ID、真实 tenant reserved 信息或跨 workspace 数据。

### 3.6 Phase 1 输出

Phase 1 输出不是页面，不是 DB，不是 API。它只输出：

- conceptual contracts
- fixture pack
- offline eval
- read-model feasibility matrix
- phase report

---

## 4. Phase 2: Signal -> Must Push Adapter

### 4.1 目标

Phase 2 的目标是把 Phase 1 的信号与判断压缩为用户能处理的 `MustPushItem`。

它回答：

```text
今天最该推进哪 3-5 件？
为什么？
证据是什么？
下一步去哪处理？
哪里必须人工复核？
```

Phase 2 仍然不是 runtime adoption，也不是页面接入。

### 4.2 输入

Phase 2 只接受以下输入：

- `AdvancementSignalFixture`
- `AdvancementJudgement`
- `FixtureFeasibilityRow`
- Phase 2B / 2C query review artifact

禁止直接输入：

- production DB row
- raw email / meeting transcript
- runtime extractor output
- unreviewed LLM answer
- cross-workspace object

### 4.3 输出

每个输出必须是二选一：

| 输出 | 含义 |
| --- | --- |
| `active MustPushItem` | 可以进入 planning-only top list |
| `deferred candidate` | 由于 future-only、blocked boundary、feasibility mismatch 或 guard 未解消，不能 active |

`MustPushItem` 必须包含：

- `itemId`
- `title`
- `reason`
- `evidenceRefs`
- `primaryAction`
- `boundaryNote`
- `reviewPosture`
- `sourceSummary`
- `riskLevel`
- `sortKey`

### 4.4 Ranking Contract

排序必须 deterministic。优先级顺序：

1. `riskLevel`
2. `dueAt / overdueDays / staleDays`
3. `customerWaiting`
4. `blockedDecision`
5. `revenueOrRetentionImpact`
6. `evidenceConfidence`
7. `reviewRequired`
8. `updatedAt / fixtureOrder`

LLM 可以参与：

- 解释文案
- evidence 摘要
- reason 压缩
- 将语义线索归一化为有限枚举因子，例如 `customer_waiting_hint`、`urgency_hint`、`stakeholder_escalation_hint`
- 给出置信度建议，但必须被 deterministic threshold clamp 到固定区间

LLM 不允许参与：

- final ranking
- active / deferred 决策
- review posture 升降级
- official write 授权
- 绕过 membership、workspace、capability、privacy 或 boundary guard

允许的 LLM 因子必须满足三条规则：

1. 只能进入 bounded enum / boolean / score bucket，不允许直接写入 `sortKey`。
2. 必须有 deterministic fallback；LLM 不可用时输出仍稳定。
3. 一旦 LLM 因子与 evidence / boundary / review posture 冲突，以 evidence / boundary / review posture 为准。

### 4.5 展示规则

即使 Phase 2 后续进入 UI，也必须遵守：

- 默认首屏最多 4 个 Must Push。
- top list 最多 5 个。
- 第 5 个以后只进 folded summary。
- `blocked` / `future_only` / unresolved guard item 只能 deferred，不能占用 active top list。
- 在 active top list 内，排序仍以 deterministic priority 为准；如果 top 5 全部为 `human_owner_required` 且下方存在可立即 review / prepare 的 active item，可用第 5 位替换为最高优先级可操作 item，并在 folded summary 保留被折叠的高风险说明。
- 高风险 folded item 只能提示“还有高风险项待复核”，不能打断当前最高优先级。
- action 文案只能是查看、准备、复核、分派、确认、解释、打开。
- 不允许出现“执行完成 / 已发送 / 已审批 / 已写回 / 已承诺”。

### 4.6 验收标准

- 20 个 fixture 均被处理为 active 或 deferred。
- `future_only` 不生成 active。
- `blocked` posture 不生成可执行 active。
- top list 在输入顺序打乱后保持稳定。
- 所有 active item 有 evidence、boundary、review posture。
- 所有 high risk item 有 `review_required` 或 `human_owner_required`。
- active count、deferred count、top item count 可由 eval script 输出。

### 4.7 Phase 2 输出

Phase 2 输出：

- planning-only adapter
- deterministic ranking tests
- eval script
- adapter report
- runtime adoption preflight 阻塞清单

Phase 2 不输出：

- page behavior
- production query adoption
- Prisma schema
- API route
- event ingestion
- official write
- automatic execution

---

## 5. Phase 3: Ask Helm Interaction Asset Capture

### 5.1 目标

Phase 3 的目标是把 Ask Helm 使用中暴露的经营意图、边界触碰和未完成推进动作转成 reviewable candidate。

它回答：

```text
用户反复问了什么？
用户在哪些地方想让 Helm 执行但被边界拦住？
哪些高置信回答被放弃，可能代表真实推进缺口？
哪些计划 / 草稿 / handoff 应进入记忆或能力候选？
```

Phase 3 不是聊天历史持久化，也不是 DB-backed queue write。

### 5.2 Capture 触发条件

允许捕获的触发条件：

| Trigger | Asset type | 说明 |
| --- | --- | --- |
| repeated same intent | `repeated_intent_candidate` | 同一 workspace / object / intent 多次出现 |
| review-required execution request | `boundary_hit_candidate` | 用户请求发送、审批、付款、official write，被 review gate 拦住 |
| high-confidence answer not followed | `abandoned_high_confidence_candidate` | 有明确 next step，但用户未进入承接面 |
| plan generated with steps | `plan_followthrough_candidate` | action plan 具备 objectRef / DRI / due |
| draft or review packet prepared | `review_packet_candidate` | 草稿或复核材料可进入审批/经营记忆候选 |
| handoff requested | `handoff_candidate` | 内部 handoff 可进入 operating candidate |

禁止捕获：

- open-domain prompt。
- cross-workspace request。
- raw audio。
- 未确认 voice transcript。
- 包含敏感凭据、密钥、付款信息的原始输入。
- 完整多轮聊天历史。

### 5.3 Interaction Asset Candidate Contract

`AskHelmInteractionAssetCandidate` 是 conceptual planning contract，不是 schema。

必须字段：

- `candidateId`
- `workspaceId`
- `actorScope`
- `sourceTurnRef`
- `intentType`
- `assetType`
- `objectRefs`
- `evidenceRefs`
- `answerSummary`
- `nextStep`
- `boundaryNote`
- `captureReason`
- `reviewPosture`
- `visibility`
- `retentionPosture`
- `promotionTarget`

建议枚举：

```text
assetType:
  repeated_intent_candidate
  boundary_hit_candidate
  abandoned_high_confidence_candidate
  plan_followthrough_candidate
  review_packet_candidate
  handoff_candidate

visibility:
  user_only
  reviewer_only
  workspace_review_visible

retentionPosture:
  not_persisted
  temporary_review_candidate
  promoted_after_review_only

promotionTarget:
  none
  AdvancementSignal
  MemoryCandidate
  SkillSuggestion
  ReviewRequiredAction
```

### 5.4 隐私与治理

默认策略：

- 默认 `visibility = user_only`。
- 默认 `retentionPosture = temporary_review_candidate`。
- 默认 TTL：`user_only` unreviewed candidate 最长 7 个自然日；进入 `reviewer_queued` 后最长 30 个自然日；promoted candidate 只继承目标 review-first 对象生命周期，不继承原始 Ask Helm turn。
- 默认删除触发：用户 dismiss / delete、reviewer dismiss、TTL 到期、workspace/member access revoked、source object deleted or no longer accessible、privacy/export/delete request、cross-workspace 或 open-domain 复核失败。
- 默认导出格式：redacted JSONL / JSON object，字段限于 `candidateId`、`capturedAt`、`assetType`、`intentType`、`objectRefs`、`evidenceRefs`、`captureReason`、`boundaryNote`、`promotionTarget`、`status`、`redactionSummary`；不得导出 raw audio、完整多轮聊天历史、凭据、付款信息或未经确认 transcript。
- 只有 reviewer 明确确认后，才允许进入 `MemoryCandidate` 或 `SkillSuggestion`。
- voice 输入只保存 checked transcript，不保存 raw audio。
- boundary hit 可以用于改进产品和 guard，但不能绕过 guard。

必须保留的边界：

- query 不等于事实。
- answer 不等于 official memory。
- plan 不等于任务 truth。
- draft 不等于 sent。
- handoff 不等于 assigned。
- candidate skill 不等于 formal skill。

`workspace_review_visible` 的可见范围必须先由 capability 证明限定：

- workspace owner / admin 可见。
- 显式 assigned reviewer / operator 可见。
- 普通 workspace member 默认不可见。
- 跨 workspace、Helm reserved tenant 信息和 source object 不可访问时一律不可见。

### 5.5 Ask Helm 到 Business Advancement 的映射

| Ask Helm intent | 是否形成 AdvancementSignal | 默认 promotion target |
| --- | --- | --- |
| `today_priority` | 可形成 | `AdvancementSignal` |
| `why_blocked` | 可形成 | `ReviewRequiredAction` |
| `plan_breakdown` | 可形成 | `MemoryCandidate` |
| `prepare_draft` | 可形成 | `ReviewRequiredAction` |
| `prepare_review_packet` | 可形成 | `ReviewRequiredAction` |
| `queue_internal_followup` | 可形成 | `ReviewRequiredAction` |
| `request_handoff` | 可形成 | `ReviewRequiredAction` |
| `review_required_execution` | 可形成 boundary hit | `ReviewRequiredAction` |
| `unsupported_open_domain` | 不形成 active | `none` |
| `cross_workspace_denied` | 不形成 active | `none` |

### 5.6 Threshold / Capture Eligibility

Phase 3 capture logic 进入实现前，必须采用以下阈值作为默认要求；若后续产品要调整，只能在独立评审中修改本表：

| Trigger | Candidate 阈值 | Watch-only 阈值 | 不允许 |
| --- | --- | --- | --- |
| repeated same intent | 同一 workspace / object / intent 在 rolling 7 days 内出现 3 次 | rolling 7 days 内出现 2 次 | 用跨 workspace 行为凑阈值 |
| boundary hit | review-required execution、official write、send、approve、pay 等请求被 boundary 拦截 1 次即可候选 | 普通 unsupported/open-domain 只做 guard metric | 用 boundary hit 绕过 guard |
| abandoned high-confidence answer | `answerConfidence >= 0.85`，且有 grounded objectRef、action plan、next step；同 session 或 24h 内无打开、保存、handoff、review packet 或 dismiss | tracking 不完整时只做 watch | 把无 telemetry 的沉默当作 abandonment |
| plan / draft / handoff | 用户明确生成、保存、排队或请求 handoff；且步骤含 objectRef / DRI / due | 只查看 answer 或 plan preview | 自动创建 task / commitment / assignment |

`high-confidence` 如无数值字段，只能由 deterministic interpreter 给出 `confidence = high` 且同时满足 objectRef、evidenceRefs、action plan、boundaryNote 四项，不能由 LLM 单独判定。

### 5.7 Phase 1-3 Dedupe / Merge Strategy

为避免 `AdvancementSignal`、`MustPushItem` 与 `AskHelmInteractionAssetCandidate` 重复爆炸，后续实现前必须采用统一折叠规则：

- 生成 conceptual `assetFingerprint = workspaceId + actorScope + intentType + normalizedObjectRef + normalizedCaptureReason + dayBucket`。
- 同一 fingerprint 已存在 active candidate 时，不新增 candidate；只更新 `occurrenceCount`、`lastSeenAt`、`supportingInteractions`。
- Ask Helm candidate 已能映射到现有 `AdvancementSignal` 时，只作为该 signal 的 evidence / supporting interaction，不重复生成新的 active Must Push。
- 同一 `MustPushItem` 已覆盖相同 object / signal / review posture 时，Phase 3 candidate 只能附加为 evidence，不改变 active / deferred 决策。
- boundary hit 的 merge 结果只能增加 review reason 或 product improvement signal，不能提升权限或绕过 guard。
- 首次 evidence、最严格 boundary note、最高 riskLevel、最新 lastSeenAt 必须可复盘；折叠后仍要保留 dismiss / delete / leave unpromoted。

### 5.8 验收标准

- 不持久化多轮聊天历史。
- 不保存 raw audio。
- 未确认 transcript 不进入 candidate。
- cross-workspace / open-domain 不进入 active candidate。
- 所有 candidate 必须有 boundary note。
- 所有 candidate 都能被 dismiss / delete / leave unpromoted。
- promotion 只能进入 review-first candidate，不进入 official write。
- `SkillSuggestion` 不自动晋升 formal skill。
- capture logic 必须满足 5.6 threshold，dedupe 必须满足 5.7 merge strategy。
- `workspace_review_visible` 必须满足 capability 限定后才能启用。

### 5.9 Phase 3 输出

Phase 3 的完整 planning 链路最终应输出：

- Interaction Asset Candidate conceptual contract
- synthetic fixture pack
- offline eval
- review lifecycle design
- closeout report

但在 5.4 / 5.6 / 5.7 三组评审前置 spec 完成前，不得进入 fixture / eval 或 runtime 讨论。前置 spec 关闭后，才可评估：

- read-only surface readout
- per-user candidate review
- MemoryCandidate handoff
- SkillSuggestion evidence pipeline

---

## 6. Cross-Phase Acceptance Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 |
| --- | ---: | ---: | ---: |
| false positive review | 必须可人工标注 | 必须可从 deferred / active 复盘 | 必须可 dismiss |
| review coverage | high risk 100% | high risk 100% | boundary hit 100% |
| deterministic output | 必须 | 必须 | candidate grouping 必须 |
| boundary incident | 0 | 0 | 0 |
| LLM final ranking | 禁止 | 禁止 | 禁止 |
| cross-workspace data | 禁止 | 禁止 | 禁止 |
| auto execution | 禁止 | 禁止 | 禁止 |

---

## 7. Implementation Slices

评审后实施顺序改为先关闭 P0 设计缺口，再进入 fixture / eval。下面的 slice 是顺序依赖，不是并行 backlog。

### Slice 1: Phase 3 Privacy & Retention Spec

目标：冻结 Ask Helm interaction asset 的 privacy、retention、deletion、export、visibility 能力边界。

当前输出：[HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1.md)。

验收：

- 明确 7-day / 30-day / promoted lifecycle 的默认 TTL。
- 明确 dismiss / delete / revoke / source inaccessible / TTL expiry / privacy request 删除触发。
- 明确 redacted export 字段与禁止导出字段。
- 明确 `workspace_review_visible` 的 owner / admin / assigned reviewer 可见范围。
- 不新增 schema、API、runtime persistence 或 UI。

### Slice 2: Phase 1-3 Dedupe / Merge Strategy

目标：冻结 `AdvancementSignal`、`MustPushItem`、`AskHelmInteractionAssetCandidate` 之间的去重、合并、折叠和 evidence 归属。

当前输出：[HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md)。

验收：

- 定义 conceptual fingerprint。
- 明确 repeated intent 不重复生成 active candidate。
- 明确 Ask Helm candidate 如何附加到 existing AdvancementSignal / MustPushItem。
- 明确 boundary hit 只能增加 review reason，不能绕过 guard。
- 不修改 runtime read model 或 production query。

### Slice 3: Phase 3 Threshold & Capture Eligibility Spec

目标：冻结 repeated intent、boundary hit、abandoned high-confidence answer、plan / draft / handoff 的 capture 阈值和拒绝条件。

当前输出：[HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md)。

验收：

- repeated intent 默认 rolling 7 days / 3 occurrences。
- `answerConfidence >= 0.85` 或 deterministic `confidence = high` 的替代条件被写清楚。
- abandonment 必须依赖可观察承接动作缺失；telemetry 不完整时只能 watch-only。
- boundary hit candidate 仍保持 review-required，不进入执行。
- 不新增 capture runtime。

### Slice 4: Synthetic Fixtures + Offline Eval

目标：新增 Ask Helm interaction asset candidate 的 synthetic fixture pack 与 offline evaluator，验证 Slice 1-3 的隐私、阈值、去重、promotion target 和 boundary。

当前输出：[HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md)。

验收：

- repeated intent、boundary hit、abandoned answer、plan / draft / handoff candidate 均有样本。
- cross-workspace、open-domain、unconfirmed transcript、raw audio 均被拒绝。
- dedupe / merge 输出稳定。
- 所有 promotion 只进入 review-first candidate。
- 不接 `/search` UI、不写 queue、不改 schema。

### Slice 5: Runtime Adoption Gate

目标：决定 Phase 1/2/3 是否允许进入真实 read model、surface 或 runtime adoption review。

当前输出：[HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ADOPTION_GATE_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ADOPTION_GATE_REPORT_V1.md)。

当前决策：default gate 为 `No-Go`，positive synthetic fixture 也最多到 `Ready-For-Manual-Review`，不返回 `Go`，不允许 runtime integration 或 production adoption。

验收：

- 必须有 redacted real-data calibration 或明确仍保持 No-Go。
- 必须有 rollback / disable / audit posture。
- 必须证明不会扩大 membership / capability 权限。
- 必须证明 top list actionability 与 high-risk review coverage 同时成立。
- 仍不直接批准 production query、schema、API、page behavior、official write 或 auto execution。

### Deliberately Deferred: Phase 1 Requirements Refresh

目标：Phase 1A / 1B 的 contract、fixtures、feasibility 统一说明仍有价值，但它不再阻塞 Slice 1-3 的 P0 评审吸收。

保持方式：

- 在 Slice 4 fixture / eval 中复用既有 Phase 1A / 1B truth。
- 不把 `AdvancementSignal` 写成 schema。
- 不修改 runtime。

---

## 8. Stop Conditions

出现以下任一情况必须停手：

1. 需要新增 schema 才能解释需求。
2. 需要 runtime extractor 或 event queue 才能完成当前切片。
3. 需要跨 workspace / tenant 聚合。
4. 需要 LLM 做 final ranking 或 active/deferred 决策。
5. 需要把 Ask Helm query 持久化为完整聊天历史。
6. 需要自动创建 task、commitment、approval、official write 或 skill。
7. UI 文案把 recommendation 写成 commitment，draft 写成 sent，proof 写成 official success。
8. `SkillSuggestion` 被写成 formal skill 或 execution authority。
9. boundary hit 被用于绕过 review，而不是进入 review-required candidate。
10. 需要 Phase 3 privacy spec 之前就实现 persistence。
11. 需要 repeated / high-confidence thresholds 之前就实现 capture logic。
12. 需要 dedupe / merge strategy 之前就把 `AdvancementSignal` 与 `InteractionAssetCandidate` 同时接入 active list。
13. 需要在未证明 owner / admin / assigned reviewer capability 前启用 `workspace_review_visible`。
14. 需要把 LLM semantic hint 直接转成 final `sortKey`、active/deferred 或 review posture。

---

## 9. Verification Plan

本文件为需求设计，当前只要求文档级验证：

```bash
git diff --check
npm run self-check
npm run check:boundaries
```

进入 Phase 3 contract / fixture / offline eval 代码后，至少补充：

```bash
npm run typecheck
npm run lint
npm run test -- features/business-advancement/*.test.ts features/search/ask-helm-query-intent.test.ts features/search/ask-helm-interpreter.test.ts
npm run eval:ask-helm
```

进入任何 DB-backed 或页面接入前，必须单独定义：

- isolated MySQL test database
- rollback plan
- disable switch
- membership / capability proof
- audit / deletion posture

---

## 10. 下一步建议

Slice 1 `Phase 3 Privacy & Retention Spec`、Slice 2 `Phase 1-3 Dedupe / Merge Strategy`、Slice 3 `Threshold & Capture Eligibility`、Slice 4 `Synthetic Fixtures + Offline Eval`、Slice 5 `Runtime Adoption Gate`、Ask Helm Interaction redacted calibration contract、redacted real-data calibration package gate、production query adoption plan 与 required reviewer approval protocol 已落库。当前 planning chain complete，但 runtime adoption 仍 No-Go：

1. Redacted calibration contract / evaluator 已成立，但 actual live redacted interaction evidence 尚未提交，不能进入 runtime adoption。
2. Production query adoption 已补齐独立 planning contract 与 required reviewer approval protocol，但真实 approval record 与 actual live evidence 尚未提交，不能进入 runtime adoption。
3. 当前只允许准备并审计真实 redacted interaction snapshot。
4. 如果后续要继续 runtime adoption，必须另开独立 adoption review / implementation plan。
5. 不接 `/search` UI、不写 queue、不改 schema、不接 runtime。

不得在本阶段直接接 production query、schema、API 或 page behavior。

---

## 11. 需求评审意见

**评审日期**: 2026-04-27
**评审结论**: 通过，有条件批准进入实现

### 11.1 评审结论

| 状态 | 说明 |
|------|------|
| **整体** | ✅ 通过 |
| **条件** | 需先完成 Privacy Spec、Thresholds Spec、Slice 1 |

### 11.2 优点

| 方面 | 评价 |
|------|------|
| **边界定义** | 非常清晰 - 明确禁止事项（LLM final ranking、auto execution、cross-workspace data） |
| **分层设计** | Phase 1→2→3 递进合理，每层有明确输入输出 |
| **风险控制** | Stop Conditions 和 Acceptance Metrics 具体可衡量 |
| **已有基础** | 充分利用 Phase 1A/1B/2 的已有成果 |
| **Conservative First** | "不批准 runtime extractor、schema、API" 立场正确 |

### 11.3 需要澄清的问题

**Q1: Phase 3 隐私边界**
```
当前："默认 visibility = user_only，retentionPosture = temporary_review_candidate"
问题：TTL 多少？删除触发条件是什么？export 格式是什么？
建议：在 Slice 4 实现前补充隐私治理 spec
```

**Q2: Phase 2 → Phase 3 数据流**
```
当前：Phase 2 输出 MustPushItem，Phase 3 输出 InteractionAssetCandidate
问题：两者如何协同？是否会重复捕获？
建议：明确 AdvancementSignal 与 InteractionAssetCandidate 的去重/合并策略
```

**Q3: Deterministic Ranking 的现实约束**
```
当前：禁止 LLM final ranking
问题：某些场景（如"这个客户沟通更重要"）需要语义理解
建议：明确哪些场景允许 LLM 作为 ranking factor，而非 final arbiter
```

### 11.4 潜在风险

| 风险 | 影响 | 缓解建议 |
|------|------|----------|
| **Fixture ≠ Production** | offline eval 通过，线上效果未知 | 明确 runtime adoption 的 calibration plan |
| **Phase 3 Privacy** | voice transcript 存储/删除可能合规 | 必须先完成隐私治理 spec 再实现 |
| **Candidate Explosion** | 用户反复问同一问题 → 大量重复 candidate | 明确去重/合并/折叠策略 |
| **Boundary Hit 用途混淆** | 用于产品改进 vs 绕过 guard | 明确两者边界，写入 acceptance criteria |

### 11.5 实现前必须回答的问题

1. **Phase 3 的 "temporary" 是多长时间？** 24h？7天？30天？
2. **Phase 2 的 top 5 如何平衡风险 vs. 可操作性？** 全高风险 vs. 全低风险怎么排？
3. **Ask Helm 的 "repeated intent" 阈值是什么？** 同一问题 2 次？3 次？
4. **Abandoned high-confidence answer 的 "高置信" 阈值是多少？** 0.8？0.9？
5. **Phase 3 Slice 4 的 lifecycle 每个状态的 TTL 是多少？**

### 11.6 下一步行动（按优先级）

1. **P0**: Phase 3 Privacy Spec - 明确 retention/deletion/export
2. **P0**: Phase 3 Thresholds Spec - 明确 repeated/high-confidence 的数值阈值
3. **P0**: Phase 1-3 去重策略 - 明确 AdvancementSignal 与 InteractionAssetCandidate 的关系
4. **P1**: Slice 1 先行 - 先把 Phase 1A/1B 统一成可读 spec

### 11.7 Stop Conditions 补充

在现有 9 条 Stop Conditions 基础上，建议补充：

```
10. 需要 Phase 3 privacy spec (TTL/deletion/export) 才能实现 persistence
11. 需要明确 repeated/high-confidence 阈值才能实现 capture logic
12. 需要 AdvancementSignal 与 InteractionAssetCandidate 的去重策略
```

### 11.8 评审人备注

这是一份高质量的需求设计文档。核心优势是边界清晰、递进合理、风险可控。

实现前的关键路径：
1. Privacy Spec → Phase 3 实现许可
2. Thresholds Spec → Capture logic 实现
3. Slice 1 完成 → Phase 1/2 统一基线

### 11.9 评审意见吸收状态

本版将评审意见转为正式需求约束，具体吸收如下：

| 评审项 | 吸收位置 | 当前状态 |
| --- | --- | --- |
| Phase 3 TTL / deletion / export | 5.4、7 Slice 1、8 Stop Conditions | 已转为 P0 前置条件 |
| Phase 2 / Phase 3 dedupe | 5.7、7 Slice 2、8 Stop Conditions | 已转为 P0 前置条件 |
| LLM 语义因子边界 | 4.4、8 Stop Conditions | 已转为 ranking contract |
| repeated intent 阈值 | 5.6、7 Slice 3 | 默认 rolling 7 days / 3 occurrences |
| high-confidence answer 阈值 | 5.6、7 Slice 3 | 默认 `>= 0.85` 或 deterministic `confidence = high` |
| abandonment 判定 | 5.6 | 必须基于可观察承接动作缺失；telemetry 不完整时 watch-only |
| top 5 风险与可操作性平衡 | 4.5 | active list 内允许第 5 位 actionability guard |
| `workspace_review_visible` 可见范围 | 5.4、7 Slice 1、8 Stop Conditions | 限 owner / admin / assigned reviewer |

因此，本文件的实现许可状态从“直接进入 Phase 3 contract-first”调整为“先完成 Slice 1-3 评审前置 spec，再进入 fixture / eval”。任何 runtime、schema、API、surface adoption 仍然 No-Go。

备注：11.6 / 11.8 保留的是原始评审记录，其中 “Slice 1” 指评审人建议的 Phase 1A / 1B readable spec；本版实施顺序已在第 7 节重排为 privacy、dedupe、threshold 三个 P0 spec 优先，Phase 1 readable spec 降为 deliberately deferred refresh。

### 11.10 二次评审与 Slice 1 进入状态

2026-04-27 二次评审结论为：修订版已充分吸收评审意见，批准进入 Slice 1。

已落实动作：

- Slice 1 Privacy & Retention Spec 已落库：[HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1.md)。
- R2 reviewer 身份定义已在 Slice 1 中关闭：reviewer 是 workspace membership + capability + assignment，不是全局角色或所有 workspace member。
- R1 abandonment 的 `24h` vs `3 business days` 归 Slice 3 Threshold & Capture Eligibility Spec；Slice 1 只规定周末沉默不得自动升级 visibility。
- R3 deterministic confidence fallback 归 Slice 3 Threshold & Capture Eligibility Spec；Slice 1 不定义 confidence algorithm。

当时下一刀：Slice 2 `Phase 1-3 Dedupe / Merge Strategy`。

### 11.11 Slice 2 关闭状态

Slice 2 已完成 planning-only implementation：

- 新增 pure helper / fixtures / evaluator：`features/business-advancement/ask-helm-interaction-dedupe-merge.ts`。
- 新增 14 项 targeted tests：`features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts`。
- 新增 CLI：`scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts`。
- 新增关闭报告：[HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md)。

当时下一刀：Slice 3 `Threshold & Capture Eligibility`。

### 11.12 Slice 3 关闭状态

Slice 3 已完成 planning-only implementation：

- 新增 pure helper / fixtures / evaluator：`features/business-advancement/ask-helm-interaction-capture-thresholds.ts`。
- 新增 19 项 targeted tests：`features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts`。
- 新增 CLI：`scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts`。
- 新增关闭报告：[HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md)。

当时下一刀：Slice 4 `Synthetic Fixtures + Offline Eval`。

### 11.13 Slice 4 关闭状态

Slice 4 已完成 planning-only implementation：

- 新增 pure helper / fixtures / evaluator：`features/business-advancement/ask-helm-interaction-offline-eval.ts`。
- 新增 15 项 targeted tests：`features/business-advancement/ask-helm-interaction-offline-eval.test.ts`。
- 新增 CLI：`scripts/business-advancement-ask-helm-interaction-offline-eval.ts`。
- 新增关闭报告：[HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md)。

当时下一刀：Slice 5 `Runtime Adoption Gate`。

### 11.14 Slice 5 关闭状态

Slice 5 已完成 planning-only implementation：

- 新增 pure gate / review packet helper：`features/business-advancement/ask-helm-interaction-runtime-adoption-gate.ts`。
- 新增 14 项 targeted tests：`features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts`。
- 新增 CLI：`scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts`。
- 新增关闭报告：[HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ADOPTION_GATE_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ADOPTION_GATE_REPORT_V1.md)。

本阶段结论：Ask Helm Interaction Asset Capture planning chain complete；runtime adoption remains No-Go。

### 11.15 Phase 1-3 总收口状态

Business Advancement Phase 1-3 implementation line 已收口：

- 总关闭报告：[HELM_BUSINESS_ADVANCEMENT_PHASE1_3_IMPLEMENTATION_CLOSEOUT_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_IMPLEMENTATION_CLOSEOUT_REPORT_V1.md)。
- Redacted calibration 报告：[HELM_BUSINESS_ADVANCEMENT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_V1.md)。
- 当前已经完整成立：planning chain、privacy / retention、dedupe / merge、threshold / eligibility、synthetic offline eval、runtime adoption gate、redacted calibration contract / evaluator、redacted real-data calibration package gate、production query adoption planning contract、required reviewer approval protocol。
- 当前仍未成立：actual live redacted interaction evidence、真实 reviewer approval record、runtime adoption review、DB-backed queue、API、UI、runtime adapter、production query implementation。
- 当前决策：runtime adoption remains No-Go。
