---
status: active
owner: Product / Engineering / Data Protection
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - Object / Signal validity gate 被接入 runtime adoption 或 read-only board 后，本报告由对应 implementation closeout 替代
  - 首批 20-30 条 redacted object/signal fixtures 完成并形成下一版 scorecard 后归档
  - Helm 放弃 Must Push / AdvancementSignal 作为经营推进主线时归档
---

# Object / Signal Validity Gate Closeout

## 1. 结论

本轮把“无效经营对象 / 无效经营信号会导致 Helm 经营失效”的风险，从产品分析收成了可运行的 offline quality gate。

当前能力已经能在 fixture 层阻止以下对象或信号直接进入 Must Push：

- 身份不稳定、tenant mismatch、cross-workspace conflict
- stale evidence、weak evidence、single-source high-risk signal
- contradictory evidence
- duplicate signal
- missing owner / outcome metric / boundary note / review posture
- unsafe boundary、LLM final ranking、auto-promotion、official write intent
- permission posture insufficient（请求方对该对象权限不足，直接 reject）
- hallucinated evidence（无法对上来源的伪证据，直接 reject 并计入 boundary incident）

当前仍是 `已成形但仍需下一层`：它证明 gate 逻辑和负例边界成立，不证明真实生产对象质量已经成立，也不授权 production query adoption。

## 2. 交付物

- 产品框架：[HELM_OBJECT_SIGNAL_VALIDITY_FRAMEWORK.md](../product/HELM_OBJECT_SIGNAL_VALIDITY_FRAMEWORK.md)
- Fixture pack：`evals/object-signal-validity/object-signal-cases.json`
- Remediation fixture pack：`evals/object-signal-validity/object-signal-remediation-cases.json`
- Evaluator：`lib/evals/object-signal-validity-evals.ts`
- CLI：`scripts/object-signal-validity-evals.ts`
- Remediation CLI：`scripts/object-signal-remediation-evals.ts`
- 命令：`npm run eval:object-signal-validity`
- 命令：`npm run eval:object-signal-remediation`
- 索引同步：[docs/README.md](../README.md)、[evals/README.md](../../evals/README.md)、[docs/STATUS.md](../STATUS.md)

## 3. Gate Contract

Disposition 固定为四档：

| Disposition | 允许动作 |
|---|---|
| `must_push_ready` | 允许进入 Must Push candidate |
| `review_required` | 只能进入 review packet |
| `watch_only` | 只能观察或等待更多证据 |
| `rejected` | 拒绝，不进入 Must Push / memory / SkillSuggestion |

前置 gate 失守后，post-admission remediation 固定为四类：

| Containment | 含义 |
|---|---|
| `revoked` | 已进入 Must Push 的 stale / duplicate 信号撤销到观察 |
| `downgraded` | 已进入 Must Push 的 contradiction / weak-evidence 信号降级到 review |
| `quarantined` | wrong object / tenant mismatch / unsafe authority 直接隔离 |
| `unchanged` | 未发现新风险时保持原 disposition |

信号唯一性继续采用：

```text
workspaceId + tenantKey + sourceWindowKey + signalKey + severity
```

`mustPushBoundaryIncidentCount` 必须为 0。Rejected fixture 可以保留 boundary incident 计数用于审计，但不能被解释成通过 Must Push 的 incident。

## 4. 验证结果

本轮已跑：

| 命令 | 结果 |
|---|---|
| `npm run eval:object-signal-validity` | PASS；10 cases，1 ready / 3 review / 2 watch / 4 rejected；invalid Must Push = 0；Must Push boundary incident = 0 |
| `npm run eval:object-signal-remediation` | PASS；4 cases，1 revoked / 1 downgraded / 2 quarantined；uncontained = 0；canonical memory uncontained = 0；official write uncontained = 0；blast radius coverage = 100% |
| `npx vitest run lib/evals/object-signal-validity-evals.test.ts` | PASS；4 tests |
| `npx eslint lib/evals/object-signal-validity-evals.ts lib/evals/object-signal-validity-evals.test.ts scripts/object-signal-validity-evals.ts scripts/object-signal-remediation-evals.ts` | PASS |
| `git diff --check` | PASS |
| `npm run check:boundaries` | PASS |
| `npm run typecheck` | PASS |
| `npm run check:public-release` | PASS；scanned 3087 files |
| `npm run self-check` | PASS；隔离库 `helm2026_codex_object_signal` |
| `npm run lint` | PASS |
| `npm run test` | PASS；473 files / 3281 tests；隔离库 `helm2026_codex_object_signal` |
| `npm run quality:regression` | PASS；51 files / 181 tests |
| `npm run build` | PASS；保留既有 Turbopack NFT warning |
| `npm run e2e` | PASS；34 tests；隔离 e2e DB |

补充说明：默认 `helm2026` 本地库缺 `AuditLog.traceId` 时，`npm run test` 会在 Helm v2 runtime audit tests 上失败；隔离库完成最新 migration 后全量测试通过。`npm run db:reset` 对某些 tenant extension SQL 默认会遇到非 MySQL 方言 `CAST(... AS STRING)`，本轮按现有 `HELM_SKIP_EXTENSION_SQL=1` 开关跳过 extension SQL 后验证通过。

## 5. 剩余风险

| 风险 | 当前处理 |
|---|---|
| Fixture 仅 10 条，仍不足以代表真实经营对象分布 | 继续按 framework Phase 1 扩到 20-30 条 redacted fixture |
| 尚未接入 internal tenant weekly scorecard | 先作为 offline CLI；下一步进入 dogfood scorecard |
| 尚未证明 production query 的对象质量 | production query adoption 继续 No-Go |
| 部分 tenant extension SQL 与 MySQL reset 不兼容 | 本轮不修；保留为 extension SQL 方言/验证链风险 |
| E2E 仍有 MySQL 1020 analytics concurrency warning | 已在 STATUS 风险项保留；本轮不扩大修复范围 |

## 6. 下一步

1. 扩充 `evals/object-signal-validity/object-signal-cases.json` 到 20-30 条，覆盖 Business Advancement、Pack A、company memory 和 internal tenant dogfood。
2. 将 `mustPushBoundaryIncidentCount`、`invalidMustPushCount`、`reviewRequiredCases`、`watchOnlyCases` 接入 internal tenant weekly scorecard。
3. 在 production query adoption 前，把 Object / Signal validity 作为 read-model preflight，不通过则禁止 runtime adoption。
4. 仅在两周 dogfood 通过后，再设计 runtime trace / read-only board；不得跳过 reviewer approval。

## 7. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-04 | 扩 fixture 到 10 条：新增 permission posture insufficient 与 hallucinated evidence reject case，对齐 P0-REQ-03 acceptance；同步更新 framework |
| 2026-04-30 | 首版 closeout：记录 Object / Signal validity gate 交付物、验证结果、剩余风险和下一步 |
