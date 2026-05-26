---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_BUSINESS_ADVANCEMENT_REQUIREMENTS_FINAL_FREEZE_REPORT_V1

更新时间：2026-04-26
状态：Final freeze report
关联需求：[HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)

## 1. 冻结结论

专家评审结束后，Helm 经营推进方向批准进入最终需求冻结。

最终结论：

```text
Direction: Go
Requirements freeze: Go
Phase 1A contract / fixtures / offline eval: Go
Phase 1B read-model adapter feasibility: Conditional-Go
Phase 2 Signal -> Must Push Adapter: Conditional, after Phase 1A / 1B pass
Runtime extractor: No-Go
Schema design: No-Go
Official write: No-Go
Auto execution: No-Go
Formal skill auto-promotion: No-Go
```

本轮冻结不批准任何代码实现自动越界。后续开工必须先按 [HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md) 拆分任务。

---

## 2. 冻结后的产品主线

最终主线固定为：

```text
经营输入
  -> AdvancementSignal
  -> AdvancementJudgement
  -> MustPushItem
  -> ReviewRequiredAction
  -> MemoryCandidate / SkillSuggestion
```

产品定位固定为：

```text
Helm 是面向经营团队的推进控制台。
它持续识别必须推进的事项，给出证据、边界和建议承接方式，
把经营输入转化为可复核的行动、记忆和可复用能力。
```

第一条试点闭环固定为：

```text
会议 / CRM / 资源状态 / Ask Helm
  -> Must Push
  -> Review Action
```

---

## 3. 已经完整成立

| 项目 | 冻结结论 |
| --- | --- |
| 战略方向 | 从“问答到自动化”改为“问答到经营推进闭环” |
| 产品定位 | “经营推进控制台”成为对内对外统一表达 |
| 开工边界 | Phase 1A / 1B 可启动，schema / extractor / auto execution 不启动 |
| 第一试点闭环 | 会议 / CRM / 资源状态 / Ask Helm -> Must Push -> Review Action |
| 三份附件 | market positioning brief、fixture pack、demo script 已形成 |
| 成功指标 | false positive、accepted rate、Time-to-Trust、review coverage、boundary incident 成为第一阶段核心指标 |

---

## 4. 已成形但仍需下一层

| 项目 | 当前状态 | 下一层 |
| --- | --- | --- |
| `AdvancementSignal` | conceptual contract | Phase 1A fixture / offline eval |
| `AdvancementJudgement` | conceptual contract | Phase 1A boundary / evidence review |
| `MustPushItem` | planning contract | Phase 2 adapter |
| `ReviewRequiredAction` | planning contract | 复用现有 review / approval surface 可行性评估 |
| `MemoryCandidate` | planning contract | Phase 3 Ask Helm interaction asset capture |
| `SkillSuggestion` | planning contract | Phase 4 evidence pipeline |

---

## 5. 刻意未做

本轮冻结刻意不做：

1. 不写 Prisma schema。
2. 不写 API route。
3. 不写 runtime extractor。
4. 不写 event queue。
5. 不写 official write route。
6. 不写 auto execution。
7. 不写 formal skill auto-promotion。
8. 不重做 dashboard / mobile / operating UI。
9. 不把 Ask Helm 改成聊天产品。
10. 不新增跨租户搜索或聚合。

原因：

1. 当前最重要的是验证信号质量和边界表达，不是先扩平台能力。
2. 未验证的 schema 会把 planning contract 误写成产品事实。
3. 未验证的 extractor 会放大噪音和权限风险。
4. 过早 auto execution 会破坏 Helm 的 review-first 和 responsibility 边界。

---

## 6. 风险项

| 风险 | 等级 | 控制方式 |
| --- | --- | --- |
| 信号噪音过高 | P0 | Phase 1A fixture / offline eval 先验证 false positive |
| Must Push 退化成普通待办 | P0 | 每个 Must Push 必须带 evidence、reason、boundary、primary action |
| LLM 排序不可复现 | P0 | 排序 deterministic，LLM 不能最终排序 |
| recommendation 被误读成 commitment | P0 | boundary note 必填，高风险项 review coverage 100% |
| 资源接入信号被误写成旧系统执行成功 | P0 | proof != external write success |
| Ask Helm 变成聊天产品 | P1 | 不持久化多轮聊天历史，回答必须回到对象 / Must Push / Review Action |
| 团队过早追求自动化 | P1 | Phase 5 之前 `narrow_auto` 不可用 |

---

## 7. 开工许可

### 7.1 允许开工

1. Phase 1A：contract / fixture / offline eval。
2. Phase 1B：read-model adapter feasibility。
3. 文档索引与 guard wording。
4. 非运行时 fixture / test data。
5. 不改变生产行为的 offline evaluator。

### 7.2 需要再次评审后才允许

1. Phase 2 Signal -> Must Push Adapter。
2. 任何页面真实展示。
3. 任何新 API。
4. 任何数据持久化。
5. 任何与现有 approval / review surface 的写入集成。

### 7.3 禁止开工

1. official write。
2. auto send。
3. auto approve。
4. auto settlement。
5. auto skill promotion。
6. runtime extractor。
7. cross-tenant aggregation。

---

## 8. 下一阶段最该做的 5 件事

1. 把 20 个 fixture 落成可机器读取的 offline eval input。
2. 冻结 `AdvancementSignal` 与 `AdvancementJudgement` 的 TypeScript planning contract。
3. 做 read-model feasibility matrix，标注哪些 fixture 可由现有 dashboard / operating / mobile / Ask Helm / memory 投影。
4. 写 deterministic ranking contract 和边界降级测试。
5. 产出 Phase 1A completion report，再决定是否进入 Phase 1B / Phase 2。

---

## 9. 验证要求

文档冻结验证：

```bash
git diff --check
npm run self-check
npm run check:boundaries
```

进入代码开工后，至少补充：

```bash
npm run typecheck
npm run lint
npm run test
```

若任何验证无法运行，必须在对应 implementation report 中明确说明原因和替代验证。

---

## 10. 冻结声明

本报告冻结的是需求和开工边界，不冻结具体实现方案。

下一阶段工程任务必须从最终需求文档反推，并继续遵守：

1. `workspace-first`
2. `membership-backed`
3. `judgement-first`
4. `review-first`
5. `recommendation != commitment`
6. `draft != send`
7. `explanation != approval`
8. `proof != external write success`
