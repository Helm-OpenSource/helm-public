---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Retro To Memory Goal Feedback Report

## Scope

本轮不做完整自动总结平台，只把 operating loop 最后一段的回挂路径说清楚、做稳定、做更快引用。

## Required Write-back Paths

### meeting / review -> memory

- 当前入口：meeting detail、review request、customer success queue
- 回挂目标：memory timeline / replay
- 当前作用：解释为什么系统现在会这样排序、这样 handoff、这样保留 boundary

### decision / blocker -> campaign

- 当前入口：goal-driven home、operating home、customer success queue
- 回挂目标：current campaign / top blockers / decision requests
- 当前作用：让首页和 operating home 不再落后于最新 blocker 和 decision

### follow-through result -> object summary

- 当前入口：operating object card、role handoff surface、customer success queue
- 回挂目标：object current judgement / next step / summary
- 当前作用：避免团队下一轮重新读一遍同样上下文

### escalation resolution -> customer success memory

- 当前入口：customer success queue、success checks、expansion reviews
- 回挂目标：success memory / issue trace / escalation trace
- 当前作用：保持 issue、escalation、renewal risk 的后续判断连续

### recruiting / partner outcome -> operating object summary

- 当前入口：recruiting / partner role surface
- 回挂目标：candidate / partner / workstream summary
- 当前作用：让 role handoff 不必再次手工拼装 why-now

## Summary Rules

- 自动进入 summary：
  - object current judgement 的最新结果
  - current campaign 的 blocker / decision pressure
  - role handoff 当前 immediate action 的背景解释
- 只进入 evidence / replay：
  - 长尾 trace
  - 历史细节
  - 不需要干扰动作层的长说明
- 必须保留 boundary trace：
  - review-before-send
  - non-commitment
  - dependency / prerequisite
  - escalation / renewal risk
- 必须更新 goal / campaign status：
  - blocker cleared
  - new blocker introduced
  - decision changed priority order

## Product Surface

本轮已经把 `Retro -> memory / goal / campaign` 放进：

- goal-driven home
- internal operating home
- role handoff surfaces
- customer success queue

## Conclusion

- 复盘 -> memory / goal / campaign 的路径已经更清楚
- operating loop 最后一段现在更容易闭合
- 当前仍不是完整 retro platform 或 automatic summarization engine
