---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public-safe Operating Signal Flow contract. Private review packets, customer receipts, and internal adoption evidence are excluded.
---
# Helm Operating Signal Flow Map Requirements / Helm Operating Signal Flow Map 要求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

运营信号流图是公开 Core 契约，用来展示业务信号如何在 Helm 内流转，同时不把建议变成承诺。

它只是只读投影，不是运行时 DAG、调度器、重试队列、分发器、工作流引擎、BI 平台或自动执行平面。
第一屏应该让交付工程师看清当前流转是顺畅、积压还是阻塞；来源信号如何进入复核包、
候选动作、报告、记忆候选或被拒输入；哪些部分是确定性规则，哪些是 AI 辅助解释，
哪些必须人工复核。

所有公开信号都必须带稳定信号键、来源家族、对象链接或拒绝原因、证据姿态、复核状态、
负责人 / 复核人路由和边界说明。原始客户数据、客户专属标识、生产 URL、私有域名和私有部署回执
不属于本公开 Core 契约。

## English Reference

The Operating Signal Flow Map is the public Core contract for showing how
business signals move through Helm without turning recommendations into
commitments.

It is a read-only projection. It is not a runtime DAG, scheduler, retry queue,
dispatcher, workflow engine, BI platform, or automatic execution plane.

## Goals

The first screen should make three things clear:

1. Whether the current operating flow is smooth, backlogged, or blocked.
2. Which source signals are becoming review packets, candidate actions, reports,
   memory candidates, or rejected inputs.
3. Which parts of the flow are deterministic rules, which parts are AI-assisted
   explanation, and which parts require human review.

## Signal Path

```text
source system
  -> collection posture
  -> normalization
  -> object link
  -> signal validity gate
  -> judgement
  -> review packet / candidate action / report / memory candidate
  -> human decision
  -> receipt / outcome / learning candidate
```

## Required Boundaries

- No automatic external send.
- No automatic approval.
- No automatic settlement.
- No LLM final ranking on commitment paths.
- No cross-workspace aggregation by default.
- No route adoption without explicit release evidence.
- Fixture-backed demos must stay visibly marked as fixture-backed.

## Public Data Model Expectations

Every displayed signal should carry:

- stable signal key
- source family
- sourceRef
- observed time
- subject
- confidence
- gap fields
- object link or rejection reason
- evidence posture
- review state
- owner or reviewer routing where applicable
- boundary note

Raw customer data, customer-specific identifiers, production URLs, private
domains, and private deployment receipts do not belong in the public Core
contract.

## Source Governance Matrix

The flow map must distinguish source governance before it displays a signal as a
learning candidate, review packet, or operator risk:

| Source class | Allowed surface | Forbidden surface | Required gate |
|---|---|---|---|
| `fleet_customer_health` | Internal operator triage, support readiness, advice-only risk review | Expert eval, model improvement, memory promotion, training, automatic customer-facing action | Reversible alias salt lifecycle, role access, decode audit, `customerConsentScopeRef` |
| `self_dogfood_health` | Dogfood review and candidate improvement material | HR / performance evaluation, person-level promotion | Technical de-identification plus `EvalCasePromotion` scanner + human signoff |
| `synthetic_public` | Public fixtures, public eval, demo validation | Real-customer evidence claims | Fixture marker and public-release scan |
| `deidentified_promoted_case` | Held-out eval, regression eval | Any use without human-reviewed de-identification | Passing `EvalCasePromotion` |
| `oss_governance` | GitHub / docs governance | Helm tenant ingestion, customer diagnosis, expert improvement | Explicit non-goal routing |

Operator intervention stays advice-only. If Helm sees a customer fleet risk, the
operator view may prepare an internal review note or support readiness task, but any
customer-visible action must still go through the normal tenant approval path. The
flow map must not let operator access bypass `recommendation != commitment`.

## Current Public Status

`helm-public` may include the Core contract, fixtures, and public-safe tests for
this flow. Private customer adoption packets, role receipts, browser evidence,
and internal runtime rollout records stay outside this repository.

## Acceptance Checks

For public Core changes touching the signal flow:

- `npm run check:public-docs`
- `npm run check:public-release`
- `npm run typecheck`
- `npm run test`
- `npm run build`

If a change proposes runtime adoption, external side effects, or customer-visible
claims, it must first be handled through a separate owner review path outside
this public contract.
