---
status: active
owner: helm-core
created: 2026-04-13
review_after: 2026-07-12
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Home Surface Rules v1

状态：Planning-led，首个 current-main implementation slice 已落地
Owner：Helm Core
日期：2026-04-13

> 这是一份 repo-aligned 的首页规则文档。它定义 Helm 登录后首页下一阶段应该如何收紧。current-main 已经落了一层 dashboard first-fold work-entry surface，但这不代表新的 dashboard IA、完整状态仲裁 contract 或 dedicated home session object 已经成立。

## 1. 一句话定义

Helm 的登录后首页，是一个 `work-entry surface`：它只负责恢复当前上下文、收口当前优先级、暴露待 review / 待拍板事项，并把用户送进下一个正确的工作面。

## 2. 为什么现在要做这层规则

current-main 已经有：

- `dashboard`
- `setup -> dashboard` first-loop handoff
- `FirstLoopSurfaceSummary`
- `GoalDrivenHomeSurface`
- `approvals`
- `memory`
- `reports`
- `/operating`

但当前首页仍然同时承载了 first-loop、goal / campaign、business-first summary、proactive reporting、operating overview 等多条表达线。

这意味着：

1. 首页已经不是空白页，但还不够收口。
2. first-loop 已经开始成立，但首页首屏还没有被压成单一 work-entry contract。
3. 如果现在不冻结首页规则，dashboard 很容易继续长成 metrics wall、reasoning surface、产品解释页或总盘首页。

这层规则因此是 `HELM_FIRST_LOOP_PRD_V1` 的下一层，不是另一份独立平台 PRD。

## 3. current-main reality

当前 dashboard 真实已经具备这些前台能力：

- 首页首屏已经新增一层 `Home work entry` surface，先前置 `Top 1-3 work items`、`Needs Your Review`、`Resume / Continue` 与 `light blockers`
- setup 完成后可直接进入 first-loop handoff
- shared first-loop readout 已接入 dashboard
- goal / campaign / top priorities / blockers / decision requests 已进入首页
- `FirstLoopSurfaceSummary`、`GoalDrivenHomeSurface`、operating / reporting context 已开始下沉到 second-layer disclosure
- 首页 second-layer 现在显式补了一层 `surface routing`：把 `detail / approvals / memory` 明确成 Home 之后的三个深层工作面
- `Operating overview`、meeting / approval / pipeline 等更重的 readouts 不再继续作为首页 second-layer 的默认运行路径；Home 改为优先把用户送进 `detail / approvals / memory`
- dashboard 里上一轮遗留的 `detailed readouts` 旧 JSX 路径已经从 current-main 源码主路径中移除，不再以“保留但默认不显示”的方式继续挂在首页后面
- current-main 现在还补了一层轻量 `home-surface arrival` 承接：当用户从 Home 的 `detail / approvals / memory` routing 卡进入目标页时，目标页首屏会显式说明为什么 Home 把你送到这里，以及这页当前负责什么；其中 `approvals`、`memory` 与主 `detail` 路径下的 opportunity / contact / company / meeting work surface 都已经补上页面自己拥有的 landing contract、单一主 CTA 与 second-layer disclosure，把用户直接送进该页的第一个工作区，而不是继续在页头重复 Home summary；其中 `approvals` 进一步把队列侧边界解释后置到 next layer，`memory` 也把 correction boundary、reflection history 和更重的 meeting-memory governance / replay context 后置到 next layer
- dashboard 的 `detail` routing 当前仍会优先把用户送进 richer landing contract 的 opportunity workspace，其次才回退到其它 detail-like 页面；更完整的 contact / company / meeting 内部分层与共享 arbitration contract 仍属于下一层
- `/approvals`、`/memory`、`/operating`、`/reports` 都已经是可跳转的真实工作面
- explicit return anchor 与 diagnostics adoption readout 已成立

因此这份规则不是要求“从零重做 dashboard”，而是要求：

- 先收紧首页首屏 contract
- 再决定哪些内容必须下沉到 second layer / detail / drawer

## 4. Surface Contract

登录后首页只承担 4 件事：

1. 恢复当前上下文
2. 收口当前优先级
3. 暴露待 review / 待拍板事项
4. 把用户送进下一个正确的工作面

登录后首页不承担：

- 产品教育
- 全量经营总览
- 全量 reasoning 展示
- 全量 memory 浏览
- 模板 / 功能超市
- AI 自我表演

## 5. 首页首屏硬规则

首页首屏必须只回答 4 个问题：

1. 现在最重要的事是什么
2. 这件事和谁有关
3. 下一步是什么
4. 哪一步需要我 review

任何不能帮助回答这 4 个问题的内容，都不应该占据首屏。

## 6. 信息分层规则

### 6.1 L1 首屏

L1 只允许放：

- `Top 1-3 Work Items`
- `Needs Your Review`
- `Resume / Continue`
- `Critical Blockers` 的轻摘要

首屏要求：

- 每块都能直接进入动作
- 每块信息密度低
- 每块只有一个主 CTA

### 6.2 L2 次层

L2 可以放：

- 为什么这些事项优先
- 最近变化
- 当前 owner / dependency
- 风险摘要
- Helm 的建议依据摘要

展示方式应该是：

- expandable section
- secondary card
- small drawer
- inline disclosure

### 6.3 L3 后台层

L3 只允许在详情页或抽屉里展开：

- timeline
- evidence chain
- reasoning details
- memory history
- decision trace
- boundary trace
- long-form explanation

## 7. 首页状态模型

首页至少按 4 个状态设计，而不是一个万能页面。

### 7.1 State A: Empty / New

适用于首次登录或 workspace 几乎为空。

首页目标：

- 不空
- 不教条
- 直接进入 first loop

首页主内容：

- 角色入口
- 当前目标入口
- first signal 入口
- 第一个 next step

不允许：

- 欢迎长文
- 功能大全
- 教程列表
- 指标墙

current-main 映射：

- 当前主要落在 `/setup -> /dashboard` handoff
- 不应该重新退回“先完成所有设置”

### 7.2 State B: First Loop In Progress

适用于刚开始使用但还没形成稳定工作流。

首页目标：

- 继续第一条闭环
- 展示 Helm 已经帮用户收口到哪
- 引导一次 review / confirm / continue

首页主内容：

- 当前正在形成的那条 loop
- 需要用户确认的那一步
- 下一步入口

current-main 映射：

- 主要由 `FirstLoopSurfaceSummary`、setup handoff 和 `/approvals` 入口承担

### 7.3 State C: Returning / Active

适用于已形成实际使用。

首页目标：

- 立刻回到最重要的工作
- 恢复上次上下文
- 收口 1-3 个优先项

首页主内容：

- top work items
- needs review
- resume
- light blocker summary

current-main 映射：

- 当前 dashboard 已经有 top priorities / blockers / decisions，但 resume 与 review 仍未成为首屏单一主入口

### 7.4 State D: Review-Heavy / Decision-Heavy

适用于当前用户有大量待拍板、待确认项目。

首页目标：

- 让 review 成为主入口
- 避免被其他信息稀释

首页主内容：

- review queue
- boundary-sensitive items
- escalate / defer / continue 入口

current-main 映射：

- 当前已有 `/approvals` 和 dashboard decision requests，但首页还没有足够强的 review-dominant state arbitration

## 8. Top 1-3 Work Items 规则

首页永远不要默认展示“全部事项”。必须只挑 1-3 个最该处理的事项。

建议排序优先级：

1. 明确等待当前用户拍板的事项
2. 即将阻塞别人推进的事项
3. 最近有新变化、且值得继续推进的事项
4. 与重要人物 / 客户 / 目标直接相关的事项
5. 已形成建议，但尚未完成 review 的事项

不优先：

- 信息多但不急的事项
- 历史事项
- 纯展示型 insight
- 没有 next step 的摘要卡

## 9. Card Anatomy 规则

首页卡片统一使用极简结构：

1. 标题
2. 人 / 对象 / 事项
3. 状态
4. 主句
5. 边界句
6. CTA

其中：

- 标题：告诉用户正在看的工作对象
- 状态：说明当前在什么阶段
- 主句：只说“你现在最该做的下一步”
- 边界句：如果需要 review，明确说出为什么
- CTA：只保留 1 个主动作

不允许：

- 多个主按钮
- 长段解释
- 密集 metadata
- timeline 摘要堆叠
- reasoning 全文

## 10. Review Surface 规则

首页必须显式保留 `Needs Your Review`，因为这是 Helm 的核心差异，不应该被埋进 detail。

这个区域只展示：

- 待确认
- 待拍板
- 待升级
- 有边界风险的建议

每条 item 只回答：

1. 是什么
2. 为什么需要你 review
3. 你可以做什么

不在首页展开：

- 全部背景
- 全部证据
- 全部系统判断过程

## 11. Resume 规则

Returning 用户首页必须有 `Resume` 概念。

允许的表现形式：

- 继续上次最重要的推进
- 你上次停在这里
- 这件事现在需要你继续

Resume 必须是工作恢复，不是通知流。

不应该做成：

- 消息中心
- 全部历史记录
- feed 流

## 12. Empty State 规则

空首页的目标不是“教育用户 Helm 是什么”，而是让用户开始第一条 loop。

Empty state 只允许有 3 步：

1. 你是谁
2. 你想推进什么
3. 你手头有什么真实 signal

然后 Helm 生成第一条 next step。

不允许出现：

- 大片教程区
- 功能导航宫格
- 十几个模板选项
- “先完成所有设置”式阻塞

## 13. 文案与说教后置规则

登录后首页文案必须克制、短、动作导向。

推荐语气：

- 现在最重要的事
- 待你拍板
- 继续推进
- 这一步需要你确认
- 目前卡在这里

不推荐：

- 欢迎来到 Helm
- Helm 会帮助你……
- 通过 AI 全面提升……
- 这里有很多强大功能……

原则：

- 登录后首页写工作，不写宣言
- 任何解释性内容都必须先回答“是不是现在就必须知道”
- 如果不是，就后置到下一层

典型需要后置的内容：

- Helm 为什么这么判断
- Helm 已经做了哪些准备
- 更完整的 AI reasoning
- 产品方法论
- 历史沉淀
- 行业说明

## 14. “以人为本”与 Home / Detail 分工

首页对象选择优先级应偏向：

- 有明确 owner 的事项
- 有明确等待关系的事项
- 与关键人 / 客户 / 团队直接相关的事项
- 需要协作或拍板的事项

而不是优先：

- 抽象指标
- 孤立 insight
- 无 owner 的建议
- 无人负责的总结

换句话说：首页先出现“人和工作”，再出现“系统和分析”。

页面分工必须明确：

- `Home`：决定现在看什么、先做什么
- `Detail`：告诉你为什么、依据是什么、可以怎么处理
- `Approvals`：处理边界和确认
- `Memory`：承担沉淀与复用

如果首页已经把 detail 内容搬上来，首页一定会变重。

## 15. 禁止事项

以下内容禁止主导首页：

- 全量 dashboard 指标墙
- AI reasoning 大段文本
- onboarding 教程中心
- 模板商城
- 通知中心式 feed
- 全量 timeline
- 全量 memory 列表
- 行业对象导航
- 过多 tabs / filters / navigation chrome

## 16. 成功标准

首页是否成立，不看“信息丰富”，而看：

- 登录后到第一次有效动作的时间是否下降
- returning 用户是否更快进入 detail / review / continue
- 新用户 first loop 是否更容易完成
- 用户是否减少“太乱、太满、太像说教”的反馈
- 首页是否真的把 review-sensitive 工作提到了前面

## 17. 受影响页面与实现优先级

最直接受影响的 current-main 面：

- 登录后 `dashboard`
- empty state
- first-loop state
- returning / resume state
- review queue 首页入口
- detail drawer / disclosure 结构
- memory 的首页暴露方式

如果后续要落地，建议按这个顺序：

1. 先改首页首屏 contract
2. 再改 empty / first-loop / returning / review-heavy 四种状态
3. 再调整 review 区和 resume 区
4. 最后再处理 reasoning / memory 的后置展示

不要一上来全面重做 dashboard。

## 18. 当前分级判断

### 18.1 已经完整成立

- 首页不应越过 `review-before-commitment` 与 `recommendation != commitment` 边界
- dashboard、approvals、memory、detail、operating 之间已经是可跳转的真实工作面，而不是纯静态概念
- dashboard 首屏已经有一层 `Home work entry` block，把 `Top 1-3 work items`、`Needs Your Review`、`Resume / Continue`、`light blockers` 前置成可直接进入动作的首页入口
- dashboard 已经开始把 first-loop / goal-driven / system-context 解释层压到 second-layer disclosure，而不是继续让它们直接铺满首页首屏
- dashboard 已经显式补出 `detail / approvals / memory` 的 next-surface routing，开始把 why / review / replay 更明确地下推给 dedicated work surfaces
- dashboard 已经不再把更重的 operating overview / meeting / approval / pipeline readouts 作为首页 second-layer 的默认运行路径

### 18.2 已成形但仍需下一层

- dashboard 已经具备 first-loop、goal-driven、business-first 和 review 入口的原料
- first-loop handoff 与 return-anchor 已经能把首页拉向 work-entry posture
- 首页已经开始被压成首屏 work-entry contract，并开始把 `FirstLoopSurfaceSummary`、`GoalDrivenHomeSurface`、system context 和更深的 why / review / replay 路由往 second-layer disclosure 后置；其中 `approvals`、`memory` 与主 `detail` 路径下的 opportunity / contact / company / meeting workspace 已经把重复解释层继续压到 dedicated surface 的 next layer，`approvals` 的 queue-side boundary context 与 `memory` 的 correction boundary / reflection history / meeting-memory governance context 也已经后置
- 首页状态仲裁、Top 1-3 排序、review-heavy 主入口和 resume 主入口还需要共享 contract

### 18.3 刻意未做

- 首页级全量经营总览
- 首页级 reasoning / evidence / timeline 展开
- 首页级 memory browser
- 教程中心、模板超市、通知 feed
- Vertical 行业对象导航

### 18.4 风险项

1. 首页排序逻辑如果不准，`Top 1-3` 会失真
2. 如果 second layer / drawer 不顺，用户会觉得首页太空
3. 如果状态切换不清，首页语义会继续混乱
4. 如果 goal / campaign、first-loop、review queue 继续同时争首屏，没有更硬的 arbitration contract，首页仍会继续变重

## 19. 必须继续诚实保留的边界

- 这份文档是 planning-led，不等于首页已经完成重写
- 当前没有 dedicated home state engine 或 persisted home session object
- review-sensitive work 仍必须进入 `approvals` 或 detail review posture，不会因为首页改版而越权
- recommendation 仍不等于 commitment
- 首页收紧不等于把 Helm 写成通知中心、CRM 总盘或 BI 平台
