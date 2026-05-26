---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Baseline 1-4 Review Report

## Scope

本轮 review 覆盖：

- Sprint 1 foundation docs
- Sprint 2 / 3 / 4 runtime reports
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `lib/helm-v2/*` runtime / eval / approval / memory contracts
- meetings surface 与 Sprint 2 / 3 / 4 对应 UI

## Current Review Result

当前 review 结论是：

- foundation contracts 与 runtime code 已经对齐
- Sprint 2 / 3 / 4 三条真实运行闭环已经都存在真实代码入口
- self-check / boundary guard / eval scripts 已经能共同约束当前 truth
- 当前最需要收口的是 historical wording，而不是新增 runtime

## Tightened Truth In This Freeze

本轮 freeze 明确收紧了以下 truth：

1. Sprint 2 当前 canonical loop 不再写成“直接 shadow update”  
   当前真实代码已经是：
   `meeting -> structured facts -> action pack -> human confirm -> memory promotion / downstream opportunity judgement handoff`

2. 真正的 `shadow consume` 已明确归属 Sprint 4  
   也就是：
   `confirmed meeting facts -> Opportunity Judge -> human review -> shadow consume`

3. Sprint 3 的 `approved` 继续只表示允许进入下一步人工动作  
   不等于 sent，不等于 committed，不等于 official writeback

4. Sprint 1-4 的共同 foundation 继续是：
   - object graph
   - layered memory
   - artifact-first worker
   - action-level approval / audit

## What Is Consistent Now

- `recommendation 不等于 commitment`
- `facts 与 inferred 必须分开`
- `shadow 与 official 必须分开`
- `default 不是 team mode`
- `official CRM writeback` 仍然没有打开
- `send authority` 仍然没有打开
- `artifact` 仍必须带 evidence / provenance / confidence / open questions

## What Remains Deferred

- official CRM writeback
- send authority
- workflow control
- default team mode
- sandbox
- 更多 worker runtime
- broader operating platform widening

## Review Judgment

Helm v2 Sprint 1-4 当前已经足够进入 baseline freeze。

这轮 review 最重要的价值不是新增功能，而是把 foundation truth、runtime truth、historical sprint wording、README/docs 索引、自检和边界守卫重新拉回同一版当前现实。
