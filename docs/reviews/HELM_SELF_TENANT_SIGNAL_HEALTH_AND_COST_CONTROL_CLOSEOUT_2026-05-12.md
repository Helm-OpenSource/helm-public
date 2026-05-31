---
status: archived
owner: helm-core
created: 2026-05-12
review_after: 2026-11-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm 自身租户信号健康与 LLM 成本控制收口报告

日期：2026-05-12  
状态：P0 最小实现已落地  
需求来源：`/Users/tommyqian/Documents/Helm-local/requirements-drafts/HELM_SELF_TENANT_SIGNAL_HEALTH_AND_LLM_COST_CONTROL_REQUIREMENTS_2026-05-12.md`

## 结论

本轮将草案收窄为 `HELM_RESERVED` 自身租户内部只读观察能力：不做 schema migration、不新增 rollup 表、不做 hard cap 执行、不开放租户自助页；只提供隐私安全派生查询、成本分桶、信号健康状态和支持介入队列。

2026-05-21 复核补充：该能力的业务定义是 Helm 自身租户里的可用性守护和健康体检，用于帮助 Helm 更好地服务客户租户；它不是演示功能，也不是普通客户租户自助页。已移除特定 customer workspace 可见性例外，示例客户等普通客户租户不应显示入口或直达访问。

## 已经完整成立

- `lib/self-tenant-health/` 纯函数与服务端查询已落地。
- `/operating/tenant-health` 只允许 Helm reserved workspace 服务端访问，未授权返回 404。
- `canAccessTenantHealthWorkspace(...)` 只通过 `isHelmReservedWorkspace(...)`，不保留 customer slug / systemKey carveout。
- 页面只显示 alias、计数桶、成本桶、health state、budget state 和 reason code。
- 页面 DTO 在服务端剥离 `workspaceId`、精确估算金额和 `topCostFeatureArea`，避免后续误改成 client component 时把内部字段序列化到浏览器。
- `TENANT_HEALTH_VIEW_LOG` 审计写入已接入。
- `check:boundaries` 已新增 `self_tenant_health_privacy_boundary`，防止 route/query 选择或展示原始字段。

## 已成形但仍需下一层

- LLM 成本当前是内部估算分桶，不是供应商账单对账。
- Signal health 当前基于现有 `SignalEvent` / `AuditLog` 派生，尚未物化每日 rollup。
- Review / accepted 等指标依赖现有 action type 命名，后续应收成更稳定的事件合同。

## 刻意未做

- 不做 Prisma schema migration，避免与当前未提交 schema/control-line 改动冲突。
- 不做租户管理员 usage 页面。
- 不做 Support Snapshot 授权流。
- 不做 hard cap / degrade / pause_optional 运行时执行。
- 不做跨租户原文查看、导出、搜索、prompt replay。

## 风险项

- 成本单价是内部 pilot estimate；页面已标注为 estimated bucket，但供应商账单对账仍未实现。
- Alias 使用 server-side salt；若未来需要跨进程长期趋势，需要重新评估是否允许持久化匿名映射。
- 当前 page-level rate limit 是进程内保护，不是分布式限流。

## 2026-05-21 可见性修复

- 新增 [HELM_SELF_TENANT_HEALTH_VISIBILITY_HARDENING_2026-05-21.md](./HELM_SELF_TENANT_HEALTH_VISIBILITY_HARDENING_2026-05-21.md)。
- 示例客户等 `CUSTOMER` workspace 访问 `/operating/tenant-health` 必须 fail closed。
- Sidebar、Topbar、`/operating` 内部入口继续复用同一个 reserved-only capability。
- `self_tenant_health_privacy_boundary` 增加静态 guard，防止再次加入 customer workspace carveout。

## 验证

本轮验证以 focused tests + repository gates 为准，最终命令结果见本轮 Codex 回执。
