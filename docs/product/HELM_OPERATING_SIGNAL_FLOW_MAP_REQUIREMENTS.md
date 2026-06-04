---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public-safe Operating Signal Flow contract. Private review packets, customer receipts, and internal adoption evidence are excluded.
---
# Helm Operating Signal Flow Map Requirements

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
