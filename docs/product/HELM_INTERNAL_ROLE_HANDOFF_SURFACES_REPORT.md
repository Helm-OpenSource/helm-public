---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Internal Role Handoff Surfaces Report

## 当前入口

当前已建立 6 个 role handoff surface：

- `/operating/roles/founder`
- `/operating/roles/sales`
- `/operating/roles/delivery`
- `/operating/roles/customer-success`
- `/operating/roles/recruiting`
- `/operating/roles/partner`

## 每个角色现在都能看到

- 当前最重要的 3 个判断
- 当前最重要的 3 个接手事项
- 当前最重要的 3 个下一步动作
- 当前边界 / 风险
- 当前 evidence / memory / handoff 依据

## 角色关注点

### Founder

- 战略、拍板、关键阻塞、关键客户、关键人才、关键伙伴

### Sales

- lead、follow-up、proposal、offer、conversion

### Delivery

- walkthrough、review、activation、risk clarification

### Customer Success

- follow-through、success check、expansion review、issue follow-through

## 当前新增的 second-layer variants 入口

当前四类关键角色已经不只停在第一层 scene，也开始从 role handoff surface 直接跳进第二层 detail：

- Founder：`/founder-qa/[id]`
- Sales：`/sales-followups/[id]`、`/sales-objections/[id]`
- Delivery：`/delivery-walkthroughs/[id]`、`/delivery-reviews/[id]`
- Customer Success：`/customer-success/[id]`、`/success-checks/[id]`、`/expansion-reviews/[id]`

它们的作用不是把 role surface 扩成完整 role center，而是让“当前为什么要接手、现在最该怎么说、哪些边界不能越过”更快落到可执行 detail。

其中 Customer Success 已进一步长厚到 issue / escalation / renewal-risk 第二层：

- issue：`success issue follow-through`、`blocked issue resolution`、`customer-visible issue clarification`、`internal-only issue prep`、`review-before-send issue response`、`boundary-only issue response`
- escalation：`escalation-triggered follow-through`、`founder-escalated issue`、`delivery-escalated issue`、`sales-escalated issue`、`blocked-by-dependency escalation`、`blocked-by-boundary escalation`、`internal-only escalation prep`
- renewal / expansion risk：`renewal risk clarification`、`expansion blocked clarification`、`success follow-through before expansion`、`review-before-send expansion clarification`、`non-commitment fallback for success / expansion`

这些子变体已经重新挂回：

- `review request -> customer success handoff`
- `customer success handoff surface`
- `success checks`
- `expansion reviews`
- `customer success -> founder / sales / delivery` 交接线

### Recruiting

- candidate pipeline、role fit、next interview / offer

### Partner

- 适配能力、客户连接、custom 交付、依赖与风险

## 当前结论

6 类角色接手面已经成立。

它们现在不再只是 filter 视图，而是统一进入同一套 judgement-first 经营链；其中 Founder / Sales / Delivery / Customer Success 也已经开始具备第二层 variants 的直接执行入口。

## 边界

本轮刻意未做：

- 完整 role center
- 完整 org admin / IAM 平台
- 完整 workflow assignment 平台

当前是 role handoff surface foundation，不是完整角色平台。
