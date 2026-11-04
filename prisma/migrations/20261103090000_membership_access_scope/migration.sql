-- Membership.accessScope (2026-11-03): the external member prefix lock (lib/auth/external-member-scope.ts).
--
-- A membership whose accessScope is set belongs to someone from outside the workspace's own team (for example a
-- partner firm's staff working an extension surface); the session resolvers refuse such a member everywhere except
-- the surface an extension registered for that scope. NULL for every existing row, so no member is affected until a scope is written.
--
-- Additive, nullable, at the end of the table: ALGORITHM=INSTANT on MySQL 8.0.29+ (the statement fails instead
-- of copying the table if the server cannot honour it). Rollback: prisma/rollback/20261103_rollback_membership_access_scope.sql.
--
-- Guarded on the column's own existence so the migration replays cleanly; same pattern as
-- 20261030120000_audit_log_workspace_time_indexes.

SET @stmt = (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND LOWER(table_name) = 'membership'
        AND LOWER(column_name) = 'accessscope'
    ),
    'ALTER TABLE `Membership` ADD COLUMN `accessScope` VARCHAR(64) NULL, ALGORITHM=INSTANT',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
