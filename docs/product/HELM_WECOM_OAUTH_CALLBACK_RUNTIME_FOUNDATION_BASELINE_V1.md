---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm WeCom OAuth Callback Runtime Foundation Baseline V1

## 1. 目的

冻结 PR88 当前 truth：

1. WeCom 从 foundation-only 推进到哪一层
2. WeCom runtime OAuth callback 已成立到哪一层
3. 哪些 audit/session/settings truth 已成立
4. 哪些内容仍然刻意未做

它不是：

- native WeCom SCIM
- WeCom read-only ingestion runtime
- WeCom send/write-back
- connector platformization
- execution-authority expansion

## 2. 当前基线

当前 WeCom callback foundation 继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 3. 已经完整成立

### 3.1 WeCom runtime OAuth callback foundation

当前已经新增：

- `/api/auth/wecom/start`
- `/api/auth/wecom/callback`
- `code -> corp access token -> oauth user identity -> provider user profile`
- workspace-scoped identity binding

这表示 Helm 已经有真实可运行的 WeCom OAuth callback foundation，但它仍然是 workspace-scoped callback foundation，不等于完整企业级 SSO 平台。

### 3.2 session / identity truth

当前已经成立：

- `providerType = WECOM_OAUTH`
- `sourcePage = /api/auth/wecom/callback`
- WeCom callback-compatible provider/source governance
- workspace-scoped auth session create/revoke chain

### 3.3 tenant-scoped callback audit truth

当前已经成立：

- `WECOM_OAUTH_CALLBACK_SUCCEEDED`
- `WECOM_OAUTH_CALLBACK_FAILED`
- `WECOM_OAUTH_CALLBACK_UNRESOLVED`
- `WECOM_OAUTH_CALLBACK_MISMATCH`

这些 audit marker 都是 tenant-scoped callback truth，不是 broader IAM/security platform。

### 3.4 settings / operator readout

当前 settings/operator surface 已经可读：

- WeCom callback readiness
- last callback status
- failure posture
- last callback timestamp
- resolved provider email / mobile
- matched workspace user

## 4. 已成形但仍需下一层

- WeCom callback foundation 已成立，但 native WeCom SCIM 仍需下一层
- WeCom callback foundation 已成立，但 read-only ingestion runtime 仍需下一层
- current operator readout 已成立，但 broader connector/admin platform 仍需下一层

## 5. 刻意未做

本轮刻意未做：

- native WeCom SCIM claim
- meetings / calendar / message notifications ingestion runtime
- send/write-back connector
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation

## 6. 风险项

- 如果把 callback foundation 写成完整 WeCom SSO / enterprise IAM，会越过当前 truth
- 如果把 current user binding 写成 native WeCom SCIM，会越过当前 truth
- 如果后续 read-only ingestion 直接混进 callback foundation，会扩大验证面并拉高回归风险

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已有可运行的 WeCom OAuth callback foundation
- Helm 已有 `providerType = WECOM_OAUTH` 的 session truth
- Helm 已有 callback `success / failure / unresolved / mismatch` 的 tenant-scoped audit truth

当前不能表述为：

- native WeCom SCIM 当前仍未成立
- WeCom read-only ingestion runtime 当前仍未成立
- WeCom send/write-back 当前仍未成立
- Helm 已成为 WeCom connector platform
