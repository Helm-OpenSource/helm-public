---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 主动工作机制与人机协作协议 V1 Deck

本文件用于把《Helm 主动工作机制与人机协作协议 V1》转换成内部评审 / 对齐会可直接使用的演示稿。

建议用法：

- 直接按 slide 结构搬进 PowerPoint / Keynote
- 面向产品和研发评审时保留全部页面
- 面向管理层时保留 Slide 1 到 Slide 10

## Slide 1 封面
Title: Helm 主动工作机制与人机协作协议 V1
Subtitle: 把 Helm 从“信息展示工作台”推进为“持续经营的 AI 中枢”
- 使用场景：产品评审、内部对齐、项目 Kick Off、方案汇报
- 会议目标：统一 Helm 主动性边界、汇报协议、执行权限和人机协作模式
Notes:
- 这次不是在讨论一个局部页面，而是在定义 Helm 下一阶段的产品 operating model。

## Slide 2 这份协议要解决什么
Title: 为什么需要这份协议
- 让 Helm 从被动展示信息，升级为主动感知、主动准备、主动推进、主动汇报的经营主体
- 让人从“先筛信息再判断”，升级为“在 Helm 已完成一轮理解和准备后拍板与授权”
- 让主动性始终处于可治理、可审计、可回放、可复盘的边界内
- 把 reporting protocol、decision-first IA 和主动执行边界收成同一套语言
Notes:
- 核心是统一 Helm 的产品角色，不让主动性变成无边界自动化。

## Slide 3 Helm 的产品角色
Title: Helm 是什么，不是什么
- Helm 是持续经营的 AI 中枢
- 它负责感知变化、形成判断、组织 worker、向人汇报、在边界内推进、在必要时升级
- 它不只是工作台，也不只是问答式助手
- 它的责任不是“展示很多信息”，而是“让事情持续被推进且关键边界始终可见”
Notes:
- 这页要帮团队建立统一定义，避免有人把 Helm 理解成更花哨的 dashboard，或更主动的 chat bot。

## Slide 4 主动工作六层模型
Title: Helm 的主动工作机制分六层
- 主动观察：持续扫描经营变化，形成状态感知
- 主动判断：解释变化，形成 Current Judgement 与 Priority Signal
- 主动准备：先生成 draft、summary、checklist、review note 等 internal-only 产物
- 主动推进：在低风险边界内推进 internal task 与 review 流转
- 主动汇报：在关键时点主动向人汇报，而不是等人来找
- 主动协作：把事项送到合适的人或 worker 面前
Notes:
- 六层是递进关系，不是所有场景都直接跳到 execute。

## Slide 5 三种默认人机协作模式
Title: Helm 与人如何分工
- 模式一：Helm 推进，人类监督
- 模式二：Helm 准备，人类拍板
- 模式三：Helm 提醒，人类主导
- 默认主模式应是“Helm 准备，人类拍板”
- 风险越高、承诺越强、权限越敏感，人类主导程度越高
Notes:
- 这页的重点是定义协作关系，不是追求“AI 做得越多越好”。

## Slide 6 权限矩阵
Title: 什么可以主动做，什么必须停手
- 默认允许：观察变化、生成判断、internal draft、next-step suggestion、协作请求、证据汇总
- 默认禁止：高承诺客户文本、绕过 review 的 customer-facing 内容、越权修改高敏感状态、把 recommendation 直接升级为 commitment
- 需要人工确认：proposal 发送、customer-visible commitment 强化、重大边界变化后的对外表达、高风险 escalation 定级
Notes:
- 这页是治理核心。没有清楚的权限矩阵，主动性就会被误解成自动越权。

## Slide 7 页面交互协议
Title: 核心页面默认先按同一套汇报协议组织
- Current Judgement
- Why it matters
- What Helm already did
- What needs your decision
- Available next actions
- Evidence drawer
- 页面原语统一为 Judgement、Action、Boundary、Evidence、Worker assignment、Escalation
Notes:
- 这页直接承接已有 reporting protocol，把“主动机制”与“页面汇报”接起来。

## Slide 8 Worker 与 Skill 的位置
Title: Helm、Worker、Skill 的关系
- Helm 是总负责人：判断、排序、指派、边界控制、升级和汇报
- Worker 是岗位化执行单元：输出草稿、摘要、说明、建议
- Skill 是能力单元：完成具体能力动作，接入资源，被治理控制
- 用户不应先去找 skill，而应先看到 Helm 的汇报，再看到谁介入、完成了什么、是否需要人工接手
Notes:
- 这是把 orchestration 讲清楚，但又不把用户暴露到底层复杂度里的关键。

## Slide 9 四个边界检查
Title: 为避免 Helm 失控，必须固定四个检查
- Commitment Check：当前输出是 recommendation、proposal 还是 commitment
- Audience Check：当前内容是 internal-only、role-specific 还是 customer-visible
- Boundary Check：是否存在 prerequisite、dependency、risk、authority gap、review requirement
- Execution Check：当前动作处在 observe、prepare、suggest、escalate、execute 哪一层
Notes:
- 这页的重点是把“主动性”做成可判定、可守线的协议，而不是靠使用者自行判断。

## Slide 10 汇报语气与触发条件
Title: Helm 何时主动汇报，以及怎么说
- recommendation 不能伪装成 commitment
- 只要存在 boundary，就必须显性可见
- internal-only 输出必须清晰标记
- customer-facing wording 必须 external-safe
- 主动触发条件包括状态变化、风险变化、阶段切换、worker 完成、长期无人处理、页面打开等
Notes:
- 这页实际上是在定义 Helm 的默认沟通纪律。

## Slide 11 当前明确不做什么
Title: 本阶段主动性不等于全面自动化
- 不做完整自动执行平面
- 不做完整消息编排平台
- 不做完整 workflow engine
- 不做完整 enterprise IAM / org admin / sandbox runtime
- 不做完整 CRM / ERP / project management 平台
- 当前价值是“会主动工作，但仍可治理、可停手、可解释”
Notes:
- 这页是避免内部和外部把 Helm 误讲成更大的自动化平台。

## Slide 12 建议实施顺序
Title: 建议按四批推进
- 第一批：Helm Reporting Protocol、Decision-first IA、首页 / proposal 页 / review 页重构
- 第二批：主动汇报机制、主动拍板请求、主动 worker assignment
- 第三批：主动协作机制、主动 escalation、主动执行白名单
- 第四批：更细的主动运营规则、更细的 worker / skill / resource 协议、更强场景化自动推进
Notes:
- 不建议一开始就追求全自动执行，先把汇报与边界协议收稳更重要。

## Slide 13 成功标准
Title: 协议生效后，成功不再是“展示很多信息”
- Helm 能持续感知经营变化
- Helm 能先做一轮理解与准备
- Helm 能主动汇报当前判断
- Helm 能主动把事项送到该负责的人面前
- Helm 能在边界内推进动作
- Helm 能在边界外及时停手并请求拍板
- 所有动作都能被 replay、audit、memory 接住
Notes:
- 成功标准一定要从“展示能力”切换到“主动工作且有治理”。

## Slide 14 结束页
Title: Helm 下一阶段的核心差异，不是更会展示，而是更会主动工作
Subtitle: 先主动观察、主动判断、主动准备、主动汇报，再在边界内推进
- 谢谢
- Q&A
Notes:
- 收尾时可以强调：这份协议定义的不是功能列表，而是 Helm 未来的产品 operating model。
