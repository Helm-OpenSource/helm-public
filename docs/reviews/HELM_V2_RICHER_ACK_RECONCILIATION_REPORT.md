---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Richer Ack Reconciliation Report

## 结论

Sprint 9 已把 official integration 的 acknowledgment / receipt / reconciliation handling 再长厚一层。

当前已支持的 receipt / reconciliation posture：

- `acknowledged_success`
- `acknowledged_failure`
- `timeout_unknown`
- `partial_success`
- `stale_receipt`
- `manual_reconciliation_required`
- `manual_reconciliation_resolved`
- `retry_skipped`

## 当前规则

- 只有 `acknowledged_success` 才算 official write success
- `failure / timeout / unknown / stale / partial` 都必须留痕
- `stale_receipt` 当前走 `audit_only`
- `partial_success` / `timeout_unknown` 当前只允许带 reconciliation note 更新 summary
- `proof`、`ack`、`receipt`、`reconciliation` 不是同一件事

## richer handling

当前 runtime 已能区分：

- 哪些 external receipt 可直接算 success
- 哪些 receipt 仍需人工确认
- 哪些状态需要 escalation
- 哪些状态只能写 audit，不更新 managed official summary
- 哪些状态可以更新 summary，但必须带 reconciliation note

## 边界

- 外部系统未确认时，summary 不能写成“已经成功”
- stale receipt 不能被当成 success
- manual reconciliation resolved 只表示 ambiguity 被人工收口，不代表 broad auto-write 合法化
