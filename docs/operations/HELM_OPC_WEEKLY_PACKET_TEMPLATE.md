---
status: active
owner: helm-core
created: 2026-06-02
review_after: 2026-07-02
public_safety: Public OPC packet template. Use only public repository metadata, public issues, public discussions, synthetic sample-pack signals, and public-safe command receipts. Do not include customer data, private contacts, private deployment evidence, credentials, or automatic external commitments.
---
# Helm OPC Weekly Packet Template / Helm OPC 周报 Packet 模板

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本模板把 `helm-public` 的公开运营转成 owner-gated、proof-first、
controlled-execution loop。它不是 release approval、customer commitment、Cloud /
Enterprise readiness statement、SLA、automatic outbound campaign、certification
approval 或 private delivery runbook。

OPC 周报必须把 owner gate、proof packet 和 controlled execution 分开：Codex 可以准备
证据和 queue，但不能替 owner 做外部承诺；proof packet 只能收集 public-safe facts、
command receipts、issue / PR state、activation blockers 和 contributor signals；执行
只能转成小 PR，并且不能 direct push protected branch，也不能绕过 verification。

中国访问性 receipt 只有在 owner-approved exact copy、channel、timing、responsible
person 和 no-go confirmation 等字段齐全时才可记录。WeChat、QR 和 community contact
仍然只是 reach / contact 或 assisted signal，除非后续产生 GitHub public-safe evidence
或 owner-approved redacted receipt。

## English Reference

This template turns public `helm-public` operation into an owner-gated,
proof-first, controlled-execution loop.

It is not a release approval, customer commitment, Cloud / Enterprise readiness
statement, SLA, automatic outbound campaign, certification approval, or private
delivery runbook.

## OPC Roles

| Role | Responsibility | Boundary |
| --- | --- | --- |
| Owner gate | Decide external wording, certification, release posture, roadmap priority, and high-risk boundary changes | Codex prepares evidence; it does not make external commitments |
| Proof packet | Collect public-safe facts, command receipts, issue / PR state, activation blockers, and contributor signals | No private proof, customer data, credentials, or private deployment evidence |
| Controlled execution | Convert approved work into small PRs with checks and review | No direct push to protected branches and no `--no-verify` bypass |

## Week Window

| Field | Value |
| --- | --- |
| Week | `YYYY-MM-DD` to `YYYY-MM-DD` |
| Prepared by |  |
| Repo / branch | `Helm-OpenSource/helm-public` /  |
| Base commit |  |
| Related PRs |  |

## Evidence Snapshot

| Area | Current Evidence | Interpretation |
| --- | --- | --- |
| Repository health |  |  |
| Open PR queue |  |  |
| Open issue queue |  |  |
| Discussions |  |  |
| Release posture |  |  |
| Required checks |  |  |
| Public docs curation |  |  |
| Golden Path activation |  |  |

## Activation And Market Signals

Use activation evidence before reach metrics.

| Signal | Count / Link | Quality Readout |
| --- | --- | --- |
| Independent `docker compose up` reports |  |  |
| `npm run delivery:doctor` reports |  |  |
| `npm run pack:fixture-check` reports |  |  |
| `npm run eval:headless-signal-interface` reports |  |  |
| Reproducible blocker issues |  |  |
| Integration requests |  |  |
| Discussions with delivery-engineer context |  |  |
| Stars / forks / clones |  | Reach signal only |

## Owner-Gated China Access Receipt

Use this section only when owner-approved China-market access guidance has all
six execution fields. A draft copy, copy hash, or CPO / Monetization pass is not
execution authorization by itself.

| Field | Receipt |
| --- | --- |
| Owner approved exact copy verbatim |  |
| Approved channel |  |
| Timing / window |  |
| Responsible person or account |  |
| One-time manual access guidance only |  |
| No-go confirmation | No #49 repost, no README / docs / template change, no overseas outreach, no service, response, deployment, or business commitment wording |
| Forbidden wording checked | No pricing, SLA, Cloud, Enterprise, Certified, support, training, services, customer deployment, private implementation, commercial path, response commitment, or roadmap commitment wording |
| WeChat / community misuse checked | Not an evidence store, support channel, private-information intake path, commercial communication path, or activation proof |
| Exact copy SHA-256 |  |
| Execution timestamp |  |
| Confirmation that no extra wording was added |  |
| Public-safe GitHub evidence produced |  |
| Assisted reach / contact signal only |  |

WeChat, QR, and community contact remain reach / contact or assisted signals
unless they later produce GitHub public-safe evidence or an owner-approved
redacted receipt. Do not copy private data, credentials, private domains,
deployment details, or security details into public repo surfaces.
WeChat-only or community-only contact is not activation proof.

## Queue Classification

| Queue | Items | Owner Decision Needed |
| --- | --- | --- |
| P0 - Public safety or broken activation |  |  |
| P1 - Contribution quality or first-change path |  |  |
| P2 - Docs, routing, metadata, or polish |  |  |
| Parked - Out of public Core scope |  |  |

## Four-Tier Readout

| Tier | Items |
| --- | --- |
| Already established |  |
| Formed but needs next layer |  |
| Deliberately not done |  |
| Risks |  |

## Owner Decisions Requested

| Decision | Options | Recommended Option | Evidence | Risk If Delayed |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Controlled Execution Queue

Each accepted item should be small enough for one PR.

| Task | Acceptance Criteria | Verification | Files Likely Touched |
| --- | --- | --- | --- |
|  |  |  |  |

## Verification Receipts

Minimum for public docs or governance changes:

```bash
npm run check:public-docs
npm run check:public-release
```

Full repository validation remains:

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

If a command did not run, record the reason and remaining risk.

## Public-Safety Review

- [ ] No customer names, private contacts, private domains, internal IPs,
      credentials, private deployment evidence, or commercial Pack / Overlay
      implementation details.
- [ ] No production SLA, Cloud / Enterprise readiness claim, customer deployment
      proof, or time-bound commercial commitment.
- [ ] No automatic external send, broad auto-write, automatic approval,
      execution, settlement, marketplace, plugin sandbox, or customer commitment
      path.
- [ ] Any customer-facing wording keeps recommendation separate from commitment.
- [ ] Any new public doc is listed in
      [public-docs-manifest.json](../public-docs-manifest.json).

## Links For This Loop

- [Public status truth table](../STATUS.md)
- [Public docs index](../README.md)
- [Golden Path issue template](../../.github/ISSUE_TEMPLATE/golden-path.yml)
- [Integration request issue template](../../.github/ISSUE_TEMPLATE/integration-request.yml)
- [Pull request template](../../.github/pull_request_template.md)
