-- Helm CAIO Advise-stage loop: governance records only. An advice record
-- proposes and a CEO decision receipt projects; nothing here is an
-- authorization token and no permission, routing, or execution path reads
-- this table. Additive only; existing rows are unchanged.

CREATE TABLE `CaioAdviceRecord` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `mandateRecordId` VARCHAR(191) NOT NULL,
  `adviceKey` VARCHAR(191) NOT NULL,
  `caioRef` VARCHAR(191) NOT NULL,
  `subjectRef` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `recommendation` LONGTEXT NOT NULL,
  `observationRefs` LONGTEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `proposedAt` DATETIME(3) NOT NULL,
  `validUntil` DATETIME(3) NOT NULL,
  `decidedByRef` VARCHAR(191) NULL,
  `decisionOutcome` VARCHAR(191) NULL,
  `decisionReason` LONGTEXT NULL,
  `decidedAt` DATETIME(3) NULL,
  `withdrawnAt` DATETIME(3) NULL,
  `auditRefs` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CaioAdviceRecord_workspaceId_adviceKey_key` (`workspaceId`, `adviceKey`),
  UNIQUE INDEX `CaioAdviceRecord_id_workspaceId_key` (`id`, `workspaceId`),
  INDEX `CaioAdviceRecord_workspaceId_status_idx` (`workspaceId`, `status`),
  INDEX `CaioAdviceRecord_mandateRecordId_createdAt_idx` (`mandateRecordId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CaioAdviceRecord` ADD CONSTRAINT `CaioAdviceRecord_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CaioAdviceRecord` ADD CONSTRAINT `CaioAdviceRecord_mandateRecordId_workspaceId_fkey` FOREIGN KEY (`mandateRecordId`, `workspaceId`) REFERENCES `CaioMandateRecord`(`id`, `workspaceId`) ON DELETE CASCADE ON UPDATE CASCADE;
