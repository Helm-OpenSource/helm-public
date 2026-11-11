-- Seat desktop device authorization (2026-11-11, D1 PR-1a-1): the device-initiated authorization row and the
-- history of every token hash it retired. New tables only; no existing table is touched. Rows are written only by
-- lib/seat-device once the deployment switch HELM_SEAT_DEVICE_AUTH_ENABLED and the workspace flag are both on, so
-- with the switch off (the default) both tables stay empty.
--
-- SeatDeviceAuthorization: one row per device request; its id is both the requestId the client polls with and the
-- deviceId of the approved credential. Identity columns stay NULL until a member approves the request. Tokens and
-- the pairing code are stored as sha256 hashes only; the pairing hash is cleared once the request is decided.
-- Lifecycle writes are CAS on (id, version); "expired" is derived from requestExpiresAt / expiresAt, never stored.
-- expiresAt is fixed at approval (absolute 30 days) and never extended by a refresh.
--
-- SeatDeviceTokenHistory: append-only; every rotated-out token hash of a device lands here so a replayed token is
-- recognised as belonging to that device (token family reuse detection) and can still revoke it.
--
-- Unique hashes are the token lookup path (MySQL admits repeated NULLs). No foreign keys (relationMode = "prisma").
-- Rollback: prisma/rollback/20261111_rollback_seat_device_authorization.sql (refused while either table has a row).

CREATE TABLE IF NOT EXISTS `SeatDeviceAuthorization` (
    `id` VARCHAR(191) NOT NULL,
    `clientType` VARCHAR(32) NOT NULL,
    `deviceLabel` VARCHAR(80) NOT NULL,
    `clientVersion` VARCHAR(40) NULL,
    `status` VARCHAR(16) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `pollTokenHash` CHAR(64) NOT NULL,
    `pairingCodeHash` CHAR(64) NULL,
    `sourceIp` VARCHAR(64) NULL,
    `sourceBucket` VARCHAR(64) NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `requestExpiresAt` DATETIME(3) NOT NULL,
    `pollIntervalSec` INTEGER NOT NULL DEFAULT 5,
    `lastPolledAt` DATETIME(3) NULL,
    `claimedAt` DATETIME(3) NULL,
    `reclaimed` BOOLEAN NOT NULL DEFAULT false,
    `workspaceId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `membershipId` VARCHAR(191) NULL,
    `userPasswordSetAt` DATETIME(3) NULL,
    `approvalSource` VARCHAR(64) NULL,
    `approvedAuthSessionId` VARCHAR(191) NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `audiencePin` VARCHAR(191) NULL,
    `devicePublicKeyThumbprint` CHAR(64) NULL,
    `accessTokenHash` CHAR(64) NULL,
    `accessExpiresAt` DATETIME(3) NULL,
    `previousAccessTokenHash` CHAR(64) NULL,
    `previousAccessExpiresAt` DATETIME(3) NULL,
    `refreshTokenHash` CHAR(64) NULL,
    `refreshTokenUsed` BOOLEAN NOT NULL DEFAULT false,
    `previousRefreshTokenHash` CHAR(64) NULL,
    `rotatedAt` DATETIME(3) NULL,
    `rotationSource` VARCHAR(64) NULL,
    `graceUsed` BOOLEAN NOT NULL DEFAULT false,
    `issuedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `refreshWindowStartedAt` DATETIME(3) NULL,
    `refreshWindowCount` INTEGER NOT NULL DEFAULT 0,
    `lastUsedAt` DATETIME(3) NULL,
    `lastIp` VARCHAR(64) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedByUserId` VARCHAR(191) NULL,
    `revokeReason` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SeatDeviceAuthorization_pollTokenHash_key`(`pollTokenHash`),
    UNIQUE INDEX `SeatDeviceAuthorization_pairingCodeHash_key`(`pairingCodeHash`),
    UNIQUE INDEX `SeatDeviceAuthorization_accessTokenHash_key`(`accessTokenHash`),
    UNIQUE INDEX `SeatDeviceAuthorization_previousAccessTokenHash_key`(`previousAccessTokenHash`),
    UNIQUE INDEX `SeatDeviceAuthorization_refreshTokenHash_key`(`refreshTokenHash`),
    UNIQUE INDEX `SeatDeviceAuthorization_previousRefreshTokenHash_key`(`previousRefreshTokenHash`),
    INDEX `SeatDeviceAuthorization_workspaceId_userId_status_idx`(`workspaceId`, `userId`, `status`),
    INDEX `SeatDeviceAuthorization_workspaceId_membershipId_status_idx`(`workspaceId`, `membershipId`, `status`),
    INDEX `SeatDeviceAuthorization_status_requestExpiresAt_idx`(`status`, `requestExpiresAt`),
    INDEX `SeatDeviceAuthorization_sourceBucket_requestedAt_idx`(`sourceBucket`, `requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SeatDeviceTokenHistory` (
    `id` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(8) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `retiredAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SeatDeviceTokenHistory_tokenHash_key`(`tokenHash`),
    INDEX `SeatDeviceTokenHistory_deviceId_retiredAt_idx`(`deviceId`, `retiredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
