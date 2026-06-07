---
status: active
owner: helm-core
created: 2026-06-07
review_after: 2026-07-07
public_safety: Public Core release-readiness receipt checklist only. Does not include private deployment receipts, credentials, customer approvals, production endpoints, SLA claims, or commercial release approval.
---

# Release Readiness Receipt Checklist / 发布就绪回执清单

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 1. 定位

本清单用于区分 automated gate、review receipt、owner Go/No-Go 与真实发布动作。
它是 public Core 的复核清单，不是商业发布批准、生产 SLA、客户部署证明、私有部署回执、
凭据轮换回执或 owner 决策记录本身。

核心规则：

> 自动化检查通过不等于 release-ready。Release-ready 需要 automated gates、PR review、
> public-safe receipts、STATUS truth、owner-held decision 全部对齐。

## 2. Automated Gate Receipts

发布候选至少需要记录以下自动化命令的结果。失败时必须写明阻断项和补跑计划。

| Gate | Receipt expectation | Boundary |
|---|---|---|
| `npm run check:public-docs` | Public docs allowlist and links pass | Does not prove private docs are safe |
| `npm run check:public-release` | Public mirror scanner has no blockers | Does not prove commercial release approval |
| `npm run check:boundaries` | Repository hard boundary gate passes | Does not replace PR review |
| `npm run typecheck` | TypeScript public project passes | Does not prove runtime behavior |
| `npm run lint` | Lint passes or blocker is documented | Does not authorize release |
| `npm run test` | Public test suite passes | Does not prove customer deployment readiness |
| `npm run build` | Production build passes | Does not prove production SLA |
| `npm run e2e` | Public e2e smoke passes | Does not prove private overlay readiness |
| `npm run quality:regression` | Public guard regression passes | Does not replace owner Go/No-Go |

If a command cannot run locally, the receipt must state why, what risk remains, and which environment or
human owner must finish it.

## 3. Manual Receipts

Automated green is insufficient without these manual receipts:

| Receipt | Required evidence |
|---|---|
| PR review | Review status, reviewer identity or public-safe alias, and unresolved comment state |
| Branch protection | Confirmation that changes merge through PR path; no direct protected-branch push |
| Public safety review | No secrets, tenant slugs, private hostnames, customer data, production URLs, or deployment receipts in public files |
| Docs truth | `docs/STATUS.md`, `docs/README.md`, and manifest updated when public state changes |
| Scope discipline | No unrelated WIP staged, no cross-repo writes from the wrong repo |
| Owner Go/No-Go | Explicit owner-held receipt if the action claims launch, visibility, commercial release, or customer readiness |

## 4. Forbidden Release Claims

The following claims must not be made from automated checks alone:

- public Core is commercially released
- Helm Cloud or Enterprise is production ready
- customer deployment is ready
- production SLA is active
- private Pack / Overlay / control-plane readiness is established
- connector activation is approved
- customer-visible send, approval, settlement, or commitment is authorized
- branch protection has been bypassed safely without a PR audit trail

## 5. Receipt Template

Use this structure in PR bodies, closeout reports, or owner packets:

```text
Release-readiness receipt:
- Candidate branch / PR:
- Commit:
- Automated gates:
- Failed or skipped gates:
- Public-safety scan:
- Docs truth updated:
- Reviewer receipt:
- Owner Go/No-Go:
- Known gaps:
- Boundary statement:
```

The boundary statement must explicitly say whether this is public Core readiness,
customer deployment readiness, commercial release approval, or only a narrower proof.

## 6. Agentic Governance Use

Agentic implementation runs must treat this checklist as a guard against overclaim:

- A green command result may enter an `AgentRunCapsule` as validation evidence.
- It must not become owner approval, release approval, customer commitment, or deployment proof.
- Missing manual receipt should be recorded as `missingEvidence` or `blockedAction`, not rewritten as success.
- Any agent summary that says "release-ready" must cite the owner-held receipt or downgrade the claim.

## English Reference

This checklist separates automated gates from release readiness. Passing public checks is evidence, not
approval. Release-ready requires automated gates, PR review, public-safe receipts, docs truth, and owner-held
decision to align. It does not establish commercial release approval, production SLA, customer deployment
readiness, private Pack / Overlay readiness, connector activation, or customer-visible commitments.

## Change Log

| Date | Change |
|---|---|
| 2026-06-07 | Added public release-readiness receipt checklist as an agentic governance messaging scan anchor. |
