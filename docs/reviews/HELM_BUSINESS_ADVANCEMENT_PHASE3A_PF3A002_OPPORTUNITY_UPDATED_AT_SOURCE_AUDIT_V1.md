---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 3A — PF3A-002 Opportunity.updatedAt Source Audit V1

更新时间：2026-04-26
状态：Phase 3A / PF3A-002 source-audit artifact / planning-only / runtime adoption not authorized
本阶段：完成 PF3A-002 的 source audit 工作流，输出 deterministic writer-source matrix 与保守的 staleness heuristic 安全判定
上游：[HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md)
最终需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

---

## 声明

**本报告是 PF3A-002 的 source-audit artifact，不是 runtime integration，也不是 thin read-model planning 的批准。**

它把 Phase 3 entry-gate preflight 中标记为 `conditional_requires_runtime_guard` 的 PF3-002（TPQR-002 / `stalled_opportunity` 14d staleness 启发式）转化为一份 deterministic 的 writer-source matrix：列出当前仓库中已发现的 application/runtime 与 operator-run 非测试代码路径中，可能 create / update / upsert / 间接修改 `Opportunity` 行的路径，并按 schema fact `updatedAt DateTime @updatedAt`（`prisma/schema.prisma` model `Opportunity`）判断哪些路径会通过 Prisma 自动 bump `Opportunity.updatedAt`。`prisma/seed.ts` 与测试 fixture writer 不进入本审计范围，因为它们不影响生产 staleness 语义。

本报告 **明确不构成** 对以下任一项的批准：

- Prisma schema 变更（包括 `lastHumanActivityAt`、sync-write-exempt flag 等任何新字段）
- runtime extractor / event queue / background job 的引入
- API route / app page / data/queries.ts 的行为变更
- mobile / search / dashboard 任意 UI 表面的变更
- LLM final ranking
- official write、auto-send、auto-approval、auto-execute 的任何运行时授权
- production query adoption

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在每条 audit 行的语义上都仍然是 `false`：本 artifact 只是审计证据。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Source audit artifact | `features/business-advancement/opportunity-updated-at-source-audit.ts` | 30 行 audit row（25 个 writer + 5 个 read-only reference）；每行含 writerId、filePath、evidenceLocator、operationKind、sourceClass、touchesOpportunityRows、updatedAtBehavior、stalenessHeuristicImpact、evidenceSummary、boundaryNotes |
| Audit conclusion logic | `features/business-advancement/opportunity-updated-at-source-audit.ts :: deriveSourceAuditConclusion` | 决定性结论函数，覆盖 `safe_for_later_thin_read_model_planning` / `conditional_requires_runtime_guard` / `blocked` / `incomplete_audit` 四种状态 |
| Audit evaluator | `features/business-advancement/opportunity-updated-at-source-audit.ts :: evaluateOpportunityUpdatedAtSourceAudit` | 8 项纯函数检查；全部通过 |
| Audit tests | `features/business-advancement/opportunity-updated-at-source-audit.test.ts` | 21 个测试，全部通过；覆盖至少一行存在性、字段非空、writerId 唯一性、read-only 行不被分类为 writer、无授权模式、boundary 区分齐全、dingtalk 关键证据被捕获、conclusion 行为 |
| Audit CLI | `scripts/business-advancement-opportunity-updated-at-source-audit.ts` | 打印 writer-source matrix 与 conclusion；exit 0 on pass / 1 on fail；无 DB、无网络、无 schema 改动、无 write authority |
| 索引同步 | `docs/README.md` | 新增本报告条目 |

**当前 audit 概览：**

| 指标 | 数值 |
| --- | --- |
| Total rows | 30 |
| Writer rows（`touchesOpportunityRows = true`） | 25 |
| Read-only reference rows | 5 |
| Eval checks | 8 / 8 全部通过 |
| Tests | 21 / 21 全部通过 |
| Final conclusion | `conditional_requires_runtime_guard` |

### 1.1 Writer-source matrix（按 sourceClass 摘要）

| 分类 | 行数 | 关键 writerId |
| --- | --- | --- |
| sourceClass = human | 21 | PF3A-002-W01..W15, W19..W24 |
| sourceClass = mixed | 3 | PF3A-002-W16（policy ASSIGN_OWNER）、W17（updateOpportunityProgress）、W18（dingtalk-ingestion via cron + manual） |
| sourceClass = system | 1 | PF3A-002-W25（scripts/dingtalk-backfill-from-ingestion.ts） |
| sourceClass = read_only | 5 | PF3A-002-R01..R05 |
| subset: human + conditional | 4 | PF3A-002-W11..W14（CRM import upsert / association；如未来被调度器调用，sourceClass MUST 重新标定） |

注：前四行按 `sourceClass` 加总等于 30 个 audit row，其中 25 个是 writer，5 个是 read-only reference。最后一行是 `sourceClass = human` 的子集，不参与总数加总。`PF3A-002-W11..W14` 的 sourceClass 仍是 `human`（仅由 operator 触发 import 时进入），但 `stalenessHeuristicImpact = conditional`，因为它们的代码形态允许未来被 scheduler 重新接入。

### 1.2 关键证据：DingTalk hourly cron 可在 system 触发下 bump `Opportunity.updatedAt`

PF3A-002 的关键 finding 由 `PF3A-002-W18` 行承载：

- `lib/connectors/dingtalk-ingestion.ts:1287` 在 `syncDingTalkReadonlyConnector` 内对 `db.opportunity.update({ data: { lastProgressAt, nextStepSummary } })`；schema 上 `Opportunity.updatedAt @updatedAt`，所以会被自动 bump
- `syncDingTalkReadonlyConnector` 的调用入口包含：
  - `app/api/runtime/dingtalk/hourly-sync/route.ts:73`（小时级 system cron，`actorType: SYSTEM`，`triggeredBy: "system-cron"`）
  - `features/connectors/actions.ts:502`（用户手动触发同步）
- 因此：**存在一条 mixed-sourceClass 路径，可以在没有任何 per-row 人为操作的前提下 bump `Opportunity.updatedAt`**

这条证据决定了本审计的整体结论必须是 `conditional_requires_runtime_guard`，不得回退为 `safe_for_later_thin_read_model_planning`。

### 1.3 Schema fact

`prisma/schema.prisma` model `Opportunity` 第 2841 行：

```
updatedAt                  DateTime                   @updatedAt
```

`@updatedAt` 是 Prisma 的 schema-level 自动 bump 行为：任何 `db.opportunity.update` / `updateMany` / `upsert` 调用，无论 `data` 中是否包含 `updatedAt`，都会把 `updatedAt` 设为当前时间。SQLite 影子 schema (`prisma/schema.sqlite.prisma`) 行为相同。

### 1.4 Evaluator 强制条件（已通过）

`evaluateOpportunityUpdatedAtSourceAudit` 强制执行：

1. `at_least_one_audit_row` — audit 至少包含一行
2. `every_row_has_non_empty_evidence_and_boundary` — 每行 filePath / evidenceLocator / evidenceSummary / boundaryNotes 非空
3. `read_only_rows_are_not_classified_as_writers` — read-only 行 `touchesOpportunityRows = false`、`sourceClass = "read_only"`、`updatedAtBehavior = "no_write"`、`stalenessHeuristicImpact = "none"`
4. `no_row_grants_runtime_schema_or_execution_authority` — 无任何行包含 schema 设计、runtime 引入、official write、auto-send、auto-approve、execution authority、LLM final ranking、page 行为变更、API route 增加、production query adoption 的授权措辞
5. `system_or_mixed_auto_bump_forces_conditional_or_blocked` — 只要存在任何 system / mixed + `prisma_auto_bump_possible` writer，整体 conclusion MUST 为 `conditional_requires_runtime_guard` 或 `blocked`，不得为 `safe`
6. `boundary_notes_preserve_recommendation_explanation_draft_proof` — 每行 boundaryNotes 含 `recommendation != commitment` / `explanation != approval` / `draft != send` / `proof != external write success`
7. `operation_kinds_and_source_classes_valid` — `operationKind` / `sourceClass` / `updatedAtBehavior` / `stalenessHeuristicImpact` 均落在允许词表内
8. `writer_ids_are_unique` — 所有 `writerId` 唯一

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| Source audit | 30 行写入/读取证据已盘点；evaluator 8 项检查全部通过；tests 21 项全部通过；conclusion 锁定为 `conditional_requires_runtime_guard` | 仍需在独立评审单元中决定 staleness heuristic 的具体形态：是接受新增 `lastHumanActivityAt` 字段（**Phase 3A 不批准**，须独立 schema review），还是改用 `lastProgressAt`（已存在，但仍由系统路径写入），还是通过 sync-exempt actor 标记跳过自动 bump 行 |
| `lib/connectors/dingtalk-ingestion.ts:1287` 的 mixed-source 路径 | 已被审计列为 `PF3A-002-W18`，并标记 `unsafe`；audit 已显式说明 cron + manual 双入口 | 仍需 runtime 设计回答：是否在 hourly cron 路径下排除该 update / 改用不会 bump `updatedAt` 的写法 / 改写为只 upsert 不在 update branch 中触达 Opportunity；任何此类决议 MUST 走独立 schema/runtime review |
| `scripts/dingtalk-backfill-from-ingestion.ts:504` | 已被审计列为 `PF3A-002-W25` system writer | 仍需在 backfill SOP 中显式说明运行后会大批量 bump `Opportunity.updatedAt`，或运行后必须重置 staleness 基线；本 Phase 3A 不变更 backfill 行为 |
| `lib/imports/crm-orchestrator.service.ts` 行 483/501/811/823/1353 | 已被审计列为 `PF3A-002-W11..W15`；当前仅由 operator-initiated CRM import 触发，标记为 `human` 但 `stalenessHeuristicImpact = conditional` | 如果未来 CRM 同步被调度化，必须重新评估这些行；否则可视作 human writer |
| `lib/policies/engine.ts:423/1039` | 已被审计列为 `PF3A-002-W16/W17`；标记为 `mixed`，因为 policy 可以是 AUTO_WITHIN_THRESHOLD 或 human-confirmed | 仍需 runtime planning 在采用 staleness heuristic 时区分 policy actor，或在 trial onboarding 默认 policy（`ActionExecutionMode.AUTO_WITHIN_THRESHOLD`）的影响范围内做校准 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Source-audit-only artifact；evaluator 守护 `no_row_grants_runtime_schema_or_execution_authority` |
| 引入 `lastHumanActivityAt` 字段或 sync-exempt flag | 属于独立 schema review；Phase 3A 不批准；boundary notes 在 `PF3A-002-W18` 行显式说明 |
| 修改任何 runtime 路径（hourly cron route、connector ingestion、CRM orchestrator、policy engine、helm-v2 runtime） | Phase 3A 是 planning-only |
| 修改 `data/queries.ts` 或任何 dashboard / mobile / search / Ask Helm UI | 范围严格限定在新建 4 个允许文件 + `docs/README.md` 一处索引更新 |
| 替换 14d staleness heuristic | 公式选择仍属于后续 thin read-model planning（仍是 planning-only），需另起评审 |
| 修改任意 mobile / search 重复脏文件（` 2.ts` / ` 2.tsx`） | 与本任务无关 |
| 把 `lastProgressAt` 直接当作替代信号 | `lastProgressAt` 自身也被 `dingtalk-ingestion.ts:1287` 等系统路径写入；不能作为安全替代结论得出而不重新审计 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读本审计为「TPQR-002 已经安全可以实施」 | 高 | Audit 的 `deriveSourceAuditConclusion` 决定性返回 `conditional_requires_runtime_guard`；evaluator 强制 system / mixed auto-bump writers 存在时不得返回 `safe`；测试守护 |
| 误读本审计为「批准新增 `lastHumanActivityAt` 或 sync-exempt flag」 | 高 | 本审计仅记录 finding；boundary notes 与 evaluator 均禁止任何 schema 设计授权措辞 |
| 漏掉新写入路径 | 中 | Audit 的 `stopConditions` 等价语义已在上游 PF3A-002 row 中声明（`runtime-guard-resolution-plan.ts`）：审计若无法穷举所有写入路径，必须保留 PF3A-002 为 conditional；本 artifact 已穷举当前可见 writers，若未来新增 writer 必须扩充本审计 |
| backfill 脚本被误用 | 中 | `PF3A-002-W25` 显式标记为 system + unsafe；后续若要保留 staleness heuristic，必须在 backfill SOP 中说明 |
| policy AUTO_WITHIN_THRESHOLD 被误读为 fully human | 中 | `PF3A-002-W16/W17` 标记 mixed；boundary notes 强调 runtime planning 必须区分上游 caller 才能宣称安全 |
| read-only 行被误读为 writer | 中 | Evaluator `read_only_rows_are_not_classified_as_writers` 强制；测试覆盖 |

---

## 五、PF3A-002 结论

**Final conclusion: `conditional_requires_runtime_guard`.**

依据：

1. `lib/connectors/dingtalk-ingestion.ts:1287` 是 mixed-sourceClass writer：可以由 hourly cron（`app/api/runtime/dingtalk/hourly-sync/route.ts`）在没有任何 per-row 人为动作的前提下 bump `Opportunity.updatedAt`。
2. `scripts/dingtalk-backfill-from-ingestion.ts:504` 是 system writer，运行时也会 bump `Opportunity.updatedAt`。
3. `lib/policies/engine.ts:423/1039` 是 mixed-sourceClass writer：在 trial onboarding 默认 policy 下，UPDATE_OPPORTUNITY_STAGE 等被声明为 `ActionExecutionMode.AUTO_WITHIN_THRESHOLD`，因此存在自动写入分支。
4. 任意 `db.opportunity.update / updateMany / upsert` 都会因 `@updatedAt` 自动 bump `Opportunity.updatedAt`，不论 `data` 字段是否显式覆盖 `updatedAt`。

因此：

- **TPQR-002 的 14d staleness 启发式 NOT safe-for-later-thin-read-model-planning**
- TPQR-002 维持 PF3-002 / PF3A-002 的 `conditional_requires_runtime_guard` 状态
- 后续要把 TPQR-002 推向可运行，前置条件至少是以下三选一（任一选择都必须独立评审，不在 Phase 3A 范围内）：
  - 选用一个不会被 cron / backfill / AUTO_WITHIN_THRESHOLD policy 写入路径污染的 timestamp（或新增字段）
  - 在 cron / backfill / 自动 policy 路径上引入 sync-exempt actor 标记，使其不触达 Opportunity 行（或不 bump `updatedAt`）
  - 接受当前 `updatedAt` 含义并补足 staleness 解释，使其作为「最近活动（人或系统）发生时间」而不是「人最近一次操作时间」，并据此重写 staleness 文案与 reviewer 边界

剩余 blockers（已由 audit 自动列出）：

- Unsafe writers found: `PF3A-002-W18`, `PF3A-002-W25`
- System / mixed writers that auto-bump updatedAt: `PF3A-002-W16`, `PF3A-002-W17`, `PF3A-002-W18`, `PF3A-002-W25`
- Conditional writers requiring later runtime review: `PF3A-002-W11..W14`, `PF3A-002-W16`, `PF3A-002-W17`

---

## 六、验证结果

### 6.1 Vitest

```
npx vitest run features/business-advancement/opportunity-updated-at-source-audit.test.ts

 Test Files  1 passed (1)
      Tests  21 passed (21)
```

### 6.2 CLI

```
npx tsx scripts/business-advancement-opportunity-updated-at-source-audit.ts

Helm Business Advancement - Phase 3A / PF3A-002 Opportunity.updatedAt Source Audit
================================================================================
Total rows:       30
Writer rows:      25
Read-only rows:   5

... (writer-source matrix omitted; see CLI output) ...

Conclusion
--------------------------------------------------------------------------------
  conclusion: conditional_requires_runtime_guard
  reason:     At least one system or mixed writer can auto-bump Opportunity.updatedAt via Prisma
              without per-row human action; the staleness heuristic cannot be declared safe until a
              later runtime design picks a human-activity-safe field, sync-exempt rule, or
              alternative timestamp.
  residualBlockers:
    - Unsafe writers found: PF3A-002-W18, PF3A-002-W25.
    - System / mixed writers that auto-bump updatedAt: PF3A-002-W16, PF3A-002-W17, PF3A-002-W18,
      PF3A-002-W25.
    - Conditional writers requiring later runtime review: PF3A-002-W11, PF3A-002-W12, PF3A-002-W13,
      PF3A-002-W14, PF3A-002-W16, PF3A-002-W17.

Eval Checks
--------------------------------------------------------------------------------
  PASS at_least_one_audit_row
  PASS every_row_has_non_empty_evidence_and_boundary
  PASS read_only_rows_are_not_classified_as_writers
  PASS no_row_grants_runtime_schema_or_execution_authority
  PASS system_or_mixed_auto_bump_forces_conditional_or_blocked
  PASS boundary_notes_preserve_recommendation_explanation_draft_proof
  PASS operation_kinds_and_source_classes_valid
  PASS writer_ids_are_unique

8/8 checks passed
PF3A-002 source audit PASSED (planning-only artifact)
```

### 6.3 ESLint

```
npx eslint features/business-advancement/opportunity-updated-at-source-audit.ts \
  features/business-advancement/opportunity-updated-at-source-audit.test.ts \
  scripts/business-advancement-opportunity-updated-at-source-audit.ts

(0 errors, 0 warnings)
```

### 6.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/opportunity-updated-at-source-audit.ts \
  features/business-advancement/opportunity-updated-at-source-audit.test.ts \
  scripts/business-advancement-opportunity-updated-at-source-audit.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A002_OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT_V1.md \
  docs/README.md

(0 whitespace errors)
```

### 6.5 ASCII-only check（仅对新增 TS / script 文件）

```
rg -n --pcre2 '[^\x00-\x7F]' \
  features/business-advancement/opportunity-updated-at-source-audit.ts \
  features/business-advancement/opportunity-updated-at-source-audit.test.ts \
  scripts/business-advancement-opportunity-updated-at-source-audit.ts

(no matches)
```

---

## 七、不视为 implementation-ready 的明示

**本 artifact 不是 runtime integration 的批准，也不是 thin read-model planning 的批准。**

在以下条件全部独立达成之前，TPQR-002 staleness heuristic 不进入 thin read-model planning、runtime integration、Prisma schema 变更、API route 变更、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现：

1. 选定 staleness 信号字段：`updatedAt`（保留并重新解释）/ `lastProgressAt`（仍需重新审计写入路径）/ 新字段（须独立 schema review）。
2. 决定是否在 cron / backfill / AUTO_WITHIN_THRESHOLD policy 路径上引入 sync-exempt actor 标记。
3. 上述决定必须独立评审通过；Phase 3A 不视为这些决定的预批准。

任一条件未达成时，PF3A-002 维持 `conditional_requires_runtime_guard` 不变。

---

## 八、下一阶段建议

1. **TPQR-002 替代信号选定**：在独立评审单元中，从 `updatedAt`（重新解释）/ `lastProgressAt`（仍需补审计）/ 新增字段（独立 schema review）三选一，并基于 `PF3A-002-W18 / W25` 等关键 finding 给出权衡。
2. **DingTalk hourly cron 路径决议**：在独立 runtime/schema 评审中确认 `lib/connectors/dingtalk-ingestion.ts:1287` 的写入策略（保留并标 sync-exempt / 拆出仅 lastProgressAt 的 raw SQL update / 完全不在 cron 路径里碰 Opportunity 行）。
3. **Backfill SOP 更新**：把 `scripts/dingtalk-backfill-from-ingestion.ts` 运行后会大批量 bump `Opportunity.updatedAt` 的事实写入运行手册，并明确是否需要重置 staleness 基线。
4. **Policy AUTO_WITHIN_THRESHOLD 调研**：在独立设计 memo 中评估 `lib/policies/engine.ts` 的 mixed writer 在真实 trial 中实际触发频率；据此决定是否要在 staleness 文案上保留「人或系统」的双重含义。
5. **完成上述四项独立评审后**，才能评估是否进入 TPQR-002 的 thin read-model planning（仍是 planning-only，不是 runtime adoption）。

**未完成上述四项独立评审之前，不进入 runtime extractor、official write、auto execution、page 行为变更或 production query adoption。**
