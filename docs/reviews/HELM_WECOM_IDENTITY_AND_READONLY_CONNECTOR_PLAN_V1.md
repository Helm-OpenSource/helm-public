---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm WeCom Identity And Read-only Connector Plan V1

## 1. 目标

PR74 只做 WeCom identity/read-only connector foundation：

1. provider seam
2. config/env/readiness truth
3. schema enum truth
4. settings/operator readout
5. docs / guards / tests

## 2. 明确不做

- native WeCom SCIM
- WeCom OAuth login/callback runtime
- WeCom meetings / calendar / message notifications ingestion runtime
- send/write-back connector
- Docker / Kubernetes / CI implementation

## 3. 实施顺序

1. provider seam 与 connector/env helper
2. schema enum 与 migration
3. settings reserved connector readout
4. baseline / report / README / docs index / guard
5. full validation chain

## 4. 验证

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
