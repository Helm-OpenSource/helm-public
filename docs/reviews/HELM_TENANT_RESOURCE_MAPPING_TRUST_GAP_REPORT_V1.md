---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Tenant Resource Mapping Trust Gap Report V1

更新时间：2026-04-25  
状态：Task 4 implementation slice complete  
对应计划：`HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_IMPLEMENTATION_PLAN_V1.md`

## 1. 结论

本轮把租户已有资源 readiness 从“统一展示”推进到第一层 gap 降级规则。

现在 CRM/import 资源即使最近 job 成功，只要数据新鲜度超过 24 小时，也不会进入 `actionable`；tenant extension manifest 如果没有声明 resource dependency 或 capability declaration，也会进入 `mapping_incomplete` / `review_queue`，不会被误解为可用于 Helm judgement。

## 2. 已经完整成立

| 项 | 当前状态 |
| --- | --- |
| Freshness downgrade | connected CRM/import + completed job 只有在 24h freshness window 内才可 actionable |
| Trust downgrade | stale resource 会保留 `mapped`，但 promotion 降为 `review_required`，fallback 降为 `review_queue` |
| Extension dependency gap | tenant extension manifest 缺 dependency connector / capability declaration 时，mapping completeness 降为 50 |
| Operator gap readout | settings resource panel 新增 primary gap 展示，让 operator 直接看到主要阻塞 |
| Regression coverage | 新增 freshness、manifest dependency gap 和 display gap label 测试 |

## 3. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| Field-level mapping | 当前 mapping completeness 仍来自 import job 粗粒度统计，尚未接 ImportItem / IdentityMatch 细颗粒缺口 |
| Conflict weighting | 当前 conflict count 已显示，但尚未按 unresolved identity / duplicate / skipped 类型细分风险 |
| Capability trace | 资源进入 judgement/action 前仍未输出 allow / downgrade / review / deny trace，留到 Task 5 |
| Single governed loop | 还没有选择代表性资源跑闭环，留到 Task 6 |

## 4. 刻意未做

| 非目标 | 原因 |
| --- | --- |
| 官方写回 | 本轮只做 gap 降级，不改变 effect authority |
| 新 schema | readiness 继续从现有 Connector / ImportSource / ImportJob / WorkspaceSolutionExtension / CaptureSession 聚合 |
| Extension loader 改造 | manifest gap 只读解释，不改变 loader 或执行路径 |
| Marketplace / sandbox | 当前目标仍是已有资源治理，不是资源市场或外部执行隔离 |

## 5. 验证结果

已通过：

```bash
npm run test -- features/settings/tenant-resource-readiness-display.test.ts lib/tenant-resources/readiness.test.ts
npm run typecheck
```

## 6. 剩余风险

| 风险 | 处理 |
| --- | --- |
| 24h freshness window 是第一版保守默认 | 后续可按 resource type / tenant policy 调整，但必须先经过 capability trace |
| Extension missing requirement 只输出字符串 key | Task 5/6 可把 gap reason 接到 decision trace 和 governed loop evidence |
| Settings UI 只展示 top rows | 后续若资源量变大，需要增加筛选或分组，但不应先做 marketplace 化 |

## 7. 下一步

1. 做 Task 5：Capability decision trace integration。
2. 把 resource identity、effect mode、trust posture、fallback、reason code 接入 read-only decision trace。
3. 继续不改变 enforcement source，不新增 official write。
