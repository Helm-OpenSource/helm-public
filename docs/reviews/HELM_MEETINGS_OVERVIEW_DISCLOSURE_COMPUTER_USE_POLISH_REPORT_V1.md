---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Meetings Overview Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Validation Passed; Full DB / E2E Not Run In This Slice
当前切片：`Computer Use attempted; Playwright confirmed /meetings default Chinese surface no longer exposes target briefing / review / blocker / posture / wedge terms`

## 1. 目标

这次继续处理 `/meetings` 默认页的系统语和交互噪音：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari / Atlas 不可用时，用 Playwright 操作真实本地页面复评。
2. 把 `Meeting OS wedge / briefing / review / blocker / posture / recommendation` 等默认可见实现词，收成中文会议推进语言。
3. 把会议卡片里重复出现的“当前下一步 / 边界状态”面板去重，让默认列表先保持可扫读。
4. 保留会议、审批、记忆、会后动作和边界判断底层 truth，不改写数据模型或执行权限。

## 2. 本轮不做

- 不改会议详情页、Helm v2 runtime card 或 meeting detail 深层调试区。
- 不改会议创建、纪要、审批、记忆写入、会后动作或 DingTalk 只读汇报行为。
- 不把会议页扩成完整 workflow、calendar、agent orchestration 或 auto-execution plane。
- 不扩大自动发送、自动承诺或自动写回权限。

## 3. 影响面

- `features/meetings/display-copy.ts`
- `features/meetings/display-copy.test.ts`
- `app/(workspace)/meetings/page.tsx`
- `PLANS.md`
- `docs/README.md`
- `docs/reviews/HELM_MEETINGS_OVERVIEW_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 验证

- `npm run test -- features/meetings/display-copy.test.ts features/imports/display-copy.test.ts` passed；2 files / 2 tests。
- `npm run typecheck` passed。
- Playwright `/meetings` 创始人 Demo 桌面 1440x1100：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，`bodyDelta = 0`，console errors 0。
- Playwright `/meetings` 创始人 Demo 移动 390x844：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，`bodyDelta = 0`，console errors 0。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `git diff --check` passed。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run test` attempted；15 个 DB-backed Helm v2 runtime tests 因本地 MySQL `127.0.0.1:3306` 不可达失败，非本轮会议默认页回归。
- `npm run db:reset` 未执行：破坏性数据库重置，且当前 MySQL 前提不可用。
- `npm run e2e` 未执行：当前完整测试已暴露 MySQL 前提不可用，本轮用定向 Playwright 覆盖页面桌面/移动真实 Demo 流程。

## 5. 剩余风险

1. 会议详情页的 Helm v2 runtime / opportunity judge / debugger 深层区仍有大量内部英文词；本轮只处理 `/meetings` 默认概览。
2. `formatMeetingDisplayText` 只用于默认文案和可见议程，避免过度重写用户输入；后续如果要处理更多动态内容，需要逐区评估。
3. Computer Use 目前能列出 App，但 Safari / Atlas 窗口读取仍返回 `cgWindowNotFound`；后续仍需继续尝试。
