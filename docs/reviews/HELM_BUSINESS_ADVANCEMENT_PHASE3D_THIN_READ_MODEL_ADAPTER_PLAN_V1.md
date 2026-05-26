---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3D Thin Read-Model Adapter Plan V1

更新时间：2026-04-26
状态：Planning-only adapter plan / 不批准 runtime implementation / 不批准 schema、API、UI、mobile read-model 或 production query 接入

---

## 结论

Phase 3D 将 Phase 3C 批准的范围转成一个 thin read-model adapter plan。结论是：

- 可以规划一个 **read-only / deterministic / disable-ready / audit-ready** 的 thin adapter。
- adapter plan 只覆盖 TPQR-001、TPQR-003、TPQR-004。
- adapter plan 不包含 runtime code，不修改任何生产查询，不修改 mobile surface。
- adapter plan 的下一步如果要实现，必须另起 Phase 3E implementation approval。

本阶段继续 No-Go：

- TPQR-002 / `stalled_opportunity`
- TPQR-005 / `tenant_resource stalled_case`
- Prisma schema 变更
- API route
- dashboard / mobile / operating UI 接入
- `data/queries.ts` 生产查询接入
- `features/mobile/lib/mobile-command-read-model.ts` 修改
- runtime extractor / event queue / background job
- official write / outbound send / automated execution
- LLM final ranking

---

## 一、目标

Phase 3D 只回答一个问题：

如果未来获批实现，一个 thin read-model adapter 应该如何把已验证的 planning artifacts 转成 runtime 前的只读候选计划，同时不突破 Helm 的 review-first / read-first / recommendation-safe 边界。

它不回答：

- 生产查询怎么写。
- 页面怎么展示。
- mobile Must Push 怎么接入。
- 是否允许自动执行。
- 是否允许写入经营记忆、审批、客户消息或外部系统。

---

## 二、Adapter Boundary Contract

未来 adapter 如果进入实现，必须遵守以下边界 contract：

| Contract | 要求 |
| --- | --- |
| Read-only | 只读取已存在 read model 或已存在 DB row；不得写 DB、不得调用外部系统、不得触发 webhook |
| Workspace-first | 输入必须包含当前 `workspaceId`，且所有 source rows 必须先被 workspace / membership 范围约束 |
| No new authority | adapter 只产生 candidate，不产生 approval、commitment、send、settlement、official write 或 execution |
| Deterministic | 排序、dedup、排除原因必须由确定性规则产生；LLM 不参与最终排序 |
| Review posture | 高风险 candidate 默认 `review_required`，不能被 adapter 降级为可直接执行 |
| Boundary text | 高风险 candidate 必须保留 `recommendation != commitment`、`explanation != approval`、`draft != send`、`proof != external write success` |
| Disable-ready | 每个 candidate family 必须可单独禁用；禁用后不影响既有 Helm read-model 行为 |
| Audit-ready | 输出必须能追踪 source row、decision rule、exclusion reason、threshold version、validator result |

---

## 三、允许的 Candidate Families

### TPQR-001 / Blocked Decision

允许进入 adapter plan 的语义：

- source family：meeting / action item / approval-review adjacency
- signal：`blocked_decision`
- planning threshold：48h 仅作为 calibration placeholder
- review posture：`review_required`
- allowed primary action：进入 review / approval / operating detail，不自动审批

必须保留的不变量：

- `ActionItem.workspaceId` 或等价 workspace scope 必须先被确认。
- 已经进入 approval / review 的行必须排除，不能重复生成 Must Push。
- 48h 不能直接写成 production threshold；Phase 3E 前必须有真实数据校准或 explicit conservative default。
- candidate 只能建议“去复核 / 去确认”，不能写成“已批准 / 已完成 / 已承诺”。

### TPQR-003 / Overdue Commitment

允许进入 adapter plan 的语义：

- source family：commitment / dueDate / status / optional opportunity anchor
- signal：`overdue_commitment`
- threshold rule：`dueDate < referenceClock AND status NOT IN ('FULFILLED','CANCELED')`
- review posture：`review_required`
- allowed primary action：进入 commitment / opportunity review，不自动更新 commitment 状态

必须保留的不变量：

- persisted `Commitment.overdueFlag` 不得作为 inclusion authority。
- candidate shape 不得暴露或依赖 persisted `overdueFlag`。
- `dueDate` 缺失必须排除或降级，不能被推断为 overdue。
- terminal status 必须排除。
- reference clock 必须显式注入，不能在 helper 内部隐式调用 `Date.now()`。

### TPQR-004 / Customer Waiting

允许进入 adapter plan 的语义：

- source family：email thread / CRM-linked opportunity / existing waiting-thread read model
- signal：`customer_waiting`
- planning threshold：24h 仅作为 calibration placeholder
- review posture：`review_required`
- allowed primary action：进入 inbox / opportunity / review detail，不自动发送客户消息

必须保留的不变量：

- 必须先构建 producer candidates，再按 `emailThreadId` merge / dedup。
- dedup ownership rule 必须是 `merge_and_dedup_by_email_thread_id_after_producers`。
- tie-break 必须是 `tpqr004_crm_linked` 优先于 `loadWaitingEmailThreads_generic`。
- 最终 candidate list 中同一个 `emailThreadId` 只能出现一次。
- 24h 不能直接写成 production threshold；Phase 3E 前必须有真实数据校准或 explicit conservative default。

---

## 四、禁止进入 Adapter Plan 的 Families

| TPQR | 禁止原因 | 解除条件 |
| --- | --- | --- |
| TPQR-002 / `stalled_opportunity` | `Opportunity.updatedAt` 会被系统同步和 connector writer bump，不能代表 human inactivity | 替换为明确的 human activity source，例如 human-owned note / stage movement / customer reply / owner action；或显式标注为 sync-safe staleness source |
| TPQR-005 / `tenant_resource stalled_case` | 当前 `derivedStaleDays` 只能证明 evidence freshness，不证明 human inactivity | 产品 / 治理显式把语义降级为 evidence-freshness-only，并另行评审是否可进入 Must Push |

---

## 五、Proposed Adapter Shape

以下为未来 Phase 3E 可评审的 conceptual shape，不是本阶段实现：

```ts
interface ThinReadModelAdapterInput {
  workspaceId: string;
  referenceClockMs: number;
  enabledFamilies: {
    blockedDecision: boolean;
    overdueCommitment: boolean;
    customerWaiting: boolean;
  };
}

interface ThinReadModelAdapterCandidate {
  family: "blocked_decision" | "overdue_commitment" | "customer_waiting";
  sourceRowId: string;
  workspaceId: string;
  itemId: string;
  title: string;
  reason: string;
  evidenceRefs: readonly string[];
  reviewPosture: "review_required";
  primaryAction: {
    label: string;
    target: string;
    verb: "open" | "review";
  };
  boundaryNote: string;
  sortKey: number;
  audit: {
    tpqrId: "TPQR-001" | "TPQR-003" | "TPQR-004";
    preflightId: "PF3-001" | "PF3A-003" | "PF3A-004";
    ruleVersion: string;
    thresholdStatus: "calibration_placeholder" | "calibrated";
    exclusionReason?: string;
  };
}
```

Hard constraints:

- `enabledFamilies` must default to disabled until runtime approval.
- `referenceClockMs` must be injected.
- `reviewPosture` must not be widened below `review_required`.
- `primaryAction.verb` must not include send / approve / write / execute.
- `audit.thresholdStatus` must be `calibration_placeholder` until real-data review approves otherwise.

---

## 六、Pipeline Plan

未来 adapter 的 pipeline 必须按以下顺序设计：

1. Scope input：接收 `workspaceId`、explicit `referenceClockMs`、enabled family list。
2. Source read：从已存在 read model 或已存在 read-only query source 获得 source rows。
3. Membership / capability inheritance：继承上游 source 的 workspace / membership / capability gate，不在 adapter 中绕过。
4. Family normalization：把 TPQR-001 / TPQR-003 / TPQR-004 source rows 归一成 candidate family rows。
5. Family validation：按每个 TPQR 的 inclusion / exclusion rule 过滤。
6. Cross-producer merge：仅 TPQR-004 需要 after-producer `emailThreadId` dedup。
7. Boundary injection：为高风险 candidate 注入边界说明。
8. Deterministic ordering：按 family-specific sort + stable tie-break 排序。
9. Audit bundle：输出 source row、rule version、threshold status、exclusion reason。
10. No write：adapter 输出停在 candidate batch，不触发任何 DB / API / UI / outbound side effect。

---

## 七、Validation Matrix For Phase 3E

Phase 3E 若申请实现，必须先满足以下验证设计：

| Check | 验证目标 |
| --- | --- |
| Scope check | 只包含 TPQR-001 / TPQR-003 / TPQR-004 |
| No-Go check | TPQR-002 / TPQR-005 不在 adapter source family 中 |
| No write check | 无 DB write、无 API route、无 external call、无 event queue |
| Workspace check | 所有 candidate 保留 workspace scope，并继承 membership / capability gate |
| Boundary check | 高风险 candidate 含四类 boundary distinctions |
| Overdue authority check | persisted `overdueFlag` 翻转不改变 TPQR-003 inclusion |
| Customer waiting dedup check | 最终 candidate list 中无重复 `emailThreadId` |
| Determinism check | 输入顺序反转后输出排序稳定 |
| Disable check | 任一 family disabled 后不输出对应 candidate |
| Audit check | 每个 candidate 可追溯 TPQR / preflight / sourceRowId / ruleVersion / thresholdStatus |

---

## 八、Phase 3E Implementation Work Order

Phase 3D 不批准实现。若用户明确批准 Phase 3E，建议最小工作单如下：

1. 只新增一个 planning/test artifact，不接 production runtime。
2. 文件边界优先放在 `features/business-advancement/`，不得修改 `data/queries.ts`、`app/`、`app/api/`、`features/mobile/lib/mobile-command-read-model.ts` 或 `prisma/schema.prisma`。
3. 先写 tests：scope、No-Go、no-write、workspace、boundary、overdue authority、dedup、determinism、disable、audit。
4. 再写 pure adapter over synthetic source rows。
5. 再写 CLI evaluator。
6. 最后写 implementation report 和索引。

Phase 3E 仍然不是 runtime adoption。它最多证明 thin adapter 的 pure planning implementation 可行。

---

## 九、剩余风险

| 风险 | 处理 |
| --- | --- |
| Adapter plan 被误读为 runtime approval | 状态行与结论明确 runtime implementation No-Go |
| 生产查询被提前接入 | Phase 3E work order 明确不得修改 `data/queries.ts`、`app/`、`app/api/`、mobile read-model 或 schema |
| Threshold 没有真实数据校准 | 所有 threshold 均标注 `calibration_placeholder` |
| Permission inheritance 表达不足 | Phase 3E 必须证明 source rows 已经过 workspace / membership / capability gate |
| Customer waiting 与现有 mobile read model 重复 | 必须保留 TPQR-004 after-producer dedup ownership rule |
| Overdue commitment 误用 persisted flag | candidate shape 禁止暴露 persisted `overdueFlag`，tests 必须证明翻转不改变 inclusion |

---

## 十、当前决策

当前决策：

- Phase 3D adapter plan：**Complete once this document is accepted**
- Phase 3E pure planning adapter implementation：**Conditional-Go only if user explicitly approves**
- Runtime implementation：**No-Go**
- Schema / API / UI / mobile read-model / production query adoption：**No-Go**
- Official write / automated execution / LLM final ranking：**No-Go**

下一步建议：等待用户确认是否进入 Phase 3E。未经确认，不继续写 adapter code。
