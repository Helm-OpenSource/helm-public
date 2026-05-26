---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Sprint 7 Richer Connector Ingestion Retrieval Policy Report

## 总结

Sprint 7 把 Helm v2 的输入质量和检索质量推进到下一层。

这一轮不是新增高风险执行，而是把 richer connector ingestion、trust / promotion boundary、retrieval policy、loading strategy、trace surface 和第六批 eval 收成一版更真实、更稳、更可审计的输入基础层。

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Richer connector ingestion contract | source / trust / promotion / evidence contract 已统一 | broader connector coverage 仍需下一层 | 不做 connector platform | source taxonomy 会继续变复杂 |
| Trust / promotion boundary | trusted / untrusted / draft-only / human_confirmed / system_of_record 已落地 | repeated-pattern policy 仍需下一层 | 不做 untrusted 自动 promotion | promotion 规则若放松会直接污染长期记忆 |
| Retrieval policy runtime | always_on / stage_triggered / event_triggered / on_demand 已成立 | deeper invalidation / learned retrieval 仍需下一层 | 不做全历史上下文塞入 | retrieval 复杂度会继续上升 |
| Memory / policy / object loading | loading order、priority、conflict rules 已成立 | richer object-type policy 仍需下一层 | 不做 scratch 自动 promotion | stale 与 freshness 判断仍需更多样本 |
| Ingestion / retrieval trace surface | meeting detail trace 已成立 | richer drill-down 仍需下一层 | 不做 observability platform | trace 复杂度会上升 |
| Eval harness | 第六批 harness 已成立 | larger golden pools 仍需下一层 | 不做 no-eval rollout | fixture 规模仍有限 |
| Documentation / guard / test alignment | README / docs / self-check / boundary / tests 已对齐 | future baseline freeze 1-7 仍需下一层 | 不做 doc overclaim | wording 漂移会破坏 current-main truth |
| Recommendation / commitment boundary | richer context 没有打破主线 | 更细 commitment taxonomy 仍需下一层 | 不做 automatic commitment | richer context 容易诱发“更像承诺”的 wording |
| Shadow / official / proof separation | 仍稳定保留 | richer connector-backed outcome mapping 仍需下一层 | 不开 default auto-write | 真实 official connector 增长后边界压力会升高 |
| Runtime sandbox / team mode | 当前仍未打开 | future scoped sandbox 仍需下一层 | 不做 default team mode | worker 数量增长后协调复杂度会上升 |

## 逐条回答

### 1. richer connector ingestion contract 是否已经清楚

已经清楚。

当前 contract 已覆盖 source type、trust level、promotion eligibility、object refs、evidence refs、extracted facts 和 draft payload。

### 2. trusted / untrusted / draft promotion 边界是否已经成立

已经成立。

当前 untrusted 输入不能直接 promotion；`human_confirmed` 和 `system_of_record` 是两条显式 promotion path；`repeated_pattern_candidate` 仍然保留为 deferred。

### 3. retrieval policy runtime 是否已经成立

已经成立。

当前 retrieval policy 已显式区分：

- `always_on`
- `stage_triggered`
- `event_triggered`
- `on_demand`

### 4. memory / policy / object loading 策略是否已经成立

已经成立。

当前已把 loading order、priority 和 conflict rules 收成 current-main helper，而不是散在 prompt 习惯里。

### 5. ingestion / retrieval trace surface 是否已经成立

已经成立。

当前 meeting detail 已有真实 trace surface，能解释当前 runtime 拉了哪些 memory、来自哪些 source、哪些被跳过或 stale-suppress。

### 6. 第六批 eval harness 是否已经成立

已经成立。

当前覆盖：

- ingestion trust classification eval
- promotion eligibility eval
- retrieval relevance eval
- stale memory suppression eval
- policy loading correctness eval
- object summary loading correctness eval
- evidence provenance completeness eval

### 7. 当前 Helm v2 是否已经把输入质量和检索质量推进到下一层

已经推进到下一层。

但这层推进仍然是：

- selective
- reviewable
- explainable
- audit-friendly

而不是“更多数据自动进入更大上下文”。

### 8. 哪些地方刻意未做，为什么

刻意未做：

- 全量原始数据直接进模型
- 把所有历史塞进上下文
- connector platform
- send authority
- auto booking
- default auto-write
- default team mode

原因很明确：Sprint 7 只负责把 richer ingestion 和 retrieval policy 做成支撑 Sprint 1-6 闭环的下一层基础能力，而不是顺手扩成更大的执行平面。

### 9. 下一阶段最该做的 5 件事是什么

1. richer live connector breadth，把更多真实 meeting / email / document connector 输入纳入当前 contract，但继续保持 trust / promotion gate。
2. deeper retrieval invalidation policy，把 stale / freshness / supersedes 规则再收紧一层。
3. learned memory candidate review path，把 repeated pattern candidate 做成 reviewable candidate，而不是自动 promotion。
4. more worker runtime coverage，让 handoff / delivery / role handoff 等后续 runtime 直接复用 Sprint 7 的 retrieval policy。
5. Baseline Freeze 1-7，把 Sprint 7 current-main truth 正式收进下一版 baseline。

## 当前结论

已经完整成立：

- richer connector ingestion contract
- trust / promotion boundary
- retrieval policy runtime
- memory / policy / object loading strategy
- ingestion / retrieval trace surface
- 第六批 eval harness

已成形但仍需下一层：

- broader connector coverage
- deeper retrieval invalidation
- larger Sprint 7 golden sets

刻意未做：

- connector platform
- full-history context stuffing
- send authority
- default auto-write
- default team mode

风险项：

- source taxonomy 和 retrieval policy 会继续变复杂
- stale suppression 与 freshness 判断还需要更多真实样本
- richer context 容易让 wording 更接近 commitment，必须继续保持 boundary-first
