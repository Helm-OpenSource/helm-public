# Source Profiler — Usage

A read-only, offline CLI that profiles a team's **own** repo / deployment and
proposes candidate mappings onto Helm's business-signal model. Discover →
propose → a human approves. It never auto-writes, auto-sends, or activates a
connector.

## Install / run

The tool ships inside this repo and runs via the root `tsx` toolchain — no extra
install, no Go module, no DB driver.

```bash
# 1. Scaffold a scope manifest and gitignore .helm-profiler/
npm run source-profiler:init

# 2. Edit .helm-profiler/source-profiler.scope.json to point at your source.

# 3. Run the deterministic profile
npm run source-profiler -- \
  --scope .helm-profiler/source-profiler.scope.json \
  --source . \
  --output .helm-profiler/runs
```

## Commands & flags

| Command / flag | Effect |
| --- | --- |
| `init` | Write a scope-manifest template; ensure `.helm-profiler/` is gitignored. |
| `profile` (default) | Run the deterministic profiler. |
| `--scope <path>` | Scope manifest (include/exclude, secret preflight, output, DB allowlist). |
| `--source <dir>` | Source root to scan (overrides manifest `root`). |
| `--output <dir>` | Output base dir (default `.helm-profiler/runs`). |
| `--redact` | Also write a `review-packet.redacted.json` (shareable, aliased). |
| `--db-catalog <snapshot.json>` | Introspect a catalog snapshot (catalog-only, no rows). Requires a schema/table allowlist in the manifest. |
| `--ai-provider local\|openai\|anthropic\|custom` | Run the optional AI overlay (advisory candidates only). |
| `--ai-consent` | Required for remote AI providers (redacted-only, audited). |
| `--emit-overlay-draft --tenant <k> --extension-slug <s>` | Emit a helm-overlays deployment draft. |
| `--overlay-root <path>` | Materialize the overlay draft into a separate overlay worktree (guarded). |
| `--json` | Print the full result as JSON. |

## Output artifacts (per run, under `.helm-profiler/runs/<ts>-<hash>/`)

| File | Contents |
| --- | --- |
| `run.json` | Run id, versions, scope hash, phases, modalities, audit trail. |
| `code-scan.json` | Discovered objects/fields/associations + skipped files. |
| `mapping-candidates.json` | Candidate mappings (deterministic + AI, if enabled). |
| `review-packet.json` | CONFIDENTIAL packet a human reviews (P0-REQ-07 metadata). |
| `review-packet.redacted.json` | (with `--redact`) shareable, aliased export. |
| `ai-prompt-preview.txt` | (with `--ai-provider`) exactly what would be sent. |
| `overlay-draft.json` | (with `--emit-overlay-draft`) the deployment draft. |

## Scope manifest

See `src/contract/scope-manifest.ts`. Key fields: `include`/`exclude` prefixes,
`respectGitignore`, `maxFileSizeBytes`, `skipBinary`, `secretPreflight.mode`
(`strict`/`warn`/`off`), `dbCatalog` allowlist, and `output`.

## Supported inputs (v1)

- **Static source**: SQL DDL (`CREATE TABLE`), Prisma models, JSON OpenAPI /
  JSON-Schema. Parsed as text — never executed.
- **DB catalog**: a JSON snapshot of `information_schema` / `pragma` (no rows).
  Produce it with the queries in `src/db/catalog-queries.ts` run against a
  read-only role/replica, or wire a `CatalogExecutor` programmatically.

Other ORMs (TypeORM, Sequelize, Django, SQLAlchemy, JPA) and YAML OpenAPI are
deferred; the parser registry is extensible.
