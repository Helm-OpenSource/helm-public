# CAIO governed read extension

状态：已成形但仍需部署接线；不是已部署功能。This is an explicit composition seam, not an enabled route or a security sandbox.

`createGovernedReadOnlyDispatcher` from `lib/caio-collaboration/governed-readonly` accepts:

- `enabled` (default false), one fixed `workspaceId`, and a closed list of definitions.
- Each definition has `name` (`get_…`), description, strict input schema/JSON schema, strict remote-safe output schema, and a trusted `read(input, context)` port. No mutation/risk/scope override is accepted.
- `authorize(context)` returns a currently valid `GovernedReadGrant` or null. The grant repeats the verified device/actor/workspace/fingerprint/authentication time, includes `caio:operations:read`, `authorizationVersion`, and `expiresAt`. Check live device registration, membership and deployment business permissions here; do not return a grant from caller assertions. The factory checks binding/time before reading and rechecks version before releasing the result.
- `audit(event, signal)` is mandatory, awaited before reading and before success. Audit events contain references and fixed phases, not inputs or output data. Authorization/audit/read exceptions are redacted. A completed audit describes a completed read, not guaranteed client receipt.

`createGovernedReadOnlyIngress` in `lib/caio-collaboration/governed-readonly-ingress` composes that dispatcher behind an explicit deployment-owned POST route. Its trusted `authenticate(Request)` port must verify actual mTLS or a separately authenticated edge and current revocable identity mapping, including authentication audit, source policy and freshness. Return exactly the single operations scope. Never deserialize request JSON as identity, trust an `mtlsVerified` header, or reuse an inference/P1C token as authorization. The request body is only MCP JSON; Core caps it at 32 KiB and a five-second read budget. Ports must honor the cancellation signal and bound their own external I/O.

旧P1C入口与精确两scope信封不变，新scope仅加入类型闭集，不会自动发给任何旧设备。Existing P1C composition remains unchanged; the new factory mounts nothing and does not inherit or widen legacy edge grants. An application must explicitly import, bind and enable it. Tool names are an allowlist, not proof that arbitrary deployment code has no writes: source ports must be independently reviewed as business SELECT-only. Narrow safety audit/rate metadata writes belong to deployment governance.

Deployment owns source-specific authorization, current registration/grant storage and revocation, SQL scoping, redaction, audit persistence and transport credentials. Core has no customer SQL, database grants, default device, or domain. Unavailable data must not be fabricated as zero. Do not turn operational counters into a fake canonical portfolio.

Validation: default disabled; missing/foreign/elevated identity; old scope denied; unknown/write declarations refused; audit-before-read and audit failure; revoked/version-changed/expired grant; cancellation; unexpected output and private exceptions rejected. Public Vitest discovery includes the new tests. Runtime integration, database tests and device connectivity remain deployment-owned acceptance.
