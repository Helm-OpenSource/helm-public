---
status: active
owner: helm-core
created: 2026-05-12
review_after: 2026-08-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 自身租户信号健康与 LLM 成本控制需求

日期：2026-05-12  
状态：P0 最小实现共识版  
适用范围：Helm 自身 `HELM_RESERVED` 租户对客户租户可用性、经营信号健康和 LLM 成本做服务健康体检与支持介入观察。

## 一句话结论

Helm 需要一个自身租户的可用性守护和健康体检面：只看跨租户 alias、聚合计数、健康状态、成本分桶和支持介入原因，用于更好地服务客户租户；不看客户租户的会议、CRM、Ask Helm 原文、证据文本、用户邮箱、LLM prompt 或模型输出。

这不是演示功能，不是普通客户租户自助页，不是跨租户 BI，不是客户数据查看器，也不是自动调参或自动限流系统。本阶段只做 Helm 自身租户内的只读健康体检和边界守卫。

## 评审共识

本需求经过 Codex 与 Claude 两轮评审后收敛为：

- 本轮不做 Prisma schema migration。
- 本轮不新增物化 rollup 表。
- 本轮允许新增 `HELM_RESERVED` 专属只读页面 `/operating/tenant-health`。
- 不允许为任何 `CUSTOMER` workspace 增加专用 slug / systemKey carveout；示例客户等客户租户不可见、不可直达该页面。
- 页面只能消费 privacy-safe derived query。
- 跨租户查询不得选择 `inputSummary`、`outputSummary`、`signalSummary`、`normalizedPayload`、`AuditLog.payload`、`AuditLog.summary` 或业务对象原文字段。
- 成本只显示估算分桶，不显示精确账单金额。
- hard cap enforcement、租户管理员自助页、support snapshot 授权流和自动成本优化全部延后。

## P0 需求

### P0-REQ-01：Privacy-Safe Telemetry Contract

跨租户遥测只允许以下字段类型：

- tenant alias：由 server-side salt 生成，不展示 workspace name / slug。
- 时间窗口：`windowStart` / `windowEnd`。
- 聚合计数：candidate、review、accepted、duplicate、stale、boundary 等计数。
- 分桶：cost bucket、budget posture、health state。
- 枚举：source type、signal type、health state、budget state。
- 支持介入原因：closed enum reason code。

禁止字段：

- 原始 Ask Helm query。
- 会议标题、转写、摘要、行动项正文。
- CRM 公司、客户、联系人、机会名称。
- 邮箱、电话、用户姓名。
- 证据文本、raw evidence refs。
- LLM prompt、raw output、`inputSummary`、`outputSummary`。
- `SignalEvent.signalSummary`、`normalizedPayload`。
- `AuditLog.payload`、`AuditLog.summary`。

### P0-REQ-02：Signal Health Derived Rollup

从现有 `SignalEvent` 与 `AuditLog` 计算每个客户租户的派生健康状态：

- `candidateCount`
- `validityPassCount`
- `validityFailCount`
- `duplicateCount`
- `staleCount`
- `contradictoryCount`
- `crossTenantBlockedCount`
- `unsafeBoundaryCount`
- `reviewRequiredCount`
- `reviewedCount`
- `acceptedCount`
- `rejectedCount`
- `downgradedCount`
- `quarantinedCount`
- `healthState`
- `supportReasonCodes`

阈值：

- `unsafeBoundaryCount > 0`：`blocked`
- review required 大于 reviewed：`blocked`
- candidate 数量足够且 validity pass rate `< 70%`：`risk`
- candidate 数量足够且 duplicate rate `> 25%`：`risk`
- candidate 数量足够且 accepted rate `< 30%`：`watch`

小样本规则：

- 页面显示时小于 5 的计数必须显示为 `<5`。
- 页面不展示真实租户名称，不在 URL 或 DOM 中暴露 workspace id。

### P0-REQ-03：LLM Cost Derived Rollup

从现有 `LLMCallLog` 派生成本观察：

- provider
- model
- model role
- task type
- prompt token count
- completion token count
- success / fallback
- estimated cost minor unit
- cost bucket
- budget state

成本估算只服务内部预算观察，不是供应商账单声明。未知 provider / model 必须 fail closed，不能按 0 成本处理。

页面只展示成本分桶：

- `unknown`
- `cny_0_100`
- `cny_100_1000`
- `cny_1000_10000`
- `cny_10000_plus`

### P0-REQ-04：Helm Reserved Read-Only Page

新增 `/operating/tenant-health`。

访问要求：

- 当前 workspace 必须是 `Workspace.workspaceClass = HELM_RESERVED`。
- `Workspace.systemKey` 必须等于 `helm_reserved_primary`。
- canceled reserved workspace 不允许访问。
- 未授权访问返回 404，避免泄露页面存在。

页面展示：

- 总览：租户数、watch / risk / blocked、小样本抑制数量。
- Support queue：高风险 alias、health state、reason code。
- Tenant rows：alias、health、source、signal count bucket、accepted count bucket、review count bucket、cost bucket、budget state。

页面禁止：

- 原文查看按钮。
- 导出按钮。
- 跨租户全文搜索。
- prompt replay。
- CRM / meeting / Ask Helm 详情入口。

### P0-REQ-05：Audit And Guard

每次页面渲染写一条 Helm 自身租户审计：

- `actionType = TENANT_HEALTH_VIEW_LOG`
- `targetType = HelmReservedTenantHealth`
- payload 只包含 row count、window days、health bucket counts。

边界守卫：

- `npm run check:boundaries` 必须检查 `/operating/tenant-health` 不选择或展示原始字段。
- 单元测试必须覆盖 alias/hash、小样本抑制、成本 unknown fail closed、health 阈值、route/query forbidden fields。

## P1 延后

- 租户管理员 usage / signal quality 自助页。
- Support Snapshot Authorization。
- hard cap / degrade / pause_optional 运行时执行。
- cost per accepted signal / reviewed Must Push / draft adoption。
- context cost attribution。
- 自动优化建议。

## 非目标

本阶段不做：

- 跨租户原文搜索。
- 跨租户 prompt replay。
- 完整 billing / invoice。
- 自动替租户改配置。
- 公开 benchmark。
- 第三方 plugin runtime 或 marketplace。
- 自动把其它租户问题写入 Helm 产品路线图。

## 已实现入口

- `lib/self-tenant-health/*`
- `features/self-tenant-health/tenant-health-page.tsx`
- `app/(workspace)/operating/tenant-health/page.tsx`
- `scripts/decision-first-boundary-check.ts` 的 `self_tenant_health_privacy_boundary`

## 变更记录

- 2026-05-21：修复客户租户可见性：移除特定 customer workspace carveout，`/operating/tenant-health` 重新收口为 Helm reserved workspace 专属可用性守护和健康体检面；普通客户租户不显示入口，直达 route 返回 404。
- 2026-05-12：从本地草案修订为 P0 最小实现共识版；按 Claude 评审意见保留零 migration、隐私安全派生查询、HELM_RESERVED-only 页面，延后 hard cap、support snapshot 和租户自助页。
