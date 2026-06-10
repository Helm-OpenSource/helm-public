---
status: draft
interface_status: v0.1 unstable; public-safe reference kernel, not a stable pack/overlay API
owner: Product / Delivery Engineering / Engineering
created: 2026-06-04
review_after: 2026-06-18
public_safety: Public-safe contract and MVP spec only. No customer data, no production connector
  credentials, no automatic create/dispatch/chase/write/send/approve. Single-tenant, read-only
  detection, review-first, append-only ledger. Does not claim a cross-enterprise flywheel.
---

# Cross-System Accountability Gap MVP / 跨系统问责真空 MVP 规范 (v0.1)

> **语言 / Language**: **中文主文本** + **English reference**

## 1. 定位 / Positioning

Helm 的长期护城河命题**不是**泛泛的"企业世界模型",**也不是**跨企业 AI 飞轮;而是:

> 在 CRM、项目、邮箱、审批等**互不连通**的经营系统之上,**可信地**发现"**本应存在、却无人可问责**"的跨系统经营缺口,并把每次判断/复核/结果沉淀为**单租户、append-only、可审计**的问责台账。

v0.1 只实现 public-safe reference kernel。长期护城河是否成立,取决于后续 overlay 是否能证明
coverage、owner 和复核闭环;本文件不声明任何量化护城河结论已经成立。

**v0.1 明确不声明**:跨企业能力飞轮(仅远期期权)、跨租户、生产部署 ready、自动执行、统计显著性、churn/renewal scoring。

## 2. 范围 / Scope

### In scope
- **一个 CRM + 一个 PM/handoff 系统**(单一连接器对)。
- 一条声明式 `ExpectationRule`(首条:`won deal → N 天内应存在 delivery project / handoff record`)。
- **只读检测**:不自动建项目、不自动派单、不自动催办、不写回源系统。
- coverage 不完整 → 输出 `unknown`,**绝不输出 `missing`**。
- 命中进入 **review-first** decision request + **append-only** ledger。

### Out of scope
- churn / renewal scoring(会退化成 CRM 插件)。
- 跨租户 / 跨企业学习。
- 自动建记录、自动派单、自动催办、自动写回/外发/审批。
- LLM 作为检测引擎(检测必须确定性;见 §8)。

## 3. 标准流程 / Flow

```text
CRM trigger fact (won deal)
  -> ExpectationRule 触发期望
  -> CoverageAssertion 校验所需源系统是否"可证明完整"
       完整 -> 比对期望记录
       不完整 -> verdict = unknown(停)
  -> 期望记录缺失 -> EffectiveOwner 确定性判定(或升级角色)
  -> MissingRecordDecisionRequest(verdict=missing|unknown, advice-only, review-first)
  -> 人工 accept / reject / defer
  -> AccountabilityLedgerEntry(append-only, hash-chain, 记录 falsePositive)
```

## 4. 核心契约 / Core Contracts (public Core)

### 4.1 `ExpectationRule`(声明式、确定性;v0.1 unstable)
```ts
type CoverageRequirement = { system: string; scope: string };
type ExpectationRule = {
  ruleId: string;
  version: string;
  description: string;
  trigger: { system: string; entity: string };
  triggerSlice: { scopeRef: string };  // SourceFact.sliceRef must match this scope
  expectation: { system: string; entity: string; withinDays: number; matchKey: string }; // PM, delivery_project, 7, dealId
  expectationSlice: { scopeRef: string }; // expectation SourceFact.sliceRef must match this scope
  requiredCoverage: CoverageRequirement[]; // (system, scope) pairs that must be coverage-complete;缺一即 unknown
  ownerPolicyRef: string;              // -> EffectiveOwner 策略
  commitmentClass: "advice";
  effectMode: "read_only";
  forbiddenActions: string[];          // auto_create_record / auto_dispatch / auto_chase / auto_write_source / external_send / approval
};
```

public Core 不解析业务谓词或表达式。调用方必须先把事实确定性投影到 `SourceFact`,并用
`sliceRef` 声明该事实属于哪个 closed-world slice。Core 只处理 `system` / `entity` /
`sliceRef` 与规则匹配的 trigger facts。Expectation facts 也必须同时匹配
`expectation.system` / `expectation.entity` / `expectationSlice.scopeRef`。

`scopeRef` 与 `entity` 可以不同:例如 PM 的 `entity=delivery_project`,但可审计 closed-world
slice 是 `delivery_handoff`。public Core 不要求也不推断 `scope == entity`。

```ts
type SourceFact = {
  system: string;
  entity: string;
  sliceRef: string;
  factId: string;
  matchValue: string; // deterministic projection of matchKey; fuzzy/embedding matching is forbidden
  occurredAt: string;
};
```

`matchValue` 必须来自确定性字段映射;public Core 禁止 fuzzy match、embedding match 或 LLM
推断式 join。

### 4.2 `CoverageAssertion`(整数核心 / integrity core)
```ts
type CoverageAssertion = {
  assertionId: string;
  system: string;
  scope: string;                       // 被断言"完整"的子集
  windowStart: string; windowEnd: string;
  method: "full_export" | "webhook_plus_backfill" | "paginated_complete";
  completeness: "complete" | "partial" | "unknown";
  evidence: string[];                  // 可证明完整的凭据:期望计数 vs 摄入计数、无分页缺口、无权限盲区
  asOf: string;
};
// 硬规则:只有当 requiredCoverage 中每个 (system, scope) 在该 window 内 completeness === "complete",
// 才允许 emit "missing";否则 verdict 必为 "unknown"。闭世界假设不成立即 unknown。
// requiredCoverage.scope 必须等于对应 triggerSlice.scopeRef / expectationSlice.scopeRef;
// 更宽或更窄的同系统 coverage assertion 不能替代该 slice。
```

### 4.3 `EffectiveOwner`(确定性 + 无主升级)
```ts
type EffectiveOwner = {
  resolved: boolean;
  ownerId?: string;
  evidence?: string[];                 // 确定性链:角色指派 + 在职 tenure
  excluded: { group: boolean; defaultAdmin: boolean; bot: boolean; departed: boolean };
  fallback?: "escalation_role";        // 无确定性 owner 时,走预配置升级角色(非猜测)
  escalationRoleRef?: string;
  unresolvableReason?: string;
};
// 真空往往恰恰"从未指派 owner" -> resolved=false 是常态;此时禁止猜测,
// 必须路由到 deterministic 配置的 escalation/triage 角色,或标 unresolvable。
```

### 4.4 `MissingRecordDecisionRequest`(review-first;复用 decision-request 模式)
```ts
type MissingRecordDecisionRequest = {
  gapId: string;                       // stable across verdict changes
  requestId: string;
  ruleId: string; ruleVersion: string;
  triggerRef: string;                  // 触发事实(won deal),public-safe 别名
  verdict: "missing" | "unknown";      // coverage 不完整时只能 unknown
  coverageAssertionRefs: string[];
  effectiveOwner: EffectiveOwner;
  evidenceRefs: string[];              // 跨系统证据,public-safe 别名
  distinctSystemsDeclared: number;     // neutral declared-system count; not moat evidence
  commitmentClass: "advice";
  reviewState: "proposed" | "accepted" | "rejected" | "deferred";
  humanReviewerRequired: true;
  boundaryNote: string;
};
```

`gapId` / `requestId` 不随 `verdict` 改变;同一 trigger 从 `unknown` 变为 `missing`
是状态变化,不是新 finding。

### 4.5 `AccountabilityLedgerEntry`(单租户、append-only、可审计)
```ts
type AccountabilityLedgerEntry = {
  entryId: string;
  prevEntryHash: string;               // 哈希链 -> append-only / tamper-evident
  contentHash: string;
  requestId: string;
  decision: "accepted" | "rejected" | "deferred";
  reviewerId: string;                  // 可问责的人(public mirror 用 alias)
  reasonCode: string;                  // 复用既有 correctionReasonCode 枚举:evidence_missing / scope_wrong / owner_reviewer_wrong / stale_signal ...
  falsePositive: boolean;              // FP 率测量用(§10)
  at: string;
};
// schema 属 public Core;ledger 内容属 tenant / control-plane 私有(见 §9)。
```

## 5. CoverageAssertion 语义(最难也最关键)/ Coverage is the integrity core

"声称某记录 missing" = 闭世界假设:必须**已摄入全部**才能把"缺失"当真。跨连接器很难天然满足(分页缺口、权限盲区、归档/删除、最终一致性)。因此:
- **诚实默认是 `unknown`**;`missing` 是需被 `CoverageAssertion.complete` 证明出来的特例。
- **coverage assertion 粒度必须等于 slice 粒度**:`triggerSlice.scopeRef` /
  `expectationSlice.scopeRef` 与 `CoverageAssertion.scope` / `requiredCoverage.scope`
  必须逐项对齐。更宽、更窄或仅同名 entity 的 scope 都不能替代。
- **MVP 连接器对的选择 = 最大产品风险**:必须选 coverage **可被证明完整**的源系统对(如 CRM 完整分页导出 + PM webhook+backfill 可证零缺口)。选错连接器对,产品在接触点即判死(见红线 1)。

## 6. EffectiveOwner:无确定性 owner 是常态,不是异常

真空之所以是真空,常因**从未指派 owner**。此时严禁猜测责任人(错误指认 = 信任判死,红线 3)。行为:`resolved=false` → 路由到**预配置**的 escalation/triage 角色(deterministic),或标 `unresolvable` 进 ledger,**不得**输出某个具体人。

## 7. 边界与硬门 / Boundaries & hard gates

所有 decision request 与 ledger 写入前必须满足(任一失败 → fail-closed):
- `commitmentClass === "advice"`、`effectMode === "read_only"`、`humanReviewerRequired === true`、`boundaryNote` 存在;
- 无 `auto_create_record / auto_dispatch / auto_chase / auto_write_source / external_send / approval` 引用;
- coverage 不完整时 verdict 必为 `unknown`(不得用其他字段掩盖);
- EffectiveOwner 不得输出 group/default-admin/bot/departed 作为责任人;
- ledger `prevEntryHash` 链连续(断链即拒)。

## 8. 与既有工作的关系(复用,不孤立)/ Reuse, not orphan

- **检测引擎是确定性的**(`ExpectationRule` + `CoverageAssertion`),**不是** LLM。已合并的 expert-capability 反馈闭环在此**降级为"规则精炼层"**:reject/edit 的 `correctionReasonCode`(`evidence_missing` / `scope_wrong` / `owner_reviewer_wrong`)反哺**调 rule/coverage**,而非生成判断。
- `MissingRecordDecisionRequest` 复用 review-first / JudgementPacket 的 advice≠承诺模式与 validator 风格。
- `AccountabilityLedgerEntry` 复用既有 audit + expert-capability 引入的 `contentHash` / 哈希链 tamper-evidence 模式。
- de-id 复用 `self-tenant-health/privacy` + `EvalCasePromotion` 既有门,**不造新脱敏面**。

## 9. 仓库归属 / Repo placement(四仓边界)

| 工件 | 仓库 |
|---|---|
| 5 个契约 schema + 确定性引擎 + synthetic fixture + validator | `helm-public`(public Core) |
| 行业通用 `ExpectationRule` 规则集(可盲验) | `helm-packs` |
| 客户私有规则 / 连接器配置 / owner 策略 | `helm-overlays` |
| 真实 ledger 内容、真实运行、consent、coverage 运行数据 | `helm-control-plane` / tenant(私有) |
| 旧 monorepo | `helm2026`(仅参考) |

当前线程(helm-public)可做契约 / 引擎 / synthetic;真实运行接线在各 owning repo 的 worktree+branch。

## 10. 度量 / Metrics(从 day-1 instrument,用于验证红线)

- **`distinctSystemsDeclared`** = 规则声明中涉及的不同系统数。它是中性结构字段,**不是**
  "该缺口必须跨系统才能发现"的护城河证据。
- **`falsePositiveRate`** = ledger 中 `falsePositive === true` / 总命中(红线 3;按 decision disposition 标注;**小样本不下阈值结论**,需足量标注)。
- **`newGapArrivalRate`** = 清完历史欠账后,每租户每月**净新增**跨系统真空(红线 2;必须 day-1 埋点,否则只能事后才发现退化为一次性审计)。

真实 `singleSystemDetectable=true/false` 与跨系统必要性占比只能由 overlay 审计产生;public Core
不得自行推导或对外声明。若后续 public Core 需要暴露该字段,唯一允许值是 `unknown`。

## 11. 判死红线 / Kill-lines

1. 多数客户源系统无法证明 coverage 完整 → Helm 只能 `unknown` → **产品判死**。
2. 清完历史欠账后月增真空很少 → 常驻 SaaS 判死,最多一次性审计。
3. false positive 长期 >20%(尤其错误指认责任人)→ 信任判死。

## 12. Overlay-only 证据 / Evidence reserved for overlays

以下证据**不由 public Core 指标产生**,只能由后续 overlay 审计 / owner review / pack
盲验给出:

1. ≥3 客户中,overlay 审计证明相当比例的真实缺口不是任一单系统可独立发现。
2. 足量样本下跨客户 FP 达到 owner 批准阈值,客户持续把 ledger 当复核依据。
3. ≥1 pack 通过**第二客户盲验**,证明规则不是首客户私有流程。

## 13. Validator / CI 要求 / Validator and CI requirements

| Validator | 必拒 / Must reject |
|---|---|
| `ExpectationRule` | 缺 requiredCoverage、含 forbiddenActions、effectMode ≠ read_only |
| `Coverage grain` | requiredCoverage 未覆盖 triggerSlice / expectationSlice,或用非 slice 粒度 scope 偷换 |
| `CoverageAssertion` | completeness 非 complete 却用于 emit missing |
| `DecisionRequest` | coverage 不全却 verdict=missing、缺 boundaryNote、非 advice、无人审、含 auto-* |
| `EffectiveOwner` | 输出 group/default-admin/bot/departed、无主却给具体人 |
| `LedgerEntry` | prevEntryHash 断链、contentHash 不符、缺 falsePositive 标注 |

## 14. 成功标准 / MVP acceptance

1. 单 CRM+PM 连接器对,coverage **可被 CoverageAssertion 证明完整**;否则全程 `unknown`。
2. 首条 `ExpectationRule`(won deal → delivery/handoff)在 synthetic fixture 与至少 1 个真实试点上跑通,**无自动动作**。
3. 命中全部经 review-first + append-only ledger;FP 按 §10 可测。
4. 硬门全部 fail-closed(§7 / §13)。
5. 文档只声明"跨系统问责真空的可信指认",不声明跨企业飞轮 / 生产 ready。

## 15. 实现切片 / Implementation slice

1. public Core:5 契约 TS + JSON synthetic fixture(含一个 coverage=partial → unknown 反例、一个无主 → escalation 反例、一个 boundary-trap)。
2. 确定性引擎:rule 评估 + coverage 门 + owner 判定(纯函数、离线、无连接器)。
3. validator + vitest(覆盖 §13 全部必拒)。
4. 度量骨架:FP 与 new-gap rate 的离线计算;declared-system count 仅作中性结构字段。
5. 文档接 public-safe 检查;真实连接器接线另起 control-plane / overlays 任务。

## 16. Public-safe 文案 / Public-safe statements

> Helm helps teams find operating handoffs that fall between systems: work that should exist,
> should have an accountable owner, but is missing or unresolved — then routes it for human
> review with auditable evidence.
>
> Helm 帮企业发现跨系统之间"本该有人负责、却被漏掉"的经营事项,并以可复核证据交回团队判断。

**Internal / owner**:我们卖的不是 agent 自动化,而是跨系统问责真空的可信指认;长期护城河成败押在
coverage assertion、effective-owner 判定、复核后的 FP 证据、append-only 问责台账,而非跨企业数据飞轮。

## 17. 实现前待定 / Open decisions

- 首个 MVP 选哪对连接器使 `CoverageAssertion` **可满足**?(最大风险点)
- escalation/triage 角色如何 deterministic 配置(避免猜测责任人)?
- ledger 哈希链锚定:签名 / append-only store / 外部时间戳?
- FP 标注的最小样本量门槛(避免小 n 误判阈值)?
- 多 expectation slice / 多 trigger slice 的规则如何表达,同时保持 public Core 仍 predicate-blind?

## English Reference

This v0.1 unstable public kernel narrows Helm's long-term product thesis to a falsifiable core: reliably detecting cross-system
accountability gaps — work that should exist and should have an accountable owner but is
missing/unresolved across disconnected systems (CRM, PM, email, approvals) — and recording
every judgement, review, and outcome in a single-tenant, append-only, auditable ledger.
Detection is deterministic (`ExpectationRule` + `CoverageAssertion`), not AI-synthesised.
Coverage is the integrity core: if completeness cannot be proven, the verdict is `unknown`,
never `missing`. Owners are resolved deterministically; an unassigned gap routes to a
configured escalation role, never a guessed person. Everything is read-only, review-first,
advice-only — no auto-create, dispatch, chase, write-back, send, or approval. The Core is
predicate-blind: callers must provide deterministic `SourceFact.sliceRef` and `matchValue`,
and the Core performs no fuzzy, embedding, or LLM-based joins. `scopeRef` may differ from
`entity`; coverage assertions must prove the exact trigger and expectation slices, not a
broader, narrower, or entity-named substitute.
Passing this MVP proves a bounded public-safe reference kernel, not a stable pack/overlay API,
not a cross-enterprise flywheel, and not production readiness. Kill-lines are explicit;
cross-system necessity evidence must come from later overlay audits, not from the public
Core's declared system count.

## 变更记录 / Change Log

| Date | Change |
|---|---|
| 2026-06-04 | Drafted Cross-System Accountability Gap MVP spec (narrowed thesis, 5 contracts, coverage-integrity core, kill-lines, overlay-only evidence) |
