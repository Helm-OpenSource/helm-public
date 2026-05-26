---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Diagnostics Frontstage Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Targeted Validation Passed
当前切片：`Computer Use app listing succeeded; Safari state still returns cgWindowNotFound, so Playwright confirmed /diagnostics now keeps readiness, memory write review, retry ledgers and import evidence in Chinese judgement-first language with mobile-safe detail blocks`

## 1. 目标

这次继续处理 `/diagnostics` 默认前台的系统语、长写入失败链路和移动端明细撑宽：

1. 继续尝试 Computer Use；Safari 窗口不可读时，保留错误并用 Playwright 操作真实本地页面复评
2. 把 `recommendation / blocker / commitment / workflow / queue / operator / owner / trace / retry / receipt / payload` 等中文模式默认层系统词收成经营判断语言
3. 保留诊断页对就绪度、会议闭环、模型/转写健康、记忆写入失败、人工复核队列、重试约束和凭证台账的证据价值
4. 将内部枚举、状态、失败原因、重试门槛和长对象引用统一走诊断页显示层
5. 给诊断指标卡、复核门槛卡和明细块补 `min-w-0 / max-w-full / break-words / overflow-hidden`，避免长 key 或长 ID 撑宽移动端

## 2. 本轮不做

- 不改 diagnostics query、观测指标、记忆写入失败 schema、重试契约或审计 payload
- 不删除 LLM/ASR、capture、CRM import、memory retrieval、write failure review 等诊断证据
- 不把诊断页升级成完整 BI、workflow control、auto-execution plane 或自动重试执行器
- 不扩大自动执行、自动审批、自动承诺或自动发送权限

## 3. 影响面

- `features/diagnostics/diagnostics-client.tsx`
- `features/diagnostics/display-copy.ts`
- `features/diagnostics/display-copy.test.ts`
- `lib/i18n/messages.ts`
- `lib/operating-system/first-loop-query.ts`
- `docs/README.md`
- `docs/reviews/HELM_DIAGNOSTICS_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/diagnostics` 是就绪判断和证据复核面，不是用户默认阅读内部枚举和失败契约的地方
2. 技术枚举、审计 payload、重试状态和凭证台账仍保留在底层数据里；中文默认层只负责把它们转成可判断的经营语言
3. 记忆写入失败、人工复核队列和重试门槛仍然是只读诊断证据；这轮不引入自动重试或自动执行
4. 诊断页的移动端主体应允许长对象引用换行，不应为了保留原始 key 而撑出横向滚动

## 5. 验证方案

```bash
npm run test -- features/diagnostics/display-copy.test.ts features/diagnostics/first-loop-adoption.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 用 Playwright 从公开首页进入 founder demo，再打开 `http://127.0.0.1:3000/diagnostics`
- 检查默认层不再出现 `recommendation / blocker / commitment / workflow / queue / operator / owner / trace / retry / receipt / payload / readiness / pilot / capture / LLM / ASR`
- 检查桌面 1440px 与移动 390px 主内容没有页面级横向溢出

当前已执行结果：

- Computer Use：`list_apps` succeeded；`get_app_state("com.apple.Safari")` 仍返回 `Apple event error -10005: cgWindowNotFound`
- `npm run test -- features/diagnostics/display-copy.test.ts features/diagnostics/first-loop-adoption.test.ts` passed；2 files / 10 tests passed
- `npm run typecheck` passed
- `npm run self-check` passed；11/11 checks
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed；existing Turbopack NFT warning remains
- `npm run quality:regression` passed；51 files / 180 tests passed
- `git diff --check` passed
- Playwright `/diagnostics` 桌面 1440px passed；目标系统词计数 0，主内容无页面级横向溢出
- Playwright `/diagnostics` 手机 390px passed；目标系统词计数 0，诊断主体无页面级横向溢出；剩余轻微 `scrollDelta` 来自全局顶栏通知按钮
- `npm run db:reset` 未执行：这是破坏性数据库重置，且前一轮已确认当前本地 MySQL 前提不可用
- `npm run test` full suite 未重跑：前一轮 full suite 阻塞在本地 MySQL `127.0.0.1:3306` 连接前提；本轮未改 DB-backed runtime 路径
- `npm run e2e` 未执行：当前已完成 `/diagnostics` 桌面/移动 Playwright 定向复评，完整 e2e 仍依赖本地 DB 前提恢复

## 6. 主要风险

1. 显示层会把中文模式下的内部枚举转成可读短语；底层 key 仍保留，如果后续需要开发者调试视图，应放到后台 disclosure
2. `lib/i18n/messages.ts` 的中文诊断页描述被收紧为经营语言，可能影响依赖旧文案的快照；当前 targeted test/typecheck 已通过
3. `lib/operating-system/first-loop-query.ts` 的中文摘要从 `signal/review queue` 改为“真实信号/复核队列”，不改变状态机或查询口径
4. 完整 DB-backed e2e / full test 仍依赖本地 MySQL 前提恢复
