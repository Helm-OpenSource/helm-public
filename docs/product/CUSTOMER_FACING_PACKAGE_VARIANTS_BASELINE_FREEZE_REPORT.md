---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer-facing Package Variants Baseline Freeze Report

## 当前状态

customer-facing package variants 已经从第一轮 readiness 推进进入可冻结阶段。当前 contract、detail model、detail page 和交付话术已经能够稳定说明：当前推荐哪个 variant、为什么停在这一层、哪些内容可以 customer-facing、哪些内容仍必须 review-before-send 或 internal-only。

## Freeze 结论

### 当前已完整成立

- `packageVariantJudgement`
  - 作用：先说 Helm 当前建议用哪个 variant
- `packageVariantJudgementReason`
  - 作用：解释当前为什么停在这个 variant
- `packageVariantActionSummary`
  - 作用：说明 Helm 已经先整理了什么版本、边界和推进线索
- `packageVariantDecisionRequest`
  - 作用：明确现在需要谁拍板、确认或继续跟进
- `packageVariantBoundarySummary`
  - 作用：前置 prerequisite / dependency / non-commitment / sendability 边界
- `packageVariantEvidenceSummary`
  - 作用：把 replay / audit / memory / worker output / variant trace 降到附注层
- `packageVariantWorkerSummary`
  - 作用：只展示和当前 variant 决策有关的 worker 参与
- `packageVariantNextAction`
  - 作用：保持可直接执行的动作出口
- `packageVariantRiskSignal`
  - 作用：提示当前 variant 风险温度
- `packageVariantAudienceMode`
  - 当前基线：`customer-visible / internal-only / shared-review`
- `packageVariantIntent`
  - 当前基线：`exploratory-discussion / pilot-expansion / customer-visible-light / customer-visible-structured / internal-prep-only / review-before-send / boundary-only / dependency-blocked / prerequisite-blocked`
- `packageVariantStage`
  - 当前基线：`exploration / pilot-expansion / customer-readying / review-window / blocked`

### 已成形但仍需下一层

- 更细的 package stage variants 还没单独展开成更多 detail 模板
- 不同 customer segment / commercial motion 的 variants 还没拆成更细的 narrative layer
- 更统一的 package / offer / external proposal / variants 导航仍需下一层

### 刻意未做

- 没有扩成完整 package engine
- 没有新增 canonical package variants 主对象
- 没有做完整 offer platform、CPQ / quoting / deal desk 或 legal review 平台

### 诚实保留边界

- 当前这是 customer-facing package variants baseline，不是完整 package system
- 只有 `customer-visible` 切片允许进入对外表达；`internal-only` 和 blocked 语义仍必须留在 review / boundary 层
- `review-before-send / dependency-blocked / prerequisite-blocked / boundary-only` 仍优先于任何 customer-visible 冲动
- recommendation、exploratory 和 boundary-only wording 仍不等于 commitment

## 模式冻结

### 当前可以视为基线的 variant 模式

- `exploratory-discussion`
- `pilot-expansion`
- `customer-visible-light`
- `customer-visible-structured`
- `internal-prep-only`
- `review-before-send`
- `boundary-only`
- `dependency-blocked`
- `prerequisite-blocked`

### 当前仍只是下一层候选

- 更细的 `package stage variants`
- 更细的 `commercial narrative variants`
- 更强的 `detail navigation orchestration`

## 代码 / 页面 / 文档 / 测试一致性

- contract：
  - [customer-facing-package-variants-contract.ts](../../lib/presentation/customer-facing-package-variants-contract.ts)
- detail model / view：
  - [detail-model.ts](../../features/customer-facing-package-variants/detail-model.ts)
  - [detail-view.tsx](../../features/customer-facing-package-variants/detail-view.tsx)
- page：
  - [package-variants/[id]/page.tsx](../../app/(workspace)/package-variants/[id]/page.tsx)
- 回归：
  - [customer-facing-package-variants-contract.test.ts](../../lib/presentation/customer-facing-package-variants-contract.test.ts)
  - [package-variants-reinforcement-variants-pages-sprint1.test.ts](../../lib/presentation/package-variants-reinforcement-variants-pages-sprint1.test.ts)

## 总结

- customer-facing package variants 当前基线已经清楚
- stage / intent / audience / sendability / boundary 表达已经清楚
- 当前版本已经足够作为下一阶段更细 package stage variants 扩展的正式起点
