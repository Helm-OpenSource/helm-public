---
status: archived
owner: helm-core
created: 2026-04-25
review_after: 2026-10-22
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Ask Helm Action Intent Implementation Closeout V2

日期：2026-04-26

## 1. 结论

Ask Helm v2 行动意图入口已经完成最小可验证实现，并完成 `P1 validation hardening` 收口。

本轮没有把 Ask Helm 扩成聊天中心、workflow engine、自动执行平面、DB queue write、LLM rewrite 或语音审批入口。实现后的 `/search?mode=ask` 能把用户问题分成回答、计划拆解、草稿准备、复核材料、内部跟进草稿、handoff、受控执行请求、review-required execution、开放域拒绝和跨 workspace 拒绝，并把结果收口到可审计、可复核、可继续执行的 Helm 工作面。

## 2. 已经完整成立

1. `action intent taxonomy`
   - 新增 `plan_breakdown / prepare_draft / prepare_review_packet / queue_internal_followup / request_handoff / request_execution / review_required_execution / unsupported_open_domain / cross_workspace_denied`
   - 高风险执行请求不再被混成 generic `out_of_scope`，而是明确进入 `review_required_execution`
   - 开放域和跨 workspace 请求分别进入独立 denial intent

2. `action response contract`
   - response 新增 `plan / preparedArtifact / actionHandoff / voice`
   - 所有 action path 仍保持 `retrievalPlan.readOnly=true` 与 `writePath=false`
   - handoff 明确 `writeEnabled=false`
   - review-required execution 只准备复核材料，不执行发送、审批、付款、承诺或正式写回

3. `/search` Ask mode 展示层
   - Ask mode 继续挂在现有 `/search`，没有新增聊天中心
   - UI 可展示相关对象、回答、下一步、边界、行动计划、准备件、handoff 和语音 transcript 状态
   - 对象搜索模式保持原入口和结果卡片，不被 Ask mode 取代

4. 语音最小支持
   - 支持 `input=voice` 的 transcript-only 输入形态
   - 用户可勾选 transcript 已核对
   - response 明确 `rawAudioRetained=false` 与 `voiceOnlyApprovalAllowed=false`
   - 可朗读内容只来自 validated response 的 `summary / boundary`

5. 验证入口
   - 新增 `eval:ask-helm-action-intents`
   - 新增 `eval:ask-helm-action-contract`
   - 新增 `eval:ask-helm-voice`
   - 聚合 `eval:ask-helm` 已纳入 action intent pass rate 和 action contract stop condition

6. `P1 validation hardening`
   - `action plan` steps 已增加 `objectRef / dri / due` 结构字段，继续保持 suggestion-only、no-write、review-first
   - `evals/ask-helm/query-intents.json` 与 `evals/ask-helm/action-intents.json` 已回灌 real-user phrasing
   - 新增 `/search?mode=ask` Playwright E2E，覆盖对象结果、answer、boundary note、action plan 和 `voice transcript checked`

## 3. 已成形但仍需下一层

1. 内部跟进队列目前是 `queue_internal` handoff contract 和 UI 准备层，不是 DB-backed queue write。
2. 草稿内容目前是 deterministic preview，不是带引用展开的 LLM rewrite 版本。
3. 语音输入目前是 transcript-only UI contract，不接浏览器录音、实时语音识别或原始音频存储。
4. action plan 当前虽然已经带 `objectRef / suggested DRI / suggested due`，但仍是 deterministic suggestion，不是 DB truth、真实分配或正式承诺。

## 4. 刻意未做

1. 未做 automatic customer send。
2. 未做 automatic approval、payment execution 或 official writeback。
3. 未做跨 workspace / 跨租户 retrieval。
4. 未做开放域 web search。
5. 未做 always-on microphone、raw audio retention 或 voice-only approval。
6. 未做 DB-backed internal queue 写入，因为该能力需要 audit / undo / dismiss 与明确 MySQL test profile。

## 5. 风险项

1. 用户可能把 draft plan 理解成正式计划，因此 UI 和 boundary 继续显示 draft / review-required / no-write。
2. 用户可能把 prepared artifact 理解成已发送，因此草稿和复核材料都只指向 approvals / operating。
3. 新 query 表达虽然已经回灌一轮 real-user phrasing，但真实线上 query 继续增加时仍可能出现误判，需要持续补样本。
4. 如果下一层接 LLM rewrite，必须先验证 rewrite 不会弱化 review boundary。
5. 如果下一层接真实 queue write，必须先补 audit、undo、dismiss、幂等键和 DB-backed 回归测试。
6. OpenClaw 两个 finding 必须走单独安全修复，不应混进 Ask Helm closeout 变更。

## 6. 受影响组件

- `features/search/ask-helm-query-intent.ts`
- `features/search/ask-helm-interpreter.ts`
- `app/(workspace)/search/page.tsx`
- `tests/e2e/ask-helm-search.spec.ts`
- `evals/ask-helm/query-intents.json`
- `evals/ask-helm/action-intents.json`
- `lib/evals/ask-helm-action-intent-evals.ts`
- `scripts/ask-helm-action-contract-validate.ts`
- `scripts/ask-helm-voice-validate.ts`
- `scripts/ask-helm-validation-suite.ts`
- `README.md`
- `docs/README.md`
- `evals/README.md`

## 7. 验收命令

本轮新增与定向验证：

```bash
npm run eval:ask-helm
npm run eval:ask-helm-action-contract
npm run test -- features/search/ask-helm-query-intent.test.ts features/search/ask-helm-interpreter.test.ts lib/evals/ask-helm-query-intent-evals.test.ts lib/evals/ask-helm-action-intent-evals.test.ts
DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026_ask_helm_e2e?charset=utf8mb4" npx playwright test tests/e2e/ask-helm-search.spec.ts
npm run typecheck
git diff --check
```

结果：

- `npm run eval:ask-helm`：`ok: true`；query intent 38 / 38，action intent 36 / 36，stop conditions 全部 clear
- `npm run eval:ask-helm-action-contract`：`ok: true`
- targeted Ask Helm tests：4 个文件，18 个测试，通过
- `tests/e2e/ask-helm-search.spec.ts`：2 / 2 通过；使用本地临时 MySQL `helm2026_ask_helm_e2e`
- `npm run typecheck`：通过
- `git diff --check`：通过

本轮按用户限定的 `P1 验证加固` 基线收口，没有把 OpenClaw finding、安全修复、DB queue write、LLM rewrite 或全仓库回归混进 Ask Helm closeout。

## 8. 下一步建议

1. 为 OpenClaw 两个 finding 单独开安全修复，不进入 Ask Helm closeout PR。
2. 在 review packet 中增加对象引用和证据分层。
3. 为 internal queue write 单独设计 audit / undo / dismiss / idempotency contract。
4. 为语音输入补浏览器 speech-to-text 适配，但继续保持 transcript confirmation。
5. 如果引入 LLM rewrite，先做 policy-preserving rewrite eval，再接 UI。
