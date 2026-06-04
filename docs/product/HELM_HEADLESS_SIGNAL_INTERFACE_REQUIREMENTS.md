---
status: active
owner: Product / Delivery Engineering / Engineering
created: 2026-05-20
last_reviewed: 2026-06-01
review_after: 2026-06-15
public_closeout: ../reviews/HELM_AI_NATIVE_B2B_ARTIFACT_TEMPLATES_CLOSEOUT.md
review_history: Historical source-repo review receipts are not part of the curated public docs surface.
archive_trigger:
  - A newer public Headless Signal Interface contract replaces this document
  - Helm no longer uses the delivery-engineer-facing open-core motion
  - This document is misused to authorize production writes, hosted MCP, or auto-execution
---

# Helm Headless Signal Interface Requirements / Helm Headless Signal Interface 要求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

Helm 无头信号接口（HSI）是公开、可复刻的契约，帮助交付工程师把既有业务系统转成
复核优先的运营信号。它不是客户关系系统替代品、托管智能体运行时、工作流引擎、市场
或执行平面。

HSI 的公开契约只覆盖包清单、合成 / 脱敏夹具、确定性评测门禁、复核包准备，
以及客户试点前可检查的边界证据。它的第一目标是让交付闭环可诊断：

```text
复刻 Helm
  -> 检查样板包
  -> 把来源字段映射到安全夹具
  -> 运行 HSI 评测
  -> 检查运营信号输出
  -> 准备复核包
  -> 判断是否已经可以进入受控试点
```

通过 HSI 契约是客户部署的必要但不充分条件。第一阶段保持仅离线，不授权运行时查询、
API 路由、数据模式迁移、生产连接器、托管 MCP、正式写入、自动发送、自动批准、自动执行
或大模型最终排名。

## English Reference

## 0. Public Thesis

Helm Headless Signal Interface is the public, forkable contract that helps delivery engineers turn existing business systems into review-first operating signals.

It is not a CRM replacement, hosted agent runtime, workflow engine, marketplace, or execution plane. It is a checked-in contract for:

1. Pack manifests.
2. Synthetic or redacted fixtures.
3. Deterministic eval gates.
4. Review packet preparation.
5. Boundary evidence that can be inspected before any customer-facing pilot.

The goal is to make the first delivery loop diagnosable:

```text
fork Helm
  -> inspect sample pack
  -> map source fields into safe fixtures
  -> run HSI eval
  -> inspect operating signal output
  -> prepare review packet
  -> decide whether a controlled pilot is ready
```

Passing this contract is necessary but not sufficient for a customer deployment.

## 1. Current Public Repo Truth

1. Helm is positioned for delivery engineers building enterprise AI operations systems on top of AI platforms and LLM frameworks.
2. `extensions/case-management-sample/` is the minimum public reference pack.
3. `evals/headless-signal-interface/headless-signal-interface-cases.json` is the public offline fixture pack for HSI.
4. `scripts/headless-signal-interface-evals.ts` is the local read-only eval wrapper.
5. HSI Phase 1 is offline-only. It does not authorize runtime queries, API routes, schema migrations, production connectors, hosted MCP, official writes, auto-send, auto-approve, auto-execute, or LLM final ranking.

## 2. Target Users

| User | What HSI helps with | What HSI does not grant |
|---|---|---|
| Delivery engineer adopter | Fork a sample pack and map a customer source into safe fixtures | Access to customer data or production credentials |
| Pack contributor | Add generic fixtures, mapper examples, eval cases, or docs | Certified partner status or customer outcome claims |
| Customer reviewer | Understand signal evidence, missing information, risks, and review surfaces | Tool-catalog access or raw logs |
| Security / data reviewer | Inspect redaction posture, boundary incidents, and eval output | Approval for live data processing |

## 3. Product Principles

1. **Pack before facade**: prove the pack shape with fixtures and evals before defining any runtime facade.
2. **Signal first, action second**: project evidence, owners, blockers, and review surfaces before any action proposal.
3. **Review packet is not execution**: preparing a packet never means approval, send, writeback, commitment, or execution.
4. **Synthetic / redacted by default**: public examples must not contain raw customer data, secrets, private domains, intranet IPs, or deployment details.
5. **Deterministic before LLM**: routing, boundary classification, and allowed next surface must be deterministic before any model explanation.
6. **Single-workspace by default**: cross-workspace aggregation is not part of this public contract.

## 4. Phase 1 Pack Contract

Every HSI-compatible pack should be able to provide:

| Artifact | Minimum expectation |
|---|---|
| Pack manifest | `packId`, display name, source kinds, signal families, review surfaces, owner role, data posture |
| Fixtures | Positive, empty, degraded, boundary, sensitive, duplicate / conflict, stale, and owner-missing cases |
| Payload examples | Synthetic, redacted, or alias-only input / output examples |
| Eval | Authority leak, sensitive leak, cross-workspace, forbidden action, determinism, non-scripted sequence, review packet completeness |
| Review packet template | Evidence refs, risks, missing info, allowed next surface, forbidden actions, human reviewer requirement |
| Implementation checklist | Source authorization, redaction owner, reviewer, rollback path, data policy posture, demo data posture |

## 5. Signal Families

| Family | Meaning |
|---|---|
| `commitment_missing` | A commitment appears in a source but lacks a reviewable follow-up path |
| `stage_or_status_stale` | Source evidence and system status have drifted |
| `approval_blocked` | A decision, quote, contract, delivery step, or risk item waits for review |
| `owner_mismatch` | CRM owner, meeting owner, delivery owner, or reviewer do not align |
| `duplicate_or_conflict` | Multiple records or evidence sources disagree |
| `boundary_attempt` | A user, agent, or integration asks for silent write, auto-send, auto-approve, or unsafe projection |

## 6. Source Adapter Posture

HSI is source-agnostic. Email, meetings, collaboration tools, CRM, spreadsheets, vertical systems, and external agent output are all treated as evidence candidates.

Allowed:

1. Read synthetic or redacted examples.
2. Project operating signal snapshots.
3. Prepare review packets.
4. Explain why a proposed action is allowed, downgraded, or forbidden.

Not allowed:

1. Send messages.
2. Approve items.
3. Write CRM stages.
4. Create contracts.
5. Settle payments.
6. Auto-assign owners.
7. Promote candidate evidence to official memory.

## 7. Eval Gate

`npm run eval:headless-signal-interface` must stay read-only and offline. A passing result proves only that the checked-in fixtures satisfy the current public HSI contract.

It does not prove:

1. Customer deployment readiness.
2. Data Protection approval.
3. Required Reviewer approval.
4. Fresh-clone Docker onboarding.
5. Production connector safety.
6. Public claim readiness.

## 8. Stage Gates

| Stage | Allowed | Not allowed | Evidence |
|---|---|---|---|
| Phase 1 offline contract | Fixtures, manifest checks, deterministic eval | Runtime, API, schema, connector, network, LLM call | `eval:headless-signal-interface` |
| Phase 2 local preview | Fixture-backed local preview | Production credentials, official write, hosted MCP | Local read-only receipt |
| Phase 3 redacted calibration | Redacted sample review, data posture review | Silent write, raw data by default, cross-workspace aggregation | Calibration packet + approvals |
| Phase 4 controlled pilot | Explicit owner-approved pilot | Auto-send, auto-approve, auto-execute | Pilot agreement + rollback path |

## 9. Change Log

| Date | Change |
|---|---|
| 2026-06-01 | Public-safe projection restored in `helm-public` so Golden Path doctor can verify the HSI requirement anchor without importing private implementation context |
