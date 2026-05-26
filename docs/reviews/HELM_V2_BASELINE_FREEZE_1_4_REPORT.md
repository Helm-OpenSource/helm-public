---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Baseline Freeze 1-4 Report

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Foundation contracts | object / memory / artifact / approval 四层已冻结 | 更完整 runtime schema 与 official integration 仍需下一层 | 不做完整 operating platform | planned API 易被误读成已全部实现 |
| Runtime tables | 最小集已成立 | richer object-native tables 仍需下一层 | 不做 broader runtime platform | 后续扩 handoff / official path 时需补表 |
| Meeting to Action Pack runtime | 已冻结 | 更真实 transcript / connector ingestion 仍需下一层 | 不做 auto-commit / auto-send | source quality 和 extraction 仍需压测 |
| Draft-only Comms runtime | 已冻结 | 更真实 calendar / mailbox context 仍需下一层 | 不做 send authority | approved 被误读成 sent 的风险 |
| Opportunity Judge runtime | 已冻结 | 更深 CRM / pipeline context 仍需下一层 | 不做 official CRM writeback | judgement heuristic 仍需更多样本 |
| Eval harness / guard / self-check | 已冻结 | future-stage checks 仍可继续扩 | 不做 benchmark platform | historical wording 漂移会破坏一致性 |
| Recommendation / commitment boundary | 当前仍稳定 | 更细 commitment taxonomy 仍需下一层 | 不做 automatic commitment | customer-facing wording 漂移 |
| Shadow / official separation | 当前仍稳定 | future official gate 仍需单独 sprint | 不开 official writeback | 若过早接 official path，风险显著上升 |
| Runtime sandbox / team mode | 当前仍未打开 | future complex tasks 可再评估 | 不做 sandbox，不做 default team mode | scope 扩张时容易误开 |

## 1. 当前版本哪些 Helm v2 foundation 能力已经完整成立

- object graph contracts
- layered memory contracts
- artifact-first worker registry
- action-level approval matrix
- primary event flow
- planned API / data model baseline
- 最小 runtime tables
- Sprint 2 / 3 / 4 三条真实运行闭环
- Sprint 2 / 3 / 4 eval harness
- self-check / boundary guard / regression expectations

## 2. 哪些能力已成形但仍需下一层

- richer official-system integration
- richer object-native handoff / timeline tables
- more realistic connector ingestion
- richer manager / operator review ergonomics
- more golden cases and broader eval fixtures
- deeper memory promotion / invalidation policy

## 3. 哪些地方刻意未做，为什么

刻意未做：

- send authority
- workflow control
- official CRM writeback
- default team mode
- sandbox
- broader marketplace / payout / platform widening

原因：

- 本轮目标是把 Sprint 1-4 冻结成可复用、可验证、可继续扩展的正式基线
- 不是借 baseline freeze 顺手再扩 platform scope

## 4. 哪些边界必须继续诚实保留

- recommendation 不等于 commitment
- facts 与 inferred 必须分开
- shadow 与 official 必须分开
- approved 不等于 sent
- approved 不等于 committed
- approved 不等于 official writeback
- manager attention 只是 attention，不是 final decision
- 当前系统仍不是完整 operating platform

## 5. object / memory / artifact / approval 四层当前基线是否已经清楚

已经清楚。

- object：经营对象与 shadow posture
- memory：policy / object_fact / checkpoint / handoff / scratch 分层
- artifact：worker output 统一为可追踪 artifact bundle
- approval：高风险动作继续通过 review / guard / approval matrix 控制

## 6. 第一条、第二条、第三条真实运行闭环当前基线是否已经清楚

已经清楚。

当前 canonical wording 冻结为：

1. `meeting -> structured facts -> action pack -> human confirm -> memory promotion / downstream opportunity judgement handoff`
2. `confirmed action pack -> Proposal Composer / Comms & Scheduler -> Risk Guard -> review-before-send -> draft-only handoff`
3. `confirmed meeting facts -> Opportunity Judge -> opportunity delta / next-step brief / manager attention -> human review -> shadow consume`

## 7. eval harness / guard / self-check 当前基线是否已经清楚

已经清楚。

当前已经形成：

- Sprint 2 eval
- Sprint 3 eval
- Sprint 4 eval
- self-check
- boundary guard
- quality regression

并且继续保持：

- 没有 eval 不上线
- external send 仍必须人工执行
- official CRM writeback 当前不开放

## 8. 当前版本是否已经可作为 Sprint 5 之后扩展的正式起点

可以。

前提是继续沿用这次 freeze 的 truth：

- 先扩 reviewable runtime
- 先扩 shadow / draft-only layers
- 继续把 official path 单独当成更高风险 sprint

## 9. recommendation / commitment 两条边界在 v2 当前阶段是否仍保持稳定

保持稳定。

这是这次 baseline freeze 最重要的结论之一：

- recommendation 仍不等于 commitment
- draft 仍不等于 send
- shadow 仍不等于 official
- attention 仍不等于 final decision

## 总判断

Helm v2 Baseline Freeze 1-4 已经成立。

当前 Helm v2 已经拥有一版可以复盘、可演示、可培训、可继续扩展的正式基线；但它仍然只是 review-first、shadow-first、draft-first 的 operating runtime baseline，而不是完整 operating platform 或自动执行平面。
