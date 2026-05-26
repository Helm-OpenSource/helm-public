---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Resource Phase 4 Tenant Extension Adoption Contract V1

## Status

Accepted for tenant resource governance phase 4.

This contract turns tenant custom extension dependency declarations into a narrow adoption seam inside the existing tenant-resource governance truth. It does not create remote execution, connector provisioning, guarded official write, sandboxing, or a new extension control plane.

## Objective

Phase 3 proved that Helm can persist proof and a narrow guarded-write pilot locally.

Phase 4 answers a narrower question first:

- how a tenant custom extension declares which external resource dependency it relies on
- how Helm validates whether that declaration is usable for judgement
- how settings and operating surfaces expose the adoption posture without adding execution buttons

The goal is to make extension dependency adoption explainable before any later authority expansion is considered.

## Contract

Phase 4 introduces a read model named `TenantExtensionResourceAdoptionReadout`.

For each `workspace_solution_extension` resource, the readout must expose:

1. Extension identity
   - `resourceKey`
   - `extensionKey`
   - `extensionDisplayName`

2. Overall adoption posture
   - `overallStatus`
   - `dependencyCount`
   - `summary`
   - `boundaryNotes`

3. Per-dependency posture
   - `resourceDependencyKey`
   - `provider`
   - `declaredCapabilityModes`
   - `objectBindings`
   - `policyHint`
   - `validationStatus`
   - `adoptionStatus`
   - `governedLoopBindingStatus`
   - `blockingReasons`
   - `nextReviewStep`
   - `boundaryNotes`

## Manifest Source

`extension.manifest.json` remains the source of truth.

Phase 4 adds optional `resourceDependencyDeclarations`:

```json
{
  "resourceDependencyDeclarations": [
    {
      "resourceDependencyKey": "guangpu-seat-profile-midun-readout",
      "provider": "MIDUN",
      "declaredCapabilityModes": ["read_only"],
      "objectBindings": ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
      "policyHints": ["review-first", "tenant-local-readout"]
    }
  ]
}
```

Rules:

- declarations are optional for backward compatibility, but Phase 4 adoption uses them when present
- `customer_visible_send` is not allowed inside `declaredCapabilityModes`
- `objectBindings` and `policyHints` must be explicit and non-empty
- legacy `dependencyDeclarations.connectors` may still backfill a degraded fallback read model

## Status Model

Per-dependency validation status:

- `declared`
- `validated`
- `blocked`

Per-dependency adoption status:

- `declared`
- `validated`
- `adopted_for_read`
- `adopted_for_governed_loop`
- `blocked`
- `superseded`

Governed loop binding status:

- `not_bound`
- `bound`
- `blocked`

These statuses explain how far the extension dependency has entered the existing governance chain. They do not grant authority by themselves.

## UI Entry

Phase 4 stays inside existing tenant-resource surfaces:

- settings resource governance cards
- settings `查看依据 / View evidence` disclosure
- dashboard / operating resource impact evidence disclosure

The UI may show:

- extension adoption overall status
- declared dependency count
- dependency provider / object binding / next review step

The UI may not add:

- provider credential setup
- new write buttons
- extension execution actions
- swarm UI

## Boundary

- Tenant custom extension stays tenant custom and does not become shared core truth.
- Extension adoption remains read-first and review-first.
- Adoption does not create provider-side execution, remote runtime, connector marketplace, or external write authority.
- Guarded official write remains a later evaluation track, not a Phase 4 outcome.
- Phase 4 only binds dependencies into the existing governed loop seam when current readiness evidence already supports that posture.
