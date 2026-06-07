# Source Profiler — Boundaries, ownership, and trust model

The Source Profiler exists to make connecting an existing enterprise system
*review-and-approve* instead of bespoke integration engineering — while staying
strictly inside Helm's hard boundaries.

## The contract

- **Recommendation ≠ commitment.** Every mapping is a `candidate`. Only a human
  moves it to `accepted_by_human` / `rejected_by_human`. Tooling — deterministic
  or AI — only ever emits `candidate`.
- **Read-only.** No external writes, no auto-send, no auto-approve, no connector
  activation. DB catalog introspection is catalog-only (`rowDataRead: false`).
- **AI is never ground truth.** The AI overlay is optional, off by default, and
  produces advisory `origin: "ai"` candidates only.
- **Deterministic layer is the trusted base.** It performs no network I/O and
  never executes scanned code.

## Public vs private

| Public (in this repo) | Private (never committed here) |
| --- | --- |
| Tool code (`tools/source-profiler/**`) | Your real source / schema / DB metadata |
| Contracts, guards, docs | Run outputs under `.helm-profiler/` (gitignored) |
| 100% synthetic fixtures | ReviewPacket / overlay drafts with real names |

The tool being open-source is the point: a team can read exactly what it does
before pointing it at their code.

## Ownership

- **Run outputs are user-owned.** They land in the user's environment under
  `.helm-profiler/runs/` and are gitignored. The full ReviewPacket is
  `CONFIDENTIAL` (may contain real table/field names). Use `--redact` for a
  shareable export.
- **Overlay drafts belong to the overlay repo.** `--emit-overlay-draft`
  produces private deployment code for the `helm-overlays` repo. Materializing
  it (`--overlay-root`) is guarded: it refuses to write into the source repo
  working tree, requires an overlay marker (`AGENTS.md` / `tenants/`), enforces
  path containment, and won't clobber a non-empty target without `force`. It
  never commits, pushes, or activates a connector.

## Guards

`scripts/check-source-profiler-boundaries.ts` (wired into `check:boundaries`)
statically enforces:

- **SP-A** no code execution anywhere in the tool;
- **SP-B** no network in the deterministic core (`src/profiler`, `src/util`,
  `src/cli`, `src/contract`); network is sanctioned only under `src/ai/`
  (consent-gated) and `src/db/`;
- **SP-C** AI files may not claim deterministic origin or assert acceptance;
- **SP-D** fixtures contain no real secrets/PII.

## Remote AI consent ceremony

A remote provider runs only with, all at once: an explicit `--ai-provider`, an
explicit `--ai-consent`, a redacted-only prompt (no real names, no rows), a
prompt preview (`ai-prompt-preview.txt`), and an audit trail. In v1 the CLI
wires no remote transport, so remote is preview-only from the CLI; the remote
provider is available programmatically (and unit-tested with a mock transport).
