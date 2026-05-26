---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Mobile + Business Advancement Code Review Response V1

Date: 2026-04-26

Scope:

- Mobile Command Surface v1 implementation
- Business Advancement Phase 1-3 planning artifacts
- Review input: Mobile Command Surface v1 + Business Advancement Phase 1-3 code review

## 1. Decision

Conclusion: **accepted with scoped fixes**.

This response accepts the valid Mobile Command Surface findings and keeps Business Advancement inside its approved planning-only boundary.

## 2. Findings Disposition

| Review finding | Decision | Action |
| --- | --- | --- |
| Business Advancement planning type errors | Already resolved / stale | Current `npm run typecheck` passes. No additional Business Advancement code change required. |
| Mobile read-model hardcoded Chinese copy | Accepted | `GetMobileCommandReadModelInput.english` now flows from `/mobile` into the read model and all Must Push producer copy. |
| Magic numbers in mobile read model | Accepted | Query limits and deterministic scoring baselines are now named constants with ranking intent comments. |
| Empty Must Push UI state lacks test | Accepted | Added component test for the empty state and verified no action links are rendered. |
| `hasCriticalFolded` boundary lacks test | Accepted | Added pure read-model test proving critical overflow is only flagged when the critical item is actually folded. |
| DB-backed E2E blocked by local DB | Deferred | Not changed in this patch. This remains an environment/runbook issue, not a Mobile Command Surface code blocker. |
| Business Advancement planning vs runtime boundary ambiguity | Already guarded | Phase 3F keeps runtime adoption at No-Go and only allows source-query evidence audit next. No runtime/schema/API/UI adoption is approved. |

## 3. Implementation Summary

Changed Mobile Command Surface behavior:

- `/mobile` passes the current UI language into `getMobileCommandReadModel`.
- `features/mobile/lib/mobile-command-read-model.ts` generates Must Push titles, reasons, action labels, boundary notes, and today summary in English or Chinese.
- Tenant resource readout now receives the same language flag instead of hardcoding Chinese readout posture.
- Deterministic query limits and score bases are named constants.

Changed tests:

- Added empty-state and folded-critical tests for Must Push list/read-model behavior.
- Added English summary coverage for the read model.

## 4. Boundary Check

The patch does **not**:

- Add schema changes.
- Add API routes.
- Add execution authority.
- Add automatic send / approve / official write behavior.
- Adopt Business Advancement planning artifacts into runtime.
- Change Business Advancement source queries or production read models.

## 5. Validation

Executed:

```bash
npx vitest run features/mobile/lib/mobile-command-read-model.test.ts features/mobile/components/must-push-list.test.tsx
npm run typecheck
npx eslint 'app/(workspace)/mobile/page.tsx' features/mobile/lib/mobile-command-read-model.ts features/mobile/lib/mobile-command-read-model.test.ts features/mobile/components/must-push-list.tsx features/mobile/components/must-push-list.test.tsx
```

Result:

- Targeted Vitest: **2 files / 8 tests passed**
- Typecheck: **passed**
- Targeted ESLint: **passed**

Not executed in this response:

- DB-backed Playwright E2E, because the review issue is a known local DB environment blocker and this patch does not change the DB-backed path.

## 6. Remaining Risks

- Mobile Command Surface still relies on existing DB-backed sources; full E2E remains dependent on standardized local DB setup.
- English copy is intentionally concise and operational. It should be reviewed later with final product messaging, but it now avoids hardcoded Chinese in the data adapter.
- Business Advancement remains planning-only until a separate source-query evidence audit resolves Phase 3F blockers.
