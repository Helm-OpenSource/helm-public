---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm WeCom Read-only Ingestion Seam Baseline V1

## 1. 目的

冻结 PR89 当前 truth：

1. 当前 WeCom line 已经成立什么
2. WeCom read-only ingestion seam 补到哪一层
3. 哪些 scope 已成立，哪些 scope 仍明确未成立
4. 哪些内容继续刻意未做

它不是：

- native WeCom SCIM
- WeCom send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前基线

当前 WeCom line 继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 3. 已经完整成立

### 3.1 WeCom callback foundation

当前已经成立：

- `WECOM_OAUTH` provider seam
- `/api/auth/wecom/start`
- `/api/auth/wecom/callback`
- `providerType = WECOM_OAUTH`
- tenant-scoped callback audit truth

这表示 WeCom 已经有真实可运行的 callback foundation，但 read-only ingestion runtime 仍不是 callback foundation 自动推导出的既成 truth。

### 3.2 read-only target coverage truth

当前已经成立：

- `meetings`
- `calendar`
- `message notifications`

这三类 scope 当前已经进入 WeCom connector 的 read-only target coverage truth，但 coverage truth 不等于三类 runtime 都已成立。

### 3.3 meetings runtime ingest seam

当前已经成立：

- WeCom `meetings` 的 provider-side read contract 已冻结到：
  - `get_user_meetingid`
  - `get_info`
- `meetings` 的 normalized source payload contract 已成立
- `meetings` 已接入 tenant-scoped ingest path
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord` 已形成最小 runtime seam
- settings/operator 已能展示 readiness、last ingest result、failure posture

这表示 WeCom `meetings` 已经从 target coverage truth 推进到真实可运行的 read-only ingestion seam。

### 3.4 connector metadata / ingest posture

当前已经成立：

- WeCom connector callback metadata
- connector token persistence
- `lastIngestResult`
- `WECOM_READONLY_INGEST_SUCCEEDED / PARTIAL / FAILED / UNRESOLVED`
- settings/operator callback readiness 与 ingest readout

## 4. 已成形但仍需下一层

- `calendar` 的官方合同已核实到 `get / get_by_calendar / schedule detail`，但 current repo truth 还没有 workspace-scoped `cal_id` registry，所以当前只保持 `verified-but-unbound`
- `message notifications` 还没有被 current repo truth 证实存在可用的 read-side contract
- 当前 `meetings` seam 刻意只走 verified first-window runtime，不是更宽的 connector orchestration runtime

## 5. 刻意未做

本轮继续刻意不做：

- native WeCom SCIM claim
- calendar runtime ingestion，在没有 workspace-scoped `cal_id` registry 之前不硬做
- message notifications runtime ingestion
- send/write-back connector
- broader connector orchestration platform
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation

## 6. 风险项

- 如果把 `calendar verified-but-unbound` 写成已成立 runtime，会越过当前 truth
- 如果把 `message notifications unresolved` 写成已成立 read runtime，会引入 provider contract 臆造
- 如果后续把当前 seam 扩成 `ImportJob` 或 broader connector platform，会把最小可验证 slice 误扩成平台工程

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已有 WeCom runtime OAuth callback foundation
- Helm 已有 WeCom read-only target coverage truth：`meetings / calendar / message notifications`
- Helm 已把 WeCom `meetings` 推到 tenant-scoped read-only ingestion seam
- `calendar` 继续保持 verified-but-unbound，直到存在 workspace-scoped `cal_id` registry
- `message notifications` 继续保持 unresolved

当前不能表述为：

- native WeCom SCIM 当前已成立
- WeCom `calendar` runtime 当前已成立
- WeCom `message notifications` runtime 当前已成立
- WeCom send/write-back 当前已成立
- WeCom connector platform 当前已成立
