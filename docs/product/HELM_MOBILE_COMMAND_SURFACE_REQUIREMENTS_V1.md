---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_MOBILE_COMMAND_SURFACE_REQUIREMENTS_V1

更新时间：2026-04-26
状态：Requirements Freeze V1，review approved
当前定位：implementation-plan-ready，暂不进入代码、schema 或新路由实现

## 1. 目标

冻结一条极简 Helm 手机端入口需求：

- 手机端第一屏只服务当前 workspace 内的经营推进
- 第一屏由 `Ask Helm` 超级入口和 `Must Push` 必须推进项组成
- 用户打开手机后，先知道现在最该推进什么，再通过自然语言或卡片进入正确工作面
- 手机端不复制桌面全量导航、不做移动 CRM、不做聊天产品、不做自动执行入口

一句话定位：

**Helm Mobile Command Surface 是 Helm 在手机上的最小经营推进入口，用来让用户随时知道当前最该推进什么、为什么要推进，以及下一步去哪里处理。**

## 2. 背景与问题

Helm 当前已经有：

- `/search` 和 Ask Helm 自然语言入口
- dashboard / operating 中的今日重点、优先项、阻塞和后续动作
- `/memory` 的经营记忆与回放
- `/approvals` 的复核承接
- tenant resource readout 的证据、凭证、资源接入状态
- detail pages 的对象上下文、证据和下一步

但桌面端信息层级不适合直接搬到手机端。移动场景更常见的是：

- 碎片时间快速判断现在先做什么
- 从消息、会议、外出场景中快速进入一个对象或动作
- 处理需要本人复核、确认、补充证据或推进的事项
- 用自然语言找到对象、状态、原因和下一步

因此手机端缺口不是“做一套手机版 Helm”，而是：

**如何把 Ask Helm、今日重点、必须推进项、经营记忆和复核入口压缩成一个 action-first 的手机入口。**

## 3. 当前 repo truth

### 已经完整成立

- Ask Helm v1 需求已冻结为 `workspace-scoped / read-only first / action-first`
- Ask Helm v2 行动意图已经形成回答、计划拆解、草稿准备、handoff、review-required execution 与 denied boundary 的分层
- `/search` 已经是对象搜索与 Ask Helm 的共同入口
- dashboard 已经存在 `todayFocus / topPriorities / stalled opportunities / overdue commitments` 等推进信号
- `/approvals`、`/memory`、`/operating`、detail pages 已经能承接真实后续工作
- 移动端已有一轮站点级 Computer Use / Playwright 可用性与 overflow closeout 经验

### 已成形但仍需下一层

- 手机端还没有独立的“第一屏经营推进入口”
- Ask Helm 当前是 `/search` 页面能力，还没有被设计成手机第一屏主入口
- `todayFocus` 和 operating readout 还没有被压缩成移动端 `Must Push` 列表
- 移动端还没有明确的 response contract，区分“回答”“对象”“下一步”“边界”
- Ask Helm 的权限、help-scope、对象路由和 related object 展示仍需要在实现前保持可验证正确

### 刻意未做

- 不做移动端完整 CRM
- 不做全量报表
- 不做移动端完整设置中心
- 不做通用聊天页
- 不做跨租户搜索或问答
- 不做自动审批、自动外发、自动承诺或自动写回
- 不把 Helm reserved tenant 的 GTM、贡献、应计、结算信息暴露给普通租户

### 风险项

- 如果第一屏变成聊天页，Helm 会偏离 `business operating surface` 的定位
- 如果第一屏变成待办列表，会丢掉 Helm 的判断、解释和证据优势
- 如果移动端展示太多统计与说明，会失去碎片场景的使用价值
- 如果直接使用 Ask Helm 当前行为而不先修正权限和对象路由，移动端会放大错误引导
- 如果按钮文案暗示“执行完成”，会破坏 recommendation / commitment 边界

## 4. 产品定位

`Mobile Command Surface v1` 必须固定为：

- `workspace-first`
- `action-first`
- `Ask-Helm-led`
- `Must-Push-guided`
- `review-first`
- `jump-surface, not execution surface`

它帮助用户完成四件事：

1. 快速问 Helm
2. 看见今天必须推进的事项
3. 理解为什么这件事现在重要
4. 跳到真正承接工作的页面

它不是：

- 手机版完整桌面
- 移动 CRM
- 移动 BI
- AI 聊天中心
- 审批替代器
- 自动执行器

## 5. 第一屏信息架构

手机端第一屏只保留三层。

### 5.1 顶部状态

目标：让用户知道当前 workspace 与今日状态。

必须包含：

- 当前 workspace 名称
- 今日推进状态一句话
- 当前最高风险或最高优先级提示

不应包含：

- 大型指标墙
- 复杂导航
- 长说明文案
- marketing hero

示例：

```text
Helm Demo Workspace
今天先处理星河连锁恢复单，另有 2 项需要复核。
```

### 5.2 Ask Helm 超级入口

目标：让用户用自然语言进入对象、状态、原因、下一步或系统帮助。

输入框应支持：

- 文本输入
- 预置提示词
- 后续可接语音输入，但必须保留 transcript review

默认提示词建议：

- `今天先推进什么？`
- `这个客户为什么卡住？`
- `帮我找到星河连锁的机会`
- `这条为什么不能直接执行？`
- `我下一步该去哪里？`

交互原则：

- Ask Helm 是入口，不是停留目的地
- 回答后必须优先给 `primary next step`
- 不做多轮聊天历史
- 不做相关推荐瀑布流
- 不引导用户停留在自然语言界面里

### 5.3 Must Push 必须推进项

目标：把 Helm 的经营判断压缩成最多 4 个必须处理的推进项。

每个卡片只显示：

- `title`：是什么
- `reason`：为什么现在要处理
- `primaryAction`：下一步去哪里
- `boundary`：仍然适用的边界

示例：

```text
星河连锁恢复单卡住 5 天
合同条款还没有复核，客户上次会议后没有新的跟进动作。
[打开机会]
这里是推进建议，不代表对客户承诺。
```

## 6. Must Push 来源

`Must Push` 第一版只允许从以下 6 类来源生成。

### 6.1 overdue_commitment

已承诺但逾期的事项。

典型承接页：

- `/approvals`
- object detail
- `/operating`

边界：

- 显示“需要处理 / 需要复核”
- 不显示“已承诺已完成”

### 6.2 blocked_decision

已有推荐、证据或草稿，但需要人判断。

典型承接页：

- `/approvals`
- `/operating`
- detail page

边界：

- 只能是 `review_required`
- 不能变成自动审批

### 6.3 stalled_opportunity

机会长期未推进，开始影响经营节奏。

典型承接页：

- opportunity detail
- `/opportunities`
- `/memory`

边界：

- 显示“建议恢复节奏”
- 不承诺成交、不承诺对外话术可直接发送

### 6.4 meeting_follow_up

会议后未形成后续动作、负责人或证据。

典型承接页：

- meeting detail
- `/memory`
- `/operating`

边界：

- 可以准备跟进草稿
- 对外发送仍必须 review-before-send

### 6.5 customer_waiting

客户正在等待我方回复、确认、资料或下一步。

典型承接页：

- company / contact / opportunity detail
- `/inbox`
- `/approvals`

边界：

- 可以提示等待状态和建议动作
- 不自动发送回复

### 6.6 proof_or_review_required

资源接入、执行凭证、审批复核或治理证据需要补齐。

典型承接页：

- `/settings`
- `/operating`
- tenant resource readout
- `/approvals`

这里的 `tenant resource readout` 不是新页面承诺。第一版只能指向当前已经存在的资源治理展示面：

- `/settings` 中的 `TenantResourceReadinessPanel`
- dashboard / internal operating 中的 `TenantResourceOperatingImpactPanel`
- 后续如果需要 detail anchor，只能作为现有页面内的锚点或参数，不新增独立 resource console

边界：

- 显示“补证据 / 进入复核”
- 不把 proof 当作 external write success

## 7. Must Push 排序规则

第一版排序不交给 LLM 最终决定，应采用 deterministic ranking。

推荐排序因子：

1. `riskLevel`
2. `dueAt / staleDays`
3. `customerWaiting`
4. `blockedDecision`
5. `revenueOrRetentionImpact`
6. `confidence`
7. `reviewRequired`

排序原则：

- 高风险优先于低风险
- 逾期优先于未逾期
- 客户等待优先于内部优化
- 有明确下一步优先于模糊提醒
- 证据不足但高风险的事项进入 `review_required`，不直接压到第一位

平局与冲突处理：

- `riskLevel=critical` 且有明确承接页时，优先于单纯逾期天数
- `customerWaiting=true` 优先于内部待优化项
- `blockedDecision=true` 且会影响 customer-facing trust 时，优先于普通 stalled item
- `reviewRequired=true` 不自动降级，但必须显示 boundary note
- `confidence=low` 的事项不能成为唯一 primary item；如果风险高，只能进入 `review_required` 姿态

截断规则：

- 第一屏最多展示 4 个 Must Push 项，其中第 1 个是 primary item，后 3 个是 supporting items
- 第 5 个及之后不直接铺在第一屏，进入 `moreAttentionCount`
- 如果被折叠项中存在 `critical` 或 customer-waiting 项，第一屏必须显示一条 compact overflow cue
- 低风险、低置信度、无明确下一步的折叠项不进入第一屏，只能在承接页继续查看

LLM 可以参与：

- 生成一句更自然的解释
- 帮用户理解为什么这件事在前面
- 把结构化原因压缩成移动端短文案

LLM 不负责：

- 最终排序
- 权限判断
- 是否可执行
- 是否可承诺
- 是否写回老系统

## 8. 移动端 Ask Helm 响应契约

移动端 response 必须比桌面更短。

建议结构：

```ts
interface MobileAskHelmResponse {
  judgement: string;
  reason: string;
  primaryAction: {
    label: string;
    href: string;
    mode: "open_page" | "open_object" | "open_review" | "prepare_draft";
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  boundaryNote?: {
    type:
      | "read_only"
      | "review_required"
      | "suggestion_not_commitment"
      | "out_of_scope"
      | "cross_workspace_denied";
    message: string;
  };
  grounding: {
    objectCount: number;
    memoryUsed: boolean;
    systemKnowledgeUsed: boolean;
    sourceLabels: string[];
  };
}
```

显示规则：

- `judgement` 最多 1 句
- `reason` 最多 2 句
- 主按钮只能有 1 个
- 辅助按钮最多 1 个
- boundary note 必须在高风险、复核、外发、承诺、写回相关问题中显示

移动端 response 与桌面 Ask Helm 的关系：

- 移动端不实现独立解释器
- 移动端必须复用桌面 `AskHelmResponse`，再通过 adapter 压缩成 `MobileAskHelmResponse`
- adapter 只负责压缩、裁剪、选择主动作和移动端文案，不负责重新排序、重新授权或重新解释权限

建议 adapter contract：

```ts
function adaptAskHelmResponseToMobile(input: {
  response: AskHelmResponse;
  inputMode: "typed" | "voice";
  maxReasonSentences?: 2;
}): MobileAskHelmResponse;
```

默认映射：

- `judgement` 取 `response.answer.summary`
- `reason` 取 `response.answer.explanation` 的前 1-2 句
- `primaryAction` 取 `response.nextStep.primary`
- `secondaryAction` 取 `response.nextStep.alternatives?.[0]`
- `boundaryNote` 原样继承，不得静默删除高风险边界
- `grounding` 从 `response.relatedObjects / response.grounding / retrievalPlan` 压缩而来

## 9. 导航与承接

手机端不是执行终点，必须把用户送到承接面。

允许的 primary action：

- `打开机会`
- `打开会议`
- `查看经营记忆`
- `进入复核`
- `打开 operating`
- `准备草稿`
- `补充证据`

不允许的 primary action：

- `直接发送`
- `自动审批`
- `确认承诺`
- `执行写回`
- `自动结算`
- `跨租户查询`

承接规则：

- 对象问题进入对应 detail page
- 复核问题进入 `/approvals`
- 经营优先级进入 `/operating`
- 记忆和证据问题进入 `/memory` 或 resource readout
- 系统用法问题进入对应页面或帮助片段

## 10. 权限与租户边界

手机端必须继承桌面端的 workspace / membership / capability 边界。

必须满足：

- 只查询当前 workspace
- 只展示当前 membership 可见对象
- 不跨租户搜索
- 不展示 Helm reserved tenant 的 GTM / 贡献 / 应计 / 结算信息
- 不绕过 Ask Helm 的 capability-aware help scope
- 不因为手机端入口简化而放宽审批、外发、写回权限

必须拒绝：

- 跨 workspace 比较
- 开放域问题
- 高风险直接执行
- 自动发送
- 自动审批
- payment / settlement / reserved-only 内部 truth 的普通租户查询

## 11. UI 原则

手机端应遵守：

- 第一屏只服务“现在该做什么”
- 信息密度要低于桌面，但判断强度不能下降
- 卡片少而明确
- 边界短而可见
- 不用 marketing hero
- 不把证据堆到第一屏
- 不做大面积聊天记录
- 不使用复杂图表

建议第一屏结构：

```text
Workspace status

[ Ask Helm input ]

Must Push
- top item
- review item
- blocked item

Bottom navigation
```

底部导航建议：

- `Now`
- `Ask`
- `Approvals`
- `Memory`
- `Me`

第一版结构：

- `Now` 与 `Ask` 合并在同一首页，顶部就是 Ask Helm 输入框，下面是 Must Push
- `Approvals` 和 `Memory` 作为明确的工作承接入口保留
- `Me` 只放当前用户、角色定义、语言、退出和个人设置入口，不承接组织管理、结算或 reserved tenant 信息
- Phase 1 不要求完整 5-tab app；可以先用底部轻量入口或固定快捷区验证信息层级
- Phase 4 才评估是否需要持久底部导航

## 12. 数据来源

第一版只复用已有读模型，不新增 canonical 业务对象。

可用来源：

- dashboard `todayFocus`
- operating summaries
- recommendation / blocker / commitment readouts
- approvals queue
- memory summaries
- meetings follow-up
- opportunity staleness
- tenant resource readiness / proof / review readouts
- Ask Helm related objects / response contract

当前已知代码锚点：

- `todayFocus / topPriorities / overdueCommitments / stalledOpportunities` 来自 `lib/recommendations/recommendation.service.ts`，并由 `features/dashboard/page-loader.ts`、`app/(workspace)/dashboard/page.tsx` 消费
- approval queue 由 `features/approvals/queries.ts` 和 `data/queries.ts` 暴露
- tenant resource readiness 由 `features/settings/components/tenant-resource-readiness-panel.tsx` 展示
- tenant resource operating impact 由 `lib/tenant-resources/operating-impact.ts`、`lib/tenant-resources/workspace-operating-impact-query.ts`、`components/shared/tenant-resource-operating-impact-panel.tsx` 承接
- Ask Helm related objects / response contract 来自 `features/search/ask-helm-interpreter.ts` 与 `features/search/ask-helm-search-page-adapter.ts`

不新增：

- mobile-only task object
- mobile-only priority ledger
- mobile-only chat history
- mobile-only execution queue

如果需要中间聚合，必须是 read model 或 adapter，不是新的事实源。

## 13. MVP 阶段

### Phase 0 - Requirements Freeze

交付：

- 本需求文档
- README / docs 索引
- 不做代码

完成标准：

- 第一屏边界清楚
- Must Push 来源清楚
- Ask Helm 移动端 response contract 清楚
- 非目标清楚

### Phase 1 - Static Mobile IA Prototype

目标：

- 用现有 mock / seed 数据做手机第一屏结构验证

交付：

- `Now + Ask + Must Push` 静态页面或原型
- 中英文文案样例
- Playwright mobile screenshot

不做：

- 新 API
- 新 schema
- 真实执行

### Phase 2 - Read Model Adapter

目标：

- 从现有 dashboard / operating / approvals / memory / resource readout 汇总 `Must Push`

交付：

- `MobileCommandReadModel`
- deterministic ranking
- focused tests

不做：

- LLM 排序
- 新事实源

### Phase 3 - Ask Helm Mobile Response

目标：

- 把 Ask Helm response 压缩成移动端 `judgement / reason / action / boundary`

交付：

- mobile response adapter
- intent-aware related object routing
- capability-aware deny / downgrade
- tests for boundary cases

前提：

- Ask Helm help-scope enforcement 已收口
- Ask Helm related object filtering 已收口
- Ask Helm intent-aware object routing 已收口

### Phase 4 - Mobile Surface Integration

目标：

- 将 `Now + Ask + Must Push` 作为手机入口接入现有 workspace shell

交付：

- route 或 responsive mobile entry
- bottom navigation 或 lightweight mobile entry control
- mobile e2e / accessibility / overflow checks

不做：

- 原生 App
- push notification center
- offline mode

## 14. 验收标准

产品验收：

- 手机第一屏 5 秒内能看出今天最该推进什么
- 第一屏默认展示 1 个 primary Must Push 和最多 3 个 supporting Must Push
- 超出 4 个的推进项必须折叠成 count / cue，不得继续向下铺满第一屏
- 每个 Must Push 项都有明确下一步
- 高风险项必须显示 boundary note
- Ask Helm 回答必须带主按钮
- out-of-scope 问题不能展示误导性对象卡片
- 任何 customer-facing、审批、写回、结算相关动作都不能被写成已完成

技术验收：

- 不新增 schema
- 不新增 execution authority
- 不跨 workspace 查询
- 不引入 conversation history persistence
- 不引入新的 vector store
- deterministic ranking 有测试
- deterministic ranking 的平局和截断规则有测试
- mobile response adapter 有测试
- Playwright mobile 视口无横向溢出

边界验收：

- recommendation != commitment
- explanation != approval
- draft != send
- proof != external write success
- Ask Helm != chat product
- Mobile Command Surface != mobile CRM

## 15. 实现前置条件

进入 Phase 2 / Phase 3 前，应先修正或确认以下 Ask Helm 基础问题：

- capability-aware help scope 必须真实进入 deny / downgrade 路径
- Ask Helm 页面必须展示解释器过滤后的 related objects
- related object routing 必须按 intent 选择目标对象，不能固定 opportunity 优先
- `/demo/start` 等入口的 redirect origin 信任边界不应污染移动端入口设计

这些不是移动端需求本身，但如果不先收口，手机端会放大错误引导和边界误解。

## 16. 下一步建议

下一步不应直接实现完整手机端。

建议顺序：

1. 先做 `Mobile Command Surface Implementation Plan V1`
2. 修正 Ask Helm 当前 correctness / boundary 问题
3. 做静态 mobile IA prototype
4. 做 `Must Push` read model adapter
5. 再做 Ask Helm mobile response adapter

本需求冻结的是产品方向和边界，不授权：

- mobile auto execution
- mobile approval replacement
- mobile notification center
- mobile CRM
- mobile chat product

## 17. 收口结论

本需求已通过产品评审，可以作为 `Mobile Command Surface` 后续实施计划的输入。

冻结结论：

- 手机端第一屏固定为 `Ask Helm + Must Push`
- 第一版不新增 schema、不新增执行权限、不新增移动端事实源
- `Must Push` 只来自现有读模型或 adapter
- 移动端 Ask Helm 必须由桌面 `AskHelmResponse` adapter 压缩而来
- 实现前必须先修正 Ask Helm 的 help-scope、related object filtering 和 intent-aware routing 问题

本次 freeze 不授权：

- 直接开发完整手机端
- 新建 mobile task object
- 新建移动聊天历史
- 新建移动执行队列
- 绕过现有 workspace / membership / capability 边界
