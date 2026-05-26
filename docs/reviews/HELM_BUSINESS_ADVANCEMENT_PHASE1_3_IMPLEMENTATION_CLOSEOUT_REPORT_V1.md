---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_BUSINESS_ADVANCEMENT_PHASE1_3_IMPLEMENTATION_CLOSEOUT_REPORT_V1

更新时间：2026-04-27
状态：Business Advancement Phase 1-3 implementation closeout / planning chain complete
适用范围：Business Advancement Signal Contract -> Signal to Must Push Adapter -> Ask Helm Interaction Asset Capture

本报告收口本轮 Business Advancement Phase 1-3 实施线。

本阶段完成的是 planning / offline / review-gate 层，不是 runtime adoption。当前仍不批准 runtime extractor、schema、API、页面行为、production query adoption、official write、auto-send、auto-approve、auto-pay 或 auto-execution。

---

## 1. 总结论

Phase 1-3 的 planning chain 已完整成立：

```text
Business input
  -> AdvancementSignal / AdvancementJudgement
  -> MustPushItem
  -> Ask Helm Interaction Asset Candidate planning gates
  -> Privacy / dedupe / threshold / offline eval
  -> Runtime adoption gate
```

当前 runtime adoption 决策仍为 `No-Go`。

理由很简单：缺少 redacted real-data calibration，production query adoption 也没有 required-reviewer approval 与独立 implementation plan。Synthetic offline eval 只能证明规则链路稳定，不能解锁生产接入。

---

## 2. 已经完整成立

1. Phase 1 `Business Advancement Signal Contract` 已有 conceptual planning contract、fixtures、offline eval 和 read-model feasibility 基线。
2. Phase 2 `Signal -> Must Push Adapter` 已有 planning-only deterministic adapter 基线。
3. Product Phase 3 Slice 1 privacy / retention spec 已冻结 TTL、删除触发、redacted export、voice transcript、reviewer capability 与 `workspace_review_visible` 边界。
4. Product Phase 3 Slice 2 dedupe / merge strategy 已实现，重复 candidate 可折叠，existing `AdvancementSignal` / `MustPushItem` 只附加 evidence，不生成重复 active。
5. Product Phase 3 Slice 3 threshold / eligibility 已实现，repeated intent、boundary hit、abandoned high-confidence answer、plan / saved draft / review packet / handoff 都有 deterministic gate。
6. Product Phase 3 Slice 4 synthetic offline eval 已实现，统一串联 privacy、dedupe、threshold，并覆盖 raw audio / unconfirmed transcript / cross-workspace / open-domain 拒绝路径。
7. Product Phase 3 Slice 5 runtime adoption gate 已实现，default 为 No-Go，positive fixture 最多 Ready-For-Manual-Review，仍不允许 runtime integration 或 production adoption。

---

## 3. 已成形但仍需下一层

1. Redacted real-data calibration 尚未提供。
2. Runtime adoption review 尚未召开。
3. Production query adoption implementation plan 尚未存在。
4. Runtime extractor、DB-backed candidate queue、review UI、API、schema、page behavior 均未接入。
5. False-positive rate、reviewer workload、真实 query distribution 仍需真实校准证明。

---

## 4. 刻意未做

1. 不改 `features/search/ask-helm-interpreter.ts`。
2. 不改 `/search`、`/mobile`、`data/queries.ts`。
3. 不新增 Prisma schema、migration、API route、background worker 或 DB-backed queue。
4. 不持久化 Ask Helm query、turn、raw audio、unconfirmed transcript 或 candidate。
5. 不做 production query adoption。
6. 不做 official write、auto send、auto approve、auto pay、auto execute。
7. 不让 `SkillSuggestion` 自动晋升 formal skill。

---

## 5. 风险项

1. 如果外部把 planning chain complete 解读为 production ready，会形成过度承诺；必须保留 `runtime adoption No-Go`。
2. Synthetic fixtures 不能替代 redacted real-data calibration。
3. Missing telemetry / weekend-only silence 必须继续 watch-only，不能被产品话术升级为 abandonment。
4. 任何后续 runtime adoption 都必须另开分支 / PR，并先通过 required reviewers 的人工评审。

---

## 6. 验证结果

已通过：

```bash
npm run test -- features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts features/business-advancement/ask-helm-interaction-offline-eval.test.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts
npx tsx scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts
npx tsx scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts
npx tsx scripts/business-advancement-ask-helm-interaction-offline-eval.ts
npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts
npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts --positive-fixture --expect-ready
npx eslint features/business-advancement/ask-helm-interaction-dedupe-merge.ts features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts features/business-advancement/ask-helm-interaction-capture-thresholds.ts features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts features/business-advancement/ask-helm-interaction-offline-eval.ts features/business-advancement/ask-helm-interaction-offline-eval.test.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts scripts/business-advancement-ask-helm-interaction-offline-eval.ts scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts
git diff --check
npm run check:boundaries
```

验证摘要：

- Targeted tests：4 files / 62 tests passed。
- Dedupe / merge CLI：all checks passed。
- Capture thresholds CLI：all checks passed。
- Offline eval CLI：all checks passed。
- Runtime adoption gate default：No-Go / 2 blockers / exit 0。
- Runtime adoption gate positive fixture：Ready-For-Manual-Review / 0 blockers / runtimeIntegrationAllowed=false / productionAdoptionAllowed=false。

已运行但受本地环境 / 既有 generated-client 状态阻塞：

```bash
npm run self-check
# 失败项仅为：Database URL not configured (check DATABASE_URL in .env)

npm run typecheck
# 失败项来自既有 Prisma generated client 缺少 MemoryDistillationCandidate* 导出，
# 报错集中在 features/memory/queries.ts(.test.ts) 与
# lib/memory/distillation-candidate-store.ts(.test.ts)，非本阶段新增文件。
```

---

## 7. 下一步建议

1. 不在本阶段继续 runtime implementation。
2. 若要推进 runtime adoption，先准备 redacted real-data calibration evidence。
3. 用 Slice 5 gate 生成人工评审包，required reviewer roles 必须齐全。
4. 评审通过后另开独立 implementation plan，再决定是否允许 production query / read-model adoption。
5. 继续保持 recommendation / commitment 边界：candidate 不是 task，review packet 不是 approval，Ready-For-Manual-Review 不是 Go。
