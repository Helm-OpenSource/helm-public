---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm DingTalk Meetings Runtime Ingestion Plan V1

更新时间：2026-04-07
结论：Implementation Completed

## 1. 目标

PR87 只做四件事：

1. 冻结 DingTalk `meetings` official provider contract
2. 建立 normalized meeting source payload contract
3. 把 `meetings` 接入现有 tenant-scoped runtime ingest seam
4. 补齐 settings/operator readout、文档、守卫、测试和完整验证链

它不是：

- native DingTalk SCIM
- DingTalk send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DINGTALK_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_DINGTALK_READONLY_INGESTION_SEAM_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- DingTalk runtime OAuth callback foundation
- `providerType = DINGTALK_OAUTH` session truth
- DingTalk `calendar` runtime ingest seam
- read-only target coverage truth：`meetings / calendar / message notifications`

当前本轮要补齐：

- `meetings` official method/path freeze
- normalized meeting source payload contract
- tenant-scoped `meetings` ingest path
- persisted payload / preview / handle truth for meetings
- settings/operator readout for established meetings runtime

当前仍未成立：

- native DingTalk SCIM
- DingTalk message-notification ingestion runtime
- DingTalk send/write-back
- broader connector orchestration platform
- connector platformization

## 3. 本轮要证明什么

1. `meetings` 不再停留在 target coverage truth，而是进入真实 runtime ingest seam
2. `meetings` 继续复用现有 `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
3. `calendar established / meetings established / message unresolved` 会在 settings/operator surface 中一致表达
4. 当前 repo truth 仍不会把 native DingTalk SCIM、send/write-back、connector platformization 写成已成立

## 4. 精确闭环

`connected DingTalk connector -> QueryOrgConferenceList -> QueryConferenceInfoByRoomCode -> normalized source payload contract -> RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord -> settings/operator readout -> baseline/report/guards/tests`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 6. 风险

1. provider contract 如果未核实清楚，会把未验证 endpoint 臆造进代码
2. 如果把 `roomCode` detail enrichment 扩成 broader retry/orchestration，PR87 会被误扩成 connector platform
3. 如果把 `message notifications` 顺手写成已成立，会造成明确 overclaim

## 7. 阶段计划

### Phase 0

- 复核 PR84 / PR85 基线
- 冻结 PR87 plan / baseline / report
- 状态：Completed

### Phase 1

- 核实 `QueryOrgConferenceList`
- 核实 `QueryConferenceInfoByRoomCode`
- 落 normalized meeting payload contract
- 状态：Completed

### Phase 2

- 接入 tenant-scoped ingest path
- 接入 `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
- 状态：Completed

### Phase 3

- settings/operator readout
- docs / guards / tests
- 完整验证链
- 状态：Completed

## 8. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
