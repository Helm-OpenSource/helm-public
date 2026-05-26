---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3L Disabled Seam Prototype Review V1

**日期**: 2026-04-26
**阶段**: Phase 3L — Disabled Seam Prototype Review
**规则版本**: `phase3l-disabled-seam-prototype-review/v1`
**Seam Prototype Review 姿态**: Conditional-Go
**Runtime Adoption 姿态**: No-Go
**实际业务数据校准完成**: 否

---

## 执行摘要

Phase 3L 完成。本阶段对 TPQR-001 / TPQR-003 / TPQR-004 三条 disabled-by-default seam plan 进行独立 seam prototype review，验证每条 family 的接缝形状在结构上可行、语义上无歧义、治理边界明确。Seam prototype review 姿态为 **Conditional-Go**，runtime adoption 姿态维持 **No-Go**。

Phase 3L **不是**实现层（implementation layer）。没有任何 DB query 被执行、没有任何 production integration 被启用、没有任何 persistedOverdueFlag 被写入、没有任何 emailThreadId 被消费。本阶段产出的是对三条 seam plan 的接缝语义正确性审核，为 Phase 3M 的 disabled-by-default internal seam prototype implementation 奠定充分但受控的前提。

---

## 为什么这仍然不是实现

| 维度 | Phase 3L 完成了什么 | Phase 3L 没有做什么 |
|------|-------------------|-------------------|
| 接缝形状 | 审核三条 family 的 seam plan 接缝语义、边界、互斥条件 | 无任何可执行 DB query |
| 治理边界 | 验证 feature flag defaultEnabled=false 结构 | 无 productionIntegrationAllowed=true |
| 覆盖范围 | 合成行 + 合成 fixture，全量 audit bundle 字段定义 | 未对任何真实 DB rows 运行 |
| 校准状态 | 合成 threshold fixture（Phase 3K 完成） | 真实业务数据校准未完成 |
| 下一步入口 | 为 Phase 3M seam prototype implementation 提供 Conditional-Go | 不授权 runtime adoption |

接缝审核通过意味着：接缝在结构层面是对的，但结构正确不等于业务校准通过，不等于真实数据安全，不等于可以启用 production integration。

---

## TPQR-001：ActionItem approvalTask 缺失接缝

**接缝语义**：`approvalTask IS NULL` 作为 blocked decision candidate 的核心谓词。当 ActionItem 没有关联 approvalTask 时，视为缺少正式决策路径，进入候选集。

**接缝边界**：
- `approvalTask IS NULL` 与现有 pending approval queue（`approvalTask IS NOT NULL`）严格互斥，不存在重叠
- staleness threshold 为 `stalenessThresholdMs`（合成 default = 72h，calibration_placeholder blocker 未解除）
- workspace 范围隔离：所有候选必须属于同一 workspaceId，不存在跨 workspace 泄漏

**接缝 blocker（仍未解除）**：
- function-to-DB seam 未建立（无实际 WHERE clause 执行记录）
- threshold 未经真实业务数据校准（72h 为合成保守值）
- productionIntegrationAllowed 维持 false

---

## TPQR-003：explicit referenceClock / no persistedOverdueFlag authority 接缝

**接缝语义**：overdue 判断必须使用显式传入的 `referenceClockMs`，不得依赖 `persistedOverdueFlag`。`persistedOverdueFlag` 对 overdue 判断无权威性（non-authority），系统不读取、不写入、不依赖该字段做决策。

**接缝边界**：
- `referenceClockMs` 必须显式注入，不允许 `Date.now()` 隐式调用
- `persistedOverdueFlag` non-authority 在三场景二元谓词 fixture 中全部通过（Phase 3K 验证）
- binary_predicate_unresolved blocker 仍存在：`overdueMs > threshold` 的 threshold 未经真实数据校准

**接缝 blocker（仍未解除）**：
- binary_predicate_unresolved：threshold 为合成值，真实业务数据分布未知
- function-to-DB seam 未建立

---

## TPQR-004：dual producer emailThreadId dedup 接缝

**接缝语义**：emailThread candidate 有两条 producer 路径：CRM-linked producer（有 crmOpportunityId）与 generic producer（无 crmOpportunityId）。两条路径在 after-producer dedup 层归一，以 `emailThreadId` 为 dedup key，确保同一 thread 不被重复推入候选集。

**接缝边界**：
- CRM-linked producer 与 generic producer 互不排斥，同一 thread 可同时被两条路径命中，但 dedup 层保证候选集唯一
- after-producer dedup 必须发生在 source function 内部，不可下沉到调用方
- binary_predicate_unresolved blocker 仍存在：staleness threshold 未经真实数据校准

**接缝 blocker（仍未解除）**：
- binary_predicate_unresolved：dual-producer threshold 为合成值
- function-to-DB seam 未建立

---

## 状态表

### 已经完整成立

| 项目 | 说明 |
|------|------|
| approvalTask IS NULL 互斥性 | 与现有 pending queue 严格互斥，Phase 3I / 3L 均已验证 |
| persistedOverdueFlag non-authority | 三场景二元谓词 fixture 全部通过，non-authority 证明成立 |
| referenceClockMs 显式注入规范 | 所有 source function 均使用显式 clock，无隐式 Date.now() |
| after-producer dedup 结构 | emailThreadId dedup 在 source function 内完成，结构正确 |
| feature flag defaultEnabled=false 结构 | 三条 family 均已在 seam plan 中声明 |
| workspace 范围隔离 | 所有 candidate 均含 workspaceId 约束，无跨 workspace 泄漏 |
| 合成 threshold fixture pack | Phase 3K 完成，72h / binary_predicate 合成保守值已建立 |

### 已成形但仍需下一层

| 项目 | 缺什么 | 下一层 |
|------|--------|--------|
| function-to-DB seam | 无实际 WHERE clause 执行记录，仅 plan-level 文本描述 | Phase 3M seam prototype implementation |
| threshold 校准 | 合成保守值，未经真实业务数据分布验证 | 真实数据校准证据包 |
| binary_predicate_unresolved | TPQR-003 / TPQR-004 threshold 未验证 | Phase 3M + 真实数据 |
| audit bundle 字段完整性 | 字段已定义，但未在真实 query 中验证返回 | Phase 3M integration test |

### 刻意未做

| 项目 | 原因 |
|------|------|
| productionIntegrationAllowed=true | 未完成真实数据校准，runtime adoption No-Go 维持 |
| 任何真实 DB query 执行 | seam prototype review 阶段不触碰 DB，防止误入 production path |
| persistedOverdueFlag 写入 | non-authority 原则：系统不写入、不读取该字段做决策 |
| app/ / data/queries.ts / prisma schema 修改 | 受控边界，feature-only 文件约束 |
| runtime adoption 授权 | 多层 blocker 未解除（calibration_placeholder / binary_predicate_unresolved / function-to-DB seam） |

### 风险项

| 风险 | 级别 | 缓解 |
|------|------|------|
| 合成 threshold 偏离真实业务分布 | 中 | Phase 3M 前必须完成真实数据校准证据包 |
| function-to-DB seam 建立后暴露 schema drift | 中 | Phase 3M 需对 ActionItem / Commitment / EmailThread 表结构做独立 schema review |
| dual-producer dedup 在高并发场景失效 | 低-中 | after-producer dedup 为 in-memory set，production 场景需持久化 dedup 或幂等写入 |
| calibration_placeholder blocker 被绕过 | 低 | Phase 3M 门控：blocker 必须显式解除，不允许以"合成通过"替代真实校准 |

---

## Phase 3M 条件

Phase 3M 为 **disabled-by-default internal seam prototype implementation**，仅在以下全部条件满足时允许启动：

1. **文件范围**：仅修改 `features/business-advancement/` 下的 feature-only 文件，不触碰 `app/`、`data/queries.ts`、`prisma/`、`lib/` 核心模块
2. **productionIntegrationAllowed**：Phase 3M 内维持 false，不得改为 true
3. **function-to-DB seam 建立**：必须在 feature-only 文件中建立可测试的 seam，包含实际 WHERE clause shape（仍为合成行，不对生产 DB 执行）
4. **threshold blocker 处理**：要么提供真实业务数据校准证据包（解除 calibration_placeholder），要么在 Phase 3M 中明确标注 threshold 仍为合成保守值并维持 blocker
5. **测试覆盖**：function-to-DB seam 相关路径需有独立 vitest test 覆盖
6. **runtime adoption**：Phase 3M 完成后仍需独立 runtime adoption review，Phase 3M 本身不授权 runtime adoption

Phase 3M 允许的另一条路径：**真实数据校准证据包 only**（不触碰 implementation），专门解除 calibration_placeholder / binary_predicate_unresolved blockers。

---

## 验证结果

### 测试

```
npx vitest run features/business-advancement/phase3l-disabled-seam-prototype-review.test.ts
```

**结果**: 28 tests passed, 0 failed

### CLI Evaluator Checks

```
npx tsx scripts/business-advancement-phase3l-disabled-seam-prototype-review.ts
```

**结果**: 12/12 checks passed

### ESLint

```
npx eslint features/business-advancement/phase3l-disabled-seam-prototype-review.ts features/business-advancement/phase3l-disabled-seam-prototype-review.test.ts scripts/business-advancement-phase3l-disabled-seam-prototype-review.ts
```

**结果**: 0 warnings, 0 errors (clean)

### Git Diff Check

```
git diff --check
```

**结果**: clean。文件范围仅含 Phase 3L feature/test/script、review 文档和 `docs/README.md` 索引，未触碰 `app/`、`data/queries.ts`、`prisma/`、`lib/` 核心模块。

---

## 结论

Phase 3L 完成。TPQR-001 / TPQR-003 / TPQR-004 三条 seam plan 的接缝语义正确性审核通过，seam prototype review 姿态为 **Conditional-Go**。Runtime adoption 维持 **No-Go**，多层 blocker 未解除。下一步唯一允许工作为 Phase 3M disabled-by-default internal seam prototype implementation（feature-only 文件）或真实数据校准证据包，不允许 production adoption。
