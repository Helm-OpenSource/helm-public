---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - Production redacted payload cadence and reviewer scoring supersede this offline evaluation framework
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory Evaluation Framework V1

更新时间：2026-04-27
状态：Planning / evaluation contract
Owner：Helm Core

> 本文件定义 Helm 如何评估“公司记忆”作为数字经营资产、公司世界模型和 LLM 经济性杠杆的质量。它不是 runtime implementation plan，不授权 schema 扩张、API、页面行为、自动 promotion、LLM 最终排序、official write 或自动执行。

## 1. 一句话结论

公司记忆不能只按“抽取是否准确”评估。Helm 必须评估它是否让系统用更少上下文、更低模型成本、更稳定边界，做出更可信的经营判断和 Must Push 推进建议。

换句话说，Memory 的核心验收不是“记住了多少”，而是：

1. 是否让公司世界模型更准确。
2. 是否让经营推进更及时。
3. 是否让 LLM 使用更经济。
4. 是否让证据、边界和复核更稳。

## 2. 当前 Repo Truth

当前已经成立：

1. `MemoryFact / Commitment / Blocker / BriefingSnapshot` 支撑会议后结构化记忆、briefing 与 recommendation 输入。
2. `eval:memory` 已覆盖 relevance、stability、duplicate / omission 与 distillation candidate 第一层。
3. `buildMemoryRetrievalPack` 已提供 selected / omitted / fallback / stale suppression / boundary trace。
4. diagnostics 已有第一批 memory health readout。
5. meeting memory write path 已有第一层 duplicate guard、failure classification、retry proof、DB-level idempotency guard 与 review-first bounded executor。
6. `MemoryDistillationCandidate` 已有 review-safe persistence substrate 与 `/memory` 第一层 review surface。

当前仍未完整成立：

1. `evals/memory/golden-samples.json` 当前只有 3 个 golden cases，`evals/memory/distillation-candidates.json` 当前只有 4 个 fixture cases，样本规模不足以评估公司世界模型资产质量。
2. 当前 eval 主要覆盖 memory extraction / retrieval / distillation 的工程正确性，尚未系统评估经营影响、LLM 经济性和世界模型完整性。
3. retrieval pack 当前仍以 `MemoryFact` 为主；`Commitment / Blocker / BriefingSnapshot / AdvancementSignal / MustPushItem` 尚未形成统一的 company memory utility benchmark。
4. approved distillation candidate 尚未进入 retrieval summary layer；promoted memory 仍未启动。

## 3. 评估对象定义

Helm 的公司记忆由以下资产组成：

| 资产类型 | 说明 | 当前 posture |
| --- | --- | --- |
| `Fact` | 可复核的事实、状态、关系、偏好、历史结论 | 可进入 `MemoryFact` |
| `Commitment` | 已承诺或需复核的下一步、交付、跟进动作 | recommendation != commitment |
| `Blocker` | 阻塞、风险、缺口、需要 owner 处理的问题 | review-first |
| `Decision` | 曾经作出的判断、选择、否决、优先级 | 需要证据与边界 |
| `Boundary` | 不可越过的权限、租户、承诺、外发、审批边界 | 目标事故数为 0 |
| `Preference` | 客户、候选人、团队、角色的偏好与协作习惯 | 不得写成确定承诺 |
| `Operating Gap` | 当前经营链路缺失、停滞或未闭环处 | Must Push 输入候选 |
| `Distillation Candidate` | 长期重复事实的 review-required 压缩候选 | 不覆盖 canonical fact |

公司世界模型不是单一表或向量库，而是这些对象之间的可复核关系图。

## 4. 六层评估框架

### L1：Capture Quality

评估系统是否从会议、邮箱、CRM、报表和 Ask Helm interaction 中抽出正确记忆。

核心指标：

| 指标 | 定义 | 初始目标 |
| --- | --- | --- |
| `fact_hit_rate` | golden expected facts 命中率 | >= 80% |
| `commitment_hit_rate` | expected commitments 命中率 | >= 80% |
| `blocker_hit_rate` | expected blockers 命中率 | >= 75% |
| `misattribution_rate` | 错绑对象、错绑 owner、错绑来源比例 | <= 5% |
| `unsupported_inference_rate` | 无证据推断被写成事实的比例 | 0 |
| `duplicate_write_rate` | 同一语义事实重复写入比例 | <= 10% |

### L2：World Model Health

评估公司对象关系图是否能表达真实经营状态。

核心指标：

| 指标 | 定义 | 初始目标 |
| --- | --- | --- |
| `object_coverage_rate` | 关键客户 / 机会 / 会议 / 资源是否有最近记忆 | >= 70% |
| `relationship_correctness_rate` | 人、公司、机会、会议、资源关系是否正确 | >= 90% |
| `freshness_rate` | 高价值对象是否有足够新鲜的记忆 | >= 75% |
| `contradiction_rate` | 未标记冲突的互相矛盾事实比例 | <= 5% |
| `boundary_coverage_rate` | 高风险对象是否带 boundary / prerequisite / dependency note | 100% |
| `traceability_rate` | 可追溯到 source / evidence / audit 的记忆比例 | >= 95% |

### L3：Retrieval Utility

评估在 Ask Helm、briefing、recommendation、Must Push 中，记忆是否被正确取用。

核心指标：

| 指标 | 定义 | 初始目标 |
| --- | --- | --- |
| `evidence_hit_at_5` | top 5 selected memories 中真正支撑判断的比例 | >= 70% |
| `irrelevant_context_rate` | selected memory 中无关内容比例 | <= 15% |
| `stale_suppression_precision` | 被 stale suppression 压下的记忆是否确实不应进入上下文 | >= 80% |
| `critical_omission_rate` | 关键证据被 omitted 的比例 | <= 10% |
| `retrieval_trace_completeness` | selected / omitted / fallback reason 是否完整 | 100% |

### L4：Decision / Advancement Impact

评估记忆是否真的改善经营推进。

核心指标：

| 指标 | 定义 | 初始目标 |
| --- | --- | --- |
| `ask_helm_answer_acceptance_lift` | 有记忆 vs 无记忆的答案采纳提升 | >= +20% |
| `must_push_acceptance_lift` | 有记忆 vs 无记忆的 Must Push 采纳提升 | >= +20% |
| `time_to_trust_delta` | 用户从看到建议到愿意点击 / 分派 / 复核的时间下降 | >= 20% |
| `blocked_issue_discovery_lift` | 记忆增强后提前发现阻塞的比例提升 | >= +15% |
| `follow_through_completion_lift` | 被确认推进项后续完成率提升 | >= +15% |

### L5：LLM Economics

评估记忆是否让 Helm 更经济地用出 LLM 能力。

核心指标：

| 指标 | 定义 | 初始目标 |
| --- | --- | --- |
| `context_compression_ratio` | raw source tokens / selected memory tokens | >= 5x |
| `cost_per_useful_judgement` | 每条被采纳 judgement 的 LLM + retrieval 成本 | 持续下降 |
| `small_model_success_rate` | 有记忆时小模型完成同类任务的通过率 | >= 70% |
| `retry_reduction_rate` | 有记忆后同类任务重试率下降 | >= 20% |
| `fallback_rate` | LLM 不可用或超预算 fallback 比例 | 不上升 |
| `latency_p95_delta` | retrieval + LLM p95 延迟变化 | 下降或持平 |

### L6：Governance Safety

评估记忆是否扩大风险。

硬指标：

| 指标 | 定义 | 目标 |
| --- | --- | --- |
| `cross_workspace_memory_leak_count` | 跨 workspace 记忆泄露 | 0 |
| `commitment_boundary_incident_count` | suggestion 被写成 commitment | 0 |
| `approval_boundary_incident_count` | explanation 被写成 approval | 0 |
| `external_send_boundary_incident_count` | draft 被写成 send / sent | 0 |
| `deletion_retention_violation_count` | 删除 / 过期后仍被引用 | 0 |
| `unreviewed_distillation_promotion_count` | 未复核 distillation 影响 promoted memory / ranking | 0 |

## 5. Benchmark 设计

### 5.1 Fixture Pack

新增 `Company Memory Benchmark Fixture Pack`，至少包含 50 条 redacted real business events。

最低覆盖：

| 来源 | 最低样本数 | 说明 |
| --- | ---: | --- |
| Meeting note / transcript | 12 | 会议结论、承诺、阻塞、偏好 |
| Email / inbox | 10 | 客户等待、催问、对齐、边界 |
| CRM / opportunity | 8 | 机会状态、停滞、金额、owner |
| Report / resource signal | 8 | 资源异常、经营指标、交付风险 |
| Ask Helm interaction | 8 | repeated intent、boundary hit、abandoned answer |
| Mixed multi-source case | 4 | 多源冲突、证据合并、Must Push 压缩 |

每条 fixture 必须包含：

```ts
interface CompanyMemoryBenchmarkCase {
  id: string;
  workspaceId: string;
  sourceEvents: Array<{
    sourceType: "meeting" | "email" | "crm" | "report" | "ask_helm";
    redactedPayloadRef: string;
    occurredAt: string;
  }>;
  expectedMemoryAssets: Array<{
    assetType: "fact" | "commitment" | "blocker" | "decision" | "boundary" | "preference" | "operating_gap";
    objectRef: { type: string; id: string };
    evidenceRefs: string[];
    reviewPosture: "confirmed" | "review_required" | "watch_only" | "reject";
  }>;
  expectedWorldModelAssertions: string[];
  expectedRetrievalAssertions: string[];
  expectedAdvancementOutcome?: {
    mustPushExpected: boolean;
    acceptedPrimaryAction?: string;
    boundaryRequired: boolean;
  };
}
```

### 5.2 Four-Arm Evaluation

每个 case 至少跑四种条件：

1. `no_memory`：只用当前页面 / query 数据。
2. `raw_context`：直接塞原始 source payload。
3. `current_retrieval_pack`：使用 Helm 当前 retrieval pack。
4. `distilled_memory`：使用 approved distillation candidate / summary layer（待实现后启用）。

比较维度：

| 维度 | 比较内容 |
| --- | --- |
| Quality | answer / judgement / Must Push 是否正确 |
| Evidence | 证据是否足够、是否可追溯 |
| Boundary | 是否误写承诺、审批、外发 |
| Cost | prompt tokens / completion tokens / model tier |
| Latency | retrieval + generation p50 / p95 |
| Adoption | 用户是否点击、确认、分派、复核 |

### 5.3 Human Review Protocol

每批 benchmark 至少需要 3 类 reviewer：

1. Product reviewer：判断经营语义是否正确。
2. Domain operator：判断是否真的有推进价值。
3. Security / governance reviewer：判断是否越权、越界、泄露或误承诺。

任何高风险 case 必须有 governance reviewer 通过，否则整批不得进入 Go。

## 6. Scorecard

建议每周输出一张 company memory scorecard：

| Score | 权重 | 说明 |
| --- | ---: | --- |
| Capture Quality | 20% | 是否正确写入经营记忆 |
| World Model Health | 20% | 是否形成正确对象关系图 |
| Retrieval Utility | 20% | 是否取到有用上下文 |
| Advancement Impact | 20% | 是否改善 Must Push / Ask Helm / briefing |
| LLM Economics | 10% | 是否更省 token / model / latency |
| Governance Safety | 10% | 是否保持 0 边界事故 |

Go / No-Go：

| 阶段 | Go 条件 | No-Go 条件 |
| --- | --- | --- |
| Phase 1 eval expansion | fixture >= 50，golden pass >= 75%，boundary incident = 0 | 样本不足或有边界事故 |
| Phase 2 retrieval calibration | evidence_hit_at_5 >= 70%，critical_omission <= 10% | stale / irrelevant context 导致判断错误 |
| Phase 3 economics calibration | useful judgement 成本下降或持平，质量不下降 | token 降了但 evidence / acceptance 下降 |
| Phase 4 world model review | contradiction <= 5%，traceability >= 95% | 对象关系混乱或 source 不可追溯 |
| Phase 5 product adoption | Must Push / Ask Helm acceptance lift >= 20% | 用户不采纳或无法解释信任来源 |

## 7. 当前缺口

1. 当前 memory golden cases 只有 3 个，不足以评估生产质量。
2. 当前 distillation fixture 只有 4 个，不足以评估长期公司世界模型压缩。
3. 当前 eval 不直接衡量 Must Push / Ask Helm / briefing 的 with-memory uplift。
4. 当前 diagnostics 已有 token / fallback / selected / omitted 读数，但尚未统一成 `cost_per_useful_judgement`。
5. 当前没有 object graph health evaluator，无法系统测量 contradiction、freshness、coverage 与 traceability。
6. 当前没有 redacted live benchmark cadence，无法把公司记忆质量变成每周可改进的经营资产指标。

## 8. 推荐实施顺序

### Phase CM-EVAL-0：Framework Freeze

交付：

1. 本文件。
2. `docs/README.md` 索引。
3. 一页 scorecard 草案。

不做：

1. 不改 schema。
2. 不改 runtime。
3. 不接 production query。

### Phase CM-EVAL-1：Fixture Pack

交付：

1. `evals/company-memory/fixtures/redacted-business-events.json`。
2. 至少 50 条 redacted cases。
3. 每条 case 带 expected memory assets、world model assertions、retrieval assertions、advancement outcome。

当前状态：

- 第一版 fixture pack 已完成，见 `evals/company-memory/fixtures/redacted-business-events.json`。
- 收口报告见 `docs/reviews/HELM_COMPANY_MEMORY_BENCHMARK_FIXTURE_PACK_REPORT_V1.md`。

验收：

1. 50 条 fixture 均不含真实 PII / secrets。
2. 至少 20 条来自真实业务脱敏样本。
3. 每条高风险样本有 boundary expected assertion。

### Phase CM-EVAL-2：Offline Evaluator

交付：

1. `scripts/company-memory-evals.ts`。
2. `lib/evals/company-memory-evals.ts`。
3. Four-arm evaluator：`no_memory / raw_context / current_retrieval_pack / distilled_memory`。

当前状态：

- 第一层 deterministic fixture validator 已完成，命令为 `npm run eval:company-memory`。
- Four-arm 输入合同与 deterministic comparison 已完成，命令为 `npm run eval:company-memory -- --mode=four-arm`。
- 当前验证 fixture readiness、来源分布、六层 scorecard 输入完整性、governance boundary coverage、redacted payload allowlist、四臂 token/evidence/boundary baseline 与第一层 economics baseline。
- `distilled_memory` arm 已纳入合同但保持 `enabled=false`，因为 approved distillation summary layer 尚未进入 retrieval summary 或 promoted memory。
- 收口报告见 `docs/reviews/HELM_COMPANY_MEMORY_DETERMINISTIC_EVAL_REPORT_V1.md` 与 `docs/reviews/HELM_COMPANY_MEMORY_FOUR_ARM_ECONOMICS_BASELINE_REPORT_V1.md`。

验收：

1. 输出 six-layer scorecard。
2. 输出 failed case ids 与 failure mode。
3. `npm run eval:company-memory` 可复现。
4. `--mode=four-arm` 可复现并检查 payload allowlist 与当前 retrieval pack baseline。

### Phase CM-EVAL-3：LLM Economics Baseline

交付：

1. `cost_per_useful_judgement` 计算。
2. `context_compression_ratio` 计算。
3. `small_model_success_rate` 对照。

当前状态：

- 第一层 deterministic economics baseline 已完成，命令为 `npm run eval:company-memory -- --mode=economics`。
- 当前基线：`currentRetrievalPackCompressionRatio = 5.72`，`rawContextCostPerUsefulJudgement = 0.00126`，`currentRetrievalPackCostPerUsefulJudgement = 0.00022`，`smallModelSuccessRate = 100`。
- 该结果基于 redacted payload pack 的 token estimates 与 expected-vs-actual readiness，不是生产 token bill、真实 LLM 输出质量或用户采纳证明。
- 收口报告见 `docs/reviews/HELM_COMPANY_MEMORY_FOUR_ARM_ECONOMICS_BASELINE_REPORT_V1.md`。

验收：

1. 不只报告 token 总量，必须绑定 useful judgement / accepted Must Push。
2. token 降低不能以 evidence coverage 下降为代价。
3. economics pass 不能绕过 boundary coverage 或 current retrieval pack quality pass。

### Phase CM-EVAL-4：World Model Health Review

交付：

1. object graph health evaluator。
2. coverage / freshness / contradiction / traceability score。
3. 每周 review report 模板。

当前状态：

- 第一层 deterministic object graph health evaluator 已完成，命令为 `npm run eval:company-memory -- --mode=world-model`。
- 当前基线：20 个 target objects、35 个 observed objects、coverage / freshness / contradiction / traceability / boundary coverage 均为 `100%`。
- 当前已输出 top 10 memory gaps，作为后续每周 memory improvement queue。
- 每周 scorecard 模板见 `docs/reviews/HELM_COMPANY_MEMORY_WEEKLY_SCORECARD_TEMPLATE_V1.md`。
- 收口报告见 `docs/reviews/HELM_COMPANY_MEMORY_WORLD_MODEL_HEALTH_REPORT_V1.md`。

验收：

1. 可以列出最需要修复的 10 个对象记忆缺口。
2. 可以解释哪些记忆需要删除、降权、合并或复核。

### Phase CM-EVAL-5：Product Adoption Calibration

交付：

1. Ask Helm with-memory uplift report。
2. Must Push with-memory uplift report。
3. briefing with-memory uplift report。

当前状态：

- 第一层 deterministic product adoption calibration 已完成，命令为 `npm run eval:company-memory -- --mode=adoption`。
- 当前覆盖 Ask Helm / Must Push / briefing 三个承接面，12 条 adoption proxy cases。
- 当前基线：overall acceptance lift `58.1%`，time-to-trust reduction `41.5%`，review coverage `100%`，boundary incident `0`。
- 收口报告见 `docs/reviews/HELM_COMPANY_MEMORY_PRODUCT_ADOPTION_CALIBRATION_REPORT_V1.md`。
- 第一批需求最终收口见 `docs/reviews/HELM_COMPANY_MEMORY_EVALUATION_FINAL_CLOSEOUT_REPORT_V1.md`。

验收：

1. acceptance lift >= 20%。
2. boundary incident = 0。
3. time-to-trust 下降或持平。

## 9. 验证命令

当前已存在：

```bash
npm run eval:memory
npm run eval:recommendation
```

建议新增：

```bash
npm run eval:company-memory
npm run eval:company-memory -- --mode=four-arm
npm run eval:company-memory -- --mode=economics
npm run eval:company-memory -- --mode=world-model
```

文档阶段验证：

```bash
git diff --check
npm run check:boundaries
```

## 10. 非目标

本框架不做：

1. 第二套 memory stack。
2. 全量向量知识库。
3. ontology platform。
4. LLM final ranking owner。
5. auto promotion。
6. auto-send / auto-approve / auto-write authority。
7. 跨 workspace 聚合。
8. 以 token 降低为唯一目标的压缩。

## 11. 最重要的下一步

当前 `CM-EVAL-1 / 2 / 3 / 4 / 5` 已形成 fixture pack、deterministic readiness evaluator、redacted payload allowlist、four-arm baseline、economics proxy、object graph health baseline 与 product adoption calibration proxy。

立即下一步不是继续写 UI 或扩大 memory runtime，而是启动每周 scorecard cadence、reviewer scoring protocol 和 production redacted payload cadence。

建议目标：

1. 每周运行五个 company-memory eval modes。
2. 把 top memory gaps 转成具体修复任务。
3. 建立 product / operator / security-governance 三方 reviewer scoring。
4. 建立 production redacted payload cadence 与 privacy posture。
5. 只有在 reviewer scoring 与 production redacted payload cadence 成立后，才讨论 runtime adoption。

只有这样，公司记忆才会从“看起来很重要的资产”变成“可以被评估、改进、复利增长的经营资产”。
