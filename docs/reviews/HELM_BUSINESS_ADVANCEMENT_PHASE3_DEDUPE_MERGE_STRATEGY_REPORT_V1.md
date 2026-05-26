---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1

更新时间：2026-04-27
状态：Slice 2 implementation closeout / planning-only validation passed
适用范围：Business Advancement Product Phase 3 / Ask Helm Interaction Asset Capture

本报告关闭 Slice 2：`Phase 1-3 Dedupe / Merge Strategy`。

本轮只实现 planning-only、pure TypeScript 的 Ask Helm interaction asset dedupe / merge strategy，不接 runtime、DB、schema、API、页面、queue、official write 或 auto execution。

---

## 1. 总结论

Slice 2 已成立到可验证 planning artifact：

| 项 | 结果 |
| --- | --- |
| conceptual fingerprint | 已实现 |
| repeated intent folding | 已实现 |
| existing AdvancementSignal attachment | 已实现 |
| existing MustPushItem attachment | 已实现 |
| boundary hit authority guard | 已实现 |
| deterministic evaluator | 已实现 |
| runtime adoption | No-Go |

下一刀进入 Slice 3：`Threshold & Capture Eligibility Spec / Implementation`。

---

## 2. 交付物

代码：

- `features/business-advancement/ask-helm-interaction-dedupe-merge.ts`
- `features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts`
- `scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts`

文档：

- `docs/product/HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md`
- `docs/README.md`
- `PLANS.md`
- `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_DEDUPE_MERGE_STRATEGY_REPORT_V1.md`

---

## 3. 已经完整成立

1. `buildAskHelmInteractionAssetFingerprint` 使用 `workspaceId + actorScope + intentType + normalized objectRefs + captureReason + day bucket` 生成 deterministic fingerprint。
2. `mergeAskHelmInteractionAssetCandidates` 能把同一 fingerprint 的 candidate 折叠为一个 merged candidate，并保留：
   - `occurrenceCount`
   - `firstCapturedAt`
   - `lastSeenAt`
   - `foldedCandidateIds`
   - `supportingInteractions`
   - 去重后的 `evidenceRefs`
   - strictest `riskLevel` / `boundaryNote`
3. `mergeAndRouteAskHelmInteractionAssets` 能把已被现有 `AdvancementSignal` 覆盖的 candidate 附加为 evidence，而不是生成重复 active signal。
4. `mergeAndRouteAskHelmInteractionAssets` 能把已被现有 `MustPushItem` 覆盖的 candidate 附加为 supporting evidence，而不是改变 active / deferred 决策。
5. boundary hit 只能保留为 review reason / product friction evidence；不能提升权限、不能绕过 guard、不能 official write。
6. 跨 workspace candidate 不会合并。
7. 反转输入顺序后 fingerprint 输出稳定。

---

## 4. 已成形但仍需下一层

1. 当前 fixture 是 synthetic，尚未接真实 Ask Helm runtime turn。
2. 当前 objectRefs 来自 planning fixture，尚未从 `AskHelmResponse.relatedObjects` 或 action plan 自动生成。
3. 当前 confidence / repeated threshold / abandonment window 未在本 Slice 定义；这些归 Slice 3。
4. 当前 output 只是 planning read model，不是 DB-backed candidate queue。

---

## 5. 刻意未做

1. 不改 `features/search/ask-helm-interpreter.ts`。
2. 不改 `/search`、`/mobile`、`data/queries.ts`。
3. 不新增 Prisma schema、migration、API route 或 background worker。
4. 不持久化 Ask Helm query、turn、transcript 或 candidate。
5. 不做 official write、auto send、auto approve、auto execute。
6. 不让 `SkillSuggestion` 自动晋升 formal skill。

---

## 6. 风险项

1. Slice 3 未完成前，capture eligibility 尚未完整成立。
2. Synthetic fixture 能证明规则稳定，但不能证明 production adoption。
3. Existing `AdvancementSignal` 当前 conceptual contract 没有 workspaceId 字段，因此本 Slice 用 planning wrapper 附加 workspace scope；后续若进入 runtime，必须重新做 membership / object access proof。
4. MustPushItem 当前没有 objectRef 字段，因此本 Slice 用 planning wrapper 表达 object linkage；这不批准修改现有 MustPush contract 或 mobile read model。

---

## 7. 验证结果

已通过：

```bash
git diff --check
npm run test -- features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts
npx tsx scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts
npx eslint features/business-advancement/ask-helm-interaction-dedupe-merge.ts features/business-advancement/ask-helm-interaction-dedupe-merge.test.ts scripts/business-advancement-ask-helm-interaction-dedupe-merge.ts
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

进入 Slice 3：`Threshold & Capture Eligibility`。

Slice 3 必须冻结并实现：

1. repeated intent：rolling 7 days / 3 occurrences；2 occurrences 只 watch-only。
2. boundary hit：review-required execution / official write / send / approve / pay 请求被拦截 1 次即可 candidate。
3. abandoned high-confidence answer：`answerConfidence >= 0.85` 或 deterministic `confidence = high`，且必须有 objectRef / evidenceRefs / action plan / boundaryNote。
4. abandonment：必须基于可观察承接动作缺失；telemetry 不完整时 watch-only。
5. plan / draft / handoff：必须由用户明确生成、保存、排队或请求 handoff，不能自动创建 task / commitment / assignment。
