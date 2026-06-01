---
status: active
owner: Product / Delivery Engineering / Engineering
created: 2026-06-01
review_after: 2026-06-15
source_pr: https://github.com/Helm-OpenSource/helm-public/pull/36
source_head_commit: 9839d1f9c1b20639f80772358e0ab7624375687f
tested_checkout_commit: 3402d454c94080d14b603faa2320adc8d9026767
github_actions_run: https://github.com/Helm-OpenSource/helm-public/actions/runs/26736471759
github_actions_job: https://github.com/Helm-OpenSource/helm-public/actions/runs/26736471759/job/78790648678
receipt_kind: d2_docker_fresh_clone_smoke
archive_trigger:
  - A later D2 Docker fresh-clone smoke receipt supersedes this receipt
  - The Docker quickstart path is materially changed
---

# Helm Delivery Engineer D2 Docker Fresh-Clone Smoke Receipt

## 1. Conclusion

The D2 Docker fresh-clone smoke for PR #36 passed in GitHub Actions on 2026-06-01.

This receipt proves the current PR branch can be checked out into a clean directory, built with `docker compose up --build -d`, initialized against the bundled MySQL 8.4 service, and serve the minimum public onboarding endpoints.

Current status:

- D2 Docker fresh-clone path: **PASS**
- Docker build: **PASS**
- MySQL service healthcheck: **PASS**
- App container start: **PASS**
- Minimum HTTP smoke: **PASS**

This receipt closes the previous `delivery:doctor` D2 warning for the tested branch. It is not a commercial launch approval, production deployment receipt, customer SLA, or connector readiness claim.

## 2. Environment

| Item | Value |
|---|---|
| PR | [#36](https://github.com/Helm-OpenSource/helm-public/pull/36) |
| Workflow | `D2 Docker Smoke` |
| Job | `Fresh Clone Docker Smoke` |
| Run | `26736471759` |
| Job ID | `78790648678` |
| Started | `2026-06-01T05:12:43Z` |
| Completed | `2026-06-01T05:17:11Z` |
| Head commit | `9839d1f9c1b20639f80772358e0ab7624375687f` |
| Tested checkout | `3402d454c94080d14b603faa2320adc8d9026767` |
| Runner OS | `ubuntu-latest` |
| Docker | `Docker version 28.0.4, build b8034c0` |
| Docker Compose | `Docker Compose version v2.38.2` |
| Smoke workdir | `/tmp/helm-public-d2-smoke.2gc2Wq` |

## 3. Commands And Results

| Command / Step | Result |
|---|---|
| `bash scripts/d2-docker-smoke.sh` | PASS |
| `git clone --no-checkout /home/runner/work/helm-public/helm-public /tmp/helm-public-d2-smoke.2gc2Wq` | PASS |
| `git fetch --depth 1 origin HEAD` | PASS |
| `git checkout --detach FETCH_HEAD` | PASS; checkout `3402d454c94080d14b603faa2320adc8d9026767` |
| `docker compose up --build -d` | PASS |
| MySQL container | PASS; `helm-mysql` became healthy |
| App container | PASS; `helm-app` started |
| `docker compose ps` | PASS; app and MySQL were running |
| Cleanup trap | PASS; compose stack was torn down after the smoke |

## 4. HTTP Runtime Smoke

| URL | Result |
|---|---|
| `http://localhost:3000/health` | `HTTP 200` |
| `http://localhost:3000/demo` | `HTTP 200` |
| `http://localhost:3000/trial` | `HTTP 200` |
| `http://localhost:3000/operating` | `HTTP 200` |

Observed container status after endpoint checks:

| Container | Image | Status | Ports |
|---|---|---|---|
| `helm-app` | `helm-app:dev` | `Up 22 seconds` | `0.0.0.0:3000->3000/tcp` |
| `helm-mysql` | `mysql:8.4` | `Up 33 seconds (healthy)` | `0.0.0.0:3306->3306/tcp`, `33060/tcp` |

The first `/health` probes saw transient connection resets while the app was still applying migrations, seeding data, and starting Next.js. The smoke script kept polling and passed once the app served HTTP 200.

## 5. Fixed During This D2 Pass

The D2 run exposed and closed two real runtime defects before this passing receipt:

1. The Docker runtime image did not include source directories needed by `tsx prisma/setup-db.ts` and `node --import tsx prisma/seed.ts`.
2. `docker-compose.yml` passed `--default-authentication-plugin=caching_sha2_password`, which MySQL 8.4 rejected as an unknown variable.

PR #36 fixes both issues and adds the reusable D2 smoke workflow.

## 6. Boundaries

This receipt proves only the public Core Docker quickstart smoke on the tested PR branch.

It does not prove:

1. Customer deployment readiness.
2. Helm Cloud / Enterprise release readiness.
3. Production connector credentials or callback readiness.
4. Production data retention, DPA, SLA, or incident process readiness.
5. Commercial Pack or customer Overlay readiness.
6. A runtime marketplace.
7. Any automatic external send, approval, settlement, or customer commitment authority.

## 7. Follow-Up

After this receipt lands, `npm run delivery:doctor` should report the D2 fresh-clone smoke receipt as present and drop from `29 pass / 1 warn / 0 fail` to `30 pass / 0 warn / 0 fail`.
