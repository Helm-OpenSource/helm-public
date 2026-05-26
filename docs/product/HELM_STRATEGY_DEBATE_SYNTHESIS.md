---
status: active
owner: 创始人 / GTM / Product
created: 2026-04-30
review_after: 2026-05-15
archive_trigger:
  - Pack A 完成 10 通验证电话并形成 Top 2-3 scope call 决策包后，本文件被实跑复盘版替代
  - 第一个 Pack A paid pilot 完成 Week 1 review 后，本文件的 30/60/90 天路径被 pilot closeout 替代
  - Helm 不再以客户会议后的收入推进闭环作为首批商业化 wedge
---

# Helm 战略左右互博综合推演

## 1. 结论

Helm 的最佳路径不是扩成通用 agent 平台，也不是与 CRM、会议纪要、BI 正面竞争，而是把第一阶段钉死在 **客户会议后的收入推进闭环**：

> 会议、邮件、CRM、交付 handoff 进入 Helm 后，被压缩成今天必须由人拍板的 3 件事，每件事都有证据、边界、下一步和复核入口。

这条路径成立的前提不是文档已经完整，而是四个商业 / 产品前提被实证：

1. **Business Advancement calibration 能证明 Must Push 不是漂亮 demo**：至少 1 份 redacted/live-like calibration，top-5 与人工判断重合达到可接受水平，排序 deterministic，boundary incident = 0。
2. **Pack A design partner 能付费且给 proof**：不是免费 PoC，不是只想看会议纪要；能接受 ¥30k-50k 付费试点、每周 review、数据样本和匿名 proof。
3. **review-first 被包装为具体风险控制**：销售表达必须讲“避免错承诺、错外发、CRM 污染”，不要把“AI 不自动发送”作为第一卖点。
4. **founder-led sales 在 60 天内补一个 GTM 执行手**：否则第一笔 pilot 一启动，创始人被交付吞掉，pipeline 会断。
5. **定价口径能解释清楚**：`¥30k-50k` paid pilot 是 design partner 试点筛选器，不是会议纪要工具报价；`¥9,800 / ¥19,800 / ¥29,800` 属于通用试点 / 订阅假设，不能混在同一个首屏销售锚点里。

如果这五项任两项失败，Helm 应停止扩大产品面，回到内部 dogfooding、company-memory eval 和 Pack A wedge 重写。

## 2. 两路反方的关键分歧

| 议题 | 内部产品 / 架构反方 | 外部市场 / GTM 反方 | 综合判断 |
|---|---|---|---|
| 核心定位 | Must Push / review-first 是正确战略 | 买方可能觉得 review-first 是弱自动化 | 定位成立，但销售语言必须从“治理克制”改成“避免具体损失” |
| Business Advancement | 最大风险是把 disabled/local 写成 production | 没有 calibration 时 paid pilot Day-1 很危险 | Phase 3 calibration 是商业化硬前置，不是工程细节 |
| Pack A | 可以作为手册化 design partner 闭环 | 4 周 8/10 验收门无 baseline，可能首单翻车 | 第一个 pilot 改成分层验收：4/10 继续观察，6/10 续约谈判，8/10 才公开 proof |
| 开源 | 是采用引擎、标准层、伙伴入口 | 12 个月内几乎不带 B2B 客户 | 开源只作为信任与技术评审，不进 ARR 假设 |
| 渠道 | certified / partner 方向长期合理 | 12 个月内不该主动建 partner program | 合作伙伴推迟到 3 个 paid pilots 之后 |
| 公司记忆 | 是长期世界模型和 LLM economics 护城河 | 当前仍是 fixture/proxy，不能对外 claim | 先做 weekly scorecard + human reviewer，不宣传 production intelligence |

## 3. P0 薄弱环节

| 优先级 | 薄弱环节 | 失败模式 | 需要的证据 | 修正动作 | 领先指标 |
|---:|---|---|---|---|---|
| P0-1 | Phase 3 calibration 不足 | Must Push 与销售主管真实判断不重合，Day-1 被认为“只是总结” | redacted/live-like snapshot；人工 top-5 对照；Phase 3O/Q/R/S 结果 | paid pilot 前只用 read-first + manual review；runtime flag 继续关 | top-5 overlap >= 60%；boundary incident = 0 |
| P0-2 | ¥50k 付费锚点未验证 | 候选只要免费 PoC，或砍到无法覆盖 founder / 工程成本 | 8-10 通验证电话中至少 3 通明确预算 owner 和付费档位 | 测 ¥30k / ¥50k / ¥80k 三档；拒绝 0 元 PoC | >=3 通愿意讨论 >=¥30k |
| P0-3 | review-first 语言被误解 | 买方认为“不能自动发 / 改 CRM，所以没价值” | 电话中验证“错发 / 错承诺 / CRM 污染”真实事件 | 销售脚本改成“少错一次客户可见承诺”，不要先讲治理 | >=60% 候选认可复核价值 |
| P0-4 | founder-led pipeline 单点故障 | 第一笔 pilot 启动后创始人进入交付，候选新增归零 | 每周候选新增、电话数、warm intro 比例 | Day 45 前确定 GTM partner / SDR 代跑候选池 | 每周新增候选 >=10，warm intro >=50% |
| P0-5 | 公开 trial 承诺大于实现 | retention / delete / export / 法务 / 无 SLA 无法兑现 | Docker smoke、retention E2E、法务清单 | 公开 trial 只走 read-first demo；Pack A paid pilot 走私有 workspace | fresh clone success；delete proof 演练通过 |
| P0-6 | Pack A 验收门过硬无 baseline | 首个 pilot 低于 8/10 即被判失败，学习窗口关闭 | 内部 dogfooding baseline；A1-A4 真实采纳率 | 改分层验收，不把公开 proof 与继续试点混在一起 | Day-1 >=3.5/5；Week-1 采纳率趋势 |
| P0-7 | 公司记忆被对外夸大 | fixture/proxy 被写成 production analytics | weekly human scorecard；redacted cases | 对外只讲评估框架，不讲真实提升百分比 | reviewer score 趋势；production cases count |
| P0-8 | 开源与私有扩展叙事冲突 | 外界认为开源只是营销，核心能力藏在私有租户 | public/private boundary explainer | 提前准备“公开 core 与私有客户扩展边界”说明 | public-release guard + explainability |
| P0-9 | 定价口径冲突 | 买方把 Pack A 拉回会议纪要 / CRM 插件比价，或拿低价订阅假设反压 paid pilot | 每通 scope call 记录客户对 `¥30k / ¥50k / ¥80k` 的反应与预算来源 | 销售材料分清 design partner pilot、通用试点、订阅续约三层 | >=3 通愿意讨论 >=¥30k，且能复述 paid pilot 范围 |
| P0-10 | founder-led sales / delivery 没有分离 | 首单启动后创始人进入交付，候选池新增和后续 scope call 停摆 | 每周 founder 时间分配、候选新增、电话完成数、pilot 交付工时 | Day 45 前指定 GTM operator 或 implementation lead；创始人保留关键节点，不做全量执行 | founder delivery load <70%；候选新增不中断 |

## 4. 产品路径

### 4.1 现在只做三层产品

1. **Read-first Command Surface**：`/mobile` 和 `/dashboard` 继续作为“今天必须拍板的 3 件事”的展示面。
2. **Manual / Review-first Pack A Pilot Workspace**：第一个客户不依赖自动写回，不承诺自动外发，只承诺证据、草稿、复核、handoff proof。
3. **Company Memory Evaluation Loop**：公司记忆只作为评估与复利系统，先跑 weekly scorecard，不作为对外 production intelligence claim。

### 4.2 暂缓做的产品

1. 不做完整 agent orchestration。
2. 不做 marketplace。
3. 不做正式 partner certification runtime。
4. 不做 CRM / BI 替代。
5. 不把 TPQR-002 / TPQR-005 纳入五月窗口。
6. 不把 Skill 自动执行写进 Pack A 第一阶段。

### 4.3 必须保留的产品边界

- recommendation != commitment
- draft != send
- explanation != approval
- proof != public claim
- runtime scaffold != production adoption
- local rehearsal != live calibration
- company memory proxy != production analytics

## 5. 市场与销售路径

### 5.1 对外一句话

不要先说“AI 经营协同操作系统”。第一句改成：

> Helm 解决客户会议后 48 小时最容易丢的三件事：谁该跟、怎么跟、哪些不能承诺。

第二句再补：

> 它不是替你自动发送，而是在客户看到之前，把证据、边界、草稿和主管复核放到同一个推进面。

### 5.2 定价解释顺序

第一轮客户沟通只使用一个主锚点：

> Pack A design partner 是 4 周 paid pilot，默认测试 `¥30k / ¥50k / ¥80k` 三档，目标是验证收入推进断层、数据可得性、review 节奏和 proof 价值。

不要把通用中国市场试点价、未来订阅价、Enterprise 私有化价混在同一页首屏里。买方追问时按三层解释：

| 层 | 用途 | 当前口径 |
|---|---|---|
| Design partner paid pilot | 第一个真实 proof 与交付闭环 | `¥30k / ¥50k / ¥80k` 三档测试；不接受 0 元 PoC |
| 标准订阅 | pilot 后标准化续约 | Pack A Cloud 年付 `¥29,800-99,800`，以实际验收后报价为准 |
| Enterprise / Custom | 私有化、SLA、复杂连接器 | 单独评估，不进入首批 Pack A 销售首屏 |

### 5.3 ICP 优先级

| 优先级 | ICP | 理由 | 排除条件 |
|---:|---|---|---|
| 1 | 50-300 人 B2B SaaS / 企业软件，销售 5-20 人，客单价 >=¥50k | 决策链短、数据可导出、销售 owner 清晰 | 只要会议纪要、无销售负责人、只能免费 |
| 2 | AI 服务商 / SI / 咨询交付公司 | handoff 和承诺边界痛点强 | 决策链太长、客户数据不能脱敏 |
| 3 | 高客单传统数字化团队 | 痛点强，proof 价值高 | 内网 / 法务周期过长，不能 4 周闭环 |

### 5.4 验证电话必须问的问题

1. 最近 30 天有没有 3 个真实“会后漏推进 / 客户等待 / 销售承诺越界 / handoff 断层”的事件？
2. 如果解决，预算来自销售提效、RevOps、交付协同还是 AI 项目？谁审批？
3. 一周内能否给脱敏会议、CRM、handoff 样本？
4. 4 周后是否允许匿名指标、脱敏流程图或半公开 reference？
5. 是否接受“AI 准备，客户可见动作必须人点”？

### 5.5 Founder-Led 容量保护

第一个 pilot 可以 founder-led，但不能 founder-only。否则 Pack A 一启动，销售、交付、访谈、续约和 proof 全压到同一个人，90 天节奏会断。

| 角色 | 30 天内必须明确的责任 |
|---|---|
| Founder | 关键客户信任、scope call、Day-1 / Week-4 关键节点、最终 Go / Revise / No-Go |
| GTM operator | 候选池新增、电话排期、OPC 评分榜、follow-up 与 scope call 准备 |
| Implementation lead | Week 0 数据清单、连接器评估、review 节奏、Day-1 workspace 预演 |
| Codex / Claude | 脱敏材料准备、评分审计、文档同步、边界检查，不接触未授权客户原始数据 |

若 Day 45 前没有 GTM operator 或 implementation lead，第二个 design partner 不进入 kickoff。

## 6. GTM 能力建设路径

### 30 天

目标：不要卖产品，先验证 wedge。

Pass gates:

1. 20 个候选完成公开 + 私域初筛。
2. 8-10 通电话完成。
3. 至少 3 个候选 OPC >=75。
4. 至少 3 通明确预算 owner 和 >=¥30k 付费可能。
5. 至少 1 个候选数据接入分层为 A/B。
6. Phase 3 calibration 有明确输出或明确推迟 runtime。

Stop gates:

1. 大多数候选只要免费 PoC。
2. review-first 被 60% 以上候选理解为弱功能。
3. 30 天内没有任何可触达销售 VP / COO / founder。

### 60 天

目标：签第一个 paid pilot，但只承诺可控推进，不承诺自动化。

Pass gates:

1. Top 1 签 ¥30k-50k paid pilot 或等价分段结构。
2. DPA / 数据样本 / review 节奏 / proof 姿态明确。
3. Day-1 体验 >=3.5/5。
4. Week-1 至少看到 1 条真实 Must Push 被采纳或纠偏。

Stop gates:

1. 连接器 / 样本一周内拿不到。
2. 客户 owner 缺席 review。
3. 客户坚持自动外发 / 自动改 CRM。

### 90 天

目标：拿到第一份匿名 proof，并启动第二个 design partner。

Pass gates:

1. 第一个 pilot 至少 6/10 达成续约谈判，8/10 才进入公开匿名 case。
2. 第二个 design partner 进入 scope call。
3. founder 每周仍能新增 >=10 个候选，或已有 GTM partner 接手。

Stop gates:

1. 第一个 pilot <=6/10，且失败集中在 Must Push 判断质量。
2. 没有任何 proof 权限。
3. founder 时间被交付占用 >=70%，pipeline 已断。

## 7. 12 个月情景推演

以下是 scenario rehearsal，不是 forecast，不是承诺。

| 情景 | 核心假设 | 12 个月 paid pilots | 12 个月续约客户 | 12 个月 ARR / 订阅收入假设 | 目标口径 |
|---|---|---:|---:|---:|---|
| Conservative | calibration 推迟；review-first 被认为弱；founder 无 GTM 执行手 | 1-2 | 0-1 | ¥80k-150k | 可忽略，只证明是否活着 |
| Base | 60 天内 calibration 有输出；首个 pilot >=6/10；招到 GTM partner | 3-5 | 2-3 | ¥250k-450k | 在 founder network 小样本中形成 1 个可复用 wedge |
| Upside | 90 天内 2 个 proof；review-first 成为强差异；1 家 SI 主动转渠道 | 6-10 | 4-6 | ¥500k-900k | 仍不是市场占有率，只是垂直 wedge 的早期 proof |

不建议在 12 个月内追求“市场占有率”叙事。更合理的目标是：

1. 2 个可复用 proof。
2. 1 个能稳定复述的 ICP。
3. 1 套可交付 Pack A SOP。
4. 1 个非 founder 能跑的 GTM 工作流。
5. 0 起 boundary incident。

## 8. 渠道与合作伙伴方向

| 方向 | 结论 | 当前动作 |
|---|---|---|
| 开源 | 信任与技术评审，不是首批获客 | 保持 Apache-2.0、quickstart、integration issue 模板；不写 ARR 预期 |
| Certified implementer | 过早 | 第一个 pilot 由 Helm 官方 / 创始人圈层交付；3 个 pilot 后再认证 |
| 云厂商 | 暂缓 GTM 联合 | 只做部署与基础设施；不上云市场销售承诺 |
| 集成伙伴 | 只做单向接入 | 优先 DingTalk / WeCom / Gmail / 阿里邮箱 / HubSpot / Salesforce read-only |
| AI 服务商 / SI | 先做客户，后做渠道 | 如果某 SI 成为 design partner 且 proof 成立，再讨论实施伙伴 |

## 9. 立即决策项

| 决策 | 建议 |
|---|---|
| Pack A 是否继续 | 继续，但改成 evidence-first，不以产品完整度为前提 |
| 是否立即扩大产品实现 | 不扩大；先 calibration + pilot workspace |
| 是否保留 ¥50k | 保留为默认锚点，但电话中测试 ¥30k / ¥50k / ¥80k |
| 是否把 review-first 当销售主卖点 | 不直接这样卖；改成“减少错承诺 / 错外发 / CRM 污染” |
| 是否推进开源 | 推进，但不把开源写进商业获客目标 |
| 是否现在做渠道 | 不做；先拿 2-3 个 proof |
| 是否公开宣称公司记忆世界模型能力 | 不宣称生产能力；只讲评估框架和未来复利 |

## 10. 外部证据摘要

以下只作为方向性证据，不单独构成 Helm 对外 claim：

1. Gartner 预测 2025 年全球 GenAI 支出达 6440 亿美元，说明企业 AI 预算仍强，但不证明单个 AI agent 产品能落地。
2. McKinsey 2025 AI / agentic AI 相关公开材料与二手解读显示：企业实验多，规模化少，支持 Helm 保持 review-first / evidence-first。
3. 中国信通院 AI CRM 报告把 AI CRM 放入销售、服务、数据安全与选型框架，说明“AI + 客户经营”进入企业采购语境。
4. IDC 经纷享销客转述的 2025H1 中国 CRM SaaS 市场 10.8 亿美元、同比 14%，只可作为预算存在的二手信号，不能作为强 claim。
5. Otter / Zoom / Fireflies / Granola 等会议智能体正在从 transcript 走向 action items、CRM sync、follow-up drafts，说明会议总结已经红海化，Helm 必须上升到推进判断层。
6. Salesforce Agentforce、ServiceNow AI Platform、Clari Revenue Context、Gong Revenue AI OS 正在把 agent / revenue / workflow 平台化，Helm 不应做泛平台，而应做窄 wedge。

## 11. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-04-30 | 首版：基于 Codex 内部产品/架构反方、Claude 市场/GTM 反方、repo truth 与公开市场信号，收口 Helm 90 天产品 / 市场 / 销售 / GTM 路径 |
