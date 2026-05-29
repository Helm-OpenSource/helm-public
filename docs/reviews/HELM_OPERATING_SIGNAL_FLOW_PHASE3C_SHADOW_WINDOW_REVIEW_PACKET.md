---
status: active
owner: helm-core
created: 2026-05-26
review_after: 2026-08-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-29
# rationale: default — no archive/dormant signal in path
---
# Helm Operating Signal Flow Phase 3C Shadow Window Review Packet

## Conclusion

Phase 3C completed a read-only shadow window rehearsal for the Helm platform workspace alias. The adapter returned `shadow_ready` when the runtime shadow flag and allowlist were set in the process environment only. No `.env` file was modified, no production flag was enabled, no `/operating` UI wiring changed, and the fixture banner remains the default user-visible posture.

This packet approves the result as a shadow rehearsal receipt only. It does not approve runtime UI adoption, production default query adoption, API routes, schema changes, official write, auto-send, auto-approve, auto-execute, external side effects, or LLM final ranking.

## Rehearsal Evidence

| Evidence | Result |
| --- | --- |
| Default flag-off probe | `state=disabled`, `reason=flag_off` |
| Shadow rehearsal state | `shadow_ready` |
| Data posture | `current_window` |
| Window | `24h` |
| Action rows | `13` |
| Approval rows | `3` |
| Audit rows | `22` |
| Snapshot events | `38` |
| Nodes / edges | `5 / 4` |
| Workspace count | `1` |
| Pending review count | `1` |
| Boundary counter | `0` |
| Trace presence count | `13` |
| Evidence coverage | `74%` |
| Fixture banner in shadow candidate | `false` |
| `/operating` runtime UI adoption | `not changed` |
| Digest | `3ca988cec211d148717dc0594c3aadb91f513381331eeafa31132c8140a2ab77` |

## Command Shape

The rehearsal uses a process-local env override and the Next.js server condition so `server-only` modules can be imported in a CLI-style probe. The command shape is:

```bash
NODE_OPTIONS='--conditions react-server' \
OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED=true \
OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST="$HELM_PLATFORM_WORKSPACE_ID" \
npx tsx -e '<run resolveOperatingSignalFlowRuntimeShadowSnapshot for one workspace and print alias/count-only diagnostics>'
```

The command must not print raw `ActionItem.description`, `ActionItem.aiReason`, `ActionItem.draftContent`, `ActionItem.metadata`, `ActionItem.policySnapshot`, `ApprovalTask.contextSnapshot`, `ApprovalTask.reasoning`, `ApprovalTask.editableContent`, `ApprovalTask.resultPreview`, `ApprovalTask.decisionReason`, `AuditLog.summary`, `AuditLog.payload`, `AuditLog.actor`, `AuditLog.sourcePage`, or raw trace identifiers.

## Review Finding

The rehearsal exposed one operational nuance: direct `tsx` import of a module containing `import "server-only"` fails unless the `react-server` condition is supplied. This is expected for Next server-only modules, but the runbook must include the condition for CLI probes. It is not a runtime blocker for Next server execution.

The only business finding from the shadow candidate is `pendingReviewCount=1`. That should be treated as expected during the Phase 3C action itself and rechecked after this action closes. It is not a boundary violation.

## Decision

Phase 3C shadow rehearsal is **Go for canary packet preparation** and **No-Go for runtime UI adoption**.

Allowed next step:

- Prepare a separate canary review packet that compares one additional shadow window after the Phase 3C action closes.
- Keep `/operating` fixture-backed in the product UI.
- Keep `OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_*` disabled unless a deploy runbook explicitly enables it for a bounded shadow probe.

Forbidden next step:

- Do not remove the fixture banner.
- Do not make `current_window` the default `/operating` display.
- Do not add an API route or schema.
- Do not expose raw trace IDs, raw audit summaries, payloads, actors, or rich action / approval content.
- Do not treat this shadow receipt as customer-visible production adoption.

## Verification

Validated in the same change set:

```bash
npx vitest run lib/feature-flags.test.ts lib/operating-signal-flow/runtime-shadow-adapter.test.ts lib/evals/operating-signal-flow-runtime-readiness-evals.test.ts lib/evals/operating-signal-flow-runtime-readiness-intake.test.ts
npm run eval:operating-signal-flow-runtime-readiness
npm run eval:operating-signal-flow-runtime-readiness-intake -- --input evals/operating-signal-flow/runtime-readiness-bundle.sample.json
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run lint
npm run build
git diff --check
```

