---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 智能化总路线图

## 文档目的

本文件用于把“经营推进控制台”的五条核心智能化建设路线统一成一份总路线图。

这六条线分别是：

1. CRM / System of Record 接入层（CRM-first Migration Layer）
2. 会话捕获层（Conversation Capture）
3. 记忆系统（Memory System）
4. 推荐引擎（Recommendation Engine）
5. LLM 接入层（LLM Integration）
6. 主动进化系统（Adaptive Evolution System）

本文件回答四个问题：

1. 这五条线分别解决什么问题
2. 它们之间是什么依赖关系
3. 当前阶段应该先做什么、后做什么
4. 如何把它们合并成一条清晰的产品智能化演进路线

---

## 一、总判断

经营推进控制台的智能化，不应该被理解为“不断加更多 AI 功能”。

它应该被理解为一条逐层抬升的能力链：

### 第一层：记住
系统能把真实工作流中的高价值数据沉淀成结构化记忆。

### 第二层：判断
系统能基于记忆和上下文给出 recommendation、briefing 和 next best action。

### 第三层：行动
系统能在规则内推动动作发生，并完成审批、执行、审计闭环。

### 第四层：进化
系统能从增量变化中识别模式，调整优先级、偏好和策略建议。

在这四层之前，还必须先有一个高频、真实、现场发生的数据入口层。

**CRM-first 接入层负责把 HubSpot / Salesforce 里的对象与活动接进系统；会话捕获层负责把现场交流接进系统；记忆负责沉淀；推荐负责判断；LLM 负责增强；进化负责复利。**

## -1. CRM / System of Record 接入层
### 核心职责
1. 把 HubSpot / Salesforce 的对象层和关系层接进 Helm
2. 不替换 CRM，而是在其之上快速长出 intelligence layer
3. 导入后立刻触发 today focus、blocker、commitment、recommendation 的 warmup
4. 作为 Memory System 之前的高价值历史数据入口层

### 关键对象
- ImportSource
- ImportJob
- ImportItem
- IdentityMatch
- Contact / Company / Opportunity / Meeting 的 external mapping 字段

### 它不负责
- 双向同步
- 全对象覆盖
- 替换客户 CRM
- 直接决定 recommendation 排序

### 它与记忆系统的关系
CRM-first 接入层是 Memory System 的高质量历史输入层，解决“客户已经有 CRM，但 Helm 还没有上下文”的冷启动问题。

---

## 二、五条线的职责边界

## 0. 会话捕获层
### 核心职责
1. 成为高频、真实、现场发生的数据入口
2. 把 transcript 转成可消费的会话理解结果
3. 把会话结果写回 Meeting / Memory / Recommendation / Approval
4. 让系统在“重要交流发生时就在场”

### 关键对象
- CaptureSession
- ConversationTranscript
- ConversationInsight

### 它不负责
- 最终排序
- 最终策略决策
- 越权执行动作
- 独立成为录音工具

### 它与记忆系统的关系
Conversation Capture 不是记忆系统的替代品，而是 Memory System 的高质量实时输入层。
它提供比手工补录更高频、更贴近真实语义的输入，尤其适合沉淀：
- 事实
- 承诺
- 阻碍
- 风险信号
- next best action 线索

## 1. 记忆系统
### 核心职责
1. 沉淀事实
2. 沉淀承诺
3. 沉淀阻碍
4. 沉淀纠错和确认
5. 为 recommendation 和 briefing 提供上下文

### 关键对象
- MemoryFact
- Commitment
- Blocker
- MemoryCorrection
- BriefingSnapshot

### 它不负责
- 最终排序
- 自动执行
- 自主学习策略
- 模型 provider 管理

---

## 2. 推荐引擎
### 核心职责
1. 召回候选动作
2. 排序
3. 生成 next best action
4. 输出 today focus
5. 形成 explanation 和反馈闭环

### 关键对象
- RecommendationLog
- RecommendationFeedback
- PreferenceSignal
- Ranking scores
- PolicyResult

### 它依赖
- 记忆系统提供的结构化上下文
- 策略系统提供的边界
- 主动进化系统提供的偏好和模式信号
- LLM 层提供的 explanation 增强

---

## 3. LLM 接入层
### 核心职责
1. 结构化抽取
2. briefing 生成
3. explanation 生成
4. 提供多 provider 和可替换模型接入
5. 为产品提供统一模型网关

### 关键对象
- Provider registry
- Model router
- Prompt registry
- Context builders
- Tool bus
- LLMCallLog

### 它不负责
- 最终业务排序
- 最终策略决策
- 越权动作执行

---

## 4. 主动进化系统
### 核心职责
1. 识别增量变化
2. 抽取稳定模式
3. 更新 PreferenceSignal / PatternFact
4. 生成 StrategySuggestion
5. 把“系统学到了什么”显性化

### 关键对象
- DeltaEvent
- PatternFact
- StrategySuggestion
- Evolution insights

### 它依赖
- 记忆系统中的对象变化
- recommendation 的反馈
- 审批与策略变化
- LLM 和 recommendation 产生的行为结果

---

## 三、五条线的依赖关系

推荐依赖顺序如下：

### 第 0 步：先有高频数据入口
没有会话捕获层，系统对大量关键经营信息只能依赖事后补录，记忆质量和时效都会明显下降。

### 第 1 步：再有记忆
没有记忆系统，recommendation 只能靠浅层规则，系统也不会越来越懂用户。

### 第 2 步：再有 recommendation
没有 recommendation，记忆只是存档，无法形成经营判断。

### 第 3 步：再引入 LLM
LLM 不是起点，而是增强层。
它让 extraction、briefing、explanation 变强，但不替代记忆和 recommendation 的基础逻辑。

### 第 4 步：最后补主动进化
主动进化必须建立在前面三层已经稳定工作之上。
否则只会把噪音当信号。

可以用一句话概括：

**会话捕获提供入口，记忆提供燃料，推荐提供判断，LLM 提供增强，进化提供复利。**

---

## 四、当前阶段判断

从你们现在的推进情况来看，整体已经进入：

### 阶段 A：基础智能闭环即将成型
你们已经具备：
1. 产品前台
2. 审批与策略
3. recommendation 第二阶段
4. 记忆系统文档和实施路径
5. LLM 接入架构文档
6. 主动进化系统文档

说明方向已经很清楚，下一步重点不在“想法”，而在“把几条线按正确顺序真正落地”。

---

## 五、推荐总路线图

## 阶段 0：Conversation Capture Entry
### 目标
让系统拥有一个真实、高频、带现场感的数据入口层。

### 必须完成
1. 开始记录入口
2. CaptureSession / Transcript / Insight 数据结构
3. transcript → facts / commitments / blockers / risks / next actions
4. 结果回写 Meeting / Memory / Recommendation / Approval
5. 首页和对象页能感知“系统刚刚识别到什么”

### 完成标志
1. 用户能从首页和对象页直接开始记录
2. transcript 不会停在摘要页，而会继续进入经营闭环
3. 会话结果能增强记忆和 recommendation
4. demo 中能明显看出“系统就在现场”

---

## 阶段 1：Memory First
### 目标
让系统能把真实工作流沉淀成“对象级工作记忆”。

### 必须完成
1. Meeting import → MemoryFact / Commitment / Blocker
2. Contact / Company / Opportunity / Meeting 页面展示记忆
3. MemoryCorrection
4. BriefingSnapshot 基础能力
5. 记忆页四个 tab

### 完成标志
1. 页面上能看见真实记忆
2. 会前 briefing 有依据
3. recommendation 能引用 facts / commitments / blockers
4. 用户可以修正记忆

---

## 阶段 2：Recommendation Strong
### 目标
让系统推荐更像判断，而不只是提示。

### 必须完成
1. RecommendationLog / Feedback
2. 候选动作召回
3. 排序分数
4. explanation 链
5. today focus 排序
6. feedback 闭环

### 完成标志
1. 首页能讲清“今天最重要的三件事”
2. 机会页 recommendation 有依据链
3. 联系人页 recommendation 贴近关系阶段
4. 审批后 recommendation 会留下反馈

---

## 阶段 3：LLM Augmented
### 目标
让产品在不失控的前提下，真正变得更像“有理解力的经营分身”。

### 必须完成
1. provider interface
2. model router
3. context builders
4. meeting import 的结构化提取
5. briefing generation
6. recommendation explanation 增强
7. LLMCallLog

### 完成标志
1. 会议纪要提取更强
2. briefing 更像高质量助理准备的简报
3. explanation 更自然、更可信
4. 失败不会破坏主流程

---

## 阶段 4：Adaptive Evolution
### 目标
让系统能从每天新增的变化中不断变得更懂用户和团队。

### 必须完成
1. DeltaEvent
2. PatternFact
3. StrategySuggestion
4. PreferenceSignal 强化
5. 首页“系统最近学到了什么”
6. 周报“系统观察到的新规律”

### 完成标志
1. recommendation explanation 开始引用 learned pattern
2. 首页能明显感知系统在学
3. 策略中心可看到系统建议
4. 用户仍然掌握控制权

---

## 六、阶段间的交付标准

## 阶段 1 完成后
可以做：
- 内部演示
- 记忆系统人工验收
- 初步试点前准备

不建议做：
- 大规模用户试点
- 真正依赖模型增强的外部演示

## 阶段 2 完成后
可以做：
- 推荐质量人工验收
- 小范围设计合作伙伴演示
- recommendation 数据闭环验证

## 阶段 3 完成后
可以做：
- “系统真的更智能”的外部演示
- 接真实 Gmail / 会议纪要 / briefing 场景
- 跑小规模真实数据验证

## 阶段 4 完成后
可以做：
- 强调“越用越懂你”的产品叙事
- 跑更长期试点
- 向更高粘度和更高自动化过渡

---

## 七、并行与串行关系

四条线不是完全串行，但也不能完全并行乱做。

### 可以并行推进的
1. Memory System 与 Recommendation Engine
2. LLM Integration 与 页面 explanation 改造
3. Adaptive Evolution 的数据模型与日志层

### 必须串行推进的
1. 没有 Memory，不要强上 Adaptive Evolution
2. 没有 Recommendation Feedback，不要强上 Pattern Learning
3. 没有稳定 Context Builder，不要让 LLM 深度介入 recommendation 核心排序
4. 没有审计和策略边界，不要扩大自动执行

---

## 八、接下来 90 天建议节奏

### 第 1 段，先把链路打通
优先：
1. 记忆系统阶段 3-5
2. recommendation 第二阶段验收
3. 首页与对象页 AI 感改造

### 第 2 段，引入 LLM
优先：
1. meeting import extraction
2. briefing generation
3. recommendation explanation enhancement
4. LLMCallLog

### 第 3 段，开始真实试跑
优先：
1. 一个销售团队
2. 一个猎头团队
3. 真实 Gmail + 真实会议纪要
4. recommendation 和记忆质量人工验收

### 第 4 段，再补主动进化
优先：
1. DeltaEvent
2. PatternFact
3. StrategySuggestion
4. 首页 evolution insights

---

## 九、最重要的产品判断

整个路线图里，最需要反复提醒团队的不是“还缺哪些模块”，而是：

### 1. 先让系统会记住真正重要的东西
这对应记忆系统。

### 2. 再让系统给出可信的下一步判断
这对应推荐引擎。

### 3. 再让系统用模型把判断表达得更强
这对应 LLM 接入。

### 4. 最后才让系统根据增量变化主动进化
这对应主动进化系统。

如果顺序反了，产品很容易看起来很聪明，但不稳定、不可信、不可控。

---

## 十、目录归位建议

基于你现在的文档结构，我建议新增：

```text
docs
├── llm
│   ├── llm-integration-architecture.md
│   ├── llm-integration-implementation.md
│   ├── llm-integration-code-review.md
│   └── llm-integration-seed-scenarios.md
├── evolution
│   ├── adaptive-evolution-system-design.md
│   ├── adaptive-evolution-system-implementation.md
│   ├── adaptive-evolution-system-code-review.md
│   └── adaptive-evolution-system-seed-scenarios.md
```

同时在 `docs/README.md` 增加：
1. llm
2. evolution
3. intelligence roadmap

本文件建议放在：

```text
docs/product/intelligence-roadmap.md
```

因为它本质上是产品总控地图，而不是某个子系统文档。

---

## 十一、最终结论

这四条线最终不是四个独立项目，而是一套完整智能系统的四个层次：

1. 记忆，让系统知道发生了什么  
2. 推荐，让系统知道现在最该做什么  
3. LLM，让系统更强地理解和表达  
4. 进化，让系统越来越懂用户和团队  

真正高价值的，不是任何一条线单独做得多复杂，而是它们能不能在产品里形成一个统一的、可控的、可演进的经营分身控制层。

如果这个总路线图清楚了，后面你和 Codex 推进时，优先级就会稳定很多，团队也不容易再散开。
