---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM 数据库规范对齐报告 V1（SQLite→MySQL Phase 1）

## 1. 对齐目标

按 Phase 1 要求，仅对齐以下强制项：

1. 运行时切到 MySQL
2. 迁移链路可审计且可复跑
3. `db:reset` 风险收敛
4. CI/e2e 全链路不再依赖 sqlite 文件复制

## 2. 规范项状态

| 规范项 | 状态 | 说明 |
| --- | --- | --- |
| Prisma datasource provider 使用 MySQL | 已达标 | `prisma/schema.prisma` 已改为 `provider = "mysql"` |
| SQLite 历史迁移归档 | 已达标 | 归档到 `prisma/migrations_sqlite_archive/` |
| MySQL baseline migration 建立 | 已达标 | `prisma/migrations/202604150001_mysql_baseline/migration.sql` |
| MySQL 长文本字段防截断加固 | 已达标 | `prisma/migrations/202604150002_mysql_longtext_runtime/migration.sql` 将 runtime 关键 JSON/markdown/summary 列升级为 `LONGTEXT` |
| `db:prepare` 作为默认入口 | 已达标 | `package.json` 已新增并接入 `prisma/setup-db.ts prepare` |
| `db:reset` 默认禁止共享库 | 已达标 | 仅 CI 临时库或 `DB_RESET_ALLOWLIST` 允许 |
| e2e 使用临时 MySQL 库 | 已达标 | `scripts/run-playwright-e2e.ts` 自动建库/清理 |
| SQLite→MySQL 对账报告 | 已达标 | `db:reconcile-report` 生成 JSON + Markdown |
| 统一命名改造（snake_case） | 下一阶段 | Phase 2 |
| 主键体系改造（bigint auto_increment） | 下一阶段 | Phase 2 |
| 去外键治理 | 下一阶段 | Phase 2 |

## 3. 未达标项整改计划（Phase 2）

1. 命名与字段体系统一
   - 原因：涉及 100+ model，切流窗口内风险过高
   - 风险：跨系统字段口径不统一
   - 计划：拆分模型分批迁移 + 兼容层
2. 主键策略切换
   - 原因：外部引用和历史数据兼容复杂
   - 风险：长期保持字符串主键影响部分存储/索引效率
   - 计划：先补业务唯一键，再双轨迁移主键
3. 外键治理策略
   - 原因：当前仍依赖关系约束保障一致性
   - 风险：治理策略切换时可能引入数据孤儿
   - 计划：引入应用层审计任务后再逐步收敛

## 4. 边界声明

- 本次完成的是 MySQL 运行时切换与迁移执行层，不等于完整数据库规范重构完成。
- recommendation / proposal / explanation 相关表述不应被解读为外部承诺。
- 任何面向客户的口径仍需保留 prerequisite / dependency / non-commitment 说明。

## 5. Phase 2 入口

- 强制项迁移校验报告：[`HELM_MYSQL_PHASE2_MANDATORY_MIGRATION_VALIDATION_REPORT_V1.md`](./HELM_MYSQL_PHASE2_MANDATORY_MIGRATION_VALIDATION_REPORT_V1.md)
- 强制项规范对齐报告：[`HELM_MYSQL_MANDATORY_SPEC_ALIGNMENT_REPORT_V1.md`](./HELM_MYSQL_MANDATORY_SPEC_ALIGNMENT_REPORT_V1.md)
