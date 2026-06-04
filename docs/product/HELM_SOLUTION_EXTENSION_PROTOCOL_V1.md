---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Solution Extension Protocol V1 / Helm Solution Extension 协议 V1

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文件是 Solution Extension 协议的公开 Core 版本。它定义公开、通用的扩展如何与 Helm Core
发生关系，但不发布私有客户 overlay、商业 Pack 实现细节、结算逻辑或私有交付作业手册。

Solution Extension 是复核优先的有界方案扩展层，可以在 Helm Core 之上组合
领域特定界面、夹具、报告资产和有界运行时适配器。它不是市场、插件沙箱、结算通道、
客户交付项目跟踪器或自动对外发送权限。

公开扩展必须使用通用 / 合成名称，使用合成 / 脱敏夹具，
声明复核优先边界，避免客户专属配置，并保持 Core 可独立构建。私有客户定制
必须留在 `helm-public` 之外。

## English Reference

This is the public Core version of the Solution Extension protocol.

It defines how public, generic extensions should relate to Helm Core. It does
not publish private customer overlays, commercial Pack implementation details,
settlement logic, or private delivery runbooks.

## Purpose

A Solution Extension is a review-first bundle that can add domain-specific
surfaces, fixtures, report assets, and bounded runtime adapters on top of Helm
Core.

It is not:

- a marketplace
- a plugin sandbox
- a settlement rail
- a customer delivery project tracker
- an automatic external-send authority

## Public Extension Rules

Public extensions must:

1. Use generic or synthetic names.
2. Use synthetic or redacted fixtures.
3. Declare review-first boundaries.
4. Avoid customer-specific configuration.
5. Keep Core independently buildable.

Private customer customization belongs outside `helm-public`. See
[HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md).

## Boundary Model

```text
Core SDK <- Pack SDK <- Overlay
```

Public Core can expose stable SDK seams. Commercial Packs and private Overlays
may depend on those seams, but Core must not import them.

## Current Public Status

The public repository carries the Core and public sample material only. Real
customer overlays and commercial Pack source are intentionally excluded.

- `Worker` 不负责定义定制项目
- `Skill` 不负责承载结算或交付对象
- `Resource` 不负责承载产品模块
- `Solution Extension` 不直接等于 capability
- `Commercial / Delivery Line` 不直接等于 `Skill`

## 5. 一句话定义

### 5.1 Worker

`Worker` 是角色执行单元。

它定义：

- 角色是谁
- 责任边界是什么
- 默认调哪些 `Skill`
- 什么时候需要升级给人工

### 5.2 Skill

`Skill` 是可复用能力单元。

它定义：

- 输入输出 contract
- 适用场景
- 风险等级
- review / approval posture
- 是否允许 customer-facing

### 5.3 Resource

`Resource` 是底层调用供给。

它定义：

- 调哪个系统
- 用什么 auth mode
- 哪个 workspace scope
- 有哪些 audit / replay hint

### 5.4 Solution Extension

`Solution Extension` 是一个有界的方案扩展层。

它可以组合：

- `Worker`
- `Skill`
- `Resource`
- 额外 domain objects
- 页面和 operator surfaces
- tenant / reserved workspace data ownership
- review / policy / reporting / settlement boundary

它的职责不是“定义一个能力”，而是“把一整套场景化产品面和运行约束收成可治理的一层”。

### 5.5 Commercial / Delivery Line

`Commercial / Delivery Line` 是商业和交付线。

它定义：

- 收益来自哪里
- 谁是 beneficiary
- split / reversal 逻辑
- terms / application / invite 边界
- settlement / payout posture

它可以挂到 `Worker`、`Solution Extension` 或平台自身，但它本身不是 `Skill`。

## 6. 判断规则

后续如果一个新需求进来，优先用下面这组判断：

### 6.1 这是 `Worker`，如果它主要回答

- 谁在做
- 谁负责
- 谁应该升级

### 6.2 这是 `Skill`，如果它主要回答

- 这项能力做什么
- 输入输出是什么
- 风险和复核姿态是什么

### 6.3 这是 `Resource`，如果它主要回答

- 调什么数据源 / API / connector / browser runtime

### 6.4 这是 `Solution Extension`，如果它主要回答

- 这类客户 / 这条经营线 / 这类交付场景要一整套什么对象、页面、报表、治理和操作面

### 6.5 这是 `Commercial / Delivery Line`，如果它主要回答

- 收益从哪来
- 怎么归因
- 怎么 review
- 怎么 invite
- 怎么结算

## 7. 当前 repo 的正确映射

### 7.1 属于 `Worker / Skill`

- `deal_desk_worker`
- `specialist_review_worker`
- `SkillSuggestion -> candidate capability -> formal review queue`

但要继续保留：

- `candidate capability != formal skill`
- `formal review != execution authority`

### 7.2 属于 `Commercial / Delivery Line`

- `WorkerPublisherProfile`
- `SalesReferral`
- `CustomEngagement`
- `RevenueRule`
- `RevenueAttributionLedger`
- `PayoutLedger`
- `SettlementBatch / SettlementBatchLine`
- `PartnerProgram / ProgramTermsVersion / ProgramApplication`
- `ParticipantPortalAccess`

这些对象虽然会引用 worker、partner 或 participant，但它们的主问题仍然是：

- 商业来源
- beneficiary
- review / invite
- settlement / payout posture

所以它们不应被塞进 `Skill` 或 `Worker` catalog。

### 7.3 属于 `Solution Extension`

以下更适合被理解为 `Solution Extension surface`：

- Helm 自己的 first-party internal operating extension
- Helm 自己的工程交付复核
- 某类定制开发客户的整套交付模块、页面和 operator pack
- 某类行业 / 项目型客户的 domain-specific reporting + governance + delivery readout

这类东西通常会复用 shared `Worker / Skill / Resource`，但它们本身不是单一 capability。

## 8. 为什么定制开发共性不能直接并入 Skill / Worker

“定制开发共性”里往往同时包含：

- 新页面
- 新 domain objects
- 新 query / report
- 新 workflow / operator surface
- 新 settlement / attribution / invite 规则
- 新 role posture

这些内容超过了 `Skill` 和 `Worker` 的职责。

如果把它们整体塞进 `Skill / Worker`，会产生 4 个后果：

1. capability catalog 被产品模块污染
2. 交付对象和执行对象混在一起
3. 结算 / 分润 / terms 被误读成 capability metadata
4. 后续 core 升级无法判断“该抽能力、该抽页面、还是该抽商业线”

因此：

- 定制开发共性应先进入 `Solution Extension`
- 只有其中稳定、可复用、可脱离客户专属数据模型的执行能力，才提炼进 `Skill`
- 只有其中稳定、跨场景一致的角色执行身份，才提炼进 `Worker`

## 9. Solution Extension 的四类等级

后续 `Solution Extension` 默认只允许以下 4 类：

### 9.1 `FIRST_PARTY_RESERVED`

用于 Helm 自己经营 Helm。

特点：

- host data 归 Helm reserved workspace
- 可以有 public-readable 入口
- 但真正的 host workspace、operator data、internal readout 仍属于 Helm 自留层

### 9.2 `TENANT_CUSTOM`

用于某个客户或某个交付项目专属扩展。

特点：

- data ownership 归该 tenant workspace
- 可以复用 shared `Worker / Skill / Resource`
- 不默认进入 shared core

### 9.3 `REUSABLE_EXTENSION`

用于已经在多个客户或多个 first-party scenario 里重复验证的扩展原型。

特点：

- 语义已稳定
- 仍保留 extension 边界
- 但已经值得被打包、复制、标准化

### 9.4 `CORE_PRODUCT`

用于已经真正进入主产品的能力。

只有同时满足以下条件才值得进入：

- 代码已稳定
- 页面已稳定
- tests / guards 已稳定
- docs / boundary wording 已稳定
- 不再依赖单一客户或单一 first-party 经营特例

## 10. 升级规则

### 10.1 从 `Solution Extension` 提炼到 `Skill`

只有当一项能力同时满足以下条件时，才应进入 `Skill`：

- 输入输出 contract 稳定
- 风险边界稳定
- 复核姿态稳定
- 不依赖单一客户专属对象或结算规则
- 在多个 extension 中可复用

### 10.2 从 `Solution Extension` 提炼到 `Worker`

只有当以下条件成立时，才应进入 `Worker`：

- 角色 identity 稳定
- responsibility boundary 稳定
- escalation mode 稳定
- 不只是某个单独项目的 temporary operator shell

### 10.3 保持为 `Commercial / Delivery Line`

只要核心问题仍然是：

- attribution
- payout
- invite
- settlement
- application / terms / review

就继续留在 `Commercial / Delivery Line`，不要提炼进 `Skill / Worker`。

## 11. 当前冻结结论

当前 repo 后续应按以下结论推进：

1. Helm 自己的保留经营功能，应被理解为 `FIRST_PARTY_RESERVED Solution Extension`
2. 定制开发类客户的共性功能，应优先进入 `TENANT_CUSTOM` 或 `REUSABLE_EXTENSION`
3. 只有其中稳定的执行能力才提炼进 `Skill`
4. 只有其中稳定的角色执行身份才提炼进 `Worker`
5. `CustomEngagement`、`PartnerProgram`、`ProgramApplication`、`ParticipantPortalAccess`、`SettlementBatch` 继续不是 `Skill / Worker`
6. engineering review、internal operating extension 这类 first-party surfaces，当前也不应被直接写成 generic core report module

## 12. 刻意未做

本协议当前刻意未做：

- 新 Prisma schema
- 新 extension registry UI
- marketplace taxonomy
- SI project system
- 自动把 custom extension 晋级成 core product
- 自动把 skill/worker 与结算对象做一对一映射

## 13. 风险项

### 风险 1

如果把 `CustomEngagement` 这类对象误写成 `Skill`，后续 capability catalog 会失真。

### 风险 2

如果把 first-party reserved extension 误写成 shared core，普通租户会继续看到 Helm 自营数据。

### 风险 3

如果把所有“共性”都直接抽成 core，会过早平台化，导致 schema、权限和升级路径一起失控。

## 14. 最终判断原则

当不确定某个东西属于哪一层时，默认先问：

1. 它回答的是能力，还是一整套场景化产品面？
2. 它的核心问题是执行，还是交付 / 结算 / 邀请 / 复核？
3. 它是否脱离单一客户和单一 host workspace 仍然成立？

只要第二题答案偏向交付 / 结算 / 邀请 / 复核，或第三题答案是否定，就不要直接归入 `Skill / Worker`。
