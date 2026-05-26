---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 主动进化系统代码评审标准

## 文档目的

本文件用于统一“经营分身控制台”主动进化系统（Adaptive Evolution System）相关开发的代码评审标准。

评审目标有五个：

1. 确保系统的“进化”建立在真实增量变化之上
2. 确保这种进化增强 recommendation 和策略建议，而不是制造黑盒感
3. 确保进化过程可审计、可解释、可确认、可撤销
4. 确保主动进化系统没有越权改变关键策略和高风险行为
5. 确保页面能让用户感知系统在变得更懂自己

---

## 一、评审总原则

每次评审主动进化系统相关改动时，先回答下面 7 个问题：

1. 这次改动是否真的让系统从“记录变化”走向“理解变化”？
2. 这次改动是否把事件、模式、策略建议三层分清了？
3. 这次改动是否让 recommendation 更贴近用户和团队的真实风格？
4. 这次改动是否没有越过审批、策略和控制边界？
5. 这次改动是否让系统学到的东西对用户可见？
6. 这次改动是否有足够审计与事件记录？
7. 这次改动是否没有把产品变成更黑盒的自动化系统？

如果其中 2 项以上回答为“否”或“不确定”，应要求修改。

---

## 二、产品方向评审

### 2.1 主动进化系统的正确定位

主动进化系统不是：
1. 自动替用户改规则
2. 自动变更高风险策略
3. 用复杂模型替代产品判断
4. 做成“AI 自己优化自己”的黑盒

主动进化系统应该是：
1. 识别增量变化
2. 检测稳定模式
3. 形成 PatternFact 和 StrategySuggestion
4. 用这些信号增强 recommendation 与提醒
5. 把“系统学到了什么”显性展示给用户

### 2.2 方向偏移红线

以下情况应判为方向偏移：

1. 系统会默默改高风险策略
2. 系统在没有用户确认的情况下扩大自动执行范围
3. 系统学到了什么无法解释
4. recommendation 因“学习”而更不可控
5. 用户感知不到系统在进化，只有后台多了几张表

---

## 三、数据模型评审

### 3.1 DeltaEvent

必须检查：

1. 是否真的是增量事件，而不是原始日志复制
2. eventType 是否有明确业务语义
3. payload 是否足够支撑模式检测
4. importance 是否有意义
5. objectType / objectId 是否清楚
6. 是否覆盖 recommendation、审批、机会、承诺、阻碍、记忆修正、策略变化等关键来源

不合格情形：
1. DeltaEvent 和 EventLog 高度重复但无新抽象
2. eventType 模糊不清
3. payload 无法支持模式识别

### 3.2 PatternFact

必须检查：

1. patternType 是否能表达业务规律
2. patternKey / patternValue 是否清晰
3. confidence 是否有依据
4. evidenceCount 是否真实
5. status 是否合理
6. scopeType / scopeId 是否清楚

不合格情形：
1. PatternFact 只是在重复描述单次事件
2. PatternFact 没有证据支撑
3. PatternFact 无法被 recommendation 或页面消费

### 3.3 StrategySuggestion

必须检查：

1. targetPolicyKey 是否明确
2. currentValue / suggestedValue 是否能直接用于用户理解
3. reason 是否清楚
4. confidence 是否合理
5. status 流转是否完整
6. 被接受后是否有真正影响

不合格情形：
1. suggestion 太泛，用户无法操作
2. 接受 suggestion 后没有实际系统变化
3. 策略建议没有审计记录

---

## 四、事件来源与模式检测评审

### 4.1 事件来源

必须检查：
1. RecommendationFeedback 是否正确映射为 DeltaEvent
2. ApprovalTask 状态变化是否进入 DeltaEvent
3. Opportunity 阶段变化是否进入 DeltaEvent
4. Commitment 逾期 / 完成是否进入 DeltaEvent
5. Blocker 创建 / 解决是否进入 DeltaEvent
6. MemoryCorrection 是否进入 DeltaEvent
7. PolicyRule 修改是否进入 DeltaEvent

### 4.2 模式检测

第一阶段建议的模式检测至少包括：

1. approval_pattern
2. communication_style_pattern
3. blocker_pattern
4. stalled_opportunity_pattern
5. followup_timing_pattern

必须检查：
1. 模式检测规则是否明确
2. 是否有最小证据阈值
3. 是否区分一次性事件和稳定模式
4. 是否避免过度敏感
5. pattern 产出是否能被 recommendation 消费

不合格情形：
1. 一两次事件就生成模式
2. 模式过多但无实际用途
3. recommendation 没有真正引用 PatternFact

---

## 五、与 Recommendation Engine 的集成评审

主动进化系统真正有价值，关键在于它是否改变了 recommendation 的质量。

必须检查：

1. recommendation 是否消费 PreferenceSignal
2. recommendation 是否消费 PatternFact
3. personalization 是否因这些信号更合理
4. explanation 是否能体现 learned pattern
5. policyResult 是否仍由策略逻辑控制

特别注意：
- 主动进化系统不能替代 recommendation engine
- 它只能增强 recommendation engine 的输入

不合格情形：
1. 新增了主动进化层，但 recommendation 结果完全不变
2. 只有 explanation 文案提到“系统学到了什么”，排序并未真正变化
3. recommendation 因 pattern 引入后变得更不稳定

---

## 六、页面感知评审

### 6.1 首页

必须检查：
1. 是否出现“系统最近学到了什么”
2. 展示是否简洁可读
3. 这些内容是否真的来自 PatternFact / PreferenceSignal
4. 是否不会干扰首页主任务

### 6.2 设置与策略页

必须检查：
1. 是否展示可操作的策略建议
2. 用户是否能接受或忽略
3. 当前值与建议值是否清晰
4. 接受后系统是否真实变化

### 6.3 周报

必须检查：
1. 是否有“系统观察到的新规律”
2. 是否对管理者有价值
3. 内容是否像经营观察，而不是日志摘要

### 6.4 审批中心

必须检查：
1. explanation 中是否出现个性化提示
2. 提示是否建立在真实模式上
3. 是否增强信任，而不是增加噪音

不合格情形：
1. 页面里只是多了几段口号式文案
2. 用户无法理解这些“学习结果”有什么用
3. 没有入口看这些变化会如何影响系统行为

---

## 七、策略边界评审

这是主动进化系统最重要的安全边界。

必须检查：

1. 系统是否会自动改变高风险策略
2. 系统是否会自动放宽审批要求
3. 系统是否会自动增加自动执行范围
4. 系统是否只提供策略建议，而不是偷偷修改规则

明确要求：
- 高风险策略必须人工确认
- StrategySuggestion 只是建议，不是强制变更
- 被接受或忽略都要有 AuditLog

只要发现系统会自行改变高风险策略，应直接判定失败。

---

## 八、审计与埋点评审

### 8.1 AuditLog

必须检查：
1. PatternFact 创建
2. StrategySuggestion 创建
3. StrategySuggestion 被接受
4. StrategySuggestion 被忽略
5. PreferenceSignal 更新

### 8.2 EventLog

建议检查：
1. delta_event_created
2. pattern_detected
3. strategy_suggestion_created
4. strategy_suggestion_accepted
5. strategy_suggestion_dismissed
6. evolution_insight_viewed

### 8.3 不合格情形

1. 页面展示系统学到了什么，但后台无日志
2. 用户接受策略建议后没有审计
3. 无法回溯某个 pattern 是怎么来的

---

## 九、验收路径评审

每次主动进化相关改动后，至少验证以下 6 条路径：

### 路径 A：反馈生成 DeltaEvent
1. recommendation 被批准
2. DeltaEvent 入库
3. EventLog / AuditLog 正确记录

### 路径 B：模式检测
1. 连续多次编辑后批准某类动作
2. 生成 PatternFact
3. confidence / evidenceCount 合理

### 路径 C：推荐增强
1. recommendation explanation 中出现 learned pattern
2. personalization 发生合理变化
3. 排序或 explanation 更贴近用户风格

### 路径 D：首页 insights
1. 首页出现“系统最近学到了什么”
2. 内容来源真实
3. 用户可感知但不干扰主任务

### 路径 E：策略建议
1. 生成 StrategySuggestion
2. 在设置页可见
3. 用户接受或忽略
4. 接受后系统有真实变化
5. 审计完整

### 路径 F：周报
1. 周报中出现“系统观察到的新规律”
2. 内容对管理者有决策价值

---

## 十、代码质量评审

必须检查：

1. 事件映射逻辑是否集中封装
2. 模式检测逻辑是否集中封装
3. 不同 pattern rule 是否组织清楚
4. 是否避免把模式检测写进页面或 recommendation 页面逻辑
5. PreferenceSignal 更新是否集中
6. StrategySuggestion 状态流转是否清晰
7. 注释是否足够解释 pattern 规则

---

## 十一、评审结论模板

每次评审建议按以下结构输出：

### 1. 总体结论
一句话说明本轮主动进化系统改动是否可以合并。

### 2. 做得好的地方
列出 2 到 5 个最有价值的点。

### 3. 必须修改的问题
重点写：
- 模式检测不稳
- recommendation 没真正增强
- 边界越权
- 页面感知不到价值
- 审计不完整

### 4. 建议优化的问题
写那些能提升长期价值的点。

### 5. 验证情况
列出验证的路径。

### 6. 风险提醒
指出后续主动进化系统扩展时最容易出问题的地方。

---

## 十二、合并门槛

以下情况可以合并：

1. DeltaEvent 成立
2. 至少 3 类 PatternFact 成立
3. recommendation 可消费 PatternFact / PreferenceSignal
4. 首页 insights 可见
5. 策略建议可见、可操作
6. 审计完整

以下情况不应合并：

1. 只是多了表，没有用户感知
2. 模式检测无实际业务意义
3. recommendation 没有真正增强
4. 系统会自动越权改策略
5. 无法解释 pattern 的来源
6. 审计缺失

---

## 十三、最后提醒

主动进化系统评审时最重要的一句话是：

**这次改动，是否让系统更像一个“会从变化中学习、但仍然在用户控制下进化”的经营分身，而不是更像一个“偷偷自我改写规则的黑盒系统”？**

如果答案不明确，这轮改动就还不够好。
