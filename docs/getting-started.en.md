---
status: active
owner: helm-core
created: 2026-04-29
review_after: 2026-07-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
> **Language / 语言**：**English** · [中文](getting-started.md)

# Developer Quickstart

This guide is for developers running Helm locally **for the first time**. By the end you should be able, in about 15 minutes, to:

1. Install dependencies
2. Bring up MySQL
3. Run migrations + seed
4. Start the dev server and see "today's 3 must-decide calls" at `/dashboard`
5. Know which doc to read next

If you only want a 90-second demo, go back to [README.en.md](../README.en.md#90-seconds-to-see-helm) and use `docker compose up`.

---

## 0. Requirements

| Item | Min version | Notes |
|---|---|---|
| Node.js | 20.x (LTS recommended) | 16.x is no longer supported |
| npm | 10.x | The repo uses npm; no pnpm/yarn lockfile is configured |
| MySQL | 8.4 | Local or remote; local Docker recommended |
| Git | 2.30+ | LFS not required |
| OS | macOS / Linux / WSL2 | Native Windows is not part of the validated mainline |

Optional (as needed):

- Docker Desktop / OrbStack / colima — to run MySQL locally
- VS Code / Cursor / JetBrains — the repo ships with `.vscode/` recommendations

---

## 1. Clone

```bash
git clone https://github.com/Helm-OpenSource/helm-public.git
cd helm-public
```

---

## 1.1 Mainland China / restricted-network setup (optional)

If your network has unreliable access to Docker Hub or `registry.npmjs.org`,
treat mirrors as **local environment configuration**. Do not commit private
mirrors, tokens, or credentials.

For local `npm install`, copy the template:

```bash
cp .npmrc.example .npmrc
```

The template only sets:

```ini
registry=https://registry.npmmirror.com
```

For `npm ci` inside the Docker build, pass the same mirror:

```bash
NPM_REGISTRY=https://registry.npmmirror.com docker compose up --build
```

This build arg only affects npm downloads inside the image. `node:22-slim` and
`mysql:8.4` still come through your Docker daemon; if Docker Hub is unreliable,
configure an organization-approved registry mirror in Docker Desktop /
OrbStack / colima or your enterprise mirror gateway, for example:

```json
{
  "registry-mirrors": [
    "https://<your-org-approved-dockerhub-mirror>"
  ]
}
```

The image build also reaches Debian `apt` mirrors to install OpenSSL / CA
certificates. If your enterprise network blocks that path too, configure Docker
/ enterprise network proxy first, or replace the base image in your fork with
an organization-approved one.

Delete the local `.npmrc` file to return to the default npm registry.

---

## 2. Install dependencies

```bash
npm install
```

The `postinstall` step only runs the local macOS lightningcss signature helper;
it does **not** generate the Prisma client. After MySQL and `.env` are ready,
run `npm run db:generate` explicitly in step 5.

---

## 3. Bring up MySQL

Easiest path — run a local instance with Docker:

```bash
docker run -d --name helm-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=helm2026 \
  -p 3306:3306 \
  mysql:8.4
```

Default `DATABASE_URL` after that:

```
mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4
```

This matches `.env.example` and `docker-compose.yml`. If you already have MySQL,
skip this step and replace the URL in `.env`.

---

## 4. Configure environment variables

```bash
cp .env.example .env
```

`.env` is split into three tiers:

### MUST (minimal set, required)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `APP_URL` | Usually `http://localhost:3000` for local dev |
| `CONNECTOR_TOKEN_SECRET` | At least a 32-byte random string. Generate with `openssl rand -hex 32` |

### OPTIONAL_AI (falls back to placeholder)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Any OpenAI-compatible endpoint works |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` | Qwen (DashScope) provider credential and endpoint |
| `LLM_BASE_URL` / `LLM_MODEL` | Local / alternative models |

When missing, the UI does not crash; it shows an "LLM not configured" notice.

### OPTIONAL_CONNECTORS (enable as needed)

DingTalk · WeCom · HubSpot · Salesforce · Stripe · Alipay · WeChat Pay.

Leave them all blank on a first run.

---

## 5. Initialize the database

```bash
npm run db:generate    # generate Prisma client
npm run db:migrate     # apply migrations
npm run db:seed        # load development sample data
```

If migration fails with an extension-SQL related error, run:

```bash
npm run db:migrate     # rerun the migration entrypoint
```

If it still fails, first confirm that `.env` `DATABASE_URL` matches your MySQL
startup parameters.

To reset (**this destroys local data**):

```bash
npm run db:reset
```

---

## 6. Start the dev server

```bash
npm run dev
```

Open in a browser:

| URL | What you see |
|---|---|
| http://localhost:3000 | Public landing page |
| http://localhost:3000/dashboard | Today's 3 calls (login required) |
| http://localhost:3000/mobile | Mobile Ask Helm |
| http://localhost:3000/setup | 6-step setup wizard |

The seed data ships with demo accounts — sign in via `/login` using one of the seeded emails.

---

## 7. Verify your environment

Run the minimal verification chain:

```bash
npm run typecheck
npm run lint
npm run test
```

If you intend to submit a PR, run the full chain before committing:

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

---

## 8. Troubleshooting

### `prisma generate` can't find a binary
Usually a Node-version issue. Confirm `node -v` ≥ 20, then delete `node_modules` and reinstall.

### MySQL 8.4 complains about `caching_sha2_password`
Make sure the password in your connection string matches the one you started MySQL with. Prisma uses the native protocol; no extra config needed.

### `npm run e2e` fails in CI but passes locally
Run `npx playwright install chromium` locally too, to ensure browsers are installed. E2E uses a random port in the 65xxx range by default.

### Dev server starts but `/dashboard` redirects to `/login`
Expected — the seed data requires a sign-in. If even `/login` won't submit, double-check that `CONNECTOR_TOKEN_SECRET` is set.

### Don't want MySQL — can I use SQLite?
**No.** SQLite has been retired from the mainline; the SQLite schema is kept as a read-only archive only. Use MySQL 8.4.

---

## 9. Directory cheat sheet

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router — current route owner |
| `features/<domain>/` | Domain logic, pages, server actions |
| `data/queries.ts` | Current query aggregation layer |
| `lib/<domain>/` | Domain services, memory, AI, connectors, billing |
| `components/` | Cross-domain reusable UI |
| `prisma/` | Schema, migrations, seed |
| `scripts/` | Verification, self-check, maintenance |
| `tests/e2e/` | Playwright E2E |
| `docs/` | Product / architecture / implementation docs (mostly Chinese) |

---

## 10. What to read next

- Architecture philosophy: [../AGENTS.md](../AGENTS.md) §1-§4 *(Chinese)*
- UI changes: [../DESIGN.md](../DESIGN.md) *(Chinese)*
- Adding a connector: [integrations/INTEGRATION_TEMPLATE.md](integrations/INTEGRATION_TEMPLATE.md)
- Current priorities: [../WORKING-CONTEXT.md](../WORKING-CONTEXT.md) *(Chinese)*
- Submitting a PR: [../CONTRIBUTING.en.md](../CONTRIBUTING.en.md)
- Full doc index: [README.md](README.md) *(Chinese)*

> The deeper internal docs are Chinese-only. They are plain Markdown — machine translation works well if you need a fast read.

---

## 11. Where to ask for help

- GitHub Issues — prefer public questions so others can find them
- WeChat `ffjw0821` — contact us / partnership topics / community coordination
- Community invite QR — add WeChat `ffjw0821` first to receive the currently valid invite QR (QR codes expire)
- Social media / official account — TBD (not a committed support channel yet)
- Security vulnerabilities — **do not** use public issues; see [../SECURITY.md](../SECURITY.md)
