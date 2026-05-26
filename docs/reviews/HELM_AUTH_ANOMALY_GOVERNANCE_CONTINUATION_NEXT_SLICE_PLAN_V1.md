---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth Anomaly Governance Continuation Next Slice Plan V1

更新时间：2026-04-06  
状态：Completed

## 本轮目标

1. 把 auth anomaly review 从 `latestAnomalyFollowThroughSummary` 再收紧到 `latestMarkerCoverageSummary`
2. 把 scoped revoke 从 `authControlConsistencyOverview` 再收紧到 `revokeExecutionAggregateSummary`
3. 让 org-admin / settings / support-pack 同时表达 marker coverage truth 与 aggregate revoke execution truth
4. 继续冻结 deploy baseline contract，但继续明确：
   - current deploy baseline contract remains docs-and-guard truth, not infrastructure platformization
   - Docker / Kubernetes / Helm chart / CI implementation remain intentionally not done

## 范围

- `lib/auth/org-admin-governance.ts`
- `lib/auth/org-admin-governance.test.ts`
- `lib/auth/org-admin-support-pack-route.test.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- `PLANS.md`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 不做

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM
- execution authority expansion

## 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
