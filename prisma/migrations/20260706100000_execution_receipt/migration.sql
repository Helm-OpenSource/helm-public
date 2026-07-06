-- CreateTable
CREATE TABLE `ExecutionReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `subjectType` ENUM('ACTION_ITEM', 'HUMAN_ACTION_EXECUTION') NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `actionItemId` VARCHAR(191) NULL,
    `outcome` ENUM('SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE', 'NOT_EXECUTED', 'REJECTED') NOT NULL,
    `actionTaken` VARCHAR(191) NOT NULL,
    `evidenceRefs` LONGTEXT NULL,
    `rejectionReasonCode` ENUM('DIAGNOSIS_ERROR', 'BOUNDARY_ERROR', 'OWNER_DISAGREEMENT', 'EVIDENCE_MISSING', 'EXECUTION_UNFIT', 'OTHER') NULL,
    `nextStep` VARCHAR(191) NULL,
    `note` LONGTEXT NULL,
    `executedByUserId` VARCHAR(191) NULL,
    `executedByActorType` ENUM('USER', 'SYSTEM', 'AI') NULL,
    `verifiedByUserId` VARCHAR(191) NULL,
    `verificationState` ENUM('SELF_REPORTED', 'VERIFIED') NOT NULL DEFAULT 'SELF_REPORTED',
    `qualityScore` INTEGER NOT NULL DEFAULT 0,
    `qualityFlags` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExecutionReceipt_actionItemId_key`(`actionItemId`),
    UNIQUE INDEX `ExecutionReceipt_subjectType_subjectId_key`(`subjectType`, `subjectId`),
    INDEX `ExecutionReceipt_workspaceId_outcome_idx`(`workspaceId`, `outcome`),
    INDEX `ExecutionReceipt_workspaceId_verificationState_idx`(`workspaceId`, `verificationState`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExecutionReceipt` ADD CONSTRAINT `ExecutionReceipt_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExecutionReceipt` ADD CONSTRAINT `ExecutionReceipt_actionItemId_fkey` FOREIGN KEY (`actionItemId`) REFERENCES `ActionItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
