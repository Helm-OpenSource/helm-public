-- Public Stage 1 owner loop: owner-authorized observation, runtime decision /
-- supervision records, and an idempotent decision-to-work-packet claim.
-- All tables are additive; existing rows and execution chains are unchanged.

CREATE TABLE `EnterpriseObservationProgram` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `purpose` LONGTEXT NOT NULL,
  `scopeRefs` LONGTEXT NOT NULL,
  `dataCategories` LONGTEXT NOT NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `retentionDays` INTEGER NOT NULL,
  `authorizationRef` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `authorizationVersion` INTEGER NOT NULL DEFAULT 1,
  `runSequence` INTEGER NOT NULL DEFAULT 0,
  `revokedAt` DATETIME(3) NULL,
  `revokedByRef` VARCHAR(191) NULL,
  `revocationReason` LONGTEXT NULL,
  `auditRefs` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `EnterpriseObservationProgram_workspaceId_status_expiresAt_idx` (`workspaceId`, `status`, `expiresAt`),
  INDEX `EnterpriseObservationProgram_authorizationRef_idx` (`authorizationRef`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ObservationSource` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `programId` VARCHAR(191) NOT NULL,
  `sourceKey` VARCHAR(191) NOT NULL,
  `sourceKind` VARCHAR(191) NOT NULL,
  `accessMode` VARCHAR(191) NOT NULL,
  `ownerRef` VARCHAR(191) NOT NULL,
  `freshnessSlaMinutes` INTEGER NOT NULL,
  `sensitivity` VARCHAR(191) NOT NULL,
  `authorizationRef` VARCHAR(191) NOT NULL,
  `secretRef` VARCHAR(191) NOT NULL,
  `retentionDays` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `lastObservedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ObservationSource_workspaceId_sourceKey_key` (`workspaceId`, `sourceKey`),
  INDEX `ObservationSource_programId_status_idx` (`programId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ObservationSourceRun` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `programId` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `executionKey` VARCHAR(191) NOT NULL,
  `authorizationVersion` INTEGER NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `windowEnd` DATETIME(3) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'RUNNING',
  `observedAt` DATETIME(3) NULL,
  `summaryHash` VARCHAR(191) NULL,
  `completenessPercent` INTEGER NULL,
  `freshness` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
  `outcome` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
  `evidenceRefs` LONGTEXT NULL,
  `errorCodes` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ObservationSourceRun_sourceId_executionKey_key` (`sourceId`, `executionKey`),
  INDEX `ObservationSourceRun_workspaceId_status_createdAt_idx` (`workspaceId`, `status`, `createdAt`),
  INDEX `ObservationSourceRun_programId_status_idx` (`programId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DecisionRecord` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `decisionKey` VARCHAR(191) NOT NULL,
  `decisionType` VARCHAR(191) NOT NULL,
  `businessQuestion` LONGTEXT NOT NULL,
  `problemCategoryRef` VARCHAR(191) NULL,
  `contextRefs` LONGTEXT NOT NULL,
  `knowledgeRefs` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `policyRefs` LONGTEXT NOT NULL,
  `receiptRefs` LONGTEXT NOT NULL,
  `alternatives` LONGTEXT NOT NULL,
  `recommendedOption` LONGTEXT NULL,
  `confidence` VARCHAR(191) NOT NULL,
  `riskLevel` VARCHAR(191) NOT NULL,
  `allowedActionLevel` VARCHAR(191) NOT NULL,
  `ownerGate` VARCHAR(191) NOT NULL,
  `rollbackPath` LONGTEXT NULL,
  `factsJson` LONGTEXT NOT NULL,
  `inferencesJson` LONGTEXT NOT NULL,
  `unknownsJson` LONGTEXT NOT NULL,
  `risksJson` LONGTEXT NOT NULL,
  `ownerRef` VARCHAR(191) NULL,
  `ownerConclusion` LONGTEXT NULL,
  `ownerConfirmedAt` DATETIME(3) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `validUntil` DATETIME(3) NULL,
  `evaluationJson` LONGTEXT NULL,
  `evaluatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DecisionRecord_workspaceId_decisionKey_key` (`workspaceId`, `decisionKey`),
  INDEX `DecisionRecord_workspaceId_status_createdAt_idx` (`workspaceId`, `status`, `createdAt`),
  INDEX `DecisionRecord_workspaceId_ownerRef_status_idx` (`workspaceId`, `ownerRef`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupervisionSignalRecord` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `decisionRecordId` VARCHAR(191) NULL,
  `signalKey` VARCHAR(191) NOT NULL,
  `signalType` VARCHAR(191) NOT NULL,
  `observedObjectRef` VARCHAR(191) NOT NULL,
  `baselineRef` VARCHAR(191) NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `confidence` VARCHAR(191) NOT NULL,
  `recommendedRoute` VARCHAR(191) NOT NULL,
  `ownerRef` VARCHAR(191) NULL,
  `deadlineOrSla` DATETIME(3) NULL,
  `status` VARCHAR(191) NOT NULL,
  `observedFact` LONGTEXT NOT NULL,
  `interpretation` LONGTEXT NULL,
  `expectedState` LONGTEXT NULL,
  `actualState` LONGTEXT NOT NULL,
  `responsibilityScopeRef` VARCHAR(191) NULL,
  `escalationCondition` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SupervisionSignalRecord_workspaceId_signalKey_key` (`workspaceId`, `signalKey`),
  INDEX `SupervisionSignal_ws_status_severity_created_idx` (`workspaceId`, `status`, `severity`, `createdAt`),
  INDEX `SupervisionSignalRecord_decisionRecordId_createdAt_idx` (`decisionRecordId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DecisionWorkPacketClaim` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `decisionRecordId` VARCHAR(191) NOT NULL,
  `actionItemId` VARCHAR(191) NOT NULL,
  `ownerCommandJson` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DecisionWorkPacketClaim_decisionRecordId_key` (`decisionRecordId`),
  UNIQUE INDEX `DecisionWorkPacketClaim_actionItemId_key` (`actionItemId`),
  INDEX `DecisionWorkPacketClaim_workspaceId_createdAt_idx` (`workspaceId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EnterpriseObservationProgram` ADD CONSTRAINT `EnterpriseObservationProgram_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ObservationSource` ADD CONSTRAINT `ObservationSource_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ObservationSource` ADD CONSTRAINT `ObservationSource_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `EnterpriseObservationProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ObservationSourceRun` ADD CONSTRAINT `ObservationSourceRun_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ObservationSourceRun` ADD CONSTRAINT `ObservationSourceRun_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `EnterpriseObservationProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ObservationSourceRun` ADD CONSTRAINT `ObservationSourceRun_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `ObservationSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DecisionRecord` ADD CONSTRAINT `DecisionRecord_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SupervisionSignalRecord` ADD CONSTRAINT `SupervisionSignalRecord_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SupervisionSignalRecord` ADD CONSTRAINT `SupervisionSignalRecord_decisionRecordId_fkey` FOREIGN KEY (`decisionRecordId`) REFERENCES `DecisionRecord`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DecisionWorkPacketClaim` ADD CONSTRAINT `DecisionWorkPacketClaim_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DecisionWorkPacketClaim` ADD CONSTRAINT `DecisionWorkPacketClaim_decisionRecordId_fkey` FOREIGN KEY (`decisionRecordId`) REFERENCES `DecisionRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DecisionWorkPacketClaim` ADD CONSTRAINT `DecisionWorkPacketClaim_actionItemId_fkey` FOREIGN KEY (`actionItemId`) REFERENCES `ActionItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
