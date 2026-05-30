# Helm Public Migration Receipt

Date: 2026-05-30

This repository snapshot is the Step 4B sanitized public mirror staging output
for the Helm repo split.

## Source

- Source repo: `Helm-Developers/helm2026`
- Source branch: `claude/helm-public-core-relationship-Cr6OV`
- Source commit: `349e4d2565c3feffaa98c4ece7341399ef9b8fb5`
- Code validation baseline: `6cdcbf806`
- Target branch: `codex/repo-split-public-mirror-20260530`

## Generation

```bash
npm run public-mirror:build -- --mirror-root /tmp/helm-public-mirror-4b-sanitized --force-clean
```

Observed result:

- exit 0
- verify=0
- copied 3338 files
- skipped 63 entries, including one `local-artifact-file`
- `.git` was absent from the generated mirror
- a case-insensitive literal tenant/customer-name grep over the generated
  mirror returned no matches

The mirror was copied into this target repository with `.git` protected, so the
target repository history and remote configuration were not replaced.

## Scope

This is a Core/public staging branch. It intentionally excludes tenant-private
source, private Pack/Overlay source, pending implementation-console source, and
control-plane metadata.

History preservation into this public repository is deferred for this bootstrap
cut. The private source repository remains the audit/history source until a
dedicated history rewrite or filter-repo migration is approved.
