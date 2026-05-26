---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# DECISION_FIRST_PAGE_REFACTOR_REPORT

## 本轮代表页

本轮选择并重构了 3 个代表性页面：

1. 首页 / 今日经营页
2. 机会页
3. 审批页

## 1. 首页 / 今日经营页

文件：

- [`dashboard/page.tsx`](<../../app/(workspace)/dashboard/page.tsx>)

本轮变化：

- 页头先给 AI 经营 brief。
- 新增统一的 `ReportingProtocolPanel`，先讲：
  - 当前判断
  - Helm 已做整理
  - 现在要用户决定什么
  - 可直接点的下一步动作
  - 证据抽屉
- “今日最值得推进的 3 件事”、“必须审批”、“经营简报”都已经挂上明确锚点，建议动作不再停在文案里。

## 2. 机会页

文件：

- [`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx)

本轮变化：

- 机会页先变成 AI pipeline brief，而不是先给筛选器和对象列。
- 顶部四类统计卡改回稳定基线统计，不再随着当前点击视图整组乱跳。
- 新增统一 `ReportingProtocolPanel`：
  - 说明为什么当前是这个 scope
  - Helm 已经帮用户缩小到什么经营切片
  - 现在该拍板哪条机会
  - 可直接进入第一条机会、审批边界和记忆依据
- 详情抽屉继续保持“AI 处理工作区 -> 判断工作区 -> 记录属性”的层次。

## 3. 审批页

文件：

- [`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)

本轮变化：

- 审批页先给 AI approval brief，不再一上来就是待审批卡片列表。
- 新增统一 `ReportingProtocolPanel`：
  - 明确当前信任边界压力
  - Helm 已经帮你截住了什么
  - 现在该通过、改写还是继续拦住什么
  - 可直接进入审批队列、预览面板和记忆依据
- 审批详情继续保留 recommendation evidence、source context、result preview 与 learning panel。

## 模板价值

这三页已经足以作为后续页面改造模板，因为它们共同具备：

- Helm 当前判断
- 判断理由
- Helm 已推进动作
- 需要用户决策事项
- 可直接执行的下一步动作
- 证据抽屉
- boundary summary
- worker summary
- escalation / replay 提示

## 诚实边界

- 当前不是“全站 decision-first 完成态”。
- 联系人、公司、会议、报表、设置仍属于下一轮改造对象。
- 本轮重点是把模板页改到位，而不是推翻所有页面。
