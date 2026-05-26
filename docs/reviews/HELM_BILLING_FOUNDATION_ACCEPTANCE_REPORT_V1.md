---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Billing Foundation Acceptance Report v1

## Scope

This report records acceptance for PR11:
the organization / membership / trial / billing foundation for Helm v1.

This was evaluated as a foundation PR, not as a payment-integration PR and not as a new product wedge.

Narrow Payment Integration Sprint 1, Dual Payment Rail Foundation Sprint 1, China Payment Rail Sprint 1, and Seat / Entitlement Ops Polish Sprint 1 are later layers built on top of this accepted foundation. They do not change the acceptance truth recorded here; they consume it.

## Phases completed

### Phase 0

Completed:

- audited current auth / session / settings seams
- confirmed `Workspace` is already the current-main organization boundary
- confirmed `Membership` is already the reusable user-to-workspace seam
- landed the rollout plan in `HELM_BILLING_FOUNDATION_PLAN_V1.md`

### Phase 1

Completed:

- added organization-status support on `Workspace`
- expanded `Membership` with fixed v1 roles, membership status and joined timestamp
- added `BillingAccount`
- added `TrialState`
- added `WorkerEntitlement`
- added `UsageLedger`
- added Prisma migration and seed support

### Phase 2

Completed:

- moved active organization resolution into the session seam
- added active organization cookie support
- added create-organization flow
- added add / invite member flow
- added organization switching flow
- made settings and workspace layout read under active organization context

### Phase 3

Completed:

- implemented `trialing / active / grace / read_only / canceled`
- added commercial foundation bootstrap for each organization
- added narrow processing guards for new high-cost operations
- preserved sign-in / viewing / export in `grace` and `read_only`
- kept trial and paid core product access fully open

### Phase 4

Completed:

- added settings billing overview
- exposed active organization, lifecycle state, seat model and included workers
- exposed add-on worker entitlement model support
- exposed usage summary only in internal/product-appropriate terms
- did not expose token / storage billing lines

### Phase 5

Completed:

- added this acceptance report
- added the baseline freeze doc
- updated docs discoverability

## What landed

The following are now real current-main foundations:

- organization-first runtime context
- fixed-role memberships
- trial / active / grace / read_only lifecycle
- organization billing account model
- worker entitlement model
- internal usage ledger
- minimal billing overview

The following are now explicitly true:

- Helm v1 is organization-first
- one organization equals one workspace
- current core product remains fully available in trial and active states
- commercial difference is handled through organization lifecycle, seats and entitlements instead of arbitrary feature hiding

Later ops polish now clarifies, without changing the accepted foundation:

- invited members stay visible but do not count as active seats yet
- inactive members stay visible for history but do not count as active seats
- settings billing overview can read as stable product blocks instead of raw field piles
- worker entitlements can show future reserved commercial paths without implying a marketplace
- add-on worker commercial wiring can now explain included / monthly / per-use rails without implying a live purchase flow
- `grace / read_only / canceled` can now explain their allowed vs blocked operations more precisely without expanding feature gating
- China renew / restore can now read through a more stable operator path:
  - `grace` renew
  - `read_only` restore
  - `canceled` reactivate
  - `active` avoid duplicate purchase and prefer refresh for delayed China sync
- self-serve trial onboarding can now read through a stable first-user path:
  - public signup creates the first organization
  - the first user becomes `OWNER`
  - trial seats and included workers initialize automatically
  - the user lands directly in organization-scoped runtime and `/setup`

Current operating foundation docs now reference this accepted billing truth rather than replacing it:

- `HELM_OPERATING_CONSTITUTION_V1.md`
- `HELM_ROLE_AUDIENCE_FOUNDATION_V1.md`
- `HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md`
- `HELM_GOAL_CAMPAIGN_FOUNDATION_V1.md`

Those documents reuse this acceptance layer as the commercial / lifecycle / entitlement foundation that later operating summaries must stay honest about.

## What remained deferred

Still deferred by design:

- payment checkout / portal
- invoice generation
- coupons / discounts
- taxes
- retry / dunning
- payout rails
- partner commission system
- SSO / SCIM / enterprise auth
- full RBAC builder
- multi-workspace
- connector marketplace
- worker marketplace
- token / storage external billing

## Preserved boundaries

- root `app/` remains route owner
- `data/queries.ts` remains compatibility facade
- no `apps/helm-app`
- no `packages/helm-control`
- no shell thinning
- no send authority
- no workflow control
- no second app tree
- no broader governance / admin platform
- no route-owner rewrite
- no query-structure rewrite
- no overclaim of payment readiness

## Validation results

Validated in the isolated PR11 worktree.

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run check:boundaries` — passed
- `npm run build` — passed
- `npm run test` — passed

`npm run self-check` requires a local `DATABASE_URL` in env or `.env`.
In the isolated worktree it passed once a local `DATABASE_URL` was supplied for the check, without changing product code.

## Acceptance outcome

`go`

Reasons:

- the repo now has a real organization-first commercial foundation
- memberships and fixed roles are real
- lifecycle states are real
- worker entitlements are real
- internal usage ledger is real
- settings now provides a minimal billing overview
- no unrelated wedge or platform expansion was introduced

## Readiness for future payment integration PR

`conditional-go` at the time of PR11

The narrow foundation needed for a future payment integration PR is now present:

- organization billing account exists
- lifecycle states exist
- seat model exists
- entitlement model exists
- usage ledger exists

But payment readiness is still intentionally incomplete because current-main does not yet include:

- checkout
- billing portal
- invoices
- taxes
- retry / dunning

So the next payment-oriented PR could start from this foundation, but it had to remain narrow and truthful about what was still missing.

That follow-up is now recorded separately in:

- `docs/reviews/HELM_PAYMENT_INTEGRATION_PLAN_V1.md`
- `docs/product/HELM_NARROW_PAYMENT_INTEGRATION_SPRINT_1_REPORT.md`
- `docs/product/HELM_DUAL_PAYMENT_RAIL_FOUNDATION_SPRINT_1_REPORT.md`
- `docs/reviews/HELM_READONLY_GRACE_BOUNDARY_PLAN_V1.md`
- `docs/product/HELM_READONLY_GRACE_BOUNDARY_SPRINT_1_REPORT.md`
- `docs/reviews/HELM_CHINA_RENEW_RESTORE_PLAN_V1.md`
- `docs/product/HELM_CHINA_RENEW_RESTORE_OPS_POLISH_SPRINT_1_REPORT.md`
- `docs/reviews/HELM_TRIAL_ONBOARDING_SELF_SERVE_SIGNUP_PLAN_V1.md`
- `docs/product/HELM_TRIAL_ONBOARDING_SELF_SERVE_SIGNUP_SPRINT_1_REPORT.md`

## Final acceptance note

PR11 is accepted as the commercial and organization foundation for Helm v1.

It makes Helm commercially operable as an organization-based product without turning Helm into a payment platform, permissions platform, or gated toy.
