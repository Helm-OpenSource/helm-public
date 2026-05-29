---
status: active
owner: helm-core
created: 2026-05-26
review_after: 2026-08-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-29
# rationale: default — no archive/dormant signal in path
---
# Helm Operating Signal Flow Phase 3A Shadow Adapter Implementation Plan

## 结论

`/operating` 的 Phase 2.3 review bundle 已达到 `readinessDecision=go`，但这只允许进入 Phase 3A 实现计划。当前仍不批准 production query adoption、runtime UI adoption、schema/API 变更、official write、自动发送、自动审批、自动执行或 LLM final ranking。

Phase 3A 的目标是实现一个 disabled-by-default 的只读 shadow adapter，让 Helm 平台租户可以在后台生成 `OperatingSignalFlowSnapshot` 候选快照，并与 fixture prototype 对照。该快照在 shadow 阶段不得替换 `/operating` 第一屏，也不得移除 fixture banner。

## Review Evidence

| Evidence | Value |
| --- | --- |
| Workspace scope | `Helm平台` single workspace only |
| Phase 2.3 intake case | `OSF-RRG-HELM-PLATFORM-GO-20260521` |
| Phase 2.3 digest | `3745e2c2eba83745391f48374dfe19290916a6d3c2ff6c7bf861ac107a59aa6c` |
| Preflight | `pass` |
| Readiness decision | `go` |
| Raw payload echo | `0` |
| Authority leak | `0` |
| Cross-workspace projection | `0` |
| Runtime implementation bypass | `0` |
| LLM final ranking | `0` |

## Allowed Implementation

1. Add a disabled-by-default runtime flag for Operating Signal Flow shadow projection.
2. Add a narrow server-only adapter file dedicated to `/operating` shadow projection.
3. Read only existing `ActionItem`, `ApprovalTask`, and `AuditLog` rows for a single `workspaceId`.
4. Select only fields needed for counts, statuses, risk mix, age buckets, and trace presence.
5. Map rows into the existing `OperatingSignalFlowSnapshot` contract with `dataPosture = "current_window"` only inside the shadow result.
6. Return a fallback state when the flag is off, workspace is not allowlisted, or the adapter cannot produce a valid single-workspace snapshot.
7. Add unit tests for flag-off fallback, allowlist gating, single-workspace scope, forbidden field exclusion, deterministic projection, and boundary counters.
8. Update boundary guard allowlists only for the approved adapter path and tests.

## Forbidden Fields

The adapter must not read or project:

| Model | Forbidden fields |
| --- | --- |
| `ActionItem` | `description`, `aiReason`, `draftContent`, `metadata`, `policySnapshot` |
| `ApprovalTask` | `contextSnapshot`, `reasoning`, `editableContent`, `resultPreview`, `decisionReason` |
| `AuditLog` | `summary`, `payload`, `actor`, `sourcePage` |

`AuditLog.traceId` may only be used as presence/count information. The adapter must not expose raw trace IDs in UI-facing display fields.

## Rollout Plan

| Stage | Condition | User-visible effect |
| --- | --- | --- |
| `shadow` | Flag on for `Helm平台` allowlist; adapter produces valid snapshot | None. `/operating` still shows fixture banner and fixture map |
| `canary` | Shadow runs stable for at least one operating window with no boundary findings | Add internal readout showing live-read-only candidate posture, still below fixture boundary |
| `general_review` | Required Reviewer confirms no privacy, scope, performance, or authority issue | Prepare a separate banner transition proposal |

## Verification

Required before implementation can be treated as complete:

```bash
npx vitest run lib/operating-signal-flow/*runtime*.test.ts
npm run eval:operating-signal-flow-runtime-readiness
npm run eval:operating-signal-flow-runtime-readiness-intake -- --input evals/operating-signal-flow/runtime-readiness-bundle.sample.json
npm run check:boundaries
npm run check:public-release
npm run typecheck
npm run lint
```

Production verification remains required after deployment, but it must use the approved deployment runbook probe instead of a hard-coded tenant or private production hostname in this public-release-tracked document.

## Rollback

Rollback is flag-off first. If any shadow adapter validation fails, keep `/operating` on fixture-backed display, disable the Operating Signal Flow runtime flag, and leave the Phase 2 fixture banner visible. No database migration or production data mutation is introduced in Phase 3A, so rollback must not require schema restore.

## Implementation Receipt

Phase 3A scaffold is implemented in `lib/operating-signal-flow/runtime-shadow-adapter.ts` with tests in `lib/operating-signal-flow/runtime-shadow-adapter.test.ts`.

- Default state remains disabled through `OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED=false` or an empty / non-matching `OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST`.
- The adapter reads only narrow `ActionItem`, `ApprovalTask`, and `AuditLog` selectors for a single workspace and degrades on cross-workspace input.
- Trace fields are converted to presence counts only; raw trace identifiers are not projected into the snapshot.
- The produced `current_window` snapshot is a background shadow candidate only. `/operating` still uses the fixture-backed display and keeps the fixture banner until a separate canary review approves a transition.
- `scripts/decision-first-boundary-check.ts` now allowlists only this adapter path and test while preserving no schema, no API, no LLM call, no official write, and no runtime UI adoption.

## Next Action

Run one shadow window for the Helm platform workspace after deployment configuration explicitly enables the flag and allowlist. Do not wire the adapter into `/operating` as the default display until a later canary review approves the banner transition.
