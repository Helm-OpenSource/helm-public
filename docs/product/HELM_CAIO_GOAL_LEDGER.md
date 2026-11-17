---
status: draft
owner: helm-core
created: 2026-11-17
review_after: 2026-12-17
public_safety: Planning and contract description of a Core module whose code is not merged yet. Synthetic examples only; no tenant data, people, credentials, threshold values, deployment identifiers or production receipts.
---

# CAIO 目标台账

> **语言 / Language**: 中文主文本 + [English reference](HELM_CAIO_GOAL_LEDGER.en.md)

状态：规划中，代码尚未合入。本文是实现前的规划与契约说明（涉及 schema 与迁移的改动须先有规划文档）。本文不构成启用许可，也不表示任何工作区已经设立目标台账。

## 定位

- 每个工作区一条只追加、带哈希链的目标台账。每一条记下 OWNER 原话、变更说明和一张封存摘要表；摘要表里固定一项绑定一份 Core 形状的目标文档：目标、指标引用、部件（工作线）、关卡，以及各自的主责角色键。
- 写入只走受控命令，由工作区 OWNER 授权；读出每次从第 1 条重验全链，链断即报警，报警态不带任何目标内容。
- 台账是记录，不是权限：不授予任何角色权限，不派发任务，不触发执行。
- 模块放在 `lib/caio-goal-ledger/`，不建 `index.ts`；不复用 mandate 记录（权限防火墙后面，API 路由读不到）、工作区 `focusAreas`（可变设置、无链、非 OWNER 也能改）或关注事项路由配置（由运营身份发布，没有 OWNER 校验）。

## 明确不做

- **不做 AI 自动派发**。台账只说明目标是什么、哪条工作线由哪个角色主责；派发仍由真人在关注事项流程里确认。
- **不存达标线取值**。文档里只有达标线的引用和摘要（sha256），取值留在私有 overlay。契约在每一层都拒绝未知字段，所以没有位置能放取值。
- **不含个人排名形状**。没有按人的分数、名次或可排序字段，不携带 userId；角色到人的绑定继续只存在关注事项路由配置里。
- 不设网页入口、API 路由或 server action；写入只有命令行。
- 不支持未来生效；链被拒后没有带内修复，恢复靠从备份还原。

## 链条目

- `hash = sha256(规范 JSON(条目去掉 hash 字段))`，UTF-8，小写十六进制。
- `prev_hash` 是上一条的 `hash`，第 1 条为 64 个 `0`；`seq` 从 1 连续。
- 规范 JSON：键按 Unicode 码点排序；分隔符 `,` 和 `:` 不带空格；非 ASCII 原样输出；字符串转义同 `JSON.stringify`。值域只有字符串、安全整数、布尔、null、对象、数组；非整数、超出安全整数、孤立代理项一律拒绝。
- 不复用 `lib/expert-capability/hashing.ts` 的 `canonicalJson`：它按 UTF-16 码元排序，也接受浮点。

条目字段是闭集，多出任何键即 `entry_shape_invalid`：

| 字段 | 必填 | 说明 |
|---|---|---|
| `seq` | 是 | 整数 ≥ 1 |
| `ts` | 是 | 带偏移的 ISO 时间串，原样保存 |
| `owner_quote` | 是 | OWNER 原话，1 到 4000 字（按码点计，不得全为空白） |
| `change` | 是 | 变更说明，1 到 4000 字（同上） |
| `files` | 是 | `{ 路径键: sha256 }`，Core 视为不透明的封存摘要表；键 `^[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$`，值 64 位小写十六进制 |
| `prev_hash`、`hash` | 是 | 见上 |
| `writer` | 否 | 写入来源；本地追加写 `user:<actorUserId>` |
| `effective_at` | 否 | 生效时间，缺省取 `ts` |
| `schema` | 否 | 本地追加写 `caio-goal-ledger-entry/v1` |

- 生效时间：本地追加要求 `effective_at` 不晚于当前时间，且不早于上一条的生效时间（否则 `effective_at_in_future` / `effective_at_regression`）。当前版本恒为链头。
- `files` 另有一个用途：overlay 的私有口径文件和达标线不进 Core，但摘要封在链里，overlay 可据此自验。

## Core 形状文档 `caio-goal-ledger-document/v1`

条目的 `files[documentFileKey]` 等于 `sha256(文档原文的 UTF-8 字节)`。文档原文逐字节保存，不重排。本地追加时 `documentFileKey` 固定为 `caio/goal-ledger-document.json`，原文为规范 JSON；导入时由导入包指定键名。

```ts
type CaioGoalLedgerDocument = {
  schema: "caio-goal-ledger-document/v1";
  goals: Array<{                      // 1..20
    key: string;                      // CAIO_REF_PATTERN，文档内唯一
    kind: "northstar" | "stage_metric";
    title: string;                    // ≤200
    standard: string;                 // ≤2000，达标标准的文字
    metrics: Array<{                  // 0..20；key 对应 NorthstarKpi.key
      key: string;
      label: { zh: string; en: string };
      unit: NorthstarKpiUnit;
      direction: NorthstarKpiDirection;
      basisRef: string;
    }>;
    threshold: { ref: string; sha256: string | null } | null;  // 只有引用和摘要；sha256 为 null 表示未设线
    componentKeys: string[];          // 必须都在 components 里
  }>;
  components: Array<{ key: string; label: string; primaryRoleKey: string }>;        // 0..100
  gates: Array<{ key: string; label: string; holderRoleKey: string; note?: string }>; // 0..50
  roleBindingPin: { source: "caio_attention_route_config"; version: number; contentHash: string } | null;
};
```

校验规则（每层 strict，全部 fail closed）：

- 未知键拒绝。
- 目标、部件、关卡的 `key` 在各自列表内唯一，指标 `key` 在整份文档内唯一，同一目标的 `componentKeys` 不重复；`componentKeys` 引用必须存在。
- 角色键沿用关注事项的模式 `^[a-z][a-z0-9_]{0,63}$`，契约层会把它从 `lib/caio-attention/contracts.ts` 导出为 `CAIO_ATTENTION_ROLE_KEY_PATTERN` 后引用（现为该文件内的私有常量），不另抄一份。
- `roleBindingPin` 有条件必填：文档出现任何角色键时必填，否则须为 null。
- 文字防带数：`title`、`standard`、各 `label` 和关卡的 `note` 命中金额或百分比模式时拒绝（`prose_carries_value`），以免取值从文字字段漏进来。这些字段会进成员简报；“100% 的部件”这类写法要换说法。

人员绑定不进台账，但被台账钉住：

- 写入时（只对将成为链头的文档）校验：钉住的路由配置版本存在；`sha256(存的配置原字节)` 等于 pin，也等于该行的 `contentHash`；文档用到的每个角色键都在 `roleBindings` 里。不满足即 `role_binding_pin_invalid`。写入时不要求该版本已激活。
- 读出时：当前激活版本等于 pin 才解析出人，否则人员部分报 `drift`；目标和指标部分不受影响。换人须 OWNER 再封一条。

## 写入

```
npm run caio:goal-ledger -- --template=<appendEntry|importChain>
npm run caio:goal-ledger -- --operation=<appendEntry|importChain> --workspace-id=<id> \
    --actor-user-id=<id> --input-file=<path.json> [--apply] [--english]
npm run caio:goal-ledger -- --verify --workspace-id=<id>
```

- 与 `npm run caio:governance-operator` 同族，复用 `lib/caio-operator/operation-core.ts`：默认只校验，带 `--apply` 才写；输出一行 JSON。
- 退出码：0 成功；1 被拒（闭集码）；2 用法错；3 `--verify` 发现台账为 `rejected` 或 `unavailable`。
- `appendEntry` 输入：`ownerQuote`、`change`、`effectiveAt`、`expectedHeadHash`（空链填 64 个 0）、`document`。
- `importChain` 输入：`format: "caio-goal-ledger-import/v1"`、`documentFileKey`、`entries`（按序，上限 10000 条）、`documents`（摘要到文档原文）。

身份校验四层：

| 层 | 做什么 |
|---|---|
| 命令行预检 | 只读 `Membership`，不是 ACTIVE 的 OWNER 即返回 `not_owner`，不进服务 |
| 事务内复核 | 事务第一条语句 `SELECT role, status FROM Membership … FOR SHARE`，不是 ACTIVE OWNER 即拒；在台账模块内实现，不引用 `lib/caio-governance` |
| 库权限 | 读身份只有 SELECT；运营身份对条目表只有 SELECT / INSERT；谁都没有 DELETE |
| 结构守卫 | 写服务只能被白名单引用；`app/`、server action 不得引用写入口；模块无 `index.ts` |

`appendEntry` 的事务顺序：复核 OWNER → 锁头锚 → 读全部条目并全链校验（不过即 `chain_rejected`）→ 比对 `expectedHeadHash`（不符即 `head_conflict`）→ 校验文档与 pin 并插入 → 头锚以原生条件更新做比较交换 → 同事务读回重验（不符即 `storage_roundtrip_mismatch` 并回滚）→ 同事务写审计。三条唯一约束 `(workspaceId, seq)`、`(workspaceId, entryHash)`、`(workspaceId, prevHash)` 兜住并发，最后一条保证每条只有一个后继，库层面不能分叉。

`importChain`：先纯函数验整包链（`bundle_chain_invalid`）；库里已有 n 条、包里 m 条，要求 n ≤ m 且前 n 条 `hash` 逐条相等，否则 `import_fork` 且一行不写；只追加差额；包里最后一条必须带文档并过校验（`head_document_missing` / `document_invalid`），历史条目可以不带文档；完全相同的包重导返回 `appended: 0`，不写任何行。同一工作区同一时间只能有一个写入来源，否则链会分叉。

审计：成功写入时在同事务写一条，载荷只有 `seq`（或起止 seq）、条目哈希、前一条哈希、文档哈希和来源，不放 OWNER 原话和文档内容，因为审计日志的可读范围不限于 OWNER。被拒的尝试不写库，命令输出闭集码即记录。

残余风险：`--actor-user-id` 由执行者申报，不是认证。持有运营库身份的人仍能冒填 OWNER 的 userId。缓解靠原话入链、审计行，以及控制台展示链头 `seq` 和哈希供 OWNER 比对；签名硬锁不在本模块。

## 读出

```ts
type CaioGoalLedgerRead =
  | { state: "empty" }                                  // 从未写过
  | { state: "ok"; head: CaioGoalLedgerHeadView; document: CaioGoalLedgerDocument;
      sealedDigests: Readonly<Record<string, string>> } // 链头条目的 files
  | { state: "rejected"; alarm: { code: CaioGoalLedgerAlarmCode; atSeq: number | null;
      verifiedThroughSeq: number; entryCount: number } }
  | { state: "unavailable"; reason: "schema_not_ready" | "read_failed" };
```

- 报警码闭集：`seq_gap`、`prev_hash_mismatch`、`entry_hash_mismatch`、`entry_shape_invalid`、`column_mismatch`、`head_anchor_missing`、`head_anchor_mismatch`、`document_missing`、`document_hash_mismatch`、`document_invalid`。
- 每次读都从第 1 条验到链头，不缓存。只信原文：`seq`、哈希、生效时间都从条目原文和文档原文重算，列与原文不符即 `column_mismatch`。尾部被删时链本身仍自洽，靠头锚发现。
- `rejected` 不带 `document`，也不退回上一份有效版本，只给断点位置和可验证到第几条。
- 表不存在或查询失败是 `unavailable`，绝不当 `empty`。
- 本模块里可见的报警只有两样：读出返回 `rejected`，以及 `--verify` 以退出码 3 结束。界面展示和站内通知由下游控制台切片负责。

指标三态不出 0：`projectCaioGoalReadouts(document, kpis)` 按 `key` 在北极星 KPI 来源里找；找到且单位相符就原样采用（`measured` / `pending_source` / `no_data`）；找不到或单位不符就合成 `pending_source`、`value: null`、说明非空。每条输出都过 `validateNorthstarKpis`。来源明确给出 `measured` 且值为 0 时照实显示 0。Core 本体没有 KPI 来源，所以 overlay 接入前全部指标都是 `pending_source`。

## 数据层

- `CaioGoalLedgerEntry`：`id`、`workspaceId`、`seq`、`entryHash`、`prevHash`、`entryJson`（条目规范 JSON 原文，时间串以文本保存）、`documentFileKey`、`documentHash`、`documentText`（文档原文，逐字节）、`effectiveAt`（派生索引列）、`source`（`command` / `import`）、`recordedByUserId`、`createdAt`。三条唯一约束见上；CHECK 约束覆盖 seq ≥ 1、哈希长度、创世条目与 64 个 0 互为充要、来源取值、JSON 合法、文档三列同空同有。
- `CaioGoalLedgerHead`：每工作区一行，`headSeq`、`headHash`、`rowVersion`、`updatedByUserId`、`updatedAt`。
- 只新增表，不加数据库外键，不用触发器；只追加由授权保证。回滚脚本在任一表有数据时拒绝执行。迁移同 PR 带升级说明；本模块不加环境开关。
- 不接进关注事项的 schema 就绪清单（以免把它的发版闸门和本迁移绑在一起），另设 `lib/caio-goal-ledger/schema-readiness.ts`。

| 表 | 读身份 | 运营身份 |
|---|---|---|
| `CaioGoalLedgerEntry` | SELECT | SELECT, INSERT |
| `CaioGoalLedgerHead` | SELECT | SELECT, INSERT, UPDATE |
| `CaioAttentionRouteConfig`、`CaioAttentionRouteConfigHead` | SELECT | SELECT |
| `Membership` | 无 | SELECT |
| `AuditLog` | 无 | SELECT, INSERT |

## PR 拆分顺序

每个 PR 可独立回滚，单 PR ≤ 800 行、≤ 15 个文件。

| PR | 内容 |
|---|---|
| PR-0 | 本文及英文参考、文档索引、状态表 |
| PR-1 | 纯契约：规范 JSON 与哈希、条目与文档契约；导出关注事项的角色键模式 |
| PR-2 | 纯链校验、指标读数投影、角色绑定解析、合成夹具 |
| PR-3 | 数据层：schema、迁移、回滚脚本、升级说明、就绪探针、权限矩阵 |
| PR-4 | 读存取：存取端口、Prisma 读适配、内存实现、读服务 |
| PR-5 | 写存取与隔离 MySQL 套件 |
| PR-6 | 受控命令、结构守卫、命令用法与状态更新 |

PR-3 可与 PR-2 并行。

## 下游切片的接口边界

下游只调下面这些函数，都不得引用写服务。

- 公共：`readCaioGoalLedger({ workspaceId })`；`readCaioGoalLedgerRoleBindings({ workspaceId, pin })`，返回 `match` / `drift` / `route_config_missing` / `unavailable`。
- 控制台（OWNER 只读）：`readCaioGoalLedgerHistory` 含 OWNER 原话，调用方必须先做 OWNER 门；`rejected` 和 `unavailable` 必须渲染成报警，不得当空态；展示链头 `seq` 和哈希。`projectCaioGoalReadouts` 给出每个目标的三态指标。
- 关注事项探测器：`resolveCaioGoalLedgerComponentRole`、`resolveCaioGoalLedgerGateHolder`、`evaluateCaioGoalThresholdEcho`（`unset` / `match` / `mismatch`）。激活的路由配置版本与 pin 不符时必须挡住预填；路由规则的主责角色与台账不一致时以台账为准并阻断；台账不是 `ok` 时探测器记 `SKIPPED`，不记 `NO_HIT`；`mismatch` 的达标线读数不得当作已测量。
- 成员简报（`get_my_brief`）：`selectCaioGoalLedgerForRoles(document, roleKeys)` 只给本人角色相关的部件和关卡；不给成员 OWNER 原话、变更说明和封存摘要；目标文字走成员网关的投影阶梯；简报段在台账异常时显示报警（`ledger_rejected` / `ledger_unavailable` / `role_binding_drift`）。

## 变更记录

- 2026-11-17：首版规划，代码尚未合入。
