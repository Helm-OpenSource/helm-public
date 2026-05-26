---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Opportunity Judge Baseline Freeze Report

Current main note:

- 这份 freeze 文件在 `Baseline Freeze 1-9` 中继续有效
- 这份 freeze 文件在 `Baseline Freeze 1-10` 中继续有效
- Sprint 9 richer official coverage 只会消费 approved guarded write intent，不会把 Sprint 4 的 shadow consume 改写成 official writeback
- Sprint 10 follow-through / exception handling 也不会把 Sprint 4 的 shadow consume 改写成 official success

## Frozen Loop

当前第三条真实运行闭环的 canonical wording 冻结为：

`confirmed meeting facts -> Opportunity Judge -> opportunity delta / next-step brief / manager attention -> human review -> shadow consume`

## 已经完整成立

- Opportunity Judge runtime
- `opportunity_delta.json`
- `next_step_brief.md`
- `manager_attention_flags.json`
- opportunity judgement review surface
- shadow consume path

## Artifact 结构当前基线

当前 judgement artifact 结构已经冻结：

- stage shadow delta
- probability delta
- blockers
- risk flags
- decision criteria
- champion posture
- next best action
- manager attention required
- evidence refs
- confidence
- open questions
- boundary notes

## confirm 进入 shadow summary / timeline / checkpoint memory 的边界

当前 `confirm` 只表示：

- 允许把 judgement consume 到 shadow summary
- 允许把 checkpoint / audit trace 补进系统
- 允许把 next-step summary 作为 shadow summary 消费

当前 `confirm` 不表示：

- official CRM writeback
- final manager decision
- customer-facing commitment
- manual CRM step 已经自动完成

## 哪些内容仍不能写 official CRM

- `stage`
- `risk`
- `next action`
- pricing / contract / delivery commitment
- any external system-of-record field

## 与 Sprint 5 / Sprint 6 / Sprint 8 / Sprint 9 的边界

当前 freeze 继续明确：

- Sprint 5 的 `manual_crm_step` 是人工执行建议，不是 official 更新
- Sprint 6 的 guarded official write intent 是下一层，不属于 Sprint 4 的 shadow consume
- Sprint 8 的 limited auto 建立了 narrow official branch
- 历史口径里，limited auto 白名单不覆盖高风险 official write；这条 truth 现在仍然保留在：
  - `crm.update_official_stage`
  - `crm.update_blockers`
  - `crm.attach_handoff_summary`
  - `crm.update_stage_shadow_mirror`
- Sprint 9 richer official coverage 现在允许 `crm.update_next_action` 在 approved guarded write intent 之后进入 narrow executable whitelist
- 但 limited auto 仍然不覆盖：
  - `crm.update_official_stage`
  - `crm.update_blockers`
  - `crm.attach_handoff_summary`
  - `crm.update_stage_shadow_mirror`

也就是：

- shadow consume 与 official write 继续物理分层
- manager attention 只是 attention，不是 final decision

## manager attention 的当前 truth

`manager attention` 当前只是 attention，不是 final decision。  
它的作用是让 manager / owner 知道哪里值得介入，不是自动形成拍板结果。

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Opportunity Judge runtime | 已成立 | 更深 CRM / pipeline context 仍需下一层 | 不做 CRM engine | 复杂 multi-thread 仍需更多样本 |
| Opportunity delta artifact | 已成立 | 更细 probability / champion modelling 仍需下一层 | 不做完整 pipeline engine | judgement heuristic 仍需压测 |
| Manager attention / next-step brief | 已成立 | 更细 escalation policy 仍需下一层 | 不做 auto-decision | 高噪声机会仍可能误报 |
| Review surface | 已成立 | 更强 review ergonomics 仍需下一层 | 不做 second app tree | operator friction 仍可继续优化 |
| Shadow consume path | 已成立 | 更细 summary / checkpoint routing 仍需下一层 | 不做 official writeback | shadow summary 质量依赖 review discipline |
| Sprint 5 manual CRM-step handoff | 已成立，可进入人工执行 contract | richer connector-backed receipts 仍需下一层 | 不做 official writeback | confirmed / executed / official 容易混淆 |
| Shadow / official separation | 已成立，并已通过 Sprint 6 进入 guarded official write intent | richer official acknowledgment mapping 仍需下一层 | 不开 broad auto-write | 未来若急着扩 official path，风险会升高 |

## 总判断

Opportunity Judge baseline 已经成立。  
当前这条闭环已经足够作为 Helm v2 judgement layer 的正式起点，但仍必须继续诚实表达为 shadow-only、review-first、non-committing。
