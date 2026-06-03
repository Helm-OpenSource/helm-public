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
   文案、blockers / commitments / memory API 的 validation 与失败 fallback 文案、
   recommendations API 的 validation / success / failure fallback 文案已继续收口。
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
   fallback copy, plus blockers / commitments / memory API validation and
   failure fallback copy, plus recommendations API validation / success / failure
   fallback copy, have also been localized for Chinese operation fields. This
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
