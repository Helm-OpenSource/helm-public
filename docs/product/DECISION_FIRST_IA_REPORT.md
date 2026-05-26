---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# DECISION_FIRST_IA_REPORT

## 目标

把 Helm 的信息架构心智，从对象层切到经营判断与行动推进层。

当前页面骨架、组件职责和信息层级的正式规范稿见：

- [`HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md`](HELM_PAGE_COMPONENTS_AND_INFORMATION_HIERARCHY_SPEC_V1.md)

## IA 原语

第一轮固定的 IA 原语：

- `judgement`
- `action`
- `boundary`
- `evidence`
- `worker assignment`
- `escalation / decision request`

## 推荐顶层结构

当前推荐的顶层阅读顺序是：

1. 今日经营 / `Today`
2. 决策与拍板
3. 推进与动作
4. 风险与阻塞
5. 对外沟通
6. Workers
7. 证据与回放

## 当前第一轮落地方式

### 已经开始按经营循环重组

- [`dashboard/page.tsx`](<../../app/(workspace)/dashboard/page.tsx>)
  - 从“首页对象汇总”转向“今日经营判断 + 现在处理什么”。
- [`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx)
  - 从“机会对象看板”转向“当前经营切片 + 第一主动作 + 详情处理单”。
- [`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)
  - 从“审批列表”转向“信任边界汇报 + 明确拍板任务”。

### 已经开始接协议，但仍属下一层

- [`memory-client.tsx`](../../features/memory/memory-client.tsx)
- [`inbox-client.tsx`](../../features/inbox/inbox-client.tsx)

它们已经先给 brief，但还没有像三张代表页那样完全落成统一 reporting panel。

## 哪些旧页面仍属对象层遗留

- 联系人、公司、会议详情仍有较重对象属性阅读习惯。
- 收件箱与记忆虽然已经开始“先汇报”，但中段仍有列表/时间线遗留。
- 报表页仍更像管理视图，不是完整 decision-first page。

## 哪些导航与标题已更新

- [`sidebar.tsx`](../../components/layout/sidebar.tsx)
  - `Core views` 已收口成 `Decision loop / 经营循环`。
- 代表页页头统一转为 `AI brief + What I see + You decide`。

## 哪些信息从默认可见降级

- recommendation 依据、supporting memory、recent briefing、replay link
  - 从主内容区降到证据抽屉。
- 更深层原始对象字段
  - 从“默认首先出现”降到详情页下段或 drill-down。

## 哪些 CTA 必须前置

- 今日推进顺序
- 审批边界
- 第一条机会详情
- 记忆证据入口

## 当前通过标准结论

- IA 已经从对象驱动切到判断驱动的第一轮。
- 页面开始更像经营主体在汇报，而不是把用户丢进对象表。
- 当前仍是局部落地，不是全站完成重构。
