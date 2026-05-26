---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Draft-only Comms Baseline Freeze Report

Current main note:

- 这份 freeze 文件在 `Baseline Freeze 1-9` 中继续有效
- 这份 freeze 文件在 `Baseline Freeze 1-10` 中继续有效
- richer official coverage 只消费 approved execution proof / guarded write intent，不会把 draft-only comms 改写成 auto-send 或 auto-book
- Sprint 10 official follow-through 也不会把 draft-only comms 改写成 external outcome success

## Frozen Loop

当前第二条真实运行闭环的 canonical wording 冻结为：

`confirmed action pack -> Proposal Composer / Comms & Scheduler -> Risk Guard -> review-before-send -> draft-only handoff`

## 已经完整成立

- Proposal Composer runtime
- Comms & Scheduler runtime
- draft-only comms artifact bundle
- Risk & Promise Guard
- review-before-send surface

## 当前冻结的 artifact

- `customer_followup_draft.md`
- `internal_collab_brief.md`
- `exec_brief.md`
- `email_draft.eml`
- `calendar_options.json`
- `message_variants.md`

## approved 代表什么

当前 `approved` 只代表：

- 允许进入下一步人工动作
- 允许被下一个 internal handoff surface 消费
- 允许在 boundary note 保留的前提下继续人工编辑
- 允许进入 Sprint 5 的 manual execution surface

## approved 不代表什么

当前 `approved` 明确不代表：

- approved 不等于 executed
- approved 不等于 sent / booked / committed / official writeback
- customer-facing final commitment

## review-before-send 边界

当前 freeze 继续明确：

- 所有 customer-facing draft 都先过 Risk Guard
- guard 不能被跳过
- boundary block / insufficient evidence / fallback wording 都是合法 posture
- approval 仍然只是 human review 通过，不是自动外发授权

## non-commitment fallback 边界

当前如果 wording 带有 commitment 风险，系统只能：

- fallback 到 non-commitment wording
- 增加 prerequisite note
- 增加 dependency note
- 增加 boundary note
- 或直接 block

## no auto-send / no auto-book 的边界

当前 freeze 继续明确：

- no auto-send
- no auto-book
- approved 只表示允许进入人工下一步
- approved 仍不等于 executed，更不等于 external outcome confirmed

## 与 Sprint 5 / Sprint 6 / Sprint 8 的关系

当前 freeze 继续明确：

- Sprint 5 会把 approved draft 翻成 manual execution surface
- Sprint 6 会在 approved execution proof 之后生成 guarded official write intent
- Sprint 8 的 limited auto 也不会反过来把 draft comms 变成 auto-send 或 auto-book
- Sprint 10 的 resolution / follow-through 只发生在 official outcome 之后，不会把 approved draft 回写成 sent / booked / official success

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Proposal Composer runtime | 已成立 | 更细 audience policy 仍需下一层 | 不做 messaging platform | audience 漂移风险 |
| Comms & Scheduler runtime | 已成立 | 更真实 calendar / mailbox context 仍需下一层 | 不做 auto-send / auto-booking | 真实 connector 接入后复杂度会上升 |
| Draft-only comms bundle | 已成立 | 更细 artifact rendering 仍需下一层 | 不做页面临时拼结构 | bundle schema 漂移 |
| Risk & Promise Guard | 已成立 | 更细 risk taxonomy 仍需下一层 | 不做可跳过 guard | 边界 wording 仍需长期压测 |
| Review-before-send surface | 已成立 | 更强的 ergonomics 仍需下一层 | 不做 send authority | 用户可能误读 approved |
| Sprint 5 manual execution handoff | 已成立，可进入人工执行面 | 更细 role / connector proof 仍需下一层 | 不做 auto-send / auto-book | approved / executed 易被混淆 |
| Non-commitment fallback | 已成立 | 更强 fallback templates 仍需下一层 | 不做自动承诺 | risky wording 漂移 |

## 总判断

Draft-only Comms baseline 已经成立。  
当前这条闭环已经足够作为 Helm v2 的第二条真实运行闭环继续扩展，但仍必须继续被表达为 draft-only、review-before-send，而不是 messaging platform、send authority 或 default auto-booking path。
