---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_PROACTIVE_COLLABORATION_MECHANISM_REPORT

## 目标

定义 Helm 主动把事项送到正确的人或 worker 面前时，应使用的统一协作协议。

## 协作模式

当前第一轮固定 3 种：

1. `helm_drives_human_supervises`
   - Helm 推进，人类监督
2. `helm_prepares_human_decides`
   - Helm 准备，人类拍板
3. `helm_reminds_human_leads`
   - Helm 提醒，人类主导

## 核心语义

- `collaborationMode`
  - 当前协作属于哪一类人机关系。
- `collaborationRequest`
  - Helm 现在为什么把这件事主动送出来。
- `collaborationSummary`
  - 当前协作的高层说明。
- `collaborationReason`
  - 为什么现在需要协作，而不是继续静默等待。
- `collaborationBoundary`
  - 当前协作不能越过的边界。
- `collaborationOwner`
  - 这次协作由谁主责。
- `collaborationWorkerAssignment`
  - 当前哪些 worker 被拉进来，以及它们承担什么准备工作。
- `collaborationEscalationHint`
  - 什么时候应该升级成更强的人类主导。
- `collaborationDecisionRequest`
  - 当前明确需要做的拍板。
- `collaborationNextStep`
  - 现在这次协作应该直接进入的下一步。

## 协作规则

### 只适合 internal-only

- worker 内部草拟
- internal clarification
- review package preparation
- evidence bundle preparation

### 可以拉起 worker

- follow-up framing
- proposal / package shaping draft
- approval preview preparation
- boundary / dependency / risk note generation

### 必须拉起人工

- 高风险外发
- commitment hardening
- customer-facing wording 定稿
- 关键状态变更
- 不可逆执行

### 角色归属

- founder
  - 第一优先动作、风险升级、主承诺方向
- sales
  - follow-up、proposal framing、推进节奏
- delivery
  - readiness / clarification / review walkthrough
- customer success
  - expansion review、success / risk follow-up

## 代表场景覆盖

当前第一轮至少覆盖：

1. founder 决策请求
   - 首页主动送出 founder risk / priority request
2. sales 跟进 / proposal 协作请求
   - 机会页主动送出 sales / delivery collaboration window
3. worker 输出需要人工接手
   - 审批页主动送出 review request
4. 高风险事项升级为人工主导
   - 首页与审批页都明确区分了 Helm 只能建议 vs 必须人工主导

## 当前通过标准结论

- Helm 主动协作机制已经清楚。
- 人机协作模式、责任归属、升级路径和下一步动作已经清楚。
- worker / skill / resource 能继续挂在这套协议里扩。

更细的 contract 分层定义见：

- [`HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`](HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)

## 诚实边界

- 当前还没有完整协作收件箱与全站 handoff plane。
- 当前 customer success 主动协作协议主要停留在协议层，代表页落地仍以前 3 条主链为主。
- 当前 Helm 仍默认不拥有高风险自动承诺和高风险自动发送权限。
