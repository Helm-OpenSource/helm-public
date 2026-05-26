---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Customer Success Detail Disclosure Computer Use Polish Report V1

日期：2026-04-21
状态：Validation passed

## 1. 结论

本轮继续按真实页面循环推进 `/customer-success/[id]`。Computer Use 仍未能稳定控制浏览器窗口：Safari 返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝。因此本轮继续用 Playwright 操作本地 `localhost:3000` 页面做真实路径复评，并保留 Computer Use 尝试记录。

复评发现 customer-success 详情页仍把交接链、发送边界、接手责任、证据和草稿治理全部摊在默认层。用户进入详情页时应该先看当前判断、待拍板、下一步动作和边界；跨详情交接、对外草稿和治理进度应按需展开。

本轮已把详情页默认层收成中文判断优先视图，并把跨详情交接链和对外草稿改为默认关闭的操作抽屉。

## 2. 方案

- 在 customer-success 详情入口新增显示层适配，中文模式只格式化展示文本，不改数据属性、路由、枚举状态或权限状态。
- 复用并扩展 customer-success 中文展示映射，把 `customer success / review-before-send / follow-through / owner / sendability / policy / detail` 等系统词转成中文经营语言。
- 把详情页 `advisory / policy / secondary decision / recent / progress` 说明收进证据附注，默认层保留当前判断、待拍板、下一步和边界。
- 把跨详情交接链从默认展开改为默认关闭，只保留“需要完整交接链时再展开”。
- 把对外草稿面板改为默认关闭，避免用户先读客户可见措辞草稿再完成判断。
- 把共享详情导航中的中文节点名、打开动作和 operating foundation 中文输出从英文系统标签改为中文经营标签。

## 3. 受影响组件

- `features/customer-success-handoff/detail-view.tsx`
- `features/customer-success-handoff/display-copy.ts`
- `features/customer-success-handoff/external-drafts-panel.tsx`
- `components/shared/unified-detail-navigation-panel.tsx`
- `lib/operating-system/foundation.ts`
- `lib/operating-system/foundation.test.ts`
- `lib/presentation/customer-success-handoff-v1_1.test.ts`
- `PLANS.md`
- `docs/README.md`

## 4. 权衡

- 好处：详情页默认进入判断和动作，不再像内部运行协议展开页。
- 好处：交接链、草稿、证据和治理进度没有删除，展开后仍可审计。
- 好处：桌面和手机上都消除了默认可见的系统词和横向溢出。
- 代价：需要看完整跨详情交接链或对外草稿时多一步展开。
- 代价：底层模型仍保留内部协议真值，这是审计层的刻意保留。

## 5. Computer Use / 页面复评结果

Computer Use 尝试结果：

1. `get_app_state(Safari)` 返回 `cgWindowNotFound`
2. `get_app_state(com.apple.Safari)` 返回 `cgWindowNotFound`
3. `get_app_state(ChatGPT Atlas)` 被 MCP 权限拒绝

Playwright 复评结果：

1. demo 登录后打开 `http://localhost:3000/customer-success/cmnzwr56h001g7ntg8qwm004u`
2. 桌面 1440px 默认层 forbidden terms 计数为 0
3. 移动 390px 默认层 forbidden terms 计数为 0
4. 桌面 1440px：`scrollWidth === clientWidth`，可见元素无横向溢出
5. 移动 390px：`scrollWidth === clientWidth`，可见元素无横向溢出
6. 默认关闭的抽屉包括 `跨详情交接`、`已准备外部草稿`、`已准备动作`、`为什么现在要注意` 和 `证据抽屉`
7. 默认层仍保留下一步动作、内部批准按钮、边界和相关详情入口

## 6. 验证结果

已通过：

```bash
npm run test -- features/customer-success-handoff/display-copy.test.ts lib/operating-system/foundation.test.ts lib/presentation/customer-success-handoff-surface-contract.test.ts lib/presentation/customer-success-handoff-v1_1.test.ts lib/presentation/customer-success-deeper-polish.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

结果：

- targeted tests：5 files / 32 tests passed
- `typecheck`：passed
- `self-check`：passed
- `check:boundaries`：passed
- `lint`：passed with 7 existing warnings
- `build`：passed; existing Turbopack NFT warning remains
- `quality:regression`：passed; 51 files / 180 tests passed
- `git diff --check`：passed
- Playwright 桌面复评：passed
- Playwright 移动复评：passed

未执行：

```bash
npm run db:reset
npm run test
npm run e2e
```

原因：`npm run db:reset` 会重置本地数据库，属于本地数据删除/重建动作，未在没有单独确认的情况下执行；完整 `npm run test` 和 `npm run e2e` 仍依赖当前不可达的 MySQL `127.0.0.1:3306`。

## 7. 剩余风险

1. 证据抽屉展开后仍是内部运行视图，保留 protocol 语义。
2. 共享详情导航的交接链默认关闭后，重度审计用户需要多一步展开。
3. `/opportunities` 和 `/operating/roles/*` 仍有下一轮页面体感清理空间。
4. Computer Use 对浏览器窗口仍不可用，后续循环需要继续尝试，同时保留 Playwright 作为真实页面兜底。

## 8. 下一步

1. 继续复评 `/opportunities` 看板和 `/operating/roles/*`。
2. 继续保持边界：客户成功详情只给判断、动作和可展开证据，不扩成完整 CS ops 平台或自动发送平面。
