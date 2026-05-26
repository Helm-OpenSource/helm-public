---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3A — PF3A-004 Email Thread Dedup Design V1

更新时间：2026-04-26
状态：Phase 3A / PF3A-004 email-thread dedup design artifact / planning-only / runtime adoption not authorized
本阶段：解消 PF3A-004 留下的 customer_waiting overlap 安全规划问题，输出 deterministic 证据矩阵、ownership 选择与 dedup 契约
上游：[HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md)
最终需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

---

## 声明

**本报告是 PF3A-004 的 planning-only design artifact，不是 runtime integration，也不是 thin read-model planning 的批准。**

它把 Phase 3 entry-gate preflight 中标记为 `conditional_requires_runtime_guard` 的 PF3-004（TPQR-004 / `customer_waiting` 与既有 `loadWaitingEmailThreads` 的 emailThread.id 重复风险）转化为一份 deterministic 的 evidence matrix：列出当前仓库中 `loadWaitingEmailThreads` 的 call site / query shape / id shape、TPQR-004 提议的 CRM-scoped 查询形状、`EmailThread` 的 schema locator，以及 PF3-004 / PF3A-004 文档对 emailThread.id 去重的强制要求；据此选定 ownership rule 并给出 deterministic 的 dedup 契约。

本报告 **明确不构成** 对以下任一项的批准：

- Prisma schema 变更
- runtime extractor / event queue / background job 的引入
- `app/`、`app/api/`、`data/queries.ts` 任何 route / page 行为变更
- `features/mobile/lib/mobile-command-read-model.ts` 任何修改（包括 `loadWaitingEmailThreads` 函数体、调用顺序、聚合行为）
- mobile / search / dashboard 任意 UI 表面的变更
- LLM final ranking
- official write、auto-send、auto-approval、auto-execute 的任何运行时授权
- production query adoption

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在本 artifact 的语义上仍然是 `false`：本 artifact 只是规划证据。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Design artifact | `features/business-advancement/email-thread-dedup-design.ts` | 10 行 evidence 证据矩阵；每行含 evidenceId、filePath、evidenceLocator、evidenceKind、relatedProducer、evidenceSummary、boundaryNotes |
| Ownership rule selection | `features/business-advancement/email-thread-dedup-design.ts :: SELECTED_OWNERSHIP_RULE / OWNERSHIP_RULE_SELECTION` | 选定 `merge_and_dedup_by_email_thread_id_after_producers`；tie-break 为 `[tpqr004_crm_linked, loadWaitingEmailThreads_generic]`；rationale 显式记录 |
| Pure dedup function | `features/business-advancement/email-thread-dedup-design.ts :: mergeAndDedupByEmailThreadId` | 在最小 planning fixture 类型 `PlanningEmailThreadItem` 上执行：以 `emailThreadId` 为去重键，TPQR-004 first 平局规则，输出按首次出现顺序保留 |
| Design evaluator | `features/business-advancement/email-thread-dedup-design.ts :: evaluateEmailThreadDedupDesign` | 13 项纯函数检查；全部通过 |
| Design tests | `features/business-advancement/email-thread-dedup-design.test.ts` | 33 个测试，全部通过；覆盖矩阵存在性、字段非空、evidenceId 唯一性、必备 repo-truth locator、recommendation/explanation/draft/proof 边界、禁止授权措辞、查询形状、id 形状、ownership 选择、tie-break 顺序、dedup 函数行为（重叠折叠、无 TPQR-004 时回退 generic、空输入、首次出现顺序保留）、evaluator checks |
| Design CLI | `scripts/business-advancement-email-thread-dedup-design.ts` | 打印 evidence matrix、ownership rule selection、tie-break order 与 eval checks；exit 0 on pass / 1 on fail；无 DB、无网络、无 schema 改动、无 write authority |
| 索引同步 | `docs/README.md` | 新增本报告条目 |

**当前 design 概览：**

| 指标 | 数值 |
| --- | --- |
| Total evidence rows | 10 |
| Producers covered | `loadWaitingEmailThreads_generic` + `tpqr004_crm_linked` |
| Selected ownership rule | `merge_and_dedup_by_email_thread_id_after_producers` |
| Tie-break order | `tpqr004_crm_linked` → `loadWaitingEmailThreads_generic` |
| Eval checks | 13 / 13 全部通过 |
| Tests | 33 / 33 全部通过 |

### 1.1 Evidence matrix（按 evidenceKind 分组）

| evidenceKind | 行数 | 关键 evidenceId / 位置 |
| --- | --- | --- |
| `existing_read_model_call_site` | 1 | `PF3A004-EV-001` / `features/mobile/lib/mobile-command-read-model.ts:72`（must-push 聚合器对 `loadWaitingEmailThreads(input.workspaceId)` 的调用） |
| `existing_read_model_query_shape` | 1 | `PF3A004-EV-002` / `features/mobile/lib/mobile-command-read-model.ts:310`（`db.emailThread.findMany` where `{ workspaceId, status: 'WAITING_US' }`，无 opportunityId 过滤） |
| `existing_read_model_id_shape` | 1 | `PF3A004-EV-003` / `features/mobile/lib/mobile-command-read-model.ts:328`（`waiting-thread-${thread.id}` 行 id 形状） |
| `proposed_tpqr004_query_shape` | 1 | `PF3A004-EV-004` / `features/business-advancement/thin-projection-query-review.ts:254`（TPQR-004 提议的 CRM-scoped where 子句） |
| `schema_locator` | 3 | `PF3A004-EV-005` / `prisma/schema.prisma:3019`（`EmailThread.workspaceId`），`PF3A004-EV-006` / `prisma/schema.prisma:3022`（nullable `opportunityId`），`PF3A004-EV-007` / `prisma/schema.prisma:3037`（`opportunity` 关系） |
| `dedup_requirement_doc` | 2 | `PF3A004-EV-008` / `features/business-advancement/runtime-readiness-preflight.ts:157`（PF3-004 conditional guard），`PF3A004-EV-009` / `features/business-advancement/runtime-guard-resolution-plan.ts:176`（PF3A-004 `requires_dedup_design`） |
| `ownership_design_note` | 1 | `PF3A004-EV-010`（选定 `merge_and_dedup_by_email_thread_id_after_producers`，tie-break TPQR-004 first，明确不批准 runtime adoption） |

### 1.2 关键证据：customer_waiting 重复来源

PF3A-004 的两条结构性 finding：

1. **既有 `loadWaitingEmailThreads` 不带 `opportunityId` 过滤**：
   - `features/mobile/lib/mobile-command-read-model.ts:310` 中 `loadWaitingEmailThreads(workspaceId)` 的 where 子句仅包含 `{ workspaceId, status: 'WAITING_US' }`，include `{ company: true, contact: true }`，order `updatedAt: 'desc'`，take 3。
   - 因此该路径返回的 WAITING_US 线程同时包含 CRM-linked（`opportunityId IS NOT NULL`）与非 CRM-linked（`opportunityId IS NULL`）两种。
   - 渲染 id 形状为 `waiting-thread-${thread.id}`，`thread.id` 即 `EmailThread.id`，因此 emailThread.id 是天然 dedup 键。
2. **TPQR-004 提议的 CRM-scoped 查询会与既有路径在 CRM-linked 子集上重叠**：
   - `features/business-advancement/thin-projection-query-review.ts:254` 提议的 where 子句：`workspaceId = $workspaceId AND opportunityId IS NOT NULL AND status = 'WAITING_US' AND opportunity.stage NOT IN ('DONE','LOST') AND opportunity.updatedAt < NOW() - INTERVAL '7 DAYS'`。
   - 任何同时满足 `status = 'WAITING_US'` 与 `opportunityId IS NOT NULL` 且符合 7 天 staleness 的线程，会出现在两个 producer 中。
   - 由于 `prisma/schema.prisma:3022` 中 `opportunityId` 是 nullable，nullable 字段恰好是重叠存在的结构性原因。

这两条证据共同决定了未来 thin read-model planning **必须** 在两路径之后做 emailThread.id 去重；保守方向是 merge-and-dedup-by-id，并在平局时优先 TPQR-004。

### 1.3 Ownership 选择 / Dedup 契约

| 项 | 值 |
| --- | --- |
| `selectedRule` | `merge_and_dedup_by_email_thread_id_after_producers` |
| `tieBreakOrder` | `[tpqr004_crm_linked, loadWaitingEmailThreads_generic]` |
| 平局后选哪一个 | 同 `emailThread.id` 同时出现时保留 TPQR-004 CRM-linked item；若仅 generic item 出现则保留 generic item |
| 输出顺序 | 按 input 中各 `emailThread.id` 第一次出现的顺序，保证既有 surface 顺序不被静默打乱 |
| 是否修改 `loadWaitingEmailThreads` | 否（Phase 3A 范围外） |
| 是否实现 TPQR-004 | 否（仍维持 `review_only_not_implemented` 姿态） |
| 是否引入新 schema 字段 / status migration | 否（任何此类提议必须停下走单独 schema review） |

`mergeAndDedupByEmailThreadId` 是在最小 planning fixture 类型 `PlanningEmailThreadItem` 上的纯函数实现：

- 第一次遍历：把每个 `emailThreadId` 的"赢家"放进 map，遇到 TPQR-004 项可以覆盖 generic 项；同 producer 后到的项不覆盖先到的项。
- 第二次遍历：按 input 中首次出现的 `emailThreadId` 顺序，从 map 里取出赢家组成输出。
- 输入为空时返回空数组。

该函数故意 **不复用** `MustPushItem` 真实类型，因为 PF3A-004 不允许修改 `features/mobile/lib/mobile-command-read-model.ts` 或其类型。

### 1.4 Schema fact

`prisma/schema.prisma` 中相关位置：

- 第 3019 行：`workspaceId String`（非空 FK）
- 第 3022 行：`opportunityId String?`（nullable FK）
- 第 3037 行：`opportunity Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: SetNull)`

PF3A-004 不修改这三处任何字段；只是把它们作为 evidence 行记录，确保 dedup-by-id 在工作区内是结构上安全的。

### 1.5 Evaluator 强制条件（已通过）

`evaluateEmailThreadDedupDesign` 强制执行：

1. `at_least_one_evidence_row` — 至少一行
2. `every_row_has_non_empty_evidence_and_boundary` — 每行 filePath / evidenceLocator / evidenceSummary / boundaryNotes 非空
3. `evidence_ids_are_unique` — `evidenceId` 唯一
4. `repo_truth_locators_cited` — 必须引用 `features/mobile/lib/mobile-command-read-model.ts:72/310/328`、`features/business-advancement/thin-projection-query-review.ts:254`、`prisma/schema.prisma:3019/3022/3037`、`features/business-advancement/runtime-readiness-preflight.ts:157`、`features/business-advancement/runtime-guard-resolution-plan.ts:176`
5. `boundary_notes_preserve_recommendation_explanation_draft_proof` — recommendation/explanation/draft/proof 四组区分齐全
6. `no_row_grants_runtime_schema_or_execution_authority` — 禁止任何授权 schema 设计、runtime extractor、event queue、official write、auto-send、auto-approval、LLM ranking、page 行为变更、API route 添加、production query adoption 的措辞（包括 rationale 文本）
7. `evidence_kinds_and_producers_valid` — `evidenceKind` 与 `relatedProducer` 取值在白名单内
8. `ownership_rule_selected` — 必须选定 ownership rule 且 rationale 非空
9. `selected_rule_is_merge_and_dedup_after_producers` — 必须为 `merge_and_dedup_by_email_thread_id_after_producers`
10. `tie_break_is_tpqr004_first_then_generic_fallback` — tie-break 数组必须为 `[tpqr004_crm_linked, loadWaitingEmailThreads_generic]`
11. `no_duplicate_email_thread_id_in_final_merged_output` — 在覆盖 overlap、generic-only、TPQR-004-only 三类情形的 fixture 上执行 `mergeAndDedupByEmailThreadId`，必须输出无重复 `emailThreadId`，重叠保留 TPQR-004，单边保留对应 producer
12. `ownership_design_note_refuses_runtime_adoption` — 至少一行 `ownership_design_note`，且必须显式声明 "not authorize"，必须命名 `merge_and_dedup_by_email_thread_id_after_producers`，必须引用 TPQR-004
13. `both_producers_covered_by_evidence` — `loadWaitingEmailThreads_generic` 与 `tpqr004_crm_linked` 都至少被一行覆盖

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| Ownership 选择 | `merge_and_dedup_by_email_thread_id_after_producers` 已锁定为未来 thin read-model planning 的安全方向（planning-only） | 仍需在独立 thin read-model planning artifact 中：(a) 把 dedup contract 与具体 producer 输出形状对齐到 `MustPushItem` / 任何后继读模型类型；(b) 验证 ordering 与 take cap 的交互；(c) 校准 TPQR-004 的 7d staleness 阈值（不在 PF3A-004 内决议） |
| TPQR-004 候选 (a) `tpqr004_exclusive_for_opportunity_linked` | 已经在 `EmailThreadOwnershipRuleId` 枚举中保留为可选项，但本 artifact 未选 | 任何走 (a) 的提议必须独立评审：因为它需要修改 `loadWaitingEmailThreads` 的 where 子句（增加 `opportunityId IS NULL`），属于 Phase 3A 范围外的既有 surface 行为变更 |
| `features/mobile/lib/mobile-command-read-model.ts` | 已在矩阵中作为 evidence 行记录（call site / query shape / id shape）；本 artifact 不修改它 | 任何对该文件的迁移（例如让 `loadWaitingEmailThreads` 主动应用 dedup、或让聚合器在汇总时调用 `mergeAndDedupByEmailThreadId`）属于独立 thin read-model 实施评审，不在 PF3A-004 范围内 |
| `mergeAndDedupByEmailThreadId` 与 `PlanningEmailThreadItem` | 作为 planning fixture 类型与纯函数交付；测试覆盖重叠折叠、回退、空输入、首次出现顺序保留 | 仍需在独立 runtime adoption 评审中：(a) 用真实 `MustPushItem` 形状重新校验；(b) 校准最终 take cap 与 severity / score 字段交互；(c) 任何与既有 `score: 75` / severity 行为的差异都必须显式标注 |
| 与 PF3A-002 / PF3A-003 / PF3A-005 的交叉条件 | 本 artifact 只解消 PF3A-004 | 完整 thin read-model planning 仍需 PF3A-002（updatedAt source audit）、PF3A-003（read-time derivation 路径）、PF3A-005（derivedStaleDays 来源）三项独立解消通过 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Phase 3A planning-only；`PF3A004-EV-005/006/007` 仅记录现状，不提议加列、加 trigger、加索引、改变 nullability |
| 任何 runtime 实现 / extractor / event queue / background job | 永久禁止；boundary notes 与 evaluator 共同守护 |
| `features/mobile/lib/mobile-command-read-model.ts` 任何代码改动 | 范围严格限定在新建 4 个允许文件 + `docs/README.md` 索引同步 |
| `data/queries.ts` 任何代码改动 | 不在 allowed write set |
| `app/`、`app/api/` 任意 page / route 改动 | 不在 allowed write set |
| `prisma/schema.prisma` 任何修改 | 任务明确禁止 |
| `PLANS.md` 任何修改 | 任务明确禁止 |
| 重复脏文件（` 2.ts` / ` 2.tsx`）任何修改 | 与本任务无关；不动 |
| 选择 `tpqr004_exclusive_for_opportunity_linked` | 它需要修改既有 `loadWaitingEmailThreads` where 子句，属于 Phase 3A 范围外的既有 surface 行为变更，刻意不选 |
| 修改 7 天 staleness 阈值或 take cap | TPQR-004 自身的阈值校准 / take cap 与 PF3A-004 dedup 契约正交；阈值校准留给后续独立评审 |
| 自动写、自动发、自动审批、LLM final ranking | 永久禁止；不在 PF3A-004 内授权，不在任何 evidence 行措辞中授权，不在 rationale 中授权 |
| 把 PF3A-002 / PF3A-003 / PF3A-005 拉进本 artifact | 它们由各自独立的 Phase 3A 解消子任务承担；PF3A-004 只解消 customer_waiting overlap |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读 PF3A-004 为 implementation-ready | 高 | 报告显式声明并由测试守护：每条 evidence 行 boundary notes 强制 recommendation/explanation/draft/proof 四组区分；`no_row_grants_runtime_schema_or_execution_authority` 检查覆盖任何 auto-write / auto-send / schema 授权措辞，并扩展到 `OWNERSHIP_RULE_SELECTION.rationale` |
| 同 emailThread.id 在两路径同时被渲染 | 高 | `mergeAndDedupByEmailThreadId` + `no_duplicate_email_thread_id_in_final_merged_output` 双重守护；测试覆盖 generic-first 与 TPQR-004-first 两种 input order，结果一致折叠为一项 TPQR-004 |
| TPQR-004 缺席时 generic item 被错误丢弃 | 中 | 测试 `falls back to the generic waiting-thread item when no TPQR-004 item exists` 与 evaluator `no_duplicate_email_thread_id_in_final_merged_output` 中的 `genericKeptWhenNoTpqr004` 分支双重守护 |
| 输出顺序被静默打乱 | 中 | `mergeAndDedupByEmailThreadId` 显式按"首次出现顺序"输出；测试 `preserves first-seen order across emailThread.id keys` 守护此行为 |
| 误改 `loadWaitingEmailThreads` 行为以"实施 ownership rule (a)" | 中 | `OWNERSHIP_RULE_SELECTION.rationale` 显式排除 (a)；boundary notes 反复强调 PF3A-004 不修改 `features/mobile/lib/mobile-command-read-model.ts`；任务级 allowed write set 在仓库层面拒绝该修改 |
| Dedup design 被错误地推动到 schema/status migration | 高 | PF3A-004 guard 解消行的 `stopConditions` 已经规定遇到此情形必须立即停下走单独 schema review；本 artifact 仅给出无 schema 变更的 dedup 契约，并在 boundary notes 中重申 |
| 报告被当作"批准下一步" | 高 | 报告与 artifact 都明确声明：本 artifact 不是 implementation-ready；任何 thin read-model planning、Prisma schema、API、page 行为、runtime adoption 必须在独立评审中重新批准 |

---

## 五、结论

- **selectedOwnershipRule**：`merge_and_dedup_by_email_thread_id_after_producers`
- **tieBreakOrder**：`[tpqr004_crm_linked, loadWaitingEmailThreads_generic]`
- **dedup 契约**：在两路径都返回数据后，按 `emailThread.id` 去重；同键平局时保留 TPQR-004 CRM-linked item，否则回退 generic waiting-thread item；输出按首次出现顺序保留
- **rationale 摘要**：保留 (b) merge-and-dedup 是为了让既有 `loadWaitingEmailThreads` 行为零变更，同时让 TPQR-004 在重叠时承载更强的 CRM context；若选 (a) 独占就必须修改既有 surface，超出 Phase 3A 范围

**本 artifact 不批准** thin read-model planning、Prisma schema、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现。

---

## 六、验证结果

### 6.1 Vitest

```
npx vitest run features/business-advancement/email-thread-dedup-design.test.ts

 Test Files  1 passed (1)
      Tests  33 passed (33)
```

### 6.2 CLI

```
npx tsx scripts/business-advancement-email-thread-dedup-design.ts

Helm Business Advancement - Phase 3A / PF3A-004 Email Thread Dedup Design
================================================================================
Total rows:                  10
Producers covered:           loadWaitingEmailThreads_generic, tpqr004_crm_linked
Selected ownership rule:     merge_and_dedup_by_email_thread_id_after_producers
Tie-break order:             tpqr004_crm_linked > loadWaitingEmailThreads_generic

Eval Checks:
  PASS at_least_one_evidence_row
  PASS every_row_has_non_empty_evidence_and_boundary
  PASS evidence_ids_are_unique
  PASS repo_truth_locators_cited
  PASS boundary_notes_preserve_recommendation_explanation_draft_proof
  PASS no_row_grants_runtime_schema_or_execution_authority
  PASS evidence_kinds_and_producers_valid
  PASS ownership_rule_selected
  PASS selected_rule_is_merge_and_dedup_after_producers
  PASS tie_break_is_tpqr004_first_then_generic_fallback
  PASS no_duplicate_email_thread_id_in_final_merged_output
  PASS ownership_design_note_refuses_runtime_adoption
  PASS both_producers_covered_by_evidence

13/13 checks passed
PF3A-004 email thread dedup design PASSED (planning-only artifact)
```

### 6.3 ESLint

```
npx eslint features/business-advancement/email-thread-dedup-design.ts \
  features/business-advancement/email-thread-dedup-design.test.ts \
  scripts/business-advancement-email-thread-dedup-design.ts

(0 errors, 0 warnings)
```

### 6.4 Git whitespace check

```
git diff --check -- \
  features/business-advancement/email-thread-dedup-design.ts \
  features/business-advancement/email-thread-dedup-design.test.ts \
  scripts/business-advancement-email-thread-dedup-design.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A004_EMAIL_THREAD_DEDUP_DESIGN_V1.md \
  docs/README.md

(0 whitespace errors)
```

> 备注：上述 6.1 / 6.2 / 6.3 / 6.4 已由 Codex 在当前本机仓库会话中独立复核执行；代码与测试在本 artifact 范围内 deterministic、纯函数、无 DB / 网络副作用。

---

## 七、不视为 implementation-ready 的明示

**本 artifact 不是 runtime integration 的批准。**

在以下条件全部独立达成之前，不进入 thin read-model planning、runtime integration、Prisma schema 变更、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、dashboard / mobile / 操作页面 行为变更或生产 runtime query 实现：

1. 在独立 thin read-model planning artifact 中把 `mergeAndDedupByEmailThreadId` 的 planning fixture 类型对齐到 `MustPushItem` / 任何后继读模型类型，并校准 ordering 与 take cap。
2. PF3A-002（`Opportunity.updatedAt` writer-source 审计）独立评审通过，TPQR-004 的 7 天 staleness 阈值才能进入 thin read-model planning。
3. PF3A-003（`Commitment.overdueFlag` 持久化列依赖）独立评审通过，read 路径治理与本 artifact 解耦。
4. PF3A-005（`derivedStaleDays` 单一来源）独立评审通过，与本 artifact 共同构成 thin read-model planning 入口条件。
5. 任何对 `features/mobile/lib/mobile-command-read-model.ts`（含 `loadWaitingEmailThreads`、Promise.all 聚合器、id 形状）的修改提议必须在独立 surface 改动评审中通过；当前 artifact 不为之背书。

---

## 八、下一阶段建议

1. **PF3A-005 公式选定**：继续在独立 derivation memo 中选定 `derivedStaleDays` 单一来源与公式，并记录 `take: 2` 校准。
2. **完成 PF3A-002 / PF3A-003 / PF3A-004 / PF3A-005 四项独立评审后**，方可评估进入 thin read-model planning（仍是 planning-only，不是 runtime adoption）。
3. **Surface 行为变更评审**：若未来需要让 `loadWaitingEmailThreads` 自身收缩 where 子句（即走 ownership rule (a)），必须以独立评审单元承担，并显式回应既有 surface 顺序、severity、score 字段的影响。

**未完成上述独立评审之前，不进入 runtime extractor、official write、auto execution、page 行为变更或 production query adoption。**
