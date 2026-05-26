---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# External Narrative Fallback Variants Pages Report

本轮把 `external narrative fallback` 从散落在 note 里的附属说明，收成了 1 个独立 judgement-first detail 页：

- [External Narrative Fallback 详情页](../../app/(workspace)/external-narrative-fallbacks/[id]/page.tsx)

当前页已经具备：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

并且已经接入现有 chain：

- `external narrative -> narrative fallback`
- `reinforcement -> narrative fallback`
- `sendability -> narrative fallback`
- `conversation -> narrative fallback`

这页现在会优先回答：

- 当前 fallback 应停在哪一层
- 为什么当前必须停在这一层，而不是继续强化
- 当前是否仍可 customer-visible、还是只能 internal-only / review-before-send
- 当前下一步该回 conversation、回 reinforcement、还是继续走 sendability judgement

刻意未做：

- 不做完整 narrative fallback generator
- 不做完整 messaging platform
- 不把 fallback detail 写成 contract / promise 防火墙系统

短表：

| 项目 | 分类 | 说明 |
| --- | --- | --- |
| External narrative fallback page | 已经完整成立 | 独立 route、shared shell、handoff 和 evidence drawer 已成立 |
| 更细 fallback scene families | 已成形但仍需下一层 | 当前只有第一轮 mode，不是完整 fallback taxonomy |
| Runtime sandbox | 风险项 | plugin runtime 仍无真正 sandbox，必须继续诚实保留 |
