---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Connector Ingestion Contract Report

## 总结

Richer connector ingestion contract 已清楚。

Sprint 7 把 meeting、calendar、crm、email、human edit、agent inference 这些输入统一收成带 trust、promotion、evidence、draft payload 的 ingestion contract。输入不再是模糊 blob。

## 当前 contract

当前最小 contract 已覆盖：

- `ingestionSourceType`
- `ingestionSourceId`
- `ingestionScope`
- `ingestionTrustLevel`
- `ingestionSensitivity`
- `ingestionNormalizationStatus`
- `ingestionPromotionEligibility`
- `ingestionObjectRefs`
- `ingestionEvidenceRef`
- `ingestionExtractedFacts`
- `ingestionDraftPayload`

当前 source type 已覆盖：

- `meeting_transcript`
- `meeting_note`
- `calendar_event`
- `crm_snapshot`
- `crm_delta`
- `email_thread`
- `document_attachment`
- `human_edit`
- `agent_inference`

## 当前 truth

- `calendar_event`、`crm_snapshot` 默认是更高可信的 connector posture。
- `meeting_transcript`、`email_thread`、`document_attachment` 默认不能直接进入长期正式记忆。
- `human_edit` 是最强的非 CRM promotion candidate，但仍保留边界和 evidence。
- `agent_inference` 永远不能直接替代 fact。

## 已经完整成立

- richer connector ingestion contract
- source type 显式分类
- evidence ref 和 object refs 显式挂接
- draft payload 与 extracted facts 分层

## 已成形但仍需下一层

- 更广的 connector breadth
- 更细的 attachment normalization
- richer source diff / delta lineage

## 刻意未做

- 全量原始数据直接进模型
- 完整 connector platform
- 无边界 promotion

## 风险项

- richer source 变多后，classification 漂移风险会上升
- 若后续不持续做 eval，source contract 很容易重新退化成 blob
