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

# Helm Delivery Engineer Node Fresh-Clone Smoke Receipt / Helm 交付工程师 Node Fresh-Clone Smoke 回执

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本回执证明已合并的 `helm-public` 主分支可以克隆到干净目录，并通过基于 Node 的黄金路径检查、
离线评测、公开守卫、生产构建和本地 `next start` HTTP 冒烟验证。

它不是 D2 Docker 全新克隆冒烟回执，且刻意不匹配
`HELM_DELIVERY_ENGINEER_D2_SMOKE*.md` 文件模式。记录时 Node 全新克隆路径为 PASS，
D2 Docker 全新克隆路径因本地环境缺少 `docker` / `colima` / `orb` / `podman` 而
阻塞；后续 D2 回执已关闭该阻断项。

本回执不证明 Docker Compose 上手路径、基于 MySQL 的本地工作区设置、30 分钟上手声明、
D2 冒烟完成、客户部署就绪、生产连接器就绪或商业发布 Go/No-Go 批准。

## English Reference

> Supersession note (2026-06-01): this node-only receipt remains useful
> historical evidence, but its Docker blocker is superseded by
> [HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md](HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md).

## 1. Conclusion

This receipt proves the merged `helm-public` main branch can be cloned into a clean directory and pass the Node-based Golden Path checks, offline evals, public guards, production build, and a local `next start` HTTP smoke.

This is **not** the D2 Docker fresh-clone smoke receipt. It deliberately does not match the `HELM_DELIVERY_ENGINEER_D2_SMOKE*.md` file pattern that `npm run delivery:doctor` checks for.

Status at the time of this node-only receipt:

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

## 6. Superseded Required Step

The required Docker fresh-clone path was later run in GitHub Actions and recorded in [HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md](HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md). That later receipt closes the D2 blocker for public Core quickstart only; it does not prove customer deployment readiness or commercial release Go/No-Go.
