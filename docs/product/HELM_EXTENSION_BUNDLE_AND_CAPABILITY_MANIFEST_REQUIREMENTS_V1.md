---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Extension Bundle And Capability Manifest Requirements V1

更新时间：2026-04-22  
状态：Requirements Freeze

## 1. 目的

这份需求只做一件事：

- 把 Helm 下一阶段最优先的 harness 基础设施升级之一，正式冻结成 `Extension Bundle + Capability Manifest` 需求基线

它要解决的问题不是：

- marketplace
- app builder
- plugin ecosystem
- full orchestration platform
- broad auto-execution plane

它只解决一个更窄但更关键的问题：

- 当 Helm 的 `Solution Extension / Worker / Skill / Resource / Hook / Monitor / Connector requirement` 继续增长时，如何把这些声明收成一个统一、可治理、可审计、可验证的 runtime bundle，而不是继续散落在不同协议、目录和局部守卫里

## 2. 当前主干前提

这份需求建立在以下 current-main truth 上：

- Helm 仍是 `workspace-first`、`membership-backed`、`judgement-first`、`review-first`
- Helm 当前仍不是完整 workflow / orchestration 平台
- `plugin runtime` 仍没有真正 sandbox
- 当前已有 [HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md](./HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)
- 当前已有 [HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md](./HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md)
- 当前已有 [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](./HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
- 当前已有多租户 capability / ownership 基线：[HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md](./HELM_MULTITENANCY_CAPABILITY_AND_TENANT_OWNERSHIP_GOVERNANCE_BASELINE_V1.md)

## 3. 目标

本轮需求基线的目标有 5 项：

1. 把 extension 运行时单位收成统一 `bundle` 概念
2. 把 capability declarations 收成统一 `manifest` 概念
3. 让 `worker / skill / resource / hook / monitor / connector dependency` 都能挂到同一份 manifest 上
4. 让 loader / validator / self-check / boundary-check 有同一份声明真值
5. 让后续 capability engine、monitor substrate、swarm isolation 都能建立在这条基础线上

## 4. 非目标

本轮明确不做：

- 完整 plugin platform
- extension publishing workflow
- extension marketplace
- runtime sandbox
- execution authority 扩面
- 自动 customer-visible send
- 自动 contract / proposal / settlement side effect
- 把所有 shared core module 都改造成 bundle

## 5. 适用范围

这份需求适用于：

- `TENANT_CUSTOM Solution Extension`
- Helm reserved first-party operating extension
- 未来需要显式 runtime identity 的 extension-style domain pack

这份需求暂不直接适用于：

- 纯 shared core product module
- 纯文档资产目录
- 不带 runtime identity 的一次性实现稿

## 6. 核心原则

### 6.1 统一 bundle，不增加第二套对象宇宙

`bundle` 是 runtime packaging 单元，不是新的产品对象层。

它不取代：

- `Solution Extension`
- `Worker`
- `Skill`
- `Resource`

它只负责把这些声明收进一个统一 runtime unit。

### 6.2 显式声明优先于目录猜测

后续 loader / validator / runtime resolver 必须优先基于 manifest 显式声明，而不是继续依赖：

- 文件名 heuristic
- 目录推断
- route owner 约定
- 手工 hardcode registry

### 6.3 bundle presence 不等于 authority grant

只要某个 extension 被装载，不代表它天然拥有：

- 执行权限
- 对外权限
- customer-facing send 权限
- write authority

authority 仍由 Helm control plane 和 capability resolution engine 决定。

### 6.4 manifest 必须服务验证链

manifest 不是为了“写得好看”，而必须被以下链路真正消费：

- loader
- resolver
- self-check
- boundary-check
- docs/index drift detection
- future runtime capability trace

### 6.5 fail closed

对于声明不完整、版本不兼容、字段非法、能力越界的 bundle，默认：

- 不装载
- 不放行
- 记审计
- 明确报错

## 7. 标准结构

第一版继续沿用当前目录协议：

```text
extensions/
  <tenant-key>/
    README.md
    tenant.manifest.json
    <extension-slug>/
      extension.manifest.json
      README.md
      docs/
      assets/
      features/
      lib/
      tests/
      report-skills/
```

本轮不再新造并行目录层级。  
第一版的要求是：

- 继续使用 `extension.manifest.json` 作为单扩展 bundle truth
- 在该 manifest 中扩展 capability declarations，而不是再并行引入第三份 runtime identity 文件

## 8. Bundle Manifest 最小需求

### 8.1 Identity 字段

第一版必须保留并继续使用：

- `extensionKey`
- `tenantKey`
- `extensionSlug`
- `kind`
- `displayName`
- `status`
- `owner`
- `nonCoreDeclaration`

### 8.2 Version / Compatibility 字段

第一版新增并要求：

- `manifestVersion`
- `bundleVersion`
- `compatibility`
- `migrationHints`

要求：

- `manifestVersion` 用来版本化 manifest schema
- `bundleVersion` 用来版本化扩展本身
- `compatibility` 至少声明兼容的 Helm runtime posture 或 minimum contract version
- `migrationHints` 用来提示后续 manifest schema 或 bundle 迁移

### 8.3 Runtime Declaration 字段

第一版新增并要求：

- `workerDeclarations`
- `skillDeclarations`
- `resourceDeclarations`
- `hookDeclarations`
- `monitorDeclarations`
- `surfaceDeclarations`

用途：

- `workerDeclarations`：列出本 bundle 声明或扩展的 worker identity
- `skillDeclarations`：列出 skill identity 与场景范围
- `resourceDeclarations`：列出资源绑定与 provider 依赖
- `hookDeclarations`：列出该 bundle 需要注入的 runtime hook
- `monitorDeclarations`：列出持续观察与事件产出点
- `surfaceDeclarations`：列出页面、route、operator surface 的入口声明

### 8.4 Capability Declaration 字段

第一版新增并要求：

- `capabilityDeclarations`
- `maxEffectMode`
- `customerFacingAllowed`
- `requiresReviewByDefault`
- `nonCommitmentOnly`

用途：

- 让 bundle 显式声明它声称需要哪些 capability
- 让 capability engine 能知道这条 bundle 的 effect 上限
- 保持 `recommendation != commitment`

### 8.5 Dependency Declaration 字段

第一版新增并要求：

- `connectorDependencies`
- `workspaceDependencies`
- `policyDependencies`
- `documentationPointers`
- `evalContract`

用途：

- 明确需要哪些 connector / workspace truth / policy truth
- 明确文档与验证入口，避免后续 drift

## 9. Loader / Resolver 规则

### 9.1 Loader 真值

Loader 必须：

- 通过 `tenantKey + extensionSlug` 或 manifest lookup 装载 bundle
- 通过 `extension.manifest.json` 读取 runtime declaration
- 对 version / compatibility 做显式校验

Loader 不得：

- 通过 `extensionKey` 字符串 heuristic 反推目录
- 在没有 manifest 的情况下静默 fallback
- 对未知字段或不兼容版本自动容错放行

### 9.2 Resolver 真值

Resolver 必须：

- 明确返回 bundle identity
- 明确返回声明的 worker / skill / resource / hook / monitor
- 明确返回 capability requirements
- 明确返回 compatibility 与 failure reason

### 9.3 Disabled / Invalid Bundle Posture

以下情况默认 fail closed：

- `status != ACTIVE`
- manifest 不合法
- capability declaration 超出硬边界
- compatibility 不满足
- 缺少必要 docs / eval pointers

## 10. 验证与守卫要求

只要 bundle contract 上线，默认同步接入：

- `README.md`
- `docs/README.md`
- 本协议
- [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](./HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
- 对应 extension `README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`

第一版验证至少包含：

1. manifest schema validation
2. identity / directory alignment check
3. undeclared capability detection
4. forbidden `customer_visible_send` or equivalent broad side effect declaration detection
5. docs/index drift detection

## 11. 迁移策略

第一版迁移必须最小化：

### Phase 0

- 文档冻结
- 不改 loader 行为
- 不改 runtime authority

### Phase 1

- 补一条 reserved first-party sample bundle
- 补一条 tenant custom sample bundle
- 先跑 read-only manifest validation

### Phase 2

- 再让 loader / resolver 消费 manifest
- 再把 self-check / boundary-check 接入

### Phase 3

- 再把 capability engine、monitor substrate、operator trace 接到 bundle truth

## 12. 风险

1. 如果 bundle 过度设计，会把 Helm 拉向 plugin platform 叙事
2. 如果 manifest 与现有 extension 目录协议不同步，会产生双真值
3. 如果把 authority 混进 bundle，本来由 control plane 管的边界会变乱
4. 如果过早把所有 shared module 也 bundle 化，会扩大改动面

## 13. 完成定义

满足以下条件，才算这条需求基线成立：

1. `bundle` 与 `capability manifest` 的对象边界明确
2. 与现有 extension / worker / skill / resource 协议不冲突
3. loader / resolver / validation / docs drift 的消费方已经定义清楚
4. rollout 顺序明确，且不把 Helm 写成 marketplace 或 broad auto-execution plane
