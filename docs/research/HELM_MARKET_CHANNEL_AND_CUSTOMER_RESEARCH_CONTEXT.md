---
status: active
owner: helm-core / GTM
created: 2026-04-30
review_after: 2026-05-30
archive_trigger:
  - 下一版市场渠道与目标客户研究报告落地并完成 docs/README.md 索引切换后 30 天归档
  - v0.1.0-trial 公开试用完成首轮复盘后，如本文件未被更新则归档为历史上下文
---

# Helm Market Channel And Customer Research Context

## 1. 用途

这份材料用于粘贴给 ChatGPT 或其他研究型 AI，让它在做 Helm 市场渠道、目标客户、ICP、竞争定位和早期 GTM 调研前，先建立一套基础认知。

本文件不是市场调研结论，也不是对外销售材料。它的作用是：

1. 给出 Helm 当前 repo truth、产品定位、实现边界和商业假设。
2. 防止后续研究把 Helm 误读成通用聊天、CRM、BI、agent builder 或自动执行平台。
3. 给出 ChatGPT 后续调研时应继承的术语、边界、ICP 假设、渠道假设和输出格式。
4. 明确哪些内容是当前已落地，哪些只是 planning / hypothesis，哪些必须通过外部资料重新验证。

## 2. 使用边界

给 ChatGPT 使用时，先明确以下规则：

1. **所有外部市场事实都必须重新检索并引用来源**。本文件只提供 Helm 内部认知，不提供最新市场数据证明。
2. **不得把 Helm 写成自动执行或自动承诺系统**。Helm 的长期边界是 recommendation / explanation / proposal / proactive 不等于 commitment / send / approval / settlement。
3. **必须区分三类内容**：
   - `repo truth`：当前仓库、README、docs 和已验证实现中明确成立的内容。
   - `planning / hypothesis`：GTM、定价、渠道、试点包和未来 release 中仍需验证的内容。
   - `external finding`：ChatGPT 通过公开资料或调研得到的外部事实。
4. **不要直接生成客户可见承诺**。如输出对外话术，必须保留 boundary / prerequisite / dependency / non-commitment note。
5. **当前日期基线**：本上下文整理于 2026-04-30；`v0.1.0-trial` 是 2026-05 计划目标，不应写成已经发布完成。

## 3. 一页版认知

Helm 的研究起点应从一个窄切口开始：**客户会议后的收入推进闭环**。它把会议、邮箱、CRM、IM、资源状态和 Ask Helm 等输入收成统一推进链，识别今天必须推进的事项，给出证据、原因、风险边界和复核入口。它不替代 CRM，不做通用聊天，不做完整 BI，不做完整 workflow / agent orchestration，也不自动替用户对外发送、承诺、审批或结算。

“经营推进控制台 / 经营推进操作系统”只作为第二层类别解释，不作为冷启动第一句话。后续研究如果输出销售文案，第一句应优先使用“客户会议后 48 小时不再丢单 / 谁该跟、怎么跟、哪些不能承诺”这类痛点语言。

中国市场第一阶段主战场是：

**客户会议后的收入推进闭环。**

标准表达：

**会议结束 5 分钟内，Helm 让 B2B 销售、售前、交付和客户成功团队知道该跟什么、谁来跟、怎么说、哪些不能承诺、哪些需要管理者介入，并把后续动作留在可审计链路里。**

第一阶段不要卖“大平台”。优先用 3-5 场真实或脱敏客户会议，跑 4 周付费试点，验证 follow-up latency、manager review time、handoff completeness、draft adoption、wrong commitment incident 和 audit trace coverage。

## 4. Helm 背景逻辑

### 4.1 核心问题

B2B 业务里，机会、客户、候选人、合作方和交付项目经常不是死在报价或能力本身，而是死在会后 48 小时：

- 没有人明确下一步。
- CRM 记录和真实沟通脱节。
- 销售、售前、交付、CS 各自持有局部上下文。
- 管理者只能靠周会、群消息、人工追问和个人记忆发现风险。
- 客户可见承诺、交付边界、跟进草稿和内部判断混在一起，容易误发或越界。

Helm 的产品假设是：企业需要的不是另一个会回答问题的 AI，也不是马上替人自动执行的 agent，而是一个可信的经营推进判断层。

### 4.2 产品姿态

Helm 当前长期姿态：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `proactive-reporting-first`
- `review-before-commitment`

这意味着 Helm 先让组织看清楚：什么该推进、为什么现在推进、证据在哪里、边界是什么、谁该复核。只有经过人工确认后，才进入更高风险动作。

### 4.3 核心对象和输出

后续研究可以把 Helm 理解成围绕这些对象工作：

| 对象 / 概念 | 含义 |
| --- | --- |
| `AdvancementSignal` | 来自会议、CRM、邮箱、资源、Ask Helm 的经营推进信号 |
| `AdvancementJudgement` | 对信号的判断：为什么重要、为什么现在、证据与边界 |
| `MustPushItem` | 今天必须推进的 3-5 个事项 |
| `ReviewRequiredAction` | 高风险事项的人工复核入口 |
| `MemoryCandidate` / `MemoryFact` | 可沉淀为经营记忆的事实、承诺、阻塞、修正 |
| `SkillSuggestion` | 可能复用的能力或流程候选，不能自动晋升为正式 skill |
| `ApprovalTask` | 审批 / 复核承接面，承接客户可见草稿、CRM 阶段变更等 |
| `AuditEvent` / evidence chain | 证据链、边界、回放和归因基础 |

核心流：

```text
meeting / email / CRM / resource / Ask Helm
  -> signal
  -> judgement
  -> Must Push
  -> Review Action
  -> human confirmation
  -> memory / draft / official write candidate / follow-through
```

## 5. 当前产品与实现状态

### 5.1 已经在当前主干形成的产品表面

当前 README 和文档入口列出的关键入口：

| 路径 | 作用 |
| --- | --- |
| `/dashboard` | 今天必须由用户拍板的 3 件事 |
| `/mobile` | 移动端窄屏经营推进入口，整合 Ask Helm、Must Push、Review、Memory、Operating |
| `/operating` | 经营总盘，按判断 / 决策 / 边界组织 |
| `/approvals` | 客户可见草稿、CRM 阶段变更等复核队列 |
| `/memory` | 经营记忆，事实、承诺、阻塞、修正可回放 |
| `/search?mode=ask` | Ask Helm，只读问答和对象定位，附引用与边界 |
| `/setup` | 受控试点初始化 |
| `/capture` | 会议录制到事实 / 承诺 / 跟进项 |
| `/reports` | 周复盘与下周重点 |
| `/settings` | 工作区控制台、连接器、策略、试点模式、保留期和导出 |

### 5.2 工程实现框架

当前代码库可按以下层次理解：

| 层 | 目录 / 文件 | 职责 |
| --- | --- | --- |
| 路由与页面入口 | `app/` | 当前唯一或主要 route owner |
| 页面装配与 domain loader | `features/` | 页面级 loader、query、client 交互、domain actions |
| 查询兼容面 | `data/queries.ts` | 当前真实查询 aggregation seam，正在变薄 |
| 领域服务与运行时合同 | `lib/` | auth、billing、memory、imports、connectors、operating、Helm v2 contracts |
| 数据模型 | `prisma/schema.prisma` | Workspace、Membership、业务对象、记忆、审批、审计等 |
| 验证与守卫 | `scripts/` | self-check、boundary-check、public-release guard、eval harness |
| 回归测试 | `tests/` + colocated tests | Vitest、Playwright、专项 evaluator |

技术栈：

- Next.js 16 App Router + React 19
- MySQL + Prisma
- Tailwind CSS 4 + Radix UI
- TypeScript strict mode
- Vitest + Playwright

### 5.3 接入与运行边界

README 当前把主流系统接入表达为：

- CRM：HubSpot / Salesforce，只读同步 + 经营信号层。
- 企业 IM：DingTalk / WeCom，OAuth + Directory + MCP。
- 邮件：Gmail / 阿里邮箱，IMAP + SMTP。
- 会议：现场录制 / 智能转写。
- 支付：Stripe / 支付宝 / 微信支付，作为 narrow payment rail，不是 finance console。
- LLM：OpenAI / OpenAI compatible / local Gemma，多 provider。

对外研究时要谨慎：这些能力可作为当前产品/路线图上下文，但如果要写最新公开营销 claim，需要以 release 前验证和公开文档为准。

### 5.4 当前阶段边界

截至 2026-04-30：

- Helm overall 当前内部阶段结论为 `A`。
- recommendation / commitment 两条主线为 `A-minus`。
- `v0.1.0-trial` 是 2026-05 公开试用计划，不是已经完成的 GA。
- Public-release guard 最近已恢复 PASS；`check:boundaries` 在部分任务中仍可能受既有 legacy marker drift 影响。
- Business Advancement runtime adoption 仍受 gate 约束。TPQR-001 / TPQR-003 / TPQR-004 是五月受限解禁范围，但必须先满足 redacted live DB calibration、reviewer approval、disabled rollout、rollback proof、audit completeness 和 boundary regression。

## 6. 中国市场 ICP 假设

### 6.1 第一优先级：B2B SaaS / 企业软件公司

适合度最高。

典型特征：

- 客户会议密集。
- 销售、售前、交付、客户成功协同复杂。
- 已经使用 CRM、飞书、钉钉、企微、项目管理或知识库。
- 管理层痛点集中在机会判断不透明、跟进慢、交付 handoff 丢上下文。
- 客单价足以支撑 Business / Growth / Enterprise 或 4 周付费试点。

优先买方：

- 创始人 / CEO / COO
- 销售负责人
- 交付负责人
- 客户成功负责人
- RevOps / BizOps

主卖点：

**让每次客户会议进入同一条收入推进链，而不是散落在销售个人记忆、IM 和 CRM 备注里。**

### 6.2 第二优先级：AI 服务商 / SI / 咨询交付公司

适合早期 proof、custom service 和 partner delivery。

典型特征：

- 项目制销售。
- 会前会后材料复杂。
- 方案、报价、交付边界容易变化。
- 客户承诺风险高。
- 需要 custom action pack、handoff pack 和 partner delivery。

主卖点：

**把客户承诺、方案边界、交付 handoff 和异常处理留在可审计链路里，减少销售到交付断层。**

### 6.3 第三优先级：高客单价传统企业数字化团队

适合 design partner 和 Enterprise pilot，但采购周期、IT / 安全 / 法务门槛更高。

典型行业：

- 企业服务
- 金融科技
- 产业软件
- 医疗器械
- 工业 SaaS
- 复杂渠道和项目型销售组织

主卖点：

**在长销售周期、多角色、多系统协作里，让 manager attention、handoff 和审计链默认在线。**

### 6.4 第一阶段不主攻

不优先投入：

- 泛 HR
- 泛办公团队
- 个人效率工具用户
- 纯内容营销团队
- 低客单电销团队
- 只要会议纪要和录音转写的客户

原因：这些客户容易把 Helm 拉回低价工具化比较，削弱“客户经营闭环”的价值锚点。

## 7. 试点和商业假设

### 7.1 4 周付费试点

当前建议的第一阶段试点包：

- 试点团队：5-20 人，至少 1 个业务 owner、2 个一线使用者、1 个 manager reviewer。
- 输入：3-5 场真实或脱敏客户会议、当前跟进记录、机会 / 客户状态、handoff 样例。
- 输出：structured facts、action pack、follow-up draft、risk / blocker notes、review boundary、owner / due date / next step。
- 通用中国市场试点价格假设：¥9,800 / ¥19,800 / ¥29,800 三档；转年付时可抵扣首年合同。
- Pack A 第一个 design partner 当前默认 paid pilot 锚点：¥50,000；该价格用于筛选真实痛点、owner、数据和 proof，不应被误写成所有试点统一报价。

红队修正：后续市场研究不得把这些价格混成一个报价表。`¥30k / ¥50k / ¥80k` 是 design partner paid pilot 的验证档位；`¥9,800 / ¥19,800 / ¥29,800` 是通用试点 / 订阅假设；Enterprise / Custom 是单独评估。若研究对象把 Helm 比价到会议纪要或 CRM 插件，应记录为 positioning risk。

成功指标：

| 指标 | 建议目标 |
| --- | --- |
| Meeting-to-Action Time | 小于 5 分钟，或相对 baseline 降低 70% |
| Follow-up Latency | 降低 50% |
| Manager Review Time | 降低 30% |
| Draft Adoption Rate | 大于 60% |
| Wrong Commitment Incident | 0 |
| Audit Trace Coverage | 100% |

### 7.2 定价假设

这些是 planning / hypothesis，不是正式报价系统：

| 层级 | 假设价格 | 目标 |
| --- | --- | --- |
| Team | ¥199 / 月 / 组织 | 自助试用、小团队入口 |
| Business | ¥2,980 / 月 / 组织，年付 ¥29,800 起 | 5-50 人销售 / 交付团队 |
| Growth / Revenue OS | ¥9,800-29,800 / 月 / 组织 | 20-100 人销售、售前、交付、CS 团队 |
| Enterprise / Custom | 实施费 ¥80,000-300,000；年费 ¥200,000+；月度联运 ¥20,000-100,000 | 大型企业、复杂系统集成、partner delivery |

采购锚点优先级：

1. 销售提效预算
2. 交付 / CS 协同预算
3. AI 项目预算
4. RevOps / BizOps 系统预算
5. 企业软件实施预算

不优先锚定个人效率工具预算。

## 8. 渠道与生态假设

### 8.1 开源不是主要商业模式

Helm 按 Apache-2.0 开源的作用是：

- 采用引擎
- 标准层
- 伙伴生态入口
- 技术评审和安全评审信任入口

商业收入继续来自：

- Helm Cloud
- Helm Enterprise
- Certified Workflow Packs
- Official Connectors
- Audit / Compliance / Observability
- Custom Implementation
- Partner Delivery
- Enterprise Support / SLA

红队修正：开源在前 90 天只作为信任、技术评审和集成边界材料，不作为首批 ARR 或获客主引擎。首批成交仍默认来自 founder-led direct sales。

### 8.2 当前渠道假设

后续市场渠道调研应验证以下路径：

| 渠道 | 目标人群 | 当前假设 |
| --- | --- | --- |
| Founder-led direct sales | B2B SaaS / SI / 高客单数字化团队 owner | 最短路径拿到 4 周付费试点和 proof pack |
| GitHub / 开源社区 | 开发者、技术评审、实施工程师 | 用 Helm Core 建立可信标准层 |
| 开发者社区 | 知乎、掘金、V2EX、InfoQ、极客时间、阿里云开发者社区 | 讲清楚“不是另一个 Agent 框架”与本地 quickstart |
| 公众号 / 自媒体 | 业务买家、创始人、销售 / 交付负责人 | 用案例、Pack、经营闭环和创始人观点做放大 |
| 行业媒体 | ToB、SaaS、AI、企业服务、跨境 / 垂直行业媒体 | 需要严控文案，避免媒体改写成自动化承诺 |
| Partner / SI | AI 服务商、咨询交付公司、认证工程师 | 从 implementation 和 workflow pack 切入，沉淀 partner delivery |
| Design partner | 单部门 / 单业务线试点客户 | 用 proof pack 证明价值，再决定是否扩展 |

前 90 天的渠道裁决：

1. Founder-led direct sales 是唯一主路径。
2. AI 服务商 / SI 先作为 design customer，不作为 reseller。
3. 云厂商、应用市场、认证工程师生态在 2-3 个 paid pilots 之前不建正式 channel program。
4. 公众号、知乎、开源社区和开发者社区只用于信任与 proof 放大，不写进成交假设。

### 8.3 当前不优先的渠道

- 付费投放，除非单独裁决。
- 钉钉应用市场 / marketplace 式上架。
- SEO / 搜索广告作为早期主路径。
- 海外社区作为第一阶段主路径；当前聚焦中国市场。

## 9. 竞争边界

后续研究应把竞品分层，而不是把所有 AI / SaaS 都放在同一张表里。

| 类别 | 代表 | Helm 不做什么 | Helm 占据的位置 |
| --- | --- | --- | --- |
| Enterprise agent platform | Salesforce Agentforce、ServiceNow AI Platform、Microsoft Copilot Studio | 不做通用 agent 编排 / 企业 IT 控制塔 | 跨系统识别经营推进信号，把推进项压缩给经营团队复核 |
| Agent infra / SDK | OpenAI Agents SDK、LangGraph、CrewAI | 不竞争 runtime / lifecycle / orchestration | 产品对象是经营推进控制台，不是 agent 搭建平台 |
| Revenue intelligence | Gong、Clari | 不只锁在销售收入主题 | 用 Must Push 横跨销售、CS、交付、审批、资源 |
| Meeting AI | Granola、Otter、Fireflies | 不把会议总结当终点 | 把会议作为高价值 signal / evidence 来源，最终归到 Must Push 与 Review Action |
| 通用 AI 助手 / 聊天 | ChatGPT、Claude、Gemini | 不做通用聊天历史产品 | Ask Helm 必须收口到对象、页面、Review Action 或 Must Push |
| 国内 builder / 数字员工平台 | 扣子、元器、百炼、OpenClaw 类生态 | 不比 builder 丰富度或 skill 数量 | 打行业 Pack、推进闭环、推荐 / 承诺边界和审计链 |

## 10. ChatGPT 后续调研任务建议

建议把后续互动拆成几个独立研究任务：

1. **ICP 校准**：验证 B2B SaaS / 企业软件、AI 服务商 / SI、高客单传统企业数字化团队三类 ICP 的购买触发、预算归属、试点门槛和 No-Go 信号。
2. **渠道优先级**：比较 founder-led direct sales、开源社区、开发者社区、自媒体、行业媒体、partner delivery 的获客质量、成本、信任路径和 proof 产出能力。
3. **竞品 positioning**：按 agent platform、meeting AI、revenue intelligence、domestic builder / digital worker 四层梳理竞品，不做泛 AI 大表。
4. **内容主题验证**：验证哪些内容角度能吸引目标买方，例如“客户会议后的收入推进闭环”“建议 vs 承诺”“不是会议纪要”“从 open-source core 到 workflow pack”。
5. **试点包验证**：评估 4 周 paid pilot 的价格、范围、指标和客户投入要求是否符合目标客户采购心理。
6. **伙伴生态验证**：评估认证实施工程师、SI、咨询公司、云厂商社区是否适合作为早期放大渠道。
7. **OPC 市场验证系统**：把研究输出压缩为每日候选新增、访谈、评分榜更新和 Top 2-3 scope call，而不是继续扩大报告篇幅。

## 11. 推荐输出格式

让 ChatGPT 输出时，建议要求它使用以下结构：

```text
1. 结论
   - 推荐优先 ICP
   - 推荐优先渠道
   - 不建议投入的客户 / 渠道

2. 证据
   - 外部来源链接
   - 每条来源对应的可用事实
   - 来源日期和可靠性判断

3. ICP 矩阵
   - segment
   - buyer
   - trigger
   - budget
   - pain language
   - pilot fit
   - No-Go signal

4. 渠道矩阵
   - channel
   - audience
   - content angle
   - activation path
   - expected proof
   - risk

5. 30 天实验计划
   - 每周动作
   - 目标指标
   - 成本
   - Stop / Continue condition

6. 边界检查
   - 是否误写成自动执行
   - 是否误写成 CRM / BI / agent platform
   - 是否把 planning 假设写成已发布事实
```

## 12. 可直接复制给 ChatGPT 的起始 Prompt

```text
你是一个熟悉中国 B2B SaaS、企业服务、AI agent / 数字员工、开源社区和 founder-led GTM 的市场研究顾问。

我会给你一份 Helm 项目的内部上下文。请先基于这份上下文建立产品认知，再进行市场渠道和目标客户调研。

必须遵守：
1. 所有外部市场事实必须重新搜索并引用来源，不能只凭常识。
2. 把 repo truth、planning / hypothesis、external finding 三类内容分开。
3. 不要把 Helm 写成自动执行、自动承诺、自动外发、CRM 替代、BI 平台或通用 agent builder。
4. 对 customer-facing 文案，必须保留“建议不等于承诺、草稿不等于发送、复核先于高风险动作”的边界。
5. 当前上下文日期是 2026-04-30；v0.1.0-trial 是 2026-05 计划目标，不要写成已经 GA。

调研目标：
- 验证 Helm 第一阶段最值得优先打的目标客户是谁。
- 排序 Helm 早期最值得投入的市场渠道。
- 给出 30 天可执行的客户访谈、内容发布、社区传播和 design partner 获取计划。
- 明确哪些客户 / 渠道 / 文案角度应该避免。

请按以下结构输出：
1. 直接结论
2. ICP 优先级矩阵
3. 渠道优先级矩阵
4. 竞品与替代方案分层
5. 30 天实验计划
6. 需要我补充的信息
7. 边界检查
```

## 13. 内部来源锚点

本上下文主要综合以下 repo 文件：

| 文件 | 用途 |
| --- | --- |
| `AGENTS.md` | 仓库长期定位、硬边界、recommendation / commitment 规则 |
| `README.md` | 对外当前入口、价值主张、功能表、路线图 |
| `WORKING-CONTEXT.md` | 2026-04-30 当前执行现实、release hygiene、runtime gate |
| `docs/architecture/codebase-collaboration-summary.md` | 代码结构、route owner、query seam、常见对象 |
| `docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md` | 当前市场定位收口、竞争边界、状态四类短表 |
| `docs/product/HELM_V2_1_MARKET_POSITIONING_BRIEF.md` | 市场判断、目标客户画像、第一条商业化试点闭环 |
| `docs/brand/HELM_CHINA_MARKET_MESSAGING_V1.md` | 中国市场类别表达、首页文案、销售 / 投资 / 合作口径 |
| `docs/brand/HELM_CHINA_GTM_PACKAGE_V1.md` | China GTM package、外部叙事和不可 overclaim 的边界 |
| `docs/sales/HELM_CHINA_ICP_PLAYBOOK.md` | 中国 ICP 优先级、评分表、discovery、Go / No-Go |
| `docs/sales/HELM_CHINA_FOUR_WEEK_PILOT_PACKAGE.md` | 4 周付费试点包、范围和成功指标 |
| `docs/sales/HELM_CHINA_DEMO_TO_PILOT_SALES_SCRIPT.md` | founder-led demo 到 paid pilot 销售路径 |
| `docs/sales/HELM_CHINA_PRICING_HYPOTHESIS_PACK.md` | 定价 hypothesis、workflow pack 和采购锚点 |
| `docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md` | 开源 / 商业边界与商业收入层 |
| `docs/brand/HELM_OPEN_SOURCE_COMMUNITY_DISTRIBUTION_PLAN_V1.md` | 开源社区、自媒体、媒体和实施工程师渠道假设 |
| `docs/roadmap/HELM_PUBLIC_ROADMAP.md` | 公开路线图、Now / Next / Later / Out of scope |
