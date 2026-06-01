---
status: draft
owner: helm-core
created: 2026-05-18
review_after: 2026-05-25
target_audience: delivery engineers building B2B operations systems on top of AI agent platforms (Coze / Wukong / Dify / LangGraph / general LLM frameworks)
public_safety: Intended for the public mirror. No tenant-private references; verticals named generically.
mirrors: HELM_FOR_DELIVERY_ENGINEERS_V1.md (Chinese is authoritative; resolve drift toward zh)
archive_trigger:
  - A V2 or later replaces it after the first 5 delivery engineer adoptions
---

# Helm for Delivery Engineers

> AI platforms hand you LEGO bricks. Helm hands you an assembled, customizable, boundary-aware **business operations loop reference implementation**.

## One-line positioning

> **Helm is not another agent platform, nor an LLM framework. It is a reference implementation + methodology for B2B business operations, with full boundary discipline, built to help delivery engineers turn judgement / evidence / review / boundaries / delivery packages into a forkable engineering structure.**

---

## Who this is for

You are:

- A delivery engineer **building B2B systems for enterprise customers** on top of Coze / Alibaba Wukong / Dify / LangGraph / a general agent platform
- Stuck in the "I don't know my customer's business — how do I configure this agent?" phase
- Being asked "will the AI overstep? will recommendations turn into commitments? will tenant data cross-contaminate?" and needing an **auditable** answer
- Wanting an **opinionated scaffold** rather than assembling a framework from scratch

Then this page is for you. If you are a CEO or business buyer comparing SaaS vendors — this page is not written for you; see the [README](../../README.md) homepage.

---

## The core problem

Generic agent platforms and LLM frameworks solve **how to assemble**. They don't solve:

1. **What to assemble** — the real B2B need is "today's 3 calls a human must make + why + boundary," not a chat box
2. **How not to blow it** — AI overreach, auto-commitment, cross-tenant data leakage — the platform doesn't carry these risks for you; your customer does
3. **How to ship faster** — modeling from scratch per customer, building review gates, writing connectors, shipping dashboards — burns through your person-months

Helm encodes these three answers into one **open-source reference implementation**. Apache-2.0. Forkable. Commercially usable.

---

## Helm vs alternatives

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
| Commercial model (for you) | Platform takes a cut / their channel | You set your price | **open-core**: fork it, sell it commercially yourself. Helm Inc. doesn't take a cut |
| Who it's for | People building chat-style agents | People building general LLM apps | **Delivery engineers shipping B2B operations** |

> This table compares **types**, not any specific product's current feature checklist; platforms keep evolving. The contrast is in abstraction level and product shape. [Dify's official docs](https://docs.dify.ai/) emphasize its open-source / self-hostable posture; this table compares Dify as a visual AI application platform, not as a closed-source locked platform.

---

## 7 directly-reusable value points

Every one is backed by code or a current release gate, not a commercial promise.

### 1. Vertical reference implementation (batteries included)

`extensions/<vertical>/` is a complete machine with batteries: signal schema, worker driver previews, connectors, BI report skill assets. The target path is **fork → swap slug → swap schema → run Golden Path checks → prepare a controlled-pilot review packet**; actual cycle time depends on customer data access, permissions, reviewers, and connector readiness.

The v0.1 public release gate includes **[`extensions/case-management-sample/`](../../extensions/case-management-sample/)** as the sanitized reference vertical (case / customer service / business operations domain). The landed scope is a minimum public reference plus a worker / BI cookbook minimum slice: manifests, signal types, four synthetic fixture classes, a case mapper test, case allocation / stewardship driver cookbooks, and daily activity readout report skill assets. The current public onboarding entry is [docs/README.md](../README.md). The tenant-private original is not in the public mirror.

### 2. Boundary invariants encoded in eval gates

The `OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` closed set; `commitment: "suggestion_only"` hard-coded; `crossTenantProjection: false` enforced by eval rejection; `raw_blocked → QUARANTINED` redaction checks; `maxLlmTransitionCount: 0`.

Code: [`lib/operating-signal-flow/contract.ts`](../../lib/operating-signal-flow/contract.ts) + [`lib/evals/operating-signal-flow-evals.ts`](../../lib/evals/operating-signal-flow-evals.ts).

When your customer asks "will the AI overstep?", you show them the output of `npm run eval:operating-signal-flow` — not a doc promise. **Code + eval is auditable evidence; commercial commitments still require human authorization and contract terms.**

### 3. Full closure loop (not just readout)

Signal collection → normalization → judgment → review → action → receipt → learning, 22 states already modeled ([`lib/operating-signal-flow/contract.ts`](../../lib/operating-signal-flow/contract.ts)).

- BI tools stop at readout ("I see it")
- Chat platforms stop at conversation ("we discussed it")
- Agent orchestration stops at execution ("we did one step")
- **Helm treats closure as first-class**: discover → assign → review → push → audit-trail → learn — no "one step done = finished"

The core narrative you sell to your customer: **"Not viewing reports — managing actions."**

### 4. Opinionated worker architecture

`workers/*-driver-preview/` templates encode "suggest+approve" and "read-only signal" driver interfaces, immutable constraints, unit-test-locked patterns. Reuse the template for new drivers — **no need to redesign approval gates, `proposalKey` deduplication, or `requiresApproval` defaults** every time.

### 5. Multi-tenant / multi-tier / multi-connector already designed

[`lib/deployment-profile/contract.ts`](../../lib/deployment-profile/contract.ts) + [`lib/tenant-overlays/contract.ts`](../../lib/tenant-overlays/contract.ts). open-core / cloud / enterprise / tenant-private 4-layer cut.

You don't have to rewrite multi-tenant isolation logic for your customer — **skip an entire architecture review**.

### 6. Bilingual + China-native by default

Chinese/English support at the contract layer (not just translated READMEs); locale-aware projection already in place; DingTalk / IMAP / Aliyun Mail / Qwen connectors **in the repo**.

You get **both Chinese-domestic delivery and Chinese-cross-border** scenarios — no need to choose.

### 7. Memory + recommendation engine compounds across deployments

Each deployment's anonymized patterns flow back into the memory layer; **the system gets smarter the more it's used**. This is a network-effect seed — most frameworks don't have one.

As the delivery partner base grows, Helm's reasoning quality itself improves, and **your customer benefits passively**.

---

## Golden Path onboarding anchor

Success = completing this executable path and having the local check chain prove judgement, evidence, review, and boundaries remain review-first. Steps 1 / 2 have a [D2 smoke receipt](../reviews/HELM_DELIVERY_ENGINEER_D2_SMOKE_2026-06-01.md) for the Docker fresh-clone path; it verifies the public Core quickstart only and is not a commercial release, customer deployment, or SLA commitment. Minute labels are navigation aids, not SLAs, launch promises, or customer deployment proof.

1. `git clone https://github.com/Helm-OpenSource/helm-public.git && cd helm-public && docker compose up` — local workspace running
2. `open http://localhost:3000` — see `/operating` (operating signal flow map), `/approvals` (review gate), `/memory` (operating memory) — three already-working surfaces (⚠️ `/operating` is currently a **Phase 2 fixture demo**; connecting live tenant data requires Phase 2.3 runtime adoption)
3. Read [`extensions/case-management-sample/README.md`](../../extensions/case-management-sample/README.md) — understand how a public-safe vertical starting point is organized
4. Modify [`extensions/case-management-sample/tenant.manifest.json`](../../extensions/case-management-sample/tenant.manifest.json) slug + displayName — your customer's vertical starts taking shape
5. Run `npm run eval:operating-signal-flow` — see which of 7 signal families / 10 blockers / 22 states your fixture covers, and which it doesn't
6. Read [`docs/integrations/INTEGRATION_TEMPLATE.md`](../integrations/INTEGRATION_TEMPLATE.md) — wire up your customer's existing systems

Completing these 6 steps means you have inspected the core forkable engineering structure. The remaining work is schema customization, connector adaptation, copy polish, and human review.

> If you get stuck, post on GitHub Discussions. If the Golden Path does not pass, demote the claim by gate and do not describe it as externally verified.

---

## What Helm Inc. doesn't sell / does sell

**Doesn't sell**:

- ❌ SaaS direct to end customers (Helm Inc. doesn't compete with delivery engineers)
- ❌ License fees on fork / commercial use / self-hosting
- ❌ Vertical pack sales (any vertical you want to build, you fork and sell)
- ❌ Agent marketplace / plugin store
- ❌ LLM orchestration platform

**Does sell**:

- ✅ open-core continuous maintenance + upgrades + docs (Apache-2.0, free)
- ✅ Helm Cloud (hosted) — optional; for delivery engineers who don't want to self-host
- ✅ Helm Enterprise (private deployment + commercial connectors + advanced audit / observability) — optional; for customers with compliance requirements
- ✅ Certified Delivery Partner certification — Helm-backed brand endorsement for your delivery quality

Open-source / commercial boundary: see [`docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`](../product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md).

---

## Core discipline: Recommendation ≠ Commitment

This is Helm's core discipline — and **the core thing you sell to your customer**:

- **Recommendation**: a system-generated suggestion; requires human review
- **Commitment**: a formal action with business impact; requires explicit authorization
- Any customer-visible wording that could be misread as commitment is explicitly demoted to "boundary note / prerequisite / dependency"

**Eval gates enforce this.** Docs aren't the promise; **code + eval is auditable evidence, and formal commitments remain human-authorized contract terms.**

Details: [AGENTS.md §6-§7](../../AGENTS.md).

---

## Next steps

| You want to | Look here |
|---|---|
| Just run it | [README.md](../../README.md) 90-second demo |
| Track the public vertical entry | [docs/README.md](../README.md) |
| Wire up your customer's systems | [`docs/integrations/INTEGRATION_TEMPLATE.md`](../integrations/INTEGRATION_TEMPLATE.md) |
| Understand the OS / commercial boundary | [`docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`](../product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md) |
| Apply for Certified Delivery Partner | [`docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md`](../product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) |
| Commercial partnerships / contact | WeChat `ffjw0821` (human-routed, controlled) |
| Join community | WeChat invite QR (add WeChat `ffjw0821` to get the currently valid QR) |
| Social media / official account | TBD (not a committed channel yet) |

---

## Changelog

| Date | Change |
|---|---|
| 2026-05-18 | V1 initial (zh authoritative): audience switched to "delivery engineers"; introduced Coze / Wukong / Dify and LangGraph / LangChain dual-axis comparison; listed 7 code-backed value points + 30-min onboarding anchor + sell / don't-sell boundary |
| 2026-05-18 | V1 zh revision 2: filled `<reference-vertical>` → `case-management-sample` |
| 2026-05-18 | V1 English mirror created (this file). Chinese is authoritative; resolve drift toward zh |
| 2026-05-18 | V1 zh revision 3 mirrored: tightened 6-week goal, Dify forkability, code/eval promise wording, and added a release-gate guardrail for `case-management-sample` |
| 2026-05-18 | V1 zh revision 4 mirrored: minimum public `case-management-sample` landed; onboarding status now depends on fresh-clone verification |
| 2026-06-01 | D2 Docker fresh-clone smoke receipt landed; onboarding wording now says public Core quickstart is verified without upgrading it to commercial release or customer deployment readiness |
