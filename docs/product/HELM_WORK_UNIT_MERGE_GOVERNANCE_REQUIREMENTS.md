---
status: draft
owner: Product / Delivery Engineering / Engineering
created: 2026-07-19
review_after: 2026-08-02
public_safety: Public Core requirements only. No customer data, credentials, private hosts, production receipts, connector activation, writeback, external send, approval, settlement, or customer commitment. Approval and activation states are schema concepts only; Public Core must not carry real approval or activation instances.
---

# Helm Work Unit And Mainline Governance Requirements / Helm 工作包与主线治理需求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 1. 定位与非目标

Helm 可以借鉴 GitHub 的变更治理机制，但不得把 GitHub 式复杂流程暴露给业务用户。
Helm 的目标是让 AI 在系统内部完成诊断、草案、证据、检查、冲突处理和修复；让人只在
必要时看到足够判断的决策卡；让组织只吸收经过验证、授权和留痕的事实。

本文件定义 **Helm Work Unit And Mainline Governance**：面向企业经营、诊断、交付、
复核和复盘的 AI-native 工作包治理要求。它不是 runtime 实现、发布批准、客户部署证明、
生产 SLA、owner Go/No-Go、客户系统写回许可或自动执行授权。

Helm 不做：

- 通用聊天协作平台。
- 代码托管平台。
- 自动执行平面。
- 自动审批系统。
- 客户系统写回器。
- 自动发布或自动承诺系统。

## 2. 术语与表面分层

业务用户只应感知三步：

1. **发起**：说明目标和范围。
2. **等待**：系统准备候选方案、证据、检查和需要确认的人。
3. **复核**：看决策卡，批准、退回或要求补充。

| 层 | 谁看 | 可见对象 | 不应暴露 |
|---|---|---|---|
| 业务用户层 | 发起人 / 批准人 | 决策卡、待办、检查摘要 | Branch、PR、Merge、CI、Ruleset、Merge Queue |
| Owner 复核层 | 领域负责人 | 复核包、证据、变更摘要、批准回执 | 系统内部队列和检查实现细节 |
| 系统层 | Helm 内部 | 草案隔离、检查、规则、冲突键、队列、审计、AI 修复循环 | 不直接面向业务用户 |

用户可见命名应使用：

| 内部机制 | 用户可见命名 |
|---|---|
| Work Unit | 工作包 |
| Candidate Artifact | 候选方案 |
| Review Packet | 复核包 |
| Decision Entry | 决策卡 |
| Semantic Diff | 变更摘要 |
| Policy Checks | 检查 |
| Required Owners | 需要确认的人 |
| Mainline Promotion | 定稿 / 进入公司主线 |
| Merge Receipt | 批准回执 |
| Mainline Truth | 公司主线 |
| Environment Gate | 生效范围 |
| Rollback Plan | 回退方案 / 更正方案 |
| Lesson-to-Guard | 经验入库 |

## 3. 不变式

- **INV-01 Candidate-only**：AI 一切产物默认是候选方案。
- **INV-02 Recommendation is not commitment**：建议不等于承诺。
- **INV-03 Proof is not readiness**：proof package 不等于 readiness。
- **INV-04 Check is not approval**：检查通过不等于 owner 已批准。
- **INV-05 Mainline is not activation**：定稿进入公司主线不等于 runtime 生效。
- **INV-06 Separate activation authority**：外发、写回、connector 激活、客户承诺必须有独立授权。
- **INV-07 Snapshot-bound approval**：批准必须绑定候选方案的不可变内容快照。
- **INV-08 Related-mainline-change invalidates approval**：候选方案内容、证据、风险等级、冲突键、依赖，
  或与本工作包 `conflictKeys` / 依赖重叠的主线基线变化后，原批准自动失效。
- **INV-09 No AI risk downgrade**：AI 不得自评自降风险等级。
- **INV-10 Append-only mainline**：公司主线是 append-only 账本加当前有效视图；更正通过
  superseding 工作包完成，不改写历史。
- **INV-11 Public Core scope**：Public Core 只承载机制、schema、状态机、guard、
  synthetic fixture 和 public-safe docs。
- **INV-12 No private truth in Public Core**：客户真实事实、私有 host、凭据、生产回执、
  overlay 私有逻辑不得进入 Public Core。

## 4. 工作包状态机

工作包状态必须是闭集：

| State | Meaning |
|---|---|
| `draft` | 草案，尚未成为可复核候选 |
| `candidate` | 候选方案，尚未被人类 owner 接受 |
| `checking` | 系统正在运行检查 |
| `needs_owner_review` | 需要 owner 复核 |
| `changes_requested` | owner 要求修改 |
| `accepted_by_human` | 人类 owner 接受候选快照 |
| `promoted_to_mainline` | 候选快照进入公司主线 |
| `activation_requested` | 请求进入独立生效流程 |
| `activated_by_human` | 人类授权后生效 |
| `rejected_by_human` | 人类 owner 拒绝 |
| `withdrawn` | 发起方撤回 |
| `superseded` | 被后续工作包替代 |
| `stale` | 基线、依赖或内容快照过期 |
| `quarantined` | 红action、安全或边界无法证明，隔离处理 |

关键迁移规则：

- AI 只能创建 `draft`、`candidate`，或把失败检查后的修复重新提交为新的 `candidate`。
- 系统可以把候选推进到 `checking`、`needs_owner_review`、`stale`、`quarantined`。
- 只有人类 owner 可以触发 `accepted_by_human`、`rejected_by_human` 或授权代理审批。
- `promoted_to_mainline` 的前置条件必须是 `accepted_by_human` 加未失效的快照绑定批准。
- `promoted_to_mainline` 不得自动进入 `activated_by_human`。
- `activation_requested` 和 `activated_by_human` 必须有独立授权回执。
- `changes_requested` 后，AI 或人类修复结果必须重新成为新的 `candidate`。
- `withdrawn` 只能由发起方或授权 owner 触发。
- `superseded` 只能由后续已接受或已进入主线的工作包触发。
- `quarantined` 只能在红action、安全、凭据、私有数据或边界证明失败时退出为
  `rejected_by_human`、`withdrawn` 或重新生成红action后的 `candidate`。
- 内容快照变化后，既有批准失效；若冲突键或依赖基线变化，状态为 `stale`；
  若仅候选内容被修改，状态回到 `needs_owner_review`。

## 5. 核心对象

### 5.1 工作包

工作包最小字段：

| Field | Requirement |
|---|---|
| `id` | Stable id |
| `objective` | 工作目标 |
| `scope` | 影响范围 |
| `owner` | 责任 owner；高风险缺 owner 时 fail closed |
| `agentRole` | AI 角色：诊断、草案、修复、验证、总结等 |
| `sourceSnapshot` | 输入来源和主线基线快照；不得包含私有原文 |
| `riskClass` | 系统推导的风险等级 |
| `conflictKeys` | 客户、报价、规则、SOP、Pack、Overlay 等冲突键 |
| `candidateArtifacts` | 候选方案、草案、映射或复核材料 |
| `evidenceManifest` | 证据清单和红action状态 |
| `changeSummary` | 面向 owner 的自然语言变更摘要 |
| `requiredOwners` | 需要确认的人，支持 all-of / any-of / 授权代理 |
| `validationReceipts` | 检查回执 |
| `decision` | 人类决定：接受、拒绝、退回、撤回、替代 |
| `decisionSnapshotHash` | 被批准候选内容快照 hash |
| `mergeReceipt` | 批准回执；Public Core 只定义 schema，不保存真实实例 |
| `activationScope` | 生效范围；Public Core 只定义 schema，不保存真实实例 |
| `rollbackOrRemediationPlan` | 回退或更正方案 |
| `auditRefs` | append-only 审计引用 |

### 5.2 决策卡

决策卡必须回答：

- 这是什么候选方案？
- 为什么需要我看？
- 改了什么？
- 依据是什么？
- 风险是什么？
- 哪些检查通过 / 未通过？
- 还需要谁确认？
- 批准绑定的是哪个内容版本？
- 批准后进入哪里？
- 是否会立即生效？
- 如果错了，如何回退或更正？

低风险工作包可显示摘要；高风险工作包必须渐进展开复核包。

### 5.3 公司主线

公司主线是 append-only 账本加当前有效视图。它可以登记事实、规则、模板、SOP、
Pack contract、approved decision 和批准回执的当前有效投影。

真实公司主线是 tenant / overlay / control-plane 侧资产。Public Core 只定义机制、
schema、状态机、guard 和 synthetic fixture。

## 6. 风险分级

风险等级由系统按策略推导，AI 不得自行声明或下调。

最小风险等级：

| Risk | Meaning | Default posture |
|---|---|---|
| `read_only` | 读取公开或已红action材料 | 可自动检查 |
| `local_draft` | 生成本地草案或证据包 | 可自动准备，仍为候选 |
| `internal_mainline` | 影响内部主线事实、规则、模板或 SOP | 需要 owner 复核 |
| `customer_visible` | 可能进入客户可见界面、文本或交付物 | 需要相关 owner 复核 |
| `runtime_activation` | 可能触发生产、生效、connector 或部署状态 | 需要独立授权 |
| `commercial_commitment` | 可能形成报价、交期、范围、法律或商业承诺 | 需要独立授权和回执 |

降级规则：

- AI 不得降级。
- 系统不得自动降级。
- 人类 owner 可降级，但必须留下理由和回执。
- 高风险缺 owner 时 fail closed。

## 7. 需求

### HWU-01 工作包契约

MUST 定义标准 schema、状态机和必填字段。缺少 `owner`、`scope`、`riskClass`、
`conflictKeys` 或 `rollbackOrRemediationPlan` 时，不得进入复核。

### HWU-02 候选默认

MUST 保证 AI 产物默认为 `candidate`。任何直接进入 `accepted_by_human`、
`promoted_to_mainline` 或 `activated_by_human` 的 AI 路径必须阻断。

### HWU-03 批准绑定快照

MUST 将 owner 批准绑定到候选内容 hash。候选内容、证据、风险等级、冲突键、依赖，
或与本工作包 `conflictKeys` / 依赖重叠的主线基线变化后，批准自动失效。

### HWU-04 主线登记

MUST 区分 Public Core schema 与私有主线事实。Public Core 不得保存客户真实主线事实。

### HWU-05 决策卡

MUST 提供低复杂度用户入口。低风险显示摘要，高风险渐进展开复核包。

### HWU-06 需要确认的人

MUST 支持 required owner、all-of / any-of、授权代理、超时升级和 owner 缺位阻断。
授权代理也必须是留有授权回执的人类 owner。

### HWU-07 业务检查

MUST 将 public/private boundary、凭据、承诺边界、财务口径、数据 lineage、owner 缺失、
回退方案缺失、生效范围越界转成自动检查。

### HWU-08 冲突键串行化

MUST 用声明式 `conflictKeys` 处理并发。相同或重叠 `conflictKeys` 的工作包进入主线前，
必须基于最新相关主线基线重验。

### HWU-09 生效范围

MUST 区分 `local_proof`、`repo_truth`、`private_workspace_truth`、`staging_readiness`、
`customer_visible`、`production_runtime`、`commercial_commitment`。进入任一高风险
生效范围都必须有独立授权回执。

### HWU-10 回退与更正

MUST 区分可回滚与只能更正 / 补救。对外承诺、报价、客户沟通、法律动作默认只能更正
/ 补救。主线层更正通过新的 superseding 工作包登记；runtime 层更正需要独立生效回执。

### HWU-11 Owner 生命周期

MUST 处理 owner 缺失、超时、变更、冲突、候选过期和主线漂移。系统不得因 owner 不在
而绕过批准。

### HWU-12 AI 修复循环

MUST 允许 AI 修复检查失败，但修复结果必须作为新候选重新复核。AI 不得修改检查规则
来让自己通过。

### HWU-13 经验入库

MUST 要求每次错误、事故、review finding 转成至少一种可执行资产：检查、模板、
反例 fixture、eval case、owner rule 或 SOP 更新。若 owner 明确豁免，豁免也必须留痕
并说明为什么本次不转成可执行资产。

### HWU-14 审计与回执

MUST append-only 记录谁在什么版本上看到什么、批准什么、拒绝什么、基于什么证据。
系统不得代 owner 生成批准回执。

### HWU-15 用户术语守卫

MUST 对用户可见文案运行术语检查，禁止 Branch、PR、Merge、CI、Ruleset、Merge Queue
等内部术语进入业务界面。

## 8. 当前工程锚点

首个 Public Core 工程切片已锚定：

- `lib/work-unit-governance/contracts.ts` 定义工作包状态、风险、生效范围、owner、候选产物、
  证据、批准、回执、回退 / 更正方案等纯 TypeScript / zod contract。
- `lib/work-unit-governance/contracts.test.ts` 覆盖 candidate-only、AI 不得批准、
  快照绑定批准、冲突键漂移失效、高风险 owner、生效回执和用户术语守卫。
- `scripts/check-work-unit-governance.ts` 提供合成 fixture 边界守卫，并接入
  `npm run check:boundaries`。

第二个 Public Core 工程切片已锚定：

- `lib/work-unit-governance/runtime.ts` 把合成工作包转换成负责人复核读出、只读动作计划和
  私有主线投影形状；所有动作计划均标记为 Public Core 不持久化、不外发、不写回、不生效。
- `features/work-unit-governance/work-unit-review-console.tsx` 和
  `/demo/work-unit-governance` 提供面向实施工程师 / 负责人的复核台示例，用户可见文案继续禁止
  GitHub 内部术语。
- `scripts/check-work-unit-governance.ts` 已增加 runtime fixture，覆盖 AI 不能接受候选、
  公开 Core 不能执行副作用、私有主线投影只携带 shape 的边界。

这些切片仍不代表 HWU-01 到 HWU-15 全量实现完成。真实私有主线账本、owner 通知 / 升级、
tenant / overlay 侧 activation receipt、经验入库自动化和 proof viewer 仍属于后续切片。
Public Core 仍只保存 schema、guard、测试、synthetic fixture、只读运行时读出和 demo 复核面。

## 9. 验收标准

- AI 不能生成 `accepted_by_human`、`promoted_to_mainline` 或 `activated_by_human` 状态。
- `promoted_to_mainline` 必须有 `accepted_by_human` 与未失效的 `decisionSnapshotHash`。
- 批准必须绑定内容 hash。
- 候选内容、证据、风险等级、冲突键、依赖或相关主线基线变化后，批准自动失效。
- AI 不能自评自降风险等级。
- 高风险缺 owner 时 fail closed。
- 检查通过不能自动定稿。
- 定稿不能自动生效。
- 同一或重叠 `conflictKeys` 并发变更必须重验。
- Public Core fixtures 全部 synthetic / public-safe。
- 用户文案不得出现 GitHub 内部术语。
- 每个工作包必须有回退或更正方案。
- 每个 review finding 必须能落为可执行资产，或有 owner 留痕豁免。

## 10. 非规范性附录：成熟度模型

| 阶段 | 名称 | 判据 |
|---|---|---|
| L0 | Chat Memory | 只有沟通记录 |
| L1 | Structured Packet | 有结构化工作包 |
| L2 | Review-First | AI 只产候选，人类复核 |
| L3 | Policy-Gated | 规则可自动检查 |
| L4 | Mainline Governance | 合并后成为 append-only 组织事实 |
| L5 | Learning Organization | 错误会转成下一次自动阻断 |

本需求目标是 L2 到 L3，预留 L4 / L5。成熟度越高，系统吸收的复杂度越多，
业务用户侧不应更复杂。

## English Reference

This document defines the public Core requirements for Helm Work Unit and
Mainline Governance.

Helm may borrow governance mechanisms from GitHub-like change management, but
business users must not be exposed to code-hosting concepts such as Branch, PR,
Merge, CI, Ruleset, or Merge Queue. The user-facing experience is a simple loop:
start a work package, wait while Helm prepares candidates and checks, then review
a decision card.

AI output remains candidate-only. A check passing is not approval. A proof
package is not readiness. Mainline promotion is not runtime activation. External
send, writeback, connector activation, production runtime changes, and commercial
commitments require separate human authorization.

Public Core only defines mechanisms, schemas, state machines, guards, synthetic
fixtures, and public-safe documentation. Customer facts, private hosts,
credentials, production receipts, and overlay-private logic must remain outside
Public Core.
