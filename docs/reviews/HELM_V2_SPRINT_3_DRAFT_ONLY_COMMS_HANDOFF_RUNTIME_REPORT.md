---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_V2_SPRINT_3_DRAFT_ONLY_COMMS_HANDOFF_RUNTIME_REPORT

## 结论先行

Helm v2 Sprint 3 已经把第二条真实运行闭环跑通：

`confirmed action pack -> draft-only comms handoff -> risk guard -> review-before-send surface`

这条闭环当前已经是：

- 可运行
- 可审查
- 可回退到 non-commitment wording
- 可阻断
- 可评测

但它仍然只是 draft-only 行动层，不是 send authority，不是 workflow control，也不是 official CRM automation。

## 必答问题

### 1. Proposal Composer 是否已经真实运行

是。  
当前已经真实生成：

- `customer_followup_draft.md`
- `internal_collab_brief.md`
- `exec_brief.md`

### 2. Comms & Scheduler 是否已经真实运行

是。  
当前已经真实生成：

- `email_draft.eml`
- `calendar_options.json`
- `message_variants.md`

### 3. draft-only comms artifact bundle 是否已经成立

是。  
当前已经有统一的 `draft_comms_bundle.json`，并且 review / handoff / trace 都复用同一套结构。

### 4. Risk & Promise Guard 是否已经真实进入草稿闭环

是。  
所有 customer-facing draft 现在都会先经过 Guard，再进入 review-before-send。

### 5. review-before-send surface 是否已经成立

是。  
meeting detail 现在已经能：

- review draft
- edit then approve
- reject
- keep as draft
- block by boundary
- fallback to non-commitment wording

### 6. 第二批 eval harness 是否已经成立

是。  
当前已经有 fixture-backed Sprint 3 eval harness，覆盖：

- draft usefulness eval
- promise safety eval
- non-commitment fallback eval
- audience correctness eval
- review path consistency eval

### 7. 当前 Helm v2 是否已经跑通第二条真实运行闭环

是。  
这是 Sprint 3 的核心结论。

### 8. 哪些地方刻意未做，为什么

刻意未做：

- auto email send
- auto calendar booking
- official CRM writeback
- send authority
- workflow control
- sandbox
- default team mode

原因很直接：Sprint 3 只服务于 `action pack -> draft-only comms` 这条闭环，不扩主题。

### 9. 下一阶段最该做的 5 件事是什么

1. 把 draft-only comms handoff 接到更真实的 mailbox / calendar connector context 上，但继续保持 no-send。
2. 为 Risk & Promise Guard 增加更强的 pricing / contract / delivery-date goldens。
3. 把 review-before-send 的结果更稳定地接到 handoff / checkpoint memory，而不是只停在 artifact posture。
4. 规划 Sprint 4 的 handoff / delivery pack runtime，把成交前后的交接包也收进 artifact-first worker 流。
5. 增加更细的 audience/tone correctness eval，减少 customer / internal / exec wording 漂移。

## Sprint 3 短表

| 领域 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Proposal Composer runtime | 三类表达物已经真实生成 | tone / style richness 仍需下一层 | 不扩更多 worker | 更多真实样本仍需补 |
| Comms & Scheduler runtime | email draft / calendar options / message variants 已成立 | connector-aware context 仍需下一层 | 不开 auto-send / auto-book | 后续一旦接 connector，风险会升高 |
| Draft-only comms artifact bundle | bundle 已统一且可复用 | handoff / archive richness 仍可继续增强 | 不做 messaging platform | 若页面绕开 bundle 临时拼装，会重新变脏 |
| Risk & Promise Guard runtime | Guard 已真实进入闭环 | 更强的 policy-specific rules 仍需下一层 | 不允许跳过 Guard | wording 复杂度上升时仍需更多 goldens |
| Review-before-send surface | 最小真实审查面已成立 | richer reviewer collaboration 仍需下一层 | 不做 full review platform | 编辑质量仍取决于人工 |
| Eval harness | 第二批 eval 已可运行 | fixture 数和覆盖面仍要扩 | 不做全域 benchmark 平台 | case 数量当前还不大 |
| Documentation / guard / test alignment | README / docs / self-check / boundary / tests 已同步 | 后续 Sprint 4 还要继续补齐 | 不额外扩平台叙事 | 文档必须继续诚实降级 |
| Recommendation / commitment boundary | non-commitment fallback 和 boundary block 已成立 | 更细粒度 guard 仍需下一层 | 不开放任何 auto-commit | 后续 draft wording 更复杂时风险会上升 |
| Official vs draft separation | draft / review / official 仍然分层 | official gate 未来还需更细 | 不开 official writeback | 后续接 CRM 时需要继续守住 |
| Runtime sandbox / team mode | 默认仍不是 team mode，也没有 sandbox | 后续如要更复杂协作需另开 Sprint | 不做 sandbox、不做 default team mode | 多 worker 扩张时需继续诚实表达 |

## 四类短表

### 已经完整成立

- Proposal Composer runtime
- Comms & Scheduler runtime
- draft-only comms artifact bundle
- Risk & Promise Guard on draft artifacts
- review-before-send surface
- 第二批 eval harness

### 已成形但仍需下一层

- connector-aware mailbox / calendar context
- richer audience / tone control
- 更强的 policy-specific promise guard
- 更深的 handoff / checkpoint integration

### 刻意未做

- auto email send
- auto calendar booking
- official CRM writeback
- send authority
- workflow control
- sandbox
- default team mode

### 风险项

- 当前 heuristic wording 仍需更多真实样本压测
- Sprint 3 eval fixture 数量还不大
- 一旦后续接真实 mailbox / calendar context，promise / privacy 风险会明显上升

## recommendation / commitment 边界

Sprint 3 继续保持：

- recommendation 不等于 commitment
- approved 不等于 sent
- approved 不代表 official CRM 已写回
- Risk Guard 先于 customer-facing handoff
- fallback_non_commitment 是显式路径，不是文档口头约束
