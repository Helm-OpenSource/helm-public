---
status: draft
owner: Product / Delivery Engineering / Engineering
created: 2026-06-07
review_after: 2026-06-21
public_safety: Public-safe external agent intake requirements only. No provider runtime, customer data, credentials, production connector, external write, auto-send, approval, memory promotion, or customer commitment.
---

# Helm External Agent Intake PRD / Helm 外部智能体输入 PRD

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 1. 定位

外部智能体输入是 Helm 接收其他 agent、coding assistant、RPA、workflow tool、BI agent、
脚本或人工自动化输出的一条安全入口。它的唯一 public Core 目标是把外部输出降级为
可复核的 evidence / draft / analysis candidate。

外部 agent 不能在 Helm 内获得最终判断权、执行权、审批权、写回权、连接器激活权或客户承诺权。
一个外部 agent 的输出即使来自可信工具，也只是候选材料，必须经过 redaction、trace、workspace、
freshness 和 boundary 检查。

本 PRD 是 `features/external-agent-intake/*` 和 `scripts/agentic-governance-eval.ts`
的公开文档锚点。它不是 runtime adapter、API route、provider client、credential store、
hosted MCP、connector marketplace 或 production ingestion approval。

## 2. Existing Code Truth

Current public Core already contains:

| Code | Role |
|---|---|
| `features/external-agent-intake/artifact-contract.ts` | `ExternalAgentArtifact`, `ExternalAgentGovernanceTrace`, redaction and side-effect vocabulary |
| `features/external-agent-intake/intake-decision.ts` | Offline evaluator that routes artifacts to evidence/draft/review/watch/reject/quarantine |
| `features/external-agent-intake/p0-req-07-boundary.ts` | Strict P0-REQ-07 classifier for cross-tenant, unredacted, no-trace, stale, or incomplete artifacts |
| `features/external-agent-intake/provider-registry.ts` | Provider capability profile and permission posture |
| `features/external-agent-intake/provider-fixtures.ts` | Public-safe fixture examples |
| `scripts/agentic-governance-eval.ts` | Offline aggregate eval for external agent, connector, messaging, market signal, and back-office boundaries |

This PRD documents those boundaries and adds no new runtime authority.

## 3. Target Users

| User | What they need | What this does not grant |
|---|---|---|
| Delivery engineer | Bring output from coding agents or diagnostic tools into Helm review | Direct source-system writes or connector activation |
| Reviewer | See whether an external artifact is redacted, traced, fresh, and workspace-bound | Trust in raw external agent conclusions |
| Maintainer | Add fixtures and deterministic eval cases | Provider certification or production connector approval |
| Security reviewer | Quarantine unsafe artifacts and inspect reason codes | Permission to store customer raw output in public Core |

## 4. Accepted Artifact Kinds

`ArtifactKind` remains a closed set:

- `evidence_candidate`
- `draft_candidate`
- `analysis_candidate`
- `retrieval_candidate`
- `tool_receipt`
- `workflow_trace`
- `error_report`

None of these artifact kinds can create Must Push, active memory, official write, approved mapping,
customer-visible send, settlement, connector activation, overlay materialization, or commitment.

## 5. Provider Profile And Registry

Every accepted provider must have a reviewed provider profile. A provider profile describes capability,
auditability, default trust tier, draft capability, and permission posture. It is not a certification
or authority grant.

Provider profile requirements:

| Field | Requirement |
|---|---|
| `providerId` | Stable public-safe id |
| `displayName` | No private host or customer slug |
| `defaultTrustTier` | `trusted`, `medium`, `low`, or `untrusted` |
| `auditability` | Whether trace refs and raw output hash can be checked |
| `supportedArtifactKinds` | Closed set from `ArtifactKind` |
| `declaredSideEffects` | Must include `none`, `read`, `draft_created`, `tool_called`, `external_write_attempted`, or `unknown` |
| `permissionSummary` | Three lanes: automatic, review-required, never |
| `boundaryNote` | Explicitly says provider output is candidate-only |

Rules:

1. Missing provider profile means reject.
2. Provider reputation cannot bypass redaction, workspace, trace, or freshness checks.
3. Draft-capable providers can only produce `draft_candidate`; drafts still require human review.
4. Any provider that declares external write, unknown side effect, activation, send, approval, settlement,
   memory promotion, or customer commitment is quarantined for public Core.

## 6. Boundary And Permission Policy

P0-REQ-07 strict boundary:

> Cross-tenant, unredacted, no-trace, stale, or incomplete external artifacts are quarantined.

Required metadata:

| Metadata | Source |
|---|---|
| provider | `providerId` |
| source | `providerArtifactRef` or governance trace source |
| timestamp | `createdAt` or source timestamp |
| actor | `actorRef` or governance trace actor |
| workspace | `workspaceId` |
| raw output hash | `rawOutputHash` |
| redaction status | `redactionStatus` |
| trace id | `governanceTrace.traceId` or provider trace ref |

Allowed redaction statuses:

- `redacted`
- `alias_only`

Blocked or quarantined redaction statuses:

- `contains_pii`
- `unknown`

Forbidden promotions are unconditional:

- `must_push`
- `memory_active_asset`
- `official_write`
- `commitment`
- `accepted_mapping`
- `connector_activation`
- `external_send`
- `source_system_write`
- `overlay_materialization`

If an artifact passes the strict boundary, downstream routing is still candidate-only and review-first.
"Passes strict boundary" means "may be inspected"; it does not mean accepted, approved, sent, written,
activated, or committed.

## 7. Fixtures And Eval

Public fixtures must stay synthetic, redacted, or alias-only. Fixture coverage must include:

- trusted redacted evidence candidate
- draft candidate that still requires review
- missing provider profile
- missing required field
- cross-workspace artifact
- `contains_pii`
- `unknown` redaction
- no trace id
- stale artifact
- external write attempt
- refused / blocked / unsupported provider outcome
- trace/outcome conflict
- connector permission bypass attempt

Eval outputs must report:

- total fixtures and pass/fail count
- disposition mismatches
- reason-code mismatches
- quarantine count
- direct Must Push count, always `0`
- direct memory candidate count, always `0`
- final-ranking influence count, always `0`
- accepted-without-boundary count
- accepted-with-unsupported-PII count
- accepted-without-governance-trace count

The evaluator must remain offline. It must not call provider APIs, read production databases, load credentials,
send messages, create tasks, write official memory, or mutate source systems.

## 8. Routing

Allowed dispositions:

| Disposition | Meaning |
|---|---|
| `accept_as_evidence_candidate` | May attach as evidence candidate only |
| `accept_as_draft_candidate` | May prepare draft candidate only |
| `review_required` | Human review needed before any downstream use |
| `watch_only` | Observable but cannot drive candidate |
| `reject` | Invalid or unsupported; do not route |
| `quarantine` | Unsafe or boundary-violating; isolate and report reason |

Allowed downstream use:

- Add an alias-only evidence ref to a review packet.
- Prepare a draft candidate for human review.
- Add a blocked-action record to an `AgentRunCapsule`.
- Produce an operating-signal `boundary_attempt`, `evidence_gap`, or `risk` candidate.

Not allowed downstream use:

- Direct Must Push item.
- Official memory write.
- CRM, ticket, payment, message, or customer source-system writeback.
- Auto-accept source mapping.
- Connector activation.
- Overlay materialization.
- Customer commitment.

## 9. Agent Run Capsule Integration

External agent artifacts should become `inputRefs` or `outputArtifacts` in `AgentRunCapsule`.
The capsule must preserve:

- artifact id
- provider id
- workspace id
- raw output hash
- trace refs
- redaction status
- declared side effects
- boundary decision
- quarantine/reject reasons
- downstream candidate ids, if any

The capsule must not persist raw external output unless it is synthetic and public-safe.

## 10. Acceptance Criteria

- Public docs include this PRD and the agentic governance requirements doc.
- `scripts/agentic-governance-eval.ts` can load this document as a messaging scan target.
- The external-agent intake evaluator remains offline and deterministic.
- Strict P0-REQ-07 fixtures cover cross-tenant, unredacted, no-trace, stale, and missing-metadata cases.
- All forbidden promotions remain impossible in code and fixtures.
- Public release guard finds no secrets, tenant slugs, private hostnames, or customer data.

## English Reference

External agent intake is a public Core boundary for receiving output from other agents, tools, scripts,
or workflow systems as reviewable candidates only. It is not a provider runtime, connector adapter,
hosted endpoint, credential store, workflow engine, or authority grant.

Artifacts must carry provider, source, timestamp, actor, workspace, raw output hash, redaction status,
and trace id. Cross-tenant, unredacted, no-trace, stale, or incomplete artifacts are quarantined.
Passing the strict boundary means an artifact may be inspected; it does not mean it is accepted,
approved, sent, written, activated, or committed.

## Change Log

| Date | Change |
|---|---|
| 2026-06-07 | Added public PRD anchor for the existing external-agent intake artifact, provider, fixture, and P0-REQ-07 boundary contracts. |
