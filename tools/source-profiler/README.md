# Source Profiler

A read-only, open-source **implementation-assist CLI**. It profiles a team's own
repo / deployment — source code, ORM models, SQL schema, and API docs — and
proposes candidate mappings from those structures onto Helm's business-signal
model, so connecting an existing system becomes *review-and-approve* instead of
hand-built integration engineering.

It is **not** a server-side ingest service, a connector, or an auto-writer.

## Boundaries (v1)

- **Read-only.** Never executes scanned code, never writes to external systems,
  never reads database rows. (DB catalog introspection in a later slice is
  catalog-only.)
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

Outputs per run: `run.json`, `code-scan.json`, `mapping-candidates.json`.

## Layers

1. **Deterministic profiler** — the only trusted layer (scope enforcement,
   secret preflight, structural scan, mapping proposer).
2. **AI overlay** (later slice) — optional, consent-gated; produces candidate
   reasoning only, never ground truth.
3. **DB catalog** (later slice) — optional, catalog-only introspection.

## Layout

- `src/contract/` — pure zod contracts shared across the CLI (the seam).
- `src/profiler/` — deterministic scope/secret/scan/mapping engine.
- `src/cli/` — argv parsing, `init`, `profile`.
- `fixtures/` — 100% synthetic sample app for tests.

Supported in v1: SQL DDL (`CREATE TABLE`), Prisma models, JSON OpenAPI /
JSON-Schema. Other ORMs and YAML OpenAPI are deferred; the parser registry is
extensible.
