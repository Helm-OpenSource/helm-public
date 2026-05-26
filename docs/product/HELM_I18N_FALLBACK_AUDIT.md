---
status: archived
owner: helm-core
created: 2026-05-17
review_after: 2026-11-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm i18n Fallback Audit

更新时间：2026-05-17

适用范围：中文 / 英文双线、Tenant Overlay、Deployment Profile 与 workspace locale 的 fallback 关系

实现状态：repo-truth audit + 最小 helper + workspace shell / server loader / detail page 接入；本文件不改 schema 或 copy bundle。`resolveWorkspaceUiLocale()` 已在 `lib/i18n/config.ts` 落地；request cookie 与 `HELM_DEFAULT_LOCALE` env 读取收口到 `lib/i18n/request-locale.server.ts`；workspace shell、`normalizeWorkspaceUiConfig()` server 调用点、代表性 workspace page-loader、主要 workspace detail/list pages、loading / not-found pages 与 public OAuth start routes 已接入；`lib/i18n/workspace-locale-boundary.test.ts` 已固定 raw `resolveUiLocale()`、direct request-locale cookie read 与 direct workspace/page `process.env.HELM_DEFAULT_LOCALE` read 边界；`lib/i18n/query-locale-boundary.test.ts` 已固定 data / query modules 不读 request cookie locale；`lib/i18n/action-locale-boundary.test.ts` 已固定 action 层 locale 边界，并新增 request cookie read 禁止项；`lib/i18n/api-locale-boundary.test.ts` 已禁止 API route 读取 `helm-ui-locale` request cookie；`lib/i18n/api-workspace-default-locale-inventory.test.ts` 已固定 API route 中 75 个 workspace-default 文案路径的 reviewed inventory 与 15 个 domain owner key；`lib/i18n/api-message-locale.ts` 已建立 API-local exact-match helper 与 `{ zh, en }` message pair resolver scaffold，auth / briefings / blockers / commitments / connectors / conversation-capture / evolution / helm-v2-runtime / imports / llm / memory / recommendations / runtime / settings / tenant-private-extension 共 75 个 route 已接入 exact-match helper；`owner:settings` 的 org-admin support-pack audit summary、`owner:commitments` 的 status fallback 与 `owner:blockers` 的 create fallback 文案已接入 owner-level helper；CSV preview、trial application、program application submit / review / invite、participant portal onboarding / profile update、auth login / signup / phone-code / first-login identity completion action 已从 request cookie fallback 迁移为客户端显式传入 locale 或 enrollment locale；action 层剩余 `helm-ui-locale` 使用只保留语言 cookie 写入同步；message bundle 分层仍待下一层。

## 1. 结论

当前 Helm 已具备双语基础，但还不是发行版级 i18n 架构：

- Public / auth 页面主要从 `helm-ui-locale` cookie 解析 UI locale。
- Workspace 页面大量依赖 `Workspace.defaultLocale` 或传入的 `locale` prop。
- `lib/i18n/config.ts` 已有 `zh-CN` / `en-US` 两个 supported locale、legacy `resolveUiLocale()` 与新 `resolveWorkspaceUiLocale()` helper。
- `lib/i18n/messages.ts` 仍是单体 message bundle，没有 Engine / Pack / Tenant Overlay 分层。
- Deployment Profile 默认 locale 已进入 env validation，并已在 workspace shell / provider 与 server page-loader 中作为 fallback 读取。
- Tenant Overlay 已有 `resolveTenantOverlayLocale()` helper 和 `resolveTenantOverlayForTenantKey()` 只读 resolver，但尚未接入 private overlay loader。

因此当前 fallback 真值应表达为“已成形但仍需下一层”，不能说中文 / 英文发行版已经完全分离。

## 2. Current Truth

| 来源 | 当前入口 | 已成立 | 未成立 |
| --- | --- | --- | --- |
| Public locale cookie | `UI_LOCALE_COOKIE = "helm-ui-locale"` / `resolveUiLocale()` | public / auth 页面可按 cookie 切换 | legacy resolver 对未知值仍回退 engine default |
| Workspace default | `Workspace.defaultLocale` | workspace 内业务 copy 可跟随 workspace；`normalizeWorkspaceUiConfig()` 已改为兼容新 fallback helper | 不是 user-level preference；actions / query 层仍保留 workspace-only 语义 |
| Deployment Profile default | `HELM_DEFAULT_LOCALE` / `getDeploymentProfileDefaultLocaleCandidate()` | 已由 `validate:env` fail-closed 校验；env 读取已集中到 `lib/i18n/request-locale.server.ts`；workspace shell / provider、server page-loader、主要 workspace detail/list pages 与 loading / not-found pages 已作为 fallback 读取 | message bundle 与 API 文案仍未迁移；API workspace-default 文案路径已先做 inventory |
| Tenant Overlay locale | `TenantOverlayDefinition.locale` | contract + helper + read-only resolver 已存在 | 尚未接入 private overlay loader / secret dereference |
| Message bundle | `lib/i18n/messages.ts` | 双语 message 基础可用 | 未分 Engine / Pack / Tenant / Edition 层 |
| Workspace fallback helper | `resolveWorkspaceUiLocale()` / `resolveWorkspaceUiLocaleForRequest()` / `resolveRequestUiLocale()` | request / user / workspace / tenant overlay / deployment profile / engine fallback 顺序已可测试；workspace shell、`normalizeWorkspaceUiConfig()` server 调用点、dashboard / internal operating / approvals / meetings / memory loaders、companies / contacts detail loaders、customer-facing detail pages、search / mobile / tenant-private readout、public / workspace loading 与 workspace not-found 已迁移 | API 文案与 message bundle 分层未迁移；API workspace-default 文案路径已先做 inventory |
| Raw resolver boundary test | `lib/i18n/workspace-locale-boundary.test.ts` | workspace pages / page-loaders 不允许新增 raw `resolveUiLocale()` 或 direct request-locale cookie read；loading / not-found 已从 allowlist 移除并改走 `resolveRequestUiLocale()` | action raw resolver allowlist 仍需随剩余 mutation contract 下一层收窄 |
| Query locale boundary test | `lib/i18n/query-locale-boundary.test.ts` | `data/` 与 `features|lib` query modules 不允许读取 `next/headers`、request cookie、`helm-ui-locale` 或 raw `resolveUiLocale()`；query 层 locale 必须由 caller 显式传入或来自 workspace data | API route message ownership map 与 message bundle 分层仍需下一层 |
| Action locale boundary test | `lib/i18n/action-locale-boundary.test.ts` | 现有 action 层 `helm-ui-locale` / `UI_LOCALE_COOKIE` marker 与 raw `resolveUiLocale()` 使用被固定到显式 allowlist，并额外禁止 action 读取 `helm-ui-locale` request cookie；`features/imports/actions.ts` 的 CSV preview、`features/trial/actions.ts` 的 trial application、`features/programs/actions.ts` 的 application submit / review / invite、`features/participant-portal/actions.ts` 的 onboarding / profile update、`features/auth/actions.ts` 的 login / signup / phone-code / first-login identity completion 已改为显式 `locale` 输入或 enrollment locale，不再读 request cookie | marker allowlist 仍保留 auth / settings，因为它们会写入语言 cookie 同步 public / workspace locale；这不是 license、security 或 Pack 边界 |
| API locale boundary test | `lib/i18n/api-locale-boundary.test.ts` | API routes 不允许读取 `helm-ui-locale` request cookie；public OAuth start routes 改走 `resolveRequestUiLocale()`；raw `resolveUiLocale()` 只允许在 WeCom public OAuth callback 解析 state locale；75 个 reviewed API workspace-default 文案路径已接入 API-local helper | message bundle / domain message helper 分层仍待下一层 |
| API workspace-default locale inventory | [HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md](HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md) / `lib/i18n/api-workspace-default-locale-inventory.test.ts` / `lib/i18n/api-message-locale.ts` | 固定当前 75 个 API route 中通过 `Workspace.defaultLocale` / connector workspace default / session workspace default 切换错误或状态文案的 reviewed inventory，并固定 15 个 domain owner key；auth / briefings / blockers / commitments / connectors / conversation-capture / evolution / helm-v2-runtime / imports / llm / memory / recommendations / runtime / settings / tenant-private-extension 共 75 个 route 已接入 API-local exact-match helper；已新增 `{ zh, en }` message pair resolver scaffold，且 `owner:settings` 的 audit summary、`owner:commitments` 的 status fallback、`owner:blockers` 的 create fallback 已接入 owner helper | 只做 inventory + ownership map + helper adoption + resolver scaffold + first owner helpers，不拆 message bundle、不建立 Edition / Pack / Cloud runtime 边界 |

## 3. Recommended Fallback Order

`resolveWorkspaceUiLocale()` 已按以下顺序解析：

1. request locale：cookie、explicit query 或 accepted UI preference
2. user locale：未来 user profile preference
3. workspace default：`Workspace.defaultLocale`
4. tenant overlay default：`TenantOverlayDefinition.locale.defaultLocale`
5. deployment profile default：`HELM_DEFAULT_LOCALE`
6. engine default：`zh-CN`

只有精确命中 supported locale 的值才会被采用。未知值不会在 workspace fallback 中被静默转成 `zh-CN` 后抢先覆盖英文 deployment default。

## 4. Boundary Rules

- i18n fallback 不授予 tenant feature access。
- locale 不决定 Pack / extension 是否启用。
- Deployment Profile default locale 不等于发行版安全边界。
- Tenant Overlay locale 只能改变默认展示，不改变数据驻留、认证、审计或执行权限。
- 英文 SaaS 自助上线前，message bundle 必须拆到 Engine / Pack / Tenant 或至少建立 ownership map。

## 5. 已接入 Runtime Slices

本轮只接入 server-side workspace 读取路径：

1. `features/dashboard/page-loader.ts` 通过 request helper 读取 request locale candidate、`Workspace.defaultLocale` 与 deployment profile default。
2. `features/internal-operating-workspace/page-loader.ts` 的 home / role 两个 loader 读取同一 fallback 顺序。
3. `app/(workspace)/layout.tsx` 让 workspace shell / provider 使用同一 fallback，并让数据库离线 banner 读取同一 request / deployment fallback。
4. `lib/workspace-ops.ts` 的 `normalizeWorkspaceUiConfig()` 改为兼容 `requestLocale`、`userLocale`、tenant overlay default 与 deployment profile default，但旧调用仍只需要传 workspace 对象。
5. `app/(workspace)/reports|companies|contacts|capture|diagnostics`、`app/setup/page.tsx`、`features/approvals|meetings|memory/page-loader.ts` 已把 request locale 与 deployment profile default 传入 workspace UI config。
6. `lib/i18n/request-locale.server.ts` 负责读取 `helm-ui-locale` cookie 与 `HELM_DEFAULT_LOCALE` env，并暴露 `getDeploymentProfileDefaultLocaleCandidate()` / `resolveWorkspaceUiLocaleForRequest()` 供 server pages 组合 request / workspace / deployment fallback；在没有 Next request scope 的现有 unit tests 中回退为 `null`，不让页面测试因为 dynamic API 直接失败。
7. `features/companies|contacts/page-loader.ts`、customer-facing detail pages、`/search`、`/mobile`、`/customer-success` 与 tenant-private readout 已改为通过 `resolveWorkspaceUiLocaleForRequest({ workspaceDefaultLocale })` 解析 locale，不再在页面层手写 cookie-only fallback。
8. `lib/i18n/workspace-locale-boundary.test.ts` 固定 raw `resolveUiLocale()` 与 direct request-locale cookie read allowlist，防止 workspace pages / page-loaders 重新绕开 request + workspace + deployment fallback。
9. `lib/i18n/query-locale-boundary.test.ts` 固定 data / query modules 不能读取 request cookie locale，避免 query 层引入 request scope 或隐式 cookie dependency。
10. `lib/i18n/action-locale-boundary.test.ts` 固定 action 层 request-locale cookie marker 与 raw resolver allowlist，并禁止 action 读取 `helm-ui-locale` request cookie；auth / settings 仍允许写入语言 cookie 用于 public / workspace locale 同步，这不是最终 i18n / entitlement contract。
11. `features/imports/actions.ts` 的 CSV preview action 已不再读取 `helm-ui-locale` request cookie，改由 `features/imports/imports-client.tsx` 从 `useWorkspaceUi()` 显式传入 locale；真实导入 action 继续按 workspace default locale 处理权限与错误文案，避免扩大行为面。
12. `features/trial/actions.ts` 的 trial application action 已不再读取 `helm-ui-locale` request cookie，改由 `app/trial/page.tsx` 解析 public locale 后传给 `features/trial/trial-application-form.client.tsx`，再随 submit input 显式传入 action；该变更不自动开通工作区、不改变 trial persistence 或通知发送边界。
13. `features/programs/actions.ts` 的 program application submit / review / invite 已不再读取 `helm-ui-locale` request cookie，分别由 `ProgramApplicationForm` 与 settings client 显式传入 locale；action 仍保留 raw resolver 仅用于解析显式输入。
14. `features/participant-portal/actions.ts` 的 participant onboarding 与 profile update 已不再读取 `helm-ui-locale` request cookie，改由 portal onboarding / portal client 随 submit payload 显式传入 locale；管理端 issue / status action 继续按 workspace default locale 处理权限与错误文案。
15. `features/auth/actions.ts` 的 legacy email login、password login、phone entry / phone code login、trial signup / verification 与 first-login identity completion 已不再读取 `helm-ui-locale` request cookie，改由 public/login client、demo entry server action 或 enrollment locale 显式提供 locale；`updatePublicLocaleAction` 与登录后 locale 同步仍会写入语言 cookie。
16. `app/loading.tsx`、`app/demo/loading.tsx`、`app/programs/loading.tsx`、`app/portal/loading.tsx`、`app/(workspace)/loading.tsx`、`app/(workspace)/meetings/[id]/loading.tsx` 与 `app/(workspace)/not-found.tsx` 已改为 `resolveRequestUiLocale()`，不再在页面层直接读取 `helm-ui-locale`。
17. `app/api/public-auth/dingtalk/start/route.ts` 与 `app/api/public-auth/wecom/start/route.ts` 已改为 `resolveRequestUiLocale()`，并由 `lib/i18n/api-locale-boundary.test.ts` 防止 API route 重新读取 request-locale cookie。
18. [HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md](HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md)、`lib/i18n/api-workspace-default-locale-inventory.test.ts` 与 `lib/i18n/api-message-locale.ts` 已固定 75 个 API route workspace-default 文案路径、15 个 domain owner key、API-local exact-match helper 与 `{ zh, en }` message pair resolver scaffold；auth / briefings / blockers / commitments / connectors / conversation-capture / evolution / helm-v2-runtime / imports / llm / memory / recommendations / runtime / settings / tenant-private-extension 共 75 个 route 已接入 helper；`owner:settings` 的 org-admin support-pack audit summary、`owner:commitments` 的 status fallback 与 `owner:blockers` 的 create fallback 文案已接入 owner-level helper。后续新增 `workspace.defaultLocale === "en-US"` API 判断必须先进入 reviewed inventory / ownership map 或迁移到更明确的 locale/message contract。

## 6. Next Runtime Slice

下一刀仍只做 runtime 收口，不提前进入 Edition / Pack / marketplace / Cloud control plane：

1. 继续把 action locale contract 从 request cookie 迁移到显式输入或 workspace data；request cookie 写入只用于 public locale switch 与 workspace 切换后的 UI 同步。
2. 下一层优先处理 API route message ownership map，把 75 个 reviewed workspace-default 文案路径从 API-local exact-match helper 继续收敛到 owner-level domain message helper；owner helper 可先包裹 `resolveApiWorkspaceMessage()`，不一次性迁移全部 copy。CSV preview、trial application、program application submit / review / invite、participant onboarding / profile update、auth login / signup / phone-code / first-login identity completion、loading / not-found pages 已完成 request-cookie read 移除。
3. Tenant Overlay 只允许继续做 pure resolver / read-only projection；不接 private loader、secret dereference 或 DB persistence，除非 private overlay 持久化 contract 已先成立。
4. 不拆 message bundle。
5. 不改 copy 内容。
6. 不重新引入 API route 中直接依赖 `workspace.defaultLocale === "en-US"` / session workspace raw compare 的错误文案，继续用 inventory guard 防止扩大行为面。
