---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Distillation Candidate Phase 4C Review Surface Report v1

更新时间：2026-04-27
状态：Phase 4C review surface closed
Owner：Helm Core
PR：MEM-DISTILL-006C

> 本报告记录 Phase 4C 的实现边界与验证结果。Phase 4C 只把 Phase 4B 的 `MemoryDistillationCandidate` persistence substrate 接到 `/memory` 第一层 operator review surface：pending candidates 可以被查看，recent decisions 可以被审计，reviewer 可以执行 approve / reject / defer。该 action 仍只记录 review decision，不写 canonical `MemoryFact`、不创建 promoted memory、不改变 recommendation ranking、不执行外部动作、不扩大 execution authority。

---

## 1. 冻结结论

Phase 4C 在以下范围内成立：

- `/memory` 可以展示当前 workspace 的 pending distillation candidates。
- `/memory` 可以展示最近 reviewed decisions，避免 approve / reject / defer 后候选从 operator 视野中消失。
- `reviewMemoryDistillationCandidateAction` 通过当前 workspace session 与 memory management permission gate 调用 Phase 4B store service。
- 页面 copy 明确：approve / reject / defer 只记录候选复核决策，不创建 canonical `MemoryFact`、不 promote memory、不执行动作、不改变 recommendation ranking，并且不是聊天入口。
- OPENCLAW-only source filter 不展示 Helm distillation candidate review queue。

---

## 2. 已经完整成立

| 项目 | 说明 |
| --- | --- |
| Review queue read model | `getMemoryData` 返回 `distillationCandidates` 与 `distillationDecisions`，并支持 object-scoped filter |
| Deterministic ordering | pending queue 按 `latestSourceAt / createdAt / id` 排序；recent decisions 按 `decidedAt / updatedAt / id` 排序 |
| Workspace-scoped action | action 通过 `getCurrentWorkspaceSession` 与 Phase 4B store service，store 继续校验 workspace access |
| Permission boundary | review buttons 仅对现有 memory management 权限角色可见 |
| Review-only posture | approve / reject / defer 不调用 recommendation refresh，不写 canonical `MemoryFact`，不创建 promoted memory |
| Non-chat UI | `/memory` review surface 以 queue / audit trail 展示，不保存 conversation history、不引导 follow-up chat |

---

## 3. 已成形但仍需下一层

| 项目 | 当前状态 | 下一层说明 |
| --- | --- | --- |
| Full owner workflow | 已有 `/memory` 第一层 review surface | assignment、SLA、owner queue、bulk review 另起 contract |
| promoted memory | `APPROVED` 仍只是 candidate decision | promoted memory 必须单独设计 promotion contract |
| retrieval pack promotion layer | Candidate 尚未进入 retrieval pack summary layer | 后续只允许 read-first 接入，不得接管 ranking owner |
| calibration | 当前仍依赖 deterministic detector 与现有 fixtures | 需要 redacted live DB false-positive / usefulness calibration |
| visual E2E | 全局 E2E 覆盖 route 基线 | 候选队列 populated-state 的浏览器截图验收可后续补 |

---

## 4. 刻意未做

1. 不写 canonical `MemoryFact`。
2. 不创建 promoted memory。
3. 不接管 recommendation ranking。
4. 不自动执行 retry、send、approval、commitment 或 external write。
5. 不做 chat surface、conversation history 或 follow-up prompt。
6. 不做 full owner workflow、bulk review、assignment 或 SLA。
7. 不新增 schema / migration。

---

## 5. 风险项

| 风险 | 说明 | 处置建议 |
| --- | --- | --- |
| candidate false positive | UI 可见后噪音会更直接影响信任 | 下一层做 redacted live DB calibration，并记录 accepted / rejected / deferred rate |
| approve 语义误读 | 用户可能把 approve 误解为 promoted memory | UI 与 action report 已明确 approve 只记录 review decision；promotion 必须另起 contract |
| queue density | pending candidate 过多会干扰 Memory 首屏 | 当前限制 24 条，后续如进入真实使用需做 grouping / folding |
| permission granularity | 当前复用 memory management capability | 若未来需要只读 reviewer 与 candidate reviewer 分离，应新增 capability plan，而不是在 UI 层绕过 |

---

## 6. 验证结果

| 检查项 | 结果 |
| --- | --- |
| `npm test -- --run features/memory/queries.test.ts features/memory/actions.test.ts features/memory/memory-client-source-contract.test.ts` | passed |
| `npm test -- --run features/memory` | passed |
| `npx eslint app/(workspace)/memory/page.tsx features/memory/queries.ts features/memory/actions.ts features/memory/memory-client.tsx features/memory/queries.test.ts features/memory/actions.test.ts features/memory/memory-client-source-contract.test.ts` | passed |
| `npm run typecheck` | passed |
| `npm run check:boundaries` | passed，含 Phase 4C review surface boundary |
| `npm run self-check` | passed，含 Phase 4C review surface check |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4c_verify?charset=utf8mb4' npm run eval:memory` | relevance / stability / duplicate_omission / distillationCandidateSummary passed |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4c_verify?charset=utf8mb4' npm run eval:recommendation` | passed |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4c_verify?charset=utf8mb4' npm run test` | passed |
| `npm run build` | passed；既有 Turbopack NFT warning |
| `npm run quality:regression` | passed |
| `DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4c_verify?charset=utf8mb4' npm run e2e` | passed |
| `git diff --check` | passed |

---

## 7. 下一步

Phase 4D 建议不要直接做 promoted memory，先做两个校准切片：

1. redacted live DB calibration：衡量 candidate false positive、accepted rate、deferred rate 与 noisy duplicate rate。
2. review usefulness readout：在 diagnostics 或 `/memory` 次级层展示 candidate review quality summary，但仍不改 ranking。
3. promoted memory contract draft：定义 approved candidate 何时、由谁、以什么 evidence gate 转成 promoted memory。
4. retrieval pack summary layer spike：只读消费 approved candidate，且明确不改变 ranking owner。

Phase 4C 冻结结论：`/memory` 第一层 review surface 已成立；full owner workflow、promoted memory、retrieval pack promotion layer 与自动执行权仍未成立。
