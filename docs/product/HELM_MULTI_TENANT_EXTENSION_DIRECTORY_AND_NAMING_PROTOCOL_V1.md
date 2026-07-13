---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public-safe extension directory protocol. Customer-specific overlays are excluded from helm-public.
---
# Helm Extension Directory And Naming Protocol / Helm Extension 目录与命名协议

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本公开协议约束 `helm-public` 内扩展 / 样板的目录命名，确保公开仓库
可理解、可复刻，同时不暴露客户专属私有目录。

公开扩展和样板必须使用通用或合成名称，例如：

```text
extensions/<sample-or-generic-pack>/
```

它们不得使用真实客户、租户、部署、私有供应商、私有域名或生产环境
名称。客户品牌标识、客户连接器运行时配置、客户环境默认值、客户
联系人、域名、主机或部署回执都属于私有 Overlay 仓库，不属于
`helm-public`。

依赖方向固定为 `Overlay -> Pack SDK -> Core SDK`。Core 不得 import 私有 Overlay
或商业 Pack。

### Workspace 角色预设目录 / Workspace role preset catalog

Core 只公开通用的解析和呈现契约。私有 Overlay 可以把客户专属值写入
`Workspace.configuration.rolePresetCatalog`，但这些值不得提交到本仓。公开、合成示例：

```json
{
  "rolePresetCatalog": {
    "includeDefaultPresets": false,
    "presets": [
      {
        "key": "SYNTHETIC_OPERATIONS_OWNER",
        "basePresetKey": "FOUNDER_CEO",
        "label": { "zh": "合成运营负责人", "en": "Synthetic operations owner" },
        "summary": { "zh": "负责合成运营目标。", "en": "Owns synthetic operating goals." },
        "matchers": ["synthetic operations owner"]
      }
    ]
  }
}
```

边界：

- 最多读取 50 个 custom preset；key、可见文本、matcher 和列表均有长度 / 数量上限。
- `basePresetKey` 只能引用 Core 内置预设，用于复用现有角色基础，不代表授权。
- `workspaceRole`、`permissionsProfileKey`、`iaProfileKey` 当前只是元数据；不能授予角色、权限、路由或执行权。
- settings 提交的 preset key 必须在当前 workspace catalog 中重新校验；失效或伪造 key fail closed。
- catalog 不能携带代码、回调、凭据、真实客户材料或自动执行指令。

## English Reference

This public protocol keeps extension naming understandable without exposing
customer-specific private trees.

## Public Core Rule

Public extensions and samples must use generic names:

```text
extensions/<sample-or-generic-pack>/
```

They must not use a real customer, tenant, deployment, private vendor, private
domain, or production environment name.

## Private Overlay Rule

Customer-specific differences belong in private Overlay repositories. They do
not belong in `helm-public`.

Examples of private-only material:

- customer branding
- customer connector runtime configuration
- customer-specific environment defaults
- customer contacts, domains, hosts, or deployment receipts

## Dependency Direction

```text
Overlay -> Pack SDK -> Core SDK
```

Core code must not import a private Overlay or commercial Pack.

## Workspace Role Preset Catalog

Core exposes only the generic parser and presentation contract. Private
Overlays may supply customer-specific values through
`Workspace.configuration.rolePresetCatalog`; those values stay outside this
repository. Public examples must remain synthetic.

The parser accepts at most 50 custom presets and bounds keys, visible text,
matchers, and list fields. `basePresetKey` projects a custom label and mission
onto an existing Core role foundation; it grants no authority. Metadata such as
`workspaceRole`, `permissionsProfileKey`, and `iaProfileKey` does not grant a
role, permission, route, or execution right. Server actions revalidate every
submitted key against the current workspace catalog and reject stale or forged
keys.

## Naming Checklist

Before adding an extension path to `helm-public`, verify:

- The name is generic or synthetic.
- The fixtures are synthetic or redacted.
- The README states review-first boundaries.
- `npm run check:public-release` passes.
- The docs path is allowed by [../public-docs-manifest.json](../public-docs-manifest.json) if documentation is added.

## 变更记录 / Change Log

- 2026-07-13：记录 workspace role preset catalog 的 public Core 契约、资源上限、
  server-side key revalidation 和不授予角色 / 权限 / 执行权的边界。
