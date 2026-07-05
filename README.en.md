> **Language / 语言**：**English** · [中文](README.md)

# Helm

### Turn scattered enterprise operating signals into reviewable judgment, risk, next actions, and delivery loops.

> Helm is an open-source Core for enterprise leaders, AI delivery engineers, and enterprise AI operations teams.
>
> It does not let AI run the business, and it does not automate executive decisions. Helm helps teams see what is happening, who needs to decide, where the risk is, what should move next, and which actions must never become automatic commitments.

**License**: Apache-2.0 · **Repository posture**: open-source Core, public after owner Go/No-Go · **Helm Cloud / Enterprise**: optional commercial editions; do not replace open source

> **Fastest way to understand it**: leaders should start with "why it matters" and the method below; delivery engineers can run `docker compose up` and the Golden Path; partners can evaluate consulting / delivery fit with public sample data only.

---

## One-line positioning

> **Helm is an open-source reference implementation + method for "operating signals -> AI-assisted judgment -> human review -> traceable execution."**
>
> Generic agent platforms tell you how to assemble. Helm helps turn enterprise AI pilots and customer delivery work into forkable, verifiable engineering structures for judgment, evidence, review, boundaries, and delivery packages.

Full argument: [HELM_FOR_DELIVERY_ENGINEERS_V1.en.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md).

Public-safe requirements for the current business narrative:
[HELM_PUBLIC_BUSINESS_NARRATIVE_REQUIREMENTS.md](docs/product/HELM_PUBLIC_BUSINESS_NARRATIVE_REQUIREMENTS.md).
Helm may enter through compliant sales-process signals and turn them into Sales
Process Intelligence, AI Diagnostic, ecosystem delivery, and industry Pack
compounding; it must not be described as a headset company, AI reseller, CRM
replacement, or outsourcing company.
The Trust Center / AI Shelf public-safe synthetic contract is checked by
`docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json` and
`npm run check:ai-shelf-trust-center-contract`; it is not legal advice,
supplier certification, reseller authorization, customer deployment, or a
production receipt.

---

## Why enterprise leaders should care

The hardest part of an enterprise AI pilot is often not model capability. It is that operating signals do not become action:

- Customer feedback, sales signals, project risks, meeting commitments, and delivery blockers are scattered across systems.
- Management sees late summaries, not the decisions that must move today.
- AI can generate suggestions, but often cannot show evidence, boundary, owner, and next step.
- Teams fear auto-send, auto-commitment, and permission overreach, so AI pilots stall at demo level.

Helm turns those signals into a reviewable operating loop: **see the real state, form judgment, route it through human review, move the next action, and keep evidence.**

---

## The Helm method

1. **Collect operating signals**: customer communication, CRM, meetings, email, project progress, risk feedback, external leads.
2. **Structure business objects**: customer, opportunity, project, fact, commitment, blocker, risk, next action.
3. **Form judgment candidates**: today's top 3-5 moves, reason, evidence, impact, and boundary.
4. **Route through human review**: customer-visible actions, commitments, CRM stage changes, and high-risk suggestions require explicit review.
5. **Preserve delivery evidence**: each judgment, recommendation, boundary, and action carries traceable evidence for review and reuse.

The goal is not "AI runs the company." The goal is more timely, controlled, and reviewable business execution.

---

## How it supports GTM: turning interest into verifiable capability

Helm's GTM goal is not to create sales language first. It is to let each role use the same evidence path to make a decision:

| GTM audience | What they need to believe | README conversion action |
|---|---|---|
| **Enterprise leader** | AI is not only a demo; it can enter operating execution, risk sensing, and review loops | Open the 90-second demo and judge fit for AI pilot governance and operating execution |
| **Delivery engineer** | Helm is not a black-box product; it is a forkable, editable, verifiable delivery asset | Run the Golden Path, change one synthetic fixture, and prove boundaries still hold |
| **AI consulting / delivery partner** | Helm can become method, case material, assets, and follow-on service capability | Evaluate partnership fit with public-safe scenarios, without putting customer details in public GitHub |
| **Open-source contributor** | Contribution paths are clear and bounded away from commercial or customer-private material | Start with docs, fixtures, read-only connectors, dry-runs, and public-safe issues |

The market capability to build is: **turn "I am interested in AI operating execution" into "I can try it with public samples, judge whether it fits, know how to contact you, and continue into controlled partnership evaluation."**

---

## What it solves (delivery engineer view)

Generic agent platforms and LLM frameworks solve "how to assemble." Three things still fall on the delivery team:

1. **What to assemble** — the real enterprise need is "today's 3 calls a human must make + why + boundary," not a chat box
2. **How not to blow it** — AI overreach, auto-commitment, cross-tenant data leakage — the platform doesn't carry these; your customer does
3. **How to ship faster** — modeling from scratch per customer, building review gates, writing connectors, shipping dashboards — burns through your person-months

Helm **encodes these three answers into an open-source reference implementation**.

---

## How to start

| Who you are | Recommended path |
|---|---|
| **Enterprise leader / operator** | Open the 90-second demo and judge whether Helm fits AI pilot governance, operating execution, and delivery review |
| **Delivery engineer** | Run the Golden Path, change one synthetic fixture, and verify judgment / evidence / review / boundary still hold |
| **AI consulting / delivery partner** | Evaluate fit with public sample data; keep customer-specific details private and abstracted |
| **Open-source contributor** | Start with docs corrections, Golden Path feedback, read-only connectors, fixtures, and dry-run boundaries |

---

## 90 seconds to see Helm

```bash
git clone https://github.com/Helm-OpenSource/helm-public.git
cd helm-public
cp .env.example .env       # Local MySQL by default
docker compose up          # mysql:8.4 + app
open http://localhost:3000
```

First screen: `/operating` (operating signal flow map), `/approvals` (review gate), `/memory` (operating memory) — three already-working surfaces.

> The demo uses public synthetic data. It does not represent real customer business flow. Do not put customer data, private domains, production logs, deployment evidence, or internal project information into public channels.

> Requires local Docker Desktop / OrbStack / colima. Boots the minimal set (no connectors, no AI, no payments).
> Mainland China / restricted-network environments can configure local npm and
> Docker mirrors first: `cp .npmrc.example .npmrc`, then run
> `NPM_REGISTRY=https://registry.npmmirror.com docker compose up --build`.
> Docker Hub base images still require an organization-approved registry mirror
> in your Docker daemon. See [getting-started.en.md §1.1](docs/getting-started.en.md#11-mainland-china--restricted-network-setup-optional).

## Delivery Engineer Golden Path

This path answers three questions: can I trust the boundaries, where do I make the first change, and can I prove the fork remains review-first? It reuses existing surfaces; it does not add pages, packages, or commands.

```bash
npm run delivery:doctor
npm run delivery:doctor -- --region cn   # local static preflight before China customer delivery
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run check:public-release
```

Minimal edit entry:

1. Open `extensions/case-management-sample/fixtures/case.sample.json`.
2. Change one synthetic fixture.
3. Run `npm run pack:fixture-check` and `npm run eval:headless-signal-interface`.
4. Return to `/demo` / `/operating` and confirm judgement, evidence, review, and boundaries stay review-first.

Golden Path acceptance: see [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md). `extensions/case-management-sample/` provides a readable / editable public sample pack. Docker / fresh-clone evidence is governed by review receipts and gates, not date promises.

---

## When Helm is a good fit

| Good fit | Not a fit yet |
|---|---|
| You have AI pilots but lack operating execution, review, and evidence loops | You only need a generic chatbot |
| Consulting / delivery teams need to turn AI demos into managed delivery systems | You only need generic BI dashboards or one-off summaries |
| Customers worry about auto-commitment, auto-send, and permission overreach | You need AI to auto-approve, auto-send, or decide for humans |
| Teams need to connect CRM, meetings, email, and IM operating signals | You need full enterprise SSO / SCIM / multi-tenant platform immediately |
| You need judgment, evidence, review, and boundary as forkable engineering assets | You need a third-party plugin marketplace or complete workflow engine |

---

## Helm vs AI agent platform / LLM framework

|  | AI agent platform<br/>(Coze / Wukong / Dify) | LLM framework<br/>(LangGraph / LangChain) | **Helm** |
|---|---|---|---|
| Abstraction | Drag-and-drop / DAG editor | SDK + primitives | **Opinionated complete system + blueprint** |
| What you get | Bricks + config panel | Abstract classes + utilities | **Working operations loop + vertical reference impl** |
| Business domain knowledge | You bring it | You bring it | **Built-in: signals / cases / loops / review modeled** |
| Advice vs Commitment boundary | Depends on your config | Depends on your code | **Encoded as hard constraint in eval gates** |
| Multi-tenant isolation | Platform layer (black box) | DIY | **Deployment Profile + Tenant Overlay 4-layer cut already designed** |
| Chinese-locale connector | Partial | DIY | **DingTalk / IMAP / Aliyun Mail / Qwen built-in working samples** |
| Fully forkable? | Varies (Dify is self-hostable; hosted platforms usually lock you in) | Yes (no vertical) | **Yes (Apache-2.0 + vertical pack)** |
| Forkable local loop? | No | No | **`docker compose up` + Golden Path checks** |
| Commercial model (for you) | Platform takes a cut / their channel | You set your price | **open-core**: fork it, sell it commercially. Helm Inc. doesn't take a cut |

> This table compares **types**, not specific products' current feature checklists; platforms keep evolving. The contrast is in abstraction level and product shape. [Dify's official docs](https://docs.dify.ai/) emphasize its open-source / self-hostable posture; this table compares Dify as a visual AI application platform, not as a closed-source locked platform.

---

## 5 steps to local dev

```bash
npm install                   # 1. install deps
cp .env.example .env          # 2. configure env
npm run db:generate && npm run db:migrate && npm run db:seed   # 3. database
npm run dev                   # 4. start
open http://localhost:3000    # 5. open
```

More detail in [docs/getting-started.en.md](docs/getting-started.en.md).

`.env.example` has three tiers:

| Tier | Fields | Notes |
|---|---|---|
| **MUST** | `DATABASE_URL`, `APP_URL`, `CONNECTOR_TOKEN_SECRET` | Minimum to boot |
| **OPTIONAL_AI** | `OPENAI_API_KEY`, `DASHSCOPE_API_KEY`, `DASHSCOPE_BASE_URL`, `LLM_*` | Missing values become placeholders + banner; no crash |
| **OPTIONAL_CONNECTORS** | DingTalk · WeCom · HubSpot · Salesforce · Stripe · Alipay · WeChat Pay | Enable as needed |

---

## What's in the reference implementation

> These surfaces are part of Helm's reference implementation. After forking, you can modify, remove, or extend any of them.

| Route | Role |
|---|---|
| `/dashboard` | Today's 3 calls a human must make |
| `/mobile` | Mobile narrow-screen operations push entry + Ask Helm |
| `/operating` | Operating board: judgment / decision / boundary, three layers |
| `/approvals` | Customer-visible drafts and CRM stage changes wait here for your click |
| `/memory` | Operating memory: facts, commitments, blockers, corrections — citable, reviewable; unified trace timeline remains a release hard gate |
| `/search?mode=ask` | Object navigation, or ask Helm directly (read-only, with citations) |
| `/setup` | 6-step / 12-min setup; first judgment card in 5 min |
| `/capture` | Press to record → 60-min meeting → 90s candidate generation (facts / commitments / follow-ups); high-risk items go to review |
| `/reports` | Weekly recap: last 2 weeks at a glance + next week's focus |
| `/settings` | Workspace console: connectors, policies, pilot mode, retention, self-serve export |
| `/health` | User-visible degraded surface: DB / LLM / connector / capture / audit trace |

**Tech stack**: Next.js 16 (App Router) + React 19 · MySQL + Prisma · Tailwind CSS 4 + Radix UI · TypeScript (strict mode) · Vitest + Playwright

---

## Wiring up the systems your customers already use

> **Wiring up your customer's existing systems is your core delivery action — this layer gives you the template.**
> Keep the systems your customer already uses. Helm grows "what to do today" on top of them.

### Already supported

> Status: **Stable** = main path works, degrades visibly without credentials. **Alpha** = minimum loop in place, but still depends on config / sample data / further hardening. **Roadmap** = placeholder exists, not enabled by default.

| Type | System | Status | Notes |
|---|---|---|---|
| **CRM** | HubSpot | Stable | Read-only sync + operating signal layer |
| **CRM** | Salesforce | Alpha | Defaults to `authMode=MOCK` with sample data; switches on real OAuth |
| **Enterprise IM** | DingTalk | Stable | OAuth + Directory; directory invitations go through the review gate, never auto-sent |
| **Enterprise IM** | WeCom | Alpha | OAuth callback foundation + read-only meeting ingest; calendar / message / send remain bounded |
| **Email** | Gmail | Stable | OAuth + IMAP read; outbound goes through review |
| **Email** | Aliyun Mail | Stable | IMAP sync + system SMTP (manual explicit send) |
| **Meetings** | Recording / transcript / operating intent | Alpha | Browser-recorded MVP + external transcript ingest + OpenAI / DashScope (Qwen) ASR; not a real-time meeting platform, no native Zoom / Tencent Meeting audio |
| **Payments** | Stripe | Stable | Real API (subscription / payment link) |
| **Payments** | Alipay | Stable | Real gateway + RSA-SHA256 signature |
| **Payments** | WeChat Pay | Alpha | Adapter in place; ops needs to confirm keys and callbacks before production |
| **LLM** | OpenAI-compatible / local Gemma | Stable | provider=`openai`; point `LLM_BASE_URL` at any OpenAI-compatible endpoint |
| **LLM** | Qwen (Aliyun DashScope) | Stable | provider=`qwen`; default model `qwen3.6-plus`, default endpoint `https://dashscope.aliyuncs.com/compatible-mode/v1` |

### Roadmap — public contribution welcome

> **How to contribute**: open an issue with the `integration: <system>` label. State the customer use case / data flow / governance boundary first, then write code.

#### 🔥 P0 · only the initial push-loop entries

| System | Expected capability |
|---|---|
| Feishu / Lark | OAuth · Bitable read · message draft (review-first) |
| Microsoft 365 (Teams + Outlook + Calendar) | Calendar pull · Teams capture · Outlook draft |
| Google Workspace (Calendar + Gmail + Drive) | Calendar pull · Gmail thread · Drive doc reference |
| Slack | Channel digest · draft message (review-first) |
| Zoom | Recording / transcript ingest; not committing to real-time meeting platform replacement |

#### 🧭 Issue-driven candidate pool

Pipedrive, Zoho, Dynamics, Notion, Coda, Tencent Meeting, Webex, Yonyou, Kingdee, HRIS, Jira, GitHub, telephony, tax, cash flow — file `integration:` issues. We'll judge whether they serve the initial "meeting / CRM / mail → Must Push → Review Action" loop; no roadmap commitment.

#### ⭐ Acceptable PR scope

| Type | Allowed |
|---|---|
| Read-only connector | read-only ingest, fixtures, dry-run, boundary docs |
| Draft-style capability | draft / preview / review-first, never auto-send |
| Evidence-layer adapter | enters evidence candidate, never directly into Must Push truth |

### 5 integration principles

1. **Human review, boundary first**: `integration:` issues are reviewed at the public community pace; response targets live in the operations docs and do not create roadmap or implementation commitments.
2. **3 clear boundaries**: every integration ships with a public "auto / review / human-only" matrix.
3. **Never send for you**: every customer-visible action waits for a user click. This line never moves.
4. **Data portability**: all ingested data is exportable from `/settings` in one click.
5. **Audit trace**: critical integration actions carry trace IDs; the unified user-visible trace timeline remains a release hard gate, and we will not market "0-second replay" until it lands.

### Integration template

[`docs/integrations/INTEGRATION_TEMPLATE.md`](docs/integrations/INTEGRATION_TEMPLATE.md) (released with v0.1.0) covers:

- Data flow declaration template
- Boundary three-track matrix (auto / review / never)
- OAuth + API key security checklist
- Test fixtures + dry-run mode
- User-visible naming convention
- Exit + data reclamation

### Contact

| Channel | Purpose |
|---|---|
| GitHub Issues `integration:` label | Public call / roadmap discussion |
| [GitHub Discussions](https://github.com/Helm-OpenSource/helm-public/discussions) | Community Q&A, blockers, vertical co-building |
| Certified Delivery Partner issue | Commercial partnerships / co-launch (not the default entry; go through Discussions or issue first) |
| [docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md) | Open source / commercial boundary |

---

## Deliberately out of scope

- Full enterprise SSO / SCIM / multi-tenant platform
- Full workflow / orchestration / agent orchestration engine
- Full BI / reporting hub
- Auto-execute · auto-approve · auto-settle · auto-send
- Plugin marketplace · App store
- Third-party plugin runtime / sandbox; current extension seam only serves first-party / private-tenant extensions
- Multi-turn chat history persistence · cross-workspace auto-aggregation
- LLM as final ranker on commitment paths
- SaaS direct sales to end customers (Helm Inc. keeps only a small set of named direct lighthouse engagements to harden the methodology and industry Packs; beyond those named engagements it does not compete with delivery engineers)

---

## Core discipline: Recommendation ≠ Commitment

- **Recommendation**: a system-generated suggestion; requires human review.
- **Commitment**: a formal action with business impact; requires explicit authorization.
- Any customer-visible wording that could be misread as commitment is explicitly demoted to "boundary note / prerequisite / dependency / non-commitment note."

This is not a commercial promise; it is an **auditable constraint enforced by code + eval**: the `OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` closed set, `commitment: "suggestion_only"` hard-coded, `crossTenantProjection: false` eval rejection. External commercial commitments still require human authorization and contract terms.

Details: [AGENTS.md §6-§7](AGENTS.md), [lib/operating-signal-flow/contract.ts](lib/operating-signal-flow/contract.ts).

---

## Roadmap

**Now**
- Public Core, Docker quickstart, case-management sample pack, Golden Path doctor, offline evals, public-release guard.
- Repo split boundary: Core stays in this repository; industry Packs, customer Overlays, and BOM / authorization / deployment metadata move through their corresponding private target repositories, not Public Core.
- Repository visibility is public after the owner Go/No-Go; future release, tag, and announcement changes remain owner-gated.
- README, governance docs, `.env.example` tiers, `docker-compose.yml`, and local mirror guidance for Mainland China / restricted networks.

**Next**
- Remove frozen legacy repository links and date-style release copy from public entry points.
- Document the Builder walkthrough as "change this line -> run this command -> observe this change".
- Complete the sample provenance gate, fork-and-rename guide, "what Helm does not do", and forker upgrade story.
- Add a read-only split doctor in the corresponding governance repository, aggregating Core / Pack / Overlay / BOM readiness.
- Continue degraded-mode health surface, Required Reviewer review, redacted live DB calibration, and production deployment runbook / image boundaries.

**Later**
- Community-contributed vertical pack collaboration (open-source vertical vs tenant-private boundary)
- Helm Cloud (hosted) public beta
- Helm Enterprise private deployment template
- Full production-grade SSO / SCIM (triggered by customer compliance requirements)
- BI report capability (extend on demand; no platform ambition)

Details: [docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md).

---

## Documentation navigation

| Document | Role |
|---|---|
| **[docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md)** | **Root positioning: one-pager for delivery engineers + differentiation table + forkable Core anchor** |
| **[docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)** | **Golden Path: forkable engineering requirements and gates for judgement / evidence / review / boundaries / delivery packages** |
| [docs/getting-started.en.md](docs/getting-started.en.md) | Developer quickstart (English) |
| [docs/getting-started.md](docs/getting-started.md) | Developer quickstart (Chinese) |
| [AGENTS.md](AGENTS.md) | Long-term repo execution rules, hard boundaries, validation chain |
| [DESIGN.md](DESIGN.md) | Visual + UI baseline |
| [WORKING-CONTEXT.md](WORKING-CONTEXT.md) | Active queue + near-term constraints |
| [GOVERNANCE.md](GOVERNANCE.md) | Open-source governance, scope control, release + certification boundary |
| [CONTRIBUTING.en.md](CONTRIBUTING.en.md) | Contribution guide (English) |
| [docs/README.md](docs/README.md) | Full documentation index (Chinese) |
| [docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md) | Open source / commercial / partner boundary |
| [docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) | Certified Delivery Partner / Connector / Workflow Pack certification checklist |
| [docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) | Public trial data policy |
| [docs/operations/ON_CALL_AND_RESPONSE_SLA.md](docs/operations/ON_CALL_AND_RESPONSE_SLA.md) | Early-landing-partner response + on-call policy |
| [docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md](docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md) | Public commitments, release hard gates, scope demotion |

---

## Validation chain

Non-trivial changes should pass:

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

Before public release also run:

```bash
npm run check:public-release
npm run check:secret-history
npm run release:check
```

Details: [AGENTS.md §10](AGENTS.md).

---

## Contributing

- ✅ Welcome: bug fixes, doc revisions, test coverage, localization, read-only connectors, accessibility.
- ⚠️ Please open an issue first: schema changes, introducing auto-write / auto-send, expanding sandbox / marketplace / orchestration platform capability.
- 🧩 Integration ideas: use the `integration: <system>` label.
- 🎯 Want to become a **Certified Delivery Partner**? See [docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md).

Details: [CONTRIBUTING.en.md](CONTRIBUTING.en.md) · participation implies agreement with [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Early-landing partner path (not the default CTA)

> **The main path is fork + self-host + Golden Path checks.** The early-landing partner path is only a backup for design partners who need Helm-team-led hands-on support. If you're a potential Helm Inc. partner, look at [Certified Delivery Partner](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) first; pilot engagement is reserved for cases where Certified doesn't fit.

Early partnership starts from a public-safe operating scenario, not a feature checklist:

1. Describe the operating signal source using public sample data or an abstracted customer scenario.
2. State which judgments need AI assistance and which actions require human review.
3. Use the Golden Path to verify judgment / evidence / review / boundary.
4. Then discuss whether Certified Delivery Partner, private deployment, Cloud, or Enterprise fits.

| Evaluation question | What to inspect |
|---|---|
| Does it improve operating execution? | Must Push adoption, 48h follow-up completion, manager review time |
| Does it preserve boundaries? | wrong-commitment incident, customer-visible review rate, zero unauthorized outbound action |
| Can delivery reuse it? | sample pack forkability, editable fixtures, reviewable delivery evidence |
| Is partnership a fit? | whether a consulting / delivery partner can turn it into method, assets, cases, and follow-on service capability |

Customer data, private domains, production logs, deployment evidence, commercial terms, and real project details do not belong in public GitHub. Keep them private and abstracted through an owner-approved private path.

---

## Security

Please do not disclose undisclosed security issues in public channels. See [SECURITY.md](SECURITY.md) for private disclosure.

---

## License

[Apache-2.0](LICENSE) · [NOTICE](NOTICE) · third-party deps retain their own licenses

---

## Get involved

| Entry | Purpose |
|---|---|
| **🚀 `git clone` + `docker compose up`** | Core surfaces running locally; fork your customer vertical from `extensions/case-management-sample/` |
| **💬 [GitHub Discussions](https://github.com/Helm-OpenSource/helm-public/discussions)** | Community Q&A, vertical co-building, blocker support |
| **🎯 [Certified Delivery Partner](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)** | Delivery certification, brand endorsement, case-study co-building |
| **☁️ Helm Cloud (hosted)** | Optional; does not replace open source; for delivery engineers / customers who don't want to self-host |

> **Goal: help delivery engineers turn judgement, evidence, review, boundaries, and delivery packages inside customer implementation work into a forkable engineering structure.**
