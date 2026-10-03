---
status: active
owner: helm-core
created: 2026-10-03
review_after: 2026-11-03
public_safety: Generic charge-contract candidate; no customer, credential, endpoint, or production evidence.
---

# LLM spend charge contract v2

Status: Core contract, additive schema, and Prisma/MySQL transaction adapter. The governed model gateway now joins reserve+dispatch claim and terminal+settlement in their respective transactions, but its trusted charge authority port has no default implementation. Thus default gateway dispatch is closed; no authoritative price/FX/policy verifier, production migration, deployment, or full-provider enforcement is claimed. The candidate ledger denomination is USD micros. CNY input requires an immutable FX snapshot reference and hash; the reference is recorded evidence, not proof that its issuer is trusted.

## Pre-call contract

`reserveSpend` accepts one immutable `SpendChargeQuote` per provider attempt. It requires an explicit non-negative `maximumChargeMicros`, USD budget currency, provider currency, operation and quote identity, price-book version/hash, policy approval reference, and a matching positive budget config version. USD quotes must not carry FX fields. CNY quotes must carry a complete FX snapshot reference/hash. Invalid or negative bounds fail before a store write; they are never clamped to zero.

The unique `(workspaceId, attemptRef)` row owns the attempt. A retry with the same complete identity is a duplicate and cannot authorize another call. Any changed quote, price, FX, policy mode/limit, period, model, provider, or maximum is a conflict. A period counter freezes the budget config version, mode, limit, and approval reference; a caller cannot reuse one config version with a larger ceiling or silently mix two policies.

The adapter commits the attempt row and counter change in one transaction. It admits only when:

```text
reserved + settled + unknown_bound + invariant_breach_bound + new_maximum <= monthly_budget
```

Explicit unlimited policy still records every maximum. Unconfigured policy fails closed. A signature-shaped string or stored reference never authenticates a price, FX snapshot, or approval; the gateway's separately governed charge authority must verify them inside the claim transaction before reservation.

## Settlement states

- `settled`: a known actual amount at or below the maximum releases the full maximum and adds the actual amount to settled spend.
- `unknown`: missing or ambiguous usage moves the maximum into `unknownBoundMicros`; it remains occupied and duplicates stay terminal.
- `released`: a confirmed non-consumed attempt releases the maximum.
- `invariant_breach`: a known actual amount above the maximum records the observation, moves the admitted maximum into a separate breach bound, and closes that period to new reservations. The adapter does not hide the overrun in the settled counter or free its occupancy.

Missing counters, overflow, state races, and transaction outcomes that are not confirmed roll back or surface as errors. Only confirmed Prisma unique/write conflicts receive bounded transaction retries. A lost commit acknowledgement must be reconciled with the same immutable key; it is not evidence that no write occurred.

## Upgrade and rollback boundary

The historical `20260917200000_llm_spend_ledger_candidate` migration remains byte-identical. The additive `20261003120000_llm_spend_charge_contract_v2` migration marks pre-v2 rows and counters as `contractVersion=1` and `legacy_unknown`; no price, currency, FX, or policy facts are invented. V2 refuses admission against a legacy counter until a future governed reconciliation flow resolves it.

The new columns default new writes from rolled-back v1 code to the same explicit legacy state. A zero-amount compatibility fence serializes v2 admission with a database trigger on legacy ledger inserts; it never stores or derives money. Once a legacy insert commits, the fence remains `legacy_unknown`, later v2 admission refuses, and `readTotals` exposes the quarantine while already-reserved attempts can still use the v2 adapter to settle, become unknown, or release. Database state checks reject an old v1 adapter's settlement of a v2 attempt because v1 cannot record the observed actual or enforce the over-maximum breach state; that transaction leaves the reservation occupied for v2 recovery. Old v1 release/unknown transitions remain compatible. This supports an application-code rollback while retaining the additive schema, but a rollback must still stop new provider dispatch because old code cannot supply v2 price provenance or safely settle v2 known usage. There is deliberately no destructive down migration: once v2 rows exist, removing their columns would destroy charge evidence. Database rollback is forward repair or restore from an independently approved backup.

## Minimal store API and database ACL

The runtime surface is limited to atomic `reserve`, `settle`, `markUnknown`, `release`, `readTotals`, and bounded expired-reservation listing. The store has no API for changing budget policy, approving price books, approving FX, deleting ledger rows, reopening breach periods, or dispatching a provider call.

A deployment role for this adapter must be denied `DELETE`, `TRUNCATE`, `DROP`, and policy/provenance administration. It may receive only the specific `SELECT`, `INSERT`, and `UPDATE` rights needed for `LLMSpendLedgerEntry`, `LLMSpendPeriodCounter`, and the amount-free `LLMSpendPeriodCompatibility` fence, plus read-only access to the later authoritative policy snapshot. It must not receive write access to Workspace budget configuration, price-book/FX authorities, provider credentials, or audit approval sources. CI uses a synthetic database owner to replay migrations, so its green result is transaction evidence and is not proof of least-privilege production grants.

| Role | Allowed | Must be denied |
|---|---|---|
| Runtime adapter | `SELECT`, `INSERT`, `UPDATE` on the two spend tables and compatibility fence; later, `SELECT` on approved policy/price/FX snapshots | `DELETE`, DDL, policy/price/FX writes, credential reads, approval writes |
| Reconciler | Bounded read plus named terminal reconciliation operation when implemented | Direct counter edits, reopening periods, policy/price/FX writes |
| Policy/price/FX authority | Versioned source administration under a separately approved role | Spend-ledger mutation and provider execution |
| Migrator | Time-bounded DDL during an approved window | Provider execution and standing runtime use |

For a staged application rollback, the old runtime role keeps its existing
`SELECT, INSERT, UPDATE` grants on the ledger and counter and receives **no**
grant on `LLMSpendPeriodCompatibility`. The migration-owned trigger runs with
its recorded definer and writes the fence when that old role inserts a legacy
ledger row. The v2 runtime additionally needs `SELECT`, `INSERT`, and only
`UPDATE (id)` on the fence for its idempotent lock statement; it must not have
direct `UPDATE (state)`. Site review must verify the trigger definer is the
approved migration principal and is not a reusable application login.

Site acceptance must save `SHOW GRANTS` for each role and negative executions showing that runtime `DELETE` on the ledger, runtime `UPDATE` on Workspace policy, and runtime DDL all fail. The repository does not create site users or embed grant credentials.

## Evidence and remaining activation gates

The unit suite verifies invalid bounds, immutable identities, config drift, CNY/FX shape, unknown occupancy, breach closure, idempotency, and recovery behavior. The isolated MySQL suite uses separate sessions and verifies contention for the last budget units, atomic rollback, duplicate ownership, terminal transitions, config and quote conflicts, legacy quarantine, overflow, breach closure, and ledger/counter reconciliation. It refuses a non-synthetic database target. CI replays all migrations on an ephemeral MySQL 8.4 service before running these tests.

Activation still requires both remaining layers:

1. A separately governed implementation of the gateway's charge authority must verify budget-policy approval, exact period rule, price book, FX snapshot where applicable, and provider cost observation inside the gateway transactions. The current default is `null` and refuses dispatch. A valid-looking reference or syntactic C1 declaration is not proof.
2. Every chargeable HTTP, worker, retry/provider-attempt, and CAIO path must use an atomic charged gateway. This slice covers the governed sync/deferred gateway only; other call paths have not been migrated. Unknown outcomes stay occupied and do not create zero-cost terminal receipts.

Until both layers and site-specific DDL/ACL approval are proven, this code is not a monthly hard limit. Adding environment keys or recording cost after a call does not close the gate.
