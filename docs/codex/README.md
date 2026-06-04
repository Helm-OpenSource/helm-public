---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-07-01
public_safety: Public agent working entry. Private orchestration and review packets are excluded from helm-public.
---
# Agent Working Entry / Agent 工作入口

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

在 `helm-public` 中，agent 应作为公开 Core 仓库的贡献者工作，而不是私有源仓拆分的执行者。
开始前默认阅读 [AGENTS.md](../../AGENTS.md)、[README.md](../../README.md)
和 [docs/README.md](../README.md)。

公开仓规则：保持 Apache-2.0 Core 可独立构建；不要加入客户名称、私有域名、
联系人、overlay、凭据、私有部署证据或商业 Pack 实现细节；不要把广泛内部
规划 / 复核归档加进 `docs/`；任何新公开文档都必须显式列入
[public-docs-manifest.json](../public-docs-manifest.json)，并在开 PR 前运行
`npm run check:public-docs` 与 `npm run check:public-release`。

私有多代理交接、复核包、发布回执和客户交付作业手册继续留在私有仓库。

## English Reference

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

## Parallel Worktree Rules

Before editing, every agent must prove which worktree it owns:

```bash
git status --short --branch
git worktree list
git rev-parse --show-toplevel
```

- Treat the shared primary checkout as an inspection / sync / audit area by
  default, not as a long-lived implementation WIP area.
- Do not implement inside another agent's dirty worktree.
- Create a separate worktree and branch from the intended base when the current
  checkout contains unrelated WIP.
- If WIP survives beyond one work turn, close it as an atomic commit / PR slice
  or move it into a dedicated isolated worktree before starting another task.
- Keep bilingualization, security hardening, capability work, and governance
  updates in separate commits / PRs.
- Stage explicit files only; do not use `git add -A` unless the worktree has
  first been proven clean except for this task.
- For cross-repository work, inspect and dispatch from this thread, but send
  implementation to the owning repository's own thread / worktree.

## Scope Boundary

This public entry replaces the private source repository's agent templates for
the public repo. Private multi-agent handoffs, review packets, release receipts,
and customer delivery runbooks stay in private repositories.
