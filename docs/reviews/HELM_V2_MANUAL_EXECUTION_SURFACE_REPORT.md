---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Manual Execution Surface Report

## 目标

在 approved artifact 后给用户一个清楚的“下一步由我人工执行什么”的作用面。

## 当前 surface

- approved comms draft -> manual send step
- approved calendar options -> manual scheduling step
- approved shadow next-step -> manual CRM / pipeline step
- approved handoff artifact -> manual delivery / CS handoff step

## 当前展示内容

- artifact / recommendation summary
- audience
- boundary
- prerequisites / dependencies
- why now
- recommended human action
- current approval state
- current risk review
- current evidence refs

## 当前 truth

- 这是人工执行入口，不是自动执行入口
- 这是下一步动作建议，不是系统承诺
- 这一步完成后仍需要 execution acknowledgement 才算闭环
- no auto-send
- no auto-book
- no official CRM writeback

## 当前状态

已经完整成立：

- approved artifacts 后已有清楚的人工执行面
- 用户已能在 meeting detail 中看到 recommended human action

已成形但仍需下一层：

- richer role-specific layout
- more explicit cross-object handoff entry points
