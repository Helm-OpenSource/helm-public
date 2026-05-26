---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3B / TPQR-004 / PF3A-004 Customer-Waiting Planning V1

更新时间：2026-04-26
状态：Phase 3B planning-only artifact / 不构成 runtime adoption / 不构成 schema 变更 / 不构成 API / UI / 页面 / 生产 query 行为变更
本阶段：依据 [HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_CLOSEOUT_AND_PHASE3B_ENTRY_DECISION_V1.md) 与 [HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A004_EMAIL_THREAD_DEDUP_DESIGN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE3A_PF3A004_EMAIL_THREAD_DEDUP_DESIGN_V1.md) 的 Conditional Planning Go，把 PF3A-004 / TPQR-004（email thread / `customer_waiting`）的 producer merge、emailThread.id dedup 与 `MustPushItem` 输入形状以 deterministic、planning-only 的方式形式化

---

## 声明

**本报告与对应代码 artifact 是 Phase 3B 的 planning-only 交付。**

- 整体 Phase 3B 仍是 **planning-only conditional partial Go**。
- runtime / schema / API / UI / 页面行为 / official write / automated execution / LLM final ranking / production query path = **No-Go**。
- 本 artifact 仅覆盖 **PF3A-004 / TPQR-004（customer_waiting） Conditional Planning Go**。
- TPQR-002 与 TPQR-005 继续维持 No-Go；本 artifact 不为它们解锁。

核心约束：任何 future thin read-model planning 若要 surface `customer_waiting`，必须保留 PF3A-004 的 ownership rule：

```text
merge_and_dedup_by_email_thread_id_after_producers
tie-break: [tpqr004_crm_linked, loadWaitingEmailThreads_generic]
```

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Planning artifact 实现 | `features/business-advancement/phase3b-customer-waiting-planning.ts` | 纯 TypeScript、无 DB / 网络 / `Date.now` 副作用；导出 TPQR-004 / PF3A-004 常量、24h planning threshold、producer rank、fixture rows、per-row evaluator、dedup helper、排序器与总 evaluator |
| Planning fixture 5 行 | 同文件 `CUSTOMER_WAITING_PLANNING_FIXTURE_ROWS` | 覆盖 TPQR-004 CRM-linked winner、同 emailThreadId generic loser、generic-only winner、fresh threshold exclusion、workspace boundary exclusion |
| Dedup rule | `dedupCustomerWaitingByEmailThreadIdAfterProducers` | 在 producer candidates 都构建完成后按 emailThreadId dedup；TPQR-004 CRM-linked producer rank 0，generic rank 1；最终 candidates 无重复 emailThreadId |
| Evaluator 10 项检查 | `evaluateCustomerWaitingPlanning` | 覆盖 TPQR-004 anchor、dedup ownership rule、final duplicate emailThreadId、无 runtime/schema/write authority、workspace membership、exclusion reasons、deterministic ordering、boundary distinctions、candidate shape、fixture coverage |
| Vitest 测试 | `features/business-advancement/phase3b-customer-waiting-planning.test.ts` | 42 个测试，覆盖 fixture、waitedMs、per-row eval、dedup tie-break、deterministic ordering、forbidden wording、summary checks 与 failure modes |
| CLI 脚本 | `scripts/business-advancement-phase3b-customer-waiting-planning.ts` | 打印 candidates、excluded、checks；任一 evaluator check 失败时 exit 1 |
| 文档索引 | `docs/README.md` | 新增 TPQR-004 Phase 3B planning 报告条目 |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| 24h waiting threshold | 本 artifact 中是 planning candidate，只用于 fixture 和 evaluator | 真实数据校准必须另起独立评审；不得直接转成 production threshold |
| `MustPushItem` 输入形状 | 候选 `extends MustPushItem`，并携带 `planningOnly`、producer、emailThreadId、waitedMs、evaluatedAtMs、sourceRowId、thresholdMs 等 planning metadata | 任何接入 `features/mobile/lib/mobile-command-read-model.ts` 或 `data/queries.ts` 的行为属于独立 surface review |
| TPQR-004 与 generic producer 关系 | 已形式化为 producer-rank + after-producer dedup | 未来实现必须证明既有 `loadWaitingEmailThreads` 不会绕过 dedup ownership rule |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| Prisma schema 变更 | Phase 3B planning-only，`schemaChangeAllowed = false` |
| runtime extractor / event queue / background job | 本 artifact 只在 synthetic fixture 上运行纯函数 |
| API route / app page / dashboard / mobile / search 行为变更 | 不在本阶段允许范围 |
| 修改 `features/mobile/lib/mobile-command-read-model.ts` | PF3A-004 只要求保留 dedup ownership rule，不批准 mobile read model 接入 |
| 修改 `data/queries.ts`、`app/`、`app/api/`、`lib/*` | 与本 planning artifact 解耦 |
| TPQR-002 / TPQR-005 planning | 上游 closeout 仍为 No-Go |

---

## 四、风险项

| 风险 | 严重程度 | 缓解 |
| --- | --- | --- |
| 把本 artifact 误读成 runtime adoption | 高 | 文件头、报告、CLI、boundary note 均声明 planning-only；evaluator 阻断授权措辞 |
| emailThread.id 重复 resurfacing | 高 | evaluator 检查 final candidates 无重复 emailThreadId，并用重叠 producer fixture 证明 TPQR-004-first |
| generic producer 覆盖 TPQR-004 CRM-linked producer | 高 | producer rank 固定：`tpqr004_crm_linked = 0`，`loadWaitingEmailThreads_generic = 1`；dedup proof 在反转输入下仍要求 TPQR-004 winner |
| workspace boundary 被绕过 | 高 | per-row eval 优先排除 `workspace_boundary_not_confirmed`；evaluator 检查 included candidates 必须来自 confirmed membership rows |
| 24h threshold 被当成生产规则 | 中 | 报告和 CLI 明确为 planning candidate；真实数据校准独立处理 |

---

## 五、Decision / scope

- **决策**：Phase 3B / TPQR-004 / PF3A-004 Conditional Planning Go 已交付；候选数 2，排除数 3；10 项 evaluator checks 全部 PASS（已由 Codex 后续验证确认）。
- **范围**：仅限 `features/business-advancement/phase3b-customer-waiting-planning.ts` / 同名 `.test.ts` / `scripts/business-advancement-phase3b-customer-waiting-planning.ts` / 本报告 / `docs/README.md` 索引。
- **不包含**：runtime extractor、event queue、background job、Prisma schema 变更、API route、page / UI 行为、official write、automated execution、LLM final ranking、production query path、`features/mobile/lib/mobile-command-read-model.ts` 接入、`data/queries.ts` 行为变更。
- **下一步建议**：Phase 3B planning-only 可做项已覆盖 TPQR-001 / TPQR-003 / TPQR-004；接下来应做 Phase 3B closeout，再决定是否进入 thin read-model runtime 接入评审。TPQR-002 / TPQR-005 仍不解锁。

---

## 六、Validation note

Claude Code 写出了代码 artifact、测试与 CLI，但在写报告前达到 900 秒硬超时；Codex 后续补齐本报告与索引，并完成以下验证：

- `git diff --check -- features/business-advancement/phase3b-customer-waiting-planning.ts features/business-advancement/phase3b-customer-waiting-planning.test.ts scripts/business-advancement-phase3b-customer-waiting-planning.ts docs/README.md`
- `npx eslint features/business-advancement/phase3b-customer-waiting-planning.ts features/business-advancement/phase3b-customer-waiting-planning.test.ts scripts/business-advancement-phase3b-customer-waiting-planning.ts`
- `npx tsx scripts/business-advancement-phase3b-customer-waiting-planning.ts`
- `npx vitest run features/business-advancement/phase3b-customer-waiting-planning.test.ts`

本报告加入索引后，Codex 已补跑并通过最终 closeout 验证：

- `git diff --check -- features/business-advancement/phase3b-customer-waiting-planning.ts features/business-advancement/phase3b-customer-waiting-planning.test.ts scripts/business-advancement-phase3b-customer-waiting-planning.ts docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3B_TPQR004_CUSTOMER_WAITING_PLANNING_V1.md docs/README.md`
- `npm run check:boundaries`
- `npx vitest run features/business-advancement/*.test.ts`
