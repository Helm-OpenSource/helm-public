---
status: draft
owner: Product / Delivery Engineering / Ecosystem
created: 2026-07-05
review_after: 2026-07-19
public_safety: Public-safe narrative and product requirements only. No customer names, real people, private deal terms, equity terms, private domains, deployment authorization, production receipts, credentials, or customer-specific runtime configuration.
---

# Helm Public Business Narrative Requirements / Helm 公开商业叙事需求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文把 Helm 最新商业设计翻译成 `helm-public` 可以承载的公开安全叙事与产品需求。
它不是销售承诺、融资材料、客户方案、商业条款、部署批准、Pack 发布批准或生产 receipt。

Helm 的公开叙事应围绕：

```text
合规现场销售信号入口
  -> Sales Process Intelligence
  -> AI Diagnostic
  -> Ecosystem Bridge
  -> AI 精选货架
  -> Trust Center
  -> Partner / FDE network
  -> industry Pack flywheel
```

一句话边界：

> Helm 不是耳机公司、AI 产品分销商、CRM 替代品或外包项目公司。Helm 是一套
> public-safe、review-first 的经营信号与交付闭环 Core，帮助交付工程师从合规销售过程
> 信号切入，形成可复核的 AI 诊断、生态交付和行业 Pack 复利。

## 1. 现状审计

### 已经稳的公开叙事

| 现有入口 | 已能承载 | 证据 |
|---|---|---|
| README | open-source Core、经营信号、人工复核、Golden Path、非自动承诺 | `README.md` |
| Delivery engineer positioning | Helm 面向 AI 交付工程师，不是通用 agent 平台或 LLM framework | `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md` |
| Data intake / Signal First Mile | L0 诊断材料、L1 脱敏样本、L2 只读接入；先材料诊断再 connector | `HELM_DATA_INTAKE_EXPERIENCE.md`, `HELM_SIGNAL_FIRST_MILE_METHOD.md` |
| Diagnostic automation | evidence-first、dry-run-first、review-first 的诊断与自动化准备层 | `HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md` |
| Open source / commercial boundary | Core / Pack / Overlay / control-plane 依赖方向和公开安全边界 | `HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md` |
| Certified ecosystem checklist | partner、connector、workflow pack、deployment 的人工认证门禁 | `HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md` |

### 仍然不够清楚的部分

| 缺口 | 当前风险 | 应补的公开安全表达 |
|---|---|---|
| Sales Process Intelligence | README 讲经营信号，但没有把窄切入点明确压到现场销售过程 | 明确 Helm 可先从合规工作耳机、工作手机、会议纪要、CRM snapshot 等授权来源进入销售过程学习 |
| AI Diagnostic | 现有 diagnostic 偏工程证据层，读者不一定理解成持续诊断客户 AI 需求 | 把 AI Diagnostic 定义为需求池、能力缺口、风险、适配路径和下一步复核包，不是咨询报告自动结论 |
| Ecosystem Bridge | 合作计划和认证清单存在，但缺少“把诊断路由到伙伴/FDE/Pack”的桥接叙事 | 定义 Helm 如何把需求路由到 Builder、OPC/FDE、认证伙伴、AI 精选货架和行业 Pack |
| AI 精选货架 | 容易被误讲成 AI 产品分销或 reseller | 定义为经证据、权限、边界和适配条件复核的能力目录，不替供应商背书结果，不自动转售 |
| Trust Center | 公开文档有大量边界，但没有产品化为统一信任入口 | 定义合规采集、授权、保留期、审计、复核、撤销、认证状态的统一入口需求 |
| Partner / FDE network | programs 页面讲变现路径，但 FDE/OPC 交付网络和边界没有形成统一叙事 | 定义 partner/FDE 是交付组织能力，不是无限外包池、渠道压货或结果保证 |
| industry Pack flywheel | public 有 sample pack，pack 仓有行业能力；public 没说明飞轮关系 | public 只讲 public-safe Pack lifecycle：signal -> diagnostic -> reusable pattern -> pack candidate -> certified/use in private repo |

## 2. 战略适配度

### 2.1 核心判断

当前 `helm-public` 的公开叙事能守住边界，但还没有完整承载最新商业飞轮。

- **适配度高**：review-first、evidence-first、delivery-engineer-facing、open-core、Core/Pack/Overlay 分仓纪律。
- **适配度中**：生态认证、合作计划、诊断、Signal First Mile 已有模块，但还缺少统一业务闭环。
- **适配度低**：Sales Process Intelligence、AI 精选货架、Trust Center、Partner/FDE network、industry Pack flywheel 还没有被放在同一张公开需求图里。

### 2.2 公开叙事必须回答的 6 个问题

1. Helm 从哪里窄切入？
2. 为什么这个入口不是卖硬件？
3. Sales Process Intelligence 如何形成可复核经营信号？
4. AI Diagnostic 如何把销售过程信号转成客户 AI 需求池？
5. 需求如何路由到 Builder、OPC/FDE、生态伙伴、AI 能力货架或行业 Pack？
6. 这些路由如何被 Trust Center、人工复核、审计和 public/private 边界约束？

## 3. 缺口

### 3.1 错误叙事风险

| 错误讲法 | 为什么危险 | 必须替换成 |
|---|---|---|
| Helm 是耳机公司 | 会把 Helm 从治理/学习/诊断层误降级为硬件产品和采集设备 | Helm 使用合规授权的工作耳机、工作手机、会议纪要、CRM snapshot 或客户已有采集端作为信号入口 |
| Helm 是 AI 产品分销商 | 会把精选货架误读成返点、渠道压货或替供应商背书 | Helm 做需求诊断、能力适配、证据复核和交付路由；是否购买第三方产品由客户和伙伴人工决策 |
| Helm 是 CRM 替代 | 会与客户现有系统对抗，也会诱导自动写回 | Helm 在 CRM、会议、IM、邮件、工单之上形成经营信号与复核包；默认只读/草稿/复核优先 |
| Helm 是外包公司 | 会把 Pack flywheel 变成项目人月，不形成复利 | Helm 用 Partner/FDE 网络组织交付，但沉淀公共 Core、行业 Pack、认证、证据和复用资产 |
| Helm 自动诊断并自动采购 AI | 会越过客户授权、预算和采购流程 | AI Diagnostic 只生成候选需求、风险、适配路径和复核包；采购/部署/合同永远人工持有 |

### 3.2 当前 public 叙事缺少的对象模型

| 对象 | public-safe 定义 | 不得包含 |
|---|---|---|
| `SalesProcessSignal` | 来自授权销售过程的 alias-only 信号：承诺、异议、需求、风险、成交/流失原因、跟进窗口 | 原始录音、全文转写、真实人员、客户私域 payload |
| `AIDiagnosticNeed` | AI 需求候选：业务问题、可用证据、风险、适配能力、缺口、推荐下一步 | 采购结论、合同承诺、真实预算、供应商报价 |
| `EcosystemRoute` | 诊断后的路由：Core self-serve、Builder、OPC/FDE、Certified Partner、AI Shelf、Pack candidate | 私有 partner 名单、真实商业条款、分润、股权、客户授权 |
| `TrustedCapabilityListing` | AI 精选货架条目：适用场景、权限、数据姿态、集成边界、证据要求、复核门 | 结果保证、返点、暗示官方背书或自动转售 |
| `TrustCenterEvidence` | 授权、告知、保留期、审计、撤销、认证状态、边界说明 | 真实生产 receipt、客户部署证据、密钥、私有域名 |
| `IndustryPackFlywheelState` | 从 public-safe pattern 到 private pack hardening 的状态机 | 客户 overlay、BOM、授权、部署登记 |

## 4. Public-safe 产品 / 生态 / 开发者叙事需求

### 4.1 产品叙事需求

P0:

- README 和首页应把 Helm 的窄切入点表达为“合规销售过程信号入口”，而不是泛经营信号或硬件入口。
- Sales Process Intelligence 必须解释成 `authorized signal -> review packet -> human decision -> learning candidate`，不能解释成实时监听、偷拍、远控、自动话术操控或 CRM 写回。
- AI Diagnostic 必须输出候选需求池、证据缺口、风险、适配路径和下一步复核包；不能输出采购结论、部署批准或合同承诺。
- Trust Center 入口应统一列出授权、告知、保留期、数据姿态、审计、撤销、认证状态和 forbidden actions。

P1:

- `/programs` 与 Certified ecosystem docs 应把 Partner/FDE network 讲成交付组织能力和人工认证流程，不是 marketplace、转售、公开排名或结果保证。
- AI 精选货架应先以文档/fixture 形式定义 listing contract：适用场景、输入要求、数据边界、集成方式、审计要求、回滚路径、非承诺说明。
- 首页场景应至少有一个 Sales Process Intelligence 场景，使用 public-safe 合成数据，并明确不含真实客户、真实人员或原始音频。

P2:

- 建立 Trust Center surface 或 docs hub，聚合数据政策、权限策略、AI 推荐治理、认证生态、public/private 边界和 release reality。
- 建立 public-safe Pack flywheel 页面：sample pack -> reusable extension -> private industry Pack -> certified workflow pack 的路由与不可越界项。

### 4.2 生态叙事需求

| 生态层 | public 可以说 | public 不可以说 |
|---|---|---|
| Builder | 负责把需求拆成 Core / Pack / Overlay / partner route 的工程判断 | 具体客户授权、真实人员分工、私有商业条款 |
| OPC | 负责 owner-gated operating packet、风险、证据、决策请求和受控执行队列 | 替 owner 批准发布、部署、采购或结算 |
| FDE | 负责客户现场/行业交付、材料脱敏、Golden Path、review packet、handoff | 自动背书客户结果、无限外包、绕过认证 |
| Certified Partner | 通过人工认证门禁的交付/连接器/工作流候选 | 公开排名、自动认证、转售许可、SLA 保证 |
| AI Shelf | 经过适配条件和边界复核的能力目录 | AI 产品分销、供应商结果保证、自动采购 |
| Industry Pack | 从重复需求中沉淀的行业共性资产 | 客户 overlay、生产配置、私有数据、BOM/授权 |

### 4.3 开发者叙事需求

开发者看到的路径应是：

```text
1. Fork public Core
2. Run Golden Path
3. Build or modify synthetic SalesProcessSignal fixture
4. Run HSI / signal-quality / public-release guards
5. Produce review packet
6. Decide route:
   - public Core contribution
   - public sample extension
   - private Pack work
   - private Overlay work
   - control-plane metadata
```

开发者不应被引导去：

- 提交真实客户录音、全文转写、人员名单或 CRM export。
- 在 public Core 中实现客户专属 overlay、部署授权、BOM、供应商合同、分润或付款。
- 把 AI Diagnostic 结果自动写入 CRM、采购系统、客户消息或正式 memory。

## 5. 落地文档要求

本文件落地后，后续 PR 可以按小切片推进：

| 切片 | 建议文件 | 最小验收 |
|---|---|---|
| Public narrative anchor | `README.md`, `README.en.md`, `app/page.tsx` | 明确 Sales Process Intelligence + not headset / not reseller / not CRM / not outsourcing |
| Trust Center requirements | `docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md` | 覆盖授权、告知、保留期、审计、撤销、认证和 forbidden actions |
| AI Shelf listing contract | `docs/product/HELM_AI_SHELF_LISTING_CONTRACT.md` | listing 字段、非承诺说明、适配证据、回滚路径 |
| Sales process sample | `extensions/<public-sample>/` 或 `templates/` | synthetic-only fixture、review packet、eval、public-release guard |
| Partner/FDE route | `docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md`, `/programs` | 人工认证、非 marketplace、非 SLA、非自动转售 |
| Pack flywheel route | `docs/roadmap/HELM_PUBLIC_ROADMAP.md` | 明确 public Core 只讲路由和证据，不承接私有 Pack 实现 |

## 6. 风险边界

### 6.1 数据与合规边界

- 原始音频、全文转写、真实人员数据、真实客户名、私有域名、生产日志和部署 receipt 不进入 public repo。
- 合规耳机、工作手机、会议工具或客户已有采集端只作为授权信号来源；Helm 不卖、不安装、不代采灰色硬件。
- public fixture 只能是 synthetic、redacted 或 alias-only。
- 所有客户可见动作、CRM 写回、采购、部署、报价、合同、付款、认证发布都必须人工持有。

### 6.2 仓库边界

| 内容 | 归属 |
|---|---|
| Core SDK、公开 sample、public docs、public tests、Docker quickstart | `helm-public` |
| 行业 Pack SDK、行业 fixture、Pack release readiness evidence | `helm-packs` |
| 客户 Overlay、客户 runtime config、客户差异、客户私有材料 | `helm-overlays` |
| BOM、授权、部署登记、健康心跳、用量元数据 | `helm-control-plane` |

### 6.3 承诺边界

本文只建立叙事和需求基线。它不证明：

- Sales Process Intelligence 已生产部署。
- AI Diagnostic 已能服务真实客户。
- Trust Center 已作为产品 surface 完成。
- Partner/FDE network 已认证完成。
- AI 精选货架已有上线商品或转售授权。
- Industry Pack flywheel 已产生客户可用 Pack。

## 7. 后续验证

每个后续 PR 至少应包含：

```bash
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
```

如果改 README、首页或可见 UI，还应追加：

```bash
npm run typecheck
npm run lint
npm run test
```

如果新增 sample、fixture、Pack-like material 或 Signal First Mile 资产，还应追加：

```bash
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:signal-first-mile-quality
```

验证通过也只代表 public Core 文档/fixture/guard 边界成立，不代表客户部署、商业发布、
供应商合作、认证批准或 owner release approval。

## English Reference

This document translates Helm's current business design into public-safe
narrative and product requirements for `helm-public`.

Helm should be presented as a review-first operating-signal and delivery-loop
Core: it can enter through compliant sales-process signal sources, turn those
signals into Sales Process Intelligence, diagnose customer AI needs, route work
through an ecosystem bridge, and accumulate reusable industry Pack patterns.

It must not be positioned as a headset company, AI product reseller, CRM
replacement, or outsourcing company. Public materials may describe generic,
authorized signal sources, diagnostic workflows, Trust Center requirements,
partner/FDE routing, AI shelf listing contracts, and industry Pack flywheel
boundaries. They must not include customer data, private partner lists, real
commercial terms, equity terms, private domains, credentials, deployment
authorization, production receipts, or customer-specific runtime configuration.

Future PRs should land this in small slices: README/home narrative anchor, Trust
Center requirements, AI shelf listing contract, synthetic sales-process sample,
Partner/FDE route, and Pack flywheel route. Validation should keep
`check:public-docs`, `check:public-release`, and `check:boundaries` green, with
typecheck/lint/test and fixture evals added when UI or sample assets change.

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-05 | 初版：把 Sales Process Intelligence、AI Diagnostic、Ecosystem Bridge、AI 精选货架、Trust Center、Partner/FDE network 和 industry Pack flywheel 收敛成 public-safe 叙事需求与风险边界。 |
