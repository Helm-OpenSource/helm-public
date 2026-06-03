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
