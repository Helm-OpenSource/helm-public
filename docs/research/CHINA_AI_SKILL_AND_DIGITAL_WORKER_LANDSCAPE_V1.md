---
status: draft
owner: 创始人 / GTM
created: 2026-04-30
audit:
  - 与 docs/sales/packs/PACK_INDUSTRY_SELECTION_RESEARCH_V1.md 对齐（三个 Pack 选型 + 自营/生态裁决）
  - 与 docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md §4-§7 对齐（开源版 vs 商业版边界）
  - 与 docs/partners/HELM_AI_IMPLEMENTATION_ENGINEER_CERTIFICATION_STANDARD_V1.md 对齐（认证生态）
  - 与 docs/brand/HELM_OPEN_SOURCE_COMMUNITY_DISTRIBUTION_PLAN_V1.md 对齐（社区分发）
data_method:
  - Desktop research，公开资料抓取（web search + 官方文档 + 厂商博客 + 社区分析）
  - 未做客户访谈，所有数据点都标记为公开来源；如需更准确数字需补充客户/厂商访谈
archive_rule:
  - 6 个月后滚动更新（市场变化快），或 Helm 三个 Pack 全部公开发布后归档为决策记录
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# 中国 AI Skill 与数字员工市场景观调研 V1

## 1. 目的

在 Helm 三个行业 Pack（B2B SaaS / SI / 跨境电商）+ 认证 AI 实施工程师生态 + 开源核心 GTM 形态确立之后，**对中国市场的 AI Skill / 数字员工竞争对手与可借鉴对象做系统性 landscape 调研**，为 Pack 内部 Skill 设计、开源叙事、生态护城河给出可执行的输入。

**核心问题：**
- Helm 应不应该跟 ClawHub / SkillHub / 扣子 / 悟空 比 Skill 数量？
- Helm Pack 的 Skill 形态应该怎么设计？跟 OpenClaw 的 SKILL.md 自然语言式靠拢，还是另起炉灶？
- 我们的"建议 vs 承诺"边界在中国市场是不是真的差异化？
- 哪几家可以借鉴 / 哪几家可以联合 / 哪几家是直接竞品？

## 2. 关键发现速览

> 详细分析见 §3-§7。

1. **OpenClaw 已成为中国市场 AI 数字员工的事实开源参考**——~300K GitHub stars，ClawHub 13,000+ Skill，BAT 全部在围绕它做镜像、企业版、生态。**Helm 不应去抢 Skill 数量**；护城河必须在 Skill 之上的"推进闭环 + 推荐/承诺边界 + 可审计链"。
2. **国内 BAT 在 OpenClaw 上集体下场**：火山引擎+字节做官方中国镜像，腾讯做 SkillHub + QClaw（嵌入微信）+ ClawPro 企业版，阿里悟空在做"OpenClaw 兼容"的企业版 Skill 市场。**Helm 与这一层不直接冲突**——他们打"通用 builder"，Helm 打"行业 Pack 推进闭环"。
3. **Skill 设计范式正在从 JSON Schema 转向"自然语言操作手册"**（OpenClaw 的 SKILL.md 模式）。Helm 的 worker 家族目前是代码型；建议在 Pack 对外形态上**借鉴 SKILL.md 自然语言风格**，让认证工程师与客户都能读懂、可改、可审。
4. **三层防护（tool policy / sandbox / audit）成为行业最低门槛**——Helm 已有 worker 家族 + 边界 + audit chain；公开传播时需要把这套讲清楚，否则评审认为我们"还没到行业最低门槛"。
5. **"建议 vs 承诺"的人在环路边界是 Helm 真正的差异化点**——OpenClaw / 扣子 / 悟空 这一层都在比"自动执行能力"，没有人把"可审计的承诺/复核链"当卖点。这是 Helm 的护城河。
6. **数字员工赛道客户认知混乱**——"AI Bot / 智能体 / 数字员工 / Agent / Copilot"在中国市场被混用。Helm 应**统一对外用"数字员工 + 经营推进链"**的组合叙事，而不是再造词。

## 3. 调研对象池

按"产品形态 + 与 Helm 距离"两个维度分类：

| 类别 | 代表产品 | 与 Helm 关系 |
|---|---|---|
| **A 开源数字员工** | OpenClaw + ClawHub | 最直接的开源参考；Helm 不与其比规模，但需要 Skill 形态上对齐 |
| **B BAT 在 OpenClaw 上的封装** | 火山引擎 ClawHub 中国镜像、Tencent SkillHub / QClaw / ClawPro、ByteDance ArkClaw / ByteClaw | 间接竞品；同时是 Helm 可借鉴的"中国本地化封装"样板 |
| **C 大厂 Agent / Bot 平台** | 字节 Coze（扣子）、阿里悟空、阿里百炼、腾讯元器、百度千帆 AppBuilder | builder 平台 + Skill 商城；Helm 不与之同层竞争 |
| **D 数字员工（垂直）** | 商汤、追一科技、网易伏羲、京东 ChatRhino、微软小冰商业版 | 客服 / 数字人方向；与 Helm 主战场（销售推进/SI/跨境）不重叠 |
| **E 海外参照** | OpenAI GPT Store、Anthropic Skills、Microsoft Copilot Studio、HuggingFace Spaces | 对比中国本地化必要性 |

本文件聚焦 A、B、C 三类（直接相关）；D、E 简要列出对比项。

## 4. A 类：OpenClaw + ClawHub 深度解析

### 4.1 产品形态

OpenClaw 是开源 AI Agent 框架，定位为"自执行的初级数字员工"。在 IM 平台（飞书 / 钉钉 / Slack / Telegram / WhatsApp）上运行；用户用自然语言下达任务，Agent 在沙箱内执行代码、调用工具、写文件、发消息。

GitHub stars ~300K（搜索结果引用，待二次核实），是中国市场**事实上的开源 AI 数字员工标杆**。

### 4.2 架构（5 组件）

```
Gateway（WebSocket 网关，IM 渠道路由）
   └─ Brain（核心推理引擎，ReAct 循环 + LLM 编排）
        ├─ Skills（自然语言操作手册扩展）
        ├─ Memory（会话与长期记忆）
        └─ Tools（工具调用 + 沙箱执行）
```

**关键设计：**
- 消息通信、接口层、AI 思考与执行**完全解耦**
- Lane-based 命令队列：每会话独立 lane，默认串行，显式并行
- Sandbox 可插拔：Docker（默认本地）/ OpenShell（托管）/ SSH（远程主机）

### 4.3 Skills 系统（关键设计）

**SKILL.md 自然语言操作手册：**每个 Skill 是一个目录，包含 `SKILL.md` 定义文件 + 可选代码。SKILL.md 包含：
- 技能名称
- 功能描述
- 使用场景
- 调用方式
- 参数说明
- 示例

**与 MCP / JSON Schema 的关键差异：**
- MCP / 传统 function calling：需要把完整 schema 注入 LLM 上下文
- OpenClaw：三级加载策略——50 个 Skill 只占 ~1,200 token 固定开销，详情按需加载

**Agent 自生成 Skill：**用户用自然语言描述需求（例如"帮我做一个每晚备份 Documents 到 Dropbox 的 Skill"），Agent 自动生成 SKILL.md + 辅助脚本 + 测试 + 迭代修复。

### 4.4 安全治理（三层防护）

| 层 | 内容 |
|---|---|
| Tool Policy | 工具白名单、参数约束、调用前置策略 |
| Sandbox | Docker / OpenShell / SSH 隔离；scope = session / agent / shared |
| Audit | 用户消息、模型意图、拦截原因、最终动作全记录 |

**真正的硬约束来自 tool policy + exec approval + sandbox + 渠道白名单**，而非 system prompt。

### 4.5 ClawHub Skill Registry

- ~13,000 Skills（截至 2026-04）
- 命名空间：@username/SkillName 形式
- 版本化（v1.0.14、v2.3.0）
- 类别：Code Plugin / Bundle Plugin
- 主流类别：社交媒体 API（X/Instagram/TikTok 等）、记忆与知识、生产力工具、AI/Agent 基础设施、专业服务
- **认证机制**：Verified 徽章（官方/可信）；filter 支持 "Verified only" 与 "Executes code"
- **发布**：开放提交，但有分级（Verified / 普通）

**对 Helm 的启示：** ClawHub 的"开放提交 + Verified 分级"模式与 Helm 的认证工程师 L1/L2/L3 分级**思路一致**——市场化供给 + 平台做资格认定。

## 5. B 类：BAT 在 OpenClaw 上的封装

### 5.1 火山引擎 ClawHub 中国镜像（字节）

- 2026-04-02 启动，OpenClaw 官方授权的中国镜像
- 解决国内访问延迟与稳定性
- **不做内容修改、不做审核**，纯镜像

**含义：** 字节把"OpenClaw 中国基础设施"占住了，但没动 Skill 内容层。

### 5.2 Tencent SkillHub（腾讯）

- 2026-03-11 上线，**非镜像，是再加工的中国版社区**
- 收录 ClawHub 全部 13,000 Skills
- **做了三件事**：
  1. 全量中文翻译
  2. 官方精选（50 个优质 Skill）
  3. 安全审计（部分 Skill）
- 适合"刚养龙虾"（指 OpenClaw 入门）的用户
- 接入路径：腾讯云轻量服务器一键安装 / 自建环境命令行 / 官网复制安装命令

**对 Helm 的启示：**
- "翻译 + 精选 + 审计"是中国市场 Skill 生态的**典型本地化策略**
- Helm 的 Cookbook + 认证工程师案例，完全可以走类似路径——把好的客户落地脱敏后翻译并精选发布

### 5.3 Tencent QClaw（微信小程序版）

- 2026-03 发布
- **OpenClaw 嵌入微信，触达微信 13 亿用户**
- 个人/轻办公场景

**含义：** 腾讯把 C 端流量入口拿走了。Helm 不在 C 端竞争，所以这不是直接威胁，但是**"AI 数字员工"概念在 C 端被推广，对 Helm B 端教育成本反而是利好**。

### 5.4 Tencent ClawPro（腾讯企业版）

- 基于 OpenClaw 的企业 Agent 平台
- 主打企业部署 + 与微信生态集成

**对 Helm 的影响：** 与 Helm Cloud / Enterprise 在企业部署层有一定竞争——但 ClawPro 偏 builder + Skill 市场，Helm 偏行业 Pack 推进闭环。**目前差异化清晰**，未来 12 个月需要观察是否模糊。

### 5.5 ByteDance ArkClaw / ByteClaw（字节企业版 / 内部版）

- ArkClaw：组织级产品
- ByteClaw：内部使用
- 资料较少，本期不深挖

## 6. C 类：大厂 Agent / Bot 平台

### 6.1 字节扣子 Coze

- 中国市场用户基数最大、品牌认知最高的 Agent 应用开发平台
- 60+ 插件，0 代码搭 Bot（类 GPTs）
- 2026 年新增：Agent Office（深度工作场景）、Agent Coding（云开发）、视频创作
- **新发布全球 Skills Store**：用户用自然语言描述专业经验 → 生成可交易的 AI Skill（"经验交易市场"）
- **商业模式**：B 端开发者按模型消耗 + 应用使用付费；C 端订阅；高级 Agent 平台抽成
- **目标客户**：大企业研发部、SMB 商业运营、个人效率用户

**与 Helm 关系：**
- Coze = builder 层（让用户造 Bot）
- Helm = 行业 Pack 推进层（让企业用成型方案推进收入闭环）
- **同层不竞争**；客户可以"用 Coze 自造 Bot + 用 Helm 做承诺/复核审计"

### 6.2 阿里悟空（DingTalk WuKong）

- 2026 年发布，企业级 AI 原生工作平台，钉钉深度集成
- 内置安全沙箱、自动继承企业权限、审计链
- **AI 能力市场**：Skill 开发、审核、上架、分发全链路体系
- **声称兼容开源 Skill 体系**，目标"最大的 toB Skill 市场"
- 阿里生态接入：淘宝、天猫、1688、支付宝、阿里云

**与 Helm 关系：**
- 悟空 = 钉钉生态 Skill 市场 + 企业 Agent 运行时
- Helm 之前裁决：**不上钉钉应用市场**——因为悟空本身就要做"最大的 toB Skill 市场"，Helm 进去会被位格挤压
- **正确策略**：Helm 走开源 + 大厂高人气社区 + 公众号 + 认证工程师生态四级链路（已在分发计划 V1 落地）

### 6.3 阿里云百炼

- 一站式大模型开发平台，依托通义大模型
- 优点：结构简洁、功能完整
- 缺点：应用广场和插件广场不完善
- 受众：开发者 + 企业 IT

**与 Helm 关系：** 百炼 = 模型开发平台。Helm 不与之同层。但百炼可作为 Helm 的模型供应（Helm 不绑定单一模型供应商）。

### 6.4 腾讯元器

- 基于混元大模型的智能体制作平台
- 灵活创建（插件、知识库、工作流）
- 发布到 QQ、微信
- **优点**：灵活；**缺点**：功能纵深不及扣子/悟空

**与 Helm 关系：** 间接相关，C 端为主，不直接竞争。

### 6.5 百度千帆 AppBuilder

- 基于文心大模型，AI 原生应用工作台
- 提供 RAG、Agent 框架与多模态能力
- 大模型模式 + 工作流模式
- **优点**：轻量；**缺点**：功能纵深不足，缺模型深度管理与数据运营

**与 Helm 关系：** 间接相关。

### 6.6 大厂 Agent 平台横向对比

| 维度 | 扣子 | 悟空 | 百炼 | 元器 | 千帆 |
|---|---|---|---|---|---|
| 定位 | C 端 + B 端 builder | B 端企业 + 钉钉生态 | 模型与开发平台 | 创作灵活 | RAG + Agent |
| Skill 生态 | 全球 Skills Store | AI 能力市场（toB） | 插件广场（弱） | 插件 + 知识库 | 多模态组件 |
| OpenClaw 兼容 | 部分（火山引擎背景） | 声称兼容 | 否 | 否 | 否 |
| 商业模式 | 模型调用 + 抽成 + 订阅 | 钉钉企业付费 + Skill 抽成 | 模型调用 | 待定 | 模型调用 |
| 核心客群 | 开发者 + SMB | 钉钉企业 | 阿里云客户 | C 端 | 文心客户 |

## 7. D / E 类：参照对比（简要）

### 7.1 D 类：垂直数字员工

| 厂商 | 主战场 | 与 Helm 关系 |
|---|---|---|
| 商汤数字员工 | 数字人 + 客服 | 不重叠（Helm 不做数字人） |
| 追一科技 | 客服与营销机器人 | 不重叠（Helm 不做客服） |
| 网易伏羲 | 数字人创作 | 不重叠 |
| 京东 ChatRhino | 电商客服 | 部分重叠（Pack C 跨境电商） |
| 微软小冰商业版 | 情感陪伴 + 客服 | 不重叠 |

### 7.2 E 类：海外参照

| 平台 | 模式 | 对中国市场启示 |
|---|---|---|
| OpenAI GPT Store | C 端为主，App Store 模式 | 中国不可直接复制（合规/支付） |
| Anthropic Skills | 开发者工具优先 | 与 OpenClaw SKILL.md 思路接近 |
| Microsoft Copilot Studio | 企业级 Agent builder | 与悟空类似 |
| HuggingFace Spaces | 开源 demo 托管 | 偏开发者，与 ClawHub 互补 |

**核心结论：** OpenClaw 的开源 + 自然语言 SKILL.md + 中国 BAT 全部封装的格局，是**全球独一份的中国市场结构**。Helm 必须在这个结构里找到自己的位置。

## 8. 与 Helm 的差异化分析

### 8.1 Skill 数量 vs Skill 闭环

```
ClawHub / SkillHub：13,000 Skills，量大
扣子全球 Skills Store：经验交易市场，量大
悟空 AI 能力市场：声称要做最大 toB Skill 市场

Helm 三个 Pack：每 Pack 4 个 Skill，**共 12 个 Skill**
```

**结论：** Helm 不与 Skill 数量竞争。**Helm 卖的是 4 个 Skill 组成的"会议→判断→复核→留痕"推进链**——这是一个完整闭环，竞争对手卖的是"散件"。

### 8.2 自动执行 vs 推荐/承诺

| 厂商 | 默认行为 |
|---|---|
| OpenClaw | 在沙箱内自动执行（默认）；危险操作走 exec approval |
| 扣子 | Bot 默认按指令执行 |
| 悟空 | 沙箱 + 权限自动继承，企业内自动执行 |
| **Helm** | **默认全部"建议"，对外动作必须人工复核** |

**这是 Helm 真正的差异化点**——竞争对手都在比"自动执行能力"，Helm 在比"可审计的承诺/复核链"。

**关键风险：** 如果中国客户接受度更倾向于"自动执行"，Helm 的差异化会被市场打折。**对策**：用三个 Pack 的"管理者关注、承诺审核、Handoff Pack"等场景**证明"建议优先"在企业治理上的价值**——不是技术保守，是合规与可审计的必然。

### 8.3 Skill 设计形态

| 维度 | OpenClaw SKILL.md | Helm worker 家族 |
|---|---|---|
| 形态 | 自然语言 + 可选代码 | TypeScript 代码 + 类型化接口 |
| 受众 | 任何人 | 开发者 / Helm 工程师 |
| 修改门槛 | 低（写 markdown） | 中（改 TS 代码） |
| 可审计性 | 中（自然语言模糊） | 高（类型 + 测试） |
| LLM 上下文开销 | 低（三级加载） | 高（schema 注入） |

**Helm 的位置：** worker 家族适合 Pack 内核（高可审计、强类型），但**对外暴露给认证工程师与客户的 Skill 形态应借鉴 SKILL.md**——让 L2 工程师能读懂、改 SKILL 描述，而 worker 实现保持类型化。

**建议设计：**
```
Pack X
├─ Skill X1
│   ├─ SKILL.md（自然语言操作手册，L1+ 可读可改）
│   └─ implementation/
│       └─ X1-worker.ts（worker 实现，闭源/商业版）
├─ Skill X2
└─ ...
```

### 8.4 治理层

| 层 | OpenClaw / 悟空 | Helm |
|---|---|---|
| Tool policy | ✅ | ✅ worker 边界 |
| Sandbox | ✅ Docker / OpenShell | ⚠️ 需要明确 |
| Audit | ✅ | ✅ 推进链全审计 |
| **承诺/复核链** | ❌ | ✅ Helm 独有 |
| **不掉案件 invariant** | ❌ | ✅（来自脱敏行业样板经验）|

**结论：** Helm 在 tool policy + audit 层与行业平齐；**sandbox 层需要明确**（是否要 Docker 隔离、是否要 sandbox 后端可插拔）；**承诺/复核 + 不掉案件 invariant** 是 Helm 独有。

## 9. 战略建议（给 Helm GTM / Pack / 开源叙事的输入）

### 9.1 对外叙事（给 Helm 公众号 / 知乎 / GitHub README）

**核心一句话：**
> 中国 AI 数字员工赛道在 2026 年已经分化为三层：开源底座（OpenClaw）、大厂 builder（扣子/悟空），以及行业落地（Helm）。Helm 不与底座或 builder 竞争——我们在它们之上做"经营推进的判断 + 承诺 + 复核"，让企业的 AI 数字员工真正进入收入与交付的可审计链路。

**叙事三段：**
1. **致敬开源底座**——OpenClaw / ClawHub / SkillHub 是了不起的开源工作；Helm 也开源核心
2. **划清 builder 位**——扣子、悟空是 Skill 商城和 Agent 编排，Helm 是行业经营 Pack
3. **打出差异化**——"建议 vs 承诺"、"会议→推进链"、"不掉案件 invariant"是 Helm 独有

### 9.2 Pack Skill 形态（给 Pack A/B/C 设计的输入）

| 决策 | 建议 |
|---|---|
| Skill 命名 | 借鉴 OpenClaw 命名空间（@helm/A1-meeting-followup 风格） |
| Skill 文档 | 每个 Skill 配 SKILL.md（自然语言），让 L1+ 工程师可读 |
| Skill 实现 | worker 家族 TS 代码（闭源/商业版） |
| Skill 触发 | 走会议、IM、CRM 事件驱动 + 工程师自定义 |
| Skill 加载策略 | 学习 OpenClaw 三级加载，降低 LLM 上下文开销 |
| Skill 复核点 | 强制——任何对外动作走"建议 → 人工确认"通道 |
| Skill 沙箱 | Pack A/B/C 商业版默认 Docker 隔离（与 OpenClaw 持平） |
| Skill 审计 | 全部进入 Helm audit chain（已有） |

### 9.3 生态/分发（给社区分发计划 V1 的补充）

| 行动 | 说明 |
|---|---|
| 1. **GitHub helm-cookbook 同步发到 ClawHub** | 把脱敏后的 Pack 案例做成 ClawHub Skill，免费曝光给 ~OpenClaw 用户群 |
| 2. **写一篇"OpenClaw vs Helm"对照博客** | 知乎/InfoQ；不打架，划位置 |
| 3. **观察 Tencent SkillHub 精选机制** | 如果 SkillHub 愿意精选 Helm Cookbook Skill，是免费的中国市场曝光 |
| 4. **不上钉钉悟空 AI 能力市场** | 已裁决；保持四级分发链路独立 |
| 5. **认证工程师 L2/L3 可发 SKILL.md 到 ClawHub** | 把认证工程师生态接到全球开发者社区 |

### 9.4 不做清单

| 不做 | 理由 |
|---|---|
| 不做 builder 平台（与扣子/悟空同层竞争） | 失败概率极高，会被 BAT 流量碾压 |
| 不做 Skill 商城（与 ClawHub/SkillHub 同层竞争） | 不在赛道，没意义 |
| 不做 C 端 Bot / 数字人 | Helm 是 B 端经营运行时 |
| 不做钉钉 AI 能力市场（悟空内）入驻 | 已裁决 |
| 不做模型供应（与百炼/千帆同层竞争） | Helm 应支持多模型供应商，不绑定 |

## 10. 后续深挖建议（待创始人拍板）

本期 landscape 完成。下一步建议**深挖 2-3 家**：

### 优先级 1（必做）
- **OpenClaw / ClawHub 深度技术调研**——读源码、跑 demo、理解 SKILL.md 加载机制；产出 `docs/research/competitor/OPENCLAW_TECHNICAL_DEEP_DIVE_V1.md`
- **腾讯 SkillHub 精选机制 + 安全审计**——他们怎么做精选；产出 `docs/research/competitor/TENCENT_SKILLHUB_CURATION_V1.md`

### 优先级 2（建议做）
- **阿里悟空 AI 能力市场对 toB SaaS 公司的吸引力**——这影响 Helm 的销售对话；可访谈 1-2 家已上悟空市场的公司
- **扣子全球 Skills Store 经验交易市场**——是否会冲击 Helm 认证工程师生态？

### 优先级 3（可选）
- **海外 Anthropic Skills 与 OpenClaw 的差异**——理解全球 Agent 标准走向

## 11. 数据来源（公开资料 desktop research）

> 本节列出本调研涉及的公开来源。所有数字（如 GitHub stars、Skill 数量、用户基数）来自搜索结果引用，未经厂商二次核实；如做 GTM 决策依据需补充客户/厂商访谈。

### OpenClaw / ClawHub
- ClawHub 官网：https://clawhub.ai
- OpenClaw 官方文档：https://docs.openclaw.ai
- 知乎《OpenClaw 超完整解说》《Skills 扩展系统》系列
- 火山引擎《OpenClaw 安全最佳实践》
- 慢雾《OpenClaw 极简安全实践指南》

### Tencent SkillHub / QClaw / ClawPro
- SkillHub 官网：https://skillhub.tencent.com
- 腾讯云开发者社区《SkillHub 上线》
- The Next Web《Tencent launches ClawPro》

### 字节 ClawHub 中国镜像 / 扣子 / ArkClaw
- 火山引擎开发者社区
- AI 工具集 ClawHub 镜像页
- 知乎《扣子 2.0 发布》《Coze/扣子调研与思考》

### 阿里悟空 / 百炼
- IT 之家、新华网、量子位 关于悟空发布报道
- 阿里云百炼官方文档

### 腾讯元器 / 百度千帆
- 知乎《四大厂 Agent 平台对比》
- 火山引擎《LLM 应用低代码开发对比》

### 海外参照
- OpenAI GPT Store / Anthropic Skills 公开文档（未深挖）

## 12. 决策与下一步

**待创始人拍板：**

1. §9.2 **Skill 形态建议**——是否采用"SKILL.md 自然语言 + worker TS 实现"双层结构？这影响 Pack A/B/C 技术规范设计
2. §9.3 **helm-cookbook 同步发 ClawHub**——是否同意把脱敏案例当 Skill 发到全球开源社区免费曝光？
3. §10 **后续深挖优先级**——是否同意 P1 两份（OpenClaw 技术深挖 + SkillHub 精选机制）作为下一步？
4. §9.1 **对外叙事三段式**是否采用？这是公众号首篇文章的骨架

## 13. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 首次落地。OpenClaw + ClawHub 主结构；BAT 封装 + 大厂 builder 平台横向对比；Helm 差异化分析；Pack 设计输入 |
