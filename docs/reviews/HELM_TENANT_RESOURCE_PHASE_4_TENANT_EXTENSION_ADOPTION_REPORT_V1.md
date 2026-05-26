---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Tenant Resource Phase 4 Tenant Extension Adoption Report V1

## Status

Phase 4 is implemented on this branch.

## Scope

This slice closes the next narrow layer after Phase 3:

- extend tenant custom extension manifests with explicit resource dependency declarations
- validate those declarations in the existing manifest validation path
- derive extension adoption readouts from readiness truth
- expose the adoption posture inside existing settings / operating evidence disclosures

## Implementation

- Added `resourceDependencyDeclarations` support to `lib/solution-extension-manifests.ts` and updated Guangpu sample manifests.
- Added `lib/tenant-resources/extension-manifest.ts` to convert manifest truth into tenant-resource manifest input without duplicating helper logic.
- Added `lib/tenant-resources/extension-adoption.ts` and unit coverage.
- Wired extension adoption into `lib/tenant-resources/evidence-detail.ts`, `features/settings/queries.ts`, and `lib/tenant-resources/workspace-operating-impact-query.ts`.
- Extended settings and operating `查看依据 / View evidence` disclosures to show extension adoption summary and declared dependencies.
- Synced manifest schema / extension protocol docs and tenant-resource guardrails for the Phase 4 slice.

## Already Complete

- Tenant custom extension dependency declarations are now explicit instead of only implied by legacy connector lists.
- Settings and operating evidence disclosures can explain whether an extension dependency is only declared, validated, read-adopted, governed-loop-adopted, blocked, or superseded.
- Manifest validation now fails closed when Phase 4 declarations are malformed or overclaim capability mode.
- The slice still reuses the existing readiness / evidence / governed-loop seams instead of inventing a new control plane.

## Formed But Still Needs Next Layer

- Adoption readout is still a read model, not a runtime execution contract.
- Legacy connector-only manifests still degrade into fallback dependency readouts; future cleanup can require explicit declarations tenant by tenant.
- Extension adoption may explain governed-loop binding, but it still relies on the current local read model rather than a dedicated extension governance ledger.

## Deliberately Not Done

- No remote runtime server.
- No connector provisioning flow.
- No provider credential mutation.
- No guarded official write implementation.
- No sandbox or swarm UI.
- No policy engine.

## Risk Items

- If extension manifests drift from real tenant-owned object boundaries, Helm may explain the wrong dependency despite still staying review-first.
- Because fallback from legacy connector declarations is still allowed, some extensions may remain only partially explicit until their manifests are tightened.
- A later real execution layer still needs idempotency, rollback, receipt truth, and external-write guardrails that Phase 4 intentionally does not solve.

## Validation

Passed:

```bash
npm run test -- lib/tenant-resources/readiness.test.ts lib/tenant-resources/evidence-detail.test.ts lib/tenant-resources/operating-impact.test.ts lib/tenant-resources/extension-adoption.test.ts lib/solution-extension-manifests.test.ts
npm run typecheck
npm run lint
DATABASE_URL='mysql://root:***@rm-shuyao-dev-pub.mysql.rds.aliyuncs.com:3306/helm2026_ci_verify?charset=utf8mb4' npm run self-check
npm run check:boundaries
npm run build
git diff --check
```

Not run:

- `npm run db:reset`: Phase 4 adds no schema migration.
- `npm run e2e`: this slice adds read-model adoption and evidence disclosure only; it does not add a browser execution flow or external write route.
