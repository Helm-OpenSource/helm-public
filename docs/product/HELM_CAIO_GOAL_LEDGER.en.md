---
status: draft
owner: helm-core
created: 2026-11-17
review_after: 2026-12-17
public_safety: English reference for the CAIO goal ledger plan. Synthetic examples only; no tenant data, people, credentials, threshold values, deployment identifiers or production receipts.
---

# CAIO Goal Ledger (English Reference)

> **语言 / Language**: [中文主文本](HELM_CAIO_GOAL_LEDGER.md) + English reference

Status: planned; the code is not merged. This is the planning and contract description written before implementation (changes that touch the schema or migrations need a planning document first). It grants no activation and does not mean any workspace has a goal ledger.

## Position

- Each workspace keeps one append-only, hash-chained goal ledger. Every entry records the OWNER's words, a change note and a table of sealed digests; one fixed key of that table binds a Core-shaped goal document: goals, metric references, components (work lines), gates and the role keys that own them.
- Writes go only through a controlled command authorized by the workspace OWNER. Every read re-verifies the whole chain from entry 1; a broken chain raises an alarm that carries no goal content.
- The ledger is a record, not a permission: it grants no role any right, dispatches no task and triggers no execution.
- The module lives in `lib/caio-goal-ledger/` without an `index.ts`. It does not reuse mandate records (behind the permission firewall, unreadable from API routes), the workspace `focusAreas` (a mutable setting without a chain that non-OWNERs can change) or the attention route config (published by an operator identity without an OWNER check).

## Deliberately not done

- **No automatic AI dispatch.** The ledger states what the goals are and which role owns which work line; people still confirm dispatch in the attention flow.
- **No threshold values.** The document holds only a reference to each threshold and its digest (sha256); values stay in the private overlay. The contract refuses unknown keys at every level, so there is nowhere to put a value.
- **No per-person ranking shape.** No per-person score, rank or sortable field and no userId; role-to-person bindings stay in the attention route config.
- No web page, API route or server action; the command line is the only writer.
- No future-dated entries. A rejected chain has no in-band repair; recovery is a restore from backup.

## Chain entries

- `hash = sha256(canonical JSON(entry without its hash field))`, UTF-8, lowercase hex.
- `prev_hash` is the previous entry's `hash`, 64 `0`s for entry 1; `seq` runs from 1 without gaps.
- Canonical JSON: keys sort by Unicode code point; `,` and `:` carry no spaces; non-ASCII is written as is; strings escape as `JSON.stringify` does. Values are strings, safe integers, booleans, null, objects and arrays only; fractions, integers beyond the safe range and lone surrogates are refused.
- `canonicalJson` in `lib/expert-capability/hashing.ts` is not reused: it sorts by UTF-16 unit and accepts floats.

Entry keys are a closed set; any extra key is `entry_shape_invalid`:

| Field | Required | Meaning |
|---|---|---|
| `seq` | yes | Integer ≥ 1 |
| `ts` | yes | ISO timestamp with an offset, stored as is |
| `owner_quote` | yes | The OWNER's words, 1 to 4000 code points, not all whitespace |
| `change` | yes | Change note, same limits |
| `files` | yes | `{ path key: sha256 }`, an opaque table of sealed digests to Core; keys `^[A-Za-z0-9][A-Za-z0-9._/-]{0,190}$`, values 64 lowercase hex characters |
| `prev_hash`, `hash` | yes | See above |
| `writer` | no | Writing source; local appends write `user:<actorUserId>` |
| `effective_at` | no | Effective time, `ts` when absent |
| `schema` | no | Local appends write `caio-goal-ledger-entry/v1` |

- Effective time: a local append needs `effective_at` no later than now and no earlier than the previous entry's effective time (otherwise `effective_at_in_future` / `effective_at_regression`). The current version is always the chain head.
- `files` has a second use: the overlay's private definition files and thresholds stay out of Core, but their digests are sealed in the chain so the overlay can verify itself.

## Core-shaped document `caio-goal-ledger-document/v1`

An entry's `files[documentFileKey]` equals `sha256(UTF-8 bytes of the document text)`. The document text is stored byte for byte and never reordered. Local appends use the fixed key `caio/goal-ledger-document.json` and canonical JSON text; an import bundle names its own key.

```ts
type CaioGoalLedgerDocument = {
  schema: "caio-goal-ledger-document/v1";
  goals: Array<{                      // 1..20
    key: string;                      // CAIO_REF_PATTERN, unique in the document
    kind: "northstar" | "stage_metric";
    title: string;                    // ≤200
    standard: string;                 // ≤2000, the written success standard
    metrics: Array<{                  // 0..20; key matches NorthstarKpi.key
      key: string;
      label: { zh: string; en: string };
      unit: NorthstarKpiUnit;
      direction: NorthstarKpiDirection;
      basisRef: string;
    }>;
    threshold: { ref: string; sha256: string | null } | null;  // reference and digest only; null sha256 means no line set
    componentKeys: string[];          // all must exist in components
  }>;
  components: Array<{ key: string; label: string; primaryRoleKey: string }>;        // 0..100
  gates: Array<{ key: string; label: string; holderRoleKey: string; note?: string }>; // 0..50
  roleBindingPin: { source: "caio_attention_route_config"; version: number; contentHash: string } | null;
};
```

Validation (strict at every level, all fail closed):

- Unknown keys are refused.
- Goal, component and gate keys are unique within their own lists, metric keys across the whole document, and a goal lists each component once; `componentKeys` references must resolve.
- Role keys reuse the attention pattern `^[a-z][a-z0-9_]{0,63}$`, which the contract layer will export from `lib/caio-attention/contracts.ts` as `CAIO_ATTENTION_ROLE_KEY_PATTERN` (today a private constant in that file) instead of copying it.
- `roleBindingPin` is required exactly when the document uses a role key, and must be null otherwise.
- No values in prose: `title`, `standard`, every `label` and the gate `note` are refused when they match an amount or percentage pattern (`prose_carries_value`), so values cannot leak through text fields. These fields reach member briefs; wording such as "100% of components" has to be rephrased.

People are not in the ledger, but the ledger pins them:

- On write (only for the document that becomes the chain head): the pinned route-config version exists; `sha256(the stored config bytes)` equals the pin and the row's `contentHash`; every role key the document uses is in `roleBindings`. Otherwise `role_binding_pin_invalid`. The version need not be active at write time.
- On read: people resolve only when the active version equals the pin; otherwise the people part reports `drift` while goals and metrics are unaffected. Changing people takes a new sealed entry from the OWNER.

## Writes

```
npm run caio:goal-ledger -- --template=<appendEntry|importChain>
npm run caio:goal-ledger -- --operation=<appendEntry|importChain> --workspace-id=<id> \
    --actor-user-id=<id> --input-file=<path.json> [--apply] [--english]
npm run caio:goal-ledger -- --verify --workspace-id=<id>
```

- A sibling of `npm run caio:governance-operator` that reuses `lib/caio-operator/operation-core.ts`: validate-only by default, writes only with `--apply`, prints one JSON line.
- Exit codes: 0 success; 1 refused (closed code); 2 usage error; 3 `--verify` found the ledger `rejected` or `unavailable`.
- `appendEntry` input: `ownerQuote`, `change`, `effectiveAt`, `expectedHeadHash` (64 `0`s for an empty chain), `document`.
- `importChain` input: `format: "caio-goal-ledger-import/v1"`, `documentFileKey`, `entries` (in order, at most 10000), `documents` (digest to document text).

Four identity layers:

| Layer | What it does |
|---|---|
| Command pre-check | Reads `Membership` only; anyone but an ACTIVE OWNER gets `not_owner` before the service runs |
| In-transaction recheck | The first statement is `SELECT role, status FROM Membership … FOR SHARE`; anyone but an ACTIVE OWNER is refused. Implemented inside the ledger module, without importing `lib/caio-governance` |
| Database grants | The reader identity has SELECT only; the operator identity has SELECT / INSERT on entries; nobody has DELETE |
| Structural guard | Only an allow-list may import the write service; `app/` and server actions may not reach it; no `index.ts` |

`appendEntry` order inside one transaction: recheck OWNER → lock the head anchor → read every entry and verify the whole chain (`chain_rejected`) → compare `expectedHeadHash` (`head_conflict`) → validate the document and pin, then insert → compare-and-swap the head with a raw conditional update → read back and re-verify (`storage_roundtrip_mismatch`, rolled back) → write the audit row. Three unique keys `(workspaceId, seq)`, `(workspaceId, entryHash)` and `(workspaceId, prevHash)` cover concurrency; the last gives every entry at most one successor, so the database cannot fork.

`importChain`: the whole bundle chain is verified purely first (`bundle_chain_invalid`). With n entries stored and m in the bundle, n ≤ m and the first n hashes must match one by one, otherwise `import_fork` and nothing is written. Only the difference is appended. The bundle's last entry must carry a document that validates (`head_document_missing` / `document_invalid`); historical entries may come without one. Re-importing an identical bundle returns `appended: 0` and writes nothing. A workspace may have only one writing source at a time, or the chain forks.

Audit: a successful write adds one row in the same transaction whose payload holds only `seq` (or the seq range), entry hash, previous hash, document hash and source. It never holds the OWNER's words or document content, because the audit log is readable beyond the OWNER. Refused attempts write nothing; the command's closed code is the record.

Residual risk: `--actor-user-id` is declared by the operator, not authenticated. Someone holding the operator database identity could still enter the OWNER's userId. Mitigations are the words sealed in the chain, the audit row and a console that shows the head `seq` and hash for the OWNER to compare; a signature lock is out of scope here.

## Reads

```ts
type CaioGoalLedgerRead =
  | { state: "empty" }                                  // never written
  | { state: "ok"; head: CaioGoalLedgerHeadView; document: CaioGoalLedgerDocument;
      sealedDigests: Readonly<Record<string, string>> } // the head entry's files
  | { state: "rejected"; alarm: { code: CaioGoalLedgerAlarmCode; atSeq: number | null;
      verifiedThroughSeq: number; entryCount: number } }
  | { state: "unavailable"; reason: "schema_not_ready" | "read_failed" };
```

- Closed alarm codes: `seq_gap`, `prev_hash_mismatch`, `entry_hash_mismatch`, `entry_shape_invalid`, `column_mismatch`, `head_anchor_missing`, `head_anchor_mismatch`, `document_missing`, `document_hash_mismatch`, `document_invalid`.
- Every read verifies from entry 1 to the head, without a cache. Only the stored text is trusted: `seq`, hashes and effective time are recomputed from the entry and document text, and a column that disagrees is `column_mismatch`. A deleted tail leaves a self-consistent chain; the head anchor catches it.
- `rejected` carries no `document` and never falls back to an earlier valid version; it gives the break point and how far the chain verified.
- A missing table or a failed query is `unavailable`, never `empty`.
- The only visible alarms in this module are a `rejected` read and `--verify` ending with exit code 3. Rendering and in-app notification belong to the downstream console slice.

Metrics never show a made-up 0: `projectCaioGoalReadouts(document, kpis)` looks each metric up by `key` among the northstar KPI sources. A match with the same unit is taken as is (`measured` / `pending_source` / `no_data`); no match or a different unit becomes `pending_source` with `value: null` and a non-empty note. Every output passes `validateNorthstarKpis`. A source that explicitly reports `measured` with 0 shows 0. Core itself has no KPI source, so until an overlay connects one every metric is `pending_source`.

## Data layer

- `CaioGoalLedgerEntry`: `id`, `workspaceId`, `seq`, `entryHash`, `prevHash`, `entryJson` (canonical entry text; timestamps stay text), `documentFileKey`, `documentHash`, `documentText` (document text, byte for byte), `effectiveAt` (derived index column), `source` (`command` / `import`), `recordedByUserId`, `createdAt`. Unique keys as above; CHECK constraints cover seq ≥ 1, hash lengths, the genesis entry if and only if 64 `0`s, the source values, valid JSON and the three document columns being all null or all set.
- `CaioGoalLedgerHead`: one row per workspace with `headSeq`, `headHash`, `rowVersion`, `updatedByUserId`, `updatedAt`.
- New tables only, no database foreign keys, no triggers; append-only is enforced by grants. The rollback script refuses while either table holds a row. The migration ships with its upgrade note; the module adds no environment switch.
- Not added to the attention schema-readiness manifest (that would tie its release gate to this migration); `lib/caio-goal-ledger/schema-readiness.ts` is separate.

| Table | Reader identity | Operator identity |
|---|---|---|
| `CaioGoalLedgerEntry` | SELECT | SELECT, INSERT |
| `CaioGoalLedgerHead` | SELECT | SELECT, INSERT, UPDATE |
| `CaioAttentionRouteConfig`, `CaioAttentionRouteConfigHead` | SELECT | SELECT |
| `Membership` | none | SELECT |
| `AuditLog` | none | SELECT, INSERT |

## PR order

Each PR rolls back on its own, at most 800 lines and 15 files.

| PR | Content |
|---|---|
| PR-0 | This document and its Chinese main text, docs index, status table |
| PR-1 | Pure contracts: canonical JSON and hashing, entry and document contracts; export the attention role-key pattern |
| PR-2 | Pure chain verification, metric readout projection, role-binding resolution, synthetic fixtures |
| PR-3 | Data layer: schema, migration, rollback script, upgrade note, readiness probe, grant matrix |
| PR-4 | Read access: store port, Prisma read adapter, in-memory store, read service |
| PR-5 | Write access and the isolated MySQL suite |
| PR-6 | Controlled command, structural guard, command usage and status update |

PR-3 may run in parallel with PR-2.

## Interface boundary for downstream slices

Downstream code calls only these functions and never imports the write service.

- Shared: `readCaioGoalLedger({ workspaceId })`; `readCaioGoalLedgerRoleBindings({ workspaceId, pin })`, returning `match` / `drift` / `route_config_missing` / `unavailable`.
- Console (OWNER read-only): `readCaioGoalLedgerHistory` includes the OWNER's words, so callers gate on OWNER first; `rejected` and `unavailable` must render as alarms, never as an empty state; show the head `seq` and hash. `projectCaioGoalReadouts` gives each goal's three-state metrics.
- Attention detectors: `resolveCaioGoalLedgerComponentRole`, `resolveCaioGoalLedgerGateHolder`, `evaluateCaioGoalThresholdEcho` (`unset` / `match` / `mismatch`). When the active route-config version differs from the pin, prefill must be blocked; when a route rule's primary role differs from the ledger, the ledger wins and the route is blocked; when the ledger is not `ok`, detectors record `SKIPPED`, not `NO_HIT`; a `mismatch` threshold readout never counts as measured.
- Member brief (`get_my_brief`): `selectCaioGoalLedgerForRoles(document, roleKeys)` returns only the components and gates of the member's roles; members never get the OWNER's words, change notes or sealed digests; goal text goes through the member gateway's projection ladder; the brief section shows an alarm (`ledger_rejected` / `ledger_unavailable` / `role_binding_drift`) when the ledger is not usable.

## Change log

- 2026-11-17: first planning version; code not merged.
