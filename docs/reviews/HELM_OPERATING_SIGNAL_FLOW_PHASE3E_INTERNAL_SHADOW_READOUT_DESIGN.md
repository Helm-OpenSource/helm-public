# Helm Operating Signal Flow Phase 3E Internal Shadow Readout Design

## Conclusion

Phase 3E defines an internal-only readout contract for Operating Signal Flow runtime shadow diagnostics. It turns the Phase 3C / 3D shadow evidence into a founder/operator review artifact without changing `/operating` runtime behavior.

Decision: **Go for a pure internal readout projection contract** and **No-Go for route/page adoption**.

This design does not approve production default query adoption, API routes, schema changes, official writes, auto-send, auto-approve, auto-execute, external side effects, fixture banner removal, or LLM final ranking.

## Evidence Input

The design is based on three process-local probes:

| Probe | Default flag state | Shadow flag state | Workspace count | Boundary counter | Event count | Review |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Phase 3C first shadow | disabled | `shadow_ready` | `1` | `0` | `38` | canary packet preparation only |
| Phase 3D second shadow | disabled | `shadow_ready` | `1` | `0` | `42` | internal readout design only |
| Phase 3E design probe | disabled | `shadow_ready` | `1` | `0` | `47` | projection contract only |

The Phase 3E probe reported:

```json
{
  "state": "shadow_ready",
  "diagnostics": {
    "actionCount": 15,
    "approvalCount": 6,
    "auditCount": 26,
    "boundaryCounter": 0,
    "pendingReviewCount": 2,
    "tracePresenceCount": 15,
    "workspaceCount": 1
  },
  "snapshot": {
    "dataPosture": "current_window",
    "eventCount": 47,
    "evidenceCoveragePercent": 72,
    "selectedPathSignalKey": null
  }
}
```

The event count moved from `42` to `47` because the operating loop executed the Phase 3D closure and created the Phase 3E review action. The drift is expected and remains bounded by single-workspace scope and boundary counter `0`.

## Readout Contract

The internal readout may show only:

| Field family | Allowed display | Reason |
| --- | --- | --- |
| State | `disabled`, `degraded`, `shadow_ready` | lets reviewers see whether the probe ran |
| Scope | workspace count, allowlist posture | verifies single-workspace boundary |
| Volume | action / approval / audit / event counts | shows flow density without raw content |
| Risk | boundary counter, pending review count | highlights blocked authority and review pressure |
| Quality | deterministic / evidence / explanation coverage percentages | shows whether data is reviewable |
| Drift | previous vs current count deltas with operator explanation | prevents normal operating-loop writes from being misread as data corruption |
| Decision | reviewer posture: continue, revise, stop | keeps founder/operator judgement explicit |

The internal readout must not show:

- raw trace IDs, request IDs, parent event IDs
- raw audit summaries or payloads
- actor names, emails, source pages, or object IDs
- rich action descriptions, rich approval content, or draft content
- cross-workspace aggregation
- writeback targets, external-send targets, or official-system payloads
- customer-facing claims that shadow data is production truth

## Review States

| State | Trigger | Owner | Required response |
| --- | --- | --- | --- |
| `shadow_disabled` | default flag-off result | Engineering | leave production unchanged |
| `shadow_not_allowed` | workspace not in allowlist | Engineering + Security | stop and fix allowlist before retry |
| `shadow_ready_clean` | one workspace, boundary counter `0`, bounded drift | Product Owner + Operations | review internal readout only |
| `shadow_ready_drift_review` | counts drift but boundary counter stays `0` | Operations | explain drift from ActionItem / ApprovalTask / AuditLog receipts |
| `shadow_boundary_blocked` | boundary counter above `0` | Security + Data Protection | stop adoption path and open boundary review |
| `shadow_degraded` | adapter error or missing safe projection | Engineering | treat as runtime readiness blocker |
| `shadow_expired` | probe older than the accepted review window | Operations | rerun process-local probe before decision |

## Responsibility Routing

| Responsibility | Owner role | Phase 3E obligation |
| --- | --- | --- |
| Adapter safety | Engineering reviewer | verify disabled-by-default flag posture and single-workspace projection |
| Readout language | Product owner | keep fixture / shadow / runtime language distinct |
| Sensitive data boundary | Security reviewer | block raw IDs, raw payloads, source pages, actors, and credential-like values |
| Operating interpretation | Operations reviewer | explain count drift and decide whether the next action is continue / revise / stop |
| Personal-data posture | Data protection reviewer | confirm alias / count-only posture before any further adoption discussion |
| Founder decision | Founder/operator | approve only the next bounded step; no silent production adoption |

## Next Allowed Slice

Allowed Phase 3F:

- Create a pure, test-backed internal readout projection helper.
- Use fixture-like inputs or already-sanitized shadow diagnostics only.
- Prove forbidden fields cannot enter the readout model.
- Add deterministic tests for `shadow_ready_clean`, `shadow_ready_drift_review`, `shadow_boundary_blocked`, and `shadow_degraded`.
- Keep `/operating` UI fixture-backed and unchanged.

Forbidden Phase 3F:

- Do not add a route, page, API, schema, migration, production query default, official write, auto-execute path, auto-send path, fixture banner removal, or LLM final ranking.

## Acceptance Criteria

- Default production posture remains flag-off and returns `disabled`.
- Process-local allowlist probe remains single-workspace.
- Boundary counter stays `0`.
- Internal readout projection exposes only allowed field families.
- Any boundary counter above `0` changes the readout posture to stop/revise, never continue.
- Reviewers can see owner routing and required response without seeing raw tenant data.
- Another founder/operator approval is required before any page or route adoption.

## Verification

Validated with:

```bash
NODE_OPTIONS='--conditions react-server' npx tsx -e '<flag-off runtime shadow probe>'
NODE_OPTIONS='--conditions react-server' OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED=true OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST=<helm-platform-workspace-id> npx tsx -e '<allowlisted runtime shadow probe>'
```

The default probe returned `disabled / flag_off`. The allowlisted process-local probe returned `shadow_ready`, `workspaceCount=1`, and `boundaryCounter=0`.
