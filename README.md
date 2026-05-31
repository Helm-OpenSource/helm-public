> **语言 / Language**：**中文** · [English](README.en.md)

# Helm

### AI 平台给你乐高积木。Helm 是已经搭好、可定制、有边界纪律的经营推进闭环参考实现。

> For delivery engineers building B2B operations systems on top of Coze / 阿里悟空 / Dify / LangGraph / 通用 agent 平台。
>
> 通用平台告诉你"怎么搭"。Helm 告诉你"该搭什么、怎么不出事、怎么在明确前置条件下约 4 周交付首个受控客户"——并把答案写成了可 fork 的代码。

**License**：Apache-2.0 · **首次公开发布**：`v0.1.0-trial`（2026-05-31 计划） · **Helm Cloud / Enterprise**：商业版可选，不替代开源

> **不是工程师？** 先看 [docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md) 一页定位文档了解 Helm 是什么；或把仓库跑起来后访问 `/demo` 路径（约 90 秒看 Helm 真实工作区，不要求留邮箱）。

---

## 一句话定位

> **Helm 不是另一个 agent 平台，也不是 LLM framework。它是一套面向 B 端经营场景、带完整边界纪律的参考实现 + 方法论，目标是让交付工程师在明确前置条件下约 4 周交付首个受控客户。**

完整论述见 [HELM_FOR_DELIVERY_ENGINEERS_V1.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md)。

---

## 它解决了什么（交付工程师视角）

通用 agent 平台和 LLM framework 解决了"怎么搭"。剩下三个问题没人替你扛：

1. **该搭什么** — B 端客户真实诉求是"今天必须由谁拍板的 3 件事 + 为什么 + 边界"，不是一个聊天框
2. **怎么不出事** — AI 越权外发 / 自动承诺 / 跨租户串数据，平台不替你扛，你的客户会替你扛
3. **怎么交付得快** — 每个客户从零建模 / 搭审批闸 / 写连接器 / 做 dashboard，你的人月被烧光

Helm 把这三件事**预先编码进一个开源参考实现**。

---

## Helm vs AI agent 平台 / LLM framework

|  | AI agent 平台<br/>(Coze / 悟空 / Dify) | LLM framework<br/>(LangGraph / LangChain) | **Helm** |
|---|---|---|---|
| 抽象层级 | 拖拉拽 / DAG 编辑器 | SDK + primitives | **有意见的整机 + 图纸** |
| 给你什么 | 积木 + 配置面板 | 抽象类 + utilities | **可工作的经营推进闭环 + vertical 参考实现** |
| 业务 domain 知识 | 你自带 | 你自带 | **内置：信号 / 案件 / 闭环 / 复核模型已建模** |
| Advice vs Commitment 边界 | 看你怎么配 | 看你怎么写 | **eval gate 编码强约束** |
| 多租户隔离 | 平台层（黑盒） | 你自己实现 | **Deployment Profile + Tenant Overlay 四层切割** |
| 中文 connector | 部分 | 你自己接 | **DingTalk / IMAP / 阿里邮箱 / Qwen 内置可工作样板** |
| 是否可全部 fork | 产品而异（Dify 可自托管；托管平台通常锁定） | 是（无 vertical） | **是（Apache-2.0 + vertical pack）** |
| 30 分钟跑通完整闭环 | 否 | 否 | **`docker compose up`** |
| 商业模式（对你） | 平台抽成 / 走他们渠道 | 你自定价 | **open-core**：fork 商用自营，Helm 不抽成 |

> 对比的是**类型**，不是某产品当下功能勾选；平台会持续演进，差异点在抽象层级与产品形态。[Dify 官方文档](https://docs.dify.ai/)强调其 open-source / self-hostable 形态，本表按可视化编排型 AI 应用平台比较，不把 Dify 归入闭源锁定平台。

---

## 90 秒看到 Helm

```bash
git clone https://github.com/Helm-OpenSource/helm-public.git
cd helm
cp .env.example .env       # 默认本地 MySQL
docker compose up          # mysql:8.4 + app
open http://localhost:3000
```

`npm run delivery:doctor` 与 `npm run pack:fixture-check` 是交付工程师 fork 后的本地只读自检命令，需要先 `npm install`；不是 "看到 Helm" 路径的必经步骤，详见下方入口表。

第一屏即 `/operating`（经营信号流图）、`/approvals`（复核闸）、`/memory`（经营记忆）三张已经可工作的面。

> **⚠️ Phase 2 fixture 演示**：`/operating` 当前为合成 fixture 数据，不代表真实租户业务流。DPO 复核与 founder-attested 5 角色签字已有记录，但 route adoption 仍需补齐 Engineering / Product / Security / Operations 四个 per-role receipt；当前 shadow probe 只作为 Phase 1.5 day-2 dogfood proxy。详见 [`docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md`](docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md)。

> 需要本地 Docker Desktop / OrbStack / colima。仅启动最小集（不含连接器、AI、支付）。

完整 30 分钟 onboarding 走法见 [HELM_FOR_DELIVERY_ENGINEERS_V1.md §30 分钟 onboarding 锚点](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md#30-分钟-onboarding-锚点)；`extensions/case-management-sample/` 已提供可读 / 可改的最小公开 vertical 参考，并补齐 worker / BI cookbook minimum slice。Docker / fresh-clone onboarding 仍需在 v0.1 发布轨道内验证。

---

## 5 步本地起服务

```bash
npm install                   # 1. 安装依赖
cp .env.example .env          # 2. 配置环境
npm run db:generate && npm run db:migrate && npm run db:seed   # 3. 数据库
npm run dev                   # 4. 启动
open http://localhost:3000    # 5. 访问
```

更详细的开发上手指引见 [docs/getting-started.md](docs/getting-started.md)。

`.env.example` 三档：

| 档位 | 字段 | 说明 |
|---|---|---|
| **MUST** | `DATABASE_URL`、`APP_URL`、`CONNECTOR_TOKEN_SECRET` | 起服务的最小集 |
| **OPTIONAL_AI** | `OPENAI_API_KEY`、`DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL`、`LLM_*` | 缺失时给 placeholder + banner，不会崩 |
| **OPTIONAL_CONNECTORS** | DingTalk · WeCom · HubSpot · Salesforce · Stripe · 支付宝 · 微信支付 | 按需开启 |

---

## 当前能做（参考实现的 surface 一览）

> 这些 surface 是 Helm 参考实现的一部分。fork 后你可以全部改、全部砍、全部加。

| 入口 | 作用 |
|---|---|
| `/dashboard` | 今天必须由你拍板的 3 件事 |
| `/mobile` | 移动端窄屏经营推进入口 + Ask Helm |
| `/operating` | 经营总盘：判断 / 决策 / 边界三层 |
| `/approvals` | 客户可见草稿、CRM 阶段变更全部在这里等你点 |
| `/memory` | 经营记忆：事实、承诺、阻塞、修正——可引用、可复核；统一 trace timeline 仍是 release hard gate |
| `/search?mode=ask` | 直达对象，或直接问 Helm（只读，附引用；行动需求会生成证据化行动包） |
| `/setup` | 6 步 12 分钟初始化，5 分钟内看到第一张判断卡 |
| `/capture` | 按下录制 → 60 分钟会议目标 90 秒生成事实 / 承诺 / 跟进候选；高风险项必须复核 |
| `/reports` | 周复盘：过去两周一页看完 + 下周该抓什么 |
| `/settings` | 工作区控制台：连接器、策略、试点模式、保留期、自助导出 |
| `/health` | 公开可演示健康摘要：只展示可达性、workspace-first、先复核和审计守卫姿态；不暴露内部运行探测或隐藏采用 |

**技术栈**：Next.js 16 (App Router) + React 19 · MySQL + Prisma · Tailwind CSS 4 + Radix UI · TypeScript（严格模式） · Vitest + Playwright

---

## 主流系统接入

> **接你客户的现有系统是你的核心交付动作——这套接口给你模板。**
> 保留客户已经在用的系统。Helm 在它们之上长出"今天该做什么"。

### 已支持

> 状态口径：**Stable** = 主路径已可运行，缺少凭据时会明确降级；**Alpha** = 最小闭环已落，但仍依赖配置、样本或后续 hardening；**Roadmap** = 已建占位，未默认启用。

| 类型 | 系统 | 状态 | 说明 |
|---|---|---|---|
| **CRM** | HubSpot | Stable | 只读同步 + 经营信号层 |
| **CRM** | Salesforce | Alpha | 默认 `authMode=MOCK` 走示例数据；接入真实 OAuth 凭据后切换 |
| **企业 IM** | DingTalk（钉钉） | Stable | OAuth + Directory；目录邀请走复核闸口，不自动外发 |
| **企业 IM** | Feishu（飞书） | Alpha | OAuth callback foundation + public auth + env-backed Bitable read-only ingest；message draft（review-first）仍待下一层 |
| **企业 IM** | WeCom（企业微信） | Alpha | OAuth callback foundation + meetings read-only ingest；calendar / message / send 仍保持边界 |
| **邮件** | Gmail | Stable | OAuth + IMAP 读取；外发走复核 |
| **邮件** | 阿里邮箱 | Stable | IMAP 同步 + 系统 SMTP（手动显式发送） |
| **会议** | 录音 / 转写 / 经营理解 | Alpha | 浏览器录音 MVP + 外部 transcript ingest + OpenAI ASR；不是实时会议录音转写平台，不含 Zoom / 腾讯会议原生音频接入 |
| **支付** | Stripe | Stable | 真 API（订阅 / 支付链接） |
| **支付** | 支付宝 | Stable | 真网关 + RSA-SHA256 签名 |
| **支付** | 微信支付 | Alpha | 适配器已落，生产前需运维确认密钥与回调 |
| **LLM** | OpenAI 兼容 / 本地 Gemma | Stable | provider=`openai`；通过 `LLM_BASE_URL` 接任意 OpenAI-compatible endpoint |
| **LLM** | Qwen（阿里云百炼） | Stable | provider=`qwen`；默认模型 `qwen3.6-plus`，默认 endpoint `https://dashscope.aliyuncs.com/compatible-mode/v1` |

### 路线图——公开征集贡献

> **如何贡献**：开 issue 标签 `integration: <system>`，先讲清楚「客户用例 / 数据流向 / 治理边界」三件事，再写代码。

#### 🔥 P0 · 仅限首批推进入口

| 系统 | 期望能力 |
|---|---|
| Microsoft 365（Teams + Outlook + Calendar） | Calendar pull · Teams capture · Outlook draft |
| Google Workspace（Calendar + Gmail + Drive） | Calendar pull · Gmail thread · Drive doc reference |
| Slack | Channel digest · draft message（review-first） |
| Zoom | 会议录制 / transcript ingest；不承诺实时会议平台替代 |

#### 🧭 Issue-driven 候选池

Pipedrive、Zoho、Dynamics、Notion、Coda、腾讯会议、Webex、用友、金蝶、HRIS、Jira、GitHub、通话、税务、现金流等方向先走 `integration:` issue。我们会判断是否服务于"会议 / CRM / 邮箱 → Must Push → Review Action"的首批闭环；不承诺排期。

#### ⭐ 可接受 PR 的边界

| 类型 | 允许范围 |
|---|---|
| 只读连接器 | read-only ingest、fixture、dry-run、边界文档 |
| 草稿型能力 | draft / preview / review-first，不自动外发 |
| 证据层适配 | 进入 evidence candidate，不直接进入 Must Push truth |

### 我们对集成方的 5 条承诺

1. **7 个工作日内回应**：`integration:` issue 我们目标 7 个工作日内人工回复，但不承诺一定排期或实现。
2. **3 类清晰边界**：每个集成上线时公开"自动做什么 / 复核后做什么 / 永远只人工"。
3. **不替你给客户发送**：所有客户可见的动作永远等用户点击。这条线不退。
4. **数据可携带**：所有接入的数据，一键自助导出（`/settings`）。
5. **审计 trace**：关键集成动作带 trace ID；统一用户可见 trace timeline 仍是发布硬门，未落地前不宣传"0 秒回放"。

### 集成模板

[`docs/integrations/INTEGRATION_TEMPLATE.md`](docs/integrations/INTEGRATION_TEMPLATE.md)（随 v0.1.0 一起开放）包含：

- 数据流声明模板
- 边界三轨表（auto / review / never）
- OAuth + API key 安全清单
- 测试夹具 + dry-run 模式
- 用户可见命名规范
- 退出与数据回收

### 联系方式

| 路径 | 用途 |
|---|---|
| GitHub Issues `integration:` 标签 | 公开征集 / 路线图讨论 |
| [GitHub Issues](https://github.com/Helm-OpenSource/helm-public/issues) | 公开 issue、卡点求助、vertical 共建 |
| `partners@helm.<domain>` | 商业合作 / 联合发布（非默认入口；先开 issue） |
| [docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md) | 开源 / 商业边界 |

---

## 当前刻意不做

- 完整企业 SSO / SCIM / 多租户平台
- 完整 workflow / orchestration / agent 编排引擎
- 完整 BI / 报表中心
- 自动执行 · 自动审批 · 自动结算 · 自动外发
- 插件市场 · App store
- 第三方 plugin runtime / sandbox；当前 extension seam 只服务 first-party / private tenant extension
- 多轮聊天历史持久化 · 跨工作区自动聚合
- LLM 在承诺路径做最终排序
- SaaS 直销给端客户（Helm Inc. 不和交付工程师抢生意）

---

## 核心纪律：Recommendation ≠ Commitment

- **建议（Recommendation）**：系统建议，需人工复核。
- **承诺（Commitment）**：具有业务影响的正式行动，必须明确授权。
- 任何客户可见措辞，如可能被误读成承诺，会被显式降级为「边界备注 / 前置 / 依赖 / 非承诺备注」。

这条不是商业承诺，是**代码 + eval 提供的可审计约束**：`OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` 闭集、`commitment: "suggestion_only"` 写死、`crossTenantProjection: false` eval 硬拒；对外商业承诺仍以人工授权和合同为准。

详见 [AGENTS.md §6-§7](AGENTS.md)、[lib/operating-signal-flow/contract.ts](lib/operating-signal-flow/contract.ts)。

---

## 路线图

**Now（2026-05）**
- 5 月开源 + 公开发布准备（`v0.1.0-trial`，目标 2026-05-31）；发布前必须通过 release hard gates
- 发布硬门：RDS 凭据轮换 + history remediation、on-call 响应机制、公开承诺降级、trace 公开口径安全
- **`extensions/case-management-sample/`** vertical 参考实现抽出（从 tenant-private vertical pack 脱敏）
- **Positioning collateral 5-31 ready**：1-pager（已落） · `docker compose up` 30 分钟 onboarding 验证 · 1 个 vertical cookbook · 短 demo video
- Phase 3 runtime adoption 受限解禁（仅 TPQR-001 / TPQR-003 / TPQR-004）
- README · 治理文档 · `.env.example` 分层 · `docker-compose.yml`

**Next 30 days**
- `/mobile` 第一屏 Must Push 切换数据源（read-first → adapter，feature flag 控制）
- Ask Helm asset capture 落地（写入 `MemoryCandidate` / `SkillSuggestion`，review-first）
- 数据保留状态展示与自助导出（settings · billing 卡片）
- degraded-mode health surface：连接器 / LLM / DB / capture 失败时用户可见
- 5 角色 Required Reviewer 评审 + redacted live DB calibration

**Later**
- 社区贡献 vertical pack 的协作机制（开源 vertical vs tenant-private 边界）
- Helm Cloud（托管版）公开 beta
- Helm Enterprise 私有部署模板
- 完整生产级 SSO / SCIM 评估（按客户合规要求触发）
- BI 报表能力评估（按需扩展，不做平台化）

详见 [docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md)。

---

## 文档导航

| 文档 | 作用 |
|---|---|
| **[docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md)** | **根定位：给交付工程师的一页 1-pager + 差异表 + 30 分钟 onboarding 锚点** |
| [docs/getting-started.md](docs/getting-started.md) | 开发者上手指引（中文） |
| [docs/getting-started.en.md](docs/getting-started.en.md) | Developer quickstart（English） |
| [AGENTS.md](AGENTS.md) | 仓库长期执行规范、硬边界、统一验证链 |
| [DESIGN.md](DESIGN.md) | 视觉与界面基线 |
| [WORKING-CONTEXT.md](WORKING-CONTEXT.md) | 当前 active queue 与短周期约束 |
| [GOVERNANCE.md](GOVERNANCE.md) | 开源治理、scope control、release 与认证边界 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南（中文） |
| [docs/README.md](docs/README.md) | 完整文档索引（中文） |
| [docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md) | 开源 / 商业 / 合作边界 |
| [docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) | Certified Delivery Partner / Connector / Workflow Pack 认证清单 |
| [docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) | 公开试点数据政策 |
| [docs/operations/ON_CALL_AND_RESPONSE_SLA.md](docs/operations/ON_CALL_AND_RESPONSE_SLA.md) | 早期落地伙伴响应与值班机制 |
| [docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md](docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md) | 公开承诺、release hard gates 与需求减负收口 |

---

## 验证链

非微小改动默认应跑通：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

公开发布前额外跑：

```bash
npm run check:public-release
npm run check:secret-history
npm run release:check
```

详见 [AGENTS.md §10](AGENTS.md)。

---

## 贡献

- ✅ 我们欢迎：bug 修复、文档修订、测试覆盖、本地化、只读连接器、可访问性改进。
- ⚠️ 请先开 issue 讨论：改 schema、引入自动写入 / 发送、扩展 sandbox / marketplace / orchestration 平台能力。
- 🧩 集成方向请用 `integration: <system>` 标签。
- 🎯 想成为 **Certified Delivery Partner**？见 [docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)。

详见 [CONTRIBUTING.md](CONTRIBUTING.md) · 参与即同意 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

---

## 早期落地伙伴可选路径（非默认 CTA）

> **主路径是 fork + 自部署 + 交付工程师 30 分钟 onboarding。** 早期落地伙伴路径仅作为 backup，供需要 Helm 团队直接陪跑的 design partner 使用。如果你是 Helm Inc. 的潜在合作方，先看 [Certified Delivery Partner](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)；试点合作仅在 Certified 不适配时启用。

| 目标 | 可验收口径 |
|---|---|
| 申请落地 → 首次答复 | 目标 **1 个工作日**；以 [ON_CALL_AND_RESPONSE_SLA.md](docs/operations/ON_CALL_AND_RESPONSE_SLA.md) 的工作日与升级规则为准 |
| 通过试点 → 第一次 1:1 | 目标 **7 天内**；以双方确认的试点窗口为准 |
| 初始化 → 第一张判断卡 | 目标 **5 分钟**；判断卡必须包含 evidence / reason / boundary，否则不算达成 |
| 完整初始化 | 目标 **6 步 / 12 分钟**；失败时必须显示可恢复原因 |
| 60 分钟会议 → 事实 / 承诺 / 跟进草稿 | 目标 **90 秒生成候选项**；人工采纳率、错误承诺事故、审计覆盖率进入试点质量门 |
| 接入 CRM → 今天该做什么 | 目标 **10 分钟生成 3-5 个 Must Push 候选**；连接器不可用时明确降级，不编造信号 |
| 集成 issue → 人工回复 | 目标 **7 个工作日内回复**；不承诺排期或一定实现 |
| 公开试点数据保留 | 按工作区试用契约与生效数据政策执行；`30 天 active + 7 天 grace` 仅是待法务最终确认的目标口径 |
| 自助导出 | `/settings` 导出工作区 first-party 数据；第三方原系统数据仍由原系统负责 |
| 审计 trace | 关键写路径写入 `traceId`；统一用户可见 trace timeline 未落地前，不对外承诺"0 秒可回放" |

早期落地伙伴质量门默认看 5 个指标：Must Push 采纳率、48h follow-up 完成率、manager review time、wrong commitment incident、audit trace coverage。

---

## 安全

请勿在公开渠道披露未公开的安全漏洞。私下披露见 [SECURITY.md](SECURITY.md)。

---

## License

[Apache-2.0](LICENSE) · [NOTICE](NOTICE) · 第三方依赖保留各自 license

---

## 加入我们

| 入口 | 用途 |
|---|---|
| **🚀 `git clone` + `docker compose up`** | 本地跑通核心 surface；从 `extensions/case-management-sample/` 开始 fork 你的客户 vertical |
| **🧭 `npm run delivery:doctor`** | 先做只读本地诊断：Golden Path 文件、关键 scripts、sample pack、HSI eval 和 D2 smoke 姿态 |
| **🧪 `npm run pack:fixture-check`** | 检查 pack manifest、tenant 对齐、fixture JSON、安全 marker 和 HSI surface 覆盖 |
| **💬 [GitHub Issues](https://github.com/Helm-OpenSource/helm-public/issues)** | 公开 issue、vertical 共建、卡点求助 |
| **🎯 [Certified Delivery Partner](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)** | 交付商认证、品牌背书、案例共建 |
| **☁️ Helm Cloud（托管版）** | 可选，不替代开源；适合不想自部署的交付商 / 客户 |

> **目标：让交付工程师在明确前置条件下约 4 周交付首个受控 B 端经营推进系统。**
