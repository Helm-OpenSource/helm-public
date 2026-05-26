---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Tenant Resource Settings Control Surface Report V1

更新时间：2026-04-25  
状态：Task 3 implementation slice complete  
对应计划：`HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_IMPLEMENTATION_PLAN_V1.md`

## 1. 结论

本轮完成租户已有资源接入治理的 settings 只读控制面。

`settings -> connectors` 现在会展示 `TenantResourceReadiness` 汇总，把现有 connector、CRM/import、tenant extension、capture session 的状态、信任、最近同步、治理姿态和下一步动作放到同一张 operator-facing readout 里。

这不是新控制面，也不是 connector marketplace；它只是把已有资源是否能支撑 Helm judgement 讲清楚。

## 2. 已经完整成立

| 项 | 当前状态 |
| --- | --- |
| Settings data seam | `features/settings/queries.ts` 已接入 `buildTenantResourceReadiness`，从现有表合成只读 readiness |
| Operator-facing panel | `TenantResourceReadinessPanel` 已进入 settings connectors tab，展示资源状态、信任、最近同步、映射和治理姿态 |
| Role posture | 当前角色没有 connector/import 管理能力时，面板只显示 read-only posture，不提供执行按钮 |
| Safe connector projection | settings 查询不再把 connector token / password 类字段透给客户端，只返回 UI 和 readiness 需要的字段 |
| Display regression | `tenant-resource-readiness-display.test.ts` 覆盖状态文案、write-back blocked 口径和 blocked-first 排序 |

## 3. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| Mapping / trust gap | 当前面板展示 read model 的 mapping completeness 和 conflict count；更细的字段映射、freshness、unresolved gap 规则留到 Task 4 |
| Capability decision trace | 当前只展示治理姿态；资源进入 judgement/action 前的 allow / downgrade / review / deny trace 留到 Task 5 |
| Governed loop | 当前是资源目录与控制面；代表性 `observe -> judge -> govern -> act -> verify -> learn` 闭环留到 Task 6 |
| Browser smoke | 本轮未启动本地 Next server 做视觉 smoke；代码层测试、typecheck、lint 已覆盖 contract 和编译风险 |

## 4. 刻意未做

| 非目标 | 原因 |
| --- | --- |
| 外部写回 / send / execution | 第一阶段继续保持 `resource != authority`，不新增自动执行路径 |
| 新 route / 新 control plane | 本轮只接入 settings 现有 connectors tab，避免扩大导航和控制面 |
| Schema migration | 继续复用现有 Connector / ImportSource / ImportJob / WorkspaceSolutionExtension / CaptureSession |
| Reserved tenant 商业逻辑 | 普通租户资源治理不混入 Helm reserved commercial settlement |

## 5. 验证结果

已通过：

```bash
npm run test -- features/settings/tenant-resource-readiness-display.test.ts lib/tenant-resources/readiness.test.ts
npm run typecheck
npm run lint
```

说明：

- `lint` 通过，保留 7 个仓库既有 unused warning，均不在本轮新增文件内。
- 第一次 `typecheck` 发现 settings query 缺少本地 `isDefined` 类型守卫；已补齐后通过。

## 6. 剩余风险

| 风险 | 处理 |
| --- | --- |
| Readiness 仍是 coarse read model | Task 4 继续加 mapping / trust / freshness / gap readout |
| UI 未做浏览器视觉验证 | 后续若继续改 settings 布局，应启动本地 server 做 browser smoke |
| Extension manifest 查找是 best-effort | 找不到 manifest 时 read model 会保持 manifest_missing / review posture，不授予 authority |

## 7. 下一步

1. 做 Task 4：Mapping / trust / gap readout。
2. 把 import conflict、freshness、extension dependency drift 继续压进 readiness 降级规则。
3. 继续保持 read-before-write，不引入官方写回。
