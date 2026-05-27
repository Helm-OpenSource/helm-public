---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# OpenClaw 外部 Agent Intake 同步（单向拉取）

## 目标与边界

本方案用于把本地 OpenClaw 记忆按**单向导入**方式同步到 Helm 的外部证据账本。2026-05-01 起，本链路已经从“直接写 Helm active memory”降级为 `ExternalAgentArtifact / IntakeDecision` 兼容姿态：OpenClaw 输出只能作为外部证据候选或观察记录，不能直接成为公司记忆、Must Push、发送、审批、结算或 official write 事实。

当前边界：

- 只做 `OpenClaw -> Helm` 单向同步
- 默认直读 OpenClaw `memory-lancedb-pro`（LanceDB），不改 OpenClaw 存储结构
- 默认只写 `ExternalMemoryRecord` 审计账本，不再创建或更新 `MemoryEntry`
- 新导入内容不进入默认 active memory 视图，不影响 Must Push final ranking
- 已存在的 legacy OpenClaw-linked `MemoryEntry` 在下一次匹配同步时会被软删除并解绑，保留可恢复性
- recommendation 与 commitment 边界不变：OpenClaw 输出是待复核证据候选，不是自动承诺

## 数据源与映射

默认数据源：OpenClaw `memory-lancedb-pro`（底层 LanceDB）

默认路径：`${OPENCLAW_HOME:-$HOME/.openclaw}/memory/lancedb-pro`

兼容回退模式：`backup_jsonl`（读取 `${OPENCLAW_HOME:-$HOME/.openclaw}/memory/backups/*.jsonl`）

每条记录读取字段后会先收成保守 intake readout：

- `id` -> `ExternalMemoryRecord.externalId`
- `text` -> 只生成 `rawOutputHash` 与 review summary；原文不写入 active memory
- `category` -> `ExternalMemoryRecord.category=intakeDisposition`
- `scope` -> `ExternalMemoryRecord.scope=external_agent:openclaw_local`
- `importance` -> `0-100` 整数
- `timestamp` -> `occurredAt`
- `metadata` -> 只保留 hash / disposition / reasonCodes / boundaryNote 等脱敏审计字段

同步时只写入一层：

1. `ExternalMemoryRecord`（外部 Agent 候选证据账本，保证可追溯）

明确不写：

- `MemoryEntry`
- `MemoryCandidate`
- `MustPushItem`
- customer-facing send / approval / settlement / official write

## 同步流程

- 入口服务：`syncOpenClawMemory(workspaceId, options)`
- 去重策略：`(workspaceId, provider, externalId)` 唯一
- 增量游标：`lastCursor={file,line,timestampMs}`
- 数据源模式：`sourceMode=lancedb`（默认）或 `sourceMode=backup_jsonl`
- 并发控制：`ExternalMemorySyncState.isRunning` 锁定，防止重入
- Intake containment：`review_required` / `watch_only` / `quarantine`
- 容错：单条失败不阻断整批，失败计数与错误会记录在状态与审计中

## API

- `POST /api/memory/openclaw/sync`
  - 触发一次手动同步
  - 可选参数：`sourceMode`, `maxItems`
  - 不接受 caller-controlled `openclawBin`, `lanceDbPath`, `backupDir` 覆盖，避免 host-local 路径注入
- `GET /api/memory/openclaw/status`
  - 返回最近同步状态、游标、记录总数与最近一条记录信息

## 页面分类筛选

`/memory` 支持：

- `source=ALL|HELM|OPENCLAW`
- `objectLevel=ALL|WORKSPACE|CONTACT|COMPANY|OPPORTUNITY|MEETING`

约定：

- `ALL` / `HELM` 默认不混入 `OPENCLAW:` legacy active memory，避免外部记忆污染公司记忆判断
- `OPENCLAW` 仍可用于 legacy 排查和来源过滤，但新同步不会再创建页面直接可见的 `MemoryEntry`
- Helm 结构化记忆链路（facts/commitments/blockers/corrections）仍只承接 Helm 内部受控来源

## 定时运行

脚本入口：

```bash
npm run sync:openclaw-memory
```

可选参数：

```bash
npm run sync:openclaw-memory -- --workspace-id=<workspaceId> --max-items=2000
OPENCLAW_HOME="$HOME/.openclaw" npm run sync:openclaw-memory -- --source-mode=backup_jsonl
```

`cron` 示例（每 15 分钟）：

```cron
*/15 * * * * cd <helm-repo-root> && OPENCLAW_HOME="$HOME/.openclaw" npm run sync:openclaw-memory >> /tmp/helm-openclaw-sync.log 2>&1
```

## 审计与事件

同步会写入：

- EventLog：
  - `openclaw_memory_sync_started`
  - `openclaw_memory_sync_completed`
  - `openclaw_memory_sync_failed`
- AuditLog：
  - `OPENCLAW_MEMORY_SYNC_STARTED`
  - `OPENCLAW_MEMORY_SYNC_COMPLETED`
  - `OPENCLAW_MEMORY_SYNC_FAILED`

## 故障恢复

- 若同步异常，先调用 `GET /api/memory/openclaw/status` 查看 `lastError`
- 排查数据源模式、LanceDB/备份目录路径与权限
- 修复后重新触发 `POST /api/memory/openclaw/sync`
- 幂等 upsert 保证重复执行不会产生重复记录

## Non-commitment Note

本能力是“外部 Agent 证据候选 intake”，不是 active memory 写入能力，不是 Must Push 创建能力，不是对外自动承诺能力，也不改变 Helm 原有审批与风险边界。
