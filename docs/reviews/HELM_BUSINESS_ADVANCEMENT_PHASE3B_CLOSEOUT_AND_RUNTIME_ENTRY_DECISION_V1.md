---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 3B Closeout And Runtime Entry Decision V1

更新时间：2026-04-26
状态：Phase 3B planning-only closeout / 不批准 runtime entry / 不批准 schema、API、UI、mobile read-model、production query 接入

---

## 结论

Phase 3B 的 planning-only 工作可以收口，但**不批准直接进入 runtime implementation**。

本轮已把 Phase 3A closeout 允许继续规划的三条线收成独立 artifact：

- TPQR-001 / PF3-001：`blocked_decision`
- TPQR-003 / PF3A-003：`overdue_commitment`
- TPQR-004 / PF3A-004：`customer_waiting`

继续保持 No-Go：

- TPQR-002 / PF3A-002：`stalled_opportunity` 基于 `Opportunity.updatedAt` 的 staleness heuristic
- TPQR-005 / PF3A-005：`tenant_resource stalled_case` 作为 human-inactivity 信号

下一步不是写 runtime，而是进入 **Phase 3C Runtime Entry Review**：只评估是否允许做一个 thin read-model adapter plan，不直接批准 Prisma schema、API route、page/mobile UI、production query adoption、official write、automated execution 或 LLM final ranking。

---

## 一、已经完整成立

| TPQR | Artifact | 当前结果 | 验证 |
| --- | --- | --- | --- |
| TPQR-001 / PF3-001 | [HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR001_BLOCKED_DECISION_PLANNING_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR001_BLOCKED_DECISION_PLANNING_V1.md) | `meeting / blocked_decision` 48h planning candidate 形式化；1 inclusion / 3 exclusions；候选 `extends MustPushItem`；workspace、review、boundary、deterministic ordering 成立 | CLI 9/9；targeted Vitest 27/27；Business Advancement 全量 12 文件 / 349 测试；`check:boundaries` PASS |
| TPQR-003 / PF3A-003 | [HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR003_OVERDUE_COMMITMENT_PLANNING_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR003_OVERDUE_COMMITMENT_PLANNING_V1.md) | `commitment / overdue_commitment` read-time `dueDate/status` 派生形式化；持久化 `Commitment.overdueFlag` 不作为权威；2 inclusions / 4 exclusions | CLI 10/10；targeted Vitest 39/39；Business Advancement 全量 13 文件 / 388 测试；`check:boundaries` PASS |
| TPQR-004 / PF3A-004 | [HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR004_CUSTOMER_WAITING_PLANNING_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR004_CUSTOMER_WAITING_PLANNING_V1.md) | `customer_waiting` producer merge + `emailThreadId` dedup ownership rule 形式化；TPQR-004-first tie-break；2 inclusions / 3 exclusions | CLI 10/10；targeted Vitest 42/42；Business Advancement 全量 14 文件 / 430 测试；`check:boundaries` PASS |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| MustPush planning input shapes | 三条 candidate 均 `extends MustPushItem`，并携带 planning-only metadata | Phase 3C 只能评估 thin read-model adapter plan，不能直接接入 dashboard/mobile/search |
| Runtime guard | 关键 guard 已分摊到三个独立 evaluator：workspace membership、dedup ownership、persisted-column non-authority、forbidden authorization wording、deterministic ordering | 进入 runtime 前必须有单独 runtime entry checklist，逐条证明不扩大 authority |
| Thresholds | TPQR-001 48h、TPQR-004 24h 均仍是 planning candidate；TPQR-003 read-time dueDate/status 是 planning rule | 必须用真实数据校准后才能成为 runtime threshold |
| Documentation chain | Phase 3A closeout -> Phase 3B per-TPQR artifacts -> 本 closeout 已连通 | 若进入 Phase 3C，需要新增 runtime entry review 文档，而不是修改既有 planning docs 直接放行 |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| Prisma schema 变更 | Phase 3B 只批准 planning artifacts |
| API route / app page / mobile surface | 仍未进入 runtime / UI 接入评审 |
| `data/queries.ts` / `features/mobile/lib/mobile-command-read-model.ts` 接入 | 这两个是 runtime/surface 行为变更，必须留到 Phase 3C 之后 |
| production query adoption | Phase 3B 不把 synthetic fixture 结论写成 production query truth |
| official write / automated execution / outbound send | 与 Business Advancement planning layer 无关，继续 No-Go |
| LLM final ranking | 三个 artifact 均使用 deterministic ordering；LLM 不参与 final ranking |
| TPQR-002 / TPQR-005 | 上游已判定 No-Go，未被本轮 planning work 解锁 |

---

## 四、风险项

| 风险 | 严重程度 | 处理 |
| --- | --- | --- |
| 把 planning artifacts 误读成 implementation approval | 高 | 本 closeout 明确 runtime entry = No-Go；必须另起 Phase 3C Runtime Entry Review |
| threshold 未经真实数据校准即接入 production | 高 | TPQR-001 / TPQR-004 threshold 均继续标注 planning candidate |
| TPQR-003 误用 persisted `overdueFlag` | 高 | 只允许 read-time `dueDate/status` 或既有 `deriveOverdueFlag`；不得把 persisted column 作为唯一时间敏感过滤条件 |
| TPQR-004 duplicate email thread resurfacing | 高 | 必须保留 after-producer dedup + TPQR-004-first tie-break；不能让 generic producer 绕过 ownership rule |
| TPQR-002 / TPQR-005 被顺手并入 runtime | 高 | 维持 No-Go，进入 Phase 3C 时不得作为 allowed runtime source |

---

## 五、Runtime Entry Decision

当前决策：

- Phase 3B planning-only：**Complete**
- Phase 3C Runtime Entry Review：**Conditional-Go for review only**
- Runtime implementation：**No-Go**
- Schema / API / UI / mobile read-model / production query adoption：**No-Go**
- Official write / automated execution / LLM final ranking：**No-Go**

Phase 3C 只允许产出一份 runtime entry review，回答：

1. 是否只接 TPQR-001 / TPQR-003 / TPQR-004，继续排除 TPQR-002 / TPQR-005。
2. 是否能在不改 schema、不加 API、不改 UI 的前提下做 thin read-model adapter plan。
3. 是否能保留三条 planning evaluator 的核心不变量。
4. 是否有真实数据校准路径，而不是直接采用 synthetic fixture threshold。
5. 是否有 rollback / disable / audit posture。

---

## 六、Validation

Phase 3B closeout 前已完成以下验证：

- `npx tsx scripts/business-advancement-phase3b-blocked-decision-planning.ts` -> 9/9 PASS
- `npx tsx scripts/business-advancement-phase3b-overdue-commitment-planning.ts` -> 10/10 PASS
- `npx tsx scripts/business-advancement-phase3b-customer-waiting-planning.ts` -> 10/10 PASS
- targeted Vitest：TPQR-001 27/27、TPQR-003 39/39、TPQR-004 42/42 PASS
- targeted ESLint：三组 Phase 3B artifact / test / script PASS
- `npm run check:boundaries` PASS
- `npx vitest run features/business-advancement/*.test.ts` -> 14 文件 / 430 测试 PASS

本 closeout 写入后，Codex 已补跑并通过最终验证：

- `git diff --check -- docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3B_CLOSEOUT_AND_RUNTIME_ENTRY_DECISION_V1.md docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR004_CUSTOMER_WAITING_PLANNING_V1.md docs/README.md features/business-advancement/phase3b-customer-waiting-planning.ts features/business-advancement/phase3b-customer-waiting-planning.test.ts scripts/business-advancement-phase3b-customer-waiting-planning.ts`
- `npm run check:boundaries`
- `npx vitest run features/business-advancement/*.test.ts`
