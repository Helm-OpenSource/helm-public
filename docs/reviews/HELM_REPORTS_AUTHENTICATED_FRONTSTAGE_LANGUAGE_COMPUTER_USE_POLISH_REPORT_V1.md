---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reports Authenticated Frontstage Language Computer Use Polish v1

更新时间：2026-04-22
状态：Targeted And Non-Destructive Validation Passed; Full DB-Backed Test Blocked By Local MySQL
当前切片：`Computer Use successfully read Safari /reports; authenticated Playwright confirmed /reports desktop/mobile and 9 second-layer dynamic routes have zero target terms and zero horizontal overflow`

## 1. 目标

继续按“生成 -> 评估 -> 修改 -> 再评估”的循环处理 `/reports` 登录后真实页面：

1. 继续使用 Computer Use 读取真实 Safari 页面，而不是只看截图或静态代码。
2. 把 `/reports` 周报摘要、计划建议、指标区和导航里的 `AI 建议 / AI 执行 / AI 参与 / 系统观察 / 系统想到 / 智能设置` 收成中文负责人判断语言。
3. 对旧数据库摘要增加显示层净化，避免历史 `AI 共生成` 继续进入前台。
4. 用带登录态的 Playwright 复查 `/reports`，并补上上一轮动态详情路由未带登录态的验证缺口。
5. 不改周报 payload、审批状态机、权限、recommendation / commitment 底层边界或自动执行能力。

## 2. 影响面

- `features/reports/display-copy.ts`
- `features/reports/display-copy.test.ts`
- `features/reports/reports-client.tsx`
- `lib/reports/index.ts`
- `lib/presentation/workspace-story.ts`
- `lib/i18n/messages.ts`
- `docs/reviews/HELM_REPORTS_AUTHENTICATED_FRONTSTAGE_LANGUAGE_COMPUTER_USE_POLISH_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/reports` 登录后的默认层应先帮助负责人判断“当前状态、待决策、下一步动作、边界”，而不是展示系统自我叙述。
2. `AI` 作为产品定位可以存在，但具体工作视图里应优先显示“建议动作、执行闭环、推进规律”等可操作语言。
3. 旧周报摘要是历史数据，不应直接改库；显示层净化比迁移数据风险更小。
4. English 模式仍保留英文产品术语；本轮只收中文默认层。

## 4. 验证结果

- Computer Use：成功读取 Safari 当前窗口 `localhost:3000/reports`，确认导航显示 `工作区设置`，报告页显示 `建议动作 / 执行闭环 / 推进规律`，不再显示本轮目标词。
- Playwright `/reports` authenticated desktop/mobile scan passed：目标词 0、横向溢出 0、console error 0。
- Playwright authenticated second-layer scan passed：`/founder-conversations/:id`、`/founder-qa/:id`、`/sales-conversations/:id`、`/sales-followups/:id`、`/sales-objections/:id`、`/delivery-conversations/:id`、`/delivery-walkthroughs/:id`、`/delivery-reviews/:id`、`/external-narrative-fallbacks/:id` 全部 200，目标词 0、横向溢出 0。
- `npm run test -- features/reports/display-copy.test.ts features/reports/report-first-loop-display.test.ts features/reports/engineering-delivery-review-panel.test.ts lib/reports/engineering-delivery-review.test.ts lib/reports/index.test.ts` passed；5 files / 9 tests。
- `npm run typecheck` passed。
- `npm run self-check` passed；11/11。
- `npm run check:boundaries` passed。
- `git diff --check` passed。
- `npm run lint` passed；保留 7 个既有 warning，无 error。
- `npm run quality:regression` passed；51 files / 181 tests。
- `npm run build` passed；保留既有 Turbopack NFT warning。
- `nc -z 127.0.0.1 3306` exit 1；本地 MySQL 仍不可达。
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前 MySQL 前提不可用。
- 完整 `npm run test` / `npm run e2e` 未执行：当前 DB 前提不可用，本轮已用定向单测、守卫、构建和登录态页面扫描覆盖当前改动面。

## 5. 剩余风险

1. `/reports` 仍有工程交付摘要和证据 disclosure；这是内部管理判断层，不能当成正式绩效或 GitHub review truth。
2. 底层字段仍叫 `aiSuggestionsCount`，这是数据契约，不在本轮改名；显示层已经收成“建议动作”。
3. 完整 DB-backed runtime tests 需要本地 MySQL 恢复后再补跑。

## 6. 下一步

1. 恢复本地 MySQL 后，补跑完整 `npm run test` 和 `npm run e2e`。
2. 下一轮继续用 Computer Use 优先看真实页面，再用 Playwright 做可重复扫描。
3. 继续循环时优先扫 `/imports/crm`、`/settings`、`/diagnostics` 的登录态深层状态，而不是扩大到底层数据模型迁移。
