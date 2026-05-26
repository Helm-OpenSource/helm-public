---
status: active
owner: Product / Engineering / Data Protection
created: 2026-05-02
review_after: 2026-05-16
archive_trigger:
  - Audience-aware signal projection 被接入 Business Advancement runtime adoption plan 并形成独立 closeout 后归档
  - Object / Signal validity framework 吸收本文件全部投影 contract 后归档
  - Helm 放弃 Worker / human 双通道经营信号设计时归档
---

# Helm Audience-Aware Signal Contract

## 1. 结论

经营信号不能是一条消息发给所有人。

Helm 的正确模型是：

```text
validated object / signal
  -> audience-aware projection
  -> HumanOperatingSignal / WorkerInstructionSignal / ReviewSignal / LearningSignal
```

同一个经营事实，对创始人、销售 / CS、Reviewer、Worker、自改进系统应该呈现不同形态。差异不只是文案长度，而是 **信息带宽、责任边界、动作权限、停止条件、回执要求** 都不同。

本文件只授权 docs / fixtures / offline evaluator，不授权 schema、runtime、API、UI、production query adoption、official write、自动执行或 LLM final ranking。

## 2. 为什么需要这一层

`Object / Signal Validity Gate` 解决的是“这个信号能不能成立”。但它不回答：

1. 这个信号应该给谁看？
2. 给人看时应该压缩到什么程度？
3. 给 Worker 时是否必须变成 typed instruction？
4. 什么信号只能给 Reviewer，不能给 Worker？
5. 被 watch / reject 的信号如何进入学习闭环，而不是继续打扰经营者？

如果不拆这一层，Helm 会出现两类问题：

| 问题 | 后果 |
|---|---|
| 用人类信号驱动 Worker | Worker 消费自然语言建议，容易越权、误发、误写 CRM |
| 用 Worker 信号展示给人 | 经营者看到过多字段、阈值、证据碎片，决策带宽被耗尽 |

## 3. 接收者模型

| 接收者 | 带宽 | 应看到 | 不应看到 |
|---|---:|---|---|
| Founder / 管理者 | 低 | 3 件事以内、原因、风险、下一步、是否要拍板 | 原始 payload、长证据列表、Worker 内部 stop condition |
| Sales / CS | 中 | 客户、下一步、截止、边界、草稿入口 | 跨客户聚合、未复核冲突结论 |
| Reviewer | 中 | evidence refs、冲突、边界、allowed / forbidden actions、回滚路径 | 被压缩掉的关键证据 |
| Worker | 高 | typed object、allowed actions、forbidden actions、stop conditions、receipt contract | 自然语言承诺、最终排序权、对外发送权 |
| Learning loop | 批量 | 采纳 / 降级 / 撤销 / 噪音 / 负例 | canonical memory auto-write、formal skill auto-promotion |

## 4. 投影合同

### 4.1 输入

Audience-aware projection 只接受已经通过前置 gate 的候选：

```typescript
type AudienceSignalCandidate = {
  validityDisposition: "must_push_ready" | "review_required" | "watch_only" | "rejected";
  signalType: string;
  severity: "watch" | "normal" | "high" | "critical";
  objectRef: string;
  evidenceRefs: string[];
  contradictoryEvidenceRefs: string[];
  hasOwner: boolean;
  hasNextAction: boolean;
  hasBoundaryNote: boolean;
  hasReviewPosture: boolean;
  suggestedSafeActions: string[];
  unsafeActionRequests: string[];
  rawPayloadIncluded: boolean;
};
```

### 4.2 输出

```typescript
type AudienceSignalDecision =
  | "surface_to_human_and_worker"
  | "review_first"
  | "watch_only_digest"
  | "reject_and_contain";
```

四类投影：

| 投影 | 用途 | 强约束 |
|---|---|---|
| `HumanOperatingSignal` | 给经营者看 | `bulletCount <= 3`，必须显示 non-commitment boundary |
| `WorkerInstructionSignal` | 给 Worker 执行准备动作 | 只能含 allowed actions、forbidden actions、stop conditions、receipt requirement |
| `ReviewSignal` | 给 Reviewer 复核 | evidence coverage 必须完整，冲突必须显式 |
| `LearningSignal` | 给自改进系统 | 只能生成 candidate，不自动晋升记忆或 Skill |

## 5. 决策规则

| Validity disposition | Audience decision | Human | Worker | Reviewer | Learning |
|---|---|---|---|---|---|
| `must_push_ready` | `surface_to_human_and_worker` | `compact_must_push` | `bounded_instruction` | audit-ready | positive pattern candidate |
| `review_required` | `review_first` | `review_banner` | `review_packet_only` | required | threshold / boundary candidate |
| `watch_only` | `watch_only_digest` | suppressed or digest | no instruction | optional audit | noise / freshness candidate |
| `rejected` | `reject_and_contain` | suppress + alert reviewer | blocked | containment required | negative fixture candidate |

防御性降级规则：

- 即使前置 gate 标记为 `must_push_ready`，只要缺 owner、缺 next action、缺 boundary note、缺 review posture，或存在 contradictory evidence，Audience layer 必须降级为 `review_first`。
- 该降级不是重新做 Object / Signal validity 判定，而是防止错误 disposition 直接穿透到 Human / Worker 投影。

## 6. Worker 安全合同

Worker 不能消费“自然语言建议”作为执行依据。Worker 只能消费 typed packet。

第一版允许动作：

```text
assign_owner
collect_evidence
open_review_packet
prepare_draft
summarize_context
```

第一版禁止动作：

```text
send_email
update_crm_stage
approve_decision
commit_price
public_claim
canonical_memory_write
```

第一版 stop conditions：

```text
missing_evidence
boundary_conflict
object_revoked
reviewer_not_assigned
contradictory_evidence
object_not_actionable
```

Worker receipt 只能证明“准备动作完成 / 证据收集完成 / review packet 已打开”，不能证明外部写入成功、客户已收到、审批已通过或承诺已生效。

## 7. Offline Eval

本轮新增：

- `evals/audience-signal/audience-signal-cases.json`
- `lib/evals/audience-signal-evals.ts`
- `scripts/audience-signal-evals.ts`
- `npm run eval:audience-signal`

首批 fixture 覆盖：

1. `must_push_ready` 信号可以同时生成 compact human signal 与 bounded worker instruction。
2. 有冲突证据的 `review_required` 信号只能让 Worker 打开 review packet / 收证据，不能准备草稿。
3. `watch_only` 信号不生成 Worker instruction。
4. 跨 workspace / identity 错信号必须 `reject_and_contain`，Worker blocked。
5. unsafe action 请求不会穿透成 Worker allowed action。
6. 缺 owner 的高风险信号进入 review-first，不进入直接执行。

## 8. 成功指标

| 指标 | 目标 |
|---|---:|
| Human bullet overload count | 0 |
| Worker forbidden action leak count | 0 |
| Raw payload echo count | 0 |
| Auto execution attempt count | 0 |
| Canonical memory write count | 0 |
| Reviewer evidence coverage | 100% |
| Rejected signal worker instruction count | 0 |
| Watch-only direct push count | 0 |

## 9. 当前边界

1. 本文件不声明 production audience projection 已成立。
2. `eval:audience-signal` 只证明 offline fixture gate，不证明真实用户信号投影质量。
3. 本文件不授权 Worker runtime、schema、API、UI、official write、自动外发、自动改 CRM 或自动写 canonical memory。
4. 本文件不改变 `Object / Signal Validity Gate`；它只作为后置 projection layer。
5. 本文件不允许 LLM 做最终排序、review posture 升降级或动作授权。

## 10. 下一阶段

| 阶段 | 目标 | 禁止 |
|---|---|---|
| Phase 0 | 当前 docs + offline eval | runtime |
| Phase 1 | 扩充到 20-30 条 Pack A / Business Advancement / internal tenant fixture | production query |
| Phase 2 | 接入 internal tenant weekly scorecard，记录人类采纳 / 忽略 / 降级原因 | schema / API |
| Phase 3 | 与 Object / Signal remediation gate 合并成 pre-runtime readout | official write / auto execution |
| Phase 4 | 如 dogfood 连续通过，再写 runtime PRD | LLM final ranking |

## 11. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | 首版：定义 audience-aware signal projection contract，新增 `eval:audience-signal` 离线质量门 |
