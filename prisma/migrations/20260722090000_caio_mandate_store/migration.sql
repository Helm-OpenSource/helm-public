-- Helm CAIO mandate store: governance records only. A stored mandate is
-- never an authorization token; no permission, routing, or execution path
-- reads these tables. All tables are additive; existing rows are unchanged.

CREATE TABLE `CaioMandateRecord` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `caioRef` VARCHAR(191) NOT NULL,
  `ceoRef` VARCHAR(191) NOT NULL,
  `stage` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `objectiveRefs` LONGTEXT NOT NULL,
  `scopeRefs` LONGTEXT NOT NULL,
  `grantBasisRefs` LONGTEXT NOT NULL,
  `reservedMatterRefs` LONGTEXT NOT NULL,
  `stageDecisionRef` VARCHAR(191) NOT NULL,
  `policyEnvelopeRefs` LONGTEXT NOT NULL,
  `humanResponsePolicyRef` VARCHAR(191) NOT NULL,
  `accountabilityAnchorRefs` LONGTEXT NOT NULL,
  `guardianStopRefs` LONGTEXT NOT NULL,
  `emergencyStopRef` VARCHAR(191) NULL,
  `validFrom` DATETIME(3) NOT NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `supersedesRef` VARCHAR(191) NULL,
  `inFlightDisposition` VARCHAR(191) NOT NULL,
  `auditRefs` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CaioMandateRecord_workspaceId_status_idx` (`workspaceId`, `status`),
  UNIQUE INDEX `CaioMandateRecord_id_workspaceId_key` (`id`, `workspaceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioActiveMandateClaim` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `mandateRecordId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CaioActiveMandateClaim_workspaceId_key` (`workspaceId`),
  UNIQUE INDEX `CaioActiveMandateClaim_mandateRecordId_key` (`mandateRecordId`),
  UNIQUE INDEX `CaioActiveMandateClaim_mandateRecordId_workspaceId_key` (`mandateRecordId`, `workspaceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioGuardianStopRecord` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `mandateRecordId` VARCHAR(191) NOT NULL,
  `guardianRef` VARCHAR(191) NOT NULL,
  `reason` LONGTEXT NOT NULL,
  `triggeredAt` DATETIME(3) NOT NULL,
  `resumedByRef` VARCHAR(191) NULL,
  `resumedAt` DATETIME(3) NULL,
  `auditRefs` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CaioGuardianStopRecord_mandateRecordId_createdAt_idx` (`mandateRecordId`, `createdAt`),
  INDEX `CaioGuardianStopRecord_workspaceId_createdAt_idx` (`workspaceId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CaioMandateRecord` ADD CONSTRAINT `CaioMandateRecord_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CaioActiveMandateClaim` ADD CONSTRAINT `CaioActiveMandateClaim_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CaioActiveMandateClaim` ADD CONSTRAINT `CaioActiveMandateClaim_mandateRecordId_workspaceId_fkey` FOREIGN KEY (`mandateRecordId`, `workspaceId`) REFERENCES `CaioMandateRecord`(`id`, `workspaceId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CaioGuardianStopRecord` ADD CONSTRAINT `CaioGuardianStopRecord_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CaioGuardianStopRecord` ADD CONSTRAINT `CaioGuardianStopRecord_mandateRecordId_workspaceId_fkey` FOREIGN KEY (`mandateRecordId`, `workspaceId`) REFERENCES `CaioMandateRecord`(`id`, `workspaceId`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `CaioPrincipalBinding` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `principalRef` VARCHAR(191) NOT NULL,
  `principalKind` VARCHAR(191) NOT NULL,
  `evidenceRef` VARCHAR(191) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CaioPrincipalBinding_workspaceId_userId_principalRef_key` (`workspaceId`, `userId`, `principalRef`),
  INDEX `CaioPrincipalBinding_workspaceId_principalRef_idx` (`workspaceId`, `principalRef`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CaioPrincipalBinding` ADD CONSTRAINT `CaioPrincipalBinding_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
