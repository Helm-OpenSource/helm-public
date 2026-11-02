-- Rollback of 20261103090000_membership_access_scope: drop Membership.accessScope.
-- Run only after every external member has been removed or re-scoped by its operator tooling: dropping the
-- column turns every external member back into a normal member of the workspace.
ALTER TABLE `Membership` DROP COLUMN `accessScope`;
