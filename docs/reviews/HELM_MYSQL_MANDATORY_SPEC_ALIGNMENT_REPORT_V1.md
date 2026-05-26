---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM MySQL 强制项规范对齐报告 V1（Mandatory-only）

## 1. 对齐范围

本报告仅覆盖《数据库最佳实践》的强制项（结构 + 变更脚本），不包含推荐项与 SQL 编码规范。

## 2. 检查入口与产物

- 命令：`npm run db:spec:mandatory-check`
- 报告：
  - `.tmp/mysql-phase2-mandatory/latest/reports/spec-mandatory-check.json`
  - `.tmp/mysql-phase2-mandatory/latest/reports/spec-mandatory-check.md`

## 3. 当前状态（2026-04-16）

| 规范项 | 状态 | 结果 |
| --- | --- | --- |
| 命名规范（小写、长度、保留字） | 已达标 | `failureCount=0` |
| 三字段（`id/create_time/modify_time`） | 已达标 | `failureCount=0` |
| `id` 主键规则（`bigint unsigned auto_increment`） | 已达标 | `failureCount=0` |
| `create_time/modify_time` 时间语义 | 已达标 | `failureCount=0` |
| 字符集/排序规则统一 `utf8mb4` | 已达标 | `failureCount=0` |
| 表/字段注释必填 | 已达标 | `failureCount=0` |
| 禁止 `float/double` | 已达标 | `failureCount=0` |
| 禁止外键 | 已达标 | `failureCount=0` |
| 索引命名 `uk_/idx_` | 已达标 | `failureCount=0` |
| `varchar` 索引前缀长度 | 已达标 | `failureCount=0` |
| 迁移脚本规范（USE 首行、DDL/DML 分离、禁 after/before） | 已达标 | `failureCount=0` |

## 4. 执行结论

- `helm2026_ci_verify`：`overallPass=true`
- `helm2026`：`overallPass=true`
- Mandatory-only 强制项已完成收口。

## 5. 延期项（非本轮范围）

- 推荐项（如更细粒度命名语义润色）
- SQL 编码规范的代码层治理（`count(*)`、`IS NULL`、join 复杂度等）
