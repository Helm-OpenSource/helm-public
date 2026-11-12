---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real credit line, approval, payment, credential or customer data.
---

# Billing credit facilities / 授信额度

Billing V1 S3-e (Core): migrations `20261110215000_billing_credit_facilities` and `20261110220000_billing_credit_funds_enums`
(full funds ENUM union, protocol v3.6), `lib/billing/credit/credit-facilities.ts`; operator CLI and batch issuance
`lib/billing/credit/credit-operator.ts` (see **Operator CLI**). No route, UI or repayment.
没有授信记录即授信为 0；批量发放用下文运维命令，还款、应收与对账在 S5。

- **State**: `draft -> approved -> active -> reduced* -> expired | revoked`; revoke also cancels a draft or approved line. One
  `active`/`reduced` facility per payer (UNIQUE `activePayerAccountId`). Approval freezes `approvedLimitFen`; `limitFen` and `usedFen`
  never exceed it (CHECK). Triggers: INSERT only as a fresh draft; payer, key, proposer, evidence, term and approval frozen; terminal
  states final; `limitFen` only falls on reduce. `version` (+1 per lifecycle step, `expectedVersion` CAS) is not bumped by draws, so
  operators are not raced by usage. No DELETE. Times are database `UTC_TIMESTAMP(3)`.
- **Who**: a platform finance **maker** (S2-c `PlatformFinanceGrant`) proposes `limitFen > 0`, optional `validUntil`, `evidenceRef`
  (same `operationKey` + content replays); a **different checker** approves (service and DB CHECK). Activate, reduce, expire and
  revoke take any platform finance role (they only keep or shrink exposure). Workspace OWNER/BILLING_ADMIN and `SYSTEM` identities
  have no lifecycle path. AuditLog in the same transaction, in the actor's reserved workspace (as S2-c).
- **Tightening**: reducing below `usedFen` refuses `credit_reduce_below_used` (never clamped or forgiven). Revoke, reduce and expiry
  bind every reservation taken afterwards and keep outstanding `usedFen`; a reservation **held before** them still settles, capped at
  `approvedLimitFen` (S0 §5); after several reduces, any reduce later than `reservedAt` (`lastReducedAt`) puts such a reservation back
  on `approvedLimitFen`. V1 has no separate freeze: freezing is reduce-to-used, irreversible; restoring needs a new facility.
- **Operations**: a facility past `validUntil` stays `active` and holds the per-payer key until `expire` runs; expire it, or
  activate its successor with `--supersedes-*` (below), which revokes it in the same transaction.
- **Seam for S3-b**, under the `PayerAccount` lock (re-taken, re-entrant): `availableCreditFen(tx, payerAccountId): Promise<bigint>`
  is `max(0, limitFen - usedFen)` of the active, in-term facility, else `0n` (also for a non-active payer), without netting held
  reservations. `drawCreditShortfallInTransaction(tx, { payerAccountId, chargeFen, sourceRef, actor, reservedAt })` borrows only
  `max(0, chargeFen - wallet)` as one balanced `credit_draw` (debit `credit_receivable`, credit `customer_wallet_available`), `usedFen
  += shortfall`; the caller then charges the wallet in full. Shortfall 0 writes nothing (`walletCovered`). Refuses
  `credit_insufficient`, `credit_not_active`, `payer_account_unavailable`. Key `credit-draw:<sourceRef>` returns a recorded draw; do
  not call it again when replaying a settled reservation. **Wiring (S3-w, done)**: reserve sufficiency calls `availableCreditFen`;
  enforce settle (and `resolveUnknown` settled) draws with `reservedAt` read from the `BillingReservation` row it locked (state
  `held`/`unknown`) and `sourceRef` `reservation:<id>`, after its replay return, never for 0 fen or shadow. A `reservation:` sourceRef
  is verified in-lock: it must name this payer's held/unknown enforce reservation, carry its own `reservedAt` and a `chargeFen`
  within its cap, else `credit_input_invalid`. Only such a bound draw is allowed for a suspended/off payer (R05, protocol v3.5 §3; the funds journal
  applies the same binding, as for `charge`); any other sourceRef needs an active payer. A `reservedAt` later than database time
  refuses `credit_input_invalid`. Lock order: PayerAccount -> BillingReservation (share) -> FundsTransaction (share) ->
  CreditFacility -> wallet projection -> journal posting. Only this module posts `credit_draw`; it is never reversed as a correction. S5 reconciliation must check the invariant `credit_receivable` projection = Σ `usedFen`.
- **Verify / rollback**: unit `credit-facilities.test.ts`; `npm run test:billing:mysql`. Rollback: stop calling the service;
  `prisma/rollback/20261110_rollback_billing_credit_facilities.sql` refuses while any facility or credit journal row exists, removes
  both migrations and shrinks the ENUMs to the union minus `credit_draw` / `credit_receivable`. Order: S3-e first, then S3-b2 charges,
  then reservations / S2-c.

## Operator CLI / 运维命令

`npm run billing:credit-operator -- <command> --flag=value ... [--apply]`; no HTTP route. Without `--apply` nothing is written
(single commands print the parsed input and the facility row; `batch` prints the plan). Output is one JSON document, amounts are
integer fen strings; exit 0 ok, 1 refusal (or a failed/blocked entry, or nothing run, in an `--apply` batch), 2 usage. Every write
goes through the service above: finance roles, maker ≠ checker, version CAS, AuditLog in the same transaction.

| Command | Flags | Role |
|---|---|---|
| `show` | `--workspace-id` or `--payer-account-id` | read only |
| `propose` | `--actor-user-id --workspace-id/--payer-account-id --limit-fen --operation-key --evidence-ref [--valid-until] [--max-limit-fen]` | maker |
| `approve` | `--actor-user-id --facility-id --expected-version --evidence-ref [--max-limit-fen]` | checker |
| `expire` / `revoke` | `--actor-user-id --facility-id --expected-version --evidence-ref` | any finance |
| `reduce` | same + `--limit-fen` (lower, ≥ `usedFen`) | any finance |
| `activate` | same + optional `--supersedes-facility-id --supersedes-version` | any finance |
| `batch` | `--list-file [--maker-user-id --checker-user-id]`; to write `--step=propose\|approve\|activate --actor-user-id --expect-list-sha --expect-plan-sha --apply` | per step |

- **Identity**: `--actor-user-id` is declared, not authenticated (as `caio:governance-operator`); roles are read from
  `PlatformFinanceGrant` in the write transaction. The code-level maker ≠ checker rule therefore prevents mistakes, not one person
  with database access acting twice; two people must each run their own step from their own session and keep the output.
- **Amounts**: integer fen only (`100000000` = 1,000,000 CNY); no yuan or decimals. The per-payer cap is checked in the CLI
  process, not in the service (which only bounds `MAX_FEN`): at propose (single and batch) and again at `approve`. A proposal above
  `--max-limit-fen` (default `100000000`) is refused `limit_over_cap`; equal passes; a raised cap needs both people to pass it.
  Any future route or UI must move the cap into the service.
- **Raising a line (调额，含 10 万 → 100 万)**: there is no increase step (`limitFen` only falls, `approvedLimitFen` is frozen). Propose
  and approve a new facility, then `activate --supersedes-facility-id=<old> --supersedes-version=<v>`: one transaction revokes the old
  line and activates the new one, so the payer is never without a line or with two. Only the payer's own active/reduced line can be
  superseded (`credit_supersede_invalid`). Refused `credit_supersede_in_use` (whole transaction rolled back) if the old line has
  `usedFen > 0`: that usage stays a receivable on the revoked row (Σ `usedFen` still equals `credit_receivable`) and would sit on top
  of the new line, so total exposure = old used + new limit; the owner decides case by case. Reservations held before the swap still
  settle against the old line up to its `approvedLimitFen`, so its usage can grow after the swap and exposure briefly exceeds the new
  limit. A payer's credit used is Σ `usedFen` over all its facilities, closed ones included. Lowering uses `reduce`.
- **Batch list** (operator-supplied; no payer or workspace is in code): `{"v":1,"batchRef":"<a-z0-9._->","evidenceRef":"<ruling
  ref>","validUntil":null,"entries":[{"workspaceId":"…","payerAccountId":"…","limitFen":"100000000"}]}`. A workspace or a payer
  listed twice refuses the whole list (`usage:list_duplicate_workspace` / `usage:list_duplicate_payer`). Each payer is resolved
  through the workspace's active binding and must equal the listed `payerAccountId`; a missing payer is a blocker
  (`payer_missing`), never created here.
- **Plan** per entry (current → target): `done` (drawable line equals target), `propose`, `approve`, `activate` (with supersede when
  a line exists), `reduce` (target below the current line; applied at the activate step, a one-person action), or `blocked`:
  `limit_over_cap`, `payer_missing`, `payer_unavailable`, `payer_mismatch`, `current_past_term` (database clock; expire it first),
  `batch_key_conflict` (same `batchRef` already used with other content, checked before `done`/`reduce`), `target_below_used`,
  `current_in_use`, `batch_facility_closed`, or `plan_failed:<code>` for an unexpected read error.
- **Two digests**: `listSha` (sha256 of the list bytes) binds the run to the list the owner confirmed; `planSha` (sha256 of the
  printed plan: payer, action, current line and version, batch facility per entry) binds it to the plan the executor just read.
  `--apply` re-derives the plan and writes nothing unless both match (`list_sha_mismatch` / `plan_sha_mismatch`).
- **Idempotency / resume**: the operation key is `credit-batch:<batchRef>` per payer; every step re-reads state and acts only on
  entries at that step, so a rerun continues where it stopped. A step that ran nothing while entries wait for another step returns
  `step_nothing_to_do` (exit 1). A propose replays only for the same maker and content (`credit_operation_conflict` otherwise: resume
  with the same maker, or a new `batchRef` after revoking the old batch's draft or approved facilities); of two identical proposes
  racing, one creates and the other replays (the service replays from a locking read; a residual Prisma P2025 on CreditFacility
  would still map to `credit_write_conflict`, nothing written, a rerun replays). Each entry is its own transaction;
  a refusal is recorded and the rest continue; the summary counts actions and results.

### Issuance runbook / 发放 runbook

1. **Dry run**: `batch --list-file=list.json --maker-user-id=<m> --checker-user-id=<c>`. Check `preflight` (both grants, distinct),
   every row's `payerAccountId`, `current` → `targetLimitFen` and `action`, and that blockers are expected.
2. **Owner confirmation**: send the plan and `listSha`; the owner confirms that exact list. Record the confirmed `listSha`; any edit
   changes it.
3. **Preconditions for a swap** (an existing line is superseded): the payer is not in `enforce` yet, or no `held`/`unknown` enforce
   reservation is open for it; otherwise exposure briefly exceeds the new limit (see above).
4. **Execute per step**: before each step, rerun the dry run, compare it with the confirmed plan, and pass its `planSha` with
   `--expect-list-sha=<confirmed listSha> --apply`. `--step=propose` by the maker; `--step=approve` by the checker, who takes the
   `listSha` from the owner's confirmation record, not from the maker; `--step=activate` by either (it also runs any `reduce`, a
   one-person action). Each person runs from their own login and keeps the JSON output as evidence. Rerun a step after a failure.
5. **Read back**: rerun the dry run; every confirmed entry must be `done`. `show --workspace-id=<id>` lists a payer's facilities.

- **Verify / rollback (CLI)**: unit `credit-operator.test.ts`; `credit-operator.mysql.test.ts` in `npm run test:billing:mysql`. The
  CLI adds no schema; to undo an issued line, `revoke` it (usage stays owed) or `reduce` it.
