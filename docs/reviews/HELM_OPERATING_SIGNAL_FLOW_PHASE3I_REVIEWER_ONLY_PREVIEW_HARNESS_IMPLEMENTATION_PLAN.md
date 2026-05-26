# Helm Operating Signal Flow Phase 3I Reviewer-only Preview Harness Implementation Plan

## Conclusion

Phase 3I approves a **plan only** for the next reviewer-only preview evidence harness.

Decision:

- **Conditional-Go** for a future Phase 3J test-only DOM evidence harness.
- **No-Go** for Storybook, hidden app route, `/operating` route adoption, browser screenshot harness, runtime tenant data, schema, API, migration, production default query, official writes, auto-send, auto-approve, auto-execute, fixture banner removal, external side effects, or LLM final ranking.

The repo does not currently contain Storybook files or an established non-route browser component preview system. The only proven non-route render path for the Phase 3G component is Vitest + Testing Library in jsdom.

## Repo Truth

| Area | Current evidence | Decision |
| --- | --- | --- |
| Storybook | No `.storybook` or `*.stories.*` files found | Do not assume Storybook |
| Component DOM rendering | `features/internal-operating-workspace/operating-signal-flow-internal-readout.test.tsx` already renders the component with Testing Library | Reuse this path |
| Browser screenshot path | Existing Playwright specs operate against app routes | Do not use until a non-route browser preview mechanism is separately approved |
| `/operating` route | Existing `/operating` e2e verifies fixture map UI | Do not import the internal readout component into `/operating` |
| Production runtime | Phase 3G component is still fixture-contract and route-disconnected | Keep production truth false |

## Selected Implementation Pattern For Phase 3J

Phase 3J may implement a test-only DOM evidence harness, not a runtime preview.

Allowed shape:

| File family | Allowed work |
| --- | --- |
| `features/internal-operating-workspace/*preview*.test.tsx` | Render Chinese, English, and boundary-blocked reviewer states through Testing Library |
| Test helpers inside the same test file | Build sanitized fixture readouts only |
| Docs/review report | Record DOM evidence expectations and route-import scan result |
| Boundary guard allowlist | Only if a new preview test filename triggers the existing Operating Signal Flow boundary guard |

The harness must not create a route, page, API, CLI that reads production, Storybook config, persistent artifact writer, public screenshot artifact, or browser server.

## Required Phase 3J Checks

Phase 3J implementation must prove:

| Check | Required result |
| --- | --- |
| Route import scan | `app/` and `/operating` do not import the internal readout component or preview harness |
| Guard attributes | DOM includes `data-internal-readout-only`, `data-fixture-contract`, `data-production-truth="false"`, and `data-route-page-adoption="false"` |
| Language coverage | Chinese and English reviewer states render |
| Boundary-blocked state | Security / Data Protection / Founder routing is visible and decision remains stop |
| Interaction scan | DOM has no `a`, `button`, `form`, `input`, `textarea`, or `select` elements |
| Raw field scan | Raw trace IDs, request IDs, actor emails, source pages, and raw event IDs are not present in serialized DOM |
| Screenshot posture | Browser screenshot evidence remains Not Applicable until a non-route browser preview mechanism is separately approved |

## Implementation Steps For Phase 3J

1. Add a test-only preview evidence harness beside the Phase 3G component test.
2. Reuse existing sanitized helper inputs from `internal-shadow-readout`.
3. Add route import scan evidence in the closeout report.
4. If the boundary guard flags the new test file, add only the exact file path to the Operating Signal Flow allowlist.
5. Run targeted Vitest for the component and preview harness.
6. Run `npm run check:public-release`, `npm run check:boundaries`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and production health probe.

## Explicit No-Go

Phase 3J must not:

- implement Storybook or another new preview framework
- add an `app/` route, hidden page, debug page, or route group
- import the component into `/operating`
- read ActionItem / ApprovalTask / AuditLog at runtime
- add API, schema, migration, production query default, official write, auto-send, auto-approve, auto-execute, external side effect, fixture banner removal, or LLM final ranking
- write raw DOM payloads containing customer or actor identifiers to committed files

## Rollback Plan

Rollback for Phase 3J must be delete-only:

- remove the preview test file
- remove any exact boundary allowlist entry added for that test
- remove the Phase 3J closeout report and index lines
- keep Phase 3F helper and Phase 3G component untouched unless the new test proves a defect in them
- no `.env`, database, schema, route, or production flag rollback should be needed

## Verification

Validated for this plan:

```bash
find . -maxdepth 3 \( -name "*.stories.*" -o -name "*.story.*" -o -name ".storybook" \) -print
node -e 'const pkg=require("./package.json"); const pick=Object.fromEntries(Object.entries(pkg.scripts).filter(([k])=>/test|e2e|playwright|storybook|build|lint|typecheck|public|boundar|self/.test(k))); console.log(JSON.stringify(pick,null,2))'
git status --short --untracked-files=all
npm run self-check
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run lint
npm run build
git diff --check
curl -fsS -o /tmp/helm-health-phase3i.txt -w '%{http_code}\n' <production-health-url>
```

Result:

- no Storybook files found
- repo has Vitest, Testing Library, Playwright e2e, typecheck, lint, build, self-check, public-release, and boundary scripts
- Phase 3I starts from a clean worktree after Phase 3H commit
- self-check passed
- public-release guard passed
- boundary gate passed
- typecheck passed
- lint passed
- build passed
- `git diff --check` passed
- production health probe returned `200`

Destructive database reset, e2e, and quality-regression were intentionally not part of Phase 3I because this slice is docs-only and does not change code, routes, schema, API, runtime, or production configuration.
