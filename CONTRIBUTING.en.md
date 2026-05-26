> **Language / 语言**：**English** · [中文](CONTRIBUTING.md)

# Contributing to Helm

Thank you for considering a contribution to Helm.

Helm is a "business push console / operating-push OS" built for **controlled pilots**. It folds meetings, mail, CRM and internal-system signals into a single push chain, giving teams and AI staff explicit must-push items, evidence trails, and a formal review entry.

Please read this guide before submitting a contribution.

> Many of the deeper documents linked from here (`AGENTS.md`, `DESIGN.md`, `WORKING-CONTEXT.md`, `GOVERNANCE.md`, the `docs/` tree) are Chinese-only. The English entry points are this file, [README.en.md](README.en.md), and [docs/getting-started.en.md](docs/getting-started.en.md).

---

## 1. Read these first (in order)

Read these in order — don't skip:

1. [AGENTS.md](AGENTS.md) — Long-term standards, hard boundaries, unified verification chain *(Chinese)*
2. [README.en.md](README.en.md) — Project overview, what ships vs. what we intentionally don't
3. [DESIGN.md](DESIGN.md) — Visual + UI baseline *(Chinese)*
4. [WORKING-CONTEXT.md](WORKING-CONTEXT.md) — Current active queue + short-cycle constraints *(Chinese)*
5. [GOVERNANCE.md](GOVERNANCE.md) — Open-source governance, scope control, release & certification boundaries *(Chinese)*
6. [docs/README.md](docs/README.md) — Full doc index *(Chinese)*

If your change touches tenant separation, billing, connectors, or public-release scripts, also read:

- `docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md` — public/private repo boundary and May launch posture
- `docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md` — public trial data policy
- `docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md` — May launch plan
- `docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md` — open core / commercial runtime / partner delivery boundary

---

## 2. What Helm is *not*

To avoid contributions that go in the wrong direction, please confirm Helm is currently **not**:

- A full enterprise multi-org / multi-permission / multi-tenant platform
- A full workflow / orchestration engine
- A full BI platform
- A general-purpose chat product
- An auto-execution surface or auto-send / auto-approval system
- An app marketplace

PRs aimed at the above will not be accepted by default.

---

## 3. Controlled-pilot posture

Helm is explicitly in the "controlled pilot" stage. This means:

- No full production-grade enterprise SSO / SCIM by default
- No broad auto-write, auto-send, auto-execution by default
- No real plugin runtime sandbox
- All customer-facing wording explicitly distinguishes **recommendation** from **commitment**

New features and changes must preserve these boundaries — don't extend them into platform-level capabilities.

---

## 4. Preferred contribution types

We especially welcome:

- **Bug fixes** — with a minimal repro and a regression test
- **Doc revisions** — terminology unification, typo fixes, stale-description cleanup
- **Test coverage** — particularly `lib/presentation/` regression and `tests/e2e/`
- **Localization & translation** — keeping the bilingual doc set in sync
- **External connectors** — read-only connectors that don't break the read-first / review-first boundaries
- **Accessibility** — keyboard navigation, contrast, ARIA

Please open an issue and discuss *before* writing code for:

- Any schema-changing change
- Any change introducing auto-write / auto-send / auto-approval
- Any change that introduces plugin sandbox, marketplace, agent orchestration, or payment platform capabilities
- Any refactor of `app/` route ownership or the `data/queries.ts` aggregation layer
- Large-scale directory restructuring

---

## 5. Local prerequisites

```bash
# Install dependencies
npm install

# Copy the environment template (requires local MySQL)
cp .env.example .env

# Prepare the database
npm run db:generate
npm run db:migrate
npm run db:seed

# Start the dev server
npm run dev
```

`.env.example` is split into three tiers:

- **MUST**: `DATABASE_URL`, `APP_URL`, `CONNECTOR_TOKEN_SECRET`
- **OPTIONAL_AI**: `OPENAI_API_KEY`, `LLM_*`
- **OPTIONAL_CONNECTORS**: DingTalk, HubSpot, Salesforce, Stripe, Alipay, WeChat Pay, etc.

Only the MUST tier needs values along every code path; the others are enabled on demand.

For the longer onboarding walkthrough, see [docs/getting-started.en.md](docs/getting-started.en.md).

---

## 6. Default verification chain

Any non-trivial change must pass the full chain before submission:

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

What each command means: see [AGENTS.md §10](AGENTS.md) *(Chinese)*.

If a command can't run in your environment, the PR description **must** state:

- Which commands didn't run
- Why
- The remaining risk

---

## 7. Decision-first & Recommendation/Commitment boundary

Helm is `decision-first`: every page should surface, in order — *what Helm currently sees · why · what action is needed · what boundary applies*.

Any customer-facing wording at risk of being misread as a commitment must be explicitly downgraded to one of:

- boundary note
- prerequisite note
- dependency note
- non-commitment note

Don't write recommendations that read as commitments. Don't write explanations that read as contracts.

---

## 8. Submission rules

### Contribution rights

You may only submit content you have the right to contribute under Apache-2.0. Do **not** submit customer data, customer proof packs, private eval goldens, commercial workflow packs, private connector credentials, or third-party code under an incompatible license.

Until a formal DCO / CLA workflow is automated, maintainers may ask you to add `Signed-off-by` or other rights confirmations to non-trivial contributions.

### Commit message

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <subject>

[optional body]
```

Common types:

- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation only
- `refactor`: behavior-preserving refactor
- `test`: tests
- `chore`: build / tooling
- `perf`: performance

Subject line should start with a verb describing **what was done**, not **why**. The "why" goes in the body.

### Pull Request

A PR description must contain at minimum:

1. **Goal of this PR** — one sentence on intent
2. **Scope** — main files / modules touched
3. **Verification** — which commands ran, results, reasons for any skips
4. **Boundary check** — whether the change touches the hard boundaries from §2-§3
5. **Screenshots or screen recording** — required for UI changes

PR titles follow the same format as commit messages.

---

## 9. Design & UI changes

UI changes must align with [DESIGN.md](DESIGN.md) *(Chinese)*:

- Light-mode-first (not dark-mode-first)
- 70% enterprise-trustworthy, 20% AI-modern, 10% doc-grade clarity
- Judgement-first, decision-first hierarchy
- Restrained color, type, and motion
- High information density on operational surfaces

Run `npm run dev` and walk the main paths in a browser before submitting. Confirm there is no visual drift.

---

## 10. Doc & index sync

Whenever you change behavior, add a capability, or relocate a path, you must also update:

- `README.md` / `README.en.md` and `docs/README.md`
- Related product / governance / review docs
- Self-check and boundary-check scripts:
  - `scripts/helm-self-check-refactored.ts`
  - `scripts/decision-first-boundary-check.ts`
  - `scripts/pilot-readiness-check.ts`
- The corresponding regression tests

PRs that ship a report but don't update the index, self-check, or regression entry will not be accepted by default.

---

## 11. Security contributions

Do **not** submit security vulnerabilities through public issues or PRs. Use the responsible-disclosure process described in [SECURITY.md](SECURITY.md).

---

## 12. Code of conduct

By participating in this project you agree to [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 13. License

By submitting a PR, you agree that your contribution is released under the repository's [LICENSE](LICENSE) (Apache-2.0).

If your contribution includes third-party code or assets, you must explicitly note their original license in the PR description and preserve the original copyright and license notices.
