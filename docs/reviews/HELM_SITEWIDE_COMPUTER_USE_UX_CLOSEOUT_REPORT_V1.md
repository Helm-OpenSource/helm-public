---
status: archived
owner: helm-core
created: 2026-04-24
review_after: 2026-10-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Sitewide Computer Use UX Closeout Report V1

## 1. Conclusion

本轮继续按真实用户浏览路径复评 Helm 页面，而不是只看截图或单页源码。Computer Use 成功读取 Safari 并复现：`/demo`、`/?view=public#entry`、`/dashboard` 在 Safari 里仍可能停在全局 RSC loading fallback。该问题不能只靠等待解决，因此本轮把 fallback 收成真实可操作入口，并继续用 Playwright 对桌面与移动高频路由做宽扫描。

本轮修复后：

- 全局 loading fallback 不再说“正在打开你的经营入口”，而是中性说明 `正在准备当前页面`。
- fallback 顶层动作变成 `重试当前页面 / 打开公开首页 / 回到登录入口 / 打开演示入口`，并把 `打开工作台` 放入工作区恢复快捷入口，公开首页不再藏在底部小链接。
- demo recovery 目标回到稳定 `/demo`，不再从 fallback 导回公开首页造成二次卡住感。
- shell 导航、面包屑和页面 story 把 `/reports` 从 `领导` 统一为 `领导周报 / Leadership report`。
- 共享摘要、guidance、证据卡、搜索结果、机会/会议/收件箱/周报等高频卡片补短 `aria-label`，Computer Use / 辅助导航不再把整段说明读成动作名。
- `/dashboard`、`/operating`、`/search` 与机会详情抽屉继续清理自我说明、英文实现词和过度承诺文案，优先呈现状态、待决策、下一步动作和边界。
- 命令面板、通知中心、快速创建、移动导航、现场记录、会议动作编辑、审批与机会详情抽屉补充双语 `closeLabel`，避免中文界面仍读出默认 `Close panel`。
- 第三轮真实浏览继续覆盖 `/settings`、`/imports`、`/inbox`、`/analytics`、`/diagnostics` 与命令面板，继续清掉“这页应该先...”类系统旁白、`当前推导锚点`、`事件埋点`、`blocker/deals/notes/recommendation/today focus` 等 raw 种子词，以及分析/诊断里直接暴露的事件键、模型键和对象键。
- 第四轮继续按登录态真实路径深扫到动态详情页：修掉 disclosure / link 的超长可访问动作名、会议详情重复 H1、CRM 导入状态裸值、报告和设置里的 raw 种子词、`阻碍 / 阻塞` 不一致，以及历史会议简报快照仍原样显示旧词的问题。
- 最终复扫覆盖 25 条登录态路由、桌面 / 移动 50 个检查点；禁词、重复 H1、长控件名、页面级横向溢出和业务 console error 均为 0。
- 本轮继续深扫 37 个真实登录态检查点，继续修复计费设置、权限治理、贡献方门户、合作项目、成功检查和扩展审查中的历史 seed 英文词、系统术语和复核语。最后对 15 个高风险检查点复扫，raw system term 为 0。
- 本轮继续从 `/demo` 进入销售演示后复扫 21 条高频路由，发现审批、记忆、周报、计费设置、导入、冲突处理和机会页仍露出 `May prepare...`、`Read commercial context...`、`Memory -> first loop`、`owner/operator`、`review posture`、`meeting-to-action runtime` 等实现词。修复后 42 个桌面 / 移动 raw 文案检查点为 0，UI / UE 结构检查点也为 0。
- 本轮第七次继续从 `/demo` 点击销售演示真实入口进入登录态，先聚焦 `/operating` 和 4 个角色接手页，发现 `Helm v2 ingested ... into...` 仍以截断事件标题露在关键决策和待拍板列表里；修复后这 5 条路径命中为 0。
- 第七次 broad crawl 继续访问 90 个演示组织站内页面，目标内部术语、混杂英文实现词和权限系统词命中为 0，导航错误为 0。
- 本轮第八次继续从 `/demo` 点击销售演示真实入口进入登录态，深扫 35 条实际可达站内路径，发现会议链路、复核请求、客户成功、承诺强化/可发送性、记忆、机会、分析页仍有第二层 `first loop / review request detail / reinforcement / sendability / owner / ADVANCING` 与截断 JSON 摘要泄漏；修复后同一路径复扫 `issueCount: 0`。
- 本轮第九次继续从 `/demo` 进入销售演示后复扫 29 条真实路径，桌面和移动同时覆盖。发现 `/dashboard` 推荐解释仍泄漏 `INTERNAL_SYNC / ADVANCING`，`/operating` 运行队列暴露 `runtime operator queues / operator judgement / critical gap` 且卡片链接可访问名称过长，`/capture`、`/memory`、`/review-requests/*` 仍直接显示 `NEXT_STEP / CONTENT_UPDATE / SCHEDULE_INTERVIEW / DRAFT_EXTERNAL_EMAIL / UPDATE_OPPORTUNITY_STAGE`，会议运行卡仍暴露 `Helm v2.1 runtime hardening / trusted / untrusted` 等二层运行术语。修复后同一批 29 条路径 x 2 视口回扫 `issueCount: 0`。
- 本轮第十次继续从 `/demo` 点击销售团队演示进入登录态，先扫 20 条核心路径 x 2 视口，再从核心页面真实链接进入 30 条详情 / 二级路径 x 2 视口。发现 Radix Select / Switch 在 Computer Use 路径里仍有空动作名，会议详情和沟通链路详情仍泄漏 `INTERNAL_SYNC`、`summary / risk context`、`next step`，设置策略页仍露出 `owner`，导入详情仍露出 `NEEDS_REVIEW`。修复后 9 条失败详情 / 设置路径 x 2 视口回扫 `issueCount: 0`，核心路径复扫除一次 `/operating` 8 秒脚本超时外无 UI / 文案问题；`/operating` 单独 20 秒重试返回 200、约 1.9 秒完成渲染且无横向溢出。
- 本轮第十三次继续从 `/demo` 点击销售团队演示进入登录态，沿 `/dashboard -> /operating -> /meetings/* -> /approvals` 和更宽的 25 条核心 / 详情路径在桌面与移动复扫。发现会议详情仍漏出 `WAITING_THEM / HIGH / 跟进 邮件`，沟通链路详情仍有 `Contact 详情 / accountable conversation / meeting follow-through` 等中英混排，以及 `/inbox/*` 详情因为 `pageNextAction` 超过 3 条被报告协议守卫拦截，导致只剩工作区外壳且没有 `h1`。修复后会议 / 运营 / 复核定向路径、inbox 详情直访、25 条真实路径 x 2 视口广扫全部 `issueCount: 0`，横向溢出为 0。
- 本轮第十四次改用创始人 / COO 与猎头顾问两个演示身份继续真实进入。发现 `/reports` 团队改进建议仍直接显示 `HIGH / MEDIUM`，猎头详情页展开证据层仍露出 `replay / audit / worker output / historical changes / judgement / shaping` 等二层实现词。修复后创始人和猎头两个身份各 25 条真实路径、桌面与移动共 100 个检查点复扫全部 `failures: []`。
- 本轮第十六次继续从创始人 / COO 演示真实进入，深扫 `/dashboard`、`/memory`、`/inbox`、`/customer-success`、`/settings`、`/diagnostics` 与会议详情。发现设置通知、客户成功、会议支持事实、推荐反馈、收件箱与诊断仍有 `brief / briefing / resource conflict / action item / inbound reply / recommendation` 等种子和系统词残留，并发现机会页批量选择 checkbox 没有可访问名称。修复后核心路径桌面 / 移动可见 raw copy、真实无标签控件和横向溢出复扫均为 `0`。
- 本轮第十七次继续用 Computer Use 做应用发现，并用真实浏览器路径从创始人 / COO 演示进入，沿核心页收集详情链接后转入 25 条高风险详情路径复扫。发现公司详情页仍有 `brief / owner` 以动作、toast、审计摘要和提示文案露出；修复后桌面 / 移动 25 条高风险详情路径展开详情层复扫全部 `failures: []`。
- 本轮第十八次继续尝试 Computer Use。工具仍能发现 Safari / Atlas 进程，但 Safari key-window 读取继续返回 `cgWindowNotFound`，因此浏览验证继续采用可重复的真实 Playwright 路径：`/demo` -> 点击 `进入创始人 / COO 演示` -> 打开核心页与失败详情页。新扫描发现 first-loop 回访锚点、`当前阻塞`、设置策略 enum、计费贡献方 raw 字段，以及联系人 / 公司 / 会议详情中的 `follow-up / briefing / materials / SUGGESTED` 等历史种子文案残留。修复后 12 条核心 / 详情路径 x 桌面 / 移动共 24 个检查点复扫全部 `failures: []`。
- 本轮第二十次继续尝试 Computer Use。Safari / Atlas 仍能被发现但 key-window 绑定不稳定，因此继续用真实浏览器路径巡检 `/operating`、通知中心、命令面板与 `/search`。发现 GTM 能力计划区块仍泄漏 `brief / proof pack / hypothesis / clean handoff / CustomerDemandBrief / ActionItem + ApprovalTask / review_required`，命令面板和通知标题仍需要同一套 seed copy 格式化，搜索页仍显示 `问 Helm`，搜索提交 fallback 缺少搜索恢复入口。修复后 `/operating` raw term、通知中心 raw seed、命令面板 raw seed 均为 `0`，搜索页改为 `问当前工作区 / 工作区问答`，全局与工作区 loading fallback 都提供 `打开全局搜索`。
- 本轮第二十一次继续尝试 Computer Use。Safari / Atlas 仍能被发现但 key-window 读取继续返回 `cgWindowNotFound`，因此继续用 in-app browser 保持真实浏览路径：`/demo` -> 点击 `进入创始人 / COO 演示` -> `/dashboard` -> 核心工作区路由。扫描发现 `/operating` GTM 顶部事项链接仍把长说明读成动作名，`/customer-success` 详情摘要连接也把描述拼进可访问名称；工作区 loading fallback 也缺少“留在当前路径重试”的第一动作。修复后 `/operating`、`/customer-success`、`/opportunities`、`/diagnostics`、`/search?mode=ask&q=Atlas` 均真实渲染，fallback、超长控件名、空控件名和目标 raw term 均为 `0`。
- 本轮第二十二次继续按同一路径进入工作区，重点扫设置权限、导入、门户、公开计划和动态详情页。发现 `/settings?tab=permissions` 的组织治理支持包仍露出 `NEEDS_REVIEW / ApprovalTask / Entry-source truth`，成功检查、扩展复盘、公司详情、复核请求和收件箱详情仍把整段交接说明读成链接动作名，导入任务详情仍露出 `CONTACT` 类型枚举。修复后 19 条设置/导入/门户/计划/核心路由、3 条公开计划详情、动态详情复扫均无目标 raw term、空控件名或超长控件名。
- 本轮第二十三次继续尝试 Computer Use。工具仍能列出 Safari 与 Atlas，但两个 key-window 读取继续返回 `cgWindowNotFound`，因此继续用 in-app browser 保持真实路径：`/demo` -> 点击创始人 / COO 演示 -> `/dashboard` -> 表单、设置、导入、对象列表与详情。扫描发现 `/capture` 刷新建议对象仍显示 `CONTACT / COMPANY`，CRM 导入和冲突页仍有 Accounts/Contacts/Contact 与外部技术 ID，连接器治理面泄漏 `blocked / not requestable / policy_external_write_never_allowed / evidence_detail_needs_review` 等内部原因码，`/search?mode=ask&q=Atlas` 仍暴露 `CONTACTED / contact / company / opportunity / workspace_context`，并且 `/contacts`、`/companies` 顶层 404。修复后这批路由全部真实渲染，对象类型、受控写回原因、CRM 外部引用、Ask 搜索 badge 和对象列表卡片动作名都变成用户可读表达。
- 本轮第二十四次继续尝试 Computer Use。Safari / Atlas 仍能被发现但 key-window 读取继续返回 `cgWindowNotFound`；in-app browser 对公开路由会卡在全局 loading，因此用 HTTP 与 Chromium 真实渲染对照确认。扫描发现 `/dashboard` 资源影响面板、设置连接器/权限/计费、结算批次与贡献方字段仍泄漏 `route_to_review / resource_not_actionable / cal_id / helm_team_v1 / OPPORTUNITY_STAGE_CHANGED / settlement_2026_04` 等内部键；公开计划详情还存在 `邀请d / partner application / 归因 line / referral 的` 以及能力贡献者计划的中文替换不顺。修复后设置与计费复扫 raw term 为 0，`/portal` 未登录路径改成明确的贡献方门户入口，公开计划和门户在 Chromium 真实渲染中无 `NEXT_REDIRECT`、泛 recovery、错字或内部键命中。
- 本轮第二十五次继续尝试 Computer Use。Safari / Atlas 仍能被发现但 key-window 读取继续返回 `cgWindowNotFound`；因此继续沿真实浏览路径 `/demo` -> 点击 `进入创始人 / COO 演示` -> 核心工作区路由，用 Chromium 对桌面与移动做复扫。发现 `/operating`、`/reports`、`/memory`、`/capture`、`/settings?tab=connectors`、`/imports/crm` 仍有 `RECOMMENDATION_GENERATED / decision-first / AUTH SESSION / SYSTEM INFERENCE / OPEN / CONNECTED / MOCK / MANUAL_CAPTURE / HUMAN INPUT / PROOF` 等用户可见实现词。修复后 6 条核心路由 x 2 视口复扫全部命中为 0。
- 同轮继续做 60 条真实可达链接广扫，唯一新增残留是 `/getting-started` 的中文引导文案仍露出 `review-first` 以及 `orientation / first-value / first-entry truth` 这类内部术语。修复后 `/getting-started` 与 60 条登录态 / 公开可达路径复扫全部命中为 0。

## 2. Affected Components

- `app/loading.tsx`
- `app/(workspace)/loading.tsx`
- `app/portal/page.tsx`
- `app/portal/loading.tsx`
- `app/programs/loading.tsx`
- `lib/billing/program-catalog.ts`
- `features/participant-portal/participant-portal-client.tsx`
- `features/participant-portal/queries.ts`
- `lib/presentation/loading-recovery.ts`
- `lib/i18n/messages.ts`
- `lib/navigation/breadcrumb-trail.ts`
- `lib/presentation/workspace-story.ts`
- `components/shared/object-context-operating-summary.tsx`
- `components/shared/workspace-guidance-panel.tsx`
- `components/shared/narrative-components.tsx`
- `components/shared/workspace-surface-preferences.tsx`
- `components/shared/controlled-disclosure.tsx`
- `components/shared/detail-operating-summary-card.tsx`
- `components/shared/commitment-card.tsx`
- `components/shared/home-surface-secondary-disclosure.tsx`
- `components/shared/operating-foundation-summary.tsx`
- `components/shared/simplified-guidance-panel.tsx`
- `components/ui/badge.tsx`
- `components/ui/select.tsx`
- `components/ui/switch.tsx`
- `app/(workspace)/meetings/page.tsx`
- `app/(workspace)/search/page.tsx`
- `lib/gtm-capability-plan-readout.ts`
- `app/(workspace)/dashboard/page.tsx`
- `components/layout/command-palette.tsx`
- `components/layout/alert-display-copy.ts`
- `components/layout/topbar.tsx`
- `components/shared/first-loop-surface-summary.tsx`
- `features/approvals/approvals-client.tsx`
- `features/conversation-capture/capture-result-panel.tsx`
- `features/conversation-capture/capture-session-panel.tsx`
- `features/conversation-capture/display-copy.ts`
- `app/(workspace)/contacts/page.tsx`
- `app/(workspace)/companies/page.tsx`
- `features/companies/actions.ts`
- `features/companies/company-detail-client.tsx`
- `features/customer-success-handoff/display-copy.ts`
- `features/customer-success-handoff/detail-model.ts`
- `features/customer-success-handoff/external-drafts-panel.tsx`
- `features/dashboard/home-surface-routing.ts`
- `features/dashboard/home-work-entry-surface.tsx`
- `features/inbox/inbox-client.tsx`
- `features/imports/crm-import-client.tsx`
- `features/imports/display-copy.ts`
- `features/imports/import-conflicts-client.tsx`
- `features/imports/import-job-detail-client.tsx`
- `features/meetings/meeting-detail-client.tsx`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/meetings/meeting-v2-ingestion-retrieval-card.tsx`
- `features/meetings/display-copy.ts`
- `features/memory/display-copy.ts`
- `features/memory/memory-client.tsx`
- `features/opportunities/opportunities-client.tsx`
- `features/opportunities/display-copy.ts`
- `features/package-stage-variants/detail-model.ts`
- `features/proposal-package/detail-model.ts`
- `features/reports/display-copy.ts`
- `features/reports/engineering-delivery-review-panel.tsx`
- `features/reports/engineering-delivery-review-panel.test.ts`
- `features/reports/reports-client.tsx`
- `features/settings/components/account-settings-tab.tsx`
- `features/settings/components/tenant-resource-readiness-panel.tsx`
- `features/settings/components/billing-program-catalog-panels.tsx`
- `features/settings/components/billing-attribution-detail-panels.tsx`
- `features/settings/components/billing-participant-portal-panels.tsx`
- `features/settings/components/billing-settlement-line-panels.tsx`
- `features/settings/components/billing-settlement-exception-panels.tsx`
- `features/settings/setup-wizard.tsx`
- `features/settings/display-copy.ts`
- `features/settings/tenant-resource-readiness-display.ts`
- `features/settings/member-definition-card.tsx`
- `features/settings/settings-client.tsx`
- `features/participant-portal/participant-portal-client.tsx`
- `features/participant-portal/participant-portal-onboarding-client.tsx`
- `lib/auth/public-entry.ts`
- `features/success-check/detail-model.ts`
- `features/expansion-review/detail-model.ts`
- `features/analytics/analytics-client.tsx`
- `features/analytics/display-copy.ts`
- `features/role-conversation-variants/display-copy.ts`
- `features/conversation-chain-extension/detail-model.ts`
- `features/inbox-followup-review-request/detail-model.ts`
- `features/inbox-followup-review-request/detail-model.test.ts`
- `features/commitment-reinforcement-sendability/detail-model.ts`
- `features/commitment-reinforcement-sendability/detail-view.tsx`
- `features/customer-success-handoff/queue-model.ts`
- `features/diagnostics/display-copy.ts`
- `app/portal/access/[token]/page.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `lib/presentation/first-loop-surface-summary-display.test.ts`
- `lib/presentation/seeded-business-copy.ts`
- `lib/billing/china-renew-restore.ts`
- `lib/billing/payment-providers.ts`
- `lib/billing/integration.ts`
- `lib/billing/lifecycle-boundary.ts`
- `lib/billing/program-catalog.ts`
- `lib/connectors/dingtalk-ingestion.ts`
- `lib/connectors/salesforce.ts`
- `lib/connectors/wecom-ingestion.ts`
- `lib/conversation-capture/conversation-action-bridge.service.ts`
- `lib/conversation-capture/conversation-understanding.service.ts`
- `lib/auth/action-governance.ts`
- `lib/auth/import-governance.ts`
- `lib/auth/insight-governance.ts`
- `lib/auth/settings-governance.ts`
- `lib/auth/workspace-data-governance.ts`
- `lib/auth/openclaw-runtime-governance.ts`
- `lib/internal-operating-workspace/foundation.ts`
- `lib/recommendations/recommendation-ranking.service.ts`
- `lib/recommendations/recommendation-presentation.ts`
- `lib/helm-v2/draft-comms-handoff-runtime.ts`
- `lib/helm-v2/opportunity-judge-runtime.ts`
- `lib/llm/prompt-registry.ts`
- `lib/recommendations/recommendation-feedback.service.ts`
- `lib/memory/briefing.service.ts`
- `lib/operating-system/object-state.ts`
- `lib/operating-system/first-loop.ts`
- `lib/worker-skill-resource/presentation.ts`
- `data/constants.ts`
- corresponding tests and boundary guard markers

## 3. Computer Use Findings

Computer Use path:

1. Safari started from an existing logged-in `/dashboard` and confirmed the real shell could render.
2. Direct navigation to `http://localhost:3000/demo` showed global fallback instead of the full demo chooser.
3. The fallback now exposes separate accessible actions: `打开公开首页`、`回到登录入口`、`重试打开工作台`、`打开演示入口` and the three demo workspace buttons.
4. Clicking `打开公开首页` moves Safari to `/?view=public#entry` with the same recoverable fallback if the page reveal does not complete.
5. Clicking `进入销售团队演示` from fallback redirects to `/dashboard`; Safari may still stay on fallback, so the fallback must remain a real recovery surface.
6. From the rendered `/dashboard`, Computer Use exposed meta copy such as “系统为什么/解释重新长回首页/继续推进只服务工作恢复”；these were converted into direct operating language about attention, trust boundaries and resuming work.
7. From sidebar navigation into `/operating`, Computer Use exposed mixed Chinese/English implementation terms such as `pipeline list`、`proposal`、`sendability`、`meeting -> memory`、`result -> object summary` and `页面偏好 / 治理真值 / 重设计页面`; these were converted into Chinese operating terms.
8. From top search with `Cedar`, the fallback was found to lose the current search intent; `重试当前页面` now retries the active URL, while `打开工作台` remains a separate recovery action.
9. From search result navigation into an opportunity detail drawer, Computer Use exposed overclaiming drawer copy and default/ambiguous close semantics; the drawer now explains review-first progression and exposes localized close labels.
10. From `/settings`, Computer Use exposed self-narration in the business summary and mixed seed notification text in the shell; the summary now starts from policy/model/ingress state, and shell alerts map raw seed terms into Chinese operating copy.
11. From `/imports`, Computer Use exposed “导入页应该先...” and implementation wording like `事件埋点`; the page now uses direct ingress trust language and `使用信号`.
12. From `/inbox`, Computer Use exposed “这页应该先...” and `阻碍/阻塞` inconsistency; the page now uses direct thread triage wording and consistent `阻塞`.
13. From `/analytics`, Computer Use exposed English guidance chips and raw event/object labels such as `memory timeline viewed`, `EmailThread`, `COMPANY BRIEFING`, and `auth`; Chinese mode now maps these through a display-copy layer before rendering.
14. From `/diagnostics`, Computer Use exposed `当前推导锚点` plus raw runtime strings such as `action creation`, `scale-ready`, `fact hit`, `SUMMARY`, `NEXT STEP`, `RISK SIGNAL`, and model keys; the first-loop readback now uses `当前回访锚点`, and diagnostics keys pass through Chinese operating labels.
15. Latest continuation: Computer Use could still list running apps and see `Safari浏览器 — com.apple.Safari`, but `get_app_state("com.apple.Safari")` returned `Apple event error -10005: cgWindowNotFound`; using the localized app name returned `appNotFound("Safari浏览器")`. The browser-window control boundary remains documented, and Playwright stayed the repeatable real-page path.
16. The final logged-in Playwright path entered `/demo`, clicked the sales demo entry, collected second-layer links from opportunities, meetings, customer success and search, then scanned static and dynamic routes on desktop and mobile.
17. Latest deeper continuation: Computer Use again listed Safari and Atlas, but both `get_app_state("com.apple.Safari")` and `get_app_state("com.openai.atlas")` returned `Apple event error -10005: cgWindowNotFound`. The repeatable browser path therefore stayed Playwright, but it still entered through `/demo` and clicked the real sales-demo entry before scanning.
18. The deeper Playwright BFS scanned 110 discovered routes before manual stop and exposed new issues on real pages: `/imports/conflicts` leaked `workflow control`, meeting details leaked `send authority`, memory audit replay leaked `Helm v2 ingested ... meeting-to-action runtime`, role handoff links still needed short accessible names, and several breadcrumb/action templates pointed at non-existent collection routes.
19. Follow-up fixes routed high-frequency templates to real collection pages, marked detail-only breadcrumb parents as non-navigable, shortened role-link accessible names, localized billing worker commercial labels, setup/import/conflict language, meeting runtime/audit labels, memory audit replay, and skill suggestion wording.
20. Latest deeper pass: Computer Use was intermittently available. It successfully listed Safari and returned the Safari window earlier in the run, then later returned `Apple event error -10005: cgWindowNotFound` for both Safari and Atlas. The repeatable validation path stayed Playwright, but it still began at `/demo`, clicked the real sales-demo entry, and then scanned settings, portal, program catalog and dynamic customer-success routes.
21. The latest scan found old database-seeded commercial copy still leaking `marketplace`, `manual settlement readiness`, `owner`, `Authority`, and adjacent English review terms. The fix added display-time cleanup for billing/commercial notes and program summaries, plus Chinese-first wording for portal, success-check and expansion-review surfaces. A follow-up targeted sweep across 15 high-risk checks returned 0 raw system terms.
22. Final tool check in this slice: `list_apps` returned `connectionInvalid`, and `get_app_state("com.apple.Safari")` / `get_app_state("Safari")` returned `Apple event error -10005: cgWindowNotFound`. The product findings above remain from the successful Computer Use windows and repeatable browser path scans; this final check confirms the desktop-control layer itself is currently intermittent.
23. Latest continuation: Computer Use could list Safari and Atlas but still could not read their key windows (`cgWindowNotFound`). The repeatable path entered through `/demo`, clicked the sales demo entry, then scanned 21 high-frequency routes. It exposed remaining user-visible implementation copy in approval resource contracts, memory first-loop labels, insight/import denied messages, billing lifecycle summaries, import conflict guidance and opportunity audit summaries. All of those were converted into Chinese decision/action/boundary language without changing the underlying permission or contract semantics.
24. Latest seventh continuation: Computer Use again listed Safari and Atlas, but both key-window reads returned `Apple event error -10005: cgWindowNotFound`. This pass therefore kept the same human-like browser path through Playwright: open `/demo`, click the sales demo entry, then navigate through `/operating` and role handoff routes before broad crawling discovered links.
25. The seventh pass found one remaining source class: truncated Helm v2 runtime event summaries were already inside user-facing decision attachments, so the previous full-sentence replacement did not catch `Helm v2 ingested ... into…`. The fix expanded the Chinese display-copy mapping and routed the shared First Loop summary through the operating page formatter.
26. Latest eighth continuation: Computer Use again listed Safari and Atlas, but both `get_app_state("com.apple.Safari")` and `get_app_state("com.openai.atlas")` returned `Apple event error -10005: cgWindowNotFound`. The repeatable real-user path stayed: open `/demo`, click the sales demo entry, then crawl reachable links.
27. The eighth pass found second-layer user-visible terms across detail and evidence surfaces: meeting chain details, review request details, customer-success queue copy, commitment reinforcement / sendability pages, memory facts, opportunity boundary copy, analytics event labels and meeting briefing snapshots. Fixes stayed display-layer focused, added JSON-summary extraction for truncated briefing strings, and did not change internal enum or permission contracts.
28. Ninth continuation: Computer Use again listed Safari and Atlas, but both key-window reads returned `Apple event error -10005: cgWindowNotFound`. The repeatable path therefore stayed Playwright, but still followed the same human route: enter `/demo`, click the sales demo entry, then revisit high-frequency surfaces and discovered detail links on desktop and mobile.
29. The ninth pass found shared display-layer leaks rather than new product-scope gaps: recommendation learned-pattern stage enums, runtime-operator queue labels, meeting ingestion/retrieval trace labels, memory correction types, capture fact types, review-request action types and customer-success post-send labels. Fixes kept internal enum values and permissions unchanged, and converted only what users and accessibility tools read.
30. Tenth continuation: Computer Use again listed Safari and Atlas successfully, but `get_app_state("com.apple.Safari")` and `get_app_state("com.openai.atlas")` still returned `Apple event error -10005: cgWindowNotFound`. The repeatable path therefore stayed Playwright, but it still began through `/demo`, clicked `进入销售团队演示`, and scanned the same visible routes a user would open.
31. The tenth pass found accessibility and display-layer issues in real pages: empty Select / Switch control names, stale meeting summary stage enum `INTERNAL_SYNC`, mixed `summary / risk context / review handoff / next step`, settings policy `owner`, and import item `NEEDS_REVIEW`. Fixes stayed at display and primitive-control layers and did not change internal enum, permission or import matching contracts.
32. Fourteenth continuation: Computer Use again reached app discovery, but both Safari and Atlas key-window reads returned `Apple event error -10005: cgWindowNotFound`. The repeatable path therefore stayed Playwright, but this time it entered through `/demo` as founder / COO and recruiting consultant personas, then followed visible page and detail links.
33. The fourteenth pass found two display-layer leaks: engineering report suggestion priority badges still rendered raw severity enums, and expanded role-detail evidence rows still rendered implementation labels such as `replay`, `audit`, `worker output`, `historical changes`, `judgement` and `shaping`. Fixes stayed display-only and preserved internal enum / evidence contracts.
34. Sixteenth continuation: Computer Use tool discovery succeeded and `list_apps` confirmed Safari and ChatGPT Atlas were running, but `get_app_state("com.apple.Safari")` again returned `Apple event error -10005: cgWindowNotFound`. The real-user browser path therefore stayed Playwright while preserving the same user route: open `/demo`, click `进入创始人 / COO 演示`, then navigate through core workspace routes.
35. This pass found two visible copy leaks after the prior broad cleanup: settings recent notifications still rendered raw seeded alert bodies, and meeting detail supporting facts still rendered raw memory fact content. Both now pass through the shared seeded-business / meeting display-copy layers.
36. This pass also separated scanner false positives from real accessibility issues: Radix `aria-hidden` select nodes were technical controls, while opportunity row/card checkboxes were real controls without names. The real checkboxes now expose `选择机会：...` / `Select opportunity: ...` labels.
37. Seventeenth continuation: Computer Use tool discovery still worked and confirmed Safari / Atlas were running, but Safari and Atlas key-window reads both returned `Apple event error -10005: cgWindowNotFound`. The repeatable path therefore stayed Playwright while preserving a human path: enter through `/demo`, click `进入创始人 / COO 演示`, browse core workspace pages, collect reachable details, then open high-risk detail routes directly.
38. The broad 80-route x 2-viewport expanded-detail scan was interrupted after exceeding the useful run window, then split into a bounded high-risk route set. That smaller pass found two real failures on company detail: `生成公司 brief` and `owner`-based responsibility copy. Fixes converted the visible copy to `公司简报 / 负责人` and routed generated detail snippets through the display formatter.
39. Eighteenth continuation: Computer Use tool discovery again listed Safari and Atlas, but `get_app_state("com.apple.Safari")` still returned `Apple event error -10005: cgWindowNotFound`. The repeatable browser path therefore stayed Playwright while preserving the same user entry: open `/demo`, click `进入创始人 / COO 演示`, then scan core pages and detail routes.
40. The eighteenth pass first corrected a false start caused by clicking the wrong demo entry, then scanned founder core routes and deeper detail routes. It found remaining display-layer leaks: first-loop `回访锚点`, `当前阻塞`, policy / billing raw enum fields, and contact/company/meeting detail seeded copy such as `follow-up`, `briefing`, `materials`, and `SUGGESTED`. Fixes stayed display-layer focused and did not alter internal enum, memory, billing or permission contracts.
41. Nineteenth continuation: Computer Use successfully drove Safari through `/demo` fallback, clicked `进入创始人 / COO 演示`, and exposed a real local-session problem: submitting from `127.0.0.1` returned `location: http://localhost:3000/dashboard#`, so native / no-JS recovery could lose cookies across hosts and fall back toward login or an indefinite loading state. `/demo/start` now builds its 303 target from the current local request host before falling back to forwarded host / request URL.
42. The same pass converted global loading recovery from login-first to work-path-first: top actions are now `重试当前页面 / 打开工作台 / 打开演示入口 / 打开公开首页`, login is an auxiliary link, the shortcut row covers `经营总盘 / 复核队列 / 经营记忆 / 机会推进`, and Computer Use caught and verified the `打开工作台` accessible name after a first mismatch. Playwright route sweeps confirmed core workspace routes render with no desktop / mobile horizontal overflow and no business console errors.
43. Twentieth continuation: Computer Use app discovery again confirmed Safari and ChatGPT Atlas were running, but `get_app_state("com.apple.Safari")`, `get_app_state("Safari")`, `get_app_state("com.openai.atlas")` and `get_app_state("ChatGPT Atlas")` could not bind a readable key window (`cgWindowNotFound` / timeout). The repeatable evidence path used the in-app browser runtime while preserving real user navigation through `/operating`, notification center, command palette and `/search`.
44. The real `/operating` path exposed remaining GTM first-screen and expanded-section copy leaks: `brief`, `proof pack`, `hypothesis`, `clean handoff`, `CustomerDemandBrief`, `ActionItem + ApprovalTask`, `review_required`, `evidence_needed` and `内部支持人 方案`. These now render as Chinese user-facing labels such as `简报`, `证据包`, `假设`, `交接检查`, `客户需求简报`, `动作项 + 审批任务`, `需要复核`, `需要证据` and `内部支持人方案`.
45. The notification center and command palette real overlays no longer expose raw seed terms in alert titles or bodies (`meeting_followup`, `contact_followup`, `champion`, `brief`); titles now pass through the same shell display formatter as bodies.
46. The `/search` route and search fallback path were tightened: user-facing labels now say `问当前工作区 / 工作区问答` instead of `问 Helm`, and both global and workspace loading fallbacks include `打开全局搜索` so a stuck search route has an immediate recovery action.
47. Twenty-first continuation: Computer Use again reached app discovery and confirmed Safari / Atlas were running, but both key-window reads returned `Apple event error -10005: cgWindowNotFound`. The repeatable browser evidence path stayed in the in-app browser while preserving a human route: enter `/demo`, click `进入创始人 / COO 演示`, land on `/dashboard`, then open core workspace routes.
48. The twenty-first pass found two real accessibility issues and one recovery-flow gap: `/operating` GTM work-item links still exposed full card prose as the action name, `/customer-success` detail summary connections included long descriptions in the accessible name, and workspace-level loading fallback did not offer a first-class current-page retry. Fixes shortened those action names and added `重试当前页面` before search/dashboard/review recovery actions.
49. Twenty-second continuation: Computer Use app discovery still worked while Safari / Atlas key-window reads still returned `cgWindowNotFound`. The repeatable route stayed in the in-app browser: enter `/demo`, click the founder / COO demo entry, then scan settings tabs, imports, portal, public programs and dynamic workspace details.
50. The twenty-second pass found the next display/accessibility layer: org-admin governance markers leaked `NEEDS_REVIEW`, `ApprovalTask` and an English boundary note; role/detail summary links included long handoff descriptions in the accessible name; import job rows exposed object-type enums such as `CONTACT`. Fixes stayed display-only: governance formatters now localize marker target/status/type labels, role-detail summary links use short action names, and CRM import rows map object types to Chinese labels.
51. Twenty-third continuation: Computer Use app discovery again confirmed Safari and Atlas were running, but key-window reads still returned `Apple event error -10005: cgWindowNotFound`. The repeatable route stayed in the in-app browser and still began through `/demo`, clicked the founder / COO demo entry, then scanned form-heavy settings/import/capture routes and object collection/detail routes.
52. The twenty-third pass found one display layer and one route gap: capture recommendation object badges exposed object enums, CRM import/conflict rows exposed object names and technical external IDs, connector governance leaked guarded-write reason codes, Ask search badges exposed `CONTACTED / workspace_context`, and `/contacts` / `/companies` were guarded workspace prefixes without list pages. Fixes localized those readouts, humanized external record references, added lightweight read-only contact/company list pages, and made their breadcrumb parents navigable.
53. Twenty-fifth continuation: Computer Use app discovery again confirmed Safari and Atlas were running, but both key-window reads still returned `Apple event error -10005: cgWindowNotFound`. The repeatable route therefore stayed Chromium/Playwright, entered through `/demo`, clicked the founder / COO demo entry, and scanned workspace core routes on desktop and mobile.
54. The pass found remaining display-only leaks in operating, reports, memory, capture, settings connectors and CRM import: raw recommendation event types, public English principle labels, auth/session source labels, JSON correction states, capture status enums, connector auth/status labels and tenant-resource proof labels. Fixes stayed at formatter/rendering boundaries and preserved internal enum, policy and action contracts.
55. A follow-up 60-link crawl from the logged-in workspace found one more public-route copy leak on `/getting-started`: Chinese mode still surfaced `review-first` and orientation/first-entry phrasing. The copy now uses direct Chinese onboarding language while keeping the route explicitly non-automatic.

Residual boundary: Safari/Computer Use can still observe local dev streaming staying on fallback. This slice makes the stuck state operable; it does not claim the underlying Safari RSC reveal behavior is eliminated.

## 4. Route Sweep

Playwright desktop routes checked:

- `/?view=public`
- `/demo`
- `/dashboard`
- `/operating`
- `/opportunities`
- `/meetings`
- `/approvals`
- `/memory`
- `/reports`
- `/settings`
- `/imports`
- `/inbox`
- `/analytics`
- `/diagnostics`
- `/customer-success`
- `/search?q=NorthBridge`
- `/capture`

Playwright mobile routes checked:

- `/?view=public`
- `/demo`
- `/dashboard`
- `/approvals`
- `/memory`
- `/reports`
- `/settings`
- `/opportunities`
- `/meetings`
- `/inbox`
- `/search?q=NorthBridge`

Observed after fixes:

- mobile horizontal overflow: `0`
- high-frequency route long action-name scan: `[]`
- `/reports` first screen now reports `领导周报`
- `/meetings`, `/reports`, `/inbox`, `/approvals`, `/settings` expose short action names in the mobile action list
- logged-in sales-demo Playwright scan across `/settings`、`/imports`、`/inbox`、`/analytics`、`/diagnostics` reported `hitCount: 0` for the third-pass banned copy set: `推导锚点`、`这页应该先`、`事件埋点`、`当前阻碍`、`阻碍命中`、`memory timeline viewed`、`COMPANY BRIEFING`、`EmailThread`
- latest logged-in scan collected dynamic detail routes from `/opportunities`、`/meetings`、`/customer-success` and `/search?q=NorthBridge`; final result was `scannedRoutes: 25`, `checks: 50`, `issueCount: 0`
- the final scan checked: banned implementation/system copy, duplicate visible H1, action/control names longer than 46 characters, root/body/main horizontal overflow and non-HMR business console errors
- meeting detail mobile overflow was separately measured after the badge/grid fix: `rootDelta: 0`, `bodyDelta: 0`, `mainDelta: 0`
- latest deeper BFS checked `75` real routes after entering the sales demo and returned `issueCount: 0`
- targeted revisit of the six previously failing routes returned `issueCount: 0`: `/imports/conflicts`, three meeting detail pages, and two memory approval-linked pages
- latest continuation targeted raw-term revisit: `14` checks, `issueCount: 0`
- latest continuation broad raw-term scan: `21` routes x `2` viewports = `42` checks, `issueCount: 0`, business console errors `0`
- latest continuation UI / UE structure scan: `21` routes x `2` viewports = `42` checks, duplicate H1 / horizontal overflow / long control names all `0`
- seventh continuation focused operating scan: `/operating` plus `/operating/roles/founder`、`/operating/roles/sales`、`/operating/roles/delivery`、`/operating/roles/customer-success`, `issueCount: 0`
- seventh continuation broad logged-in crawl after entering the sales demo: `visited: 90`, `issueCount: 0`, `navErrorCount: 0`
- eighth continuation broad logged-in crawl after entering the sales demo: `visitedCount: 35`, raw/system-copy `issueCount: 0`
- ninth continuation targeted real-user route scan after entering the sales demo: `29` routes x `2` viewports, raw copy / long control name / empty control `issueCount: 0`
- tenth continuation core real-user scan after entering the sales demo: `20` routes x `2` viewports, raw copy / duplicate H1 / long control name / empty control / horizontal overflow `issueCount: 0` after treating the single `/operating` 8s script timeout as a scanner timeout and confirming `/operating` separately with status `200`
- tenth continuation detail-layer scan collected `45` linked routes from the core pages, scanned the first `30` routes x `2` viewports, found `23` issues, then targeted the 9 failing detail / settings / import routes x `2` viewports and returned `issueCount: 0`
- sixteenth continuation visible targeted revisit passed: `/settings` and `/meetings/cmnzwr67q002e7ntgo4lftc0r` had `0` visible hits for `合作 brief / 后续 briefing / briefing / brief`
- sixteenth continuation real visible control scan passed: `/opportunities`、`/approvals`、`/inbox`、`/imports`、`/settings`、`/demo` all returned `realUnlabeledControls: 0` after filtering `aria-hidden` technical nodes
- sixteenth continuation core founder scan passed: `14` core routes x desktop/mobile returned `[]` for raw copy and horizontal overflow checks
- sixteenth continuation smoke check passed: `/dashboard`、`/settings`、`/settings?tab=policies`、`/settings?tab=billing`、`/opportunities`、`/meetings/cmnzwr67q002e7ntgo4lftc0r` all rendered `OK` with no non-HMR page errors
- seventeenth continuation route discovery collected reachable detail paths from `/dashboard`、`/customer-success`、`/opportunities`、`/meetings`、`/reports`、`/memory`、`/inbox`、`/operating` and `/search?q=Acme`
- seventeenth continuation desktop high-risk detail scan initially found 2 company-detail copy failures, then passed after fixes: `25` routes / `failures: []`
- seventeenth continuation mobile high-risk detail scan passed after the same fixes: `25` routes / `failures: []`
- eighteenth continuation core founder scan passed after fixes: `20` core routes x desktop/mobile = `40` checks / `failures: []`
- eighteenth continuation targeted billing-settings scan passed after fixes: `/settings?tab=billing` x desktop/mobile = `2` checks / `failures: []`
- eighteenth continuation deeper detail scan initially found contact/company/meeting detail copy leaks in `70` checks, then the focused contact/company revisit passed: `4` checks / `failures: []`
- eighteenth continuation final targeted route scan passed: `12` core/detail routes x desktop/mobile = `24` checks / `failures: []`
- twenty-first continuation in-app browser rescan passed after fixes: `/operating`、`/customer-success`、`/opportunities`、`/diagnostics`、`/search?mode=ask&q=Atlas` all rendered real pages with `fallback: false`, `longControls: []`, `emptyControlCount: 0`, and `visibleRawHits: []`
- twenty-second continuation route scan passed after fixes: 19 settings/imports/portal/program/core routes plus 3 public program details returned no target raw terms, empty controls, long controls or business console errors
- twenty-second continuation dynamic detail rescan passed after fixes: success check, expansion review, customer success detail, company detail, review request, inbox detail and import job detail rendered real pages without long controls or visible target raw terms

## 5. Validation

Passed:

```bash
npm run test -- lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts
npm run test -- lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts lib/navigation/breadcrumb-trail.test.ts lib/i18n/messages.test.ts
npm run test -- lib/presentation/shared-surface-hierarchy-guards.test.ts lib/navigation/breadcrumb-trail.test.ts lib/i18n/messages.test.ts lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts
npm run test -- lib/presentation/shared-surface-hierarchy-guards.test.ts
npm run test -- lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts lib/internal-operating-workspace/foundation.test.ts
npm run test -- lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts lib/internal-operating-workspace/foundation.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
npm run test -- features/analytics/display-copy.test.ts features/diagnostics/display-copy.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts
npm run test -- features/analytics/display-copy.test.ts features/diagnostics/display-copy.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts lib/i18n/messages.test.ts
npm run test -- features/meetings/display-copy.test.ts features/conversation-capture/display-copy.test.ts features/memory/display-copy.test.ts features/reports/display-copy.test.ts features/settings/display-copy.test.ts features/imports/display-copy.test.ts features/role-conversation-variants/display-copy.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts
npm run test -- features/meetings/display-copy.test.ts features/memory/display-copy.test.ts features/imports/display-copy.test.ts features/settings/display-copy.test.ts lib/navigation/breadcrumb-trail.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
npm run test -- features/settings/display-copy.test.ts lib/billing/china-renew-restore.test.ts lib/billing/program-catalog-display.test.ts features/opportunities/display-copy.test.ts features/conversation-capture/display-copy.test.ts features/role-conversation-variants/display-copy.test.ts lib/worker-skill-resource/presentation.test.ts
npm run typecheck
git diff --check
npm run check:boundaries
npm run lint
npm run test -- lib/worker-skill-resource/presentation.test.ts features/opportunities/display-copy.test.ts lib/auth/insight-governance.test.ts lib/auth/import-governance.test.ts lib/billing/lifecycle-boundary.test.ts features/memory/display-copy.test.ts
npm run typecheck
npm run check:boundaries
git diff --check
npm run lint
npm run test -- features/role-conversation-variants/display-copy.test.ts features/customer-success-handoff/display-copy.test.ts features/meetings/display-copy.test.ts lib/auth/action-governance.test.ts lib/auth/settings-governance.test.ts lib/auth/service-governance.test.ts lib/auth/program-applications.test.ts lib/auth/workspace-data-governance.test.ts lib/memory/permissions.test.ts
npm run test -- features/internal-operating-workspace/display-copy.test.ts features/settings/display-copy.test.ts lib/connectors/dingtalk-sync-now-route.test.ts lib/connectors/dingtalk-ingestion.test.ts lib/connectors/wecom-ingestion.test.ts
npm run test -- features/internal-operating-workspace/display-copy.test.ts features/settings/display-copy.test.ts
npm run typecheck
npm run check:boundaries
git diff --check
npm run test -- features/conversation-capture/display-copy.test.ts features/memory/display-copy.test.ts features/analytics/display-copy.test.ts features/customer-success-handoff/display-copy.test.ts features/internal-operating-workspace/display-copy.test.ts features/meetings/display-copy.test.ts
npm run typecheck
npm run check:boundaries
npm run lint
git diff --check
npm run test -- features/meetings/display-copy.test.ts features/imports/display-copy.test.ts features/role-conversation-variants/display-copy.test.ts features/settings/display-copy.test.ts
npm run typecheck
npm run check:boundaries
npm run lint
git diff --check
npm run test -- lib/presentation/first-loop-surface-summary-display.test.ts features/settings/display-copy.test.ts lib/operating-system/first-loop.test.ts lib/presentation/shared-surface-hierarchy-guards.test.ts features/reports/report-first-loop-display.test.ts features/approvals/approval-first-loop-display.test.ts features/meetings/display-copy.test.ts features/role-conversation-variants/display-copy.test.ts features/customer-success-handoff/display-copy.test.ts
npm run typecheck
npm run check:boundaries
npm run lint
npm run self-check
npm run build
npm run quality:regression
git diff --check
```

Also passed local Playwright scan scripts for:

- desktop high-frequency routes
- mobile high-frequency routes
- long action-name scan after the shared aria-label fixes
- logged-in sitewide scan after the final fixes: `25` routes x `2` viewports = `50` checks, `issueCount: 0`
- logged-in deeper sales-demo BFS scan: `75` routes, `issueCount: 0`
- targeted revisit after the final memory/import/meeting patches: `6` routes, `issueCount: 0`
- latest sales-demo sweep: `37` checks, found `12` raw system terms from database-seeded settings/portal copy, then targeted `15` high-risk checks returned `issueCount: 0`
- ninth continuation sales-demo sweep: `29` routes x `2` viewports, `issueCount: 0`
- eighteenth continuation focused contact/company revisit passed: `4` checks / `failures: []`
- eighteenth continuation final targeted core/detail scan passed: `24` checks / `failures: []`

Blocked / not completed:

- `npm run test` ran 1,239 tests: 1,224 passed, 15 failed. The 15 failures are all DB-backed Helm v2 runtime tests failing because Prisma cannot reach `127.0.0.1:3306`.
- `npm run e2e` was attempted, but the wrapper entered its `db:reset` fallback. The repository safety guard refused to reset shared target `helm2026`, so e2e stopped before browser execution.
- `npm run db:reset` was not run manually in this slice because it can reset local data and needs explicit confirmation.
- Eighteenth continuation did not run `npm run db:reset`; it can reset local data and needs explicit action-time confirmation.
- Eighteenth continuation did not run full `npm run e2e`; the validated browser coverage used the targeted logged-in Playwright scans above, while full e2e remains coupled to the DB reset/prepare path.

Validation notes:

- `npm run lint` passed with existing unrelated unused-variable warnings.
- `npm run build` passed with an existing Turbopack NFT tracing warning; route generation completed.
- Latest `npm run lint` still reports the same class of existing warnings: 7 unused-variable warnings, 0 errors.
- Latest `npm run build` still passes with the existing Turbopack NFT tracing warning from `next.config.ts` import traces.
- Latest `npm run quality:regression` passed: 51 files / 181 tests.
- Final `git diff --check` passed.
- Final `npm run check:boundaries` passed.
- Final targeted copy/display test run passed: 7 files / 28 tests.
- Final `npm run typecheck` passed.
- Final `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Latest continuation targeted display/auth/lifecycle test run passed: 6 files / 27 tests.
- Latest continuation Playwright raw-term revisit passed: 14 checks / `issueCount: 0`.
- Latest continuation Playwright broad raw-term scan passed: 42 checks / `issueCount: 0` / `consoleErrors: 0`.
- Latest continuation Playwright UI / UE structure scan passed: 42 checks / `issueCount: 0`.
- Latest continuation `npm run typecheck` passed.
- Latest continuation `npm run check:boundaries` passed.
- Latest continuation `git diff --check` passed.
- Latest continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Seventh continuation targeted display/auth/connector test runs passed: 16 files / 59 tests.
- Seventh continuation focused operating scan passed: 5 routes / `issueCount: 0`.
- Seventh continuation broad logged-in crawl passed: 90 routes / `issueCount: 0` / `navErrorCount: 0`.
- Seventh continuation `npm run test -- features/internal-operating-workspace/display-copy.test.ts features/settings/display-copy.test.ts` passed: 2 files / 7 tests.
- Seventh continuation `npm run typecheck` passed.
- Seventh continuation `npm run check:boundaries` passed.
- Seventh continuation `git diff --check` passed.
- Eighth continuation `npm run typecheck` passed.
- Eighth continuation targeted display-copy tests passed: 6 files / 29 tests.
- Eighth continuation `npm run check:boundaries` passed.
- Eighth continuation `git diff --check` passed.
- Eighth continuation focused meeting-detail scan passed: JSON-summary / `ADVANCING` / `owner` / raw follow-up terms `matchCount: 0`.
- Eighth continuation broad sales-demo crawl passed: 35 routes / `issueCount: 0`. The only ignored remaining string was an external email subject, `Acme ROI follow-up materials`, treated as customer-supplied thread content rather than Helm UI copy.
- Ninth continuation targeted display-copy tests passed: 6 files / 22 tests.
- Ninth continuation `npm run typecheck` passed.
- Ninth continuation targeted real-user route scan passed: 29 routes x 2 viewports / `issueCount: 0`.
- Ninth continuation `npm run check:boundaries` passed.
- Ninth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Ninth continuation `git diff --check` passed.
- Ninth continuation final targeted display-copy rerun passed: 5 files / 21 tests.
- Ninth continuation final `npm run typecheck` passed.
- Ninth continuation final `git diff --check` passed.
- Eighteenth continuation targeted display tests passed: 9 files / 63 tests.
- Eighteenth continuation `npm run typecheck` passed.
- Eighteenth continuation `npm run check:boundaries` passed.
- Eighteenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Eighteenth continuation `npm run self-check` passed: 11 checks / 11 passed.
- Eighteenth continuation `npm run build` passed with the existing Turbopack NFT tracing warning.
- Eighteenth continuation `npm run quality:regression` passed: 51 files / 181 tests.
- Eighteenth continuation `git diff --check` passed.
- Tenth continuation targeted display-copy tests passed: 4 files / 17 tests.
- Tenth continuation `npm run typecheck` passed.
- Tenth continuation `npm run check:boundaries` passed.
- Tenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Tenth continuation `git diff --check` passed.
- Tenth continuation targeted failing-route Playwright revisit passed: 9 routes x 2 viewports / `issueCount: 0`.
- Tenth continuation core Playwright route scan passed after isolated `/operating` retry: 20 routes x 2 viewports / product issue count `0`.
- Eleventh continuation Computer Use attempt still reached app discovery, but Safari and Atlas key-window reads returned `cgWindowNotFound`.
- Eleventh continuation real-browser deep route scan covered 25 routes across desktop/mobile plus tab paths; initial product issue count was `0`.
- Eleventh continuation overlay scan covered command/search, quick-create, notifications and mobile navigation; no product issue remained.
- Eleventh continuation visible mixed-language scan found `follow-up`, `briefing`, `action items`, `workspace-first / controlled-trial`, project-skill and protected-field runtime phrases leaking into Chinese UI.
- Eleventh continuation fixes localized first-loop summaries, terms copy, meeting action buttons, role/skill labels, seed copy, shell/workspace alerts, runtime project-skill labels, and protected-field diagnostics.
- Eleventh continuation moved the verbose v2.1 continuity diagnostic block behind a closed backstage details disclosure so the meeting page no longer opens on raw payload / trace / pilot-review text.
- Eleventh continuation default-visible Playwright scan passed across dashboard, operating, memory, diagnostics, meeting detail, opportunities, approvals, imports, settings, setup and terms: `hitCount: 0`.
- Eleventh continuation target tests passed: 6 files / 32 tests.
- Eleventh continuation `npm run typecheck` passed.
- Eleventh continuation `npm run check:boundaries` passed.
- Eleventh continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Eleventh continuation `git diff --check` passed.
- Twelfth continuation Computer Use attempt still reached app discovery; Safari and Atlas key-window reads still returned `cgWindowNotFound`, so repeatable evidence stayed on Playwright real-route browsing.
- Twelfth continuation deep second-layer Playwright path found that meeting detail and operating backstage disclosures were clean by default but still exposed raw runtime / payload / trace / swarm / pilot terminology when a user intentionally opened the backstage layers.
- Twelfth continuation fixes converted the meeting detail backstage layer into a concise evidence summary, converted the operating backstage layer into a business-readable operating readout, and tightened meeting continuity copy for protected-state gaps, saved context, review reasons and recovery guidance.
- Twelfth continuation meeting detail expanded-disclosure scan passed: `hitCount: 0`.
- Twelfth continuation operating expanded-disclosure scan passed: `hitCount: 0`.
- Twelfth continuation targeted display-copy tests passed: 2 files / 4 tests.
- Twelfth continuation `npm run typecheck` passed.
- Twelfth continuation `npm run check:boundaries` passed.
- Twelfth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twelfth continuation `git diff --check` passed.
- Thirteenth continuation Computer Use attempt still reached app discovery; Safari and Atlas key-window reads still returned `cgWindowNotFound`, so repeatable evidence stayed on Playwright real-route browsing.
- Thirteenth continuation targeted meeting / operating / approvals scan passed after fixes: 4 routes x 2 viewports / `issueCount: 0` / horizontal overflow `0`.
- Thirteenth continuation inbox detail direct revisit passed after the protocol-density fix: desktop and mobile both rendered `h1` and returned raw-term `issue: null`.
- Thirteenth continuation broad logged-in sales-demo scan passed: 25 routes x 2 viewports / `failures: []`.
- Thirteenth continuation targeted tests passed: 6 files / 19 tests.
- Thirteenth continuation `npm run typecheck` passed.
- Thirteenth continuation `npm run check:boundaries` passed.
- Thirteenth continuation `git diff --check` passed.
- Thirteenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Thirteenth continuation `npm run build` passed with the existing Turbopack NFT tracing warning from `next.config.ts` import traces.
- Fourteenth continuation Computer Use attempt still reached app discovery; Safari and Atlas key-window reads still returned `cgWindowNotFound`, so repeatable evidence stayed on Playwright real-route browsing.
- Fourteenth continuation targeted founder / recruiting failure-page revisit passed after fixes: `failures: []`.
- Fourteenth continuation broad founder / recruiting scan passed: founder desktop 25 routes, founder mobile 25 routes, recruiting desktop 25 routes, recruiting mobile 25 routes / `failures: []`.
- Fourteenth continuation targeted tests passed: 2 files / 9 tests.
- Fourteenth continuation `npm run self-check` passed.
- Fourteenth continuation `npm run typecheck` passed.
- Fourteenth continuation `npm run check:boundaries` passed.
- Fourteenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Fourteenth continuation `npm run quality:regression` passed: 51 files / 181 tests.
- Fourteenth continuation `git diff --check` passed.
- Fourteenth continuation `npm run build` passed with the existing Turbopack NFT tracing warning from `next.config.ts` import traces.
- Fifteenth continuation Computer Use attempt still reached app discovery; Safari and Atlas key-window reads still returned `cgWindowNotFound`, so repeatable evidence stayed on Playwright real-route browsing.
- Fifteenth continuation public/mobile route scan and screenshot review found no new public-entry blockers, then founder-visible route scans exposed seeded business terms leaking through report, dashboard, memory, opportunity, approval and search surfaces.
- Fifteenth continuation fixes introduced one shared seeded-business display formatter and wired it through report, memory, opportunity, approval, dashboard, search, first-loop, recommendation evidence and reporting-protocol surfaces without changing stored demo data or business contracts.
- Fifteenth continuation real-user scan first covered founder / sales / recruiting across desktop/mobile on dashboard, reports, memory, approvals, opportunities and search, including approval preview and opportunity detail clicks; the final rerun passed: 42 combinations / `failures: []`.
- Fifteenth continuation targeted display-copy tests passed: 7 files / 30 tests.
- Fifteenth continuation `npm run typecheck` passed.
- Fifteenth continuation `npm run check:boundaries` passed.
- Fifteenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Fifteenth continuation `npm run self-check` passed.
- Fifteenth continuation `npm run quality:regression` passed: 51 files / 181 tests.
- Fifteenth continuation `git diff --check` passed.
- Sixteenth continuation targeted display-copy tests passed: 7 files / 37 tests.
- Sixteenth continuation `npm run typecheck` passed.
- Sixteenth continuation `npm run check:boundaries` passed.
- Sixteenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Sixteenth continuation `git diff --check` passed.
- Sixteenth continuation `npm run build` passed with the existing Turbopack NFT tracing warning from `next.config.ts` import traces.
- Sixteenth continuation Playwright targeted visible-copy revisit passed: `/settings` and the Acme meeting detail route returned `0` visible raw seeded-business hits.
- Sixteenth continuation Playwright real-control accessibility scan passed: six core form-heavy routes returned `realUnlabeledControls: 0`.
- Sixteenth continuation Playwright core founder desktop/mobile scan passed: 14 routes x 2 viewports returned `[]` for raw-copy and horizontal-overflow failures.
- Sixteenth continuation smoke route check passed after ignoring dev-only `/_next/webpack-hmr` WebSocket noise: all checked routes rendered `OK`, non-HMR errors `[]`.
- Fifteenth continuation `npm run build` passed with the existing Turbopack NFT tracing warning from `next.config.ts` import traces.
- Seventeenth continuation targeted company-detail raw-copy revisit passed: `[]`.
- Seventeenth continuation high-risk detail scan passed on desktop: 25 routes / `failures: []`.
- Seventeenth continuation high-risk detail scan passed on mobile: 25 routes / `failures: []`.
- Seventeenth continuation targeted tests passed: 3 files / 36 tests.
- Seventeenth continuation `npm run typecheck` passed.
- Seventeenth continuation `npm run check:boundaries` passed.
- Seventeenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Seventeenth continuation `git diff --check` passed.
- Nineteenth continuation Computer Use attempt still reached app discovery; Safari and Atlas key-window reads still returned `cgWindowNotFound`, so the repeatable browser evidence path stayed on Playwright while preserving the same real-user navigation intent.
- Nineteenth continuation deep Playwright route scan entered from `/demo`, confirmed demo entry visibility, then covered 22 workspace/detail routes and clicked safe tab/disclosure/detail controls on each route.
- Nineteenth continuation scan found four issue families: shared input/textarea controls relying on placeholder-only names, system/self-narrating Chinese copy on operating/report/memory/approval/opportunity/customer-success paths, raw action statuses on contact detail, and model-internal labels on analytics/diagnostics.
- Nineteenth continuation fixes added placeholder-derived accessible names to shared input and textarea primitives, localized contact action statuses for `BLOCKED` and `MANUAL`, removed the specific system/self-narration phrases found by route scan, and changed analytics/diagnostics visible Chinese labels from model-internal wording to service/operator-readable wording.
- Nineteenth continuation also tightened secondary detail copy for conversation-chain, package, reinforcement, offer, inbox follow-up, dashboard, meetings, reports, imports, approvals, opportunities, capture and demo entry surfaces without changing state machines, governance boundaries or stored data.
- Nineteenth continuation final Playwright rescan passed: `/demo` entry detected, 22 routes scanned, safe controls expanded, `failures: []`. The only intermediate form-control hit was Radix's hidden `aria-hidden` native select shim, not a visible user control.
- Nineteenth continuation targeted tests passed: 10 files / 74 tests.
- Nineteenth continuation `npm run typecheck` passed.
- Nineteenth continuation `npm run check:boundaries` passed.
- Nineteenth continuation `git diff --check` passed.
- Nineteenth continuation `npm run self-check` passed: 11 checks / 11 passed.
- Nineteenth continuation `npm run quality:regression` passed: 51 files / 181 tests.
- Nineteenth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Nineteenth continuation `npm run build` passed with the existing Turbopack NFT tracing warning from `next.config.ts` import traces.
- Twentieth continuation targeted tests passed: `lib/presentation/loading-recovery.test.ts`, `lib/presentation/shared-surface-hierarchy-guards.test.ts`, `lib/gtm-capability-plan-readout.test.ts`, and `features/internal-operating-workspace/display-copy.test.ts`.
- Twentieth continuation browser evidence passed: `/operating` raw GTM term scan returned `matchCount: 0`; notification center and command palette raw seed scans returned `matchCount: 0`; `/search` real snapshot no longer exposed `问 Helm / Ask Helm`; loading fallback exposed `打开全局搜索`.
- Twentieth continuation `git diff --check` passed.
- Twentieth continuation `npm run check:boundaries` passed.
- Twentieth continuation `npm run typecheck` passed.
- Twentieth continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twentieth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twenty-first continuation targeted loading / demo-entry / hierarchy / GTM / operating-display tests passed: 5 files / 54 tests.
- Twenty-first continuation in-app browser rescan passed: 5 core routes / fallback `false` / long controls `0` / empty controls `0` / target raw hits `0`.
- Twenty-first continuation `git diff --check` passed.
- Twenty-first continuation `npm run check:boundaries` passed.
- Twenty-first continuation `npm run typecheck` passed.
- Twenty-first continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twenty-first continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twenty-second continuation browser evidence passed: permissions support pack no longer exposes `CONTACT / NEEDS_REVIEW / ApprovalTask / Entry-source truth`, detail summary links no longer expose full prose as action names, and import job rows render `联系人` instead of `CONTACT`.
- Twenty-second continuation targeted settings/imports/hierarchy tests passed: 4 files / 50 tests.
- Twenty-second continuation `git diff --check` passed.
- Twenty-second continuation `npm run check:boundaries` passed.
- Twenty-second continuation `npm run typecheck` passed.
- Twenty-second continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twenty-second continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twenty-fifth continuation targeted display tests passed: internal-operating, capture, imports, settings, memory and tenant-resource display tests = 6 files / 29 tests.
- Twenty-fifth continuation public-entry tests passed: `lib/auth/public-entry.test.ts` and `features/auth/getting-started-page-contract.test.ts` = 2 files / 5 tests.
- Twenty-fifth continuation browser evidence passed: 6 core routes x desktop/mobile returned no target raw terms; the 60-link logged-in crawl returned no target raw terms after the `/getting-started` fix.
- Twenty-fifth continuation `git diff --check` passed.
- Twenty-fifth continuation `npm run typecheck` passed.
- Twenty-fifth continuation `npm run check:boundaries` passed.
- Twenty-fifth continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twenty-fifth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twenty-fifth continuation `npm run build` passed with existing Turbopack NFT tracing warnings from `next.config.ts` import traces.
- Twenty-fifth continuation `npm run quality:regression` passed: 51 files / 181 tests.
- Twenty-fifth continuation `npm run e2e` was attempted but stopped before browser execution because the wrapper tried `db:reset` and the repository guard refused to reset shared database target `helm2026`.
- Twenty-sixth continuation Computer Use attempt still reproduced the desktop bridge limit: app discovery returned Safari and Atlas, but both key-window reads returned `cgWindowNotFound`; verification therefore continued through the established localhost + Playwright browser path.
- Twenty-sixth continuation logged in through server-side `/demo/start`, scanned 44 real workspace/detail routes, and found two remaining visible leakage points: `SYSTEM_INFERENCE` on meeting source pointers and `职位 owner` inside contact tags.
- Twenty-sixth continuation fixes routed meeting source pointer / ledger text through the existing meeting display adapter, routed contact tags through the role/detail display adapter, and also closed the raw resource/billing/approval/import enum layer found in the earlier focused scan.
- Twenty-sixth continuation focused rescan passed: 8 target routes returned `findings: []` and `consoleErrors: []`.
- Twenty-sixth continuation targeted tests passed: 6 files / 35 tests.
- Twenty-sixth continuation `git diff --check` passed.
- Twenty-sixth continuation `npm run typecheck` passed.
- Twenty-sixth continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twenty-sixth continuation `npm run check:boundaries` passed.
- Twenty-sixth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twenty-seventh continuation Computer Use attempt again reached Safari but key-window state returned `cgWindowNotFound`; the pass kept the same real-user browser intent and used Playwright with server-side `/demo/start` handoff for repeatable route evidence.
- Twenty-seventh continuation found that the initial focused replay was not a valid logged-in scan because the form parameter used `persona=founder`; the effective handoff requires `mode=founder`. The corrected replay returned `303` to `/dashboard#` and set `helm-auth-session` plus `helm-active-workspace`.
- Twenty-seventh continuation fixes converted settings governance auth-session summaries, settings tenant-resource guarded-write evidence, capture shortlist/finalist wording, approval preview evidence and role-definition / approval-draft textareas into user-facing, accessible presentation.
- Twenty-seventh continuation targeted tests passed: 4 files / 20 tests.
- Twenty-seventh continuation focused route replay passed: `/settings`, `/settings?tab=connectors`, `/settings?tab=permissions`, `/capture`, and two approval-preview deep links returned `findings: []`; all checked textarea controls had accessible names.
- Twenty-seventh continuation `git diff --check` passed.
- Twenty-seventh continuation `npm run typecheck` passed.
- Twenty-seventh continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twenty-seventh continuation `npm run check:boundaries` passed.
- Twenty-seventh continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twenty-eighth continuation Computer Use attempt again reached Safari but key-window state returned `cgWindowNotFound`; verification continued through the repeatable localhost + Playwright real-route path.
- Twenty-eighth continuation expanded the logged-in founder replay to dashboard, operating, reports, memory, approvals, capture, contacts, companies, meetings, opportunities, imports, settings connector/policy tabs, diagnostics, analytics, inbox, customer success, portal, programs and selected dynamic detail routes.
- Twenty-eighth continuation found three remaining display leaks: tenant-resource policy readout exposed `external_write:never_allowed` / `draft:not_allowed`, settings strategy suggestions exposed `within_48h_preferred` / `meeting_followup`, and the GreenPeak meeting chain exposed `shortlist` / `panel briefing` through meeting summary and next-action handoff fields.
- Twenty-eighth continuation fixes routed those values through the existing tenant-resource, settings skill-suggestion and seeded business-copy display adapters, including conversation-chain meeting handoff dependencies and evidence groups.
- Twenty-eighth continuation targeted tests passed: 3 files / 16 tests.
- Twenty-eighth continuation focused replay passed: `/settings?tab=connectors`, `/settings?tab=policies`, and `/meetings/cmnzwr5xx00247ntgs7cjigyy` returned `findings: []`.
- Twenty-eighth continuation fixed-route replay passed: 22 core/public/detail routes returned `FINDINGS_JSON: []` and `CONSOLE_ERRORS_JSON: []`, with `raw=0`, `controls=0`, and `overflow=0` on every route.
- Twenty-eighth continuation `git diff --check` passed.
- Twenty-eighth continuation `npm run typecheck` passed.
- Twenty-eighth continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twenty-eighth continuation `npm run check:boundaries` passed.
- Twenty-eighth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Twenty-ninth continuation Computer Use attempt again reached Safari but key-window state returned `cgWindowNotFound`; verification continued through the established localhost + Playwright real-route path.
- Twenty-ninth continuation first dynamic replay expanded founder demo scanning into 73 real list/detail routes and exposed the next layer of issues: seeded business terms still leaking through company/contact/meeting/inbox/customer-success detail appendices, long website/email strings in tight cards, and a few mixed English boundary notes inside company definition support copy.
- Twenty-ninth continuation fixes routed role/detail display copy through seeded business-copy formatting, applied the same formatting to contact timeline titles, inbox full-message bodies, company detail summaries, meeting goals/questions/next-step labels and meeting memory item titles, and added break-word protection to company/contact/object-summary/detail definition cards.
- Twenty-ninth continuation targeted tests passed: 4 files / 19 tests.
- Twenty-ninth continuation focused route replay passed across 17 high-risk company/contact/inbox/meeting/success-check/expansion-review routes on desktop and mobile: `FINDINGS_JSON: []`, with raw seeded terms and page-level overflow both at zero.
- Twenty-ninth continuation full desktop replay passed across 69 real linked routes: `findingRoutes: 0`.
- Twenty-ninth continuation `git diff --check` passed.
- Twenty-ninth continuation `npm run typecheck` passed.
- Twenty-ninth continuation `npm run self-check` passed: 18 checks / 18 passed.
- Twenty-ninth continuation `npm run check:boundaries` passed.
- Twenty-ninth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Thirtieth continuation Computer Use attempt again reached Safari but key-window state returned `cgWindowNotFound`; the pass kept the same true-user browsing intent and used Playwright with server-side `/demo/start` founder handoff for repeatable route evidence.
- Thirtieth continuation broad logged-in replay scanned 107 real links and exposed the next actionable layer: `/analytics` still surfaced `success check / inbox` event labels, `/approvals` surfaced worker resource capability sentences, `/settings?tab=connectors` surfaced field-gap downgrade tokens, and shared detail cards could still produce overlong accessible link names.
- Thirtieth continuation fixes added display-copy mappings for analytics success/inbox events, approval worker resource capability sentences, tenant-resource field-gap downgrade reasons and summary statuses, and compacted shared object/detail/role summary link names to short label + short value rather than full prose.
- Thirtieth continuation targeted tests passed: 5 files / 59 tests.
- Thirtieth continuation focused route replay passed: `/analytics`, `/approvals`, `/settings?tab=connectors`, `/companies`, `/contacts`, and `/dashboard` returned `findings: []`.
- Thirtieth continuation wider route replay passed across 40 real linked routes on desktop and mobile: `findingsCount: 0`, including raw display tokens, overlong link/control names and page-level overflow checks.
- Thirtieth continuation `git diff --check` passed.
- Thirtieth continuation `npm run typecheck` passed.
- Thirtieth continuation `npm run self-check` passed: 18 checks / 18 passed.
- Thirtieth continuation `npm run check:boundaries` passed.
- Thirtieth continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Thirty-first continuation Computer Use attempt again reached Safari but key-window state returned `cgWindowNotFound`; verification continued through the same localhost + Playwright true-interaction path.
- Thirty-first continuation expanded safe second-layer interactions on 19 core routes across desktop and mobile, opening details, evidence, source/context and filter controls while avoiding state-changing submit/approve/delete/sync/import/send actions.
- Thirty-first continuation found the next interactive-layer leaks: connector evidence details still exposed `resource_not_actionable`, `review_required`, `freshness_unknown`, `connection_or_manifest_missing`, `not_connected`, `under review`, `reviewer` and `CaptureSession`; org-admin support pack exposed `PROVIDER/SOURCE`, `ACTIVE` and `INACTIVE`; memory audit replay exposed `SUGGESTION`, `PREFERENCE SIGNAL`, `FROM PATTERN`, `Adaptive Evolution`, `SkillSuggestion` and `PreferenceSignal`; approval audit status exposed `PENDING`; customer-success feedback exposed `ADVANCING`; the CSV file input on `/imports` had no accessible name.
- Thirty-first continuation fixes routed those second-layer values through tenant-resource, governance, memory and seeded-business display adapters, formatted approval queue status before evidence rendering, and added an explicit accessible name to the hidden CSV file input.
- Thirty-first continuation targeted tests passed: 5 files / 31 tests.
- Thirty-first continuation focused interaction replay passed across `/settings?tab=connectors`, `/settings?tab=permissions`, `/settings?tab=policies`, `/memory`, `/approvals`, `/customer-success`, and `/imports` on desktop and mobile: `findings: []`, including raw token, file-input accessible-name and overflow checks.
- Thirty-first continuation `git diff --check` passed.
- Thirty-first continuation `npm run typecheck` passed after aligning approval queue status formatting to the real `PENDING / EXECUTED / REJECTED / WITHDRAWN` status contract.
- Thirty-first continuation `npm run self-check` passed: 18 checks / 18 passed.
- Thirty-first continuation `npm run check:boundaries` passed.
- Thirty-first continuation `npm run lint` passed with 0 errors and the same 7 existing unused-variable warnings.
- Thirty-first continuation `npm run build` passed with the existing Turbopack NFT tracing warning for `next.config.ts` import traces.
- Thirty-first continuation `npm run quality:regression` passed: 51 files / 181 tests.
- Thirty-first continuation `npm run e2e` stopped at the repository DB reset guard before any shared DB reset; the script could not continue because the current MySQL target is treated as shared.
- Thirty-first continuation full `npm run test` ran the non-DB suite and reported 346 files / 1490 tests passed; the remaining 6 files / 15 tests failed only because `127.0.0.1:3306` was unreachable for DB-backed Helm v2 runtime fixtures.
- Thirty-first continuation process cleanup check found no residual Playwright, Chromium or headless browser processes.
- Thirty-second continuation Computer Use attempt again reached Safari but key-window state returned `cgWindowNotFound`; the pass kept using `POST /demo/start` plus Playwright route replay for repeatable user-path evidence.
- Thirty-second continuation first focused route replay covered 19 core routes on desktop and 12 on mobile; it exposed one real issue on `/memory`: the meeting-memory workspace summary forced four metric cards into very narrow desktop columns, producing horizontal overflow in Chinese status labels and review actions.
- Thirty-second continuation fixed the `/memory` meeting-memory summary grid by giving metric cards a real minimum width, letting the four metric cards wrap at common desktop sizes, and allowing metric titles to break instead of forcing a single cramped line.
- Thirty-second continuation dynamic detail replay collected 63 real linked routes and scanned 22 company/contact/meeting detail routes; company and meeting details were clean, while contact recommendation panels exposed `DRAFT_EXTERNAL_EMAIL`, `action item` and narrow recommendation-card overflow.
- Thirty-second continuation fixes routed recommendation action enums and `action item` wording through the shared role/detail display adapter, applied the same formatting to shared blocker cards, and changed contact detail from a cramped three-column desktop grid to a wider two-column layout until `2xl`.
- Thirty-second continuation stable `/portal` follow-up checked the only remaining `unnamed_field` signal in an isolated browser context and found no visible fields on `/programs` or `/portal`; the earlier signal was navigation-scan noise, so no product code was changed for that false positive.
- Thirty-second continuation focused replays passed: `/memory` desktop/mobile returned no overflow findings, 5 contact deep routes plus `/memory` returned `summary: 0`, and the fixed contact mobile subset returned no raw enum or overflow findings.
- Thirty-second continuation targeted tests passed: `features/role-conversation-variants/display-copy.test.ts` 1 file / 10 tests.
- Thirty-second continuation `npm run typecheck` passed.

## 6. Remaining Risks

- This is still not a claim that the full site has no remaining UX polish items. It closes the high-impact issues found in this pass: stuck fallback usability, report navigation naming, and long action names in high-frequency card/list surfaces.
- The second pass closes additional high-impact issues found through real browsing: fallback retry intent, dashboard/operating self-narration, search role copy, opportunity drawer overclaiming, and localized sheet close actions.
- The third pass closes additional high-impact issues found through real browsing: settings/imports/inbox self-narration, shell alert raw seed terms, first-loop return-anchor wording, analytics event/object keys, and diagnostics runtime/model keys.
- The fourth pass closes dynamic-route and accessibility issues found through deeper real browsing: long action names, persisted meeting snapshot wording, CRM/status raw values, detail-page H1 hierarchy and mobile badge/grid overflow.
- The fifth pass closes deeper BFS issues found after entering the sales demo: dead collection links, detail-only breadcrumb navigation, role-link accessible names, setup/import/billing worker language, meeting boundary language, memory audit replay, and skill suggestion policy copy.
- The sixth pass closes the next layer of visible systemspeak found on high-frequency pages: worker/resource contract sentences, memory first-loop labels, role-denied copy, lifecycle summaries, import conflict reminders and opportunity audit summaries.
- The seventh pass closes the remaining operating-page runtime-event leak found through real browsing: both full and truncated `Helm v2 ingested ...` summaries now render as Chinese meeting-chain state instead of internal runtime prose.
- The eighth pass closes detail/evidence second-layer leakage found through real browsing: first-loop labels, meeting/review detail labels, commitment reinforcement/sendability wording, analytics detail labels, and truncated JSON briefing snapshots now render as Chinese user-facing operating copy.
- The ninth pass closes shared display-layer leakage found through real browsing: recommendation stage enums, runtime operator labels, meeting ingestion/retrieval trace labels, capture fact types, memory correction types, review-request action types and customer-success post-send labels now render as user-facing Chinese copy.
- The tenth pass closes the next detail/accessibility layer found through real browsing: select and switch controls now always expose a readable control name, meeting/detail chain summaries no longer surface stale stage enums or mixed summary/risk/next-step systemspeak, settings policy examples no longer say `owner`, and import matching statuses render as Chinese review states.
- The twelfth pass closes the next backstage-disclosure layer found through real browsing: optional meeting and operating evidence drawers no longer render large engineering consoles into business user paths, while still preserving review/continuity signals and clear next actions.
- The thirteenth pass closes the next cross-detail layer found through real browsing: meeting/navigation detail chips no longer expose raw stage or risk enums, first-loop cards no longer produce spaced follow-up email copy, conversation-chain routing labels are Chinese-first, and inbox detail pages cannot exceed the shared 3-action reporting limit.
- The fourteenth pass closes the next persona-specific expanded-evidence layer found through real browsing: founder report priority badges and recruiting detail evidence rows now render as Chinese operating language instead of raw severity or implementation labels.
- The fifteenth pass closes the seeded business-copy layer found through real browsing: `brief`, `briefing`, `panel briefing`, `shortlist`, `finalist`, `joint launch` and `launch` no longer leak through the scanned Chinese workspace routes, including approval preview and opportunity detail paths.
- The sixteenth pass closes the next seeded-data and accessibility layer found through real browsing: settings alerts, customer-success handoff copy, diagnostics prompts, meeting supporting facts, inbox thread content and opportunity selection controls now render with Chinese user-facing copy and accessible names.
- The seventeenth pass closes the company-detail action layer found through deeper real browsing: company brief generation, owner validation, audit summaries and generated briefing snippets now render as Chinese business-facing `公司简报 / 负责人` copy instead of raw implementation terms.
- The nineteenth pass closes the next true-browsing interaction layer: visible input and textarea controls now derive accessible names, the scanned frontstage no longer shows the previously exposed system/self-narrating phrases, contact detail no longer leaks `BLOCKED` / `MANUAL`, and analytics/diagnostics no longer open with the flagged model-internal labels.
- The twentieth pass closes the next Operating/Search interaction layer: GTM capability-plan copy no longer exposes internal English terms or raw status enums, command/notification overlays format alert titles and bodies consistently, search UI no longer says `问 Helm`, and search-related loading fallbacks expose a direct search recovery entry.
- The twenty-first pass closes the next accessibility/recovery layer found through true browsing: `/operating` and `/customer-success` no longer expose full prose as action names, and workspace-level loading states now let users retry the current path before jumping elsewhere.
- The twenty-second pass closes the next permissions/detail/import layer found through true browsing: org-admin governance markers, cross-detail summary links and import object rows now render user-facing labels instead of internal enum/type strings or full prose action names.
- The twenty-fifth pass closes the next display-copy layer found through true browsing: operating/report/memory/capture/settings/import raw status terms now render as user-facing Chinese labels, and `/getting-started` no longer exposes internal orientation/review-first language in Chinese mode.
- The twenty-sixth pass closes the next logged-in dynamic-route layer found through true browsing: meeting source pointers, contact tags, resource connector names, billing proof-batch labels, approval evidence enums and import mapped object types now render through user-facing display adapters instead of exposing raw internal values.
- The twenty-seventh pass closes the next settings/capture/approval layer found through corrected logged-in replay: auth-session summaries, tenant-resource guarded-write evidence, shortlist/finalist capture snippets and editable approval drafts now render through display adapters, and the scanned multiline inputs expose accessible names.
- The twenty-eighth pass closes the next connector/policy/meeting-chain display layer found through true browsing: tenant-resource readouts, strategy suggestion values and meeting-chain next-action summaries now format raw policy keys and recruiting seeded terms before they reach Chinese surfaces.
- The twenty-ninth pass closes the next dynamic-detail appendix layer found through true browsing: role/detail routes, contact timelines, inbox full-message bodies, company definitions and meeting memory panels now share the same seeded business-copy and long-text wrapping protections.
- The thirtieth pass closes the next analytics/approvals/settings accessibility layer found through true browsing: analytics event source labels, approval worker capability sentences, tenant-resource field-gap reasons and shared detail-summary accessible link names now render as user-facing, bounded Chinese copy.
- The thirty-first pass closes the next expanded-interaction layer found through true browsing: opened connector evidence, org-admin support packs, memory audit replay, approval audit evidence, customer-success feedback and import upload controls no longer expose raw status/source tokens or unnamed file controls.
- The thirty-second pass closes the next dynamic detail and responsive layout layer found through true browsing: meeting-memory metric cards no longer overflow at common desktop widths, contact recommendation panels no longer expose action enums or raw `action item` wording, and the contact detail work surface no longer compresses judgement cards into a narrow third column at 1366px.
- Full `npm run e2e` and the DB-backed subset of `npm run test` still need a reachable isolated database or an explicitly approved, allowed local reset target. Current attempts were blocked safely by the reset guard or by unavailable `127.0.0.1:3306`.
- Safari local dev streaming fallback behavior remains observable. The fallback is now operable, but a deeper Next/Safari dev-server reveal investigation would be a separate runtime slice.
- Computer Use desktop control remains intermittent in this environment: app discovery works, but Safari/Atlas key-window reads currently return `cgWindowNotFound`. Playwright remains the repeatable browser evidence path until the desktop window bridge is stable again.

## 7. Next Five Items

1. Continue Computer Use from a clean Safari profile or a second browser session to separate local stale-tab behavior from product fallback behavior.
2. Add a repeatable Playwright accessibility scan for action-name length on high-frequency routes.
3. Continue role/detail dynamic-route copy cleanup if deeper real-user paths expose the same English implementation terms.
4. Investigate why Safari local dev sometimes stays on global loading after `/demo` and `/dashboard` navigation while Chromium reveals correctly.
5. Re-run the full repository validation chain before merge.
