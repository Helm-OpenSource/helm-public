---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm WeCom Calendar Registry Seam Baseline V1

## 1. 目的

冻结 PR90 当前 truth：

1. WeCom calendar registry seam 当前成立什么
2. `calendar` runtime 为什么仍不能被写成已成立
3. settings/operator 为什么要改成 business-first 的最小决策面
4. 哪些能力继续刻意未做

它不是：

- native WeCom SCIM
- WeCom calendar runtime ingestion
- WeCom message notifications runtime ingestion
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

- `/api/auth/wecom/start`
- `/api/auth/wecom/callback`
- `providerType = WECOM_OAUTH`
- tenant-scoped callback audit truth

### 3.2 WeCom meetings runtime

当前已经成立：

- `meetings` read-only runtime ingestion seam
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
- settings/operator 对 `meetings` ingest posture 的 readout

### 3.3 workspace-scoped calendar registry seam

当前已经成立：

- workspace-scoped `cal_id` registry persistence
- registry validation truth
- `WECOM_CALENDAR_REGISTRY_VALIDATED / PARTIAL / FAILED / UNRESOLVED`
- settings/operator 第一屏收口到：
  - `registry readiness`
  - `bound calendar count`
  - `last validation result`
  - `next required action`

这表示 Helm 现在已经知道某个 workspace 有没有可验证的 WeCom calendar ids，但这仍不等于 calendar runtime 已成立。

## 4. 已成形但仍需下一层

- `calendar` 的 provider-side contract 已经验证到 `get`，但当前 repo 只把 registry seam 建起来；真正的 calendar runtime ingest 仍待下一层 registry-backed ingest slice
- 当前 settings/operator 已经把解释收窄到经营优先的最小面，但 callback / ingest / scope 细节仍作为二级操作面保留
- `message notifications` 仍缺 verified read-side contract

## 5. 刻意未做

本轮继续刻意不做：

- native WeCom SCIM
- WeCom calendar runtime ingestion
- WeCom message notifications runtime ingestion
- WeCom send/write-back
- broader connector orchestration platform
- connector platformization
- 自动执行动作

## 6. 风险项

- 如果把 registry 成立写成 calendar runtime 已成立，会直接越过当前 truth
- 如果继续把 settings 页面铺成 callback / ingest / contract 的全量解释，会把最重要的经营动作埋掉
- 如果在没有 verified read contract 的前提下硬做 `message notifications`，会把 provider contract 臆造进代码

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已有 WeCom runtime OAuth callback foundation
- Helm 已有 WeCom `meetings` read-only runtime ingestion seam
- Helm 已有 workspace-scoped WeCom calendar registry seam
- `calendar runtime` 仍保持 pending，直到 registry-backed ingest slice 成立
- `message notifications` 继续保持 unresolved

当前不能表述为：

- WeCom calendar runtime 已经完整收口
- WeCom message notifications runtime 已经完整收口
- native WeCom SCIM 当前已经完整收口
- WeCom send/write-back 当前已经完整收口
- WeCom connector platform 当前已经完整收口
