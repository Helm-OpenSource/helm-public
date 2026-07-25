CREATE TABLE `DataAssetCatalogEntry` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `assetKey` VARCHAR(191) NOT NULL,
  `sourceSystemRef` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `sourceKind` VARCHAR(191) NOT NULL,
  `businessDomain` VARCHAR(191) NOT NULL,
  `businessOwnerRef` VARCHAR(191) NOT NULL,
  `dataShape` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
  `sensitivity` VARCHAR(191) NOT NULL DEFAULT 'RESTRICTED',
  `processingDisposition` VARCHAR(191) NOT NULL DEFAULT 'LOCAL_ONLY',
  `inventoryStatus` VARCHAR(191) NOT NULL DEFAULT 'INVENTORIED',
  `classificationStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `authorizationStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_REQUESTED',
  `connectionStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
  `initializationStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
  `purpose` LONGTEXT NOT NULL,
  `scopeRefs` LONGTEXT NOT NULL,
  `authorizationRef` VARCHAR(191) NULL,
  `authorizationValidFrom` DATETIME(3) NULL,
  `authorizationValidUntil` DATETIME(3) NULL,
  `consentRefs` LONGTEXT NOT NULL,
  `recommendedAccessMode` VARCHAR(191) NOT NULL,
  `connectorRef` VARCHAR(191) NULL,
  `retentionDays` INTEGER NOT NULL,
  `freshnessSlaMinutes` INTEGER NOT NULL,
  `residencyRequirements` LONGTEXT NOT NULL,
  `blindSpots` LONGTEXT NOT NULL,
  `blockerCodes` LONGTEXT NOT NULL,
  `riskOwnerRef` VARCHAR(191) NULL,
  `nextReviewAt` DATETIME(3) NULL,
  `observationSourceRefs` LONGTEXT NOT NULL,
  `observationRunRefs` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `classificationReceiptRef` VARCHAR(191) NULL,
  `authorizationReceiptRef` VARCHAR(191) NULL,
  `connectionReceiptRef` VARCHAR(191) NULL,
  `initializationReceiptRef` VARCHAR(191) NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `observationClaimSequence` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DataAssetCatalogEntry_workspaceId_assetKey_key` (`workspaceId`, `assetKey`),
  INDEX `DataAssetCatalogEntry_inventory_class_idx` (`workspaceId`, `inventoryStatus`, `classificationStatus`),
  INDEX `DataAssetCatalogEntry_auth_conn_init_idx` (`workspaceId`, `authorizationStatus`, `connectionStatus`, `initializationStatus`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DataAssetStageReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `assetId` VARCHAR(191) NOT NULL,
  `receiptType` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `expectedVersion` INTEGER NOT NULL,
  `resultingVersion` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `actorRef` VARCHAR(191) NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `DataAssetStageReceipt_workspace_type_key` (`workspaceId`, `receiptType`, `idempotencyKey`),
  UNIQUE INDEX `DataAssetStageReceipt_assetId_resultingVersion_key` (`assetId`, `resultingVersion`),
  INDEX `DataAssetStageReceipt_workspace_type_time_idx` (`workspaceId`, `receiptType`, `recordedAt`),
  INDEX `DataAssetStageReceipt_asset_type_time_idx` (`assetId`, `receiptType`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ObservationSource`
  ADD COLUMN `catalogEntryId` VARCHAR(191) NULL;

CREATE TABLE `ObservationSourceCompatibilityReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `observationSourceId` VARCHAR(191) NOT NULL,
  `migrationRef` VARCHAR(191) NOT NULL,
  `capturedAt` DATETIME(3) NOT NULL,
  `actorRef` VARCHAR(191) NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `nextReviewAt` DATETIME(3) NOT NULL,
  `sourceFingerprint` VARCHAR(191) NOT NULL,
  `restrictions` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ObsSourceCompatReceipt_sourceId_key` (`observationSourceId`),
  INDEX `ObsSourceCompatReceipt_workspace_review_idx` (`workspaceId`, `nextReviewAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ObservationSourceCompatibilityReceipt` (
  `id`,
  `workspaceId`,
  `observationSourceId`,
  `migrationRef`,
  `capturedAt`,
  `actorRef`,
  `evidenceRefs`,
  `nextReviewAt`,
  `sourceFingerprint`,
  `restrictions`
)
SELECT
  CONCAT('compat-', LEFT(SHA2(CONCAT('pre-catalog-source:', `id`), 256), 24)),
  `workspaceId`,
  `id`,
  'migration:20260723120000_caio_data_asset_catalog',
  CURRENT_TIMESTAMP(3),
  'migration:caio-data-asset-catalog',
  '["evidence:migration:pre-catalog-source-snapshot"]',
  DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 30 DAY),
  CONCAT(
    'sha256:',
    SHA2(
      CONCAT_WS(
        '|',
        `workspaceId`,
        `programId`,
        `sourceKey`,
        `sourceKind`,
        `accessMode`,
        `ownerRef`,
        `sensitivity`,
        `authorizationRef`,
        `secretRef`,
        `retentionDays`,
        `status`
      ),
      256
    )
  ),
  '["read_only_only","no_capability_expansion","catalog_backfill_required"]'
FROM `ObservationSource`;

CREATE INDEX `ObservationSource_catalogEntryId_status_idx`
  ON `ObservationSource`(`catalogEntryId`, `status`);

ALTER TABLE `DataAssetCatalogEntry`
  ADD CONSTRAINT `DataAssetCatalogEntry_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DataAssetStageReceipt`
  ADD CONSTRAINT `DataAssetStageReceipt_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DataAssetStageReceipt`
  ADD CONSTRAINT `DataAssetStageReceipt_assetId_fkey`
  FOREIGN KEY (`assetId`) REFERENCES `DataAssetCatalogEntry`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ObservationSource`
  ADD CONSTRAINT `ObservationSource_catalogEntryId_fkey`
  FOREIGN KEY (`catalogEntryId`) REFERENCES `DataAssetCatalogEntry`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ObservationSourceCompatibilityReceipt`
  ADD CONSTRAINT `ObservationSourceCompatibilityReceipt_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ObservationSourceCompatibilityReceipt`
  ADD CONSTRAINT `ObsSourceCompatReceipt_sourceId_fkey`
  FOREIGN KEY (`observationSourceId`) REFERENCES `ObservationSource`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
