---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - a redacted_live_db_snapshot replaces this local rehearsal as production-query evidence
  - Phase 3V CLI is superseded by a broader calibration runbook
  - local DB seed shape changes enough that this rehearsal no longer reproduces
---

# Helm Business Advancement Phase 3V Local Calibration Rehearsal Closeout

更新时间：2026-04-30
状态：Local development rehearsal complete / production adoption No-Go

## 1. Conclusion

Phase 3V adds a local-only rehearsal path for the Business Advancement redacted calibration chain.

It exists because the current remote dev/RDS target was unreachable from this machine. The fallback is intentionally narrow: local DB can prove the Phase 3P -> 3Q -> 3R -> 3S toolchain runs and blocks safely, but it cannot satisfy live calibration or production query adoption.

## 2. Delivered Artifacts

| Artifact | Role |
| --- | --- |
| `scripts/business-advancement-phase3v-local-calibration-rehearsal.ts` | Local-only DB-backed rehearsal CLI; refuses non-local MySQL targets and expects Phase 3R/3S to remain blocked |
| `features/business-advancement/phase3v-local-calibration-rehearsal.test.ts` | 4 tests covering local success, synthetic rejection, live-snapshot rejection and no authority exposure |
| `package.json` | Adds `business-advancement:phase3v-local-calibration-rehearsal` |

## 3. Machine Decision

| Input | Result |
| --- | --- |
| Local MySQL snapshot | `localRehearsalPassed=true` |
| Phase 3Q intake | pass |
| Phase 3R | expected blocked |
| Phase 3S | expected No-Go |
| production adoption | false |
| runtime integration | false |

This is the expected safe outcome. If local rehearsal ever makes Phase 3R ready or Phase 3S packet-ready, Phase 3V fails.

## 4. Validation

| Command | Result |
| --- | --- |
| `DATABASE_URL="${LOCAL_DATABASE_URL}" DB_RESET_ALLOWLIST='helm2026_ba_calibration' npm run db:reset` | PASS with `HELM_SKIP_EXTENSION_SQL=1`; without skip, extension SQL failed on local MariaDB `CAST(... AS STRING)` |
| `npm run test -- features/business-advancement/phase3v-local-calibration-rehearsal.test.ts features/business-advancement/phase3p-redacted-snapshot-collector.test.ts features/business-advancement/phase3u-live-calibration-unblock-preflight.test.ts` | PASS — 3 files / 115 tests |
| `DATABASE_URL="${LOCAL_DATABASE_URL}" npm run business-advancement:phase3v-local-calibration-rehearsal -- --reference-clock-iso '2026-04-30T00:00:00.000Z' --take 100` | PASS — local rehearsal passed while Phase 3R/3S stayed blocked |
| `npx eslint --max-warnings 0 scripts/business-advancement-phase3v-local-calibration-rehearsal.ts features/business-advancement/phase3v-local-calibration-rehearsal.test.ts` | PASS |
| `npm run typecheck` | PASS |
| `npm run check:public-release` | PASS — scanned 2924 files / 0 blockers |
| `npm run check:boundaries` | FAIL — existing marker drift remains outside Phase 3V; doc lifecycle, Phase 3 runtime No-Go checks and tenant slug shared-layer reverse block passed |

## 5. Local Rehearsal Output

| Family | Rows | Included | Excluded | Checks pass | Calibrated |
| --- | ---: | ---: | ---: | --- | --- |
| TPQR-001 | 15 | 0 | 15 | false | false |
| TPQR-003 | 22 | 1 | 21 | false | false |
| TPQR-004 | 14 | 6 | 8 | false | false |

Phase 3R blocked for 14 reasons, including `sampleKind=local_development_snapshot`, incomplete production calibration, and TPQR family calibration gaps. These are expected blockers for local rehearsal.

## 6. Boundary

Phase 3V does not authorize:

1. live calibration readiness
2. production query adoption
3. runtime integration
4. page or API behavior changes
5. official writes
6. auto-send, auto-approve, auto-pay or auto-execution

## 7. Next Step

Use Phase 3V whenever remote DB access is unavailable and the team needs to prove the calibration toolchain still runs locally. To exit No-Go, run Phase 3U against a reachable non-local MySQL target with a real workspaceId, collect a `redacted_live_db_snapshot`, then rerun Phase 3Q/R/S and required reviewer approval.
