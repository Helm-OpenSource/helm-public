---
status: active
owner: helm-core
created: 2026-06-02
review_after: 2026-07-02
public_safety: Public Core operating model. This is not a release approval, commercial commitment, production SLA, customer deployment proof, or private delivery runbook.
---
# Helm Public Open Source Operating Model / Helm 公开开源运营模型

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文定义 `Helm-OpenSource/helm-public` 的公开 Core 使命、方向、
运营方法和第一层 OKR / KPI 闭环。它只适用于 Apache-2.0 Core 仓库，
不批准 Helm Cloud、Helm Enterprise、认证伙伴状态、生产服务等级承诺、
客户部署就绪、自动对外发送、自动批准、自动结算、市场或插件沙箱。

Helm 公开 Core 的使命是帮助交付工程师把企业 AI 运营工作转成
可复刻、有证据支撑、复核优先的运营闭环。运营方式必须坚持：
先建立信任再扩大规模、先激活再触达、先贡献再扩张、
用证据推进集成，以及边界明确的开放核心。

所有公开运营变更默认通过小 PR、公开守卫、夹具证据或激活回执
证明；高风险措辞、商业姿态、安全细节和外部承诺必须走负责人闸门。
KPI 是运营目标，不是公开服务等级承诺；触达指标不能替代激活证据。

方向摘要：先建立信任再扩大规模；先用克隆、运行、夹具和首次改动证明激活，
再看星标、复刻和克隆数这类触达信号；先让贡献者能理解、验证和复核小能力，
再扩张平台面；集成必须从来源对象、数据流、夹具、预演和复核边界开始；
商业路径必须保持可选且有清晰边界，不能暗示 Helm Cloud、Helm Enterprise、
服务等级承诺或客户承诺已经就绪。

OKR 摘要：公开 Core 要保持可信且可合并；第一条交付工程师闭环要可复现；
贡献者入口要变成可靠运营队列；生态方向要避免不安全承诺；开放核心商业路径
必须由证据门禁推进；周度运营包只汇总 PR 队列、激活证据、风险、请求决策和
受控执行队列，决策必须和建议分开。

协作分工摘要：维护者执行负责小 PR、检查、复核和受保护分支纪律；产品负责
公开 Core 范围、用户路径和能力优先级；商业化负责不削弱 Apache-2.0 Core 的
开放核心路径；增长运营先把公开可见性转成激活和首次改动证据；OPC 和市场领导
把跨职能证据转成负责人决策和受控执行；发布质量、安全、开发者体验、社区运营、
指标运营和生态集成架构分别提供门禁、文档、分类、事实和复核优先的集成路径。

## English Reference

This document defines the public Core mission, direction, operating method, and
first OKR / KPI loop for `Helm-OpenSource/helm-public`.

It is an operating model for the Apache-2.0 Core repository. It does not approve
Helm Cloud, Helm Enterprise, certified partner status, production SLA, customer
deployment readiness, automatic external send, automatic approval, automatic
settlement, marketplace, or plugin sandbox capabilities.

## Mission

Helm Public Core helps delivery engineers turn enterprise AI operations work
into a forkable, evidence-backed, review-first operating loop.

The repository should make it practical to inspect, run, adapt, and contribute
to a reference implementation that keeps judgement, evidence, review, and
boundary discipline visible in code, docs, fixtures, and checks.

## Direction

| Direction | Meaning | Boundary |
| --- | --- | --- |
| Trust before scale | Every public improvement should preserve public/private boundary guards, review-first posture, and required checks | No private customer data, private domains, credentials, or deployment evidence |
| Activation before reach | A verified clone / run / fixture / first-change path matters more than broad awareness | Stars, forks, and clones are reach signals only |
| Contribution before expansion | The next useful capability should be small enough for a contributor to understand, verify, and review | No broad platform expansion without evidence and owner gate |
| Integration by evidence | New integration directions start with source object, data flow, fixture, dry-run, and review-first boundary | No roadmap commitment or automatic external action |
| Open-core with explicit boundary | Apache-2.0 Core remains useful on its own; commercial paths stay optional and clearly gated | Commercial wording must not imply Cloud, Enterprise, SLA, or customer commitment readiness |

## Method

Helm Public Core operates through small, reviewable loops:

1. Define the user-facing outcome and boundary.
2. Make the smallest public-safe change.
3. Prove it with repository checks, fixture evidence, or activation receipts.
4. Record the result in the public docs surface when it changes public posture.
5. Route risky wording, commercial posture, security details, and external
   commitments through owner gate.

Default verification for public docs or operating changes:

```bash
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
```

Runtime, fixture, or application behavior changes should add the relevant build,
test, fixture, eval, or smoke verification before review.

## North Star

The north-star operating signal is:

> A delivery engineer can independently clone Helm Public Core, run the Golden
> Path, understand the review-first boundary, make a synthetic sample change,
> and produce a public-safe contribution or activation report.

This is an activation signal, not a commercial commitment.

## Project OKRs

| Objective | Key Results | Primary KPIs | Lead workstreams |
| --- | --- | --- | --- |
| O1. Keep Public Core trustworthy and mergeable | Required checks pass before merge review; public/private guard failures stay at zero in merged PRs; public docs additions stay allowlisted; release blockers have owner-visible status | Required-check pass rate; public guard failures; stale PR count; mean time to unblock checks | Maintainer execution, release quality and security |
| O2. Make the first delivery-engineer loop reproducible | Fresh clone path remains documented; Golden Path commands remain runnable; sample-pack first change is understandable; activation receipts classify success, blocker, or friction | Time to first sample proof; activation reports; reproducible blocker count; first-change completion rate | Developer experience and docs, growth operations |
| O3. Turn contributors into a reliable operating queue | Public intake routes bugs, docs friction, Golden Path reports, integration requests, and security/private reports to the right path; first responses stay boundary-aware; accepted work is small and reviewable | Open issue age; first response target; triage completeness; PR review readiness | Community and contributor operations, maintainer execution |
| O4. Build ecosystem direction without unsafe commitments | Candidate integrations use source-object, data-flow, fixture, dry-run, auth-scope, and review-first boundary tables before implementation; out-of-scope requests are parked clearly | Integration requests with complete boundary table; fixture-backed RFCs; unsafe commitment corrections | Ecosystem integration architecture, product |
| O5. Establish an evidence-gated open-core business path | Commercial options remain optional and boundary-noted; monetization sequencing depends on activation evidence; no public wording implies unapproved Cloud, Enterprise, SLA, certification, or customer deployment readiness | Owner-gated commercial decisions; boundary-note coverage; activation evidence before commercial launch steps | Monetization, product, OPC |
| O6. Run the project as an owner-gated operating system | Weekly operating packets summarize PR queue, activation evidence, risks, decisions requested, and controlled execution queue; decisions are separated from recommendations | Weekly packet completion; owner decisions requested; execution queue completion; unresolved risk age | OPC, metrics and ops intelligence |

## Workstream Decomposition

| Workstream | Mission | First 30-day OKR | KPI focus | Collaboration contract |
| --- | --- | --- | --- | --- |
| Maintainer execution | Keep the repository moving through small PRs, checks, review, and protected-branch discipline | All public-operating PRs are reviewable, check-backed, and free of mixed-scope changes | PR queue health; required checks; review readiness | Consumes all packets; does not override owner gate |
| Product | Define public Core product scope, user paths, and capability priority | Delivery engineer, maintainer, and contributor paths are ranked with explicit boundary notes | Product priority clarity; unresolved scope questions | Consumes activation, DX, metrics, and integration evidence |
| Monetization | Design open-core business paths without weakening Apache-2.0 Core | Commercial options are sequenced by activation evidence and owner gate | Commercial boundary coverage; gated decision count | Does not publish commercial commitments without owner decision |
| Growth operations | Convert public visibility into activation and first-change evidence | First-week growth loop prioritizes clone / run / sample proof / public-safe report | Activation reports; first-change funnel; friction count | Uses metrics and DX evidence before public messaging |
| OPC and market leadership | Turn cross-functional evidence into owner decisions and controlled execution | Weekly packet lists market-leading evidence, risks, and top execution queue | Packet cadence; owner decisions; controlled queue completion | Coordinates workstreams; does not replace their execution |
| Release quality and security | Hold release train, branch protection, security intake, and public boundary posture | Required checks and public release guards remain visible before merge | Check pass rate; blocker MTTR; security/private routing | Blocks unsafe changes; escalates owner-gated risks |
| Developer experience and docs | Make clone, quickstart, Golden Path, sample pack, and first PR clear | A new contributor can complete the first sample proof with public-safe docs | Time to first proof; docs friction; manifest compliance | Sends friction to product and growth; avoids marketing copy |
| Community and contributor operations | Convert issue, PR, and discussion intake into reviewable queues | Public intake routes are classified, boundary-aware, and contributor-friendly | First response target; triage completeness; reopened issues | Does not create external commitments or remote labels without owner gate |
| Metrics and ops intelligence | Provide public-safe evidence for decisions | Weekly metrics distinguish activation evidence from reach signals | Activation vs reach split; PR/check queue; risk age | Supplies facts, not commitments |
| Ecosystem integration architecture | Shape integrations as read-first or review-first, fixture-proven paths | Top integration candidates have RFC-ready boundary and fixture plans | Complete boundary tables; fixture plans; unsafe-action exclusions | Feeds product, community, and monetization without roadmap promises |

## KPI Rules

- KPIs are operating targets, not public SLA commitments.
- Reach metrics cannot substitute for activation evidence.
- Commercial KPIs cannot override open-source boundary discipline.
- Security/private reports must not be summarized with sensitive detail in public
  docs, issues, or PR bodies.
- A KPI is valid only when its data source is public-safe: repository checks,
  public PRs, public issues, public discussions, synthetic fixtures, or
  owner-approved redacted receipts.

## First Operating Cadence

| Cadence | Output |
| --- | --- |
| Daily during public launch week | PR/check queue, blockers, activation friction, owner decisions needed |
| Weekly | OPC packet with OKR/KPI readout, risks, and controlled execution queue |
| Per PR | Boundary check, verification receipt, scope statement, and remaining risk |
| Per public doc addition | Manifest update, docs index review, public-release guard pass |
| Per integration request | Source object, data flow, review-first boundary, fixture or dry-run plan |

## Owner Gate

Owner review is required before:

- public Cloud, Enterprise, SLA, certification, roadmap, pricing, or customer
  deployment wording;
- protected-branch break-glass merge;
- security detail disclosure;
- external send, auto-write, automatic approval, settlement, marketplace, or
  plugin sandbox claims;
- any use of non-public customer, tenant, deployment, or contact evidence.

## Current Status Classification

| Tier | Items |
| --- | --- |
| Already established | Apache-2.0 Core repository, public docs allowlist, public/private boundary guard, Golden Path requirements |
| Formed but needs next layer | Operating model, OKR/KPI loop, workstream decomposition, activation evidence loop, integration request loop |
| Deliberately not done | Cloud / Enterprise readiness approval, production SLA, marketplace, plugin sandbox, automatic external commitment paths |
| Risks | Over-claiming commercial readiness, using reach metrics as proof, broad integration promises, stale check requirements, mixed-scope PRs |

## Change Log

- 2026-06-02: Established the first public Core mission, direction, OKR/KPI,
  workstream, and owner-gated operating model.
