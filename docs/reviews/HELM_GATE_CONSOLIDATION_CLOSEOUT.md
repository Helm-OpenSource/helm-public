---
status: active
owner: Product / Engineering
created: 2026-05-05
review_after: 2026-05-19
archive_trigger:
  - Gate registry 接入 release:check 或 weekly scorecard 后，本报告由对应 implementation closeout 替代
  - 当 P0 gate 集合发生显著结构变化（新增 keep klass 或删除现有 klass）时归档
---

# Gate Consolidation Closeout (P0-REQ-06)

## 1. 结论

本轮把 P0-REQ-06 acceptance（"每个 active P0 gate 必须能回答它阻止了哪一类客户可见风险，否则不得占据 pilot-blocking 列表"）从产品口径收成可运行的 offline gate registry eval。

当前能力已经能在 fixture 层强制：

- 每条 `keep` gate 必须填非空 `customerVisibleRisk`
- 每条 `keep` gate 必须 `metaOnly === false` 且 `feedsPilotDecision === true`
- 5 条 required keep klass 缺失任何一条都直接 fail：`boundary_static_gate` / `object_signal_validity_eval` / `context_packet_audit` / `memory_quality_impact_eval` / `trace_roi_pilot_proof_gate`
- 非 active gate 不允许声明 customer-visible risk（否则要么提升回 keep，要么删除该 risk claim）
- 任何 gate 必须挂 `evidence` pointer

当前仍是 `已成形但仍需下一层`：它只证明 registry 形状契约成立，不证明这些 gate 真实运行结果，也不替代各自 gate 的 pass/fail。

## 2. 交付物

- Fixture pack：`evals/gate-consolidation/gate-registry.json`
- Evaluator：`lib/evals/gate-consolidation-evals.ts`
- Vitest：`lib/evals/gate-consolidation-evals.test.ts`
- CLI：`scripts/gate-consolidation-evals.ts`
- 命令：`npm run eval:gate-consolidation`

## 3. Gate Class Vocabulary

固定 7 类：

| Class | 含义 |
|---|---|
| `boundary_static_gate` | 静态拦截 auto_execute / auto_send / official_write 等授权动词 |
| `object_signal_validity_eval` | Must Push admission 前置 gate（P0-REQ-03） |
| `context_packet_audit` | Ask Helm 输出上下文 / 记忆 / 边界声明审计 |
| `memory_quality_impact_eval` | 记忆质量与 contamination 防护 |
| `trace_roi_pilot_proof_gate` | trace timeline + ROI scorecard（P0-REQ-05） |
| `meta_gate` | 关于 gate 自身的元审计；不允许 active |
| `dogfood_opc_artifact` | OPC 决策 / 复核 / 运行报告产物；不直接拦截 release |

`activeStatuses = ["keep"]`，`nonBlockingStatuses = ["freeze", "research", "archive"]`。

## 4. 验证结果

| 命令 | 结果 |
|---|---|
| `npm run eval:gate-consolidation` | PASS；27 gates；activeCount=11；nonBlockingCount=16；failures=[]（含 5 条 required keep klass、external-agent intake P0-REQ-07、object-signal remediation、audience signal projection、business-advancement signal pipeline、Ask Helm knowledge pack、IGS core 10-dimension active；其余 IGS 元 gate / dogfood / self-check 均 freeze 且不携带 customer-visible risk） |
| `npx vitest run lib/evals/gate-consolidation-evals.test.ts` | PASS；3 tests（默认 registry 通过 + active 缺 risk 负例 + 缺 required klass 负例） |
| `npm run typecheck` | PASS |
| `npx eslint --max-warnings 0 lib/evals/gate-consolidation-evals.ts lib/evals/gate-consolidation-evals.test.ts scripts/gate-consolidation-evals.ts` | PASS |

未跑：`db:reset` / `build` / `e2e` / `quality:regression` / `check:boundaries` / `check:public-release`。本轮是 planning-only registry，不触及 runtime / DB / route。

## 5. 剩余风险

| 风险 | 当前处理 |
|---|---|
| Registry 已扩到 27 条，但仍可能漏登仓库内一些次要 eval | 当前覆盖 P0 keep 11 条 + IGS 12 条 freeze + meta/dogfood 4 条；后续按 active queue 增量补登 |
| Registry 与 release:check 仍未做强制对齐 lint | 当前 P0-REQ-05/06/07 + agentic-governance + IGS boundary-static / determinism 均已挂入 release:check FAST preflight；但没有 lint 强制 keep gate ⇔ release:check 自动链一一对应 |
| 没有自动机制保证新增 gate 必须先登记 | 下一步用 lint/check 强制 `lib/evals/*.ts` 与 registry 对齐 |
| meta_only / dogfood_opc_artifact 标记仍是描述层 | 仅靠 review；下一步把 status 校验加入 self-check |

## 6. 下一步

1. 扩 registry 把 IGS 18 个 P0+ gate、external-agent intake、Ask Helm context packet、memory quality impact 全量登记。
2. 把 `eval:gate-consolidation` 接入 `npm run release:check` 自动项。
3. 增加一条 lint：`lib/evals/*-evals.ts` 必须在 registry 中存在条目（可注册为 keep / freeze / research / archive）。
4. 下一轮考虑把 registry 拆成 P0 / P1 / 内部 OPC 三档分别校验。

## 7. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-05 | Registry 从 7 条扩到 27 条：5 条 required keep klass + external-agent intake P0-REQ-07 + object-signal remediation + audience signal projection + business-advancement signal pipeline + Ask Helm knowledge pack + IGS core 10-dimension 共 11 条 active；IGS 元 gate（boundary-static / determinism / schema-drift / fixture-lint / dimension-saturation / cycle-advance / remediation-roundtrip / budget-gate / failure-taxonomy-coverage / data-protection-manifest / approval-readiness / live-calibration-preflight / chain-integrity）+ self-check meta + dogfood OPC artifact 共 16 条 freeze；接入 `npm run release:check` FAST preflight |
| 2026-05-05 | 首版 closeout：记录 P0-REQ-06 gate consolidation 交付物、验证结果、剩余风险和下一步 |
