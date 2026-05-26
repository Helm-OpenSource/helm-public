---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3B / TPQR-001 / PF3-001 Blocked-Decision Planning V1

更新时间：2026-04-26
状态：Phase 3B planning-only artifact / 不构成 runtime adoption / 不构成 schema 变更 / 不构成 API / UI / 页面 / 生产 query 行为变更
本阶段：依据 [HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md) 的 Planning Go，把 PF3-001 / TPQR-001（meeting / `blocked_decision`）的 48h 阈值与 `MustPushItem` 输入形状以 deterministic、planning-only 的方式形式化
上游证据：
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE2C_THIN_PROJECTION_QUERY_REVIEW_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE2C_THIN_PROJECTION_QUERY_REVIEW_REPORT_V1.md)

---

## 声明

**本报告与对应的代码 artifact 是 Phase 3B 的 planning-only 交付。** 它复述并执行 Phase 3A closeout 的入口决策：

- 整体 Phase 3B = **planning-only conditional partial Go**；
- runtime / schema / API / UI / 页面行为 / official write / auto execution / LLM final ranking / production query adoption = **No-Go**；
- 本 artifact 仅覆盖 **PF3-001 / TPQR-001（meeting / `blocked_decision`） Planning Go**，**不开** TPQR-002 与 TPQR-005 的 planning 子任务，二者维持 No-Go。

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在本 artifact 中仍然是 `false`；本 artifact 不构成对它们的任何提升。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Planning artifact 实现 | `features/business-advancement/phase3b-blocked-decision-planning.ts` | 纯 TypeScript、无 DB / 网络 / `Date.now` 副作用；导出 `BLOCKED_DECISION_PLANNING_THRESHOLD_MS = 48h`、`BLOCKED_DECISION_PLANNING_REFERENCE_CLOCK_MS`、`BLOCKED_DECISION_PLANNING_FIXTURE_ROWS`（4 行）、`evaluateBlockedDecisionRow`、`buildBlockedDecisionPlanningCandidates`、`compareBlockedDecisionCandidates`、`evaluateBlockedDecisionPlanning`；候选形状 `BlockedDecisionPlanningCandidate` 直接 `extends` `MustPushItem`，并显式标注 `planningOnly: true`、`tpqrId: "TPQR-001"`、`preflightId: "PF3-001"`、`signalType: "blocked_decision"`、`sourceType: "meeting"` 与 `thresholdMs / stalenessMs / evaluatedAtMs / deepLinkPlanningTarget / sourceRowId` 等 planning-only 字段 |
| Planning fixture 4 行 | 同文件 `BLOCKED_DECISION_PLANNING_FIXTURE_ROWS` | (a) `BD-PLAN-001` 60h stale + 无 `approvalTask` + workspace confirmed → 纳入；(b) `BD-PLAN-002` 12h fresh → 排除 `threshold_not_met`；(c) `BD-PLAN-003` 已存在 `approvalTask` → 排除 `already_in_review`；(d) `BD-PLAN-004` workspace 成员未确认 → 排除 `workspace_boundary_not_confirmed` |
| Evaluator 9 项检查 | 同文件 `evaluateBlockedDecisionPlanning` | 包含 `only_tpqr001_blocked_decision_meeting_rows`、`threshold_is_48h_planning_candidate`、`no_runtime_schema_or_write_authority`、`workspace_membership_boundary_present`、`excluded_rows_have_reasons`、`deterministic_ordering`、`boundary_notes_preserve_recommendation_explanation_draft_proof`、`candidate_shape_is_planning_only_review_required`、`fixture_covers_inclusion_and_all_exclusion_reasons` |
| Vitest 测试 | `features/business-advancement/phase3b-blocked-decision-planning.test.ts` | 覆盖 fixture 形状 / 包含与排除路径 / 排除优先级（workspace > already_in_review > threshold）/ ordering 在反转输入下保持稳定 / 不变性（输入数组未被改写）/ boundary 措辞 / 禁止授权词汇 / 含包含与排除覆盖的 fail 用例 / staleness clamping |
| CLI 脚本 | `scripts/business-advancement-phase3b-blocked-decision-planning.ts` | 打印 candidates、excluded、checks，失败时 `process.exit(1)`；不连接 DB / 网络 |
| Boundary 强约束 | 候选 `boundaryNote` 与排除 reason 文案 | 保留 `recommendation != commitment / explanation != approval / draft != send / proof != external write success` 四条 distinction；评估器对禁止授权措辞（auto-execute / official-write / auto-send / auto-approve / cross-tenant / llm-rank / approves runtime adoption / approves production query adoption / may add schema / may add runtime extractor / may add api route / may change page behavior 等）做硬反向断言 |
| 上游证据复述 | 本报告与上游 closeout、preflight 的链接 | 显式重申 PF3-001 `ready_for_thin_read_model_planning` 的依据：`ActionItem.workspaceId` 非空 FK、`approvalTask` 关系可空，未来 thin filter 不需要 schema 变更 |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| 48h 阈值 | 在本 artifact 中以 `BLOCKED_DECISION_PLANNING_THRESHOLD_MS = 48 * 60 * 60 * 1000` 标注为 **planning candidate**；CLI 与候选 `reason` 中均显式声明非生产阈值 | 任何把 48h 视作 production threshold 的工作必须在独立评审中以真实数据校准；本 artifact 不为之背书 |
| `MustPushItem` 输入形状 | 候选 `extends MustPushItem`，覆盖 `itemId / title / reason / evidenceRefs / primaryAction / boundaryNote / reviewPosture / sourceSummary / riskLevel / sortKey` 与 planning-only 元数据 | 任何把候选注入到 `data/queries.ts` 或 `features/mobile/lib/mobile-command-read-model.ts` 的工作属于独立 surface 评审；本 artifact 不构成对该路径的批准 |
| 排除优先级 | `workspace_boundary_not_confirmed` > `already_in_review` > `threshold_not_met` 在评估器中 deterministic 实现 | 任何排除规则的扩展（例如 owner 缺席、跨工作区代理）需要单独 planning artifact 与独立评审 |
| Phase 3B 其他 TPQR | TPQR-003 Conditional / TPQR-004 Conditional 仍然待出独立 planning artifact；TPQR-002 / TPQR-005 维持 No-Go | 三件 planning artifact 互不依赖、独立评审、独立交付；本 artifact 不为它们背书 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Phase 3A closeout 与本 artifact 都是 docs / planning-only；`schemaChangeAllowed = false` 在上游 5 份 artifact 中保持 |
| 任何 runtime extractor / event queue / background job / runtime query 实现 | 上游 `runtimeImplementationAllowed = false`；本 artifact 仅在 fixture 上运行纯函数 |
| 任何 API route / `app/` page / dashboard / mobile / search / Ask Helm UI 行为变更 | 不在允许写入集合内 |
| `data/queries.ts` / `features/mobile/lib/mobile-command-read-model.ts` / `lib/*` 任何代码改动 | 与本 docs + planning-only artifact 解耦 |
| `prisma/schema.prisma` / `PLANS.md` 任何修改 | 任务明确禁止 |
| 重复脏文件（` 2.ts` / ` 2.tsx` / `page 2.tsx` / `mobile/types 2.ts` 等）任何修改 | 与本任务无关；不动 |
| TPQR-002 / TPQR-005 的 planning 子任务 | 上游 closeout 显式 No-Go；本 artifact 仅覆盖 TPQR-001 |
| 在候选中提及 LLM ranking / official write / auto-send / auto-approve / auto-execute / cross-tenant / production query adoption 等授权措辞 | 评估器与测试对此做反向断言；任何此类措辞会让本 artifact 失败 |
| 为 48h 阈值声称生产正确性 | 显式禁止；候选 `reason` 与 CLI 输出明确写明 "planning candidate only" |
| 运行 `npm run *` / `npx *` / 任何 staging / commit / push 行为 | 任务明确禁止；validation 由 Codex 在本 artifact 之外进行 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读本 artifact 为 PF3-001 / TPQR-001 的 runtime adoption 批准 | 高 | 文档与代码反复声明 planning-only；候选 `boundaryNote` 与 CLI 输出对禁止授权措辞做硬约束；评估器中的 `no_runtime_schema_or_write_authority` 检查阻断任何此类措辞 |
| 把 48h 阈值当作生产阈值 | 高 | 候选 `reason` 与 CLI 显式标注 "48h planning candidate; not production"；下一层需独立评审用真实数据校准 |
| 把候选 `MustPushItem`-shaped 输出直接接入 `features/mobile/lib/mobile-command-read-model.ts` 或 `data/queries.ts` | 高 | 上游 closeout 显式排除该改动；本 artifact 仅形式化 planning fixture，不导出任何 surface 接入路径 |
| Boundary 措辞被悄悄替换为弱化版（例如删去 "draft != send"） | 中 | 评估器中的 `boundary_notes_preserve_recommendation_explanation_draft_proof` 与测试用例反复断言四条 distinction 必须存在 |
| Workspace 成员边界在排除路径中被静默放宽 | 高 | 排除优先级硬编码 `workspace_boundary_not_confirmed > already_in_review > threshold_not_met`，且测试覆盖该顺序；评估器中的 `workspace_membership_boundary_present` 同时检查 fixture 与候选源行 |
| TPQR-002 / TPQR-005 planning 被借本 artifact 名义启动 | 高 | 本 artifact 仅含 TPQR-001 fixture，且评估器 `only_tpqr001_blocked_decision_meeting_rows` 对 tpqrId / preflightId / signalType / sourceType 做硬绑定 |
| 排序非 deterministic 导致下游观察不稳 | 中 | `compareBlockedDecisionCandidates`（stalenessMs DESC → sourceRowId ASC）是 total / antisymmetric；评估器中的 `deterministic_ordering` 检查在反转输入后比较 itemId 与 sortKey 是否一致 |
| 工作区脏 dup 文件被误读为 in-flight 工作 | 低 | 与本任务无关；本 artifact 不动这些文件，不为它们背书 |

---

## 五、Decision / scope

- **决策**：Phase 3B / TPQR-001 / PF3-001 Planning Go 已交付；候选数 1，排除数 3；9 项 evaluator checks 全部 PASS（已由 Codex 后续验证确认）。
- **范围**：仅限 `features/business-advancement/phase3b-blocked-decision-planning.ts` / 同名 `.test.ts` / `scripts/business-advancement-phase3b-blocked-decision-planning.ts` / 本报告 / `docs/README.md` 索引。
- **不包含**：runtime extractor、event queue、background job、Prisma schema 变更、API route 增加、`app/` 任意 page / UI 行为变更、official write、auto execution、auto-send、auto-approval、LLM final ranking、production query adoption、`data/queries.ts` 与 `features/mobile/lib/mobile-command-read-model.ts` 行为变更、TPQR-002 / TPQR-005 planning 子任务、对 48h 阈值的生产正确性声称。
- **下一步建议**：单独评审 TPQR-003 / TPQR-004 的 planning artifact；对 48h 阈值用真实数据另起独立校准评审；不解锁 TPQR-002 / TPQR-005 在 Phase 3B 的 planning 范围。

---

## 六、Validation note

**本 artifact 是 docs + planning-only 交付。**

- Claude Code 在生成本 artifact 时 **未** 运行 `npm run *`、`npx *`、`vitest`、`eslint`、`tsc`、`git diff --check`、`git status`、`git add` / `commit` / `push` 或任何 runtime / 测试命令。
- Codex（协调方）在本 doc 与代码 artifact 变更后补跑并通过以下验证：
  - `git diff --check -- features/business-advancement/phase3b-blocked-decision-planning.ts features/business-advancement/phase3b-blocked-decision-planning.test.ts scripts/business-advancement-phase3b-blocked-decision-planning.ts docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR001_BLOCKED_DECISION_PLANNING_V1.md docs/README.md`
  - `npm run check:boundaries`
  - `npx eslint features/business-advancement/phase3b-blocked-decision-planning.ts features/business-advancement/phase3b-blocked-decision-planning.test.ts scripts/business-advancement-phase3b-blocked-decision-planning.ts`
  - `npx tsx scripts/business-advancement-phase3b-blocked-decision-planning.ts`
  - `npx vitest run features/business-advancement/phase3b-blocked-decision-planning.test.ts`
  - `npx vitest run features/business-advancement/*.test.ts`
- 本 artifact 不构成 runtime / schema / API / UI / official write / auto execution / production query adoption / LLM final ranking 的批准。任何放宽必须在独立评审中重新决定。
