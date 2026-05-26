---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Meeting Action Pack Baseline Freeze Report

Current main note:

- 这份 freeze 文件在 `Baseline Freeze 1-9` 中继续有效
- 这份 freeze 文件在 `Baseline Freeze 1-10` 中继续有效
- Sprint 9 richer official coverage 不会改写第一条闭环的 review-first / draft-first truth
- Sprint 10 official follow-through / exception handling 也不会改写第一条闭环的 review-first / draft-first truth

## Frozen Loop

当前第一条真实运行闭环的 canonical wording 冻结为：

`meeting -> structured facts -> action pack -> human confirm -> memory promotion -> downstream shadow recommendation handoff`

System-level note:

- 如果从当前 main 的整体闭环看，meeting 这条链最终会经由 Sprint 4 进入 shadow-only update
- 但 Sprint 2 自己的 freeze 边界仍然只到 `human confirm -> memory promotion -> downstream shadow recommendation handoff`
- Sprint 4 才负责 shadow consume，本文件不把那个边界回写成 Sprint 2 自己的实现

## 已经完整成立

- `meeting-ended.ingest`
- `Meeting Analyst` runtime
- `meeting_facts.json`
- `risk_flags.json`
- `action_pack.md`
- `memory_draft.jsonl`
- human confirm flow
- draft -> confirmed -> promoted 路径

## 哪些内容进入 memory draft

当前会进入 draft memory：

- meeting-derived object facts
- draft checkpoint items
- evidence refs / provenance refs

当前不会直接 promotion：

- inferred items
- learned pattern
- handoff memory
- 任何带 commitment 风险的外部表达

## 哪些内容经 human confirm 才 promotion

只有经过 human confirm 的内容才会 promotion：

- `object_fact`
- `checkpoint`

当前 confirm 后会触发：

- `ArtifactReview` 姿态更新
- `ApprovalRequest` 姿态更新
- `MemoryItem` promotion
- downstream shadow recommendation handoff

## 哪些内容仍停在 artifact / draft

- inferred observations
- risk interpretation
- open questions
- any untrusted source summary
- 被 reject 或 keep-as-draft 的 meeting facts edits

## 哪些内容绝不形成 commitment

当前 baseline 明确保留：

- no auto-send
- no customer-facing commitment
- no official CRM writeback
- confirm 不等于 external commitment
- confirm 不等于 official writeback

## Sprint 2 与 Sprint 4 的边界

当前 freeze 继续明确：

- Sprint 2：
  - `meeting-ended.ingest`
  - Meeting Analyst runtime
  - human confirm
  - memory promotion
  - downstream shadow recommendation handoff
- Sprint 4：
  - Opportunity Judge runtime
  - opportunity review
  - shadow consume

也就是：

- Sprint 2 不直接把 action pack consume 成 shadow summary
- Sprint 4 才把 confirmed meeting facts 真正写到 shadow summary / timeline / checkpoint

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Meeting ingest | 已成立 | 更真实 transcript / connector 仍需下一层 | 不做全域 ingest bus | source quality 波动 |
| Meeting Analyst runtime | 已成立 | heuristic 仍需更多 goldens | 不扩更多 worker | 复杂会议抽取仍可能偏差 |
| Action pack artifacts | 已成立 | 更细 owner / dependency schema 仍需下一层 | 不做万能 assistant | wording 仍需持续 guard |
| Human confirm flow | 已成立 | richer editing / multi-reviewer 仍需下一层 | 不做 full review platform | review quality 仍依赖人工 |
| Memory promotion | 已成立 | richer learned / handoff promotion 仍需下一层 | 不做自动长期记忆升级 | draft truth 容易被误读 |
| Downstream shadow recommendation handoff | 已成立 | 真正 shadow consume 由 Sprint 4 冻结 | 不在 Sprint 2 直接写 official | 历史 wording 若不收紧会混淆 owner |

## 总判断

Meeting to Action Pack baseline 已经成立。  
当前这条闭环已经足够作为 Helm v2 meeting-first runtime 的稳定起点，但它仍然只是 review-first、draft-first 的第一层，不是自动执行或正式承诺路径。
