---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Retrieval Policy Runtime Report

## 总结

retrieval policy runtime 已成立。

Sprint 7 把 retrieval 从“隐含 prompt 习惯”收成显式 runtime policy，并继续服务当前五条闭环，而不是另起新的检索系统。

## 当前四档

当前 retrieval policy 已显式支持：

- `always_on`
- `stage_triggered`
- `event_triggered`
- `on_demand`

## 当前 buckets

当前 retrieval buckets 已覆盖：

- policy memory
- object memory
- learned memory
- handoff / checkpoint memory
- session scratch

## 当前触发

- `meeting.ended`：加载当前 workspace / meeting / opportunity summary，加 meeting policy 和记忆触发项
- `proposal.requested`：加载 Proposal Composer / Comms 所需的 policy、object 和记忆触发项
- `handoff.requested`：加载 handoff / checkpoint 相关记忆
- `official write intent`：加载 approval / official-write stage policy 和记忆触发项

## 当前 truth

- retrieval policy 仍是 selective and auditable。
- Helm 不会把所有历史都塞进 context。
- stale memory 会被 suppress，不会因为“内容多”就默认加载。
- on-demand 历史内容仍然保留，但不会被偷偷带入当前 runtime。

## 已经完整成立

- retrieval policy runtime
- per-runtime retrieval plan
- stage / event / on-demand 分层

## 已成形但仍需下一层

- richer learned-memory policy
- broader connector-backed retrieval breadth
- more nuanced invalidation

## 刻意未做

- full-history context stuffing
- opaque retrieval magic
- default team-mode retrieval fan-out

## 风险项

- event catalog 继续扩时，触发规则会更复杂
- learned pattern 若不小心越权，会污染当前 retrieval truth
