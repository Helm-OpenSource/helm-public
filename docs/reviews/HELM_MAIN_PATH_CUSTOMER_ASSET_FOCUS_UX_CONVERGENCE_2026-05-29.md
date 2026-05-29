---
status: active
owner: Product / Design / Engineering
created: 2026-05-29
review_after: 2026-08-27
---
# Helm Main Path Customer Asset Focus UX Convergence

## Conclusion

This slice moves the highest-scatter main paths closer to a customer-asset-first operating console.

The default visible layer now answers three questions before showing product mechanics:

1. Which customer asset matters right now?
2. What pressure or blocker is active?
3. What should the human decide or open next?

Classification: **已成形但仍需下一层**.

The pattern is now implemented on `/opportunities`, `/approvals`, and `/inbox`, and `/dashboard` plus `/operating` were reviewed as current baselines. This is not a whole-site completion claim; lower-frequency surfaces still need the same pass.

## Scope

Changed:

- `components/shared/customer-asset-focus-strip.tsx`
- `features/opportunities/opportunities-client.tsx`
- `features/approvals/approvals-client.tsx`
- `features/inbox/inbox-client.tsx`
- `tests/e2e/demo-flows.spec.ts`
- `tests/e2e/visual-audit.spec.ts`

Reviewed without code change in this slice:

- `/dashboard`
- `/operating`

## Design Rule Applied

Default surface:

- customer / opportunity / contact / thread / draft name
- current status
- current pressure
- next judgement or next safe page
- one primary action and one secondary action at most

Disclosure layer:

- page rules
- review load
- meeting-derived draft queue
- connector/source explanation
- product mechanics
- boundary history
- implementation names

The practical test is simple: if a user cannot identify the business object, pressure, and next action in the first visible region, the page is not ready.

## Page-Level Changes

### `/opportunities`

- Added a customer asset focus strip directly after the page header.
- First visible object now names the opportunity, company, stage, risk, current pressure, and next judgement.
- Primary action opens the opportunity; secondary action narrows to high-risk opportunities.
- The board keeps deeper filters, collaboration readouts, and evidence drawers below the asset-first layer.

### `/approvals`

- Added a customer-visible draft focus strip directly after the page header.
- The first visible decision now names the draft, object, review pressure, and allowed human choices.
- Renamed the general rules disclosure to "引用规则".
- Collapsed meeting-derived drafts into "其他会议草稿" so the primary review decision is no longer buried by a second queue.

### `/inbox`

- Added a customer thread focus strip directly after the page header.
- The first visible thread now names the conversation, object binding posture, current pressure, and next judgement.
- Compressed connector/source status into a smaller "来源状态" readout so it stops competing with the actual customer thread.

## Computer Use Path

Computer Use was recovered for this slice enough to perform a real desktop browser path in Chrome:

1. Started the current branch locally at `http://127.0.0.1:3120`.
2. Used Computer Use `list_apps` to verify Chrome was available.
3. Used Chrome to open `/demo`.
4. Clicked the enterprise software sales demo entry.
5. Verified the authenticated demo workspace landed on `/dashboard`.
6. Opened `/opportunities` and confirmed the first visible region starts with "客户资产" and the concrete NorthBridge opportunity.
7. Opened `/approvals` and confirmed the first visible region starts with "客户可见草稿", while review load and other meeting drafts are collapsed.

This is real UI-path evidence for the changed frontstage, but repeatable CI evidence remains Playwright.

## Boundaries

This slice does not authorize:

- schema, migration, API, or query contract changes
- production runtime adoption
- official write
- external send
- automatic approval
- automatic execution
- LLM final ranking
- new workflow/orchestration platform behavior

All changed actions continue to route to existing read/review surfaces.

## Validation

Validation executed during the slice:

```bash
npx eslint components/shared/customer-asset-focus-strip.tsx features/opportunities/opportunities-client.tsx features/inbox/inbox-client.tsx features/approvals/approvals-client.tsx
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
npx playwright test tests/e2e/demo-flows.spec.ts -g '主路径首屏先给客户资产焦点'
npx playwright test tests/e2e/visual-audit.spec.ts -g 'opportunities page|approvals|inbox page'
npx playwright test tests/e2e/visual-audit.spec.ts -g 'approvals'
```

Results:

- Targeted ESLint: passed
- `git diff --check`: passed
- `npm run typecheck`: passed
- `npm run self-check`: passed, 59 checks passed
- `npm run check:boundaries`: passed; existing spawn-env warn-mode inventory remained warn-only
- `npm run lint`: passed; existing Babel deoptimization notes remained non-failing
- `npm run build`: passed
- `npm run quality:regression`: passed, 32 files / 127 tests
- Main-path customer asset focus e2e: passed after loading `/Users/qianzhilong/Documents/helm/.env` and `.env.local`
- Opportunities / approvals / inbox visual audit: passed, 4 tests
- Computer Use Chrome path: passed for `/demo -> /dashboard -> /opportunities -> /approvals`

Not run:

- `npm run db:reset`: not run because it is a destructive local database reset and this UX slice did not require schema/data reset.
- Full `npm run test` and full `npm run e2e`: not run because this slice already ran targeted page e2e plus `quality:regression`; broader DB-backed suites should be run when preparing the PR merge gate with an explicitly isolated test database.

## Remaining Risk

1. The shared focus strip now establishes the pattern, but `/reports`, `/imports`, `/settings`, `/diagnostics`, `/analytics`, and deeper detail pages still need the same customer-asset-first pass.
2. `/dashboard` and `/operating` were reviewed as acceptable baselines in this slice, but they should be rechecked once the remaining pages are tightened, because navigation pressure may shift.
3. Computer Use is usable in this run, but Playwright remains the deterministic evidence path for CI.

## Next Pass

1. Apply the same first-visible-region rule to `/reports`, `/imports`, `/settings`, `/diagnostics`, and `/analytics`.
2. Turn repeated explanation blocks into compact disclosures or reference quotes.
3. Keep one primary action per first screen.
4. Add route-level regression assertions where a page has an explicit customer asset focus region.
