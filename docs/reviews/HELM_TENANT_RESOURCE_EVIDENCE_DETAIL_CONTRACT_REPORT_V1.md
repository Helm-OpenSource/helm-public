---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Tenant Resource Evidence Detail Contract Report V1

## Scope

This report closes the first slice of the second tenant-resource governance stage: Resource Evidence Detail Contract.

The goal was not to add connectors, guarded official write, a policy engine, or a manual proof submission workflow. The goal was to make the evidence behind each resource-backed judgement inspectable and reusable by later proof / mapping / policy work.

## Already Complete

- `TenantResourceEvidenceDetail` now opens resource identity, source object, freshness, trust, mapping, conflict, capability decision, manual proof posture, governed loop posture, evidence items, and boundary notes.
- `TenantResourceGovernedLoop` now carries the full capability trace, so downstream readouts can show why a resource was allowed, routed to review, asked for human acknowledgement, or denied.
- `TenantResourceOperatingImpactReadout` now carries the evidence detail for each impact row.
- Settings resource cards now expose a read-only `查看依据 / View evidence` disclosure.
- Dashboard / operating resource impact cards now expose the same evidence detail posture and link back to the settings resource anchor.
- Target tests cover usable, stale/review, blocked, evidence refs, conflict posture, manual proof lifecycle posture, and stable anchors.

## Formed But Still Needs Next Layer

- Manual proof is still only a lifecycle posture: `not_required / required / review_required / blocked`.
- Field-level mapping gap is not yet implemented; this slice only opens existing mapping completeness, missing requirements, and conflicts.
- Tenant policy is not a policy engine; no policy readout has been added yet.
- Guarded official write remains deferred until evidence detail, manual proof, field-level mapping gap, and policy readout are all established.

## Deliberately Not Done

- No new connector.
- No schema migration.
- No external write-back.
- No guarded official write.
- No policy engine.
- No manual proof submit/review/fail/withdraw/expire persistence.
- No new execution button.
- No orchestration plane.

## Risk Items

- Evidence item labels are currently derived from existing evidence refs. Later slices may need richer source-object display once field-level mappings exist.
- Manual proof lifecycle is descriptive only. A later proof slice must define submitter, reviewer, expiry, withdrawal, failure, and follow-through transitions before proof can be treated as operational truth.
- Settings and operating now share the same evidence detail contract, but browser-level visual verification was not run in this slice.

## Validation

Passed:

```bash
npm run test -- lib/tenant-resources/evidence-detail.test.ts lib/tenant-resources/governed-loop.test.ts lib/tenant-resources/operating-impact.test.ts features/settings/tenant-resource-readiness-display.test.ts
npm run typecheck
npm run lint
DATABASE_URL='mysql://user:pass@127.0.0.1:3306/helm2026_ci_verify' npm run self-check
npm run check:boundaries
git diff --check
npm run build
```

Result: 4 files / 14 tests passed; typecheck, lint, self-check, boundaries, diff check and build passed.

Notes:

- `npm run lint` still reports the repo's existing 7 warnings in unrelated files.
- `npm run build` still reports the existing Turbopack NFT trace warnings through the BI report skill loader and DingTalk ingestion paths.
- `npm run db:reset` and `npm run e2e` were not run in this slice because no schema, persistence lifecycle, or browser flow was added.
