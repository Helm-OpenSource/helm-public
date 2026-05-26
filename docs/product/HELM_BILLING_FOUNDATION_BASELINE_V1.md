---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Billing Foundation Baseline v1

## Purpose

This document freezes the PR11 organization / membership / trial / billing foundation for Helm v1.

Its job is to lock the current-main commercial and runtime truth without widening Helm into a payment platform, governance platform, or second app tree.

Narrow Payment Integration Sprint 1, Dual Payment Rail Foundation Sprint 1, and China Payment Rail Sprint 1 now sit on top of this foundation, but do not replace it.

Those layers add only:

- global Stripe checkout + portal + minimal subscription-status writeback
- dual payment rail provider abstraction
- China rail narrow checkout + notify / query sync truth for `Alipay / WeChat Pay`
- China renew / restore / refresh operator path clarity inside settings and lifecycle messaging
- settings visibility for current payment rail

It does not change the pricing truth, trial truth, or the role of this foundation doc.

## Frozen product / commercial model

Helm v1 is frozen as an organization-first B2B product.

For v1:

- one organization equals one workspace
- billing is organization-first, not token-first
- trial and paid both expose the full current core product
- differences are lifecycle state, seat counts, and worker entitlement/commercial status
- token / storage / retrieval remain internal accounting only

## Frozen lifecycle states

The organization access model is frozen as:

- `trialing`
- `active`
- `grace`
- `read_only`
- `canceled`

Operational meaning:

- `trialing`
  - first 30 days
  - full current core product remains available
- `active`
  - paid organization
  - full current core product remains available
- `grace`
  - 7-day post-trial / post-expiry state
  - sign-in, viewing and export remain available
  - new high-cost processing is blocked
- `read_only`
  - sign-in, viewing and export remain available
  - new processing is blocked
- `canceled`
  - commercial state retained for truthfulness and future billing lifecycle work

This state model is lifecycle-based, not feature-gating-based.

## Frozen pricing model

Helm Team v1 is frozen as:

- organization base fee: `CNY 199 / month / organization`
- included admin seats: `1`
- additional active seat: `CNY 99 / user / month`

PR11 foundation itself did not implement:

- payment checkout
- billing portal
- invoices
- coupons / discounts
- tax handling
- retry / dunning

So these values were first frozen as product/commercial truth before live payment rails existed.

Current-main may now connect these values to a narrow hosted payment rail, but:

- pricing truth still starts here
- lifecycle truth still starts here
- payment rail truth still hangs off this foundation
- Helm still does not become a finance console

Current payment rail truth is:

- `Stripe` for the global / English payment rail
- `Alipay / WeChat Pay` for the China payment rail
- one lifecycle truth across all rails:
  - `trialing`
  - `active`
  - `grace`
  - `read_only`
  - `canceled`
- China rail Sprint 1 supports narrow checkout + notify / query sync
- China rail Sprint 1 does not promise portal parity yet
- China renew / restore ops polish can clarify:
  - `grace` = renew path
  - `read_only` = restore path
  - `canceled` = reactivate path
  - `active` = avoid duplicate purchase and prefer refresh for delayed sync
  - refresh can query the latest China order when notify is delayed

## Frozen trial model

The trial model is frozen as:

- 30-day organization-level trial
- 1 admin seat included
- 2 additional trial collaborator seats available
- all current first-party core workers included
- no forced credit card before trial
- no auto-charge logic

Trial does not intentionally cripple the current core operating surfaces:

- dashboard
- meetings
- approvals
- memory
- diagnostics

Current-main now also freezes the first self-serve trial onboarding path on top of this model:

- public entry can start a self-serve trial without requiring a demo account first
- signup creates one organization by default
- signup makes the initial user the `OWNER`
- signup initializes `BillingAccount`, `TrialState`, and included core `WorkerEntitlement`
- signup immediately establishes the active organization session
- `/setup` can now act as the first trial onboarding surface instead of remaining demo-only

This still does not widen Helm into a growth platform or onboarding automation platform.

## Frozen core commercial objects

PR11 freezes these runtime objects:

### Organization boundary

Current-main uses `Workspace` as the real runtime organization boundary.

That truth remains frozen for v1:

- no multi-workspace expansion
- no org-platform rewrite
- no route-owner rewrite

### Membership

`Membership` is the user-to-organization relation.

Fixed v1 roles are frozen as:

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`
- `OPERATOR`
- `REVIEWER`
- `MEMBER`

Fixed membership statuses are:

- `ACTIVE`
- `INVITED`
- `INACTIVE`

This is a readable fixed-role model, not a full RBAC builder.

Seat / membership ops truth is now clarified on top of that foundation:

- `INVITED`
  - stays visible in organization operations
  - does not count as an active seat yet
  - becomes `ACTIVE` only when the user actually enters the organization
- `INACTIVE`
  - stays visible for history and audit readability
  - does not count as an active seat
  - does not act as the default runtime workspace path

### BillingAccount

Each organization / workspace has one billing account carrying:

- current plan
- currency
- billing status
- base organization fee
- active seat price
- included admin seat count

### TrialState

Each organization / workspace has one lifecycle state carrying:

- `trial_started_at`
- `trial_ends_at`
- `grace_ends_at`
- current lifecycle status

### WorkerEntitlement

Each organization / workspace can hold worker entitlements with:

- `worker_key`
- entitlement type
- entitlement status
- effective window
- optional internal limit

Entitlement types are frozen as:

- `included`
- `add_on_monthly`
- `add_on_per_use`

Current first-party core workers are included by default:

- `meeting_os_worker`
- `review_memory_worker`

The entitlement model is real now, but:

- there is no worker marketplace yet
- there is no add-on purchase flow yet

Current settings may show reserved commercial entitlement paths conservatively, but those remain future-ready placeholders rather than live marketplace availability.

Current-main now also freezes a first add-on worker commercial wiring layer:

- included core workers remain visible as real entitlements
- `add_on_monthly` and `add_on_per_use` can render as future commercial rails
- active / inactive / canceled entitlement posture remains visible without implying a marketplace
- settings can explain commercial mode, usage path, future path, effective window, and internal limit
- there is still no worker marketplace or live add-on purchase flow yet

### UsageLedger

Usage ledger is frozen as an internal-only accounting layer.

It records organization-scoped usage events such as:

- meeting processing
- briefing generation
- recommendation generation
- CRM import processing
- connector sync
- capture processing
- meeting memory export
- future premium worker invocation

It does not expose token / storage / retrieval as customer-facing billing lines.

## Frozen product behavior

### Active organization context

Helm now resolves an active organization / workspace through the session seam instead of assuming `memberships[0]`.

This includes:

- active organization cookie
- organization switching
- organization-scoped settings reads
- organization-scoped processing guards

### Minimum organization behavior

PR11 freezes these minimum behaviors:

- create organization
- add / invite member using the narrowest current-main-friendly flow
- switch active organization
- render current core surfaces under active organization context

This does not introduce:

- multi-workspace UX
- admin platform
- full membership management console

### Read-only / grace restrictions

PR11 intentionally blocks only new high-cost processing in `grace` and `read_only`.

Blocked categories include:

- meeting processing
- briefing generation
- recommendation generation
- connector sync
- capture processing
- CRM import run / warmup

Still allowed:

- sign in
- view existing records
- organization-aware settings access
- meeting memory export

This keeps the restriction narrow and honest.

After `Read-only / Grace Boundary Refinement Sprint 1`, that narrow boundary is frozen more explicitly as:

- `CRM preview`
  - means a new CRM import preview recomputation against the source
  - does not mean ordinary browsing is blocked
- `import preview`
  - means a local CSV draft preview
  - remains allowed in `grace / read_only / canceled`
- export
  - remains allowed in `grace / read_only / canceled`
- refresh
  - remains allowed when it is reading lifecycle / billing status rather than starting a new high-cost processing run

The refinement still does not widen lifecycle restrictions into broad feature gating.

## Frozen billing overview scope

The settings surface now acts as a minimal billing overview, not a finance console.

It exposes:

- active organization
- lifecycle state
- plan summary
- organization base fee
- included admin seat count
- active seat count
- additional seat price
- included core workers
- entitlement model support for add-on workers
- internal usage summary in product-appropriate terms

After Seat / Entitlement Ops Polish Sprint 1, the billing overview is expected to read through five stable product blocks:

- organization summary
- lifecycle summary
- seat summary
- worker entitlement summary
- internal usage summary

Seat truth inside that overview is now frozen as:

- active seats count only `ACTIVE` memberships
- invited members stay visible but do not count as active seats yet
- inactive members stay visible for history but do not count as active seats
- trial collaborator seats remain a temporary trial allowance
- paid additional active seats remain the paid posture that applies after activation

It does not expose:

- token billing
- storage billing
- invoice workflows
- payment collection flows

Subsequent narrow payment integration may extend this overview with:

- checkout entry
- billing portal entry
- provider sync status

But the settings surface must still remain a product billing overview, not a finance console.

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
- no auth-provider swap
- no route-owner or query-structure rewrite
- no token / storage external billing
- no worker marketplace

## Intentionally deferred

PR11 does not implement:

- payment checkout / portal
- invoice engine
- coupon / discount logic
- tax handling
- retry / dunning
- payout rails
- partner commission / revenue-sharing ledger
- SSO / SCIM / enterprise auth
- full RBAC builder
- multi-workspace
- connector marketplace
- worker marketplace

## Baseline decision

`Helm Billing Foundation v1` is now frozen as the narrow commercial-operability layer for current-main.

It makes Helm organization-based and commercially legible without widening Helm beyond its current operating-workspace scope.
