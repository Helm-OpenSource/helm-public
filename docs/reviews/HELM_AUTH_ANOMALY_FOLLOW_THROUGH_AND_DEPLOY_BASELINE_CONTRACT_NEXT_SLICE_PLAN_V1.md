---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth Anomaly Follow-through And Deploy Baseline Contract Next Slice Plan V1

更新时间：2026-04-06
结论：Completed

## 1. 目标

PR69 继续沿 auth/session 与 deploy contract 这条线推进，但只做三件事：

1. richer auth anomaly follow-through 再收紧一层
2. broader session revoke / auth-control consistency next slice
3. deploy baseline contract 的后续实施计划冻结

它不是：

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- full enterprise IAM
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_NEXT_SLICE_BASELINE_V1.md`
- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_SESSION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

当前已经成立：

- shared `session-governance` truth
- scoped revoke historical audit truth
- live revoke scope preview truth
- current-session review-only scope truth
- workspace realignment audit truth
- deploy baseline contract docs-and-guard truth

当前本轮已补齐：

- latest anomaly marker / latest anomaly follow-through truth
- `latestAnomalyFollowThroughSummary` marker-scoped follow-through truth
- preview-vs-executed scoped revoke delta truth
- auth-control consistency overview aggregate truth
- deploy baseline contract next-slice implementation freeze

当前仍未成立：

- Docker / Kubernetes / CI implementation
- SSO / SAML / SCIM / MFA rollout

## 3. 本轮要证明什么

PR69 要证明：

1. auth/session 可以继续收紧到更细的 anomaly follow-through truth，并把 `latestAnomalyFollowThroughSummary` 与 aggregate overview 区分清楚，而不用跳去 enterprise IAM
2. scoped revoke 现在可以诚实表达“live preview / current-session protected review / last executed result”三层 truth，并继续汇总成 operator-facing consistency overview
3. deploy baseline contract 可以继续向 future enterprise identity prerequisites 收紧，但仍必须诚实保留它只是 docs-and-guard truth

## 4. 精确闭环

`shared session-governance -> latest anomaly marker / latestAnomalyFollowThroughSummary -> scoped revoke preview-vs-executed delta -> auth-control consistency overview -> org-admin/support-pack/settings readout -> deploy contract next-slice freeze`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / Docker / Kubernetes / CI platform

## 6. 范围

- `lib/auth/session.ts`
- `lib/auth/session-governance.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/session.test.ts`
- `lib/auth/org-admin-governance.test.ts`
- `lib/auth/org-admin-support-pack-route.test.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- PR69 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `PLANS.md`

## 7. 不做

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- full enterprise IAM
- infra/platform implementation
- execution-authority expansion

## 8. 风险

1. 如果把 latest anomaly marker 误写成自动 revoke 建议，会造成 operator 误读
2. 如果把 live preview、current-session review-only、historical executed summary 混在一起，会让 support-pack truth 失真
3. 如果把 deploy baseline contract next slice 写成 infra implementation，会越过当前基线

## 9. 阶段计划

### Phase 0

- 复核 PR68 当前 truth
- 冻结 PR69 计划

### Phase 1

- latest anomaly marker / follow-through truth
- scoped revoke preview-vs-executed delta truth
- org-admin / support-pack / settings readout
- targeted tests
- 状态：Completed

### Phase 2

- deploy baseline contract next-slice freeze
- baseline / report / plans / index 同步
- 状态：Completed

### Phase 3

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
