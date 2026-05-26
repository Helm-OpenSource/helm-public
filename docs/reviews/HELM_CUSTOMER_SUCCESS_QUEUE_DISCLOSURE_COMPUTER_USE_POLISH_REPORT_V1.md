---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Customer Success Queue Disclosure Computer Use Polish Report V1

日期：2026-04-21
状态：Validation passed

## 1. 结论

本轮继续按真实页面循环推进 `/customer-success`。Computer Use 仍未能稳定控制浏览器窗口：Safari 返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝。因此本轮继续用 Playwright 操作本地 `localhost:3000` 页面做真实路径复评，并保留 Computer Use 尝试记录。

复评发现 `/customer-success` 默认层仍像 customer-success runtime 控制台：`Customer Success Queue / Inbox v1.1`、`customer success handoff`、`review-before-send`、`follow-through`、`owner`、`commitment`、`Queue item` 等词直接出现在首屏和队列卡里。用户进入这里时应该先判断哪条客户成功线要接、卡在哪里、下一步做什么、边界是什么；授权、草稿、复核结果和发送交接应属于可展开的治理证据。

本轮已把默认前台收成中文判断语言，并把队列卡的长治理说明后置到默认关闭的 `治理证据`。

## 2. 方案

- 新增 customer-success 中文展示映射，中文模式下把 queue / inbox / handoff / review-before-send / follow-through / owner / commitment 等系统词转换为经营语言
- `/customer-success` 页头从 `Customer Success Queue / Inbox v1.1` 收成 `客户成功接手队列`
- 每张队列卡默认只保留当前判断、卡点、下一步、边界和接手负责人
- 授权边界、注意事项、建议提示、处理方式、草稿治理、复核结果、发送交接、证据摘要和进度轨迹后置到默认关闭的 `治理证据`
- 展开后仍能审计完整治理证据，不删除底层运行事实

## 3. 受影响组件

- `features/customer-success-handoff/queue-view.tsx`
- `features/customer-success-handoff/display-copy.ts`
- `features/customer-success-handoff/display-copy.test.ts`
- `PLANS.md`
- `docs/README.md`

## 4. 权衡

- 好处：客户成功队列默认回到判断和动作，不再像内部 protocol 展示页。
- 好处：治理证据没有删除，展开后仍能看到授权、复核、草稿和证据链。
- 好处：中文前台不再直接暴露 review-before-send / follow-through / owner / commitment 等系统词。
- 代价：内部审计用户需要多一步展开。
- 代价：证据层内部仍保留部分运行协议语义，这是审计层的刻意保留。

## 5. Computer Use / 页面复评结果

Computer Use 尝试结果：

1. `get_app_state(Safari)` 返回 `cgWindowNotFound`
2. `get_app_state(ChatGPT Atlas)` 被 MCP 权限拒绝

Playwright 复评结果：

1. demo 登录后打开 `http://localhost:3000/customer-success`
2. 默认层 forbidden terms 计数为 0：`customer success / Customer Success / review-before-send / follow-through / owner / commitment / blocker / Queue / Inbox / canonical system of record / operational surface`
3. 默认层显示 `客户成功接手队列`
4. 页面有 12 个 `治理证据` disclosure，默认关闭
5. 展开首个 `治理证据` 后，授权边界、复核结果、证据摘要仍可见
6. 桌面 1440px：`scrollWidth === clientWidth`，可见元素无横向溢出
7. 移动 390px：`scrollWidth === clientWidth`，可见元素无横向溢出

## 6. 验证结果

已通过：

```bash
npm run test -- features/customer-success-handoff/display-copy.test.ts lib/presentation/customer-success-handoff-surface-contract.test.ts lib/presentation/customer-success-handoff-v1_1.test.ts lib/presentation/customer-success-deeper-polish.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

结果：

- targeted tests：4 files / 30 tests passed
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

1. 治理证据层展开后仍是内部运行视图，保留 protocol 语义。
2. `/customer-success/[id]` 详情页仍可能继续暴露更深层 customer-success runtime 语言，需要后续循环单独复评。
3. Computer Use 对浏览器窗口仍不可用，后续循环需要继续尝试，同时保留 Playwright 作为真实页面兜底。

## 8. 下一步

1. 继续复评 `/customer-success/[id]`、`/opportunities` 看板和 `/operating/roles/*`。
2. 继续保持边界：客户成功队列只给判断、动作和治理证据，不扩成完整 CS ops 平台或自动发送平面。
