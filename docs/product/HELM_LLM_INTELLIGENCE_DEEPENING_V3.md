---
status: active
owner: helm-core
created: 2026-07-12
review_after: 2026-08-12
public_safety: Public-safe requirements, contracts, guards, and synthetic eval plan only. Do not add real context bundles, customer signals, source text, schema dumps, prompt run receipts, credentials, tenant URLs, overlay drafts, or deployment evidence.
---
# Helm LLM Intelligence Deepening v3

> 语言 / Language：中文（权威版） · English reference follows.

v3 的目标不是放松 Helm 的边界，而是修正“弱模型时代”的过度约束：
LLM 不再只做解释、复核或 proof summary，而是在安全 harness 内承担更强的
经营判断候选生成、source-to-signal 推理、反事实推演、长任务轨迹复核和多角色协作。

本文件是 public-safe 需求与实施计划，不是 runtime ready 声明、商业发布批准、
生产 SLA、客户部署证明或外部模型背书。

## 保留的硬边界

- recommendation 不等于 commitment。
- LLM 不自动外发、写回、审批、激活 connector、执行 `runCrmImport`、写
  `MemoryPromotion`、`PreferenceSignal`、`PatternFact` 或 `RecommendationFeedback`。
- `helm-public` 只放 contracts、guards、synthetic fixtures、eval 和公开文档。
  真实 rich context builder、客户源码 / schema / API 读取、overlay draft 留在
  `helm-overlays` 或用户本地环境。
- 任何 provider failure、parse failure、schema failure、egress failure、profile mismatch
  都 fail closed 到 `review_required` 或 `quarantine`。

## v3 改掉的旧假设

- 不再默认“LLM 只能 reviewer”。LLM 可以生成候选判断、候选映射、缺口、反证和安全下一步。
- 不再用最小 context 饿死本地模型。远程 provider 仍只接收 redacted projection；
  本地 / 客户侧 agent 可以在私有边界内使用 rich context。
- 不再把 prompt 当治理边界。治理边界由 typed policy、capability profile、egress guard、
  trajectory receipt 和 eval gate 承担。
- 不再只用小型 synthetic proof 证明 agent 没越权。v3 要评估长任务轨迹：plan、context
  selection、tool calls、model calls、file / diff summary、validation receipts、blocked actions、
  boundary decisions 和 final claim。

## 新增能力

### Model Capability Profile

`ModelCapabilityProfile` 描述模型可用能力：`contextMode`、`providerMode`、
`reasoningDepth`、`toolCoordination`、`multiPassAllowed`、`remoteEgressPolicy`、
`budgetClass`、`allowedWorkflowClasses`。未注册模型 / 未知 profile 默认保守：
只能走 `disabled_deterministic` 或 `remote_projected_review_required`，不得自动获得
rich context 或任何副作用能力。

GPT-5.6、Fable 5 等模型名称只可作为外部能力信号的示例，不得写成 hard-coded 默认。

### Dual Context Architecture

保留 v2 的 `SelectedContextStub` 作为远程 provider 最小输入。新增
`RichLocalContextBundle` 与 `ContextProjectionReceipt`：本地或客户侧 agent 可使用更丰富
私有上下文，但只能投影成 redacted stub、candidate bundle 或 receipt。

rich local context 不得进入 remote prompt。remote prompt 只接收 redacted projection。

### Generative Judgement And Source-To-Signal Proposer

LLM 可生成 `JudgementProposalBundle`：经营判断候选、证据引用、缺口、反证、置信度、
建议下一步、禁止 capability 声明。

LLM 可生成 `SourceToSignalProposalBundle`：源码 / DB schema / API 文档到 Helm 经营信号的
候选映射。

所有输出只能是 `candidate | needs_review | rejected_by_guard`。

公开参考实现已经把 Source Profiler 的 SQL / Prisma / OpenAPI / catalog summary
确定性扫描接到同一生产 proposer：完整 ReviewPacket 留在本地，provider 只接收脱敏投影，
provider 响应整批 strict 校验，未知 evidence ref、混合坏项、schema / parse / profile / consent
失败均不产出 proposal。该路径证明 wiring、grounding 与 boundary，不代表任意 live model 的
语义质量或客户 connector 已成立。

### Trajectory Harness

`LLMTaskTrajectoryReceipt` 记录 public-safe 的长任务摘要：plan、context selection、tool calls、
model calls、file / diff summary、validation receipts、blocked actions、boundary decisions、
final claim。receipt 不保存 raw prompt、raw customer data、secret、tenant URL、生产回执或
客户部署证据。

deterministic trajectory eval 必须覆盖目标漂移、自证放水、绿色检查过度声明、未读先改、
未验证宣称完成、私有数据泄漏、候选自动晋级和外部副作用尝试。

### Multi-Pass Review Harness

高价值 / 高不确定任务采用 generator → critic → adversary → deterministic arbiter。
LLM 角色可以提出候选、反证和替代解释；最终路由仍由 deterministic arbiter 产出
`allow_candidate | review_required | reject | quarantine`。

### Risk / Value Adaptive Reasoning Budget

reasoning budget 按 `businessValue`、`uncertainty`、`riskClass`、
`evidenceCompleteness` 选择。低风险低价值走 deterministic / economy；高价值高不确定允许
deep / multi-pass；高风险副作用仍只允许候选和人审，不因模型更强而放权。

## 实施切片

1. v3 requirements only：本文档、docs index、manifest、STATUS。
2. Model profile + dual context contracts：zod contract、projection、guard。
3. Trajectory harness v1：public-safe receipt、deterministic negative eval。
4. Generative proposer contracts：judgement proposer 与 source-to-signal proposer。
5. Multi-pass reviewer workflow：generator / critic / adversary / arbiter fail-closed。
6. Adaptive budget resolver：value / risk / uncertainty driven reasoning depth。

## 当前参考实现状态

- 已成立：strict model profile、dual-context projection、trajectory receipt + SARP、
  judgement / source-to-signal contracts、Source Profiler grounded proposer、
  generator / critic / adversary + deterministic arbiter、adaptive budget 接入既有
  prompt-version / rate-limit / spend / call-log 链。
- 已成形但仍需下一层：当前 workflow 是 public-safe reference harness；remote live-model
  quality 仍需可选 live eval，trajectory 仍是摘要 receipt，尚无签名遥测绑定。
- 刻意未做：客户真实 rich-context builder（属于 overlay）、生产多 agent 平台、自动执行、
  自动批准、外发、写回、connector activation、CRM import 和自动 memory promotion。

## 验证

```bash
npm run check:public-docs
npm run check:public-release
npm run check:llm-candidate-boundaries
npm run eval:llm-trajectory-harness
npm run eval:llm-v3-boundaries
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run quality:regression
```

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-12 | 建立 Helm LLM Intelligence Deepening v3 的 public-safe 需求、能力边界与实施切片。 |

---

## English Reference

v3 keeps Helm's hard boundaries while removing weak-model-era constraints. LLMs
may generate judgement candidates, source-to-signal proposals, missing evidence,
counterarguments, and multi-pass review inputs, but they do not gain authority
over approval, external send, writeback, connector activation, CRM import,
official memory promotion, or ranking feedback.

The public Core implementation remains contracts, guards, synthetic fixtures,
evals, and docs only. Real rich context builders, customer source/schema/API
readers, and overlay drafts belong in private overlays or the user's local
environment.
