---
status: active
owner: helm-core
created: 2026-06-03
review_after: 2026-07-03
public_safety: Public AI recommendation governance contract. Describes recommendation, evidence, review, and boundary rules only; private receipts, customer evidence, approval ids, credentials, and deployment details stay off-repo.
archive_trigger:
  - A successor governance document is merged, validated, and linked from docs/STATUS.md.
---
# Helm AI Recommendation Governance

Helm treats AI-generated suggestions as inputs to a human-held operating review
process. This document explains how public Core keeps those suggestions
traceable, reviewable, and bounded for public reference.

This is a product governance contract, not a release approval, commercial launch
statement, production SLA, or customer deployment proof.

## Positioning And Boundary

Helm is a public Core reference implementation for delivery engineers who need
to turn business signals, recommendations, review gates, and delivery packets
into a forkable engineering structure.

Helm is not:

- a general AI runtime;
- a task or process management suite;
- an approval replacement;
- a production identity, audit, or tenant administration platform;
- a system that turns suggestions into customer-visible obligations without
  human review.

This document applies to public Core recommendation surfaces, review packets,
sample packs, evaluation gates, and public-safe operating docs. Industry Pack,
customer Overlay, and private deployment evidence belong in their respective
private repositories or private records.

## AI Suggestion Principles

AI output in Helm is treated as a suggestion until a human reviewer accepts,
edits, rejects, or escalates it. Recommendation is not commitment; explanation
is not approval; a prepared action packet is not an executed business action.

Every recommendation surface should preserve enough context for a reviewer to
understand why the suggestion appeared:

- source signals or fixture records;
- evidence references or trace identifiers where available;
- confidence, uncertainty, or known missing inputs;
- the boundary that keeps the suggestion review-first.

When evidence is incomplete, the correct state is an explicit gap, not a stronger
claim. Public docs may describe the intended governance posture, but they do not
replace code, tests, receipts, reviewer approval, or owner Go/No-Go.

## Human-Held Review Flow

Human review is a design requirement, not an implementation delay. High-risk or
customer-visible outcomes must stay in review, draft, or escalation state until
the responsible human actor approves the next step.

The reviewer must retain:

- the right to edit the suggestion before it becomes a customer-visible action;
- the right to reject, hold, or downgrade the suggestion;
- the responsibility to confirm prerequisites, dependencies, and risk notes;
- the decision record for any owner-held Go/No-Go step.

Helm public Core may prepare a review packet, draft, checklist, or evidence map.
It must not represent that packet as a completed approval, final contract,
customer deployment receipt, credential rotation receipt, or production release
decision.

## Auditability And Traceability

Governance depends on evidence that can be reviewed later. Recommendation
surfaces should prefer stable references such as `traceId`, source object ids,
evaluation fixture ids, command receipts, PR links, issue links, and review
records over prose-only claims.

Auditability means a reviewer can answer:

- what signal or record produced the suggestion;
- which rule, gate, or evaluator constrained it;
- who reviewed or still needs to review it;
- which evidence is missing;
- what changed after review.

This document does not claim perfect trace coverage or full historical replay.
When a trace, receipt, or review record is absent, Helm should label that as a
known gap and route it to the appropriate owner-held follow-up.

## Governance Enforcement

Public Core keeps governance enforceable through repository gates, review
discipline, and public/private separation.

Minimum public Core enforcement includes, where applicable:

- `npm run check:boundaries` before feature submission;
- `npm run check:public-release` for public-safety scanning;
- `npm run check:public-docs` for explicit public docs curation;
- targeted tests or evals for any changed recommendation behavior;
- PR review before merging protected branches.

Policy boundaries should be encoded as closed sets, typed contracts, fixtures,
guards, or evals when the repository already provides those mechanisms. Prose can
explain the boundary, but the mergeable standard is evidence from code, tests,
guards, receipts, or review records.

External tools, LLM providers, connectors, and AI surfaces remain outside the
public Core trust boundary unless the relevant code, permissions, and review
contract are present in this repository. A successful command, generated draft,
or green automated check does not by itself establish release readiness.

## Known Limits And Deliberately Not Done

Helm public Core deliberately does not claim:

- production-grade authentication or complete enterprise administration;
- third-party plugin sandboxing;
- complete immutable audit infrastructure;
- customer deployment readiness;
- production SLA;
- Cloud or Enterprise readiness from public Core alone;
- unsupervised customer-visible sending, settlement, approval, or business
  obligation.

Some of these capabilities may exist only as private receipts, commercial
extensions, owner-held procedures, or future work. Public Core must keep that
distinction explicit so contributors and delivery engineers do not confuse a
suggestion, gate, or demo fixture with a completed customer obligation.

## Change Log

| Date | Change |
|---|---|
| 2026-06-03 | Established the public AI recommendation governance contract for Helm public Core. |
