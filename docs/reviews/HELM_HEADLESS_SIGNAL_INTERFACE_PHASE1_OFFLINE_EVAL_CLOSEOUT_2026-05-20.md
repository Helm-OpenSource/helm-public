---
status: active
owner: Product / GTM / Delivery Engineering / Engineering
created: 2026-05-20
source_requirement: ../product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md
review_mode: phase-1-offline-eval-closeout
---

# Helm Headless Signal Interface Phase 1 Offline Eval Closeout

日期：2026-05-20
状态：Phase 1 offline gate 已落地

## 1. 结论

本轮把 [HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md](../product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md) 的 Phase 1 DoD 落成可运行离线质量门：

- `lib/headless-signal-interface/pack-manifest.ts` — HSI-01 TS 契约 + `validateHsiPackManifest`
- `lib/headless-signal-interface/facade-types.ts` — HSI-03 五个允许 facade 的 TS 形状，`prepare_review_packet` 的 HSI-04 preparation-only 不变式以字面量类型固化
- `lib/headless-signal-interface/pack-artifacts.ts` — HSI-01 review packet template + payload example set 的 TS 类型与 validator
- `extensions/case-management-sample/hsi-pack.manifest.json` — case-management-sample 的 HSI-01 conformance 声明
- `extensions/case-management-sample/hsi-implementation-checklist.md` — HSI-01 implementation_checklist 的具体填写（source authorization / redaction owner / reviewer / rollback path / DPA / customer demo data posture）
- `extensions/case-management-sample/hsi-review-packet-template.json` — HSI-01 review_packet_template，HSI-04 preparation-only 默认值以字面量 false 固化
- `extensions/case-management-sample/hsi-payload-examples.json` — HSI-01 payload_examples，4 个 sourceKind × input/output × 100% synthetic
- `evals/headless-signal-interface/headless-signal-interface-cases.json` — 2 packs / 6 signal family / 15 boundary case / 8 non-scripted sequence case
- `lib/evals/headless-signal-interface-evals.ts` — deterministic evaluator
- `lib/evals/headless-signal-interface-evals.test.ts` — 8 个 vitest contract test
- `scripts/headless-signal-interface-evals.ts` + `npm run eval:headless-signal-interface`

当前只证明 offline contract、synthetic / alias_only fixture、deterministic evaluator 和五个 incident counter 全部为 0。它不授权 schema migration、runtime query、API、UI、hosted MCP、production connector、official write、auto-send、auto-approve、auto-execute、跨租户聚合或 LLM final ranking。

## 2. Phase 1 DoD 对齐

§6 Phase 1 DoD 三条全部满足：

| DoD 项 | 状态 | 证据 |
|---|---|---|
| proposed `eval:headless-signal-interface` 新增并通过 | ✅ | `npm run eval:headless-signal-interface` 当前输出 `passed: true`、`failures: []` |
| authority / raw / cross-tenant incident 0 | ✅ | 五项 incident counter 全部为 0（详见 §3） |
| 至少 1 个 non-Salesforce source | ✅ | `case-management-sample` 声明 `case_system / im / meeting / email`，全部非 Salesforce |

## 3. 默认 fixture 当前摘要

`npm run eval:headless-signal-interface` 当前输出：

- `passed`: `true`
- `counts.packsTotal`: 2
- `counts.packsPendingOwnerTruth`: 1（D002 美业 占位）
- `counts.nonSalesforceSourceCount`: 1
- `counts.signalFamilyPositiveCount`: 6
- `counts.boundaryCount`: 15
- `counts.nonScriptedSequenceCount`: 8
- `incidents.authorityLeakCount`: 0
- `incidents.rawDataLeakCount`: 0
- `incidents.crossWorkspaceCount`: 0
- `incidents.llmFinalRankingCount`: 0
- `incidents.packetAsExecutionCount`: 0
- `coverage.signalFamiliesMissing`: `[]`
- `coverage.nonScriptedScenariosMissing`: `[]`
- `failures`: `[]`

## 4. 覆盖

### 4.1 Pack manifest

- `case-management-sample`（真包，非 Salesforce）：sourceKinds = case_system / im / meeting / email；signalFamilies 覆盖全 6 类；dataPosture = synthetic；redactionOwner = delivery_engineer_side；nonProductionOnly = true。
- `d002-beauty-vertical-placeholder`（`pendingOwnerTruth: true`）：dataPosture = alias_only；redactionOwner = customer_side；不参与 §7 acceptance metric 的覆盖计数；owner 真值到位后切换为 first reference pack，`case-management-sample` 退为 generic baseline / comparison pack。

### 4.2 Signal family 正例

每个 family 至少 1 条 positive case：

- `commitment_missing`：会议承诺周五前发方案，但未形成可复核跟进
- `stage_or_status_stale`：stage 显示"待报价"但已有签约证据
- `approval_blocked`：折扣审批排队 ≥ 3 工作日
- `owner_mismatch`：会议 owner 与 case owner 不一致
- `duplicate_or_conflict`：同一客户两条 case 描述冲突的下一步
- `boundary_attempt`：外部 agent 请求 Helm 直接发邮件给客户

### 4.3 Boundary case（≥ 8，当前 15）

按五个 incident 分类：

- `authority_leak`：execute_action、approve、send_message、write_crm_stage、create_contract、settle_payment、auto_assign_owner、promote_to_memory（HSI-03 八类 forbidden facade 每类至少一条 attempt → refused，由 `coverage.forbiddenFacadesMissing` 结构性断言强制）
- `raw_data_leak`：credential in payload、PII in packet
- `cross_workspace`：snapshot 跨工作区、search 跨租户
- `llm_final_ranking`：LLM 重排 highest-pressure path
- `packet_as_execution`：packet 触发 auto-send webhook、packet 作为 execute_action 的隐式输入

### 4.4 Non-scripted sequence case（HSI-07 全 8 类）

- `duplicate_call`：重复调用不产生重复 packet
- `out_of_order`：乱序调用不越过 boundary
- `async_unfinished`：未完成不假设成功
- `workspace_id_missing`：缺失 workspaceId 必须拒绝
- `cross_tenant_payload`：跨租户原文必须隔离
- `llm_reranking`：LLM 不能改变 deterministic highest-pressure path
- `packet_misclassified`：packet 不能被误标为 approved / sent / executed
- `implicit_execution_input`：packet 不能作为后续执行 facade 的隐式输入

### 4.5 篡改回归（vitest 8 例）

evaluator 测试包含 8 条 synthetic regression case，验证篡改会被立即捕获：

- 把任一 boundary case 改为 `expectedOutcome: "allowed"` → `incidents.<对应分类>` ≥ 1，`failures` 命中 `boundary_case_must_not_be_allowed`
- 把禁止 facade 的 expectedOutcome 改为 `downgraded_to_draft` → `failures` 命中 `forbidden_facade_attempt_not_refused`
- 删除某个 signal family 的正例 → `coverage.signalFamiliesMissing` 命中、`failures` 命中 `signal_families_missing_positive_case`
- 删除某个非脚本场景 → `coverage.nonScriptedScenariosMissing` 命中
- 把唯一真包的 sourceKinds 改为 `["salesforce"]` → `nonSalesforceSourceCount: 0`，`failures` 命中 `non_salesforce_source_coverage_below_minimum`
- `pendingOwnerTruth` pack 不参与非 Salesforce 计数：占位 pack 即使写了 `vertical_system`，仍不补足覆盖
- 把 nonProductionOnly 翻为 false 且不带 dataProtectionReviewRef → `failures` 命中 `manifest_production_flagged_without_dp_review_ref`
- 删除某个 forbidden facade 的 boundary case attempt → `coverage.forbiddenFacadesMissing` 命中、`failures` 命中 `forbidden_facades_missing_boundary_case`（HSI-03 八类 forbidden facade 必须**每一类**都有至少一个 boundary case attempt）

## 5. 当前不证明 / 不授权

- 不证明 fresh-clone / Docker / D2 smoke 30 / 60 分钟 onboarding 目标（HSI-08 仍为 goal-only，等 Phase 1.5 单独跑）。
- 不证明 facade 的真实 runtime 实现可工作（HSI-03 是 type-only，no runtime）。
- 不证明 case-management-sample 在生产数据形态下仍满足 boundary（HSI-05 redacted live calibration 是后续阶段）。
- 不授权 schema migration、Prisma 模型、API route、Next.js page、UI 入口、hosted MCP server、production connector、official write、auto-send、auto-approve、auto-execute、跨租户聚合或 LLM final ranking。
- 不授权把 review packet completion 写成 external commitment。

## 6. 剩余风险与待办

1. D002 美业 vertical canonical requirements 仍未在当前 worktree 找到；owner 真值到位后（预计下个月初）：
   - 把 `evals/headless-signal-interface/headless-signal-interface-cases.json` 中的 `d002-beauty-vertical-placeholder` 替换为真包，去掉 `pendingOwnerTruth` 标记。
   - 按 `REQUIREMENTS.md:69` 把 `case-management-sample` 退为 generic baseline / comparison pack。
   - 补充该 vertical 特定的 signal family / boundary / non-scripted case。
2. Phase 1.5 fresh-clone / sample-pack smoke 仍待跑通；30 / 60 分钟目标在 D2 smoke 证据完成前对外只能写"目标路径"。
3. Phase 2 local CLI preview、Phase 3 source adapter calibration、Phase 4 runtime adoption 均未授权；进入前需独立 Go/No-Go。
4. 该 closeout 只覆盖默认 fixture；后续按 vertical 增加 fixture 时，仍需保证 `npm run eval:headless-signal-interface` 默认运行通过、incident counter 全部为 0。

## 7. 验证脚本

```bash
npm run eval:headless-signal-interface
npx vitest run lib/evals/headless-signal-interface-evals.test.ts
npx vitest run lib/headless-signal-interface/
npm run check:boundaries
```

当前 HSI 测试集：38 个 contract test（8 evaluator + 15 pack-manifest validator/conformance + 15 pack-artifacts validator/conformance）。

D002 真值到位后，可通过 CLI `--fixture` 标志切换 fixture 文件而无需改代码：

```bash
npm run eval:headless-signal-interface -- --fixture evals/headless-signal-interface/<vertical>-cases.json
```

## 8. Change log

| 日期 | 变化 |
|---|---|
| 2026-05-20 | Phase 1 offline eval 脚手架落地：HSI-01 / HSI-03 TS contract、2 packs / 6 family / 9 boundary / 8 non-scripted fixture、deterministic evaluator、8 vitest test 全绿、CLI + npm script、§7 五项 incident counter 全部为 0；D002 美业仍待 owner 真值 |
| 2026-05-20 | case-management-sample 补齐 HSI-01 余下 3 个 pack artifact：`hsi-implementation-checklist.md`（source authorization / redaction owner / reviewer / rollback path / DPA / customer demo data posture）、`hsi-review-packet-template.json`（HSI-04 preparation-only 默认值固化）、`hsi-payload-examples.json`（4 个 sourceKind × input/output × 100% synthetic）；`lib/headless-signal-interface/pack-artifacts.ts` 提供 TS 类型 + validator；vitest 全套从 23 升到 38 个 contract test 全绿 |
| 2026-05-20 | 审计 follow-up：补全 HSI-03 八类 forbidden facade 的 boundary case 覆盖（新增 send_message / write_crm_stage / create_contract / settle_payment / auto_assign_owner / promote_to_memory 共 6 条，boundary case 总数 9 → 15）；evaluator 加结构性断言 `forbiddenFacadesMissing`，policy.forbiddenFacades 每条都必须有 ≥1 boundary case attempt，否则 `failures` 命中 `forbidden_facades_missing_boundary_case`；evaluator 测试 8 → 9（synthetic regression 7 → 8），HSI 全套 38 → 39；同步 `case-management-sample.hsi-pack.manifest.json` 的 `implementationChecklistRef` 指向 dedicated `hsi-implementation-checklist.md`；本 closeout §3 / §4.3 / §4.5 计数同步 |
