---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Distillation Candidate Phase 4A Report v1

更新时间：2026-04-27
状态：Phase 4A 冻结
Owner：Helm Core
PR：MEM-DISTILL-006（第一层）

> 本报告记录 Phase 4A 的实现边界与验证结果。Phase 4A 只完成 review-safe distillation candidate 的第一层：纯离线确定性检测器、离线 fixture 集与 eval 门控。无 distillation runtime、无 Prisma schema / migration、无 DB 写路径、无 canonical fact 自动重写、无 auto-promotion、无 recommendation ranking 接管、无 operator workflow。

---

## 1. 冻结结论

Phase 4A 在以下范围内成立并冻结：

- `lib/memory/distillation-candidate.ts`：纯确定性检测器，无副作用，无外部依赖。
- `lib/memory/distillation-candidate.test.ts`：13 个测试全部通过，覆盖边界条件。
- `evals/memory/distillation-candidates.json`：4 条离线 fixture，可离线复现。
- `lib/evals/memory-evals.ts`：输出 `distillationCandidateSummary`，4/4 通过。
- `scripts/memory-evals.ts`：distillation candidate eval 失败时非零退出，纳入 eval 门控。
- `duplicate_omission` eval 已收口排除 aggregate meeting summary facts；孤立 DB eval:memory 在隔离 DB 下 3/3 通过。

不在本次冻结范围内的所有内容见 §4「刻意未做」。

---

## 2. 已经完整成立

| 项目 | 说明 |
| --- | --- |
| 纯离线确定性检测器 | `lib/memory/distillation-candidate.ts` 无状态、无 LLM、无 DB，只依赖输入数组 |
| 13 测试全部通过 | 覆盖：重复事实创建候选、唯一事实不创建候选、不同 normalizedValue 不合并、已确认事实不绕过 review、reject/defer 先前决策阻断再生成、确定性排序、evidence/source 引用保留、边界注记、object/factType 边界、normalizedValue 回退行为、空语义跳过 |
| 4 条离线 fixture | `evals/memory/distillation-candidates.json` 固定 4 个场景，离线可复现 |
| `distillationCandidateSummary` eval 输出 | `lib/evals/memory-evals.ts` 已聚合检测器输出到独立摘要字段 |
| eval 门控脚本 | `scripts/memory-evals.ts` 在 distillation candidate eval 失败时退出非零 |
| `duplicate_omission` 3/3 | 已收口：排除 aggregate meeting summary facts；孤立 DB 下全通 |

---

## 3. 已成形但仍需下一层

| 项目 | 当前状态 | 下一层说明 |
| --- | --- | --- |
| 检测器与 retrieval pack 集成 | 检测器纯离线，pack builder 尚未消费其输出 | 需要 pack builder 在摘要层读取 distillation candidate 标记 |
| Promoted memory | 尚未引入 | 需要 review-first promotion posture 与 Prisma schema 支持 |
| Operator review workflow | 尚未引入 | 需要 review queue substrate 与 review surface 接入 |
| Distillation runtime | 尚未引入 | 需要 meeting pipeline 完成后触发检测器的 runtime 接入点 |
| DB 写路径 | 尚未引入 | Prisma schema / migration 尚未设计 |
| reject / defer 语义 | 离线输入级 reject/defer 阻断已实现；持久化 review 决策存储 / operator workflow / 跨 runtime 运行不可绕过仍需下一层 | 需要 Prisma schema 支持 `reject/defer` 字段持久化与 operator review surface 接入 |

---

## 4. 刻意未做

本轮 Phase 4A 明确不做以下内容：

1. distillation runtime：检测器不在 meeting pipeline 中自动触发。
2. Prisma schema / migration：无 `DistillationCandidate` table 或相关字段。
3. DB 写路径：候选对象不持久化。
4. canonical fact 自动重写：distillation candidate 不覆写原始 `MemoryFact`。
5. auto-promotion：candidate 不自动晋升为 promoted memory。
6. recommendation ranking 接管：检测器输出不改变 recommendation 排序权。
7. operator workflow：无 review queue 接入、无 operator surface 展示。

以上限制与 `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md` §4「明确不做」及 §5 R5 验收条件保持一致。

---

## 5. 风险项

| 风险 | 说明 | 处置建议 |
| --- | --- | --- |
| 阈值过低 | 检测器当前使用频次阈值判断，过低会产生大量 false positive candidate | Phase 4B 前应在真实 DB snapshot 上做阈值校准 |
| aggregate summary 误判 | duplicate_omission 已排除 aggregate meeting summary，但新的 aggregate 类型可能再次引入误判 | 新增 aggregate 类型时需同步更新排除规则 |
| candidate 未落库 | 候选目前只在内存/离线存在，无审计轨迹 | DB 写路径需在 Phase 4B 补上，否则 reject/defer 无法持久化 |
| eval 孤立 DB 依赖 | `eval:memory` 当前需要孤立 DB 环境，CI 尚未默认提供 | 需要在 CI 中明确 DB 环境配置，或明确说明 eval 仅在 local 运行 |

---

## 6. 验证结果

### 单元测试

```
npm run test -- lib/evals/memory-evals.test.ts lib/memory/distillation-candidate.test.ts
```

结果：**2 files / 24 tests passed**

- `lib/memory/distillation-candidate.test.ts`：13 tests
- `lib/evals/memory-evals.test.ts`：11 tests（含 `distillationCandidateSummary` 断言）

### Eval（孤立 DB）

```
DATABASE_URL='mysql://root:root@127.0.0.1:3306/helm2026_memory_phase4_verify?charset=utf8mb4' npm run eval:memory
```

结果：

| 类别 | 结果 |
| --- | --- |
| relevance | 3/3 |
| stability | 3/3 |
| duplicate_omission | 3/3 |
| distillationCandidateSummary | 4/4 |

### 收尾验证结果（Phase 4A 冻结）

| 检查项 | 结果 |
| --- | --- |
| `git diff --check` | passed |
| `npm run typecheck` | passed |
| `npm run lint` | passed（7 条既有 warning，0 errors）|
| `npm run test` | 390 files / 2689 tests passed（孤立 DB）|
| `npm run build` | passed（既有 Turbopack NFT warning，未新增）|
| `npm run quality:regression` | 51 files / 181 tests passed |
| `npm run check:boundaries` | passed，含 `helm_memory_distillation_candidate_phase4a_boundary` |
| `npm run self-check` | 19/19 passed |
| `npm run e2e` | 34/34 passed；E2E 期间出现既有 MySQL 1020 Prisma 日志，非本 slice 引入，未触及 DB 写路径，测试全通 |
| `npm run eval:recommendation` | 4/4 passed（孤立 DB）|

**遗留风险（更新备案）**

`eval:recommendation` 已通过评估器/golden 校准修复（4/4），修复内容：评估器 supportPool 扩展为包含 `memoryRetrievalPack.selected` 标题，以及 golden 样本中的过期措辞（`阻碍` → `阻塞`）与非活跃 learned pattern 对齐。此修复未扩展 runtime 权限、未变更 recommendation 排序逻辑、未触及 Memory Phase 4A 检测器。

---

## 7. 下一步

Phase 4B 应在以下方向之一推进（需优先级对齐后再启动）：

1. **distillation runtime 接入**：在 meeting pipeline 完成后触发检测器，输出 candidate 到内存 / review surface，不自动写入。
2. **Prisma schema 设计**：引入 `DistillationCandidate` 持久化对象，含 `reject / defer` 字段与 audit 字段。
3. **阈值校准**：在 redacted live DB snapshot 上验证检测器参数，防止 false positive 过多。
4. **retrieval pack 集成**：让 pack builder 在摘要层消费 distillation candidate 标记（只读，不改变 ranking owner）。

Phase 4A 冻结结论不变：当前只完成了离线检测器第一层，以上四项均为 Phase 4B 及后续。
