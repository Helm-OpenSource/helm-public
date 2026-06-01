---
status: active
owner: Product / Delivery Engineering / Engineering
created: 2026-06-01
review_after: 2026-06-15
source_commit: 9ee60b607d5b845c8508341dfce656d17c3110e8
receipt_kind: node_fresh_clone_smoke
not_d2_docker_receipt: true
archive_trigger:
  - A real `HELM_DELIVERY_ENGINEER_D2_SMOKE*.md` Docker fresh-clone receipt supersedes this receipt
  - The documented onboarding path no longer depends on Docker
---

# Helm Delivery Engineer Node Fresh-Clone Smoke Receipt

## 1. Conclusion

This receipt proves the merged `helm-public` main branch can be cloned into a clean directory and pass the Node-based Golden Path checks, offline evals, public guards, production build, and a local `next start` HTTP smoke.

This is **not** the D2 Docker fresh-clone smoke receipt. It deliberately does not match the `HELM_DELIVERY_ENGINEER_D2_SMOKE*.md` file pattern that `npm run delivery:doctor` checks for.

Current status:

- Node fresh-clone path: **PASS**
- D2 Docker fresh-clone path: **BLOCKED by local environment** (`docker`, `colima`, `orb`, and `podman` were not available on PATH)

## 2. Environment

| Item | Value |
|---|---|
| Source | `https://github.com/Helm-OpenSource/helm-public.git` |
| Clone path | `/tmp/helm-public-fresh-node-smoke-20260601` |
| Commit | `9ee60b607d5b845c8508341dfce656d17c3110e8` |
| macOS | `26.5` / build `25F71` |
| CPU | `arm64` |
| Homebrew | `5.1.14` |
| Docker CLI | not found |
| Colima | not found |
| OrbStack CLI | not found |
| Podman | not found |

## 3. Commands And Results

| Command | Result |
|---|---|
| `git clone --depth 1 https://github.com/Helm-OpenSource/helm-public.git /tmp/helm-public-fresh-node-smoke-20260601` | PASS |
| `git rev-parse HEAD` | `9ee60b607d5b845c8508341dfce656d17c3110e8` |
| `npm ci` | PASS; 710 packages installed; npm audit reported 4 moderate vulnerabilities |
| `npm run delivery:doctor` | PASS: 29 pass / 1 warn / 0 fail |
| `npm run pack:fixture-check` | PASS: 15 pass / 0 warn / 0 fail |
| `npm run eval:headless-signal-interface` | PASS: 2 packs, 6 signal families, 15 boundary cases, 0 incident counters |
| `npm run eval:operating-signal-flow` | PASS: 15 cases, 7 signal families, 10 blockers, 22 required states, 0 authority / raw / cross-tenant / LLM incidents |
| `npm run check:public-release` | PASS: 3348 files scanned, 0 blockers |
| `npm run check:boundaries` | PASS: public mirror smoke scanned 1333 files |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; 106 static pages generated |
| `PORT=3101 npm run start` | PASS; Next.js ready in 61ms |

## 4. HTTP Runtime Smoke

| URL | Result |
|---|---|
| `http://localhost:3101/health` | `200 text/html; charset=utf-8` |
| `http://localhost:3101/demo` | `200 text/html; charset=utf-8` |
| `http://localhost:3101/trial` | `200 text/html; charset=utf-8` |
| `http://localhost:3101/operating` | Redirected to `/login`; final result `200 text/html; charset=utf-8` |

The production server was stopped after the smoke using `Ctrl-C`.

## 5. Boundaries

This receipt does not prove:

1. Docker Compose onboarding.
2. MySQL-backed local workspace setup.
3. A 30-minute onboarding claim.
4. D2 smoke completion.
5. Customer deployment readiness.
6. Production connector readiness.
7. Commercial release go/no-go approval.

## 6. Next Required Step

To close the D2 release blocker, run the documented Docker fresh-clone path on a machine with Docker Desktop, OrbStack, Colima, or equivalent Docker-compatible runtime installed, then commit a separate receipt named `HELM_DELIVERY_ENGINEER_D2_SMOKE*.md`.
