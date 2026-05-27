---
status: archived
owner: helm-core
created: 2026-04-11
review_after: 2026-10-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# 页面去铺陈化 / 去系统自述化治理方案 V1 第二轮报告

## 本轮目标

把上一轮主要落在 legacy detail cluster 的三层合同，继续扩到共享 reporting / proactive panel 与 customer success queue，并把高频页面的对象优先文案和产品级护栏一起补齐。

本轮重点只做三件事：

1. 让 shared panel 与 queue 也遵守 `Current summary -> Decision request -> Next action -> Boundary -> Review snapshot -> Evidence`
2. 继续压低高频页面首屏的 system-first copy
3. 把 shared guard、copy audit、自检、边界检查和 e2e 一起补到位

## 已经完整成立

- [`reporting-protocol-panel.tsx`](../../components/shared/reporting-protocol-panel.tsx) 已切到 `frontstage / midstage / backstage / evidence` 四段结构，前台层只保留 `Current summary / Decision request / Next action / Boundary`
- [`proactive-mechanism-panel.tsx`](../../components/shared/proactive-mechanism-panel.tsx) 已切到同一套结构，不再让系统解释块占据首屏主叙事
- [`queue-view.tsx`](../../features/customer-success-handoff/queue-view.tsx) 已收口到同一套 business-first 骨架，`ReviewSnapshotBlock` 与 `WhyItMattersBlock` 明确下沉
- `dashboard`、`approvals`、`opportunities`、customer success queue model 的高频文案已改成对象优先，不再默认以 `Helm already...` 作为首页主语
- [`shared-surface-hierarchy-guards.test.ts`](../../lib/presentation/shared-surface-hierarchy-guards.test.ts)、[`helm-self-check.ts`](../../scripts/helm-self-check.ts)、[`decision-first-boundary-check.ts`](../../scripts/decision-first-boundary-check.ts) 已把 shared panel、queue 和 detail cluster 的首屏预算 / copy audit 一起纳入

## 已成形但仍需下一层

- repo 内仍有其他 detail model / detail page 保留 `Helm has already...`、`already moved...`、`Helm AI work agent` 等 legacy 表达，本轮没有做全量收口
- `WorkerSummary` 的前置条件仍主要由页面层策略控制，尚未完全结构化成统一 contract
- 并非所有非 detail 高频页面都已经切到相同的 shell；本轮先覆盖 shared panel 与 customer success queue

## 刻意未做

- 不隐藏 evidence / audit / replay / trace，只把它们继续收进 disclosure / drawer
- 不削弱 boundary-first 与 review-first
- 不扩 execution authority、send authority 或高风险自动修改权限
- 不做全站 redesign，本轮只治理交互层级与表达顺序

## 风险项

- 历史 freeze 报告、旧测试基线和部分 feature-local 文案里仍保留 system-first wording，后续新页面如果不接共享 guard 仍有回弹风险
- 共享 panel 已收口，但剩余未覆盖的 detail families 仍可能通过 model 文案把 AI 推断误读成已完成动作
- `Helm AI work agent` 身份提示仍存在于部分二级表面；如果不继续清理，会削弱“首屏只讲对象”的一致性

## recommendation / commitment 稳定性

- recommendation / explanation 仍未被抬升为 commitment
- `prepared / reviewed / approved / executed / official` 的区分在 shared panel 和 queue 上进一步清楚，降低了 AI 推断被误解成外部已完成动作的风险
- boundary、prerequisite、dependency、non-commitment 仍保持前置可见

## 下一阶段最该做的 5 件事

1. 继续清理剩余 legacy detail families 的 system-first copy 与旧骨架
2. 把 `WorkerSummary` 何时前置抽成更硬的共享规则，而不是只靠页面层判断
3. 把 copy audit 从当前高频面继续扩到更多 repeat-use surfaces
4. 继续减少非 onboarding 页面默认展开的系统解释块
5. 补一轮覆盖 shared panel + queue + representative detail 页的更完整 e2e hierarchy 回归

## 验证结果

- `npm run db:reset` 通过
- `npm run self-check` 通过
- `npm run check:boundaries` 通过
- `npm run typecheck` 通过
- `npm run lint` 通过
- `npm run test` 通过，157 个文件 / 667 个测试
- `npm run build` 通过
- `npm run e2e` 通过，26 个测试
- `npm run quality:regression` 通过，51 个文件 / 180 个测试
