# Source Profiler — Integration notes

How the profiler fits the existing Helm methods and where the boundary to a
future server-side capability sits.

## Signal First Mile

The profiler is an *upstream accelerator* for the Signal First Mile method
(`docs/product/HELM_SIGNAL_FIRST_MILE_METHOD.md`,
`docs/product/HELM_SIGNAL_FIRST_MILE_QUICKSTART.md`, assets under
`templates/signal-first-mile/`).

- Signal First Mile already has a **review-packet** concept
  (`templates/signal-first-mile/ledger-to-review-packet.js`,
  `review-packet.sample.md`). The profiler's `ReviewPacket` aligns with that
  human-review surface: instead of hand-writing the first signal mapping, the
  profiler proposes candidate mappings from the existing system's structure,
  and the human reviews/accepts them — the same "first mile" decision, with a
  head start.
- Recommended flow: `source-profiler profile` → review `review-packet.json` →
  accept the mappings that matter → feed the accepted shape into the Signal
  First Mile ledger / first-change proof.

## Cross-System Accountability Gap

See `docs/product/HELM_CROSS_SYSTEM_ACCOUNTABILITY_GAP_MVP.md`. The profiler
helps close the *discovery* half of the gap: it surfaces which objects/fields in
an existing system carry commitment / advancement / risk / receipt signals
(`signalFamily` aligned to `lib/operating-signal-flow/contract.ts`), so the
accountability chain can be wired to real upstream sources rather than guessed.
The profiler proposes; the accountability model still requires human-accepted
mappings before any signal is treated as real.

## Extension / overlay protocol

Overlay drafts follow the multi-tenant extension layout
(`docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md`,
`docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md`):
`tenants/<tenant>/extensions/<slug>/` with a read-only adapter skeleton and a
draft manifest (`activated: false`). The draft is a starting point a human
completes; it activates nothing.

## Boundary to a future server-side Auto-Discovery (separate plan)

This tool is deliberately a **local, offline, read-only profiler** — not a
server-side ingest service. A future server-side Auto-Discovery (auto-ingesting
discovered mappings into Helm via the import pipeline) is a **separate plan** and
must independently solve the P0 problems it raises, including:

- an `ApprovalTask`-gated human approval before any mapping becomes a live
  signal (recommendation ≠ commitment at the server boundary);
- identity resolution / conflict review (`IdentityMatch`) for ingested objects;
- the auto-write path through `runCrmImport` and its review-first landing;
- workspace-scoped permissions and audit for the ingest endpoint.

None of that is in scope here. The profiler stops at producing user-private
candidates and optional private overlay drafts.
