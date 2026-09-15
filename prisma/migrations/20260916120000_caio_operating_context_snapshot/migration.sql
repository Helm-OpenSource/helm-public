-- CAIO operating-context snapshot: one replayable P3a TemporalOperatingContextSnapshot per quick-check
-- tick (tenant live shadow scope).
--
-- CAIO-owned table only. projectionInputJson keeps the exact projection input so the snapshot can be
-- re-derived and verified; the input carries letter-encoded aliases, never raw workspace, run,
-- catalog or receipt ids. Rejected projections keep only closed error codes. tickId is unique, so a
-- tick has at most one snapshot row.

-- CreateTable
CREATE TABLE `CaioOperatingContextSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `tickId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `reasonCode` VARCHAR(191) NULL,
    `errorCodesJson` LONGTEXT NULL,
    `snapshotId` VARCHAR(191) NULL,
    `snapshotHash` VARCHAR(191) NULL,
    `replayRootHash` VARCHAR(191) NULL,
    `objectCount` INTEGER NOT NULL DEFAULT 0,
    `signalCount` INTEGER NOT NULL DEFAULT 0,
    `projectionInputJson` LONGTEXT NULL,
    `snapshotJson` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaioOperatingContextSnapshot_tickId_key`(`tickId`),
    INDEX `CaioOperatingContextSnapshot_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- AddForeignKey
ALTER TABLE `CaioOperatingContextSnapshot`
  ADD CONSTRAINT `CaioOperatingContextSnapshot_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaioOperatingContextSnapshot`
  ADD CONSTRAINT `CaioOperatingContextSnapshot_tickId_fkey`
  FOREIGN KEY (`tickId`) REFERENCES `CaioQuickCheckTick`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
