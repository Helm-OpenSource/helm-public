---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reports Engineering Evidence Disclosure Computer Use Polish Report V1

日期：2026-04-21
状态：Targeted validation passed

## 1. 结论

本轮继续按真实页面循环推进 `/reports`。Computer Use 仍未能稳定控制浏览器窗口：Safari 返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝。因此本轮继续用 Playwright 操作本地 `localhost:3000` 页面做真实路径复评，并保留 Computer Use 尝试记录。

上一轮已经把 reports 深层术语收成中文经营复盘语言。本轮继续看工程交付摘要里的贡献者卡片，发现默认前台仍有 6 个邮箱和 13 个四位以上大数字。它们是有用证据，但在默认阅读路径里会让用户先读统计表，而不是先完成管理判断。

本轮已把贡献者邮箱、提交数、文件数、活跃日、行改动和比例等 raw metric 收进默认关闭的 `查看证据明细`。贡献者卡前台只保留贡献者、当前节奏、最近动作、聚焦方向、质量/方向/交付/工作方式判断和下一步建议。

追加扫描时还发现 reports 中文可见层残留 `reduced-motion`、`commit 历史`、`共享文件 pair`、`GitHub PR / Issue` 等中英混杂表达。本轮已同步收成 `减少动效回退`、`提交历史`、`共享文件组合`、`代码托管平台的正式合并评审 / 事项流转` 等中文表达。

再次复评时，工程交付摘要顶部对象状态和团队协同读数仍有提交数、文件数、百分比这类统计表语言。本轮已继续把它们改成 `高频交付窗口`、`大范围触达`、`高频重叠`、`明显重叠`、`接近半数` 这类定性判断，默认前台只服务方向、闭环、职责压力和下一步动作。

继续向下扫 reports 后半段时，治理健康度里仍露出 `LLM 兜底`。本轮已把中文默认视图改成 `模型回退`，保留字段含义，但不把实现缩写直接放到经营管理页面上。

## 2. 方案

调整工程交付摘要贡献者卡：

- 删除默认前台邮箱行，改成 `先看方向、闭环和下一步动作。`
- 删除默认前台三张 raw metric 卡
- 新增默认关闭的 `查看证据明细`
- evidence disclosure 内保留 `贡献者标识`、数量、闭环、工作方式等原始证据
- 保持 `最近可见动作`、focus 标签、四类判断和建议仍在默认前台
- 同步清理 shared surface preference 和工程复盘边界说明里的中英混杂表达
- 把顶部对象状态从 `提交数 / 文件数` 改成交付窗口和触达范围
- 把团队协同读数从 `共同触达 N 个文件` 改成共享路径重叠强度和主要集中区域
- 把闭环覆盖比例从百分比改成 `多数 / 接近半数 / 一部分 / 少数` 这类管理判断
- 把治理健康度里的 `LLM 兜底` 改成 `模型回退`

## 3. 受影响组件

- `features/reports/engineering-delivery-review-panel.tsx`
- `features/reports/engineering-delivery-review-panel.test.ts`
- `features/reports/reports-client.tsx`
- `components/shared/workspace-surface-preferences.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `lib/reports/engineering-delivery-review.test.ts`
- `PLANS.md`
- `docs/README.md`

## 4. 权衡

- 好处：用户默认先读判断和下一步动作，不再被邮箱和大数字打断。
- 好处：证据没有删除，展开后仍可追溯。
- 好处：这次只改展示层，不影响 Git 分析口径。
- 代价：需要看 raw metrics 的用户多一步展开。
- 代价：定性区间比 raw count 更适合默认判断，但精确审计必须展开证据层。

## 5. Computer Use / 页面复评结果

Computer Use 尝试结果：

1. `get_app_state(Safari)` 返回 `cgWindowNotFound`
2. `get_app_state(ChatGPT Atlas)` 被 MCP 权限拒绝

Playwright 复评结果：

1. demo 登录后打开 `http://localhost:3000/reports`
2. 工程交付摘要默认可见邮箱数从 6 降到 0
3. 工程交付摘要默认可见四位以上大数字从 13 降到 2
4. 6 张贡献者卡均显示 `查看证据明细`
5. `查看证据明细` 默认关闭
6. 展开后仍能看到邮箱、提交数、文件数、活跃日、行改动和比例证据
7. 追加扫描确认 `reduced-motion / pair / commit / GitHub / PR / Issue` 在中文可见层均为 0
8. 工程交付摘要顶部默认可见四位以上大数字、提交数、文件数、百分比均为 0
9. 团队协同读数默认可见提交数、文件数、百分比均为 0
10. 定性判断正常出现：`高频交付窗口`、`大范围触达`、`高频重叠`
11. 390px 移动视口无横向溢出，默认可见邮箱为 0
12. reports 页面主体不再出现 `LLM`，治理健康度显示 `模型回退`

## 6. 验证结果

已通过：

```bash
npm run test -- features/reports/engineering-delivery-review-panel.test.ts lib/reports/engineering-delivery-review.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

结果：

- targeted tests：2 files / 4 tests passed
- `typecheck`：passed
- `git diff --check`：passed
- Playwright 页面复评：passed
- Playwright 追加扫描：passed
- Playwright 顶部/协同再复评：passed
- Playwright 移动视口复评：passed
- Playwright 后半段术语复评：passed
- `self-check`：passed
- `check:boundaries`：passed
- `lint`：passed，仍有 7 个既有 warning，无 error
- `build`：passed，仍有既有 Turbopack NFT warning
- `quality:regression`：51 files / 180 tests passed

未执行：

```bash
npm run db:reset
npm run test
npm run e2e
```

原因：`npm run db:reset` 会重置本地数据库，属于本地数据删除/重建动作，未在没有单独确认的情况下执行；`nc -z 127.0.0.1 3306` 返回不可达，完整 `npm run test` 在当前环境仍会被 DB-backed runtime tests 阻塞；`npm run e2e` 留给数据库可用后的完整链路复核。

## 7. 剩余风险

1. 重度工程复盘用户需要展开才能看 raw metric。
2. 团队协同热点在关联判断信号和右侧协同列表里仍会各出现一次；这有助于就地判断，但后续可以继续压成一处主判断、一处证据层。
3. Computer Use 对浏览器窗口仍不可用，后续循环需要继续尝试，同时保留 Playwright 作为真实页面兜底。

## 8. 下一步

1. 继续复评团队协同读数的重复热点是否还需要进一步收敛。
2. 继续检查 reports 后半段空态和指标卡是否仍有系统解释压过用户动作。
3. 继续保持边界：工程复盘只给内部管理判断，不变成绩效系统、官方 GitHub review 或自动执行入口。
