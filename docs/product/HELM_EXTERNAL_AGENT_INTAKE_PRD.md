---
status: active
owner: helm-core
created: 2026-05-01
review_after: 2026-06-01
archive_trigger:
  - External Agent Intake Phase 1 offline evaluator 合入主干并形成 closeout report 后，本 PRD 进入下一轮修订或归档
  - 2026-07-01 之后仍无对应 implementation PR，本 PRD 必须重新评审
---

# Helm External Agent Intake PRD

## 1. 目标

为 Helm 接入 OpenClaw、Coze、Dify，以及后续悟空、LangGraph、CrewAI、MCP、RPA、客户自建 Agent 提供统一 intake 合同。

本 PRD 的目标不是让 Helm 成为通用 Agent router，而是建立一条安全的外部能力入口：

```text
External Agent / Workflow / Tool output
  -> ExternalAgentArtifact
  -> ExternalAgentIntakeDecision
  -> evidence candidate / draft candidate / review packet / watch-only / rejected / quarantined
  -> Helm Business Advancement / Review / Memory candidate path
```

第一阶段只做 `evidence-only`。外部智能体输出只能被降权、审计、复核、隔离或作为候选证据进入 Helm，不得直接成为经营真值、Must Push、公司记忆或外部承诺。

## 2. 已接受的 Founder 决策

| 决策 | 状态 |
|---|---|
| 接受 `External Capability Layer / Helm Control Layer` 分层 | accepted |
| 第一阶段只做 evidence-only | accepted |
| 外部 Agent 不能直接创建 Must Push | accepted |
| 外部 Agent 不能直接写公司记忆 | accepted |
| 首批 provider 选 Coze manual + OpenClaw local + Dify manual | accepted |

## 3. 非目标

第一阶段明确不做：

1. 不接官方双向 API。
2. 不保存真实 provider token / credential。
3. 不做 runtime adapter。
4. 不调用外部网络。
5. 不改 production query。
6. 不改 schema。
7. 不做 UI。
8. 不让外部 Agent 创建 Must Push。
9. 不让外部 Agent 影响 Must Push final ranking。
10. 不让外部 Agent 写 MemoryCandidate / active memory。
11. 不做 official write、auto send、auto approve、auto settlement。
12. 不接 Browser / RPA 自动执行。

## 4. 用户与场景

### 4.1 Founder / Operator

Founder / Operator 需要判断客户已有 Coze Bot、Dify workflow、OpenClaw skill 输出能否作为 Helm 的经营推进证据。

需要看见：

- 输出来自哪个 provider。
- 输出是否可信。
- 是否有租户、PII、权限或越权风险。
- 是否只能进入 review packet 或 Must Push supporting evidence。

### 4.2 Implementation Engineer

Implementation Engineer 需要把客户已有外部 Agent 输出导入 Helm。

需要：

- 稳定的 import JSON contract。
- provider profile。
- 本地 eval 说明某条输出为什么被接受、降级、拒绝或隔离。

### 4.3 Product / Governance Reviewer

Product / Governance Reviewer 需要确认外部智能体输出不会污染经营真值、公司记忆和 customer-facing commitment。

需要看到：

- disposition。
- reason codes。
- boundary note。
- No-Go 证据。

## 5. Provider Registry

Provider registry 只描述能力和风险，不执行任何调用。

```ts
type ProviderKind =
  | "model_provider"
  | "external_agent_delegate"
  | "bounded_worker_runtime"
  | "tool_adapter"
  | "retrieval_provider"
  | "source_record_adapter";

type EffectMode =
  | "read_only"
  | "draft_only"
  | "reviewed_write"
  | "side_effecting"
  | "unknown";

type TrustTier = "high" | "medium" | "low" | "untrusted";

interface ProviderCapabilityProfile {
  providerId: string;
  providerName: string;
  providerKind: ProviderKind;
  supportedCapabilities: Array<
    | "generate"
    | "retrieve"
    | "analyze"
    | "draft"
    | "tool_call"
    | "workflow_run"
    | "agent_run"
    | "source_read"
    | "write_candidate"
  >;
  maxEffectMode: EffectMode;
  dataResidency: "local" | "china" | "cross_border" | "unknown";
  auditability: "full_trace" | "partial_trace" | "receipt_only" | "opaque";
  replayability: "deterministic_replay" | "best_effort_replay" | "not_replayable";
  tenantIsolation: "workspace_scoped" | "provider_project_scoped" | "shared" | "unknown";
  humanReviewNative: boolean;
  supportsRedaction: boolean;
  supportsOutputSchema: boolean;
  defaultTrustTier: TrustTier;
  prohibitedUses: string[];
}
```

### 5.1 首批 Provider Fixtures

| providerId | 定位 | 第一阶段默认姿态 | 审计 / 隔离保守默认 | 禁止用途 |
|---|---|---|---|---|
| `coze_manual` | Coze / 扣子 manual import | `external_agent_delegate` + `draft_only` + `defaultTrustTier=low` | `dataResidency=unknown`、`auditability=partial_trace`、`replayability=not_replayable`、`tenantIsolation=provider_project_scoped`、`supportsRedaction=false` | 直接创建 Must Push、直接写 memory、发送客户消息、CRM official write |
| `openclaw_local` | OpenClaw local artifact import | `bounded_worker_runtime` + `draft_only` + `defaultTrustTier=medium` | `dataResidency=local`、`auditability=partial_trace`、`replayability=best_effort_replay`、`tenantIsolation=unknown`、`humanReviewNative=false`、`supportsRedaction=false`、`supportsOutputSchema=false` | 作为多租户安全边界、直接创建 Must Push、直接写 memory、发送客户消息、official write |
| `dify_manual` | Dify workflow output import | `external_agent_delegate` + `draft_only` + `defaultTrustTier=low` | `dataResidency=unknown`、`auditability=partial_trace`、`replayability=best_effort_replay`、`tenantIsolation=provider_project_scoped`、`supportsRedaction=false` | 直接创建 Must Push、直接写 memory、official write、把 tool receipt 当作 business truth |

后续悟空、LangGraph、CrewAI、MCP、RPA 或客户自建 Agent 必须先补 provider profile，再进入 fixture eval；不能通过名称或平台声誉跳过 registry。

## 6. Artifact Contract

外部智能体输出统一进入 artifact 合同。

```ts
type ArtifactKind =
  | "evidence_candidate"
  | "draft_candidate"
  | "analysis_candidate"
  | "retrieval_candidate"
  | "tool_receipt"
  | "workflow_trace"
  | "error_report";

type RedactionStatus =
  | "redacted"
  | "alias_only"
  | "contains_pii"
  | "unknown";

interface ExternalAgentArtifact {
  artifactId: string;
  workspaceId: string;
  providerId: string;
  providerArtifactRef?: string;
  artifactKind: ArtifactKind;
  createdAt: string;
  sourceTimestamp?: string;
  actorRef?: string;
  objectRef?: {
    type: "meeting" | "opportunity" | "company" | "contact" | "commitment" | "resource" | "memory" | "unknown";
    id?: string;
  };
  actorVisibleSummary: string;
  rawOutputHash: string;
  redactionStatus: RedactionStatus;
  providerTraceRefs: string[];
  governanceTrace?: {
    traceId: string;
    source: string;
    actorType: "external_agent" | "connector" | "operator" | "system" | "unknown";
    workspaceId: string;
    objectRef?: {
      type: "meeting" | "opportunity" | "company" | "contact" | "commitment" | "resource" | "memory" | "unknown";
      id?: string;
    };
    inputEvidenceRefs: string[];
    proposedAction: string;
    outcomeStatus: "completed" | "refused" | "blocked" | "needs_review" | "unsupported" | "error";
    boundaryDecision: "allow_candidate" | "review_required" | "watch_only" | "reject" | "quarantine";
    createdAt: string;
    redactionStatus: RedactionStatus;
  };
  providerOutcomeStatus?: "completed" | "refused" | "blocked" | "needs_review" | "unsupported" | "error";
  citationsOrEvidenceRefs: string[];
  declaredSideEffects: Array<
    | "none"
    | "read"
    | "draft_created"
    | "tool_called"
    | "external_write_attempted"
    | "unknown"
  >;
  providerConfidenceClaim?: number;
  contentSummary: string;
  contentShape: "text" | "json" | "markdown" | "file_ref" | "unknown";
}
```

### 6.1 必填约束

必须有：

- `artifactId`
- `workspaceId`
- `providerId`
- `artifactKind`
- `createdAt`
- `actorVisibleSummary`
- `rawOutputHash`
- `redactionStatus`
- `declaredSideEffects`
- `contentSummary`

缺失则 `reject`。

### 6.1.1 Agentic Governance P0 扩展

自 2026-05-02 起，外部 agent artifact 支持结构化 outcome 与 governance trace：

- `refused` 是终态治理结果，不允许被 retry 成空 success。
- `blocked` 进入 quarantine，不创建下游动作权限。
- `needs_review` 必须保持人工复核。
- accepted evidence / draft candidate 必须带 `governanceTrace`。
- trace 只能保存 redacted / alias-only evidence refs，不保存 raw PII。

### 6.2 默认解释

- `providerConfidenceClaim` 不等于 Helm confidence。
- `rawOutputHash` 只用于追踪，不代表 raw content 可进入 repo 或 proof。
- `tool_receipt` 不等于 official write success。
- `workflow_trace` 不等于 business outcome。
- `draft_candidate` 不等于 sent。

## 7. Intake Decision

```ts
type IntakeDisposition =
  | "accept_as_evidence_candidate"
  | "accept_as_draft_candidate"
  | "review_required"
  | "watch_only"
  | "reject"
  | "quarantine";

type IntakeReasonCode =
  | "source_trusted"
  | "source_untrusted"
  | "provider_profile_missing"
  | "missing_required_field"
  | "missing_evidence"
  | "stale"
  | "contradictory"
  | "duplicate"
  | "cross_tenant_risk"
  | "contains_pii"
  | "redaction_unknown"
  | "authority_exceeded"
  | "boundary_missing"
  | "side_effect_declared"
  | "provider_opaque"
  | "requires_human_review"
  | "object_ref_missing"
  | "object_ref_unverified";

interface ExternalAgentIntakeDecision {
  artifactId: string;
  providerId: string;
  disposition: IntakeDisposition;
  reasonCodes: IntakeReasonCode[];
  mayAttachToSignal: boolean;
  mayCreateMustPushCandidate: false;
  mayCreateMemoryCandidate: false;
  mustRequireReview: boolean;
  boundaryNote: string;
  containment?: "none" | "downgraded" | "rejected" | "quarantined";
}
```

硬规则：

- `mayCreateMustPushCandidate` 第一阶段恒为 `false`。
- `mayCreateMemoryCandidate` 第一阶段恒为 `false`。
- `authority_exceeded` -> `quarantine`。
- `cross_tenant_risk` -> `quarantine`。
- `contains_pii` with unsupported redaction -> `review_required` 或 `quarantine`。
- `provider_profile_missing` -> `reject`。
- `missing_required_field` -> `reject`。
- `defaultTrustTier=low` -> 至少 `review_required`。

## 8. Intake Gate Rules

### 8.1 `accept_as_evidence_candidate`

仅在全部满足时允许：

- provider profile exists。
- required fields complete。
- workspaceId present and matched。
- no cross tenant risk。
- no authority exceeded。
- `redactionStatus` is `redacted` or `alias_only`。
- `citationsOrEvidenceRefs` present。
- `declaredSideEffects` is `none` or `read`。
- `artifactKind` is `evidence_candidate` or `analysis_candidate`。

仍然不能直接创建 Must Push。

### 8.2 `accept_as_draft_candidate`

仅在全部满足时允许：

- `artifactKind` is `draft_candidate`。
- no side effect beyond `draft_created`。
- boundary note exists。
- provider is draft-capable。
- `mustRequireReview` remains `true`。

### 8.3 `review_required`

以下情况进入 review：

- provider trust low。
- redaction unknown。
- object ref missing but content potentially useful。
- partial trace。
- provider confidence high but evidence weak。
- draft candidate。
- tool receipt that may imply external write。

### 8.4 `watch_only`

以下情况只观察：

- evidence too weak。
- source stale but harmless。
- duplicate of existing review packet。
- provider output is generic and not object-bound。

### 8.5 `reject`

以下情况拒绝：

- provider profile missing。
- required fields missing。
- no workspaceId。
- unsupported artifact kind。
- empty content summary。

### 8.6 `quarantine`

以下情况隔离：

- cross tenant risk。
- authority exceeded。
- declared external write attempted。
- contains PII with unknown or unsupported redaction。
- external artifact claims action was already sent、approved、settled 或 externally written。
- governance trace outcome conflicts with provider outcome。
- connector-backed artifact proposes review-required or never-allowed permissions.

## 9. Fixture Pack

第一批至少覆盖 15 条 fixture；Agentic Governance P0/P1 扩展后当前默认 gate 覆盖 22 条。

| ID | Provider | Kind | Case | Expected |
|---|---|---|---|---|
| EA-001 | `coze_manual` | `evidence_candidate` | redacted meeting follow-up insight with evidence refs | `review_required` |
| EA-002 | `coze_manual` | `draft_candidate` | follow-up email draft, no send | `accept_as_draft_candidate` + `review_required` |
| EA-003 | `coze_manual` | `analysis_candidate` | generic advice, no object ref | `watch_only` |
| EA-004 | `coze_manual` | `workflow_trace` | provider claims CRM updated | `quarantine` |
| EA-005 | `openclaw_local` | `evidence_candidate` | local skill output with object ref and hash | `accept_as_evidence_candidate` |
| EA-006 | `openclaw_local` | `draft_candidate` | cookbook draft output | `accept_as_draft_candidate` + `review_required` |
| EA-007 | `openclaw_local` | `analysis_candidate` | output contains no trace refs | `review_required` |
| EA-008 | `openclaw_local` | `tool_receipt` | shell/tool receipt with unknown side effect | `quarantine` |
| EA-009 | `dify_manual` | `retrieval_candidate` | RAG result with citations | `review_required` |
| EA-010 | `dify_manual` | `workflow_trace` | workflow output with partial trace | `review_required` |
| EA-011 | `dify_manual` | `evidence_candidate` | stale output older than threshold | `watch_only` |
| EA-012 | `dify_manual` | `analysis_candidate` | contradiction with CRM source | `review_required` |
| EA-013 | `coze_manual` | `evidence_candidate` | cross-workspace artifact | `quarantine` |
| EA-014 | `unknown` | `evidence_candidate` | provider profile missing | `reject` |
| EA-015 | `coze_manual` | `draft_candidate` | contains raw customer PII | `quarantine` |
| EA-016 - EA-020 | `openclaw_local` | mixed | refused / blocked / unsupported / error / needs_review outcome | watch / quarantine / reject / review |
| EA-021 | `openclaw_local` | `evidence_candidate` | provider outcome conflicts with governance trace | `quarantine` |
| EA-022 | `openclaw_local` | `workflow_trace` | connector-backed CRM stage write proposal | `review_required` |

## 10. Offline Eval Gate

最小 eval 指标：

| Metric | Required |
|---|---:|
| `providerProfileCoverage` | 100% for known providers |
| `missingRequiredFieldRejected` | 100% |
| `crossTenantQuarantined` | 100% |
| `authorityExceededQuarantined` | 100% |
| `traceConflictAccepted` | 0 |
| `connectorPermissionBypassed` | 0 |
| `directMustPushCreated` | 0 |
| `directMemoryCandidateCreated` | 0 |
| `finalRankingInfluencedByExternalAgent` | 0 |
| `acceptedWithoutBoundaryNote` | 0 |
| `acceptedWithUnsupportedPII` | 0 |

目标命令：

```bash
npm run eval:external-agent-intake
```

第一阶段只接受 local fixture，不读取 production DB，不调用 provider API。

## 11. Mapping To Business Advancement

第一阶段映射只允许：

| Intake Decision | Business Advancement Mapping |
|---|---|
| `accept_as_evidence_candidate` | attach as supporting evidence candidate |
| `accept_as_draft_candidate` | create review packet draft attachment |
| `review_required` | create review packet candidate |
| `watch_only` | observation only |
| `reject` | no downstream mapping |
| `quarantine` | containment report |

不允许：

- `ExternalAgentArtifact -> MustPushItem` direct mapping。
- `ExternalAgentArtifact -> MemoryCandidate` direct mapping。
- `ExternalAgentArtifact -> official write`。
- `ExternalAgentArtifact -> send`。

## 12. Acceptance Criteria

### 12.1 Product Acceptance

- 能解释 Helm 为什么可以接外部 Agent 但不会变成外部 Agent router。
- 能解释外部 Agent 输出为什么只是 candidate。
- 能解释 Coze / OpenClaw / Dify 三个 provider 第一阶段怎么接。
- 能解释哪些情况 review、watch、reject、quarantine。

### 12.2 Engineering Acceptance

- Types are pure and fixture-backed。
- No network calls。
- No credentials。
- No schema migration。
- No API route。
- No UI。
- No production query。
- No official write。
- Deterministic eval。

### 12.3 Boundary Acceptance

- external agent output != business truth。
- workflow success != business outcome。
- tool receipt != official write success。
- draft != send。
- retrieval != memory。
- provider confidence != Helm confidence。

## 13. Implementation Plan

### Task 1: Registry Types + Fixtures

Likely files:

- `features/external-agent-intake/provider-registry.ts`
- `features/external-agent-intake/provider-fixtures.ts`
- `features/external-agent-intake/provider-registry.test.ts`

Acceptance:

- Three provider profiles exist。
- No provider has side-effecting default。
- Provider prohibited uses include Must Push、memory、send、official-write boundaries。

### Task 2: Artifact Intake Evaluator

Likely files:

- `features/external-agent-intake/artifact-contract.ts`
- `features/external-agent-intake/intake-decision.ts`
- `features/external-agent-intake/intake-decision.test.ts`

Acceptance:

- 22 fixture cases produce expected dispositions。
- quarantine / reject rules are deterministic。
- `mayCreateMustPushCandidate=false` always。
- `mayCreateMemoryCandidate=false` always。

### Task 3: CLI Eval

Likely files:

- `scripts/external-agent-intake-eval.ts`
- `package.json`

Acceptance:

- `npm run eval:external-agent-intake` passes。
- Metrics output includes all required gate metrics。
- No production DB or network access。

### Task 4: Business Advancement Mapping Plan

Likely file:

- `docs/product/EXTERNAL_AGENT_INTAKE_TO_BUSINESS_ADVANCEMENT_PLAN.md`

Acceptance:

- Maps intake decision to BA candidate layers only。
- Explicit No-Go for direct Must Push / Memory / official write。

## 14. Open Questions

1. `ExternalAgentArtifact` should live in `features/external-agent-intake/` instead of `features/business-advancement/`, because it is a horizontal intake layer.
2. Wukong provider profile should not be added until its API、审计、私有化和数据边界 can be verified.
3. Public-facing sales FAQ should remain local until external-agent intake has fixture-backed implementation evidence.

## 15. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | Agentic Governance P1 扩展：默认 fixture gate 扩到 22 条，新增 trace conflict 与 connector permission reason-code 指标 |
| 2026-05-01 | 根据 founder approval，将本地 `EXTERNAL_AGENT_INTAKE_PRD_DRAFT` 提升为仓库内正式 PRD，进入实施准备 |
