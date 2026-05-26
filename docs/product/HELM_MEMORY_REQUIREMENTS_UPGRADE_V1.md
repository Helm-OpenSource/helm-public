---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Memory Requirements Upgrade v1

更新时间：2026-04-27
状态：Phase 4C review-safe distillation candidate review surface complete
Owner：Helm Core

> 这是一份 repo-aligned 的 Memory 条线需求升级基线。它把现有 Organizational Memory、structured memory、v2 retrieval policy 与 native memory efficiency plan 收成一组可执行需求。当前已完成 Phase 0 baseline proxy、Phase 0B diagnostics trace alignment、Phase 1 bounded query contract、Phase 2 pure retrieval pack builder、briefing / recommendation / meeting detail 第一轮 surface 接入，Phase 3 第一层 `MemoryFact` duplicate / conflict guard、batch write result、failure classification、只读 failure review readout、read-only operator queue substrate、bounded retry contract substrate、retry receipt AuditLog persistence 入口、owner-aware retry receipt review surface、retry attempt ledger、logical idempotency lock read model、source rebuild gate、DB-level idempotency guard、source reconstruction proof、review-first bounded retry executor、source/object/fact 索引与 MySQL 只读 EXPLAIN evidence，Phase 4A 纯离线确定性 distillation candidate 检测器第一层，Phase 4B review-safe runtime persistence substrate（`MemoryDistillationCandidate` 表、store service、meeting pipeline 成功链路后置同步、review decision 持久化），以及 Phase 4C `/memory` 第一层 review surface（pending queue、recent decisions、approve / reject / defer action）；它不代表完整 owner workflow、commitment / blocker retry lane、full trace ledger、promoted memory、retrieval pack promotion layer 或 broad auto-execution plane 已经启动。

## 1. 一句话定义

Memory 升级的目标，是让 Helm 在不扩 execution authority、不引入第二套记忆栈的前提下，把 `meeting / email / CRM / report signal -> memory retrieval -> judgement / recommendation -> review -> follow-through -> memory write-back` 这条主链做得更省、更稳、更可审计。

## 2. Current-Main Truth

当前已经成立：

1. `MemoryFact / Commitment / Blocker / BriefingSnapshot` 已支撑会议后结构化记忆、briefing 与 recommendation 输入。
2. Organizational Memory 已冻结为 `replay / audit / memory linkage / decision trace / boundary trace / source-use ledger / operating memory` 七层。
3. Helm v2 已有 `MemoryItem / MemoryCandidate / MemoryPromotion` 和 review-first promotion posture。
4. Retrieval policy 已有 `always_on / stage_triggered / event_triggered / on_demand` 四档与 stale suppression / conflict priority 口径。
5. Diagnostics 已有第一批 memory health readout：facts、corrections、confirmation rate、extraction / briefing LLM token 与 fallback 读数。

当前仍未完整成立：

1. object-scoped retrieval 已有第一轮 limit clamp，timeline / facts API 已有 bounded limit / cursor contract，briefing / recommendation / meeting detail 已接入第一轮 retrieval pack trace，diagnostics 已能并列展示 baseline proxy 与 surface trace；本轮已补 shared dev DB 只读 EXPLAIN 与 session-only temporary index 对照，发现索引需要包含 `id` tie-breaker 并已修正 migration；下一层仍需 clean staging / temp schema 完成 full migration-chain proof 与更正式的 trace ledger。
2. retrieval pack 当前主要接 `MemoryFact` candidate；`Commitment / Blocker / BriefingSnapshot` 仍通过原有 evidence lane 保留，尚未统一进入 pack candidate adapter。
3. memory 写入链路已有第一层 `MemoryFact` normalized duplicate guard、conflict candidate posture、batch write result、retryable / non-retryable / operator-review-required failure classification、diagnostics 只读 failure review readout（窗口总数 + 最近 50 条 sample 细分）、read-only operator queue substrate、bounded retry contract substrate、retry receipt AuditLog persistence 入口、owner-aware retry receipt review surface、retry attempt AuditLog ledger、logical idempotency lock read model、source rebuild gate、DB-level idempotency guard、source reconstruction proof 与 review-first bounded retry executor；完整 owner workflow、commitment / blocker lane、事务化 bulk upsert 与 review write-back 仍未完整成立。
4. 长期重复事实已有 review-safe distillation candidate 第一层：Phase 4A 完成纯离线检测器，Phase 4B 增加 `MemoryDistillationCandidate` 持久化 substrate、`reject / defer / approve` review decision 存储，以及 meeting pipeline 成功写入事实后的后置同步；Phase 4C 在 `/memory` 暴露 pending candidate 复核队列与最近 decision 审计轨迹。它仍不写 canonical `MemoryFact`、不 auto-promote、不接管 recommendation ranking。
5. Memory 成本、质量、重复率与 stale suppression 还没有形成可复现的 freeze baseline。

## 3. 本轮需求目标

本轮 Memory 升级只证明四件事：

1. retrieval 更可控：每个 surface 都知道自己为什么加载这些 memory、为什么省略另一些 memory。
2. cost 更可见：operator 能看到 token、fallback、写入量、重复率和 stale suppression，而不是只看到结果文案。
3. write-back 更可靠：会议和 review 产生的 memory 写入要有去重、幂等和恢复语义。
4. boundary 更稳：recommendation 仍不是 commitment，LLM 仍不拥有 ranking / policy / approval ownership。

## 4. 明确不做

本轮不做：

1. 第二套 memory schema 或第二套 recommendation 栈。
2. OpenClaw / 外部记忆系统深耦合。
3. full knowledge platform、ontology platform 或全量向量检索平台。
4. LLM ranking owner、policy owner 或 approval owner。
5. canonical fact 自动重写、自动 promotion、自动对外发送。
6. execution authority 扩面。

## 5. 角色与 JTBD

### Founder / Owner

当我看一条当前 judgement 或 recommendation 时，我需要知道它引用了哪些可信记忆、哪些旧记忆被压下、哪些事实仍需要复核。

### Sales / Delivery / Customer Success

当我进入一个客户、机会、会议或 follow-through 页面时，我需要系统只带入当前对象最相关的记忆，而不是让我在长历史里找上下文。

### Operator / Reviewer

当系统写入或压缩 memory 时，我需要看到证据链、幂等判断、重复抑制、review posture 和失败恢复路径。

### Product / Engineering

当我们继续推进 memory / recommendation / briefing 时，需要一组稳定 eval、指标和回滚开关，防止 token 成本、延迟或证据缺失悄悄回归。

## 6. 需求合同

### R1：Memory Health Baseline

系统必须提供一组可复现的 memory health 指标：

1. retrieval selection count / omitted count。
2. stale suppression count。
3. duplicate candidate count。
4. memory facts created per source event。
5. extraction / briefing / recommendation prompt token 和 completion token。
6. fallback count 与 fallback reason。
7. correction / confirmation rate。

验收：

- Diagnostics 或等价 operator readout 能读到第一批 baseline，并能区分 proxy baseline 与真实 surface pack trace。（MEM-OBS-002B 已完成第一轮）
- `eval:memory` 至少覆盖 relevance、stability、duplicate / omission 三类断言。
- 指标只读，不引入自动执行权。

### R2：Bounded Timeline / Facts Query Contract

`/api/memory/timeline`、`/api/memory/facts` 和 object-scoped retrieval 必须有明确的 limit / cursor contract。

验收：

- 无显式 limit 时使用 conservative default。（MEM-QUERY-003 已完成）
- 超过上限时返回 bounded response，而不是无界读取。（MEM-QUERY-003 已完成）
- 高频组合条件有索引或清晰的暂缓说明。（MEM-QUERY-003 已完成第一批 `MemoryFact / MemoryEntry / Commitment / Blocker / MemoryCorrection` 索引；MySQL EXPLAIN evidence 后已补 `id` tie-breaker、timeline createdAt 与 object retrieval updatedAt 索引）
- 当前 UI 不因分页 contract 出现空白或重复项。（MEM-QUERY-003 已用 route tests 覆盖 API response contract；当前 UI 未直接依赖旧数组形态）

### R3：Budgeted Retrieval Pack

新增统一 retrieval pack 组装口径，服务 briefing、recommendation、meeting detail 与后续 runtime surfaces。

最低字段：

| 字段 | 说明 |
| --- | --- |
| `surface` | `briefing / recommendation / meeting_detail / runtime_review` 等调用面 |
| `objectType / objectId` | 当前主对象 |
| `budget` | token / item 上限 |
| `selected[]` | 入选 memory，含 trust / importance / recency / promotion posture |
| `omitted[]` | 被省略 memory，含 omittedReason |
| `fallback` | budget 模块不可用时的回退原因 |
| `trace` | selection reason、evidence refs、stale suppression refs |

验收：

- pack 不改变 recommendation ranking owner。（MEM-PACK-004 pure builder 已用 boundary note 与 tests 固定；MEM-PACK-004B 只改变 evidence loading，不接管 ranking service）
- pack 不把 inferred pattern 放到 confirmed fact 之前。（MEM-PACK-004 pure builder 已对 system inference / candidate / distillation candidate 降权）
- pack 失败时回退现有策略。（MEM-PACK-004 pure builder 已支持 fallback reason；MEM-PACK-004B 已把 fallback state 暴露到 surface trace，fail-open runtime 开关仍待下一层）
- explanation 可以引用 selected reason，但不能把 selected reason 写成 commitment。（MEM-PACK-004 pure builder 已保留 non-commitment boundary note；MEM-PACK-004B 在 meeting detail 只读展示该边界）

### R4：Write Deduplication & Write Amplification Control

meeting memory pipeline 和 review write-back 必须逐步支持幂等写入。

最低要求：

1. 基于 `workspace + source + object + normalized fact key` 的 duplicate guard。（`MEM-WRITE-005` 已完成 meeting `MemoryFact` lane 第一层）
2. 批量写入优先，避免同一事件产生不必要多次单写。（`MEM-WRITE-005B` 已完成 fail-fast batch result 第一层；事务化 bulk upsert 待下一层）
3. 写入失败分成 retryable、non-retryable、operator-review-required。（`MEM-WRITE-005B` 已完成分类第一层；`MEM-WRITE-005E` 已完成 retry contract substrate；`MEM-WRITE-005F` 已补 receipt persistence 与 owner-aware review surface；`MEM-WRITE-005G` 已补 attempt ledger / logical idempotency lock / source rebuild gate；`MEM-WRITE-005H/005I/005J` 已补 DB-level guard、source proof 与 review-first bounded executor）
4. 所有 suppress / retry / failure 都保留 audit 或 event trace。（duplicate / conflict summary 与 fact write failure summary 已进入 audit metadata；diagnostics 已有只读 failure review readout、read-only operator queue substrate、bounded retry contract substrate、retry receipt ledger 与 retry attempt gate；DB lock / source proof / executor 有独立 audit payload，完整 owner workflow 待下一层）

验收：

- 同一 meeting note 重跑不会无界增加重复 `MemoryFact`。（meeting `MemoryFact` lane 第一层已完成）
- duplicate suppression 不会吞掉事实冲突；冲突应进入 review / conflict posture。（conflict candidate posture 已完成第一层，operator review surface 待下一层）
- 写入失败不会静默成功，也不会造成 recommendation / commitment 边界漂移。（fact write failure 会写失败 audit 并终止后续 timeline / briefing 成功链路）

### R5：Review-Safe Distillation Candidate

长期重复 memory 可以生成 distillation candidate，但不能直接覆盖 canonical fact。

验收：

- distillation candidate 当前只写 review-required candidate records，不影响 retrieval ranking owner。（纯离线检测器第一层已完成：`lib/memory/distillation-candidate.ts` + 14 单元测试 + 4 离线 fixture + `distillationCandidateSummary` eval 4/4；Phase 4B 已完成持久化 substrate 与 meeting pipeline 后置同步；Phase 4C 已完成 `/memory` 第一层 review surface；pack builder 集成待下一层）
- 原始事实和证据链继续可追溯。（Phase 4B 持久化 `sourceFactIds / evidenceRefs / sourceRefs / latestSourceAt / auditPayload`，不删除或覆盖原始事实）
- candidate 进入 review posture 后才能影响更长期的 promoted memory。（Phase 4C 的 `approve` 仍只记录 candidate decision，不创建 promoted memory，不创建 canonical `MemoryFact`；promoted memory 待后续独立 contract）
- reject / defer 必须保留，不得被下一次自动重写绕过。（Phase 4B 已将 reviewed decisions 作为 priorReviewDecisions 输入检测器，下一次 sync 不会把 reviewed candidate 重置成 pending）

### R6：Eval / Guard / Docs Contract

每个实现切片都必须同步：

1. memory / recommendation eval。
2. self-check 或 boundary check 中的 discoverability。
3. docs / README index。
4. 本轮 report 或 freeze report。

验收：

- `npm run eval:memory` 和 `npm run eval:recommendation` 能解释本轮风险。
- 如果完整验证链未跑，报告必须列出未跑原因和剩余风险。

## 7. Phase 切片

| Phase | 目标 | 交付物 | 状态 |
| --- | --- | --- | --- |
| Phase 0 | 可观测性基线 | memory health readout、baseline metrics、eval category | MEM-OBS-002 已完成 baseline proxy；MEM-OBS-002B 已完成 diagnostics surface trace alignment，仍需后续 freeze |
| Phase 1 | 查询与索引硬化 | bounded API contract、索引 / explain 说明、分页测试 | MEM-QUERY-003 已完成第一轮 bounded API contract 与索引；MySQL shared DB 只读 evidence 已记录，migration-applied proof 仍需 clean staging/temp schema |
| Phase 2 | Budgeted retrieval pack | pack builder、fallback、selected / omitted trace、surface 接入 | MEM-PACK-004 已完成 pure builder；MEM-PACK-004B 已完成 briefing / recommendation / meeting detail 第一轮接入 |
| Phase 3 | 写路径去重 | normalized key、duplicate guard、可恢复失败语义 | `MEM-WRITE-005` 已完成第一层 `MemoryFact` duplicate / conflict guard 与 source/object/fact 索引；`MEM-WRITE-005B` 已完成 batch write result 与 failure classification；`MEM-WRITE-005C` 已完成 diagnostics 只读 failure review readout；`MEM-WRITE-005D` 已完成 read-only operator queue substrate；`MEM-WRITE-005E` 已完成 bounded retry contract substrate；`MEM-WRITE-005F` 已完成 retry receipt persistence 与 owner-aware review surface；`MEM-WRITE-005G` 已完成 retry attempt ledger、logical idempotency lock read model 与 source rebuild gate；`MEM-WRITE-005H` 已完成 DB-level idempotency guard；`MEM-WRITE-005I` 已完成 source reconstruction proof；`MEM-WRITE-005J` 已完成 review-first bounded retry executor；Phase 3 当前冻结，完整 owner workflow / commitment-blocker lane 待下一层 |
| Phase 4 | Distillation candidate | review-safe candidate、evidence trace、runtime persistence substrate、review surface、retrieval summary layer | Phase 4A 已完成（纯离线检测器 + eval 门控）；Phase 4B 已完成 `MemoryDistillationCandidate` 持久化 substrate、store service、review decision、meeting pipeline 后置同步；Phase 4C 已完成 `/memory` pending queue、recent decisions 与 approve / reject / defer review action；promoted memory / retrieval pack promotion layer 待下一层 |
| Phase 5 | Freeze | full validation、domain eval、freeze report | 待启动 |

## 8. 后续 PR 顺序

1. `MEM-REQ-001`：需求基线与索引同步。（已完成）
2. `MEM-OBS-002`：补齐 memory health baseline 与 eval 分类。（已完成）
3. `MEM-OBS-002B`：diagnostics proxy / surface trace alignment。（已完成第一轮）
4. `MEM-QUERY-003`：timeline / facts / object retrieval bounded contract 与索引。（已完成第一轮）
5. `MEM-PACK-004`：budgeted retrieval pack builder + fallback。（已完成 pure builder）
6. `MEM-PACK-004B`：briefing / recommendation / meeting detail surface integration。（已完成第一轮）
7. `MEM-WRITE-005`：meeting memory write dedupe / idempotency。（已完成第一层 `MemoryFact` write guard）
8. `MEM-WRITE-005B`：batch write result / failure classification。（已完成第一层；自动 retry executor 待下一层）
9. `MEM-WRITE-005C`：failure review diagnostics readout。（已完成第一层）
10. `MEM-WRITE-005D`：read-only operator queue substrate。（已完成第一层）
11. `MEM-WRITE-005E`：bounded retry contract substrate。（已完成第一层）
12. `MEM-WRITE-005F`：retry receipt persistence + owner-aware operator review surface。（已完成第一层）
13. `MEM-WRITE-005G`：retry attempt ledger + logical idempotency lock read model + source rebuild gate。（已完成第一层）
14. `MEM-WRITE-005H`：DB-level idempotency guard。（已完成第一层）
15. `MEM-WRITE-005I`：source reconstruction proof。（已完成第一层）
16. `MEM-WRITE-005J`：review-first bounded retry executor。（已完成第一层）
17. `MEM-FREEZE-007`：Phase 0-3 freeze report。（已完成）
18. `MEM-DISTILL-006`：review-safe distillation candidate。（Phase 4A 已完成纯离线检测器 + 4 离线 fixture + eval 门控；Phase 4B 已完成持久化 substrate、review decision 与 meeting pipeline 后置同步；Phase 4C 已完成 `/memory` 第一层 review surface；promoted memory / retrieval pack promotion layer 待下一层）

## 9. 受影响入口

代码入口：

- `lib/memory/*`
- `lib/recommendations/*`
- `lib/llm-workflows/*`
- `lib/helm-v2/*`
- `lib/observability/memory-metrics.service.ts`
- `app/api/memory/*`
- `app/api/recommendations/*`
- `features/memory/*`
- `features/diagnostics/*`
- `evals/memory/*`
- `scripts/memory-evals.ts`

文档入口：

- `docs/memory-system/implementation.md`
- `docs/recommendation-engine/implementation.md`
- `docs/product/HELM_ORGANIZATIONAL_MEMORY_FOUNDATION_V1.md`
- `docs/product/HELM_ORGANIZATIONAL_MEMORY_BASELINE_FREEZE_REPORT.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_V2_RETRIEVAL_POLICY_RUNTIME_REPORT.md`
- `docs/reviews/HELM_V2_MEMORY_POLICY_OBJECT_LOADING_REPORT.md`

## 10. Done Definition

Memory 升级不能因为某个页面展示或某个 prompt 优化就写成完成。至少需要：

1. Phase 0-2 完成，并有可复现 baseline。
2. retrieval selected / omitted trace 可审计。
3. bounded query contract 不再依赖调用方自律。
4. write dedupe 不破坏 conflict / correction / confirmation path；当前第一层已把同 semantic key 不同内容收成 conflict candidate，仍需 operator review readout。
5. eval / self-check / docs / report 同步。
6. recommendation / commitment A-minus 主线不回退。

## 11. 当前分级

### 已经完整成立

- Organizational Memory 七层定义。
- structured memory -> briefing / recommendation 的第一条主链。
- retrieval policy 四档 current-main truth。
- 第一批 diagnostics memory health readout。
- diagnostics 对 baseline proxy 与第一轮 surface pack trace 的分层读面。
- timeline / facts API 的第一轮 bounded limit / cursor response contract。
- budgeted retrieval pack pure builder contract。
- briefing / recommendation / meeting detail 的第一轮 retrieval pack surface trace。
- meeting memory pipeline 的第一层 `MemoryFact` normalized write guard 与 source/object/fact 索引。
- meeting `MemoryFact` batch write result、failure classification 与 failure audit blocking posture。

### 已成形但仍需下一层

- memory cost / quality baseline。
- object-scoped retrieval 已有 limit clamp、pure pack builder、三处 surface trace 和 diagnostics 对齐；shared dev DB 只读 EXPLAIN 已证明当前 view/base-table 形态下 target migrations 未 apply 且旧索引仍 filesort，session-only temporary EXPLAIN 已证明 `id` tie-breaker 必要；更正式的 trace ledger 与 clean staging/temp migration proof 还需下一层。
- retrieval pack candidate adapter 当前仍以 `MemoryFact` 为主，commitment / blocker / briefing snapshot 尚未统一进 pack 候选。
- write dedupe / idempotency 已有 meeting `MemoryFact` lane 第一层，并已补 batch result / failure classification、read-only operator queue substrate、bounded retry contract substrate、retry receipt persistence、owner-aware retry receipt review surface、retry attempt AuditLog ledger、logical idempotency lock read model、source rebuild gate、DB-level idempotency guard、source reconstruction proof 与 review-first bounded executor；commitment / blocker、事务化 bulk upsert、完整 owner workflow 仍需下一层。
- distillation candidate 已有离线检测器、持久化 substrate、review decision、meeting pipeline 成功链路后置同步与 `/memory` 第一层 review surface；full owner workflow、promoted memory 与 retrieval pack promotion layer 仍需下一层。

### 刻意未做

- 第二套 memory stack。
- 外部记忆系统深耦合。
- LLM ranking / policy ownership。
- canonical fact 自动重写。
- send authority 或 broad auto-write。

### 风险项

- budget 过紧导致 evidence 缺失。
- duplicate guard 过强导致事实冲突被误吞。
- 索引迁移在大表上带来锁等待。
- 指标只看 token 降低，反而牺牲 judgement 证据质量。
