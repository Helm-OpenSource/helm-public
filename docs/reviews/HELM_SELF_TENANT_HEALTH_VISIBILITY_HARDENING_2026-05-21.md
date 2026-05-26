---
status: archived
owner: helm-core
created: 2026-05-21
review_after: 2026-11-17
---
# Helm Self-Tenant Health Visibility Hardening

日期：2026-05-21  
状态：可见性修复已落地  
范围：`/operating/tenant-health` capability、导航入口、route guard、文案与边界守卫

## 结论

`/operating/tenant-health` 是 Helm 自身租户的可用性守护和健康体检面，用于让 Helm 更好地服务客户租户。它不是演示面，也不是普通客户租户自助功能。

本轮移除了 customer workspace carveout：光潽等普通客户租户不再显示“租户健康”入口，也不能直接访问 `/operating/tenant-health`。该能力只允许 `Workspace.workspaceClass = HELM_RESERVED` 且 `systemKey = helm_reserved_primary` 的 Helm reserved workspace 使用。

## 修复内容

- 删除 `lib/workspace-identity.ts` 中允许特定 customer slug 访问 tenant health 的例外。
- `canAccessTenantHealthWorkspace(...)` 现在只委托 `isHelmReservedWorkspace(...)`。
- `assertTenantHealthAccess(...)` 因此对光潽等 `CUSTOMER` workspace fail closed。
- Sidebar、Topbar 和 `/operating` 内部入口继续复用同一个 capability flag，因此普通客户租户不会看到入口。
- 页面文案从“reserved telemetry / 隐私安全遥测”调整为“可用性守护 / 健康体检”，但仍保持不展示租户原文、prompt、CRM/meeting 内容和精确账单金额。
- `self_tenant_health_privacy_boundary` 增加静态 guard，禁止重新加入 customer workspace carveout。

## 验证

```bash
npm run test -- \
  lib/workspace-identity.test.ts \
  lib/self-tenant-health/privacy.test.ts \
  lib/self-tenant-health/rollup.test.ts \
  lib/self-tenant-health/cost.test.ts \
  lib/self-tenant-health/rate-limit.test.ts
npm run check:boundaries
```

通过标准：

- Helm reserved workspace 可访问 tenant health。
- customer workspace 即使 slug/systemKey 为光潽，也不可访问 tenant health。
- boundary guard 检查 `canAccessTenantHealthWorkspace(...)` 只通过 Helm reserved identity。
- route/query/page 仍不选择或展示原始租户字段。

## 刻意未做

- 不新增普通客户租户的自助健康页。
- 不新增 schema、API、migration 或 rollup 表。
- 不做外部发送、自动执行、自动调配置或自动限流。
- 不改变 cross-tenant derived query 的 alias、bucket、count-only 显示边界。

## 剩余风险

生产仍需部署新包后，光潽租户界面才会消失该入口。代码与远端 main 收口后，按 zip/SFTP 发布流程部署。
