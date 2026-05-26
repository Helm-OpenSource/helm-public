---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm DingTalk Read-only Ingestion Seam Baseline V1

## 1. 目的

冻结 DingTalk read-only ingestion seam 当前 truth：

1. 当前 DingTalk 线已经成立什么
2. MCP 网关接入后哪些 runtime/persistence truth 已进入主链
3. 哪些边界继续保留，不外推成 commitment

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

### 3.2 MCP-backed read-only ingestion runtime

当前已经成立：

- DingTalk MCP gateway read path（`npx -y dingtalk-mcp@latest`）
- read-only target coverage truth：`meetings / calendar / todo / projects / management / work / message notifications`
- 统一 normalized source payload contract
- tenant-scoped ingest path
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord` 最小闭环
- settings/operator readout：callback readiness、last ingest result、failure posture、scope 级状态
- 每小时 cron 入口：`/api/runtime/dingtalk/hourly-sync`

### 3.3 scope mapping truth

当前 scope truth：

- `calendar`：MCP `dingtalk-calendar`
- `meetings`：从 calendar 事件中按受控规则派生
- `todo`：MCP `dingtalk-tasks`
- `projects`：MCP `dingtalk-teambition`
- `work`：MCP `dingtalk-report`（`getReportList`）
- `message notifications`：MCP `dingtalk-notice`（仅 task_id readback，不提供按时间列表拉取）
- `management`：按 todo + work 映射派生

## 4. 已成形但仍需下一层

- MCP tool 参数和字段仍是 provider-evolving contract，后续需持续稳定化
- cron 调度目前提供受控入口，不包含完整任务编排平台语义
- manual write-back 仅预留 posture，不开启自动写回

## 5. 刻意未做

- native DingTalk SCIM claim
- send/write-back connector
- broader connector orchestration platform
- connector marketplace / platformization
- Docker / Kubernetes / Helm chart / CI implementation

## 6. 风险项

- provider tool schema 演进可能导致部分 scope 进入 partial/failed posture
- 如果把 read-only ingestion 表述成 external commitment，会产生过度承诺风险
- 若将当前 seam 误扩为全功能 orchestration，会偏离最小可验证 slice

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已有 DingTalk runtime OAuth callback foundation
- Helm 已有 DingTalk MCP-backed read-only ingestion runtime：`meetings / calendar / todo / projects / management / work / message notifications`
- 当前仍保持 read-only / review-first，不做 auto-send / auto-write

当前不能表述为：

- native DingTalk SCIM 当前已成立
- DingTalk send/write-back 当前已成立
- DingTalk connector platform 当前已成立
- execution authority 已扩张
