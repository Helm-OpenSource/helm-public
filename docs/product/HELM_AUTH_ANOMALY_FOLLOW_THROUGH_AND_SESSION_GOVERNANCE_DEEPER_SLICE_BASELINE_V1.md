---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Auth Anomaly Follow-through And Session Governance Deeper Slice Baseline V1

更新时间：2026-04-06

## 1. 已经完整成立

- shared `session-governance` truth 已成立
- scoped revoke 现在同时有 historical audit truth 和 live preview truth
- `liveRevokeScopeSummary` 已进入 org-admin governance / support-pack / settings readout
- `currentSessionReviewScopeSummary` 已进入 org-admin governance / support-pack / settings readout
- current session 命中的 anomaly scope 现在会被明确标成 `review-only`，不会被误算进可 revoke 的 live eligible count
- `AUTH_SESSION_SCOPE_REVOKED` 继续作为 scoped bulk revoke 的 historical audit truth
- auth/session governance 已明确保留 `entry-source truth` 与 `action-source truth`

## 2. 已成形但仍需下一层

- auth anomaly review 已能表达 missing source page、provider/source mismatch、workspace membership mismatch、missing workspace-switch marker、live scope preview 与 current-session review-only scope，但仍是 operator-facing review truth
- deploy baseline contract 继续定义 future enterprise identity prerequisites，但 current deploy baseline contract 仍是 docs-and-guard truth，不是 infrastructure platformization

## 3. 刻意未做

- Docker / Kubernetes / Helm chart / CI implementation remain intentionally not done
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- full enterprise IAM

## 4. 风险项

- 历史 `providerType = null` 仍会留下 legacy session 尾巴
- live revoke preview 仍主要依赖 application-layer session truth，不是 full enterprise IAM
- current session anomaly 只进入 `review-only` truth；如果 operator 后续误把这层理解成自动 revoke 建议，仍可能造成误读
- tenant isolation 仍主要依赖 application-layer `workspace` scoping

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 6. 说明

- `historical scoped revoke summary` 回答“最近 30 天实际做过什么”
- `live revoke preview` 回答“如果现在按 scope 执行 revoke，会命中什么”
- `current-session review-only scope` 回答“当前会话有哪些异常值得复核，但不会作为 bulk revoke 候选”
- `entry-source truth` 回答“当前会话来自哪个入口与 source page”
- `action-source truth` 回答“当前 anomaly review / scoped revoke 是由哪个 auth-control action 触发的”
- auth-session anomaly review is operator-facing review truth, not full enterprise IAM
