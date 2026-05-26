---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 3A Closeout & Phase 3B Entry Decision V1

更新时间：2026-04-26
状态：Phase 3A closeout artifact / Phase 3B planning-only entry decision / runtime adoption NOT authorized
本阶段：把 PF3A-002 / PF3A-003 / PF3A-004 / PF3A-005 四份独立 Phase 3A 解消报告合并成一个 deterministic 的 closeout 与 Phase 3B entry decision，并按每条 TPQR 给出 Go / Conditional / No-Go 决策
上游证据：
- [HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A002_OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A002_OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A004_EMAIL_THREAD_DEDUP_DESIGN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A004_EMAIL_THREAD_DEDUP_DESIGN_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A005_DERIVED_STALE_DAYS_DESIGN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A005_DERIVED_STALE_DAYS_DESIGN_V1.md)
最终需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

---

## 声明

**本报告是 Phase 3A 的 closeout 与 Phase 3B 的 entry decision，是 docs-only planning artifact，不是 runtime integration、schema 变更、type-surface change，也不是 thin read-model planning 之外任何范围的批准。**

它把 Phase 3 entry-gate preflight 留下的 5 条 TPQR / PF3 行（PF3-001 至 PF3-005）以及 Phase 3A 四个 conditional guard 的解消（PF3A-002 至 PF3A-005）合并为一个 deterministic 的 Go / Conditional / No-Go 决策表，并给出 Phase 3B 的允许范围、禁止范围与下一步工作单。

**整体决策**：对 Phase 3B planning **conditional partial Go**；对 runtime integration、schema、API、UI / 页面行为、official write、auto execution、LLM final ranking、production query adoption **No-Go**。

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在每条 TPQR 上仍然是 `false`；本 closeout 不构成对它们的任何提升。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Phase 3 entry gate preflight | `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md` | 5 行 PF3 preflight 行（PF3-001 至 PF3-005）；9/9 eval checks、18/18 tests 全部通过；PF3-001 状态 `ready_for_thin_read_model_planning`；其余四个 `conditional_requires_runtime_guard`，对应 PF3A-002 / PF3A-003 / PF3A-004 / PF3A-005 |
| Phase 3A guard resolution plan | `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_RUNTIME_GUARD_RESOLUTION_PLAN_V1.md` | 4 行 guard 解消行（PF3A-002 至 PF3A-005）；9/9 eval checks、23/23 tests；每行 `runtimeImplementationAllowed: false` / `schemaChangeAllowed: false` |
| PF3A-002 source audit | `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A002_OPPORTUNITY_UPDATED_AT_SOURCE_AUDIT_V1.md` | 30 行 writer-source matrix（25 个 writer + 5 个 read-only reference）；8/8 eval checks、21/21 tests；conclusion 锁定 `conditional_requires_runtime_guard`；关键 finding：`lib/connectors/dingtalk-ingestion.ts:1287` 通过 `app/api/runtime/dingtalk/hourly-sync/route.ts` 小时级 system cron 与 `features/connectors/actions.ts:502` 用户手动同步双入口共用，会经 Prisma `@updatedAt` 自动 bump `Opportunity.updatedAt`；`scripts/dingtalk-backfill-from-ingestion.ts:504` 是 system writer；`lib/policies/engine.ts:423/1039` 在 `ActionExecutionMode.AUTO_WITHIN_THRESHOLD` 下也是 mixed-source writer |
| PF3A-003 overdue filter resolution | `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md` | 9 行 evidence 矩阵；10/10 eval checks、26/26 tests；conclusion 锁定 `prefer_read_time_derivation`；关键 finding：`Commitment.overdueFlag` 在 `prisma/schema.prisma:3929` 无任何 `@updatedAt`-style 自动刷新机制；`lib/memory/shared.ts:254` 定义 `deriveOverdueFlag`；`lib/memory/commitment.service.ts:72` 在 `getCommitments` 读时派生；`commitment.service.ts:112/194` 在 create/update 时写入；`data/queries.ts:351` 与 `features/meetings/queries.ts:437` 直读持久化列；仓库范围内无 dueDate-crossing maintenance |
| PF3A-004 email thread dedup design | `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A004_EMAIL_THREAD_DEDUP_DESIGN_V1.md` | 10 行 evidence 矩阵；13/13 eval checks、33/33 tests；选定 ownership rule `merge_and_dedup_by_email_thread_id_after_producers`，tie-break `[tpqr004_crm_linked, loadWaitingEmailThreads_generic]`；纯函数 `mergeAndDedupByEmailThreadId` 在最小 planning fixture 类型 `PlanningEmailThreadItem` 上实现，覆盖 overlap、generic-only、TPQR-004-only、空输入与首次出现顺序保留 |
| PF3A-005 derived stale days derivation design | `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A005_DERIVED_STALE_DAYS_DESIGN_V1.md` | 12 行 evidence 矩阵 + 4 项 source 候选目录 + 4 项 take:2 校准 fixture；23/23 eval checks、54/54 tests；选定 source `readiness_timing_observed_at_normalized`、公式 `derivedStaleDays = floor(max(0, referenceClockMs - observedAtMs) / 86_400_000)`、threshold `strictly_greater_than 14`、noise guard `take: 2`、ordering `derivedStaleDays_desc_then_resource_key_asc`、staleness label `evidence_freshness_staleness_not_human_inactivity`；adoption posture `formulaStatus = selected_for_planning`、`humanMeaningfulStalenessGate = not_cleared`、`semanticScope = evidence_freshness_only_not_human_inactivity`、`nextRequiredDecision = stop_or_explicit_scope_downgrade_before_runtime_adoption` |

**Phase 3A 整体边界**：以上五份 artifact 互相之间 deterministic、无运行时副作用、无 schema 变更、无 type-surface 变更、无 page 行为变更、无 official write 授权；每份 artifact 都显式声明不构成 runtime adoption 的预批准。

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| PF3-001 / TPQR-001（meeting / `blocked_decision`） | `ready_for_thin_read_model_planning`；schema 证据完整；query 结构干净 | Phase 3B planning-only Go：在独立 thin read-model planning artifact 中校准 48h threshold，确认 `MustPushItem` 输入形状对齐；不得在本阶段进入 runtime extractor、schema 或页面行为 |
| PF3-002 / PF3A-002 / TPQR-002（crm / `stalled_opportunity`） | source audit 已完成；conclusion 仍然是 `conditional_requires_runtime_guard`；`Opportunity.updatedAt` 在 cron / backfill / AUTO_WITHIN_THRESHOLD policy 路径上会被自动 bump | Phase 3B 内 **不基于 updatedAt 启动 stale-opportunity 规划**；要继续推进，必须先在独立评审中替换 source heuristic（替换字段 / sync-exempt actor / 显式语义降级），或经治理明确把 `Opportunity.updatedAt` 自动同步行为标注为 sync-safe 后才能复用 |
| PF3-003 / PF3A-003 / TPQR-003（crm / `overdue_commitment`） | overdue filter resolution 已锁定 `prefer_read_time_derivation`；持久化 `Commitment.overdueFlag` 在 `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 仍被直读 | Phase 3B planning-only conditional Go：未来 thin read-model overdue filter 必须使用 read-time `dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')` 或既有 `deriveOverdueFlag` helper，永远不得把持久化 `Commitment.overdueFlag` 列作为唯一时间敏感过滤条件；7d ownerUserId/updatedAt 阈值需真实数据校准 |
| PF3-004 / PF3A-004 / TPQR-004（crm / `customer_waiting`） | 已选定 `merge_and_dedup_by_email_thread_id_after_producers` 与 TPQR-004-first tie-break；纯函数 `mergeAndDedupByEmailThreadId` 在 `PlanningEmailThreadItem` 上交付 | Phase 3B planning-only conditional Go：thin read-model planning 必须沿用 ownership rule 与 tie-break 顺序；任何对 `features/mobile/lib/mobile-command-read-model.ts`（含 `loadWaitingEmailThreads`、聚合器、id 形状）的改动属于独立 surface 评审，不在 Phase 3B 范围内 |
| PF3-005 / PF3A-005 / TPQR-005（tenant_resource / `stalled_case`） | source / formula / take:2 校准已文档化；`humanMeaningfulStalenessGate = not_cleared`；选定 source 仍是 evidence-freshness 而非 human-inactivity 信号 | Phase 3B 内 **不以 human-inactivity / human-meaningful staleness 名义启动规划**；唯一可继续路径是产品 / 治理显式把 `derivedStaleDays` 的语义降级为 evidence-freshness-only；任何 `TenantResourceOperatingImpactItem` 字段扩展或 `loadTenantResourceIssues` 行为变更属于独立 type-surface 与 surface-adoption 评审 |
| Phase 3B 自身 | 入口决策已下达：planning-only conditional partial Go | 必须在 Phase 3B 第一份 artifact 中显式重申本 closeout 的决策行；任何 PF3-002 / PF3-005 的 No-Go 行被视作"未解消"，不得在 Phase 3B 内静默假定为安全 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Phase 3A closeout 与 Phase 3B entry decision 都是 docs-only；五份上游 artifact 在自身评估器中已经强制 `schemaChangeAllowed = false` |
| 任何 runtime extractor / event queue / background job / runtime query 实现 | Phase 3B 仍然是 planning-only；`runtimeImplementationAllowed = false` 在五份 artifact 中保持 |
| 任何 API route / app page / dashboard / mobile / search / Ask Helm UI 行为变更 | 未在允许写入集合内；本 artifact 不为之背书 |
| `lib/connectors/*` / `lib/policies/*` / `lib/memory/*` / `lib/tenant-resources/*` / `features/mobile/lib/mobile-command-read-model.ts` / `data/queries.ts` 任何代码改动 | 属于运行时实现，与本 docs-only closeout 解耦 |
| `prisma/schema.prisma` / `PLANS.md` 任何修改 | 任务明确禁止 |
| 任何对 `TenantResourceOperatingImpactItem` 的字段扩展（包括 `derivedStaleDays?`） | 显式禁止；属于独立 type-surface review |
| 任何 LLM final ranking 提升 | 永久禁止；本 artifact 不为之背书 |
| 任何 official write / auto-send / auto-approval / auto-execute 授权 | 永久禁止；本 artifact 不为之背书 |
| 把 PF3-002 / PF3-005 的 No-Go 推回 Conditional 或 Go | 上游 artifact 的 conclusion 与 adoption posture 已 deterministic 锁定，本 closeout 不得静默放宽 |
| 重复脏文件（` 2.ts` / ` 2.tsx` / `page 2.tsx` / `mobile/types 2.ts`）任何修改 | 与本任务无关；不动 |
| 为 PF3A-005 的 `humanMeaningfulStalenessGate = not_cleared` 提供任何"已清空"措辞 | 上游守护明确拒绝；任何"已清空"措辞会破坏 Phase 3B 决策的诚实性 |
| 运行 `npm run *` / `npx *` / 任何 staging / commit / push 行为 | 任务明确禁止；validation 由 Codex 在本 artifact 之外进行 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读本 closeout 为 Phase 3B 的 runtime adoption 批准 | 高 | 整体决策行明确：Phase 3B 仅为 planning-only conditional partial Go；runtime / schema / API / UI / official write / auto execution / LLM final ranking / production query adoption 全部 No-Go；五份上游 artifact 的 evaluator 强制 `runtimeImplementationAllowed = false` / `schemaChangeAllowed = false` |
| PF3-002 被悄悄基于 `Opportunity.updatedAt` 启动规划 | 高 | TPQR-002 行明确 No-Go 直至 source heuristic 被替换或显式标注为 sync-safe；PF3A-002 audit 中的 `PF3A-002-W18 / W25 / W16 / W17` 等 system / mixed writer 是触发 No-Go 的 deterministic 证据 |
| PF3-005 被以"human-inactivity / human-meaningful staleness"名义启动规划 | 高 | TPQR-005 行明确 No-Go；唯一可继续路径是产品 / 治理显式把 scope 降级为 evidence-freshness-only；PF3A-005 的 `humanMeaningfulStalenessGate = not_cleared` 是 deterministic gate |
| TPQR-003 被错误地直接读持久化 `Commitment.overdueFlag` 列作为时间敏感过滤条件 | 中 | TPQR-003 行明确 Conditional：未来 thin read-model overdue filter 必须使用 read-time `dueDate / status` heuristic 或既有 `deriveOverdueFlag` helper；持久化列只能在已被读时派生覆盖的边界内继续读 |
| TPQR-004 在 thin read-model planning 中重复或顺序错乱 | 中 | TPQR-004 行明确 Conditional：必须沿用 `merge_and_dedup_by_email_thread_id_after_producers` 与 TPQR-004-first tie-break；任何 `features/mobile/lib/mobile-command-read-model.ts` 行为变更属于独立 surface 评审 |
| Phase 3B 第一份 artifact 没有显式重申五条 TPQR 的决策行 | 中 | 缓解：Phase 3B 第一份 artifact MUST 显式引用本 closeout 的决策行；任何 PF3-002 / PF3-005 的 No-Go 不得被静默忽略 |
| 误把 PF3A-005 的 source / formula 文档化解读为 PF3-005 的 Go | 高 | 上游 PF3A-005 evaluator 已强制 `formulaStatus = selected_for_planning` 而非 `cleared`；adoption posture 与 boundary notes 反复声明 gate-not-cleared；本 closeout 决策行同样保留 No-Go |
| 工作区脏 dup 文件被误读为 in-flight 工作 | 低 | 与本任务无关；本 closeout 不动这些文件，不为它们背书 |

---

## 五、Go / Conditional / No-Go 决策表

| ID | TPQR | Source / Signal | Phase 3A 上游 conclusion | Phase 3B 决策 | 决策类型 | 范围与条件 |
| --- | --- | --- | --- | --- | --- | --- |
| PF3-001 | TPQR-001 | meeting / `blocked_decision` | `ready_for_thin_read_model_planning`（PF3 entry gate preflight） | **Planning Go**（thin read-model planning only） | Go | 仅允许 Phase 3B planning-only artifact；不得在本阶段进入 runtime extractor、schema、API、UI 或 production query adoption；48h threshold 必须以真实数据校准 |
| PF3-002 | TPQR-002 | crm / `stalled_opportunity` | PF3A-002 source audit `conditional_requires_runtime_guard`；DingTalk hourly cron + backfill + AUTO_WITHIN_THRESHOLD policy 共用 `Opportunity.updatedAt` 自动 bump | **No-Go**（基于 updatedAt 的 stale-opportunity 规划禁入） | No-Go | 必须先在独立评审中：(a) 替换 source heuristic（新字段 / `lastProgressAt` 重审 / sync-exempt actor），或 (b) 由治理显式把 hourly / system 同步行为标注为 sync-safe，并据此重写 staleness 文案 |
| PF3-003 | TPQR-003 | crm / `overdue_commitment` | PF3A-003 resolution `prefer_read_time_derivation`；持久化 `Commitment.overdueFlag` 无 dueDate-crossing maintenance | **Conditional Go**（planning-only） | Conditional | 未来 thin read-model overdue filter 必须采用 read-time `dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')` 或既有 `deriveOverdueFlag` helper；永远不得把持久化 `Commitment.overdueFlag` 列作为唯一时间敏感过滤条件；7d ownerUserId/updatedAt 阈值需真实数据校准 |
| PF3-004 | TPQR-004 | crm / `customer_waiting` | PF3A-004 dedup design：选定 `merge_and_dedup_by_email_thread_id_after_producers`，tie-break TPQR-004 first | **Conditional Go**（planning-only） | Conditional | thin read-model planning 必须沿用 `merge_and_dedup_by_email_thread_id_after_producers` 与 TPQR-004-first tie-break；任何对 `features/mobile/lib/mobile-command-read-model.ts`（含 `loadWaitingEmailThreads`、聚合器、id 形状）的改动属于独立 surface 评审，不在 Phase 3B 范围内 |
| PF3-005 | TPQR-005 | tenant_resource / `stalled_case` | PF3A-005 derivation design 已选定 source / formula；`formulaStatus = selected_for_planning`；`humanMeaningfulStalenessGate = not_cleared`；`semanticScope = evidence_freshness_only_not_human_inactivity` | **No-Go**（作为 human-inactivity / human-meaningful staleness 信号禁入） | No-Go | 仅当产品 / 治理在独立评审中显式把 `derivedStaleDays` 语义降级为 evidence-freshness-only 时方可视作 Conditional；否则 PF3A-005 的 stop-or-downgrade 守护保持锁定 |
| —— | —— | runtime integration / Prisma schema / API route / UI 或 page 行为 / official write / auto execution / LLM final ranking / production query adoption | 五份上游 artifact 全部 `runtimeImplementationAllowed = false` / `schemaChangeAllowed = false` | **No-Go** | No-Go | 任何走向上述能力的提议必须独立评审；本 closeout 不构成对它们的批准 |

**整体决策行**：Phase 3B = conditional partial Go for **planning only**；runtime / schema / API / UI / official write / auto execution / LLM final ranking / production query adoption = **No-Go**。

---

## 六、Phase 3B next work order

Phase 3B 的允许范围严格限定为 **planning-only thin read-model planning artifact**；每一项必须独立评审、独立交付、独立通过本 closeout 的决策行复述检查。

1. **TPQR-001 thin read-model planning artifact (Planning Go)**
   - 输出：deterministic planning artifact（contract / fixture / pure evaluator / CLI），把 PF3-001 `blocked_decision` 接入 `MustPushItem` 的输入形状；显式校准 48h threshold；不接入运行时数据。
   - 边界：不修改 `data/queries.ts`、`features/mobile/lib/mobile-command-read-model.ts`、`app/`、`app/api/`、`prisma/schema.prisma`；不引入 schema、route、extractor、event queue 或 LLM final ranking。
   - 通过条件：planning fixture 通过 evaluator；boundary notes 包含 recommendation/explanation/draft/proof 区分；显式禁止 runtime adoption / schema / API 授权措辞。

2. **TPQR-003 thin read-model overdue filter planning artifact (Conditional)**
   - 输出：deterministic planning artifact，把 PF3A-003 锁定的 read-time `dueDate / status` heuristic 或既有 `deriveOverdueFlag` helper 形式化为 thin read-model 的输入；校准 7d ownerUserId/updatedAt 阈值候选。
   - 边界：不修改 `lib/memory/commitment.service.ts`、`data/queries.ts:351`、`features/meetings/queries.ts:437`、`prisma/schema.prisma`；不引入 dueDate-crossing maintenance；不把持久化 `Commitment.overdueFlag` 列作为唯一时间敏感过滤条件。
   - 通过条件：planning fixture 覆盖 read-time 派生路径与不依赖持久化列的过滤示例；evaluator 强制 `persisted-column 不安全` 不被反转；boundary notes 显式声明不批准 runtime adoption。

3. **TPQR-004 thin read-model customer-waiting planning artifact (Conditional)**
   - 输出：deterministic planning artifact，把 PF3A-004 的 `merge_and_dedup_by_email_thread_id_after_producers` 与 TPQR-004-first tie-break 升级到 `MustPushItem` 形状（仍是 planning fixture），覆盖 ordering、take cap 与 severity / score 字段交互。
   - 边界：不修改 `features/mobile/lib/mobile-command-read-model.ts`（含 `loadWaitingEmailThreads`、Promise.all 聚合器、id 形状）、`prisma/schema.prisma`、`data/queries.ts`、`app/`、`app/api/`；不收缩既有 `loadWaitingEmailThreads` where 子句。
   - 通过条件：planning fixture 输出无重复 `emailThreadId`；overlap 案例保留 TPQR-004；缺席案例回退 generic；首次出现顺序保留；evaluator 强制 ownership rule 不被静默改变。

4. **PF3-002 / TPQR-002 No-Go 维持单元（不进入 thin read-model planning）**
   - 唯一允许的下一步是单独的 source-heuristic 评审：在独立 artifact 中决议是否替换字段、引入 sync-exempt actor 或显式接受"updatedAt = 最近活动（人或系统）"语义重写；该评审 **不属于** Phase 3B planning，而是 Phase 3A No-Go 的解锁前置条件。
   - 在解锁前，Phase 3B 不开任何 TPQR-002 planning 子任务；任何 TPQR-002 planning 行属于上游决策违例。

5. **PF3-005 / TPQR-005 No-Go 维持单元（不进入 thin read-model planning）**
   - 唯一允许的下一步是产品 / 治理对 `derivedStaleDays` 语义的显式降级评审：若降级为 evidence-freshness-only，PF3-005 才可降级为 Conditional 并进入后续 thin read-model planning；否则 PF3A-005 的 stop-or-downgrade 守护保持锁定。
   - 在降级前，Phase 3B 不开任何 TPQR-005 planning 子任务；任何"basal human-inactivity"措辞均属上游决策违例。

6. **Phase 3B closeout artifact（planning-only）**
   - 待 1 / 2 / 3 三项独立评审通过后，输出 Phase 3B closeout artifact：复述本 closeout 的决策行，记录 PF3-001 / TPQR-003 / TPQR-004 三个 planning artifact 的状态、TPQR-002 / TPQR-005 No-Go 的维持理由、与 Phase 3C（仍是规划层）的入口条件。

**Phase 3B 不允许的范围（重申）**：runtime extractor、event queue、background job、Prisma schema 变更、API route 增加、`app/` 任意 page、UI 行为变更、official write、auto execution、auto-send、auto-approval、LLM final ranking、production query adoption、`TenantResourceOperatingImpactItem` 字段扩展、`features/mobile/lib/mobile-command-read-model.ts` 行为变更、`data/queries.ts` 行为变更。

---

## 七、Validation note

**本 closeout 是 docs-only artifact。**

- Claude Code 生成本 artifact 时 **未** 运行 `npm run *`、`npx *`、`vitest`、`eslint`、`tsc`、`git diff --check`、`git status`、`git add` / `commit` / `push` 或任何 runtime / 测试命令。
- Codex（协调方）在本 doc 与 `docs/README.md` 变更后补跑以下验证：
  - `git diff --check -- docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md docs/README.md`
  - `npm run check:boundaries`
  - `npx tsx scripts/business-advancement-runtime-readiness-preflight.ts`
  - `npx tsx scripts/business-advancement-runtime-guard-resolution-plan.ts`
  - `npx tsx scripts/business-advancement-opportunity-updated-at-source-audit.ts`
  - `npx tsx scripts/business-advancement-commitment-overdue-filter-resolution.ts`
  - `npx tsx scripts/business-advancement-email-thread-dedup-design.ts`
  - `npx tsx scripts/business-advancement-tenant-resource-stale-days-derivation-design.ts`
  - `npx vitest run features/business-advancement/*.test.ts`
- 另补跑 `npm run self-check`：17/18 通过，唯一失败为本地环境未配置 `DATABASE_URL`（Database Configuration），与本 docs-only closeout 无直接回归关系。
- 验证结果：`git diff --check` 通过；`check:boundaries` 通过；6 个 Phase 3 / Phase 3A evaluator scripts 全部通过；Business Advancement 11 个测试文件、322 个测试全部通过；`self-check` 仅受本地 `DATABASE_URL` 前置条件阻塞。
- 本轮未运行全仓 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`、`npm run e2e` 或 `npm run quality:regression`；本 closeout 仍然不构成 runtime / schema / API / UI / official write / auto execution / production query adoption 的批准。

---

## 八、不视为 implementation-ready 的明示

**本 artifact 不是 runtime integration 的批准。**

在以下条件全部独立达成之前，不进入 runtime integration、Prisma schema 变更、API route、runtime extractor、event queue、official write、auto execution、auto send、LLM final ranking、`TenantResourceOperatingImpactItem` 或任何 readout runtime type 字段扩展、dashboard / mobile / 操作页面 行为变更、`features/mobile/lib/mobile-command-read-model.ts` 行为变更、`data/queries.ts` 行为变更或生产 runtime query 实现：

1. PF3-001 / TPQR-001 在独立 thin read-model planning artifact 中校准 48h threshold 与 `MustPushItem` 输入形状（仍 planning-only）。
2. TPQR-003 在独立 thin read-model planning artifact 中以 read-time `dueDate / status` heuristic 或既有 `deriveOverdueFlag` helper 形式化（仍 planning-only），并据真实数据校准 7d 阈值。
3. TPQR-004 在独立 thin read-model planning artifact 中沿用 `merge_and_dedup_by_email_thread_id_after_producers` 与 TPQR-004-first tie-break，对齐 `MustPushItem` 形状（仍 planning-only）。
4. PF3-002 / TPQR-002 在独立 source-heuristic 评审中替换字段或显式标注为 sync-safe；在解锁前维持 No-Go。
5. PF3-005 / TPQR-005 在产品 / 治理独立评审中显式把语义降级为 evidence-freshness-only；在降级前维持 No-Go。
6. 任何 runtime / schema / API / UI / official write / auto execution / LLM final ranking / production query adoption 必须在独立评审中重新批准；本 closeout 不为之背书。

---

## 九、下一阶段建议

1. **开 Phase 3B planning-only 入口子任务**：TPQR-001 thin read-model planning artifact（Go）、TPQR-003 thin read-model overdue filter planning artifact（Conditional）、TPQR-004 thin read-model customer-waiting planning artifact（Conditional），三者各为独立 docs + planning-only 代码 artifact，互不依赖、独立评审、独立交付。
2. **不开 TPQR-002 / TPQR-005 planning 子任务**：维持 No-Go；分别在独立 source-heuristic 评审与产品 / 治理语义降级评审中先解锁。
3. **Phase 3B 第一份交付物**必须显式复述本 closeout 的决策行；任何静默放宽、提前 Go 或对 No-Go 行的删除属上游决策违例。
4. **Codex 验证后** 才能视本 closeout 与 README 索引同步为已确认；本 artifact 不声称已运行任何 npm / npx / 测试 / 质量门禁命令。

**未完成上述独立评审之前，不进入 runtime extractor、official write、auto execution、page 行为变更或 production query adoption。**
