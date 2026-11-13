---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-11-10
review_after: 2026-12-10
public_safety: Public source contract and synthetic test verification only. No real key, grant, deployment approval, payment, credential or customer data.
---

# Billing internal routes and service grants / 内部计费路由与服务身份

S3-b3 (Core): migration `20261110230000_billing_service_grants`, `lib/billing/internal/{service-auth,internal-routes}.ts`,
`app/api/internal/billing/v1/<operation>/route.ts`. Routes speak the S3 internal protocol (`BillingCoreClient`): `POST` a JSON
request, the response body is the library result `{ ok: true, ... }` or `{ ok: false, code }`. 普通用户、会话或 Cookie 一律无权调用。

- **Gate**: `HELM_BILLING_INTERNAL_ROUTES_ENABLED` (deployment capability `billing_internal_route`, safe default deny). Anything but
  `true` answers `404 { error: "NOT_FOUND" }` before reading the body or any grant; callers treat any non-protocol response as
  `core_unavailable` (fail closed, do not execute).
- **BillingServiceGrant** (LLMSpendIssuerGrant pattern, protocol v3.7): `id`, `issuerRef`, canonical sorted `scopesJson`
  (`quote`, `reserve`, `settle`, `release`, `mark-unknown`, `balance-status`; `resolve-unknown` is the reconciliation channel and only ever
  alone, DB CHECK), the caller's Ed25519 `publicKeyPem` + `keyFingerprint` (sha256 of SPKI DER, unique), `approvalRef`,
  `createdBy`, `contentHash` (`billingServiceGrantHash`), `validFrom/validUntil`, one-way `revokedAt/revokedBy`. Immutable and
  undeletable (triggers); none exists by default and there is no issuance API: rows come only from the reviewed operator
  CLI `npm run billing:service-grant` (see *Issuance, rotation and revocation* below).
  **Core holds no shared secret**; the private key stays with the caller (server side).
- **Pins** (non-secret env, JSON): `HELM_BILLING_SERVICE_GRANT_PINS = { "<grantId>": "sha256:<contentHash>" }`, the counterpart
  of LLM `trustedIssuerGrants`: a grant is trusted only while pinned to its current hash (which covers the public key and
  `issuerRef`); empty or malformed pins trust nothing. Revocation is immediate (checked per request with database time).
- **Rotation** (v3.9): provision a new grant with the **same `issuerRef`** and the new public key, pin both, switch the caller,
  revoke the old grant, then unpin it (steps below). The new grant keeps settling, releasing and marking unknown the reservations the old
  one made. Emergency revocation (e.g. a leaked key) is the same: issue a replacement for the same issuer and continue. If the
  whole issuer is retired, its held reservations go to the S5 aged-reservation reconciliation, with evidence.
- **Signature**: headers `x-helm-billing-grant`, `x-helm-billing-timestamp` (Unix ms), `x-helm-billing-nonce`
  (`[A-Za-z0-9_-]{16,64}`), `x-helm-billing-signature = v1=<base64 Ed25519 signature>` over
  `helm-billing-internal/v1\nMETHOD\npath\ngrantId\ntimestamp\nnonce\nsha256hex(raw body bytes)` (`signBillingInternalRequest`;
  canonical base64 of 64 bytes only). **The query string is not signed, so these routes never read the query.** The body is
  read as a stream and cut off past 16 KiB (413, before any grant or nonce, Content-Length or not); the exact signed bytes are
  strictly UTF-8 decoded (BOM or invalid UTF-8 is `request_invalid`). Pins are checked before the database is read. The row's
  key must be an Ed25519 SPKI public key (a private PEM is refused, also by DB CHECK) matching its fingerprint; timestamp
  within 300 s of database time; the nonce row is committed before the operation, so a replay is refused even if the
  operation failed (a retry signs a new nonce; the idempotencyKey replays). Expired nonces are purged (100 per request, 60 s margin). Every refusal is `service_unauthorized` (401; missing
  scope 403); logs carry only a fixed reason, never signatures, ids or bodies.
- **Issuer isolation** (v3.8, bound to `issuerRef` by v3.9): the actor is `SYSTEM:billing-service:<issuerRef>/<grantId>`
  (`createdBy`/`resolvedBy`; `issuerRef` matches `[a-z0-9][a-z0-9._-]{0,63}`, DB CHECK, which since migration
  `20261111100000_billing_service_grant_issuer_check` also refuses a trailing line terminator that ICU `$` let through). A reservation belongs to its issuer:
  settle/release/markUnknown from another issuer see it as absent (`reservation_state_conflict`, before any operationRef
  check); a reserve key replays only within its issuer (`idempotency_conflict` otherwise). `resolveUnknown` (reconciliation
  grants only) works across issuers, as release or settle. Issuers are compared whole (`issuer-a` never owns `issuer-a.b`), and
  a library caller's actor ref under the `billing-service:` prefix that is not exactly `billing-service:<issuerRef>/<grantId>`
  (grantId as the header format) is `request_invalid`, so it can never be owned by its literal ref.
- **Status mapping**: ok 200; `request_invalid` 400 (unknown/extra fields, wrong JSON types, formats; body > 16 KiB is 413);
  `idempotency_conflict`, `reservation_state_conflict`, `unknown_resolution_conflict`, `mode_mismatch` 409; business refusals
  422; `core_unavailable` 503 (deadlock 1213, lock timeout 1205, write conflict P2002/raw 1062, a lost connection or
  transaction timeout P1001/P1002/P1008/P1017/P2024/P2028, or the database failing during authentication). Anything else
  thrown by an operation (e.g. `reservation_invariant_breach`, or a dropped connection surfacing as P2010 without a MySQL code)
  is 500 `internal_error` (v3.7) with a structured `[billing-internal]` alert. Both are equally safe and handled alike: the
  outcome is unknown, so the caller stays pending, alerts, backs off and **retries with the same idempotencyKey**; it never
  releases or changes the key. A `reserve` answered `core_unavailable` or `internal_error` must be retried with the same key
  before the work is abandoned (the reservation may exist; the retry replays it or refuses).
- **Operations** (path = scope): `quote` (`subjectScope` `{ kind: "workspace", workspaceId }`; vault is `request_invalid` until
  S3-f), `reserve` (required `subjectScope`, the same shape as quote, plus `payerRef` from quote: refused as
  `grant_not_active` unless that workspace's current binding names `payerRef`; see BILLING_RESERVATIONS.md "Payer binding"), `settle`, `release` (`not_executed|failed|partial_unusable`), `mark-unknown`, `balance-status` (below), and `resolve-unknown`
  (`outcome: settled` with `quantityUsed`, or `released`) for reconciliation grants only. Library semantics:
  [BILLING_RESERVATIONS.md](BILLING_RESERVATIONS.md); the authenticated grant is the actor
  (`SYSTEM:billing-service:<issuerRef>/<grantId>` in `createdBy`/`resolvedBy`).
- **balance-status** (C-BAL, protocol v3.10; scope `balance-status`, read-only, `lib/billing/balance/balance-status.ts`): request
  `{ workspaceIds: [...] }`, 1-50 distinct ids (empty, more than 50, duplicates, bad formats or extra fields are
  `request_invalid`). Answer `{ ok: true, results: [...] }` in request order; per workspace either `{ workspaceId, ok: true,
  billingMode, payerStatus, balanceFen, headroomFen, overdraftUsedFen, arrears, arrearsReason, asOf }` or, with no active
  binding, `{ workspaceId, ok: false, code: "billing_mode_off" }` (not billed). Signed integer fen strings:
  `balanceFen = wallet - creditUsed - overdraftUsed` (may be negative; creditUsed is the `credit_receivable` projection, so a
  closed facility's draws still count); `headroomFen = wallet + creditRemaining - held` is the reserve admission formula
  (remaining credit of the drawable, in-term facility, 0 for a payer that is not active; held = enforce `held`/`unknown`
  reservations). `headroomFen` includes remaining credit: a stop/go input only, clients must never display it as a balance.
  `overdraftUsedFen` is always `"0"` until the overdraft slice adds its account. `payerStatus` is the PayerAccount status
  (`active|suspended|closed`); numbers are returned in every mode and status, `off` included.
  **`arrears`** is the one boolean callers gate on (only for `billingMode: "enforce"`), with two causes in `arrearsReason`:
  `funds` when `headroomFen <= 0` (Q8), `payer_inactive` when an enforce payer is suspended or closed (coordinator 11-12: Core
  refuses its new reserves, so work would run unbilled); `payer_inactive` wins when both hold, `null` when not in arrears.
  One lock-free statement per batch: a consistent read that never waits on, or delays, a reserve or settle. Writes only the
  auth nonce. The wallet read (`/api/billing/v1/wallet`) carries the same `balanceFen`, `headroomFen` and `arrears` next to
  `availableFen` (unchanged: wallet projection only).
- **Member balance view** (B-1, library only, no route; `lib/billing/balance/member-balance.ts`
  `readMemberBalanceSummaryInTransaction(tx, { workspaceId, userId })`): the balance a workspace member may see, for a caller
  that already authenticated that member (the Overlay seat device channel). Role rule: any ACTIVE, unscoped member of an
  ACTIVE workspace reads it, anyone else is `balance_forbidden`. Answer `{ canTopUp, topUpUrl, payer }`: `payer` is null for
  an unbound workspace, otherwise `{ billingMode, payerStatus, balanceFen, arrears, arrearsReason, asOf }` from the same
  summary as `balance-status` (bigint fen; no headroom, ledger, transaction, reservation or payer ids). `canTopUp` is the
  top-up page's rule: OWNER or BILLING_ADMIN, payer in shadow or enforce, `alipayTopupGateOpen` and a usable `APP_URL`;
  only then `topUpUrl` = `APP_URL` + `/billing/topup` (no prefill). Two plain statements, lock-free under READ COMMITTED or
  REPEATABLE READ; under SERIALIZABLE InnoDB would take shared locks a settle waits on, so callers must not use it there.
  Verified by `member-balance.mysql.test.ts` in `npm run test:billing:mysql` (roles, scoped/inactive/foreign/suspended
  readers, unbound and off payers, gate and `APP_URL` closures, no wait on a locked projection row). Reverting it removes
  only this function (no migration, no data).
- **Scope list, single source**: `BILLING_SERVICE_SCOPES` is both what a grant may declare (verifier and issuance CLI) and what
  routes accept; there is no separate declarable list.
- **reserve** `expectedMode` (v3.4, optional `shadow|enforce`): a payer in the other mode is `mode_mismatch` before any bucket
  or reservation row; a replay of the key is also checked against it (not part of the content hash).
- **Verify / rollback**: `npm run test:billing:mysql` (`internal-routes.mysql.test.ts`: gate, signature/expiry/replay/scope/
  revocation/pin/validity/content hash/scope canonicality/public key, bounded and exact body bytes, shape and refusal
  mapping, expectedMode, issuer isolation and rotation, connection-error mapping, every operation, separate reconciliation
  grant, invariant alert, trailing-terminator issuerRef) and `balance-status.mysql.test.ts` (wallet 0 + 1M yuan credit through
  holds, unknown, full/partial settles and releases; reserve boundary at headroom 0; closed, lapsed and non-active credit;
  every mode, unbound, order; batch shape; gate, scope, signature; consistent lock-free read under concurrent settles; arrears causes). Roll back: unset the gate, then
  `prisma/rollback/20261111_rollback_billing_service_grant_issuer_check.sql` (restores the original CHECK), then
  `prisma/rollback/20261110_rollback_billing_service_grants.sql` (refuses while any grant or nonce row exists or a later billing
  migration is applied). Run them before the
  S2-c and S2-a rollbacks (their guards refuse while any later billing migration is applied); it does not depend on the
  charges, credit or reservations rollbacks. Reverting C-BAL alone (no migration, no data): unless the scope stays declarable
  through E1c, any grant already issued with `balance-status` then has an unknown scope name and is refused on **every** route
  (`scope_denied`, never broader access): revoke and reissue such grants before reverting.
- **Not here**: limiting a service grant to certain payers or workspaces (deferred: the grant row is immutable and its hash covers
  every field, so a limit means a new hash schema, re-issuing and re-pinning every grant, and re-issuing again on each new binding;
  reserve now checks the binding instead), `claim-verify`, reconcile (S5), the caller
  client (Overlay), CP env-contract entries for the two keys (both non-secret).

## Issuance, rotation and revocation / 签发、轮换与吊销

`npm run billing:service-grant` (`scripts/billing-service-grant.ts`, `lib/billing/internal/service-grant-issuance.ts`) is the
only writer. **Dry run by default**; `--apply` writes. It reads only the caller's Ed25519 public key file (at most 4 KiB; any file
naming a private key is refused before parsing, and the file must be exactly one canonical `-----BEGIN PUBLIC KEY-----`
block, CRLF and surrounding whitespace aside, with nothing before or after it). The private key is generated
and kept on the caller host and never passed to this command. Output is one JSON line; refusals print a fixed code only.

1. **Issue (dry run)**: `npm run billing:service-grant -- issue --grant-id=<id> --issuer=<issuerRef> --scopes=quote,release,reserve,settle
   --public-key-file=<public.pem> --approval-ref=<approval> --created-by=<operator ref>
   --valid-from=<YYYY-MM-DDTHH:mm:ss.sssZ> --valid-until=<...>`. It prints the exact `row`, its `contentHash`
   (`billingServiceGrantHash`, the verifier's function) and `pin` (`{ "<id>": "sha256:..." }`); no database is opened.
   Instants are explicit UTC milliseconds (no default "now"), so the dry-run hash is the stored row's hash. The grant id must
   match the request header format `[a-z0-9][a-z0-9_-]{2,63}`; `resolve-unknown` is only ever issued alone. Scopes are exactly
   `BILLING_SERVICE_SCOPES` (including `balance-status`). `scopesJson` is immutable, so **do not issue a production grant before
   the issuer's scope list is final**; a later scope change means a new grant via rotation.
2. **Review**: a second operator checks the dry-run output against the approval (`approvalRef`), issuer, scopes, validity and
   the public key fingerprint the caller reports.
3. **Apply**: set `DATABASE_URL` explicitly for the target Core database (when it is unset the CLI falls back to `.env.local`
   / `.env` in the working directory) and use an operator database identity that may INSERT and UPDATE `BillingServiceGrant`
   (no other table is written). Before `--apply`, confirm the target database (host, schema, migration
   `20261111100000_billing_service_grant_issuer_check` applied) and that it is the deployment whose pins you will change.
   `revoke` reads the database even in its dry run, so the same applies to it. Then rerun with `--apply`. The row is inserted and re-read in one transaction; a readback whose hash differs rolls
   back (`readback_mismatch`). Rerunning the same issuance replays (`alreadyIssued: true`); a different row under the same id,
   or the same public key under another id, is `grant_conflict` (a key is never reused: rotation always uses a new key).
4. **Pin**: merge the printed `pin` entry into `HELM_BILLING_SERVICE_GRANT_PINS`, keeping existing entries (the value is
   replaced whole; a malformed value trusts nothing). The grant is trusted only after the pin is deployed and the gate is on.
   Verify with a signed probe (a quote for a workspace with no payer binding answers `billing_mode_off`).

**Rotation**: generate a new key pair on the caller host, issue a new grant with the **same `issuerRef`** and a new id (steps
1–3), add its pin next to the old one, switch the caller to the new key and grant id, confirm traffic on the new grant, then
revoke the old grant and finally remove its pin.

**Revocation**: `npm run billing:service-grant -- revoke --grant-id=<id> --revoked-by=<operator ref>` shows the current state;
add `--apply` to set `revokedAt` (database time) and `revokedBy`. It is one-way and immediate (every request checks it);
revoking again changes nothing (`alreadyRevoked: true`). Revoke first; then remove the pin with the next configuration change
(a pin change takes effect only when the deployment reloads its configuration). Rows are never deleted. For a leaked key, revoke at once and rotate as above;
the replacement grant of the same issuer keeps settling and releasing the old grant's reservations.

Verification: `npm run test:billing:mysql` includes `service-grant-issuance.mysql.test.ts` (CLI dry run writes nothing; the
applied row authenticates with the dry-run pin; a pin differing in one character is `grant_untrusted`; replay and key
conflict; an identical issuance that loses the unique-key race replays; revocation then `grant_inactive`), and the unit test
runs the CLI issue dry run with the database unreachable. Rollback: the CLI adds no schema; issued rows stay as history
(revoke them). Reverting it does not change the verifier (its scope list is `BILLING_SERVICE_SCOPES`, owned by the routes).
