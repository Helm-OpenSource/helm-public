---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Representative Pages Baseline Freeze Report

## 当前状态

当前已经完成第一轮 decision-first 改造的 3 个代表性页面是：

1. 首页 / 今日经营页
2. opportunities 页面
3. approvals 页面

本轮 freeze 的目标，是把这 3 个页面收成可复用模板，而不是继续扩更多页面。

## 冻结页面 1：首页 / 今日经营页

文件：

- [dashboard/page.tsx](../../app/(workspace)/dashboard/page.tsx)

当前冻结结论：

- 当前判断：通过 `NarrativeHeader` 先说明 Helm 今天怎么看经营重点
- 判断理由：通过 `WhyItMattersBlock` 说明为什么这些事项现在值得处理
- Helm 已推进动作：通过 `HelmDidBlock` 说明今天已经完成的排序和准备
- 当前边界：通过 `BoundaryNote` 保持 founder 拍板边界默认可见
- 当前请求：通过 `DecisionRequestCard` 和主动 founder risk escalation flow 呈现
- 下一步动作：通过 `ActionRail` 明确主动作和次动作
- 证据层：通过 `EvidenceDrawer` 承接回放与 drill-down

## 冻结页面 2：opportunities 页面

文件：

- [opportunities-client.tsx](../../features/opportunities/opportunities-client.tsx)

当前冻结结论：

- 当前判断：先说明当前 scope 下最该处理的推进窗口
- 判断理由：说明为什么 proposal / package / risk / overdue 当前值得先处理
- Helm 已推进动作：说明已经做过的 narrowing、ranking 和 internal prep
- 当前边界：默认可见的 proposal / package / commitment boundary
- 当前请求：通过 `CollaborationRequestCard` 呈现 sales / delivery 协作窗口
- 下一步动作：通过 `ActionRail` 直接给出动作出口
- 证据层：通过 `EvidenceDrawer` 承接 supporting facts 和对象 drill-down

## 冻结页面 3：approvals 页面

文件：

- [approvals-client.tsx](../../features/approvals/approvals-client.tsx)

当前冻结结论：

- 当前判断：先说明当前审批队列为何值得 review
- 判断理由：说明 risk、trust boundary 和 worker draft 为什么要现在拍板
- Helm 已推进动作：说明 draft、preview、evidence 准备已经完成
- 当前边界：外部动作、审批策略、non-commitment 默认可见
- 当前请求：通过 `DecisionRequestCard` 和主动 `worker-draft-awaiting-review` flow 呈现
- 下一步动作：通过 `ActionRail` 直接进入 review / approval
- 证据层：通过 `EvidenceDrawer` 承接 supporting memory / audit / replay

## 当前可接受的对象层遗留

- 三页仍保留部分对象字段和列表作为附录或后续区域
- opportunities 仍保留 stage / kanban 等对象层遗留，但已经不再统治首屏
- approvals 仍保留审批列表，但 current judgement 已前置

## 下一阶段必须优先继续改造的页面

- proposal / package 详情页
- contacts 详情页
- companies 详情页
- meetings 详情页
- inbox 线程页

## 总结

- 首页、opportunities、approvals 当前基线已经清楚
- 这 3 个页面足够作为下一阶段其他页面的改造模板
- 当前仍是模板级 freeze，不是全站完成 freeze
