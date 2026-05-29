---
status: archived
owner: helm-core
created: 2026-05-26
review_after: 2026-11-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-29
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Feishu Bitable Read-only Ingest Report

更新日期：2026-05-21

## 变更摘要

本轮把飞书从 OAuth callback foundation 再推进一层，新增：

- `lib/connectors/feishu-ingestion.ts`
- `syncFeishuConnectorAction()`
- `/api/connectors/feishu/sync-now`
- settings 中的飞书 ingest readout / action
- Feishu read-only ingest audit labels / governance action coverage

同时补齐：

- `FEISHU_BITABLE_APP_TOKEN`
- `FEISHU_BITABLE_TABLE_ID`
- `FEISHU_BITABLE_VIEW_ID`
- `FEISHU_BITABLE_PAGE_SIZE`
- `FEISHU_BITABLE_MAX_PAGES`

## 已经完整成立

- 飞书 OAuth callback foundation
- 飞书 public auth
- 飞书 env-backed Bitable read-only ingest 最小运行时链路

## 已成形但仍需下一层

- workspace-managed Bitable binding UI / registry
- richer object linking
- message draft(review-first)

## 刻意未做

- send / write-back
- auto-send
- auto execution authority
- 完整 connector control plane

## 风险项

- env-backed 绑定仍不适合直接当作多 workspace 通用控制面
- 真实租户上的权限配置仍可能导致 partial / failed posture
- 当前 records 进入的是 review-first runtime artifacts，不等于 canonical business object promotion

## recommendation / commitment 边界

- recommendation != commitment
- explanation 不等于承诺
- proposal 不等于自动执行
- 当前飞书接入没有打开客户可见发送、CRM 写回、审批写回或自动承诺
