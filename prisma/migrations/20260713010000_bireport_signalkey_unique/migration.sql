-- G1 batch-upsert dedup identity for `bireportbusinesssignal` (P3).
--
-- Root cause (prod-measured): createBiReportBusinessSignal was a per-signal
-- find-then-insert (~35k SELECT + ~35k INSERT round trips over the public RDS
-- per G1 round). PR #270's (workspaceId, signalKey, status) index cut the dedup
-- SELECT to ~5ms, but the per-row INSERT round trips remained the bottleneck
-- (~320 rows/min). P3 replaces the per-row path with a chunked
-- `INSERT ... ON DUPLICATE KEY UPDATE`, which requires a UNIQUE key to collide
-- on and REFRESH a re-run in place (preserving the single-row refresh semantics
-- without duplicating rows).
--
-- Final unique-key form: UNIQUE (workspaceId, signalKey).
--   - signalKey is a per-window key (#377), so (workspaceId, signalKey) is
--     logically unique per incident.
--   - `status` is intentionally NOT in the unique key: including it would let a
--     status transition (open -> triaged -> ...) create a second row on the next
--     upsert, breaking dedup. status filtering stays in the read path.
--   - This UNIQUE key supersedes PR #270's non-unique
--     (workspaceId, signalKey, status) probe index (migration
--     20260713000000_bireport_signalkey_index, now in main): the two leading
--     columns already cover the dedup SELECT and are near-unique, so keeping both
--     would only double write-path index maintenance. This migration DROPs the
--     #270 index first (guarded), then adds the unique key.
--
-- WHY UNIQUE IS REQUIRED (prod-measured): 170 duplicate (workspaceId, signalKey)
-- groups already exist in prod — window key (#377) + concurrent persist (#374)
-- produced an insert race with no unique guard to catch it. The unique key both
-- enables ON DUPLICATE KEY UPDATE and prevents this race going forward.
--
-- DEPLOYMENT ORDER (hard dependency — see PR description):
--   1. Duplicate-key cleanup (#3) must remove BOTH legacy-timestamp rows AND the
--      170 window-key duplicate groups (keep newest per (workspaceId, signalKey)),
--      otherwise CREATE UNIQUE INDEX FAILS on the existing duplicates.
--   2. THIS migration (drops the superseded #270 index + adds the unique key).
--   3. Enable the downstream NPA pack batch-persist path (pack PR #378).
-- Fresh/local DBs are always duplicate-free, so this is safe there unconditionally.
--
-- The `bireportbusinesssignal` table is created outside prisma/migrations (see
-- prisma/manual/20260423_bi_report_business_signal_tables.sql, applied AFTER
-- `prisma migrate deploy`). This migration therefore guards on table existence
-- (clean no-op before the table exists — fresh DBs get the unique key from the
-- manual CREATE TABLE) and on index existence (idempotent re-runs). Same
-- idempotent-guard pattern as 20260415170500_workspace_solution_extension_baseline.

-- 1) Drop the superseded non-unique probe index if present (PR #270 /
--    20260713000000_bireport_signalkey_index). IF-EXISTS guarded so this is a
--    clean no-op on DBs where the table/index was never created (manual table).
SET @stmt = (
  SELECT IF(
    EXISTS (
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

-- 2) Add the UNIQUE (workspaceId, signalKey) key.
--    Guarded on table existence (no-op before manual CREATE TABLE) and index
--    existence (idempotent). NOTE: if duplicate (workspaceId, signalKey) rows
--    still exist (cleanup #3 not run), CREATE UNIQUE INDEX will error by design —
--    this migration must run AFTER the cleanup.
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
