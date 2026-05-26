---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Tenant Resource Readiness Read Model Report V1

更新时间：2026-04-25  
状态：Task 2 implementation slice complete  
对应计划：`HELM_TENANT_RESOURCE_INTEGRATION_GOVERNANCE_IMPLEMENTATION_PLAN_V1.md`

## 1. 结论

本轮完成租户已有资源接入治理的第一条代码切片：只读 `TenantResourceReadiness` read model。

它把现有 connector / import source / import job / tenant extension / capture session 姿态合成统一资源 readiness，不新增 schema migration，不改变 connector、import、extension 或 runtime 的既有行为。

## 2. 已经完整成立

| 项 | 当前状态 |
| --- | --- |
| Read model contract | `lib/tenant-resources/readiness.ts` 已提供统一 `TenantResourceReadiness` 与 summary contract |
| CRM/import readiness | connected CRM import source + completed job 可进入 `mapped/actionable`，并保留 evidence refs |
| Connector downgrade | errored / disconnected connector 会降级为 `error/paused`，不产生写权限 |
| Tenant extension posture | tenant custom extension 只在 manifest dependency / capability 声明下进入 `governed`，且保持 review-first |
| Boundary notes | summary 与 resource-level readout 都明确 `resource != authority`、无 auto-write、无 customer-visible send |

## 3. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| Settings resource control surface | 需要把 read model 接到 settings，让 owner/admin 看到资源状态、缺口和下一步 |
| Mapping / trust gap | 需要接入更细的 import conflict、extension dependency drift 和 freshness 规则 |
| Capability trace integration | 需要让 resource-driven judgement/action 输出 read-only capability decision trace |
| Governed loop | 需要选定一条代表性资源链路跑通 `observe -> judge -> govern -> act -> verify -> learn` |

## 4. 刻意未做

| 非目标 | 原因 |
| --- | --- |
| Schema migration | 第一阶段按计划只做现有数据源合成，避免过早固化抽象 |
| 新 connector / marketplace | 本线目标是治理已有资源，不是扩大连接器数量 |
| 外部自动写回 | guarded official write 被后置到 Phase 5，本轮只表达 posture |
| UI surface | 先让 contract 和测试站稳，再接 settings / operating |
| Reserved tenant commercial logic | 普通租户资源接入不混入 Helm reserved 商业结算逻辑 |

## 5. 验证结果

已通过：

```bash
npm run test -- lib/tenant-resources/readiness.test.ts
npm run typecheck
npm run lint
DATABASE_URL='mysql://user:pass@127.0.0.1:3306/helm2026_ci_verify' npm run self-check
npm run check:boundaries
git diff --check
```

说明：

- 第一次 `typecheck` 被本地 `.next/types/* 2.ts` 重复生成缓存挡住；清理 `.next` 后通过。
- `lint` 通过，保留 7 个既有 unused warning，均不在本轮改动文件内。
- 第一次 `self-check` 因本地未配置 `DATABASE_URL` 失败；补 dummy `DATABASE_URL` 只满足配置检查后通过，未连接数据库。

## 6. 剩余风险

| 风险 | 处理 |
| --- | --- |
| Read model 还没有接真实 query | 下一步 Task 3 在 settings 查询层接入 |
| Mapping completeness 仍是 import job 粗粒度估算 | Task 4 细化 mapping / conflict / freshness |
| Extension manifest dependency 只读解释还较浅 | Task 4 与 extension manifest validation 一起加深 |
| Full DB-backed tests 未在本轮执行 | 本切片是 pure function contract；DB reset 留到接真实 query / surface 时执行 |

## 7. 下一步

1. 做 Task 3：Settings resource control surface。
2. 只接只读查询和展示，不加操作按钮。
3. 无权限用户显示 read-only posture。
4. 继续保持 `resource does not govern` 和 `read before write`。
