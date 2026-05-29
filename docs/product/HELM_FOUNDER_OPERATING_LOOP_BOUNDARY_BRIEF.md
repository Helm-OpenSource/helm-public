---
status: active / boundary brief / public descriptor
owner: Product / GTM / Delivery Engineering / Engineering
created: 2026-05-21
last_reviewed: 2026-05-21
review_after: 2026-06-04
public_safety: Intended for the public mirror. This file describes only public-safe boundaries. Full requirements, dogfood notes, customer-specific packs, implementation plans, and commercial operating details remain private.
archive_trigger:
  - Replaced by an accepted public roadmap entry or a public commercial-pack boundary document
  - Founder Operating Loop is abandoned as a commercial / enterprise / partner-delivered candidate capability
  - The boundary posture changes to allow auto-send, auto-approval, cross-workspace aggregation, employee-facing AI messages, or AI-as-CEO positioning
---

# Helm Founder Operating Loop Boundary Brief

This brief is the public-safe boundary note for the Founder Operating Loop idea.

It is **not** the full requirements document, not an implementation contract, not a public roadmap commitment, and not an open-core default runtime promise.

## Public Position

Founder Operating Loop is a candidate **commercial / enterprise / partner-delivered workflow pack** for CEO-facing operating review.

It explores one narrow question:

> Can Helm's review-first, evidence-coupled operating signal method help a CEO review the most important operating threads without turning Helm into an auto-execution platform?

The answer, if implemented, must stay inside Helm's existing public doctrine:

- recommendation is not commitment
- review packet is not execution
- evidence is required before action
- workspace data stays workspace-scoped
- no automatic outbound send
- no outbound authored by Helm or AI on the CEO's behalf; the CEO is always the message author, not just the sender
- no automatic approval
- no cross-workspace aggregation
- no LLM final authority over business commitments

## What May Be Public

The following parts are safe to discuss publicly:

| Area | Public-safe stance |
|---|---|
| Product category | Commercial / enterprise / partner-delivered workflow pack candidate |
| Core method | Evidence-coupled briefing, CEO review queue, human approval before action |
| Boundary model | Review-first, no auto-send, no auto-approval, no cross-workspace aggregation |
| Open-core relationship | May reuse open-core primitives such as review-packet patterns, eval harnesses, audit shapes, and sample signal methodology without itself being open-core |
| Delivery relationship | May be delivered by Helm Enterprise or Certified Delivery Partners when commercial and compliance gates are met |

## What Is Not Public

The following must not be placed in the public mirror as Founder Loop artifacts:

| Area | Boundary |
|---|---|
| Full requirements | Internal-only until owner alignment, dogfood evidence, and compliance posture are settled |
| Dogfood readouts | Internal-only; may include operating priorities, false positives, missing signals, or customer-adjacent context |
| Customer-specific packs | Private to the delivery relationship; public examples must be synthetic or explicitly sanitized |
| Connector scope decisions | Private until each connector has its own public-safe boundary and proof |
| Retention / compliance implementation | Private until reviewed and reduced to a public-safe policy descriptor |
| Commercial pricing or packaging | Private until GTM owner approval |

## Explicit Non-Goals

Founder Operating Loop must not be marketed or implemented as:

- "AI CEO"
- AI taking over company operations
- employee monitoring product
- HR performance management or employee ranking
- automatic outbound messaging
- automatic approval or automatic execution plane
- full BI platform
- full workflow / orchestration engine
- hosted SaaS that bypasses the Certified Delivery Partner channel

## Minimum Boundary Bar

Any future implementation or public claim must preserve these gates:

1. Any Founder Loop item proposing action or escalation must carry evidence references.
2. Any generated outbound draft must still require explicit CEO send.
3. Any action or delegation must be review-first and auditable.
4. Any customer or employee data scope must be disclosed through a customer-approved compliance / contract path.
5. Any public example must be synthetic, sanitized, or explicitly cleared for public use.
6. Any commercial packaging must align with Helm Cloud, Helm Enterprise, or Certified Delivery Partner boundaries.

## Current Status

The public status is:

> Boundary brief only. No schema, API, runtime query, UI implementation, connector adoption, official write path, outbound send authority, customer deployment, or public roadmap commitment is authorized by this document.

The complete requirements exploration remains internal until it is replaced by a reviewed implementation contract, dogfood closeout, or owner-approved commercial-pack plan.

## Change Log

| Date | Change |
|---|---|
| 2026-05-21 | Initial public-safe boundary brief created after deciding that the full Founder Operating Loop requirements should remain internal-only. |
| 2026-05-21 | Tightened public wording around evidence-bearing action items, CEO authorship, open-core reuse, partner-channel SaaS boundary, and customer-approved disclosure path. |
