---
status: archived
owner: helm-core
created: 2026-04-09
review_after: 2026-10-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Page-Local Disclosure Follow-Through Report V1

更新时间：2026-04-09
结论：Completed

## 本轮目标

继续收掉上一轮 disclosure 减法后仍残留在页面局部首屏里的系统自述，重点只做两件事：

- 把 `meeting detail` 首屏里 page-local 的 “What Helm already prepared” 面板收回按需展开层
- 把 `dashboard` 首屏摘要里仍然前置的 “what Helm already moved” 改成更中性的业务表达

本轮不扩新页面，不改 approval / execution authority，不把 recommendation 写成 commitment。

## 已经完整成立

- `meeting detail` 首屏的 page-local prepared 面板已改成默认收起的 `review snapshot` disclosure，首屏只保留紧凑摘要，详细 fact / commitment / blocker / review gate 与导出动作移到展开层
- `meeting detail` 首屏里“Helm 正在用这些对象做什么”的解释性文案已改成更中性的对象状态描述，不再把系统过程直接摊在第一屏
- `dashboard` 首屏 guidance 摘要已从 “what Helm already moved” 改成 “what is already moving”，减少系统自述感
- hierarchy guard、self-check、boundary check、pilot readiness docs inventory 都已补上这一轮 follow-through 的约束和报告入口

## 已成形但仍需下一层

- 当前 guard 已经能防住这两类代表性回退，但仓库里仍然存在更多非首屏、非 page-local 的 “already prepared / already did” 文案；它们大多已经位于 shared disclosure 内，后续如果还要继续减轻系统存在感，可以再做一轮 wording audit
- 当前 `HelmDidBlock` disclosure summary 仍会显示首条 preview；这比平铺主位已经轻很多，但如果后续想继续收窄系统存在感，还可以再评估 summary preview 是否继续缩短

## 刻意未做

- 没有移除 meeting detail 里的 review posture、memory writeback、export bundle 这些真实有用的信息，只是把它们降到按需展开层
- 没有改写 reporting / proactive protocol 的 shared contract，也没有把已有 disclosure 结构再扩成新的抽象层
- 没有把 customer-facing、approval 或 operator-heavy 页面里已经在 disclosure 后面的系统说明全部重写一遍

## 风险项

- `meeting detail` 现在需要多一次点击才能看到完整 review snapshot，首次查看该页的用户会多一步展开动作
- guard 当前主要盯代表性字符串和标记位；如果未来有人用另一套新文案重新平铺首屏，仍需要 code review 和新的 guard 补位

## recommendation / commitment 稳定性

- 本轮只调整 page-local 首屏信息层级与措辞，不改变 `recommendation != commitment`
- approval、review、boundary 和 no auto-send / no broad auto-write 的现有边界保持不变
- 没有把系统准备内容改写成外部承诺、自动执行或自动发送

## 验证

- `npm run db:reset`：PASS
- `npm run self-check`：PASS
- `npm run check:boundaries`：PASS
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npm run test`：PASS（`152 files / 640 tests passed`）
- `npm run build`：PASS
- `npm run e2e`：PASS（`22 passed`）
- `npm run quality:regression`：PASS（`51 files / 180 tests passed`）

补充说明：

- `build` 首次复跑时暴露出一个现有的窄类型问题：`prisma/setup-db.ts` 在 `DATABASE_URL` fallback 已经存在的前提下，没有把类型收窄到 `string`。补上显式 fallback 后，重新跑完整链路通过
- `e2e` 首次走 Playwright 自带 `webServer` 链路时，Next 产物在 `/login` 上出现 `ChunkLoadError / client reference manifest` 缺失，导致单条 hydration 用例失败；重新做干净 `build`，再手动启动同一份生产服务并让 Playwright 复用现有服务后，22 项全量通过，没有复现 disclosure 页面级错误
