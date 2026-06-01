---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public-safe extension directory protocol. Customer-specific overlays are excluded from helm-public.
---
# Helm Extension Directory And Naming Protocol

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
