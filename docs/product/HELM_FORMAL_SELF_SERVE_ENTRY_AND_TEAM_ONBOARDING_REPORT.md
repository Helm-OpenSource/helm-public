---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Formal Self-Serve Entry And Team Onboarding Report

## Scope

This polish pass tightens the user-facing path from:

- public entry
- verified self-serve trial signup
- setup
- teammate invite
- invited-member organization entry

It does not widen Helm into:

- a full auth platform
- a growth automation platform
- a full invite-delivery platform
- a company operating system platform

## What changed

- Source report anchor: `HELM_FORMAL_SELF_SERVE_ENTRY_AND_TEAM_ONBOARDING_REPORT.md`
- public entry now leads with formal trial signup and existing-organization entry instead of demo-first framing
- `/login` now provides a dedicated formal sign-in entry instead of relying only on homepage discovery
- new customers now verify both work email and phone before workspace creation
- new customers now set a password during signup instead of entering a demo-like instant trial
- verified members can now sign in with password or phone verification code
- existing invited teammates can still continue with work email from the same public entry through a narrow compatibility path
- login success messaging now distinguishes:
  - demo workspace
  - invited organization entry
  - normal organization entry
- the workspace shell now exposes an explicit sign-out action so users can leave the current organization without clearing cookies manually
- `/setup` now includes teammate invite as a first-class initialization step
- settings permissions now explain the formal invite-acceptance path more clearly
- trial onboarding now points users toward teammate invite before asking them to rely on demo or manual retell

## User walkthrough

### 1. New customer registration

- Open the public landing.
- Enter name, work email, phone number, organization name, and password.
- Request the formal trial verification.
- Complete both:
  - email verification code
  - phone verification code
- Helm then starts the 30-day trial directly.
- Helm creates:
  - `User`
  - `Workspace`
  - `OWNER` membership
  - `BillingAccount`
  - `TrialState`
  - included core `WorkerEntitlement`
- 默认 seat posture 仍然是：
  - 1 个 owner / admin 席位
  - 2 个协作试用席位
- The user lands in `/setup`.

### 2. Initial workspace setup

The setup flow now covers six concrete steps:

1. persona
2. connectors
3. focus areas
4. default policies
5. teammate invite
6. intelligence settings

This keeps initialization product-grade instead of treating invite as a later hidden admin task.

### 3. Invite teammates

- Owner enters teammate work email, optional name, role, and title.
- Helm writes an `INVITED` membership immediately.
- The invited teammate is visible in organization operations but does not count as an active seat yet.
- The owner is told exactly how the teammate should enter:
  - open the public entry
  - use the same work email
  - continue into the invited organization

### 4. Invited teammate entry

- Teammates do not need a demo account.
- 同事不需要 Demo 账号。
- In the current version they use the narrow compatibility work-email path.
- Helm selects the invited membership, creates session cookies, and activates the membership on workspace entry.
- They continue into the real organization workspace instead of a demo loop.

### 5. Formal sign-in after the first signup

- Verified members can sign in with:
  - work email or phone + password
  - phone + verification code
- Work-email-only continuation remains available only as a compatibility path for already invited or legacy pilot users.

## Preserved boundaries

- demo still exists, but is now clearly secondary and internal-storytelling-oriented
- the public path is formal first, but internal teams can still `Enter demo workspace` when they need the seeded walkthrough
- Trial / Paid 继续开放完整当前核心能力，当前 trial 不是功能阉割
- signup and invite emails now use the system Aliyun mailbox when configured
- SMS and fallback verification still keep in-product preview as controlled-trial infrastructure
- no full invitation-delivery system was added
- no full RBAC builder was added
- recommendation / commitment remains explicit and unchanged

## Why this matters

Helm can now convert a real customer from the public entry without requiring demo as the first step, while still preserving the built-in demo routes for scripted storytelling.
