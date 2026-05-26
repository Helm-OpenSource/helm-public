---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm DingTalk OAuth Callback And Read-only Ingestion Plan V1

## 1. 目标

PR74 只做 DingTalk 后续执行线的计划冻结：

1. DingTalk OAuth callback foundation
2. DingTalk user info sync seam
3. DingTalk directory-sync / SCIM-compatible adapter seam
4. DingTalk read-only ingestion seam：`meetings / calendar / message notifications`

## 2. 明确不做

- native DingTalk SCIM claim
- send/write-back connector
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation
- execution-authority expansion

## 3. 实施顺序

1. OAuth callback foundation
2. user info -> identity/session mapping seam
3. directory-sync / SCIM-compatible adapter seam
4. read-only ingestion seam
5. baseline / report / guards / validation

## 4. 诚实边界

- 当前 DingTalk foundation 已成立，但 runtime 仍未成立
- 当前用户同步只能先诚实表达为 `Helm directory-sync / SCIM-compatible adapter seam`
- 在 provider-side contract 未验证前，不把 native DingTalk SCIM 写成已成立

## 5. 验证

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```
