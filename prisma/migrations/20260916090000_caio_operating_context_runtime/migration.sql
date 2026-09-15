-- CAIO operating-context runtime: quick-check ticks, aggregate metric observations and merged
-- candidate anomalies.
--
-- These are CAIO-owned tables only. The quick check writes nothing else except the existing
-- observation run receipt path; it never writes business tables.
--
-- CaioQuickCheckTick: the unique (workspaceId, bucketStart) row is the cross-instance claim for one
-- 10-minute bucket, because the signal-collection scheduler holds no database lock.
-- CaioMetricObservation: tenant-private aggregate metric body (finite numbers or null only). A failed
-- read is stored as status='unknown' with valuesJson NULL, never as zero.
-- CaioAnomalyCandidate: openKey is set while OPEN and NULL once CLEARED, so the unique index admits one
-- open candidate per (detectorId, mergeKey) and any number of cleared ones (MySQL unique indexes
-- allow repeated NULLs).

-- CreateTable
CREATE TABLE `CaioQuickCheckTick` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `bucketStart` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RUNNING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `summaryJson` LONGTEXT NULL,

    INDEX `CaioQuickCheckTick_workspaceId_startedAt_idx`(`workspaceId`, `startedAt`),
    UNIQUE INDEX `CaioQuickCheckTick_workspaceId_bucketStart_key`(`workspaceId`, `bucketStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioMetricObservation` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `tickId` VARCHAR(191) NOT NULL,
    `observationRunId` VARCHAR(191) NULL,
    `sourceKey` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `windowStart` DATETIME(3) NOT NULL,
    `windowEnd` DATETIME(3) NOT NULL,
    `observedAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `valuesJson` LONGTEXT NULL,
    `denominator` DOUBLE NULL,
    `errorCode` VARCHAR(191) NULL,
    `contentHash` VARCHAR(191) NULL,
    `evidenceRef` VARCHAR(191) NULL,

    INDEX `CaioMetricObservation_workspaceId_templateId_observedAt_idx`(`workspaceId`, `templateId`, `observedAt`),
    UNIQUE INDEX `CaioMetricObservation_tickId_templateId_key`(`tickId`, `templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioAnomalyCandidate` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `detectorId` VARCHAR(191) NOT NULL,
    `mergeKey` VARCHAR(191) NOT NULL,
    `openKey` VARCHAR(191) NULL,
    `objectKey` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `reasonCode` VARCHAR(191) NOT NULL,
    `titleZh` VARCHAR(191) NOT NULL,
    `titleEn` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `hitCount` INTEGER NOT NULL DEFAULT 1,
    `firstSeenAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL,
    `clearedAt` DATETIME(3) NULL,
    `lastTickId` VARCHAR(191) NOT NULL,
    `evidenceRefsJson` LONGTEXT NOT NULL,

    INDEX `CaioAnomalyCandidate_workspaceId_status_lastSeenAt_idx`(`workspaceId`, `status`, `lastSeenAt`),
    UNIQUE INDEX `CaioAnomalyCandidate_workspaceId_openKey_key`(`workspaceId`, `openKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- AddForeignKey
ALTER TABLE `CaioQuickCheckTick`
  ADD CONSTRAINT `CaioQuickCheckTick_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaioMetricObservation`
  ADD CONSTRAINT `CaioMetricObservation_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaioMetricObservation`
  ADD CONSTRAINT `CaioMetricObservation_tickId_fkey`
  FOREIGN KEY (`tickId`) REFERENCES `CaioQuickCheckTick`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaioAnomalyCandidate`
  ADD CONSTRAINT `CaioAnomalyCandidate_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
