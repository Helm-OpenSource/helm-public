---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3B / TPQR-003 / PF3A-003 Overdue-Commitment Planning V1

更新时间：2026-04-26
状态：Phase 3B planning-only artifact / 不构成 runtime adoption / 不构成 schema 变更 / 不构成 API / UI / 页面 / 生产 query 行为变更
本阶段：依据 [HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md) 与 [HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md) 的 Conditional Planning Go，把 PF3A-003 / TPQR-003（commitment / `overdue_commitment`）的 read-time `dueDate / status` 派生与 `MustPushItem` 输入形状以 deterministic、planning-only 的方式形式化
上游证据：
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A003_COMMITMENT_OVERDUE_FILTER_RESOLUTION_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3_ENTRY_GATE_RUNTIME_READINESS_PREFLIGHT_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR001_BLOCKED_DECISION_PLANNING_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR001_BLOCKED_DECISION_PLANNING_V1.md)

---

## 声明

**本报告与对应的代码 artifact 是 Phase 3B 的 planning-only 交付。** 它复述并执行 Phase 3A closeout 的入口决策：

- 整体 Phase 3B = **planning-only conditional partial Go**；
- runtime / schema / API / UI / 页面行为 / official write / automated execution / LLM final ranking / production query path = **No-Go**；
- 本 artifact 仅覆盖 **PF3A-003 / TPQR-003（commitment / `overdue_commitment`） Conditional Planning Go**，**不开** TPQR-002 与 TPQR-005 的 planning 子任务，二者维持 No-Go；TPQR-001 / TPQR-004 由各自独立 artifact 承担。

`runtimeImplementationAllowed` 与 `schemaChangeAllowed` 在本 artifact 中仍然是 `false`；本 artifact 不构成对它们的任何提升。

PF3A-003 上游已锁定 `prefer_read_time_derivation`：未来 thin read-model overdue filter 必须采用 `dueDate < NOW() AND status NOT IN ('FULFILLED','CANCELED')` 或既有 `deriveOverdueFlag` read-time derivation；持久化 `Commitment.overdueFlag` 列因仓库范围内不存在 dueDate-crossing maintenance 而是 stale-by-design，**不得作为唯一时间敏感过滤条件**。本 artifact 在代码与测试层面对该结论做硬强制。

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Planning artifact 实现 | `features/business-advancement/phase3b-overdue-commitment-planning.ts` | 纯 TypeScript、无 DB / 网络 / `Date.now` 副作用；导出 `OVERDUE_COMMITMENT_PLANNING_TPQR_ID = "TPQR-003"`、`OVERDUE_COMMITMENT_PLANNING_PREFLIGHT_ID = "PF3A-003"`、`OVERDUE_COMMITMENT_PLANNING_SIGNAL_TYPE = "overdue_commitment"`、`OVERDUE_COMMITMENT_PLANNING_SOURCE_TYPE = "combined"`、`OVERDUE_COMMITMENT_PLANNING_THRESHOLD_RULE = "due_date_lt_reference_clock_and_status_not_terminal"`、`OVERDUE_COMMITMENT_PLANNING_GRACE_MS = 0`、`OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES = ["FULFILLED","CANCELED"]`、`OVERDUE_COMMITMENT_PLANNING_REFERENCE_CLOCK_MS`、`OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS`（6 行）、`isTerminalCommitmentStatus`、`computeOverdueByMs`、`evaluateOverdueCommitmentRow`、`buildOverdueCommitmentPlanningCandidates`、`compareOverdueCommitmentCandidates`、`evaluateOverdueCommitmentPlanning`；候选形状 `OverdueCommitmentPlanningCandidate` 直接 `extends` `MustPushItem`，并显式标注 `planningOnly: true`、`tpqrId`、`preflightId`、`signalType`、`sourceType`、`thresholdRule`、`graceMs`、`dueDateMs`、`status`、`overdueByMs`、`evaluatedAtMs`、`sourceRowId`；候选形状 **不暴露 `persistedOverdueFlag`** |
| Planning fixture 6 行 | 同文件 `OVERDUE_COMMITMENT_PLANNING_FIXTURE_ROWS` | (a) `OC-PLAN-001` 5d 过期 + 非终态 status + workspace confirmed + 持久化列 `false` → 纳入（证明持久化列不是权威，read-time 派生胜出）；(b) `OC-PLAN-002` 9d 过期 + PENDING + workspace confirmed + 持久化列 `true` → 纳入（最深过期，排序首位）；(c) `OC-PLAN-003` 3d 未到期 + PENDING + 持久化列 `true` → 排除 `threshold_not_met`（再次证明持久化列不权威）；(d) `OC-PLAN-004` 4d 过期 + FULFILLED + 持久化列 `true` → 排除 `terminal_status`；(e) `OC-PLAN-005` 缺 dueDate + PENDING → 排除 `missing_due_date`；(f) `OC-PLAN-006` 6d 过期 + workspace 未确认 → 排除 `workspace_boundary_not_confirmed` |
| Evaluator 10 项检查 | 同文件 `evaluateOverdueCommitmentPlanning` | `only_tpqr003_overdue_commitment_rows`、`read_time_due_date_status_derivation_is_authority`、`no_persisted_overdue_flag_authority`、`no_runtime_schema_or_write_authority`、`workspace_membership_boundary_present`、`excluded_rows_have_reasons`、`deterministic_ordering`、`boundary_notes_preserve_recommendation_explanation_draft_proof`、`candidate_shape_is_planning_only_review_required`、`fixture_covers_inclusion_all_exclusion_reasons_and_persisted_flag_mismatch` |
| Vitest 测试 | `features/business-advancement/phase3b-overdue-commitment-planning.test.ts` | 覆盖 fixture 形状 / 终态判定 / 各路 `evaluateOverdueCommitmentRow` / 排除优先级 (`workspace > missing_due_date > terminal > threshold`) / 排序在反转输入下保持稳定 / 反转持久化列后 candidate 集合不变 / 不变性（输入数组未被改写）/ boundary 措辞 / 禁止授权词汇 / fixture 覆盖度（含包含 / 全部排除 reason / 持久化列 mismatch）/ 多个失败分支断言 |
| CLI 脚本 | `scripts/business-advancement-phase3b-overdue-commitment-planning.ts` | 打印 candidates、excluded、checks，失败时 `process.exit(1)`；不连接 DB / 网络 |
| Boundary 强约束 | 候选 `boundaryNote` 与排除 reason 文案 | 保留 `recommendation != commitment / explanation != approval / draft != send / proof != external write success` 四条 distinction；评估器对禁止授权措辞（auto-execute / auto-execution / official write / auto-send / auto-approval / cross-tenant / llm rank / llm final ranking / production query adoption / approves runtime adoption / may add schema / may add api route / may change page behavior 等）做硬反向断言；用 "outbound-system mutation"、"automated execution"、"production query path" 等安全替代措辞 |
| 上游证据复述 | 本报告与上游 PF3A-003 / closeout / preflight 的链接 | 显式重申：持久化 `Commitment.overdueFlag` 在 `prisma/schema.prisma:3929` 无 `@updatedAt`-style 自动刷新；`lib/memory/shared.ts:254` 的 `deriveOverdueFlag` 是既有 read-time helper；`data/queries.ts:351` 与 `features/meetings/queries.ts:437` 仍直读持久化列，本 artifact 不动这些路径 |

### 1.1 Read-time 派生权威（PF3A-003 锁定的安全方向）

候选纳入由且仅由以下 read-time 谓词决定：

```
dueDateMs !== null
  AND dueDateMs < referenceClockMs
  AND status NOT IN OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES
```

`referenceClockMs` 由调用方显式传入，artifact 内部不读取 `Date.now()`。

### 1.2 持久化列 `Commitment.overdueFlag` 不是权威

`OverdueCommitmentPlanningSourceRow.persistedOverdueFlag` 仅作 evidence 字段记录在源行上：

- `OverdueCommitmentPlanningCandidate` **不**包含该字段；
- `evaluateOverdueCommitmentRow` **不读取** 该字段；
- `checkNoPersistedOverdueFlagAuthority` 通过对所有源行的 `persistedOverdueFlag` 进行整体翻转重建并要求候选集合（含顺序与 sortKey）完全一致来作 deterministic 证明；
- `checkFixtureCoversAllReasons` 强制 fixture 至少包含一行持久化列与 read-time 派生结果不一致的样本，作为 mismatch 演示。

### 1.3 排除优先级（deterministic）

```
workspace_boundary_not_confirmed
  > missing_due_date
  > terminal_status
  > threshold_not_met
```

测试用例在多重违例的合成行上验证最高优先级 reason 被选中。

### 1.4 排序

```
ORDER BY overdueByMs DESC, sourceRowId ASC
```

`compareOverdueCommitmentCandidates` total / antisymmetric；`buildOverdueCommitmentPlanningCandidates` 给输出分配 zero-based contiguous 的 `sortKey`；评估器对反转输入做对称重建并比较 `itemId` 与 `sortKey`。

### 1.5 候选形状

候选 `extends MustPushItem`，并保留 `evidenceRefs`、`reviewPosture: human_owner_required`、`riskLevel: high`、`primaryAction` 必须以 `review` 或 `open` 开头并显式引用合成 `commitmentId`；`dueDateMs` / `status` 与源行严格对齐。

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| 7d ownerUserId/updatedAt 阈值校准 | 上游 closeout 提到 7d 阈值候选需"以真实数据校准"；**本 artifact 不形式化 7d** —— 7d 是另一个独立、并行的运行 staleness 校准维度，与本 artifact 关心的 `dueDate / status` overdue 派生在语义上独立 | 任何 7d 校准必须在独立 review（与本 artifact 解耦）中进行；本 artifact 不为之背书 |
| `MustPushItem` 输入形状 | 候选 `extends MustPushItem`，覆盖 `itemId / title / reason / evidenceRefs / primaryAction / boundaryNote / reviewPosture / sourceSummary / riskLevel / sortKey` 与 planning-only 元数据 | 任何把候选注入到 `data/queries.ts` 或 `features/mobile/lib/mobile-command-read-model.ts` 的工作属于独立 surface 评审；本 artifact 不构成对该路径的批准 |
| 终态状态集合 | `["FULFILLED","CANCELED"]` 直接对齐 PF3A-003 推荐过滤式 | 任何终态扩展（例如 `EXPIRED`、`CLOSED_LOST`）需要单独的产品 / 治理评审 |
| `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 直读持久化列 | 上游 PF3A-003 `PF3A003-EV-006 / EV-007` 已 deterministic 记录；本 artifact 不动这些文件 | 任何把它们改走 `getCommitments` / `deriveOverdueFlag` 的迁移属于独立读路径治理评审 |
| Phase 3B 其他 TPQR | TPQR-001 已交付（独立 artifact）；TPQR-004 Conditional 仍待出独立 planning artifact；TPQR-002 / TPQR-005 维持 No-Go | 三件 planning artifact 互不依赖、独立评审、独立交付；本 artifact 不为它们背书 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 任何 Prisma schema 变更 | Phase 3A closeout / PF3A-003 / 本 artifact 都是 docs / planning-only；`schemaChangeAllowed = false` 在上游 artifact 中保持 |
| 任何 dueDate-crossing maintenance（cron / 调度 / backfill）提议 | 上游 PF3A-003 `PF3A003-EV-008` 显式记录"无此 maintenance"；任何引入提议属于独立 schema/maintenance review，本 artifact 刻意不背书 |
| 任何 runtime extractor / event queue / background job / runtime query 实现 | `runtimeImplementationAllowed = false`；本 artifact 仅在 fixture 上运行纯函数 |
| 任何 API route / `app/` page / dashboard / mobile / search / Ask Helm UI 行为变更 | 不在允许写入集合内 |
| `data/queries.ts` / `features/meetings/queries.ts` / `lib/memory/commitment.service.ts` / `lib/memory/shared.ts` / `features/mobile/lib/mobile-command-read-model.ts` / `lib/*` 任何代码改动 | 与本 docs + planning-only artifact 解耦 |
| `prisma/schema.prisma` / `PLANS.md` 任何修改 | 任务明确禁止 |
| 重复脏文件（` 2.ts` / ` 2.tsx` / `page 2.tsx` / `mobile/types 2.ts` 等）任何修改 | 与本任务无关；不动 |
| TPQR-002 / TPQR-005 的 planning 子任务 | 上游 closeout 显式 No-Go；本 artifact 仅覆盖 TPQR-003 |
| 把持久化 `Commitment.overdueFlag` 列接入候选纳入逻辑 | 上游 PF3A-003 锁定 `prefer_read_time_derivation`；评估器 `no_persisted_overdue_flag_authority` 与 `read_time_due_date_status_derivation_is_authority` 双重守护 |
| 引入 7d ownerUserId/updatedAt 阈值 | 上游声明须以真实数据另起独立校准；本 artifact 不混入该维度 |
| 在候选中提及 LLM ranking / official write / auto-send / auto-approval / auto-execute / auto-execution / cross-tenant / production query adoption 等授权措辞 | 评估器与测试对此做反向断言；任何此类措辞会让本 artifact 失败 |
| 为读时派生声称生产正确性 | 显式禁止；候选 `reason` 与 CLI 输出明确写明 "planning candidate only" 与 "planning-only" |
| 运行 `npm run *` / `npx *` / 任何 staging / commit / push 行为 | 任务明确禁止；validation 由 Codex 在本 artifact 之外进行 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 误读本 artifact 为 PF3A-003 / TPQR-003 的 runtime adoption 批准 | 高 | 文档与代码反复声明 planning-only；候选 `boundaryNote` 与 CLI 输出对禁止授权措辞做硬约束；评估器中的 `no_runtime_schema_or_write_authority` 检查阻断任何此类措辞 |
| 误把持久化 `Commitment.overdueFlag` 列推进 thin read-model 唯一过滤条件 | 高 | `no_persisted_overdue_flag_authority` 通过整体翻转持久化列后比较候选集合作硬强制；候选形状不暴露该字段；fixture 含两行 mismatch 演示（持久化 false / read-time true，以及持久化 true / read-time false） |
| 在候选纳入路径中悄悄读 `persistedOverdueFlag` | 高 | `evaluateOverdueCommitmentRow` 仅读 `dueDateMs / status / workspaceMembershipConfirmed`；测试用整体翻转 + `Object.prototype.hasOwnProperty.call(candidate, "persistedOverdueFlag")` 反断言 |
| 把候选 `MustPushItem`-shaped 输出直接接入 `features/mobile/lib/mobile-command-read-model.ts` 或 `data/queries.ts` | 高 | 上游 closeout 显式排除该改动；本 artifact 仅形式化 planning fixture，不导出任何 surface 接入路径 |
| 终态集合被悄悄收紧或扩大 | 中 | `OVERDUE_COMMITMENT_PLANNING_TERMINAL_STATUSES` 显式导出且测试断言为 `["FULFILLED","CANCELED"]`；任何变更需要走单独评审 |
| 排除优先级被静默放宽 | 中 | 优先级硬编码为 `workspace > missing_due_date > terminal > threshold`；测试覆盖三种顺序的硬绑定 |
| Workspace 成员边界在排除路径中被静默放宽 | 高 | 评估器中的 `workspace_membership_boundary_present` 同时检查 fixture 与候选源行；优先级守护使 `OC-PLAN-006` 永远走 boundary 排除分支 |
| TPQR-002 / TPQR-005 planning 被借本 artifact 名义启动 | 高 | 本 artifact 仅含 TPQR-003 fixture，且评估器 `only_tpqr003_overdue_commitment_rows` 对 tpqrId / preflightId / signalType / sourceType 做硬绑定 |
| 排序非 deterministic 导致下游观察不稳 | 中 | `compareOverdueCommitmentCandidates`（`overdueByMs DESC` → `sourceRowId ASC`）是 total / antisymmetric；评估器中的 `deterministic_ordering` 检查在反转输入后比较 itemId 与 sortKey 是否一致 |
| Boundary 措辞被悄悄替换为弱化版（例如删去 "draft != send"） | 中 | 评估器中的 `boundary_notes_preserve_recommendation_explanation_draft_proof` 与测试用例反复断言四条 distinction 必须存在 |
| 7d 阈值与本 artifact 混用 | 中 | 文档显式说明 7d 是独立校准维度；本 artifact 既不实现也不背书 |
| 工作区脏 dup 文件被误读为 in-flight 工作 | 低 | 与本任务无关；本 artifact 不动这些文件，不为它们背书 |

---

## 五、Decision / scope

- **决策**：Phase 3B / TPQR-003 / PF3A-003 Conditional Planning Go 已交付；候选数 2，排除数 4；10 项 evaluator checks 全部 PASS（已由 Codex 后续验证确认）。
- **范围**：仅限 `features/business-advancement/phase3b-overdue-commitment-planning.ts` / 同名 `.test.ts` / `scripts/business-advancement-phase3b-overdue-commitment-planning.ts` / 本报告 / `docs/README.md` 索引。
- **不包含**：runtime extractor、event queue、background job、Prisma schema 变更、API route 增加、`app/` 任意 page / UI 行为变更、official write、automated execution、auto-send、auto-approval、LLM final ranking、production query path 接入、`data/queries.ts` / `features/meetings/queries.ts` / `lib/memory/commitment.service.ts` / `lib/memory/shared.ts` / `features/mobile/lib/mobile-command-read-model.ts` / `lib/*` 行为变更、TPQR-002 / TPQR-005 planning 子任务、对 read-time 派生或终态集合的生产正确性声称、7d ownerUserId/updatedAt 阈值校准、dueDate-crossing maintenance 设计。
- **下一步建议**：单独评审 TPQR-004 的 planning artifact（与本 artifact 解耦）；对 7d ownerUserId/updatedAt 阈值另起独立真实数据校准评审；对 `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 持久化列直读路径的迁移另起独立读路径治理评审；不解锁 TPQR-002 / TPQR-005 在 Phase 3B 的 planning 范围。

---

## 六、Validation note

**本 artifact 是 docs + planning-only 交付。**

- Claude Code 在生成本 artifact 时 **未** 运行 `npm run *`、`npx *`、`vitest`、`eslint`、`tsc`、`git diff --check`、`git status`、`git add` / `commit` / `push` 或任何 runtime / 测试命令。
- Codex（协调方）在本 doc 与代码 artifact 变更后补跑并通过以下验证：
  - `git diff --check -- features/business-advancement/phase3b-overdue-commitment-planning.ts features/business-advancement/phase3b-overdue-commitment-planning.test.ts scripts/business-advancement-phase3b-overdue-commitment-planning.ts docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR003_OVERDUE_COMMITMENT_PLANNING_V1.md docs/README.md`
  - `npm run check:boundaries`
  - `npx eslint features/business-advancement/phase3b-overdue-commitment-planning.ts features/business-advancement/phase3b-overdue-commitment-planning.test.ts scripts/business-advancement-phase3b-overdue-commitment-planning.ts`
  - `npx tsx scripts/business-advancement-phase3b-overdue-commitment-planning.ts`
  - `npx vitest run features/business-advancement/phase3b-overdue-commitment-planning.test.ts`
  - `npx vitest run features/business-advancement/*.test.ts`
- 本 artifact 不构成 runtime / schema / API / UI / official write / automated execution / production query path / LLM final ranking 的批准。任何放宽必须在独立评审中重新决定。

---

## 七、不视为 implementation-ready 的明示

**本 artifact 不是 runtime integration 的批准。**

在以下条件全部独立达成之前，不进入 thin read-model runtime 接入、Prisma schema 变更、API route、runtime extractor、event queue、official write、automated execution、auto-send、auto-approval、LLM final ranking、dashboard / mobile / 操作页面行为变更、`features/mobile/lib/mobile-command-read-model.ts` 行为变更、`data/queries.ts` / `features/meetings/queries.ts` 行为变更、`lib/memory/commitment.service.ts` / `lib/memory/shared.ts` 行为变更或生产 runtime query 实现：

1. 7d ownerUserId/updatedAt 阈值在独立评审中以真实数据校准；本 artifact 不混入该维度。
2. `data/queries.ts:351` 与 `features/meetings/queries.ts:437` 持久化列直读路径在独立读路径治理评审中处理；本 artifact 不修改这两个文件。
3. 任何 dueDate-crossing maintenance 提议在独立 schema/maintenance review 中通过；本 artifact 不为之背书。
4. TPQR-001 / TPQR-004 各自独立 planning artifact 通过；TPQR-002 / TPQR-005 No-Go 在独立评审中按 closeout 条件解锁。
5. 上述独立评审通过后，方可评估进入 thin read-model runtime 接入（仍是 planning-only 退出后的下一阶段，不是 runtime adoption 自动放行）。
