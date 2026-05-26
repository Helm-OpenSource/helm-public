# Helm Operating Signal Flow Phase 3D Canary Review Packet

## Conclusion

Phase 3D ran a second read-only Operating Signal Flow runtime shadow probe after the Phase 3C action was closed. The result stayed within the approved shadow boundary: one workspace only, alias/count-only diagnostics, no boundary counter increase, no `.env` change, no production flag enablement, no `/operating` UI adoption, and no fixture banner removal.

Decision: **Go for internal readout design** and **No-Go for runtime UI adoption**.

This packet does not approve production default query adoption, API routes, schema changes, official write, auto-send, auto-approve, auto-execute, external side effects, or LLM final ranking.

## Drift Comparison

| Metric | Phase 3C first shadow | Phase 3D second shadow | Drift | Review |
| --- | ---: | ---: | ---: | --- |
| State | `shadow_ready` | `shadow_ready` | none | pass |
| Workspace count | `1` | `1` | `0` | pass |
| Action rows | `13` | `14` | `+1` | expected: Phase 3D action created |
| Approval rows | `3` | `4` | `+1` | expected: Phase 3C approval executed |
| Audit rows | `22` | `24` | `+2` | expected: Phase 3C receipt and Phase 3D action audit |
| Snapshot events | `38` | `42` | `+4` | expected from action / approval / audit delta |
| Pending review count | `1` | `1` | `0` | expected: Phase 3D remains pending |
| Boundary counter | `0` | `0` | `0` | pass |
| Trace presence count | `13` | `15` | `+2` | expected from new audited receipts |
| Evidence coverage | `74%` | `76%` | `+2pp` | pass |
| Nodes / edges | `5 / 4` | `5 / 4` | none | pass |
| Fixture banner in shadow candidate | `false` | `false` | none | shadow-only; UI remains fixture-backed |

Phase 3C digest:

```text
3ca988cec211d148717dc0594c3aadb91f513381331eeafa31132c8140a2ab77
```

Phase 3D digest:

```text
8658a7069adfc8b6b9d05256c839b427498500c8d0c4ba759dfbba49be913819
```

The digest changed because the operating loop itself added one action, one approval, and two audit receipts. The direction of drift is explainable and bounded.

## Canary Readout Design Boundary

Allowed next step:

- Add an internal, non-default canary readout design for comparing fixture posture with runtime shadow diagnostics.
- Keep the readout below the fixture boundary and label it as shadow-only.
- Show only counts, state, posture, drift, boundary counters, and reviewer decision.
- Keep raw trace IDs, audit summaries, payloads, actors, source pages, rich action content, and rich approval content out of the readout.
- Require another approval before any code wires this readout into a route or page.

Forbidden next step:

- Do not replace `/operating` fixture display.
- Do not remove or soften the fixture banner.
- Do not expose `current_window` as the default product UI posture.
- Do not add API routes or schema.
- Do not open production flags silently.
- Do not create official writes, external side effects, automatic approvals, automatic execution, automatic sends, or LLM final ranking.

## Operational Note

CLI probes that import `server-only` modules must use the React server condition:

```bash
NODE_OPTIONS='--conditions react-server'
```

Without that condition, direct CLI import intentionally fails. This is expected for Next server-only modules and is not a production runtime blocker.

## Decision Rationale

The second probe demonstrated stability across one additional operating loop mutation. The candidate remains single-workspace, deterministic, and review-first. The open issue is productization of how operators should see the shadow result without confusing it with live `/operating` adoption. That is a design/readout problem, not permission to switch runtime data into the first screen.

## Verification

Validated with:

```bash
npm run check:public-release
npm run check:boundaries
git diff --check
```

Production health probe returned `200`.

