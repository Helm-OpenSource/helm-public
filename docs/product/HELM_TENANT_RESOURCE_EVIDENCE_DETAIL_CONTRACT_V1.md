---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Resource Evidence Detail Contract V1

## Status

Accepted for the second tenant-resource governance stage.

This contract is implementation-facing and review-facing. It defines how Helm opens the evidence behind a tenant resource judgement before any later manual proof lifecycle, field-level mapping gap, tenant policy readout, or guarded official write evaluation is allowed to proceed.

## Objective

Stage 1 proved that tenant resource readiness can be seen.

Stage 2 starts by proving why Helm may trust a resource enough to use it for judgement, how that use is downgraded when evidence is weak, and what must be checked after an operator acts manually.

This first slice only creates a read-only evidence detail contract and read model. It does not create new connectors, a policy engine, a guarded write path, or external execution authority.

## Contract

`TenantResourceEvidenceDetail` must expose these groups for each resource judgement:

1. Resource identity
   - `resourceKey`
   - `resourceName`
   - `provider`
   - `resourceType`
   - readiness status

2. Source object
   - source kind
   - source reference
   - source object type
   - source object label

3. Timing and freshness
   - observed time
   - updated time
   - freshness window
   - freshness posture: `fresh / stale / session_scoped / manifest_declared / unknown`

4. Trust and governance
   - trust level
   - promotion eligibility
   - review requirement
   - allowed effect modes
   - customer-facing allowed
   - write-back allowed

5. Mapping and conflict posture
   - mapped object types
   - mapping completeness
   - missing requirements
   - field-level mapping gap readout for judgement-critical fields
   - conflict count
   - conflict posture

6. Capability decision
   - decision: allow / review / ask human / deny posture from existing capability trace
   - primary reason code
   - fallback type and ref
   - primary source step
   - source chain
   - human-readable why string

7. Manual proof posture
   - proof required
   - lifecycle state: `not_required / required / review_required / blocked`
   - next owner
   - failure mode

8. Governed loop posture
   - loop key
   - follow-through status
   - next action mode
   - next action title
   - observe / judge / govern / act / verify / learn steps

9. Evidence items
   - evidence ref
   - source kind/ref/label
   - observed time
   - freshness posture
   - trust level
   - mapping completeness
   - conflict count
   - decision use: `supports_allow / requires_review / blocked / context_only`
   - notes

## Detail Status

The detail status is intentionally narrower than a policy result:

- `usable_for_judgement`: capability trace allows use and governed loop is not blocked or review-routed.
- `needs_review`: capability trace or resource posture routes to review / human acknowledgement / stale-or-failed handling.
- `blocked`: capability trace denies the request or governed loop is blocked.

These states explain a judgement. They do not enforce policy by themselves.

## UI Entry

Only two surfaces expose this slice:

- settings connector/resource card
- dashboard / operating resource impact card

The UI entry is a read-only disclosure labelled `查看依据 / View evidence`.

The disclosure must stay secondary to the judgement and operating posture. It must not add execution buttons, external write controls, connector configuration, or policy editing.

## Boundary

This contract keeps the following boundaries explicit:

- Resource evidence detail is read-only.
- Resource evidence does not create connector marketplace, broad auto-write, guarded official write, customer-visible send, or orchestration authority.
- Capability trace remains explanatory; existing guards remain enforcement sources.
- Manual proof is only represented as a lifecycle requirement in this slice. It is not submitted, approved, failed, withdrawn, expired, or persisted here.
- Field-level mapping gaps remain a read-only explanation layer. They do not create a field mapping builder or mapping edit action.
- Tenant policy is not evaluated here. Policy readout is a later read-only layer.

## Success Criteria

This slice is complete when:

- `TenantResourceEvidenceDetail` exists as a pure read model.
- It is built from current `TenantResourceReadiness`, capability trace, and governed loop output.
- Settings and operating cards expose `查看依据 / View evidence` as a read-only disclosure.
- Tests cover allow, review, blocked, freshness, mapping/conflict, manual proof posture, and anchor stability.
- Self-check and boundary guard keep this slice bounded away from new connector, policy engine, external write, and execution authority.
