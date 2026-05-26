---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Recommendation Engine 第二阶段设计

## 文档目的

本文件用于定义“经营分身控制台”Recommendation Engine 第二阶段设计。

第一阶段的 recommendation 目标，是用规则和对象上下文给出基础下一步建议。  
第二阶段的 recommendation 目标，是从“基于规则的建议”升级为“基于证据、上下文、偏好、策略和结果反馈的排序引擎”。

第二阶段要解决的核心问题：

1. 推荐为什么更准  
2. 推荐为什么更像这个用户、这个团队会接受的动作  
3. 推荐为什么能被解释  
4. 推荐为什么会随着使用而越来越好  

---

## 一、阶段定义

## 第一阶段
特点：
1. 基于对象上下文
2. 基于简单规则
3. 有基本 supporting facts
4. 结果可演示
5. 偏静态

第一阶段适合解决：
- 首页今日重点
- 会议后 action suggestions
- 联系人下一步建议
- 风险提醒

## 第二阶段
特点：
1. 引入多源召回
2. 引入排序
3. 引入用户与团队偏好
4. 引入策略约束
5. 引入结果反馈
6. 引入 recommendation explanation chain

第二阶段适合解决：
- 更准的 next best action
- 更可信的高风险提示
- 更适合当前角色的建议
- 更稳定的优先级排序
- 更强的“越用越懂你”

---

## 二、第二阶段目标

第二阶段只做四件事：

1. 让推荐更像“经营判断”，而不是提示器
2. 让推荐更像“为这个用户量身定制”
3. 让推荐能解释“为什么建议这样做”
4. 让推荐结果能被用户反馈反哺

不追求：
- 全自动决策
- 黑盒大模型主导
- 完整机器学习平台
- 全量智能排序系统

---

## 三、Recommendation Engine 的核心输出

第二阶段的核心输出有五类：

### 1. Next Best Action
给某个联系人、公司、机会、会议推荐最值得做的下一步动作。

### 2. Today Focus Ranking
给首页输出今天最值得推进的事项排序。

### 3. Risk Alerts
识别：
- 快逾期承诺
- 关系降温
- 关键 blocker 未解决
- 高价值事项长时间未推进

### 4. Meeting Preparation Suggestions
会前 briefing 中的重点：
- 要问什么
- 要避免什么
- 哪个承诺需要确认
- 哪个 blocker 最关键

### 5. Manager Signals
给管理者输出：
- 哪些事项在掉速
- 哪些动作最常被拒绝
- 哪些对象需要人工介入

---

## 四、第二阶段架构

我建议 recommendation engine 拆成 6 层。

### 第一层：候选动作召回层
作用：
先找出“可能可做的动作集合”。

输入来源：
1. 对象当前状态
2. 当前阶段
3. 最近互动
4. open commitments
5. active blockers
6. overdue items
7. 策略规则
8. 最近会议和邮件

输出：
候选动作列表，例如：
- 发跟进邮件
- 安排下一次会议
- 升级给更高层联系人
- 内部确认资源
- 明确预算问题
- 暂缓推进并设提醒

### 第二层：证据召回层
作用：
为每个候选动作找 supporting evidence。

证据来源：
1. MemoryFacts
2. Commitments
3. Blockers
4. Meeting summaries
5. Email thread patterns
6. Approval history
7. Preference signals
8. Policy rules

### 第三层：排序层
作用：
给候选动作打分并排序。

评分维度建议：
1. urgency 紧迫度
2. impact 影响度
3. confidence 置信度
4. feasibility 可执行性
5. personalization 个性匹配度
6. policy fitness 策略适配度
7. risk 风险成本

### 第四层：策略过滤层
作用：
在输出前应用 policy / approval rules。

结果枚举建议：
- SUGGEST_ONLY
- REQUIRES_APPROVAL
- AUTO_EXECUTE
- BLOCKED

### 第五层：解释层
作用：
告诉用户“为什么推荐这样做”。

必须输出：
1. supportingFactIds
2. blockerIds
3. commitmentIds
4. 触发的策略规则
5. 简短 explanation

### 第六层：反馈层
作用：
把用户的行为反哺回引擎。

反馈来源：
1. 批准
2. 拒绝
3. 编辑后批准
4. 忽略
5. 手工创建替代动作
6. 执行后结果好或差

---

## 五、推荐输入设计

第二阶段 recommendation 需要以下输入。

### 1. 对象输入
- Contact
- Company
- Opportunity
- Meeting

### 2. 结构化记忆输入
- MemoryFacts
- Commitments
- Blockers

### 3. 行为输入
- ActionItem 历史
- ApprovalTask 历史
- AuditLog
- EventLog

### 4. 偏好输入
后续由 PreferenceSignal 承载，例如：
- 常批准哪类动作
- 常拒绝哪类外发
- 喜欢早上还是晚上跟进
- 喜欢简洁还是详细草稿

### 5. 规则输入
- PolicyRule
- BudgetRule
- 团队角色权限

---

## 六、推荐输出结构设计

建议统一 recommendation 输出结构：

```json
{
  "recommendationId": "rec_001",
  "objectType": "OPPORTUNITY",
  "objectId": "opp_123",
  "actionType": "FOLLOWUP_EMAIL",
  "title": "发送精简版方案结构草稿",
  "description": "建议先发精简版结构，降低客户等待焦虑并推进下一轮确认",
  "score": 84,
  "urgencyScore": 76,
  "impactScore": 88,
  "confidenceScore": 81,
  "riskScore": 42,
  "policyResult": "REQUIRES_APPROVAL",
  "supportingFactIds": ["mf_001", "mf_009"],
  "blockerIds": ["blk_001"],
  "commitmentIds": ["com_001"],
  "explanation": "客户已明确希望下周三前收到方案，且当前主要阻碍不是价格而是付款节奏，建议优先发送结构草稿。",
  "createdAt": "2026-03-15T09:00:00.000Z"
}
```

---

## 七、排序逻辑建议

第二阶段先不要上复杂模型，先做可解释排序。

## 1. 推荐总分建议

可以先用加权分数：

`totalScore = urgency * 0.25 + impact * 0.25 + confidence * 0.2 + personalization * 0.15 + policyFit * 0.1 - riskPenalty * 0.05`

注意：
- risk 不一定直接否掉动作
- risk 更多影响是否进入审批或自动执行

## 2. 各维度定义

### urgency
受以下因素影响：
- overdue commitment
- 最近多久没推进
- 是否临近会议或承诺时间
- 是否已有高风险提醒

### impact
受以下因素影响：
- 机会价值
- 联系人角色级别
- 当前阶段是否关键
- blocker 是否影响推进核心路径

### confidence
受以下因素影响：
- supporting facts 数量
- facts 置信度
- facts 是否被用户确认
- 数据是否新鲜

### personalization
受以下因素影响：
- 用户历史审批偏好
- 用户常用动作模式
- 团队风格
- 角色偏好

### policyFit
受以下因素影响：
- 当前策略是否允许
- 是否超出预算或权限
- 是否必须审批

### riskPenalty
受以下因素影响：
- 是否外发
- 是否涉及承诺
- 是否涉及高敏感对象
- 是否容易引发误操作

---

## 八、推荐候选动作库

第二阶段建议先维护一个明确的候选动作库，不做无限开放生成。

按对象拆分：

### Contact 相关
- 发跟进邮件
- 发微信 / 短信草稿
- 安排会议
- 设定提醒
- 升级关系阶段
- 标记高风险降温

### Company 相关
- 生成公司 brief
- 安排 account review
- 更新合作成熟度
- 引入更高层联系人
- 整理关键风险

### Opportunity 相关
- 更新阶段
- 创建下一步行动
- 发送资料
- 发起内部协同
- 标记 blocker
- 延期并说明原因

### Meeting 相关
- 生成纪要
- 发送纪要
- 创建后续会议
- 拆解 action items
- 创建 commitment
- 创建 blocker

---

## 九、第二阶段必须新增的数据对象

为了让引擎变强，建议新增或正式启用：

### 1. PreferenceSignal
作用：
把审批和行为反馈转成长期偏好信号。

最低要求：
- signalType
- signalKey
- signalValue
- weight
- sourceActionId
- createdAt

### 2. RecommendationLog
作用：
记录系统推荐了什么，用户怎么回应。

字段建议：
- id
- workspaceId
- userId
- objectType
- objectId
- recommendationPayload
- accepted
- edited
- rejected
- ignored
- executedResult
- createdAt
- updatedAt

这张表对后续优化非常关键。

### 3. RecommendationFeedback
如果不想一开始把 feedback 混在 log 里，可以单独拉表。

---

## 十、API 设计建议

### 1. 获取对象推荐
`GET /api/recommendations/next-actions?objectType=OPPORTUNITY&objectId=:id`

### 2. 获取首页今日重点
`GET /api/recommendations/today-focus?workspaceId=:id`

### 3. 获取联系人建议
`GET /api/recommendations/contact/:contactId`（文档预留，当前代码未实现）

### 4. 记录 recommendation 反馈
`POST /api/recommendations/:id/feedback`

请求体示例：
```json
{
  "feedbackType": "APPROVED",
  "edited": false,
  "resultNote": "已通过审批"
}
```

### 5. 获取推荐解释
`GET /api/recommendations/:id/explanation`

返回：
- supporting facts
- commitments
- blockers
- applied policy
- explanation text

---

## 十一、页面联动建议

### 首页
第二阶段首页不只显示“今日重点”，还要显示：
1. 为什么这是今日重点
2. 哪些建议最值得先做
3. 哪些建议因为风险被压到审批

### 联系人页
应新增：
1. 推荐下一步动作
2. 为什么推荐
3. 最近 3 次同类动作的结果

### 机会页
应新增：
1. 建议推进顺序
2. 当前最大 blocker
3. 逾期承诺提醒
4. 推荐解释链

### 审批中心
应新增：
1. 该动作是推荐引擎如何得出的
2. 该动作是否与用户历史偏好一致
3. 若拒绝，会不会降低类似动作权重

### 记忆页
建议支持查看：
1. 某条 recommendation 依赖了哪些 memory facts
2. 某条 recommendation 被修正后发生了什么

---

## 十二、第二阶段的成功标准

如果 recommendation engine 第二阶段做对了，至少会看到：

1. 被批准的 recommendation 比例提高
2. 用户编辑后批准比例下降
3. 高风险误报减少
4. 首页“今日重点”更像真实经营判断
5. 用户开始感觉系统“更懂我”
6. 管理者开始觉得周报和风险提示有参考价值

---

## 十三、验收路径

至少验证下面 6 条路径。

### 路径 A
会议导入后 → recommendation 能引用新的 fact / blocker / commitment

### 路径 B
联系人页 → recommendation 带 explanation 和依据链

### 路径 C
机会页 → recommendation 按 urgency / impact 排序

### 路径 D
审批通过后 → 记录反馈 → 下一次同类 recommendation 排序有所变化

### 路径 E
策略修改后 → recommendation 的 policyResult 改变

### 路径 F
首页今日重点 → 能解释为什么排在前面

---

## 十四、Codex 实施建议

如果交给 Codex，我建议分两轮做。

### 第一轮
1. RecommendationLog
2. RecommendationFeedback
3. recommendation service 重构
4. 首页 / 联系人 / 机会页 explanation 展示
5. feedback API

### 第二轮
1. PreferenceSignal 正式启用
2. personalization 打分
3. 更强的 today focus ranking
4. 更强的 manager signal

---

## 十五、最后提醒

第二阶段 recommendation 的关键不是“更聪明”，而是：

1. 更准
2. 更稳
3. 更可解释
4. 更可控
5. 更像用户和团队真实会接受的动作建议

如果推荐引擎只是让文案更好看，而没有让：
- supporting evidence 更强
- policy 结果更清楚
- 用户反馈更有效

那就不算真正进入第二阶段。
