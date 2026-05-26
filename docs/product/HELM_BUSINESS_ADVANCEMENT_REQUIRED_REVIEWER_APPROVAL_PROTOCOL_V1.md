---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Required Reviewer Approval Protocol V1

状态：Planning-only approval protocol / runtime adoption No-Go

更新时间：2026-04-27

上游：

- [HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PRODUCTION_QUERY_ADOPTION_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PRODUCTION_QUERY_ADOPTION_PLAN_V1.md)

## 1. 结论

Required reviewer approval 不是一个布尔值。

它必须是一份可审计 approval record：记录谁、以什么 canonical role、基于哪个 plan version、在什么 capability proof 下、做出什么 decision、留下什么 risk notes。

没有完整 approval record，Business Advancement 不能进入 production query adoption，也不能把 runtime adoption gate 从 No-Go 推到 Ready-For-Manual-Review。

OPC / founder-led 阶段的执行方式见 [HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md](./HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md)。该协议不取消本文件的 evidence gate；它只规定在 startup 资源未齐时，5 个 canonical roles 先作为 5 个强制评审视角运行，由 founder 做最终决策。涉及真实客户数据、public trial、隐私、安全、公开 claim 或 official write 时，仍必须升级到独立 reviewer 或保持 No-Go。

## 1.1 OPC Founder-Led Overlay

Helm 当前仍处于 startup / OPC 阶段。为了避免“5 个真人 reviewer 未齐”阻断所有内部推进，本协议允许以下分层：

| Decision class | 是否需要 5 个真人 reviewer | 是否可由 founder 最终拍板 | 是否允许 production adoption |
| --- | --- | --- | --- |
| Founder Self-Approve | 否；Codex 必须覆盖 5 个评审视角 | 是 | 否 |
| Founder Approval + Evidence Gate | 否；但必须有结构化 evidence、rollback、boundary check | 是 | 否，最多到 disabled / allowlist-ready / manual review |
| Independent Review Required | 是；或至少引入对应安全 / 隐私 / 法务 / 外部专业 review | 是，作为最终 DRI | 仍需单独 release / runtime approval |

在 OPC overlay 下，`approvedByRequiredReviewers` 不能被 loose boolean 替代。机器 gate 仍只能消费可审计 summary；Founder approval 只代表 owner 接受当前证据包，不代表绕过 redacted live evidence、privacy review 或 production query adoption gate。

### 1.2 Internal Build vs Production Adoption

以下工作可以走 founder-led packet：

1. planning docs、decision packet、review response。
2. synthetic / offline eval。
3. disabled-by-default scaffold。
4. reserved tenant internal dogfooding 前的 implementation。
5. allowlist-ready 但默认关闭的 runtime seam。

以下工作不能只靠 founder-led self-approval：

1. 真实客户数据进入 production query adoption。
2. public trial 数据 retention / deletion / export 策略正式开放。
3. customer-facing claim、ROI、公开案例或销售强承诺。
4. official write、auto-send、approval、settlement、payment。
5. credential leak response 或 security disclosure。

## 2. Canonical Reviewer Roles

Business Advancement production query adoption 使用 Phase 3S 的 canonical roles：

| Canonical role | 职责 |
| --- | --- |
| Engineering Lead | 查询 seam、rollback、disable、observability、implementation feasibility |
| Product Owner | 产品边界、Must Push 体验、用户价值与非目标 |
| Security Reviewer | membership、capability、object-read、official write、execution boundary |
| Operations Lead | reviewer capacity、incident handling、pilot rollout、rollback owner |
| Data Protection Officer | redaction、PII、reserved tenant、export、deletion、retention |

允许 UI 或团队口径使用 alias，但 approval record 必须落到 canonical role：

| Alias | Canonical role |
| --- | --- |
| Data Protection Reviewer | Data Protection Officer |
| Operations Reviewer | Operations Lead |

## 3. Approval Record Contract

```ts
interface ProductionQueryReviewerApprovalRecord {
  approvalRecordId: string;
  planId: string;
  planVersion: string;
  reviewMeetingHeld: boolean;
  governanceSignoffObtained: boolean;
  approvals: Array<{
    role:
      | "Engineering Lead"
      | "Product Owner"
      | "Security Reviewer"
      | "Operations Lead"
      | "Data Protection Officer";
    reviewerUserId: string;
    approvedPlanVersion: string;
    decision: "approved" | "conditional" | "rejected";
    capabilityProof: {
      workspaceMembershipConfirmed: boolean;
      reviewerCapabilityConfirmed: boolean;
      noConflictDeclared: boolean;
    };
    riskNotes: string;
    signedAtIso: string;
  }>;
}
```

## 4. Approval Semantics

| Decision | 是否满足 required reviewer approval | 说明 |
| --- | --- | --- |
| `approved` | 是 | 仅当所有 canonical roles 都 approved 同一个 planVersion |
| `conditional` | 否 | 视为未批准；必须先消除条件并重新签署 |
| `rejected` | 否 | 计划不能进入 runtime adoption review |

即便所有 reviewer 都 `approved`，结论仍然只是：

```ts
approvalGateDecision = "Ready-For-Manual-Review";
productionAdoptionAllowed = false;
runtimeIntegrationAllowed = false;
```

Reviewer approval 不能替代 redacted real-data calibration。若 Ask Helm interaction actual live evidence 或 production query `redacted_live_db_snapshot` 缺失，approval record 即使形式完整，也不能解除 runtime adoption No-Go。

## 5. Required Checks

Approval record 必须满足：

1. `approvalRecordId` 非空。
2. `planId` 与 Production Query Adoption Plan 一致。
3. `planVersion` 与每条 approval 的 `approvedPlanVersion` 一致。
4. plan 中记录 redacted real-data calibration 状态。
5. review meeting 已召开。
6. governance signoff 已获得。
7. 五个 canonical roles 均有且只有一条 approval。
8. 所有 approval decision 都是 `approved`。
9. 每条 approval 都有 reviewer user id。
10. 每条 approval 都确认 workspace membership、reviewer capability、no conflict。
11. 每条 approval 都有 risk notes 和 strict UTC ISO timestamp（例如 `2026-04-27T00:00:00.000Z`）。

## 6. Invalid Approval Conditions

出现以下任一情况，approval record 无效：

- 缺任一 canonical role。
- role 重复签署。
- reviewer 只给 conditional approval。
- approved plan version 与当前 plan version 不一致。
- plan version 改动后复用旧 approval。
- 没有 risk notes。
- `signedAtIso` 不是 strict UTC ISO timestamp。
- 没有 capability proof。
- 没有 review meeting 或 governance signoff。
- 试图把 approval record 写成 production deployment approval。

## 7. Capability Requirements

Reviewer approval 不等于全局角色授权。每个 reviewer 必须证明：

| Proof | 要求 |
| --- | --- |
| Workspace membership | reviewer 当前属于目标 workspace 或具备正式评审授权 |
| Reviewer capability | reviewer 对应 role 具备该类 review capability |
| No conflict | reviewer 未声明利益冲突或执行责任冲突 |
| Plan version | reviewer 审批的是同一份 immutable plan version |

## 8. Audit Requirements

Approval record 必须可用于审计：

| 字段 | 用途 |
| --- | --- |
| `approvalRecordId` | 定位审批记录 |
| `planId / planVersion` | 防止审批漂移 |
| `role / reviewerUserId` | 证明谁以什么职责批准 |
| `decision` | 区分 approved / conditional / rejected |
| `capabilityProof` | 证明不是越权评审 |
| `riskNotes` | 保留风险承认与边界说明 |
| `signedAtIso` | 证明审批时间；必须是 strict UTC ISO timestamp |

## 9. Revocation Rules

以下情况必须重新审批：

1. planVersion 变化。
2. target query seam 增删或目标文件变化。
3. maxTake、排序规则、field allowlist / denylist 变化。
4. membership、capability、object-read 或 reserved tenant 边界变化。
5. rollout stage 从 `planning` 进入 `shadow`、`pilot_allowlist` 或 surface。
6. Phase 3R / Phase 3S 证据被撤回或发现污染。

## 10. Gate Output

approval protocol 的机器可消费输出为：

```ts
interface ProductionQueryAdoptionRequestSummary {
  requested: boolean;
  approvedByRequiredReviewers: boolean;
  implementationPlanPresent: boolean;
  approvalGateRuleVersion: "production-query-adoption-approval-gate/v1";
  approvalGateDecision: "No-Go" | "Ready-For-Manual-Review";
}
```

Ask Helm runtime adoption gate 只能消费这个 summary，不能只消费 loose boolean。

## 11. 当前状态

已经完整成立：

| 项 | 状态 |
| --- | --- |
| Canonical reviewer roles | 已统一 |
| Approval record schema | 已冻结 |
| Pure evaluator / CLI / tests | 已落库 |
| Ask Helm runtime gate summary 接入 | 已落库 |

已成形但仍需下一层：

| 项 | 下一步 |
| --- | --- |
| 真实 reviewer approval | 需要人工会议与真实 reviewer 签署 |
| 持久化 approval record | 仍未批准 schema/API，不做持久化 |
| 生产 query implementation | 仍未批准 |

刻意未做：

| 项 | 原因 |
| --- | --- |
| DB-backed approval store | runtime adoption 仍 No-Go |
| UI approval workflow | 本阶段只冻结协议 |
| 自动根据 approval 执行接入 | Helm 保持 review-first，不自动扩权 |

风险项：

| 风险 | 控制 |
| --- | --- |
| approval 被误读为 Go | evaluator 固定 `productionAdoptionAllowed=false` |
| alias 造成职责漂移 | record 必须使用 canonical role |
| plan 修改后旧审批复用 | planVersion mismatch 直接阻断 |
