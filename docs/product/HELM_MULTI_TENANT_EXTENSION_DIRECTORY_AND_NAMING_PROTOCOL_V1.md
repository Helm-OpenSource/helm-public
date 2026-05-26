---
status: active
owner: helm-core
created: 2026-04-16
review_after: 2026-07-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Multi-Tenant Extension Directory And Naming Protocol V1

更新时间：2026-04-16  
状态：Active

## 1. 目的

这份协议只做一件事：

- 冻结 Helm 当前 `TENANT_CUSTOM Solution Extension` 的目录、命名、identity 和 harness 规则

它的目标不是把 Helm 扩成：

- plugin platform
- extension marketplace
- app builder
- multi-tenant package registry

它要解决的是一个更窄也更关键的问题：

- 当租户客户的定制需求进入仓库时，应该如何落代码、挂运行时 identity、接 workspace enablement、同步 docs 和 guard，避免把 tenant custom、shared substrate 和 Helm core 混成一层

## 2. 当前主干前提

这份协议建立在以下 current-main truth 上：

- `Worker / Skill / Resource / Solution Extension / Commercial` 分类已冻结在 [HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md)
- `WorkspaceSolutionExtension` 已作为 workspace-level enablement seam 存在于 [prisma/schema.prisma](/Users/tommyqian/Documents/GitHub/helm2026/prisma/schema.prisma)
- shared runtime substrate 仍可保留在 `lib/`、`app/`、`features/` 等 current-main shared namespace
- tenant custom code 现在已经开始迁入 `extensions/guangpu/*`

## 3. 适用范围

这份协议适用于所有：

- `TENANT_CUSTOM Solution Extension`
- tenant-owned operator surface
- tenant-owned report assets
- tenant-owned integration glue
- tenant-owned runtime policy / scoring / prompt / template / SQL packs

它不直接适用于：

- Helm first-party reserved operating extensions
- already-shared core product modules
- reusable substrate that has already been extracted back into shared `lib/*`

## 4. 基本原则

### 4.1 租户定制不是 Helm core

只要它的主问题是：

- 某个租户的行业场景
- 某个租户的客户专属 operator surface
- 某个租户专属集成、报表或评分逻辑

默认就是 `TENANT_CUSTOM Solution Extension`，不是 Helm core product。

### 4.2 shared substrate 与 tenant-owned asset 分开

继续留在 core 的只能是：

- shared auth / session / workspace boundary
- shared audit / event / LLM observability
- shared runtime adapters / validators / workflow helpers
- shared UI shell / route owner / capability guards

继续留在 tenant extension 的应该是：

- tenant-owned docs / assets / templates / SQL / metrics / prompts
- tenant-owned route surface
- tenant-owned integration glue
- tenant-owned runtime rules / scoring / policy

### 4.3 不允许继续把 tenant custom 直接写进 shared top-level namespace

后续新增租户定制需求时，默认不得直接新增：

- `features/<tenant-feature>/`
- `lib/<tenant-feature>/`
- `app/api/<tenant-feature>/`

除非该模块已经明确升级为 shared substrate 或 reusable extension。

## 5. 命名规范

### 5.1 tenantKey

含义：

- 稳定租户代码

规则：

- 小写 kebab-case
- 不用展示名
- 不带环境后缀

示例：

- `guangpu`
- `acme-cn`
- `midun-demo`

### 5.2 extensionSlug

含义：

- 某类扩展的稳定类型名

规则：

- 小写 kebab-case

示例：

- `seat-profile`
- `bi-report`
- `case-routing`

### 5.3 extensionKey

含义：

- 全局唯一 extension runtime identity

规则：

- `extensionKey = <tenantKey>-<extensionSlug>`

示例：

- `guangpu-seat-profile`
- `guangpu-bi-report`

显式禁止：

- bare key，如 `seat-profile`
- display name 进入 key
- 通过 `extensionKey` 字符串 heuristic 反推目录结构

## 6. 目录规范

标准结构：

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

职责边界：

- `extensions/<tenant-key>/`
  - 租户级容器
  - 只放租户总览、租户清单、跨扩展说明
- `extensions/<tenant-key>/<extension-slug>/`
  - 单扩展根目录
  - 放该扩展自己的实现、文档、测试和资产

显式禁止：

- 在租户根目录堆放单扩展 migration plan、SRS、详细设计、operator checklist
- 把不同扩展的文档混在同一个租户根目录里

## 7. 路由与代码落点

### 7.1 API

统一放在：

- `app/api/extensions/<tenant-key>/<extension-slug>/...`

### 7.2 页面与 surface

扩展实现放在：

- `extensions/<tenant-key>/<extension-slug>/features/...`

shared shell 如需挂载该扩展，应通过 workspace enablement 显式判断，而不是直接把实现写回 shared `features/*`。

### 7.3 runtime / repository / integration

扩展自有逻辑放在：

- `extensions/<tenant-key>/<extension-slug>/lib/runtime`
- `extensions/<tenant-key>/<extension-slug>/lib/repository`
- `extensions/<tenant-key>/<extension-slug>/lib/integrations`

## 8. Runtime Identity 与 Enablement

### 8.1 source of truth

workspace 是否启用某个 extension，真值来自：

- `WorkspaceSolutionExtension`

### 8.2 manifest 最小字段

每个 extension 至少应包含：

```json
{
  "extensionKey": "guangpu-seat-profile",
  "tenantKey": "guangpu",
  "extensionSlug": "seat-profile",
  "kind": "TENANT_CUSTOM",
  "displayName": "Guangpu Seat Profile",
  "status": "ACTIVE",
  "owner": "guangpu",
  "nonCoreDeclaration": true
}
```

如果该 extension 进入 tenant-resource governance Phase 4，还应在 `extension.manifest.json` 中额外声明 `resourceDependencyDeclarations`，显式说明：

- 依赖资源的稳定 key
- provider
- declared capability modes
- object bindings
- review-first policy hints

这组声明只用于租户资源纳管 read model，不代表 provider-side execution authority。

### 8.3 loader / resolver 规则

后续 loader / resolver 必须：

- 通过显式 `tenantKey + extensionSlug` 或 manifest lookup 解析目录

后续 loader / resolver 不得：

- 通过 `extensionKey` 的字符串规则推导租户目录

## 9. 文档与 Harness 规则

只要任务涉及 `extensions/*`、`WorkspaceSolutionExtension`、`app/api/extensions/*` 或 tenant custom asset migration，默认同步：

- `AGENTS.md`
- `README.md`
- `docs/README.md`
- 本协议
- 对应 extension `README.md` / `docs/*`
- `scripts/helm-self-check-refactored.ts`
- `scripts/decision-first-boundary-check.ts`

如果只是生成报告、不更新索引或 guard，默认不算完成。

## 10. 当前 Guangpu 作为参考实现

当前 `guangpu` 目录可以继续保留，但应被理解为：

- 租户根目录，不是功能根目录

参考结构：

```text
extensions/
  guangpu/
    README.md
    seat-profile/
      extension.manifest.json
      README.md
      docs/
      features/
      lib/
      tests/
    bi-report/
      extension.manifest.json
      README.md
      report-skills/
```

## 11. 刻意未做

- full extension marketplace
- online extension registry UI
- plugin sandbox
- dynamic extension installation plane
- automatic tenant extension scaffolding

## 12. 风险项

1. 如果 `extensionKey` 不统一，workspace enablement、audit 和 backfill 会继续漂移
2. 如果 tenant root 和 extension root 继续混写，文档和责任边界会越来越乱
3. 如果 shared loader 继续靠 heuristic 推目录，多租户扩展数量一上来就会失稳
4. 如果 tenant custom 继续写回 shared top-level namespace，Helm core object model 会继续被污染
