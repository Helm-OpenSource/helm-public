---
status: active
owner: helm-core / security
created: 2026-04-30
review_after: 2026-05-07
archive_trigger:
  - RDS credential rotation is confirmed and old credential is invalid
  - Public history rewrite is completed and pushed
  - `npm run check:secret-history` passes on origin/main and the public mirror candidate
---

# Helm RDS Secret History Remediation Plan

## 1. Conclusion

`origin/main` history still contains three known compromised commits for the historical RDS root credential. The current working tree no longer contains the raw value, and `npm run check:public-release` can pass, but that is not sufficient for a public release because public Git history remains scannable.

This is a P0 release blocker until both conditions are true:

1. The exposed RDS credential is rotated or revoked outside git.
2. Public history is rewritten and force-pushed in a coordinated maintenance window.

The raw secret must not be written into this repository again. This plan records only commit IDs and the SHA-256 fingerprint already used by `scripts/public-release-guard.ts`.

## 2. Current Evidence

Known compromised commits reachable from `origin/main` before remediation:

| Commit | Ref evidence | Secret material recorded here |
| --- | --- | --- |
| `d0dc341178a12a1f89698eced116ce6d168debc7` | `git log origin/main -S <redacted>` | SHA-256 fingerprint only |
| `7d2899355dca9b3cd100e66305706e1b7859de3b` | `git log origin/main -S <redacted>` | SHA-256 fingerprint only |
| `f7876c7dce7405c0cb91365e0fe94b80421b83c1` | `git log origin/main -S <redacted>` | SHA-256 fingerprint only |

Fingerprint:

```text
sha256:1f2690821816efa16646ccb339b92178107ac6a29d98938379002868c86736e6
```

Current working tree scan:

```bash
rg -n "<redacted secret>" . -g '!node_modules' -g '!.next' -g '!coverage' -g '!test-results' -g '!playwright-report'
# no output
```

## 3. What Was Completed Locally

Local tooling reality on 2026-04-30:

| Check | Result |
| --- | --- |
| `aliyun` CLI | Not installed in this environment |
| Aliyun / RDS env vars | Not present in this environment |
| `git-filter-repo` | Installed only inside `/tmp/helm-rds-secret-remediation-20260430/venv` for dry-run |
| `gitleaks` / `trufflehog` | Not installed in this environment |

Local mirror dry-run:

```bash
WORK=/tmp/helm-rds-secret-remediation-20260430
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/python" -m pip install git-filter-repo
cd "$WORK"
git clone --mirror https://github.com/Helm-OpenSource/helm-public.git helm-public.git
cd helm2026.git
"$WORK/venv/bin/git-filter-repo" --force --replace-text <replacement-spec>
```

Dry-run result:

| Evidence | Result |
| --- | --- |
| Before rewrite, `origin/main` historical hits | 3 |
| Before rewrite, all-ref historical hits | 3 |
| After rewrite, all-ref historical hits | 0 |
| After rewrite, tree-ref raw secret hits | 0 |
| After rewrite, object database raw secret hits | 0 |
| Rewritten mirror `main` head | `a60eb169` |
| Current `origin/main` head before rewrite | `8922c0de1` |

This proves the history rewrite is mechanically feasible. It does not prove the credential is safe; only the cloud-side rotation/revocation can do that.

## 4. Required Sequence

### Step 1 - Cloud Credential Rotation

Owner-only operation:

1. Rotate or revoke the exposed RDS root credential in Aliyun RDS.
2. Prefer creating a new least-privilege application account instead of continuing to use root.
3. Update all internal secret stores and deployment environments.
4. Confirm the old credential can no longer connect.
5. Record only a non-secret rotation receipt in this repository.

No git history rewrite should be treated as sufficient until this step is complete.

### Step 2 - Maintenance Window

Before force-push:

1. Stop merges to `main`.
2. Notify all collaborators that public history will be rewritten.
3. Ask collaborators to push or back up unmerged local work.
4. Export a branch/ref inventory from `git ls-remote --heads origin`.
5. Decide whether to rewrite all public refs or only `main` and release refs.

### Step 3 - Mirror Rewrite

Use a fresh mirror clone. Do not run rewrite from a normal working tree.

```bash
WORK=/tmp/helm-rds-secret-remediation-$(date +%Y%m%d%H%M%S)
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/python" -m pip install git-filter-repo
cd "$WORK"
git clone --mirror https://github.com/Helm-OpenSource/helm-public.git helm-public.git
cd helm2026.git
"$WORK/venv/bin/git-filter-repo" --force --replace-text <private replacement spec>
```

The replacement spec must not be committed. It should map the raw secret to a neutral redaction marker.

### Step 4 - Verification Before Push

Run from the rewritten mirror:

```bash
git log --all --oneline -S'<raw secret>' -- . ':!node_modules' ':!.next'
git rev-list --objects --all | cut -d' ' -f1 | git cat-file --batch | LC_ALL=C rg -a '<raw secret>'
HELM_SECRET_HISTORY_REPO="$WORK/helm2026.git" npm run check:secret-history
```

Expected:

- no `git log -S` output
- no object database raw secret output
- `check:secret-history` passes

### Step 5 - Coordinated Push

Only after Step 1 and Step 4 pass:

```bash
git remote add origin https://github.com/Helm-OpenSource/helm-public.git
git push --force --mirror origin
```

If the team decides to rewrite only selected refs, replace `--mirror` with explicit `+local:remote` refspecs. A full mirror push is simpler but affects every public branch.

### Step 6 - Collaborator Recovery

After force-push, each collaborator should use one of:

```bash
git fetch --all --prune
git switch main
git reset --hard origin/main
```

For local work in progress:

```bash
git branch backup/my-work-before-history-rewrite
git fetch --all --prune
git rebase --onto origin/main <old-base> backup/my-work-before-history-rewrite
```

Do not merge old contaminated history back into the rewritten main.

## 5. Go / No-Go

Go:

- RDS rotation/revocation receipt is recorded without secrets.
- Rewritten mirror passes raw secret history scan and `check:secret-history`.
- Maintenance window is announced.
- Owner explicitly accepts collaborator disruption from force-push.

No-Go:

- Old credential is not proven invalid.
- Any current deployment still depends on the old credential.
- Rewritten mirror still has object database hits.
- Collaborators are actively merging into `main`.

## 6. Validation Status

Current status on 2026-04-30:

| Validation | Status |
| --- | --- |
| Current file tree raw secret scan | PASS |
| Current `origin/main` history reachability | FAIL |
| Local mirror rewrite feasibility | PASS |
| Cloud credential rotation | BLOCKED - no Aliyun CLI / env in this environment |
| Force-push | NOT RUN - requires rotation receipt and maintenance window |

## 6.1 CI Baseline Handling

Pull request CI may set `HELM_SECRET_HISTORY_BASELINE_REF=origin/<base>` so `check:secret-history` fails only when a PR introduces a known compromised commit beyond the base branch. Baseline-known findings are still reported and do not count as release remediation.

Push / release sources must run without `HELM_SECRET_HISTORY_BASELINE_REF`; those runs remain hard-fail until public history is rewritten or a clean public mirror receipt is accepted.

## 6.2 2026-05-18 GTM / Case Sample Branch Evidence

Branch-local evidence for `codex/gtm-positioning-review-fixes-20260518`:

| Validation | Result |
| --- | --- |
| `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history` | PASS — no new known compromised commits beyond `origin/main`; 123 baseline-known findings suppressed |
| staged-index clean public mirror candidate (`HELM_SECRET_HISTORY_REPO=<clean-mirror> npm run check:secret-history`) | PASS — no known compromised commits reachable in 2 refs |
| `npm run public-mirror:clean-receipt -- --receipt-id public-mirror-2026-05-18-gtm-case-sample-af08f142b --source-ref codex/gtm-positioning-review-fixes-20260518@af08f142b --source-root <HEAD-archive> --mirror-root <candidate> --force-clean` | PASS — wrote `mirror-clean:public-mirror-2026-05-18-gtm-case-sample-af08f142b`; verifier scanned 3176 files |
| `npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:public-mirror-2026-05-18-gtm-case-sample-af08f142b` | PASS |
| Public mirror candidate initialized as a clean Git repo, then `HELM_SECRET_HISTORY_REPO=<candidate> npm run check:secret-history` | PASS — no known compromised commits reachable in 2 refs |
| `npm run public-mirror:clean-receipt -- --receipt-id public-mirror-2026-05-18-current-head-8a5a96e59 --source-ref codex/gtm-positioning-review-fixes-20260518@8a5a96e59 --source-root <HEAD-archive> --mirror-root <candidate> --force-clean` | PASS — wrote `mirror-clean:public-mirror-2026-05-18-current-head-8a5a96e59`; verifier scanned 3204 files |
| `npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:public-mirror-2026-05-18-current-head-8a5a96e59` | PASS |
| Current-head public mirror candidate, then `HELM_SECRET_HISTORY_REPO=<candidate> npm run check:secret-history` | PASS — no known compromised commits reachable in 1 ref |

This evidence closes the branch-level no-new-exposure risk for the GTM / case-management-sample changes and provides a machine-checkable public mirror release path. The latest current-head receipt is `mirror-clean:public-mirror-2026-05-18-current-head-8a5a96e59`; `mirror-clean:public-mirror-2026-05-18-gtm-case-sample-af08f142b` remains historical evidence for the earlier minimum-reference source. This does **not** rewrite `origin/main` history; if the release source is `origin/main` rather than the clean mirror, the owner still needs coordinated public history rewrite after credential rotation.

## 6.3 2026-05-20 Current Branch Verification Update

Current branch: `codex/operating-signal-flow-automode`

| Validation | Result |
| --- | --- |
| `npm run check:public-release` | PASS — scanned `3797` files; no public-mirror blockers |
| `npm run test -- lib/public-release-guard.test.ts` | PASS — `30/30` tests passed |
| `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history` | PASS — no new known compromised commits beyond `origin/main`; `87` baseline-known findings suppressed |
| `npm run check:secret-history` | FAIL — `87` known compromised commit reachability findings remain reachable from current refs |

Additional note:

1. After merging the latest `origin/main`, public-release guard temporarily failed because newly introduced public files referenced internal private documentation paths.
2. The repo-side fix was completed by removing hard-coded private documentation path references from shared `lib/llm/*` comments and by classifying the internal-only maintenance scripts (`scripts/docs-reference-scan.ts`, `scripts/docs-lifecycle-classify-orphans.ts`, `scripts/release-maintenance-runbook.ts`) as `PRIVATE_FILES` for public-mirror purposes.
3. This update restores the repo to a public-release-guard-clean state, but it does **not** satisfy cloud credential rotation or public history rewrite.
4. As of `2026-05-20`, no Aliyun credential rotation receipt is recorded in this repository, so release status remains `No-Go` for rewrite / force-push execution.

## 6.4 2026-05-22 Rewrite Prep Update

Current branch: `codex/operating-signal-flow-automode`

| Validation | Result |
| --- | --- |
| `aliyun` CLI | NOT AVAILABLE in this environment |
| Aliyun / RDS env vars | NOT PRESENT in this environment |
| `origin` remote ref snapshot | READY — `170` refs total, `128` codex refs, `30` feature refs, `5` chore/security refs |
| collaborator freeze / recovery notice template | READY |
| `npm run check:public-release` | PASS — scanned `3824` files; no public-mirror blockers |
| `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history` | PASS — no new known compromised commits beyond `origin/main`; `108` baseline-known findings suppressed |
| `npm run check:secret-history` | FAIL — `108` known compromised commit reachability findings remain reachable from current refs |

Prep artifacts created on `2026-05-22`:

1. rewrite ref inventory（internal-only prep artifact；不随 OSS 仓库分发）
2. freeze / recovery notice template（internal-only prep artifact；不随 OSS 仓库分发）

Current conclusion:

1. Repo-side rewrite prep artifacts and public GitHub surface review are now both ready.
2. This does not change the blocker state: cloud credential rotation evidence is still absent.
3. As of `2026-05-22`, push / release status remains `No-Go` until rotation receipt, rewrite, and post-rewrite validation all exist.

## 6.5 2026-05-26 Public Surface Review Follow-up

Current branch: `codex/operating-signal-flow-automode`

| Validation | Result |
| --- | --- |
| public GitHub surface review doc | READY — [HELM_PUBLIC_GITHUB_SURFACE_REVIEW_2026_05_26.md](HELM_PUBLIC_GITHUB_SURFACE_REVIEW_2026_05_26.md) |
| README / runbook / launch draft placeholder cleanup | DONE — public GitHub URLs aligned to `Helm-OpenSource/helm-public` |
| public doc dead-link cleanup | DONE — `CONTRIBUTING.md` no longer points to internal-only docs |
| `npm run check:public-release` | PASS — scanned `3823` files; no public-mirror blockers |
| `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history` | PASS — no new known compromised commits beyond `origin/main`; `108` baseline-known findings suppressed |
| `npm run check:secret-history` | FAIL — `108` known compromised commit reachability findings remain reachable from current refs |

Important boundary:

1. The `2026-05-26` public surface review improves public-release readiness only at the documentation / wording layer.
2. It does **not** replace cloud credential invalidation evidence.
3. It does **not** replace formal history rewrite or post-rewrite validation.
4. It does **not** create a real `mirror-clean:<receipt-id>`.

Therefore the remediation conclusion remains unchanged:

- release / push status is still `No-Go` until cloud rotation evidence, rewritten public history, and post-rewrite validation are all present.

1. Repo-side rewrite prep continues to move forward.
2. Cloud-side rotation / invalidation evidence is still missing.
3. As of `2026-05-22`, rewrite rehearsal may still be practiced locally, but it cannot be accepted as completion of Milestone C until Milestone B is actually closed.
4. Release status remains `red-alert / blocked`, not because the rewrite mechanism is unproven, but because the cloud credential prerequisite remains unverified in-repo.

## 7. Boundary

This remediation does not grant any new runtime authority. It does not change Helm's review-before-commitment, recommendation-not-commitment, controlled-trial, or no-auto-send boundaries.
