---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Dashboard Review-First Work Entry Polish Report v1

日期：2026-04-21

## 1. 结论

本轮只收口 `/dashboard` 在 `review-heavy` 状态下的首屏工作入口。

当前已经成立：

1. dashboard 首屏新增一条主动作轨，直接前置：
   - 先处理
   - 复核压力
   - 继续入口
   - 当前阻塞
2. 当待复核事项已经成为 Top work items 时，复核区不再完整重复同一组卡片，而是降级成复核队列摘要。
3. 复核队列摘要继续保留审批边界和第一条复核入口，不扩大执行、发送或承诺权限。
4. 本轮使用 Playwright 真实页面路径和 Computer Use Safari 复查确认页面可进入、可读、可操作。

2026-04-22 继续用 Computer Use 从 `/demo` 进入销售团队演示后，又补了一层 accessibility follow-through：销售模式 dashboard 的“当前工作”动作轨现在会作为 `当前工作快速动作` 独立暴露，四个关键入口分别是具名 link，而不是混在一整段 text 里。随后继续复查动作目标，发现 `查看队列` 的名称已经正确，但目标仍指向首条审批预览；本轮已把它改为复核队列锚点，保留 `现在复核` 继续进入具体预览。

## 2. 方案

本轮改动保持在 dashboard 工作入口内部：

- `features/dashboard/home-work-entry.ts`
  - 新增 `reviewItemsArePrimary` 展示标志。
  - 当 `review-heavy` 状态下 Top work items 全部来自 review queue 时，标记为 true。
- `features/dashboard/home-work-entry-surface.tsx`
  - 新增顶部主动作轨。
  - 在 `reviewItemsArePrimary` 时用复核队列摘要替代重复的完整复核卡片。
  - 让顶部主动作轨使用命名 `nav`，并给每个动作链接补上“动作 + 对象”的可读标签。
  - 让顶部主动作轨的 `查看队列` 链接进入 `/approvals#approval-queue`，避免队列动作误开首条审批预览。
- `components/shared/first-loop-tracked-action-button.tsx`
  - 允许 tracked action link 接收 `ariaLabel`，同时保留 adoption trace 不阻塞导航的行为。
- `features/dashboard/home-work-entry.test.ts`
  - 覆盖 review-heavy 状态下复核队列成为主工作的模型契约。
- `features/dashboard/home-work-entry-surface-accessibility.test.ts`
  - 固定 dashboard 首屏快速动作必须保持命名导航和具名链接。

## 3. 受影响组件

- Dashboard 首页工作入口
- Review-heavy 状态的审批入口展示
- Dashboard surface routing 不变
- 审批状态机、权限、查询和 runtime 不变

## 4. 权衡

- 选择新增轻量主动作轨，而不是重做 dashboard：
  - 保留现有页面结构和 e2e surface routing contract。
  - 只改善用户进入页面后的第一判断和第一点击。
- 选择队列摘要，而不是隐藏复核区：
  - 避免重复卡片压屏。
  - 继续让审批边界在首屏可见。

## 5. 验证结果

已通过：

```bash
npm run test -- features/dashboard/home-work-entry.test.ts features/dashboard/home-surface-routing.test.ts
npm run test -- features/dashboard/home-work-entry-surface-accessibility.test.ts features/dashboard/home-work-entry.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
git diff --check
npm run quality:regression
```

说明：

- `npm run lint` 通过，保留仓库既有 7 条 unused warning，本轮无新增 error。
- `npm run build` 通过，保留既有 `next.config.ts` NFT trace warning。
- `npm run quality:regression` 通过，51 个 test files / 180 个 tests passed。
- 2026-04-22 follow-through：`npm run test -- features/dashboard/home-work-entry-surface-accessibility.test.ts features/dashboard/home-work-entry.test.ts` 通过，2 个 test files / 7 个 tests passed。
- 2026-04-22 follow-through：`npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`git diff --check`、`npm run lint`、`npm run build`、`npm run quality:regression` 均通过。
- 2026-04-22 action-target follow-through：`npm run test -- features/dashboard/home-work-entry-surface-accessibility.test.ts features/dashboard/home-work-entry.test.ts`、`git diff --check`、`npm run typecheck`、`npm run self-check`、`npm run check:boundaries`、`npm run lint` 均通过。
- `npm run lint` 仍保留仓库既有 7 条 warning，无 error。
- `npm run build` 仍保留既有 Turbopack NFT trace warning。
- `npm run quality:regression` 通过，51 个 test files / 181 个 tests passed。
- `nc -z 127.0.0.1 3306` 返回 `mysql_3306_status=1`，完整 DB-backed `npm run test` / `npm run e2e` 需本地 MySQL 恢复后补跑。

页面复检：

- Playwright 打开 `http://localhost:3000/demo` / `http://localhost:3000/dashboard` 并保存截图：
  - `<local-screenshot-dir>/helm-dashboard-before-computeruse.png`
  - `<local-screenshot-dir>/helm-dashboard-after-computeruse.png`
  - `<local-screenshot-dir>/helm-dashboard-after-scroll-computeruse.png`
- Computer Use 读取 Safari 页面后确认：
  - 已进入 `localhost:3000/dashboard`
  - 可读到主动作轨：`先处理 / 复核压力 / 继续入口 / 当前阻塞`
  - 可读到复核队列摘要和下层 disclosure
- 2026-04-22 Computer Use 复核确认：
  - 从 `/demo` 点击 `进入销售团队演示` 后进入销售模式 dashboard。
  - 首屏主动作轨暴露为 `当前工作快速动作`。
  - `现在复核: 发送 NorthBridge 会后 ROI 邮件`、`查看队列: 2 个动作待审批`、`打开当前锚点: 当前推导锚点`、`查看阻塞: 当前最高风险链：Cedar Commerce 恢复试点` 均为独立 link。
  - 点击 `现在复核: 发送 NorthBridge 会后 ROI 邮件` 后进入 `/approvals?approvalId=...#approval-preview`，并打开对应复核抽屉。
  - 继续复查发现 `查看队列: 2 个动作待审批` 的目标原本仍是 `/approvals?approvalId=...#approval-preview`；已改为 `/approvals#approval-queue`，让队列动作和具体复核动作分离。
  - 点击 `查看队列: 2 个动作待审批` 后进入 `/approvals#approval-queue`，页面落在队列控制区，没有带 `approvalId` 自动打开具体审批预览。

待跑：

```bash
npm run db:reset
npm run test
npm run e2e
```

说明：2026-04-22 follow-through 没有执行上述 DB-backed / destructive 链路；`127.0.0.1:3306` 仍不可达，`db:reset` 也有破坏性数据库重置副作用。

## 6. 剩余风险

1. 本轮没有改变底层排序逻辑，只改善 review-heavy 首屏展示。
2. 复核队列摘要仍会展示审批标题；这属于队列可读性保留，不是完整重复卡片。
3. 移动端视觉只通过响应式类约束，尚未单独做 mobile screenshot。
4. 完整 e2e 和 full test 尚未跑完。

## 7. 下一步建议

1. 如继续优化 dashboard，下一刀应处理移动端首屏密度和 Topbar sticky 遮挡感。
2. 如继续用 Computer Use 评估，优先点进 `现在复核`，检查从 dashboard 到 approvals 的到达契约。
3. 合并前再决定是否补 `db:reset / full test / e2e`。
4. 不建议在本轮继续扩大到 operating / reports / approvals 的 broad redesign。
