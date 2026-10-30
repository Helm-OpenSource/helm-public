-- AuditLog workspace-time indexes (2026-10-30).
--
-- Every AuditLog index starts with workspaceId, but none carries createdAt or
-- actionType, so the hot reads read a workspace's whole audit history and sort it:
--   - workspace timelines, ORDER BY createdAt DESC LIMIT n
--     (features/dashboard/queries.ts, features/internal-operating-workspace/queries.ts,
--      features/memory/queries.ts);
--   - per-action reads and counts, actionType IN (...) [AND createdAt >= ?]
--     (features/dashboard/stage1-owner-loop-query.ts, features/settings/queries.ts,
--      lib/auth/org-admin-governance.ts countAuditActions).
-- On a production deployment with ~10.8M AuditLog rows these took 9-110 s each.
--
-- Additive change, online: ALGORITHM=INPLACE, LOCK=NONE keeps AuditLog readable and
-- writable while each index builds (the statement fails instead of locking if the
-- server cannot honour that). Schedule large tables per the target environment's
-- migration policy. Rollback: DROP INDEX.
--
-- Each index is guarded on its own existence, so the migration is a no-op where an
-- operator already built the same index online under the same name (and replays
-- cleanly). Names and casing compared case-insensitively (lower_case_table_names).
-- Same idempotent-guard pattern as 20260713000000_bireport_signalkey_index.

SET @stmt = (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND LOWER(table_name) = 'auditlog'
        AND LOWER(index_name) = LOWER('AuditLog_workspaceId_createdAt_idx')
    ),
    'CREATE INDEX `AuditLog_workspaceId_createdAt_idx` ON `AuditLog`(`workspaceId`, `createdAt`) ALGORITHM=INPLACE LOCK=NONE',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND LOWER(table_name) = 'auditlog'
        AND LOWER(index_name) = LOWER('AuditLog_workspaceId_actionType_createdAt_idx')
    ),
    'CREATE INDEX `AuditLog_workspaceId_actionType_createdAt_idx` ON `AuditLog`(`workspaceId`, `actionType`, `createdAt`) ALGORITHM=INPLACE LOCK=NONE',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
