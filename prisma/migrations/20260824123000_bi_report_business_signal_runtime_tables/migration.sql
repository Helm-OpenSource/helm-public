-- These tables were previously available only through a manual bootstrap file.
-- Keep their names aligned with Prisma's case-sensitive runtime contract.
-- The datasource uses relationMode = "prisma", so this migration intentionally
-- does not create database foreign keys.
CREATE TABLE `BiReportBusinessSignal` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `sourceRunId` VARCHAR(191) NOT NULL,
    `skillKey` VARCHAR(191) NOT NULL,
    `signalType` VARCHAR(191) NOT NULL,
    `signalKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` LONGTEXT NOT NULL,
    `severity` ENUM('CLEAR', 'WATCH', 'WARN', 'ALERT', 'CRITICAL') NOT NULL,
    `continuityStatus` VARCHAR(191) NULL,
    `dimensionsJson` LONGTEXT NULL,
    `metricsJson` LONGTEXT NULL,
    `evidenceJson` LONGTEXT NULL,
    `recommendedActionsJson` LONGTEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `ownerUserId` VARCHAR(191) NULL,
    `ownerUserName` VARCHAR(191) NULL,
    `ownerUserEmail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BiReportBusinessSignal_workspaceId_skillKey_status_createdAt_idx`(`workspaceId`, `skillKey`, `status`, `createdAt`),
    INDEX `BiReportBusinessSignal_workspaceId_signalType_severity_creat_idx`(`workspaceId`, `signalType`, `severity`, `createdAt`),
    INDEX `BiReportBusinessSignal_sourceRunId_idx`(`sourceRunId`),
    INDEX `BiReportBusinessSignal_ownerUserId_status_createdAt_idx`(`ownerUserId`, `status`, `createdAt`),
    UNIQUE INDEX `bireportbusinesssignal_workspace_signalkey_key`(`workspaceId`, `signalKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BiReportSignalNotification` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `signalId` VARCHAR(191) NOT NULL,
    `targetUserId` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NOT NULL,
    `targetKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `providerMessageId` VARCHAR(191) NULL,
    `errorMessage` LONGTEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BiReportSignalNotification_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `BiReportSignalNotification_signalId_channel_createdAt_idx`(`signalId`, `channel`, `createdAt`),
    INDEX `BiReportSignalNotification_targetUserId_status_createdAt_idx`(`targetUserId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BiReportBusinessHandoffDecision` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `signalId` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewComment` LONGTEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BiReportBusinessHandoffDecision_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    INDEX `BiReportBusinessHandoffDecision_signalId_targetType_status_idx`(`signalId`, `targetType`, `status`),
    INDEX `BiReportBusinessHandoffDecision_reviewedByUserId_status_crea_idx`(`reviewedByUserId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BiReportHandoffExecutionLog` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `signalId` VARCHAR(191) NOT NULL,
    `decisionId` VARCHAR(191) NOT NULL,
    `actionItemId` VARCHAR(191) NULL,
    `approvalTaskId` VARCHAR(191) NULL,
    `stage` VARCHAR(191) NOT NULL,
    `authorUserId` VARCHAR(191) NOT NULL,
    `summary` LONGTEXT NOT NULL,
    `detailsJson` LONGTEXT NULL,
    `isEffective` BOOLEAN NULL,
    `followUpNeeded` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BiReportHandoffExecutionLog_workspaceId_signalId_stage_creat_idx`(`workspaceId`, `signalId`, `stage`, `createdAt`),
    INDEX `BiReportHandoffExecutionLog_decisionId_stage_createdAt_idx`(`decisionId`, `stage`, `createdAt`),
    INDEX `BiReportHandoffExecutionLog_actionItemId_stage_createdAt_idx`(`actionItemId`, `stage`, `createdAt`),
    INDEX `BiReportHandoffExecutionLog_approvalTaskId_stage_createdAt_idx`(`approvalTaskId`, `stage`, `createdAt`),
    INDEX `BiReportHandoffExecutionLog_authorUserId_stage_createdAt_idx`(`authorUserId`, `stage`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
