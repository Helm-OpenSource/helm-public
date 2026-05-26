-- Daily snapshot and refresh run ledger for engineering delivery review

CREATE TABLE `EngineeringDeliveryReviewSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `snapshotDate` DATETIME(3) NOT NULL,
  `windowDays` INTEGER NOT NULL DEFAULT 28,
  `payloadJson` LONGTEXT NOT NULL,
  `sourceRevision` VARCHAR(191) NULL,
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `EngDelivSnap_workspace_date_window_key`(`workspaceId`, `snapshotDate`, `windowDays`),
  INDEX `EngDelivSnap_workspace_generated_idx`(`workspaceId`, `generatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EngineeringDeliveryReviewRefreshRun` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `snapshotId` VARCHAR(191) NULL,
  `snapshotDate` DATETIME(3) NOT NULL,
  `windowDays` INTEGER NOT NULL DEFAULT 28,
  `status` VARCHAR(191) NOT NULL,
  `sourceRevision` VARCHAR(191) NULL,
  `errorMessage` LONGTEXT NULL,
  `trigger` VARCHAR(191) NOT NULL DEFAULT 'cron',
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `EngDelivRun_workspace_status_started_idx`(`workspaceId`, `status`, `startedAt`),
  INDEX `EngDelivRun_workspace_date_window_started_idx`(`workspaceId`, `snapshotDate`, `windowDays`, `startedAt`),
  INDEX `EngDelivRun_snapshot_idx`(`snapshotId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EngineeringDeliveryReviewSnapshot`
  ADD CONSTRAINT `EngineeringDeliveryReviewSnapshot_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EngineeringDeliveryReviewRefreshRun`
  ADD CONSTRAINT `EngineeringDeliveryReviewRefreshRun_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `EngineeringDeliveryReviewRefreshRun_snapshotId_fkey`
  FOREIGN KEY (`snapshotId`) REFERENCES `EngineeringDeliveryReviewSnapshot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
