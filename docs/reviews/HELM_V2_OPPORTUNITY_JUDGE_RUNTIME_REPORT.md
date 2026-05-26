---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Opportunity Judge Runtime Report

## Scope

Sprint 4 把 `Opportunity Judge` 从 contract 推进到真实 runtime。当前实现只消费 `confirmed meeting facts`，产出 reviewable judgement artifacts，并保持：

- no official CRM writeback
- no customer-facing commitment
- no hidden stage jump without evidence

## What Landed

- `runOpportunityJudgeRuntime(...)` 已进入真实代码路径：
  - [opportunity-judge-runtime.ts](../../lib/helm-v2/opportunity-judge-runtime.ts)
- 输入已固定为：
  - confirmed meeting facts
  - current opportunity shadow / official summary
  - workspace summary
  - promoted object memory
  - historical timeline
  - policy boundary notes
- 最小产物已真实生成：
  - `opportunity_delta.json`
  - `next_step_brief.md`
  - `manager_attention_flags.json`
  - `opportunity_judgement_bundle.json`

## Runtime Boundary

- `Opportunity Judge` 只写 reviewable artifact 和 shadow-only consume path
- `confirmed` 不等于 official CRM writeback
- `manager attention` 只是 attention，不是 final decision
- `recommended next action` 只是 recommendation，不是 commitment

## Current Result

- `Opportunity Judge` 已真实运行
- stage / blocker / next best action / manager attention 已可解释
- downstream review 仍然是必经，不可跳过
