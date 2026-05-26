---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 主动进化系统 Seed 场景

## 文档目的

本文件用于为“经营分身控制台”的主动进化系统提供 seed 场景规范。

目标有四个：

1. 让 DeltaEvent、PatternFact、StrategySuggestion 有真实故事可跑
2. 让 recommendation engine 的“越用越懂”能在 demo 中被看见
3. 让首页、审批中心、设置页、周报都能展示“系统学到了什么”
4. 让人工验收时有明确的故事线和验证路径

---

## 一、总原则

主动进化系统的 seed 数据，不是凭空生成 pattern。
它必须来自一串连续事件。

所以每条故事线必须具备：

1. 初始 recommendation
2. 用户反馈
3. 多次重复行为
4. 模式检测结果
5. 对 recommendation 或策略建议的影响
6. 页面上的可见化输出

如果没有这一串链路，系统就不像“在进化”。

---

## 二、必须准备的 4 类演示场景

### 场景 A：外发消息编辑习惯形成模式
目标：
展示系统如何从“编辑后批准”学习到用户喜欢更简洁的外发文案。

### 场景 B：budget blocker 高频出现
目标：
展示系统如何识别某类 blocker 已成为高频规律。

### 场景 C：follow-up 时机模式
目标：
展示系统如何发现“24 小时内跟进更有效”。

### 场景 D：高风险动作审批偏好
目标：
展示系统如何识别用户对外部承诺类动作总是要求审批，并形成策略建议。

---

## 三、场景 A：外发消息编辑习惯形成模式

### 角色
- 用户：saleslead@demo.com

### 初始状态
系统给出 3 条 recommendation：
- 向星桥科技发送方案草稿
- 向恒岳工业发送跟进邮件
- 向 Northlight AI 发送合作确认

### 事件序列
1. recommendation 1 被编辑后批准
2. recommendation 2 被编辑后批准
3. recommendation 3 被编辑后批准
4. 编辑内容都有一个共同特征：用户会把文案改短、更直接

### 期望生成
1. DeltaEvents
   - recommendation_edited_and_approved x3
2. PatternFact
   - communication_style_pattern
   - patternKey: outbound_message
   - patternValue: concise_draft_preferred
3. PreferenceSignal
   - outbound_message → concise_draft_preferred

### 页面体现
1. 审批中心 explanation 可出现：
   - “基于你最近多次将外发消息改短，系统优先生成了简洁版草稿”
2. 首页“系统最近学到了什么”可出现：
   - “你最近更偏好简洁直接的外发文案”
3. 后续 recommendation explanation 体现这一点

### 验收点
1. PatternFact 不是手工写死
2. PatternFact 真正来自 recommendation feedback
3. recommendation explanation 能引用这一模式

---

## 四、场景 B：budget blocker 高频出现

### 角色
- Workspace 级别 pattern

### 初始状态
最近两周内，销售和合作故事线里连续出现预算相关 blocker：

1. 星桥科技：付款节奏未明确
2. 恒岳工业：预算审批慢
3. 云岚咨询：预算未拍板
4. 悦途医疗：项目预算边界不清晰

### 事件序列
1. 4 条 blocker 被创建
2. 其中 3 条在一周内仍未解决
3. 这些 blocker 关联到不同机会

### 期望生成
1. DeltaEvents
   - blocker_created x4
   - blocker_unresolved or implied ongoing blocker signal
2. PatternFact
   - blocker_pattern
   - patternKey: budget
   - patternValue: high_frequency
3. 可能生成 StrategySuggestion
   - 建议提高预算相关 blocker 的风险权重

### 页面体现
1. 首页风险区域可更早把 budget 类事项排前
2. 周报中出现：
   - “本周 stalled opportunities 中，budget blocker 占比明显上升”
3. recommendation explanation 中可出现：
   - “当前预算相关阻碍在你的工作区中已成为高频模式”

### 验收点
1. pattern 是跨机会聚合得出
2. pattern 会影响 recommendation 或风险展示
3. 用户在首页或周报能感知系统观察到了规律

---

## 五、场景 C：follow-up 时机模式

### 角色
- 用户：recruiter@demo.com

### 初始状态
猎头团队连续处理多个候选人 follow-up：

1. 刘然反馈在面试后 24 小时内发出，被快速回应
2. 赵可反馈在面试后 48 小时后才发，响应变差
3. 另外两次案例显示 24 小时内 follow-up 的批准率更高

### 事件序列
1. recommendation 被批准
2. recommendation 被忽略
3. 对应结果记录到 feedback
4. 系统比较不同时间窗口表现

### 期望生成
1. PatternFact
   - followup_timing_pattern
   - patternValue: within_24h_preferred
2. PreferenceSignal
   - meeting_followup → within_24h_preferred

### 页面体现
1. recommendation explanation：
   - “你的团队在会后 24 小时内的跟进行动采纳率最高，因此该动作已提高优先级”
2. 首页或周报：
   - “系统观察到：招聘流程里，24 小时内 follow-up 更有效”

### 验收点
1. 模式来自对比，不是单个事件
2. 能影响 recommendation 的 urgency 或 explanation

---

## 六、场景 D：高风险动作审批偏好

### 角色
- 用户：founder@demo.com

### 初始状态
创始人多次面对“对外承诺类动作” recommendation：

1. 向 Northlight AI 回复下一步方案
2. 向云岚咨询确认项目范围
3. 向客户发送带交付承诺的邮件

### 事件序列
1. 这 3 条 recommendation 全部要求人工审批
2. 用户都选择 APPROVED，但没有任何 AUTO_EXECUTE
3. 之后又出现两条类似 recommendation，用户仍坚持审批

### 期望生成
1. PatternFact
   - approval_pattern
   - patternKey: external_commitment
   - patternValue: approval_required
2. PreferenceSignal
   - approval_preference → external_commitment_requires_approval
3. StrategySuggestion
   - 建议将“外发承诺类动作”默认设为逐条审批

### 页面体现
1. 设置与策略页出现策略建议
2. 首页出现：
   - “你最近对外部承诺类动作始终保留人工审批”
3. recommendation explanation 可出现：
   - “基于你最近对此类动作的处理方式，系统已将此动作保留在审批链中”

### 验收点
1. 策略建议不自动生效
2. 用户可接受或忽略
3. recommendation 的 policyResult 被影响

---

## 七、seed 数据数量建议

建议第一版至少做出：

### DeltaEvent
- 20 到 30 条

### PatternFact
至少 5 条：
1. communication_style_pattern
2. blocker_pattern
3. followup_timing_pattern
4. approval_pattern
5. stalled_opportunity_pattern，可选

### StrategySuggestion
至少 2 条：
1. 外发承诺类动作逐条审批
2. 提高 budget blocker 风险权重

### PreferenceSignal
至少 4 条：
1. concise_draft_preferred
2. within_24h_preferred
3. external_commitment_requires_approval
4. budget_blocker_high_risk

---

## 八、页面上的最小可见化要求

### 首页
至少展示：
1. 系统最近学到了什么，3 条
2. 至少有 1 条来自用户偏好
3. 至少有 1 条来自团队级规律

### 审批中心
至少展示：
1. recommendation explanation 中有 learned pattern 提示

### 设置与策略页
至少展示：
1. strategy suggestion 列表
2. 当前值 vs 建议值
3. 接受 / 忽略按钮

### 周报
至少展示：
1. 系统观察到的新规律
2. 当前最值得注意的模式变化

---

## 九、演示路径建议

演示主动进化系统时，建议按下面顺序：

### 路径 1：编辑后批准 → 风格学习
1. 打开审批中心
2. 展示一条 recommendation 被编辑后批准
3. 打开首页
4. 展示“系统最近学到了什么”
5. 再打开下一条 recommendation
6. 展示 explanation 中已体现文风偏好

### 路径 2：budget blocker 高频模式
1. 打开首页风险区
2. 展示预算相关事项靠前
3. 打开周报
4. 展示系统观察到的 blocker 模式

### 路径 3：策略建议
1. 打开设置与策略页
2. 展示“建议外发承诺类动作逐条审批”
3. 用户接受建议
4. 再打开 recommendation
5. 展示 policyResult 变化

---

## 十、人工验收时要回答的问题

1. 这些 pattern 是不是看起来像真实学出来的
2. 它们有没有真正影响 recommendation
3. 首页和周报的“学到了什么”是不是有业务意义
4. 策略建议是不是合理
5. 用户会不会觉得系统在偷偷改规则
6. 用户会不会因为这些变化更信任系统

---

## 十一、最后提醒

主动进化系统的 seed 不应该追求“数量多”，而应该追求：

1. 连续事件链完整
2. pattern 形成过程可信
3. recommendation 被真实影响
4. 页面上能被明显感知
5. 用户仍然掌握控制权

只要这 5 点成立，主动进化层的价值就能被演示出来。
