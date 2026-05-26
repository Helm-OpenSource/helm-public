---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Baseline Freeze 1-10 Report

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Foundation contracts | object / memory / artifact / approval 四层已冻结 | richer connector-backed reconciliation 仍需下一层 | 不做完整 operating platform | planned API 易被误读成已全部实现 |
| Runtime tables | 最小集已成立，并已覆盖 OfficialFollowThrough / RetrievalTrace / LimitedAutoIntent | richer object-native tables 仍需下一层 | 不做 broader runtime platform | richer connector receipts 仍需补表 |
| Meeting to Action Pack runtime | 已冻结 | 更真实 transcript / connector ingestion 仍需下一层 | 不做 auto-commit / auto-send | source quality 和 extraction 仍需压测 |
| Draft-only Comms runtime | 已冻结 | 更真实 calendar / mailbox context 仍需下一层 | 不做 send authority / auto-book | approved 被误读成 sent 的风险 |
| Opportunity Judge runtime | 已冻结 | 更深 CRM / pipeline context 仍需下一层 | 不做 official CRM writeback | judgement heuristic 仍需更多样本 |
| Human Action Execution runtime | 已冻结 | richer connector-backed proof / receipt 仍需下一层 | 不做 auto execution | proof 真实性仍依赖人工输入 |
| Official System Integration guarded path | 已冻结 | live connector-backed acknowledgment / reconciliation 仍需下一层 | 不做 default auto-write | official wording 最容易被误读 |
| Official System Integration limited auto path | 已冻结 | broader executable whitelist 仍需下一层 | 不做 broad auto-write | limited auto 天然更接近自动动作 |
| Official Coverage Follow-through & Exception Handling | follow-through contract、状态机、resolution write-back 已冻结 | richer SLA / assignment / analytics 仍需下一层 | 不做 ticketing / workflow platform | resolved / success 最容易被混淆 |
| Eval harness / self-check / boundary guard | 已冻结 | future baseline checks 仍可扩 | 不做 benchmark platform | historical wording 漂移会破坏一致性 |
| Recommendation / commitment boundary | 当前仍稳定 | 更细 commitment taxonomy 仍需下一层 | 不做 automatic commitment | customer-facing wording 漂移 |
| Shadow / official / approved / executed / proof / ack / exception / resolution separation | 当前仍稳定 | richer per-adapter reconciliation mapping 仍需下一层 | 不开 broad auto-write | 一旦接真实 adapter，边界压力会迅速上升 |
| Runtime sandbox / team mode | 当前仍未打开 | future complex tasks 可再评估 | 不做 sandbox，不做 default team mode | scope 扩张时容易误开 |

## 1. 当前版本哪些 Helm v2 foundation 能力已经完整成立

- object graph contracts
- layered memory contracts
- artifact-first worker registry
- action-level approval matrix
- primary event flow contract
- planned API / data model baseline
- 最小 runtime tables
- Sprint 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 的 current-main runtime truth
- Sprint 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 eval harness
- self-check / boundary guard / regression expectations

## 2. 哪些能力已成形但仍需下一层

- live connector-backed ingestion breadth and receipts
- live adapter receipt / reconciliation mapping
- broader richer official action coverage beyond current narrow whitelist
- larger golden case pools across Sprint 2-10
- deeper retrieval / promotion / invalidation policy
- more object-native handoff / timeline / checkpoint routing
- richer official payload diff / compare surfaces
- richer follow-through assignment / SLA / escalation analytics

## 3. 哪些地方刻意未做，为什么

刻意未做：

- send authority
- auto email send
- auto calendar booking
- broad auto-write
- workflow control
- default team mode
- sandbox
- broader marketplace / payout / platform widening
- ticketing platform

原因：

- 本轮目标是把 Sprint 1-10 冻结成可复用、可验证、可继续扩展的正式基线
- 不是借 baseline freeze 顺手打开更高风险的 broad auto-write、send authority 或 exception automation platform

## 4. 哪些边界必须继续诚实保留

- recommendation 不等于 commitment
- facts 与 inferred 必须分开
- shadow 与 official 必须分开
- approved 不等于 executed
- approved 不等于 sent / booked / committed / official writeback
- executed 不等于 external outcome confirmed
- proof 不等于 official system success
- acknowledgment success 才可代表 official write 成功
- limited auto 只对白名单 action type 生效
- `Force manual path` 始终保留
- resolved 不自动等于 official success
- 当前系统仍不是完整 operating platform

## 5. object / memory / artifact / approval 四层当前基线是否已经清楚

已经清楚。

- object：经营对象、shadow posture、summary、checkpoint / handoff attachment
- memory：policy / object_fact / checkpoint / handoff / scratch 分层，并带 trust / promotion / retrieval posture
- artifact：worker output 统一为可追踪 artifact bundle
- approval：高风险动作继续通过 review / guard / approval matrix 控制

## 6. 七条真实运行闭环当前基线是否已经清楚

已经清楚。

当前 canonical wording 冻结为：

1. `meeting -> structured facts -> action pack -> human confirm -> memory promotion -> downstream shadow recommendation handoff`
2. `confirmed action pack -> Proposal Composer / Comms & Scheduler -> Risk Guard -> review-before-send -> draft-only handoff`
3. `confirmed meeting facts -> Opportunity Judge -> opportunity delta / next-step brief / manager attention -> human review -> shadow consume`
4. `approved draft / approved shadow recommendation -> manual execution -> proof -> write-back`
5. `approved shadow recommendation / approved execution proof -> official write intent -> explicit human approval -> guarded official write attempt -> acknowledgment / failure capture -> audit / summary write-back`
6. `approved guarded write intent -> limited auto eligibility -> explicit approval -> constrained official write execution -> strong acknowledgment -> audit / summary write-back`
7. `official write outcome -> follow-through -> exception handling -> reconciliation resolution -> summary / memory / handoff update`

补充说明：

- Sprint 9 没有新增第七条闭环；Sprint 10 才把 official outcome 后的 follow-through / exception handling 收成新闭环
- Sprint 9 richer official coverage 是在第 5 / 6 条 official path 上，把 action taxonomy、eligibility、receipt / reconciliation、manual fallback 与 review / override 再推进一层

## 7. eval harness / self-check / boundary guard 当前基线是否已经清楚

已经清楚。

当前已经形成：

- Sprint 2 eval
- Sprint 3 eval
- Sprint 4 eval
- Sprint 5 eval
- Sprint 6 eval
- Sprint 7 eval
- Sprint 8 eval
- Sprint 9 eval
- Sprint 10 eval
- self-check
- boundary guard
- quality regression

并且继续保持：

- 没有 eval 不上线
- external send 仍必须人工执行
- send authority 当前不开放
- broad auto-write 当前不开放
- official follow-through / exception handling 仍然只在 audited、manual-fallback-first 的路径上推进

## 8. 当前版本是否已经可作为 Sprint 11 之后扩展的正式起点

可以。

前提是继续沿用这次 freeze 的 truth：

- 先扩 reviewable runtime
- 先扩 live connector-backed receipt / reconciliation / follow-through layers
- 继续把 official path 单独当成更高风险 sprint
- 继续把 limited auto 和 richer official coverage 保持成极窄白名单，而不是顺手放大成 broad auto-write
- 继续把 resolution 和 official success 严格分层

## 9. recommendation / commitment 两条边界在 v2 当前阶段是否仍保持稳定

保持稳定。

这是这次 baseline freeze 最重要的结论之一：

- recommendation 仍不等于 commitment
- draft 仍不等于 send
- approved 仍不等于 executed
- executed 仍不等于 external outcome confirmed
- proof 仍不等于 official system success
- acknowledgment success 才可代表 official write 成功
- limited auto 仍不等于 broad auto-write
- resolution 仍不等于 official success
- shadow 仍不等于 official

## 总判断

Helm v2 Baseline Freeze 1-10 已经成立。

当前 Helm v2 已经拥有一版可以复盘、可演示、可培训、可继续扩展的正式基线；但它仍然只是 review-first、shadow-first、draft-first、manual-execution-first、guarded-official-integration-first、limited-auto-narrow-first、richer-official-coverage-narrow-first、followthrough-audited-first 的 operating runtime baseline，而不是完整 operating platform 或 broad auto-write plane。
