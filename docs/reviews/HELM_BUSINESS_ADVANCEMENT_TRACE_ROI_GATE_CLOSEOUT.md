---
status: active
owner: Product / Engineering
created: 2026-05-05
review_after: 2026-05-19
archive_trigger:
  - Trace + ROI gate 接入 internal tenant weekly scorecard 或 dogfood pilot proof packet 后，本报告由对应 implementation closeout 替代
  - 当 Phase 3 runtime adoption 解禁，trace + ROI 切换到真实生产对象统计时归档
  - Helm 放弃 Must Push 主线时归档
---

# Business Advancement Trace + ROI Gate Closeout (P0-REQ-05)

## 1. 结论

本轮把 P0-REQ-05 acceptance（"对客户可证明的 trace timeline + ROI scorecard"）从产品口径收成可运行的 offline gate。

当前能力已经能在 fixture 层把以下两条强制契约绑死：

- **Trace timeline** 必须能回答 6 个问题：来源（meeting source）、转化（must push 创建）、复核人（reviewer）、决策（accept/downgrade/quarantine/reject）、边界（boundary note）、最终姿态（final posture）。任一缺失即记 `trace_missing:*`。
- **ROI scorecard** 必须可计量：48 小时跟进率、deals rescued、manager review time saved、draft adoption、prevented wrong commitment、audit trace coverage。official write performed without reviewer approval 直接计 `wrong_commitment_incident`，硬性 budget = 0。

当前仍是 `已成形但仍需下一层`：它只证明 fixture trace+ROI 契约成立，不证明真实生产 trace timeline 已经成立，也不授权 production query adoption 或 runtime trace collector。

## 2. 交付物

- Fixture pack：`evals/business-advancement-trace-roi/trace-roi-cases.json`
- Evaluator：`lib/evals/business-advancement-trace-roi-evals.ts`
- Vitest：`lib/evals/business-advancement-trace-roi-evals.test.ts`
- CLI：`scripts/business-advancement-trace-roi-evals.ts`
- 命令：`npm run eval:business-advancement-trace-roi`

## 3. Gate Contract

固定 6 个 trace question：

| Question | 来源字段 |
|---|---|
| `source` | `trace.meetingExtraction.source` |
| `transformation` | `trace.mustPushCreation.{mustPushItemId,createdAtIso}` |
| `reviewer` | `trace.reviewDecision.reviewer` |
| `decision` | `trace.reviewDecision.decision` ∈ accept/downgrade/quarantine/reject |
| `boundary` | `trace.reviewDecision.boundaryNote` |
| `final_posture` | `trace.reviewDecision.finalPosture` ∈ must_push_ready / review_required / watch_only / rejected |

固定 6 项 ROI 指标 + 1 项 incident budget：

| Metric | 含义 | 默认目标 |
|---|---|---|
| `followUp48hCompletionPercent` | 48h 内完成跟进比例 | ≥ 60% |
| `dealsRescuedCount` | trace 闭环挽救的机会数 | ≥ 1 |
| `managerReviewTimeSavedMinutesTotal` | 管理者审阅节省总分钟 | ≥ 15 |
| `draftAdoptionPercent` | 起草动作被采纳比例（仅在 draft path applicable 时计入） | ≥ 50% |
| `preventedWrongCommitmentCount` | 通过 review 拦下的错误承诺数 | ≥ 1 |
| `auditTraceCoveragePercent` | 全量 trace 6-question 覆盖率（按 case 平均） | 100% |
| `wrongCommitmentIncidentCount` | official write performed without reviewer approval | = 0（硬性） |

`wrong_commitment_incident` 触发条件：`trace.crmWriteBack.officialWritePerformed === true && approvedByReviewer === false`。这是 P0-REQ-05 不可妥协的边界。

## 4. 验证结果

| 命令 | 结果 |
|---|---|
| `npm run eval:business-advancement-trace-roi` | PASS；16 cases；auditTraceCoveragePercent=100；wrongCommitmentIncidentCount=0；preventedWrongCommitmentCount=7；dealsRescuedCount=4；draftAdoptionPercent=63；followUp48hCompletionPercent=88；managerReviewTimeSavedMinutesTotal=234 |
| `npx vitest run lib/evals/business-advancement-trace-roi-evals.test.ts` | PASS；3 tests（默认 fixture 通过 + wrong-commitment 负例 + reviewer/boundary 缺失负例） |
| `npm run typecheck` | PASS |
| `npx eslint --max-warnings 0 lib/evals/business-advancement-trace-roi-evals.ts lib/evals/business-advancement-trace-roi-evals.test.ts scripts/business-advancement-trace-roi-evals.ts` | PASS |

未跑：`db:reset` / `build` / `e2e` / `quality:regression` / `check:boundaries` / `check:public-release`。本轮全部是 planning-only offline eval + JSON fixture，不触及 runtime / DB / route / public posture。

## 5. 剩余风险

| 风险 | 当前处理 |
|---|---|
| Fixture 仅 16 条，仍不完全代表真实经营对象分布 | 已覆盖 Pack A renewal（3）、Phase 3 disabled-runtime（3）、internal tenant dogfood（3）、boundary 负例（2）；下一步在真实 dogfood 数据后再扩 |
| 尚未接入 internal tenant weekly scorecard | 当前只在 CLI 层；下一步进入 dogfood weekly scorecard |
| 尚未证明真实 trace collector 完整 | runtime trace adoption 继续 No-Go；只在 fixture 验证契约形状 |
| draft path applicable 仅按 fixture 标记 | 真实 trace 中 draft 不存在时仍需保持 50% 目标的解释能力，下一轮考虑分层目标 |

## 6. 下一步

1. 把 `trace-roi-cases.json` 扩到 15-20 条，覆盖 Pack A renewal 全量、internal tenant dogfood、Phase 3 disabled-runtime fixture。
2. 把 `auditTraceCoveragePercent` / `wrongCommitmentIncidentCount` / `preventedWrongCommitmentCount` 注入 internal tenant weekly scorecard。
3. 进入 P0-REQ-06 gate 注册时，本 gate 以 `trace_roi_pilot_proof_gate` 类挂入，必须保持 customerVisibleRisk 不空、active 在 keep。
4. 在 Phase 3 真实 trace 接入前，本 gate 仍是 read-only；任何把 fixture 当成真实生产 trace 的解读都被禁止。

## 7. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-05 | Fixture 从 5 条扩到 16 条：新增 Pack A renewal（TRACE-ROI-006/007/008）、Phase 3 disabled-runtime TPQR-001/003/004（TRACE-ROI-009/010/011）、internal tenant dogfood（TRACE-ROI-012/013/014）、boundary negatives（TRACE-ROI-015/016）；scorecard：auditTraceCoveragePercent 100、wrongCommitmentIncidentCount 0、preventedWrongCommitmentCount 7、dealsRescuedCount 4、draftAdoptionPercent 63、followUp48hCompletionPercent 88、managerReviewTimeSavedMinutesTotal 234；接入 `npm run release:check` FAST preflight |
| 2026-05-05 | 首版 closeout：记录 P0-REQ-05 trace + ROI gate 交付物、验证结果、剩余风险和下一步 |
