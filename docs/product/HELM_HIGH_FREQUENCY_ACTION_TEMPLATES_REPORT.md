---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# High Frequency Action Templates Report

## Scope

本轮不做完整 automation engine，只把最常见的高频 next action 收成统一模板化表达。

## Action Template Packs

| Template | 适用场景 | Owner | Boundary | Prerequisite / Dependency | Evidence source | Expected outcome |
| --- | --- | --- | --- | --- | --- | --- |
| follow-up action | 暖线 lead、活跃客户、会后推进链需要下一次对外动作 | Sales | review-before-send / non-commitment 继续显式 | judgement、对口上下文、next ask 已经存在 | latest meeting note / inbox / opportunity memory | 明确回复、下一次触达或决策路径 |
| review request action | draft、proposal、高风险动作需要拍板 | Founder / Delivery / Customer Success reviewer | review 只澄清 sendability / boundary，不把 recommendation 改成 commitment | draft / proposed action / boundary question 已存在 | approval trace / decision context / boundary note | approve / revise / hold |
| escalation action | blocker、dependency、delivery risk 已越过普通 follow-through | Customer Success | escalation 扩大 ownership，不扩大 certainty | 当前仍被 missing decision / dependency / delivery risk 卡住 | blocker trace / success memory / review history | 明确 escalated owner、unblocker、next accountable move |
| next meeting action | judgement 需要同步对齐 | Delivery / Recruiting / Founder | 排会可加速，但承诺和 scope 不能扩大 | decision gap / clarification gap 已显式出现 | meeting brief / open questions / chain pressure | 一场目的明确的下次会议 |
| proposal / offer next-step action | 商业推进已热，但 sendable next move 还需收形 | Sales / Founder | prerequisite / dependency / non-commitment 必须诚实可见 | proposal / package / offer / objection context 已可见 | proposal state / sendability pressure / objection trace | 更干净的 customer-facing 下一步 |
| recruiting next-step action | candidate lane 需要下一轮 interview / debrief / offer-ready move | Recruiting | candidate-facing tempo 仍受 role fit / approval / schedule reality 约束 | role demand / fit / interview state 已明确 | interview notes / candidate memory / role pressure | 更纪律化的 recruiting 下一步 |
| partner follow-through action | partner fit、custom leverage、customer matching 需要显式 follow-through | Partner / Founder / Delivery | capability / dependency / custom scope 继续显式 | partner lane / customer match / custom scope 已真实成立 | partner trace / dependency notes / custom scope memory | 明确的 partner next move 或 customer intro |

## Product Surface

这些 template 现在已经进入：

- goal-driven home
- internal operating home
- role handoff surfaces
- customer success queue / inbox fast path

## Why This Matters

本轮真正减少的是：

- 每次从零组织 wording
- 每次从零判断 owner
- 每次从零判断 boundary

## Boundary

- template pack 只是统一表达和快速触发，不是自动执行引擎
- 高频动作仍然受 prerequisite / dependency / non-commitment 约束
- recommendation / commitment 边界继续保持显式
