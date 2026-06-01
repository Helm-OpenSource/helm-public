-- CreateTable
CREATE TABLE `DingTalkDirectoryInviteSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `operatorUserId` VARCHAR(191) NULL,
    `operatorName` VARCHAR(191) NULL,
    `dryRun` BOOLEAN NOT NULL DEFAULT true,
    `processed` INTEGER NOT NULL DEFAULT 0,
    `createdUsers` INTEGER NOT NULL DEFAULT 0,
    `reusedUsers` INTEGER NOT NULL DEFAULT 0,
    `upsertedMemberships` INTEGER NOT NULL DEFAULT 0,
    `sentMessages` INTEGER NOT NULL DEFAULT 0,
    `skipped` INTEGER NOT NULL DEFAULT 0,
    `skippedNoMobile` INTEGER NOT NULL DEFAULT 0,
    `nameCollisionResolved` INTEGER NOT NULL DEFAULT 0,
    `errorsJson` LONGTEXT NULL,
    `detailsJson` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DTInviteSnapshot_workspace_dryrun_created_idx`(`workspaceId`, `dryRun`, `createdAt`),
    INDEX `DTInviteSnapshot_workspace_created_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
