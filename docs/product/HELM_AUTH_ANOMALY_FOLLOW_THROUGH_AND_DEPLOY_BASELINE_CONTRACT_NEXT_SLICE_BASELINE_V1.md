---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth Anomaly Follow-through And Deploy Baseline Contract Next Slice Baseline V1

更新时间：2026-04-06
结论：Completed

## 已经完整成立

- `latestAnomalyMarker` 已进入 auth/session truth，并在 org-admin、settings、support-pack 中可读。
- `latestAnomalyFollowThroughSummary` 已把最近一次 anomaly marker 的 review-only、bulk-revocable、drift 与 current-session-protected truth 收成 marker-scoped follow-through summary。
- `anomalyInventorySummary` 已把每类 active auth anomaly 的 management mode、revocable count、current-session protection 与 latest detected truth 收成同一条 operator-facing inventory。
- `previewVsExecutedScopeSummary` 已把 live preview、最近一次 scoped revoke 执行结果和 `currentSessionProtected` 收成同一条可审计 truth。
- `revokeConsistencySummary` 已把 preview-vs-executed delta 收敛为 `DRIFT / REVOCABLE / REVIEW_ONLY / CLEAR` 一致性 truth，并进入 org-admin、settings、support-pack。
- `authControlConsistencyOverview` 已把 anomaly inventory、scope-level revoke consistency 与 latest marker follow-through summary 收成一条 operator-facing 总览 truth。
- `latestAuthSessionAnomalyFollowThroughAudit` 已进入 governance follow-through，可用于 support-pack 与 operator readout。
- scoped revoke 仍保持 `review-first`：current session anomaly 只进入 review truth，不自动等于 revoke 建议。

## 已成形但仍需下一层

- auth anomaly review 现在是 richer operator-facing review truth，但仍不是 full enterprise IAM 或安全监控平台。
- auth-control consistency overview 现在能把 `review-only / actionable / drift / current-session protected / latest follow-through` 汇总到一层，但它仍是 aggregate summary，不替代 marker-scoped truth，也不是自动处置面。
- deploy baseline contract 已进入 next-slice freeze，并继续收紧到 future enterprise identity prerequisites，但当前 deploy baseline contract remains docs-and-guard truth, not infrastructure platformization.

## 刻意未做

- Docker / Kubernetes / Helm chart / CI implementation remain intentionally not done.
- SSO / SAML / SCIM rollout remain intentionally not done.
- MFA rollout remain intentionally not done.
- full RBAC remain intentionally not done.
- full enterprise IAM remain intentionally not done.

## 风险项

- 历史 `AuthSession.providerType = null` 仍会保留 `legacyProviderSessionCount` 迁移尾巴。
- `tenant isolation` 仍主要依赖 application-layer `workspace` scoping，而不是基础设施级隔离。
- `preview-vs-executed` truth 只表示 live eligibility 与最近一次执行结果的差异，不表示自动 revoke 意图。
- `authControlConsistencyOverview` 是 aggregate operator-facing summary，不会替代 raw anomaly / revoke evidence 或 `latestAnomalyFollowThroughSummary` 的 marker-scoped truth，也不会自动处置当前 session。

## 边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
