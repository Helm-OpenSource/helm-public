# Open Core / Enterprise / Cloud Architecture Boundary Plan

更新时间：2026-05-18
状态：Claude audit P1 remediation complete / API workspace-default locale helper adoption started / internal ADR draft imported / secret-history remediation blocked
分支：`codex/open-core-p1-hardening`

## 0. 当前追加切片：Must Push Outcome Checkpoint + Outcome Ledger + Review Cue（2026-05-18）

目标：沿 `/mobile` 的 Mobile Judgement Loop 切深 Helm 产品核心闭环，把 Must Push 从“今天最该推进什么”推进到“推进后必须回收什么结果”，并把结果回收收成只读 Outcome Ledger，再派生人工复核前的 Outcome Review Cue。

影响面：

- `features/mobile/types.ts`
- `features/mobile/lib/mobile-command-read-model.ts`
- `features/mobile/lib/mobile-judgement-loop.ts`
- `features/mobile/components/mobile-hero-card.tsx`
- `features/mobile/components/must-push-card.tsx`
- `features/mobile/components/outcome-ledger-panel.tsx`
- `features/mobile/components/workspace-status.tsx`
- `app/(workspace)/mobile/page.tsx`
- 移动端目标测试、`docs/product/HELM_MOBILE_JUDGEMENT_LOOP_IMPLEMENTATION_CONTRACT.md`、`docs/STATUS.md`、`docs/README.md`、`CHANGELOG.md`

关键假设：

- outcome checkpoint 只是 review-safe 结果回收口，不代表外部动作已经执行。
- 本切片不新增 DB schema、API route、POST / PATCH / DELETE、CRM 写回、自动发送、自动审批、自动 public claim。
- 默认 outcome checkpoint 可先由 read model deterministic 补齐，后续若要持久化 outcome ledger 必须另走 review-first / no external write gate。
- Outcome Ledger 当前只从展示项派生，不持久化、不确认结果、不写外部系统。
- Outcome Review Cue 只列出复核问题、证据提示和允许判断，不关闭事项、不确认外部成功。

风险与验证：

- 风险：文案误读为 Helm 已经推进或已回收结果；通过 copy contract 与 banned action wording 继续约束。
- 风险：outcome review href 漏出外部 URL 或 `/api/*`；通过 `buildMobileJudgementLoop` 安全路径过滤与测试覆盖。
- 风险：Outcome Ledger / Review Cue 被误读成结果已确认；通过 `boundaryNote`、copy contract 和 no-write 文档边界约束。
- 验证：targeted mobile Vitest、Outcome Ledger targeted Vitest、touched-file ESLint、`npm run typecheck`、`npm run check:boundaries`。

## 1. 目标

把 Helm 的 Apache-2.0 Open Core、Enterprise、Cloud、OPC / HVP、Tenant Overlay、Deployment Profile 与 Year 1 商业化边界收成可执行架构裁决。

## 2. 本轮范围

- 新增 Open Core / Enterprise / Cloud 架构文档
- 新增 internal-only Open Core ADR 草案，用于吸收 Claude review 后的分仓 / 商标 / Tenant Overlay 边界判断
- 新增 Codex / Claude collaboration protocol，用于降低多代理协作失败率
- 同步 `docs/README.md`
- 同步 `docs/STATUS.md`
- 明确 public mirror / private tenant separation / no marketplace / no full Pack SDK / no auto-send / no broad auto-write

## 3. 本轮不做

- 不改 runtime
- 不改 Prisma schema
- 不改 API / UI
- 不创建 `enterprise/` 或 `cloud/` 目录
- 不创建 Pack SDK
- 不创建 marketplace
- 不把 tenant-private implementation 公开成 Pack
- 不把 internal ADR 放入 public docs index

## 4. 阶段计划

### Phase 0

- 冻结架构裁决与边界文档
- 同步 docs index 与 STATUS
- 状态：Completed；internal-only ADR draft 已追加，待 owner + Codex + engineering + legal sign-off 后才可升级为生效 ADR

### Phase 1

- 补强 public-release hygiene：package script scan、tenant import scan、SBOM / source map scan、customer-name denylist
- 状态：In progress
- Slice 1：public `package.json` projection / script scrubber 已完成；新增 `public-mirror:package-json` builder，默认 stdout，只有显式 `--out` 才写文件，`--check` 只比较不改动真实 private worktree `package.json`
- Slice 2：public mirror preflight coordinator 已完成；新增 `public-mirror:preflight`，必须显式传 `--mirror-root`，只在准备好的 mirror tree 中串联 `package.json` projection 与 extensions registry stub
- Slice 3：source map / SBOM / Docker context artifact scan 已完成；`check:public-release` 现在会扫描 `.map`、SBOM / CycloneDX / SPDX、Dockerfile / docker-compose 中的 private path / tenant slug / internal host / artifact customer-name，并校验所有 full-context Dockerfile variant 对当前存在的 private roots 有 `.dockerignore` 覆盖
- Slice 4：artifact customer-name denylist 已完成；当前只覆盖 source map / SBOM / Docker context 等构建产物层，全文档 customer-name review 仍需人工裁决
- Slice 5：commercial entitlement boundary misuse scan 已完成；`check:public-release` 现在会拦截 public source 中把 `HELM_RELEASE_PROFILE` / region / residency / `BUILD_EDITION` 或 `NEXT_PUBLIC_*` 商业 flag 当作 license / entitlement / security / source gate 的用法，`HELM_DEFAULT_LOCALE` 仍允许作为默认 UI 语言读取
- Slice 6：public mirror tree verifier 已完成；新增 `public-mirror:verify -- --mirror-root <candidate>`，要求 package / registry projection 已完成，并且 `docs/internal`、tenant-private、commercial-private roots / files 已从 mirror candidate 物理移除
- Slice 7：release receipt public mirror evidence 已完成；`RELEASE_READINESS_SECRET_HISTORY_REMEDIATED=mirror-clean:<receipt-id>` 现在必须能追溯到 `public-mirror:verify -- --mirror-root <candidate>` 的通过记录
- Slice 8：public mirror candidate builder 已完成；新增 `public-mirror:build -- --mirror-root <candidate>`，从 private worktree 复制 public-safe 文件树、排除 private roots / private files / local artifacts，随后自动执行 preflight projection 与 verifier；默认拒绝 repo 内目标、非空目标与隐式覆盖，只有 `--force-clean` 才替换目标目录
- Slice 9：public mirror clean receipt schema 已完成；`mirror-clean:<receipt-id>` 现在必须对应 `docs/operations/release-readiness-receipts/<receipt-id>.json`，并由 `release:check` 校验 `public-mirror-clean` kind、matching receiptId、日期、sourceRef 与 exitCode=0 的 `public-mirror:build` / `public-mirror:verify` evidence
- Slice 10：public mirror clean receipt builder 已完成；新增 `public-mirror:clean-receipt -- --receipt-id <id> --source-ref <ref> --mirror-root <candidate>`，先运行 public mirror build / preflight / verify，只有成功后才写 `docs/operations/release-readiness-receipts/<id>.json`，并且 receipt command evidence 不记录本机绝对路径
- Slice 11：public mirror clean receipt 独立校验入口已完成；新增 `public-mirror:clean-receipt:check -- --receipt mirror-clean:<id>`，可在完整 `release:check` 前单独验证 receipt 文件、schema、matching id 与 public mirror build / verify 证据
- Slice 12：本轮 closeout 已完成；新增 `docs/reviews/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE_CLOSEOUT.md`，用四档短表收口已成立项、仍需下一层、刻意未做、风险项、验证结果与外部 blocker
- Slice 13：Claude audit remediation 已补上 public mirror npm alias 实际入口、`public-mirror:preflight:check` operator alias、Guangpu CJK customer-name denylist、`PLANS.md` exact allow-list 语义与 release guard regression；当时 license header / trademark term scan 仍明确 deferred，未伪装成交付
- Slice 14：Claude audit P1 hardening 已完成；`check:public-release` 现在补上低误报 license / trademark guard：`LICENSE` / `NOTICE` / projected `package.json` Apache-2.0 基线、public source conflicting SPDX header、Helm registered mark usage、以及 `Powered by Helm` runtime-force claim；仍不做高噪音 per-file missing-header 扫描，也不替代法务 trademark clearance
- Blocker：`check:secret-history` 已存在且本轮复跑仍失败；需要 owner 完成凭据轮换确认、public mirror history rewrite / clean receipt 和受控 force-push，本分支不自动改写 git history

### Phase 2

- Tenant Overlay schema / loader / docs 规划
- i18n request / user / workspace fallback 调研
- 状态：Local contract / workspace shell, server loader, detail page adoption and query/action/API guardrails complete; action request-cookie reads eliminated; API workspace-default message paths inventoried, owner-mapped, and first helper adoption started; cookie writes remain for public / workspace locale sync
- Slice 1：Tenant Overlay 最小 contract 已完成；新增 `lib/tenant-overlays/contract.ts`、validator、request/user/workspace/default locale fallback helper 与 `docs/product/HELM_TENANT_OVERLAY_CONTRACT.md`，当前不接 runtime loader、DB schema、API、UI、Pack SDK 或 marketplace
- Slice 2：Deployment Profile 最小 contract 已完成；新增 `lib/deployment-profile/contract.ts` 与 `docs/product/HELM_DEPLOYMENT_PROFILE_CONTRACT.md`，并接入 `npm run validate:env`，未知 profile / region / residency / locale fail closed；profile 仍不承担 license / security / source / entitlement 边界
- Slice 2b：Deployment Profile region / data residency inverse conflict 已完成；`HELM_DEPLOYMENT_REGION` 与 `HELM_DATA_RESIDENCY` 现在必须一致（`cn/cn` 或 `global/global`），避免 CN 部署声明 global residency 或 global 部署声明 CN residency
- Slice 3：i18n fallback repo-truth audit 已完成；新增 `docs/product/HELM_I18N_FALLBACK_AUDIT.md`，明确当前 cookie / workspace default / deployment profile / tenant overlay / message bundle 的真实入口与下一层 `resolveWorkspaceUiLocale()` 收口建议
- Slice 4：i18n fallback helper 已完成；新增 `resolveWorkspaceUiLocale()` 与 `lib/i18n/config.test.ts`，只建立 request / user / workspace / tenant overlay / deployment profile / engine fallback 顺序，不迁移页面、不拆 message bundle
- Slice 5：workspace runtime 接入已完成；`lib/workspace-ops.ts` 兼容新 fallback helper，`lib/i18n/request-locale.server.ts` 收口 request cookie 读取，workspace shell / provider、dashboard / internal operating / approvals / meetings / memory loaders 与 `normalizeWorkspaceUiConfig()` server page 调用点已按 request / workspace / deployment profile / engine 顺序解析 locale
- Slice 6：workspace detail/list page 接入已完成；`resolveWorkspaceUiLocaleForRequest()` 统一读取 request cookie、workspace default 与 deployment profile default，companies / contacts detail loaders、customer-facing detail pages、search、mobile、customer-success 与 tenant-private readout 不再手写 cookie-only fallback；actions、loading / not-found、query locale contract 与 message bundle 分层当时继续 deferred
- Slice 7：raw locale boundary guard 已完成；`lib/i18n/workspace-locale-boundary.test.ts` 固定 raw `resolveUiLocale()` 与 direct request-locale cookie read allowlist，防止 workspace pages / page-loaders 重新绕开 request + workspace + deployment fallback；loading / not-found allowlist 已在 Slice 17 移除
- Slice 8：Tenant Overlay read-only resolver 已完成；新增 `lib/tenant-overlays/resolver.ts`，按 `tenantKey` 从候选 overlay catalog 中选择 read-only runtime view，`not_found` 安全返回，matching invalid overlay / duplicate tenant key fail closed；不读 env / 文件 / DB，不 dereference opaque refs，不启用 extension，不修改 workspace
- Slice 9：query locale boundary guard 已完成；新增 `lib/i18n/query-locale-boundary.test.ts`，固定 `data/` 与 `features|lib` query modules 不允许读取 request cookie、`next/headers`、`helm-ui-locale` 或 raw `resolveUiLocale()`，query locale 只能由 caller 显式传入或来自 workspace data
- Slice 10：action locale boundary guard 已完成；新增 `lib/i18n/action-locale-boundary.test.ts`，把现有 action 层 request-locale cookie 与 raw `resolveUiLocale()` 使用固定到显式 allowlist，防止新的 mutation 路径继续扩散 legacy cookie fallback；后续仍需把非 auth / public onboarding action 迁移到显式 locale 输入或 workspace data
- Slice 11：CSV preview action locale 显式输入已完成；`features/imports/imports-client.tsx` 从 `useWorkspaceUi()` 传入 locale，`features/imports/actions.ts` 的 preview mutation 不再读取 `helm-ui-locale` request cookie；真实导入 action 继续使用 workspace default locale，避免扩大权限 / billing / import 行为面
- Slice 12：trial application action locale 显式输入已完成；`app/trial/page.tsx` 解析 public locale 后传给 `TrialApplicationForm`，submit action 随 input 接收 locale，不再读取 request cookie；该切片不改变 trial persistence、邮件通知、自动开通或 invite-only 边界
- Slice 13：public program application submit locale 显式输入已完成；`ProgramApplicationForm` 随 submit payload 传入 page locale，`submitProgramApplicationAction` 不再读取 request cookie；内部 review / invite action 已在 Slice 15 继续收口
- Slice 14：participant portal onboarding/profile locale 显式输入已完成；portal onboarding 与 portal profile update client 随 action payload 传入 locale，`features/participant-portal/actions.ts` 不再读取 request cookie；管理端 issue / status action 继续按 workspace default locale 处理权限与错误文案
- Slice 15：program application review / invite locale 显式输入已完成；settings client 随 review / invite action payload 传入 locale，`features/programs/actions.ts` 不再读取 request cookie；program actions 仍保留 raw resolver 只用于解析显式输入
- Slice 16：auth action request-cookie read 移除已完成；login / signup / phone-code / first-login identity completion 改为显式 locale 输入或 enrollment locale，`features/auth/actions.ts` 与 `features/settings/actions.ts` 不再读取 `helm-ui-locale` request cookie；auth / settings 仍保留 cookie 写入用于 public locale switch、login 后 locale 同步与 workspace 切换同步
- Slice 17：loading / not-found request-locale helper 接入已完成；新增 `resolveRequestUiLocale()`，public loading、demo/programs/portal loading、workspace loading、meeting detail loading 与 workspace not-found 不再直接读取 `helm-ui-locale`，并从 workspace raw resolver allowlist 移除
- Slice 18：API request-locale cookie guard 已完成；public OAuth DingTalk / WeCom start route 改走 `resolveRequestUiLocale()`，新增 `lib/i18n/api-locale-boundary.test.ts`，禁止 API route 读取 `helm-ui-locale` request cookie；WeCom callback 解析 OAuth state locale 作为唯一 raw resolver allowlist
- Slice 19：API workspace-default locale inventory 已完成；新增 [HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md](docs/product/HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md) 与 `lib/i18n/api-workspace-default-locale-inventory.test.ts`，固定 75 个 `app/api` route 通过 `Workspace.defaultLocale` / connector workspace default / session workspace default 切换错误或状态文案的 reviewed inventory；当前只做 inventory + guard，不迁移文案、不拆 message bundle、不建立 Edition / Pack / Cloud runtime 边界
- Slice 20：API message ownership map 已完成；在 [HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md](docs/product/HELM_API_WORKSPACE_DEFAULT_LOCALE_INVENTORY.md) 与 `lib/i18n/api-workspace-default-locale-inventory.test.ts` 中固定 15 个 domain owner key 和 owner count，作为后续抽取 auth / memory / imports / runtime / connector / tenant-private extension message helper 的归属清单；当前仍不迁移文案、不拆 message bundle、不改变 API 行为
- Slice 21：API-local workspace-default locale helper 首批接入已完成；新增 `lib/i18n/api-message-locale.ts` 与测试，提供 exact-match `isEnglishWorkspaceDefaultLocale()`；briefings / commitments / settings 首批 4 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper，inventory guard 同步升级为继续追踪 helper 化后的 `workspace.defaultLocale` 使用；当前不改 copy、不拆 message bundle、不改变 fallback 顺序
- Slice 22：API-local workspace-default locale helper 第二批接入已完成；blockers / recommendations 两个 owner 的 5 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper；累计 briefings / blockers / commitments / recommendations / settings 共 9 个 route 接入 helper；当前仍不改 copy、不拆 message bundle、不改变权限或 fallback 语义
- Slice 23：API-local workspace-default locale helper 第三批接入已完成；connectors owner 的 Google / HubSpot / Salesforce 3 个 OAuth start route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper；累计 briefings / blockers / commitments / connectors / recommendations / settings 共 12 个 route 接入 helper；当前不改变 OAuth state、cookie、provider config、权限判断或 redirect 语义
- Slice 24：API-local workspace-default locale helper 第四批接入已完成；imports owner 的 CRM preview / run / sync / conflict resolve / warmup 5 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper，并复用既有 `english` 变量处理 catch fallback 文案；累计 briefings / blockers / commitments / connectors / imports / recommendations / settings 共 17 个 route 接入 helper；当前不改变 CRM import、usage ledger、ownership guard、billing gate、revalidate 或 conflict resolution 语义
- Slice 25：API-local workspace-default locale helper 第五批接入已完成；runtime owner 的 meeting-ended ingest、meeting-facts confirm 与 DingTalk hourly sync 3 个 route 已从裸 `workspace.defaultLocale === "en-US"` / connector workspace default 比较迁移到 helper；累计 briefings / blockers / commitments / connectors / imports / recommendations / runtime / settings 共 20 个 route 接入 helper；当前不改变 cron token、DB 查询、read-only ingest、runtime review 权限、audit log 或 revalidate 语义
- Slice 26：API-local workspace-default locale helper 第六批接入已完成；llm owner 的 recommendation explain、object briefing 与 meeting memory process 3 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper；累计 briefings / blockers / commitments / connectors / imports / llm / recommendations / runtime / settings 共 23 个 route 接入 helper；当前不改变 LLM refresh、briefing generation、meeting-memory pipeline、ownership guard 或 insight / memory permission 语义
- Slice 27：API-local workspace-default locale helper 第七批接入已完成；conversation-capture owner 的 capture detail / result / start / stop / ingest 5 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper，并复用既有 `english` 变量处理 schema / catch fallback 文案；累计 briefings / blockers / commitments / connectors / conversation-capture / imports / llm / recommendations / runtime / settings 共 28 个 route 接入 helper；当前不改变 capture session、billing ledger、ownership guard、manual ingest、audio upload 或 transcript pipeline 语义
- Slice 28：API-local workspace-default locale helper 第八批接入已完成；auth owner 的 DingTalk / WeCom workspace OAuth start / callback 4 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper；累计 auth / briefings / blockers / commitments / connectors / conversation-capture / imports / llm / recommendations / runtime / settings 共 32 个 route 接入 helper；当前不改变 OAuth state cookie、callback context、token exchange、session provider、connector persistence、audit log 或 redirect 语义
- Slice 29：API-local workspace-default locale helper 第九批接入已完成；evolution owner 的 insights / patterns / delta events / skill suggestions / strategy suggestions 14 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper；累计 auth / briefings / blockers / commitments / connectors / conversation-capture / evolution / imports / llm / recommendations / runtime / settings 共 46 个 route 接入 helper；当前不改变 insight governance、policy governance、suggestion ownership、formal review 状态机、promotion guard 或 service mutation 语义
- Slice 30：API-local workspace-default locale helper 第十批接入已完成；memory owner 的 fact confirm / correct / delete / invalidate / create、memory export、meeting memory process、imported meeting-note process、OpenClaw sync / status 10 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper；累计 auth / briefings / blockers / commitments / connectors / conversation-capture / evolution / imports / llm / memory / recommendations / runtime / settings 共 56 个 route 接入 helper；当前不改变 memory fact mutation、ownership guard、export ledger、meeting-memory pipeline、OpenClaw runtime governance 或 sync 行为
- Slice 31：API-local workspace-default locale helper 第十一批接入已完成；helm-v2-runtime owner 的 runtime artifact / checkpoint / consolidation / context prune / meeting ingest / memory promote / problem-space / reflection / signal ingest / verification 17 个 route 已从裸 `workspace.defaultLocale === "en-US"` 迁移到 helper；累计 auth / briefings / blockers / commitments / connectors / conversation-capture / evolution / helm-v2-runtime / imports / llm / memory / recommendations / runtime / settings 共 73 个 route 接入 helper；当前不改变 Helm v2 runtime 状态机、队列、ownership guard、review / management 权限、runtime persistence 或 verification 语义
- Slice 32：API-local workspace-default locale helper 第十二批接入已完成；tenant-private-extension owner 的 account binding start / callback 2 个 route 已从 session workspace raw compare 迁移到 helper，并继续在 public docs 中只以 redacted descriptor 表达；75 个 reviewed API workspace-default 文案路径已全部接入 helper；当前不改变 tenant-private extension access gate、account binding redirect、mapping persistence、private integration runtime 或 public Pack / Edition 边界
- Slice 33：API workspace message resolver scaffold 已完成；`lib/i18n/api-message-locale.ts` 新增 `resolveApiWorkspaceMessage()` 与 `{ zh, en }` message pair 类型，复用 exact `en-US` workspace-default 规则供后续 owner-level domain message helper 包裹；当前不迁移 75 条 copy、不改 route 行为、不拆 message bundle、不建立 Pack / Edition / Cloud runtime 边界
- Slice 34：settings owner-level API message helper 首批接入已完成；新增 `lib/i18n/api-settings-messages.ts` 与测试，`app/api/settings/org-admin/support-pack/route.ts` 的 audit summary 从 route 内 inline 三元表达式迁移到 settings owner helper；权限 denied message 继续走既有 `settings-governance` helper，当前不改变 capability guard、audit payload、support-pack 生成、download header 或 message bundle 分层
- Slice 35：commitments owner-level API message helper 首批接入已完成；新增 `lib/i18n/api-commitment-messages.ts` 与测试，`app/api/commitments/[id]/status/route.ts` 的 workspace-default fallback 文案迁移到 commitment owner helper；create route 的固定 success/fallback 字符串继续 deferred，当前不改变 memory capability guard、ownership guard、commitment service 或 message bundle 分层
- Slice 36：blockers owner-level API message helper 首批接入已完成；新增 `lib/i18n/api-blocker-messages.ts` 与测试，`app/api/blockers/route.ts` 的 create fallback 文案迁移到 blocker owner helper；resolve / status route 的固定中文 fallback 与固定 success 字符串继续 deferred，当前不改变 memory capability guard、ownership guard、blocker service 或 message bundle 分层
- Slice 37：Claude audit remediation 已把 `HELM_DEFAULT_LOCALE` 页面 / loader 直读收口到 `getDeploymentProfileDefaultLocaleCandidate()`，并用 `workspace-locale-boundary.test.ts` 防回退；Tenant Overlay validator 增加裸 `entitlement` / `authority` / `approval` / `approve` 拦截；Deployment Profile `dataResidency` 注释明确为配置一致性提示而非数据隔离边界；Operating Signal Flow Map 的外部 locale 参数从 `english: boolean` 收口到 `UiLocale`，headline 改为 review-first advice wording
- Claude cross-check：Claude CLI 只读 review 已完成；已吸收 direct cookie read guard、customer-name CJK denylist 修正、nested package manifest scan fixture、feature entitlement grep guard、Dockerfile variant scan 与 Deployment Profile inverse conflict；暂无剩余 Claude review blocker 留在本轮 scope

### Phase 2C

- Codex / Claude collaboration protocol
- 状态：Completed
- Slice 1：协作协议已完成；新增 `docs/codex/CODEX_CLAUDE_COLLABORATION_PROTOCOL.md`，固定 Codex branch owner / integrator / final validator、Claude explorer / reviewer / bounded worker / docs-synthesizer 角色、handoff packet、accept / rewrite / reject / defer 吸收规则、多轮互搏、失败率控制和完成定义
- Slice 2：协作协议静态测试已完成；新增 `lib/codex-claude-collaboration-protocol.test.ts`，固定角色边界、handoff packet 字段、吸收状态、失败控制和 docs index 链接

### Phase 3

- 触发条件满足后切 `helm-enterprise` / `helm-cloud` private repo
- 状态：Deferred

## 5. 验证

- `git diff --check`
- `npm run check:public-release`
- `npm run test -- lib/public-release-guard.test.ts lib/public-package-manifest-builder.test.ts`
- `npm run test -- lib/public-mirror-preflight.test.ts lib/public-package-manifest-builder.test.ts lib/public-mirror-extensions-stub.test.ts`
- `npm run test -- lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-mirror-extensions-stub.test.ts lib/public-package-manifest-builder.test.ts lib/public-release-guard.test.ts`
- `npm run test -- lib/public-mirror-tree-builder.test.ts lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-release-guard.test.ts`
- `npm run test -- lib/public-release-guard.test.ts`
- `npm run test -- lib/release-readiness-check.test.ts`
- `npm run test -- lib/public-mirror-clean-receipt-builder.test.ts lib/release-readiness-check.test.ts`
- `npm run test -- lib/public-mirror-clean-receipt-checker.test.ts lib/release-readiness-check.test.ts`
- `npm run test -- lib/codex-claude-collaboration-protocol.test.ts`
- `npx eslint scripts/public-release-guard.ts lib/public-release-guard.test.ts`
- `npx eslint scripts/check-public-mirror-tree.ts scripts/public-release-guard.ts scripts/build-public-mirror-preflight.ts lib/public-mirror-tree-verifier.test.ts lib/public-release-guard.test.ts`
- `npx eslint scripts/build-public-mirror-tree.ts lib/public-mirror-tree-builder.test.ts scripts/public-release-guard.ts`
- `npx eslint scripts/build-public-mirror-clean-receipt.ts lib/public-mirror-clean-receipt-builder.test.ts`
- `npx eslint scripts/check-public-mirror-clean-receipt.ts lib/public-mirror-clean-receipt-checker.test.ts`
- `npm run public-mirror:package-json -- --out /tmp/helm-public-package-manifest.json`
- `npm run public-mirror:preflight -- --mirror-root <temp-mirror-root>`
- `npm run public-mirror:preflight:check -- --mirror-root <temp-mirror-root>`
- `npm run public-mirror:build -- --mirror-root <temp-mirror-root>`
- `npm run public-mirror:clean-receipt -- --receipt-id <temp-id> --source-ref <ref> --mirror-root <temp-mirror-root> --out <temp-receipt-json>`
- `npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:<temp-id> --repo-root <temp-receipt-repo-root>`
- `npm run public-mirror:verify -- --mirror-root <temp-mirror-root>`
- `npm run public-mirror:extensions-stub:check`
- `npm run check:boundaries`
- `npm run check:secret-history`
- `npm run test -- lib/tenant-overlays/contract.test.ts`
- `npm run test -- lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`
- `npm run test -- lib/deployment-profile/contract.test.ts`
- `npm run test -- lib/i18n/config.test.ts`
- `npm run test -- lib/i18n/config.test.ts lib/workspace-ops.test.ts lib/tenant-overlays/contract.test.ts lib/deployment-profile/contract.test.ts`
- `npm run validate:env`
- `npx eslint lib/tenant-overlays/contract.ts lib/tenant-overlays/contract.test.ts`
- `npx eslint lib/tenant-overlays/resolver.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.ts lib/tenant-overlays/contract.test.ts`
- `npx eslint lib/deployment-profile/contract.ts lib/deployment-profile/contract.test.ts scripts/validate-env.ts`
- `npx eslint lib/i18n/config.ts lib/i18n/config.test.ts lib/workspace-ops.ts lib/workspace-ops.test.ts features/dashboard/page-loader.ts features/internal-operating-workspace/page-loader.ts lib/tenant-overlays/contract.ts lib/deployment-profile/contract.ts scripts/validate-env.ts`
- `npx eslint app/(workspace)/layout.tsx app/(workspace)/reports/page.tsx app/(workspace)/companies/page.tsx app/(workspace)/contacts/page.tsx app/(workspace)/capture/page.tsx app/(workspace)/diagnostics/page.tsx app/setup/page.tsx features/approvals/page-loader.ts features/meetings/page-loader.ts features/memory/page-loader.ts features/dashboard/page-loader.ts features/internal-operating-workspace/page-loader.ts lib/i18n/config.ts lib/workspace-ops.ts lib/workspace-ops.test.ts`
- `npm run test -- extensions/guangpu/tests/reports-page.extensions.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`
- `npm run test -- features/search/ask-helm-entry-surfaces.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts`
- `npm run test -- lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`
- `npm run test -- lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts`
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts`
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts`
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts`
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`
- `npx eslint lib/i18n/request-locale.server.ts features/companies/page-loader.ts features/contacts/page-loader.ts app/(workspace)/proposals/page.tsx app/(workspace)/proposals/[id]/page.tsx app/(workspace)/external-proposals/[id]/page.tsx app/(workspace)/commercial-strengthening/[id]/page.tsx app/(workspace)/packages/[id]/page.tsx app/(workspace)/sendability/[id]/page.tsx app/(workspace)/follow-ups/[id]/page.tsx app/(workspace)/offers/[id]/page.tsx app/(workspace)/external-narratives/[id]/page.tsx app/(workspace)/conversations/[id]/page.tsx app/(workspace)/success-checks/[id]/page.tsx app/(workspace)/customer-success/page.tsx app/(workspace)/customer-success/[id]/page.tsx app/(workspace)/expansion-reviews/[id]/page.tsx app/(workspace)/review-requests/[id]/page.tsx app/(workspace)/reinforcements/[id]/page.tsx app/(workspace)/inbox/[id]/page.tsx app/(workspace)/search/page.tsx app/(workspace)/mobile/page.tsx app/(workspace)/guangpu/midun/readout/page.tsx`
- `npx eslint lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts`
- `npx eslint lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts`
- `npx eslint features/imports/actions.ts features/imports/imports-client.tsx lib/i18n/action-locale-boundary.test.ts`
- `npx eslint app/trial/page.tsx features/trial/actions.ts features/trial/data.ts features/trial/trial-application-form.client.tsx lib/i18n/action-locale-boundary.test.ts`
- `npx eslint features/programs/actions.ts features/programs/program-application-form.tsx lib/i18n/action-locale-boundary.test.ts`
- `npx eslint features/participant-portal/actions.ts features/participant-portal/participant-portal-client.tsx features/participant-portal/participant-portal-onboarding-client.tsx lib/i18n/action-locale-boundary.test.ts`
- `npx eslint features/programs/actions.ts features/programs/program-application-form.tsx features/settings/settings-client.tsx lib/i18n/action-locale-boundary.test.ts`
- `npm run test -- features/auth/actions.test.ts lib/i18n/action-locale-boundary.test.ts`
- `npx eslint features/auth/actions.ts features/auth/actions.test.ts features/auth/login-panel.tsx features/auth/first-login-identity-completion-panel.tsx components/auth/simplified-login-panel.tsx app/page.tsx app/demo/page.tsx lib/i18n/action-locale-boundary.test.ts`
- `npx eslint lib/i18n/request-locale.server.ts lib/i18n/workspace-locale-boundary.test.ts app/loading.tsx app/demo/loading.tsx app/programs/loading.tsx app/portal/loading.tsx 'app/(workspace)/loading.tsx' 'app/(workspace)/meetings/[id]/loading.tsx' 'app/(workspace)/not-found.tsx'`
- `npm run test -- lib/i18n/api-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts`
- `npx eslint lib/i18n/api-locale-boundary.test.ts app/api/public-auth/dingtalk/start/route.ts app/api/public-auth/wecom/start/route.ts`
- `npm run test -- lib/i18n/api-workspace-default-locale-inventory.test.ts`
- `npx eslint lib/i18n/api-workspace-default-locale-inventory.test.ts`
- `npm run self-check`
- `npm run quality:regression`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run typecheck`
- `test -f docs/codex/CODEX_CLAUDE_COLLABORATION_PROTOCOL.md`
- `test -f docs/internal/HELM_OPEN_CORE_ARCHITECTURE_ADR_V1.md`
- `test -f docs/reviews/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE_CLOSEOUT.md`
- `rg -n "HELM_DEPLOYMENT_PROFILE=|光谱租户|Deployment Profile 是构建|Tenant Manifest loader|license 服务由 Helm 运营|30/60/90" docs/internal/HELM_OPEN_CORE_ARCHITECTURE_ADR_V1.md`

当前验证结果：

- `git diff --check`：PASS
- `npm run check:public-release`：PASS（clean source；本轮复跑 scanned 3490 files / 0 blockers）
- `npm run check:public-release` after private `npm run build`：FAIL（预期风险暴露；私有全量 `.next` source maps 含 tenant-private paths / slugs / customer-name artifacts，不能作为 public mirror artifact 发布）
- `npm run test -- lib/public-release-guard.test.ts lib/public-package-manifest-builder.test.ts`：PASS
- `npm run test -- lib/public-mirror-preflight.test.ts lib/public-package-manifest-builder.test.ts lib/public-mirror-extensions-stub.test.ts`：PASS
- `npm run test -- lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-mirror-extensions-stub.test.ts lib/public-package-manifest-builder.test.ts lib/public-release-guard.test.ts`：PASS（5 files / 35 tests；覆盖 public mirror tree verifier、preflight、registry stub、package projection 与 public-release guard）
- `npm run test -- lib/public-mirror-tree-builder.test.ts lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-release-guard.test.ts`：PASS（4 files / 33 tests；覆盖 public mirror builder 复制、排除、projection、verify 与危险路径拒绝）
- `npm run test -- lib/public-release-guard.test.ts`：PASS（22 tests，覆盖 source map / SBOM / Docker context / Dockerfile variant / artifact customer-name scan、commercial entitlement boundary misuse scan）
- `npm run test -- lib/release-readiness-check.test.ts`：PASS（10 tests；覆盖 7 个 receipt truth、mirror-clean receipt JSON schema、matching receiptId、public-mirror:build / verify command evidence 与 forged receipt reject）
- `npm run test -- lib/public-mirror-clean-receipt-builder.test.ts lib/release-readiness-check.test.ts`：PASS（2 files / 13 tests；覆盖 clean receipt builder 成功生成、脱敏路径、重复 receipt 拒绝、mirror verify 失败不落盘，以及 release readiness receipt schema）
- `npm run test -- lib/public-mirror-clean-receipt-checker.test.ts lib/release-readiness-check.test.ts`：PASS（2 files / 14 tests；覆盖 clean receipt 独立校验、`mirror-clean:` id normalize、缺失文件与 forged command evidence reject）
- `npm run test -- lib/public-mirror-clean-receipt-checker.test.ts lib/public-mirror-clean-receipt-builder.test.ts lib/release-readiness-check.test.ts lib/public-mirror-tree-builder.test.ts lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-release-guard.test.ts`：PASS（7 files / 50 tests；覆盖 clean receipt checker / builder、release receipt schema、mirror build / verify / preflight 与 public-release guard）
- `npm run test -- lib/codex-claude-collaboration-protocol.test.ts`：PASS（4 tests；覆盖 Codex / Claude 角色边界、handoff packet、吸收状态、失败控制与 docs index 链接）
- `npm run test -- lib/codex-claude-collaboration-protocol.test.ts lib/release-readiness-check.test.ts lib/public-mirror-tree-builder.test.ts lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-release-guard.test.ts`：PASS（6 files / 47 tests）
- `npm run public-mirror:package-json -- --out /tmp/helm-public-package-manifest.json`：PASS（显式输出到 `/tmp`；未改写真实 private worktree）
- `npm run public-mirror:preflight -- --mirror-root <temp-mirror-root>`：PASS（只写临时 mirror root）
- `npm run public-mirror:preflight:check -- --mirror-root <temp-mirror-root>`：PASS
- `npm run public-mirror:build -- --mirror-root <temp-mirror-root>`：PASS（当前完整 worktree 临时 mirror build smoke；copied 2966 files / 570 directory entries，skipped 12，preflight=0，verify=0，scanned 2964）
- `npm run public-mirror:clean-receipt -- --receipt-id <temp-id> --source-ref <ref> --mirror-root <temp-mirror-root> --out <temp-receipt-json>`：PASS（当前完整 worktree 临时 receipt smoke；scanned 2968，receipt command 脱敏为 `<candidate>`，未写入本机临时路径）
- `npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:<temp-id> --repo-root <temp-receipt-repo-root>`：PASS（临时 repo receipt smoke；验证 existing receipt path、schema 与 public mirror build evidence）
- `npm run public-mirror:verify -- --mirror-root <temp-mirror-root>`：PASS（显式 mirror root；preflight projection 后验证 package / registry projection 与 private roots absent）
- `npm run check:boundaries`：PASS（保留既有 warn-mode spawn inventory）
- `npm run check:secret-history`：FAIL（63 reachable findings；3 个已知 2026-04-27 RDS root credential leak commits 仍可从 HEAD / main / origin refs 到达；需外部 remediation）
- `npm run test -- lib/tenant-overlays/contract.test.ts`：PASS（7 tests，覆盖 overlay shape、locale fallback、white-label grant、authority denylist 与 opaque refs）
- `npm run test -- lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`：PASS（4 files / 21 tests；覆盖 Tenant Overlay read-only resolver、contract、i18n fallback 与 workspace UI config）
- `npm run test -- lib/deployment-profile/contract.test.ts`：PASS（6 tests，覆盖默认 profile、CN enterprise、global cloud、未知值 fail-closed、region / data residency 双向冲突）
- `npm run test -- lib/i18n/config.test.ts`：PASS（5 tests，覆盖 legacy resolver、supported locale、fallback order、unknown request 不抢先覆盖 deployment default）
- `npm run test -- lib/i18n/config.test.ts lib/workspace-ops.test.ts lib/tenant-overlays/contract.test.ts lib/deployment-profile/contract.test.ts`：PASS（20 tests，覆盖 i18n fallback、workspace UI config、tenant overlay、deployment profile）
- `npm run validate:env`：FAIL（裸跑因既有 `CONNECTOR_TOKEN_SECRET` 为空失败；与 Deployment Profile 无关）
- `CONNECTOR_TOKEN_SECRET=<local-32-char-placeholder> npm run validate:env`：PASS（保留 OPTIONAL_AI warning）
- `CONNECTOR_TOKEN_SECRET=<local-32-char-placeholder> HELM_RELEASE_PROFILE=licensed npm run validate:env`：FAIL（预期 fail-closed，报 `DEPLOYMENT_PROFILE: HELM_RELEASE_PROFILE`）
- `CONNECTOR_TOKEN_SECRET=<local-32-char-placeholder> HELM_DEPLOYMENT_REGION=cn HELM_DATA_RESIDENCY=global npm run validate:env`：FAIL（预期 fail-closed，报 `DEPLOYMENT_PROFILE: HELM_DATA_RESIDENCY`）
- `CONNECTOR_TOKEN_SECRET=<local-32-char-placeholder> HELM_DEPLOYMENT_REGION=cn HELM_DATA_RESIDENCY=cn npm run validate:env`：PASS（保留 OPTIONAL_AI warning；CN region / CN residency 合法）
- `npx eslint lib/tenant-overlays/contract.ts lib/tenant-overlays/contract.test.ts`：PASS
- `npx eslint lib/tenant-overlays/resolver.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.ts lib/tenant-overlays/contract.test.ts`：PASS
- `npx eslint lib/deployment-profile/contract.ts lib/deployment-profile/contract.test.ts scripts/validate-env.ts`：PASS
- `npx eslint scripts/public-release-guard.ts lib/public-release-guard.test.ts`：PASS
- `npx eslint scripts/check-public-mirror-tree.ts scripts/public-release-guard.ts scripts/build-public-mirror-preflight.ts lib/public-mirror-tree-verifier.test.ts lib/public-release-guard.test.ts`：PASS
- `npx eslint scripts/build-public-mirror-tree.ts lib/public-mirror-tree-builder.test.ts scripts/public-release-guard.ts`：PASS
- `npx eslint scripts/build-public-mirror-clean-receipt.ts lib/public-mirror-clean-receipt-builder.test.ts`：PASS
- `npx eslint scripts/check-public-mirror-clean-receipt.ts lib/public-mirror-clean-receipt-checker.test.ts scripts/release-readiness-check.ts lib/release-readiness-check.test.ts`：PASS
- `npx eslint lib/i18n/config.ts lib/i18n/config.test.ts lib/workspace-ops.ts lib/workspace-ops.test.ts features/dashboard/page-loader.ts features/internal-operating-workspace/page-loader.ts lib/tenant-overlays/contract.ts lib/deployment-profile/contract.ts scripts/validate-env.ts`：PASS
- `npx eslint app/(workspace)/layout.tsx app/(workspace)/reports/page.tsx app/(workspace)/companies/page.tsx app/(workspace)/contacts/page.tsx app/(workspace)/capture/page.tsx app/(workspace)/diagnostics/page.tsx app/setup/page.tsx features/approvals/page-loader.ts features/meetings/page-loader.ts features/memory/page-loader.ts features/dashboard/page-loader.ts features/internal-operating-workspace/page-loader.ts lib/i18n/config.ts lib/workspace-ops.ts lib/workspace-ops.test.ts`：PASS
- `npm run test -- extensions/guangpu/tests/reports-page.extensions.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`：PASS（11 tests；覆盖 request-locale helper 不再让 direct page invocation 因 Next request scope 缺失失败）
- `npm run test -- features/search/ask-helm-entry-surfaces.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts`：PASS（40 tests；命令面板保留 `buildAskHelmHref` 路由但面向用户显示为 Ask workspace / 问当前工作区）
- `npm run test -- lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`：PASS（3 files / 10 tests；固定 raw `resolveUiLocale()` 与 direct request-locale cookie read allowlist）
- `npm run test -- lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（6 files / 24 tests；固定 data / query modules 不读 request cookie locale，并覆盖 workspace locale 与 Tenant Overlay resolver）
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`：PASS（5 files / 14 tests；固定 action 层 request-locale cookie / raw resolver allowlist、query 层无 request cookie dependency 与 workspace fallback helper）
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts`：PASS（6 files / 17 tests；覆盖 action/query/workspace locale guard、workspace fallback helper 与 Guangpu readout request-scope fallback）
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts`：PASS（7 files / 19 tests；覆盖 action/query/workspace locale guard、trial/imports action locale 显式输入相关边界、Guangpu readout 与 Ask Helm entry guard）
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts`：PASS（8 files / 23 tests；覆盖 action/query/workspace locale guard、显式 locale action 迁移边界、Guangpu readout、Ask Helm entry guard 与 Codex/Claude protocol）
- `npm run test -- lib/i18n/workspace-locale-boundary.test.ts lib/public-release-guard.test.ts`：PASS（2 files / 24 tests；覆盖 Claude review 后的 locale allowlist、CJK customer-name denylist 修正、nested package manifest scan fixture 与 commercial entitlement boundary misuse scan）
- `npm run test -- lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts lib/public-release-guard.test.ts`：PASS（4 files / 32 tests）
- `npm run test -- lib/public-release-guard.test.ts lib/deployment-profile/contract.test.ts`：PASS（2 files / 28 tests；覆盖 public-release guard 增量与 Deployment Profile 双向 region / residency conflict）
- `npm run test -- lib/public-mirror-tree-verifier.test.ts lib/public-mirror-preflight.test.ts lib/public-mirror-extensions-stub.test.ts lib/public-package-manifest-builder.test.ts lib/public-release-guard.test.ts lib/deployment-profile/contract.test.ts`：PASS（6 files / 41 tests；覆盖 public mirror verifier、public-release guard 与 Deployment Profile）
- `npm run test -- lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts`：PASS（5 files / 51 tests）
- `npx eslint lib/i18n/request-locale.server.ts features/companies/page-loader.ts features/contacts/page-loader.ts app/(workspace)/proposals/page.tsx app/(workspace)/proposals/[id]/page.tsx app/(workspace)/external-proposals/[id]/page.tsx app/(workspace)/commercial-strengthening/[id]/page.tsx app/(workspace)/packages/[id]/page.tsx app/(workspace)/sendability/[id]/page.tsx app/(workspace)/follow-ups/[id]/page.tsx app/(workspace)/offers/[id]/page.tsx app/(workspace)/external-narratives/[id]/page.tsx app/(workspace)/conversations/[id]/page.tsx app/(workspace)/success-checks/[id]/page.tsx app/(workspace)/customer-success/page.tsx app/(workspace)/customer-success/[id]/page.tsx app/(workspace)/expansion-reviews/[id]/page.tsx app/(workspace)/review-requests/[id]/page.tsx app/(workspace)/reinforcements/[id]/page.tsx app/(workspace)/inbox/[id]/page.tsx app/(workspace)/search/page.tsx app/(workspace)/mobile/page.tsx app/(workspace)/guangpu/midun/readout/page.tsx`：PASS
- `npx eslint lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/tenant-overlays/resolver.ts lib/tenant-overlays/resolver.test.ts`：PASS
- `npx eslint lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts`：PASS
- `npx eslint features/imports/actions.ts features/imports/imports-client.tsx lib/i18n/action-locale-boundary.test.ts`：PASS
- `npx eslint app/trial/page.tsx features/trial/actions.ts features/trial/data.ts features/trial/trial-application-form.client.tsx lib/i18n/action-locale-boundary.test.ts`：PASS
- `npx eslint features/programs/actions.ts features/programs/program-application-form.tsx lib/i18n/action-locale-boundary.test.ts`：PASS
- `npx eslint features/participant-portal/actions.ts features/participant-portal/participant-portal-client.tsx features/participant-portal/participant-portal-onboarding-client.tsx lib/i18n/action-locale-boundary.test.ts`：PASS
- `npx eslint features/programs/actions.ts features/programs/program-application-form.tsx features/settings/settings-client.tsx lib/i18n/action-locale-boundary.test.ts`：PASS
- `npm run test -- lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（10 files / 36 tests；覆盖 action/query/workspace locale guard、participant / program explicit locale migration、Guangpu readout、Ask Helm entry guard、Codex/Claude protocol 与 Tenant Overlay）
- `npm run test -- features/auth/actions.test.ts lib/i18n/action-locale-boundary.test.ts`：PASS（2 files / 23 tests；覆盖 auth verification / signup / first-login identity action 显式 locale contract，并固定 action 不再读取 request locale cookie）
- `npx eslint features/auth/actions.ts features/auth/actions.test.ts features/auth/login-panel.tsx features/auth/first-login-identity-completion-panel.tsx components/auth/simplified-login-panel.tsx app/page.tsx app/demo/page.tsx lib/i18n/action-locale-boundary.test.ts`：PASS
- `npm run test -- features/auth/actions.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（11 files / 56 tests；覆盖 auth action explicit locale、action/query/workspace locale guard、Guangpu readout、Ask Helm entry guard、Codex/Claude protocol 与 Tenant Overlay）
- `npm run test -- features/auth/actions.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（12 files / 59 tests；覆盖 auth action explicit locale、API/action/query/workspace locale guard、Guangpu readout、Ask Helm entry guard、Codex/Claude protocol 与 Tenant Overlay）
- `npm run test -- lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts`：PASS（3 files / 10 tests；覆盖 loading / not-found raw resolver allowlist 收窄后 workspace locale guard 仍成立）
- `npx eslint lib/i18n/request-locale.server.ts lib/i18n/workspace-locale-boundary.test.ts app/loading.tsx app/demo/loading.tsx app/programs/loading.tsx app/portal/loading.tsx 'app/(workspace)/loading.tsx' 'app/(workspace)/meetings/[id]/loading.tsx' 'app/(workspace)/not-found.tsx'`：PASS
- `npm run test -- lib/i18n/api-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts`：PASS（3 files / 9 tests；覆盖 API route request-locale cookie 禁止、workspace loading allowlist 收窄与 action request-cookie read 禁止）
- `npx eslint lib/i18n/api-locale-boundary.test.ts app/api/public-auth/dingtalk/start/route.ts app/api/public-auth/wecom/start/route.ts`：PASS
- `npm run test -- lib/i18n/api-workspace-default-locale-inventory.test.ts`：PASS（1 file / 3 tests；扫描 `app/api` workspace-default locale 文案路径、reviewed inventory 文件存在性与 public-safe 文档同步）
- `npm run test -- lib/i18n/api-workspace-default-locale-inventory.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（13 files / 62 tests；覆盖 API workspace-default inventory、API/action/query/workspace locale guard、auth explicit locale、Guangpu readout、Ask Helm entry guard、Codex/Claude protocol 与 Tenant Overlay）
- `npx eslint lib/i18n/api-workspace-default-locale-inventory.test.ts`：PASS
- `npm run test -- lib/i18n/api-workspace-default-locale-inventory.test.ts`：PASS（1 file / 5 tests；新增 15 个 domain owner key 与 owner count drift guard）
- `npm run test -- lib/i18n/api-workspace-default-locale-inventory.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（13 files / 64 tests；覆盖 API workspace-default inventory + owner map、API/action/query/workspace locale guard、auth explicit locale、Guangpu readout、Ask Helm entry guard、Codex/Claude protocol 与 Tenant Overlay）
- `npm run lint`：PASS（最终态复跑；仅保留既有 Babel deoptimised styling notes）
- `npm run test -- lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts`：PASS（2 files / 6 tests；覆盖 API-local exact-match helper 与 inventory guard）
- `npm run test -- lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（14 files / 65 tests；覆盖 API helper adoption、API workspace-default inventory + owner map、API/action/query/workspace locale guard、auth explicit locale、Guangpu readout、Ask Helm entry guard、Codex/Claude protocol 与 Tenant Overlay）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts 'app/api/briefings/meeting/[meetingId]/route.ts' app/api/settings/org-admin/support-pack/route.ts app/api/commitments/route.ts 'app/api/commitments/[id]/status/route.ts'`：PASS
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"' 'app/api/briefings/meeting/[meetingId]/route.ts' app/api/settings/org-admin/support-pack/route.ts app/api/commitments/route.ts 'app/api/commitments/[id]/status/route.ts'`：PASS（no matches；4 个首批 route 已无裸比较）
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"' app/api/blockers app/api/recommendations`：PASS（no matches；blockers / recommendations 共 5 个 route 已无裸比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts app/api/blockers/route.ts 'app/api/blockers/[id]/resolve/route.ts' 'app/api/blockers/[id]/status/route.ts' app/api/recommendations/next-actions/route.ts 'app/api/recommendations/[id]/feedback/route.ts'`：PASS
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"' app/api/connectors`：PASS（no matches；Google / HubSpot / Salesforce 3 个 connector start route 已无裸比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts app/api/connectors/google/start/route.ts app/api/connectors/hubspot/start/route.ts app/api/connectors/salesforce/start/route.ts`：PASS
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"' app/api/imports`：PASS（no matches；CRM preview / run / sync / conflict resolve / warmup 5 个 route 已无裸比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts 'app/api/imports/jobs/[jobId]/warmup/route.ts' app/api/imports/crm/sync/route.ts app/api/imports/crm/run/route.ts 'app/api/imports/conflicts/[id]/resolve/route.ts' app/api/imports/crm/preview/route.ts`：PASS
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"|connector\.workspace\.defaultLocale\s*===\s*"en-US"' app/api/runtime app/api/llm`：PASS（no matches；runtime / llm 共 6 个 route 已无裸比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts app/api/runtime/events/meeting-ended/route.ts app/api/runtime/memory/meeting-facts/confirm/route.ts app/api/runtime/dingtalk/hourly-sync/route.ts 'app/api/llm/recommendations/[recommendationId]/explain/route.ts' 'app/api/llm/briefings/[objectType]/[objectId]/route.ts' 'app/api/llm/meetings/[meetingId]/process-memory/route.ts'`：PASS
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"|connector\.workspace\.defaultLocale\s*===\s*"en-US"' app/api/conversation-capture`：PASS（no matches；conversation-capture 5 个 route 已无裸比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts 'app/api/conversation-capture/[sessionId]/route.ts' 'app/api/conversation-capture/[sessionId]/results/route.ts' 'app/api/conversation-capture/[sessionId]/stop/route.ts' app/api/conversation-capture/start/route.ts app/api/conversation-capture/ingest/route.ts`：PASS
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"|connector\.workspace\.defaultLocale\s*===\s*"en-US"' app/api/auth`：PASS（no matches；DingTalk / WeCom workspace OAuth 4 个 route 已无裸比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts app/api/auth/dingtalk/start/route.ts app/api/auth/dingtalk/callback/route.ts app/api/auth/wecom/start/route.ts app/api/auth/wecom/callback/route.ts`：PASS
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"|connector\.workspace\.defaultLocale\s*===\s*"en-US"' app/api/evolution`：PASS（no matches；evolution 14 个 route 已无裸比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts app/api/evolution/delta-events/route.ts app/api/evolution/insights/route.ts app/api/evolution/patterns/route.ts app/api/evolution/skill-suggestions/route.ts 'app/api/evolution/skill-suggestions/[id]/accept/route.ts' 'app/api/evolution/skill-suggestions/[id]/approve-formal-review/route.ts' 'app/api/evolution/skill-suggestions/[id]/defer-formal-review/route.ts' 'app/api/evolution/skill-suggestions/[id]/dismiss/route.ts' 'app/api/evolution/skill-suggestions/[id]/queue-formal-review/route.ts' 'app/api/evolution/skill-suggestions/[id]/reject-formal-review/route.ts' 'app/api/evolution/skill-suggestions/[id]/return-hardening/route.ts' app/api/evolution/strategy-suggestions/route.ts 'app/api/evolution/strategy-suggestions/[id]/accept/route.ts' 'app/api/evolution/strategy-suggestions/[id]/dismiss/route.ts'`：PASS
- `npm run test -- lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（14 files / 65 tests；evolution helper slice 后复跑；同时补回 docs/README.md 对 Codex/Claude 协作协议的索引）
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"|connector\.workspace\.defaultLocale\s*===\s*"en-US"|\(session\.workspace as \{ defaultLocale\?: string \| null \}\)\.defaultLocale\s*===\s*"en-US"' app/api`：PASS（no matches；75 个 reviewed API workspace-default 文案路径已无裸英文比较）
- `npx eslint app/api/helm-v2/runtime app/api/extensions/guangpu/midun-integrate/accountBinding`：PASS
- `npm run test -- lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（14 files / 65 tests；75/75 API-local helper adoption 后复跑）
- `npm run test -- lib/i18n/api-message-locale.test.ts`：PASS（1 file / 2 tests；覆盖 exact-match helper 与 `{ zh, en }` message pair resolver scaffold）
- `npm run test -- lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts`：PASS（2 files / 7 tests；覆盖 API message resolver scaffold 与 inventory guard）
- `rg -n 'workspace\.defaultLocale\s*===\s*"en-US"|connector\.workspace\.defaultLocale\s*===\s*"en-US"|\(session\.workspace as \{ defaultLocale\?: string \| null \}\)\.defaultLocale\s*===\s*"en-US"' app/api`：PASS（no matches；message resolver scaffold 未重新引入 raw API workspace-default 英文比较）
- `npx eslint lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts`：PASS
- `npm run test -- lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（14 files / 66 tests；message resolver scaffold 后复跑）
- `npm run typecheck`：PASS
- `npm run self-check`：PASS（58 / 58）
- `npm run check:boundaries`：PASS（保留既有 2 项 warn-mode spawn inventory，无新 failure）
- `npm run lint`：PASS（仅保留既有 Babel deoptimised styling notes）
- `npm run build`：PASS
- `npm run quality:regression`：PASS（32 files / 127 tests）
- `rm -rf .next && npm run check:public-release && git diff --check && test ! -d .next`：PASS（public-release scanned 3507 files；最终无 private `.next` artifact；diff whitespace clean）
- `npm run test -- lib/i18n/api-settings-messages.test.ts lib/i18n/api-message-locale.test.ts lib/auth/org-admin-support-pack-route.test.ts`：PASS（3 files / 5 tests；覆盖 settings owner helper、API-local resolver 与 support-pack route audit summary）
- `npx eslint lib/i18n/api-settings-messages.ts lib/i18n/api-settings-messages.test.ts lib/i18n/api-message-locale.ts lib/i18n/api-message-locale.test.ts app/api/settings/org-admin/support-pack/route.ts lib/auth/org-admin-support-pack-route.test.ts`：PASS
- `npm run test -- lib/i18n/api-settings-messages.test.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts lib/auth/org-admin-support-pack-route.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（16 files / 69 tests；settings owner helper 后复跑）
- `npm run typecheck`：PASS（settings owner helper 后复跑）
- `npm run self-check`：PASS（58 / 58；settings owner helper 后复跑）
- `npm run check:boundaries`：PASS（settings owner helper 后单独复跑；保留既有 2 项 warn-mode spawn inventory，无新 failure）
- `npm run lint`：PASS（settings owner helper 后复跑；仅保留既有 Babel deoptimised styling notes）
- `npm run build`：PASS（settings owner helper 后复跑）
- `npm run quality:regression`：PASS（32 files / 127 tests；settings owner helper 后复跑）
- `rm -rf .next && npm run check:public-release && git diff --check && test ! -d .next`：PASS（settings owner helper 后最终 public-release / whitespace / private artifact closeout）
- `npm run test -- lib/i18n/api-commitment-messages.test.ts lib/i18n/api-message-locale.test.ts lib/memory/write-governance-routes.test.ts`：PASS（3 files / 7 tests；覆盖 commitment owner helper 与 status route fallback）
- `npx eslint lib/i18n/api-commitment-messages.ts lib/i18n/api-commitment-messages.test.ts 'app/api/commitments/[id]/status/route.ts' lib/memory/write-governance-routes.test.ts`：PASS（路径引用修正后复跑；首轮未引用方括号路径导致 zsh glob 失败，不是代码失败）
- `npm run test -- lib/i18n/api-commitment-messages.test.ts lib/i18n/api-settings-messages.test.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts lib/memory/write-governance-routes.test.ts lib/auth/org-admin-support-pack-route.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（18 files / 74 tests；commitment owner helper 后复跑）
- `npm run typecheck`：PASS（commitment owner helper 后复跑）
- `npm run self-check`：PASS（58 / 58；commitment owner helper 后复跑）
- `npm run check:boundaries`：PASS（commitment owner helper 后复跑；保留既有 2 项 warn-mode spawn inventory，无新 failure）
- `npm run lint`：PASS（commitment owner helper 后复跑；仅保留既有 Babel deoptimised styling notes）
- `npm run build`：PASS（commitment owner helper 后复跑）
- `npm run quality:regression`：PASS（32 files / 127 tests；commitment owner helper 后复跑）
- `rm -rf .next && npm run check:public-release && git diff --check && test ! -d .next`：PASS（commitment owner helper 后最终 public-release / whitespace / private artifact closeout）
- `npm run test -- lib/i18n/api-blocker-messages.test.ts lib/i18n/api-message-locale.test.ts lib/memory/write-governance-routes.test.ts`：PASS（3 files / 8 tests；覆盖 blocker owner helper 与 create route fallback）
- `npx eslint lib/i18n/api-blocker-messages.ts lib/i18n/api-blocker-messages.test.ts app/api/blockers/route.ts lib/memory/write-governance-routes.test.ts`：PASS
- `npm run test -- lib/i18n/api-blocker-messages.test.ts lib/i18n/api-commitment-messages.test.ts lib/i18n/api-settings-messages.test.ts lib/i18n/api-message-locale.test.ts lib/i18n/api-workspace-default-locale-inventory.test.ts lib/memory/write-governance-routes.test.ts lib/auth/org-admin-support-pack-route.test.ts lib/i18n/api-locale-boundary.test.ts lib/i18n/action-locale-boundary.test.ts lib/i18n/query-locale-boundary.test.ts lib/i18n/workspace-locale-boundary.test.ts lib/i18n/config.test.ts lib/workspace-ops.test.ts features/auth/actions.test.ts extensions/guangpu/tests/reports-page.extensions.test.ts features/search/ask-helm-entry-surfaces.test.ts lib/codex-claude-collaboration-protocol.test.ts lib/tenant-overlays/resolver.test.ts lib/tenant-overlays/contract.test.ts`：PASS（19 files / 76 tests；blocker owner helper 后复跑）
- `npm run typecheck`：PASS（blocker owner helper 后复跑）
- `npm run self-check`：PASS（58 / 58；blocker owner helper 后复跑）
- `npm run check:boundaries`：PASS（blocker owner helper 后复跑；保留既有 2 项 warn-mode spawn inventory，无新 failure）
- `npm run lint`：PASS（blocker owner helper 后复跑；仅保留既有 Babel deoptimised styling notes）
- `npm run build`：PASS（blocker owner helper 后复跑）
- `npm run quality:regression`：PASS（32 files / 127 tests；blocker owner helper 后复跑）
- `rm -rf .next && npm run check:public-release && git diff --check && test ! -d .next`：PASS（blocker owner helper 后最终 public-release / whitespace / private artifact closeout；首轮清理等待刚结束的 `next build` 释放 `.next/lock` 后复跑通过）
- `npx tsx -e "import { runOperatingSignalFlowEval } from './lib/evals/operating-signal-flow-evals'; ..."`：PASS（Operating Signal Flow Phase 0/1 offline fixture pack；用于恢复 typecheck 缺失 fixture blocker）
- `npm run test -- lib/evals/operating-signal-flow-evals.test.ts`：PASS（1 file / 8 tests；覆盖 offline fixture pack、highest-pressure path、fixture posture、LLM transition/ranking 与 cross-workspace projection guard）
- `npx eslint lib/evals/operating-signal-flow-evals.ts lib/evals/operating-signal-flow-evals.test.ts scripts/operating-signal-flow-evals.ts`：PASS
- `npm run test -- lib/evals/operating-signal-flow-evals.test.ts lib/operating-signal-flow/projection.test.ts features/internal-operating-workspace/operating-signal-flow-map.test.tsx`：PASS（3 files / 14 tests；覆盖 offline evaluator、shared fixture projection 与 `/operating` read-only fixture UI）
- `npx eslint lib/evals/operating-signal-flow-evals.ts lib/evals/operating-signal-flow-evals.test.ts lib/operating-signal-flow/contract.ts lib/operating-signal-flow/projection.ts lib/operating-signal-flow/projection.test.ts features/internal-operating-workspace/operating-signal-flow-map.tsx features/internal-operating-workspace/operating-signal-flow-map.test.tsx scripts/decision-first-boundary-check.ts`：PASS
- `npx tsx scripts/operating-signal-flow-evals.ts`：PASS（15 cases；7 signal families；10 blockers；22 required states；0 LLM ranking / authority leak / cross-workspace projection）
- `npm run typecheck`：PASS
- `npm run build`：PASS（Next build 成功；生成的 private `.next` artifact 不作为 public mirror artifact）
- `npm run check:public-release`：PASS（scanned 3495 files；inventory doc/test 使用 redacted tenant-private descriptors，不暴露租户私有 slug）
- `npm run build`：PASS（Next build 成功；生成的 private `.next` sourcemap 含 tenant-private source path，已在最终 public-release guard 前删除，不作为 public mirror artifact）
- `rm -rf .next && npm run check:public-release`：PASS（scanned 3504 files；no public-mirror blockers）
- `test ! -d .next`：PASS（最终状态无 private `.next` artifact）
- `rm -rf .next && npm run check:public-release`：PASS（auth helper slice 后复跑；scanned 3504 files；no public-mirror blockers）
- `git diff --check`：PASS（auth helper slice 后复跑）
- `test ! -d .next`：PASS（auth helper slice 后最终状态无 private `.next` artifact）
- `rm -rf .next && npm run check:public-release && git diff --check`：PASS（clean source tree scanned 3495 files；无 public-mirror blockers；diff whitespace clean）
- `npm run check:public-release`：PASS（scanned 3493 files；no public-mirror blockers）
- `git diff --check`：PASS
- `npm run self-check`：PASS（58 / 58）
- `npm run check:boundaries`：PASS（本轮复跑；保留既有 2 项 warn-mode spawn inventory，无新 failure）
- `npm run typecheck`：PASS（75/75 API helper adoption 与 Operating Signal Flow shared projection 收口后复跑）
- `npm run check:boundaries`：PASS（Operating Signal Flow 保持 fixture-backed read-only UI prototype；无 API / schema / runtime query / LLM call / type escape）
- `npm run quality:regression`：PASS（32 files / 127 tests）
- `npm run lint`：PASS
- `npm run lint`：PASS（最终态复跑；仅保留既有 Babel deoptimised styling notes）
- `npm run test`：FAIL（581 files；4168 passed / 15 failed；失败集中在 6 个 DB-backed Helm v2 runtime test files，错误均为 Prisma `Authentication failed against database server` / 当前 `root` DB 凭据无效，非本轮 request-locale / open-core contract 回归）
- `npm run build`：PASS
- `npm run build`：PASS（最终态复跑；Next build 成功；生成的 private `.next` 已在 public-release guard 前删除）
- `rm -rf .next && npm run check:public-release`：PASS（scanned 3507 files；no public-mirror blockers）
- `test ! -d .next`：PASS（最终状态无 private `.next` artifact）
- `npm run typecheck`：PASS
- `test -f docs/codex/CODEX_CLAUDE_COLLABORATION_PROTOCOL.md`：PASS（Codex / Claude 协作协议已落地并进入 docs/codex index）
- `test -f docs/internal/HELM_OPEN_CORE_ARCHITECTURE_ADR_V1.md`：PASS（internal-only；不进入 public docs index）
- `test -f docs/reviews/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE_CLOSEOUT.md`：PASS（本轮 closeout 已落地并进入 docs index / STATUS）
- `rg -n "HELM_DEPLOYMENT_PROFILE=|光谱租户|Deployment Profile 是构建|Tenant Manifest loader|license 服务由 Helm 运营|30/60/90" docs/internal/HELM_OPEN_CORE_ARCHITECTURE_ADR_V1.md`：PASS（无命中；退出码 1 为 rg no-match 语义）
- `npm run public-mirror:extensions-stub:check`：预期失败于 private worktree registry `not-stub`；本分支不替换 `lib/extensions/registry.tsx`

---

# Internal Commercialization Lifecycle Runtime Slice

更新时间：2026-05-11
状态：Implementation in progress / Helm reserved workspace only
当前切片：`offline commercialization lifecycle -> narrow schema -> internal fixture connector -> read-only API -> /operating board`

## 1. 目标

把 Helm 自身经营租户的商业化流程升级成最小可运行切片：管理 AI 服务商候选池、Daily Top 3、1 小时诊断、7 天试跑、4 周试点、复盘报告和 customer-to-channel gate，但只作为 Helm reserved workspace 的 read-only control layer，不做自动执行平面。

## 2. 影响面

- `prisma/schema.prisma`
- `prisma/schema.sqlite.prisma`
- `prisma/migrations/*`
- `lib/internal-commercialization/*`
- `app/api/internal-commercialization/*`
- `features/internal-operating-workspace/*`
- `docs/product/HELM_INTERNAL_TENANT_COMMERCIALIZATION_REQUIREMENTS.md`
- `docs/README.md`
- `docs/STATUS.md`
- `scripts/helm-self-check-refactored.ts`

## 3. 关键假设

1. Owner 已接受最小 runtime/API/UI/schema/connector 升级，但只授权 alias-only read model 和 internal fixture connector。
2. Schema 不关联真实 Contact / Company / Opportunity，避免把服务商背后的客户机会误升级成 Helm 直接客户真相。
3. API 只允许 reserved workspace 读取 readout；connector Web 端点只做 dry-run；显式 apply 收口到 CLI + `HELM_INTERNAL_COMMERCIALIZATION_APPLY=1` 双 gate，只写内部窄表和 audit。
4. UI 只读展示 lifecycle board，不出现 send / book / publish / dispatch / write / trigger / request 类外部动作。
5. review-first、recommendation != commitment、no auto-send、no silent CRM write、no workflow/orchestration、no generic agent platform 持续为硬边界。

## 4. 切片

### Slice 1

- 新增 `InternalCommercializationRun` 窄表、枚举和迁移；同步 MySQL / SQLite schema。

### Slice 2

- 新增 runtime readout builder、fixture connector mapper、alias-only / review-safe action guard 和 targeted tests。

### Slice 3

- 新增 read-only API 与 internal fixture connector dry-run API，保留 reserved workspace + contribution registry capability gate；apply 只走 gated CLI。

### Slice 4

- 在 `/operating` 接入 read-only lifecycle board；同步 requirements、docs index、STATUS 和 self-check。

### Slice 5

- 跑 `db:generate`、targeted tests、eval、自检、boundary、typecheck、lint，并让 Claude / Reviewer 回看实现。

## 5. 验证方案

- `npm run db:generate`
- `npm run eval:internal-commercialization`
- `npm run eval:internal-ai-service-providers`
- `npm run test -- lib/evals/internal-commercialization-evals.test.ts lib/internal-commercialization/fixture-connector.test.ts lib/internal-commercialization/runtime.test.ts`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`

# Guangpu Signal Collection Unified Scheduler v1

更新时间：2026-05-09
状态：Implementation in progress / Guangpu as first tenant example
当前切片：`core signal collection scheduler -> Guangpu BI/MiDun job descriptors -> compatibility cron wrappers -> unified cron route`

## 1. 目标

把 Guangpu / MiDun 经营信号采集从多个独立 cron 发起点收敛为统一的 Helm signal collection 调度合同：Helm core 只负责调度、鉴权、运行汇总和可观测性；租户 extension 只负责声明 job descriptor、target resolver 和实际 runner。

## 2. 影响面

- `lib/signal-collection/*`
- `lib/extensions/registry.tsx`
- `instrumentation.ts`
- `app/api/runtime/signals/collect/route.ts`
- `extensions/guangpu/bi-report/lib/runtime/*`
- `extensions/guangpu/midun-integrate/lib/runtime/*`
- Guangpu BI / MiDun cron tests and route tests
- `.env.example`

## 3. 关键假设

1. Helm core 不直接 import `extensions/guangpu/*`；唯一 compile-time composition seam 仍是 `lib/extensions/registry.tsx`。
2. 本轮不新增 DB schema，不把 scheduler 做成 workflow engine，不做分布式锁；先用可测试的 in-process scheduler / route runner 合同收口。
3. Guangpu BI daily push 仍是正式 BI skill run；`p0-process-signals` 只保留 internal debug preview，debug persist 默认关闭。
4. MiDun case assignment 是 tenant operation side effect，不伪装成纯 signal read；descriptor 必须显式声明 side effect。
5. 统一调度入口可由应用内 scheduler 或外部 cron route 发起，但 job 列表、schedule、target resolver 和 runner 都来自同一套 descriptors。

## 4. 切片

### Slice 1

- 新增 core `SignalCollectionJob` contract、daily cron parser、target runner、summary、in-process scheduler state。

### Slice 2

- Guangpu BI / MiDun 各自声明 job descriptors，保留原 env key、默认时间和 allowlist/rentCode 解析。

### Slice 3

- `lib/extensions/registry.tsx` 暴露 registered jobs / run / scheduler start；`instrumentation.ts` 只在显式 env 开启时启动统一 scheduler。

### Slice 4

- 现有 Guangpu BI / MiDun cron 模块改成 core scheduler wrapper；新增 `/api/runtime/signals/collect` 统一 cron route。

### Slice 5

- 收紧 debug persist 默认关闭；更新 docs/env/tests，运行 targeted tests、typecheck、lint、boundary、build。

## 5. 验证方案

- `npm run test -- lib/signal-collection/scheduler.test.ts lib/signal-collection/cron-route.test.ts extensions/guangpu/bi-report/tests/collection-operating-signal-cron.test.ts extensions/guangpu/midun-integrate/tests/midun-integrate-cron.test.ts extensions/guangpu/bi-report/tests/p0-process-signals.route.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run check:boundaries`
- `npm run check:public-release`
- `npm run build`

# Guangpu Worker Training Offline Eval Gate v0

更新时间：2026-05-02
状态：Implementation in progress / offline-only
当前切片：`historical collection data -> redacted sample release report -> redacted sample prioritization -> redacted sample fixture -> worker training eval gate`

## 1. 目标

把“催收 worker 怎么训练”先收成可审计、可回归的离线训练观察与评估门禁：历史数据不能直接训练模型，必须先经过授权、脱敏、标注、正负样本判定和 no-side-effect gate。

## 2. 影响面

- `extensions/guangpu/docs/GUANGPU_WORKER_TRAINING_OBSERVATION_AND_EVAL_CONTRACT.md`
- `extensions/guangpu/docs/GUANGPU_WORKER_TRAINING_SAMPLE_RELEASE_GATE.md`
- `extensions/guangpu/docs/GUANGPU_WORKER_TRAINING_SAMPLE_PRIORITIZATION_GATE.md`
- `extensions/guangpu/workers/training/release-reports/*`
- `extensions/guangpu/workers/training/guangpu-worker-training-sample-release-gate.ts`
- `extensions/guangpu/workers/training/guangpu-worker-training-sample-release-gate.test.ts`
- `extensions/guangpu/workers/training/scripts/guangpu-worker-training-sample-release-gate.ts`
- `extensions/guangpu/workers/training/prioritization/*`
- `extensions/guangpu/workers/training/guangpu-worker-training-sample-prioritization-gate.ts`
- `extensions/guangpu/workers/training/guangpu-worker-training-sample-prioritization-gate.test.ts`
- `extensions/guangpu/workers/training/scripts/guangpu-worker-training-sample-prioritization-gate.ts`
- `extensions/guangpu/workers/training/evals/*`
- `extensions/guangpu/workers/training/guangpu-worker-training-evals.ts`
- `extensions/guangpu/workers/training/guangpu-worker-training-evals.test.ts`
- `extensions/guangpu/workers/training/scripts/guangpu-worker-training-evals.ts`
- `package.json`
- `docs/README.md`
- `docs/STATUS.md`
- `extensions/guangpu/README.md`
- `extensions/guangpu/workers/README.md`
- `scripts/helm-self-check*.ts`
- `scripts/decision-first-boundary-check.ts`

## 3. 关键假设

1. 这不是 production training pipeline，不接真实米盾 API / DB。
2. fixture 只能是 synthetic / redacted / alias-only，不放 raw audio、raw ASR、完整催记、手机号、身份证、银行卡、地址。
3. eval 只检查样本是否有资格成为训练候选或评估金标，不触发训练、不改 prompt、不晋级 worker。
4. PTP / contact / allocation / closure 四类 worker 都保持 preview-only、suggestion_only、no runtime、no ActionIntent、no 米盾写回、no 自动外呼。

## 4. 切片

### Slice 1

- 新增 sample release readiness gate：公司环境只能先产出 redacted release report，必须通过 owner approvals、raw PII scan、双人复核、outcome joins、撤回/销毁路径和 no-side-effect 检查。

### Slice 2

- 新增 8 条 synthetic / redacted fixture，覆盖 PTP、contact、allocation suppression、closure。
- 固化 gold positive / gold negative / review_only / not_eligible 四档样本资格。

### Slice 3

- 新增 pure evaluator 和 CLI：`npm run eval:guangpu-worker-training`。
- 检查 family coverage、授权、脱敏、evidence、raw PII leak、side-effect counters、正负样本合法性。

### Slice 4

- 新增 sample prioritization gate：release-ready redacted candidates 按 effectiveness / cost / risk penalty 排 P0/P1/P2/P3。
- P0 只允许低成本、低风险、高有效性的未来训练候选；投诉、停催、QC fail、合规阻断进入 guardrail / adversarial regression，不进入训练正样本。

### Slice 5

- 同步训练观察与离线评估契约、sample release gate、Guangpu README、workers README、STATUS、自检和 boundary guard。

## 5. 验证方案

- `npm run eval:guangpu-worker-training`
- `npm run eval:guangpu-worker-training-sample-release`
- `npm run eval:guangpu-worker-training-sample-prioritization`
- `npm run test -- extensions/guangpu/workers/training/guangpu-worker-training-evals.test.ts`
- `npm run test -- extensions/guangpu/workers/training/guangpu-worker-training-sample-release-gate.test.ts`
- `npm run test -- extensions/guangpu/workers/training/guangpu-worker-training-sample-prioritization-gate.test.ts`
- targeted ESLint for new eval files and changed guard files
- `npm run typecheck`
- `npm run check:boundaries`
- `npm run self-check`（本机若缺 `DATABASE_URL`，记录为环境缺口）
- `git diff --check`

# Guangpu Worker Group Local Enhancement v1

更新时间：2026-05-02
状态：Implementation in progress / runtime remains Phase 5 No-Go
当前切片：`BI worker cue -> worker readout bundle -> contact preparation semantics -> case-level PTP / closure cue contracts -> allocation suppression-only guard`

## 1. 目标

在不越过 Guangpu 租户 preview-only 边界的前提下，连续增强 worker 群的本地可验证能力：先把 BI cue、worker preview output、协作项、日看板和电话助手 brief 串成 readout bundle，再补齐 contact、PTP、closure、allocation 的最小安全增强。

## 2. 影响面

- `extensions/guangpu/bi-report/lib/runtime/*`
- `extensions/guangpu/bi-report/tests/*`
- `extensions/guangpu/workers/case-contact-pacing-driver-preview/*`
- `extensions/guangpu/workers/case-ptp-followup-driver-preview/*`
- `extensions/guangpu/workers/case-closure-suggester-preview/*`
- `extensions/guangpu/workers/case-allocation-driver-preview/*`
- `extensions/guangpu/workers/collaboration/*`
- `app/api/extensions/guangpu/bi-report/worker-cue-preview/route.ts`
- Guangpu worker / BI docs、README、self-check、boundary check

## 3. 关键假设

1. Guangpu worker 群仍是租户私有 preview-only 能力，不升级为 Helm 主体通用 worker。
2. 本轮只做 pure TS / tests / preview route readout / docs / guards，不写 DB、不写米盾、不注册 runtime、不生成 ActionIntent。
3. 当前 P0 BI aggregate 只能直接喂 contact-pacing / stewardship；PTP 和 closure 必须等待 case-level cue contract；allocation 只能接 suppression-only guard，不能从 aggregate 直接生成分案。
4. 所有输出保持 `suggestion_only`、`externalSideEffectAllowed=false`、`active` 被拒绝，observer / shadow 不等于执行授权。
5. 公司环境只用于真实 redacted sample、米盾字段口径、主管接受/拒绝结果和后续 shadow/active 校准，本地不伪造生产结论。

## 4. 切片

### Slice 1

- 新增 worker readout bundle：`workerCues -> workerResults -> collaborationItems -> dailyBoard -> phoneAssistBrief`
- 保持 route 兼容，并让 preview API 返回 readout bundle

### Slice 2

- 收窄 contact-pacing 的 BI cue 输出文案：从“补触达”改为“时段准备 / 回执核对 / 话术预案”
- 固化 no-outbound / no-submit receipt 的测试

### Slice 3

- 新增 PTP case-level cue adapter
- 只接受具备 `caseId / ptpId / ownerEmpId / promisedDueAt` 等单案字段的 cue，aggregate cue 仍拒绝

### Slice 4

- 新增 closure case-level cue adapter
- 只接受 case repayment snapshot + QC refs，且 writeoff / finished 只作为 review candidate，不是结案或核销动作

### Slice 5

- 新增 allocation suppression-only guard
- BI aggregate 最多转换为 red-alert employee exclusion，不产生分案 proposal，不改 score，不写状态

### Slice 6

- 文档、README、STATUS、自检和 boundary guard 收口
- 运行 targeted validation，记录无法在本机完成的公司环境验证项

## 5. 验证方案

- `npm run test -- extensions/guangpu/bi-report/tests/worker-cue-readout-bundle.test.ts extensions/guangpu/bi-report/tests/worker-cue-runner.test.ts extensions/guangpu/bi-report/tests/collection-worker-consume-contract.test.ts extensions/guangpu/bi-report/tests/worker-cue-preview.route.test.ts`
- `npm run test -- extensions/guangpu/workers/case-contact-pacing-driver-preview/ extensions/guangpu/workers/case-ptp-followup-driver-preview/ extensions/guangpu/workers/case-closure-suggester-preview/ extensions/guangpu/workers/case-allocation-driver-preview/`
- `npm run test -- extensions/guangpu/workers/collaboration/projection.test.ts extensions/guangpu/workers/collaboration/daily-production-board.test.ts extensions/guangpu/workers/collaboration/phone-assist-brief.test.ts extensions/guangpu/workers/collaboration/observation-ledger.test.ts extensions/guangpu/workers/collaboration/shadow-readiness-review.test.ts`
- `npm run check:boundaries`
- `npm run typecheck`
- `git diff --check`

# Guangpu Worker Group Collaboration Revision v1

更新时间：2026-04-30
状态：Slice 5 implementation complete / runtime remains No-Go
当前切片：`Guangpu worker group -> collaboration projection + daily phone board + observation ledger + phone assist brief + shadow readiness review -> phone collection production loop`

## 1. 目标

站在 Guangpu 业务完整性和经营目标达成要求下，重新审计 worker 群、BI 经营信号、米盾资源接入、电话催收数字员工、主管 readout、质检复核和 closure chain 的协作关系，形成一套不越过 Phase 5 Review No-Go 的协作流转方案。

## 2. 影响面

- `extensions/guangpu/docs/GUANGPU_WORKER_GROUP_COLLABORATION_AUDIT_AND_REVISION_PLAN.md`
- `extensions/guangpu/workers/collaboration/projection.ts`
- `extensions/guangpu/workers/collaboration/projection.test.ts`
- `extensions/guangpu/workers/collaboration/daily-production-board.ts`
- `extensions/guangpu/workers/collaboration/daily-production-board.test.ts`
- `extensions/guangpu/workers/collaboration/observation-ledger.ts`
- `extensions/guangpu/workers/collaboration/observation-ledger.test.ts`
- `extensions/guangpu/workers/collaboration/phone-assist-brief.ts`
- `extensions/guangpu/workers/collaboration/phone-assist-brief.test.ts`
- `extensions/guangpu/workers/collaboration/shadow-readiness-review.ts`
- `extensions/guangpu/workers/collaboration/shadow-readiness-review.test.ts`
- `extensions/guangpu/README.md`
- `extensions/guangpu/workers/README.md`
- `extensions/guangpu/docs/PHONE_COLLECTION_DIGITAL_EMPLOYEE_PHASED_DELIVERY_PLAN.md`
- `extensions/guangpu/docs/PHONE_COLLECTION_DIGITAL_EMPLOYEE_MARKET_AND_PRODUCTION_PILOT_PLAN.md`

## 3. 关键假设

1. 当前 Guangpu worker 仍是 preview-only，不注册 runtime，不写米盾业务表，不调用非 GET，不产生外部副作用。
2. 电话催收 Phase 1 只能消费 observer-only worker observation 作为生产观察、主管 readout 和坐席准备证据。
3. 协作主干先作为 planning contract 和后续 pure projection 实现目标，不在本轮直接改 schema、route 或 runtime。
4. 合规阻断、投诉、停催、身份不明、第三方风险、频次/时间窗风险永远优先于回款优化。

## 4. 验证方案

- `git diff --check`
- `npm run test -- extensions/guangpu/workers/collaboration/projection.test.ts extensions/guangpu/workers/collaboration/daily-production-board.test.ts extensions/guangpu/workers/collaboration/observation-ledger.test.ts extensions/guangpu/workers/collaboration/phone-assist-brief.test.ts extensions/guangpu/workers/collaboration/shadow-readiness-review.test.ts extensions/guangpu/workers/worker-modes.test.ts extensions/guangpu/workers/lifecycle-objectives.test.ts extensions/guangpu/workers/case-allocation-driver-preview/decide.test.ts extensions/guangpu/workers/case-stewardship-driver-preview/decide.test.ts extensions/guangpu/workers/case-contact-pacing-driver-preview/decide.test.ts extensions/guangpu/workers/case-ptp-followup-driver-preview/decide.test.ts extensions/guangpu/workers/case-closure-suggester-preview/decide.test.ts`
- `npx eslint extensions/guangpu/workers/collaboration/projection.ts extensions/guangpu/workers/collaboration/projection.test.ts extensions/guangpu/workers/collaboration/daily-production-board.ts extensions/guangpu/workers/collaboration/daily-production-board.test.ts extensions/guangpu/workers/collaboration/observation-ledger.ts extensions/guangpu/workers/collaboration/observation-ledger.test.ts extensions/guangpu/workers/collaboration/phone-assist-brief.ts extensions/guangpu/workers/collaboration/phone-assist-brief.test.ts extensions/guangpu/workers/collaboration/shadow-readiness-review.ts extensions/guangpu/workers/collaboration/shadow-readiness-review.test.ts`
- `npm run typecheck`
- `npm run check:boundaries`

当前执行结果：Slice 5 targeted tests 1 file / 6 tests passed；worker full targeted tests 待本轮文档同步后复跑；targeted ESLint 通过；`npm run typecheck` 通过；`git diff --check` 通过；`npm run check:boundaries` 通过。实现保持 pure TS，不接 runtime、不落库、不写米盾、不注册 worker、不产生外部副作用；observation ledger 只生成脱敏对账事件和汇总读数，不训练、不晋级、不写回，且拒绝 active / observer 未压制 proposal、自由文本 reason/outcome、PII、同 key 碰撞、负向结果正样本、正向事实负样本，并阻止含负向观察的 summary 返回 review_ready；phone assist brief 只生成移动端/语音助手只读提示，不捕获债务人音频、不对债务人发声、不自动外呼；shadow readiness review 只生成主管人工评审候选包，不自动切 shadow、不生成 pending approval。

# Helm China Commercial Demo Seed Rebuild v1

更新时间：2026-04-29
状态：Implementation complete / DB seed held because DATABASE_URL is remote RDS
当前切片：`China B2B commercial demo seed -> sales conversion workspace`

## 1. 目标

把默认客户演示入口从泛角色样例收敛为最接近中国潜在客户采购与转化现场的企业软件 / AI 服务商务场景：客户会后 48 小时窗口、大客户 ROI 材料、老机会恢复、安全 / 法务 / 交付协同、外发复核和 CRM 信号转经营动作。

## 2. 影响面

- `prisma/seed.ts`
- `lib/demo/demo-modes.ts`
- `app/demo/start/route.ts`
- `app/demo/page.tsx`
- `app/page.tsx`
- Ask Helm / mobile / meeting runtime eval fixtures
- `docs/product/demo-script.md`

## 3. 关键假设

1. 本轮不改 schema、不新增真实客户、不接真实外部系统、不引入新依赖。
2. `helm-sales-demo` slug 保持稳定，避免破坏登录、pilot eval 和 demo start 入口。
3. 公开 demo 不使用 tenant-specific 私有 POC 名称或资料；所有客户、联系人、邮箱和域名均为虚构。
4. 默认演示先进入销售转化工作区；创始人 / COO 和猎头模式仍作为补充角色保留。

## 4. 验证方案

- `npm run test -- lib/demo/demo-modes.test.ts features/search/ask-helm-query-intent.test.ts features/search/ask-helm-interpreter.test.ts features/search/ask-helm-search-page-adapter.test.ts features/mobile/components/workspace-status.test.tsx features/mobile/components/must-push-card.test.tsx features/mobile/lib/adapt-ask-helm-response.test.ts lib/operating-system/index.test.ts`
- `npx eslint prisma/seed.ts lib/demo/demo-modes.ts data/constants.ts app/demo/start/route.ts app/demo/page.tsx app/page.tsx`
- `npm run typecheck`
- `git diff --check`
- DB seed 只在确认 `DATABASE_URL` 指向本机开发库后运行；如指向共享 / 远程库则不做破坏性 reset。

当前执行结果：

- `npm run test -- lib/demo/demo-modes.test.ts features/search/ask-helm-query-intent.test.ts features/search/ask-helm-interpreter.test.ts features/search/ask-helm-search-page-adapter.test.ts features/mobile/components/workspace-status.test.tsx features/mobile/components/must-push-card.test.tsx features/mobile/lib/adapt-ask-helm-response.test.ts lib/operating-system/index.test.ts lib/operating-system/audit-reason-chain.test.ts lib/presentation/detail-operating-summary-card.test.ts lib/gtm-customer-demand-brief-draft.test.ts lib/gtm-capability-plan-readout.test.ts features/inbox-followup-review-request/detail-model.test.ts features/internal-operating-workspace/display-copy.test.ts features/opportunities/display-copy.test.ts features/role-conversation-variants/display-copy.test.ts`：16 files / 86 tests passed
- `npm run test -- features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts features/business-advancement/ask-helm-interaction-offline-eval.test.ts`：3 files / 48 tests passed
- `npm run eval:ask-helm-query-intents`：38 / 38 passed
- `npm run eval:ask-helm-action-intents`：36 / 36 passed
- `npm run eval:ask-helm-voice`：OK
- `npm run eval:ask-helm`：OK
- `npm run eval:ask-helm-action-contract`：OK
- `npx eslint ...touched files...`：passed
- `git diff --check`：passed
- `npm run typecheck`：failed on existing unrelated Prisma client / trial schema drift and missing `pinyin-pro` / `yaml` type resolution; no failure points to this seed rebuild.
- `npm run check:boundaries`：failed on existing unrelated dashboard/page marker, trial/formal auth, skill-suggestion and Guangpu shared-layer boundary drift; no failure points to the new sales demo seed.
- DB seed not executed: current `DATABASE_URL` resolves to remote RDS `${HELM_DB_HOST}/helm2026`, not a local dev database.

# Helm Business Advancement Production Query Adoption + Reviewer Approval Gate v1

更新时间：2026-04-27
状态：Planning-only gate complete / runtime adoption remains No-Go
当前切片：`Production query adoption plan -> Required reviewer approval protocol`

## 1. 目标

把 Business Advancement runtime adoption 的两个未收口前置条件落成可验证 planning gate：production query adoption 必须有独立版本化 plan，required reviewer approval 必须有五个 canonical role 对同一 planVersion 的可审计 approval record。Ask Helm runtime adoption gate 不再接受只有 loose boolean 的 production query approval。

## 2. 影响面

- `features/business-advancement/production-query-adoption-approval-gate.ts`
- `features/business-advancement/production-query-adoption-approval-gate.test.ts`
- `features/business-advancement/redacted-real-data-calibration-package-gate.ts`
- `features/business-advancement/redacted-real-data-calibration-package-gate.test.ts`
- `features/business-advancement/ask-helm-interaction-runtime-adoption-gate.ts`
- `features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts`
- `scripts/business-advancement-production-query-adoption-approval-gate.ts`
- `scripts/business-advancement-redacted-real-data-calibration-package-gate.ts`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_REDACTED_REAL_DATA_CALIBRATION_PACKAGE_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PRODUCTION_QUERY_ADOPTION_PLAN_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_REQUIRED_REVIEWER_APPROVAL_PROTOCOL_V1.md`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PRODUCTION_QUERY_ADOPTION_AND_REVIEWER_APPROVAL_REPORT_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本轮只做 planning-only pure TS / tests / CLI / docs。
2. Production query adoption plan 可以点名未来 target file，但本轮不允许修改生产查询、API、Prisma、页面或 mobile read-model。
3. Required reviewer approval 只有五个 canonical roles 全部 `approved` 同一 planVersion 才有效；`conditional` 不算通过。
4. Positive fixture 最多返回 `Ready-For-Manual-Review`，仍不允许 runtime integration 或 production adoption。
5. Redacted real-data calibration 必须纳入同一前置包：Ask Helm interaction calibration 与 production query live DB calibration 的合同/工具链已实现，但 actual live evidence 尚未提交，仍阻断 runtime adoption。

## 4. 验证方案

- `npm run test -- features/business-advancement/redacted-real-data-calibration-package-gate.test.ts features/business-advancement/production-query-adoption-approval-gate.test.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts`
- `npx tsx scripts/business-advancement-redacted-real-data-calibration-package-gate.ts`
- `npx tsx scripts/business-advancement-redacted-real-data-calibration-package-gate.ts --positive-fixture --expect-ready`
- `npx tsx scripts/business-advancement-production-query-adoption-approval-gate.ts`
- `npx tsx scripts/business-advancement-production-query-adoption-approval-gate.ts --positive-fixture --expect-ready`
- `npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts --positive-fixture --expect-ready`
- `npx eslint ...touched files...`
- `git diff --check`
- `npm run check:boundaries`

当前执行结果：targeted tests 3 files / 40 tests passed；Business Advancement full tests 36 files / 1215 tests passed；redacted calibration package default 输出 No-Go、positive 输出 Ready-For-Manual-Review 且 production/runtime allowed 仍 false；production query approval gate default 输出 No-Go、positive 输出 Ready-For-Manual-Review 且 production/runtime allowed 仍 false；Ask Helm runtime adoption gate default / positive CLI 均按预期通过；Phase 3U 本机 preflight 因缺 `DATABASE_URL` / real workspaceId 正确 No-Go 且 no DB access / no files written；隔离本地 MySQL `helm2026_codex_ba_gate` 完成 `db:reset` / seed；full tests 400 files / 2810 tests passed；`self-check`、`check:boundaries`、`typecheck`、`lint`、`build`、`e2e`、`quality:regression` 均通过。E2E 日志仍有既有 MySQL 并发 `Record has changed since last read` 噪音，但 34/34 passed，且本轮未触碰相关 runtime 写路径。

## 5. 收口条件

1. Redacted real-data calibration package gate 落库。
2. Production query adoption plan / required reviewer approval protocol 落库。
3. Ask Helm runtime gate 消费 approval gate summary，而不是 loose boolean。
4. Docs index / Phase 1-3 requirements / closeout report 同步。
5. 不接 DB、schema、API、页面、runtime、production query 或 official write。

# Helm Business Advancement Ask Helm Interaction Redacted Calibration v1

更新时间：2026-04-27
状态：Evidence contract + evaluator complete / runtime adoption remains No-Go
当前切片：`Ask Helm Interaction Asset Capture -> Redacted Calibration`

## 1. 目标

补齐 Ask Helm Interaction Asset Capture 的 redacted calibration seam：让 runtime adoption gate 不再只看 loose boolean，而是消费结构化 calibration evaluation。默认 synthetic / local fixture 继续 No-Go；只有满足合同的 redacted real interaction snapshot 才能进入 `Ready-For-Manual-Review`，仍不允许 runtime integration 或 production adoption。

## 2. 影响面

- `features/business-advancement/ask-helm-interaction-redacted-calibration.ts`
- `features/business-advancement/ask-helm-interaction-redacted-calibration.test.ts`
- `features/business-advancement/ask-helm-interaction-runtime-adoption-gate.ts`
- `features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts`
- `scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts`
- `scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本刀只做 planning-only pure TS / tests / CLI / docs。
2. 旧 Phase 3O/3P 是 TPQR source-query calibration，不等于本次 Ask Helm Interaction Asset calibration。
3. Positive redacted fixture 是合同样例，不代表 actual live snapshot 已提交。
4. Actual live calibration evidence 仍需后续单独提供和审计。
5. 任何通过结果最多进入 manual runtime adoption review，不等于 production adoption。

## 4. 验证方案

- `npm run test -- features/business-advancement/ask-helm-interaction-redacted-calibration.test.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts --positive-fixture --expect-validated`
- `npx tsx scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts --local-fixture`
- `npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts --positive-fixture --expect-ready`
- `npx eslint ...touched files...`
- `git diff --check`
- `npm run check:boundaries`

当前执行结果：targeted tests 2 files / 31 tests passed；redacted calibration default / positive / local CLI 均按预期通过；runtime adoption gate default / positive CLI 均按预期通过；Business Advancement full tests 34 files / 1190 tests passed；`npm run eval:ask-helm` 通过；targeted ESLint、`git diff --check`、`check:boundaries` 通过；reviewer finding 已修（gate 校验 ruleVersion / posture / sampleKind / checks，redaction guard 扫动态 raw payload keys）；`self-check` 仅因本地 `DATABASE_URL` 未配置失败；`typecheck` 因既有 Prisma generated client 缺少 `MemoryDistillationCandidate*` 导出失败。

## 5. 收口条件

1. Redacted calibration evaluator / CLI / tests 落库。
2. Runtime gate 改为结构化 calibration evidence。
3. Docs report 与 docs index 同步。
4. 不接 DB、schema、API、页面、runtime、production query 或 official write。

# Helm Business Advancement Phase 1-3 Implementation Closeout v1

更新时间：2026-04-27
状态：Business Advancement Phase 1-3 planning chain complete / runtime adoption remains No-Go
当前切片：`Business Advancement Signal Contract -> Signal to Must Push Adapter -> Ask Helm Interaction Asset Capture`

## 1. 目标

收口本轮 Phase 1-3 implementation line：确认 Business Advancement 的 signal contract、Must Push adapter 基线，以及 Ask Helm Interaction Asset Capture 的 privacy / dedupe / threshold / offline eval / runtime adoption gate 已形成可验证 planning chain，同时明确 runtime adoption 仍 No-Go。

## 2. 影响面

- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_IMPLEMENTATION_CLOSEOUT_REPORT_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. Planning chain complete 不等于 production ready。
2. 没有 redacted real-data calibration，不能进入 runtime adoption。
3. Production query adoption 未经 required reviewers 批准且无独立 implementation plan，不能进入 runtime adoption。
4. Candidate 不是 task，review packet 不是 approval，Ready-For-Manual-Review 不是 Go。

## 4. 验证方案

- 复用本阶段四组 targeted tests / CLI evaluator / runtime gate CLI。
- `git diff --check`
- `npm run check:boundaries`
- `npm run self-check`
- `npm run typecheck`

当前执行结果：targeted tests 4 files / 62 tests passed；dedupe / merge、capture thresholds、offline eval、runtime adoption gate CLI 均按预期通过；targeted ESLint 通过；`git diff --check` 通过；`check:boundaries` 通过；`self-check` 仅因本地 `DATABASE_URL` 未配置失败；`typecheck` 因既有 Prisma generated client 缺少 `MemoryDistillationCandidate*` 导出失败，报错集中在 `features/memory/queries.ts(.test.ts)` 与 `lib/memory/distillation-candidate-store.ts(.test.ts)`，非本阶段新增文件。

## 5. 收口条件

1. 总关闭报告落库。
2. docs index 与需求文档同步为 planning chain complete / runtime adoption No-Go。
3. 工作树提交后保持干净，等待后续是否推远端 / 开 PR / 合入主干。

# Helm Business Advancement Phase 3 Runtime Adoption Gate v1

更新时间：2026-04-27
状态：Slice 5 implementation closeout / runtime adoption remains No-Go
当前切片：`Ask Helm Interaction Asset Capture -> Runtime Adoption Gate`

## 1. 目标

把 Business Advancement Product Phase 3 的 runtime adoption gate 落成 planning-only review packet：默认当前状态必须 No-Go；只有在 redacted real-data calibration、rollback / disable / audit、membership / capability、actionability、high-risk coverage、privacy / deletion、false-positive handling、operator workload 与 production query review 全部具备时，才可进入 `Ready-For-Manual-Review`，仍不得直接 Go。

## 2. 影响面

- `features/business-advancement/ask-helm-interaction-runtime-adoption-gate.ts`
- `features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts`
- `scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ADOPTION_GATE_REPORT_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本轮只做 planning-only pure TS / tests / CLI / docs，不做 runtime / schema / API / UI。
2. Default fixture 应返回 No-Go，因为缺 redacted real-data calibration，production query adoption 也未获 required-reviewer approval。
3. Positive fixture 最多返回 `Ready-For-Manual-Review`，仍不允许 runtime integration 或 production adoption。
4. Forbidden work 必须显式禁止 schema、API/page、runtime extractor/adapter、queue/worker、production query、official write 和 auto execution。

## 4. 验证方案

- `npm run test -- features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts --positive-fixture --expect-ready`
- `npx eslint features/business-advancement/ask-helm-interaction-runtime-adoption-gate.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts`
- `git diff --check`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`

当前执行结果：targeted test 14 项通过；default CLI 输出 No-Go / 2 blockers 且 exit 0；positive fixture 输出 Ready-For-Manual-Review / 0 blockers 且仍 `runtimeIntegrationAllowed=false` / `productionAdoptionAllowed=false`；targeted ESLint 通过；`git diff --check` 通过；`check:boundaries` 通过；`self-check` 仅因本地 `DATABASE_URL` 未配置失败；`typecheck` 因既有 Prisma generated client 缺少 `MemoryDistillationCandidate*` 导出失败，报错集中在 `features/memory/queries.ts(.test.ts)` 与 `lib/memory/distillation-candidate-store.ts(.test.ts)`，非本 Slice 新增文件。

## 5. 收口条件

1. Slice 5 gate / review packet / CLI 落库。
2. Default No-Go 与 positive Ready-For-Manual-Review 均可验证。
3. docs report 与 docs index 同步。
4. 本阶段停止在 planning chain complete；不接 DB、页面或 runtime。

# Helm Business Advancement Phase 3 Offline Eval v1

更新时间：2026-04-27
状态：Slice 4 implementation closeout / planning-only validation passed
当前切片：`Ask Helm Interaction Asset Capture -> Synthetic Fixtures + Offline Eval`

## 1. 目标

把 Slice 1 privacy / retention、Slice 2 dedupe / merge、Slice 3 threshold / eligibility 串成 planning-only synthetic fixture pack 与 offline evaluator，证明 Ask Helm interaction asset capture 的 P0 planning chain 可以被复核、去重、降级和拒绝。

## 2. 影响面

- `features/business-advancement/ask-helm-interaction-offline-eval.ts`
- `features/business-advancement/ask-helm-interaction-offline-eval.test.ts`
- `scripts/business-advancement-ask-helm-interaction-offline-eval.ts`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本轮只做 planning-only pure TS / tests / CLI / docs，不做 runtime / schema / API / UI。
2. Offline eval 必须复用 Slice 3 threshold evaluator，并把 eligible candidate 送入 Slice 2 dedupe / merge evaluator。
3. Raw audio、unconfirmed transcript、cross-workspace aggregation、open-domain active candidate、cross-workspace active candidate 必须在 candidate 创建前拒绝。
4. Redacted export 只能输出受限字段，不包含 raw prompt / body / audio / transcript。
5. 所有 promotion target 继续 review-first，runtime adoption 继续 No-Go。

## 4. 验证方案

- `npm run test -- features/business-advancement/ask-helm-interaction-offline-eval.test.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-offline-eval.ts`
- `npx eslint features/business-advancement/ask-helm-interaction-offline-eval.ts features/business-advancement/ask-helm-interaction-offline-eval.test.ts scripts/business-advancement-ask-helm-interaction-offline-eval.ts`
- `git diff --check`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`

当前执行结果：targeted test 15 项通过；CLI evaluator 全部 PASS，summary 为 eligible 8 / watch-only 4 / rejected 5 / merged 7 / signal attachment 1 / must-push attachment 1 / privacy violation 0 / boundary violation 0；targeted ESLint 通过；`git diff --check` 通过；`check:boundaries` 通过；`self-check` 仅因本地 `DATABASE_URL` 未配置失败；`typecheck` 因既有 Prisma generated client 缺少 `MemoryDistillationCandidate*` 导出失败，报错集中在 `features/memory/queries.ts(.test.ts)` 与 `lib/memory/distillation-candidate-store.ts(.test.ts)`，非本 Slice 新增文件。

## 5. 收口条件

1. Slice 4 pure helper / fixtures / evaluator / CLI 落库。
2. Targeted tests 和 evaluator CLI 通过。
3. docs report 与 docs index 同步。
4. 下一刀切到 Slice 5 Runtime Adoption Gate，仍不直接接 DB、页面或 runtime。

# Helm Business Advancement Phase 3 Capture Thresholds v1

更新时间：2026-04-27
状态：Slice 3 implementation closeout / planning-only validation passed
当前切片：`Ask Helm Interaction Asset Capture -> Threshold & Capture Eligibility`

## 1. 目标

把 Phase 3 的 capture threshold 与 eligibility 规则落成 planning-only 纯实现：repeated intent、boundary hit、abandoned high-confidence answer、plan / saved draft / review packet / handoff 都必须先经过 deterministic threshold gate；不满足条件的只能 watch-only 或 not eligible。

## 2. 影响面

- `features/business-advancement/ask-helm-interaction-capture-thresholds.ts`
- `features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts`
- `scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本轮只做 planning-only pure TS / tests / CLI / docs，不做 runtime / schema / API / UI。
2. repeated intent 使用 rolling 7 natural days / 3 occurrences；2 occurrences 只 watch-only。
3. boundary hit 只有 review-required execution / official write / send / approve / pay 被拦截时才 candidate；ordinary unsupported/open-domain 只 watch-only。
4. abandoned high-confidence answer 必须有 objectRef / evidenceRefs / action plan / next step / boundary note，且 telemetry 能证明没有 follow-through。
5. missing telemetry 和 weekend-only silence 均不能当作 abandonment。
6. plan / draft / handoff 必须有明确用户 generate / save / queue / request，并且步骤含 objectRef / DRI / due / evidence。

## 4. 验证方案

- `npm run test -- features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts`
- `npx eslint features/business-advancement/ask-helm-interaction-capture-thresholds.ts features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts`
- `git diff --check`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`

当前执行结果：targeted test 19 项通过；CLI evaluator 全部 PASS；targeted ESLint 通过；`git diff --check` 通过；`check:boundaries` 通过；`self-check` 仅因本地 `DATABASE_URL` 未配置失败；`typecheck` 因既有 Prisma generated client 缺少 `MemoryDistillationCandidate*` 导出失败，报错集中在 `lib/memory/distillation-candidate-store.ts(.test.ts)`，非本 Slice 新增文件。

## 5. 收口条件

1. Slice 3 pure helper / fixtures / evaluator / CLI 落库。
2. Targeted tests 和 evaluator CLI 通过。
3. docs report 与 docs index 同步。
4. 下一刀切到 Slice 4 Synthetic Fixtures + Offline Eval，仍不接 DB、页面或 runtime。

# Helm Business Advancement Phase 3 Dedupe Merge Strategy v1

更新时间：2026-04-27
状态：Slice 2 implementation closeout / planning-only validation passed
当前切片：`Ask Helm Interaction Asset Capture -> Phase 1-3 Dedupe / Merge Strategy`

## 1. 目标

把 Phase 1-3 的 candidate 去重与 evidence attachment 规则落成 planning-only 纯实现：同一 fingerprint 的 Ask Helm interaction asset candidate 可折叠；已被 existing `AdvancementSignal` / `MustPushItem` 覆盖的 candidate 只能附加为 evidence，不生成重复 active；boundary hit 只能增加 review reason，不能提升权限。

## 2. 影响面

- `features/business-advancement/ask-helm-interaction-dedupe-merge.ts`
- `features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts`
- `scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本轮只做 planning-only pure TS / tests / CLI / docs，不做 runtime / schema / API / UI。
2. fingerprint 使用 `workspaceId + actorScope + intentType + normalized objectRefs + captureReason + day bucket`。
3. Existing `AdvancementSignal` 和 `MustPushItem` 的 workspace / object linkage 通过 planning wrapper 表达，不修改现有 contract。
4. boundary hit merge output 只能作为 review reason / product friction evidence。
5. Slice 3 前不处理 threshold / abandonment / confidence fallback。

## 4. 验证方案

- `npm run test -- features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts`
- `npx tsx scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts`
- `npx eslint features/business-advancement/ask-helm-interaction-dedupe-merge.ts features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts`
- `git diff --check`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`

当前执行结果：targeted test / CLI / targeted ESLint / `git diff --check` / `check:boundaries` 通过；`self-check` 仅因本地 `DATABASE_URL` 未配置失败；`typecheck` 因既有 Prisma generated client 缺少 `MemoryDistillationCandidate*` 导出失败，报错集中在 `lib/memory/distillation-candidate-store.ts(.test.ts)`，非本 Slice 新增文件。

## 5. 收口条件

1. Slice 2 pure helper / fixtures / evaluator / CLI 落库。
2. Targeted tests 和 evaluator CLI 通过。
3. docs report 与 docs index 同步。
4. 下一刀切到 Slice 3 Threshold & Capture Eligibility，不接 DB、页面或 runtime。

# Helm Business Advancement Phase 3 Privacy Retention Spec v1

更新时间：2026-04-27
状态：Slice 1 privacy / retention spec accepted for planning-only implementation
当前切片：`Ask Helm Interaction Asset Capture -> Privacy & Retention Spec`

## 1. 目标

把二次评审批准后的 Slice 1 落成独立 product spec，冻结 Ask Helm interaction asset candidate 的 privacy、retention、deletion、export、visibility 和 reviewer capability 边界。

## 2. 影响面

- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1.md`
- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本轮只做 docs-only spec，不做 runtime / schema / API / UI。
2. `temporary_review_candidate` 的默认 TTL 固定为 user-only 7 natural days、reviewer queued 30 natural days。
3. `workspace_review_visible` 不是 workspace-wide visibility，只限 owner / admin / assigned reviewer。
4. reviewer 是 membership + capability + assignment 的组合，不是全局角色。
5. raw audio / unconfirmed transcript / complete chat history 永不进入 candidate。
6. abandonment 的 24h vs 3 business days 归 Slice 3 threshold spec；本轮只要求周末沉默不得自动升级 visibility。

## 4. 验证方案

- `git diff --check`
- `npm run self-check`
- `npm run check:boundaries`

## 5. 收口条件

1. Slice 1 privacy / retention spec 落库。
2. Phase 1-3 总需求文档指向 Slice 1 spec，并把下一刀切到 dedupe / merge。
3. docs index 同步。
4. 明确下一刀只做 Phase 1-3 Dedupe / Merge Strategy，不接 DB、页面或 runtime。

# Helm Business Advancement Phase 1-3 Requirements Design v1

更新时间：2026-04-27
状态：Requirements design / conditionally implementation-planning ready after review follow-through
当前切片：`Business Advancement Signal Contract -> Signal to Must Push Adapter -> Ask Helm Interaction Asset Capture`

## 1. 目标

把接下来要落地的三段产品能力收成一份可执行需求设计：

1. Phase 1：`Business Advancement Signal Contract`，回答 Helm 如何知道什么可能需要推进。
2. Phase 2：`Signal -> Must Push Adapter`，回答 Helm 如何把多源信号压缩成 3-5 个 Must Push。
3. Phase 3：`Ask Helm Interaction Asset Capture`，回答 Ask Helm 的重复意图、边界触碰、放弃高置信回答、计划/草稿/handoff 如何成为 reviewable candidate。

评审吸收后的关键结论：实现准备可以继续，但必须先完成 Phase 3 privacy / retention、Phase 1-3 dedupe / merge、threshold / capture eligibility 三个 P0 spec；否则不得启动 capture logic、persistence、surface adoption 或 runtime adoption。其中 Phase 3 privacy / retention 已由上方 Slice 1 spec 承接，剩余 P0 为 dedupe / merge 与 threshold / capture eligibility。

## 2. 影响面

- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 本轮只做需求准备和设计细化，不做 runtime / schema / API / UI。
2. 已有 Phase 1A / 1B、Phase 2、Phase 3 preflight/runtime review 事实必须复用，不重新发明对象体系。
3. 本文件里的 `Product Phase 3: Ask Helm Interaction Asset Capture` 不等于已有 Business Advancement runtime preflight 的 `Phase 3*` 文档链；它是产品队列里的 Ask Helm asset capture 需求。
4. Ask Helm interaction asset 默认是 reviewable candidate，不是聊天历史、official memory、formal skill 或 execution authority。
5. Phase 3 `temporary_review_candidate` 必须先定义 TTL、删除触发、导出格式和 `workspace_review_visible` capability 范围。
6. `AdvancementSignal`、`MustPushItem`、`AskHelmInteractionAssetCandidate` 必须先定义去重 / 合并策略，避免 candidate explosion。
7. LLM 只允许提供 bounded semantic factor，不允许成为 final ranking、active/deferred 或 review posture 裁决者。

## 4. 验证方案

- `git diff --check`
- `npm run self-check`
- `npm run check:boundaries`

## 5. 收口条件

1. 新 product 需求设计文档落库。
2. docs index 同步。
3. PLANS 顶部记录当前需求设计切片。
4. Phase 3 Privacy & Retention Spec 已由上方 Slice 1 spec 落库，不接 DB、页面或 runtime。
5. 明确下一刀做 Phase 1-3 Dedupe / Merge Strategy，之后做 Threshold & Capture Eligibility Spec；前三刀关闭后才进入 synthetic fixtures / offline eval。

# Helm Market Positioning And Business Advancement Upgrade v1

更新时间：2026-04-26
状态：Phase A documentation freeze（仅文档与上下文层 / 尚未触发 runtime / schema / API 改造）
当前切片：把 Helm 收口为「经营推进控制台 / 经营推进操作系统（受控试点）」，并把下一阶段 Business Advancement 队列固定为 Phase 1A contract+fixtures+offline eval、Phase 1B read-model feasibility、Phase 2 Signal -> Must Push Adapter、Phase 3 Ask Helm asset capture
基线提交：`origin/main@208ed1b5c fix: restore continuity runtime review surfaces`

## 1. 目标

1. 把对外定位从宽泛的「AI 经营协同操作系统」收口为「Helm 经营推进控制台 / 经营推进操作系统（受控试点）」
2. 把竞争边界、当前仓库现实、Helm 状态四类短表、Phase 1A / 1B / 2 / 3 队列、成功度量和 No-Go 条件汇总到一份可引用的 product 文档
3. 把 WORKING-CONTEXT.md 的当前路径、日期、Mobile Command Surface 已实现、E2E 验证现实、residual risk 和下一阶段优先级同步为当前主干口径
4. 在 PLANS.md 顶部记录本轮市场定位升级与 Business Advancement 下一阶段任务，但不广义改写历史 sprint 段
5. 不改任何 runtime TS 代码 / scripts / schema / API / page 行为；只做文档层和上下文层

## 2. 影响面（仅文档 / 上下文）

- `docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md`（新建）
- `docs/README.md`（在 product/strategy 段加入新文档索引）
- `WORKING-CONTEXT.md`（按当前主干现实重写）
- `PLANS.md`（仅顶部新增本轮切片）
- `README.md`（如有需要做最小化定位 wording 同步，否则不改）

## 3. 关键假设

1. 基线为 `origin/main@208ed1b5c`，分支 `codex/market-positioning-upgrade` 已与 origin/main 对齐
2. Mobile Command Surface 已实现并完成本地完整验证；旧版本里关于 DB-backed E2E 被 `${HELM_DB_HOST}` 阻断的描述按「历史 / 已 unblocked」处理
3. Business Advancement Phase 1A / 1B / 2 / 2B / 2C / 3 系列文档与 disabled-by-default seam prototype / Phase 3O / 3P 已存在，runtime adoption 维持 No-Go
4. Phase A 不批准 runtime extractor、schema 扩张、official write、自动执行、自动发送、page 行为变更或 production query adoption
5. 不引入 enterprise multi-org / 完整 workflow / agent platform / CRM / BI / chat 平台
6. Ask Helm 不持久化多轮聊天历史；`SkillSuggestionCandidate` 不自动晋升为 formal skill

## 4. 当前主干现实记录

1. 当前真实 Git 工作目录（canonical repo root）：`/Users/tommyqian/Documents/GitHub/helm2026`；本轮实施 worktree / branch 是 `/Users/tommyqian/Documents/GitHub/helm2026-market-positioning-upgrade`（branch `codex/market-positioning-upgrade`），仅作本轮市场定位升级文档/上下文切片的实施面，不是 canonical repo root
2. 路由所有权：根目录 `app/` 是 current-main route owner（不是 `apps/helm-app`）
3. 查询面：`data/queries.ts` 仍是当前真实查询聚合 façade
4. 数据库：MySQL 已是生产基线；SQLite 仅作为 archive / 兼容生成入口
5. Mobile Command Surface 已实现，`/mobile` 第一屏已经把 Ask Helm mobile answer、Must Push 必须推进项与 Review / Memory / Operating 承接入口收在同一张窄手机端经营推进入口
6. continuity runtime review surfaces 已恢复（基线提交 `208ed1b5c`）

## 5. 最近一次有意义的本地完整验证（2026-04-26）

- `npm run db:reset`：通过（隔离环境）
- targeted continuity E2E：6 用例通过
- `npm run check:boundaries`：通过
- `npm run typecheck`：通过
- `npm run test`：2667 测试通过
- `npm run build`：通过
- `npm run quality:regression`：181 测试通过
- `npm run e2e`：34 用例全部通过

## 6. 当前残留风险

1. **MySQL 1020 concurrency warning trace**：在 E2E 跑批期间出现于 `dailyUsageSnapshot`、`recommendationLog`、`membership` 周边；最终 assertion 全部通过，但 hardening 仍未关闭
2. plugin runtime sandbox 缺位
3. future-real auth 不是完整 enterprise SSO / SCIM
4. broad auto-write、auto-send、auto-execution 仍未授权
5. Business Advancement Phase 3 系列在缺少 redacted live DB calibration 时维持 runtime adoption No-Go
6. shared `helm2026` DB 旧 failed migration / view-base-table blocker 仍存在，属于独立 migration-state repair 任务

## 7. Business Advancement 下一阶段队列

本节与 [docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §5 同步。

### 7.1 Phase 1A：contract + fixtures + offline eval（已成立 / 仅做 documentation refresh）

- 维护 `AdvancementSignal / AdvancementJudgement / MustPushItem / ReviewRequiredAction / MemoryWritebackCandidate / SkillSuggestionCandidate` 的 conceptual planning contract
- 维护 20 条 fixture pack 与 offline eval 脚本
- 不允许：把 contract 落为 Prisma schema / API / event queue；不允许 fixture / eval 引入真实 DB；不允许引入 runtime extractor

### 7.2 Phase 1B：read-model adapter feasibility（已成立 / 维持只读姿态）

- 维持 6 current / 9 thin / 5 future 的 feasibility matrix
- 在 documentation / planning artifact 层继续证明 thin projection 可与现有 read model 共存
- 不允许：实际接入 production read model；不允许新增 read-model 文件或 mobile-command-read-model 分支；不允许 schema 字段或 derived column

### 7.3 Phase 2：Signal -> Must Push Adapter（仅 planning + offline + synthetic）

- 维持 offline / pure / planning-only Signal -> Must Push Adapter，包括 deterministic ranking、boundary distinctions、review-required 深链、active / deferred 划分
- 用 Phase 2B / 2C 的 query review artifact 作为来源约束；继续禁止 LLM 做最终排序
- 完成 Phase 3 / 3A–3N 的 planning-only artifact 队列
- Phase 3O real-data calibration 合同 + Phase 3P redacted snapshot collector：仅在显式 redacted live DB snapshot 提交时运行评估，默认 No-Go
- 不允许：接入 mobile-command-read-model、`/operating`、`/dashboard`、`/inbox`、`/approvals`、`/opportunities`、customer success queue 等任何 production page 行为；不允许在缺少 redacted live DB calibration 时宣布 runtime adoption；不允许引入 schema、API、Prisma 列、official write route 或自动执行权

### 7.4 Phase 3：Ask Helm Asset Capture（仅 planning + read-first + reviewable candidate）

- 把 Ask Helm 高频意图、被放弃高置信答案、边界触碰收成 reviewable `Interaction Asset Candidate` 的 planning artifact
- 让 candidate 在 Ask Helm mobile / desktop 入口以 read-first 形式出现，并落到 `MemoryWritebackCandidate / SkillSuggestionCandidate`
- 在 `MemoryWritebackCandidate` review-first 流程下沉淀经验
- 不允许：持久化 Ask Helm 多轮聊天历史；不允许 `SkillSuggestionCandidate` 自动晋升为 formal skill；不允许直接外发 / 写入正式系统 / 跨 workspace 检索；不允许引入 schema 或 production query

### 7.5 显式不批准（贯穿所有 Phase）

1. runtime extractor
2. schema 扩张
3. 自动执行 / 自动发送 / 自动审批 / 自动付款 / 自动结算
4. 完整 workflow / orchestration / agent platform / CRM / BI / chat 平台
5. 跨 workspace / 跨 tenant 聚合或 Helm reserved tenant 信息暴露给普通租户
6. 把 candidate capability 升级为 execution authority

## 8. 验证方案（Phase A）

本轮只改文档与上下文层，不改 runtime TS 代码 / scripts / schema / API / page 行为。在此范围内必须跑、且**已在本切片关闭前显式跑通**的命令：

- `git diff --check`：**已通过**（exit 0；本切片所有文档变更均无 whitespace / conflict marker 类问题）
- `npm run check:boundaries`：**已通过**（exit 0；所有 boundary 测试 PASS）
- `npm run self-check`：**已通过**（Total 18 / Passed 18 / Failed 0；exit 0）

附加事项：

- 本切片在此独立 worktree 启动时 `node_modules` 缺失，因此先跑了 `npm ci` 以恢复依赖；`npm ci` 报告 2 条 moderate severity npm audit vulnerabilities，本切片为纯文档/上下文层切片，未升级任何依赖，由后续 hardening 切片处理；未触动 `package.json` / `package-lock.json`

可选 / 默认不要求：

- `npm run typecheck`：本轮未触动 TS runtime 或 scripts，默认不要求 / 本切片未重跑；只有当后续切片修改 scripts/TS runtime 时才要求
- `npm run db:reset / lint / test / build / e2e / quality:regression`：与本切片影响面无关，§5 记录的基线已在更早切片通过；本切片未重跑

详细关闭说明见 [docs/reviews/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_CLOSEOUT_V1.md](docs/reviews/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_CLOSEOUT_V1.md)。

## 9. 收口条件

1. 新增 `HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md` 已落地，并被 `docs/README.md` product/strategy 段引用
2. `WORKING-CONTEXT.md` 已重写为当前路径、日期、Mobile Command Surface 已实现、最近一次完整验证、residual risk 与下一阶段优先级
3. `PLANS.md` 顶部新增本轮切片，未广义改写历史 sprint 段
4. `README.md` 仅在与新定位口径明显冲突时做最小化 wording 调整

# Helm Mobile Command Surface Implementation v1

更新时间：2026-04-26
状态：Implementation Closeout V1，Local Validation Passed with DB-backed E2E Blocked by Database Connectivity
当前切片：`/mobile` 最小经营推进入口，Ask Helm mobile adapter，Must Push read model，移动承接入口

## 1. 目标

把 `HELM_MOBILE_COMMAND_SURFACE_REQUIREMENTS_V1` 落成可验证实现：手机端第一屏只让当前 workspace 用户快速问 Helm、看见 Must Push 必须推进项，并跳到 Review / Memory / Operating 等已有承接面。

## 2. 影响面

- `app/(workspace)/mobile/page.tsx`
- `features/mobile/*`
- `tests/e2e/mobile-command-surface.spec.ts`
- `app/(workspace)/layout.tsx`
- `features/workspace/topbar.tsx`
- `features/workspace/sidebar.tsx`
- `README.md`
- `docs/README.md`
- `docs/reviews/HELM_MOBILE_COMMAND_SURFACE_IMPLEMENTATION_PLAN_V1.md`
- `docs/reviews/HELM_MOBILE_COMMAND_SURFACE_IMPLEMENTATION_CLOSEOUT_V1.md`

## 3. 关键假设

1. `/mobile` 是 jump surface，不是 execution surface。
2. Ask Helm mobile adapter 继承现有 interpreter / access scope / grounding，不自行扩大能力。
3. Must Push 只读压缩现有数据和 operating readout，不新增 schema。
4. denied / out-of-scope / cross-workspace answer 不能通过 related object secondary action 形成误导入口。
5. 本轮不做 official write、worker、sandbox、notification center、mobile CRM 或多轮聊天。

## 4. 验证方案

- `npm run typecheck`
- `npm run test -- features/mobile/lib/adapt-ask-helm-response.test.ts features/mobile/lib/mobile-command-read-model.test.ts features/mobile/components/must-push-card.test.tsx features/mobile/components/workspace-status.test.tsx features/mobile/components/mobile-command-footer.test.tsx`
- `npm run lint`
- `npm run check:boundaries`
- `npm run eval:ask-helm-access-scope`
- `npm run eval:ask-helm-interpreter`
- `npm run self-check`
- `npx playwright test tests/e2e/mobile-command-surface.spec.ts`

## 5. 收口条件

1. Mobile targeted tests、typecheck、lint、boundary、Ask Helm eval、build、quality regression 已通过。
2. README、docs index、implementation plan、closeout report 已同步。
3. `self-check` 只失败在 `DATABASE_URL` 未配置；mobile Playwright 只失败在 `/demo` login 前置数据库不可达：`${HELM_DB_HOST}`。
4. DB-backed Playwright 阻塞作为环境前提记录，不把本轮实现扩成数据库修复任务。

# Helm GTM Capability Plan Requirements v1

更新时间：2026-04-25
状态：Phase 5 CustomerDemandBrief Draft Flow Validation Passed; Full DB-Backed E2E Not Run
当前切片：`Reserved-only GTM capability plan readout + guided intake / CustomerDemandBrief draft candidate flow on /operating`

## 1. 目标

把已冻结的 GTM Operating Layer V2.3 收成第一批可执行 capability plan：

1. reserved GTM readout
2. guided intake and demand brief
3. customer confirmation and controlled rewrite
4. control-line evidence review
5. diagnostic and first loop starter
6. proof pack and GTM asset candidate

本轮已完成需求、索引、边界守卫、第一段 `/operating` readout，以及 Phase 2-4 的 read-only guided intake / confirmation / evidence / proof-pack prototypes。当前 Phase 5 只新增 reserved-only `CustomerDemandBrief` 内部草稿候选流，草稿写入现有 `ActionItem + ApprovalTask` 并进入人工复核；仍不进入 schema、公开 API、自动建 workspace、自动外发、自动结算或 marketplace。

## 2. 影响面

- `docs/product/HELM_GTM_CAPABILITY_PLAN_REQUIREMENTS_V1.md`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `lib/gtm-capability-plan-readout.ts`
- `features/internal-operating-workspace/queries.ts`
- `features/internal-operating-workspace/internal-operating-home.tsx`
- `features/internal-operating-workspace/gtm-actions.ts`
- `lib/gtm-capability-plan-readout.test.ts`
- `lib/gtm-customer-demand-brief-draft.ts`
- `lib/gtm-customer-demand-brief-draft.test.ts`
- `docs/reviews/HELM_GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_FLOW_IMPLEMENTATION_REPORT_V1.md`
- `PLANS.md`

## 3. 关键假设

1. GTM capability plan 只属于 Helm reserved tenant 自营 GTM，不是普通客户租户 CRM。
2. V2.3 仍是上游需求基线，本轮新增文档只负责 implementation-planning-ready 的 capability plan 切片。
3. sales-led 与 self-serve 必须共享同一核心 schema 和 clean handoff，不形成双 intake。
4. resource inventory 只形成 resource candidate，不自动接入 connector / trust / capability runtime。
5. proof pack 之前不能生成 public claim，customer rewrite 不能静默覆盖 internal judgement。
6. Phase 5 的 `CustomerDemandBrief` 草稿只能作为 reviewable candidate；审批前后都不自动创建 workspace、不外发、不写客户系统、不启动 trial initialization。

## 4. 验证方案

- `npm run self-check`
- `npm run check:boundaries`
- `git diff --check`
- `npm run test -- lib/gtm-capability-plan-readout.test.ts lib/internal-operating-workspace/foundation.test.ts features/internal-operating-workspace/display-copy.test.ts`
- `npm run test -- lib/gtm-customer-demand-brief-draft.test.ts lib/gtm-capability-plan-readout.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run quality:regression`

## 5. 后续下一步

当前 Phase 5 implementation plan：

1. 复用 `ProgramApplication` 作为草稿来源，不新增 schema。
2. 用 `ActionItem + ApprovalTask` 承接 `CustomerDemandBrief` 草稿候选，不新增公开 API。
3. Server action 必须同时守住 Helm reserved workspace 与 program application 管理权限。
4. UI 只在 `/operating` reserved readout 中提供生成草稿候选与打开审批入口。
5. 守卫、测试、报告必须写明：不创建 workspace、不外发材料、不写客户系统、不启动 trial initialization、不带入 referral / settlement / contribution attribution。
6. 下一步如果继续开发 customer-facing intake / confirmation action，应另写实现计划，明确 customer submission、material rewrite、source trace、review gate 和回滚方案。

# Helm Approval Evidence Return Support Carryover And Loading Recovery Computer Use Polish v1

更新时间：2026-04-22
状态：Non-Destructive Validation Passed; DB Reset and Full E2E Not Run
当前切片：`Computer Use continued approvals -> memory -> approval return and loading recovery loops; preserve evidence context, open support details on return, make drawer evidence count actionable, translate memory audit replay, localize approval KPI gap readout, reset stale recovery fragments, add workspace fallback shortcuts, use client navigation, and keep stuck loading fallback actionable`

## 1. 目标

继续按 Computer Use 的真人路径复跑两个仍不顺的环节：

1. 从 `/approvals` 点击 `打开证据` 进入对象级 `/memory` 后，返回原复核抽屉时不让用户重新展开辅助材料。
2. 让记忆页 `回到这条复核` 使用 Next client navigation，降低硬跳转进入 protected-route loading recovery 的概率。
3. 在全局 loading fallback 中保留可直接操作的三套演示工作区入口；即使 Safari 没有及时完成 RSC streaming reveal，用户也能继续选择 demo。
4. 保留 `demoRecoveryBaseHref = "/demo"` 守卫 marker，同时最终恢复 CTA 优先指向公开入口 `/?view=public#entry`。
5. 抽屉内展开 `辅助判断材料` 后，证据数量必须能直接下钻到当前复核对象的记忆时间线，而不是只显示不可操作的计数。
6. 记忆页 `最近审计回放` 默认可见层不能直接露出 `RECOMMENDATION_GENERATED`、`payload`、`source page`、`summary` 这类实现词。
7. 从带 hash 的 loading recovery 进入 demo workspace 时，不能把旧页面 hash 继承到 `/dashboard`。
8. 如果 Safari 仍停在全局 fallback，fallback 必须给出复核队列、经营记忆和机会推进的工作区恢复捷径，而不是只让用户重复打开同一个 dashboard。
9. 复核页 `对象状态 / 阻塞 / 待决策 / 下一步动作` 不能把 `KPI link pending`、英文 summary 或内部缺口状态直接露给中文用户。
10. 不改审批状态机、批准/拒绝/改写/转人工动作、发送权限、auth/session 权限模型、DB schema、audit schema、KPI schema 或 memory 写入语义。

## 2. 影响面

- `app/(workspace)/approvals/page.tsx`
- `features/approvals/page-loader.ts`
- `features/approvals/approvals-client.tsx`
- `features/approvals/approval-drawer-accessibility.test.ts`
- `features/approvals/approval-memory-context-link.test.ts`
- `features/memory/memory-client.tsx`
- `features/memory/display-copy.ts`
- `features/memory/display-copy.test.ts`
- `features/memory/memory-approval-evidence-context.test.ts`
- `lib/operating-system/audit-reason-chain.ts`
- `lib/operating-system/audit-reason-chain.test.ts`
- `app/loading.tsx`
- `app/demo/loading.tsx`
- `lib/presentation/loading-recovery.ts`
- `lib/presentation/loading-recovery.test.ts`
- `lib/presentation/business-loop-gap-readout.ts`
- `lib/presentation/business-loop-gap-readout.test.ts`
- `lib/demo/demo-entry-shell.test.ts`
- `docs/reviews/HELM_APPROVALS_REVIEW_PATH_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/reviews/HELM_DEMO_REENTRY_LOADING_RECOVERY_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `evidenceOpen=1` 是显示层参数，只用于从 memory 证据返回时打开 `辅助判断材料`，不代表审批授权。
2. 普通队列卡和普通抽屉打开仍保持辅助材料折叠，避免默认解释噪声回流。
3. 关闭复核抽屉时必须同时清理 `approvalId` 和 `evidenceOpen`，避免刷新后恢复到旧状态。
4. 全局 loading fallback 上的 demo 表单只登录演示账号并进入 dashboard，不生成报告、不批准动作、不对外发送。
5. Safari 的 streaming reveal root cause 仍未关闭；本轮目标是让 fallback 自身可恢复，而不是声称彻底修好浏览器 runtime。
6. 抽屉内新增的证据入口只是导航下钻，不代表审批放行、记忆写入、审计结论或发送授权。
7. 审计卡中文化只改显示标签和理由链说明，不改底层 actionType、payload 或审计写入。
8. HTTP redirect 到无 fragment 的 Location 会继承原 URL fragment，因此 loading recovery 的 server-action target 需要显式带空 fragment。
9. 工作区恢复捷径只是导航出口，不生成报告、不执行审批、不对外发送，也不扩展权限。
10. `KPI link pending` 仍是底层 business-loop gap contract 的稳定字段；本轮只在共享展示 helper 里补中文前台表达，不做 KPI canonicalization。

## 4. Computer Use 结果

- Computer Use：从 approvals 的 `打开证据` 进入 `/memory?objectType=OPPORTUNITY&objectId=...&from=approvals&approvalId=...#memory-work-timeline`。
- Computer Use：点击 `回到这条复核` 后回到 `/approvals?approvalId=...#approval-preview`，复核抽屉打开，但 `辅助判断材料` 仍折叠；这是本轮 evidenceOpen 的触发点。
- Computer Use：Safari 硬进入 `/demo` 时仍可能停在全局 `正在打开你的经营入口` fallback；点击原 `选择演示工作区` 曾只回到另一个 loading 态。
- Computer Use：修复后刷新 `/?view=public#entry`，Safari 能看到公开首页演示卡片，并暴露 `打开创始人工作台 / 打开销售工作台 / 打开招聘工作台` 三个独立按钮。
- Computer Use：从公开首页进入销售工作台，再点击 dashboard 复核项打开抽屉；展开 `辅助判断材料` 后发现只有 `置信度 74 · 证据 2 条`，没有可点击证据入口。
- Computer Use：修复后同一抽屉内出现 `证据时间线 / 打开证据`，链接指向当前复核对象的 `/memory?objectType=...&objectId=...&from=approvals&approvalId=...#memory-work-timeline`。
- Computer Use：当前 memory 证据页右侧 `最近审计回放` 仍直接显示 `RECOMMENDATION_GENERATED`、`payload`、`source page`、`summary`，这是本轮审计卡显示层继续收敛点。
- Computer Use：刷新当前 memory 证据页后又落入全局 loading recovery；点击 `进入销售团队演示` 曾把当前 hash 带到 `/dashboard#memory-work-timeline`，现已通过空 fragment target 清理。
- Computer Use：修复后再次在 Safari fallback 点击 `进入销售团队演示`，地址从 `/dashboard#memory-work-timeline` 变成干净 `/dashboard`，不再继承旧 memory hash。
- Computer Use：Safari 后续 reveal 到真正 dashboard，首屏回到 `目标推进台`；服务端日志显示 `/dashboard` 200 正常返回，Chromium 对照也能正常渲染 dashboard。
- Computer Use：进入 `/approvals#approval-queue` 后发现首屏 `阻塞 / 待决策 / 下一步动作` 仍露出 `KPI link pending` 和英文 summary；本轮把这条缺口收成 `KPI 关联待补`、中文缺口说明和中文下一步动作。
- Playwright：从 `/demo` 进入销售工作台后打开 `/approvals#approval-queue`，确认页面包含 `KPI 关联待补 / 当前经营闭环还没有协同指标快照 / 先补一条每日协同指标快照`，且不再包含原英文缺口状态。

## 5. 验证结果

- `npm run test -- lib/presentation/loading-recovery.test.ts features/memory/memory-approval-evidence-context.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-memory-context-link.test.ts` passed；4 files / 12 tests。
- `npm run test -- features/approvals/approval-memory-context-link.test.ts features/approvals/approval-drawer-accessibility.test.ts features/memory/memory-approval-evidence-context.test.ts` passed；3 files / 10 tests。
- `npm run test -- features/memory/display-copy.test.ts lib/operating-system/audit-reason-chain.test.ts features/approvals/approval-memory-context-link.test.ts features/approvals/approval-drawer-accessibility.test.ts features/memory/memory-approval-evidence-context.test.ts` passed；5 files / 17 tests。
- `npm run test -- features/memory/display-copy.test.ts lib/operating-system/audit-reason-chain.test.ts` passed；2 files / 8 tests。
- `npm run test -- lib/presentation/loading-recovery.test.ts` passed；1 file / 4 tests。
- `npm run test -- lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts` passed；2 files / 8 tests。
- `npm run test -- lib/presentation/business-loop-gap-readout.test.ts` passed；1 file / 5 tests。
- Playwright：`/?view=public#entry -> 销售工作台 -> dashboard 复核项 -> 复核抽屉 -> 辅助判断材料 -> 打开证据 -> memory -> 回到这条复核` passed；返回 URL 带 `evidenceOpen=1`，details open 为 true。
- Playwright：对象级 memory 证据页 `#memory-audit-replay` 文本检查 passed；`RECOMMENDATION_GENERATED / payload / source page / summary` 命中为 false。
- Playwright/HTTP redirect probe：302 到 `/target` 会继承旧 hash；302 到 `/target#` 会清掉旧 hash。
- Playwright：Chromium 从公开入口进入销售工作台后 URL 为 `/dashboard`，`h1` 为 `目标推进台`，未停在 loading fallback。
- Playwright：`/demo -> 进入销售团队演示 -> /approvals#approval-queue` passed；KPI 缺口中文化命中，原英文缺口状态命中 0。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run db:reset` 未执行：数据库重置有破坏性副作用，本轮未请求确认。
- `npm run e2e` 未执行：完整 DB-backed 链路仍需本地 MySQL / 测试库前提。

## 6. 剩余风险

1. 本轮没有执行批准、拒绝、改写、转人工、自动处理策略或任何对外发送动作。
2. Safari streaming reveal 的根因仍需继续查；fallback 已可恢复且旧 hash 继承已关闭，但不能等同于 root cause 关闭。
3. 完整 DB-backed e2e 仍未跑；当前覆盖的是 Computer Use、source contracts、typecheck、self-check、boundary、lint 和 diff check。

# Helm Memory Approval Exact Return Computer Use Polish v1

更新时间：2026-04-22
状态：Non-Destructive Validation Passed; DB Reset and Full E2E Not Run
当前切片：`Playwright confirmed approvals -> memory returns only to approval queue; preserve approvalId through evidence links and return to the original review preview`

## 1. 目标

继续顺着 Computer Use 暴露的 `/approvals -> /memory` 证据链路做下一层顺滑度收敛：

1. 让审批证据链接不仅带 `objectType/objectId/from=approvals`，还带当前 `approvalId`。
2. 让 `/memory` loader 将 `approvalId` 收成只用于返回导航的 `returnToApprovalId`。
3. 让记忆页筛选、搜索和来源筛选时继续保留 `approvalId`，避免用户查证过程中丢失返回目标。
4. 从复核进入的对象级证据卡优先显示“回到这条复核”，并返回 `/approvals?approvalId=...#approval-preview`。
5. 不改审批状态机、approve / reject / rewrite / manual action、发送权限、记忆写入、审计或承诺边界。

## 2. 影响面

- `features/approvals/approvals-client.tsx`
- `app/(workspace)/memory/page.tsx`
- `features/memory/page-loader.ts`
- `features/memory/memory-client.tsx`
- `features/approvals/approval-memory-context-link.test.ts`
- `features/memory/memory-approval-evidence-context.test.ts`
- `PLANS.md`
- `docs/reviews/HELM_MEMORY_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`

## 3. 关键假设

1. `approvalId` 只用于前端返回定位，不赋予任何审批执行权限。
2. 返回到 `approval-preview` 的行为复用现有 `/approvals?approvalId=...` 抽屉打开逻辑，不新增审批路由或状态机。
3. `from=approvals` 仍然只表示页面来源；`source` 继续保留 Helm/OpenClaw 来源筛选语义。

## 4. 当前验证结果

- Playwright：修复前 `打开证据` 为 `/memory?objectType=...&from=approvals#memory-work-timeline`，返回按钮只能到 `/approvals#approval-queue`。
- Playwright：修复后 `打开证据` 为 `/memory?objectType=OPPORTUNITY&objectId=...&from=approvals&approvalId=...#memory-work-timeline`。
- Playwright：记忆页返回按钮为 `/approvals?approvalId=...#approval-preview`，点击后页面出现复核抽屉。
- `npm run test -- features/approvals/approval-memory-context-link.test.ts features/memory/memory-approval-evidence-context.test.ts lib/presentation/page-section-anchors.test.ts` passed；3 files / 9 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run build` passed；保留既有 Turbopack NFT trace warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run db:reset` 未执行：数据库重置有破坏性副作用，本轮没有用户确认。
- `npm run e2e` 未执行：完整 DB-backed 链路仍需独立测试库前提。

# Helm Memory Approval Evidence Landing Computer Use Polish v1

更新时间：2026-04-22
状态：Non-Destructive Validation Passed; DB Reset and Full E2E Not Run
当前切片：`Computer Use confirmed /memory?objectType=...&from=approvals lands inside the timeline without enough handoff context and exposed a duplicated hash after evidence navigation; add an object-scoped evidence landing card, review return path, and idempotent section hrefs`

## 1. 目标

继续用 Computer Use 按真人路径复跑 `/approvals -> 经营记忆` 的落点：

1. 确认对象级记忆 URL 是否能让用户第一眼知道自己正在看哪一个复核对象。
2. 在 `#memory-work-timeline` 锚点内补一个对象级证据承接卡，让 hash 滚动后首屏仍可读。
3. 从审批进入时显示 `复核证据落点`、当前对象、为什么看这条时间线、回到复核边界、打开关联对象和审计回放。
4. 继续保留普通对象记忆入口，不把 `source` 来源筛选参数挪作页面来源。
5. 不改 memory schema、查询语义、写入动作、纠错/删除/导出权限、审批状态机、发送权限或承诺边界。

## 2. 影响面

- `features/approvals/approvals-client.tsx`
- `features/approvals/approval-memory-context-link.test.ts`
- `app/(workspace)/memory/page.tsx`
- `features/memory/page-loader.ts`
- `features/memory/memory-client.tsx`
- `features/memory/memory-approval-evidence-context.test.ts`
- `lib/presentation/page-section-anchors.ts`
- `lib/presentation/page-section-anchors.test.ts`
- `docs/reviews/HELM_MEMORY_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `source` 已经用于 Helm/OpenClaw 来源筛选，因此审批来源应使用独立 `from=approvals` 参数。
2. 锚点落点必须在时间线区域内部承接；只改页面顶部无法解决 hash 直接滚到中段的问题。
3. 对象级证据卡只改变页面理解和导航，不改变记忆稳定性、审计、导出、纠错或审批权限。
4. 从复核返回只回到 `/approvals#approval-queue`，不自动执行任何审批动作。
5. section href 构造必须幂等；路径已经带 hash 时不能再追加第二个 hash。

## 4. 验证方案

- Source contract：审批页对象级 memory href 带 `from=approvals`；memory page-loader 将它收成 `APPROVAL_EVIDENCE`，并保留 `source` 过滤语义。
- Source contract：`data-memory-approval-evidence-context` 出现在 `MEMORY_PAGE_ANCHORS.timeline` 内，且有回到复核边界和打开关联对象入口。
- Computer Use：从 Safari 当前对象级 memory URL 刷新或重进，确认首屏出现 `复核证据落点` 和 `回到复核边界`。
- Computer Use：从复核页点击 `打开证据` 后，地址栏不得出现 `#memory-work-timeline#memory-work-timeline`。
- Targeted validation：运行 approvals/memory 相关测试、`typecheck`、`self-check`、`check:boundaries`、`lint`、`build`、`quality:regression` 和 `git diff --check`。
- 不运行 `npm run db:reset`，除非确认数据库不是远程 RDS 或用户明确允许重置。

## 5. 当前验证结果

- Computer Use：Safari 真实页面确认对象级 memory URL 带 `from=approvals`，时间线锚点首屏出现 `复核证据落点`、当前对象说明、`回到复核边界`、`打开关联对象` 与 `查看审计回放`。
- Computer Use：从复核页再次点击 `打开证据` 时暴露 `#memory-work-timeline#memory-work-timeline` 双 hash，已通过 `buildSectionHref` 幂等化修复。
- `npm run test -- features/approvals/approval-memory-context-link.test.ts features/memory/memory-approval-evidence-context.test.ts lib/presentation/page-section-anchors.test.ts` passed；3 files / 9 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run build` passed；保留既有 Turbopack NFT trace warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run db:reset` 未执行：数据库重置有破坏性副作用，本轮没有用户确认。
- `npm run e2e` 未执行：完整 DB-backed 链路仍需独立测试库前提。

# Helm Approvals Memory Evidence Context Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted Validation Passed; Full DB-Backed E2E Still Not Run
当前切片：`Computer Use confirmed approvals memory evidence entry lands on generic /memory; route evidence links to the current approval object's memory timeline`

## 1. 目标

继续用 Computer Use 按真人路径复跑 `/approvals -> 经营记忆`：

1. 找出审批页的 `打开记忆依据 / 打开证据` 是否能直接承接当前复核对象。
2. 修复泛用 `/memory` 跳转，让用户进入当前审批对象的记忆时间线。
3. 没有当前证据焦点时仍保留普通经营记忆时间线兜底。
4. 不改记忆数据模型、审批状态机、审批权限、approve / reject / manual / auto-policy action 或发送边界。

## 2. 影响面

- `features/approvals/approvals-client.tsx`
- `features/approvals/approval-memory-context-link.test.ts`
- `docs/reviews/HELM_APPROVALS_REVIEW_PATH_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 审批页已经有 `buildApprovalMemoryHref`，当前问题是入口没有复用它，不需要扩展记忆页协议。
2. 证据入口应该优先跟随 `approvalEvidenceFocus` 或 `approvalCandidate`，让用户从复核草稿直接进入相关 object memory。
3. 兜底可以继续落到 `/memory#timeline`，但不应该在有对象上下文时丢失 `objectType/objectId`。
4. 本轮只修导航上下文，不把记忆页改成审批详情页。

## 4. 验证方案

- Source contract：审批页 `打开记忆依据 / 打开证据 / 证据焦点` 必须使用对象级 memory href。
- Computer Use：从 Safari `/approvals` 点击记忆证据入口，确认地址进入 `/memory?objectType=...&objectId=...#...`。
- Targeted validation：运行 approvals 相关测试、`typecheck`、`self-check`、`check:boundaries`、`lint`、`build`、`quality:regression` 和 `git diff --check`。
- 不运行 `npm run db:reset`，除非确认数据库不是远程 RDS 或用户明确允许重置。

## 5. 验证结果

- Computer Use：Safari 从 `/memory` 进入 `/approvals` 后，页面可见的 `证据焦点`、`打开记忆依据`、`打开证据` 都已生成对象级链接。
- Computer Use：点击主动审批协作里的 `打开证据` 后，地址进入 `/memory?objectType=OPPORTUNITY&objectId=...#memory-work-timeline`，记忆页滚到当前对象工作时间线，而不是泛用记忆首页。
- `npm run test -- features/approvals/approval-memory-context-link.test.ts features/approvals/approval-entry-flow-source.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-first-loop-display.test.ts` passed；4 files / 8 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run build` passed；保留既有 Turbopack NFT trace warning。
- `npm run quality:regression` passed；51 files / 181 tests。

## 6. 剩余风险

1. 本轮只修审批页到记忆页的上下文 URL，记忆页 object-scoped 首屏是否还需要更强的“从复核过来”承接语，留给下一轮 Computer Use 复评。
2. 本轮没有执行批准、拒绝、改写、转人工或设置后续自动处理规则，不产生真实审批状态变化。
3. `npm run db:reset` 未跑：当前环境数据库指向远程 RDS，重置有破坏性副作用。
4. `npm run e2e` 未跑：仍需独立测试库后补完整 DB-backed 链路。

# Helm Approvals Entry Flow Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted Validation Passed; Full DB-Backed E2E Still Not Run
当前切片：`Computer Use confirmed approvals primary CTA opens the review drawer, drawer close is named, and closing clears approvalId back to /approvals`

## 1. 目标

继续用 Computer Use 按真人路径复跑 `/dashboard -> /approvals -> 复核抽屉`：

1. 找出 `/approvals` 首屏 `进入复核面板` 是否真能把用户送进复核抽屉。
2. 修复 first-loop 主 CTA 因 trace 记录慢而进入 pending / disabled 的交互断点。
3. 让抽屉关闭按钮在 Computer Use / screen reader 中有明确名称。
4. 关闭抽屉时清理 `approvalId` 和 hash，避免刷新后重新打开同一抽屉。
5. 不改审批权限、approve / reject / manual / auto-policy action、数据模型或发送边界。

## 2. 影响面

- `components/shared/first-loop-tracked-action-button.tsx`
- `components/ui/sheet.tsx`
- `features/approvals/approvals-client.tsx`
- `features/approvals/approval-entry-flow-source.test.ts`
- `features/approvals/approval-drawer-accessibility.test.ts`
- `docs/reviews/HELM_APPROVALS_REVIEW_PATH_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 首屏唯一下一步的导航优先级高于 adoption trace 写入；trace 失败或变慢不能阻塞人进入复核。
2. 复核抽屉关闭是局部浏览状态，不应持久保留到 URL 里让刷新复开。
3. 共享抽屉 close control 必须有可读名称，但不改变 Radix Dialog 的关闭行为。
4. 本轮只修交互可达性和 URL 清理，不扩大执行权限。

## 4. 验证结果

- Computer Use：读取 Safari `/dashboard` 后进入 `/approvals`，发现 `进入复核面板` 首次点击会进入 pending / disabled，抽屉没有稳定打开。
- Computer Use：修复后 `/approvals` 首屏 CTA 进入 `/approvals?approvalId=...#approval-preview`，打开 `发送 Atlas 合作 brief` 抽屉。
- Computer Use：抽屉关闭按钮从无名 `按钮` 变为 `关闭复核抽屉`。
- Computer Use：点击 `关闭复核抽屉` 后，URL 回到 `localhost:3000/approvals`，刷新不会复开同一抽屉。
- Playwright：`/demo -> /dashboard -> /approvals -> 进入复核面板 -> 关闭复核抽屉` 通过；关闭后 URL 为 `/approvals`，`rootDelta = 0`，`bodyDelta = 0`，`h1 = 复核与边界`。
- `npm run test -- features/approvals/approval-entry-flow-source.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-first-loop-display.test.ts` passed；3 files / 6 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run build` passed；保留既有 Turbopack NFT trace warning。
- `npm run quality:regression` passed；51 files / 181 tests。

## 5. 剩余风险

1. 本轮没有执行批准、拒绝、转人工或设置后续自动处理规则，不产生真实审批状态变化。
2. `npm run db:reset` 未跑：当前环境数据库指向远程 RDS，重置有破坏性副作用。
3. `npm run e2e` 未跑：仍需独立测试库后补完整 DB-backed 链路。
4. 当前 worktree 仍有大量既有未提交改动，最终提交前需要按本轮文件边界拆清楚。

## 6. 下一步

1. 继续用 Computer Use 从 `/approvals` 往 `/memory` 或 `/reports` 走下一层判断链路。
2. 补一条 DB 隔离后的 approvals textarea fill / restore e2e。
3. 单独处理关闭抽屉后是否需要恢复到首屏或保留队列位置的体验细节。

# Helm Demo Reentry Loading Recovery Computer Use Polish v1

更新时间：2026-04-22
状态：Non-Destructive Validation Passed; Full DB-Backed Test Blocked By Local MySQL
当前切片：`Computer Use confirmed loading recovery demo CTA should route to the stable /demo entry instead of carrying ?recovery=loading into the next route`

## 1. 目标

继续处理上一轮留下的 `workspace confirmation / re-entry path`：

1. 用 Computer Use 真实进入 Safari `/demo`，确认用户是否仍被 loading recovery 抢首屏。
2. 让 `/demo` 公共演示入口不再因为 current-user session 读取而阻塞首屏。
3. 把 `/demo` fallback 从“工作区确认”改成能直接选三套演示工作区的恢复入口。
4. 验证 fallback 的 `进入创始人 / COO 演示` 能继续进入 dashboard。
5. 如果 Safari 进入 `/dashboard` 后仍停在 root loading fallback，让全局 fallback 本身也有可恢复路径，而不是只提供原地重试。
6. 修正 dashboard shell / topbar 在真实 Safari 桌面窗口里的横向溢出，不牺牲主操作按钮可达性。
7. 不改 auth session、workspace membership、proxy guard、demo account、权限、报告、审批或发送边界。

## 2. 影响面

- `app/demo/page.tsx`
- `app/demo/loading.tsx`
- `app/loading.tsx`
- `components/layout/app-shell.tsx`
- `components/layout/topbar.tsx`
- `lib/demo/demo-entry-shell.test.ts`
- `lib/presentation/loading-recovery.ts`
- `lib/presentation/loading-recovery.test.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/reviews/HELM_DEMO_REENTRY_LOADING_RECOVERY_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/demo` 是公开演示选择入口，不应先显示 protected workspace confirmation 语言。
2. 公开入口可静态提供“返回工作台”链接，由 existing proxy/session chain 决定是否进入或登录。
3. 当 Safari 暂时不能 reveal RSC streamed content 时，fallback 必须本身可操作，而不是只提供重试。
4. Fallback 可以登录 demo account，但不能扩展为自动执行、自动审批或自动发送。
5. 顶栏中等桌面宽度应优先显示图标按钮，文字到更宽屏再展开，避免工具按钮挤出主内容区。
6. `recovery=loading` 没有实际语义处理，不能继续被带进下一页 URL；恢复按钮应指向稳定真实入口。

## 4. 验证结果

- Computer Use：复现 `/demo` 旧 fallback 显示 `工作区确认 / 正在确认你的经营工作区`。
- Computer Use：修改后 Safari `/demo` 显示 `选择一套演示工作区`，并暴露 `进入创始人 / COO 演示`、`进入销售团队演示`、`进入猎头顾问演示`。
- Computer Use：点击 `进入创始人 / COO 演示` 后 Safari 进入 `/dashboard`；Safari 仍显示全局 workspace confirmation fallback，这是下一层 root/workspace streaming recovery 问题。
- Computer Use：继续确认 Safari `/dashboard` fallback 需要可恢复出口；全局 fallback 已改成 `入口确认 / 正在打开你的经营入口`，并提供 `回到登录入口`、`重试打开工作台`、`选择演示工作区`、`公开首页`。
- Computer Use：发现 fallback 在当前已位于 `/demo` 时，`选择演示工作区` 原 href 仍是 `/demo`，点击可能等于原地不动；已改成 `/demo?recovery=loading` 的恢复导航。
- Computer Use：确认全局 loading recovery actions 现在在 Safari accessibility tree 中暴露为独立按钮，并能从卡住态回到完整 `/demo` 页面。
- Computer Use：继续复测发现 `/demo?recovery=loading` 会把恢复状态残留在真实演示入口 URL，且旧页面可能先显示同一张 root loading recovery 卡；本轮已将 recovery CTA 改回稳定 `/demo` 与 `/dashboard`，不再透传 `?recovery=loading`。
- Computer Use：从完整 `/demo` 页面点击 `先看创始人 / COO 演示` 后进入 `/dashboard`，工作台首屏可见，底部横向滚动条消失。
- Playwright：`/demo -> /dashboard` 在 1024、1180、1280、1320、1366、1440、1512、1600 宽度下 `scrollWidth === clientWidth`，无横向溢出。
- Playwright：从 `/demo` fallback 点击 `进入创始人 / COO 演示` 后进入 `/dashboard`，首个 `h1` 为 `目标推进台`，body 不包含 `正在确认你的经营工作区`。
- `curl /demo`：fallback HTML 包含三套 demo 按钮，不再以 `工作区确认` 作为 visible fallback。
- `npm run test -- lib/demo/demo-entry-shell.test.ts lib/demo/demo-modes.test.ts lib/presentation/loading-recovery.test.ts` passed；3 files / 9 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run build` passed after the final `next/link` correction；保留既有 Turbopack NFT trace warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- Computer Use：Safari 已回到 `http://localhost:3000/demo`，可见页为可操作的演示工作区选择器。
- `npm run test -- lib/demo/demo-entry-shell.test.ts lib/presentation/loading-recovery.test.ts` passed；2 files / 6 tests。
- Computer Use：Safari 旧标签从 `/demo?recovery=loading` 手动收回干净 `localhost:3000/demo`，完整演示选择器仍可见。
- `npm run test` attempted；271 files / 1155 tests passed，6 个 DB runtime test files / 15 tests failed，统一原因是 Prisma 无法连接 `127.0.0.1:3306`。
- `curl /demo`：streamed HTML 仍包含 hidden full demo content 与 React reveal script markers；本轮 fallback 是恢复层，不是替换完整页面。
- Dev server：port 3000 正在 detached `screen` session `helm-dev` 内运行；本地浏览器使用 `http://localhost:3000`，避免 `127.0.0.1` 触发 Next dev resource origin blocking。
- `nc -z 127.0.0.1 3306` returned exit 1；本地 MySQL 仍不可达。

## 5. 剩余风险

1. Safari 本地仍可能停在 workspace root fallback；本轮已让 `/demo` 和全局 fallback 都可操作，但没有宣称修复 RSC streaming reveal 的根因。
2. `/demo/loading.tsx` 与 `/demo/page.tsx` 共享 demo login 意图但代码仍有重复；后续可抽 helper。
3. 完整 DB-backed tests / e2e 仍需 MySQL 恢复后补跑。

## 6. 下一步

1. 继续用 Computer Use 处理 `/dashboard` root/workspace fallback 根因：确认是 Safari streaming reveal、DB 等待还是 workspace layout 数据链路。
2. 恢复本地 MySQL 后补跑完整 `npm run test`、`npm run db:reset`、`npm run e2e`。
3. 只在确认 root cause 后再改全局 loading/error contract，不先扩大到 auth/session 重构。

# Helm Settings Imports Diagnostics Analytics Dashboard Language Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted Non-Destructive Validation Passed; Full DB-Backed Test Blocked By Local MySQL
当前切片：`Computer Use read Safari /dashboard, Playwright confirmed dashboard/settings/diagnostics/imports/crm/imports/analytics desktop/mobile target terms 0, overflow 0 and non-HMR console errors 0`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环处理真实页面：

1. 使用 Computer Use 像用户一样读取 Safari 当前页面，并在刷新后复核 dashboard 首屏。
2. 收掉 `/dashboard` 中文首屏和二层路由里的 `review / Resume / feed / first loop / why / Detail / Approvals / Memory / Top 1-3` 等可见残留。
3. 收掉 `/settings`、`/imports/crm`、`/diagnostics`、`/analytics` 里仍暴露的 raw breadcrumb、feature flag、CRM import、warmup、ingress、today focus、object type 等展示词。
4. 用 Playwright 登录态扫描覆盖 desktop/mobile，确认没有目标词、横向溢出和非 HMR console error。
5. 不改 first-loop 状态机、analytics event schema、CRM 导入契约、审批权限、发送权限、recommendation/commitment 边界或数据模型。

## 2. 影响面

- `app/(workspace)/dashboard/page.tsx`
- `features/dashboard/home-work-entry.ts`
- `features/dashboard/home-work-entry-surface.tsx`
- `features/dashboard/home-work-entry.test.ts`
- `features/dashboard/home-surface-routing.ts`
- `features/dashboard/home-surface-routing-panel.tsx`
- `features/dashboard/home-surface-routing.test.ts`
- `features/analytics/analytics-client.tsx`
- `features/analytics/display-copy.ts`
- `features/analytics/display-copy.test.ts`
- `features/diagnostics/diagnostics-client.tsx`
- `features/diagnostics/display-copy.ts`
- `features/diagnostics/display-copy.test.ts`
- `features/imports/crm-import-client.tsx`
- `features/imports/display-copy.ts`
- `features/imports/display-copy.test.ts`
- `features/settings/components/pilot-settings-tab.tsx`
- `lib/i18n/messages.ts`
- `lib/navigation/breadcrumb-trail.ts`
- `lib/navigation/breadcrumb-trail.test.ts`
- `tests/e2e/detail-hierarchy.spec.ts`
- `docs/reviews/HELM_SETTINGS_IMPORTS_DIAGNOSTICS_ANALYTICS_DASHBOARD_LANGUAGE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 中文默认层应让经营负责人直接判断当前工作、复核压力、下一跳和边界，不应裸露内部路由名或状态机词。
2. English 模式继续保留英文产品语言；本轮只修中文默认层。
3. 对 first-loop、analytics event、feature flags 的修正应留在显示适配层，不迁移底层枚举或事件契约。
4. 历史或运行时数据里的英文业务名可以继续作为对象名存在；本轮只处理明显系统/实现语言。

## 4. 验证结果

- Computer Use：成功读取 Safari `localhost:3000/dashboard`，发现 `先处理 review`、`Resume 只服务工作恢复，不服务 feed`、`first loop 进度`、`读 why`、`Detail / Approvals / Memory`、`TOP 1-3 工作事项` 等真实首屏残留；刷新后确认 dashboard 已显示为 `先处理复核`、`继续推进只服务工作恢复，不服务信息流`、`第一条闭环进度` 和中文下一层工作面。
- Playwright authenticated scan：`/dashboard`、`/settings`、`/diagnostics`、`/imports/crm`、`/imports`、`/analytics` × desktop/mobile；目标词 0、横向溢出 0、非 HMR console errors 0。
- `npm run test -- features/diagnostics/display-copy.test.ts features/analytics/display-copy.test.ts features/dashboard/home-work-entry.test.ts features/dashboard/home-surface-routing.test.ts features/imports/display-copy.test.ts lib/navigation/breadcrumb-trail.test.ts` passed；6 files / 28 tests。
- `npm run typecheck` passed。
- `npm run check:boundaries` passed。
- `npm run self-check` passed；11/11。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run build` passed；保留既有 Turbopack NFT tracing warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- `nc -z 127.0.0.1 3306` exit 1；本地 MySQL 当前不可达。
- 完整 `npm run test` attempted：266 files / 1141 tests passed；6 DB-backed Helm v2 runtime files / 15 tests failed because Prisma could not reach `127.0.0.1:3306`。
- `npm run db:reset` 未执行：本地 MySQL 前提不可用，且该命令会重置数据库。
- `npm run e2e` 未执行：完整单测已确认 DB 前提不可用；本轮已用 Computer Use 和登录态 Playwright 覆盖当前页面改动面。

## 5. 剩余风险

1. DB-backed runtime 与 e2e 仍需 MySQL 恢复后补跑。
2. `/dashboard` 通过硬导航仍可能短暂落到工作区确认/重新进入工作台路径，这是下一轮可单独处理的交互恢复问题。
3. 底层 technical keys 仍保留为 schema/contract truth；显示层已做中文化，不代表底层字段重命名。

## 6. 下一步

1. 恢复本地 MySQL 后补跑完整 `npm run test`、`npm run db:reset`、`npm run e2e`。
2. 下一轮继续从 Computer Use 真实导航开始，优先处理 workspace confirmation / re-entry path。
3. 保持当前策略：只在显示层收系统词，不扩大到权限、状态机、导入契约或自动执行能力。

# Helm Reports Authenticated Frontstage Language Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted And Non-Destructive Validation Passed; Full DB-Backed Test Blocked By Local MySQL
当前切片：`Computer Use successfully read Safari /reports; authenticated Playwright confirmed /reports desktop/mobile and 9 second-layer dynamic routes have zero target terms and zero horizontal overflow`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环处理 `/reports` 登录后真实页面：

1. 继续使用 Computer Use 读取真实 Safari 页面，而不是只看截图或静态代码。
2. 把 `/reports` 周报摘要、计划建议、指标区和导航里的 `AI 建议 / AI 执行 / AI 参与 / 系统观察 / 系统想到 / 智能设置` 收成中文负责人判断语言。
3. 对旧数据库摘要增加显示层净化，避免历史 `AI 共生成` 继续进入前台。
4. 用带登录态的 Playwright 复查 `/reports`，并补上上一轮动态详情路由未带登录态的验证缺口。
5. 不改周报 payload、审批状态机、权限、recommendation / commitment 底层边界或自动执行能力。

## 2. 影响面

- `features/reports/display-copy.ts`
- `features/reports/display-copy.test.ts`
- `features/reports/reports-client.tsx`
- `lib/reports/index.ts`
- `lib/presentation/workspace-story.ts`
- `lib/i18n/messages.ts`
- `docs/reviews/HELM_REPORTS_AUTHENTICATED_FRONTSTAGE_LANGUAGE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/reports` 登录后的默认层应先帮助负责人判断“当前状态、待决策、下一步动作、边界”，而不是展示系统自我叙述。
2. `AI` 作为产品定位可以存在，但具体工作视图里应优先显示“建议动作、执行闭环、推进规律”等可操作语言。
3. 旧周报摘要是历史数据，不应直接改库；显示层净化比迁移数据风险更小。
4. English 模式仍保留英文产品术语；本轮只收中文默认层。

## 4. 验证结果

- Computer Use：成功读取 Safari 当前窗口 `localhost:3000/reports`，确认导航显示 `工作区设置`，报告页显示 `建议动作 / 执行闭环 / 推进规律`，不再显示本轮目标词。
- Playwright `/reports` authenticated desktop/mobile scan passed：目标词 0、横向溢出 0、console error 0。
- Playwright authenticated second-layer scan passed：`/founder-conversations/:id`、`/founder-qa/:id`、`/sales-conversations/:id`、`/sales-followups/:id`、`/sales-objections/:id`、`/delivery-conversations/:id`、`/delivery-walkthroughs/:id`、`/delivery-reviews/:id`、`/external-narrative-fallbacks/:id` 全部 200，目标词 0、横向溢出 0。
- `npm run test -- features/reports/display-copy.test.ts features/reports/report-first-loop-display.test.ts features/reports/engineering-delivery-review-panel.test.ts lib/reports/engineering-delivery-review.test.ts lib/reports/index.test.ts` passed；5 files / 9 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `nc -z 127.0.0.1 3306` exit 1；本地 MySQL 仍不可达。
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用。
- 完整 `npm run test` / `npm run e2e` 未执行：当前 DB 前提不可用，本轮已用定向单测、守卫、构建和登录态页面扫描覆盖当前改动面。

## 5. 剩余风险

1. `/reports` 仍有工程交付摘要和证据 disclosure；这是内部管理判断层，不能当成正式绩效或 GitHub review truth。
2. 底层字段仍叫 `aiSuggestionsCount`，这是数据契约，不在本轮改名；显示层已经收成“建议动作”。
3. 完整 DB-backed runtime tests 需要本地 MySQL 恢复后再补跑。

## 6. 下一步

1. 恢复本地 MySQL 后，补跑完整 `npm run test` 和 `npm run e2e`。
2. 下一轮继续用 Computer Use 优先看真实页面，再用 Playwright 做可重复扫描。
3. 继续循环时优先扫 `/imports/crm`、`/settings`、`/diagnostics` 的登录态深层状态，而不是扩大到底层数据模型迁移。

# Helm Dynamic Detail Surface Disclosure Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted And Non-Destructive Validation Passed; Full DB-Backed Test Blocked By Local MySQL
当前切片：`Computer Use attempted; Playwright confirmed 24 dynamic detail routes across 48 desktop/mobile checks have zero target terms, zero horizontal overflow and zero filtered console errors; non-destructive guards/build/regression passed`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环处理动态详情页：

1. 继续尝试 Computer Use 读取 Safari / Atlas 浏览器窗口。
2. 在 Computer Use 仍不能抓取浏览器窗口时，用 Playwright 打开真实本地页面。
3. 把商业链路、导入结果、会议、公司/联系人对象页里的 `customer-facing / sendability / commitment / briefing / connector` 等默认层系统词收成中文判断语言。
4. 让动态详情页继续保留 frontstage 的“当前状态 / 待决策 / 下一步动作 / 边界”，把证据和解释留在可展开层。
5. 不改 recommendation / commitment 边界、发送权限、审批权限、CRM 导入契约、object truth、runtime trace truth 或数据模型。

## 2. 影响面

- `features/role-conversation-variants/display-copy.ts`
- `features/role-conversation-variants/display-copy.test.ts`
- `features/customer-facing-package-variants/detail-view.tsx`
- `features/package-stage-variants/detail-view.tsx`
- `features/commitment-reinforcement-sendability/detail-view.tsx`
- `features/commitment-reinforcement-variants/detail-view.tsx`
- `features/external-narrative-detail/detail-view.tsx`
- `features/commercial-narrative-strengthening/detail-view.tsx`
- `features/conversation-detail/detail-view.tsx`
- `features/sales-conversation-variants/detail-view.tsx`
- `features/delivery-conversation-variants/detail-view.tsx`
- `features/imports/display-copy.ts`
- `features/imports/import-job-detail-client.tsx`
- `features/internal-operating-workspace/display-copy.ts`
- `features/internal-operating-workspace/role-handoff-surface.tsx`
- `features/meetings/display-copy.ts`
- `features/meetings/meeting-detail-client.tsx`
- `features/companies/company-detail-client.tsx`
- `features/contacts/contact-detail-client.tsx`
- `docs/reviews/HELM_DYNAMIC_DETAIL_SURFACE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 中文默认层应服务经营判断和下一步动作，不应裸露内部治理枚举。
2. English 模式继续保留英文技术/治理语言；本轮只收中文默认层。
3. `recommendation != commitment` 和 `proactive != auto-send` 仍是底层边界，显示层只做用户可读翻译。
4. 动态详情页的证据组和交接链可以继续保留在页面内，但默认阅读路径必须先完成判断、动作和边界。

## 4. 风险

1. 显示词典如果继续扩大，可能误伤用户输入或专有名词；本轮限定在页面显示输出。
2. 商业详情模型仍保留英文枚举作为契约 truth；本轮不迁移模型字段和测试 fixture。
3. Computer Use 当前仍能列出 App，但 Safari/Atlas 窗口读取返回 `cgWindowNotFound`，不能写成完整桌面点击验收。
4. 本地 MySQL `127.0.0.1:3306` 当前不可达，完整 DB-backed runtime tests 不能完成。

## 5. 验证结果

- Computer Use：`list_apps` 可读；Safari / Atlas `get_app_state` 均返回 `cgWindowNotFound`。
- Playwright dynamic scan：24 routes × 2 viewports = 48 checks；目标系统词 0、横向溢出 0、过滤 HMR 后 console errors 0。
- `npm run test -- features/role-conversation-variants/display-copy.test.ts features/imports/display-copy.test.ts features/internal-operating-workspace/display-copy.test.ts features/meetings/display-copy.test.ts` passed；4 files / 8 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- 完整 `npm run test` attempted：265 files / 1134 tests passed；6 DB-backed Helm v2 runtime files / 15 tests failed because local MySQL `127.0.0.1:3306` is unreachable。
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用。
- `npm run e2e` 未执行：完整测试已证明 DB 前提不可用；本轮用 Playwright 动态路由扫描覆盖当前页面改动面。

## 6. 下一步

1. 恢复本地 MySQL 后再补完整 DB-backed `npm run test` 和 `npm run e2e`。
2. 继续循环时，把 strict scanner 扩到 `external-narrative-fallbacks`、`sales-objections`、`delivery-walkthroughs` 等剩余二层动态页。
3. Computer Use 继续尝试，但在 `cgWindowNotFound` 修复前，验收以 Playwright 真实页面扫描为主。

# Helm Demo Entry Disclosure Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted And Non-Destructive Validation Passed; DB-Backed Full Validation Blocked By Local MySQL
当前切片：`Computer Use attempted; Playwright confirmed /demo and 26 representative current/history routes have zero target terms and zero horizontal overflow on desktop/mobile; non-destructive guards/build/regression passed`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环处理公开演示入口：

1. 继续尝试 Computer Use 读取 Safari / Atlas 浏览器窗口。
2. 在 Computer Use 仍不能抓取浏览器窗口时，用 Playwright 走真实本地页面。
3. 把 `/demo` 中文默认层里的 `commitments / blockers / recommendation / workflow / LLM / capture / evolution / intelligence layer` 等系统词收成外部客户能直接理解的经营语言。
4. 修复 `/demo` 移动端顶部动作区和长卡片内容撑宽页面的问题。
5. 不改 demo account、login action、trial entry、workspace state、review/send boundary 或 recommendation/commitment 底层契约。

## 2. 影响面

- `app/demo/page.tsx`
- `lib/demo/demo-modes.ts`
- `lib/demo/demo-modes.test.ts`
- `docs/reviews/HELM_DEMO_ENTRY_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 验证结果

- Computer Use：`list_apps` 可读；Safari / Atlas bundle id `get_app_state` 均返回 `cgWindowNotFound`；`ChatGPT Atlas` 名称路径触发 MCP app approval denied，未能进入浏览器窗口控制。
- Playwright focused scan：`/demo` 在 desktop 1440x1100 和 mobile 390x900 下目标词 0、横向溢出 0、业务 console errors 0。
- Playwright crawled scan：19 routes × 2 viewports = 38 checks；issueCount 0。
- Playwright representative scan：26 current/history routes × 2 viewports = 52 checks；issueCount 0。
- `npm run test -- lib/demo/demo-modes.test.ts` passed。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `nc -z 127.0.0.1 3306` failed；本地 MySQL 当前不可达。
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用。
- 完整 `npm run test` / `npm run e2e` 未执行：当前 DB 前提不可用，本轮已用定向单测、守卫、构建和 Playwright 覆盖当前改动面。

## 4. 下一步

1. 恢复本地 MySQL 后再补完整 DB-backed `npm run test` 和 `npm run e2e`。
2. 继续循环时，把 scanner 扩到更多动态 detail routes，并区分默认可见前台与展开后的后台证据层。
3. Computer Use 对浏览器窗口仍不可用；后续继续尝试，但不要把它写成完整桌面点击验收。

# Helm Programs Public Catalog Disclosure Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted Validation Passed; DB-Backed Full Validation Blocked By Local MySQL
当前切片：`Computer Use attempted; Playwright confirmed /programs plus 3 public program detail routes have zero target terms, zero horizontal overflow and zero business console errors; broader 34 route x 2 viewport scan returned issueCount 0`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环处理扩大扫描中唯一剩余问题：

1. 继续尝试 Computer Use 读取 Safari / Atlas 浏览器窗口。
2. 在 Computer Use 仍返回 `cgWindowNotFound` 时，用 Playwright 走真实本地页面。
3. 把 `/programs` 公开参与目录和 3 条详情页里的 worker / marketplace / review / manual settlement 等英文系统词，收成中文对外可读表达。
4. 修复 `/programs` 移动端 header action 撑宽页面的问题。
5. 不改 partner program、application、review/invite、participant portal、settlement、payout、revenue attribution 或 reserved-workspace governance 的底层契约。

## 2. 影响面

- `app/programs/page.tsx`
- `app/programs/[slug]/page.tsx`
- `features/programs/program-application-form.tsx`
- `lib/billing/program-catalog.ts`
- `lib/billing/program-catalog-display.test.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/reviews/HELM_PROGRAMS_PUBLIC_CATALOG_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 验证结果

- Computer Use：`list_apps` 可读；Safari / Atlas `get_app_state` 均返回 `cgWindowNotFound`。
- Playwright focused scan：`/programs`、`/programs/worker-publisher-program`、`/programs/custom-partner-program`、`/programs/sales-referral-program` 在 desktop 1440x1100 和 mobile 390x900 下目标词 0、横向溢出 0、业务 console errors 0。
- Playwright broader scan：34 routes × 2 viewports = 68 checks；issueCount 0。
- `npm run test -- lib/billing/program-catalog-display.test.ts` passed。
- `npm run test -- lib/billing/program-catalog-display.test.ts lib/billing/foundation-service-governance.test.ts` passed；2 files / 11 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `nc -z 127.0.0.1 3306` failed；本地 MySQL 当前不可达。
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用。
- 完整 `npm run test` / `npm run e2e` 未执行：当前 DB 前提不可用，本轮已用定向单测、守卫、构建和 Playwright 覆盖当前改动面。

## 4. 下一步

1. 继续循环时，把 strict scanner 扩到更多动态 commercial/detail routes。
2. 内部 admin / settings 证据层可以继续保留治理术语；公开默认层继续用外部参与者能直接理解的中文。
3. 恢复本地 MySQL 后再补完整 DB-backed `npm run test` 和 `npm run e2e`。

# Helm Detail And Object Surface Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Non-Destructive Validation Passed; DB-Backed Full Validation Blocked By Local MySQL; Default Detail/Object Surfaces Now Zero Target Terms
当前切片：`Computer Use attempted; Playwright confirmed 9 representative detail/object routes across 18 desktop/mobile checks have zero horizontal overflow, zero business console errors, and zero default-visible target implementation terms after the final contact raw-JSON cleanup; non-destructive guards/build/regression passed; full DB tests are blocked by local MySQL`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环，把核心入口之后的 detail/object 页面收口：

1. 继续尝试 Computer Use 读取浏览器窗口。
2. 在 Safari 窗口仍不可用时，用 Playwright 走真实 `/demo` 入口复评。
3. 把 shared detail shell、review request、success/expansion detail、company/contact 对象页里的 `review request detail`、`customer success handoff`、`success check`、`expansion review`、`blocker`、`recommendation` 等系统词收成中文判断语言。
4. 修复 `/meetings/:id` backend runtime 卡片在移动端被长 checkpoint/source token 撑宽的问题。
5. 修复 `/contacts/:id` 对象摘要把 briefing payload JSON 直接渲染到默认页面的问题。
6. 不改对象 truth、运行时状态机、审批权限、official write 权限、recommendation/commitment 边界或 memory/write contract。

## 2. 影响面

- `features/role-conversation-variants/display-copy.ts`
- `features/role-conversation-variants/display-copy.test.ts`
- `features/role-conversation-variants/detail-shell.tsx`
- `features/role-conversation-variants/agent-surface-detail-view.tsx`
- `features/conversation-chain-extension/detail-view.tsx`
- `components/shared/unified-detail-navigation-panel.tsx`
- `components/recommendations/recommendation-judgement-card.tsx`
- `features/meetings/display-copy.ts`
- `features/meetings/display-copy.test.ts`
- `features/meetings/meeting-detail-client.tsx`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/companies/company-detail-client.tsx`
- `features/contacts/contact-detail-client.tsx`
- `lib/navigation/breadcrumb-trail.ts`
- `lib/navigation/breadcrumb-trail.test.ts`
- `app/globals.css`
- `docs/reviews/HELM_DETAIL_OBJECT_SURFACE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. Detail/object 首屏应继续遵守“当前状态 / 待决策 / 下一步动作 / 边界”的中文默认层，不应裸露实现词。
2. English 模式保留原技术/治理语言；本轮只收中文默认层。
3. Meeting v2 runtime 的长 checkpoint/source id 是真实 backend evidence，不能改底层 truth；本轮只修布局和局部显示层。
4. `recommendation != commitment` 的底层边界必须继续保留；显示层可以把中文默认页里的 recommendation 读成“建议”。

## 4. 风险

1. 显示层替换如果过宽，可能误伤用户输入；本轮集中在 role/detail、meeting、object page 和 recommendation card 的显示输出。
2. Meeting detail 的 runtime/debugger evidence 文本很深；本轮已经默认折叠到后台证据层，展开后仍可能保留 raw runtime terms 作为真实 trace。
3. Contact briefing summary 可能来自历史 JSON payload；本轮只规范前台摘要显示，不迁移历史数据。
4. Computer Use 当前仍能列出 App，但 Safari/Atlas 窗口读取返回 `cgWindowNotFound`，不能写成完整桌面点击验收。
5. 本地 MySQL 仍是完整 DB runtime validation 的外部前提。

## 5. 验证结果

- `npm run test -- features/role-conversation-variants/display-copy.test.ts features/meetings/display-copy.test.ts lib/navigation/breadcrumb-trail.test.ts` passed。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- Focused Playwright `/review-requests/:id`、`/companies/:id`、`/contacts/:id` 桌面/移动复扫 passed：目标词 0、横向溢出 0。
- Representative Playwright 9 route detail/object scan passed：
  - `/customer-success/:id`、`/success-checks/:id`、`/expansion-reviews/:id`、`/review-requests/:id`、`/meetings/:id`、`/companies/:id`、`/contacts/:id`、`/inbox/:id`、`/approvals?...` 默认可见目标词 0。
  - `/meetings/:id` 已把 backend/runtime trace evidence 默认收进“后台运行证据” disclosure；展开后仍能查看真实 trace。
  - 9/9 routes 横向溢出 0。
  - 9/9 routes 业务 console errors 0。
- Focused Playwright `/meetings/:id` corrected visibility scan passed：desktop 1440x1200 和 mobile 390x1100 默认可见目标词 0、横向溢出 0、业务 console error 0。
- Focused Playwright `/contacts/:id` after raw briefing JSON cleanup passed：desktop 1440x1200 和 mobile 390x1100 默认可见目标词 0、横向溢出 0。
- Final strict Playwright batch scan after contact cleanup passed：9 routes × 2 viewports = 18 checks；hitCount 0、overflow 0、business consoleErrors 0。
- `npm run test` attempted；264 files / 1129 tests passed，6 DB-backed Helm v2 runtime files / 15 tests failed because local MySQL `127.0.0.1:3306` is unreachable。
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用。
- `npm run e2e` 未执行：当前完整测试已证明 MySQL 前提不可用；本轮已用定向 Playwright 覆盖代表 detail/object 页面桌面/移动真实 Demo 流程。

## 6. 下一步

1. 继续循环时，使用 corrected visibility scanner 复扫更多代表路由，避免把已折叠证据误判成默认可见问题。
2. 展开后台证据层时，只对真正影响 operator 阅读的 runtime trace 继续做显示层本地化，不改底层 trace truth。
3. 恢复本地 MySQL 后再补完整 `npm run test`、`npm run e2e`；`db:reset` 仍需明确接受本地数据重置后再跑。

# Helm Core Surface Disclosure Computer Use Closeout v1

更新时间：2026-04-21
状态：Validation Passed For Targeted Surfaces And Non-Destructive Repository Guards
当前切片：`Computer Use attempted; Playwright confirmed 10 core routes have zero target system terms, zero desktop/mobile overflow, and zero business console errors`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环，把上一轮扫描仍有残留的 `/capture`、`/operating`、`/search`、`/diagnostics`、`/customer-success` 收口，并回归扫描 `/imports/crm`、`/meetings`、`/memory`、`/opportunities`、`/approvals`。

## 2. 影响面

- `features/conversation-capture/display-copy.ts`
- `features/conversation-capture/display-copy.test.ts`
- `app/(workspace)/capture/page.tsx`
- `features/conversation-capture/capture-result-panel.tsx`
- `features/conversation-capture/capture-session-panel.tsx`
- `features/internal-operating-workspace/display-copy.ts`
- `features/internal-operating-workspace/display-copy.test.ts`
- `app/(workspace)/search/page.tsx`
- `features/diagnostics/display-copy.ts`
- `features/diagnostics/display-copy.test.ts`
- `features/customer-success-handoff/display-copy.ts`
- `features/customer-success-handoff/display-copy.test.ts`
- `docs/reviews/HELM_CORE_SURFACE_DISCLOSURE_COMPUTER_USE_CLOSEOUT_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. 中文默认层应优先回答“当前状态、待判断、下一步动作、边界”，不是展示 transcript / recommendation / workflow / memory write 等系统实现词。
2. English 模式保留原有技术/治理语言；本轮只压中文默认层。
3. 诊断页的 memory-write boundary note 是内部 truth，不能改底层契约；只在诊断显示层转换。
4. 客户成功页的回写提示应表达成“成功记忆 / 主线”，不再裸露 success memory / campaign。

## 4. 风险

1. 显示层替换必须避免改写真实执行状态、权限边界、底层枚举和审计载荷。
2. 过度泛替换可能误伤用户内容；本轮新增映射集中在已有页面 display-copy 层和默认演示文本。
3. Computer Use 仍只能列出应用，读取 Safari 窗口状态返回 `cgWindowNotFound`，不能写成完整桌面点击验收。
4. 本地 MySQL 仍是完整 DB runtime validation 的外部前提。

## 5. 验证结果

- `npm run test -- features/conversation-capture/display-copy.test.ts features/internal-operating-workspace/display-copy.test.ts features/meetings/display-copy.test.ts` passed。
- `npm run test -- features/diagnostics/display-copy.test.ts features/customer-success-handoff/display-copy.test.ts` passed。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `git diff --check` passed。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- Playwright 10 route scan passed：`/capture`、`/operating`、`/search`、`/diagnostics`、`/customer-success`、`/imports/crm`、`/meetings`、`/memory`、`/opportunities`、`/approvals` 在 desktop 1440x1100 和 mobile 390x844 下目标系统词计数 0、横向溢出 0、业务 console errors 0。
- `nc -z 127.0.0.1 3306` failed；本地 MySQL 当前不可达，所以完整 `npm run test` / `npm run e2e` 的 DB 前提仍未满足。
- `npm run db:reset` 未执行：这是本地数据重置，且当前数据库前提不可用。

## 6. 下一步

1. 如继续循环，转向二级/detail 页面做视觉和文案扫描，不再重复压这 10 个当前已清零的核心入口。
2. 恢复本地 MySQL 后，再补完整 `npm run test`、`npm run e2e`；`db:reset` 需要在确认可接受本地数据重置后执行。

# Helm Imports CRM And Meetings Computer Use Polish Continuation v1

更新时间：2026-04-21
状态：Validation Passed For Targeted Surfaces; Full DB Test Blocked By Local MySQL
当前切片：`Computer Use attempted; Playwright confirmed /imports/crm and /meetings Chinese default surfaces expose zero target implementation terms and no desktop/mobile page overflow`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环推进剩余高命中页面：

1. 继续尝试 Computer Use 读取真实浏览器窗口。
2. 在 Computer Use 浏览器窗口不可用时，用 Playwright 走 `/demo` 的创始人 / COO Demo 真实入口，再扫描目标页面。
3. 把 `/imports/crm` 默认层里的 ingress、warmup、preview、connector、operator、review-first、recommendation-first 等实现词，收成中文导入判断语言。
4. 把 `/meetings` 默认层里的 briefing、review、blocker、posture、Meeting OS wedge 等实现词，收成中文会议推进语言。
5. 不改 CRM 导入写路径、会议数据模型、审批权限、连接器行为、执行权限或底层枚举 truth。

## 2. 影响面

- `features/imports/display-copy.ts`
- `features/imports/display-copy.test.ts`
- `features/imports/crm-import-client.tsx`
- `features/meetings/display-copy.ts`
- `features/meetings/display-copy.test.ts`
- `app/(workspace)/meetings/page.tsx`
- `lib/i18n/messages.ts`
- `docs/reviews/HELM_IMPORTS_CRM_INGRESS_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/reviews/HELM_MEETINGS_OVERVIEW_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/imports/crm` 默认层应让用户判断“来源是否可信、冲突是否要先处理、下一步是否该预览或导入”，不是直接暴露 connector / ingress 实现语。
2. `/meetings` 默认层应让用户判断“先开哪场会、会后压力在哪、是否需要复核”，不是直接暴露 Meeting OS / review / posture 语。
3. English 模式保留原技术表达；本轮只收中文默认层和演示数据里的可见系统词。
4. 演示数据中的 `panel briefing` 是默认可见内容，需要经过同一显示层转换。

## 4. 风险

1. 显示层中文化不能改变底层导入、会议、审批或权限状态机。
2. 过度泛替换用户输入可能误伤真实客户内容；本轮只在页面默认文案和会议议程展示处使用窄转换。
3. Computer Use 当前能列出 App，但 Safari / Atlas 窗口读取仍返回 `cgWindowNotFound`，不能把本轮写成“Computer Use 完整点击验证”。
4. 本地 MySQL `127.0.0.1:3306` 不可达，完整 DB runtime tests 与 `db:reset / e2e` 仍需在数据库前提恢复后补跑。

## 5. 验证结果

- `npm run test -- features/imports/display-copy.test.ts` passed。
- `npm run test -- features/meetings/display-copy.test.ts features/imports/display-copy.test.ts` passed；2 files / 2 tests。
- `npm run typecheck` passed。
- Playwright `/imports/crm` 创始人 Demo 桌面 1440x1100：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`。
- Playwright `/imports/crm` 创始人 Demo 移动 390x844：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`。
- Playwright `/meetings` 创始人 Demo 桌面 1440x1100：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，`bodyDelta = 0`，console errors 0。
- Playwright `/meetings` 创始人 Demo 移动 390x844：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，`bodyDelta = 0`，console errors 0。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `git diff --check` passed。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run test` attempted；262 files / 1123 tests passed，6 DB-backed Helm v2 runtime test files / 15 tests failed because local MySQL `127.0.0.1:3306` is unreachable.
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用。
- `npm run e2e` 未执行：当前完整测试已证明 MySQL 前提不可用；本轮已用定向 Playwright 覆盖两个页面桌面/移动真实 Demo 流程。

## 6. 下一步

1. 如继续循环，优先处理真实登录扫描里仍有命中的 `/capture`、`/diagnostics`、`/operating`、`/search`。
2. 恢复本地 MySQL 后，补跑 `npm run db:reset`、`npm run test` 与 `npm run e2e`。
3. 如果 Computer Use 仍返回 `cgWindowNotFound`，继续记录工具限制，并保持 Playwright 作为可重复验证主路径。

# Helm Settings Default Surface Computer Use Polish Continuation v1

更新时间：2026-04-21
状态：Validation Passed; Full DB / E2E Not Run In This Slice
当前切片：`Computer Use attempted; Playwright confirmed /settings default account surface no longer exposes target LLM/provider/model/prompt/review terms and has no desktop/mobile page overflow`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环推进 `/settings`：

1. 继续尝试 Computer Use 读取真实浏览器窗口。
2. 在 Computer Use 浏览器窗口不可用时，用 Playwright 登录 demo 后操作真实本地页面。
3. 把 `/settings` 默认账户页里的 raw provider、model、prompt registry、recommendation / review wording 收成中文设置判断语言。
4. 不改设置写入、权限、provider registry、model config、prompt registry 或连接器配置。

## 2. 影响面

- `features/settings/display-copy.ts`
- `features/settings/display-copy.test.ts`
- `features/settings/components/account-settings-tab.tsx`
- `features/settings/settings-client.tsx`
- `features/settings/setup-wizard.tsx`
- `docs/reviews/HELM_SETTINGS_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/settings` 的默认层应让用户判断“当前设置是否能支撑试点和经营动作”，不是直接阅读模型服务和提示词注册表。
2. provider、model、prompt registry 仍是底层配置真值；中文前台可以把它们映射成业务可读状态。
3. English 模式仍保留更技术化的 provider / model / prompt wording；本轮只收中文默认层。

## 4. 风险

1. 过度隐藏模型名可能降低排障效率；本轮只处理默认中文前台，不删除底层配置对象。
2. `AccountSettingsTab` 是账户页默认区域，文案收敛要避免影响 billing / connectors / permissions 的行为。
3. Computer Use 当前不能稳定读取浏览器窗口，不能把本轮写成“Computer Use 完整点击验证”。

## 5. 验证结果

- `npm run test -- features/settings/display-copy.test.ts` passed；1 file / 2 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `git diff --check` passed。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- Playwright `/settings` 默认页桌面 1440x1100：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。
- Playwright `/settings` 默认页移动 390x844：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。

## 6. 下一步

1. 如继续循环，优先从核心路由扫描里挑剩余命中最高的 `/reports`、`/imports/crm` 或 `/meetings`。
2. 在数据库前提可控时再补 `npm run db:reset` 和 `npm run e2e`。

# Helm Memory Governance Default Surface Computer Use Polish Continuation v1

更新时间：2026-04-21
状态：Validation Passed; Full DB / E2E Not Run In This Slice
当前切片：`Computer Use attempted; Playwright confirmed /memory default surface no longer exposes target review/system terms except brand/proper noun AI mentions and has no desktop/mobile page overflow`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环推进 `/memory`：

1. 继续尝试 Computer Use 读取真实浏览器窗口。
2. 在 Computer Use 浏览器窗口不可用时，用 Playwright 登录 demo 后操作真实本地页面。
3. 把 `/memory` 默认可见层剩余的 `review / review posture / review-only / operating context / AI 经营记忆汇报 / 系统持续汇报` 收成中文经营记忆语言。
4. 不改记忆写入、确认、纠错、导出、审计载荷、查询或权限边界。

## 2. 影响面

- `features/memory/memory-client.tsx`
- `features/memory/display-copy.ts`
- `features/memory/display-copy.test.ts`
- `lib/operating-system/object-state.ts`
- `lib/operating-system/index.test.ts`
- `lib/presentation/workspace-story.ts`
- `docs/reviews/HELM_MEMORY_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/memory` 的默认层应帮助用户判断记忆是否可信、是否需要修正、是否要带进下一步动作。
2. `Atlas AI` 是种子对象名，产品品牌语里的 `AI` 是品牌定位，不按系统自述残留处理。
3. 会议记忆治理 helper 可以收敛中文显示文案，但底层 `review-only / pending-review` 枚举必须保留。

## 4. 风险

1. `lib/operating-system/object-state.ts` 被多个页面复用，中文文案要收敛但不能改变状态机语义。
2. Raw audit JSON 里仍会出现真实对象名 `Atlas AI`，不应被泛替换。
3. Computer Use 当前不能稳定读取浏览器窗口，不能把本轮写成“Computer Use 完整点击验证”。

## 5. 验证结果

- `npm run test -- features/memory/display-copy.test.ts lib/operating-system/index.test.ts` passed；2 files / 16 tests。
- `npm run typecheck` passed。
- Computer Use：`list_apps` 可读；Safari 激活并打开 `/memory` 后 `get_app_state` 仍返回 `cgWindowNotFound`；Finder 窗口读取被 MCP approval denied。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `git diff --check` passed。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- Playwright `/memory` 默认页桌面 1440x1100：除品牌语与种子对象名 `Atlas AI` 外，目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。
- Playwright `/memory` 默认页移动 390x844：除种子对象名 `Atlas AI` 外，目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。

## 6. 下一步

1. 如继续循环，优先从核心路由扫描里挑剩余命中最高的 `/settings`、`/reports` 或 `/diagnostics`。
2. 在数据库前提可控时再补 `npm run db:reset` 和 `npm run e2e`。

# Helm Approvals Default Surface Computer Use Polish Continuation v1

更新时间：2026-04-21
状态：Validation Passed; Full DB / E2E Not Run In This Slice
当前切片：`Computer Use attempted; Playwright confirmed /approvals default surface no longer exposes target internal system terms and has no desktop/mobile page overflow`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环推进 `/approvals`：

1. 继续尝试 Computer Use 读取真实浏览器窗口。
2. 在 Computer Use 浏览器窗口不可用时，用 Playwright 登录 demo 后操作真实本地页面。
3. 把 `/approvals` 默认可见层剩余的 `skill / proposal / review-first / review-only / Customer-visible` 等内部词收成中文复核语言。
4. 不改审批状态机、权限、审计、写路径或自动执行边界。

## 2. 影响面

- `features/approvals/approvals-client.tsx`
- `features/approvals/approval-learning-display.ts`
- `features/approvals/approval-learning-display.test.ts`
- `lib/worker-skill-resource/presentation.ts`
- `lib/worker-skill-resource/presentation.test.ts`
- `lib/operating-system/object-state.ts`
- `lib/operating-system/index.test.ts`
- `lib/presentation/workspace-story.ts`
- `docs/reviews/HELM_APPROVALS_REVIEW_PATH_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/approvals` 的默认层应先服务“做复核判断”，不是展示 worker / skill / contract 结构。
2. `Atlas AI` 是种子对象名，产品品牌语里的 `AI` 是品牌定位，不按系统自述残留处理。
3. Computer Use 当前能列应用，但 Safari / Atlas 窗口状态仍可能被 macOS accessibility / window bridge 阻断；验证闭环必须保留 Playwright 兜底。

## 4. 风险

1. 过度替换可能误伤英文模式或真实客户对象名。
2. 会议记忆治理摘要被多个页面复用，需要只收中文显示层，不改变治理状态枚举。
3. Computer Use 当前不能稳定读取浏览器窗口，不能把本轮写成“Computer Use 完整点击验证”。

## 5. 验证结果

- Computer Use：`list_apps` 可读；Safari / Atlas `get_app_state` 均返回 `cgWindowNotFound`；Codex App 因安全策略不可控制。
- `npm run test -- features/approvals/approval-learning-display.test.ts features/approvals/approval-first-loop-display.test.ts features/approvals/approval-draft-display.test.ts lib/worker-skill-resource/presentation.test.ts lib/operating-system/index.test.ts` passed；5 files / 22 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `git diff --check` passed。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- Playwright `/approvals` 默认页桌面 1440x1100：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。
- Playwright `/approvals` 默认页移动 390x844：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0。

## 6. 下一步

1. 如继续循环，优先从核心路由扫描里挑剩余命中最高的 `/capture`、`/settings` 或 `/memory`。
2. 在数据库前提可控时再补 `npm run db:reset` 和 `npm run e2e`。

# Helm Opportunities Board Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed; Full DB Tests Blocked
当前切片：`Computer Use attempted; Playwright review confirmed /opportunities now removes default Chinese-system terms and responsive overflow from the opportunity board surface`

## 1. 目标

这次继续处理 `/opportunities` 默认前台：

1. 继续尝试 Computer Use 读取浏览器窗口；不可用时用 Playwright 操作真实本地页面复评
2. 把 `pipeline / proposal / package / formal review / review-before-send / blocker / commitment / replay / flow / skill / worker` 等默认中文系统语收成经营判断语言
3. 把看板从强制横向拉宽改成响应式换行，避免桌面默认层被阶段列撑出视口
4. 给共享证据抽屉补移动端宽度约束，避免 `回放载荷 / 审计载荷 / 记忆载荷 / 交接载荷` 卡片溢出
5. 保留拖拽、详情、主动协作、报告协议和证据下钻，不改机会写路径或权限边界

## 2. 本轮不做

- 不改 opportunity schema、stage enum、owner 分配、拖拽写路径或 bulk update 行为
- 不删除报告协议、worker / skill / resource 证据或主动协作机制
- 不扩大对外发送、自动承诺或自动执行权限
- 不把 `/opportunities` 改成完整 CRM、BI 或 workflow 平台

## 3. 影响面

- `features/opportunities/opportunities-client.tsx`
- `features/opportunities/display-copy.ts`
- `features/opportunities/display-copy.test.ts`
- `components/shared/narrative-components.tsx`
- `components/shared/proactive-mechanism-panel.tsx`
- `docs/README.md`
- `docs/reviews/HELM_OPPORTUNITIES_BOARD_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/opportunities` 第一屏已经有 business-first 四类摘要，本轮主要修后续默认层的系统词和布局摩擦
2. 中文模式的协议、证据和主动协作可以通过 display helper 转成经营语言，底层 enum / id / href 不需要改
3. 看板响应式换行比横向强制拉宽更符合当前“先判断和动作，再看解释”的页面契约
4. 共享证据抽屉的移动端约束是兼容增强，不改变数据或权限

## 5. 验证方案

```bash
npm run test -- features/opportunities/display-copy.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts lib/presentation/business-loop-gap-readout-guard.test.ts lib/presentation/decision-first-ia.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari 窗口状态
- 用 Playwright 登录 demo 并打开 `http://127.0.0.1:3000/opportunities`
- 检查默认层不再出现 `review-before-send / formal review / owner-focused / action workspace / pipeline / proposal / package / blocker / commitment / replay / flow / skill / worker / customer-facing / customer-visible`
- 检查桌面 1440px 与移动 390px 可见元素无横向溢出

当前已执行结果：

- Computer Use：应用列表可读；Safari 仍返回 `cgWindowNotFound`
- `npm run test -- features/opportunities/display-copy.test.ts` passed；1 file / 4 tests passed
- `npm run test -- features/opportunities/display-copy.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts lib/presentation/business-loop-gap-readout-guard.test.ts lib/presentation/decision-first-ia.test.ts` passed；4 files / 30 tests passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed；existing Turbopack NFT warning remains
- `npm run quality:regression` passed；51 files / 180 tests passed
- `git diff --check` passed
- Playwright 桌面复评 passed；禁词计数全部为 0，可见元素横向溢出数 0
- Playwright 移动复评 passed；禁词计数全部为 0，可见元素横向溢出数 0
- `npm run test` full suite did not complete because local MySQL was unavailable at `127.0.0.1:3306`; Vitest reported 6 DB-backed Helm v2 runtime files failed at Prisma fixture creation, with 256 files / 1103 tests already passing before the DB-dependent failures
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用
- `npm run e2e` 未执行：当前 full test 已暴露本地 MySQL 前提不可用，本轮 Playwright 已完成 `/opportunities` 桌面/移动页面复评

## 6. 主要风险

1. 横向阶段总览改成响应式换行后，一次性横扫所有阶段的感觉会弱一些
2. 显示格式化层不改变底层协议真值，审计层仍会保留英文 enum / id / href
3. Computer Use 当前仍无法稳定读取 Safari 窗口，后续需要继续每轮尝试并保留 Playwright 兜底
4. 全量 DB-backed runtime 测试需要本地 MySQL 先恢复；本轮未改变这些 runtime 路径，失败点是测试环境连接前提

# Helm Customer Success Detail Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Validation Passed
当前切片：`Computer Use attempted; Playwright review confirmed /customer-success/[id] now keeps cross-detail handoffs and external drafts behind disclosures while the default detail surface uses Chinese judgement-first language`

## 1. 目标

这次继续处理 `/customer-success/[id]` 默认前台的系统语和交接链铺阵：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari / Atlas 不可用时，用 Playwright 操作真实本地页面复评
2. 把详情页的 customer-success protocol 语言转成中文经营判断语言
3. 把跨详情交接链改为默认关闭，只在用户需要完整链路时展开
4. 把对外草稿改为默认关闭，避免默认层先读客户可见措辞
5. 保留下一步动作、内部批准按钮、边界、上一段/下一段详情入口和证据抽屉
6. 检查桌面和 390px 移动视口默认层无横向溢出

## 2. 本轮不做

- 不改 customer-success detail model、review task、external draft 或 post-send outcome 派生口径
- 不删除跨详情交接、草稿、治理进度或证据，只改变默认展示层级
- 不扩大对外发送、自动承诺或自动执行权限
- 不做完整 customer-success 平台，也不新增 canonical customer-success object

## 3. 影响面

- `features/customer-success-handoff/detail-view.tsx`
- `features/customer-success-handoff/display-copy.ts`
- `features/customer-success-handoff/external-drafts-panel.tsx`
- `components/shared/unified-detail-navigation-panel.tsx`
- `lib/operating-system/foundation.ts`
- `lib/operating-system/foundation.test.ts`
- `lib/presentation/customer-success-handoff-v1_1.test.ts`
- `docs/README.md`
- `docs/reviews/HELM_CUSTOMER_SUCCESS_DETAIL_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/customer-success/[id]` 默认层应先服务当前判断、待拍板、下一步和边界
2. 跨详情交接、对外草稿、治理进度和完整证据属于附注层，不应默认压过详情操作
3. 中文模式下的 detail / handoff / sendability / policy / review-before-send 应转成中文经营语言
4. 本轮是展示层调整，不改变 customer success 数据模型、外发权限或审批边界

## 5. 验证方案

```bash
npm run test -- features/customer-success-handoff/display-copy.test.ts lib/operating-system/foundation.test.ts lib/presentation/customer-success-handoff-surface-contract.test.ts lib/presentation/customer-success-handoff-v1_1.test.ts lib/presentation/customer-success-deeper-polish.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari / Atlas 窗口状态
- 用 Playwright 登录 demo 并打开 `http://localhost:3000/customer-success/cmnzwr56h001g7ntg8qwm004u`
- 检查默认层不再出现 `customer success / Customer success / review-before-send / follow-through / owner / commitment / blocker / sendability / policy / detail / pressure / dedicated / company / evidence / expansion`
- 检查 `跨详情交接` 和 `已准备外部草稿` 默认关闭
- 检查桌面 1440px 与移动 390px 的 `scrollWidth === clientWidth`，可见元素无横向溢出

已执行结果：

- `npm run test -- features/customer-success-handoff/display-copy.test.ts lib/operating-system/foundation.test.ts lib/presentation/customer-success-handoff-surface-contract.test.ts lib/presentation/customer-success-handoff-v1_1.test.ts lib/presentation/customer-success-deeper-polish.test.ts` passed；5 files / 32 tests passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed; existing Turbopack NFT warning remains
- `npm run quality:regression` passed; 51 files / 180 tests passed
- `git diff --check` passed
- Playwright 桌面复评 passed；默认层禁词计数为 0，`scrollWidth === clientWidth`
- Playwright 移动复评 passed；默认层禁词计数为 0，`scrollWidth === clientWidth`
- Computer Use：Safari 仍返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝；本轮真实页面复核由 Playwright 完成

## 6. 主要风险

1. 重度治理审计用户需要多一步展开跨详情交接和对外草稿
2. 底层 detail model 与证据层仍保留内部 protocol 真值，这是审计层的刻意保留
3. Computer Use 当前仍无法稳定读取浏览器窗口，后续需要继续每轮尝试，并保留 Playwright 兜底

# Helm Customer Success Queue Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Validation Passed
当前切片：`Computer Use attempted; Playwright review confirmed /customer-success now keeps queue governance evidence behind disclosure while the default surface uses Chinese judgement-first language`

## 1. 目标

这次继续处理 `/customer-success` 默认前台的系统语和高密度治理卡片：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari / Atlas 不可用时，用 Playwright 操作真实本地页面复评
2. 把 `Customer Success Queue / Inbox v1.1`、`customer success handoff`、`review-before-send`、`follow-through`、`owner`、`commitment` 等默认中文页系统语收成用户能判断的中文经营语言
3. 保留每张队列卡的授权、注意事项、草稿、复核结果、发送交接和证据摘要，但默认折叠到“治理证据”
4. 默认队列卡只保留当前判断、卡点、下一步、边界和接手负责人，避免用户先读完整治理协议再操作
5. 检查桌面和 390px 移动视口默认层无横向溢出

## 2. 本轮不做

- 不改 customer-success queue / inbox 的派生模型、排序、review task、external draft 或 post-send outcome 口径
- 不删除治理证据，只改变默认展示层级
- 不扩大对外发送、自动承诺或自动执行权限
- 不做完整 customer-success 平台，也不新增 canonical customer-success object

## 3. 影响面

- `features/customer-success-handoff/queue-view.tsx`
- `features/customer-success-handoff/display-copy.ts`
- `features/customer-success-handoff/display-copy.test.ts`
- `docs/README.md`
- `docs/reviews/HELM_CUSTOMER_SUCCESS_QUEUE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/customer-success` 默认层应先服务当前判断、待拍板、下一步和边界
2. 授权状态、草稿状态、复核结果和发送交接属于治理证据层，不应默认压过队列操作
3. 中文模式下的 queue / inbox / handoff / review-before-send 应转成中文经营语言
4. 本轮是展示层调整，不改变 customer success 数据模型、外发权限或审批边界

## 5. 验证方案

```bash
npm run test -- features/customer-success-handoff/display-copy.test.ts lib/presentation/customer-success-handoff-surface-contract.test.ts lib/presentation/customer-success-handoff-v1_1.test.ts lib/presentation/customer-success-deeper-polish.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari / Atlas 窗口状态
- 用 Playwright 登录 demo 并打开 `http://localhost:3000/customer-success`
- 检查默认层不再出现 `customer success / Customer Success / review-before-send / follow-through / owner / commitment / blocker / Queue / Inbox / canonical system of record / operational surface`
- 检查默认层显示 `客户成功接手队列`
- 检查每张队列卡显示默认关闭的 `治理证据`
- 检查展开 `治理证据` 后，授权边界、复核结果、证据摘要仍可见
- 检查桌面 1440px 与移动 390px 的 `scrollWidth === clientWidth`，可见元素无横向溢出

已执行结果：

- `npm run test -- features/customer-success-handoff/display-copy.test.ts lib/presentation/customer-success-handoff-surface-contract.test.ts lib/presentation/customer-success-handoff-v1_1.test.ts lib/presentation/customer-success-deeper-polish.test.ts` passed；4 files / 30 tests passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed; existing Turbopack NFT warning remains
- `npm run quality:regression` passed; 51 files / 180 tests passed
- `git diff --check` passed
- Playwright 桌面复评 passed；默认层禁词计数为 0，`治理证据` disclosure 12 个，展开后治理证据仍可见
- Playwright 移动复评 passed；390px 宽度 `scrollWidth === clientWidth`，可见元素无横向溢出，默认层禁词计数为 0
- Computer Use：Safari 仍返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝；本轮真实页面复核由 Playwright 完成

## 6. 主要风险

1. 重度治理审计用户需要多一步展开每张卡片的证据
2. 底层 detail model 与证据层仍保留内部 protocol 真值，这是审计层的刻意保留
3. Computer Use 当前仍无法稳定读取浏览器窗口，后续需要继续每轮尝试，并保留 Playwright 兜底

# Helm Operating Runtime Evidence Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Validation Passed
当前切片：`Computer Use attempted; Playwright review confirmed /operating now keeps runtime operator queues behind backstage evidence while the default operating surface uses localized judgement-first language`

## 1. 目标

这次继续处理 `/operating` 默认前台的系统语和后台队列外露问题：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari / Atlas 不可用时，用 Playwright 操作真实本地页面复评
2. 把 `RuntimeOperatorPanel` 从默认经营阅读流后置到默认关闭的“后台运行证据”
3. 保留 runtime operator queue、continuity、calibration、多代理痕迹等后台证据，用户展开后仍可审计
4. 把 `Operating -> first loop` 改成 `经营复核路径`
5. 把 first-loop 中文源头里的 `review gate / first-loop checkpoint / recommendation / commitment / memory trace` 收成中文经营判断语言
6. 把 operating foundation 中文层里的 `Constitution / Memory / workflow engine / customer / prospect / operating charter` 收成组织经营基线语言
7. 在 `/operating` 展示层把 `Founder / Leads / sales / delivery / success / candidate / champion / follow-through` 等混杂词收成中文角色、对象和推进语言
8. 检查桌面和 390px 移动视口默认层无横向溢出

## 2. 本轮不做

- 不改 runtime operator read model、continuity、swarm、多代理或运行队列数据口径
- 不删除后台证据，只改变默认展示层级
- 不扩大自动执行、自动外发或 runtime 权限
- 不做全站术语清理；本轮只处理 `/operating` 默认前台和相关共享 first-loop / operating foundation 中文输出

## 3. 影响面

- `features/internal-operating-workspace/internal-operating-home.tsx`
- `features/internal-operating-workspace/object-card.tsx`
- `features/internal-operating-workspace/display-copy.ts`
- `features/internal-operating-workspace/display-copy.test.ts`
- `lib/operating-system/first-loop.ts`
- `lib/operating-system/first-loop-query.ts`
- `lib/operating-system/foundation.ts`
- `lib/operating-system/foundation.test.ts`
- `docs/README.md`
- `docs/reviews/HELM_OPERATING_RUNTIME_EVIDENCE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/operating` 默认层应先服务经营判断、待决策和下一步动作
2. runtime operator 队列是重要证据，但属于 backstage，不应该默认打断经营工作流
3. 中文模式下的 first-loop / operating foundation 应给用户中文经营语言，而不是暴露内部 protocol 名称
4. 本轮是展示层和文案层调整，不改变 runtime 权限、数据模型或运行链路

## 5. 验证方案

```bash
npm run test -- features/internal-operating-workspace/display-copy.test.ts lib/operating-system/first-loop.test.ts lib/operating-system/foundation.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari / Atlas 窗口状态
- 用 Playwright 登录 demo 并打开 `http://localhost:3000/operating`
- 检查默认层不再出现 `runtime operator queues / operator surface / first-loop / review gate / recommendation / commitment / workflow / Founder / Leads / customer success / candidate pipeline / proposal readiness`
- 检查默认层显示 `经营复核路径`、`后台运行证据`，且后台证据默认关闭
- 检查展开“后台运行证据”后，runtime operator queue 仍可见
- 检查桌面 1440px 与移动 390px 的 `scrollWidth === clientWidth`，可见元素无横向溢出

已执行结果：

- `npm run test -- features/internal-operating-workspace/display-copy.test.ts lib/operating-system/first-loop.test.ts lib/operating-system/foundation.test.ts` passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed; existing Turbopack NFT warning remains
- `npm run quality:regression` passed; 51 files / 180 tests passed
- `git diff --check` passed
- Playwright 桌面复评 passed；默认层禁词计数为 0，后台证据默认关闭，展开后 runtime queue 仍可见
- Playwright 移动复评 passed；390px 宽度 `scrollWidth === clientWidth`，可见元素无横向溢出，后台证据默认关闭且可展开
- Computer Use：Safari 仍返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝；本轮真实页面复核由 Playwright 完成

## 6. 主要风险

1. 需要查看 runtime operator 细节的内部用户多一步展开
2. 底层 runtime panel 内部仍保留英文 protocol 和状态枚举，这是后台审计证据层的刻意保留
3. Computer Use 当前仍无法稳定读取浏览器窗口，后续需要继续每轮尝试，并保留 Playwright 兜底

# Helm Reports Engineering Evidence Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
当前切片：`Computer Use attempted; Playwright review confirmed reports engineering summary now keeps identity and raw volume evidence behind disclosure while using qualitative judgement language by default`

## 1. 目标

这次继续处理 `/reports` 工程交付摘要里的贡献者卡片密度：

1. 继续尝试 Computer Use 读取浏览器窗口；在 Safari / Atlas 不可用时，用 Playwright 操作真实本地页面完成同等复评
2. 把贡献者邮箱从默认前台移入“证据明细”
3. 把提交数、文件数、活跃日、行改动、重复文件率等 raw metric 从默认前台移入“证据明细”
4. 默认卡片只保留贡献者、当前节奏、最近动作、方向、闭环、交付判断和下一步建议
5. 保留证据可追溯：用户展开后仍能看到邮箱和 raw metric
6. 追加清理 reports 可见层残留的 `reduced-motion`、`commit 历史`、`共享文件 pair`、`GitHub PR / Issue` 等中英混杂表达
7. 把工程交付摘要顶部对象状态和团队协同读数中的提交数、文件数、百分比改成定性区间表达，避免默认前台继续像统计表
8. 把 reports 后半段治理健康度里的 `LLM 兜底` 改成 `模型回退`，避免内部实现标签进入默认中文管理视图

## 2. 本轮不做

- 不改 Git 查询、`.mailmap`、贡献者排序或工程复盘指标口径
- 不隐藏工程复盘的 internal-only 边界说明
- 不改 reports payload、周报生成、审批状态机或权限
- 不新增 GitHub API / PR review / CI 集成

## 3. 影响面

- `features/reports/engineering-delivery-review-panel.tsx`
- `features/reports/engineering-delivery-review-panel.test.ts`
- `features/reports/reports-client.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `lib/reports/engineering-delivery-review.test.ts`
- `components/shared/workspace-surface-preferences.tsx`
- `docs/README.md`
- `docs/reviews/HELM_REPORTS_ENGINEERING_EVIDENCE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. 工程复盘默认应该先支持管理判断，而不是把身份和统计证据全部摊在前台
2. 邮箱和大数字仍是 evidence，不应删除，只应降到可展开层
3. “证据明细”必须默认关闭，避免用户先读证据再找动作
4. 本轮只改展示层，不改变工程复盘事实来源

## 5. 验证方案

```bash
npm run test -- features/reports/engineering-delivery-review-panel.test.ts lib/reports/engineering-delivery-review.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari / Atlas 窗口状态
- 用 Playwright 登录 demo 并打开 `http://localhost:3000/reports`
- 检查工程交付摘要默认可见邮箱数为 0
- 检查工程交付摘要默认可见四位以上大数字从 13 降到 2
- 检查 6 张贡献者卡显示 `查看证据明细`
- 检查“证据明细”默认关闭，展开后仍能看到邮箱和 raw metric
- 检查 reports 中文可见层不再出现 `reduced-motion`、`pair`、`commit`、`GitHub`、`PR`、`Issue`
- 检查工程交付摘要顶部默认可见提交数、文件数、百分比均为 0
- 检查团队协同读数默认可见提交数、文件数、百分比均为 0
- 检查移动视口无横向溢出，默认仍不露出邮箱
- 检查 reports 页面主体不再出现 `LLM`，治理健康度显示 `模型回退`

已执行结果：

- `npm run test -- features/reports/engineering-delivery-review-panel.test.ts lib/reports/engineering-delivery-review.test.ts` passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed; existing Turbopack NFT warning remains
- `npm run quality:regression` passed
- `git diff --check` passed
- Playwright 页面复评 passed；默认邮箱 0，默认四位以上大数字 2，贡献者证据 disclosure 6 个，展开后邮箱和 raw metric 可见
- Playwright 追加扫描 passed；`reduced-motion / pair / commit / GitHub / PR / Issue` 在中文可见层均为 0
- Playwright 再复评 passed；工程交付摘要顶部默认可见提交数、文件数、百分比均为 0，团队协同读数默认可见提交数、文件数、百分比均为 0
- Playwright 移动视口复评 passed；390px 宽度无横向溢出，默认可见邮箱为 0
- Playwright 后半段复评发现 `LLM 兜底`，已改为 `模型回退`；后续验证确认 reports 页面主体 `LLM` 为 0
- Full `npm run test` not rerun in this slice because MySQL `127.0.0.1:3306` remains unreachable and DB-backed runtime tests are known to fail under that environment
- Computer Use：Safari 仍返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝；本轮真实页面复核由 Playwright 完成

## 6. 主要风险

1. 证据被折叠后，重度工程复盘用户需要多一步展开
2. 团队协同读数仍会重复展示“关联判断信号”和右侧协同列表里的共享热点，后续如果继续压密度，可以只保留一处主判断，另一处转为证据层
3. Computer Use 当前仍无法稳定读取浏览器窗口，后续需要继续在每轮尝试并保留 Playwright 兜底

# Helm Reports Deep Metrics Language Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
当前切片：`Computer Use attempted; Playwright deep-page review confirmed reports metric and engineering delivery sections no longer expose recommendation / memory / owner / reviewer / guardrail-style internal English in the Chinese surface`

## 1. 目标

这次继续处理 `/reports` 首屏之后的深层指标区与工程交付摘要：

1. 继续尝试 Computer Use 读取浏览器窗口；在 Safari / Atlas 不可用时，用 Playwright 操作真实本地页面完成同等复评
2. 把深层指标标题里的 `recommendation / Memory / blocker` 收成中文用户语义
3. 把工程交付摘要里的 `owner / reviewer / docs / baseline / guardrails / runtime` 等内部工程标签收成中文管理判断
4. 把“最近可见动作”从原始 Git 提交标题改成中文动作摘要，避免 `feat(memory)` 这类证据文本直接进入用户前台
5. 把工程复盘中的兜底 focus 从模糊的“其他”改成“综合支撑”
6. 保留内部管理复盘边界：这不是绩效系统、不是 GitHub 官方事实层、也不扩大到自动执行或自动承诺

## 2. 本轮不做

- 不改 reports payload、周报生成、建议反馈、审批状态机或权限
- 不改 Git 查询来源、`.mailmap` 映射或工程复盘的底层指标口径
- 不新增 GitHub API / PR review / CI 集成
- 不做全站术语清理；本轮只收 `/reports` 深层指标区和工程交付摘要的展示摩擦

## 3. 影响面

- `features/reports/reports-client.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `lib/reports/engineering-delivery-review.test.ts`
- `docs/README.md`
- `docs/reviews/HELM_REPORTS_DEEP_METRICS_LANGUAGE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. 用户读 reports 深层指标时，仍应该看到经营复盘语言，而不是内部对象名或工程标签
2. Git 原始提交标题可以作为证据来源，但中文产品前台应先给动作摘要
3. 工程交付摘要仍是 internal-only 管理判断层，不能写成绩效结论或官方 GitHub review 事实
4. 英文模式保留原始工程证据；中文模式做展示转换

## 5. 验证方案

```bash
npm run test -- lib/reports/engineering-delivery-review.test.ts lib/presentation/business-loop-gap-readout.test.ts features/reports/report-first-loop-display.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari / Atlas 窗口状态
- 用 Playwright 登录 demo 并打开 `http://localhost:3000/reports`
- 检查页面主体不再出现 `recommendation`、`memory`、`blocker`、`owner`、`reviewer`
- 检查页面主体不再出现 `runtime / core logic`、`docs / baseline`、`guardrails`、`review ownership`、`second owner`、`current-main priority`、`bus factor`、`merge friction`
- 检查最近可见动作显示为中文摘要，例如 `新增或强化：结构化记忆与经营信号`
- 检查工程复盘不再显示模糊兜底词 `其他`，改为 `综合支撑`

已执行结果：

- `npm run test -- lib/reports/engineering-delivery-review.test.ts lib/presentation/business-loop-gap-readout.test.ts features/reports/report-first-loop-display.test.ts` passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed; existing Turbopack NFT warning remains
- `npm run quality:regression` passed
- `git diff --check` passed
- `npm run test` attempted; 252 files / 1094 tests passed, 6 DB-backed runtime test files / 15 tests failed because MySQL `127.0.0.1:3306` is unreachable
- Playwright 页面复评 passed；上述 forbidden terms 在页面主体均为 0，`其他` 为 0，`综合支撑` 正常出现
- Computer Use：Safari 仍返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝；本轮真实页面复核由 Playwright 完成

## 6. 主要风险

1. 工程复盘仍会显示贡献者邮箱和数量指标，这是 internal-only 管理复盘的刻意保留，不应外部化
2. 底层 focus taxonomy 仍保留 `other` 作为兜底 key；本轮只改变中文展示为“综合支撑”，不扩大到底层分类重构
3. Computer Use 当前仍无法稳定读取浏览器窗口，后续需要继续在每轮尝试并保留 Playwright 兜底

# Helm Reports First-Loop De-SystemSpeak Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
当前切片：`Computer Use / Playwright assisted reports first-screen polish completed; reports first-loop path now uses report-review language, compact summary, and localized business-loop gap readout`

## 1. 目标

这次只处理 `/reports` 真实首屏中暴露出的系统语和中英混杂问题：

1. 继续尝试 Computer Use 读取当前浏览器窗口；在 Safari / Atlas 不可用时，用 Playwright 操作真实本地页面保持验证闭环
2. 把 reports 顶部 `Reports -> first loop`、`first-loop checkpoint`、`review gate` 收成“周报复核路径”
3. 把 first-loop 大卡压成 compact 摘要，优先展示当前复核动作、回访点和边界
4. 把 summary 区里的 `review 区块 / review 窗口 / First-loop 证明` 改成“复核区块 / 复核窗口 / 周报复核路径”
5. 把 business-loop gap readout 中的 `KPI link stale` 与 stale metrics 英文诊断本地化为中文经营判断
6. 保留建议不等于承诺、复核前不外发、不自动执行的边界

## 2. 本轮不做

- 不改周报生成动作、报告 payload、审批状态机或权限
- 不改底层 `WorkspaceFirstLoopModel`
- 不新增 workflow / orchestration / auto-execution 能力
- 不做全站术语清理；本轮只收 `/reports` 首屏和共享 gap readout 的最小展示问题

## 3. 影响面

- `features/reports/report-first-loop-display.ts`
- `features/reports/report-first-loop-display.test.ts`
- `features/reports/reports-client.tsx`
- `lib/presentation/business-loop-gap-readout.ts`
- `lib/presentation/business-loop-gap-readout.test.ts`
- `docs/README.md`
- `docs/reviews/HELM_REPORTS_FIRST_LOOP_DE_SYSTEMSPEAK_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. 用户进入 reports 首屏时，最先需要判断“当前该复核哪条动作 / 下次从哪里回来”，不是读 first-loop 模型解释
2. reports 可以复用 first-loop 状态，但展示层必须翻译成周报复核语言
3. `KPI link stale` 这类 gap title 是内部诊断，不应在中文经营首屏直出
4. 建议、复盘、复核入口仍不能被写成承诺、自动发送或自动执行

## 5. 验证方案

```bash
npm run test -- lib/presentation/business-loop-gap-readout.test.ts features/reports/report-first-loop-display.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari / Atlas 窗口状态
- 用 Playwright 登录 demo 并打开 `http://localhost:3000/reports`
- 检查首屏不再出现 `Reports -> first loop`、`first-loop checkpoint`、`review-before-commitment gate`、`打开 review gate`、`First-loop 证明`
- 检查首屏不再出现 `review 区块`、`review 窗口`、`live signal`、`memory fact`、`KPI link stale`、`stale coordination metrics`
- 检查首屏显示 `周报复核路径 / 复核：发送 Atlas 合作 brief / 进入复核 / KPI 关联已过期`

已执行结果：

- `npm run test -- lib/presentation/business-loop-gap-readout.test.ts features/reports/report-first-loop-display.test.ts` passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed; existing Turbopack NFT warning remains
- `npm run quality:regression` passed
- `git diff --check` passed
- Playwright 页面复评 passed；上述 forbidden terms 在首屏均 clear
- Computer Use：Safari 仍返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝，Codex App 因安全策略不可控制；本轮真实页面复核由 Playwright 完成

## 6. 主要风险

1. 更深的 reports 指标区仍有部分 legacy `recommendation / memory / owner / reviewer` 表达，未在本切片一次性清理
2. shared business-loop gap readout 的中文替换是 presentation-level，本轮不改 gap 生成源
3. Computer Use 当前仍无法稳定读取 Safari 窗口，后续需要继续在每轮尝试并保留 Playwright 兜底

# Helm Workspace Loading Recovery Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
当前切片：`Computer Use confirmed dashboard / reports hard navigation can stay on the global loading fallback; this slice turns that fallback into a recoverable workspace/session confirmation state and pre-redirects no-cookie workspace navigations to login through Next proxy`

## 1. 目标

这次只处理真实浏览器里暴露出的全局 loading 卡点：

1. 用 Computer Use 在 Safari 进入 `/reports` 与 `/dashboard`，确认用户可能只看到“正在载入经营分身控制台...”
2. 把全局 `app/loading.tsx` 从单句等待文案改成可恢复的工作区确认状态
3. 提供明确入口：重新进入工作台 / 回到登录入口
4. 明确该页面不会生成报告、审批动作或对外发送内容
5. 为 loading recovery 文案补最小单元测试，防止回退成 generic loading
6. 对没有 `helm-auth-session` cookie 的工作区页面硬导航，先在 Next proxy 层导向 `/login`

## 2. 本轮不做

- 不改 DB auth session、workspace membership、permission 或 cookie 写入 contract
- 不改 reports / dashboard 数据加载逻辑
- 不改审批、报告生成、自动执行或对外发送权限
- 不把全站 loading / error / not-found 一次性重构

## 3. 影响面

- `app/loading.tsx`
- `proxy.ts`
- `lib/auth/session-cookies.ts`
- `lib/auth/workspace-route-guard.ts`
- `lib/auth/workspace-route-guard.test.ts`
- `lib/auth/session.ts`
- `lib/presentation/loading-recovery.ts`
- `lib/presentation/loading-recovery.test.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/README.md`
- `docs/reviews/HELM_WORKSPACE_LOADING_RECOVERY_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. 当用户停在 loading fallback 时，最先需要的是恢复入口，而不是系统说明
2. `/login` 是会话缺失时的安全恢复入口；`/dashboard` 只保留为次级重试入口
3. loading fallback 不应暗示任何报告生成、审批或对外动作正在执行
4. 无 auth cookie 的工作区硬导航可以在 Next proxy 层直接导向登录，避免先进入 workspace RSC streaming fallback
5. 这轮只处理 no-cookie 页面导航，不把过期 / 失效 DB session 判断伪装成已修复

## 5. 验证方案

```bash
npm run test -- lib/presentation/loading-recovery.test.ts
npm run test -- lib/auth/workspace-route-guard.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 用 Computer Use 打开 Safari `localhost:3000/dashboard`
- 确认全局 fallback 不再只显示“正在载入经营分身控制台...”
- 确认 no-cookie 硬导航到 `localhost:3000/reports` 会先到 `/login`
- 确认 fallback 出现时显示“正在确认你的经营工作区”、`回到登录入口`、`重新进入工作台`
- 确认页面文案说明不会生成报告、审批动作或对外发送内容

已执行结果：

- `npm run test -- lib/presentation/loading-recovery.test.ts lib/auth/workspace-route-guard.test.ts` passed
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `git diff --check` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed; only the existing Turbopack NFT warning remains
- `npm run quality:regression` passed
- `curl -i http://localhost:3000/reports` and `curl -I http://localhost:3000/reports` both return `307` to `/login` without auth cookie
- Computer Use verified the pre-fix fallback and post-fix fallback copy; after Safari window state returned `cgWindowNotFound`, final no-cookie redirect was verified by HTTP GET / HEAD

## 6. 主要风险

1. Next proxy 只处理缺少 auth cookie 的页面硬导航；过期 / 被撤销 session 仍由 server session 链路处理
2. 如果浏览器持有异常 cookie，用户点击 `/dashboard` 仍可能回到同一 fallback，需要下一轮继续追 DB session 链路
3. 这轮新增的是全局 fallback 文案和入口，不代表完整错误页体系已经成立

# Helm Approvals Review Path Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed; Full DB-Backed Test Blocked By Local MySQL
当前切片：`Computer Use confirmed approvals queue cards now preview first, while the explicit drawer CTA still opens the review drawer`

## 1. 目标

这次只做 `/approvals` 从 dashboard / sidebar 进入后的复核路径体验：

1. 用 Computer Use 真实点击 dashboard / approvals，找出首屏和抽屉里的操作摩擦
2. 把 approvals 首屏残留的 `Approval -> first loop`、`review gate`、`checkpoint` 等系统语言收成用户能直接操作的复核路径
3. 把点击“进入复核面板”后的理由链从 `Skill / facts / blockers / commitments / operating action` 改成“动作来源 / 证据覆盖 / 边界 / 决策请求”
4. 把抽屉内辅助材料默认折叠，让编辑区和一次性复核按钮提前可达
5. 把展开后的 learning / policy 内部字段翻译成同类动作参考语言
6. 把草稿编辑区从“编辑后批准”按钮语义中拆出来，显式显示原稿未修改 / 已修改待复核状态
7. 继续保留 review-before-commitment、人工复核、非自动发送和非自动承诺边界

## 2. 本轮不做

- 不改审批状态机
- 不改权限、审计、自动执行策略或 send authority
- 不新增 workflow / orchestration / auto-execution 能力
- 不做全站术语清理
- 不触碰当前未提交的首页、登录页、Topbar 和 internal operating 改动，除非验证必须

## 3. 影响面

- `features/approvals/approval-first-loop-display.ts`
- `features/approvals/approval-first-loop-display.test.ts`
- `features/approvals/approval-draft-display.ts`
- `features/approvals/approval-draft-display.test.ts`
- `features/approvals/approval-learning-display.ts`
- `features/approvals/approval-learning-display.test.ts`
- `features/approvals/approvals-client.tsx`
- `components/shared/home-surface-arrival-banner.tsx`
- `lib/operating-system/approval-boundary.ts`
- `lib/operating-system/index.test.ts`
- `docs/README.md`
- `docs/reviews/*approvals*report*`

## 4. 关键假设

1. 用户进入 approvals 时最先要完成一次复核判断，而不是理解 first-loop 架构
2. 复核抽屉的首段理由链应该服务“能否放行 / 改写 / 拒绝 / 转人工”，而不是暴露内部 skill 和 memory object 名词
3. 术语收紧不能削弱边界：建议仍不等于承诺，通过草稿也不等于获得自动发送权限
4. 本轮只处理 approvals 首屏、复核抽屉、辅助判断材料、learning 展示适配和草稿编辑状态，不扩展到全站术语清理

## 5. 验证方案

最小验证：

```bash
npm run test -- features/approvals/approval-draft-display.test.ts features/approvals/approval-learning-display.test.ts features/approvals/approval-first-loop-display.test.ts lib/operating-system/index.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
git diff --check
npm run build
npm run quality:regression
```

页面验证：

- 用 Computer Use 打开 Safari `localhost:3000/approvals`
- 检查首屏显示“复核路径 / 先做复核 / 进入复核面板”
- 点击“进入复核面板”，确认 URL 带 `approvalId` 和 `#approval-preview`，抽屉打开到“发送 Atlas 合作 brief”
- 检查抽屉理由链显示“动作来源 / 证据覆盖 / 边界 / 决策请求”
- 展开“辅助判断材料”，确认不再暴露 `contact_followup`、`within_48h_preferred` 和“系统学习结果”
- 关闭辅助材料后，确认编辑区、批准、编辑后批准、拒绝、转人工在默认路径可达
- 检查默认草稿区显示“复核草稿 / 原稿未修改”，且“编辑后批准”不作为未修改草稿的误触入口

如未跑完整仓库验证链，最终报告必须列出未跑项和剩余风险。

## 6. 主要风险

1. 只改展示层导致其他页面仍可能有少量 internal terms
2. Compact first-loop summary 可能让部分用户少看到完整 first-loop 阶段解释
3. 共享 arrival banner 的 approvals 文案改变可能影响 e2e 语义预期
4. 审批抽屉虽然更顺，但真实通过 / 拒绝动作仍未在本轮执行验证

## 7. 完成定义

1. approvals 默认首屏不再展示 `Approval -> first loop`、`review gate`、`first-loop checkpoint`
2. 主 CTA 能从首屏直接打开具体复核抽屉
3. 抽屉首段理由链不再用 `Skill / facts / blockers / commitments / operating action` 做中文界面主表达
4. 抽屉默认路径不再把辅助材料和未来自动规则混入一次性复核按钮区
5. 草稿编辑区显示修改状态，只有修改后才走“按修改稿批准”
6. 新增测试覆盖首屏展示适配器、draft 展示适配器、learning 展示适配器和抽屉理由链中文口径
7. 文档索引与本轮报告同步
8. 完成针对性验证，并明确未跑或受环境阻塞的完整验证链项目

## 8. 2026-04-22 Computer Use queue-preview follow-through

目标：

1. 继续用 Computer Use 在 `/approvals#approval-queue` 操作真实队列。
2. 修正队列卡“左侧选中后先看高层预览”的页面承诺与实际直接打开抽屉之间的不一致。
3. 让队列卡只更新右侧预览，让 `打开审批抽屉` 成为正式进入复核抽屉的显式动作。
4. 保留 `approvalId` 深链直接打开抽屉的能力，不改变审批权限、审计、批准、拒绝、转人工或自动执行策略。

验证结果：

- Computer Use：点击第一条队列卡前，队列卡被读成超长按钮并直接打开复核抽屉；这与右侧预览说明不一致。
- Computer Use：修复后队列卡暴露为短按钮 `预览复核项：...`。
- Computer Use：关闭抽屉后回到队列，右侧预览显示当前复核项，页面没有自动打开抽屉。
- Computer Use：点击第二条 `预览复核项：起草 Cedar 恢复邮件` 后，只切换右侧预览，没有打开抽屉。
- Computer Use：点击右侧 `打开审批抽屉` 后，打开 Cedar 对应复核抽屉。
- `npm run test -- features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-entry-flow-source.test.ts` passed；2 files / 5 tests。
- `npm run typecheck` passed。
- `git diff --check` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `nc -z 127.0.0.1 3306` returned `mysql_3306_status=1`；完整 DB-backed `npm run test` / `npm run e2e` 仍需本地 MySQL 恢复后补跑，`npm run db:reset` 仍因 destructive DB reset 和数据库不可达未执行。

## 9. 2026-04-22 Computer Use drawer-url follow-through

目标：

1. 继续用 Computer Use 在真实 `/approvals` 页面里验证“右侧预览 -> 打开审批抽屉”的正式进入路径。
2. 修正 `打开审批抽屉` 打开 Sheet 后地址栏仍停在 `/approvals`、刷新或分享无法恢复当前复核项的问题。
3. 保持关闭抽屉会清理 `approvalId` 深链，不改变审批权限、审计、批准、拒绝、转人工或自动执行策略。
4. 把抽屉 URL 同步逻辑收口为稳定的打开 / 关闭状态流，避免程序化打开被误判成关闭。

验证结果：

- Computer Use：点击右侧 `打开审批抽屉` 后，最初暴露出新断点，抽屉打开了，但 Safari 地址栏仍停在 `localhost:3000/approvals`。
- 本地 Next log 同时记录了 `GET /approvals?approvalId=...` 紧接 `GET /approvals`，说明程序化打开时抽屉路由刚写入就又被关闭逻辑清掉。
- 修复后 Computer Use 再次点击右侧 `打开审批抽屉`，Safari 地址栏稳定进入 `localhost:3000/approvals?approvalId=cmnzwu5zf030g7ntgpknt274e#approval-preview`，抽屉打开到 `起草 Cedar 恢复邮件`。
- Computer Use：点击 `关闭复核抽屉` 后，地址栏回到 `localhost:3000/approvals`，队列页保持在当前预览项。
- Computer Use：从无查询态再次点击 `打开审批抽屉`，地址栏再次稳定写入同一 `approvalId` 深链。
- `npm run test -- features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-entry-flow-source.test.ts` passed；2 files / 5 tests。
- `npm run typecheck` passed。

# Helm Dashboard Review-First Work Entry Polish v1

更新时间：2026-04-22
状态：Non-Destructive Validation Passed; Full DB-Backed Test Blocked By Local MySQL
当前切片：`Computer Use confirmed sales-mode dashboard action rail now exposes named quick-action links, exact approval preview, and a queue CTA that lands on the queue anchor`

## 1. 目标

这次只做 dashboard 首屏工作入口的一刀：

1. 用真实页面巡检结果收口 `/dashboard` review-heavy 状态的首屏重复问题
2. 把“当前主动作 / 复核队列 / 继续入口 / 阻塞”压成更容易直接操作的顶部主动作轨
3. 当 Top work items 已经等同于 review queue 时，不再把同一组待复核事项完整重复一遍
4. 保留 `judgement-first / decision-first / review-before-commitment` 边界，不增加新的执行权限

## 2. 本轮不做

- 不改数据模型
- 不新增 workflow / orchestration / auto-execution 能力
- 不扩大 approval authority 或 send authority
- 不做 broad dashboard redesign
- 不触碰当前未提交的首页、登录页、Topbar 和 internal operating 改动，除非验证必须

## 3. 影响面

- `features/dashboard/home-work-entry.ts`
- `features/dashboard/home-work-entry-surface.tsx`
- `features/dashboard/home-work-entry.test.ts`
- `docs/README.md`
- `docs/reviews/*dashboard*report*`

## 4. 关键假设

1. 用户进入 dashboard 时首先需要知道“现在点哪里”，而不是先阅读完整解释
2. review-heavy 状态下，审批队列就是当前主工作；重复展示同一批审批卡会制造操作噪声
3. 复核边界要继续前置，但只能作为人工确认入口，不能写成系统自动承诺
4. 本轮只修首屏信息结构和交互路由，不改变查询、权限、审批状态机或底层 runtime

## 5. 验证方案

最小验证：

```bash
npm run test -- features/dashboard/home-work-entry.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
```

页面验证：

- 使用 Playwright 从 `/demo` 进入 Founder demo，再打开 `/dashboard`
- 截取改造前后首屏，检查同一组审批事项不再完整重复
- 检查主动作轨里能直接看到主动作、复核压力、继续入口和阻塞

如未跑完整仓库验证链，最终报告必须列出未跑项和剩余风险。

## 6. 主要风险

1. 只减少重复但让审批入口不够明显
2. 新增顶部主动作轨后首屏变得更拥挤
3. 文案把 review queue 误写成系统已经承诺执行
4. 与现有 dashboard surface routing e2e 预期发生冲突

## 7. 完成定义

1. review-heavy dashboard 首屏只有一组完整审批卡，另一处变成队列摘要
2. 主动作轨可以一眼看出下一步应先处理什么
3. `home-work-entry` 模型有测试覆盖重复压缩逻辑
4. 文档索引与本轮报告同步
5. 完成针对性验证，并明确未跑的完整验证链项目

## 8. 2026-04-22 Computer Use accessibility follow-through

目标：

1. 用 Computer Use 从 `/demo` 进入销售团队演示，再读真实 `/dashboard`。
2. 修正 dashboard 首屏“当前工作”动作轨在 accessibility tree 里被折成大段 text、关键 CTA 不够独立的问题。
3. 让 `现在复核 / 查看队列 / 打开当前锚点 / 查看阻塞` 成为命名清晰的快速动作链接。
4. 不改变排序、审批状态机、自动执行、发送权限或 recommendation / commitment 边界。

验证结果：

- Computer Use：从 `/demo` 点击 `进入销售团队演示` 后进入销售模式 dashboard。
- Computer Use：修复前“当前工作”块被读成大段 text，关键动作缺少独立 link 节点。
- Computer Use：修复后出现独立 `当前工作快速动作` container，四个动作分别暴露为具名 link。
- Computer Use：点击 `现在复核: 发送 NorthBridge 会后 ROI 邮件` 后进入 `/approvals?approvalId=...#approval-preview` 并打开对应复核抽屉。
- `npm run test -- features/dashboard/home-work-entry-surface-accessibility.test.ts features/dashboard/home-work-entry.test.ts` passed；2 files / 7 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run build` passed；保留既有 Turbopack NFT trace warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- `nc -z 127.0.0.1 3306` returned `mysql_3306_status=1`；完整 DB-backed `npm run test` / `npm run e2e` 仍需本地 MySQL 恢复后补跑。

## 9. 2026-04-22 Computer Use action-target follow-through

目标：

1. 继续用 Computer Use 回到销售模式 dashboard 的首屏动作轨。
2. 检查具名动作不只“读起来清楚”，还要“点下去符合动作承诺”。
3. 修正 `查看队列` 从首条审批预览跳转到复核队列锚点。
4. 不改变单条 `现在复核` 的具体审批预览入口。

验证结果：

- Computer Use：读取 Safari `localhost:3000/dashboard`，确认 `查看队列: 2 个动作待审批` 的目标为 `/approvals#approval-queue`。
- Computer Use：点击该链接后，地址进入 `localhost:3000/approvals#approval-queue`，页面落在队列控制区，没有带 `approvalId` 自动打开首条审批预览。
- `npm run test -- features/dashboard/home-work-entry-surface-accessibility.test.ts features/dashboard/home-work-entry.test.ts` passed；2 files / 7 tests。
- `git diff --check` passed。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `nc -z 127.0.0.1 3306` returned `mysql_3306_status=1`；完整 DB-backed `npm run test` / `npm run e2e` 仍需本地 MySQL 恢复后补跑，`npm run db:reset` 仍因 destructive DB reset 和数据库不可达未执行。

# Helm Reserved Tenant Commercial Modules Refactor v1

更新时间：2026-04-20
状态：In Progress
当前切片：`Phase 1 / Task 5 第四刀：paid-without-export operator readout alignment across exception/proof/readiness`

## 1. 目标

围绕 Helm 租户（`helm@zhaojiling.com`）把现有商业相关模块按仓库规范重构和整理，形成一条稳定、可审计、可回滚的主链路：

1. `program catalog -> application intake -> participant portal -> settlement operations`
2. 统一 reserved workspace 归属与 capability gating
3. 收口 recommendation / proposal 与 commitment / contract 的边界表达
4. 统一数据对象、状态机、审计事件与异常补偿路径

## 2. 本轮不做

- 不做 marketplace 平台化
- 不做自动高风险承诺 / 自动对外发送
- 不做自动打款执行平面（manual settlement 仍为主事实层）
- 不做完整 RBAC builder / enterprise IAM

## 3. 关键假设

1. Helm first-party 商业模块继续锚定 reserved workspace，系统账户锚点为 `helm@zhaojiling.com`
2. 当前仓库已存在 reserved workspace gating 与 backfill inventory/apply 命令面，本轮在此基础上收口
3. 优先做最小可验证改动：先文档和契约冻结，再分期代码改造

## 4. 影响面

- 路由与页面：
  - `app/programs/*`
  - `app/portal/*`
  - `features/settings/components/billing-*`
- 业务域：
  - `features/programs/*`
  - `features/participant-portal/*`
  - `lib/billing/program-catalog.ts`
  - `lib/billing/manual-settlement.ts`
  - `lib/billing/settlement-exceptions.ts`
  - `lib/billing/settlement-ops-proof-pack.ts`
- 治理与验证：
  - capability/seam helper
  - self-check / boundary-check / pilot-readiness checks

## 5. 分期任务

### Phase 0 - Requirements Freeze（当前）

1. 形成一份完整需求基线（范围、边界、状态机、验收、风险）
2. 在 `PLANS.md` 冻结任务序列与验证门槛
3. 同步 docs 索引，避免后续实施漂移

### Phase 1 - Ownership & Access 收口

1. reserved workspace ownership guard 全面收口（UI + API + service）
2. 非 reserved workspace 降级为明确只读或拒绝
3. denial message 与 audit event 统一
4. 当前第一刀优先收口 `manual-settlement`、`commercial foundation`、`participant portal invite service`

### Phase 2 - Program/Portal 主链路收口

1. Program publish/application review 状态机收口
2. Participant portal token 生命周期和 self-only 边界收口
3. 申请到邀请的 follow-through 事件链一致化
4. 当前第三刀优先收口 participant portal access reissue semantics：`issue_fresh_access / reissue_existing_invite / reissue_archived_access / blocked_active_access / blocked_suspended_access`

### Phase 3 - Settlement Operations 收口

1. manual settlement 作为主事实层的状态和记录一致化
2. settlement exception triage / proof pack / payout readiness readout 对齐
3. 异常补偿与回放路径明确化（幂等、重试、撤销、审计）
4. 当前第二刀优先收口 line lifecycle guards：`paid from exported only / reversed from exported or paid only`

### Phase 4 - Regression & Freeze

1. 运行验证链并修复回归
2. 输出阶段 freeze report
3. 合并前回顾“已完整成立 / 已成形仍需下一层 / 刻意未做 / 风险项”

详细实施计划见：

- [`HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_IMPLEMENTATION_PLAN_V1.md`](docs/reviews/HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_IMPLEMENTATION_PLAN_V1.md)
- [`HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_FREEZE_REPORT_V1.md`](docs/reviews/HELM_RESERVED_TENANT_COMMERCIAL_MODULE_REFACTOR_FREEZE_REPORT_V1.md)

## 6. 验证方案

默认验证链：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

如果某条命令无法运行，必须在报告中写明原因、替代验证和剩余风险。

## 7. 主要风险

1. 历史 first-party 数据存在非 reserved workspace 记录，若直接收口可见性可能引起“功能消失”感知
2. 页面文案和状态名不一致可能造成 commitment 误读
3. 非 route service 写路径若未完全接入统一治理 seam，会产生权限漂移
4. 回归面大，若没有分期验证与 freeze 报告，容易引入隐性行为回归

## 8. 完成定义

1. 有完整需求基线文档可直接驱动实现
2. 分期任务、验收标准、回滚路径明确
3. 索引可检索，后续 PR 可直接引用
4. recommendation / commitment 两条主线边界保持稳定

# Helm Value Attribution And Allocation Governance

更新时间：2026-04-21
状态：Phase 0 Validation Ready
当前切片：`review-aligned proposal + phase-0 user research gate before any schema/api/ui work`

## 1. 目标

这条线当前阶段只做：

1. 冻结正式提案，明确 Helm 要做的是 governance mainline，而不是 finance product
2. 吸收首轮评审意见，明确“后台 richer governance / 前台 3-5 个概念”的复杂度分层原则
3. 在任何代码投入前，完成一轮真实用户调研
4. 用 `Go / Revise / No-Go` 决策，而不是直接进入实现
5. 默认把 MVP 收窄到单一收入线，首选 `SALES_REFERRAL`

这条线不做：

- schema 变更
- API 实现
- contributor account 产品化
- payout execution
- equity accrual implementation
- 在正式决议前开发任何代码

## 2. 关键假设

1. Helm 仍首先是 `AI 经营协同 / judgement-first / decision-first` 系统
2. 这条线只有在明显增强 GTM trust、partner retention 和 contribution predictability 时才值得继续
3. 大多数用户前台不应学习治理对象模型，只应理解少量结果概念
4. 如果用户不接受 `accrual != settlement`，这条线应暂停或降级
5. 只要任一核心假设不成立，就直接 `No-Go`

## 3. 当前文档真值

- [`HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_PRD_V1.md`](docs/product/HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_PRD_V1.md)
- [`HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_FORMAL_PROPOSAL_V1.md`](docs/product/HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_FORMAL_PROPOSAL_V1.md)
- [`HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_PHASE_0_USER_RESEARCH_PLAN_V1.md`](docs/reviews/HELM_VALUE_ATTRIBUTION_AND_ALLOCATION_GOVERNANCE_PHASE_0_USER_RESEARCH_PLAN_V1.md)

## 4. 阶段计划

### Phase 0

- 完成 `8-12` 人真实用户调研
- 验证真实痛点、概念理解、接受度和 V1 收益来源
- 输出 `Go / Revise / No-Go`
- 状态：Ready

### Phase 1

- 只有在 `Go` 后，才冻结 MVP
- MVP 默认只保留 3 个前台概念：
  - `我的贡献`
  - `我的应计`
  - `我的结算`
- MVP 默认只允许一条收入线，首选 `SALES_REFERRAL`
- 状态：Blocked by Phase 0

### Phase 2

- 只有在 MVP freeze 后，才讨论 schema / UI / service 最小切片
- 状态：Not started

## 5. 风险

1. 过早把治理复杂度推给前台用户，会把 Helm 拉偏成治理学习产品
2. 研究样本如果过于同温层，会误判真实需求强度
3. 如果没有显式 `No-Go` 机制，这条线容易因愿景过强而被硬推入开发

## 6. 完成定义

1. 正式提案已吸收首轮评审修正
2. 已有独立 Phase 0 调研计划文档
3. 后续是否进入开发，必须由 Phase 0 结论驱动

# HELM Native Memory Efficiency & Reliability v1

更新时间：2026-04-27
状态：Phase 4C review surface closed（MEM-DISTILL-006C）
当前切片：`已完成需求升级基线、Phase 0 observability baseline proxy、Phase 0B diagnostics surface trace alignment、Phase 1 bounded timeline/facts query contract、Phase 2 pure retrieval pack builder、briefing / recommendation / meeting detail 第一轮 surface 接入，以及 Phase 3 meeting MemoryFact 第一层 duplicate / conflict write guard、batch write result、failure classification、diagnostics 只读 failure review readout、read-only operator queue substrate、bounded retry contract substrate、retry receipt AuditLog persistence 入口、owner-aware retry receipt review surface、retry attempt AuditLog ledger、logical idempotency lock read model、source rebuild gate、DB-level idempotency guard、source reconstruction proof、review-first bounded retry executor；Phase 4A 已完成纯离线确定性 distillation candidate 检测器；Phase 4B 已完成 MemoryDistillationCandidate 持久化 substrate、review decision service、meeting pipeline fact write 成功后的后置同步，以及 sync failure 不阻断主链路的审计摘要；Phase 4C 已完成 /memory 第一层 pending queue、recent decisions 与 approve / reject / defer review action；仍无 promoted memory、无 retrieval pack promotion layer、无 auto-promotion、无 recommendation ranking takeover`

**Phase 4A 当前切片（MEM-DISTILL-006 第一层，2026-04-27）**

- `lib/memory/distillation-candidate.ts`：纯确定性离线检测器，13 单元测试全部通过
- `evals/memory/distillation-candidates.json`：4 条离线 fixture，离线可复现
- `lib/evals/memory-evals.ts`：输出 `distillationCandidateSummary`，4/4 eval 通过
- `scripts/memory-evals.ts`：distillation candidate eval 失败时非零退出
- `duplicate_omission` eval 收口：已排除 aggregate meeting summary facts，孤立 DB 下 3/3 通过
- 单元测试：`npm run test -- lib/evals/memory-evals.test.ts lib/memory/distillation-candidate.test.ts` → 2 files / 24 tests passed
- eval（孤立 DB）：`relevance 3/3 / stability 3/3 / duplicate_omission 3/3 / distillationCandidateSummary 4/4`
- 无 distillation runtime / schema / DB 写路径 / auto-promotion / operator workflow

报告见：[`HELM_MEMORY_DISTILLATION_CANDIDATE_PHASE4A_REPORT_V1.md`](docs/reviews/HELM_MEMORY_DISTILLATION_CANDIDATE_PHASE4A_REPORT_V1.md)

**Phase 4B 实施计划（MEM-DISTILL-006B，2026-04-27 启动）**

目标：

1. 在不写 canonical fact、不 auto-promote、不接管 recommendation ranking 的前提下，引入 distillation candidate 的持久化 substrate。
2. 让 `reject / defer` 成为可持久化 review decision，下一次检测不可绕过。
3. 在 meeting memory pipeline 成功写入事实后，安全同步 review-required candidate。

影响面：

- Prisma schema / migration：新增 review-safe candidate 表与状态字段。
- `lib/memory/*`：新增 candidate persistence / review service，复用 Phase 4A deterministic detector。
- meeting memory pipeline：只在 fact write 成功后同步 candidate；失败链路不触发。
- eval / guards / docs：继续证明无 promoted memory、无 auto-promotion、无 ranking takeover。

关键假设：

- Phase 4B 只允许写入 distillation candidate 审核对象，不允许写 canonical `MemoryFact`。
- `approve` 只表示人工确认候选本身，不表示已提升为 promoted memory。
- UI/operator review surface 可作为后续 Phase 4C，除非本切片已有足够 substrate 后再追加。

风险与验证：

- 风险：schema 扩展会触发全链 typecheck / db reset / e2e；必须用隔离 DB 验证。
- 风险：runtime sync 可能在 meeting pipeline 失败时误触发；必须有单元测试证明失败链路不触发。
- 验证：`db:reset`、targeted memory tests、`eval:memory`、`eval:recommendation`、`check:boundaries`、`self-check`、`typecheck`、`lint`、`test`、`build`、`quality:regression`、`e2e`。

**Phase 4B 完成记录（MEM-DISTILL-006B，2026-04-27）**

- Prisma：新增 `MemoryDistillationCandidateStatus` 与 `MemoryDistillationCandidate`，MySQL migration `20260427000100_memory_distillation_candidates` 已在隔离库 `helm2026_memory_phase4b_verify` 完成 `db:reset / seed`。
- Detector：`DistillationCandidate` 增加稳定 `groupKey`，并导出 `buildDistillationCandidateGroupKey`，用于持久化幂等识别。
- Store service：`syncMemoryDistillationCandidatesForObject` 只创建/更新 `PENDING_REVIEW` candidate；`APPROVED / REJECTED / DEFERRED / ARCHIVED` 不会被重置为 pending；`reviewMemoryDistillationCandidate` 只写 decision 字段。
- Pipeline：meeting memory pipeline 只在 fact write 成功后基于 unique object refs 后置同步 candidate，最多 8 个对象；sync failure 不阻断 pipeline，只进入最终 audit metadata 和返回 payload。
- 验证：`db:reset` passed；targeted memory tests passed（3 files / 24 tests）；`eval:memory` relevance/stability/duplicate_omission 3/3 且 distillationCandidateSummary 4/4；`eval:recommendation` 4/4；`check:boundaries` passed；`self-check` 20/20；`typecheck` passed；`lint` passed（7 条既有 warning）；全量 `test` 391 files / 2698 tests；`build` passed；`quality:regression` 51 files / 181 tests；`e2e` 34/34 passed。
- 报告见：[`HELM_MEMORY_DISTILLATION_CANDIDATE_PHASE4B_RUNTIME_PERSISTENCE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_DISTILLATION_CANDIDATE_PHASE4B_RUNTIME_PERSISTENCE_REPORT_V1.md)

**Phase 4C 实施计划（MEM-DISTILL-006C，2026-04-27 启动）**

目标：

1. 在 `/memory` 暴露 review-safe distillation candidate 的第一层 operator review surface。
2. 展示 pending queue 与 recent decisions，让重复事实压缩候选可见、可复核、可审计。
3. 提供 approve / reject / defer action，但 action 只记录 review decision，不写 canonical `MemoryFact`、不创建 promoted memory、不改变 recommendation ranking。

影响面：

- `features/memory/queries.ts`：返回当前 workspace 的 pending candidates 与 recent reviewed decisions。
- `features/memory/actions.ts`：新增 review action，复用 Phase 4B store service 与 workspace/memory permission gate。
- `features/memory/memory-client.tsx`：增加非聊天、非执行、非 promotion 的 review surface。
- tests / guards / docs：证明 review surface 不扩 execution authority。

关键假设：

- Phase 4C 只做第一层 review surface，不做 full owner workflow / assignment / SLA。
- `approve` 仍只是候选 review decision，不代表 promoted memory 或 canonical fact 已成立。
- retrieval pack promotion layer 后续另起 contract，不能在本切片接管 ranking owner。

验证：

- targeted memory tests、source contract tests、typecheck、lint、check:boundaries、self-check、eval、full test/build/e2e/quality regression。

**Phase 4C 完成记录（MEM-DISTILL-006C，2026-04-27）**

- Query：`getMemoryData` 返回 `distillationCandidates` 与 `distillationDecisions`，仅在 Helm source 下展示，支持 object-scoped filter 与确定性排序。
- Action：`reviewMemoryDistillationCandidateAction` 复用 `reviewMemoryDistillationCandidate`，通过当前 workspace session 与 memory management capability gate；store 错误返回 bounded user-facing error。
- UI：`/memory` 增加 Distillation candidate review 区块，展示 pending queue、recent decisions、evidence refs 与边界说明；按钮仅对有 memory management 权限角色可见。
- 边界：页面明确不是 chat surface；approve / reject / defer 不写 canonical `MemoryFact`、不创建 promoted memory、不执行动作、不改变 recommendation ranking。
- 报告见：[`HELM_MEMORY_DISTILLATION_CANDIDATE_PHASE4C_REVIEW_SURFACE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_DISTILLATION_CANDIDATE_PHASE4C_REVIEW_SURFACE_REPORT_V1.md)

## 1. 目标

这条线当前阶段只做：

1. 补齐 memory 成本/质量可观测性基线（token、命中率、重复率、stale suppression）
2. 收紧 memory 高基数查询路径（timeline/facts/object-scoped retrieval）与索引
3. 引入 budgeted retrieval pack（按 trust/importance/recency/promotion posture）
4. 收紧 meeting memory 写路径重复与写放大

这条线不做：

- OpenClaw / 外部记忆深耦合
- 第二套 memory stack
- execution authority 扩面
- 把 recommendation 写成 commitment

启动条件（顺序约束）：

1. `SWARM-001` 与 `SWARM-002` 达到当前阶段完成标准
2. SWARM 相关验证链与冻结报告完成
3. 然后再继续 memory `Phase 2+` 增强

详细计划见：

- [`HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`](docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md)
- [`HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`](docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md)
- [`HELM_MEMORY_OBSERVABILITY_BASELINE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_OBSERVABILITY_BASELINE_REPORT_V1.md)
- [`HELM_MEMORY_QUERY_BOUNDARY_REPORT_V1.md`](docs/reviews/HELM_MEMORY_QUERY_BOUNDARY_REPORT_V1.md)
- [`HELM_MEMORY_RETRIEVAL_PACK_REPORT_V1.md`](docs/reviews/HELM_MEMORY_RETRIEVAL_PACK_REPORT_V1.md)
- [`HELM_MEMORY_RETRIEVAL_PACK_SURFACE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_RETRIEVAL_PACK_SURFACE_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_DEDUPE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_DEDUPE_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_BATCH_FAILURE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_BATCH_FAILURE_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_FAILURE_REVIEW_SURFACE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_FAILURE_REVIEW_SURFACE_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_OPERATOR_QUEUE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_OPERATOR_QUEUE_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_RETRY_CONTRACT_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_RETRY_CONTRACT_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_RETRY_RECEIPT_PERSISTENCE_AND_OWNER_AWARE_OPERATOR_REVIEW_SURFACE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_RETRY_RECEIPT_PERSISTENCE_AND_OWNER_AWARE_OPERATOR_REVIEW_SURFACE_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_RETRY_ATTEMPT_LEDGER_AND_SOURCE_REBUILD_GATE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_RETRY_ATTEMPT_LEDGER_AND_SOURCE_REBUILD_GATE_REPORT_V1.md)
- [`HELM_MEMORY_WRITE_RETRY_DB_IDEMPOTENCY_SOURCE_PROOF_AND_BOUNDED_EXECUTOR_REPORT_V1.md`](docs/reviews/HELM_MEMORY_WRITE_RETRY_DB_IDEMPOTENCY_SOURCE_PROOF_AND_BOUNDED_EXECUTOR_REPORT_V1.md)
- [`HELM_MEMORY_PHASE_0_3_FREEZE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_PHASE_0_3_FREEZE_REPORT_V1.md)
- [`HELM_MEMORY_MYSQL_INDEX_EVIDENCE_REPORT_V1.md`](docs/reviews/HELM_MEMORY_MYSQL_INDEX_EVIDENCE_REPORT_V1.md)

# SWARM Workstream Closeout v1

更新时间：2026-04-22
状态：Completed on Main
当前口径：`formal SWARM workstream (SWARM-001 ~ SWARM-008) has reached mainline closeout`

## 1. 结论

当前 formal SWARM 编号线已经按 re-baseline 收口完成：

1. `SWARM-001` `spawn contract + budget envelope + deny readout` 已在 current-main substrate 成立
2. `SWARM-002` `read-only worker fan-out` contract stack 已在 current-main substrate 成立
3. `SWARM-003` `verification merge lanes` 已并入主干
4. `SWARM-004` 狭义 `/operating` operator control surface 已并入主干
5. `SWARM-005` `candidate-only consolidation` narrow slice 已并入主干
6. `SWARM-006` `persisted lifecycle trace readout family` narrow slice 已并入主干
7. `SWARM-007` `shared takeover / remediation handoff surfaces` narrow slice 已并入主干
8. `SWARM-008` `shared close / settlement adjacency surfaces` narrow slice 已并入主干

## 2. 影响面

这条主线当前已收口到两类证据：

1. merged narrow-slice PR
   - `#105` `SWARM-004`
   - `#106` `SWARM-003`
   - `#108` `SWARM-005`
   - `#109` `SWARM-006`
   - `#110` `SWARM-007`
   - `#111` `SWARM-008`
2. current-main substrate
   - `runThread.swarmSpawnContract`
   - `runThread.swarmReadOnlyWorkerContract`
   - operator/debugger swarm read model
   - meeting runtime 与 `/operating` 的 shared parity readouts

详细收口见：

- [`HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md`](docs/reviews/HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md)
- [`HELM_V2_1_SWARM_WORKSTREAM_REBASELINE_V1.md`](docs/reviews/HELM_V2_1_SWARM_WORKSTREAM_REBASELINE_V1.md)
- [`HELM_V2_1_SWARM_004_OPERATOR_CONTROL_SURFACE_CLOSEOUT_V1.md`](docs/reviews/HELM_V2_1_SWARM_004_OPERATOR_CONTROL_SURFACE_CLOSEOUT_V1.md)

## 3. cutover rule

从这份 closeout 起：

1. 不再继续 `SWARM-004L+`
2. 不默认继续开 `SWARM-009`
3. 后续如仍有相关工作，默认按：
   - narrow bugfix
   - ordinary backlog
   - 重新定义的新编号

## 4. 刻意未做

1. workflow engine
2. orchestration platform
3. broad auto-write
4. broad auto-send
5. team-mode 默认开启
6. 新 sandbox / 新 authority plane

这些内容都不应被写成“formal SWARM 已完整成立”。

# Repo-level Plan Framing

# Formal Login / Getting-Started Salvage

更新时间：2026-04-21
状态：In Progress
当前切片：`Slice 3 complete: /getting-started explicit-only orientation contract`

## 1. 目标

把 `codex/local-salvage-20260421` 上保住的 3 个 auth/onboarding 草稿，收口成一条可实施、可验证、可回滚的最小切片：

1. 解决 `/login` 并行 route owner 风险
2. 解决 `/getting-started` 没有稳定进入契约的问题
3. 解决草稿没有仓库级配套的问题

这条线不做：

- auth system 重写
- self-serve signup / `/setup` onboarding 重做
- 第二套 onboarding 平台

详细文档见：

- [`HELM_FORMAL_LOGIN_GETTING_STARTED_SALVAGE_REQUIREMENTS_V1.md`](docs/product/HELM_FORMAL_LOGIN_GETTING_STARTED_SALVAGE_REQUIREMENTS_V1.md)
- [`HELM_FORMAL_LOGIN_GETTING_STARTED_SALVAGE_IMPLEMENTATION_PLAN_V1.md`](docs/reviews/HELM_FORMAL_LOGIN_GETTING_STARTED_SALVAGE_IMPLEMENTATION_PLAN_V1.md)

# SWARM-001 Spawn Contract

更新时间：2026-04-22
状态：Completed on Main
当前口径：`spawn contract + budget envelope + deny readout + request record + operator readout delivered as current-main substrate`

## 1. 结论

这条线已经不再是进行中实现项。

当前应按以下方式理解：

1. `spawn contract`
2. `budget envelope`
3. `policy deny / budget blocked` posture
4. current-main 的 `runThread / debugger / /operating` 接线

都已经进入 formal SWARM closeout 证据，而不是待继续开的单独切片。

详细收口见：

- [`HELM_V2_1_SWARM_001_SPAWN_CONTRACT_PLAN_V1.md`](docs/reviews/HELM_V2_1_SWARM_001_SPAWN_CONTRACT_PLAN_V1.md)
- [`HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md`](docs/reviews/HELM_V2_1_SWARM_PRODUCTIVITY_CLOSEOUT_REPORT_V1.md)

后续新 PR 的 `plan` 文档，默认必须显式引用以下两份当前阶段 truth：

1. `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
2. `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`

引用时至少要写清三件事：

1. 本轮任务接到哪条真实业务闭环
2. 它服务的是决策、执行、审计还是复盘
3. 它按优先级映射表属于为什么应该现在做，而不是继续做功能扩面

如果新 PR 的 `plan` 文档答不清这三件事，默认降级优先级，不进入当前阶段 P0/P1 主线。

# Remaining Dirty Worktree Triage v1

更新时间：2026-04-16
状态：In Progress
当前切片：`原工作区剩余脏线盘点 + 噪音副本 / 环境副产物 / 旧快照分流`

## 1. 目标

这条线只做 3 件事：

1. 盘清当前原始工作区里剩余未跟踪脏内容
2. 把它们明确分成：
   - 本地环境副产物
   - 完全重复的副本文件
   - 落后于 current-main 的旧快照
3. 明确哪些内容应直接清理，哪些内容如果未来还要继续必须从最新 `main` 重起

这条线不是：

- 新功能开发
- 把副本文件继续当成功能线演化
- 改写历史 freeze 报告

## 2. 当前结论

- 当前原始工作区可见脏内容里，没有新的独立 PR 候选实现线
- 绝大多数 `* 2.* / * 3.*` 文件是逐字节一致的副本
- 少量差异文件也是旧快照，不是待合并实现
- `Midun` 文档线已回滚

详细盘点见：

- [`HELM_REMAINING_DIRTY_WORKTREE_TRIAGE_V1.md`](docs/reviews/HELM_REMAINING_DIRTY_WORKTREE_TRIAGE_V1.md)

一份面向 `BI report intelligent analysis push` 的 scoped 设计提案见 [`HELM_BI_REPORT_SKILL_PUSH_PLAN_V1.md`](docs/reviews/HELM_BI_REPORT_SKILL_PUSH_PLAN_V1.md)。当前已落下一版本地 dry-run skeleton，收口在 [`HELM_BI_REPORT_SKILL_PUSH_DRY_RUN_SKELETON_REPORT_V1.md`](docs/reviews/HELM_BI_REPORT_SKILL_PUSH_DRY_RUN_SKELETON_REPORT_V1.md)。这条线当前只定义 `ODPS report -> deterministic metric evaluation -> LLM explanation -> DingTalk push` 的窄 runtime，不代表 Helm 已经成为完整 BI 平台，也不代表现有 DingTalk connector 已经具备 send/write-back truth。

# Solution Extension / Reserved Workspace

更新时间：2026-04-12  
状态：In Progress  
当前切片：`Definition Freeze + Reserved Host + Internal Surface Gating + Data Inventory Tool + Multi-Tenant Extension Harness`

## 1. 目标

这条线只做 5 件事：

1. 冻结 `Worker / Skill / Resource / Solution Extension / Commercial` 分类
2. 明确 Helm first-party 自营经营功能属于 `FIRST_PARTY_RESERVED Solution Extension`
3. 明确定制开发类客户的共性功能应先进入 `TENANT_CUSTOM / REUSABLE_EXTENSION`
4. 为后续 `reserved workspace` host isolation、public host resolution 和 first-party data migration 提供稳定定义
5. 把 settings/programs/participant portal/formal skill review 的 first-party internal surfaces 收到 reserved workspace
6. 给 first-party data migration 补一条默认 dry-run、显式 apply、带 preflight 的 operator tool
7. 把 tenant custom extension 的目录、命名、manifest identity 和 harness 规则冻结成 current-main 开发规范

这条线不是：

- full extension marketplace
- app builder / registry platform
- project ERP
- creator economy / revenue marketplace
- 把所有定制开发共性直接抽进 `Skill / Worker`

新的 `runThread.closeLifecycle` 还会继续把 `closeoutSummary / closeoutResolution / closeoutResolutionFollowThrough / closeoutOutcome / closeRequest` 统一收成 canonical thread-level close lifecycle posture，并继续投影回 trace、meeting runtime surface、`/operating` 与 debugger snapshot；它仍然是 manual、review-first 的 close truth，不是 auto-close plane，也不是 broader execution authority。
新的 `runThread.closeControl` 则进一步把 `closeLifecycle / settlementFlow / closeoutSummary` 统一收成 canonical thread-level close control summary，并显式给出 `state / driver / decision / checkpointKey / currentOwner / latestUpdatedAt / nextAction`，避免不同 surface 继续各自拼接 close semantics；它仍然只是 read-model hardening，不是新的 close authority。
新的 `runThread.closeControlFlow` 则进一步把 `closeControl / settlementFlow / forwardFlow` 统一收成 canonical thread-level close control forward summary，并显式给出 `forwardState / settlementState / forwardAttentionCount / openCloseoutCount`，避免 operator surface 再把 close-control 与 bounded forward work 分散解读；它仍然只是 read-model hardening，不是新的 authority 或 auto-close plane。
新的 `runThread.closeDecisionFlow` 则进一步把 `closeControlFlow / closeoutOutcome / closeRequest` 统一收成 canonical thread-level close-decision summary，并显式给出 `controlState / outcomeState / closeRequestState`，避免 operator surface 再把 close control、final closeout truth 与 bounded close request 分散解读。继续往下一层，`runThread.closeDecisionControlSummary` 又把 `closeDecisionFlow / closeLifecycle / forwardFlow` 收成 operator 直接消费的 close-decision-control summary，并显式给出 `decisionState / controlState / lifecycleState / forwardState / settlementState`；它仍然只是 read-model hardening，不是新的 close authority。
再往下一层，`runThread.closeResolutionSummary` 会把 `closeDecisionControlSummary / closeLifecycle / closeRequest` 压成更直接的 close-resolution posture，并显式给出 `decisionControlState / lifecycleState / closeRequestState`，让 operator 直接判断当前是 `not_ready / ready_to_request_close / close_requested / kept_open / closed` 等 resolution truth；它仍然只是 read-model hardening，不是新的 close authority。
继续往下一层，`runThread.closeResolutionForwardSummary` 会把 `closeResolutionSummary / closeDecisionControlSummary / settlementFlow / forwardFlow` 压成更直接的 close-progress posture，并显式给出 `resolutionState / decisionControlState / settlementState / forwardState / forwardAttentionCount / openCloseoutCount`，让 operator 直接判断 close 决议之后还卡在哪一层 bounded forward / settlement 收口；它仍然只是 read-model hardening，不是新的 close authority。
再往下一层，`runThread.closeResolutionControlSummary` 会把 `closeResolutionForwardSummary / closeResolutionSummary / closeLifecycle / closeRequest` 再压成最直接的 bounded close-control posture，并显式给出 `resolutionState / forwardState / lifecycleState / closeRequestState`，让 operator 直接判断当前是不是已经 `ready_to_request_close / close_requested / kept_open / closed`；它仍然只是 read-model hardening，不是新的 close authority。
再往下一层，`runThread.closePostureSummary` 会把 `closeResolutionControlSummary / closeResolutionForwardSummary / closeLifecycle / closeRequest` 再压成更粗粒度的 operator close verdict，直接给出 `open / close_ready / close_pending / kept_open / closed / stale / mismatch`；它仍然只是 read-model hardening，不是新的 close authority。
再往下一层，`runThread.closePostureForwardSummary` 会把 `closePostureSummary / closeResolutionForwardSummary / settlementFlow / forwardFlow` 再压成更直接的 operator close progress 读口，显式给出 `review_requestable / review_open / closeout_open / forward_open / close_ready / close_pending / kept_open / closed`；它仍然只是 read-model hardening，不是新的 close authority。
再往下一层，`operatorControlSummary` 会把 `environmentContract.executionAuthority / executionSeam` 与 `benchmarkMatrix.workflow` 再压成跨域的 operator-facing control posture，直接给出 `boundary_only / review_gated / execution_pending / execution_review / execution_follow_through / benchmark_requested / benchmark_review / benchmark_follow_through`，并补上 `focusTitle / focusHref` 让 control summary 可以直接落到相关 benchmark/request sourcePage，或在 environment execution 没有可信来源页时回退到 `/operating`；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
再往下一层，`operatorProgressSummary` 会把 `requestPosture / takeoverActivation / operatorControlSummary / closePostureForwardSummary` 再压成更直接的 operator progress 读口，显式给出 `takeover_active / takeover_requested / human_input_requested / operator_control_attention / close_attention / review_gated / steady_state`，避免 operator 在 request、active-control、environment/benchmark control 与 close posture 四组 surface 之间来回拼状态；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
再往下一层，`operatorActionSummary` 会把 `requestPosture / takeoverActivation / operatorControlSummary / closePostureForwardSummary / operatorProgressSummary / operatorReviewActionSummary` 再压成更直接的 bounded operator next-action 读口，显式给出 `acknowledge_takeover_request / capture_human_input / complete_takeover / acknowledge_execution / review_execution / resolve_execution_followthrough / run_benchmark / acknowledge_benchmark / resolve_benchmark_followthrough / advance_close / resolve_verification / review_promotion / review_reflection_candidate / watch_reflection_job / watch_consolidation_job / keep_review_gated / observe`，并补上 `focusTitle / focusHref` 让 action summary 可以直接落到对应 thread 或 review item；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
再往下一层，`operatorWorkSummary` 会继续把 `operatorActionSummary / operatorControlSummary / operatorReviewActionSummary / continuityQueue / critical operating gaps` 压成 workspace-level next-work 读口，直接给出 `operating_gap_attention / continuity_attention / execution_attention / benchmark_attention / review_attention / review_gated / steady_state`，并让 reflection / consolidation review 也进入同一份 workspace-level next work；当 workspace next-work 由 execution/benchmark control 驱动时，它也应继承 `operatorControlSummary.focusTitle / focusHref`，避免 `/operating` 顶层 next-work 卡片丢失落点；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
再往下一层，`operatorCueSummary` 会继续把 `operatorWorkSummary / operatorControlSummary / operatorReviewSummary / operatorReviewActionSummary` 再压成 workspace-level top cue，直接给出 `operating_gap_attention / continuity_attention / control_attention / review_attention / review_gated / steady_state`，让 `/operating` 顶层先回答“现在 operator 最应该先看哪一类 cue，以及点去哪”；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
再往下一层，`operatorNextMoveSummary` 会继续把 `operatorCueSummary / operatorWorkSummary / operatorActionSummary / operatorReviewActionSummary` 再压成 workspace-level bounded next move，直接给出 `resolve_operating_gap / advance_continuity / acknowledge_execution / review_execution / resolve_execution_followthrough / run_benchmark / acknowledge_benchmark / resolve_benchmark_followthrough / resolve_verification / review_promotion / review_reflection_candidate / watch_reflection_job / watch_consolidation_job / keep_review_gated / observe`，让 `/operating` 顶层不只是知道“先看哪类 cue”，还知道“先做哪一步”；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
继续往下一层，`operatorActionCueSummary` 会继续把 `operatorCueSummary / operatorNextMoveSummary / operatorControlSummary / operatorReviewActionSummary` 压成 workspace-level coarse action lane，只保留 `resolve_operating_gap / advance_continuity / resolve_operator_control / resolve_workspace_review / keep_review_gated / observe` 六类 bounded move，让 `/operating` 顶层先回答“该做哪类动作”，再决定是否继续下钻；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
继续往下一层，`operatorReviewControlCueSummary` 会继续把 `operatorCueSummary / operatorActionCueSummary / operatorControlSummary / operatorReviewSummary / operatorReviewActionSummary` 压成 workspace-level secondary priority cue，只回答“下一层优先入口是 review 还是 control”，并保持 `control_priority / review_priority / review_gated / observe` 四类 posture，让 `/operating` 顶层在看完 coarse action lane 后不用再手工比较 review 与 control 两张卡；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
继续往下一层，`operatorStartPointSummary` 会继续把 `operatorActionCueSummary / operatorReviewControlCueSummary` 压成 workspace-level start point，直接给出一条 primary bounded move 和一条 secondary fallback，让 `/operating` 顶层先回答“先做什么，如果这步不是 blocker，下一步去哪”；它仍然只是 read-model hardening，不是新的 authority 或 workflow engine。
继续往下，`run-thread persisted control-plane lifecycle` 会把 bounded thread-level control-plane state 持久化到 `RuntimeSession.controlPlaneLifecycleJson / controlPlaneLifecycleUpdatedAt`，并通过 `runThread.persistedControlPlaneLifecycle` 显式给出 `missing / synced / drifted / invalid`；这一层还会把单槽 persisted snapshot 的 compaction/reconciliation policy 固定为 `replace_on_material_state_change` 与 `bounded_snapshot_with_event_truth_fallback`，并额外显式给出 `compactionPolicy / reconciliationPolicy / repairPolicy / guardPolicy`，把 repair 边界进一步收成 `review_first_single_slot_rewrite_only`；新的 `guardPolicy` 现在会显式给出 `fallback_to_event_truth / backfill_required / rewrite_required / reuse_current_snapshot / reuse_compacted_snapshot`，而 runtime persist helper 也已经按这同一份 policy 决定 reuse 或 rewrite；persisted snapshot 现在还会把 `resumeState / latestCheckpoint / checkpointLineageDepth / replayRequest / replayEventLogEntries / humanInputCheckpoint` 收成 material state，并额外记录 `lastRefreshReason / lastRefreshSource / writeAnchor / writeCheckpointKey / writeResumeToken`，让 replay/recovery 写路径与下一次 bounded refresh 共用同一份 persisted write-side contract；persisted lifecycle 与 operator debugger 的 `trace / replay / checkpoint` contract 也已经进入第一层，通过 `debugger.persistedLifecycleTrace` 显式给出 `backfill_required / fallback_to_event_truth / refresh_required / aligned`、当前 anchor(`checkpoint / replay / human_input`)以及最新 persisted write-side state；它仍然不是完整的 persisted control plane，也不是新的 workflow engine。
下一阶段先从 `Operator Debugger Phase 2` 开始：第一刀已经把 `replayAssistance / persistedLifecycleTrace / checkpointLineage / humanInputCheckpoint / humanInputRequest` 收成统一 `debugger.traceContract`，显式给出 `state / driver / anchor / checkpointKey / checkpointLineageDepth / replayFidelity / humanInputRequestState / nextAction`，让 meeting runtime surface 与 `/operating` 先消费同一份中心 debugger truth；第二刀已经把 persisted write-side anchor / refresh reason / checkpointKey / resumeToken 收成统一 `debugger.writeContract`，显式区分 `resume / replay / human_input / checkpoint` 的 bounded recovery write anchor，避免把 resume 继续混进 trace 视图；第三刀现在又把 `traceContract / writeContract / takeover request-activation-followthrough / recovery failure state / remediation trace` 收成统一 `debugger.recoveryActionContract`，显式告诉 operator 当前 recovery action lifecycle 到了 `backfill_required / refresh_required / requestable / requested / acknowledged / active / followthrough_open / followthrough_resolved / applied / observe` 的哪一层；第四刀则继续把 `traceContract / writeContract / recoveryActionContract` 压成统一 `debugger.recoveryLifecycleContract`；第五刀继续把 `traceContract / writeContract / recoveryActionContract / recoveryLifecycleContract` 压成统一 `debugger.recoveryTransitionContract`；第六刀把这些 contract 接成统一 `debugger.recoveryStateMachineContract`；第七刀再把它们收成统一 `debugger.recoveryExecutionContract`；当前这一刀则继续把同一份 execution truth 收成共享 `recoveryExecutionGuardContract`，让 `request_human_input / acknowledge_human_input / request / acknowledge / start / release / request_followthrough / resolve_followthrough` 八类 bounded write-side 校验直接消费 `allowed / reused / blocked` guard。当前阶段冻结报告见 [`docs/reviews/HELM_OPERATOR_DEBUGGER_PHASE2_FREEZE_REPORT_V1.md`](docs/reviews/HELM_OPERATOR_DEBUGGER_PHASE2_FREEZE_REPORT_V1.md)，相邻独立脏线的 PR 候选清单见 [`docs/reviews/HELM_OPERATOR_DEBUGGER_ADJACENT_PR_TRIAGE_V1.md`](docs/reviews/HELM_OPERATOR_DEBUGGER_ADJACENT_PR_TRIAGE_V1.md)；这些仍然只是 read-only、review-first 的 debugger contract，不是 replay engine、workflow engine 或 authority expansion。
这一层的独立报告见 [`HELM_RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_REPORT_V1.md`](docs/reviews/HELM_RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_REPORT_V1.md)。
这一层的阶段冻结报告见 [`HELM_RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_FREEZE_REPORT_V1.md`](docs/reviews/HELM_RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_FREEZE_REPORT_V1.md)。当前冻结结论仍然是 `已成形但仍需下一层`：bounded persisted snapshot、guard/repair policy、debugger trace seam 和 replay/recovery write-side contract 已成立，但这仍然不是完整 persisted control-plane engine，也不是 replay/recovery engine。
继续往下，`operatorReviewSummary` 会把 `verificationQueue / promotionQueue / reflectionCandidates / reflectionJobs / consolidationJobs` 压成 workspace-level review posture，直接给出 `verification_attention / promotion_attention / reflection_candidate_attention / reflection_job_attention / consolidation_job_attention / clear`，让 operator 能先看清 review-first 队列，而不是在 `/operating` 上继续手工扫多组列表。
再往下一层，`operatorReviewActionSummary` 会继续把 `operatorReviewSummary` 压成 workspace-level bounded next action，直接给出 `resolve_verification / review_promotion / review_reflection_candidate / watch_reflection_job / watch_consolidation_job / hold_review_gated`，避免 operator 在 review-first 队列已经显式后还要自己再判断“现在该先做哪一步”。
当前这一阶段的总冻结报告见 [`HELM_AGENT_RUNTIME_SUBSTRATE_PHASE1_FREEZE_REPORT_V1.md`](docs/reviews/HELM_AGENT_RUNTIME_SUBSTRATE_PHASE1_FREEZE_REPORT_V1.md)。当前冻结结论仍然是 `已成形但仍需下一层`：五条基础线、operator summary 链和 discoverability/validation 已经成立，但这仍然不是 workflow engine、不是完整 operator debugger、也不是 execution-authority expansion。

## 2. 产品原则与优先级映射

显式引用：

- [`HELM_PRODUCT_PRINCIPLES_V1.md`](docs/product/HELM_PRODUCT_PRINCIPLES_V1.md)
- [`HELM_PRODUCT_PRIORITY_MAPPING_V1.md`](docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
- [`HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`](docs/product/HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)
- [`HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md`](docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md)
- [`HELM_RESERVED_WORKSPACE_AND_SOLUTION_EXTENSION_PLAN_V1.md`](docs/reviews/HELM_RESERVED_WORKSPACE_AND_SOLUTION_EXTENSION_PLAN_V1.md)

本轮任务接到的真实业务闭环：

- `Helm first-party operating extension -> reserved host workspace -> internal report / governance / settlement`
- `tenant custom scenario -> shared worker / skill / resource reuse -> bounded extension`
- `public entry -> host workspace resolution -> controlled application / invite / portal`

它服务的是：

- 决策
- 执行
- 审计
- 复盘

为什么应该现在做，而不是继续扩功能面：

- 当前 repo 已同时拥有 capability 主线、commercial 主线和 first-party 经营主线
- 如果不先冻结分类，后续 schema、权限、报表和迁移路径都会一起变脏
- 先收对象边界，比继续扩页面更符合 correctness / maintainability / upgrade-safe 优先级
- 当前 reserved host identity 已成立，下一步最小正确动作就是继续收 internal surfaces，而不是把 host gating 停在 `/programs` 和 `/reports`

## 3. 当前阶段范围

- `docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md`
- `docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md`
- `docs/reviews/HELM_RESERVED_WORKSPACE_AND_SOLUTION_EXTENSION_PLAN_V1.md`
- `docs/reviews/HELM_MULTI_TENANT_EXTENSION_HARNESS_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`
- `extensions/guangpu/GUANGPU_EXTENSION_UPDATE_ISSUES_V1.md`
- 下一步会进入：
  - `prisma/schema.prisma`
  - `lib/auth/*`
  - `lib/billing/program-catalog.ts`
  - `features/programs/*`
  - `features/participant-portal/*`
- `features/settings/*`
- `app/(workspace)/reports/page.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `docs/product/HELM_RESERVED_WORKSPACE_INTERNAL_SURFACES_BASELINE_V1.md`
- `docs/reviews/HELM_RESERVED_WORKSPACE_INTERNAL_SURFACES_REPORT_V1.md`

## 4. 不做

- 立即重写整套 settings / reports / programs / portal
- 立即做完整 extension registry schema/UI
- 立即做所有 data migration
- 自动判断 tenant custom data 和 Helm first-party data
- 立即把 Helm first-party extension 平台化成通用多租户 builder

## 5. 风险

1. 如果继续把 custom delivery surface 直接写进 `Skill / Worker`，capability catalog 会失真
2. 如果 first-party reserved surface 继续留在普通 workspace 能见范围，tenant data boundary 会继续失真
3. 如果顺手把 extension 做成平台工程，会超出当前 repo 边界并增加升级成本
4. 如果只做 host resolution 而不继续收 settings / portal / review 写路径，reserved workspace 边界会停在半成品状态
5. 如果没有显式 inventory / preflight contract 就直接迁数据，会把 tenant ownership 风险藏进脚本黑箱

## 6. Guangpu Collaboration Freeze（2026-04-16）

### 6.1 当前状态

- `guangpu-seat-profile` 与 `guangpu-bi-report` identity 还没有完全统一
- seat-profile runtime 仍由 env allowlist 主导，而不是 `WorkspaceSolutionExtension` 主真值
- `/reports` 还没有把 Guangpu seat-profile 以明确 mount contract 接到 shared shell
- BI report loader 仍保留通过 `extensionKey` heuristic 推目录的旧逻辑
- `zhoupan` / `sy-lijian` 还缺少可直接执行的一页验收门

### 6.2 本轮目标

本轮只做 5 件事：

1. 统一 Guangpu 两个 extension 的 identity contract
2. 把 Guangpu enablement 主真值统一到 `WorkspaceSolutionExtension`
3. 冻结 Guangpu `/reports` 挂载 contract 与 BI runtime/registry contract
4. 给 `zhoupan` / `sy-lijian` 各补一页 acceptance gate
5. 把上述关键 contract 接进 docs / self-check / boundary-check

本轮不做：

- Guangpu 业务规则实现
- seat-profile UI polish
- BI report SQL / prompt / asset 内容扩写
- extension platform / registry platform 扩面

### 6.3 影响面

- `extensions/guangpu/*`
- `app/api/extensions/guangpu/seat-profile/*`
- `app/(workspace)/reports/page.tsx`
- `features/reports/reports-client.tsx`
- `lib/solution-extensions.ts`
- `lib/bi-report-skill/*`
- `lib/guangpu-seat-profile-extension-key-backfill.ts`
- `scripts/backfill-guangpu-seat-profile-extension-key.ts`
- `scripts/helm-self-check*.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/README.md`

### 6.4 关键假设

1. Guangpu 当前 tenant identity 仍以 `workspace.slug === "guangpu"` 或 `workspace.systemKey === "guangpu"` 作为最小匹配口径
2. `WorkspaceSolutionExtension` 已足够承载当前 enablement truth；本轮不新增新的 registry table
3. 当前 repo 内未发现继续写 `seat-profile` bare key 的 active seed / runtime 入口，因此 runtime contract 只保留 canonical key

### 6.5 任务拆分

1. Foundation
   - 统一 manifest 字段
   - 新增 `extensions/guangpu/tenant.manifest.json`
   - 新增 Guangpu tenant root `README.md`
2. Runtime Truth
   - seat-profile access check 先看 `WorkspaceSolutionExtension`
   - env allowlist 降级为附加 guard
   - 明确 `tenant_mismatch / extension_not_enabled / extension_disabled` 语义
3. Mount / Registry
   - 冻结 `/reports` tab identity、enablement、prop contract
   - 去掉 BI loader heuristic 目录解析
   - 对齐 `bi-report:dry-run` 默认路径与当前 Guangpu truth
4. Acceptance / Harness
   - 输出 `Seat Profile Acceptance Gate`
   - 输出 `BI Report Acceptance Gate`
   - 扩 self-check / boundary-check 覆盖 tenant manifest、mount contract、no heuristic loader
5. Historical Cleanup
   - 补 `seat-profile -> guangpu-seat-profile` 的 inventory/apply backfill tool
   - apply 只允许单 workspace、显式 preflight、显式 manual-review 阻断

### 6.6 验证计划

- `npm run self-check`
- `npm run check:boundaries`
- `npm run test -- extensions/guangpu/seat-profile/tests/routes.test.ts lib/bi-report-skill/skill-loader.test.ts`
- 如时间允许继续跑：
  - `npm run typecheck`
  - `npm run lint`

### 6.7 交付口径

本轮完成不按“写了多少 Guangpu 代码”判断，而按以下 5 条判断：

1. Guangpu 两个 extension 的 identity 完全统一
2. Guangpu enablement 真值只有一套
3. `/reports` 挂载 contract 已冻结
4. BI report runtime/registry contract 已冻结
5. `zhoupan` 与 `sy-lijian` 都拿到了明确验收门

# Messaging / Feedback / Activation / China GTM

更新时间：2026-04-11  
状态：Planned  
当前切片：`Phase 1 - Homepage / Dashboard Rewrite + Phase 2 - Feedback / Activation Foundation`

## 1. 目标

这条线不重写 Helm 的总定位，也不把 Helm 扩成 growth platform、marketplace 或 auto-execution plane。

它只做 5 件事：

1. 保留 `AI 经营协同操作系统` 类别名，升级首页和 dashboard 的价值表达
2. 把 `Helm 建议 / 你的决策 / 当前边界 / 依据` 收成更显式的 trust readout
3. 建 recommendation / onboarding / cancellation 的窄 feedback loop
4. 建 activation-first 的最小产品分析基础
5. 沿中国市场主线继续推进本地化表达、入口和窄 GTM feedback loop

这条线不是：

- 改总产品定义为 founder-only assistant
- consumer AI landing page redesign
- growth platform
- generic analytics / BI platform
- template marketplace
- worker ecosystem platform
- auto-send / broad auto-write
- marketplace / developer conference / creator revenue platform

## 2. 产品原则与优先级映射

显式引用：

- [`HELM_PRODUCT_PRINCIPLES_V1.md`](docs/product/HELM_PRODUCT_PRINCIPLES_V1.md)
- [`HELM_PRODUCT_PRIORITY_MAPPING_V1.md`](docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
- [`HELM_CHINA_MARKET_MESSAGING_V1.md`](docs/brand/HELM_CHINA_MARKET_MESSAGING_V1.md)
- [`HELM_CHINA_GTM_PACKAGE_V1.md`](docs/brand/HELM_CHINA_GTM_PACKAGE_V1.md)
- [`HELM_PRODUCT_STRATEGY_MESSAGING_DELTA_REVIEW_V1.md`](docs/reviews/HELM_PRODUCT_STRATEGY_MESSAGING_DELTA_REVIEW_V1.md)
- [`HELM_HOMEPAGE_DASHBOARD_MESSAGING_REWRITE_PLAN_V1.md`](docs/reviews/HELM_HOMEPAGE_DASHBOARD_MESSAGING_REWRITE_PLAN_V1.md)

本轮任务接到的真实业务闭环：

- `public entry -> signup/login -> setup -> dashboard first judgement`
- `recommendation shown -> evidence opened -> review -> action / feedback`
- `trial use -> activation / non-activation -> retention signal / cancellation reason`
- `China-market acquisition -> role-based demo -> controlled trial`

它服务的是：

- 决策
- 执行
- 审计
- 复盘

为什么应该现在做，而不是继续功能扩面：

- 当前首页与 dashboard 的 product truth 已成立，但价值表达仍可更快抵达用户
- 当前 recommendation feedback 与 analytics 基础已存在，但 activation / trust / cancellation 信号还不够收口
- 当前中国市场叙事和 DingTalk / WeCom 基础已存在，下一步更值得做的是本地化 proof 和 trial loop，而不是继续扩功能面
- 这条线优先缩短 `理解 -> 试用 -> 第一条价值 -> review`，比继续扩功能更符合当前 P0 / P1 主线

## 3. 当前阶段范围

- `PLANS.md`
- `app/page.tsx`
- `features/auth/login-panel.tsx`
- `features/dashboard/goal-driven-home-surface.tsx`
- `lib/operating-system/goal-driven-home.ts`
- `features/analytics/*`
- `lib/analytics/*`
- recommendation feedback / onboarding / cancellation feedback 相关 surfaces and actions
- `docs/brand/HELM_CHINA_MARKET_MESSAGING_V1.md`
- `docs/brand/HELM_CHINA_GTM_PACKAGE_V1.md`
- `docs/README.md`
- `README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 4. 不做

- 改官方类别名为 `AI 决策助手`
- 把 `创业者的 AI 副驾驶` 升成总定位
- `AI 可处理` / `授权 AI 执行` 语法
- broad mobile rewrite
- 微信小程序
- 6,000+ integrations 式平台叙事
- template marketplace / creator revenue split
- public community platform
- production-grade growth stack
- production-grade A/B testing platform
- broad auto-touch / auto-send
- legal / compliance overclaim（GDPR / SOC 2 ready 等）

## 5. 风险

1. 如果首页过度 founder 化，会削弱 role-based operating workspace 定位
2. 如果 dashboard 只追求极简，会丢掉 `campaign / boundary / evidence / review` 差异化
3. 如果 feedback / analytics 顺手扩面，会滑向 growth platform 或 BI platform
4. 如果用 `AI 可处理`、`自动低风险触达` 这类语法，会冲 execution boundary
5. 如果把未验证的时间节省、留存、转化数字写成承诺，会形成 external overclaim

## 6. 失败模式与防线

### Failure Mode 1 - Product / Market Fit 不成立

最危险的失败剧本：

- 用户注册后觉得“有意思”，但没有形成连续使用
- 新用户说不清 Helm 到底帮他推进什么
- 首页 / onboarding / dashboard 不能在短时间内让人感到第一条真实价值

当前计划里的对应防线：

- `Phase 1` 首页与 dashboard 改稿
- `Phase 2` feedback loop + activation analytics
- `Phase 3` trust readout

当前明确不采用的防线：

- 直接把总定位改成 `AI 决策助手`
- 承诺 `5 分钟必见价值`
- 用“AI 可处理”掩盖 review boundary

### Failure Mode 2 - 用户获取成本过高

最危险的失败剧本：

- 获客成本持续高位，增长依赖重广告
- 内容、试用、推荐和 proof 之间没有形成正反馈
- trial 进入后无法形成 role-based proof 和转介绍基础

当前计划里的对应防线：

- `Phase 4` China GTM / pilot user loop
- role-based homepage / demo / GTM consistency
- content topics 进入 GTM docs，而不是写成产品 truth

当前明确不采用的防线：

- 双向奖励推荐系统直接进当前主线
- “永久免费核心功能” 的 freemium 扩面
- public community platform

### Failure Mode 3 - 技术复杂度拖垮迭代

最危险的失败剧本：

- v2/runtime 复杂度继续上升，但用户侧价值验证跟不上
- 任务过大、周期过长，导致反馈和改稿不能快速闭环
- 工程质量与用户价值脱节，陷入“技术正确但产品不成立”

当前计划里的对应防线：

- 所有任务按 `2 周左右一个 batch` 收口
- 每个 batch 必须同时给出页面 /行为、guards/tests、docs/report
- 所有功能先接 activation / feedback / trust 闭环，再考虑扩面

附加纪律：

- 每个 sprint 预留一条明确的 hardening / debt slice
- 默认不把下一层平台化工作塞进当前 batch

### Failure Mode 4 - 现金流与商业验证不足

最危险的失败剧本：

- 产品在试点期持续扩复杂度，但没有形成可解释的 activation / conversion signal
- 商业基础设施维护成本继续上升，但并未换来更好的 product proof

当前计划里的对应防线：

- 先做 activation / retention / feedback 基础，而不是先做商业扩面
- 保持 narrow GTM / narrow trial / narrow China proof
- 优先验证从 `entry -> first suggestion -> review -> action` 的价值链

说明：

- `CAC / LTV / runway` 作为公司经营指标保留
- 但它们不写成当前 repo 的产品完成条件

### Failure Mode 5 - 竞争差异化不清晰

最危险的失败剧本：

- Helm 被看成 Notion AI / ChatGPT / meeting tool 的模糊组合
- 用户看不清 Helm 的独特价值与可信边界

当前计划里的对应防线：

- 强化 `AI 建议，你做最终决定`
- 强化跨会议 / 跨决策 / 跨对象的经营记忆
- 强化 formal review、boundary、evidence、write-back

当前明确不采用的防线：

- 模板市场
- 用户生成内容平台
- creator revenue split
- broad ecosystem story

## 7. 内部早期信号与红线

以下指标作为内部 operating signal 使用，不作为对外承诺：

### Green Signals

- 新用户能在首轮 session 内说清 Helm 当前帮他推进什么
- dashboard first-fold 的 evidence open / review entry / action creation 有连续发生
- recommendation feedback 开始稳定产生并能回流优先级
- role-based demo / trial / homepage 叙事趋于一致

### Yellow Flags

- 用户只打开 dashboard，不展开 evidence、不进入 review
- onboarding 完成后没有进入第一条 suggestion / action
- feedback 只收集、不回流
- 首页 copy 与 dashboard copy 再次漂回 system-speak

### Red Lines

- 为了提速而模糊 `recommendation != commitment`
- 为了增长而引入 auto-touch / auto-send 语法
- 为了差异化而把未成立能力写成已成立
- 为了追求完整而扩大到 marketplace / growth stack / BI platform

## 8. 执行节奏与迭代纪律

默认 cadence：

- `2 周左右一个 batch`
- `每个 batch 只收一条最小可验证 slice`
- `每个 batch 都必须有用户侧 proof`

默认 batch 配比：

- `60%` 用户价值 / 页面与闭环
- `20%` guards / tests / docs / report
- `20%` hardening / debt / cleanup

默认 stop rules：

- 如果当前 batch 不能回答“用户为什么现在会更容易得到价值”，则不继续扩实现
- 如果当前 batch 会模糊边界，则先收缩
- 如果当前 batch 只能增加复杂度而不能增加 activation / review / feedback signal，则降级优先级

## 9. 阶段计划

### Phase 0

- 冻结 messaging delta、trust readout、feedback scope 与 activation metrics
- 把可吸收 / 需改写 / 不采纳结论落进 repo docs
- 状态：Completed
- 交付物：
  - `docs/reviews/HELM_PRODUCT_STRATEGY_MESSAGING_DELTA_REVIEW_V1.md`
  - `docs/reviews/HELM_HOMEPAGE_DASHBOARD_MESSAGING_REWRITE_PLAN_V1.md`

### Phase 1

- 重写首页 hero / subhero / proof stack / trust note
- 重写 dashboard first fold 的标题、层级和 judgement wording
- 显式化 `Helm 建议 / 你的决策 / 当前边界 / 依据`
- 保留 goal-driven home、review-first、evidence-first
- 状态：Next

### Phase 2

- 建 recommendation / onboarding / cancellation 的窄 feedback loop
- 建 activation-first analytics：`connect -> first suggestion -> evidence open -> review -> action / feedback`
- 补最小 reports / analytics readout，而不扩成 platform
- 状态：Next

### Phase 3

- 做 trust system 第一层：adoption / override / evidence coverage / outcome / exception
- 把 customer health / operating risk 挂到现有 follow-through and risk readout
- 不做单一 “历史准确率” 主叙事
- 状态：Planned

### Phase 4

- 强化中国市场本地化 entry / copy / GTM proof / pilot user loop
- 做 founder / operator / trial user 的窄访谈和 content feedback loop
- 不把 GTM / community 写成 product platform
- 状态：Planned

## 10. 90 天执行顺序

1. Homepage rewrite
2. Dashboard first-fold rewrite
3. Feedback instrumentation
4. Activation analytics
5. Trust readout
6. China GTM / pilot loop follow-through

## 11. 可执行任务清单

### Track A - Messaging / Homepage

- `A1` 审核当前首页 copy、CTA、proof、trust note 与 brand doc drift
- `A2` 产出首页新 hero / subhero / 4 张价值卡 / trust note 定稿
- `A3` 在 `app/page.tsx` 落地改稿，保持 SSO / login / role-entry 结构不变
- `A4` 更新 brand doc / README / docs index 的表述同步
- `A5` 补首页相关 snapshot / e2e / copy guard

完成标准：

- 首页 5 秒内能回答 `是什么 / 为什么现在 / 是否要人拍板`
- 不出现 founder-only 或 auto-execution 误导
- 仍保持 canonical CTA 与 China-market truth

### Track B - Dashboard / Trust Readout

- `B1` 审核 dashboard first-fold 的 current copy、顺序和冗余解释
- `B2` 收口 `Top 3 immediate moves / blockers / decisions waiting / handoff`
- `B3` 在卡片层加入 `Helm 建议 / 你的决策 / 当前边界 / 依据` 合同
- `B4` 将 guidance / long rationale / evidence block 下沉到 second layer
- `B5` 补 representative e2e / guard，确认没有退化成 generic task board

完成标准：

- dashboard 10 秒内能回答 `推进什么 / 阻塞什么 / 谁拍板 / 谁接手`
- `recommendation != commitment` 继续显式成立
- 不牺牲 campaign / review / evidence 结构

### Track C - Feedback Loop

- `C1` 定义 recommendation feedback event taxonomy
- `C2` 定义 onboarding feedback event taxonomy
- `C3` 定义 cancellation / downgrade reason taxonomy
- `C4` 在关键节点接最小反馈组件与落库路径
- `C5` 把反馈结果接回 analytics / reports / prioritization readout

完成标准：

- 每种反馈都有稳定 event / storage / readout
- 反馈不会越过 workspace / tenant governance
- 反馈信号能被产品优先级使用，而不是只停留在日志

### Track D - Activation Analytics

- `D1` 定义 activation funnel：`entry -> connect -> first suggestion -> evidence -> review -> action`
- `D2` 梳理现有 analytics 事件与缺口
- `D3` 只补最小缺失事件，不扩成广义 tracking matrix
- `D4` 在 `/analytics` 或 `/reports` 增加 narrow readout
- `D5` 补 guards / tests，确保 support-only boundary 仍成立

完成标准：

- 可以回答“用户卡在哪一步”
- 可以区分“看过建议”与“真正进入 review / action”
- analytics 仍保持 judgement-support role

### Track E - China GTM / Pilot Loop

- `E1` 审核 China GTM 包与首页 / role entry 的一致性
- `E2` 强化 DingTalk / WeCom / China payment 的 honest proof 表达
- `E3` 定义窄 founder / operator interview loop
- `E4` 定义 content topics，但只落 GTM docs / demo material，不写成产品 truth
- `E5` 形成 monthly pilot insight pack

完成标准：

- 中国市场表达更本地化，但不 overclaim
- role-based demo / trial / GTM 口径一致
- feedback loop 真正能回到产品计划，而不是停留在运营建议

### Track F - Execution Discipline / Risk Review

- `F1` 为 `Phase 1` 和 `Phase 2` 各定义 1 个两周 batch scope
- `F2` 每个 batch 增加一条明确的 hardening / debt item
- `F3` 每个 batch 结束时复盘 `activation / review / feedback` 变化
- `F4` 每月做一次风险复核：PMF / acquisition / complexity / cash discipline / differentiation
- `F5` 明确哪些公司经营项只做 operating review，不写成 product truth

完成标准：

- 不因为执行速度牺牲 boundary honesty
- 不因为复杂度牺牲用户价值验证
- 不因为增长焦虑把 GTM / finance / community 混成产品 scope

## 12. 任务拆分建议

默认按 5 个 PR batch 推进：

1. `Homepage Messaging Rewrite`
2. `Dashboard First-Fold Rewrite`
3. `Feedback Loop Foundation`
4. `Activation Analytics Readout`
5. `China GTM / Pilot Feedback Pack`

每个 batch 都必须：

- 先 plan
- 再 implementation
- 再 validation
- 最后 report

建议附加一个非代码的 operating review 节奏：

- `每两周` 看一次 batch 复盘
- `每月` 看一次 PMF / acquisition / cash discipline / competition review

## 13. 角色分工建议

如果按多代理或多角色执行，默认拆成：

- `探索`：核对首页 / dashboard / feedback / analytics / GTM 当前 truth
- `实现`：页面文案与事件链路改动
- `验证`：self-check / boundaries / tests / e2e
- `文档`：README / docs / report / plan drift 同步
- `评审`：boundary / regression / overclaim 检查

## 14. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

---

# Guangpu / Midun Production Signal Collection Setup

日期：2026-05-09

## 1. 目标

把 Guangpu / MiDun 经营信号按 Helm 正式接入生产系统的方式收口：

1. Helm core 只提供统一调度、鉴权入口、fail-closed start check 和通用 run summary。
2. Guangpu / MiDun extension 只注册租户 job、读取 MiDun、输出脱敏 `SignalCandidate[]`。
3. 五类 MiDun 经营信号进入 `signal-engine.ingest()`，由 Helm 统一落 `guangpu_signal_lifecycle`。
4. 默认频率按业务特征设置，但仍需显式 env 开启，不默认产生生产外部读取。

## 2. 影响面

- `lib/signal-collection/*`：通用调度器支持 minute/hour step/range cron，并在 API / scheduler 两条路径都执行 `canStart`。
- `extensions/guangpu/midun-integrate/lib/runtime/*`：新增生产信号目录、信号 mapper、runner ingestion。
- `.env.example` 与 `extensions/guangpu/midun-integrate/README.md`：同步生产接入配置与频率。

## 3. 关键假设

- 当前只接 Guangpu allowlist 内 rentCode，不引入未知租户或未知 rentCode。
- 生产读取由 MiDun gateway 提供，Helm 不直连 MiDun 业务库。
- MiDun summary 已经过脱敏 gate，mapper 不写 Midun，不外呼，不发通知。

## 4. 风险与控制

- 风险：高频信号拉取可能增加 gateway 压力。
  - 控制：默认显式开启；生产频率集中在风险 / 跟进 / 意向，T+1 统计保持每日。
- 风险：空生产配置误触发采集。
  - 控制：`canStart` 检查网关地址、RSA 公钥、执行身份；`NODE_ENV=production` 额外要求 shared secret 和 host allowlist。
- 风险：MiDun 信号被误解为自动执行依据。
  - 控制：所有信号仍为 `suggestion_only`，allowed effects 仅 `external_read` + `internal_signal_write`。

## 5. 验证方案

- `npm run typecheck`
- `npm run lint`
- `npm run check:boundaries`
- `npm run check:public-release`
- target vitest：
  - `lib/signal-collection/scheduler.test.ts`
  - `extensions/guangpu/midun-integrate/lib/runtime/midun-signal-candidates.test.ts`
  - `extensions/guangpu/midun-integrate/tests/midun-integrate-cron.test.ts`

# Helm Harness Infrastructure Next Step v1

更新时间：2026-04-24
状态：Harness Gap Read-Only Substrate Complete; Runtime Server Minimal Implementation V1 Delivered on Branch
当前切片：`extension bundle read-only validation adoption delivered; capability decision trace read-only adoption delivered; monitor substrate read-only adoption delivered; memory observability budgeting read-only adoption delivered; swarm isolation task ledger plan gate delivered; runtime server seam readout delivered; runtime server minimal local seam delivered; narrow worker queue delivered; sandbox roadmap boundary delivered on branch`

## 1. 目标

围绕上一轮 [`HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md`](docs/reviews/HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md) 收口 Helm 下一阶段价值最高的七条 harness 基础设施升级：

1. `Extension Bundle + Capability Manifest`
2. `Capability Resolution Engine`
3. `Monitor Substrate`
4. `Memory Observability and Budgeting`
5. `Swarm Isolation + Task Ledger + Plan Gate`
6. `Runtime Server / App Server Seam`
7. `Sandbox Roadmap`

目标不是扩 surface，而是按最小可验证切片推进 harness 基础设施：

1. `Extension Bundle + Capability Manifest`
   - 第一刀已经在分支上落成 `read-only validation adoption`
2. `Capability Resolution Engine`
   - 第二刀已经在分支上落成 `read-only capability decision trace adoption`
3. `Monitor Substrate`
   - 第三刀已经在分支上落成 `read-only monitor substrate adoption`
4. `Memory Observability and Budgeting`
   - 第四刀已经在分支上落成 `read-only memory observability budgeting adoption`
5. `Swarm Isolation + Task Ledger + Plan Gate`
   - 第五刀已经在分支上落成 `read-only swarm isolation task ledger plan gate closeout`
6. `Runtime Server / App Server Seam`
   - 第六刀已经在分支上落成 `runtime server seam readout`
7. `Sandbox Roadmap`
   - 第七刀已经在分支上落成 `sandbox roadmap boundary`

## 2. 本轮不做

- 不做 capability engine 接管 allow / deny
- 不做 schema 改造
- 不做 sandbox
- 不做 broad auto-write / auto-send
- 不做 swarm UI / orchestration surface
- 不做真实 server process / background daemon
- 不做 remote execution plane
- 不声明真实 filesystem / network / process sandbox

## 3. 当前文档真值

- [`HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md`](docs/reviews/HELM_CLAUDE_CODE_AND_CODEX_HARNESS_GAP_ANALYSIS_V1.md)
- [`HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md`](docs/product/HELM_EXTENSION_BUNDLE_AND_CAPABILITY_MANIFEST_REQUIREMENTS_V1.md)
- [`HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md`](docs/product/HELM_CAPABILITY_RESOLUTION_ENGINE_REQUIREMENTS_V1.md)
- [`HELM_EXTENSION_BUNDLE_MANIFEST_SCHEMA_DRAFT_V1.md`](docs/product/HELM_EXTENSION_BUNDLE_MANIFEST_SCHEMA_DRAFT_V1.md)
- [`HELM_CAPABILITY_DECISION_TRACE_READ_MODEL_DRAFT_V1.md`](docs/product/HELM_CAPABILITY_DECISION_TRACE_READ_MODEL_DRAFT_V1.md)
- [`HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_PLAN_V1.md`](docs/reviews/HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_PLAN_V1.md)
- [`HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_PLAN_V1.md`](docs/reviews/HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_PLAN_V1.md)
- [`HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_REPORT_V1.md`](docs/reviews/HELM_EXTENSION_BUNDLE_READ_ONLY_VALIDATION_ADOPTION_REPORT_V1.md)
- [`HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_REPORT_V1.md`](docs/reviews/HELM_CAPABILITY_DECISION_TRACE_READ_ONLY_ADOPTION_REPORT_V1.md)
- [`HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_PLAN_V1.md`](docs/reviews/HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_PLAN_V1.md)
- [`HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_REPORT_V1.md`](docs/reviews/HELM_MONITOR_SUBSTRATE_READ_ONLY_ADOPTION_REPORT_V1.md)
- [`HELM_MEMORY_OBSERVABILITY_BUDGETING_READ_ONLY_ADOPTION_PLAN_V1.md`](docs/reviews/HELM_MEMORY_OBSERVABILITY_BUDGETING_READ_ONLY_ADOPTION_PLAN_V1.md)
- [`HELM_MEMORY_OBSERVABILITY_BUDGETING_READ_ONLY_ADOPTION_REPORT_V1.md`](docs/reviews/HELM_MEMORY_OBSERVABILITY_BUDGETING_READ_ONLY_ADOPTION_REPORT_V1.md)
- [`HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_PLAN_V1.md`](docs/reviews/HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_PLAN_V1.md)
- [`HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_REPORT_V1.md`](docs/reviews/HELM_HARNESS_SWARM_RUNTIME_SANDBOX_FINAL_CLOSEOUT_REPORT_V1.md)

## 4. 分期顺序

### Phase 0

- 冻结 formal gap 文档
- 冻结前两步 requirements
- 同步 `README.md` / `docs/README.md` / `PLANS.md`

### Phase 1

- 冻结 `manifest schema draft`
- 冻结 `capability decision trace read model draft`
- 继续保持 implementation-later

### Phase 2

- 冻结 `bundle read-only validation adoption plan`
- 冻结 `capability decision trace read-only adoption plan`
- 继续保持 decision-before-implementation

### Phase 3

- `bundle validation` 只读接入
  - 已在当前分支落地：
    - manifest validator helper
    - Guangpu sample manifest upgrade
    - `self-check` integration
    - boundary/doc drift sync
    - adoption report
- `capability decision trace` 只读接入
  - 已在当前分支落地：
    - `CapabilityDecisionTrace` read-only builder
    - program / participant portal action trace payload
    - manual settlement action wrapper trace payload
    - operator readout helper
    - targeted tests
    - report / self-check / boundary sync

### Phase 4

- `monitor substrate` 只读接入
  - 已在当前分支落地：
    - `MonitorReadout` read-only builder
    - connector lag / webhook failure / meeting ingest backlog / memory sync anomaly / settlement exception / review queue drift 信号映射
    - operator next move / source chain / boundary note 输出
    - targeted tests
    - report / self-check / boundary sync
- `memory observability and budgeting` 只读接入
  - 已在当前分支落地：
    - `MemoryObservabilityBudgetReadout` read-only builder
    - memory index / load budget / load trace 输出
    - healthy trace / budget pressure / fallback trace / missing trace posture 映射
    - targeted tests
    - report / self-check / boundary sync
- 再根据结果继续排：
  - swarm isolation + task ledger + plan gate

### Phase 5

- `swarm isolation + task ledger + plan gate` 只读接入
  - 已在当前分支落地：
    - `SwarmIsolationPlanGateReadout` read-only builder
    - isolated execution state / task ledger / mailbox handoff / before-write plan gate / authority boundary 输出
    - ready / blocked / review-required posture 映射
    - targeted tests
    - report / self-check / boundary sync
- `runtime server / app server seam` 只读接入
  - 已在当前分支落地：
    - `RuntimeServerSeamReadout` read-only builder
    - surface entry / run-thread lifecycle / review gate / acknowledgement / trace observability 输出
    - 不创建 server process、background worker、remote execution plane 或新 control plane
- `sandbox roadmap` boundary 接入
  - 已在当前分支落地：
    - `SandboxRoadmapReadout` boundary builder
    - current runtime truth / short-term controls / mid-term controls / long-term controls 输出
    - 明确 plugin runtime still has no real sandbox，swarm/automation/extension autonomy 仍 capped at read-only or review-first
- `harness final closeout summary`
  - 已在当前分支落地：
    - `HarnessFinalCloseoutSummary`
    - 七项 gap sequence 在 read-only substrate 层完成

## 5. 风险

1. 过早从 requirements 跳到 runtime 实现，会把错误抽象固化进 current-main
2. 如果不先统一 bundle truth 和 capability precedence，后面的 monitor / swarm / runtime server 只会建立在不稳定基础上
3. 如果把这条线写成 generic agent platform，会偏离 Helm 当前 `judgement-first / review-first / business-first` 主线
4. 如果把 readout 误读成 execution authority，会突破 swarm / runtime / sandbox 的核心安全边界

## 6. 完成定义

1. top-7 harness gap sequence 已有正式 requirements / plan / report 文档
2. rollout 顺序明确，且仍保持 contract-first / implementation-later / read-only adoption first
3. `Swarm Isolation + Task Ledger + Plan Gate`、`Runtime Server / App Server Seam`、`Sandbox Roadmap` 已有 read-only builder、测试、报告和守卫
4. 没有把 Helm 扩写成 marketplace、broad orchestration、scheduler、notification center、runtime server、sandbox runtime 或 generic coding harness

# Runtime Server Minimal Implementation V1

更新时间：2026-04-24
状态：Delivered on Branch
范围：只做 lifecycle / review request / acknowledgement / monitor event / handoff 的 local runtime seam 和 narrow worker queue；不做 remote execution、不做真实 sandbox、不做 swarm UI

## 1. 目标

在上一轮 `runtime server seam readout` 之后，补一层最小本地实现：

- `buildRuntimeServerMinimalThread`
- `createRuntimeWorkerQueueState`
- `enqueueRuntimeWorkerQueueItem`
- `planRuntimeWorkerQueueTick`
- `completeRuntimeWorkerQueueItem`
- `deadLetterRuntimeWorkerQueueItem`
- `buildRuntimeServerMinimalSummary`

## 2. 影响面

- `lib/runtime-server-minimal.ts`
- `lib/runtime-server-minimal.test.ts`
- `docs/reviews/HELM_RUNTIME_SERVER_MINIMAL_IMPLEMENTATION_PLAN_V1.md`
- `docs/reviews/HELM_RUNTIME_SERVER_MINIMAL_IMPLEMENTATION_REPORT_V1.md`
- `docs/README.md`
- `scripts/helm-self-check-refactored.ts`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 3. 本轮不做

- runtime server minimal 不创建 remote execution plane
- runtime server minimal 不做真实 sandbox
- runtime server minimal 不做 swarm UI
- worker queue 不执行外部副作用
- 不创建 server process / background daemon / scheduler
- 不接管 app shell
- 不做 workflow engine

## 4. 行为边界

- `lifecycle_event` 只更新 shared lifecycle posture
- `review_request` 只进入 operator review posture
- `acknowledgement` 只记录 receipt truth，acknowledgement 不等于 official success
- `monitor_event` 只做 report/review posture，不自动 remediation
- `handoff` 只做 local handoff readiness，不自动对外发送
- `idempotency_key` 防重复入队
- `lease_token` 只做本地 tick 租约
- `dead_letter` 只做本地失败归档

## 5. 验证

- `./node_modules/.bin/vitest run lib/runtime-server-minimal.test.ts` passed，1 file / 7 tests
- 收口验证继续执行 self-check、boundary、typecheck、lint、full test、build、quality regression 和 `git diff --check`

# Memory Frontstage Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
范围：只做 `/memory` 中文前台展示层、时间线响应式约束、审计回放可读性和本轮报告；不改 memory schema、query contract、写入动作、权限、导出契约或底层 enum 真值

## 1. 目标

1. 继续尝试 Computer Use 读取 Safari 页面状态；不可用时保留错误并用 Playwright 真实页面复验
2. 将 `/memory` 前台可见的系统词收成中文经营语言
3. 修复手机端时间线卡片按内容撑宽的问题
4. 保留记忆修正、承诺状态、阻碍状态、复盘候选、审计回放和导出边界

## 2. 影响面

- `features/memory/memory-client.tsx`
- `features/memory/display-copy.ts`
- `features/memory/display-copy.test.ts`
- `components/shared/blocker-card.tsx`
- `components/shared/commitment-card.tsx`
- `docs/reviews/HELM_MEMORY_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`

## 3. 验证

- Computer Use：应用列表可读；Safari 仍返回 `cgWindowNotFound`
- Playwright `/memory` 桌面 1440px：目标系统词计数 0
- Playwright `/memory` 手机 390px：目标系统词计数 0，主内容不再页面级横向撑宽
- `npm run test -- features/memory/display-copy.test.ts features/memory/queries.test.ts` passed；2 files / 7 tests
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed with existing Turbopack NFT warning
- `npm run quality:regression` passed；51 files / 180 tests
- `git diff --check` passed

# Analytics Frontstage Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
范围：只做 `/analytics` 中文前台展示层、长事件键与模型调用明细移动端换行、基础 Card 缩宽保护和本轮报告；不改 analytics query、事件写入、模型日志、统计口径或权限

## 1. 目标

1. 继续按 Computer Use + Playwright 复评循环推进
2. 将 `/analytics` 前台可见的系统词收成中文经营语言
3. 修复手机端热门事件、模型调用明细和长技术键撑宽卡片的问题
4. 让基础 Card 默认具备 `min-w-0 / max-w-full / break-words` 保护

## 2. 影响面

- `features/analytics/analytics-client.tsx`
- `features/analytics/display-copy.ts`
- `features/analytics/display-copy.test.ts`
- `components/ui/card.tsx`
- `docs/reviews/HELM_ANALYTICS_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`

## 3. 验证

- Playwright `/analytics` 桌面 1440px：扩展目标系统词计数 0，主内容无页面级横向溢出
- Playwright `/analytics` 手机 390px：扩展目标系统词计数 0，热门事件、长键值和模型调用明细不再撑宽
- `npm run test -- features/analytics/display-copy.test.ts features/memory/display-copy.test.ts` passed；2 files / 9 tests
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed with existing Turbopack NFT warning
- `npm run quality:regression` passed；51 files / 180 tests
- `git diff --check` passed

# Diagnostics Frontstage Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
范围：只做 `/diagnostics` 中文前台展示层、写入失败/重试/凭证明细可读性、移动端断行保护和本轮报告；不改 diagnostics query、memory write failure schema、retry contract、审计 payload 或权限

## 1. 目标

1. 继续按 Computer Use + Playwright 复评循环推进
2. 将 `/diagnostics` 前台可见的系统词收成中文经营语言
3. 修复手机端写入失败、人工复核队列、重试约束、凭证台账等长明细撑宽卡片的问题
4. 保留诊断页作为就绪判断和只读证据复核面的定位，不升级成执行面

## 2. 影响面

- `features/diagnostics/diagnostics-client.tsx`
- `features/diagnostics/display-copy.ts`
- `features/diagnostics/display-copy.test.ts`
- `lib/i18n/messages.ts`
- `lib/operating-system/first-loop-query.ts`
- `docs/reviews/HELM_DIAGNOSTICS_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`

## 3. 验证

- Computer Use：应用列表可读；Safari 仍返回 `cgWindowNotFound`
- Playwright `/diagnostics` 桌面 1440px：目标系统词计数 0，主内容无页面级横向溢出
- Playwright `/diagnostics` 手机 390px：目标系统词计数 0，诊断主体不再横向撑宽；剩余轻微 `scrollDelta` 来自全局顶栏通知按钮
- `npm run test -- features/diagnostics/display-copy.test.ts features/diagnostics/first-loop-adoption.test.ts` passed；2 files / 10 tests
- `npm run typecheck` passed
- `npm run self-check` passed
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed with existing Turbopack NFT warning
- `npm run quality:regression` passed；51 files / 180 tests
- `git diff --check` passed

---

## 2026-04-20 Refactor Stabilization Slice

### 1. 目标

- 在不改变业务逻辑的前提下，先切掉当前最明显的维护性和编译稳定性风险
- 保持现有 API / 页面行为兼容
- 给后续继续拆 `runtime-upgrade.ts` 和 `settings-client.tsx` 留出稳定模块边界

### 2. 本轮范围

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade-continuity.ts`
- `lib/helm-v2/runtime-upgrade-continuity-analytics.ts`
- `lib/helm-v2/runtime-upgrade-continuity-calibration.ts`
- `lib/helm-v2/runtime-upgrade-continuity-impact.ts`
- `lib/helm-v2/runtime-upgrade-continuity-synthesis.ts`
- `lib/helm-v2/runtime-upgrade-continuity-thresholds.ts`
- `lib/helm-v2/runtime-upgrade-continuity-wording.ts`
- `lib/helm-v2/runtime-upgrade-handoff.ts`
- `lib/helm-v2/runtime-upgrade-lifecycle.ts`
- `lib/helm-v2/runtime-upgrade-problem-space.ts`
- `lib/helm-v2/runtime-upgrade-state.ts`
- `features/dashboard/queries.ts`
- `features/settings/settings-client.tsx`
- `features/settings/components/org-admin-governance.tsx`
- `features/settings/components/permissions-settings.tsx`
- `features/settings/components/account-settings-tab.tsx`
- `features/settings/components/billing-overview-panels.tsx`
- `features/settings/components/billing-manual-settlement-workflow.tsx`
- `features/settings/components/billing-attribution-overview-panels.tsx`
- `features/settings/components/billing-attribution-detail-panels.tsx`
- `features/settings/components/billing-participant-portal-panels.tsx`
- `features/settings/components/billing-program-catalog-panels.tsx`
- `features/settings/components/billing-settlement-batch-panels.tsx`
- `features/settings/components/billing-settlement-line-panels.tsx`
- `features/settings/components/billing-settlement-overview-panels.tsx`
- `features/settings/components/billing-settlement-summary-panels.tsx`
- `features/settings/components/billing-metrics-panels.tsx`
- `features/settings/components/billing-payout-readiness-panels.tsx`
- `features/settings/components/billing-settlement-exception-panels.tsx`
- `features/settings/components/pilot-settings-tab.tsx`
- `features/settings/components/settings-overview-panels.tsx`
- `features/settings/components/settings-display.tsx`
- `features/settings/types/settings-client-props.ts`
- `features/settings/formatters/auth-session-formatters.ts`
- `features/settings/formatters/labels.ts`
- `features/settings/formatters/governance-formatters.ts`
- `features/settings/types/settings-types.ts`
- `scripts/cleanup-duplicate-generated-types.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/helm-self-check-refactored.ts`
- `scripts/helm-self-check.ts`
- `package.json`
- `lib/db.ts`
- `tsconfig.json`

### 3. 已完成

- 将 `lib/helm-v2/runtime-upgrade.ts` 里一组 continuity / recovery / remediation 纯辅助逻辑提取到 `lib/helm-v2/runtime-upgrade-continuity.ts`
- 在 `runtime-upgrade.ts` 保留兼容性导出，避免外部调用点和现有测试断裂
- 将 dashboard 顶层数据加载从单个 15+ 分支 `Promise.all` 重组为 3 个逻辑批次：
  - pipeline
  - meetings
  - governance
- 移除 `lib/db.ts` 里对 `process.env.DATABASE_URL` 的运行时污染，改为只通过 Prisma datasource 注入
- 把 `features/settings/settings-client.tsx` 里的 tab 解析、治理审计/连接器展示格式化函数、相关 marker/checklist 类型拆到独立模块
- 继续把 `settings-client.tsx` 里的 auth-session 只读格式化簇拆到 `features/settings/formatters/auth-session-formatters.ts`
- 继续把 billing / payout / settlement 的静态标签簇迁到 `features/settings/formatters/labels.ts`
- 将 `settings-client.tsx` 里约 1300 行的 `SettingsClientProps` / `SettingsSummaryConnection` / beneficiary 纯类型声明迁到 `features/settings/types/settings-client-props.ts`
- 让 `settings-client.tsx` 只通过 `import type` 消费这些声明，避免继续把大型数据 shape 和组件运行时代码绑在同一个文件里
- 将 `settings-client.tsx` 里的 `pilot` 整个 tab 抽到 `features/settings/components/pilot-settings-tab.tsx`
- 将 `Info` / `RoleGuide` / `StatusHint` 抽到 `features/settings/components/settings-display.tsx`，收紧主文件底部展示 helper
- 将 `settings-client.tsx` 里 `permissions` tab 的 `Recent org-admin audit` 与 `Org-admin governance support pack` 展示块抽到 `features/settings/components/org-admin-governance.tsx`
- 让 `settings-client.tsx` 只保留 capability 组装与动作传递，继续收紧 auth-session / governance 展示依赖的主文件耦合
- 将 `settings-client.tsx` 里 `permissions` tab 的 `Role guide` 与 `Team permissions` 成员生命周期卡抽到 `features/settings/components/permissions-settings.tsx`
- 同步 `scripts/decision-first-boundary-check.ts`，让 settings/payment 边界守卫同时识别新的 `settings` 展示组件文件，避免纯展示搬迁被误判为边界回归
- 将 tabs 之前的设置页总览层抽到 `features/settings/components/settings-overview-panels.tsx`
- 让 `settings-client.tsx` 继续收敛到页面级数据准备与 tab 编排，减少顶部 guidance / quick-entry / connector banner 的主文件噪音
- 将 `settings-client.tsx` 里的 `account` 整个 tab 抽到 `features/settings/components/account-settings-tab.tsx`
- 保留 `focusAreas` / `defaultStrategies` 的原有摘要展示格式，避免 tab 拆分把数组摘要回退成原始 JSON 字符串
- 将 `settings-client.tsx` 里 billing 顶部总览层抽到 `features/settings/components/billing-overview-panels.tsx`
- 保留 billing 顶层的支付通道、生命周期、能力权益与 checkout / portal / refresh 按钮行为，不把 registry / payout / portal / settlement 表单一起拖进这次切片
- 同步 `scripts/decision-first-boundary-check.ts`，让 settings/payment 边界守卫识别新的 billing 展示组件，并继续扫描 finance-scope forbidden markers
- 将 billing 尾部的 `Seat summary / Internal usage summary` 抽到 `features/settings/components/billing-metrics-panels.tsx`
- 保留席位姿态和内部用量的原有只读展示与 boundary 文案，不改 seat / usage 读口和计费边界表达
- 再次同步 `scripts/decision-first-boundary-check.ts`，让 settings/payment 边界守卫继续覆盖新的 billing metrics 组件
- 将 billing 中段的 `Settlement operations proof pack / Payout rails readiness gate / Payout rail pilot cohort` 抽到 `features/settings/components/billing-payout-readiness-panels.tsx`
- 保留 payout readiness / pilot cohort 的只读判断、narrative 和 manual-first boundary 文案，不把 registry / payout profile / participant portal / settlement action 一起卷进来
- 再次同步 `scripts/decision-first-boundary-check.ts`，让 settings/payment 边界守卫继续覆盖新的 payout readiness 组件
- 将 `Settlement exceptions / reversals` 抽到 `features/settings/components/billing-settlement-exception-panels.tsx`
- 保留 exception / reversal 的只读 posture、narrative 和 internal-only boundary 文案，不碰 settlement line action 或 batch 写路径
- 同步 `scripts/decision-first-boundary-check.ts` 的 settlement-exception 与 settings/payment 守卫，让纯展示搬迁继续可验证
- 将 `Beneficiary attribution view / Attribution source breakdown` 抽到 `features/settings/components/billing-attribution-overview-panels.tsx`
- 保留归因总览的只读商业真实状态，不碰 revenue rule、ledger、program review 或 settlement 写路径
- 同步 `scripts/decision-first-boundary-check.ts` 的 settings/payment 守卫，让新的 attribution overview 组件继续纳入 finance-scope forbidden 扫描
- 将 `Revenue rule summary / Attribution ledger / payable later` 抽到 `features/settings/components/billing-attribution-detail-panels.tsx`
- 保留归因规则、台账和 payable-later 的只读商业视图，不碰 program review、invite、batch 或 settlement line 写路径
- 同步 `scripts/decision-first-boundary-check.ts` 的 settings/payment 守卫，让新的 attribution detail 组件继续纳入 finance-scope forbidden 扫描
- 将 `Program catalog and application intake` 的卡片头部、摘要和 `Published programs` 左栏抽到 `features/settings/components/billing-program-catalog-panels.tsx`
- 保留右侧 `Application review queue` 的筛选、审核、发邀请和最新 invite 链接写路径在 `settings-client.tsx`，不改变 review / invite 契约
- 同步 `scripts/decision-first-boundary-check.ts` 的 program-catalog 与 settings/payment 守卫，让新的 program catalog 组件继续纳入 boundary marker 与 finance-scope forbidden 扫描
- 将整张 `Participant portal access` 卡片抽到 `features/settings/components/billing-participant-portal-panels.tsx`
- 保留 invite draft、本地状态、invite 发放与状态更新 handler 在 `settings-client.tsx` 里透传，不改变 participant portal 的写路径、可用性判断或 self-only 边界表达
- 同步 `scripts/decision-first-boundary-check.ts` 的 contributor-portal 与 settings/payment 守卫，让新的 participant portal 组件继续纳入 boundary marker 与 finance-scope forbidden 扫描
- 将 `Manual settlement workflow` 右侧的 `Beneficiary totals / Source-type totals / Missing payout profiles` 抽到 `features/settings/components/billing-settlement-summary-panels.tsx`
- 保留批次创建、导出、批准、关闭，以及 line-level paid / reverse 写路径在 `settings-client.tsx`，不改变 manual settlement 的写动作与 posture 判断
- 同步 `scripts/decision-first-boundary-check.ts` 的 manual-settlement 与 settings/payment 守卫，让新的 settlement summary 组件继续纳入 boundary marker 与 finance-scope forbidden 扫描
- 将 `Manual settlement workflow` 左侧的 `Create monthly batch / current batch / recent settlement batches` 抽到 `features/settings/components/billing-settlement-batch-panels.tsx`
- 保留批次创建、批准、导出、关闭 handler 在 `settings-client.tsx` 里透传，不改变 batch-level 写动作、disabled 判断或 CSV/manual posture
- 同步 `scripts/decision-first-boundary-check.ts` 的 manual-settlement 与 settings/payment 守卫，让新的 settlement batch 组件继续纳入 boundary marker 与 finance-scope forbidden 扫描
- 将 `Manual settlement workflow` 右侧 current batch 的 line list、paid note、reverse reason 和 `Mark paid / Reverse line` 按钮抽到 `features/settings/components/billing-settlement-line-panels.tsx`
- 保留 line-level `paid / reverse` handler、本地备注状态和 posture 守卫在 `settings-client.tsx` 里透传，不改变 line-level 写动作、disabled 判断或 internal-only / manual boundary 表达
- 同步 `scripts/decision-first-boundary-check.ts` 的 manual-settlement 与 settings/payment 守卫，让新的 settlement line 组件继续纳入 boundary marker 与 finance-scope forbidden 扫描
- 将 `Manual settlement workflow` 顶部的 summary grid 和 posture narrative 抽到 `features/settings/components/billing-settlement-overview-panels.tsx`
- 保留批次、汇总和 line-level 写路径在 `settings-client.tsx` 里透传，不改变 manual settlement 的按钮动作、CSV/manual posture 或 internal-only boundary 表达
- 同步 `scripts/decision-first-boundary-check.ts` 的 manual-settlement 与 settings/payment 守卫，让新的 settlement overview 组件继续纳入 boundary marker 与 finance-scope forbidden 扫描
- 将整张 `Manual settlement workflow` 卡级编排抽到 `features/settings/components/billing-manual-settlement-workflow.tsx`
- 保留 batch / summary / line-level 子组件和所有 handler、本地 state、posture 守卫在 `settings-client.tsx` 里透传，不改变 manual settlement 的执行边界或写路径
- 同步 `scripts/decision-first-boundary-check.ts`，让新的 manual-settlement workflow 组件继续纳入 boundary marker 与 finance-scope forbidden 扫描
- 将 `buildProblemSpaceDrafts / buildEdgeBriefMarkdown / deriveCoordinationOutcome / problem-space brief helpers / buildCoordinationTraceBridge` 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-problem-space.ts`
- 在 `runtime-upgrade.ts` 保留 import + re-export 兼容层，不改变现有调用点、测试入口和 `eval-harness` 的导入路径
- 同步 `scripts/helm-self-check.ts` 与 `scripts/decision-first-boundary-check.ts`，让 coordination-trace discoverability / boundary 守卫同时识别新的 problem-space helper 模块
- 将 `buildMetricDate / buildRuntimeHandoffPacketContract / normalizeRuntimeAgentId / normalizeRuntimeApprovalTier / mapRuntimeHandoffPacketState / mapRunThreadLifecycleHandoffPacket / mapRunThreadLifecycleRemediationEntry` 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-handoff.ts`
- 保留 `runtime-upgrade.ts` 里的调用点和现有 read-model / lifecycle 组装方式，不改变 handoff packet、remediation trace 或 benchmark metric-date 的运行语义
- 将 `buildRuntimePostureSnapshot / formatRuntimePostureSnapshotSummary / buildRunThread*LifecycleInputs / buildRunThreadResultAcknowledgementInputs` 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-lifecycle.ts`
- 在 `runtime-upgrade.ts` 保留 import + re-export 兼容层，不改变现有测试入口、debugger posture 组装方式或 run-thread lifecycle / result acknowledgement 的运行语义
- 同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate discoverability 守卫继续识别新的 lifecycle helper 模块
- 将 `buildPruneTraceEntries / buildRuntimeContinuityState / parseRuntimeRemediationTrace` 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-state.ts`
- 在 `runtime-upgrade.ts` 保留 import + re-export 兼容层，不改变 continuity state、prune trace、remediation trace 的现有调用点、测试入口或 `eval-harness` 导入路径
- 同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate / budgeted continuity discoverability 守卫继续识别新的 state helper 模块
- 将 continuity classification / pilot analytics / SOP summary helper cluster 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-continuity-analytics.ts`
- 这次提取覆盖 `workspace size / meeting shape / session density / meeting cadence / failure history / participant role posture` 分类函数，以及 `confidence band / risk band / sample coverage / stability / interval wording / long-horizon trend / SOP template / step review` 纯派生逻辑
- 在 `runtime-upgrade.ts` 保留现有 `buildRuntimeContinuityPilotEffectivenessReview`、`buildRuntimeContinuityPilotSessionReview` 和 continuity queue 组装方式，不改变 pilot review、SOP 标题、queue summary 或 operator surface 的现有行为
- 同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate discoverability 守卫继续识别新的 continuity analytics helper 模块
- 将 `confidence simplification / interval wording consistency / drift audit / wording drift tracking / cross-surface & cross-readout wording audit` 纯 helper cluster 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-continuity-wording.ts`
- 在 `runtime-upgrade.ts` 保留 `buildRuntimeContinuityPilotEffectivenessReview` 的阈值修订、step review 和最终 return 接线，不改变 canonical wording、审计摘要、回归率或 operator-facing wording 的现有语义
- 再次同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate discoverability 守卫继续识别新的 continuity wording helper 模块
- 将 `long-term material impact review / audit / pattern aging / sampling aging / refinement audit` 纯 helper cluster 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-continuity-impact.ts`
- 在 `runtime-upgrade.ts` 保留 `mostStableStep / highestMaterialImpactStep / dominantAtRiskStep` 的 ranking 逻辑和最终 return 接线，不改变 material-impact summary、optimization hint 或 operator-facing audit wording 的现有语义
- 再次同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate discoverability 守卫继续识别新的 continuity impact helper 模块
- 将 `top-step ranking / sopEffectiveness / longTermOutcome / guidanceRefinement` 纯 synthesis helper cluster 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-continuity-synthesis.ts`
- 在 `runtime-upgrade.ts` 保留 `buildRuntimeContinuityPilotEffectivenessReview` 的上游 `stepReviews / thresholdRevisions / stabilityReviewHighlights` 准备和最终 return 接线，不改变 SOP synthesis、long-horizon outcome wording 或 operator-facing guidance refinement 的现有语义
- 再次同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate discoverability 守卫继续识别新的 continuity synthesis helper 模块
- 将 `calibrationProfile / subgroupCalibration / sampleReview / stabilityReview / driftSynthesis` 的纯 readout builder 从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-continuity-calibration.ts`
- 在 `runtime-upgrade.ts` 保留 `thresholdRevisions`、`stabilitySignals`、`trendMetrics` 和 scale-up / recheck 上游准备，不改变 calibration threshold、stability recheck 或 drift posture 的现有语义
- 同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate discoverability 守卫继续识别新的 continuity calibration helper 模块
- 同步 `scripts/decision-first-boundary-check.ts`，让 `helm_v2_2_continuity_pilot_review_long_term_outcome_correlation_boundary` 在纯搬迁后继续扫描新的 continuity calibration 模块，避免 boundary marker 因 helper 外移被误判为回归
- 将 `thresholdRevisions` 的 8 组重复映射模板从 `lib/helm-v2/runtime-upgrade.ts` 提取到 `lib/helm-v2/runtime-upgrade-continuity-thresholds.ts`
- 在 `runtime-upgrade.ts` 保留 `distributionWithTier / meetingShapeCohorts / cohortFamilies / remediationPostureCohorts` 等上游 cohort 计算，只把 `thresholdRevisions` 的纯映射、排序和去重逻辑收进独立 helper，不改变阈值筛选、排序优先级或 headline 语义
- 再次同步 `scripts/helm-self-check.ts` 与 `scripts/helm-self-check-refactored.ts`，让 runtime substrate discoverability 守卫继续识别新的 continuity threshold helper 模块
- 修复 TypeScript 编译污染：
  - 排除 `.next` / Playwright 临时目录里的重复 `* 4.ts` 生成物
  - 清理本轮替换占位模块时产生的 `settings` 重复副本文件，恢复真实源文件集合
  - 新增 `scripts/cleanup-duplicate-generated-types.ts`，并将其串到 `npm run typecheck`，在 `next typegen` 后清理 `.next/types` / Playwright 临时目录里的重复 `* 2.ts` / `* 4.ts` 产物

### 4. 关键假设

- `settings-client.tsx` 本轮只抽离纯展示和纯类型逻辑，不碰表单提交、权限、状态流和服务端动作
- dashboard 本轮目标是降低页面级 fan-out 和整理边界，不冒进到手写大 SQL 或改动返回契约
- `next typegen` 会保留历史重复生成物，因此编译稳定性要靠清理脚本兜底，而不是只靠 `tsconfig` 通配排除

### 5. 明确不做

- 不重写业务规则
- 不改变现有 route / action / query 返回 shape
- 不把 dashboard 直接改成单 SQL 报表层
- 不在本轮内完成 `runtime-upgrade.ts` 和 `settings-client.tsx` 的最终拆分

### 6. 验证

- `npm run check:boundaries`
- `npx vitest run lib/helm-v2/runtime-upgrade.test.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/account-settings-tab.tsx`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-overview-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-overview-panels.tsx features/settings/components/billing-metrics-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-overview-panels.tsx features/settings/components/billing-metrics-panels.tsx features/settings/components/billing-payout-readiness-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-overview-panels.tsx features/settings/components/billing-metrics-panels.tsx features/settings/components/billing-payout-readiness-panels.tsx features/settings/components/billing-settlement-exception-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-attribution-overview-panels.tsx features/settings/components/billing-overview-panels.tsx features/settings/components/billing-metrics-panels.tsx features/settings/components/billing-payout-readiness-panels.tsx features/settings/components/billing-settlement-exception-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-attribution-overview-panels.tsx features/settings/components/billing-attribution-detail-panels.tsx features/settings/components/billing-overview-panels.tsx features/settings/components/billing-metrics-panels.tsx features/settings/components/billing-payout-readiness-panels.tsx features/settings/components/billing-settlement-exception-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-participant-portal-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-program-catalog-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-settlement-batch-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-settlement-line-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-settlement-overview-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-manual-settlement-workflow.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/billing-settlement-summary-panels.tsx scripts/decision-first-boundary-check.ts`
- `npx eslint features/settings/settings-client.tsx features/settings/components/settings-overview-panels.tsx features/settings/components/permissions-settings.tsx features/settings/components/org-admin-governance.tsx features/settings/components/pilot-settings-tab.tsx features/settings/components/settings-display.tsx features/settings/types/settings-client-props.ts features/settings/formatters/auth-session-formatters.ts features/settings/formatters/governance-formatters.ts features/settings/types/settings-types.ts scripts/cleanup-duplicate-generated-types.ts scripts/decision-first-boundary-check.ts features/dashboard/queries.ts lib/db.ts lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-continuity.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-problem-space.ts scripts/decision-first-boundary-check.ts scripts/helm-self-check.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-handoff.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-lifecycle.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-state.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-continuity-analytics.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-continuity-calibration.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts scripts/decision-first-boundary-check.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-continuity-impact.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-continuity-synthesis.ts lib/helm-v2/runtime-upgrade-continuity-impact.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-continuity-thresholds.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts`
- `npx eslint lib/helm-v2/runtime-upgrade.ts lib/helm-v2/runtime-upgrade-continuity-wording.ts scripts/helm-self-check.ts scripts/helm-self-check-refactored.ts`
- `npm run typecheck`
- `npm run check:boundaries`
- `npm run lint`
  - 结果：通过，存在 5 个既有 warning（`lib/bi-report-skill/feedback-memory.ts` 1 个未使用类型，`lib/connectors/google.ts` 4 个未使用参数），不是本轮新增
- `npm run build`
- `npm run self-check`
  - 结果：仅因 `.env` 缺少 `DATABASE_URL` 失败，不是本轮代码回归

### 7. 剩余风险

1. `lib/helm-v2/runtime-upgrade.ts` 仍然过大，本轮继续拆出了 continuity、`problem-space / coordination-trace`、`handoff / remediation mapping`、`run-thread lifecycle / posture snapshot`、`continuity state / prune trace / remediation trace`、`continuity analytics / SOP summary`、`continuity wording / drift audit / cross-surface regression`、`continuity material-impact / sampling-aging / refinement audit`、`continuity synthesis / top-step ranking / long-horizon guidance refinement`、`continuity calibration / subgroup stability / drift readout`，以及 `continuity threshold revision mapping` 纯 helper cluster
   - 当前体量已从 `20914` 行降到 `17016` 行，但主文件仍然过大
2. `features/settings/settings-client.tsx` 仍然很大，本轮只切走了 tab / display helper / types / governance formatter / auth-session formatter / props type block 这组低风险内容
   - 当前体量已从 `9153` 行降到 `3904` 行，但主组件仍然过大
3. dashboard 现在是 3 个逻辑批次，但批次内部仍有多条数据库查询；页面级 fan-out 已下降，SQL 总数还没有降到 3 条以内
4. `settings` 模块本轮刚建立出第三层展示边界，后续继续拆分时要避免跨文件重新耦合回 `SettingsClientProps` 的超深嵌套类型
5. `next typegen` 的重复文件现象虽然已经被脚本清理兜底，但根因仍未定位，后续应继续确认是不是本地环境或某个生成链在保留旧副本

---

# First-Loop / Onboarding / First-Value

更新时间：2026-04-13
状态：Completed (current baseline)
当前切片：`PRD freeze + shared read-model + explicit return-anchor trace + setup->dashboard handoff + adoption instrumentation + per-user readout + review/write-back completion proxies`

当前冻结报告见：

- [`docs/reviews/HELM_FIRST_LOOP_AND_HOME_SURFACE_FREEZE_REPORT_V1.md`](docs/reviews/HELM_FIRST_LOOP_AND_HOME_SURFACE_FREEZE_REPORT_V1.md)

## 1. 目标

这条线当前先做 5 件事：

1. 冻结 Helm 在当前阶段的 first loop 定义
2. 明确 first loop 必须从真实 signal 开始，而不是从配置完成开始
3. 把 `setup / dashboard / detail / approvals / memory / diagnostics / reports / operating` 收成同一条 horizontal loop
4. 用 current-main 已存在的 workspace / meeting / approval / memory truth 拼出共享 first-loop read-model
5. 用现有 audit trail 补一个 per-user 的 explicit return-anchor trace
6. 给后续 Codex 和 PM 一份 repo-aligned 的产品入口与实现锚点

这条线不是：

- Vertical 行业方案
- onboarding automation platform
- growth / analytics platform
- 通用 AI assistant 或 Agent platform
- workflow engine

## 2. 产品原则与优先级映射

显式引用：

- [`HELM_PRODUCT_PRINCIPLES_V1.md`](docs/product/HELM_PRODUCT_PRINCIPLES_V1.md)
- [`HELM_PRODUCT_PRIORITY_MAPPING_V1.md`](docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
- [`HELM_FIRST_LOOP_PRD_V1.md`](docs/product/HELM_FIRST_LOOP_PRD_V1.md)
- [`HELM_ROLE_AUDIENCE_FOUNDATION_V1.md`](docs/product/HELM_ROLE_AUDIENCE_FOUNDATION_V1.md)
- [`HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md`](docs/product/HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md)
- [`HELM_GOAL_CAMPAIGN_FOUNDATION_V1.md`](docs/product/HELM_GOAL_CAMPAIGN_FOUNDATION_V1.md)
- [`HELM_TRIAL_ONBOARDING_SELF_SERVE_SIGNUP_SPRINT_1_REPORT.md`](docs/product/HELM_TRIAL_ONBOARDING_SELF_SERVE_SIGNUP_SPRINT_1_REPORT.md)
- [`HELM_FORMAL_SELF_SERVE_ENTRY_AND_TEAM_ONBOARDING_REPORT.md`](docs/product/HELM_FORMAL_SELF_SERVE_ENTRY_AND_TEAM_ONBOARDING_REPORT.md)

本轮任务接到的真实业务闭环：

- `public entry -> /setup -> role / goal -> first signal -> suggestion -> review -> follow-through -> memory write-back -> next visit anchor`

它服务的是：

- 决策
- 执行
- 审计
- 复盘

为什么应该现在先做 horizontal readout，而不是先做 Vertical：

- 当前 self-serve entry、setup 和 operating surfaces 已成立，但 first-value 主线还没有被收成同一条 loop
- 当前最关键的不是扩对象，而是让空系统用户第一次就能跑通一条真实动作闭环
- 如果不先冻结并接上 horizontal contract，后续 Vertical 很容易先长成对象扩面和平台化

## 3. 当前阶段范围

当前切片已覆盖：

- `docs/product/HELM_FIRST_LOOP_PRD_V1.md`
- `docs/README.md`
- `PLANS.md`
- `lib/operating-system/first-loop.ts`
- `lib/operating-system/first-loop-query.ts`
- `features/first-loop/actions.ts`
- `components/shared/first-loop-surface-summary.tsx`
- `components/shared/first-loop-anchor-button.tsx`
- `/setup`
- `/dashboard`
- `/setup -> /dashboard` query-based first-loop handoff
- first-loop adoption instrumentation via `AuditLog`
- diagnostics per-user first-loop adoption + review/write-back proxy readout
- `/meetings/[id]`
- `/approvals`
- `/memory`
- `/diagnostics`
- `/reports`
- `/operating`
- per-user explicit return anchor via `AuditLog`
- single next action + second-visit return readback via shared first-loop model
- diagnostics first-loop progress / return-anchor readout
- diagnostics review completion / write-back confirmation proxies via `APPROVAL_APPROVED` and `MEMORY_FACT_CONFIRMED`

仍未进入更深实现的面：

- first-loop 专用 schema / event contract
- dedicated next-visit anchor persistence
- dedicated adoption / maturity instrumentation
- Vertical object packs

## 4. 不做

- 不新增 first-loop 专用 schema、API contract 或 background workflow
- 不把 shared read-model 误写成 canonical persisted object
- 不先做 Vertical role pack / industry pack
- 不把 onboarding 做成教程中心
- 不把 review surface 扩成 auto-commit / auto-send plane

## 5. 风险

1. 当前成立的是 shared read-model 和 page-level summary，不是完整 first-loop runtime contract
2. planned product objects 仍可能被误读成已实现 schema
3. 当前 explicit return anchor 仍挂在现有 audit trail 上，还不是 dedicated persisted object
4. 如果后续实施从配置而不是 signal 开始，会再次偏离 PRD 主线
5. 如果后续为了 wow moment 弱化 review-before-commitment，会直接冲边界

## 6. 下一步建议

后续如果进入实现，建议按 5 个最小切片推进：

1. `/setup -> dashboard` 的 first-loop handoff
2. dashboard first-run signal / suggestion contract
3. detail / approvals 的 first review posture
4. memory write-back + next visit anchor
5. diagnostics / reporting adoption maturity readout

---

# Home Surface Rules / Dashboard Contract v1

更新时间：2026-04-14
状态：Completed (current baseline)
当前切片：`home first-fold contract + dashboard work-entry surface + state-aware secondary disclosure baseline + detail/approvals/memory surface routing + home-surface arrival contract + dedicated surface landing contract with single CTA + approvals page-story description / queue-side boundary context / queue-control teaching copy behind next layer + memory page-story description / object-state teaching copy / correction-boundary / reflection-history / meeting-memory governance context behind next layer + richer opportunity workspace page-story description / ranking/momentum/work-progress context behind next layer + meeting detail page-story description behind next layer + detail route preference for richer opportunity workspace + home-entry landing suppression on dedicated surfaces + contact/company/meeting home-entry next-layer disclosure + remove legacy detailed-readouts path + empty/first-loop/returning/review-heavy state arbitration baseline + freeze closure`

当前冻结报告见：

- [`docs/reviews/HELM_FIRST_LOOP_AND_HOME_SURFACE_FREEZE_REPORT_V1.md`](docs/reviews/HELM_FIRST_LOOP_AND_HOME_SURFACE_FREEZE_REPORT_V1.md)

## 1. 目标

这条线当前先做 4 件事：

1. 冻结登录后首页只承担的 4 个职责：恢复上下文、收口优先级、暴露待 review、送进下一个工作面
2. 把首页首屏收紧为 `Top 1-3 work items + Needs Your Review + Resume / Continue + light blockers`
3. 明确 `Empty / New`、`First Loop In Progress`、`Returning / Active`、`Review-Heavy / Decision-Heavy` 四种首页状态
4. 明确首页与 detail / approvals / memory 的边界分工，避免首页继续长成指标墙、教程中心或 reasoning 展示面

显式引用：

- [`docs/product/HELM_HOME_SURFACE_RULES_V1.md`](docs/product/HELM_HOME_SURFACE_RULES_V1.md)
- [`docs/product/HELM_FIRST_LOOP_PRD_V1.md`](docs/product/HELM_FIRST_LOOP_PRD_V1.md)
- [`docs/product/HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md`](docs/product/HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md)
- [`docs/product/HELM_GOAL_DRIVEN_HOME_CAMPAIGN_SURFACE_SPRINT_1_REPORT.md`](docs/product/HELM_GOAL_DRIVEN_HOME_CAMPAIGN_SURFACE_SPRINT_1_REPORT.md)

## 2. 当前不做

- 不把 dashboard 直接重写成完整新 IA
- 不做通知中心式 feed
- 不做教程中心、模板商城或功能超市
- 不做首页级全量 metrics wall / reasoning wall / memory browser
- 不做 Vertical 行业对象导航

## 3. 当前直接影响

- `/dashboard`
- empty / new 首页状态
- first-loop 首页状态
- returning / resume 首页状态
- review-heavy 首页状态
- 首页 review queue 入口
- detail / disclosure 的后置结构
- memory 在首页的暴露方式

## 4. 当前已落地

- dashboard 首屏现在先经过一个 `work-entry surface`
- 首屏当前已前置：
  - `Top 1-3 work items`
  - `Needs your review`
  - `Resume / continue`
  - `Light blocker summary`
- setup handoff 不再单独占一张首页首卡，而是并入首屏 work-entry 仲裁
- 现有 `FirstLoopSurfaceSummary`、`GoalDrivenHomeSurface`、operating / reporting context 已开始折进 second-layer disclosure，而不是继续直接铺在首页主入口后面
- 首页 second-layer 已显式补出 `detail / approvals / memory` 的 `surface routing`，让 Home 更像工作入口，而不是继续自己解释 why / review / replay
- 更重的 `Operating overview`、meeting / approval / pipeline readouts 不再作为首页 second-layer 的默认运行路径，而是优先让位给 dedicated work surfaces
- dashboard header 已收轻，不再把 briefing / 多按钮 toolbar 放在首页工作入口之前
## 5. 风险

1. 如果首页排序不准，`Top 1-3` 会直接失真
2. 如果 why-later / evidence-later 下沉不顺，首页会在“太空”和“太满”之间来回摆
3. 如果状态切换不清，用户会分不清自己看到的是 first-loop、returning 还是 review-heavy 首页

## 6. 下一步建议

后续实现按 4 个切片推进：

1. 先改首页首屏 contract，不全面重写 dashboard
2. 再落 empty / first-loop / returning / review-heavy 四种状态
3. 再收 review 区与 resume 区
4. 最后把 reasoning / memory / timeline 继续后置到 detail / drawer

---

# Page Presentation Priority Alignment v1

更新时间：2026-04-16
状态：Frozen
当前切片：`公开入口 + 正式入口 + Batch A / Batch B 高频页面对齐冻结`

阶段冻结报告见 [`HELM_PAGE_PRESENTATION_PRIORITY_ALIGNMENT_FREEZE_REPORT_V1.md`](docs/reviews/HELM_PAGE_PRESENTATION_PRIORITY_ALIGNMENT_FREEZE_REPORT_V1.md)。
当前冻结结论是：`本轮覆盖页面已完整成立；全站页面呈现优先级对齐已成形但仍需下一层`。

## 1. 目标

这条线只做 6 件事：

1. 把当前主干里的页面按真实职责分成少数几类，而不是继续每页各讲一套首屏逻辑
2. 统一中文界面和英文界面的呈现语言：中文界面用中文，英文界面用英文，不再把中文页写成中英文混合行话
3. 把所有高频页面的第一屏继续收口到“当前判断 / 最重要动作 / 待拍板事项 / 当前边界”这一条主线
4. 把解释、证据、历史、偏好、治理说明继续后置到第二层、抽屉或详情区，而不是继续占满首屏
5. 复用当前已经存在的 `reporting-protocol`、`home surface rules` 和 `business-first surface reduction`，而不是再造一套并行页面协议
6. 分批把未对齐页面纳入同一套排片规则，并补对应验证

显式引用：

- [`DESIGN.md`](DESIGN.md)
- [`docs/product/HELM_HOME_SURFACE_RULES_V1.md`](docs/product/HELM_HOME_SURFACE_RULES_V1.md)
- [`docs/product/HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md`](docs/product/HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md)
- [`docs/pilot/manual-acceptance-paths.md`](docs/pilot/manual-acceptance-paths.md)
- [`lib/presentation/reporting-protocol.ts`](lib/presentation/reporting-protocol.ts)

本轮任务接到的真实业务闭环：

- `公开入口 -> 登录 / 试用 -> 首页工作入口`
- `首页工作入口 -> detail / approvals / memory / reports / operating`
- `对象详情 -> 判断 -> 下一步 -> 边界 -> 证据`
- `经营面 / 治理面 -> 当前主动作 -> 当前阻塞 -> 待拍板 -> 边界`

它服务的是：

- 决策
- 执行
- 审计
- 复盘

为什么应该现在做，而不是继续扩功能面：

- 当前首页、机会页、审批页和部分叙事详情链已经有统一协议，但高频页面整体仍存在“判断优先”和“对象堆叠优先”两套排法并行
- 如果不先把页面重点排序收口，后续新页面会继续把解释、证据、偏好和治理说明重新长回首屏
- 中文界面当前仍有少量中英文混排行话，会直接伤害中国本地化产品的理解成本

## 2. 页面类型与统一排片规则

### A. 公开入口页

适用范围：

- `/`
- `/login`
- `/setup`
- `/demo`

首屏只回答：

1. 这是什么入口
2. 为什么现在进入
3. 下一步怎么开始
4. 哪些边界仍然保留

明确不做：

- 长篇产品自述
- 营销化卡片墙
- 中英文混合行话

### B. 首页工作入口页

适用范围：

- `/dashboard`

首屏只回答：

1. 现在最重要的事是什么
2. 哪件事需要我先拍板
3. 当前应该回到哪个工作面
4. 当前轻阻塞是什么

继续保持 `Top 1-3 work items + Needs Your Review + Resume / Continue + light blockers`。

### C. 高频经营 / 治理面

适用范围：

- `/operating`
- `/approvals`
- `/inbox`
- `/reports`
- `/memory`
- `/imports`
- `/analytics`
- `/diagnostics`
- `/settings`

首屏只回答：

1. 当前主动作是什么
2. 当前最大阻塞是什么
3. 当前待拍板事项是什么
4. 当前边界是什么

解释、偏好、治理说明、帮助文案、证据与历史默认下移。

### D. 对象详情面

适用范围：

- `contacts`
- `companies`
- `meetings`
- `opportunities`

首屏只回答：

1. 这个对象当前处于什么状态
2. 最重要下一步是什么
3. 这一步的边界是什么
4. 哪个相关对象或工作面最值得接着打开

对象基础信息、历史长文、辅助动作、偏好设置默认后置。

### E. 叙事 / 变体 / 对外表达详情链

适用范围：

- `proposal / package / offer / external narrative / founder/sales/delivery variants`

这类页面继续优先复用 `reporting-protocol`：

- L1：判断 / 决策请求 / 下一步 / 边界
- L2：动作摘要 / worker 摘要 / review 状态
- L3：为什么重要 / 证据 / drilldown

这条链当前总体已较对齐，后续只做守卫和零星修补，不作为第一批主改造对象。

## 3. 当前盘点结论

### 已较对齐

- `dashboard`
- `opportunities`
- `approvals`
- `operating`
- 多数 narrative / detail chain 页面

### 已部分对齐，但首屏仍偏厚

- `contacts`
- `companies`
- `meetings`
- `reports`
- `inbox`
- `memory`

### 仍偏治理台 / 配置台堆叠

- `settings`
- `imports`
- `analytics`
- `diagnostics`
- `portal`

## 4. 当前不做

- 不做全站 IA 重写
- 不做大规模路由改名或目录重构
- 不改对象模型和权限模型
- 不顺手做新的 design system 平台
- 不把中文本地化扩成自动翻译工程

## 5. 实施顺序

### Batch A：高频 detail / report 对齐

- `contacts`
- `companies`
- `meetings`
- `reports`
- `inbox`
- `memory`

目标：

- 把首屏压到当前判断、下一步、边界和工作连接
- 把辅助动作、长解释、偏好和历史后置
- 把中文文案里的混合行话清干净

### Batch B：治理 / 导入 / 分析面收口

- `settings`
- `imports`
- `analytics`
- `diagnostics`
- `portal`

目标：

- 保留治理能力，但把首屏从配置堆叠收成“当前状态 / 风险 / 下一步 / 边界”

### Batch C：剩余入口和例外页

- `setup`
- `demo`
- `capture`
- `search`
- 其余角色入口与例外页

目标：

- 收尾对齐语言、层级和入口节奏

## 6. 风险

1. 如果直接全站一起改，容易把已经对齐的 detail chain 也重新打散
2. 如果只改视觉顺序、不改语言，中文界面仍会被中英文混合行话拖慢理解
3. 如果把 settings / imports 这类治理面也按对象详情面硬套，会丢掉治理信息密度
4. 如果没有页面类型分组，验证会退化成“看起来顺一点”的主观判断

## 7. 验证

代码验证：

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

页面验证：

- 中文界面首屏不再混用中英文行话
- 首屏在 5-10 秒内能回答该页最关键的判断、下一步和边界
- 证据、历史、偏好和长解释后置到第二层或更深层
- manual acceptance 路径不被破坏

## 8. 下一步建议

当前先执行：

1. `Batch A` 的 `contacts / companies / meetings / reports`
2. 同批把 `inbox / memory` 一起收口
3. 验证通过后，再进入 `Batch B`

---

# GTM / Commercial Research Follow-Through

更新时间：2026-04-14
状态：Planned
当前切片：`Track H1 - Research Reconciliation and Workback`

## 1. 目标

基于《Helm Workspace 项目 GTM 与商业化方案深度研究报告》，把外部研究结论收口成 current-main 可执行的后续任务，而不是顺手把 Helm 改写成：

- 开源 CLI / local-first 产品
- 通用 Agent builder
- 行业对象平台
- enterprise custom 交付平台
- credits billing / model platform

这条线当前只做 5 件事：

1. 吸收报告里真正与 current-main 对齐的差异化与 GTM 结论
2. 明确哪些报告建议只能作为 discovery / future rail
3. 把接下来 30-90 天的工作收口到 activation / proof / design partner / narrow commercial hypothesis
4. 保持 homepage / dashboard / first-loop / feedback 主线优先级不变
5. 让 GTM / commercial 研究回到可执行任务，而不是停留在战略口号

显式引用：

- [`docs/reviews/HELM_GTM_COMMERCIAL_RESEARCH_FOLLOW_THROUGH_PLAN_V1.md`](docs/reviews/HELM_GTM_COMMERCIAL_RESEARCH_FOLLOW_THROUGH_PLAN_V1.md)
- [`docs/product/HELM_FIRST_LOOP_PRD_V1.md`](docs/product/HELM_FIRST_LOOP_PRD_V1.md)
- [`docs/product/HELM_HOME_SURFACE_RULES_V1.md`](docs/product/HELM_HOME_SURFACE_RULES_V1.md)
- [`docs/brand/HELM_CHINA_MARKET_MESSAGING_V1.md`](docs/brand/HELM_CHINA_MARKET_MESSAGING_V1.md)
- [`docs/brand/HELM_CHINA_GTM_PACKAGE_V1.md`](docs/brand/HELM_CHINA_GTM_PACKAGE_V1.md)

## 2. 当前直接吸收

- `决策 OS + 可审计治理` 继续作为核心差异化
- `Design Partner / PoC / Pilot` 继续作为主要 GTM 结构
- `proof-first` 继续优先于 broad feature / enterprise promise
- `多模型可迁移` 只作为 narrow posture 与 proof 方向
- `行业化` 先做 landing / offer / demo material，不改 product object

## 3. 当前不做

- 开源 pivot / CLI / local-first 主线
- broader industry edition build-out
- enterprise custom implementation
- credits pricing implementation
- broader model platform / cloud orchestration

## 4. 当前任务包

### Track H1 - Activation / First Value

- `H1.1` 登录后首页继续去说教化，进一步压实 `Top 1-3 work items + Needs Your Review + Resume / Continue`
- `H1.2` 压实 `/setup -> dashboard` 的 first-loop handoff
- `H1.3` 补 activation / review / proof 的最小 readout

当前 batch 计划：

- [`docs/reviews/HELM_H1_ACTIVATION_FIRST_VALUE_BATCH_PLAN_V1.md`](docs/reviews/HELM_H1_ACTIVATION_FIRST_VALUE_BATCH_PLAN_V1.md)
  - 把 `H1.1 / H1.2 / H1.3` 压成 `Batch A / B / C` 的可实施计划，只围绕 `home-work-entry / setup-first-loop-handoff / first-loop adoption readout` 这条 current-main 窄链推进，不扩到行业包、定价或 enterprise build-out

### Track H2 - Demo / Proof / Pilot Package

- `H2.1` 刷新 founder / sales / delivery 三条 role-based demo / proof pack
- `H2.2` 产出 `Design Partner Program v1`
- `H2.3` 形成 monthly pilot insight pack

### Track H3 - GTM / Commercial Narrow Discovery

- `H3.1` 做 2-3 个行业化 GTM 包，但只落 landing / one-pager / offer，不改 product object
- `H3.2` 冻结一版 pricing hypothesis pack，不做 pricing implementation
- `H3.3` 做 narrow multi-model portability proof 与 enterprise requirement inventory

## 5. 完成标准

- GTM / commercial 任务不会改写 current-main 产品 truth
- activation / first-value / proof 的优先级不被研究报告打乱
- 对外材料更强，但不 overclaim
- 设计伙伴与 pilot 反馈能稳定回流到产品计划

## 6. 风险

1. 报告如果被原样执行，会把 Helm 拉向开源平台化路线
2. 过早做行业对象，会削弱 horizontal first-loop 主线
3. 过早做 enterprise / credits，会让商业假设伪装成产品真值

## 7. 下一步建议

当前建议先执行：

1. `H1.1` 登录后首页继续去说教化
2. `H1.2` first-loop handoff
3. `H1.3` activation / proof readout
4. `H2.1` role-based demo / proof pack
5. `H2.2` Design Partner Program v1

---

# Engineering Delivery Review

时间：2026-04-12

## 1. 目标

在现有 `/reports` 内增加一块 internal-only 的 engineering delivery review，用当前仓库 git 历史判断：

- contributor 工作内容
- 数量与活跃度
- 质量信号
- 交付充分度
- ownership pressure
- 团队协同与改进建议

## 2. 范围

- `app/(workspace)/reports/page.tsx`
- `features/reports/reports-client.tsx`
- `features/reports/engineering-delivery-review-panel.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `lib/reports/engineering-delivery-review.test.ts`
- `README.md`
- `docs/README.md`
- `docs/reviews/HELM_ENGINEERING_DELIVERY_REVIEW_PLAN_V1.md`
- `docs/product/HELM_ENGINEERING_DELIVERY_REVIEW_BASELINE_V1.md`

## 3. 不做

- live GitHub API / PR review / issue / CI 集成
- 新 schema 或 engineering BI 平台
- 自动绩效打分或自动管理动作
- 多仓库聚合

## 4. 风险

1. runtime 可能无法读取 `.git` 或 `git` 命令
2. heuristic 容易被误读成正式 code review / performance scoring
3. 单看 commit 数会误导，所以必须把 docs / tests / guardrails / overlap 一起读

## 5. 阶段

- Phase 0：定位 reports surface、git 历史形状和现有边界
  - 状态：Completed
- Phase 1：实现 git delivery analysis helper 和 fallback posture
  - 状态：Completed
- Phase 2：接入 `/reports` 页面并补 contributor / collaboration readout
  - 状态：Completed
- Phase 3：补测试与 README / docs / baseline 同步
  - 状态：Completed
- Phase 4：运行验证切片
  - 状态：In Progress

页面级附加验证：

- 首页首屏 5 秒理解检查
- dashboard 首屏 10 秒 judgement 检查
- feedback event 产生 / readout / governance 检查
- analytics support-only boundary 检查
- China GTM copy honesty 检查

# Layered Integration / Judgement Control Plane

更新时间：2026-04-11  
状态：Planned  
当前切片：`Track G7 - Batch A Execution Checklist (Current)`

## 1. 目标

这条线不把 Helm 扩成 CRM、workflow engine、AI builder 或 full auto-execution plane。

它只做 5 件事：

1. 定义 Helm 如何在外部 `source / execution / model assist` 之上继续保留第一方 control plane
2. 明确 Helm 哪些层可以 externalize，哪些层必须继续 first-party
3. 冻结最小 adapter / review / receipt / reconciliation contract
4. 定义一条单闭环 POC，而不是三层并行 POC
5. 把这条线收成 discovery track，不打乱当前 homepage / dashboard / feedback / activation 主线

这条线不是：

- vendor selection sprint
- connector platformization sprint
- workflow engine roadmap
- “三层统一平台” 落地承诺
- auto-send / auto-commit authority expansion

## 2. 产品原则与优先级映射

显式引用：

- [`HELM_PRODUCT_PRINCIPLES_V1.md`](docs/product/HELM_PRODUCT_PRINCIPLES_V1.md)
- [`HELM_PRODUCT_PRIORITY_MAPPING_V1.md`](docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
- [`HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`](docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md)
- [`HELM_V2_FOUNDATION_PRD_V1.md`](docs/product/HELM_V2_FOUNDATION_PRD_V1.md)
- [`HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md`](docs/product/HELM_V2_EVENT_FLOW_API_CONTRACT_V1.md)
- [`HELM_V2_DATA_MODEL_V1.md`](docs/product/HELM_V2_DATA_MODEL_V1.md)
- [`HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`](docs/product/HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md)
- [`HELM_LAYERED_INTEGRATION_CONTROL_PLANE_STRATEGY_REVIEW_V1.md`](docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_STRATEGY_REVIEW_V1.md)

本轮任务接到的真实业务闭环：

- `external source signal -> Helm judgement -> review -> guarded execution -> receipt -> memory write-back`

它服务的是：

- 决策
- 执行
- 审计
- 复盘

为什么应该现在先进入 discovery，而不是直接实施：

- 当前 repo 已经明确 Helm 不是 CRM / workflow / orchestration platform
- 如果不先冻结 control-plane 合同，后续任何厂商接入都容易滑向 point integration 堆叠
- 但当前更高优先级仍然是 homepage / dashboard / feedback / activation 的 PMF 收口
- 因此这条线现在只做 contract 和单闭环 POC 定义，不插队当前主线

## 3. 核心判断

- Helm 不是“把 Three-layer platform 打包成一个壳”
- Helm 是“外部 source / execution / model assist 之上的 judgement control plane”
- `System of record` 与 `execution engine` 可以比 `judgement / memory / governance` 更早 externalize
- `Judgement + Memory + Review + Policy + Reconciliation` 必须继续由 Helm 第一方掌控
- 当前阶段不绑定 `Twenty / Corteza / NocoBase / n8n / Windmill / Dify / Plane` 中的任何一个作为 official path

## 4. 当前阶段范围

- `PLANS.md`
- `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_STRATEGY_REVIEW_V1.md`
- 未来 adapter / connector / approvals / runtime contract 相关计划文档
- `docs/README.md`

当前不直接进入实现范围的面包括：

- 新 connector runtime
- execution engine 接线
- external source sync runtime
- workflow builder UI
- adapter vendor selection implementation

## 5. 不做

- 不把任何具体厂商写成当前主干 source of truth
- 不并行推进数据层、执行层、AI workflow 三层 POC
- 不把 Helm 改写成 all-in-one platform
- 不把 judgement runtime 外包
- 不让外部执行绕过 Helm review
- 不把 adapter 接线写成 canonical object ownership
- 不把 discovery 结果写成复杂度或速度收益已验证

## 6. 风险

1. Helm 退化成外部工具薄壳
2. 外部执行绕过 review boundary
3. source of truth 与 Helm memory 出现双真相
4. adapter 扩面早于 PMF 收口，复杂度先失控
5. 为了“统一平台”叙事而再次滑向 workflow/orchestration 平台

## 7. 阶段计划

### Phase 0

- 冻结策略结论与第一方 control-plane 边界
- 状态：Completed
- 交付物：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_STRATEGY_REVIEW_V1.md`

### Phase 1

- 冻结 `SourceAdapter / ObjectProjection / ActionIntent / ReviewBundle / ExecutionReceipt / ReconciliationResult`
- 明确第一方 ownership 与 adapter seam
- 不做具体厂商绑定
- 当前入口文档：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1.md`
- 状态：Next

### Phase 2

- 只选择一条窄闭环 POC：
  - `meeting/email/CRM signal -> Helm judgement -> human review -> external execution -> receipt -> memory write-back`
- 定义 rollback、manual fallback 与审计要求
- 当前入口文档：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_VENDOR_FIT_AND_SINGLE_LOOP_POC_PLAN_V1.md`
- 状态：Planned

### Phase 3

- 只评估 `1 个 source candidate + 1 个 execution candidate`
- 按 contract fit、tenant isolation、audit、rollback、write boundary 评估
- 不并行开三层 POC
- 当前入口文档：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_CANDIDATE_EVALUATION_MATRIX_V1.md`
- 状态：Planned

### Phase 4

- 冻结 single-loop POC entry gate
- 明确只有 `conditional-go`，不允许直接进入 vendor implementation
- 当前入口文档：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1.md`
- 状态：Planned

### Phase 5

- 冻结 single-loop POC acceptance pack
- 明确唯一第一条 POC、允许改动面、fallback、rollback 与 success distinction
- 当前入口文档：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ACCEPTANCE_PACK_V1.md`
- 状态：Planned

### Phase 6

- 冻结 single-loop POC implementation allowlist、test allowlist 与 stop conditions
- 不进入实现，只定义第一批未来窄实现可以先动什么
- 当前入口文档：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_IMPLEMENTATION_FREEZE_V1.md`
- 状态：Planned

### Phase 7

- 冻结 `Batch A` execution checklist：开工顺序、preflight、targeted tests 与当前 worktree 约束
- 不进入实现，只定义未来若开工时应怎样最小化执行
- 当前入口文档：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_BATCH_A_EXECUTION_CHECKLIST_V1.md`
- 状态：Current

## 8. 可执行任务清单

### Track G - Layered Integration Discovery

- `G1` 冻结 Helm 第一方与 adapter 层的 ownership 边界
- `G2` 定义 `SourceAdapter / ObjectProjection / ActionIntent / ReviewBundle / ExecutionReceipt / ReconciliationResult`
- `G3` 设计 candidate evaluation matrix：contract fit、tenant isolation、audit、rollback、write boundary
- `G4` 冻结 single-loop POC entry gate
- `G5` 冻结 single-loop POC acceptance pack：唯一第一条 POC、fallback、rollback、receipt boundary
- `G6` 冻结 implementation allowlist、test allowlist 与 first-batch stop conditions
- `G7` 冻结 `Batch A` execution checklist：worktree preflight、执行顺序、targeted validation
- 当前 plan：
  - `docs/reviews/HELM_LAYERED_INTEGRATION_CONTROL_PLANE_CONTRACT_FREEZE_PLAN_V1.md`
  - `docs/reviews/HELM_LAYERED_INTEGRATION_VENDOR_FIT_AND_SINGLE_LOOP_POC_PLAN_V1.md`
  - `docs/reviews/HELM_LAYERED_INTEGRATION_CANDIDATE_EVALUATION_MATRIX_V1.md`
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ENTRY_GATE_V1.md`
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_ACCEPTANCE_PACK_V1.md`
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_IMPLEMENTATION_FREEZE_V1.md`
  - `docs/reviews/HELM_LAYERED_INTEGRATION_SINGLE_LOOP_POC_BATCH_A_EXECUTION_CHECKLIST_V1.md`

完成标准：

- 可以清楚回答 Helm 哪些层必须 first-party
- 可以清楚回答 adapter 何时才能进入受控实施
- 仍保持 `recommendation != commitment` 与 `review-before-commitment`
- discovery 结果不会把当前主线拖成 platformization

## 9. 执行顺序

当前默认排位在前 5 个主线 batch 之后：

1. Homepage Messaging Rewrite
2. Dashboard First-Fold Rewrite
3. Feedback Loop Foundation
4. Activation Analytics Readout
5. China GTM / Pilot Feedback Pack
6. Layered Integration Discovery

如果资源允许，它也只能并行为 planning-only / contract-only track，不能阻塞前 5 个 batch。

## 10. 角色分工建议

如果按多代理或多角色执行，默认拆成：

- `探索`：核对 current-main 对 control plane、runtime、connector 的真实边界
- `合同`：起草 adapter / review / receipt / reconciliation contract
- `验证`：检查 overclaim、boundary drift、tenant / audit 风险
- `文档`：同步 review doc、plans、docs index
- `评审`：确认没有滑向 platformization 或 authority expansion

## 11. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

文档级附加验证：

- control-plane wording honesty 检查
- no vendor lock truth 检查
- no review bypass wording 检查
- no platformization overclaim 检查

# Runtime Substrate - Five Primitive Foundation

更新时间：2026-04-12  
状态：In Progress  
当前切片：`Five Primitive Foundation (Thread-level Settlement Review Seam)`

## 1. 目标

这条线不是继续堆 agent 数量，而是把 Helm 当前已经存在的 runtime substrate 收成 5 类可复用运行时原语：

1. `Run Thread`
2. `Operator Debugger`
3. `Typed Interrupt + Handoff Contract`
4. `Project Skill Library + Environment Contract`
5. `Benchmark Matrix`

当前已经完成 `Run Thread` 第一阶段三层、`Operator Debugger B1 / B2`、`Typed Interrupt + Handoff Contract C1 / C2`、`Project Skill Library + Environment Contract D1 / D2`，以及 `Benchmark Matrix` 前四层；`runThread.lifecycleLog` 已经把 `checkpoint lineage / checkpoint resume / handoff.packet.created / continuity remediation` 收成同一份 typed write-lifecycle ledger，meeting runtime surface、`/operating` continuity queue 与 debugger history 开始复用这份 log；active takeover request 与 human input checkpoint request 也已经进入 typed write seam，并通过 `RuntimeEvent` request ledger 回写到 trace、meeting runtime surface 与 `/operating` continuity queue；现在这两条 request 的 acknowledgement 也已经进入同一条 typed ledger，并继续写回 `takeover_request_acknowledged / human_input_request_acknowledged` lifecycle note。benchmark matrix 也已经补上 workspace-scoped persisted run evidence：`benchmark.matrix.run.recorded` 会把 gate outcome 写成 runtime evidence object，并把 `latestOutcome / recordedGateCount / latestRecordedAt` 投影回 meeting runtime surface 与 `/operating`。在这之上，下一层的前二十一刀 `run-thread result acknowledgement + environment execution seam`、`debugger request acknowledgement flow`、`run-thread request posture summary`、`active takeover seam`、`run-thread write lifecycle result flow`、`operator debugger active-control contract`、`environment execution authority`、`benchmark execution / acknowledgement workflow`、`benchmark workflow control-plane follow-through`、`run-thread write lifecycle forward flow`、`operator-active control follow-through closeout`、`thread-level closeout flow summary`、`thread-level lifecycle settlement flow`、`thread-level settlement review seam`、`thread-level closeout confirmation seam`、`thread-level closeout refresh seam`、`thread-level closeout summary seam`、`thread-level closeout resolution seam`、`thread-level closeout resolution follow-through seam`、`thread-level closeout outcome seam` 与 `thread-level close request seam` 都已落地：`human execution / guarded official write / limited auto / official follow-through` 的最新结果会被统一收成 `runThread.resultAcknowledgement`，并额外写回 `result_acknowledged` lifecycle note；同一条 thread 上这些 downstream result 的最新 posture、attention/resolved 计数与 source-level latest result 现在也会被统一收成 `runThread.resultFlow` 并投影回 meeting runtime surface、`/operating` 与 debugger snapshot；takeover / human input request 的 `requested -> acknowledged` 当前 posture 也会被统一收成 `runThread.requestPosture`，并把 `takeover_requested / human_input_requested / takeover_request_acknowledged / human_input_request_acknowledged` 一起投影回 meeting runtime surface、`/operating` 与 trace；同时 `operator.takeover.started / operator.takeover.released` 现在也会进入 typed active-control seam，并把 `takeover_active / takeover_released` 写回同一份 lifecycle log，`takeoverActivation` 还会显式投影 `currentOwner / latestEventKind / releasedAt / releasedBy / releaseReason` 到 debugger 与 queue surface。release 之后，新的 `operator.takeover.followthrough.requested / resolved` 还会继续把 bounded active-control closeout 收成 typed lifecycle seam，并把 `takeoverFollowThrough` 与 `runThread.forwardFlow.state=lifecycle_closeout` 一起投影回 trace、meeting runtime surface、`/operating` 与 debugger snapshot；现在 operator closeout 和 downstream result follow-through 还会进一步统一收成 canonical `runThread.closeoutFlow`，并在此之上继续收成 `runThread.settlementFlow`，显式给出 `active / closeout_open / review_open / ready_to_close / closed` 的 thread-level settlement truth、driver、owner、checkpointKey 与 nextAction。新的 `runThread.settlementReview` 则继续把 `run-thread.settlement.review.requested / resolved` 收成 explicit operator review seam，并投影回 meeting runtime surface、`/operating`、trace 与 debugger snapshot；新的 `runThread.closeoutConfirmation` 则继续把 `run-thread.closeout.confirmed` 收成 `confirmable / confirmed / stale` 的 persisted control-plane closeout truth，并显式投影回 trace、meeting runtime surface、`/operating` 与 debugger snapshot；新的 `runThread.closeoutRefresh` 则继续把 `run-thread.closeout.refresh.requested` 收成 `requestable / open / resolved` 的 stale-closeout reopen follow-through，并显式投影回 trace、meeting runtime surface、`/operating` 与 debugger snapshot；新的 `runThread.closeoutSummary` 则继续把 `closeoutFlow / settlementReview / closeoutConfirmation / closeoutRefresh` 统一收成 `active / review_requestable / review_open / confirmable / confirmed / refresh_requestable / refresh_open / closed` 的 canonical closeout posture，并显式投影回 trace、meeting runtime surface、`/operating` 与 debugger snapshot；新的 `runThread.closeoutResolution` 则继续把 `run-thread.closeout.resolution.recorded` 收成 `not_available / decision_required / close_recorded / keep_open_recorded / stale` 的 explicit close-versus-keep-open truth，而新的 `runThread.closeoutResolutionFollowThrough` 则继续把 `run-thread.closeout.resolution.followthrough.requested / resolved` 收成 `not_available / requestable / open / resolved / stale` 的 explicit resolution follow-through seam，两者都会继续显式投影回 trace、meeting runtime surface、`/operating` 与 debugger snapshot；新的 `runThread.closeoutOutcome` 则继续把 `closeoutResolution / closeoutResolutionFollowThrough / lifecycle(closedAt)` 统一收成 `not_available / decision_required / followthrough_required / followthrough_open / close_pending / kept_open / closed / mismatch / stale` 的 thread-level final outcome truth，并继续显式投影回 trace、meeting runtime surface、`/operating` 与 debugger snapshot，而新的 `runThread.closeRequest` 则继续把 `run-thread.close.requested` 收成 `not_available / requestable / open / resolved / stale / mismatch` 的 explicit bounded runtime close seam。`environmentContract.executionSeam` 则把最新 execution posture 与计数投影回 meeting runtime surface 和 `/operating`，而新的 `environmentContract.executionAuthority` 会进一步把 `manual_only / review_gated / narrow_limited_auto / boundary_only` 的 authority truth 按 source 明确投影回 surfaces。与此同时，benchmark matrix 现在也已经把 `benchmark.matrix.run.requested / recorded / acknowledged / followthrough.requested / followthrough.resolved` 收成 typed workflow，并把 `benchmarkMatrix.workflow.request / latestRun / acknowledgement / followThrough` 与 `workflow.state / pendingRequestCount / latestAcknowledgedAt / latestFollowThroughAt` 一起投影回 meeting runtime surface、`/operating` 与 self-check discoverability。`official action` 仍保持 review-gated，benchmark matrix 仍只是验证门槛，不是新的 execution plane。下一步继续推进 explicit thread closeout decision 之后的 lifecycle close / not-close resolution 收口，而不是做 workflow engine 或 authority 扩面。

## 2. 产品原则与优先级映射

显式引用：

- [`HELM_PRODUCT_PRINCIPLES_V1.md`](docs/product/HELM_PRODUCT_PRINCIPLES_V1.md)
- [`HELM_PRODUCT_PRIORITY_MAPPING_V1.md`](docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
- [`HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1.md`](docs/product/HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1.md)

本轮任务接到的真实业务闭环：

- `meeting.ended -> human review -> runtime trace`
- `verified coordination -> human execution / official follow-through`
- `continuity failure -> operator remediation`

它服务的是：

- 执行
- 审计
- 复盘

为什么应该现在做，而不是继续功能扩面：

- 现有 `RuntimeSession / SessionCheckpoint / trace / resume` 已存在，但还没有完整的 persisted lifecycle control plane
- 不先收口 `run / thread / checkpoint / resume`，后续 debugger / handoff / benchmark 会继续建立在分散字段和页面文案上
- 这条线增加的是证据链、恢复能力和可复用 contract，不是新功能外观

## 3. 当前阶段范围

- `docs/product/HELM_AGENT_RUNTIME_SUBSTRATE_PLAN_V1.md`
- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/run-thread-contract.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `app/api/helm-v2/runtime/checkpoints/[id]/resume/route.ts`
- `app/api/helm-v2/runtime/sessions/[id]/trace/route.ts`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `PLANS.md`

## 4. 不做

- 新 persisted thread schema
- workflow engine
- multi-agent orchestration platform
- debugger UI 扩面
- auto-send / broad auto-write / execution-authority expansion
- sandbox / marketplace / external execution platform 化

## 5. 风险

1. 如果把第一层做成 schema migration，会扩大 blast radius
2. 如果只写计划不接 route 返回，后续链路仍会继续漂
3. 如果把 `resumeToken` 误写成 secret-like token，会误导边界
4. 如果把 Run Thread 和 Operator Debugger 混在一个 PR，验证面会失控

## 6. 阶段计划

### Phase 0

- 复核现有 `RuntimeSession / SessionCheckpoint / trace / resume / handoff / initiative` substrate
- 写系统级 plan，冻结第一阶段词汇与 PR 顺序
- 状态：Completed

### Phase 1

- 新增 canonical run-thread contract
- 冻结 `runId / threadId / checkpointId / resumeToken` 语义
- 把 `runThread` 接进 trace / resume 两条现有运行链
- 同步 README / docs index / self-check / tests
- 状态：Completed

### Phase 2

- 把 workspace continuity / operator read model 也接进 canonical run-thread identity
- 为 debugger 的 `history / snapshot / replay` 留出稳定 seam
- 状态：Completed

### Phase 3

- `Operator Debugger B1`：run history / trace spine / variable snapshot / read-only debugger API
- 状态：Completed

### Phase 4

- 继续推进 `Operator Debugger`
- 状态：Completed

### Phase 5

- `Typed Interrupt + Handoff Contract C1`
- 状态：Completed

### Phase 6

- `Typed Interrupt + Handoff Contract C2`
- 状态：Completed

### Phase 7

- 继续推进 `Project Skill Library + Environment Contract`
- 状态：Completed

### Phase 8

- 继续推进 `Benchmark Matrix`
- 状态：Completed

### Phase 9

- `Operator Debugger Phase 2`：统一 `trace / write / recovery action / lifecycle / transition / state machine / execution / guard` debugger contract，并修复 continuity recovery / founder demo 回归
- 状态：Frozen

## 7. PR 顺序

1. `Run Thread Layer 1`
2. `Run Thread Layer 2`
3. `Run Thread Layer 3`
4. `Operator Debugger Layer 1`
5. `Operator Debugger Layer 2`
6. `Typed Interrupt + Handoff Contract`
7. `Project Skill Library + Environment Contract`
8. `Benchmark Matrix`
9. `Operator Debugger Phase 2`

## 8. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

第一阶段附加验证：

- run-thread contract unit tests
- trace / resume 返回 `runThread`
- plan / docs / README / self-check discoverability 对齐

# PR114 - Skill Formal Review Decision Workflow

更新时间：2026-04-09
状态：Implemented
范围：PR114 只把 `manual formal review queue` 往前推进到 `approve / defer / reject / return-hardening` 的 decision workflow，并补 reviewer note、formal review checklist、recent formal review decisions surface 与 governance write path；不做 formal promotion helper、formal skill auto-promotion、static skill catalog auto-write、routing / worker binding 扩权、auto-send、auto commitment 或 high-risk official write authority expansion

## 1. 目标

PR114 只做六件事：

1. 为 `SkillSuggestion` 新增 formal review decision / checklist 持久化
2. 新增 approve / defer / reject service、settings action 与 API route
3. 让 reject / return 进入 calibration 的 boundary incident 计数
4. 在 settings policies 增加 queued review checklist 与 `Recent formal review decisions`
5. 在 dashboard evolution 增加 recent formal review decision preview
6. 同步 README / docs / guards / tests，并跑完整验证链

它不是：

- formal promotion helper
- formal skill auto-promotion
- static skill catalog auto-write
- worker binding expansion
- routing expansion
- auto-send
- auto commitment
- high-risk official write authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_SKILL_SUGGESTION_BASELINE_V1.md`
- `HELM_SKILL_FORMAL_REVIEW_QUEUE_BASELINE_V1.md`
- `HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`
- `HELM_MULTITENANCY_INSIGHT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- `PatternFact -> SkillSuggestion -> 人工 accept -> candidate capability` 主链已成立
- `candidate_skill -> probationary_skill` calibration-driven promotion 已成立
- manual formal review queue 已成立
- queue / hardening write path 已受 workspace policy governance 保护

当前本轮已补齐：

- `APPROVED_PENDING_PROMOTION / DEFERRED / REJECTED` 已进入真实运行时
- reviewer、decision note、decision time 与 formal review checklist 已持久化
- settings / dashboard 已前置 recent formal review decisions
- approve / defer / reject write path 已受 governance 与 ownership 保护

当前仍未成立：

- formal promotion helper
- formal skill auto-promotion
- static skill catalog automatic update
- send / commitment / official write authority expansion

# PR113 - Skill Formal Review Queue And Calibration

更新时间：2026-04-09
状态：Implemented
范围：PR113 只把 `candidate_skill -> probationary_skill` 的晋级信号改成 calibration-driven，并补一条 manual formal review queue；不做 formal skill auto-promotion、static skill catalog auto-write、routing / worker binding 扩权、auto-send、auto commitment 或 high-risk official write authority expansion

## 1. 目标

PR113 只做六件事：

1. 把候选能力晋级逻辑收成 calibration-driven signal
2. 为 `READY / QUEUED / HARDENING_REQUIRED` 补 formal review status
3. 新增 formal review queue / return-hardening API 与 settings action
4. 在 settings policies 与 dashboard evolution 增加 formal review queue surface
5. 同步 README / docs / guards / tests
6. 跑完整验证链

它不是：

- formal skill auto-promotion
- static skill catalog auto-write
- worker binding expansion
- routing expansion
- auto-send
- auto commitment
- high-risk official write authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_SKILL_SUGGESTION_BASELINE_V1.md`
- `HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`
- `HELM_MULTITENANCY_INSIGHT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前本轮已补齐：

- candidate/probationary 晋级开始读取 calibration signal
- formal review queue 已成立
- queue / hardening write path 已受 workspace policy governance 保护
- settings / dashboard 已前置 formal review queue readout

当前仍未成立：

- formal skill auto-promotion
- queue item automatic execution authority
- static skill catalog automatic update
- send / commitment / official write authority expansion

# PR112 - Skill Suggestion Capability Loop

更新时间：2026-04-09
状态：Implemented
范围：PR112 只把 `PatternFact -> SkillSuggestion -> 人工 accept -> candidate capability` 的最小主链真正接进 repo，并补 `candidate -> probationary -> formal` 的晋级边界表达；不做 runtime-generated formal skill、auto routing、auto-send、auto commitment 或 execution-authority expansion

## 1. 目标

PR112 只做六件事：

1. 新增 `SkillSuggestion` schema、migration 与 service
2. 在 evolution refresh 中同步生成候选能力建议
3. 新增 accept / dismiss API 与 settings action
4. 把 accept 收口到 capability catalog 的 `candidate_skill`
5. 为 `candidate_skill -> probationary_skill -> formal review ready` 补边界表达
6. 同步 README / docs / guards / tests，并跑完整验证链

它不是：

- runtime-generated formal skill
- static skill catalog auto-write
- worker binding expansion
- routing expansion
- auto-send
- auto commitment
- high-risk official write authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`
- `HELM_MULTITENANCY_INSIGHT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`

当前已经成立：

- `PatternFact` 和 `StrategySuggestion` 已存在
- capability catalog 已存在
- settings / dashboard 已有 evolution surface
- policy-governed tenant seam 已存在

当前本轮已补齐：

- `SkillSuggestion` 已成立
- accept 只会落到 `candidate_skill`
- evidence 更强时会提升到 `probationary_skill`
- `formal review ready` 已可见，但仍需人工晋级 formal skill

当前仍未成立：

- runtime-generated formal skill
- automatic routing / worker binding
- send / commitment / official write authority expansion

# PR111 - Business-loop Gap Readout Guard

更新时间：2026-04-08
状态：Implemented
范围：PR111 只把 `buildBusinessLoopGapReadout()` 的 helper-usage guard 收紧到 test / self-check / boundary 三层，防止共享页面重新回到 page-local gap 映射；不做页面行为改动、schema migration、canonical persisted object、KPI canonicalization、broader operator redesign 或 execution-authority expansion

## 1. 目标

PR111 只做四件事：

1. 建一份更硬的 helper-usage guard
2. 明确哪些 shared readout surfaces 必须走 `buildBusinessLoopGapReadout()`
3. 把这份 guard 接到 regression test、`self-check`、`check:boundaries`
4. 同步 baseline / plan / report / README / docs / guards，并跑完整验证链

它不是：

- 页面行为重构
- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_CUSTOMER_SUCCESS_QUEUE_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_READOUT_HELPER_BASELINE_V1.md`

当前已经成立：

- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities / customer-success queue` 已共享同一份 helper-based gap readout
- 上述页面首屏仍保持 `对象状态 / 阻塞 / 待决策 / 下一步动作`

当前本轮已补齐：

- helper usage 现在有专门 guard
- `test / self-check / boundary` 都会阻止这些页面回到 `businessLoopGapSummary.primaryGap` 的 page-local 读取

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- `primaryGap` 的线上校准优先级

# PR110 - Business-loop Gap Readout Helper

更新时间：2026-04-08
状态：Implemented
范围：PR110 只把 business-loop gap 的 page-local 首屏映射收口成一个更薄的 page-level helper，并迁移现有 readout 页面；不做 schema migration、canonical persisted object、KPI canonicalization、broader operator redesign 或 execution-authority expansion

## 1. 目标

PR110 只做四件事：

1. 新增 `buildBusinessLoopGapReadout()` helper
2. 让 `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities / customer-success queue` 复用这份 helper
3. 保持首屏只展示 `对象状态 / 阻塞 / 待决策 / 下一步动作`
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_CUSTOMER_SUCCESS_QUEUE_BASELINE_V1.md`

当前已经成立：

- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities / customer-success queue` 已共享同一份 `businessLoopGapSummary`
- 这些页面都已保持 business-first 首屏 contract

当前本轮已补齐：

- `buildBusinessLoopGapReadout()` 已成立
- 上述页面的 `blocker / pendingDecision / nextAction / Loop gap connection` 已复用同一份 helper

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- `primaryGap` 的线上校准优先级

# PR109 - Business-loop Gap Customer-success Queue

更新时间：2026-04-08
状态：Implemented
范围：PR109 只把共享 `businessLoopGapSummary` 扩到 `customer-success queue` 的 operator-governance readout，补齐当前剩余的 customer-success queue 首屏缺口读取口径；不做 schema migration、canonical persisted object、broader operator redesign、customer-success detail refactor 或 execution-authority expansion

## 1. 目标

PR109 只做四件事：

1. 让 `customer-success queue` 消费共享 `businessLoopGapSummary`
2. 保持首屏只展示 `对象状态 / 阻塞 / 待决策 / 下一步动作`
3. 明确 `customer-success detail` 不在本轮范围
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- customer-success detail refactor
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_BASELINE_V1.md`

当前已经成立：

- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities` 已共享同一份 `businessLoopGapSummary`
- `customer-success queue` 已经有 business-first 首屏 contract

当前本轮已补齐：

- `customer-success queue` 已消费共享 `businessLoopGapSummary.primaryGap`
- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities / customer-success queue` 已共享同一份主业务闭环 gap readout contract

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- `customer-success detail` 共享 gap readout

# PR108 - Business-loop Gap Opportunity Surface

更新时间：2026-04-08
状态：Implemented
范围：PR108 只把共享 `businessLoopGapSummary` 扩到 `opportunities` 的 operator-governance readout，补齐当前这条 business-first 首屏链路上的最后一个 `BusinessFirstSurfaceSummary` 页面；不做 schema migration、canonical persisted object、broader operator redesign、customer-success queue refactor 或 execution-authority expansion

## 1. 目标

PR108 只做四件事：

1. 让 `opportunities` 消费共享 `businessLoopGapSummary`
2. 保持首屏只展示 `对象状态 / 阻塞 / 待决策 / 下一步动作`
3. 明确 `customer-success queue` 不在本轮范围
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- customer-success queue refactor
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_OPERATOR_SURFACE_EXPANSION_BASELINE_V1.md`

当前已经成立：

- `dashboard / reports / operating / inbox / diagnostics / approvals / imports` 已共享同一份 `businessLoopGapSummary`
- `opportunities` 已经有 business-first 首屏 contract

当前本轮已补齐：

- `opportunities` 已消费共享 `businessLoopGapSummary.primaryGap`
- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities` 已共享同一份主业务闭环 gap readout contract

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- `customer-success queue` 共享 gap readout

# PR107 - Business-loop Gap Operator Surface Expansion

更新时间：2026-04-08
状态：Implemented
范围：PR107 只把共享 `businessLoopGapSummary` 扩到 `approvals` 与 `imports` 的 operator-governance readout，统一更多 operator-heavy surface 对主业务闭环缺口的读取口径；不做 schema migration、canonical persisted object、broader operator redesign、analytics refactor 或 execution-authority expansion

## 1. 目标

PR107 只做四件事：

1. 让 `approvals` 消费共享 `businessLoopGapSummary`
2. 让 `imports` 消费共享 `businessLoopGapSummary`
3. 保持首屏只展示 `对象状态 / 阻塞 / 待决策 / 下一步动作`
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- analytics refactor
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_SURFACE_EXPANSION_BASELINE_V1.md`

当前已经成立：

- `dashboard / reports / operating / inbox / diagnostics` 已共享同一份 `businessLoopGapSummary`
- `approvals` 与 `imports` 都已有 business-first 首屏 contract

当前本轮已补齐：

- `approvals` 已消费共享 `businessLoopGapSummary.primaryGap`
- `imports` 已消费共享 `businessLoopGapSummary.primaryGap`
- `dashboard / reports / operating / inbox / diagnostics / approvals / imports` 已共享同一份主业务闭环 gap readout contract

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- broader operator surface registry
- analytics refactor

# PR106 - Business-loop Gap Surface Expansion

更新时间：2026-04-08
状态：Implemented
范围：PR106 只把共享 `businessLoopGapSummary` 扩到 `inbox` 与 `diagnostics` 的 operator-governance readout，统一更多 operator-heavy surface 对主业务闭环缺口的读取口径；不做 schema migration、canonical persisted object、broader operator redesign、analytics refactor 或 execution-authority expansion

## 1. 目标

PR106 只做四件事：

1. 让 `inbox` 消费共享 `businessLoopGapSummary`
2. 让 `diagnostics` 消费共享 `businessLoopGapSummary`
3. 保持首屏只展示 `对象状态 / 阻塞 / 待决策 / 下一步动作`
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- broader operator redesign
- dashboard analytics refactor
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_READOUT_BASELINE_V1.md`

当前已经成立：

- `dashboard / reports / operating` 已共享同一份 `businessLoopGapSummary`
- `inbox` 与 `diagnostics` 都已有 business-first 首屏 contract

当前本轮已补齐：

- `inbox` 已消费共享 `businessLoopGapSummary.primaryGap`
- `diagnostics` 已消费共享 `businessLoopGapSummary.primaryGap`
- `dashboard / reports / inbox / diagnostics / operating` 已共享同一份主业务闭环 gap readout contract

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- broader operator surface registry
- analytics refactor

# PR105 - Business-loop Gap Readout

更新时间：2026-04-08
状态：Implemented
范围：PR105 只把共享 `businessLoopGapSummary` 接到 `dashboard` 与 `reports` 的 operator-governance readout，统一这些页面对主业务闭环缺口的读取口径；不做 schema migration、canonical persisted object、dashboard analytics 改造、ontology platform 或 execution-authority expansion

## 1. 目标

PR105 只做四件事：

1. 建一个窄的 `getWorkspaceBusinessLoopGapReadout` 查询入口
2. 让 `dashboard` 与 `reports` 复用同一份 `businessLoopGapSummary`
3. 保持首屏只展示 `对象状态 / 阻塞 / 待决策 / 下一步动作`
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- dashboard analytics 扩面
- ontology platform
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_GAP_AGGREGATION_BASELINE_V1.md`

当前已经成立：

- `businessLoopGapSummary` 已作为共享 runtime summary 成立
- `/operating` 与 runtime operator panel 已复用同一份 summary
- `dashboard` 与 `reports` 都已有 business-first 首屏 contract

当前本轮已补齐：

- `getWorkspaceBusinessLoopGapReadout` 已作为窄查询入口成立
- `dashboard` 已消费共享 `businessLoopGapSummary.primaryGap`
- `reports` 已消费共享 `businessLoopGapSummary.primaryGap`
- 页面不再需要为主业务闭环 gap 手写独立筛选逻辑

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- 更广的 dashboard analytics refactor
- broader business-loop gap registry

# PR104 - Business-loop Gap Aggregation

更新时间：2026-04-08
状态：Implemented
范围：PR104 只把 business-loop gap 收成共享 `businessLoopGapSummary` runtime contract，并让 `/operating` 与 runtime operator panel 复用同一份 summary；不做 schema migration、canonical persisted object、dashboard query 扩面、ontology platform 或 execution-authority expansion

## 1. 目标

PR104 只做四件事：

1. 冻结 `businessLoopGapSummary` contract
2. 固定 business-loop gap kinds 和 primary gap priority
3. 把共享 summary 接到 `buildWorkspaceRuntimeOperatorOverview`、`/operating` 和 runtime operator panel
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- dashboard query 扩面
- ontology platform
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`
- `HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_BASELINE_V1.md`

当前已经成立：

- `OperatingGap` 已作为 `operator-governance projection` 成立
- `PR103` 已把 `missing-kpi-link` 前置到 `/operating`
- runtime operator overview 已是当前共享 operator truth 入口

当前本轮已补齐：

- `businessLoopGapSummary` 已作为共享 runtime summary 成立
- business-loop gap kinds 已固定在五类边界内
- `/operating` 与 runtime operator panel 已复用同一份 summary

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- dashboard 级 business-loop summary
- broader business-loop gap registry

# PR103 - Business-loop Operating Gap Wiring

更新时间：2026-04-08
状态：Implemented
范围：PR103 只把 `missing-kpi-link` 作为 business-loop 级 `OperatingGap` projection 接到 `/operating` 首屏与 runtime operator overview；只复用现有 `CoordinationMetricsDaily` truth，不做 schema migration、canonical persisted object、dashboard query 扩面、ontology platform 或 execution-authority expansion

## 1. 目标

PR103 只做四件事：

1. 把 `missing-kpi-link` 收成 `OperatingGap` 的 business-loop gap kind
2. 只用现有 `CoordinationMetricsDaily` 建立缺口投影，不新建 KPI schema
3. 把这条 gap 接到 `buildWorkspaceRuntimeOperatorOverview` 和 `/operating` 的 business-first 首屏
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted `OperatingGap`
- KPI canonicalization
- dashboard query 扩面
- ontology platform
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`
- `HELM_OPERATING_GAP_OBJECT_BASELINE_V1.md`

当前已经成立：

- `OperatingGap` 已作为 `operator-governance projection` 成立
- `RuntimeOperatorPanel` 已有统一 gap queue
- `CoordinationMetricsDaily` 已存在当前 workspace 的最小 metrics snapshot truth
- `/operating` 已有 business-first 四类首屏 contract

当前本轮已补齐：

- `missing-kpi-link` 已作为 business-loop gap kind 成立
- `coordination metrics missing / stale` 已能投影成 `OperatingGap`
- `/operating` 首屏会优先把 business-loop gap 前置到 `阻塞 / 待决策 / 下一步动作`

当前仍未成立：

- canonical persisted `OperatingGap`
- canonical KPI object
- dashboard 级 KPI loop gap summary
- broader business-loop gap registry

# PR102 - OperatingGap Object

更新时间：2026-04-08
状态：Implemented
范围：PR102 只把 `TruthConflict / ProblemSpace / CompositionFailure` 收成 `operator-governance projection` 的 `OperatingGap` object，并接到 `RuntimeOperatorPanel`；不做 schema migration、canonical persisted object、new runtime orchestration plane 或 execution-authority expansion

## 1. 目标

PR102 只做四件事：

1. 冻结 `OperatingGap` contract
2. 把缺口来源限制在 `TruthConflict / ProblemSpace / CompositionFailure`
3. 建统一 gap projection queue，并接到 `RuntimeOperatorPanel`
4. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical persisted object
- new runtime orchestration plane
- ontology platform
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `HELM_NARROW_TRUTH_RECONCILIATION_ENGINE_BASELINE_V1.md`

当前已经成立：

- `OperatingGap` 已被 PR100 冻结为认知对象 contract
- `TruthConflict / ProblemSpace / CompositionFailure` 已分别存在于 runtime/operator truth 中
- `PR101` 已冻结 `resolved / unresolved / confidence / evidence chain / operator review required`

当前本轮要补齐：

- `OperatingGap` 的 first-class projection contract
- runtime operator surface 的统一 gap queue
- 文档与 guard discoverability

当前仍未成立：

- canonical persisted `OperatingGap`
- `missing KPI link` established truth
- broader operator-wide gap registry

# PR101 - Narrow Truth Reconciliation Engine

更新时间：2026-04-08
状态：Implemented
范围：PR101 只在 `meeting / email / CRM / report` 四类输入之间建立一条窄的 truth reconciliation engine，固定 `resolved / unresolved / confidence / evidence chain / operator review required` 输出；不做 schema migration、ontology platform、operator UI、connector platformization 或 execution-authority expansion

## 1. 目标

PR101 只做五件事：

1. 冻结 `meeting / email / CRM / report` 四类 signal source
2. 冻结 workspace-scoped subject contract
3. 建立窄的分数和收敛规则
4. 固定 `resolved / unresolved / confidence / evidence chain / operator review required` 输出
5. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- schema migration
- canonical `Belief / Goal / OperatingGap` 新表
- ontology platform
- runtime orchestration
- operator UI 扩面
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`

当前已经成立：

- `Source / Ingestion -> Belief / Runtime -> Operator / Governance -> Execution / Commitment`
- `Commitment / ApprovalRequest / ActionItem` 已作为 `Committed Intention` 成立
- `MemoryFact / TruthConflict / WorldModelSnapshot / ProblemSpace` 已形成事实与缺口的原型对象

当前本轮已补齐：

- 窄的 truth reconciliation engine
- 四类输入 source contract
- workspace-scoped subject contract
- fixed output contract
- 文档 / guard / tests / discoverability

当前仍未成立：

- canonical `Belief` object
- canonical `OperatingGap` object
- reconciliation result 的 runtime write-back
- operator reconciliation surface

# PR100 - Cognitive Object And Four-plane Contract

更新时间：2026-04-08
状态：Implemented
范围：PR100 只冻结 Helm 当前阶段的四层控制面和四类认知对象 contract，补最小 TS contract、索引、guard 与测试；不做 ontology platform、schema migration、truth reconciliation runtime、connector platformization 或 execution-authority expansion

## 1. 目标

PR100 只做五件事：

1. 冻结 `Source / Ingestion -> Belief / Runtime -> Operator / Governance -> Execution / Commitment`
2. 冻结 `Belief / Goal / Committed Intention / OperatingGap`
3. 建最小 TS contract 与测试，避免后续页面和 runtime 重新漂移
4. 同步 baseline / plan / report / README / docs / guards
5. 跑完整验证链

它不是：

- ontology platform
- schema migration
- truth reconciliation runtime
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_PRODUCT_PRINCIPLES_V1.md`
- `HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `HELM_DINGTALK_MEETINGS_RUNTIME_INGESTION_BASELINE_V1.md`
- `HELM_WECOM_CALENDAR_REGISTRY_SEAM_EXECUTION_RECEIPT_V1.md`

当前已经成立：

- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord` 这条 runtime chain
- `Commitment / ApprovalRequest / ActionItem` 这条已承诺动作链
- `MemoryFact / TruthConflict / WorldModelSnapshot` 这条事实与冲突链

当前本轮已补齐：

- 四层控制面 contract
- 四类认知对象 contract
- 最小 TS contract 与测试
- 文档与 guard discoverability

当前仍未成立：

- canonical `Belief` object
- canonical `Goal` object
- canonical `OperatingGap` object
- narrow truth reconciliation engine
- ontology platform

# PR93 - Business-first Operator Surface Expansion

更新时间：2026-04-08
状态：Implemented
范围：PR93 只把同一条 business-first contract 扩到更多 operator-heavy surface，并把“首屏只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作`”抽成共享组件；本轮覆盖 `internal operating`、`opportunities`、`approvals`、`imports`，同时把 PR92 已覆盖的 `inbox / reports / diagnostics` 迁移到统一 shared summary，不把这轮写成新一轮全站 redesign，也不扩 execution authority

## 1. 目标

PR93 只做五件事：

1. 把 `internal operating`、`opportunities`、`approvals`、`imports` 的首屏继续收成 business-first 四类信息
2. 把 `inbox / reports / diagnostics` 从页面内联 summary 迁到共享组件，减少页面分叉
3. 建立共享 `BusinessFirstSurfaceSummary`，把四类首屏 contract 从 label helper 收成可复用组件
4. 增强 hierarchy guard 与 e2e，防止 explanation、briefing、guidance 重新压回首屏
5. 同步 baseline / plan / report / README / docs / guards / tests，并跑完整验证链

它不是：

- 新一轮全站 redesign
- workflow automation plane
- execution-authority expansion
- 新 query model / 新数据层
- server-side preference sync

## 2. 当前 freeze truth

当前基线继承：

- `HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md`
- `HELM_BUSINESS_FIRST_SURFACE_CONTRACT_HARDENING_BASELINE_V1.md`
- `HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md`

当前已经成立：

- `dashboard`、`customer success queue` 已进入第一轮 business-first 首屏
- PR92 已把 `inbox / reports / diagnostics` 收到统一四类信息
- business-first label contract 已成立

当前本轮已补齐：

- `BusinessFirstSurfaceSummary` shared component
- `internal operating` 第一屏统一到共享四类 summary
- `opportunities` 第一屏统一到共享四类 summary
- `approvals` 第一屏统一到共享四类 summary
- `imports` 第一屏统一到共享四类 summary
- `inbox / reports / diagnostics` 迁到 shared component，减少页面分叉
- hierarchy / e2e guard 直接约束 summary 先于 guidance 出现

当前仍未成立：

- 全站统一的首屏预算系统
- server-side preference sync
- workflow automation UI
- execution-authority expansion

# PR92 - Business-first Surface Contract Hardening

更新时间：2026-04-08
状态：In Progress
范围：PR92 只继续收紧 `customer success queue`、`inbox`、`reports`、`diagnostics` 四张高频经营页面的第一屏，并建立更硬的 business-first surface contract；统一首屏只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作` 四类信息，不把这轮写成新一轮全站 redesign，也不扩 execution authority

## 1. 目标

PR92 只做五件事：

1. 把 `customer success queue`、`inbox`、`reports`、`diagnostics` 的第一屏继续从解释优先收成经营动作优先
2. 建一个共享的 business-first summary label contract，统一四类首屏信息
3. 建更硬的 hierarchy guard，防止 guidance、briefing、boundary explanation 重新压回首屏
4. 同步 baseline / plan / report / README / docs / guards / tests
5. 跑完整验证链

它不是：

- 新一轮全站 redesign
- workflow automation plane
- execution-authority expansion
- server-side preference sync
- 新 operating model / 新数据层

## 2. 当前 freeze truth

当前基线继承：

- `HELM_BUSINESS_FIRST_SURFACE_REDUCTION_BASELINE_V1.md`
- `HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_BASELINE_V1.md`

当前已经成立：

- `dashboard`、`internal operating`、`customer success queue`、`opportunities` 的第一轮 business-first 首屏减法
- shared guidance / preference / form-assist substrate
- judgement-first / decision-first 页面层级

当前本轮要补齐：

- `customer success queue` 的首屏四类信息统一
- `inbox` 的 business-first summary 前置与 header briefing 下线
- `reports` 的 business-first summary 前置与首屏解释收窄
- `diagnostics` 的 business-first summary 前置
- 更硬的 business-first surface contract test / guard

当前仍未成立：

- 全站统一的首屏预算系统
- server-side preference sync
- workflow automation UI
- execution-authority expansion

# PR91 - Business-first Surface Reduction

更新时间：2026-04-08
状态：Implemented
范围：PR91 只收紧 `dashboard`、`internal operating`、`customer success queue`、`opportunities` 四张高频经营页面的第一屏，把经营动作、阻塞、拍板点和边界前置；不把这轮写成新一轮全站 redesign，也不扩 execution authority

## 1. 目标

PR91 只做五件事：

1. 把四张关键经营页面的第一屏从解释优先改成动作优先
2. 把最重要动作 / 阻塞 / 拍板点 / 边界放到第一屏
3. 把 guidance / preferences / why-it-matters / 次级摘要下移
4. 保持现有模型层、权限边界和经营对象体系不变
5. 补 baseline / plan / report / guards / tests / 完整验证链

它不是：

- 新一轮全站 redesign
- workflow automation plane
- execution-authority expansion
- server-side preference sync
- 新的数据层或新 operating model

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DESIGN_SITEWIDE_REDESIGN_CLOSEOUT_BASELINE_V1.md`
- `HELM_DESIGN_SUBSTRATE_HARDENING_AND_POLISH_BASELINE_V1.md`
- `HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md`

当前已经成立：

- shared design substrate
- shared guidance / preference / form-assist contract
- feature-owned redesign closeout

当前本轮已补齐：

- `dashboard` 的 business-first 首屏
- `internal operating` 的 business-first 首屏
- `customer success queue` 的 business-first 首屏
- `opportunities` 的对象焦点与主工作区前置
- business-first docs / guards / hierarchy check

当前仍未成立：

- 全站统一的首屏预算 contract
- server-side preference sync
- workflow automation UI
- execution-authority expansion

# PR90 - WeCom Calendar Registry Seam

更新时间：2026-04-07
状态：In Progress
范围：PR90 只做 workspace-scoped WeCom calendar registry seam，把 `cal_id` registry、validation truth、settings/operator readout 与最小治理边界收紧到位；在 registry 没成立前，不把 `calendar` runtime 写成已成立；`message notifications` 继续保持 unresolved

## 1. 目标

PR90 只做五件事：

1. 建立 workspace-scoped WeCom calendar registry seam
2. 校验并持久化 `cal_id`
3. 在 settings/operator surface 中把 registry readiness、bound calendar count、last validation result 与 next required action 收成第一屏
4. 把 `calendar` 的表达从 `verified-but-unbound` 收紧为 `registry established but runtime pending` 或 `registry pending`
5. 补 baseline / plan / report / guards / tests / 完整验证链

它不是：

- native WeCom SCIM
- WeCom calendar runtime ingestion
- WeCom message notifications runtime ingestion
- WeCom send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_WECOM_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_WECOM_READONLY_INGESTION_SEAM_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- WeCom runtime OAuth callback foundation
- `providerType = WECOM_OAUTH` session truth
- tenant-scoped callback audit truth
- WeCom `meetings` read-only runtime ingestion seam

当前本轮要补齐：

- workspace-scoped `cal_id` registry
- registry validation truth
- settings/operator business-first readout
- `calendar runtime pending` 的更准确 operator wording

当前仍未成立：

- native WeCom SCIM
- WeCom `calendar` runtime ingestion
- WeCom `message notifications` runtime ingestion
- WeCom send/write-back
- connector platformization

# PR89 - WeCom Read-only Ingestion Seam

更新时间：2026-04-07
状态：Implemented
范围：PR89 已把 WeCom read-only target coverage truth 推进到 `meetings` 的真实 runtime ingest seam，并继续保持 `calendar verified-but-unbound / message notifications unresolved`；不把 native WeCom SCIM、send/write-back、connector platform 或 infra/platformization 写成已成立

## 1. 目标

PR89 只做五件事：

1. 冻结 WeCom `meetings / calendar / message notifications` 的官方 read contract truth
2. 落 normalized source payload contract
3. 接入现有 tenant-scoped runtime seam
4. 在 settings/operator surface 中把 `meetings established / calendar verified-but-unbound / message unresolved` 写清楚
5. 补 baseline / plan / report / guards / tests / 完整验证链

它不是：

- native WeCom SCIM
- WeCom send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_WECOM_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_WECOM_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- WeCom runtime OAuth callback foundation
- `providerType = WECOM_OAUTH` session truth
- tenant-scoped callback audit truth
- read-only target coverage truth：`meetings / calendar / message notifications`

当前本轮已补齐：

- `get_user_meetingid`
- `get_info`
- normalized WeCom meeting source payload contract
- `meetings` tenant-scoped ingest path
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
- settings/operator readout

当前仍未成立：

- native WeCom SCIM
- `calendar` runtime ingestion，直到存在 workspace-scoped `cal_id` registry
- `message notifications` runtime ingestion
- WeCom send/write-back
- connector platformization

# PR88 - WeCom OAuth Callback Runtime Foundation

更新时间：2026-04-07
状态：Implemented
范围：PR88 已把 WeCom 从 foundation-only 推进到真实可运行的 runtime OAuth callback foundation，并形成 `providerType = WECOM_OAUTH` session truth、tenant-scoped callback audit truth 与 settings/operator callback readout；不把 native WeCom SCIM、read-only ingestion runtime、send/write-back、connector platform 或 infra/platformization 写成已成立

## 1. 目标

PR88 只做五件事：

1. 落 `/api/auth/wecom/start` 与 `/api/auth/wecom/callback`
2. 落 `code -> corp token -> oauth identity -> provider user profile`
3. 建立 workspace-scoped identity binding 与 `providerType = WECOM_OAUTH`
4. 在 settings/operator surface 中展示 callback readiness、last callback result、failure posture
5. 补 baseline / plan / report / guards / tests / 完整验证链

它不是：

- native WeCom SCIM
- WeCom read-only ingestion runtime
- WeCom send/write-back
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_WECOM_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md`
- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- `WECOM_OAUTH` provider seam
- WeCom config / readiness helper
- `Helm directory-sync adapter seam`
- read-only target coverage truth：`meetings / calendar / message notifications`

当前本轮已补齐：

- `/api/auth/wecom/start`
- `/api/auth/wecom/callback`
- corp token exchange
- oauth identity fetch
- provider user profile fetch
- workspace-scoped identity binding
- `providerType = WECOM_OAUTH` session write
- tenant-scoped callback audit truth
- settings/operator callback readout

当前仍未成立：

- native WeCom SCIM
- WeCom read-only ingestion runtime
- WeCom send/write-back
- connector platformization

# PR87 - DingTalk Meetings Runtime Ingestion

更新时间：2026-04-07
状态：Implemented
范围：PR87 已把 DingTalk `meetings` 从 target coverage truth 推进到真实 runtime ingest seam，并继续保持 `calendar established / message notifications unresolved`；不把 native DingTalk SCIM、send/write-back、connector platform 或 infra/platformization 写成已成立

## 1. 目标

PR87 只做五件事：

1. 冻结 DingTalk `meetings` official provider contract
2. 落 normalized meeting source payload contract
3. 接入现有 tenant-scoped runtime seam
4. 在 settings/operator surface 中把 `meetings established / calendar established / message unresolved` 写清楚
5. 补 baseline / plan / report / guards / tests / 完整验证链

它不是：

- native DingTalk SCIM
- DingTalk send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DINGTALK_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_DINGTALK_READONLY_INGESTION_SEAM_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- DingTalk runtime OAuth callback foundation
- `providerType = DINGTALK_OAUTH` session truth
- DingTalk `calendar` runtime ingest seam
- read-only target coverage truth：`meetings / calendar / message notifications`

当前本轮已补齐：

- `QueryOrgConferenceList`
- `QueryConferenceInfoByRoomCode`
- `GET /v1.0/conference/orgConferences`
- `GET /v1.0/conference/roomCodes/{roomCode}/infos`
- normalized meeting source payload contract
- `meetings` tenant-scoped ingest path
- settings/operator readout

当前仍未成立：

- native DingTalk SCIM
- DingTalk message-notification ingestion runtime
- DingTalk send/write-back
- connector platformization
- broader connector orchestration platform

# PR85 - DingTalk Read-only Ingestion Seam

更新时间：2026-04-07
状态：Implemented
范围：PR85 已把 DingTalk read-only ingestion seam 推到 `calendar` 的真实 runtime；`meetings / message notifications` 继续保留为未成立 truth，其中 `meetings` 仍待 method/path freeze，`message notifications` 仍待 read-side contract 证实；不把 native DingTalk SCIM、send/write-back、connector platform 或 infra/platformization 写成已成立

## 1. 目标

PR85 只做六件事：

1. 把 DingTalk read-only scope 从 foundation 推进到真实 ingestion seam
2. 只覆盖 `meetings / calendar / message notifications`
3. 建立 tenant-scoped ingest path
4. 建立 persisted payload / preview / handle truth
5. 接入现有 `RuntimeSession / SessionNotebook / ConnectorIngestionRecord` 最小 runtime seam
6. 在 settings/operator surface 中展示 DingTalk read-only readiness、last ingest result、failure posture

它不是：

- native DingTalk SCIM
- DingTalk send/write-back
- broader connector orchestration platform
- connector platformization
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md`
- `HELM_DINGTALK_OAUTH_CALLBACK_RUNTIME_FOUNDATION_BASELINE_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- `DINGTALK_OAUTH` provider seam
- DingTalk runtime OAuth callback foundation
- `providerType = DINGTALK_OAUTH` session truth
- tenant-scoped callback audit truth
- DingTalk connector token persistence / callback metadata
- read-only target coverage truth：`meetings / calendar / message notifications`

当前本轮已补齐：

- `calendar` 的官方 provider-side read contract
- `calendar` 的 normalized source payload contract
- tenant-scoped ingest path
- persisted payload / preview / handle truth
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord` 最小接入
- settings/operator ingest readout

当前仍未成立：

- native DingTalk SCIM
- DingTalk meetings ingestion runtime
- DingTalk message-notification ingestion runtime
- DingTalk send/write-back
- connector platformization
- broader connector orchestration platform
- infra/platform implementation

## 3. 本轮要证明什么

1. DingTalk 不再只停留在 read-only coverage truth，而是已经进入 `calendar` 的真实 ingest seam
2. `calendar` 已经有 tenant-scoped ingest path，`meetings / message notifications` 继续保留为未成立 truth
3. Helm 已经有 persisted payload / preview / handle truth，而不是只停留在 connector metadata
4. 当前 repo truth 仍然不会把 native DingTalk SCIM、send/write-back、connector platformization 写成已成立

## 4. 精确闭环

`connected DingTalk connector -> ingest trigger -> provider fetch -> normalized source payload contract -> RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord -> settings/operator readout -> baseline/report/guards`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- current repo truth does not claim native DingTalk SCIM
- current repo truth does not claim DingTalk send/write-back
- current repo truth does not claim DingTalk connector platformization

## 6. 范围

- `app/api/connectors/dingtalk/*`
- `lib/connectors/dingtalk.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/helm-v2/contracts.ts`
- `lib/helm-v2/layered-memory.ts`
- `lib/helm-v2/runtime-upgrade.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- PR85 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- 对应 tests

## 7. 不做

- native DingTalk SCIM claim
- send/write-back connector
- connector platformization
- broader connector orchestration platform
- Docker / Kubernetes / Helm chart / CI implementation
- execution-authority expansion

## 8. 风险

1. 如果直接复用 `ImportJob` 大路径，PR85 会被误扩成 broader connector orchestration platform
2. 如果 provider source payload 没有显式 boundary/trust posture，会污染 runtime ingest truth
3. 如果把 read-only ingestion seam 写成 native DingTalk SCIM 或 write-back，会越过当前 truth
4. provider-side endpoint contract 如果没有先核实，会引入脆弱的 runtime dependency

## 9. 阶段计划

### Phase 0

- 复核 PR84 callback foundation 与现有 runtime/persisted payload seam
- 冻结 PR85 计划
- 状态：Completed

### Phase 1

- provider-side read contract verification
- normalized source payload contract
- 状态：Pending

### Phase 2

- tenant-scoped ingest path
- `RuntimeEvent / RuntimeSession / SessionNotebook / PersistedPayload / ConnectorIngestionRecord`
- settings/operator readout
- 状态：Pending

### Phase 3

- 完整验证链
- 状态：Pending

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR115 - Reserved Workspace Host Gating

更新时间：2026-04-12
状态：In Progress
范围：只收第 1 批 reserved workspace host isolation，不扩到 full settings/commercial/participant portal reserved plane

## 1. 目标

1. 给 `Workspace` 增加显式 `workspaceClass / systemKey`
2. 收出 `Helm reserved workspace` 的稳定 host resolver
3. 让 public program catalog host 不再靠 workspace 数量 heuristic
4. 让 `/reports` 的 engineering delivery review 只在 reserved host 可见

## 2. 当前 truth

- `Solution Extension` / `reserved workspace` 边界定义已冻结
- 当前仓库仍有 first-party data host 与 customer workspace 混线风险
- `/programs` 之前还依赖 active workspace 数量 heuristic
- `/reports` 的 engineering delivery review 之前没有 workspace host gating

## 3. 范围

- `prisma/schema.prisma`
- `prisma/migrations/202604120001_reserved_workspace_host/migration.sql`
- `lib/workspace-identity.ts`
- `lib/workspace-reserved.ts`
- `lib/billing/program-catalog.ts`
- `app/(workspace)/reports/page.tsx`
- `features/reports/reports-client.tsx`
- `lib/auth/trial-onboarding.ts`
- `features/settings/actions.ts`
- `prisma/seed.ts`
- docs / guards / targeted tests

## 4. 不做

- settings commercial / participant portal / skill governance 全量 reserved gating
- existing production/local data automatic backfill
- full RBAC / enterprise IAM
- full first-party solution extension registry

## 5. 风险

1. 现有数据库如果没有 reserved host，会让 `/programs` 读空、`/reports` 不显示 internal engineering review
2. 如果 seed 不同步 reserved host，`db:reset` 后 demo 路径会漂移
3. 如果 guards 还要求旧 heuristic truth，本轮会被仓库自检误判回退

## 6. 阶段计划

### Phase 1

- schema / migration / host resolver
- 状态：Completed

### Phase 2

- `/programs` host 收口 + `/reports` reserved gating + targeted tests
- 状态：Completed

### Phase 3

- docs / guards / validation
- 状态：In Progress

# PR116 - Reserved Workspace Data Backfill Tool

更新时间：2026-04-12
状态：In Progress
范围：只做 reserved workspace first-party data inventory / backfill tool、preflight collision / integrity guard 和文档守卫；不做自动分类或自动批量迁移

## 1. 目标

1. 给非 reserved workspace 的 first-party `commercial / program / portal / settlement` 数据补一条统一 inventory 面
2. 让 backfill 工具默认 dry-run，只在显式 `--apply --source-workspace-id=<workspaceId>` 下执行迁移
3. 在 apply 前强制做 target-key collision 和 cross-workspace integrity preflight
4. 保持 `CapabilityCatalogEntry` 与 `SkillSuggestion formal review` inventory-only，不进入自动迁移

## 2. 当前 truth

- reserved host identity 与 internal surface gating 已成立
- existing first-party data 仍可能残留在 customer workspace
- local/demo seed 不应再把 first-party settlement proof data 写进 customer workspace
- 这条线目前最需要的是 operator-safe inventory / preflight contract，不是继续扩 UI
- 真实 apply 一旦开始，必须留下 audit/event evidence，不能只靠终端输出判断迁移历史

## 3. 范围

- `lib/workspace-reserved-backfill.ts`
- `scripts/backfill-helm-reserved-workspace.ts`
- `package.json`
- `README.md`
- `docs/README.md`
- `PLANS.md`
- `scripts/self-check/config.ts`
- `scripts/helm-self-check-refactored.ts`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `lib/workspace-reserved-backfill.test.ts`
- reserved workspace data backfill baseline / report docs

## 4. 不做

- automatic tenant classification
- auto-apply across every non-reserved workspace
- capability catalog / formal skill review automatic migration
- migration execution audit UI

## 5. 风险

1. source workspace 归属判断仍需要 operator 人工确认
2. reserved host 现存 key collision 会阻断 apply，需要人工合并策略
3. 现有 cross-workspace 脏链会阻断 apply，需要先做数据清理

# Engineering Delivery Review

时间：2026-04-12

## 1. 目标

在现有 `/reports` 内增加一块 internal-only 的 engineering delivery review，用当前仓库 git 历史判断：

- contributor 工作内容
- 数量与活跃度
- 质量信号
- 交付充分度
- ownership pressure
- 团队协同与改进建议

## 2. 范围

- `app/(workspace)/reports/page.tsx`
- `features/reports/reports-client.tsx`
- `features/reports/engineering-delivery-review-panel.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `lib/reports/engineering-delivery-review.test.ts`
- `README.md`
- `docs/README.md`
- `docs/reviews/HELM_ENGINEERING_DELIVERY_REVIEW_PLAN_V1.md`
- `docs/product/HELM_ENGINEERING_DELIVERY_REVIEW_BASELINE_V1.md`

## 3. 不做

- live GitHub API / PR review / issue / CI 集成
- 新 schema 或 engineering BI 平台
- 自动绩效打分或自动管理动作
- 多仓库聚合

## 4. 风险

1. runtime 可能无法读取 `.git` 或 `git` 命令
2. heuristic 容易被误读成正式 code review / performance scoring
3. 单看 commit 数会误导，所以必须把 docs / tests / guardrails / overlap 一起读

## 5. 阶段

- Phase 0：定位 reports surface、git 历史形状和现有边界
  - 状态：Completed
- Phase 1：实现 git delivery analysis helper 和 fallback posture
  - 状态：Completed
- Phase 2：接入 `/reports` 页面并补 contributor / collaboration readout
  - 状态：Completed
- Phase 3：补测试与 README / docs / baseline 同步
  - 状态：Completed
- Phase 4：运行验证切片
  - 状态：In Progress

# Solution Extension / Reserved Workspace

更新时间：2026-04-12
状态：Planned
当前切片：`Definition Freeze + Next-step Implementation Plan`

## 1. 目标

这条线只做 4 件事：

1. 冻结 `Worker / Skill / Resource / Solution Extension / Commercial` 分类
2. 明确 Helm first-party 自营经营功能属于 `FIRST_PARTY_RESERVED Solution Extension`
3. 明确定制开发类客户的共性功能应先进入 `TENANT_CUSTOM / REUSABLE_EXTENSION`
4. 为后续 `reserved workspace` host isolation、public host resolution 和 first-party data migration 提供稳定定义

## 2. 当前阶段范围

- `docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md`
- `docs/reviews/HELM_RESERVED_WORKSPACE_AND_SOLUTION_EXTENSION_PLAN_V1.md`
- `docs/README.md`
- `PLANS.md`
- 下一步会进入：
  - `prisma/schema.prisma`
  - `lib/auth/*`
  - `lib/billing/program-catalog.ts`
  - `features/programs/*`
  - `features/participant-portal/*`
  - `features/settings/*`
  - `app/(workspace)/reports/page.tsx`
  - `lib/reports/engineering-delivery-review.ts`

## 3. 风险

1. 如果继续把 custom delivery surface 直接写进 `Skill / Worker`，capability catalog 会失真
2. 如果 first-party reserved surface 继续留在普通 workspace 能见范围，tenant data boundary 会继续失真
3. 如果顺手把 extension 做成平台工程，会超出当前 repo 边界并增加升级成本

# PR115 - Reserved Workspace Host Gating

更新时间：2026-04-12
状态：In Progress
范围：只收第 1 批 reserved workspace host isolation，不扩到 full settings/commercial/participant portal reserved plane

## 1. 目标

1. 给 `Workspace` 增加显式 `workspaceClass / systemKey`
2. 收出 `Helm reserved workspace` 的稳定 host resolver
3. 让 public program catalog host 不再靠 workspace 数量 heuristic
4. 让 `/reports` 的 engineering delivery review 只在 reserved host 可见

## 2. 范围

- `prisma/schema.prisma`
- `prisma/migrations/202604120001_reserved_workspace_host/migration.sql`
- `lib/workspace-identity.ts`
- `lib/workspace-reserved.ts`
- `lib/billing/program-catalog.ts`
- `app/(workspace)/reports/page.tsx`
- `features/reports/reports-client.tsx`
- `lib/auth/trial-onboarding.ts`
- `features/settings/actions.ts`
- `prisma/seed.ts`
- docs / guards / targeted tests

## 3. 风险

1. 现有数据库如果没有 reserved host，会让 `/programs` 读空、`/reports` 不显示 internal engineering review
2. 如果 seed 不同步 reserved host，`db:reset` 后 demo 路径会漂移
3. 如果 guards 还要求旧 heuristic truth，本轮会被仓库自检误判回退

# PR116 - Reserved Workspace Data Backfill Tool

更新时间：2026-04-12
状态：In Progress
范围：只做 reserved workspace first-party data inventory / backfill tool、preflight collision / integrity guard 和文档守卫；不做自动分类或自动批量迁移

## 1. 目标

1. 给非 reserved workspace 的 first-party `commercial / program / portal / settlement` 数据补一条统一 inventory 面
2. 让 backfill 工具默认 dry-run，只在显式 `--apply --source-workspace-id=<workspaceId>` 下执行迁移
3. 在 apply 前强制做 target-key collision 和 cross-workspace integrity preflight
4. 保持 `CapabilityCatalogEntry` 与 `SkillSuggestion formal review` inventory-only，不进入自动迁移

## 2. 当前 truth

- reserved host identity 与 internal surface gating 已成立
- existing first-party data 仍可能残留在 customer workspace
- local/demo seed 不应再把 first-party settlement proof data 写进 customer workspace
- 这条线目前最需要的是 operator-safe inventory / preflight contract，不是继续扩 UI
- 真实 apply 一旦开始，必须留下 audit/event evidence，不能只靠终端输出判断迁移历史

## 3. 范围

- `lib/workspace-reserved-backfill.ts`
- `scripts/backfill-helm-reserved-workspace.ts`
- `package.json`
- `README.md`
- `docs/README.md`
- `PLANS.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `lib/workspace-reserved-backfill.test.ts`
- reserved workspace data backfill baseline / report docs

## 4. 不做

- automatic tenant classification
- auto-apply across every non-reserved workspace
- capability catalog / formal skill review automatic migration
- migration execution audit UI

## 5. 风险

1. source workspace 归属判断仍需要 operator 人工确认
2. reserved host 现存 key collision 会阻断 apply，需要人工合并策略
3. 现有 cross-workspace 脏链会阻断 apply，需要先做数据清理

# PR74 - DingTalk OAuth Callback And Read-only Ingestion

更新时间：2026-04-06
状态：Planned
范围：只做 DingTalk OAuth callback foundation、Helm-owned directory-sync / SCIM-compatible adapter seam、以及 meetings / calendar / message notifications 的 read-only ingestion seam 计划冻结；不把 native DingTalk SCIM、send/write-back、connector platform 或 infra/platformization 写成已成立

## 1. 目标

PR74 只做四件事：

1. 冻结 DingTalk OAuth callback runtime foundation 的目标、边界和验证方式
2. 冻结 DingTalk user info sync 到 Helm identity/session substrate 的最小闭环
3. 冻结 DingTalk read-only ingestion seam 的目标范围：`meetings / calendar / message notifications`
4. 明确 DingTalk 用户同步当前只能诚实表述为 `Helm directory-sync / SCIM-compatible adapter seam`，不声称 native DingTalk SCIM 已成立

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DINGTALK_IDENTITY_AND_READONLY_CONNECTOR_BASELINE_V1.md`
- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

当前已经成立：

- `DINGTALK_OAUTH` provider seam
- `DINGTALK` connector / import enum truth
- DingTalk config/env/readiness helper
- settings reserved connector readout
- `Helm directory-sync adapter seam`
- read-only target coverage truth：`meetings / calendar / message notifications`

当前本轮要冻结：

- DingTalk OAuth callback runtime foundation
- DingTalk user info -> Helm identity/session mapping seam
- DingTalk read-only ingestion seam
- DingTalk directory-sync / SCIM-compatible adapter seam 的诚实边界

当前仍未成立：

- native DingTalk SCIM
- DingTalk OAuth callback runtime implementation
- DingTalk meetings / calendar / message notifications ingestion runtime
- send/write-back connector
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation

## 3. 本轮要证明什么

PR74 要证明：

1. DingTalk 这条线已经进入明确的执行队列，而不是停留在 foundation-only 提醒
2. DingTalk OAuth callback、directory sync、read-only ingestion 必须拆成独立的最小可验证 slice，而不是一次性打包成“企业集成已完成”
3. DingTalk 用户同步当前只能诚实表述为 `Helm directory-sync / SCIM-compatible adapter seam`，在 provider-side contract 未验证前，不把 native DingTalk SCIM 写成已成立

## 4. 精确闭环

`OAuth callback foundation -> user info sync seam -> directory-sync / SCIM-compatible adapter seam -> read-only ingestion seam -> baseline/report/guards`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 native DingTalk SCIM integration
- 当前仍不是 DingTalk send/write-back connector
- 当前仍不是 infra/platform implementation

## 6. 范围

- `lib/auth/*dingtalk*`
- `lib/connectors/dingtalk*`
- `app/api/auth/dingtalk/*`
- `app/api/connectors/dingtalk/*`
- `features/settings/*`
- `features/imports/*`
- PR74 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 7. 不做

- native DingTalk SCIM claim
- send/write-back connector
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation
- execution-authority expansion

## 8. 风险

1. 如果把 directory-sync / SCIM-compatible adapter seam 写成 native DingTalk SCIM，会直接越过当前 truth
2. 如果把 read-only target coverage 写成 runtime 已成立，会误导 operator 和后续实现
3. 如果把 OAuth callback / user info sync / ingestion 放进同一轮一次性实现，验证面会过大，回归风险高

## 9. 阶段计划

### Phase 0

- 复核 current-main 与 PR73 DingTalk foundation truth
- 冻结 PR74 计划
- 状态：Completed

### Phase 1

- DingTalk OAuth callback foundation
- user info sync seam
- 状态：Planned

### Phase 2

- directory-sync / SCIM-compatible adapter seam
- read-only ingestion seam
- 状态：Planned

### Phase 3

- baseline / report / README / docs index / guards
- 状态：Planned

### Phase 4

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR79 - Design Operating Surfaces Next Slice

## 1. 目标

继续沿 `DESIGN.md` 的 guidance-first / judgement-first 设计线推进，但只扩 operating-heavy surface，不做全站 redesign。

本轮要把 shared substrate 从 PR78 的九个关键 surface 扩到：

1. opportunities
2. reports
3. diagnostics

并保持：

- 智能辅助仍是 recommendation / assist
- review-first / judgement-first 边界不变
- responsive / accessibility 结构继续统一

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DESIGN_PRINCIPLES_UI_REFRESH_BASELINE_V1.md`
- `HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_BASELINE_V1.md`
- `DESIGN.md`

当前已经成立：

- shared UI substrate
- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `layoutDensity / guidanceMode / formAssistEnabled`
- dashboard / internal operating / settings / approvals / memory / meeting detail / contact detail / company detail / inbox 九个关键 surface 的统一 guidance-first 结构

当前本轮要补齐：

- opportunities 顶部 guidance / preference / form-assist
- reports 顶部 guidance / preference / form-assist
- diagnostics 顶部 guidance / preference / form-assist
- operating-heavy surface 的更完整响应式与无障碍说明

当前仍未成立：

- 全站 redesign
- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 3. 本轮要证明什么

PR79 要证明：

1. PR77 / PR78 的 design substrate 可以扩到 multi-object / operating-heavy surface，而不是只停留在 detail 页
2. opportunities / reports / diagnostics 都能用同一套 guidance-first 结构表达 judgement、boundary、assist 和 review-first next step
3. 智能辅助仍然只成立为 recommendation / assist，不写成自动执行 truth

## 4. 精确闭环

`shared guidance/preference substrate -> opportunities/reports/diagnostics redesign -> baseline/report/README/docs/guards -> 完整验证链`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是全站 redesign / workflow automation UI / auto-execution plane

## 6. 范围

- `features/opportunities/opportunities-client.tsx`
- `features/reports/reports-client.tsx`
- `features/diagnostics/diagnostics-client.tsx`
- PR79 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 7. 不做

- 全站 redesign
- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 8. 风险

1. 如果 operating-heavy surface 不接 shared guidance/preference substrate，设计语言会重新分叉
2. 如果把 form-assist 写成自动动作，会越过 `judgement-first / review-first` 边界
3. 如果只改页面不补 guards/readme/docs，后续 freeze truth 会失真

## 9. 阶段计划

### Phase 0

- 复核 `DESIGN.md` 和 PR77 / PR78 shared substrate
- 状态：Completed

### Phase 1

- 重做 opportunities / reports / diagnostics 顶部结构
- 接 guidance / reminders / preferences / form-assist
- 状态：Completed

### Phase 2

- 同步 baseline / report / README / docs / guards / pilot-readiness
- 状态：Completed

### Phase 3

- 运行完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`


# PR80 - Design Import Surfaces Next Slice

## 1. 目标

继续沿 `DESIGN.md` 的 guidance-first / judgement-first 设计线推进，但只扩 import operator surface，不做更广的全站 redesign。

本轮要把 shared substrate 从 PR79 的 operating-heavy surface 扩到：

1. imports
2. import conflicts
3. import job detail

并保持：

- 智能辅助仍是 recommendation / assist
- review-first / judgement-first 边界不变
- 扫描、比较、风险识别和后续动作保持清晰

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DESIGN_PRINCIPLES_UI_REFRESH_BASELINE_V1.md`
- `HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md`
- `DESIGN.md`

当前已经成立：

- shared UI substrate
- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `layoutDensity / guidanceMode / formAssistEnabled`
- dashboard / internal operating / settings / approvals / memory / meeting detail / contact detail / company detail / inbox / opportunities / reports / diagnostics 的统一 guidance-first 结构

当前本轮要补齐：

- imports 顶部 guidance / preference / form-assist
- import conflicts 顶部 guidance / preference / form-assist
- import job detail 顶部 guidance / preference / form-assist
- import operator surface 的更完整响应式与无障碍说明

当前仍未成立：

- 全站 redesign
- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 3. 本轮要证明什么

PR80 要证明：

1. shared guidance substrate 可以扩到 import operator-heavy surface，而不是只停留在主页、detail 和 operating summary
2. imports / conflicts / import result 都能用同一套 judgement / evidence / action / boundary 结构表达 review-first next step
3. 智能辅助仍然只成立为 recommendation / assist，不写成自动执行 truth

## 4. 精确闭环

`shared guidance/preference substrate -> imports/conflicts/import-result redesign -> baseline/report/README/docs/guards -> 完整验证链`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 connector governance center / workflow automation UI / auto-execution plane

## 6. 范围

- `features/imports/imports-client.tsx`
- `features/imports/import-conflicts-client.tsx`
- `features/imports/import-job-detail-client.tsx`
- PR80 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 7. 不做

- connector admin / platformization
- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 8. 风险

1. 如果 import operator surface 不接 shared guidance/preference substrate，设计语言会再次分叉

# PR83 - Design Substrate Hardening And Polish

## 1. 目标

继续沿 `DESIGN.md` 推进，但这轮不再横向扩新模块，而是把共享 design substrate 本身收紧，并把高摩擦表单面做成更稳定的 mobile / accessibility / form-assist 结构。

本轮聚焦：

1. local preferences / responsive rules / accessibility posture hardening
2. setup wizard / login / CRM import polish

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DESIGN_PRINCIPLES_UI_REFRESH_BASELINE_V1.md`
- `HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_BASELINE_V1.md`
- `DESIGN.md`

当前已经成立：

- shared UI substrate
- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `layoutDensity / guidanceMode / formAssistEnabled`
- imports / operating / detail-heavy surface 的统一 guidance-first 结构

当前本轮要补齐：

- local preference persistence / cross-tab sync 稳定化
- reduced-motion / high-contrast / mobile 收口
- shared `WorkspaceFormAssistPanel`
- setup wizard / login / CRM import 的 guidance / preference / assist 收口

当前仍未成立：

- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 3. 本轮要证明什么

PR83 要证明：

1. shared design substrate 可以继续往“稳定 contract”收，而不是不断复制 ad-hoc 顶部卡片
2. setup wizard、login、CRM import 这类高摩擦页面，也能用同一套 judgement-first / review-first 结构表达辅助与边界
3. 自动填充和提示仍只成立为 assist，不会变成自动提交或自动执行

## 4. 精确闭环

`shared substrate hardening -> setup/login/CRM import polish -> baseline/report/README/docs/guards -> 完整验证链`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 workflow automation UI / auto-execution plane / server-side preference platform

## 6. 范围

- `components/providers/workspace-ui-provider.tsx`
- `components/shared/workspace-guidance-panel.tsx`
- `components/shared/workspace-surface-preferences.tsx`
- `components/shared/workspace-form-assist-panel.tsx`
- `app/globals.css`
- `features/settings/setup-wizard.tsx`
- `features/auth/login-panel.tsx`
- `features/imports/crm-import-client.tsx`
- PR83 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 7. 不做

- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- automatic submission / automatic connector execution
- execution-authority expansion

## 8. 风险

1. 如果 shared substrate 不继续收紧，后续 entry/setup/import 页面仍会重新漂移
2. 如果把 assist 写成自动提交，会直接越过 `review-first` 边界
3. public/login/setup 这类非 workspace shell 页面更容易出现 provider contract 漂移，需要继续保持最小一致性
2. 如果把 import assist 写成自动动作，会越过 `judgement-first / review-first` 边界
3. 如果只改页面不补 guards/readme/docs，后续 freeze truth 会失真

## 9. 阶段计划

### Phase 0

- 复核 `DESIGN.md` 和 PR77 / PR78 / PR79 shared substrate
- 状态：Completed

### Phase 1

- 重做 imports / conflicts / import result 顶部结构
- 接 guidance / reminders / preferences / form-assist
- 状态：Completed

### Phase 2

- 同步 baseline / report / README / docs / guards / pilot-readiness
- 状态：Completed

### Phase 3

- 运行完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`


# PR82 - Design Sitewide Redesign Closeout

## 1. 目标

继续沿 `DESIGN.md` 的 guidance-first / judgement-first 设计线推进，把 shared redesign substrate 扩到当前仓库里所有剩余的 feature-owned product surface。

本轮要收口的剩余面：

1. analytics
2. CRM import
3. role handoff
4. trial onboarding
5. participant portal
6. participant portal onboarding

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DESIGN_PRINCIPLES_UI_REFRESH_BASELINE_V1.md`
- `HELM_DESIGN_DETAIL_ACCESSIBILITY_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DESIGN_OPERATING_SURFACES_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DESIGN_IMPORT_SURFACES_NEXT_SLICE_BASELINE_V1.md`
- `DESIGN.md`

当前已经成立：

- shared UI substrate
- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `layoutDensity / guidanceMode / formAssistEnabled`
- dashboard / internal operating / settings / approvals / memory / meeting detail / contact detail / company detail / inbox / opportunities / reports / diagnostics / imports / import conflicts / import result 的统一 guidance-first 结构

当前本轮要补齐：

- analytics guidance / preference closeout
- CRM import wizard guidance / preference / assist closeout
- role handoff guidance / preference closeout
- trial onboarding guidance / preference / assist closeout
- participant portal / participant portal onboarding guidance / preference / assist closeout
- README / docs / guards / pilot-readiness 对“feature-owned 全覆盖”的新 freeze truth

当前仍未成立：

- 完整设计系统站点
- server-side preference sync
- cross-device preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 3. 本轮要证明什么

PR82 要证明：

1. shared redesign substrate 已经扩到当前仓库所有剩余的 feature-owned product surface，而不是只覆盖一部分 detail / operator 页面
2. analytics、imports、handoff、trial onboarding、participant portal 都能用同一套 guidance / preference / assist 结构表达 review-first next step
3. “全站 redesign” 的当前 truth 可以诚实冻结为：feature-owned product surfaces 已对齐，但仍不是完整设计系统站点，也不是 workflow automation UI

## 4. 精确闭环

`DESIGN.md -> remaining feature-owned surface redesign -> participant portal provider seam -> baseline/report/README/docs/guards -> 完整验证链`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是完整设计系统站点 / workflow automation UI / server-side preference platform

## 6. 范围

- `features/analytics/analytics-client.tsx`
- `features/imports/crm-import-client.tsx`
- `features/internal-operating-workspace/role-handoff-surface.tsx`
- `features/auth/trial-onboarding-surface.tsx`
- `features/participant-portal/participant-portal-client.tsx`
- `features/participant-portal/participant-portal-onboarding-client.tsx`
- `app/portal/page.tsx`
- `app/portal/access/[token]/page.tsx`
- PR82 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 7. 不做

- 完整设计系统站点
- server-side / cross-device preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion
- 重新推翻 public entry page 的现有视觉路线

## 8. 风险

1. 如果 participant portal 不接 shared redesign substrate，“全站 redesign” 会继续失真
2. 如果把 assist 写成自动动作，会越过 `judgement-first / review-first` 边界
3. 如果把“feature-owned 全覆盖”写成“完整设计系统已成立”，会形成过度承诺

## 9. 阶段计划

### Phase 0

- 复核 `DESIGN.md`、PR77 / PR78 / PR79 / PR80 substrate 和剩余页面清单
- 状态：Completed

### Phase 1

- 重做 analytics / CRM import / role handoff / trial onboarding / participant portal / participant portal onboarding 顶部结构
- participant portal page seam 补 `WorkspaceUiProvider`
- 状态：Completed

### Phase 2

- 同步 baseline / report / README / docs / guards / pilot-readiness
- 状态：Completed

### Phase 3

- 运行完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`


# PR74 - WeCom Identity And Read-only Connector Foundation

更新时间：2026-04-06
状态：Completed
范围：只做 WeCom identity/read-only connector foundation truth：provider seam、config/env/readiness、schema enum、settings/operator readout、docs/guards/tests；不进入 native WeCom SCIM、OAuth runtime、read-only ingestion runtime、send/write-back、Docker/Kubernetes/CI implementation

## 1. 目标

PR74 只做五件事：

1. 增加 `WECOM_OAUTH` provider seam
2. 冻结 WeCom config/env/readiness contract
3. 增加 `ConnectorProvider.WECOM` 与 `ImportSourceType.WECOM` schema truth
4. 在 settings/operator surface 显式展示 WeCom reserved read-only connector truth
5. 同步 baseline / plan / report / README / docs index / self-check / boundary-check / pilot-readiness

## 2. 当前 freeze truth

当前基线继承：

- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_DEPLOY_BASELINE_CONTRACT_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`

当前已经成立：

- workspace-first / membership-backed 多租户控制面
- auth provider seam
- connector/import enum truth
- settings reserved connector readout pattern

当前本轮要补齐：

- `AUTH_SESSION_PROVIDER_TYPES.WECOM_OAUTH`
- `ConnectorProvider.WECOM`
- `ImportSourceType.WECOM`
- WeCom OAuth readiness truth
- WeCom directory-sync adapter seam truth
- WeCom read-only target coverage truth

当前仍未成立：

- native WeCom SCIM
- WeCom OAuth login/callback runtime
- WeCom meetings / calendar / message notifications ingestion runtime
- send/write-back connector
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation

## 3. 本轮要证明什么

PR74 要证明：

1. Helm 可以先把 WeCom identity/read-only connector foundation 诚实落成 contract truth，而不越界声称 runtime 已成立
2. WeCom 目录同步当前只能诚实表达为 `Helm directory-sync adapter seam`
3. read-only target coverage 可以冻结到 `meetings / calendar / message notifications`，同时继续保留 `no broad auto-write` / `no execution-authority expansion`

## 4. 精确闭环

`provider seam -> env/config/readiness truth -> schema enum truth -> settings reserved connector readout -> baseline/report/guards`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 native WeCom SCIM / runtime OAuth / runtime ingestion / send-writeback / connector platform

## 6. 范围

- `lib/auth/provider-seam.ts`
- `lib/connectors/wecom.ts`
- `lib/connectors/wecom.test.ts`
- `.env.example`
- `prisma/schema.prisma`
- `prisma/migrations/*wecom*`
- `app/(workspace)/settings/page.tsx`
- `features/settings/settings-client.tsx`
- PR74 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 7. 不做

- native WeCom SCIM
- WeCom OAuth login/callback route implementation
- WeCom directory provisioning runtime
- WeCom meetings / calendar / message notifications ingestion runtime
- WeCom send/write-back connector
- Docker / Kubernetes / Helm chart / CI implementation
- execution authority expansion

## 8. 风险

1. 如果把 `Helm directory-sync adapter seam` 写成 native WeCom SCIM，会直接越界
2. 如果把 read-only target coverage 写成 runtime 已成立，会误导 operator 和后续实现
3. 如果把 WeCom connector foundation 顺手扩成 send/write-back 或 platformization，会破坏当前边界诚实性

## 9. 阶段计划

### Phase 0

- 复核 current main 的 auth/connectors/settings truth
- 冻结 PR74 计划
- 状态：Completed

### Phase 1

- provider seam 与 config/env/readiness helper
- schema enum truth
- settings reserved connector readout
- 状态：Completed

### Phase 2

- baseline / report / README / docs index / guards / pilot-readiness / migration
- 状态：Completed

### Phase 3

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`


# PR73 - DingTalk Identity And Read-only Connector Foundation

更新时间：2026-04-06
状态：Completed
范围：只做 DingTalk identity/read-only connector foundation：provider/config/env seam、workspace settings readout、directory-sync adapter seam truth、read-only coverage truth、docs/guards/validation；不把 native DingTalk SCIM、send/write-back、connector platform 或 infra/platformization 写成已成立

## 1. 目标

PR73 只做四件事：

1. 把 DingTalk identity provider seam 接到现有 auth/provider truth
2. 把 DingTalk read-only connector target 接到 connector/import config truth
3. 把 Helm-owned directory-sync adapter seam truth 冻结清楚，不声称 native DingTalk SCIM 已成立
4. 把 baseline / plan / report、README / docs index、self-check / boundary-check 收成同一版 truth

## 2. 当前 freeze truth

当前基线继承：

- `HELM_MULTITENANCY_MULTIUSER_FOUNDATION_BASELINE_V1.md`
- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

当前已经成立：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- DB-backed auth session
- centralized capability matrix
- connector/import governance boundary

当前本轮已补齐：

- `DINGTALK_OAUTH` provider seam
- `DINGTALK` connector/import enum truth
- DingTalk config helper / readiness helper
- settings reserved connector readout
- `.env.example` DingTalk env contract

当前仍未成立：

- native DingTalk SCIM
- DingTalk OAuth login/callback runtime
- DingTalk read-only ingestion runtime
- send/write-back connector path
- Docker / Kubernetes / CI implementation

## 3. 本轮要证明什么

PR73 要证明：

1. Helm 可以先把 DingTalk identity/read-only connector foundation 收成 honest baseline，而不臆造未验证的 runtime
2. DingTalk directory sync 现在只能诚实表述为 `Helm directory-sync adapter seam`
3. 当前 read-only scope 只冻结到 `meetings / calendar / message notifications`

## 4. 精确闭环

`provider seam -> config/env contract -> connector/import enum truth -> settings/operator readout -> baseline/guard truth`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 native DingTalk SCIM integration
- 当前仍不是 DingTalk connector platform
- 当前仍不是 infra/platform implementation

## 6. 范围

- `lib/auth/provider-seam.ts`
- `lib/connectors/dingtalk.ts`
- `lib/connectors/dingtalk.test.ts`
- `prisma/schema.prisma`
- `prisma/migrations/202604060002_dingtalk_identity_foundation/migration.sql`
- `app/(workspace)/settings/page.tsx`
- `features/settings/settings-client.tsx`
- `.env.example`
- PR73 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/pilot-readiness-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `PLANS.md`

## 7. 不做

- native DingTalk SCIM claim
- DingTalk OAuth runtime implementation
- DingTalk read-only ingestion runtime
- send/write-back connector path
- connector platformization
- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- execution-authority expansion

## 8. 风险

1. 如果把 directory-sync seam 写成 native DingTalk SCIM，会直接越过当前 truth
2. 如果把 read-only coverage 写成 send/write-back connector，会越过当前 connector boundary
3. 如果不把 DingTalk env contract 和 docs/guards 同步，后续 README / self-check / boundary truth 会漂移

## 9. 阶段计划

### Phase 0

- 复核当前 connector/auth/provider/config truth
- 冻结 PR73 计划
- 状态：Completed

### Phase 1

- DingTalk provider/config/env/settings foundation
- baseline / report / index / guards
- targeted tests
- 状态：Completed

### Phase 2

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`


# PR76 - Auth Anomaly Governance Continuation Next Slice

更新时间：2026-04-06
状态：Completed
范围：继续沿 auth/session 与 deploy contract 这条线推进，但只做 `latestMarkerCoverageSummary`、`revokeExecutionAggregateSummary`、org-admin/support-pack/settings readout 与 deploy baseline contract next-slice freeze；不进入 infra/platform implementation

## 1. 目标

PR76 只做三件事：

1. 把 auth anomaly review 从 `latestAnomalyFollowThroughSummary` 再收紧到 `latestMarkerCoverageSummary`
2. 把 scoped revoke 从 `authControlConsistencyOverview` 再收紧到 `revokeExecutionAggregateSummary`
3. 把 deploy baseline contract 继续冻结到 next slice，但继续诚实保留它仍是 docs-and-guard truth，不是 Docker / Kubernetes / CI implementation

## 2. 当前 freeze truth

当前基线继承：

- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_DEPLOY_BASELINE_CONTRACT_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_DEPLOY_BASELINE_CONTRACT_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

当前已经成立：

- `latestAnomalyFollowThroughSummary`
- `authControlConsistencyOverview`
- marker-scoped follow-through truth
- deploy baseline contract 的 docs-and-guard truth

当前本轮要补齐：

- `latestMarkerCoverageSummary`
- `revokeExecutionAggregateSummary`
- org-admin / settings / support-pack 的同层 readout

当前仍未成立：

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM

## 3. 本轮要证明什么

PR76 要证明：

1. auth/session 这条线还能继续收紧到 marker coverage truth 与 aggregate revoke execution truth，而不用跳去 enterprise IAM
2. org-admin / support-pack / settings 能同时表达 latest marker coverage、aggregate revoke execution 和 current-session protected review，而不混淆三层 truth
3. current deploy baseline contract remains docs-and-guard truth, not infrastructure platformization

## 4. 精确闭环

`session-governance truth -> latestMarkerCoverageSummary -> revokeExecutionAggregateSummary -> org-admin/support-pack/settings readout -> deploy contract next-slice freeze`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / Docker / Kubernetes / CI platform

## 6. 范围

- `lib/auth/org-admin-governance.ts`
- `lib/auth/org-admin-governance.test.ts`
- `lib/auth/org-admin-support-pack-route.test.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- PR76 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `PLANS.md`

## 7. 不做

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- full enterprise IAM
- infra/platform implementation
- execution authority expansion

## 8. 风险

1. 如果把 latest marker coverage 和 aggregate revoke execution 混在一起，会让 operator 对 auth-control truth 产生误读
2. 如果把 current-session protected review 写成自动 revoke 建议，会越过当前 review-first 边界
3. 如果把 deploy baseline contract 的 next slice 写成 infra implementation，将再次越过当前基线

## 9. 阶段计划

### Phase 0

- 复核 PR71 / main 当前 auth/session truth
- 冻结 PR76 计划
- 状态：Completed

### Phase 1

- latest marker coverage truth
- aggregate revoke execution truth
- org-admin / support-pack / settings readout
- targeted tests
- 状态：Completed

### Phase 2

- deploy baseline contract next-slice freeze
- baseline / report / plans / index / guards 同步
- 状态：Completed


# PR71 - Auth Anomaly Follow-through And Deploy Baseline Contract Deeper Slice

更新时间：2026-04-06
状态：Completed
范围：继续沿 auth/session 与 deploy contract 这条线推进，但只做 latest anomaly follow-through truth、authControlConsistencyOverview、scoped revoke preview-vs-executed consistency 收口，以及 deploy baseline contract 的 deeper-slice freeze；不进入 infra/platform implementation

## 1. 目标

PR71 只做三件事：

1. 把 auth anomaly review 从 `latestAnomalyMarker + latestAnomalyFollowThroughSummary` 再收紧到 marker-scoped follow-through truth 与 aggregate `authControlConsistencyOverview`
2. 把 scoped revoke 从 live preview / executed summary / consistency summary 再收紧到 current-session protected、review-only、bulk-revocable、drift 的同层总览 truth
3. 把 deploy baseline contract 继续冻结到 deeper slice，但继续诚实保留它仍是 docs-and-guard truth，不是 Docker / Kubernetes / CI implementation

## 2. 当前 freeze truth

当前基线继承：

- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_DEPLOY_BASELINE_CONTRACT_NEXT_SLICE_BASELINE_V1.md`
- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_NEXT_SLICE_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

当前已经成立：

- `latestAnomalyMarker`
- `latestAnomalyFollowThroughSummary`
- `anomalyInventorySummary`
- `previewVsExecutedScopeSummary`
- `revokeConsistencySummary`
- `currentSessionReviewScopeSummary`
- deploy baseline contract 的 docs-and-guard truth

当前本轮要补齐：

- `authControlConsistencyOverview`
- marker-scoped follow-through summary 和 aggregate consistency overview 的清晰分层
- org-admin / settings / support-pack 的同层 readout

当前仍未成立：

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full enterprise IAM

## 3. 本轮要证明什么

PR71 要证明：

1. auth/session 这条线还能继续收紧到 aggregate auth-control consistency truth，而不用跳去 enterprise IAM
2. org-admin / support-pack / settings 能同时表达 latest marker、latest follow-through、current-session protected review 和 aggregate consistency overview，而不混淆三层 truth
3. current deploy baseline contract remains docs-and-guard truth, not infrastructure platformization

## 4. 精确闭环

`session-governance truth -> latestAnomalyFollowThroughSummary -> authControlConsistencyOverview -> org-admin/support-pack/settings readout -> deploy contract deeper-slice freeze`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / Docker / Kubernetes / CI platform

## 6. 范围

- `lib/auth/org-admin-governance.ts`
- `lib/auth/org-admin-governance.test.ts`
- `lib/auth/org-admin-support-pack-route.test.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- PR71 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `PLANS.md`

## 7. 不做

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- full enterprise IAM
- infra/platform implementation
- execution authority expansion

## 8. 风险

1. 如果把 marker-scoped follow-through 和 aggregate consistency overview 混在一起，会让 operator 对 auth-control truth 产生误读
2. 如果把 current-session protected review 写成自动 revoke 建议，会越过当前 review-first 边界
3. 如果把 deploy baseline contract 的 deeper slice 写成 infra implementation，将再次越过当前基线

## 9. 阶段计划

### Phase 0

- 复核 PR69 / main 当前 auth/session truth
- 冻结 PR71 计划
- 状态：Completed

### Phase 1

- latest auth anomaly marker / follow-through truth deeper slice
- authControlConsistencyOverview
- org-admin / support-pack / settings readout
- targeted tests
- 状态：Completed

### Phase 2

- deploy baseline contract deeper-slice freeze
- baseline / report / plans / index / guards 同步
- 状态：Completed

### Phase 3

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR69 - Auth Anomaly Follow-through And Deploy Baseline Contract Next Slice

更新时间：2026-04-06
状态：Completed
范围：继续沿 auth/session 与 deploy contract 这条线推进，但只做 richer auth anomaly follow-through、auth-control consistency overview、scoped revoke preview-vs-executed delta truth、以及 deploy baseline contract 的 next-slice freeze；不进入 infra/platform implementation

## 1. 目标

PR69 只做三件事：

1. 把 auth anomaly review 从“只有总量与 current-session review truth”继续收紧到“latest anomaly marker / latest anomaly follow-through truth”
2. 把 scoped revoke 从“historical summary + live preview”继续收紧到“preview vs executed delta truth”，确保 operator 能看清当前候选、当前会话保护、最近一次 scope 执行之间的差异
3. 把 deploy baseline contract 继续冻结到 next slice，但继续诚实保留它仍是 docs-and-guard truth，不是 Docker / Kubernetes / CI implementation

## 2. 当前 freeze truth

当前基线继承：

- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_NEXT_SLICE_BASELINE_V1.md`
- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_SESSION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`

当前已经成立：

- shared `session-governance` truth
- scoped revoke historical audit truth
- live revoke scope preview truth
- current-session review-only scope truth
- workspace realignment audit truth
- deploy baseline contract 的 docs-and-guard truth

当前本轮已补齐：

- latest auth anomaly marker / latest anomaly follow-through truth
- `latestAnomalyFollowThroughSummary` marker-scoped truth
- anomaly inventory / management-mode truth
- preview-vs-executed revoke delta truth
- revoke consistency summary truth
- auth-control consistency overview aggregate truth
- deploy baseline contract 的 next-slice implementation plan freeze

当前仍未成立：

- Docker / Kubernetes / CI implementation
- SSO / SAML / SCIM / MFA rollout

## 3. 本轮要证明什么

PR69 要证明：

1. auth/session 这条线还能继续收紧到更细的 latest anomaly follow-through truth，而不用跳去 enterprise IAM
2. org-admin / support-pack / settings 可以同时表达 live revoke preview、current-session protected review、以及最近一次 scoped revoke 执行结果，而不混淆三层 truth
3. deploy baseline contract 可以继续向 future enterprise identity prerequisites 收紧，但仍然不能被写成 infra/platform implementation

## 4. 精确闭环

`shared session-governance truth -> latest anomaly marker / latestAnomalyFollowThroughSummary -> scoped revoke preview-vs-executed delta truth -> auth-control consistency overview -> org-admin/support-pack/settings readout -> deploy contract next-slice freeze`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / Docker / Kubernetes / CI platform

## 6. 范围

- `lib/auth/session.ts`
- `lib/auth/session-governance.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/session.test.ts`
- `lib/auth/org-admin-governance.test.ts`
- `lib/auth/org-admin-support-pack-route.test.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- PR69 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `PLANS.md`

## 7. 不做

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- full enterprise IAM
- infra/platform implementation
- execution authority expansion

## 8. 风险

1. 如果把 latest anomaly marker 误写成自动 revoke 建议，会让 operator 对 auth anomaly truth 产生误读
2. 如果把 live preview、current-session protected review 和 executed summary 混在一起，会让 support-pack truth 失真
3. 如果把 deploy baseline contract 的 next slice 写成 infra implementation，将再次越过当前基线

## 9. 阶段计划

### Phase 0

- 复核 PR68 当前 auth/session truth
- 冻结 PR69 计划

### Phase 1

- latest anomaly marker / follow-through truth
- scoped revoke preview-vs-executed delta truth
- org-admin / support-pack / settings readout
- targeted tests
- 状态：Completed

### Phase 2

- deploy baseline contract next-slice freeze
- baseline / report / plans / index 同步
- 状态：Completed

### Phase 3

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR68 - Auth Anomaly Follow-through And Session Governance Deeper Slice

更新时间：2026-04-06
状态：In Progress
范围：继续沿 auth/session 与 deploy contract 这条线推进，但只做 richer anomaly follow-through、live revoke scope truth、current-session review-only scope truth，以及对应的 org-admin/support-pack/settings readout；不进入 infra/platform implementation

## 1. 目标

PR68 只做三件事：

1. 把 `revokeWorkspaceAuthSessionsByScope()` 的 live scope truth 收成一套可解释的 operator-facing preview，而不只保留 historical audit summary
2. 把 current session 命中的 anomaly scope 单独标成 `review-only` truth，避免 operator 把当前会话误当成可批量撤销对象
3. 把这层 truth 接回 org-admin governance、support-pack export 和 settings surface，同时继续诚实保留 deploy baseline contract 仍是 docs-and-guard truth

## 2. 当前 freeze truth

当前基线继承：

- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_NEXT_SLICE_BASELINE_V1.md`
- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_SESSION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_BASELINE_V1.md`

当前已经成立：

- shared `session-governance` truth
- scoped revoke historical audit truth
- workspace realignment audit truth
- org-admin auth anomaly readout
- deploy baseline contract 的 docs-and-guard truth

当前仍未成立：

- live revoke scope preview truth
- current-session review-only scope truth
- Docker / Kubernetes / CI implementation
- SSO / SAML / SCIM / MFA rollout

## 3. 本轮要证明什么

PR68 要证明：

1. auth/session 这条线还能继续收紧到更细的 live revoke / current-session review truth，而不需要跳去 enterprise IAM
2. support-pack 和 settings 可以同时表达 historical revoke summary 与 current live scope truth，且不互相混淆
3. deploy baseline contract 可以继续保持诚实边界，不会被误写成 infra implementation

## 4. 精确闭环

`shared session-governance truth -> live revoke scope preview -> current-session review-only scope -> org-admin/support-pack/settings readout`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / Docker / Kubernetes / CI platform

## 6. 范围

- `lib/auth/session.ts`
- `lib/auth/session.test.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/org-admin-governance.test.ts`
- `lib/auth/org-admin-support-pack-route.test.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- PR68 baseline / plan / report
- `PLANS.md`

## 7. 不做

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- full enterprise IAM
- execution authority expansion

## 8. 风险

1. 如果把 current-session review-only scope 误写成可 revoke，会让 operator 得到错误治理信号
2. 如果把 live scope preview 和 historical summary 混在一起，会让 support-pack truth 失真
3. 如果把这层 auth/session continuation 误写成 enterprise IAM truth，会再次越过当前基线

## 9. 阶段计划

### Phase 0

- 复核 PR67 当前 auth/session truth
- 冻结 PR68 计划

### Phase 1

- live revoke scope preview
- current-session review-only scope truth
- org-admin/support-pack/settings readout
- targeted tests

### Phase 2

- baseline / report / plans 同步
- 完整验证链

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR67 - Enterprise Readiness Sequenced Hardening

更新时间：2026-04-06
状态：Completed
范围：按既定顺序继续推进 1) auth/session continuation, 2) tenant data governance application-layer closure, 3) enterprise infra planning freeze；继续明确 Docker / Kubernetes / CI implementation 递延

## 1. 目标

PR67 只做三件事，并且必须按顺序推进：

1. 继续收紧 auth/session continuation，补齐 richer anomaly follow-through、broader revoke scope 与 org-admin auth-control consistency
2. 继续收紧 tenant data governance application-layer closure，把当前已成形但仍需下一层的 application-layer tenant governance 再推进一层
3. 单独完成 enterprise infra / platform planning freeze，但不把 Docker / Kubernetes / CI / SSO / SCIM rollout 混进当前实现

它不是：

- Docker / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant
- API Gateway / OAuth2 platform
- execution-authority expansion

## 2. 当前 freeze truth

当前基线继承：

- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_NEXT_SLICE_BASELINE_V1.md`
- `HELM_AUTH_ANOMALY_FOLLOW_THROUGH_AND_SESSION_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md`
- `HELM_MULTITENANCY_WORKSPACE_DATA_GOVERNANCE_DEEPER_SLICE_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `HELM_ENTERPRISE_READINESS_AUTH_DEPLOY_AND_TENANT_HARDENING_PLAN_V1.md`

当前已经成立：

- DB-backed `AuthSession`
- shared `session-governance` truth
- workspace-scoped revoke scopes 与 scope-level revoke audit
- workspace-first application-layer tenant governance
- workspace-scoped export / delete / retention readout
- deploy baseline contract 的 docs-and-guard truth

当前明确未成立：

- Docker / docker-compose / Kubernetes / Helm chart / CI implementation
- SSO / SAML / SCIM
- MFA rollout
- full enterprise IAM
- schema-per-tenant / db-per-tenant
- infra-level tenant isolation

## 3. 本轮要证明什么

PR67 要证明三件事：

1. `auth/session` 这条线可以继续收紧到更细的 anomaly follow-through 和 revoke consistency，而不用跳去 enterprise IAM
2. `tenant data governance` 可以继续在 application-layer 收口，先把 current-main 已经成形的治理线补到更完整，而不用直接切数据库拓扑
3. `enterprise infra planning` 可以单独冻结为 roadmap truth，但必须继续诚实表达“尚未实现”

## 4. 精确闭环

`auth/session continuation -> tenant data governance application-layer closure -> enterprise infra planning freeze`

## 5. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / Kubernetes platform / schema-per-tenant platform

## 6. 范围

### Phase 1

- `lib/auth/session.ts`
- `lib/auth/session-governance.ts`
- `lib/auth/org-admin-governance.ts`
- `features/settings/actions.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`

### Phase 2

- `lib/auth/org-admin-governance.ts`
- `lib/auth/tenant-ownership.ts`
- `lib/auth/settings-governance.ts`
- remaining app-layer tenant governance seams discovered during implementation
- corresponding settings / operator surfaces

### Phase 3

- enterprise-readiness plan / baseline / report docs
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`

## 7. 不做

- Docker / docker-compose implementation
- Kubernetes manifests / Helm chart
- CI/CD pipeline implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant
- VPC / subnet / autoscaling implementation
- API Gateway / OAuth2 platform

## 8. 风险

1. 如果把 `auth anomaly review` 误写成 MFA rollout truth，会把未实现能力写成已实现
2. 如果把 `tenant data governance` 写成 infra-level isolation，会破坏当前主干真值
3. 如果把 `enterprise infra planning` 直接写成 Docker / Kubernetes / CI implementation，会把 planning PR 误写成平台化实现
4. 如果 Phase 2 顺手扩到 workflow / execution plane，会破坏当前范围控制

## 9. 阶段计划

### Phase 0

- 创建 clean worktree / branch
- 冻结 PR67 三段式计划
- docs discoverability 同步

### Phase 1

- richer auth anomaly follow-through deeper slice
- broader session revoke / auth-control consistency next slice
- full validation

### Phase 2

- remaining tenant data governance application-layer closure slice
- org-admin support-pack / settings governance deeper readout
- full validation

### Phase 3

- enterprise infra planning freeze / baseline / report
- README / docs / guards 同步
- full validation

## 10. 验证

每个实现阶段都跑完整验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR65 - Auth / Session Continuation And Deploy Baseline Contract Follow-through Next Slice

更新时间：2026-04-06
状态：Completed
范围：在 PR64 的 auth/session continuation baseline 之上，继续收紧 anomaly follow-through、broader revoke governance 和 org-admin auth controls consistency；同时把 deploy baseline contract 补成更明确的 deployment-facing contract truth，但继续明确递延 Docker / Kubernetes / CI implementation

## 1. 目标

PR65 只做两件事：

1. 在 PR64 基线之上继续收紧 auth/session continuation
2. 继续把 deploy baseline contract 收成更清楚的 deployment-facing truth

它不是：

- Docker implementation
- Kubernetes manifests / Helm chart
- CI/CD pipeline implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant

## 2. 当前 freeze truth

当前 PR65 基线继承：

- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_BASELINE_V1.md`

当前已经成立：

- DB-backed `AuthSession`
- `providerType` seam
- `revokeWorkspaceAuthSessionsByScope`
- 第一轮 richer auth anomaly review
- 第一轮 org-admin auth control consistency readout
- deploy baseline contract 的 environment/config/release/rollback wording

当前明确未成立：

- Docker / docker-compose / Helm chart / Kubernetes manifests
- `.github/workflows/*` CI baseline
- SSO / SAML / SCIM / MFA rollout
- full enterprise IAM
- infra-level tenant isolation

## 3. 本轮要证明什么

PR65 要证明三件事：

1. PR64 的 auth/session continuation 不是一次性冻结点，还可以继续补 anomaly follow-through 与 revoke governance，而不需要跳到 SSO / SCIM
2. org-admin auth controls 可以继续从“看见 posture”推进到“更清楚地管控和解释 posture”
3. deploy baseline contract 可以继续补 deployment-facing follow-through，但仍应诚实标记为 contract truth，不是 infra implementation

## 4. 精确闭环

`auth/session hardening baseline -> richer auth/session continuation -> deploy baseline contract follow-through -> deferred infra/platform implementation`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / SSO / SCIM / Kubernetes platform

## 6. 范围

- `lib/auth/session.ts`
- `lib/auth/session.test.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/org-admin-governance.test.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- `docs/product/HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `docs/product/HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_BASELINE_V1.md`
- `docs/reviews/HELM_AUTH_SESSION_CONTINUATION_AND_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_NEXT_SLICE_PLAN_V1.md`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 7. 不做

- Docker / docker-compose implementation
- Kubernetes manifests / Helm chart
- CI/CD pipeline implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- API Gateway / OAuth2 platform
- enterprise org hierarchy
- execution authority expansion

## 8. 风险

1. 如果把 “auth anomaly review” 误写成 MFA rollout truth，会把当前仓库没有的能力写成已实现
2. 如果把 broader revoke scope 设计成高风险 bulk session shutdown，会影响 workspace 内正常受控试点使用
3. 如果把 deploy baseline contract follow-through 写成 Docker / Kubernetes / CI implementation，会破坏当前 contract-only truth
4. 如果 org-admin auth controls 只补动作、不补解释，会把 operator 面变成“能点但解释不清”

## 9. 阶段计划

### Phase 0

- 创建 PR65 clean worktree / branch
- 计划冻结
- docs discoverability 同步

### Phase 1

- richer auth anomaly follow-through
- broader revoke scope next slice
- org-admin auth controls consistency continuation

### Phase 2

- deploy baseline contract follow-through next slice
- 明确 deployment prerequisites、secret/config ownership、release/rollback/verification truth

### Phase 3

- baseline / report / README / docs index / self-check / boundary-check
- 标准验证链

## 10. 验证

计划阶段最小验证：

- `npm run self-check`
- `npm run check:boundaries`

实现阶段默认恢复完整验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR66 - Auth Anomaly Follow-through And Session Governance Deeper Slice

更新时间：2026-04-06
状态：Completed
范围：继续收紧 richer auth anomaly follow-through、broader revoke scope 与 org-admin auth-control consistency，并把 deploy baseline contract 的边界 truth 收口到 docs / guards

## 1. 本轮目标

1. 增加 `MISSING_WORKSPACE_SWITCH_MARKER` revoke scope
2. 区分 `entrySourcePage` 与 `actionSourcePage`
3. 将 `missingWorkspaceSwitchMarkerSessionCount` / `hasMissingWorkspaceSwitchMarker` 接入 org-admin / settings
4. 继续保持 current deploy baseline contract is docs-and-guard truth, not infrastructure platformization

## 2. 本轮完成

- `lib/auth/session-governance.ts` 增加 `hasAuthSessionMissingWorkspaceSwitchMarker`
- `lib/auth/session.ts` 增加 `MISSING_WORKSPACE_SWITCH_MARKER`
- `getCurrentWorkspaceSession()` 在隐式 realignment 时补 `lastWorkspaceSwitchAt`
- rotate 审计区分 `entrySourcePage` 与 `actionSourcePage`
- `org-admin-governance` 增加 `missingWorkspaceSwitchMarkerSessionCount`
- settings surface 增加 `hasMissingWorkspaceSwitchMarker` 与 bulk revoke 入口
- baseline / report / README / docs / self-check / boundary-check 已同步

## 3. 保留边界

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- auth-session anomaly review is operator-facing review truth, not full enterprise IAM
- current deploy baseline contract is docs-and-guard truth, not infrastructure platformization

## 4. 刻意未做

- Docker / Kubernetes / Helm chart / CI implementation remain intentionally not done
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- full enterprise IAM

## 11. 显式递延项

- Docker / docker-compose implementation
- Kubernetes manifests / Helm charts
- CI/CD pipeline implementation
- VPC / subnet / autoscaling plane
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant

# PR61 - Auth / Session Hardening Completion

更新时间：2026-04-06
状态：Completed
范围：补完 DB-backed auth session 的 rotation / revoke / audit，增加 future enterprise identity provider seam，并把 org-admin auth controls consistency 收成当前 main 的第一轮稳定基线

## 1. 目标

这轮不做 SSO、SCIM、MFA rollout、full RBAC 或 deploy/infrastructure 平台化。

这轮只做四件事：

1. 补完 `AuthSession` 的 rotation / revoke / audit 生命周期
2. 为未来 enterprise identity 预留最小 `auth provider seam`
3. 补第一轮 auth anomaly review truth，并接回 org-admin support-pack / settings governance
4. 补 org-admin 对 auth controls 的一致性管理，不再只读 session posture

## 2. 当前 truth

当前 current-main 已成立：

- DB-backed `AuthSession` 是当前登录 session 真值
- cookie 只承担 opaque session handle，不承担身份真值
- login 会创建新 session，并撤销同 cookie 下的旧 session
- logout 会 revoke 当前 session
- workspace switch 会写回 `activeWorkspaceId` 并落 audit
- org-admin governance 已能显示 active auth sessions 和 auth-session audit

当前仍缺：

- 没有显式 `AUTH_SESSION_ROTATED` truth
- 没有 future enterprise identity provider seam
- 没有第一轮 auth anomaly summary / operator readout
- org-admin 侧还没有明确的一致性 auth control 动作

## 3. 范围

- `prisma/schema.prisma`
- `lib/auth/session.ts`
- `lib/auth/session.test.ts`
- `lib/auth/org-admin-governance.ts`
- `features/auth/actions.ts`
- `features/participant-portal/actions.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `docs/product/*baseline*`
- `docs/reviews/*plan*`
- `docs/reviews/*report*`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 4. 不做

- SSO / SAML / SCIM / domain claim
- MFA rollout
- full RBAC
- enterprise org hierarchy
- API Gateway / OAuth2 platform
- Docker / Kubernetes / CI/CD infra baseline
- execution authority expansion

## 5. 风险

1. 如果把 “future enterprise seam” 直接做成 SSO/SCIM implementation，会把这轮从 auth hardening 拉成平台工程
2. 如果 rotation 规则不明确，会把 session 生命周期变成隐式副作用，增加回归风险
3. 如果 org-admin auth control 只补读数、不补管理动作，这轮会停在“看得见但管不了”
4. 如果 anomaly review 口径写太重，会把当前受控试点 auth substrate 误写成完整企业安全监控

## 6. 阶段

### Phase 0

- 创建 PR61 plan 文档
- 更新 `PLANS.md`
- 冻结当前 auth/session truth、范围和验证合同

### Phase 1

- 增加 auth provider seam
- 增加 session rotation truth 和 audit
- 明确 revoke helper 的生命周期语义

### Phase 2

- 增加 org-admin auth control consistency 动作
- 增加 auth anomaly summary
- 接回 settings / org-admin support-pack

### Phase 3

- baseline / report / README / docs index / self-check / boundary-check
- 全验证链

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# Enterprise Readiness Planning

更新时间：2026-04-06
状态：Phase 1 Completed；deploy contract follow-through next layer
范围：enterprise-readiness planning only for auth / deploy / tenant hardening; no implementation in this round

## 1. 目标

把下一阶段从“直接上 SSO / K8s / SCIM / db-per-tenant”改成当前 Helm 可以承接的企业化推进顺序。

这轮只做计划，不做实现：

1. 先确认 current-main 已经成立的多租户 / 多用户 / tenant governance truth
2. 明确哪些企业能力现在能做，哪些必须递延
3. 把 auth、deploy、tenant governance、compliance 拆成可验证阶段
4. 明确环境基线：后续实现必须在干净 worktree 上推进，不在当前脏根仓库直接施工

## 2. 当前 truth

当前 current-main 已成立：

- `workspace-first / membership-backed` 多租户边界
- DB-backed auth session substrate
- fixed-role capability matrix + tenant ownership governance
- org-admin lifecycle first slice
- export / retention / delete / support-pack 的治理 readout
- webhook callback tenant mapping / anomaly follow-through first slice

当前 current-main 明确未成立：

- full RBAC
- SSO / SCIM / domain claim
- schema-per-tenant / db-per-tenant
- Docker / Kubernetes / Helm chart / `.github/workflows`
- API Gateway / OAuth2 platform
- VPC / subnet-per-tenant / infra autoscaling plane

## 3. 风险

1. 如果直接按“SSO + MFA + SCIM + Docker + K8s + VPC + db-per-tenant”开工，会把当前应用治理线直接拉成平台工程
2. 当前仓库根目录不是干净工作区，直接在根仓库推进会混入无关改动
3. 当前仓库里没有现成 Docker / K8s / CI baseline，强行进入基础设施实现会先变成补环境，而不是补产品能力
4. 当前租户隔离仍主要依赖 application-layer `workspace` scoping；在没有更深治理收口前，直接改数据库拓扑风险高

## 4. 实施顺序

1. `Environment hygiene + planning freeze`
2. `Auth / session hardening completion`
3. `Deploy baseline contract`
4. `Tenant data governance hardening`
5. `Enterprise integration seams`
6. `Infrastructure platformization (deferred unless required)`

## 5. 验证

计划阶段只要求：

- 文档 truth 自洽
- 与 current-main 边界一致
- 不把未实现能力写成已实现

后续任何实现阶段默认恢复标准验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR63 - Finalize Deploy Baseline Contract And Continue Auth / Session Hardening

更新时间：2026-04-06
状态：Phase 1 Completed；deploy baseline contract landed；auth/session continuation deferred
范围：deploy baseline contract follow-through 已落地；auth/session hardening continuation 保持下一层计划；明确递延 Docker / Kubernetes / CI implementation

## 1. 目标

PR63 只做两件事：

1. 把 `deploy baseline contract` 从 enterprise-readiness 方向判断，收成当前仓库可以诚实承接的 follow-through 合同
2. 在 PR61 的 auth/session hardening baseline 之上，继续定义下一层 anomaly review、session governance refinement 和 org-admin auth control 一致性

它不是：

- Docker implementation
- Kubernetes manifests / Helm chart
- CI/CD pipeline implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant

## 2. 当前 freeze truth

当前 PR63 基线继承：

- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_ENTERPRISE_READINESS_AUTH_DEPLOY_AND_TENANT_HARDENING_PLAN_V1.md`
- `lib/auth/session.ts`

当前已经成立：

- DB-backed `AuthSession`
- session create / rotate / revoke / workspace-switch lifecycle
- `providerType` seam
- org-admin auth anomaly readout first slice

当前明确未成立：

- Dockerfile / docker-compose / Helm Chart / Kubernetes manifests
- `.github/workflows/*` CI baseline
- SSO / SAML / SCIM / MFA rollout
- full enterprise IAM

仓库扫描结果：当前分支下没有 `Dockerfile`、`docker-compose.yml`、`Chart.yaml`、`.github/workflows/*`、`k8s/`、`kubernetes/`

## 3. 本轮要证明什么

PR63 分两层证明：

1. Phase 1 已证明 Helm 当前已经具备写出 `deploy baseline contract` 的真实前提，但不应把它写成 infra implementation 已完成
2. Phase 2 保持定义题：PR61 之后的 auth/session 基线可以继续进入 anomaly review 和 governance refinement，而不需要跳到 SSO / SCIM
3. README / docs index / planning truth 会明确表达：Docker / Kubernetes / CI implementation 仍递延

## 4. 精确闭环

`auth/session hardening baseline -> deploy baseline contract follow-through -> richer auth/session governance plan -> deferred infra platformization`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / SSO / SCIM / Kubernetes platform

## 6. 阶段计划

### Phase 0

- 创建 PR63 clean worktree / branch
- 计划冻结
- 索引同步

### Phase 1

- 已完成：
- 定义 `deploy baseline contract follow-through` 的真实范围
- 明确 deploy contract、secrets/config、release/rollback、environment matrix 的文档合同

### Phase 2

- 递延：
- 定义 auth/session continuation 的真实范围
- 明确 anomaly review、broader revoke scope、org-admin auth controls consistency 的下一层目标

### Phase 3

- 已完成：
- baseline / report 文档骨架
- guards / docs discoverability 对齐
- draft PR

## 7. 验证

Phase 1 已执行标准验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 显式递延项

- Docker / docker-compose implementation
- Kubernetes manifests / Helm charts
- CI/CD pipeline implementation
- VPC / subnet / autoscaling plane
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant

# PR64 - Finalize Auth / Session Continuation And Deploy Baseline Contract Follow-through

更新时间：2026-04-06
状态：Planned
范围：继续收 auth/session anomaly review 与 revoke governance，并把 deploy baseline contract 从“已定义”推进到更明确的 deployment-facing follow-through；不进入 Docker / Kubernetes / CI implementation

## 1. 目标

PR64 只做两件事：

1. 在 PR61 auth/session baseline 之上，继续补 richer anomaly review、broader revoke scope 与 org-admin auth controls consistency
2. 在 PR63 deploy baseline contract 之上，继续补 deployment-facing follow-through truth，但不进入 infra implementation

它不是：

- Docker implementation
- Kubernetes manifests / Helm chart
- CI/CD pipeline implementation
- SSO / SAML / SCIM rollout
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant

## 2. 当前 freeze truth

当前 PR64 基线继承：

- `HELM_AUTH_SESSION_HARDENING_COMPLETION_BASELINE_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_V1.md`
- `HELM_DEPLOY_BASELINE_CONTRACT_FOLLOW_THROUGH_AND_AUTH_SESSION_HARDENING_REPORT_V1.md`
- `lib/auth/session.ts`

当前已经成立：

- DB-backed `AuthSession`
- session create / rotate / revoke / workspace-switch lifecycle
- `providerType` seam
- org-admin auth anomaly readout first slice
- deploy baseline contract 的 environment matrix / config / release / rollback wording

当前明确未成立：

- Docker / docker-compose / Helm chart / Kubernetes manifests
- `.github/workflows/*` CI baseline
- SSO / SAML / SCIM / MFA rollout
- full enterprise IAM

## 3. 本轮要证明什么

PR64 证明两件事：

1. PR61 的 auth/session baseline 可以继续进入 anomaly review 与 revoke governance 的下一层，而不需要跳到 SSO / SCIM
2. PR63 的 deploy baseline contract 可以继续补 deployment-facing follow-through，但仍应诚实标注为 contract，不是 infra implementation

## 4. 精确闭环

`auth/session hardening baseline -> deploy baseline contract -> richer auth/session continuation -> deferred infra/platform implementation`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full enterprise IAM / SSO / SCIM / Kubernetes platform

## 6. 阶段计划

### Phase 0

- 创建 PR64 clean worktree / branch
- 计划冻结
- docs discoverability 同步

### Phase 1

- auth anomaly review richer readout
- broader revoke scope
- org-admin auth control consistency continuation
- 已完成

### Phase 2

- deploy baseline contract follow-through
- 明确 deployment prerequisites、secrets/config ownership、release/rollback/verification contract

### Phase 3

- baseline / report
- README / docs index / self-check / boundary-check
- 标准验证链

## 7. 验证

实现阶段默认执行：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 显式递延项

- Docker / docker-compose implementation
- Kubernetes manifests / Helm charts
- CI/CD pipeline implementation
- VPC / subnet / autoscaling plane
- SSO / SAML / SCIM
- MFA rollout
- full RBAC
- schema-per-tenant / db-per-tenant

# PR60 - Remaining Service Governance And Webhook Callback Anomaly Deeper Slice

更新时间：2026-04-06
状态：In Progress
范围：继续收 remaining non-route tenant-sensitive service seam、深化 org-admin support-pack 的 retention/delete/export follow-through、并加强 webhook callback authenticity / anomaly / tenant-mapping governance

## 1. 目标

PR60 继续保持 `workspace-first`、`membership-backed`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 收回 PR59 之后仍剩余的 non-route tenant-sensitive service write seam
2. 深化 org-admin support-pack 对 `retention / delete / export` 的 latest marker、owner attribution、follow-through 和 exception note
3. 强化 webhook callback 的真实性异常、tenant mapping 例外和 unresolved / duplicate / verification-failure / exception 的治理表达

## 2. 当前 truth

继承 PR42-PR59：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- session-backed sensitive write route 已补 tenant ownership helper
- `correction.service`、`imports/index.ts`、`policies/engine.ts` 已进入 service-governance seam
- payment webhook callback 已具备 callback event substrate、tenant mapping 和 duplicate / unresolved / verification-failure / exception follow-through truth
- org-admin support-pack 已能显示 export / delete / retention 和 webhook callback 的 deeper governance readout
- `revenue-attribution` actual ledger write / reversal write 已补 contribution-registry capability re-check
- manual settlement reversal 已显式传 actor governance 到 revenue attribution reversal
- public program catalog 在 multi-workspace 下已停止 arbitrary bootstrap；当前仅在恰好一个 active workspace 时允许 foundation bootstrap
- `identity-resolution.service` 的 resolve/read/match/write seam 与 import conflict follow-through seam 已进入 capability / ownership governance

当前仍需下一层：

- remaining non-route tenant-sensitive service inventory 仍未完全收口，当前至少还剩：
  - `lib/billing/revenue-attribution.ts` broader service seam / follow-through
  - `lib/billing/program-catalog.ts` explicit host-workspace model
- `export / retention / delete` 当前仍偏 governance snapshot，不是更深的 owner attribution / anomaly / follow-through 审计闭环
- webhook callback 已有 tenant mapping truth，但 authenticity / duplicate / unresolved / exception 的 operator-facing exception posture 仍可更清楚

## 3. 范围

- `lib/billing/revenue-attribution.ts`
- `lib/billing/program-catalog.ts`
- `lib/auth/service-governance.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/payment-webhook-governance.ts`
- `lib/auth/payment-webhook-callback-store.ts`
- `lib/billing/integration.ts`
- `lib/imports/identity-resolution.service.test.ts`
- `lib/billing/revenue-attribution.test.ts`
- `lib/billing/foundation-service-governance.test.ts`
- `app/api/billing/stripe/webhook/route.ts`
- `app/api/billing/alipay/notify/route.ts`
- `app/api/billing/wechat-pay/notify/route.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- execution authority expansion

## 5. 风险

1. 如果把 telemetry write、system-owned runtime write、external callback write 混进 tenant-sensitive service write 口径，会制造假覆盖率
2. 如果 webhook callback 的 unresolved / duplicate / exception 被写成 workspace-scoped audit truth，会混淆 external callback truth 与 tenant truth
3. 如果 `revenue-attribution` / `program-catalog` / `identity-resolution.service` 只做文档补充，不做 capability/ownership 收口，会继续留下“计划已列入、实现未真正治理”的空洞

## 6. 阶段

### Phase 0

- 创建 PR60 计划文档
- 更新 `PLANS.md`
- 冻结 remaining non-route tenant-sensitive service write inventory

### Phase 1

- 为 remaining high-risk non-route service write 增加 capability / ownership seam
- 诚实标注 system / telemetry / callback 例外

### Phase 2

- 深化 org-admin support-pack / settings governance 对 `export / retention / delete` 的 readout
- 增加 owner attribution、follow-through counter、latest marker 和 exception note

### Phase 3

- 加强 webhook callback authenticity / anomaly governance
- 强化 verification failure / duplicate / unresolved / exception 到 workspace truth 的边界表达

### Phase 4

- baseline / report / README / docs index / self-check / boundary-check
- 全验证链
- stacked PR

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR57 - Finalize Non-Route Write Governance And Strengthen Webhook Callback

更新时间：2026-04-05
状态：In Progress
范围：收紧 remaining non-route tenant-sensitive write seam、深化 org-admin support-pack 的 retention/delete/export follow-through、加强 webhook callback authenticity / anomaly / tenancy governance

## 1. 目标

PR57 继续保持 `workspace-first`、`membership-backed`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 冻结并收回 remaining non-route tenant-sensitive service write seam
2. 深化 org-admin support-pack 对 export / retention / delete 的 owner attribution、follow-through counter、exception note 和 audit truth
3. 加强 webhook callback 的真实性、异常状态、tenant mapping 与 workspace-scoped audit 分界

## 2. 当前 truth

继承 PR42-PR56：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- session-backed sensitive write route 已补 tenant ownership helper
- 第一批 high-risk non-route tenant-sensitive service write 已进入 shared `service-governance` seam
- payment webhook callback 已具备 callback event substrate、tenant mapping 和 unresolved / duplicate / exception follow-through truth
- org-admin support-pack 已能显示 export / delete / retention 和 webhook callback 的 deeper governance readout

当前仍需下一层：

- remaining non-route tenant-sensitive service write 还没有形成最终 inventory truth，哪些已治理、哪些仍未治理、哪些是刻意例外还需要最终收口
- export / retention / delete 当前仍偏 support-pack snapshot，不是更深的 owner attribution / anomaly / follow-through 审计闭环
- webhook callback 已有 tenant mapping truth，但真实性失败、重复、未解析、异常到 workspace truth 的边界还需要更强约束与更清楚 readout

## 3. 范围

- `lib/billing/revenue-attribution.ts`
- `lib/billing/program-catalog.ts`
- `lib/imports/index.ts`
- `lib/imports/identity-resolution.service.ts`
- `lib/memory/correction.service.ts`
- `lib/policies/engine.ts`
- `lib/auth/service-governance.ts`
- `lib/auth/org-admin-governance.ts`
- `lib/auth/payment-webhook-governance.ts`
- `lib/auth/payment-webhook-callback-store.ts`
- `lib/billing/integration.ts`
- `app/api/billing/stripe/webhook/route.ts`
- `app/api/billing/alipay/notify/route.ts`
- `app/api/billing/wechat-pay/notify/route.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- execution authority expansion

## 5. 风险

1. 如果把 system-owned runtime write、telemetry write、external callback write 混进 tenant-sensitive service write 口径，会制造假覆盖率
2. 如果 webhook callback 的 unresolved / duplicate / exception 被错误写进 workspace-scoped audit，会混淆 external callback truth 与 tenant truth
3. 如果 retention / delete 只补 support-pack 文案，不补 latest marker、owner attribution 和 exception note，治理仍不够可信

## 6. 阶段

### Phase 0

- 创建 PR57 计划文档
- 更新 `PLANS.md`
- 冻结 remaining non-route tenant-sensitive service write inventory

### Phase 1

- 为 remaining high-risk non-route service write 增加 capability / ownership seam
- 诚实标注 system / telemetry / callback 例外

### Phase 2

- 深化 org-admin support-pack / settings governance 对 export / retention / delete 的 readout
- 增加 owner attribution、follow-through counter、latest marker 和 exception note

### Phase 3

- 加强 webhook callback authenticity / anomaly governance
- 强化 verification failure / duplicate / unresolved / exception 到 workspace truth 的边界表达

### Phase 4

- baseline / report / README / docs index / self-check / boundary-check
- 全验证链
- stacked PR

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR53 - Capability And Tenant Ownership Governance

更新时间：2026-04-05
状态：Completed
范围：盘点并补齐 current-main sensitive write route 的 capability governance 与 tenant ownership guard，并把 export / delete / retention deeper governance 收到 org-admin support pack 与 settings/operator surface

## 1. 目标

PR53 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 列出并补齐当前剩余 sensitive write route 的 tenant ownership 断言与 capability governance
2. 把 export / delete / retention 的 deeper governance 视图、owner attribution、workspace isolation assertion 收进 org-admin support pack
3. 在 settings/operator surface 上展示治理状态与 audit 统计

## 2. 当前 truth

继承 PR42-PR52：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- 多批高风险 write path 已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped export / delete / retention posture 已有前几层 readout

当前仍需下一层：

- 部分 sensitive write route 还缺少显式 tenant ownership helper
- export / delete / retention 的 latest audit marker 还缺 owner attribution 和 isolation assertion
- 现有过窄 PR53 plan 不能准确描述本轮真实实现范围

## 3. 范围

- `lib/auth/tenant-ownership.ts`
- `app/api/memory/export/route.ts`
- `app/api/memory/facts/*`
- `app/api/blockers/*`
- `app/api/commitments/*`
- `app/api/conversation-capture/*`
- `app/api/runtime/*`
- `app/api/helm-v2/runtime/*`
- `app/api/imports/*`
- `app/api/recommendations/[id]/feedback/route.ts`
- `app/api/evolution/strategy-suggestions/*`
- `features/recommendations/actions.ts`
- `features/meetings/actions.ts`
- `lib/auth/org-admin-governance.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- execution authority expansion

## 5. 风险

1. 如果 ownership 只补 route 不补 support-pack/readout，治理 truth 仍不完整
2. 如果 provider callback / analytics track route 被混入 tenant-object ownership 口径，会造成假覆盖率
3. 如果 export route 的 workspace scope 仍依赖裸 query string，会留下 400/404 语义和 type safety 问题

## 6. 阶段

### Phase 0

- 扩计划文档与 `PLANS.md`
- 盘点 inventory 与例外项

### Phase 1

- 补 tenant ownership helper 和 export route type/ownership correctness

### Phase 2

- 扩 org-admin governance summary / support-pack deeper view

### Phase 3

- 更新 settings/operator surface

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR56 - Broader Non-Route Sensitive Write Governance And Org-Admin Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：继续收紧 remaining non-route tenant-sensitive service write、org-admin support-pack 的 retention/delete deeper follow-through，以及 webhook callback authenticity / tenancy anomaly governance

## 1. 目标

PR56 继续保持 `workspace-first`、`membership-backed`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 盘点并收回剩余高风险 non-route tenant-sensitive service write seam
2. 深化 org-admin support-pack 对 export / retention / delete 的 owner、audit、follow-through 与 exception posture
3. 加强 external webhook callback 的 authenticity / tenancy mapping 异常治理表达

## 2. 当前 truth

继承 PR42-PR55：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- session-backed sensitive write route 已补 tenant ownership helper
- payment webhook callback 已具备 callback-event follow-through truth
- 第一批 non-route tenant-sensitive service write 已进入 shared service-governance seam
- org-admin governance support-pack 已能显示 export / delete / retention 和 webhook callback 的 latest marker / follow-through readout

当前仍需下一层：

- broader non-route tenant-sensitive service write inventory 仍未完整冻结
- retention / delete 仍偏 governance snapshot，不是更深的 owner attribution / follow-through slice
- external webhook callback 已有 mapping truth，但 duplicate / unresolved / exception 的异常治理还不够系统化

## 3. 范围

- `lib/billing/manual-settlement.ts`
- `lib/billing/revenue-attribution.ts`
- `lib/billing/program-catalog.ts`
- `lib/imports/index.ts`
- `lib/imports/identity-resolution.service.ts`
- `lib/memory/meeting-memory-pipeline.service.ts`
- `lib/memory/briefing.service.ts`
- `lib/memory/blocker.service.ts`
- `lib/memory/commitment.service.ts`
- `lib/memory/memory-fact.service.ts`
- `lib/policies/engine.ts`
- `lib/auth/org-admin-governance.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- webhook authenticity / mapping helper 与 billing callback governance seam
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- execution authority expansion

## 5. 风险

1. 如果把 system-owned runtime write 和 session-backed tenant-sensitive write 混成同一治理口径，会造成假覆盖率
2. 如果 retention / delete 只补 support-pack 文案，不补 owner / audit / exception posture，治理仍然不够可信
3. 如果 webhook callback 异常治理直接写成 workspace audit truth，会继续混淆外部 callback 和内部租户写

## 6. 阶段

### Phase 0

- 创建 PR56 计划文档
- 更新 `PLANS.md`
- 冻结第一轮 remaining non-route tenant-sensitive service write inventory

### Phase 1

- 为第一批 remaining non-route sensitive service write 补 capability / ownership seam
- 诚实标注 system / telemetry / callback 例外

### Phase 2

- 扩 org-admin support-pack / settings governance readout
- 深化 export / retention / delete owner attribution、latest marker、follow-through 和 exception note

### Phase 3

- 扩 webhook callback authenticity / tenancy anomaly governance
- 强化 unresolved / duplicate / exception posture 的 operator-readable truth

### Phase 4

- baseline / report / README / docs index / self-check / boundary-check
- 全验证链

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR55 - Webhook Callback And Tenant Governance Follow-Through

更新时间：2026-04-05
状态：Completed
范围：在 PR54 基础上继续收紧 webhook callback follow-through、remaining non-route sensitive write inventory，以及 export / delete / retention deeper governance readout

## 1. 目标

PR55 继续保持 `workspace-first`、`membership-backed`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 webhook callback 的 unresolved / duplicate / exception posture 收成更清楚的 tenant governance follow-through truth
2. 盘点并收回第一批 remaining non-route sensitive write seam
3. 深化 export / delete / retention 的 owner attribution、latest marker、workspace isolation assertion 和 support-pack follow-through

## 2. 当前 truth

继承 PR42-PR54：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- current-main session-backed sensitive write route 已补 tenant ownership helper
- payment webhook callback 已补 provider authenticity、tenant mapping 和 unresolved posture
- OAuth callback GET write path 已统一进入 workspace capability + membership ownership seam
- org-admin governance support-pack 已能显示 export / delete / retention latest marker 与 webhook governance latest marker

当前仍需下一层：

- webhook governance 仍缺 duplicate / exception / unresolved follow-through 的更深治理表达
- broader non-route sensitive write seam 还缺诚实 inventory 和第一批 capability / ownership 收口
- export / delete / retention 仍偏 snapshot，不是更深的 governance follow-through

## 3. 范围

- `lib/auth/payment-webhook-governance.ts`
- `app/api/billing/*`
- `lib/billing/integration.ts`
- `lib/reports/index.ts`
- `lib/recommendations/recommendation.service.ts`
- `lib/recommendations/recommendation-feedback.service.ts`
- `lib/imports/crm-orchestrator.service.ts`
- `lib/imports/warmup.service.ts`
- `lib/conversation-capture/*`
- `lib/auth/org-admin-governance.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- execution authority expansion

## 5. 风险

1. 如果把 webhook callback 例外直接写成 session-backed tenant ownership，会混淆外部 provider callback 和内部 user write
2. 如果不先冻结 non-route inventory，就很容易把局部治理写成“全部治理已完成”
3. 如果 export / delete / retention 只补 UI 文案，不补 latest marker / owner attribution / assertion truth，support-pack 仍然不够可信

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 固化第一轮 non-route sensitive write inventory

### Phase 1

- 补 webhook callback unresolved / duplicate / exception follow-through
- 保持 external callback exception 边界诚实

### Phase 2

- 收第一批 remaining non-route sensitive write seam
- 纳入 capability / ownership governance

### Phase 3

- 扩 org-admin support-pack / settings governance readout
- 强化 export / delete / retention owner attribution、latest marker、workspace isolation assertion

### Phase 4

- baseline / report / README / docs index / self-check / boundary-check
- 全验证链

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR52 - Insight Governance Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：把 weekly report generation、recommendation feedback、strategy suggestion API write 收进统一 capability seam，并补 org-admin support-pack 对 insight governance follow-through 的 readout

## 1. 目标

PR52 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 weekly report generation、recommendation feedback user entry、strategy suggestion accept / dismiss API write 收回统一 capability seam
2. 把这组 insight governance 动作纳入 org-admin governance support-pack 和 settings governance readout
3. 在 reports / settings 相关 surface 上补 capability-aware manage / read-only posture，避免只有 server 端 deny

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46 / PR47 / PR48 / PR49 / PR50 / PR51：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import / commercial / workspace data / governed action 的多批高风险写路径已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有前几层 readout

当前仍需下一层：

- reports 中的 weekly report generation 仍只依赖 login + workspace session，没有进入统一 capability seam
- recommendations 的 feedback write path 仍只依赖 login + workspace session，没有进入统一 capability helper
- strategy suggestion 的 API write route 仍未对齐 settings action 已有的 policy capability
- org-admin governance support-pack 还看不到 report generation / recommendation feedback / strategy suggestion adoption follow-through
- reports 相关入口还缺 capability-aware read-only posture

## 3. 范围

- `lib/auth/insight-governance.ts`（新增）
- `lib/auth/authorization.ts`
- `lib/auth/org-admin-governance.ts`
- `features/reports/actions.ts`
- `features/reports/reports-client.tsx`
- `app/(workspace)/reports/page.tsx`
- `features/recommendations/actions.ts`
- `app/api/recommendations/[id]/feedback/route.ts`
- `app/api/evolution/strategy-suggestions/[id]/accept/route.ts`
- `app/api/evolution/strategy-suggestions/[id]/dismiss/route.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- broader recommendation platform / BI platform
- continuity surface 深挖
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 insight governance 继续散落在局部 route / action 中，capability drift 会重新出现
2. 如果 recommendation feedback / strategy suggestion adoption 仍只靠页面语义，会留下 tenant-sensitive adaptive write 的灰区
3. 如果 support-pack 仍看不到 insight-governance follow-through，租户治理 truth 会继续低估 reporting / recommendation 真实写面
4. 如果本轮顺手扩成 broader recommendation platform、full RBAC 或 execution surface，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 新增 shared insight-governance helper
- 把 reports / recommendation feedback / strategy suggestion API write 接入 capability seam

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 insight governance 30d 计数与 latest marker

### Phase 3

- 在 reports / settings governance surface 上增加 capability-aware posture
- 补齐 denial wording 与 boundary notes

### Phase 4

- docs / self-check / boundary / tests / report
- 完整验证并准备 stacked PR

## 7. 验证

每阶段至少：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 明确延期项

- full RBAC / custom role builder
- enterprise IAM / SSO / SCIM
- org hierarchy / shared billing
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- broader recommendation platform / BI platform
- execution authority expansion

---

# PR51 - Action Governance Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：把 approvals / recommendations / meetings 中剩余的 governed-action、approval execution、official follow-through 写路径收进统一 capability seam，并补 org-admin support-pack 对 action governance follow-through 的 readout

## 1. 目标

PR51 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 approvals / recommendations / meetings 中剩余的高风险 governed-action、approval execution、official follow-through、meeting action edit 写路径收回统一 capability seam
2. 把这组 action governance 动作纳入 org-admin governance support-pack 和 settings governance readout
3. 在相关 surface 上补 capability-aware manage / read-only posture，避免只有 server 端 deny

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46 / PR47 / PR48 / PR49 / PR50：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import / commercial / workspace data 的第一批高风险写路径已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有前几层 readout

当前仍需下一层：

- approvals 中的 approve / reject / convert manual / enable auto-policy 仍只依赖 login + workspace session，没有进入统一 capability seam
- recommendations 中的 governed action create 仍只依赖 login + workspace session，没有进入 shared action governance helper
- meetings 中的 governed action generate、official follow-through update、meeting action item edit 仍缺 capability gate
- org-admin governance support-pack 还看不到这组 action governance follow-through
- approvals / meeting detail 相关入口还缺 capability-aware read-only / review-first posture

## 3. 范围

- `lib/auth/action-governance.ts`（新增）
- `lib/auth/authorization.ts`
- `lib/auth/org-admin-governance.ts`
- `features/approvals/actions.ts`
- `features/recommendations/actions.ts`
- `features/meetings/actions.ts`
- `features/approvals/page-loader.ts`
- `features/approvals/approvals-client.tsx`
- `features/meetings/page-loader.ts`
- `features/meetings/meeting-detail-client.tsx`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- continuity surface 深挖
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 action governance 继续散落在局部 server action 中，capability drift 会重新出现
2. 如果 governed-action create / approval execution / official follow-through update 仍只靠页面语义，会留下 tenant-sensitive write path 的灰区
3. 如果 support-pack 仍看不到 action governance follow-through，租户治理 truth 会继续低估真实高风险操作
4. 如果本轮顺手扩成 full approval platform、full RBAC 或 broader execution surface，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 新增 shared action-governance helper
- 把 approvals / recommendations / meetings 的剩余高风险写路径接入 capability seam

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 action governance 的 30d 计数与 latest marker

### Phase 3

- 在 approvals / meeting detail / settings governance surface 上补 capability-aware manage / read-only posture
- 补 capability-aware wording 与 boundary notes

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR50 - Workspace Data Governance Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：把 workspace 内剩余 tenant-sensitive 数据写路径和 customer-success 内部动作收进统一 capability seam，并补 org-admin support-pack 对 workspace data governance 的 follow-through

## 1. 目标

PR50 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 workspace / opportunities / inbox / contacts / companies / customer-success handoff 中剩余的高风险 tenant-sensitive 写路径收回统一 capability seam
2. 把这组 workspace data governance 动作纳入 org-admin governance support-pack 和 settings governance readout
3. 把相关 operator / UI posture 补成 capability-aware read-only / review-first，避免只有 server 端 deny

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46 / PR47 / PR48 / PR49：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import / participant portal / settlement / support-pack 第一批高风险写路径已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有前几层 readout

当前仍需下一层：

- workspace / opportunity / inbox / contact / company / customer-success handoff 仍有一批 tenant-sensitive 写路径只依赖 login + workspace scoping，没有进入统一 capability seam
- customer-success 内部动作的 approve / execute 还没有被明确收进 capability-aware internal governance boundary
- org-admin governance summary 还没有把 workspace data governance 这组真实业务写动作单列出来，support-pack 仍偏向 settings / memory / import / commercial governance
- 部分 UI 仍是 server-side deny，缺 capability-aware read-only / review-first posture

## 3. 范围

- `lib/auth/workspace-data-governance.ts`（新增）
- `lib/auth/authorization.ts`
- `lib/auth/org-admin-governance.ts`
- `features/workspace/actions.ts`
- `features/opportunities/actions.ts`
- `features/inbox/actions.ts`
- `features/contacts/actions.ts`
- `features/companies/actions.ts`
- `features/customer-success-handoff/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- continuity surface 深挖
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 workspace data write path 继续散落在局部 server action 中，capability drift 会重新出现
2. 如果 customer-success 内部动作仍只靠页面语义而不进治理 seam，tenant-sensitive internal execution 会留下一段未被明确授权的路径
3. 如果 support-pack 仍看不到 workspace data governance follow-through，租户治理 truth 会继续失真
4. 如果本轮顺手引入新 role model 或 enterprise tenant admin，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 新增 shared workspace-data-governance helper
- 把剩余 workspace data write path 接入 capability seam

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 workspace data governance 的 30d 计数与 latest marker

### Phase 3

- 在相关 surface 上补 capability-aware read-only / review-first posture
- 补 settings governance readout 和 boundary notes

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR49 - Commercial Governance And Support-Pack Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：把 billing / registry / participant portal / program application 收回更统一的 commercial-governance seam，并补 org-admin support-pack 对 participant self-service 和 program governance 的 follow-through

## 1. 目标

PR49 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 billing / contribution registry / participant portal / program application 这组剩余高风险商业治理写路径收回更统一的 shared helper
2. 把 org-admin governance support-pack 扩到 participant onboarding / profile update 与 program submission / review / invite 的 follow-through
3. 把 settings governance surface 补成更完整的 commercial-governance readout，避免 operator 只看到后半段审计

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46 / PR47 / PR48：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import 的第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- retention / export / delete / auth-session posture 已有 tenant-scoped readout

当前仍需下一层：

- billing / registry / participant portal / program application 还分散在多个 helper 文件里，缺一层 shared commercial-governance seam
- participant portal governance 还只覆盖 access issue / status update，没有把 onboarding / profile update 纳入 follow-through
- program governance 还只覆盖 review / invite，没有把 application submission 纳入 org-admin governance snapshot
- settings governance surface 还不能完整解释这组商业治理域的前后链路

## 3. 范围

- `lib/auth/commercial-governance.ts`（新增）
- `lib/auth/billing-governance.ts`
- `lib/auth/revenue-governance.ts`
- `lib/auth/program-applications.ts`
- `lib/auth/participant-portal.ts`
- `lib/auth/org-admin-governance.ts`
- `features/programs/actions.ts`
- `features/participant-portal/actions.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- continuity surface 深挖
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 commercial governance helper 继续分散，后续 capability drift 还会回来
2. 如果 participant portal / program governance 不补齐前半段 follow-through，support-pack 会继续低估真实 tenant-sensitive 写动作
3. 如果本轮顺手扩成 broader tenant-admin platform，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 新增 shared commercial-governance helper
- 收回 settings / participant-portal / programs 的 capability helper

### Phase 2

- 扩 `org-admin governance` summary / support-pack
- 加入 participant onboarding / profile update、program submission / review / invite 的 30d 计数与 latest marker

### Phase 3

- 在 settings surface 增加 commercial-governance posture 与 latest marker
- 补 capability-aware wording 和 boundary notes

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR48 - Tenant Governance Retention Delete Deeper Slice

更新时间：2026-04-05
状态：In Progress
范围：把 settings/governance 剩余散落授权收回统一 helper，补 org-admin support-pack 对 membership / workspace governance / auth-session / support-pack 的 follow-through，并收紧 tenant-scoped export/delete/retention 头部与审计表达

## 1. 目标

PR48 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 settings/governance 里仍然停留在局部 helper 的高风险成员与治理写路径收回统一 capability seam
2. 把 org-admin governance support-pack 扩到 membership / workspace governance / auth-session / support-pack 这几类 follow-through
3. 把 tenant-scoped export / delete / retention 路由与 UI posture 再收紧一层，避免缓存和治理表达不一致

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46 / PR47：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- memory / program / connector / import / settings 第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- retention / export / delete / auth-session / billing / registry / portal / settlement / connector / import posture 已有 tenant-scoped readout

当前仍需下一层：

- settings/actions.ts 和 settings/queries.ts 仍保留局部 capability helper，成员治理和 workspace governance 的 deny message 还没完全收回共享 seam
- org-admin governance summary 还没有把 membership / workspace governance / auth-session / support-pack 作为单独 follow-through truth 输出
- tenant-scoped memory export route 还缺 private/no-store 等头部硬化，support-pack route 也还可以补 `Vary: Cookie`
- settings surface 虽然已有 org-admin governance readout，但还没有把 membership/workspace/auth-session/support-pack 的 latest marker 和计数完整展示出来

## 3. 范围

- `lib/auth/settings-governance.ts`（新增）
- `lib/auth/org-admin-governance.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`
- `app/api/memory/export/route.ts`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader support tooling / governance center
- continuity surface 深挖
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 settings 继续保留局部 helper，后续 capability 扩展会再次分叉，成员治理和 workspace governance 的 deny 表达也会变得不一致
2. 如果 support-pack 继续不单列 membership / workspace governance / auth-session / support-pack follow-through，tenant-scoped governance truth 仍然不完整
3. 如果 export route 仍缺 private/no-store 头部，租户级导出会留下缓存与隔离表达不够硬的问题
4. 如果本轮顺手引入新 role model 或 enterprise tenant admin，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 新增 shared settings-governance helper
- 用 helper 替换 settings actions / queries 里的局部 capability 判断

### Phase 2

- 扩 `org-admin governance` summary
- 把 membership / workspace governance / auth-session / support-pack follow-through 纳入 support-pack / settings readout

### Phase 3

- 收紧 tenant-scoped export route headers
- 在 settings surface 上补 capability-aware governance posture 和 follow-through 表达

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR47 - Broader Capability Matrix And Org Admin Export Follow-Through Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：把 settings 内剩余的高风险治理写路径补成 capability-aware posture，并把 org-admin support pack 扩到 billing / registry / participant portal / settlement follow-through

## 1. 目标

PR47 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 settings 内仍然停留在局部 helper 的高风险治理写路径补成统一 capability helper
2. 把 billing / contribution registry / participant portal / manual settlement 的 manage posture 真正暴露到 settings surface，避免只有 server 端硬失败
3. 把 org-admin governance support pack 扩到 billing / registry / participant portal / settlement follow-through，让 tenant-scoped export / retention / support-pack truth 更完整

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- memory、program、connector、import 的第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- retention / export / delete / auth-session / connector / import posture 已有 tenant-scoped readout

当前仍需下一层：

- settings 里的 billing / contribution registry / participant portal / manual settlement 虽然已有 server-side capability guard，但 manage posture 没有完整暴露到 UI
- org-admin governance summary 还没有把 billing / registry / participant portal / settlement 的 30d follow-through 补齐
- support pack 还没有把这些高风险治理域作为单独 follow-through truth 输出
- 用户指令里出现了一句“continuity surface”，这是沿用旧模板的残留表达；本轮按其余明确范围执行多租户 / 多用户治理 deeper slice，而不是继续 continuity 线

## 3. 范围

- `lib/auth/authorization.ts`
- `lib/auth/billing-governance.ts`（新增）
- `lib/auth/revenue-governance.ts`（新增）
- `lib/auth/org-admin-governance.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `features/participant-portal/actions.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- continuity surface 深挖
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 settings 继续只靠 server-side 拒绝，而不显式暴露 manage posture，operator 会把 capability 拒绝误读成系统错误
2. 如果 support pack 继续只统计 memory / connector / import，不补 billing / registry / participant portal / settlement，tenant-scoped governance truth 仍然不完整
3. 如果为了“更完整”顺手引入新的 role model 或 enterprise IAM，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 为 billing / contribution registry / participant portal / manual settlement 建立统一 capability helper
- 用 helper 替换 settings / participant-portal 的局部判断

### Phase 2

- 在 settings query / client 暴露 capability-aware posture
- 补齐 read-only / review-first UI 表达，并收口高风险按钮的禁用条件

### Phase 3

- 扩 org-admin governance summary / support pack
- 加入 billing / registry / participant portal / settlement 的 30d 计数与 latest marker

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR46 - Connector Import Governance Deeper Slice

更新时间：2026-04-05
状态：Completed
范围：把 connector / import 高风险写路径收进 capability matrix，补 tenant-scoped import governance readout，并把 org-admin support pack 扩到 connector/import follow-through

## 1. 目标

PR46 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 connector / import 剩余高风险写路径继续收回统一 capability seam
2. 把 connector / import follow-through 补成 tenant-scoped governance readout 和 support-pack 摘要
3. 在 imports / settings surface 上补 capability-aware read-only posture，避免只在 server 侧硬失败

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / programs / memory 的第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- retention / export / delete / auth-session posture 已有 tenant-scoped readout

当前仍需下一层：

- connector connect / sync / disconnect 及 OAuth start/callback 仍主要依赖 workspace session，没有显式 capability guard
- CSV import、CRM import run/sync、warmup rerun、conflict resolve 仍主要依赖 workspace session 和 billing boundary，没有进入统一 capability seam
- org-admin governance 还没有把 connector/import follow-through 读数补进 support-pack 和 settings posture
- imports / CRM / conflicts / import-result 页面还没有 capability-aware read-only posture，当前更多依赖 server error 返回

## 3. 范围

- `lib/auth/authorization.ts`
- `lib/auth/import-governance.ts`（新增）
- `lib/auth/org-admin-governance.ts`
- `features/connectors/actions.ts`
- `features/imports/actions.ts`
- `features/imports/crm-actions.ts`
- `features/imports/queries.ts`
- `features/imports/imports-client.tsx`
- `features/imports/crm-import-client.tsx`
- `features/imports/import-conflicts-client.tsx`
- `features/imports/import-job-detail-client.tsx`
- `app/(workspace)/imports/page.tsx`
- `app/(workspace)/imports/crm/page.tsx`
- `app/(workspace)/imports/conflicts/page.tsx`
- `app/api/connectors/google/start/route.ts`
- `app/api/connectors/google/callback/route.ts`
- `app/api/connectors/hubspot/start/route.ts`
- `app/api/connectors/hubspot/callback/route.ts`
- `app/api/connectors/salesforce/start/route.ts`
- `app/api/connectors/salesforce/callback/route.ts`
- `app/api/imports/crm/preview/route.ts`
- `app/api/imports/crm/run/route.ts`
- `app/api/imports/crm/sync/route.ts`
- `app/api/imports/jobs/[jobId]/warmup/route.ts`
- `app/api/imports/conflicts/[id]/resolve/route.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / self-check / boundary / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- connector platform 重写
- import orchestration 平台化
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 connector/import 写路径继续只看 workspace session，不看 capability，当前 fixed-role matrix 仍会留下高风险绕行口
2. 如果 imports surface 只有 server 拒绝，没有 capability-aware posture，operator 会把授权失败误读成系统错误
3. 如果 support pack 只继续统计 memory / settlement / session，而不纳入 connector/import follow-through，tenant-scoped governance truth 仍然不完整
4. 如果本轮顺手扩成 connector admin 平台或 import governance center，会偏离 Helm 当前 `workspace-first` 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 扩 capability matrix 到 connector / import 高风险写路径
- 保持 action、route、OAuth start/callback guard 一致

### Phase 2

- 增加 connector/import governance summary
- 把 support-pack / settings posture 扩到 connector/import follow-through

### Phase 3

- 在 imports / CRM / conflicts / import-result surface 增加 capability-aware read-only posture
- 保持 operator-facing、review-first、tenant-scoped 表达

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 对应计划文档

- `docs/reviews/HELM_MULTITENANCY_CONNECTOR_IMPORT_GOVERNANCE_DEEPER_SLICE_PLAN_V1.md`

# PR45 - Broader Capability Matrix And Org Admin Export Follow-through

更新时间：2026-04-05
状态：Planned
范围：补剩余高风险 write path 的 capability guard，完善 org-admin export / retention / support-pack follow-through，并继续收紧 tenant-scoped data governance

## 1. 目标

PR45 继续保持 `workspace-first` 和 fixed-role capability matrix，不做 full RBAC，不做 enterprise IAM，不改变 `Workspace == current tenant boundary`。

本轮只做三件事：

1. 把还没进入统一 capability seam 的高风险写口继续收回授权矩阵
2. 把 org-admin support pack 从“可导出 snapshot”补到“可解释 export / retention / delete follow-through”
3. 把 tenant-scoped data governance 的 posture 与 export/delete 读数补成 settings 内可读、可审计的一层

## 2. 当前 truth

继承 PR42 / PR43 / PR44：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / programs / memory 的第一批高风险写路径已 capability 化
- org-admin governance support pack 已成立
- retention / export / delete / auth-session posture 已有第一层 tenant-scoped readout

当前仍需下一层：

- 仍有 memory API 写口直接依赖 workspace session，没有显式 capability guard
- support pack 还没有把 export / delete / retention follow-through 读数补成更完整的治理摘要
- settings 内虽然已有 governance 区块，但 capability coverage 和 tenant-scoped follow-through 还没有更明确的 operator truth

## 3. 范围

- `lib/auth/authorization.ts`
- `lib/memory/permissions.ts`
- `app/api/memory/facts/route.ts`
- `app/api/memory/facts/[id]/confirm/route.ts`
- `app/api/memory/meetings/[meetingId]/process/route.ts`
- `app/api/memory/imports/meeting-notes/process/route.ts`
- `lib/auth/org-admin-governance.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / self-check / boundary / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- policy engine 重写
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 memory API 写口继续只看 session，不看 capability，固定角色矩阵会继续存在 server-path 漏洞
2. 如果 support pack 只停留在 aggregate count，org-admin 仍无法解释 export / delete / retention 的治理 follow-through
3. 如果把本轮误做成更宽的 governance center，会偏离 Helm 当前 `workspace-first` 和 controlled-trial 边界
4. export / delete posture 一旦展示不清楚，会被误读成更宽的 tenant admin 平台能力

## 6. 阶段

### Phase 0

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 扩 capability matrix 到剩余高风险 memory API 写口
- 保持 tenant-scoped server guard 一致

### Phase 2

- 扩 org-admin governance summary
- 增加 export / retention / delete / support-pack follow-through 读数

### Phase 3

- 在 settings 里增加更明确的 governance follow-through readout
- 保持 operator-facing、review-first、tenant-scoped 表达

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 对应计划文档

- `docs/reviews/HELM_MULTITENANCY_BROADER_CAPABILITY_MATRIX_AND_ORG_ADMIN_EXPORT_FOLLOW_THROUGH_PLAN_V1.md`

# PR44 - Tenant Governance And Org Admin Audit Pack

更新时间：2026-04-05
状态：Completed
范围：扩大剩余高风险 write path 的 capability coverage，补 org-admin support pack / retention posture / tenant-scoped data governance

## 1. 目标

PR44 不做 full RBAC，不做 enterprise IAM，不改 `Workspace == current tenant boundary`，也不扩 execution authority。

本轮只做三件事：

1. 把仍然绕开 capability matrix 的高风险写路径继续收回统一授权层
2. 把 org-admin 审计从“最近动作回放”补成“可导出 support pack + tenant-scoped governance readout”
3. 把 retention / export / delete / auth-session 相关的数据治理姿态补成 settings 内可读、可审计、可追踪的一层

## 2. 当前 truth

继承 PR42 / PR43：

- `Workspace == Organization == current tenant boundary`
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立，但还没有收完剩余高风险 write path
- memory export / fact correction / invalidate / delete 已具备 tenant-scoped capability guard
- org-admin lifecycle 已成立，但审计仍偏窄，只停在 recent feed

当前仍需下一层：

- `features/programs/actions.ts` 仍有直连角色判断，没有接入统一 capability matrix
- org-admin 审计还没有 support pack / export / session posture / data-governance summary
- settings 里还缺 tenant-scoped retention / export / delete / auth-session posture 的集中治理 readout

## 3. 范围

- `lib/auth/authorization.ts`
- `lib/auth/session.ts`
- `lib/auth/org-admin-governance.ts`（新增）
- `features/programs/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/api/settings/org-admin/support-pack/route.ts`（新增）
- docs / self-check / boundary / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果继续允许高风险 write path 直接写死角色判断，后续 capability matrix 会失真
2. 如果 support pack 没有 tenant-scoped session / retention / export-delete posture，org-admin 仍然只能看到碎片化审计
3. 如果把本轮做成更宽的 tenant admin 平台，会偏离 Helm 当前 `workspace-first` 边界
4. support pack 导出本身是高风险治理动作，必须显式 capability guard 并写审计

## 6. 阶段

### Phase 0

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 扩 capability matrix 到剩余高风险 write path
- 优先收拢 `features/programs/actions.ts`

### Phase 2

- 增加 org-admin governance summary / support pack service
- 增加 tenant-scoped support pack export route 与审计

### Phase 3

- 在 settings 里增加 retention / export / delete / auth-session posture readout
- 补 org-admin support pack surface

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 对应计划文档

- `docs/reviews/HELM_MULTITENANCY_TENANT_GOVERNANCE_AND_ORG_ADMIN_AUDIT_PLAN_V1.md`

# PR43 - Broader Capability Coverage And Org Admin Audit

更新时间：2026-04-05
状态：Completed
范围：扩大多租户 / 多用户 capability coverage，补 org admin audit，并收紧 tenant-scoped export/delete/correction

## 1. 目标

PR43 不做 full RBAC，不做 enterprise IAM，也不改 tenant 边界。

本轮只做三件事：

1. 把更多高风险 write path 收到集中 capability matrix
2. 把组织管理员的关键动作补成可审计、可回看、可追责的一层
3. 把 memory export / correction / delete 这类 tenant-scoped 高风险操作补上统一授权和 UI posture

## 2. 当前 truth

继承 PR42：

- `Workspace == Organization == current tenant boundary`
- DB-backed auth session 已成立
- fixed-role capability matrix 已成立，但覆盖仍偏窄
- 组织成员基础 lifecycle 已成立，但还缺 role change 和更清晰的 org-admin audit

当前仍需下一层：

- settings 高风险 write path 还没有全部 capability 化
- tenant-scoped export / delete / correction 还没有统一 capability 守卫
- org admin 审计目前只有 aggregate count，没有最近动作可读回放

## 3. 范围

- `lib/auth/authorization.ts`
- `lib/auth/membership-lifecycle.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `features/memory/actions.ts`
- `features/memory/page-loader.ts`
- `features/memory/queries.ts`
- `features/memory/memory-client.tsx`
- `app/api/memory/export/route.ts`
- `app/api/memory/facts/[id]/*`
- docs / self-check / boundary / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- cross-tenant support tooling
- execution authority expansion

## 5. 风险

1. 当前 capability 覆盖只停在第一批面，继续扩 settings / memory write path 会放大绕过风险
2. 当前 memory export / correction / delete server path 只靠 workspace session，不足以表达操作权限
3. 当前 org-admin 页面没有最近操作审计列表，真实多用户试点里追责与复盘会不够清楚
4. 如果把本轮误扩成 full tenant admin 或 RBAC 平台，会偏离 Helm 现阶段边界

## 6. 阶段

### Phase 0

- 创建本计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 扩大 capability matrix 到 settings 高风险 write path

### Phase 2

- 收紧 memory export / correction / delete 的 tenant-scoped capability 与 UI posture

### Phase 3

- 增加 org-admin role change、last-owner demotion guard、recent audit readout

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 对应计划文档

- `docs/reviews/HELM_MULTITENANCY_AUTHORIZATION_AUDIT_PLAN_V1.md`

# PR42 - Helm Multitenancy And Multiuser Foundation

更新时间：2026-04-05
状态：Planned
范围：多租户 / 多用户基础收紧，先做 session、authz、org admin lifecycle

## 1. 目标

PR42 不扩平台主题，只解决当前多租户 / 多用户继续推进前的三条基础缺口：

1. 身份与会话硬化
2. 集中授权矩阵
3. 组织管理员与成员生命周期

## 2. 当前 truth

已成立：

- `Workspace == Organization == current tenant boundary`
- `Membership` 是 user-to-organization seam
- multi-workspace membership + active workspace switch 已可用
- `BillingAccount / TrialState / WorkerEntitlement / UsageLedger` 已落地
- self-serve signup、invited teammate entry、participant portal invited self-serve 已成立

仍需下一层：

- session hardening
- centralized authorization
- owner transfer / last-owner guard / membership lifecycle admin

## 3. 范围

- `lib/auth/session.ts`
- `features/auth/actions.ts`
- `features/settings/actions.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `features/participant-portal/actions.ts`
- `prisma/schema.prisma`
- docs / self-check / boundary / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- shared billing
- marketplace / public discovery
- execution authority expansion

## 5. 风险

1. 当前 cookie-based session seam 不足以承接更重多租户场景
2. 当前权限散落在 action / query 中，继续扩展会放大绕过风险
3. 成员生命周期还缺关键 org-admin 动作

## 6. 阶段

### Phase 0

- create plan doc
- lock truth source

### Phase 1

- identity and session hardening

### Phase 2

- centralized authorization matrix

### Phase 3

- org admin and membership lifecycle

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 对应计划文档

- `docs/reviews/HELM_MULTITENANCY_MULTIUSER_FOUNDATION_PLAN_V1.md`

# Continuity Surface Stable Closeout And Maintenance Transfer

更新时间：2026-04-05
状态：Completed
范围：continuity surface stable baseline closeout / maintenance-only transfer

## 1. 目标

当前 continuity surface 已经达到 stable baseline。
这轮不再继续推进新的 continuity deepening slice，只做收口：

1. 把 continuity surface 标记为 `stable & maintained`
2. 把 drift / calibration / material-impact 相关工作转入 `maintenance-only`
3. 明确后续更大方向必须通过单独 scoped plan 启动

## 2. 影响面

- `README.md`
- `docs/README.md`
- `docs/product/roadmap.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- continuity stable baseline / closeout docs
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

## 3. 当前 truth

继承：

- `HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_SUBGROUP_DRIFT_AND_MATERIAL_IMPACT_AGING_AUDIT_REFINEMENT_BASELINE_V1.md`
- `HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`

当前 continuity 已经成立：

- runtime continuity substrate
- bounded remediation / trace / rollback anchor
- analytics / evidence / runbook
- pilot calibration / wording consistency / material-impact aging review
- operator-visible surface + eval / e2e + self-check / boundary guard

## 4. 风险

1. 如果不明确标记 stable baseline，continuity 容易继续被当作默认深挖主线
2. 如果不把 maintenance trigger 写清楚，后续容易把 watchlist 当成持续开发 backlog
3. 如果不补 closeout guard，后续文档可能重新把 continuity 写成 execution-authority 邻近扩张

## 5. exact closeout loop

`stable baseline -> maintenance-only watchlist -> roadmap handoff`

## 6. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- no second app tree
- no route/query rewrite

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 显式延期项

- 新的 continuity deepening PR
- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces

# PR41 - Helm v2.2 Continuity Subgroup Drift And Material Impact Aging Audit Refinement

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity subgroup drift long-term expansion refinement / interval wording cross-readout regression audit refinement / material impact sampling aging refinement slice

## 1. 目标

PR41 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 对 subgroup drift 做更长期 sample expansion refinement，对比更广 cohort / readout 下的 drift consistency、sample depth 和 expansion posture
2. 对 interval wording 做跨更多 continuity readout 的 regression refinement，补 broader readout coverage、readout-family drift findings 和 wording adjustment recommendations
3. 对 material impact sampling aging 做持续 refinement，补 impact aging comparison、pattern aging findings 和 longer-horizon optimization suggestions
4. 把 subgroup drift、interval wording regression、material impact aging refinement 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR41 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR40 已完成：
  - `subgroupDriftLongTermSampleExpansionReview`
  - `intervalWordingCrossReadoutRegressionAudit`
  - `materialImpactSamplingAgingAudit`
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答：
  - subgroup drift 在更长期 sample expansion 下是否仍然 expanded-holding、expanded-watch，还是 expansion-risk
  - interval wording 在 threshold / step / guidance 这些 continuity readout 上是 live regression 还是 coverage gap
  - material impact sampling 在更长 horizon 下是 durable、watch，还是 unstable
- 但还缺：
  - 更长期 subgroup drift sample expansion 的 refined sample-depth / posture 对照
  - interval wording 在更广 continuity readout family 上的 regression refinement
  - material impact sampling aging 的持续 comparison 和更诚实的 optimization suggestion

## 4. 关键假设

1. PR41 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup drift expansion refinement、interval wording regression refinement、material impact aging refinement 只影响 operator-visible guidance，不驱动自动状态迁移
3. readout-family wording audit 只表达 canonical wording 是否在 continuity readout 上持续稳定，不表达正式 wording governance platform
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup drift 如果只补 aggregate sample-depth summary，不补 cohort-specific expansion finding，仍可能把局部 aging fluctuation 写成全局稳定性
2. wording regression refinement 如果不覆盖更多 continuity readout family，surface wording 仍可能在 summary / queue / runbook 之间重新漂移
3. material impact aging refinement 如果只重复当前 durable / watch / unstable ranking，不足以诚实说明 pattern aging 是 durable、mixed，还是 regressing

## 6. exact review loop

`subgroup drift long-term sample expansion refinement -> interval wording cross-readout regression refinement -> material impact sampling aging refinement -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR41 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup drift long-term sample expansion refinement：
  - broader sample-depth comparison
  - expansion posture / drift finding refinement
  - session-level subgroup drift expansion refinement summary

### Phase 2

- interval wording cross-readout regression refinement：
  - meeting detail / queue / operator panel / runbook / session summary wording family coverage
  - wording regression findings / adjustment recommendations
  - session-level wording refinement summary

### Phase 3

- material impact sampling aging refinement：
  - longer-horizon impact comparison
  - pattern aging findings / optimization suggestions
  - session-level material impact refinement summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或 view 变化后：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
- `npm run eval:helm-v2-2-phase21`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

# PR40 - Helm v2.2 Continuity Subgroup Drift Long-Term Aging And Material Impact Audit

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity subgroup drift long-term sample expansion / interval wording cross-readout regression audit / material impact aging audit slice

## 1. 目标

PR40 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 对 subgroup drift 做更长期 sample expansion，对比更广 cohort 下的 drift consistency、holding pockets 和 at-risk pockets
2. 对 interval wording 做跨更多 continuity readout 的 regression audit，补 broader readout coverage、regression findings 和 wording adjustment recommendations
3. 对 material impact sampling aging 做持续 audit，补 impact aging report、pattern aging findings 和 longer-horizon optimization suggestions
4. 把 subgroup drift、interval wording regression、material impact aging audit 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR40 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR39 已完成：
  - `subgroupDriftLongTermCohortAgingReview`
  - `intervalWordingCrossSurfaceRegressionAudit`
  - `materialImpactSamplingAgingRefinement`
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答：
  - subgroup drift 在更长期 cohort aging 下是否仍然 broad-holding、aging-drift，还是正在 weakening
  - interval wording 在 continuity-facing readout 上是 live regression 还是 coverage gap
  - material impact sampling 在更长 horizon 下是 persistent signal、watch，还是 unstable hint
- 但还缺：
  - 更长期 subgroup drift 的 sample expansion 对照
  - interval wording 在更多 continuity readout 上的 regression audit 覆盖
  - material impact sampling aging 的持续 audit 和更诚实的 optimization suggestion

## 4. 关键假设

1. PR40 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup drift expansion、interval wording regression audit、material impact aging audit 只影响 operator-visible guidance，不驱动自动状态迁移
3. cross-readout wording audit 只表达 canonical wording 是否在 continuity readout 上持续稳定，不表达正式 wording governance platform
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup drift 如果只补 aggregate expansion summary，不补 cohort-specific holding / drift finding，仍可能把局部 aging fluctuation 写成全局稳定性
2. wording regression audit 如果不覆盖更多 continuity readout，surface wording 仍可能重新漂移
3. material impact aging audit 如果只重复当前 impact ranking，不足以诚实说明 longer-horizon pattern 是 durable、watch，还是 unstable

## 6. exact review loop

`subgroup drift long-term sample expansion -> interval wording cross-readout regression audit -> material impact sampling aging audit -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR40 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup drift long-term sample expansion：
  - broader long-horizon cohort comparison
  - holding / watch / drift sample expansion findings
  - session-level subgroup drift expansion summary

### Phase 2

- interval wording cross-readout regression audit：
  - meeting detail / queue / operator panel / runbook / readout summary wording coverage
  - wording regression findings / adjustment recommendations
  - session-level wording audit summary

### Phase 3

- material impact sampling aging audit：
  - longer-horizon impact aging report
  - pattern aging findings / optimization suggestions
  - session-level material impact audit summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或 view 变化后：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
- `npm run eval:helm-v2-2-phase20`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

# PR39 - Helm v2.2 Continuity Subgroup Drift And Impact Aging Refinement

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity subgroup drift / cross-surface interval wording regression audit / material impact aging refinement slice

## 1. 目标

PR39 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 对 subgroup drift 做更长期 cohort aging 扩样对照，补 long-term cohort aging report 和 subgroup drift comparison
2. 对 interval wording 做跨更多 continuity-facing readout 的 regression audit，补 wording regression findings 和 adjustment recommendations
3. 对 material impact sampling aging 做持续 refinement，补 aging material impact analysis 和 longer-horizon impact optimization summary
4. 把 subgroup drift、wording regression、material impact aging refinement 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR39 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR38 已完成 subgroup drift aging scale-up review、cross-surface interval wording consistency audit、material impact sampling aging review
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答：
  - subgroup drift 在更大 cohort aging 里是 broad-holding、watch，还是 aging-drift
  - interval wording 在更多 continuity surface 上是否仍保持 canonical wording
  - material impact sampling 在更长 horizon 下是 persistent signal、watch，还是 unstable hint
- 但还缺：
  - 更长期 cohort aging 下的 subgroup drift 扩样对照
  - interval wording 在更多 continuity-facing readout 上的 regression audit
  - material impact sampling aging 的持续 refinement

## 4. 关键假设

1. PR39 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup drift、interval wording regression audit、material impact aging refinement 只影响 operator-visible guidance，不驱动自动状态迁移
3. interval wording regression audit 只表达 canonical wording 是否在 continuity-facing readout 上持续稳定，不表达正式 wording governance platform
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup drift 如果只补 aggregate summary，不补 subgroup-specific aging finding，仍可能把局部 aging fluctuation 写成全局稳定性
2. wording regression audit 如果不覆盖更多 continuity-facing readout，surface wording 仍可能重新漂移
3. material impact aging refinement 如果只重复当前 impact ranking，不足以诚实说明 pattern 是 persistent、watch，还是 unstable

## 6. exact review loop

`subgroup drift long-term cohort aging review -> cross-surface interval wording regression audit -> material impact sampling aging refinement -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR39 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup drift long-term cohort aging：
  - larger long-horizon cohort comparison
  - subgroup-specific aging findings
  - session-level subgroup aging summary

### Phase 2

- interval wording cross-surface regression audit：
  - meeting detail / queue / operator panel / runbook continuity wording regression coverage
  - wording regression findings / adjustment recommendations
  - session-level wording regression summary

### Phase 3

- material impact sampling aging refinement：
  - longer-horizon impact sampling summary
  - aging material impact analysis / optimization summary
  - session-level material impact aging summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

有行为或页面变化后：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. deferred items

本轮明确不做：

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

# PR38 - Helm v2.2 Continuity Subgroup Drift Aging And Material Impact Audit

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity subgroup drift aging / cross-surface interval wording consistency audit / material impact sampling aging review slice

## 1. 目标

PR38 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 对 subgroup drift 做更大 pilot cohort 下的长期 aging / drift 对照，补 long-term cohort aging report 和 subgroup drift comparison
2. 对 interval wording 做跨更多 continuity surface 的 consistency / regression 审计，补 interval wording consistency audit report 和 adjustment recommendations
3. 对 material impact sampling 做 pattern aging 复核，补 aging material impact analysis 和 long-term impact optimization summary
4. 把 subgroup drift aging、wording consistency audit、material impact sampling aging 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR38 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR37 已完成 subgroup drift cohort aging review、cross-surface interval wording regression review、material impact sampling review
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答：
  - subgroup drift 在 cohort aging 里是 holding、watch，还是 aging-drift
  - interval wording 在 meeting detail、queue、operator panel、runbook 上是否仍保持 canonical wording
  - material impact 是 broader-sample signal，还是 narrow hint
- 但还缺：
  - 更大 pilot cohort 下的 subgroup drift aging 对照
  - interval wording 的跨更多 continuity surface consistency / regression 审计
  - material impact sampling 的 pattern aging 复核

## 4. 关键假设

1. PR38 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup drift aging、interval wording consistency audit、material impact sampling aging 只影响 operator-visible guidance，不驱动自动状态迁移
3. interval wording consistency 只表达 canonical wording 是否持续稳定，不表达正式 wording governance platform
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup drift aging 如果只补 aggregate summary，不补 subgroup-specific finding，仍可能把局部 aging fluctuation 写成全局稳定性
2. wording consistency audit 如果不覆盖 meeting detail、queue、operator panel、runbook 之外的 continuity-facing surface，surface wording 仍可能重新漂移
3. material impact sampling aging 如果只重复当前 impact ranking，不足以诚实说明 pattern 是 persistent、fading，还是 unstable

## 6. exact review loop

`subgroup drift cohort aging scale-up review -> cross-surface interval wording consistency audit -> material impact sampling aging review -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR38 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup drift aging scale-up：
  - larger cohort aging comparison
  - subgroup-specific drift findings
  - session-level subgroup aging summary

### Phase 2

- interval wording cross-surface consistency audit：
  - meeting detail / queue / operator panel / runbook continuity wording follow-through
  - wording regression findings / adjustment recommendations
  - session-level wording consistency summary

### Phase 3

- material impact sampling aging review：
  - longer-horizon impact sampling summary
  - aging material impact analysis / long-term impact optimization summary
  - session-level material impact aging summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

有行为或页面变化后：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. deferred items

本轮明确不做：

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

# PR37 - Helm v2.2 Continuity Subgroup Drift Cohort Aging And Impact Review

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity subgroup drift cohort aging / cross-surface interval wording regression / material impact aging sampling review slice

## 1. 目标

PR37 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 对 subgroup drift 做更长期的 cohort aging 对照，补 long-term cohort aging report 和 drift comparison
2. 对 interval wording 做跨 surface regression 复核，补 wording regression findings 和 adjustment recommendations
3. 对 material impact aging 做持续扩样复核，补 aging material impact analysis 和 long-term impact refinement
4. 把 cohort aging、wording regression、material impact aging 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR37 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR36 已完成 subgroup stability drift review、interval wording aging / regression audit、material impact pattern aging review
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答：
  - subgroup drift 在更长 horizon 上是否已经出现 aging 分化
  - interval wording 是否仍保持 canonical wording
  - material impact pattern 是 persistent、fading，还是 unstable
- 但还缺：
  - cohort aging 的更长期对照
  - interval wording 的跨 surface regression 复核
  - material impact aging 的持续扩样复核

## 4. 关键假设

1. PR37 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup drift cohort aging、interval wording regression、material impact sampling review 只影响 operator-visible guidance，不驱动自动状态迁移
3. interval wording regression 只表达 canonical wording 是否持续稳定，不表达正式 wording governance 平台
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. cohort aging 如果只补 summary 不补 subgroup-specific finding，仍可能把局部 aging fluctuation 写成全局稳定性
2. wording regression 如果不覆盖 meeting detail、queue、operator panel 和 runbook，surface wording 仍可能重新漂移
3. material impact sampling 如果只重复当前 impact ranking，不足以诚实说明 pattern 是更稳、在衰减，还是仍停留在 narrow hint

## 6. exact review loop

`subgroup stability drift review -> cohort aging comparison -> cross-surface interval wording regression review -> material impact aging sampling review -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR37 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup drift cohort aging：
  - longer-term cohort aging comparison
  - subgroup-specific drift findings
  - session-level cohort aging summary

### Phase 2

- interval wording cross-surface regression：
  - meeting detail / queue / operator panel / runbook wording follow-through
  - wording regression findings / adjustment recommendations
  - session-level wording regression summary

### Phase 3

- material impact aging sampling review：
  - longer-horizon impact sampling summary
  - aging material impact analysis / long-term impact refinement
  - session-level material impact sampling summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

---

# PR36 - Helm v2.2 Continuity Subgroup Stability Drift And Material Impact Aging Review

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity subgroup stability drift / interval wording aging-regression audit / material impact pattern aging review slice

## 1. 目标

PR36 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 对 subgroup recheck 做更长期 drift 对照，补 long-horizon drift 演变和 subgroup-specific findings
2. 对 interval wording 做 aging / regression audit，补 regression rate、surface consistency 和 canonical guidance continuity
3. 对 material impact pattern 做 aging review，补更长周期的 persistence / fade / still-advisory readout
4. 把 subgroup drift、wording aging、material impact aging 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR36 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR35 已完成 subgroup scale-up recheck、wording drift tracking、interval consistency guidance、long-term material impact audit
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答：
  - scale-up recheck 是否稳住
  - wording drift 是否已经回到 canonical wording
  - material impact 是否已有 broader-sample advisory pattern
- 但还缺：
  - subgroup drift 的更长期对照
  - wording aging / regression 的持续审计
  - material impact pattern 的 aging review

## 4. 关键假设

1. PR36 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup drift、wording aging、material impact aging 只影响 operator-visible guidance，不驱动自动状态迁移
3. interval wording aging / regression audit 只表达 canonical wording 是否持续稳定，不表达正式统计区间系统
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup drift 如果只补 summary 不补 subgroup-specific finding，仍容易把局部 aging fluctuation 写成全局 drift
2. wording aging audit 如果不覆盖 queue / session / docs，surface 仍可能重新漂移
3. material impact aging review 如果只重复当前 audit 排名，无法诚实说明 pattern 是在延续、衰减，还是仍停留在 narrow hint

## 6. exact review loop

`subgroup scale-up recheck -> longer-horizon subgroup drift comparison -> interval wording aging / regression audit -> material impact pattern aging review -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR36 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup recheck long-term drift：
  - longer-horizon subgroup drift comparison
  - subgroup-specific drift findings
  - session-level subgroup drift summary

### Phase 2

- interval wording aging / regression audit：
  - threshold / step / queue / session / surface wording follow-through
  - aging summary / regression rate / canonical guidance continuity
  - session-level wording aging summary

### Phase 3

- material impact pattern aging review：
  - long-horizon material impact persistence summary
  - aging patterns / optimization hints
  - session-level material impact aging summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

---

# PR35 - Helm v2.2 Continuity Pilot Scale-up Recheck And Material Impact Audit

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity pilot scale-up recheck / wording drift continuity audit / long-term material impact audit slice

## 1. 目标

PR35 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 基于更大的 pilot sample 对 subgroup scale-up 做 recheck，补 stability variance 和 cohort-specific findings
2. 持续审计 interval wording drift，补 drift rate、consistency 和 interval consistency guidance
3. 继续复核 long-term material impact，补 material impact refinement summary、impact pattern 和优化建议
4. 把 subgroup scale-up recheck、wording drift 持续审计、material impact audit 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR35 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR34 已经完成 subgroup stability scale-up、interval wording drift audit、long-term material impact review
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答 stability confidence / interval wording / long-term material impact，但还缺：
  - 更大 sample 下的 subgroup scale-up recheck
  - wording drift 的持续审计
  - long-term material impact 的持续 audit

## 4. 关键假设

1. PR35 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup scale-up recheck、wording drift 持续审计、material impact audit 只影响 operator-visible guidance，不驱动自动状态迁移
3. interval wording consistency guidance 只表达 canonical wording 是否稳定，不表达正式统计区间系统
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup scale-up recheck 如果只是放大样本口径不补 variance guidance，容易继续把局部 sample 写成全局稳定性
2. wording drift 持续审计如果不覆盖 queue / session / docs，surface 仍可能重新漂移
3. long-term material impact audit 如果只看单个 step 排名，仍可能被窄样本高波动误导

## 6. exact review loop

`larger pilot sample -> subgroup scale-up recheck -> wording drift continuity audit -> long-term material impact audit -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR35 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup scale-up recheck：
  - larger-sample subgroup stability recheck
  - stability variance refresh
  - cohort-specific findings

### Phase 2

- wording drift 持续审计：
  - threshold / session / queue / operator wording follow-through
  - drift rate / consistency summary / findings
  - interval consistency guidance

### Phase 3

- long-term material impact audit：
  - material impact refinement summary
  - impact pattern readout
  - subgroup-aware optimization guidance

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

---

# PR34 - Helm v2.2 Continuity Pilot Stability Scale-up And Long-term Impact Refinement

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity pilot stability scale-up / interval wording drift audit / long-term material impact refinement slice

## 1. 目标

PR34 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 扩大 pilot sample 下的 subgroup stability readout，补更全面的 stability metrics 和 subgroup-specific findings
2. 审计 interval wording 在 threshold / session / queue / operator surface 之间是否发生 drift，并补统一 guidance
3. 持续复核 long-term material impact，区分真实 material signal 与窄样本提示
4. 把 subgroup stability、wording drift、material impact 收成更诚实的 operator-visible continuity guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR34 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR33 已经完成 subgroup stability recheck、interval wording consistency、long-term outcome review
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答 stability confidence / interval wording / long-term material impact，但还缺：
  - 更大 sample 下的 subgroup stability scale-up
  - interval wording drift audit
  - long-term material impact 的持续复核

## 4. 关键假设

1. PR34 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup stability scale-up、interval wording drift audit、long-term material impact review 只影响 operator-visible guidance，不驱动自动状态迁移
3. interval wording drift audit 只表达 canonical wording 是否稳定，不表达正式统计区间系统
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup scale-up 如果只是扩描述不扩可见指标，容易继续把局部 sample 写成全局稳定性
2. wording drift audit 如果不覆盖 queue / session / docs，surface 仍可能重新漂移
3. long-term material impact 如果只看单个 step 排名，可能被窄样本高波动误导

## 6. exact review loop

`larger pilot sample -> subgroup stability scale-up -> interval wording drift audit -> long-term material impact review -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR34 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup stability scale-up：
  - stability metrics scale-up
  - subgroup-specific findings
  - stability confidence band adjustment

### Phase 2

- interval wording drift audit：
  - threshold / session / queue / operator wording audit
  - drift summary / aggregate / findings
  - wording consistency guidance

### Phase 3

- long-term material impact review：
  - material impact ranking refresh
  - longer-horizon material impact summary
  - subgroup-aware impact guidance

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

---

# PR33 - Helm v2.2 Continuity Pilot Stability Recheck And Long-term Outcome Refinement

更新时间：2026-04-05
状态：Completed
范围：v2.2 narrow continuity pilot stability recheck / interval wording consistency / long-term outcome refinement slice

## 1. 目标

PR33 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 对更大 pilot sample 下的 subgroup 做 stability recheck，并补 subgroup variance / risk analysis
2. 统一 confidence interval wording，去掉同义但不一致的 operator-facing 描述
3. 继续复核 SOP guidance 命中后的更长周期 outcome，补 material impact 总结
4. 把 subgroup stability / interval wording / long-term outcome 收成更一致的 operator-visible guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR33 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR32 已经完成 subgroup stability review、confidence interval simplification、long-term SOP impact refinement
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已经能回答 stability / interval / long-term SOP impact，但还缺：
  - 更大 sample 下的 subgroup stability 再检查
  - interval wording consistency
  - SOP guidance 命中后的更长周期 outcome 复核

## 4. 关键假设

1. PR33 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup stability recheck、interval wording consistency 和 long-term outcome review 只影响 operator-visible guidance，不驱动自动状态迁移
3. revised interval wording 只表达 review 强弱与读法一致性，不表达统计因果性或生产级可信区间
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup 切得更细后，样本过小仍会让 stability recheck 产生假确定性
2. interval wording 如果只改表述不改来源映射，容易让不同 surface 的读法继续漂移
3. long-term outcome review 如果表达不严谨，容易被误读成 SOP 对 outcome 的因果证明

## 6. exact review loop

`expanded pilot sample -> subgroup stability recheck -> interval wording consistency -> longer-horizon outcome review -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR33 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup stability recheck：
  - subgroup stability variance
  - subgroup risk analysis
  - stability confidence bands

### Phase 2

- interval wording consistency：
  - canonical interval wording map
  - surface / runtime / eval wording alignment
  - wording consistency guidance

### Phase 3

- long-term outcome refinement：
  - longer-horizon trend review
  - material impact summary
  - SOP step influence review

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

---

# PR30 - Helm v2.2 Continuity Calibration Deepening / SOP Effectiveness Synthesis

更新时间：2026-04-04
状态：Completed
范围：v2.2 narrow continuity calibration deepening / operator insight slice

## 1. 目标

PR30 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 在现有 cohort family 之上继续做更细 subgroup review
2. 基于更细 subgroup 复核 threshold / confidence band，并产出更高质量的 calibration guidance
3. 把 long-horizon drift、repeat ineffective posture、effectiveness change 做成更可读的综合复核
4. 把 SOP 命中率与 operator outcome 偏差进一步综合成 operator-facing insights 和 runbook refinement hints

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `components/layout/topbar.tsx`（仅用于 final validation stabilization）
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR30 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR29 已经完成 cohort family、risk band summary、threshold revision、long-horizon drift、operator outcome variance 的下一层 review
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- SOP effectiveness 仍然是 operator-visible guidance review，不是自动编排
- continuity surface 已经能回答 threshold / drift / variance，但更细 subgroup calibration 和 SOP synthesis 还缺下一层诚实收紧

## 4. 关键假设

1. PR30 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. 只有当前代码、schema、查询能证实的数据才能进入 subgroup 维度；没有 grounding 的维度不硬加
3. calibration 只影响 operator-visible summary、runbook、surface hints，不驱动 auto-remediation 或隐藏状态迁移
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. subgroup 如果切得过细，容易把窄 sample 写成假精度
2. participant role / meeting frequency 如果没有 grounded metadata，会产生误导性的 calibration label
3. SOP effectiveness synthesis 如果表达过度，容易让 operator 误以为系统已经具备行为优化能力

## 6. exact review loop

`finer subgroup review -> threshold/confidence refinement -> drift synthesis -> SOP effectiveness synthesis -> operator-visible continuity insights`

这条 loop 只服务 operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR30 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- finer subgroup substrate：
  - session density
  - failure history
  - meeting frequency
  - participant role posture（仅在 metadata 足够时）

### Phase 2

- threshold / confidence second-pass refinement：
  - subgroup-specific threshold suggestion
  - subgroup-specific confidence summary
  - refined calibration highlights

### Phase 3

- drift synthesis：
  - long-horizon drift synthesis
  - repeat ineffective posture synthesis
  - effectiveness change synthesis
  - materially drifting subgroup summary

### Phase 4

- SOP effectiveness synthesis：
  - step-level hit / skip / ineffective-after-hit
  - effective vs review-required outcome contrast
  - runbook refinement hints

### Phase 5

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics

---

# PR29 - Helm v2.2 Continuity Calibration Review Next Layer

更新时间：2026-04-04
状态：Completed
范围：v2.2 narrow continuity calibration next-layer review slice

## 1. 目标

PR29 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 扩大 pilot cohort 视角，增加 workspace size、meeting shape、failure pattern、remediation posture 的更细分层
2. 基于更细 cohort 重新复核 threshold / confidence band，输出 revised threshold suggestion 与 revised confidence posture
3. 对 drift 做更长时间窗口的对照，显式回答 newer / older / long-horizon 的差异
4. 把 SOP hit-rate 与最终 operator outcome 的偏差显式化，帮助 runbook 收紧下一层 guidance

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR29 计划 / 基线 / 报告文档

## 3. 当前 freeze truth

当前继承的 freeze 口径是：

- PR28 已经完成 cohort breakdown、threshold revision、drift delta、operator handling effectiveness 的第一层 review
- 当前 continuity pilot review 仍是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- calibration 仍然是 operator-visible guidance，不是 auto-remediation 或 execution authority
- operator surface 已经能解释 cohort / threshold / guidance，但长期 drift 与 SOP outcome variance 还缺下一层诚实复核

## 4. 关键假设

1. PR29 仍然只使用 repo 内 continuity records、fixture 与 eval sample，不引入外部 telemetry 平台
2. recalibration 只影响 operator-visible review posture、summary 与 runbook，不驱动自动恢复或隐藏状态迁移
3. SOP variance 只用于分析“哪些 guidance 更可能导向有效结果”，不是做自动推荐执行器
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 5. 风险

1. cohort 分层如果切得太碎，容易把窄 pilot sample 写成“看起来很精确”的假精度
2. long-horizon drift 如果口径不一致，可能和 PR28 的 newer/older delta 产生解释冲突
3. SOP variance 如果表达过度，会让 operator 误以为系统已经具备行为分析或自动优化能力

## 6. exact review loop

`expanded pilot cohorts -> threshold/confidence recalibration -> longer-horizon drift comparison -> SOP hit-rate vs final outcome variance -> operator-visible review summary`

这条 loop 只服务 operator diagnosis / calibration review，不扩 execution authority。

## 7. phase plan

### Phase 0

- 创建 PR29 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- finer cohort substrate：
  - workspace size cohorts
  - meeting shape cohorts
  - failure pattern cohorts
  - remediation posture cohorts
  - cohort-level failure distribution / success rate / drift summary

### Phase 2

- threshold / confidence recalibration：
  - revised threshold suggestions by cohort
  - revised confidence bands by cohort
  - risk-band distribution summary
  - revised calibration highlights

### Phase 3

- longer-horizon drift review：
  - recent / older / long-horizon drift rate
  - repeat ineffective trend over time
  - remediation effectiveness change by cohort family

### Phase 4

- SOP hit-rate vs final operator outcome variance：
  - matched / skipped / ineffective-after-hit rates by SOP step
  - operator outcome variance summary
  - runbook refinement hints

### Phase 5

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 8. 验证方案

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 9. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write

---

# PR21 - Helm v2.1 Continuity Correctness Hardening

更新时间：2026-04-03
状态：Implemented
范围：v2.1 narrow continuity correctness hardening

## 1. 目标

这次 PR 只收紧当前已经落地的 `meeting-driven budgeted session continuity` slice，不扩平台范围。

本轮只做四件事：

1. 修正 `confirmedFacts` 来源，确保 continuity notebook 只使用 promoted truth
2. 修正 payload active/pruned state 推导，不再只依赖 latest edit
3. 扩大 replay fidelity 范围，把关键 continuity fields 纳入缺失检查
4. 补 continuity operator diagnostics 文档，统一解释 budget posture、fidelity 和 payload 语义

## 2. 影响面

主要影响以下组件：

- `lib/helm-v2/runtime-upgrade.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- continuity eval sample
- continuity 文档与 docs index

当前不涉及：

- 新 runtime object
- route/query rewrite
- 新 app tree
- broader world-model
- execution authority

## 3. 当前状态

当前 freeze 已经证明：

- persisted payload handles 已落地
- budget posture `SAFE / WATCH / PRUNE / COMPACT` 已落地
- notebook / checkpoint / resume 已落地
- meeting runtime card 与 operator panel 已可见 continuity posture

但当前还存在 correctness hardening 空间：

- `confirmedFacts` 的 continuity 口径需要显式只绑定 promoted truth
- payload current-state 推导不能只看 latest prune edit
- replay fidelity 覆盖字段偏窄
- continuity surface 缺少更标准的解释文档

## 4. 关键假设

1. 这次 PR 的真相来源仍是：
   - `docs/product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
   - `docs/reviews/HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
   - `docs/product/HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md`
   - `docs/reviews/HELM_V2_1_VERIFIED_COORDINATION_ACCEPTANCE_REPORT_V1.md`
2. continuity 仍是 `meeting-driven narrow slice`，不是 full recovery engine
3. 不引入新依赖，不改 schema，不扩 route tree
4. “当前 active payload state” 只要求当前态准确，不要求上完整 event sourcing 历史

## 5. 风险

1. 扩 replay fidelity 后，现有 fixture 可能从 `STRONG` 变成 `WEAK`
2. payload state 推导从 latest edit 改成 snapshot + edit fold 后，现有 UI/trace 可能出现期望差异
3. continuity tests 目前覆盖窄，需要补精确 case 才能避免回归

## 6. 实施步骤

### Step 1

固定 PR21 文档范围：

- 创建 / 更新 `PLANS.md`
- 明确只做四项 correctness hardening

### Step 2

收紧 continuity core：

- 显式 helper 化 promoted facts
- 引入 payload current-state helper
- 扩 replay fidelity 缺失检查

### Step 3

同步 operator surface：

- meeting runtime card 显示 payload state derivation
- continuity wording 与 diagnostics 文档保持一致

### Step 4

补测试 / eval / 文档：

- helper tests
- continuity eval 更新
- operator diagnostics 文档
- docs index 同步

## 7. 验证方案

阶段验证：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run build`
- `npm run test`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 显式延期项

本次 PR 不做：

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- platform expansion

## 9. 回滚路径

如果 correctness hardening 触发 continuity 回归：

1. 回退到当前 helper 之前的 latest-edit payload state 逻辑
2. 只保留文档与测试，不强推 widened fidelity
3. 保证 meeting runtime summary 与 operator panel 先恢复绿态

---

# PR22 - Helm v2.2 Continuity Observability

更新时间：2026-04-04
状态：Implemented
范围：v2.2 narrow continuity observability slice

## 1. 目标

在 v2.1 continuity 基线之上，新增一层可观测性硬化：

1. continuity 风险分级（`LOW / WATCH / HIGH`）
2. workspace operator continuity queue 的风险可读性
3. continuity 风险的短 action guidance
4. eval / test / docs / script 收口

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `scripts/helm-v2-2-continuity-observability-evals.ts`
- `docs/product/HELM_V2_2_CONTINUITY_OBSERVABILITY_BASELINE_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_OBSERVABILITY_PLAN_V1.md`
- `docs/reviews/HELM_V2_2_CONTINUITY_OBSERVABILITY_REPORT_V1.md`
- `docs/README.md`
- `package.json`

## 3. 关键假设

1. PR22 只做 observability hardening，不扩 execution authority
2. risk model 采用规则分级，先保证可解释与稳定
3. continuity queue 的 posture 来源仍复用既有 runtime substrate，不新建平台层

## 4. 风险

1. `WATCH` 规则偏保守时，可能带来可接受范围内的“偏高提醒”
2. queue 字段增加后，若类型收敛不完整会触发 TS 回归
3. operator 文案不一致会造成理解偏差，需 docs 与 surface 同步

## 5. 验证方案

阶段验证：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-continuity-observability`

## 6. 显式延期项

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- platform expansion

---

# PR23 - Helm v2.2 Continuity Calibration And Truth Hardening

更新时间：2026-04-04
状态：Completed
范围：v2.2 narrow continuity calibration + truth hardening slice

## 1. 目标

PR23 在 PR22 之上继续做 runtime continuity hardening，但不扩大平台边界：

1. 做 pilot-backed calibration：`LOW/WATCH/HIGH`、`replayStatus`、`payloadStateSource`
2. 收紧 prune/resume 路径的 `confirmedFacts` 来源纪律，只认 promoted truth
3. 修正 multi-prune trace/history 语义，禁止 context-edit 静默覆盖
4. 扩 replay-fidelity 覆盖与 eval

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`（若字段可视化需要同步）
- `scripts/helm-v2-2-continuity-observability-evals.ts`
- `package.json`
- `evals/helm-v2/*`（新增或更新 continuity calibration fixtures）
- `docs/README.md`
- PR23 计划/基线/报告文档

## 3. 关键假设

1. v2.1/v2.2 freeze 文档仍是 truth source，spec 不自动等于已实现
2. calibration 先走规则可解释路径，不引入黑盒评分器
3. multi-prune 先保证“当前态准确 + 历史可追”，不扩 full event-sourcing platform
4. 边界保持：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion

## 4. 风险

1. replayStatus 从二值扩展后，现有断言可能出现批量漂移
2. context-edit 从 upsert 改为 append-only 后，trace 数量增长会影响 UI 可读性
3. payloadStateSource 改为多次 prune fold 后，部分历史 case 的 posture 会重分类

## 5. phase plan

### Phase 1

- pilot-backed calibration helper + continuity risk/replay status 校准

### Phase 2

- prune/resume confirmedFacts 来源纪律硬化
- context-edit 改为 append-only + multi-prune fold

### Phase 3

- replay-fidelity 扩字段 + critical/non-critical 评价
- operator summary/readability 同步

### Phase 4

- eval fixtures/harness/scripts/tests 更新
- docs freeze + index + guard 同步

## 6. 验证方案

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-continuity-observability`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e:retry`
- `npm run quality:regression:retry`

## 7. 显式延期项

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion

---

# PR24 - Helm v2.2 Continuity Failure Recovery And Operator Remediation

更新时间：2026-04-04
状态：Completed
范围：v2.2 narrow continuity failure recovery / operator remediation slice

## 1. 目标

PR24 只在现有 continuity surface 内继续硬化，不扩执行权：

1. 明确 continuity failure taxonomy
2. 落 recovery state model：`STABLE / RECOVERABLE / REVIEW_REQUIRED / BLOCKED`
3. 增加 bounded operator-triggered remediation actions
4. 为每次 remediation 记录 before / after + rollback anchor
5. 补 recoverable / review-required / blocked 路径的 eval 与 e2e

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `lib/helm-v2/meeting-action-pack-runtime.ts`（若 meeting runtime summary 字段需要同步）
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/meetings/actions.ts`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `app/api/helm-v2/runtime/*`（仅在 continuity remediaton 需要独立 route 时）
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `docs/README.md`
- PR24 计划/基线/报告文档

## 3. 关键假设

1. continuity remediation 只允许 bounded runtime actions：checkpoint anchor、checkpoint resume、budget reprune
2. rollback anchor 优先复用 session checkpoint，不新增第二套 recovery object tree
3. remediation trace 优先复用 `RuntimeEvent`，不做 destructive migration
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 4. 风险

1. remediation action 如果没有 rollback anchor，会把 continuity surface 从可诊断推进成不可恢复
2. meeting surface 和 operator queue 如果读同一状态但展示不同摘要，会造成 operator 误判
3. e2e 如果依赖 demo 数据天然出现失败状态，会不稳定；需要窄而可控的测试种子

## 5. phase plan

### Phase 1

- failure taxonomy + recovery state model
- continuity trace / queue / meeting summary 同步 recovery posture

### Phase 2

- bounded remediation actions：
  - save recovery checkpoint
  - resume checkpoint
  - re-prune context
- before / after + rollback anchor trace

### Phase 3

- operator readability：
  - why this session is recoverable / review-required / blocked
  - what action is allowed
  - what rollback anchor exists

### Phase 4

- eval fixtures / harness / tests / e2e
- baseline / report / docs index / guard 同步

## 6. 验证方案

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-phase4`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e:retry`
- `npm run quality:regression:retry`

## 7. 显式延期项

- team mode / multi-agent runtime
- broader world-model productization
- full compaction engine
- dreaming consolidator
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion

---

# PR25 - Helm v2.2 Continuity Remediation Analytics And Operator Runbook

更新时间：2026-04-04
状态：Completed
范围：v2.2 narrow continuity remediation analytics / operator runbook slice

## 1. 目标

PR25 只在现有 continuity surface 与 operator workflow 内继续收紧，不扩执行权：

1. 为 remediation path 增加可操作 analytics
2. 为 operator 提供 continuity remediation runbook
3. 增加 evidence surface，解释为什么当前进入 recoverable / review-required / blocked
4. 识别 repeat-pattern，避免重复 remediation 被静默吞没
5. 补 analytics / runbook / evidence / repeat-pattern 的 eval 与 e2e

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR25 计划 / 基线 / 报告文档

## 3. 关键假设

1. remediation analytics 复用现有 `RuntimeEvent` remediation trace，不新增独立 analytics store
2. runbook 只提供 operator diagnostic / remediation guidance，不生成执行 authority
3. repeat-pattern 先做当前 continuity slice 可解释规则，不引入全局 anomaly engine
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 4. 风险

1. remediation analytics 如果与 meeting card / operator queue 读取口径不一致，会放大 operator 误判
2. repeat-pattern 规则如果写得过宽，会把一次正常复试误报为问题模式
3. evidence surface 如果直接倾倒原始 trace，而不是压成可读摘要，会降低 operator 可用性

## 5. phase plan

### Phase 1

- 增加 remediation analytics：
  - attempts
  - applied / review-required / blocked counts
  - latest attempt
  - repeat-pattern posture

### Phase 2

- 增加 evidence surface：
  - current recovery evidence
  - replay / payload / rollback anchor evidence
  - before / after remediation evidence summary

### Phase 3

- 增加 operator runbook：
  - current recovery state 的推荐排查顺序
  - repeat-pattern 下的 bounded next step
  - meeting card / operator queue 同步可读摘要

### Phase 4

- eval fixtures / harness / tests / e2e
- baseline / report / docs index / guard 同步

## 6. 验证方案

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-phase5`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 显式延期项

- continuity auto-remediation orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine

---

# PR28 - Helm v2.2 Continuity Pilot Calibration Review

更新时间：2026-04-04
状态：In Progress
范围：v2.2 narrow continuity pilot calibration review slice

## 1. 目标

PR28 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 把 pilot cases 细分为更窄的 cohort，输出 cohort-level failure distribution、remediation outcome success rate 与 drift summary
2. 基于 cohort 数据复核 threshold / confidence band，给出 recalibrated threshold 与 risk-band 调整建议
3. 对 remediation outcome drift 做 cohort-level 趋势复核，识别 repeat ineffective posture 与 effectiveness change
4. 对照 SOP 命中率与 operator 处理结果，输出 operator-handling effectiveness summary，并把提醒保留在 continuity surface 内

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR28 计划 / 基线 / 报告文档

## 3. 关键假设

1. cohort review 仍只使用 repo 内 continuity runtime records、fixture 与 eval sample，不引入外部 telemetry 服务
2. threshold / confidence recalibration 只影响 operator-visible guidance 和 reviewed calibration output，不引入自动恢复编排
3. SOP 命中率与 operator 处理对照只服务 operator diagnosis，不会变成自动决策权
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 4. 风险

1. cohort 分层如果定义过宽，容易把窄 pilot sample 写成 production truth
2. threshold / confidence 再校准如果过于激进，可能把本来可恢复的链路过早压成 review-required
3. SOP 命中率和 operator 处理结果如果表达太粗，会误导 operator 以为已经形成自动效果评估系统

## 5. phase plan

### Phase 1

- pilot cohort substrate：
  - cohort key derivation
  - failure distribution by cohort
  - remediation success rate by cohort
  - drift summary by cohort

### Phase 2

- threshold / confidence recalibration：
  - cohort-level threshold suggestion
  - risk-band adjustment summary
  - confidence band revision note

### Phase 3

- drift review + operator-handling effectiveness：
  - drift metric review
  - repeat ineffective trend
  - SOP hit / skip / ineffective-after-hit summary
  - meeting detail / operator queue reminder

### Phase 4

- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard 同步

## 6. 验证方案

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-phase8`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 显式延期项

- continuity auto-remediation orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine

---

# PR26 - Helm v2.2 Continuity Pilot Calibration And Remediation Effectiveness

更新时间：2026-04-04
状态：Completed
范围：v2.2 narrow continuity pilot calibration / remediation effectiveness slice

## 1. 目标

PR26 继续只在 continuity surface 与 operator workflow 内收紧，不扩执行权：

1. 用 pilot-backed 规则重新校准 recovery state，确保 `STABLE / RECOVERABLE / REVIEW_REQUIRED / BLOCKED` 更贴近实际 continuity posture
2. 评估 bounded remediation action 的有效性，而不只是记录“执行过几次”
3. 把 repeated ineffective recovery pattern 升级成显式 operator-visible posture，避免低效恢复循环
4. 同步 evidence surface、runbook、eval、e2e 与 freeze 文档

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR26 计划 / 基线 / 报告文档

## 3. 关键假设

1. pilot calibration 仍采用可解释规则与 repo 内 pilot fixture，不引入黑盒评分器
2. remediation effectiveness 复用既有 remediation trace，不新增独立 execution 或 workflow authority
3. repeated ineffective recovery 只改变 diagnosis / guidance / state calibration，不新增高风险自动恢复
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 4. 风险

1. recovery state 校准如果过度保守，会把本来可恢复的 session 提前升级成 review-required
2. effectiveness 规则如果只看 latest attempt，可能误判有改善但尚未稳定的恢复链路
3. operator surface 如果同时新增 calibration 与 effectiveness 说明，摘要容易变得难读

## 5. phase plan

### Phase 1

- pilot-backed calibration substrate：
  - recovery state calibration profile
  - recovery accuracy summary
  - `replayStatus` / `payloadStateSource` / `failureTaxonomy` 对 recovery state 的校准解释

### Phase 2

- remediation effectiveness：
  - effective / partial / ineffective / no_signal classification
  - repeated ineffective detection
  - ineffective loop 的 bounded escalation guidance

### Phase 3

- operator surfaces：
  - meeting runtime card 增加 calibration + effectiveness 摘要
  - operator queue 增加 repeat ineffective / recovery accuracy visibility
  - runbook 根据 effectiveness posture 调整下一步建议

### Phase 4

- eval fixtures / harness / tests / e2e
- baseline / acceptance report / docs index / guard 同步

## 6. 验证方案

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-phase6`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 收口结果

- runtime、surface、eval、e2e、freeze 文档、README 索引、self-check、boundary guard 均已同步
- ineffective reprune loop 的真实 current-main 链路比原始假设更保守：
  - raw recovery posture 已是 `REVIEW_REQUIRED`
  - calibration 维持 `REVIEW_REQUIRED -> REVIEW_REQUIRED · LOW`
  - no blind retry 仍保持成立
- 全量验证已通过，边界未扩张

## 8. 显式延期项

- continuity auto-remediation orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine

---

# PR27 - Helm v2.2 Continuity Pilot Effectiveness Review

更新时间：2026-04-04
状态：In Progress
范围：v2.2 narrow continuity pilot effectiveness review slice

## 1. 目标

PR27 继续只在 continuity surface 与 operator workflow 内推进，不扩执行权：

1. 把 runtime continuity pilot case 做成 operator-visible 分层统计，明确 top-tier failure classes 与 pilot-backed distribution
2. 对现有 calibration profile 做 pilot-backed review，输出 calibrated thresholds、confidence bands 与 failure-class 调整建议
3. 对 remediation outcomes 做 drift review，识别稳定改善、持续无信号与 repeated ineffective posture
4. 基于 failure class、drift 与 fidelity 证据补一层更细的 operator remediation SOP，并在 continuity surface 暴露提醒

## 2. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR27 计划 / 基线 / 报告文档

## 3. 关键假设

1. pilot review 仍只使用 repo 内 continuity runtime records、fixture 与 eval sample，不引入外部 telemetry 服务
2. calibration profile review 可以输出 threshold / confidence band 建议，也可以在当前 continuity surface 上收紧 operator-visible confidence，但不会扩 execution authority
3. remediation drift review 只属于 diagnosis / operator review，不引入 auto-remediation orchestrator
4. preserved boundaries 保持不变：
   - workspace-first
   - controlled-trial
   - judgement-first
   - recommendation != commitment
   - no auto-send
   - no broad auto-write
   - no execution-authority expansion
   - no second app tree
   - no route/query rewrite

## 4. 风险

1. pilot sample 当前仍偏窄，分层统计如果表达过头，会把 repo fixture 写成“大样本 production truth”
2. calibration review 如果直接驱动 state 收紧，可能把本来可恢复的链路过早压成 review-required
3. operator surface 如果同时塞入 distribution、drift、SOP 与 evidence，信息密度可能过高

## 5. phase plan

### Phase 1

- continuity pilot review substrate：
  - failure-class distribution
  - top-tier failure class summary
  - drift posture summary

### Phase 2

- calibration profile review：
  - calibrated threshold suggestion
  - confidence band review
  - failure-class adjustment summary

### Phase 3

- SOP refinement：
  - failure-class evidence checklist
  - escalation timing
  - common pitfall guidance
  - meeting detail / operator queue reminder

### Phase 4

- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard 同步

## 6. 验证方案

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-phase7`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 显式延期项

- continuity auto-remediation orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine
# PR53 - Capture Runtime Governance Deeper Slice

更新时间：2026-04-05
状态：Planned
范围：把 conversation capture 和直接 runtime mutation 的剩余 tenant-sensitive 写路径收进统一 capability seam，并补 org-admin support-pack 对 capture/runtime governance follow-through 的 readout

## 1. 目标

PR53 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把 conversation capture 的 `start / ingest / stop` tenant-sensitive 写路径接入统一 capability seam
2. 把直接 runtime mutation route 的 `meeting-ended ingest / meeting-facts confirm` 对齐到既有 governed-action capability
3. 把 capture/runtime governance 动作纳入 org-admin governance support-pack 和 settings governance readout，并在 capture surface 上补 capability-aware manage / read-only posture

## 2. 当前 truth

继承 PR42 / PR43 / PR44 / PR45 / PR46 / PR47 / PR48 / PR49 / PR50 / PR51 / PR52：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- settings / memory / programs / connector / import / commercial / workspace data / governed action / insight 的多批高风险写路径已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped retention / export / delete / auth-session posture 已有多层 readout

当前仍需下一层：

- `conversation-capture/start`、`conversation-capture/ingest`、`conversation-capture/[sessionId]/stop` 仍主要依赖 login + workspace session，没有进入 centralized capability seam
- `runtime/events/meeting-ended`、`runtime/memory/meeting-facts/confirm` 作为直接 API write / review path，仍只依赖登录态，没有对齐既有 governed-action capability
- `/capture` 主 surface 仍默认暴露录制入口，没有 capability-aware read-only posture
- org-admin governance support-pack 还看不到 capture/runtime governance follow-through

## 3. 范围

- `lib/auth/capture-runtime-governance.ts`（新增）
- `lib/auth/authorization.ts`
- `components/providers/workspace-ui-provider.tsx`
- `components/layout/app-shell.tsx`
- `app/(workspace)/layout.tsx`
- `features/conversation-capture/start-recording-button.tsx`
- `features/conversation-capture/capture-session-panel.tsx`
- `app/(workspace)/capture/page.tsx`
- `app/api/conversation-capture/start/route.ts`
- `app/api/conversation-capture/ingest/route.ts`
- `app/api/conversation-capture/[sessionId]/stop/route.ts`
- `app/api/runtime/events/meeting-ended/route.ts`
- `app/api/runtime/memory/meeting-facts/confirm/route.ts`
- `lib/auth/org-admin-governance.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- broader capture platform / media platform
- broader runtime orchestration platform
- execution authority expansion
- auto-send / broad auto-write

## 5. 风险

1. 如果 capture 仍停留在“登录即可写”，tenant-sensitive transcript ingest 会继续绕开 fixed-role capability matrix
2. 如果 runtime direct mutation route 不对齐既有 governed-action capability，route / server-action / surface 之间会继续出现 authz drift
3. 如果 support-pack 仍看不到 capture/runtime follow-through，租户治理 truth 会继续低估这条写入链路
4. 如果本轮顺手扩成 broader runtime platform 或 full media/capture platform，会偏离 Helm 当前 fixed-role 和 controlled-trial 边界

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 锁定 scope、truth、risk、validation

### Phase 1

- 新增 shared capture/runtime governance helper
- 把 capture start / ingest / stop 和 runtime direct mutation route 接入 capability seam

### Phase 2

- 扩 `WorkspaceUiProvider` 和 `/capture` 主 surface
- 增加 capability-aware manage / read-only posture

### Phase 3

- 扩 `org-admin governance` summary / support-pack
- 加入 capture/runtime governance 的 30d 计数与 latest marker

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 8. 明确延期项

- full RBAC / custom role builder
- enterprise IAM / SSO / SCIM
- org hierarchy / shared billing
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform / governance center
- broader capture / runtime orchestration platform
- execution authority expansion

# PR52 - Insight Governance Deeper Slice
# PR54 - Webhooks Tenancy Mapping And Retention Governance

更新时间：2026-04-05
状态：Completed
范围：收紧外部 billing webhook 的 tenant mapping / authn truth，盘点剩余非路由敏感写路径并纳入治理 inventory，继续深化 export / delete / retention 的 tenant-scoped governance

## 1. 目标

PR54 继续保持 `workspace-first`、`membership-backed`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 把外部 webhook / notify callback 的 workspace mapping、authenticity 和 unresolved posture 讲清楚，并补齐最小必要治理
2. 盘点并收回剩余非路由 sensitive write path 的 capability / ownership inventory
3. 深化 export / delete / retention 的 tenant-scoped governance、support-pack follow-through 和 operator readout

## 2. 当前 truth

继承 PR42-PR53：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- current-main session-backed sensitive write routes 已补 tenant ownership helper
- org-admin governance support-pack 已成立，并能显示 export / delete / retention latest marker 与 workspace isolation assertions

当前仍需下一层：

- Stripe / Alipay / WeChat Pay webhook 虽有签名校验和 workspace resolution，但仍属于外部 callback 例外，缺少更系统的 tenancy mapping truth 与 unresolved governance readout
- 仍存在非 route 的写入口需要系统 inventory，避免“route 全 guarded”被误写成“所有写操作全治理”
- retention / delete governance 仍是 posture + audit snapshot，不是更深的 governance follow-through

## 3. 范围

- `app/api/billing/stripe/webhook/route.ts`
- `app/api/billing/alipay/notify/route.ts`
- `app/api/billing/wechat-pay/notify/route.ts`
- `lib/billing/integration.ts`
- `lib/auth/org-admin-governance.ts`
- `app/api/settings/org-admin/support-pack/route.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- 剩余非路由 write inventory 所涉及的 capability / ownership seam
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- execution authority expansion
- auto-remediation / auto-send / broad auto-write

## 5. 风险

1. 如果把 webhook callback 直接套成 session-based ownership，会混淆外部 provider callback 和内部 user write 两种边界
2. 如果只补 webhook authn 不补 unresolved workspace / audit posture，operator 仍看不到 callback tenant truth
3. 如果不盘点非路由写路径，就无法诚实回答 capability governance 覆盖率
4. 如果把 retention / delete 误写成完整 policy engine，会越过当前受控试点边界

## 6. 阶段

### Phase 0

- 创建计划文档
- 更新 `PLANS.md`
- 固化 webhook / non-route write / data governance inventory

### Phase 1

- 补 webhook tenancy mapping / authn / unresolved posture
- 明确 callback exception 的治理边界

### Phase 2

- 盘点并补剩余非 route sensitive write inventory
- 收进 capability / ownership governance seam

### Phase 3

- 扩 org-admin governance summary / support-pack / settings/operator readout
- 强化 export / delete / retention 的 owner attribution、latest marker、workspace-scoped assertion

### Phase 4

- docs / guards / tests / baseline / report / full validation / stacked PR

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

# PR53 - Capability And Tenant Ownership Governance

更新时间：2026-04-05
状态：Completed
范围：盘点并补齐 current-main sensitive write route 的 capability governance 与 tenant ownership guard，并把 export / delete / retention deeper governance 收到 org-admin support pack 与 settings/operator surface

## 1. 目标

PR53 继续保持 `workspace-first`、fixed-role capability matrix、`Workspace == current tenant boundary`，不做 full RBAC，不做 enterprise IAM，不改 app tree，也不扩 execution authority。

本轮只做三件事：

1. 列出并补齐当前剩余 sensitive write route 的 tenant ownership 断言与 capability governance
2. 把 export / delete / retention 的 deeper governance 视图、owner attribution、workspace isolation assertion 收进 org-admin support pack
3. 在 settings/operator surface 上展示治理状态与 audit 统计

## 2. 当前 truth

继承 PR42-PR52：

- DB-backed auth session 已成立
- fixed-role capability matrix 已成立
- 多批高风险 write path 已 capability 化
- org-admin governance support-pack 已成立
- tenant-scoped export / delete / retention posture 已有前几层 readout

当前仍需下一层：

- 部分 sensitive write route 还缺少显式 tenant ownership helper
- export / delete / retention 的 latest audit marker 还缺 owner attribution 和 isolation assertion
- 现有过窄 PR53 plan 不能准确描述本轮真实实现范围

## 3. 范围

- `lib/auth/tenant-ownership.ts`
- `app/api/memory/export/route.ts`
- `app/api/memory/facts/*`
- `app/api/blockers/*`
- `app/api/commitments/*`
- `app/api/conversation-capture/*`
- `app/api/runtime/*`
- `app/api/helm-v2/runtime/*`
- `app/api/imports/*`
- `app/api/recommendations/[id]/feedback/route.ts`
- `app/api/evolution/strategy-suggestions/*`
- `features/recommendations/actions.ts`
- `features/meetings/actions.ts`
- `lib/auth/org-admin-governance.ts`
- `features/settings/settings-client.tsx`
- docs / guards / tests

## 4. 不做

- full RBAC builder
- SSO / SCIM / domain claim
- org hierarchy
- schema-per-tenant / db-per-tenant
- broader tenant-admin platform
- execution authority expansion

## 5. 风险

1. 如果 ownership 只补 route 不补 support-pack/readout，治理 truth 仍不完整
2. 如果 provider callback / analytics track route 被混入 tenant-object ownership 口径，会造成假覆盖率
3. 如果 export route 的 workspace scope 仍依赖裸 query string，会留下 400/404 语义和 type safety 问题

## 6. 阶段

### Phase 0

- 扩计划文档与 `PLANS.md`
- 盘点 inventory 与例外项

### Phase 1

- 补 tenant ownership helper 和 export route type/ownership correctness

### Phase 2

- 扩 org-admin governance summary / support-pack deeper view

### Phase 3

- 更新 settings/operator surface

### Phase 4

- docs / guards / tests / report / validation

## 7. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
# PR77 - Design Principles UI Refresh

更新时间：2026-04-06
状态：Completed
范围：按 `DESIGN.md` 收紧 dashboard、internal operating、settings，并扩到 approvals、memory、meeting detail 六个核心 surface 的视觉语言、操作流、智能提示、自动填充辅助、布局偏好与响应式/无障碍基础；不扩 execution authority，不把全站 UI 重写成平台工程

## 1. 目标

PR77 只做四件事：

1. 把 `DESIGN.md` 的 light-first、decision-first、judgement-first 设计语法正式落到共享 UI 基础层
2. 重做 dashboard、internal operating、settings、approvals、memory、meeting detail 六个核心 surface 的顶部结构和 guidance flow
3. 增加 layout density、guidance mode、form assist 三个用户可控偏好，形成可访问、可响应的最小 UI 自定义层
4. 把本轮 truth 收成 baseline / report / README / docs index / self-check / boundary-check

## 2. 当前 freeze truth

当前基线继承：

- `DESIGN.md`
- `HELM_ENTERPRISE_READINESS_SEQUENCED_HARDENING_BASELINE_V1.md`
- `HELM_AUTH_ANOMALY_GOVERNANCE_CONTINUATION_NEXT_SLICE_BASELINE_V1.md`

当前已经成立：

- `DESIGN.md` 已明确 light-first、border-first、judgement-first 视觉方向
- dashboard / internal operating / settings / approvals / memory / meeting detail 已有稳定数据面和 operator readout
- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`

当前本轮要补齐：

- shared workspace UI preferences substrate
- shared guidance panel
- dashboard / internal operating / settings / approvals / memory / meeting detail 的统一顶部 guidance 结构
- form assist / pilot preset 的最小辅助层
- PR77 baseline / report / guards

当前仍未成立：

- 全站统一 redesign
- drag-and-drop layout builder
- server-side personalized layout profile
- automatic action execution
- auto-send / broad auto-write

## 3. 本轮要证明什么

PR77 要证明：

1. `DESIGN.md` 不只是视觉备忘录，而是已经进入当前主路径页面结构
2. 推荐、提醒、自动填充和引导流程可以先以 review-first/operator-first 方式成立，不需要越界成自动执行
3. 布局偏好和表单辅助可以先形成 local, accessible, responsive truth，而不是先做 full preference platform

## 4. 精确闭环

`DESIGN.md -> shared UI substrate -> dashboard / operating / settings refresh -> approvals / memory / meeting detail refresh -> baseline/report/guards -> validation`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是 full design system platform
- 当前仍不是 automatic workflow / orchestration UI

## 6. 范围

- `app/globals.css`
- `components/providers/workspace-ui-provider.tsx`
- `components/shared/*workspace-*`
- `features/dashboard/*`
- `features/internal-operating-workspace/*`
- `features/approvals/*`
- `features/memory/*`
- `features/meetings/meeting-detail-client.tsx`
- `features/settings/*`
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `docs/product/*PR77 baseline*`
- `docs/reviews/*PR77 plan/report*`

## 7. 不做

- 全站 redesign
- full drag-and-drop layout builder
- server-side preference sync
- workflow automation UI
- execution-authority expansion
- Docker / Kubernetes / CI implementation

## 8. 风险

1. 如果把智能提示写成自动执行，会越过当前治理边界
2. 如果把 form assist 写成强侵入默认流，会破坏 operator judgement-first posture
3. 如果只改视觉不改 guidance flow，会出现“看起来更新但操作流没变”的伪 redesign

## 9. 阶段计划

### Phase 0

- 复核 `DESIGN.md` 与当前核心 surface
- 冻结 PR77 计划
- 状态：Completed

### Phase 1

- shared workspace UI substrate
- globals/design token 收紧
- 状态：Completed

### Phase 2

- dashboard / internal operating / settings redesign
- guidance / reminder / preferences / form assist 接入
- 状态：Completed

### Phase 3

- approvals / memory / meeting detail redesign
- guidance / reminder / preferences / form assist 接入
- 状态：Completed

### Phase 4

- baseline / report / README / docs index / guards
- 状态：Completed

### Phase 5

- 完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
# PR78 - Design Detail Accessibility Next Slice

更新时间：2026-04-07
状态：Completed
范围：只做 contact detail、company detail、inbox 三个 detail-heavy/operator-heavy surface 的 guidance-first / preference / form-assist 收口；不做全站 redesign、server-side preference sync、drag-and-drop layout builder、workflow automation UI、execution-authority expansion

## 1. 目标

PR78 只做四件事：

1. 把 `DESIGN.md` 的 judgement-first / decision-first 语法扩到 contact detail、company detail、inbox
2. 让三处 surface 接入 shared guidance panel、shared preferences 与 form-assist
3. 收口 detail-heavy / operator-heavy surface 的可访问性与移动端顶部结构
4. 同步 baseline / plan / report / README / docs index / self-check / boundary-check / pilot-readiness

## 2. 当前 freeze truth

当前基线继承：

- `HELM_DESIGN_PRINCIPLES_UI_REFRESH_BASELINE_V1.md`
- `DESIGN.md`

当前已经成立：

- shared UI substrate
- `WorkspaceGuidancePanel`
- `WorkspaceSurfacePreferences`
- `layoutDensity / guidanceMode / formAssistEnabled`
- dashboard / internal operating / settings / approvals / memory / meeting detail 六个核心 surface 的统一 guidance-first 结构

当前本轮要补齐：

- contact detail 顶部 guidance / preference / form-assist
- company detail 顶部 guidance / preference / form-assist
- inbox 顶部 guidance / preference / form-assist
- detail-heavy surface 的更完整响应式与无障碍说明

当前仍未成立：

- 全站 redesign
- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 3. 本轮要证明什么

PR78 要证明：

1. PR77 的 design substrate 可以扩到 detail-heavy / operator-heavy surface，而不是只停留在六个核心页面
2. contact / company / inbox 都能用同一套 guidance-first 结构表达 judgement、boundary、assist 和 review-first next step
3. 智能辅助仍然只成立为 recommendation / assist，不写成自动执行 truth

## 4. 精确闭环

`shared guidance/preference substrate -> contact/company/inbox redesign -> baseline/report/README/docs/guards -> 完整验证链`

## 5. 保留边界

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`
- 当前仍不是全站 redesign / workflow automation UI / auto-execution plane

## 6. 范围

- `features/contacts/contact-detail-client.tsx`
- `features/companies/company-detail-client.tsx`
- `features/inbox/inbox-client.tsx`
- PR78 baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- `PLANS.md`

## 7. 不做

- 全站 redesign
- server-side preference sync
- drag-and-drop layout builder
- workflow automation UI
- execution-authority expansion

## 8. 风险

1. 如果 detail-heavy surface 不接 shared guidance/preference substrate，设计语言会重新分叉
2. 如果把 form-assist 写成自动动作，会越过 `judgement-first / review-first` 边界
3. 如果只改页面不补 guards/readme/docs，后续 freeze truth 会失真

## 9. 阶段计划

### Phase 0

- 复核 `DESIGN.md` 和 PR77 shared substrate
- 状态：Completed

### Phase 1

- 重做 contact detail / company detail / inbox 顶部结构
- 接 guidance / reminders / preferences / form-assist
- 状态：Completed

### Phase 2

- 同步 baseline / report / README / docs / guards / pilot-readiness
- 状态：Completed

### Phase 3

- 运行完整验证链
- 状态：Completed

## 10. 验证

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
