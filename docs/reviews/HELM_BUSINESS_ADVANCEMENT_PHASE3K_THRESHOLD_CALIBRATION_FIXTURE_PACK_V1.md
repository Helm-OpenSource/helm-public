---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3K Threshold Calibration Fixture Pack V1

**日期**: 2026-04-26
**阶段**: Phase 3K — Threshold Calibration Fixture Pack
**规则版本**: `phase3k-threshold-calibration-fixtures/v1`
**Fixture Pack 姿态**: Conditional-Go
**Runtime Adoption 姿态**: No-Go
**实际业务数据校准完成**: 否

---

## 总结

Phase 3K 完成了对 TPQR-001 / TPQR-003 / TPQR-004 三个 threshold/audit 家族的合成 fixture 校准包。本阶段的工作边界是：**fixture-level calibration，不是 production calibration**。

- Fixture pack 姿态：**Conditional-Go** — fixture 结构、threshold 候选集、exclusion 场景、合成标注集均已建立并通过验证。
- Runtime adoption 姿态：**No-Go** — fixture 基于合成数据，未在真实 DB rows 上验证，无 function-to-DB seam，不允许进入任何 runtime path。

---

## Phase 3K 与前序阶段的关系

| 阶段 | 交付物 | 结论 |
|------|--------|------|
| Phase 3G | Source-query evidence audit | query shape 可行，runtime No-Go |
| Phase 3H | Named source function planning | 具名 source function，synthetic only，runtime No-Go |
| Phase 3I | Runtime source review | function 结构安全，threshold 未校准，runtime No-Go |
| Phase 3J | Disabled-by-default module plan | planning artifact，defaultEnabled=false，runtime No-Go |
| **Phase 3K** | **Threshold calibration fixture pack** | **fixture-level Conditional-Go，runtime No-Go** |

---

## 各家族变化说明

### TPQR-001：ActionItem blocked-before-review threshold fixture

**变化**：建立 24h / 48h / 72h 三候选合成校准集，确定 **72h 为保守 fixture default**。

- 24h 候选：合成 false-positive rate = 0.18（过激，容易误触正常审批节奏中的 ActionItem）
- 48h 候选：合成 false-positive rate = 0.09（适中，需真实数据验证后才可采用）
- 72h 候选：合成 false-positive rate = 0.04（保守，选为 fixture default，因误触 blocked-before-review 信号的代价更高）

**关键语义澄清**：TPQR-001 是 ActionItem **blocked-before-review threshold fixture**，不是逾期承诺判定。`approvalTask IS NULL` 是结构性 seam，`workspaceId` 匹配是必要条件，`approvalTask present` 场景必须排除。

**仍然阻塞**：threshold 从未在真实 DB rows 上校准，realDataValidated = false，productionCalibrationComplete = false。

---

### TPQR-003：Binary dueDate / referenceClock predicate fixture

**变化**：建立三场景二元谓词合成 fixture，明确 `persistedOverdueFlag` 不是权威来源。

- 无 dueDate → 不逾期
- dueDate 存在，referenceClock 在 dueDate 之前 → 不逾期
- dueDate 存在，referenceClock 在 dueDate 之后 → 逾期，二元谓词触发

**关键语义澄清**：`persistedOverdueFlag` **不是** overdue 判定的权威来源，判定依赖 explicit `referenceClock` 与 `dueDate` 的比较结果。所有场景的 `persistedOverdueFlagAuthority = false` 均已通过验证。

**仍然阻塞**：binaryPredicateValidated = true（合成），realDataValidated = false，productionCalibrationComplete = false。

---

### TPQR-004：WAITING_US CRM-linked / generic producer dedup fixture

**变化**：建立三场景 dual-producer dedup 合成 fixture，覆盖 CRM-linked + CRM-linked、CRM-linked + generic、generic + generic 三种组合。

- 所有场景均按 `emailThreadId` 去重为单条信号
- CRM-linked producer 在与 generic producer 共存时优先（CRM-linked wins）
- `stageName = WAITING_US` 是必要条件

**仍然阻塞**：dualProducerDedupValidated = true（合成），realDataValidated = false，productionCalibrationComplete = false。

---

## 合成 fixture vs 真实业务数据校准

本阶段的校准全部基于**合成标注数据集**（synthetic labelled scenarios），而非真实数据库中的业务数据。

| 维度 | 合成 fixture | 真实业务数据校准 |
|------|-------------|----------------|
| 数据来源 | 工程手工标注场景 | 真实 DB rows |
| 覆盖范围 | 已知边界场景 | 实际业务分布 |
| false-positive/negative rate | 合成数据上的估算 | 真实业务操作上的测量 |
| 完成状态 | **已完成** | **未开始** |

**不允许声称**: "production calibration complete" 或 "threshold validated on real data"。

---

## 已经完整成立

| 项目 | 状态 |
|------|------|
| TPQR-001 threshold 候选集覆盖 24h / 48h / 72h | 已成立 |
| TPQR-001 conservative fixture default = 72h | 已成立 |
| TPQR-001 72h 候选合成 false-positive rate < 0.1 | 已成立（0.04） |
| TPQR-001 workspace mismatch exclusion fixture | 已成立 |
| TPQR-001 approvalTask present exclusion fixture | 已成立 |
| TPQR-003 binary predicate 三场景合成验证 | 已成立 |
| TPQR-003 persistedOverdueFlag non-authority 所有场景通过 | 已成立 |
| TPQR-004 dual-producer dedup 三组合合成验证 | 已成立 |
| 所有家族 realDataValidated = false 显式标记 | 已成立 |
| 所有家族 productionCalibrationComplete = false 显式标记 | 已成立 |
| runtime adoption posture = No-Go 所有家族一致 | 已成立 |

---

## 已成形但仍需下一层

| 项目 | 缺失内容 |
|------|---------|
| TPQR-001 threshold 校准 | 需真实 DB rows 上的 false-positive/negative 测量 |
| TPQR-003 referenceClockMs source | 需 function-to-DB seam + 真实 dueDate 分布验证 |
| TPQR-004 emailThreadId dedup | 需 CRM-linked opportunityId seam 与真实 thread 分布验证 |
| 三条 family 的 feature flag seam | Phase 3L disabled-by-default internal seam prototype 才能建立 |

---

## 刻意未做

| 项目 | 原因 |
|------|------|
| function-to-DB seam 实现 | Phase 3L 范围，Phase 3K 不建立 |
| data/queries.ts 修改 | 未获批准 |
| runtime adoption 任何路径 | 当前 posture = No-Go |
| production threshold 调整 | 无真实数据校准依据 |
| schema / API / UI 修改 | 超出 fixture pack 范围 |
| 自动执行或 LLM final ranking | 超出当前阶段边界 |

---

## 风险项

| 风险 | 说明 |
|------|------|
| 合成校准率与真实业务分布的偏差 | 72h 的 0.04 合成 false-positive rate 不保证在真实数据上成立；真实业务中 ActionItem 的 review 节奏可能与合成场景显著不同 |
| referenceClock 源的时钟漂移 | TPQR-003 依赖 explicit referenceClockMs；生产环境中 referenceClockMs 的传入路径尚未建立，存在时钟漂移风险 |
| CRM-linked / generic producer 边界的实际判定 | TPQR-004 用 `opportunityId IS NOT NULL` 区分 CRM-linked；真实数据中存在 opportunityId 错误或缺失的情况，尚未在真实 rows 上验证 |
| Fixture-level Conditional-Go 被误读为 runtime Go | 需要严格区分 fixture pack posture 与 runtime adoption posture；两者当前不同 |

---

## 验证结果

### 验证命令与结果

```
npx vitest run features/business-advancement/phase3k-threshold-calibration-fixtures.test.ts
→ 41 tests, 0 failed

npx tsx scripts/business-advancement-phase3k-threshold-calibration-fixtures.ts
→ 10/10 CLI checks passed

npx eslint features/business-advancement/phase3k-threshold-calibration-fixtures.ts features/business-advancement/phase3k-threshold-calibration-fixtures.test.ts scripts/business-advancement-phase3k-threshold-calibration-fixtures.ts
→ clean

git diff --check
→ clean
```

### CLI 检查项（10/10）

| 检查项 | 结果 |
|--------|------|
| tpqr001_fixture_thresholds_cover_24_48_72 | PASS |
| tpqr001_conservative_default_is_72h | PASS |
| tpqr001_false_positive_guard_passes | PASS |
| tpqr003_binary_predicate_fixture_validated_without_persisted_flag | PASS |
| tpqr004_dual_producer_dedup_fixture_validated | PASS |
| all_families_real_data_validated_false | PASS |
| production_calibration_complete_false_for_all | PASS |
| runtime_adoption_posture_is_no_go | PASS |
| next_allowed_work_is_not_production_adoption | PASS |
| no_runtime_or_production_targets | PASS |

---

## 阻塞项清单

以下事项在 Phase 3K 完成后仍然阻塞：

1. **真实 DB rows 上的 threshold 校准**（三条 family 均未完成）
2. **function-to-DB seam 建立**（Phase 3L 范围）
3. **feature flag 实际接入 runtime**（Phase 3L 范围）
4. **runtime adoption**（No-Go 直至以上两项完成并通过独立评审）

---

## 下一步允许工作

仅允许以下之一：

1. **Phase 3L disabled-by-default internal seam prototype review** — 建立 function-to-DB seam 的受控内部原型，不进入 production runtime
2. **真实数据校准证据包** — 用真实 DB rows 重新测量 TPQR-001 / TPQR-003 / TPQR-004 的 false-positive/negative rate

**不允许**: 直接进入 production adoption、修改 data/queries.ts、修改 app/ 路由、UI 变更、automated execution。
