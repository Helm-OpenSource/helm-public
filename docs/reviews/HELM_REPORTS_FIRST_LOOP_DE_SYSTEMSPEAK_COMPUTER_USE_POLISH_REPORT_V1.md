---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reports First-Loop De-SystemSpeak Computer Use Polish Report V1

日期：2026-04-21
状态：Targeted validation passed

## 1. 结论

本轮继续按真实页面循环推进 `/reports`。Computer Use 本轮仍无法稳定读取浏览器窗口：Safari 返回 `cgWindowNotFound`，Atlas MCP 权限被拒绝，Codex App 因安全策略不可控制。因此页面复核由 Playwright 操作本地 `localhost:3000` 完成，并保留 Computer Use 尝试记录。

Playwright 进入 demo 后打开 `/reports`，确认首屏仍把内部 first-loop 模型直接暴露给用户：

- `Reports -> first loop`
- `first-loop checkpoint`
- `review-before-commitment gate`
- `打开 review gate`
- `First-loop 证明`
- `review 区块 / review 窗口`
- `KPI link stale` 与 stale metrics 英文诊断

本轮已把 reports 首屏收成“周报复核路径”：顶部只展示当前复核动作、回访点和边界；summary 区使用复核/复盘语言；业务闭环缺口读数把过期 KPI 关联翻译成中文经营判断。

## 2. 方案

新增 reports 专用 first-loop 展示适配器：

- `buildReportFirstLoopDisplayModel`
- 只转换 `WorkspaceFirstLoopModel` 在 reports 首屏的展示文案
- 不改底层 first-loop model、查询、周报生成、审批状态机或权限

同步调整：

- `/reports` 的 `FirstLoopSurfaceSummary` 使用 compact 模式
- `Reports -> first loop` 改为 `周报复核路径`
- `review gate` 主 CTA 改为 `进入复核`
- `first-loop checkpoint` 改为 `6/7 个环节已就绪`
- `First-loop 证明` 改为 `周报复核路径`
- `review 区块 / review 窗口` 改为 `复核区块 / 复核窗口`
- `KPI link stale` 等业务闭环缺口读数在中文界面本地化

## 3. 受影响组件

- `features/reports/report-first-loop-display.ts`
- `features/reports/report-first-loop-display.test.ts`
- `features/reports/reports-client.tsx`
- `lib/presentation/business-loop-gap-readout.ts`
- `lib/presentation/business-loop-gap-readout.test.ts`
- `PLANS.md`
- `docs/README.md`

## 4. 权衡

- 好处：reports 首屏从“系统回路解释”变成“周报复核路径”，用户先知道该点哪里。
- 好处：compact first-loop summary 减少第一屏解释密度，把完整周报复盘留给后续区块。
- 好处：shared business-loop gap readout 不再把内部英文诊断直接抬到中文经营首屏。
- 代价：完整 first-loop 阶段解释在 reports 首屏被压缩，只有用户需要时再从后续页面理解。
- 代价：本轮没有一次性清理 reports 深层指标区里的全部 `recommendation / memory / owner / reviewer` legacy 表达。

## 5. Computer Use / 页面复评结果

Computer Use 尝试结果：

1. `get_app_state(Safari)` 返回 `cgWindowNotFound`
2. `get_app_state(ChatGPT Atlas)` 被 MCP 权限拒绝
3. `get_app_state(Codex)` 因安全策略不可控制

Playwright 复评结果：

1. demo 登录后打开 `http://localhost:3000/reports`
2. 首屏显示 `周报复核路径 / 先做周报复核 / 复核：发送 Atlas 合作 brief / 进入复核`
3. summary 显示 `周报操作摘要 / 复核区块 / 当前复核窗口`
4. 业务闭环缺口显示 `KPI 关联已过期` 与中文解释
5. forbidden terms 均 clear：
   - `Reports -> first loop`
   - `first-loop checkpoint`
   - `review-before-commitment gate`
   - `打开 review gate`
   - `First-loop 证明`
   - `review 区块`
   - `review 窗口`
   - `live signal`
   - `memory fact`
   - `KPI link stale`
   - `stale coordination metrics`

## 6. 验证结果

已通过：

```bash
npm run test -- lib/presentation/business-loop-gap-readout.test.ts features/reports/report-first-loop-display.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

结果：

- `business-loop-gap-readout` 与 `report-first-loop-display` tests：2 files / 6 tests passed
- `typecheck`：passed
- `self-check`：passed
- `check:boundaries`：passed
- `lint`：passed，仍有 7 个既有 warning，无 error
- `build`：passed，仍有既有 Turbopack NFT warning
- `quality:regression`：51 files / 180 tests passed
- `git diff --check`：passed
- Playwright 页面复评：passed

未执行：

```bash
npm run db:reset
npm run test
npm run e2e
```

原因：`npm run db:reset` 会重置本地数据库，属于本地数据删除/重建动作，未在没有单独确认的情况下执行；完整 `npm run test` 与 `npm run e2e` 依赖当前本机数据库可用性，留给数据库可用后的完整链路复核。

## 7. 剩余风险

1. reports 深层指标区仍可能出现 legacy `recommendation / memory / owner / reviewer` 表达。
2. business-loop gap 的源数据仍是英文诊断，本轮只在 presentation 层转换。
3. Computer Use 对浏览器窗口仍不可用，后续循环需要继续尝试，同时保留 Playwright 作为真实页面兜底。

## 8. 下一步

1. 继续用 Computer Use / Playwright 复评 reports 深层指标区，优先清理 `recommendation` 质量区和工程交付摘要中的混合语言。
2. 在浏览器窗口状态可读后，补一次真正的 Computer Use scroll / click 复评。
3. 继续保持边界：周报只给复盘、建议和复核入口，不自动承诺、不自动外发、不自动执行。
