---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Requirements Upgrade Report v1

更新时间：2026-04-20
状态：Requirements baseline completed

## 1. 本轮目标

把 Memory 条线从现有 `Native Memory Efficiency & Reliability Plan` 升级成一份可执行需求基线，明确：

1. 当前 Memory 能力已经成立到哪里。
2. 下一层只做 performance / cost / reliability hardening，不扩平台边界。
3. Phase 2+ 仍受 SWARM 顺序约束；当前已补第一轮 pure retrieval pack builder、briefing / recommendation / meeting detail surface integration 与 diagnostics trace alignment，但不写成完整 memory runtime 全量接入。
4. 后续 PR 的切片、验收、回滚和验证入口。

## 2. 本轮改动

新增：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`

同步：

- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| Memory requirements baseline | 已把 current-main truth、缺口、需求合同、phase 切片和后续 PR 顺序收成正式文档 |
| Scope boundary | 明确不做第二套 memory stack、OpenClaw 深耦合、LLM ranking owner、auto-promotion、send authority |
| Phase ordering | 明确 requirements baseline 后续切片仍受 SWARM 顺序约束；当前 MEM-OBS-002、MEM-OBS-002B、MEM-QUERY-003、MEM-PACK-004 与 MEM-PACK-004B 已完成第一轮 |
| Evidence posture | 需求要求 retrieval selected / omitted trace、duplicate suppression trace、fallback reason 和 eval 同步 |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| Memory health baseline | MEM-OBS-002 已补齐第一轮 duplicate / stale / selection proxy 与 eval 分类；MEM-OBS-002B 已接入第一轮 surface pack trace，下一层需要更正式 trace ledger |
| Bounded query contract | MEM-QUERY-003 已完成第一轮 timeline / facts bounded API contract 与读取索引；下一层需要 staging explain |
| Budgeted retrieval pack | MEM-PACK-004 已完成 pure builder、fallback 和 selected / omitted trace；MEM-PACK-004B 已完成 briefing / recommendation / meeting detail 第一轮接入 |
| Write dedupe | `MEM-WRITE-005` 已完成 meeting `MemoryFact` lane 第一层 normalized duplicate / conflict guard；batch / retry semantics 与 review write-back 仍需下一层 |
| Distillation candidate | Phase 4 需要 review-safe candidate，不覆盖 canonical fact |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| runtime query / schema 改动 | 当前先冻结需求，避免越过 SWARM 顺序约束 |
| UI 改造 | 现有 Phase 0 readout 已有第一刀，本轮不做新 surface |
| full validation chain | 文档需求基线不改变 runtime 行为；本轮只跑文档/边界相关验证切片 |
| full memory freeze | 只有 Phase 0-2 或 Phase 0-3 完成后才适合 freeze |

## 6. 风险项

1. 如果 Phase 1 直接做索引和查询硬化，但没有先补 baseline，可能无法证明延迟和 token 是否真的改善。
2. 如果 budgeted retrieval pack 只追求 token 下降，可能牺牲 recommendation explanation 的 evidence coverage。
3. 如果 duplicate guard 过强，可能把真实 conflict 误判为重复事实。
4. 如果 distillation candidate 没有 review posture，容易被误解为 canonical memory rewrite。

## 7. 验证结果

本轮已运行：

```bash
npm run self-check
npm run check:boundaries
git diff --check
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check:boundaries` | 通过 | boundary guard 全部通过，未发现 recommendation / commitment 或 authority 边界漂移 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |
| `npm run self-check` | 通过 | 本地环境切换到 MySQL datasource 后，11 / 11 项通过 |

MEM-OBS-002 实现切片已追加：

```bash
npm run eval:memory
npm run typecheck
npm run test
```

其中 `npm run eval:memory` 总体通过，并暴露 duplicate_omission category 当前为 0 / 3；这是后续 Phase 3 写路径去重需要解决的债务，不在 requirements baseline 或 MEM-OBS-002 中提前扩面。后续 `MEM-WRITE-005` 已补 meeting `MemoryFact` lane 第一层 duplicate / conflict guard，但 eval golden category 与 batch / retry semantics 仍需下一层继续补齐。

如果进入 schema / API / UI 改动，再恢复完整仓库验证链；`npm run db:reset` 在当前远端 MySQL dev datasource 下不得默认执行。

## 8. 下一阶段最该做的 5 件事

1. 延续 `MEM-WRITE-005`，在第一层 `MemoryFact` duplicate / conflict guard 之后补 batch / retry semantics 与 operator-review-required failure posture。
2. 在 staging / CI temp MySQL 环境应用 MEM-QUERY-003 migration，并补 explain 记录。
3. 把 meeting memory pipeline 的 conflict candidate posture 接到可审计 review readout，而不是自动重写 canonical fact。
4. 将 MEM-OBS-002 的 proxy 指标与后续正式 retrieval trace 对齐，避免命名漂移。
5. 保持 recommendation / commitment A-minus 主线不被 selected reason 或 omitted reason 误写成承诺。
