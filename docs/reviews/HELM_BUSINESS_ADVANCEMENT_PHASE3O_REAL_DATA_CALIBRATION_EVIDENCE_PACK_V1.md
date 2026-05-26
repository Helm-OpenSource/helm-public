---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3O — Real-Data Calibration Evidence Pack V1

**状态**: Phase 3O Evidence Contract Ready
**Runtime Adoption 姿态**: No-Go
**生产接入**: No-Go
**日期**: 2026-04-26

---

## 概述

Phase 3O 将 Phase 3N 之后唯一允许推进的方向收敛为一个确定性的真实数据校准证据包合同。它不接入生产查询，不读取 DB，不修改 `app/`、`data/queries.ts`、`prisma/schema.prisma`、`features/mobile/` 或任何写路径。

本工作树没有 `.env.local`，也没有提供脱敏真实 DB snapshot。因此 Phase 3O 当前只完成 **evidence contract framework**，不声明真实数据校准已经完成。

当前默认样本为 `synthetic_fixture`：

- `realDataValidated=false`
- `productionCalibrationComplete=false`
- `runtimeAdoptionPosture=No-Go`

---

## Phase 3O 做了什么

1. 定义 `phase3o-real-data-calibration-evidence-pack/v1` 证据合同。
2. 支持三类输入：`synthetic_fixture`、`local_development_snapshot` 与 `redacted_live_db_snapshot`。
3. 复用 Phase 3H 的纯 source functions，对 TPQR-001 / TPQR-003 / TPQR-004 做脱敏行校准判断。
4. 复用 Phase 3K 的 TPQR-001 72h conservative threshold。
5. 明确 redaction contract：不得包含客户名称、邮件正文、标题、原始邮箱、自由文本、secret 或 token。
6. 默认导出 synthetic sample 与 evaluation，用于证明合同内部有效但不代表真实数据通过。

---

## 校准门槛

| Family | 需要证明的校准条件 |
|---|---|
| TPQR-001 blocked decision | 至少 4 条脱敏行；stale no-review included；fresh excluded；already_in_review excluded；workspace mismatch excluded；使用 72h conservative threshold |
| TPQR-003 overdue commitment | 至少 4 条脱敏行；persistedOverdueFlag=false 仍可 included；persistedOverdueFlag=true 仍可 excluded；future dueDate 按 referenceClock 排除；terminal status 排除；workspace mismatch 排除 |
| TPQR-004 customer waiting | 至少 4 条脱敏行；CRM-linked included；generic duplicate 被 CRM-linked dedup 排除；generic-only included；workspace mismatch excluded；included emailThreadId 无重复 |

只有当输入为 `redacted_live_db_snapshot`，且三条 family 全部通过上述门槛时，才允许 `realDataValidated=true` 与 `productionCalibrationComplete=true`。

`local_development_snapshot` 只允许用于本地 schema / seed / collector 验证，不能满足 real-data calibration。

即使真实脱敏 snapshot 通过，runtime adoption 仍然是 **No-Go**；下一步只能进入 production runtime adoption review，不能直接 production adoption。

---

## 已经完整成立

| 项目 | 状态 | 说明 |
|---|---|---|
| Evidence contract | Complete | `Phase3oEvidencePackInput` / `Phase3oEvaluationResult` 已定义 |
| Default No-Go | Complete | 默认 synthetic sample 不会产生真实校准完成结论 |
| Explicit clock | Complete | TPQR-001 / TPQR-003 通过 `referenceClockMs` 注入 |
| TPQR-001 72h threshold | Complete | 使用 Phase 3K conservative threshold `259200000ms` |
| TPQR-003 overdueFlag non-authority | Complete | 校准要求覆盖 misleading true / false 两种情况 |
| TPQR-004 CRM-linked wins | Complete | 校准要求覆盖 CRM-linked、generic duplicate、generic-only、workspace mismatch |
| Redaction contract | Complete | 文档与代码均要求脱敏输入，不接收敏感文本 |

---

## 已成形但仍需下一层

| 项目 | 当前状态 | 下一步 |
|---|---|---|
| 真实 DB row 校准 | 未完成 | 提供脱敏 live DB snapshot 后运行 Phase 3O evaluator |
| Production runtime adoption review | 未开始 | 仅在真实脱敏 snapshot 全部通过后启动 |
| Function-to-DB seam adapter | 未实现 | 必须等真实校准通过并完成 runtime adoption review |
| Production capability registry | 未接入 | 不属于 Phase 3O；必须在 runtime adoption review 中单独评估 |

---

## 刻意未做

| 项目 | 理由 |
|---|---|
| DB 读取脚本 | 当前无 `.env.local` / live DB snapshot；本阶段不应伪造真实数据通过 |
| `data/queries.ts` 接入 | Runtime adoption No-Go |
| `app/` / `app/api/` 路由 | Runtime adoption No-Go |
| `prisma/schema.prisma` 变更 | 不需要新 schema |
| `features/mobile/` 接入 | Production read model adoption 尚未获批 |
| 写路径 / 自动执行路径 | 超出 evidence contract 范围 |

---

## 风险项

| 风险 | 严重度 | 控制 |
|---|---|---|
| 将 synthetic sample 误读成真实校准 | 高 | 代码强制 synthetic sample 下 `realDataValidated=false` |
| 脱敏不足导致敏感数据进入 repo | 高 | Phase 3O redaction contract 明确禁止敏感字段；真实 snapshot 不应直接落库为 repo fixture |
| 真实 snapshot 通过后被误认为可直接上线 | 高 | runtime adoption posture 永远保持 No-Go；只允许进入 production runtime adoption review |
| 真实 DB adapter 过早接入生产查询 | 中 | Phase 3O 不触碰 `data/queries.ts`、`app/`、mobile read model 或 Prisma schema |

---

## 验证结果

### Phase 3O Vitest

```
npx vitest run features/business-advancement/phase3o-real-data-calibration-evidence-pack.test.ts
→ 1 file / 51 tests PASS
```

### Phase 3O Script

```
npx tsx scripts/business-advancement-phase3o-real-data-calibration-evidence-pack.ts
→ CONTRACT CHECK COMPLETE: runtime adoption remains No-Go
```

### Business Advancement Full Vitest

```
npx vitest run features/business-advancement/*.test.ts
→ 29 files / 1111 tests PASS
```

### Typecheck

```
npm run typecheck
→ PASS
```

### Boundary Check

```
npm run check:boundaries
→ PASS
```

### Self Check

```
npm run self-check
→ 18 checks passed / 0 failed
```

---

## 结论

Phase 3O 完成的是 **真实数据校准证据合同**，不是生产接入。

当前状态：

- Evidence contract: Ready
- Real-data validation: Not completed
- Production calibration: Not completed
- Runtime adoption: No-Go

下一步必须先提供脱敏真实 DB snapshot，并通过 Phase 3O evaluator；通过后也只能进入 production runtime adoption review，不能直接上线。
