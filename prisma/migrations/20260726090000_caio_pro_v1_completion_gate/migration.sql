-- CAIO Pro V1 site-deployment completion gate. Governance and evidence
-- records only: an accepted completion gate is the PRECONDITION for
-- full-function operation, never its activation. It grants no permission
-- and activates no execution path.

CREATE TABLE `CaioQuestionValueReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `selectionReceiptId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioQuestionValueReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CQValueReceipt_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `CQValueReceipt_workspace_selection_question_version_key` (`workspaceId`, `selectionReceiptId`, `questionId`, `version`),
  INDEX `CQValueReceipt_workspace_selection_question_idx` (`workspaceId`, `selectionReceiptId`, `questionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioProV1RetrospectiveReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `selectionReceiptId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioProV1RetrospectiveReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CPV1Retro_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `CPV1Retro_workspace_selection_version_key` (`workspaceId`, `selectionReceiptId`, `version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioProV1EvidenceAttestation` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `itemKey` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `ceoPrincipalBindingId` VARCHAR(191) NOT NULL,
  `ceoPrincipalRef` VARCHAR(191) NOT NULL,
  `actorType` ENUM('USER', 'SYSTEM', 'AI') NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `statement` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `attestationJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioProV1EvidenceAttestation_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CPV1Attestation_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `CPV1Attestation_workspace_item_version_key` (`workspaceId`, `itemKey`, `version`),
  INDEX `CPV1Attestation_workspace_item_time_idx` (`workspaceId`, `itemKey`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioProV1CompletionAssessment` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `evaluationKey` VARCHAR(191) NOT NULL,
  `schemaVersion` VARCHAR(191) NOT NULL,
  `evaluatorRevision` VARCHAR(191) NOT NULL,
  `basisHash` VARCHAR(191) NOT NULL,
  `decision` VARCHAR(191) NOT NULL,
  `inputJson` LONGTEXT NOT NULL,
  `assessmentJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `evaluatedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioProV1CompletionAssessment_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CPV1Assessment_workspace_eval_key` (`workspaceId`, `evaluationKey`),
  UNIQUE INDEX `CPV1Assessment_workspace_content_key` (`workspaceId`, `contentHash`),
  INDEX `CPV1Assessment_workspace_decision_time_idx` (`workspaceId`, `decision`, `evaluatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioProV1CompletionGateReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `assessmentId` VARCHAR(191) NOT NULL,
  `ceoPrincipalBindingId` VARCHAR(191) NOT NULL,
  `previousReceiptId` VARCHAR(191) NULL,
  `previousReceiptHash` VARCHAR(191) NULL,
  `sequence` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `resultingStatus` VARCHAR(191) NOT NULL,
  `actorType` ENUM('USER', 'SYSTEM', 'AI') NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `ceoPrincipalRef` VARCHAR(191) NOT NULL,
  `reasonCodes` LONGTEXT NOT NULL,
  `evidenceRefs` LONGTEXT NOT NULL,
  `basisHash` VARCHAR(191) NOT NULL,
  `receiptJson` LONGTEXT NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `authorityEffect` VARCHAR(191) NOT NULL,
  `fullFunctionOperation` VARCHAR(191) NOT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CaioProV1CompletionGateReceipt_id_workspaceId_key` (`id`, `workspaceId`),
  UNIQUE INDEX `CPV1GateReceipt_workspace_sequence_key` (`workspaceId`, `sequence`),
  UNIQUE INDEX `CPV1GateReceipt_workspace_idem_key` (`workspaceId`, `idempotencyKey`),
  UNIQUE INDEX `CPV1GateReceipt_prev_workspace_key` (`previousReceiptId`, `workspaceId`),
  INDEX `CPV1GateReceipt_workspace_status_time_idx` (`workspaceId`, `resultingStatus`, `recordedAt`),
  INDEX `CPV1GateReceipt_assessment_workspace_idx` (`assessmentId`, `workspaceId`),
  INDEX `CPV1GateReceipt_binding_workspace_idx` (`ceoPrincipalBindingId`, `workspaceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CaioProV1CompletionGateHead` (
  `workspaceId` VARCHAR(191) NOT NULL,
  `currentAssessmentId` VARCHAR(191) NOT NULL,
  `currentReceiptId` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `CaioProV1CompletionGateHead_currentReceiptId_key` (`currentReceiptId`),
  UNIQUE INDEX `CPV1GateHead_receipt_workspace_key` (`currentReceiptId`, `workspaceId`),
  INDEX `CPV1GateHead_assessment_workspace_idx` (`currentAssessmentId`, `workspaceId`),
  PRIMARY KEY (`workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CaioQuestionValueReceipt`
  ADD CONSTRAINT `CQValueReceipt_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioQuestionValueReceipt`
  ADD CONSTRAINT `CQValueReceipt_selection_workspace_fkey`
  FOREIGN KEY (`selectionReceiptId`, `workspaceId`)
  REFERENCES `CaioQuestionSelectionReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1RetrospectiveReceipt`
  ADD CONSTRAINT `CPV1Retro_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1RetrospectiveReceipt`
  ADD CONSTRAINT `CPV1Retro_selection_workspace_fkey`
  FOREIGN KEY (`selectionReceiptId`, `workspaceId`)
  REFERENCES `CaioQuestionSelectionReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1EvidenceAttestation`
  ADD CONSTRAINT `CPV1Attestation_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1EvidenceAttestation`
  ADD CONSTRAINT `CPV1Attestation_binding_workspace_fkey`
  FOREIGN KEY (`ceoPrincipalBindingId`, `workspaceId`)
  REFERENCES `CaioPrincipalBinding`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1CompletionAssessment`
  ADD CONSTRAINT `CPV1Assessment_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1CompletionGateReceipt`
  ADD CONSTRAINT `CPV1GateReceipt_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1CompletionGateReceipt`
  ADD CONSTRAINT `CPV1GateReceipt_assessment_workspace_fkey`
  FOREIGN KEY (`assessmentId`, `workspaceId`)
  REFERENCES `CaioProV1CompletionAssessment`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1CompletionGateReceipt`
  ADD CONSTRAINT `CPV1GateReceipt_binding_workspace_fkey`
  FOREIGN KEY (`ceoPrincipalBindingId`, `workspaceId`)
  REFERENCES `CaioPrincipalBinding`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1CompletionGateReceipt`
  ADD CONSTRAINT `CPV1GateReceipt_previous_workspace_fkey`
  FOREIGN KEY (`previousReceiptId`, `workspaceId`)
  REFERENCES `CaioProV1CompletionGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CaioProV1CompletionGateHead`
  ADD CONSTRAINT `CPV1GateHead_workspace_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1CompletionGateHead`
  ADD CONSTRAINT `CPV1GateHead_assessment_workspace_fkey`
  FOREIGN KEY (`currentAssessmentId`, `workspaceId`)
  REFERENCES `CaioProV1CompletionAssessment`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CaioProV1CompletionGateHead`
  ADD CONSTRAINT `CPV1GateHead_receipt_workspace_fkey`
  FOREIGN KEY (`currentReceiptId`, `workspaceId`)
  REFERENCES `CaioProV1CompletionGateReceipt`(`id`, `workspaceId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
