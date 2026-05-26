---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement — Ask Helm Interaction Redacted Calibration V1

更新时间：2026-04-27
状态：Evidence contract + evaluator complete / actual live calibration evidence not submitted
Runtime Adoption 姿态：No-Go

---

## 1. 总结论

本刀补齐的是 `Ask Helm Interaction Asset Capture` 的 redacted calibration seam：

```text
redacted interaction rows
  -> Slice 3 capture threshold evaluator
  -> Slice 2 dedupe / merge evaluator
  -> structured calibration checks
  -> runtime adoption gate evidence
```

这不是 DB collector，不是 runtime extractor，不是 production query，不是页面行为，也不是 official write。当前没有采集或提交真实 live interaction snapshot；因此默认 runtime adoption gate 仍为 `No-Go`。

Positive fixture 只证明：如果后续提交满足合同的 redacted real interaction snapshot，gate 可以进入 `Ready-For-Manual-Review`。它仍不返回 `Go`，也不允许 runtime integration 或 production adoption。

---

## 2. 已经完整成立

1. 新增 `ask-helm-interaction-redacted-calibration/v1` pure evaluator。
2. 输入限定为结构化脱敏行：workspace / actor / turn / object / evidence 必须是 opaque 或 redacted ID。
3. 校准覆盖 repeated intent、boundary hit、abandoned high-confidence answer、plan、review packet、handoff。
4. 校准覆盖 unconfirmed transcript、unsupported open-domain active candidate、cross-workspace active candidate 的拒绝路径。
5. 校准要求 `workspace_review_visible` 必须 capability gated。
6. 校准要求 redacted rows 不保留 raw prompt、raw answer body、raw audio、full transcript、secret、credential、payment details 或 token。
7. Runtime adoption gate 已从 loose boolean 改为消费结构化 calibration evaluation。
8. 默认 synthetic / local snapshot 均不能解锁 gate；positive redacted fixture 最多解锁人工评审包。

---

## 3. 已成形但仍需下一层

1. Actual redacted live interaction snapshot 尚未提交。
2. 真实 query / answer / transcript-derived metadata 还没有进入本 evaluator。
3. Production query adoption implementation plan 尚未存在。
4. Required reviewer roles 尚未基于真实 calibration evidence 开会复核。
5. DB-backed candidate queue、API、UI、runtime adapter 仍未接入。

---

## 4. 刻意未做

1. 不新增 DB collector。
2. 不读取 `DATABASE_URL`。
3. 不改 Prisma schema 或 migration。
4. 不改 `app/`、`app/api/`、`data/queries.ts`、`/search`、`/mobile` 或 UI。
5. 不接 runtime extractor、queue、worker、scheduler 或 production query。
6. 不创建 official write path。
7. 不做 auto-send、auto-approve、auto-pay、auto-execute 或 auto-commit。

---

## 5. 风险项

1. Positive fixture 可能被误读为真实线上校准已完成；必须明确它只是合同样例。
2. 后续真实 snapshot 如果包含 raw prompt/body/audio/transcript，必须被拒绝，不能落库进 repo。
3. 即使 redacted snapshot 通过，也只允许进入 manual runtime adoption review，不能直接接 production query。
4. Runtime gate 现在更严格依赖结构化 evidence，后续任何调用方必须传入完整 evaluation，而不是简单 boolean。

---

## 6. 验证结果

已通过：

```bash
npm run test -- features/business-advancement/ask-helm-interaction-redacted-calibration.test.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts
npx tsx scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts
npx tsx scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts --positive-fixture --expect-validated
npx tsx scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts --local-fixture
npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts
npx tsx scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts --positive-fixture --expect-ready
npm run test -- features/business-advancement/*.test.ts
npm run eval:ask-helm
npx eslint features/business-advancement/ask-helm-interaction-redacted-calibration.ts features/business-advancement/ask-helm-interaction-redacted-calibration.test.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.ts features/business-advancement/ask-helm-interaction-runtime-adoption-gate.test.ts scripts/business-advancement-ask-helm-interaction-redacted-calibration.ts scripts/business-advancement-ask-helm-interaction-runtime-adoption-gate.ts scripts/business-advancement-phase3p-redacted-snapshot-collector.ts
git diff --check
npm run check:boundaries
```

当前输出摘要：

- Targeted tests：2 files / 31 tests passed。
- Default calibration：synthetic fixture，`realDataValidated=false`，runtime adoption `No-Go`。
- Local fixture：`local_development_snapshot`，`realDataValidated=false`，runtime adoption `No-Go`。
- Positive redacted fixture：`realDataValidated=true` / `productionCalibrationComplete=true`，但 runtime adoption 仍 `No-Go`。
- Default runtime gate：`No-Go`，blockers 为 calibration missing/failed 与 production query adoption 未批准。
- Positive runtime gate：`Ready-For-Manual-Review`，仍 `runtimeIntegrationAllowed=false` / `productionAdoptionAllowed=false`。
- Business Advancement full tests：34 files / 1190 tests passed。
- `npm run eval:ask-helm`：query intent 38/38、action intent 36/36、interpreter stop conditions clear。
- Targeted ESLint、`git diff --check`、`npm run check:boundaries` 均通过。
- Reviewer audit findings fixed：gate now independently checks calibration ruleVersion / posture / sampleKind / checks, and redaction guard scans dynamic raw payload keys in addition to booleans.

已运行但仍受既有本地环境 / generated-client 状态阻塞：

```bash
npm run self-check
# 失败项仅为：Database URL not configured (check DATABASE_URL in .env)

npm run typecheck
# 失败项来自既有 Prisma generated client 缺少 MemoryDistillationCandidate* 导出，
# 报错集中在 features/memory/queries.ts(.test.ts) 与
# lib/memory/distillation-candidate-store.ts(.test.ts)。
```

---

## 7. 下一步建议

1. 准备真实 redacted interaction snapshot，不包含 raw prompt/body/audio/full transcript。
2. 用本 evaluator 生成 calibration result，并单独审计失败项。
3. 若真实 redacted snapshot 通过，再召开 required reviewer manual review。
4. 只有 manual review 通过后，才允许另开 production query / read-model adoption implementation plan。
5. 继续保持 `candidate != task`、`review packet != approval`、`Ready-For-Manual-Review != Go`。
