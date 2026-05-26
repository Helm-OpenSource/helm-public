---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Detail Navigation Handoff Implementation Report

## 本轮落地范围

本轮没有重写全部 detail 页，只把统一 navigation / handoff 真实挂到 3 条关键商业链上：

1. `proposal -> package -> customer-facing offer`
2. `customer-facing offer -> external proposal -> reinforcement`
3. `package variants <-> reinforcement variants`

同时：

- `reinforcement -> sendability` 也已进入第一轮 shared handoff 表达

## 当前实现方式

共享层：

- `lib/presentation/unified-detail-navigation.ts`
- `components/shared/unified-detail-navigation-panel.tsx`

页面层：

- `features/proposal-package/proposal-package-detail-view.tsx`
- `features/customer-facing-offer-external-proposal/detail-view.tsx`
- `features/commitment-reinforcement-sendability/detail-view.tsx`
- `features/customer-facing-package-variants/detail-view.tsx`
- `features/commitment-reinforcement-variants/detail-view.tsx`

## 当前页面上真正成立了什么

每条链路当前都会在 detail 页里直接说明：

- 当前节点是什么
- 上一段 detail 是什么
- 下一段 detail 是什么
- 为什么现在要切过去
- 当前边界是什么
- 当前下一步动作是什么
- 当前 worker cue 和 evidence cue 是什么

也就是说，切页已经不再只是多个按钮，而是带语义的 handoff。

## 当前仍保留的遗留

本轮仍保留以下可接受遗留：

- 详情页 action 区里仍保留原有直接跳转按钮
- 统一 navigation panel 还没有变成全站 detail shell
- node / handoff 仍建立在既有 `Opportunity` commercial context 上

这些遗留当前可接受，因为它们没有重新把页面拉回对象目录模式。

## 当前不做的事

本轮刻意未做：

- 全站 breadcrumb / graph explorer
- 全量 detail 页统一 side rail
- 自动根据 lifecycle 动态生成全部 handoff
- 完整 founder / sales / delivery / success handoff orchestration

## 本轮结论

当前 3 条关键链路已经足够作为下一阶段 detail 扩展模板。Helm 开始更像一条连续经营推进链，而不是多个孤立详情页。
