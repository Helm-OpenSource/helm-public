-- 单一生效 shell surface 的绑定授权表(蓝图 §4.3 绑定即授权)。
-- 每 (workspaceId, surfaceKey) 至多一条,指向要生效的 provider。写入走 MANAGE_WORKSPACE_SETUP
-- + 审计;读侧无绑定 → Core default,绑定失效/越权/版本不兼容在 resolve 时 fail-open 回 Core。
-- 手写迁移(镜像 WorkspaceSolutionExtension DDL);全部语句 IF NOT EXISTS / 幂等,可安全重放。

CREATE TABLE IF NOT EXISTS `WorkspaceSurfaceBinding` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `surfaceKey` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- UNIQUE (workspaceId, surfaceKey):每 workspace 每 surface 至多一条绑定。
SET @stmt = (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSurfaceBinding'
        AND index_name = 'WorkspaceSurfaceBinding_workspaceId_surfaceKey_key'
    ),
    'CREATE UNIQUE INDEX `WorkspaceSurfaceBinding_workspaceId_surfaceKey_key` ON `WorkspaceSurfaceBinding`(`workspaceId`, `surfaceKey`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- INDEX (workspaceId):按 workspace 拉取全部绑定。
SET @stmt = (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSurfaceBinding'
        AND index_name = 'WorkspaceSurfaceBinding_workspaceId_idx'
    ),
    'CREATE INDEX `WorkspaceSurfaceBinding_workspaceId_idx` ON `WorkspaceSurfaceBinding`(`workspaceId`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK workspaceId → Workspace(id) ON DELETE CASCADE。
SET @stmt = (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND table_name = 'WorkspaceSurfaceBinding'
        AND constraint_name = 'WorkspaceSurfaceBinding_workspaceId_fkey'
    ),
    'ALTER TABLE `WorkspaceSurfaceBinding` ADD CONSTRAINT `WorkspaceSurfaceBinding_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
  )
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
