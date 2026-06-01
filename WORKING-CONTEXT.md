# Helm Public Working Context

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
