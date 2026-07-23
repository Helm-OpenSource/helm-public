-- Helm CAIO G0 initialization gate. These are governance and evidence records
-- only. An accepted gate grants no permission and activates no execution path.

ALTER TABLE `DataAssetCatalogEntry`
  ADD COLUMN `technicalFeasibility` VARCHAR(191) NOT NULL DEFAULT 'UNASSESSED';

CREATE UNIQUE INDEX `CaioPrincipalBinding_id_workspaceId_key`
  ON `CaioPrincipalBinding`(`id`, `workspaceId`);

CREATE TABLE `CaioInitializationAssessment` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `mandateRecordId` VARCHAR(191) NOT NULL,
  `evaluationKey` VARCHAR(191) NOT NULL,
  `schemaVersion` VARCHAR(191) NOT NULL,
  `evaluatorRevision` VARCHAR(191) NOT NULL,
  `policyRef` VARCHAR(191) NOT NULL,
  `policyHash` VARCHAR(191) NOT NULL,
  `basisHash` VARCHAR(191) NOT NULL,
  `decision` VARCHAR(191) NOT NULL,
  `inputJson` LONGTEXT NOT NULL,
  `assessmentJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `evaluatedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioInitializationAssessment_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CaioInitAssessment_workspace_eval_key` (`workspaceId`, `evaluationKey`),
  UNIQUE INDEX `CaioInitAssessment_workspace_content_key` (`workspaceId`, `contentHash`),
  INDEX `CaioInitAssessment_workspace_decision_time_idx` (`workspaceId`, `decision`, `evaluatedAt`),
  INDEX `CaioInitAssessment_mandate_time_idx` (`mandateRecordId`, `evaluatedAt`),
  INDEX `CaioInitAssessment_mandate_workspace_idx` (`mandateRecordId`, `workspaceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioInitializationGateReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `assessmentId` VARCHAR(191) NOT NULL,
  `mandateRecordId` VARCHAR(191) NOT NULL,
  `ceoPrincipalBindingId` VARCHAR(191) NOT NULL,
  `previousReceiptId` VARCHAR(191) NULL,
  `sequence` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `resultingStatus` VARCHAR(191) NOT NULL,
  `actorType` ENUM('USER', 'SYSTEM', 'AI') NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `ceoPrincipalRef` VARCHAR(191) NOT NULL,
  `inventoryConfirmationRef` VARCHAR(191) NULL,
  `customerAcceptanceRef` VARCHAR(191) NULL,
  `acceptedExceptionRefs` LONGTEXT NOT NULL,
  `reasonCodes` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `basisHash` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioInitializationGateReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CaioInitGateReceipt_workspace_sequence_key` (`workspaceId`, `sequence`),
  UNIQUE INDEX `CaioInitGateReceipt_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `CaioInitGateReceipt_prev_workspace_key` (`previousReceiptId`, `workspaceId`),
  INDEX `CaioInitGateReceipt_workspace_status_time_idx` (`workspaceId`, `resultingStatus`, `recordedAt`),
  INDEX `CaioInitGateReceipt_assessment_time_idx` (`assessmentId`, `recordedAt`),
  INDEX `CaioInitGateReceipt_assessment_workspace_idx` (`assessmentId`, `workspaceId`),
  INDEX `CaioInitGateReceipt_mandate_workspace_idx` (`mandateRecordId`, `workspaceId`),
  INDEX `CaioInitGateReceipt_binding_workspace_idx` (`ceoPrincipalBindingId`, `workspaceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioInitializationGateHead` (
  `workspaceId` VARCHAR(191) NOT NULL,
  `currentAssessmentId` VARCHAR(191) NOT NULL,
  `currentReceiptId` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CaioInitializationGateHead_currentReceiptId_key` (`currentReceiptId`),
  UNIQUE INDEX `CaioInitGateHead_receipt_workspace_key` (`currentReceiptId`, `workspaceId`),
  INDEX `CaioInitGateHead_assessment_workspace_idx` (`currentAssessmentId`, `workspaceId`),
  PRIMARY KEY (`workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CaioInitializationAssessment`
  ADD CONSTRAINT `CaioInitializationAssessment_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationAssessment`
  ADD CONSTRAINT `CaioInitializationAssessment_mandate_workspace_fkey`
  FOREIGN KEY (`mandateRecordId`, `workspaceId`)
  REFERENCES `CaioMandateRecord`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationGateReceipt`
  ADD CONSTRAINT `CaioInitializationGateReceipt_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationGateReceipt`
  ADD CONSTRAINT `CaioInitializationGateReceipt_assessment_workspace_fkey`
  FOREIGN KEY (`assessmentId`, `workspaceId`)
  REFERENCES `CaioInitializationAssessment`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationGateReceipt`
  ADD CONSTRAINT `CaioInitializationGateReceipt_mandate_workspace_fkey`
  FOREIGN KEY (`mandateRecordId`, `workspaceId`)
  REFERENCES `CaioMandateRecord`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationGateReceipt`
  ADD CONSTRAINT `CaioInitializationGateReceipt_binding_workspace_fkey`
  FOREIGN KEY (`ceoPrincipalBindingId`, `workspaceId`)
  REFERENCES `CaioPrincipalBinding`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationGateReceipt`
  ADD CONSTRAINT `CaioInitializationGateReceipt_previous_workspace_fkey`
  FOREIGN KEY (`previousReceiptId`, `workspaceId`)
  REFERENCES `CaioInitializationGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioInitializationGateHead`
  ADD CONSTRAINT `CaioInitializationGateHead_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationGateHead`
  ADD CONSTRAINT `CaioInitializationGateHead_assessment_workspace_fkey`
  FOREIGN KEY (`currentAssessmentId`, `workspaceId`)
  REFERENCES `CaioInitializationAssessment`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioInitializationGateHead`
  ADD CONSTRAINT `CaioInitializationGateHead_receipt_workspace_fkey`
  FOREIGN KEY (`currentReceiptId`, `workspaceId`)
  REFERENCES `CaioInitializationGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
