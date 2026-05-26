---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reports Deep Metrics Language Computer Use Polish Report V1

日期：2026-04-21
状态：Targeted validation passed

## 1. 结论

本轮继续按真实页面循环推进 `/reports`。Computer Use 仍未能稳定控制浏览器窗口：Safari 返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝。因此本轮继续用 Playwright 操作本地 `localhost:3000` 页面做真实路径复评，并保留 Computer Use 尝试记录。

复评发现，上一轮首屏已经收敛，但深层指标区和工程交付摘要仍有内部术语混入中文前台，包括 `recommendation`、`Memory`、`blocker`、`owner / reviewer`、`runtime / core logic`、`docs / baseline`、`guardrails`，以及 `feat(memory)` 这类原始 Git 提交标题。

本轮已把这些深层展示收成中文经营复盘语言：AI 建议、结构化记忆、高频阻碍、职责压力、复核人、文档与基线、运行核心等表达进入前台；最近可见动作改成中文动作摘要，原始提交标题不再直接占据用户阅读路径。

追加复评时还发现工程复盘里的 `其他` 兜底分类过于模糊。本轮已把中文前台兜底展示改为 `综合支撑`，保留底层 `other` key 不变。

## 2. 方案

调整 reports 深层指标区：

- `recommendation` 改为 `AI 建议`
- `Memory` 改为 `结构化记忆`
- `blocker` 改为 `阻碍`
- `correction` 改为 `修正记录`

调整工程交付摘要展示层：

- focus label 中文化：`运行核心`、`文档与基线`、`测试与回归`、`守卫与自检`、`经营工作区`
- 兜底 focus 中文化：`其他` 改为 `综合支撑`
- ownership / review 语言中文化：`职责压力`、`第二负责人`、`复核人`、`复核责任`
- risk language 中文化：`关键人依赖`、`合并冲突`、`优先级收敛`
- “最近可见动作”不再直出 raw Git subject，而是按 commit type / scope / touched focus 生成中文动作摘要

## 3. 受影响组件

- `features/reports/reports-client.tsx`
- `lib/reports/engineering-delivery-review.ts`
- `lib/reports/engineering-delivery-review.test.ts`
- `PLANS.md`
- `docs/README.md`

## 4. 权衡

- 好处：reports 深层指标区继续保持中文经营复盘语气，不再回退成系统内部对象解释。
- 好处：工程交付摘要保留证据来源和管理判断，但先展示用户能读懂的动作摘要。
- 好处：英文模式仍保留 raw Git subject，避免破坏内部英文报告使用场景。
- 代价：中文动作摘要是 presentation-level 归一，不改变 Git 历史本身。
- 代价：focus taxonomy 仍保留 `其他` 作为兜底；本轮没有扩大为分类体系重构。

## 5. Computer Use / 页面复评结果

Computer Use 尝试结果：

1. `get_app_state(Safari)` 返回 `cgWindowNotFound`
2. `get_app_state(ChatGPT Atlas)` 被 MCP 权限拒绝

Playwright 复评结果：

1. demo 登录后打开 `http://localhost:3000/reports`
2. reports 深层 headings 显示为 `AI 建议进入执行的程度`、`AI 建议质量快照`、`结构化记忆提取质量快照`、`高频阻碍`、`结构化记忆高频误差模式`
3. 工程交付摘要显示 `运行核心`、`文档与基线`、`职责压力`、`第二负责人`、`复核人`
4. 最近可见动作显示中文摘要，例如 `新增或强化：结构化记忆与经营信号`
5. `其他` 为 0，`综合支撑` 正常出现在工程复盘 focus 标签与协同描述里
6. 页面主体 forbidden terms 均为 0：
   - `recommendation`
   - `memory`
   - `blocker`
   - `owner`
   - `reviewer`
   - `feat(`
   - `docs:`
   - `runtime / core logic`
   - `guardrails`
   - `docs / baseline`
   - `review ownership`
   - `second owner`
   - `current-main priority`
   - `bus factor`
   - `merge friction`

## 6. 验证结果

已通过：

```bash
npm run test -- lib/reports/engineering-delivery-review.test.ts lib/presentation/business-loop-gap-readout.test.ts features/reports/report-first-loop-display.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

结果：

- targeted tests：3 files / 9 tests passed
- `typecheck`：passed
- Playwright 页面复评：passed
- 追加 Playwright 复评：`其他` 0 次，`综合支撑` 22 次
- `self-check`：passed
- `check:boundaries`：passed
- `lint`：passed，仍有 7 个既有 warning，无 error
- `build`：passed，仍有既有 Turbopack NFT warning
- `quality:regression`：51 files / 180 tests passed
- `git diff --check`：passed

已尝试但环境阻塞：

```bash
npm run test
```

结果：252 files / 1094 tests passed；6 个 DB-backed runtime test files / 15 tests failed，失败原因均为 Prisma 无法连接 MySQL `127.0.0.1:3306`。`nc -z 127.0.0.1 3306` 也返回不可达。

未执行：

```bash
npm run db:reset
npm run e2e
```

原因：`npm run db:reset` 会重置本地数据库，属于本地数据删除/重建动作，未在没有单独确认的情况下执行；`npm run e2e` 留给 MySQL 可用后的完整链路复核。

## 7. 剩余风险

1. 工程复盘仍会显示贡献者邮箱和提交数量，这是 internal-only 管理复盘的刻意保留，不应外部化。
2. `other` 仍是 focus taxonomy 的底层兜底 key；本轮只改变中文展示，不做分类体系重构。
3. Computer Use 对浏览器窗口仍不可用，后续循环需要继续尝试，同时保留 Playwright 作为真实页面兜底。

## 8. 下一步

1. 继续复评 reports 工程交付摘要里的贡献者邮箱、超大提交数量和协同读数是否还需要进一步前台降噪。
2. 继续用 Computer Use / Playwright 巡检其他高频页面，优先看用户是否必须先读系统解释才能操作。
3. 继续保持边界：周报和工程复盘只给复盘、建议和复核入口，不自动承诺、不自动外发、不自动执行。
