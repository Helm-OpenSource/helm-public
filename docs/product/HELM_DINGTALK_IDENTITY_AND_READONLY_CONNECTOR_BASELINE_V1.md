---
status: active
owner: helm-core
created: 2026-04-06
review_after: 2026-07-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm DingTalk Identity And Read-only Connector Baseline V1

## 1. 目的

冻结 PR73 当前 truth：

1. DingTalk identity provider seam 已成立到哪一层
2. DingTalk read-only connector target 已成立到哪一层
3. Helm directory-sync adapter seam 已成立到哪一层
4. 哪些内容仍然刻意未做

它不是：

- native DingTalk SCIM
- DingTalk OAuth login/callback runtime
- DingTalk meetings / calendar / message notifications ingestion runtime
- send/write-back connector
- connector platform
- execution-authority expansion

## 2. 当前基线

当前 DingTalk foundation 继续保持：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 3. 已经完整成立

### 3.1 DingTalk provider seam

当前已经新增：

- `AUTH_SESSION_PROVIDER_TYPES.DINGTALK_OAUTH`

这表示 Helm 已经有 future DingTalk identity provider seam，但它仍然只是 seam，不等于 OAuth runtime 已成立。

### 3.2 DingTalk connector/config truth

当前已经新增：

- `ConnectorProvider.DINGTALK`
- `ImportSourceType.DINGTALK`
- DingTalk config helper
- DingTalk readiness helper

当前 env contract 已明确：

- `DINGTALK_CLIENT_ID`
- `DINGTALK_CLIENT_SECRET`
- `DINGTALK_REDIRECT_URI`

默认 redirect path 固定为：

- `/api/auth/dingtalk/callback`

### 3.3 DingTalk read-only scope truth

当前 read-only connector target 已明确冻结为：

- `meetings`
- `calendar`
- `message notifications`

当前 read-only 只表示 target coverage，不表示 ingestion runtime 已成立。

### 3.4 Helm directory-sync adapter seam

当前 directory sync 只能诚实表达为：

- `Helm directory-sync adapter seam`

当前 repo truth 里不声称：

- native DingTalk SCIM
- official DingTalk SCIM implementation

## 4. 已成形但仍需下一层

- DingTalk OAuth provider seam 已成立，但登录/callback runtime 仍需下一层
- DingTalk read-only target coverage 已成立，但 meetings / calendar / message notifications sync runtime 仍需下一层
- Helm directory-sync adapter seam 已成立，但 provider-specific provisioning runtime 仍需下一层

## 5. 刻意未做

本轮刻意未做：

- native DingTalk SCIM claim
- DingTalk OAuth login/callback route implementation
- DingTalk directory provisioning implementation
- DingTalk send/write-back connector
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation

## 6. 风险项

- 如果把 `Helm directory-sync adapter seam` 写成 native DingTalk SCIM，会直接越过当前 truth
- 如果把 read-only target coverage 写成 connector runtime，会误导 operator 和后续集成实现
- 如果 future provider-specific runtime 直接接入 send/write-back，会越过当前 `no broad auto-write` 边界

## 7. 对外诚实口径

当前可以诚实表述为：

- Helm 已有 DingTalk identity/read-only connector foundation
- Helm 已有 DingTalk OAuth provider seam 与 env/config contract
- Helm 已把 DingTalk read-only target 冻结到 `meetings / calendar / message notifications`
- Helm 当前只成立 `Helm directory-sync adapter seam`

当前不能表述为：

- native DingTalk SCIM 已完整成立
- DingTalk SSO runtime 已完整成立
- DingTalk send/write-back connector 已完整成立
- Helm 已成为 DingTalk connector platform
