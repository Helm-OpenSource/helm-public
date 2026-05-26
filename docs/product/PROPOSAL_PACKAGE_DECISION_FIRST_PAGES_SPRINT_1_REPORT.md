---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Proposal / Package Decision-first Pages Sprint 1 Report

## 结论

### 1. proposal / package detail reporting contract 是否已经清楚

是。当前已经形成 proposal 与 package 两套 detail contract，并明确了 judgement、action、boundary、worker、evidence、audience mode 与 risk signal 的最小结构。

### 2. proposal / package 详情页是否已经完成第一轮 decision-first 改造

是。当前已经有 1 个 proposal detail 页、1 个 package detail 页，以及 1 套共享 detail 骨架。

### 3. boundary / prerequisite / dependency / non-commitment / evidence 结构是否已经清楚

是。当前已经明确哪些内容必须首屏可见、哪些进入 `BoundaryNote`、哪些进入 `EvidenceDrawer`、哪些只能 internal-only。

### 4. 当前 proposal / package 页面是否已经更像 Helm 在汇报，而不是对象详情页

是，但仍是第一轮。当前两页已经从对象字段平铺切到 Helm judgement-first 汇报页，但还只是基于现有 opportunity commercial context 的 detail 模板。

### 5. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

是。当前 recommendation / commitment 口径没有被改写成新的对象层，也没有被误写成外部承诺。

### 6. 哪些地方刻意未做，为什么

- 没有新增 canonical Proposal / Package 主对象，因为本轮只做 detail template
- 没有扩成完整 proposal generator / package engine，因为本轮只做 decision-first detail pages
- 没有顺手重写更多详情页，因为本轮目标只锁定 proposal / package 商业推进页

### 7. 下一阶段最该做的 5 件事是什么

1. 把 customer-facing offer / external proposal 接到同一套 proposal/package detail contract
2. 把 contacts / companies / meetings / inbox 继续接到同一套 decision-first detail 骨架
3. 收紧 internal-only / customer-safe / commitment wording 的显示守线
4. 把 worker assignment / active collaboration 更多地挂进 proposal/package detail 页
5. 补 proposal / package 详情页的 founder demo / acceptance 专项演示脚本

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Proposal / package reporting contract | 是 |  |  |  | 已有 proposal / package detail contract 与 evidence grouping |
| Proposal / package decision-first pages | 是 |  |  |  | 已有 2 个 detail 模板页和共享 detail 骨架 |
| Boundary / evidence structure | 是 |  |  |  | 已固定 BoundaryNote + EvidenceDrawer + grouped evidence |
| Documentation / guard / test alignment | 是 |  |  |  | README、docs、self-check、boundary、tests 已同步 |
| Founder mainline stability | 是 |  |  |  | founder 商业推进主链未被打散 |
| Handoff mainline stability | 是 |  |  |  | sales / delivery 协作与 review handoff 仍保持可见 |
| Worker / packs / scenarios integration |  | 是 |  |  | 已进入 proposal/package detail narrative，但仍需扩到更多 detail 页 |
| Enterprise IAM / org admin / full permissions platform |  |  | 是 |  | 本轮刻意不做，不偏离 controlled-trial 边界 |
| Runtime sandbox |  |  | 是 |  | plugin runtime 仍没有真正 sandbox |

## 边界

- 当前 proposal / package 页改造仍是第一轮局部落地，不是全站详情页完成重构
- 当前实现仍以 existing opportunity commercial context 为底，不是新增 canonical Proposal / Package object
- 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台
- plugin runtime 仍没有真正 sandbox
- 当前 Helm 仍默认以 recommendation、review、boundary、decision request 为主，不默认拥有高风险自动承诺和高风险自动发送权限
