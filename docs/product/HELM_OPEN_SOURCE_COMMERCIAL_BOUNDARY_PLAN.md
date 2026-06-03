---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public boundary statement. Does not disclose private Pack, Overlay, or customer deployment details.
---
# Helm Open Source And Commercial Boundary / Helm 开源与商业边界

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

Helm Core 采用 Apache-2.0。`helm-public` 的目标是让交付工程师可以独立
fork、运行和审查一个 review-first 的业务运营参考实现，而不是承载商业私有
交付、客户 overlay 或客户部署证据。

商业产品不会替代开源 Core。商业侧只在需要私有合同、托管运营、认证 Pack、
企业治理或客户专属交付时增加能力。公开仓库必须保持 public-safe，并且不能把
商业 Pack、客户 Overlay 或控制面元数据反向带入 Core。

依赖方向固定为：

```text
Overlay -> Pack SDK -> Core SDK
```

Core 可以定义稳定 SDK seam；Pack 和 Overlay 可以依赖 Core；Core 不能 import
商业 Pack、客户 Overlay、客户路径或商业私有逻辑。

官方 / Certified 字样必须经过 maintainer review。Certification 不是 marketplace、
payout rail、SLA、客户 outcome guarantee 或 trademark license。

## English Reference

Helm Core is Apache-2.0. The public repository is intended to be useful on its
own for delivery engineers who want a forkable, review-first business operations
reference implementation.

Commercial offerings do not replace the open source Core. They add operated
services, certified Packs, enterprise governance, and customer-specific delivery
where a private contract is needed.

## Public Core

`helm-public` contains:

- Core app/runtime surfaces
- Base SDK and extension seams
- Public sample Pack material
- Public docs and tests
- Docker quickstart and local development assets

It must not contain:

- Customer overlays
- Private customer names, domains, contacts, or deployment evidence
- Commercial Pack implementation details
- Private control-plane registry or entitlement state
- Credentials, secrets, or production infrastructure details

## Commercial / Private Repositories

Commercial industry Packs, customer overlays, and deployment-control metadata
belong outside `helm-public`.

The dependency direction is:

```text
Overlay -> Pack SDK -> Core SDK
```

Core must not import or depend on commercial Packs or customer Overlays.

## Certification And Brand

Official / Certified wording requires maintainer review. Certification is not a
marketplace, payout rail, SLA, customer-outcome guarantee, or trademark license.
The first public checklist is [HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md](HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md).

## Current Non-Goals

- Runtime marketplace
- Third-party plugin sandbox
- Automatic external send / approval / settlement
- Complete enterprise multi-org platform
- Customer-specific private delivery inside the public repository
