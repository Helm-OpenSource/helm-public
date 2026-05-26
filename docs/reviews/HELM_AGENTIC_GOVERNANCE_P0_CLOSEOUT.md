---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-06-02
archive_trigger:
  - Agentic Governance Phase 1 follow-up closeout replaces this report and is indexed in docs/README.md
  - 2026-07-02 后 eval:agentic-governance 不再被 package.json 引用，本报告进入归档评审
---

# Helm Agentic Governance P0 Closeout

## 1. 结论

Agentic Governance P0 已落地为 offline / fixture-backed gate。

本轮实现：

- External Agent outcome 结构化状态。
- Governance trace 合同与 accepted candidate trace gate。
- Connector permission summary 三轨合同。
- `/settings?tab=connectors` connector permission summary 只读展示。
- `npm run eval:agentic-governance` 离线验证入口。

本轮不授权 runtime、API、schema、provider credential、production query、official write、auto-send、CRM silent write、auto-approve、auto-settlement、direct Must Push、direct Memory 或 final ranking input。唯一新增 UI 是 `/settings` 的只读 admin-visible readout，不提供权限编辑器或连接器控制面。

## 2. 已落地范围

| 项 | 证据 |
|---|---|
| Outcome status | `ExternalAgentOutcomeStatus = completed / refused / blocked / needs_review / unsupported / error` |
| Governance trace | `ExternalAgentGovernanceTrace` 包含 traceId / source / actorType / workspace / evidence / proposedAction / outcome / boundary / redaction |
| External Agent fixtures | 15 条扩为 22 条，新增 refused / blocked / unsupported / error / needs_review、trace conflict、connector permission 覆盖 |
| Manual import demo | `evals/external-agent-intake/manual-import-demo.json` 增补 `providerOutcomeStatus` 与 `governanceTrace` |
| Connector summary | HubSpot / Salesforce / Gmail / AliMail / DingTalk / WeCom 三轨权限摘要 |
| Settings readout | `features/settings/components/connector-permission-summary-panel.tsx` 接入 `/settings?tab=connectors`，只读展示 auto / review / never / credential / sync / boundary |
| Eval script | `npm run eval:agentic-governance` |

## 3. 四档判断

| 类型 | 结论 | 证据 |
|---|---|---|
| 已经完整成立 | P0 offline governance gate + `/settings` readout | `features/external-agent-intake/*` + `features/agentic-governance/*` + `features/settings/components/connector-permission-summary-panel.tsx` + `scripts/agentic-governance-eval.ts` |
| 已成形但仍需下一层 | Phase 2 runtime evaluation | 需另写 Phase 2 requirements，不得从 P0/P1 直接进入 runtime |
| 刻意未做 | runtime / API / schema / provider credential / automatic execution | 本轮只做 offline governance，不做外部副作用 |
| 风险项 | readout 被误用成控制面 | `/settings` surface 必须保持无按钮、无表单、无链接、无发送/写回/权限编辑入口 |

## 4. 验证计划

目标验证命令：

```bash
npx vitest run features/external-agent-intake/intake-decision.test.ts features/external-agent-intake/manual-import.test.ts features/agentic-governance/connector-permission-summary.test.ts features/settings/components/connector-permission-summary-panel.test.tsx
npm run eval:agentic-governance
npm run eval:external-agent-intake -- --input-file evals/external-agent-intake/manual-import-demo.json
npm run typecheck
npm run check:boundaries
```

完整仓库级验证链仍按 AGENTS.md 执行；本轮未触碰 DB、runtime、API 或页面。

## 5. 下一步

1. 如需 Phase 2，先写 requirements，不得从 P1 offline gates 直接进入 runtime。
2. 如需 `/operating` resource card 入口，必须单独开窄切片并保持 read-only。
3. 新增 connector 前必须先补 permission summary、fixtures、reason codes 和 eval 覆盖。

## 6. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-02 | `/settings?tab=connectors` 只读 connector permission summary surface 落地，UI readout 风险关闭为 no-control-plane guard |
| 2026-05-02 | P1 offline gates 补齐 messaging / back-office / safe artifact reason-code 后，同步更新剩余风险 |
| 2026-05-02 | P0 offline gate 首版落地 |
