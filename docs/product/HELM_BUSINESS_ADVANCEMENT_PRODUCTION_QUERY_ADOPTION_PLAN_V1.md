---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Production Query Adoption Plan V1

状态：Planning-only requirements / runtime adoption No-Go

更新时间：2026-04-27

上游：

- [HELM_BUSINESS_ADVANCEMENT_PHASE3R_RUNTIME_ADOPTION_PREFLIGHT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3R_RUNTIME_ADOPTION_PREFLIGHT_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3S_RUNTIME_ADOPTION_REVIEW_PACKET_V1.md)
- [HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md)

## 1. 结论

Production query adoption plan 是 Business Advancement 进入任何生产查询路径前必须存在的独立实施计划。

它不是 runtime adoption，不授权修改 `data/queries.ts`、`features/mobile/lib/mobile-command-read-model.ts`、`app/`、`app/api/`、`prisma/schema.prisma`，也不授权 official write、auto-send、auto-approve、auto-execution 或 page behavior 变更。

即便本计划通过评审，`productionAdoptionAllowed` 与 `runtimeIntegrationAllowed` 仍保持 `false`，下一步只能进入人工 runtime adoption review。

## 2. 目标

本计划回答五个问题：

1. 哪些 Business Advancement 信号允许申请生产查询承接。
2. 每条生产查询 seam 将读取哪些现有事实来源。
3. 如何证明查询只读、workspace-scoped、membership-backed、capability-aware。
4. 如何保证 redaction、field allowlist、limit clamp、deterministic ranking、audit 与 rollback。
5. 哪些 reviewer 需要批准同一个 plan version 后，才允许把 approval summary 交给 runtime adoption gate。

## 3. 非目标

本计划明确不做：

- 不直接实现 production query。
- 不修改 `data/queries.ts` 或 mobile read model。
- 不新增 Prisma schema、migration、API route、page route 或 queue。
- 不新增 official write path。
- 不接入 `/search`、`/mobile`、`/dashboard`、`/operating`、`/approvals` 页面行为。
- 不让 LLM 做最终排序、权限判断、commitment 判断或执行判断。
- 不把 approval record 写成 production deployment approval。

## 4. Entry Gates

进入 production query adoption planning 前，必须同时满足：

| Gate | 要求 |
| --- | --- |
| Phase 3R | `productionRuntimeAdoptionReviewReady=true`，但仍 `productionAdoptionAllowed=false` |
| Phase 3S | review packet ready，且 production decision 仍 `No-Go` |
| Redacted live evidence | 使用 `redacted_live_db_snapshot`，不能用 synthetic/local fixture 替代 |
| Implementation plan | 独立、版本化、可回滚、可禁用、可审计 |
| Required reviewer approval | 所有 canonical reviewer role 批准同一 plan version |

任何一项缺失，production query adoption 维持 No-Go。

## 4.1 Redacted Calibration Status

Business Advancement 当前有两条 redacted calibration 线，必须分开判断：

| 线 | 当前实现状态 | 当前证据状态 | 是否阻断 runtime adoption |
| --- | --- | --- | --- |
| Ask Helm interaction calibration | 合同、evaluator、CLI、tests 已实现 | actual live redacted interaction evidence 尚未提交 | 是 |
| Production query / source DB calibration | Phase 3O/3P/3Q/3R/3S 工具链已实现 | actual `redacted_live_db_snapshot` 尚未提交并通过 Phase 3R/3S | 是 |

因此，redacted real-data calibration **必须纳入同一前置计划**，但不能和 production query code 一起实施。正确顺序是：

1. 先准备真实 redacted interaction / live DB evidence。
2. 再运行对应 offline intake / calibration / preflight / review packet。
3. 再生成 production query adoption plan 与 approval record。
4. 最后才允许起独立 production query implementation plan。

不得用 positive fixture、local development snapshot 或 synthetic fixture 替代真实 redacted real-data evidence。

## 5. Minimal Plan Contract

实现前计划必须至少满足以下合同：

```ts
interface ProductionQueryAdoptionPlan {
  planId: string;
  planVersion: string;
  status: "draft" | "review_ready" | "approved";
  sourceEvidence: {
    redactedCalibrationPackageReady: boolean;
    redactedCalibrationPackageRuleVersion: string;
    phase3rPreflightPassed: boolean;
    phase3sReviewPacketReady: boolean;
    redactedLiveSnapshotId: string;
    calibrationReportPath: string;
  };
  targetSeams: Array<{
    seamId: string;
    signalFamily: string;
    plannedTargetFile:
      | "data/queries.ts"
      | "features/mobile/lib/mobile-command-read-model.ts"
      | "app/"
      | "app/api/"
      | "other";
    currentSliceCodeChangeAllowed: false;
    readOnly: boolean;
    defaultEnabled: boolean;
    pageBehaviorChanged: boolean;
    officialWritePath: boolean;
    maxTake: number;
  }>;
  boundaryProof: {
    readOnly: boolean;
    workspaceScoped: boolean;
    membershipChecked: boolean;
    capabilityChecked: boolean;
    objectReadChecked: boolean;
    noCrossWorkspace: boolean;
    noReservedTenantExposure: boolean;
    noOfficialWrite: boolean;
    noAutoExecution: boolean;
    deterministicRanking: boolean;
    limitClampDefined: boolean;
    redactionFieldAllowlistDefined: boolean;
    sensitiveFieldDenylistDefined: boolean;
    auditTrailDefined: boolean;
  };
  rolloutPlan: {
    stage:
      | "planning"
      | "shadow"
      | "pilot_allowlist"
      | "surface_read_only"
      | "broader_pilot";
    disabledByDefault: boolean;
    shadowModeRequired: boolean;
    workspaceAllowlistRequired: boolean;
    rollbackPlanPresent: boolean;
    rollbackOwnerUserId: string;
    observabilityPlanPresent: boolean;
  };
}
```

## 6. Query Boundary Requirements

每条 target seam 必须满足：

| 边界 | 要求 |
| --- | --- |
| Workspace | 所有查询必须显式绑定 `workspaceId` |
| Membership | 当前用户必须有 workspace membership |
| Capability | 涉及治理、审批、结算、敏感资源时必须有 capability proof |
| Object read | 指向具体对象时必须有 object-level read proof |
| Tenant | 不跨 workspace，不暴露 reserved tenant 信息 |
| Field scope | 只读 allowlisted 字段；敏感字段必须 denylist |
| Ranking | deterministic ranking；LLM 只能压缩解释，不能最终排序 |
| Limit | 每条 seam 必须定义 `maxTake`，当前 planning gate 上限为 100 |
| Writes | 不 official write，不 send，不 approve，不 pay，不 execute |
| Audit | 必须记录 plan version、query seam、reviewer approval、rollback owner |

## 7. Rollout Ladder

Production query adoption 必须按以下顺序推进：

| Stage | 允许内容 | 不允许内容 |
| --- | --- | --- |
| `planning` | 文档、纯 TS gate、fixture、review packet | 生产查询代码 |
| `shadow` | disabled-by-default shadow read plan | 页面展示、官方写路径 |
| `pilot_allowlist` | 单 workspace allowlist read-only proof | broad rollout |
| `surface_read_only` | 只读 surface candidate，需独立 review | execution authority |
| `broader_pilot` | 受控扩大试点，需再次评审 | 自动承诺、自动发送、自动审批 |

每一级都必须可禁用、可回滚、可审计。

## 8. Exit Criteria

本计划完成的最低标准：

1. 所有 target seams 已枚举。
2. 所有 query boundary proof 为 true。
3. rollout 从 `planning` 开始，disabled-by-default。
4. approval record 覆盖所有 required reviewer roles。
5. Redacted real-data calibration package summary 已接入 sourceEvidence。
6. Ask Helm interaction redacted calibration 与 production query redacted live DB calibration 的证据状态已明确记录。
7. `productionAdoptionAllowed=false` 与 `runtimeIntegrationAllowed=false` 不变。
8. `npm run test -- features/business-advancement/redacted-real-data-calibration-package-gate.test.ts features/business-advancement/production-query-adoption-approval-gate.test.ts` 通过。

## 9. No-Go Conditions

出现以下任一情况，不能进入 runtime adoption：

- 没有 redacted live DB snapshot。
- Phase 3R / Phase 3S 未通过。
- plan status 不是 `approved`。
- 任一 required reviewer 未批准同一 plan version。
- 任一 approval 是 `conditional` 或 `rejected`。
- 查询 seam 默认开启。
- 缺少 membership、capability、object-read、redaction、audit 或 rollback proof。
- 计划要求本阶段修改 `data/queries.ts`、mobile read model、Prisma、API、page 或 official write path。

## 10. 当前状态

已经完整成立：

| 项 | 状态 |
| --- | --- |
| Production query adoption plan contract | 已落库 |
| Planning-only evaluator | 已落库 |
| Required reviewer role set | 已统一为 Phase 3S canonical roles |
| Redacted calibration package gate | 已落库 |

已成形但仍需下一层：

| 项 | 下一步 |
| --- | --- |
| Actual live redacted evidence | 仍需真实 redacted interaction snapshot 与 redacted live DB snapshot |
| Manual review meeting | 仍未召开 |
| Production query implementation | 仍未批准 |

刻意未做：

| 项 | 原因 |
| --- | --- |
| `data/queries.ts` 修改 | 生产查询接入仍 No-Go |
| API / route / page 接入 | 本阶段只做 planning gate |
| Official write / execution authority | 与 Helm 边界冲突 |

风险项：

| 风险 | 控制 |
| --- | --- |
| reviewer approval 被误读为上线批准 | approval gate 只输出 Ready-For-Manual-Review |
| plan version 漂移 | approval record 必须绑定同一 planVersion |
| fixture 被误读为真实生产证据 | entry gate 要求 redacted live DB snapshot |
