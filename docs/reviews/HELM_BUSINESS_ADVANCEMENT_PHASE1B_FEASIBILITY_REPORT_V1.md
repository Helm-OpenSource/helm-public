---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business Advancement Phase 1B 可行性报告 V1

更新时间：2026-04-26
状态：Phase 1B complete / Phase 2 conditional review-ready
本阶段：Phase 1B — Read-model Adapter Feasibility
关联需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)
关联计划：[HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md)
上游报告：[HELM_BUSINESS_ADVANCEMENT_PHASE1A_IMPLEMENTATION_REPORT_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE1A_IMPLEMENTATION_REPORT_V1.md)

---

## 一、已经完整成立

| 交付项 | 位置 | 说明 |
| --- | --- | --- |
| Read-model feasibility matrix | `features/business-advancement/read-model-feasibility.ts` | 20 个 Phase 1A fixture 全部完成分类：6 个 `current_read_model_supported`、9 个 `requires_thin_projection`、5 个 `future_only` |
| Phase 1B evaluator | `features/business-advancement/read-model-feasibility.ts` | 纯函数评估 5 项条件：fixture 覆盖、未知 fixture、来源覆盖、future-only rationale、禁止越权实现授权 |
| Phase 1B 测试 | `features/business-advancement/read-model-feasibility.test.ts` | 65 个 Vitest 测试通过，覆盖结构、具体分类、边界保护、统计和 Phase 1B 通过条件 |
| Phase 1B CLI | `scripts/business-advancement-read-model-feasibility.ts` | 可输出全部 fixture 分类和统计，并以 exit code 表达通过 / 失败 |
| 文档索引 | `docs/README.md` | Business Advancement 文档链已加入 Phase 1B 完成报告入口 |

**Feasibility 分类结果：**

| 分类 | 数量 | 说明 |
| --- | ---: | --- |
| `current_read_model_supported` | 6 | 当前 read model 已可直接投影 |
| `requires_thin_projection` | 9 | 需要只读 projection helper；不新增持久化、不新增 runtime extractor |
| `future_only` | 5 | 当前阶段不能进入实现；需后续另行评审 |

**Source coverage：**

| 来源 | current | thin | future |
| --- | ---: | ---: | ---: |
| ask_helm | 1 | 0 | 2 |
| combined | 0 | 2 | 0 |
| crm | 0 | 3 | 0 |
| email | 1 | 1 | 0 |
| meeting | 2 | 1 | 0 |
| report | 0 | 0 | 2 |
| tenant_resource | 2 | 1 | 0 |
| user_behavior | 0 | 1 | 1 |

可行来源类型数为 7，满足 Final Requirements V1 的“至少 3 类信号源完成 read-model feasibility 标注”要求。

---

## 二、已成形但仍需下一层

| 对象 | 当前状态 | 下一层要求 |
| --- | --- | --- |
| Read-model adapter shape | 已完成 feasibility matrix 与 thin projection 判断 | Phase 2 才能设计 Signal -> Must Push adapter；本阶段不接入页面、不改变 runtime |
| Thin projection | 已明确哪些 fixture 需要只读 projection helper | 进入 Phase 2 前需逐项评审 query 来源、membership / capability 边界和排序规则 |
| Future-only 信号 | 已明确 report、Ask Helm session persistence、user behavior event log 等当前不可实现 | 后续不得绕过评审直接补 schema、runtime extractor 或 session persistence |
| Combined signal | AS-FX-019 / AS-FX-020 已作为只读多源聚合候选 | Phase 2 需证明不会跨 workspace / tenant 聚合，也不会扩大对象可见范围 |
| Must Push 压缩 | Feasibility 支持后续从 20 个 fixture 压缩到 3-5 个候选项 | Phase 2 需新增 deterministic ranking contract 测试，LLM 仍不得参与最终排序 |

---

## 三、刻意未做

与 Final Requirements V1 §八保持一致：

| 未做项 | 原因 |
| --- | --- |
| Prisma schema | Phase 1B 是 feasibility，不是 runtime adoption |
| API route | 本阶段不暴露新接口 |
| Runtime extractor | 明确禁止；所有 fixture 仅做现有 read model 可投影性判断 |
| Event ingestion / event queue | 明确禁止 |
| Official write / auto-write | 明确禁止 |
| Execution authority / auto execution | 明确禁止 |
| 页面行为改变 | 明确禁止；没有接入 dashboard / mobile / operating 页面 |
| LLM final ranking | 明确禁止；可解释文本不等于排序权 |
| Ask Helm conversation history persistence | AS-FX-014 / AS-FX-016 明确标为 `future_only`，不绕过“不做持久化聊天历史”的边界 |
| Phase 2 adapter 实现 | Phase 2 仍需条件评审，不因 Phase 1B 完成而自动批准 |

---

## 四、风险项

| 风险 | 严重程度 | 说明与缓解 |
| --- | --- | --- |
| Thin projection 可能被误当 runtime extractor | 中 | Phase 1B 只允许只读 helper；Phase 2 必须逐项证明不新增持久化、不引入事件监听、不改变事实来源 |
| Combined signal 的权限边界更复杂 | 中 | AS-FX-019 / AS-FX-020 只能在当前 workspace / membership / capability 范围内聚合；不得跨租户聚合 |
| Future-only 信号被业务压力提前实现 | 中 | Report KPI、Ask Helm repeated intent、user behavior repeated intent 都需要新数据来源；当前必须保持 future-only |
| Feasibility 不等于产品价值验证 | 中 | 20 个 fixture 是合成样本；真实 false positive、accepted rate、Time-to-Trust 仍需 Phase 2 pilot 验证 |
| Phase 2 被误解为自动执行 | 中 | Phase 2 只允许 Signal -> Must Push adapter；仍不得 official write、auto-send、auto-approve、auto execution |

---

## 五、验证结果

### 5.1 Vitest

```bash
npx vitest run features/business-advancement/read-model-feasibility.test.ts

 Test Files  1 passed (1)
      Tests  65 passed (65)
```

### 5.2 Phase 1B feasibility CLI

```bash
npx tsx scripts/business-advancement-read-model-feasibility.ts

Feasibility Statistics:
  Total fixtures:                  20
  current_read_model_supported:    6
  requires_thin_projection:        9
  future_only:                     5

Feasible source class count:     7
Future-only count:               5

5/5 checks passed, 0 failed
Phase 1B read-model feasibility PASSED
```

### 5.3 ESLint

```bash
npx eslint features/business-advancement scripts/business-advancement-read-model-feasibility.ts

(0 errors, 0 warnings)
```

### 5.4 Git whitespace check

```bash
git diff --check -- features/business-advancement scripts/business-advancement-read-model-feasibility.ts \
  docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE1B_FEASIBILITY_REPORT_V1.md docs/README.md

(0 whitespace errors)
```

---

## 六、Phase 2 条件判断

**建议：Conditional-Go to Phase 2 planning review，不是直接进入实现。**

Phase 1B 已满足：

1. 20 个 fixture 全部完成 read-model feasibility 标注。
2. 至少 3 类信号源可由现有 read model 投影或明确标为 future-only；实际为 7 类可行来源。
3. Adapter 输出不扩大权限、不写成 commitment、不授权 official write。
4. `future_only` 项均有禁止原因说明。
5. 本阶段未新增 schema、runtime extractor、event ingestion、execution authority 或页面行为。

进入 Phase 2 前仍需单独评审：

1. Signal -> Must Push adapter 的输出 contract。
2. Deterministic ranking 的正式测试。
3. membership / capability 边界如何在 combined signal 中保持最小权限。
4. 页面展示是否继续保持 recommendation != commitment、draft != send、explanation != approval、proof != external write success。
