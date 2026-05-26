---
status: planning
owner: helm-core
created: 2026-05-01
review_after: 2026-05-15
archive_trigger:
  - External Agent Intake Phase 1 implementation closeout report 合入主干后，本实施准备文档归档
  - 2026-06-01 之后仍无对应 implementation branch，本实施准备文档必须重新评审
---

# Helm External Agent Intake Implementation Prep

## 1. 结论

Founder 已同意 `EXTERNAL_AGENT_INTAKE_PRD_DRAFT` 进入实施准备。

本轮实施准备批准的范围是：

- 将 PRD 正式入库为 active product contract。
- 准备 Phase 1 offline / fixture-backed implementation queue。
- 保留外部 Agent 输出的 candidate-only、review-first、containment-first 边界。

本轮仍不批准：

- 官方 provider API 接入。
- provider token / credential 保存。
- runtime adapter。
- 外部网络调用。
- production query adoption。
- schema migration。
- API route。
- UI。
- direct Must Push。
- direct MemoryCandidate / active memory。
- official write / auto send / auto approve / auto settlement。
- Browser / RPA 自动执行。

## 2. 受影响组件

### 2.1 本轮已触达

- `docs/product/HELM_EXTERNAL_AGENT_INTAKE_PRD.md`
- `docs/reviews/HELM_EXTERNAL_AGENT_INTAKE_IMPLEMENTATION_PREP.md`
- `docs/README.md`

### 2.2 下一轮实施可能触达

- `features/external-agent-intake/provider-registry.ts`
- `features/external-agent-intake/provider-fixtures.ts`
- `features/external-agent-intake/artifact-contract.ts`
- `features/external-agent-intake/intake-decision.ts`
- `features/external-agent-intake/*.test.ts`
- `scripts/external-agent-intake-eval.ts`
- `package.json`
- `docs/product/EXTERNAL_AGENT_INTAKE_TO_BUSINESS_ADVANCEMENT_PLAN.md`

下一轮实施不得触达 Prisma schema、production DB query、runtime adapter、API route、UI 或任何 external side-effect path，除非 owner 另行批准。

## 3. 实施顺序

### Task 1: Provider Registry Types + Fixtures

目标：把 Coze manual、OpenClaw local、Dify manual 收成纯 TypeScript provider profile 和 fixture。

Acceptance:

- 三个 provider profile 均存在。
- `maxEffectMode` 不得为 `side_effecting`。
- 每个 provider 的 `prohibitedUses` 必须覆盖 direct Must Push、direct memory、send、official write。
- 缺 provider profile 的 artifact 必须在后续 evaluator 中 `reject`。

Verify:

```bash
npx vitest run features/external-agent-intake/provider-registry.test.ts
```

### Task 2: Artifact Contract + Intake Evaluator

目标：实现 `ExternalAgentArtifact -> ExternalAgentIntakeDecision` 的纯函数 evaluator。

Acceptance:

- 15 条 fixture 均输出预期 disposition。
- `authority_exceeded`、`cross_tenant_risk`、external write claim 均 `quarantine`。
- 缺必填字段或 provider profile missing 均 `reject`。
- `mayCreateMustPushCandidate=false` always。
- `mayCreateMemoryCandidate=false` always。
- accepted / review-required 输出必须有 boundary note。

Verify:

```bash
npx vitest run features/external-agent-intake/intake-decision.test.ts
```

### Task 3: Offline Eval CLI

目标：提供可复跑的 local fixture eval gate。

Acceptance:

- `npm run eval:external-agent-intake` 可运行。
- 输出最小 gate metrics。
- 不读取 production DB。
- 不发起网络请求。
- 不读取 provider credential。

Verify:

```bash
npm run eval:external-agent-intake
```

### Task 4: Business Advancement Mapping Plan

目标：把 intake disposition 映射到 Business Advancement candidate layers，但不进入 runtime。

Acceptance:

- `accept_as_evidence_candidate` 只能作为 supporting evidence candidate。
- `accept_as_draft_candidate` 只能作为 review packet draft attachment。
- `review_required` 只能进入 review packet candidate。
- `watch_only` 只观察。
- `reject` 无 downstream mapping。
- `quarantine` 进入 containment report。
- 明确禁止 direct Must Push、direct MemoryCandidate、official write、send。

Verify:

```bash
npm run check:boundaries
```

## 4. 协同方式

Codex 负责指挥 / 审计 / 验收：

- 固定任务边界。
- 检查代码是否只落在 Phase 1 offline fixture scope。
- 审计是否越过 Must Push、Memory、production query、official write 边界。
- 运行验证并给出 Go / Revise / No-Go。

Claude Code 可负责 bounded implementation：

- 按 Task 1 -> Task 2 -> Task 3 -> Task 4 顺序执行。
- 每个 task 原子提交或至少原子 diff。
- 遇到 schema、runtime、API、credential、network、UI、production query 需求时停下报告。
- 不主动扩展 provider，不加入 Wukong / LangGraph / CrewAI，除非另有 founder decision。

## 5. 验证方案

下一轮实现完成后至少运行：

```bash
npx vitest run features/external-agent-intake/provider-registry.test.ts
npx vitest run features/external-agent-intake/intake-decision.test.ts
npm run eval:external-agent-intake
npm run check:boundaries
npm run check:public-release
npm run typecheck
npm run lint
```

如实现只触达纯函数和脚本，可先用 targeted tests closeout；合入前再补仓库级验证。

## 6. Go / No-Go Gate

### Go

- 15 条 fixture 全部 deterministically pass。
- `directMustPushCreated=0`。
- `directMemoryCandidateCreated=0`。
- `finalRankingInfluencedByExternalAgent=0`。
- `acceptedWithoutBoundaryNote=0`。
- `acceptedWithUnsupportedPII=0`。

### Revise

- Low-trust provider 能进入 review，但 boundary note 不稳定。
- OpenClaw local 的 trace 不足导致过多 `review_required`，但未越权。
- Dify / Coze manual import 中 `redactionStatus=unknown` 的处理需要更精细。

### No-Go

- 外部 Agent 输出能直接创建 Must Push。
- 外部 Agent 输出能直接创建 MemoryCandidate 或 active memory。
- provider confidence 被当作 Helm confidence。
- tool receipt 被当作 official write success。
- workflow trace 被当作 business outcome。
- evaluator 读取 production DB、provider API、credential 或网络。

## 7. 剩余风险

- Coze、Dify、悟空等平台的实际审计能力和数据驻留声明可能随产品变化，需要 provider profile 定期复核。
- OpenClaw local 更接近 bounded worker runtime，但当前不能视作多租户安全边界。
- Manual import 可先验证 contract，但不能证明官方 API 集成可行。
- External agent evidence 进入 Business Advancement 后，仍需要 object / signal validity gate 继续守住 stale、contradictory、cross-tenant、unsafe、duplicate/noisy signals。

## 8. 下一步

1. 开 implementation branch。
2. 先由 Claude Code 执行 Task 1，Codex 审计 provider profile 和 prohibited uses。
3. Task 1 通过后再进入 Task 2，不并行改 evaluator 与 mapping plan。
4. Task 2 / Task 3 通过后，再写 Business Advancement mapping plan。
5. 最后形成 Phase 1 closeout report，并决定是否进入 manual import demo。

## 9. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-01 | 首版：根据 founder approval，把 External Agent Intake 从本地 PRD 转入仓库实施准备 |
