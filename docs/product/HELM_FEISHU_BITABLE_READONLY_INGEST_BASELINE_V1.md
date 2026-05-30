---
status: active
owner: helm-core
created: 2026-05-21
review_after: 2026-08-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-26
# rationale: default — no archive/dormant signal in path
---
# Helm Feishu Bitable Read-only Ingest Baseline

更新日期：2026-05-21

## 当前状态

Helm 当前已经把飞书从单纯的 workspace-scoped OAuth callback foundation，推进到：

- workspace-scoped
- membership-backed
- controlled-trial
- judgement-first
- review-first

的 `Bitable read-only ingest` 最小接缝。

当前成立的是：

- `Feishu OAuth callback -> workspace-scoped connector`
- `tenant_access_token -> Bitable list-records contract`
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
- settings readout / sync action / audit trail

## 本轮明确成立

- 飞书多维表格只读采集现在可以通过 `syncFeishuReadonlyConnector()` 进入运行时闭环。
- 当前读取合同收敛为单一 verified scope：`BITABLE`。
- 当前绑定模式是 `env-backed`：
  - `FEISHU_BITABLE_APP_TOKEN`
  - `FEISHU_BITABLE_TABLE_ID`
  - `FEISHU_BITABLE_VIEW_ID`（可选）
- 当前仍然保持 review-first：读到的记录只进入 persisted payload / ingestion record，不直接 promotion 为 canonical fact，也不自动触发对外动作。

## 边界

- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- 当前不是 workspace-managed Bitable registry/control plane
- 当前不是 message send / message draft(review-first) runtime
- 当前不是 directory platformization
- 当前不是完整 Feishu connector platform

## 四类短表

### 已经完整成立

- 飞书 OAuth callback foundation
- 飞书 public auth
- 飞书 env-backed Bitable read-only ingest 最小 runtime seam

### 已成形但仍需下一层

- workspace-managed Bitable binding UI / registry
- message draft(review-first)
- 更细粒度 object linking / promotion policy

### 刻意未做

- send / write-back
- auto-send
- auto-commitment
- 多 scope connector platformization

### 风险项

- 当前 Bitable 绑定仍依赖环境变量，不是每个 workspace 自助维护
- 飞书 tenant token、Bitable 权限与数据权限仍可能在真实租户下造成 partial / failed posture
- 当前 records 只进入 review-first runtime artifacts，不代表业务对象映射已经完整成立
