---
status: active
owner: helm-core
created: 2026-06-07
review_after: 2026-07-07
public_safety: Public-safe contract, guard, and reference-scanner description only. Do not add real context packets, real selection receipts, customer signals, overlay drafts, prompt run receipts, credentials, or tenant deployment evidence.
archive_trigger:
  - A successor v2 spec is merged, validated, and linked from docs/STATUS.md.
---
# Helm LLM Intelligence Deepening v2

> 语言 / Language：中文（权威版） · English reference follows.

v2 把 Helm 的 LLM 智能从「解释 / 边界复核」继续深化为**反证复核、更安全的上下文选择、运行时权限围栏，以及记忆 / 会话分离**——但仍然是 **boundary-first**，不是 agent 平台、工作流引擎、外部 agent 注册表、市场或自动执行面。

本文件是 public-safe 契约 / guard / 参考实现说明，不是发布批准、商业发布声明、生产 SLA 或客户部署证明。

## 边界优先，不是 agent 平台

v2 刻意不实现：外部 Agent 运行时清单、外部 agent 注册表、市场、skill 自动安装、自治执行、connector 激活、外发 / 写回、直接 `runCrmImport`、自动 `MemoryPromotion`、自动 `PreferenceSignal` / `PatternFact` / `RecommendationFeedback`、独立 Judgement Trajectory Bundle、完整 HelmJudgementSkill 运行时。

LLM 面向的 schema 永远不暴露 connector / approval / 外发 / 写回句柄、`runCrmImport`、或 MemoryPromotion / PreferenceSignal / PatternFact 的写入路径。LLM workflow 只能**请求**一个 `capabilityRef`（`capabilityRequested`）。

## 运行时权限围栏

`RuntimePermissionProfile` 是一个封闭枚举：`read_only | draft_only | review_required | blocked_side_effect`。

任何带副作用语义的 capability 请求都解析为 `blocked_side_effect`；未知 / 空请求也 fail closed 到 `blocked_side_effect`。`SkillRevisionCandidate` 若请求副作用 capability，同样解析为 `blocked_side_effect`——skill 修订永远不能给自己授予副作用。

## Counterfactual Reviewer 只降级或要求人审

`CounterfactualReviewerOutput` 只允许：替代假设、需要的反证证据、降级条件、`commitmentRiskUp` 标志、降级理由、review 状态、是否需要人审、以及 fail-closed 原因。它没有任何用于批准、执行、承诺升级、connector 句柄或记忆写入的字段。

reviewer **fail closed**：缺策略、缺权限、不安全 capability 请求、超时、解析失败、schema 失败、provider 失败、空响应或 egress 被拦，都返回 `needs_review + requiredHumanReview=true` 并带具体 `reason`。

远程 egress gate（与 v1 一致）：`SelectedContextStub` 与原始 `judgementSummary` 在 dispatch 前必须过 egress gate。非 `public_safe_synthetic` 默认 remote-risk；remote 路径必须同时满足 `consentGranted && promptPreviewAccepted`，否则在调用 provider 前就 fail closed（`reason: "egress_blocked"`，且不调用 `executeLLMTask`）。允许放行时，stub 与 judgement summary 会先经 redaction 再进 prompt。

延迟围栏（owner 决策）：默认 `maxLatencyMs=5000`，批量 / eval 上限 `15000`。超时返回 `needs_review + requiredHumanReview=true + reason: "timeout"`，且超时**不会**提升人审队列优先级。

审计一致性：当前底层 `executeLLMTask` 不支持取消，超时时在途 provider 调用不会被中止，可能在 provider registry 里独立记录自己的 call log。因此 workflow 层会发出一个**权威 boundary 决策 receipt**（`CounterfactualBoundaryReceipt`，含 `timedOut` 与 `providerCallCancelled: false`），作为调用方的唯一权威决策；provider call log 视为独立、可能更晚的记录。后续可给 provider 路径加 abort signal 让两者收敛。

## SelectedContextStub 是长期最小输入

`SelectedContextStub` 是 Counterfactual Reviewer 的**长期最小输入契约**（不是临时脚手架）：只含 `objectRef`、`selectedEvidenceRefs`、`missingEvidence`、`policySnapshotHash`、`privacyClass`、`tokenBudget`。

完整的上下文选择 receipt（`LLMContextSelectionReceipt`，A-lite）只用于审计 / 回放，**绝不进入 LLM prompt**；只有它向 `SelectedContextStub` 的投影可以进入 prompt。静态 guard 会拒绝把 selection receipt 内容塞进 prompt。

## Overlay Context Hygiene

`OverlayContextFileReceipt` 记录读取 / 排除的 ref、`sourceHash`、`policySnapshotHash`，以及 `promptInjectionScanResult`（`status: passed | failed | skipped`，skipped 必须带 `skipReason`）。

参考 prompt-injection scanner 在 `helm-public` 提供（确定性、离线、保守）。真实扫描在 `helm-overlays` / 本地对私有上下文执行。**真实 overlay / 本地 receipt 不允许 `skipped`**；只有 synthetic fixture 才能使用 `skipped`（运行时解析与静态 guard 双重拒绝）。

## 记忆 vs 会话搜索分离

- 记忆只存放**经人工复核的持久事实**。
- 会话 / 轨迹搜索是**临时证据**，永远不是直接记忆。
- 会话证据至多成为 `memoryPromotionCandidate`（需人审），永不自动晋级。

Memory Bench（synthetic）覆盖 ≥10 个会话证据候选，要求 false promotion rate = 0、boundary violation = 0，并在选定 fixture 上做 pass^5 结构稳定性（review state、required human review、issue codes、downgrade 条件类型 / 数量、boundary decision 的结构一致，不要求逐字一致）。

## public / overlay / local 路由

- `helm-public`：契约、zod、guard、参考 scanner、synthetic fixtures、文档。
- `helm-overlays` / local：真实 packet builder、真实 context receipt、客户 adapter、私有部署 draft。

## 验证

```bash
npm run check:boundaries        # 含 check:llm-candidate-boundaries（含 v2 规则 C/D/E）
npm run typecheck
npm run test
npm run eval:llm-v2-boundaries  # counterfactual + memory bench + prompt-injection
```

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-06-07 | 建立 Helm LLM Intelligence Deepening v2 的 public-safe 边界优先契约与 guard。 |

---

## English Reference

v2 deepens Helm's LLM intelligence into counterfactual review, safer context
selection, runtime permission fencing, and memory/session separation. It stays
boundary-first: not an agent platform, workflow engine, external agent registry,
marketplace, or auto-execution plane.

This document is a public-safe contract / guard / reference-scanner description.
It is not a release approval, commercial launch statement, production SLA, or
customer deployment proof.

- **Runtime permission fencing.** `RuntimePermissionProfile` is a closed enum
  (`read_only | draft_only | review_required | blocked_side_effect`). Any
  side-effect or unknown capability request resolves to `blocked_side_effect`.
  LLM workflows may only request a `capabilityRef`.
- **Counterfactual Reviewer only downgrades or requires review.** Its output has
  no field for approval, execution, commitment upgrade, a connector reference,
  or a memory write. It fails closed (needs_review + requiredHumanReview) on
  missing policy, missing permission, unsafe capability request, timeout, parse
  failure, schema failure, provider failure, or empty response. Latency budget:
  5000ms default, 15000ms batch/eval ceiling; a timeout never raises queue
  priority.
- **`SelectedContextStub` is the long-term minimal reviewer input.** The full
  context selection receipt is audit/replay only and must never enter an LLM
  prompt — only its projection to the stub may.
- **Memory is only for reviewed durable facts.** Session/trajectory search is
  temporary evidence, never direct memory. Session evidence may at most become a
  `memoryPromotionCandidate` pending human review.
- **Prompt-injection scan ownership.** `helm-public` ships the contract, guard,
  reference scanner, and synthetic fixtures; `helm-overlays`/local runs the real
  scan. A real overlay receipt may not report `skipped`.
- **Routing.** `helm-public`: contracts, zod, guards, reference scanner,
  synthetic fixtures, docs. `helm-overlays`/local: real packet builders, real
  context receipts, customer adapters, private deployment drafts.
