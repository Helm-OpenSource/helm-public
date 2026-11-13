> **语言 / Language**：[中文](README.md) · **English**

# Public upgrade notes (`helm.upgrade-note/v1`)

Every new `prisma/migrations/<migration directory>/` must ship, in the same PR, a
`prisma/upgrade-notes/<migration directory>.json`. The note is written for people who self-host: before upgrading
they can see whether the migration alters an existing table, which MySQL algorithm and lock to expect, whether a
rollback script exists, and how to verify the result.

The check is `npm run check:upgrade-notes` (script `scripts/check-upgrade-notes.ts`). It is chained into
`npm run check:boundaries`, so the CI Repo Guards job and the local husky hooks run it; its test
`scripts/check-upgrade-notes.test.ts` is collected by `npm run test`.

## 1. What is checked

| Rule | Meaning |
|---|---|
| `missing-note` | The migration directory is not in the baseline and has no note of the same name |
| `invalid-json` / `invalid-format` | Not JSON, or not the closed format below (unknown keys are rejected; both summaries must be non-empty) |
| `name-mismatch` | The `migration` field differs from the file name |
| `orphan-note` | The note has no migration directory |
| `rollback-missing` | `rollback.kind` is `sql` but the file at `rollback.path` does not exist |
| `inconsistent-ddl` | Contradictions visible in the text: `CREATE` on an existing table; `COPY` without rebuild; `INSTANT` with a lock or rebuild |
| `baseline-invalid` / `baseline-stale` / `baseline-has-note` | The baseline is malformed, unsorted or duplicated; a baselined migration no longer exists; a baselined migration also has a note (drop the baseline entry when backfilling) |

The check reads text only. It does not decide whether MySQL actually rebuilds a table; rehearse on the same MySQL
version to establish that.

## 2. Fields

| Field | Required | Meaning |
|---|---|---|
| `schema` | yes | Always `helm.upgrade-note/v1` |
| `migration` | yes | The migration directory name; must equal the file name without `.json` |
| `summary` | yes | `{ "zh": "…", "en": "…" }`, one or two sentences on what the migration does |
| `ddl[]` | yes, at least one | One entry per affected table: `table`; `existingTable` (alters an existing table); `algorithm` one of `INSTANT` / `INPLACE` / `COPY` / `CREATE` / `VIEW` / `TRIGGER` / `DATA`; `lock` one of `NONE` / `SHARED` / `EXCLUSIVE`; `rebuild` (full table rebuild) |
| `rollback` | yes | `{ "kind": "sql", "path": "prisma/rollback/<file>.sql" }`, or without a rollback script `{ "kind": "forward-only", "reason": { "zh": "…", "en": "…" } }` |
| `order` | yes | `migrate-before-code` / `code-before-migrate` / `independent` |
| `env[]` | yes, may be empty | Environment variables involved: `key`, `codeDefault` (the code default, verbatim as a string), `enablePrerequisites[]` (generic prerequisites before enabling, one sentence in each language) |
| `verification[]` | yes, at least one | Generic verification steps, one sentence in each language |

`algorithm` values: `CREATE` creates a new object; `VIEW` / `TRIGGER` change a definition only; `DATA` writes rows
without changing structure. When the SQL does not state `ALGORITHM=`, record the algorithm you expect from the MySQL
documentation and add a verification step that says to rehearse first.

## 3. Example (placeholder names, not a real migration)

```json
{
  "schema": "helm.upgrade-note/v1",
  "migration": "20990101000000_example_add_column",
  "summary": {
    "zh": "为示例表新增一个可空列，不改已有数据。",
    "en": "Adds one nullable column to the example table; existing rows are unchanged."
  },
  "ddl": [
    { "table": "ExampleTable", "existingTable": true, "algorithm": "INSTANT", "lock": "NONE", "rebuild": false }
  ],
  "rollback": { "kind": "sql", "path": "prisma/rollback/20990101_rollback_example_add_column.sql" },
  "order": "migrate-before-code",
  "env": [
    {
      "key": "HELM_EXAMPLE_FEATURE_ENABLED",
      "codeDefault": "false",
      "enablePrerequisites": [{ "zh": "迁移已应用。", "en": "The migration is applied." }]
    }
  ],
  "verification": [
    { "zh": "在 information_schema.COLUMNS 中确认新列存在。", "en": "Confirm the new column in information_schema.COLUMNS." }
  ]
}
```

## 4. What must never appear

This is a public repository. A note carries generic MySQL facts and generic steps only. It **never** contains:

- deployment facts: host names, addresses, domains, cloud resource identifiers, role and policy names, bucket names;
- tenant and business facts: customer or tenant names, table names and sequence numbers of private extensions,
  database account names;
- production observations: row counts, table sizes, measured durations, deployed versions, production switch values,
  release times;
- private process information: private PR numbers, who approved, approval references, internal ticket numbers.

Those belong in each deployment's own private supplement, kept in its private repository.
`npm run check:public-release` scans this directory like any other path, but it does not recognise every category
above; review still checks each note.

## 5. Baseline

`scripts/upgrade-notes-baseline.json` lists the migrations that existed on main when this check landed; they do not
need a note yet. The baseline **only shrinks**: when backfilling a note for an existing migration, delete its entry
in the same PR. Never add a new migration to the baseline to bypass the check; two hard limits back this up: at most 104
entries (the count when the guard landed), and no entry may sort after the cutoff
`20261112130000_billing_topup_order_query_throttle`. Slipping a new name in before the cutoff still has to be refused
in review.
