---
status: active
owner: helm-core
created: 2026-06-02
review_after: 2026-07-02
public_safety: Public community operations owner packet. This is not a production SLA, roadmap commitment, customer deployment proof, security disclosure, or remote label change.
---
# Helm Community Operations Owner Packet

This packet defines the first public-safe operating queue for issues, pull
requests, discussions, contributor first touch, and maintainer handoff in
`Helm-OpenSource/helm-public`.

It prepares owner-reviewable community operations only. It does not create
remote labels, close issues, merge pull requests, change repository settings,
publish security details, approve Cloud / Enterprise readiness, or commit Helm
to a roadmap or customer deployment timeline.

## Mission

Community and contributor operations turns public first touch into a
reviewable, public-safe queue:

1. classify the signal;
2. preserve the review-first boundary;
3. ask for the smallest useful public-safe evidence;
4. route security, private, or owner-gated material away from public threads;
5. feed community signal back to product, growth, metrics, release/security,
   and OPC.

## Operating Objectives

| Objective | Key results | KPI readout |
| --- | --- | --- |
| Turn public intake into a reviewable queue | Bugs, docs friction, Golden Path reports, integration requests, out-of-scope requests, and security/private reports have triage paths | Triage completeness, misrouted issue count |
| Keep first response boundary-aware | Replies avoid SLA, roadmap, customer deployment, Cloud, Enterprise, certification, and support commitments | First response target, unsafe wording correction count |
| Prepare template dry-run after intake templates land | PR #56 templates are reviewed after merge using one public-safe mock or real queue item | Dry-run completed, template friction count |
| Feed operating signal to other workstreams | Community risks and activation signals reach CPO, growth, metrics, release/security, and OPC | Weekly packet inclusion, unresolved community risk age |

KPI values are internal operating targets. They are not public SLA commitments.

## Triage Classes

| Class | Accept when | First response asks for | Route |
| --- | --- | --- | --- |
| Bug | Public Core behavior fails in a reproducible way | Commit/ref, exact command or route, expected result, actual result, shortest safe error text | Maintainer execution |
| Docs friction | Public docs are unclear, stale, missing a boundary, or over-claim readiness | Document path, unclear claim, proposed correction, claim-risk readout | DX/docs and product |
| Golden Path report | A contributor tried clone, quickstart, sample change, fixture check, or activation path | Environment, commands tried, observed result, friction or blocker | DX, growth, metrics |
| Integration request | A provider or system could support read-first or review-first delivery-engineer work | Source object, data flow, auth scopes, fixture/dry-run plan, auto/review/never table | Ecosystem architecture and product |
| Out-of-scope | Request asks for full platform expansion, marketplace, plugin sandbox, auto-send, auto-approval, customer overlay, or commercial pack | Public Core fit, boundary reason, optional private/owner-gated path | Parked queue or owner gate |
| Security/private | Includes vulnerability detail, customer data, credentials, private domains/IPs, private deployment evidence, or undisclosed security impact | No public detail; move to SECURITY.md or owner-approved private path | Release/security and owner gate |

## First Response Boundaries

Allowed:

- acknowledge receipt;
- classify the public-safe queue item;
- ask for a minimal public-safe repro, fixture, dry-run, or boundary table;
- link to existing public docs;
- state that a request is parked because it is outside public Core scope;
- route security/private reports away from public discussion.

Not allowed without owner gate:

- promise a repair date, roadmap slot, support level, certification, or customer
  deployment outcome;
- imply Cloud, Enterprise, SLA, pricing, or commercial readiness;
- summarize sensitive security or private deployment details in public;
- create, rename, or delete remote labels;
- close issues or discussions as policy action without maintainer review;
- merge PRs or bypass branch protection.

## Draft First Response Snippets

These snippets are internal prepared wording. Do not post them until the
maintainer on duty confirms the item classification and public-safety fit.

Bug:

```text
Thanks for the report. We are treating this as a possible public Core bug.
Please add the commit or release, exact command or route, expected result,
actual result, and the shortest safe error text. Do not include secrets,
customer data, private domains, or private deployment evidence.
```

Docs friction:

```text
Thanks for flagging this. We are treating it as public documentation friction.
Please point to the document path and the specific wording that is unclear or
might over-claim readiness. Any proposed wording should keep recommendations
separate from commitments and avoid SLA, roadmap, Cloud, Enterprise, or customer
deployment promises.
```

Golden Path report:

```text
Thanks for testing the Golden Path. Please include OS, Node/npm versions,
container runtime if used, commit or release, commands tried, and the observed
result. This helps us separate a reproducible blocker from environment setup or
documentation friction. Use only public repository files and synthetic sample
data.
```

Integration request:

```text
Thanks for the integration request. To keep this review-first and public-safe,
please describe the delivery-engineer use case, source object, data flow, auth
scopes if known, fixture or dry-run plan, and the boundary table for Auto,
Review-first, and Never. Opening the request does not create a roadmap or
delivery commitment.
```

Out of scope:

```text
Thanks for the suggestion. This appears outside current public Core scope
because it asks for a capability Helm deliberately does not claim here. We can
keep the public thread focused on whether there is a smaller read-first,
review-first, fixture-backed public Core path. Anything requiring commercial
Pack, customer Overlay, Cloud / Enterprise posture, or owner commitment needs a
separate owner-gated path.
```

Security or private report:

```text
Thanks for raising this. Please do not share vulnerability details, customer
data, credentials, private domains, internal IPs, or private deployment evidence
in a public issue or discussion. Use SECURITY.md or an owner-approved private
path. We will not summarize sensitive details in public.
```

## Label Plan And Current Remote State

Existing labels can cover the first pass:

| Existing label | Use |
| --- | --- |
| `bug` | Reproducible public Core bug |
| `documentation` | Docs friction or Golden Path report with docs impact |
| `enhancement` | Integration request or scoped public Core improvement |
| `question` | Needs classification or maintainer answer |
| `help wanted` | Maintainer-approved contribution opportunity |
| `good first issue` | Small public-safe first contribution |
| `duplicate` / `invalid` / `wontfix` | Maintainer-reviewed queue closure reasons |

Owner-authorized labels created on 2026-06-02:

| Label | Reason | Current operating boundary |
| --- | --- | --- |
| `activation-blocker` | Marks reproducible Golden Path or first-change blockers | Use only after public-safe evidence confirms blocker shape |
| `docs-friction` | Separates public docs confusion from general docs work | Does not imply product commitment |
| `integration` | Tracks integration requests without implying roadmap commitment | Use only for read-first or review-first integration paths |
| `needs-repro` | Requests a minimal public-safe reproduction | Do not request secrets, private data, or deployment evidence |
| `needs-owner-gate` | Marks wording, security, commercial, or boundary decisions | Requires owner review before external posture changes |
| `out-of-scope` | Parks requests outside public Core without expanding scope | Closure still needs maintainer review |
| `security-private` | Redacted pointer only; never a place to disclose details | Do not use to solicit or retain public vulnerability detail |

Label creation does not start public intake cadence. Issue closure, public
comments, label deletion, and security/private handling still require the
specific routing rules below.

## First Operating Loop

Do not start the public intake cadence before the PR #56 intake templates merge.
Until then, Community only prepares owner packets, reviews public-safe wording,
and monitors existing public queue state without external commitments.

Daily during launch week:

1. scan issues, PRs, discussions, and new public comments;
2. classify each public item using the triage table;
3. identify misrouted security/private or out-of-scope items;
4. record reproducible blockers and docs friction;
5. send summary to metrics and OPC.

Weekly:

1. report queue age, first response coverage, blocker count, and follow-through;
2. separate activation evidence from reach metrics;
3. list owner decisions requested;
4. name community risks and safe public response posture for growth;
5. hand product/CPO integration and scope signals.

After PR #56 merges:

1. create one dry-run issue packet from a public-safe mock or existing item;
2. test bug, docs friction, Golden Path, and integration templates against the
   triage table;
3. record template friction without creating remote labels;
4. recommend template follow-up only if a blocker is reproducible.

## Post-PR #56 Template Dry-Run Worksheet

Run this worksheet only after PR #56 merges, the branch is rebased, and checks
have rerun successfully.

| Step | Check | Evidence to record |
| --- | --- | --- |
| 1 | Select one public-safe mock or existing queue item | Link or local mock title; no private evidence |
| 2 | Classify using triage table | Bug, docs friction, Golden Path, integration, out-of-scope, or security/private |
| 3 | Match the item to the issue template | Template name and any missing field |
| 4 | Apply first-response boundary | Snippet category and any owner-gated wording removed |
| 5 | Decide label recommendation | Existing label or suggested owner-gated label; no remote label action |
| 6 | Route to workstream | Maintainer, DX, release/security, metrics, growth, product, ecosystem, or OPC |
| 7 | Record friction | Template gap, unclear field, unsafe wording risk, or no issue found |
| 8 | Decide follow-up | No change, wording tweak PR, owner decision, or security/private escalation |

Dry-run pass criteria:

- no public issue needs sensitive details to be triaged;
- at least one route can be completed using existing labels only;
- suggested labels remain owner decisions, not remote changes;
- first-response wording does not imply SLA, roadmap, certification, Cloud,
  Enterprise, customer deployment, or support commitment;
- any template gap is small enough for a follow-up PR.

## OPC Weekly Packet Input

| Packet field | Community input | Current gate |
| --- | --- | --- |
| Triage readiness | The six triage classes are defined with first-response evidence, route, and boundary conditions | Ready for owner review; not active public cadence |
| Issue template adoption prerequisites | PR #56 must merge, downstream PRs must rebase, checks must rerun, then one dry-run item should test form fit | Blocked until PR #56 merges |
| Contributor signal | Track first-change follow-through, Golden Path reports, reproducible blockers, docs friction, and integration boundary completeness | Use only public-safe issues, discussions, PRs, synthetic fixtures, or owner-approved redacted receipts |
| Label/runbook small PR candidate | This owner packet is the runbook seed; triage labels now exist with owner authorization | Do not treat labels as public intake launch before PR #56 merges |
| Owner decisions requested | Approve or revise label set; approve #56 post-merge template dry-run; confirm first-response target is internal only; confirm security/private public reply boundary | Owner review required before external posture changes |

PR #54 has merged. Historical maintainer review gate for PR #54 was a
three-reviewer fan-out, not a single-reviewer assumption:

| Requested reviewer | Community interpretation |
| --- | --- |
| `kfzhoupan` | Wait for owner/maintainer review signal before resuming public intake preparation |
| `Li-JianLe` | Treat as part of the maintainer baseline review gate, not a separate Community authorization |
| `mrlee1989-code` | Treat as part of the maintainer baseline review gate, not a separate Community authorization |

Community should preserve this lesson for future gates: do not infer approval
from one requested reviewer being present in the queue. Resume a gated action
only after the relevant PR has an owner-approved outcome and the maintainer
merge train advances.

## Community KPI Collection Worksheet

Use this worksheet for internal metrics and OPC packets. Do not publish it as a
service commitment. All data sources must be public-safe.

| KPI | Definition | Public-safe source | Weekly readout |
| --- | --- | --- | --- |
| First response target | Internal target from item creation to first maintainer/community acknowledgement | Public issue, PR, or discussion timestamps | Count within target / count outside target; no SLA wording |
| Triage completeness | Items with class, owner route, evidence request, and boundary decision recorded | Public issue/discussion/PR metadata or redacted owner receipt | Complete / incomplete / blocked by owner gate |
| Misrouted issue count | Items that should move to security/private, out-of-scope, or integration review but entered another path | Public-safe classification notes only | Count and route; no sensitive details |
| Reproducible blocker count | Public Core blockers with command/route, commit/ref, expected result, and actual result | Public issue or Golden Path report using synthetic data | Count by blocker area and current owner |
| Contributor follow-through rate | Items where the contributor supplied requested repro, boundary table, docs path, or fixture evidence after first response | Public issue/discussion/PR comment history | Followed through / waiting / abandoned |
| Template friction count | Post-PR #56 dry-run or real intake cases where templates missed required public-safe fields | Dry-run worksheet or public issue template evidence | Count by template and proposed fix |
| Unsafe wording correction count | Replies or docs requiring edits to remove SLA, roadmap, customer deployment, Cloud, Enterprise, or support commitments | Public-safe review notes | Count and category, not blame |

Queue-age buckets for metrics handoff:

| Bucket | Meaning | Use |
| --- | --- | --- |
| `0-1 business day` | Fresh item | Confirm public-safety classification |
| `2-3 business days` | Needs maintainer or contributor follow-through | Escalate to workstream owner if unclassified |
| `4-7 business days` | At risk of stale community touch | Add to OPC risk queue |
| `>7 business days` | Stale for launch-week operating loop | Owner decision: close, park, route, or request evidence |

KPI exclusions:

- private security details;
- customer names, contacts, domains, deployment evidence, or credentials;
- commercial pipeline data;
- unapproved support, SLA, pricing, certification, or roadmap claims;
- reach-only signals unless clearly separated from activation evidence.

## OPC Handoff Template

```text
Community signal:
- Queue snapshot:
- Activation evidence:
- Reproducible blockers:
- Docs friction:
- Integration requests:
- Out-of-scope pressure:
- Security/private routing:
- Contributor follow-through:
- Owner decisions requested:
- Risks:
- Next controlled execution item:
```

## Merge Train Hold

Current maintainer order is:

1. PR #54 maintainer baseline - merged;
2. PR #57 public operating model - merged;
3. PR #55 first-change activation - still ahead of #56;
4. PR #56 OPC and intake templates - open and not main truth.

Community should treat remaining PRs as independent review gates until merged.
After each merge, this packet should be rebased if needed and revalidated before
it is proposed as a PR. If PR #56 is still unmerged, do not run template
dry-run, publish new intake guidance, or use labels to operate a public intake
cadence.

## Workstream Inputs

| Workstream | Input needed | Community output |
| --- | --- | --- |
| DX/docs | First contributor path and first sample proof expectations | Docs friction and contributor follow-through |
| Release/security | Security/private routing and disclosure boundary | Misrouted private report count and escalation notes |
| Metrics | Queue age buckets and data-source definitions | Public-safe queue facts and blocker counts |
| Growth | Activation wording that avoids roadmap/SLA promises | Safe public response posture and activation friction |
| Product/CPO | Public Core scope and integration prioritization rules | Integration requests and out-of-scope pressure |
| OPC | Packet format and owner decision fields | Community risks, signals, and controlled execution queue |

## Dependencies

| Dependency | Needed for | Current handling |
| --- | --- | --- |
| PR #56 intake templates | Template dry-run and form-backed issue collection | Wait for merge, then dry-run |
| PR #57 operating model | Public workstream contract and OKR/KPI wording | Merged; use as current public operating context |
| Maintainer merge train | Rebase order and checks after each merge | Keep this packet small and rebase-ready |

## Validation Plan

For this packet and any follow-up public docs change:

```bash
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
```

If this packet becomes a PR before PR #55 and PR #56 land, it should be rebased
after those PRs as needed, then checks should run again.

## Current Status Classification

| Tier | Items |
| --- | --- |
| Already established | Public Core docs allowlist, public/private guard, existing contribution and security policy |
| Formed but needs next layer | Community triage rubric, owner-created label set, first response boundaries, cross-workstream signal loop |
| Deliberately not done | Issue closure, security disclosure, public intake cadence, template dry-run before #56 merge |
| Risks | Mixed-scope merge conflicts with pending operations PRs, unsafe public replies, treating response targets as SLA, summarizing private evidence in public |
