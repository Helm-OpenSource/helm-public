> **Language / 语言**：**English** · [中文](README.md)

# Helm

### AI platforms hand you LEGO bricks. Helm is an assembled, customizable, boundary-aware **business operations loop reference implementation**.

> For delivery engineers building B2B operations systems on top of Coze / Alibaba Wukong / Dify / LangGraph / general agent platforms.
>
> Generic platforms tell you "how to assemble." Helm tells you "what to assemble, how not to blow it, and how to ship the first controlled customer in about 4 weeks when prerequisites are met" — and writes the answers as forkable code.

**License**: Apache-2.0 · **First public release**: `v0.1.0-trial` (planned 2026-05-31) · **Helm Cloud / Enterprise**: optional commercial editions; do not replace open source

> **Not an engineer?** First read the one-pager positioning at [docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md); or after running the repo, open `/demo` (about 90 seconds, no email required).

---

## One-line positioning

> **Helm is not another agent platform, nor an LLM framework. It is a reference implementation + methodology for B2B business operations, with full boundary discipline, built to help delivery engineers ship the first controlled customer in about 4 weeks when prerequisites are met.**

Full argument: [HELM_FOR_DELIVERY_ENGINEERS_V1.en.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md).

---

## What it solves (delivery engineer view)

Generic agent platforms and LLM frameworks solve "how to assemble." Three things they don't carry for you:

1. **What to assemble** — the real B2B need is "today's 3 calls a human must make + why + boundary," not a chat box
2. **How not to blow it** — AI overreach, auto-commitment, cross-tenant data leakage — the platform doesn't carry these; your customer does
3. **How to ship faster** — modeling from scratch per customer, building review gates, writing connectors, shipping dashboards — burns through your person-months

Helm **encodes these three answers into an open-source reference implementation**.

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
| 30-minute full loop? | No | No | **`docker compose up`** |
| Commercial model (for you) | Platform takes a cut / their channel | You set your price | **open-core**: fork it, sell it commercially. Helm Inc. doesn't take a cut |

> This table compares **types**, not specific products' current feature checklists; platforms keep evolving. The contrast is in abstraction level and product shape. [Dify's official docs](https://docs.dify.ai/) emphasize its open-source / self-hostable posture; this table compares Dify as a visual AI application platform, not as a closed-source locked platform.

---

## 90 seconds to see Helm

```bash
git clone https://github.com/Helm-OpenSource/helm-public.git
cd helm
cp .env.example .env       # Local MySQL by default
docker compose up          # mysql:8.4 + app
open http://localhost:3000
```

First screen: `/operating` (operating signal flow map), `/approvals` (review gate), `/memory` (operating memory) — three already-working surfaces.

> **⚠️ Phase 2 fixture demo**: `/operating` currently shows synthetic fixture data and does not represent live tenant business flow. DPO review and founder-attested 5-role signoff are recorded, but route adoption is still locked until Engineering / Product / Security / Operations per-role receipts are attached. The current shadow probe is Phase 1.5 day-2 dogfood proxy only. See [`docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md`](docs/product/HELM_OPERATING_SIGNAL_FLOW_MAP_REQUIREMENTS.md).

> Requires local Docker Desktop / OrbStack / colima. Boots the minimal set (no connectors, no AI, no payments).

Full 30-minute onboarding: see [HELM_FOR_DELIVERY_ENGINEERS_V1.en.md §30-minute onboarding anchor](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md#30-minute-onboarding-anchor); `extensions/case-management-sample/` now provides a readable / editable minimum public vertical reference plus a worker / BI cookbook minimum slice. Docker / fresh-clone onboarding still needs v0.1 release-track verification.

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
| **Meetings** | Recording / transcript / operating intent | Alpha | Browser-recorded MVP + external transcript ingest + OpenAI ASR; not a real-time meeting platform, no native Zoom / Tencent Meeting audio |
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

### 5 commitments to integrators

1. **Response within 7 business days**: we aim to reply to `integration:` issues within 7 business days, but never commit to a roadmap or shipment.
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
| [GitHub Issues](https://github.com/Helm-OpenSource/helm-public/issues) | Public issue tracker, blockers, vertical co-building |
| `partners@helm.<domain>` | Commercial partnerships / co-launch (not the default entry; open an issue first) |
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
- SaaS direct sales to end customers (Helm Inc. does not compete with delivery engineers)

---

## Core discipline: Recommendation ≠ Commitment

- **Recommendation**: a system-generated suggestion; requires human review.
- **Commitment**: a formal action with business impact; requires explicit authorization.
- Any customer-visible wording that could be misread as commitment is explicitly demoted to "boundary note / prerequisite / dependency / non-commitment note."

This is not a commercial promise; it is an **auditable constraint enforced by code + eval**: the `OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` closed set, `commitment: "suggestion_only"` hard-coded, `crossTenantProjection: false` eval rejection. External commercial commitments still require human authorization and contract terms.

Details: [AGENTS.md §6-§7](AGENTS.md), [lib/operating-signal-flow/contract.ts](lib/operating-signal-flow/contract.ts).

---

## Roadmap

**Now (2026-05)**
- May open-source + public release prep (`v0.1.0-trial`, target 2026-05-31); must pass release hard gates
- Release hard gates: RDS credential rotation + history remediation, on-call response policy, public commitment demotion, trace public posture safety
- **`extensions/case-management-sample/`** vertical reference implementation extraction (sanitized from tenant-private vertical pack)
- **Positioning collateral ready by 5-31**: 1-pager (done) · `docker compose up` 30-min onboarding verification · 1 vertical cookbook · short demo video
- Phase 3 runtime adoption limited unblock (TPQR-001 / TPQR-003 / TPQR-004 only)
- README · governance docs · `.env.example` tiering · `docker-compose.yml`

**Next 30 days**
- `/mobile` first-screen Must Push data source swap (read-first → adapter, feature-flag controlled)
- Ask Helm asset capture lands (writes `MemoryCandidate` / `SkillSuggestion`, review-first)
- Retention status display + self-serve export (settings / billing card)
- Degraded-mode health surface: visible failure of connector / LLM / DB / capture
- 5-role Required Reviewer assessment + redacted live DB calibration

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
| **[docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md)** | **Root positioning: one-pager for delivery engineers + differentiation table + 30-min onboarding anchor** |
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

> **The main path is fork + self-host + 30-minute onboarding for delivery engineers.** The early-landing partner path is only a backup for design partners who need Helm-team-led hands-on support. If you're a potential Helm Inc. partner, look at [Certified Delivery Partner](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) first; pilot engagement is reserved for cases where Certified doesn't fit.

| Target | Acceptance |
|---|---|
| Apply → first response | Target **1 business day**; governed by [ON_CALL_AND_RESPONSE_SLA.md](docs/operations/ON_CALL_AND_RESPONSE_SLA.md) |
| Approved → first 1:1 | Target **within 7 days**; depends on the mutually confirmed pilot window |
| Setup → first card | Target **5 minutes**; the card must include evidence / reason / boundary |
| Full setup wizard | Target **6 steps / 12 min**; failures must show a recoverable reason |
| 60-min meeting → facts / commitments / follow-up drafts | Target **90 seconds to candidate**; adoption rate, wrong-commitment incidents, audit coverage are pilot quality gates |
| Connect CRM → today's calls | Target **10 minutes to 3-5 Must Push candidates**; unavailable connectors degrade visibly and do not fabricate signals |
| Integration issue → human reply | Target **within 7 business days**; no roadmap or implementation commitment |
| Public trial retention | Governed by the workspace trial contract + effective data policy; `30-day active + 7-day grace` remains a legal-review target |
| Self-serve export | Workspace first-party data from `/settings`; third-party source-system data remains in those systems |
| Audit trace | Critical write paths carry `traceId`; until the user-visible trace timeline lands, no "0-second replay" promise |

Default 5 metrics: Must Push adoption, 48h follow-up completion, manager review time, wrong-commitment incident, audit trace coverage.

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
| **💬 [GitHub Issues](https://github.com/Helm-OpenSource/helm-public/issues)** | Public issue tracker, vertical co-building, blocker support |
| **🎯 [Certified Delivery Partner](docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md)** | Delivery certification, brand endorsement, case-study co-building |
| **☁️ Helm Cloud (hosted)** | Optional; does not replace open source; for delivery engineers / customers who don't want to self-host |

> **Goal: help delivery engineers ship the first controlled B2B operations system in about 4 weeks when prerequisites are met.**
