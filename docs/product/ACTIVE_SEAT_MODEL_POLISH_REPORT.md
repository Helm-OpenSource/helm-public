---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Active Seat Model Polish Report

## Purpose

This report freezes the first stable active-seat explanation layer on top of the Helm billing foundation.

## What changed

- active seat count is now explained only through `Membership.status === ACTIVE`
- invited seats are visible but not counted
- inactive seats are visible but not counted
- trial collaborator seats are explained as temporary trial allowance, not paid-seat parity
- paid additional active seats are shown as the paid posture that would apply once the organization is active

## Frozen seat truth

- included paid seat posture:
  - `1` included admin seat
- trial collaborator allowance:
  - `2` collaborator seats during trial
- active seat count:
  - only active memberships
- additional active seats:
  - active seats beyond the included admin seat
- trial seat pressure:
  - visible if active members exceed the trial allowance

## Product effect

The billing overview can now answer:

- active seats now
- how many active seats exist now
- how many seats are still invited or inactive
- how much of the current posture is already inside included paid seats
- how many seats would become additional paid seats after activation

## Preserved boundary

This is still a product billing overview.
It is not a seat billing table or finance console.
