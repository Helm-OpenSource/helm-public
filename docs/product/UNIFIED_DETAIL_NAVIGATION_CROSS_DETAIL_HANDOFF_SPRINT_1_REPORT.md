---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Unified Detail Navigation / Cross-detail Handoff Sprint 1 Report

## 当前状态

proposal / package / customer-facing offer / external proposal / reinforcement / sendability / variants 这些 detail 页已经各自进入 judgement-first 模板，但跨页切换仍容易重新丢失上下文。

## 本轮总目标

本轮只做一件事：

- 把这些 detail 页收成一条连续可复用的 detail 经营链

## 本轮交付

- `UNIFIED_DETAIL_NAVIGATION_MODEL_REPORT.md`
- `CROSS_DETAIL_HANDOFF_MODEL_REPORT.md`
- `DETAIL_NAVIGATION_HANDOFF_IMPLEMENTATION_REPORT.md`
- `UNIFIED_DETAIL_NAVIGATION_ALIGNMENT_REPORT.md`
- 共享契约：`lib/presentation/unified-detail-navigation.ts`
- 共享面板：`components/shared/unified-detail-navigation-panel.tsx`
- 第一轮落地链路：
  - `proposal -> package -> customer-facing offer`
  - `customer-facing offer -> external proposal -> reinforcement`
  - `package variants <-> reinforcement variants`

## 总结回答

### 1. unified detail navigation 模型是否已经清楚

已经清楚。当前 node 已统一为 `type / summary / stage / boundary / audience / sendability / strength / prev / next / reason / priority / hint` 结构。

### 2. cross-detail handoff 模型是否已经清楚

已经清楚。当前 handoff 已统一为 `source / target / reason / boundary / prerequisite / dependency / risk / decision request / next action / worker / evidence / visibility` 结构。

### 3. 关键 detail 链路是否已经完成第一轮落地

已经完成第一轮落地，至少 3 条关键链路已成立，并且不是单纯 breadcrumb 或 tab。

### 4. 当前 Helm 是否已经更像一条连续经营推进链，而不是多个孤立详情页

是，至少在商业 detail 主链上已经开始成立。当前页面切换开始保留“为什么切、边界是否变化、谁接手、下一步做什么”的连续语义。

### 5. recommendation / commitment 两条 A-minus 主线在本轮是否仍保持稳定

保持稳定。本轮继续显式保留：

- recommendation 不等于 commitment
- discussion-only 不等于 commitment
- boundary-only 不等于 commitment

### 6. 哪些地方刻意未做，为什么

刻意未做：

- graph navigation platform
- workflow / orchestration engine
- 全站 detail shell
- 自动 handoff routing engine

原因是本轮目标只是把现有商业 detail 页收成连续 handoff 基线，而不是扩成平台层。

### 7. 下一阶段最该做的 5 件事是什么

1. 做 `Package Stage Variants / Commercial Narrative Strengthening Variants Sprint 1`
2. 把 proposal / package / offer / reinforcement 的 detail navigation 冻成 baseline freeze
3. 把 `contacts / companies / meetings / inbox` 接入同一套 navigation / handoff
4. 统一 `founder / sales / delivery / customer success` 的 handoff 责任语义
5. 继续收 `detail navigation` 与 `worker / packs / scenarios` 的集成呈现

## 短表

| 分类 | 项目 | 说明 |
| --- | --- | --- |
| 已经完整成立 | Unified detail navigation model | 共享 node 语义、prev/next、priority、hint 已落到代码和页面 |
| 已经完整成立 | Cross-detail handoff model | 共享 handoff reason / boundary / next action / visibility 结构已落到代码和页面 |
| 已经完整成立 | Detail navigation / handoff implementation | 3 条关键链路已完成第一轮落地 |
| 已经完整成立 | Documentation / guard / test alignment | README、docs、self-check、boundary check、回归测试已对齐 |
| 已成形但仍需下一层 | Handoff mainline stability | 商业 detail 主链已成形，但全站 detail 还没统一接入 |
| 已成形但仍需下一层 | Worker / packs / scenarios integration | 当前 handoff 已能带 worker cue，但还没形成统一 worker handoff 面 |
| 已成形但仍需下一层 | Founder mainline stability | Founder 主演示链可用，但还需要更多 detail 页接入同一条 handoff 叙事 |
| 刻意未做 | Enterprise IAM / org admin / full permissions platform | 本轮不扩权限平台 |
| 刻意未做 | Runtime sandbox | 本轮不做 plugin/runtime sandbox |
| 风险项 | Unified navigation overstatement risk | 如果后续文档写成“完整 orchestration / process engine”会夸大当前完成度 |

## 当前边界

- 当前 unified detail navigation / handoff 仍是第一轮局部落地
- 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台
- 当前 Helm 仍默认以 recommendation、review、boundary、decision request 为主
- 当前不默认拥有高风险自动承诺和高风险自动发送权限
