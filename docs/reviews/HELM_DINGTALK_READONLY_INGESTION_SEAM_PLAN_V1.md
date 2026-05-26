---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm DingTalk Read-only Ingestion Seam Plan V1

更新时间：2026-04-07
结论：Planned

## 1. 目标

本轮把 DingTalk read-only ingestion seam 升级为 MCP gateway full-scope 版本：

1. 引入 MCP client + tool discovery
2. 覆盖 `meetings / calendar / todo / projects / management / work / message notifications`
3. 统一落到 runtime seam：`RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
4. 保留 settings 手动触发，并新增每小时 cron 触发
5. 保持 `read-only + manual write-back reserved` 边界
6. 同步 README / docs / guards / tests

它不是：

- native DingTalk SCIM
- DingTalk send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

继承基线：

- `HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md`
- `HELM_DINGTALK_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

本轮补齐：

- MCP gateway ingestion contract
- full-scope read-only payload normalization
- cron sync entry + tenant-scoped audit/readout

## 3. 精确闭环

`connected DingTalk connector -> MCP tool discovery -> scope fetch/derive -> normalized source payload -> RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord -> settings/operator readout + hourly cron`

## 4. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- current repo truth still does not claim native DingTalk SCIM
- current repo truth still does not claim DingTalk send/write-back
- current repo truth still does not claim DingTalk connector platformization

## 5. 范围

- `lib/connectors/dingtalk-mcp-client.ts`
- `lib/connectors/dingtalk-ingestion.ts`
- `app/api/runtime/dingtalk/hourly-sync/route.ts`
- `features/settings/settings-client.tsx`
- `README.md` / `docs/README.md` / DingTalk baseline-plan-report docs
- `scripts/helm-self-check.ts` / `scripts/decision-first-boundary-check.ts` / `scripts/pilot-readiness-check.ts`

## 6. 风险

1. MCP tool schema 变更会带来 scope-level partial/failure
2. cron 与手动触发并行时需要保持幂等和审计可追踪
3. 若边界文案缺失，容易被误读为 write-back commitment

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
