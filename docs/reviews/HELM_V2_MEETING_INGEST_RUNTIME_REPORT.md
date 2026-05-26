---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_V2_MEETING_INGEST_RUNTIME_REPORT

## 已落地入口

本轮已经落地真实 ingest 入口：

- [meeting-ended route](../../app/api/runtime/events/meeting-ended/route.ts)
- [meeting ingest/runtime service](../../lib/helm-v2/meeting-action-pack-runtime.ts)

对应 contract key：

- `meeting-ended.ingest`

## 入口行为

`meeting-ended.ingest` 当前至少会完成：

1. 读取 meeting / meeting note
2. 读取 workspace / calendar / company / opportunity 最小上下文
3. 创建 `RuntimeEvent`
4. 创建 `WorkerRun`
5. 触发 `Meeting Analyst`
6. 记录 artifact bundle、approval request、artifact review
7. 写入审计与 usage ledger

## trusted / untrusted truth

当前 ingest 已明确分层：

- trusted
  - workspace summary
  - calendar-backed meeting metadata
  - current linked company / opportunity refs
- untrusted
  - freeform meeting note
  - freeform transcript / summary text

这些 untrusted 输入当前只进入：

- `draft artifact`
- `draft memory`

不会在 ingest 时直接 promotion 成长期正式记忆。

## 当前结论

`meeting.ended` 已经不再只是 planned event。  
它已经能通过真实入口进入 Helm v2 runtime，并留下可追踪、可调试、可审计的 ingest trace。

## 刻意未做

- 不自动外发
- 不自动形成 commitment
- 不直接写 official CRM state
- 不扩成“万能聊天入口”
