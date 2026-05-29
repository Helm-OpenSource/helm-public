---
status: active
owner: Product / Design / Engineering
created: 2026-05-29
review_after: 2026-08-27
---
# Helm Operating Signal Flow Runtime Adoption Preflight and Browser Path Packet

## Conclusion

This slice is a **No-Go** for Operating Signal Flow runtime route adoption.

The current safe next step is still customer-asset-first UX refinement and reviewer-only evidence preparation. Runtime shadow data must not replace the fixture-backed `/operating` route or `/operating/signals/[signalKey]` detail route in this slice.

## Computer Use Path

Computer Use was attempted first, because the product review method requires a human-like browser path.

Observed in this session:

1. App discovery initially worked and could list Chrome, Safari, Codex, Atlas, DingTalk, Notes, Finder, and other local apps.
2. Chrome and Safari key-window reads returned `Apple event error -10005: cgWindowNotFound`.
3. Notes and DingTalk returned `remoteConnection`, but the session was not active enough for safe interaction.
4. Atlas key-window read timed out.
5. Local process inspection found stale `SkyComputerUseClient mcp` processes and one `SkyComputerUseService`.
6. Restarting the bundled Computer Use service cleared stale processes, but the MCP transport for this Codex turn closed afterward.

Classification: this is an environment/tool-session blocker, not a Helm UI defect.

Until a fresh Codex tool session can rebind Computer Use, repeatable browser validation must stay on Playwright or the in-app browser. Any claim of Computer Use visual proof must include a successful `list_apps -> get_app_state -> harmless browser interaction` chain from the same session.

## Runtime Adoption Decision

Runtime shadow remains useful as evidence, but it is not route truth.

This slice does not authorize:

- `/operating` runtime UI adoption
- `/operating/signals/[signalKey]` runtime UI adoption
- fixture banner removal
- schema, API, or migration changes
- production query default adoption
- official write
- automatic execution, approval, or external send
- connector action
- LLM final ranking

Before any route adoption review can pass, the packet must include:

- Engineering, Product, Security, Operations, and Data Protection receipt references
- explicit single-workspace scope evidence
- raw id / raw payload non-echo proof
- redacted calibration bundle
- production rollout and rollback plan
- fixture-to-runtime parity check
- Playwright route evidence
- Computer Use evidence only if the tool session is actually recovered

## UX Carry-Forward

The Operating Signal Flow page must continue to make the customer information asset visible before product mechanics.

Default visible layer:

- customer material
- customer / opportunity / account context
- current highest pressure
- current blocker
- allowed next review action
- human boundary
- AI work posture as evidence handling, not as autonomous authority

Collapsed or quote-only layer:

- runtime shadow details
- route adoption status
- fixture / projection mechanics
- ActionItem / ApprovalTask / AuditLog implementation names
- policy and readiness explanation
- internal review gate history

The practical rule for the next whole-site pass is:

> If a user cannot identify the business object, current pressure, and next action in the first visible region, the page is not ready, even if every internal boundary is technically correct.

## Sitewide Review Queue

Next pass should inspect pages in this order:

1. `/operating` and signal detail routes
2. `/dashboard`
3. `/approvals`
4. `/reports`
5. `/inbox`
6. `/imports`
7. `/memory`
8. `/settings`
9. `/analytics`
10. dynamic customer / opportunity / meeting details

Each pass should record:

- what the customer asset is
- what the customer must judge or do next
- what explanatory text was hidden behind quote/disclosure
- what product/internal terms were removed from the default layer
- what boundary remains visible because it prevents over-claiming

## Classification

**已成形但仍需下一层**.

The preflight is useful because it prevents accidental route adoption and preserves the user-facing design principle, but it does not make runtime customer data visible in production routes.
