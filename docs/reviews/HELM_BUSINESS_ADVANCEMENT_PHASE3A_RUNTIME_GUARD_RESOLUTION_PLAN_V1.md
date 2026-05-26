---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3A — Runtime Guard Resolution Plan V1

更新时间：2026-04-26
状态：Phase 3A guard resolution planning artifact / runtime adoption not started / not implementation-ready
本阶段：Runtime Guard Resolution Plan（PF3-002 / PF3-003 / PF3-004 / PF3-005 四个条件 guard 的解消规划）
上游报告：[HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md)
最终需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

---

## 声明

**Phase 3A 是 planning-only 桥接 artifact，不是 runtime integration。**

本报告把 Phase 3 entry-gate preflight 留下的四个 `conditional_requires_runtime_guard` 转化成具体的实现前置条件、证据要求、可接受的解消标准、停止条件与有序的下一步工作。

本阶段 **明确不进入** runtime integration。在每条 guard 的 `acceptedResolutionCriteria` 单独通过评审之前，**本 artifact 不构成对 thin read-model planning、Prisma schema、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现的批准。**

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在每条 guard 上都被强制为 `false`，并由测试守护。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Guard resolution artifact | `features/business-advancement/runtime-guard-resolution-plan.ts` | 4 行 guard 解消行，覆盖 PF3-002 至 PF3-005；每行含 guardId、sourcePhase3CheckId、currentStatus、resolutionClass、evidenceToCollect、acceptedResolutionCriteria、stopConditions、nextWorkOrder、`runtimeImplementationAllowed: false`、`schemaChangeAllowed: false`、boundaryNotes |
| Guard resolution evaluator | `features/business-advancement/runtime-guard-resolution-plan.ts :: evaluateRuntimeGuardResolutionPlan` | 9 项纯函数检查；全部通过 |
| Guard resolution tests | `features/business-advancement/runtime-guard-resolution-plan.test.ts` | 23 个测试，全部通过；覆盖 4 行存在性与唯一性、PF3-001 被刻意排除、字段非空、runtime/schema 旗标皆为 false、PF3A-003 仓库真相、禁止授权模式、边界声明完整、resolutionClass 词表 |
| Guard resolution CLI | `scripts/business-advancement-runtime-guard-resolution-plan.ts` | 打印 guard 解消摘要；exit 0 on pass / 1 on fail；无 DB、无网络、无 schema 改动、无 write authority |
| 索引同步 | `docs/README.md` | 新增本报告条目 |

**当前 guard resolution 概览：**

| Guard ID | Resolves | Resolution Class | Runtime Allowed | Schema Allowed |
| --- | --- | --- | --- | --- |
| PF3A-002 | PF3-002 (TPQR-002 / stalled_opportunity) | `requires_source_audit` | `false` | `false` |
| PF3A-003 | PF3-003 (TPQR-003 / overdue_commitment) | `requires_separate_schema_review` | `false` | `false` |
| PF3A-004 | PF3-004 (TPQR-004 / customer_waiting) | `requires_dedup_design` | `false` | `false` |
| PF3A-005 | PF3-005 (TPQR-005 / stalled_case) | `requires_readout_derivation_design` | `false` | `false` |

**PF3-001 被刻意排除**：Phase 3 preflight 已将其判定为 `ready_for_thin_read_model_planning`，不需要 Phase 3A guard 解消。

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| PF3A-002 source audit | 证据要求、可接受标准、停止条件、下一步均已定义 | 仍需运行 source audit 工作流：盘点所有 Opportunity.updatedAt 写入路径与 CRM sync job，输出 human/system/mixed writer-source matrix |
| PF3A-003 dueDate-crossing maintenance | 仓库真相已重述（overdueFlag 已 actively defined / derived / written / read），安全规划方向已记录（dueDate/status heuristic 或既有 deriveOverdueFlag read-time derivation） | 仍需在另一轮独立评审中确认是否需要任何 dueDate-crossing maintenance path；若需要，必须走单独 schema/maintenance review，而不是继续在 Phase 3A 范围内扩张 |
| PF3A-004 dedup design | 证据要求、可接受标准、停止条件、下一步均已定义；两条候选 ownership rule 已列出 | 仍需选定其中一条 ownership rule（TPQR-004 独占 vs. merge-and-dedup-by-id），并把 deduplication contract 落到设计 memo |
| PF3A-005 derivation design | 证据要求、可接受标准、停止条件、下一步均已定义；三个候选时间戳来源已列出 | 仍需选定 derivedStaleDays 公式与单一来源字段，并记录 take: 2 noise guard 校准说明；surfacing on TenantResourceOperatingImpactItem 是单独 type-surface review |
| 整体 Phase 3A | 4 个 guard 解消行 + 评估器 + 测试 + CLI + 报告 + 索引同步均成立 | **本 artifact 不构成对 thin read-model planning、runtime integration、schema、API、page 行为变更的批准**；上述四条 guard 的 `acceptedResolutionCriteria` 必须分别在独立评审中通过后才能继续推进 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Phase 3A 是 planning-only；`schemaChangeAllowed` 在每行强制为 `false` |
| 任何 runtime 实现 | `runtimeImplementationAllowed` 在每行强制为 `false`；不引入 extractor、event queue、background job |
| 任何 route / page / data/queries.ts / 邮件读取面 / 移动端面板 / 搜索 UI 变更 | 范围严格限定在新建 4 个允许文件 |
| Source audit 本身 | PF3A-002 描述了 audit 要做什么、什么时候停、产出什么；audit 本身仍需另起 |
| dueDate-crossing maintenance 决策 | PF3A-003 把任何此类 maintenance path 显式归类为单独 schema/maintenance review，不在 Phase 3A 内决议 |
| Dedup ownership 选择 | PF3A-004 列出两条候选 ownership rule，但选择动作留给后续设计 memo |
| derivedStaleDays 选源 | PF3A-005 列出三个候选 timestamp source，但选择留给后续 derivation memo |
| 自动写、自动发、自动审批、LLM final ranking | 永久禁止；不在 Phase 3A 内授权，不在任何 guard 解消条件中授权 |
| 把 PF3-001 拉进 Phase 3A | PF3-001 已 `ready_for_thin_read_model_planning`，无需 guard 解消；Phase 3A 刻意把它排除并由测试守护 |
| 修改任意 mobile / search 重复脏文件（` 2.ts` / ` 2.tsx`） | 与本任务无关；不动 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读 Phase 3A 为 implementation-ready | 高 | 报告显式声明并由测试守护：`runtimeImplementationAllowed` / `schemaChangeAllowed` 在每行皆为 `false`；每行 boundary notes 强制保留 recommendation/explanation/draft/proof 四组区分 |
| PF3A-002 audit 落空（找不到所有 writer） | 中 | `stopConditions` 明确：审计若无法穷举所有 Opportunity.updatedAt 写入路径，必须保留 PF3A-002 为 conditional 状态 |
| PF3A-003 被错误地用旧版 outdated 措辞复述 | 中 | 测试守护：`zero matches` / `no matches` / `no typescript references` / `not maintained` / `never written` / `schema-only` 等措辞在 PF3A-003 文本中出现即测试失败；正向用例要求显式引用 lib/memory/shared.ts:254、lib/memory/commitment.service.ts:72/112/194、data/queries.ts:351、features/meetings/queries.ts:437 |
| PF3A-003 被错误地推动到 schema 维护 | 中 | `resolutionClass: requires_separate_schema_review` 显式把 maintenance path 归类为 Phase 3A 范围外；boundary notes 重申"任何 maintenance path 是单独 schema/maintenance review" |
| PF3A-004 同一 emailThread.id 双展示 | 中 | `acceptedResolutionCriteria` 写入"单一 emailThread.id MUST NOT 在 TPQR-004 与 loadWaitingEmailThreads 同次渲染中同时出现" |
| PF3A-005 derivedStaleDays 选源失误 | 中 | `acceptedResolutionCriteria` 要求选定的来源必须反映 human-meaningful staleness 而非 automated sync timing；`stopConditions` 在没有候选源能被自信标注 human-meaningful 时停止 |
| 报告被当作"批准下一步" | 高 | 报告与 artifact 都明确声明：本 artifact 不是 implementation-ready；任何 thin read-model planning、Prisma schema、API、page 行为、runtime adoption 必须在四条 guard 的 acceptedResolutionCriteria 单独评审通过后才允许 |

---

## 五、Phase 3A 行级摘要

### 5.1 PF3A-002 — Opportunity.updatedAt source audit

- `resolutionClass`：`requires_source_audit`
- 解消方向：盘点所有 `Opportunity.updatedAt` 写入路径与 CRM sync job，输出 human/system/mixed writer-source matrix
- 关键停止条件：审计无法穷举所有写入路径时保持 conditional；提议 backfill / 数据修整时停止改走独立变更评审
- Phase 3A **不**批准新增 `lastHumanActivityAt` 字段或 sync-write-exempt flag——若有必要，须独立 schema review

### 5.2 PF3A-003 — overdueFlag dueDate-crossing maintenance

- `resolutionClass`：`requires_separate_schema_review`
- 仓库真相（不得反复述）：`overdueFlag` 在 TypeScript 中已 actively defined / derived / written / read：
  - `lib/memory/shared.ts:254` 定义 `deriveOverdueFlag`
  - `lib/memory/commitment.service.ts:72` 在 `getCommitments` 中读时 `overdueFlag: deriveOverdueFlag(row)`
  - `lib/memory/commitment.service.ts:112` 在 `createCommitment` 中写入
  - `lib/memory/commitment.service.ts:194` 在 `updateCommitmentStatus` 中写入
  - `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 读取
- 安全 query-planning 方向：使用 `dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')` heuristic 或既有 `deriveOverdueFlag` read-time derivation，不把持久化 `Commitment.overdueFlag` 列作为唯一时间敏感过滤条件
- Phase 3A **不**批准 dueDate-crossing maintenance path；任何此类 maintenance 必须独立 schema/maintenance review

### 5.3 PF3A-004 — emailThread.id dedup design

- `resolutionClass`：`requires_dedup_design`
- 解消方向：在 TPQR-004 与 `loadWaitingEmailThreads` 之间确定 ownership 与 dedup 契约
- 两条候选 ownership rule：
  - (a) TPQR-004 独占 `opportunityId IS NOT NULL` 线程
  - (b) 在两路径之后做 merge-and-dedup-by-id
- 关键停止条件：dedup 设计若需要新 schema 字段或 status migration，立即停下改走独立 schema review；任何修改 `features/mobile/lib/mobile-command-read-model.ts` 或 UI surface 的提议在 Phase 3A 范围外

### 5.4 PF3A-005 — derivedStaleDays derivation design

- `resolutionClass`：`requires_readout_derivation_design`
- 三个候选 timestamp source（来自 `lib/tenant-resources/workspace-operating-impact-query.ts`）：
  - `connector.lastSyncedAt`
  - `importSource.updatedAt`
  - `importJob.finishedAt`
- 解消方向：选定单一来源并写出 `derivedStaleDays` 公式；要求来源反映 human-meaningful staleness 而非 automated sync timing
- Phase 3A **不**批准修改 `TenantResourceOperatingImpactItem` 类型或 readout 查询；surfacing 为单独 type-surface review

---

## 六、验证结果

### 6.1 Vitest

```
npx vitest run features/business-advancement/runtime-guard-resolution-plan.test.ts

 Test Files  1 passed (1)
      Tests  23 passed (23)
```

### 6.2 CLI

```
npx tsx scripts/business-advancement-runtime-guard-resolution-plan.ts

Helm Business Advancement — Phase 3A Runtime Guard Resolution Plan
================================================================================
Guard rows:  4

PF3A-002  [resolves PF3-002]
  Status:                       conditional_requires_runtime_guard
  Resolution class:             requires_source_audit
  Runtime implementation:       false (planning-only)
  Schema change:                false (planning-only)
  Evidence to collect:          4 item(s)
  Accepted resolution criteria: 4 item(s)
  Stop conditions:              3 item(s)
  Next work order:              4 step(s)
  Boundary notes:               5 item(s)

PF3A-003  [resolves PF3-003]
  Status:                       conditional_requires_runtime_guard
  Resolution class:             requires_separate_schema_review
  Runtime implementation:       false (planning-only)
  Schema change:                false (planning-only)
  Evidence to collect:          4 item(s)
  Accepted resolution criteria: 4 item(s)
  Stop conditions:              3 item(s)
  Next work order:              4 step(s)
  Boundary notes:               6 item(s)

PF3A-004  [resolves PF3-004]
  Status:                       conditional_requires_runtime_guard
  Resolution class:             requires_dedup_design
  Runtime implementation:       false (planning-only)
  Schema change:                false (planning-only)
  Evidence to collect:          4 item(s)
  Accepted resolution criteria: 4 item(s)
  Stop conditions:              3 item(s)
  Next work order:              4 step(s)
  Boundary notes:               5 item(s)

PF3A-005  [resolves PF3-005]
  Status:                       conditional_requires_runtime_guard
  Resolution class:             requires_readout_derivation_design
  Runtime implementation:       false (planning-only)
  Schema change:                false (planning-only)
  Evidence to collect:          4 item(s)
  Accepted resolution criteria: 4 item(s)
  Stop conditions:              3 item(s)
  Next work order:              4 step(s)
  Boundary notes:               5 item(s)

Eval Checks:
  PASS exactly_four_guard_rows
  PASS all_conditional_guards_covered_exactly_once
  PASS pf3_001_intentionally_excluded
  PASS all_rows_have_non_empty_content
  PASS runtime_and_schema_flags_false_for_all
  PASS pf3a_003_uses_corrected_repo_truth
  PASS no_forbidden_authorization_patterns
  PASS boundary_notes_preserve_distinctions
  PASS resolution_classes_valid

9/9 checks passed
Phase 3A runtime guard resolution plan PASSED (planning-only)
```

### 6.3 ESLint

```
npx eslint features/business-advancement/runtime-guard-resolution-plan.ts \
  features/business-advancement/runtime-guard-resolution-plan.test.ts \
  scripts/business-advancement-runtime-guard-resolution-plan.ts

(0 errors, 0 warnings)
```

### 6.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/runtime-guard-resolution-plan.ts \
  features/business-advancement/runtime-guard-resolution-plan.test.ts \
  scripts/business-advancement-runtime-guard-resolution-plan.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md \
  docs/README.md

(0 whitespace errors)
```

---

## 七、不视为 implementation-ready 的明示

**本 artifact 不是 runtime integration 的批准。**

在以下条件全部独立达成之前，不进入 thin read-model planning、runtime integration、Prisma schema 变更、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现：

1. **PF3A-002**：完成 `Opportunity.updatedAt` 写入路径全量审计，输出 writer-source matrix，并据此明确判断 staleness 启发式是否安全。
2. **PF3A-003**：在 Phase 3A 范围**外**完成 dueDate-crossing maintenance 决议；安全 query-planning 方向（dueDate/status heuristic 或既有 `deriveOverdueFlag` read-time derivation）已被分别评审接受；7 天 ownerUserId/updatedAt 阈值已据真实数据校准。
3. **PF3A-004**：选定 ownership rule 与 dedup-by-emailThread.id 契约；任何对 `loadWaitingEmailThreads`、`features/mobile/lib/mobile-command-read-model.ts` 或 UI surface 的修改必须独立评审。
4. **PF3A-005**：选定 `derivedStaleDays` 单一来源与公式；surfacing on `TenantResourceOperatingImpactItem` 必须独立 type-surface review；`take: 2` 噪声 guard 校准已落到设计 memo。

任一条件未达成时，对应 guard 维持 `conditional_requires_runtime_guard` 不变。

---

## 八、下一阶段建议

1. **PF3A-002 source audit 执行**：在独立评审单元中完成 Opportunity.updatedAt 写入路径全量盘点，输出 writer-source matrix 与 heuristic 安全判定。
2. **PF3A-003 决议**：在独立评审单元中确认是否需要任何 dueDate-crossing maintenance；不需要时把 dueDate/status heuristic 或既有 deriveOverdueFlag read-time derivation 落为安全规划方向。
3. **PF3A-004 ownership 选择**：在独立设计 memo 中确定 TPQR-004 与 loadWaitingEmailThreads 的 ownership rule 与 dedup-by-id 契约。
4. **PF3A-005 公式选定**：在独立 derivation memo 中选定 derivedStaleDays 单一来源与公式，并记录 take: 2 校准。
5. **完成上述四项独立评审后**，方可评估进入 thin read-model planning（仍是 planning-only，不是 runtime adoption）。

**未完成上述四项独立评审之前，不进入 runtime extractor、official write、auto execution、page 行为变更或 production query adoption。**
