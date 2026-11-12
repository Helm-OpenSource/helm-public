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
  (`quote`, `reserve`, `settle`, `release`, `mark-unknown`; `resolve-unknown` is the reconciliation channel and only ever
  alone, DB CHECK), the caller's Ed25519 `publicKeyPem` + `keyFingerprint` (sha256 of SPKI DER, unique), `approvalRef`,
  `createdBy`, `contentHash` (`billingServiceGrantHash`), `validFrom/validUntil`, one-way `revokedAt/revokedBy`. Immutable and
  undeletable (triggers); none exists by default and there is no issuance API: rows come from a reviewed operator change.
  **Core holds no shared secret**; the private key stays with the caller (server side).
- **Pins** (non-secret env, JSON): `HELM_BILLING_SERVICE_GRANT_PINS = { "<grantId>": "sha256:<contentHash>" }`, the counterpart
  of LLM `trustedIssuerGrants`: a grant is trusted only while pinned to its current hash (which covers the public key and
  `issuerRef`); empty or malformed pins trust nothing. Revocation is immediate (checked per request with database time).
- **Rotation** (v3.9): provision a new grant with the **same `issuerRef`** and the new public key, pin both, switch the caller,
  revoke the old grant, then unpin it. The new grant keeps settling, releasing and marking unknown the reservations the old
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
  `grant_not_active` unless that workspace's current binding names `payerRef`; see BILLING_RESERVATIONS.md "Payer binding"), `settle`, `release` (`not_executed|failed|partial_unusable`), `mark-unknown`, and `resolve-unknown`
  (`outcome: settled` with `quantityUsed`, or `released`) for reconciliation grants only. Library semantics:
  [BILLING_RESERVATIONS.md](BILLING_RESERVATIONS.md); the authenticated grant is the actor
  (`SYSTEM:billing-service:<issuerRef>/<grantId>` in `createdBy`/`resolvedBy`).
- **reserve** `expectedMode` (v3.4, optional `shadow|enforce`): a payer in the other mode is `mode_mismatch` before any bucket
  or reservation row; a replay of the key is also checked against it (not part of the content hash).
- **Verify / rollback**: `npm run test:billing:mysql` (`internal-routes.mysql.test.ts`: gate, signature/expiry/replay/scope/
  revocation/pin/validity/content hash/scope canonicality/public key, bounded and exact body bytes, shape and refusal
  mapping, expectedMode, issuer isolation and rotation, connection-error mapping, every operation, separate reconciliation
  grant, invariant alert, trailing-terminator issuerRef). Roll back: unset the gate, then
  `prisma/rollback/20261111_rollback_billing_service_grant_issuer_check.sql` (restores the original CHECK), then
  `prisma/rollback/20261110_rollback_billing_service_grants.sql` (refuses while any grant or nonce row exists or a later billing
  migration is applied). Run them before the
  S2-c and S2-a rollbacks (their guards refuse while any later billing migration is applied); it does not depend on the
  charges, credit or reservations rollbacks.
- **Not here**: limiting a service grant to certain payers or workspaces (deferred: the grant row is immutable and its hash covers
  every field, so a limit means a new hash schema, re-issuing and re-pinning every grant, and re-issuing again on each new binding;
  reserve now checks the binding instead), `claim-verify`, reconcile (S5), the caller
  client (Overlay), CP env-contract entries for the two keys (both non-secret).
