---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_V2_SPRINT_2_MEETING_TO_ACTION_PACK_RUNTIME_REPORT

## 结论先行

Helm v2 Sprint 2 已经把第一条真实运行闭环跑通：

`meeting -> structured facts -> action pack -> human confirm -> memory promotion / downstream opportunity judgement handoff`

这条闭环当前已经是：

- 可落表
- 可追踪
- 可人工确认
- 可审计
- 可评测

但它仍然只是第一条 meeting-first runtime，不是全域 agent runtime，更不是自动执行平面。

## 必答问题

### 1. 最小持久化 runtime tables 是否已经成立

是。  
`RuntimeEvent / WorkerRun / ArtifactBundle / MemoryItem / ApprovalRequest / ArtifactReview` 已经落地，并由真实 Sprint 2 runtime 消费。

### 2. `meeting-ended.ingest` 是否已经是真实入口

是。  
`meeting-ended.ingest` route 和 service 都已经存在，meeting 现在可以进入真实 runtime。

### 3. `Meeting Analyst` 是否已经真实运行

是。  
它已经真实生成：

- `meeting_facts.json`
- `risk_flags.json`
- `action_pack.md`
- `memory_draft.jsonl`

### 4. `meeting-facts.confirm` human confirm flow 是否已经成立

是。  
当前支持：

- confirm
- edit then confirm
- reject
- keep as draft

### 5. shadow write path 与 artifact review execution flow 是否已经成立

是。  
confirmed facts 现在已经能驱动 downstream opportunity judgement handoff，而且 artifact 已经形成 created -> reviewed -> confirmed / rejected -> consumed 的最小 execution flow。  
真正的 `shadow consume` 当前已经明确收口到 Sprint 4 的 `Opportunity Judge review`，而不是在 Sprint 2 中直接写 summary。

### 6. 第一批 eval harness 是否已经成立

是。  
当前已经有 fixture-backed eval harness，覆盖：

- extraction
- promise safety
- memory relevance
- shadow judgment

### 7. 当前 Helm v2 是否已经跑通第一条真实运行闭环

是。  
这是当前 Sprint 2 的最重要结论。

### 8. 哪些地方刻意未做，为什么

刻意未做：

- official CRM writeback
- send authority
- workflow control
- default team mode
- sandbox
- broader marketplace / payout / platform widening

原因很直接：Sprint 2 只服务于第一条 meeting-first runtime 闭环，不扩主题。

### 9. 下一阶段最该做的 5 件事是什么

1. 把 `meeting-ended.ingest` 接到更真实的 transcript / note source ingestion policy 上。
2. 为 `Opportunity Judge` 增加更稳定的 shadow stage goldens 和 eval sample 数。
3. 把 artifact review execution flow 扩到 draft-only comms layer，但继续保持 no-send boundary。
4. 增加 checkpoint / handoff memory 的更明确 promotion rule，而不是只停在 object fact + checkpoint。
5. 为 Sprint 3 规划最小 `meeting -> followup draft` 人工确认闭环。

## Sprint 2 短表

| 领域 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Runtime tables | `RuntimeEvent / WorkerRun / ArtifactBundle / MemoryItem / ApprovalRequest / ArtifactReview` 已可承载真实 runtime | 还不是全域 v2 runtime schema | 不一次性做完所有 planned tables | 后续 worker 扩张时仍需继续补表 |
| Meeting ingest runtime | `meeting-ended.ingest` 已落地 | 与真实 transcript connector 的接线还需下一层 | 不做全场景 ingest bus | 当前主要还是 meeting-note-first |
| Meeting Analyst runtime | facts / risk / action pack / memory draft 已真实生成 | 提取质量还需要更多 goldens | 不扩更多 worker | heuristic 仍需后续继续收敛 |
| Human confirm flow | confirm / edit then confirm / reject / keep draft 已成立 | 多 reviewer / richer editing 还需下一层 | 不做 full review platform | 错误编辑仍取决于人工质量 |
| Downstream judgement handoff / shadow consume seam | confirmed facts 已能触发 downstream judgement handoff | manager attention / checkpoint richness 还可继续增强 | 不写 official CRM | 真正 shadow consume 已转由 Sprint 4 review path 承担 |
| Eval harness | 第一批 eval 已成立且可运行 | 覆盖面仍需继续加样本 | 不做全域 benchmark platform | 当前 fixture 数还不大 |
| Documentation / guard / test alignment | README / docs / self-check / boundary / tests 已同步 | 下一层还需补更多 Sprint 3 truth | 不做额外平台叙事 | 文档必须继续诚实降级 |
| Recommendation / commitment boundary | boundary note 已进入 artifact 和 UI | 更复杂的 promise scan 仍需下一层 | 不开放任何自动 commitment | 若后续扩 draft-only comms，需继续严守 |
| Official vs shadow write separation | shadow / official 已物理分层 | official gate 未来仍需更细 policy | 不开 official writeback | 后续 Sprint 若接 CRM，风险上升 |
| Runtime sandbox / team mode | 当前默认仍是 lead + isolated workers 语义 | 真 sandbox / team mode 仍需更晚阶段 | 不做 sandbox、不做 default team mode | 后续多 worker 扩张时需继续诚实表达 |

## 四类短表

### 已经完整成立

- 最小持久化 runtime tables
- `meeting-ended.ingest`
- `Meeting Analyst` runtime
- human confirm flow
- shadow-only write path
- 第一批 eval harness

### 已成形但仍需下一层

- richer shadow judgment goldens
- deeper memory retrieval policy
- more realistic transcript ingestion
- draft-only comms worker handoff

### 刻意未做

- send authority
- workflow control
- official CRM writeback
- default team mode
- sandbox
- broader marketplace / payout / platform widening

### 风险项

- heuristic 仍可能在复杂 meeting note 上出现抽取偏差
- current eval fixture 数量还不大
- team mode / sandbox 继续缺失，必须保持诚实表达

## recommendation / commitment 主线

本轮继续保持稳定：

- recommendation 不等于 commitment
- facts 与 inferred 仍然分开
- shadow 与 official 仍然分开
- action pack 没有 human confirm 就不会 promotion 或 downstream opportunity judgement handoff

## 当前收口

Sprint 2 已经把 Helm v2 从“contract foundation”推进到“第一条真实 runtime 闭环”。  
这条闭环现在已经能作为 Helm v2 后续 Sprint 的真正内核，而不只是 demo。
