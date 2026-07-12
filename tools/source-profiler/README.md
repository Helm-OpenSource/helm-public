# Source Profiler

A read-only, open-source **implementation-assist CLI**. It profiles a team's own
repo / deployment — source code, ORM models, SQL schema, and API docs — and
proposes candidate mappings from those structures onto Helm's business-signal
model, so connecting an existing system becomes *review-and-approve* instead of
hand-built integration engineering.

It is **not** a server-side ingest service, a connector, or an auto-writer.

## Docs

- [Usage](docs/USAGE.md) — commands, flags, output artifacts, supported inputs.
- [Boundaries](docs/BOUNDARIES.md) — trust model, public vs private, overlay ownership, guards.
- [Integration](docs/INTEGRATION.md) — Signal First Mile, Cross-System Accountability, and the boundary to a future server-side Auto-Discovery (separate plan).

## Boundaries

- **Read-only.** Never executes scanned code, never writes to external systems,
  never reads database rows. DB discovery is catalog-snapshot-only.
- **No network in the deterministic layer.** Enforced by
  `scripts/check-source-profiler-boundaries.ts`.
- **Candidates, not conclusions.** Every proposed mapping is a `candidate`; only
  a human can accept or reject it. (建议 ≠ 承诺.)
- **User-private outputs.** Runs land under `.helm-profiler/runs/` (gitignored).
  Real source, schema, and outputs never enter public fixtures or the repo.

## Usage

```bash
# Scaffold a scope manifest template and gitignore .helm-profiler/
npm run source-profiler:init

# Run the deterministic profiler
npm run source-profiler -- --scope .helm-profiler/source-profiler.scope.json \
  --source . --output .helm-profiler/runs
```

Outputs per run: `run.json`, `code-scan.json`, `mapping-candidates.json`, and the
CONFIDENTIAL local `review-packet.json`. With `--ai-provider local`, the same
production bridge also writes `source-to-signal-proposals.json`; every proposal
is `needs_review`, evidence-bound, confidence-capped by structural parsing, and
explicitly forbidden from execution or connector authority.

## Layers

1. **Deterministic profiler** — the only trusted layer (scope enforcement,
   secret preflight, structural scan, mapping proposer).
2. **AI overlay + v3 proposer** — optional and consent-gated; consumes only the
   redacted packet, validates the whole provider response strictly, and emits
   candidate reasoning plus a `SourceToSignalProposalBundle`, never ground truth.
3. **DB catalog** — optional, allowlisted catalog-snapshot introspection only;
   row data is not accepted.

## Layout

- `src/contract/` — pure zod contracts shared across the CLI (the seam).
- `src/profiler/` — deterministic scope/secret/scan/mapping engine.
- `src/cli/` — argv parsing, `init`, `profile`.
- `fixtures/` — 100% synthetic sample app for tests.

Supported in v1: SQL DDL (`CREATE TABLE`), Prisma models, JSON OpenAPI /
JSON-Schema. Other ORMs and YAML OpenAPI are deferred; the parser registry is
extensible.
