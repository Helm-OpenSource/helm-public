---
status: archived
owner: helm-core
created: 2026-05-13
review_after: 2026-11-09
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm 渠道方协作模型 P0 Offline Eval 收口

日期：2026-05-12
状态：已成形但仍需下一层

## 目标

把 `HELM_CHANNEL_PARTNER_COLLABORATION_REQUIREMENTS_2026-05-12.md` V2.1 的 P0 要求落成可运行的离线 contract gate，确保后续 P1 / P2 实施前先固定这些边界：

- PartnerCustomerGrant 是 partner-customer 关系的授权源
- partner-visible readout 只能走 PartnerSafe DTO
- partner 不得访问 Ask Helm、原始证据、原表、outbound send 或直接创建 Recommendation
- PartnerNudgeDraft 必须经过客户侧 authorized actor 进入内部 review，再决定 promoted / kept-as-note / rejected
- AttributionCandidate 只作为离线概念，P1 再锚定 `SalesReferral -> RevenueAttributionLedger -> PayoutLedger`
- revocation cleanup 必须 future-effect-only，且关闭 partner readout
- portfolio readout 只能 alias / bucket，不开放 generic cross-tenant helper

## 本轮交付

- `lib/channel-partner-collaboration/*`
  - P0 offline-only contract types 与纯函数 helper：safe DTO 黑名单检查、reason-code registry、nudge lifecycle、commission policy shape、AttributionCandidate lock / release、portfolio alias、revocation cleanup。
- `evals/channel-partner-collaboration/channel-partner-collaboration-cases.json`
  - 23 条 alias-only fixture，覆盖 P0-REQ-08 / P0-REQ-09 的正负路径。
- `lib/evals/channel-partner-collaboration-evals.ts`
  - deterministic evaluator，输出 hard-zero incident counters 与 coverage counters。
- `lib/evals/channel-partner-collaboration-evals.test.ts`
  - targeted Vitest，包含 default pass、missing grant accepted 负例、direct source table read 负例、metadata drift 与 runtime substring drift。
- `scripts/channel-partner-collaboration-evals.ts`
  - CLI gate，供 `npm run eval:channel-partner-collaboration` 调用。
- `scripts/decision-first-boundary-check.ts`
  - 新增 `channel_partner_collaboration_p0_offline_gate`，检查需求 marker、fixture/eval/test/script/docs marker、package script、contract exports，并拒绝 P0 文件向 schema / runtime / API / UI 漂移。
- `evals/README.md` / `docs/README.md`
  - 索引同步。

## 明确未做

- 未新增 Prisma schema / migration / enum / model
- 未新增 API route / app route / settings UI / partner-facing portal
- 未接生产 DB、production query、connector、LLM、网络或外部发送
- 未创建 `WorkspaceClass.PARTNER` 或 `PARTNER_COLLABORATOR`
- 未实现自动结算、银行打款、税务、法务定性或 partner 自助申请

## 验证记录

| 命令 | 结果 |
| --- | --- |
| `npm run eval:channel-partner-collaboration` | PASS — 23 cases；所有 hard-zero incident counters 为 0；coverage：nudge lifecycle 7、revocation 2、attribution ledger anchor 5、PartnerSafe DTO 4 |
| `npx vitest run lib/evals/channel-partner-collaboration-evals.test.ts lib/channel-partner-collaboration/*.test.ts` | PASS — 8 files / 63 tests |
| `npm run check:boundaries` | PASS — 新增 `channel_partner_collaboration_p0_offline_gate` 通过；spawn-env supply-chain 仍有 2 个既有 warn-only route，无 failure |
| `npm run typecheck` | PASS |
| `npx eslint lib/channel-partner-collaboration lib/evals/channel-partner-collaboration-evals.ts lib/evals/channel-partner-collaboration-evals.test.ts scripts/channel-partner-collaboration-evals.ts` | PASS |
| `git diff --check` | PASS |

## 剩余风险

- P0 只证明离线契约，不代表 P1 internal implementation 已经可用。
- Commission threshold 的具体数值仍需要业务复核；当前只是 policy shape 与默认建议。
- Partner grant / partner-safe readout 的法律角色定性仍需法务评审。
- P2 是否开放 PartnerWorkspace / PARTNER_COLLABORATOR 必须由 owner 显式批准并更新 STATUS.md。

## 下一步

1. P1 复用现有 `SalesReferral` / `PartnerProgram` / `RevenueAttributionLedger` / `PayoutLedger` 做 internal-only registry / attribution readout。
2. 在 Helm reserved / internal settings 中做管理员可见的 attribution review，不开放 partner portal。
3. 为 P2 单独准备 owner decision packet：PartnerWorkspace、customer settings disclosure、PartnerNudgeDraft runtime、legal review 与 revocation UX。
