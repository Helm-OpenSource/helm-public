---
status: active
owner: helm-core
created: 2026-05-03
review_after: 2026-06-03
archive_trigger:
  - Agentic Governance Phase 2 requirements supersede this docs scan guard and are indexed in docs/README.md
  - 2026-07-03 后 `documentCandidatesScanned` 不再出现在 `npm run eval:agentic-governance`，本报告进入归档评审
---

# Helm Agentic Governance P1 Docs Scan Closeout

## 1. 结论

Agentic Governance P1 messaging guard 的 docs / README / product copy 回归检查已落地为 offline document scan。

本轮只实现：

- `messaging-rewrite-guard` 支持从 curated documents 生成 `document_scan` candidate。
- `npm run eval:agentic-governance` 扫描 `README.md`、`docs/README.md`、`docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md`。
- eval 输出 `Docs scanned`、`Doc candidates`、`Doc rewrite required`、`Doc rejected`。
- scanned document candidate 一旦需要 rewrite 或 reject，`eval:agentic-governance` 失败。

本轮不授权 runtime rewrite、LLM 自动改写生产文案、自动发布外部 claim、provider API、credential、runtime adapter、schema、UI action、execution plane、agent OS、workflow builder、agent marketplace、auto-send、CRM silent write、auto-approve、auto-settlement、direct Must Push 或 direct Memory。

## 2. 已落地范围

| 项 | 证据 |
|---|---|
| Document scan builder | `features/agentic-governance/messaging-rewrite-guard.ts` |
| Regression tests | `features/agentic-governance/messaging-rewrite-guard.test.ts` |
| Eval integration | `scripts/agentic-governance-eval.ts` |
| Scan targets | `README.md`、`docs/README.md`、`docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md` |
| Requirements sync | `docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md` |

## 3. 四档判断

| 类型 | 结论 | 证据 |
|---|---|---|
| 已经完整成立 | P1 docs / README / product copy regression guard | Targeted test 8/8 pass；`eval:agentic-governance` 当前扫描 3 份文档、136 条 document candidate，doc rewrite / reject 均为 0 |
| 已成形但仍需下一层 | Generic market-signal provider-class fixtures | 当前只有 requirements 校准，未新增 provider class / artifact class fixture |
| 刻意未做 | runtime rewrite / LLM rewrite / production copy publisher | 本轮只做本地静态扫描 |
| 风险项 | 扫描范围过宽导致 internal index 噪音 | 当前采用 curated scan targets；扩大范围需单独评审 allow / boundary context |

## 4. 验证

已执行：

```bash
npx vitest run features/agentic-governance/messaging-rewrite-guard.test.ts
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

1. 如需继续 Agentic Governance，下一刀优先做 generic market-signal provider-class / artifact-class offline fixtures，不接 provider API。
2. Back-office readout packet 已由后续 closeout 补齐；如需页面入口，只能做只读 surface planning，不接 `/operating` action、Salesforce write 或 CRM stage mutation。
3. Phase 2 requirements 仍必须单独成文，不得从当前 P1 docs scan guard 直接进入 runtime adoption。

## 6. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-03 | 首版：P1 docs / README / product copy regression guard 接入 `eval:agentic-governance` |
