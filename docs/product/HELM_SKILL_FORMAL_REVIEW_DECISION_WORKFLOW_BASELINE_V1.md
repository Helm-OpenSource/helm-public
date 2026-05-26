---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM Skill Formal Review Decision Workflow Baseline V1

更新时间：2026-04-09

## 1. 本轮目标

把 skill capability governance 从“能入队 formal review queue”继续推进到“能留下明确人工决定”的状态。

本轮只补：

- `QUEUED -> approve / defer / reject / return-hardening` 的 manual review decision workflow
- reviewer、review note、formal review checklist 的持久化
- recent formal review decisions operator readout

本轮不做：

- formal promotion helper
- static `skill-catalog` auto-write
- formal skill auto-promotion
- auto routing / worker binding
- auto-send
- auto commitment
- high-risk official write authority expansion

## 2. 当前已经完整成立

- formal review decision workflow 已成立
  - `APPROVED_PENDING_PROMOTION / DEFERRED / REJECTED` 已进入 `SkillSuggestion`
  - queue item 现在可以被人工 approve、defer、reject，或 return-hardening
- reviewer evidence 已成立
  - reviewer、decision note、decision time、formal review checklist 都会被持久化
  - checklist 默认覆盖 `catalog / tests / guards / docs / boundary`
- operator surface 已成立
  - `/settings?tab=policies` 会显示 queued item 的 review checklist 与 decision action
  - `/settings?tab=policies` 也会显示 recent formal review decisions
  - dashboard evolution 会前置最新 formal review decision
- calibration feedback loop 已成立
  - `skill_formal_review_returned` 与 `skill_formal_review_rejected` 现在会进入 boundary incident 计数

## 3. 已成形但仍需下一层

- approved pending promotion 已成立，但 formal promotion helper 仍需下一层
  - 当前只把 item 收成 `approved-pending-promotion`
  - 仍需要后续人工补 catalog patch、tests、guards 和 docs，才能变成 formal skill
- review queue calibration 已成形，但仍需更长周期信号
  - 当前已开始记录 reviewer 决定
  - 后续仍应补 queue aging、rollback、manual override 与 promotion 后复用效果

## 4. 刻意未做

- `approved pending promotion != formal skill`
- `formal review decision workflow != formal promotion`
- `manual review decision != execution authority`
- 不自动把 capability 写进静态 skill catalog
- 不自动获得 routing、worker binding、send、commitment 或 official write authority

## 5. 风险项

- `APPROVED_PENDING_PROMOTION` 容易被误读成“已经正式发布”
- checklist 如果变成机械勾选，会削弱人工评审价值
- rejection / return 仍依赖事件质量；如果日志漏记，会影响 calibration 解释

## 6. 边界说明

- `approved pending promotion != formal skill`
- `formal review decision workflow != formal promotion`
- `manual review decision != execution authority`
- `recommendation != commitment`
