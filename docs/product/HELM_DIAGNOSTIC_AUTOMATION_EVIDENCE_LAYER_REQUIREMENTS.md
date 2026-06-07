---
status: draft
owner: Product / Delivery Engineering / Engineering
created: 2026-06-07
review_after: 2026-06-21
public_safety: Public-safe requirements and evidence contract only. No customer data, credentials, production connector, external send, automatic approval, automatic writeback, connector activation, or customer deployment receipt.
source_basis:
  - Public Rabetbase repository pattern review on 2026-06-07
  - Helm Signal First Mile method
  - Helm AI recommendation governance
  - Helm Headless Signal Interface requirements
  - Helm Operating Signal Flow Map requirements
---
# Helm Diagnostic Automation Evidence Layer Requirements / Helm 诊断与自动化证据层要求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文把公开 Rabetbase 仓库中可复用的 command schema、doctor、dry-run/status、
blueprint、conflict detection 和 issue report 模式，收敛成 Helm public Core 的
诊断与自动化证据层要求。

本文件不是实现承诺、发布批准、客户部署证明、connector 授权、外部系统写入许可、
自动审批许可或商业服务等级承诺。它只定义 Helm 如何把诊断、自动化准备和
Source-to-Signal 映射保持在 evidence-first、dry-run-first、review-first 的边界内。

Rabetbase 对 Helm 的主要启发是工作流形状，不是平台依赖：

- 机器可读 command metadata 可以让 agent 先知道命令风险和副作用。
- doctor 输出可以把环境、配置、权限、状态和降级证据放进同一个诊断包。
- SQL / BFF workflow 的 validate -> status -> dry-run -> push 分层可以被 Helm
  复用为 validate -> status -> dry-run -> review packet，但 Helm public Core 不做 push。
- legacy application blueprint 可以被 Helm 复用为 Source-to-Signal Blueprint，
  用来把外部代码 / schema / API 结构转成候选经营信号映射。
- issue report 模式可以被 Helm 复用为 incident packet 草稿，但默认不外发。

Helm 不 vendor Rabetbase CLI，不执行 Rabetbase 平台命令，也不把 Rabetbase 的
写入工作流带入 public Core。

## 1. 目标

诊断与自动化证据层服务三个用户：

| 用户 | 需要回答的问题 | 本层提供什么 | 本层不提供什么 |
|---|---|---|---|
| 交付工程师 | 这个 Helm fork 现在能安全做什么下一步？ | 命令注册表、doctor packet、风险提示、验证命令 | 客户部署批准、生产连接器授权 |
| Helm maintainer / owner | 自动化是否仍在 public-safe 边界内？ | risk policy、public guard、status / drift evidence | 商业 Go/No-Go 或 release approval |
| Agent / automation runner | 哪些命令可运行，哪些必须停在复核前？ | command metadata、side effect classification、output envelope | 自动外发、自动批准、自动写回、自动承诺 |

成功形态：

```text
repo / source evidence
  -> diagnostic command registry
  -> doctor packet
  -> source-to-signal blueprint
  -> review packet / incident packet
  -> human review
```

任何会改变外部系统、激活 connector、批准动作、发送消息、写入客户系统或形成客户承诺的步骤，
都不属于 public Core 自动化。

## 2. 范围

### In scope

- public-safe `DiagnosticCommandRegistry` 要求。
- `HelmDoctorPacket` 要求。
- `SourceToSignalBlueprint` 要求。
- dry-run / status / drift lifecycle 要求。
- risk policy 与 forbidden action taxonomy。
- incident / issue packet 草稿要求。
- JSON output envelope 要求。
- 后续实现的验证命令和测试要求。

### Out of scope

- 执行 Rabetbase CLI 或依赖 Rabetbase 平台。
- 生产连接器、OAuth 激活、数据同步、DB 写入、CRM 写回、BFF 发布或 SQL push。
- 自动创建 GitHub issue、PR comment、邮件、IM 消息或客户可见报告。
- 自动把 candidate 改成 accepted。
- 自动把 review packet 当成 approval。
- 跨仓自动执行私有 Pack、Overlay 或 control-plane 命令。

## 3. Command Registry 要求

Helm 应优先把自动化命令登记为机器可读 contract，而不是让 agent 通过自然语言猜测。

```ts
type DiagnosticCommandRisk =
  | "read"
  | "local_draft"
  | "repo_write"
  | "external_write"
  | "activation"
  | "commitment";

type DiagnosticCommand = {
  id: string;
  command: string;
  repoOwner: "helm-public" | "sibling-repo";
  risk: DiagnosticCommandRisk;
  sideEffects: string[];
  requiredInputs: string[];
  outputSchemaRef: string;
  evidenceRefs: string[];
  forbiddenActions: string[];
};
```

`repoOwner` 只是 ownership pointer，用来标明后续交接归属。Public Core 源码**不得**硬编码
私有 split-repo 名称（public-mirror / release guard 禁止在公开代码里出现私有仓 slug），因此
私有归属统一记为不透明的 `private-owning-repo`，具体归属由 owning repo 在公开仓之外解析；
该字段不得包含或推断私有内容、私有路径、客户配置，也不得授权跨仓自动执行。

初版 public Core 只允许 `read` 与 `local_draft` 自动化。`repo_write` 需要显式任务授权；
`external_write`、`activation`、`commitment` 不得在 public Core 自动执行。

Command registry 至少要覆盖：

| Command family | Risk | Purpose | Boundary |
|---|---|---|---|
| public docs / release guards | `read` | 证明公开文档与 public-safe scan 状态 | guard green 不等于 release-ready |
| delivery doctor | `read` | 本地环境与 Golden Path 诊断 | 不 auto-fix |
| source profiler / blueprint draft | `local_draft` | 生成候选 mapping 与 blueprints | candidate-only, no connector activation |
| incident packet draft | `local_draft` | 生成问题报告草稿 | no auto-send |
| private repo handoff reference | `read` | 标明 owning repo 和所需证据 | no cross-repo execution by default |

## 4. Doctor Packet 要求

`HelmDoctorPacket` 是一次只读诊断的可审查输出。它不应该修改 repo、写外部系统、
激活 connector、安装凭据或修复配置。

```ts
type HelmDoctorPacket = {
  packetId: string;
  generatedAt: string;
  redactionStatus: "synthetic" | "redacted" | "alias_only" | "raw_private_rejected" | "unknown";
  repo: {
    name: string;
    branch: string;
    head: string;
    dirtyState: "clean" | "dirty" | "unknown";
  };
  commandResults: Array<{
    commandId: string;
    ok: boolean;
    risk: DiagnosticCommandRisk;
    outputSummary: string;
    evidenceRefs: string[];
    degradedEvidence?: string[];
  }>;
  warnings: string[];
  blockedActions: string[];
  nextActions: string[];
};
```

Doctor packet 的核心判断是“下一步能否安全推进”，不是“系统已经 ready”。
当证据不完整时，必须输出 degraded evidence 或 blocked action，而不是增强结论。
Doctor packet 的 `repo`、`outputSummary` 和 `evidenceRefs` 也必须遵守
`redactionStatus`；任何 raw private、真实 host、凭据、tenant slug 或客户路径都必须被拒绝或脱敏。

## 5. Source-to-Signal Blueprint 要求

`SourceToSignalBlueprint` 把外部 repo、ORM、SQL schema、OpenAPI、DB catalog metadata
或 redacted source packet 转成 Helm 经营信号候选映射。

它必须保持候选性质：

- 外部 object / table / endpoint 到 Helm object 的关系只能是 `candidate`。
- AI 或 deterministic path 都不得自行设置 `accepted_by_human`。
- `accepted_by_human` / `rejected_by_human` 只能来自人工复核。
- blueprint 不激活 connector，不 materialize overlay，不写源仓，不写 Helm 私有仓。

Blueprint 的 candidate、review packet 与 signal family 词汇必须对齐
[AI 推荐治理契约](HELM_AI_RECOMMENDATION_GOVERNANCE.md)、
[Headless Signal Interface 要求](HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md) 和
[运营信号流图要求](HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md)。当 source-profiler
分支落地后，本层必须复用其 ReviewPacket / mapping-candidate contract，不另造第二套
accepted / candidate vocabulary。

建议结构：

| Section | Content | Boundary |
|---|---|---|
| Codebase Snapshot | redacted / alias-only repo structure, parser coverage, known gaps | no secret, no raw private data |
| Logic Graph | object / endpoint / schema relationships as evidence graph | no business truth claim |
| Source Binding | source family, source posture, object aliases | no production authorization claim |
| Signal Mapping Candidates | candidate mapping to Helm signal families | candidate-only |
| Coverage Gaps | missing evidence, unsupported parser, redaction gap | gap is not failure unless hard boundary |
| Manual Confirmation Items | reviewer questions and required receipts | human-held |
| Implementation Draft | local draft plan for owning repo | no external write |

## 6. Status / Drift Lifecycle

Helm 应复用 dry-run/status 思路，但不要把 status 当成执行授权。

```ts
type DiagnosticArtifactStatus =
  | "draft"
  | "dry_run_ready"
  | "review_required"
  | "accepted_by_human"
  | "rejected_by_human"
  | "materialization_deferred"
  | "blocked"
  | "stale";
```

Status 要求：

- `draft` / `dry_run_ready` / `review_required` 可由系统设置。
- `accepted_by_human` / `rejected_by_human` 只能由人工复核设置。
- `materialization_deferred` 表示需要转到 owning repo 或私有流程，不是失败。
- `stale` 由 input hash、source snapshot hash、schema version 或 command version drift 触发。
- stale/drift 只证明“需要重跑或复核”，不自动否定或批准原结论。

每个 artifact 至少保留：

| Field | Requirement |
|---|---|
| `inputHash` | deterministic hash of redacted input |
| `runHash` | deterministic hash of command, version, and relevant config |
| `redactionStatus` | `synthetic`, `redacted`, `alias_only`, `raw_private_rejected`, or `unknown` |
| `sourceRefs` | alias-only evidence references |
| `reviewRequired` | boolean |
| `forbiddenActions` | explicit list |

所有 `local_draft` 输出必须写入 `/tmp` 或显式授权、gitignored 的本地草稿目录。
不得默认写入源 repo 工作树、私有 sibling repo、客户仓库或任何外部系统。

## 7. Risk Policy

Risk policy 是机器约束，不是只写在文档里的口号。

| Risk | Public Core automation | Required gate |
|---|---|---|
| `read` | Allowed | command registry entry |
| `local_draft` | Allowed when output stays local and redacted | review-first output contract |
| `repo_write` | Ask first | explicit task authorization and git discipline |
| `external_write` | Forbidden in public automation | owning repo + human approval |
| `activation` | Forbidden in public automation | connector / control-plane owner approval |
| `commitment` | Forbidden in public automation | founder / owner-held decision record |

Forbidden actions:

- `auto_send`
- `auto_approve`
- `auto_accept_mapping`
- `activate_connector`
- `write_source_system`
- `read_business_rows`
- `materialize_overlay`
- `create_customer_commitment`

`read_business_rows` 和 `materialize_overlay` 在 public Core 自动化中无条件禁止；
人工复核或 owner approval 只能把后续动作路由到 owning repo / private process，不能在
public Core inline 放行。

## 8. Incident Packet 要求

失败、边界阻断或证据缺口可以生成 `DiagnosticIncidentPacket`。它是草稿，不是外发动作。

```ts
type DiagnosticIncidentPacket = {
  title: string;
  severity: "info" | "warning" | "blocked";
  commandId: string;
  outputSummary: string;
  evidenceRefs: string[];
  suspectedCause?: string;
  suggestedNextActions: string[];
  mustNotDo: string[];
};
```

默认行为：

- 可以写到本地 `/tmp` 或明确授权的 local draft 输出目录。
- 可以被人工复制到 issue / PR / review packet。
- 不自动创建 GitHub issue。
- 不自动评论 PR。
- 不自动发送邮件、IM 或客户报告。

## 9. Output Envelope 要求

所有机器可消费输出应使用同一 envelope，方便 agent、guard 和 reviewer 读取：

```json
{
  "ok": true,
  "command": "helm:doctor",
  "risk": "read",
  "data": {},
  "warnings": [],
  "evidenceRefs": [],
  "nextActions": []
}
```

`ok: true` 只表示命令按自身 contract 完成，不表示 release-ready、deployment-ready、
customer-approved 或 accepted-by-human。

## 10. Project Structure

后续实现建议按小切片推进：

| Area | Suggested path | Notes |
|---|---|---|
| Requirements | `docs/product/HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md` | 本文件 |
| Command registry | `lib/diagnostics/command-registry.ts` | typed contract; no network |
| Doctor packet | `lib/diagnostics/doctor-packet.ts` and `scripts/helm-diagnostic-doctor.ts` | read-only first |
| Blueprint contract | `lib/diagnostics/source-to-signal-blueprint.ts` | candidate-only |
| Incident template | `templates/diagnostics/diagnostic-incident-packet.md` | no auto-send |
| Guards / tests | `lib/diagnostics/*.test.ts`, `scripts/check-*.ts` | risk and public-safety enforcement |

Do not create these files until the corresponding implementation slice is approved.

## 11. Commands And Validation

Requirements-only changes should pass:

```bash
npm run check:public-docs
npm run check:public-release
```

Implementation slices should add targeted tests and then pass, as applicable:

```bash
npm run typecheck
npm run lint
npm run test
npm run check:boundaries
```

If a future source-profiler integration is included, the smoke command should write only to `/tmp`
or another explicit local draft directory and must keep AI / deterministic outputs candidate-only.

## 12. Success Criteria

The first implementation slice is successful only when:

1. A delivery engineer can inspect the registry and know which commands are safe to run.
2. A doctor run can produce a redacted diagnostic packet without external side effects.
3. A source-to-signal run can produce candidate mappings and manual questions without accepting them.
4. A failed or blocked run can produce an incident packet without sending it.
5. Public automation cannot cross from `local_draft` into `external_write`, `activation`, or `commitment`.
6. Guards or tests fail if an implementation adds auto-send, auto-approve, connector activation, or mapping auto-acceptance.

## 13. Open Questions

1. Should the first implementation slice be schema-only, or schema plus a read-only doctor script?
2. Should the command registry cover only `helm-public` first, or include read-only references to sibling repos?
3. Should `SourceToSignalBlueprint` live inside source-profiler once that branch lands, or remain a separate diagnostics contract?
4. Should output support compact selectors such as `--json`, `--compact`, or `--select`, and which one matches existing Helm CLI style?
5. Which private repo owns future `activation` and `external_write` receipts: `helm-overlays`, `helm-control-plane`, or both?

## 14. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-06-07 | 建立诊断与自动化证据层公开 Core 要求，吸收 Rabetbase 的 schema / doctor / dry-run / blueprint / incident packet 模式，但保留 Helm public-safe、candidate-only、review-first 边界。 |

---

## English Reference

This document defines the public Core requirements for a Helm Diagnostic
Automation Evidence Layer. It incorporates reusable public patterns from the
Rabetbase repository: command schema, doctor output, dry-run/status lifecycle,
blueprint preparation, conflict detection, and issue-report drafting.

The decision is to reuse the workflow shape, not the platform dependency. Helm
does not vendor or execute the Rabetbase CLI, and public Core must not import
Rabetbase write workflows.

The layer has three goals:

1. Let delivery engineers know which diagnostic commands are safe to run.
2. Let maintainers verify that automation remains evidence-first, dry-run-first,
   and review-first.
3. Let agents read machine-checkable risk metadata before proposing the next
   action.

Initial public Core scope:

- `DiagnosticCommandRegistry`
- `HelmDoctorPacket`
- `SourceToSignalBlueprint`
- dry-run / status / drift lifecycle
- risk policy and forbidden-action taxonomy
- incident packet draft
- common JSON output envelope

Hard boundaries:

- Candidate mappings are not accepted mappings.
- Review packets are not approvals.
- Successful commands are not release readiness.
- Public Core automation may run `read` and `local_draft` actions only.
- `local_draft` output must remain in `/tmp` or an explicit gitignored local
  draft directory.
- `external_write`, `activation`, and `commitment` require the owning repository
  and explicit human approval.
- No auto-send, auto-approve, connector activation, source-system writeback, or
  customer commitment.
- No business-row reads or overlay materialization in public Core automation.
- Doctor packets and source-to-signal blueprints must carry redaction posture and
  reuse the future source-profiler ReviewPacket / mapping-candidate contract
  rather than fork candidate vocabulary.

Future implementation should start with a small schema and read-only doctor
slice, then add source-to-signal blueprint support and guards that fail closed
when risk metadata crosses the public Core boundary.
