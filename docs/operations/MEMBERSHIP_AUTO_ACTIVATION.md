# Membership auto-activation

`Workspace.featureFlagsJson.membershipAutoActivation` controls whether a member's own authenticated first workspace use automatically changes their `INVITED` membership to `ACTIVE`.

## Compatibility and operations

- Missing keys and older workspace settings preserve the existing behavior (enabled). This is a compatibility opt-out, not an opt-in rollout.
- New workspaces use the same enabled default. Workspace owners/admins can disable it in **Settings → Pilot → Automatic invite activation**; the setting change is audited and preserves other feature flag keys.
- No database migration is needed: the existing workspace JSON settings field stores this flag. Existing workspaces that should stop automatic activation must explicitly turn the switch off.

The switch never accepts an invitation or activates a membership on another person's behalf. Only the member's own authenticated login/workspace selection or verified invitation signup flow can trigger the guarded transition. When disabled, an invited membership stays `INVITED`; active-member authorization is not granted. The transition uses an `INVITED` compare-and-swap and records the member as actor in the same transaction as the audit row. A concurrent revocation remains authoritative.
