---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Seat Membership Lifecycle Polish Report

## Purpose

This report tightens the product truth around membership lifecycle in Helm v1.

The goal is to keep seat posture, membership posture and runtime organization access aligned without turning Helm into a seat-management platform or RBAC builder.

## What changed

- new members added from settings now default to `INVITED` unless the membership is already active
- `INVITED` members stay visible in organization operations but do not count as active seats yet
- `INACTIVE` members stay visible for history and audit context but do not count as active seats
- runtime organization selection now prefers `ACTIVE` memberships over `INVITED` ones
- when an invited member actually enters an organization, the membership can promote to `ACTIVE`

## Frozen lifecycle truth

- `ACTIVE`
  - counts as an active seat
  - participates in the current workspace runtime
- `INVITED`
  - visible in team operations
  - does not count as an active seat yet
  - becomes `ACTIVE` only when the user actually enters the organization
- `INACTIVE`
  - kept for history and audit readability
  - does not count as an active seat
  - is not the default runtime membership path

## Product effect

Settings can now explain:

- which members are already active
- which ones are only invited
- which ones are inactive but historically relevant
- why invited and inactive members do not change paid seat posture yet

## Preserved boundary

This is still:

- not a full RBAC builder
- not a seat administration platform
- not a finance console

