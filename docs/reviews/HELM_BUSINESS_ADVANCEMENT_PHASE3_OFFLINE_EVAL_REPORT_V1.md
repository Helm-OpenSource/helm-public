---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1

更新时间：2026-04-27
状态：Slice 4 implementation closeout / planning-only validation passed
适用范围：Business Advancement Product Phase 3 / Ask Helm Interaction Asset Capture

本报告关闭 Slice 4：`Synthetic Fixtures + Offline Eval`。

本轮只实现 planning-only、pure TypeScript 的 synthetic fixture pack 与 offline evaluator，把 Slice 1 privacy / retention、Slice 2 dedupe / merge、Slice 3 threshold / eligibility 串成一条可验证链路。不接 runtime、DB、schema、API、页面、queue、official write 或 auto execution。

---

## 1. 总结论

Slice 4 已成立到可验证 offline eval artifact：

| 项 | 结果 |
| --- | --- |
| required fixture categories | 16 类已覆盖 |
| Slice 3 threshold reuse | 已实现 |
| Slice 2 dedupe / merge reuse | 已实现 |
| privacy / retention validation | 已实现 |
| redacted export validation | 已实现 |
| no authority expansion | 已验证 |
| runtime adoption | No-Go |

当前 Phase 3 Ask Helm Interaction Asset Capture 的 P0 planning chain 已形成：privacy -> dedupe -> thresholds -> synthetic offline eval。

---

## 2. 交付物

代码：

- `features/business-advancement/ask-helm-interaction-offline-eval.ts`
- `features/business-advancement/ask-helm-interaction-offline-eval.test.ts`
- `scripts/business-advancement-ask-helm-interaction-offline-eval.ts`

文档：

- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_OFFLINE_EVAL_REPORT_V1.md`

---

## 3. 已经完整成立

1. Offline eval 覆盖 repeated intent eligible / watch-only、boundary hit eligible、unsupported open-domain watch-only、abandoned high-confidence eligible、missing telemetry watch-only、weekend-only silence watch-only。
2. Offline eval 覆盖 plan generation、saved draft、review packet、handoff eligible。
3. Offline eval 覆盖 cross-workspace aggregation rejected、raw audio rejected、unconfirmed transcript rejected、open-domain active candidate rejected、cross-workspace active candidate rejected。
4. Privacy gate 在 candidate 创建前拒绝 raw audio 与 unconfirmed transcript。
5. Boundary gate 在 candidate 创建前拒绝 cross-workspace aggregation、unsupported open-domain active candidate、cross-workspace active candidate。
6. 所有 privacy-passed fixture 都复用 Slice 3 threshold evaluator。
7. 所有 eligible candidate 都进入 Slice 2 dedupe / merge evaluator；重复 repeated intent 被折叠，existing AdvancementSignal / MustPushItem 只附加 evidence。
8. Redacted export 只输出受限字段，不包含 raw prompt、raw body、raw audio、raw transcript、unconfirmed transcript。
9. 所有 promotion target 保持 review-first；没有 official write、auto send、auto approve、auto pay、auto execute。

---

## 4. 已成形但仍需下一层

1. 当前 fixture 是 synthetic，尚未接真实 Ask Helm runtime turn。
2. 当前 evaluator 是 offline planning artifact，不是 DB-backed candidate queue。
3. 当前没有 production read-model、surface 或 runtime adoption review。
4. 当前只证明规则链路稳定，不证明真实用户 query 分布、false positive rate 或 reviewer workload。

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

1. Runtime adoption 仍为 No-Go；进入真实 read model 前必须单独通过 adoption gate。
2. Synthetic fixture 不代表 production calibration，不能用来声称线上效果。
3. Redacted export 当前只在 offline artifact 中验证字段结构，尚未接真实 export API。
4. Missing telemetry / weekend-only silence 仍必须保持 watch-only，不能因用户沉默自动升级。

---

## 7. 验证结果

已通过：

```bash
npm run test -- features/business-advancement/ask-helm-interaction-offline-eval.test.ts
npx tsx scripts/business-advancement-ask-helm-interaction-offline-eval.ts
npx eslint features/business-advancement/ask-helm-interaction-offline-eval.ts features/business-advancement/ask-helm-interaction-offline-eval.test.ts scripts/business-advancement-ask-helm-interaction-offline-eval.ts
git diff --check
npm run check:boundaries
```

Evaluator summary：

```text
eligibleCandidateCount : 8
watchOnlyCount         : 4
rejectedCount          : 5
mergedCandidateCount   : 7
signalAttachmentCount  : 1
mustPushAttachmentCount: 1
privacyViolationCount  : 0
boundaryViolationCount : 0
allPass                : true
```

已运行但受本地环境 / 既有 generated-client 状态阻塞：

```bash
npm run self-check
# 失败项仅为：Database URL not configured (check DATABASE_URL in .env)

npm run typecheck
# 失败项来自既有 Prisma generated client 缺少 MemoryDistillationCandidate* 导出，
# 报错集中在 features/memory/queries.ts(.test.ts) 与
# lib/memory/distillation-candidate-store.ts(.test.ts)，非本 Slice 新增文件。
```

---

## 8. 下一步

进入 Slice 5：`Runtime Adoption Gate`。

Slice 5 只允许做 adoption gate / review packet，不允许直接接 production read model。必须回答：

1. 是否有 redacted real-data calibration；若无，runtime adoption 继续 No-Go。
2. 是否有 rollback / disable / audit posture。
3. 是否证明不会扩大 membership / capability 权限。
4. 是否证明 top list actionability 与 high-risk review coverage 同时成立。
5. 是否继续禁止 schema、API、page behavior、official write 和 auto execution。
