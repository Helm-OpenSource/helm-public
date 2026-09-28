-- Additive first-password activation ledger; relationMode=prisma.
CREATE TABLE `MemberActivationToken` (
 `id` VARCHAR(191) NOT NULL,
 `tokenHash` CHAR(64) NOT NULL,
 `userId` VARCHAR(191) NOT NULL,
 `membershipId` VARCHAR(191) NOT NULL,
 `workspaceId` VARCHAR(191) NOT NULL,
 `issuedByUserId` VARCHAR(191) NOT NULL,
 `issuedBySessionId` VARCHAR(191) NOT NULL,
 `membershipUpdatedAt` DATETIME(3) NOT NULL,
 `emailHash` CHAR(64) NOT NULL,
 `expiresAt` DATETIME(3) NOT NULL,
 `consumedAt` DATETIME(3) NULL,
 `revokedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `MemberActivationToken_tokenHash_key` (`tokenHash`),
 INDEX `MemberActivationToken_userId_consumedAt_revokedAt_idx` (`userId`, `consumedAt`, `revokedAt`),
 INDEX `MemberActivationToken_workspaceId_membershipId_idx` (`workspaceId`, `membershipId`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
