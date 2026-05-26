---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Demo Reentry Loading Recovery Computer Use Polish Report v1

日期：2026-04-22
状态：Non-Destructive Validation Passed; Full DB-Backed Test Blocked By Local MySQL

## 结论

本轮继续用 Computer Use 复评 Safari 真实窗口，发现直接进入 `localhost:3000/demo` 时，页面会停在 root streaming fallback，显示“工作区确认 / 正在确认你的经营工作区”。这对公开演示入口不顺：用户本来要选 demo，却先看到 protected workspace recovery 语言。

本轮已把 `/demo` 恢复层改成可用的迷你演示选择器：即使完整 demo page 没有立刻替换出来，用户也能直接点 `进入创始人 / COO 演示`、`进入销售团队演示` 或 `进入猎头顾问演示`，并保留 `已有工作台` 与 `公开入口` 两个退出路径。

同时，`/demo` 页面本身不再为了渲染公共入口而先查询 `getCurrentUser()`。已有工作区入口改为静态 `/dashboard`，由现有 session / proxy 链路判断是否进入工作台或回到登录入口。

继续用 Computer Use 点击 `/demo` fallback 的创始人演示入口后，Safari 会进入 `/dashboard`，但如果本地 Safari 没有及时执行 RSC streaming reveal，仍会停在 root loading fallback。这个全局 fallback 已同步增强为三条可恢复路径：`回到登录入口`、`重试打开工作台`、`选择演示工作区`，并保留 `公开首页`。`选择演示工作区` 进一步改成 `/demo?recovery=loading`，避免用户已经在 `/demo` loading 态时点击原地不动。

第二轮 Computer Use 继续验证了这条恢复路径：Safari 的 loading recovery actions 已暴露成独立按钮，可从卡住态回到完整 `/demo` 页面；随后再次点击 `先看创始人 / COO 演示` 可进入 `/dashboard`。这一轮还修正了 dashboard shell / topbar 在真实 Safari 桌面窗口里的横向溢出：工作台外层收紧为 `min-w-0 / max-w-full / overflow-x-hidden`，顶栏工具在中等桌面宽度优先显示图标，文字到更宽屏再展开。

第三轮继续用 Computer Use 从 `/approvals` 刷新进入全局 loading recovery，点击 `选择演示工作区` 后发现 URL 会变成 `/demo?recovery=loading`，且恢复状态会残留在真实演示入口 URL 上。`recovery=loading` 没有实际路由处理，只是测试固定住的 query；它让恢复入口看起来像又进入了另一轮 loading。现在全局 recovery actions 已改成稳定目标：`/dashboard` 和 `/demo`，不再把恢复状态透传到下一页。

最后一次 Computer Use 复核把 Safari 旧标签从 `/demo?recovery=loading` 收回干净 `localhost:3000/demo`，完整演示入口仍然可见，首屏不再表现为恢复壳。

2026-04-22 继续用 Computer Use 复跑时，Safari 再次停在全局 `正在打开你的经营入口` fallback；点击 `选择演示工作区` 后 URL 能变为 `/?view=public#entry`，但仍可能短暂停留在同一 fallback。为避免 fallback 只提供再次跳转，本轮把三套演示工作区直接加入全局 loading recovery：即使 RSC streaming reveal 没有及时完成，用户也能在当前卡片内直接点 `进入创始人 / COO 演示`、`进入销售团队演示` 或 `进入猎头顾问演示`。同时继续保留 `demoRecoveryBaseHref = "/demo"` 守卫 marker，最终 CTA 优先使用 `copy.demoHref` 指向公开入口。

同日继续用 Computer Use 从带 `#memory-work-timeline` 的页面触发 loading recovery，确认 server action redirect 到 `/dashboard` 会继承旧 fragment，导致用户看到 `/dashboard#memory-work-timeline` 这种错误锚点。实验证实 HTTP 302 的 Location 如果没有 fragment，浏览器会沿用原 fragment；本轮新增 `withLoadingRecoveryFragmentReset()`，让 global loading 和 `/demo/loading` 的 demo workspace target 显式带空 fragment。修复后 Safari 再点 `进入销售团队演示`，地址变成干净 `/dashboard`，不再继承旧 memory hash。

同一轮还把全局 loading fallback 增加为真正的工作区恢复层：如果 Safari 仍没有及时 reveal dashboard，fallback 现在除登录、重试、公开/demo 入口外，还提供 `查看复核队列`、`打开经营记忆`、`查看机会推进` 三个工作出口。它们只是导航，不生成报告、不审批、不对外发送。

## 影响面

- `app/demo/page.tsx`
- `app/demo/loading.tsx`
- `app/loading.tsx`
- `components/layout/app-shell.tsx`
- `components/layout/topbar.tsx`
- `lib/demo/demo-entry-shell.test.ts`
- `lib/presentation/loading-recovery.ts`
- `lib/presentation/loading-recovery.test.ts`
- `scripts/decision-first-boundary-check.ts`
- `PLANS.md`
- `docs/README.md`
- `docs/reviews/HELM_DEMO_REENTRY_LOADING_RECOVERY_COMPUTER_USE_POLISH_REPORT_V1.md`

## 已经完整成立

- Computer Use 已复现 `/demo` 被旧“工作区确认”fallback 抢首屏的问题。
- `/demo/loading.tsx` 现在使用演示入口语言，不再显示“工作区确认 / 正在确认你的经营工作区”。
- `/demo` fallback 提供三套 demo 的真实进入按钮，而不是只提供重试链接。
- `/demo` 主页面不再导入或调用 `getCurrentUser()`，公共入口不依赖当前用户 DB 查询。
- 全局 loading fallback 不再只有登录和原地重试，已经补上 `选择演示工作区` 和 `公开首页` 恢复路径。
- 全局 loading fallback 现在直接带三套 demo 表单，不依赖隐藏完整页面 reveal 后才能选择演示工作区。
- 全局 loading fallback 现在带复核队列、经营记忆和机会推进三个工作区恢复捷径。
- loading recovery 的 demo workspace target 会显式清掉旧 fragment，避免从 memory/approvals 等页面继承错误 hash 到 dashboard。
- `/demo/loading.tsx` 的 demo workspace target 也使用同一个 fragment reset helper，避免同类恢复链路回退。
- 全局 loading recovery actions 在 Safari accessibility tree 中已经暴露为独立按钮。
- `/demo` recovery 入口现在使用稳定 `/demo`，不再把 `?recovery=loading` 带进真实演示入口。
- `/dashboard` 工作台 shell 已收紧横向宽度；Computer Use 复核后底部横向滚动条消失。
- Playwright 已覆盖 1024 到 1600 的桌面宽度，确认 `/demo -> /dashboard` 后没有页面级横向溢出。
- Playwright 已验证 fallback 上的 `进入创始人 / COO 演示` 能进入 `/dashboard`，且 dashboard 首个 `h1` 为 `目标推进台`。

## 已成形但仍需下一层

- Safari 当前仍可能短暂停在 root fallback；本轮已让 fallback recovery 可操作并关闭 stale hash 继承，但不能写成已经从根上修复 RSC streaming reveal。
- `/dashboard` 真实内容在 Playwright 中可达；Safari 的全局 fallback 现在可恢复，但 root cause 仍需要下一轮定位。
- 完整 e2e 与 DB-backed runtime tests 仍需要本地 MySQL 恢复后补跑。

## 刻意未做

- 不改 auth session、workspace membership、proxy guard、demo account、权限模型或 DB schema。
- 不把 demo 入口升级成自动执行面；fallback 只登录演示账号并进入 dashboard。
- 不改 dashboard 查询、审批、报告生成、发送权限或 recommendation / commitment 边界。
- 不改用户本机 Safari 设置。

## 风险项

1. Safari 如果继续不能 reveal RSC streamed content，workspace 页面仍会依赖 fallback recovery。
2. 顶栏文字延后到 `2xl` 展开后，中等桌面宽度的工具按钮更偏图标化；当前用 title / aria-label 保留可理解性。
3. `/demo/loading.tsx` 与 `/demo/page.tsx` 目前各自有 demo login server action；后续若演示登录规则变化，需要同步。
4. 完整 DB-backed validation 未完成前，不能把本轮写成全站恢复路径关闭。
5. 若未来要彻底关闭 Safari root fallback 停留，需要继续定位 RSC reveal / Safari runtime 行为；当前是产品化恢复层。

## 验证清单

已执行：

```bash
npm run test -- lib/demo/demo-entry-shell.test.ts lib/demo/demo-modes.test.ts lib/presentation/loading-recovery.test.ts
npm run test -- lib/presentation/loading-recovery.test.ts
npm run test -- lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
npm run test
git diff --check
node --input-type=module <playwright demo fallback to dashboard check>
node --input-type=module <playwright demo to dashboard responsive overflow check>
curl -sS -m 8 http://localhost:3000/demo
lsof -nP -iTCP:3000 -sTCP:LISTEN && screen -ls
```

结果：

- 3 files / 9 tests passed。
- `typecheck` passed。
- `self-check` passed；11/11。
- `check:boundaries` passed。
- `git diff --check` passed。
- `lint` passed；保留 7 个既有 warning，无 error。
- `build` passed after the final `next/link` correction；保留既有 Turbopack NFT trace warning。
- `quality:regression` passed；51 files / 181 tests。
- `npm run test` attempted；271 files / 1155 tests passed，6 个 DB runtime test files / 15 tests failed，统一原因是 Prisma 无法连接 `127.0.0.1:3306`。
- `curl /demo` confirmed fallback contains `选择一套演示工作区` and the three demo entry buttons, and no longer contains `工作区确认` / `正在确认你的经营工作区` in the visible fallback.
- Computer Use confirmed Safari `/demo` now shows `选择一套演示工作区` with the three demo buttons.
- Computer Use clicked `进入创始人 / COO 演示`; Safari redirected to `/dashboard`, then still showed the global workspace confirmation fallback.
- Computer Use confirmed the follow-up global fallback issue, then the root fallback copy/links were updated to `入口确认 / 正在打开你的经营入口 / 回到登录入口 / 重试打开工作台 / 选择演示工作区 / 公开首页`.
- Computer Use confirmed the global fallback actions are now exposed as separate buttons in Safari.
- Computer Use confirmed `选择演示工作区` can recover Safari from loading fallback back to the full `/demo` chooser.
- Computer Use later confirmed `选择演示工作区` used to land on `/demo?recovery=loading`; the recovery CTA now points to stable `/demo` and `/dashboard` targets instead.
- `npm run test -- lib/demo/demo-entry-shell.test.ts lib/presentation/loading-recovery.test.ts` passed；2 files / 6 tests.
- Computer Use clicked `先看创始人 / COO 演示`; Safari reached `/dashboard`, and the bottom horizontal scrollbar seen before the shell fix is gone.
- Computer Use returned the old `/demo?recovery=loading` tab to clean `localhost:3000/demo`; the visible page remains the usable demo chooser.
- Playwright confirmed `/demo -> /dashboard` at 1024 / 1180 / 1280 / 1320 / 1366 / 1440 / 1512 / 1600 has no document-level horizontal overflow.
- Computer Use returned Safari to `http://localhost:3000/demo`; the visible page is the usable demo chooser.
- `curl /demo` confirmed the streamed HTML still includes hidden full demo content plus React reveal script markers, so the fallback work is a recovery layer rather than a replacement for the full page.
- Playwright confirmed the same fallback button can reach `/dashboard` and render `目标推进台`; Chromium body no longer includes the workspace confirmation fallback after dashboard load.
- 2026-04-22 续跑 Computer Use confirmed Safari can recover from loading fallback to `/?view=public#entry`, where the public entry exposes `打开创始人工作台 / 打开销售工作台 / 打开招聘工作台`.
- 2026-04-22 targeted suite passed：`npm run test -- lib/presentation/loading-recovery.test.ts features/memory/memory-approval-evidence-context.test.ts features/approvals/approval-drawer-accessibility.test.ts features/approvals/approval-memory-context-link.test.ts`，4 files / 12 tests.
- 2026-04-22 non-destructive validation passed：`npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`；lint 仍为 7 个既有 warning，无 error。
- 2026-04-22 loading fragment reset suite passed：`npm run test -- lib/presentation/loading-recovery.test.ts`，1 file / 4 tests。
- 2026-04-22 loading workspace shortcuts suite passed：`npm run test -- lib/presentation/loading-recovery.test.ts lib/demo/demo-entry-shell.test.ts`，2 files / 8 tests。
- 2026-04-22 Computer Use confirmed：修复前从带旧 hash 的 fallback 点 `进入销售团队演示` 会到 `/dashboard#memory-work-timeline`；修复后同一路径到 `/dashboard`，旧 hash 已清掉。
- 2026-04-22 Computer Use confirmed：Safari 随后 reveal 到真实 dashboard，首屏为 `目标推进台`。
- 2026-04-22 Playwright confirmed：Chromium 从公开入口进入销售工作台后 URL 为 `/dashboard`，首个 h1 为 `目标推进台`，body 不包含 `正在打开你的经营入口`。
- 2026-04-22 redirect probe confirmed：302 Location `/target` 会继承旧 hash，`/target#` 会清掉旧 hash。
- Dev server is running on port 3000 inside detached `screen` session `helm-dev`; use `http://localhost:3000` rather than `127.0.0.1` to avoid Next dev origin blocking.
- `nc -z 127.0.0.1 3306` returned exit 1；本地 MySQL 仍不可达。

未执行：

- `npm run db:reset`：破坏性数据库重置，且本地 MySQL 当前前提仍不可用。
- `npm run e2e`：完整 DB-backed 链路需恢复 MySQL 后补跑；本轮已用定向测试、typecheck、curl、Computer Use、Playwright 和非 DB 回归覆盖受影响面。
