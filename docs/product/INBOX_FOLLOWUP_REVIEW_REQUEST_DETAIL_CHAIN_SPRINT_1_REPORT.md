---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Inbox / Follow-up / Review Request Detail Chain Sprint 1 Report

## 1. Inbox / follow-up / review request detail reporting contract 是否已经清楚

已经清楚。当前三类页已经有统一 contract，可稳定承接 scene、audience、sendability、boundary、worker、evidence、handoff 与 next action 语义。

## 2. 这 3 类页是否已经完成第一轮 judgement-first 改造

已经完成第一轮改造。`/inbox/[id]`、`/follow-ups/[id]`、`/review-requests/[id]` 现在都先给 current judgement、why it matters、Helm did、decision request、boundary、action rail 和 evidence，而不是先退回对象壳层。

## 3. 这 3 类页是否已经接入现有 unified chain

已经接入。当前已覆盖：

- `conversation -> inbox`
- `conversation -> follow-up`
- `follow-up -> review request`
- `review request -> founder / sales / delivery`
- `review request -> company detail` 作为当前 customer-success-style follow-through 代理
- `inbox / follow-up / review request -> package / proposal / offer / external narrative`

## 4. 当前 Helm 是否已经更像一条连续沟通经营链，而不是零散消息与审批页

是。当前 Helm 已经不再把 inbox、follow-up、review request 看成三块孤立的消息 / 草稿 / 审批壳层，而是把它们收成一条连续的沟通链：线程判断 -> 跟进判断 -> review 判断 -> 角色接手。

## 5. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

仍保持稳定。

- inbox judgement 不等于可直接回复承诺
- follow-up draft 不等于可直接对外 commitment
- review request 不等于已经批准执行
- internal-only、boundary-only、review-before-send 仍继续显式保留

## 6. 哪些地方刻意未做，为什么

- 没有扩成完整 inbox / messaging platform
- 没有扩成完整 email client / CRM / notifications center
- 没有扩成完整 review workflow engine
- 没有新增 canonical inbox / follow-up / review request 主对象体系

原因是一致的：本轮目标是接入 judgement-first detail chain，而不是把局部 detail sprint 扩成完整平台工程。

## 7. 下一阶段最该做的 5 件事是什么

1. 把 `inbox list / approvals list` 的入口和 detail chain 连接得更显式，减少人工找 detail route 的摩擦。
2. 把 `customer success -> success check / expansion review` 继续细化成更明确的 success 子变体。
3. 把更多 `follow-up / review request` 变体细化到 founder / sales / delivery 的 role-specific next-step 层。
4. 把 `inbox / follow-up / review request` 与 `inbox actions / approval actions` 的低风险执行入口继续对齐。
5. 把更多沟通相关 detail 页继续接进 unified chain，尤其是 `inbox / follow-up / review request` 周边的 queue 与 request surfaces。

## 当前短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| Inbox / follow-up / review request detail contract | 当前三类页的 contract、scene、sendability、boundary、evidence 语义已清楚 |  |  |  |
| Inbox / follow-up / review request pages | 三类 judgement-first detail 页已落地 |  |  |  |
| Inbox / follow-up / review request chain integration | 当前已接进 unified chain，并完成核心 handoff |  |  |  |
| Documentation / guard / test alignment | README、docs、checks、tests、regression 已重新对齐 |  |  |  |
| Founder mainline stability | founder 主链未被消息 / review 页接入打散 |  |  |  |
| Handoff mainline stability |  | 当前 handoff 主链已明显增强，但 customer success 子变体仍需下一层 |  |  |
| Worker / packs / scenarios integration |  | worker cue 已进入 detail page，但更多 queue / request 细分映射仍需下一层 |  |  |
| Enterprise IAM / org admin / full permissions platform |  |  | 本轮明确不扩成完整权限 / 组织平台 |  |
| Runtime sandbox |  |  |  | plugin runtime 仍没有真正 sandbox，必须继续诚实保留 |

## 边界

- `app/` 仍是当前唯一或主要 route owner
- `data/queries.ts` 仍是查询聚合入口，只是已经更薄
- 当前三类 detail 仍是第一轮局部落地，不是全站详情页完成重构
- 当前 Helm 仍默认以 recommendation、review、boundary、decision request 为主，不默认拥有高风险自动承诺和高风险自动发送权限
