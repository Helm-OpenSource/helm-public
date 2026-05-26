---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 2 Entry Gate 与任务拆解 V1

更新时间：2026-04-26
状态：Phase 2 planning-go / runtime implementation not yet started
适用范围：Signal -> Must Push Adapter 的下一阶段开工评审
关联需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)
上游报告：

- [HELM_BUSINESS_ADVANCEMENT_PHASE1A_IMPLEMENTATION_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE1A_IMPLEMENTATION_REPORT_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE1B_FEASIBILITY_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE1B_FEASIBILITY_REPORT_V1.md)

---

## 一、结论

**建议：Phase 2 planning-go；暂不直接进入 runtime implementation。**

Phase 1A / 1B 已经完成 contract、fixture、offline eval、read-model feasibility 和本阶段报告。Phase 2 可以进入实现方案细化和最小任务拆解，但第一轮代码仍必须限定为 `Signal -> Must Push Adapter` 的纯函数 / read-model adapter / deterministic ranking 测试，不得接入写路径或自动执行。

Phase 2 不是 UI 重做，不是移动 CRM，不是 workflow engine，不是 agent execution plane。

---

## 二、Phase 2 进入条件复核

| 条件 | 当前证据 | 结论 |
| --- | --- | --- |
| Final requirements 已冻结 | `HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md` | 已满足 |
| Fixture pack 已通过评审 | Phase 1A：20 个 fixture，11/11 offline eval 通过 | 已满足 |
| Read-model feasibility 已完成 | Phase 1B：20 个 fixture，6 current / 9 thin / 5 future，5/5 evaluator checks 通过 | 已满足 |
| Deterministic ranking contract 已评审 | Phase 1A contract 已声明 deterministic sort；Phase 2 需补正式 ranking test | 规划可进入，测试仍需下一层 |
| Review posture 与 boundary note contract 已评审 | Phase 1A/1B 测试覆盖 reviewPosture、boundaryNote、forbidden action 和 no authority expansion | 已满足 |
| Mobile / dashboard / operating 展示口径已统一 | Mobile Command closeout、Ask Helm action intent closeout、dashboard / operating 既有边界文档提供证据 | 规划可进入；Phase 2 实现前需 targeted revalidation |

---

## 三、Phase 2 最小开工边界

允许：

1. 新增纯函数 adapter：从 Phase 1A fixture / Phase 1B feasibility row 生成 candidate Must Push item。
2. 新增 deterministic ranking helper 和测试。
3. 新增 adapter eval script，验证 3-5 项压缩、review coverage、boundary note 覆盖、no LLM final ranking。
4. 新增 Phase 2 report。

禁止：

1. 不新增 Prisma schema。
2. 不新增 API route。
3. 不新增 runtime extractor。
4. 不新增 event ingestion / queue。
5. 不新增 official write / auto-write。
6. 不新增 execution authority。
7. 不改变 dashboard / mobile / operating 页面行为。
8. 不做 LLM final ranking。
9. 不把 suggestion 写成 commitment。
10. 不处理 `future_only` fixture 的运行时实现。

---

## 四、Claude Code 最小任务拆解

### Task 1：Signal -> Must Push adapter contract

目标：

1. 新增 `features/business-advancement/must-push-adapter.ts`。
2. 只输入 `AdvancementSignalFixture` 与 `FixtureFeasibilityRow`。
3. 只输出 planning-only `MustPushItem` candidate，不写 DB、不读 runtime、不接页面。

验收：

1. `future_only` fixture 默认不生成 active candidate，只生成 skip / deferred reason。
2. `current_read_model_supported` 与 `requires_thin_projection` 可生成 candidate。
3. 所有 candidate 必须包含 `evidenceRefs`、`boundaryNote`、`reviewPosture`、`sourceSummary`、`riskLevel`、`sortKey`。

验证：

```bash
npx vitest run features/business-advancement/must-push-adapter.test.ts
```

### Task 2：Deterministic ranking contract

目标：

1. 固化排序：riskLevel > due / stale signal > customerWaiting > blockedDecision > revenue / retention impact > evidenceConfidence > reviewRequired > updatedAt / fixture order。
2. 不允许 LLM 参与最终排序。
3. 压缩输出 3-5 个 Must Push candidate。

验收：

1. 相同输入顺序无论如何打乱，输出顺序稳定。
2. 高风险 review_required / human_owner_required 优先。
3. `blocked` posture 不被当作可执行推进项。

验证：

```bash
npx vitest run features/business-advancement/must-push-adapter.test.ts
```

### Task 3：Phase 2 eval script

目标：

1. 新增 `scripts/business-advancement-must-push-adapter-eval.ts`。
2. 输出 candidate 数量、skipped future-only 数量、boundary coverage、ranking determinism、review coverage。
3. exit 0 on pass, 1 on fail。

验收：

1. 输出 active candidate 总数。
2. 输出 top 3-5 Must Push。
3. 输出所有 blocked / future-only 的 deferred reason。

验证：

```bash
npx tsx scripts/business-advancement-must-push-adapter-eval.ts
```

### Task 4：Phase 2 report

目标：

1. 新增 `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE2_SIGNAL_TO_MUST_PUSH_REPORT_V1.md`。
2. 更新 `docs/README.md`。
3. 使用四类短表：已经完整成立 / 已成形但仍需下一层 / 刻意未做 / 风险项。

验收：

1. 明确 Phase 2 仍不是 runtime extractor、official write 或自动执行。
2. 明确哪些 fixture 进入 candidate，哪些被 deferred。
3. 明确进入后续 UI / runtime adoption 的条件。

---

## 五、Stop Conditions

出现任一情况，Phase 2 必须停止并回到评审：

1. Adapter 需要新增 schema 才能工作。
2. Adapter 需要 runtime extractor 或事件队列才能工作。
3. Adapter 需要访问当前 workspace 外数据。
4. Ranking 依赖 LLM 最终排序。
5. Must Push item 缺少 `boundaryNote` 或 `reviewPosture`。
6. `future_only` fixture 被误生成 active candidate。
7. UI 文案把建议写成承诺、审批、发送、履约或写回。

---

## 六、给 Claude Code 的执行边界

Claude Code 后续只能领取小任务，不允许一次性实现整条 Phase 2：

1. 第一单只做 adapter contract + tests。
2. 第二单只做 eval script。
3. 第三单只做 report + docs index。
4. 每单完成后由 Codex 监督验证。
5. 不通过验证不得进入下一单。

这个拆法的目的不是提高形式感，而是防止 Phase 2 从“推进判断层”滑向“自动执行层”。
