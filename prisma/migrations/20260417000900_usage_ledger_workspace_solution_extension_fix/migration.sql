-- Fix CI regressions after MySQL cutover:
-- 1) widen UsageLedger.metadata to LONGTEXT
-- 2) ensure Prisma-expected WorkspaceSolutionExtension table exists
-- 3) backfill rows from legacy workspace_solution_extension table when present

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'UsageLedger'
        AND column_name = 'metadata'
    ),
    'ALTER TABLE `UsageLedger` MODIFY COLUMN `metadata` LONGTEXT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `WorkspaceSolutionExtension` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `extensionKey` VARCHAR(191) NOT NULL,
  `kind` ENUM('TENANT_CUSTOM', 'REUSABLE_EXTENSION') NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `version` VARCHAR(191) NULL,
  `configJson` LONGTEXT NULL,
  `enabledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `disabledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSolutionExtension'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSolutionExtension'
        AND index_name = 'WorkspaceSolutionExtension_workspaceId_extensionKey_key'
    ),
    'CREATE UNIQUE INDEX `WorkspaceSolutionExtension_workspaceId_extensionKey_key` ON `WorkspaceSolutionExtension`(`workspaceId`, `extensionKey`)',
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
        AND table_name = 'WorkspaceSolutionExtension'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSolutionExtension'
        AND index_name = 'WorkspaceSolutionExtension_workspaceId_status_updatedAt_idx'
    ),
    'CREATE INDEX `WorkspaceSolutionExtension_workspaceId_status_updatedAt_idx` ON `WorkspaceSolutionExtension`(`workspaceId`, `status`, `updatedAt`)',
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
        AND table_name = 'WorkspaceSolutionExtension'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSolutionExtension'
        AND index_name = 'WorkspaceSolutionExtension_extensionKey_status_idx'
    ),
    'CREATE INDEX `WorkspaceSolutionExtension_extensionKey_status_idx` ON `WorkspaceSolutionExtension`(`extensionKey`, `status`)',
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
        AND table_name = 'workspace_solution_extension'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSolutionExtension'
    ),
    'INSERT IGNORE INTO `WorkspaceSolutionExtension` (`id`, `workspaceId`, `extensionKey`, `kind`, `status`, `version`, `configJson`, `enabledAt`, `disabledAt`, `createdAt`, `updatedAt`) SELECT `legacy_id`, `workspace_id`, `extension_key`, `kind`, `status`, `version`, `config_json`, `enabled_at`, `disabled_at`, `create_time`, `modify_time` FROM `workspace_solution_extension`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
