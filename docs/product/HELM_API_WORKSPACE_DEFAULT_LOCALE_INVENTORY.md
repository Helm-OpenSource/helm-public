---
status: active
owner: helm-core
created: 2026-05-17
review_after: 2026-08-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm API Workspace Default Locale Inventory

更新时间：2026-05-17

适用范围：`app/api` 中通过 `Workspace.defaultLocale` / connector workspace default / session workspace default 切换 API 错误文案、状态文案或只读响应文案的路径。

实现状态：inventory + ownership map + API-local helper adoption。本文件不拆 `lib/i18n/messages.ts`，不改变 request locale、workspace locale、Deployment Profile、Tenant Overlay、Pack、license、entitlement 或 Cloud / Enterprise runtime 行为。

## 1. 结论

当前 API 层已经禁止读取 `helm-ui-locale` request cookie，但仍有一批 route 使用 workspace data 中的 `defaultLocale` 决定英文 / 中文错误文案。这些路径是合法的当前实现，但不是最终 Edition / Pack / message bundle 分层。

本轮把这些路径固定成 reviewed inventory，并由 `lib/i18n/api-workspace-default-locale-inventory.test.ts` 做四件事：

1. 扫描 `app/api` 中新增的 workspace-default locale 文案路径。
2. 要求扫描结果与本文件列出的 reviewed inventory 一致。
3. 要求 reviewed inventory 中每个文件仍然真实存在。
4. 要求 reviewed inventory 中每个文件都有稳定 owner key，并固定 owner count。

## 2. Boundary

- 这是 workspace data fallback inventory，不是 request cookie fallback。
- `Workspace.defaultLocale` 不授予 Pack、extension、license、security、entitlement 或 data residency 权限。
- 这些路径不能被解释为中文 / 英文 Edition 已经完全拆分。
- 新 API route 不应继续散落 `workspace.defaultLocale === "en-US"` 文案判断；新增时必须先选择显式 locale contract、workspace helper 或 message ownership map。
- 后续迁移应优先收敛到 API message bundle / ownership map，而不是把 request cookie 重新带回 API route。

## 3. Current Inventory

当前 reviewed inventory 共 78 个 API route 文件：

| Area | Count |
| --- | ---: |
| `app/api/auth` | 4 |
| `app/api/blockers` | 3 |
| `app/api/briefings` | 1 |
| `app/api/commitments` | 2 |
| `app/api/connectors` | 3 |
| `app/api/conversation-capture` | 5 |
| `app/api/evolution` | 14 |
| `app/api/extensions` | 2 |
| `app/api/helm-v2` | 17 |
| `app/api/imports` | 5 |
| `app/api/internal-commercialization` | 2 |
| `app/api/llm` | 3 |
| `app/api/memory` | 10 |
| `app/api/opportunities` | 1 |
| `app/api/recommendations` | 2 |
| `app/api/runtime` | 3 |
| `app/api/settings` | 1 |

### Reviewed Files

- `app/api/auth/dingtalk/callback/route.ts`
- `app/api/auth/dingtalk/start/route.ts`
- `app/api/auth/feishu/callback/route.ts`
- `app/api/auth/feishu/start/route.ts`
- `app/api/auth/wecom/callback/route.ts`
- `app/api/auth/wecom/start/route.ts`
- `app/api/blockers/[id]/resolve/route.ts`
- `app/api/blockers/[id]/status/route.ts`
- `app/api/blockers/route.ts`
- `app/api/briefings/meeting/[meetingId]/route.ts`
- `app/api/commitments/[id]/status/route.ts`
- `app/api/commitments/route.ts`
- `app/api/connectors/google/start/route.ts`
- `app/api/connectors/hubspot/start/route.ts`
- `app/api/connectors/salesforce/start/route.ts`
- `app/api/conversation-capture/[sessionId]/results/route.ts`
- `app/api/conversation-capture/[sessionId]/route.ts`
- `app/api/conversation-capture/[sessionId]/stop/route.ts`
- `app/api/conversation-capture/ingest/route.ts`
- `app/api/conversation-capture/start/route.ts`
- `app/api/evolution/delta-events/route.ts`
- `app/api/evolution/insights/route.ts`
- `app/api/evolution/patterns/route.ts`
- `app/api/evolution/skill-suggestions/[id]/accept/route.ts`
- `app/api/evolution/skill-suggestions/[id]/approve-formal-review/route.ts`
- `app/api/evolution/skill-suggestions/[id]/defer-formal-review/route.ts`
- `app/api/evolution/skill-suggestions/[id]/dismiss/route.ts`
- `app/api/evolution/skill-suggestions/[id]/queue-formal-review/route.ts`
- `app/api/evolution/skill-suggestions/[id]/reject-formal-review/route.ts`
- `app/api/evolution/skill-suggestions/[id]/return-hardening/route.ts`
- `app/api/evolution/skill-suggestions/route.ts`
- `app/api/evolution/strategy-suggestions/[id]/accept/route.ts`
- `app/api/evolution/strategy-suggestions/[id]/dismiss/route.ts`
- `app/api/evolution/strategy-suggestions/route.ts`
- `app/api/extensions/<tenant-private>/<tenant-private-integration>/accountBinding/callback/route.ts`
- `app/api/extensions/<tenant-private>/<tenant-private-integration>/accountBinding/start/route.ts`
- `app/api/helm-v2/runtime/artifacts/[id]/confirm/route.ts`
- `app/api/helm-v2/runtime/checkpoints/[id]/resume/route.ts`
- `app/api/helm-v2/runtime/consolidation/jobs/[id]/status/route.ts`
- `app/api/helm-v2/runtime/consolidation/jobs/route.ts`
- `app/api/helm-v2/runtime/consolidation/meetings/[meetingId]/queue/route.ts`
- `app/api/helm-v2/runtime/context/prune/route.ts`
- `app/api/helm-v2/runtime/meetings/ingest/route.ts`
- `app/api/helm-v2/runtime/memory/promote/route.ts`
- `app/api/helm-v2/runtime/problem-spaces/[id]/assign-dri/route.ts`
- `app/api/helm-v2/runtime/problem-spaces/route.ts`
- `app/api/helm-v2/runtime/reflection/candidates/[id]/accept/route.ts`
- `app/api/helm-v2/runtime/reflection/candidates/[id]/dismiss/route.ts`
- `app/api/helm-v2/runtime/reflection/jobs/[id]/status/route.ts`
- `app/api/helm-v2/runtime/reflection/jobs/route.ts`
- `app/api/helm-v2/runtime/reflection/meetings/[meetingId]/queue/route.ts`
- `app/api/helm-v2/runtime/signals/ingest/route.ts`
- `app/api/helm-v2/runtime/verification/run/route.ts`
- `app/api/imports/conflicts/[id]/resolve/route.ts`
- `app/api/imports/crm/preview/route.ts`
- `app/api/imports/crm/run/route.ts`
- `app/api/imports/crm/sync/route.ts`
- `app/api/imports/jobs/[jobId]/warmup/route.ts`
- `app/api/internal-commercialization/fixture-connector/route.ts`
- `app/api/internal-commercialization/runs/route.ts`
- `app/api/llm/briefings/[objectType]/[objectId]/route.ts`
- `app/api/llm/meetings/[meetingId]/process-memory/route.ts`
- `app/api/llm/recommendations/[recommendationId]/explain/route.ts`
- `app/api/memory/export/route.ts`
- `app/api/memory/facts/[id]/confirm/route.ts`
- `app/api/memory/facts/[id]/correct/route.ts`
- `app/api/memory/facts/[id]/delete/route.ts`
- `app/api/memory/facts/[id]/invalidate/route.ts`
- `app/api/memory/facts/route.ts`
- `app/api/memory/imports/meeting-notes/process/route.ts`
- `app/api/memory/meetings/[meetingId]/process/route.ts`
- `app/api/memory/openclaw/status/route.ts`
- `app/api/memory/openclaw/sync/route.ts`
- `app/api/opportunities/[id]/attachments/route.ts`
- `app/api/recommendations/[id]/feedback/route.ts`
- `app/api/recommendations/next-actions/route.ts`
- `app/api/runtime/dingtalk/hourly-sync/route.ts`
- `app/api/runtime/events/meeting-ended/route.ts`
- `app/api/runtime/memory/meeting-facts/confirm/route.ts`
- `app/api/settings/org-admin/support-pack/route.ts`

## 4. Message Ownership Map

这些 owner 不是组织权限，也不是 Pack / license 边界，只是后续抽取 API message helper 时的代码归属。

| Owner key | Count | 负责范围 | 下一层收口方向 |
| --- | ---: | --- | --- |
| `owner:auth` | 4 | 企业认证 callback / start route 文案 | 收到 auth callback message helper |
| `owner:blockers` | 3 | blocker create / resolve / status 文案 | 收到 memory-governance message helper |
| `owner:briefings` | 1 | meeting briefing 文案 | 收到 briefing message helper |
| `owner:commitments` | 2 | commitment create / status 文案 | 收到 commitment message helper |
| `owner:connectors` | 3 | Google / HubSpot / Salesforce connector start 权限文案 | 收到 connector message helper |
| `owner:conversation-capture` | 5 | capture start / ingest / stop / result 文案 | 收到 capture message helper |
| `owner:evolution` | 14 | evolution insight / pattern / skill / strategy suggestion 文案 | 收到 evolution message helper |
| `owner:tenant-private-extension` | 2 | tenant-private extension account binding 文案 | 保留 private owner；public docs 只用 redacted descriptor |
| `owner:helm-v2-runtime` | 17 | Helm v2 runtime / reflection / consolidation / verification 文案 | 收到 helm-v2 runtime message helper |
| `owner:imports` | 5 | CRM import / sync / conflict / warmup 文案 | 收到 imports message helper |
| `owner:internal-commercialization` | 2 | internal commercialization fixture connector / run 文案 | 收到 internal commercialization message helper |
| `owner:llm` | 3 | LLM briefing / recommendation / meeting-memory route 文案 | 收到 LLM route message helper |
| `owner:memory` | 10 | memory facts / export / meeting process / OpenClaw route 文案 | 收到 memory message helper |
| `owner:opportunities` | 1 | opportunity attachment 文案 | 收到 opportunity message helper |
| `owner:recommendations` | 2 | recommendations feedback / next-actions 文案 | 收到 recommendation message helper |
| `owner:runtime` | 3 | runtime event / memory fact / hourly-sync 文案 | 收到 runtime event message helper |
| `owner:settings` | 1 | org-admin support pack 文案 | 收到 settings / org-admin message helper |

## 5. Helper Adoption

`lib/i18n/api-message-locale.ts` 现在提供 `isEnglishWorkspaceDefaultLocale()` 与 `resolveApiWorkspaceMessage()`。前者只做 exact `en-US` 判断，用于收敛 API route 中重复的 workspace-default 英文判断；后者只复用同一 exact-match 规则在 `{ zh, en }` message pair 中选文案，作为后续 owner-level message helper 的最小 scaffold。它们不读取 request cookie，不读取 Deployment Profile，不解析 Tenant Overlay，也不代表 message bundle 已分层。

`lib/i18n/api-settings-messages.ts` 是第一条 owner-level helper adoption：`owner:settings` 的 org-admin support-pack audit summary 已从 route 内 inline 三元表达式迁移到 settings owner helper。该 helper 仍只包裹 API-local message pair resolver，不改变 capability guard、audit payload、download response header 或 support-pack 生成语义。

`lib/i18n/api-commitment-messages.ts` 是第二条 owner-level helper adoption：`owner:commitments` 的 status update route 已把 workspace-default fallback 文案迁移到 commitment owner helper。当前只迁移既有 `english ? ... : ...` fallback，不改变 commitment create route 的固定 success/fallback 字符串、不改变 memory capability guard、ownership guard 或 commitment service 语义。

`lib/i18n/api-blocker-messages.ts` 是第三条 owner-level helper adoption：`owner:blockers` 的 create route 已把 workspace-default fallback 文案迁移到 blocker owner helper。当前只迁移既有 `english ? ... : ...` fallback；resolve / status route 的固定中文 fallback 与固定 success 字符串继续 deferred。

已接入 owner：

| Owner key | Files | 状态 |
| --- | ---: | --- |
| `owner:auth` | 4 | 已接入 API-local helper |
| `owner:briefings` | 1 | 已接入 API-local helper |
| `owner:blockers` | 3 | 已接入 API-local helper；create fallback 已接入 owner-level helper |
| `owner:commitments` | 2 | 已接入 API-local helper；status fallback 已接入 owner-level helper |
| `owner:connectors` | 3 | 已接入 API-local helper |
| `owner:conversation-capture` | 5 | 已接入 API-local helper |
| `owner:evolution` | 14 | 已接入 API-local helper |
| `owner:helm-v2-runtime` | 17 | 已接入 API-local helper |
| `owner:imports` | 5 | 已接入 API-local helper |
| `owner:internal-commercialization` | 2 | 已接入 API-local helper |
| `owner:llm` | 3 | 已接入 API-local helper |
| `owner:memory` | 10 | 已接入 API-local helper |
| `owner:opportunities` | 1 | 已接入 API-local helper |
| `owner:recommendations` | 2 | 已接入 API-local helper |
| `owner:runtime` | 3 | 已接入 API-local helper |
| `owner:settings` | 1 | 已接入 API-local helper；audit summary 已接入 owner-level helper |
| `owner:tenant-private-extension` | 2 | 已接入 API-local helper；public docs 只保留 redacted descriptor |

## 6. Migration Order

下一层迁移按风险从低到高推进：

1. 不允许重新引入重复的 `workspace.defaultLocale === "en-US"` / session workspace raw compare；新增 API 文案路径必须先使用 API-local helper 或更明确的 domain message helper。
2. 后续 owner helper 可先包裹 `resolveApiWorkspaceMessage()`，逐个 owner 收敛 `{ zh, en }` 文案 pair；当前不强制一次性迁移 75 条 copy。
3. 最后评估是否接入 Engine / Pack / Tenant message bundle。

明确不做：

- 不把 API route 改回 request cookie locale。
- 不用 Deployment Profile 作为 license / security / entitlement 边界。
- 不引入 Pack SDK、marketplace、Cloud control plane 或 Enterprise runtime。
- 不改现有错误文案内容。
