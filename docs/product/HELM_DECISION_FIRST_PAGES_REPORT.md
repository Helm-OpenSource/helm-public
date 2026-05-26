---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Decision-first Pages Report

## 当前结论

本轮第一轮重做的 3 个代表性页面是：

1. 首页 / 今日经营页
2. opportunities 页面
3. approvals / review 页面

它们现在都通过共享 narrative components 和统一层级规则来组织主叙事，而不是靠对象堆叠和状态卡片驱动阅读。

## 代表页 1：首页

文件：

- [../../app/(workspace)/dashboard/page.tsx](../../app/(workspace)/dashboard/page.tsx)

当前首屏默认回答：

- Helm 当前怎么看今天的经营重点
- 为什么现在值得处理
- Helm 已经先排了什么
- 现在 founder 应该先拍什么板
- 证据和主动协作入口在哪里

## 代表页 2：opportunities 页面

文件：

- [../../features/opportunities/opportunities-client.tsx](../../features/opportunities/opportunities-client.tsx)

当前首屏默认回答：

- Helm 当前怎么看机会推进面
- 为什么当前 scope 值得先处理
- Helm 已经先做了哪些 narrowing / ranking
- 现在需要 sales / delivery 决定什么
- proposal / package 协作请求如何主动送出

## 代表页 3：approvals 页面

文件：

- [../../features/approvals/approvals-client.tsx](../../features/approvals/approvals-client.tsx)

当前首屏默认回答：

- Helm 当前怎么看审批队列
- 为什么现在值得 review
- Helm 已先准备了哪些 draft / preview / evidence
- 当前需要 owner 拍板什么
- 边界和 evidence 如何保持默认可见

## 三页共同模板

三页现在共同具备：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `CollaborationRequestCard`（主动协作链路页）
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

## 当前边界

- 当前只重做了 3 个代表性页面
- contacts / companies / meetings / inbox 仍需下一轮接入
- proposal / package 详情页还没有完成这一轮模板化改造
