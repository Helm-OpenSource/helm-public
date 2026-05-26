---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth Anomaly Follow-through And Deploy Baseline Contract Deeper Slice Baseline V1

更新时间：2026-04-06  
状态：Frozen

## 已经完整成立

- `latestAnomalyFollowThroughSummary` 已经进入 org-admin / settings / support-pack readout。
- `authControlConsistencyOverview` 已经把 review-only、bulk-revocable、drift、current-session-protected 收成 aggregate operator-facing truth。
- current deploy baseline contract remains docs-and-guard truth, not infrastructure platformization。

## 已成形但仍需下一层

- richer auth anomaly follow-through 仍主要是 operator-facing review truth，不是自动处置平面。
- broader session revoke / auth-control consistency 仍是 application-layer governance，不是 full enterprise IAM。
- deploy baseline contract 已继续冻结到 deeper slice，但仍没有 Docker / Kubernetes / Helm chart / CI implementation。

## 刻意未做

- Docker / Kubernetes / Helm chart / CI implementation remain intentionally not done。
- SSO / SAML / SCIM rollout remain intentionally not done。
- MFA rollout remain intentionally not done。
- full enterprise IAM remain intentionally not done。

## 风险项

- 历史 `providerType = null` 仍会保留 legacy provider 尾巴。
- tenant isolation 仍主要依赖 application-layer `workspace` scoping。
- current-session protected truth 只能做 review-only，不应被误读成自动 revoke。

## 当前冻结 truth

- `latestAnomalyFollowThroughSummary`
- `authControlConsistencyOverview`
- `reviewOnlyScopeCount`
- `bulkRevocableScopeCount`
- current deploy baseline contract remains docs-and-guard truth, not infrastructure platformization

