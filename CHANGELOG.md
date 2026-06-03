# 变更记录 / Changelog

在第一个公开 tag 之前，本项目使用 release-note-first 的变更记录。

This project follows a release-note-first changelog until the first public tag.

## 未发布 / Unreleased

- Added the public AI recommendation governance contract.
- Added multi-agent worktree governance rules to require workspace ownership checks, isolated worktrees for unrelated WIP, explicit staging, concern-separated PRs, and cross-repository dispatch instead of cross-repository edits.
- 新增公开双语化计划，并把 GitHub issue / PR intake 入口改为中英文双语。
- 为 product / boundary 文档增加中文主文本与 English reference 标记。
- 为 operations / roadmap / launch / trial / legal 文档增加中文主文本或 English reference summary。
- 将“对交付工程师友好”加入公开双语化标准，要求入口文档说明 first-change proof、验证命令和 public-safe evidence route。
- 补充源码 / UI 双语审计记录，并修正少量硬编码英文界面标签。
- 继续收口 workspace runtime 可见面板中的指标标签、加载策略和基准矩阵文案，直接 JSX 英文标签扫描降为 0。
- 继续收口会议人工执行与正式写回运行时面板的中文标签，让交付工程师在复核、执行、回执和异常跟进链路中看到中文操作字段；全工程源码 / UI 双语化仍在 P2-C 推进。
- 继续收口 meeting v2 runtime 主面板的中文标签，让接管、恢复、回放、关闭、收口、结算、人工输入、反思和整合队列在中文默认界面下可读；全工程启发式剩余候选项降为 313。
- 修复开发者上手文档的 Prisma 与 MySQL 凭据不一致问题，并补充中国大陆 / 受限网络的 npm 与 Docker 镜像配置指引、微信支付 lifecycle env 示例。
- 继续收口 customer success handoff detail model 的中文可见标签；该目标文件的有效 ASCII 中文分支候选项降为 0，全工程校准扫描剩余 331。
- 继续收口 settings client、conversation detail、external narrative detail 与 commitment reinforcement sendability detail model 的中文可见标签；目标文件严格可见候选扫描为 0，全工程广义 ASCII 中文分支候选降至 242，严格可见候选降至 129。
- 继续收口 meeting opportunity judge、inbox follow-up review request、success check、customer-facing offer / external proposal 与 commercial narrative strengthening detail model 的中文可见标签；本批目标文件严格可见残留已清理，全工程剩余候选尚未重新校准。
- 继续收口 billing / participant portal、proposal package detail surfaces、conversation detail view 与 trial CTA 的中文可见标签；本批目标文件扫描未发现新的明确英文残留，全工程剩余候选尚未重新校准。
- 继续收口 Helm v2 action pack、opportunity judge、human action execution 与 worker registry 的中文运行时文案；本批只修改可见文案，不改 artifact 文件名、enum 或状态机。
- 继续收口企业微信、飞书、钉钉 OAuth 回调与只读连接器排错文案中的中文混写；本批只改中文用户可见状态 / 审计摘要，不改 OAuth、采集或连接器协议。
- 继续收口 demo 行业包、角色基础、Ask Helm 解释器与推荐展示文案中的中文混写；本批只改中文用户可见文案，不改 demo 数据结构、状态机或推荐逻辑。
- 继续收口 recommendation action、LLM 建议解释、BI 报表解释 / 复核、i18n 事件标签与 demo 入门交付文案中的中文混写；本批只改中文可见文案与 LLM 输入摘要，不改事件 key、状态机或 JSON schema。
- 继续收口 internal commercialization、GTM customer demand brief 与 settings custom engagement / tenant resource readiness 文案中的中文混写；本批只改中文可见文案，不改内部 GTM 状态机、设置动作契约或资源 readiness 结构。
- 继续收口 approval first-loop 复核卡片与步骤列表中的中文混写；本批只改中文 display model 文案，不改审批协议、状态机或执行边界。
- 继续收口 recommendation feedback、home surface arrival banner 与 billing program catalog 文案中的中文混写；本批只改中文可见文案，不改推荐反馈动作、首页路由或分成规则结构。
- 继续收口 skill suggestion formal review、human action execution boundary 与 program invite issuance 文案中的中文混写；本批只改中文可见文案，不改能力晋升状态机、人工执行契约或邀请发放权限。
- 继续收口 customer-facing offer / external proposal 与 proposal package 边界文案中的中文混写；本批只改中文可见文案，不改发送评估、提案层级或非承诺边界。
- 继续收口 billing settlement 与 payout readiness 面板中的中文结算术语；本批只改中文可见文案，不改手工结算、站外付款、支付执行或 SLA 边界。
- 继续收口 customer-facing offer 与 commercial narrative detail view 的中文边界标签；本批只改可见标签，不改客户可见 / 仅内部 / 非承诺边界协议。
- 继续收口 Helm v2 draft comms 运行时的中文边界说明、草稿摘要和风险守卫文案；本批保留 artifact / enum / requestedAction 协议字段，并补充等价中文缓释语识别，不授予自动发送、自动预约或正式承诺权限。
- 新增 `npm run delivery:doctor -- --region cn` 静态预检，用于提示 Qwen credential、region / residency、npm mirror 与 OpenAI-only ASR 常见中国交付误配。
- 为后续 trial 与 stable release trains 参数化 `npm run release:check`。
- 新增 public release train runbook，并刷新 maintainer status baseline。
- 新增首份 public Core operating model，覆盖 mission、OKR、KPI 与 workstream boundary。
- 新增 public issue / PR intake templates 与 OPC weekly packet template。
- 新增 China accessibility and evidence-routing packet，用于 public-safe activation proof。
- 在 OPC weekly packet template 中新增 owner-gated China access receipt fields。
- 梳理 `helm-public` 的公开文档面。
- 新增 `npm run check:public-docs`，让 public docs 保持显式 allowlist。

English reference:

- Added the public bilingualization plan and bilingual GitHub issue / PR intake surfaces.
- Added Chinese main text and English reference markers to product / boundary docs.
- Added Chinese main text or English reference summaries to operations / roadmap / launch / trial / legal docs.
- Added delivery-engineer friendliness to the public bilingualization standard, requiring entry docs to explain first-change proof, verification commands, and public-safe evidence routes.
- Added a source / UI bilingual audit note and fixed a small set of hard-coded English UI labels.
- Further localized visible workspace runtime metric labels, loading strategy labels, and benchmark matrix copy; the direct JSX English-label scan now returns 0 hits.
- Further localized the meeting human-execution and official-write runtime panels so delivery engineers see Chinese operation fields across review, execution, receipt, and exception follow-through paths; full source / UI bilingualization remains in P2-C.
- Further localized the meeting v2 runtime main panel across takeover, recovery, replay, close, closeout, settlement, human-input, reflection, and consolidation queue labels; the whole-project heuristic candidate count is down to 313.
- Fixed developer quickstart drift around Prisma generation and MySQL credentials, and added Mainland China / restricted-network npm and Docker mirror guidance plus WeChat Pay lifecycle env examples.
- Further localized customer success handoff detail-model labels; the target-file effective ASCII zh-branch candidate count is now 0, and the whole-project calibrated scan has 331 remaining candidates.
- Further localized settings client, conversation detail, external narrative detail, and commitment reinforcement sendability detail-model labels; target-file strict visible-copy candidates now return 0 hits, whole-project broad ASCII zh-branch candidates are down to 242, and strict visible-copy candidates are down to 129.
- Further localized meeting opportunity judge, inbox follow-up review request, success check, customer-facing offer / external proposal, and commercial narrative strengthening detail-model labels; this batch clears target-file strict visible-copy leftovers, while whole-project remaining candidates have not been recalibrated yet.
- Further localized billing / participant portal, proposal package detail surfaces, conversation detail view, and trial CTA labels; this batch's target-file scan found no new explicit English leftovers, while whole-project remaining candidates have not been recalibrated yet.
- Further localized Helm v2 action-pack, opportunity-judge, human-action-execution, and worker-registry runtime copy; this batch changes visible copy only and leaves artifact filenames, enums, and state machines unchanged.
- Further localized Chinese visible OAuth callback and read-only connector troubleshooting copy for WeCom, Feishu, and DingTalk; this batch changes status / audit summaries only and leaves OAuth, ingestion, and connector protocols unchanged.
- Further localized Chinese visible mixed-language copy in demo industry packs, role foundations, the Ask Helm interpreter, and recommendation presentation; this batch changes visible copy only and leaves demo data structures, state machines, and recommendation logic unchanged.
- Further localized Chinese visible mixed-language copy in recommendation actions, LLM recommendation explanation, BI report analysis / review, i18n event labels, and demo onboarding copy; this batch changes visible copy and LLM input summaries only and leaves event keys, state machines, and JSON schema unchanged.
- Further localized Chinese visible mixed-language copy in internal commercialization, GTM customer demand brief, and settings custom engagement / tenant resource readiness surfaces; this batch changes visible copy only and leaves internal GTM state machines, settings action contracts, and resource readiness structures unchanged.
- Further localized Chinese visible mixed-language copy in the approval first-loop review card and step list; this batch changes display-model copy only and leaves approval protocol, state machines, and execution boundaries unchanged.
- Further localized Chinese visible mixed-language copy in recommendation feedback, home surface arrival banner, and billing program catalog surfaces; this batch changes visible copy only and leaves recommendation feedback actions, home routing, and revenue-rule structures unchanged.
- Further localized Chinese visible mixed-language copy in skill suggestion formal review, human action execution boundary, and program invite issuance copy; this batch changes visible copy only and leaves capability-promotion state machines, human-execution contracts, and invite-issuance permissions unchanged.
- Further localized Chinese visible mixed-language copy in customer-facing offer / external proposal and proposal package boundary copy; this batch changes visible copy only and leaves sendability evaluation, proposal layering, and non-commitment boundaries unchanged.
- Further localized Chinese settlement terminology in billing settlement and payout-readiness panels; this batch changes visible copy only and leaves manual settlement, off-platform payment, payout execution, and SLA boundaries unchanged.
- Further localized Chinese boundary labels in customer-facing offer and commercial narrative detail views; this batch changes visible labels only and leaves customer-visible, internal-only, and non-commitment boundary protocols unchanged.
- Further localized Chinese boundary notes, draft summaries, and risk-guard copy in the Helm v2 draft-comms runtime; this batch keeps artifact / enum / requestedAction protocol fields intact, adds equivalent Chinese mitigation detection, and grants no auto-send, auto-booking, or formal-commitment authority.
- Added `npm run delivery:doctor -- --region cn` static preflight for common China-delivery misconfigurations around Qwen credentials, region / residency, npm mirrors, and the OpenAI-only ASR path.
- Parameterized `npm run release:check` for later trial and stable release trains.
- Added the public release train runbook and refreshed the maintainer status baseline.
- Added the first public Core operating model with mission, OKRs, KPIs, and workstream boundaries.
- Added public issue / PR intake templates and an OPC weekly packet template.
- Added a China accessibility and evidence-routing packet for public-safe activation proof.
- Added owner-gated China access receipt fields to the OPC weekly packet template.
- Curated the public documentation surface for `helm-public`.
- Added `npm run check:public-docs` to keep public docs on an explicit allowlist.

安全致谢仅在 reporter 同意后列入本文件。

Security acknowledgements may be listed here with reporter consent.
