---
status: active
owner: Product / Design / Engineering
created: 2026-05-17
last_reviewed: 2026-05-17
review_after: 2026-05-31
claude_review: ../reviews/HELM_OPERATING_SIGNAL_FLOW_MAP_CLAUDE_REQUIREMENTS_REVIEW.md
archive_trigger:
  - 本需求被实际 `/operating` 信号流图 PRD、UI contract、runtime closeout 替代
  - Helm 放弃 Business Advancement / operating signal 主线
  - 本视图被拆分为多个独立 readout，不再需要统一流图合同
---

# Helm Operating Signal Flow Map Requirements

## 0. 设计立场与 owner 决策

本视图同时承担三个不可妥协目标：

1. **判断优先**：管理者打开页面第 1 秒必须读到当前经营信号是 `流畅 / 积压 / 阻塞`。
2. **经营信号在流动**：横向 `source -> outcome` 单向流动是首屏主叙事，不能被问题清单或技术拓扑取代。
3. **管理者能直观看到 Helm AI 在做什么**：AI 感来自 `AI 工作姿态`、证据覆盖、规则判定、解释覆盖与待复核标记，而不是暗示自动执行。

边界与动态不是二选一。动态和 AI 感越强，边界声明越要清晰：本视图始终是只读观察与 trace projection，不是 runtime DAG、scheduler、retry queue、dispatcher、workflow engine、BI 平台或自动执行平面。

### 0.1 已确认的 owner 决策

| 决策 | 结论 | 影响 |
|---|---|---|
| Q1：入口位置 | 采用 A'：Signal Flow Map 成为 `/operating` 第一屏主表达；现有 BusinessFirstSummary 收进侧栏、Inspector 或下方共生层 | 文档不再把本视图降级为 secondary tab |
| Q2：经营信号原子 | 一条 `OperatingSignalEvent` 是可被追踪、归一、关联对象、进入判断或被拒绝的经营信号原子；采集记录、会议、CRM、审批、MemoryCandidate 等默认是证据、上下游产物或结果，不自动等同于 signal | Phase 0 fixture 和 contract 围绕 event path 建模 |
| Q3：最高压路径算法 | 起步算法：`boundary incident` 优先，其次 `blockedSince` 最久，其次 `review_required` 且有 owner / decision pressure；不在第一版引入复杂 revenue impact 权重 | Inspector 默认预选路径有确定性 |

## 1. 结论

Helm 需要一个面向管理者的 **Operating Signal Flow Map**：把企业经营信号从外部系统进入 Helm、经过采集姿态、归一化、质量门、对象关联、判断、复核、行动候选、记忆沉淀与结果反馈的全过程，呈现为一张有方向、有状态、有流速、有阻塞原因的动态经营图。

这个视图的目标不是做服务监控，也不是做完整 workflow / orchestration 平台，而是让管理者在一个页面里看清：

1. 哪些经营信号正在流动。
2. 它们从哪里来，流向哪个经营对象、决策点或复核队列。
3. 哪些信号被阻塞、降级、隔离、合并、撤回或等待人类判断。
4. Helm AI 在每段链路上做了什么，哪些由 deterministic rule 决定，哪些只是解释。
5. 哪些卡点正在影响经营推进速度、质量和结果。

本文件是需求与设计合同。当前只授权 docs / design / future implementation planning，不授权 schema、runtime extractor、API route、页面实现、production query adoption、official write、自动执行、自动外发、自动审批或 LLM final ranking。

## 2. 产品定位

一句话：

> Helm 的信号流图不是 dashboard，也不是技术 service map，而是管理者观察 Helm AI 如何把经营信息变成可复核经营推进的动态观察视图。

设计参考用户提供的 service map 截图，但 Helm 必须把技术服务依赖图转译为经营信号流：

```text
source system
  -> collection posture
  -> normalization
  -> object link
  -> signal validity gate
  -> judgement
  -> review packet / Must Push candidate / report / memory candidate
  -> human decision
  -> receipt / outcome / learning candidate
```

这条路径是 **read-only trace projection**。它不是 runtime DAG、scheduler、retry queue、dispatcher、agent orchestration、connector marketplace 或 workflow builder。

每条线都必须有方向；每个节点都必须可解释；每个阻塞都必须落到一个可处理原因；每个可行动路径都必须带 boundary note。

## 3. 信号原子与范围

### 3.1 OperatingSignalEvent 定义

一条 `OperatingSignalEvent` 是 Helm 信号流图的最小经营原子。它必须满足：

1. 可追踪：有 `signalKey`、`traceId`、`workspaceId` 与时间戳。
2. 可归一：能表达 source、family、object、evidence、state。
3. 可判断：能进入 deterministic gate，或被明确拒绝 / 隔离 / 降级。
4. 可复核：能说明 allowed / forbidden next actions。
5. 可解释：能展示 Helm AI 的解释覆盖，但状态跳转不由 LLM 直接驱动。

### 3.2 与现有对象的关系

| 对象 / 事件 | 在本视图中的角色 | 是否默认等同 signal |
|---|---|---|
| Connector sync run / ingestion record | 上游采集证据或 source posture | 否 |
| Meeting run / email thread / CRM event | 原始 source evidence 或 causedBy event | 否 |
| `OperatingSignalEvent` | 信号流图原子 | 是 |
| ApprovalTask / review request | 下游复核产物 | 否 |
| Must Push candidate | 下游行动候选，仍需人工复核 | 否 |
| MemoryCandidate / LearningCandidate | 下游沉淀候选 | 否 |
| SkillSuggestion | 学习 / 能力改进候选 | 否 |

### 3.3 Signal family

Phase 0 使用有限 family，避免把本视图扩成泛 BI：

| Family | 含义 |
|---|---|
| `commitment` | 承诺、跟进、客户等待、会后事项 |
| `advancement` | 经营推进、机会进展、交付推进 |
| `risk` | 风险、冲突、逾期、客户流失征兆 |
| `pacing` | 节奏、积压、响应变慢 |
| `receipt` | 人类决定后的回执与结果 |
| `evidence_gap` | 证据缺口、owner 缺失、对象未关联 |
| `boundary_attempt` | 越权、raw payload、cross-workspace、silent write 尝试 |

## 4. 目标用户与核心问题

本视图永远是 single-workspace scope。它不提供跨租户聚合视角；任何 cross-workspace / cross-tenant projection 都必须计入 boundary leak counter，并在 evaluator 中失败。

| 用户 | 进入视图时要回答的问题 | 不应看到的东西 |
|---|---|---|
| Founder / GM | 今天公司经营信号有没有流起来？哪里卡住会影响收入、交付或风险？ | 无意义技术拓扑、泛 BI 指标堆叠 |
| Sales / CS leader | 客户等待、承诺逾期、会后跟进是否正在转成 Must Push candidate 或 review queue？ | 自动改 CRM、自动承诺、自动外发暗示 |
| Operator / PM | 哪些 source、规则、对象关联或 review queue 需要修？ | 黑盒 AI 结论 |
| Reviewer | 哪些信号因为证据、权限、冲突或边界需要我复核？ | 未脱敏原始 payload、跨租户聚合 |
| Engineering / Data Protection | 哪段链路掉线、超时、缺 trace 或存在 raw-data risk？ | 把工程健康直接包装成业务结论 |

## 5. 第一屏信息架构

第一屏必须是业务推进视图，不是解释页，也不是技术拓扑页。

### 5.1 顶部 Judgement Bar

顶部不是 6 个等权指标墙，而是“一句判断 + 4 个核心读数 + AI 工作姿态”。

| 区块 | 规则 |
|---|---|
| 一句判断 | 最大字号，必须以 `流畅 / 积压 / 阻塞` 三选一开头；由 deterministic template 生成，禁止 LLM 自由发挥 |
| `Blocked signals` | 有明确 blocker 的信号数 |
| `Decision pressure` | 需要人类拍板的积压 |
| `Review backlog` | 等待 reviewer 处理的路径数 |
| `Boundary incidents` | 越权、raw payload、cross-workspace、auto-write attempt 等事件；0 也必须展示 |
| `AI work posture` | deterministic 覆盖、解释覆盖、证据覆盖、待复核标记次数；不是 AI final score |

`AI confidence band` 不作为首屏主读数。首屏只展示 AI 工作姿态，不展示 LLM 排名或最终评分。

### 5.2 中央 Signal Flow Canvas

中央区域是一张横向有向图：

```text
[Sources] -> [Collectors] -> [Signal Gate] -> [Object Link] -> [Judgement] -> [Review / Action / Memory] -> [Outcome]
```

横向 `source -> outcome` 是主叙事；lane 只是次级语义，不能把画面做成 incident dashboard。

| 分组 | 节点例子 | 说明 |
|---|---|---|
| Sources | CRM、邮件、会议、钉钉、文档、Ask Helm、internal capture | 只显示已接入、已配置或当前窗口有样本的 source；roadmap source 不显示 |
| Collectors | connector sync、manual import、meeting capture、report skill | 展示采集健康、延迟、失败原因 |
| Signal Gate | validity、freshness、permission、duplicate、contradiction | Helm 的信号质量门 |
| Object Link | Deal、Account、Contact、Meeting、Commitment、Workspace | 展示信号是否找到经营对象；label 可本地化，canonical kind 保持稳定 |
| Judgement | `must_push_candidate`、`review_required`、`watch_only`、`rejected` | deterministic judgement 为主，LLM 只解释 |
| Review / Action / Memory | approvals、Must Push candidate、briefing、weekly report、MemoryCandidate、LearningCandidate | 全部保持 review-first |
| Outcome | human confirmed、revise、stop、done、missed、learned | 只显示结果和反馈，不替人决策 |

Lane 排序按经营优先级呈现：

```text
Blocked / Boundary blocked
Review required
Flowing
Watch-only / Learned
```

但每条 lane 内仍保持左到右流动，避免第一眼读成告警列表。

### 5.3 右侧 Inspector

Inspector 必须默认预选最高压路径，不能空着等待用户点击。最高压路径算法：

1. 有 `boundaryIncidentCount > 0` 的路径优先。
2. 否则选择 `blockerSince` 最早的 blocked path。
3. 否则选择 `review_required` 且有 owner / decision pressure 的 path。
4. 否则选择最近发生状态跃迁的 flowing path。

Inspector 必须回答：

1. 这条路径现在是什么状态。
2. 卡在哪里，卡了多久，为什么卡。
3. 谁是 owner / reviewer。
4. 允许的下一步是什么。
5. 明确禁止的动作是什么。
6. deterministic rule 结果是什么。
7. Helm AI 解释了什么，哪些只是 explanation。
8. evidence refs 与 trace id 是什么。
9. boundary note 和 boundary check result 是什么。

Inspector 必须始终显示 boundary note，尤其是 send、CRM write、approval、payment、contract、official state 相关路径。`allowedNextActions` 与 `forbiddenNextActions` 同等视觉权重展示；禁止动作为空时也要显示“无显式禁止动作”，不能折叠。

### 5.4 底部时间轴

底部时间轴默认折叠为一行：

```text
detected -> normalized -> linked -> judged -> packetized -> reviewed -> awaiting receipt -> outcome -> learned
```

默认显示：

- 1h / 24h / 7d segmented control
- flow posture sparkline
- blocked reason 标签
- 当前窗口 vs 上一窗口摘要

完整 scrubber 只有用户主动展开时出现，不自动播放，不改写历史，不隐藏 rejected / quarantined / superseded。

### 5.5 三态首屏

三态必须是三套不同 layout，不复用主图骨架。

| 状态 | 第一眼必须看到 | 禁止 |
|---|---|---|
| `empty` | 不画节点和边；顶部数字显示 `-` 而不是 `0`；中央给 source 连接入口卡 | 假装今天经营没有问题 |
| `fixture` | 顶部琥珀 banner：`当前为样例数据 · 不是你工作区的真实信号流`；canvas 永久 `示例 / fixture` 水印；所有数字断言带 `示例:` 前缀 | 用动效制造真实感 |
| `degraded` | 受影响 source 虚线灰底，标上次同步时间；下游边静态；顶部不得显示 `流畅`；boundary incidents 副文标 `含 connector 降级 N` | 把 connector 健康问题误写成经营正常 |

## 6. 动态显示规则

动态必须表达业务含义，不做装饰性动画。流动可见是本视图的核心诉求，不能被过度保守的 fallback 结构性关掉。

### 6.1 允许的动态

| 动态效果 | 表达含义 | 约束 |
|---|---|---|
| 状态跃迁 sweep | 信号从上一状态进入下一状态 | 单次 1.5-2 秒，同屏并发不超过 3 条 |
| 边粗细微调 | 当前窗口吞吐量或信号数 | 只能绑定明确计数字段，不能暗示业务价值 |
| 边颜色变化 | 正常、延迟、阻塞、拒绝、复核中 | 使用状态色边框或线色，不用大面积渐变 |
| 阻塞 audit heartbeat | 信号被标出待复核，需要处理 | 仅边框透明度变化，周期约 4 秒，禁 scale / glow |
| Inspector fade-in | 用户切换路径 | 约 200ms，无弹跳、无装饰 |
| 用户触发回放 | 展示单条 signalKey / traceId 路径 | 仅主动点击后播放，禁止默认自动播放 |

### 6.2 禁止的动态

- 粒子、3D、glow ring、玻璃发光、视差。
- 全图常态流光。
- 节点 spinner。
- lane breathing dot。
- time scrubber 自动播放。
- ghost trail 常态显示。
- 用紫蓝霓虹渐变制造“AI 高级感”。

### 6.3 动态降级

以下条件触发降级：

| 条件 | 降级规则 |
|---|---|
| 用户开启 `prefers-reduced-motion` 或显式关闭动效 | 所有动效关闭 |
| `dataPosture = fixture` | 所有动效关闭，避免样例数据看起来像真实流 |
| 实际 boundary incident > 0 | 涉及 incident 的路径动效关闭；非相关路径可保留状态跃迁 sweep |
| connector 主线降级 | 受影响 source 与下游边静态；不受影响路径可保留状态跃迁 sweep |

`reviewPressure = high` 不能作为关闭全部动效的理由。高压状态下更需要保留经营叙事所必需的状态跃迁 sweep。

## 7. 信号状态机

每条经营信号必须有明确状态机。状态跳转只允许由 source event、connector、deterministic rule、reviewer、owner、system timer 或 Data Protection 触发；LLM 只能解释，不得直接触发状态跳转。

### 7.1 正向路径

```text
DETECTED
  -> NORMALIZED
  -> LINKED
  -> GATED
  -> JUDGED
  -> PACKETIZED
  -> REVIEW_PENDING
  -> HUMAN_DECIDED
  -> AWAITING_RECEIPT
  -> OUTCOME_RECORDED
  -> LEARNING_CANDIDATE
```

### 7.2 中止 / 降级 / 终态

| 状态 | 触发原因 |
|---|---|
| `UNRESOLVED_SOURCE` | source 不可用、凭据缺失、connector 降级 |
| `MISSING_EVIDENCE` | 证据不足，不能进入判断 |
| `MISSING_OWNER` | 没有 owner，不能进入 Must Push candidate |
| `STALE_SIGNAL` | 过期或 freshness 不达标 |
| `DUPLICATE_COMPRESSED` | 重复信号被折叠，副本保留 event 并指向主 signal |
| `CONTRADICTION_REVIEW` | 与已有事实或文档冲突 |
| `PERMISSION_BLOCKED` | 用户或 workspace 无权限 |
| `BOUNDARY_BLOCKED` | 涉及 send / approve / CRM write / commitment 等越权意图 |
| `REJECTED` | 不合格或不允许进入下游 |
| `QUARANTINED` | raw payload、跨 workspace、敏感信息、trace 缺失 |
| `AWAITING_RECEIPT` | 人类已决策，但结果回执尚未到达 |
| `OUTCOME_MISSING` | 超过 SLA 仍无回执 |
| `SUPERSEDED` | 被更新版本覆盖 |
| `REVOKED` | 来源或客户主动撤回 |
| `MERGED` | 与另一条 canonical signal 合并 |

### 7.3 Transition 表

| From | To | Triggered by | Evidence | Boundary check |
|---|---|---|---|---|
| `DETECTED` | `NORMALIZED` | connector / source_event / deterministic_rule | source ref | required |
| `NORMALIZED` | `LINKED` | deterministic_rule | normalized fields | required |
| `LINKED` | `GATED` | deterministic_rule | object ref + evidence refs | required |
| `GATED` | `JUDGED` | deterministic_rule | gate checks | required |
| `JUDGED` | `PACKETIZED` | deterministic_rule | disposition + evidence coverage | required |
| `PACKETIZED` | `REVIEW_PENDING` | deterministic_rule / reviewer | review packet refs | required |
| `REVIEW_PENDING` | `HUMAN_DECIDED` | reviewer / owner | decision ref | required |
| `HUMAN_DECIDED` | `AWAITING_RECEIPT` | owner / system_timer | decision ref | required |
| `AWAITING_RECEIPT` | `OUTCOME_RECORDED` | source_event / connector / reviewer | receipt ref | required |
| `AWAITING_RECEIPT` | `OUTCOME_MISSING` | system_timer | missing receipt SLA | required |
| `OUTCOME_RECORDED` | `LEARNING_CANDIDATE` | deterministic_rule | outcome ref | required |
| any pre-review state | `MISSING_EVIDENCE` | deterministic_rule | failed evidence gate | required |
| any pre-review state | `UNRESOLVED_SOURCE` | connector | source posture | required |
| any pre-review state | `MISSING_OWNER` | deterministic_rule | missing owner gate | required |
| any state | `BOUNDARY_BLOCKED` | deterministic_rule / Data Protection | boundary check | required |
| any state | `QUARANTINED` | Data Protection / deterministic_rule | redaction or trace failure | required |
| any state | `SUPERSEDED` | source_event / connector | supersededBySignalKey | required |
| any state | `REVOKED` | source_event / owner | revocationReason | required |
| any state | `MERGED` | deterministic_rule / reviewer | mergedIntoSignalKey | required |
| duplicate event | `DUPLICATE_COMPRESSED` | deterministic_rule | dedupeKey + mergedIntoSignalKey | required |

### 7.4 恢复路径

| Blocked state | 恢复入口 | 规则 |
|---|---|---|
| `MISSING_EVIDENCE` | `NORMALIZED` 或 `GATED` | 补证据后必须重新跑 gate，不能直接进入 judgement |
| `UNRESOLVED_SOURCE` | `NORMALIZED` | connector 恢复后生成新 event，保留原 trace |
| `MISSING_OWNER` | `PACKETIZED` | owner 确认后重新生成 review packet |
| `CONTRADICTION_REVIEW` | `REVIEW_PENDING` 或 `REJECTED` | reviewer 决定继续、退回或拒绝 |
| `OUTCOME_MISSING` | `OUTCOME_RECORDED` 或 `WATCH_ONLY` | receipt 到达则记录结果；持续缺失则降级 |

## 8. AI 工作姿态

视图要有 AI 感，但不能把 AI 包装成自动执行者。

### 8.1 AI 工作姿态 lanes

图上可以有一层 `AI 工作姿态 lane`，用于观察 Helm AI 的解读、压缩、解释和待复核标记。这些 lane 不是 runtime worker，没有任务实体、schedule、queue、retry 或 dispatch 权限。

| Lane | 做什么 | 输出 | 权限边界 |
|---|---|---|---|
| Collector posture | 读取或接收信号姿态 | source event / payload summary | 不修改源系统；非 runtime worker |
| Normalizer posture | 归一字段、脱敏、压缩 | normalized signal | 不生成业务结论；非 runtime worker |
| Linker posture | 关联经营对象 | object ref candidate | 低置信度必须 review；非 runtime worker |
| Judge posture | 按规则分级 | disposition | LLM 不做最终排序；非 runtime worker |
| Explainer posture | 解释为什么 | reason / evidence chain | 不替代 deterministic gate；非 runtime worker |
| Reviewer assist posture | 准备 review packet | allowed / forbidden actions | 不自动审批；非 runtime worker |
| Memory distiller posture | 准备记忆候选 | MemoryCandidate | 不写 canonical memory；非 runtime worker |
| Learner posture | 收集 outcome 反馈 | LearningCandidate | 不自动改 prompt / policy / skill；非 runtime worker |

### 8.2 AI 感的产品表达

允许：

- 首屏展示 `AI work posture`，例如 deterministic 覆盖、解释覆盖、证据覆盖、boundary 待复核标记次数。
- 在 Inspector 中展示 deterministic rule 与 LLM explanation 的区别。
- 展示 confidence source，但只允许 `deterministic` 或 `explanation`，不允许 `llm_ranking`。
- 在 fixture / disclosure 中展示样例数字，但真实产品文案不得用未验证数字制造能力承诺。

不允许：

- 写成 Agent OS、workflow orchestration、autonomous workforce。
- 暗示 Helm 自动替管理者决策。
- 暗示 Helm 自动发消息、自动承诺、自动审批、自动结算或自动改 CRM。
- 让动画盖过 boundary note 和 review requirement。

## 9. 关键用户故事

### P0 用户故事

1. 作为 GM，我打开视图后 5 秒内知道公司经营信号是流畅、积压还是阻塞，最高压路径是什么。
2. 作为 Founder，我能第一眼看到 Helm AI 做了哪些准备动作、哪些地方标出待复核，以及复核理由是否正确。
3. 作为 Sales leader，我能看到客户等待、承诺逾期、会后跟进从邮件 / 会议 / CRM 流向 Must Push candidate 或 review queue。
4. 作为 Reviewer，我能只看 `review_required` 和 `blocked`，并知道每条信号卡在哪里、为什么卡。
5. 作为 Operator，我能定位某个 source 或 gate 导致的吞吐下降，而不是猜是连接器、证据、规则还是权限问题。

### P1 用户故事

1. 对比今天与昨天，识别经营推进速度下降来自哪条 source 或哪类 gate。
2. 回放单条 signalKey / traceId 从 source 到 outcome 的完整路径。
3. 聚合某个客户 / 机会 / 项目的相关 signal family，但不跨 workspace。
4. 在一屏内切换当前窗口、历史回放、阻塞专注、复核专注、AI 工作姿态、结果投影。
5. 通过唯一受控路径导出脱敏 weekly flow packet。

## 10. 数据合同草案

第一阶段不要求新 schema。实现时先用 fixture / read model contract 表达只读 graph。任何真实 read model adoption 必须另做 review。

2026-05-17 Phase 2.1 已把代码合同收敛到 `lib/operating-signal-flow/contract.ts` 与 `lib/operating-signal-flow/projection.ts`：

- `contract.ts` 是 `OperatingSignalFlowSnapshot / Node / Edge / Event / Case / FixturePack` 的共享类型与状态常量真相源。
- `projection.ts` 只允许做确定性、纯函数 display projection 与 highest-pressure path selection。
- UI 仍由 `features/internal-operating-workspace/operating-signal-flow-map.tsx` import fixture，再交给纯投影层生成显示模型。
- eval 仍从同一 fixture pack 读取，并复用共享 action/state/transition 常量与 highest-pressure path selector。
- Phase 2.1 可以为了样例覆盖 flatten checked-in fixture pack；Phase 3 runtime adoption 必须改为 single-workspace snapshot projection，不能把多 case / 多 workspace 聚合成一个管理者视图。
- 这一步不代表 schema、API、runtime query、production query adoption、connector read、official write、自动执行或 LLM final ranking 已成立。

2026-05-17 Phase 2.2 已新增 runtime readiness / eligibility gate：

- `evals/operating-signal-flow/runtime-readiness-review-cases.json` 是 checked-in readiness review bundle fixture，不包含真实 payload。
- `lib/evals/operating-signal-flow-runtime-readiness-evals.ts` 只做离线审查：输出 `go / defer / no_go`，并给出 `{ code, path, message, severity }` failure。
- `npm run eval:operating-signal-flow-runtime-readiness` 是必要但不充分的前置门禁。通过它只表示可以进入下一层 runtime 评审，不表示已经批准生产、schema、API、runtime query、LLM final ranking 或任何 official write。
- readiness bundle 必须包含 redacted calibration sample、redacted snapshot projection、Data Protection review evidence、5-role Required Reviewer approval、executive sponsor approval、production query rollout plan、expiry / revocation metadata、deterministic digest 与 static boundary guard evidence。
- redaction shape check 只能检查格式和证据是否存在，不能替代 Data Protection 对脱敏质量本身的审批。
- production query rollout plan 必须列明 query name、source refs、volume estimate、index plan、performance budget、observability plan、shadow / canary / general-review stages、rollback plan 与 single-workspace blast radius。
- 本层继续禁止 schema、API route、runtime query implementation、production query import、connector write、official write、auto-send、auto-approve、auto-execute、silent write 和 LLM final ranking。

2026-05-17 Phase 2.3 已新增 review-bundle intake screen：

- `evals/operating-signal-flow/runtime-readiness-bundle.sample.json` 是单个 alias-only review bundle 的输入样例。
- `lib/evals/operating-signal-flow-runtime-readiness-intake.ts` 只做离线输入筛查：先检查 JSON、1 MiB byte cap、recursive depth cap、v1 shape，再用 `operating-signal-flow-sensitive-rules.v1` 检测 unredacted sensitive key / value pattern。
- `scripts/operating-signal-flow-runtime-readiness-intake.ts` + `npm run eval:operating-signal-flow-runtime-readiness-intake -- --input <file>` 可读取单个 bundle 文件或 stdin，并输出 deterministic JSON、`inputDigest`、`preflight`、`exitCode`、`wrappedPack`、readiness failures；sensitive preflight fail 时 `inputDigest` 固定为 `withheld_sensitive_preflight`，避免把 raw email / phone 等低熵内容变成可枚举哈希。
- exit code 固定为：`0` = preflight pass 且 readiness `go`；`2` = sensitive preflight fail；`3` = preflight pass 但 readiness `defer / no_go`；`64` = input / parse / shape / byte cap / depth cap error。
- intake screen 只检测并拒绝风险输入；它不做 redaction，不修改输入，不批准生产，不授权 schema、API、runtime query、production query adoption、official write、auto-send、auto-approve、auto-execute 或 LLM final ranking。

```ts
type OperatingSignalFlowSnapshot = {
  workspaceId: string;
  dataPosture: "empty" | "fixture" | "degraded" | "current_window";
  window: "1h" | "24h" | "7d";
  generatedAt: string;
  judgementHeadline: string;
  aiWorkPosture: {
    deterministicCoveragePercent: number;
    explanationCoveragePercent: number;
    evidenceCoveragePercent: number;
    boundaryStoppedCount: number;
  };
  nodes: OperatingSignalFlowNode[];
  edges: OperatingSignalFlowEdge[];
  events: OperatingSignalFlowEvent[];
};

type OperatingSignalFlowNode = {
  id: string;
  workspaceId: string;
  kind:
    | "source"
    | "collector"
    | "gate"
    | "object"
    | "judgement"
    | "review"
    | "action_candidate"
    | "memory_candidate"
    | "outcome"
    | "learning";
  lane: "blocked" | "review_required" | "flowing" | "watch_only_learned";
  label: string;
  status: "healthy" | "degraded" | "blocked" | "review_required" | "watch_only" | "rejected";
  signalCount: number;
  blockedCount: number;
  boundaryIncidentCount: number;
  pendingReviewCount: number;
  signalFamilyMix: Array<{ family: OperatingSignalFamily; count: number }>;
  latestEventAt: string | null;
  lastBlockerAt: string | null;
  staleness: "fresh" | "aging" | "stale";
  connectorPosture: "healthy" | "degraded" | "credential_expired" | "disconnected" | "n/a";
  boundaryNote: string;
};

type OperatingSignalFlowEdge = {
  id: string;
  workspaceId: string;
  fromNodeId: string;
  toNodeId: string;
  direction: "forward";
  signalCount: number;
  pendingCount: number;
  throughputPerHour: number;
  medianLatencySeconds: number | null;
  flowPosture: "flowing" | "slow" | "stalled" | "severed";
  lastEventAt: string;
  oldestPendingSince: string | null;
  blockedCount: number;
  blockedReasonsBreakdown: Array<{ reason: OperatingSignalBlocker; count: number }>;
  sweepEligible: boolean;
  boundaryCounter: number;
  evidenceCoveragePercent: number;
  reviewRequiredCount: number;
};

type OperatingSignalFlowEvent = {
  id: string;
  workspaceId: string;
  signalKey: string;
  traceId: string | null;
  previousEventId: string | null;
  causedByEventId: string | null;
  sourceKind: string;
  sourceRef: string;
  signalFamily: OperatingSignalFamily;
  objectRef: string | null;
  objectKind: "Deal" | "Account" | "Contact" | "Meeting" | "Commitment" | "Workspace" | null;
  transitionFrom: OperatingSignalState | null;
  transitionTo: OperatingSignalState;
  triggeredBy:
    | "deterministic_rule"
    | "reviewer"
    | "owner"
    | "system_timer"
    | "source_event"
    | "connector"
    | "data_protection";
  ruleId: string | null;
  actorRef: string | null;
  currentBlockerType: OperatingSignalBlocker | null;
  blockerSince: string | null;
  awaitingReceiptSince: string | null;
  evidenceCoverage: { provided: number; required: number };
  confidenceBand: "high" | "medium" | "low" | "mixed" | "unknown";
  confidenceSource: "deterministic" | "explanation";
  redactionStatus: "redacted" | "alias_only" | "synthetic" | "raw_blocked";
  crossTenantProjection: false;
  dedupeKey: string | null;
  mergedIntoSignalKey: string | null;
  supersededBySignalKey: string | null;
  revocationReason: "source_retract" | "customer_cancel" | "data_protection" | "boundary" | null;
  boundaryCheckResult: "pass" | "blocked" | "escalated" | "n/a";
  policyVersion: string;
  latencyFromPriorMs: number | null;
  occurredAt: string;
  evidenceRefs: string[];
  reviewerRequired: boolean;
  allowedNextActions: Array<"/approvals" | "/memory" | "/capture" | "/settings">;
  forbiddenNextActions: string[];
  boundaryNote: string;
};
```

## 11. 页面与交互设计

### 11.1 入口

第一版设计合同按 A' 处理：Signal Flow Map 是 `/operating` 第一屏主表达。现有 BusinessFirstSummary 不被删除，而是收进侧栏、Inspector 辅助区或下方共生层，作为 judgement summary 的补强。

Phase 0 不实现 UI。Phase 2 如进入 prototype，才允许评估是否需要 `/operating/signal-flow` 子路由；在此之前不得把本视图预设为 secondary tab。

### 11.2 布局

```text
┌──────────────────────────────────────────────────────────────┐
│ 一句判断 · blocked · decision pressure · review · boundary · AI │
├───────────────┬──────────────────────────────────┬───────────┤
│ Lane labels   │ Directed signal flow canvas       │ Inspector │
│ Source filter │ source -> outcome                 │ Evidence  │
│ Risk filters  │ dynamic state transitions         │ Boundary  │
├───────────────┴──────────────────────────────────┴───────────┤
│ Collapsed timeline · reason tags · 1h / 24h / 7d               │
└──────────────────────────────────────────────────────────────┘
```

### 11.3 视图模式

| 模式 | 用途 |
|---|---|
| `当前窗口` | 看当前窗口内信号是否流畅 |
| `历史回放` | 回看某条 signalKey / traceId 路径 |
| `阻塞专注` | 只看阻塞和降级 |
| `复核专注` | 只看人类需要判断的节点 |
| `AI 工作姿态` | 只看 Helm AI 的解读、解释、待复核标记、学习候选 |
| `结果投影` | 看信号是否带来 follow-up、decision、memory、learning |

禁止使用 `Live`、`AI Work`、`Worker` 作为主 UI 模式名。

### 11.4 过滤器

允许过滤：

- source kind
- signal family
- object kind
- owner / reviewer
- status
- blocked reason
- risk level
- time window
- authority boundary

不允许 tenant scope / cross-workspace scope。过滤器不允许反向暴露被隐藏数据，不允许直接生成 shareable URL，不允许直接 CSV 导出。

### 11.5 Inspector 字段排序

| 顺序 | 区块 | 字段 | 折叠规则 |
|---|---|---|---|
| 1 | Path judgement | path headline、signal family、current state、lane | 不可折叠 |
| 2 | Blocker | blocker type、blocked since、reason text、next allowed route | 不可折叠 |
| 3 | Responsibility | owner、reviewer、awaiting receipt since、decision due | 不可折叠 |
| 4 | Allowed / forbidden | allowedNextActions、forbiddenNextActions | 不可折叠 |
| 5 | Timeline | 最近 5 条 transition | 最近 5 条不可折叠，更早可滚动 |
| 6 | AI work posture | explanation coverage、confidence source、evidence coverage | 可折叠 |
| 7 | Deterministic gate | rule id、gate checks | 可折叠 |
| 8 | Evidence | evidence refs、redaction status、trace id | 可折叠 |
| 9 | Relationship | mergedInto、supersededBy、causedBy | 可折叠 |
| 10 | Boundary | boundaryNote、boundaryCheckResult、policyVersion | 永不折叠 |

`pathHeadline` 必须由 deterministic template 生成，禁止 LLM 自由发挥。

## 12. 阻塞判断

阻塞不是单一红点，必须可处理。所有 next action 都是跳转到已有安全 surface，不是内联执行。

| Blocker | 业务含义 | 默认 next action |
|---|---|---|
| `source_down` | 信号没有进入 Helm | 跳 `/settings` 查看 connector posture |
| `stale_source` | 来源过期 | 跳 `/settings` 查看同步状态，或降为 watch-only |
| `missing_evidence` | 不能证明 | 跳 `/approvals` 准备补证据 review packet |
| `missing_owner` | 无 owner | 跳 `/approvals` 升级 owner review |
| `object_unlinked` | 找不到经营对象 | 跳 `/capture` 或 `/approvals` 进入 review |
| `conflict_detected` | 与已有事实冲突 | 跳 `/approvals` 由 reviewer 判断 |
| `permission_blocked` | 权限不足 | 升级 workspace owner 复核；不引入完整 RBAC |
| `boundary_blocked` | 涉及越权动作 | 保持 blocked，准备 review packet |
| `review_backlog` | 人类复核积压 | 跳 `/approvals` |
| `outcome_missing` | 有人类决定但无结果回执 | 要求 receipt 或降级 |

## 13. 回放、时间窗与导出

### 13.1 回放

- 只支持 `signalKey` 或 `traceId`。
- 不按 object 回放整段历史。
- 不跨 workspace。
- 不展开 `QUARANTINED` 或 `raw_blocked` payload。
- 不自动播放。
- 不允许直接导出 replay packet。

### 13.2 时间窗

只支持：

- `1h`
- `24h`
- `7d`

不支持任意 from / to 拖拽。跨窗口比较只允许当前窗口 vs 上一窗口。

### 13.3 导出

唯一允许的导出路径是未来受控的脱敏 weekly flow packet。任意 filter 组合不得直接 CSV 导出，不得生成 shareable URL。

## 14. 验收指标

### 14.1 P0 需求验收

- 管理者能在 5 秒内识别当前是 `流畅 / 积压 / 阻塞`。
- 顶部显示一句判断、4 个核心读数和 AI 工作姿态。
- 中央图默认表达 `source -> outcome` 流动，而不是技术拓扑或告警列表。
- Inspector 默认预选最高压路径，且非空。
- 每条显示的边都有方向、吞吐、延迟、阻塞数和证据覆盖。
- 每个阻塞都能落到明确 blocker type。
- 每条可行动信号都有 boundary note。
- `auto-send / auto-approve / CRM silent write / official write` authority leak = 0。
- LLM explanation 和 deterministic judgement 分开展示。
- 图上任何 AI 工作姿态都不暗示自动外部承诺。

### 14.2 UI 第一观感验收

| ID | 验收条款 |
|---|---|
| UI-1 | 主背景必须 light-first；禁深色霓虹 service-map 直搬，禁大面积紫蓝渐变 |
| UI-2 | 顶部必须含一句判断 + blocked / decision pressure / review backlog / boundary incidents / AI work posture |
| UI-3 | blocked / review_required 的视觉权重大于 flowing / watch_only，但中央主叙事仍是横向流动 |
| UI-4 | Inspector 默认预选 highest-pressure path，boundaryNote 永不折叠 |
| UI-5 | 主图默认可见经营流动；状态跃迁 sweep 是表达流动的最小动态 |
| UI-6 | 禁粒子、3D、glow、玻璃发光、视差、全图常态流光、spinner、自动 scrubber |
| UI-7 | fixture 数据动效全关；connector 主线降级时只冻结受影响路径 |
| UI-8 | 模式名禁止 `Live`、`AI Work`、`Worker` |
| UI-9 | CTA 只允许跳 `/approvals`、`/memory`、`/capture`、`/settings` |
| UI-10 | empty / fixture / degraded 三态必须独立 layout |
| UI-11 | AI 文案只允许说明工作姿态和解释覆盖，不做最终评分 |
| UI-12 | canvas 右下角始终显示 `只读视图 · 非实时调度 · 非自动执行` |

Phase 2 prototype 才需要 Playwright screenshot、视觉 overlap、字体对比度和 reduced-motion 实测。Phase 0 只把这些作为合同，不声明 UI 已成立。

### 14.3 Safety / evaluator 断言

未来 evaluator 必须断言：

| ID | 断言 |
|---|---|
| RPS-1 | 所有 replay 事件序列的 workspaceId 单值 |
| RPS-2 | replay 不返回 raw payload |
| RPS-3 | `QUARANTINED` 事件不展开 payload |
| RPS-4 | time window 仅三档 |
| RPS-5 | 互斥过滤组合拒绝并给出原因 |
| RPS-6 | 任意 inspector 视图的 `crossTenantProjection === false` |
| RPS-7 | 过滤白名单外字段触发 boundary leak |
| RPS-8 | 不存在 `triggeredBy === "llm"` 的 transition |

## 15. 实施计划

### Phase 0：Docs / fixture design

已交付：

- 本需求文档。
- Claude 5 轮评审摘要。
- `evals/operating-signal-flow/signal-flow-cases.json`：15 条 synthetic / alias-only signal flow fixture，覆盖 7 类 signal family、10 类 blocker、22 个状态、empty / fixture / degraded / current window 四类数据姿态。
- `OperatingSignalFlow` fixture matrix 与 fixture-backed contract。
- flow node / edge / event contract。

禁止：

- schema
- runtime connector
- API route
- 页面实现
- LLM call
- production query import
- official write
- inline fix / re-sync / assign / send

### Phase 1：Offline evaluator / static read model

已交付：

- `lib/evals/operating-signal-flow-evals.ts`：fixture -> graph contract evaluator、blocker classification evaluator、boundary leak evaluator、highest-pressure path selector、pointer closure check。
- `lib/evals/operating-signal-flow-evals.test.ts`：覆盖 checked-in fixture pack、highest-pressure tiebreak、fixture posture、LLM transition / LLM ranking 拒绝、cross-workspace projection、merge / supersede pointer closure。
- `scripts/operating-signal-flow-evals.ts` + `npm run eval:operating-signal-flow`。
- `scripts/decision-first-boundary-check.ts` 增加 `operating_signal_flow_offline_eval_boundary`，防止 eval 类型逃逸到 production、禁止 `app/api/operating` runtime route、禁止 Prisma / `data/queries` / LLM SDK import。
- RPS-1 至 RPS-8 断言的 Phase 0/1 offline gate。

验证：

- 每条非 empty fixture 必须能生成可解释 path。
- blocked reason 必须可解释。
- authority leak count 必须为 0。
- `npm run eval:operating-signal-flow` 必须为绿。
- `npx vitest run lib/evals/operating-signal-flow-evals.test.ts` 必须为绿。
- `npm run check:boundaries` 必须继续为绿。

### Phase 2：Read-only fixture prototype

已交付：

- `lib/operating-signal-flow/contract.ts`：共享信号流合同类型与状态 / transition / allowed action 常量，并通过 fixture `entryPoints.happyPathCaseId` 明确 outcome 入口。
- `lib/operating-signal-flow/projection.ts`：fixture -> display model 的纯投影层、deterministic highest-pressure path selector、prototype posture selection 和三态 posture highlights；fixture entry point / required posture 缺失时必须显式失败，不静默降级。
- `lib/operating-signal-flow/projection.test.ts`：覆盖合同 fixture 到 display model、highest-pressure path 等价性、fixture entry point、required posture 和 unsafe route fallback。
- `features/internal-operating-workspace/operating-signal-flow-map.tsx`：`/operating` 第一屏主表达的 fixture-backed 只读 Signal Flow Map，并展示 fixture banner、empty / fixture / degraded posture layout 和条件 boundary。
- `features/internal-operating-workspace/operating-signal-flow-map.test.tsx`：覆盖 fixture model、中文首屏、fixture banner、三态 posture layout、boundary visible、review-only action。
- `app/globals.css`：新增 signal flow edge / node 动态 sweep；`data-posture="fixture"` 与 `data-animation-policy="disabled"` 时强制关闭 edge sweep，`prefers-reduced-motion` 仍由全局规则降级。
- `tests/e2e/operating-signal-flow-map.spec.ts`：浏览器实测 `/operating` fixture map 的静态 edge 动画契约、fixture banner、三态 posture layout 与只读 fixture boundary 文案。
- 现有 `BusinessFirstSurfaceSummary` 保留并下移到 Signal Flow Map 之后，作为经营摘要共生层。

验证：

- Playwright screenshot + visual overlap check。
- reduced-motion 检查。
- `typecheck / lint / targeted tests`。
- `npm run check:boundaries` 仍必须为绿，且 `operating_signal_flow_offline_eval_boundary` 必须允许该 fixture UI 但继续禁止 API / schema / runtime query / LLM call / type escape。

### Phase 2.2：Runtime readiness / eligibility gate

已交付：

- `evals/operating-signal-flow/runtime-readiness-review-cases.json`：8 条 readiness review bundle fixture，覆盖 all-pass、缺 executive sponsor approval、raw payload / raw identifier、runtime implementation bypass、cross-workspace、LLM final ranking、authority leak、expired / incomplete rollout plan。
- `lib/evals/operating-signal-flow-runtime-readiness-evals.ts`：离线 readiness evaluator，输出 deterministic digest、typed failures、`go / defer / no_go`。
- `lib/evals/operating-signal-flow-runtime-readiness-evals.test.ts`：覆盖 checked-in fixture、determinism、缺审批 defer、runtime bypass no-go、expected failure assertion、malformed JSON / invalid shape typed error。
- `scripts/operating-signal-flow-runtime-readiness-evals.ts` + `npm run eval:operating-signal-flow-runtime-readiness`。
- `scripts/decision-first-boundary-check.ts` 把 readiness gate 纳入 `operating_signal_flow_offline_eval_boundary`，并继续禁止 Prisma schema、API、runtime query、LLM SDK、env secret 和 type escape。

本阶段命名为 readiness / eligibility，不命名为 production approval。通过本 gate 只是进入下一层 review 的建议，不是承诺，也不是批准真实生产接入。

### Phase 2.3：Review-bundle intake screen

已交付：

- `evals/operating-signal-flow/runtime-readiness-bundle.sample.json`：单个 alias-only review bundle 输入样例。
- `lib/evals/operating-signal-flow-runtime-readiness-intake.ts`：离线 intake screen，覆盖 v1 schema、1 MiB byte cap、recursive depth cap、sensitive key / value scan、deterministic digest、sensitive fail digest withholding、`preflight`、`exitCode`、`wrappedPack`。
- `lib/evals/operating-signal-flow-runtime-readiness-intake.test.ts`：覆盖样例通过、top-level reorder determinism、`customerEmail` sensitive key、nested raw value pattern、preflight pass 但 readiness hold、malformed / oversized / unknown-key / over-depth input。
- `scripts/operating-signal-flow-runtime-readiness-intake.ts` + `npm run eval:operating-signal-flow-runtime-readiness-intake`。
- `scripts/decision-first-boundary-check.ts` 把 intake screen 纳入 `operating_signal_flow_offline_eval_boundary`，继续禁止 DB / env / network / provider SDK / LLM / API / schema / runtime query。

本阶段只把“未来 reviewer 提交的单个 redacted review bundle”变成可机器筛查的离线输入，不做 redaction，不保存输入，不引入 API，不读取 runtime query，不做 LLM 排序，也不批准真实生产接入。

### Phase 3：Runtime adoption review

进入条件：

- Phase 2.2 runtime readiness / eligibility gate 通过。
- Phase 2.3 review-bundle intake screen 对拟提交 bundle 返回 `preflight=pass`，且 readiness decision 为 `go`。
- redacted calibration sample 和 redacted snapshot projection 已过期前仍有效，且没有 revokedBy / revokedReason。
- Data Protection review evidence、5-role Required Reviewer approval、executive sponsor approval 顺序成立。
- production query rollout plan 已覆盖 shadow、canary、general-review、observability 和 rollback。

仍需保持：

- read-only
- review-first
- runtime shadow default-off
- `/operating` fixture UI unchanged until separate canary review
- internal readout helper remains pure projection only
- internal readout component remains disconnected from routes
- internal readout preview remains review-packet-only until a separate implementation plan is approved
- reviewer-only preview harness remains plan-only; next implementation may only use test-only DOM evidence unless a non-route browser preview mechanism is separately approved
- test-only DOM evidence harness remains disconnected from app routes and does not count as browser preview or runtime adoption
- DOM evidence review remains docs-only and does not unlock browser preview, route adoption, runtime tenant data, or production truth
- browser preview subsystem is not introduced now; next work returns to runtime adoption evidence inventory and blocker classification
- runtime adoption evidence inventory only permits internal shadow/canary review and pending-review drain; it does not unlock route adoption or fixture banner removal
- Phase 3N alias/count-only canary review only permits the next internal canary readout; it does not unlock route adoption, fixture banner removal, production query adoption, or role-level receipt bypass
- Phase 3N canary readout now pauses readout-only iteration and permits only Engineering / Product / Security / Operations per-role receipt collection next; it still does not unlock route adoption, fixture banner removal, production query adoption, or runtime UI adoption
- Codex shadow probe may be used as a Phase 1.5 day-2 Founder Loop dogfood proxy surface, but only as telemetry/readout evidence; it is not a route surface, production query source, or official write path
- Phase 3N per-role receipt routing has created approved-but-unexecuted ActionItems for Engineering, Product, Security, and Operations; the Security owner blocker is resolved by founder appointment of 李建乐, but the actual Security receipt content is still pending
- no auto-send
- no silent write
- no LLM final ranking

## 16. 四档状态

| 档位 | 当前判断 |
|---|---|
| 已完整成立 | 无。本文件不声明 API / schema / runtime / production query adoption 已成立；当前 UI 仍是 fixture-backed prototype |
| 已成形但仍需下一层 | Signal Flow Map 需求、第一观感原则、AI 工作姿态、状态机、动态规则、共享数据合同与纯投影层、实施计划、Phase 0/1 offline gate、15 条 fixture、offline evaluator、targeted Vitest、boundary guard、Phase 2 read-only fixture UI prototype、fixture animation-off guard、fixture banner、三态 posture layout、Phase 2.2 runtime readiness / eligibility gate、Phase 2.3 review-bundle intake screen、Phase 3A disabled-by-default runtime shadow adapter scaffold、Phase 3E internal shadow readout design、Phase 3F internal readout projection helper、Phase 3G fixture-only internal readout component contract、Phase 3H internal readout preview canary review packet、Phase 3I reviewer-only preview harness implementation plan、Phase 3J test-only DOM evidence harness、Phase 3K DOM evidence harness review packet、Phase 3L browser preview mechanism decision packet、Phase 3M runtime adoption evidence inventory、Phase 3N product advancement readout packet、Phase 3N alias/count-only canary review packet、Phase 3N canary readout packet、Phase 3N per-role receipt and dogfood proxy packet、Phase 3N per-role receipt routing readout packet、Phase 3N Security receipt owner appointment readout packet |
| 刻意未做 | 完整 BI 平台、完整 workflow / orchestration、Agent OS、自动执行、自动外发、自动审批、自动改 CRM、LLM final ranking |
| 风险项 | 过度动画掩盖业务判断、过度保守导致流动和 AI 感消失、AI 感被误解为自动执行、跨 workspace 信号聚合、raw payload 泄露、把技术健康误写成经营结论 |

## 17. 命名收敛

| 避免使用 | 使用 |
|---|---|
| control view | dynamic observation view / trace projection |
| pipeline engine | signal flow projection |
| Live | 当前窗口 |
| AI Work | AI 工作姿态 |
| Worker lane | AI 工作姿态 lane |
| must-push-ready | must_push_candidate |
| tenant scope | workspace scope |
| auto fix / re-sync / assign | jump to review / settings / capture |

## 18. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-21 | Phase 3N Security receipt owner appointment readout packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3N_SECURITY_RECEIPT_OWNER_APPOINTMENT_READOUT_PACKET.md`，按 founder 决策将 Security receipt owner / approver 指定为李建乐，appointment audit 为 `cmpfhhni800011yi9xx4bb2o6`；post-appointment shadow probe 为 single-workspace、boundary 0、pendingReviewCount 0、eventCount 116、digest `8d648366be0ec4f83aec33fa7952398099d60e03205eb9e69d404637c172a175`，继续禁止 route adoption、fixture banner removal、production default flag、schema/API、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3N per-role receipt routing readout packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3N_PER_ROLE_RECEIPT_ROUTING_READOUT_PACKET.md`，将四个 per-role receipt 收集动作落到 Helm reserved workspace 的 ActionItem / ApprovalTask / AuditLog 链路；Engineering 分派李健，Product 分派 Helm，Operations 分派周攀，Security 登记为 founder decision blocker；post-routing shadow probe 为 single-workspace、boundary 0、pendingReviewCount 0、eventCount 115、digest `ccbeda9bb5d37a1362a4a1aea79f30c1ff55c42a26bbe4edd11b2c721cb3218b`，继续禁止 route adoption、fixture banner removal、production default flag、schema/API、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3N per-role receipt and dogfood proxy packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3N_PER_ROLE_RECEIPT_AND_DOGFOOD_PROXY_PACKET.md`，暂停 readout-only iteration，明确下一步只收 Engineering / Product / Security / Operations 四个 per-role receipt；Codex post-closeout shadow probe 被登记为 Phase 1.5 day-2 Founder Loop dogfood proxy surface，当前 `boundaryCounter=0`、`pendingReviewCount=0`、eventCount 97、digest `5ae78c91ee0ece8d20386c7c8fe0eaaf51399e81a70d1e9210df2120e47bff97`；收齐四个 receipt 后才允许进入单独 route adoption review，继续禁止 fixture banner removal、production default flag、schema/API、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3N canary readout packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3N_CANARY_READOUT_PACKET.md`，完成下一轮 process-local canary probe、只读 audit drift 归因、已批准 canary ActionItem closeout 与 post-closeout baseline；当前 post-closeout probe 为 single-workspace、boundary 0、pendingReviewCount 0、eventCount 97、digest `5ae78c91ee0ece8d20386c7c8fe0eaaf51399e81a70d1e9210df2120e47bff97`；结论只允许 role-level receipt reference inventory，继续禁止 `/operating` route adoption、fixture banner removal、schema/API、production query adoption、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3N alias/count-only canary review packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3N_ALIAS_COUNT_ONLY_CANARY_REVIEW_PACKET.md`，把下一轮 internal canary 收进 Helm ActionItem / ApprovalTask / AuditLog 审批链，并记录最新 process-local shadow probe：single-workspace、boundary 0、pendingReviewCount 0、eventCount 94、digest `042e2fe19467e3e638e542145e069ca2de67d8c8d4f2a2df89f6b3ac766b411a`；结论只允许下一轮 internal canary readout，继续禁止 `/operating` route adoption、fixture banner removal、schema/API、production query adoption、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3N product advancement readout packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3N_PRODUCT_ADVANCEMENT_READOUT_PACKET.md`，把 Phase 3M 后续产品推进闭环收成 Helm reserved workspace 内的 review-first ActionItem / ApprovalTask / AuditLog 证据，并记录最新 process-local shadow probe：single-workspace、boundary 0、pendingReviewCount 0、eventCount 89、digest `1dfd6a1d1d7efe2fb32c03de0aac551197e40c714335140113f7e7333b479e3f`；结论只允许 internal canary/readout design，继续禁止 route/page adoption、fixture banner removal、schema/API、production query adoption、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3M runtime adoption evidence inventory 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3M_RUNTIME_ADOPTION_EVIDENCE_INVENTORY.md`，盘点 5-role founder attestation、DPO approval、Phase 2.3 intake go、readiness suite、disabled shadow adapter、Phase 3C/3D shadow rehearsal 与最新 process-local shadow probe；当前 probe 为 single-workspace、boundary 0、pendingReviewCount 2，结论只允许 internal shadow/canary review 和 pending-review drain，继续禁止 `/operating` route adoption、fixture banner removal、schema/API、production query adoption、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3L browser preview mechanism decision packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3L_BROWSER_PREVIEW_MECHANISM_DECISION_PACKET.md`，决定当前不引入 Storybook、hidden route、自定义 browser preview runtime 或 Playwright screenshot coverage；保留 Phase 3J test-only DOM evidence 为当前未接路由组件合同证据，并把下一步切回 runtime adoption evidence inventory：5-role signoff、DPO evidence、redacted calibration bundle、production rollout / rollback、single-workspace scope 与 fixture banner 边界；继续禁止 route/page adoption、runtime tenant data、schema/API、official write、自动执行、自动外发或 LLM final ranking |
| 2026-05-21 | Phase 3K DOM evidence harness review packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3K_DOM_EVIDENCE_HARNESS_REVIEW_PACKET.md`，复核 Phase 3J test-only DOM evidence 只足以证明 internal readout component 的 route-disconnected DOM contract regression，不足以解锁 browser screenshot、route/page adoption、runtime tenant data、schema/API、production query 或 official write；结论只条件批准下一步 Phase 3L browser preview mechanism decision packet，继续禁止 Storybook、hidden route、`/operating` adoption、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3J test-only DOM evidence harness 落地：新增 `features/internal-operating-workspace/operating-signal-flow-internal-readout.preview.test.tsx` 与 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3J_TEST_ONLY_DOM_EVIDENCE_HARNESS_CLOSEOUT.md`，用 jsdom / Testing Library 覆盖中英文状态、boundary-blocked stop routing、guard attributes、无交互控件、无 raw 字段回显；`scripts/decision-first-boundary-check.ts` 只增加精确测试文件 allowlist；route import scan 证明 `app/` 与 `/operating` 未引用；继续禁止 Storybook、hidden route、browser screenshot harness、route/page adoption、runtime tenant data、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3I reviewer-only preview harness implementation plan 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3I_REVIEWER_ONLY_PREVIEW_HARNESS_IMPLEMENTATION_PLAN.md`，复核仓库无 Storybook、Playwright 当前只验证 app route、Phase 3G 组件唯一已证明的非路由渲染路径是 Vitest + Testing Library；结论只条件批准下一步 test-only DOM evidence harness，继续禁止 Storybook、hidden route、browser screenshot harness、route/page adoption、runtime tenant data、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3H internal readout preview canary review packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3H_INTERNAL_READOUT_PREVIEW_CANARY_REVIEW_PACKET.md`，把 Phase 3G 未接路由的内部读数组件推进到 reviewer-only preview 前的评审包，固定 review questions、DOM / screenshot / interaction / route-import evidence、boundary-blocked evidence 和 rollback criteria；结论只批准下一步 reviewer-only preview harness implementation plan，继续禁止 preview harness 直接实现、route/page adoption、runtime tenant data、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3G internal readout component contract 落地：新增 `features/internal-operating-workspace/operating-signal-flow-internal-readout.tsx`、`features/internal-operating-workspace/operating-signal-flow-internal-readout.test.tsx` 与 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3G_INTERNAL_READOUT_COMPONENT_CONTRACT_REPORT.md`；组件只吃 Phase 3F helper 输出，显示 state、decision、owner routing、counts、safe / forbidden field families 与 adoption guards，无按钮、无链接、无 runtime query、无 raw 字段回显；继续禁止 route/page adoption、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3F internal readout projection helper 落地：新增 `lib/operating-signal-flow/internal-shadow-readout.ts`、`lib/operating-signal-flow/internal-shadow-readout.test.ts` 与 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3F_INTERNAL_READOUT_PROJECTION_HELPER_REPORT.md`，将 Phase 3E internal-only readout contract 落成纯投影 helper；只吃已脱敏 shadow result / diagnostics，输出 state、scope、volume、risk、quality、drift、decision 与 owner routing；targeted tests 覆盖 flag-off、allowlist miss、clean、drift、boundary blocked、cross-workspace、degraded、expired 与 raw 字段不回显；继续禁止 route/page adoption、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3E internal shadow readout design 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3E_INTERNAL_SHADOW_READOUT_DESIGN.md`，把 Phase 3C / 3D / 3E 的只读 shadow probe 证据收成 internal-only readout contract；允许展示 state、scope、volume、risk、quality、drift、reviewer decision 等安全字段，定义 `shadow_disabled` / `shadow_ready_clean` / `shadow_ready_drift_review` / `shadow_boundary_blocked` / `shadow_degraded` 等复核状态与 owner routing；结论只允许 pure internal readout projection contract，继续禁止 route/page adoption、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3D canary review packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3D_CANARY_REVIEW_PACKET.md`，对 Phase 3C / Phase 3D 两次只读 shadow probe 做 drift comparison；第二次仍为 single-workspace、boundary counter 0，事件数从 38 到 42 的漂移来自经营闭环新增 action / approval / audit receipt。结论只允许 internal readout design；继续禁止 `/operating` runtime UI adoption、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3C shadow window review packet 落地：新增 `docs/reviews/HELM_OPERATING_SIGNAL_FLOW_PHASE3C_SHADOW_WINDOW_REVIEW_PACKET.md`，记录一次 process-local flag + allowlist 的只读 shadow rehearsal；默认 flag-off 返回 disabled，开启 shadow probe 后得到单 workspace / alias-count-only 的 `current_window` candidate（38 events、0 boundary counter、trace presence count 13）。结论只允许 canary packet preparation；继续禁止 `/operating` runtime UI adoption、schema/API、production default query、official write、自动执行、自动外发、移除 fixture banner 或 LLM final ranking |
| 2026-05-21 | Phase 3A disabled runtime shadow adapter scaffold 落地：新增 `lib/operating-signal-flow/runtime-shadow-adapter.ts`、`lib/operating-signal-flow/runtime-shadow-adapter.test.ts`，并在 `lib/feature-flags.ts` 增加 `OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ENABLED` / `OPERATING_SIGNAL_FLOW_RUNTIME_SHADOW_ALLOWLIST`。adapter 默认关闭，只在 allowlist 命中时读取单 workspace 的 `ActionItem` / `ApprovalTask` / `AuditLog` 窄字段，生成 `dataPosture=current_window` 的后台 shadow candidate；`/operating` 仍显示 fixture banner，不接 API/schema/UI adoption/official write/自动执行/自动外发/LLM final ranking |
| 2026-05-18 | Phase 2 UI contract 收口：display model 改为从 fixture posture 选出 prototype snapshot，新增 fixture banner、empty / fixture / degraded posture highlight layout、`data-animation-policy` 动画闸口和 required posture fail-loudly 测试；继续保持 fixture-backed read-only，不授权 API/schema/runtime query/production query adoption/official write/自动执行/自动外发/LLM final ranking |
| 2026-05-17 | Phase 2 audit hardening：fixture posture 下 UI edge 动效强制关闭；authority forbidden fragments 与 sensitive value patterns 收到 `lib/shared/` 单源；offline evaluator 补 boolean authority true 与英文 judgement headline；runtime readiness evaluator 补 bearer / API key raw value pattern；fixture happy path 改由 metadata entry point 驱动；新增浏览器 e2e 检查 fixture map 静态 edge |
| 2026-05-17 | Phase 2.3 review-bundle intake screen 落地：新增 `evals/operating-signal-flow/runtime-readiness-bundle.sample.json`、`lib/evals/operating-signal-flow-runtime-readiness-intake.ts`、`lib/evals/operating-signal-flow-runtime-readiness-intake.test.ts`、`scripts/operating-signal-flow-runtime-readiness-intake.ts` 和 `npm run eval:operating-signal-flow-runtime-readiness-intake`；吸收 Claude 复核，固定 `operating-signal-flow-sensitive-rules.v1`、1 MiB byte cap、recursive depth cap、deterministic output、`preflight` 与 `0 / 2 / 3 / 64` exit code matrix；该 screen 只检测 unredacted sensitive content 与 readiness shape，不 redaction、不修改输入、不批准生产、不授权 API/schema/runtime query/production query adoption/official write/自动执行/自动外发/LLM final ranking |
| 2026-05-17 | Phase 2.2 runtime readiness / eligibility gate 落地：新增 `evals/operating-signal-flow/runtime-readiness-review-cases.json`、`lib/evals/operating-signal-flow-runtime-readiness-evals.ts`、`lib/evals/operating-signal-flow-runtime-readiness-evals.test.ts`、`scripts/operating-signal-flow-runtime-readiness-evals.ts` 和 `npm run eval:operating-signal-flow-runtime-readiness`；吸收 Claude 复核，把真实接入前置为必要但不充分的 review bundle gate，要求 redacted calibration sample、Data Protection review、5-role Required Reviewer approval、executive sponsor approval、production query rollout plan、expiry / revocation、single-workspace projection 和 static boundary guard；继续禁止 API/schema/runtime query/production query import/official write/自动执行/自动外发/LLM final ranking |
| 2026-05-17 | Phase 2.1 共享合同与纯投影层落地：新增 `lib/operating-signal-flow/contract.ts`、`lib/operating-signal-flow/projection.ts`、`lib/operating-signal-flow/projection.test.ts`，UI 与 eval 复用同一 fixture、状态常量、allowed action 常量与 highest-pressure path selector；继续禁止 API/schema/runtime query/production query adoption/official write/自动执行/LLM final ranking |
| 2026-05-17 | Phase 2 read-only fixture prototype 落地：新增 `/operating` 第一屏 Signal Flow Map 组件、CSS 动态流线、render test，并把原 BusinessFirstSummary 下移为共生层；仍不接真实 query、不加 API/schema/runtime、不启用 LLM call、official write、自动执行或自动外发 |
| 2026-05-17 | Phase 0/1 offline gate 落地：新增 `evals/operating-signal-flow/signal-flow-cases.json`、`lib/evals/operating-signal-flow-evals.ts`、`lib/evals/operating-signal-flow-evals.test.ts`、`scripts/operating-signal-flow-evals.ts` 和 `npm run eval:operating-signal-flow`；新增 boundary guard 防止 eval type / runtime 逃逸；仍不授权 schema / runtime / API / UI / production query adoption / LLM call / official write |
| 2026-05-17 | Claude 5 轮需求评审后修订：确认 Signal Flow Map 作为 `/operating` 第一屏主表达、定义 `OperatingSignalEvent` 原子、确定 highest-pressure path 算法；补充第一观感、三态首屏、AI 工作姿态、transition 表、动态降级、数据合同、Inspector 排序、回放安全和 Phase 0 禁区 |
| 2026-05-17 | 首版：把管理者观察 Helm AI 运作的动态经营信号流图落成需求与设计合同，保持 docs / design only，不授权 runtime / schema / API / UI 实现 |
