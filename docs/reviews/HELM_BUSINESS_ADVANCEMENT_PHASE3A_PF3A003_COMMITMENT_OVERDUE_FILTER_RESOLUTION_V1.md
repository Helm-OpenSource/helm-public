---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3A — PF3A-003 Commitment Overdue Filter Resolution V1

更新时间：2026-04-26
状态：Phase 3A / PF3A-003 commitment-overdue-filter resolution artifact / planning-only / runtime adoption not authorized
本阶段：解消 PF3A-003 留下的 Commitment overdue filter 安全规划问题，输出 deterministic 证据矩阵与保守的未来 thin read-model 过滤方向
上游：[HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md)
最终需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

---

## 声明

**本报告是 PF3A-003 的 planning-only resolution artifact，不是 runtime integration，也不是 thin read-model planning 的批准。**

它把 Phase 3 entry-gate preflight 中标记为 `conditional_requires_runtime_guard` 的 PF3-003（TPQR-003 / `overdue_commitment` overdue 启发式）转化为一份 deterministic 的 evidence matrix：列出当前仓库中 `Commitment.overdueFlag` 的 schema 定义、`deriveOverdueFlag` 派生 helper、写入路径、读取路径（区分 read-time 派生与持久化列读取）、以及 dueDate-crossing maintenance 路径的缺失情况，并据此给出未来 thin read-model overdue filter 的安全规划方向。

本报告 **明确不构成** 对以下任一项的批准：

- Prisma schema 变更（包括任何 dueDate-crossing maintenance 字段或 trigger）
- runtime extractor / event queue / background job 的引入
- API route / app page / data/queries.ts 的行为变更
- mobile / search / dashboard 任意 UI 表面的变更
- LLM final ranking
- official write、auto-send、auto-approval、auto-execute 的任何运行时授权
- production query adoption

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在每条 evidence 行的语义上都仍然是 `false`：本 artifact 只是规划证据。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Resolution artifact | `features/business-advancement/commitment-overdue-filter-resolution.ts` | 9 行 evidence 证据矩阵；每行含 evidenceId、filePath、evidenceLocator、evidenceKind、derivationKind、safetyAssessment、evidenceSummary、maintenanceProofForPersistedColumn、boundaryNotes |
| Resolution conclusion logic | `features/business-advancement/commitment-overdue-filter-resolution.ts :: deriveCommitmentOverdueFilterDecision` | 决定性结论函数，覆盖 `prefer_read_time_derivation` / `persisted_column_safe_with_maintenance_proof` / `blocked_no_maintenance_evidence` / `incomplete_evidence` 四种状态 |
| Resolution evaluator | `features/business-advancement/commitment-overdue-filter-resolution.ts :: evaluateCommitmentOverdueFilterResolution` | 10 项纯函数检查；全部通过 |
| Resolution tests | `features/business-advancement/commitment-overdue-filter-resolution.test.ts` | 26 个测试，全部通过；覆盖矩阵存在性、字段非空、evidenceId 唯一性、必备 repo-truth locator、persisted-column 不被错误标安全、maintenance_absence 加安全派生方向后才 prefer_read_time_derivation、planning note 不批准 runtime adoption、词表合法性、conclusion 行为 |
| Resolution CLI | `scripts/business-advancement-commitment-overdue-filter-resolution.ts` | 打印 evidence matrix、conclusion 与 eval checks；exit 0 on pass / 1 on fail；无 DB、无网络、无 schema 改动、无 write authority |
| 索引同步 | `docs/README.md` | 新增本报告条目 |

**当前 resolution 概览：**

| 指标 | 数值 |
| --- | --- |
| Total evidence rows | 9 |
| Persisted-column read rows | 2 |
| Read-time derivation rows | 1 |
| Maintenance-absence rows | 1 |
| Maintenance-proof rows | 0 |
| Eval checks | 10 / 10 全部通过 |
| Tests | 26 / 26 全部通过 |
| Final conclusion | `prefer_read_time_derivation` |
| Recommended future filter | `dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')` 或既有 `deriveOverdueFlag` read-time derivation |

### 1.1 Evidence matrix（按 evidenceKind 分组）

| evidenceKind | 行数 | 关键 evidenceId / 位置 |
| --- | --- | --- |
| `schema_definition` | 1 | `PF3A003-EV-001` / `prisma/schema.prisma:3929`（`overdueFlag Boolean @default(false)`） |
| `derive_helper` | 1 | `PF3A003-EV-002` / `lib/memory/shared.ts:254`（`deriveOverdueFlag`） |
| `write_path` | 2 | `PF3A003-EV-003` / `lib/memory/commitment.service.ts:112`（`createCommitment`），`PF3A003-EV-004` / `lib/memory/commitment.service.ts:194`（`updateCommitmentStatus`） |
| `read_time_derivation` | 1 | `PF3A003-EV-005` / `lib/memory/commitment.service.ts:72`（`getCommitments` 的 `overdueFlag: deriveOverdueFlag(row)`） |
| `persisted_column_read` | 2 | `PF3A003-EV-006` / `data/queries.ts:351`（`commitment.overdueFlag` 直读），`PF3A003-EV-007` / `features/meetings/queries.ts:437`（`overdueFlag: true` 直选） |
| `maintenance_absence` | 1 | `PF3A003-EV-008`（仓库范围搜索没有 cron / 调度 / 维护任务在 dueDate 跨过时刷新 `Commitment.overdueFlag`） |
| `filter_planning_note` | 1 | `PF3A003-EV-009`（未来 thin read-model overdue filter 必须采用 dueDate/status heuristic 或 `deriveOverdueFlag` read-time derivation，不得把持久化列作为唯一时间敏感过滤条件） |

### 1.2 关键证据：persisted column 与 dueDate-crossing maintenance 缺失

PF3A-003 的两条关键 finding：

1. **持久化列在两条非 `getCommitments` 路径上被直接读取**：
   - `data/queries.ts:351` 的 `hasIssuePressure` 计算从 `db.commitment.findMany`（`data/queries.ts:88, 246`）的结果直接读 `commitment.overdueFlag`，未经过 `getCommitments` / `deriveOverdueFlag`。
   - `features/meetings/queries.ts:437` 的 meetings 列表聚合 `select { id: true, overdueFlag: true }` 直接读取持久化列。
2. **没有任何 dueDate-crossing maintenance**：
   - 唯一的 `Commitment.overdueFlag` 写入路径只有 `createCommitment`（创建时一次性写入）与 `updateCommitmentStatus`（显式状态变更时写入）。
   - 仓库范围内的 cron、调度任务、维护任务（包括 `app/api/runtime/dingtalk/hourly-sync/route.ts`、`scripts/dingtalk-backfill-from-ingestion.ts`）都不触碰 `Commitment.overdueFlag`。
   - 因此：当 `dueDate` 在没有显式状态变更的情况下越过 NOW()，持久化列保持原值不变 — 它在时间维度上是 stale-by-design。

这两条证据共同决定了未来 thin read-model overdue filter **不能** 只依赖持久化 `Commitment.overdueFlag` 列；保守方向是 dueDate/status heuristic 或既有 `deriveOverdueFlag` read-time derivation。

### 1.3 Schema fact

`prisma/schema.prisma` model `Commitment` 第 3929 行：

```
overdueFlag          Boolean          @default(false)
```

该字段没有任何 `@updatedAt`-style 自动刷新机制；它只是一个普通的布尔列，仅在被显式 `db.commitment.update` 时变化。SQLite 影子 schema (`prisma/schema.sqlite.prisma:3729`) 行为相同。

### 1.4 Evaluator 强制条件（已通过）

`evaluateCommitmentOverdueFilterResolution` 强制执行：

1. `at_least_one_evidence_row` — 至少一行
2. `every_row_has_non_empty_evidence_and_boundary` — 每行 filePath / evidenceLocator / evidenceSummary / boundaryNotes 非空
3. `evidence_ids_are_unique` — `evidenceId` 唯一
4. `repo_truth_locators_cited` — 必须引用 `prisma/schema.prisma:3929`、`lib/memory/shared.ts:254`、`lib/memory/commitment.service.ts:72/112/194`、`data/queries.ts:351`、`features/meetings/queries.ts:437`
5. `boundary_notes_preserve_recommendation_explanation_draft_proof` — recommendation/explanation/draft/proof 四组区分齐全
6. `no_row_grants_runtime_schema_or_execution_authority` — 禁止任何授权 schema 设计、runtime extractor、event queue、official write、auto-send、auto-approval、LLM ranking、page 行为变更、API route 添加、production query adoption 的措辞
7. `persisted_column_reads_are_not_marked_safe_without_maintenance_proof` — `persisted_column_read` 行不得被标 `safe_for_time_sensitive_filter`，也不得自带 `maintenanceProofForPersistedColumn = true`
8. `maintenance_absence_plus_safe_direction_controls_conclusion` — 如有 maintenance proof，conclusion 必须是 `persisted_column_safe_with_maintenance_proof`；如有 maintenance absence 且同时存在 read-time derivation 或 dueDate/status planning direction，conclusion 必须是 `prefer_read_time_derivation`；如只有 maintenance absence 但没有安全派生方向，conclusion 必须阻断为 `blocked_no_safe_derivation_evidence`；两者都没有时必须是 `blocked_no_maintenance_evidence`
9. `planning_note_refuses_runtime_adoption` — 至少一行 `filter_planning_note`，且必须显式声明 "not authorize"、必须命名 dueDate/status heuristic 或 `deriveOverdueFlag`、必须禁止把持久化列作为唯一时间敏感过滤条件
10. `evidence_kinds_and_derivation_kinds_valid` — `evidenceKind` / `derivationKind` / `safetyAssessment` 取值在白名单内

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| 安全规划方向 | dueDate/status heuristic 或既有 `deriveOverdueFlag` read-time derivation 已锁定为未来 thin read-model overdue filter 的安全方向（planning-only） | 仍需在独立 thin read-model planning artifact 中：(a) 选定具体过滤表达式；(b) 校准 7d ownerUserId/updatedAt 阈值；(c) 验证 `getCommitments` 输出形状满足 thin read-model 输入要求 |
| `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 直读持久化列 | 已在矩阵中作为 evidence 行记录，并标记 `stale_by_design_for_time_sensitive_filter` | Phase 3A 不修改这两个文件；任何对它们的迁移（例如让它们改走 `getCommitments`）属于独立的读路径治理评审，不在本 artifact 范围内 |
| dueDate-crossing maintenance | `PF3A003-EV-008` 显式记录"无此 maintenance" | 任何引入 maintenance 的提议必须走单独 schema/maintenance review；本 artifact 不为之背书 |
| `persisted_column_safe_with_maintenance_proof` 分支 | 决定性结论函数已经为该分支定义；当前矩阵中无任何 maintenance proof 行可触发 | 仍需在另一份独立评审中：先证明 maintenance、再决定是否真的让持久化列承担时间敏感过滤；当前 artifact 不允许直接走该分支 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Phase 3A planning-only；`PF3A003-EV-001` 仅记录现状，不提议加列、加 trigger、加索引 |
| 任何 runtime 实现 / extractor / event queue / background job | 永久禁止；boundary notes 与 evaluator 共同守护 |
| `data/queries.ts` / `features/meetings/queries.ts` / `lib/memory/commitment.service.ts` 任何代码改动 | 范围严格限定在新建 4 个允许文件 |
| `app/` 任意 page、`app/api/` 任意 route、dashboard / mobile / search 表面 | Allowed write set 之外，本 artifact 不动 |
| `PLANS.md` 任何修改 | 任务明确禁止 |
| 重复脏文件（` 2.ts` / ` 2.tsx`）任何修改 | 与本任务无关；不动 |
| Maintenance 决议本身 | 任何 dueDate-crossing maintenance 的设计都属于单独 schema/maintenance review，刻意留给后续评审 |
| 自动写、自动发、自动审批、LLM final ranking | 永久禁止；不在 PF3A-003 内授权，不在任何 evidence 行措辞中授权 |
| 把 PF3A-002 / PF3A-004 / PF3A-005 拉进本 artifact | 它们由各自独立的 Phase 3A 解消子任务承担；PF3A-003 只解消 Commitment overdue filter |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读 PF3A-003 为 implementation-ready | 高 | 报告显式声明并由测试守护：每条 evidence 行 `maintenanceProofForPersistedColumn = false`；boundary notes 强制 recommendation/explanation/draft/proof 四组区分；`no_row_grants_runtime_schema_or_execution_authority` 检查覆盖任何 auto-write / auto-send / schema 授权措辞 |
| 误把持久化 `Commitment.overdueFlag` 列推进 thin read-model 唯一过滤条件 | 高 | `persisted_column_reads_are_not_marked_safe_without_maintenance_proof` 检查与 `planning_note_refuses_runtime_adoption` 双重守护；conclusion 在没有 maintenance proof 时强制返回 `prefer_read_time_derivation` |
| 未来引入 dueDate-crossing maintenance 而不走单独 schema/maintenance review | 中 | `PF3A003-EV-008` 与 `PF3A003-EV-009` 显式记录任何 maintenance path 是单独 schema/maintenance review；boundary notes 重申之 |
| `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 的直读持久化列在未来被错误地搬入 thin read-model | 中 | 矩阵行 `PF3A003-EV-006` 与 `PF3A003-EV-007` 显式标 `stale_by_design_for_time_sensitive_filter`；任何搬迁建议必须先经过独立读路径治理评审 |
| 把 `getCommitments` 的 read-time 派生当作"已经安全"的运行时保证而忽略调用方 | 中 | `PF3A003-EV-005` 把 read-time 派生标 `safe_for_time_sensitive_filter`，但仅在 `getCommitments` 调用边界内成立；未来 thin read-model 必须显式经由该边界或显式重用 `deriveOverdueFlag` |
| 报告被当作"批准下一步" | 高 | 报告与 artifact 都明确声明：本 artifact 不是 implementation-ready；任何 thin read-model planning、Prisma schema、API、page 行为、runtime adoption 必须在独立评审中重新批准 |

---

## 五、结论

- **conclusion**：`prefer_read_time_derivation`
- **reason**：仓库内没有任何 dueDate-crossing maintenance 路径；持久化 `Commitment.overdueFlag` 列在时间维度上是 stale-by-design；未来 thin read-model overdue filter 应当优先使用 dueDate/status heuristic 或既有 `deriveOverdueFlag` read-time derivation
- **recommendedFutureFilter**：`dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')`，或在 read 层重用既有 `deriveOverdueFlag` helper；不得把持久化 `Commitment.overdueFlag` 列作为唯一时间敏感过滤条件
- **residualBlockers**（保留为提醒，不视为本 artifact 失败）：
  - `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 仍直读持久化列，未来 thin read-model 不得复用该路径
  - `PF3A003-EV-008` 显式记录 maintenance 缺失；任何引入提议必须走单独 schema/maintenance review

**本 artifact 不批准** thin read-model planning、Prisma schema、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现。

---

## 六、验证结果

### 6.1 Vitest

```
npx vitest run features/business-advancement/commitment-overdue-filter-resolution.test.ts

 Test Files  1 passed (1)
      Tests  26 passed (26)
```

### 6.2 CLI

```
npx tsx scripts/business-advancement-commitment-overdue-filter-resolution.ts

Helm Business Advancement - Phase 3A / PF3A-003 Commitment Overdue Filter Resolution
================================================================================
Total rows:                  9
Persisted-column reads:      2
Read-time derivations:       1
Maintenance-absence rows:    1
Maintenance-proof rows:      0

Conclusion
--------------------------------------------------------------------------------
  conclusion:                prefer_read_time_derivation
  reason:                    No dueDate-crossing maintenance is proven in the current repo. ...
  recommendedFutureFilter:   dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED') ...

Eval Checks:
  PASS at_least_one_evidence_row
  PASS every_row_has_non_empty_evidence_and_boundary
  PASS evidence_ids_are_unique
  PASS repo_truth_locators_cited
  PASS boundary_notes_preserve_recommendation_explanation_draft_proof
  PASS no_row_grants_runtime_schema_or_execution_authority
  PASS persisted_column_reads_are_not_marked_safe_without_maintenance_proof
  PASS maintenance_absence_plus_safe_direction_controls_conclusion
  PASS planning_note_refuses_runtime_adoption
  PASS evidence_kinds_and_derivation_kinds_valid

10/10 checks passed
PF3A-003 commitment overdue filter resolution PASSED (planning-only artifact)
```

### 6.3 ESLint

```
npx eslint features/business-advancement/commitment-overdue-filter-resolution.ts \
  features/business-advancement/commitment-overdue-filter-resolution.test.ts \
  scripts/business-advancement-commitment-overdue-filter-resolution.ts

(0 errors, 0 warnings)
```

### 6.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/commitment-overdue-filter-resolution.ts \
  features/business-advancement/commitment-overdue-filter-resolution.test.ts \
  scripts/business-advancement-commitment-overdue-filter-resolution.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md \
  docs/README.md

(0 whitespace errors)
```

---

## 七、不视为 implementation-ready 的明示

**本 artifact 不是 runtime integration 的批准。**

在以下条件全部独立达成之前，不进入 thin read-model planning、runtime integration、Prisma schema 变更、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现：

1. 在独立 thin read-model planning artifact 中选定具体过滤表达式（dueDate/status heuristic 或经由 `deriveOverdueFlag`），并据真实数据校准 7d ownerUserId/updatedAt 阈值。
2. 任何 dueDate-crossing maintenance 的提议在独立 schema/maintenance review 中通过；当前 artifact 不为此背书。
3. `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 直读持久化列的搬迁建议（如有）在独立读路径治理评审中通过；当前 artifact 不修改这两个文件。
4. 上述三项独立评审通过后，方可评估进入 thin read-model planning（仍是 planning-only，不是 runtime adoption）。

---

## 八、下一阶段建议

1. **PF3A-004 ownership 选择**：继续在独立设计 memo 中确定 TPQR-004 与 `loadWaitingEmailThreads` 的 ownership rule 与 dedup-by-id 契约。
2. **PF3A-005 公式选定**：继续在独立 derivation memo 中选定 `derivedStaleDays` 单一来源与公式，并记录 `take: 2` 校准。
3. **完成 PF3A-002 / PF3A-003 / PF3A-004 / PF3A-005 四项独立评审后**，方可评估进入 thin read-model planning（仍是 planning-only，不是 runtime adoption）。

**未完成上述独立评审之前，不进入 runtime extractor、official write、auto execution、page 行为变更或 production query adoption。**
