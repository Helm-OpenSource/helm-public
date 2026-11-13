> **语言 / Language**：**中文** · [English](README.en.md)

# 公开升级说明（`helm.upgrade-note/v1`）

每新增一个 `prisma/migrations/<迁移目录>/`，同一个 PR 里必须带一份
`prisma/upgrade-notes/<迁移目录>.json`。这份说明写给自建部署的人：升级前能看出这次迁移会不会改已有表、
大概要什么 MySQL 算法和锁、有没有回滚脚本、升级后怎么核对。

检查命令是 `npm run check:upgrade-notes`（脚本 `scripts/check-upgrade-notes.ts`）。它已经串进
`npm run check:boundaries`，所以 CI 的 Repo Guards job 和本地 husky 钩子都会跑；同名测试
`scripts/check-upgrade-notes.test.ts` 由 `npm run test` 收录。

## 1. 检查什么

| 规则 | 含义 |
|---|---|
| `missing-note` | 迁移目录不在基线里，又没有同名说明 |
| `invalid-json` / `invalid-format` | 不是 JSON，或不符合下面的闭集格式（未知键一律拒绝，中英摘要都不能为空） |
| `name-mismatch` | 文件里的 `migration` 与文件名不一致 |
| `orphan-note` | 说明没有对应的迁移目录 |
| `rollback-missing` | `rollback.kind` 为 `sql`，但 `rollback.path` 指向的文件不存在 |
| `inconsistent-ddl` | 能从文本确定的矛盾：`CREATE` 却标成已有表；`COPY` 却写不重建；`INSTANT` 却写了锁或重建 |
| `baseline-invalid` / `baseline-stale` / `baseline-has-note` | 基线文件格式不对、未排序或重复；基线里的迁移已不存在；基线里的迁移又写了说明（补写说明时要同时删掉基线条目） |

检查只核对文本，不判断 MySQL 实际会不会重建表。实际行为以你自己在同版本 MySQL 上的演练为准。

## 2. 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `schema` | 是 | 恒为 `helm.upgrade-note/v1` |
| `migration` | 是 | 迁移目录名，必须等于文件名（不含 `.json`） |
| `summary` | 是 | `{ "zh": "…", "en": "…" }`，一两句话说这次迁移做了什么 |
| `ddl[]` | 是，至少一项 | 每个受影响的表一项：`table`；`existingTable`（是否改已有表）；`algorithm` 取 `INSTANT` / `INPLACE` / `COPY` / `CREATE` / `VIEW` / `TRIGGER` / `DATA`；`lock` 取 `NONE` / `SHARED` / `EXCLUSIVE`；`rebuild`（是否整表重建） |
| `rollback` | 是 | `{ "kind": "sql", "path": "prisma/rollback/<文件>.sql" }`，或没有回滚脚本时写 `{ "kind": "forward-only", "reason": { "zh": "…", "en": "…" } }` |
| `order` | 是 | `migrate-before-code`（先迁移再切代码）/ `code-before-migrate` / `independent` |
| `env[]` | 是，可为空数组 | 涉及的环境变量：`key`、`codeDefault`（代码缺省值，原样写字符串）、`enablePrerequisites[]`（打开前的通用前置，中英各一句） |
| `verification[]` | 是，至少一项 | 通用验证步骤，中英各一句 |

`algorithm` 的取值：`CREATE` 是新建对象；`VIEW` / `TRIGGER` 只改定义；`DATA` 只写数据、不改结构。
SQL 里没有写明 `ALGORITHM=` 时，按 MySQL 文档写你预期的算法，并在验证步骤里提醒先演练。

## 3. 示例（占位名，不对应真实迁移）

```json
{
  "schema": "helm.upgrade-note/v1",
  "migration": "20990101000000_example_add_column",
  "summary": {
    "zh": "为示例表新增一个可空列，不改已有数据。",
    "en": "Adds one nullable column to the example table; existing rows are unchanged."
  },
  "ddl": [
    { "table": "ExampleTable", "existingTable": true, "algorithm": "INSTANT", "lock": "NONE", "rebuild": false }
  ],
  "rollback": { "kind": "sql", "path": "prisma/rollback/20990101_rollback_example_add_column.sql" },
  "order": "migrate-before-code",
  "env": [
    {
      "key": "HELM_EXAMPLE_FEATURE_ENABLED",
      "codeDefault": "false",
      "enablePrerequisites": [{ "zh": "迁移已应用。", "en": "The migration is applied." }]
    }
  ],
  "verification": [
    { "zh": "在 information_schema.COLUMNS 中确认新列存在。", "en": "Confirm the new column in information_schema.COLUMNS." }
  ]
}
```

## 4. 不能写进来的东西

这是公开仓。说明里只写通用的 MySQL 事实和通用步骤，**不写**：

- 部署事实：主机名、地址、域名、云资源标识、角色与策略名、存储桶名；
- 租户与业务事实：客户或租户名称、私有扩展的表名和迁移序号、数据库账号名；
- 生产观测：行数、表大小、耗时实测、在役版本号、开关的生产现值、发布时间；
- 私有流程信息：私有仓的 PR 号、谁批准、授权编号、内部工单号。

这些属于各部署自己的私有补充，放在各自的私有仓里。`npm run check:public-release` 会照常扫描本目录，
但它认不全上面每一类，评审仍要逐条把关。

## 5. 基线

`scripts/upgrade-notes-baseline.json` 列出本检查合入时 main 上已有的迁移，它们暂不要求说明。
基线**只能减少**：为存量迁移补写说明时，在同一个 PR 里删掉对应条目。不要把新迁移加进基线来绕过检查；
检查用两条硬约束兜底：基线最多 104 项（合入时的份数）；每一项的名字都不得排在截止名
`20261112130000_billing_topup_order_query_throttle` 之后。在截止名之前补一个新名字仍要靠评审拒绝。
