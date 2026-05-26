---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Redacted Real-Data Calibration Package V1

状态：Planning-only evidence package / actual live evidence pending / runtime adoption No-Go

更新时间：2026-04-27

上游：

- [HELM_BUSINESS_ADVANCEMENT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_ASK_HELM_INTERACTION_REDACTED_CALIBRATION_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3P_REDACTED_SNAPSHOT_COLLECTOR_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3P_REDACTED_SNAPSHOT_COLLECTOR_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3Q_SNAPSHOT_INTAKE_REVIEW_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3Q_SNAPSHOT_INTAKE_REVIEW_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3R_RUNTIME_ADOPTION_PREFLIGHT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3R_RUNTIME_ADOPTION_PREFLIGHT_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md)

## 1. 结论

Redacted real-data calibration 必须纳入 Business Advancement production query adoption 的同一前置包。

但它不是 production query implementation，也不能被 synthetic fixture、positive fixture 或 local development snapshot 替代。

当前状态是：

| 层 | 实现状态 | 真实证据状态 | 结论 |
| --- | --- | --- | --- |
| Ask Helm interaction calibration | evaluator / CLI / tests 已实现 | actual live redacted interaction evidence pending | 阻断 runtime adoption |
| Production query live DB calibration | Phase 3P → 3Q → 3R → 3S 工具链已实现 | actual `redacted_live_db_snapshot` pending | 阻断 production query adoption |

## 2. 目标

本 package 的目标是把“真实数据校准”从口头前置条件变成可审计 evidence bundle：

1. 明确 Ask Helm interaction 与 production query live DB 是两条不同 evidence line。
2. 任何一条缺失都不能进入 runtime adoption review。
3. 真实数据必须经过 redaction / intake / preflight / packet 链路。
4. 输出只能是 manual-review readiness，不是 production Go。

## 3. 非目标

本 package 明确不做：

- 不读取生产 DB，除非操作者显式提供 `DATABASE_URL`、真实 workspaceId 与 reference clock。
- 不用本地 DB 解锁 production readiness。
- 不把 positive fixture 写成真实证据。
- 不新增 schema、API、page、runtime adapter、queue 或 production query。
- 不创建 official write path。
- 不自动触发 approval、send、pay、execute、commit。

## 4. Evidence Lines

### 4.1 Ask Helm Interaction Evidence

要求：

| 条件 | 要求 |
| --- | --- |
| sample kind | `redacted_real_interaction_snapshot` |
| raw content | raw audio、unconfirmed transcript、PII、cross-workspace 内容不得进入 candidate |
| checks | 所有 redaction / privacy / boundary / dedupe checks 通过 |
| result | `realDataValidated=true` 且 `productionCalibrationComplete=true` |
| runtime | 仍为 `No-Go` |

### 4.2 Production Query Live DB Evidence

要求：

| 条件 | 要求 |
| --- | --- |
| sample kind | `redacted_live_db_snapshot` |
| collector | Phase 3P collector 输出 redacted producer-view rows |
| intake | Phase 3Q intake 通过，拒绝敏感 key 与 email 类字符串值 |
| preflight | Phase 3R `productionRuntimeAdoptionReviewReady=true` |
| packet | Phase 3S `productionRuntimeAdoptionReviewPacketReady=true` |
| runtime | 仍 `productionAdoptionAllowed=false` / `runtimeIntegrationAllowed=false` |

## 5. Safe Command Chain

当且仅当 Phase 3U 返回 `liveCalibrationReady=true`，才能执行：

```bash
DATABASE_URL='${DATABASE_URL}' npx tsx scripts/business-advancement-phase3p-redacted-snapshot-collector.ts \
  --workspace-id '${WORKSPACE_ID}' \
  --reference-clock-iso '<validated ISO datetime>' \
  --take '<validated integer>' \
  --print-json > /tmp/phase3p-snapshot.json

npx tsx scripts/business-advancement-phase3q-snapshot-intake-review.ts --input /tmp/phase3p-snapshot.json
npx tsx scripts/business-advancement-phase3r-runtime-adoption-preflight.ts --input /tmp/phase3p-snapshot.json
npx tsx scripts/business-advancement-phase3s-runtime-adoption-review-packet.ts --input /tmp/phase3p-snapshot.json
```

Phase 3U itself must remain no-DB-access and no-file-write.

## 6. Current Local Preflight Evidence

2026-04-27 本机核查：

```bash
npx tsx scripts/business-advancement-phase3u-live-calibration-unblock-preflight.ts \
  --reference-clock-iso 2026-04-27T00:00:00.000Z \
  --take 50
```

结果：

| 字段 | 值 |
| --- | --- |
| `liveCalibrationReady` | `false` |
| `productionAdoptionAllowed` | `false` |
| `runtimeIntegrationAllowed` | `false` |
| `dbAccessAttempted` | `false` |
| `filesWritten` | `false` |
| blockers | `DATABASE_URL` missing；workspaceId missing |

dummy workspace probe 也被正确拒绝：

```bash
npx tsx scripts/business-advancement-phase3u-live-calibration-unblock-preflight.ts \
  --workspace-id db-reachability-probe-only \
  --reference-clock-iso 2026-04-27T00:00:00.000Z \
  --take 50
```

结果仍为 No-Go，blockers 为 `DATABASE_URL` missing 与 dummy workspace rejected。

### 6.1 2026-04-30 Local DB Rehearsal Evidence

2026-04-30 复核时，当前配置的远端 dev/RDS 连接不可达：

```text
PrismaClientInitializationError: Can't reach configured remote database server
```

因此新增 Phase 3V local calibration rehearsal，用隔离本地库验证 Phase 3P → 3Q → 3R → 3S 工具链：

```bash
DATABASE_URL="${LOCAL_DATABASE_URL}" \
  DB_RESET_ALLOWLIST='helm2026_ba_calibration' \
  HELM_SKIP_EXTENSION_SQL=1 \
  npm run db:reset

DATABASE_URL="${LOCAL_DATABASE_URL}" \
  npm run business-advancement:phase3v-local-calibration-rehearsal -- \
  --reference-clock-iso '2026-04-30T00:00:00.000Z' \
  --take 100
```

结果：

| 字段 | 值 |
| --- | --- |
| `localRehearsalPassed` | `true` |
| `sampleKind` | `local_development_snapshot` |
| Phase 3Q intake | pass |
| Phase 3R | expected blocked |
| Phase 3S | expected No-Go |
| production / runtime | false / false |

注意：Phase 3V 只证明工具链可跑，并且安全地保持 blocked；它不能替代 `redacted_live_db_snapshot`，也不能解锁 production query adoption。

## 7. Package Completion Criteria

Redacted real-data calibration package 只有在以下全部成立时，才算完整：

1. Ask Helm interaction evidence line 通过 actual live redacted snapshot。
2. Production query live DB evidence line 通过 Phase 3P → 3Q → 3R → 3S。
3. 两条 evidence line 都明确 `runtimeAdoption=No-Go`。
4. Production query adoption plan 引用两条 evidence line。
5. Required reviewer approval record 绑定同一 plan version。
6. runtime adoption gate 最多返回 `Ready-For-Manual-Review`。

## 8. 当前四类状态

已经完整成立：

| 项 | 状态 |
| --- | --- |
| Ask Helm interaction calibration contract / evaluator / CLI / tests | Complete |
| Phase 3P / 3Q / 3R / 3S toolchain | Complete |
| Phase 3U no-DB preflight | Complete |

已成形但仍需下一层：

| 项 | 下一步 |
| --- | --- |
| Actual live redacted interaction evidence | 需要真实 redacted snapshot |
| Actual `redacted_live_db_snapshot` | 需要可用 `DATABASE_URL` 与真实 workspaceId |
| Manual production runtime adoption review | 需要 Phase 3S ready 后召开 |

刻意未做：

| 项 | 原因 |
| --- | --- |
| Local DB 替代 live DB | 防止 local fixture 误解锁 production readiness |
| 自动执行 safe command chain | 必须由 operator 显式提供参数并审查输出 |
| Production query implementation | 仍需独立实施计划与审批 |

风险项：

| 风险 | 控制 |
| --- | --- |
| 工具链 complete 被误读为真实 evidence complete | 本文件明确 evidence pending |
| dummy workspace 被误用 | Phase 3U 显式拒绝 |
| local DB 被误用为 production evidence | Phase 3P 标记 `local_development_snapshot`，Phase 3R/3S 阻断 |
