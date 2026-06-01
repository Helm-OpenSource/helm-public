-- MySQL phase2-compatible idempotent patch for BI report extension ownership

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_subscription'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_subscription'
        AND column_name = 'extension_key'
    ),
    'ALTER TABLE `bi_report_subscription` ADD COLUMN `extension_key` LONGTEXT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_run'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_run'
        AND column_name = 'extension_key'
    ),
    'ALTER TABLE `bi_report_run` ADD COLUMN `extension_key` LONGTEXT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_delivery'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_delivery'
        AND column_name = 'extension_key'
    ),
    'ALTER TABLE `bi_report_delivery` ADD COLUMN `extension_key` LONGTEXT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_subscription'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_subscription'
        AND index_name = 'idx_workspace_id_extension_key_enabled'
    ),
    'CREATE INDEX `idx_workspace_id_extension_key_enabled` ON `bi_report_subscription`(`workspace_id`(190), `extension_key`(191), `enabled`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_run'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_run'
        AND index_name = 'idx_workspace_id_extension_key_started'
    ),
    'CREATE INDEX `idx_workspace_id_extension_key_started` ON `bi_report_run`(`workspace_id`(190), `extension_key`(191), `started_at`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_delivery'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'bi_report_delivery'
        AND index_name = 'idx_workspace_id_extension_key_created'
    ),
    'CREATE INDEX `idx_workspace_id_extension_key_created` ON `bi_report_delivery`(`workspace_id`(190), `extension_key`(191), `create_time`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
