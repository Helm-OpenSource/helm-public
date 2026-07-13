-- G1 dedup hot-path index for `bireportbusinesssignal`.
--
-- createBiReportBusinessSignal runs a find-then-insert dedup lookup:
--   SELECT ... WHERE workspaceId=? AND signalKey=? AND status IN ('open','triaged','actioned') LIMIT 1
-- No existing index supports the signal-key predicate alongside workspace and
-- live status, so the lookup degrades to scanning as the signal table grows.
--
-- Additive change. CREATE INDEX can briefly acquire a metadata lock; schedule
-- deployment according to the target environment's migration policy.
-- Rollback: DROP INDEX.
--
-- The `bireportbusinesssignal` table is created outside prisma/migrations (see
-- prisma/manual/20260423_bi_report_business_signal_tables.sql, applied AFTER
-- `prisma migrate deploy`). This migration therefore guards on table existence
-- so it is a clean no-op when the table has not been created yet (fresh/local
-- DBs get the index from the manual CREATE TABLE), and guards on index
-- existence so it is a no-op when the index already exists.
-- Same idempotent-guard pattern as
-- 20260415170500_workspace_solution_extension_baseline.

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
        AND index_name = 'bireportbusinesssignal_workspace_signalkey_status_idx'
    ),
    'CREATE INDEX `bireportbusinesssignal_workspace_signalkey_status_idx` ON `bireportbusinesssignal`(`workspaceId`, `signalKey`, `status`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
