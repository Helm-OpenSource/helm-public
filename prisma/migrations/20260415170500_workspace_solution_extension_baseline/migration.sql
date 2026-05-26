-- MySQL phase2-compatible idempotent baseline for workspace solution extension

CREATE TABLE IF NOT EXISTS `workspace_solution_extension` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `legacy_id` VARCHAR(191) NOT NULL DEFAULT (UUID()) COMMENT '兼容字符串ID',
  `workspace_id` VARCHAR(191) NOT NULL COMMENT '工作区ID',
  `extension_key` VARCHAR(191) NOT NULL COMMENT '扩展键',
  `kind` ENUM('TENANT_CUSTOM', 'REUSABLE_EXTENSION') NOT NULL COMMENT '扩展类型',
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE' COMMENT '状态',
  `version` VARCHAR(191) NULL COMMENT '版本',
  `config_json` LONGTEXT NULL COMMENT '配置JSON',
  `enabled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '启用时间',
  `disabled_at` DATETIME(3) NULL COMMENT '禁用时间',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `modify_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_legacy_id`(`legacy_id`(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作区解决方案扩展';

SET @stmt = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'workspace_solution_extension'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'workspace_solution_extension'
        AND index_name = 'uk_workspace_id_extension_key'
    ),
    'CREATE UNIQUE INDEX `uk_workspace_id_extension_key` ON `workspace_solution_extension`(`workspace_id`(190), `extension_key`(190))',
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
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'workspace_solution_extension'
        AND index_name = 'idx_workspace_id_status_modify_time'
    ),
    'CREATE INDEX `idx_workspace_id_status_modify_time` ON `workspace_solution_extension`(`workspace_id`(190), `status`, `modify_time`)',
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
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'workspace_solution_extension'
        AND index_name = 'idx_extension_key_status'
    ),
    'CREATE INDEX `idx_extension_key_status` ON `workspace_solution_extension`(`extension_key`(190), `status`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
