---
status: active
owner: founder / helm-core
created: 2026-07-05
review_after: 2026-08-05
public_safety: Public-safe founder decision record. No customer names, commercial terms, real internal business data, or deployment evidence.
---

# Helm 自身租户最小活体使用：Founder 决策记录 / Self-Tenant Minimal-Live Founder Decision

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

### 1. 决策内容

Founder 于 2026-07-05 批准以下范围（且仅此范围）：

> Helm 团队在 Helm 自己的内部工作区（Helm 作为第零号租户）中，
> 通过**标准的 review-first 产品界面**，人工录入 Helm 自己真实发生的
> 内部经营事件，作为最小活体自用（minimal-live dogfooding）。

批准的事件类别（四类，闭集）：

| 事件类 | 说明 | 承接的既有对象 |
|---|---|---|
| `lead_or_customer_contact` | 线索 / 客户接触 | Company / Contact / Opportunity |
| `poc_or_project_advancement` | POC / 项目推进 | Opportunity 阶段 + Commitment / Blocker |
| `work_assignment_and_acceptance` | 派工与验收 | Commitment（人工确认完成） |
| `builder_backlog` | Builder 需求池 | 需求 brief / Ask Helm 信号候选（review_required） |

### 2. 明确不批准（保持既有 gate 不变）

- **不批准** dogfood 探测器族（TPQR blocked_decision / overdue_commitment /
  customer_waiting）的生产查询采用——仍走
  `production-query-adoption-approval-gate` 的独立审批链。
- **不批准**任何 runtime 集成、公开 trial、schema 变更、新路由权限。
- **不批准**任何自动外发、自动写回、自动审批、自动结算、自动执行。
- **不批准**把真实内部经营数据、真实人名或经营回执放入公开仓库、
  synthetic 演示夹具或公开截图。

### 3. 隔离要求

- 真实内部经营事件使用**独立工作区**，与 synthetic 演示数据
  （seed 的 `helm-founder-demo` 演示工作区）隔离。
- 公开演示只使用 synthetic 数据。

### 4. 回滚

- 回滚责任人：founder。
- 回滚动作：停止在内部工作区录入真实事件；已录入数据经 `/settings`
  自助导出后删除工作区即可，不涉及任何代码或 schema 回滚。

### 5. 机器化验证

本决策由 `features/business-advancement/self-tenant-minimal-live-gate.ts`
聚合验证，CLI 入口：

```bash
npx tsx scripts/business-advancement-self-tenant-minimal-live-gate.ts --positive-fixture --expect-go
```

gate 回执见
[HELM_SELF_TENANT_MINIMAL_LIVE_GATE_RECEIPT_2026-07-05.md](../reviews/HELM_SELF_TENANT_MINIMAL_LIVE_GATE_RECEIPT_2026-07-05.md)。

### 6. 本决策不证明

- 不是生产部署、商业发布、客户交付或客户数据接入的批准。
- 不是 dogfood 探测器生产采用的批准。
- 不改变 recommendation ≠ commitment 的任何既有边界。

## English Reference

On 2026-07-05 the founder approved minimal-live self-tenant usage only:
Helm's team manually enters Helm's own real internal operating events
(lead/customer contact, POC/project advancement, work assignment and
acceptance, builder backlog) into Helm's own internal workspace through the
standard review-first product surfaces. Dogfood detector production query
adoption, runtime integration, public trial, schema changes, new route
authority, and all auto-execution stay blocked under their existing gates.
Real internal data lives in a dedicated workspace isolated from the synthetic
demo workspace and never enters the public repository. Rollback owner is the
founder; rollback means stopping entry and deleting the workspace after
self-service export. The decision is machine-checked by
`self-tenant-minimal-live-gate.ts`; this record is not production deployment,
commercial release, customer delivery, or detector adoption approval.

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-05 | 初版：记录 founder 对自身租户最小活体使用的批准范围、不批准项、隔离与回滚要求。 |
