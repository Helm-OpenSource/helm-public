---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Settings Imports Diagnostics Analytics Dashboard Language Computer Use Polish Report v1

Date: 2026-04-22
Status: Targeted non-destructive validation passed; full DB-backed test blocked by local MySQL

## Goal

Continue the Computer Use driven polish loop against real local pages, then verify with repeatable Playwright scans. This slice tightened the visible Chinese-mode language and routing labels across:

- `/dashboard`
- `/settings`
- `/diagnostics`
- `/imports/crm`
- `/imports`
- `/analytics`

The change stays presentation-only. It does not change workflow state, approval authority, import contracts, analytics event schema, first-loop state machine, recommendation/commitment boundaries, or any external send/write authority.

## What Changed

- `/dashboard` work-entry copy no longer exposes `review`, `Resume`, `feed`, `first loop`, `why`, `Detail`, `Approvals`, `Memory`, or `Top 1-3` in Chinese-mode first-screen and second-layer routing.
- Dashboard surface-routing badges and CTAs now use `详情页`, `复核与边界`, and `经营记忆`.
- `/settings` breadcrumb and pilot/settings descriptions now use workspace/operator language instead of `智能设置`, raw lifecycle/seat posture/operator path, and feature-flag phrasing.
- `/imports/crm` visible Chinese-mode copy now translates CRM import, warmup, ingress, meeting/note, read-only and today-focus wording into business-facing import language.
- `/diagnostics` feature flag labels and first-loop summary now render Chinese operating language instead of raw enum names and `first loop / live signal / setup` residue.
- `/analytics` event names and object types now render `今日重点 已生成`, `工作区`, `页面`, and `用户` instead of raw technical labels like `today_focus_generated` or `Workspace`.
- E2E expectations for dashboard routing labels were updated to match the new visible Chinese labels.

## Validation

- Computer Use: successfully read Safari at `localhost:3000/dashboard`, identified dashboard first-screen English residue, clicked browser reload after changes, and confirmed the real page now shows `先处理复核`, `继续推进只服务工作恢复，不服务信息流`, `第一条闭环进度`, and Chinese next-surface summaries.
- Playwright authenticated scan: 6 routes x 2 viewports passed with target terms 0, horizontal overflow 0, and non-HMR console errors 0.
- Targeted tests passed:
  - `features/diagnostics/display-copy.test.ts`
  - `features/analytics/display-copy.test.ts`
  - `features/dashboard/home-work-entry.test.ts`
  - `features/dashboard/home-surface-routing.test.ts`
  - `features/imports/display-copy.test.ts`
  - `lib/navigation/breadcrumb-trail.test.ts`
- `npm run typecheck` passed.
- `npm run check:boundaries` passed.
- `npm run self-check` passed, 11/11.
- `git diff --check` passed.
- `npm run lint` passed with 7 existing warnings and 0 errors.
- `npm run build` passed with the existing Turbopack NFT tracing warning.
- `npm run quality:regression` passed, 51 files / 181 tests.
- `nc -z 127.0.0.1 3306` returned exit 1, confirming local MySQL is unreachable.
- Full `npm run test` was attempted: 266 files / 1141 tests passed; 6 DB-backed Helm v2 runtime test files / 15 tests failed because Prisma could not reach `127.0.0.1:3306`.

## Remaining Risk

- Full DB-backed runtime and e2e validation still need a reachable local MySQL service.
- The underlying event names, first-loop states, and route identifiers remain technical by design; this slice only guarantees the Chinese-mode presentation layer.
- Computer Use surfaced one future UX item outside this slice: hard navigation can still land on the workspace confirmation screen before re-entering the workbench. That should be handled as a separate recovery-flow slice.

## Next Step

When MySQL is available, rerun full `npm run test`, `npm run db:reset`, and `npm run e2e`. The next polish loop should continue from real Computer Use navigation and focus on the workspace confirmation/re-entry path before widening into deeper page changes.
