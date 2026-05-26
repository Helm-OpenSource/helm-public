---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Recommendation Engine 代码评审标准

## 文档目的

本文件用于统一“经营分身控制台”Recommendation Engine 第二阶段相关开发的代码评审标准。

评审目标有四个：

1. 保证 recommendation 真正变强，而不是只多了几段文案
2. 保证 recommendation 有证据、有解释、可追溯
3. 保证 recommendation 与策略、审批、记忆、页面形成闭环
4. 保证 recommendation 的反馈能真正影响后续推荐

本文件关注的重点不是“更炫”，而是：
- 更准
- 更稳
- 更可解释
- 更可验证

---

## 一、评审总原则

每次评审 recommendation engine 相关改动时，先回答下面 6 个问题：

1. 这次改动是否让推荐更像“经营判断”，而不只是提示器？
2. 这次改动是否让推荐的依据更清楚？
3. 这次改动是否让用户更容易理解“为什么推荐这样做”？
4. 这次改动是否让反馈真正形成闭环？
5. 这次改动是否让策略与推荐联动更真实？
6. 这次改动是否没有破坏首页、机会页、联系人页、审批中心的核心演示路径？

如果其中 2 项以上回答为“否”或“不确定”，应要求修改。

---

## 二、产品方向评审

### 2.1 Recommendation 第二阶段的正确定位

第二阶段 recommendation engine 的定位不是“更聪明的文本生成器”。

它必须服务下面四个结果：

1. 更准确的 next best action
2. 更合理的 today focus 排序
3. 更可信的风险识别
4. 更可解释的审批建议

### 2.2 方向偏移红线

以下情况应视为方向偏移：

1. recommendation 只有文案更长，没有依据链
2. recommendation 与记忆系统脱节
3. recommendation 与策略规则脱节
4. recommendation 没有反馈闭环
5. recommendation 只是页面静态展示，没有写入 RecommendationLog
6. recommendation 无法说明为何排在前面

---

## 三、数据模型评审

### 3.1 RecommendationLog

必须检查：

1. 是否记录了 recommendation 的核心内容
2. 是否记录了分数明细
3. 是否记录了 supportingFactIds / blockerIds / commitmentIds
4. 是否有 policyResult
5. 是否有 explanation
6. status 是否能表达 ACTIVE / ACCEPTED / REJECTED / IGNORED / EXECUTED 等状态

评审重点：
- 不能只存标题和描述
- 必须能支撑后续追溯和反馈学习

### 3.2 RecommendationFeedback

必须检查：

1. feedbackType 是否足够表达真实行为
2. edited 字段是否清楚
3. resultNote 是否可读
4. 是否能关联 actionItem / approvalTask
5. 是否会触发 RecommendationLog 状态变化
6. 是否能写入 AuditLog 和 EventLog

### 3.3 PreferenceSignal

如果本轮启用了 PreferenceSignal，必须检查：

1. signalType / signalKey / signalValue 是否足够表达偏好
2. sourceActionId 是否清楚
3. weight 是否会影响后续 recommendation
4. 是否避免“看到行为就盲目写入偏好”的问题

---

## 四、候选动作与排序评审

### 4.1 候选动作召回

必须检查：

1. 候选动作是否来自明确动作库
2. 是否按 objectType 选择合理候选动作
3. 是否避免无关动作进入候选集合
4. 是否覆盖了最常见经营动作
5. 是否没有一开始就做无限开放生成

评审重点：
- Contact、Company、Opportunity、Meeting 四类对象的动作库是否合理
- 是否能够支撑现有页面演示

### 4.2 排序逻辑

必须检查：

1. urgencyScore 是否有现实业务意义
2. impactScore 是否反映了业务价值
3. confidenceScore 是否基于真实 supporting evidence
4. personalizationScore 是否来源清晰
5. policyFitScore 是否反映策略和权限
6. riskScore 是否真实影响输出
7. totalScore 公式是否稳定可解释

评审问题：
1. 有没有把“逾期承诺”“高风险 blocker”“最近未推进”正确纳入 urgency
2. 有没有把“机会价值”“联系人角色级别”“阶段关键度”纳入 impact
3. supporting facts 少时，confidence 是否真的下降
4. 风险高时，是否真的影响 policyResult 或总排序

### 4.3 Today Focus 排序

必须检查：

1. 首页的 today focus 是真的排序结果，而不是手工拼接列表
2. 排在前面的事项是否讲得通
3. 是否能解释“为什么这件事今天最重要”
4. 是否考虑了 overdue commitments / stalled opportunities / blockers / policy

---

## 五、解释链评审

这是 recommendation engine 第二阶段的核心。

### 5.1 解释链必须包含

每条 recommendation 至少要能解释：

1. 触发它的对象是什么
2. 依赖了哪些 supporting facts
3. 哪些 commitments 影响了它
4. 哪些 blockers 影响了它
5. 当前策略结果是什么
6. 为什么建议现在做而不是以后做

### 5.2 必须检查的字段

1. supportingFactIds
2. blockerIds
3. commitmentIds
4. explanation
5. policyResult

### 5.3 解释链失败的典型情况

以下情况应视为 explanation 不合格：

1. explanation 只是泛泛而谈
2. explanation 引用不到具体事实
3. explanation 与页面展示对象无关
4. policyResult 没有被解释
5. supportingFactIds 是空的但仍然给高置信 recommendation

---

## 六、策略与 recommendation 联动评审

第二阶段 recommendation 必须和策略联动，否则产品会显得不可信。

必须检查：

1. policy 修改后，recommendation 的 policyResult 是否变化
2. 高风险动作是否真的进入 REQUIRES_APPROVAL
3. 被禁用动作是否不会正常推荐
4. 自动执行条件是否不会越权
5. recommendation explanation 是否能展示被哪个策略影响

重点验证路径：

### 路径 A
外发消息策略从“逐条审批”改为“自动执行”后，同类 recommendation 的 policyResult 变化

### 路径 B
机会阶段更新策略从“自动执行”改为“仅建议”后，recommendation 输出变化

如果策略修改只是 UI 变化，而 recommendation 没变化，应判定失败。

---

## 七、反馈闭环评审

这是第二阶段 recommendation 是否真正成立的关键。

### 7.1 必须捕获的反馈

至少包括：
1. APPROVED
2. REJECTED
3. EDITED_AND_APPROVED
4. IGNORED
5. AUTO_EXECUTED
6. FAILED

### 7.2 必须检查的闭环动作

收到 feedback 后，必须检查：

1. RecommendationFeedback 是否写入
2. RecommendationLog.status 是否更新
3. AuditLog 是否记录
4. EventLog 是否记录
5. PreferenceSignal 是否按规则更新
6. 后续同类 recommendation 是否有迹象变化

### 7.3 反馈闭环失败的典型情况

以下情况应视为闭环失败：

1. 只是把反馈写到页面状态，没有入库
2. 只是改了 RecommendationLog，没有 RecommendationFeedback
3. 反馈后完全不影响后续 recommendation
4. 编辑后批准与直接批准没有区别
5. 拒绝后没有任何负向学习或至少状态变化

---

## 八、页面联动评审

### 8.1 今日工作台

必须检查：

1. today focus 是否来自真实排序结果
2. 今日重点是否能展开 explanation
3. 高风险事项是否与 blocker / commitment 对应
4. 推荐动作是否可进入审批或执行链路

### 8.2 联系人详情页

必须检查：

1. 是否展示推荐下一步动作
2. 是否展示 supporting facts 简要说明
3. recommendation 是否和联系人当前关系状态一致
4. recommendation 是否和最近互动、未完成承诺有关

### 8.3 机会页

必须检查：

1. 是否展示建议推进顺序
2. 是否展示 blocker 与 commitment
3. 是否展示 explanation
4. recommendation 是否和当前机会阶段一致

### 8.4 会议页

必须检查：

1. 会议 recommendation 是否基于本次会议产生的记忆
2. 会后 recommendation 是否与 action items 联动
3. 是否能看到 supporting facts

### 8.5 审批中心

必须检查：

1. recommendation explanation 是否可读
2. policyResult 是否清楚
3. 用户反馈后是否写入 recommendation feedback
4. 批准、拒绝、编辑后批准三条路径是否都完整

---

## 九、演示路径评审

每次 recommendation 相关改动后，至少验证以下 6 条路径。

### 路径 A：机会页 recommendation
1. 打开一个机会
2. 看到 next best actions
3. 查看 explanation
4. 看到 supporting facts / blockers / commitments
5. 发起审批或执行动作

### 路径 B：联系人页 recommendation
1. 打开联系人页
2. 查看推荐下一步动作
3. 查看 explanation
4. 看到 recommendation 和关系阶段一致

### 路径 C：今日工作台排序
1. 打开首页
2. 查看 today focus 排序
3. 验证高优先项是否合理
4. 验证 explanation 是否能说通

### 路径 D：反馈闭环
1. 对 recommendation 执行 APPROVED
2. 检查 RecommendationFeedback
3. 检查 AuditLog / EventLog
4. 检查 RecommendationLog.status

### 路径 E：编辑后批准
1. 对 recommendation 做编辑
2. 提交 EDITED_AND_APPROVED
3. 检查 feedback 记录是否区分 edited
4. 检查 recommendation 状态变化

### 路径 F：策略变化影响推荐
1. 修改 policy
2. 重新获取 recommendation
3. 检查 policyResult 是否变化
4. 检查 explanation 是否体现该变化

---

## 十、代码质量评审

必须检查：

1. recommendation 逻辑是否集中在 service 层
2. 是否避免在页面里拼凑排序逻辑
3. 是否避免重复实现 scoring
4. explanation 构造是否集中封装
5. feedback 写入是否集中封装
6. Zod 校验是否覆盖关键输入
7. Prisma 查询是否足够清晰
8. 是否有明显 any 滥用
9. 是否有足够注释帮助理解 scoring 和 feedback 逻辑

---

## 十一、性能与稳定性评审

虽然 recommendation 第二阶段重点不是性能，但仍需检查：

1. recommendation 接口是否过慢
2. 是否存在明显重复查询
3. supporting facts 查询是否可控
4. 首页 today focus 是否会造成明显阻塞
5. explanation 获取是否可以单独懒加载

---

## 十二、评审结论模板

每次评审建议按以下结构输出：

### 1. 总体结论
一句话说明本轮 recommendation engine 改动是否可合并。

### 2. 做得好的地方
列出 2 到 5 个最有价值的点。

### 3. 必须修改的问题
重点写：
- 解释链缺失
- 排序不合理
- 反馈闭环不真实
- 策略联动不成立
- 页面感知不到 recommendation 增强

### 4. 建议优化的问题
写那些能进一步提升产品判断力和可信度的点。

### 5. 验证情况
列出走过的路径与发现。

### 6. 风险提醒
指出后续 recommendation engine 扩展时最可能出问题的地方。

---

## 十三、合并门槛

以下情况可以合并：

1. RecommendationLog / Feedback 结构完整
2. recommendation explanation 成立
3. 首页 today focus 真正有排序依据
4. 策略变化会影响 recommendation 结果
5. feedback 闭环成立
6. 页面能感知 recommendation 的增强
7. seed 数据能支撑 recommendation demo

以下情况不应合并：

1. recommendation 只有更花哨的文案，没有解释链
2. RecommendationLog 没有 supporting evidence
3. feedback 不入库或不影响后续
4. 页面展示不到 recommendation 的价值
5. strategy 与 recommendation 没有真实联动
6. today focus 只是静态列表

---

## 十四、最后提醒

Recommendation Engine 第二阶段评审时最重要的一句话是：

**这次改动，是否让系统更像一个“会判断、能解释、会学习”的经营分身，而不是只是“更会生成建议的页面”？**

如果答案不明显，这轮改动就还没真正成立。
