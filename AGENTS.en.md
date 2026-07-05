> **Language / 语言**：**English** · [中文](AGENTS.md)

# AGENTS.md

## 1. Purpose

This file is the long-term, project-level execution standard for the Helm repository.

It defines:

- What Helm currently is
- The default role of Codex inside the Helm repository
- Which boundaries must be preserved long-term
- How tasks should be advanced by default
- What counts as "done"

All subsequent Codex tasks default to reading this file first, then [README.en.md](README.en.md) and [docs/README.md](docs/README.md) (Chinese).

## 2. Repository Boundaries

- The single Git root is the current repository root (as `git rev-parse --show-toplevel` reports it)
- `app/` remains the sole or primary route owner
- `data/queries.ts` remains the query aggregation entry — it has been thinned but still exists
- Anything marked "doc placeholder" is treated as **not implemented** unless code already lives in `app/api/` or the corresponding implementation directory
- This repository is `Helm-OpenSource/helm-public`; it only accepts open-source Core, base SDK, sample pack, public docs, public tests, and Docker quickstart work.
- This repository must stay Apache-2.0, independently buildable, and public-safe. Do not add customer names, real email addresses or phone numbers, private domains, intranet IPs, secrets, customer deployment details, commercial private logic, or any customer-specific content.
- `Core` must never reverse-depend on `Pack` or `Overlay`; this repository must not import `helm-packs`, `helm-overlays`, or any customer overlay path. The only allowed dependency direction is `Overlay -> Pack SDK -> Core SDK`.
- If a requirement belongs to an industry Pack, customer Overlay, or control-plane metadata, route it to the corresponding repository. If the code still lives in `helm2026`, open a migration / backfill PR first, then continue development in the target repository.

## 3. What Helm Currently Is

Helm is:

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `proactive-reporting-first`
- `delivery-engineer-facing` (since 2026-05-18: the audience layer is AI-ecosystem delivery engineers, not direct SaaS sales to end customers)
- `open-source-first` (Apache-2.0; commercial editions do not replace open source; see [docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md))

All public entry points, docs, templates, and sample packs must default to being
delivery-engineer-friendly: a reader should quickly understand what to inspect,
what to fork, which small change to make, which commands to run, and what
public-safe evidence to submit. Bilingualization is not just text translation; it
must let China-market delivery engineers complete an independent first-change
proof while preserving recommendation / commitment, review-first, and
public/private boundaries.

Helm currently is **not**:

- A complete enterprise multi-org / multi-permission / multi-tenant platform
- A complete workflow / orchestration platform
- A complete BI platform
- A complete auto-execution surface
- A general-purpose chat product
- A general-purpose CRM / ERP / project-management platform
- A SaaS product sold directly to end customers (Helm Inc. keeps only a small set of named direct lighthouse engagements to harden the methodology and industry Packs, and does not compete with delivery engineers beyond them; commercial model is open-core maintenance / Helm Cloud / Helm Enterprise / Certified Delivery Partner ecosystem / named direct lighthouse delivery)

## 4. Current Stage

The repository inherits the following stage conclusions by default:

- Helm overall: `A`
- recommendation / commitment main lines: `A-minus`

Directions that have reached a stable baseline today:

- control layer
- productization
- experience memory
- multi-tenant control plane
- trial delivery
- onboarding / activation
- success / expansion
- proposal / package / commitment / shaping
- customer-facing offer / external proposal
- external narrative / customer conversation
- founder / sales / delivery narrative variants
- founder / sales / delivery asset packs
- role-based usage scenarios
- worker / skill / resource binding
- reporting model / decision-first IA
- proactive reporting / proactive collaboration mechanisms

## 5. Default Codex Role

Codex's default role inside the Helm repository is:

- The standard execution layer
- The unified landing layer for docs / guards / tests / reports / freezes / sprints
- A stable executor of rules, templates, and verification loops

Codex does **not** by default:

- Pick the direction unilaterally
- Expand task scope on its own initiative
- Quietly extend a local sprint into platform engineering
- Restate "shaped but needs the next layer" as "fully landed"

## 6. Long-term Hard Boundaries

The following boundaries must be preserved long-term and stated honestly:

1. The plugin runtime still has no real sandbox
2. Some legacy shims remain
3. Future-real auth is still **not** full production-grade enterprise auth — it is a more stable controlled-trial auth chain
4. OpenShell / OpenClaw / NemoClaw are still the closest minimal external bridging targets to real adapters / processes
5. The system is still **not** a full enterprise multi-org / multi-permission / multi-tenant platform
6. Proactive mechanisms still default to *suggest, prepare, escalate*; they do **not** default to high-risk auto-commitment or high-risk auto-send
7. Any customer-facing wording at risk of being read as a commitment is downgraded to one of:
   - boundary note
   - prerequisite note
   - dependency note
   - non-commitment note

## 7. recommendation / commitment Rules

All subsequent tasks must continue to honor:

- recommendation ≠ commitment
- explanation ≠ a promise
- proposal ≠ a contract
- package ≠ the final pricing system
- proactive ≠ auto-deciding for the user

Any conclusion that risks being read as an external commitment must be paired with:

- boundary
- prerequisite
- dependency
- risk
- non-commitment

## 8. Unified Tier Rules

All sprints / freezes / baselines / summary reports must use the following four short categories:

- Fully landed
- Shaped but needs the next layer
- Intentionally not done
- Risks

Unified downgrade rule:

- If code, page, test, and doc are not all true at the same time, the item is downgraded to:
  - `Shaped but needs the next layer`

The four-tier classification is **repository-level metadata**, not something every freeze report restates. Current truth table:

- [`docs/STATUS.md`](docs/STATUS.md) — repository-level four-tier registry, maintained monthly by the owner

If a judgement is not in `docs/STATUS.md`, **as far as the repo is concerned it does not exist**. Every new freeze / closeout / baseline report must update the corresponding row in STATUS.md; otherwise it is not accepted for merge.

## 8.1 Doc Naming Stability Rule

> **Historical note**: The previous §8.1 (doc lifecycle frontmatter enforcement, effective 2026-04-27) was retired on 2026-05-02; STATUS.md remains the repo-level source of truth.

Doc **filenames** no longer use `_V<N>` / `_V<N>_<M>` suffixes for versioning. Version evolution is expressed in an in-file `## Change Log` section.

- Exception: existing `*_V1.md` / `*_V2_3.md` filenames remain until the next major revision; no forced rename
- New docs may not carry a `_V<digit>` suffix (unless the doc explicitly supersedes a specific historical archive)

## 9. Standard Execution Loop

All subsequent Codex tasks default to:

1. `plan`
2. `implementation`
3. `validation`
4. `report`

Without a verification result, the task is not done.

Default expectations:

- Explain current state and the goal of this round first
- Make the **non-goals** explicit
- Break work into bounded tasks
- After implementation, sync docs, guards, tests, and self-checks
- Close with a freeze or sprint report

## 9.1 Multi-agent Parallel Work Governance

All subsequent Codex / Claude / other-agent parallel tasks must establish
workspace ownership before editing files.

A shared primary checkout, such as `/Users/tommyqian/Documents/helm-public`, is
for inspection, sync, audit, or short rescue work by default; it is not a
long-lived implementation WIP area. Any non-trivial implementation, task that
needs multiple validation rounds, or task likely to span more than one work turn
defaults to a dedicated worktree + branch from the intended base.

Before any implementation, commit, or PR, run and record:

```bash
git status --short --branch
git worktree list
git rev-parse --show-toplevel
```

Mandatory rules:

- If the shared primary checkout already has uncommitted WIP, new
  implementation threads must route around it. Do not keep layering changes in
  that directory for convenience, and do not make other threads sort the current
  thread's WIP.
- A task stream may only implement in its own worktree + branch. Do not keep
  layering changes into a directory where another agent already has uncommitted
  WIP.
- If the current directory is not the worktree explicitly owned by this task, or
  if it contains uncommitted changes that do not belong to this task, stop
  implementation and create a separate worktree / branch from the intended base.
- WIP inside a worktree must be explainable by one explicit task. WIP that
  remains open beyond one work turn must be promptly turned into an atomic
  commit, pushed to the corresponding PR, or migrated into a dedicated isolated
  worktree.
- Different concerns must use separate commits / PRs. For example,
  bilingualization, security hardening, capability development, and governance
  docs must not be mixed into one commit.
- Staging must list files explicitly. `git add -A` is prohibited by default
  unless the agent has first proven that the worktree contains no other user or
  agent changes.
- Cross-repository tasks may inspect, dispatch, hand off, and track completion
  only. Implementation changes must happen in the owning repository's own
  thread / worktree; do not edit files across repository boundaries from the
  current repository.
- If an agent discovers that it has affected another parallel workstream, the
  first action is not to keep implementing. First stop implementation, inventory
  the affected worktrees / branches / files, turn the current WIP into an atomic
  commit or move it into an isolated worktree, then record the recovery action.

## 10. Unified Verification Commands

Unless the user explicitly waives them, tasks must include the following verification list:

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

If any command cannot run, the reason must be stated explicitly.

## 11. Unified Deliverables Format

Standard tasks default to delivering:

1. Code and doc changes
2. README / docs / index sync
3. Required guard, self-check, test updates
4. The current-round report file
5. The summary report file

The summary report must answer:

1. Which capabilities are fully landed in the current version
2. Which are shaped but need the next layer
3. Where we intentionally did not do something, and why
4. Which boundaries must continue to be honestly preserved
5. Whether the current baseline / sprint goal is clear
6. Whether the recommendation / commitment A-minus main lines remain stable
7. The 5 most important things for the next stage

## 12. Doc / Guard / Test Sync Rules

Whenever a task changes behavior, at minimum sync-check:

- `README.md` / `README.en.md`
- `docs/README.md`
- The relevant product or governance docs
- If the task touches `extensions/*`, `WorkspaceSolutionExtension`, `app/api/extensions/*`, or tenant custom asset migration, also sync:
  - `docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md`
  - The extension's `README.md` / `docs/*` / `extension.manifest.json`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- The corresponding regression tests

Reports without index, self-check, or regression-entry updates are not accepted.

## 13. Unified Prohibitions

Unless the user explicitly asks for it, Codex must not casually:

1. Add new business scenarios
2. Overturn the canonical main-object hierarchy
3. Do large-scale directory restructuring
4. Expand a local capability into a full platform
5. Build a sandbox
6. Build a marketplace
7. Build payment
8. Build a full workflow engine
9. Build a full agent orchestration platform
10. Build a full notification center / BI platform / auto-execution plane
11. Auto-commit beyond authority
12. Auto-send externally beyond authority
13. Auto-modify high-risk state beyond authority

## 14. Doc Entry Points

Unified entry points for Codex work:

- Repo rules: [AGENTS.md](AGENTS.md) (Chinese) / [AGENTS.en.md](AGENTS.en.md)
- Project overview: [README.md](README.md) / [README.en.md](README.en.md)
- Doc index: [docs/README.md](docs/README.md) (Chinese)
- Codex template directory: [docs/codex/README.md](docs/codex/README.md)
- First-batch skills: `.agents/skills/`

## 15. Default Judgement Principles

When unsure which path to choose, prefer the option that improves the following four most:

- usability
- credibility
- demo clarity
- product consistency

These rank above novelty and over-engineering.

## 16. Project-level Default Workflow

For non-trivial tasks in the Helm repo, default to reading first:

- [helm-repo-default-workflow](.agents/skills/helm-repo-default-workflow/SKILL.md)

Default skill stack:

- `spec-driven-development`
- `planning-and-task-breakdown`
- `incremental-implementation`
- `test-driven-development`
- `code-review-and-quality`
- `documentation-and-adrs`
- `git-workflow-and-versioning`

Add by trigger:

- Page / shell / detail / handoff / role surface changes: `frontend-ui-engineering`
- Query boundaries / actions / contracts / Prisma / cross-module interface changes: `api-and-interface-design`
- Login / membership / billing / invite / imports / callback / customer-facing commitment boundaries: `security-and-hardening`
- test / build / e2e / eval / self-check / boundary failures: `debugging-and-error-recovery`
- scripts / retry / verification chain / CI entry: `ci-cd-and-automation`
- Legacy shim shrinkage / canonical path replacement / retiring old expressions: `deprecation-and-migration`

Recommended overlays with repo-local skills:

- readiness tasks: `readiness-sprint`
- freeze / alignment: `baseline-freeze`
- judgement-first / decision-first page refactors: `decision-first-page-refactor`
- worker / skill / resource main line: `worker-skill-resource-binding`

When narrowing further, read the domain-specific skill first:

- billing / trial / membership / seat / entitlement / participant portal / payment rail: [`billing-access-and-participant-ops`](.agents/skills/billing-access-and-participant-ops/SKILL.md)
- imports / connectors / CRM sync / callback / capture / ingest / conflict: [`imports-connectors-and-capture`](.agents/skills/imports-connectors-and-capture/SKILL.md)
- memory / facts / blockers / commitments / briefing / recommendation / today focus / eval: [`memory-recommendation-and-briefing`](.agents/skills/memory-recommendation-and-briefing/SKILL.md)
- reporting / dashboard / operating workspace / role handoff / customer success / detail navigation: [`handoff-reporting-and-operating-surfaces`](.agents/skills/handoff-reporting-and-operating-surfaces/SKILL.md)
- tenant custom extension / `extensions/*` / `WorkspaceSolutionExtension` / `app/api/extensions/*`: read [HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md](docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md) and [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md) first
