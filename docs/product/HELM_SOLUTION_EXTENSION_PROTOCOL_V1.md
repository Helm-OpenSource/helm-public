---
status: active
owner: helm-core
created: 2026-04-12
review_after: 2026-07-11
public_safety: Public-safe extension protocol. Customer-specific overlays, private Pack implementation, and tenant configuration are excluded from helm-public.
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

- 输入输出契约
- 适用场景
- 风险等级
- 复核 / 批准姿态
- 是否允许客户可见

### 5.3 Resource

`Resource` 是底层调用供给。

它定义：

- 调哪个系统
- 用什么认证模式
- 哪个工作区范围
- 有哪些审计 / 回放提示

### 5.4 Solution Extension

`Solution Extension` 是一个有界的方案扩展层。

它可以组合：

- `Worker`
- `Skill`
- `Resource`
- 额外领域对象
- 页面和操作员界面
- 租户 / 保留工作区数据归属
- 复核 / 策略 / 报告 / 结算边界

它的职责不是“定义一个能力”，而是“把一整套场景化产品面和运行约束收成可治理的一层”。

### 5.5 Commercial / Delivery Line

`Commercial / Delivery Line` 是商业和交付线。

它定义：

- 收益来自哪里
- 谁是受益方
- 分润 / 冲回逻辑
- 条款 / 申请 / 邀请边界
- 结算 / 付款姿态

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

- 调什么数据源 / API / 连接器 / 浏览器运行时

### 6.4 这是 `Solution Extension`，如果它主要回答

- 这类客户 / 这条经营线 / 这类交付场景要一整套什么对象、页面、报表、治理和操作面

### 6.5 这是 `Commercial / Delivery Line`，如果它主要回答

- 收益从哪来
- 怎么归因
- 怎么复核
- 怎么邀请
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
- 受益方
- 复核 / 邀请
- 结算 / 付款姿态

所以它们不应被塞进 `Skill` 或 `Worker` 目录。

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
- 新领域对象
- 新查询 / 报表
- 新工作流 / 操作员界面
- 新结算 / 归因 / 邀请规则
- 新角色姿态

这些内容超过了 `Skill` 和 `Worker` 的职责。

如果把它们整体塞进 `Skill / Worker`，会产生 4 个后果：

1. 能力目录被产品模块污染
2. 交付对象和执行对象混在一起
3. 结算 / 分润 / 条款被误读成能力元数据
4. 后续核心升级无法判断“该抽能力、该抽页面、还是该抽商业线”

因此：

- 定制开发共性应先进入 `Solution Extension`
- 只有其中稳定、可复用、可脱离客户专属数据模型的执行能力，才提炼进 `Skill`
- 只有其中稳定、跨场景一致的角色执行身份，才提炼进 `Worker`

## 9. Solution Extension 的四类等级

后续 `Solution Extension` 默认只允许以下 4 类：

### 9.1 `FIRST_PARTY_RESERVED`

用于 Helm 自己经营 Helm。

特点：

- 宿主数据归 Helm 保留工作区
- 可以有公开可读入口
- 但真正的宿主工作区、操作员数据、内部读面仍属于 Helm 自留层

### 9.2 `TENANT_CUSTOM`

用于某个客户或某个交付项目专属扩展。

特点：

- 数据归属归该租户工作区
- 可以复用共享 `Worker / Skill / Resource`
- 不默认进入共享核心

### 9.3 `REUSABLE_EXTENSION`

用于已经在多个客户或多个一方场景里重复验证的扩展原型。

特点：

- 语义已稳定
- 仍保留扩展边界
- 但已经值得被打包、复制、标准化

### 9.4 `CORE_PRODUCT`

用于已经真正进入主产品的能力。

只有同时满足以下条件才值得进入：

- 代码已稳定
- 页面已稳定
- 测试 / 守卫已稳定
- 文档 / 边界措辞已稳定
- 不再依赖单一客户或单一一方经营特例

## 10. 升级规则

### 10.1 从 `Solution Extension` 提炼到 `Skill`

只有当一项能力同时满足以下条件时，才应进入 `Skill`：

- 输入输出契约稳定
- 风险边界稳定
- 复核姿态稳定
- 不依赖单一客户专属对象或结算规则
- 在多个 extension 中可复用

### 10.2 从 `Solution Extension` 提炼到 `Worker`

只有当以下条件成立时，才应进入 `Worker`：

- 角色身份稳定
- 责任边界稳定
- 升级模式稳定
- 不只是某个单独项目的临时操作员壳层

### 10.3 保持为 `Commercial / Delivery Line`

只要核心问题仍然是：

- 归因
- 付款
- 邀请
- 结算
- 申请 / 条款 / 复核

就继续留在 `Commercial / Delivery Line`，不要提炼进 `Skill / Worker`。

## 11. 当前冻结结论

当前 repo 后续应按以下结论推进：

1. Helm 自己的保留经营功能，应被理解为 `FIRST_PARTY_RESERVED Solution Extension`
2. 定制开发类客户的共性功能，应优先进入 `TENANT_CUSTOM` 或 `REUSABLE_EXTENSION`
3. 只有其中稳定的执行能力才提炼进 `Skill`
4. 只有其中稳定的角色执行身份才提炼进 `Worker`
5. `CustomEngagement`、`PartnerProgram`、`ProgramApplication`、`ParticipantPortalAccess`、`SettlementBatch` 继续不是 `Skill / Worker`
6. 工程复核、内部运营扩展这类一方界面，当前也不应被直接写成通用核心报表模块

## 12. 刻意未做

本协议当前刻意未做：

- 新 Prisma 数据模式
- 新扩展注册界面
- 市场分类法
- 系统集成交付项目系统
- 自动把定制扩展晋级成核心产品
- 自动把 skill/worker 与结算对象做一对一映射

## 13. 风险项

### 风险 1

如果把 `CustomEngagement` 这类对象误写成 `Skill`，后续能力目录会失真。

### 风险 2

如果把一方保留扩展误写成共享核心，普通租户会继续看到 Helm 自营数据。

### 风险 3

如果把所有“共性”都直接抽成核心，会过早平台化，导致数据模式、权限和升级路径一起失控。

## 14. 最终判断原则

外部成员的登录落地由已登记的 `externalMemberSurfaces` 决定，优先于部署默认首页、Core 首次资料补全和 Core 工作区选择页；其可选资料与多工作区切换由所属扩展负责。未登记的非空 scope 回到登录页，不回退到普通成员入口。扩展页面必须在服务端先执行会话边界检查，再渲染管理界面，不能只靠浏览器取数接口拒绝访问。此规则不授予新的角色、工作区或业务权限。

External member landing takes precedence over deployment home and Core onboarding. Unknown scopes fail closed. Extensions must guard server-rendered management pages before exposing their shell; API authorization remains independent.

坐席客户端设备批准时的授权对象（受众选项）由已登记的 `seatDeviceAudienceOptions` 提供。只允许一个扩展登记，第二个登记会在注册时报错。扩展的 `listOptions` 列出当前成员可选的授权对象，Core 负责展示，并校验所选值确实在当时读到的清单里，批准时把它写入设备的 `audiencePin`，只写一次，之后不再改。没有登记扩展或清单为空时，批准与原来完全相同；此时请求若带了所选值，答 `audience_invalid`。

- 调用约定：`listOptions` 只读、不写库，可能被重复调用（查找一次、批准再一次），在 Core 的任何事务之外调用，不得依赖调用方事务。每次调用限时 2 秒，超时后 Core 触发传入的 `AbortSignal` 并丢弃结果；不理会信号的扩展会继续跑完，结果不会被采用。
- 清单约束：最多 20 项。值为 1 到 191 个可见 ASCII 字符、不含空白，按原样精确比较；显示名去掉首尾空白后为 1 到 80 个字符，不得含控制字符、零宽字符或双向控制字符。任何一项不合格，整份清单作废，不会只丢弃那一项。成员的可选对象超过 20 个时，查找和批准对他一律失败，扩展必须自行筛到 20 项以内。
- 失败即拒绝：扩展抛错、超时或返回不合格的清单时，查找和批准都答 503，不会退回无选项流程。拒绝操作永远不询问扩展，不受影响；配对码错误或账户锁定期间也不询问扩展。
- 上限：选定授权对象时，每个对象最多 3 台在役设备；尚未钉住的设备计入每一个对象，这是保守口径，这类设备在扩展首次使用时被钉住，之后只计入那一个对象。无论如何选，每个成员的在役设备合计不超过 60 台（每对象 3 台乘清单上限 20 项）。钉住值比它来源的选项活得久，清单变化后，旧对象下的设备仍计入合计。
- 时间窗口与撤销：清单在批准事务之外读取。从读取到提交之间若某个对象失效，留下的设备由扩展在每次设备请求时按钉住值核验并拒绝。扩展停用某个对象下的席位时，用 `revokeSeatDevicesInTx` 的 `audiencePin` 按对象撤销；未钉住的设备不在其内，如果停用的是成员最后一个有效对象，就不要传 `audiencePin`，撤销该成员的全部设备。重新启用某个对象下的席位之前，应再按该对象撤销一次，清掉批准窗口内漏掉的设备。
- 通知：通知正文放不下授权对象那一句时会省略它，以保住末尾的撤销提示；审计记录总有完整的对象信息。

Seat device approval offers audience options only from the registered `seatDeviceAudienceOptions`, and only one extension may register it: a second registration throws. The extension's `listOptions` lists the current member's options; Core shows the list, checks that the chosen value is in the list as read at that moment, and writes it as the device's `audiencePin` at approval, once. Without a registration or with an empty list, approval is unchanged, and a request that names a value is answered `audience_invalid`.

- Calls: `listOptions` reads only, may be called more than once (at lookup and again at approval), runs outside any Core transaction and must not depend on one. Each call has 2 seconds; then Core aborts the `AbortSignal` it passed and drops the result. An extension that ignores the signal runs on, but its result is never used.
- The list: at most 20 options. Values are 1 to 191 printable ASCII characters without whitespace, compared exactly; labels are 1 to 80 characters once trimmed, with no control, zero-width or bidirectional formatting characters. One unusable entry voids the whole list. A member with more than 20 options can neither look up nor approve, so the extension narrows the list to 20 itself.
- Failure is refusal: an extension that throws, times out or answers an unusable list fails both lookup and approval with 503, never the no-options flow. Reject never asks the extension, and neither does a wrong pairing code or a locked account.
- Caps: with an audience chosen, each audience holds at most 3 live devices, and unpinned devices count for every audience (conservative: the extension pins such a device on first use, after which it counts for that audience only). Whatever is chosen, a member holds at most 60 live devices in all (3 per audience times the 20-option limit); pins outlive the options they came from, so devices of an option that left the list still count.
- Window and revocation: the list is read outside the approval transaction, so an audience that becomes invalid before the commit leaves a device that the extension's per-request check against the pin refuses. When a seat of one audience goes inactive, the extension revokes by audience with `revokeSeatDevicesInTx`'s `audiencePin`; unpinned devices are not included, so when that audience was the member's last valid one it omits `audiencePin` and revokes every device. Before enabling a seat of an audience again, it revokes by that audience once more, to clear a device approved inside the window.
- Notification: the notification leaves the audience sentence out when it has no room for it, to keep the closing revoke hint; the audit always records the audience.

当不确定某个东西属于哪一层时，默认先问：

1. 它回答的是能力，还是一整套场景化产品面？
2. 它的核心问题是执行，还是交付 / 结算 / 邀请 / 复核？
3. 它是否脱离单一客户和单一宿主工作区仍然成立？

只要第二题答案偏向交付 / 结算 / 邀请 / 复核，或第三题答案是否定，就不要直接归入 `Skill / Worker`。
