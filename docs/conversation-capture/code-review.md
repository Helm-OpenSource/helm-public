---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Conversation Capture 评审标准

## 文档目的

本文件用于统一“经营分身控制台”Conversation Capture System 相关开发的评审标准。

评审目标有五个：

1. 确保交流捕获层不是一个独立录音工具，而是真正回到经营和管理闭环
2. 确保前台交互简洁，后台 AI 处理强
3. 确保 transcript → insights → memory → recommendation → approval 链成立
4. 确保合规、授权、审计边界清楚
5. 确保产品体验有“现场感”，而不是事后上传和整理感

---

## 一、评审总原则

每次评审 Conversation Capture System 相关改动时，先回答下面 7 个问题：

1. 这次改动是否让产品更像“现场中的经营分身”？
2. 这次改动是否保持了前台足够简单？
3. 这次改动是否把复杂 AI 处理放到了后台？
4. 这次改动是否真能把会话内容转成经营对象和推进动作？
5. 这次改动是否没有把产品做成独立录音工具？
6. 这次改动是否遵守了可控、可审计、可回退的边界？
7. 这次改动是否能明显增强记忆和 recommendation？

如果其中 2 项以上回答为“否”或“不确定”，应要求修改。

---

## 二、产品方向评审

### 2.1 正确定位

Conversation Capture System 的定位应是：

1. 经营分身的现场入口
2. 一个高频、真实、现场发生的数据采集层
3. 一条从会话到记忆、再到 recommendation 和审批的闭环

它不应被做成：
1. 普通录音工具
2. 上传文件工具
3. 只会转写和摘要的 AI 助手
4. 与主产品对象脱节的子系统

### 2.2 方向偏移红线

以下情况应判为方向偏移：

1. 页面重点变成录音管理，而不是经营结果
2. transcript 成了终点，而不是中间层
3. 不回写 Contact / Company / Opportunity / Meeting
4. 不触发 recommendation / approval / audit
5. 普通用户可以泛上传录音，产品失去现场入口感

---

## 三、数据模型评审

### 3.1 CaptureSession

必须检查：
1. 是否能表达一次完整会话
2. 是否带 objectType / objectId 上下文
3. 状态流转是否合理
4. startedAt / endedAt / duration 是否完整
5. transcriptStatus / processingStatus 是否可用

### 3.2 ConversationTranscript

必须检查：
1. 是否保存全文
2. 是否支持 segments
3. 是否有 speaker 分离标记
4. 是否有 language 和 confidence
5. 是否便于后续引用片段

### 3.3 ConversationInsight

必须检查：
1. insightType 是否有业务语义
2. 是否能关联 Contact / Company / Opportunity
3. sourceSegmentRefs 是否存在
4. confidence 是否可用
5. 是否真的会被写回记忆系统或 recommendation 输入

不合格情形：
1. insight 只是 transcript 复制
2. insight 无法回写对象
3. insight 与页面展示脱节

---

## 四、交互评审

### 4.1 开始记录入口

必须检查：
1. 首页是否有明显入口
2. Contact / Company / Opportunity / Meeting 页面是否可从上下文开始记录
3. 用户是否能快速知道当前记录归属于谁 / 什么对象
4. 文案是否避免“只是录音工具”的感觉

### 4.2 录音过程面板

必须检查：
1. 是否足够简洁
2. 是否清楚显示录音状态
3. 是否能暂停 / 结束
4. 是否不会让用户面对太多配置项

### 4.3 处理状态

必须检查：
1. 结束后是否显示“正在转写 / 正在提取经营信号”
2. 是否有自然的 processing 状态
3. 失败是否可恢复
4. 成功后是否自然进入结果页或结果区域

不合格情形：
1. 前台流程复杂
2. 看起来像专业录音软件
3. 结束后用户不知道发生了什么

---

## 五、会话理解链路评审

这是整个系统的核心。

必须检查：

1. transcript 能否生成 structured insights
2. structured insights 是否包含：
   - facts
   - commitments
   - blockers
   - risks
   - candidate actions
3. 这些结果是否能写回：
   - MemoryFact
   - Commitment
   - Blocker
   - Timeline
   - Recommendation context

### 不合格情形

1. 只有 transcript，没有经营理解
2. 只有 summary，没有结构化对象
3. 写回页面对象不完整
4. recommendation 无法引用这些 insights

---

## 六、与现有系统闭环评审

### 6.1 与记忆系统
必须检查：
1. facts 是否写入 MemoryFact
2. commitments 是否写入 Commitment
3. blockers 是否写入 Blocker
4. 是否写入 timeline
5. 是否有 correction 入口

### 6.2 与 recommendation
必须检查：
1. 会话产生的新 insights 是否增强 recommendation 输入
2. explanation 是否能引用 conversation-derived facts
3. next best action 是否更可信

### 6.3 与审批中心
必须检查：
1. 从会话中产生的高风险动作是否进入审批
2. explanation 是否能引用相关会话结果
3. 批准后能否回写对象状态

### 6.4 与首页
必须检查：
1. 首页是否能展示最近会话带来的高优先级事项
2. 是否有“系统刚识别出什么”的感知

---

## 七、前台简洁性评审

这是一个特别重要的维度。

必须检查：
1. 前台是否只需要少量操作就能完成一次会话捕获
2. 用户是否不需要理解复杂 AI 处理流程
3. 页面是否把重点放在经营输出，而不是技术处理细节
4. transcript 是否被弱化为中间层，而不是主卖点

如果用户的感受是“这里多了个录音功能”，说明设计还没成功。

如果用户的感受是“这东西能把现场交流自动变成经营推进”，说明方向对了。

---

## 八、风险与边界评审

### 8.1 合规提示
必须检查：
1. 录音状态是否显式
2. 是否有足够的授权和说明文案
3. 是否清楚说明这次捕获会如何被使用

### 8.2 可控边界
必须检查：
1. 高风险动作不会自动越权执行
2. 录音内容不会绕过审批规则直接写成外部动作
3. 系统不会因为会话内容自动修改策略

### 8.3 审计
必须检查：
1. capture_started
2. capture_stopped
3. transcript_generated
4. conversation insights generated
5. memory writeback
6. approval created
都能在 AuditLog / EventLog 中追溯

---

## 九、演示路径评审

每次相关改动后，至少验证以下 5 条路径：

### 路径 A：手动开始记录
1. 首页或对象页开始记录
2. 结束记录
3. 看到 processing 状态
4. 成功得到 transcript

### 路径 B：结构化提取
1. transcript 处理完成
2. facts / commitments / blockers 被生成
3. Meeting 页面可见

### 路径 C：回写对象
1. Contact 页面出现新记忆
2. Opportunity 页面出现新 blocker / commitment
3. 首页出现高优先事项

### 路径 D：recommendation 与审批
1. recommendation explanation 引用会话结果
2. 高风险动作进入审批
3. 批准后对象联动变化

### 路径 E：外部 ingest
1. 通过 API ingest 外部会话
2. 正常生成 insights
3. 不影响原有主流程

---

## 十、代码质量评审

必须检查：

1. capture、transcription、understanding、action-bridge 是否清晰分层
2. 是否避免把大段处理逻辑写在页面里
3. transcript / insight schema 是否有校验
4. 是否有必要注释说明处理链路
5. 是否避免 any 滥用
6. 是否避免业务层直接依赖转写 provider 细节
7. 失败是否有统一错误处理

---

## 十一、评审结论模板

每次评审建议按以下结构输出：

### 1. 总体结论
一句话说明本轮 Conversation Capture System 改动是否可合并。

### 2. 做得好的地方
列出 2 到 5 个最有价值的点。

### 3. 必须修改的问题
重点写：
- 没回到经营闭环
- 前台不够简洁
- transcript 价值不足
- recommendation 没增强
- 审计和权限边界不足

### 4. 建议优化的问题
写那些能提升后续扩展性和产品感的点。

### 5. 验证情况
列出验证过的演示路径。

### 6. 风险提醒
指出后续接 Zoom / 腾讯会议 / Call Center 时最容易出问题的点。

---

## 十二、合并门槛

以下情况可以合并：

1. 前台入口清楚
2. transcript → structured insights 成立
3. 写回 MemoryFact / Commitment / Blocker 成立
4. recommendation explanation 能引用 conversation insights
5. 高风险动作进入审批
6. 审计完整

以下情况不应合并：

1. 只是加了录音和 transcript
2. 没有形成经营对象
3. recommendation 没变强
4. 页面感知不到价值
5. 边界不清、审计不足

---

## 十三、最后提醒

Conversation Capture System 的评审重点不是：

“录音功能做没做出来”

而是：

**这次改动，是否让经营分身真正进入了现场，并且把现场交流自然转化成经营记忆、推进动作和管理闭环。**

如果答案不明显，这轮改动就还不够好。
