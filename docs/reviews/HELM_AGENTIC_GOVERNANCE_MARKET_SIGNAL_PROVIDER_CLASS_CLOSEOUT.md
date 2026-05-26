---
status: active
owner: helm-core
created: 2026-05-03
review_after: 2026-06-03
archive_trigger:
  - Agentic Governance Phase 2 requirements supersede market-signal provider-class intake and are indexed in docs/README.md
  - 2026-07-03 后 `Market-signal Provider Class Gate` 不再出现在 `npm run eval:agentic-governance`，本报告进入归档评审
---

# Helm Agentic Governance Market-signal Provider Class Closeout

## 1. 结论

2026-05-03 market-signal provider-class 校准已落地为 offline fixture gate。

本轮只实现：

- 把新出现的 agentic market signal 先分类为 `workspace_agent`、`managed_cloud_agent`、`workflow_framework`、`memory_context_system`、`agentic_enterprise_control_tower`。
- 把信号产物降成 `governance_trace_candidate`、`permission_summary_candidate`、`boundary_reason_code_candidate`、`memory_evidence_candidate`、`framework_risk_note`。
- 对 tenant isolation、redaction、trace completeness、connector permission summary、review-required boundary 做离线检查。
- 对 provider API、credential、runtime adapter、schema、UI action、workflow builder、active memory write、direct Must Push、final ranking influence 做硬拒绝或隔离。
- 接入 `npm run eval:agentic-governance`。

本轮不新增 provider profile，不接 provider API，不存 credential，不做 runtime adapter、schema、UI action、workflow builder、agent marketplace、agent OS、auto-send、CRM silent write、auto-approve、auto-settlement、direct Must Push、direct Memory 或 LLM final ranking。

## 2. 已落地范围

| 项 | 证据 |
|---|---|
| Provider-class evaluator | `features/agentic-governance/market-signal-provider-class.ts` |
| Fixture coverage | 9 条 offline fixtures，覆盖 workspace agent、managed cloud agent、workflow framework、memory/context system、agentic control tower |
| Unit tests | `features/agentic-governance/market-signal-provider-class.test.ts` |
| Eval integration | `scripts/agentic-governance-eval.ts` |
| Requirements sync | `docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md` |

## 3. 四档判断

| 类型 | 结论 | 证据 |
|---|---|---|
| 已经完整成立 | Market-signal provider-class offline gate | 9/9 fixture pass；runtime eval / provider runtime / direct Must Push / memory write / final ranking / workflow builder counters 均为 0 |
| 已成形但仍需下一层 | Provider-specific runtime evaluation | 必须另写 Phase 2 requirements，不得从 generic class gate 直接进入 provider runtime |
| 刻意未做 | provider registry expansion / credential / runtime / schema / UI action | 本轮只做 market signal classification 和 boundary reason |
| 风险项 | market signal 被误读成产品承诺 | 所有 positive path 只到 offline candidate，不代表 connector ready、runtime ready 或 production adoption |

## 4. 验证

已执行：

```bash
npx vitest run features/agentic-governance/market-signal-provider-class.test.ts features/agentic-governance/messaging-rewrite-guard.test.ts
npm run eval:agentic-governance
```

目标收口还需执行：

```bash
npm run eval:external-agent-intake -- --input-file evals/external-agent-intake/manual-import-demo.json
npm run check:boundaries
npm run typecheck
```

完整仓库级验证仍按 AGENTS.md §10 执行；本轮未触碰 DB、runtime、API、页面或生产 query。

## 5. 下一步

1. Back-office readout packet 已由后续 closeout 补齐；如需继续，只能单独开窄的只读 surface planning，不接 `/operating` action 或 Salesforce runtime write。
2. Provider-specific Phase 2 必须先有 requirements、fixture、eval、permission summary 和 owner review，不得从 market-signal gate 直接解禁。
3. 扫描范围或 provider class 扩展必须保持 curated、offline、review-first。

## 6. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-03 | 首版：market-signal provider-class offline gate 接入 `eval:agentic-governance` |
