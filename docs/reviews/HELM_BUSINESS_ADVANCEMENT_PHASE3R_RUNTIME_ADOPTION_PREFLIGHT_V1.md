---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3R — Production Runtime Adoption Preflight V1

**状态**: Phase 3R Production Runtime Adoption Preflight Ready
**Runtime Adoption 姿态**: No-Go
**生产接入**: No-Go
**日期**: 2026-04-26

---

## 概述

Phase 3R 在 Phase 3Q snapshot intake review 之后，补齐一个 script-only、offline 的生产 runtime adoption 前置检查门控：

`scripts/business-advancement-phase3r-runtime-adoption-preflight.ts`

它的职责是复用 `runPhase3qSnapshotIntakeReview` 对输入做敏感内容扫描与 Phase 3O 评估，然后在其基础上增加 Phase 3R 前置条件检查：

- `sampleKind === "redacted_live_db_snapshot"`
- `evaluation.realDataValidated === true`
- `evaluation.productionCalibrationComplete === true`
- `evaluation.blockers.length === 0`

只有以上四条全部满足，`productionRuntimeAdoptionReviewReady` 才为 `true`。即便为 `true`，`productionAdoptionAllowed` 与 `runtimeIntegrationAllowed` 仍始终为 `false`；下一步唯一允许工作为人工 production runtime adoption review，不允许直接生产接入、不允许 auto-execution、不允许 auto-approve。

---

## 边界

Phase 3R **是**：

- script-only offline production runtime adoption 前置检查门控
- 从 `--input <file>` 或 stdin 读取 JSON
- 复用 Phase 3Q `runPhase3qSnapshotIntakeReview` 进行敏感内容扫描与 Phase 3O 评估
- 增加四条 Phase 3R 前置条件的纯函数评估器
- 支持 `--print-json` 输出完整结果对象

Phase 3R **不是**：

- production runtime adapter
- `data/queries.ts` 集成
- app route / API route
- prisma schema 变更
- mobile read-model 集成
- official write path
- automated execution authority
- auto-approve 或 auto-send 工具

---

## 接受的输入格式

与 Phase 3Q 相同，同时支持两种格式：

### Phase 3O 直接 evidencePack 对象

```json
{
  "sampleKind": "redacted_live_db_snapshot",
  "workspaceId": "workspace-<hash>",
  "referenceClockMs": 1777161600000,
  "rows": { ... }
}
```

### Phase 3P `--print-json` 输出对象

```json
{
  "evidencePack": { ... },
  "evaluation": { ... }
}
```

---

## Phase 3R 前置条件

| 条件 | 描述 |
|---|---|
| Phase 3Q intake 通过 | 无敏感 key，无 email 类字符串值，格式合法 |
| `sampleKind === "redacted_live_db_snapshot"` | 不接受 `synthetic_fixture` |
| `evaluation.realDataValidated === true` | Phase 3O 评估必须确认真实数据已校准 |
| `evaluation.productionCalibrationComplete === true` | 生产校准必须完整 |
| `evaluation.blockers.length === 0` | Phase 3O 无未解除的 blocker |

以上任一不满足，`productionRuntimeAdoptionReviewReady` 为 `false`，退出码为 2。

---

## 退出码

| 情况 | 退出码 |
|---|---|
| 读取 / 解析输入失败 | 1 |
| 敏感 key 或 email 类字符串值被检测到（Phase 3Q 拒绝） | 1 |
| 输入格式无效（非 Phase 3O / Phase 3P 格式） | 1 |
| 输入合法但 Phase 3R 前置条件未全部满足 | 2 |
| 所有前置条件满足，`productionRuntimeAdoptionReviewReady=true` | 0 |

注意：exit 0 仅表示可进入人工 production runtime adoption review；不等于 `productionAdoptionAllowed=true`。

---

## 纯函数接口

```typescript
export function evaluatePhase3rRuntimeAdoptionPreflight(
  parsed: unknown,
): Phase3rPreflightResult
```

返回：

| 字段 | 类型 | 说明 |
|---|---|---|
| `ruleVersion` | `"phase3r-runtime-adoption-preflight/v1"` | 规则版本标识 |
| `runtimeAdoptionPosture` | `"No-Go"` | 始终 No-Go |
| `productionRuntimeAdoptionReviewReady` | `boolean` | 是否满足进入人工 review 的前置条件 |
| `productionAdoptionAllowed` | `false` | 始终 false |
| `runtimeIntegrationAllowed` | `false` | 始终 false |
| `blockedReasons` | `readonly string[]` | 未满足前置条件的说明列表 |
| `allowedNextStep` | `string` | 下一步唯一允许工作的说明 |

对敏感输入抛出 `Phase3qRejectionError`；对格式非法输入抛出 `Error`。

---

## CLI 使用

从文件读取（输出 summary）：

```bash
npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  --input /path/to/redacted-snapshot.json
```

从 Phase 3P 管道，输出 JSON：

```bash
DATABASE_URL=... \
npx tsx scripts/business-advancement-phase3p-redacted-snapshot-collector.ts \
  --workspace-id <workspace-id> \
  --reference-clock-iso 2026-04-26T00:00:00.000Z \
  --print-json | \
npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  --print-json
```

先运行 Phase 3Q intake review，再对同一份 snapshot 执行 Phase 3R：

```bash
npx tsx scripts/business-advancement-phase3q-snapshot-intake-review.ts \
  --input redacted-snapshot.json

npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  --input redacted-snapshot.json
```

---

## 已经完整成立

| 项目 | 状态 | 说明 |
|---|---|---|
| Phase 3Q intake 复用 | Complete | 通过 `runPhase3qSnapshotIntakeReview` 完整复用 |
| `sampleKind` 前置条件 | Complete | `synthetic_fixture` 被拒绝，只接受 `redacted_live_db_snapshot` |
| `realDataValidated` 前置条件 | Complete | 为 false 时产生 blocker |
| `productionCalibrationComplete` 前置条件 | Complete | 为 false 时产生 blocker |
| Phase 3O blockers 透传 | Complete | evaluation.blockers 中的每条 blocker 都透传为 blockedReasons |
| `productionAdoptionAllowed` 始终 false | Complete | 类型固定为 `false`，不可变更 |
| `runtimeIntegrationAllowed` 始终 false | Complete | 类型固定为 `false`，不可变更 |
| 退出码约定 | Complete | 敏感/非法 exit 1；valid-not-ready exit 2；ready exit 0 |
| `--print-json` 支持 | Complete | `argv.includes("--print-json")` 输出完整 JSON |
| 无文件写入 / 无 DB / 无网络 | Complete | 脚本仅读取输入，无任何写路径 |
| Runtime adoption No-Go | Complete | posture 字段和 allowedNextStep 均明确 No-Go |

---

## 已成形但仍需下一层

| 项目 | 当前状态 | 下一步 |
|---|---|---|
| 真实 DB 校准运行 | 未执行 | 需要 Phase 3P 采集 + Phase 3Q intake review 通过后执行 |
| 真实校准结果通过 Phase 3R 门控 | 未发生 | 需要 `realDataValidated=true` + `productionCalibrationComplete=true` + 无 blocker |
| Production runtime adoption review | 未开始 | Phase 3R 门控通过后才能启动，属于人工评审流程 |
| Runtime adapter | 未实现 | 仍然 No-Go；production runtime adoption review 通过后才能考虑 |

---

## 刻意未做

| 项目 | 理由 |
|---|---|
| 写文件 | 避免把脱敏 snapshot 落库进 repo |
| DB 读写 | preflight gate 必须 offline；不连接 DB |
| `data/queries.ts` 接入 | Runtime adoption No-Go |
| `app/` / `features/mobile/` / prisma schema 接入 | 仍未获批 |
| `productionAdoptionAllowed=true` | 该字段类型硬编码 `false`，即便 ready 也不能置为 true |
| auto-execution / auto-approve | Phase 3R 仅检查前置条件；执行决策权属于人工 production runtime adoption review |

---

## 验证结果

### Phase 3R vitest

```
npx vitest run features/business-advancement/phase3r-runtime-adoption-preflight.test.ts
→ 1 file / 42 tests PASS
```

### Phase 3R eslint

```
npx eslint scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  features/business-advancement/phase3r-runtime-adoption-preflight.test.ts
→ PASS
```

### Phase 3R CLI smoke

```
npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  --input /tmp/helm-phase3r-synthetic.json --print-json
→ exit 2（valid-not-ready）

npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  --input /tmp/helm-phase3r-live.json --print-json
→ exit 0（review-ready；productionAdoptionAllowed=false）

npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  --input /tmp/helm-phase3r-wrapper.json --print-json
→ exit 0（Phase 3P wrapper accepted；productionAdoptionAllowed=false）

npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts \
  --input /tmp/helm-phase3r-sensitive.json --print-json
→ exit 1（Phase 3Q sensitive-key rejection）
```

---

## 结论

Phase 3R 完成的是 offline production runtime adoption 前置检查门控，不是 runtime adoption 本身。

当前状态：

- Preflight gate script: Ready
- Phase 3Q intake reuse: Implemented
- sampleKind gate: Implemented
- realDataValidated gate: Implemented
- productionCalibrationComplete gate: Implemented
- Phase 3O blocker passthrough: Implemented
- productionAdoptionAllowed: Always false
- runtimeIntegrationAllowed: Always false
- Real DB run: Not executed
- Real-data validation: Not completed
- Runtime adoption: No-Go

下一步必须执行 Phase 3P 采集，通过 Phase 3Q intake review，再通过 Phase 3R preflight gate（exit 0）；通过后也只能进入人工 production runtime adoption review，不能直接上线。
