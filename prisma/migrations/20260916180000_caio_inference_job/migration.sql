-- CAIO P1-3 pull inference job queue (default off: no job enqueues until the review jobs ship).
-- Additive: one new table. The frozen input holds snapshot references and aggregate counts only; the layered
-- judgement body is private to this table and the public JudgementPacket is stored beside it.
-- CHECK constraints are hand-authored and invisible to check:migration-drift's datamodel comparison. The
-- schema uses relationMode = "prisma", so no database foreign key is created for workspaceId.
CREATE TABLE `CaioInferenceJob` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `taskClass` VARCHAR(32) NOT NULL,
    `windowStart` DATETIME(3) NOT NULL,
    `windowEnd` DATETIME(3) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `attempt` INTEGER NOT NULL DEFAULT 0,
    `inputJson` LONGTEXT NOT NULL,
    `inputHash` VARCHAR(80) NOT NULL,
    `claimToken` VARCHAR(64) NULL,
    `claimedAt` DATETIME(3) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `decisionRef` VARCHAR(191) NULL,
    `gatewayRef` VARCHAR(191) NULL,
    `dispatchClaimHash` VARCHAR(80) NULL,
    `judgementPacketJson` LONGTEXT NULL,
    `layeredJudgementJson` LONGTEXT NULL,
    `layeredJudgementHash` VARCHAR(80) NULL,
    `rejectionCode` VARCHAR(64) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `CaioInferenceJob_status_leaseExpiresAt_idx`(`status`, `leaseExpiresAt`),
    INDEX `CaioInferenceJob_workspaceId_status_createdAt_idx`(`workspaceId`, `status`, `createdAt`),
    UNIQUE INDEX `CaioInferenceJob_workspaceId_taskClass_windowStart_key`(`workspaceId`, `taskClass`, `windowStart`),
    CONSTRAINT `CaioInferenceJob_task_class_check`
      CHECK (`taskClass` IN ('hourly_diagnosis', 'daily_review')),
    CONSTRAINT `CaioInferenceJob_status_check`
      CHECK (`status` IN ('queued', 'claimed', 'completed', 'rejected', 'expired', 'dead_letter')),
    CONSTRAINT `CaioInferenceJob_attempt_check` CHECK (`attempt` >= 0),
    CONSTRAINT `CaioInferenceJob_window_check` CHECK (`windowEnd` > `windowStart`),
    CONSTRAINT `CaioInferenceJob_claimed_check`
      CHECK (`status` <> 'claimed' OR (`claimToken` IS NOT NULL AND `leaseExpiresAt` IS NOT NULL)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
