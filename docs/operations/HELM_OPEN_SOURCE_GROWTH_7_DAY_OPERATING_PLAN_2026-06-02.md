---
status: active
owner: helm-growth
created: 2026-06-02
review_after: 2026-06-09
public_safety: Public open-source growth operating plan. Uses public repository, docs, issues, discussions, and synthetic sample-pack signals only; no customer data, private deployment evidence, private contact lists, credentials, or automatic external commitments.
---
# Helm Open Source Growth 7-Day Operating Plan / Helm 开源增长 7 日运营计划 - 2026-06-02

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文是 `helm-public` 在 2026-06-01 公开之后的第一份 public-Core growth
operating plan。它是 awareness、activation、community intake 和 friction removal
的执行计划，不是客户承诺、商业 launch approval、Cloud / Enterprise readiness
statement、SLA、融资材料或自动 outbound campaign。

7 日目标是把公开 launch 转成可度量的 delivery engineer activation loop：读者能在
一屏理解 Helm 定位，能跑本地 Golden Path 并检查 synthetic sample pack，反馈能通过
GitHub Issues / Discussions 带边界进入，维护者按 activation friction 而非 vanity
metrics 排序增长工作。

增长工作必须优先优化 comprehension、activation 和 contribution quality。Stars、
forks、clones 只算 reach signal；不能用它们替代独立运行、fixture change、public-safe
report 或可复现 blocker 这类 activation proof。

## English Reference

This is the first public-Core growth operating plan after `helm-public` became
public on 2026-06-01. It is an execution plan for awareness, activation,
community intake, and friction removal. It is not a customer commitment,
commercial launch approval, Cloud / Enterprise readiness statement, SLA,
fundraising material, or automatic outbound campaign.

## Objective

Within seven calendar days, turn the public launch into a measurable delivery
engineer activation loop:

1. A delivery engineer can understand Helm's position in one screen.
2. A delivery engineer can run the local Golden Path and inspect a synthetic
   sample pack.
3. Public feedback enters GitHub Issues / Discussions with clear boundaries.
4. Maintainers can rank growth work by activation friction, not vanity metrics.

## Impacted Components

| Component | Growth Purpose | Boundary |
| --- | --- | --- |
| `README.md` | First-screen positioning and first-run conversion | No customer promises, no private proof, no time-bound delivery claims |
| `docs/README.md` | Public docs wayfinding | Only curated docs listed in `docs/public-docs-manifest.json` |
| GitHub Issues | Structured contributor and integration intake | No automatic roadmap commitment |
| GitHub Discussions | Community Q&A and launch conversation | Human-moderated, no support SLA claim |
| `extensions/case-management-sample/` | First forkable proof surface | Synthetic sample only; provenance under review until gate is complete |
| Golden Path commands | Activation proof | Local, review-first checks only; not Cloud / Enterprise readiness |

## Key Assumptions

- The repository is public after owner Go/No-Go on 2026-06-01.
- Public Core stays Apache-2.0, independently buildable, and public-safe.
- The primary audience is AI delivery engineers, not direct SaaS buyers.
- Growth work should improve comprehension, activation, and contribution
  quality before optimizing broad reach.
- Public claims must remain evidence-gated: recommendation is not commitment,
  review packet is not approval, and no automatic external send / approval /
  settlement / execution path is implied.

## Operating Roles

| Role | Responsibility | First 7-Day Output |
| --- | --- | --- |
| Growth lead | Message, channel plan, metric readout, prioritization | Daily growth log and day-7 readout |
| Maintainer | Public issue / discussion triage and boundary enforcement | Triage labels, template routing, owner-gated responses |
| Docs owner | README and docs conversion fixes | Small PRs that remove activation ambiguity |
| Verification owner | Golden Path and public guard checks | Reproducible command receipts |
| Reviewer | Public-safety and non-commitment review | PR review before any public-facing wording change |

## Metrics

Primary metrics:

- Activation proof: number of independent local runs that report one of:
  `docker compose up`, `npm run delivery:doctor`, `npm run pack:fixture-check`,
  or `npm run eval:headless-signal-interface`.
- Friction queue quality: number of concrete, reproducible blockers captured in
  public issues.
- Community routing: number of questions routed to Issues, Discussions, or
  private security disclosure correctly.
- Contribution readiness: number of first PRs or issue comments that include
  scope, boundary, verification, and rights-to-contribute confirmation.

Secondary metrics:

- README first-screen comprehension feedback from delivery engineers.
- Discussion participation.
- Stars, forks, and clones, treated as reach signals only.

Do not optimize for:

- Unqualified star growth.
- Broad social posting without a runnable activation path.
- Customer-logo or private-deployment proof.
- Time-bound commercial commitments.

## Seven-Day Plan

| Day | Focus | Actions | Public Artifact | Verification |
| --- | --- | --- | --- | --- |
| Day 1 - Baseline | Establish the growth control loop | Record current public repo, issue, discussion, README, quickstart, and release posture; confirm active risks from maintainer status | This plan plus maintainer status link | `npm run check:public-docs`; `npm run check:public-release` |
| Day 2 - Activation path | Remove first-run ambiguity | Make the first fork path explicit: clone, run, inspect `/operating`, change one synthetic fixture, rerun checks | README or docs PR if ambiguity is found | `docker compose up`; `npm run delivery:doctor`; `npm run pack:fixture-check` |
| Day 3 - Community intake | Turn attention into structured feedback | Add or refine issue / PR templates for bug, docs, integration request, and contribution boundary confirmation | `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md` | Template dry-run through GitHub UI or local file review |
| Day 4 - Launch narrative | Publish owner-gated public narrative | Prepare concise announcement variants for GitHub Discussion, X / LinkedIn / WeChat, and delivery-engineer communities | Public launch copy drafts; no automatic posting | Human review for non-commitment wording |
| Day 5 - First contributor path | Make the first good issue credible | Keep issue #39 active, add reproduction criteria, and identify the smallest doc or fixture PR that an outside contributor can complete | Issue update or small PR | Maintainer review plus boundary check |
| Day 6 - Friction burn-down | Convert feedback into small fixes | Rank top activation blockers by reproducibility and fix only the smallest public-Core blockers | Small PRs with receipts | Targeted command receipts plus public guards |
| Day 7 - Readout | Decide next operating queue | Summarize activation proofs, friction themes, community routing quality, and next five growth moves | Day-7 growth readout document | Public-safe review; no private proof included |

## Channel Plan

| Channel | Purpose | Message Shape | Guardrail |
| --- | --- | --- | --- |
| GitHub Discussion | Canonical launch conversation | "Helm Public Core is open source; here is how to run and inspect it" | No support SLA |
| GitHub Issues | Bugs, docs fixes, integration requests | Repro steps, boundary, expected result, verification | No roadmap promise |
| WeChat | Founder-led community and commercial contact | Human-routed contact for community / partnership | No automatic send or customer commitment |
| Developer social posts | Awareness and repeatable quickstart | Positioning plus runnable commands | No customer logos or private deployment proof |
| Delivery-engineer communities | Deep technical activation | Fork path, sample pack, review-first discipline | No claim that Helm replaces platforms |

## Growth Backlog

| Priority | Work | Why It Matters | Acceptance Criteria |
| --- | --- | --- | --- |
| P0 | Issue and PR templates | Public contributors need structured intake | Templates require scope, boundary, verification, and rights confirmation |
| P0 | README first-change walkthrough | Activation requires a concrete "change this, run that, observe this" path | A new user can modify one synthetic fixture and rerun local checks |
| P1 | Integration request template | Integrations are likely early demand | Requests must state use case, data flow, and review-first boundary |
| P1 | Discussion launch thread routing | Questions need a canonical public home | README and launch docs point to the right thread |
| P1 | Day-7 growth readout | Maintainers need evidence, not anecdotes | Readout includes activation proofs, blockers, decisions, and next five moves |
| P2 | Fork-and-rename guide | Forkers need a clean adaptation story | Guide avoids Pack / Overlay / private deployment leakage |

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Messaging looks like a SaaS promise | Misaligned buyer expectations | Keep "delivery engineer reference implementation" first; include non-claims |
| Growth work leaks private proof | Public-safety breach | Use only public repo, synthetic sample, public issues, and public docs |
| Early users hit quickstart blockers | Activation loss | Capture blockers publicly and prioritize reproducible fixes |
| Maintainers overfit to stars | Poor prioritization | Treat stars as secondary reach, not activation |
| Integration requests imply roadmap commitment | Commitment confusion | Require use case, data flow, boundary, and maintainer review before planning |

## Validation Plan

Minimum validation for growth-doc changes:

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

If a command cannot run locally, the reason and rerun plan must be recorded in
the PR or maintainer readout.

## Day-7 Readout Template

Use this short table on 2026-06-09:

| Category | Readout |
| --- | --- |
| Already established | Public Core docs, quickstart, community routing, and activation proofs that were verified |
| Formed but needs next layer | Friction themes, incomplete templates, unanswered integration requests, unclear README paths |
| Deliberately not done | Automatic outbound, commercial SLA, customer proof, private deployment evidence |
| Risks | Public-safety risk, activation blocker, maintainer load, release metadata confusion |
| Next five moves | The smallest five actions that improve activation or contribution quality |

## Non-Claims

- No production SLA.
- No complete enterprise SSO / SCIM / immutable audit platform.
- No third-party plugin sandbox.
- No runtime marketplace or app store.
- No automatic external send, approval, settlement, execution, or customer
  commitment.
- No claim that public Core alone proves Helm Cloud / Enterprise readiness.
