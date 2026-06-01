---
status: active
owner: helm-core
created: 2026-06-01
review_after: 2026-09-01
public_safety: Public-safe operational checklist. Lists gate steps, env-var names, and evidence file paths only. Set actual RELEASE_READINESS_* values on the release machine — do not commit dates, credentials, approval ids, or receipts produced by owner actions into this repo.
---
# Helm Public Visibility Gate Checklist V1

Operational checklist for taking `helm-public` from private to public. It
operationalizes the visibility gate defined in
[HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
§6.

**Hard rule:** repository visibility is flipped by the owner as the final manual
action, only after every step below is green. Any failed step is a No-Go. This
checklist does not flip visibility and does not grant Go/No-Go.

## Part 1 — Visibility gate steps

| # | Step | Owner-only? | Current status |
| --- | --- | --- | --- |
| 1 | Rotate / revoke the exposed RDS credential in the source environment | Yes (ops) | ✅ completed before owner Go/No-Go; raw ops receipt remains off-repo |
| 2 | HEAD `check:public-release` + `check:secret-history` green | No | ✅ green on `main` |
| 3 | History remediation produces a clean-history receipt | No | ✅ [HELM_PUBLIC_CLEAN_HISTORY_RECEIPT_V1.md](../reviews/HELM_PUBLIC_CLEAN_HISTORY_RECEIPT_V1.md) |
| 4 | Rewritten/snapshot history re-scanned and still green | No | ✅ gitleaks full-history scan clean (recorded in the receipt) |
| 5 | `npm run release:check` green incl. human-readable receipts | Mixed | ✅ FULL release gate rerun before tagging; raw manual receipt values remain off-repo |
| 6 | Owner Go/No-Go using founder/owner identity | Yes | ✅ recorded in [HELM_PUBLIC_VISIBILITY_GO_NOGO_2026-06-01.md](../reviews/HELM_PUBLIC_VISIBILITY_GO_NOGO_2026-06-01.md) |
| 7 | Flip repository visibility | Yes | ✅ completed by owner; repository is public |

## Part 2 — `release:check` manual receipts (7)

The final release-machine run set the corresponding `RELEASE_READINESS_*`
environment variables off-repo and reran the FULL release gate before tagging.
Do not commit raw receipt values, approval ids, credentials, or private evidence
to this repository.

### Evidence already in the repo — owner sets the env var

```bash
# Calibration report (file already present)
export RELEASE_READINESS_CALIBRATION_REPORT=docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md

# Audit-trace public posture (calibration receipt already records claim_withdrawn)
export RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE=claim_withdrawn

# Docker quickstart smoke (D2 fresh-clone smoke receipt already present, dated 2026-06-01)
export RELEASE_READINESS_DOCKER_SMOKE_PASSED=2026-06-01

# On-call / response policy (docs/operations/ON_CALL_AND_RESPONSE_SLA.md exists)
export RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY=<YYYY-MM-DD owner-approval date>
```

### Genuine owner / ops / reviewer actions — raw evidence remains off-repo

```bash
# 1. Ops rotates the Aliyun RDS root password + updates secret stores + reviews
#    access logs, then record the rotation date:
export RELEASE_READINESS_CREDENTIAL_ROTATED=<YYYY-MM-DD rotation date>

# 2. Secret-history remediation. check:secret-history already passes and the
#    clean-history receipt is in the repo; set a date (or mirror-clean:<receipt-id>
#    backed by docs/operations/release-readiness-receipts/<id>.json) once satisfied:
export RELEASE_READINESS_SECRET_HISTORY_REMEDIATED=<YYYY-MM-DD remediation date>

# 3. 5-role Required Reviewer approval record id (every canonical role = approved
#    on the same plan version):
export RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID=<approvalRecordId>
```

### Verify

```bash
npm run release:check          # expect: ALL CLEAR (FAST mode skips test/build/e2e)
RELEASE_READINESS_FULL=true npm run release:check   # full chain before tagging
```

## Part 3 — Final flip (owner)

1. Confirm Part 1 steps 1–5 are all green and Part 2 shows `ALL CLEAR`.
2. Owner records the Go/No-Go decision (step 6).
3. Only on Go: owner flips repository visibility to public (step 7).
4. Completed on 2026-06-01; future visibility, tag, release, or announcement
   changes still require owner authorization.

## Non-claims

This checklist does not rotate credentials, approve a release, set any
`RELEASE_READINESS_*` value, or flip visibility. It does not assert
`100% synthetic` provenance (see the separate synthetic provenance gate). It is a
navigation aid, not an SLA or launch-date commitment.
