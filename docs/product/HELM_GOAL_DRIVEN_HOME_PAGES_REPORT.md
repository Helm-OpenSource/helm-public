---
status: archived
owner: helm-core
created: 2026-04-01
review_after: 2026-09-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Goal-driven Home Pages Report

## 本轮改造的页面与模块

1. `app/(workspace)/dashboard/page.tsx`
2. `features/dashboard/page-loader.ts`
3. `features/dashboard/goal-driven-home-surface.tsx`
4. `lib/operating-system/goal-driven-home.ts`
5. `lib/operating-system/goal-driven-home.test.ts`

## 页面层结果

dashboard 现在不再只以 operating overview、冷启动数据和跨线仲裁作为开场。
它已经新增一层真正的 goal-driven operating surface，把 campaign、judgements、chain moves、blockers、decision requests、Helm did、role handoffs 和 evidence entry 一起前置。

## 用户侧变化

### 首页更像经营总盘

- 先看当前主战役
- 再看最重要的 3 条推进链
- 再看最重要的 3 个阻塞
- 再看最值得拍板的 3 件事

### 首页仍保持 judgement-first

- 没有退回对象入口堆叠
- 没有把 evidence / trace 藏掉
- 没有把 dashboard 扩成完整 strategy cockpit

## 当前仍刻意未做

- 不做单独 campaign 管理平台
- 不做完整 OKR / KPI 平台
- 不做完整 company operating system 首页
