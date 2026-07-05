---
status: draft
owner: helm-core
created: 2026-05-18
review_after: 2026-05-25
target_audience: delivery engineers building enterprise AI operations systems on top of AI agent platforms (Coze / Wukong / Dify / LangGraph / general LLM frameworks)
public_safety: This file is intended for the public mirror. No tenant-private references; verticals named generically.
supersedes:
  - implicit competitor framing in README.md "为什么不是另一个 AI 工具" table
archive_trigger:
  - A V2 or later replaces it after first 5 delivery engineer adoptions
---

# Helm for Delivery Engineers

> AI 平台给你乐高积木。Helm 是已经搭好、可定制、有边界纪律的**经营推进闭环参考实现**。

## 一句话定位

> **Helm 不是另一个智能体平台，也不是大模型框架。它是一套面向企业 AI 经营推进场景、带完整边界纪律的参考实现 + 方法论，目标是让交付工程师把客户业务落地里的判断 / 证据 / 复核 / 边界 / 交付包做成可复刻的工程结构。**

---

## 这一页给谁看

你是：

- 用 Coze / 阿里悟空 / Dify / LangGraph / 通用智能体平台**给企业客户做交付**的工程师
- 项目周期被卡在"客户业务我不懂，智能体怎么搭"
- 客户问"AI 会不会越权？建议会不会变成自动承诺？跨租户数据会不会串？" 而你需要一个**可被审计**的答案
- 想要一个**有意见的脚手架**，不是从零拼框架

那这一页是给你的。如果你是 CEO / 业务负责人在比较"该买谁的 SaaS"——本页不为你而写，看 [README](../../README.md) 主页。

---

## 核心问题

通用智能体平台和大模型框架解决了**怎么搭**，没解决：

1. **该搭什么**——企业客户真实诉求是"今天必须由谁拍板的 3 件事 + 为什么 + 边界"，不是一个聊天框
2. **怎么不出事**——AI 越权外发 / 自动承诺 / 跨租户串数据，平台不替你扛，你的客户会替你扛
3. **怎么交付得快**——每个客户从零建模 / 搭审批闸 / 写连接器 / 做 dashboard，你的人月被烧光

Helm 把这三件事**预先编码进一个开源参考实现**。Apache-2.0，可复刻，可商用。

---

## Helm vs 其他选项

|  | AI 智能体平台<br/>(Coze / 悟空 / Dify) | 大模型框架<br/>(LangGraph / LangChain) | **Helm** |
|---|---|---|---|
| 抽象层级 | 拖拉拽 / DAG 编辑器 | SDK + 基础构件 | **有意见的整机 + 图纸** |
| 给你什么 | 积木 + 配置面板 | 抽象类 + 工具函数 | **可工作的经营推进闭环 + 纵向参考实现** |
| 业务 domain 知识 | 你自带 | 你自带 | **内置：信号 / 案件 / 闭环 / 复核模型已建模** |
| 建议 / 承诺边界 | 看你怎么配 | 看你怎么写 | **评测门禁编码强约束**（`commitment: "suggestion_only"` 不可变） |
| 多租户隔离 | 平台层（黑盒） | 你自己实现 | **`Deployment Profile` + `Tenant Overlay` 四层切割已设计** |
| 中文连接器（DingTalk / IMAP / 国内 SaaS） | 部分 | 你自己接 | **内置可工作样板** |
| 是否可全部复刻 | 产品而异（Dify 可自托管；托管平台通常锁定） | 是（无纵向方案） | **是（Apache-2.0 + 纵向方案包）** |
| 可复刻的本地闭环 | 否 | 否 | **`docker compose up` + Golden Path 检查** |
| 商业模式（对你） | 平台抽成 / 走他们渠道 | 你自定价 | **开放核心**：复刻商用自营，Helm 不抽成 |
| 谁该用 | 搭对话型智能体的人 | 搭通用大模型应用的人 | **做企业 AI 经营推进交付的工程师** |

> 这张表对比的是**类型**，不是具体产品当下的功能清单（平台会持续演进）。差异点是抽象层级与产品形态，不是某个版本的功能勾选。[Dify 官方文档](https://docs.dify.ai/)强调其 open-source / self-hostable 形态，本表按可视化编排型 AI 应用平台比较，不把 Dify 归入闭源锁定平台。

---

## 7 个可以直接复用的价值点

每条都有代码或当前发布门禁作证，不是商业承诺。

### 1. 行业纵向参考实现（带电池整机）

`extensions/<vertical>/` 是带电池的整机：信号模式、工作器驱动预览、连接器、BI 报告技能资产。目标路径是 **复刻 → 改 slug → 改 schema → 跑 Golden Path 检查 → 准备受控试点复核包**；实际周期依赖客户数据源、权限、复核人和连接器可用性。

v0.1 公开发布的发布门禁包含 **[`extensions/case-management-sample/`](../../extensions/case-management-sample/)** 脱敏参考纵向方案（案件 / 客服 / 经营推进域）。当前已落的是最小公开参考 + 工作器 / BI 作业指南最小切片：manifest、signal 类型、4 类合成夹具、case mapper 测试、case allocation / stewardship driver cookbook、daily activity readout report skill assets。Docker / 全新克隆上手的当前公开入口见 [docs/README.md](../README.md)；租户私有原版不在公开镜像中。

### 2. 边界不变量编码到评测门禁

`OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` 闭集、`commitment: "suggestion_only"` 写死、`crossTenantProjection: false` 评测硬拒、`raw_blocked → QUARANTINED` 脱敏检查、`maxLlmTransitionCount: 0`。

代码：[`lib/operating-signal-flow/contract.ts`](../../lib/operating-signal-flow/contract.ts) + [`lib/evals/operating-signal-flow-evals.ts`](../../lib/evals/operating-signal-flow-evals.ts)。

客户问"AI 不会越权"时，你给他看 `npm run eval:operating-signal-flow` 的输出，不是文档承诺。**代码 + 评测是可审计证据；商业承诺仍以人工授权和合同为准**。

### 3. 完整闭环（不是只读数）

信号采集 → 归一 → 评判 → 复核 → 推动 → 回执 → 学习，22 个状态已建模 ([`lib/operating-signal-flow/contract.ts`](../../lib/operating-signal-flow/contract.ts))。

- BI 工具卡在读数（"看到了"）
- 对话平台卡在对话（"聊清楚了"）
- 智能体编排卡在执行（"做了一步"）
- **Helm 把闭环当一等公民**：发现 → 归责 → 复核 → 推动 → 留痕 → 学习，没有"做完一步就结束"

你卖给客户的核心叙事："不是看报表，是管动作"。

### 4. 有意见的工作器架构

`workers/*-driver-preview/` 模板已固化"建议+审批"和"只读信号"两种驱动接口、不可变约束、单测固化模式。做新驱动时**模板复用**，不需要每次重新设计审批闸门、`proposalKey` 去重、`requiresApproval` 默认值。

### 5. 多租户 / 多层级 / 多连接器已设计完

[`lib/deployment-profile/contract.ts`](../../lib/deployment-profile/contract.ts) + [`lib/tenant-overlays/contract.ts`](../../lib/tenant-overlays/contract.ts)。开放核心 / 云托管 / 企业版 / 租户私有四层切割。

不需要替客户重写多租户隔离逻辑，**省一整轮架构评审**。

### 6. 双语 + 中国本地化原生

zh/en 在契约层（不只是翻译 README）；按语言环境投影已做；DingTalk / IMAP / 阿里邮箱 / Qwen 连接器 **在仓里**。

同时拿**中文交付市场和中文出海**两个场景，不必二选一。

### 7. 记忆 + 推荐引擎可跨部署复用

每个部署的匿名化模式回流记忆层，**越用越聪明**。这是网络效应的种子——多数框架没有。

随交付商规模扩张，Helm 的推理质量本身也在提升，**你的客户被动受益**。

---

## 黄金路径上手锚点

成功 = 完成以下可执行路径，并让本地检查链证明判断、证据、复核、边界仍然保持复核优先。第 1 / 2 步的 Docker 全新克隆路径已由 [D2 冒烟回执](../reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md) 验证，只证明公开 Core 快速启动，不代表商业发布、客户部署或 SLA 承诺。分钟标签只作为导航参考，不是 SLA、上线承诺或客户部署证明。

1. `git clone https://github.com/Helm-OpenSource/helm-public.git && cd helm-public && docker compose up` — 起本地工作区
2. `open http://localhost:3000` — 看到 `/operating`（经营信号流图）、`/approvals`（复核闸）、`/memory`（经营记忆）三张已经可工作的面（⚠️ `/operating` 当前为 **Phase 2 夹具演示**；接入真实业务数据需 Phase 2.3 运行时采用解锁）
3. 读 [`extensions/case-management-sample/README.md`](../../extensions/case-management-sample/README.md) — 看一个公开安全纵向方案起点怎么组织
4. 改 [`extensions/case-management-sample/tenant.manifest.json`](../../extensions/case-management-sample/tenant.manifest.json) 的 slug + displayName — 你的客户纵向方案雏形开始成形
5. 跑 `npm run eval:operating-signal-flow` — 看到 7 类信号 / 10 类阻塞 / 22 个状态哪里被你的夹具覆盖、哪里没覆盖
6. 读 [`docs/integrations/INTEGRATION_TEMPLATE.md`](../integrations/INTEGRATION_TEMPLATE.md) — 接你客户的现有系统

走完这 6 步 = 你已经看到了可复刻工程结构的核心骨架。剩下的是数据模式定制、连接器适配、文案打磨和人工复核。

> 如果你卡在某一步，去 GitHub Discussions 发帖。黄金路径跑不通时，先按门禁降级，不把它写成已经验证的对外承诺。

---

## Helm Inc. 不卖什么 / 卖什么

**不卖**：

- ❌ SaaS 直销给端客户（你卖给端客户；Helm Inc. 仅保留少量具名直营灯塔客户打磨方法论与 Pack，在其之外不和你抢）
- ❌ 复刻 / 商用 / 自营授权费
- ❌ 纵向方案包售卖（你想做的纵向方案自己复刻自己卖）
- ❌ 智能体市场 / 插件商店
- ❌ 大模型编排平台

**卖**：

- ✅ 开放核心持续维护 + 升级 + 文档（Apache-2.0，免费）
- ✅ Helm Cloud（托管版） — 可选；交付工程师不想自己部署时用
- ✅ Helm Enterprise（私有部署 + 商业连接器 + 高级审计 / 可观测性） — 可选；客户要求合规时用
- ✅ Certified Delivery Partner 认证 — 你的交付质量被 Helm 背书

开源 / 商业边界详见 [`docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`](../product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)。

---

## 核心纪律：建议不等于承诺

这条是 Helm 的核心纪律，也是**你卖给客户的核心卖点**：

- **建议（Recommendation）**：系统建议，需人工复核
- **承诺（Commitment）**：具有业务影响的正式行动，必须明确授权
- 任何客户可见措辞，如可能被误读成承诺，会被显式降级为"边界备注 / 前置 / 依赖"

**评测门禁强制执行**。文档不是承诺；**代码 + 评测是可审计证据，正式承诺仍由人工授权和合同定义**。

详见 [AGENTS.md §6-§7](../../AGENTS.md)。

---

## 下一步

| 你想做 | 看这里 |
|---|---|
| 跑起来看一眼 | [README.md](../../README.md) 的 90 秒 demo |
| 跟踪公开纵向方案入口 | [docs/README.md](../README.md) |
| 接客户的系统 | [`docs/integrations/INTEGRATION_TEMPLATE.md`](../integrations/INTEGRATION_TEMPLATE.md) |
| 理解开源 / 商业边界 | [`docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`](../product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md) |
| 申请 Certified Delivery Partner | [`docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md`](../product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) |
| 商业合作 / 联系我们 | 微信 `ffjw0821`（受控人工对接） |
| 加入社区 | 微信 `ffjw0821`（社群邀请由人工受控对接） |
| 微信公众号 | `Helm开源经营系统` · 微信号 `HelmCoreCN`（信息发布入口，非默认支持工单入口） |

---

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-18 | V1 初稿：以"对交付工程师"为唯一受众切换定位；引入 Coze/Wukong/Dify 与 LangGraph/LangChain 双轴差异表；列 7 个有代码支撑的价值点 + 30 分钟上手锚点 + 卖 / 不卖边界 |
| 2026-05-18 | V1 二稿：填实 `<reference-vertical>` → `case-management-sample`（从租户私有纵向方案包抽出），固化为 v0.1 发布物 |
| 2026-05-18 | V1 三稿：收紧早期交付目标口径、Dify 可复刻性、代码 / 评测承诺口径，并给 `case-management-sample` 补上发布门禁防线 |
| 2026-05-18 | V1 四稿：`case-management-sample` 最小公开参考已落地；30 分钟上手从"等待目录"调整为"等待全新克隆实跑验证" |
| 2026-06-01 | D2 Docker 全新克隆冒烟回执已落；公开上手口径改为公开 Core 快速启动已验证，但不升级为商业发布或客户部署承诺 |
