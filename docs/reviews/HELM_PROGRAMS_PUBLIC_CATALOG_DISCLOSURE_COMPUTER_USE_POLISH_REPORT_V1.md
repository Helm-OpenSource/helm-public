---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Programs Public Catalog Disclosure Computer Use Polish Report v1

Date: 2026-04-22
Status: Targeted validation passed; DB-backed full validation blocked by local MySQL

## 1. Scope

This slice continues the Computer Use / Playwright evaluation loop on the public participation catalog:

- `/programs`
- `/programs/worker-publisher-program`
- `/programs/custom-partner-program`
- `/programs/sales-referral-program`

The work stays at display copy, layout resilience and guard wording. It does not change partner program records, application submission, review/invite lifecycle, participant portal access, settlement, payout, revenue attribution, or reserved-workspace governance.

## 2. What Changed

- Added a Chinese display normalization layer for program catalog copy so the public Chinese surface says 能力贡献者 / 定制交付伙伴 / 销售转介绍 / 内部审核 / 线下人工结算 instead of raw worker / marketplace / review / manual settlement terms.
- Kept English catalog copy unchanged for partner-facing specificity.
- Updated `/programs`, `/programs/[slug]` and the public application form to remove raw mixed English from the Chinese default path.
- Added mobile shrink/wrap protection to the public programs header and program cards so buttons and long participation titles no longer push the page wider than the viewport.
- Updated the program catalog boundary guard wording from `不是公开 marketplace` to `不是公开市场`.
- Added focused regression coverage for Chinese catalog copy and English copy preservation.

## 3. Computer Use Result

Computer Use was attempted again:

- `list_apps` succeeded and showed Safari / Atlas running.
- `get_app_state` for Safari returned `cgWindowNotFound`.
- `get_app_state` for Atlas returned `cgWindowNotFound`.

Because the browser key window was still unavailable through Computer Use, Playwright remained the repeatable live-page validation path against the local Next.js dev server.

## 4. Verification

Passed:

- Focused Playwright `/programs` + 3 detail routes, desktop 1440x1100 and mobile 390x900: target terms 0, horizontal overflow 0, business console errors 0.
- Broader Playwright scan across 34 routes x 2 viewports = 68 checks: issueCount 0.
- `npm run test -- lib/billing/program-catalog-display.test.ts`
- `npm run test -- lib/billing/program-catalog-display.test.ts lib/billing/foundation-service-governance.test.ts`
- `npm run typecheck`
- `npm run self-check`
- `npm run check:boundaries`
- `git diff --check`
- `npm run lint` passed with 7 existing warnings and no errors.
- `npm run quality:regression` passed with 51 files / 181 tests.
- `npm run build` passed with the existing Turbopack NFT trace warning.

Blocked / intentionally skipped:

- `npm run db:reset` was not run because it is a destructive local database reset.
- Full DB-backed `npm run test` and `npm run e2e` were not run in this slice because local MySQL at `127.0.0.1:3306` is currently unreachable.

## 5. Remaining Risk

- This slice normalizes public Chinese display copy at read time; it does not migrate existing stored partner program rows.
- Expanded internal admin surfaces may still contain raw program governance terms where they are operator-facing evidence, not public-facing copy.
- Full DB-backed runtime validation still depends on restoring local MySQL.

## 6. Next Step

The next useful loop is to expand the strict scanner to additional dynamic commercial/detail routes while continuing to separate public/default language from internal governance evidence.
