CREATE TABLE `BiReportFeedbackMemory` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `extensionKey` VARCHAR(191) NULL,
  `skillKey` VARCHAR(191) NOT NULL,
  `skillVersion` VARCHAR(191) NOT NULL,
  `windowLabel` VARCHAR(191) NULL,
  `feedbackStatus` VARCHAR(191) NOT NULL,
  `confirmedCause` VARCHAR(191) NULL,
  `confirmedAction` VARCHAR(191) NULL,
  `resolutionOutcome` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_bi_fb_mem_ws_skill_created`
ON `BiReportFeedbackMemory`(`workspaceId`, `skillKey`, `createdAt`);

CREATE INDEX `idx_bi_fb_mem_ws_ext_skill_created`
ON `BiReportFeedbackMemory`(`workspaceId`, `extensionKey`, `skillKey`, `createdAt`);
