---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2_STRATEGIC_REVIEW_AND_DECISION_MEMO_V1

更新时间：2026-04-26
状态：Superseded for execution by Final Requirements V1 / retained as review record
关联文档：[HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.md](../product/HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.md)

## 1. 文档目的

本文件用于保留对 `Helm 经营推进架构 V2` 的分析路径、判断依据、吸收建议、降级建议和下一阶段决策问题，方便继续征求产品、工程、治理、销售和交付侧专家意见。

专家评审结束后，开工 canonical spec 已迁移到 [HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](../product/HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)，开工计划已迁移到 [HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md](./HELM_BUSINESS_ADVANCEMENT_IMPLEMENTATION_START_PLAN_V1.md)。

本文件不是 implementation plan，不批准代码实现、schema 设计、自动执行扩权或 Skill 自动路由。

本文件要回答五个问题：

1. 这份 V2 思考是否抓住 Helm 下一阶段的战略主线。
2. 哪些内容应该进入 Helm 产品核心。
3. 哪些表达会让 Helm 偏离 current-main 边界。
4. 下一阶段最应该优先做什么。
5. 专家评审需要重点看哪些风险和决策点。

## 2. 一句话结论

`HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2` 抓住了 Helm 下一阶段最重要的主线：把 Ask Helm、资源接入、用户行为、Must Push、Skill、经营记忆和反馈闭环收成同一条经营推进链。

但它当前不能直接作为实现计划。最需要修正的是：不要把主线写成“从问答到自动化”，而应写成“从问答到经营推进闭环”。

更准确的战略表达是：

**Helm 的下一阶段不是追求自动化本身，而是把经营信号持续转化为可解释、可复核、可推进、可沉淀的经营动作。自动化只是其中被证据、权限和治理逐步批准的一种承接方式。**

## 3. 当前 repo truth 对齐

### 3.1 已经成立的基础

Helm 当前已经具备支撑 V2 方向的基础：

| 基础能力 | 当前 truth | 对 V2 的意义 |
|---|---|---|
| 经营控制层定位 | Helm 是公司的经营控制层系统，负责目标、任务、证据、复盘和经营记忆 | V2 可以继续围绕经营推进展开 |
| Ask Helm | `/search?mode=ask` 是 workspace 内行动意图入口，不是聊天产品 | Ask Helm 可以沉淀经营意图，但不能变成泛聊天 |
| Mobile Command Surface | `/mobile` 是窄手机端经营推进入口，第一屏聚合 Ask Helm 和 Must Push | 资源信号和 Ask Helm 资产应优先进入 Must Push |
| Skill Suggestion | `PatternFact -> SkillSuggestion -> candidate capability` 已成立 | V2 的 Skill 孵化可以接现有能力，但不能越权成 formal skill |
| 资源治理 | existing system / tenant custom extension 已进入 read-first / review-first 资源治理主线 | 资源信号可以成为推进输入，但不能直接变成 official write |
| 控制边界 | recommendation != commitment，proactive != 自动决策 | 所有自动化表达必须降级为受控推进 |

### 3.2 当前必须保留的硬边界

以下边界不能因为 V2 愿景被稀释：

1. Helm 当前不是完整 workflow engine。
2. Helm 当前不是完整 agent orchestration 平台。
3. Helm 当前不是完整自动执行平面。
4. plugin runtime 仍没有真正 sandbox。
5. future-real auth 仍不是完整生产级认证。
6. Ask Helm 不是 chat product。
7. SkillSuggestion 不是 formal skill。
8. candidate capability 不是 execution authority。
9. resource signal 不是 official write success。
10. recommendation 不是 commitment。

## 4. 可共享的分析路径

本节保留本次判断的公开分析过程，供后续评审复核。

### 4.1 第一步：先判断 V2 是否符合 Helm 的根定位

V2 的核心目标是经营推进，不是单点工具优化。这和 Helm 产品原则一致。

Helm 当前的产品原则强调：

1. 把真实经营活动迁入 Helm。
2. 让信息从产生、理解到执行的损耗持续下降。
3. 让任务、证据、结果和复盘形成闭环。
4. 把经验抽象成规则、策略、模板和提示。

因此，V2 中“Ask Helm 互动资产化”“资源接入变成经营信号”“Skill 从记忆中孵化”这三条方向是成立的。

判断结果：方向 Go。

### 4.2 第二步：识别 V2 的最大价值不在自动化，而在推进链

V2 文档当前标题是“从问答到自动化”。这个标题容易把团队导向 SkillExecutor、事件触发、自动执行状态机，而不是先解决“系统如何知道什么该推进”。

真正的高价值链条应该是：

```text
经营输入
  -> 经营信号
  -> 判断与证据
  -> Must Push
  -> 人或 Skill 承接
  -> 结果与审计
  -> 经营记忆
  -> Skill 候选
```

这个链条里，自动化只是“承接方式”，不是主目标。

判断结果：标题和主线需要重写。

### 4.3 第三步：评估 Ask Helm 互动资产化是否应该优先

Ask Helm 现在已经从对象搜索升级为行动意图入口。用户问的问题本身包含三类高价值资产：

1. 用户真正关心的对象、风险、阻塞和下一步。
2. 系统解释过的判断依据和边界原因。
3. 当前产品未满足的需求和反复出现的使用模式。

因此，Ask Helm 互动不应该只作为一次性问答结束。它应该形成 `Interaction Asset` 或 `Advancement Signal`，进入后续统计、复盘、SkillSuggestion 和产品改进。

但第一版不应直接写 canonical memory，不应直接生成 formal skill，不应做 conversation history persistence。

判断结果：应该优先做，但只做只读资产捕获和候选信号。

### 4.4 第四步：评估资源信号是否应优先于 Skill 自动执行

资源接入当前已经进入 read-first / review-first 治理主线。租户已有系统、报表、CRM、会议、邮件、业务系统的真正价值，不是“能不能被查询”，而是“能不能产生经营推进信号”。

例如：

1. 某客户长时间无跟进。
2. 某项目卡在待确认状态。
3. 某岗位负载异常。
4. 某报表指标偏离基线。
5. 某资源证据缺失，导致第一条控制线无法推进。

这些信号天然应该进入 Must Push，而不是先进入自动执行。

判断结果：`Resource Signal -> Must Push` 应作为近期 P0/P1，高于 `Skill 自动执行`。

### 4.5 第五步：评估 Skill 自动执行的风险

V2 当前把 `SKILL 自动执行`列为 Phase 1 P0，这个顺序风险较高。

原因：

1. 当前 SkillSuggestion baseline 明确不做 auto routing、auto-send、auto commitment。
2. candidate capability 仍只是候选能力，不是正式 Skill。
3. tenant resource governance 当前仍保持 read-first / review-first，不创建 official write route。
4. plugin runtime 仍无真正 sandbox。
5. 自动执行一旦失败，会直接伤害信任，而不仅是产品体验问题。

因此，Skill 自动执行可以作为长期方向，但近期应拆成更窄的阶段：

1. Skill recommended。
2. Skill prepared。
3. Skill draft-only。
4. Skill review-required internal write。
5. Skill narrow auto under monitored policy。

判断结果：Skill 自动执行应降级，不应作为下一阶段第一优先级。

## 5. 对 V2 文档的吸收、改写、推迟建议

### 5.1 应该直接吸收

| V2 内容 | 建议 | 理由 |
|---|---|---|
| Helm 不是问答工具、搜索引擎、聊天产品、通知中心 | 吸收 | 符合 current-main positioning |
| Ask Helm 互动是经营资产 | 吸收 | 是 Ask Helm 下一层价值来源 |
| 判断资产 / 边界资产 / 需求资产 | 吸收 | 可直接转成 Interaction Asset taxonomy |
| 用户行为反映职责、关心和阻塞 | 吸收但延后产品化 | 对组织智能有价值，但隐私和解释风险高 |
| 资源接入从数据源变经营信号源 | 强吸收 | 是租户资源接入下一阶段核心 |
| 资源信号进入 Must Push | 强吸收 | 能直接增强 Mobile Command Surface 和 dashboard |
| Skill 从经营记忆中孵化 | 吸收 | 已有 SkillSuggestion 主线可承接 |
| recommendation != commitment | 保留 | 是 Helm 长期边界 |
| 渐进式扩大自动化范围 | 吸收但改写 | 需要从“自动化等级”改成“治理授权等级” |

### 5.2 必须改写

| 原表达 | 问题 | 建议改写 |
|---|---|---|
| 从问答到自动化 | 把战略重心推向 execution authority | 从问答到经营推进闭环 |
| 自动化优先 | 容易覆盖 review-first 和 responsibility | 推进优先，自动化受控扩大 |
| 有 Skill 就用 Skill，没有人就没有人类 | 过度自动化，弱化责任归属 | 有低风险 Skill 先准备或执行，边界不清必须升级给人 |
| 下次直接执行，无需人工介入 | 容易误读为 formal auto-execution | 下次优先生成可复用建议、草稿或候选 Skill |
| 案件停滞自动执行 opportunity-push Skill | 可能越权写入业务系统 | 案件停滞自动生成 Must Push，Skill 可准备建议或草稿 |
| Lv5 完全自动化 | 不符合当前边界 | narrow auto under monitored policy |
| Skill 成功率 > 90% | 指标过早，且定义不清 | 先衡量 prepared-to-accepted rate、review override rate、incident rate |

### 5.3 应该推迟

| 内容 | 推迟原因 | 重新进入条件 |
|---|---|---|
| SkillExecutor 自动执行引擎 | 当前缺少 sandbox、policy maturity、执行回滚协议 | 有稳定 low-risk internal-write case，审计和回滚已验证 |
| 自动生成 formal skill | 当前 SkillSuggestion 明确不支持 | manual formal review queue、tests、guards、docs 全部成立 |
| 用户关心图谱对团队公开 | 隐私、组织政治和误读风险高 | 明确 privacy scope、visibility rule、opt-in/off |
| 组织协作图谱 | 可能暴露个人行为数据 | 先做聚合级、脱敏级组织洞察 |
| A/B 测试 Skill 优化 | 数据量和风险控制不足 | Skill 已有稳定执行样本和 rollback |
| 高风险自动化 | 不符合 controlled-trial | 专门 governance review 后另立 proposal |

## 6. 建议的 V2.1 主线结构

建议把 V2.1 重构成以下结构：

```text
1. Helm 的下一阶段定义
   经营推进闭环，而不是自动化平台

2. 经营推进闭环的统一对象
   Advancement Signal
   Advancement Judgement
   Must Push Item
   Review Required Action
   Skill Suggestion Candidate
   Memory Write-back Candidate

3. 三类输入
   Ask Helm interaction
   Tenant resource signal
   User behavior signal

4. 三类承接
   Human review
   Skill prepared / draft-only
   Narrow auto under monitored policy

5. 三类沉淀
   Judgement asset
   Boundary asset
   Pattern / SkillSuggestion asset

6. 分阶段路线
   Phase 0：概念收口和评审
   Phase 1：Advancement Signal Contract
   Phase 2：Signal -> Must Push Adapter
   Phase 3：Ask Helm Interaction Asset Capture
   Phase 4：SkillSuggestion Evidence Pipeline
   Phase 5：Narrow Skill Execution Pilot
```

## 7. 推荐的新阶段路线

### Phase 0：战略收口与专家评审

目标：确认 V2.1 是否应该作为 Helm 下一阶段 north star。

交付物：

1. V2.1 文档。
2. 评审问题清单。
3. Go / Revise / No-Go 结论。
4. 不进入代码实现的边界声明。

验收条件：

1. 产品、工程、治理、销售、交付至少各有一轮反馈。
2. 所有人都接受“自动化不是主线，经营推进闭环是主线”。
3. 所有人都接受 `candidate capability != execution authority`。
4. 没有专家提出无法修复的安全或信任 blocker。

### Phase 1：Advancement Signal Contract

目标：先定义 Helm 如何识别“经营上需要推进的事情”。

输入来源：

1. Ask Helm interaction。
2. 资源状态变化。
3. 用户点击、放弃、重复提问、manual mark。
4. 会议、邮件、CRM、报表、租户业务系统。

输出结构：

```typescript
interface AdvancementSignal {
  id: string;
  workspaceId: string;
  sourceType:
    | 'ask_helm_interaction'
    | 'tenant_resource'
    | 'meeting'
    | 'email'
    | 'crm'
    | 'report'
    | 'user_behavior';
  signalType:
    | 'stalled_object'
    | 'overdue_commitment'
    | 'blocked_decision'
    | 'resource_gap'
    | 'repeated_intent'
    | 'boundary_hit'
    | 'unmet_need'
    | 'review_required';
  objectRef?: {
    objectType: string;
    objectId: string;
  };
  evidenceRefs: Array<{
    type: string;
    ref: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  suggestedNextStep: string;
  reviewPosture: 'read_only' | 'draft_only' | 'review_required' | 'blocked';
  boundaryNote?: string;
}
```

非目标：

1. 不新增 official write。
2. 不新增自动执行。
3. 不把 signal 写成 commitment。
4. 不跨 workspace 聚合。

### Phase 2：Signal -> Must Push Adapter

目标：把经营信号稳定压缩成用户真正需要推进的 3 到 5 个 Must Push 项。

第一批信号：

1. overdue commitment。
2. blocked decision。
3. stalled opportunity / stalled case。
4. resource evidence gap。
5. repeated Ask Helm intent。
6. customer waiting。

验收条件：

1. 每个 Must Push 都有 evidence。
2. 每个 Must Push 都有 primary next step。
3. 高风险项必须显示 boundary note。
4. 排序 deterministic，LLM 不能最终排序。
5. 进入 `/mobile`、dashboard 或 operating 时保持同一口径。

### Phase 3：Ask Helm Interaction Asset Capture

目标：把 Ask Helm 的高价值互动沉淀为只读资产和候选信号。

第一版资产类型：

1. JudgementAsset：系统给过的重要判断和证据链。
2. BoundaryAsset：用户触碰过的边界、拒绝原因和替代路径。
3. IntentAsset：重复出现、未满足或高价值的意图模式。

捕获条件：

1. boundary hit。
2. multi-source grounding。
3. repeated intent。
4. high-confidence abandoned。
5. user manual mark。
6. reviewer mark。

非目标：

1. 不保存完整聊天历史。
2. 不做 follow-up question loop。
3. 不默认进入 canonical memory。
4. 不自动生成 formal skill。
5. 不跨 workspace 训练或展示。

### Phase 4：SkillSuggestion Evidence Pipeline

目标：把已验证的经营模式转成候选能力，而不是直接变成自动执行 Skill。

进入条件：

1. 有重复模式。
2. 有成功推进结果。
3. 有人工确认。
4. 有边界定义。
5. 有失败或例外样本。
6. 有最小测试和 guard。

输出：

1. SkillSuggestion。
2. candidate capability。
3. formal review ready marker。

非目标：

1. 不自动生成新的正式 `OperatingSkillId`。
2. 不自动接入 routing。
3. 不自动获得 customer-facing send 权限。
4. 不自动获得 official write authority。

### Phase 5：Narrow Skill Execution Pilot

目标：只在极窄场景验证 Skill 执行能力。

允许范围：

1. `read_only`。
2. `draft_only`。
3. `internal_write` 且必须 review-required。

第一批候选：

1. meeting follow-through draft。
2. external follow-up draft。
3. resource gap review packet。
4. internal handoff summary。
5. low-risk diagnostic refresh。

禁止范围：

1. auto-send。
2. auto-approval。
3. auto-payment。
4. customer-facing commitment。
5. external official write。
6. high-risk state mutation。

## 8. 专家评审问题清单

### 8.1 给产品评审

1. “经营推进闭环”是否比“从问答到自动化”更准确表达 Helm 下一阶段？
2. Must Push 是否应该成为 Ask Helm、资源信号和用户行为的统一承接面？
3. Ask Helm 互动资产是否会提升长期产品复利？
4. 用户是否能理解 `建议 / 草稿 / 复核 / 执行` 的分层？
5. 是否存在更好的第一条试点闭环？

### 8.2 给工程评审

1. AdvancementSignal 是否应该是独立 contract，还是先作为 read model projection？
2. Signal -> Must Push 是否能复用现有 dashboard / operating / mobile read model？
3. Ask Helm Interaction Asset Capture 是否会引入过高存储和隐私成本？
4. SkillSuggestion Evidence Pipeline 是否能复用现有 `PatternFact -> SkillSuggestion`？
5. narrow Skill execution pilot 前需要哪些 guard、tests、audit 和 rollback？

### 8.3 给治理与安全评审

1. 哪些信号可以被记录，哪些必须脱敏或禁止记录？
2. 用户行为洞察是否需要 opt-in 或 workspace admin policy？
3. repeated intent 和 abandoned query 是否可能暴露个人工作压力或绩效信息？
4. Skill 自动化进入 pilot 前必须满足哪些 hard gates？
5. 当前 `plugin runtime without real sandbox` 对 Phase 5 有多大阻塞？

### 8.4 给销售与交付评审

1. 客户最容易理解的是“自动化”还是“推进不漏、不拖、不失控”？
2. 资源信号进入 Must Push 是否能帮助试用客户更快看到价值？
3. 销售 intake 中收集的痛点和资源是否可以自然转成 AdvancementSignal？
4. 第一条试点闭环应选择 Helm 自己 GTM、客户成功，还是某个 vertical tenant？
5. 哪些场景下客户会强烈要求“不要自动做，只提醒我”？

## 9. 建议的决策口径

### 9.1 当前建议

建议批准：

1. 进入 V2.1 文档重写。
2. 进入专家评审。
3. 进入 `Advancement Signal Contract` 需求设计。
4. 进入 `Signal -> Must Push Adapter` 需求设计。

不建议批准：

1. 进入 SkillExecutor 实现。
2. 进入自动执行状态机实现。
3. 进入自动 Skill 路由。
4. 进入 Ask Helm 全量互动日志持久化。
5. 进入用户关心图谱产品化。
6. 进入高风险 official write pilot。

### 9.2 Go / Revise / No-Go 条件

Go 条件：

1. V2.1 主线改成经营推进闭环。
2. P0 改成 Advancement Signal 和 Must Push，而不是 Skill 自动执行。
3. Ask Helm 资产捕获只做只读、可审计、可删除、workspace-scoped。
4. SkillSuggestion 继续保持 candidate capability，不获得 execution authority。
5. 所有自动化都需要显式 risk posture、review posture 和 rollback posture。

Revise 条件：

1. 团队仍希望把“自动化”作为对外主叙事。
2. 无法定义清楚 AdvancementSignal。
3. 无法解释 Ask Helm 资产和经营记忆的边界。
4. 资源信号无法转成可验证 Must Push。

No-Go 条件：

1. 有人要求 candidate skill 自动变 formal skill。
2. 有人要求 Ask Helm 自动写 official system。
3. 有人要求没有 review 的 customer-facing send。
4. 有人要求跨 workspace 汇总个人行为图谱。
5. 安全评审认为当前数据捕获不可控。

## 10. 对 V2 原文的建议改稿

### 10.1 标题

建议从：

```text
Helm 经营推进架构 V2：从问答到自动化
```

改为：

```text
Helm 经营推进架构 V2.1：从问答到经营推进闭环
```

### 10.2 核心原则

建议从：

```text
自动化优先：有 SKILL 就用 SKILL，没有人就没有人类
```

改为：

```text
推进优先：系统先识别什么需要推进，再根据风险、证据、权限和复核要求决定由人承接、Skill 准备、Skill 草稿，还是窄范围自动执行。
```

### 10.3 Skill 执行表达

建议从：

```text
下次直接执行，无需人工介入
```

改为：

```text
下次优先形成可复用建议、草稿、复核包或候选 Skill；只有通过治理门槛的低风险场景，才允许进入窄范围自动执行试点。
```

### 10.4 Phase 排序

建议从：

```text
Phase 1：SKILL 自动执行
Phase 2：Ask Helm -> SKILL 孵化
Phase 3：资源信号 -> Must Push
```

改为：

```text
Phase 1：Advancement Signal Contract
Phase 2：Signal -> Must Push Adapter
Phase 3：Ask Helm Interaction Asset Capture
Phase 4：SkillSuggestion Evidence Pipeline
Phase 5：Narrow Skill Execution Pilot
```

## 11. 最终建议

这份 V2 思考应该保留，而且应该升级为 Helm 下一阶段重要战略文档。

但在进入实施前，必须先完成一次 V2.1 收口：

1. 把主线从“自动化”改成“经营推进闭环”。
2. 把 P0 从 Skill 自动执行改成 Advancement Signal 和 Must Push。
3. 把 Ask Helm 资产化限制在只读、可审计、workspace-scoped。
4. 把 Skill 孵化继续接到 SkillSuggestion 和 candidate capability，不越权到 formal skill。
5. 把自动执行放到最后，只做窄场景、低风险、可回滚、可复核 pilot。

一句话结论：

**Helm 下一阶段真正要做的不是让 AI 自动干更多事，而是让系统更早、更准、更稳地发现经营上必须推进的事，并把它交给正确的人或受控 Skill，留下证据，形成记忆，再逐步扩大可复用能力。**
