---
status: active
owner: helm-core
created: 2026-04-18
review_after: 2026-07-17
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Native Memory Efficiency & Reliability Plan v1

更新时间：2026-04-21
状态：Phase 0-3 frozen after MEM-WRITE-005H/005I/005J
适用范围：Helm memory / briefing / recommendation 的 performance + cost + reliability hardening（不引入外部记忆系统耦合）

## 1. 当前 freeze truth

本计划继承并且不重写以下已冻结结论：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`
- `docs/product/HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md`
- `docs/product/HELM_ORGANIZATIONAL_MEMORY_BASELINE_FREEZE_REPORT.md`
- `docs/reviews/HELM_V2_RETRIEVAL_POLICY_RUNTIME_REPORT.md`
- `docs/reviews/HELM_V2_MEMORY_POLICY_OBJECT_LOADING_REPORT.md`
- `docs/reviews/memory-system-code-review.md`
- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`

当前 memory 主链已经成立（meeting -> structured memory -> briefing/recommendation），本轮只做性能、成本、可靠性硬化，不做第二套 memory 栈。

执行顺序约束：

1. 先完成 `SWARM-001`、`SWARM-002` 当前阶段
2. SWARM 线冻结后，再继续本计划 `Phase 2+`
3. 当前仅补齐 requirements baseline 和已落地的 `Phase 0` 基线能力，不并行扩面

## 2. 产品优先级映射（显式回答）

显式引用：

1. `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
2. `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`

本轮任务接到的真实业务闭环：

- `meeting/email/CRM signal -> memory retrieval -> judgement/recommendation -> review -> follow-through`

它服务的是：

- 决策（更相关的 memory 证据）
- 执行（更稳定的写入和更低延迟）
- 审计（retrieval/evidence trace 更完整）
- 复盘（memory distillation 可追溯）

为什么现在做：

- memory 已是 Helm judgement-first 主链的核心依赖，当前瓶颈从“有没有链路”转为“成本与稳定性”。
- 在不扩执行权的前提下，性能/成本硬化是当前 P0/P1 最确定的收益项。

## 3. 本轮要证明什么

这条线只证明三件事：

1. 在不改变 governance 边界下，memory retrieval 能更省 token、更快、更稳。
2. 记忆写入链路可降低重复写放大，并保持 evidence 可追溯。
3. operator 可以看到 memory 质量与成本指标，而不是黑盒 token 消耗。

## 4. 保留边界

继续保留：

- `workspace-first`
- `judgement-first`
- `recommendation != commitment`
- `review-before-commitment`
- `no auto-send`
- `no broad auto-write`

本计划明确不做：

- OpenClaw / 外部记忆运行时深耦合
- 第二套 memory schema 或第二套 recommendation 栈
- 把 LLM 提升为 ranking/policy owner
- 扩 execution authority

## 5. 关键假设

1. 现有 `MemoryItem / MemoryFact / MemoryEntry` 数据模型可通过增量索引与 retrieval pack 策略支撑下一层性能目标。
2. 绝大多数 token 消耗来自 retrieval payload 组织而非单点 prompt 文案。
3. 先做 observability + baseline，再做 retrieval 与写路径优化，可降低回归风险。

## 6. Phase 计划

### Phase 0：基线与可观测性先行

- 建立 memory 专项指标（retrieval 命中率、stale suppression 命中率、每次 briefing/recommendation token、每次 meeting 记忆写入量、重复率）。
- 补 memory 领域 eval 样本：relevance、cost、stability 三类。
- 给 `/operating` 或 diagnostics 补最小 memory health readout（只读）。

当前进展（2026-04-18）：

- 已新增 `lib/observability/memory-metrics.service.ts` 并接入 diagnostics 查询与页面读面，形成第一批 memory health 基线读数。

当前进展（2026-04-20）：

- 已新增 `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`，把本计划升级为正式需求合同，明确 bounded query、budgeted retrieval pack、write dedupe、distillation candidate 与验收边界。
- 已完成 `MEM-OBS-002` 第一轮 baseline：diagnostics 可读 selected / omitted / stale / duplicate / facts-per-source-event proxy，`eval:memory` 可输出 relevance / stability / duplicate-omission category summary。
- 已完成 `MEM-QUERY-003` 第一轮 query hardening：`/api/memory/facts` 与 `/api/memory/timeline` 返回 bounded `items + pageInfo`，支持 conservative default limit、max limit clamp、cursor，并补第一批读取索引。
- 已完成 `MEM-PACK-004` 第一轮 pure builder：`buildMemoryRetrievalPack` 能按 surface/object/budget 选择 selected memory、记录 omitted reason、fallback reason、stale suppression refs 与 non-commitment boundary note。
- 已完成 `MEM-PACK-004B` 第一轮 surface integration：briefing、recommendation evidence 与 meeting detail 现在消费同一份 `MemoryFact -> retrieval pack -> selected facts / trace` adapter，meeting detail 只读展示 selected / omitted / fallback 与 non-commitment boundary。
- 已完成 `MEM-OBS-002B` diagnostics trace alignment：diagnostics 现在同时展示 baseline proxy 与 briefing / recommendation / meeting detail surface pack trace，避免 selected / omitted 口径漂移。
- 已完成 `MEM-WRITE-005` 第一层 write guard：meeting memory pipeline 在写入 `MemoryFact` 前会按 `workspace + source + object + factType + normalized content` 抑制已有重复与批内重复，并按 `normalizedValue` 暴露 conflict candidate，而不是把冲突吞成 duplicate。
- 已完成 `MEM-WRITE-005B` 第一层 batch failure semantics：`createMemoryFactsWithWriteResult` 会返回 batch write summary、retryable / non-retryable / operator-review-required failure classification；meeting pipeline 在 fact write failure 时写失败 audit 并终止后续 timeline / briefing 成功链路。
- 已完成 `MEM-WRITE-005C` 第一层 failure review readout：diagnostics 从 `MEETING_MEMORY_FACT_WRITE_FAILED` audit payload 读取窗口总数，并用最近 50 条 sample 聚合 blocked / partial-failed batch、retryable / non-retryable / operator-review-required count、failure class / reason 与 recent batch posture；该读面只读，不自动 retry，不改写 canonical facts，也不扩 recommendation / commitment authority。
- 已完成 `MEM-WRITE-005D` 第一层 read-only operator queue substrate：failure audit sample 会被转成 retry manual confirm、merge conflict review、source data repair、payload inspection 四类 operator queue item，并暴露 payload status 与截断信息；该 queue 仍只读，不自动 retry、不改写 canonical facts，也不扩 recommendation / commitment authority。
- 已完成 `MEM-WRITE-005E` 第一层 bounded retry contract substrate：operator queue item 会被转成 receipt draft、bounded backoff policy、idempotency lock key 与 manual confirmation gates；该 contract 仍不执行 retry、不写 DB、不改写 canonical facts，也不扩 recommendation / commitment authority。
- 已完成 `MEM-WRITE-005F` 第一层 retry receipt persistence + owner-aware review surface：新增 `AuditLog` receipt persistence 入口、receipt ledger builder、Meeting owner assignment 查询与 diagnostics owner-aware receipt review readout；该 surface 仍只承接人工确认和审查，不执行 retry、不改写 canonical facts，也不扩 recommendation / commitment authority。
- 已完成 `MEM-WRITE-005G` 第一层 retry attempt ledger + source rebuild gate：新增 `AuditLog` attempt persistence 入口、logical idempotency lock read model、duplicate lock conflict / unmatched attempt 统计、source rebuild gate 与 diagnostics 只读 readout；该 gate 仍不执行 retry、不自动重建 `CreateFactInput`、不改写 canonical facts，也不扩 recommendation / commitment authority。
- 已完成 `MEM-WRITE-005H` 第一层 DB-level idempotency guard：新增 `MemoryWriteRetryLock` schema / migration，按 workspace + idempotency lock key 与 workspace + reconstructed write hash 做数据库级 guard，并保留 lock / proof / executor payload。
- 已完成 `MEM-WRITE-005I` 第一层 source reconstruction proof：仅支持 `MEETING_NOTE`，要求 source 存在、未晚于 failure audit 修改、具有可靠 note content、能重建唯一 matching `CreateFactInput`，并经过 duplicate/conflict dry run。
- 已完成 `MEM-WRITE-005J` 第一层 bounded retry executor：只接受人工确认、005I proof 与 005H DB lock；每次最多写一个 reconstructed `MemoryFact`，不重跑 meeting pipeline，不写 commitment / blocker / recommendation，不自动发送。
- 已完成 `MEM-FREEZE-007` Phase 0-3 freeze：Phase 0/1/2/3 当前可冻结为 memory efficiency / retrieval / write reliability 第一阶段基线；Phase 4 distillation candidate 与 owner workflow hardening 后置。
- 已完成 MySQL evidence 第一轮：shared `helm2026` 只读检查显示目标 memory migrations 未 apply、目标索引数为 0，旧失败 migration `20260416000100_longtext_meeting_opportunity_summaries` 与 compatibility view layer 阻断 full migration；session-only temporary EXPLAIN 证明排序索引必须包含 `id` tie-breaker，已修正未落库 migration。

### Phase 1：查询与索引硬化（低风险）

- 收紧高频查询路径（timeline/facts/object-scoped retrieval）的排序和过滤口径。
- 为高频组合条件补必要索引（以 migration + explain 验证）。
- timeline/facts API 增加 cursor/limit contract，避免高基数下的无界读取。

当前状态：`MEM-QUERY-003` 已完成第一轮 API contract 与 migration 索引；shared dev DB 只读 EXPLAIN 已记录并推动索引修正，但 full migration-chain proof 仍需 clean staging / temp MySQL schema。

### Phase 2：Budgeted Retrieval Pack

- 引入统一 `memory retrieval pack` 组装层：
  - 先按 object/context 过滤，再按 trust/importance/recency/promotion posture 打分。
  - 按 surface（briefing/recommendation/meeting detail）给 token budget 上限。
- 每条入选 memory 记录 `selectedReason` 与 `omittedReason`（可审计）。
- 保留 fallback：budget 模块不可用时回退当前策略。

当前状态：`MEM-PACK-004B` 已完成 briefing / recommendation / meeting detail 第一轮接入；`MEM-OBS-002B` 已补 diagnostics surface trace alignment；fail-open runtime 开关、正式 trace ledger 和 `Commitment / Blocker / BriefingSnapshot` 统一候选 adapter 待下一层。

### Phase 3：写路径去重与写放大控制

- meeting memory pipeline 改为批量写入优先（事务内 upsert/createMany where possible）。
- 增加幂等 key / duplicate guard（source + object + normalized fact key）。
- 写入失败按可恢复语义分层：可重试 / 不可重试 / 人工介入。

当前状态：`MEM-WRITE-005` 已完成 meeting `MemoryFact` lane 第一层 duplicate / conflict guard、audit metadata summary 与 source/object/fact 读取索引；`MEM-WRITE-005B` 已完成 fail-fast batch write result、failure classification 与 failure audit blocking posture；`MEM-WRITE-005C` 已把 failure audit payload 接到 diagnostics 只读复盘读面；`MEM-WRITE-005D` 已补 read-only operator queue substrate；`MEM-WRITE-005E` 已补 bounded retry contract substrate；`MEM-WRITE-005F` 已补 retry receipt persistence 与 owner-aware review surface；`MEM-WRITE-005G` 已补 retry attempt ledger、logical idempotency lock read model 与 source rebuild gate；`MEM-WRITE-005H/005I/005J` 已补 DB-level idempotency guard、source reconstruction proof 与 review-first bounded retry executor。Phase 3 当前冻结；事务化 bulk upsert、commitment / blocker lane 和完整 owner workflow 仍待下一层。

### Phase 4：Memory Distillation（有边界）

- 增加 review-safe distillation candidate：
  - 压缩长期重复信息，保留证据链引用，不覆盖原始事实。
- distillation 仅影响 retrieval pack 的摘要层，不直接改写 canonical fact。

### Phase 5：验收与冻结

- 运行完整验证链 + 领域 eval。
- 输出 alignment/freeze 报告，明确“已完整成立 / 已成形待下一层 / 刻意未做 / 风险项”。

## 7. 受影响组件

- `lib/memory/*`（meeting pipeline / fact service / briefing）
- `lib/llm-workflows/*`（meeting memory extraction / briefing）
- `lib/helm-v2/*`（retrieval runtime + trace）
- `lib/observability/*`
- `app/api/memory/*`
- `features/memory/*`（必要时只做只读可观测入口）
- `prisma/schema.prisma`（索引与约束增量）
- `evals/memory/*`
- `scripts/*`（self-check / eval discoverability）

## 8. 风险与回滚

主要风险：

1. 索引迁移在大表上引入锁等待。
2. retrieval budget 过紧导致 evidence 缺失，影响 recommendation 解释性。
3. 去重策略过强导致事实丢失或误合并。

回滚路径：

1. retrieval pack 通过 feature flag 回退到当前策略。
2. distillation candidate 写路径可单独停用，不影响 canonical fact。
3. 索引变更保持可逆 migration，并保留旧查询路径短期开关。

## 9. 验证合同

默认验证链（按仓库规则）：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

领域额外验证：

```bash
npm run eval:memory
npm run eval:recommendation
```

补充验收断言：

1. retrieval 包装后，evidence 缺失率不上升。
2. 关键 memory API p95 延迟下降或持平。
3. 单次 briefing/recommendation token 消耗下降（目标区间由基线报告给出）。
4. LLM 不可用时 fallback 路径仍可稳定产出。

## 10. Done 定义

只有以下同时成立才算完成：

1. 计划中的 phase 至少完成 `Phase 0-2`，并有可复现指标。
2. 文档、守卫、自检、eval 与索引同步完成。
3. recommendation/commitment 边界无回归。
4. 明确给出剩余风险和下一层计划，不把局部优化写成“记忆系统已完整完成”。
