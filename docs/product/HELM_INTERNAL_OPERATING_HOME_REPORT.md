---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Internal Operating Home Report

## 页面入口

- 新首页入口：`/operating`
- 壳层入口：
  - sidebar 新增 `经营总盘`
  - topbar 新增 `Operating`
  - dashboard 顶部 action 新增 `打开经营总盘`

## 首页结构

当前内部经营首页至少固定 6 个区块：

1. 今日经营判断
2. Leads 与收入推进
3. 产品与研发推进
4. 招聘与组织推进
5. 伙伴与 custom 推进
6. 当前决策与阻塞

## 当前能回答的问题

首页现在可以直接回答：

- 今天最重要的 3 个经营判断是什么
- 当前最值得推进的 3 条链是什么
- 当前最该拍板的 3 件事是什么
- 当前最大的阻塞是什么
- Helm 已经替团队推进了什么

## 当前表达原则

每个区块都先给 judgement，再给 action，同时保留：

- boundary
- next action
- owner / handoff
- evidence / trace

这轮没有退回成对象入口堆叠，也没有退回成“很多状态卡”。

## 产品判断

内部经营首页已经成立，而且它是真正面向“Helm 团队经营 Helm”的总盘，不再只是现有 dashboard 的别名。

同时，这一页仍然保持窄边界：

- 不是完整 CRM 首页
- 不是完整 ATS 首页
- 不是 PM 首页
- 不是 finance console

它是一张 judgement-first internal operating brief。
