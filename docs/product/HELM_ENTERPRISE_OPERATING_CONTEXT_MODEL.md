---
status: draft
interface_status: P3a v0.1 unstable; owner-authorized public context contract only
owner: Product / Delivery Engineering / Engineering
created: 2026-07-12
review_after: 2026-07-26
public_safety: Public-safe deterministic read model and synthetic contract evaluation only. No customer data, DB runtime, model call, training, automatic learning, canonical-state authority, writeback, external send, approval, commitment, or memory promotion.
archive_trigger:
  - A successor context-model contract is merged, validated, and linked from docs/STATUS.md.
---

# Enterprise Operating Context Model / 企业经营上下文模型

> **语言 / Language**: **中文主文本** + **English reference**

## 1. 当前裁决

Owner 已授权在 P3 readiness 仍为 `not_ready` 时直接建设 **P3a public context contract**。这是一项
范围有限的实现授权，不改变数据门结论，也不授权 P3b-P3e、生产 runtime、模型调用或客户数据路径。

本切片只证明：同一组已验证的 canonical records、Harness manifest/revision 和 source-policy receipt，
可以稳定派生同一个 content-addressed operating-context snapshot。它不证明真实 held-out lift、模型优势、
客户泛化或 Enterprise World Model 已成立。

## 2. 事实链与派生层

唯一 canonical 链保持不变：

```text
SignalEvent -> EvidenceRef -> BusinessObjectAlias -> JudgementPacket
                                                   -> FeedbackRecord
                                                   -> EvalCasePromotion
```

`TemporalOperatingContextSnapshot` 位于这条链的下游，只是可丢弃、可重放的 read model：

- 不持有 canonical lifecycle state；
- 不覆盖或反写 `SignalEvent`、`BusinessObjectAlias` 或 `JudgementPacket`；
- 不包含原始证据正文；
- 不拥有 write、send、execute、approve 或 memory-promotion 权限；
- 不把 relation、conflict、staleness 或 score 宣称为事实。

## 3. 输入合同

`TemporalOperatingContextProjectionInput` 必须同时绑定：

- 单一 `workspaceAlias`、`tenantScopeRef` 与明确的 `windowStart/windowEnd/asOf`；
- content-bound `HarnessManifest` 与 `HarnessRevision`；
- manifest 中的 `context_policy`、`source_governance_policy` 和 `permission_policy`；
- canonical `SignalEvent`、`EvidenceRef`、`BusinessObjectAlias`、`JudgementPacket`；
- 每个 signal 唯一对应的 governed source binding，以及按来源要求提供的 `EvalCasePromotion`。

任何 cross-tenant、raw/private/person-level、窗口外、孤立引用、evidence-root 替换、重复 ID、killed
revision、fleet customer source 或 OSS governance source 都 fail closed。self-dogfood 和 de-identified
operational source 仍必须先通过既有 promotion gate；P3a 不创建第二套脱敏或晋升机制。

## 4. 输出合同

Snapshot 固定包含：

- manifest、revision、三类 protected policy binding；
- 排序后的 canonical record binding 与 source receipt hash；
- 每个业务对象的 signal/evidence/judgement refs、时间范围、staleness、expired evidence count 和
  judgement conflict readout；
- 三种封闭的确定性 relation；
- replay root hash 与 snapshot content hash。

裸 `validateTemporalOperatingContextSnapshot` 负责结构与可由快照自身判断的自洽性，包括 source
receipt 一一覆盖、summary cardinality、judgement state、staleness、relation endpoint 和 shared-evidence
交集。它不能证明输入真实性；消费者仍必须调用 replay-binding validator，从原始 canonical input
重新生成并逐字节比较 snapshot。自洽 content hash 不是 registry signature。

权限字段不可配置：

```text
derivedOnly = true
canonicalStateAuthority = false
writebackAllowed = false
actionAuthority = none
modelCallsUsed = false
```

## 5. 确定性 Relation

P3a 只允许：

| Relation                   | Derivation                                    | Evidence rule                              |
| -------------------------- | --------------------------------------------- | ------------------------------------------ |
| `shared_evidence`          | 两个对象的 signal 引用同一 `EvidenceRef`      | 只列出交集 evidence 及实际引用它的 signals |
| `shared_source_object`     | 两个 alias 引用同一 safe source-object alias  | 必须保留两侧 signal 与 evidence path       |
| `source_temporal_sequence` | 同一 sourceRef 下相邻 signal 形成有向时间序列 | 必须保留前后 signal、evidence 与有效时间   |

Relation provenance 固定为 `deterministic_rule`。P3a 不输出自报 `high/medium/low`，不生成可用于自动
路由的 confidence score；`confidenceScore` 与 `calibrationRef` 均为 `null`。

## 6. Synthetic Contract Eval

运行：

```bash
npm run eval:operating-harness-p3a-context
```

也可传入 public-safe JSON：

```bash
npm run eval:operating-harness-p3a-context -- /path/to/input.json /path/to/goldens.json
```

默认 fixture 覆盖 account、deal、delivery 三个 synthetic object，以及三类 relation、顺序无关重放、
exact evidence set、reviewer 和 boundary。报告输出 signal recall、precision、evidence coverage、reviewer
completeness、boundary incident count、辅助 boundary attempt count、object coverage、relation
recall/precision。被 validator 正确拦截的输入只增加 attempt，不得记为 escaped incident。

P3a 没有真实 pre-registered held-out window，因此 `heldoutLift` 与
`feedbackToEvalConversionRate` 必须为 `null`；`empiricalGeneralizationProven` 与
`modelAdvantageProven` 必须为 `false`。默认 eval 通过只表示 synthetic contract 与 replay invariant
成立。

## 7. Legacy WorldModelSnapshot

现有 Prisma `WorldModelSnapshot` 不迁移、不成为 P3a 输入或写路径。P3a 仅允许一个 audit-only metadata
adapter：调用方先在私有边界内移除 `summary`、`snapshotJson` 与 person/customer-level 内容，只提交
safe alias、时间和 presence flag。adapter 输出只能是迁移审计结论，不能生成 canonical
record、context snapshot、memory candidate 或 writeback command。

审计回执不回显 workspace/record alias 或时间；它只携带由 safe metadata 计算的
`metadataBindingHash`，并必须通过 input-to-receipt replay validator 才能归属到具体审计输入。该 hash
不是原始 `summary`/`snapshotJson` 的内容 hash，也不能替代私有边界内的访问控制和审计。

## 8. 明确不做

- 不修改 Prisma/schema 或 legacy runtime；
- 不接 DB、connector、真实 self-dogfood 或客户 fleet；
- 不调用 LLM、统计模型或神经网络；
- 不生成 hypothesis、scenario projection 或自动动作；
- 不改变 P3 readiness 的 `not_ready` 结论；
- 不授权 P3b operational registry、P3d model shadow 或 P3e dogfood pilot。

## English Reference

P3a is an owner-authorized public, deterministic operating-context contract built while the separate
P3 data-readiness decision remains `not_ready`. It derives a disposable, content-addressed read model
from validated canonical records, Harness bindings, and governed source receipts. It never becomes
canonical state, calls a model, writes back, or grants action authority. Its synthetic contract eval
proves replay and boundary invariants only; empirical held-out lift, model advantage, customer
generalization, production runtime, and an enterprise world model remain unproven.

## 变更记录 / Change Log

| Date       | Change                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-12 | Hardened binding totality, derived self-consistency, exact relation evidence, timezone ordering, and metadata receipt binding |
| 2026-07-12 | Recorded the limited owner override and implemented the P3a public deterministic context-model contract                       |
