---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm DingTalk Meetings Runtime Ingestion Baseline V1

## 1. 目的

冻结 PR87 当前 truth：

1. DingTalk `meetings` 如何从 target coverage truth 推进到真实 runtime ingest seam
2. 当前已经成立什么、未成立什么
3. 哪些边界继续刻意保留
4. 哪些风险仍需继续诚实表达

当前 PR87 的准确定义是：`DingTalk meetings runtime ingest seam`。

它不是：

- native DingTalk SCIM
- DingTalk send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前基线

当前 DingTalk line 继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 3. 已经完整成立

### 3.1 DingTalk callback foundation

当前已经成立：

- `DINGTALK_OAUTH` provider seam
- `/api/auth/dingtalk/start`
- `/api/auth/dingtalk/callback`
- `providerType = DINGTALK_OAUTH`
- tenant-scoped callback audit truth

### 3.2 Calendar runtime ingest seam

当前已经成立：

- DingTalk `calendar` official `ListEvents` read contract
- normalized calendar source payload contract
- tenant-scoped ingest path
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
- settings/operator ingest readout

### 3.3 Meetings runtime ingest seam

当前已经成立：

- DingTalk `meetings` official read contract 已冻结到：
  - `GET /v1.0/conference/orgConferences`
  - `GET /v1.0/conference/roomCodes/{roomCode}/infos`
- official contract names 已冻结到：
  - `QueryOrgConferenceList`
  - `QueryConferenceInfoByRoomCode`
- normalized meeting source payload contract 已成立
- `meetings` 已接入 tenant-scoped ingest path
- `meetings` 已写入：
  - `RuntimeEvent`
  - `RuntimeSession`
  - `SessionNotebook`
  - `PersistedPayload`
  - `ConnectorIngestionRecord`
- settings/operator 已能展示 `meetings` established posture、last ingest result 和 failure posture

### 3.4 当前成立 truth 的准确表达

当前可以诚实表述为：

- Helm 已有 DingTalk runtime OAuth callback foundation
- Helm 已有 DingTalk `calendar` runtime ingest seam
- Helm 已有 DingTalk `meetings` runtime ingest seam
- Helm 仍只把 `message notifications` 保留为 unresolved read-only target

## 4. 已成形但仍需下一层

- `message notifications` 仍未被当前 repo truth 证实存在可用的 read-side contract
- `meetings` 与 `calendar` 当前都只持久化 verified first-page runtime 结果，不是完整 connector orchestration runtime
- `roomCode` detail 当前是 verified enrichment seam；当 detail 失败时会回退到 verified org meeting list payload，不是 broader retry/orchestration platform

## 5. 刻意未做

本轮继续刻意不做：

- native DingTalk SCIM claim
- send/write-back connector
- broader connector orchestration platform
- connector platformization
- automatic action execution
- Docker / Kubernetes / CI implementation

## 6. 风险项

- DingTalk provider-side contract 如果后续调整字段或 token scope，`meetings` runtime 仍需再 harden 一层
- 当前 `meetings` seam 依赖 org list + roomCode detail 的组合；不是完整历史会议回溯平台
- 如果把当前 truth 扩写成“DingTalk 全部 read-only scope 已成立”，会对 `message notifications` 造成过度承诺

## 7. 对外诚实口径

当前不能表述为：

- native DingTalk SCIM 已成立
- DingTalk send/write-back 已成立
- DingTalk connector platform 已成立
- DingTalk `message notifications` runtime 已成立
