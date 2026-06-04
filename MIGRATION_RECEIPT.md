# Helm Public Migration Receipt / Helm 公开迁移回执

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本回执是 2026-05-30 `helm-public` sanitized public mirror staging output 的历史记录。
当前仓库定位已经是 `Helm-OpenSource/helm-public` open-source Core，而不是 mirror
staging repository。

它记录了从 `Helm-Developers/helm2026` 生成 public-safe snapshot、复制到目标仓、
运行 target verification、确认 history / leak verification、以及后续 candidate check 的
过程。该回执对交付工程师的意义是：说明 public Core 是一个经过过滤和验证的可 fork
仓库，不包含 private Pack / Overlay source、tenant-private source、pending
implementation-console source 或 control-plane metadata。

本文件不是当前 release approval，不替代最新 `docs/STATUS.md`，也不授权把 private
history、customer data、credential、deployment receipt 或 commercial-private logic 带入
`helm-public`。

## English Reference

Date: 2026-05-30

> Historical migration receipt only. Current repository positioning is `Helm-OpenSource/helm-public` open-source Core, not a mirror staging repository.

This repository snapshot is the Step 4B sanitized public mirror staging output
for the Helm repo split.

## Source

- Source repo: `Helm-Developers/helm2026`
- Source branch: `claude/helm-public-core-relationship-Cr6OV`
- Source commit: `89d23c604d3d6e886b717eb68ff4c327dc8e2675`
- Target repo: `Helm-OpenSource/helm-public`
- Target branch: `codex/repo-split-public-mirror-20260530`

## Generation

```bash
npm run public-mirror:build -- --mirror-root /tmp/helm-public-mirror-ci-projection-clean --force-clean
```

Observed source-side result:

- exit 0
- verify=0
- copied 3339 files
- skipped 63 entries (`private-root=7`, `local-artifact-dir=4`,
  `local-artifact-file=1`, `private-file=51`)
- scanned 3338 files during public mirror verification

The mirror was copied into this target repository with `.git` protected, so the
target repository history and remote configuration were not replaced.

## Target Verification

Verified inside `Helm-OpenSource/helm-public` target working tree after sync:

```bash
npm ci
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint:strict
npm run build
npm run db:prepare
npm run test
npm run quality:regression
npm run e2e
rg -ni "<tenant/customer denylist pattern>" . --glob '!node_modules/**' --glob '!.git/**' --glob '!.next/**'
find . -path './.git' -prune -o -name .git -print
```

Observed target-side result:

- `npm ci`: exit 0; `npm audit` reports 4 known dependency findings
  (3 moderate, 1 high)
- `npm run typecheck`: exit 0
- `npm run self-check`: exit 0; public mirror smoke scanned 1333 files
- `npm run check:boundaries`: exit 0; public mirror smoke scanned 1333 files
- `npm run lint:strict`: exit 0
- `npm run build`: exit 0; Next generated 106 static pages
- `npm run db:prepare`: exit 0; public mirror no-op
- `npm run test`: exit 0; public mirror smoke scanned 1333 files
- `npm run quality:regression`: exit 0; public mirror smoke scanned 1333 files
- `npm run e2e`: exit 0; public mirror smoke scanned 1333 files
- tenant/customer literal search: exit 1, no matches
- nested `.git` search: exit 0, no matches

## History and Leak Verification

This bootstrap branch descends from the existing public `origin/main`; it does
not preserve private source repository history. The only commits currently on
top of public `origin/main` are the staged mirror commits for this PR.

Additional checks:

```bash
git merge-base --is-ancestor origin/main HEAD
git log --oneline origin/main..HEAD
HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history
npm run check:public-release
node --import tsx scripts/check-public-mirror-tree.ts --mirror-root .
```

Observed result:

- public branch ancestry: exit 0; branch descends from public `origin/main`
- `origin/main..HEAD`: contains only public mirror staging/fix commits
- `check:secret-history`: exit 0; no known compromised commits reachable across
  the checked refs
- `check:public-release`: exit 0; scanned 3339 public files
- `check-public-mirror-tree`: exit 0; scanned 3339 public files

## Scope

This is a Core/public staging branch. It intentionally excludes tenant-private
source, private Pack/Overlay source, pending implementation-console source, and
control-plane metadata.

The public mirror uses a public CI projection: public `typecheck` points at
`tsconfig.public.json`; public `self-check`, `check:boundaries`, `test`,
`quality:regression`, and `e2e` run the tenant-free public mirror smoke guard;
public `db:prepare` is a no-op because the mirror does not ship the private DB
test harness. The private source repository retains the full internal gate
chain.

History preservation into this public repository is deferred for this bootstrap
cut. The private source repository remains the audit/history source until a
dedicated history rewrite or filter-repo migration is approved.

## Follow-up Candidate Check — 2026-05-31

After the bootstrap mirror landed, `helm2026` advanced to
`origin/main@335e4d059386ff5f2116f12ed16485a0df9466e9` via PR #225
(`codex/site-ux-convergence-20260529`). The changed public-safe UI files from
that PR were already present in `helm-public@8f7c19b5ba722ffd986add980fb8eccf0b1479c0`.

A fresh candidate was generated from the repo-split source ref
`origin/claude/helm-public-core-relationship-Cr6OV@ea2cb6ae290ffabe35f30dd4fed078c2f641e75d`
using the source ref's current public mirror builder:

```bash
node --import tsx /tmp/helm2026-public-core-Af6PQg/scripts/build-public-mirror-tree.ts \
  --source-root /tmp/helm2026-public-core-Af6PQg \
  --mirror-root /tmp/helm-public-candidate-core2-e5KyAM \
  --force-clean
```

Observed candidate result:

- exit 0
- verify=0
- copied 3321 files
- skipped 53 entries (`private-root=7`, `local-artifact-dir=1`,
  `local-artifact-file=1`, `private-file=44`)
- scanned 3320 files during public mirror verification

The only content delta selected for the public target was
`scripts/public-release-guard.ts`: repo-split planning document filenames were
removed from the guard source comment/list because those docs now live under an
internal-only documentation root that is already excluded by the public mirror
policy. The target-local `MIGRATION_RECEIPT.md` is intentionally retained.
Local generated artifacts and Husky helper files observed in the working tree
are not part of the selected public sync.
