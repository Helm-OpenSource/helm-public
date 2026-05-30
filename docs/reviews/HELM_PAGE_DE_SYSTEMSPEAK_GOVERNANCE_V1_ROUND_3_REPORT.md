---
status: archived
owner: helm-core
created: 2026-04-11
review_after: 2026-10-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# 页面去铺陈化 / 去系统自述化治理方案 V1 第三轮报告

## 本轮目标

把第二轮之后剩余的 detail families 继续按同一份 business-first 合同收口，重点解决两类遗留问题：

1. legacy detail model 里的 system-self narration 仍会把 AI 推断写成“已经做过的动作”
2. 部分 detail view / meeting detail / queue model 仍保留 `What Helm already prepared`、`Helm AI work agent` 一类首屏或高频系统自述

本轮不扩新场景，只把剩余 detail family 的表达、护栏和文档继续压回统一真相。

## 已经完整成立

- 剩余 detail families 的 `detail-model.ts` 已继续改成对象优先表达，不再使用 `Helm already...`、`Helm has already...`、`Helm is already...`、`Helm resurfaced...`、`Helm AI work agent` 这类 system-self narration
- 剩余 detail families 的 `detail-view.tsx` 已继续改成对象优先 / 页面优先帮助文案，不再用 `Use this detail when Helm...`、`What Helm already prepared` 作为主叙事
- [`meeting-detail-client.tsx`](/Users/qianzhilong/Documents/helm/features/meetings/meeting-detail-client.tsx) 也已纳入同一合同，相关 prepared-summary prompt 改成 `What is already prepared from this meeting`
- [`queue-model.ts`](/Users/qianzhilong/Documents/helm/features/customer-success-handoff/queue-model.ts) 的残余 `Helm AI work agent` 也已收口成 `Prepared review surface`
- [`shared-surface-hierarchy-guards.test.ts`](/Users/qianzhilong/Documents/helm/lib/presentation/shared-surface-hierarchy-guards.test.ts) 已把 legacy detail model 一并纳入 copy audit，不只检查 detail view
- [`helm-self-check.ts`](/Users/qianzhilong/Documents/helm/scripts/helm-self-check.ts) 已把 detail model 与 meeting detail 一并纳入 systemspeak audit，形成产品级护栏

## 已成形但仍需下一层

- 当前 guard 已覆盖最强的一批 system-self narration，但 repo 内仍可能存在较弱的 agent-centered wording，需要后续继续做更宽口径审计
- 本轮主要收口的是 detail family；更广泛的 queue / panel / workspace surface 仍需继续保持同一份 copy governance，避免 feature-local 回弹
- `WorkerSummary` 的前置条件仍主要由页面层决定，尚未完全收成单独的共享 contract

## 刻意未做

- 不隐藏 evidence / audit / trace / replay，只继续把它们放在 disclosure / drawer 层
- 不削弱 boundary-first、review-first
- 不扩 execution authority、send authority 或高风险自动状态修改
- 不做全站 redesign，本轮只继续治理交互层级与页面表达

## 风险项

- 历史 freeze 报告、旧测试基线和少量非 detail 页面仍可能保留更温和的系统自述口径，后续若不继续接 guard 仍有回弹风险
- 本轮主要针对“把 AI 推断误写成已完成动作”的高风险表达；更泛化的品牌主语 / agent identity 仍需按优先级逐层收口
- README / docs / product report 已同步，但如果后续新增 detail family 不复用共享块，仍可能重新长出 feature-local 文案分叉

## recommendation / commitment 稳定性

- `prepared / reviewed / approved / executed / official` 的语义边界继续保持清楚，没有把 AI 推断写成外部已完成动作
- recommendation / explanation 仍未被抬升为 commitment
- boundary、prerequisite、dependency、non-commitment 仍保持前置可见，没有因为去系统自述而削弱 review-first

## 下一阶段最该做的 5 件事

1. 继续把较弱的 agent-centered wording 纳入更宽口径 copy audit，而不只盯最显眼的 `Helm already...`
2. 把 `WorkerSummary` 何时允许前置抽成更硬的共享规则
3. 继续把 queue / workspace / panel 型页面纳入同一份 systemspeak guard，减少 feature-local 文案回弹
4. 补一轮覆盖 representative detail family 的更完整 e2e hierarchy / disclosure 默认态验证
5. 把去系统自述治理结果继续沉淀到后续新页面模板，避免新 surface 从旧骨架重新长出来

## 验证结果

- `npm run db:reset` 通过
- `npm run self-check` 通过
- `npm run check:boundaries` 通过
- `npm run typecheck` 通过
- `npm run lint` 通过
- `npm run test` 通过
- `npm run build` 通过
- `npm run e2e` 通过
- `npm run quality:regression` 通过
