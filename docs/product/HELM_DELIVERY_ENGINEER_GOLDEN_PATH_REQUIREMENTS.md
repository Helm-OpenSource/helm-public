---
status: active
owner: Product / Delivery Engineering / Engineering
created: 2026-06-01
review_after: 2026-06-15
repo_scope: Helm-OpenSource/helm-public
public_safety: Public Core requirements only. Do not add customer data, commercial private logic, Pack implementation details, Overlay configuration, credentials, private hosts, deployment receipts, or visibility-flip approval claims.
source_basis:
  - Owner DEF specification v1
  - Claude cross-check rounds on 2026-06-01
  - Local repo truth from delivery:doctor, public docs manifest, HSI requirements, and case-management sample
---
# Helm Delivery Engineer Golden Path Requirements / Helm 交付工程师 Golden Path 要求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文是 `Helm-OpenSource/helm-public` 中 delivery-engineer Golden Path 的 public
Core requirements contract。它把北极星目标收敛成仓库可验证工作：帮助 AI 交付工程师
把客户业务实施中的 judgement、evidence、review、boundary 和 delivery package 工作，
组织成可 fork 的工程结构。

第一版只覆盖已有 surface 的 requirements 与 verification contract，不新增产品面。
`helm-public` 只承接 public Core、base SDK、public sample pack、public docs、
public tests、Docker quickstart 和 offline evals。商业行业 Pack 属于
`helm-packs`；客户 Overlay 属于 `helm-overlays`；BOM、授权、部署 registry、版本
inventory、health heartbeat 与 usage metadata 属于 `helm-control-plane`。

核心铁律：

1. Zero new surface：优先复用 `/demo`、`extensions/case-management-sample`、
   `delivery:doctor`、existing evals 和 existing public-release guards。
2. Gate-relative wording only：公开文本只能使用 Now / Next / Later 和 evidence gates，
   不写具体 launch date 或 version-date promise。
3. Private until gate：visibility flip 是最终 owner action，不由本 workstream 自动完成。
4. No overclaim：没有精确 evidence gate 和引用，不得写 `verified`、`clean SDK`、
   `100% synthetic`、`release-ready` 或 `production-ready`。

Golden Path 的最小链路是：clone public Core、用 Docker quickstart 或标准本地路径启动、
查看 `/demo` 与 public sample pack、修改 synthetic fixture、运行既有检查、观察 signal /
review packet path，并确认 forbidden write / send / approve / execute / cross-tenant path
仍被阻断。

## English Reference

This document is the public Core requirements contract for the delivery-engineer
Golden Path in `Helm-OpenSource/helm-public`.

It turns the north star into repository-verifiable work:

> Help AI delivery engineers turn the judgement, evidence, review, boundary, and
> delivery package work inside customer business implementation into a forkable
> engineering structure.

## 0. Scope And Repository Boundary

The first version is a requirements and verification contract over existing
surfaces. It does not create a new product surface.

Target repository:

- `helm-public`: public Core, base SDK, public sample pack, public docs, public
  tests, Docker quickstart, and offline evals.

Out-of-repo routing:

- `helm-packs`: commercial industry Packs, such as NPA.
- `helm-overlays`: customer Overlay configuration, branding, customer-specific
  runtime differences, and customer deployment details.
- `helm-control-plane`: BOM, authorization, deployment registry, version
  inventory, health heartbeat, and usage metadata.
- `helm2026`: frozen migration and historical comparison source only.

Dependency direction:

- Allowed: `Overlay -> Pack SDK -> Core SDK`.
- Forbidden: Core importing Pack, Overlay, customer-specific paths, or commercial
  private logic.

Visibility posture:

- "Open-source Core" is the product and license posture.
- Repository visibility can remain private until the visibility gate in this
  document is complete and the owner gives a manual Go/No-Go.

## 1. Iron Rules

1. Zero new surface: reuse `/demo`, `extensions/case-management-sample`,
   `delivery:doctor`, existing evals, and existing public-release guards before
   adding any page, route, package, script, API, schema, or runtime.
2. Gate-relative wording only: use Now / Next / Later and evidence gates. Do not
   use concrete launch dates or version-date promises in public-facing text.
3. Private until gate: do not flip repository visibility in this workstream.
   Visibility flip is a final owner action after the public-release and
   history-level gates are green.
4. No overclaim: do not print `verified`, `clean SDK`, `100% synthetic`,
   `release-ready`, or `production-ready` unless the exact evidence gate is met
   and cited.

## 2. Engineering Definitions

| Concept | Engineering definition | It is not |
|---|---|---|
| Judgement | A deterministic operating signal snapshot produced from fixtures and mapped into a closed public signal family. | Not LLM final ranking, customer-facing commitment, cross-workspace aggregation, or business decision authority. |
| Evidence | Checked-in public sample fixtures, payload examples, and evidence references that can be validated by fixture checks and evals. | Not real customer data, production connector output, raw logs, secrets, or private deployment evidence. |
| Review | A prepared review packet with evidence references, risks, missing information, allowed next surface, forbidden actions, and human-reviewer requirement. | Not approval, send, write-back, auto-approval, or authority to execute. |
| Boundary | A machine-checkable limit around forbidden actions, sensitive values, tenant projection, and commitment escalation. | Not a plugin sandbox, production authorization engine, complete enterprise auth, or overrideable prompt. |
| Delivery package | A public sample / Pack-shaped directory with manifest, synthetic fixtures, mapper, eval cases, packet templates, and implementation checklist that passes the public Core checks. | Not a marketplace listing, runtime installable artifact, certified partner deliverable, or customer deployment-ready proof. |
| Forkable engineering structure | A cloneable offline structure that can run doctor, fixture checks, public-release guard, and evals without private context or credentials. | Not hosted service, one-click production deployment, runtime marketplace, or mirror of private monorepo context. |

## 3. Delivery Engineer Gates

The minute labels are navigation aids, not SLA, onboarding promises, production
readiness, or customer deployment commitments.

| Gate | Delivery-engineer question | Passing evidence | Explicit non-claim |
|---|---|---|---|
| Gate-10, nominal first trust | "Can I trust the shape of this repo?" | `npm run delivery:doctor` and `npm run pack:fixture-check` pass with zero failures. For China-region delivery preflight, `npm run delivery:doctor -- --region cn` reports no unexpected warnings for local profile / mirror / ASR configuration. | Does not prove SDK cleanliness, customer deployment readiness, production region approval, or complete sample provenance. |
| Gate-30, nominal edit loop | "Do I know where to make the first business change?" | README points to the Golden Path, `case-management-sample` has a minimal edit loop, and the HSI eval path is visible. D2 fresh-clone receipts can support Docker onboarding evidence, but they do not become release approval. | Does not prove a time-bound onboarding guarantee, live connector readiness, or production deployment. |
| Gate-60, nominal review proof | "Can I prove the fork stays inside review-first boundaries?" | HSI and operating-signal evals pass, forbidden actions remain rejected, and a review packet can be prepared from checked-in public sample artifacts. | Does not approve a pilot, send anything externally, write CRM state, or certify a customer Pack. |

## 4. Golden Path Chain

The first version uses existing assets only:

1. Clone the public Core repository.
2. Start the local Core with Docker quickstart or the standard local dev path.
3. Inspect `/demo` and the public sample pack.
4. Open `extensions/case-management-sample/fixtures/case.sample.json`.
5. Make a synthetic fixture change.
6. Run the existing checks:

```bash
npm run delivery:doctor
npm run delivery:doctor -- --region cn
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run check:public-release
```

7. Inspect the produced signal / review packet path and confirm that forbidden
   write, send, approve, execute, and cross-tenant paths stay blocked.

The README and sample documentation must provide a concrete "change this line ->
run this command -> observe this change" walkthrough without adding a new route,
page, package, or command.

## 5. Requirements

| ID | Requirement | Repo | Status |
|---|---|---|---|
| R1 | Replace public links that point to the frozen legacy source repository with `Helm-OpenSource/helm-public`, except migration provenance records. Remove placeholder partner contact values from public entry points. | `helm-public` | Required first slice |
| R2 | Rewrite public roadmap and first-read public text into gate-relative Now / Next / Later. Remove version-date launch promises from public-facing copy. | `helm-public` | Required first slice |
| R3 | Document the visibility gate and state that the repository remains private until manual owner Go/No-Go. | `helm-public` + owner | Covered by this document; flip is out of scope |
| R4 | Make README's first delivery-engineer path the Golden Path and surface `delivery:doctor`, `pack:fixture-check`, `check:public-release`, and HSI eval early. | `helm-public` | Required first slice |
| R5 | Add a Builder walkthrough on existing `/demo`, `case-management-sample`, and existing commands. | `helm-public` | Required second slice |
| R6 | Label `case-management-sample` as a synthetic public sample pack with provenance under review until the synthetic evidence gate is signed off. | `helm-public` | Required second slice |
| R7 | Add fork-and-rename guidance, a standalone "what Helm does not do" page, and a forker upgrade story. | `helm-public` | Required second slice |
| R8 | Add a read-only split doctor for Core / Pack / Overlay / Control Plane SHAs, BOM pin, readiness, reverse dependency, and Actions startability. | `helm-control-plane` | Out of repo; separate PR |
| R9 | Clean one real NPA Pack into a Pack SDK shape without pulling tenant logic into Core. | `helm-packs` | Deferred until external forker validation or owner instruction |

## 6. Visibility Gate

Repository visibility must not be changed by this requirements workstream.

Visibility flip order:

1. Owner rotates or revokes exposed credentials.
2. HEAD-level `check:public-release` and secret-history checks are green.
3. T17 history remediation produces a clean history receipt.
4. The rewritten history is scanned again and remains green.
5. Release checks pass with a human-readable receipt.
6. Owner gives manual Go/No-Go using the founder / owner identity.
7. Only then may repository visibility be flipped.

Any failed step is a No-Go.

## 7. Synthetic Provenance Gate

Do not claim `100% synthetic` until all conditions below are true:

1. Each public fixture has a provenance declaration stating that it is generated
   synthetic data, not real data with redaction.
2. `npm run check:public-release` passes.
3. `npm run pack:fixture-check` passes.
4. Negative provenance review finds no fields copied from tenant-private trees,
   customer overlays, private domains, internal IPs, credentials, or customer
   deployment receipts.
5. Owner signs off the provenance claim.

Before all conditions are true, public wording must use:

> synthetic public sample pack, provenance under review

If a sample is redacted from real data, it must be labeled `redacted sample`, not
`synthetic`.

## 8. No-Go

- No automatic repository visibility flip.
- No new route, page, package, command, API, schema, or runtime in the first
  Golden Path slice.
- No auto-send, auto-approve, auto-execute, auto-write, or settlement.
- No runtime marketplace, workflow engine, orchestration platform, hosted agent
  runtime, MCP runtime, plugin sandbox, or complete enterprise auth claim.
- No production SLA, production-ready claim, release-ready claim, or customer
  deployment approval.
- No real customer data, real employee data, private domain, internal IP,
  credential, tenant slug, or private deployment detail in public paths.
- No Core dependency on Pack or Overlay.
- No industry Pack implementation, customer Overlay configuration, BOM registry,
  Pack authorization, or deployment health metadata inside `helm-public`.
- No LLM final ranking or commitment escalation path.

## 9. Acceptance Commands

All commands below already exist. This workstream must not introduce a new
command merely to prove the first Golden Path slice.

```bash
npm run delivery:doctor
npm run delivery:doctor -- --region cn
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
npm run self-check
```

Machine-checkable acceptance:

- This document is listed in `lib/delivery-engineer/golden-path-doctor.ts`
  `REQUIRED_FILES`.
- This document is listed in `docs/public-docs-manifest.json`.
- `docs/README.md` and `docs/STATUS.md` link to this document.
- `delivery:doctor` passes with zero failures.
- `pack:fixture-check` passes with zero failures.
- HSI and operating-signal evals keep forbidden action, sensitive data,
  cross-tenant projection, and LLM commitment incidents at zero.
- `check:public-release` reports zero blockers before any public visibility
  claim.

## 10. Known Gap

The most important missing signal for an external delivery engineer is the
negative mapping path:

> If I map my own source fields into fixtures incorrectly, where does Helm show
> me the difference between a valid sample, a boundary attempt, and sensitive
> data that must be removed?

The current Core proves that the included sample pack is self-consistent. It does
not yet prove that every fork-created Pack directory is scanned for sensitive
markers or that every new mapper has a ready-made negative path. That belongs in
the R5 / R7 follow-up docs and must be described as Next, not as already done.

## 11. Claude Cross-Check Log

- Round 1, adversarial review: accepted the north star but warned that
  "delivery package" and "business implementation" can be mistaken for runtime
  workflow, approval, marketplace, or customer deployment authority. Result:
  definitions and No-Go sections explicitly separate preparation from execution.
- Round 2, delivery-engineer proponent review: recommended the minimal v1 scope
  as one requirements document plus existing doctor / manifest wiring, with no
  new surface. Result: this document treats existing doctor, fixture check,
  public-release guard, and offline evals as the executable Golden Path.
- Round 3, post-draft review: accepted the requirements, roadmap rewrite,
  AGENTS boundary, doctor / manifest / docs index / STATUS wiring, and public
  safety posture. It required follow-up edits to remove remaining customer-facing
  time promises from the homepage and English README before verification.

## 12. Change Log

| Date | Change |
|---|---|
| 2026-06-01 | Initial public Core Golden Path requirements created from DEF spec, repo truth, and Claude cross-check rounds. |
