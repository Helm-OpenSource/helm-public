---
status: active
owner: helm-core
created: 2026-04-24
review_after: 2026-07-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Monitor Substrate Read-Only Adoption Plan V1

更新时间：2026-04-24
状态：Delivered on Branch

## 1. 当前 truth source

这份 plan 建立在以下 current-main 文档之上：

- [HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md)
- [HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md)
- [HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md)
- [HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_REPORT_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/reviews/HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_REPORT_V1.md)

## 2. 为什么现在开这条 plan

`Extension Bundle + Capability Manifest` 和 `Capability Resolution Engine` 已经完成最窄 read-only adoption。

下一步如果直接做 runtime server、scheduler、notification center 或 swarm orchestration，会过早扩张控制面。
因此这条 plan 只做第三个 harness gap 的第一刀：

- read-only monitor substrate
- operator-facing readout
- review-first routing posture

## 3. 这条 slice 要证明什么

本轮只证明：

Helm 可以把持续观察信号统一映射成 `severity / output posture / reason code / operator next move`，并保持 report / review first。

本轮不证明：

- monitor substrate 已经接管任何 source system
- 已经存在 scheduler
- 已经存在 notification center
- 已经存在自动重放、自动修复或自动执行
- 已经存在 customer-visible send authority

## 4. 精确范围

### 第一批 monitor signal kind

本轮只覆盖 gap analysis 已点名的高价值场景：

- connector lag
- webhook failure / stale receipt
- meeting ingest backlog
- memory sync anomaly
- settlement exception
- review queue drift

### 第一批 readout 字段

本轮只要求统一输出：

- `severity`
- `outputPosture`
- `primaryReasonCode`
- `summary`
- `operatorNextMove`
- `sourceRefs`
- `boundaryNotes`
- `evaluation.sourceChain`

### 第一批 source chain

本轮只要求四段式：

- `signal_truth`
- `threshold_check`
- `review_posture`
- `authority_boundary`

## 5. 保留边界

继续明确保留：

- `workspace-first`
- `judgement-first`
- `proactive-reporting-first`
- `review-first`
- `recommendation != commitment`
- monitor readout 不等于 action
- monitor readout 不等于 scheduler
- monitor readout 不等于 notification center
- monitor readout 不等于 auto-execution
- settlement exception monitor substrate 不创建 payout rail

## 6. phase plan

### Phase 1

- 引入 `buildMonitorSubstrateReadout`
- 引入 `buildMonitorSubstrateSummary`
- 保持纯函数、无 DB、无外部副作用

### Phase 2

- 增加 targeted tests
- 覆盖 within-threshold、review routing、blocked settlement exception 和 summary aggregation

### Phase 3

- 接入 `self-check`
- 接入 `check:boundaries`
- 同步 `PLANS.md` 和 `docs/README.md`

## 7. 下一步边界

如果本轮验证通过，下一阶段只能二选一：

1. 继续做 `Memory Observability and Budgeting`
2. 把 monitor readout 接到 operator diagnostics，但仍保持 read-only

不建议下一步直接做 scheduler、notification center、auto-remediation 或 runtime server。
