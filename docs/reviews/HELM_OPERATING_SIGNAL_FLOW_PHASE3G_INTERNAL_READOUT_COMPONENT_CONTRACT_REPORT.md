# Helm Operating Signal Flow Phase 3G Internal Readout Component Contract Report

## Conclusion

Phase 3G implements an internal-only, fixture-contract component for the Phase 3F readout helper:

- Component: `features/internal-operating-workspace/operating-signal-flow-internal-readout.tsx`
- Tests: `features/internal-operating-workspace/operating-signal-flow-internal-readout.test.tsx`

Decision: **Go for fixture-only internal readout component contract** and **No-Go for `/operating` route/page adoption**.

This phase does not approve schema changes, API routes, runtime UI adoption, production default query adoption, official writes, auto-send, auto-approve, auto-execute, fixture banner removal, external side effects, or LLM final ranking.

## What Changed

The component renders only the sanitized `OperatingSignalFlowInternalShadowReadout` output produced by Phase 3F. It is not imported by any route or page.

It displays:

| Surface | Contract |
| --- | --- |
| State | internal review state label and explanation |
| Decision | continue / revise / stop badge |
| Owner routing | reviewer roles from the readout contract |
| Metrics | workspace count, event count, boundary counter, pending review count |
| Safe fields | allowed field family names only |
| Forbidden fields | field family names only, not values |
| Adoption guards | all route/page/API/schema/write/send/execute/default-query paths remain blocked |

The component deliberately has no action buttons and no links. It cannot trigger review, send, approval, execution, writeback, or route adoption.

## Boundary Controls

The component includes static data attributes for tests and future reviewers:

- `data-internal-readout-only="true"`
- `data-fixture-contract="internal-shadow-readout"`
- `data-production-truth="false"`
- `data-route-page-adoption="false"`

Tests assert the component:

- renders the internal-only posture in Chinese and English
- shows `stop` routing for boundary-blocked shadow readouts
- keeps Security / Data Protection / Founder routing visible for boundary blocks
- does not echo raw trace IDs, request IDs, actor emails, source pages, or raw event IDs
- renders no links and no buttons
- keeps adoption guards visible as blocked paths

## Guardrail Update

`operating_signal_flow_offline_eval_boundary` now explicitly allowlists only the Phase 3G component and test in addition to the prior Phase 3F helper files. This keeps Operating Signal Flow type expansion reviewable and fail-closed.

## Verification

Validated with:

```bash
npx vitest run features/internal-operating-workspace/operating-signal-flow-internal-readout.test.tsx lib/operating-signal-flow/internal-shadow-readout.test.ts
npm run typecheck
npm run lint
npm run check:public-release
npm run check:boundaries
npm run build
git diff --check
curl -fsS -o /tmp/helm-health-phase3g.txt -w '%{http_code}\n' <production-health-url>
```

Result:

- 2 targeted test files passed
- 14 targeted tests passed
- typecheck passed
- lint passed
- public-release guard passed
- boundary gate passed, including `operating_signal_flow_offline_eval_boundary`
- build passed
- `git diff --check` passed
- production health probe returned `200`

## Next Allowed Slice

Allowed Phase 3H:

- Create an internal canary review packet for whether this component can be shown in a non-route, reviewer-only preview harness.
- Define explicit reviewer questions, screenshot/DOM evidence requirements, and rollback criteria.
- Keep runtime data and `/operating` route/page adoption out of scope.

Forbidden Phase 3H:

- Do not add route/page runtime adoption, API, schema, migration, production query default, official write, auto-execute path, auto-send path, fixture banner removal, or LLM final ranking.
