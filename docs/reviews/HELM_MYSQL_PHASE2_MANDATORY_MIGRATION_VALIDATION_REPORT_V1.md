---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM MySQL Phase 2（强制项）迁移校验报告 V1

## 1. 目标与范围

本报告覆盖本轮 Mandatory-only 执行：

1. 在 `helm2026_ci_verify` 全量演练 `export -> build-schema -> migrate-data -> apply-comments -> cutover -> mandatory-check -> reconcile`
2. 在 `helm2026` 使用同一套命令执行切换与校验
3. 产出可审计对账与规范检查结果

本轮不覆盖推荐项与 SQL 编码规范整改。

## 2. 执行环境

- 验证库：`helm2026_ci_verify`
- 正式库：`helm2026`
- 迁移脚本目录：`sql/phase2/ddl`、`sql/phase2/dml`
- 报告目录：`.tmp/mysql-phase2-mandatory/latest/reports`
- 执行日期：2026-04-16

## 3. 实际执行步骤与结果

### 3.1 验证库 `helm2026_ci_verify`

1. `npm run db:phase2:export`：通过
2. `npm run db:phase2:build-schema`：通过
3. `npm run db:phase2:migrate-data`：通过
4. `npm run db:phase2:apply-comments`：通过
5. `npm run db:phase2:cutover`：通过
6. `npm run db:spec:mandatory-check`：通过（`overallPass=true`）
7. `npm run db:phase2:reconcile`：通过
8. `npm run db:prepare`（连续两次）：通过（验证幂等）

### 3.2 正式库 `helm2026`

1. `npm run db:phase2:export`：通过
2. `npm run db:phase2:build-schema`：通过
3. `npm run db:phase2:migrate-data`：通过
4. `npm run db:phase2:apply-comments`：通过
5. `npm run db:phase2:cutover`：通过
6. `npm run db:spec:mandatory-check`：通过（`overallPass=true`）
7. `npm run db:phase2:reconcile`：通过
8. `npm run db:prepare`：通过（无待执行 migration）

## 4. 数据一致性验证

- 全表行数对账：通过（`mismatchCount = 0`）
- 关键链路抽样：通过
  - `workspace/membership/billing`：`orphanCount = 0`
  - `meeting/action/approval`：`orphanCount = 0`
  - `memory/recommendation`：`orphanCount = 0`
- 唯一冲突扫描：通过（`uniqueViolationCount = 0`）

## 5. 结果结论

- Mandatory-only 迁移链路已在验证库与正式库完成并通过
- 强制项检查已达到 `overallPass=true`
- `db:reset` 共享库保护仍保留（未回退）

## 6. 未执行项说明

以下全链路回归命令未在本次数据库窗口内执行：

- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

原因：本轮目标是数据库强制项收口与迁移窗口落地，应用层全回归在后续窗口单独执行。
