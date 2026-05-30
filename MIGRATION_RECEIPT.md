# Helm Public Migration Receipt

Date: 2026-05-30

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
