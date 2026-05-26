---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-06-02
archive_trigger:
  - Agentic Governance Phase 2 requirements document replaces this file and is indexed in docs/README.md
  - 2026-07-02 后本文件无对应 implementation PR 或 eval 引用，进入归档评审
---

# Helm Agentic Governance Requirements

## 1. 结论

本需求把 2026-05-02 已接受的企业 AI / agentic governance 能力建议收成 Helm 可执行范围。本文不是市场调研原文，也不保存竞争情报细节；只保留已经进入实施队列的需求、边界、验收和验证入口。

当前批准的实现姿态：

- P0：外部 agent outcome 结构化、候选 action trace、admin-visible connector permission summary。**当前已落地为 offline / fixture-backed gate，并已接入 `/settings` 只读治理展示**。
- P1：agentic enterprise 文案改写、back-office evidence / gap / pre-approval reminder、safe agent artifact intake 扩展。**当前已落地为 offline guards / expansion / readout packet；后续仅允许 narrow follow-up 扩 curated docs scan、provider-class / fixture 和只读 surface planning，不授权 provider API、credential、runtime adoption、schema、UI action 或 execution plane**。

本需求不授权 Helm 成为完整 agent OS、autonomous workforce、workflow / orchestration platform、CRM / BI / ERP 或自动执行平面。

### 2026-05-03 市场信号校准

后续新出现的 workspace agent、managed cloud agent、workflow framework、memory / context system 和 agentic enterprise control tower 叙事，只有在满足以下条件后才能进入本需求的下一层切片：

- 先落成 provider class / artifact class / governance trace / permission summary / boundary reason code 的离线候选，不直接接 provider API、credential、runtime adapter、schema、production query 或 UI action。
- memory / context 类 provider 只能进入 memory candidate / evidence candidate，不允许 active memory write、direct Must Push 或 final ranking influence。
- workflow / orchestration 类 provider 只能作为 framework-level risk 和 trace/evidence source，不允许被表述成 Helm workflow builder、agent graph 或 orchestration runtime。
- managed cloud / workspace agent 类 provider 必须先证明 tenant isolation、redaction、trace completeness、connector permission summary 和 review-required action boundary，再进入任何 runtime 评估。

## 1.1 当前实施状态

| 范围 | 状态 | 当前证据 | 下一层 |
|---|---|---|---|
| Market-signal provider-class gate | 已落地为 offline gate | `features/agentic-governance/market-signal-provider-class.ts`、`npm run eval:agentic-governance` | 只允许 provider class / artifact class / boundary reason 的离线候选，不接 provider runtime |
| P0 outcome / trace gate | 已落地为 offline gate | `features/external-agent-intake/*`、`npm run eval:external-agent-intake`、`npm run eval:agentic-governance` | 继续保持 candidate-only，不接 runtime |
| P0 connector permission summary | 已落地为 offline gate + `/settings` 只读展示 | `features/agentic-governance/connector-permission-summary.ts`、`features/settings/components/connector-permission-summary-panel.tsx`、`/settings?tab=connectors` | 不得做权限编辑器、连接器控制面或 runtime 执行授权 |
| P1 messaging rewrite guard | 已落地为 offline guard + docs scan | `features/agentic-governance/messaging-rewrite-guard.ts`、`scripts/agentic-governance-eval.ts`、`npm run eval:agentic-governance` | 后续只允许 narrow follow-up 扩 curated docs scan 范围，不得做 runtime rewrite |
| P1 back-office evidence / gap / pre-approval reminder | 已落地为 offline guard + readout packet | `features/agentic-governance/back-office-governance-signal.ts`、`npm run eval:agentic-governance` | 后续页面入口必须单独开窄只读切片，不接 Salesforce runtime write |
| P1 safe artifact intake reason-code expansion | 已落地为 offline expansion | `features/external-agent-intake/intake-decision.ts`、`features/external-agent-intake/provider-fixtures.ts`、`npm run eval:external-agent-intake` | 只允许 narrow follow-up 扩 reason codes / fixtures，不扩 provider API、credential、runtime、schema、UI action 或 execution plane |

## 1.2 本需求的成功口径

本需求成立必须同时满足：

- 新 market signal 必须先进入 provider class / artifact class / boundary reason 的 offline gate；不得直接变成 provider API、credential、runtime adapter、schema、UI action 或 workflow builder。
- 每个外部 agent 结果都有结构化 outcome，不把 refused / blocked / unsupported / error 吞成成功。
- 每个 accepted evidence / draft candidate 都有 workspace-scoped、redacted 或 alias-only 的 governance trace。
- 每个首批 connector 都有 auto / review / never 三轨权限摘要。
- `/settings?tab=connectors` 能以只读方式展示 connector permission summary，且没有按钮、表单、链接或权限写入口。
- P1 文案、防后勤证据和 artifact intake 扩展都能离线验证，且 direct Must Push / direct Memory / official write / auto-send / final ranking influence 均为 0。
- 所有新增能力保持 review-first / candidate-only / no hidden runtime adoption。

## 2. 总边界

所有需求继续遵守：

- `recommendation != commitment`
- `review-before-commitment`
- `judgement-first`
- `decision-first`
- `controlled-trial`
- no auto-send
- no silent CRM write
- no auto-approve
- no auto-settlement
- no direct Must Push / Memory write from external agent output
- no provider credential storage
- no production query adoption
- no hidden UI / API / runtime enablement
- no LLM final ranking in commitment path

任何需求如果不能解释“为什么 Helm 可以信它、如何复核、失败时如何降级、事后如何回放”，不得进入实现。

## 3. P0-1 Agent Outcome 结构化状态

**当前状态**：已在 External Agent Intake P0 扩展中落地为 offline / fixture-backed gate。

### 目标

把外部 agent / LLM / connector 返回结果统一降成 Helm 可治理状态。

### 合同

标准 outcome：

- `completed`
- `refused`
- `blocked`
- `needs_review`
- `unsupported`
- `error`

### 规则

- `refused` 是一等结果，不允许吞掉、重试成空结果或误判为系统错误。
- `blocked` 表示触碰 send / approve / pay / CRM write / commitment 等边界。
- `needs_review` 表示可作为候选证据，但必须进入人工复核。
- `unsupported` 只能观察，不得驱动候选动作。
- `error` 不能升格为证据、draft 或 action。

### 验收

- fixture 覆盖 6 类 outcome。
- `refused` 不触发 retry / promotion。
- `blocked` 不能进入 official write / send / commitment lane。
- `needs_review` 不能绕过人工复核进入 accepted lane。
- `unsupported` 只能 watch-only 或 rejected。
- `error` 不能成为 evidence、draft、action 或 ranking input。
- eval 输出 direct Must Push / direct Memory / final ranking influence 均为 0。

## 4. P0-2 Agent / Connector Action Trace

**当前状态**：已作为 accepted candidate gate 落地；无 trace 或 trace redaction invalid 的 draft candidate 必须降级为 `review_required`。

### 目标

所有 agent / connector 候选动作必须有可回放 trace，支持审计、复核和失败恢复。

### 合同

trace 至少包含：

- `traceId`
- `source`
- `actorType`
- `workspaceId`
- `objectRef`
- `inputEvidenceRefs`
- `proposedAction`
- `outcomeStatus`
- `boundaryDecision`
- `createdAt`
- `redactionStatus`

### 规则

- accepted evidence / draft candidate 必须有 governance trace。
- trace 必须 workspace-scoped。
- trace 不保存 raw PII；只允许 `redacted` 或 `alias_only`。
- customer-visible / CRM write / approval / payment 类动作必须显示 `review_required` 或被 quarantine。
- trace 只能证明“候选动作如何产生”，不能证明外部动作已成功执行。

### 验收

- accepted candidate without governance trace = 0。
- trace redaction invalid 不能被接受。
- 无 trace 的 draft candidate 降级为 `review_required`。
- cross-workspace trace 必须 quarantine。
- trace 中 outcome / boundary 与 artifact 主字段冲突时，按更保守结果处理。

## 5. P0-3 Admin-visible Connector Permission Summary

**当前状态**：已落地为 offline summary contract、`eval:agentic-governance` 的一部分，并已在 `/settings?tab=connectors` 接入只读 admin-visible surface。

### 目标

管理员能看懂每个连接器“读什么、准备什么、永远不做什么”。

### 合同

每个 connector 必须声明：

- `dataScopes`
- `autoAllowed`
- `reviewRequired`
- `neverAllowed`
- `credentialPosture`
- `syncPosture`
- `boundaryNote`

### 首批覆盖

- HubSpot
- Salesforce
- Gmail
- AliMail
- DingTalk
- WeCom

### 规则

- 高风险动作不得进入 `autoAllowed`。
- `send`、customer-visible reply、CRM stage write、payment、approval、commitment 必须进入 `reviewRequired` 或 `neverAllowed`。
- 缺凭据或 alpha connector 要显示 `placeholder` / `dry_run_only`，不静默假装 ready。

### 验收

- 6 个 connector 都有三轨 summary。
- auto-send / CRM auto-write / payment auto-action 计数为 0。
- 每个 summary 都有 boundary note。
- `placeholder` / `dry_run_only` connector 不能显示为 fully ready。
- `/settings` surface 只展示 read / auto / review / never / credential / sync / boundary，不提供权限编辑、连接器控制、发送、写回或执行按钮。
- 如果后续新增 connector，必须先补 summary 和 eval 覆盖，再进入任何 UI / runtime 讨论。

## 6. P1-1 Agentic Enterprise Messaging Rewrite

### 目标

吸收市场热词，但统一改写为 Helm 的经营推进控制台口径。

### 规则

- 禁止把 Helm 写成 `autonomous workforce`、完整 `agent OS`、完整 `workflow/orchestration platform`。
- 可用表达：`经营推进控制台`、`judgement layer`、`review-first business advancement surface`。
- customer-facing 文案遇到 agentic / autonomous / execution 词时，必须附 boundary note。

### 合同

新增 messaging guard 时，只允许做：

- 静态 fixture / copy lint。
- customer-facing wording 的禁用词和替代表达映射。
- boundary note presence check。
- docs / README / product copy 的回归检查。

不得做：

- runtime rewrite service。
- LLM 自动改写生产文案。
- 自动发布外部 claim。
- 将 agentic / autonomous 词汇变成产品承诺。

### 验收

- `agent OS`、`autonomous workforce`、`workflow/orchestration platform` 只能出现在禁止事项、边界说明或竞品差异化说明中。
- customer-facing 文案中的 `agentic` / `autonomous` / `execution` 必须有 boundary note 或被改写。
- messaging guard 输出不能改变运行时代码路径。
- `npm run eval:agentic-governance` 必须扫描 curated README / docs / product copy；document candidate 需要 rewrite 或 reject 时 gate 失败。

## 7. P1-2 Back-office Evidence / Gap / Pre-approval Reminder

### 目标

从 Salesforce back-office execution 只吸收流程证据、缺口和审批前提醒。

### 规则

- back-office 信号降成 `process_evidence`、`operating_gap`、`pre_approval_reminder`。
- 只进入 review packet / Must Push candidate / report readout。
- contract、invoice、payment、approval、CRM stage write 只生成提醒和证据，不执行。
- 每个提醒必须带 owner、deadline、risk、evidence refs。

### 合同

首批只允许 fixture / evaluator 形态：

```ts
type BackOfficeGovernanceSignalKind =
  | "process_evidence"
  | "operating_gap"
  | "pre_approval_reminder";

interface BackOfficeGovernanceSignal {
  signalId: string;
  workspaceId: string;
  sourceSystem: "salesforce" | "hubspot" | "manual_fixture" | "unknown";
  kind: BackOfficeGovernanceSignalKind;
  objectRef?: {
    type: "opportunity" | "company" | "contract" | "invoice" | "approval" | "unknown";
    id?: string;
  };
  ownerRef: string;
  deadlineIso?: string;
  risk: "low" | "medium" | "high";
  evidenceRefs: string[];
  declaredExternalEffect: "none" | "crm_stage_write" | "contract_send" | "invoice_issue" | "payment_execute" | "approval_execute" | "unknown";
  boundaryDecision: "review_packet_only" | "must_push_candidate_only" | "report_readout_only" | "reject" | "quarantine";
  boundaryNote: string;
}
```

### 验收

- 每条 accepted signal 都有 owner、risk、evidenceRefs、boundaryNote。
- 缺 owner / evidence / boundary note 的 signal 必须 reject 或降级。
- contract / invoice / payment / approval / CRM stage write 相关 signal 的 `boundaryDecision` 不得包含 execution。
- back-office signal 不能触发 official write、auto approval、auto settlement 或 silent CRM write。
- readout packet 只能包含 review packet / Must Push candidate / report readout 三条只读 lane；不得包含 source-system execution authority，且 accepted decision 与 readout item 不能出现 identity mismatch。

## 8. P1-3 Safe Agent Artifact Intake

### 目标

把 Citi Arc / 外部 agent OS 思路改写成“安全 agent 产物候选证据接入”。

### 规则

- 外部 agent 产物只能进入 `ExternalAgentArtifact -> ExternalAgentIntakeDecision`。
- 允许 lane：supporting evidence candidate、review packet draft attachment、observation、containment report。
- 禁止 direct Must Push、direct MemoryCandidate、official write、send、final ranking input。
- 继续默认 offline / fixture-backed / candidate-only。

### 扩展范围

下一层只允许扩：

- outcome-aware reason codes。
- governance trace conflict reason codes。
- connector permission summary 关联 reason codes。
- demo readout 中的 boundary explanation。

不允许扩：

- provider API。
- credential。
- runtime adapter。
- schema migration。
- production query。
- UI action button。

### 验收

- 新 reason code 必须在 fixture、unit test、eval summary 三处可见。
- reason code 只能解释降级 / 接受 / quarantine 原因，不能赋予执行权限。
- external artifact 仍最多进入 supporting evidence candidate、review packet draft attachment、observation 或 containment report。

## 9. 实施顺序

已完成：

1. P0 outcome + trace contract。
2. P0 connector permission summary offline gate。
3. P0 `/settings` connector permission summary read-only surface。
4. P1 messaging rewrite guard。
5. P1 back-office evidence / gap / pre-approval reminder fixtures。
6. P1 safe artifact intake reason-code expansion。

下一步建议顺序：

1. Phase 2 requirements：只有 P0/P1 eval、`/settings` 只读 surface 与文档边界持续通过后再写，不提前授权 runtime。
2. 如需 `/operating` resource card 入口，必须单独开窄需求；不得从 settings readout 顺手扩成执行按钮。
3. connector 新增或 runtime 评估前，必须先补 permission summary、fixtures、reason codes 和 eval 覆盖。

## 10. Stop Conditions

出现任一情况，本需求线必须停止并进入 owner review：

1. 任意外部 agent 输出直接创建 Must Push、MemoryCandidate、official write、send、approval、settlement。
2. 任意 accepted evidence / draft candidate 缺 governance trace 或 trace 非 redacted / alias-only。
3. 任意 connector summary 把 send、CRM stage write、payment、approval、commitment 放进 `autoAllowed`。
4. 任意 P1 messaging guard 把 Helm 表述成完整 agent OS、autonomous workforce 或 workflow/orchestration platform。
5. 任意 back-office signal 绕过 review packet，直接触发 contract、invoice、payment、approval 或 CRM stage write。
6. 任意 artifact intake reason code 被用于提升执行权限，而不是解释 judgement。
7. 任意实现引入 provider credential、runtime adapter、API route、schema migration、production query 或 UI action button。
8. 任意输出泄露 raw PII、raw provider payload、token、credential、未经脱敏客户原文。
9. eval 中 direct Must Push / direct Memory / official write / final ranking influence 任一计数非 0。
10. 文档或 README 产生 customer-facing commitment 误读，且未带 boundary / prerequisite / dependency / non-commitment note。
11. `/settings` connector permission summary 出现按钮、表单、链接、发送、写回、连接器控制或权限编辑入口。

## 11. 验证命令

目标验证：

```bash
npx vitest run features/external-agent-intake/intake-decision.test.ts features/external-agent-intake/manual-import.test.ts features/agentic-governance/connector-permission-summary.test.ts
npm run eval:agentic-governance
npm run eval:external-agent-intake -- --input-file evals/external-agent-intake/manual-import-demo.json
npm run check:boundaries
npm run typecheck
```

如果本文件仅做 requirements 修订，最小验证为：

```bash
git diff --check -- docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md
npm run check:boundaries
```

完整仓库级验证仍按 AGENTS.md §10 执行；若未跑完整链路，closeout 必须说明原因和剩余风险。

## 12. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-03 | 实施：back-office evidence / gap / pre-approval reminder offline readout packet 接入 `npm run eval:agentic-governance`，readout authority leak 为 0 |
| 2026-05-03 | 实施：market-signal provider-class offline gate 接入 `npm run eval:agentic-governance`，覆盖 workspace agent、managed cloud agent、workflow framework、memory/context system 与 agentic control tower |
| 2026-05-03 | 实施：P1 docs / README / product copy regression guard 接入 `npm run eval:agentic-governance`，当前扫描 3 份文档并要求 doc rewrite / reject 为 0 |
| 2026-05-03 | 口径修正：明确 P1 offline guards / expansion / readout packet 已落地；后续仅允许 narrow follow-up 扩 curated docs scan、provider-class / fixture 和只读 surface planning，不授权 provider API、credential、runtime adoption、schema、UI action 或 execution plane |
| 2026-05-03 | 校准：新增 generic market-signal provider-class 吸收规则，明确 workspace agent、managed cloud agent、workflow framework、memory/context system 只能先进入离线候选和治理证据，不授权 provider API、credential、runtime、schema、UI action、workflow builder、agent marketplace、AI OS 或自动执行 |
| 2026-05-02 | 实施：P0 connector permission summary 接入 `/settings?tab=connectors` 只读 admin-visible surface，新增组件测试并保持 no permission editor / no control plane |
| 2026-05-02 | 实施：P1 safe artifact intake reason-code expansion 落地，新增 trace conflict 与 connector permission bypass gate |
| 2026-05-02 | 实施：P1 back-office evidence / gap / pre-approval reminder guard 落地为 offline fixture gate，并接入 `npm run eval:agentic-governance` |
| 2026-05-02 | 实施：P1 messaging rewrite guard 落地为 offline fixture gate，并接入 `npm run eval:agentic-governance` |
| 2026-05-02 | 修订：对齐 P0 offline gate 已落地状态，补 P1 合同、Stop Conditions、验证命令，并移除重复标题 |
| 2026-05-02 | 首版：确认 6 条竞争情报建议进入实施，并固定 P0/P1 范围与边界 |
