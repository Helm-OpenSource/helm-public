---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Unified Detail Navigation Baseline Freeze Report

## 当前冻结的核心语义

当前 unified detail navigation baseline 冻结为：

- `detailNodeType`
- `detailNodeSummary`
- `detailNodeStage`
- `detailNodeBoundary`
- `detailNodeAudienceMode`
- `detailNodeSendabilityMode`
- `detailNodeStrengthMode`
- `detailNodePrev`
- `detailNodeNext`
- `detailNodeCurrentReason`
- `detailNodePriority`
- `detailNodeNavigationHint`

## 当前已成立的 detail node

当前 baseline 已明确覆盖：

- `proposal`
- `package`
- `customer-facing-offer`
- `external-proposal`
- `reinforcement`
- `sendability`
- `variants`

其中：

- `variants` 是当前统一导航语义里的 umbrella node
- 具体第一轮页面落地目前体现在：
  - `package-variants`
  - `reinforcement-variants`

## 节点当前成立到什么程度

### 1. 当前版本已经成立

- 每个 node 都能表达“当前我在哪一段商业推进链上”
- 每个 node 都能表达“上一段是什么、下一段是什么”
- 每个 node 都能表达 audience、sendability、strengthening 这些跨页切换时最容易丢失的语义
- 当前 node 的 `reason / boundary / priority / hint` 已进入 shared contract

### 2. 当前仍是下一层候选

- 更细的 package stage node
- 更细的 narrative strengthening node
- 更广的 customer success / meeting / inbox / contacts / companies / conversations 节点接入
- 更自动的 node graph 生成

### 3. 当前刻意未做

- 完整 graph navigation platform
- 统一对象目录浏览器
- 自动 node discovery engine
- 全站 detail graph 生成器

原因是本轮只冻结“连续经营阅读与连续经营判断”的最小 navigation baseline，而不是扩成平台层。

## 信息层级规则

### 首屏必须可见

- 当前 node judgement summary
- 当前 node boundary
- 当前 node current reason
- 上一段 / 下一段的最小关系
- 当前应该继续看这一页还是切到下一页的 hint

### 可降级为 secondary summary

- `detailNodeStage`
- `detailNodeAudienceMode`
- `detailNodeSendabilityMode`
- `detailNodeStrengthMode`
- `detailNodePriority`

### 只能进入 evidence 层

- 历史变化明细
- 更完整的 replay / audit trace
- 原始对象细节
- 低价值的导航辅助元数据

## Freeze 结论

当前 unified detail navigation model 已经清楚，而且足够作为下一阶段继续扩 package stage variants、commercial narrative strengthening、更多 detail 页接入时的共享导航骨架。

它当前解决的是：

- “我现在在哪一段”
- “为什么现在该切到这里”
- “上一段和下一段分别是什么”

它当前还没有试图解决：

- 完整 graph navigation
- 完整 orchestration / process routing
- 全站自动 detail graph
