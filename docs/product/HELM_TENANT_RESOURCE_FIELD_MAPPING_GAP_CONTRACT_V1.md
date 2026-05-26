---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Resource Field Mapping Gap Contract V1

## Status

Accepted for the second tenant-resource governance stage.

This contract defines the narrow field-level mapping gap readout behind tenant resource judgement. It is not a general mapping builder and does not create connector configuration, schema migration, policy, or external write authority.

## Objective

Resource evidence detail can now explain the source, trust, freshness and capability chain behind a resource. Manual proof lifecycle can explain how operator proof should move after manual execution.

The next missing layer is field-level explanation: when Helm downgrades a recommendation, the operator must be able to see which judgement-critical field is missing, stale, ambiguous or not applicable.

## Covered Fields

V1 only covers fields that can change judgement posture:

- customer status
- recent interaction
- owner
- amount / stage
- case status
- next-step time

This is intentionally not an all-field mapping system.

## Contract

`TenantResourceFieldMappingGapReadout` exposes:

1. Readout identity
   - readout key
   - generated-from resource key

2. Summary posture
   - `clear`
   - `has_explainable_gaps`
   - `downgraded`

3. Judgement impact
   - whether judgement is downgraded to review
   - whether guarded write evaluation remains blocked
   - downgrade reason
   - critical field keys

4. Field items
   - field key
   - bilingual label
   - status: `available / missing / ambiguous / stale / not_applicable`
   - reason code
   - judgement impact
   - source object types
   - mapped object types
   - missing requirements
   - primary gap
   - explanation
   - repair hint

## Judgement Semantics

- `available` fields may support judgement explanation.
- `not_applicable` fields are explicitly out of scope for the current resource type.
- `missing`, `stale`, or non-actionable `ambiguous` fields downgrade the suggestion to review.
- Actionable resources with conflicts keep the conflict explain-only unless the resource is already review-routed.
- Guarded official write evaluation remains blocked whenever critical fields are not available, fresh and unambiguous.

## UI Entry

The readout appears only inside existing `查看依据 / View evidence` disclosures on:

- settings resource cards
- dashboard / operating resource impact cards

The UI may show the summary, downgrade reason and critical field keys. It must not add mapping edit controls, execution buttons, or writeback controls.

## Boundary

- Field-level mapping gap is read-only.
- It does not create a field mapping builder.
- It does not change connector/import/extension runtime behavior.
- It does not create policy enforcement.
- It does not create guarded write authority.
- It only explains why Helm can use, downgrade, or block a resource-backed judgement.
