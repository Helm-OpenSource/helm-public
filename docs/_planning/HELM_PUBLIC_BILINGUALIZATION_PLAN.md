---
status: active
owner: helm-core
created: 2026-06-03
review_after: 2026-06-17
public_safety: Public-safe bilingualization plan for helm-public. Do not include customer names, private handoff evidence, private deployment details, commercial Pack or Overlay implementation details, credentials, or release approval claims.
---

# Helm Public Bilingualization Plan / Helm 公开双语化计划

> **语言 / Language**: **中文主文本** + **English reference**

## 1. 目标 / Objective

把 `helm-public` 的公开入口、贡献入口、开发者上手路径和核心边界文档逐步做成
中英文双语，默认服务中国市场读者，同时保留英文社区、贡献者和外部 reviewer 的
可读性。

Make the public entry points, contribution surfaces, developer onboarding path,
and core boundary documents in `helm-public` bilingual. The default reader is
China-market delivery engineers, while English-speaking contributors and
reviewers must still be able to understand the public Core contract.

## 2. 当前结论 / Current Conclusion

本计划不声明全仓已经双语化完成。当前状态是：P0 入口、docs entry、P1 product /
operations / roadmap / launch / trial / legal 文档已分批落地；P2 sample pack、review
receipts、templates、report-skill 与 contributor-facing surfaces 正在推进。源码 / UI
侧已继续收口会议人工执行与正式写回运行时面板，但全工程扫描仍显示剩余候选项。

This plan does not claim that the whole repository is already bilingual. The
current state is: P0 entry surfaces, docs entry points, and P1 product /
operations / roadmap / launch / trial / legal docs have landed in staged
commits; P2 sample pack, review receipts, templates, report-skill, and
contributor-facing surfaces are underway. On the source / UI side, the meeting
human-execution, official-write runtime panels, meeting v2 runtime main panel,
customer success handoff detail model, and the next batch of judgement /
sendability detail surfaces have been further localized, but whole-project
scans still show remaining candidates.

本轮继续收口 customer-facing offer 与 commercial narrative detail surface 的中文边界文案混写，
只调整客户可见提案、对外叙事交接与商业叙事加固标签，不改变发送评估、外发、复核或非承诺边界。

This round further localizes mixed Chinese boundary copy in customer-facing
offer and commercial narrative detail surfaces. It changes customer-facing
offer, external-narrative handoff, and commercial-strengthening labels only,
without changing sendability, external send, review, or non-commitment
boundaries.

本轮也继续收口 role preset / starter skill 与 participant portal action 文案中的中文混写；
只调整角色定义、起步能力建议和门户校验提示，不改变角色匹配、能力路由、门户访问或结算边界。

This round also further localizes mixed Chinese copy in role preset /
starter-skill and participant portal action messages. It changes role
definitions, starter-skill suggestions, and portal validation prompts only,
without changing role matching, capability routing, portal access, or settlement
boundaries.

本轮继续收口 Helm v2 meeting action-pack runtime 的中文运行时摘要混写；只调整会议动作资料、
风险提示、未决问题和 artifact 摘要文案，不改变 artifact 文件名、运行时状态机、记忆晋升或阴影更新边界。

This round further localizes mixed Chinese runtime summaries in the Helm v2
meeting action-pack runtime. It changes meeting action-pack, risk-hint,
open-question, and artifact-summary copy only, without changing artifact
filenames, runtime state machines, memory promotion, or shadow-update
boundaries.

本轮继续收口 Helm v2 event-flow 与 layered-memory catalog 的中文描述混写；只调整事件摘要、
API 合同描述、记忆加载说明和晋升原因文案，不改变事件类型、contract key、request / response shape、
记忆层 key 或晋升规则逻辑。

This round further localizes mixed Chinese descriptions in Helm v2 event-flow
and layered-memory catalogs. It changes event summaries, API contract
descriptions, memory-load explanations, and promotion-reason copy only, without
changing event types, contract keys, request / response shapes, memory-layer
keys, or promotion-rule logic.

本轮继续收口 Helm v2 opportunity judge runtime 的中文输出混写；只调整机会判断、主管关注、
下一步摘要和内部复核提示文案，不改变阶段推断、正则匹配、artifact 文件名、正式 CRM 边界或阴影更新协议。

This round further localizes mixed Chinese output copy in the Helm v2
opportunity judge runtime. It changes opportunity judgement, manager-attention,
next-step summary, and internal-review prompt copy only, without changing stage
inference, regex matching, artifact filenames, formal CRM boundaries, or the
shadow-update protocol.

本轮继续收口 Helm v2 human action execution runtime 的中文人工执行文案混写；只调整
人工动作状态、执行证明、排期、CRM/管线和正式CRM边界提示，不改变人工执行状态机、回执、
正式写回、外发或审批边界。

This round further localizes mixed Chinese copy in the Helm v2 human action
execution runtime. It changes manual-action status, execution-proof,
scheduling, CRM/pipeline, and formal-CRM boundary prompts only, without
changing the human-execution state machine, receipts, official writeback,
external send, or approval boundaries.

本轮继续收口 worker / skill / resource presentation 的中文展示标签混写；只调整
交付激活清单、CRM上下文、工作区状态和成员身份状态标签及源码守卫，不改变
worker / skill / resource 合同、控制面检查或页面装配逻辑。

This round further localizes mixed Chinese display labels in worker / skill /
resource presentation. It changes delivery-activation checklist, CRM-context,
workspace-state, and membership-state labels plus source guards only, without
changing worker / skill / resource contracts, control-plane checks, or page
assembly logic.

本轮继续收口公开首页中文入口文案混写；只调整 public home 的复用入口、黄金路径、
投资回报、客户关系管理、人力系统、追踪编号与 Helm Cloud 说明文案及源码守卫，
不改变首页路由、demo 登录、GitHub 链接、Helm Cloud 仅邀请制或不自动外发边界。

This round further localizes mixed Chinese entry copy on the public home page.
It changes public-home reuse-entry, golden-path, return-on-investment,
customer-relationship-management, HR-system, trace-number, and Helm Cloud
explanation copy plus source guards only, without changing home routing,
demo sign-in, GitHub links, Helm Cloud invite-only posture, or no-auto-send
boundaries.

本轮继续收口公开登录 / 邀请入口中文文案混写；只调整登录页的 Helm 组织、试点工作区、
返回工作区和 Helm Cloud 试用入口文案及源码守卫，不改变认证、SSO、邀请预填、试用申请
或登录跳转流程。

This round further localizes mixed Chinese copy in the public login / invite
entry. It changes login-page Helm organization, trial-workspace,
return-workspace, and Helm Cloud trial-entry copy plus source guards only,
without changing authentication, SSO, invite prefill, trial application, or
login redirect flows.

本轮继续收口全局 metadata 与数据库连接提示中文混写；只调整默认页面元信息、公开工程能力摘要
和数据库断连 / 公司VPN提示文案及源码守卫，不改变 root layout 结构、离线模式、重试按钮
或数据库连接逻辑。

This round further localizes mixed Chinese copy in global metadata and
database-connection guidance. It changes default page metadata, public
engineering-capability summary, and database-disconnected / corporate-VPN
guidance copy plus source guards only, without changing root layout structure,
offline mode, retry buttons, or database connection logic.

本轮继续收口公开 trial / demo 入口中文混写；只调整托管版申请、自部署复刻、60 秒演示、
行业样板、完整读数、黄金路径检查链和真实CRM边界提示文案及源码守卫，不改变试用申请表、
demo 登录、行业 pack 数据、GitHub 链接或不自动外发边界。

This round further localizes mixed Chinese copy in the public trial / demo
entries. It changes managed-trial application, self-hosting fork, 60-second
demo, industry-template, full-readout, golden-path-check, and real-CRM boundary
guidance copy plus source guards only, without changing the trial application
form, demo login, industry pack data, GitHub links, or no-auto-send boundaries.

本轮继续收口 conversation capture 中文混写；只调整现场记录页、录制面板和结果面板里的
客户关系管理系统、Helm执行说明、浏览器录音最小可用版等中文文案及源码守卫，不改变录音、
上传、语音转写、写回、推荐刷新或审批链逻辑。

This round further localizes mixed Chinese copy in conversation capture. It
changes customer-relationship-management-system, Helm execution guidance, and
browser-audio minimum-viable-version wording on the capture page, recording
panel, and result panel plus source guards only, without changing recording,
upload, speech transcription, writeback, recommendation refresh, or
approval-chain logic.

本轮继续收口 imports / CRM ingress 中文混写；只调整导入主入口与客户关系系统连接向导里的
客户关系系统来源、导入预览、同步完成、只读入口、操作摘要和预热说明文案及源码守卫，
不改变 CSV 解析、OAuth、连接器 action、导入 API、warmup 或冲突复核逻辑。

This round further localizes mixed Chinese copy in imports / CRM ingress. It
changes customer-relationship-system source, import-preview, sync-completion,
read-only-ingress, operating-summary, and warmup-explanation wording in the
import entry and CRM connection wizard plus source guards only, without changing
CSV parsing, OAuth, connector actions, import APIs, warmup, or conflict-review
logic.

本轮继续收口 import conflict review 的中文 CRM 混写；只调整冲突复核页的
返回导入、继续接入和下一步提示文案及源码守卫，不改变冲突处理 API、连接器 action、
导入结果或身份复核逻辑。

This round further localizes mixed Chinese CRM copy in import conflict review.
It changes return-to-import, continue-ingress, and next-step guidance copy on
the conflict review page plus source guards only, without changing conflict
resolution APIs, connector actions, import results, or identity-review logic.

本轮继续收口 settings / tenant-health 隐私与资源就绪说明里的中文混写；只调整
租户健康页的客户关系系统记录、Ask Helm 提问原文、大模型提示词说明，以及租户资源空状态里的
客户关系系统导入文案和源码守卫，不改变健康检查数据、设置 action、连接器或权限边界。

This round further localizes mixed Chinese copy in settings / tenant-health
privacy and resource-readiness guidance. It changes tenant-health
customer-relationship-system record, Ask Helm original-question, large-model
prompt wording, and tenant-resource empty-state customer-relationship-system
import copy plus source guards only, without changing health data, settings
actions, connectors, or permission boundaries.

本轮继续收口 diagnostics 试点诊断页里的中文 CRM 混写；只调整客户关系系统稳定性、
来源空状态、身份绑定债和已连接来源文案及源码守卫，不改变诊断数据、试点判断、导入任务或
身份复核逻辑。

This round further localizes mixed Chinese CRM copy in the diagnostics
pilot-readiness page. It changes customer-relationship-system stability, source
empty-state, identity-binding debt, and connected-source wording plus source
guards only, without changing diagnostics data, pilot judgement, import jobs,
or identity-review logic.

本轮继续收口 settings setup / account 连接说明里的中文 CRM 混写；只调整初始化向导的
客户关系系统连接标题、账户设置里的未命名客户关系系统来源文案和源码守卫，不改变设置保存、
连接器优先级、认证配置或数据接入逻辑。

This round further localizes mixed Chinese CRM copy in settings setup / account
connection guidance. It changes the setup-wizard customer-relationship-system
connection title, the account-settings unnamed customer-relationship-system
source copy, and source guards only, without changing settings persistence,
connector priority, auth configuration, or data-ingress logic.

本轮继续收口 meeting v2 组件里的中文 CRM 边界混写；只调整机会判断、人工执行和
运行时卡片里的正式客户关系系统状态、写回、步骤与权限文案及源码守卫，不改变 runtime
状态机、阴影摘要、人工回执或正式写回边界。

This round further localizes mixed Chinese CRM boundary copy in meeting v2
components. It changes official customer-relationship-system state, writeback,
step, and permission wording in opportunity-judgement, human-action, and
runtime cards plus source guards only, without changing runtime state machines,
shadow summaries, manual receipts, or official-write boundaries.

本轮继续收口 human action execution runtime 里的中文 CRM 边界混写；只调整
人工执行输出里的正式客户关系系统更新、写回权限、客户关系系统 / 管线步骤和执行边界文案
及源码守卫，不改变 action type、artifact、状态机、人工回执或正式写回权限。

This round further localizes mixed Chinese CRM boundary copy in the human action
execution runtime. It changes official customer-relationship-system update,
write authority, customer-relationship-system / pipeline step, and
execution-boundary wording plus source guards only, without changing action
types, artifacts, state machines, manual receipts, or official-write
permissions.

本轮继续收口 remaining meeting runtime 里的中文 CRM 边界混写；只调整
opportunity judge、draft handoff、action pack runtime 与 meeting display-copy 的
正式客户关系系统状态 / 写回文案及源码守卫，不改变事件、artifact、shadow 更新或发送 / 写回权限。

This round further localizes mixed Chinese CRM boundary copy in remaining
meeting runtimes. It changes official customer-relationship-system state /
writeback wording in opportunity judge, draft handoff, action pack runtime, and
meeting display-copy plus source guards only, without changing events,
artifacts, shadow updates, send authority, or write authority.

本轮继续收口公开 demo 入口里的中文 CRM 边界混写；只调整演示页与 loading 边界提示中的
客户关系系统写入 / 写回文案及源码守卫，不改变 demo 路由、session、审计或不自动外发边界。

This round further localizes mixed Chinese CRM boundary copy in the public demo
entry. It changes customer-relationship-system write / writeback wording in the
demo page and loading boundary notes plus source guards only, without changing
demo routing, sessions, audit logging, or no-auto-send boundaries.

本轮继续收口 settings connector 权限摘要里的中文 CRM 边界混写；只调整只读权限面板中的
客户关系系统阶段写回文案及源码守卫，不改变连接器权限矩阵、控制面能力或写回授权。

This round further localizes mixed Chinese CRM boundary copy in the settings
connector permission summary. It changes customer-relationship-system
stage-write wording in the read-only permission panel plus source guards only,
without changing the connector permission matrix, control-plane capabilities, or
writeback authorization.

本轮继续收口 billing lifecycle 边界读数里的中文 CRM 混写；只调整订阅暂停 / 只读说明中的
客户关系系统预览与导入显示文案及源码守卫，不改变 lifecycle gating、usage ledger 或操作枚举。

This round further localizes mixed Chinese CRM copy in billing lifecycle
boundary readouts. It changes customer-relationship-system preview and import
wording in subscription pause / read-only guidance plus source guards only,
without changing lifecycle gating, the usage ledger, or operation enums.

本轮继续收口 CRM import API fallback 里的中文混写；只调整 preview / run / sync route 的
客户关系系统预览、导入与增量同步失败文案及源码守卫，不改变请求 schema、权限检查、导入执行
或错误状态码。

This round further localizes mixed Chinese copy in CRM import API fallbacks. It
changes customer-relationship-system preview, import, and incremental-sync
failure wording in the preview / run / sync routes plus source guards only,
without changing request schemas, permission checks, import execution, or error
status codes.

本轮继续收口 imports 服务层里的中文 CRM 混写；只调整客户关系系统导入预热 actor、任务导入
记忆 / 审计摘要、导入来源缺失和失败 fallback 文案及源码守卫，不改变导入编排、对象写入、
审计字段或 warmup 逻辑。

This round further localizes mixed Chinese CRM copy in import services. It
changes customer-relationship-system import warmup actors, task-import memory /
audit summaries, missing-source fallback, and failure fallback wording plus
source guards only, without changing import orchestration, object writes, audit
fields, or warmup logic.

本轮继续收口 search / reports / analytics 中文混写；只调整 Ask Helm 边界说明、
客户关系系统字段、正式必推事项、大模型上下文层、原始提示词 / 音频保留说明、周报建议
和 AI工作姿态文案及源码守卫，不改变 Ask Helm 表单 action、审计候选、上下文包、报表生成
或 analytics 查询逻辑。

This round further localizes mixed Chinese copy in search / reports /
analytics. It changes Ask Helm boundary guidance, customer-relationship-system
fields, formal-must-push wording, large-model context-layer wording, raw-prompt
/ audio retention guidance, weekly-report recommendations, and AI-work-posture
copy plus source guards only, without changing Ask Helm form actions, audit
candidates, context packets, report generation, or analytics query logic.

本轮继续收口 object entry surfaces 的中文 CRM 混写；只调整 proposals、meetings、
companies、contacts 与 business asset detail 的客户关系系统提示文案及源码守卫，
不改变对象查询、路由、导入入口或资产信号逻辑。

This round further localizes mixed Chinese CRM copy in object entry surfaces. It
changes customer-relationship-system guidance copy in proposals, meetings,
companies, contacts, and business asset detail plus source guards only, without
changing object queries, routing, import entrypoints, or asset-signal logic.

## 3. 双语标准 / Bilingual Standard

| 层级 / Tier | 标准 / Standard | 适用范围 / Applies To |
|---|---|---|
| P0 | 中文主文本 + English reference；必须保留 boundary 与 non-claim；Chinese-first with English reference; boundary and non-claim wording required | README、docs index、status、GitHub issue / PR templates、贡献入口 |
| P1 | 中文主文本 + English reference，或成对 `.md` / `.en.md`；Chinese-first with English reference, or paired `.md` / `.en.md` files | product、operations、roadmap、launch、trial、legal docs |
| P2 | 可读双语摘要 + 英文技术细节；Bilingual summary with English technical detail | sample pack、integration template、report skills、review receipts |
| P3 | 按需双语；Bilingual only when user-facing or contributor-facing | internal test fixture labels、low-level code comments、machine-only files |

## 3.1 交付工程师友好标准 / Delivery-Engineer-Friendly Standard

每个公开入口和可贡献 surface 不只需要双语，还必须让交付工程师快速回答：

Each public entry point and contributor-facing surface must be bilingual and
help a delivery engineer quickly answer:

1. 我应该先检查什么？/ What should I inspect first?
2. 我可以 fork 或复制哪一层？/ What can I fork or copy?
3. 第一处安全改动在哪里？/ Where is the first safe change?
4. 我应该跑哪些命令？/ Which commands should I run?
5. 什么证据可以 public-safe 地提交？/ What evidence can I submit publicly?
6. 哪些行为永远不该自动化或外发？/ Which actions must never be automated or externally sent?

如果一份文档只翻译了术语，但没有说明 first-change proof、verification、evidence route
和 boundary，它只能算“已成形但仍需下一层”，不能算双语化完成。

If a document only translates terms but does not explain the first-change proof,
verification, evidence route, and boundary, it is only "formed but needs the next
layer" and must not be counted as bilingualization complete.

## 3.2 源码 / UI 审计标准 / Source And UI Audit Standard

源码层的双语化不要求翻译变量名、enum、trace key、test fixture 或机器协议字段。
需要检查的是用户可见 UI、API 错误文案、display-copy、公开页面 metadata、表单提示和
contributor-facing templates 是否能在 `zh-CN` 默认语言下可读，并在 `en-US` 下保留
英文 reviewer 可读性。

Source-level bilingualization does not require translating variable names,
enums, trace keys, test fixtures, or machine protocol fields. The audit target is
user-visible UI, API error copy, display-copy, public page metadata, form hints,
and contributor-facing templates: they must be readable under the default
`zh-CN` locale and remain reviewable under `en-US`.

本轮源码审计结果：

This PR's source audit result:

1. `lib/i18n/config.ts` 仍以 `zh-CN` 为默认 UI locale，并保留 `en-US` 切换。
   `lib/i18n/messages.ts` 提供 shell / CRM / settings / diagnostics / capture 的中英文 copy。
2. 首页、登录页、trial 页、programs 页、workspace shell、layout、display-copy
   modules 和主要 API action messages 均使用 locale 分支或 message resolver。
3. 抽查 264 个 `.tsx` 文件后，少量硬编码英文 UI 标签已修正；workspace runtime
   可见面板中的指标标签、加载策略和基准矩阵文案继续收口，直接 JSX 英文标签扫描已降为 0。
   会议人工执行、正式写回、meeting v2 runtime 主面板、customer success handoff
   detail model、settings client、conversation detail、external narrative detail 与
   commitment reinforcement sendability detail model、meeting opportunity judge、
   inbox follow-up review request、success check、customer-facing offer / external
   proposal、commercial narrative strengthening detail model、proposal package
   detail surfaces、billing / participant portal surface、trial CTA、Helm v2 action
   pack、opportunity judge、human action execution、worker registry、企业微信 / 飞书 /
   钉钉 OAuth 回调与只读连接器排错文案、demo 行业包、角色基础、Ask Helm
   解释器、推荐展示、recommendation action、LLM 建议解释、BI 报表解释 / 复核、
   i18n 事件标签、internal commercialization、GTM customer demand brief、settings
   custom engagement / tenant resource readiness 文案、approval first-loop
   复核卡片 / 步骤列表、recommendation feedback、home surface arrival banner
   与 billing program catalog 文案、skill suggestion formal review、human
   action execution boundary、program invite issuance、customer-facing offer /
   external proposal 与 proposal package 边界文案、billing settlement 与
   payout readiness 面板中的中文结算术语、customer-facing offer 与 commercial
   narrative detail view 的中文边界标签、Helm v2 draft comms 运行时的中文边界说明、
   草稿摘要和风险守卫文案、contrast-test / dark-mode-test 低频公开测试 route
   说明文案、weekly report 生成服务的 summary / audit copy、Helm v2/runtime API
   validation fallback 文案、meeting server action 的 pre-session validation fallback
   文案、blockers / commitments / memory API 的 validation / success / failure 文案、
   recommendations API 的 validation / success / failure fallback 文案、memory timeline /
   evolution patterns / problem-spaces API 的低频 validation / source label 文案、
   conversation capture 服务层的 fallback transcript / speaker label / audit summary 文案、
   conversation capture ingest 与 OpenClaw memory sync API 的 success message、
   memory export API 的 text/plain 导出正文标签、LLM / briefing API 的失败 fallback 文案、
   evolution skill / strategy suggestion API 的 failure / success message、external narrative
   与 commitment reinforcement / sendability detail view 的中文 fallback 标签、runtime operator
   panel 的中文空状态 / 描述 / 计数标签已继续收口。
   这些目标文件的本批次严格可见残留已清理；全工程广义 ASCII 中文分支扫描与严格可见
   文案扫描尚未重新校准，后续仍需继续检查 billing surface 与其他低频 detail surfaces。
   剩余品牌名、语言名、provider 名、trace key 和 runtime enum 列为 P3，不作为中文 UI 缺口。
4. 交付工程师上手文档已补齐中国大陆 / 受限网络 npm 与 Docker mirror 指引、Prisma
   显式生成口径、MySQL 凭据对齐和微信支付 lifecycle env 示例；`delivery:doctor`
   也新增 `--region cn` 静态预检，用于提示 Qwen key fallback、region / residency、
   npm mirror 与 OpenAI-only ASR 常见误配。这些属于双语化的
   delivery-engineer-friendly 维度，不代表生产部署 ready。
5. 后续如果新增 public-facing UI，必须优先接入 `resolveUiLocale` / `getUiMessages`
   或对应 feature display-copy，而不是直接写单语长文案。

1. `lib/i18n/config.ts` keeps `zh-CN` as the default UI locale and preserves the
   `en-US` switch.
2. The home, login, trial, programs, workspace shell, layout, display-copy
   modules, and main API action messages use locale branches or message
   resolvers.
3. After sampling 264 `.tsx` files, a small set of hard-coded English UI labels
   was corrected; visible workspace runtime metric labels, loading strategy
   labels, and benchmark matrix copy were further localized, and the direct JSX
   English-label scan now returns 0 hits. The meeting human-execution,
   official-write, meeting v2 runtime main panel, customer success handoff
   detail model, settings client, conversation detail, external narrative
   detail, commitment reinforcement sendability detail model, meeting
   opportunity judge, inbox follow-up review request, success check,
   customer-facing offer / external proposal, commercial narrative
   strengthening detail model, proposal package detail surfaces, billing /
   participant portal surface, trial CTA, Helm v2 action pack, opportunity
   judge, human action execution, worker registry, WeCom / Feishu / DingTalk
   OAuth callback plus read-only connector troubleshooting copy, demo industry
   packs, role foundations, the Ask Helm interpreter, recommendation
   presentation, recommendation actions, LLM recommendation explanation, BI
   report analysis / review, i18n event labels, internal commercialization, GTM
   customer demand brief, settings custom engagement / tenant resource
   readiness copy, the approval first-loop review card / step list,
   recommendation feedback, home surface arrival banner, and billing program
   catalog copy, skill suggestion formal review, human action execution
   boundary, program invite issuance, customer-facing offer / external proposal,
   proposal package boundary copy, and billing settlement plus payout-readiness
   panel settlement terminology, plus customer-facing offer and commercial
   narrative detail-view boundary labels, plus Helm v2 draft-comms runtime
   boundary notes, draft summaries, risk-guard copy, contrast-test /
   dark-mode-test low-frequency public test-route explanatory copy, and
   weekly-report service summary / audit copy, and Helm v2/runtime API
   validation fallback copy, and meeting server-action pre-session validation
   fallback copy, plus blockers / commitments / memory API validation / success /
   failure copy, plus recommendations API validation / success / failure
   fallback copy, plus low-frequency validation / source-label copy in the memory
   timeline, evolution patterns, and problem-spaces APIs, plus conversation-capture
   service fallback transcript / speaker-label / audit-summary copy, plus
   conversation-capture ingest and OpenClaw memory-sync API success messages, plus text/plain
   export-body labels in the memory export API, plus LLM / briefing API failure
   fallback copy, plus evolution skill / strategy suggestion API failure / success
   messages, plus Chinese fallback labels in external narrative and commitment
   reinforcement / sendability detail views, plus runtime operator panel empty-state,
   description, and count labels, plus customer-facing offer / external proposal detail-model mixed-copy cleanup, and conversation detail plus external narrative detail mixed-copy cleanup, and inbox / follow-up / review request detail-model mixed-copy cleanup, plus billing settlement and tenant resource readiness visible mixed-copy cleanup, have also been localized
   for Chinese operation fields. This
   batch clears the target-file strict visible-copy leftovers; the
   whole-project broad ASCII zh-branch scan and strict visible-copy scan have
   not been recalibrated yet, and billing plus other lower-frequency detail
   surfaces still need follow-up review. Remaining brand names, language labels,
   provider names, trace keys, and runtime enums are P3 rather than Chinese UI
   gaps.
4. Developer onboarding docs now include Mainland China / restricted-network
   npm and Docker mirror guidance, explicit Prisma generation wording, aligned
   MySQL credentials, and WeChat Pay lifecycle env examples; `delivery:doctor`
   also has a new `--region cn` static preflight for common Qwen key fallback,
   region / residency, npm mirror, and OpenAI-only ASR misconfigurations. This
   is part of delivery-engineer-friendly bilingualization and is not a
   production deployment readiness claim.
5. New public-facing UI must use `resolveUiLocale` / `getUiMessages` or the
   relevant feature display-copy instead of embedding long single-language copy.

## 4. 本轮 P0 范围 / Current P0 Scope

本轮只处理 public-facing intake 和文档入口：

This PR only handles public-facing intake and docs-entry surfaces:

1. `.github/pull_request_template.md`
2. `.github/ISSUE_TEMPLATE/*.yml`
3. `docs/README.md`
4. `docs/STATUS.md`
5. `docs/public-docs-manifest.json`
6. `CHANGELOG.md`
7. `CHANGELOG.en.md`

## 5. 刻意不做 / Deliberately Not In Scope

本计划不授权以下事项：

This plan does not authorize:

1. 把 P0 完成写成全仓双语完成。/ Treating P0 completion as full-repo bilingual completion.
2. 修改 runtime 行为。/ Runtime behavior changes.
3. 新增 Cloud、Enterprise、SLA 或客户部署 ready 声明。/ New Cloud, Enterprise, SLA, or customer deployment readiness claims.
4. 把 recommendation 写成 commitment。/ Turning recommendation into commitment.
5. 自动对外发送、自动写入、自动审批、执行或结算。/ Automatic external send, broad auto-write, automatic approval, execution, or settlement.
6. 把私有 WeChat / QR / community handoff 当作公开 activation proof。/ Treating private WeChat / QR / community handoff as public activation proof.

## 6. 后续批次 / Follow-Up Batches

| 批次 / Batch | 目标 / Goal | 交付物 / Deliverables |
|---|---|---|
| P1-A | product docs 双语化 / Bilingualize product docs | Open-source boundary、release reality、Golden Path、extension protocol |
| P1-B | operations docs 双语化 / Bilingualize operations docs | release train、open-source operating model、China accessibility packet、weekly packet |
| P1-C | roadmap、launch、trial、legal 双语化 / Bilingualize roadmap, launch, trial, and legal docs | roadmap、launch announcement、trial runbook、trial data policy |
| P2-A | sample pack 与 integration docs 双语化 / Bilingualize sample-pack and integration docs | `extensions/case-management-sample/`、`docs/integrations/INTEGRATION_TEMPLATE.md` |
| P2-B | review receipts 与 report-skill docs 双语摘要 / Add bilingual summaries to review receipts and report-skill docs | selected receipts、`external-resource-kit/` docs |
| P2-C | 源码 / UI 双语审计 / Source and UI bilingual audit | `lib/i18n/`、public routes、workspace shell、display-copy modules、selected hard-coded UI labels、meeting execution / official-write runtime panels |

## 7. 验证 / Verification

每个批次至少运行：

Each batch should run at minimum:

```bash
git diff --check
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
```

如果批次修改 runtime、类型、UI 或测试入口，还必须按仓库规则补跑：

If a batch changes runtime, types, UI, or test entry points, it must also run the
repository-required commands:

```bash
npm run self-check
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

## 8. 完成定义 / Definition Of Done

全工程双语化只有在以下条件同时成立时才可声明：

Full-project bilingualization may only be claimed when all of the following are
true:

1. P0、P1、P2 文件均已通过 PR 合并。/ P0, P1, and P2 files are merged through PRs.
2. `docs/STATUS.md` 已更新对应状态。/ `docs/STATUS.md` reflects the final status.
3. `docs/public-docs-manifest.json` 仍与文档树一致。/ `docs/public-docs-manifest.json` still matches the docs tree.
4. public guards 通过。/ Public guards pass.
5. 源码 / UI 可见文案已完成 `zh-CN` 默认与 `en-US` 可切换审计。/ Source / UI visible copy has passed the `zh-CN` default and `en-US` switchable audit.
6. 交付工程师能从入口文档找到 first-change proof、verification commands 和 public-safe evidence route。/ Delivery engineers can find the first-change proof, verification commands, and public-safe evidence route from entry docs.
7. 没有新增客户、私有部署、密钥或商业私有逻辑泄漏。/ No customer, private deployment, secret, or commercial-private leakage is introduced.
8. 没有新增 release-ready、SLA、Cloud / Enterprise ready 或客户承诺 overclaim。/ No release-ready, SLA, Cloud / Enterprise ready, or customer-commitment overclaim is introduced.

## 9. 变更记录 / Change Log

| 日期 / Date | 变更 / Change |
|---|---|
| 2026-06-04 | 继续收口 customer success handoff detail / queue 的中文空格式与术语混写；本批只改交接路由、发送前复核、边界姿态、客户成功验收、队列派生与外发禁用文案及源码守卫，不改路由模型、队列派生或审批协议；Further localized mixed Chinese spacing and terminology in customer-success handoff detail / queue surfaces; this batch changes visible handoff-route, review-before-send, boundary-posture, success-check, derived-queue, and disabled-send copy plus source guards only and leaves route models, derived queues, and approval protocols unchanged |
| 2026-06-04 | 继续收口 customer success handoff detail / queue 的剩余中文术语混写；本批只改接手、分诊、建议、负责人归属、客户成功收件箱与商业交接文案及源码守卫，不改派生队列、外发禁用或审批边界；Further localized remaining mixed Chinese terminology in customer-success handoff detail / queue surfaces; this batch changes visible handoff, triage, advisory, ownership, success-inbox, and commercial-handoff copy plus source guards only and leaves derived queues, disabled external send, and approval boundaries unchanged |
| 2026-06-04 | 继续收口 customer success handoff detail / queue 中的中文混写；本批只改可见 judgement、post-send 与 queue 文案及源码守卫，不改 ownership、sendability、外发复核或非承诺边界；Further localized mixed Chinese copy in customer-success handoff detail / queue surfaces; this batch changes visible judgement, post-send, and queue copy plus source guards only and leaves ownership, sendability, outbound review, and non-commitment boundaries unchanged |
| 2026-06-04 | 继续收口 commercial narrative strengthening detail 的中文 fallback 标签；本批只改可见 label / summary 与源码守卫，不改 sendability、proposal 或 non-commitment 边界；Further localized Chinese fallback labels in commercial narrative strengthening detail; this batch changes visible labels / summary plus source guards only and leaves sendability, proposal, and non-commitment boundaries unchanged |
| 2026-06-04 | 继续收口 meeting runtime action fallback、toast 与 operator control 按钮中的中文混写；本批只改可见文案与源码守卫，不改 server action 权限、runtime 状态机或控制动作；Further localized mixed Chinese meeting runtime action fallbacks, toasts, and operator-control button copy; this batch changes visible copy plus source guards only and leaves server-action permissions, runtime state machines, and control actions unchanged |
| 2026-06-04 | 继续收口 runtime operator 与 meeting v2 runtime 的中文空状态和操作说明混写；本批只改可见文案与源码守卫，不改运行时队列、权限、状态机或控制动作；Further localized mixed Chinese empty-state and guidance copy in the runtime operator and meeting v2 runtime panels; this batch changes visible copy plus source guards only and leaves runtime queues, permissions, state machines, and control actions unchanged |
| 2026-06-04 | 继续收口 runtime operator panel 的中文空状态、描述与计数标签；本批只改 `/operating` 可见文案与源码守卫，不改运行时队列、权限、状态机或控制动作；Further localized Chinese empty-state, description, and count labels in the runtime operator panel; this batch changes `/operating` visible copy plus a source guard only and leaves runtime queues, permissions, state machines, and control actions unchanged |
| 2026-06-04 | 继续收口 external narrative 与 commitment reinforcement / sendability detail view 的中文 fallback 标签；本批只改可见标签与源码守卫，不改发送评估、加固、叙事或非承诺协议；Further localized Chinese fallback labels in external narrative and commitment reinforcement / sendability detail views; this batch changes visible labels plus a source guard only and leaves sendability evaluation, strengthening, narrative, and non-commitment protocols unchanged |
| 2026-06-04 | 继续收口 CRM import 动态显示文案中的中文混写；本批只改中文显示清洗规则，不改连接器接入、导入预览、预热或冲突处理逻辑；Further localized mixed Chinese copy in CRM import dynamic display text; this batch changes Chinese display-cleanup rules only and leaves connector onboarding, import preview, warmup, and conflict handling unchanged |
| 2026-06-04 | 继续收口企业微信 / 飞书 / 钉钉 OAuth callback state fallback 文案；本批只改 settings redirect 可见缺 state 文案质量，不改 OAuth、session、connector 写入或 public-login fallback；Further localized WeCom / Feishu / DingTalk OAuth callback-state fallback copy; this batch changes settings-redirect-visible missing-state copy quality only and leaves OAuth, sessions, connector writes, and public-login fallback unchanged |
| 2026-06-04 | 继续收口连接器 action 的 env 配置错误 fallback 文案；本批只改 Aliyun founder default 与 DingTalk app agent id 缺失提示，不改连接器权限、同步、邀请发送或凭据读取逻辑；Further localized connector action env-configuration fallback copy; this batch changes Aliyun founder-default and DingTalk app-agent-id missing prompts only and leaves connector permissions, sync, invite sending, and credential lookup logic unchanged |
| 2026-06-04 | 继续收口 Alipay / WeChat Pay checkout 未配置 fallback 文案；本批只改中国区支付 checkout 配置错误文案，不改签名、notify、query、支付请求或窄支付边界；Further localized Alipay / WeChat Pay checkout-not-configured fallback copy; this batch changes China-payment checkout config-error copy only and leaves signing, notify, query, payment requests, and the narrow-payment boundary unchanged |
| 2026-06-04 | 继续收口中国区支付 APP_URL 缺失 fallback 文案；本批只改 Alipay / WeChat Pay checkout URL 生成前的配置错误文案与 locale 透传，不改 URL path、支付参数或窄支付边界；Further localized China payment APP_URL missing fallback copy; this batch changes config-error copy and locale propagation before Alipay / WeChat Pay checkout URL generation only, leaving URL paths, payment parameters, and the narrow-payment boundary unchanged |
| 2026-06-04 | 继续收口 Stripe checkout missing-redirect fallback 文案；本批只改 settings action 可见错误文案，不改 Stripe checkout 创建、审计顺序、支付通道解析或结算边界；Further localized Stripe checkout missing-redirect fallback copy; this batch changes settings-action-visible error copy only and leaves Stripe checkout creation, audit ordering, payment-rail resolution, and settlement boundaries unchanged |
| 2026-06-04 | 继续收口 billing portal 的 customer-missing fallback 文案；本批只改 settings action 可见错误文案，不改 portal eligibility、Stripe portal 创建、支付通道解析或结算边界；Further localized billing-portal customer-missing fallback copy; this batch changes settings-action-visible error copy only and leaves portal eligibility, Stripe portal creation, payment-rail resolution, and settlement boundaries unchanged |
| 2026-06-04 | 继续收口 billing checkout 的 payment-rail 不可用 fallback 文案；本批只改 settings action 可见错误文案，不改支付通道解析、checkout 创建、结算或窄支付边界；Further localized billing-checkout payment-rail unavailable fallback copy; this batch changes settings-action-visible error copy only and leaves payment-rail resolution, checkout creation, settlement, and the narrow-payment boundary unchanged |
| 2026-06-04 | 继续收口 runtime dispatch-notifications 与 DingTalk hourly sync cron API 的 auth / validation fallback 文案；本批只改 API caller 可见错误文案，不改 cron token 校验、DingTalk 采集或 signal notification dispatch；Further localized runtime dispatch-notifications and DingTalk hourly-sync cron API auth / validation fallback copy; this batch changes API-caller-visible error copy only and leaves cron-token validation, DingTalk ingest, and signal-notification dispatch unchanged |
| 2026-06-04 | 继续收口 extension API catch-all dispatcher 的 not-found / method fallback 文案；本批只改 API caller 可见错误文案，不改 route registry、handler delegation、HEAD parity 或 Allow header 语义；Further localized extension API catch-all dispatcher not-found / method fallback copy; this batch changes API-caller-visible error copy only and leaves the route registry, handler delegation, HEAD parity, and Allow-header semantics unchanged |
| 2026-06-04 | 继续收口 runtime signal collection cron API 的 auth / method / job fallback 文案；本批只改 API caller 可见错误文案，不改 cron token 校验、jobKey 解析或信号采集调度；Further localized runtime signal collection cron API auth / method / job fallback copy; this batch changes API-caller-visible error copy only and leaves cron-token validation, jobKey parsing, and signal-collection dispatch unchanged |
| 2026-06-04 | 继续收口 settings workspace switch action 的 invalid / unavailable fallback 文案；本批只改 action caller 可见错误文案，不改 membership 查询、active workspace 设置或 locale cookie 成功路径；Further localized settings workspace switch action invalid / unavailable fallback copy; this batch changes action-caller-visible error copy only and leaves membership lookup, active-workspace setting, and locale-cookie success paths unchanged |
| 2026-06-04 | 继续收口企业微信 / 飞书 / 钉钉 OAuth callback 的 workspace context fallback 文案；本批只改 settings redirect 可见错误文案，不改 OAuth、connector 写入或审计逻辑；Further localized WeCom / Feishu / DingTalk OAuth callback workspace-context fallback copy; this batch changes settings-redirect-visible error copy only and leaves OAuth, connector writes, and audit logic unchanged |
| 2026-06-04 | 继续收口 Helm v2 runtime trace / checkpoint resume API 的 not-found / resume-failed fallback 文案；本批只改 API caller 可见 fallback，不改 runtime ownership、续传执行或 trace payload；Further localized Helm v2 runtime trace / checkpoint resume API not-found / resume-failed fallback copy; this batch changes API-caller-visible fallback copy only and leaves runtime ownership, resume execution, and trace payloads unchanged |
| 2026-06-04 | 继续收口 trial admin decision action 的复核权限、参数与更新失败文案；本批只改管理员可见错误文案，不改试用申请、复核权限或通知流程；Further localized trial admin decision action review-permission, payload, and update-failure copy; this batch changes admin-visible error copy only and leaves trial applications, review permissions, and notification flows unchanged |
| 2026-06-04 | 继续收口 public auth 表单密码确认 validation 文案；本批只改 action caller 可见错误文案，不改注册、登录、验证码或身份补全流程；Further localized public-auth password confirmation validation copy; this batch changes action-caller-visible error copy only and leaves signup, login, verification-code, and identity-completion flows unchanged |
| 2026-06-04 | 继续补齐 meeting runtime closeout / close server action 的 pre-session validation fallback；本批只改 action caller 可见错误文案，不改鉴权顺序、运行时状态机或执行边界；Further filled meeting runtime closeout / close server-action pre-session validation fallbacks; this batch changes action-caller-visible error copy only and leaves authorization order, runtime state machines, and execution boundaries unchanged |
| 2026-06-03 | 继续收口 customer-facing offer / external proposal 与 proposal package 边界文案中的中文混写；本批只改中文可见文案，不改发送评估、提案层级或非承诺边界；Further localized Chinese visible mixed-language copy in customer-facing offer / external proposal and proposal package boundary copy; this batch changes visible copy only and leaves sendability evaluation, proposal layering, and non-commitment boundaries unchanged |
| 2026-06-03 | 继续收口 billing settlement 与 payout readiness 面板中的中文结算术语；本批只改中文可见文案，不改手工结算、站外付款、支付执行或 SLA 边界；Further localized Chinese settlement terminology in billing settlement and payout-readiness panels; this batch changes visible copy only and leaves manual settlement, off-platform payment, payout execution, and SLA boundaries unchanged |
| 2026-06-03 | 继续收口 customer-facing offer 与 commercial narrative detail view 的中文边界标签；本批只改可见标签，不改客户可见 / 仅内部 / 非承诺边界协议；Further localized Chinese boundary labels in customer-facing offer and commercial narrative detail views; this batch changes visible labels only and leaves customer-visible, internal-only, and non-commitment boundary protocols unchanged |
| 2026-06-03 | 继续收口 Helm v2 draft comms 运行时的中文边界说明、草稿摘要和风险守卫文案；本批保留 artifact / enum / requestedAction 协议字段，并补充等价中文缓释语识别，不授予自动发送、自动预约或正式承诺权限；Further localized Chinese boundary notes, draft summaries, and risk-guard copy in the Helm v2 draft-comms runtime; this batch keeps artifact / enum / requestedAction protocol fields intact, adds equivalent Chinese mitigation detection, and grants no auto-send, auto-booking, or formal-commitment authority |
| 2026-06-03 | 继续收口 contrast-test 与 dark-mode-test 低频公开测试 route 的双语文案；本批只改可见说明文案和语言读取，不改配色、主题切换或可访问性测试语义；Further localized contrast-test and dark-mode-test low-frequency public test routes; this batch changes visible explanatory copy and locale reading only, and leaves palettes, theme switching, and accessibility-test semantics unchanged |
| 2026-06-03 | 继续收口 weekly report 生成服务的摘要与审计文案；本批使用既有 workspace locale 入参生成中英文 summary / audit copy，不改报告指标、权限或数据结构；Further localized weekly-report service summaries and audit copy; this batch uses the existing workspace-locale input for bilingual summary / audit copy and leaves report metrics, permissions, and data structures unchanged |
| 2026-06-03 | 继续收口 Helm v2/runtime API validation fallback 文案；本批使用 workspace default locale 解析常见参数、受众与 session / meeting 缺失错误，不改 route 权限、状态码或 payload 结构；Further localized Helm v2/runtime API validation fallback copy; this batch resolves common parameter, audience, and session / meeting missing errors from workspace default locale and leaves route permissions, status codes, and payload structures unchanged |
| 2026-06-03 | 继续收口 meeting server action 的 pre-session validation fallback 文案；本批对校验先于 workspace session 的 action 使用中英并列 fallback，不改鉴权顺序、运行时状态机或执行边界；Further localized meeting server-action pre-session validation fallback copy; this batch uses explicit zh/en fallback for actions that validate before loading workspace session and leaves authorization order, runtime state machines, and execution boundaries unchanged |
| 2026-06-03 | 继续收口 blockers / commitments / memory API 的 validation 与失败 fallback 文案；本批只改 API caller 可见错误文案，不改权限、状态码、schema 或 memory/runtime 服务调用；Further localized blockers / commitments / memory API validation and failure fallback copy; this batch changes API-caller-visible error copy only and leaves permissions, status codes, schemas, and memory / runtime service calls unchanged |
| 2026-06-03 | 继续收口 recommendations API 的 validation、success 与 failure fallback 文案；本批只改 API caller 可见 message，不改推荐生成、排序、埋点、反馈权限或 payload 结构；Further localized recommendations API validation, success, and failure fallback copy; this batch changes API-caller-visible messages only and leaves recommendation generation, ranking, tracking, feedback permissions, and payload structures unchanged |
| 2026-06-03 | 继续收口 memory timeline、evolution patterns 与 problem-spaces API 的低频 validation / source label 文案；本批只改 API caller 可见文案与默认 source label，不改查询、权限、runtime ownership 或 problem-space 创建逻辑；Further localized low-frequency validation / source-label copy in the memory timeline, evolution patterns, and problem-spaces APIs; this batch changes API-caller-visible copy plus default source labels only and leaves queries, permissions, runtime ownership, and problem-space creation logic unchanged |
| 2026-06-03 | 继续收口 conversation capture 服务层的 fallback transcript、speaker label 与审计摘要文案；本批只改 capture caller / audit 可见文案，不改权限、ASR、落库结构或处理流程；Further localized conversation-capture service fallback transcript, speaker-label, and audit-summary copy; this batch changes capture-caller / audit-visible copy only and leaves permissions, ASR, persistence structure, and processing flow unchanged |
| 2026-06-04 | 继续收口 conversation capture ingest 与 OpenClaw memory sync API 的成功 message；本批只改 API caller 可见成功文案，不改 capture 权限、ownership、落库流程、OpenClaw host-local 同步边界或错误脱敏；Further localized conversation-capture ingest and OpenClaw memory-sync API success messages; this batch changes API-caller-visible success copy only and leaves capture permissions, ownership checks, persistence flow, OpenClaw host-local sync boundaries, and error redaction unchanged |
| 2026-06-03 | 继续收口 memory export API 的 text/plain 导出正文标签；本批只改导出文件内的 caller 可见文案，不改查询、权限、审计 payload、headers 或文件名；Further localized text/plain export-body labels in the memory export API; this batch changes caller-visible copy inside the exported file only and leaves queries, permissions, audit payloads, headers, and filenames unchanged |
| 2026-06-03 | 继续收口 LLM / briefing API 的失败 fallback 文案；本批只改 API caller 可见失败文案，不改 insight / memory 权限、ownership 校验、LLM 调用或返回 payload 结构；Further localized LLM / briefing API failure fallback copy; this batch changes API-caller-visible failure copy only and leaves insight / memory permissions, ownership checks, LLM calls, and response payload structures unchanged |
| 2026-06-04 | 继续收口 evolution skill / strategy suggestion API 的失败 fallback 文案；本批只改 API caller 可见失败文案，不改 workspace policy 权限、ownership 校验、能力晋级、正式复核或策略建议状态机；Further localized evolution skill / strategy suggestion API failure fallback copy; this batch changes API-caller-visible failure copy only and leaves workspace-policy permissions, ownership checks, capability promotion, formal review, and strategy-suggestion state machines unchanged |
| 2026-06-04 | 继续收口 blockers / commitments / memory 写入 API 的成功 message；本批只改 API caller 可见成功文案，不改权限、ownership、状态码、schema、写入服务或状态机；Further localized blockers / commitments / memory write API success messages; this batch changes API-caller-visible success copy only and leaves permissions, ownership checks, status codes, schemas, write services, and state machines unchanged |
| 2026-06-04 | 继续收口 evolution skill / strategy suggestion API 的成功 message；本批只改 API caller 可见成功文案，不改 workspace policy 权限、ownership 校验、能力晋级、正式复核或策略建议状态机；Further localized evolution skill / strategy suggestion API success messages; this batch changes API-caller-visible success copy only and leaves workspace-policy permissions, ownership checks, capability promotion, formal review, and strategy-suggestion state machines unchanged |
| 2026-06-04 | 继续收口 customer-facing offer / external proposal detail model 的中文空格残留与英文分支夹中文问题；本批只改可见文案，不改发送评估、对外发送、复核或非承诺边界；Further localized customer-facing offer / external proposal detail-model copy by removing Chinese spacing leftovers and Chinese text inside English branches; this batch changes visible copy only and leaves sendability evaluation, external send, review, and non-commitment boundaries unchanged |
| 2026-06-04 | 继续收口 conversation detail 与 external narrative detail 的中文空格和中英混写；本批只改可见 detail 文案，不改对话、叙事、发送评估、复核或非承诺边界；Further localized conversation detail and external narrative detail copy by removing Chinese spacing leftovers and mixed English fragments; this batch changes visible detail copy only and leaves conversation, narrative, sendability, review, and non-commitment boundaries unchanged |
| 2026-06-04 | 继续收口 inbox / follow-up / review request detail model 的中文空格和中英混写；本批只改可见 detail 文案，不改收件箱、跟进、复核、发送评估或非承诺边界；Further localized inbox / follow-up / review request detail-model copy by removing Chinese spacing leftovers and mixed English fragments; this batch changes visible detail copy only and leaves inbox, follow-up, review, sendability, and non-commitment boundaries unchanged |
| 2026-06-04 | 继续收口 billing settlement 与 tenant resource readiness 面板中的可见混写；本批只改结算收口与受控写回试点说明文案，不改结算、写回、确认或外部系统边界；Further localized visible mixed copy in billing settlement and tenant resource readiness panels; this batch changes settlement closeout and guarded-write pilot explanatory copy only and leaves settlement, writeback, acknowledgement, and external-system boundaries unchanged |
| 2026-06-03 | 继续收口 skill suggestion formal review、human action execution boundary 与 program invite issuance 文案中的中文混写；本批只改中文可见文案，不改能力晋升状态机、人工执行契约或邀请发放权限；Further localized Chinese visible mixed-language copy in skill suggestion formal review, human action execution boundary, and program invite issuance copy; this batch changes visible copy only and leaves capability-promotion state machines, human-execution contracts, and invite-issuance permissions unchanged |
| 2026-06-03 | 继续收口 recommendation feedback、home surface arrival banner 与 billing program catalog 文案中的中文混写；本批只改中文可见文案，不改推荐反馈动作、首页路由或分成规则结构；Further localized Chinese visible mixed-language copy in recommendation feedback, home surface arrival banner, and billing program catalog surfaces; this batch changes visible copy only and leaves recommendation feedback actions, home routing, and revenue-rule structures unchanged |
| 2026-06-03 | 继续收口 approval first-loop 复核卡片与步骤列表中的中文混写；本批只改中文 display model 文案，不改审批协议、状态机或执行边界；Further localized Chinese visible mixed-language copy in the approval first-loop review card and step list; this batch changes display-model copy only and leaves approval protocol, state machines, and execution boundaries unchanged |
| 2026-06-03 | 继续收口 internal commercialization、GTM customer demand brief 与 settings custom engagement / tenant resource readiness 文案中的中文混写；本批只改中文可见文案，不改内部 GTM 状态机、设置动作契约或资源 readiness 结构；Further localized Chinese visible mixed-language copy in internal commercialization, GTM customer demand brief, and settings custom engagement / tenant resource readiness surfaces; this batch changes visible copy only and leaves internal GTM state machines, settings action contracts, and resource readiness structures unchanged |
| 2026-06-03 | 继续收口 recommendation action、LLM 建议解释、BI 报表解释 / 复核、i18n 事件标签与 demo 入门交付文案中的中文混写；本批只改中文可见文案与 LLM 输入摘要，不改事件 key、状态机或 JSON schema；Further localized Chinese visible mixed-language copy in recommendation actions, LLM recommendation explanation, BI report analysis / review, i18n event labels, and demo onboarding copy; this batch changes visible copy and LLM input summaries only and leaves event keys, state machines, and JSON schema unchanged |
| 2026-06-03 | 继续收口 demo 行业包、角色基础、Ask Helm 解释器与推荐展示文案中的中文混写；本批只改中文用户可见文案，不改 demo 数据结构、状态机或推荐逻辑；Further localized Chinese visible mixed-language copy in demo industry packs, role foundations, the Ask Helm interpreter, and recommendation presentation; this batch changes visible copy only and leaves demo data structures, state machines, and recommendation logic unchanged |
| 2026-06-03 | 继续收口企业微信、飞书、钉钉 OAuth 回调与只读连接器排错文案中的中文混写；本批只改中文用户可见状态 / 审计摘要，不改 OAuth、采集或连接器协议；Further localized Chinese visible OAuth callback and read-only connector troubleshooting copy for WeCom, Feishu, and DingTalk; this batch changes status / audit summaries only and leaves OAuth, ingestion, and connector protocols unchanged |
| 2026-06-03 | 继续收口 Helm v2 action pack、opportunity judge、human action execution 与 worker registry 的中文运行时文案；本批仅修改可见文案，不改 artifact 文件名、enum 或状态机；Further localized Helm v2 action-pack, opportunity-judge, human-action-execution, and worker-registry runtime copy; this batch changes visible copy only and leaves artifact filenames, enums, and state machines unchanged |
| 2026-06-03 | 继续收口 billing / participant portal、proposal package detail surfaces、conversation detail view 与 trial CTA 的中文可见标签；本批目标文件扫描未发现新的明确英文残留，全工程剩余候选尚未重新校准；Further localized billing / participant portal, proposal package detail surfaces, conversation detail view, and trial CTA labels; this batch's target-file scan found no new explicit English leftovers, while whole-project remaining candidates have not been recalibrated yet |
| 2026-06-03 | 继续收口 meeting opportunity judge、inbox follow-up review request、success check、customer-facing offer / external proposal 与 commercial narrative strengthening detail model 的中文可见标签；本批目标文件严格可见残留已清理，全工程剩余候选尚未重新校准；Further localized meeting opportunity judge, inbox follow-up review request, success check, customer-facing offer / external proposal, and commercial narrative strengthening detail-model labels; this batch clears target-file strict visible-copy leftovers, while whole-project remaining candidates have not been recalibrated yet |
| 2026-06-03 | 继续收口 settings client、conversation detail、external narrative detail 与 commitment reinforcement sendability detail model 的中文可见标签；目标文件严格可见候选扫描为 0，全工程广义 ASCII 中文分支候选降至 242，严格可见候选降至 129；Further localized settings client, conversation detail, external narrative detail, and commitment reinforcement sendability detail-model labels; target-file strict visible-copy candidates now return 0 hits, whole-project broad ASCII zh-branch candidates are down to 242, and strict visible-copy candidates are down to 129 |
| 2026-06-03 | 新增 `npm run delivery:doctor -- --region cn` 静态预检，并将 Qwen credential、region / residency、npm mirror 与 OpenAI-only ASR 常见误配纳入交付工程师上手链路；Added `npm run delivery:doctor -- --region cn` static preflight and moved common Qwen credential, region / residency, npm mirror, and OpenAI-only ASR misconfigurations into the delivery-engineer onboarding path |
| 2026-06-03 | 继续收口 customer success handoff detail model 中文可见标签，目标文件有效中文分支候选扫描为 0，全工程校准扫描剩余 331；Further localized customer success handoff detail-model labels; target-file effective zh-branch candidates now return 0 hits, and whole-project calibrated candidates are 331 |
| 2026-06-03 | 补齐中国大陆 / 受限网络上手指引，修复 Prisma 与 MySQL 凭据文档漂移，并补充微信支付 lifecycle env 示例；Added Mainland China / restricted-network onboarding guidance, fixed Prisma and MySQL credential doc drift, and added WeChat Pay lifecycle env examples |
| 2026-06-03 | 继续收口 meeting v2 runtime 主面板中文操作字段，目标文件 `english` 条件中文分支扫描为 0，全工程启发式候选项降为 313；Further localized meeting v2 runtime main-panel operation fields; target-file `english` conditional scan now returns 0 hits, and whole-project heuristic candidates are down to 313 |
| 2026-06-03 | 继续收口会议人工执行与正式写回运行时面板中文操作字段，目标文件 `english` 条件中文分支扫描为 0；Further localized meeting human-execution and official-write runtime operation fields; target-file `english` conditional scan now returns 0 hits |
| 2026-06-03 | 继续收口 workspace runtime 可见面板中的指标标签、加载策略和基准矩阵文案，直接 JSX 英文标签扫描降为 0；Further localized visible workspace runtime metric labels, loading strategy labels, and benchmark matrix copy; direct JSX English-label scan now returns 0 hits |
| 2026-06-03 | 增加源码 / UI 审计标准，并记录 `zh-CN` 默认、`en-US` 可切换、display-copy 与少量硬编码 UI 标签修正；Added source / UI audit standard and recorded the `zh-CN` default, `en-US` switch, display-copy posture, and small hard-coded UI label fixes |
| 2026-06-03 | 将“交付工程师友好”加入双语化完成标准：必须说明 inspect / fork / first change / commands / evidence route / boundary；Added delivery-engineer friendliness to the bilingualization completion standard: inspect / fork / first change / commands / evidence route / boundary must be clear |
| 2026-06-03 | P1-B operations / roadmap / launch / trial / legal docs 开始加入中文主文本或 English reference summary；P1-B operations / roadmap / launch / trial / legal docs started adopting Chinese main text or English reference summaries |
| 2026-06-03 | P1-A product / boundary docs 开始加入中文主文本 + English reference；P1-A product / boundary docs started adopting Chinese main text plus English reference |
| 2026-06-03 | 建立 public-safe 双语化计划，并把 P0 intake 与 docs-entry 范围固定为独立 PR；Established the public-safe bilingualization plan and scoped P0 intake plus docs-entry work as a standalone PR |
