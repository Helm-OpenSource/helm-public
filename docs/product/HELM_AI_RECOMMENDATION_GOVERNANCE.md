---
status: active
owner: helm-core
created: 2026-06-03
review_after: 2026-07-03
public_safety: Public AI recommendation governance contract. Describes recommendation, evidence, review, and boundary rules only; private receipts, customer evidence, approval ids, credentials, and deployment details stay off-repo.
archive_trigger:
  - A successor governance document is merged, validated, and linked from docs/STATUS.md.
---
# Helm AI Recommendation Governance / Helm AI 推荐治理契约

> 语言 / Language：中文（权威版） · English reference follows.

Helm 把 AI 生成内容视为进入人工经营复核流程的建议输入。本文件说明
public Core 如何让这些建议保持可追踪、可复核、可约束，并且只作为公开
参考治理契约使用。

本文件不是发布批准、商业发布声明、生产 SLA、客户部署证明或 owner
Go/No-Go 记录。

## 定位与边界

Helm 是面向 AI 交付工程师的 public Core 参考实现，帮助他们把业务信号、
系统建议、复核闸口和交付包组织成可 fork、可检查、可解释的工程结构。

Helm 不是：

- 通用 AI 运行时；
- 任务或流程管理套件；
- 人工审批的替代品；
- 生产级身份、审计或租户管理平台；
- 把系统建议直接变成客户可见业务义务的系统。

本文件适用于 public Core 内的建议面、复核包、sample pack、eval gate 和
public-safe 运营文档。行业 Pack、客户 Overlay、私有部署证据和客户现场记录
应留在对应私有仓库或私有记录中。

## AI 建议原则

Helm 中的 AI 输出在人工 reviewer 接受、编辑、拒绝或升级之前，始终只是
建议。Recommendation 不等于 Commitment；解释不等于批准；准备好的 action
packet 不等于已经发生的业务动作。

每个建议面都应保留足够上下文，让 reviewer 能回答“为什么会出现这个建议”：

- 来源信号或 fixture 记录；
- 可用的 evidence reference 或 `traceId`；
- 置信度、不确定性或已知缺失输入；
- 让该建议保持 review-first 的边界。

证据不完整时，正确状态是明确标注 gap，而不是写成更强结论。公开文档可以
说明治理姿态，但不能替代代码、测试、receipt、reviewer approval 或 owner
Go/No-Go。

## 人工持有的复核闭环

人工复核是 Helm 的设计要求，不是实现尚未完成的临时限制。高风险或客户可见
结果必须停留在 review、draft 或 escalation 状态，直到对应责任人批准下一步。

Reviewer 必须保留：

- 在建议变成客户可见动作前编辑它的权利；
- 拒绝、暂停或降级该建议的权利；
- 确认前置条件、依赖项和风险备注的责任；
- 对 owner-held Go/No-Go 步骤留下 decision record 的责任。

Helm public Core 可以准备 review packet、draft、checklist 或 evidence map。
但它不能把这些材料表述成已完成审批、最终合同、客户部署 receipt、凭据轮换
receipt 或生产发布决策。

## 可审计性与追踪

治理依赖后续可复核的证据。建议面应优先使用稳定引用，例如 `traceId`、
source object id、evaluation fixture id、command receipt、PR link、issue link 和
review record，而不是只依赖文字表述。

可审计性意味着 reviewer 能回答：

- 哪个信号或记录产生了这个建议；
- 哪条规则、gate 或 evaluator 约束了它；
- 谁已经复核，谁仍需复核；
- 哪些证据缺失；
- 复核后发生了什么变化。

本文件不声称完整 trace 覆盖，也不声称完整历史回放。当 trace、receipt 或
review record 缺失时，Helm 应把它标注为 known gap，并路由到对应
owner-held follow-up。

## 治理执行机制

Public Core 通过仓库 gate、复核纪律和 public/private separation 让治理要求具备
可执行性。

最低 public Core 执行机制包括（按适用场景）：

- 功能提交前运行 `npm run check:boundaries`；
- `npm run check:public-release` 做 public-safety scanning；
- `npm run check:public-docs` 保持 public docs 显式 allowlist；
- 任何建议行为变化都应有对应 targeted test 或 eval；
- protected branch 合并前必须经过 PR review。

当仓库已有机制时，policy boundary 应编码成 closed set、typed contract、
fixture、guard 或 eval。Prose 可以解释边界，但可合并标准仍应来自代码、测试、
guard、receipt 或 review record。

外部工具、LLM provider、connector 和 AI 操作面默认不在 public Core trust
boundary 内，除非相关代码、权限和 review contract 已经落在本仓库中。一次命令
成功、一个 draft 生成、或 automated check 变绿，本身都不构成 release
readiness。

## 已知局限与刻意未做

Helm public Core 刻意不声称：

- 生产级认证或完整企业管理；
- 第三方 plugin sandbox；
- 完整 immutable audit infrastructure；
- 客户部署 ready；
- 生产 SLA；
- 仅凭 public Core 就具备 Cloud 或 Enterprise readiness；
- 无人复核地进行客户可见发送、结算、审批或形成业务义务。

其中一部分能力可能只存在于 private receipt、商业扩展、owner-held procedure 或
future work 中。Public Core 必须持续显式区分这些层级，避免 contributor 和
AI 交付工程师把建议、gate 或 demo fixture 误认为已经完成的客户义务。

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-06-03 | 建立 Helm public Core 的 AI 推荐治理契约。 |

---

## English Reference

Helm treats AI-generated content as suggestion input into a human-held operating
review process. This document explains how public Core keeps those suggestions
traceable, reviewable, and bounded as a public governance contract.

This document is not a release approval, commercial launch statement, production
SLA, customer deployment proof, or owner Go/No-Go record.

## Positioning And Boundary

Helm is a public Core reference implementation for AI delivery engineers. It
helps them organize business signals, system suggestions, review gates, and
delivery packets into a forkable, inspectable, and explainable engineering
structure.

Helm is not:

- a general AI runtime;
- a task or process management suite;
- a replacement for human approval;
- a production identity, audit, or tenant administration platform;
- a system that turns suggestions directly into customer-visible business
  obligations.

This document applies to public Core suggestion surfaces, review packets, sample
packs, eval gates, and public-safe operating docs. Industry Packs, customer
Overlays, private deployment evidence, and customer-site records should remain
in the appropriate private repositories or private records.

## AI Suggestion Principles

AI output in Helm remains a suggestion until a human reviewer accepts, edits,
rejects, or escalates it. Recommendation is not Commitment; explanation is not
approval; a prepared action packet is not an executed business action.

Every suggestion surface should preserve enough context for a reviewer to answer
why the suggestion appeared:

- source signals or fixture records;
- available evidence references or `traceId`;
- confidence, uncertainty, or known missing inputs;
- the boundary that keeps the suggestion review-first.

When evidence is incomplete, the correct state is an explicit gap, not a
stronger conclusion. Public docs may describe the intended governance posture,
but they do not replace code, tests, receipts, reviewer approval, or owner
Go/No-Go.

## Human-Held Review Loop

Human review is a Helm design requirement, not a temporary implementation gap.
High-risk or customer-visible outcomes must remain in review, draft, or
escalation state until the responsible human actor approves the next step.

The reviewer must retain:

- the right to edit a suggestion before it becomes a customer-visible action;
- the right to reject, hold, or downgrade the suggestion;
- the responsibility to confirm prerequisites, dependencies, and risk notes;
- the responsibility to record any owner-held Go/No-Go step.

Helm public Core may prepare a review packet, draft, checklist, or evidence map.
It must not represent those materials as completed approval, final contract,
customer deployment receipt, credential-rotation receipt, or production release
decision.

## Auditability And Traceability

Governance depends on evidence that can be reviewed later. Suggestion surfaces
should prefer stable references such as `traceId`, source object id, evaluation
fixture id, command receipt, PR link, issue link, and review record over
prose-only claims.

Auditability means a reviewer can answer:

- which signal or record produced the suggestion;
- which rule, gate, or evaluator constrained it;
- who has reviewed it and who still needs to review it;
- which evidence is missing;
- what changed after review.

This document does not claim complete trace coverage or complete historical
replay. When a trace, receipt, or review record is missing, Helm should label it
as a known gap and route it to the appropriate owner-held follow-up.

## Governance Enforcement

Public Core makes governance enforceable through repository gates, review
discipline, and public/private separation.

Minimum public Core enforcement includes, where applicable:

- run `npm run check:boundaries` before feature submission;
- run `npm run check:public-release` for public-safety scanning;
- run `npm run check:public-docs` to keep public docs on an explicit allowlist;
- add targeted tests or evals for changed suggestion behavior;
- require PR review before merging a protected branch.

Where the repository already provides the mechanism, policy boundaries should be
encoded as closed sets, typed contracts, fixtures, guards, or evals. Prose can
explain the boundary, but mergeable evidence should come from code, tests,
guards, receipts, or review records.

External tools, LLM providers, connectors, and AI operation surfaces are outside
the public Core trust boundary by default unless the relevant code, permissions,
and review contract are present in this repository. A successful command, a
generated draft, or green automated checks do not by themselves establish
release readiness.

## Known Limits And Deliberately Not Done

Helm public Core deliberately does not claim:

- production-grade authentication or complete enterprise administration;
- third-party plugin sandboxing;
- complete immutable audit infrastructure;
- customer deployment readiness;
- production SLA;
- Cloud or Enterprise readiness from public Core alone;
- customer-visible sending, settlement, approval, or business obligation without
  human review.

Some of these capabilities may exist only as private receipts, commercial
extensions, owner-held procedures, or future work. Public Core must keep those
layers explicit so contributors and AI delivery engineers do not confuse a
suggestion, gate, or demo fixture with a completed customer obligation.

## Change Log

| Date | Change |
|---|---|
| 2026-06-03 | Established the Helm public Core AI recommendation governance contract. |
