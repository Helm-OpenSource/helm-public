---
status: active
owner: founder / helm-core
created: 2026-07-05
review_after: 2026-08-05
public_safety: Public-safe runbook skeleton. Real internal operating data, real names, and real receipts never enter this repo; public demos use synthetic data only.
---

# Helm 自身租户运营 Runbook / Self-Tenant Operating Runbook

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本 runbook 描述 Helm 团队如何把 Helm 自己的真实内部经营事件录入 Helm
自身工作区（"用 Helm 经营 Helm"），以及如何用它做 90 秒演示。授权范围由
[founder 决策记录](../_planning/HELM_SELF_TENANT_MINIMAL_LIVE_FOUNDER_DECISION_2026-07-05.md)
与 [gate 回执](../reviews/HELM_SELF_TENANT_MINIMAL_LIVE_GATE_RECEIPT_2026-07-05.md)
定义；本文档不扩大授权。

### 1. 工作区隔离（一次性设置）

1. 保留 seed 的演示工作区（synthetic 数据）用于公开演示。
2. 用标准界面新建一个**独立内部工作区**承载真实内部经营事件；
   不复用演示工作区，不把真实数据混入 synthetic 夹具。
3. 成员按标准 Membership 流程加入；权限按最小需要授予。

### 2. 四类事件的录入路径（全部复用既有 review-first 界面）

类型化真值见
`features/business-advancement/self-tenant-event-intake-map.ts`
（测试强制其引用的 action / 模型 / 路由真实存在）：

| 事件类 | 入口 | 结果对象 |
|---|---|---|
| 线索 / 客户接触 | `/companies` · `/contacts` · `/opportunities` | Company / Contact / Opportunity |
| POC / 项目推进 | `/opportunities` 阶段 + 会议纪要抽取 | Opportunity / Commitment / Blocker |
| 派工与验收 | 承诺创建 + 人工确认完成 | Commitment / Meeting |
| Builder 需求池 | `/search?mode=ask` 提交信号候选 | 审计日志候选队列（review_required） |

边界（每条路径都保持）：人工录入、review-first、无自动外发、无自动写回、
无自动承诺；派工验收不使用 runtime-session 绑定的 DriAssignment。

### 3. 90 秒演示剧本骨架（"用 Helm 演 Helm"）

公开演示**只用 synthetic 演示工作区**；真实数据版演示仅线下受控进行，
剧本相同、数据不同：

1. **0-20s `/dashboard`**：今天必须拍板的 3 件事——判断先行，不是报表。
2. **20-45s `/operating`**：一条线索/阻塞信号如何变成带证据的判断卡；
   指出边界标注（建议 ≠ 承诺）。
3. **45-70s `/approvals`**：客户可见动作停在复核闸等人点；演示"系统不会
   替你发送"。
4. **70-90s `/memory`**：本周沉淀的事实/承诺/阻塞如何被引用与复盘——
   "过程变成经营记忆"。

演示话术红线：不说"AI 自动经营企业"；不把 synthetic 数据说成真实客户；
不展示任何真实内部数据截图。

### 4. 停止 / 回滚

停止录入即回滚开始；`/settings` 自助导出后删除内部工作区即完成回滚。
回滚责任人：founder。无代码或 schema 回滚。

### 5. 催办扫描与回执影子指标（自身租户先行）

owner 决策（2026-07-06）：轻量任务链催办扫描在**自身租户部署先开启**，
POC / 演示环境保持关闭；回执覆盖率作为**工程影子指标**观测，
**不进入已冻结的 POC 验收口径**（是否修订进正式判据待 POC 中期复盘）。

启用方式：在部署环境设置 `LIGHT_CHAIN_FOLLOW_THROUGH_CRON_ENABLED=true`。
注意这是**部署级**开关（会扫描该数据库内所有有未结任务的工作区），
不是按工作区粒度；边界保持 advice-only——只产内部提醒与审计，
不外发、不改任务状态。

回执影子指标（对 `ExecutionReceipt` 直接统计，无需额外开发）：

```sql
-- 回执结构质量概览（按工作区）
SELECT COUNT(*)                                                        AS receipts,
       SUM(CASE WHEN evidenceRefs IS NOT NULL THEN 1 ELSE 0 END)       AS with_evidence,
       SUM(CASE WHEN verificationState = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
       ROUND(AVG(qualityScore), 1)                                     AS avg_quality
FROM ExecutionReceipt
WHERE workspaceId = @workspace_id;

-- 覆盖率分母：已关闭的治理动作数
SELECT COUNT(*) AS closed_actions
FROM ActionItem
WHERE workspaceId = @workspace_id
  AND status IN ('EXECUTED', 'BLOCKED');
```

观测口径参考（非承诺）：结构化回执覆盖率、evidenceRefs 非空率、
他人验收（VERIFIED）率、平均质量分。

### 6. 本文档不证明

- 不是客户部署指南、商业发布批准或生产运维手册。
- 不是 dogfood 探测器（TPQR 族）的启用说明——那条线仍在
  `production-query-adoption-approval-gate` 之后。

## English Reference

This runbook describes how Helm's team enters Helm's own real internal
operating events into a dedicated internal workspace through the standard
review-first surfaces (lead/contact via companies/contacts/opportunities;
POC/project advancement via opportunity stages plus commitments/blockers;
work assignment and acceptance via commitments with manual confirmation;
builder backlog via Ask Helm signal candidates landing review_required in the
audit-log queue), and how to run the 90-second "Helm running Helm" demo.
Public demos use the synthetic demo workspace only; the real-data variant runs
offline with the same script. Typed truth lives in
`self-tenant-event-intake-map.ts`. Stopping entry plus self-service export and
workspace deletion is the full rollback. This is not a customer deployment
guide, not detector enablement, and not a commercial release approval.

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-05 | 初版：工作区隔离、四类事件录入路径、90 秒演示剧本骨架、回滚。 |
| 2026-07-06 | 新增 §5：催办扫描自身租户先行启用方式与回执影子指标（不进冻结验收口径）。 |
