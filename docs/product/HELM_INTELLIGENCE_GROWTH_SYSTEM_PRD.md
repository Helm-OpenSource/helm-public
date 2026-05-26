---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-07-31
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 智能成长系统 PRD

> **状态**：P0 offline gate 已落地（Slice A–D 已完成）；runtime / self-learning 继续 No-Go
>
> **定性**：review-first，candidate-only，不做自变更生产系统
>
> **本文档不授权**：DB schema 变更、API 实现、UI 改造、生产 prompt 写入、规则自动更新、记忆自动晋升、模型训练或任何自执行行为

---

## 一、背景与目的

Helm 当前已形成可验证的离线 eval 工程底座：

- Object / Signal validity gate（四档筛选）
- Audience-aware signal projection（人 / Worker / Reviewer / 学习候选四通道）
- Business Advancement signal pipeline（20 条 alias-only 离线主链）
- External Agent intake（candidate-only）
- LLM context quality audit 与 self-improvement loop eval

这些能力共同描绘了一个更大的目标：让 Helm 的判断质量随着真实使用积累而结构性提升——但始终保持人在环路（human-in-the-loop），始终 review-first，始终以 candidate 姿态等待批准，不做自变更生产系统。

本 PRD 将上述积累整理为一个统一的**智能成长系统（Intelligence Growth System，下称 IGS）**，定义十条智能维度、各维度 P0–P3 路线图、硬边界、成功度量与 Go/No-Go 条件。

**本 PRD 整合自两份本地草稿：**

- `HELM_INTELLIGENCE_GROWTH_SYSTEM_REQUIREMENTS_DRAFT.md`
- `TENANT_USAGE_LEARNING_LOOP_REQUIREMENTS_DRAFT.md`

---

## 二、核心定义

| 术语 | 定义 |
|------|------|
| 智能成长 | 系统判断质量随使用经验可度量地提升，前提是每一步都经过 review-first 批准 |
| Candidate | 尚未进入生产主链的候选项，必须经人工批准才能晋升 |
| Offline gate | 只在本地 / CI 固定 fixture 上运行的质量门禁，不读写生产数据库 |
| Review-first | 任何改变生产行为的操作必须先经过人工复核，不能自动执行 |
| Learning candidate | 从真实使用中提取的待复核改进提案，不等于已批准的生产变更 |

---

## 三、十条智能维度

### 3.1 Context Intelligence（上下文智能）

**目标**：确保每次 LLM 调用的上下文质量可审计、可改进。

当前状态：
- `lib/llm/context-audit.ts` + `npm run eval:llm-context` 已落地
- 只写压缩 audit summary，不保存 raw prompt
- 结构化 trace schema 待 Data Protection review

改进候选方向（P0 离线）：
- context 覆盖率 / 冗余度 / 相关性三维离线度量
- 上下文注入前的 token 预算门禁
- 按 workspace signal density 自适应 context 裁剪候选

**硬边界**：
- 不做 DB schema
- 不做 API
- 不做 UI
- 不改生产 prompt
- 离线 fixture 验证结果只作为 learning candidate，不自动晋升

---

### 3.2 Object/Signal Intelligence（经营对象 / 信号智能）

**目标**：持续提升经营对象有效性 gate 的覆盖率与精度。

当前状态：
- `HELM_OBJECT_SIGNAL_VALIDITY_FRAMEWORK.md` + `eval:object-signal-validity` / `eval:object-signal-remediation` 已落地
- 四档 gate（must_push_ready / review_required / watch_only / rejected）可机器验证
- 当前只证明 offline fixture gate，不代表 production object quality 或 runtime revocation

改进候选方向（P0 离线）：
- 新增对象类型（Goal / Belief / Commitment / OperatingGap）的 validity case 覆盖
- 跨周期信号时效衰减的 offline case 扩充
- remediation 候选的 learning loop 反馈路径设计（candidate only）

**硬边界**：review-first；不做 runtime revocation 自动化；不做 schema 扩张；不做 API；不做 UI

---

### 3.3 Company Memory Intelligence（公司记忆智能）

**目标**：让公司记忆的写入质量、去重质量、晋升路径可度量并可改进。

当前状态：
- Memory 写入链路是 review-first / read-only operator substrate
- 不自动 retry、不自动改写 canonical facts、不扩 recommendation / commitment authority
- bounded retry executor 只接受人工确认，只写一个 reconstructed `MemoryFact`

改进候选方向（P0 离线）：
- 记忆候选质量离线评分（fact density / relevance / staleness）
- 记忆晋升前的自动 gate 候选（仅 candidate，不自动写入）
- 记忆去重 fingerprint 一致性验证（扩充 fixture）

**硬边界**：review-first；不做自动 canonical fact 写入；不做 schema 扩张；不做 API；不做 UI；不改生产 prompt

---

### 3.4 Routing Intelligence（路由智能）

**目标**：让 Must Push / review / watch 三通道的路由决策质量可度量并可改进。

当前状态：
- Business Advancement signal pipeline（20 条 alias-only）已落地离线验证
- 路由逻辑为 deterministic，禁止 LLM 做最终排序
- 当前只授权 docs / fixtures / offline evaluator

改进候选方向（P0 离线）：
- 路由准确率离线 benchmark（False Positive / False Negative 度量）
- 错误路由的 failure taxonomy（路由降级候选）
- 多信号叠加时的路由冲突 offline case 扩充

**硬边界**：路由逻辑保持 deterministic；不做 LLM 最终排序；不做 DB schema；不做 API；不做 UI；不改生产 prompt

---

### 3.5 Action/Outcome Intelligence（行动 / 结果智能）

**目标**：让 Helm 建议的行动与真实业务结果之间的关系可度量并可改进。

当前状态：
- 当前只有 Must Push / ReviewRequiredAction / WorkerInstruction / LearningCandidate 四类输出分类
- 行动结果的反馈链路尚未定义
- outcome 学习候选路径属于 P1+ 范围

改进候选方向（P0 离线）：
- 行动结果标注 schema 设计（candidate-only）
- offline fixture：已批准行动 → 实际执行 → 结果反馈的三段关系案例
- 结果驱动的 learning candidate 生成路径设计

**硬边界**：不做自动结果判断；不做 DB schema；不做 API；不做 UI；不改生产 prompt；review-first

---

### 3.6 Worker/Skill Intelligence（Worker / Skill 智能）

**目标**：让 Worker 能力质量和 Skill 调用质量可度量并可改进。

当前状态：
- `HELM_COMMERCIAL_PROMOTION_PACK_WORKER_SKILL_PLAN.md` + `eval:commercial-promotion` 已落地
- `worker-skill-resource-binding` skill 存在
- SkillSuggestionCandidate 自动晋升明确列为刻意未做

改进候选方向（P0 离线）：
- Worker artifact 质量离线评分（review-first，只到 candidate）
- Skill 调用失败的 failure taxonomy 扩充
- Worker 与 Skill 能力边界的 offline gate 覆盖

**硬边界**：SkillSuggestionCandidate 不自动晋升；不做 schema 扩张；不做 API；不做 UI；不改生产 prompt；review-first

---

### 3.7 Prompt/Policy Intelligence（Prompt / 策略智能）

**目标**：让 prompt 设计质量和策略规则质量可度量并可改进，但始终 review-first，不做自变更。

当前状态：
- prompt 质量目前隐含在 context audit 中
- 策略规则（如路由规则、boundary 规则）当前为人工维护

改进候选方向（P0 离线）：
- prompt 模板质量的离线评分框架（candidate-only）
- 策略规则改进候选的 offline fixture（learning candidate 姿态）
- prompt 变更前的 regression gate 设计

**硬边界**：不改生产 prompt（包括不做自动 prompt 更新）；不做策略规则自动更新；不做 DB schema；不做 API；不做 UI；review-first

---

### 3.8 Eval/Replay Intelligence（评估 / 回放智能）

**目标**：让 eval 框架自身的覆盖率、可重放性和 failure 检测能力可度量并可改进。

当前状态：
- `npm run eval:*` 系列已覆盖多条主链
- Phase 3V local calibration rehearsal 工具链可跑
- 远端 DB 不可达时可用本地隔离库 rehearsal

改进候选方向（P0 离线）：
- eval coverage 度量（当前 fixture 覆盖 vs 已知生产路径）
- failure case 回放的 CLI 增强
- eval report 格式标准化（machine-readable JSON + human summary）

**硬边界**：不做 production data 回放；不做 DB schema；不做 API；不做 UI；不改生产 prompt；review-first

---

### 3.9 Tenant Personalization Intelligence（租户个性化智能）

**目标**：让不同租户的 Helm 判断质量可按租户使用模式度量并可改进，保持 workspace-first 隔离。

当前状态：
- 租户私有 fixture-backed readout 已隔离在受控 private extension root
- 租户私有 boundary check 已进 `check:boundaries`
- 租户个性化学习候选路径属于 P1+ 范围

改进候选方向（P0 离线）：
- 租户 usage pattern 的 offline fixture schema 设计（candidate-only）
- 租户特化 learning candidate 的隔离边界设计
- 跨租户数据隔离的 boundary gate 扩充

**硬边界**：workspace-first 隔离保持；不做跨 workspace 自动聚合；不做 DB schema；不做 API；不做 UI；不改生产 prompt；review-first

---

### 3.10 Cost/Model/Tool Intelligence（成本 / 模型 / 工具智能）

**目标**：让 LLM 调用成本、模型选择质量和工具调用质量可度量并可改进。

当前状态：
- 当前 LLM 调用无系统性成本追踪
- 模型选择目前为人工配置
- 工具调用边界由 boundary check 覆盖

改进候选方向（P0 离线）：
- token 使用离线度量（per workspace / per call type）
- 模型降级候选的 offline evaluation（candidate-only）
- 工具调用 boundary hit 的 failure taxonomy

**硬边界**：不做自动模型切换；不做 DB schema；不做 API；不做 UI；不改生产 prompt；review-first

---

## 四、P0–P3 路线图

### P0：离线质量门禁（当前可启动）

目标：把十条智能维度的 offline gate 全部建立，形成可机器验证的质量底座。

| 交付物 | 对应维度 |
|--------|----------|
| 类型契约（TypeScript 纯类型） | 全部 10 条 |
| failure taxonomy fixture | 全部 10 条 |
| offline evaluator CLI | 全部 10 条（或首批覆盖 3.1–3.4） |
| docs/STATUS.md 状态行 + self-check 集成 | 全部 10 条 |

**不做**：不做 DB schema，不做 API，不做 UI，不改生产 prompt，不做 runtime 接入，不做自动规则更新，不做记忆自动晋升，不做模型训练。

---

### P1：Learning Candidate 管理（review-first 基础设施）

目标：建立 learning candidate 的收集、存储和人工复核路径（始终 review-first）。

| 交付物 | 说明 |
|--------|------|
| Learning candidate schema（DB） | 需 Data Protection review |
| 人工复核界面（UI） | review-first；不做自动晋升 |
| 晋升到 production 的 gate 设计 | 需 founder approval + required reviewer |

**前置条件**：P0 全部完成 + 真实流量 + Data Protection review + founder approval

---

### P2：Candidate 晋升（受控 + 人工批准）

目标：建立 learning candidate 到 production 的受控晋升路径。

| 交付物 | 说明 |
|--------|------|
| 晋升 gate（代码）| 需 required reviewer approval |
| Shadow-first 验证 | 先 shadow，不直接生效 |
| A/B 对比评估 | offline 先验证，再受控上线 |

**前置条件**：P1 完成 + required reviewer 真实人选 + redacted live calibration evidence

---

### P3：自动化成长（高度受控 + 人在环路）

目标：在 P2 基础上，建立低风险类型的半自动成长路径，仍保持人在环路。

**注意**：P3 仍不等于完全自动化。即使 P3 完成，高风险类型（Prompt 变更、规则变更、记忆晋升）仍需 review-first。

**前置条件**：P2 完成 + 生产验证 + 独立安全评审

---

## 五、硬边界（永久保持）

以下边界无论路线图推进到哪个阶段，都必须保持：

1. **review-first**：任何改变生产行为的操作必须先经过人工复核
2. **不改生产 prompt**：Prompt 变更不走自动路径，始终需要人工审批
3. **不自动写入 canonical facts**：记忆晋升不走自动路径
4. **不做自执行**：Helm 不自动替人决策、不自动外发
5. **recommendation ≠ commitment**：建议不等于承诺
6. **workspace-first 隔离**：跨 workspace 数据不自动聚合
7. **LLM 不做最终排序**：路由逻辑保持 deterministic
8. **不做 SkillSuggestion 自动晋升**：Skill 建议必须经人工批准

---

## 六、成功度量

### P0 完成标准

| 指标 | 目标 |
|------|------|
| 覆盖智能维度数 | 10 条（或首批 3 条 + roadmap） |
| offline fixture 覆盖 | 每条维度 ≥ 5 个正向 + ≥ 3 个边界 case |
| eval CLI 可运行 | `npm run eval:intelligence-growth` 或分项命令全绿 |
| failure taxonomy 文档 | 每条维度有 failure 分类表 |
| docs/STATUS.md 状态行 | 已录入 |
| self-check 集成 | 已写入 `scripts/helm-self-check.ts` |

### P0+ Tenant Signal Projection（已落地，仍 offline-only）

IGS 的改进项本身也是 Helm 内置自身业务发展租户的经营对象。为了避免“系统改进需求”停留在报告里，本轮新增一条离线投影：

```text
IntelligenceGrowth improvement item
  -> helm-business-development tenant report signal
  -> Business Advancement signal pipeline
  -> MustPushItem / ReviewRequiredAction / WorkerInstruction / LearningCandidate candidate
```

当前实现：

- `evals/intelligence-growth-tenant-signals/tenant-signal-cases.json`
- `lib/evals/intelligence-growth-tenant-signal-evals.ts`
- `scripts/intelligence-growth-tenant-signal-evals.ts`
- `npm run eval:intelligence-growth-tenant-signals`

当前通过结果：10 条 IGS 维度全部覆盖，4 条可成为 Helm 自身业务发展租户 Must Push candidate，6 条进入 ReviewRequiredAction，10 条全部生成 LearningCandidate；invalid Must Push、raw payload echo、Worker forbidden action leak、auto execution、official write、canonical memory write 均为 0。

**边界**：这只把 IGS 改进项作为 Helm 内置自身业务发展租户 `helm-business-development` 的 offline business signal candidate，不授权 runtime/self-learning、DB schema、API、UI、生产 prompt 变更、规则自动更新、canonical memory 自动写入或 Skill 自动晋升。

这里的“租户”不是客户租户，也不是任意 tenant-private app。客户租户无法自行升级 Helm 系统；客户租户和租户私有应用产生的信号只能先服务自己的经营推进。若未来需要把客户侧模式沉淀为 Helm 系统级改进，必须先经过脱敏授权、Data Protection review、founder approval 和人工评审，再以 Helm 自身业务发展租户的改进项重新入队。

### P0++ Improvement Review Packet（已落地，仍 offline-only）

Tenant Signal Projection 之后，IGS 还需要一层可复核承接包，防止 “经营信号已经发现” 被误解成 “Helm 可以自动升级”。本轮新增：

```text
helm-business-development tenant signal
  -> IGS review packet
  -> founder approval gate + required reviewers
  -> candidate-only improvement queue
```

当前实现：

- `lib/evals/intelligence-growth-review-packet-evals.ts`
- `scripts/intelligence-growth-review-packet-evals.ts`
- `npm run eval:intelligence-growth-review-packets`

当前通过结果：10 条 review packet 全部生成，4 条为 ready_for_founder_review，6 条为 needs_required_review；founder approval coverage、required reviewer coverage、evidence coverage、packet completeness 均为 100%；scope violation、promotion authority leak、runtime authority leak 均为 0。

**边界**：review packet 仍是 offline candidate，不代表 founder 已批准，不代表 reviewer 已批准，不代表可以改生产 prompt / policy / schema / canonical memory / Skill，不授权 runtime self-learning 或自动执行。

### P0+++ IGS Weekly Scorecard（已落地，仍 offline-only）

在 review packet gate 之上，新增一条周维度聚合视图：把当周所有 review packet 汇总成 founder / operator 可扫描的 weekly scorecard。

实施范围（candidate-only，不授权任何写入或执行）：

- `lib/evals/intelligence-growth-weekly-scorecard-evals.ts`
- `scripts/intelligence-growth-weekly-scorecard-evals.ts`
- `npm run eval:intelligence-growth-weekly-scorecard`

当前通过结果（2026-W18，`helm-business-development` 租户）：

| 指标 | 当前结果 |
|---|---:|
| Total packets | 10 |
| ready_for_founder_review | 4 |
| needs_required_review | 6 |
| blocked | 0 |
| Coverage | 100% |
| Authority leaks | 0 |

**边界**：weekly scorecard 是 candidate-only、founder / operator scorecard、review-first 视图，不授权 runtime、self-learning、DB schema、API、UI、prompt / schema / policy 更新、canonical memory 写入、Skill 晋升、official write 或自动执行。

### P0++++ IGS Decision Outcome Ledger（已落地，仍 offline-only）

在 weekly scorecard 之上，新增离线决策结果台账（Decision Outcome Ledger）：把 founder / operator 对 review packet 的实际决策、执行结果与下一学习候选收录为可机器验证的 offline fixture，闭合 review packet → weekly scorecard → 决策结果 完整反馈环。

```text
weekly scorecard
  -> founder / operator decision
  -> decision outcome ledger (offline fixture)
  -> nextLearningCandidateCount
  -> candidate-only improvement re-queue
```

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json`
- `lib/evals/intelligence-growth-decision-outcome-evals.ts`
- `scripts/intelligence-growth-decision-outcome-evals.ts`
- `npm run eval:intelligence-growth-decision-outcomes`

当前通过结果（`helm-business-development` 租户）：

| 指标 | 当前结果 |
|---|---:|
| Decision records | 10 |
| founderDecisionQueue | 10 |
| decisionCoveragePercent | 100% |
| evidenceCoveragePercent | 100% |
| ownerCoveragePercent | 100% |
| reviewerCoveragePercent | 100% |
| boundaryNoteCoveragePercent | 100% |
| nextLearningCandidateCount | 10 |
| Unauthorized production/prompt/write incidents | 0 |
| Raw customer data incidents | 0 |

**边界**：decision outcome ledger 是 candidate-only、offline-only 台账，不授权 runtime、self-learning、DB schema、API、UI、prompt / schema / policy 更新、canonical memory 写入、Skill 晋升、official write 或自动执行；只适用于 Helm 内置自身业务发展租户 `helm-business-development`；客户租户不能通过自身决策结果升级 Helm 系统。

### P0+++++ IGS Learning Requeue Gate（已落地，仍 offline-only）

在 decision outcome ledger 之上，新增下一轮学习候选重新入队 gate（Learning Requeue Gate）：把 decision outcome ledger 确认的下一轮学习候选，按原始 review packet source 映射回可再次进入 offline eval 的 candidate 队列，形成可机器验证的闭环终止条件。

```text
decision outcome ledger
  -> nextLearningCandidateCount（已确认候选）
  -> learning requeue gate（offline fixture 映射）
  -> next-cycle candidate queue（candidate-only，review-first）
```

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户，helm-business-development only）：

- `evals/intelligence-growth-learning-requeue/learning-requeue-cases.json`
- `lib/evals/intelligence-growth-learning-requeue-evals.ts`
- `scripts/intelligence-growth-learning-requeue-evals.ts`
- `npm run eval:intelligence-growth-learning-requeue`

当前通过结果（`helm-business-development` 租户）：

| 指标 | 当前结果 |
|---|---:|
| 候选记录数（candidates） | 10 |
| expectedCandidateCount | 10 |
| candidateCoveragePercent | 100% |
| blockedDecisionCandidateCount | 3 |
| unexpectedCandidateCount | 0 |
| sourcePacketMismatchCount | 0 |
| invalidStatusCount | 0 |
| Unauthorized production/prompt/write incidents | 0 |
| Raw customer data incidents | 0 |
| Evidence / owner / boundary coverage | 100% |

**边界**：learning requeue gate 是 candidate-only、offline-only 闭环校验，不授权 runtime、self-learning、DB schema、API、UI、prompt / schema / policy 更新、canonical memory 写入、Skill 晋升、official write 或自动执行；只适用于 Helm 内置自身业务发展租户 `helm-business-development`；不做 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；客户租户不能通过自身决策结果升级 Helm 系统。

### P0++++++ IGS Chain Integrity Gate（已落地，仍 offline-only）

在 learning requeue 之上，新增 aggregate chain integrity gate：不新增业务逻辑，只原生运行并串联既有五段 eval，验证 IGS 从“自身业务发展租户经营信号”到“下一周期学习候选重入”的闭环没有断链。

```text
tenant signal
  -> review packet
  -> weekly scorecard
  -> decision outcome ledger
  -> learning requeue
  -> chain integrity gate
```

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户，native execution）：

- `lib/evals/intelligence-growth-chain-integrity-evals.ts`
- `lib/evals/intelligence-growth-chain-integrity-evals.test.ts`
- `scripts/intelligence-growth-chain-integrity-evals.ts`
- `npm run eval:intelligence-growth-chain`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| executionMode | native |
| tenantSignals / reviewPackets / weeklyPackets / decisionOutcomes / learningRequeueCandidates | 10 / 10 / 10 / 10 / 10 |
| continuityPass | true |
| totalUnauthorizedIncidentCount | 0 |
| totalRawDataIncidentCount | 0 |
| totalScopeMismatchCount | 0 |
| minimumCoveragePercent | 100% |

**边界**：chain integrity gate 是 aggregate offline gate，不授权 runtime、self-learning、DB schema、API、UI、prompt / schema / policy 更新、canonical memory 写入、Skill 晋升、official write 或自动执行。默认 CLI 必须 native 运行五段链路；summary injection 仅允许测试用例显式打开 `allowInjectedSummariesForTesting`，避免“假绿”替代真实 eval。

### P0+++++++ IGS Cycle Advance Gate（已落地，仍 offline-only）

在 chain integrity 之上，新增 Cycle Advance Gate：把 W18 learning requeue 候选物化为 W19 next-cycle intake，并验证跨周期 handoff 没有丢来源、错窗口、错 scope、错状态或携带执行权限。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `lib/evals/intelligence-growth-cycle-advance-evals.ts`
- `lib/evals/intelligence-growth-cycle-advance-evals.test.ts`
- `scripts/intelligence-growth-cycle-advance-evals.ts`
- `npm run eval:intelligence-growth-cycle-advance`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| previousWindowKey / cycleWindowKey | 2026-W18 / 2026-W19 |
| totalIntakeCandidates / expectedIntakeCandidateCount | 10 / 10 |
| intakeCoveragePercent | 100% |
| sourceCandidateMismatchCount / sourcePacketMismatchCount / statusMismatchCount | 0 / 0 / 0 |
| scopeMismatchCount / windowMismatchCount | 0 / 0 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |
| Evidence / owner / boundary coverage | 100% |

**边界**：cycle advance gate 只证明 offline requeue output 可以安全进入下一周期 intake，不代表 W19 production query、runtime self-learning、自动规则更新、canonical memory 写入或 Helm core 自变更已获授权。

### P0++++++++ IGS Fixture Lint Gate（已落地，仍 offline-only）

在 cycle advance 之上，新增 Fixture Lint Gate：不新增业务链路，只对 IGS fixture corpus 做元验证，防止 fixture id 重复、维度错配、跨文件孤儿引用、scope/window 漂移、未收口的越权字段或 raw customer data 让上游 gate 产生“假绿”。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户 + IGS 核心维度 fixture）：

- `lib/evals/intelligence-growth-fixture-lint-evals.ts`
- `lib/evals/intelligence-growth-fixture-lint-evals.test.ts`
- `scripts/intelligence-growth-fixture-lint-evals.ts`
- `npm run eval:intelligence-growth-fixture-lint`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| coreFixtureCaseCount / expectedCoreFixtureCaseCount | 80 / 80 |
| coreDimensionCount | 10 |
| tenantSignalCaseCount / decisionOutcomeRecordCount / learningRequeueCandidateCount | 10 / 10 / 10 |
| duplicateIdCount / missingIdCount / invalidDimensionCount / invalidDecisionCount | 0 / 0 / 0 / 0 |
| orphanReviewPacketReferenceCount / orphanDecisionReferenceCount / orphanRequeueReferenceCount / missingRequeueCandidateCount | 0 / 0 / 0 / 0 |
| scopeMismatchCount / windowMismatchCount | 0 / 0 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |

**边界**：fixture lint gate 只验证 checked-in offline fixture corpus 的一致性和引用完整性，不修复 fixture，不生成新样本，不授权 runtime/self-learning、生产数据读取、DB/API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。核心负样本允许携带坏输入，但必须被标注为 rejected negative boundary；tenant signal 的 unsafeActionRequests 只允许作为 review-first containment 输入存在。

### P0+++++++++ IGS Dimension Saturation Gate（已落地，仍 offline-only）

在 fixture lint 之上，新增 Dimension Saturation Gate：复用 W19 next-cycle intake，验证下一周期学习候选覆盖全部 10 个智能维度，并且当前 fixture corpus 中每个维度只出现一次，防止 Helm 自成长只集中在容易维度或重复维度。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `lib/evals/intelligence-growth-dimension-saturation-evals.ts`
- `lib/evals/intelligence-growth-dimension-saturation-evals.test.ts`
- `scripts/intelligence-growth-dimension-saturation-evals.ts`
- `npm run eval:intelligence-growth-dimension-saturation`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| totalIntakeCandidates | 10 |
| expectedDimensionCount / coveredDimensionCount | 10 / 10 |
| dimensionCoveragePercent | 100% |
| missingDimensions | 0 |
| duplicateDimensionCount | 0 |
| maxDimensionCandidateCount | 1 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |

**边界**：dimension saturation gate 只证明 checked-in W19 intake fixture 覆盖了十个 IGS 维度，不做优先级调度、不生成新候选、不授权 runtime/self-learning、生产数据读取、DB/API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。

### P0++++++++++ IGS Remediation Roundtrip Gate（已落地，仍 offline-only）

在 dimension saturation 之上，新增 Remediation Roundtrip Gate：验证 founder / operator 决策结果进入 learning requeue 和 next-cycle intake 时，remediation 状态不被错误升级、证据链不丢失、owner 与 boundary note 不漂移，尤其阻止 `blocked` / `stop` 决策被下一轮错误复活为 active work。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `lib/evals/intelligence-growth-remediation-roundtrip-evals.ts`
- `lib/evals/intelligence-growth-remediation-roundtrip-evals.test.ts`
- `scripts/intelligence-growth-remediation-roundtrip-evals.ts`
- `npm run eval:intelligence-growth-remediation-roundtrip`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| totalDecisionRecords | 10 |
| continue / revise / blocked / stop | 4 / 3 / 3 / 0 |
| readyForFounderReview / needsRequiredReview / reviewRequired / archived | 4 / 3 / 3 / 0 |
| statusRoundtripMismatchCount | 0 |
| blockedResurrectionCount / stoppedResurrectionCount | 0 / 0 |
| evidenceContinuityMismatchCount / ownerContinuityMismatchCount / missingBoundaryNoteCount | 0 / 0 / 0 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |

**边界**：remediation roundtrip gate 只验证 checked-in offline fixture 的决策反馈不会在下一轮候选中错误升级，不执行撤销 / 降级 / 隔离动作，不授权 runtime/self-learning、生产数据读取、DB/API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。当前 checked-in fixture 暂无真实 `stop` 记录，`stop -> archived` 由单元测试通过 fixture mutation 覆盖。

### P0+++++++++++ IGS Cost / Model / Tool Budget Gate（已落地，仍 offline-only）

在 remediation roundtrip 之上，新增 Cost / Model / Tool Budget Gate：每个 W19 next-cycle intake 候选必须带离线预算 envelope，并用 checked-in observed usage fixture 验证模型调用次数、input/output token、模型层级、工具 allowlist、wallclock 和 replay 次数没有越界。这个 gate 解决的是 IGS 自成长的经济性和工具权限问题：Helm 可以学习，但不能在没有预算和 allowlist 的情况下越学越贵、越用越宽。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-budget/budget-gate-cases.json`
- `lib/evals/intelligence-growth-budget-gate-evals.ts`
- `lib/evals/intelligence-growth-budget-gate-evals.test.ts`
- `scripts/intelligence-growth-budget-gate-evals.ts`
- `npm run eval:intelligence-growth-budget-gate`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| totalBudgetRecords / expectedCandidateCount | 10 / 10 |
| budgetCoveragePercent | 100% |
| missingBudgetEnvelopeCount / unexpectedBudgetEnvelopeCount / duplicateBudgetRecordCount | 0 / 0 / 0 |
| overBudgetCandidateCount / modelTierEscalationCount / toolOutsideAllowlistCount | 0 / 0 / 0 |
| placeholderJustificationCount / malformedBudgetEnvelopeCount | 0 / 0 |
| aggregateInputTokensObserved / aggregateInputTokenMax | 9430 / 13400 |
| aggregateOutputTokensObserved / aggregateOutputTokenMax | 2770 / 4950 |
| aggregateToolCallsObserved / aggregateToolCallMax | 7 / 7 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |

**边界**：budget gate 只读取 checked-in budget fixture 和 W19 intake fixture，不调用 LLM、不调用工具、不读取 DB、不产生预算自动调优、不修改模型选择、不授权 runtime/self-learning、生产数据读取、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。预算 envelope 使用 Helm 当前 `model-alias-standard` / `model-alias-premium` / `none` 抽象，不绑定外部模型供应商枚举。

### P0++++++++++++ IGS Determinism Gate（已落地，仍 offline-only）

在 budget gate 之上，新增 Determinism Gate：对 core `runEval()` 和 18 个 IGS 派生 gate 连跑 3 次，把结果做 canonical JSON 对比；唯一允许的 volatile 字段是 core eval 报告里的 `runAt`。这条 gate 保护所有离线质量门禁：如果未来引入 `Date.now()`、随机值、无序集合输出或异步竞态，determinism gate 会直接失败。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `lib/evals/intelligence-growth-determinism-evals.ts`
- `lib/evals/intelligence-growth-determinism-evals.test.ts`
- `scripts/intelligence-growth-determinism-evals.ts`
- `npm run eval:intelligence-growth-determinism`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| repeatCount | 3 |
| producerCount | 15 |
| stableProducerCount / unstableProducerCount | 15 / 0 |
| volatileFieldAllowlist | `runAt` |

**边界**：determinism gate 只在同进程内重复运行 checked-in offline evaluator，不调用 LLM、不调用工具、不读取 DB、不产生 fixture 或 baseline 自动更新，不授权 runtime/self-learning、生产数据读取、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。`runAt` 被显式 allowlist 是为了保留 CLI 报告时间戳，同时防止其它 volatile 字段进入离线 gate。

### P0+++++++++++++ IGS Boundary Static No-Go Gate（已落地，仍 offline-only）

在 determinism gate 之上，新增 Boundary Static No-Go Gate：机械扫描 IGS core / eval / scripts / fixtures 文件，阻止 DB/Prisma、API route、Next server runtime、production query、LLM provider env 与 network call 悄悄进入 offline gate。这条 gate 不评价业务质量，只守住“IGS P0 只能是 offline fixture-backed candidate chain”的硬边界。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `lib/evals/intelligence-growth-boundary-static-evals.ts`
- `lib/evals/intelligence-growth-boundary-static-evals.test.ts`
- `scripts/intelligence-growth-boundary-static-evals.ts`
- `npm run eval:intelligence-growth-boundary-static`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| scannedFileCount | 92 |
| forbiddenImportCount / forbiddenEnvCount | 0 / 0 |
| forbiddenDatabaseReferenceCount | 0 |
| forbiddenNetworkCount / forbiddenAppApiReferenceCount | 0 / 0 |
| forbiddenProductionQueryReferenceCount / forbiddenRuntimeReferenceCount | 0 / 0 |

**边界**：boundary static gate 只读取仓库内 IGS 文件内容，不解析业务数据、不调用 LLM、不访问网络、不读取 DB、不生成 runtime artifact；任何 DB schema、API/UI、production query、provider credential、network call、official write、canonical memory write 或 skill promotion 进入 IGS P0 范围都应先失败，再由 founder approval + required reviewer 重新评审。

### P0++++++++++++++ IGS Eval Replay Snapshot Regression Gate（已落地，仍 offline-only）

在 boundary static gate 之上，新增 Eval Replay Snapshot Regression Gate：把 18 个 IGS gate 的 contract-level canonical summary 固定为 checked-in snapshot（fixture 版本 v6），覆盖 core eval、tenant signal、review packet、weekly scorecard、decision outcome、learning requeue、chain/cycle、fixture lint、dimension saturation、remediation、budget、boundary static、schema drift、failure taxonomy coverage、data protection manifest 与 approval readiness。未来任何关键计数、覆盖率、权限标志或 raw-data incident 漂移，必须显式更新 snapshot fixture 并重新评审。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-eval-replay-snapshots/eval-replay-snapshot-cases.json`
- `lib/evals/intelligence-growth-eval-replay-snapshot-evals.ts`
- `lib/evals/intelligence-growth-eval-replay-snapshot-evals.test.ts`
- `scripts/intelligence-growth-eval-replay-snapshot-evals.ts`
- `npm run eval:intelligence-growth-eval-replay-snapshot`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| expectedSnapshotCount / actualSnapshotCount | 17 / 17 |
| snapshotCoveragePercent | 100 |
| missingSnapshotCount / unexpectedSnapshotCount | 0 / 0 |
| duplicateExpectedSnapshotCount / snapshotMismatchCount | 0 / 0 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |

**边界**：snapshot regression gate 只比较 checked-in fixture 与同进程 offline evaluator 的 contract summary，不保存 raw output，不调用 LLM、不访问网络、不读取 DB、不生成 baseline 自动更新、不授权 runtime/self-learning、生产数据读取、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。任何 snapshot 漂移都是 review event，而不是自动接受。

### P0+++++++++++++++ IGS Schema Drift Gate（已落地，仍 offline-only）

在 snapshot regression gate 之上，新增 Schema Drift Gate：把 TS union、contracts registry、fixture-lint sentinel、core fixture top-level keyset、eval replay snapshot summary keyset 与 snapshot fixture version 固定为 checked-in schema drift baseline。它不做运行时 schema、不改 Prisma，只防止维度 / 决策 / no-go boundary / summary 字段 / fixture shape 在离线链路中静默漂移。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-schema-drift/schema-drift-baseline.json`
- `lib/evals/intelligence-growth-schema-drift-evals.ts`
- `lib/evals/intelligence-growth-schema-drift-evals.test.ts`
- `scripts/intelligence-growth-schema-drift-evals.ts`
- `npm run eval:intelligence-growth-schema-drift`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| trackedSummaryCount | 17 |
| dimensionParityOk / decisionParityOk / boundaryParityOk | true / true / true |
| summaryKeySetMismatchCount / authorityFlagWrongValueCount | 0 / 0 |
| fixtureKeySetMismatchCount / fixtureExpectedKeySetMismatchCount | 0 / 0 |
| snapshotVersionPinned / snapshotVersionMismatchCount | true / 0 |
| unionLiteralParseFailureCount | 0 |

**边界**：schema drift gate 只读取仓库内 checked-in contract / fixture / snapshot 文件并比较 keyset baseline，不调用 LLM、不访问网络、不读取 DB、不生成 baseline 自动更新、不授权 runtime/self-learning、生产数据读取、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。任何 schema drift 都是 review event，而不是自动接受。

### P0++++++++++++++++ IGS Failure Taxonomy Coverage Gate（已落地，仍 offline-only）

在 schema drift gate 之上，新增 Failure Taxonomy Coverage Gate：把 10 个维度 failure taxonomy markdown（每维度 8 行）与 30 个负例核心 fixture 通过 checked-in mapping 固定，防止负例 fixture、失败归因和人工 review 语言脱钩。它只校验 taxonomy 文档、mapping fixture 与核心 fixture，不生成运行时归因、不改生产 prompt/policy/schema。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-failure-taxonomy/failure-taxonomy-coverage-mapping.json`
- `lib/evals/intelligence-growth-failure-taxonomy-coverage-evals.ts`
- `lib/evals/intelligence-growth-failure-taxonomy-coverage-evals.test.ts`
- `scripts/intelligence-growth-failure-taxonomy-coverage-evals.ts`
- `npm run eval:intelligence-growth-failure-taxonomy-coverage`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| dimensionCount / expectedDimensionCount | 10 / 10 |
| taxonomyRowCount / expectedTaxonomyRowCount | 80 / 80 |
| negativeFixtureCount / mappedNegativeFixtureCount | 30 / 30 |
| negativeFixtureCoveragePercent | 100 |
| unmappedNegativeFixtureCount / orphanMappingCount | 0 / 0 |
| unknownFailureTypeCount / positiveFixtureMappingCount | 0 / 0 |
| malformedTaxonomyRowCount / duplicateFailureTypeCount | 0 / 0 |

**边界**：failure taxonomy coverage gate 只读取仓库内 checked-in taxonomy markdown、core fixture 和 mapping fixture，不调用 LLM、不访问网络、不读取 DB、不生成 runtime attribution、不授权 runtime/self-learning、生产数据读取、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。任何 taxonomy coverage 漂移都是 review event，而不是自动接受。

### P0+++++++++++++++++ IGS Data Protection Pre-Review Manifest Gate（已落地，仍 offline-only）

在 failure taxonomy coverage gate 之上，新增 Data Protection Pre-Review Manifest Gate：把 18 个 checked-in IGS fixture JSON 的字段级 redaction / retention / lawful-basis / reviewer-role 契约固定为 pending manifest，作为 P1+ Data Protection review 的预审材料。它只证明离线 fixture corpus 有完整字段清单和机械扫描，不代表 DPO 已批准。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-data-protection/redaction-manifest.json`
- `evals/intelligence-growth-data-protection/reviewer-signoff-receipts.json`
- `evals/intelligence-growth-data-protection/data-protection-pre-review-checklist.md`
- `lib/evals/intelligence-growth-data-protection-manifest-evals.ts`
- `lib/evals/intelligence-growth-data-protection-manifest-evals.test.ts`
- `scripts/intelligence-growth-data-protection-manifest-evals.ts`
- `npm run eval:intelligence-growth-data-protection-manifest`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| dimensionCount / expectedDimensionCount | 10 / 10 |
| scannedFixtureFileCount / expectedScannedFixtureFileCount | 18 / 18 |
| scannedFieldCount | 3591 |
| manifestCoveragePercent | 100 |
| unmanifestedFieldCount / unauthorizedFieldCount | 0 / 0 |
| rawPIIIncidentCount / rawCredentialIncidentCount / rdsHostnameLeakCount | 0 / 0 / 0 |
| aliasConsistencyMismatchCount / crossTenantLeakCount | 0 / 0 |
| dpReviewStatusApprovedWithoutReceiptCount / signoffReceiptForgeryCount | 0 / 0 |
| unsafe authority flags | 0 |

**边界**：data protection manifest gate 只读取仓库内 checked-in IGS fixture JSON、pending manifest 与 pending receipt fixture，不调用 LLM、不访问网络、不读取 DB、不生成 DPO approval、不读取生产数据、不授权 live calibration、runtime/self-learning、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。所有 `dpReviewStatus` 在 v1 中必须保持 `pending`；任何批准都必须进入单独的 DPO receipt + founder / required reviewer 审核流程。

### P0++++++++++++++++++ IGS Required Reviewer Approval Readiness Gate（已落地，仍 offline-only）

在 data protection manifest gate 之上，新增 Required Reviewer Approval Readiness Gate：把 IGS P1+ 进入 live calibration / runtime adoption 之前必须具备的 founder approval + required reviewer approval 前置条件做成离线 readiness packet。它只证明每个 P1+ 候选都带齐 founder requirement、五类 required reviewer role、Data Protection pre-review link、fresh evidence 和 no-authority flags，不代表 founder / reviewer 已批准。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-approval-readiness/approval-readiness-cases.json`
- `lib/evals/intelligence-growth-approval-readiness-evals.ts`
- `lib/evals/intelligence-growth-approval-readiness-evals.test.ts`
- `scripts/intelligence-growth-approval-readiness-evals.ts`
- `npm run eval:intelligence-growth-approval-readiness`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| totalPackets / expectedPacketCount | 10 / 10 |
| dimensionCount / expectedDimensionCount | 10 / 10 |
| p1OrAbovePacketCount | 10 |
| pendingPacketCount / approvedPacketCount / blockedPacketCount | 10 / 0 / 0 |
| missingFounderApprovalCount / missingReviewerRoleCount | 0 / 0 |
| missingDataProtectionLinkCount | 0 |
| staleEvidenceCount / missingEvidenceCount | 0 / 0 |
| approvedWithoutReceiptCount / receiptForgeryCount | 0 / 0 |
| crossTenantScopeCount / customerTenantUpgradeAttemptCount | 0 / 0 |
| liveCalibration / runtime / write / memory / policy / skill authority flags | 0 |

**边界**：approval readiness gate 只读取 checked-in approval readiness fixture，不调用 LLM、不访问网络、不读取 DB、不生成真实审批、不读取生产数据、不授权 live calibration、runtime/self-learning、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。默认 fixture 中所有 packet 都保持 `approvalStatus: "pending"`；测试中出现的 `approved` 只用于验证 receipt contract，不代表仓库已有 founder / reviewer approval。

### P0+++++++++++++++++++ IGS Redacted Live Calibration Evidence Preflight Gate（已落地，仍 offline-only）

在 approval readiness gate 之上，新增 Redacted Live Calibration Evidence Preflight Gate：把 P1+ 进入 live calibration 前必须具备的 redacted evidence package 做成离线预检。它只证明 10 个智能维度各有候选 evidence package、redaction proof、Data Protection 引用、owner/reviewer linkage、fresh evidence 与 no-authority flags，不代表真实 live calibration 已批准，也不代表 runtime adoption。

当前实施范围（OFFLINE-ONLY，Helm 内置自身业务发展租户）：

- `evals/intelligence-growth-live-calibration-preflight/live-calibration-preflight-cases.json`
- `lib/evals/intelligence-growth-live-calibration-preflight-evals.ts`
- `lib/evals/intelligence-growth-live-calibration-preflight-evals.test.ts`
- `scripts/intelligence-growth-live-calibration-preflight-evals.ts`
- `npm run eval:intelligence-growth-live-calibration-preflight`

当前通过结果：

| 指标 | 当前结果 |
|---|---:|
| totalPackages / expectedPackageCount | 10 / 10 |
| dimensionCount / expectedDimensionCount | 10 / 10 |
| duplicatePackageCount / duplicateDimensionCount / unknownDimensionCount | 0 / 0 / 0 |
| missingRedactionProofCount / rawDataIndicatorCount | 0 / 0 |
| rawPIIIncidentCount / rawCredentialIncidentCount / rdsHostnameLeakCount | 0 / 0 / 0 |
| missingSourceRefCount / missingEvidenceRefCount / staleEvidenceCount | 0 / 0 / 0 |
| missingDataProtectionRefCount / invalidCalibrationWindowCount | 0 / 0 |
| missingOwnerLinkCount / missingReviewerLinkCount | 0 / 0 |
| crossTenantScopeCount / customerTenantUpgradeAttemptCount | 0 / 0 |
| live calibration / runtime / write / memory / policy / skill authority flags | 0 |

**边界**：live calibration preflight gate 只读取 checked-in redacted preflight fixture，不调用 LLM、不访问网络、不读取 DB、不读取生产数据、不生成 Data Protection / founder / reviewer approval、不授权 live calibration、runtime/self-learning、API/UI、prompt/schema/policy/write、canonical memory 或 skill promotion。所有 ref 只作为离线 evidence package 的可追踪候选；gate green 不等于真实客户数据可进入 Helm 自成长。

### P1+ 额外前置条件（不在 P0 范围内）

- 真实用户流量（≥ 1 个 paid design partner）
- Data Protection review 完成
- Founder approval + required reviewer approval
- Redacted live calibration evidence

---

## 七、Go / No-Go 条件

### P0 Go 条件（可立即启动）

- [x] 有明确的 offline-only 实施范围（Slice A–D）
- [x] 不需要 DB schema、API、UI、生产 prompt 变更
- [x] 已有现有 eval 框架可复用（`eval:object-signal-validity` 等）
- [x] 边界检查可机器验证

### P0 No-Go 条件

如果任何一项为真，P0 继续 No-Go：

- 实施范围超出 offline-only（如需要 DB 迁移、API 实现、UI 改造）
- 需要读写生产数据库
- 需要修改 `data/queries.ts` 或任何生产查询路径
- 需要生产 prompt 变更

### P1+ No-Go 条件（直到满足前置条件）

- 没有真实用户流量（当前状态）
- 没有 Data Protection review
- 没有 founder approval + required reviewer approval
- 没有 redacted live calibration evidence

---

## 八、与现有系统的关系

| 现有系统 | IGS 关系 |
|----------|----------|
| Object/Signal validity gate | IGS 3.2 的基础，P0 扩充 fixture 覆盖 |
| Business Advancement signal pipeline | IGS 3.4 的基础，P0 扩充路由 failure case |
| LLM context audit | IGS 3.1 的基础，P0 扩充评分维度 |
| External Agent intake | IGS 3.2 的候选输入源（仍 review-first） |
| Memory 写入链路 | IGS 3.3 保持 review-first 约束 |
| Commercial Promotion Pack eval | IGS 3.6 的基础 |
| Business Advancement signal pipeline | IGS 改进项进入 Helm 内置自身业务发展租户 `helm-business-development` 经营信号的 offline 投影层 |
| Improvement review packet eval | IGS 改进项承接为 founder approval + required reviewer 的 offline review packet |
| Approval readiness eval | IGS P1+ 进入 live calibration / runtime adoption 前的 founder + required reviewer + Data Protection pre-review readiness gate |
| Live calibration preflight eval | IGS P1+ 进入 live calibration 前的 redacted evidence package readiness gate |

---

## 九、变更记录

| 日期 | 变化 |
|------|------|
| 2026-05-02 | 新增 P0+++++++++++++++++++ IGS Redacted Live Calibration Evidence Preflight Gate：`eval:intelligence-growth-live-calibration-preflight` 固定 10 个维度的 redacted evidence package；当前 totalPackages / expectedPackageCount 10/10、rawPII / credential / RDS / cross-tenant / customer-tenant-upgrade / authority flags 均为 0；gate green 不代表 live calibration approval 或 runtime adoption，继续禁止 DB/API/UI/runtime/self-learning/live calibration authority/生产 prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0++++++++++++++++++ IGS Required Reviewer Approval Readiness Gate：`eval:intelligence-growth-approval-readiness` 固定 10 个 P1+ approval readiness packet；当前 pendingPacketCount 10、approvedPacketCount 0、missingFounderApprovalCount / missingReviewerRoleCount / missingDataProtectionLinkCount 0、staleEvidenceCount / missingEvidenceCount 0、authority flags 0；gate green 不代表 founder / reviewer approval，继续禁止 live calibration/runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0+++++++++++++++++ IGS Data Protection Pre-Review Manifest Gate：`eval:intelligence-growth-data-protection-manifest` 固定 18 个 IGS fixture JSON 的字段级 pending redaction manifest；当前 scannedFieldCount 3591、manifestCoveragePercent 100、rawPIIIncidentCount / rawCredentialIncidentCount / rdsHostnameLeakCount / crossTenantLeakCount / unauthorizedFlagCount / dpReviewStatusApprovedWithoutReceiptCount / signoffReceiptForgeryCount 均为 0；gate green 不代表 DPO approval，继续禁止 live calibration/runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0++++++++++++++++ IGS Failure Taxonomy Coverage Gate：`eval:intelligence-growth-failure-taxonomy-coverage` 固定 10 个 failure taxonomy 文档与 30 个负例核心 fixture 的映射；当前 taxonomyRowCount / expectedTaxonomyRowCount 80/80、negativeFixtureCoveragePercent 100、orphanMappingCount / unknownFailureTypeCount / positiveFixtureMappingCount / malformedTaxonomyRowCount / duplicateFailureTypeCount 均为 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0+++++++++++++++ IGS Schema Drift Gate：`eval:intelligence-growth-schema-drift` 固定 TS union、contracts registry、fixture-lint sentinel、core fixture keyset、eval replay snapshot keyset 与 snapshot fixture version；当前 trackedSummaryCount 18、dimension/decision/boundary parity 全部 true、summaryKeySetMismatchCount 0、fixtureKeySetMismatchCount 0、snapshotVersionPinned true；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0++++++++++++++ IGS Eval Replay Snapshot Regression Gate：`eval:intelligence-growth-eval-replay-snapshot` 把 18 个 IGS gate 的 contract-level canonical summary 固定为 checked-in snapshot v6；当前 expectedSnapshotCount / actualSnapshotCount 18/18、snapshotCoveragePercent 100%、snapshotMismatchCount 0、unauthorizedFlagCount / rawCustomerDataIncidentCount 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0+++++++++++++ IGS Boundary Static No-Go Gate：`eval:intelligence-growth-boundary-static` 机械扫描 IGS core/evals/scripts/fixtures，拒绝 DB/Prisma、app/api/next server、production query、LLM provider env 与 network call 进入 offline gate；当前 scannedFileCount 96、forbiddenDatabaseReferenceCount / forbiddenRuntimeReferenceCount 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0++++++++++++ IGS Determinism Gate：`eval:intelligence-growth-determinism` 对 core eval + 18 个 IGS 派生 gate 连跑 3 次并做 canonical JSON 对比；当前 producerCount 19、stableProducerCount 19、unstableProducerCount 0、volatileFieldAllowlist 仅 `runAt`；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture |
| 2026-05-02 | 新增 P0+++++++++++ IGS Cost / Model / Tool Budget Gate：`eval:intelligence-growth-budget-gate` 要求 W19 next-cycle intake 每个候选都有离线 budget envelope；当前 totalBudgetRecords / expectedCandidateCount 10/10、budgetCoveragePercent 100%、overBudgetCandidateCount / modelTierEscalationCount / toolOutsideAllowlistCount 0、aggregateInputTokensObserved / aggregateInputTokenMax 9430/13400；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development offline fixture |
| 2026-05-02 | 新增 P0++++++++++ IGS Remediation Roundtrip Gate：`eval:intelligence-growth-remediation-roundtrip` 验证 decision outcome → learning requeue → next-cycle intake 中 continue/revise/blocked/stop 到 ready_for_founder_review/needs_required_review/review_required/archived 的确定性映射；当前 blockedResurrectionCount / stoppedResurrectionCount / statusRoundtripMismatchCount / evidenceContinuityMismatchCount 均为 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development offline fixture |
| 2026-05-02 | 新增 P0+++++++++ IGS Dimension Saturation Gate：`eval:intelligence-growth-dimension-saturation` 复用 W19 next-cycle intake，验证 10 个智能维度覆盖率 100%、missingDimensions 0、duplicateDimensionCount 0、maxDimensionCandidateCount 1、unauthorized/raw incident 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture corpus |
| 2026-05-02 | 新增 P0++++++++ IGS Fixture Lint Gate：`eval:intelligence-growth-fixture-lint` 对 80 个核心维度 fixture、10 tenant signal、10 decision outcome、10 learning requeue candidate 做元验证；当前 duplicate/missing id、invalid dimension/decision、orphan reference、missing requeue candidate、scope/window mismatch、unauthorized/raw incident 均为 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 offline fixture corpus |
| 2026-05-02 | 新增 P0+++++++ IGS Cycle Advance Gate：`eval:intelligence-growth-cycle-advance` 把 W18 learning requeue candidates 物化为 W19 next-cycle intake；验证 totalIntakeCandidates / expectedIntakeCandidateCount 10/10、intakeCoveragePercent 100%、sourceCandidateMismatchCount / sourcePacketMismatchCount / statusMismatchCount 0、scopeMismatchCount / windowMismatchCount 0、unauthorizedFlagCount / rawCustomerDataIncidentCount 0、evidence/owner/boundary coverage 100%；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development |
| 2026-05-02 | 新增 P0++++++ IGS Chain Integrity Gate：`eval:intelligence-growth-chain` 原生串联 tenant signal → review packet → weekly scorecard → decision outcome ledger → learning requeue 五段 gate；验证 10/10/10/10/10 count continuity、executionMode native、continuityPass true、totalUnauthorizedIncidentCount / totalRawDataIncidentCount / totalScopeMismatchCount 均为 0、minimumCoveragePercent 100%；summary injection 默认拒绝，测试需显式 `allowInjectedSummariesForTesting`；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development |
| 2026-05-02 | 新增 P0+++++ Learning Requeue Gate：把 decision outcome ledger 确认的学习候选按 source packet 映射回下一轮 candidate 队列，形成闭环终止条件；`eval:intelligence-growth-learning-requeue` 验证 10 条候选、candidateCoveragePercent 100%、blockedDecisionCandidateCount 3、unexpectedCandidateCount 0、sourcePacketMismatchCount 0、invalidStatusCount 0、unauthorized/raw incidents 0、evidence/owner/boundary coverage 100%；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development |
| 2026-05-02 | 新增 P0++++ Decision Outcome Ledger：把 founder / operator 决策结果收录为离线 offline fixture，闭合 review packet → weekly scorecard → 决策结果反馈环；`eval:intelligence-growth-decision-outcomes` 验证 10 条决策记录、decision/evidence/owner/reviewer/boundary coverage 100%、nextLearningCandidateCount 10、unauthorized/raw incidents 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/write 变更；仅限 helm-business-development 内置自身业务发展租户 |
| 2026-05-02 | 新增 P0++ Improvement Review Packet：IGS tenant signal 可生成 offline review packet；`eval:intelligence-growth-review-packets` 检查 founder approval / required reviewer / scope / evidence / no authority leak；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/write 变更 |
| 2026-05-02 | 新增 P0+ Tenant Signal Projection：IGS 改进项可作为 Helm 内置自身业务发展租户 `helm-business-development` 的 offline business signal candidate 进入 Business Advancement pipeline；新增 `eval:intelligence-growth-tenant-signals`，继续禁止 runtime/self-learning/DB/API/UI/prompt 变更 |
| 2026-05-02 | 初始版本；整合 HELM_INTELLIGENCE_GROWTH_SYSTEM_REQUIREMENTS_DRAFT.md 与 TENANT_USAGE_LEARNING_LOOP_REQUIREMENTS_DRAFT.md；确立十条智能维度、P0–P3 路线图、硬边界、成功度量与 Go/No-Go 条件；P0 offline gate 已落地，P1+ 继续 No-Go |
