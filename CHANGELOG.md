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
