---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 记忆系统代码评审标准

## 文档目的

本文件用于统一“经营分身控制台”记忆系统相关开发的评审标准。

评审重点不是抽象的技术漂亮程度，而是：

1. 记忆是否真的提升了判断质量
2. 记忆是否真的能支撑行动建议
3. 记忆是否可信、可纠错、可追溯
4. 记忆是否和现有业务对象、审批、审计形成闭环

---

## 一、评审总原则

每次评审记忆系统相关改动时，先回答下面 6 个问题：

1. 这次改动是否让“对象级工作记忆”更清晰？
2. 这次改动是否增强了联系人、公司、机会、会议之间的关系？
3. 这次改动是否增强了下一步动作建议的依据？
4. 这次改动是否增强了用户信任，而不是增加黑盒感？
5. 这次改动是否让修正、确认、删除记忆更可信？
6. 这次改动是否没有明显破坏现有 demo 路径？

如果其中 2 项以上回答为“否”或“不确定”，应要求修改。

---

## 二、产品方向评审

### 2.1 方向正确性的核心判断

记忆系统不是做“知识库”，也不是做“全量日志仓库”。

它必须服务这四件事：
1. 会前 briefing
2. 会后 action
3. 风险与阻碍识别
4. 下一步建议

### 2.2 方向偏移红线

以下情况应视为方向偏移：

1. 只增加存储，不增加判断质量
2. 只增加摘要，不连接业务对象
3. 只增加表结构，不增强页面价值
4. 把记忆做成抽象技术层，用户页面感知不到
5. 没有修正和审计能力
6. 追求“记很多”，忽略“记对、用上、可纠错”

---

## 三、数据模型评审

### 3.1 MemoryFact

必须检查：

1. 是否真正挂在业务对象上
2. sourceType / sourceId 是否清晰
3. confidence / importance / freshnessScore 是否有意义
4. factType 是否足够表达业务语义
5. status 是否支持 active / observed / archived / invalid
6. 是否能支撑对象页展示和 recommendation 调用

### 3.2 Commitment

必须检查：

1. 是否真能表达“谁承诺了什么”
2. 是否能关联 Contact / Company / Opportunity
3. status 设计是否合理
4. dueDate / overdueFlag / fulfilledAt 是否足够支撑逾期判断
5. 是否和时间线、机会推进联动

### 3.3 Blocker

必须检查：

1. blockerType 是否可用于分类
2. severity 是否能用于排序或高风险展示
3. 是否能和机会、联系人、公司关联
4. resolved 流程是否完整
5. 是否能在页面中真实看到“为什么卡住了”

### 3.4 MemoryCorrection

必须检查：

1. correctionType 是否足够
2. beforeValue / afterValue 是否有可读性
3. correctedByUserId 是否完整
4. 修正后是否会影响下游展示或 snapshot
5. 是否有 AuditLog

### 3.5 BriefingSnapshot

必须检查：

1. snapshotType 是否设计清楚
2. 是否有 sourceFactIds
3. 内容是否能复用
4. version / expiresAt 是否合理
5. 是否真的减少重复生成开销或支撑更快展示

---

## 四、API 评审

### 4.1 基本要求

所有记忆系统 API 都必须满足：

1. 输入校验清晰
2. 错误返回明确
3. 不产生无来源的写入
4. 写操作会触发 AuditLog
5. 返回内容足够支持前端页面
6. 命名一致

### 4.2 重点接口检查

重点检查以下接口：

1. `GET /api/memory/facts`
2. `POST /api/memory/facts`
3. `POST /api/memory/facts/:id/correct`
4. `GET /api/commitments`
5. `POST /api/commitments/:id/status`
6. `GET /api/blockers`
7. `POST /api/blockers/:id/resolve`
8. `POST /api/briefings/meeting/:meetingId`
9. `GET /api/recommendations/next-actions`
10. `GET /api/memory/timeline`

检查维度：
1. 返回结构是否对页面友好
2. 是否能串起 recommendation 的依据链
3. 是否能支撑 timeline 混合事件展示
4. 是否能表达对象上下文，而不只是平铺数据

---

## 五、记忆生成链路评审

### 5.1 会议导入 → 记忆生成

必须检查：

1. 会议导入后是否生成 MemoryFact
2. 是否能生成 Commitment
3. 是否能生成 Blocker
4. 是否能挂到正确的 Contact / Opportunity / Company
5. 是否写入时间线
6. 是否写入 AuditLog

### 5.2 审批结果 → 动作记忆

必须检查：

1. 批准和拒绝是否能产生有效记忆
2. 是否能写回对象页
3. 是否能更新时间线
4. 是否能影响后续 recommendation

### 5.3 导入链路

针对 Gmail / CSV 导入，必须检查：

1. 数据能否正确归属对象
2. 是否会产生重复事实
3. 导入失败是否有明确报错
4. 导入成功是否有时间线和审计记录

---

## 六、页面联动评审

### 6.1 联系人页

必须看到：
1. 关键记忆
2. 未完成承诺
3. 当前阻碍
4. 推荐下一步动作

检查重点：
1. 是否有真实内容
2. 是否和后端对象对应
3. 修正后是否会更新

### 6.2 公司页

必须看到：
1. 关键记忆摘要
2. 当前承诺
3. 高风险阻碍
4. 成熟度摘要

### 6.3 机会页

必须看到：
1. blocker
2. commitment
3. next actions
4. 推荐依据

### 6.4 会议页

必须看到：
1. 本次会议形成的记忆
2. 承诺
3. 阻碍
4. supporting facts

### 6.5 记忆与时间线页

必须支持：
1. Facts
2. Commitments
3. Blockers
4. Corrections

评审时要判断：
1. 是否真能帮助理解对象
2. 是否真能帮助做决策
3. 是否真能纠错

---

## 七、推荐链与解释性评审

记忆系统最容易失败的地方，是看起来存了很多东西，但 recommendation 仍然像拍脑袋。

评审 recommendation 时必须检查：

1. 是否引用了 supportingFactIds
2. 是否能解释“为什么是这条建议”
3. 是否用了 blocker / commitment / recent facts
4. 是否受 policy 影响
5. 是否避免生成与对象无关的动作

如果 recommendation 没有依据链，就不算完成。

---

## 八、可信度与纠错评审

必须检查：

1. 每条关键记忆是否有来源
2. 是否有 confidence
3. 是否能被用户确认
4. 是否能被用户修正
5. 是否能被用户失效或删除
6. 修正是否会留下 AuditLog
7. 修正后是否会影响 briefing 或 recommendation

如果系统只能“记”，不能“纠错”，就还不可信。

---

## 九、审计评审

以下动作必须检查 AuditLog：

1. 创建 MemoryFact
2. 修正 MemoryFact
3. 失效 MemoryFact
4. 创建 Commitment
5. 更新 Commitment 状态
6. 创建 Blocker
7. 解决 Blocker
8. 生成 BriefingSnapshot

检查点：
1. summary 是否人类可读
2. payload 是否足够追溯
3. targetType / targetId 是否完整
4. 页面中是否能看见这些变化

---

## 十、演示路径评审

每次记忆系统相关改动后，至少验证 5 条路径：

### 路径 A
导入会议 → 生成 facts → 会议页看到承诺和阻碍

### 路径 B
联系人页 → 展示关键记忆和未完成承诺

### 路径 C
机会页 → 展示 blocker 和下一步推荐

### 路径 D
修正一条记忆 → 记忆页更新 → AuditLog 更新

### 路径 E
生成 briefing → briefing 引用了相关 facts / commitments / blockers

任何一条断裂，都视为功能未闭环。

---

## 十一、代码质量评审

必须检查：

1. 记忆相关逻辑是否封装在 service 层
2. 是否避免页面里堆砌解析逻辑
3. Zod 校验是否完整
4. Prisma 查询是否足够清晰
5. 是否存在重复构造 recommendation 上下文的代码
6. 是否有明显 any 滥用
7. 是否有必要注释

---

## 十二、评审结论模板

每次评审建议按以下结构输出：

### 1. 总体结论
一句话说明本轮记忆系统改动是否可合并。

### 2. 做得好的地方
列出 2 到 5 个最有价值的点。

### 3. 必须修改的问题
只写真正影响：
- 数据可信度
- 页面价值感
- recommendation 解释性
- 纠错闭环
- 审计完整性

### 4. 建议优化的问题
写那些可以提升长期价值的点。

### 5. 验证情况
列出验证了哪些路径。

### 6. 风险提醒
指出后续记忆系统扩展时最容易出问题的点。

---

## 十三、合并门槛

以下情况可以合并：

1. 会议 → 记忆生成链成立
2. Contact / Opportunity / Meeting 页面能看到真实记忆
3. Commitment 和 Blocker 有独立价值
4. 修正机制成立
5. 审计完整
6. recommendation 至少有初步依据链

以下情况不应合并：

1. 只是加了表，没有页面价值
2. recommendation 没有依据链
3. 修正机制是假的
4. 审计缺失
5. seed 数据讲不出故事
6. 页面上看不出记忆系统带来的价值

---

## 十四、最后提醒

记忆系统评审时最重要的一句话是：

**这次改动是否让系统更像“会记住、会理解、会辅助推进”的经营分身，而不是更像“多了几张表的系统”？**

如果答案不明显，这轮改动价值就不够高。
