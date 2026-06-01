---
status: draft
owner: helm-core
created: 2026-05-18
review_after: 2026-05-25
target_audience: delivery engineers building B2B operations systems on top of AI agent platforms (Coze / Wukong / Dify / LangGraph / general LLM frameworks)
public_safety: This file is intended for the public mirror. No tenant-private references; verticals named generically.
supersedes:
  - implicit competitor framing in README.md "为什么不是另一个 AI 工具" table
archive_trigger:
  - A V2 or later replaces it after first 5 delivery engineer adoptions
---

# Helm for Delivery Engineers

> AI 平台给你乐高积木。Helm 是已经搭好、可定制、有边界纪律的**经营推进闭环参考实现**。

## 一句话定位

> **Helm 不是另一个 agent 平台，也不是 LLM framework。它是一套面向 B 端经营场景、带完整边界纪律的参考实现 + 方法论，目标是让交付工程师在明确前置条件下约 4 周交付首个受控客户。**

---

## 这一页给谁看

你是：

- 用 Coze / 阿里悟空 / Dify / LangGraph / 通用 agent 平台**给企业客户做交付**的工程师
- 项目周期被卡在"客户业务我不懂，agent 怎么搭"
- 客户问"AI 会不会越权？建议会不会变成自动承诺？跨租户数据会不会串？" 而你需要一个**可被审计**的答案
- 想要一个**有意见的脚手架**，不是从零拼框架

那这一页是给你的。如果你是 CEO / 业务负责人在比较"该买谁的 SaaS"——本页不为你而写，看 [README](../../README.md) 主页。

---

## 核心问题

通用 agent 平台和 LLM framework 解决了**怎么搭**，没解决：

1. **该搭什么**——B 端客户真实诉求是"今天必须由谁拍板的 3 件事 + 为什么 + 边界"，不是一个聊天框
2. **怎么不出事**——AI 越权外发 / 自动承诺 / 跨租户串数据，平台不替你扛，你的客户会替你扛
3. **怎么交付得快**——每个客户从零建模 / 搭审批闸 / 写连接器 / 做 dashboard，你的人月被烧光

Helm 把这三件事**预先编码进一个开源参考实现**。Apache-2.0，可 fork，可商用。

---

## Helm vs 其他选项

|  | AI agent 平台<br/>(Coze / 悟空 / Dify) | LLM framework<br/>(LangGraph / LangChain) | **Helm** |
|---|---|---|---|
| 抽象层级 | 拖拉拽 / DAG 编辑器 | SDK + primitives | **有意见的整机 + 图纸** |
| 给你什么 | 积木 + 配置面板 | 抽象类 + utilities | **可工作的经营推进闭环 + vertical 参考实现** |
| 业务 domain 知识 | 你自带 | 你自带 | **内置：信号 / 案件 / 闭环 / 复核模型已建模** |
| Advice vs Commitment 边界 | 看你怎么配 | 看你怎么写 | **eval gate 编码强约束**（`commitment: "suggestion_only"` 不可变） |
| 多租户隔离 | 平台层（黑盒） | 你自己实现 | **`Deployment Profile` + `Tenant Overlay` 四层切割已设计** |
| 中文 connector（DingTalk / IMAP / 国内 SaaS） | 部分 | 你自己接 | **内置可工作样板** |
| 是否可全部 fork | 产品而异（Dify 可自托管；托管平台通常锁定） | 是（无 vertical） | **是（Apache-2.0 + vertical pack）** |
| 30 分钟跑通完整闭环 | 否 | 否 | **`docker compose up`** |
| 商业模式（对你） | 平台抽成 / 走他们渠道 | 你自定价 | **open-core**：fork 商用自营，Helm 不抽成 |
| 谁该用 | 搭对话型 agent 的人 | 搭通用 LLM 应用的人 | **做 B 端经营推进交付的工程师** |

> 这张表对比的是**类型**，不是具体产品当下的功能清单（平台会持续演进）。差异点是抽象层级与产品形态，不是某个版本的功能勾选。[Dify 官方文档](https://docs.dify.ai/)强调其 open-source / self-hostable 形态，本表按可视化编排型 AI 应用平台比较，不把 Dify 归入闭源锁定平台。

---

## 7 个可以直接复用的 value point

每条都有代码或当前 release gate 作证，不是商业承诺。

### 1. 行业纵向参考实现（带电池整机）

`extensions/<vertical>/` 是带电池的整机：完整 signal schema、worker driver preview、connector、BI report skill assets。目标路径是 **fork → 改 slug → 改 schema → 上线首个受控客户，节省 6-8 周建模时间**；实际周期依赖客户数据源、权限、复核人和连接器可用性。

v0.1 公开发布的 release gate 包含 **[`extensions/case-management-sample/`](../../extensions/case-management-sample/)** 脱敏参考 vertical（案件 / 客服 / 经营推进域）。当前已落的是最小公开参考 + worker / BI cookbook minimum slice：manifest、signal 类型、4 类 synthetic fixture、case mapper 测试、case allocation / stewardship driver cookbook、daily activity readout report skill assets。Docker / fresh-clone onboarding 的当前公开入口见 [docs/README.md](../README.md)；tenant-private 原版不在公开镜像中。

### 2. 边界 invariants 编码到 eval gate

`OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` 闭集、`commitment: "suggestion_only"` 写死、`crossTenantProjection: false` eval 硬拒、`raw_blocked → QUARANTINED` redaction 检查、`maxLlmTransitionCount: 0`。

代码：[`lib/operating-signal-flow/contract.ts`](../../lib/operating-signal-flow/contract.ts) + [`lib/evals/operating-signal-flow-evals.ts`](../../lib/evals/operating-signal-flow-evals.ts)。

客户问"AI 不会越权"时，你给他看 `npm run eval:operating-signal-flow` 的输出，不是文档承诺。**代码 + eval 是可审计证据；商业承诺仍以人工授权和合同为准**。

### 3. 完整 closure loop（不是只 readout）

信号采集 → 归一 → 评判 → 复核 → 推动 → 回执 → 学习，22 个 state 已建模 ([`lib/operating-signal-flow/contract.ts`](../../lib/operating-signal-flow/contract.ts))。

- BI 工具卡在 readout（"看到了"）
- 对话平台卡在对话（"聊清楚了"）
- agent 编排卡在执行（"做了一步"）
- **Helm 把闭环当一等公民**：发现 → 归责 → 复核 → 推动 → 留痕 → 学习，没有"做完一步就结束"

你卖给客户的核心叙事："不是看报表，是管动作"。

### 4. Opinionated worker 架构

`workers/*-driver-preview/` 模板已固化"建议+审批"和"只读信号"两种 driver 接口、不可变约束、单测固化模式。做新 driver 时**模板复用**，不需要每次重新设计审批闸门、`proposalKey` 去重、`requiresApproval` 默认值。

### 5. 多租户 / 多层级 / 多 connector 已设计完

[`lib/deployment-profile/contract.ts`](../../lib/deployment-profile/contract.ts) + [`lib/tenant-overlays/contract.ts`](../../lib/tenant-overlays/contract.ts)。open-core / cloud / enterprise / tenant-private 四层切割。

不需要替客户重写多租户隔离逻辑，**省一整轮架构评审**。

### 6. 双语 + 中国本地化原生

zh/en 在 contract 层（不只是翻译 README）；locale-aware projection 已做；DingTalk / IMAP / 阿里邮箱 / Qwen connector **在仓里**。

同时拿**中文交付市场和中文出海**两个场景，不必二选一。

### 7. Memory + recommendation 引擎可跨 deployment 复用

每个 deployment 的匿名化模式回流 memory 层，**越用越聪明**。这是网络效应的种子——多数 framework 没有。

随交付商规模扩张，Helm 的 reasoning 质量本身也在提升，**你的客户被动受益**。

---

## 30 分钟 onboarding 锚点

成功 = 在 30 分钟内完成以下可执行路径。当前第 3 / 4 步已有最小公开参考可读 / 可改；第 1 / 2 步的 Docker fresh-clone 路径已由 [D2 smoke receipt](../reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md) 验证。这个验证只证明 public Core quickstart，不代表商业发布、客户部署或 SLA 承诺。

1. `git clone <repo> && cd helm && docker compose up` — 起本地工作区
2. `open http://localhost:3000` — 看到 `/operating`（经营信号流图）、`/approvals`（复核闸）、`/memory`（经营记忆）三张已经可工作的面（⚠️ `/operating` 当前为 **Phase 2 fixture demo**；接入真实业务数据需 Phase 2.3 runtime adoption 解锁）
3. 读 [`extensions/case-management-sample/README.md`](../../extensions/case-management-sample/README.md) — 看一个 public-safe vertical 起点怎么组织
4. 改 [`extensions/case-management-sample/tenant.manifest.json`](../../extensions/case-management-sample/tenant.manifest.json) 的 slug + displayName — 你的客户 vertical 雏形开始成形
5. 跑 `npm run eval:operating-signal-flow` — 看到 7 类信号 / 10 类阻塞 / 22 个 state 哪里被你的 fixture 覆盖、哪里没覆盖
6. 读 [`docs/integrations/INTEGRATION_TEMPLATE.md`](../integrations/INTEGRATION_TEMPLATE.md)（**随 v0.1.0 一起开放**） — 接你客户的现有系统

走完这 6 步 = 你已经为客户做完了 90% 的脚手架工作。剩下的是 schema 定制、connector 适配、文案打磨。

> 如果 release 后你卡在某一步超过 5 分钟，去 GitHub Discussions 发帖。30 分钟跑不通是我们的 bug；release 前则触发 positioning collateral 的 No-Go / 降级路径。

---

## Helm Inc. 不卖什么 / 卖什么

**不卖**：

- ❌ SaaS 直销给端客户（你卖给端客户，Helm Inc. 不和你抢）
- ❌ fork / 商用 / 自营 license fee
- ❌ vertical pack 售卖（你想做的 vertical 自己 fork 自己卖）
- ❌ agent marketplace / plugin store
- ❌ LLM 编排平台

**卖**：

- ✅ open-core 持续维护 + 升级 + 文档（Apache-2.0，免费）
- ✅ Helm Cloud（托管版） — 可选；交付工程师不想自己部署时用
- ✅ Helm Enterprise（私有部署 + 商业 connector + 高级 audit / observability） — 可选；客户要求合规时用
- ✅ Certified Delivery Partner 认证 — 你的交付质量被 Helm 背书

开源 / 商业边界详见 [`docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`](../product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)。

---

## 核心纪律：Recommendation ≠ Commitment

这条是 Helm 的核心纪律，也是**你卖给客户的核心卖点**：

- **建议（Recommendation）**：系统建议，需人工复核
- **承诺（Commitment）**：具有业务影响的正式行动，必须明确授权
- 任何客户可见措辞，如可能被误读成承诺，会被显式降级为"边界备注 / 前置 / 依赖"

**eval gate 强制执行**。文档不是承诺；**代码 + eval 是可审计证据，正式承诺仍由人工授权和合同定义**。

详见 [AGENTS.md §6-§7](../../AGENTS.md)。

---

## 下一步

| 你想做 | 看这里 |
|---|---|
| 跑起来看一眼 | [README.md](../../README.md) 的 90 秒 demo |
| 跟踪公开 vertical 入口 | [docs/README.md](../README.md) |
| 接客户的系统 | [`docs/integrations/INTEGRATION_TEMPLATE.md`](../integrations/INTEGRATION_TEMPLATE.md)（随 v0.1.0 一起开放） |
| 理解开源 / 商业边界 | [`docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`](../product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md) |
| 申请 Certified Delivery Partner | [`docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md`](../product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) |
| 商业合作 / 联系我们 | 微信 `ffjw0821`（受控人工对接） |
| 加入社区 | 微信群邀请二维码（先加微信 `ffjw0821` 获取当期有效码） |
| 社交媒体 / 公众号 | 待补充（当前不作为承诺入口） |

---

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-18 | V1 初稿：以"对交付工程师"为唯一受众切换定位；引入 Coze/Wukong/Dify 与 LangGraph/LangChain 双轴差异表；列 7 个 code-backed value point + 30 分钟 onboarding 锚点 + 卖 / 不卖边界 |
| 2026-05-18 | V1 二稿：填实 `<reference-vertical>` → `case-management-sample`（从 tenant-private vertical pack 抽出），固化为 v0.1 发布物 |
| 2026-05-18 | V1 三稿：收紧至 4 周目标、Dify forkability、代码/eval 承诺口径，并给 `case-management-sample` 补上 release gate 防线 |
| 2026-05-18 | V1 四稿：`case-management-sample` 最小公开参考已落地；30 分钟 onboarding 从"等待目录"调整为"等待 fresh-clone 实跑验证" |
| 2026-06-01 | D2 Docker fresh-clone smoke 已落 receipt；公开 onboarding 口径改为 public Core quickstart 已验证，但不升级为商业发布或客户部署承诺 |
