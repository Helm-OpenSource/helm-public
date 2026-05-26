---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Tenant Resource Capability Trace Report V1

更新时间：2026-04-25  
状态：Task 5 implementation slice complete  
对应计划：`HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_IMPLEMENTATION_PLAN_V1.md`

## 1. 结论

本轮完成租户已有资源 readiness 到 capability decision trace 的第一条 read-only seam。

资源进入 settings resource governance panel 时，现在会生成 operator-facing decision readout：`decision / primary reason / fallback`。trace 会保留 `resourceIdentity`、requested `effectMode`、trust / gap posture 和 fallback，但不改变任何 connector、import、extension 或 action 的真实执行守卫。

## 2. 已经完整成立

| 项 | 当前状态 |
| --- | --- |
| Resource trace builder | `buildTenantResourceCapabilityDecisionTrace` 已接入现有 `CapabilityDecisionTrace` builder |
| Resource posture step | trace source chain 新增 `resource_posture`，表达 effect mode overreach、stale resource、not actionable 和 review requirement |
| Settings readout | settings tenant resource panel 展示 decision trace 摘要，不新增按钮或执行路径 |
| No-permission path | actor 缺少对应 workspace capability 时，trace 先返回 `capability_not_granted` |
| Resource gap path | stale resource 返回 `resource_freshness_unknown`，effect mode overreach 返回 `resource_effect_mode_exceeded` |

## 3. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| Action integration | 当前 trace 是 settings/operator readout；真实 action 使用 trace 留到 governed loop 后再接 |
| Trace persistence | 当前不落库，只做 read-only read model；后续如要 audit persistence 需要单独设计 |
| Reason localization | settings 目前展示 machine-readable trace token，后续可增加正式 bilingual formatter |
| Representative governed loop | Task 6 需要选一个资源，把 trace 放进 `observe -> judge -> govern -> act -> verify -> learn` |

## 4. 刻意未做

| 非目标 | 原因 |
| --- | --- |
| 改 enforcement source | trace 只解释，不取代现有 guard |
| 自动执行 / 外部写回 | `resource != authority` 继续成立 |
| 新控制面 | 继续挂在 settings connectors tab 内 |
| Trace persistence / event sourcing | 本轮只做 read-only seam，避免扩成执行平台 |

## 5. 验证结果

已通过：

```bash
npm run test -- lib/capability-decision-trace.test.ts lib/tenant-resources/readiness.test.ts features/settings/tenant-resource-readiness-display.test.ts
npm run typecheck
```

## 6. 剩余风险

| 风险 | 处理 |
| --- | --- |
| settings trace token 仍偏工程化 | 后续 formatter 可把 `route_to_review / resource_freshness_unknown` 翻成产品文案 |
| trace 不落审计 | 这是刻意边界；进入真实 governed loop 前不做 persistence |
| required capability 映射是第一版 | connector/import/capture/extension 先映射到现有 workspace capability，后续可按 Task 6 loop 校正 |

## 7. 下一步

1. 做 Task 6：选择单条代表性 governed loop。
2. 优先用 CRM import resource 跑 `observe -> judge -> govern -> act -> verify -> learn`。
3. 继续只做 draft/manual execution proof，不做官方写回。
