---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Meeting Connector Readiness Gate v1

## Purpose

This document defines the readiness gate for the next possible step after Meeting OS Wedge v2:
a narrow read-only connector layer for meeting / calendar / thread context.

This gate does not build any connector capability.
It only answers whether the current wedge is ready for a tightly-scoped connector implementation round.

## Current-main truths

The following truths must remain explicit:

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- there is no `apps/helm-app`
- there is no `packages/helm-control`
- shell thinning has not started

## Current wedge status

Meeting OS Wedge v2 is already frozen as `go` with:

- meeting as the first strong operating entry
- meeting-derived memory bundle + conservative lifecycle
- dashboard / approvals / diagnostics loop consumption
- meeting workspace + meeting-scoped Ask Helm
- governance / ownership readability
- ingress context
- meeting templates + workspace light
- meeting memory governance pack

This means the wedge is already legible as a product package.
The connector question is therefore about entry-strengthening only, not wedge rescue.

## Gate questions

### 1. Product readiness

Does the current wedge already read clearly as:

- dashboard = `what matters now`
- meeting detail = `why this meeting matters and what follows`
- approvals = formal review
- memory = writeback and confidence
- diagnostics = workflow-scoped readiness only

If not, connector work should not start yet.

### 2. Need validation

Are the remaining ingress gaps real and grounded?

The gate should only pass if the missing context is genuinely calendar/thread-related, for example:

- stronger event anchoring for why a meeting matters now
- clearer participant / attendee continuity
- stronger related-thread pressure visibility
- cleaner meeting-to-follow-through pressure chain

The gate should not pass merely because “more data might be nice.”

### 3. Architecture readiness

Can a read-only ingress seam be added without changing:

- route ownership
- `data/queries.ts` compatibility role
- shell structure
- current-main truth

The answer must stay `no` if connector work would require:

- route-owner migration
- second app tree
- shell thinning
- connector settings/admin/auth surfaces

### 4. Governance readiness

Can connector-derived context stay:

- read-only
- source-grounded
- review-aware
- non-sendable
- non-executing

And can it avoid:

- send-authority implication
- workflow-control implication
- commitment drift

If not, the gate fails.

### 5. Minimal next implementation scope

If this gate is `go`, the next implementation PR must stay limited to:

- meeting detail
- dashboard
- approvals
- optional tiny memory support only if strictly required
- current query / read-model seam only if still current-main-friendly

It must remain out of scope:

- settings / admin / auth
- connector marketplace / platform
- broader export / delete / revoke
- scheduling / reply / send actions
- second app tree
- shell thinning

## Pass / fail criteria

### Use `go` only when

- Meeting OS Wedge v2 is already stable and legible without connector rescue
- ingress need is grounded by walkthrough / pilot / use evidence
- the missing value is clearly read-only calendar / thread context
- the next implementation can stay inside the current route/query truth
- governance can remain explicit and conservative

### Use `conditional-go` when

- ingress need is real
- but the current proof is still narrow or architecture/governance scoping is not crisp enough
- or the next implementation scope is still too easy to widen by accident

### Use `no-go` when

- the wedge itself is still not stable
- ingress need is not grounded
- or connector work would force route, shell, governance, or execution scope expansion

## Preserved boundaries

- no connector implementation in this gate
- no send authority
- no workflow control
- no second app tree
- no shell thinning
- no broader governance platform
- no auth/settings/admin surfaces
- no scheduling / reply / send actions

## What a future connector PR may touch

Only if this gate is `go`, a future narrow connector PR may touch:

- `/dashboard`
- `/meetings/[id]`
- `/approvals`
- optional tiny `/memory` support if strictly required
- the current read-model seam in a current-main-friendly way

## What a future connector PR may not touch

- route owner structure
- shell/layout/loading/error/not-found
- connector marketplace/platform
- admin/auth/settings surfaces
- broader governance platform
- export/delete/revoke platform
- scheduling / reply / send actions
- send authority
- workflow control
