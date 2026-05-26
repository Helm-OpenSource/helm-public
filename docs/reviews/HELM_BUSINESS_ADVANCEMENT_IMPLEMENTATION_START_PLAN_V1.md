---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1

更新时间：2026-04-26
状态：Implementation start plan / limited scope
关联需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

## 1. 开工目标

本计划只支持 Helm Business Advancement 的第一阶段开工：

```text
Phase 1A: Contract + Fixtures + Offline Eval
Phase 1B: Read-model Adapter Feasibility
```

目标不是实现完整经营推进系统，而是用最小可验证方式证明：

1. `AdvancementSignal` 能否稳定描述经营推进信号。
2. `AdvancementJudgement` 能否稳定表达 evidence、review posture 和 boundary。
3. 20 个 fixture 能否通过 offline eval。
4. 现有 read model 是否足以投影第一批信号。
5. 后续是否值得进入 Phase 2 `Signal -> Must Push Adapter`。

---

## 2. 非目标

本计划不允许：

1. 不新增数据库 schema。
2. 不新增 API route。
3. 不新增 runtime extractor。
4. 不新增 event queue。
5. 不新增 official write。
6. 不新增 auto execution。
7. 不改变现有页面行为。
8. 不改变 Ask Helm 的权限边界。
9. 不让 LLM 做最终排序。
10. 不把 fixture 写成生产数据。

---

## 3. 受影响组件

第一阶段允许评估或新增的区域：

| 区域 | 允许动作 | 禁止动作 |
| --- | --- | --- |
| `docs/product/*` | 更新需求和 fixture 文档 | 把规划对象写成已实现 |
| `docs/reviews/*` | 写 implementation report / feasibility report | 写成完成报告前置 |
| `tests/fixtures/*` 或等价 fixture 目录 | 新增 offline eval 输入 | 使用真实敏感客户数据 |
| `features/*` 或 `lib/*` 的 planning contract 文件 | 新增只读类型和纯函数 helper，需另行评审 | 持久化、外部副作用、runtime extractor |
| `scripts/*` | 新增 offline eval / guard 脚本，需另行评审 | 触发真实系统动作 |
| 现有 read model | 只读盘点和 feasibility matrix | 修改事实来源或页面行为 |

如果工程实现需要落到以上目录之外，必须先更新本计划或另开 implementation plan。

---

## 4. 推荐任务拆分

### Task 1：冻结 planning contract

目标：

1. 定义 `AdvancementSignal`。
2. 定义 `AdvancementJudgement`。
3. 定义 `MustPushItem` 的 planning shape。
4. 定义 `ReviewRequiredAction` 的 planning shape。

验收：

1. 类型不绑定 Prisma。
2. 类型不绑定 API。
3. 类型不包含 execution authority。
4. 类型显式包含 `reviewPosture`、`boundaryNote`、`evidenceRefs`。

验证：

```bash
npm run typecheck
npm run test
npm run check:boundaries
```

### Task 2：落地 20 个 fixture

目标：

1. 将 [HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md](../product/HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md) 的 20 个样本转为机器可读 fixture。
2. 每个 fixture 都包含 sourceType、signalType、objectRef、evidenceRefs、expectedReviewPosture、expectedBoundaryNote、expectedMustPushTitle、expectedPrimaryAction、expectedRejectedBehaviors。

验收：

1. 20/20 fixture 完整。
2. 不包含真实敏感客户数据。
3. 高风险 fixture 均包含拒绝行为。
4. boundary wording 覆盖 recommendation / commitment、draft / send、explanation / approval、proof / official write。

验证：

```bash
npm run test
npm run check:boundaries
```

### Task 3：建立 offline eval

目标：

1. 校验 fixture 是否满足 contract。
2. 校验 high-risk fixture 是否都有 `review_required` / `human_owner_required` / `blocked`。
3. 校验 rejected behaviors 不被误判为 allowed action。
4. 校验 LLM 不参与最终排序。

验收：

1. eval 可重复运行。
2. eval 不访问外部服务。
3. eval 不读写生产数据。
4. eval 失败信息能定位 fixture 和字段。

验证：

```bash
npm run test
npm run self-check
npm run check:boundaries
```

### Task 4：read-model feasibility matrix

目标：

1. 盘点现有 dashboard、operating、mobile、Ask Helm、memory read model。
2. 对 20 个 fixture 标注：
   - `current_read_model_supported`
   - `requires_thin_projection`
   - `future_only`
3. 明确每类信号是否需要新 extractor。

验收：

1. 至少 3 类来源完成 feasibility 判断。
2. 不新增运行时读取路径。
3. 不改变页面行为。
4. 明确哪些 fixture 不能在当前阶段实现。

验证：

```bash
npm run self-check
npm run check:boundaries
```

### Task 5：Phase 1A completion report

目标：

1. 汇总 contract、fixture、offline eval 和 feasibility 结果。
2. 给出 Phase 2 是否可进入的 Go / Revise / No-Go 建议。

验收：

1. 报告使用四类短表：
   - 已经完整成立
   - 已成形但仍需下一层
   - 刻意未做
   - 风险项
2. 不把 planning contract 写成 current-main implementation。
3. 明确下一步最小代码改动范围。

验证：

```bash
git diff --check
npm run self-check
npm run check:boundaries
```

---

## 5. 推荐实现顺序

```text
1. Planning contract
2. Machine-readable fixtures
3. Offline eval
4. Read-model feasibility matrix
5. Phase 1A completion report
6. Decide Phase 2 entry
```

不要先做 UI，不要先做 extractor，不要先做 schema。

---

## 6. Phase 2 预备条件

进入 Phase 2 前必须具备：

1. 20 个 fixture 通过 offline eval。
2. 高风险 review coverage = 100%。
3. Boundary incident count = 0。
4. Must Push deterministic ranking contract 已测试。
5. 至少 3 类 read model 可投影或明确 future-only。
6. Phase 1A completion report 明确建议 Go。

---

## 7. 回滚与停止条件

以下任一条件出现，停止进入下一阶段：

1. Signal false positive 在 fixture review 中明显不可控。
2. Must Push 无法稳定压缩到 3-5 个。
3. 高风险项缺少 boundary note。
4. LLM 排序或自由判断进入最终 authority。
5. Ask Helm 出现跨 tenant / workspace 边界风险。
6. 工程实现必须新增 schema / extractor 才能完成 Phase 1A。

---

## 8. 工程交付格式

每个 PR 或任务必须说明：

1. 本次属于 Phase 1A、Phase 1B 还是 Phase 2 预备。
2. 是否新增 schema：默认应为否。
3. 是否新增 runtime extractor：默认应为否。
4. 是否新增 official write：必须为否。
5. 是否改变页面行为：Phase 1A / 1B 默认应为否。
6. 验证命令和结果。
7. 剩余风险。

---

## 9. 最小验证清单

文档 / fixture-only 任务：

```bash
git diff --check
npm run self-check
npm run check:boundaries
```

类型 / helper / eval 任务：

```bash
npm run typecheck
npm run lint
npm run test
npm run self-check
npm run check:boundaries
```

如果后续进入页面展示，另加：

```bash
npm run build
npm run e2e
```

---

## 10. 给 Codex / Claude Code 的执行口径

```text
You are implementing Helm Business Advancement Phase 1A only.

Read first:
- AGENTS.md
- README.md
- docs/README.md
- docs/product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md
- docs/product/HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md
- docs/reviews/HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md

Allowed:
- planning contracts
- machine-readable fixtures
- offline eval
- read-model feasibility report
- tests / guards that prove no authority expansion

Forbidden:
- Prisma schema
- API routes
- runtime extractor
- event queue
- official write
- auto execution
- page behavior changes
- cross-tenant aggregation
- LLM final ranking

Deliver:
- minimal patch
- validation output
- Phase 1A report or progress note
```
