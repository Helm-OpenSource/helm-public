---
status: active
owner: Product / Design / Engineering
created: 2026-05-29
review_after: 2026-08-27
---
# Helm Sitewide Customer Asset UX Convergence: Secondary Surfaces

## Conclusion

This slice applies the customer-asset-first rule to five secondary operating pages:

- `/reports`
- `/imports`
- `/settings`
- `/diagnostics`
- `/analytics`

Classification: **已成形但仍需下一层**.

The default visible layer now starts with concrete operating assets, pressure, pending judgement, and the next route. Product mechanics, permission notes, readiness explanations, field guides, and long operating summaries are moved behind short `引用 / Reference` disclosures where applicable.

## Design Rule

The first screen must answer:

1. What customer or operating asset is being read?
2. What pressure or blocker matters now?
3. What should a human decide or open next?
4. What did AI help with, or where did it safely stop?

The first screen must not lead with:

- reading preferences
- product framework explanations
- hidden implementation vocabulary
- generic diagnostic telemetry
- import mechanics before customer objects
- settings theory before the control that blocks today's work

## Page-Level Changes

### `/reports`

- Added `CustomerAssetFocusStrip` after the page header.
- First visible readout now starts from the current review asset, overdue pressure, high-risk count, accepted work count, owner focus, and next risky object route.
- Read-only insight posture and engineering delivery review are now reference disclosures.

### `/imports`

- Added `CustomerAssetFocusStrip` after the page header.
- First visible readout now starts from customer ledger intake, identity debt, pending source decision, and next ingress action.
- The previous object-context summary, CRM connection entry card, and field guide are now reference disclosures.

### `/settings`

- Added `CustomerAssetFocusStrip` after the page header.
- First visible readout now starts from access/source state, connector or review blocker, control decision, and the next setting to change.
- The old settings basis summary and recommendation panel are now reference disclosures.
- Display preferences remain behind the existing display-options disclosure instead of occupying page body by default.

### `/diagnostics`

- Added `CustomerAssetFocusStrip` after the page header.
- First visible readout now starts from whether the customer loop can move today, strongest blocker, pending decision, and the next check route.
- Meeting workflow readiness and pilot readiness judgement are now reference disclosures.

### `/analytics`

- Added `CustomerAssetFocusStrip` after the page header.
- First visible readout now starts from verified movement, stopped work, pending usage decision, and AI work posture.
- This page keeps metrics visible after the focus strip because analytics needs scannable numbers, but the opening frame is no longer raw activity volume first.

## Code Scope

Changed:

- `components/shared/customer-asset-focus-strip.tsx`
- `features/reports/reports-client.tsx`
- `features/imports/imports-client.tsx`
- `features/settings/settings-client.tsx`
- `features/settings/components/settings-overview-panels.tsx`
- `features/diagnostics/diagnostics-client.tsx`
- `features/analytics/analytics-client.tsx`
- `lib/presentation/shared-surface-hierarchy-guards.test.ts`
- `tests/e2e/detail-hierarchy.spec.ts`

Not changed:

- database schema
- API contracts
- permission model
- production runtime adoption
- official write
- external send
- automatic approval
- automatic execution

## Validation

Passed:

```bash
git diff --check
npx eslint components/shared/customer-asset-focus-strip.tsx features/reports/reports-client.tsx features/imports/imports-client.tsx features/settings/settings-client.tsx features/settings/components/settings-overview-panels.tsx features/diagnostics/diagnostics-client.tsx features/analytics/analytics-client.tsx tests/e2e/detail-hierarchy.spec.ts lib/presentation/shared-surface-hierarchy-guards.test.ts
npm run lint
npm run typecheck
npx vitest run lib/presentation/shared-surface-hierarchy-guards.test.ts
DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4' npm run self-check
DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4' npm run check:boundaries
DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4' npm run build
```

Browser-path validation attempted:

```bash
npx playwright test tests/e2e/detail-hierarchy.spec.ts -g "reports/imports/settings/diagnostics/analytics 首屏先暴露用户资产读数"
DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_e2e_codex_siteux_20260529?charset=utf8mb4' DB_RESET_ALLOWLIST='helm2026_e2e_codex_siteux_20260529' npm run db:reset
```

Blocked locally because this machine currently has no reachable MySQL server on `127.0.0.1:3306`, and Docker is not installed, so the isolated Playwright database could not be created. The E2E test itself was added and typechecked; it should be run in an environment with local MySQL or CI e2e DB support.

## Remaining Risk

- The five pages are source-guarded and typechecked, but full browser-path evidence is pending a local or CI MySQL runtime.
- This slice does not mean all 18 console menus are complete.
- This slice does not prove production data quality, runtime adoption, or tenant-specific extension readouts.

## Next Best Step

Run the new Playwright test in a MySQL-backed environment, then continue the same pass on `/meetings`, `/memory`, `/capture`, `/customer-success`, and extension-backed report tabs.
