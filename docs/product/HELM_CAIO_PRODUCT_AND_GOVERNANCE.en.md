---
status: active / frozen-terminology-adr
owner: helm-core
created: 2026-07-21
review_after: 2026-08-21
public_safety: Public-safe English reference of the CAIO terminology and governance ADR. It contains no customer data, credential, private deployment fact, production receipt, or activation authority; nothing in this document grants any system permission.
---

# Helm CAIO Product and Governance ADR (English Reference)

> **语言 / Language**: [中文主文本](HELM_CAIO_PRODUCT_AND_GOVERNANCE.md) + English reference

The Chinese main text is authoritative. This is a condensed reference.

## 1. Frozen branding

- Chinese brand: **Helm CAIO｜一号位 AI 经营中枢**
- Role definition: the enterprise's chief AI executive, reporting directly and
  only to the CEO.
- English brand: **Helm CAIO — the AI executive reporting to the CEO**
- CAIO is a product role label. It is never expanded as an English acronym in
  customer-visible content.
- Legacy wording (`AI COO`, `数字 COO`) must not appear in new customer-visible
  content. Existing machine identifiers under the `aicoo` namespace are frozen
  and unchanged (§4).

## 2. Governance definition (frozen)

1. The CAIO is the top accountable role of the enterprise AI organization and
   leads the domain agents.
2. At mature stages it may, within a CEO-issued pre-authorization envelope,
   dispatch Work Packets to people and agents, supervise receipts, and adjust
   orchestration. This describes the target mature form, not a currently
   established capability (§3).
3. People can structurally refuse, pause, and appeal, without retaliation.
4. When a CAIO instruction conflicts with a human management instruction, the
   task pauses and escalates only to the CEO for a ruling.
5. A CEO-designated guardian role can emergency-stop the CAIO but cannot
   resume it; resumption authority belongs to the CEO alone.
6. The CAIO is not a natural-person statutory officer and does not transfer
   the legal accountability of the CEO, COO, CIO, or business leaders.
7. The CAIO role definition itself grants no system write permission and no
   external side-effect permission.

Governance invariants: a reporting line is not an authority grant; blocking
precedence is law/policy constraints, human consent, and guardian
emergency-stop over CEO instructions over CAIO suggestions; authorization can
only be explicitly issued by the CEO and is never inherited, copied, or
derived from any existing owner approval (a historical capability-metadata
registration approval covers metadata registration only); a recommendation is
never a commitment — commitments only arise through the existing independent
authorization, policy-gate, and human-review chain; dual approval requires
two independent roles; neither the CAIO role nor a CaioMandate object may be
consumed by any permission system as an authorization token.

## 3. Capability maturity axis (not a permission axis)

`Observe → Advise → Supervise → Orchestrate → Authorized Execute` is a product
maturity axis for honest status statements only. It is not a permission enum,
not an automation level, and not a runtime state machine. Ordinal comparison
for gating and any mapping onto existing automation levels or
`DecisionActionLevel` are forbidden.

Current honest state (per-stage evidence status
`formed | next_layer | roadmap_disabled`): Observe is a formed public
reference slice (the Stage 1 Owner Loop) that still needs the real deployment
layer; Advise and Supervise are formed at the contract / synthetic-evidence
level but still need the next layer; Orchestrate and Authorized Execute are
roadmap items, deliberately not built, disabled by default. Authorized Execute
must always render as: roadmap, unauthorized, disabled by default, and not an
execution permit.

`WorkspaceRole.OWNER` in the public Core is a workspace permission role, not a
legal CEO identity. CEO identity can only be bound explicitly by a private
overlay; display branding is never an authentication or server-side
authorization condition.

## 4. `aicoo → CAIO` compatibility mapping (display only, one-way)

Customer-visible display wording migrates to CAIO. Machine identifiers under
the historical `aicoo` namespace are frozen and unchanged — file names, paths,
binding / capability / version identifier fields, merge commits, historical
hashes, owner-approval evidence, and all signed / pinned / archived content.
The concrete identifier inventory is maintained by the repositories that own
those identifiers inside their own boundaries; this public document does not
enumerate private implementation details. The mapping is a one-way display
alias: a CAIO alias appearing in place of a historical machine identifier in
canonical objects must fail validation, never be rewritten.

Repository ownership: the public Core repository owns this ADR, the single
CAIO type contract (planned; delivered by a later slice, not by this PR), and
the terminology gate; the industry pack repository owns legacy-wording
classification and ratchet guards for industry content; customer overlay
repositories own tenant display overrides and private identity mapping only;
the control-plane repository owns compatibility metadata, pins, receipts, and
deployment governance only.

## 5. Boundary statement

This document and its companion checker change no permission, route, API,
database, or execution state machine; activate no auto-dispatch, outbound
send, CRM write, or financial / legal action; constitute no production
activation, customer commitment, or owner approval; and alter no existing
`aicoo` machine identifier, pin, hash, or historical evidence.
