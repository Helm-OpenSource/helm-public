-- QoderWork is an external candidate provider only. This migration adds the
-- generic device credential record and extends the existing external memory
-- ledger provider enum; it does not activate any workspace or create a token.

ALTER TABLE `ExternalMemorySyncState`
  MODIFY `provider` ENUM('OPENCLAW', 'QODERWORK') NOT NULL;

ALTER TABLE `ExternalMemoryRecord`
  MODIFY `provider` ENUM('OPENCLAW', 'QODERWORK') NOT NULL;

CREATE TABLE `ExternalAgentConnection` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `observationProgramId` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NOT NULL,
  `deviceRef` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `tokenPrefix` VARCHAR(191) NOT NULL,
  `scopesJson` LONGTEXT NOT NULL,
  `allowedSourceIdsJson` LONGTEXT NOT NULL,
  `allowedObjectTypesJson` LONGTEXT NOT NULL,
  `maxDataClassification` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `revokedByUserId` VARCHAR(191) NULL,
  `lastConnectedAt` DATETIME(3) NULL,
  `lastClientName` VARCHAR(191) NULL,
  `lastClientVersion` VARCHAR(191) NULL,
  `lastFailureCode` VARCHAR(191) NULL,
  `rateWindowStartedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rateWindowRequestCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ExternalAgentConnection_tokenHash_key` (`tokenHash`),
  UNIQUE INDEX `ExternalAgentConnection_workspace_provider_device_key` (`workspaceId`, `providerId`, `deviceRef`),
  INDEX `ExternalAgentConnection_workspace_provider_revoked_expires_idx` (`workspaceId`, `providerId`, `revokedAt`, `expiresAt`),
  INDEX `ExternalAgentConnection_userId_idx` (`userId`),
  INDEX `ExternalAgentConnection_observationProgramId_idx` (`observationProgramId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ExternalAgentConnection`
  ADD CONSTRAINT `ExternalAgentConnection_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ExternalAgentConnection`
  ADD CONSTRAINT `ExternalAgentConnection_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ExternalAgentConnection`
  ADD CONSTRAINT `ExternalAgentConnection_observationProgramId_fkey`
  FOREIGN KEY (`observationProgramId`) REFERENCES `EnterpriseObservationProgram`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
