-- Add the logical identity required by atomic single-row and batch upserts.
--
-- Existing databases must reconcile duplicate (workspaceId, signalKey) rows
-- before applying this migration. The replacement unique key is created before
-- the superseded probe index is removed. If duplicate data makes unique-key
-- creation fail, the previous index therefore remains available for recovery.
--
-- The table is created by the manual BI report schema after Prisma migrations
-- on fresh databases. Each statement is guarded so that flow remains a no-op;
-- the manual CREATE TABLE already includes the final unique key.

-- 1) Add UNIQUE (workspaceId, signalKey) when the table exists.
SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'bireportbusinesssignal'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'bireportbusinesssignal'
        AND index_name = 'bireportbusinesssignal_workspace_signalkey_key'
    ),
    'CREATE UNIQUE INDEX `bireportbusinesssignal_workspace_signalkey_key` ON `bireportbusinesssignal`(`workspaceId`, `signalKey`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Remove the superseded probe index only after the unique key exists.
SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'bireportbusinesssignal'
        AND index_name = 'bireportbusinesssignal_workspace_signalkey_key'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'bireportbusinesssignal'
        AND index_name = 'bireportbusinesssignal_workspace_signalkey_status_idx'
    ),
    'DROP INDEX `bireportbusinesssignal_workspace_signalkey_status_idx` ON `bireportbusinesssignal`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
