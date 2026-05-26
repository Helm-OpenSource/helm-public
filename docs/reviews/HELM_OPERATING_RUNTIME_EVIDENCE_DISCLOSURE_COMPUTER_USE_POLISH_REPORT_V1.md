---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Operating Runtime Evidence Disclosure Computer Use Polish Report V1

日期：2026-04-21
状态：Validation passed

## 1. 结论

本轮继续按真实页面循环推进 `/operating`。Computer Use 仍未能稳定控制浏览器窗口：Safari 返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝。因此本轮继续用 Playwright 操作本地 `localhost:3000` 页面做真实路径复评，并保留 Computer Use 尝试记录。

跨页扫描显示 `/reports` 已基本干净，但 `/operating` 默认前台仍把 runtime operator queue、continuity、workflow、first-loop、review gate 等后台语言铺在经营阅读流里。用户进入经营总盘时，应先看到当前状态、待决策、下一步动作和边界；后台运行证据应可展开审计，而不是默认压过经营判断。

本轮已把 `RuntimeOperatorPanel` 后置到默认关闭的 `后台运行证据`，并把 `/operating` 默认层的 first-loop、operating foundation、角色/对象/推进链混杂词收成中文经营语言。

## 2. 方案

- `/operating` 保留 runtime operator 队列，但默认折叠到 `后台运行证据`
- 展开后仍显示 runtime operator queue、continuity、calibration 和多代理痕迹
- `Operating -> first loop` 改为 `经营复核路径`
- first-loop 中文源头收掉 `first-loop checkpoint / review gate / recommendation / commitment / memory trace`
- operating foundation 中文源头收掉 `Constitution / Memory / workflow engine / customer / prospect / operating charter`
- internal operating 展示层增加中文化映射，收掉 `Founder / Leads / sales / delivery / success / candidate / champion / follow-through`

## 3. 受影响组件

- `features/internal-operating-workspace/internal-operating-home.tsx`
- `features/internal-operating-workspace/object-card.tsx`
- `features/internal-operating-workspace/display-copy.ts`
- `features/internal-operating-workspace/display-copy.test.ts`
- `lib/operating-system/first-loop.ts`
- `lib/operating-system/first-loop-query.ts`
- `lib/operating-system/foundation.ts`
- `lib/operating-system/foundation.test.ts`
- `PLANS.md`
- `docs/README.md`

## 4. 权衡

- 好处：经营总盘默认回到判断和动作，不再像后台运行控制台。
- 好处：后台证据没有删除，展开后仍可审计。
- 好处：中文前台不再直接暴露 runtime / workflow / first-loop 等 protocol 语言。
- 代价：内部运行调试用户需要多一步展开。
- 代价：后台证据层内部仍保留英文协议名，这是审计层的刻意保留。

## 5. Computer Use / 页面复评结果

Computer Use 尝试结果：

1. `get_app_state(Safari)` 返回 `cgWindowNotFound`
2. `get_app_state(ChatGPT Atlas)` 被 MCP 权限拒绝

Playwright 复评结果：

1. demo 登录后打开 `http://localhost:3000/operating`
2. 默认层 forbidden terms 计数为 0：`runtime operator queues / operator surface / first-loop / review gate / recommendation / commitment / workflow / Founder / Leads / customer success / candidate pipeline / proposal readiness`
3. 默认层显示 `经营复核路径` 与 `后台运行证据`
4. 后台证据默认关闭
5. 展开后 runtime operator queue 仍可见
6. 桌面 1440px：`scrollWidth === clientWidth`，可见元素无横向溢出
7. 移动 390px：`scrollWidth === clientWidth`，可见元素无横向溢出

## 6. 验证结果

已通过：

```bash
npm run test -- features/internal-operating-workspace/display-copy.test.ts lib/operating-system/first-loop.test.ts lib/operating-system/foundation.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

结果：

- targeted tests：3 files / 7 tests passed
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

1. 后台证据层展开后仍是内部运行视图，保留 protocol 语言。
2. `/operating` 深层对象详情仍可能有少量 domain English，需要继续按页面循环复评。
3. Computer Use 对浏览器窗口仍不可用，后续循环需要继续尝试，同时保留 Playwright 作为真实页面兜底。

## 8. 下一步

1. 继续复评 `/operating` 深层对象卡、角色接手面和 `/opportunities`。
2. 继续保持边界：经营总盘只给判断、动作和证据，不扩成完整 workflow / orchestration 平台。
