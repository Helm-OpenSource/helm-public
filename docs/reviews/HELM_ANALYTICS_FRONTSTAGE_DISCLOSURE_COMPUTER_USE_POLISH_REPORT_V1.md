---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Analytics Frontstage Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
当前切片：`Computer Use attempted in this loop; Playwright review confirmed /analytics now keeps usage signals, quality boards, event streams and model-call details in Chinese judgement-first language with mobile-safe card layout`

## 1. 目标

这次继续处理 `/analytics` 默认前台的系统语、长事件名移动端撑宽和基础 Card 缩宽保护：

1. 延续本轮 Computer Use 尝试结果；Safari 仍不可读时，用 Playwright 操作真实本地页面复评
2. 把 `recommendation / blocker / commitment / workflow / telemetry / prompt / queue / handoff` 等中文模式默认层系统词收成经营判断语言
3. 保留使用分析、推荐质量、记忆提取质量、事件流、LLM 调用和回退原因，但默认可见文案先服务“采用是否成立、质量哪里薄弱、下一步去哪复核”
4. 将热门事件、近期事件、模型任务、提示词 key、服务来源、回退原因和模型调用明细等长技术键改成可换行的中文可读展示
5. 给基础 `Card` / `CardHeader` / `CardContent` / `CardTitle` / `CardDescription` 补 `min-w-0 / max-w-full / break-words`，减少后续页面重复被长内容撑宽

## 2. 本轮不做

- 不改 analytics query、事件写入、模型日志、埋点 schema 或数据口径
- 不删除事件流、模型调用分布、推荐质量、记忆质量或现场采集漏斗
- 不把分析页改成完整 BI、telemetry platform、workflow control 或 readiness gate
- 不扩大自动执行、自动审批、自动承诺或自动发送权限

## 3. 影响面

- `features/analytics/analytics-client.tsx`
- `features/analytics/display-copy.ts`
- `features/analytics/display-copy.test.ts`
- `components/ui/card.tsx`
- `docs/README.md`
- `docs/reviews/HELM_ANALYTICS_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/analytics` 是信号看板，不是控制面；中文前台应该优先帮助用户判断采用压力和质量压力
2. 技术键和事件名仍可保留在底层数据里，但默认显示应避免把用户带入 prompt / telemetry / workflow / recommendation 语境
3. 基础 Card 的 `min-w-0 / max-w-full` 是兼容增强，能减少长键、长标题和长 badge 对其它页面的移动端撑宽风险
4. 本轮只处理显示层和布局约束，不改变分析数据生成、统计口径或权限

## 5. 验证方案

```bash
npm run test -- features/analytics/display-copy.test.ts features/memory/display-copy.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 用 Playwright 登录 demo 并打开 `http://127.0.0.1:3000/analytics`
- 检查默认层不再出现 `recommendation / blocker / commitment / runtime / workflow / follow-through / review-before-send / customer-visible / customer-facing / operator / queue / handoff / prompt / telemetry`
- 追加检查模型与采集明细不再出现 `LLM / pilot / capture / transcript / provider / explanation / openai / gpt / json`
- 检查桌面 1440px 与移动 390px 主内容没有页面级横向溢出

当前已执行结果：

- `npm run test -- features/analytics/display-copy.test.ts features/memory/display-copy.test.ts` passed；2 files / 9 tests passed
- `npm run typecheck` passed
- `npm run self-check` passed；11/11 checks
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed；existing Turbopack NFT warning remains
- `npm run quality:regression` passed；51 files / 180 tests passed
- `git diff --check` passed
- Playwright 桌面复评 passed；扩展目标系统词计数 0，主内容无页面级横向溢出
- Playwright 移动复评 passed；扩展目标系统词计数 0，热门事件、长键值和模型调用明细不再撑宽，主内容无页面级横向溢出
- `npm run db:reset` 未执行：这是破坏性数据库重置，且前一轮已确认当前本地 MySQL 前提不可用
- `npm run test` full suite 未重跑：前一轮 full suite 阻塞在本地 MySQL `127.0.0.1:3306` 连接前提；本轮未改 DB-backed runtime 路径
- `npm run e2e` 未执行：当前已完成 `/analytics` 桌面/移动 Playwright 定向复评，完整 e2e 仍依赖本地 DB 前提恢复

## 6. 主要风险

1. 基础 Card 缩宽保护影响全站卡片；这是有意的兼容增强，但仍需要通过 lint/build/regression 继续确认
2. 技术键在中文模式下被转成可读键名，不改变底层事件名；如果后续需要开发者调试视图，可另设 backstage disclosure
3. 显示映射不改变 analytics schema、统计口径或模型日志，因此底层 payload 仍保留英文 key
4. 完整 DB-backed e2e / full test 仍依赖本地 MySQL 前提恢复
