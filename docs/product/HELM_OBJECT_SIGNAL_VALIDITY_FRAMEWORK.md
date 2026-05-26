---
status: active
owner: Product / Engineering / Data Protection
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - Object / Signal validity gate 被接入 Business Advancement runtime adoption plan 并形成独立 closeout 后，本文件由 runtime PRD 替代
  - Company memory world-model health evaluator 吸收对象 / 信号有效性检查并连续 2 周 dogfood 通过后归档
  - Helm 放弃 Must Push / AdvancementSignal 作为经营推进主线时归档
---

# Helm 经营对象与经营信号有效性框架

## 1. 结论

Helm 的底层假设是：经营对象和经营信号会推动经营者更有效地经营。

这条假设只有在对象和信号本身有效时才成立。坏对象、坏信号、过期证据、跨租户身份错、权限不足、边界错、伪造证据或排序错，会让 Helm 从“经营推进控制台”退化为“高效率制造噪音的系统”。

因此 Helm 需要一个独立的 **Object / Signal Validity Layer**：

```text
raw source
  -> object identity validation
  -> evidence / freshness validation
  -> contradiction / duplicate validation
  -> boundary / authority validation
  -> actionability validation
  -> Must Push admission
```

本轮只授权 docs / fixtures / offline evaluator，不授权 schema、runtime write、production query adoption、LLM final ranking、official write 或自动执行。

## 2. 有效经营对象定义

一个经营对象不能因为“存在于系统里”就被视为有效。它必须同时通过以下 7 个检查：

| 检查 | 问题 | 失败后处理 |
|---|---|---|
| 身份有效 | 是否有 `workspaceId / tenantKey / sourceWindowKey / objectType / objectId / canonicalObjectRef`？是否串 workspace / tenant？ | `rejected` |
| 语义有效 | 对象到底是 customer、opportunity、commitment、decision、resource 还是 report gap？ | `review_required` |
| 证据有效 | 是否有足够 evidenceRefs？来源是否可追溯？是否包含 hallucinated（无法对上来源）的伪证据？ | `review_required`、`watch_only` 或 `rejected` |
| 时间有效 | 证据是否过期？是否被同步任务误 bump？ | `watch_only` |
| 冲突有效 | CRM / 会议 / 邮件 / 人工确认是否互相矛盾？ | `review_required` |
| 边界有效 | 是否会被误读成承诺、审批、发送、settlement 或 official write？ | `rejected` 或 `review_required` |
| 权限有效 | 请求方对该对象的 permission posture 是否充分？`insufficient` 直接 reject，`review_required` 进入复核 | `rejected` 或 `review_required` |
| 行动有效 | 是否有 owner、next action、review posture、outcome metric？ | `review_required` |

只有通过上述检查的对象和信号，才允许进入 Must Push。

## 3. Disposition

Object / Signal Validity Gate 输出四种结果：

| Disposition | 含义 | 能否进入 Must Push |
|---|---|---|
| `must_push_ready` | 身份、证据、时间、边界、行动性均成立 | 可以 |
| `review_required` | 有价值但需要人工复核，例如证据冲突、弱证据、高风险缺 owner / metric | 不能直接进入 Must Push，只能进入 review packet |
| `watch_only` | 重复、过期、低风险或证据不足以行动 | 不能进入 Must Push，只能观察 |
| `rejected` | 身份错、跨租户、权限不足、LLM final ranking、auto-promotion、official write intent、hallucinated evidence | 拒绝 |

## 4. Post-admission Remediation

如果前置 gate 没守住，后置补救不能假设“模型会自己变对”。Helm 必须把错对象 / 错信号从推进链路中撤销、降级或隔离，并把影响面回放给 reviewer。

后置补救固定为四层：

| 防线 | 作用 | 允许结果 |
|---|---|---|
| Revocation / downgrade | 已进入 Must Push 的错误信号可被撤销、降级到 review 或观察 | `revoked` / `downgraded` |
| Blast radius report | 回放受影响的 Must Push、review packet、draft、memory candidate、SkillSuggestion、official write intent | 只读报告 |
| Memory contamination firewall | 错误信号不得变成 canonical memory；已写入的必须 tombstone / supersede | candidate / tombstone |
| Learning candidate | reviewer 纠错进入负例学习队列 | fixture / threshold / source repair candidate |

后置补救仍不授权自动删除审计记录、自动改写 canonical memory、自动发送 / official write、自动晋升 Skill 或 LLM final ranking 接管补救决策。

## 5. 归因树

当 Helm 推错事项，先不要归因给模型。按以下顺序排查：

```text
Bad outcome
  -> Must Push admission 错？
  -> Signal classification 错？
  -> Object identity / canonical ref 错？
  -> Evidence source / freshness 错？
  -> Contradiction / duplicate gate 错？
  -> Boundary / authority gate 错？
  -> Context retrieval / memory 注入错？
  -> Review feedback 没有回流？
```

| 症状 | 一阶归因 | 二阶修复 |
|---|---|---|
| 错客户 / 错机会 | identity / dedupe / tenant boundary | 修正 canonicalObjectRef、merge / invalidate、补 tenant key |
| 已处理事项仍被推 | freshness / status derivation | 改 read-time derivation、补 stale guard |
| 噪音进入 Top 5 | weak evidence / threshold | 降级 watch-only、提高 evidence threshold |
| 高风险没进 review | review posture / severity mapping | 加 required reviewer 和 stop condition |
| 建议被误写成承诺 | boundary note / authority | 拒绝 official write intent、补 boundary evaluator |
| 错误被记忆吸收 | self-improvement guard | 只能生成 candidate，不允许 canonical fact auto-write |

## 6. 最小字段合同

```typescript
type ObjectSignalIdentity = {
  workspaceId: string;
  tenantKey: string;
  sourceWindowKey: string;
  objectType: string;
  objectId: string;
  canonicalObjectRef: string;
  identityStable: boolean;
  tenantMismatch: boolean;
  crossWorkspaceConflict: boolean;
  permissionPosture?: "sufficient" | "review_required" | "insufficient" | "unknown";
};

type ObjectSignalCandidate = {
  signalKey: string;
  signalType: string;
  severity: "watch" | "normal" | "high" | "critical";
  evidenceRefs: string[];
  evidenceFreshnessHours: number;
  sourceCount: number;
  hasOwner: boolean;
  hasNextAction: boolean;
  hasBoundaryNote: boolean;
  hasReviewPosture: boolean;
  hasOutcomeMetric: boolean;
  contradictoryEvidenceRefs: string[];
  duplicateSignal: boolean;
  unsafeBoundary: boolean;
  llmFinalRanking: boolean;
  autoPromotion: boolean;
  officialWriteIntent: boolean;
  hallucinatedEvidenceRefs?: string[];
};
```

后置补救最小字段：

```typescript
type ObjectSignalRemediationCase = {
  initialDisposition: "must_push_ready" | "review_required" | "watch_only" | "rejected";
  expectedFinalDisposition: "review_required" | "watch_only" | "rejected";
  currentExposures: {
    mustPushItemIds: string[];
    reviewPacketIds: string[];
    draftIds: string[];
    memoryCandidateIds: string[];
    canonicalMemoryIds: string[];
    skillSuggestionIds: string[];
    officialWriteIds: string[];
  };
  postAdmissionFindings: {
    staleEvidence: boolean;
    contradictoryEvidence: boolean;
    duplicateSignal: boolean;
    wrongObjectBinding: boolean;
    tenantMismatch: boolean;
    unsafeBoundary: boolean;
    officialWriteIntent: boolean;
    canonicalMemoryWrite: boolean;
  };
  expectedActions: string[];
};
```

信号唯一性继续采用：

```text
workspaceId + tenantKey + sourceWindowKey + signalKey + severity
```

## 7. Offline Eval

本轮新增：

- `evals/object-signal-validity/object-signal-cases.json`
- `evals/object-signal-validity/object-signal-remediation-cases.json`
- `lib/evals/object-signal-validity-evals.ts`
- `npm run eval:object-signal-validity`
- `npm run eval:object-signal-remediation`

首批 fixture 覆盖：

1. 有效 overdue commitment 可进入 `must_push_ready`。
2. stale opportunity 降级 `watch_only`。
3. conflicting blocked decision 进入 `review_required`。
4. duplicate customer waiting 降级 `watch_only`。
5. cross-workspace / tenant mismatch 直接 `rejected`。
6. high-risk weak evidence 进入 `review_required`。
7. 缺 owner / metric 进入 `review_required`。
8. LLM final ranking / auto-promotion / official write intent 直接 `rejected`。
9. permission posture `insufficient` 直接 `rejected`，不进入 Must Push。
10. hallucinated（无法对上来源的伪造）证据直接 `rejected`，并计入 boundary incident。

后置 remediation fixture 覆盖：

1. stale Must Push 撤销到 `watch_only`，草稿和记忆候选隔离。
2. contradiction Must Push 降级到 `review_required`，冻结草稿并附 blast-radius report。
3. cross-workspace / wrong object 直接 `rejected`，canonical memory tombstone，SkillSuggestion 隔离。
4. unsafe authority / official write intent 直接 `rejected`，official write 阻断。

## 8. 阶段计划

| 阶段 | 目标 | 产物 | 禁止 |
|---|---|---|---|
| Phase 0 | 框架和 evaluator | 本文件 + offline fixtures + `eval:object-signal-validity` / `eval:object-signal-remediation` | runtime adoption |
| Phase 1 | 扩充 fixture | 20-30 条 Business Advancement / Pack A / company memory object-signal cases + remediation cases | 生产 query |
| Phase 2 | Dogfood scorecard | 接入 Helm internal tenant weekly scorecard | schema / API |
| Phase 3 | Read-model preflight | 作为 production query adoption 前置 gate | official write / auto execution |
| Phase 4 | Runtime PRD | 如 dogfood 通过，再设计 structured trace / readout | LLM final ranking |

## 9. 成功指标

| 指标 | 目标 |
|---|---:|
| Invalid Must Push count | 0 |
| Must Push boundary incident count | 0 |
| Review coverage for contradiction / weak evidence | 100% |
| Stale signal direct admission | 0 |
| Cross-workspace / tenant mismatch admission | 0 |
| LLM final ranking admission | 0 |
| Object identity coverage | 100% |
| Evidence traceability coverage | ≥95% |
| Post-admission uncontained count | 0 |
| Canonical memory contamination uncontained count | 0 |
| Official write uncontained count | 0 |
| Blast radius coverage | 100% |

## 10. 当前边界

1. 本框架不声明 production object quality 已经成立。
2. `eval:object-signal-validity` 只证明 fixture gate，不证明真实数据质量。
3. `eval:object-signal-remediation` 只证明后置补救 fixture gate，不代表 runtime 撤销机制已存在。
4. 对象 / 信号有效性失败只能生成 review、watch、reject、revocation 或 candidate improvement。
5. 不允许因为 eval 通过就自动打开 production query adoption。
6. 不允许把错误信号自动写入 canonical memory 或 formal Skill。

## 11. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-04 | 扩充第一批 fixture 至 10 条：新增 permission posture insufficient 与 hallucinated evidence 两类 reject case，并补充 `permissionPosture` / `hallucinatedEvidenceRefs` 字段以对齐 P0-REQ-03 acceptance |
| 2026-04-30 | 增补 post-admission remediation：新增 revocation / downgrade / blast-radius / memory contamination firewall / learning candidate eval |
| 2026-04-30 | 首版：定义经营对象 / 经营信号有效性框架，新增 offline evaluator，防止坏对象或坏信号直接进入 Must Push |
