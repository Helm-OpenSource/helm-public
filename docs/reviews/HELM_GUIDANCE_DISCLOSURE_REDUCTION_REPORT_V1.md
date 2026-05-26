---
status: archived
owner: helm-core
created: 2026-04-09
review_after: 2026-10-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Guidance Disclosure Reduction Report V1

更新时间：2026-04-09
结论：Completed

## 本轮目标

把重复使用页面里过于前置的智能说明收回到按需展开层，避免：

- 建议动作长期抢占第一屏主位
- why-it-matters 长解释打断主判断
- `Helm already did / prepared` 变成系统自述噪音

本轮只做 shared disclosure 减法，不扩新场景，不改 execution authority，不把 Helm 写成 chat-first 产品。

## 已经完整成立

- `WorkspaceGuidancePanel` 现在默认用 disclosure 承载建议、提醒和边界，重复使用页面先显示标题与摘要，不再默认平铺整段智能说明
- `WhyItMattersBlock` 与 `HelmDidBlock` 现在默认折叠，只有用户主动展开时才看完整理由和系统已准备内容
- `dashboard` 首页不再单独拿一张首屏 `Helm already moved` 卡片占主位，系统自述改回按需查看
- login / setup / onboarding / participant portal onboarding 这类首次进入路径仍可保留默认展开，避免第一次使用完全失去引导

## 已成形但仍需下一层

- 当前收口主要覆盖 shared guidance substrate 和 shared narrative block；仓库里仍有少量页面保留 page-local 的 “Helm already prepared” 表达，后续可继续收口到同一 disclosure 语法
- 当前 disclosure 仍是 local UI posture，不做 server-side per-user preference sync，也不做跨设备个性化记忆

## 刻意未做

- 没有移除 judgement / decision request / boundary / action rail 这些仍应前置的信息
- 没有隐藏 evidence drawer、audit、trace 的存在，只是继续保持按需查看
- 没有把 guidance 改写成自动执行、自动承诺或自动发送

## 风险项

- 对首次使用者来说，部分说明默认收起后会多一次点击成本，所以本轮只给 onboarding / setup 入口保留默认展开
- 仍有少量 feature-local 自述文案没有接到 shared disclosure 组件，后续新页面如果继续直接平铺，界面仍可能重新变重

## recommendation / commitment 稳定性

- 本轮只调整信息层级，不改变 `recommendation != commitment`
- boundary note 继续保留，不把 explanation 写成外部承诺
- 没有扩 execution authority、no auto-send、no broad auto-write 仍保持不变

## 验证

- `npm run db:reset`：PASS
- `npm run self-check`：PASS
- `npm run check:boundaries`：PASS
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npm run test`：PASS（`152 files / 632 tests passed`）
- `npm run build`：PASS
- `npm run e2e`：PASS（`22 passed`）
- `npm run quality:regression`：PASS（`51 files / 180 tests passed`）

补充说明：

- `build` 首次执行遇到本地 `.next/dev/lock` 残留；清理该缓存锁后重跑通过
- `e2e` 首次执行在 Playwright 自带 webServer 链路下出现服务中断；复用手动启动的同一生产服务后全量通过，未复现页面级运行错误
