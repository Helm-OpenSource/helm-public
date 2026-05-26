---
status: active
owner: helm-core
created: 2026-05-01
review_after: 2026-06-15
archive_trigger:
  - External Agent Intake Phase 2 接管 manual import demo（runtime adapter / API / UI 至少其中之一获 owner approval 并替换本 runbook 描述的 manual JSON path）
  - manual import demo JSON 合同发生 breaking change 且本 runbook 未在 14 天内同步更新
  - 2026-08-01 后 manual import demo 路径仍未被任何 implementation engineer 使用且无新 fixture 加入，runbook 进入归档评审
---

# Helm External Agent Intake — Manual Import Demo Runbook

本文件描述 External Agent Intake Phase 1 的 **manual import demo**：把 Coze、OpenClaw、Dify 等外部智能体输出（也包括失败用例）整理成 fixture-like JSON，离线跑 `evaluateExternalAgentArtifact`，得到 disposition / reason / boundary，向 founder / governance reviewer / implementation engineer 演示 Helm 的 candidate-only intake 边界。

**适用范围**：本地仓库内开发 / 演示 / 复核。**不**接 production query、provider API、credential、runtime adapter、API route、UI、schema migration、official write、send、memory write、Must Push creation。

## 1. 关键边界

- **不接 provider API**：Coze / OpenClaw / Dify 的官方双向 API 第一阶段不接，credential 不存。
- **不写真值**：外部 Agent 输出最多进入 candidate / review packet / containment report；不直接 Must Push、不直接写记忆、不 official write、不发送。
- **不写 schema**：本 runbook 涉及的所有路径都是 fixture-like JSON、纯 TypeScript loader、CLI eval。
- **建议 ≠ 承诺**：任何来自外部 Agent 的 customer-facing wording 都必须当作建议处理，需要人工复核才能转化为承诺。
- **断网可跑**：`npm run eval:external-agent-intake -- --input-file <path>` 不依赖网络、DB、provider client。

## 2. 输入合同：从外部 Agent 输出到 ExternalAgentArtifact

每条输入必须遵守 [`features/external-agent-intake/artifact-contract.ts`](../../features/external-agent-intake/artifact-contract.ts) 的 `ExternalAgentArtifact` 结构。**必填字段**：

| 字段 | 说明 |
| --- | --- |
| `artifactId` | demo 内唯一 ID，避免泄露真实 provider artifact id |
| `workspaceId` | 必须等于本次评估的 expected workspace id |
| `providerId` | 必须落在已注册 provider：`coze_manual`、`openclaw_local`、`dify_manual`（其它 provider 走 `reject` 用例） |
| `artifactKind` | `evidence_candidate` / `draft_candidate` / `analysis_candidate` / `retrieval_candidate` / `tool_receipt` / `workflow_trace` / `error_report` |
| `createdAt` | ISO8601 |
| `actorVisibleSummary` | 一句话演示用摘要，必须 redacted |
| `rawOutputHash` | `sha256:` 前缀的占位 hash，不是真实哈希 |
| `redactionStatus` | `redacted` / `alias_only` 才能进 evidence / draft path；`contains_pii` / `unknown` 会触发 quarantine 或 review |
| `declaredSideEffects` | 数组，至少 1 条；`external_write_attempted` / `tool_called` / `unknown` 会触发 quarantine |
| `contentSummary` | 一句话内容摘要；不要塞原文 |

**可选字段**：`providerArtifactRef`、`sourceTimestamp`、`actorRef`、`objectRef`、`providerTraceRefs`、`citationsOrEvidenceRefs`、`providerConfidenceClaim`、`contentShape`。

**demo 专用字段**（loader 接受，evaluator 忽略）：

- `expectedDisposition`：CLI gate 用来对比；填 `IntakeDisposition` 之一。
- `demoNotes`：CLI 输出时打印，便于 reviewer 一眼看懂为什么这条被这样判。

### 2.1 转换流程

1. 从 Coze / OpenClaw / Dify 拷贝 raw output 到本地临时文件。
2. **redact**：把客户名、人员姓名、电话、邮箱、合同金额、内部链接等替换成占位值（`redacted_*` / `opp_redacted_*` / `meeting_redacted_*`）；保留结构化字段名。
3. 选定 `artifactKind`（output 是 evidence？draft？analysis？retrieval？tool receipt？workflow trace？）。
4. 选定 `redactionStatus`（已脱敏 → `redacted`；只用别名 → `alias_only`；含 PII → `contains_pii`；不确定 → `unknown`）。
5. 填 `declaredSideEffects`：仅 read → `["read"]`；只生成草稿 → `["draft_created"]`；显示成功调用工具或外部写 → `["tool_called"]` 或 `["external_write_attempted"]`。
6. 把对象写到 `evals/external-agent-intake/<your-demo>.json` 的 `artifacts` 数组里（也支持纯数组形式）。

### 2.2 文件结构

支持两种顶层形态：

```jsonc
// 形态 A：包装对象（推荐）
{
  "metadata": {
    "workspaceId": "workspace_external_agent_fixture",
    "referenceTimeIso": "2026-05-01T00:00:00.000Z",
    "description": "demo 用途说明"
  },
  "artifacts": [ /* ExternalAgentArtifact[] */ ]
}

// 形态 B：纯数组
[ /* ExternalAgentArtifact[] */ ]
```

`metadata.workspaceId` 是默认 expected workspace；CLI `--workspace-id` 优先级更高。`metadata.referenceTimeIso` 用于 stale 判断；缺省时回退到 fixture 默认 `2026-05-01T00:00:00.000Z`。

## 3. 跑 CLI

```bash
# 默认 15 条 fixture 闸门（保持 Phase 1 closeout 行为不变）
npm run eval:external-agent-intake

# manual import 模式：评估本地 demo JSON
npm run eval:external-agent-intake -- \
  --input-file evals/external-agent-intake/manual-import-demo.json \
  --workspace-id workspace_external_agent_fixture

# boundary demo readout：演示“能接外部 Agent，但不被外部 Agent 带偏”
npm run demo:external-agent-boundary

# 输出结构化 JSON，供内部审计或 demo 自动化读取
npm run demo:external-agent-boundary -- --format json
```

**退出码**：

- `0`：load + 全部 expected disposition 命中 + boundary note 完整 + 没有 PII 透传 + 没有 direct Must Push / direct memory。
- `1`：load / parse 失败，或 gate 项任何一条不通过。
- `2`：CLI 参数错误。

### 3.1 Boundary demo readout

`npm run demo:external-agent-boundary` 复用同一个 manual import JSON，但输出更适合 founder / customer / reviewer 现场演示的 readout：

- `Boundary Headlines` 固定展示：can ingest、cannot commit、cannot write memory、cannot rank、quarantine unsafe output。
- `Hard Safety Counters` 固定暴露：`directMustPushCreated=0`、`directMemoryCreated=0`、`officialWriteCreated=0`、`finalRankingInfluenced=0`。
- `Mapping Lanes` 把 disposition 翻译成允许路径：supporting evidence candidate、draft review attachment、review packet、watch-only、rejected、quarantined。
- `Artifact Rows` 展示每条 artifact 的 `providerId`、`disposition`、`containment`、`mayAttachToSignal`、`mustRequireReview`、`reasonCodes`、`boundaryNote`。

这条命令仍然是 **offline demo-only**：不接 production query、provider API、credential、runtime adapter、API route、UI、schema migration、official write、send、memory write、Must Push creation 或 final ranking。

## 4. 读懂输出

CLI 每条 artifact 输出：

- `disposition`：六档之一。
- `containment`：`none` / `downgraded` / `rejected` / `quarantined`。
- `mayAttach`：是否能进 supporting evidence candidate（仅 `accept_as_evidence_candidate` 为 true）。
- `review`：`mustRequireReview` 真值。
- `reasons`：reason codes 列表，用于解释判断。
- `boundary`：人类可读的边界注解，确保所有非 reject / non-watch_only 输出都附带。
- `notes`：来自 demo JSON 的 `demoNotes`，向 reviewer 说明 expected case 立意。

| disposition | 后续允许的 mapping |
| --- | --- |
| `accept_as_evidence_candidate` | 作为 supporting evidence candidate 附在 review packet；**不**直接进 Must Push / memory |
| `accept_as_draft_candidate` | 作为 review packet 草稿附件；draft ≠ sent |
| `review_required` | 进 review packet candidate，等待人工复核 |
| `watch_only` | 仅观察，不下游映射 |
| `reject` | 不下游映射 |
| `quarantine` | 进 containment report，不下游映射 |

## 5. 失败用例（demo 必须包含的反例）

| 反例 | 触发原因 | 期望 disposition |
| --- | --- | --- |
| 未注册 provider | `providerId` 不在已注册集合 | `reject` |
| 缺必填字段 | 缺 `rawOutputHash` 或其它 required 字段 | `reject` |
| 跨 workspace | artifact `workspaceId` ≠ CLI / metadata workspace | `quarantine` |
| 含 PII | `redactionStatus=contains_pii` 且 provider 不支持 redaction | `quarantine` |
| 声明外部写 | `declaredSideEffects` 含 `external_write_attempted`、`tool_called`、`unknown` | `quarantine` |
| 内容暗示外部写 | `contentSummary` 含 “CRM 已更新 / already sent / approved / settled” 等关键词 | `quarantine` |

## 6. 仍然 No-Go

第一阶段 manual import demo 仅证明 **fixture-backed 离线判断链** 通畅，以下能力**全部继续 No-Go**：

1. provider 官方 API、双向 token、credential 存储。
2. runtime adapter、API route、UI、schema migration、production query。
3. 直接生成 Must Push、直接写公司记忆、官方 CRM write、自动发送、自动审批、自动结算。
4. 影响 Must Push final ranking 或 active memory。
5. 任何会被外部读者误解为 commitment 的客户面向 wording。

任何想突破上述边界的尝试，必须先 owner 显式批准，再走独立 implementation plan + closeout report。

## 7. 相关文件

- PRD：[HELM_EXTERNAL_AGENT_INTAKE_PRD.md](HELM_EXTERNAL_AGENT_INTAKE_PRD.md)
- Phase 1 closeout：[HELM_EXTERNAL_AGENT_INTAKE_PHASE1_CLOSEOUT.md](../reviews/HELM_EXTERNAL_AGENT_INTAKE_PHASE1_CLOSEOUT.md)
- Mapping plan：[EXTERNAL_AGENT_INTAKE_TO_BUSINESS_ADVANCEMENT_PLAN.md](EXTERNAL_AGENT_INTAKE_TO_BUSINESS_ADVANCEMENT_PLAN.md)
- 代码：
  - [`features/external-agent-intake/artifact-contract.ts`](../../features/external-agent-intake/artifact-contract.ts)
  - [`features/external-agent-intake/intake-decision.ts`](../../features/external-agent-intake/intake-decision.ts)
  - [`features/external-agent-intake/manual-import.ts`](../../features/external-agent-intake/manual-import.ts)
  - [`features/external-agent-intake/demo-readout.ts`](../../features/external-agent-intake/demo-readout.ts)
  - [`features/external-agent-intake/manual-import.test.ts`](../../features/external-agent-intake/manual-import.test.ts)
  - [`features/external-agent-intake/demo-readout.test.ts`](../../features/external-agent-intake/demo-readout.test.ts)
  - [`scripts/external-agent-intake-eval.ts`](../../scripts/external-agent-intake-eval.ts)
  - [`scripts/external-agent-boundary-demo.ts`](../../scripts/external-agent-boundary-demo.ts)
- Demo 输入：[`evals/external-agent-intake/manual-import-demo.json`](../../evals/external-agent-intake/manual-import-demo.json)

## 8. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-01 | boundary demo readout 落地：`features/external-agent-intake/demo-readout.ts` + `npm run demo:external-agent-boundary`，把 candidate-only intake 映射成可演示的 headline / hard safety counters / provider breakdown / mapping lanes / artifact rows；仍然 offline demo-only |
| 2026-05-01 | manual import demo 落地：fixture-like JSON、loader / validator、`--input-file` / `--workspace-id` CLI、6 条覆盖 Coze / OpenClaw / Dify 与失败用例的 demo records、runbook 与 docs 同步 |
