---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm WeCom Read-only Ingestion Seam Plan V1

更新时间：2026-04-07
结论：Completed

## 1. 目标

PR89 只做 WeCom read-only ingestion seam：

1. 验证 WeCom `meetings / calendar / message notifications` 的 provider-side read contract
2. 设计 normalized source payload contract
3. 建立 tenant-scoped ingest path
4. 建立 `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord` 最小闭环
5. 在 settings/operator surface 展示 callback readiness、last ingest result、failure posture
6. 同步 baseline / report / README / docs / guards / tests

它不是：

- native WeCom SCIM
- WeCom send/write-back
- broader connector orchestration platform
- connector platformization
- Docker / Kubernetes / CI implementation
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_WECOM_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md`
- `HELM_WECOM_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- WeCom runtime OAuth callback foundation
- `providerType = WECOM_OAUTH` session truth
- tenant-scoped callback audit truth
- connector token persistence
- read-only target coverage truth：`meetings / calendar / message notifications`

当前本轮要补齐：

- provider-side read contract verification
- WeCom source payload contract
- tenant-scoped ingest path
- persisted payload / preview / handle truth
- settings/operator ingest readout

当前仍未成立：

- native WeCom SCIM
- `calendar` runtime ingestion，直到存在 workspace-scoped `cal_id` registry
- `message notifications` runtime ingestion
- send/write-back connector

## 3. 本轮要证明什么

1. WeCom read-only scope 不再只是 coverage truth，而是进入真实 ingest seam
2. Helm 可以把 WeCom read-only payload 挂到现有 runtime seam，而不是新造一套平台层
3. callback truth 之外，ingest result 也有 tenant-scoped readout 与 failure posture
4. current repo truth 仍然不会把 native WeCom SCIM、send/write-back、connector platformization 写成已成立

## 4. 精确闭环

`connected WeCom connector -> ingest trigger -> provider fetch -> normalized source payload contract -> RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord -> settings/operator readout -> docs/guards/tests`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- current repo truth does not claim native WeCom SCIM
- current repo truth does not claim WeCom send/write-back
- current repo truth does not claim WeCom connector platformization

## 6. 范围

- `lib/connectors/wecom.ts`
- `lib/connectors/wecom-ingestion.ts`
- `features/connectors/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- PR89 baseline / report / README / docs / guards / tests

## 7. 不做

- native WeCom SCIM claim
- calendar runtime ingestion，在没有 workspace-scoped `cal_id` registry 之前不硬做
- message notifications runtime ingestion
- send/write-back connector
- broader connector orchestration platform
- connector platformization
- automatic action execution
- Docker / Kubernetes / CI implementation

## 8. 风险

1. provider-side endpoint contract 如果没有先核实，会引入脆弱 runtime dependency
2. 如果直接复用 `ImportJob` 大路径，PR89 会被误扩成 broader connector orchestration platform
3. `calendar` 如果没有 workspace-scoped `cal_id` registry 却被写成 runtime，会造成假成立
4. `message notifications` 如果在没有 verified read-side contract 的情况下落实现，会把 provider contract 臆造进代码

## 9. 阶段计划

### Phase 0

- 复核 PR88 callback foundation 与现有 runtime/persisted payload seam
- 冻结 PR89 计划、基线和报告骨架
- 状态：Completed

### Phase 1

- provider-side read contract verification
- normalized source payload contract
- 状态：Completed

### Phase 2

- tenant-scoped ingest path
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
- settings/operator readout
- 状态：Completed

### Phase 3

- docs / guards / tests
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
- `npm run pilot:check`
