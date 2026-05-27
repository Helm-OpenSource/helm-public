---
status: archived
owner: helm-core
created: 2026-04-11
review_after: 2026-10-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# 页面去铺陈化 / 去系统自述化治理方案 V1 第四轮报告

## 本轮目标

把上一轮已经收口的 detail family 规则，继续扩到更广的 queue / workspace / panel surfaces，并把这件事从“人工改文案”升级成“项目级 copy audit 护栏”。

这一轮重点只做三件事：

1. 清理高频 operating surfaces 上残余的 `Helm already / Helm will / Helm advisory / What Helm can do now` 一类系统主语
2. 把 queue / workspace / panel surfaces 纳入单独的 broader surface copy audit
3. 明确 onboarding / setup / login 仍是保留展开解释的例外，而不是常态页面模板

## 已经完整成立

- [`dashboard/page.tsx`](../../app/(workspace)/dashboard/page.tsx)、[`meetings/page.tsx`](../../app/(workspace)/meetings/page.tsx)、[`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)、[`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx) 已把残余 `Helm will / Helm keeps / Helm-initiated` 文案改成对象优先表达
- [`queue-view.tsx`](../../features/customer-success-handoff/queue-view.tsx) 与 [`queue-model.ts`](../../features/customer-success-handoff/queue-model.ts) 已把 `Helm advisory`、`What Helm can do now`、`Resurfaced because` 等 queue 级标签收成对象优先标签
- [`imports-client.tsx`](../../features/imports/imports-client.tsx) 与 [`inbox-client.tsx`](../../features/inbox/inbox-client.tsx) 也已压掉高频首屏系统主语，避免 workspace surface 再从接入页和收件箱回弹
- [`proactive-mechanism-panel.tsx`](../../components/shared/proactive-mechanism-panel.tsx) 的协作模式标签已改成系统中性表达，不再把 panel 自身写成系统主语
- [`shared-surface-hierarchy-guards.test.ts`](../../lib/presentation/shared-surface-hierarchy-guards.test.ts) 与 [`helm-self-check.ts`](../../scripts/helm-self-check.ts) 已新增 broader surface no-Helm audit，直接守住 queue / workspace / panel 高流量面

## 已成形但仍需下一层

- 当前 broader surface audit 已经覆盖高频 operating surfaces，但 repo 里仍有部分 detail-model 的后层说明、非 operating 页面和部分 builder / settings 语境会保留更强的系统能力措辞
- onboarding / setup / login 仍保留默认展开解释，这属于项目明确保留的例外，不属于常规页面合同
- 法务、program catalog、少量非 operating 说明页仍可能带品牌主语，它们没有全部纳入本轮 no-Helm audit

## 刻意未做

- 不把项目做成“全仓禁止出现 Helm”这种误伤规则
- 不移除 evidence / audit / replay / trace
- 不削弱 boundary-first、review-first
- 不扩 execution authority、send authority 或高风险自动状态修改

## 风险项

- 如果后续新增高频 operating surface 没有进入 broader surface audit，仍可能重新长出 feature-local 的系统主语
- 目前的 broader surface audit 采用“这些高频页面不应再出现 Helm 文案”作为硬规则；一旦这些页面未来引入真正需要品牌主语的说明块，需要先同步调整合同和 guard
- 仍有少量非 operating / 非首屏语境保留品牌主语或系统能力表述，后续如果要做 repo 级全面清扫，需要再分一轮专门治理

## recommendation / commitment 稳定性

- 这轮继续没有削弱 recommendation / commitment 边界
- queue / workspace / panel surfaces 已进一步避免把系统能力、准备动作或解释口吻误读成已完成承诺
- high-frequency operating surfaces 的首屏现在更稳定地回到“对象、判断、动作、边界”主语

## 下一阶段最该做的 5 件事

1. 继续清理非 operating 但仍高曝光的页面文案，例如部分 settings / catalog / legal-adjacent 说明面
2. 把 remaining detail-model 的弱系统主语分层治理，避免为什么在后台层又长回去
3. 为新增 operating surface 提供默认接入 broader surface audit 的模板
4. 补一轮覆盖 dashboard / meetings / approvals / opportunities / imports / inbox / customer-success queue 的更完整 e2e copy regression
5. 继续把 onboarding 例外写清楚，避免后续把例外重新当成常态模板复用

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
