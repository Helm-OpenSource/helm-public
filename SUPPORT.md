# Support

Helm is an Apache-2.0 open-source project in a controlled-trial stage. This file explains where to ask for help and what to do before opening a public thread.

## Before opening an issue

Please try the lowest-cost checks first:

```bash
npm install
npm run quickstart:doctor
npm run self-check
npm run check:boundaries
```

If your question is about local development rather than the Docker demo path, also include:

```bash
npm run typecheck
npm run lint
npm run test
```

## Where to ask

- **Bug reports / docs fixes / actionable defects**: [GitHub Issues](https://github.com/Helm-OpenSource/helm-public/issues)
- **How-to questions / architecture discussion / contribution direction**: [GitHub Discussions](https://github.com/Helm-OpenSource/helm-public/discussions)
- **Security vulnerabilities**: `security@helm.run`

If Discussions is not enabled in the repository yet, use Issues for public questions.

## What to include

- What you were trying to do
- Exact command(s) you ran
- What happened instead
- Relevant logs or screenshots
- Which verification commands you already ran
- Your environment:
  - OS
  - Node version
  - Docker version, if using quickstart
  - Whether you used local MySQL or Docker

## What not to post publicly

Do not post:

- Secrets, tokens, API keys, or database credentials
- Customer data
- Tenant-private hostnames or private deployment details
- Undisclosed security vulnerabilities

For private security disclosure, follow [SECURITY.md](SECURITY.md).

## Boundary note

Helm is not a production-grade enterprise platform yet. Public support is best-effort and does not imply SLA, managed hosting, or production incident response obligations.
