---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_PROACTIVE_FLOW_IMPLEMENTATION_REPORT

## 目标

把主动汇报 / 主动协作机制至少落到 3 条真实链路，避免停在概念层。

## 代表性主动链路

### 1. 风险变化 → Helm 主动汇报 → founder 决策请求

- 页面：
  - [`dashboard/page.tsx`](../../app/(workspace)/dashboard/page.tsx)
- Flow id：
  - `founder-risk-escalation`
- 触发条件：
  - 首页风险信号、待审批和今日经营负载汇成 founder-level operating brief
- Helm 已经先做：
  - 排序今日推进顺序
  - 预路由高风险事项进入 approvals
  - 汇总会议 / inbox / memory / risk context
- 需要用户做：
  - 决定唯一第一动作
  - 决定它先走审批、会议还是跟进
- 边界：
  - Helm 不会把 recommendation 自己变成 founder commitment

### 2. proposal / package 进入新阶段 → Helm 主动汇报 → sales / delivery 协作

- 页面：
  - [`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx)
- Flow id：
  - `sales-delivery-package-window`
- 触发条件：
  - 某条机会进入 package / proposal shaping window
- Helm 已经先做：
  - 排序协作候选对象
  - 挂载 blocker / commitment / briefing snapshot
  - 准备 follow-up framing 与 clarification context
- 需要用户做：
  - 决定 sales / delivery 谁主导下一步
  - 决定先跟进、先开会还是先内部澄清
- 边界：
  - Helm 不会把 package / proposal wording 自己硬化成外部 commitment

### 3. worker 完成 internal draft → Helm 主动汇报 → review / approval / next-step request

- 页面：
  - [`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)
- Flow id：
  - `worker-draft-awaiting-review`
- 触发条件：
  - 某条 trust-sensitive draft 已准备完成并进入 approval boundary
- Helm 已经先做：
  - 准备 draft、来源上下文、结果预览
  - 挂载 recommendation explanation、facts、blockers、commitments
  - 提前把 review request 收成一个单独协作面
- 需要用户做：
  - 通过、拒绝、改写或转人工处理
- 边界：
  - Helm 不能自己批准外发或 trust-sensitive execution

## 当前系统层落点

### 共享协议

- [`proactive-mechanism.ts`](../../lib/presentation/proactive-mechanism.ts)

### 共享组件

- [`proactive-mechanism-panel.tsx`](../../components/shared/proactive-mechanism-panel.tsx)

### 默认页面承接

- judgement
- preparation summary
- collaboration request
- boundary summary
- worker assignment
- evidence drawer
- direct next actions

## 当前通过标准结论

- 3 条代表性主动链路已经成立。
- Helm 已经不再只是“等人来点”的被动系统。
- 后续其它链路可以按这 3 个模板继续复制。

## 诚实边界

- 当前是代表链路，不是完整通知总线。
- 当前仍以 internal preparation、decision request、review / escalation 为主。
- 当前没有把主动机制扩成完整 workflow engine 或 agent orchestration plane。
