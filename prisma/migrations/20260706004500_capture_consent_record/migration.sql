-- CreateTable
CREATE TABLE `CaptureConsentRecord` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NOT NULL,
    `confirmedByUserId` VARCHAR(191) NULL,
    `confirmedByName` VARCHAR(191) NOT NULL,
    `method` ENUM('UI_CHECKBOX', 'EXTERNAL_ATTESTATION') NOT NULL DEFAULT 'UI_CHECKBOX',
    `noticeTextVersion` VARCHAR(191) NOT NULL DEFAULT 'capture-consent-notice/v1',
    `counterpartyNotified` BOOLEAN NOT NULL DEFAULT false,
    `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CaptureConsentRecord_captureSessionId_key`(`captureSessionId`),
    INDEX `CaptureConsentRecord_workspaceId_confirmedAt_idx`(`workspaceId`, `confirmedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

