---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Eval Guard Baseline Freeze Report

## 当前冻结范围

本轮冻结：

- Sprint 2 eval harness
- Sprint 3 eval harness
- Sprint 4 eval harness
- Sprint 5 eval harness
- Sprint 6 eval harness
- Sprint 7 eval harness
- Sprint 8 eval harness
- Sprint 9 eval harness
- Sprint 10 eval harness
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- regression expectations

## 当前已冻结的 eval 维度

- meeting extraction eval
- promise safety eval
- memory relevance eval
- draft usefulness eval
- non-commitment fallback eval
- audience correctness eval
- review path consistency eval
- stage judgement correctness eval
- blocker ranking eval
- next best action usefulness eval
- manager attention usefulness eval
- shadow / official boundary eval
- evidence sufficiency eval
- execution path consistency eval
- proof write-back consistency eval
- approval / boundary consistency eval
- manual send / manual schedule acknowledgement eval
- role handoff after execution eval
- official integration guarded path eval
- write intent consistency eval
- approval matrix enforcement eval
- acknowledgment / failure capture eval
- no-auto-write safety eval
- ingestion trust classification eval
- promotion eligibility eval
- retrieval relevance eval
- stale memory suppression eval
- policy loading correctness eval
- object summary loading correctness eval
- evidence provenance completeness eval
- limited auto eligibility correctness eval
- whitelist enforcement eval
- no-broad-auto-write eval
- acknowledgment boundary eval
- manual override correctness eval
- shadow / official / proof / ack boundary eval
- richer action whitelist enforcement eval
- richer eligibility correctness eval
- acknowledgment / receipt interpretation eval
- reconciliation path correctness eval
- manual fallback correctness eval
- no-broad-auto-write safety eval
- follow-through classification eval
- exception state transition eval
- resolution write-back consistency eval
- official success vs resolution confusion eval

## 当前上线门槛

当前 baseline 明确冻结：

- 没有 eval 不上线
- A3 / A4 动作当前不开放自动执行
- external send 仍然必须人工执行
- send authority 当前不开放
- official CRM writeback 当前不开放
- default auto-write 当前不开放
- broad auto-write 当前不开放
- untrusted -> promoted 误升级事故必须为 0
- acknowledgment 错判必须为 0
- 错误承诺事故必须为 0
- 审计可追溯率必须为 100%

## self-check / boundary / regression 的当前职责

- `self-check`：确保 README / docs index / runtime code / tests / eval 脚本引用同一版 truth
- `check:boundaries`：确保 recommendation / commitment、shadow / official、draft-only / review-first、limited-auto / broad-auto-write 边界不被写松
- `quality:regression`：确保现有 presentation / protocol / decision-first 基线继续稳定

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Sprint 2 eval harness | 已成立 | goldens 仍可扩 | 不做 subjective-only launch | extraction 样本仍有限 |
| Sprint 3 eval harness | 已成立 | customer-facing wording 样本仍可扩 | 不做 auto-send gate | risky wording 仍需更多真实数据 |
| Sprint 4 eval harness | 已成立 | ambiguous stage 样本仍可扩 | 不做 official-write gate | pipeline 多线程样本仍有限 |
| Sprint 5 eval harness | 已成立 | execution proof / receipt 样本仍可扩 | 不做 send authority gate | manual proof 仍依赖用户输入 |
| Sprint 6 eval harness | 已成立 | richer connector ack / reconciliation 样本仍可扩 | 不做 default auto-write gate widening | official path wording 最容易被误读 |
| Sprint 7 eval harness | 已成立 | broader connector / retrieval goldens 仍可扩 | 不做 full-history context stuffing | richer context 容易变脏 |
| Sprint 8 eval harness | 已成立 | larger limited-auto golden set 仍可扩 | 不做 broad auto-write rollout | limited auto 天然更接近自动动作 |
| Sprint 9 eval harness | 已成立 | richer official coverage goldens 仍可扩 | 不做 broad auto-write rollout | richer official receipt 解释很容易过度乐观 |
| Sprint 10 eval harness | 已成立 | larger follow-through / exception goldens 仍可扩 | 不做 exception automation platform | resolved / success 最容易被混淆 |
| Self-check | 已成立 | future baseline checks 仍可扩 | 不做静态文档平台 | historical wording 容易漂移 |
| Boundary guard | 已成立 | future official path boundary 仍需下一层 | 不做 policy engine | 后续 scope 扩张时容易漏 marker |
| Regression expectations | 已成立 | 更强 runtime-specific regression 仍可扩 | 不做 benchmark platform | 页面变化若不补测试会回退 |

## 总判断

Eval / Guard baseline 已经成立。  
当前 Sprint 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 的 runtime 已经不是“看起来能用”，而是有独立 eval、guard 和 self-check 在持续约束它们的边界与 truth。
