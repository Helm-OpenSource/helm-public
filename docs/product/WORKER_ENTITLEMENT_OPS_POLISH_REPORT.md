---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Worker Entitlement Ops Polish Report

## Purpose

This report tightens how worker entitlements are shown and interpreted in Helm v1.

## What changed

- Included core workers are now presented as real active entitlements
- add-on monthly and add-on per-use paths are shown as conservative commercial paths, not as a live marketplace
- active vs inactive entitlement posture is visible
- effective window and internal limit are shown when present
- future commercial entitlements can appear as reserved paths without pretending purchase flow already exists

## Frozen entitlement truth

- included core workers:
  - `meeting_os_worker`
  - `review_memory_worker`
- commercial entitlement types remain:
  - `ADD_ON_MONTHLY`
  - `ADD_ON_PER_USE`
- current inactive commercial entries are future-ready entitlement placeholders, not worker marketplace availability

## Product effect

Settings can now explain:

- which workers are included and active now
- which commercial add-on paths are only reserved for future polish
- whether an entitlement is active, inactive or time-bounded
- whether an internal usage limit exists

## Preserved boundary

This is not a worker marketplace.
This is not a full entitlement console.
