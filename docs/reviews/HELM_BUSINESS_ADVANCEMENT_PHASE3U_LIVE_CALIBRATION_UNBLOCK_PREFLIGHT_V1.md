---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3U — Live Calibration Unblock Preflight V1

**状态**: Phase 3U Script-Only Isolated Preflight
**Runtime Adoption 姿态**: No-Go
**生产接入**: No-Go
**日期**: 2026-04-26

---

## 概述

Phase 3U 是在 Phase 3T（Live DB Reachability Recheck，docs-only）之后新增的 script-only、no-DB-access 前置检查工具。Phase 3T 记录了当前 DB 不可达、Phase 3P/3Q/3R/3S 整条链路阻断的事实。Phase 3U 的目的是：**在 DB/网络/workspaceId 恢复可用之前，标准化并固化重跑 Phase 3P → 3Q → 3R → 3S 所需的精确条件与安全命令链**，从而消除手动拼凑参数的歧义，避免误操作。

Phase 3U **只读 argv 与 env**，不访问 DB、不读写文件系统、不发起网络请求、不调用 Prisma。它是一个纯函数评估器，输出包含：
- 所有缺失条件的 blockers 列表
- 脱敏的 database target（仅 protocol/host/database，不含完整 URL 或密码）
- workspaceId 是否存在的布尔值（不暴露实际值）
- 当所有条件满足时，输出精确的 4 条安全命令链（Phase 3P → 3Q → 3R → 3S），供操作人员按序执行

---

## 为什么 Phase 3U 在 Phase 3T 之后存在

Phase 3T 结论：DB 不可达，真实数据校准无法执行，Phase 3P/3Q/3R/3S 链路全部阻断。

Phase 3T 仅记录了阻断事实与允许的后续工作方向，但没有固化**具体的参数配置要求**与**精确的命令序列**。当网络/DB/workspaceId 恢复后，如果操作人员需要从头组装参数，容易出现以下风险：

1. 使用错误的 workspaceId（例如沿用 dummy `db-reachability-probe-only`）
2. 忘记指定 reference clock，导致 Phase 3P 使用当前系统时间
3. 传递非 mysql 协议的 DATABASE_URL（如指向错误环境）
4. 忘记按 3P → 3Q → 3R → 3S 顺序执行，或跳过某一阶段

Phase 3U 通过标准化校验逻辑，将上述检查变为可重复执行的机器检查，并在所有条件满足时自动生成正确的命令链，消除歧义。

---

## 当前姿态

| 项目 | 状态 |
|---|---|
| Runtime adoption | **No-Go（始终）** |
| 生产接入 | **No-Go（始终）** |
| productionAdoptionAllowed | `false`（始终，不受 liveCalibrationReady 影响） |
| runtimeIntegrationAllowed | `false`（始终，不受 liveCalibrationReady 影响） |
| dbAccessAttempted | `false`（始终，Phase 3U 不访问 DB） |
| filesWritten | `false`（始终，Phase 3U 不写文件） |
| liveCalibrationReady | 仅当所有校验通过时为 `true` |

---

## 功能边界

Phase 3U **是**：

- script-only、no-DB-access 的纯函数前置检查工具
- 对 Phase 3P → 3Q → 3R → 3S 重跑条件的标准化校验
- 当条件满足时生成精确 4 条安全命令链的工具
- 不依赖任何数据库连接、不读写文件系统、不调用 Prisma

Phase 3U **不是**：

- runtime adapter
- `data/queries.ts` 集成
- app route / API route
- prisma schema 变更
- mobile read-model 集成
- official write path
- runtime adoption 授权工具（即使 `liveCalibrationReady=true` 也不授权 runtime adoption）
- automated execution authority
- auto-approve 或 auto-send 工具

---

## 校验条件

Phase 3U 检查以下条件，任意不满足则 `liveCalibrationReady=false`（exit 2）：

| 条件 | 来源 | 说明 |
|---|---|---|
| `DATABASE_URL` 存在 | `env.DATABASE_URL` 仅 | 不读取文件系统，不做默认 fallback |
| `DATABASE_URL` 协议为 `mysql` | 解析 URL | 非 mysql 协议明确拒绝 |
| `DATABASE_URL` host 非本地地址 | 解析 URL | `localhost` / `127.0.0.1` / `::1` 只能用于开发验证，不能解锁 live calibration |
| `workspaceId` 非空 | `--workspace-id` > `env.WORKSPACE_ID` > `env.HELM_PHASE3P_WORKSPACE_ID` | 三级优先级 |
| `workspaceId` 不为 dummy `db-reachability-probe-only` | 精确字符串匹配 | 显式拒绝探测哨兵值 |
| `referenceClockIso` 存在且为有效 ISO datetime | `--reference-clock-iso` > `env.REFERENCE_CLOCK_ISO` | 不读取系统时间 |
| `take` 为 1..500 整数 | `--take`（默认 200） | 浮点/越界均拒绝 |

---

## 输出字段说明

| 字段 | 说明 |
|---|---|
| `ruleVersion` | `"phase3u-live-calibration-unblock-preflight/v1"` |
| `runtimeAdoptionPosture` | `"No-Go"`（始终） |
| `liveCalibrationReady` | `true` 当且仅当所有校验通过 |
| `productionAdoptionAllowed` | `false`（始终） |
| `runtimeIntegrationAllowed` | `false`（始终） |
| `dbAccessAttempted` | `false`（始终） |
| `filesWritten` | `false`（始终） |
| `blockers` | 所有校验失败的原因列表 |
| `redactedDatabaseTarget` | 仅包含 `protocol`/`host`/`database`，不含完整 URL、用户名或密码 |
| `resolvedWorkspaceIdPresence` | boolean，指示 workspaceId 是否存在（不暴露实际值） |
| `referenceClockIso` | 已解析的 ISO 时间字符串，或 `null` |
| `take` | 已解析的 take 值（默认 200） |
| `safeCommandChain` | 4 条安全命令（仅当 `liveCalibrationReady=true`），否则 `null` |
| `allowedNextStep` | 明确的下一步说明 |

---

## 安全命令链结构（liveCalibrationReady=true 时）

当所有条件满足，`safeCommandChain` 包含精确 4 条命令，必须按序执行：

```
[1] DATABASE_URL='${DATABASE_URL}' npx tsx scripts/business-advancement-phase3p-redacted-snapshot-collector.ts \
      --workspace-id '${WORKSPACE_ID}' \
      --reference-clock-iso '<已验证的 ISO>' \
      --take <已验证的整数> \
      --print-json > /tmp/phase3p-snapshot.json

[2] npx tsx scripts/business-advancement-phase3q-snapshot-intake-review.ts \
      --input /tmp/phase3p-snapshot.json

[3] npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
      --input /tmp/phase3p-snapshot.json

[4] npx tsx scripts/business-advancement-phase3s-runtime-adoption-review-packet.ts \
      --input /tmp/phase3p-snapshot.json
```

**注意**：
- `DATABASE_URL` 和 `WORKSPACE_ID` 在命令中以 shell 变量引用形式展示，不暴露实际值
- `referenceClockIso` 和 `take` 为非敏感值，在命令中以实际已验证值展示
- 4 条命令必须按 3P → 3Q → 3R → 3S 顺序执行，不可跳过或乱序

---

## 验证命令

```bash
# 运行 Phase 3U 测试
npx vitest run features/business-advancement/phase3u-live-calibration-unblock-preflight.test.ts

# 条件不满足时（exit 2）
npx tsx scripts/business-advancement-phase3u-live-calibration-unblock-preflight.ts

# 提供完整条件时（exit 0；连接串只通过本地 shell 环境传入，不在文档中记录）
DATABASE_URL='<redacted-mysql-url>' \
  npx tsx scripts/business-advancement-phase3u-live-calibration-unblock-preflight.ts \
  --workspace-id 'ws-real-xxx' \
  --reference-clock-iso '2026-04-26T00:00:00.000Z' \
  --print-json

# JSON 输出
DATABASE_URL='<redacted-mysql-url>' \
  npx tsx scripts/business-advancement-phase3u-live-calibration-unblock-preflight.ts \
  --workspace-id 'ws-real-xxx' \
  --reference-clock-iso '2026-04-26T00:00:00.000Z' \
  --print-json
```

---

## 刻意禁止的工作

以下工作明确禁止，不受 `liveCalibrationReady` 状态的影响：

| 禁止项 | 理由 |
|---|---|
| Runtime adapter 直接接入 | No-Go，需独立实施计划与人工评审 |
| `data/queries.ts` 修改 | 超出当前批准范围 |
| `app/` / API route 修改 | 超出当前批准范围 |
| prisma schema 变更 | 超出当前批准范围 |
| mobile read-model 集成 | 超出当前批准范围 |
| official write path | 超出当前批准范围 |
| auto-send / auto-approve / auto-execution | 始终禁止 |
| 直接生产 runtime adoption（即使 3S packet-ready） | 需要人工评审会议与独立实施计划批准 |

---

## 已明确不包含的内容

- 数据库密码或完整 connection string（`redactedDatabaseTarget` 仅含 protocol/host/database）
- 实际 workspaceId 值（仅输出布尔型 `resolvedWorkspaceIdPresence`）
- 任何业务表行（Phase 3U 不访问 DB）
- 系统时间（不读取 `Date.now()` 或 `new Date()`，reference clock 来自 argv/env）

---

## 当前姿态结论

**Phase 3U liveCalibrationReady=true 仅表示环境参数齐备，可以执行 Phase 3P → 3Q → 3R → 3S 链路。它不授权 runtime adoption，不改变 productionAdoptionAllowed（始终 false）或 runtimeIntegrationAllowed（始终 false）的值。**

本地 MySQL 可以用于 schema / seed / collector 的开发验证，但本地地址不会让 Phase 3U 返回 `liveCalibrationReady=true`，也不能替代真实 live DB calibration。Phase 3P 会把本地 DB snapshot 标记为 `local_development_snapshot`，后续 Phase 3R/3S 必须继续阻断生产评审 readiness。

下一步允许的工作（在 DB/网络/workspaceId 恢复后）：
1. 运行 Phase 3U 验证参数齐备（exit 0）
2. 执行 safeCommandChain 中的 4 条命令（按序）
3. Phase 3S review packet 就绪后，召开人工 production runtime adoption review 会议
4. 起草独立实施计划，获得全部评审人批准
5. 仅在上述全部完成后，方可考虑 runtime adoption 的具体实施
