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

## Naming Checklist

Before adding an extension path to `helm-public`, verify:

- The name is generic or synthetic.
- The fixtures are synthetic or redacted.
- The README states review-first boundaries.
- `npm run check:public-release` passes.
- The docs path is allowed by [../public-docs-manifest.json](../public-docs-manifest.json) if documentation is added.
