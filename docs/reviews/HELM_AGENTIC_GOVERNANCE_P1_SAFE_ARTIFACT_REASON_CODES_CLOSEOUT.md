---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-06-02
archive_trigger:
  - Agentic Governance Phase 2 requirements supersedes the P1 safe artifact reason-code expansion and is indexed in docs/README.md
  - 2026-07-02 后 `traceConflictAccepted` / `connectorPermissionBypassed` 不再出现在 `npm run eval:external-agent-intake`，本报告进入归档评审
---

# Helm Agentic Governance P1 Safe Artifact Reason Codes Closeout

## 1. 结论

Agentic Governance P1 的第三刀已落地为 External Agent Intake 的 reason-code expansion。

本轮只实现：

- governance trace outcome conflict reason code。
- connector permission review-required / never-allowed reason codes。
- 2 条新增 fixture，把默认 fixture gate 从 20 条扩到 22 条。
- `npm run eval:external-agent-intake` 与 `npm run eval:agentic-governance` 的 trace conflict / connector permission bypass 指标。

本轮不授权 provider API、credential、runtime adapter、schema migration、production query、UI action button、direct Must Push、direct Memory、official write、send 或 final ranking input。

## 2. 已落地范围

| 项 | 证据 |
|---|---|
| Reason codes | `trace_outcome_conflict`、`trace_boundary_conflict`、`connector_permission_review_required`、`connector_permission_never_allowed` |
| Fixture coverage | `EA-021` trace conflict、`EA-022` connector permission review-required |
| Unit tests | `features/external-agent-intake/intake-decision.test.ts` |
| Eval integration | `scripts/external-agent-intake-eval.ts`、`scripts/agentic-governance-eval.ts` |
| Requirements sync | `docs/product/HELM_AGENTIC_GOVERNANCE_REQUIREMENTS.md` |

## 3. 四档判断

| 类型 | 结论 | 证据 |
|---|---|---|
| 已经完整成立 | P1 safe artifact reason-code expansion | 22/22 fixture pass；trace conflict accepted = 0；connector permission bypass = 0 |
| 已成形但仍需下一层 | connector permission UI readout | 只在 offline artifact gate 中解释 connector permission，不做 settings UI |
| 刻意未做 | provider API / runtime / UI action button | 本轮只扩解释和 eval 指标 |
| 风险项 | Phase 2 runtime adoption 仍未获批准 | 必须另写 requirements，不得由 reason code 扩展顺手进入 |

## 4. 验证计划

目标验证命令：

```bash
npx vitest run features/external-agent-intake/intake-decision.test.ts
npm run eval:external-agent-intake
npm run eval:agentic-governance
npm run check:boundaries
npm run typecheck
```

完整仓库级验证链仍按 AGENTS.md 执行；本轮未触碰 DB、runtime、API 或页面。

## 5. 下一步

1. 评估 `/settings` connector permission summary read-only surface。
2. 在 Phase 2 requirements 前确认 P1 三刀的 offline gates 持续通过。

## 6. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | P1 safe artifact reason-code expansion 首版落地 |
