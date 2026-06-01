---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public agent working entry. Private orchestration and review packets are excluded from helm-public.
---
# Agent Working Entry

For `helm-public`, agents should work as contributors to the public Core
repository, not as operators of the private source split.

## Required Reading

1. [AGENTS.md](../../AGENTS.md)
2. [README.md](../../README.md)
3. [docs/README.md](../README.md)

## Public Repository Rules

- Keep the Apache-2.0 Core independently buildable.
- Do not add customer-specific names, domains, contacts, overlays, credentials,
  private deployment evidence, or commercial Pack implementation details.
- Do not add broad internal planning or review archives to `docs/`.
- Any new public doc must be added intentionally to
  [public-docs-manifest.json](../public-docs-manifest.json).
- Run `npm run check:public-docs` and `npm run check:public-release` before
  opening a PR.

## Scope Boundary

This public entry replaces the private source repository's agent templates for
the public repo. Private multi-agent handoffs, review packets, release receipts,
and customer delivery runbooks stay in private repositories.
