---
status: draft
owner: Product / Delivery Engineering / Engineering
created: 2026-06-07
review_after: 2026-06-21
public_safety: Public-safe requirements only. No runtime agent platform, customer data, credentials, provider telemetry, connector activation, writeback, external send, approval, settlement, overlay materialization, or customer commitment.
---

# Helm Agentic Governance Requirements / Helm 智能体化实施工程治理需求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

## 1. 定位

Helm 可以吸收开源 coding agent、workflow agent、observability / eval 工具里的实施工程机制，
但不能把自己改写成通用 agent 平台、工作流编排器、MCP 市场、自动执行平面或客户系统写回器。

本需求定义一层 **Agentic Implementation Engineering Layer**：它让交付工程师和 agent
在 Helm 内做诊断、生成草案、运行检查、准备复核包时，留下可审计、可回放、可阻断的
运行证据。它的成功标准不是 "agent 自动完成客户交付"，而是：

1. 更快发现实施缺口。
2. 更稳定地把来源材料转成 Helm 经营信号候选。
3. 更清楚地证明哪些动作已被阻断、哪些需要人工复核。
4. 更少发生越权自动发送、自动审批、自动写回、自动承诺或公开安全泄漏。

本文件是需求契约，不是 runtime 实现、发布批准、客户部署证明、生产 SLA 或 owner Go/No-Go。

## 2. 当前 Helm 事实

这层需求必须复用现有 public Core 事实：

| Existing contract | Current role | Requirement implication |
|---|---|---|
| `HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md` | Offline HSI fixture, signal, review packet contract | Agent output can only become reviewed signal evidence, never direct execution. |
| `HELM_SIGNAL_FIRST_MILE_METHOD.md` | Manual / redacted / read-only source collection method | Agent diagnosis starts at L0/L1/L2 source posture, not production connector rollout. |
| `HELM_AI_RECOMMENDATION_GOVERNANCE.md` | Recommendation, evidence, human review, owner decision boundary | All agent-derived suggestions stay candidate-only until human review. |
| `HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md` | Canonical diagnostic command, risk, doctor-packet, and redaction contract | Agentic automation must extend this registry and packet shape, not create a parallel command contract. |
| `HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md` | Read-only signal flow projection and `OperatingSignalFamily` vocabulary | Agent runs should project into operating signal flow only through existing family/state terms. |
| `HELM_EXPERT_CAPABILITY_FEEDBACK_LOOP.md` | Held-out eval, pre-registration, no automatic learning | Trajectory eval must test unseen cases and boundary traps, not self-certify from corrected examples. |
| `features/external-agent-intake/*` | External agent artifact and strict P0-REQ-07 boundary | External agent output is evidence/draft candidate input, not final truth. |
| `lib/llm/context-audit.ts` and `lib/llm/trace-sanitizer.ts` | Prompt boundary audit and trace redaction | Agent run traces must redact prompts, secrets, raw rows, transcripts, and private content. |

When the `tools/source-profiler` branch lands, this layer must reuse its `ReviewPacket`,
mapping-candidate, redaction, and overlay-draft vocabulary. It must not fork a second
"source mapping truth" contract.

## 3. Problem Statement

Helm already encodes judgement-first, review-first, and source-to-signal boundaries.
The missing layer is implementation engineering evidence:

- A reviewer cannot quickly see what an agent inspected, which commands ran, which files changed,
  which evidence was used, and which forbidden actions were blocked.
- Existing diagnostics, HSI, source-intake, LLM context audit, and external-agent intake are useful
  but not yet joined into one run-level proof package.
- External coding agents can be productive, but their trajectories can overreach: editing before
  reading, skipping validation, treating green checks as release approval, creating drafts that imply
  commitments, or trying to activate connectors.
- Source-controlled checks and local doctor commands need a common risk vocabulary so Helm can add
  automation without expanding authority.

## 4. Non-Goals

This layer must not implement or imply:

- Generic agent builder, visual workflow builder, agent marketplace, or hosted MCP runtime.
- Automatic PR merge, direct protected-branch push, or self-approved review.
- Automatic external send, approval, settlement, CRM writeback, connector activation, overlay
  materialization, official memory promotion, or customer commitment.
- Default provider telemetry, default external observability export, or public Core dependency on
  hosted LLM observability services.
- Customer data ingestion, business-row reads, credentials, production endpoints, tenant slugs,
  private hostnames, or customer deployment receipts in public files.
- A claim that public Core alone is Cloud / Enterprise ready.

## 5. Design Principles

1. **Run evidence before agent authority**: every agent-assisted implementation step must be explainable
   as a run capsule before it can influence review.
2. **Deterministic guard before LLM judgement**: risk, boundary, and allowed next surface are deterministic.
   LLMs may summarize or critique; they do not grant authority.
3. **Candidate-only by default**: agent output may create evidence candidates, draft candidates, review packets,
   or blocked-action records. It cannot accept mappings, approve actions, activate connectors, or commit externally.
4. **Local first, private optional**: public Core writes run artifacts to `/tmp` or explicit local draft paths.
   Optional observability adapters are private deployment choices, not public defaults.
5. **Worktree-aware**: implementation automation must record repo root, branch, dirty-state posture, and intended
   file scope before editing.
6. **Proof package over prose**: a final assistant summary is not enough. Reviewers need structured command,
   diff, validation, and boundary evidence.

## 6. Required Vocabulary

### 6.1 Implementation Mode

`AgentImplementationMode` is agentic runner / capsule metadata. It is not a replacement for the
canonical diagnostics `DiagnosticCommand` contract.

It must be a closed set:

| Mode | Meaning | Allowed posture |
|---|---|---|
| `explore` | Read code, docs, logs, fixtures, and public sources | Read-only; no repo writes |
| `specify` | Produce requirements, ADR, or review packet | Docs/local draft only |
| `implement` | Change code or docs in an owned branch/worktree | Repo write only after scope and branch are recorded |
| `validate` | Run build, test, lint, guard, smoke, eval | Read-only except generated local outputs |
| `review` | Inspect diff, risks, and tests | Read-only; findings first |
| `handoff` | Prepare next-agent or human handoff | No new implementation changes |

### 6.2 Command Risk

The canonical risk set is `DiagnosticCommandRisk` from
`lib/diagnostics/command-registry.ts` and
`HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md`. This agentic layer
must use that six-member set unless a later diagnostics PR explicitly extends
the shared contract.

| Risk | Meaning | Public Core default |
|---|---|---|
| `read` | Reads local repo files or public-safe fixtures | Allowed |
| `local_draft` | Writes local draft artifacts to `/tmp` or explicit ignored draft path | Allowed with path guard |
| `repo_write` | Modifies current repo worktree | Allowed only in owned branch/worktree and explicit scope |
| `external_write` | Writes to external system or sends externally | Forbidden |
| `activation` | Creates/enables connector, token, webhook, runtime schedule, or deployment | Forbidden |
| `commitment` | Creates customer-visible obligation, approval, settlement, or owner decision | Forbidden |

Any command with `external_write`, `activation`, or `commitment` risk must fail closed in public Core.
Commands with unknown side effects must be treated as at least `activation` risk until reviewed.
External service reads are not a separate public Core risk token in the merged diagnostics contract:
synthetic/public fixture reads remain `read`; real external-system access is outside public Core by default
and must be modeled through an owning private process rather than a live public command.

## 7. Agent Run Capsule

Every implementation or diagnostic run that produces reviewable output should be representable as
`AgentRunCapsule`.

Minimum fields:

| Field | Requirement |
|---|---|
| `runId` | Stable id |
| `createdAt` | ISO timestamp |
| `actor` | Agent or human alias; no personal secret or credential |
| `mode` | `AgentImplementationMode` |
| `worktreeProfile` | `WorktreeProfile`; records whether the run is read-only, local draft, repo-write reviewed, private sandbox, or external-write forbidden |
| `repo` | Repo alias, root hash or branch ref, dirty-state summary |
| `intent` | Short user-visible intent |
| `scope` | Files/modules/commands allowed for this run |
| `inputRefs` | Redacted evidence, fixture, issue, PR, source-profiler packet, or HSI refs |
| `redactionStatus` | Closed set: `synthetic`, `redacted`, `alias_only`, `raw_blocked`, or `unknown_blocked` |
| `commandResults` | Command name, args, cwd, risk, exit code, start/end, redacted output summary |
| `fileChangeSummary` | Added/modified/deleted file list and rationale; empty for read-only runs |
| `outputArtifacts` | Review packets, local drafts, eval reports, screenshots, or blocked-action records |
| `boundaryDecisions` | Deterministic allow/review/reject/quarantine decisions |
| `blockedActions` | Forbidden action attempts or skipped unsafe next steps |
| `validationReceipts` | Build/test/lint/eval/guard receipts, including failures |
| `humanReceipts` | Optional reviewer/owner receipt refs; absent means not approved |
| `nextSafeActions` | Review-first next steps only |
| `sarpReceipt` | Optional SARP v0.1 deterministic review receipt; `capsuleRunId` must match `runId`; evidence only, not approval |

Capsule content must not include raw prompts, secrets, raw customer rows, full transcripts, production URLs,
private hostnames, tenant slugs, internal deployment receipts, or unredacted source paths from customer repos.
If redaction cannot be proven, `redactionStatus` must be `raw_blocked` or `unknown_blocked` and downstream
routing must be `quarantine`.

Shared redaction mapping:

| Source vocabulary | Incoming value | Capsule / doctor value | Required routing |
|---|---|---|---|
| Doctor packet | `synthetic` | `synthetic` | May proceed as public-safe evidence |
| Doctor packet / external intake | `redacted` | `redacted` | May proceed as review-first evidence |
| Doctor packet / external intake | `alias_only` | `alias_only` | May proceed as review-first evidence |
| External intake | `contains_pii` | `raw_blocked` | Quarantine / reject; no raw persistence |
| External intake / unknown source | `unknown` | `unknown_blocked` | Quarantine until redaction is proven |

## 8. Diagnostic Command Registry

Helm already has the canonical source-controlled registry in
`lib/diagnostics/command-registry.ts`. Future agentic implementation must extend that registry rather
than creating a parallel `DiagnosticCommand` shape.

Canonical `DiagnosticCommand` fields:

| Field | Requirement |
|---|---|
| `id` | Stable id |
| `command` | Command string or reference-only placeholder |
| `repoOwner` | `helm-public` or opaque `sibling-repo` ownership pointer only; not authorization to execute there |
| `risk` | Required canonical `DiagnosticCommandRisk` |
| `sideEffects` | Explicit list; `none` for read-only |
| `requiredInputs` | Files/env/fixtures needed; no secret values |
| `outputSchemaRef` | Typed output or packet schema |
| `evidenceRefs` | Public-safe evidence refs for the command contract |
| `forbiddenActions` | Closed-set forbidden actions |
| `disabled` | Optional blocked placeholder marker for higher-risk commands |

Agentic-specific metadata such as `AgentImplementationMode`, `allowedOutputRoots`, validation receipts,
and worktree profile belongs in `AgentRunCapsule` / runner metadata unless a later diagnostics PR updates
the canonical registry schema. Local draft output is still constrained to `/tmp` or an explicit ignored
local draft path, but that path guard should be enforced by the capsule writer / runner rather than by
forking `DiagnosticCommand`.

The registry should initially cover only public-safe commands:

- repo doctor / docs guard / public release guard
- HSI eval
- Signal First Mile quality eval
- source-profiler smoke once merged, using the same registry rather than a parallel source-profiler command table
- SARP v0.1 deterministic boundary fixture guard through `npm run check:agentic-sarp`

## 9. Helm Doctor Packet

`HelmDoctorPacket` should be the run-level output for diagnostic commands. It is not a customer deployment
readiness certificate.

Canonical current fields:

- `packetId`
- `generatedAt`
- `redactionStatus`
- `repo`
- `commandResults`
- `warnings`
- `blockedActions`
- `nextActions`

Agentic proof-package extensions may derive `candidateSignals`, `reviewRequired`, and `missingEvidence`
from a run capsule, but those fields are not part of the current canonical `HelmDoctorPacket` schema unless
a later diagnostics PR updates `lib/diagnostics/doctor-packet.ts`.

Doctor packets may prepare a review packet or signal candidate. They must not auto-send, auto-approve,
activate connectors, write source systems, write official memory, or create customer commitments.

## 10. Trajectory Eval

Helm should add process-level evals for agent implementation behavior, not only final output quality.

Minimum failure classes:

| Failure class | Example |
|---|---|
| `edited_before_reading_scope` | Agent changes files without reading entry docs or target code |
| `unowned_worktree_write` | Agent writes in shared checkout or unrelated branch |
| `validation_skipped` | Agent claims done without running required checks or explaining blockers |
| `green_check_overclaim` | Agent treats automated green as release-ready or owner-approved |
| `boundary_authority_leak` | Agent creates approval/send/write/activation language |
| `external_side_effect_attempt` | Agent tries to call external write, connector activation, or deployment |
| `redaction_leak` | Capsule or draft leaks secrets, private path, raw customer content, or tenant slug |
| `source_truth_fabrication` | Agent asserts repo/GitHub/gate truth without command, PR, issue, or receipt evidence |
| `candidate_autopromotion` | Agent turns candidate/recommendation into accepted memory, mapping, or commitment |

Trajectory eval must include negative fixtures and hard boundary traps. It should report `pass`,
`fail`, or `inconclusive`; it must not let LLM self-critique override deterministic failures.

Current public Core implementation:

- `lib/agentic/contracts.ts` defines the closed failure vocabulary.
- `lib/agentic/run-capsule.ts` defines `AgentRunCapsule`, redaction quarantine, forbidden-risk rejection, and optional `sarpReceipt`.
- `lib/agentic/trajectory-eval.ts` detects process-level failures deterministically.
- `lib/agentic/sarp-contracts.ts` and `lib/agentic/sarp-eval.ts` produce SARP v0.1 review receipts with `pass`, `advisory`, `block`, or `escalate` verdicts.
- `scripts/check-agentic-sarp.ts` runs synthetic SARP boundary fixtures and is wired into `npm run check:boundaries`.

This implementation is still an evidence and guard layer. It is not an agent runtime, planner,
workflow engine, external execution surface, approval surface, or production deployment proof.

## 11. Source-Controlled AI Checks

Helm can support source-controlled AI checks, but they remain suggestions:

- Checks live under a reviewed path such as `.helm/checks/*.md` or `docs/codex/checks/*.md`.
- Each check declares target files, required evidence, boundary rules, expected output schema, and forbidden actions.
- Check output is an `AgentRunCapsule` or review packet candidate.
- Check output must not mutate code, open PRs, merge branches, activate connectors, or send externally.
- CI may show suggestions or fail a deterministic boundary, but an AI check cannot approve itself.

## 12. Worktree And Sandbox Profile

Public Core should require run capsules to record a `WorktreeProfile`:

| Profile | Meaning | Requirement |
|---|---|---|
| `read_only_local` | Inspection only | No file writes except command logs in `/tmp` |
| `local_draft` | Requirements, review packets, local proof package | Output root must be `/tmp` or ignored local draft path |
| `repo_write_reviewed` | Owned branch/worktree implementation | Branch, base, status, and scope must be recorded |
| `private_sandbox` | Customer/private environment | Outside public Core; must not write public docs with private facts |
| `external_write_forbidden` | Any external write path | Public Core must block |

This mirrors the existing multi-agent worktree rule: shared checkouts are for inspection, synchronization,
or short rescue only; substantive implementation should use a dedicated worktree and branch.

## 13. Source-To-Signal Integration

The implementation layer should connect to source-to-signal work through review artifacts only:

1. Source profiler output becomes an `inputRef` and `outputArtifact` in `AgentRunCapsule`.
2. Mapping suggestions remain `candidate`.
3. Only humans may mark mappings `accepted_by_human` or `rejected_by_human`.
4. Overlay drafts remain private/local drafts unless handled by `helm-overlays`.
5. DB catalog snapshots, if used, remain metadata-only and read-only; business-row reads are not part of
   public Core.

## 14. Observability

Public Core should define a local trace schema and optional private adapter boundary:

- Default public behavior: local capsule JSON, redacted summaries, no default telemetry export.
- Optional private behavior: Phoenix / Langfuse / OpenTelemetry-style adapter may receive redacted run metadata
  only after deployment-specific consent and configuration.
- Trace sanitizer must remove prompt bodies, messages, transcripts, audio, file bodies, credentials, tokens,
  private hostnames, tenant slugs, and raw customer content.
- Observability output is evidence, not authority.

## 15. Proof Package Viewer

Longer term, Helm should expose a proof package view for reviewers. It should show:

- run intent and scope
- source/evidence refs
- command receipts
- candidate mappings or signals
- blocked actions
- validation state
- missing evidence
- human receipts
- next safe actions

It must not show raw customer data, secret-bearing traces, internal deployment receipts, or unredacted customer
source paths in public Core.

## 16. Implementation Slices

Recommended PR order:

| Slice | Scope | Validation |
|---|---|---|
| PR0 requirements | This document, external-agent intake PRD anchor, docs index, manifest, status | `check:public-docs`, `check:public-release` |
| Baseline capsule / trajectory eval | `AgentRunCapsule`, redaction quarantine, forbidden-risk rejection, deterministic trajectory failure classes | unit tests, negative fixtures |
| SARP PR1 | SARP v0.1 contracts and deterministic review evaluator | SARP receipt unit tests |
| SARP PR2 | Optional capsule `sarpReceipt`, `attachSarpReviewReceipt`, and `check:agentic-sarp` wired into `check:boundaries` | capsule receipt tests, synthetic guard fixtures, public package projection tests |
| SARP PR3 | Documentation and status truth sync for the code-backed SARP slice | `check:public-docs`, `check:public-release`, `check:boundaries` |
| Future source-controlled AI checks | Source-controlled check contract and suggestion-only runner | no mutation tests, no self-approval tests |
| Future proof package projection | Read-only proof package projection | fixture-backed rendering / docs |
| Future private observability adapter | Optional private adapter contract | explicit opt-in, redaction tests |

## 17. Acceptance Criteria

For requirements and status truth:

- New public docs are listed in `docs/public-docs-manifest.json`.
- `docs/README.md` links the public contract.
- `docs/STATUS.md` states the current code-backed SARP guard status without claiming runtime implementation.
- Public release guard does not find secrets, private hosts, tenant slugs, or customer facts.

For future implementation:

- Schemas use closed sets and fail closed for unknown risks, redaction, side effects, and modes.
- `DiagnosticCommandRisk` uses the canonical six-member diagnostics set unless the diagnostics contract is explicitly updated.
- No public Core command with unknown side effects can run as allowed.
- `external_write`, `activation`, and `commitment` risks are blocked by tests.
- Agent run capsules cannot persist raw prompts, credentials, raw rows, transcripts, private URLs, or customer
  identifiers.
- Capsule redaction values map explicitly from doctor-packet / external-intake values and never carry raw private content forward.
- Trajectory eval includes overreach, validation-skip, redaction-leak, and candidate-autopromotion fixtures.
- `check:agentic-sarp` stays synthetic/offline and remains part of `check:boundaries`.
- Any source-profiler integration reuses source-profiler ReviewPacket / mapping-candidate contract after merge.

## English Reference

Helm should absorb implementation-engineering patterns from modern agent systems without becoming a generic
agent platform. The required layer is an evidence layer: command registry, doctor packet, agent run capsule,
trajectory eval, source-controlled AI checks, worktree profile, source-to-signal bridge, optional private
observability, and proof package viewer.

The layer is review-first and candidate-only. It must not authorize external sends, approvals, CRM writeback,
connector activation, overlay materialization, official memory promotion, customer commitments, production
connector rollout, or public Core telemetry export.

The first implementation should remain public-safe and local: typed contracts, deterministic guards, fixtures,
tests, and `/tmp` proof artifacts before any UI, connector, hosted endpoint, or private observability adapter.

## Change Log

| Date | Change |
|---|---|
| 2026-06-07 | Drafted the Helm agentic implementation engineering requirements from current public Core contracts and recent open-source agent pattern review. |
| 2026-06-08 | Synchronized the requirements with SARP v0.1 contracts, optional capsule receipts, deterministic trajectory/SARP guard implementation, and `check:agentic-sarp` boundary wiring. |
