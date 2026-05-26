---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1

更新时间：2026-04-27
状态：Slice 3 implementation closeout / planning-only validation passed
适用范围：Business Advancement Product Phase 3 / Ask Helm Interaction Asset Capture

本报告关闭 Slice 3：`Phase 3 Threshold & Capture Eligibility`。

本轮只实现 planning-only、pure TypeScript 的 Ask Helm interaction asset capture threshold / eligibility helper，不接 runtime、DB、schema、API、页面、queue、official write 或 auto execution。

---

## 1. 总结论

Slice 3 已成立到可验证 planning artifact：

| 项 | 结果 |
| --- | --- |
| repeated intent threshold | 已实现 |
| boundary hit eligibility | 已实现 |
| abandoned high-confidence gate | 已实现 |
| missing telemetry / weekend silence downgrade | 已实现 |
| explicit plan / draft / handoff requirement | 已实现 |
| deterministic evaluator | 已实现 |
| runtime adoption | No-Go |

下一刀进入 Slice 4：`Synthetic Fixtures + Offline Eval`。

---

## 2. 交付物

代码：

- `features/business-advancement/ask-helm-interaction-capture-thresholds.ts`
- `features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts`
- `scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts`

文档：

- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_CAPTURE_THRESHOLDS_REPORT_V1.md`

---

## 3. 已经完整成立

1. repeated intent 采用 rolling 7 natural days / 3 occurrences 才进入 `eligible_candidate`。
2. rolling 7 natural days / 2 occurrences 只进入 `watch_only`。
3. repeated intent 不跨 workspace / actor / object / intent 聚合。
4. review-required execution / official write / send / approve / pay 请求被 boundary 拦截 1 次即可进入 review-required candidate。
5. unsupported open-domain / ordinary explanation boundary hit 只进入 watch-only guard metric。
6. abandoned high-confidence answer 必须满足 `answerConfidence >= 0.85` 或 deterministic `confidence = high`，且同时有 objectRef、evidenceRefs、action plan、next step、boundary note。
7. abandonment 必须基于可观察承接动作缺失；missing telemetry 与 weekend-only silence 均降级为 watch-only。
8. plan / saved draft / review packet / handoff 只有在用户明确 generate / save / queue / request 且步骤含 objectRef / DRI / due / evidence 时才进入 candidate。
9. 所有 eligible candidate 都保持 review-first，不创建 task、commitment、assignment、send、official write 或 execution authority。

---

## 4. 已成形但仍需下一层

1. 当前 fixture 是 synthetic，尚未接真实 Ask Helm runtime turn。
2. 当前 threshold helper 只给 planning eligibility，不生成 final `AskHelmInteractionAssetCandidate` 持久对象。
3. 当前尚未把 Slice 1 privacy、Slice 2 dedupe、Slice 3 thresholds 串成统一 offline eval。
4. 当前没有 DB-backed queue、API、review UI 或 runtime adoption gate。

---

## 5. 刻意未做

1. 不改 `features/search/ask-helm-interpreter.ts`。
2. 不改 `/search`、`/mobile`、`data/queries.ts`。
3. 不新增 Prisma schema、migration、API route 或 background worker。
4. 不持久化 Ask Helm query、turn、transcript 或 candidate。
5. 不做 official write、auto send、auto approve、auto pay、auto execute。
6. 不让 `SkillSuggestion` 自动晋升 formal skill。

---

## 6. 风险项

1. Slice 4 未完成前，三份 P0 spec 还没有统一 fixture / offline eval 证明。
2. Synthetic threshold fixture 能证明规则稳定，但不能证明 production adoption。
3. Abandonment 仍依赖未来 runtime 能提供可观察 follow-through telemetry；若 telemetry 不完整，必须维持 watch-only。
4. `24h` 与 `3 business days` 的产品差异当前以 weekend-only silence watch-only 处理；如果未来调整为 business-day window，必须独立评审改表。

---

## 7. 验证结果

已通过：

```bash
npm run test -- features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts
npx tsx scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts
npx eslint features/business-advancement/ask-helm-interaction-capture-thresholds.ts features/business-advancement/ask-helm-interaction-capture-thresholds.test.ts scripts/business-advancement-ask-helm-interaction-capture-thresholds.ts
git diff --check
npm run check:boundaries
```

已运行但受本地环境 / 既有 generated-client 状态阻塞：

```bash
npm run self-check
# 失败项仅为：Database URL not configured (check DATABASE_URL in .env)

npm run typecheck
# 失败项来自既有 Prisma generated client 缺少 MemoryDistillationCandidate* 导出，
# 报错集中在 lib/memory/distillation-candidate-store.ts(.test.ts)，非本 Slice 新增文件。
```

---

## 8. 下一步

进入 Slice 4：`Synthetic Fixtures + Offline Eval`。

Slice 4 必须把 Slice 1 privacy / retention、Slice 2 dedupe / merge、Slice 3 thresholds 串成统一 synthetic fixture pack 与 offline evaluator，并继续保持：

1. no runtime extractor。
2. no schema / DB / API / page behavior。
3. no production query adoption。
4. no official write / auto send / auto approve / auto execution。
5. all promotion targets review-first。
