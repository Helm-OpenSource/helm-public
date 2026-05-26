---
status: active
owner: helm-core
created: 2026-05-17
review_after: 2026-08-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Open Core / Enterprise / Cloud Architecture

更新时间：2026-05-17
状态：Architecture decision accepted；Phase 1 / Phase 2 guard and contract adoption in progress
适用范围：Helm Apache-2.0 Open Core、Enterprise、Cloud、OPC / HVP、Tenant Overlay、Deployment Profile 与 Year 1 商业化边界
实现状态：Phase 0 文档裁决已落；Phase 1 已补 public-release hygiene 守卫、public mirror projection / builder / verifier；Phase 2 已补 Tenant Overlay、Deployment Profile 与 i18n fallback 最小 contract；仍不创建 marketplace、Pack SDK、Enterprise / Cloud runtime 或 tenant-private public Pack

## 1. 背景

Helm 当前已经同时面对三条压力：

1. 公开仓采用 Apache-2.0，开源要成为采用引擎、标准层和独立咨询师入口。
2. Year 1 需要付费收入，商业能力必须能支撑高现金流企业合同、受控试点续约和托管云早期客户。
3. 某些 tenant-private extension 已经证明 Helm 可以承接垂直行业场景，但这些资产仍是私有租户 overlay，不是公开 Pack 或 marketplace。

因此本裁决的核心目标不是扩张平台，而是把以下边界冻结清楚：

- 哪些代码属于 Apache-2.0 Open Core。
- 哪些能力必须留在 private commercial repo / private tenant repo。
- Deployment Profile 能做什么、不能做什么。
- OPC / HVP / Curated Pack 如何服务 Year 1 现金流，而不把 Helm 推向 marketplace、auto-execution plane 或完整 SI 平台。

本文继承以下 current-main truth：

- Helm 仍是 `workspace-first`、`controlled-trial`、`judgement-first`、`decision-first`、`review-first`。
- `recommendation != commitment`，`proactive != auto-decision`。
- 客户可见发送、CRM 写回、合同承诺、对外报价仍必须由人复核。
- `plugin runtime` 仍没有真正 sandbox。
- `check:boundaries` 不是 `check:public-release`，两者解决的问题不同。
- tenant-private implementation 当前仍走 preview-only / suggestion-only / no-side-effect 路线。

## 2. 核心裁决

### 2.1 Apache-2.0 只覆盖 Open Core

`helm` 公开仓只承载 Open Core。该仓内的代码、文档和示例默认受 Apache-2.0 约束。

商业护城河不靠隐藏开源仓里的 build flag，而靠四件事：

1. 商标和品牌使用许可。
2. private commercial repo 中的 enterprise-only 模块。
3. 服务端 license / entitlement / workspace feature gate。
4. 托管云、SLA、实施服务和商业合同。

### 2.2 Commercial source 不进 Apache-2.0 仓

Enterprise / Cloud / OPC 专有实现不得放进 Apache-2.0 仓后再靠 SPDX、目录名或 build flag 区分。

当前阶段采用：

- `helm`：Apache-2.0 Open Core。
- `helm-enterprise`：private commercial repo，承载多工作区、SSO、审计导出、企业白标和组织治理。
- `helm-cloud`：private cloud repo，承载计费、租户开通、运维控制面、region / secret / data residency。
- `helm-tenants-private`：private tenant repo，承载客户私有 overlay。

BSL 1.1 / Elastic License 2.0 / proprietary 的最终选择延后到 public mirror 发布前 60 天评审；在此之前，commercial repo 先保持 private / proprietary。

### 2.3 Deployment Profile 不是边界

`Deployment Profile` 只能选择默认装配、默认 UX、默认文案、默认品牌和默认开关。

它不是：

- license boundary
- security boundary
- entitlement boundary
- tenant isolation boundary
- data residency guarantee

任何商业权限、付费功能、租户隔离和审计保证必须由服务端 entitlement、workspace boundary、network / DB / region isolation 和审计链实现。

### 2.4 Tenant Overlay 不是 Pack

Tenant Overlay 是部署侧、租户侧或商业合同侧的覆盖层，负责：

- logo / theme / copy
- locale 默认值
- enabled extension set
- customer-specific connector config
- tenant-private report / scoring / prompt / template

tenant-private customer implementation 当前属于 Tenant Overlay + Tenant Custom Solution Extension，不是公开 Pack，不是 Verified Pack，也不是 marketplace listing。

### 2.5 Year 1 不做 marketplace / full Pack SDK

Year 1 允许沉淀 `Curated Pack` 概念，但只作为 Helm 内部或 HVP 合作的受控交付资产。

Year 1 不做：

- marketplace
- 第三方自由上架
- 支付分账
- Pack SDK 中声明 schema migration / connector implementation / pricing
- Community Pack 安装市场
- 自动 customer-facing send
- broad auto-write
- 完整 workflow / orchestration 平台

## 3. 概念边界表

| 概念 | 物理位置 | 许可 / 属性 | 主要职责 | 明确不负责 |
| --- | --- | --- | --- | --- |
| Open Core | `helm` public mirror | Apache-2.0 | 单工作区、判断卡、记忆、review-first action、基础 i18n、Solution Extension primitive、基础主题 hook | 多工作区企业治理、SSO、企业审计导出、商业白标授权、Cloud 控制面、客户私有逻辑 |
| Enterprise | `helm-enterprise` private repo | commercial / proprietary | 多工作区、SSO / SAML / OIDC / SCIM、审计导出、组织治理、企业白标、关闭 `Powered by Helm` 的商业授权实现 | 不进入 Apache-2.0 仓，不靠 build flag 隐藏 |
| Cloud | `helm-cloud` private repo | proprietary service | 计费、租户开通、运维控制面、region pinning、secret / KMS、data residency、托管服务 SLA | 不作为 Open Core 能力承诺，不默认开放自助生产 |
| Tenant Overlay | private tenant repo 或部署侧配置 | tenant-private | 客户 logo/theme/copy/locale、enabled extensions、客户连接器配置、客户私有 prompt / report / template | 不等于 Pack，不进入 public mirror，不授予额外执行权限 |
| Solution Extension | Open Core primitive + private implementation | core primitive Apache；tenant implementation private | workspace-level enablement、manifest、bundle、extension runtime identity | 不等于 marketplace，不天然拥有写权限或对外发送权 |
| Curated Pack | Helm / HVP 受控交付资产 | 视合同而定 | 行业模板、术语、判断卡、demo fixture、默认 overlay、实施材料 | Year 1 不含自由安装市场、schema migration DSL、pricing DSL、第三方分账 |
| Deployment Profile | env / deployment manifest | N/A | 默认 UX、默认品牌、默认 feature posture、默认 locale / region hint | 不做许可、安全、隔离、entitlement |

Tenant Overlay 的最小 contract 已单独落地到 [HELM_TENANT_OVERLAY_CONTRACT.md](HELM_TENANT_OVERLAY_CONTRACT.md)，当前只提供 contract / validator / locale fallback helper，不接 runtime loader。

Tenant Overlay 可以是单语言客户实现：例如中文-only overlay 应声明默认 locale 与 supported locale 均为 `zh-CN`，且不应被自动打入英文发行线。后续如需英文行业产品，应抽取通用 Pack primitive 后另行做 Edition / 翻译 / 合同审查，不能把客户 overlay 直接打入英文版。

## 4. Deployment Profile 语义

建议第一阶段只定义运行时 profile，不引入 `BUILD_EDITION` 作为产品分叉。

推荐命名：

- `HELM_RELEASE_PROFILE`: `community` / `enterprise` / `cloud` / `opc`
- `HELM_DEPLOYMENT_REGION`: `cn` / `global`
- `HELM_DATA_RESIDENCY`: `cn` / `global`
- `HELM_DEFAULT_LOCALE`: `zh-CN` / `en-US`

Deployment Profile 的最小 contract 已单独落地到 [HELM_DEPLOYMENT_PROFILE_CONTRACT.md](HELM_DEPLOYMENT_PROFILE_CONTRACT.md)，并接入 `npm run validate:env`。未知值 fail closed，region / data residency 必须一致，但该 profile 仍只表达默认姿态 hint，不承担 license / security / source / entitlement 边界。

规则：

1. profile 只影响默认展示、默认启用集合和部署检查。
2. profile 不得让 Apache-2.0 仓中的商业源码变成隐藏功能。
3. enterprise-only module 必须来自 private commercial repo。
4. tenant-private overlay 必须来自 private tenant repo 或部署侧配置。
5. profile 解析必须 fail closed；未知值不得回退到 enterprise / cloud。

禁止：

- 使用 `BUILD_EDITION` 作为 license / security / entitlement boundary。
- 在 client bundle 中暴露 `NEXT_PUBLIC_*` 形式的付费权限裁决。
- 通过 tree-shaking 声称商业隔离已经成立。

## 5. Apache-2.0、Trademark 与 Branding

Apache-2.0 授予代码使用、修改和分发权，但不授予 Helm 商标、logo 或同源视觉标识的使用权。

因此最终规则是：

1. Open Core 用户可以修改 UI logo、theme、copy、产品名和 `Powered by Helm` 字样。
2. Open Core 用户必须保留源码文件中的 license header、根目录 `LICENSE` 和 `NOTICE`。
3. 未经商标授权的 fork / derivative distribution 不得继续以 `Helm` 名称、logo 或混淆性标识对外发布。
4. Enterprise / OPC 合同授予的是商标使用、合法白标、去标、SLA 和 enterprise-only 功能权利。
5. OSS 文档不得写成“Apache-2.0 仍强制运行时 UI 保留 Powered by Helm”。

可公开表达为：

> 代码自由，品牌受控，商业能力分仓。

英文 SaaS 自助启动前必须完成 `Helm` 名称的商标 clearance，尤其需要排查与 Kubernetes Helm / CNCF Helm 的混淆风险。

## 6. Public Mirror 与 Private Tenant Separation

Public mirror 是生成产物，不是把当前 private dev tree 直接推公开。

公开发布前必须做到：

1. `extensions/<tenant-key>/` 中的 tenant-private implementation 不进入 public mirror。
2. `app/api/extensions/<tenant-key>/` 中的 tenant-private route 不进入 public mirror。
3. `package.json` 不暴露 tenant-specific 或 customer-specific scripts。
4. `.env.example` 不暴露 tenant-specific env。
5. docs / fixtures / source maps / SBOM / Docker context 不含客户名、内部域名、私有路径或已知泄露 secret。
6. `lib/extensions/registry.tsx` 不再静态 import public mirror 不携带的 tenant implementation，或 public mirror 必须生成 signature-compatible stub。

`check:public-release` 应覆盖：

- customer-name denylist
- tenant path / import scan
- private env scan
- source map scan
- SBOM scan
- Docker context scan, including Dockerfile variants
- package script scan
- Deployment Profile / `BUILD_EDITION` / `NEXT_PUBLIC_*` commercial entitlement misuse scan
- docs public-safety scan

`check:boundaries` 继续负责 judgement / commitment / authority boundary，不替代 public release hygiene。

## 7. Year 1 实施阶段

### Phase 0：Architecture Freeze（本阶段）

性质：docs-only。

目标：

- 冻结 Open Core / Enterprise / Cloud / Tenant Overlay / Curated Pack / Deployment Profile 语义。
- 明确 No-Go 列表。
- 把该判断登记到 docs index 和 STATUS。

不做：

- 不改 runtime。
- 不改 Prisma schema。
- 不改 API / UI。
- 不创建 marketplace。
- 不创建 Pack SDK。
- 不移动 tenant-private implementation。

### Phase 1：Public Release Hygiene

目标：

- public mirror scrubber / generator / verifier 成为发布硬门。
- tenant string、private path、private scripts、source map、SBOM、Docker context 可机器检查。
- `package.json` public 面清理 tenant-specific scripts。

候选验证：

- `npm run check:public-release`
- `npm run public-mirror:build -- --mirror-root <mirror>`
- `npm run public-mirror:verify -- --mirror-root <mirror>`
- `npm run check:boundaries`
- targeted public-release guard tests

### Phase 2：Tenant Overlay Generalization

目标：

- 抽象 `Tenant Overlay` schema / loader / docs。
- 把 tenant-specific branding / copy / connector config 从 Open Core 语义中剥离。
- i18n 从单纯 `workspace.defaultLocale` 逐步升级到 request / user / workspace fallback。

不做：

- 不把 tenant-private implementation 公开成 Pack。
- 不把 tenant overlay 放进 Core DB 作为完整配置源。
- 不让 overlay 扩大 authority。

### Phase 3：Enterprise / Cloud Private Repo Split

触发条件：

- 第一个明确要求多工作区 / SSO / audit / enterprise white-label 的付费客户进入合同阶段。
- public mirror hygiene 已稳定。
- commercial module 清单已确认。

目标：

- `helm-enterprise` 承载 enterprise-only source。
- `helm-cloud` 承载托管云控制面。
- Open Core 只保留 hook / interface / primitive。

不做：

- 不在 Apache-2.0 仓中放 commercial source。
- 不通过 build flag 伪装隔离。

## 8. Go / No-Go / Defer

### Go

- Apache-2.0 Open Core。
- Open Core + private Enterprise + private Cloud + private tenant repo 的物理边界。
- 多工作区作为 Enterprise 商业切分线。
- OPC 可改 logo / theme / copy；合法继续使用 Helm 品牌和关闭 `Powered by Helm` 必须走商业授权。
- Year 1 以 existing pilot conversion、enterprise contract、founder-led HCO / HVP 为主要现金流。
- Curated Pack 作为受控交付资产。

### No-Go

- marketplace。
- full Pack SDK。
- Pack SDK 中声明 schema migration、connector implementation、pricing。
- tenant-private implementation 公开成 industry pack / verified pack。
- `BUILD_EDITION` / tree-shaking 作为许可或安全边界。
- Enterprise / Cloud commercial source 进入 Apache-2.0 仓。
- auto-send。
- broad auto-write。
- silent CRM write。
- 完整 workflow / orchestration 平台。

### Defer

- BSL 1.1 / Elastic License 2.0 / proprietary 的 commercial repo license 选择。
- marketplace / revenue share / third-party Pack installation。
- full self-serve English SaaS GA。
- cross-region enterprise failover。
- external third-party verified Pack program。

## 9. 验证门禁

| Gate | 目的 | 当前状态 |
| --- | --- | --- |
| `npm run check:boundaries` | recommendation / commitment / authority boundary | 已存在；不覆盖 public release hygiene |
| `npm run check:public-release` | public mirror 文件树泄漏、客户名、私有路径、secret、脚本、docs hygiene、商业授权边界误用 | 已扩展 public `package.json` projection、source map / SBOM artifact、Docker context / Dockerfile variants、artifact customer-name、Deployment Profile / `NEXT_PUBLIC_*` commercial entitlement misuse 检查；仍需继续加强全文档 customer-name review |
| `npm run check:secret-history` | public mirror 历史与 origin refs 不继续携带已知泄露凭据 | 已存在；当前仍 FAIL，需凭据轮换确认、受控 history rewrite / force-push 与 public mirror clean receipt |
| `npm run public-mirror:build -- --mirror-root <mirror>` | 从 private worktree 生成 public mirror candidate、排除 private roots / private files / local artifacts，并串联 preflight + verify | 已存在；必须显式指定 repo 外空目录，默认拒绝覆盖，只有 `--force-clean` 才替换目标目录 |
| `npm run public-mirror:clean-receipt -- --receipt-id <id> --source-ref <ref> --mirror-root <mirror>` | 先生成并验证 public mirror candidate，再写 machine-readable `mirror-clean:<id>` receipt | 已存在；receipt 命令证据脱敏为 `<candidate>`，不记录本机绝对路径 |
| `npm run public-mirror:preflight -- --mirror-root <mirror>` | 在准备好的 public mirror tree 中串联 `package.json` projection 与 extensions registry stub | 已存在；必须显式指定 mirror root，不默认改写 private worktree |
| `npm run public-mirror:verify -- --mirror-root <mirror>` | 验证准备好的 public mirror tree 已完成投影且不再包含 private roots / private files | 已存在；只对 mirror candidate 使用，不在 private worktree 裸跑 |
| `npm run public-mirror:extensions-stub:check` | public mirror registry stub 与 private tenant implementation 分离 | 已存在；需要纳入发布流程 |
| `npm run validate:env` | deployment env 合法性 | 已扩展 Deployment Profile enum 与 fail-closed；仍不承担 license / security / source / entitlement 边界 |
| Pack contract eval | 未来 Pack manifest 不越权 | Deferred；Year 1 不提前固化 |
| source map / SBOM / Docker context scan | 防止 private path / tenant name 随构建产物和容器上下文流出 | 已纳入 `check:public-release`，覆盖 `.map`、SBOM / CycloneDX / SPDX artifact、Dockerfile variants 中的 private path / tenant slug / internal host，并校验 full-context Dockerfile variant 的 `.dockerignore` private-root 覆盖 |
| customer-name denylist | 防止 customer name / internal domain 进入 public mirror | 构建产物层已覆盖；全文档 public-safe review 仍待人工裁决 |

## 10. 剩余风险

1. **Public mirror history**：`public-mirror:build` 只能生成干净文件树 candidate，不清理 git history / commit message；`check:secret-history` 当前仍阻塞正式发布。
2. **商标风险**：`Helm` 英文市场可能与 Kubernetes Helm / CNCF Helm 产生混淆；英文 SaaS 自助前必须做法律检索。
3. **销售话术漂移**：Enterprise / OPC 很容易被讲成 auto-execution、auto-send 或完整 workflow 平台，必须继续受 recommendation / commitment guard 约束。
4. **Pack 过早产品化**：在没有第二个独立行业客户和合作方前，把 Pack 做成 SDK 或 marketplace 会锁死错误 contract。
5. **i18n 触面广**：当前部分代码直接依赖 `workspace.defaultLocale`；英文 SaaS 自助需要 user/request fallback，但这不是 Phase 0 范围。
6. **Cloud 数据隔离**：托管云需要 region、tenant isolation、secret、audit、KMS 等独立 launch gate，不能用 Open Core build 成功替代。

## 11. 下一步

1. 正式 public release 前优先完成 secret-history remediation：凭据轮换确认、受控 history rewrite / force-push、public mirror clean receipt，并复跑 `npm run check:secret-history`。
2. 起草 `TRADEMARK.md` 或更新现有品牌文档，明确 Apache-2.0 与商标授权的分离。
3. 建立 Deployment Profile enum 与 env validation 计划，但暂不让它承担商业隔离。
4. 对 tenant-private 路线继续保持 private tenant overlay；只抽取可复用 primitive，不抽客户资产。
5. 等第一个真实 enterprise paid customer 触发，再切 `helm-enterprise` 私有仓。
