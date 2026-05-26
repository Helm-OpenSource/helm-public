---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Sales Objection / Follow-up Variants Alignment Report

## 对齐范围

本轮已同步对齐：

- 页面：
  - `/app/(workspace)/sales-objections/[id]/page.tsx`
  - `/app/(workspace)/sales-followups/[id]/page.tsx`
- contract / model / view：
  - `lib/presentation/sales-objection-followup-variants-contract.ts`
  - `features/sales-objection-followup-variants/detail-model.ts`
  - `features/sales-objection-followup-variants/detail-view.tsx`
- unified chain：
  - `lib/presentation/unified-detail-navigation.ts`
  - `components/shared/unified-detail-navigation-panel.tsx`
  - `features/sales-conversation-variants/detail-view.tsx`
- 文档与交付资产：
  - `README.md`
  - `docs/README.md`
  - `docs/product/demo-script.md`
  - `docs/pilot/manual-acceptance-paths.md`
  - `docs/pilot/delivery-boundary.md`
  - `docs/product/product-principles.md`
- 守卫 / 自检 / 回归：
  - `scripts/helm-self-check.ts`
  - `scripts/decision-first-boundary-check.ts`
  - `scripts/pilot-readiness-check.ts`
  - `lib/presentation/sales-objection-followup-variants-contract.test.ts`
  - `lib/presentation/sales-objection-followup-variants-sprint1.test.ts`
  - `package.json`

## 对齐结论

已经一致：

- README 与 docs 索引都已暴露 sales objection / follow-up 报告入口
- demo / acceptance / delivery 文档都已承认这两页是 sales conversation 的更细下一层
- self-check 与 boundary check 都已知道这两页必须保留 scene / fallback / non-commitment
- regression 已把 sales objection / follow-up 专项测试纳入

仍需下一层：

- sales objection / follow-up 与更细邮件 / 口播模板的映射
- 与更多 conversation-related detail 节点的链路扩展

刻意未做：

- 不把这次对齐工作扩展成完整 sales enablement 平台或 CRM 平台

风险项：

- 如果后续新增 sales detail 页面但不接 chain / check / docs，会再次出现“页面一套、资产一套”的裂缝
