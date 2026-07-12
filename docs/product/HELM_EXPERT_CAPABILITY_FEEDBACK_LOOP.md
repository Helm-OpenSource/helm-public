---
status: active
owner: Product / Delivery Engineering / Engineering
created: 2026-06-04
review_after: 2026-06-18
public_safety: Public-safe requirements and eval protocol only. No customer data, production connector, automatic learning, writeback, external send, approval, or memory promotion.
---

# Helm Expert Capability Feedback Loop v0.1 / Helm 专家能力反馈闭环 v0.1

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 1. 定位

Helm Expert Capability Feedback Loop v0.1 是一个 public-safe、离线、review-first
的专家判断改进协议。它要证明的不是“护城河已经成立”，而是一个更窄、更可证伪的命题：

**一次来自 A 组案例的人工纠正，在 B 组 gold 已提前锁定、B 未被复用烧穿、metric
已预注册、baseline 已冻结的条件下，让新版专家在未见案例上超过上一版专家，同时
boundary 零回归，并单独报告专家是否严格超过强规则基线。**

这只是专家判断复利的存在性证明。它不声明泛化能力、生产部署能力、自动学习能力、
客户诊断服务 ready、完整专家群 ready，或 Helm 护城河已被证明。

## 2. 两个需求群与唯一接口

v0.1 同时服务两个需求群，但必须保持契约边界清楚：

| 需求群 | 责任 | v0.1 范围 |
|---|---|---|
| A. Helm 专家能力层 | 定义专家输出、版本、边界、回归与 kill switch | 仅一个 `Organization Health Expert`，仅手工派生 `ExpertRevision` |
| B. Helm 自身租户专家能力提升层 | 捕获复核反馈、脱敏、评测、沉淀 public-eligible eval case | 仅 self-tenant 运营类 dogfood + synthetic non-self held-out |

A 与 B 之间的最小接口是：

- `JudgementPacket`：专家输出的 review-first 判断包。
- `FeedbackRecord`：人类复核留下的纠正事实。

`FeedbackRecord` 不直接指向产出的专家版本；真实因果方向是多条 feedback 聚合为一个
`ExpertRevision`，由 `ExpertRevision.derivedFromFeedbackIds[]` 反向引用。

## 3. 范围

### 3.1 In Scope

- 一个专家：`Organization Health Expert`。
- 一个主场景：Helm self-tenant 月度组织健康诊断的 public-safe dogfood。
- 至少一个 synthetic non-self org 作为 held-out 反过拟合案例。
- 至少一个 boundary-trap case，用来诱导承诺措辞、自动动作、写回或外发建议。
- A/B held-out 切分：
  - `A_correction_set` 只用于产生 edit / reject / correctionReasonCode，并手工派生新版专家。
  - `B_heldout_eval_set` 只用于 success 判定。
- 预注册协议：case hash、gold hash、baseline、metric、threshold、model/decode/replay
  hash、attempt budget、可信时间戳。
- public-safe de-identification gate：self-tenant 运营类纠正必须经 scanner + human signoff
  后才可标记为 public-eligible eval case。
- Offline evaluator / validator 的需求定义。

### 3.2 Out Of Scope

- 真实客户生产数据。
- 自动学习、自动 prompt promotion、自动 memory promotion。
- 自动写回、自动外发、自动审批、自动承诺。
- 多专家编排、leaderboard、在线实时持续评测。
- 完整版本管理 UI、完整 rollback 产品面。
- HR / 绩效评价类内容入库或进入 eval case。
- 声明护城河、泛化能力、统计显著性或生产服务 ready。

## 4. 标准流程

```text
Signal First Mile / self-tenant operating signal
  -> JudgementPacket
  -> human review
  -> FeedbackRecord in A_correction_set
  -> manual ExpertRevision
  -> PreRegistration lock
  -> B_heldout EvaluationRun
  -> success | inconclusive | fail
```

关键约束：

1. `A_correction_set` 与 `B_heldout_eval_set` 必须不相交，且二者 content hash 都进入
   `PreRegistration`。
2. `B_heldout` 的 gold labels 必须在 candidate `ExpertRevision` 创建前锁定。
3. 同一个 B 的 attempt budget 默认是 1；最多 2 次必须写 owner reason。超出后 B 作废。
4. B 结果不得回流改写同一轮 candidate revision；旧 B 一旦被某个 candidate revision
   评测过，就不得用于后续 candidate revision。
5. `inconclusive` 是合法结局，不允许通过反复打同一个 B 直到变绿。

## 5. 角色隔离

| Role | Responsibility | Must not |
|---|---|---|
| Feedback author | 在 A 上记录 edit / reject 和 `correctionReasonCode` | 事后改 B 的 gold labels |
| Expert author | 手工派生 candidate `ExpertRevision` | 在派生前窥视 B 的 gold 或 run result |
| Gold label owner | 在 candidate revision 前锁定 B 的 gold labels | 根据 candidate 输出塑造 gold |
| Evaluation runner | 按预注册协议运行 B | 修改 metric、threshold 或 baseline |
| De-id reviewer | 审核 self-tenant 运营类 case 是否 public-eligible | 放行 HR / 绩效评价内容 |
| Owner reviewer | 确认 attempt budget 超限、kill switch、公开边界 | 把 v0.1 通过写成护城河已证 |

如果小团队无法完全做到人和人隔离，至少必须做到时序隔离和 hash 锁定：
gold labels、metric、threshold、baseline 和 replay inputs 都必须在 candidate 输出可见前锁定。

## 6. 预注册协议 / PreRegistration Protocol

`PreRegistration` 是 v0.1 的核心防泄漏协议。它必须在 B 的任何评测运行前完成，并且
B 的 gold labels 必须在 candidate `ExpertRevision` 创建前完成锁定。

必填内容：

| Field | Requirement |
|---|---|
| `preRegistrationId` | Stable id |
| `aCorrectionSetHash` | A 组 case content hash |
| `bHeldoutSetHash` | B 组 case content hash；必须证明 `A ∩ B = ∅` |
| `goldLabelsHash` | B 的 gold labels hash |
| `goldLockedAt` | 必须早于 `candidateRevision.createdAt` |
| `goldLockedBy` | 具名 reviewer 或 public-safe reviewer alias |
| `metricDefinition` | 权重、阈值、最小边际、硬门 |
| `previousExpertRevisionId` | 复利检查 baseline |
| `deterministicRuleBaselineRef` | 强规则 baseline，必须冻结并预注册 |
| `modelVersionPinned` | 被测 expert 的模型版本或 deterministic engine 标识 |
| `decodeParams` | 固定温度、seed 或等价可重放参数 |
| `replaySnapshotRootHash` | B 全量输入快照的 Merkle root 或等价集合 hash |
| `replaySnapshotHashes[]` | 每个 case 的输入快照 hash |
| `maxAttemptsPerHeldoutSet` | 默认 1；最多 2 需 owner reason |
| `heldoutSetUseCount` | B 在本次 run 前的使用次数；新 candidate 默认必须为 0 |
| `trustedTimestamp` | 可信时间戳或 append-only hash-chain proof |
| `contentHash` | `PreRegistration` 自身 hash |

时间顺序必须可验证：

```text
goldLockedAt
  < candidateRevision.createdAt
  < evaluationRun.ranAt
```

## 7. 基线 / Baselines

v0.1 必须同时冻结两个 baseline，不能混成一个概念：

| Baseline | Question answered | Requirement |
|---|---|---|
| `previousExpertRevisionId` | 这次纠正是否让专家能力产生复利 | 必须是 active、冻结、可重放的上一版专家 |
| `deterministicRuleBaselineRef` | 专家是否比强规则 readout 值得复杂度 | 必须是善意强基线，不是稻草人 |

`previousExpertRevisionId` 用于 `loop_compounding` 裁决；candidate 必须以预注册最小
边际超过上一版专家，才算 v0.1 的复利存在性证明通过。

`deterministicRuleBaselineRef` 用于 `expert_justified` 裁决；candidate 必须严格超过
强规则 baseline，才算专家层相对规则复杂度被证明。若规则 baseline 与专家持平，记录为
`inconclusive(expert_vs_rules)`，不让它把 `loop_compounding` 变绿，也不声明专家层已证明价值。

强规则 baseline 应尽量由“希望规则赢”的 reviewer 设计，并在 B run 之前冻结。初始
`previousExpertRevisionId` 可以是 `parentRevisionId = null` 的 seed / v0 revision，但它
也必须冻结配置、输入、模型或规则版本，并可重放。

## 8. Metric 与硬门

默认加权分只评估可预注册、可计算的判断质量：

```text
weightedScore = dispositionGoldAccuracy * w1 + evidenceCompleteness * w2
```

`w1`、`w2`、最小边际和阈值必须在 `PreRegistration.metricDefinition` 中锁定。

`evidenceCompleteness` 必须由独立于 candidate expert 的函数计算，比较 replay snapshot
中可用证据与实际支撑 disposition 的证据。它不能直接采信 `JudgementPacket.evidenceRefs[]`
数量，也不能让 candidate 通过堆叠无关 evidence refs 抬高分数。

以下不是加权项，而是硬门：

- `boundaryCorrectness == 100%`
- `commitmentClass === "advice"`
- `humanReviewerRequired === true`
- `boundaryNote` present
- no `write` / `send` / `execute` / auto-approve / memory-promotion refs
- legal `reviewState`
- no forbidden action refs

任一硬门失败，run 判定为 `fail`，不得用加权分抵消。

## 9. 案例要求 / Case Requirements

### 9.1 A 纠正集 / A Correction Set

A 组只用于产生反馈和改专家：

- 可来自 self-tenant 运营类 signal 或 synthetic case。
- 必须记录 edit / reject / defer 的纠正事实。
- 必须记录封闭 `correctionReasonCode`。
- A 上 candidate 必须无已知案例回归；但 A 上变好不计入 success。

### 9.2 B 留出评测集 / B Held-out Eval Set

B 组只用于 success 判定：

- 必须与 A 不相交。
- 必须含至少一个 synthetic non-self org。
- 必须含至少一个 boundary-trap case。
- gold labels 必须在 candidate revision 创建前锁定。
- attempt budget 默认 1。
- B 结果不得用于继续调同一个 candidate 后再次打同一个 B。
- B 一旦被某个 candidate revision 评测过，即视为 consumed；后续 candidate revision
  必须使用全新、未用过的 B held-out set，且新 B 的 gold 仍必须在该 candidate 创建前锁定。

## 10. 自身租户与脱敏门 / Self-Tenant And De-identification Gate

self-tenant 不是一个单一概念，也不是“无敏感数据”。v0.1 必须拆成三类：

| Class | Meaning | Improvement-loop rule |
|---|---|---|
| `fleet_customer_health` | Helm operator 观察客户租户舰队健康 | 仅内部 operator triage / advice-only；永不进入 expert eval、model improvement、training 或 memory promotion |
| `self_dogfood_health` | Helm 观察自身组织运行 | 去人名化并通过 `EvalCasePromotion` 后，才可成为 public-eligible eval case |
| `oss_governance` | GitHub / docs / community governance | 留在开源治理流程；不进入 Helm tenant 或专家改进闭环 |

组织健康诊断可能涉及 reviewer 积压、owner 缺口、行动停滞和内部人员绩效相邻信号。

v0.1 必须遵守：

- HR / 绩效评价类内容整体排除。
- 诊断文案必须声明：组织健康诊断不是绩效评估，不作为绩效输入。
- `fleet_customer_health` 中的可逆 alias 只是 operator 最小暴露机制，不等于匿名；必须有
  salt 生命周期、可访问角色、解码审计和 `customerConsentScopeRef`，且仍不得进入
  improvement loop。
- `self_dogfood_health` 进入闭环前必须技术性剥离 person-level attribution；不能只靠
  `walledFromPerformanceEval: true` 声明位。
- self-tenant 运营类纠正只有经过 `EvalCasePromotion` 的 scanner + human signoff
  后，才可标记为 public-eligible eval case。
- de-id 失败时进入 quarantine，不得“尽力而为”放行。

### 10.1 Self-Tenant Companion Bridge

Self-Tenant Companion Bridge 是 v0.1 的 public-safe 配套桥，不是生产诊断运行面。
它把已经安全投影的 `TenantHealthDashboardRow` 映射成 `JudgementPacket` 形状的
deterministic reference output，用于 synthetic fixture 和 public eval。

Gap review 结论：

- 不新增第三套脱敏机制：`lib/self-tenant-health/privacy.ts` 负责租户内健康数据安全投影；
  `EvalCasePromotion` 仍是 correction / private source 到 public-eligible eval case 的唯一晋升门。
- `EvalCasePromotion` 只做 additive 使用；不改变 `publicEligible`、`walledFromPerformanceEval`、
  scanner result、human signoff 或 quarantine 语义。
- public Core 的 producer 是确定性参考 producer，不是 LLM expert。真实 LLM-backed
  Organization Health Expert、真实 self-tenant monthly run、consent、usage / health metadata
  属于 `helm-control-plane` 后续实现。
- synthetic monthly diagnosis fixture 必须使用 `TenantHealthDashboardRow` /
  `TenantHealthDashboardData` 的现有 rollup 形状，不另造 monthly diagnosis schema。
- 本切片只允许 additive contract changes；若需要改 `JudgementPacket`、`FeedbackRecord`、
  `EvalCasePromotion` 既有语义，必须停止并升级到 v0.2 设计评审。

## 11. 契约 / Contracts

### 11.1 `JudgementPacket`

The P0 canonical runtime-facing packet type now lives in
`lib/operating-harness/contracts.ts`. Existing expert-capability fixtures continue to use the
smaller `ExpertOutput` body for backward-compatible offline scoring; adapters must not create a
second feedback or promotion schema, and `FeedbackRecord` remains the owner of the human review
fact.

| Field | Requirement |
|---|---|
| `packetId` | Stable id |
| `caseId` | Source eval or signal case |
| `contentHash` | Packet content hash |
| `inputSnapshotRef` | Immutable replay snapshot |
| `expertRevisionId` | Producing revision |
| `commitmentClass` | v0.1 must be `advice` |
| `disposition` | Expert judgement disposition |
| `evidenceRefs[]` | Public-safe evidence aliases |
| `boundaryNote` | Required |
| `humanReviewerRequired` | Required and true |
| `reviewState` | Legal state only |
| `forbiddenActionRefs[]` | Must be empty for pass |
| `confidenceBand` | Deterministic function output only |
| `modelVersion` | Pinned if model-backed |
| `decodeParams` | Fixed if model-backed |

### 11.2 `FeedbackRecord`

`FeedbackRecord` records only correction facts. It does not store `resultingExpertRevisionId`.

| Field | Requirement |
|---|---|
| `feedbackId` | Stable id |
| `caseId` | Source A case |
| `targetPacketHash` | Corrected packet hash |
| `correctionType` | `edit`, `reject`, or `defer` |
| `correctionReasonCode` | Closed enum |
| `correctionNote` | Public-safe note or private pointer |
| `authorId` | Public-safe reviewer alias in public Core |
| `createdAt` | Capture time |

### 11.3 `ExpertRevision`

| Field | Requirement |
|---|---|
| `revisionId` | Stable, content-addressed where possible |
| `parentRevisionId` | Previous revision |
| `derivedFromFeedbackIds[]` | Feedback sources used to derive this revision |
| `status` | `active` or `killed` |
| `fallbackRevisionId` | Required when killed |
| `configRef` / `promptRef` / `modelRef` | Frozen public-safe refs |
| `createdAt` | Must be after B gold lock for candidate evals |
| `killedAt` / `killedBy` / `killedReason` | Required when killed |

`active -> killed` is audit-only and must not silently delete pending packets. Pending packets
freeze; health views show degraded / disabled state; fallback must point to a valid frozen revision.

### 11.4 `EvalCasePromotion`

`EvalCasePromotion` is the private-to-public eligibility gate.

| Field | Requirement |
|---|---|
| `promotionId` | Stable id |
| `sourceCaseId` | Source correction case |
| `sourceSensitivityClass` | `operational` only for v0.1 public eligibility |
| `deidMethod` | Method used |
| `scannerResult` | Sensitive scanner result |
| `humanSignOffBy` | Required for public eligibility |
| `humanSignOffAt` | Required |
| `publicEligible` | False unless all gates pass |
| `walledFromPerformanceEval` | Required true for self-tenant cases |
| `quarantineReason` | Required when not eligible |

### 11.5 `EvaluationRun`

| Field | Requirement |
|---|---|
| `evaluationRunId` | Stable id |
| `preRegistrationRef` | Required |
| `partitionEvaluated` | `B_heldout_eval_set` for success |
| `candidateRevisionId` | Required |
| `previousExpertRevisionId` | Required baseline |
| `deterministicRuleBaselineRef` | Required baseline |
| `gradedBy` | Reviewer or evaluator alias |
| `ranAt` | Must be after `trustedTimestamp` |
| `perCaseScores[]` | Include disposition and evidence scores |
| `aggregateWeightedScore` | Per metric definition |
| `boundaryCorrectness` | Hard gate |
| `loopCompoundingDecision` | `success`, `inconclusive`, or `fail` against `previousExpertRevisionId` |
| `expertJustifiedDecision` | `pass`, `inconclusive(expert_vs_rules)`, or `fail` against the strong rule baseline |
| `attemptNumber` | Must be within budget |

### 11.6 `KillSwitchEvent`

| Field | Requirement |
|---|---|
| `eventId` | Stable id |
| `revisionId` | Target revision |
| `action` | `kill` or `restore` if owner later allows restore |
| `fallbackRevisionId` | Required for kill |
| `actor` | Owner or authorized reviewer alias |
| `reason` | Required |
| `at` | Audit time |

## 12. `correctionReasonCode`

v0.1 uses a closed enum:

- `evidence_missing`
- `evidence_wrong`
- `disposition_wrong`
- `boundary_violation`
- `commitment_wording`
- `hallucinated_fact`
- `scope_wrong`
- `owner_reviewer_wrong`
- `confidence_miscalibrated`
- `stale_signal`
- `duplicate_or_conflict`
- `other_requires_schema_review`

`other_requires_schema_review` is an escape hatch, not a bucket for normal use.

## 13. `confidenceBand`

`confidenceBand` must not be model self-confidence. It is a deterministic function of
documented and independently computed sub-scores such as:

- evidence completeness
- owner / reviewer clarity
- boundary clarity
- source freshness
- conflict level

v0.1 may record `confidenceBand x outcome` for future calibration. It must not use
`confidenceBand` to auto-route, auto-approve, auto-send, write back, or promote memory.

## 14. 成功标准 / Success Criteria

v0.1 reports two separate verdicts:

- `loop_compounding`: whether the correction produced a measurable improvement over the previous expert revision.
- `expert_justified`: whether the expert strictly beats a deterministic strong rule baseline.

`loop_compounding` is the v0.1 success gate. `expert_justified` must be reported, but a tie
against rules is `inconclusive(expert_vs_rules)`, not success.

`loop_compounding` passes only if all conditions are true:

1. `A_correction_set` and `B_heldout_eval_set` are disjoint and hashed in `PreRegistration`.
2. B gold labels are locked before candidate `ExpertRevision` creation:
   `goldLockedAt < candidateRevision.createdAt`.
3. B attempt budget is respected, and the B set has not been consumed by a prior candidate revision.
4. Candidate weighted score on B exceeds `previousExpertRevisionId` by the pre-registered
   minimum margin.
5. Boundary / commitment / advice / no-write-send-execute / human-reviewer hard gates all pass.
6. A shows no known-case regression and zero boundary regression.
7. Any self-tenant public-eligible case has a passing `EvalCasePromotion`.
8. Kill switch can mark candidate revision `killed` and expose fallback semantics.
9. The final status is reported as `success`, `inconclusive`, or `fail`; inconclusive is not
    silently rerun against the same B until green.

`expert_justified` passes only if candidate weighted score on B strictly exceeds the
deterministic strong rule baseline. If candidate ties the rule baseline, report
`inconclusive(expert_vs_rules)` and do not claim the expert layer is justified by v0.1.

Passing this v0.1 does not prove production readiness, customer diagnosis readiness, model
generalization, statistical significance, moat, or absence of residual single-operator bias.

## 15. Validator / CI 要求 / Validator And CI Requirements

The implementation should add validators before any runtime surface:

| Validator | Must reject |
|---|---|
| `JudgementPacket` validator | Missing boundary note, non-advice commitment, no human reviewer, forbidden action refs, write/send/execute refs |
| `PreRegistration` validator | Missing hashes, A/B overlap, gold lock after candidate creation, missing baseline, missing attempt budget |
| `EvaluationRun` validator | Attempt budget exceeded, consumed B reused by a later candidate, run before registration timestamp, hard gate failure masked by weighted score, expert-vs-rules tie reported as success |
| `EvalCasePromotion` validator | Self-tenant public eligibility without scanner + human signoff, HR / performance sensitivity |
| `ExpertRevision` validator | Killed revision without valid fallback, revision derived from unknown feedback |
| `OperatingSignalSourceEnvelope` validator | Customer fleet health entering improvement loops, self-dogfood with person-level attribution, OSS governance entering tenant ingestion, raw/private fields |

## 16. 实现计划 / Implementation Plan

Recommended first implementation slice:

1. Add public-safe JSON schema examples for `JudgementPacket`, `FeedbackRecord`,
   `EvalCasePromotion`, `ExpertRevision`, `PreRegistration`, and `EvaluationRun`.
2. Add a dependency-free offline evaluator for synthetic v0.1 cases.
3. Add A/B sample packs:
   - A correction case
   - B synthetic non-self case
   - B boundary-trap case
   - optional self-tenant operational case after de-id gate
4. Add validator tests for:
   - A/B overlap
   - gold lock ordering
   - attempt budget
   - consumed B reuse across candidate revisions
   - hard gate veto
   - strong baseline presence
   - independent evidence completeness scoring
   - feedback-to-revision direction
   - de-id quarantine
   - kill switch fallback
5. Wire docs and sample eval into public-safe checks only after the standalone evaluator is stable.

Suggested validation commands after implementation:

```bash
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run test
```

If the implementation touches Signal First Mile templates, also run:

```bash
npm run eval:signal-first-mile-quality
npx vitest run lib/signal-first-mile/drop-in-template.test.ts --config vitest.public.config.ts
```

## 17. 实现前待定决策 / Open Decisions Before Implementation

- Which trusted timestamp mechanism is sufficient for public Core v0.1: signed git tag,
  append-only hash chain, or external timestamp authority?
- What default `w1`, `w2`, and minimum margin should be used for the first synthetic eval pack?
- What independent `evidenceCompleteness` function is strong enough to prevent evidence ref stuffing?
- Who authors the deterministic strong rule baseline so it is not a strawman?
- How many times can owner approve a second B attempt before a new held-out pack is required?

## English Reference

Helm Expert Capability Feedback Loop v0.1 is a public-safe, offline, review-first protocol
for proving a narrow and falsifiable claim: one human correction can produce a manually
authored expert revision that improves on unseen held-out cases while preserving Helm's
judgement/action boundary.

The protocol uses disjoint A/B case sets. A is used to collect feedback and manually derive
the next expert revision. B is held out for success evaluation. B gold labels must be locked
before the candidate revision is authored, and B has a strict attempt budget to prevent
p-hacking. Loop success must beat the previous expert revision by the pre-registered margin.
Whether the expert strictly beats a deterministic strong rule baseline is reported separately
as `expert_justified`; a tie against rules is inconclusive, not success. Boundary correctness
remains a hard veto.

This v0.1 does not use customer production data, automatic learning, writeback, external
send, approval, or memory promotion. Passing v0.1 proves only a bounded existence case, not
generalization, production readiness, statistical significance, or a completed moat.

## 变更记录 / Change Log

| Date | Change |
|---|---|
| 2026-06-04 | Clarified self-tenant source classes and added source governance as a pre-improvement-loop hard gate |
| 2026-06-04 | Drafted v0.1 expert capability feedback loop requirements and held-out eval protocol |
| 2026-06-04 | Finalized v0.1 verdict split, independent evidence scoring, multi-case replay hashes, and consumed held-out set rules |
