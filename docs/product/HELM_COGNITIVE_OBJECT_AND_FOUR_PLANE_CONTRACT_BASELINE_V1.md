---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Cognitive Object And Four-plane Contract Baseline V1

状态：Draft  
Owner：Helm Core  
日期：2026-04-08

## 1. 目的

这份 baseline 只冻结 Helm 当前阶段的认知对象层与四层控制面 contract。

它不是：

- 新一轮 ontology platform
- 新一轮 abstract runtime platformization
- 新的 execution authority
- 对现有主干 truth 的重命名式重写

它只回答三件事：

1. Helm 当前最小认知对象是什么
2. 这些对象分别落在哪一层控制面里
3. 当前哪些对象已经完整成立，哪些仍需下一层

## 2. 继承的当前阶段 truth

本轮默认继承：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`

本轮对应的真实业务闭环是：

- 第一条真实业务闭环
- 会议 / 邮件 / CRM / 报表输入进入系统后的事实、任务、证据、结果、复盘链

本轮服务的角色是：

- 决策
- 执行
- 审计
- 复盘

本轮优先级判断：

- 它不是新的 P0 功能扩面
- 它是为现有 P0 主线提供统一 contract 的 P1 级基础收口
- 不应替代 `DingTalk meetings runtime`、`internal deployment / workspace bootstrap`、`first real business loop`

## 3. 四层控制面

Helm 当前阶段统一使用以下四层：

### 3.1 Source / Ingestion

职责：

- 接收会议、邮件、CRM、报表、知识库、连接器输入
- 保留原始 source provenance
- 不直接跳过 runtime / governance 进入外部执行

### 3.2 Belief / Runtime

职责：

- 形成事实、冲突、置信度、payload、notebook、world model
- 输出系统当前“相信什么为真”
- 不直接产生高风险外部副作用

### 3.3 Operator / Governance

职责：

- 承载 review、approval、audit、support pack、exception posture
- 决定哪些建议可继续推进
- 保持 judgement-first、review-first

### 3.4 Execution / Commitment

职责：

- 承载已承诺推进的动作、责任人、SLA、阻塞、revocation
- 只记录已批准或已进入明确推进状态的动作
- 继续保持 `no auto-send / no broad auto-write / no execution-authority expansion`

## 4. 认知对象

### 4.1 Belief

定义：

- 系统当前认为为真的事实、冲突、上下文与置信度层

当前映射：

- `MemoryFact`
- `TruthConflict`
- `WorldModelSnapshot`
- 部分 `MemoryItem`

最小要求字段：

- source
- freshness
- confidence
- conflict posture
- owner / scope
- evidence refs

当前状态：

- 已成形但仍需下一层

原因：

- Helm 已有事实、冲突、world model 相关对象
- 但还没有单一 canonical `Belief` object

### 4.2 Goal

定义：

- 系统当前希望推动达成的目标层

当前映射：

- `MeetingNote.meetingGoal`
- `HandoffPacket.goal`
- `ProblemSpace.title + nextStep`

最小要求字段：

- goal text
- scope
- owner
- KPI / outcome link
- evidence requirement
- current status

当前状态：

- 已成形但仍需下一层

原因：

- Helm 里已有多处目标表达
- 但还没有 canonical `Goal` object

### 4.3 Committed Intention

定义：

- 系统已经批准并正式推进的动作层

当前映射：

- `Commitment`
- `ApprovalRequest`
- `ActionItem`

最小要求字段：

- owner
- due date / SLA
- blockers
- revocation posture
- evidence link
- status

当前状态：

- 已经完整成立

原因：

- Helm 已有承诺、审批和动作对象
- 已能支撑 owner / status / overdue / review posture

### 4.4 OperatingGap

定义：

- 系统已识别的经营缺口层

当前映射：

- `TruthConflict`
- `ProblemSpace`
- `CompositionFailure`

最小要求字段：

- gap type
- severity
- missing field or unresolved state
- owner hint
- evidence refs
- escalation posture

当前状态：

- 已成形但仍需下一层

原因：

- Helm 已能表达冲突、问题空间和组合失败
- 但还没有统一 canonical `OperatingGap` object

## 5. 当前阶段明确成立的 truth

### 已经完整成立

- 四层控制面的命名、顺序和边界已经冻结
- `Committed Intention` 作为执行/承诺层对象已经成立
- `Belief / Goal / OperatingGap` 的最小字段要求已经冻结
- `Source -> Belief -> Governance -> Commitment` 的默认流向已经冻结

### 已成形但仍需下一层

- `Belief` 仍是多对象映射，不是单一 canonical object
- `Goal` 仍是多处表达，不是单一 canonical object
- `OperatingGap` 仍是多对象映射，不是单一 canonical object
- `truth reconciliation engine` 仍未成立

### 刻意未做

- 不做 ontology platform
- 不做 full BDI runtime
- 不做新的 execution plane
- 不做 connector platformization
- 不做 broad auto-write
- 不做 auto-send

## 6. 当前阶段推荐接线顺序

后续推荐按以下顺序推进：

1. `PR101` - narrow truth reconciliation engine
2. `PR102` - OperatingGap object
3. `PR103` - first real business loop wiring

## 7. 边界

这份 contract 必须继续保留以下边界：

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 8. 完成定义

这份 baseline 的完成，不以“新平台已建立”为定义，而以以下事项为定义：

1. 四层控制面的边界已明确
2. 四类认知对象已明确
3. 已成立 / 仍需下一层 / 刻意未做 已明确
4. 后续 runtime 实施不再需要重新争论对象边界
