---
status: archived
owner: helm-core
created: 2026-05-21
review_after: 2026-11-17
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-26
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Operating Signal Flow Phase 3F Internal Readout Projection Helper Report

## Conclusion

Phase 3F implements the Phase 3E internal-only readout contract as a pure TypeScript projection helper:

- Code: `lib/operating-signal-flow/internal-shadow-readout.ts`
- Tests: `lib/operating-signal-flow/internal-shadow-readout.test.ts`

Decision: **Go for internal readout helper** and **No-Go for `/operating` route/page adoption**.

This phase does not approve schema changes, API routes, production default query adoption, official writes, auto-send, auto-approve, auto-execute, fixture banner removal, external side effects, or LLM final ranking.

## What Changed

The helper turns an already-sanitized runtime shadow result into an internal founder/operator review readout. It projects only safe field families:

| Field family | Output shape |
| --- | --- |
| State | `shadow_disabled`, `shadow_not_allowed`, `shadow_ready_clean`, `shadow_ready_drift_review`, `shadow_boundary_blocked`, `shadow_degraded`, `shadow_expired` |
| Scope | single-workspace boolean, workspace count, allowlist requirement |
| Volume | action / approval / audit / event counts |
| Risk | boundary counter, pending review count, boundary posture |
| Quality | deterministic / explanation / evidence coverage percentages, trace presence count |
| Drift | counter-only deltas, explanation posture, explanation-present flag |
| Decision | bounded reviewer posture: continue / revise / stop, plus owner routing |

It deliberately does not import DB, env, `server-only`, app routes, UI modules, feature flags, Prisma, or runtime query code.

The operating signal flow boundary guard now explicitly allows only these two Phase 3F helper files in addition to the existing contract / projection / runtime-shadow files. Other files that leak `OperatingSignalFlow` types still fail `operating_signal_flow_offline_eval_boundary`.

## Boundary Routing

| Runtime shadow input | Internal readout state | Decision | Owner routing |
| --- | --- | --- | --- |
| `disabled / flag_off` | `shadow_disabled` | continue | Engineering + Founder |
| `disabled / workspace_not_in_allowlist` | `shadow_not_allowed` | stop | Engineering + Security + Founder |
| `shadow_ready`, one workspace, boundary counter `0`, no drift | `shadow_ready_clean` | continue | Product + Operations + Founder |
| `shadow_ready`, one workspace, boundary counter `0`, count drift | `shadow_ready_drift_review` | revise unless explained | Operations + Product + Founder |
| boundary counter above `0` or workspace count not `1` | `shadow_boundary_blocked` | stop | Security + Data Protection + Founder |
| safe projection missing / empty window | `shadow_degraded` | revise | Engineering + Founder |
| probe older than the accepted review window | `shadow_expired` | revise | Operations + Founder |

Any boundary counter above `0` routes to `stop`, never `continue`.

## Raw Data Controls

The helper output never echoes:

- raw trace IDs, request IDs, parent event IDs
- raw audit summaries or payloads
- actor names, emails, source pages, or object IDs
- rich action descriptions, approval content, or draft content
- writeback targets, external-send targets, or official-system payloads
- customer-facing claims that shadow data is production truth

Tests also inject extra raw-looking fields into the input and assert they do not appear in serialized readout output.

## Verification

Validated with:

```bash
npx vitest run lib/operating-signal-flow/internal-shadow-readout.test.ts lib/operating-signal-flow/runtime-shadow-adapter.test.ts
npm run typecheck
npm run lint
npm run check:public-release
npm run check:boundaries
npm run build
git diff --check
curl -fsS -o /tmp/helm-health-phase3f.txt -w '%{http_code}\n' <production-health-url>
```

Result:

- 2 test files passed
- 15 tests passed
- typecheck passed
- lint passed
- public-release guard passed
- boundary gate passed, including `operating_signal_flow_offline_eval_boundary`
- build passed
- `git diff --check` passed
- production health probe returned `200`

The targeted tests cover flag-off, allowlist miss, clean shadow, drift review, explained drift, boundary block, cross-workspace block, degraded projection, expired probe, helper purity, and raw field non-echo.

## Next Allowed Slice

Allowed Phase 3G:

- Create an internal-only readout component design packet or fixture-only component contract.
- Use the pure helper output shape only.
- Keep the component disconnected from `/operating` runtime routes until a separate canary approval exists.
- Add tests that prove the component cannot remove the fixture banner or imply production truth.

Forbidden Phase 3G:

- Do not add route/page runtime adoption, API, schema, migration, production query default, official write, auto-execute path, auto-send path, fixture banner removal, or LLM final ranking.
