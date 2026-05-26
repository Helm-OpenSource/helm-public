---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 3E Thin Read-Model Adapter Implementation Report V1

更新时间：2026-04-26
状态：Pure planning adapter implementation complete / 不批准 runtime adoption / 不批准 schema、API、UI、mobile read-model 或 production query 接入

---

## 结论

Phase 3E 已完成一层 **pure planning adapter**，用于证明 Phase 3D 的 thin read-model adapter contract 可以被确定性、只读、可禁用、可审计地表达。

本阶段完成的是：

- `features/business-advancement/thin-read-model-adapter-planning.ts`
- `features/business-advancement/thin-read-model-adapter-planning.test.ts`
- `scripts/business-advancement-thin-read-model-adapter-planning.ts`

本阶段没有进入：

- runtime implementation
- Prisma schema 变更
- API route
- dashboard / operating / mobile UI 接入
- `data/queries.ts` 生产查询接入
- `features/mobile/lib/mobile-command-read-model.ts` 修改
- runtime extractor / event queue / background job
- official write / outbound send / automated execution
- LLM final ranking

---

## 一、已经完整成立

| 项目 | 当前结果 |
| --- | --- |
| Allowed families | Adapter 只允许 `blocked_decision`、`overdue_commitment`、`customer_waiting` |
| Default disable posture | `DEFAULT_THIN_READ_MODEL_ADAPTER_ENABLED_FAMILIES` 全部为 `false` |
| Synthetic source rows | 用 Phase 3B fixture rows 重新 scoped 到 `ws-synth-phase3e-adapter`，不读取真实 DB |
| Candidate count | 启用三类 family 后生成 5 个 candidates：1 blocked decision、2 overdue commitment、2 customer waiting |
| Excluded rows | 生成 10 个 exclusions，覆盖 threshold、review、membership、missing due date、terminal status、dedup loser 等原因 |
| TPQR-003 authority | persisted overdue flag 翻转不改变 inclusion；adapter candidate 不暴露 `persistedOverdueFlag` 字段名 |
| TPQR-004 dedup | customer waiting 最终 candidate 无重复 `emailThreadId`，并保留 dedup loser exclusion |
| Deterministic ordering | source row order 反转后 candidate 顺序和 sortKey 保持一致 |
| Disable switches | 任一 family disabled 后不输出对应 candidate |
| Audit bundle | 每个 candidate 带 TPQR、preflight、sourceRowId、ruleVersion、thresholdStatus |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| Thin adapter shape | 已在 pure planning artifact 中成立 | 若进入 Phase 3F，必须先做 runtime adoption gate，不得直接改 production read model |
| Thresholds | TPQR-001 48h 与 TPQR-004 24h 仍为 `calibration_placeholder` | 需要真实数据校准或 explicit conservative default 才能进入 runtime |
| Permission inheritance | 当前只证明 synthetic source rows 带 workspace scope | runtime 前必须证明 source query 已经过 workspace membership / capability gate |
| Candidate primaryAction | 当前只输出 `review` / `open` safe verb shape | UI / mobile 接入仍需单独 review，不能把 action 误写成 approval / send / write / execute |

---

## 三、刻意未做

| 未做项 | 原因 |
| --- | --- |
| 不修改 `data/queries.ts` | Phase 3E 不是 production query adoption |
| 不修改 `features/mobile/lib/mobile-command-read-model.ts` | Phase 3E 不是 mobile Must Push 接入 |
| 不修改 `app/` 或 `app/api/` | Phase 3E 不新增 UI / API surface |
| 不修改 `prisma/schema.prisma` | Phase 3E 不新增 schema，也不新增 maintenance column |
| 不做 TPQR-002 | `Opportunity.updatedAt` 仍不代表 human inactivity |
| 不做 TPQR-005 | `derivedStaleDays` 仍只证明 evidence freshness，不证明 human inactivity |
| 不做 official write / automated execution | Business Advancement 当前仍是 review-first planning layer |

---

## 四、风险项

| 风险 | 严重程度 | 处理 |
| --- | --- | --- |
| Phase 3E 被误读为 runtime approval | 高 | 本报告状态行和结论明确 runtime adoption 仍 No-Go |
| Synthetic fixture threshold 被生产化 | 高 | 所有 adapter candidate 的 `thresholdStatus` 均为 `calibration_placeholder` |
| persisted overdue flag 被误读为权威 | 高 | 测试证明翻转 persisted flag 不改变 TPQR-003 inclusion，adapter candidate 不暴露字段名 |
| customer waiting 与既有 mobile read model 重复 | 高 | Phase 3E 保留 TPQR-004 after-producer dedup，且不修改 mobile read model |
| workspace / capability gate 在 runtime 中被绕过 | 高 | 当前只做 planning；runtime 前必须单独证明 source query 继承权限 gate |

---

## 五、验证结果

已运行并通过：

- `npx vitest run features/business-advancement/thin-read-model-adapter-planning.test.ts`
  - 1 file / 8 tests PASS
- `npx tsx scripts/business-advancement-thin-read-model-adapter-planning.ts`
  - 10 / 10 checks PASS

Phase 3E evaluator checks：

1. `scope_only_phase3c_approved_families`
2. `no_go_families_absent`
3. `no_runtime_or_write_authority`
4. `workspace_scope_inherited`
5. `boundary_distinctions_present`
6. `overdue_persisted_flag_non_authority`
7. `customer_waiting_email_thread_deduped`
8. `deterministic_when_inputs_reversed`
9. `family_disable_switches_work`
10. `audit_bundle_complete`

---

## 六、当前决策

当前决策：

- Phase 3E pure planning adapter：**Complete**
- Runtime adoption：**No-Go**
- Schema / API / UI / mobile read-model / production query adoption：**No-Go**
- Official write / automated execution / LLM final ranking：**No-Go**

下一步建议进入 **Phase 3F Runtime Adoption Gate Review**，但只允许评审，不允许直接实现。Phase 3F 必须回答：

1. 是否有真实 source query 可以继承 workspace membership / capability。
2. 是否仍只包含 TPQR-001 / TPQR-003 / TPQR-004。
3. threshold 是否可校准，还是必须继续 conservative placeholder。
4. 是否有 feature flag / disable switch / rollback posture。
5. 是否能在不改 schema、不加 API、不改 UI 的前提下做最小只读 adoption。

Phase 3F 未完成前，不进入 runtime implementation。
