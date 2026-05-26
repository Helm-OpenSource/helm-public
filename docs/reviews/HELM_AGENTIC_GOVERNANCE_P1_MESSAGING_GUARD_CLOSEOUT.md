---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-06-02
archive_trigger:
  - Agentic Governance Phase 2 requirements supersedes the P1 messaging guard and is indexed in docs/README.md
  - 2026-07-02 后 `runMessagingRewriteGuardEval` 不再被 `npm run eval:agentic-governance` 引用，本报告进入归档评审
---

# Helm Agentic Governance P1 Messaging Guard Closeout

## 1. 结论

Agentic Governance P1 的第一刀已落地为 offline / fixture-backed messaging rewrite guard。

本轮只实现：

- agentic / autonomous / execution wording 的 copy guard。
- `agent OS`、`autonomous workforce`、`workflow/orchestration platform` 等 overclaim 的拒绝规则。
- customer-facing sensitive wording 缺 boundary note 时的 rewrite-required 决策。
- runtime rewrite attempt 的拒绝规则。
- `npm run eval:agentic-governance` 中的 messaging guard section。

本轮不授权 runtime rewrite service、LLM 自动改写生产文案、自动发布外部 claim、API、UI、schema、provider credential、production query、official write、auto-send、direct Must Push、direct Memory 或 final ranking input。

## 2. 已落地范围

| 项 | 证据 |
|---|---|
| Messaging guard contract | `features/agentic-governance/messaging-rewrite-guard.ts` |
| Fixture coverage | approved positioning、customer-facing sensitive copy with / without boundary、agent OS overclaim、boundary doc、competitor differentiation、runtime rewrite attempt |
| Unit tests | `features/agentic-governance/messaging-rewrite-guard.test.ts` |
| Eval integration | `scripts/agentic-governance-eval.ts` |
| Requirements sync | `docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md` |

## 3. 四档判断

| 类型 | 结论 | 证据 |
|---|---|---|
| 已经完整成立 | P1 messaging rewrite offline guard | `runMessagingRewriteGuardEval` + targeted tests |
| 已成形但仍需下一层 | docs / README broader scan | 当前 guard 已有 fixture，但尚未扩成全仓 customer-facing copy scanner |
| 刻意未做 | runtime rewrite / LLM rewrite / auto-publish | 本轮只做 lint-style evaluator，不改生产路径 |
| 风险项 | back-office signal 与 artifact reason-code expansion 已由后续 closeout 补齐 | 见 back-office guard / readout packet / safe artifact reason-code closeout |

## 4. 验证计划

目标验证命令：

```bash
npx vitest run features/agentic-governance/messaging-rewrite-guard.test.ts features/agentic-governance/connector-permission-summary.test.ts features/external-agent-intake/intake-decision.test.ts
npm run eval:agentic-governance
npm run check:boundaries
npm run typecheck
```

完整仓库级验证链仍按 AGENTS.md 执行；本轮未触碰 DB、runtime、API 或页面。

## 5. 下一步

1. P1 back-office evidence / gap / pre-approval reminder fixtures 已完成，见对应 closeout。
2. P1 safe artifact intake reason-code expansion 已完成，见对应 closeout。
3. 等 P1 三刀持续稳定后，再评估 `/settings` connector permission summary read-only surface。

## 6. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | P1 messaging rewrite guard 首版落地 |
