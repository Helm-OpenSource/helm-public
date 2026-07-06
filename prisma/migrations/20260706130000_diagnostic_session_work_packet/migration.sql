-- CreateTable
CREATE TABLE `DiagnosticSessionWorkPacket` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `diagnosticSessionId` VARCHAR(191) NOT NULL,
    `actionItemId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DiagnosticSessionWorkPacket_diagnosticSessionId_key`(`diagnosticSessionId`),
    INDEX `DiagnosticSessionWorkPacket_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiagnosticSessionWorkPacket` ADD CONSTRAINT `DiagnosticSessionWorkPacket_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
