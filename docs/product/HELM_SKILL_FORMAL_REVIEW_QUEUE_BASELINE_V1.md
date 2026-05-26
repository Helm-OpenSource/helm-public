---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM Skill Formal Review Queue Baseline V1

更新时间：2026-04-09

## 1. 本轮目标

把 skill capability loop 再往前补一层：不改变 `PatternFact -> SkillSuggestion -> 人工 accept -> candidate capability` 主链，只把后续晋级改成更可解释的 calibration-driven posture，并补一条 manual formal review queue。

本轮不做：

- formal skill auto-promotion
- static `skill-catalog` auto-write
- auto routing / worker binding
- auto-send
- auto commitment
- high-risk official write authority expansion

## 2. 当前已经完整成立

- calibration-driven promotion 已成立
  - `candidate_skill -> probationary_skill` 现在会一起读取：
    - calibration score
    - evidence
    - revalidation
    - adoption
    - dismissal
    - boundary incident
- formal review status 已成立
  - `READY / QUEUED / HARDENING_REQUIRED` 已进入 `SkillSuggestion`
  - queue / return-hardening 都会留下 audit、event、notification
- operator surface 已成立
  - `/settings?tab=policies` 会显示 recently adopted candidate capabilities 和 formal skill review queue
  - dashboard evolution 会前置最新 formal review item
- governance write path 已成立
  - settings action 与 API route 都继续受 `canManageWorkspacePolicies` + workspace ownership 保护

## 3. 已成形但仍需下一层

- formal review queue 已成立，但 formal review checklist 仍需下一层
  - 当前只把 item 明确入队/退回，不做 reviewer assignment、catalog patch 模板或更细 SOP
- calibration threshold 已成形，但仍需后续试点校准
  - 当前阈值已可运行，但还需要更长周期 adoption / rollback / boundary evidence 来继续调参

## 4. 刻意未做

- formal review queue 不自动晋级 formal skill
- queue item 不自动获得 routing、send、commitment 或 official write authority
- 不把这层扩成 skill marketplace、workflow engine 或 orchestration plane

## 5. 风险项

- calibration threshold 过宽或过窄，都会影响晋级可信度
- `QUEUED` 容易被误读为“已经成为正式系统能力”
- `HARDENING_REQUIRED` 仍依赖事件质量；如果 event log 漏记，会削弱校准解释力

## 6. 边界说明

- `candidate capability != formal skill`
- `formal review queue != automatic promotion`
- `probationary capability != execution authority`
- `recommendation != commitment`
