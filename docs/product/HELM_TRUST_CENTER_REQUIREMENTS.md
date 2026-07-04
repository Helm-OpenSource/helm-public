---
status: draft
owner: Product / Trust / Delivery Engineering
created: 2026-07-05
review_after: 2026-07-19
public_safety: Public-safe Trust Center requirements only. No customer names, real people, private partner lists, private domains, production receipts, deployment authorization, credentials, or customer-specific runtime configuration.
---

# Helm Trust Center Requirements / Helm Trust Center 需求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文定义 `helm-public` 可以公开承载的 Trust Center 需求。它把授权、告知、
保留期、撤销、审计、认证状态和禁止项收敛成可复核契约，服务于
Sales Process Intelligence、AI Diagnostic、AI 精选货架、认证生态和行业 Pack
飞轮的公开安全边界。

本文不是法律意见、数据处理协议、生产安全白皮书、认证批准、客户部署证明、
供应商合作公告或 owner Go/No-Go 记录。

## 1. 目标

Trust Center 的公开目标是让交付工程师和生态参与者能回答七个问题：

1. 哪些信号来源被允许进入 Helm。
2. 进入前需要怎样的授权和告知。
3. 数据保留期、撤销和删除请求如何表达。
4. 哪些动作必须人工复核。
5. 哪些证据能公开复核，哪些必须留在私有记录。
6. 认证、listing、partner 或 Pack 状态处于哪个阶段。
7. 哪些设备、采集方式、自动化和商业说法被明确禁止。

Trust Center 在 public Core 中首先是 requirements + evidence map，不是完整
生产级合规平台。

## 2. 适用范围

| 范围 | public 可以表达 | public 不可以表达 |
|---|---|---|
| 授权信号来源 | 工作耳机、工作手机、会议纪要、CRM snapshot、邮件 / 工单摘要、只读 API 等通用类型 | 真实客户名、真实人员、原始音频、全文转写、私有 payload、私有域名 |
| 告知与同意 | 告知模板、角色、触发点、撤销路径和审计字段 | 真实签署人、真实合同、真实审批编号、客户部署授权 |
| 保留期 | public trial 数据政策、目标草案、review-first 删除证明路径 | 生产 DPA、客户定制保留期、真实删除 receipt |
| 审计 | trace、review record、command receipt、PR / issue、synthetic fixture evidence | 生产日志、私有审计表、密钥轮换 receipt、私有控制面记录 |
| 认证状态 | candidate、approved、rejected、withdrawn、revoked 等状态定义 | 未批准 partner 名单、供应商商业条款、真实认证批准 |
| AI Shelf | listing contract、适配证据、下架规则和非分销边界 | 转售授权、返点、价格、真实供应商名单、结果背书 |

## 3. Trust Center 对象模型

### 3.1 `TrustedSignalSource`

来自授权业务过程的信号来源。public-safe 字段：

| 字段 | 含义 | 要求 |
|---|---|---|
| `sourceType` | `work_headset` / `work_phone` / `meeting_note` / `crm_snapshot` / `email_digest` / `ticket_digest` / `read_only_api` / `synthetic_fixture` | 只能描述类型，不写真实设备序列号、账号或客户系统 |
| `captureMode` | `manual_upload` / `read_only_import` / `scheduled_snapshot` / `synthetic` | 默认只读或人工上传；写回和外发必须另有人工复核 |
| `consentPosture` | `not_required_for_synthetic` / `notice_required` / `explicit_opt_in_required` / `blocked` | 真实人员或真实客户数据默认不能进入 public repo |
| `dataShape` | `alias_only` / `redacted_summary` / `synthetic_sample` / `private_source` | public docs 和 fixtures 只能用前三类 |
| `retentionRef` | 数据保留政策或私有政策引用 | public 只能引用公开政策或占位符 |
| `auditRef` | trace、review record、fixture id 或 command receipt | 不能使用生产日志或密钥 receipt |

### 3.2 `TrustCenterAuthorization`

描述信号进入 Helm 之前的授权状态：

| 字段 | 含义 | public-safe 规则 |
|---|---|---|
| `authorizationType` | workspace policy、user opt-in、admin approval、legal agreement、synthetic-only | 不写真实签署人或合同编号 |
| `noticeProvidedAt` | 告知发生时间 | 示例用占位符或合成时间 |
| `noticeAudience` | affected users、workspace owner、reviewer、partner operator | 不列真实人员 |
| `scope` | 允许的信号类型、用途和保留期 | 必须包含不允许项 |
| `withdrawalPath` | 撤销或停止处理路径 | 必须能被人工执行或路由 |
| `status` | `missing` / `pending_review` / `active` / `withdrawn` / `expired` / `blocked` | 缺失时 fail closed |

### 3.3 `TrustCenterEvidence`

Trust Center 只接受可复核证据，不接受纯口头声明。

| 证据类型 | public-safe 例子 | 不可公开内容 |
|---|---|---|
| policy reference | `docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md` | 客户 DPA、私有合同 |
| review record | public PR、issue、docs review note | 私有审批编号、owner 私聊截图 |
| command receipt | `npm run check:public-docs`、`npm run check:public-release` | 生产 release receipt、部署健康探测 URL |
| fixture evidence | synthetic SalesProcessSignal、redacted sample | 原始录音、真实 transcript、CRM export |
| certification evidence | checklist 状态、撤销规则、范围 | 未批准 partner 名单、商业条款 |

## 4. 授权与告知要求

P0 要求：

- 任何真实业务信号进入 Helm 前必须有明确来源、用途、范围、保留期和撤销路径。
- 任何涉及员工、销售、客户沟通或设备采集的场景，都必须先说明告知对象和告知时机。
- 未能证明授权的信号只能进入 synthetic / redacted / alias-only 路径，不能进入 public repo。
- AI Diagnostic、AI Shelf route、Partner/FDE route 或 Pack candidate route 只能消费已经标注
  `consentPosture` 和 `dataShape` 的信号。
- 真实客户可见动作、CRM 写回、采购、部署、认证发布、外发和付款必须人工持有。

P1 要求：

- 建立 Trust Center docs hub 或 surface，聚合数据政策、权限策略、AI 推荐治理、认证生态、
  public/private 边界、release reality 和 AI Shelf listing contract。
- 每个 listing、partner candidate、connector candidate 和 Pack candidate 都必须链接到
  Trust Center evidence map。
- 撤销、过期、范围变化和认证漂移必须有显式状态，而不是静默继续展示。

## 5. 保留期、撤销与删除

Trust Center 必须区分目标政策、正式承诺和实际执行证据：

| 项目 | public 表达 | 边界 |
|---|---|---|
| 保留期 | 引用公开试点数据政策或写成目标草案 | 不把草案写成生效商业 DPA |
| 撤销 | 描述用户 / workspace owner / reviewer 可以撤销授权或暂停处理 | 不声称已完成真实删除 |
| 删除请求 | 描述路径、负责人和证据类型 | 不公开真实删除证明 |
| 硬删除 | 只能描述目标机制或私有执行要求 | 不把 public Core 写成生产执行系统 |
| 证据保留 | 只保留 public-safe review record 或合成 receipt | 不公开 production audit log |

当授权撤销或保留期过期时，依赖该信号的 AI Diagnostic、AI Shelf route、
Partner/FDE route 和 Pack candidate 必须进入 `blocked`、`withdrawn` 或
`needs_revalidation` 状态，不能继续作为有效证据使用。

## 6. 审计与认证状态

### 6.1 审计状态

| 状态 | 含义 |
|---|---|
| `not_applicable` | synthetic-only 或纯文档需求，不需要真实授权审计 |
| `evidence_pending` | 已提出需求，但证据缺失 |
| `review_ready` | public-safe 证据足以进入人工复核 |
| `approved_for_public_reference` | 仅批准公开引用该需求或合成样例 |
| `private_execution_required` | 需要私有仓库、私有 issue 或 owner-held 记录继续 |
| `blocked` | 授权、告知、保留期、撤销或禁止项不满足 |

### 6.2 认证状态

Trust Center 只能展示状态，不替代认证：

| 状态 | 用途 |
|---|---|
| `candidate` | 进入复核队列 |
| `approved` | 通过人工认证门禁；公开使用仍需 owner 批准 |
| `rejected` | 未通过 |
| `withdrawn` | 提交方或 owner 撤回 |
| `revoked` | 后续范围、安全、证据或声明漂移导致撤销 |
| `expired` | 超过复核周期，需要重新验证 |

认证状态不得暗示 marketplace、转售许可、SLA、结果保证或客户部署 ready。

## 7. 禁止项

Trust Center 必须 fail closed。以下内容不得进入 Helm public Core，也不得被 Helm
公开推荐、销售、上架或包装成可接受能力：

- 隐形、伪装、改装、远程操控、作弊、暗录、暗采设备。
- 绕过员工、客户、会议参与方或系统管理员告知的采集方式。
- 偷拍、偷录、键盘记录、屏幕偷看、定位跟踪、私密账号抓取或绕过权限的插件。
- 可让第三方远程操控销售人员话术、设备、账号或客户现场动作的工具。
- 宣称可以规避平台规则、考试 / 考核、风控、审计、竞业或采购流程的工具。
- 未经授权抓取 CRM、IM、邮箱、会议、工单、通话或业务系统数据的 connector。
- 把 AI 建议自动写成客户承诺、合同、采购决定、付款、部署批准或认证批准的流程。
- 把 Trust Center 文档写成真实客户合规证明、生产审计证明或法律意见。

灰色设备红线必须写入任何 Sales Process Intelligence、AI Shelf 或 partner/FDE
相关公开材料：Helm 不卖、不推荐、不代采、不上架、不适配隐形、改装、远程操控、
作弊、暗录或暗采设备。

## 8. 与现有公开文档的关系

- 数据保留与公开试点：见 [Helm public trial data policy](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)。
- AI 建议治理：见 [Helm AI recommendation governance](HELM_AI_RECOMMENDATION_GOVERNANCE.md)。
- 权限策略：见 [Helm permission policy contract](HELM_PERMISSION_POLICY_CONTRACT.md)。
- 认证生态：见 [Helm certified ecosystem checklist](HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)。
- 开源 / 商业边界：见 [Helm open source and commercial boundary](HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)。
- AI 精选货架：见 [Helm AI Shelf listing contract](HELM_AI_SHELF_LISTING_CONTRACT.md)。

## 9. 机器化合成契约 / Machine-Checked Synthetic Contract

当前 public-safe 合成证据映射落在
[ai-shelf-trust-center-contract.fixture.json](fixtures/ai-shelf-trust-center-contract.fixture.json)，
并由 `npm run check:ai-shelf-trust-center-contract` 校验。守卫要求：

- `SalesProcessSignal` 只能是 synthetic / alias-only。
- Trust evidence map 必须包含 consent、notice、retention、withdrawal、audit 和 cert status refs。
- AI Shelf listing 必须保持非 reseller、非 marketplace、无 pricing、无 revenue share。
- 灰色设备红线必须显式 `blocked`，且 forbidden flags 必须全部为 `false`。

这只证明 public Core 的合成契约和本地守卫成立；不构成法律意见、生产合规证明、
供应商认证、转售授权、客户部署或生产回执。

## English Reference

This document defines public-safe Trust Center requirements for `helm-public`.
It turns authorization, notice, retention, withdrawal, auditability,
certification status, and forbidden actions into a reviewable contract for
Sales Process Intelligence, AI Diagnostic, AI Shelf, ecosystem certification,
and industry Pack routing.

It is not legal advice, a data processing agreement, a production security
whitepaper, a certification approval, customer deployment proof, vendor
partnership announcement, or owner Go/No-Go record.

The Trust Center should remain fail-closed. Public Core may describe generic
authorized signal-source types, consent posture, retention references, audit
references, certification states, withdrawal paths, and forbidden categories.
It must not include real customers, real people, private domains, production
receipts, credentials, customer-specific runtime configuration, private partner
lists, commercial terms, or deployment authorization.

Helm must not sell, recommend, source, list, or adapt covert, disguised,
modified, remotely controlled, cheating, hidden-recording, or hidden-collection
devices. AI recommendations, AI Shelf routes, partner/FDE routes, Pack
candidates, customer-visible actions, CRM writeback, purchasing, deployment,
certification, outbound messaging, and payment remain human-held and bounded by
public/private separation.

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-05 | 初版：定义 public-safe Trust Center 的授权、告知、保留期、撤销、审计、认证状态和禁止项。 |
