---
status: draft
interface_status: v0.1 unstable; public-safe canonical contract and offline evaluation only
owner: Product / Delivery Engineering / Engineering
created: 2026-07-12
review_after: 2026-07-26
public_safety: Public-safe contracts, adapters, projectors, and synthetic evaluation only. No customer data, production connector, model training, automatic learning, writeback, external send, approval, commitment, or memory promotion.
archive_trigger:
  - A successor Operating Harness requirements document is merged, validated, and linked from docs/STATUS.md.
---

# Helm Operating Harness Requirements / Helm 经营智能 Harness 要求

> **语言 / Language**: **中文主文本** + **English reference**

## 1. 定位

Helm Operating Harness 把已经存在的经营信号采集、证据治理、对象关联、专家判断、
人工反馈和离线评测收敛为一个可验证的 public Core 契约。它不是新的模型层、工作流引擎、
自动执行平面或企业世界模型。

P0 只证明两件事：

1. 经营信号只有一条 canonical 对象链，Pack、Overlay 和运行时对象必须通过适配器进入该链。
2. 生命周期状态和产品视图由 canonical 对象确定性派生，不再作为 `SignalEvent` 的第二真相源。

## 2. Canonical 对象链

```text
SignalEvent
  -> EvidenceRef
  -> BusinessObjectAlias
  -> JudgementPacket
  -> FeedbackRecord
  -> EvalCasePromotion
```

约束：

- `SignalEvent` 是不可变观察事实，不包含 `transitionFrom`、`transitionTo`、
  `currentBlockerType` 或其它权威生命周期状态。
- `EvidenceRef` 只保存单租户 scope、public-safe alias、内容绑定 hash、时间、敏感度和使用边界；不保存
  原始证据正文。
- `BusinessObjectAlias` 是单租户、不可跨租户的业务对象引用；它不是客户名称、人员身份或
  可逆客户标识。
- `JudgementPacket` 必须 advice-only、human-review-required、evidence-bound、content-bound。
- `FeedbackRecord` 和 `EvalCasePromotion` 复用 `expert-capability` 已有契约与 validator；
  不创建第二套反馈或脱敏晋升门。

## 3. 派生状态

`OperatingSignalState` 只允许由 projector 根据 canonical 对象是否存在、是否有效以及是否
通过晋升门计算。相同输入必须得到相同状态。任何 legacy event 中携带的 state 字段只能作为
迁移审计信息，不能进入 canonical `SignalEvent`，也不能覆盖 projector 结果。

P0 projector 至少覆盖：

- `MISSING_EVIDENCE`
- `UNRESOLVED_SOURCE`
- `LINKED`
- `REVIEW_PENDING`
- `HUMAN_DECIDED`
- `LEARNING_CANDIDATE`
- `QUARANTINED`

## 4. 七项护城河指标

| Metric | Canonical definition |
| --- | --- |
| `signalRecall` | matched relevant signals / expected relevant signals |
| `precision` | matched relevant signals / accepted signals |
| `evidenceCoverage` | independently supported required evidence / required evidence |
| `reviewerCompleteness` | completed required human reviews / required human reviews |
| `boundaryIncidentCount` | escaped boundary violations only |
| `heldoutLift` | candidate held-out score minus frozen strong baseline score |
| `feedbackToEvalConversionRate` | eligible edit/reject feedback promoted to replayable eval cases / eligible edit/reject feedback |

正确拦截的越界尝试计入辅助指标 `boundaryAttemptCount`，但不计入
`boundaryIncidentCount`。若分母为零或 held-out 分数缺失，指标必须返回 `null` 并标记
incomplete，不能以 `1.0` 或“通过”代替缺失证据。若 boundary observation 为空，
`boundaryIncidentCount` 和 `boundaryAttemptCount` 同样返回 `null`，不能把“未测量”记为零事故。

## 5. Harness 与演化循环边界

P0 不实现 `HarnessManifest` 或运行时；后续版本必须把下列组件保持在任何自我改进循环之外：

- canonical schema 与 validator
- permission / privacy / advice-not-commitment gates
- held-out 数据生成与托管
- metric 定义、阈值与 evaluator
- owner promotion、kill switch 与 rollback gate
- shadow / production write barrier

## 6. 兼容策略

- `operating-signal-flow` 保留为派生流图和兼容输入，不再作为 canonical 事件模型。
- `operating-judgement-fusion` 继续作为确定性 judgement strategy 和强规则 baseline。
- `expert-capability` 继续拥有 feedback、promotion、pre-registration 和 held-out evaluator。
- `company-memory`、`worker-skill-resource` 和 `agentos-decision-supervision` 在后续
  `HarnessManifest` 中通过引用组合，不复制对象。
- Prisma `SignalEvent` 和 `WorldModelSnapshot` 在 P0 不迁移；运行时迁移必须在后续独立
  设计中完成。`WorldModelSnapshot` 只能被重新解释为 derived operating-context snapshot，
  不能作为新的权威状态写路径。

## 7. P0 实现切片

P0 总体只允许 additive changes：

1. canonical TypeScript contracts 与 fail-closed validators；
2. canonical quality metric calculator；
3. deterministic state projector；
4. 一个从 `OperatingSignalFlowEvent` 到 canonical records 的 reference adapter；
5. negative / mutation tests、文档索引和 `docs/STATUS.md` 注册。

P0 按两个原子切片交付：P0a 只落 canonical contracts、validators、synthetic fixtures
与对应公开文档；P0b 再落 state projector、legacy adapter 与七项指标计算。P0a
不得宣称 P0b 能力已成立。P0a 本地运行：

```bash
npm run eval:operating-harness-contracts
```

P0b 使用组合入口重放 contracts、projector、adapter 和 metrics：

```bash
npm run eval:operating-harness-p0
```

明确不做：DB migration、生产 runtime、scheduler、LLM 调用、神经网络、Harness 自动改写、
客户数据、Pack/Overlay 修改、自动对客动作或 memory promotion。

## 8. P0 成功标准

- canonical `SignalEvent` 输入含 legacy state 字段时 fail closed；
- raw/private evidence、无内容 hash 的 evidence、跨租户 alias、非 advice judgement 失败；
- adapter 不复制 legacy state，并要求调用方提供 evidence snapshot hash；
- 相同 canonical chain 重放产生相同 derived state；
- blocked boundary attempt 得到 `attempt=1, incident=0`，escaped violation 得到
  `attempt=1, incident=1`；
- 空分母指标为 incomplete，不产生虚假满分；
- 所有现有 Signal First Mile、Operating Signal Flow、Judgement Fusion 和 Expert
  Capability eval 保持通过。

## 9. P1 Harness Composition And Shadow Evaluation

P1 把已有 Core 能力组合成 content-bound `HarnessManifest`，但不新建第二套
permission、source governance 或 eval framework。`HarnessManifest` 只存组件 ref、revision ref
与 hash，不内嵌 prompt、客户数据、凭据或执行权限。

Protected components 必须在演化循环之外：

- canonical schema、privacy policy、source-governance policy 和 permission policy；
- evaluator、held-out registry 和 owner-promotion gate；
- kill switch 与 memory-governance policy。

Mutable components 只能通过 `HarnessRevision.changes` 显式声明：signal normalizer、object
linker、judgement fusion、expert/context/retrieval policy、skill binding 和 tool binding。调用方
不能自行把 protected component 标成 mutable。

P1 revision 状态只有 `seed | shadow_candidate | killed`，不表达 active 或 auto-promoted。
`shadow_candidate` 必须绑定 parent、fallback 和 rollback manifest；所有 revision 仍然
`ownerReviewRequired: true` 且 `promotionTriggered: false`。
`parentRevisionId=null` 的 seed 是 owner 明确建立并冻结的 trust root；public validator 只能校验其
内容绑定与后续谱系，不能替代 owner 身份、签名或外部 registry 对 seed 真实性的确认。

Shadow evaluator 直接复用 `expert-capability` 的 pre-registration、A/B 隔离、held-out
attempt budget 与 baseline 裁决，并复用 P0 七项指标。任一 source-class gate、protected
component、content binding、boundary、reviewer completeness、held-out lift 或 canonical metric
regression 失败，都必须 fail closed。通过也只产生 owner-review-eligible receipt，不授予
production authority。

P1 receipt 中的七项指标明确标记为 `heldout_corpus_projection`：`precision` 的 accepted
denominator 只计算通过 boundary 且无 hallucinated evidence 的 held-out output；
`reviewerCompleteness` 表示 B 集 gold grading 已完成；`feedbackToEvalConversionRate` 表示已经进入
A-correction replay set 的 edit/reject feedback 完整度。这三者是 eval-corpus 证据，不是生产运营
telemetry，不得用于宣称真实客户环境的七项指标已成立。

```bash
npm run eval:operating-harness-p1
```

P1 仍不是 runtime scheduler、deployment manifest、model router、自动改 prompt、自动发布或客户运行
证明。

## 10. P2 Governed Evolution Loop

P2 证明的不是“系统已经会自我进化”，而是一个更窄、可证伪的离线闭环：已经通过 source
governance 的 shadow evaluation 可以产生封闭类型的 weakness；weakness 可以形成 additive
proposal；proposal 只能物化 mutable component 的下一代 `shadow_candidate`；候选必须在全新 B
集上重新评测；最终只能形成尚未批准的 owner-review packet。

```text
governed shadow input
  -> replayed shadow receipt
  -> closed weakness signals
  -> content-bound additive proposal
  -> mutable-only shadow candidate
  -> fresh held-out B evaluation
  -> owner-review candidate | inconclusive | rejected
```

### 10.1 Weakness 与来源证明

weakness code 固定为七项指标对应的封闭枚举：

- `signal_recall_gap`
- `precision_gap`
- `evidence_coverage_gap`
- `reviewer_completeness_gap`
- `boundary_incident`
- `heldout_lift_gap`
- `feedback_to_eval_conversion_gap`

阈值由 protected `policy:operating-harness-weakness-v1` 固定，proposal 不能修改。每个 weakness
必须绑定 prior shadow receipt、candidate revision、source binding root 和产生 weakness 的旧 held-out
集。content hash 只提供 tamper evidence，不提供真实性；因此 P2 validator 还必须拿到对应
`HarnessWeaknessEvidence`，重新执行旧 shadow input，并要求重放 receipt hash 完全一致。仅提交一份
自洽 JSON receipt 不足以进入 proposal。

客户 fleet 和 OSS governance 仍在现有 source-governance gate 被拒绝。self-dogfood 或
deidentified case 仍必须通过现有 `EvalCasePromotion`。`sourceBindingRootHash` 在 P1 receipt 上仅为
旧 payload 兼容而 optional；P2 消费者必须重放，缺失不能解释为“来源不受约束”。

### 10.2 Proposal 与候选边界

proposal 只能引用 `MUTABLE_HARNESS_COMPONENT_KINDS`，不能修改 canonical schema、privacy、source
governance、permission、evaluator、held-out registry、owner gate、kill switch 或 memory governance。
reviewer completeness 与 feedback-to-eval conversion 属于 `human_operating_process` weakness，不得
伪装成模型或 prompt 修改。

proposal、weakness、parent、fallback 和 rollback manifest 都必须 content-bound。fallback 必须继承
parent 已绑定的最后安全 seed；candidate 不能自行选择另一个 rollback target。时间链必须满足：

```text
weakness detected < proposal created < candidate created
gold locked < candidate created < evaluation run
```

### 10.3 Fresh Held-out 与 Owner Gate

产生 weakness 的旧 B 集从此属于 development evidence。候选评测的 B 集只要 ref 或 content hash
与任一旧集相同，就必须 rejected；换名字不能绕过。fresh receipt 同样由 independent validator
根据绑定的 expert evaluation 与 source inputs 重放，不能靠重新盖 hash 伪造。

通过全部 shadow、rollback 与 fresh-heldout gate 后，结果仍只有
`decision=owner_review_candidate`：

- `owner_gate.passed=false`
- `ownerApprovalRecorded=false`
- `automaticAdoptionAllowed=false`
- `promotionTriggered=false`
- `productionAuthorityGranted=false`

P2 不定义 owner 如何批准或发布，也不提供 production promotion API。P2 运行：

```bash
npm run eval:operating-harness-p2
```

P2 仍不证明模型已变强、线上指标已提升、结论可泛化或企业世界模型已经存在。它只证明一次
weakness 到新 held-out owner-review packet 的 public-safe、offline、replayable 治理链。

## 11. P3 Readiness

P3 不按日期或模型发布节奏启动。机器门必须从完整 evidence window 派生多独立 held-out、稳定 lift、
calibration、evidence、reviewer、boundary、feedback-to-eval、de-identification 和 rollback 指标；当前
public synthetic fixture 固定为 `not_ready`。即使全部阈值达到，也只返回
`ready_for_p3_design_review`，不会记录 owner approval、触发实现或授予 production authority。

Owner 已在 2026-07-12 以范围限定的 override 授权 P3a/P3b/P3d/P3e 建设。implementation
authorization 与 evidence readiness 分离：P3a 可交付 public deterministic read model，P3b/P3d/P3e
可建设 registry、shadow adapter 与 self-dogfood pilot，但 readiness evaluator、隐私门、owner gate、
rollback 和生产权限语义不得因此降级。P3a 当前合同见
[Enterprise Operating Context Model](HELM_ENTERPRISE_OPERATING_CONTEXT_MODEL.md)。

详细阈值、derived operating-context 架构、跨仓职责、实施切片和 abort 条件见
[P3 数据门控升级计划](HELM_OPERATING_HARNESS_P3_DATA_GATED_PLAN.md)。

## English Reference

P0 establishes one public-safe canonical operating-signal chain and makes lifecycle state a
deterministic projection rather than a second source of truth. P1 composes existing Core components
through content-bound manifests and revisions, then reuses the existing pre-registered held-out
evaluator to issue shadow-only receipts. P2 deterministically mines replay-proven weaknesses, limits
proposals to mutable components, requires a fresh held-out set, and stops at an unapproved owner-review
packet. None of these phases adds production runtime authority, model training, automatic learning,
customer data, writeback, external send, approval, commitment, or memory promotion.

## 变更记录 / Change Log

| Date | Change |
| --- | --- |
| 2026-07-12 | Recorded the scoped P3a/P3b/P3d/P3e owner implementation override without changing evidence readiness or production authority |
| 2026-07-12 | Added the machine-checkable P3 data-readiness gate and linked deferred implementation plan |
| 2026-07-12 | Added the P2 replay-proven weakness, additive proposal, fresh-heldout, and owner-review-only evolution loop |
| 2026-07-12 | Added P1 content-bound manifest/revision composition and shadow-only evaluation requirements |
| 2026-07-12 | Added the P0b deterministic state projector, legacy reference adapter, and seven-metric calculator |
| 2026-07-12 | Created P0 canonical spine, derived-state, metric, compatibility, and boundary requirements |
