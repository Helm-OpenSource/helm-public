---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_V2_MEETING_CONFIRM_FLOW_REPORT

## 当前 confirm flow

本轮已经落地 `meeting-facts.confirm` human confirm flow：

- [confirm route](../../app/api/runtime/memory/meeting-facts/confirm/route.ts)
- [meeting runtime service](../../lib/helm-v2/meeting-action-pack-runtime.ts)
- [meeting runtime card](../../features/meetings/meeting-v2-runtime-card.tsx)

## 当前支持的动作

至少支持：

- `confirm`
- `edit then confirm`
- `reject`
- `keep as draft`

## confirm 的真实影响

当前 confirm flow 会真实影响：

- `ArtifactReview` 状态
- `ApprovalRequest` 状态
- `ArtifactBundle` 的 `draft / reviewed / confirmed / rejected / consumed`
- `MemoryItem` 的 promotion 姿态
- `downstream opportunity judgement handoff` 是否触发

## promotion truth

当前只会 promotion：

- human-confirmed `object_fact`
- human-confirmed `checkpoint`

当前刻意不会直接 promotion：

- inferred items
- learned pattern
- handoff memory

被 reject 的内容当前会：

- 保留 evidence / provenance
- 不进入 promotion
- 不触发 downstream opportunity judgement

## 当前结论

human confirm flow 已经成立。  
这条闭环现在不再依赖“默认相信 AI draft”，而是显式经过 human confirm 才进入 memory promotion 与 downstream opportunity judgement handoff。
