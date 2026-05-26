---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Trial Onboarding / Self-Serve Signup Plan V1

## 1. Purpose

Freeze the v1 self-serve signup and trial onboarding scope so Helm can move from demo-first access into a real organization-first trial path without expanding into a growth platform, onboarding automation platform, or finance console.

Helm v1 self-serve trial onboarding is not a growth platform.

## 2. Current reality

- Helm already has `Workspace == Organization` as the v1 commercial boundary.
- `Membership` already acts as the user-to-organization seam.
- `BillingAccount`, `TrialState`, `WorkerEntitlement`, and `UsageLedger` already exist.
- Active organization runtime already exists through `createSession`, `ACTIVE_WORKSPACE_COOKIE`, and `getCurrentWorkspaceSession()`.
- `ensureWorkspaceCommercialFoundation()` already initializes:
  - Helm Team billing account
  - `trialing / active / grace / read_only / canceled` lifecycle truth
  - included core workers
  - reserved future add-on worker rails
- Current gap: login remains demo-only, and trial onboarding is not yet a complete self-serve product path.

## 3. Product truth for this sprint

### Signup truth

- A new user can start a self-serve trial from the public landing experience.
- Signup creates exactly one organization by default.
- signup creates one organization by default
- The signup user becomes the initial `OWNER` and active admin for that organization.
- the first user becomes the initial `OWNER`
- Signup immediately creates an active organization session.
- Signup lands the user into `/setup` with a trial onboarding surface.

### Trial truth

- Trial starts when the organization is created.
- Trial state is `trialing` on creation.
- Trial includes:
  - 1 admin seat
  - 2 collaborator trial seats
  - all current first-party core workers
- Trial and paid keep the full current core product.
- Trial 和 Paid 都开放完整当前核心功能
- Differences remain lifecycle-based and commercial-state-based, not feature-gating-based.

### Onboarding truth

The first onboarding surface must tell the user:

- which organization was created
- what their role is
- that trial is active
- when trial ends
- what happens during grace and read-only
- what seats are currently available
- which core workers are included
- what the next three actions are
- where billing overview lives
- where purchase or restore will happen

## 4. Runtime scope

### This sprint lands

- self-serve signup action
- organization creation for a new user
- membership creation with owner/admin truth
- billing foundation initialization
- included worker entitlement initialization
- active organization session initialization
- trial onboarding surface on `/setup`
- lifecycle messaging for `trialing / grace / read_only`
- alignment with settings billing overview

### This sprint does not land

- full growth funnel platform
- nurture email system
- enterprise provisioning
- SSO / SCIM
- multi-workspace onboarding
- full RBAC builder
- finance console
- payment / invoice / tax / dunning expansion
- customer-visible token or storage trial quotas

## 5. Default object initialization

For a new self-serve trial organization:

- create 1 `Workspace`
- create 1 `User` if it does not already exist
- create 1 `Membership` with:
  - role: `OWNER`
  - status: `ACTIVE`
- initialize `BillingAccount`
- initialize `TrialState`
- initialize included core `WorkerEntitlement` rows
- initialize reserved future add-on worker rails
- seed default policies and narrow budget defaults so the workspace is not an empty shell
- create active organization session cookies

## 6. Surface plan

### Public landing

- Keep the demo path.
- Add a self-serve trial path alongside demo login.
- Demo and self-serve must share one product truth and not contradict each other.

### `/setup`

- Reuse `/setup` as the first self-serve onboarding surface.
- Keep the existing setup wizard.
- Add a trial onboarding summary above the wizard for new self-serve organizations.
- Do not create a second app tree or a separate onboarding platform.

### Settings

- Continue to hold the billing overview and lifecycle detail.
- Trial onboarding can link the user into settings for billing overview and later purchase / restore actions.

## 7. Messaging truth

- `trialing`: full core access, clear end date, clear next three actions
- `grace`: view and export remain available, new high-cost processing narrows
- `read_only`: view and export remain available, no new high-cost processing
- Trial messaging must not sound like finance tooling or quota enforcement.

## 8. Preserved boundaries

- no Billing Foundation core model rewrite
- no `Workspace == Organization` rewrite
- no Trial / Paid feature crippling
- no second app tree
- no shell thinning
- no route-owner changes
- no `data/queries.ts` rewrite
- no finance console
- no marketplace
- no enterprise IAM platform
- no customer-visible usage billing for token / storage / retrieval

## 9. Validation contract

At final closeout run:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `DATABASE_URL='file:./prisma/dev.db' npm run self-check`
- `npm run check:boundaries`
- `npm run build`
- `npm run test`

## 10. Definition of done

This sprint is done when:

- self-serve signup truth is documented
- signup creates organization + membership + trial + included workers automatically
- the user lands inside active organization runtime without manual repair
- `/setup` explains trial, seats, included workers, next steps, and purchase / restore path
- settings, docs, guards, tests, and self-check all reflect the same truth
- demo entry and self-serve entry no longer conflict
