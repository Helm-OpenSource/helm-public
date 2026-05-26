---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Distillation Candidate Phase 4B Runtime Persistence Report v1

更新时间：2026-04-27
状态：Phase 4B runtime persistence substrate closed
Owner：Helm Core
PR：MEM-DISTILL-006B

> 本报告记录 Phase 4B 的实现边界与验证结果。Phase 4B 只把 Phase 4A 的纯离线 distillation detector 接成 review-safe persistence substrate：候选对象可以落库、review decision 可以持久化、meeting memory pipeline 在 fact write 成功后可以后置同步候选。它仍不写 canonical `MemoryFact`、不 auto-promote promoted memory、不接管 recommendation ranking、不提供 operator UI workflow、不扩大 execution authority。

---

## 1. 冻结结论

Phase 4B 在以下范围内成立：

- `MemoryDistillationCandidate` Prisma model 与 MySQL migration 已落地，并在隔离库完成 `db:reset / seed`。
- `lib/memory/distillation-candidate.ts` 输出稳定 `groupKey`，供 persistence 层幂等识别。
- `lib/memory/distillation-candidate-store.ts` 提供 `syncMemoryDistillationCandidatesForObject` 与 `reviewMemoryDistillationCandidate`。
- meeting memory pipeline 只在 `MemoryFact` batch write 成功后触发 distillation candidate sync；fact write failure 路径不会触发。
- sync failure 不阻断 meeting memory pipeline，只进入最终 `MEETING_MEMORY_PROCESSED` audit metadata 与返回 payload。
- approve / reject / defer 只更新 candidate decision 字段；approve 不创建 canonical fact 或 promoted memory。

---

## 2. 已经完整成立

| 项目 | 说明 |
| --- | --- |
| 持久化 substrate | 新增 `MemoryDistillationCandidate`，含 `groupKey`、source refs、review status、decision fields、audit payload |
| reviewed decision 不可绕过 | sync 会把 `APPROVED / REJECTED / DEFERRED` 转成 detector prior decisions；reviewed candidate 不会被重置为 pending |
| review-only service | `reviewMemoryDistillationCandidate` 只写 status、decisionReason、decidedAt、decidedByUserId 与 auditPayload |
| meeting pipeline 后置接入 | 只在 fact write 成功后基于 unique `objectType/objectId` 同步，最多 8 个对象 |
| failure containment | distillation sync failure 被记录为 summary，不中断 meeting memory pipeline |
| 审计边界 | sync 与 review 均写 `writeMemoryAuditAndEvent`，metadata 明确不写 canonical facts、不 auto-promote、不改 ranking |

---

## 3. 已成形但仍需下一层

| 项目 | 当前状态 | 下一层说明 |
| --- | --- | --- |
| Operator UI workflow | 已有 service 与 decision persistence，无前台 review queue | Phase 4C 才接 `/memory` 或 diagnostics operator surface |
| promoted memory | `APPROVED` 只代表 candidate review decision | 后续必须另建 promotion contract，且继续 review-first |
| retrieval pack promotion layer | Candidate 尚未进入 pack builder 的 summary layer | 后续只允许 read-first / no-ranking-takeover 接入 |
| live threshold calibration | 当前仍沿用 repeated normalized facts 阈值 | 需 redacted live DB snapshot 校准 false positive |
| full owner workflow | 有审计与 service substrate，无完整 owner assignment / SLA / queue | 后续再设计，不在 Phase 4B 扩面 |

---

## 4. 刻意未做

1. 不写 canonical `MemoryFact`。
2. 不自动创建 promoted memory。
3. 不接管 recommendation ranking。
4. 不新增 operator UI workflow。
5. 不做 API route 或 public action surface。
6. 不重跑 meeting pipeline、不自动修正 commitment / blocker lane。
7. 不扩大 auto-send、auto-approval、official write 或 execution authority。

---

## 5. 风险项

| 风险 | 说明 | 处置建议 |
| --- | --- | --- |
| candidate false positive | 真实数据中重复 normalized facts 可能仍有噪音 | Phase 4C 前做 redacted live DB calibration |
| review UI 缺口 | 当前 reviewed decisions 可通过 service 写入，但没有正式 operator surface | 下一阶段先做 read-only queue / operator review surface |
| sync fan-out | meeting 可能关联多个对象 | Phase 4B 限制最多 8 个对象，并把 failure 收进 summary |
| shared DB migration state | 共享库仍可能有旧 migration blocker | 本轮已在隔离库验证 migration；共享库 repair 另列任务 |

---

## 6. 验证结果

| 检查项 | 结果 |
| --- | --- |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4b_verify?charset=utf8mb4' DB_RESET_ALLOWLIST='helm2026_memory_phase4b_verify' npm run db:reset` | passed；migration 与 seed 均通过 |
| `npm test -- --run lib/memory/distillation-candidate.test.ts lib/memory/distillation-candidate-store.test.ts` | 2 files / 21 tests passed |
| `npm test -- --run lib/memory/meeting-memory-pipeline-write-failure.test.ts lib/memory/distillation-candidate.test.ts lib/memory/distillation-candidate-store.test.ts` | 3 files / 24 tests passed |
| `npx eslint lib/memory/meeting-memory-pipeline.service.ts lib/memory/meeting-memory-pipeline-write-failure.test.ts lib/memory/distillation-candidate-store.ts lib/memory/distillation-candidate-store.test.ts lib/memory/distillation-candidate.ts lib/memory/distillation-candidate.test.ts` | passed |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4b_verify?charset=utf8mb4' npm run eval:memory` | relevance 3/3、stability 3/3、duplicate_omission 3/3、distillationCandidateSummary 4/4 |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4b_verify?charset=utf8mb4' npm run eval:recommendation` | 4/4 passed |
| `npm run check:boundaries` | passed，含 Phase 4B runtime persistence boundary |
| `npm run self-check` | 20/20 passed |
| `npm run typecheck` | passed |
| `npm run lint` | passed；7 条既有 warning，0 errors |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4b_verify?charset=utf8mb4' npm run test` | 391 files / 2698 tests passed |
| `npm run build` | passed；既有 Turbopack NFT warning |
| `npm run quality:regression` | 51 files / 181 tests passed |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4b_verify?charset=utf8mb4' npm run e2e` | 34/34 passed；E2E 内部临时库成功应用 Phase 4B migration |
| `git diff --check` | passed |

说明：第一次 `npm run typecheck` 命中本地 `.next/types/* 2.ts` 重复生成污染；删除 `.next/types` 后重跑通过。该问题不是 Phase 4B runtime 代码类型错误。
说明：第一次全量 `npm run test` 与 `npm run db:generate` 并行执行，导致测试进程读到正在重写的 Prisma engine；随后串行 `db:generate -> db:reset -> test` 全量通过。E2E 仍出现既有 MySQL 1020 日志（`dailyUsageSnapshot / recommendationLog / membership`），但 34 个用例全部通过，非本 slice 引入。

---

## 7. 下一步

Phase 4C 建议只选一个小切片继续：

1. read-only operator queue：把 pending distillation candidates 以只读 queue 形式暴露给 operator。
2. review action surface：在现有 memory / diagnostics surface 上接 approve / reject / defer，继续不做 promoted memory。
3. redacted live DB calibration：用真实样本评估 false positive、duplicate/noisy candidate rate 与 review usefulness。
4. retrieval pack summary layer：只读消费 approved candidate，且明确不改变 ranking owner。

Phase 4B 冻结结论：runtime persistence substrate 已成立；完整 operator workflow、promoted memory 和 retrieval pack adoption 仍未成立。
