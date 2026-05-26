---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Demo Entry Disclosure Computer Use Polish Report v1

Date: 2026-04-22
Status: Targeted and non-destructive validation passed; DB-backed full validation blocked by local MySQL

## 1. Scope

This slice continues the Computer Use / Playwright evaluation loop on the public demo entry at `/demo`.

The work stays at display copy and layout resilience. It does not change demo accounts, `loginAction`, trial entry routing, workspace state, review/send authority, or the underlying recommendation/commitment boundary.

## 2. What Changed

- Reworked Chinese demo profile copy so public/default wording says 承诺 / 阻碍 / 下一步建议 / 经营信号层 / 现场记录 / 智能处理 / 改进建议 instead of raw implementation terms such as `commitments`, `blockers`, `recommendation`, `LLM`, `capture`, `evolution`, `follow-up`, `shortlist`, `champion`, and `pipeline`.
- Kept English demo profile copy unchanged for English-mode positioning.
- Updated `/demo` Chinese labels that still read as mixed English, including `Demo` and `workflow control`.
- Added mobile shrink/wrap protection to the demo header, hero section, featured card, mode cards, and lower grid so long action rows and role cards no longer push the page wider than the viewport.
- Added focused regression coverage for Chinese demo profile copy.

## 3. Computer Use Result

Computer Use was attempted again:

- `list_apps` succeeded and showed Safari / Atlas running.
- `get_app_state` for Safari returned `cgWindowNotFound`.
- `get_app_state` for Atlas returned `cgWindowNotFound`.
- Looking up Atlas by app name triggered MCP approval denial for `com.openai.atlas.web`, so no browser interaction was performed through Computer Use.

Because the browser key window was still unavailable through Computer Use, Playwright remained the repeatable live-page validation path against the local Next.js dev server.

## 4. Verification

Passed:

- Focused Playwright `/demo`, desktop 1440x1100 and mobile 390x900: target terms 0, horizontal overflow 0, business console errors 0.
- Crawled Playwright scan across 19 routes x 2 viewports = 38 checks: issueCount 0.
- Representative Playwright scan across 26 current/history routes x 2 viewports = 52 checks: issueCount 0.
- `npm run test -- lib/demo/demo-modes.test.ts`
- `npm run typecheck`
- `npm run self-check`
- `npm run check:boundaries`
- `git diff --check`
- `npm run lint` passed with 7 existing warnings and no errors.
- `npm run quality:regression` passed with 51 files / 181 tests.
- `npm run build` passed with the existing Turbopack NFT trace warning.

Blocked / intentionally skipped:

- `npm run db:reset` was not run because it is a destructive local database reset.
- Full DB-backed `npm run test` and `npm run e2e` remain blocked until local MySQL at `127.0.0.1:3306` is reachable.

## 5. Remaining Risk

- English-mode copy still intentionally contains English product and implementation vocabulary; this slice only governs the Chinese default path.
- Internal evidence/debug surfaces may still contain raw terms when they are true trace or governance evidence, not default public copy.
- Full DB-backed runtime validation still depends on restoring local MySQL.

## 6. Next Step

Continue the same scanner loop on additional dynamic detail routes while preserving the distinction between default frontstage language and backstage evidence. Restore local MySQL before running the full DB-backed test and e2e chain.
