---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# crm-migration-poc-playbook.md

## 文档目的

本文件用于指导“经营推进控制台”如何面向 HubSpot / Salesforce 存量客户推进第一批 CRM 迁移型 PoC。

目标有六个：

1. 明确最适合切入的 CRM 存量客户画像
2. 明确从首次接触到 PoC 成交的完整路径
3. 明确 demo 怎么讲，才能让客户感知 Helm 的 intelligence layer 价值
4. 明确迁移 PoC 的范围、节奏、成功标准
5. 明确一周内如何让客户看到价值
6. 明确 PoC 结束后如何转入长期合作

---

## 一、这类 PoC 的核心定义

这不是“CRM 替换项目”。

这是：

**在 HubSpot / Salesforce 之上，快速叠加一层经营分身控制面。**

要解决的问题不是：
- 你的 CRM 不能用了

而是：
- 你的 CRM 记录了很多，但不够会推进
- 会后还是会断
- recommendation 不够强
- manager 看不到经营局势
- AI 还没有进入真实工作闭环

所以 PoC 的本质是：

**让客户在不替换原有 CRM 的前提下，快速感知 Helm 在经营判断、会后推进、推荐与审批上的增量价值。**

---

## 二、最值得优先打的客户画像

## 1. HubSpot 客户画像

优先目标：
1. 10 到 100 人销售团队
2. 已经有较规范的 HubSpot 数据
3. 会议和邮件驱动推进明显
4. 丢机会原因里有相当部分是执行和推进问题
5. 管理层已经感到“看到了记录，但看不到局势”

典型信号：
- 说自己已经有 CRM，但还是漏跟进
- 会后动作靠人盯
- 销售经理需要开大量 pipeline review 才知道卡在哪
- 想上 AI，但不想重做系统

## 2. Salesforce 客户画像

优先目标：
1. 更成熟、更流程化的销售组织或经营团队
2. 已有 Account / Contact / Opportunity / Event / Task 数据沉淀
3. 管理要求更强
4. 更看重治理、审批、日志和可解释性

典型信号：
- 需要更强的 recommendation 和会后推进
- 希望 AI 帮忙，但必须可控
- 不会轻易换掉 Salesforce
- 愿意为能提升团队推进质量的 intelligence layer 付费

---

## 三、不要先打的客户

第一批不建议优先投入：

1. 数据极其混乱，历史几乎不可用的 CRM 客户
2. 还没有形成基本工作流的小团队
3. 期待“一键替换 CRM”的客户
4. 纯粹把你们当集成开发商的客户
5. 强需求是报表而不是推进的客户

原因很简单：
你们第一批 PoC 的目标不是证明“你们能做任何系统集成”，而是证明：

**在现有 CRM 之上，Helm 可以快速提升经营推进能力。**

---

## 四、CRM 迁移型 PoC 的标准切入路径

建议标准路径分 6 步。

## Step 1：首轮触达
目标：
拿到一次高质量 discovery + demo 机会。

触达重点不要讲：
- 我们有很多 AI
- 我们要替换你的 CRM

要讲：
1. 不替换 HubSpot / Salesforce
2. 快速叠加一层经营分身控制面
3. 会后推进、recommendation、审批、经营局势会明显增强
4. 一周内就能看到价值

推荐触达话术核心：
- 你们应该已经记录了很多，但推进是否依然断？
- 我们不替换 CRM，而是在上面给你们长一层会推进、会记忆、会推荐、可审批的控制面。

---

## Step 2：Discovery
目标：
确认这家客户值不值得做 PoC。

一定要问清楚：

1. 当前 HubSpot / Salesforce 里最关键的对象是不是完整
2. 哪类机会最容易卡住
3. 会后动作是谁来盯
4. recommendation 如果有，他们最希望先在哪个场景出现
5. 哪类外发动作一定要审批
6. 他们能否开放：
   - 联系人
   - 公司 / Account
   - 机会
   - Notes / Events / Tasks

如果这些基础对象都不能开放，PoC 成功率会很低。

---

## Step 3：演示
目标：
让客户明确感知 Helm 相比原 CRM 多出来的价值。

### 演示顺序建议

#### 第一屏：首页
重点讲：
1. 这不是普通 dashboard
2. 这是经营局势前台
3. 系统知道今天最该推进什么
4. 系统知道哪些事情在卡
5. 哪些动作已经在等审批

#### 第二屏：机会页
重点讲：
1. blocker 和 commitment 前置
2. recommendation 不是一句提示，而是判断链
3. 如果今天不推进，会怎样

#### 第三屏：会议页
重点讲：
1. Helm 最强的是把会议变成推进
2. 会前 briefing
3. 会后 action、commitment、blocker、recommendation 全部自动进入链路

#### 第四屏：审批中心
重点讲：
1. AI 不黑盒
2. recommendation 有 explanation
3. 高风险动作仍在治理和审计里

#### 第五屏：管理者周报
重点讲：
1. 不只是看 CRM 数据
2. 而是看团队真实推进和风险规律

### 演示时对 CRM 客户一定要强调
“我们不替换你们的 CRM，我们把你们已有对象和活动转成一个更会推进的层。”

---

## Step 4：界定 PoC 范围
目标：
只做一个可证明价值的切口，不做无限制项目。

CRM 迁移型 PoC 建议只选一个主目标：

### 目标 A
减少会后漏跟进

### 目标 B
提升机会推进可见性

### 目标 C
提升 recommendation 与审批质量

### 目标 D
给销售负责人一个经营局势前台

不要同时承诺解决全部问题。

---

## Step 5：最小迁移范围
目标：
在最短时间内导入足够价值的数据，而不是全量历史大迁移。

建议第一批只迁移：

1. Contacts
2. Companies / Accounts
3. Opportunities / Deals
4. 最近 30 到 60 天 Events / Tasks / Notes
5. 最近 30 到 60 天相关邮件和会议，视可接入性而定

### 不建议第一批迁移
1. 全历史所有记录
2. 全营销对象
3. 所有 case / quote / campaign
4. 深层 workflow metadata

---

## Step 6：导入后 7 天价值交付
目标：
让客户在第一周就看到 Helm 比原 CRM 多出来的价值。

第一周必须让客户看到：

1. 首页 today focus
2. 至少 3 条 blocker
3. 至少 3 条 commitment
4. 至少 3 条 recommendation
5. 至少 1 个高质量 briefing
6. 至少 1 份管理者摘要

如果第一周看不到这些，PoC 会很难转化。

---

## 五、PoC 的标准范围模板

## in scope
1. HubSpot / Salesforce 连接
2. 关键对象导入
3. 对象归属与去重
4. warmup
5. 首页
6. 机会页
7. 会议页
8. 审批中心
9. 记忆页
10. 管理者周报

## out of scope
1. 替换 CRM
2. 深双向同步
3. 全量对象覆盖
4. 复杂管理员后台
5. 所有角色权限细分
6. conversation capture 的实时录音能力
7. 所有外部系统联动

---

## 六、PoC 周期建议

### 周 0：确认
1. 目标
2. 范围
3. 数据权限
4. 参与人
5. 成功标准
6. 付款方式

### 周 1：连接与导入
1. 连接 HubSpot / Salesforce
2. 导入对象
3. 跑第一次 warmup
4. 完成初始演示

### 周 2：真实使用
1. 跑真实机会和会议
2. 看 recommendation
3. 看审批和管理者周报
4. 记录问题

### 周 3：收敛与优化
1. 只修试点最关键问题
2. 强化 recommendation、首页、会议页
3. 输出中期价值复盘

### 周 4：结项与决策
1. 输出结果报告
2. 对照成功标准打分
3. 决定：
   - 是否继续
   - 是否扩范围
   - 是否进入正式合作

---

## 七、PoC 成功标准建议

CRM-first PoC 至少定义 5 个成功标准。

### 1. 数据接入
- 成功接入 HubSpot 或 Salesforce
- 成功导入联系人、公司、机会、活动中的核心对象

### 2. 价值显现
- 导入后 10 分钟内首页产生价值感
- recommendation、blocker、commitment、briefing 能出现

### 3. 使用行为
- 至少 3 到 5 个真实用户使用
- 每周至少若干次活跃使用

### 4. 过程改进
- 会后 action item 更清楚
- recommendation 被更高频采纳
- 风险事项更早暴露

### 5. 续费可能
- 客户愿意进入下一阶段
- 或愿意扩大范围
- 或愿意讨论正式商业化

---

## 八、客户最容易买单的卖点

CRM 客户不会为“又一个系统”买单。  
他们最可能为下面这些买单：

1. **会后不再断掉**
2. **机会推进更可见**
3. **推荐更有依据**
4. **审批和治理更强**
5. **管理层能看到经营局势**

销售时建议把价值排序定成：

### 先讲
1. recommendation
2. 会后推进
3. blocker / commitment
4. 首页经营局势

### 再讲
5. LLM
6. learning / evolution
7. conversation capture

---

## 九、CRM-first PoC 的关键风险

### 1. 把项目做成“系统集成项目”
这是第一大风险。  
要始终守住：
- intelligence layer
- not replacement layer

### 2. 数据对象绑定不准
如果 Contact / Company / Opportunity 绑定错，后面 recommendation 和 memory 会一起变差。

### 3. 导入后价值不够快出现
如果客户导入后还是看不到明显价值，试点就会失速。

### 4. recommendation 解释很强，但推荐不准
这个必须通过 eval 和真实试用验证。

### 5. 范围失控
客户很容易提出：
- 再接更多对象
- 再打通更多流程
- 再做深一点 CRM 替换
要始终守住试点边界。

---

## 十、给客户的标准承诺

建议对 CRM 客户的承诺统一成下面这种结构：

### 你们不需要先替换 HubSpot / Salesforce
### 我们会先把你们最关键的对象和活动接进来
### 一周内让你们看到：
1. 今天最该推进什么
2. 哪些机会在卡
3. 哪些承诺未完成
4. 哪些动作值得做
5. 哪些动作必须审批

### 如果这个价值成立，再讨论更深集成

---

## 十一、内部推进建议

你们内部在做 CRM-first PoC 时，最应该盯住的不是“接了多少对象”，而是：

1. recommendation 是否更准
2. blocker / commitment 是否更清楚
3. 首页 today focus 是否更有价值
4. 周报是否更打动负责人
5. 客户是否觉得 Helm 比原 CRM 多出了一层真实 intelligence

---

## 十二、最终结论

CRM-first PoC 的关键，不是证明你们能连接 HubSpot / Salesforce。

真正要证明的是：

**在不替换客户 CRM 的前提下，Helm 能快速把这些已有对象和活动转化为经营分身控制面，并让客户在第一周看到 recommendation、会后推进、审批与管理判断的真实提升。**

只要这点成立，第一波高付费能力客户就能开始被撬动。
