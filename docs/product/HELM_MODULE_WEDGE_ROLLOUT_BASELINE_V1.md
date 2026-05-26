---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Module Wedge Rollout Baseline v1

## Purpose

This document freezes the current repo-wide module rollout after the Meeting OS Wedge method has been audited across the current module inventory.

It records:

1. the reused product method
2. which surfaces are full wedges
3. which surfaces are thin adoptions
4. which surfaces are support-only / non-wedge
5. which boundaries remain preserved

This is a rollout baseline, not a new platform baseline.

## Reused method

The repo-wide rollout reuses the Meeting OS Wedge method:

1. first-screen answers:
   - why this surface matters now
   - which objects / states it affects
   - what the most important next step is
   - what the current boundary / review posture is
   - what memory / source context supports that read
2. memory stays source-grounded and lifecycle-aware
3. formal review remains formal where appropriate
4. governance cues stay readable and conservative
5. readiness remains workflow-scoped where applicable
6. Ask Helm, if present, stays scoped, read-only, and source-grounded
7. thinner surfaces stay visibly thinner than the richest proving-ground surfaces

## Full wedges

The following surfaces are frozen as full wedges in the current inventory:

- `/dashboard`
- `/meetings/[id]`
- `/approvals`
- `/memory`
- `/diagnostics`

These remain the strongest operating surfaces in the product.

## Thin adoptions

The following surfaces are frozen as thin adoptions in the current inventory:

### Review / decision surfaces

- `/customer-success`
- `/customer-success/[id]`
- `/review-requests/[id]`
- `/follow-ups/[id]`
- `/success-checks/[id]`
- `/expansion-reviews/[id]`
- `/sales-followups/[id]`
- `/sales-objections/[id]`
- `/founder-qa/[id]`
- `/delivery-reviews/[id]`
- `/delivery-walkthroughs/[id]`
- `/reinforcements/[id]`
- `/sendability/[id]`
- `/reinforcement-variants/[id]`

### Object / context surfaces

- `/opportunities`
- `/meetings`
- `/contacts/[id]`
- `/companies/[id]`
- `/inbox`
- `/inbox/[id]`
- `/conversations/[id]`
- `/founder-conversations/[id]`
- `/sales-conversations/[id]`
- `/delivery-conversations/[id]`
- `/proposals/[id]`
- `/packages/[id]`
- `/offers/[id]`
- `/external-proposals/[id]`
- `/package-variants/[id]`
- `/package-stage-variants/[id]`
- `/commercial-strengthening/[id]`
- `/external-narratives/[id]`
- `/external-narrative-fallbacks/[id]`

### Support / admin surfaces with justified thin adoption

- `/settings`
- `/imports`
- `/imports/crm`
- `/reports`

These surfaces reuse the method only where it stays truthful.
They do not become full operating wedges.
Some of the higher-value thin adoptions also carry a narrow connected-loop cue layer, but that layer remains summary-level and does not turn them into Meeting-style workspaces or admin platforms.

Within this set, `/meetings` remains an intentional thinner entry surface.
It already carries why-now, next-step, boundary and source cues, but it should still stay lighter than `/meetings/[id]`, which remains the Meeting OS reference implementation.

## Support-only / non-wedge surfaces

The following surfaces are intentionally frozen as support-only / non-wedge:

- `/search`
- `/imports/conflicts`
- `/imports/jobs/[id]`
- `/analytics`
- `/capture`

These pages may keep light framing and provenance cues, but they should not be force-fit into a wedge.
Where helpful, they may carry an explicit support-role note so users understand what they are for and what they should hand off to next.

## Preserved boundaries

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no `apps/helm-app`
- no `packages/helm-control`
- no shell thinning
- no send authority
- no workflow control
- no connector marketplace / platform
- no second app tree
- no broader governance / permissions platform
- no broader admin / RBAC platform
- no cross-surface global Ask Helm
- no route-owner or query-structure rewrite
- no overclaim of telemetry-backed readiness
- no commitment drift

## Intentionally out of scope

This rollout does not claim:

- that every surface should become a full wedge
- that thin adoption surfaces should inherit Meeting OS density
- that support/admin pages should become fake operating consoles
- that connector, send, or workflow semantics should widen
- that readiness on thin or support surfaces is telemetry-backed

## Freeze outcome

The current module inventory is now frozen as a complete, explicit rollout set:

- full wedges
- thin adoptions
- support-only / non-wedge surfaces

No audited module in the current inventory remains unclassified.
