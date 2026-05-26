---
status: active
owner: Product / Engineering / Data Protection
created: 2026-05-02
review_after: 2026-05-16
archive_trigger:
  - Business Advancement signal pipeline 被 runtime adoption PRD 替代并完成 closeout 后归档
  - Object / Signal validity、remediation、audience projection 三份合同合并成统一 runtime preflight contract 后归档
  - Helm 放弃 Business Advancement / Must Push 主线时归档
---

# Helm Business Advancement Signal Pipeline Contract

## 1. 结论

Business Advancement 的下一层主链不是单独再造一个新判断器，而是把已经成立的三道离线 gate 串起来：

```text
raw / redacted business input
  -> Object / Signal Validity Gate
  -> Post-admission Remediation Gate
  -> Audience-aware Projection
  -> MustPushItem / ReviewRequiredAction / WorkerInstruction / LearningCandidate
```

本文件只授权 docs / fixtures / offline evaluator，不授权 schema、runtime、API、UI、production query adoption、official write、自动执行、自动外发、自动改 CRM、canonical memory 自动写入或 LLM final ranking。

## 2. 当前目标

这条 pipeline 解决四个问题：

1. 经营对象 / 信号是否有效。
2. 前置 gate 失守后是否能撤销、降级或隔离。
3. 同一信号如何按 Human / Worker / Reviewer / Learning loop 分流。
4. 哪些结果允许进入 Must Push，哪些只能进入 Review / Watch / Containment。

这不是 production adapter，也不是 runtime extractor。它是 runtime adoption 前的离线主链质量门。

## 3. 输入范围

首批 fixture 覆盖 7 类 source：

| Source | 当前处理方式 |
|---|---|
| `meeting` | 会议摘要 / 会后 follow-up 信号候选 |
| `crm` | 机会停滞、阶段风险、客户等待 |
| `email_im` | 邮箱 / IM 等待或承诺证据 |
| `tenant_resource` | 资源证明、交付材料、review gap |
| `ask_helm` | Ask Helm interaction 产生的推进候选 |
| `external_agent` | Coze / OpenClaw / Dify 等外部 agent 输出候选 |
| `report` | 周报、风险报表、经营 readout；可承接 IGS improvement item 作为 Helm 内置自身业务发展租户经营信号 |

外部 agent 输出只能作为 candidate evidence。若 `redactionStatus = unredacted` 或包含 raw payload，pipeline 必须在 source preflight 阶段挡住，并将最终 disposition 降为 `rejected`，不能进入 Must Push 或 Worker instruction。

IGS improvement item 只能以 Helm 内置自身业务发展租户 `helm-business-development`、`report` source、`helm_builtin_business_development` provider、synthetic / redacted posture 进入 pipeline。它最多生成 Helm 自身业务发展经营的 MustPushItem / ReviewRequiredAction / WorkerInstruction / LearningCandidate candidate，不授权 runtime self-learning、生产 prompt 变更、规则自动更新、canonical memory 自动写入或 Skill 自动晋升。

客户租户不能通过自身经营信号升级 Helm 系统。客户租户信号只服务该租户的经营推进；租户私有应用信号只服务该租户 / 私有应用边界内的经营推进。任何从客户租户或租户私有应用抽象为 Helm 系统改进输入的路径，都必须另走脱敏授权、Data Protection review、founder approval 和人工评审，不属于本离线 gate 的自动流转范围。

| 信号归属 | 允许进入的经营信号 | 不允许 |
|---|---|---|
| Helm 内置自身业务发展租户 | IGS 改进项、Helm 自身产品 / GTM / 运营改进项 | 冒充客户租户结果、自动改生产 prompt / policy / schema |
| 客户租户 | 该客户的会议、CRM、邮箱 / IM、资源状态、Ask Helm interaction、私有应用 readout | 直接升级 Helm 核心系统、跨租户学习、自动写入 Helm canonical memory |
| 租户私有应用 | 该私有应用产生的 tenant-scoped signal / readout / review packet | 默认进入 Helm core、默认训练或修改系统策略、默认跨租户复用 |

## 4. 顺序合同

### 4.1 Validity

先复用 `Object / Signal Validity Gate`：

- identity stable
- workspace / tenant ownership
- evidence freshness
- source count
- contradiction
- duplicate compression
- boundary note
- review posture
- no LLM final ranking
- no auto promotion
- no official write intent

输出仍为四档：

```text
must_push_ready | review_required | watch_only | rejected
```

### 4.2 Remediation

如果信号已经进入下游后才发现 stale、contradiction、wrong object、tenant mismatch、unsafe boundary、official write intent 或 canonical memory contamination，必须进入 remediation：

```text
revoked | downgraded | quarantined | unchanged
```

Remediation 必须覆盖 blast radius：

- remove / downgrade Must Push
- freeze / quarantine draft
- quarantine review packet
- quarantine memory candidate
- tombstone contaminated canonical memory
- block official write
- create learning candidate

### 4.3 Audience Projection

最终 disposition 再进入 audience-aware projection：

| Final disposition | Human | Worker | Reviewer | Learning |
|---|---|---|---|---|
| `must_push_ready` | compact Must Push | bounded instruction | audit-ready | positive pattern candidate |
| `review_required` | review banner | review packet only | required | threshold / boundary candidate |
| `watch_only` | digest or suppress | no instruction | optional | noise / freshness candidate |
| `rejected` | suppress + alert reviewer | blocked | containment required | negative fixture candidate |

## 5. 输出对象

Pipeline 当前只生成离线结果，不写生产对象：

| Output | 语义 | 禁止 |
|---|---|---|
| `MustPushItem` | 可以进入 3-5 个 Must Push 候选 | 不代表承诺、不代表已执行 |
| `ReviewRequiredAction` | 需要人类或 reviewer 复核 | 不代表审批通过 |
| `WorkerInstruction` | Worker typed packet，可做准备动作 | 不允许 send / approve / CRM write / price commit |
| `LearningCandidate` | 用于后续改进、负例、阈值或边界调整 | 不自动写 canonical memory，不自动晋升 Skill |

## 6. 当前 Eval

新增：

- `evals/business-advancement-signal-pipeline/pipeline-cases.json`
- `evals/intelligence-growth-tenant-signals/tenant-signal-cases.json`
- `lib/evals/business-advancement-signal-pipeline-evals.ts`
- `lib/evals/intelligence-growth-tenant-signal-evals.ts`
- `lib/evals/intelligence-growth-review-packet-evals.ts`
- `scripts/business-advancement-signal-pipeline-evals.ts`
- `scripts/intelligence-growth-tenant-signal-evals.ts`
- `scripts/intelligence-growth-review-packet-evals.ts`
- `lib/evals/intelligence-growth-weekly-scorecard-evals.ts`
- `scripts/intelligence-growth-weekly-scorecard-evals.ts`
- `lib/evals/intelligence-growth-decision-outcome-evals.ts`
- `scripts/intelligence-growth-decision-outcome-evals.ts`
- `evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json`
- `evals/intelligence-growth-learning-requeue/learning-requeue-cases.json`
- `lib/evals/intelligence-growth-learning-requeue-evals.ts`
- `scripts/intelligence-growth-learning-requeue-evals.ts`
- `npm run eval:business-advancement-signal-pipeline`
- `npm run eval:intelligence-growth-tenant-signals`
- `npm run eval:intelligence-growth-review-packets`
- `npm run eval:intelligence-growth-weekly-scorecard`
- `npm run eval:intelligence-growth-decision-outcomes`
- `npm run eval:intelligence-growth-learning-requeue`

首批 20 条 alias-only fixture 覆盖：

1. 5 条 `must_push_ready` 输出 Must Push。
2. meeting / CRM / email / resource / Ask Helm 输入的直接推进候选。
3. external agent redacted output 只能作为 review-first evidence candidate。
4. contradiction / weak evidence / missing owner / missing next action 降级为 review-first。
5. stale / duplicate / watch severity 降为 watch-only。
6. cross-workspace / unsafe authority / official write intent 直接 rejected。
7. unredacted external agent payload 在 source preflight 阶段 blocked。
8. post-admission stale revoked。
9. post-admission contradiction downgraded。
10. post-admission wrong object / tenant mismatch / contaminated memory quarantined。
11. IGS 10 个智能维度的 improvement item 映射为 Helm 内置自身业务发展租户经营信号，并继续复用 validity / audience / review-first gate。

当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| Total cases | 20 |
| Source kinds | 7 |
| Must Push items | 5 |
| ReviewRequiredAction | 11 |
| WorkerInstruction | 12 |
| LearningCandidate | 20 |
| Remediation cases | 3 |
| Invalid Must Push item | 0 |
| Raw payload echo | 0 |
| Auto execution attempt | 0 |
| Official write attempt | 0 |
| Canonical memory write | 0 |
| Scope violation | 0 |
| Reviewer evidence coverage | 100% |
| Remediation coverage | 100% |

Helm business development tenant signal projection 当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| Total IGS tenant signal cases | 10 |
| Dimension coverage | 10 |
| Must Push candidates | 4 |
| ReviewRequiredAction | 6 |
| WorkerInstruction | 10 |
| LearningCandidate | 10 |
| Invalid Must Push item | 0 |
| Raw payload echo | 0 |
| Worker forbidden action leak | 0 |
| Auto execution attempt | 0 |
| Official write attempt | 0 |
| Canonical memory write | 0 |
| Reviewer evidence coverage | 100% |

IGS review packet 当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| Review packets | 10 |
| Dimension coverage | 10 |
| Ready for founder review | 4 |
| Needs required review | 6 |
| Blocked | 0 |
| Founder approval coverage | 100% |
| Required reviewer coverage | 100% |
| Evidence coverage | 100% |
| Packet completeness | 100% |
| Scope violation | 0 |
| Promotion authority leak | 0 |
| Runtime authority leak | 0 |

IGS weekly scorecard（`npm run eval:intelligence-growth-weekly-scorecard`，`helm-business-development`，2026-W18）当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| Total packets | 10 |
| ready_for_founder_review | 4 |
| needs_required_review | 6 |
| blocked | 0 |
| Coverage | 100% |
| Authority leaks | 0 |

IGS decision outcome ledger（`npm run eval:intelligence-growth-decision-outcomes`，`helm-business-development`，OFFLINE-ONLY）当前通过指标：

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
| rawCustomerDataIncidentCount | 0 |
| unauthorizedProductionWriteCount | 0 |

IGS learning requeue gate（`npm run eval:intelligence-growth-learning-requeue`，`helm-business-development`，OFFLINE-ONLY）当前通过指标：

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

**Runtime adoption boundary（learning requeue）**：learning requeue gate 是 candidate-only、offline-only 闭环校验，不授权 runtime、self-learning、DB schema、API、UI、prompt / schema / policy 更新、canonical memory 写入、Skill 晋升、official write 或自动执行；只适用于 Helm 内置自身业务发展租户 `helm-business-development`；客户租户不能通过自身决策结果升级 Helm 系统。

IGS chain integrity gate（`npm run eval:intelligence-growth-chain`，`helm-business-development`，native execution，OFFLINE-ONLY）当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| tenantSignals / reviewPackets / weeklyPackets / decisionOutcomes / learningRequeueCandidates | 10 / 10 / 10 / 10 / 10 |
| continuityPass | true |
| totalUnauthorizedIncidentCount | 0 |
| totalRawDataIncidentCount | 0 |
| totalScopeMismatchCount | 0 |
| minimumCoveragePercent | 100% |

**Runtime adoption boundary（chain integrity）**：chain gate 只证明 offline eval chain 未断链，不代表 production query adoption、runtime self-learning、自动规则更新或 Helm core 自变更已获授权。summary injection 默认拒绝，测试需显式 `allowInjectedSummariesForTesting`，防止手工注入 green summary 替代真实五段 eval。

IGS cycle advance gate（`npm run eval:intelligence-growth-cycle-advance`，W18 → W19，OFFLINE-ONLY）当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| totalIntakeCandidates / expectedIntakeCandidateCount | 10 / 10 |
| intakeCoveragePercent | 100% |
| sourceCandidateMismatchCount / sourcePacketMismatchCount / statusMismatchCount | 0 / 0 / 0 |
| scopeMismatchCount / windowMismatchCount | 0 / 0 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |
| Evidence / owner / boundary coverage | 100% |

**Runtime adoption boundary（cycle advance）**：cycle advance gate 只验证上一周期 requeue output 能安全成为下一周期 intake，不授权 W19 production query、runtime self-learning、自动规则更新、canonical memory 写入或 Helm core 自变更。

IGS fixture lint gate（`npm run eval:intelligence-growth-fixture-lint`，OFFLINE-ONLY）当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| coreFixtureCaseCount / expectedCoreFixtureCaseCount | 80 / 80 |
| coreDimensionCount | 10 |
| tenantSignalCaseCount / decisionOutcomeRecordCount / learningRequeueCandidateCount | 10 / 10 / 10 |
| duplicateIdCount / missingIdCount / invalidDimensionCount / invalidDecisionCount | 0 / 0 / 0 / 0 |
| orphanReviewPacketReferenceCount / orphanDecisionReferenceCount / orphanRequeueReferenceCount / missingRequeueCandidateCount | 0 / 0 / 0 / 0 |
| scopeMismatchCount / windowMismatchCount | 0 / 0 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |

**Runtime adoption boundary（fixture lint）**：fixture lint gate 只证明 checked-in offline fixture corpus 的结构与跨文件引用一致，不代表生产数据、runtime projection、自动修复、fixture 生成、DB/API/UI、prompt/schema/policy/write、canonical memory 或 Skill 晋升已获授权。

IGS dimension saturation gate（`npm run eval:intelligence-growth-dimension-saturation`，OFFLINE-ONLY）当前通过指标：

| 指标 | 当前结果 |
|---|---:|
| totalIntakeCandidates | 10 |
| expectedDimensionCount / coveredDimensionCount | 10 / 10 |
| dimensionCoveragePercent | 100% |
| missingDimensions / duplicateDimensionCount | 0 / 0 |
| maxDimensionCandidateCount | 1 |
| unauthorizedFlagCount / rawCustomerDataIncidentCount | 0 / 0 |

**Runtime adoption boundary（dimension saturation）**：dimension saturation gate 只证明 checked-in W19 intake fixture 在十个 IGS 维度上不缺位、不重复，不代表自动调度、生产优先级、runtime projection、DB/API/UI、prompt/schema/policy/write、canonical memory 或 Skill 晋升已获授权。

## 7. Runtime Adoption 前置条件

进入 read-only production query adapter 前，至少还需要：

1. 将 20 条 fixture 扩展到 30-50 条，覆盖 Pack A 真实脱敏样本。
2. 与 `Business Advancement Production Query Adoption Plan` 对齐 source query owner。
3. 与 `Required Reviewer Approval Protocol` 对齐 reviewer assignment 和 approval gate。
4. 与 `Redacted Real-data Calibration Package` 对齐脱敏输入格式。
5. 形成 runtime adoption review packet，明确仍然只读、无写回、无自动执行。

## 8. 边界

1. `eval:business-advancement-signal-pipeline` 只证明离线 fixture 主链稳定，不证明 production query 已可用。
2. Pipeline 不替代 Object / Signal validity、remediation 或 audience projection；它只负责串联。
3. Pipeline 不授权外部 agent 输出直接进入 truth、Must Push 或 official write。
4. Pipeline 不授权 Worker 消费自然语言建议；Worker 只能消费 typed instruction。
5. Pipeline 不授权 LearningCandidate 自动写 canonical memory 或自动晋升 Skill。

## 9. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | 新增 IGS dimension saturation gate；`eval:intelligence-growth-dimension-saturation` 验证 W19 next-cycle intake 覆盖 10 个智能维度，dimensionCoveragePercent 100%、missingDimensions 0、duplicateDimensionCount 0、maxDimensionCandidateCount 1、unauthorized/raw incident 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion |
| 2026-05-02 | 新增 IGS fixture lint gate；`eval:intelligence-growth-fixture-lint` 对核心 80 fixture、tenant signal、decision outcome、learning requeue 做元验证，覆盖 duplicate/missing id、invalid dimension/decision、orphan reference、missing requeue candidate、scope/window mismatch、unauthorized/raw incident；当前全部为 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion |
| 2026-05-02 | 新增 IGS cycle advance gate；`eval:intelligence-growth-cycle-advance` 验证 W18 learning requeue candidates 可安全物化为 W19 next-cycle intake，且 intakeCoveragePercent / evidence / owner / boundary coverage 均为 100%、source/status/scope/window/authority/raw incident 计数均为 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development |
| 2026-05-02 | 新增 IGS chain integrity aggregate gate；`eval:intelligence-growth-chain` 原生串联 tenant signal → review packet → weekly scorecard → decision outcome ledger → learning requeue，验证 10/10/10/10/10 count continuity、continuityPass true、totalUnauthorizedIncidentCount / totalRawDataIncidentCount / totalScopeMismatchCount 均为 0、minimumCoveragePercent 100%；summary injection 默认拒绝；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development |
| 2026-05-02 | 新增 IGS learning requeue gate offline gate；`eval:intelligence-growth-learning-requeue` 把 decision outcome ledger 确认的 10 条学习候选按 source packet 映射回下一轮 candidate 队列；candidateCoveragePercent 100%、blockedDecisionCandidateCount 3、unexpectedCandidateCount 0、sourcePacketMismatchCount 0、invalidStatusCount 0、unauthorized/raw incidents 0、evidence/owner/boundary coverage 100%；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/policy/write/canonical memory/skill auto-promotion；仅限 helm-business-development |
| 2026-05-02 | 新增 IGS decision outcome ledger offline gate；`eval:intelligence-growth-decision-outcomes` 把 founder / operator 决策结果收录为离线 fixture，闭合 review packet → weekly scorecard → 决策结果反馈环；10 条决策记录、decision/evidence/owner/reviewer/boundary coverage 100%、nextLearningCandidateCount 10、rawCustomerDataIncidentCount 0；继续禁止 runtime/self-learning/DB/API/UI/prompt/schema/write |
| 2026-05-02 | 新增 IGS review packet offline gate；`eval:intelligence-growth-review-packets` 把 Helm 自身业务发展租户信号承接为 founder approval + required reviewer 的 candidate-only review packet，并阻断客户租户 / tenant-private app scope 和任何 promotion / runtime authority leak |
| 2026-05-02 | 新增 IGS improvement item -> Helm built-in business development tenant signal offline projection；`report` source 可承接 `helm-business-development` IGS 改进项，但继续禁止 runtime、schema、API、UI、official write、auto execution、canonical memory write 和 self-learning 自动晋升 |
| 2026-05-02 | 首版：新增 Business Advancement Signal Pipeline 离线主链合同和 `eval:business-advancement-signal-pipeline` |
