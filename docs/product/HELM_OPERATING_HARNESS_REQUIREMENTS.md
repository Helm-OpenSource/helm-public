---
status: draft
interface_status: v0.1 unstable; public-safe canonical contract and offline evaluation only
owner: Product / Delivery Engineering / Engineering
created: 2026-07-12
review_after: 2026-07-26
public_safety: Public-safe contracts, adapters, projectors, and synthetic evaluation only. No customer data, production connector, model training, automatic learning, writeback, external send, approval, commitment, or memory promotion.
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
incomplete，不能以 `1.0` 或“通过”代替缺失证据。

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

## English Reference

P0 establishes one public-safe canonical operating-signal chain and makes lifecycle state a
deterministic projection rather than a second source of truth. It reuses existing feedback,
promotion, governance, and held-out evaluation contracts. It does not add a production runtime,
model training, automatic learning, customer data, writeback, external send, approval, commitment,
or memory promotion.

## 变更记录 / Change Log

| Date | Change |
| --- | --- |
| 2026-07-12 | Created P0 canonical spine, derived-state, metric, compatibility, and boundary requirements |
