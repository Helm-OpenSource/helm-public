---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Add-on Worker Commercial Plan V1

## Purpose

Freeze the first narrow commercial wiring layer for add-on workers without turning Helm into a worker marketplace, entitlement console, or billing platform.

This plan exists to make current-main worker entitlement truth easier to explain, demo, and extend later.

## Current truth

Helm already has a real `WorkerEntitlement` model with:

- `INCLUDED`
- `ADD_ON_MONTHLY`
- `ADD_ON_PER_USE`

Current core workers remain included:

- `meeting_os_worker`
- `review_memory_worker`

Current future add-on rails remain conservative:

- `deal_desk_worker`
- `specialist_review_worker`

Trial and paid access still expose the full current core product.
This plan does not change that truth.

## Frozen add-on commercial truth

### Included core workers

- Included core workers are real entitlements, not just labels.
- They remain active by default in trial and active paid access.
- They are not sold separately in Sprint 1.

### Add-on monthly truth

- `ADD_ON_MONTHLY` means a future recurring commercial rail.
- It must be visible and explainable in product.
- It must not imply that a live add-on checkout flow already exists.
- There is no add-on purchase flow yet.

### Add-on per-use truth

- `ADD_ON_PER_USE` means a future per-use commercial rail.
- It must be visible and explainable in product.
- It must not imply that usage-based billing is already customer-visible.
- There is no add-on purchase flow yet.

### Active / inactive entitlement truth

- `ACTIVE` means the entitlement is currently in force.
- `INACTIVE` means the entitlement remains a reserved future rail or an inactive commercial path.
- `CANCELED` may remain visible for operational truth, but does not count as an active commercial rail.

### Effective window

- Effective window remains visible as an operational boundary, not as an invoice construct.
- `effective_from` and `effective_to` should stay readable in settings.

### Internal limit

- `internal_limit` remains an internal operational control.
- It may be shown as product-safe context, but not as a customer-visible usage billing line.

## What settings must explain

Settings billing overview must clearly show:

- which workers are included
- which workers are future commercial rails
- which rails are monthly vs per-use
- which rails are active vs inactive
- which rails have an effective window
- which rails carry an internal limit

It must also keep the current boundary clear:

- no worker marketplace
- no worker app store
- no creator payout
- no partner revenue share
- no complex add-on checkout matrix yet

## Intentionally deferred

Still deferred in this sprint:

- live add-on worker checkout
- creator revenue sharing
- partner payout rails
- worker marketplace UX
- complex entitlement admin console
- usage-based customer billing lines

## Success standard

This sprint passes only if:

- add-on worker commercial truth is clear
- settings can explain included / monthly / per-use cleanly
- current worker rails are visible without overclaiming availability
- documentation, tests, guards, and self-check all use the same truth
