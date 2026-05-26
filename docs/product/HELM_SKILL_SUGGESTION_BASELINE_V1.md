---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM Skill Suggestion Baseline V1

更新时间：2026-04-09

## 1. 本轮目标

把 `PatternFact -> SkillSuggestion -> 人工 accept -> candidate capability` 收成 repo 内真实主链，并把 `candidate -> probationary -> formal` 的晋级边界写清楚。

本轮不做：

- runtime-generated formal skill
- 自动修改静态 `skill-catalog`
- auto routing
- auto-send
- auto commitment
- high-risk official write authority expansion

## 2. 当前已经完整成立

- `PatternFact -> SkillSuggestion` 已成立
  - evolution refresh 会根据稳定 pattern 生成 `SkillSuggestion`
  - 建议只覆盖 `read_only`、`draft_only`、`internal_write` 这类低风险姿态
- `SkillSuggestion -> 人工 accept -> candidate capability` 已成立
  - operator 可以在 `/settings?tab=policies` 接受或忽略候选能力建议
  - accept 后写入 `CapabilityCatalogEntry`
  - capability 初始阶段固定为 `candidate_skill`
- operator surface 已成立
  - dashboard 会显示最新 open `SkillSuggestion`
  - settings 会显示 open skill suggestions 和 recently adopted candidate capabilities
- tenant governance 已成立
  - API accept / dismiss 复用现有 workspace policy capability seam
  - write path 保持 tenant ownership 与 audit/event trace

## 3. 已成形但仍需下一层

- `candidate_skill -> probationary_skill` 自动晋级已成形
  - 当前依据 `calibration score + evidence + revalidation + adoption + dismissal + boundary incident` 自动提升到 `probationary_skill`
  - 仍然只是 capability catalog 层，不是 formal skill
- `formal review ready` 标记已成形
  - 系统会在校准信号更稳时显示 formal review readiness
  - 现在也可以显式进入 manual formal review queue，但仍需要人工补静态 catalog、tests、guards 和 docs

## 4. 刻意未做

- 不自动生成新的正式 `OperatingSkillId`
- 不把 candidate capability 自动接入 routing / worker binding
- 不让 suggestion/capability 自动获得 customer-facing send 权限
- 不把这层扩成 marketplace、workflow engine 或 orchestration plane

## 5. 风险项

- pattern 可能代表局部偏好，不一定足够升格成正式 skill
- candidate capability 若被误解为 formal skill，容易造成 execution authority 误读
- probationary capability 如果缺少持续 review，可能被误写成“系统已经掌握新能力”
- formal review queue 如果写得像自动晋级通道，容易让 operator 误解入队即 formal skill

## 6. 边界说明

- `recommendation != commitment`
- `SkillSuggestion != formal skill`
- `candidate capability != execution authority`
- 任何 customer-facing wording 如有承诺风险，仍应补：
  - boundary note
  - prerequisite note
  - dependency note
  - risk note
  - non-commitment note
