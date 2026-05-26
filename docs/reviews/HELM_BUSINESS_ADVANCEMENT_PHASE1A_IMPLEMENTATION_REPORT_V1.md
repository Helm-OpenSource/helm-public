---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 1A 实现报告 V1

更新时间：2026-04-26
状态：Phase 1A complete / Phase 1B ready
本阶段：Phase 1A — Contract + Fixtures + Offline Eval
关联需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)
关联计划：[HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md)

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Planning contract 冻结 | `features/business-advancement/contracts.ts` | 定义 `AdvancementSignal`、`AdvancementJudgement`、`MustPushItem`、`ReviewRequiredAction`、`AdvancementSignalFixture`；不绑定 Prisma、不绑定 API、不含 execution authority |
| 20 个 machine-readable fixture | `features/business-advancement/fixtures.ts` | 覆盖 meeting / crm / tenant_resource / report / email / ask_helm / user_behavior / combined 共 8 类来源；全部合成数据，objectId 使用 `synth-` 前缀 |
| Offline eval（11 项检查） | `features/business-advancement/offline-eval.ts` | 纯函数，无网络、无外部服务、无 LLM 调用、无生产数据访问；可重复执行 |
| Offline eval 测试套件（42 个测试） | `features/business-advancement/offline-eval.test.ts` | Vitest；覆盖 contract integrity / fixture integrity / offline eval checks / fixture stats / governance boundaries |
| Offline eval CLI 脚本 | `scripts/business-advancement-offline-eval.ts` | `npx tsx` 可直接执行；输出结构化报告；exit 0 on pass, 1 on fail |

**Phase 1A 通过条件满足情况：**

| 条件 | 目标 | 实际 | 状态 |
| --- | --- | --- | --- |
| Fixture 完整数量 | 20/20 | 20/20 | ✓ |
| 高风险项 review coverage | 100% | 100% (governance-gated: 16/20) | ✓ |
| Boundary incident count | 0 | 0 | ✓ |
| 信号源类型覆盖 | >= 4 类（meeting / crm / tenant_resource / ask_helm） | 8 类（所有要求来源均覆盖） | ✓ |
| Must Push 可压缩到 3-5 项 | 能 | 16 个 governance-gated fixture 跨 6+ source types，ranking 后可确定性压缩 | ✓ |
| LLM 不参与最终排序 | 无 fixture 授权 LLM 排序 | 0 violation | ✓ |

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| `AdvancementSignal` | Conceptual contract + 20 个 fixture 已验证 | Phase 1B 需验证能否从现有 read model 投影；Phase 2 需 Signal → Must Push adapter |
| `AdvancementJudgement` | Conceptual contract 定义、offline eval 验证 review posture 和 boundary | Phase 2 才进入真实展示；目前无 runtime extractor |
| `MustPushItem` | Planning contract 已定义，deterministic sort key 已建模 | Phase 2 才能进入真实面板；当前无 UI、无 schema |
| `ReviewRequiredAction` | Planning contract 已定义，`Exclude<ReviewPosture, "read_only">` 已约束 | Phase 2 需评估复用现有 approval / review surface |
| Read-model feasibility | Fixture 来源标注已完成（8 类 source type 全覆盖） | Phase 1B 需正式盘点 dashboard / operating / mobile / Ask Helm / memory 各 read model，明确哪些 fixture 可投影、哪些 future-only |
| Deterministic ranking contract | 排序规则在 contract 注释和 Must Push compressibility check 中已建模 | Phase 2 进入前需正式测试 ranking contract（riskLevel > dueAt > customerWaiting > blockedDecision > revenueImpact > evidenceConfidence > reviewRequired > updatedAt） |

---

## 三、刻意未做

与 Final Requirements V1 § 二（明确不做）和 Phase 1A 开工范围保持一致：

| 未做项 | 理由 |
| --- | --- |
| Prisma schema | Phase 1A 不允许；需等 Phase 2 进入条件全部满足后另行评审 |
| API route | 同上 |
| Runtime extractor | 同上 |
| Event queue | 同上 |
| Official write | 永久禁止，未来阶段仍需明确评审 |
| Auto execution | 永久禁止 |
| Formal skill promotion | Phase 4 planning contract；当前 `SkillSuggestion` 未进入运行时 |
| 现有页面行为改动 | Phase 1A 不允许；当前实现完全不触碰任何现有页面 |
| 自动发送 / 自动审批 / 自动结算 | 在 offline eval 中被明确测试为 forbidden（`checkNoForbiddenActionGrants`、`checkHighRiskDowngrade`） |
| LLM 最终排序权 | 在 offline eval `checkNoLlmFinalRanking` 中已覆盖；contract 通过 `RankingStrategy = "deterministic"` 类型固化 |
| 跨 workspace / tenant 聚合 | AS-FX-015 明确测试 `blocked` posture；offline eval 有专项 governance boundary 检查 |
| `MemoryCandidate` / `SkillSuggestion` 运行时闭环 | Phase 3/4 planning contract；当前未进入实现 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| 信号噪音可能过高 | 中 | Fixture pack 是合成样本，真实使用中 false positive 率未知；Phase 1B feasibility 和 Phase 2 pilot 应设立 < 20% false positive 验收指标 |
| Must Push 被误用成普通待办 | 中 | 通过 `boundaryNote` 和 `reviewPosture` 约束；UI 层（Phase 2）需明确区分 Must Push 与普通任务列表，避免被误当 to-do tool |
| 多源 evidence 引入权限边界风险 | 中 | AS-FX-019 / AS-FX-020 测试 combined 来源；Phase 1B 需确认多源聚合不扩大 membership / capability 权限 |
| 用户误读 recommendation 为 commitment | 中 | 20 个 fixture 均有 `recommendation != commitment` 或等价 boundary note；但 Phase 2 UI 仍需显式展示 `boundaryNote`，不能仅依赖内部 contract |
| Phase 1B read-model gap 可能阻塞 Phase 2 | 中 | 部分信号来源（如 email 实时扫描、meeting action item 实时抽取）可能在当前 read model 中无直接投影；Phase 1B 需明确标注 future-only，防止为赶进度而引入 runtime extractor |
| 团队被自动化叙事带偏 | 低（已有预防机制） | Final Requirements 已明确收口为"推进优先"而非"自动化优先"；offline eval 的 forbidden action 检查和 boundary note 覆盖检查已作为持续护栏 |
| TypeScript 类型检查存在已知无关阻塞 | 低（已记录） | `.next/types/cache-life.d 2.ts`、`.next/types/routes.d 2.ts`、`.tmp/playwright/.next/types/*` 等生成文件名含空格导致 `npx tsc --noEmit` 报错；这是与 Phase 1A 无关的已知问题，不影响本阶段产出 |

---

## 五、验证结果

### 5.1 Vitest 单元测试

```
npx vitest run features/business-advancement/offline-eval.test.ts

 Test Files  1 passed (1)
      Tests  42 passed (42)
   Duration  ~122ms
```

### 5.2 Offline eval 脚本

```
npx tsx scripts/business-advancement-offline-eval.ts

Fixture Statistics:
  Total fixtures:           20
  read_only:                4
  review_required:          11
  human_owner_required:     4
  blocked:                  1
  governance-gated total:   16

Source Coverage:
  ask_helm                 3
  combined                 2
  crm                      3
  email                    2
  meeting                  3
  report                   2
  tenant_resource          3
  user_behavior            2

11/11 checks passed, 0 failed
✓ Phase 1A offline eval PASSED
```

### 5.3 ESLint

```
npx eslint features/business-advancement scripts/business-advancement-offline-eval.ts

(0 errors, 0 warnings)
```

### 5.4 Git whitespace check

```
git diff --check -- features/business-advancement scripts/business-advancement-offline-eval.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE1A_IMPLEMENTATION_REPORT_V1.md docs/README.md

(0 whitespace errors)
```

### 5.5 TypeScript 已知阻塞（不影响 Phase 1A 交付）

`npx tsc --noEmit` 在当前 worktree 因 `.next/types/cache-life.d 2.ts`、`.next/types/routes.d 2.ts`、`.tmp/playwright/.next/types/*` 等生成文件名含空格报错。这些文件与 Phase 1A 实现无关，不在本阶段修复范围内。Phase 1A 文件自身无类型错误。

---

## 六、Phase 1B 下一步

Phase 1A 已通过，建议进入 Phase 1B（Read-model Adapter Feasibility）：

1. 盘点现有 dashboard / operating / mobile / Ask Helm / memory read model。
2. 对 20 个 fixture 的 `sourceType` 逐一标注：
   - `current_read_model_supported`：当前 read model 可直接投影
   - `requires_thin_projection`：需要增加只读 projection helper（不新增持久化）
   - `future_only`：当前阶段无法实现，需等 Phase 2+ extractor
3. 输出 feasibility matrix 和 Phase 1B report。
4. 根据 Phase 1B 结论决定是否进入 Phase 2（Signal → Must Push Adapter）。

Phase 1B 约束与 Phase 1A 一致：不新增 schema、不新增 runtime extractor、不新增 event ingestion、不新增 auto-write、不新增 execution authority、不改变现有对象事实来源。

---

## 七、工程交付格式（依 Implementation Start Plan § 8）

| 字段 | 值 |
| --- | --- |
| 本次属于 | Phase 1A |
| 是否新增 schema | 否 |
| 是否新增 runtime extractor | 否 |
| 是否新增 official write | 否 |
| 是否改变页面行为 | 否 |
| 验证命令和结果 | 见上方 §五 |
| 剩余风险 | 见上方 §四 |

---

## 八、Phase 2 Go / Revise / No-Go 建议

**建议：Go（有条件）**

Phase 1A 六项通过条件全部满足。Phase 1B feasibility 完成后，如以下条件成立，则可进入 Phase 2：

1. 至少 3 类信号源确认可从现有 read model 投影（或明确 future-only）。
2. Deterministic ranking contract 通过正式测试。
3. Review posture 与 boundary note contract 在 Phase 1B report 中获评审确认。
4. Mobile / dashboard / operating 的展示口径已统一（不需要 Phase 1B 完成，但需在 Phase 2 入口前对齐）。

条件不满足时，Phase 1B 输出应明确说明阻塞原因，不得绕过进入 Phase 2。
