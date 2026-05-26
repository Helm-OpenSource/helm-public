---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Billing Foundation Plan v1

## Purpose

This document defines the rollout plan for PR11:
the organization / membership / trial / billing foundation for Helm v1.

The goal is to make Helm commercially operable as an organization-first B2B product without widening product scope, changing route ownership, or turning Helm into a payment platform in this round.

## Current auth / session / account reality

Current-main already has a real tenant seam, but it is still demo-shaped:

- `Workspace` is the current tenant boundary used across product reads and writes.
- `Membership` already links users to workspaces.
- `User` session is currently derived from the `helm-demo-session` cookie.
- `getCurrentWorkspace()` currently resolves the active workspace as `user.memberships[0]`.
- `app/(workspace)/layout.tsx` and most route / API seams read from that active workspace.
- `settings`, `setup`, `workspace layout`, quick-create flows, connectors, imports, approvals, memory, diagnostics, and dashboard all already run under workspace scope.

What is missing today:

- no explicit organization-first commercial model in the live domain layer
- no active workspace / organization selection cookie
- no billing account model
- no trial / grace / read-only state model
- no worker entitlement model
- no internal usage ledger for billing/accounting
- no billing overview in settings
- current membership roles are still the older `ADMIN / APPROVER / MEMBER` set

## Reusable current-main seams

The repo already has reusable current-main-friendly seams for this PR:

- `Workspace` can act as the v1 organization boundary because v1 truth is `one organization = one workspace`
- `Membership` already exists and is used broadly
- `Settings` is already the right product surface for billing overview and team/account visibility
- `SetupWizard` is already the right place to convert demo / setup into organization state
- `lib/auth/session.ts` is already the central place for active-workspace session logic
- `features/workspace/queries.ts` already powers the workspace shell and can carry lightweight org/account context

This means PR11 does not need:

- a second app tree
- a new auth provider
- a route-owner rewrite
- a `data/queries.ts` rewrite
- a separate org platform layer

## Proposed objects

PR11 will use the narrowest current-main-friendly model:

### 1. Organization boundary

For v1, `Workspace` remains the real runtime tenant and is treated as the organization boundary.

This PR will extend that boundary with:

- organization status on workspace
- active organization selection in session
- billing and trial objects keyed by `workspaceId`

This keeps current-main honest while matching the business truth:
`one organization = one workspace`.

### 2. Membership

Keep `Membership` as the user-to-organization relation, but expand the fixed v1 role set to:

- `OWNER`
- `BILLING_ADMIN`
- `ADMIN`
- `OPERATOR`
- `REVIEWER`
- `MEMBER`

Also add explicit membership status so the product can distinguish active vs invited / inactive members without introducing full RBAC.

### 3. BillingAccount

Add one billing account per workspace / organization with the minimum v1 commercial fields:

- current plan
- currency
- billing status
- organization base fee
- additional active seat price
- included admin seat count

### 4. TrialState

Add explicit lifecycle state per workspace / organization:

- `trialing`
- `active`
- `grace`
- `read_only`
- `canceled`

Plus the required dates:

- `trial_started_at`
- `trial_ends_at`
- `grace_ends_at`

### 5. WorkerEntitlement

Add a worker entitlement object keyed by workspace / organization:

- `worker_key`
- `entitlement_type`
- `status`
- `effective_from`
- `effective_to`
- `internal_limit`

This must support both:

- included first-party core workers
- future add-on workers

without building a marketplace in this PR.

### 6. UsageLedger

Add an internal-only usage/accounting object keyed by workspace / organization:

- `usage_type`
- `quantity`
- `recorded_at`
- source / metadata context

It is for internal accounting only.
It must not create customer-facing token / storage line items.

## Rollout phases

### Phase 0

Audit current seams and land this plan doc.

### Phase 1

Land the core domain layer:

- workspace-as-organization reality
- fixed membership roles + membership status
- billing account
- trial state
- worker entitlement
- usage ledger

Persistence should use the repo’s existing Prisma + migration pattern.

### Phase 2

Land minimum organization product behavior:

- create organization
- add / invite member using the narrowest current-main-friendly flow
- active organization selection / switching
- all current core surfaces read under active organization context

This phase must remain current-main-friendly and avoid multi-workspace expansion.

### Phase 3

Land trial / grace / read-only state behavior:

- new organizations can start in `trialing`
- trial includes 1 admin + 2 collaborator seats
- first-party core workers are included
- expired trial moves to `grace`
- expired grace moves to `read_only`
- `active` remains fully usable
- `grace` / `read_only` block only the explicitly listed new high-cost processing actions

### Phase 4

Land the minimal billing overview:

- active organization
- current state
- plan summary
- base fee
- included admin seats
- active seats
- seat pricing
- included core workers
- add-on worker model support
- internal usage summary in product-appropriate language only

### Phase 5

Freeze the package with:

- baseline doc
- acceptance report
- docs index updates
- tiny guard wording updates only if needed

## Preserved boundaries

- root `app/` remains route owner
- `data/queries.ts` remains compatibility façade
- no `apps/helm-app`
- no `packages/helm-control`
- no shell thinning
- no send authority
- no workflow control
- no second app tree
- no connector marketplace
- no broader governance / permissions platform
- no route-owner migration
- no auth-provider swap
- no payment checkout / portal / invoice engine in this PR

## Validation contract

After every phase:

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

After any real product behavior or view change:

- `npm run build`
- `npm run test`

At final closeout:

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

## Intentionally deferred

This PR intentionally does not implement:

- payment checkout / billing portal
- invoices
- coupons / discounts
- taxes
- retry / dunning
- payout rails
- partner commission or contribution payout systems
- SSO / SCIM / enterprise auth
- full RBAC builder
- multi-workspace expansion
- connector marketplace
- worker marketplace
- external token / storage / retrieval billing

## Definition of done for PR11

PR11 is done only when:

- Helm can operate in organization context using the current workspace seam
- active organization selection exists
- memberships and fixed v1 roles exist
- trial / active / grace / read_only states exist
- billing account, worker entitlement, and usage ledger exist
- settings shows a truthful billing overview
- current core product remains fully available in both trial and active states
- docs and acceptance packaging are complete
- validations are green
