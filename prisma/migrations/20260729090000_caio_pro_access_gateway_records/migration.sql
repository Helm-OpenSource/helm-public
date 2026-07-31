-- CreateTable
CREATE TABLE `CaioAccessToken` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userRef` VARCHAR(191) NOT NULL,
    `clientType` VARCHAR(191) NOT NULL,
    `deviceRef` VARCHAR(191) NOT NULL,
    `audience` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `tokenPrefix` VARCHAR(191) NOT NULL,
    `approvedSourceIp` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `rotatedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `rotatedFromTokenId` VARCHAR(191) NULL,
    `rateWindowStartedAt` DATETIME(3) NOT NULL,
    `rateWindowRequestCount` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `CaioAccessToken_token_hash_key`(`tokenHash`),
    INDEX `CaioAccessToken_binding_idx`(`workspaceId`, `deviceRef`, `audience`),
    INDEX `CaioAccessToken_status_expiry_idx`(`workspaceId`, `status`, `expiresAt`),
    UNIQUE INDEX `CaioAccessToken_id_workspace_key`(`id`, `workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioPairingRequest` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userRef` VARCHAR(191) NOT NULL,
    `clientType` VARCHAR(191) NOT NULL,
    `deviceRef` VARCHAR(191) NOT NULL,
    `sourceIp` VARCHAR(191) NOT NULL,
    `matchCodeHash` VARCHAR(191) NOT NULL,
    `clientPublicKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedByRef` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `issuedMcpTokenId` VARCHAR(191) NULL,
    `issuedModelTokenId` VARCHAR(191) NULL,

    INDEX `CaioPairingRequest_status_expiry_idx`(`workspaceId`, `status`, `expiresAt`),
    UNIQUE INDEX `CaioPairingRequest_id_workspace_key`(`id`, `workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioContextNegativeRule` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `ruleKey` VARCHAR(191) NOT NULL,
    `scopeKind` VARCHAR(191) NOT NULL,
    `scopeRef` VARCHAR(191) NULL,
    `ruleKind` VARCHAR(191) NOT NULL,
    `patternJson` LONGTEXT NOT NULL,
    `version` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdByRef` VARCHAR(191) NOT NULL,
    `publishedByRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,

    INDEX `CaioContextNegativeRule_status_idx`(`workspaceId`, `status`, `scopeKind`),
    UNIQUE INDEX `CaioContextNegativeRule_key_version_key`(`workspaceId`, `ruleKey`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioContextReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userRef` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `policyVersion` VARCHAR(191) NOT NULL,
    `ruleHitsJson` LONGTEXT NOT NULL,
    `sourcesJson` LONGTEXT NOT NULL,
    `redactionReliable` BOOLEAN NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    INDEX `CaioContextReceipt_user_time_idx`(`workspaceId`, `userRef`, `createdAt`),
    UNIQUE INDEX `CaioContextReceipt_workspace_request_key`(`workspaceId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioMemoryCandidate` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `projectRef` VARCHAR(191) NULL,
    `createdByRef` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `sourceRequestId` VARCHAR(191) NULL,
    `receiptJson` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `candidateExpiresAt` DATETIME(3) NOT NULL,
    `adoptedAt` DATETIME(3) NULL,
    `adoptedByRef` VARCHAR(191) NULL,
    `ephemeralExpiresAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifiedByRef` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedByRef` VARCHAR(191) NULL,
    `expiredAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CaioMemoryCandidate_state_ttl_idx`(`workspaceId`, `state`, `candidateExpiresAt`),
    INDEX `CaioMemoryCandidate_owner_state_idx`(`workspaceId`, `createdByRef`, `state`),
    UNIQUE INDEX `CaioMemoryCandidate_id_workspace_key`(`id`, `workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioAuditDispatchReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `clientType` VARCHAR(191) NOT NULL,
    `modelAlias` VARCHAR(191) NOT NULL,
    `inputHash` VARCHAR(191) NOT NULL,
    `policyVersion` VARCHAR(191) NOT NULL,
    `persistedVia` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    INDEX `CaioAuditDispatchReceipt_time_idx`(`workspaceId`, `createdAt`),
    UNIQUE INDEX `CaioAuditDispatchReceipt_workspace_request_key`(`workspaceId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaioCredentialRefState` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `credentialRef` VARCHAR(191) NOT NULL,
    `providerKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `rotatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CaioCredentialRefState_workspace_ref_key`(`workspaceId`, `credentialRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
