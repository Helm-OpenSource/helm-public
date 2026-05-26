---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Final Requirements V1

更新时间：2026-04-26
状态：Final requirements freeze / implementation-start ready
适用范围：Phase 1A / Phase 1B / Phase 2 planning boundary
实现状态：未实现

本文件是 Helm 经营推进方向在专家评审后的最终需求收口版本。它把 V2.1 架构稿、市场定位 brief、Advancement Signal fixture pack 和 Must Push demo script 合并成下一阶段开工依据。

本文件批准进入受限开工：Phase 1A contract / fixture / offline eval 与 Phase 1B read-model adapter feasibility。

本文件不批准数据库 schema、runtime extractor、event queue、official write、自动执行、自动发送、自动审批、自动结算或 formal skill auto-promotion。

---

## 一、最终结论

Helm 下一阶段不做“从问答到自动化”，而做“从经营输入到经营推进闭环”。

最终产品定位固定为：

```text
Helm 是面向经营团队的推进控制台。
它持续识别必须推进的事项，给出证据、边界和建议承接方式，
把经营输入转化为可复核的行动、记忆和可复用能力。
```

第一条开工闭环固定为：

```text
会议 / CRM / 资源状态 / Ask Helm
  -> AdvancementSignal
  -> AdvancementJudgement
  -> 3-5 个 MustPushItem
  -> 高风险项生成 ReviewRequiredAction
  -> 用户确认后生成 MemoryCandidate 或 SkillSuggestion
```

第一阶段交付物不是自动执行 Skill，而是高质量 Must Push 面板与其背后的信号、证据、边界和复核契约。

---

## 二、最终需求边界

### 2.1 必须做

1. 把经营输入统一压缩为 `AdvancementSignal`。
2. 为每个信号生成可复核的 `AdvancementJudgement`。
3. 把多源信号压缩成 3-5 个 `MustPushItem`。
4. 每个 Must Push 必须包含 evidence、reason、primary action、boundary note。
5. 高风险项必须进入 `review_required` 或 `human_owner_required`。
6. Ask Helm 必须回到对象、页面、Review Action 或 Must Push，不停留为聊天。
7. 排序必须 deterministic，LLM 只能生成解释文案和压缩原因，不能做最终排序。
8. 结果必须 workspace-first、membership-backed、capability-aware。
9. 所有 customer-facing、approval、official write、settlement、resource execution 动作必须保持 review-first。
10. 每次确认后的经验沉淀只能先进入 `MemoryCandidate` 或 `SkillSuggestion`。

### 2.2 明确不做

1. 不做完整 workflow engine。
2. 不做完整 agent orchestration 平台。
3. 不做完整自动执行平面。
4. 不做通用聊天产品。
5. 不做 CRM / ERP / 项目管理 / BI 替代品。
6. 不新增数据库 schema。
7. 不新增 runtime extractor。
8. 不新增 event queue。
9. 不新增 official write route。
10. 不做自动发送、自动审批、自动付款、自动结算。
11. 不把 `SkillSuggestion` 提升成 formal skill。
12. 不把 `candidate capability` 写成 execution authority。
13. 不跨 workspace 或 tenant 聚合。
14. 不展示 Helm reserved tenant 信息给普通租户。
15. 不持久化 Ask Helm 多轮聊天历史。

---

## 三、核心对象最终口径

以下对象是 Phase 1A / 1B 的 conceptual planning contract。除非另有评审批准，不得直接落为 Prisma schema、API contract 或 queue implementation。

| 对象 | 最终定义 | 当前阶段 |
| --- | --- | --- |
| `AdvancementSignal` | 表示经营上可能需要推进的信号 | Phase 1A contract / fixtures |
| `AdvancementJudgement` | 对信号的判断、证据、置信度、边界和复核姿态 | Phase 1A contract / offline eval |
| `MustPushItem` | 用户今天最应该看到并推进的 3-5 个事项 | Phase 2 planning contract |
| `ReviewRequiredAction` | 需要人复核、分派、确认或批准的动作准备项 | Phase 2 planning contract |
| `MemoryCandidate` | 用户确认后可进入经营记忆评审的候选内容 | Phase 3 planning contract |
| `SkillSuggestion` | 反复出现的判断 / 动作模式形成的候选能力 | Phase 4 planning contract |

禁止误读：

1. `AdvancementSignal` 不是任务。
2. `AdvancementJudgement` 不是事实裁决。
3. `MustPushItem` 不是外部承诺。
4. `ReviewRequiredAction` 不是已审批。
5. `MemoryCandidate` 不是 official memory。
6. `SkillSuggestion` 不是 formal skill。

---

## 四、第一批信号来源

Phase 1A fixture 与 Phase 1B feasibility 只覆盖以下来源：

| 来源 | 允许进入 | 不允许进入 |
| --- | --- | --- |
| Meeting | 会后承诺、客户等待、阻塞决策、未分派动作 | 自动发送会议纪要或客户回复 |
| CRM | 机会停滞、客户等待、续费风险、阶段异常 | 自动修改 stage、forecast 或成交概率 |
| Tenant resource | 资源停滞、证明缺口、旧系统动作前提缺失 | 自动调用旧系统执行或写回 official success |
| Report | KPI 异常、经营缺口、需要复核的趋势 | 自动归因、自动处罚、自动生成最终决策 |
| Email | 客户等待、续费顾虑、未回复升级 | 自动发送邮件 |
| Ask Helm | 重复意图、边界触碰、高置信但被放弃答案 | 聊天历史持久化或跨租户问答 |
| User behavior | 反复查看无动作、手动标记重要、放弃高置信建议 | 自动改优先级或自动写 official fact |

第一批 `signalType` 固定为：

```text
overdue_commitment
blocked_decision
stalled_opportunity
stalled_case
resource_evidence_gap
repeated_intent
customer_waiting
kpi_anomaly
boundary_hit
abandoned_high_confidence_answer
```

---

## 五、Must Push 最终产品规则

### 5.1 卡片必备字段

每个 `MustPushItem` 必须包含：

1. `title`：具体、可行动、不过度承诺。
2. `reason`：为什么现在必须推进，最多 2 句话。
3. `evidenceRefs`：至少 1 条证据，高风险项至少 2 条或显式说明证据不足。
4. `primaryAction`：只允许查看、准备、复核、分派、确认，不允许直接高风险执行。
5. `boundaryNote`：说明 recommendation / commitment、draft / send、explanation / approval、proof / official write 的边界。
6. `reviewPosture`：`read_only`、`review_required`、`human_owner_required` 或 `blocked`。
7. `sourceSummary`：说明来自 meeting、CRM、tenant resource、report、email、Ask Helm、user behavior 或 combined。

### 5.2 排序规则

排序必须 deterministic，优先级顺序为：

1. `riskLevel`
2. `dueAt / overdueDays / staleDays`
3. `customerWaiting`
4. `blockedDecision`
5. `revenueOrRetentionImpact`
6. `evidenceConfidence`
7. `reviewRequired`
8. `updatedAt`

LLM 可以生成解释文案、压缩原因和整理证据摘要，但不能决定最终排序。

### 5.3 展示规则

1. 默认展示 1 个最高优先级。
2. 同屏最多展示 4 个 Must Push。
3. 第 5 个及之后进入折叠摘要，不强推到用户脸上。
4. 如果第 5 个及之后包含 `riskLevel=high`，显示 “还有高风险项待复核” 的安全摘要，但不打断当前最高优先级。
5. 所有高风险项必须显示 `boundaryNote`。

---

## 六、Ask Helm 最终角色

Ask Helm 是自然语言进入经营推进层的入口，不是聊天产品。

Ask Helm 允许：

1. 解释当前 workspace 内的 Must Push。
2. 查找用户可见对象。
3. 说明为什么某个事项需要推进。
4. 准备草稿、复核材料或 handoff。
5. 把重复意图沉淀为候选信号。

Ask Helm 禁止：

1. 跨 workspace 或 tenant 检索。
2. 访问用户 membership / capability 不允许的对象。
3. 对外发送。
4. 审批、付款、结算或 official write。
5. 生成外部承诺。
6. 持久化多轮聊天历史。
7. 把回答本身写成 official memory。

---

## 七、Phase 1A 开工范围

Phase 1A 可以开工，但只允许以下内容：

1. 冻结 `AdvancementSignal` conceptual contract。
2. 将 20 个 fixture 转为可评审样本。
3. 建立 offline eval 口径。
4. 校验 `signalType`、`reviewPosture`、`boundaryNote`、`evidence expectation`、`Must Push mapping`。
5. 产出 Phase 1A report。

Phase 1A 不允许：

1. 写 Prisma schema。
2. 写 API route。
3. 写 runtime extractor。
4. 写 event queue。
5. 写 official write。
6. 写自动执行。
7. 改现有生产页面行为。

Phase 1A 通过条件：

1. 20 个 fixture 完成人工评审。
2. 高风险项 review coverage = 100%。
3. Boundary incident count = 0。
4. 至少 3 类信号源完成 read-model feasibility 标注。
5. Must Push 可压缩为 3-5 个优先项。
6. LLM 不参与最终排序的边界被测试覆盖。

---

## 八、Phase 1B 开工范围

Phase 1B 是 read-model adapter feasibility，不是 runtime adoption。

Phase 1B 可以做：

1. 盘点现有 dashboard / operating / mobile / Ask Helm / memory read model。
2. 判断哪些 fixture 能由现有 read model 投影。
3. 设计只读 adapter shape。
4. 写 feasibility report。
5. 如需要代码，只能写 read-only projection / helper / test fixture，不新增持久化。

Phase 1B 不允许：

1. 不新增 schema。
2. 不新增 runtime extractor。
3. 不新增 event ingestion。
4. 不新增 auto-write。
5. 不新增 execution authority。
6. 不改变现有对象事实来源。

Phase 1B 通过条件：

1. 至少 3 类信号源可从现有 read model 投影或明确标注为 future-only。
2. adapter 输出不包含不可复核的判断。
3. adapter 输出不扩大权限。
4. adapter 输出不把 suggestion 写成 commitment。
5. 所有实现都能被现有 boundary check 或新增 guard 覆盖。

---

## 九、Phase 2 进入条件

Phase 2 只在 Phase 1A / 1B 通过后进入。

Phase 2 目标是 `Signal -> Must Push Adapter`，不是完整 UI 重做。

进入 Phase 2 前必须满足：

1. Final requirements 已冻结。
2. Fixture pack 已通过评审。
3. Read-model feasibility 已完成。
4. Deterministic ranking contract 已评审。
5. Review posture 与 boundary note contract 已评审。
6. Mobile / dashboard / operating 的展示口径已统一。

Phase 2 不得引入自动执行、official write 或 formal skill promotion。

---

## 十、验收指标

### 10.1 产品质量指标

| 指标 | 目标 | 测量方式 |
| --- | --- | --- |
| Signal false positive rate | < 20% | 被 reviewer / user 判定无效的信号 / 总信号 |
| Must Push accepted rate | > 60% | 被用户进入 primary action 或确认有价值的推进项 / 总推进项 |
| Must Push Time-to-Trust | ↓ 30% | 用户从看到推进项到确认、分派或进入 primary action 的平均时间 |
| Review coverage | 100% high-risk | 高风险信号中带 reviewPosture + boundaryNote 的比例 |
| Boundary incident count | 0 | 推进项被误写成承诺、审批、外发或 official write 的次数 |
| Duplicate / noisy signal rate | < 15% | 被去重或判定为噪音的信号 / 总信号 |

### 10.2 开工质量指标

| 指标 | 目标 | 测量方式 |
| --- | --- | --- |
| Fixture review completeness | 20/20 | 20 个样本都有 signalType、reviewPosture、boundaryNote、expected action |
| Source coverage | >= 4 类 | 至少覆盖 meeting、CRM、tenant resource、Ask Helm |
| High-risk downgrade correctness | 100% | 高风险样本全部 downgrade 到 review_required / blocked |
| LLM ranking authority | 0 | 无 fixture 允许 LLM 作为最终排序来源 |

---

## 十一、最终 Done 定义

### 已经完整成立

1. 经营推进方向从“自动化优先”收口为“推进优先”。
2. 第一条试点闭环已经明确。
3. 产品定位、市场话术、fixture pack、demo script 已形成文档链。
4. Phase 1A / 1B 的开工边界已明确。

### 已成形但仍需下一层

1. `AdvancementSignal` 仍是 conceptual contract，需要 Phase 1A 验证。
2. `MustPushItem` 仍是 planning contract，需要 Phase 2 才能进入真实展示。
3. `ReviewRequiredAction` 仍是 planning contract，需要复用现有 approval / review surface 评估。
4. `MemoryCandidate` 和 `SkillSuggestion` 仍未进入运行时闭环。

### 刻意未做

1. 未做 schema。
2. 未做 runtime extractor。
3. 未做 event queue。
4. 未做 official write。
5. 未做 auto execution。
6. 未做 formal skill promotion。

### 风险项

1. 信号噪音可能过高。
2. Must Push 可能被误用成普通待办。
3. 多源 evidence 可能引入权限边界风险。
4. 用户可能把 recommendation 误读成 commitment。
5. 团队可能被自动化叙事带偏，过早进入 execution plane。

---

## 十二、关联文档

1. [HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.1.md](./HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.1.md)
2. [HELM_V2_1_MARKET_POSITIONING_BRIEF.md](./HELM_V2_1_MARKET_POSITIONING_BRIEF.md)
3. [HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md](./HELM_ADVANCEMENT_SIGNAL_FIXTURE_PACK_V1.md)
4. [HELM_MUST_PUSH_PRODUCT_DEMO_SCRIPT_V1.md](./HELM_MUST_PUSH_PRODUCT_DEMO_SCRIPT_V1.md)
5. [HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md)
6. [HELM_BUSINESS_ADVANCEMENT_REQUIREMENTS_FINAL_FREEZE_REPORT_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_REQUIREMENTS_FINAL_FREEZE_REPORT_V1.md)
