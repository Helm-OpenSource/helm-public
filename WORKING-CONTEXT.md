# Helm Public Working Context / Helm 公开工作上下文

> **语言 / Language**: **中文主文本** + **English reference**

`helm-public` 是 Apache-2.0 Core 仓库。

当前工作规则：

- 保持 Core 可独立构建。
- 不添加商业 Pack source、客户 Overlay code、私有部署证据、credential、客户联系人、私有 domain 或 tenant-specific runtime configuration。
- Public docs 由 [docs/public-docs-manifest.json](docs/public-docs-manifest.json) 管理。
- 开 PR 前运行 `npm run check:public-docs` 和 `npm run check:public-release`。

商业 Packs、客户 Overlays 和 deployment-control metadata 的实现属于对应私有仓库，不属于本仓。

`helm-public` is the Apache-2.0 Core repository.

Current working rules:

- Keep Core independently buildable.
- Do not add commercial Pack source, customer Overlay code, private deployment
  evidence, credentials, customer contacts, private domains, or tenant-specific
  runtime configuration.
- Public docs are curated by [docs/public-docs-manifest.json](docs/public-docs-manifest.json).
- Run `npm run check:public-docs` and `npm run check:public-release` before
  opening a PR.

Implementation for commercial Packs, customer Overlays, and deployment-control
metadata belongs in the corresponding private repositories, not here.
