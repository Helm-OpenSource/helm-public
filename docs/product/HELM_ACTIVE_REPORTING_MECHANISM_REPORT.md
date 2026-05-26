---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_ACTIVE_REPORTING_MECHANISM_REPORT

## 目标

把 Helm 的“主动汇报”从页面文案升级成统一机制，让首页、事件提醒和 decision request 都能共用同一套协议。

## 主动汇报类型

当前第一轮固定 3 种：

1. `periodic`
   - 周期性汇报
   - 代表：今日经营简报
2. `event`
   - 事件性汇报
   - 代表：proposal / package 进入新阶段
3. `request`
   - 请求式汇报
   - 代表：worker draft 已准备好，等待 review / approval

## 核心语义

- `activeReportType`
  - 汇报属于周期性、事件性还是请求式。
- `activeReportSummary`
  - Helm 现在主动送出来的结论。
- `activeReportReason`
  - 为什么 Helm 会在这个时点主动送出来。
- `activeReportPriority`
  - 当前属于经营关注、观察还是紧急升级。
- `activeReportBoundary`
  - 当前主动汇报必须继续保留的审批、信任或承诺边界。
- `activeReportDecisionRequest`
  - 现在明确需要人做的决定。
- `activeReportWorkerSummary`
  - 哪些 worker 已经先做了准备。
- `activeReportEvidenceSummary`
  - 证据摘要，默认进入 evidence drawer。
- `activeReportAudience`
  - 当前汇报应该送给 founder / sales / delivery / customer success / operator 中的谁。
- `activeReportDeliveryMode`
  - 当前适合首页简报、事件提醒还是 decision request。
- `activeReportPreparationSummary`
  - Helm 在汇报前已经先做的准备动作。

## 默认视图分层

### 首页简报

- `periodic`
- 更适合送到首页与页头 briefing
- 代表：[`dashboard/page.tsx`](../../app/(workspace)/dashboard/page.tsx)

### 事件提醒

- `event`
- 更适合送到对象页、推进页或协作工作区
- 代表：[`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx)

### decision request

- `request`
- 更适合送到审批 / review / escalation 工作区
- 代表：[`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)

## 哪些内容应该放在哪里

### 默认主视图

- `activeReportSummary`
- `activeReportReason`
- `activeReportPreparationSummary`
- `activeReportDecisionRequest`
- worker / owner / next actions

### secondary summary

- `activeReportPriority`
- `activeReportAudience`
- `activeReportDeliveryMode`
- `activeReportBoundary`

### evidence drawer

- `activeReportEvidenceSummary`
- replay / audit / memory links

### audit / replay / memory drill-down

- 原始对象
- 更深的 recommendation evidence
- 更深的 blocker / commitment / briefing trail

### internal-only / builder

- 更细的 policy 细节
- 更深的 builder 诊断
- 不适合直接前置给 customer-facing 场景的内部 cue

## 代表场景覆盖

当前第一轮已经覆盖：

1. 今日经营简报
   - 首页 founder 决策请求
2. 风险升级提醒
   - 首页 founder 风险升级与审批边界提醒
3. proposal / package 进入新阶段
   - 机会页 sales / delivery 协作窗口
4. worker 完成关键准备动作
   - 审批页 worker draft → review request
5. 需要 founder / sales / delivery 拍板
   - 三条代表链路都带有明确 decision request

## 当前通过标准结论

- Helm 主动汇报机制已经清楚。
- 周期性、事件性、请求式汇报边界已经明确。
- 页面和通知流后续可以按同一套协议继续扩。

## 诚实边界

- 当前第一轮主要落在代表页，不是完整通知中心重构。
- 当前默认仍以 internal preparation + report + request 为主，不是完整自动执行平面。
- customer-facing follow-up 资产仍然要继续经过 boundary / review / approval，不因为“主动汇报”而自动越权。
