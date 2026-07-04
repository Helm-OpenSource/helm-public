---
status: draft
owner: Product / Ecosystem / Delivery Engineering
created: 2026-07-05
review_after: 2026-07-19
public_safety: Public-safe AI Shelf listing contract only. No real vendor roster, partner-private data, pricing, reseller terms, revenue share, equity terms, customer names, private domains, credentials, deployment authorization, or production receipts.
---

# Helm AI Shelf Listing Contract / Helm AI 精选货架上架契约

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文定义 Helm AI 精选货架的 public-safe listing contract。AI Shelf 是经证据、
权限、边界和适配条件复核的能力目录，用来把 AI Diagnostic 的需求候选路由到
可评估的能力、集成方式、伙伴或 Pack 候选。

AI Shelf 不是 AI 产品分销、reseller、marketplace、应用商店、采购平台、返点渠道、
供应商排名、结果背书或自动部署入口。上架不等于购买建议，适配不等于采购批准，
listing 不等于认证批准，demo 通过不等于客户部署 ready。

## 1. 目标

AI Shelf 的公开目标：

1. 把 AI Diagnostic 发现的需求转成可复核能力条目。
2. 说明能力适用场景、输入要求、权限边界和集成姿态。
3. 明确需要哪些证据才能进入试用、适配、Partner/FDE route 或 Pack candidate。
4. 给出下架、撤回、过期和重新验证规则。
5. 保护 Helm 不被误讲成 AI 分销商或供应商背书方。

## 2. 非分销边界

| 容易误读的说法 | 必须改成 |
|---|---|
| Helm 推荐购买某 AI 产品 | Helm 基于公开安全证据描述能力适配条件，购买由客户 / partner 人工决策 |
| Helm AI Shelf 是产品市场 | Helm AI Shelf 是 review-first 能力目录，不提供交易、结算、排名或返点 |
| 上架代表官方背书结果 | 上架只代表 listing 字段和证据通过当前复核，不保证业务结果 |
| Helm 可以替客户自动采购 / 部署 | AI Shelf 只准备适配路径和复核包，采购 / 部署 / 合同人工持有 |
| AI Shelf 可以接受任何采集硬件或插件 | 不接受隐形、改装、远程操控、作弊、暗录、暗采或越权采集能力 |

## 3. Listing 字段

每个 public-safe listing 至少需要以下字段。字段可以先以 Markdown / JSON fixture
形式存在，后续再进入产品 surface。

| 字段 | 必填 | public-safe 规则 |
|---|---|---|
| `listingId` | 是 | 稳定 slug；不能包含客户名、真实供应商合同编号或私有项目代号 |
| `displayName` | 是 | 可用通用能力名；真实供应商名只有在已有公开授权时才可出现 |
| `capabilityCategory` | 是 | 如 `asr`、`sales_coaching`、`crm_summary`、`meeting_notes`、`workflow_pack`、`diagnostic_tool` |
| `problemFit` | 是 | 描述适合解决的业务问题，不写结果保证 |
| `notFor` | 是 | 明确不适用场景和禁用场景 |
| `inputRequirements` | 是 | 输入类型、数据姿态、最小授权、脱敏要求 |
| `permissionPosture` | 是 | `synthetic_only` / `read_only` / `review_first_write` / `private_contract_required` / `blocked` |
| `dataBoundary` | 是 | 是否处理个人数据、客户数据、音频、转写、CRM snapshot、外部 API |
| `integrationPath` | 是 | `manual_evaluation` / `offline_fixture` / `read_only_connector` / `partner_delivery` / `private_pack` / `blocked` |
| `evidenceRefs` | 是 | public PR、issue、eval、fixture、docs review；不能用生产 receipt |
| `reviewOwner` | 是 | 角色名即可，例如 `helm-core-reviewer`、`ecosystem-reviewer` |
| `certificationStatus` | 是 | `candidate` / `approved` / `rejected` / `withdrawn` / `revoked` / `expired` |
| `trustCenterRefs` | 是 | 授权、告知、保留期、撤销、审计或 forbidden-actions reference |
| `rollbackPath` | 是 | 下架、隐藏、降级、撤回或迁移路径 |
| `customerVisibleClaim` | 是 | public 可见声明，必须带非承诺边界 |
| `commercialBoundary` | 是 | 说明无转售、无返点、无价格、无采购批准、无 SLA |

推荐状态机：

```text
draft
  -> evidence_pending
  -> review_ready
  -> listed_for_public_reference
  -> private_evaluation_required
  -> certified_or_pack_route_candidate
```

任一阶段都可以进入：

```text
rejected | withdrawn | revoked | expired | blocked
```

## 4. 证据要求

### 4.1 最低上架证据

进入 `listed_for_public_reference` 前必须具备：

- listing 字段完整。
- 与 [Trust Center requirements](HELM_TRUST_CENTER_REQUIREMENTS.md) 对齐的授权、告知、
  保留期、撤销、审计和禁止项检查。
- 至少一个 public-safe evidence ref，例如 synthetic fixture、eval、docs review、
  public PR 或 issue。
- 明确 `notFor` 与 `commercialBoundary`。
- 明确是否需要 private contract、private Pack、Overlay 或 control-plane metadata。

### 4.2 适配证据

进入 `private_evaluation_required` 或 `certified_or_pack_route_candidate` 前必须补：

| 证据 | 说明 |
|---|---|
| fit note | 为什么该能力匹配 AI Diagnostic need |
| data posture | 需要哪些数据、是否个人数据、是否音频 / 转写 / CRM snapshot |
| permission map | 最小权限、只读优先、写回是否 review-first |
| failure posture | 缺数据、过期数据、供应商不可用、权限失效时怎么降级 |
| audit route | trace、review record、command receipt 或私有 owner-held 记录路径 |
| exit path | 下架、撤销、替换、回滚或迁移路径 |

这些证据仍不等于认证批准、采购批准、供应商合作或客户部署证明。

## 5. 适配路径

| 路径 | 适用场景 | 边界 |
|---|---|---|
| `manual_evaluation` | 只做人工调研和 public-safe 评估 | 不调用真实客户数据 |
| `offline_fixture` | 用 synthetic / redacted fixture 评估能力 | 不代表生产表现 |
| `read_only_connector` | 只读 connector 或 snapshot 适配 | 写回、外发、审批必须另行 review |
| `partner_delivery` | 需要 FDE / partner 帮客户评估 | 不公开真实 partner 名单或客户材料 |
| `private_pack` | 重复行业需求可以沉淀为 Pack candidate | Pack 实现在 `helm-packs`，客户差异在 `helm-overlays` |
| `blocked` | 授权、合规、设备、权限或商业边界不满足 | 不得上架、推荐或继续适配 |

AI Shelf 不承接 BOM、部署登记、健康心跳、用量元数据或 owner release approval；
这些属于 `helm-control-plane`。

## 6. 下架与撤销规则

Listing 必须可撤回。触发条件：

- 授权、告知、保留期、撤销或审计 evidence 失效。
- listing 范围漂移，实际能力超出原 `problemFit` 或 `permissionPosture`。
- 供应商、partner、connector 或 Pack route 出现新的禁止项风险。
- customer-visible claim 暗示结果保证、认证批准、转售、价格、返点、SLA 或部署 ready。
- 能力依赖隐形、改装、远程操控、作弊、暗录、暗采或越权采集设备。
- public-safe evidence 被发现包含真实客户、真实人员、私有域名、生产日志、凭据或部署 receipt。
- owner、reviewer 或 security reviewer 要求暂停。

下架动作必须记录：

| 字段 | 含义 |
|---|---|
| `removedAt` | 下架时间 |
| `reasonCode` | `trust_evidence_expired` / `scope_drift` / `forbidden_capability` / `claim_overreach` / `public_safety_violation` / `owner_hold` |
| `replacementPath` | 无替代、降级为 manual evaluation、转 private review、转 Pack candidate 等 |
| `publicClaimHandling` | 已公开声明是否需要更新、隐藏或撤回 |

## 7. 明确禁止上架的能力

以下能力不允许进入 AI Shelf，也不允许被 Helm 推荐、销售、采购、适配或包装成
Sales Process Intelligence 的合规入口：

- 隐形、伪装、改装、远程操控、作弊、暗录、暗采设备。
- 绕过员工、客户、会议参与方、店员、销售或管理员告知的采集方案。
- 偷拍、偷录、键盘记录、屏幕偷看、远程接管、定位跟踪、私密账号抓取或绕权插件。
- 替人实时操控话术、考试 / 考核作答、客户现场动作或系统账号的工具。
- 绕过平台规则、审计、风控、采购、合同、认证或客户审批流程的能力。
- 未经授权抓取 CRM、IM、邮箱、会议、工单、通话或业务系统数据的 connector。
- 自动生成并执行客户承诺、采购决定、合同、付款、部署批准或认证批准的流程。

灰色设备红线：AI Shelf 不卖、不推荐、不代采、不上架、不适配隐形、改装、
远程操控、作弊、暗录或暗采设备。

## 8. 与 Trust Center 和认证生态的关系

AI Shelf listing 依赖 Trust Center evidence，但不替代 Trust Center。
AI Shelf listing 可以进入 certified ecosystem review，但 listing 本身不等于认证。

```text
AI Diagnostic need
  -> AI Shelf candidate
  -> Trust Center evidence review
  -> manual fit review
  -> listed for public reference
  -> private evaluation / partner delivery / Pack candidate / certified ecosystem review
```

公开文档可描述路径和字段，不公开真实供应商名单、真实 partner 名单、真实客户
材料、价格、返点、分润、股权、合同、部署授权或生产 receipt。

## 9. 机器化合成契约 / Machine-Checked Synthetic Contract

首个 public-safe listing candidate fixture 位于
[ai-shelf-trust-center-contract.fixture.json](fixtures/ai-shelf-trust-center-contract.fixture.json)，
由 `npm run check:ai-shelf-trust-center-contract` 校验，并接入
`npm run check:boundaries`。该守卫会 fail closed：

- listing 字段缺失或 Trust Center refs 缺失。
- 出现真实客户 / 真实人员 / 私有域名 / credential / production receipt 标记。
- 出现 reseller、marketplace、pricing、revenue share 或采购批准姿态。
- 灰色设备、暗录、暗采、远控、作弊设备红线未显式 blocked。

该 fixture 是 synthetic contract only；不是法律意见、供应商合作、认证批准、转售授权、
客户部署、Pack release approval 或生产 receipt。

## English Reference

This document defines the public-safe listing contract for Helm AI Shelf.
AI Shelf is a review-first capability directory. It helps route AI Diagnostic
needs to capabilities, integration paths, partners, or Pack candidates after
evidence, permission, boundary, and fit review.

AI Shelf is not AI product distribution, a reseller program, a marketplace, an
app store, a purchasing platform, an affiliate channel, vendor ranking,
outcome endorsement, or automated deployment entrypoint. Listing does not mean
purchase recommendation; fit does not mean procurement approval; listing does
not mean certification approval; demo success does not mean customer deployment
readiness.

Every listing must define a stable id, display name, capability category,
problem fit, not-for cases, input requirements, permission posture, data
boundary, integration path, evidence references, review owner, certification
status, Trust Center references, rollback path, customer-visible claim, and
commercial boundary. Listings must be removable when evidence expires, scope
drifts, claims overreach, public safety is violated, owner review pauses the
entry, or a forbidden capability appears.

Helm AI Shelf must not sell, recommend, source, list, or adapt covert,
disguised, modified, remotely controlled, cheating, hidden-recording, or
hidden-collection devices. Public docs must not disclose real vendor rosters,
private partner lists, pricing, reseller terms, revenue share, equity terms,
customer names, private domains, credentials, deployment authorization, or
production receipts.

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-07-05 | 初版：定义 AI Shelf 非分销边界、listing 字段、证据、适配路径、下架规则和灰色设备红线。 |
