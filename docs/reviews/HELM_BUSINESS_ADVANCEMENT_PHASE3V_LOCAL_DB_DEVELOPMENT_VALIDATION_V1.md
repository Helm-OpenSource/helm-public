---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3V — Local DB Development Validation V1

**状态**: Phase 3V Local Development Validation
**Runtime Adoption 姿态**: No-Go
**生产接入**: No-Go
**日期**: 2026-04-26

---

## 概述

Phase 3V 记录在生产 DB 不可达时，使用本机隔离 MySQL 数据库验证 Business Advancement Phase 3P → 3Q → 3R → 3S 工具链的开发可用性。

本阶段的核心结论是：

- 本地 DB 可以用于 schema / migration / seed / collector / offline evaluator 的开发验证。
- 本地 DB 不能替代真实 live DB calibration。
- Phase 3P 已增加本地 DB 识别：当 `DATABASE_URL` 指向 `localhost` / `127.0.0.1` / `::1` 时，snapshot 自动标记为 `local_development_snapshot`。
- Phase 3R / 3S 必须继续阻断 `local_development_snapshot`，不得生成 production runtime adoption readiness。

---

## 本地验证环境

| 项目 | 结果 |
|---|---|
| 本地 MySQL client | 可用 |
| 本地 MySQL server | 可连接 |
| 隔离库 | `helm2026_ba_phase3_verify` |
| DB reset / migration | 成功 |
| Seed | 成功 |
| 业务行采集 | 仅用于本地开发验证 |
| 完整连接串 / 密码 | 未记录 |

本地 seed 后的最小读数：

| 表 | 计数 |
|---|---:|
| Workspace | 3 |
| ActionItem | 39 |
| Commitment | 46 |
| EmailThread | 14 |

---

## 代码层保护

本轮新增的保护：

1. Phase 3O `Phase3oSampleKind` 增加 `local_development_snapshot`。
2. Phase 3O 对 `local_development_snapshot` 永远返回 `realDataValidated=false` 与 `productionCalibrationComplete=false`。
3. Phase 3P 根据 DB host 自动判断 sample kind。
4. Phase 3P 本地 DB 输出 `local_development_snapshot`。
5. Phase 3U 对本地 DB host 返回 `liveCalibrationReady=false`。
6. Phase 3R / 3S 仍要求 `redacted_live_db_snapshot`，因此本地开发 snapshot 会被阻断。

---

## 本地链路验证结果

使用本地隔离库执行：

1. Phase 3P redacted snapshot collector
2. Phase 3Q snapshot intake review
3. Phase 3R runtime adoption preflight
4. Phase 3S runtime adoption review packet

结果：

| 阶段 | Exit | 结论 |
|---|---:|---|
| Phase 3P | 0 | 本地 snapshot 采集成功 |
| Phase 3Q | 0 | 脱敏输入接收成功 |
| Phase 3R | 2 | not-ready，正确阻断 |
| Phase 3S | 2 | packet not-ready，正确阻断 |

关键输出：

```json
{
  "sampleKind": "local_development_snapshot",
  "realDataValidated": false,
  "productionCalibrationComplete": false,
  "phase3rReady": false,
  "phase3sPacketReady": false,
  "productionAdoptionAllowed": false,
  "runtimeIntegrationAllowed": false
}
```

Phase 3R 的首要 blocker：

```text
sampleKind is "local_development_snapshot"; must be "redacted_live_db_snapshot" for production runtime adoption review.
```

---

## 验证命令

已通过：

```bash
npx vitest run \
  features/business-advancement/phase3o-real-data-calibration-evidence-pack.test.ts \
  features/business-advancement/phase3p-redacted-snapshot-collector.test.ts \
  features/business-advancement/phase3q-snapshot-intake-review.test.ts \
  features/business-advancement/phase3r-runtime-adoption-preflight.test.ts \
  features/business-advancement/phase3s-runtime-adoption-review-packet.test.ts \
  features/business-advancement/phase3u-live-calibration-unblock-preflight.test.ts

npx eslint \
  features/business-advancement/phase3o-real-data-calibration-evidence-pack.ts \
  features/business-advancement/phase3o-real-data-calibration-evidence-pack.test.ts \
  scripts/business-advancement-phase3p-redacted-snapshot-collector.ts \
  features/business-advancement/phase3p-redacted-snapshot-collector.test.ts \
  scripts/business-advancement-phase3u-live-calibration-unblock-preflight.ts \
  features/business-advancement/phase3u-live-calibration-unblock-preflight.test.ts

npm run typecheck
npm run check:boundaries
```

本地 DB 验证命令使用显式本地 `DATABASE_URL`，但本文档不记录完整连接串或密码。

---

## 刻意未做

| 未做项 | 原因 |
|---|---|
| 不把本地 snapshot 记作 `redacted_live_db_snapshot` | 防止本地数据误解锁 production review readiness |
| 不修改 `data/queries.ts` | runtime adoption 仍为 No-Go |
| 不修改 `app/` / API route | 未批准生产入口 |
| 不修改 `prisma/schema.prisma` | 只使用现有 schema 与 migration |
| 不接入 mobile read-model | 超出当前本地验证范围 |
| 不创建 official write path | 仍无执行授权 |
| 不做 auto-send / auto-approve / auto-execution | 始终禁止 |

---

## 当前结论

Phase 3V 证明：在生产 DB 不可达时，可以使用本地隔离 DB 推进开发验证；但本地验证结果只能证明工具链可运行，不能证明真实业务校准通过。

下一步仍然分两条线：

1. **开发线**：继续用本地隔离 DB 验证 collector、evaluator、preflight、review packet 的行为。
2. **生产校准线**：恢复生产 DB / 网络 / allowlist 或提供可用 live DB + real workspaceId，生成 `redacted_live_db_snapshot`，再进入 Phase 3Q → 3R → 3S。

Runtime adoption 继续 **No-Go**。
