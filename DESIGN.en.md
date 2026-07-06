> **Language**: **English** · [中文](DESIGN.md)

# Helm Design

## 1. Purpose

`DESIGN.md` defines the long-lived visual and interface constraints for Helm.
It is not a one-off page concept. It is the default direction for home,
dashboard, operating, approvals, memory, detail, settings, setup, and demo shell
work.

This document exists to keep Helm visually consistent with its product contract:
judgement-first, decision-first, review-before-commitment, and formal operating
review.

## 2. Visual Direction

Helm should feel like an **enterprise operating system for delivery work**.

It should not feel like:

- a developer-tool control plane
- a premium fintech marketing site
- a consumer AI chat app
- a demo shell powered by saturated gradients and exaggerated motion

The default mix is:

- 70% enterprise trust and structure
- 20% modern AI product feel
- 10% documentation-grade readability

## 3. Product Semantics Come First

Every Helm surface must first answer:

1. What does Helm currently judge?
2. Why does Helm judge it that way?
3. What has already been advanced?
4. Who needs to make which decision now?
5. What action can the user take immediately?

Visual decoration must never obscure the product semantics.

## 4. Service First

Helm is a service system, not an education system.

Avoid:

- first-screen architecture explanations
- teaching copy for internal ranking or loop mechanics
- system-tour paragraphs inside operating workflows
- "help you understand" language where an action or result should be shown

Prefer:

- direct operating results
- visible judgement, action, boundary, and evidence
- secondary drill-down for "why this judgement"
- user-triggered explanations only when they help review

## 5. Interface Baseline

Helm is light-first, restrained, and readable. It uses white or off-white
surfaces, near-black text, one primary accent line, and status colors only for
state. Business surfaces should be dense enough for repeated use and calm
enough for review.

Implementation defaults:

- Reuse the existing `app/globals.css` token family.
- Avoid raw, page-local color systems.
- Keep cards, panels, tables, and controls stable across light and dark modes.
- Preserve WCAG AA text contrast.
- Keep decision/action/boundary content before secondary evidence and trace.

## 6. Boundaries

Design must preserve Helm's public Core boundaries:

- recommendation is not commitment
- explanation is not approval
- proposal is not a contract
- proactive support is not automatic high-risk execution
- review-first wording must remain visible before user-facing actions

## 7. Design-Language Unification: Boundary As Component (2026-07)

The NPA industry pack matured "boundaries must be visible" into a machine-checkable component system, now ported back into Core as the unification baseline: `components/shared/boundary-bar.tsx` (page-level three-segment boundary declaration — what you see / what the system will not do / who decides next — plus an explicit negative list, fail-closed with visible error codes) and `components/shared/effect-mode-badge.tsx` (suggestion_only / shadow_suggestion / human_action / receipt marks so recommendation vs commitment stays visually unmistakable; unknown modes render as danger). First applied surface: `/operating/tenant-health`. Rollout continues with `/approvals`, `/capture`, and `/operating`; raw Tailwind status colors from pack surfaces are normalized to `--status-*` tokens on the way in, and tenant-custom hex values never enter Core.
