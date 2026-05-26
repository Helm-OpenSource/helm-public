---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Observability Baseline Report v1

更新时间：2026-04-20
状态：MEM-OBS-002 implemented; MEM-OBS-002B trace alignment added

## 1. 本轮目标

完成 `MEM-OBS-002`：补齐 Memory Phase 0 baseline 的第一组真实指标与 eval 分类，让后续 Phase 1 查询硬化、Phase 2 budgeted retrieval pack 和 Phase 3 写路径去重有可复现的起点。

本轮仍不启动：

1. bounded timeline / facts query contract。
2. schema index migration。
3. budgeted retrieval pack runtime。
4. meeting memory write dedupe runtime。
5. distillation candidate 写路径。

## 2. 本轮改动

代码：

- `lib/observability/memory-metrics.service.ts`
  - 新增 memory retrieval baseline proxy。
  - 新增 selected / omitted / stale suppression / duplicate candidate 读数。
  - 新增 source event count 与 average facts per source event。
  - 新增 extraction / briefing LLM fallback reason breakdown。
- `features/diagnostics/diagnostics-client.tsx`
  - 将 memory baseline proxy、stale / duplicate / write amplification proxy 和 fallback reason 加入 diagnostics 只读读面。
- `lib/evals/memory-evals.ts`
  - 为 `eval:memory` 增加 `relevance / stability / duplicate_omission` 三类 category summary。
  - 为每个 golden case 增加 duplicate fact / commitment / blocker 计数。
- `lib/observability/memory-metrics.test.ts`
- `lib/evals/memory-evals.test.ts`
- `lib/connectors/dingtalk.test.ts`
  - 隔离本地 DingTalk MCP gateway env，避免真实本地凭据改变 OAuth callback foundation test 的期望。
- `lib/auth/session.test.ts`
  - 将 active session fixture 的到期时间改为稳定未来日期，避免 2026-04-20 当天开始误判为 expired。

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_MEMORY_OBSERVABILITY_BASELINE_REPORT_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `PLANS.md`
- `docs/README.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| Memory health baseline proxy | Diagnostics 现在能看到 selected / omitted / stale / duplicate / facts-per-source-event 的只读基线代理指标 |
| Fallback reason baseline | extraction / briefing LLM fallback 不再只有 count，也能按 reason 汇总 |
| Eval 分类 | `eval:memory` 输出 relevance、attribution stability、duplicate / omission guard 三类结果 |
| Test coverage | 新增 pure helper tests，覆盖 duplicate / stale / selection / write-amplification proxy 与 eval category |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| selected / omitted | diagnostics 保留 baseline proxy，并通过 MEM-OBS-002B 增加 surface pack trace readout；下一层需要更正式的 trace ledger |
| stale suppression | diagnostics 保留 `freshnessScore / status` proxy，并通过 MEM-OBS-002B 读取 pack omitted reason；下一层需要更细 freshness window |
| duplicate candidate | 当前基于 normalized object/fact key 的只读检测；后续 `MEM-WRITE-005` 已进入 meeting `MemoryFact` lane 第一层写入 duplicate / conflict guard |
| write amplification | 当前用 facts per source event 作为 proxy；后续 `MEM-WRITE-005` 已补第一层 write guard，batch / retry semantics 仍待下一层 |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 新 schema / migration | MEM-OBS-002 只做 baseline 和 eval，不改数据结构 |
| retrieval pack diagnostics integration | MEM-OBS-002B 已补第一轮 diagnostics surface trace readout；本报告仍保留原始 baseline proxy 口径 |
| API pagination contract | 这是 MEM-QUERY-003，不提前做 |
| memory canonical rewrite | 继续保留 review-first / non-auto-promotion 边界 |

## 6. 风险项

1. diagnostics 现在同时有 baseline proxy 与 MEM-PACK-004B surface trace；读数必须分层解释，不能把 proxy 当成真实 pack trace，也不能把 sample trace 写成完整 trace ledger。
2. duplicate proxy 能帮助看见风险，但不能替代 Phase 3 写路径幂等；`MEM-WRITE-005` 第一层只能覆盖 meeting `MemoryFact` lane，不等于完整 review write-back。
3. stale proxy 依赖 `freshnessScore`，后续 richer connector 进入后需要更细 freshness window。
4. fallback reason 取决于 LLM call log 是否写入 reason；没有 reason 时仍会归为 `unspecified`。

## 7. 验证结果

本轮已运行：

```bash
npm run test -- lib/auth/session.test.ts lib/connectors/dingtalk.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts
npm run self-check
npm run check:boundaries
npm run eval:memory
npm run typecheck
npm run lint
npm run test
npm run build
npm run quality:regression
npm run e2e
git diff --check
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run test -- lib/auth/session.test.ts lib/connectors/dingtalk.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts` | 通过 | 4 个 test files / 36 个 targeted tests 通过，覆盖 MEM-OBS helper、eval category、DingTalk env 隔离与日期稳定化 |
| `npm run self-check` | 通过 | 11 / 11 项通过；本地环境已切到 MySQL datasource，DB 配置检查通过 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run eval:memory` | 通过 | extraction 总体 3 / 3 通过；relevance 与 stability category 均为 3 / 3；duplicate_omission category 为 0 / 3，作为 MEM-OBS-002 暴露出的后续写路径去重债务 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 个 warning，非本轮新增 |
| `npm run test` | 未通过 | 222 / 228 test files 通过，964 / 979 tests 通过；剩余 15 个失败均为 Helm v2 runtime DB tests 连接默认 `127.0.0.1:3306` 失败 |
| `npm run build` | 通过 | sandbox 内被 Turbopack 进程/端口权限拦住；按本地执行权限重跑后通过，保留既有 NFT trace warning |
| `npm run quality:regression` | 通过 | 51 / 51 test files、180 / 180 tests 通过 |
| `npm run e2e` | 未通过 | sandbox 内先被 `tsx` IPC 权限拦住；按本地执行权限重跑后，因当前 datasource 指向 shared `helm2026`，`db:reset` 被仓库安全 allowlist 拒绝 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |

补充说明：

- `npm run eval:memory` 第一次在 sandbox 内触发 `tsx` IPC 权限错误，已按本地执行权限重跑并通过。
- 远端同步后本地 `node_modules` 缺少若干邮件相关依赖，已通过 `npm install` 恢复；`package-lock.json` 的无关 metadata 漂移已恢复。
- `npm run db:reset` 未主动运行；`npm run e2e` 内部尝试 reset 时被仓库保护拦截，符合 shared dev DB 的安全边界。

## 8. 下一阶段最该做的 5 件事

1. 延续 `MEM-WRITE-005`，在第一层 `MemoryFact` duplicate / conflict guard 之后补 batch / retry semantics 与 operator-review-required failure posture。
2. 在 staging / CI temp MySQL 环境应用 MEM-QUERY-003 migration，并补 explain 记录。
3. 评估 commitment / blocker / briefing snapshot 是否需要统一进入 pack candidate adapter。
4. 把 meeting detail 用户打开时的 pack trace 写入更正式的 read-only event trail。
5. 保持 recommendation / commitment A-minus 主线不被 retrieval selection reason 误写成承诺。
