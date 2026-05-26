---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Policy Readout Contract V1

## Status

Accepted for the second tenant-resource governance stage.

This contract defines an owner-facing read-only policy readout for tenant resources. It does not create a policy engine, policy editor, connector permission editor, guarded write route, or external execution authority.

## Objective

Evidence detail, manual proof lifecycle and field mapping gap can explain why Helm may trust a resource-backed judgement. Tenant owners also need a compact readout of what each resource posture allows:

- which resources can only be read
- which resources can generate drafts
- which resources require manual review
- which resources can never external-write from this stage

## Contract

`TenantResourcePolicyReadout` is built from existing `TenantResourceReadiness`.

It exposes:

1. Summary
   - generated time
   - total resources
   - read-only resource keys
   - draft-capable resource keys
   - manual-review resource keys
   - never-external-write resource keys

2. Per-resource item
   - resource key
   - resource name
   - provider
   - source kind
   - allowed effect modes
   - read access: `available / unavailable`
   - draft generation: `allowed / not_allowed`
   - manual review: `not_required / recommended / required`
   - external writeback: `never_allowed / separate_guarded_evaluation_required`
   - reason codes
   - owner-visible summary

## Semantics

- Read access is derived from the existing resource read capability.
- Draft generation is derived from existing allowed effect modes and resource health.
- Manual review is derived from review requirement, primary gap, conflicts and review fallback.
- External writeback is never granted by this readout.
- If a resource declares writeback or guarded write intent, the readout only says separate guarded-write evaluation is required.

## UI Entry

Settings resource governance shows:

- summary counts for read-only, draft-capable, manual-review and never-external-write resources
- per-resource owner-visible policy summary

The surface remains read-only. It must not add policy edit controls, connector permission controls, write buttons, or execution buttons.

## Boundary

- Tenant policy readout is not a policy engine.
- It does not enforce access.
- It does not mutate policy rules.
- It does not create guarded official write.
- It does not change connector/import/extension runtime behavior.
- Existing workspace capability checks remain the enforcement source.
