---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer-facing Offer / External Proposal Decision-first Pages Sprint 1 Report

## 结论

### 1. customer-facing offer / external proposal detail reporting contract 是否已经清楚

是。当前已经形成 customer-facing offer 与 external proposal 两套 detail contract，并明确了 judgement、action、boundary、worker、evidence、sendability mode 与 risk signal 的最小结构。

### 2. customer-facing offer / external proposal 详情页是否已经完成第一轮 decision-first 改造

是。当前已经有 1 个 customer-facing offer detail 页、1 个 external proposal detail 页，以及 1 套共享的 external expression detail 骨架。

### 3. boundary / prerequisite / dependency / non-commitment / sendability / evidence 结构是否已经清楚

是。当前已经明确哪些内容必须首屏可见、哪些进入 `BoundaryNote`、哪些进入 `EvidenceDrawer`、哪些只能 internal-only、哪些必须保持 review-before-send / not-safe-to-send。

### 4. 当前 customer-facing offer / external proposal 页面是否已经更像 Helm 在汇报，而不是模板页或对象详情页

是，但仍是第一轮。当前两页已经从模板字段平铺切到 Helm judgement-first 汇报页，但还只是基于现有 opportunity commercial context 的 external expression detail 模板。

### 5. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

是。当前 recommendation / commitment 口径没有被改写成新的对象层，也没有把 discussion-only、boundary note、reinforcement cue 误写成外部承诺。

### 6. 哪些地方刻意未做，为什么

- 没有新增 canonical Offer / ExternalProposal 主对象，因为本轮只做 detail template
- 没有扩成完整 offer platform / external proposal generator / legal engine，因为本轮只做 judgement-first detail pages
- 没有顺手重写 proposal、package 之外的更多 detail 页，因为本轮目标只锁定外部表达 detail 页

### 7. 下一阶段最该做的 5 件事是什么

1. 把 customer-facing package variants 接到同一套 external expression detail contract
2. 把 commitment reinforcement detail 接到同一套 sendability / non-commitment 结构
3. 把 proposal / package / offer / external proposal 之间的 handoff 关系再前置一点
4. 把 contacts / companies / meetings / inbox 继续接到同一套 decision-first detail 骨架
5. 补 customer-facing wording / internal-only wording / reinforcement cue 的 founder demo 和 acceptance 专项脚本

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Customer-facing offer / external proposal reporting contract | 是 |  |  |  | 已有两套 detail contract 与 sendability / evidence grouping |
| Customer-facing offer / external proposal decision-first pages | 是 |  |  |  | 已有 2 个 detail 模板页和共享 detail 骨架 |
| Boundary / sendability / evidence structure | 是 |  |  |  | 已固定 BoundaryNote + EvidenceDrawer + sendability trace |
| Documentation / guard / test alignment | 是 |  |  |  | README、docs、self-check、boundary、tests 已同步 |
| Founder mainline stability | 是 |  |  |  | founder 商业推进主链未被打散 |
| Handoff mainline stability | 是 |  |  |  | proposal/package 到外部表达的 handoff 仍保持可见 |
| Worker / packs / scenarios integration |  | 是 |  |  | 已进入外部表达 narrative，但仍需扩到更多 detail 页与变体页 |
| Enterprise IAM / org admin / full permissions platform |  |  | 是 |  | 本轮刻意不做，不偏离 controlled-trial 边界 |
| Runtime sandbox |  |  | 是 |  | plugin runtime 仍没有真正 sandbox |

## 边界

- 当前 customer-facing offer / external proposal 页改造仍是第一轮局部落地，不是全站详情页完成重构
- 当前实现仍以 existing opportunity commercial context 为底，不是新增 canonical Offer / ExternalProposal object
- 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台
- plugin runtime 仍没有真正 sandbox
- 当前 Helm 仍默认以 recommendation、review、boundary、sendability decision request 为主，不默认拥有高风险自动承诺和高风险自动发送权限
