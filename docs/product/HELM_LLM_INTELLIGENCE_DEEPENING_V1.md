---
status: active
owner: helm-core
created: 2026-06-07
review_after: 2026-07-07
public_safety: Public-safe contract and guard description only. Do not add real context packets, customer signals, overlay drafts, prompt run receipts, credentials, or tenant deployment evidence.
---
# Helm LLM Intelligence Deepening v1

Helm v1 deepens LLM use from explanation polish into candidate judgement,
evidence-gap review, and counterargument review. The boundary is deliberately
narrow: LLM output remains candidate-only and review-first. It does not own
final ranking, approval, external send, writeback, connector activation, CRM
import execution, or memory promotion.

## Public Core Scope

`helm-public` carries only public-safe Core pieces:

- contracts and zod schemas in `lib/llm/intelligence-contracts.ts`
- a fail-closed boundary reviewer workflow in
  `lib/llm-workflows/review-judgement-boundary.workflow.ts`
- recommendation critic helpers that preserve deterministic rank fields in
  `lib/recommendations/recommendation-critic.service.ts`
- candidate-only static guard in `scripts/check-llm-candidate-boundaries.ts`
- synthetic eval and fixtures only

Real customer packet builders, overlay-specific mappings, deployment drafts,
and environment adapters belong in `helm-overlays` or the user's local
environment. Prompt rollout policy and tenant model routing remain future
`helm-control-plane` work.

## Contracts

`LLMContextPacket` includes the review packet fields required for LLM-bound
advisory work: object reference, timeline, evidence references, signals,
commitments, blockers, policy snapshot, permissions, privacy class, token
budget, missing evidence, and boundary notes.

Remote provider use passes through packet redaction and explicit consent /
prompt preview. Without that approval, remote packet preparation is blocked
before provider dispatch and the reviewer returns a fail-closed human-review
result. `public_safe_synthetic` packets may use the local/test path without
consent; non-synthetic packets default to remote-risk posture unless the caller
explicitly provides a local-only egress policy.

`JudgementCandidate.reviewState` is a closed set:

- `candidate`
- `needs_review`
- `rejected_by_guard`

Unsafe states such as final approval, execution, commitment, auto-promotion, or
production readiness are not valid contract values.

`LLMCriticResult.issueCodes` reuses the existing BI reviewer issue family:

- `SPECULATION_AS_FACT`
- `OUT_OF_EVIDENCE_SCOPE`
- `BOUNDARY_VIOLATION`
- `OVERSTRONG_ACTION`

v1 extends the same family with explicit public-safe boundary flags such as
missing evidence, PII risk, writeback risk, external-send risk, and commitment
overclaim.

## Recommendation Critic Boundary

The recommendation critic is advisory-to-human only. It may build a context
packet, produce a judgement candidate, and ask the unified boundary reviewer
for issues or counterarguments.

It must not create `RecommendationFeedback`, `PreferenceSignal`, or
`PatternFact`. Existing human-confirmed recommendation feedback may continue to
affect future deterministic personalization through the current feedback path,
but critic output does not enter that path automatically.

Recommendation critic packets are treated as `private_runtime` before egress.
The boundary reviewer must redact and reclassify a remote-safe packet as
`redacted_review`, or fail closed when consent / prompt preview is missing.

## Fail-Closed Reviewer

The unified boundary reviewer is a stricter branch of the existing BI reviewer
pattern. BI report review keeps its current behavior. The new judgement boundary
reviewer fails closed: provider failure, parse failure, or schema failure
returns `needs_review`, `requiredHumanReview=true`, and a fail-closed boundary
decision.

Contradictory reviewer output is normalized conservatively: a `candidate`
result is downgraded to `needs_review`, and a `rejected_by_guard` result cannot
be marked clean for human review.

All live calls go through the existing LLM runtime so prompt version, rate
limit, spend budget, call log, fallback reason, and output PII scrub remain in
force.

## Guard And Eval

`npm run check:llm-candidate-boundaries` scans candidate-aware LLM and
recommendation modules for unsafe review states, direct writer imports, direct
Prisma writes to feedback / preference / approval / pattern / memory-promotion
models, CRM import execution, connector activation, or external-send paths.

`npm run eval:llm-critic-boundaries` runs public-safe synthetic threshold
fixtures. This is a deterministic eval harness for issue-code and review-state
semantics; it is not a live provider quality proof. The v1 acceptance threshold
is:

- gap recall at least `0.75`
- overclaim false-positive rate at most `0.20`
- zero negative-case auto-approval
- zero missing required risk codes for external-send risk, writeback risk, or
  commitment-overclaim risk

These checks are public-safe. They do not include real packets, real prompts,
customer schema, tenant receipts, or private overlay drafts.
