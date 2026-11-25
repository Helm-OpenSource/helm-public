---
status: active
owner: helm-core
created: 2026-11-04
review_after: 2026-12-04
public_safety: Generic workspace membership lifecycle behavior and settings only; no customer, credential or production data.
---

# Membership auto-activation

`Workspace.featureFlagsJson.membershipAutoActivation` controls whether a member's own authenticated first workspace use automatically changes their `INVITED` membership to `ACTIVE`.

## Compatibility and operations

- Missing keys and older workspace settings preserve the existing behavior (enabled). This is a compatibility opt-out, not an opt-in rollout.
- New workspaces use the same enabled default. Workspace owners/admins can disable it in **Settings → Pilot → Automatic invite activation**; the setting change is audited and preserves other feature flag keys.
- No database migration is needed: the existing workspace JSON settings field stores this flag. Existing workspaces that should stop automatic activation must explicitly turn the switch off.

The switch never accepts an invitation or activates a membership on another person's behalf. Only the member's own authenticated login/workspace selection or verified invitation signup flow can trigger the guarded transition. When disabled, an invited membership stays `INVITED`; active-member authorization and a workspace-bound signup session are not granted. Verified signup returns the member to `/invite-pending`, which explains that the owner/admin may review the setting and that only the member can complete a later login. The transition uses an `INVITED` compare-and-swap and records the member as actor in the same transaction as the audit row. A concurrent revocation remains authoritative.

## Account password management / 账号密码管理

Open `/account/security` from the desktop topbar or mobile settings menu. The page uses the current workspace membership; it adds no deployment switch or secret.
从顶部「账号安全」或移动端设置进入。成员修改自己的密码时必须验证当前密码；成功后重新登录。

- Self change requires an active, unscoped membership, active workspace and live PASSWORD session, plus the current password.
- Owner can reset another active member of the same workspace. Admin can reset non-Owner/non-Admin members. An explicit member selection and reset submission are required; the administrator types their own current password.
- Global identities with any non-inactive membership in another workspace are excluded from administrative reset. Use self change for these identities. Invited/passwordless users continue through first activation.
- New passwords follow the existing 8–256 character policy with letters and digits. Unchanged passwords are refused. There is no automatic delivery, forced-change flag, recovery link or external message.
- 重置成功后，请通过已有私密渠道交付新密码；成员可再自行修改。管理员不能重置其他组织的账号；Admin 不能重置 Owner 或其他 Admin。

## Atomicity and failure behavior / 原子性与失败行为

A bounded Serializable transaction rechecks session, membership, role, target scope, current hash and the account's existing failed-login counter. Eight wrong step-ups within fifteen minutes lock further attempts for fifteen minutes; counter storage failure refuses the operation. Wrong attempts commit only their counter. Password hash and strictly increasing passwordSetAt, all browser-session revocations, unused activation-token revocations, approved/active device revocations and secret-free audit commit together. Device observers are notified only after commit. Audit/device failure rolls back the change; conflicts are refused without blind retry. In-flight password sign-in and session rotation recheck their credential/session in Serializable transactions.

修改密码、撤销已有网页登录和桌面设备授权、审计在同一事务完成。未确认的响应不代表失败；先尝试新密码登录，避免反复重置。密码重置不会撤销企业 SSO 提供者本身的身份，也不更改独立 API 凭据。

## Integration and validation / 集成与验证

No schema migration, release-time SQL, new ACL or environment value is introduced. Runtime writes reuse User, AuthSession, FailedLoginAttempt, MemberActivationToken, SeatDeviceAuthorization and AuditLog. Deployments must already provide their existing schema and SELECT/required UPDATE/INSERT permissions; lack of any required dependency refuses the transaction. Source assembly includes the ordinary Core app/features/lib paths. Pin the reviewed Core SHA in the consumer's normal release BOM; deployment and production readback are separate authorized stages. Rolling code back does not restore old passwords or revoked sessions.

The PR-triggered CI `Password Management` job migrates a disposable MySQL database, runs the real transaction suite and existing auth/session regressions, then builds the production app and runs Chromium desktop/narrow-screen flows. Failed commands stop the job. Local commands:

```sh
PASSWORD_MANAGEMENT_MYSQL_REQUIRED=1 PASSWORD_MANAGEMENT_DATABASE_URL="$DATABASE_URL" npx vitest run lib/auth/password-management.mysql.test.ts --config vitest.public.config.ts --fileParallelism=false
npx vitest run lib/auth/session.test.ts features/auth/actions.test.ts lib/seat-device/password-write-gate.test.ts --config vitest.public.config.ts
npx playwright test tests/e2e/password-management.spec.ts
```

Use only disposable databases and synthetic identities. The required integration suite fails if its database input is absent. The global User model is tested with synthetic independent-workspace and shared-identity cases; no tenant-specific contract is introduced.
