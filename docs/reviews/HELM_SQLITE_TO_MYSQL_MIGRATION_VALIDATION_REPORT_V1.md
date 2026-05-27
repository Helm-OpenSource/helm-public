---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM SQLite→MySQL 迁移校验报告 V1

## 1. 目标与范围

本报告对应 Helm SQLite→MySQL Phase 1 落地，目标是：

1. 运行时 datasource 切换到 MySQL（Prisma-only）
2. 提供可审计的一次性迁移链路：`sqlite-export -> mysql-import -> reconcile-report`
3. 收紧 `db:reset` 到 CI 临时库或显式 allowlist
4. 把 CI / e2e 从 sqlite 文件复制模式切到 MySQL 临时库模式

本次不包含 Phase 2（命名体系、主键体系、去外键）治理。

## 2. 切流窗口 Runbook

固定窗口执行顺序：

1. 冻结写入
2. 备份 SQLite 源库
3. 执行 `npm run db:sqlite-export`
4. 执行 `npm run db:mysql-import`
5. 执行 `npm run db:reconcile-report`
6. 审核 reconcile 报告（不通过则停止切流）
7. 切 `DATABASE_URL` 到 MySQL
8. 执行验证链
9. 恢复写入

## 3. 迁移脚本与产物

- 脚本：[`scripts/sqlite-to-mysql-migration.ts`](../../scripts/sqlite-to-mysql-migration.ts)
- 产物目录：`.tmp/sqlite-mysql-migration/latest`
  - `export/manifest.json`
  - `reports/import-summary.json`
  - `reports/reconcile-report.json`
  - `reports/reconcile-report.md`

## 4. 详细验证清单

本轮标准验证链：

1. `npm run self-check`
2. `npm run check:boundaries`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test`
6. `npm run build`
7. `npm run e2e`
8. `npm run quality:regression`

迁移专用验证：

1. `npm run db:prepare` 连续执行两次应成功
2. `db:reset` 在共享库（如 `helm2026`）应拒绝
3. `db:reset` 在 CI 临时库/allowlist 库应允许
4. reconcile 报告应显示关键表 source/target 行数一致

## 5. 当前结论分级

### 已经完整成立

- Prisma runtime provider 已切到 MySQL
- SQLite 历史迁移已归档，不再参与 deploy
- MySQL 长文本列已补齐（`VARCHAR(191)` 截断风险已收敛）
- `db:prepare`、`db:migrate`、`db:reset` 新契约已落地
- e2e 临时库已切到 MySQL 自动创建/清理

### 已成形但仍需下一层

- 迁移窗口演练与正式切流执行记录（需在线上窗口补齐）
- 业务链路抽样对账结果（需在真实迁移数据上生成）

### 刻意未做

- 命名/字段体系重构
- 主键体系切换为 `bigint unsigned auto_increment`
- 去外键模型治理

### 风险项

- 共享开发库模型下，若误配 allowlist 仍可能触发高风险重置
- 历史文档中仍有 sqlite 表述，后续需分批清理
- 大体量数据迁移时需评估导入脚本分块参数与窗口时长
- `db:seed:force` 在远程 RDS 上耗时较长（约 2-4 分钟），会直接拉长 `db:reset/e2e` 总时长

## 6. 本轮实测结果（2026-04-15）

环境：

- 主库（受保护）：`helm2026`
- 验证库（可重置）：`helm2026_ci_verify`

关键结论：

1. `db:prepare` 连续执行两次：通过（第二次无 pending migration，seed 幂等跳过）
2. `db:reset`（主库 `helm2026`）：按预期拒绝
3. `db:reset`（验证库 + allowlist）：通过（含 migration + force seed）
4. 运行时长文本截断修复已验证：
   - 迁移前：`ArtifactBundle.artifactsJson` 被截断到 191 字符，导致 JSON 非法
   - 迁移后：同链路 JSON 可完整落库并被正常解析
   - 对应迁移：`prisma/migrations/202604150002_mysql_longtext_runtime/migration.sql`

验证链结果：

- `npm run self-check`：通过
- `npm run check:boundaries`：通过
- `npm run typecheck`：通过
- `npm run lint`：通过（0 error，4 warning，均为既有未使用参数 warning）
- `npm run test`：失败（206 文件中 3 文件失败；878 测试中 4 失败）
- `npm run build`：通过
- `npm run e2e`：失败（28 条中 1 条失败：`tests/e2e/continuity-recovery.spec.ts` 的文案断言）
- `npm run quality:regression`：通过（51 文件 180 测试全通过）
