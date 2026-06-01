CREATE TABLE `BiReportRunMemory` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `extensionKey` VARCHAR(191) NULL,
  `skillKey` VARCHAR(191) NOT NULL,
  `skillVersion` VARCHAR(191) NOT NULL,
  `windowLabel` VARCHAR(191) NOT NULL,
  `severity` ENUM('CLEAR', 'WATCH', 'WARN', 'ALERT', 'CRITICAL') NULL,
  `shouldSend` BOOLEAN NOT NULL DEFAULT false,
  `summaryMetricsJson` VARCHAR(191) NOT NULL,
  `topFindingsJson` VARCHAR(191) NOT NULL,
  `analysisSummary` VARCHAR(191) NOT NULL,
  `continuityStatus` VARCHAR(191) NULL,
  `historicalContext` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_bi_run_mem_ws_skill_created`
ON `BiReportRunMemory`(`workspaceId`, `skillKey`, `createdAt`);

CREATE INDEX `idx_bi_run_mem_ws_ext_skill_created`
ON `BiReportRunMemory`(`workspaceId`, `extensionKey`, `skillKey`, `createdAt`);
