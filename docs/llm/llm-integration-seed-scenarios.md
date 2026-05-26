---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# LLM Integration Seed 场景

## 文档目的

本文件用于为“经营分身控制台”的 LLM 接入层设计高质量 seed 场景与演示场景。

目标有四个：

1. 让开发与测试团队清楚哪些场景必须真实走 LLM 链路
2. 让 seed 数据不只是“能看”，而是“能证明接入大模型后产品更智能”
3. 让 demo 时能清楚展示 LLM 在提取、briefing、解释链上的真实价值
4. 让人工验收时有统一的场景与标准

本文不讨论全量 seed 结构，而是专门定义：
- 哪些场景必须走 LLM
- 每个场景输入是什么
- 期望模型输出什么
- 页面上应如何体现价值
- 验收时如何判断“真的更智能了”

---

## 一、总原则

### 1. LLM 场景必须服务真实业务闭环
不要为了展示大模型而硬塞“智能摘要”。

LLM 场景必须服务下面三类闭环：

1. 会议导入 → 结构化提取 → 记忆生成
2. 对象上下文 → briefing → 页面理解和下一步准备
3. recommendation → explanation → 审批与行动信任

### 2. 每个场景都必须可对比
要能回答：
- 如果没有 LLM，这里会怎样
- 有了 LLM，这里具体强在哪里

### 3. 每个场景都必须可落到对象
LLM 的输出不能悬浮。
必须能落到：
- Contact
- Company
- Opportunity
- Meeting
- MemoryFact
- Commitment
- Blocker
- BriefingSnapshot
- Recommendation explanation

### 4. 演示优先展示“经营判断”价值
不要只展示模型写得通顺。
要展示：
1. 它提取了什么关键事实
2. 它理解了什么阻碍
3. 它如何帮助推进
4. 它为什么值得信任

---

## 二、LLM 接入优先场景总表

建议至少准备 6 个核心场景。

### 场景 A：会议纪要结构化提取
目标：
把一段真实会议纪要转成 facts / commitments / blockers / candidate actions

### 场景 B：会前 briefing 生成
目标：
对某场会生成“该问什么、该注意什么、当前卡点是什么”

### 场景 C：联系人摘要生成
目标：
让联系人页像“关系判断页”，而不是资料页

### 场景 D：公司 / 账户摘要生成
目标：
让公司页像“账户势能页”

### 场景 E：机会 recommendation explanation
目标：
让 next best action 的 explanation 更有经营判断感

### 场景 F：首页 today focus explanation
目标：
让“今天最重要的三件事”更像真正的经营简报

---

## 三、场景 A：会议纪要结构化提取

### 业务价值
这是 LLM 最容易体现价值、也最应该最先跑通的场景。

没有 LLM 时：
- 只能展示静态会议记录
- facts / commitments / blockers 需要人工整理
- recommendation 输入不够强

有了 LLM 后：
- 系统可以把纪要自动转成结构化经营上下文
- 会后推进会更快
- recommendation 会更准

### 推荐 seed 输入

请准备至少 3 段不同风格的会议纪要：

#### A1 销售会议纪要
要包含：
- 客户真实关注点
- 一个明确承诺
- 一个 blocker
- 一个会后动作

推荐内容元素：
- 客户说“预算不是最大问题，主要是付款节奏”
- 客户说“希望下周三前先收到一个精简版结构”
- 内部产品资源还要确认
- 需要会后发方案结构草稿

#### A2 招聘会议纪要
要包含：
- 候选人顾虑
- 客户反馈
- 下一轮安排
- 一个风险点

推荐内容元素：
- 候选人对薪资有顾虑
- 客户希望 48 小时内给反馈
- 客户倾向进入二面
- 候选人如果再拖会流失

#### A3 创始人内部会议纪要
要包含：
- 内部优先级冲突
- 对外承诺
- 资源限制
- 待决策事项

推荐内容元素：
- 对外合作方积极，但内部排期紧张
- 两天内要给合作方回复
- 需要先判断是否给轻量合作方案
- 产品负责人担心现有交付节奏

### 期望模型输出

对于每段纪要，LLM 至少应输出：

1. MemoryFacts
2. Commitments
3. Blockers
4. Candidate actions，可选
5. Structured summary

### 页面上应体现的结果

在 Meeting 页面中，用户应能看到：
1. 系统提取出的关键 facts
2. 承诺链
3. blocker 列表
4. 会后建议动作
5. 处理状态

### 验收标准

1. 提取结果不只是照抄原文
2. Commitment 和 blocker 能区分
3. 提取结果能挂到正确对象
4. 提取结果能写入 MemoryFact / Commitment / Blocker
5. 页面看起来真的更像“会议推动器”

---

## 四、场景 B：会前 briefing 生成

### 业务价值
briefing 是最容易体现“系统真的理解上下文”的场景。

没有 LLM 时：
- 只能列最近会议和联系人字段
- 很难形成真正可用的会前准备

有了 LLM 后：
- 会前页会更像高质量助理准备的简报
- 用户更容易建立信任

### 推荐 seed 输入

为以下对象准备完整上下文：

#### B1 销售会议 briefing
对象：
- 星桥科技方案推进会

上下文至少包括：
- 当前 opportunity 状态
- 关键联系人偏好
- open commitments
- active blockers
- 最近邮件线程

#### B2 招聘面试 briefing
对象：
- 刘然二面前 briefing

上下文至少包括：
- 候选人当前顾虑
- 客户最近反馈
- 当前 blocker
- open commitments

#### B3 创始人内外协同 briefing
对象：
- Northlight AI 合作沟通前 briefing

上下文至少包括：
- 当前合作势能
- 内部资源冲突
- 外部承诺时间点
- 推荐必须确认的问题

### 期望模型输出

至少包含：
1. summary
2. 本次最关键目标
3. 当前 blocker
4. 必须确认的 commitments
5. recommended questions
6. recommended next steps

### 页面上应体现的结果

Meeting 页面会前区应出现：
1. “今天这场会最关键的目标”
2. “必须确认的问题”
3. “当前最大 blocker”
4. “会后最可能要推进的动作”

### 验收标准

1. briefing 不是简单摘要
2. briefing 能帮助用户准备会议
3. briefing 体现对象上下文，而不是会议原文复述
4. briefing 内容与 recommendation 能形成一致性

---

## 五、场景 C：联系人摘要生成

### 业务价值
联系人页如果只是资料和时间线，很像 CRM。
LLM 的价值是让联系人页像“关系判断页”。

### 推荐 seed 输入

至少准备 3 个联系人场景：

#### C1 客户联系人
- 李晨，采购负责人
- 最近 14 天有多次互动
- 关注付款节奏
- 有一个未完成承诺

#### C2 候选人联系人
- 刘然，算法工程师候选人
- 对薪资有顾虑
- 最近面试完成
- 有一个待反馈动作

#### C3 合作联系人
- 陈嘉，合作方创始人
- 态度积极
- 但当前受内部排期影响

### 期望模型输出

联系人摘要至少包含：
1. 当前关系阶段
2. 近期关系变化
3. 当前关键偏好
4. 当前 blocker
5. 推荐下一步动作

### 页面体现
联系人页右侧或上方要有：
- 联系人判断摘要
- 推荐动作
- 为什么适合这个人

### 验收标准

1. 摘要像“关系判断”，不只是人物简介
2. 摘要中要体现关系温度和推进状态
3. 推荐动作要和关系阶段匹配
4. explanation 要更像业务判断

---

## 六、场景 D：公司 / 账户摘要生成

### 业务价值
公司页如果只有联系人和机会，很像传统账户页。
LLM 要让它更像“账户势能页”。

### 推荐 seed 输入

至少准备 2 家公司：

#### D1 星桥科技
特征：
- 有两个关键联系人
- 一个升温机会
- 一个 blocker
- 一个 open commitment

#### D2 Northlight AI
特征：
- 外部合作意愿强
- 内部资源冲突
- 当前需要判断是否给轻量方案

### 期望模型输出

公司摘要至少包含：
1. 当前合作势能
2. 关键联系人结构
3. 当前 blockers
4. 当前 commitments
5. 推荐推进路径

### 页面体现
公司页应有：
- 成熟度摘要
- 最近 30 天关键记忆摘要
- 推荐推进路径
- 高风险 blocker 提示

### 验收标准

1. 公司摘要不是泛泛而谈
2. 能体现“当前势能”
3. 能体现“下一步从哪里突破”
4. 能和机会页 recommendation 形成对应

---

## 七、场景 E：机会 recommendation explanation

### 业务价值
这是 recommendation engine 第二阶段最重要的用户感知场景。

没有 LLM 时：
- recommendation 可能是结构化、正确，但说服力一般

有了 LLM 后：
- explanation 更自然、更像经营判断
- 用户更容易批准动作

### 推荐 seed 输入

至少准备 3 条 recommendation 样例：

#### E1 销售机会
- 推荐动作：发送精简版方案结构草稿
- supporting facts：客户希望下周三前收到材料；当前 blocker 是付款节奏

#### E2 招聘机会
- 推荐动作：先同步积极反馈，再单独讨论薪资边界
- supporting facts：候选人对薪资有顾虑；客户愿意继续推进

#### E3 创始人机会
- 推荐动作：先解决内部资源冲突，再对外给轻量方案
- supporting facts：合作方积极；内部资源紧张；承诺回复期限快到

### 期望模型输出

每条 recommendation 的 explanation 至少包含：
1. 为什么现在推荐
2. 主要 supporting facts
3. 主要 blocker / commitments
4. 为什么比次优动作更优先

### 页面体现
机会页和审批中心必须能看到：
- 推荐动作
- explanation
- supporting facts
- policyResult
- 批准后影响

### 验收标准

1. explanation 比第一阶段更有经营语言感
2. explanation 没有脱离 supporting facts
3. policyResult 仍由产品逻辑控制
4. explanation 能提升用户信任

---

## 八、场景 F：首页 today focus explanation

### 业务价值
首页是第一感知页面，LLM 的价值在于把排序结果变成“经营局势理解”。

### 推荐 seed 输入

首页至少应包含：
1. 一个高优先销售机会
2. 一个高风险招聘推进项
3. 一个内部优先级冲突项
4. 一个逾期承诺
5. 一个待审批外发动作

### 期望模型输出

对于前 3 个 today focus 项，生成：
1. 为什么今天重要
2. 当前最大风险
3. 当前最值得做的动作
4. 不处理的后果

### 页面体现
首页主视图中，“今日最值得推进的 3 件事”必须明显体现：
- 不是对象摘要
- 而是局势判断

### 验收标准

1. 首页看起来更像经营简报
2. today focus explanation 具有说服力
3. 高优先事项排序与说明一致
4. 首页比没有 LLM 时更有“盯住局势”的感觉

---

## 九、模型接入后的最小演示路径

为了证明 LLM 接入确实提升了产品智能，建议固定演示下面 4 条路径。

### 路径 1：会议导入
1. 打开一场会议
2. 触发“处理会议记忆”
3. 展示 facts / commitments / blockers 提取结果
4. 展示这些结果写回到对象页

### 路径 2：会前 briefing
1. 打开一场关键会议
2. 展示 briefing
3. 说明系统如何基于对象记忆组织这场会前信息

### 路径 3：机会 recommendation explanation
1. 打开一个机会
2. 展示 next best action
3. 展示 explanation
4. 展示 supporting facts / blockers / commitments

### 路径 4：首页 today focus
1. 打开首页
2. 展示“今天最值得推进的 3 件事”
3. 讲清为什么是这 3 件
4. 讲清如果今天不做会怎样

---

## 十、与 seed 设计的联动要求

Codex 在做 seed 数据时，必须保证以下内容可演示：

1. 至少 3 场会议能真实触发 LLM 提取
2. 至少 3 个 briefing 可直接展示
3. 至少 3 个机会 recommendation explanation 可展示
4. 首页 today focus 至少 3 条有完整 explanation
5. recommendation explanation 至少有：
   - 1 条批准
   - 1 条拒绝
   - 1 条编辑后批准
6. 页面和 AuditLog / EventLog 中能看出 LLM 参与痕迹

---

## 十一、人工验收时要回答的关键问题

每个 LLM 场景上线后，人工验收都要回答：

1. 没有 LLM 时，这个页面是什么感觉
2. 接了 LLM 后，这个页面具体增强了什么
3. 模型输出是否真实帮助了判断
4. 模型输出是否可解释
5. 如果模型失败，系统是否还能正常工作
6. 用户是否更容易信任系统

---

## 十二、最后结论

LLM 接入是否成功，不取决于：
- 多接了几个 provider
- 多做了几种生成
- 文案看起来更聪明

而取决于：
1. 会议、briefing、推荐 explanation 这几条关键链是否真的更强
2. 用户是否明显感到系统“更懂上下文”
3. 用户是否因此更愿意批准和采纳动作
4. 产品是否因此更像经营分身，而不是更像“装了 AI 的 SaaS”
