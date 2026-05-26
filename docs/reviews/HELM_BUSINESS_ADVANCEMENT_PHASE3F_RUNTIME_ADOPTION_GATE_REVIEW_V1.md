---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3F Runtime Adoption Gate Review V1

更新时间：2026-04-26
状态：Runtime adoption gate reviewed / 不批准 runtime adoption / 条件批准 source-query evidence audit

---

## 结论

Phase 3F 的结论是：**不批准 Business Advancement thin adapter 进入 runtime adoption**。

Phase 3E 已证明 pure planning adapter 可以成立，但当前 repo truth 还不能证明三条 candidate family 已具备安全的真实 source-query 接入条件。下一步只能进入 **Phase 3G Source-Query Evidence Audit**，继续只做评审与证据采集，不写 runtime code。

继续 No-Go：

- runtime adapter 接入
- `data/queries.ts` production query adoption
- `features/mobile/lib/mobile-command-read-model.ts` 接入
- dashboard / operating / mobile UI 行为变化
- Prisma schema 变更
- API route
- runtime extractor / event queue / background job
- official write / outbound send / automated execution
- LLM final ranking

---

## 一、Gate Findings

| Finding | 严重程度 | 结论 |
| --- | --- | --- |
| TPQR-001 当前 repo 有 `ApprovalTask` / `ActionItem` workspace scope，但现有 mobile `loadPendingApprovals` 读取的是已经存在的 pending approval task，不是 Phase 3B 定义的 “no approvalTask yet but blocked beyond threshold” source | 高 | Runtime adoption No-Go；需要 source-query evidence audit |
| TPQR-003 当前 `getCommitments` 已按 workspace 读取，并在 return map 中 read-time derive `overdueFlag`，但 helper 使用 `Date.now()`，不是 adapter 要求的 explicit `referenceClockMs` | 高 | Runtime adoption No-Go；需要确认未来 source query 如何注入 reference clock 或隔离 Date.now |
| TPQR-004 当前 mobile `loadWaitingEmailThreads` 已按 `workspaceId` + `WAITING_US` 读取 generic waiting threads，但没有 TPQR-004 CRM-linked producer，也没有 after-producer `emailThreadId` dedup runtime source | 高 | Runtime adoption No-Go；需要 source-query evidence audit |
| Phase 3E adapter candidate 默认 disabled，且仍使用 synthetic source rows | 中 | 不能作为 runtime source truth |
| Phase 3E 的 threshold 均为 `calibration_placeholder` | 高 | 不能生产化 |

---

## 二、Repo Truth 校准

### TPQR-001 / Blocked Decision

已确认事实：

- `prisma/schema.prisma` 中 `ActionItem.workspaceId` 为非空 workspace scope。
- `ActionItem.approvalTask` 为可选 relation。
- `features/mobile/lib/mobile-command-read-model.ts` 已有 `loadPendingApprovals(workspaceId)`，查询 `db.approvalTask.findMany({ where: { workspaceId, status: "PENDING" } })`。

不足：

- `loadPendingApprovals` 读取的是已经进入 approval queue 的 task。
- Phase 3B / Phase 3E 的 blocked decision candidate 要求识别需要 review 但尚未进入对应 approval/review state 的阻塞行，且 48h threshold 仍是 calibration placeholder。
- 因此不能把现有 `loadPendingApprovals` 直接当作 TPQR-001 runtime source。

结论：

TPQR-001 只能进入 source-query evidence audit，不能进入 runtime adoption。

### TPQR-003 / Overdue Commitment

已确认事实：

- `lib/memory/commitment.service.ts` 的 `getCommitments` 使用 `workspaceId` 查询 commitment rows。
- `getCommitments` 返回时调用 `deriveOverdueFlag(row)`，不是直接返回 persisted column。
- `lib/memory/shared.ts` 中 `deriveOverdueFlag` 通过 `deriveCommitmentStatus` 做 read-time derivation。
- `prisma/schema.prisma` 里 `Commitment.dueDate` 与 `Commitment.overdueFlag` 均存在，且 `workspaceId` 有索引。

不足：

- `deriveCommitmentStatus` 当前使用 `Date.now()`，而 Phase 3E adapter 要求 explicit `referenceClockMs`。
- Phase 3E candidate 不允许把 persisted `Commitment.overdueFlag` 作为 inclusion authority。
- 当前还没有单独证明未来 source query 可以用 `dueDate < referenceClock AND status NOT IN terminal` 且不暴露 persisted flag。

结论：

TPQR-003 只能进入 source-query evidence audit，不能进入 runtime adoption。

### TPQR-004 / Customer Waiting

已确认事实：

- `features/mobile/lib/mobile-command-read-model.ts` 已有 `loadWaitingEmailThreads(workspaceId)`。
- 该 query 使用 `where: { workspaceId, status: "WAITING_US" }`。
- `EmailThread` schema 有 `workspaceId`、nullable `opportunityId` 和 `opportunity` relation。

不足：

- 现有 `loadWaitingEmailThreads` 是 generic waiting-thread producer。
- Phase 3E 要求 TPQR-004 CRM-linked producer 与 generic producer 先各自构建 candidate，再按 `emailThreadId` after-producer dedup。
- 当前 repo 未证明 CRM-linked producer 的 query shape 与 generic producer 的 merge/dedup runtime seam。

结论：

TPQR-004 只能进入 source-query evidence audit，不能进入 runtime adoption。

---

## 三、Runtime Adoption Decision Matrix

| Family | Current repo evidence | Blocking gap | Phase 3F decision |
| --- | --- | --- | --- |
| TPQR-001 / `blocked_decision` | `ApprovalTask` 与 `ActionItem` 有 workspace scope；mobile 有 pending approvals read model | Existing source reads already-pending approvals, not “blocked beyond threshold before review task” | No-Go |
| TPQR-003 / `overdue_commitment` | `getCommitments` workspace-scoped；return path read-time derives overdue | Current helper uses `Date.now()`；future source query must prove explicit clock and no persisted-flag authority | No-Go |
| TPQR-004 / `customer_waiting` | Existing generic waiting-thread source is workspace-scoped | Missing TPQR-004 CRM-linked producer and after-producer dedup runtime seam | No-Go |
| TPQR-002 / `stalled_opportunity` | Prior Phase 3A audit found system sync can bump `Opportunity.updatedAt` | Human inactivity source not proven | No-Go |
| TPQR-005 / `tenant_resource stalled_case` | Prior Phase 3A design only proves evidence freshness | Human inactivity semantics not proven | No-Go |

---

## 四、Allowed Next Work

下一步唯一允许的是：

`docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3G_SOURCE_QUERY_EVIDENCE_AUDIT_V1.md`

Phase 3G 仍然只做 evidence audit，不写 runtime code。必须回答：

1. TPQR-001 是否存在安全的 read-only query source，可以表达 action item blocked beyond threshold without already being in review。
2. TPQR-003 是否可以用 explicit reference clock 做 read-time `dueDate/status` source query，并完全绕开 persisted overdue flag authority。
3. TPQR-004 是否可以定义 CRM-linked producer 与 generic producer 的 merge/dedup source boundary。
4. 三条 source 是否都继承 workspace membership / capability，而不是在 adapter 内重造权限。
5. 三条 source 是否可以通过 feature flag / family disable switch 完整关闭。
6. 三条 source 是否能提供 audit bundle：source row、rule version、threshold status、exclusion reason。

Phase 3G 不允许：

- 修改 `data/queries.ts`
- 修改 `features/mobile/lib/mobile-command-read-model.ts`
- 修改 `app/` 或 `app/api/`
- 修改 `prisma/schema.prisma`
- 新增 runtime extractor
- 新增 event queue / background job
- 新增 official write / outbound send / automated execution

---

## 五、进入 Runtime 的最低门槛

Phase 3G 完成后，若仍要申请 runtime adoption，最低门槛是：

| Gate | 要求 |
| --- | --- |
| Source-query gate | 每条 family 有明确 query source、where clause、workspace scope 与 exclusion reason |
| Permission gate | 每条 source 证明继承现有 workspace membership / capability，不扩大对象可见性 |
| Clock gate | TPQR-003 不使用隐式 `Date.now()` 作为不可测试 runtime truth |
| Threshold gate | TPQR-001 / TPQR-004 threshold 不再只是 synthetic placeholder，或明确以 conservative default gate 进入 |
| Dedup gate | TPQR-004 CRM-linked 与 generic producer 有明确 after-producer merge/dedup seam |
| Disable gate | 每条 family 可通过开关独立关闭 |
| Audit gate | 每条 candidate 与 excluded row 可追踪 source row、rule version、threshold status |
| Surface gate | runtime adoption 不自动等于 mobile/dashboard/operating 展示，展示仍需单独 review |

---

## 六、当前决策

当前决策：

- Phase 3F runtime adoption gate：**Complete**
- Runtime adoption：**No-Go**
- Source-query evidence audit：**Conditional-Go**
- Schema / API / UI / mobile read-model / production query adoption：**No-Go**
- Official write / automated execution / LLM final ranking：**No-Go**

这批需求到 Phase 3F 为止已经形成完整的 review-first 收口：需求冻结、planning artifacts、runtime entry review、thin adapter plan、pure adapter implementation、runtime adoption gate 均已具备明确文档和验证边界。下一批如果继续，应从 Phase 3G source-query evidence audit 开始，而不是直接写 runtime。
